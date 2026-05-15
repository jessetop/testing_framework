/**
 * Terraform Day 3 — Lab 1: State Backend Setup & Locking Demo
 *
 * TEST STRATEGY
 * -------------
 * Students run this lab on a provided EC2 instance. The TEST runs it on the
 * tester's local machine — we only need AWS CLI access plus a local Terraform
 * binary. Resources still land in the shared AWS lab account, namespaced by
 * student ID, and get destroyed at the end of the test run.
 *
 * MANUAL INPUTS (environment variables)
 * -------------------------------------
 * - TERRAFORM_STUDENT_ID  (required)  Use a high number to avoid colliding
 *                                     with real students, e.g. "student99".
 * - AWS_PROFILE           (optional)  Defaults to "roitraining".
 * - AWS_REGION            (optional)  Defaults to "us-east-1".
 *
 * LOCAL TOOLING (checked by validateConfig)
 * -----------------------------------------
 * - terraform >= 1.5
 * - aws CLI v2 with the configured profile usable
 */

import { execSync } from 'child_process';
import * as path from 'path';

export const lab1Config = {
  studentId: process.env.TERRAFORM_STUDENT_ID || '',
  awsProfile: process.env.AWS_PROFILE || 'roitraining',
  awsRegion: process.env.AWS_REGION || 'us-east-1',

  // Where the test writes .tf files and runs terraform. Per-student so two
  // testers running side-by-side don't collide.
  get workspaceRoot(): string {
    return path.resolve(
      __dirname,
      '..',
      '..',
      '..',
      'test-results',
      'terraform-lab1',
      this.studentId || 'unset',
    );
  },

  // Resource names mirror the lab markdown's `${var.student_id}-...` pattern.
  get stateBucketName(): string {
    return `${this.studentId}-terraform-state`;
  },
  get lockTableName(): string {
    return `${this.studentId}-terraform-lock`;
  },

  stateKeys: {
    stagingEast: 'staging/us-east-1/demo-app/terraform.tfstate',
    stagingWest: 'staging/us-west-2/demo-app/terraform.tfstate',
  },

  ssmParameters: {
    east: '/{studentId}/staging/demo-parameter',
    west: '/{studentId}/staging/demo-parameter',  // same logical name, different region
    eastSecond: '/{studentId}/staging/demo-parameter-2',
  },

  // Locking demo expectations (Part 4)
  locking: {
    sleepSeconds: 30,
    lockErrorMatch: /Error acquiring the state lock|ConditionalCheckFailedException/i,
  },

  // Cleanup ordering — destroy in reverse of create.
  cleanupOrder: ['staging-app-west', 'staging-app', 'state-infra'] as const,
};

export interface ToolRequirement {
  name: string;
  check: () => { ok: boolean; detail: string };
  howToFix: string;
}

/** Local-machine tooling the test cannot proceed without. */
export const requirements: ToolRequirement[] = [
  {
    name: 'terraform >= 1.5',
    check: () => {
      try {
        const out = execSync('terraform version', { encoding: 'utf8' }).split('\n')[0];
        const m = out.match(/Terraform v(\d+)\.(\d+)/);
        if (!m) return { ok: false, detail: `unexpected output: ${out}` };
        const [, maj, min] = m;
        const ok = parseInt(maj, 10) > 1 || (parseInt(maj, 10) === 1 && parseInt(min, 10) >= 5);
        return { ok, detail: out };
      } catch (e) {
        return { ok: false, detail: 'terraform binary not found on PATH' };
      }
    },
    howToFix: 'Install Terraform 1.5+ from https://developer.hashicorp.com/terraform/install',
  },
  {
    name: 'aws CLI v2',
    check: () => {
      try {
        const out = execSync('aws --version', { encoding: 'utf8' }).trim();
        const ok = /aws-cli\/2\./.test(out);
        return { ok, detail: out };
      } catch (e) {
        return { ok: false, detail: 'aws binary not found on PATH' };
      }
    },
    howToFix: 'Install AWS CLI v2 from https://aws.amazon.com/cli/',
  },
  {
    name: `aws profile "${lab1Config.awsProfile}" can authenticate`,
    check: () => {
      try {
        const out = execSync(
          `aws sts get-caller-identity --profile ${lab1Config.awsProfile}`,
          { encoding: 'utf8' },
        ).trim();
        return { ok: out.includes('Account'), detail: out };
      } catch (e: any) {
        return { ok: false, detail: e.message?.split('\n')[0] || 'sts get-caller-identity failed' };
      }
    },
    howToFix: `Configure the profile: aws configure --profile ${lab1Config.awsProfile}`,
  },
];

export function validateConfig(): { valid: boolean; missing: string[]; toolFailures: string[] } {
  const missing: string[] = [];
  const toolFailures: string[] = [];

  if (!lab1Config.studentId) {
    missing.push('TERRAFORM_STUDENT_ID - e.g. "student99" (use a high number to avoid colliding with real students)');
  } else if (!/^student\d+$/.test(lab1Config.studentId)) {
    missing.push(`TERRAFORM_STUDENT_ID format invalid ("${lab1Config.studentId}") — must match /^student\\d+$/`);
  }

  for (const req of requirements) {
    const result = req.check();
    if (!result.ok) {
      toolFailures.push(`${req.name}: ${result.detail}\n        Fix: ${req.howToFix}`);
    }
  }

  return {
    valid: missing.length === 0 && toolFailures.length === 0,
    missing,
    toolFailures,
  };
}

export function printSetupInstructions(): void {
  console.log(`
╔════════════════════════════════════════════════════════════════════╗
║           TERRAFORM LAB 1: SETUP REQUIRED                          ║
╠════════════════════════════════════════════════════════════════════╣
║                                                                    ║
║  Environment variables:                                            ║
║    TERRAFORM_STUDENT_ID   (required, e.g. "student99")             ║
║    AWS_PROFILE            (optional, default "roitraining")        ║
║    AWS_REGION             (optional, default "us-east-1")          ║
║                                                                    ║
║  Local tooling required:                                           ║
║    - terraform >= 1.5  (https://developer.hashicorp.com/terraform) ║
║    - aws CLI v2 with the configured profile                        ║
║                                                                    ║
║  Example:                                                          ║
║    export TERRAFORM_STUDENT_ID="student99"                         ║
║    npm test -- --grep "Terraform Lab 1"                            ║
║                                                                    ║
╚════════════════════════════════════════════════════════════════════╝
  `);
}
