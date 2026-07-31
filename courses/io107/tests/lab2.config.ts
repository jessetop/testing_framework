/**
 * IO-107 Lab 2 — Lambda Deployment with SAM. See lab1.config.ts for the
 * pattern overview. Lab 2 specifics:
 *   - Edits template.yaml + src/app.py
 *   - Pipeline does sam build + sam deploy (CodeDeploy under the hood)
 *   - Verifies alias weights during the 5-minute canary
 */

import { execSync } from 'child_process';
import * as path from 'path';
import { LAB_ENV_TF_PATH } from '../lab-source';

export const lab2Config = {
  studentId: process.env.IO107_STUDENT_ID || '',
  awsProfile: process.env.AWS_PROFILE || 'roitraining',
  region: process.env.IO107_REGION || 'us-east-1',
  // Source-of-truth is now the per-student CodeCommit URL exposed by terraform
  // output (`lab2_codecommit_clone_url`). No env-var fork URL needed.
  labEnvTfDir: process.env.LAB_ENV_TF_DIR || LAB_ENV_TF_PATH,

  get workspaceRoot(): string {
    return path.resolve(__dirname, '..', '..', '..', 'test-results', 'io107-lab2', this.studentId || 'unset');
  },
  get repoDir(): string { return path.join(this.workspaceRoot, 'student-repo'); },
  get tfOutputsFile(): string { return path.join(this.workspaceRoot, '.tf-outputs.json'); },

  get pipelineName(): string { return `io107-${this.studentId}-lab2`; },
  get codebuildProjectName(): string { return `io107-${this.studentId}-lab2-build`; },

  /** Lambda function name pattern (SAM-generated, includes CFN stack prefix). */
  get lambdaFunctionPrefix(): string { return `io107-${this.studentId}-lab2`; },
};

export const requirements = [
  { name: 'aws CLI v2',                  check: () => { try { return { ok: /aws-cli\/2\./.test(execSync('aws --version', { encoding: 'utf8' })), detail: execSync('aws --version', { encoding: 'utf8' }).trim() }; } catch { return { ok: false, detail: 'aws missing' }; } }, howToFix: 'Install AWS CLI v2' },
  { name: 'git',                          check: () => { try { return { ok: true, detail: execSync('git --version', { encoding: 'utf8' }).trim() }; } catch { return { ok: false, detail: 'git missing' }; } }, howToFix: 'Install Git' },
  { name: 'python3',                      check: () => { try { return { ok: true, detail: execSync('python --version', { encoding: 'utf8' }).trim() }; } catch { return { ok: false, detail: 'python missing' }; } }, howToFix: 'Install Python 3.11+' },
];

export function validateConfig(): { ok: boolean; missing: string[]; warnings: string[] } {
  const missing: string[] = [];
  const warnings: string[] = [];
  if (!lab2Config.studentId) missing.push('IO107_STUDENT_ID');
  for (const r of requirements) {
    const res = r.check();
    if (!res.ok) missing.push(`${r.name}: ${res.detail} — ${r.howToFix}`);
  }
  return { ok: missing.length === 0, missing, warnings };
}
