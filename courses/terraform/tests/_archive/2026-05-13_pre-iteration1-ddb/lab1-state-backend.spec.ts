/**
 * Terraform Day 3 — Lab 1: State Backend Setup & Locking Demo
 *
 * Pure CLI test. Drives `terraform` and `aws` locally. Resources land in the
 * shared AWS account namespaced by TERRAFORM_STUDENT_ID. Always cleans up
 * in afterAll, regardless of test outcome.
 *
 * Lab markdown:
 *   I:/My Drive/CourseCreationKit/courses/Terraform_Day_3/04-lab-part1-state-backend.md
 */

import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { lab1Config, validateConfig, printSetupInstructions } from './lab1.config';
import { tf, tfAsync, awsCli, awsJson, assertOk } from '../helpers/terraform-runner';
import { emptyVersionedBucket, tfDestroy, findLeakedResources, logDestroyOutcome } from '../helpers/cleanup';

// Slow because terraform apply / destroy can take a minute or two.
test.setTimeout(180_000);

// ──────────────────────────────────────────────────────────────────────────
// Module-level shared state. Spec runs single-threaded (workers=1 default
// for this file given the resource collision potential).
// ──────────────────────────────────────────────────────────────────────────
const stateInfraDir = () => path.join(lab1Config.workspaceRoot, 'lab1-state');
const stagingAppDir = () => path.join(lab1Config.workspaceRoot, 'staging-app');
const stagingAppWestDir = () => path.join(lab1Config.workspaceRoot, 'staging-app-west');

