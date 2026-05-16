/**
 * Walkthrough runner — drives a parsed lab through a persistent shell and
 * (later) a Playwright/Nova Act browser, routing each step by its inventory
 * strategy.
 *
 * MVP scope: implements `local-cli`, `aws-cli`, `manual-only` strategies via
 * the persistent shell. `aws-ui` / `external-ui` / `local-install` print a
 * "skipped — strategy not implemented yet" notice and continue.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';
import { execSync } from 'child_process';
import { StepStrategy, automatableStrategies } from '../inventory';
import {
  ParsedLab, ParsedStep, CodeBlock, RunContext, RunReport,
  StepResult, BlockResult, StepStatus,
} from './types';
import { PersistentShell } from './shell';
import { WalkthroughBrowser, extractConsoleUrl } from './browser';
import { applyFileContent, applyPlaceholderSubstitutions, parseTerraformOutput } from './file-apply';

/** Strategies that always require human intervention (no automation path). */
const ALWAYS_MANUAL: StepStrategy[] = ['manual-only'];
/** Strategies that NEED a browser (currently surfaced as manual checkpoints). */
const NEEDS_BROWSER: StepStrategy[] = ['aws-ui', 'external-ui'];

export interface RunnerRuntimeOptions {
  stopOnFail?: boolean;
  stepFilter?: (s: ParsedStep) => boolean;
  /** How to handle aws-ui / external-ui / manual-only steps:
   *   - 'pause': open browser to a hint URL, print instructions, wait for human (default for tty)
   *   - 'auto-skip': mark manual-required and continue (default for non-tty)
   */
  manualMode?: 'pause' | 'auto-skip';
  /** Run browser headless. Default false — humans can see what's happening. */
  headless?: boolean;
  /** Directory to save per-step screenshots. */
  screenshotDir?: string;
}

export class WalkthroughRunner {
  private shell?: PersistentShell;
  private browser?: WalkthroughBrowser;
  private opts: RunnerRuntimeOptions = {};
  /**
   * Lab-wide cache of key→value pairs captured from `terraform output`
   * calls. When a later file-content block writes `state_bucket_name = "..."`,
   * the runner substitutes the cached value so the lab's literal placeholder
   * (e.g. `studentXX-terraform-state-abc123`) becomes the real bucket name.
   */
  private outputCache: Record<string, string> = {};

  constructor(private parsedLab: ParsedLab, private ctx: RunContext) {}

  async run(opts: RunnerRuntimeOptions = {}): Promise<RunReport> {
    this.opts = opts;
    if (!this.opts.manualMode) {
      this.opts.manualMode = process.stdin.isTTY ? 'pause' : 'auto-skip';
    }
    const startedAt = new Date().toISOString();
    const start = Date.now();
    this.shell = new PersistentShell({ cwd: this.ctx.initialCwd, env: this.ctx.env });
    await this.shell.start();

    // Prime outputCache from prior-lab state — labs 2/3/4 reference Lab 1's
    // S3 state bucket via literal placeholders (studentXX-terraform-state-SUFFIX).
    // If STATE_BUCKET_NAME is set in env, use it directly. Otherwise discover by
    // listing buckets matching ${studentId}-terraform-state-*. Lab 1's pre-run
    // cleanup preserves this bucket (see PROTECTED_BUCKET_PATTERNS in walkthrough.ts).
    primeStateBucket(this.outputCache, this.ctx.env as Record<string, string>);

    // Pre-substitute placeholders in workspace .tf / .tfvars files.
    // Lab repos ship with literal `studentXX-terraform-state-SUFFIX` (and
    // similar) in provider blocks and example tfvars. Without this, lab steps
    // that say "edit your file with the actual value" either rely on manual
    // student action or on file-content blocks that the smart-merge can mishandle
    // (e.g. Lab 3 step 6 overwriting providers.tf with just the backend fragment).
    // Substituting in place at workspace setup time matches what a careful student
    // would do manually, and is safe because the substitution patterns are tight.
    preSubstituteWorkspace(
      this.ctx.initialCwd,
      this.outputCache,
      this.ctx.env as Record<string, string>,
    );

    const stepsToRun = this.parsedLab.steps.filter(opts.stepFilter || (() => true));
    const results: StepResult[] = [];
    for (const step of stepsToRun) {
      const result = await this.runStep(step);
      results.push(result);
      if (opts.stopOnFail && result.status === 'fail') break;
    }

    await this.shell.stop();
    if (this.browser) await this.browser.stop();
    const finishedAt = new Date().toISOString();
    const durationMs = Date.now() - start;

    const summary = summarize(results);
    return {
      lab: {
        course: this.ctx.course,
        labNumber: this.ctx.labNumber,
        title: this.parsedLab.title,
        markdownPath: this.parsedLab.sourcePath,
      },
      startedAt,
      finishedAt,
      durationMs,
      context: {
        initialCwd: this.ctx.initialCwd,
        envSummary: envSummary(this.ctx.env),
      },
      steps: results,
      summary,
    };
  }

