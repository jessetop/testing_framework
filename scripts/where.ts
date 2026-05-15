#!/usr/bin/env npx ts-node

/**
 * `where` — Lab build-status reporter.
 *
 * Reads lab-progress/<course>/lab<N>.status.md files, verifies referenced
 * paths still exist, hashes the lab markdown to detect content drift, and
 * reports Phase A (pre-test) and Phase B (testing) progress with the next
 * action to take.
 *
 * Usage:
 *   npm run where                       # all labs, all courses
 *   npm run where -- terraform          # all labs in terraform
 *   npm run where -- terraform 1        # one lab, detail view
 *   npm run where -- terraform 1 --accept  # capture current lab hash as the new baseline
 *   npm run where -- --accept-all       # capture hashes for every lab (use after intentional updates)
 */

import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

const PROGRESS_DIR = path.join(__dirname, '..', 'lab-progress');
const FRAMEWORK_ROOT = path.join(__dirname, '..');

interface LabStatus {
  file: string;
  course: string;
  labNumber: number;
  labName: string;
  labInstructionsPath: string;
  labInstructionsHash: string;        // empty = never captured
  labInstructionsHashedAt: string;    // ISO date of last capture
  labStarterPaths: string[];
  testConfigPath: string;
  testSpecPath: string;
  registeredInRegistry: boolean;
  lastUpdated: string;
  phaseA: ChecklistItem[];
  phaseB: ChecklistItem[];
  notes: string;
}

type DriftState = 'matches' | 'drift' | 'unhashed' | 'missing-file';

interface DriftCheck {
  state: DriftState;
  storedHash: string;
  currentHash: string;
  hashedAt: string;
}

interface ChecklistItem {
  text: string;
  checked: boolean;
}

interface PathCheck {
  label: string;
  pathValue: string;
  resolved: string;
  exists: boolean;
  /** Upstream refs (lab markdown, starter code) MUST exist. Downstream
   *  artifacts (test config/spec) are only "broken" once Phase A says
   *  they've been created. */
  expectedToExist: boolean;
}

function parseStatusFile(filePath: string): LabStatus {
  const raw = fs.readFileSync(filePath, 'utf8');
  const fmMatch = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!fmMatch) {
    throw new Error(`No frontmatter found in ${filePath}`);
  }
  const frontmatter = fmMatch[1];
  const body = fmMatch[2];

  const fields: Record<string, string> = {};
  for (const line of frontmatter.split('\n')) {
    const m = line.match(/^([a-z_]+):\s*(.*)$/);
    if (m) fields[m[1]] = m[2].trim();
  }

  const splitList = (val: string): string[] =>
    val ? val.split(',').map((s) => s.trim()).filter(Boolean) : [];

  const phaseA = extractChecklist(body, 'Phase A');
  const phaseB = extractChecklist(body, 'Phase B');
  const notesMatch = body.match(/## Notes \/ blockers\n+([\s\S]*?)$/);
  const notes = notesMatch ? notesMatch[1].trim() : '';

  return {
    file: filePath,
    course: fields.course || '',
    labInstructionsHash: fields.lab_instructions_hash || '',
    labInstructionsHashedAt: fields.lab_instructions_hashed_at || '',
    labNumber: parseInt(fields.lab_number || '0', 10),
    labName: fields.lab_name || '',
    labInstructionsPath: fields.lab_instructions_path || '',
    labStarterPaths: splitList(fields.lab_starter_paths || ''),
    testConfigPath: fields.test_config_path || '',
    testSpecPath: fields.test_spec_path || '',
    registeredInRegistry: (fields.registered_in_registry || '').toLowerCase() === 'true',
    lastUpdated: fields.last_updated || '',
    phaseA,
    phaseB,
    notes,
  };
}

function extractChecklist(body: string, phaseHeading: string): ChecklistItem[] {
  const re = new RegExp(`## ${phaseHeading}[^\\n]*\\n+([\\s\\S]*?)(?=\\n## |$)`);
  const m = body.match(re);
  if (!m) return [];
  const items: ChecklistItem[] = [];
  for (const line of m[1].split('\n')) {
    const item = line.match(/^- \[([ xX])\]\s+(.*)$/);
    if (item) {
      items.push({ checked: item[1].toLowerCase() === 'x', text: item[2].trim() });
    }
  }
  return items;
}

