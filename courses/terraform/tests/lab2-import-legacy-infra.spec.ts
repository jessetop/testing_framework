/**
 * Terraform Day 3 — Lab 2: Import Day 1-2 Infrastructure into Remote State
 *
 * Pure CLI test. See `../lab2.inventory.ts` for the 24-step inventory.
 *
 * Test architecture:
 *   1. beforeAll: clone repo, create a state bucket inline (Day 1-2 normally
 *      provides this; we provision via AWS CLI to keep the test self-contained)
 *   2. Task 1: verify nothing exists for this student → deploy lean VPC → capture IDs
 *   3. Tasks 2-7: the import workflow from the lab markdown
 *   4. afterAll: destroy lean VPC, delete state bucket (empty versioned first)
 *
 * Two intentional failures asserted as `expectFailure` from the inventory:
 *   - Step 10: `terraform plan -generate-config-out` errors on conflicting attributes
 *   - Step 21: `terraform plan -destroy` blocked by `prevent_destroy`
 */

import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { lab2Config, validateConfig, inventory } from './lab2.config';
import { tf, awsCli, assertOk } from '../helpers/terraform-runner';
import { emptyVersionedBucket, tfDestroy, logDestroyOutcome } from '../helpers/cleanup';
import { createStateBucket, randomSuffix } from '../helpers/state-bucket';

test.setTimeout(5 * 60 * 1000);

let stateBucketName = '';
const capturedIds: Record<string, string> = {};

const env = () => ({ AWS_PROFILE: lab2Config.awsProfile });

function captureBucketFile(): string {
  return path.join(lab2Config.workspaceRoot, '.captured-state-bucket');
}

function saveBucket(name: string): void {
  stateBucketName = name;
  fs.writeFileSync(captureBucketFile(), name);
}

function loadBucket(): string {
  if (stateBucketName) return stateBucketName;
  if (fs.existsSync(captureBucketFile())) {
    stateBucketName = fs.readFileSync(captureBucketFile(), 'utf8').trim();
  }
  return stateBucketName;
}

function writeTfvars(dir: string, vars: Record<string, string>): void {
  const lines = Object.entries(vars)
    .filter(([, v]) => v !== undefined && v !== '')
    .map(([k, v]) => `${k} = "${v}"`);
  fs.writeFileSync(path.join(dir, 'terraform.tfvars'), lines.join('\n') + '\n');
}

/**
 * Toggle `prevent_destroy = true` for a resource. The repo's files use two
 * different conventions — network.tf has a live `lifecycle { }` with the
 * prevent_destroy line commented inside, while security-group.tf has the
 * entire lifecycle block commented out. Handle both.
 */
