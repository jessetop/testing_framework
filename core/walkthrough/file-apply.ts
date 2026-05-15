/**
 * Apply a markdown file-content block to a real file on disk, simulating
 * what a student does when the lab says "Open `X.tf` and set/edit/paste...".
 *
 * Two strategies depending on block shape:
 *
 *  1. **tfvars smart-merge** — when the block is only `key = value` lines (no
 *     HCL blocks). For each key in the new block, find that key in the
 *     existing file (live OR commented), replace its line. Keys not yet in
 *     the file get appended. Preserves all other tfvars content.
 *
 *  2. **HCL block replace** — when the block contains an HCL top-level block
 *     (terraform/provider/resource/data/module/output/variable). Find the
 *     matching same-prefix block in the existing file and replace it via
 *     brace counting. Other top-level blocks in the file stay intact.
 *
 *  3. **Fallback: overwrite** — file doesn't exist, or we can't detect a
 *     recognizable structure. Write the block as-is.
 */

import * as fs from 'fs';

export interface ApplyResult {
  wrote: string;
  strategy: 'smart-merge' | 'block-replace' | 'overwrite' | 'create';
  changes: string[];
}

export function applyFileContent(
  filePath: string,
  blockContent: string,
  options: { substitutions?: Record<string, string>; env?: Record<string, string> } = {},
): ApplyResult {
  const normalized = blockContent.replace(/\r\n/g, '\n');
  const dedented = dedentBlock(normalized);
  const subs = options.substitutions || {};
  const env = options.env || {};

  // Identity values (student_id, account, region) are not terraform outputs —
  // they come from the run environment. Surface them as key substitutions too
  // so `student_id = "student07"` in a lab block gets rewritten to whatever
  // student we're impersonating.
  const studentId = env.TERRAFORM_STUDENT_ID || env.STUDENT || env.USER;
  const region = env.AWS_REGION || env.TERRAFORM_REGION;
  const identitySubs: Record<string, string> = {};
  if (studentId) {
    identitySubs.student_id = studentId;
    identitySubs.account = studentId;  // labs use account as a `${student_id}` alias
  }
  if (region) identitySubs.region = region;

  const allSubs = { ...identitySubs, ...subs };  // explicit subs win over identity
  let withSubs = applyKeySubstitutions(dedented, allSubs);
  withSubs = applyPlaceholderSubstitutions(withSubs, allSubs, env);

  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, withSubs);
    return { wrote: filePath, strategy: 'create', changes: ['(new file)'] };
  }

  const existing = fs.readFileSync(filePath, 'utf8').replace(/\r\n/g, '\n');

  // Strategy 1: tfvars smart-merge.
  if (isPureKeyValueBlock(withSubs)) {
    const { merged, changes } = mergeKeyValueIntoFile(existing, withSubs);
    fs.writeFileSync(filePath, merged);
    return { wrote: filePath, strategy: 'smart-merge', changes };
  }

  // Strategy 2: HCL block replace.
  const hclResult = replaceHclBlock(existing, withSubs);
  if (hclResult) {
    fs.writeFileSync(filePath, hclResult.merged);
    return { wrote: filePath, strategy: 'block-replace', changes: hclResult.changes };
  }

  // Strategy 3: full overwrite.
  fs.writeFileSync(filePath, withSubs);
  return { wrote: filePath, strategy: 'overwrite', changes: ['(file fully replaced)'] };
}

// ──────────────────────────────────────────────────────────────────────────
// Strategy 1: tfvars smart-merge
// ──────────────────────────────────────────────────────────────────────────

function isPureKeyValueBlock(block: string): boolean {
  const lines = block.split('\n').map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return false;
  for (const line of lines) {
    if (line.startsWith('#')) continue;  // comments OK
    // tfvars line: `key = value` (with optional trailing comment)
    if (/^[a-z_][a-z0-9_]*\s*=/i.test(line)) continue;
    return false;  // anything else (resource blocks, braces) → not tfvars
  }
  return true;
}

