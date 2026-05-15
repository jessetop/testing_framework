/**
 * Static checks — run BEFORE executing the walkthrough. Catch the bugs the
 * labforge reviewer caught (placeholder confusion, snippet drift, missing
 * required variables) without needing AWS resources or wall time.
 *
 * Each check returns a list of `Finding`s. Severity:
 *   - 'blocker': a student following the lab literally will fail
 *   - 'warning': inconsistent or fragile, worth fixing but not a hard fail
 *   - 'info': contextual notes (e.g. "step uses ${USER}, env will export it")
 */

import * as fs from 'fs';
import * as path from 'path';
import { ParsedLab, ParsedStep, CodeBlock } from './types';

export type Severity = 'blocker' | 'warning' | 'info';

export interface Finding {
  check: string;
  severity: Severity;
  /** Step id (if applicable). */
  stepId?: string;
  /** Source location (lab markdown line, repo file:line, etc.). */
  location?: string;
  message: string;
  /** Optional details — a short snippet of what was found. */
  detail?: string;
}

// ──────────────────────────────────────────────────────────────────────────
// Check 1 — Placeholder consistency
// ──────────────────────────────────────────────────────────────────────────

/**
 * Scan every block for placeholder patterns. Detect inconsistencies:
 *   - Mixing `${USER}` (shell) and `${student_id}` or studentXX (terraform var)
 *     within the same lab — these resolve to different values on a typical
 *     student VM and break tag-filtered lookups.
 *   - Using `studentXX` literally where a regex validator rejects it.
 *   - Using angle-bracket placeholders (`<your-bucket>`) without a prior
 *     instruction to substitute.
 */
export function checkPlaceholderConsistency(lab: ParsedLab): Finding[] {
  const findings: Finding[] = [];

  const patterns = {
    shellUser: /\$\{USER\}|\$USER\b/g,
    shellStudent: /\$\{STUDENT\}|\$STUDENT\b/g,
    tfStudent: /\$\{?student_id\}?|var\.student_id/g,
    studentXxLiteral: /\bstudentXX\b/g,
    userxxLiteral: /\buserxx\b/gi,
    angleBracket: /<[a-zA-Z][a-zA-Z0-9 _\-./]{1,60}>/g,
  };

  // Per-pattern step occurrences.
  const seen: Record<keyof typeof patterns, Set<string>> = {
    shellUser: new Set(), shellStudent: new Set(),
    tfStudent: new Set(), studentXxLiteral: new Set(),
    userxxLiteral: new Set(), angleBracket: new Set(),
  };

  for (const step of lab.steps) {
    const haystack = [step.title, ...step.blocks.map((b) => b.content)].join('\n');
    for (const [name, re] of Object.entries(patterns) as [keyof typeof patterns, RegExp][]) {
      // Reset regex state since we use /g.
      re.lastIndex = 0;
      if (re.test(haystack)) seen[name].add(step.stepId);
    }
  }

  // Inconsistency: lab uses BOTH shell-style USER and terraform-var student_id
  // in different steps. On a typical student VM $USER is ec2-user/cloudshell-user,
  // not the IAM username — this combination breaks tag-filtered AWS lookups.
  if (seen.shellUser.size > 0 && (seen.tfStudent.size > 0 || seen.studentXxLiteral.size > 0)) {
    findings.push({
      check: 'placeholder-consistency',
      severity: 'blocker',
      message:
        `Lab mixes shell \${USER} (steps ${[...seen.shellUser].slice(0, 5).join(', ')}) ` +
        `with terraform \${student_id} or studentXX (steps ${[...new Set([...seen.tfStudent, ...seen.studentXxLiteral])].slice(0, 5).join(', ')}). ` +
        `\${USER} on typical student VMs is ec2-user / cloudshell-user, not the IAM username — tag-filtered lookups will return zero matches. ` +
        `Pick one convention (recommend exporting STUDENT=<iam-username> at the top and using \${STUDENT} throughout).`,
    });
  }

  // Inconsistency: studentXX literal in lab text but a validator in variables.tf
  // probably rejects it (the validators we've seen require `^student[0-9]{2}$`).
  // We can't check validators without the repo here, so mark as warning.
  if (seen.studentXxLiteral.size > 0) {
    findings.push({
      check: 'placeholder-consistency',
      severity: 'warning',
      message:
        `studentXX appears literally in steps ${[...seen.studentXxLiteral].slice(0, 5).join(', ')}. ` +
        `Many repos have a regex validator (e.g. \`^student[0-9]{2}$\`) that rejects the literal "studentXX". ` +
        `Verify the lab instructs students to replace it before pasting into a real terraform.tfvars.`,
    });
  }

  // Info: which placeholder patterns are actually used (helps reviewers see
  // the lab's substitution flow at a glance).
  const used = (Object.keys(seen) as (keyof typeof seen)[]).filter((k) => seen[k].size > 0);
  if (used.length > 0) {
    findings.push({
      check: 'placeholder-consistency',
      severity: 'info',
      message: `Placeholder patterns in use: ${used.map((k) => `${k}(${seen[k].size} step${seen[k].size !== 1 ? 's' : ''})`).join(', ')}.`,
    });
  }

  return findings;
}

