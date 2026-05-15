#!/usr/bin/env npx ts-node

/**
 * `walkthrough` — run a lab by literally walking its markdown.
 *
 * Usage:
 *   npm run walkthrough -- terraform 1
 *   npm run walkthrough -- terraform 1 --steps 1-10
 *   npm run walkthrough -- terraform 1 --parse-only       (dump parsed steps, don't run)
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { parseLab, WalkthroughRunner, RunReport, runStaticChecks, Finding, summarizeFindings } from '../core/walkthrough';
import { LabInventory } from '../core/inventory';

interface Args {
  course: string;
  labNumber: number;
  parseOnly: boolean;
  checkOnly: boolean;
  skipChecks: boolean;
  pause: boolean;
  autoSkip: boolean;
  headless: boolean;
  stepFilter?: { start: number; end: number };
}

function parseArgs(argv: string[]): Args {
  if (argv.length < 2) {
    console.log('Usage: npm run walkthrough -- <course> <lab-number> [options]');
    console.log('  --parse-only      print the parsed step list and exit');
    console.log('  --check-only      run static checks (placeholder / snippet / required-vars) and exit');
    console.log('  --skip-checks     skip the pre-flight static checks');
    console.log('  --steps N-M       run only a subset of steps');
    console.log('  --pause           pause for human input at aws-ui / manual-only steps (default if TTY)');
    console.log('  --auto-skip       mark aws-ui / manual-only steps as manual-required and continue');
    console.log('  --headless        launch browser headless (no visible window for aws-ui steps)');
    process.exit(1);
  }
  const args: Args = {
    course: argv[0], labNumber: parseInt(argv[1], 10),
    parseOnly: false, checkOnly: false, skipChecks: false,
    pause: false, autoSkip: false, headless: false,
  };
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--parse-only') args.parseOnly = true;
    if (argv[i] === '--check-only') args.checkOnly = true;
    if (argv[i] === '--skip-checks') args.skipChecks = true;
    if (argv[i] === '--pause') args.pause = true;
    if (argv[i] === '--auto-skip') args.autoSkip = true;
    if (argv[i] === '--headless') args.headless = true;
    if (argv[i] === '--steps' && argv[i + 1]) {
      const [s, e] = argv[i + 1].split('-').map(Number);
      args.stepFilter = { start: s, end: e || s };
      i++;
    }
  }
  return args;
}

/** Clone or refresh the lab repo to a stable cache so static checks have something to diff against. */
function ensureRepoClone(repoUrl: string, course: string, labNumber: number): string {
  const cacheRoot = path.resolve(__dirname, '..', '_workspace', 'repos');
  const leaf = path.basename(repoUrl).replace(/\.git$/, '');
  const target = path.join(cacheRoot, leaf);
  fs.mkdirSync(cacheRoot, { recursive: true });
  if (fs.existsSync(target)) {
    try {
      execSync('git fetch origin && git reset --hard origin/main', { cwd: target, stdio: 'pipe' });
    } catch { /* offline / no auth — keep existing */ }
  } else {
    execSync(`git clone --depth 1 "${repoUrl}" "${target}"`, { stdio: 'pipe' });
  }
  return target;
}

function printFindings(findings: Finding[]): void {
  const s = summarizeFindings(findings);
  console.log('\n── Static checks ─────────────────────────────────────────────────────');
  for (const f of findings) {
    const icon = f.severity === 'blocker' ? '✗' : f.severity === 'warning' ? '⚠' : '·';
    const stepTag = f.stepId ? `step ${f.stepId}` : (f.location || '—');
    console.log(`  ${icon} [${f.check}] ${stepTag}`);
    for (const line of f.message.split('\n')) console.log(`      ${line}`);
    if (f.detail) for (const line of f.detail.split('\n')) console.log(`      ${line}`);
  }
  console.log('──────────────────────────────────────────────────────────────────────');
  console.log(`  ${s.blocker} blocker · ${s.warning} warning · ${s.info} info`);
  console.log('──────────────────────────────────────────────────────────────────────\n');
}

