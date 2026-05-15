import * as fs from 'fs';
import * as path from 'path';

/**
 * Lab Parser Utility
 *
 * Parses lab markdown files to extract testable steps
 * This can be used to auto-generate test scaffolding from lab content
 */

export interface LabStep {
  stepNumber: number;
  title: string;
  instructions: string[];
  codeBlocks: string[];
  expectedOutputs: string[];
}

export interface ParsedLab {
  title: string;
  duration: string | null;
  objectives: string[];
  steps: LabStep[];
}

/**
 * Parse a lab markdown file into structured steps
 */
export function parseLabMarkdown(filePath: string): ParsedLab {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');

  const lab: ParsedLab = {
    title: '',
    duration: null,
    objectives: [],
    steps: [],
  };

  let currentStep: LabStep | null = null;
  let inCodeBlock = false;
  let currentCodeBlock = '';

  for (const line of lines) {
    // Extract title (first H1)
    if (line.startsWith('# ') && !lab.title) {
      lab.title = line.replace('# ', '').trim();
      continue;
    }

    // Extract duration
    if (line.toLowerCase().includes('duration:')) {
      lab.duration = line.split(':')[1]?.trim() || null;
      continue;
    }

    // Detect step headers (## Step N: or ### Step N:)
    const stepMatch = line.match(/^#{2,3}\s*Step\s*(\d+)[:\s]*(.+)?/i);
    if (stepMatch) {
      if (currentStep) {
        lab.steps.push(currentStep);
      }
      currentStep = {
        stepNumber: parseInt(stepMatch[1]),
        title: stepMatch[2]?.trim() || '',
        instructions: [],
        codeBlocks: [],
        expectedOutputs: [],
      };
      continue;
    }

    // Handle code blocks
    if (line.startsWith('```')) {
      if (inCodeBlock) {
        // End of code block
        if (currentStep) {
          currentStep.codeBlocks.push(currentCodeBlock.trim());
        }
        currentCodeBlock = '';
        inCodeBlock = false;
      } else {
        // Start of code block
        inCodeBlock = true;
      }
      continue;
    }

    if (inCodeBlock) {
      currentCodeBlock += line + '\n';
      continue;
    }

    // Collect instructions (non-empty lines within a step)
    if (currentStep && line.trim()) {
      // Check for expected output markers
      if (line.toLowerCase().includes('expected output') ||
          line.toLowerCase().includes('you should see')) {
        currentStep.expectedOutputs.push(line.trim());
      } else {
        currentStep.instructions.push(line.trim());
      }
    }
  }

  // Don't forget the last step
  if (currentStep) {
    lab.steps.push(currentStep);
  }

  return lab;
}

/**
 * Generate test scaffolding from a parsed lab
 */
export function generateTestScaffolding(lab: ParsedLab): string {
  const testName = lab.title.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();

  let code = `import { test, expect } from '../../fixtures/aws-fixture';
import { ec2 } from '../../actions';

/**
 * Auto-generated test for: ${lab.title}
 * Duration: ${lab.duration || 'Unknown'}
 */

test.describe('${lab.title}', () => {
`;

  for (const step of lab.steps) {
    code += `
  test('Step ${step.stepNumber}: ${step.title}', async ({ awsPage }) => {
    // Instructions:
${step.instructions.map(i => `    // - ${i}`).join('\n')}

    // Code blocks to execute:
${step.codeBlocks.map(c => `    // ${c.split('\n')[0]}...`).join('\n')}

    // TODO: Implement this step
    test.skip();
  });
`;
  }

  code += `});
`;

  return code;
}

/**
 * CLI helper to parse a lab and output test scaffolding
 */
export function main() {
  const args = process.argv.slice(2);
  if (args.length < 1) {
    console.log('Usage: npx ts-node lab-parser.ts <lab-markdown-file>');
    process.exit(1);
  }

  const labPath = args[0];
  const lab = parseLabMarkdown(labPath);

  console.log('=== Parsed Lab ===');
  console.log(`Title: ${lab.title}`);
  console.log(`Duration: ${lab.duration}`);
  console.log(`Steps: ${lab.steps.length}`);

  console.log('\n=== Generated Test Scaffolding ===\n');
  console.log(generateTestScaffolding(lab));
}

if (require.main === module) {
  main();
}