function mergeKeyValueIntoFile(existing: string, block: string): { merged: string; changes: string[] } {
  const changes: string[] = [];
  let result = existing;
  for (const rawLine of block.split('\n')) {
    const m = rawLine.match(/^(\s*)([a-z_][a-z0-9_]*)\s*=\s*(.+?)(\s+#.*)?$/i);
    if (!m) continue;
    const [, , key, value, trailingComment] = m;
    const newLine = `${key} = ${value.trim()}${trailingComment || ''}`;
    const liveRe = new RegExp(`^[ \\t]*${key}\\s*=.*$`, 'm');
    const commentedRe = new RegExp(`^[ \\t]*#\\s*${key}\\s*=.*$`, 'm');
    if (liveRe.test(result)) {
      result = result.replace(liveRe, newLine);
      changes.push(`updated: ${key}`);
    } else if (commentedRe.test(result)) {
      result = result.replace(commentedRe, newLine);
      changes.push(`uncommented + set: ${key}`);
    } else {
      result = result.replace(/\s*$/, '') + '\n' + newLine + '\n';
      changes.push(`appended: ${key}`);
    }
  }
  return { merged: result, changes };
}

// ──────────────────────────────────────────────────────────────────────────
// Strategy 2: HCL block replace
// ──────────────────────────────────────────────────────────────────────────

function replaceHclBlock(existing: string, block: string): { merged: string; changes: string[] } | null {
  // Find first top-level block in the new block (terraform/provider/resource/etc.)
  const blockLines = block.split('\n');
  let blockStart = -1;
  let blockHeader = '';
  for (let i = 0; i < blockLines.length; i++) {
    const m = blockLines[i].match(/^(terraform|provider|resource|data|module|output|variable)\s+("[^"]+"(?:\s+"[^"]+")?)?\s*\{/);
    if (m) { blockStart = i; blockHeader = blockLines[i].split('{')[0].trim(); break; }
  }
  if (blockStart === -1) return null;

  // Find matching closing brace in the new block (walk braces, ignore comments).
  let depth = 1;
  let blockEnd = -1;
  for (let i = blockStart + 1; i < blockLines.length && depth > 0; i++) {
    const l = blockLines[i];
    if (l.trimStart().startsWith('#')) continue;
    for (const ch of l) {
      if (ch === '{') depth++;
      else if (ch === '}') depth--;
    }
    if (depth === 0) blockEnd = i;
  }
  if (blockEnd === -1) return null;
  const newBlockText = blockLines.slice(blockStart, blockEnd + 1).join('\n');

  // Find the same-prefix block in the existing file.
  // For `terraform {` we just match `terraform {`. For `provider "aws" {` we match by header.
  const existingLines = existing.split('\n');
  let existingStart = -1;
  for (let i = 0; i < existingLines.length; i++) {
    const trimmed = existingLines[i].trimStart();
    if (trimmed.startsWith('#')) continue;
    if (trimmed.startsWith(blockHeader)) { existingStart = i; break; }
  }
  if (existingStart === -1) {
    // Block doesn't exist in the file — append it.
    const merged = existing.replace(/\s*$/, '') + '\n\n' + newBlockText + '\n';
    return { merged, changes: [`appended new ${blockHeader} block`] };
  }
  // Walk braces in existing file to find end of the matched block.
  let exDepth = 0;
  let exEnd = -1;
  for (let i = existingStart; i < existingLines.length; i++) {
    const l = existingLines[i];
    if (l.trimStart().startsWith('#')) continue;
    for (const ch of l) {
      if (ch === '{') exDepth++;
      else if (ch === '}') exDepth--;
    }
    if (exDepth === 0 && i >= existingStart) { exEnd = i; break; }
  }
  if (exEnd === -1) return null;
  const merged = [
    ...existingLines.slice(0, existingStart),
    newBlockText,
    ...existingLines.slice(exEnd + 1),
  ].join('\n');
  return { merged, changes: [`replaced ${blockHeader} block (lines ${existingStart + 1}-${exEnd + 1})`] };
}

// ──────────────────────────────────────────────────────────────────────────
// Key-value substitutions (e.g. replace lab placeholder with captured tf output)
// ──────────────────────────────────────────────────────────────────────────

/**
 * Replace the right-hand-side value of `key = "..."` lines where `key` is in
 * the substitutions map. Used to substitute lab placeholders (like
 * `studentXX-terraform-state-abc123`) with values captured from prior
 * `terraform output` calls.
 */
export function applyKeySubstitutions(content: string, subs: Record<string, string>): string {
  let result = content;
  for (const [key, value] of Object.entries(subs)) {
    const re = new RegExp(`^(\\s*${key}\\s*=\\s*)"[^"]*"(.*)$`, 'gm');
    result = result.replace(re, (_match, prefix, suffix) => `${prefix}"${value}"${suffix}`);
  }
  return result;
}

// ──────────────────────────────────────────────────────────────────────────
// Dedent — lab markdown nests fenced blocks under numbered list items and
// preserves the indentation. Strip the common leading whitespace so the
// emitted file isn't oddly indented.
// ──────────────────────────────────────────────────────────────────────────

export function dedentBlock(content: string): string {
  const lines = content.split('\n');
  let minIndent = Infinity;
  for (const l of lines) {
    if (l.trim() === '') continue;  // ignore blank lines for indent calc
    const m = l.match(/^(\s*)/);
    const indent = m ? m[1].length : 0;
    if (indent < minIndent) minIndent = indent;
  }
  if (!isFinite(minIndent) || minIndent === 0) return content;
  return lines.map((l) => (l.length >= minIndent ? l.slice(minIndent) : l)).join('\n');
}

// ──────────────────────────────────────────────────────────────────────────
// Angle-bracket placeholder substitutions
// ──────────────────────────────────────────────────────────────────────────

/**
 * Replace lab placeholders like `<paste-the-state_bucket_name-output-here>`
 * and `<your-assigned-region>` with values pulled from the cached terraform
 * outputs and the run environment.
 *
 * Recognized forms:
 *   <paste-NAME-output-here>            → outputs[NAME]
 *   <paste-the-NAME-output-here>        → outputs[NAME]
 *   <your-state-bucket-from-terraform-output> → outputs.state_bucket_name
 *   <your-state-bucket-name>            → outputs.state_bucket_name
 *   <your-bucket-name>                  → outputs.state_bucket_name (fallback)
 *   <your-assigned-region>              → env.AWS_REGION
 *   <student_id>                        → env.TERRAFORM_STUDENT_ID
 *
 * Anything we can't resolve is left as-is — the runner will surface a
 * "placeholder still present" error when terraform fails to parse the file
 * (or we'll add an explicit check). Leaving it makes the failure visible
 * rather than silently writing the wrong value.
 */
export function applyPlaceholderSubstitutions(
  content: string,
  outputs: Record<string, string>,
  env: Record<string, string>,
): string {
  return content.replace(/<([a-z0-9_][a-z0-9_.-]*)>/gi, (match, inner) => {
    const lookup = resolvePlaceholder(inner, outputs, env);
    return lookup ?? match;
  });
}

function resolvePlaceholder(
  inner: string,
  outputs: Record<string, string>,
  env: Record<string, string>,
): string | undefined {
  // Form: paste-NAME-output-here  or  paste-the-NAME-output-here
  let m = inner.match(/^paste-(?:the-)?([a-z_][a-z0-9_]*)-output-here$/i);
  if (m && outputs[m[1]]) return outputs[m[1]];

  // Specific named placeholders used in Terraform Day 3 labs.
  switch (inner.toLowerCase()) {
    case 'your-state-bucket-from-terraform-output':
    case 'your-state-bucket-name':
    case 'your-bucket-name':
      return outputs.state_bucket_name;
    case 'your-assigned-region':
      return env.AWS_REGION || env.TERRAFORM_REGION;
    case 'student_id':
      return env.TERRAFORM_STUDENT_ID || env.STUDENT || env.USER;
  }

  // Last-ditch: <name> where `name` is a direct output key (e.g. `<public_ip>`).
  if (outputs[inner]) return outputs[inner];

  return undefined;
}

// ──────────────────────────────────────────────────────────────────────────
// Terraform output parsing — for the runner's output value cache
// ──────────────────────────────────────────────────────────────────────────

/**
 * Parse the stdout of `terraform output` (no args, default formatted output).
 * Returns key→value map for simple string outputs:
 *   key = "value"
 * Ignores complex outputs (heredocs, maps, lists) for now — those are rare in
 * tfvars-style substitutions.
 */
export function parseTerraformOutput(stdout: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of stdout.split('\n')) {
    const m = line.match(/^([a-z_][a-z0-9_]*)\s*=\s*"([^"]*)"\s*$/i);
    if (m) out[m[1]] = m[2];
  }
  return out;
}
