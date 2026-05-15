/**
 * Terraform Day 3 — Lab 2: Import Day 1-2 Infrastructure into Remote State
 *
 * Imports an existing VPC + supporting resources (created either by Lab 1's
 * lean fallback or by a prior Day 1-2 lab) into Terraform state. Tests
 * `terraform import` blocks, prevent_destroy lifecycle, and config-from-state.
 *
 * SHARED with lab1: TERRAFORM_STUDENT_ID, AWS_PROFILE, TERRAFORM_REGION.
 * See lab1.config.ts for the canonical requirements check pattern.
 */

import * as path from 'path';
import { lab1Config, requirements, jqAvailable } from './lab1.config';
import inventory from '../lab2.inventory';

export const lab2Config = {
  studentId: lab1Config.studentId,
  awsProfile: lab1Config.awsProfile,
  region: lab1Config.region,

  get workspaceRoot(): string {
    return path.resolve(__dirname, '..', '..', '..', 'test-results', 'terraform-lab2', this.studentId || 'unset');
  },
  get repoDir(): string {
    return path.join(this.workspaceRoot, 'Advanced_Terraform');
  },
  get importDir(): string {
    return path.join(this.repoDir, 'lab2', 'import');
  },
  get generateConfigDemoDir(): string {
    return path.join(this.repoDir, 'lab2', 'import', 'generate-config-demo');
  },
  get fallbackVpcDir(): string {
    return path.join(this.repoDir, 'lab2', 'day1-vpc-lean');
  },

  repoUrl: 'https://github.com/AWSClassroom-com/Advanced_Terraform.git',

  /** State key in S3 for this lab (separate from Lab 1's). */
  stateKey: 'imported/terraform.tfstate',

  /** Lab 1 must have run first — its state bucket is reused. */
  requiresFromLab1: ['state_bucket_name'],
};

export function validateConfig() {
  const missing: string[] = [];
  const toolFailures: string[] = [];
  const warnings: string[] = [];

  if (!lab2Config.studentId) missing.push('TERRAFORM_STUDENT_ID');

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