  private async runStep(step: ParsedStep): Promise<StepResult> {
    const strategy = (this.ctx.stepStrategies[step.stepId] || 'local-cli') as StepStrategy;
    const start = Date.now();
    // Diagnostic — prints to stdout as soon as a step begins so logs make
    // hangs visible. Without this, only manual-checkpoint steps emit any
    // output and a wedge in the middle of an auto-executed step looks
    // identical to "still running".
    console.log(`>> step ${step.stepId} [${strategy}] ${step.title.slice(0, 70)} (${step.blocks.length} blocks)`);

    // Manual-only strategy: print prompt + pause / skip.
    if (ALWAYS_MANUAL.includes(strategy)) {
      return this.handleManualCheckpoint(step, strategy, 'manual-only step — student decides / reviews', start);
    }

    // aws-ui / external-ui — open browser to a hint URL, then manual checkpoint.
    if (NEEDS_BROWSER.includes(strategy)) {
      return this.handleBrowserCheckpoint(step, strategy, start);
    }

    // local-install — defer to shell with a long timeout. Same code path as local-cli.
    // (caller can override per-block timeout in future)

    // local-cli / aws-cli / local-install — execute each block per its classification.
    const blockResults: BlockResult[] = [];
    let lastExecutedOutput = '';
    let failed = false;
    let firstError: string | undefined;

    for (const block of step.blocks) {
      const blockResult = await this.runBlock(block, lastExecutedOutput);
      blockResults.push(blockResult);
      if (blockResult.status === 'ran') {
        lastExecutedOutput = blockResult.stdout;
      }
      if (blockResult.status === 'failed') {
        failed = true;
        firstError = firstError || blockResult.stderr.split('\n')[0] || `exit ${blockResult.exitCode}`;
      }
    }

    // Determine step status. If the inventory marked this step as
    // expectFailure (e.g. workspace guard precondition test), a non-zero
    // exit IS the success signal — flip fail → pass.
    const driftCount = blockResults.filter((b) => b.expectedMatched === false).length;
    const expectsFailure = !!this.ctx.stepExpectFailure?.[step.stepId];
    let status: StepStatus;
    if (failed && expectsFailure) status = 'pass';
    else if (failed) status = 'fail';
    else if (!failed && expectsFailure) {
      // Expected to fail but didn't — that's actually a failure of the test.
      status = 'fail';
      firstError = firstError || 'step was expected to fail (expectFailure: true) but every block succeeded';
    } else if (driftCount > 0) status = 'drift';
    else status = 'pass';

    return {
      step, strategy,
      status,
      blockResults,
      durationMs: Date.now() - start,
      error: firstError,
    };
  }

  private async handleManualCheckpoint(step: ParsedStep, strategy: StepStrategy, reason: string, start: number): Promise<StepResult> {
    const decision = await this.promptManual(step, strategy, reason);
    return {
      step, strategy,
      status: decision,
      blockResults: step.blocks.map((b) => ({
        block: b, status: 'skipped' as const,
        stdout: '', stderr: '', exitCode: 0, durationMs: 0,
      })),
      durationMs: Date.now() - start,
    };
  }

  private async handleBrowserCheckpoint(step: ParsedStep, strategy: StepStrategy, start: number): Promise<StepResult> {
    // Lazy-launch browser.
    if (!this.browser) {
      this.browser = new WalkthroughBrowser();
      try {
        await this.browser.start({ headless: this.opts.headless });
      } catch (e: any) {
        return {
          step, strategy,
          status: 'manual-required',
          blockResults: [],
          durationMs: Date.now() - start,
          error: `browser launch failed: ${e.message}`,
        };
      }
    }
    const page = this.browser.getPage()!;
    const url = extractConsoleUrl(
      `${step.title} ${step.taskTitle || ''}`,
      step.blocks.map((b) => ({ content: b.content, precedingText: b.precedingText })),
      this.ctx.env.AWS_REGION || this.ctx.env.TERRAFORM_REGION || 'us-east-1',
    );

    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    } catch (e: any) {
      console.log(`  (couldn't navigate to ${url}: ${e.message?.split('\n')[0]})`);
    }