function resolveLabPath(p: string): string {
  if (!p) return '';
  if (path.isAbsolute(p)) return p;
  return path.resolve(FRAMEWORK_ROOT, p);
}

function isPhaseAItemChecked(status: LabStatus, needle: string): boolean {
  return status.phaseA.some((i) => i.checked && i.text.toLowerCase().includes(needle));
}

function checkPaths(status: LabStatus): PathCheck[] {
  const checks: PathCheck[] = [];

  if (status.labInstructionsPath) {
    const resolved = resolveLabPath(status.labInstructionsPath);
    checks.push({
      label: 'Lab instructions',
      pathValue: status.labInstructionsPath,
      resolved,
      exists: fs.existsSync(resolved),
      expectedToExist: true,
    });
  }
  for (const sp of status.labStarterPaths) {
    const resolved = resolveLabPath(sp);
    checks.push({
      label: 'Starter code',
      pathValue: sp,
      resolved,
      exists: fs.existsSync(resolved),
      expectedToExist: true,
    });
  }
  if (status.testConfigPath) {
    const resolved = resolveLabPath(status.testConfigPath);
    checks.push({
      label: 'Test config',
      pathValue: status.testConfigPath,
      resolved,
      exists: fs.existsSync(resolved),
      expectedToExist: isPhaseAItemChecked(status, 'config.ts` created'),
    });
  }
  if (status.testSpecPath) {
    const resolved = resolveLabPath(status.testSpecPath);
    checks.push({
      label: 'Test spec',
      pathValue: status.testSpecPath,
      resolved,
      exists: fs.existsSync(resolved),
      expectedToExist: isPhaseAItemChecked(status, 'skeleton created'),
    });
  }
  return checks;
}

function brokenCount(checks: PathCheck[]): number {
  return checks.filter((c) => c.expectedToExist && !c.exists).length;
}

function hashFile(absPath: string): string {
  const content = fs.readFileSync(absPath);
  return crypto.createHash('sha256').update(content).digest('hex');
}

function checkDrift(status: LabStatus): DriftCheck {
  const resolved = resolveLabPath(status.labInstructionsPath);
  if (!resolved || !fs.existsSync(resolved)) {
    return {
      state: 'missing-file',
      storedHash: status.labInstructionsHash,
      currentHash: '',
      hashedAt: status.labInstructionsHashedAt,
    };
  }
  const currentHash = hashFile(resolved);
  if (!status.labInstructionsHash) {
    return { state: 'unhashed', storedHash: '', currentHash, hashedAt: '' };
  }
  return {
    state: status.labInstructionsHash === currentHash ? 'matches' : 'drift',
    storedHash: status.labInstructionsHash,
    currentHash,
    hashedAt: status.labInstructionsHashedAt,
  };
}

/** Write back the status file with updated lab_instructions_hash + hashed_at. */
function writeAcceptedHash(status: LabStatus, newHash: string): void {
  const raw = fs.readFileSync(status.file, 'utf8');
  const today = new Date().toISOString().slice(0, 10);

  const upsert = (text: string, key: string, value: string): string => {
    const re = new RegExp(`^${key}:.*$`, 'm');
    if (re.test(text)) return text.replace(re, `${key}: ${value}`);
    // Insert before the closing `---` of the frontmatter.
    return text.replace(/^---\n([\s\S]*?)\n---/, (_full, fm) => `---\n${fm}\n${key}: ${value}\n---`);
  };

  let next = upsert(raw, 'lab_instructions_hash', newHash);
  next = upsert(next, 'lab_instructions_hashed_at', today);
  next = upsert(next, 'last_updated', today);
  fs.writeFileSync(status.file, next);
}

function shortHash(h: string): string {
  return h ? h.slice(0, 12) : '—';
}

