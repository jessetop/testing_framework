/**
 * IO-107 Lab 3 — OPA / Conftest policy violations.
 */
import { execSync } from 'child_process';
import * as path from 'path';
import { LAB_ENV_TF_PATH } from '../lab-source';

export const lab3Config = {
  studentId: process.env.IO107_STUDENT_ID || '',
  awsProfile: process.env.AWS_PROFILE || 'roitraining',
  region: process.env.IO107_REGION || 'us-east-1',
  labEnvTfDir: process.env.LAB_ENV_TF_DIR || LAB_ENV_TF_PATH,

  get workspaceRoot(): string { return path.resolve(__dirname, '..', '..', '..', 'test-results', 'io107-lab3', this.studentId || 'unset'); },
  get repoDir(): string { return path.join(this.workspaceRoot, 'student-repo'); },
  get tfOutputsFile(): string { return path.join(this.workspaceRoot, '.tf-outputs.json'); },
  get pipelineName(): string { return `io107-${this.studentId}-lab3`; },
  get codebuildProjectName(): string { return `io107-${this.studentId}-lab3-build`; },

  expectedViolationCount: 17,
};

export function validateConfig() {
  const missing: string[] = [];
  if (!lab3Config.studentId) missing.push('IO107_STUDENT_ID');
  try { execSync('aws --version', { stdio: 'ignore' }); } catch { missing.push('aws CLI v2 on PATH'); }
  try { execSync('git --version', { stdio: 'ignore' }); } catch { missing.push('git on PATH'); }
  return { ok: missing.length === 0, missing };
}