function toggleLifecycleBlock(filePath: string, resourceAddress: string, enabled: boolean): void {
  const content = fs.readFileSync(filePath, 'utf8').replace(/\r\n/g, '\n');
  let next = content;

  if (enabled) {
    // Style A — security-group.tf: entire lifecycle block is commented.
    // Match `  # lifecycle {\n  # prevent_destroy = true\n  # }` and uncomment.
    const styleA = /^(\s*)#\s*lifecycle\s*\{\s*\n(\s*)#\s*prevent_destroy\s*=\s*true\s*\n(\s*)#\s*\}/m;
    if (styleA.test(next)) {
      next = next.replace(styleA, '$1lifecycle {\n$2  prevent_destroy = true\n$3}');
    } else {
      // Style B — network.tf: lifecycle { } is live, prevent_destroy commented inside.
      next = next.replace(/^(\s*)#\s*prevent_destroy\s*=\s*true/m, '$1prevent_destroy = true');
    }
  } else {
    // Re-comment the live prevent_destroy line. Don't bother re-commenting the
    // surrounding lifecycle {} — terraform's fine with an empty lifecycle block,
    // and afterAll just needs prevent_destroy off.
    next = next.replace(/^(\s*)prevent_destroy\s*=\s*true/m, '$1# prevent_destroy = true');
  }

  if (next === content) {
    throw new Error(
      `toggleLifecycleBlock(${resourceAddress}, ${enabled}) made no change in ${filePath}.`,
    );
  }
  fs.writeFileSync(filePath, next);
  void resourceAddress;  // kept for call-site documentation
}

// ──────────────────────────────────────────────────────────────────────────
test.describe.configure({ mode: 'serial' });
test.describe('Terraform Lab 2: Import Day 1-2 Infrastructure into Remote State', () => {
  test.beforeAll(async () => {
    const { valid, missing, toolFailures, warnings } = validateConfig();
    if (!valid) {
      throw new Error(`Lab 2 prerequisites not met:\n${[...missing, ...toolFailures].map((m) => `  - ${m}`).join('\n')}`);
    }
    if (warnings.length > 0) {
      console.log('\n⚠ Optional tooling warnings:');
      for (const w of warnings) console.log(`  - ${w}`);
    }

    fs.mkdirSync(lab2Config.workspaceRoot, { recursive: true });

    // Clone repo if not present (fresh per test run for repeatability).
    if (fs.existsSync(lab2Config.repoDir)) {
      fs.rmSync(lab2Config.repoDir, { recursive: true, force: true });
    }
    execSync(`git clone --depth 1 ${lab2Config.repoUrl} "${lab2Config.repoDir}"`, {
      stdio: 'pipe',
      cwd: lab2Config.workspaceRoot,
    });

    // Create the state bucket inline (Day 1-2 provides this in production).
    const bucket = `tf-state-${lab2Config.studentId}-${randomSuffix()}`;
    createStateBucket({ bucket, region: lab2Config.region, profile: lab2Config.awsProfile });
    saveBucket(bucket);

    console.log(`\nLab 2 workspace: ${lab2Config.workspaceRoot}`);
    console.log(`State bucket:    ${bucket}`);
    console.log(`Region:          ${lab2Config.region}`);
    console.log(`Inventory:       ${inventory.steps.length} steps, ${inventory.steps.filter((s) => s.strategy === 'manual-only').length} manual-only\n`);
  });

  test.afterAll(async () => {
    console.log('\n── Cleanup ───────────────────────────────────────────');
    const bucket = loadBucket();

    // Re-enable destroy on the imported VPC + SG (lab markdown's Step 22)
    // in case the test failed before Task 7 ran them. Idempotent: only flip
    // if currently active.
    try {
      const networkTf = path.join(lab2Config.importDir, 'network.tf');
      const sgTf = path.join(lab2Config.importDir, 'security-group.tf');
      if (fs.existsSync(networkTf) && /^\s*prevent_destroy\s*=\s*true/m.test(fs.readFileSync(networkTf, 'utf8'))) {
        toggleLifecycleBlock(networkTf, 'aws_vpc.custom-vpc', false);
      }
      if (fs.existsSync(sgTf) && /^\s*prevent_destroy\s*=\s*true/m.test(fs.readFileSync(sgTf, 'utf8'))) {
        toggleLifecycleBlock(sgTf, 'aws_security_group.allow-http-ssh', false);
      }
    } catch (e) { /* best effort */ }

    logDestroyOutcome('lab2/import (dev)', tfDestroy(lab2Config.importDir, lab2Config.awsProfile));
    logDestroyOutcome('lab2/day1-vpc-lean', tfDestroy(lab2Config.fallbackVpcDir, lab2Config.awsProfile));

    if (bucket) {
      const purged = emptyVersionedBucket(bucket, lab2Config.awsProfile);
      console.log(`  S3 bucket purge (${bucket}): ${purged ? 'done' : 'not present'}`);
      if (purged) {
        const del = awsCli(['s3api', 'delete-bucket', '--bucket', bucket], lab2Config.awsProfile);
        console.log(`  S3 bucket delete: ${del.exitCode === 0 ? '✓' : '✗ ' + del.stderr.split('\n')[0]}`);
      }
    }
    console.log('──────────────────────────────────────────────────────\n');
  });

  // ────────────────────────────────────────────────────────────────────────
  // Task 1: Verify or Deploy the Day 1-2 Stack (Steps 1-3)
  // ────────────────────────────────────────────────────────────────────────
  test.describe('Task 1: Verify or Deploy', () => {
    test('Step 1: Check for existing VPC + state bucket', async () => {
      const vpcs = awsCli(
        ['ec2', 'describe-vpcs', '--filters', `Name=tag:Name,Values=*${lab2Config.studentId}*`,
         '--query', 'Vpcs[].VpcId', '--region', lab2Config.region],
        lab2Config.awsProfile,
      );
      assertOk(vpcs, 'describe-vpcs');
      const found = JSON.parse(vpcs.stdout) as string[];
      // For fresh test runs we expect this to be empty — we deploy in Step 2.
      // (Test still passes if it's non-empty; the lab branches but we always
      // go through Step 2 to ensure a known-good test starting point.)
      expect(Array.isArray(found)).toBe(true);
    });

    test('Step 2: Deploy lean VPC fallback', async () => {
      writeTfvars(lab2Config.fallbackVpcDir, {
        account: lab2Config.studentId,
        region: lab2Config.region,
      });
      assertOk(tf(['init', '-no-color'], { cwd: lab2Config.fallbackVpcDir, env: env() }), 'init lean VPC');
      const apply = tf(['apply', '-auto-approve', '-no-color'], { cwd: lab2Config.fallbackVpcDir, env: env() });
      assertOk(apply, 'apply lean VPC');
      expect(apply.stdout).toMatch(/Apply complete!/);
    });

    test('Step 3: Capture resource IDs from terraform output', async () => {
      const r = tf(['output', '-json'], { cwd: lab2Config.fallbackVpcDir, env: env() });
      assertOk(r, 'output -json');
      const outputs = JSON.parse(r.stdout);
      // Capture all 8 IDs the lab expects + the compound ID for RT assoc.
      for (const key of [
        'vpc_id', 'subnet_id', 'internet_gateway_id', 'route_table_id',
        'security_group_id', 'sg_rule_http_id', 'sg_rule_ssh_id', 'sg_rule_egress_id',
      ]) {
        expect(outputs[key]?.value).toBeTruthy();
        capturedIds[key] = outputs[key].value;
      }
      expect(capturedIds.vpc_id).toMatch(/^vpc-/);
      expect(capturedIds.security_group_id).toMatch(/^sg-/);
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // Task 2: Set Up the Import Project (Steps 4-7)
  // ────────────────────────────────────────────────────────────────────────
  test.describe('Task 2: Set Up Import Project', () => {
    test('Step 4: cd lab2/import', async () => {
      expect(fs.existsSync(lab2Config.importDir)).toBe(true);
    });

    test('Step 5: Write terraform.tfvars with captured IDs', async () => {
      writeTfvars(lab2Config.importDir, {
        account: lab2Config.studentId,
        region: lab2Config.region,
        ...capturedIds,
      });
      const content = fs.readFileSync(path.join(lab2Config.importDir, 'terraform.tfvars'), 'utf8');
      expect(content).toContain(`vpc_id = "${capturedIds.vpc_id}"`);
      expect(content).toContain(`security_group_id = "${capturedIds.security_group_id}"`);
    });

    test('Step 6: Review providers.tf backend block', async () => {
      const providers = fs.readFileSync(path.join(lab2Config.importDir, 'providers.tf'), 'utf8');
      expect(providers).toMatch(/backend\s+"s3"/);
      expect(providers).toContain(`key          = "${lab2Config.stateKey}"`);
      expect(providers).toMatch(/use_lockfile\s*=\s*true/);
    });

    test('Step 7: terraform init -backend-config + workspace new dev', async () => {
      const initR = tf(
        ['init', '-backend-config', `bucket=${loadBucket()}`, '-backend-config', `region=${lab2Config.region}`, '-no-color'],
        { cwd: lab2Config.importDir, env: env() },
      );
      assertOk(initR, 'terraform init -backend-config');
      expect(initR.stdout).toMatch(/Terraform has been successfully initialized|Successfully configured the backend/);

      // workspace new — error if already exists is benign per the lab.
      tf(['workspace', 'new', 'dev'], { cwd: lab2Config.importDir, env: env() });
      const sel = tf(['workspace', 'select', 'dev'], { cwd: lab2Config.importDir, env: env() });
      assertOk(sel, 'workspace select dev');
      const show = tf(['workspace', 'show'], { cwd: lab2Config.importDir, env: env() });
      assertOk(show, 'workspace show');
      expect(show.stdout.trim()).toBe('dev');
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // Task 3: Review Import Blocks (Steps 8-9)
  // ────────────────────────────────────────────────────────────────────────
  test.describe('Task 3: Review Import Blocks', () => {
    test('Step 8: imports.tf contains 9 import blocks', async () => {
      const imports = fs.readFileSync(path.join(lab2Config.importDir, 'imports.tf'), 'utf8');
      const importBlocks = imports.match(/import\s*\{/g) || [];
      expect(importBlocks.length).toBe(9);
    });

    test('Step 9: Compound ID for route table association', async () => {
      const imports = fs.readFileSync(path.join(lab2Config.importDir, 'imports.tf'), 'utf8');
      expect(imports).toMatch(/aws_route_table_association/);
      expect(imports).toMatch(/var\.subnet_id.*\/.*var\.route_table_id|\${var\.subnet_id}.*\${var\.route_table_id}/);
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // Task 4: Experience Config Generation (Steps 10-12)
  // ────────────────────────────────────────────────────────────────────────
  test.describe('Task 4: Config Generation (expect conflict)', () => {
    test('Step 10: cd generate-config-demo + plan -generate-config-out errors on conflicting attributes', async () => {
      // The demo subfolder strips out network.tf and security-group.tf so
      // generate-config has work to do. Lab markdown says
      // `cp ../terraform.tfvars terraform.tfvars` — we do the same.
      fs.copyFileSync(
        path.join(lab2Config.importDir, 'terraform.tfvars'),
        path.join(lab2Config.generateConfigDemoDir, 'terraform.tfvars'),
      );
      assertOk(
        tf(['init', '-no-color'], { cwd: lab2Config.generateConfigDemoDir, env: env() }),
        'init generate-config-demo',
      );
      const r = tf(['plan', '-generate-config-out=generated.tf', '-no-color'], {
        cwd: lab2Config.generateConfigDemoDir, env: env(),
      });
      expect(r.exitCode).not.toBe(0);
      const combined = `${r.stdout}\n${r.stderr}`;
      expect(combined).toMatch(/Conflicting configuration arguments|availability_zone.*conflicts/i);
    });

    test('Step 11: generated.tf was partially written + has expected mess', async () => {
      const generated = path.join(lab2Config.generateConfigDemoDir, 'generated.tf');
      expect(fs.existsSync(generated)).toBe(true);
      const content = fs.readFileSync(generated, 'utf8');
      expect(content.length).toBeGreaterThan(0);
      // Spot-check one of the common offenders the lab calls out.
      expect(content).toMatch(/tags_all|availability_zone/);
    });

    test('Step 12: rm generated.tf + cd back to lab2/import', async () => {
      const generated = path.join(lab2Config.generateConfigDemoDir, 'generated.tf');
      if (fs.existsSync(generated)) fs.unlinkSync(generated);
      expect(fs.existsSync(generated)).toBe(false);
      // No actual cd needed — subsequent tests use lab2Config.importDir directly.
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // Task 5: Execute the Import (Steps 13-17)
  // ────────────────────────────────────────────────────────────────────────
  test.describe('Task 5: Execute Import', () => {
    test('Step 13: Cleaned config files exist (network.tf + security-group.tf)', async () => {
      expect(fs.existsSync(path.join(lab2Config.importDir, 'network.tf'))).toBe(true);
      expect(fs.existsSync(path.join(lab2Config.importDir, 'security-group.tf'))).toBe(true);
    });

    test('Step 14: terraform plan — expect "9 to import, 0 to change"', async () => {
      const r = tf(['plan', '-no-color'], { cwd: lab2Config.importDir, env: env() });
      assertOk(r, 'terraform plan');
      expect(r.stdout).toMatch(/Plan:\s*9 to import,\s*0 to add,\s*0 to change,\s*0 to destroy/);
    });

    test('Step 15: terraform apply — imports 9 resources', async () => {
      const r = tf(['apply', '-auto-approve', '-no-color'], { cwd: lab2Config.importDir, env: env() });
      assertOk(r, 'terraform apply (import)');
      expect(r.stdout).toMatch(/Apply complete! Resources: 9 imported/);
    });

    test('Step 16: terraform plan — expect "No changes"', async () => {
      const r = tf(['plan', '-no-color'], { cwd: lab2Config.importDir, env: env() });
      assertOk(r, 'terraform plan post-import');
      expect(r.stdout).toMatch(/No changes\.|Your infrastructure matches the configuration/);
    });

    test('Step 17: terraform state list shows 9 resources', async () => {
      const r = tf(['state', 'list'], { cwd: lab2Config.importDir, env: env() });
      assertOk(r, 'state list');
      // state list includes data sources (e.g. data.aws_availability_zones) —
      // filter to imported resources only for the count check.
      const resources = r.stdout.trim().split('\n').filter(Boolean).filter((a) => !a.startsWith('data.'));
      expect(resources.length).toBe(9);
      expect(resources).toEqual(expect.arrayContaining([
        'aws_vpc.custom-vpc',
        'aws_subnet.subnet-a',
        'aws_internet_gateway.igw',
        'aws_route_table.public_rt',
        'aws_route_table_association.public_subnet_a',
        'aws_security_group.allow-http-ssh',
        'aws_vpc_security_group_ingress_rule.allow-http-ipv4',
        'aws_vpc_security_group_ingress_rule.allow-ssh-ipv4',
        'aws_vpc_security_group_egress_rule.allow-all-outbound',
      ]));
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // Task 6: Protect Critical Resources (Steps 18-21)
  // ────────────────────────────────────────────────────────────────────────
  test.describe('Task 6: prevent_destroy Lifecycle Guard', () => {
    test('Step 18: Add prevent_destroy to VPC', async () => {
      toggleLifecycleBlock(path.join(lab2Config.importDir, 'network.tf'), 'aws_vpc.custom-vpc', true);
      const content = fs.readFileSync(path.join(lab2Config.importDir, 'network.tf'), 'utf8');
      // Must have an uncommented lifecycle block; commented one is not enough.
      expect(content).toMatch(/^\s*lifecycle\s*\{/m);
      expect(content).toMatch(/^\s*prevent_destroy\s*=\s*true/m);
    });

    test('Step 19: Add prevent_destroy to security group', async () => {
      toggleLifecycleBlock(path.join(lab2Config.importDir, 'security-group.tf'), 'aws_security_group.allow-http-ssh', true);
      const content = fs.readFileSync(path.join(lab2Config.importDir, 'security-group.tf'), 'utf8');
      expect(content).toMatch(/^\s*lifecycle\s*\{/m);
    });

    test('Step 20: terraform apply records lifecycle change', async () => {
      const r = tf(['apply', '-auto-approve', '-no-color'], { cwd: lab2Config.importDir, env: env() });
      assertOk(r, 'apply lifecycle change');
      // Either 2 to change (both resources) or "No changes" if terraform optimized.
      expect(r.stdout).toMatch(/Apply complete!/);
    });

    test('Step 21: terraform plan -destroy blocked by prevent_destroy', async () => {
      const r = tf(['plan', '-destroy', '-no-color'], { cwd: lab2Config.importDir, env: env() });
      expect(r.exitCode).not.toBe(0);
      const combined = `${r.stdout}\n${r.stderr}`;
      expect(combined).toMatch(/Instance cannot be destroyed|prevent_destroy/i);
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // Task 7: Cleanup (Steps 22-24)
  // ────────────────────────────────────────────────────────────────────────
  test.describe('Task 7: Cleanup', () => {
    test('Step 22: Remove prevent_destroy blocks', async () => {
      // Toggle off only if currently on — guard against the test reaching here
      // via the afterAll best-effort path which already toggled off.
      const netTf = path.join(lab2Config.importDir, 'network.tf');
      const sgTf = path.join(lab2Config.importDir, 'security-group.tf');
      if (/^\s*prevent_destroy\s*=\s*true/m.test(fs.readFileSync(netTf, 'utf8'))) {
        toggleLifecycleBlock(netTf, 'aws_vpc.custom-vpc', false);
      }
      if (/^\s*prevent_destroy\s*=\s*true/m.test(fs.readFileSync(sgTf, 'utf8'))) {
        toggleLifecycleBlock(sgTf, 'aws_security_group.allow-http-ssh', false);
      }
    });

    test('Step 23: terraform destroy in lab2/import', async () => {
      const r = tf(['destroy', '-auto-approve', '-no-color'], { cwd: lab2Config.importDir, env: env() });
      assertOk(r, 'terraform destroy');
      expect(r.stdout).toMatch(/Destroy complete!|9 destroyed/);
    });

    test('Step 24: Delete dev workspace', async () => {
      assertOk(tf(['workspace', 'select', 'default'], { cwd: lab2Config.importDir, env: env() }), 'select default');
      const del = tf(['workspace', 'delete', 'dev'], { cwd: lab2Config.importDir, env: env() });
      assertOk(del, 'workspace delete dev');
    });
  });
});