const seen = {
  s3Versioning: false,
  dynamodb: false,
  eastStateInS3: false,
  westStateInS3: false,
  lockObserved: false,
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function studentReplace(template: string): string {
  return template.replace(/studentXX/g, lab1Config.studentId);
}

// ──────────────────────────────────────────────────────────────────────────
// Terraform file templates (mirror the lab markdown verbatim, substituting
// studentXX → real student ID where the lab hardcodes it).
// ──────────────────────────────────────────────────────────────────────────

const STATE_INFRASTRUCTURE_TF = `
terraform {
  required_version = ">= 1.5.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = "us-east-1"

  default_tags {
    tags = {
      Student   = var.student_id
      Purpose   = "Terraform State Infrastructure"
      ManagedBy = "Terraform"
    }
  }
}

variable "student_id" {
  description = "Your student ID (e.g., student01)"
  type        = string
}

resource "aws_s3_bucket" "terraform_state" {
  bucket = "\${var.student_id}-terraform-state"

  lifecycle {
    prevent_destroy = false
  }

  tags = { Name = "\${var.student_id}-terraform-state" }
}

resource "aws_s3_bucket_versioning" "terraform_state" {
  bucket = aws_s3_bucket.terraform_state.id
  versioning_configuration { status = "Enabled" }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "terraform_state" {
  bucket = aws_s3_bucket.terraform_state.id
  rule {
    apply_server_side_encryption_by_default { sse_algorithm = "AES256" }
  }
}

resource "aws_s3_bucket_public_access_block" "terraform_state" {
  bucket                  = aws_s3_bucket.terraform_state.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_dynamodb_table" "terraform_lock" {
  name         = "\${var.student_id}-terraform-lock"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "LockID"
  attribute {
    name = "LockID"
    type = "S"
  }
  tags = { Name = "\${var.student_id}-terraform-lock" }
}

output "state_bucket_name" { value = aws_s3_bucket.terraform_state.id }
output "lock_table_name"   { value = aws_dynamodb_table.terraform_lock.name }
`;

const STAGING_BACKEND_TF = (timeProvider: boolean) => studentReplace(`
terraform {
  required_version = ">= 1.5.0"

  backend "s3" {
    bucket         = "studentXX-terraform-state"
    key            = "staging/us-east-1/demo-app/terraform.tfstate"
    region         = "us-east-1"
    encrypt        = true
    dynamodb_table = "studentXX-terraform-lock"
  }

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }${timeProvider ? `
    time = {
      source  = "hashicorp/time"
      version = "~> 0.9"
    }` : ''}
  }
}

provider "aws" {
  region = "us-east-1"

  default_tags {
    tags = {
      Student     = "studentXX"
      Environment = "staging"
      ManagedBy   = "Terraform"
    }
  }
}
`);

const STAGING_MAIN_BASIC_TF = studentReplace(`
resource "aws_ssm_parameter" "demo" {
  name        = "/studentXX/staging/demo-parameter"
  description = "Demo parameter to test state management"
  type        = "String"
  value       = "Hello from staging environment!"

  tags = { Name = "studentXX-staging-demo" }
}

output "parameter_name" { value = aws_ssm_parameter.demo.name }
output "parameter_arn"  { value = aws_ssm_parameter.demo.arn  }
`);

const STAGING_MAIN_WITH_SLEEP_TF = studentReplace(`
resource "aws_ssm_parameter" "demo" {
  name        = "/studentXX/staging/demo-parameter"
  description = "Demo parameter to test state management"
  type        = "String"
  value       = "Hello from staging environment!"

  tags = { Name = "studentXX-staging-demo" }
}

resource "time_sleep" "wait" {
  depends_on      = [aws_ssm_parameter.demo]
  create_duration = "${lab1Config.locking.sleepSeconds}s"
}

resource "aws_ssm_parameter" "demo2" {
  depends_on  = [time_sleep.wait]
  name        = "/studentXX/staging/demo-parameter-2"
  description = "Second parameter created after delay"
  type        = "String"
  value       = "Created after wait!"
}

output "parameter_name" { value = aws_ssm_parameter.demo.name }
output "parameter_arn"  { value = aws_ssm_parameter.demo.arn  }
`);

const STAGING_WEST_BACKEND_TF = studentReplace(`
terraform {
  required_version = ">= 1.5.0"

  backend "s3" {
    bucket         = "studentXX-terraform-state"
    key            = "staging/us-west-2/demo-app/terraform.tfstate"
    region         = "us-east-1"
    encrypt        = true
    dynamodb_table = "studentXX-terraform-lock"
  }

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = "us-west-2"

  default_tags {
    tags = {
      Student     = "studentXX"
      Environment = "staging"
      Region      = "us-west-2"
      ManagedBy   = "Terraform"
    }
  }
}
`);

const STAGING_WEST_MAIN_TF = studentReplace(`
resource "aws_ssm_parameter" "demo" {
  name        = "/studentXX/staging/demo-parameter"
  description = "Demo parameter in us-west-2"
  type        = "String"
  value       = "Hello from staging us-west-2!"

  tags = { Name = "studentXX-staging-demo-west" }
}

output "parameter_name" { value = aws_ssm_parameter.demo.name }
output "region"         { value = "us-west-2" }
`);

// ──────────────────────────────────────────────────────────────────────────
test.describe.configure({ mode: 'serial' });
test.describe('Terraform Lab 1: State Backend Setup & Locking Demo', () => {
  test.beforeAll(async () => {
    const { valid, missing, toolFailures } = validateConfig();
    if (!valid) {
      printSetupInstructions();
      const lines = [
        ...missing.map((m) => `  - ${m}`),
        ...toolFailures.map((t) => `  - ${t}`),
      ];
      throw new Error(`Lab 1 prerequisites not met:\n${lines.join('\n')}`);
    }
    fs.mkdirSync(lab1Config.workspaceRoot, { recursive: true });
    console.log(`\nWorkspace: ${lab1Config.workspaceRoot}`);
    console.log(`Student ID: ${lab1Config.studentId}`);
    console.log(`AWS profile: ${lab1Config.awsProfile}\n`);
  });

  test.afterAll(async () => {
    console.log('\n── Cleanup ───────────────────────────────────────────');
    logDestroyOutcome('staging-app-west', tfDestroy(stagingAppWestDir()));
    logDestroyOutcome('staging-app', tfDestroy(stagingAppDir()));
    const emptied = emptyVersionedBucket(lab1Config.stateBucketName, lab1Config.awsProfile);
    console.log(`  S3 bucket purge: ${emptied ? 'done' : 'not present'}`);
    logDestroyOutcome('lab1-state', tfDestroy(stateInfraDir()));

    const leaks = findLeakedResources(
      lab1Config.stateBucketName,
      lab1Config.lockTableName,
      lab1Config.awsProfile,
    );
    if (leaks.length > 0) {
      console.log(`  ⚠ Leaked resources still present: ${leaks.join(', ')}`);
    } else {
      console.log(`  ✓ All resources cleaned up`);
    }
    console.log('──────────────────────────────────────────────────────\n');
  });

  // ──────────────────────────────────────────────────────────────────────
  // Part 1 — Deploy state infrastructure
  // ──────────────────────────────────────────────────────────────────────
  test.describe('Part 1: Deploy state infrastructure', () => {
    test('Step 1.1: Create working directory', async () => {
      fs.mkdirSync(stateInfraDir(), { recursive: true });
      expect(fs.existsSync(stateInfraDir())).toBe(true);
    });

    test('Step 1.2: Write state-infrastructure.tf', async () => {
      const file = path.join(stateInfraDir(), 'state-infrastructure.tf');
      fs.writeFileSync(file, STATE_INFRASTRUCTURE_TF);
      expect(fs.statSync(file).size).toBeGreaterThan(500);
    });

    test('Step 1.3: Write terraform.tfvars', async () => {
      const file = path.join(stateInfraDir(), 'terraform.tfvars');
      fs.writeFileSync(file, `student_id = "${lab1Config.studentId}"\n`);
      const content = fs.readFileSync(file, 'utf8');
      expect(content).toContain(lab1Config.studentId);
    });

    test('Step 1.4: terraform init + plan + apply', async () => {
      const initR = tf(['init', '-no-color'], { cwd: stateInfraDir() });
      assertOk(initR, 'terraform init (state-infra)');

      const planR = tf(['plan', '-no-color'], {
        cwd: stateInfraDir(),
        env: { AWS_PROFILE: lab1Config.awsProfile },
      });
      assertOk(planR, 'terraform plan (state-infra)');
      expect(planR.stdout).toMatch(/5 to add/);

      const applyR = tf(['apply', '-auto-approve', '-no-color'], {
        cwd: stateInfraDir(),
        env: { AWS_PROFILE: lab1Config.awsProfile },
      });
      assertOk(applyR, 'terraform apply (state-infra)');
      expect(applyR.stdout).toMatch(/Apply complete! Resources: 5 added/);
    });

    test('Step 1.5: Verify S3 bucket + DynamoDB table exist', async () => {
      const versioning = awsCli(
        ['s3api', 'get-bucket-versioning', '--bucket', lab1Config.stateBucketName],
        lab1Config.awsProfile,
      );
      assertOk(versioning, 'get-bucket-versioning');
      const vJson = JSON.parse(versioning.stdout);
      expect(vJson.Status).toBe('Enabled');
      seen.s3Versioning = true;

      const encryption = awsCli(
        ['s3api', 'get-bucket-encryption', '--bucket', lab1Config.stateBucketName],
        lab1Config.awsProfile,
      );
      assertOk(encryption, 'get-bucket-encryption');
      expect(encryption.stdout).toContain('AES256');

      const pab = awsCli(
        ['s3api', 'get-public-access-block', '--bucket', lab1Config.stateBucketName],
        lab1Config.awsProfile,
      );
      assertOk(pab, 'get-public-access-block');
      const pabJson = JSON.parse(pab.stdout).PublicAccessBlockConfiguration;
      expect(pabJson.BlockPublicAcls).toBe(true);
      expect(pabJson.BlockPublicPolicy).toBe(true);
      expect(pabJson.IgnorePublicAcls).toBe(true);
      expect(pabJson.RestrictPublicBuckets).toBe(true);

      const table = awsCli(
        ['dynamodb', 'describe-table', '--table-name', lab1Config.lockTableName],
        lab1Config.awsProfile,
      );
      assertOk(table, 'describe-table');
      const tJson = JSON.parse(table.stdout).Table;
      expect(tJson.TableStatus).toBe('ACTIVE');
      expect(tJson.KeySchema[0].AttributeName).toBe('LockID');
      seen.dynamodb = true;
    });
  });

  // ──────────────────────────────────────────────────────────────────────
  // Part 2 — Configure backend for staging
  // ──────────────────────────────────────────────────────────────────────
  test.describe('Part 2: Configure backend for staging', () => {
    test('Step 2.1: Create staging-app directory', async () => {
      fs.mkdirSync(stagingAppDir(), { recursive: true });
      expect(fs.existsSync(stagingAppDir())).toBe(true);
    });

    test('Step 2.2: Write backend.tf', async () => {
      const file = path.join(stagingAppDir(), 'backend.tf');
      fs.writeFileSync(file, STAGING_BACKEND_TF(false));
      const content = fs.readFileSync(file, 'utf8');
      expect(content).toContain(`bucket         = "${lab1Config.stateBucketName}"`);
      expect(content).toContain('staging/us-east-1/demo-app/terraform.tfstate');
    });

    test('Step 2.3: Write main.tf (SSM parameter resource)', async () => {
      const file = path.join(stagingAppDir(), 'main.tf');
      fs.writeFileSync(file, STAGING_MAIN_BASIC_TF);
      const content = fs.readFileSync(file, 'utf8');
      expect(content).toContain(`/${lab1Config.studentId}/staging/demo-parameter`);
    });

    test('Step 2.4: terraform init (configures remote backend)', async () => {
      const initR = tf(['init', '-no-color'], {
        cwd: stagingAppDir(),
        env: { AWS_PROFILE: lab1Config.awsProfile },
      });
      assertOk(initR, 'terraform init (staging-app)');
      expect(initR.stdout).toMatch(/Successfully configured the backend "s3"/);
    });

    test('Step 2.5: terraform apply + verify state in S3', async () => {
      const applyR = tf(['apply', '-auto-approve', '-no-color'], {
        cwd: stagingAppDir(),
        env: { AWS_PROFILE: lab1Config.awsProfile },
      });
      assertOk(applyR, 'terraform apply (staging-app)');
      expect(applyR.stdout).toMatch(/Apply complete!/);

      const ls = awsCli(
        ['s3api', 'list-objects-v2', '--bucket', lab1Config.stateBucketName, '--prefix', 'staging/us-east-1/'],
        lab1Config.awsProfile,
      );
      assertOk(ls, 'list-objects-v2 (east)');
      expect(ls.stdout).toContain('staging/us-east-1/demo-app/terraform.tfstate');
      seen.eastStateInS3 = true;
    });

    test('Step 2.6: Examine state file structure', async () => {
      const cp = awsCli(
        ['s3api', 'get-object', '--bucket', lab1Config.stateBucketName,
          '--key', lab1Config.stateKeys.stagingEast,
          path.join(stagingAppDir(), '_state-fetch.json'),
          '--output', 'text'],  // override default json output for binary fetch
        lab1Config.awsProfile,
      );
      assertOk(cp, 'get-object (east state)');
      const stateJson = JSON.parse(fs.readFileSync(path.join(stagingAppDir(), '_state-fetch.json'), 'utf8'));
      expect(stateJson.version).toBeGreaterThan(0);
      expect(stateJson.terraform_version).toMatch(/^\d+\.\d+/);
      expect(Array.isArray(stateJson.resources)).toBe(true);
      expect(stateJson.resources.length).toBeGreaterThan(0);
      expect(stateJson.outputs).toBeDefined();
    });
  });

  // ──────────────────────────────────────────────────────────────────────
  // Part 3 — Multi-region state structure
  // ──────────────────────────────────────────────────────────────────────
  test.describe('Part 3: Multi-region state structure', () => {
    test('Step 3.1: Write us-west-2 backend.tf + main.tf', async () => {
      fs.mkdirSync(stagingAppWestDir(), { recursive: true });
      fs.writeFileSync(path.join(stagingAppWestDir(), 'backend.tf'), STAGING_WEST_BACKEND_TF);
      fs.writeFileSync(path.join(stagingAppWestDir(), 'main.tf'), STAGING_WEST_MAIN_TF);
      const backend = fs.readFileSync(path.join(stagingAppWestDir(), 'backend.tf'), 'utf8');
      expect(backend).toContain('staging/us-west-2/demo-app/terraform.tfstate');
      expect(backend).toContain('region = "us-west-2"');
    });

    test('Step 3.2: terraform init + apply for us-west-2', async () => {
      const initR = tf(['init', '-no-color'], {
        cwd: stagingAppWestDir(),
        env: { AWS_PROFILE: lab1Config.awsProfile },
      });
      assertOk(initR, 'terraform init (staging-app-west)');

      const applyR = tf(['apply', '-auto-approve', '-no-color'], {
        cwd: stagingAppWestDir(),
        env: { AWS_PROFILE: lab1Config.awsProfile },
      });
      assertOk(applyR, 'terraform apply (staging-app-west)');
    });

    test('Step 3.3: Verify both state files exist in S3', async () => {
      const ls = awsCli(
        ['s3api', 'list-objects-v2', '--bucket', lab1Config.stateBucketName, '--prefix', 'staging/'],
        lab1Config.awsProfile,
      );
      assertOk(ls, 'list-objects-v2 (staging)');
      const keys = (JSON.parse(ls.stdout).Contents || []).map((o: any) => o.Key);
      expect(keys).toContain(lab1Config.stateKeys.stagingEast);
      expect(keys).toContain(lab1Config.stateKeys.stagingWest);
      seen.westStateInS3 = true;
    });
  });

  // ──────────────────────────────────────────────────────────────────────
  // Part 4 — Locking demonstration
  // ──────────────────────────────────────────────────────────────────────
  test.describe('Part 4: Locking demonstration', () => {
    test('Step 4.1: Add time_sleep + demo2 resource (init -upgrade)', async () => {
      fs.writeFileSync(path.join(stagingAppDir(), 'backend.tf'), STAGING_BACKEND_TF(true));
      fs.writeFileSync(path.join(stagingAppDir(), 'main.tf'), STAGING_MAIN_WITH_SLEEP_TF);
      const initR = tf(['init', '-upgrade', '-no-color'], {
        cwd: stagingAppDir(),
        env: { AWS_PROFILE: lab1Config.awsProfile },
      });
      assertOk(initR, 'terraform init -upgrade (locking demo)');
      expect(initR.stdout).toMatch(/hashicorp\/time/);
    });

    test('Step 4.3 + 4.5 + 4.6: lock conflict + DDB visibility + release', async () => {
      // Kick off the first apply asynchronously. It will hold the lock for ~30s
      // because of the time_sleep resource.
      const firstApply = tfAsync(['apply', '-auto-approve', '-no-color'], {
        cwd: stagingAppDir(),
        env: { AWS_PROFILE: lab1Config.awsProfile },
      });

      // Wait long enough for the lock to be acquired before racing.
      await sleep(4000);

      // (4.5) Lock should be visible in DynamoDB while the first apply is running.
      const lockScan = awsCli(
        ['dynamodb', 'scan', '--table-name', lab1Config.lockTableName],
        lab1Config.awsProfile,
      );
      assertOk(lockScan, 'dynamodb scan (lock visible)');
      const scanResult = JSON.parse(lockScan.stdout);
      expect(scanResult.Count).toBeGreaterThanOrEqual(1);
      const lockIds = (scanResult.Items || []).map((i: any) => i.LockID?.S || '');
      expect(lockIds.some((id: string) => id.includes(lab1Config.stateKeys.stagingEast))).toBe(true);
      seen.lockObserved = true;

      // (4.3) Second apply should fail to acquire the lock.
      const secondApply = tf(['apply', '-auto-approve', '-no-color', '-lock-timeout=0s'], {
        cwd: stagingAppDir(),
        env: { AWS_PROFILE: lab1Config.awsProfile },
        timeoutMs: 60_000,
      });
      expect(secondApply.exitCode).not.toBe(0);
      const combined = `${secondApply.stdout}\n${secondApply.stderr}`;
      expect(combined).toMatch(lab1Config.locking.lockErrorMatch);

      // (4.6) Wait for the first apply to finish, then verify the lock is gone.
      const firstExit = await firstApply.exitPromise;
      expect(firstExit).toBe(0);

      const lockScanAfter = awsCli(
        ['dynamodb', 'scan', '--table-name', lab1Config.lockTableName],
        lab1Config.awsProfile,
      );
      assertOk(lockScanAfter, 'dynamodb scan (lock released)');
      expect(JSON.parse(lockScanAfter.stdout).Count).toBe(0);
    });
  });

  // ──────────────────────────────────────────────────────────────────────
  // Part 5 — Verify checkpoints from the lab's "Verify Your Work" list
  // ──────────────────────────────────────────────────────────────────────
  test.describe('Part 5: Verify checkpoints', () => {
    test('S3 versioning + DynamoDB + both state files + locking observed', async () => {
      expect(seen.s3Versioning).toBe(true);
      expect(seen.dynamodb).toBe(true);
      expect(seen.eastStateInS3).toBe(true);
      expect(seen.westStateInS3).toBe(true);
      expect(seen.lockObserved).toBe(true);
    });
  });
});