    // Screenshot.
    let screenshotPath: string | undefined;
    if (this.opts.screenshotDir) {
      screenshotPath = path.join(this.opts.screenshotDir, `step-${step.stepId}.png`);
      try { await this.browser.screenshot(screenshotPath); } catch { /* ignore */ }
    }

    const decision = await this.promptManual(step, strategy, `browser open at: ${url}`);
    return {
      step, strategy,
      status: decision,
      blockResults: step.blocks.map((b) => ({
        block: b, status: 'skipped' as const,
        stdout: '', stderr: '', exitCode: 0, durationMs: 0,
        notes: [`screenshot: ${screenshotPath || '(none)'}`],
      })),
      durationMs: Date.now() - start,
    };
  }

  private async promptManual(step: ParsedStep, strategy: StepStrategy, reason: string): Promise<StepStatus> {
    console.log(`\n══ MANUAL CHECKPOINT — Step ${step.stepId} [${strategy}] ══`);
    if (step.taskTitle) console.log(`  ${step.taskTitle}`);
    console.log(`  ${step.title}`);
    console.log(`  ${reason}`);
    // Print prose from each block so the human knows what to do.
    for (const b of step.blocks) {
      if (b.precedingText) {
        const lines = b.precedingText.split('\n').filter(Boolean).slice(0, 4);
        for (const l of lines) console.log(`    ${l.slice(0, 100)}`);
      }
    }

    if (this.opts.manualMode === 'auto-skip') {
      console.log(`  (auto-skip mode — marking manual-required)`);
      return 'manual-required';
    }

    return new Promise<StepStatus>((resolve) => {
      const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
      rl.question(`  [Enter] pass · [s] skip · [f] fail · [q] quit run: `, (ans) => {
        rl.close();
        const a = (ans || '').trim().toLowerCase();
        if (a === 'q') {
          console.log('  Quitting walkthrough run.');
          process.exit(0);
        }
        if (a === 'f') return resolve('fail');
        if (a === 's') return resolve('skip');
        return resolve('pass');
      });
    });
  }

  private async runBlock(block: CodeBlock, priorStdout: string): Promise<BlockResult> {
    const start = Date.now();

    if (block.classification === 'reference-only') {
      return {
        block, status: 'skipped',
        stdout: '', stderr: '', exitCode: 0,
        durationMs: Date.now() - start,
        notes: ['reference-only code block (documentation)'],
      };
    }

    if (block.classification === 'expected-output') {
      const expected = block.content.trim();
      const matched = compareOutput(expected, priorStdout);
      return {
        block, status: 'compared',
        stdout: '', stderr: '', exitCode: 0,
        durationMs: Date.now() - start,
        expectedMatched: matched,
        notes: matched ? ['output matched lab expectation'] : [
          'output DRIFT — lab predicts:\n' + expected.split('\n').slice(0, 6).join('\n'),
          'actual (last command):\n' + priorStdout.split('\n').slice(0, 6).join('\n'),
        ],
      };
    }

    if (block.classification === 'file-content') {
      const cwd = this.shell!.getCwd();
      const targetAbs = path.isAbsolute(block.targetPath!) ? block.targetPath! : path.join(cwd, block.targetPath!);
      fs.mkdirSync(path.dirname(targetAbs), { recursive: true });
      const result = applyFileContent(targetAbs, block.content, {
        substitutions: this.outputCache,
        env: this.ctx.env as Record<string, string>,
      });
      return {
        block, status: 'wrote',
        stdout: '', stderr: '', exitCode: 0,
        durationMs: Date.now() - start,
        filePath: targetAbs,
        notes: [`strategy: ${result.strategy}; ${result.changes.join(', ')}`],
      };
    }

    // execute. Inject -auto-approve / -force-copy first, then resolve any
    // angle-bracket placeholders (<paste-X-output-here>, <your-bucket-name>,
    // ...) from the output cache + env. The same substitution we already
    // run on file-content blocks — bash blocks reference the same
    // placeholders, so leaving them raw produces invalid commands like
    // `aws s3 ls s3://your-bucket-name/`.
    let command = autoApproveTerraform(block.content);
    command = applyPlaceholderSubstitutions(
      command,
      this.outputCache,
      this.ctx.env as Record<string, string>,
    );
    // If the block clones the canonical lab repo and we have a local copy
    // (LAB_REPO_ROOT), replace the clone with a `cp -r` of that local copy.
    // The local copy carries the framework-side patches (validation regex,
    // userXX naming, missing cd commands) that we haven't pushed upstream.
    command = redirectLabRepoCloneToLocal(command, this.ctx.env as Record<string, string>);
    const r = await this.shell!.run(command);
    const status = r.exitCode === 0 ? 'ran' : 'failed';

    // Capture `terraform output` values into the cache so later file-content
    // blocks can substitute placeholders (e.g. studentXX-terraform-state-abc123
    // → the real bucket name from this step's output).
    if (status === 'ran' && /\bterraform\s+output\b/.test(block.content)) {
      const outputs = parseTerraformOutput(r.stdout);
      Object.assign(this.outputCache, outputs);
    }
    // Also capture single-output forms where the command names exactly one
    // output and stdout IS the (possibly quoted) value:
    //   terraform output -raw NAME    → unquoted value
    //   terraform output NAME         → quoted string value like "abc"
    //
    // IMPORTANT: Only consider matches that appear as a top-level command in
    // the block (start of a non-comment line). Otherwise an embedded use like
    //   aws s3 ls "s3://$(terraform output -raw state_bucket_name)/" ...
    // would steal the block's stdout (the `aws s3 ls` output) and cache it
    // under `state_bucket_name`, poisoning later substitutions.
    if (status === 'ran') {
      const topLevelTerraformOutputCmds: Array<{ name: string; raw: boolean }> = [];
      for (const rawLine of block.content.split('\n')) {
        const line = rawLine.trim();
        if (!line || line.startsWith('#')) continue;
        const raw = line.match(/^terraform\s+output\s+-raw\s+([a-z_][a-z0-9_]*)\s*$/i);
        if (raw) { topLevelTerraformOutputCmds.push({ name: raw[1], raw: true }); continue; }
        const positional = line.match(/^terraform\s+output\s+([a-z_][a-z0-9_]*)\s*$/i);
        if (positional) topLevelTerraformOutputCmds.push({ name: positional[1], raw: false });
      }
      // Only safe to cache when the block contains exactly one of these and
      // nothing else of consequence — otherwise stdout isn't just the value.
      const meaningfulLines = block.content.split('\n').filter((l) => l.trim() && !l.trim().startsWith('#'));
      if (topLevelTerraformOutputCmds.length === 1 && meaningfulLines.length === 1) {
        const { name, raw } = topLevelTerraformOutputCmds[0];
        let value = r.stdout.trim();
        if (!raw && value.startsWith('"') && value.endsWith('"')) {
          value = value.slice(1, -1);
        }
        if (value && !value.includes('\n') && value.length < 200) {
          this.outputCache[name] = value;
        }
      }
    }

    return {
      block, status,
      stdout: r.stdout,
      stderr: r.stderr,
      exitCode: r.exitCode,
      durationMs: r.durationMs,
      notes: r.timedOut ? ['command timed out'] : undefined,
    };
  }
}

