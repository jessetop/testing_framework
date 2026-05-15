/**
 * Terraform Day 3 — Lab 1: Multi-Environment State Strategy
 *
 * Lab tests workspaces + workspace safety guards + cross-state dependencies +
 * S3 native locking. CLI-driven; the tester clones the Advanced_Terraform lab
 * repo locally and runs terraform against the shared AWS account.
 *
 * MANUAL INPUTS (environment variables)
 * -------------------------------------
 * - TERRAFORM_STUDENT_ID  (required)  e.g. "student99" — high number to avoid
 *                                     colliding with real students.
 * - TERRAFORM_REGION      (optional)  Default "us-east-2". Lab is region-flexible
 *                                     but the bucket is created here.
 * - AWS_PROFILE           (optional)  Defaults to "roitraining".
 *
 * LOCAL TOOLING (checked by validateConfig)
 * -----------------------------------------
 * - terraform >= 1.10
 * - aws CLI v2 with the configured profile usable
 * - git
 * - jq (used by lab step 24 for state inspection)
 */

import { execSync } from 'child_process';
import * as path from 'path';

export const lab1Config = {
  studentId: process.env.TERRAFORM_STUDENT_ID || '',
  awsProfile: process.env.AWS_PROFILE || 'roitraining',
  // Default us-east-1 because the lab repo's providers.tf hardcodes
  // `region = "us-east-1"` in the provider block (not just backend).
  // If you set TERRAFORM_REGION to anything else, the test will also patch the
  // provider region in setProviderRegion().
  region: process.env.TERRAFORM_REGION || 'us-east-1',

  /** Where the test clones the lab repo and runs terraform. */
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

  get repoDir(): string {
    return path.join(this.workspaceRoot, 'Advanced_Terraform');
  },
  get stateInfraDir(): string {
    return path.join(this.repoDir, 'lab1', 'state-infra');
  },
  get networkingDir(): string {
    return path.join(this.repoDir, 'lab1', 'networking');
  },
  get directoriesDir(): string {
    return path.join(this.repoDir, 'lab1', 'directories');
  },

  /** File where the state bucket name is persisted across tests (captured from
   *  `terraform output -raw state_bucket_name` in Step 12). Used by later steps
   *  + cleanup if the test crashes and resumes. */
  get capturedBucketFile(): string {
    return path.join(this.workspaceRoot, '.captured-state-bucket');
  },

  repoUrl: 'https://github.com/AWSClassroom-com/Advanced_Terraform.git',

  workspaces: ['dev', 'staging', 'prod'] as const,
  featureWorkspace: 'feature-login-fix',
};

export interface ToolRequirement {
  name: string;
  check: () => { ok: boolean; detail: string };
  howToFix: string;
  /** Optional tools: missing → warn but don't block; required: missing → fail preflight. */
  optional?: boolean;
}

export const requirements: ToolRequirement[] = [
  {
    name: 'terraform >= 1.10',
    check: () => {
      try {
        const out = execSync('terraform version', { encoding: 'utf8' }).split('\n')[0];
        const m = out.match(/Terraform v(\d+)\.(\d+)/);
        if (!m) return { ok: false, detail: `unexpected output: ${out}` };
        const [, maj, min] = m;
        const ok = parseInt(maj, 10) > 1 || (parseInt(maj, 10) === 1 && parseInt(min, 10) >= 10);
        return { ok, detail: out };
      } catch {
        return { ok: false, detail: 'terraform binary not found on PATH' };
      }
    },
    howToFix: 'Install Terraform 1.10+ — required for S3 native locking (use_lockfile = true)',
  },
  {
    name: 'aws CLI v2',
    check: () => {
      try {
        const out = execSync('aws --version', { encoding: 'utf8' }).trim();
        return { ok: /aws-cli\/2\./.test(out), detail: out };
      } catch {
        return { ok: false, detail: 'aws not found on PATH' };
      }
    },
    howToFix: 'Install AWS CLI v2 from https://aws.amazon.com/cli/',
  },
  {
    name: 'git',
    check: () => {
      try {
        const out = execSync('git --version', { encoding: 'utf8' }).trim();
        return { ok: out.startsWith('git version'), detail: out };
      } catch {
        return { ok: false, detail: 'git not found on PATH' };
      }
    },
    howToFix: 'Install Git from https://git-scm.com',
  },
  {
    name: 'jq',
    optional: true,
    check: () => {
      try {
        const out = execSync('jq --version', { encoding: 'utf8' }).trim();
        return { ok: /^jq-/.test(out), detail: out };
      } catch {
        return { ok: false, detail: 'jq not found on PATH (Step 24 will skip)' };
      }
    },
    howToFix: 'Install jq from https://stedolan.github.io/jq/ (Windows: choco install jq, or download exe)',
  },
  {
    name: `aws profile "${lab1Config.awsProfile}" authenticates`,
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

export function validateConfig(): { valid: boolean; missing: string[]; toolFailures: string[]; warnings: string[] } {
  const missing: string[] = [];
  const toolFailures: string[] = [];
  const warnings: string[] = [];

  if (!lab1Config.studentId) {
    missing.push('TERRAFORM_STUDENT_ID — e.g. "student99"');
  } else if (!/^student\d+$/.test(lab1Config.studentId)) {
    missing.push(`TERRAFORM_STUDENT_ID format invalid ("${lab1Config.studentId}") — expected /^student\\d+$/`);
  }

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

export function jqAvailable(): boolean {
  try {
    execSync('jq --version', { encoding: 'utf8', stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

export function printSetupInstructions(): void {
  console.log(`
╔════════════════════════════════════════════════════════════════════╗
║      TERRAFORM LAB 1 — Multi-Environment State Strategy            ║
╠════════════════════════════════════════════════════════════════════╣
║  Environment variables:                                            ║
║    TERRAFORM_STUDENT_ID   (required, e.g. "student99")             ║
║    TERRAFORM_REGION       (optional, default "us-east-2")          ║
║    AWS_PROFILE            (optional, default "roitraining")        ║
║                                                                    ║
║  Local tooling required:                                           ║
║    - terraform >= 1.10  (for S3 native locking)                    ║
║    - aws CLI v2                                                    ║
║    - git                                                           ║
║    - jq                                                            ║
║                                                                    ║
║  Run: npx playwright test courses/terraform/tests/lab1-multi-env-state.spec.ts
║                                                                    ║
╚════════════════════════════════════════════════════════════════════╝
  `);
}
