/**
 * Terraform Day 3 — Lab 4: Auditing & Observability
 *
 * The lab is mostly console-driven. The test uses aws-cli equivalents:
 *   - cloudtrail lookup-events (Task 1)
 *   - logs start-query + get-query-results (Task 2 — optional)
 *   - terraform for the dashboard deploy (Task 3)
 *
 * SELF-CONTAINED: provisions its own state bucket inline. Doesn't require
 * Lab 3 resources to exist — the dashboard deploys regardless; widgets just
 * show "no data" if the referenced CodePipeline/CodeBuild names don't exist.
 *
 * Inventory: 14 steps, 8 marked aws-ui in the lab (we use aws-cli alts), 1 manual-only.
 */

import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { lab4Config, validateConfig, inventory } from './lab4.config';
import { tf, awsCli, assertOk } from '../helpers/terraform-runner';
import { emptyVersionedBucket, tfDestroy, logDestroyOutcome } from '../helpers/cleanup';
import { createStateBucket, randomSuffix } from '../helpers/state-bucket';

test.setTimeout(5 * 60 * 1000);
test.describe.configure({ mode: 'serial' });

let stateBucketName = '';
const env = () => ({ AWS_PROFILE: lab4Config.awsProfile });

function saveBucket(name: string): void {
  stateBucketName = name;
  fs.writeFileSync(path.join(lab4Config.workspaceRoot, '.captured-state-bucket'), name);
}
function loadBucket(): string {
  if (stateBucketName) return stateBucketName;
  const f = path.join(lab4Config.workspaceRoot, '.captured-state-bucket');
  if (fs.existsSync(f)) stateBucketName = fs.readFileSync(f, 'utf8').trim();
  return stateBucketName;
}

function writeTfvars(dir: string, vars: Record<string, string>): void {
  const lines = Object.entries(vars).map(([k, v]) => `${k} = "${v}"`);
  fs.writeFileSync(path.join(dir, 'terraform.tfvars'), lines.join('\n') + '\n');
}

