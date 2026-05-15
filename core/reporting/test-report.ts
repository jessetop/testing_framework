/**
 * Lab Test Report Generator
 *
 * Creates a human-readable markdown report documenting:
 * - What was tested and when
 * - Each step attempted with pass/fail/skip status
 * - Challenges encountered and fixes applied
 * - Missing or broken lab steps
 * - Tool used per step (Playwright, Nova Act, CLI)
 * - Final summary and recommendations
 *
 * Reports are saved to: courses/<course>/tests/reports/<lab>-<date>.md
 * The latest report is also symlinked as: courses/<course>/tests/reports/latest.md
 */

import * as fs from 'fs';
import * as path from 'path';

export type StepStatus = 'pass' | 'fail' | 'skip' | 'in-progress' | 'challenge';
export type ToolUsed = 'playwright' | 'nova-act' | 'cli' | 'manual';

export interface StepEntry {
  name: string;
  status: StepStatus;
  tool: ToolUsed;
  duration?: string;
  details?: string;
  challenge?: string;
  fix?: string;
  screenshot?: string;
}

export interface TestReport {
  course: string;
  labNumber: number;
  labName: string;
  date: string;
  startTime: string;
  endTime?: string;
  totalDuration?: string;
  environment: {
    region: string;
    account: string;
    runner: string;
  };
  steps: StepEntry[];
  summary: {
    passed: number;
    failed: number;
    skipped: number;
    challenges: number;
  };
  recommendations: string[];
  labIssues: string[];
}

export class LabTestReporter {
  private report: TestReport;
  private startMs: number;
  private outputDir: string;

  constructor(course: string, labNumber: number, labName: string) {
    this.startMs = Date.now();
    const now = new Date();

    this.report = {
      course,
      labNumber,
      labName,
      date: now.toISOString().split('T')[0],
      startTime: now.toISOString(),
      environment: {
        region: process.env.AWS_REGION || 'us-east-1',
        account: process.env.AWS_ACCOUNT_ID || 'unknown',
        runner: 'playwright + nova-act',
      },
      steps: [],
      summary: { passed: 0, failed: 0, skipped: 0, challenges: 0 },
      recommendations: [],
      labIssues: [],
    };

    // Create output directory
    this.outputDir = path.join(
      __dirname, '../../courses', course, 'tests/reports'
    );
    fs.mkdirSync(this.outputDir, { recursive: true });
  }

  /**
   * Log a step result
   */
  step(entry: StepEntry): void {
    this.report.steps.push(entry);
    const key = entry.status === 'challenge' ? 'challenges' :
                 entry.status === 'in-progress' ? 'passed' :
                 entry.status === 'pass' ? 'passed' :
                 entry.status === 'fail' ? 'failed' :
                 entry.status === 'skip' ? 'skipped' : 'passed';
    (this.report.summary as any)[key]++;

    const icon = {
      'pass': '[PASS]',
      'fail': '[FAIL]',
      'skip': '[SKIP]',
      'in-progress': '[....]',
      'challenge': '[!!!!]',
    }[entry.status];

    console.log(`  ${icon} ${entry.name} (${entry.tool})${entry.duration ? ` [${entry.duration}]` : ''}`);
    if (entry.challenge) console.log(`         Challenge: ${entry.challenge}`);
    if (entry.fix) console.log(`         Fix: ${entry.fix}`);
  }

  /**
   * Log a lab issue (something wrong with the lab itself, not the test)
   */
  labIssue(issue: string): void {
    this.report.labIssues.push(issue);
    console.log(`  [LAB ISSUE] ${issue}`);
  }

  /**
   * Add a recommendation
   */
  recommend(rec: string): void {
    this.report.recommendations.push(rec);
  }

  /**
   * Finalize and write the report
   */
  finalize(): string {
    const endTime = new Date();
    this.report.endTime = endTime.toISOString();
    this.report.totalDuration = `${Math.round((Date.now() - this.startMs) / 1000)}s`;

    // Recount summary
    this.report.summary = { passed: 0, failed: 0, skipped: 0, challenges: 0 };
    for (const step of this.report.steps) {
      if (step.status === 'pass') this.report.summary.passed++;
      else if (step.status === 'fail') this.report.summary.failed++;
      else if (step.status === 'skip') this.report.summary.skipped++;
      if (step.challenge) this.report.summary.challenges++;
    }

    const md = this.generateMarkdown();
    const filename = `lab${this.report.labNumber}-${this.report.date}.md`;
    const filepath = path.join(this.outputDir, filename);

    fs.writeFileSync(filepath, md, 'utf-8');

    // Also write as latest.md
    const latestPath = path.join(this.outputDir, 'latest.md');
    fs.writeFileSync(latestPath, md, 'utf-8');

    console.log(`\n  Report saved: ${filepath}`);
    return filepath;
  }

  private generateMarkdown(): string {
    const r = this.report;
    const total = r.steps.length;
    const passRate = total > 0 ? Math.round((r.summary.passed / total) * 100) : 0;

    let md = `# Lab Test Report: ${r.course} Lab ${r.labNumber}
## ${r.labName}

| Field | Value |
|-------|-------|
| Date | ${r.date} |
| Duration | ${r.totalDuration} |
| Region | ${r.environment.region} |
| Account | ${r.environment.account} |
| Runner | ${r.environment.runner} |

## Summary

| Metric | Count |
|--------|-------|
| Total Steps | ${total} |
| Passed | ${r.summary.passed} |
| Failed | ${r.summary.failed} |
| Skipped | ${r.summary.skipped} |
| Challenges | ${r.summary.challenges} |
| **Pass Rate** | **${passRate}%** |

## Steps

| # | Step | Status | Tool | Duration | Details |
|---|------|--------|------|----------|---------|
`;

    for (let i = 0; i < r.steps.length; i++) {
      const s = r.steps[i];
      const icon = { pass: 'PASS', fail: 'FAIL', skip: 'SKIP', 'in-progress': '....', challenge: '!!!!' }[s.status];
      md += `| ${i + 1} | ${s.name} | ${icon} | ${s.tool} | ${s.duration || '-'} | ${s.details || '-'} |\n`;
    }

    // Challenges section
    const challenges = r.steps.filter(s => s.challenge);
    if (challenges.length > 0) {
      md += `\n## Challenges Encountered\n\n`;
      for (const s of challenges) {
        md += `### ${s.name}\n`;
        md += `- **Challenge:** ${s.challenge}\n`;
        if (s.fix) md += `- **Fix Applied:** ${s.fix}\n`;
        md += `- **Status:** ${s.status}\n\n`;
      }
    }

    // Lab issues
    if (r.labIssues.length > 0) {
      md += `\n## Lab Issues Found\n\n`;
      md += `These are issues with the lab content itself (not the test framework):\n\n`;
      for (const issue of r.labIssues) {
        md += `- ${issue}\n`;
      }
    }

    // Recommendations
    if (r.recommendations.length > 0) {
      md += `\n## Recommendations\n\n`;
      for (const rec of r.recommendations) {
        md += `- ${rec}\n`;
      }
    }

    md += `\n---\n*Generated by lab-testing-framework on ${r.date}*\n`;
    return md;
  }
}
