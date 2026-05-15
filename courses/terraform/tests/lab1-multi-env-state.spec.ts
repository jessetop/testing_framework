/**
 * Terraform Day 3 — Lab 1: Multi-Environment State Strategy
 *
 * Pure CLI test driven by the inventory at `../lab1.inventory.ts`.
 * Lab markdown: labforge_iterations/iteration_1/Lab_01_Multi_Environment_State_Strategy.md
 *
 * Strategy:
 *   - Clone github.com/AWSClassroom-com/Advanced_Terraform into a per-student workspace
 *   - Execute lab steps via terraform / aws / git / jq locally
 *   - `manual-only` steps are surfaced as test.skip with a notice (counted in
 *     the report so they're visible, not hidden)
 *   - afterAll runs idempotent cleanup regardless of test outcome
 */

import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { lab1Config, validateConfig, printSetupInstructions, jqAvailable } from './lab1.config';
import { tf, awsCli, assertOk, CliResult } from '../helpers/terraform-runner';
import { emptyVersionedBucket, tfDestroy, logDestroyOutcome } from '../helpers/cleanup';
import inventory from '../lab1.inventory';

test.setTimeout(5 * 60 * 1000);  // 5 min per test (some plans/applies take a few minutes)

// ──────────────────────────────────────────────────────────────────────────
// Module-level shared state across the serial test sequence.
// ──────────────────────────────────────────────────────────────────────────
let capturedBucketName = '';
let capturedNetworkingVpcId = '';

const env = () => ({ AWS_PROFILE: lab1Config.awsProfile });

function saveBucketName(name: string): void {
  capturedBucketName = name;
  fs.writeFileSync(lab1Config.capturedBucketFile, name);
}

function loadBucketName(): string {
  if (capturedBucketName) return capturedBucketName;
  if (fs.existsSync(lab1Config.capturedBucketFile)) {
    capturedBucketName = fs.readFileSync(lab1Config.capturedBucketFile, 'utf8').trim();
    return capturedBucketName;
  }
  return '';
}

/** Helper used at the top of every manual-only step. Marks the test as
 *  intentionally skipped while surfacing the reason in the report. */
function manualOnly(stepId: string): void {
  const step = inventory.steps.find((s) => s.stepId === stepId);
  const reason = step?.notes || 'manual-only step';
  test.skip(true, `manual-only step ${stepId}: ${reason}`);
}

/** Write tfvars from a clean slate. Robust against CRLF and odd example file formatting. */
function writeTfvars(dir: string, vars: Record<string, string | undefined>): void {
  const lines = Object.entries(vars)
    .filter(([, v]) => v !== undefined && v !== '')
    .map(([k, v]) => `${k} = "${v}"`);
  fs.writeFileSync(path.join(dir, 'terraform.tfvars'), lines.join('\n') + '\n');
}

/**
 * Replace the backend "s3" block in providers.tf with a fresh, fully-specified
 * one. Handles both the commented-out form (state-infra) and the
 * already-uncommented form (networking).
 *
 * State key paths come from the repo, not the lab markdown — the two have
 * drifted, and the repo is what students actually run. Currently:
 *   state-infra: platform/state-infra/terraform.tfstate
 *   networking:  networking/terraform.tfstate
 */
const STATE_KEYS = {
  stateInfra: 'platform/state-infra/terraform.tfstate',
  networking: 'networking/terraform.tfstate',
};