// ──────────────────────────────────────────────────────────────────────────
test.describe('Terraform Lab 4: Auditing & Observability', () => {
  test.beforeAll(async () => {
    const { valid, missing, toolFailures, warnings } = validateConfig();
    if (!valid) {
      throw new Error(`Lab 4 prerequisites not met:\n${[...missing, ...toolFailures].map((m) => `  - ${m}`).join('\n')}`);
    }
    if (warnings.length > 0) {
      console.log('\n⚠ Optional tooling warnings:');
      for (const w of warnings) console.log(`  - ${w}`);
    }

    fs.mkdirSync(lab4Config.workspaceRoot, { recursive: true });

    if (fs.existsSync(lab4Config.repoDir)) {
      fs.rmSync(lab4Config.repoDir, { recursive: true, force: true });
    }
    execSync(`git clone --depth 1 ${lab4Config.repoUrl} "${lab4Config.repoDir}"`, {
      stdio: 'pipe', cwd: lab4Config.workspaceRoot,
    });

    const bucket = `tf-state-${lab4Config.studentId}-${randomSuffix()}`;
    createStateBucket({ bucket, region: lab4Config.region, profile: lab4Config.awsProfile });
    saveBucket(bucket);

    console.log(`\nLab 4 workspace: ${lab4Config.workspaceRoot}`);
    console.log(`State bucket:    ${bucket}`);
    console.log(`Region:          ${lab4Config.region}`);
    console.log(`Inventory:       ${inventory.steps.length} steps\n`);
  });

  test.afterAll(async () => {
    console.log('\n── Cleanup ───────────────────────────────────────────');
    const bucket = loadBucket();
    logDestroyOutcome('lab4/observability', tfDestroy(lab4Config.observabilityDir, lab4Config.awsProfile));
    if (bucket) {
      const purged = emptyVersionedBucket(bucket, lab4Config.awsProfile);
      console.log(`  S3 bucket purge (${bucket}): ${purged ? 'done' : 'not present'}`);
      if (purged) {
        const del = awsCli(['s3api', 'delete-bucket', '--bucket', bucket], lab4Config.awsProfile);
        console.log(`  S3 bucket delete: ${del.exitCode === 0 ? '✓' : '✗ ' + del.stderr.split('\n')[0]}`);
      }
    }
    console.log('──────────────────────────────────────────────────────\n');
  });

  // ────────────────────────────────────────────────────────────────────────
  // Task 1: CloudTrail Query Demo (Steps 1-4)
  // ────────────────────────────────────────────────────────────────────────
  test.describe('Task 1: CloudTrail Query Demo', () => {
    test('Step 1: cloudtrail lookup-events returns recent activity', async () => {
      const r = awsCli(
        ['cloudtrail', 'lookup-events',
         '--max-results', '5',
         '--region', lab4Config.region,
         '--output', 'json'],
        lab4Config.awsProfile,
      );
      assertOk(r, 'cloudtrail lookup-events');
      const parsed = JSON.parse(r.stdout);
      expect(parsed.Events).toBeDefined();
      // CloudTrail Event History always has SOME events in an active account.
      expect(parsed.Events.length).toBeGreaterThan(0);
    });

    test('Step 2: Filter for terraform-related activity', async () => {
      // EventSource filter: terraform shows up under ssm.amazonaws.com / s3.amazonaws.com etc.
      // Check for at least one event from any of the services the labs use.
      const r = awsCli(
        ['cloudtrail', 'lookup-events',
         '--lookup-attributes', 'AttributeKey=EventSource,AttributeValue=ssm.amazonaws.com',
         '--max-results', '5',
         '--region', lab4Config.region,
         '--output', 'json'],
        lab4Config.awsProfile,
      );
      assertOk(r, 'cloudtrail lookup-events (ssm filter)');
      // Don't assert event count — depends on recent activity. Just verify the
      // filter shape works (no error from CloudTrail).
    });

    test('Step 3: Examine a CloudTrail event JSON (userIdentity / userAgent / sourceIPAddress)', async () => {
      const r = awsCli(
        ['cloudtrail', 'lookup-events',
         '--max-results', '1',
         '--region', lab4Config.region,
         '--output', 'json'],
        lab4Config.awsProfile,
      );
      assertOk(r, 'cloudtrail lookup-events (single)');
      const events = JSON.parse(r.stdout).Events;
      if (events.length > 0) {
        // CloudTrailEvent is a JSON string within the response.
        const detail = JSON.parse(events[0].CloudTrailEvent);
        expect(detail.userIdentity).toBeDefined();
        // userAgent / sourceIPAddress are usually present but optional —
        // confirm at least one is set.
        const hasContext = detail.userAgent || detail.sourceIPAddress;
        expect(hasContext).toBeTruthy();
      }
    });

    test('Step 4: Compare pipeline vs console activity', async () => {
      test.skip(true, 'manual-only step 4: visual comparison of event sets (conceptual)');
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // Task 2: CloudWatch Logs Insights (Steps 5-9) — optional
  // ────────────────────────────────────────────────────────────────────────
  test.describe('Task 2: CloudWatch Logs Insights (optional)', () => {
    test('Step 5: List log groups; check for a CloudTrail group', async () => {
      const r = awsCli(
        ['logs', 'describe-log-groups',
         '--log-group-name-prefix', '/aws/cloudtrail',
         '--region', lab4Config.region,
         '--query', 'logGroups[].logGroupName',
         '--output', 'json'],
        lab4Config.awsProfile,
      );
      assertOk(r, 'describe-log-groups');
      const groups = JSON.parse(r.stdout) as string[];
      if (groups.length === 0) {
        test.skip(true, 'no CloudTrail→CloudWatch Logs delivery configured in this account — Task 2 is optional');
      }
    });

    test.fixme('Step 6: Verify CloudTrail→CWL delivery exists', async () => { /* covered by Step 5 conditional skip */ });
    test.fixme('Step 7: Run terraform-activity Logs Insights query', async () => { /* DEFERRED — only useful if CWL delivery exists */ });
    test.fixme('Step 8: Run resource-scoped SSM PutParameter query', async () => { /* DEFERRED */ });
    test.fixme('Step 9: Save query as <studentId>-terraform-activity', async () => { /* DEFERRED */ });
  });

  // ────────────────────────────────────────────────────────────────────────
  // Task 3: Deploy Observability Dashboard (Steps 10-14)
  // ────────────────────────────────────────────────────────────────────────
  test.describe('Task 3: Deploy Observability Dashboard', () => {
    test('Step 10: cd lab4/observability; ls', async () => {
      expect(fs.existsSync(lab4Config.observabilityDir)).toBe(true);
      const entries = fs.readdirSync(lab4Config.observabilityDir);
      expect(entries).toContain('dashboard.tf');
      expect(entries).toContain('providers.tf');
    });

    test('Step 11: Review dashboard.tf — references CloudWatch dashboard resource', async () => {
      const content = fs.readFileSync(path.join(lab4Config.observabilityDir, 'dashboard.tf'), 'utf8');
      expect(content).toMatch(/resource\s+"aws_cloudwatch_dashboard"/);
      expect(content).toMatch(/dashboard_name\s*=/);
    });

    test('Step 12: Configure terraform.tfvars + verify providers.tf uses var.region', async () => {
      writeTfvars(lab4Config.observabilityDir, {
        account: lab4Config.studentId,
        region: lab4Config.region,
        state_bucket_name: loadBucket(),
      });
      const providers = fs.readFileSync(path.join(lab4Config.observabilityDir, 'providers.tf'), 'utf8');
      expect(providers).toMatch(/region\s*=\s*var\.region/);
    });

    test('Step 13: terraform init / plan / apply — deploy dashboard', async () => {
      const initR = tf(
        ['init', '-backend-config', `bucket=${loadBucket()}`, '-backend-config', `region=${lab4Config.region}`, '-no-color'],
        { cwd: lab4Config.observabilityDir, env: env() },
      );
      assertOk(initR, 'terraform init (observability)');
      const plan = tf(['plan', '-no-color'], { cwd: lab4Config.observabilityDir, env: env() });
      assertOk(plan, 'terraform plan');
      const apply = tf(['apply', '-auto-approve', '-no-color'], { cwd: lab4Config.observabilityDir, env: env() });
      assertOk(apply, 'terraform apply (dashboard)');
      expect(apply.stdout).toMatch(/Apply complete!/);
    });

    test('Step 14: terraform output dashboard_url + verify dashboard exists in AWS', async () => {
      const out = tf(['output', '-raw', 'dashboard_url'], { cwd: lab4Config.observabilityDir, env: env() });
      assertOk(out, 'terraform output dashboard_url');
      expect(out.stdout).toMatch(/https:\/\/.*console\.aws\.amazon\.com\/cloudwatch.*dashboards/);

      // Verify via aws-cli that the dashboard actually exists. Use list-dashboards
      // (not get-dashboard) — Windows charmap codec chokes on Unicode chars in
      // the dashboard body. list-dashboards only returns names + ARNs.
      const dashboardName = `${lab4Config.studentId}-terraform-operations`;
      const list = awsCli(
        ['cloudwatch', 'list-dashboards', '--dashboard-name-prefix', dashboardName,
         '--region', lab4Config.region, '--query', 'DashboardEntries[].DashboardName'],
        lab4Config.awsProfile,
      );
      assertOk(list, `list-dashboards ${dashboardName}`);
      const names = JSON.parse(list.stdout) as string[];
      expect(names).toContain(dashboardName);
    });
  });
});