/**
 * If LAB_REPO_ROOT is set in the run env AND the block clones the canonical
 * lab repo (Advanced_Terraform), rewrite the clone to a local copy of
 * LAB_REPO_ROOT. Lets us iterate on lab patches without round-tripping
 * through a git push to the upstream lab repo.
 *
 * Idempotent: if LAB_REPO_ROOT isn't set or the block doesn't contain a
 * matching clone, returns the input unchanged.
 */
/**
 * Populate outputCache.state_bucket_name so labs 2/3/4 can resolve cross-lab
 * references to Lab 1's S3 state bucket.
 *
 * Resolution order:
 *   1. env.STATE_BUCKET_NAME (explicit override; for CI / local runs)
 *   2. aws s3api list-buckets with prefix `${studentId}-terraform-state-`
 *      (Lab 1's preserved bucket — see PROTECTED_BUCKET_PATTERNS in walkthrough.ts)
 *   3. Leave unset; the lab will fail loudly with a clear error.
 *
 * Errors are swallowed — discovery is best-effort and the lab can still set
 * its own state_bucket_name via the in-lab terraform output capture.
 */
export function primeStateBucket(
  outputCache: Record<string, string>,
  env: Record<string, string>,
): void {
  if (outputCache.state_bucket_name) return;
  const override = env.STATE_BUCKET_NAME;
  if (override) {
    outputCache.state_bucket_name = override;
    console.log(`  · prime state_bucket_name=${override} (from STATE_BUCKET_NAME env)`);
  } else {
    const studentId = env.TERRAFORM_STUDENT_ID || env.STUDENT || env.USER;
    if (!studentId) return;
    try {
      const cmd = `aws s3api list-buckets --query "Buckets[?starts_with(Name, '${studentId}-terraform-state-')].Name" --output text`;
      const found = execSync(cmd, { stdio: ['ignore', 'pipe', 'ignore'], timeout: 10_000 })
        .toString()
        .trim()
        .split(/\s+/)
        .filter(Boolean);
      if (found.length === 1) {
        outputCache.state_bucket_name = found[0];
        console.log(`  · prime state_bucket_name=${found[0]} (discovered)`);
      } else if (found.length > 1) {
        console.log(`  · WARN: multiple state buckets for ${studentId}: ${found.join(', ')} — leaving unset; pass STATE_BUCKET_NAME to disambiguate`);
        return;
      } else {
        return;
      }
    } catch {
      return;
    }
  }

  // Capture the bucket's actual region too. The backend `region` setting names
  // the BUCKET's region, not the deploy region — they're independent. Labs
  // 2/3/4 reference Lab 1's bucket; if Lab 1's bucket is in a different region
  // than the current lab's deploy region, the lab's hardcoded
  // `-backend-config="region=..."` (or backend block) needs the bucket's region.
  try {
    const bucket = outputCache.state_bucket_name;
    const regionOverride = env.STATE_BUCKET_REGION;
    if (regionOverride) {
      outputCache.state_bucket_region = regionOverride;
      console.log(`  · prime state_bucket_region=${regionOverride} (from STATE_BUCKET_REGION env)`);
      return;
    }
    const out = execSync(
      `aws s3api get-bucket-location --bucket "${bucket}" --query LocationConstraint --output text`,
      { stdio: ['ignore', 'pipe', 'ignore'], timeout: 10_000 },
    ).toString().trim();
    // AWS quirk: us-east-1 returns "None" / null / empty for legacy reasons.
    const region = !out || out === 'None' || out === 'null' ? 'us-east-1' : out;
    outputCache.state_bucket_region = region;
    console.log(`  · prime state_bucket_region=${region} (discovered for ${bucket})`);
  } catch {
    /* best-effort */
  }
}

