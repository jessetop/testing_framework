/**
 * IO-107 Lab 1 — End-to-End EKS Deployment Pipeline.
 *
 * CLI-driven test (no Playwright browser steps). The IO-107 pipeline labs are
 * better tested via aws CLI + kubectl than UI-scraping the CodePipeline
 * console — same evidence, faster, more reliable.
 *
 * Assumes the lab_env_student/ Terraform has been applied (see global setup or
 * run manually before invoking). Reads pipeline + cluster names from
 * terraform outputs.
 */

import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { lab1Config, validateConfig, printSetupInstructions } from './lab1.config';
import inventory from '../lab1.inventory';

test.setTimeout(15 * 60 * 1000); // 15 min — pipeline + LB provisioning takes time

interface TfOutputs {
  eks_cluster_name?: { value: string };
  lab1_pipeline_name?: { value: string };
  lab1_codebuild_project?: { value: string };
  lab1_namespace?: { value: string };
  ecr_repos?: { value: Record<string, string> };
  [key: string]: any;
}

let tfOutputs: TfOutputs = {};

const envWithProfile = () => ({
  AWS_PROFILE: lab1Config.awsProfile,
  AWS_REGION: lab1Config.region,
  AWS_DEFAULT_REGION: lab1Config.region,
});

function runShell(cmd: string, opts: { cwd?: string; allowFailure?: boolean } = {}): { ok: boolean; out: string; err: string } {
  try {
    const out = execSync(cmd, {
      encoding: 'utf8',
      cwd: opts.cwd,
      env: { ...process.env, ...envWithProfile() },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return { ok: true, out: out.toString(), err: '' };
  } catch (e: any) {
    if (opts.allowFailure) return { ok: false, out: e.stdout?.toString() || '', err: e.stderr?.toString() || e.message };
    throw e;
  }
}

function captureTfOutputs(): TfOutputs {
  // Try outputs file first (faster, no terraform binary required).
  if (fs.existsSync(lab1Config.tfOutputsFile)) {
    return JSON.parse(fs.readFileSync(lab1Config.tfOutputsFile, 'utf8'));
  }
  // Fallback: shell out to terraform.
  const out = runShell('terraform output -json', { cwd: lab1Config.labEnvTfDir });
  const parsed = JSON.parse(out.out);
  fs.mkdirSync(lab1Config.workspaceRoot, { recursive: true });
  fs.writeFileSync(lab1Config.tfOutputsFile, JSON.stringify(parsed, null, 2));
  return parsed;
}

// ──────────────────────────────────────────────────────────────────────────
// Preflight
// ──────────────────────────────────────────────────────────────────────────

test.beforeAll(() => {
  const v = validateConfig();
  if (!v.ok) {
    printSetupInstructions();
    throw new Error(`Lab 1 preflight failed: missing ${v.missing.join(', ')}`);
  }
  tfOutputs = captureTfOutputs();
  if (!tfOutputs.eks_cluster_name?.value) {
    throw new Error('lab_env_student outputs missing eks_cluster_name. Did `terraform apply` succeed?');
  }
});

// ──────────────────────────────────────────────────────────────────────────
// Tests
// ──────────────────────────────────────────────────────────────────────────

test.describe.serial('IO-107 Lab 1: End-to-End EKS Deployment Pipeline', () => {
  test('Task 1: clone per-student CodeCommit repo (seeded from roi-cloud-fun/io-107 lab_1/)', () => {
    fs.mkdirSync(lab1Config.workspaceRoot, { recursive: true });
    if (fs.existsSync(lab1Config.repoDir)) {
      fs.rmSync(lab1Config.repoDir, { recursive: true, force: true });
    }

    const codeCommitUrl = tfOutputs.lab1_codecommit_clone_url?.value;
    expect(codeCommitUrl, 'tfOutputs.lab1_codecommit_clone_url missing — did terraform apply succeed?').toBeTruthy();

    // Configure codecommit credential helper for THIS clone (scoped to repoDir).
    // Avoids polluting the user's global ~/.gitconfig.
    const credHelper =
      `git -c credential.helper='!aws codecommit credential-helper $@' ` +
      `-c credential.UseHttpPath=true`;

    const r = runShell(`${credHelper} clone ${codeCommitUrl} ${lab1Config.repoDir}`);
    expect(r.ok, `clone failed: ${r.err}`).toBeTruthy();

    // CodeCommit was seeded with the monorepo's lab_1/ subdir, flattened —
    // so files are at the repo root, not nested under lab_1/.
    expect(fs.existsSync(path.join(lab1Config.repoDir, 'buildspec.yml'))).toBe(true);
    expect(fs.existsSync(path.join(lab1Config.repoDir, 'charts', 'myapp', 'values-dev.yaml'))).toBe(true);

    // Pin the credential helper on the clone so subsequent `git push` works.
    runShell(`git config credential.helper '!aws codecommit credential-helper $@'`, { cwd: lab1Config.repoDir });
    runShell(`git config credential.UseHttpPath true`, { cwd: lab1Config.repoDir });
  });

  test('Task 2: buildspec.yml is well-formed (no docker:20 runtime mistake)', () => {
    const buildspec = fs.readFileSync(path.join(lab1Config.repoDir, 'buildspec.yml'), 'utf8');
    expect(buildspec).not.toContain('docker: 20');  // the D1 defect we already fixed
    expect(buildspec).toMatch(/aws eks update-kubeconfig/);
    expect(buildspec).toMatch(/helm upgrade --install/);
    expect(buildspec).toMatch(/--atomic/);
  });

  test('Task 3: chart has IRSA-aware ServiceAccount + dev values', () => {
    const sa = fs.readFileSync(path.join(lab1Config.repoDir, 'charts', 'myapp', 'templates', 'serviceaccount.yaml'), 'utf8');
    expect(sa).toMatch(/eks\.amazonaws\.com\/role-arn/);
    const valuesDev = fs.readFileSync(path.join(lab1Config.repoDir, 'charts', 'myapp', 'values-dev.yaml'), 'utf8');
    expect(valuesDev).toMatch(/replicaCount/);
    expect(valuesDev).toMatch(/myapp-dev-role/);
  });

  test('Task 3 step 10a: substitute IRSA role ARN placeholder with per-student ARN', () => {
    // The fixture ships with a placeholder IRSA role ARN
    // (arn:aws:iam::123456789012:role/myapp-dev-role). The real per-student
    // IRSA role exists in IAM with a different account ID + name. Swap the
    // placeholder for the real ARN before pushing — otherwise the deployed
    // pod's ServiceAccount points at a non-existent role and IRSA silently
    // fails.
    const realArn = tfOutputs.lab1_myapp_dev_role_arn?.value;
    expect(realArn, 'tfOutputs.lab1_myapp_dev_role_arn missing — did the IRSA role provision?').toBeTruthy();
    expect(realArn).toMatch(/^arn:aws:iam::\d+:role\//);

    const file = path.join(lab1Config.repoDir, 'charts', 'myapp', 'values-dev.yaml');
    const before = fs.readFileSync(file, 'utf8');
    // Replace any arn:aws:iam::*:role/myapp-dev-role with the real per-student ARN.
    const after = before.replace(
      /arn:aws:iam::[0-9]+:role\/myapp-dev-role/g,
      realArn,
    );
    expect(after, 'IRSA ARN placeholder not found in values-dev.yaml — fixture changed?').not.toEqual(before);
    fs.writeFileSync(file, after);

    // Sanity-check the substitution landed.
    const verify = fs.readFileSync(file, 'utf8');
    expect(verify).toContain(realArn);
  });

  test('Task 4: bump replicaCount, commit, push', () => {
    const file = path.join(lab1Config.repoDir, 'charts', 'myapp', 'values-dev.yaml');
    const before = fs.readFileSync(file, 'utf8');
    const after = before.replace(/replicaCount:\s*\d+/, `replicaCount: ${lab1Config.expectedReplicaCount}`);
    expect(after).not.toEqual(before);  // confirm the substitution actually fired
    fs.writeFileSync(file, after);

    runShell('git config user.email "ltf@example.invalid"', { cwd: lab1Config.repoDir });
    runShell('git config user.name "LTF IO-107"', { cwd: lab1Config.repoDir });
    runShell('git add charts/myapp/values-dev.yaml', { cwd: lab1Config.repoDir });
    const commit = runShell(`git commit -m "Lab 1: bump dev replicaCount to ${lab1Config.expectedReplicaCount}"`, {
      cwd: lab1Config.repoDir, allowFailure: true,
    });
    if (!commit.ok && !/nothing to commit/.test(commit.err)) {
      throw new Error(`git commit failed: ${commit.err}`);
    }
    const push = runShell('git push origin HEAD:main', { cwd: lab1Config.repoDir });
    expect(push.ok).toBeTruthy();
  });

  test('Task 5: CodePipeline triggers + completes Succeeded within 10 min', async () => {
    const pipelineName = tfOutputs.lab1_pipeline_name?.value || lab1Config.pipelineName;
    const deadline = Date.now() + 10 * 60 * 1000;
    let state: any = null;
    let lastStatus = '';
    while (Date.now() < deadline) {
      const r = runShell(
        `aws codepipeline get-pipeline-state --name ${pipelineName} --output json`,
        { allowFailure: true },
      );
      if (r.ok) {
        state = JSON.parse(r.out);
        const stages = (state.stageStates || []).map((s: any) =>
          `${s.stageName}=${s.latestExecution?.status || '?'}`,
        );
        const overall = state.stageStates?.every((s: any) => s.latestExecution?.status === 'Succeeded') ? 'Succeeded' : 'In Progress';
        const failed = state.stageStates?.find((s: any) => s.latestExecution?.status === 'Failed');
        const newStatus = stages.join(' | ');
        if (newStatus !== lastStatus) {
          console.log(`[pipeline] ${overall}: ${newStatus}`);
          lastStatus = newStatus;
        }
        if (failed) throw new Error(`Pipeline stage failed: ${failed.stageName}`);
        if (overall === 'Succeeded') break;
      }
      await new Promise((res) => setTimeout(res, 15_000));
    }
    expect(state, 'CodePipeline state was never retrievable').toBeTruthy();
    const allGreen = state.stageStates.every((s: any) => s.latestExecution?.status === 'Succeeded');
    expect(allGreen, `Pipeline did not reach Succeeded — last state: ${lastStatus}`).toBeTruthy();
  });

  test('Task 5: CodeBuild log shows helm + kubectl checkpoint lines', () => {
    const project = tfOutputs.lab1_codebuild_project?.value || lab1Config.codebuildProjectName;
    const builds = runShell(
      `aws codebuild list-builds-for-project --project-name ${project} --max-items 1 --output json`,
    );
    const buildIds = JSON.parse(builds.out).ids || [];
    expect(buildIds.length).toBeGreaterThan(0);
    const detail = runShell(
      `aws codebuild batch-get-builds --ids ${buildIds[0]} --output json`,
    );
    const build = JSON.parse(detail.out).builds[0];
    const logGroup = build.logs?.groupName;
    const logStream = build.logs?.streamName;
    expect(logGroup).toBeTruthy();
    expect(logStream).toBeTruthy();
    const logs = runShell(
      `aws logs get-log-events --log-group-name ${logGroup} --log-stream-name ${logStream} --limit 1000 --output json`,
    );
    const events = JSON.parse(logs.out).events || [];
    const fullLog = events.map((e: any) => e.message).join('\n');
    expect(fullLog).toMatch(/Updated context.*kube\/config/);
    expect(fullLog).toMatch(/STATUS: deployed/);
    expect(fullLog).toMatch(/successfully rolled out/);
  });

  test('Task 6: kubectl shows 2 Running pods in the lab namespace', () => {
    const cluster = tfOutputs.eks_cluster_name!.value;
    const ns = tfOutputs.lab1_namespace?.value || lab1Config.namespace;
    runShell(`aws eks update-kubeconfig --name ${cluster} --region ${lab1Config.region}`);
    const pods = runShell(`kubectl get pods -n ${ns} -l app=myapp -o json`);
    const items = JSON.parse(pods.out).items || [];
    const running = items.filter((p: any) => p.status?.phase === 'Running' &&
      (p.status?.conditions || []).some((c: any) => c.type === 'Ready' && c.status === 'True'));
    expect(running.length, `expected ${lab1Config.expectedReplicaCount} Running+Ready pods, got ${running.length}`)
      .toBe(lab1Config.expectedReplicaCount);
  });

  test('Task 6: LoadBalancer service has an external endpoint', async () => {
    const ns = tfOutputs.lab1_namespace?.value || lab1Config.namespace;
    // The ELB hostname can take up to 4 minutes to populate. Poll.
    const deadline = Date.now() + 5 * 60 * 1000;
    let hostname = '';
    while (Date.now() < deadline) {
      const svc = runShell(
        `kubectl get svc -n ${ns} -o json`,
        { allowFailure: true },
      );
      if (svc.ok) {
        const items = JSON.parse(svc.out).items || [];
        const lb = items.find((s: any) => s.spec?.type === 'LoadBalancer');
        hostname = lb?.status?.loadBalancer?.ingress?.[0]?.hostname || lb?.status?.loadBalancer?.ingress?.[0]?.ip || '';
        if (hostname) break;
      }
      await new Promise((res) => setTimeout(res, 15_000));
    }
    expect(hostname, 'LoadBalancer did not get an external endpoint within 5 min').toBeTruthy();
    console.log(`[lab1] LB endpoint: ${hostname}`);
  });

  test('Task 7: IRSA env vars present inside pod', () => {
    const ns = tfOutputs.lab1_namespace?.value || lab1Config.namespace;
    const podName = runShell(
      `kubectl get pods -n ${ns} -l app=myapp -o jsonpath='{.items[0].metadata.name}'`,
    ).out.replace(/'/g, '').trim();
    expect(podName).toBeTruthy();
    const envOut = runShell(
      `kubectl exec -n ${ns} ${podName} -- env`,
      { allowFailure: true },
    );
    expect(envOut.ok, `kubectl exec env failed: ${envOut.err}`).toBeTruthy();
    expect(envOut.out).toMatch(/AWS_ROLE_ARN=arn:aws:iam::\d+:role\//);
    expect(envOut.out).toMatch(/AWS_WEB_IDENTITY_TOKEN_FILE=\/var\/run\/secrets\/eks\.amazonaws\.com/);
  });

  test('Task 7: IRSA can sign API calls (aws sts get-caller-identity from pod)', () => {
    // Use sts:GetCallerIdentity instead of s3:ls — sts doesn't require S3 perms
    // and works as a pure IRSA proof.
    const ns = tfOutputs.lab1_namespace?.value || lab1Config.namespace;
    const podName = runShell(
      `kubectl get pods -n ${ns} -l app=myapp -o jsonpath='{.items[0].metadata.name}'`,
    ).out.replace(/'/g, '').trim();
    const result = runShell(
      `kubectl exec -n ${ns} ${podName} -- aws sts get-caller-identity`,
      { allowFailure: true },
    );
    expect(result.ok, `aws sts get-caller-identity failed inside pod: ${result.err}`).toBeTruthy();
    expect(result.out).toMatch(/"Account"/);
    expect(result.out).toMatch(/assumed-role\/myapp-/);  // assumed role ARN contains the IRSA role name
  });

  // Summary of automated coverage from the inventory.
  test('Coverage report: which inventory steps got asserted vs manual-only', () => {
    const automated = inventory.steps.filter((s) => s.strategy !== 'manual-only').length;
    const manual = inventory.steps.filter((s) => s.strategy === 'manual-only').length;
    console.log(`[coverage] Lab 1 inventory: ${automated} automated / ${manual} manual-only steps (${inventory.steps.length} total)`);
    // No assertion — this is informational.
  });
});