function loadInventory(course: string, labNumber: number): LabInventory {
  const file = path.join(__dirname, '..', 'courses', course, `lab${labNumber}.inventory.ts`);
  if (!fs.existsSync(file)) {
    throw new Error(`No inventory file at ${file}`);
  }
  const mod = require(file);
  return mod.inventory || mod.default;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const inventory = loadInventory(args.course, args.labNumber);
  const parsed = parseLab(inventory.sourcePath);

  console.log(`\nLab: ${parsed.title}`);
  console.log(`Source: ${inventory.sourcePath}`);
  console.log(`Parsed ${parsed.steps.length} steps with ${parsed.steps.reduce((n, s) => n + s.blocks.length, 0)} code blocks`);

  if (args.parseOnly) {
    for (const s of parsed.steps) {
      const summary = s.blocks.map((b) => `${b.classification}/${b.lang}`).join(', ');
      console.log(`  Step ${s.stepId.padEnd(3)}: ${s.title.slice(0, 60)}  [${summary || 'no blocks'}]`);
    }
    return;
  }

  // Static pre-flight checks.
  let staticFindings: Finding[] = [];
  if (!args.skipChecks || args.checkOnly) {
    const repoUrl = inventory.externalResources?.find((r) => r.kind === 'git-repo')?.url;
    let repoRoot: string | undefined;
    if (repoUrl) {
      try { repoRoot = ensureRepoClone(repoUrl, args.course, args.labNumber); }
      catch (e) { console.log(`(could not clone ${repoUrl}; skipping repo-diff checks)`); }
    }
    staticFindings = runStaticChecks(parsed, { repoRoot });
    printFindings(staticFindings);
  }

  if (args.checkOnly) {
    saveCheckReport(staticFindings, args.course, args.labNumber);
    const sum = summarizeFindings(staticFindings);
    process.exit(sum.blocker > 0 ? 1 : 0);
  }

  const blockerCount = staticFindings.filter((f) => f.severity === 'blocker').length;
  if (blockerCount > 0 && !args.skipChecks) {
    console.log(`✗ ${blockerCount} blocker(s) found in static checks. Use --skip-checks to run anyway.`);
    process.exit(1);
  }

  // Build run context.
  const stepStrategies: Record<string, string> = {};
  for (const s of inventory.steps) stepStrategies[s.stepId] = s.strategy;

  const studentId = process.env.TERRAFORM_STUDENT_ID || 'student99';
  const region = process.env.TERRAFORM_REGION || 'us-east-1';
  const awsProfile = process.env.AWS_PROFILE || 'roitraining';

  const workspaceRoot = path.resolve(__dirname, '..', '_workspace', `walkthrough-${args.course}-lab${args.labNumber}`, studentId);
  // Fresh workspace per run — lab Step 1 typically does `cd ~ && git clone`
  // which we want to succeed cleanly each time. The labforge fixes assume
  // a clean starting state.
  if (fs.existsSync(workspaceRoot)) {
    fs.rmSync(workspaceRoot, { recursive: true, force: true });
  }
  fs.mkdirSync(workspaceRoot, { recursive: true });

  const ctx = {
    course: args.course,
    labNumber: args.labNumber,
    markdownPath: inventory.sourcePath,
    initialCwd: workspaceRoot,
    env: {
      // Override HOME so the lab's literal `cd ~` and `~/Advanced_Terraform/...`
      // paths resolve to our isolated workspace, not the host user's home.
      HOME: workspaceRoot,
      // Lab text often references `${USER}` as if it were the IAM username.
      // Set both USER and STUDENT so the lab works whether it uses either,
      // and the run report tells us what we set so we can spot lab content
      // that incorrectly assumed $USER on the actual student VM.
      USER: studentId,
      STUDENT: studentId,
      TERRAFORM_STUDENT_ID: studentId,
      TERRAFORM_REGION: region,
      AWS_PROFILE: awsProfile,
      AWS_REGION: region,
    },
    stepStrategies: stepStrategies as Record<string, any>,
  };

  const runner = new WalkthroughRunner(parsed, ctx);
  const stepFilter = args.stepFilter
    ? (s: any) => {
        const n = parseInt(s.stepId, 10);
        return n >= args.stepFilter!.start && n <= args.stepFilter!.end;
      }
    : undefined;

  const screenshotDir = path.join(__dirname, '..', 'test-results', 'walkthrough', `${args.course}-lab${args.labNumber}-screenshots`);
  console.log(`\nRunning${stepFilter ? ` steps ${args.stepFilter!.start}-${args.stepFilter!.end}` : ''} in ${workspaceRoot}\n`);
  const manualMode = args.autoSkip ? 'auto-skip' : args.pause ? 'pause' : undefined;
  const report = await runner.run({
    stepFilter,
    manualMode,
    headless: args.headless,
    screenshotDir,
  });

  printSummary(report);
  saveReport(report, args.course, args.labNumber);
}

function printSummary(r: RunReport): void {
  console.log('\n══════════════════════════════════════════════════════════════════════');
  console.log(`  ${r.lab.title}`);
  console.log('══════════════════════════════════════════════════════════════════════');
  for (const s of r.steps) {
    const icon = s.status === 'pass' ? '✓'
      : s.status === 'fail' ? '✗'
      : s.status === 'drift' ? '~'
      : s.status === 'manual-required' ? '?'
      : '-';
    const time = `${(s.durationMs / 1000).toFixed(1)}s`.padStart(7);
    console.log(`  ${icon} Step ${s.step.stepId.padEnd(3)} [${s.strategy.padEnd(13)}] ${time}  ${s.step.title.slice(0, 50)}`);
    if (s.status === 'fail' && s.error) {
      console.log(`      ↳ ${s.error}`);
    }
    if (s.status === 'drift') {
      for (const br of s.blockResults) {
        if (br.expectedMatched === false && br.notes) {
          for (const n of br.notes) console.log(`      ↳ ${n.split('\n')[0]}`);
        }
      }
    }
  }
  console.log('──────────────────────────────────────────────────────────────────────');
  const { pass, fail, manualRequired, drift, skip, total } = r.summary;
  console.log(`  ${pass} pass · ${fail} fail · ${drift} drift · ${manualRequired} manual-required · ${skip} skip   (${total} total, ${(r.durationMs / 1000).toFixed(1)}s)`);
  console.log('══════════════════════════════════════════════════════════════════════\n');
}

function saveReport(r: RunReport, course: string, labNumber: number): void {
  const dir = path.join(__dirname, '..', 'test-results', 'walkthrough');
  fs.mkdirSync(dir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const file = path.join(dir, `${course}-lab${labNumber}-${stamp}.json`);
  fs.writeFileSync(file, JSON.stringify(r, null, 2));
  console.log(`Report: ${path.relative(path.join(__dirname, '..'), file)}`);
}

function saveCheckReport(findings: Finding[], course: string, labNumber: number): void {
  const dir = path.join(__dirname, '..', 'test-results', 'walkthrough');
  fs.mkdirSync(dir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const file = path.join(dir, `${course}-lab${labNumber}-checks-${stamp}.json`);
  fs.writeFileSync(file, JSON.stringify({ findings, summary: summarizeFindings(findings) }, null, 2));
  console.log(`Check report: ${path.relative(path.join(__dirname, '..'), file)}`);
}

if (require.main === module) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