/**
 * Walk the workspace's `.tf` / `.tfvars` files and substitute placeholders in
 * place. Called once at runner startup, after primeStateBucket().
 *
 * Lab repos ship with literal placeholders (`studentXX-terraform-state-SUFFIX`,
 * `account = "userxx"`, etc.) in `providers.tf`, `terraform.tfvars.example`, and
 * sometimes `main.tf`. The lab MD then tells the student to manually edit these.
 * The walkthrough runner can't reliably reproduce manual edits via file-content
 * blocks alone (smart-merge struggles with HCL fragments — see Lab 3 step 6).
 *
 * Pre-substituting on workspace setup is the same change a careful student
 * would make. The patterns we substitute are tight (see applyPlaceholderSubstitutions)
 * so accidental matches in unrelated code are unlikely.
 *
 * Best-effort: failures (missing dirs, unreadable files) are silently skipped.
 */
export function preSubstituteWorkspace(
  workspaceRoot: string,
  outputCache: Record<string, string>,
  env: Record<string, string>,
): void {
  if (!outputCache.state_bucket_name) return;  // nothing useful to substitute
  let editedFiles = 0;
  const walk = (dir: string): void => {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch { return; }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === '.git' || entry.name === 'node_modules' || entry.name === '.terraform') continue;
        walk(full);
      } else if (entry.isFile() && /\.(tf|tfvars|tfvars\.example)$/i.test(entry.name)) {
        try {
          const before = fs.readFileSync(full, 'utf8');
          const after = applyPlaceholderSubstitutions(before, outputCache, env);
          if (after !== before) {
            fs.writeFileSync(full, after);
            editedFiles++;
          }
        } catch { /* skip unreadable */ }
      }
    }
  };
  walk(workspaceRoot);
  if (editedFiles > 0) {
    console.log(`  · pre-substitute: rewrote ${editedFiles} workspace file(s) with primed placeholders`);
  }
}

