/**
 * IO-107 Lab 4 — Aurora Blue/Green Deployment via Terraform + Pipeline.
 *
 * Longest test (~20 min wall-clock). The Blue/Green flow includes:
 *   - terraform plan against the engine_version_target marker
 *   - manual approval gate (the test approves programmatically)
 *   - buildspec invokes aws rds create-blue-green-deployment in apply phase
 */

import { execSync } from 'child_process';
import * as path from 'path';
import { LAB_ENV_TF_PATH } from '../lab-source';

export const lab4Config = {
  studentId: process.env.IO107_STUDENT_ID || '',
  awsProfile: process.env.AWS_PROFILE || 'roitraining',
  region: process.env.IO107_REGION || 'us-east-1',
  labEnvTfDir: process.env.LAB_ENV_TF_DIR || LAB_ENV_TF_PATH,

  get workspaceRoot(): string { return path.resolve(__dirname, '..', '..', '..', 'test-results', 'io107-lab4', this.studentId || 'unset'); },
  get repoDir(): string { return path.join(this.workspaceRoot, 'student-repo'); },
  get tfOutputsFile(): string { return path.join(this.workspaceRoot, '.tf-outputs.json'); },
  get pipelineName(): string { return `io107-${this.studentId}-lab4`; },
  get codebuildProjectName(): string { return `io107-${this.studentId}-lab4-build`; },
  get auroraClusterId(): string { return `io107-${this.studentId}-lab4-aurora`; },

  // Current Aurora PostgreSQL minor versions as of 2026-Q2.
  // 16.x is the active major; 15.x is partially deprecated. Both From and To
  // must be on the engine_version_pin.rego approved list.
  targetEngineVersionFrom: '16.11',
  targetEngineVersionTo: '16.13',
};

export function validateConfig() {
  const missing: string[] = [];
  if (!lab4Config.studentId) missing.push('IO107_STUDENT_ID');
  try { execSync('aws --version', { stdio: 'ignore' }); } catch { missing.push('aws CLI v2'); }
  try { execSync('git --version', { stdio: 'ignore' }); } catch { missing.push('git'); }
  return { ok: missing.length === 0, missing };
}
