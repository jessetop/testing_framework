/**
 * Terraform Day 3 — Lab 3: Pipeline Operations
 *
 * Deploys CodePipeline + CodeBuild + CodeCommit Terraform CI/CD stack with
 * manual approval gates. Promotes through staging (us-east-2) → prod (us-west-2).
 *
 * Heavy AWS Console interaction in the lab as written. The test prefers
 * aws-cli equivalents (codepipeline get-pipeline-state, put-approval-result,
 * logs filter-log-events) but Playwright + AWS Console fallback is available.
 *
 * SHARED with lab1: TERRAFORM_STUDENT_ID, AWS_PROFILE.
 * THIS LAB IS MULTI-REGION: staging us-east-2, prod us-west-2.
 */

import * as path from 'path';
import { lab1Config, requirements, jqAvailable } from './lab1.config';
import inventory from '../lab3.inventory';

export const lab3Config = {
  studentId: lab1Config.studentId,
  awsProfile: lab1Config.awsProfile,
  /** Pipeline + CodeCommit live in the lab1 state bucket's region. */
  region: lab1Config.region,

  stagingRegion: 'us-east-2',
  prodRegion: 'us-west-2',

  get workspaceRoot(): string {
    return path.resolve(__dirname, '..', '..', '..', 'test-results', 'terraform-lab3', this.studentId || 'unset');
  },
  get repoDir(): string {
    return path.join(this.workspaceRoot, 'Advanced_Terraform');
  },
  get pipelineDir(): string {
    return path.join(this.repoDir, 'lab3', 'pipeline');
  },
  get appRepoSource(): string {
    return path.join(this.repoDir, 'lab3', 'app-repo');
  },
  get webappRepoClone(): string {
    return path.join(this.workspaceRoot, 'webapp-repo');
  },

  repoUrl: 'https://github.com/AWSClassroom-com/Advanced_Terraform.git',

  /** Pipeline approval polling — pipeline can take 60-120s per stage. */
  approvalPollMs: 5_000,
  approvalTimeoutMs: 15 * 60_000,
};

export function validateConfig() {
  const missing: string[] = [];
  const toolFailures: string[] = [];
  const warnings: string[] = [];

  if (!lab3Config.studentId) missing.push('TERRAFORM_STUDENT_ID');

  for (const req of requirements) {
    const r = req.check();
    if (!r.ok) {
      const msg = `${req.name}: ${r.detail}\n        Fix: ${req.howToFix}`;
      if (req.optional) warnings.push(msg);
      else toolFailures.push(msg);
    }
  }

  return { valid: missing.length === 0 && toolFailures.length === 0, missing, toolFailures, warnings };
}

export { inventory };
export { jqAvailable };
