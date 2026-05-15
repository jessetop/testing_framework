/**
 * Lab markdown parser.
 *
 * Extracts numbered steps + their fenced code blocks. Classifies each block
 * (execute / expected-output / file-content / reference-only) using surrounding
 * prose as the signal.
 *
 * Markdown shape we expect (matches Terraform Day 3 iteration_1):
 *
 *   # Lab N: Title
 *
 *   ## Task X: Heading
 *
 *   1. **Step title**
 *
 *       Prose...
 *
 *       ```bash
 *       command1
 *       ```
 *
 *       **Expected:**
 *
 *       ```
 *       output
 *       ```
 *
 *   2. **Next step**
 *       ...
 */

import * as fs from 'fs';
import { ParsedLab, ParsedStep, CodeBlock, BlockKind } from './types';

interface RawBlock {
  lang: string;
  content: string;
  startLine: number;
  /** Index of the line containing the opening fence. */
  fenceLine: number;
}

/** Strip ANSI-style escapes that sometimes sneak into markdown samples. */
function stripAnsi(s: string): string {
  return s.replace(/\u001b\[[0-9;]*m/g, '');
}

export function parseLab(markdownPath: string): ParsedLab {
  const raw = fs.readFileSync(markdownPath, 'utf8').replace(/\r\n/g, '\n');
  const lines = raw.split('\n');

  // 1. Find every fenced code block and remember its position.
  const blocks: RawBlock[] = [];
  let inFence = false;
  let fenceLang = '';
  let fenceStart = -1;
  let buf: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    const m = l.match(/^(\s*)```([a-zA-Z0-9_+-]*)\s*$/);
    if (m && !inFence) {
      inFence = true;
      fenceLang = m[2] || 'text';
      fenceStart = i;
      buf = [];
      continue;
    }
    if (inFence && /^\s*```\s*$/.test(l)) {
      blocks.push({
        lang: fenceLang,
        content: buf.join('\n'),
        startLine: fenceStart + 2,  // 1-indexed, first content line
        fenceLine: fenceStart + 1,
      });
      inFence = false;
      buf = [];
      continue;
    }
    if (inFence) buf.push(l);
  }

  // 2. Find numbered list items at the top indent level — these are the steps.
  //    Each step starts at a line like `1. **Title**` or `12. **Title**`.
  //    The step ends when the next step starts or a new H2/H3 appears at the top level.
  interface StepBoundary {
    stepId: string;
    title: string;
    startLine: number;  // 1-indexed
    endLine: number;
    taskTitle?: string;
  }

  const steps: StepBoundary[] = [];
  let currentTaskTitle: string | undefined;
  let lastStep: StepBoundary | undefined;

  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];

    // Track current ## Task heading.
    const taskMatch = l.match(/^##\s+(?:Task|Part)\s+([A-Z0-9.]+)[.:]?\s*(.*)$/i);
    if (taskMatch) {
      currentTaskTitle = `${taskMatch[1]}: ${taskMatch[2]}`.trim();
    } else if (/^##\s+/.test(l)) {
      currentTaskTitle = l.replace(/^##\s+/, '').trim();
    }

    // Numbered list item at top level: line starts with optional 0-3 spaces, then digits, then ". **"
    const stepMatch = l.match(/^( {0,3})(\d+)\.\s+\*\*([^*]+?)\*\*\s*$/);
    if (stepMatch) {
      if (lastStep) lastStep.endLine = i;  // close prior step
      const s: StepBoundary = {
        stepId: stepMatch[2],
        title: stepMatch[3].trim(),
        startLine: i + 1,
        endLine: lines.length,  // closed when we see the next step or end
        taskTitle: currentTaskTitle,
      };
      steps.push(s);
      lastStep = s;
    }
  }

  // 3. For each step, attach blocks that fall within [startLine, endLine].
  const parsedSteps: ParsedStep[] = steps.map((s) => {
    const stepBlocks: CodeBlock[] = blocks
      .filter((b) => b.fenceLine + 1 >= s.startLine && b.fenceLine + 1 < s.endLine)
      .map((b) => buildCodeBlock(b, lines));
    return {
      stepId: s.stepId,
      title: s.title,
      taskTitle: s.taskTitle,
      blocks: stepBlocks,
    };
  });

  // 4. Lab title from first H1.
  const titleLine = lines.find((l) => /^#\s+/.test(l));
  const title = titleLine ? titleLine.replace(/^#\s+/, '').trim() : 'Untitled';

  return { title, sourcePath: markdownPath, steps: parsedSteps };
}

function buildCodeBlock(b: RawBlock, lines: string[]): CodeBlock {
  // Capture up to 5 non-blank lines of prose before the opening fence.
  const before: string[] = [];
  for (let i = b.fenceLine - 1; i >= 0 && before.length < 8; i--) {
    const l = lines[i].trim();
    if (l === '') {
      if (before.length > 0) break;
      continue;
    }
    if (/^```/.test(lines[i])) break;
    before.unshift(l);
  }
  const after: string[] = [];
  const closeLine = b.fenceLine + b.content.split('\n').length + 1;
  for (let i = closeLine + 1; i < lines.length && after.length < 8; i++) {
    const l = lines[i].trim();
    if (l === '') {
      if (after.length > 0) break;
      continue;
    }
    if (/^```/.test(lines[i])) break;
    after.push(l);
  }
  const precedingText = before.join('\n');
  const followingText = after.join('\n');

  const { classification, targetPath } = classify(b, precedingText, followingText);

  return {
    lang: b.lang.toLowerCase(),
    content: stripAnsi(b.content),
    startLine: b.startLine,
    precedingText,
    followingText,
    classification,
    targetPath,
  };
}

function classify(
  b: RawBlock,
  preceding: string,
  _following: string,
): { classification: BlockKind; targetPath?: string } {
  const lang = b.lang.toLowerCase();
  const precedingLower = preceding.toLowerCase();
  const lastPrecedingLine = preceding.split('\n').pop() || '';

  // 1. Expected output? Preceding text says "Expected output", "Expected:", "you should see", etc.
  const expectedHints = [
    /\*\*expected[^*]*\*\*\s*:?$/i,
    /expected output:?$/i,
    /^you should see/i,
    /^you'll see/i,
    /^output:$/i,
    /^(the )?(plan|apply|destroy) (output|will show|should show)/i,
  ];
  if (expectedHints.some((re) => re.test(lastPrecedingLine.trim()))) {
    return { classification: 'expected-output' };
  }

  // 2. File-content? Preceding text says "Create `filename.tf`:" or similar.
  const createMatch = lastPrecedingLine.match(/(?:create|open|edit|update|add\s+to)\s+`([^`]+\.(?:tf|tfvars|json|yaml|yml|sh|hcl|md))`\s*:?\s*$/i);
  if (createMatch) {
    return { classification: 'file-content', targetPath: createMatch[1] };
  }

  // 3. HCL block whose first line is a path comment (`# foo.tf`) and language is hcl — treat as file content
  //    targeting that filename in current cwd.
  if (['hcl', 'terraform', 'tf'].includes(lang)) {
    const firstLine = b.content.split('\n')[0].trim();
    const pathInComment = firstLine.match(/^#\s+([a-zA-Z0-9_./-]+\.(?:tf|tfvars))(?:\s|$)/);
    if (pathInComment) {
      return { classification: 'file-content', targetPath: pathInComment[1] };
    }
    // HCL block with no file hint — reference only.
    return { classification: 'reference-only' };
  }

  // 4. Non-bash, non-HCL languages default to reference-only unless explicitly told to run.
  if (lang === 'json' || lang === 'yaml' || lang === 'yml' || lang === 'text' || lang === '') {
    // Plaintext blocks after "Expected" handled above. Otherwise reference.
    return { classification: 'reference-only' };
  }

  // 5. Bash blocks default to execute.
  if (lang === 'bash' || lang === 'sh' || lang === 'shell' || lang === 'console') {
    return { classification: 'execute' };
  }

  // 6. Unknown language — reference-only by default.
  return { classification: 'reference-only' };
}
