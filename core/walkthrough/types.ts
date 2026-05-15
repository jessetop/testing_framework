/**
 * Walkthrough runner — types.
 *
 * The walkthrough mode reads a lab's markdown and executes each step's code
 * blocks literally, mirroring what a student does line-for-line. This is the
 * counterpart to the inventory-mode tests, which assert that "the underlying
 * code does the right thing" — walkthrough asserts that "the lab as written
 * actually works for a student following it."
 */

import { StepStrategy } from '../inventory';

export type BlockKind =
  /** Run this block as shell commands. Default for `bash` blocks. */
  | 'execute'
  /** Block under `**Expected:**` / `**Expected output:**`. Compare to prior
   *  block's output, don't execute. */
  | 'expected-output'
  /** HCL / JSON / YAML the student is told to write to a specific file. */
  | 'file-content'
  /** Code block that's documentation — no execution. e.g. snippets that
   *  illustrate a concept. */
  | 'reference-only';

export interface CodeBlock {
  /** Language hint from the fenced block (`bash`, `hcl`, `json`, `text`, `yaml`, etc.). */
  lang: string;
  /** Verbatim block content. */
  content: string;
  /** Line in the source markdown where the block starts. */
  startLine: number;
  /** ~5 lines of prose immediately before the block, for context-based classification. */
  precedingText: string;
  /** ~5 lines of prose immediately after the block. */
  followingText: string;
  classification: BlockKind;
  /** For file-content blocks, the target file path (relative to CWD or absolute). */
  targetPath?: string;
}

export interface ParsedStep {
  /** Step id as written in the markdown (usually "1", "2", "12", ...). */
  stepId: string;
  title: string;
  /** Parent task heading (e.g. "Task 1: Workspace Fundamentals") if any. */
  taskTitle?: string;
  /** All code blocks within the step body, in order. */
  blocks: CodeBlock[];
}

export interface ParsedLab {
  /** Lab title from the first H1. */
  title: string;
  /** Source markdown file path. */
  sourcePath: string;
  /** All numbered steps, flat list across tasks. */
  steps: ParsedStep[];
}

// ──────────────────────────────────────────────────────────────────────────
// Execution context + results
// ──────────────────────────────────────────────────────────────────────────

export interface RunContext {
  /** Course id (e.g. "terraform"). */
  course: string;
  labNumber: number;
  /** Path to the lab markdown the walkthrough is following. */
  markdownPath: string;
  /** Working directory the persistent shell starts in. */
  initialCwd: string;
  /** Env vars set in the shell at start (e.g. STUDENT=user07, AWS_PROFILE=roitraining). */
  env: Record<string, string>;
  /** Map step id → strategy from the inventory. Used by the runner to route
   *  execution. If a step isn't in the map, defaults to `local-cli`. */
  stepStrategies: Record<string, StepStrategy>;
  /** Optional: per-step manual decisions (skip / continue / auto-pass). */
  manualPolicy?: 'pause' | 'auto-skip' | 'fail';
}

export type StepStatus =
  | 'pass'
  | 'fail'
  /** Step's strategy is manual-only; logged for human attention. */
  | 'manual-required'
  /** Block was executed but its output drifted from the lab's stated "Expected:". */
  | 'drift'
  /** Step skipped (e.g. unsupported strategy in MVP). */
  | 'skip';

export interface BlockResult {
  block: CodeBlock;
  status: 'ran' | 'compared' | 'wrote' | 'skipped' | 'failed';
  stdout: string;
  stderr: string;
  exitCode: number;
  durationMs: number;
  /** For expected-output blocks: whether the compare matched. */
  expectedMatched?: boolean;
  /** For file-content blocks: the file path that was written. */
  filePath?: string;
  /** Free-form notes (e.g. "skipped: aws-ui strategy not yet implemented"). */
  notes?: string[];
}

export interface StepResult {
  step: ParsedStep;
  strategy: StepStrategy;
  status: StepStatus;
  blockResults: BlockResult[];
  durationMs: number;
  /** Top-level error message if status is 'fail'. */
  error?: string;
}

export interface RunReport {
  lab: { course: string; labNumber: number; title: string; markdownPath: string };
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  context: { initialCwd: string; envSummary: Record<string, string> };
  steps: StepResult[];
  summary: {
    total: number;
    pass: number;
    fail: number;
    manualRequired: number;
    drift: number;
    skip: number;
  };
}
