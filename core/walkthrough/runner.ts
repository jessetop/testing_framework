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
import { StepStrategy, automatableStrategies } from '../inventory';
import {
  ParsedLab, ParsedStep, CodeBlock, RunContext, RunReport,
  StepResult, BlockResult, StepStatus,
} from './types';
import { PersistentShell } from './shell';
import { WalkthroughBrowser, extractConsoleUrl } from './browser';
import { applyFileContent, parseTerraformOutput } from './file-apply';

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

    // Determine step status.
    const driftCount = blockResults.filter((b) => b.expectedMatched === false).length;
    let status: StepStatus;
    if (failed) status = 'fail';
    else if (driftCount > 0) status = 'drift';
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
      const result = applyFileContent(targetAbs, block.content, { substitutions: this.outputCache });
      return {
        block, status: 'wrote',
        stdout: '', stderr: '', exitCode: 0,
        durationMs: Date.now() - start,
        filePath: targetAbs,
        notes: [`strategy: ${result.strategy}; ${result.changes.join(', ')}`],
      };
    }

    // execute
    const r = await this.shell!.run(block.content);
    const status = r.exitCode === 0 ? 'ran' : 'failed';

    // Capture `terraform output` values into the cache so later file-content
    // blocks can substitute placeholders (e.g. studentXX-terraform-state-abc123
    // → the real bucket name from this step's output).
    if (status === 'ran' && /\bterraform\s+output\b/.test(block.content)) {
      const outputs = parseTerraformOutput(r.stdout);
      Object.assign(this.outputCache, outputs);
    }
    // Also capture `terraform output -raw <name>` where stdout is just the
    // value. Grep the command for `-raw <name>`.
    if (status === 'ran') {
      const rawMatches = [...block.content.matchAll(/terraform\s+output\s+-raw\s+([a-z_][a-z0-9_]*)/gi)];
      if (rawMatches.length === 1) {
        const name = rawMatches[0][1];
        const value = r.stdout.trim();
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
    const escaped = line
      .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      .replace(/<[^>]+>/g, '.*')
      .replace(/x{3,}/gi, '.*');
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
