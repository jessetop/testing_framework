/**
 * IO-107 Lab 4 — Aurora Blue/Green Deployment via Terraform + Pipeline.
 *
 * Longest of the four LTF tests. ~20 minutes wall-clock for the Blue/Green
 * provisioning + switchover. The test:
 *   - Bumps local.target_engine_version 15.4 → 15.5 in aurora_cluster.tf
 *   - Pushes — pipeline triggers
 *   - Polls Source + Build (plan) + Validate (OPA) stages
 *   - At Approval stage, programmatically approves via put-approval-result
 *   - Watches the apply phase's CLI Blue/Green flow
 *   - Verifies CloudTrail recorded CreateBlueGreenDeployment + SwitchoverBlueGreenDeployment
 */

import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { lab4Config, validateConfig } from './lab4.config';
import inventory from '../lab4.inventory';

test.setTimeout(30 * 60 * 1000);  // 30 min — Blue/Green takes 10-20 min

const env = () => ({ AWS_PROFILE: lab4Config.awsProfile, AWS_REGION: lab4Config.region, AWS_DEFAULT_REGION: lab4Config.region });

function runShell(cmd: string, opts: { cwd?: string; allowFailure?: boolean } = {}) {
  try {
    return { ok: true, out: execSync(cmd, { encoding: 'utf8', cwd: opts.cwd, env: { ...process.env, ...env() }, stdio: ['ignore', 'pipe', 'pipe'] }).toString(), err: '' };
  } catch (e: any) {
    if (opts.allowFailure) return { ok: false, out: e.stdout?.toString() || '', err: e.stderr?.toString() || e.message };
    throw e;
  }
}

test.beforeAll(() => {
  const v = validateConfig();
  if (!v.ok) throw new Error(`Lab 4 preflight failed: ${v.missing.join(', ')}`);
});