function setRemoteBackend(providersTfPath: string, opts: { bucket: string; region: string; key: string }): void {
  // Normalize to LF for robust line-based processing.
  const raw = fs.readFileSync(providersTfPath, 'utf8').replace(/\r\n/g, '\n');
  const lines = raw.split('\n');

  const newBlock = [
    '  backend "s3" {',
    `    bucket       = "${opts.bucket}"`,
    `    key          = "${opts.key}"`,
    `    region       = "${opts.region}"`,
    '    encrypt      = true',
    '    use_lockfile = true',
    '  }',
  ];

  const trim = (s: string): string => s.replace(/^\s+/, '');
  const isCommentLine = (s: string): boolean => trim(s).startsWith('#');

  // 1) Look for a LIVE (non-commented) `backend "s3" {` and replace it.
  let backendStart = -1;
  let braceDepth = 0;
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (isCommentLine(l)) continue;
    if (/^\s*backend\s+"s3"\s*\{/.test(l)) {
      backendStart = i;
      braceDepth = 1;
      for (let j = i + 1; j < lines.length; j++) {
        if (isCommentLine(lines[j])) continue;
        for (const ch of lines[j]) {
          if (ch === '{') braceDepth++;
          else if (ch === '}') braceDepth--;
        }
        if (braceDepth === 0) {
          lines.splice(i, j - i + 1, ...newBlock);
          fs.writeFileSync(providersTfPath, lines.join('\n'));
          return;
        }
      }
      throw new Error(`Live backend block in ${providersTfPath} has unbalanced braces`);
    }
  }

  // 2) No live backend. Inject newBlock as the first statement inside `terraform { }`.
  for (let i = 0; i < lines.length; i++) {
    if (/^\s*terraform\s*\{/.test(lines[i]) && !isCommentLine(lines[i])) {
      lines.splice(i + 1, 0, ...newBlock);
      fs.writeFileSync(providersTfPath, lines.join('\n'));
      return;
    }
  }

  throw new Error(`No backend "s3" or terraform block found in ${providersTfPath}`);
}

function captureTfOutput(cwd: string, name: string): string {
  const r = tf(['output', '-raw', name], { cwd, env: env() });
  assertOk(r, `terraform output ${name}`);
  return r.stdout.trim();
}

function tfWorkspaceSelect(cwd: string, ws: string): CliResult {
  return tf(['workspace', 'select', ws], { cwd, env: env() });
}

function tfWorkspaceList(cwd: string): string {
  const r = tf(['workspace', 'list'], { cwd, env: env() });
  assertOk(r, 'terraform workspace list');
  return r.stdout;
}

// ──────────────────────────────────────────────────────────────────────────
test.describe.configure({ mode: 'serial' });
test.describe('Terraform Lab 1: Multi-Environment State Strategy', () => {
  test.beforeAll(async () => {
    const { valid, missing, toolFailures, warnings } = validateConfig();
    if (!valid) {
      printSetupInstructions();
      throw new Error(
        `Lab 1 prerequisites not met:\n${[...missing.map((m) => `  - ${m}`), ...toolFailures.map((t) => `  - ${t}`)].join('\n')}`,
      );
    }
    if (warnings.length > 0) {
      console.log('\n⚠ Optional tooling warnings:');
      for (const w of warnings) console.log(`  - ${w}`);
    }
    fs.mkdirSync(lab1Config.workspaceRoot, { recursive: true });
    console.log(`\nWorkspace: ${lab1Config.workspaceRoot}`);
    console.log(`Student ID: ${lab1Config.studentId}`);
    console.log(`Region: ${lab1Config.region}`);
    console.log(`AWS profile: ${lab1Config.awsProfile}`);
    console.log(`Inventory: ${inventory.steps.length} steps, ${inventory.steps.filter((s) => s.strategy === 'manual-only').length} manual-only\n`);
  });

  /** Ensure every dir terraform might run destroy in has a tfvars file with
   *  defaults, so cleanup doesn't fail on "No value for required variable"
   *  when a test bails before writeTfvars ran. */
  function ensureTfvarsExists(dir: string): void {
    if (!fs.existsSync(dir)) return;
    const tfvarsPath = path.join(dir, 'terraform.tfvars');
    if (fs.existsSync(tfvarsPath) && fs.readFileSync(tfvarsPath, 'utf8').includes('student_id')) return;
    writeTfvars(dir, {
      student_id: lab1Config.studentId,
      account: lab1Config.studentId,
      region: lab1Config.region,
    });
  }

  test.afterAll(async () => {
    console.log('\n── Cleanup ───────────────────────────────────────────');
    const bucket = loadBucketName();

    // Ensure tfvars exist so destroy doesn't fail on "No value for required variable".
    ensureTfvarsExists(lab1Config.stateInfraDir);
    ensureTfvarsExists(lab1Config.networkingDir);

    // state-infra has the bucket in its own state. Decouple by `state rm`
    // first so destroy can succeed without removing the backend out from under
    // itself, then destroy in each workspace.
    if (fs.existsSync(lab1Config.stateInfraDir)) {
      for (const ws of ['dev', 'staging', 'prod', 'default']) {
        try {
          tfWorkspaceSelect(lab1Config.stateInfraDir, ws);
        } catch { /* workspace may not exist */ }
        // Best-effort state rm of the bootstrap bucket resources (ignore failures).
        for (const addr of [
          'random_string.suffix',
          'aws_s3_bucket_public_access_block.terraform_state',
          'aws_s3_bucket_server_side_encryption_configuration.terraform_state',
          'aws_s3_bucket_versioning.terraform_state',
          'aws_s3_bucket.terraform_state',
        ]) {
          tf(['state', 'rm', addr], { cwd: lab1Config.stateInfraDir, env: env() });
        }
        logDestroyOutcome(`state-infra/${ws}`, tfDestroy(lab1Config.stateInfraDir, lab1Config.awsProfile));
      }
    }

    logDestroyOutcome('networking', tfDestroy(lab1Config.networkingDir, lab1Config.awsProfile));

    if (bucket) {
      const purged = emptyVersionedBucket(bucket, lab1Config.awsProfile);
      console.log(`  S3 bucket purge (${bucket}): ${purged ? 'done' : 'not present'}`);
      if (purged) {
        const del = awsCli(['s3api', 'delete-bucket', '--bucket', bucket], lab1Config.awsProfile);
        console.log(`  S3 bucket delete: ${del.exitCode === 0 ? '✓' : '✗ ' + del.stderr}`);
      }
    } else {
      console.log(`  (no captured bucket name — skipping S3 cleanup)`);
    }

    console.log('──────────────────────────────────────────────────────\n');
  });

  // ────────────────────────────────────────────────────────────────────────
  // Task 1: Workspace Fundamentals (Steps 1-10)
  // ────────────────────────────────────────────────────────────────────────
  test.describe('Task 1: Workspace Fundamentals', () => {
    test('Step 1: Clone Advanced_Terraform repo', async () => {
      if (fs.existsSync(lab1Config.repoDir)) {
        // Reset to a clean clone for repeatability.
        fs.rmSync(lab1Config.repoDir, { recursive: true, force: true });
      }
      execSync(`git clone --depth 1 ${lab1Config.repoUrl} "${lab1Config.repoDir}"`, {
        stdio: 'pipe',
        cwd: lab1Config.workspaceRoot,
      });
      expect(fs.existsSync(lab1Config.stateInfraDir)).toBe(true);
      expect(fs.existsSync(lab1Config.networkingDir)).toBe(true);
      expect(fs.existsSync(lab1Config.directoriesDir)).toBe(true);
    });

    test('Step 2: Review backend configuration in providers.tf', async () => {
      // manual-only per inventory, but we assert structural expectations:
      // the backend block exists and is commented out (chicken-and-egg).
      const providers = fs.readFileSync(path.join(lab1Config.stateInfraDir, 'providers.tf'), 'utf8');
      expect(providers).toMatch(/#\s*backend\s+"s3"/);
    });

    test('Step 3: terraform init in state-infra', async () => {
      const r = tf(['init', '-no-color'], { cwd: lab1Config.stateInfraDir, env: env() });
      assertOk(r, 'terraform init (state-infra)');
    });

    test('Step 4: terraform workspace list shows only default', async () => {
      const list = tfWorkspaceList(lab1Config.stateInfraDir);
      expect(list).toMatch(/\*\s+default/);
    });

    test('Step 5: env:/<workspace>/ state path pattern (conceptual)', async () => {
      manualOnly('5');
    });

    test('Step 6: Create dev, staging, prod workspaces', async () => {
      for (const ws of lab1Config.workspaces) {
        const r = tf(['workspace', 'new', ws], { cwd: lab1Config.stateInfraDir, env: env() });
        assertOk(r, `workspace new ${ws}`);
      }
      const list = tfWorkspaceList(lab1Config.stateInfraDir);
      for (const ws of lab1Config.workspaces) expect(list).toContain(ws);
    });

    test('Step 7: Switch to dev + verify', async () => {
      assertOk(tfWorkspaceSelect(lab1Config.stateInfraDir, 'dev'), 'workspace select dev');
      const show = tf(['workspace', 'show'], { cwd: lab1Config.stateInfraDir, env: env() });
      assertOk(show, 'workspace show');
      expect(show.stdout.trim()).toBe('dev');
    });

    test('Step 8: Review terraform.workspace usage in variables.tf', async () => {
      // manual-only review — structural assertion: file contains workspace-driven locals
      const variables = fs.readFileSync(path.join(lab1Config.stateInfraDir, 'variables.tf'), 'utf8');
      expect(variables).toMatch(/terraform\.workspace/);
    });

    test('Step 9: State isolation — empty state list in each workspace', async () => {
      for (const ws of ['dev', 'staging']) {
        assertOk(tfWorkspaceSelect(lab1Config.stateInfraDir, ws), `select ${ws}`);
        const r = tf(['state', 'list'], { cwd: lab1Config.stateInfraDir, env: env() });
        // empty state list returns 0 with no output (or "no resources").
        expect(r.exitCode === 0 || /No state file was found/.test(r.stderr)).toBe(true);
        expect(r.stdout.trim()).toBe('');
      }
    });

    test('Step 10: Delete prod workspace (must switch away first)', async () => {
      assertOk(tfWorkspaceSelect(lab1Config.stateInfraDir, 'dev'), 'select dev');
      const r = tf(['workspace', 'delete', 'prod'], { cwd: lab1Config.stateInfraDir, env: env() });
      assertOk(r, 'workspace delete prod');
      expect(tfWorkspaceList(lab1Config.stateInfraDir)).not.toMatch(/^\s+prod\s*$/m);
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // Task 2: Workspace Safety Guards (Steps 11-16)
  // ────────────────────────────────────────────────────────────────────────
  test.describe('Task 2: Workspace Safety Guards', () => {
    test('Step 11: Recreate prod workspace, switch back to dev', async () => {
      assertOk(tf(['workspace', 'new', 'prod'], { cwd: lab1Config.stateInfraDir, env: env() }), 'workspace new prod');
      assertOk(tfWorkspaceSelect(lab1Config.stateInfraDir, 'dev'), 'select dev');
    });

    test('Step 12: Configure tfvars + apply state bucket + migrate to remote backend', async () => {
      writeTfvars(lab1Config.stateInfraDir, {
        student_id: lab1Config.studentId,
        account: lab1Config.studentId,
        region: lab1Config.region,
      });

      // First apply: creates state bucket using LOCAL state (backend still commented out).
      const apply1 = tf(['apply', '-auto-approve', '-no-color'], {
        cwd: lab1Config.stateInfraDir,
        env: env(),
      });
      assertOk(apply1, 'terraform apply (state-infra, local state)');
      expect(apply1.stdout).toMatch(/Apply complete!/);

      const bucket = captureTfOutput(lab1Config.stateInfraDir, 'state_bucket_name');
      expect(bucket).toMatch(new RegExp(`^${lab1Config.studentId}-terraform-state-`));
      saveBucketName(bucket);

      // Activate the remote backend in providers.tf — write a fresh, fully-specified block.
      setRemoteBackend(path.join(lab1Config.stateInfraDir, 'providers.tf'), {
        bucket,
        region: lab1Config.region,
        key: STATE_KEYS.stateInfra,
      });

      // Migrate local state to S3 (auto-accept the migration prompt).
      const reinit = tf(['init', '-migrate-state', '-force-copy', '-no-color'], {
        cwd: lab1Config.stateInfraDir,
        env: env(),
      });
      assertOk(reinit, 'terraform init -migrate-state');

      // Verify state landed in S3 under env:/dev/<key> (we're in dev workspace).
      const ls = awsCli(['s3', 'ls', `s3://${bucket}/`, '--recursive', '--output', 'text'], lab1Config.awsProfile);
      assertOk(ls, 'aws s3 ls (state bucket)');
      expect(ls.stdout).toContain(`env:/dev/${STATE_KEYS.stateInfra}`);
    });

    test('Step 13: Review workspace_guard.tf', async () => {
      const guard = fs.readFileSync(path.join(lab1Config.stateInfraDir, 'workspace_guard.tf'), 'utf8');
      expect(guard).toMatch(/"null_resource"\s+"workspace_guard"/);
      expect(guard).toContain('precondition');
      expect(guard).toMatch(/terraform\.workspace\s*!=\s*"default"/);
    });

    test('Step 14: terraform plan in default workspace fails with guard error', async () => {
      assertOk(tfWorkspaceSelect(lab1Config.stateInfraDir, 'default'), 'select default');
      const r = tf(['plan', '-no-color'], { cwd: lab1Config.stateInfraDir, env: env() });
      expect(r.exitCode).not.toBe(0);
      const combined = `${r.stdout}\n${r.stderr}`;
      expect(combined).toMatch(/(precondition|Workspace .* is not allowed|Cannot run Terraform in 'default')/i);
    });

    test('Step 15: terraform plan in dev succeeds', async () => {
      assertOk(tfWorkspaceSelect(lab1Config.stateInfraDir, 'dev'), 'select dev');
      const r = tf(['plan', '-no-color'], { cwd: lab1Config.stateInfraDir, env: env() });
      assertOk(r, 'terraform plan (dev)');
    });

    test('Step 16: feature-* workspace pattern works', async () => {
      assertOk(
        tf(['workspace', 'new', lab1Config.featureWorkspace], { cwd: lab1Config.stateInfraDir, env: env() }),
        `workspace new ${lab1Config.featureWorkspace}`,
      );
      const plan = tf(['plan', '-no-color'], { cwd: lab1Config.stateInfraDir, env: env() });
      assertOk(plan, `plan in ${lab1Config.featureWorkspace}`);

      // Cleanup: switch back to dev, delete the feature workspace.
      assertOk(tfWorkspaceSelect(lab1Config.stateInfraDir, 'dev'), 'select dev');
      assertOk(
        tf(['workspace', 'delete', lab1Config.featureWorkspace], { cwd: lab1Config.stateInfraDir, env: env() }),
        `workspace delete ${lab1Config.featureWorkspace}`,
      );
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // Task 3: Cross-State Dependencies (Steps 17-22)
  // ────────────────────────────────────────────────────────────────────────
  test.describe('Task 3: Cross-State Dependencies', () => {
    test('Step 17: Deploy networking state (lab1/networking)', async () => {
      const bucket = loadBucketName();
      expect(bucket).toBeTruthy();

      setRemoteBackend(path.join(lab1Config.networkingDir, 'providers.tf'), {
        bucket,
        region: lab1Config.region,
        key: STATE_KEYS.networking,
      });

      writeTfvars(lab1Config.networkingDir, {
        account: lab1Config.studentId,
        region: lab1Config.region,
      });

      assertOk(tf(['init', '-no-color'], { cwd: lab1Config.networkingDir, env: env() }), 'init networking');
      const applyR = tf(['apply', '-auto-approve', '-no-color'], { cwd: lab1Config.networkingDir, env: env() });
      assertOk(applyR, 'apply networking');

      capturedNetworkingVpcId = captureTfOutput(lab1Config.networkingDir, 'vpc_id');
      expect(capturedNetworkingVpcId).toMatch(/^vpc-/);
    });

    test('Step 18: Review terraform_remote_state in main.tf', async () => {
      const main = fs.readFileSync(path.join(lab1Config.stateInfraDir, 'main.tf'), 'utf8');
      expect(main).toMatch(/data\s+"terraform_remote_state"/);
      expect(main).toMatch(/networking/);
    });

    test('Step 19: Add state_bucket_name to tfvars', async () => {
      const bucket = loadBucketName();
      // Rewrite tfvars with ALL the vars (writeTfvars overwrites, doesn't merge).
      writeTfvars(lab1Config.stateInfraDir, {
        student_id: lab1Config.studentId,
        account: lab1Config.studentId,
        region: lab1Config.region,
        state_bucket_name: bucket,
      });
      const tfvars = fs.readFileSync(path.join(lab1Config.stateInfraDir, 'terraform.tfvars'), 'utf8');
      expect(tfvars).toMatch(new RegExp(`state_bucket_name\\s*=\\s*"${bucket}"`));
    });

    test('Step 20: terraform plan + apply (app config with cross-state read)', async () => {
      assertOk(tfWorkspaceSelect(lab1Config.stateInfraDir, 'dev'), 'select dev');
      const plan = tf(['plan', '-no-color'], { cwd: lab1Config.stateInfraDir, env: env() });
      assertOk(plan, 'plan with remote_state');
      const apply = tf(['apply', '-auto-approve', '-no-color'], { cwd: lab1Config.stateInfraDir, env: env() });
      assertOk(apply, 'apply with remote_state');
    });

    test('Step 21: terraform output — VPC ID matches networking', async () => {
      const out = tf(['output', '-json'], { cwd: lab1Config.stateInfraDir, env: env() });
      assertOk(out, 'terraform output -json');
      const parsed = JSON.parse(out.stdout);
      const appVpcId = parsed.networking_vpc_id?.value;
      expect(appVpcId).toBe(capturedNetworkingVpcId);
    });

    test('Step 22: Understand state boundaries (conceptual)', async () => {
      manualOnly('22');
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // Task 4: State Inspection & Troubleshooting (Steps 23-25)
  // ────────────────────────────────────────────────────────────────────────
  test.describe('Task 4: State Inspection & Troubleshooting', () => {
    test('Step 23: terraform state pull → local JSON file', async () => {
      const r = tf(['state', 'pull'], { cwd: lab1Config.stateInfraDir, env: env() });
      assertOk(r, 'state pull');
      const tmpFile = path.join(lab1Config.workspaceRoot, 'lab1-state.json');
      fs.writeFileSync(tmpFile, r.stdout);
      const state = JSON.parse(r.stdout);
      expect(state.version).toBeGreaterThan(0);
      expect(Array.isArray(state.resources)).toBe(true);
      expect(state.resources.length).toBeGreaterThan(0);
    });

    test('Step 24: jq inspection of state file', async () => {
      if (!jqAvailable()) {
        test.skip(true, 'jq not installed (optional); falling back is fine — skipping step.');
        return;
      }
      const tmpFile = path.join(lab1Config.workspaceRoot, 'lab1-state.json');
      const types = execSync(`jq -r ".resources[].type" "${tmpFile}"`, { encoding: 'utf8' }).trim();
      expect(types.length).toBeGreaterThan(0);
      const ssm = execSync(`jq ".resources[] | select(.type == \\"aws_ssm_parameter\\")" "${tmpFile}"`, { encoding: 'utf8' });
      expect(ssm).toContain('aws_ssm_parameter');
    });

    test('Step 25: force-unlock command is documented (conceptual)', async () => {
      manualOnly('25');
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // Task 5: Workspaces vs Directory Structure (Steps 26-29, mostly review-only)
  // ────────────────────────────────────────────────────────────────────────
  test.describe('Task 5: Workspaces vs Directories', () => {
    test('Step 26: ls lab1/directories/', async () => {
      const entries = fs.readdirSync(lab1Config.directoriesDir);
      expect(entries).toEqual(expect.arrayContaining(['modules', 'dev', 'staging']));
    });

    test('Step 27: Review modules/app/main.tf', async () => {
      const moduleMain = fs.readFileSync(path.join(lab1Config.directoriesDir, 'modules', 'app', 'main.tf'), 'utf8');
      expect(moduleMain).toMatch(/terraform_remote_state/);
    });

    test('Step 28: Review dev/main.tf', async () => {
      const devMain = fs.readFileSync(path.join(lab1Config.directoriesDir, 'dev', 'main.tf'), 'utf8');
      expect(devMain).toMatch(/module\s+"app"/);
      expect(devMain).toMatch(/environment\s*=\s*"dev"/);
    });

    test('Step 29: Pick a pattern (decision exercise)', async () => {
      manualOnly('29');
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // Bonus: Workspace State Isolation (Step 30)
  // ────────────────────────────────────────────────────────────────────────
  test.describe('Bonus: Workspace State Isolation', () => {
    test('Step 30: Materialize prod state via refresh-only, verify env:/ paths', async () => {
      const bucket = loadBucketName();
      // After S3 migration, only the active workspace has remote state. The
      // prod workspace exists locally but not in S3, so plain `select prod`
      // fails. Use `-or-create` (Terraform 1.4+) — this is how the lab
      // SHOULD have phrased it; a finding for the lab content team.
      const sel = tf(['workspace', 'select', '-or-create', 'prod'], {
        cwd: lab1Config.stateInfraDir,
        env: env(),
      });
      assertOk(sel, 'workspace select -or-create prod');

      const refresh = tf(['apply', '-refresh-only', '-auto-approve', '-no-color'], {
        cwd: lab1Config.stateInfraDir,
        env: env(),
      });
      assertOk(refresh, 'apply -refresh-only in prod');

      const ls = awsCli(['s3', 'ls', `s3://${bucket}/env:/`, '--recursive', '--output', 'text'], lab1Config.awsProfile);
      assertOk(ls, 'aws s3 ls env:/');
      expect(ls.stdout).toContain(`env:/dev/${STATE_KEYS.stateInfra}`);
      expect(ls.stdout).toContain(`env:/prod/${STATE_KEYS.stateInfra}`);

      // Back to dev for cleanup.
      assertOk(tfWorkspaceSelect(lab1Config.stateInfraDir, 'dev'), 'select dev');
    });
  });
});