function summarizePhase(items: ChecklistItem[]): { done: number; total: number; nextItem?: string } {
  const done = items.filter((i) => i.checked).length;
  const next = items.find((i) => !i.checked);
  return { done, total: items.length, nextItem: next?.text };
}

function findAllStatusFiles(): string[] {
  if (!fs.existsSync(PROGRESS_DIR)) return [];
  const out: string[] = [];
  for (const course of fs.readdirSync(PROGRESS_DIR)) {
    const cdir = path.join(PROGRESS_DIR, course);
    if (!fs.statSync(cdir).isDirectory()) continue;
    for (const f of fs.readdirSync(cdir)) {
      if (f.endsWith('.status.md')) out.push(path.join(cdir, f));
    }
  }
  return out;
}

function findStatusFiles(course?: string, labNumber?: number): string[] {
  return findAllStatusFiles().filter((f) => {
    if (course && !f.includes(path.sep + course + path.sep)) return false;
    if (labNumber !== undefined) {
      const m = path.basename(f).match(/^lab(\d+)\.status\.md$/);
      if (!m || parseInt(m[1], 10) !== labNumber) return false;
    }
    return true;
  });
}

function printSummaryLine(status: LabStatus, brokenPaths: number, drift: DriftCheck): void {
  const a = summarizePhase(status.phaseA);
  const b = summarizePhase(status.phaseB);
  const aBar = `[${'#'.repeat(a.done)}${'.'.repeat(a.total - a.done)}]`;
  const bBar = `[${'#'.repeat(b.done)}${'.'.repeat(b.total - b.done)}]`;
  const flags: string[] = [];
  if (brokenPaths > 0) flags.push(`⚠ ${brokenPaths} broken path${brokenPaths > 1 ? 's' : ''}`);
  if (drift.state === 'drift') flags.push('⚠ LAB CONTENT DRIFT');
  if (drift.state === 'unhashed') flags.push('· unhashed');
  console.log(
    `  ${status.course.padEnd(10)} lab ${status.labNumber}  ` +
    `A ${aBar} ${a.done}/${a.total}   ` +
    `B ${bBar} ${b.done}/${b.total}   ` +
    `${status.labName}${flags.length ? '  ' + flags.join('  ') : ''}`
  );
}

function printDetail(status: LabStatus): void {
  console.log('');
  console.log(`╔══════════════════════════════════════════════════════════════════════╗`);
  console.log(`║  ${status.course.toUpperCase()} — Lab ${status.labNumber}: ${status.labName}`);
  console.log(`╚══════════════════════════════════════════════════════════════════════╝`);
  console.log(`Status file:  ${path.relative(FRAMEWORK_ROOT, status.file)}`);
  console.log(`Last updated: ${status.lastUpdated}`);
  console.log('');

  console.log('Referenced paths:');
  const checks = checkPaths(status);
  for (const c of checks) {
    const mark = c.exists ? '✓' : c.expectedToExist ? '✗' : '·';
    const suffix = !c.exists && !c.expectedToExist ? '  (not yet created)' : '';
    console.log(`  ${mark} ${c.label.padEnd(18)} ${c.pathValue}${suffix}`);
  }
  const broken = brokenCount(checks);
  if (broken > 0) {
    console.log('');
    console.log(`  ⚠ ${broken} broken reference(s). Update the status file frontmatter`);
    console.log(`    to point at the new location, then re-run \`npm run where\`.`);
  }

  console.log('');
  console.log('Lab content version:');
  const drift = checkDrift(status);
  if (drift.state === 'matches') {
    console.log(`  ✓ matches stored hash (${shortHash(drift.storedHash)}, captured ${drift.hashedAt})`);
  } else if (drift.state === 'unhashed') {
    console.log(`  · unhashed — current SHA-256: ${shortHash(drift.currentHash)}`);
    console.log(`    Capture as baseline: npm run where -- ${status.course} ${status.labNumber} --accept`);
  } else if (drift.state === 'drift') {
    console.log(`  ⚠ DRIFT DETECTED`);
    console.log(`    Stored:  ${shortHash(drift.storedHash)} (captured ${drift.hashedAt})`);
    console.log(`    Current: ${shortHash(drift.currentHash)}`);
    console.log(`    The lab markdown has changed since this test was scaffolded.`);
    console.log(`    Review the diff, update the test, then accept:`);
    console.log(`      npm run where -- ${status.course} ${status.labNumber} --accept`);
  } else if (drift.state === 'missing-file') {
    console.log(`  ✗ lab markdown file not found — can't compute hash`);
  }

  console.log('');
  console.log('Phase A — Pre-test (scaffolding)');
  for (const item of status.phaseA) {
    console.log(`  [${item.checked ? 'x' : ' '}] ${item.text}`);
  }

  console.log('');
  console.log('Phase B — Testing');
  for (const item of status.phaseB) {
    console.log(`  [${item.checked ? 'x' : ' '}] ${item.text}`);
  }

  if (status.notes && status.notes !== '(empty)') {
    console.log('');
    console.log('Notes / blockers:');
    for (const line of status.notes.split('\n')) console.log(`  ${line}`);
  }

  const a = summarizePhase(status.phaseA);
  const b = summarizePhase(status.phaseB);
  console.log('');
  if (a.nextItem) {
    console.log(`Next (Phase A): ${a.nextItem}`);
  } else if (b.nextItem) {
    console.log(`Next (Phase B): ${b.nextItem}`);
  } else {
    console.log(`✅ All checklist items complete.`);
  }
  console.log('');
}