// ──────────────────────────────────────────────────────────────────────────
// Check 2 — Snippet vs repo diff
// ──────────────────────────────────────────────────────────────────────────

/**
 * For every HCL block that looks like it shows a file the student is supposed
 * to read or recognize (lang=hcl, content starts with `# path.tf`), find the
 * matching file in the repo and compare. Report drift.
 *
 * `repoRoot` is the path to a local clone of the lab's repo (e.g.
 * `_workspace/walkthrough-terraform-lab1/student99/Advanced_Terraform`).
 */
export function checkSnippetDrift(lab: ParsedLab, repoRoot: string): Finding[] {
  const findings: Finding[] = [];
  if (!fs.existsSync(repoRoot)) {
    findings.push({
      check: 'snippet-drift',
      severity: 'info',
      message: `Repo not cloned at ${repoRoot} — skipping snippet diff. Run the walkthrough at least once or clone manually to enable this check.`,
    });
    return findings;
  }

  for (const step of lab.steps) {
    for (const block of step.blocks) {
      if (!['hcl', 'terraform', 'tf'].includes(block.lang)) continue;
      // Find a relative repo file path from any of:
      //   1. Leading `# path/to/file.tf` comment in the snippet itself.
      //   2. Preceding prose with "Open/Edit/Review/your <filename> should look like" + a backtick-quoted .tf file
      //   3. Generic backtick-quoted .tf in the preceding prose (less specific but useful).
      const firstLine = block.content.split('\n')[0].trim();
      const headerMatch = firstLine.match(/^#\s+([a-zA-Z0-9_./-]+\.(?:tf|tfvars))(?:\s|$)/);
      const directiveRe = /(?:open|edit|review|update|in|your|the)\s+`([a-zA-Z0-9_./-]+\.(?:tf|tfvars))`/i;
      const directiveMatch = block.precedingText.match(directiveRe);
      const looseRe = /`([a-zA-Z0-9_./-]+\.(?:tf|tfvars))`/;
      const looseMatch = block.precedingText.match(looseRe);
      const relPath = headerMatch?.[1] || directiveMatch?.[1] || looseMatch?.[1];
      if (!relPath) continue;

      // Try to locate the file in the repo. Lab text uses forms like
      // `lab1/state-infra/providers.tf`, `providers.tf`, etc.
      const candidates: string[] = [
        path.join(repoRoot, relPath),
      ];
      // If the path is just a filename, look one level deep for a match.
      if (!relPath.includes('/') && !relPath.includes('\\')) {
        // Walk one level into lab subdirs.
        for (const sub of fs.readdirSync(repoRoot, { withFileTypes: true })) {
          if (sub.isDirectory()) {
            for (const sub2 of fs.readdirSync(path.join(repoRoot, sub.name), { withFileTypes: true })) {
              if (sub2.isDirectory()) {
                candidates.push(path.join(repoRoot, sub.name, sub2.name, relPath));
              }
            }
          }
        }
      }
      const repoFile = candidates.find((p) => fs.existsSync(p));
      if (!repoFile) {
        findings.push({
          check: 'snippet-drift',
          severity: 'warning',
          stepId: step.stepId,
          location: `markdown line ${block.startLine}`,
          message: `Lab shows HCL for \`${relPath}\` but that file isn't in the repo (looked under ${repoRoot}).`,
        });
        continue;
      }

      const repoContent = fs.readFileSync(repoFile, 'utf8').replace(/\r\n/g, '\n');
      const snippet = block.content.replace(/\r\n/g, '\n');

      // Lab snippets are usually summaries, not full files. Check: every
      // non-comment, non-blank line in the snippet should appear in the repo file
      // (loose match — ignore trailing whitespace, ignore lines that are clearly
      // examples like `bucket = "<your-bucket>"`).
      const snippetLines = snippet.split('\n')
        .map((l) => l.trim())
        .filter((l) => l && !l.startsWith('#'))
        .filter((l) => !/<[^>]+>/.test(l))   // skip placeholder lines
        .filter((l) => !/x{3,}/i.test(l));    // skip xxxx-placeholder lines

      const repoNormalized = repoContent.split('\n').map((l) => l.trim()).join('\n');
      const missing = snippetLines.filter((l) => !repoNormalized.includes(l));
      if (missing.length > 0) {
        findings.push({
          check: 'snippet-drift',
          severity: 'warning',
          stepId: step.stepId,
          location: `markdown line ${block.startLine} vs ${path.relative(repoRoot, repoFile)}`,
          message: `Lab snippet doesn't match the repo file (${missing.length} line(s) in the snippet are not present in the repo).`,
          detail: missing.slice(0, 4).map((l) => `  - ${l.slice(0, 80)}`).join('\n'),
        });
      }
    }
  }

  return findings;
}

// ──────────────────────────────────────────────────────────────────────────
// Check 3 — Required variables vs tfvars.example
// ──────────────────────────────────────────────────────────────────────────

/**
 * For each terraform directory referenced in the lab (via `cd path/to/dir` in
 * a bash block), parse `variables.tf` to find required variables (no default),
 * then check `terraform.tfvars.example` to see which ones are exposed.
 * Flag any required var that's missing or commented out in the example.
 */
export function checkRequiredVariables(lab: ParsedLab, repoRoot: string): Finding[] {
  const findings: Finding[] = [];
  if (!fs.existsSync(repoRoot)) return findings;

  const dirs = collectCdTargets(lab, repoRoot);
  for (const dir of dirs) {
    const variablesTf = path.join(dir, 'variables.tf');
    const tfvarsExample = path.join(dir, 'terraform.tfvars.example');
    if (!fs.existsSync(variablesTf)) continue;

    const requiredVars = parseRequiredVars(fs.readFileSync(variablesTf, 'utf8'));
    if (requiredVars.length === 0) continue;

    if (!fs.existsSync(tfvarsExample)) {
      findings.push({
        check: 'required-vars',
        severity: 'blocker',
        location: path.relative(repoRoot, dir),
        message: `${path.relative(repoRoot, dir)}/variables.tf has ${requiredVars.length} required var(s) (${requiredVars.join(', ')}) but no terraform.tfvars.example. Students hit "No value for required variable" on first apply.`,
      });
      continue;
    }

    const exampleContent = fs.readFileSync(tfvarsExample, 'utf8');
    const missing: string[] = [];
    const commented: string[] = [];
    for (const v of requiredVars) {
      // Live line: ^\s*<name>\s*=
      const liveRe = new RegExp(`^\\s*${v}\\s*=`, 'm');
      // Commented line: ^\s*#\s*<name>\s*=
      const commentRe = new RegExp(`^\\s*#\\s*${v}\\s*=`, 'm');
      if (liveRe.test(exampleContent)) continue;
      if (commentRe.test(exampleContent)) {
        commented.push(v);
      } else {
        missing.push(v);
      }
    }
    if (missing.length > 0) {
      findings.push({
        check: 'required-vars',
        severity: 'blocker',
        location: path.relative(repoRoot, dir),
        message: `${path.relative(repoRoot, dir)}/variables.tf requires ${missing.join(', ')} but terraform.tfvars.example doesn't show it (not even commented). Student following the lab won't know to set it.`,
      });
    }
    if (commented.length > 0) {
      findings.push({
        check: 'required-vars',
        severity: 'warning',
        location: path.relative(repoRoot, dir),
        message: `${path.relative(repoRoot, dir)}/variables.tf requires ${commented.join(', ')} but terraform.tfvars.example has it commented. Student must remember to uncomment — easy to miss.`,
      });
    }
  }
  return findings;
}

function parseRequiredVars(variablesTfContent: string): string[] {
  const vars = parseAllVars(variablesTfContent);
  return vars.filter((v) => !v.hasDefault).map((v) => v.name);
}

interface VarDecl { name: string; hasDefault: boolean; defaultValue?: string; }

function parseAllVars(content: string): VarDecl[] {
  const lines = content.replace(/\r\n/g, '\n').split('\n');
  const out: VarDecl[] = [];
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^variable\s+"([^"]+)"\s*\{/);
    if (!m) continue;
    const name = m[1];
    let depth = 1;
    let hasDefault = false;
    let defaultValue: string | undefined;
    for (let j = i + 1; j < lines.length && depth > 0; j++) {
      for (const ch of lines[j]) {
        if (ch === '{') depth++;
        else if (ch === '}') depth--;
      }
      const dm = lines[j].match(/^\s*default\s*=\s*(.+?)\s*$/);
      if (dm) { hasDefault = true; defaultValue = dm[1].replace(/[",]+$/, ''); }
    }
    out.push({ name, hasDefault, defaultValue });
  }
  return out;
}

// ──────────────────────────────────────────────────────────────────────────
// Check 4 — Unused variables (the "your tfvars setting is silently ignored" bug)
// ──────────────────────────────────────────────────────────────────────────

/**
 * For each terraform directory referenced in the lab, look for variables that:
 *   - are declared in variables.tf,
 *   - are exposed to the student via terraform.tfvars.example (live or commented),
 *   - but are NOT referenced anywhere in the module's .tf files (no `var.name`
 *     reference, no use in `module "x" { name = ... }` either).
 *
 * This is the precise "student sets it, it has no effect" bug. We don't flag
 * generic hardcoded values — only the case where the student is told to set
 * something the module doesn't use. Catches the Lab 1 Step 12 case where
 * variables.tf declares `region` but providers.tf hardcodes `us-east-1`.
 */
export function checkUnusedExposedVariables(lab: ParsedLab, repoRoot: string): Finding[] {
  const findings: Finding[] = [];
  if (!fs.existsSync(repoRoot)) return findings;

  const dirs = collectCdTargets(lab, repoRoot);
  for (const dir of dirs) {
    const variablesTf = path.join(dir, 'variables.tf');
    const tfvarsExample = path.join(dir, 'terraform.tfvars.example');
    if (!fs.existsSync(variablesTf) || !fs.existsSync(tfvarsExample)) continue;

    const decls = parseAllVars(fs.readFileSync(variablesTf, 'utf8'));
    const exampleContent = fs.readFileSync(tfvarsExample, 'utf8');

    // Collect every .tf and .tfvars file in the dir (recursively, one level
    // for modules) for the reference search.
    const tfBodies: string[] = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isFile() && entry.name.endsWith('.tf')) {
        tfBodies.push(fs.readFileSync(full, 'utf8'));
      } else if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'terraform.tfstate.d') {
        // Look one level deep (e.g. modules/<x>/main.tf).
        try {
          for (const e2 of fs.readdirSync(full, { withFileTypes: true })) {
            if (e2.isFile() && e2.name.endsWith('.tf')) {
              tfBodies.push(fs.readFileSync(path.join(full, e2.name), 'utf8'));
            }
          }
        } catch { /* ignore */ }
      }
    }
    const combined = tfBodies.join('\n');

    for (const decl of decls) {
      // Is this var exposed to the student (live or commented in tfvars.example)?
      const exposedRe = new RegExp(`^\\s*#?\\s*${decl.name}\\s*=`, 'm');
      if (!exposedRe.test(exampleContent)) continue;

      // Is it referenced anywhere as var.<name>?
      const refRe = new RegExp(`\\bvar\\.${decl.name}\\b`);
      if (refRe.test(combined)) continue;

      // Surface the bug.
      findings.push({
        check: 'unused-exposed-var',
        severity: 'blocker',
        location: path.relative(repoRoot, dir),
        message: `${path.relative(repoRoot, dir)} exposes \`${decl.name}\` in terraform.tfvars.example but no .tf file in this module references \`var.${decl.name}\`. The student's setting is silently ignored. ` +
          `If \`${decl.name}\` is intentionally a placeholder for documentation, remove it from tfvars.example.`,
      });
    }
  }
  return findings;
}