export function redirectLabRepoCloneToLocal(
  command: string,
  env: Record<string, string>,
): string {
  const repoRoot = env.LAB_REPO_ROOT;
  if (!repoRoot) return command;
  // Match `git clone https://github.com/<org>/Advanced_Terraform.git [target]`
  // optionally with --depth, branch, or other flags. We rewrite to a
  // `rm -rf` + `cp -r` so a re-run from a wiped workspace still works.
  // Match within a single line: use [ \t] instead of \s so the optional dest
  // doesn't swallow the next line's command.
  return command.replace(
    /git[ \t]+clone(?:[ \t]+--[a-z0-9-]+(?:[ \t]+\S+)?)*[ \t]+https:\/\/github\.com\/[^/]+\/Advanced_Terraform(?:\.git)?(?:[ \t]+([^ \t\n]+))?/g,
    (_match, dest) => {
      const target = dest || 'Advanced_Terraform';
      return `rm -rf ${target} && cp -r ${repoRoot} ${target}`;
    },
  );
}

/**
 * Auto-inject `-auto-approve` for `terraform apply` and `terraform destroy`,
 * and `-force-copy` for `terraform init -migrate-state`. Lab markdown writes
 * the bare command because a human types `yes` at the prompt; the walkthrough
 * has no human, so an unflagged apply hangs at "Enter a value:" until the
 * shell timeout fires (10 min). Skip lines already carrying the flag and
 * skip lines inside heredocs / comment-only lines.
 */
export function autoApproveTerraform(command: string): string {
  return command
    .split('\n')
    .map((line) => {
      const stripped = line.replace(/^\s*#.*$/, '');
      if (!stripped) return line;
      // terraform apply / destroy — add -auto-approve if not already present.
      if (/^\s*terraform\s+(apply|destroy)(\s|$)/.test(line) && !/-auto-approve\b/.test(line)) {
        return line.replace(/(terraform\s+(?:apply|destroy))/, '$1 -auto-approve');
      }
      // terraform init -migrate-state — add -force-copy to skip "yes" prompt.
      if (/^\s*terraform\s+init\b/.test(line) && /-migrate-state\b/.test(line) && !/-force-copy\b/.test(line)) {
        return line.replace(/-migrate-state\b/, '-migrate-state -force-copy');
      }
      return line;
    })
    .join('\n');
}

/**
 * Heuristic compare for "Expected: ..." blocks. The actual lab output rarely
 * matches verbatim (timestamps, random IDs), so we look for the first content
 * line of `expected` somewhere inside `actual`. If `expected` contains a
 * placeholder like `<...>` or `xxxxx`, we mask it as ".*".
 */
export function compareOutput(expected: string, actual: string): boolean {
  const e = expected.trim();
  if (!e) return true;
  // Take the first ≤3 distinctive lines from expected — skip blank lines.
  const lines = e.split('\n').map((l) => l.trim()).filter(Boolean).slice(0, 3);
  for (const line of lines) {
    // Mask placeholders so "vpc-xxxxxx" matches "vpc-0abcdef123".
    // Threshold of 2+ x's catches "userxx" / "XX" placeholders too — legitimate
    // strings rarely have 2 consecutive x's outside placeholder conventions.
    const escaped = line
      .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      .replace(/<[^>]+>/g, '.*')
      .replace(/x{2,}/gi, '.*');
    if (!new RegExp(escaped).test(actual)) return false;
  }
  return true;
}

function summarize(results: StepResult[]): RunReport['summary'] {
  const s = { total: results.length, pass: 0, fail: 0, manualRequired: 0, drift: 0, skip: 0 };
  for (const r of results) {
    if (r.status === 'pass') s.pass++;
    else if (r.status === 'fail') s.fail++;
    else if (r.status === 'manual-required') s.manualRequired++;
    else if (r.status === 'drift') s.drift++;
    else if (r.status === 'skip') s.skip++;
  }
  return s;
}

function envSummary(env: Record<string, string>): Record<string, string> {
  // Keep only the lab-relevant vars in the report, redacting access keys.
  const keep = ['STUDENT', 'USER', 'TERRAFORM_STUDENT_ID', 'AWS_PROFILE', 'AWS_REGION', 'TERRAFORM_REGION'];
  const out: Record<string, string> = {};
  for (const k of keep) {
    if (env[k]) out[k] = env[k];
  }
  return out;
}

export { automatableStrategies };