function acceptHash(status: LabStatus): void {
  const drift = checkDrift(status);
  if (drift.state === 'missing-file') {
    console.log(`✗ ${status.course} lab ${status.labNumber}: cannot accept — lab markdown not found at ${status.labInstructionsPath}`);
    return;
  }
  if (drift.state === 'matches') {
    console.log(`· ${status.course} lab ${status.labNumber}: already matches stored hash, nothing to update`);
    return;
  }
  writeAcceptedHash(status, drift.currentHash);
  const what = drift.state === 'unhashed' ? 'captured initial' : 'updated';
  console.log(`✓ ${status.course} lab ${status.labNumber}: ${what} hash → ${shortHash(drift.currentHash)}`);
}

function main(): void {
  const rawArgs = process.argv.slice(2);
  const flags = new Set(rawArgs.filter((a) => a.startsWith('--')));
  const positional = rawArgs.filter((a) => !a.startsWith('--'));
  const course = positional[0];
  const labNumberArg = positional[1];
  const labNumber = labNumberArg ? parseInt(labNumberArg, 10) : undefined;
  const accept = flags.has('--accept');
  const acceptAll = flags.has('--accept-all');

  if (acceptAll) {
    const all = findAllStatusFiles().map(parseStatusFile);
    console.log('');
    for (const s of all) acceptHash(s);
    console.log('');
    return;
  }

  const files = findStatusFiles(course, labNumber);

  if (files.length === 0) {
    if (course || labNumber !== undefined) {
      console.log(`\nNo status file found for ${course || ''}${labNumber !== undefined ? ' lab ' + labNumber : ''}.`);
      console.log(`Copy lab-progress/_template.status.md to lab-progress/<course>/lab<N>.status.md to start tracking a new lab.\n`);
    } else {
      console.log(`\nNo lab-progress files found in ${PROGRESS_DIR}.\n`);
    }
    return;
  }

  if (accept) {
    console.log('');
    for (const f of files) acceptHash(parseStatusFile(f));
    console.log('');
    return;
  }

  if (files.length === 1) {
    printDetail(parseStatusFile(files[0]));
    return;
  }

  console.log('');
  console.log('Lab build status:');
  console.log('');
  const statuses = files.map(parseStatusFile);
  statuses.sort((a, b) =>
    a.course === b.course ? a.labNumber - b.labNumber : a.course.localeCompare(b.course)
  );
  for (const s of statuses) {
    printSummaryLine(s, brokenCount(checkPaths(s)), checkDrift(s));
  }
  console.log('');
  console.log(`Drill in with: npm run where -- <course> <lab-number>`);
  console.log('');
}

if (require.main === module) {
  main();
}