function collectCdTargets(lab: ParsedLab, repoRoot: string): string[] {
  // Find each `cd <something>` in execute blocks; if the path looks like a
  // subdir of the cloned repo, include it.
  const targets = new Set<string>();
  const repoLeaf = path.basename(repoRoot);
  for (const step of lab.steps) {
    for (const block of step.blocks) {
      if (block.classification !== 'execute') continue;
      const cdRegex = /(?:^|\s|;|&&)\s*cd\s+([^\s;&|]+)/gm;
      let m: RegExpExecArray | null;
      while ((m = cdRegex.exec(block.content))) {
        const target = m[1];
        // Normalize: drop `~/<repo>/` prefix if present.
        const fromRepoMatch = target.match(new RegExp(`(?:~/)?${repoLeaf}/(.+)`));
        if (fromRepoMatch) {
          const abs = path.join(repoRoot, fromRepoMatch[1]);
          if (fs.existsSync(abs) && fs.statSync(abs).isDirectory()) {
            targets.add(abs);
          }
        }
      }
    }
  }
  return [...targets];
}

// ──────────────────────────────────────────────────────────────────────────
// Orchestrator
// ──────────────────────────────────────────────────────────────────────────

export interface StaticCheckOptions {
  repoRoot?: string;
}

export function runStaticChecks(lab: ParsedLab, opts: StaticCheckOptions = {}): Finding[] {
  const findings: Finding[] = [];
  findings.push(...checkPlaceholderConsistency(lab));
  if (opts.repoRoot) {
    findings.push(...checkSnippetDrift(lab, opts.repoRoot));
    findings.push(...checkRequiredVariables(lab, opts.repoRoot));
    findings.push(...checkUnusedExposedVariables(lab, opts.repoRoot));
  }
  return findings;
}

export function summarizeFindings(findings: Finding[]): { blocker: number; warning: number; info: number } {
  const s = { blocker: 0, warning: 0, info: 0 };
  for (const f of findings) s[f.severity]++;
  return s;
}