test.describe.serial('IO-107 Lab 4: Aurora Blue/Green via Terraform + Pipeline', () => {
  test('Task 1: Aurora cluster + pipeline exist', () => {
    const cluster = runShell(`aws rds describe-db-clusters --db-cluster-identifier ${lab4Config.auroraClusterId} --output json`, { allowFailure: true });
    expect(cluster.ok, `Aurora cluster ${lab4Config.auroraClusterId} not found — did lab_env_student apply succeed?`).toBeTruthy();
    const data = JSON.parse(cluster.out);
    expect(data.DBClusters?.[0]?.Status).toBe('available');
    expect(data.DBClusters?.[0]?.Engine).toBe('aurora-postgresql');
  });

  test('Task 2: clone per-student CodeCommit (seeded from roi-cloud-fun/io-107 lab_4/)', () => {
    fs.mkdirSync(lab4Config.workspaceRoot, { recursive: true });
    if (fs.existsSync(lab4Config.repoDir)) fs.rmSync(lab4Config.repoDir, { recursive: true, force: true });

    const tfOuts = JSON.parse(fs.readFileSync(lab4Config.tfOutputsFile, 'utf8'));
    const codeCommitUrl = tfOuts.lab4_codecommit_clone_url?.value;
    expect(codeCommitUrl, 'tfOutputs.lab4_codecommit_clone_url missing — did terraform apply succeed?').toBeTruthy();

    const credHelper =
      `git -c credential.helper='!aws codecommit credential-helper $@' ` +
      `-c credential.UseHttpPath=true`;
    expect(runShell(`${credHelper} clone ${codeCommitUrl} ${lab4Config.repoDir}`).ok).toBeTruthy();
    expect(fs.existsSync(path.join(lab4Config.repoDir, 'terraform', 'aurora_cluster.tf'))).toBe(true);

    runShell(`git config credential.helper '!aws codecommit credential-helper $@'`, { cwd: lab4Config.repoDir });
    runShell(`git config credential.UseHttpPath true`, { cwd: lab4Config.repoDir });
  });

  test('Task 3: aurora_cluster.tf has the documented structure', () => {
    const tf = fs.readFileSync(path.join(lab4Config.repoDir, 'terraform', 'aurora_cluster.tf'), 'utf8');
    expect(tf).toMatch(/local\.target_engine_version/);
    expect(tf).toMatch(/lifecycle\s*\{[\s\S]*?ignore_changes\s*=\s*\[engine_version\]/);
    expect(tf).toMatch(/terraform_data\.engine_version_target|"engine_version_target"/);
  });

  test('Task 4: bump target_engine_version', () => {
    const tfPath = path.join(lab4Config.repoDir, 'terraform', 'aurora_cluster.tf');
    let tf = fs.readFileSync(tfPath, 'utf8');
    tf = tf.replace(/target_engine_version\s*=\s*"[^"]+"/, `target_engine_version = "${lab4Config.targetEngineVersionTo}"`);
    fs.writeFileSync(tfPath, tf);
    expect(tf).toContain(`target_engine_version = "${lab4Config.targetEngineVersionTo}"`);
  });

  test('Task 5: commit + push triggers pipeline', () => {
    runShell('git config user.email "ltf@example.invalid"', { cwd: lab4Config.repoDir });
    runShell('git config user.name "LTF IO-107"', { cwd: lab4Config.repoDir });
    runShell('git add -A', { cwd: lab4Config.repoDir });
    const c = runShell(`git commit -m "Lab 4: bump engine ${lab4Config.targetEngineVersionFrom} -> ${lab4Config.targetEngineVersionTo} via Blue/Green"`, { cwd: lab4Config.repoDir, allowFailure: true });
    if (!c.ok && !/nothing to commit/.test(c.err)) throw new Error(`commit failed: ${c.err}`);
    expect(runShell('git push origin HEAD:main', { cwd: lab4Config.repoDir }).ok).toBeTruthy();
  });

  test('Task 5: Source + Build + Validate stages reach Succeeded (~5 min)', async () => {
    const deadline = Date.now() + 8 * 60 * 1000;
    while (Date.now() < deadline) {
      const r = runShell(`aws codepipeline get-pipeline-state --name ${lab4Config.pipelineName} --output json`, { allowFailure: true });
      if (r.ok) {
        const state = JSON.parse(r.out);
        const stages = state.stageStates || [];
        const validate = stages.find((s: any) => /validate/i.test(s.stageName));
        if (validate?.latestExecution?.status === 'Failed') throw new Error('Validate stage failed (OPA rejected the bump?)');
        if (validate?.latestExecution?.status === 'Succeeded') return;
      }
      await new Promise((res) => setTimeout(res, 15_000));
    }
    throw new Error('Validate stage did not reach Succeeded within 8 min');
  });

  test('Task 6: approve programmatically + watch Deploy run Blue/Green (~20 min)', async () => {
    // Wait for the Approval stage to become InProgress, then approve via API.
    const approvalDeadline = Date.now() + 5 * 60 * 1000;
    let approvalToken = '';
    let approvalStageName = '';
    let approvalActionName = '';

    while (Date.now() < approvalDeadline) {
      const r = runShell(`aws codepipeline get-pipeline-state --name ${lab4Config.pipelineName} --output json`, { allowFailure: true });
      if (r.ok) {
        const state = JSON.parse(r.out);
        for (const stage of state.stageStates || []) {
          for (const action of stage.actionStates || []) {
            if (action.latestExecution?.token && action.latestExecution?.status === 'InProgress') {
              approvalToken = action.latestExecution.token;
              approvalStageName = stage.stageName;
              approvalActionName = action.actionName;
            }
          }
        }
        if (approvalToken) break;
      }
      await new Promise((res) => setTimeout(res, 15_000));
    }

    expect(approvalToken, 'No approval token surfaced in pipeline state within 5 min').toBeTruthy();

    runShell(`aws codepipeline put-approval-result --pipeline-name ${lab4Config.pipelineName} --stage-name ${approvalStageName} --action-name ${approvalActionName} --result summary="LTF auto-approve",status=Approved --token ${approvalToken}`);

    // Watch Deploy stage. Blue/Green provisioning + switchover takes 10-20 min.
    const deployDeadline = Date.now() + 22 * 60 * 1000;
    while (Date.now() < deployDeadline) {
      const r = runShell(`aws codepipeline get-pipeline-state --name ${lab4Config.pipelineName} --output json`, { allowFailure: true });
      if (r.ok) {
        const state = JSON.parse(r.out);
        const deploy = state.stageStates?.find((s: any) => /deploy|apply/i.test(s.stageName));
        if (deploy?.latestExecution?.status === 'Failed') throw new Error('Deploy stage failed during Blue/Green');
        if (deploy?.latestExecution?.status === 'Succeeded') return;
      }
      await new Promise((res) => setTimeout(res, 30_000));
    }
    throw new Error('Deploy stage did not reach Succeeded within 22 min');
  });

  test('Task 7: engine_version on the live cluster is now the target', () => {
    const cluster = runShell(`aws rds describe-db-clusters --db-cluster-identifier ${lab4Config.auroraClusterId} --output json`);
    const ev = JSON.parse(cluster.out).DBClusters[0].EngineVersion;
    expect(ev.startsWith(lab4Config.targetEngineVersionTo)).toBe(true);
  });

  test('Task 8: CloudTrail recorded CreateBlueGreenDeployment + SwitchoverBlueGreenDeployment', () => {
    const sinceIso = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const ct = runShell(`aws cloudtrail lookup-events --lookup-attributes AttributeKey=EventSource,AttributeValue=rds.amazonaws.com --start-time ${sinceIso} --max-results 100 --output json`);
    const events = JSON.parse(ct.out).Events || [];
    const names = events.map((e: any) => e.EventName);
    expect(names).toContain('CreateBlueGreenDeployment');
    expect(names).toContain('SwitchoverBlueGreenDeployment');
  });

  test('Coverage report', () => {
    const automated = inventory.steps.filter((s) => s.strategy !== 'manual-only').length;
    console.log(`[coverage] Lab 4: ${automated}/${inventory.steps.length} steps automated`);
  });
});
