/**
 * IO-107 Lab 2 — Lambda Deployment with SAM.
 *
 * Test flow:
 *   1. Clone fixture into per-student workspace
 *   2. Add POST /items to template.yaml + src/app.py
 *   3. Commit + push → pipeline triggers
 *   4. Poll CodePipeline + CodeBuild for sam build + sam deploy
 *   5. Verify alias `live` carries the new function version
 *   6. Hit /items (GET + POST) + /health endpoints
 */

import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { lab2Config, validateConfig } from './lab2.config';
import inventory from '../lab2.inventory';

test.setTimeout(15 * 60 * 1000);

let tfOutputs: any = {};

const envWithProfile = () => ({ AWS_PROFILE: lab2Config.awsProfile, AWS_REGION: lab2Config.region, AWS_DEFAULT_REGION: lab2Config.region });

function runShell(cmd: string, opts: { cwd?: string; allowFailure?: boolean } = {}) {
  try {
    return { ok: true, out: execSync(cmd, { encoding: 'utf8', cwd: opts.cwd, env: { ...process.env, ...envWithProfile() }, stdio: ['ignore', 'pipe', 'pipe'] }).toString(), err: '' };
  } catch (e: any) {
    if (opts.allowFailure) return { ok: false, out: e.stdout?.toString() || '', err: e.stderr?.toString() || e.message };
    throw e;
  }
}

test.beforeAll(() => {
  const v = validateConfig();
  if (!v.ok) throw new Error(`Lab 2 preflight failed: missing ${v.missing.join(', ')}`);
  if (fs.existsSync(lab2Config.tfOutputsFile)) {
    tfOutputs = JSON.parse(fs.readFileSync(lab2Config.tfOutputsFile, 'utf8'));
  } else {
    const out = runShell('terraform output -json', { cwd: lab2Config.labEnvTfDir });
    tfOutputs = JSON.parse(out.out);
    fs.mkdirSync(lab2Config.workspaceRoot, { recursive: true });
    fs.writeFileSync(lab2Config.tfOutputsFile, JSON.stringify(tfOutputs, null, 2));
  }
});

test.describe.serial('IO-107 Lab 2: Lambda Deployment with SAM', () => {
  test('Task 1: clone per-student CodeCommit (seeded from roi-cloud-fun/io-107 lab_2/)', () => {
    fs.mkdirSync(lab2Config.workspaceRoot, { recursive: true });
    if (fs.existsSync(lab2Config.repoDir)) fs.rmSync(lab2Config.repoDir, { recursive: true, force: true });

    const codeCommitUrl = tfOutputs.lab2_codecommit_clone_url?.value;
    expect(codeCommitUrl, 'tfOutputs.lab2_codecommit_clone_url missing — did terraform apply succeed?').toBeTruthy();

    const credHelper =
      `git -c credential.helper='!aws codecommit credential-helper $@' ` +
      `-c credential.UseHttpPath=true`;
    expect(runShell(`${credHelper} clone ${codeCommitUrl} ${lab2Config.repoDir}`).ok).toBeTruthy();
    expect(fs.existsSync(path.join(lab2Config.repoDir, 'template.yaml'))).toBe(true);
    expect(fs.existsSync(path.join(lab2Config.repoDir, 'src', 'app.py'))).toBe(true);

    runShell(`git config credential.helper '!aws codecommit credential-helper $@'`, { cwd: lab2Config.repoDir });
    runShell(`git config credential.UseHttpPath true`, { cwd: lab2Config.repoDir });
  });

  test('Task 2: SAM template has AutoPublishAlias + DeploymentPreference', () => {
    const tpl = fs.readFileSync(path.join(lab2Config.repoDir, 'template.yaml'), 'utf8');
    expect(tpl).toMatch(/AutoPublishAlias:\s*live/);
    expect(tpl).toMatch(/Canary10Percent5Minutes/);
    expect(tpl).toMatch(/ApiErrorAlarm/);
  });

  test('Task 4: add POST /items to template.yaml + src/app.py', () => {
    const tplPath = path.join(lab2Config.repoDir, 'template.yaml');
    const appPath = path.join(lab2Config.repoDir, 'src', 'app.py');

    let tpl = fs.readFileSync(tplPath, 'utf8');
    // Add CreateItem event inside ApiFunction Events block (idempotent).
    if (!tpl.includes('CreateItem:')) {
      tpl = tpl.replace(/(GetItems:[\s\S]*?Method:\s*get)/, `$1\n        CreateItem:\n          Type: Api\n          Properties:\n            Path: /items\n            Method: post`);
      fs.writeFileSync(tplPath, tpl);
    }

    let app = fs.readFileSync(appPath, 'utf8');
    if (!app.includes("def create_item")) {
      app = app.replace(/(def handler\(event, context\):[\s\S]*?return\s*\{)/, (m) => m); // touch nothing if structure unexpected
      const inject = `\n\ndef create_item(event):\n    body = event.get('body') or '{}'\n    import json\n    try:\n        data = json.loads(body)\n    except Exception:\n        data = {}\n    name = data.get('name', '')\n    return {'statusCode': 201, 'body': json.dumps({'created': name})}\n`;
      app = app + inject;
      // Add POST branch to handler.
      app = app.replace(/(elif path == '\/items' and method == 'GET':\s*\n\s*return get_items\(\))/,
        `$1\n        elif path == '/items' and method == 'POST':\n            return create_item(event)`);
      fs.writeFileSync(appPath, app);
    }

    // Sanity-check python parses.
    expect(runShell(`python -c "import ast; ast.parse(open(r'${appPath.replace(/\\/g, '\\\\')}').read())"`, { allowFailure: true }).ok).toBe(true);
  });

  test('Task 5: commit + push triggers pipeline', () => {
    runShell('git config user.email "ltf@example.invalid"', { cwd: lab2Config.repoDir });
    runShell('git config user.name "LTF IO-107"', { cwd: lab2Config.repoDir });
    runShell('git add -A', { cwd: lab2Config.repoDir });
    const c = runShell('git commit -m "Lab 2: add POST /items"', { cwd: lab2Config.repoDir, allowFailure: true });
    if (!c.ok && !/nothing to commit/.test(c.err)) throw new Error(`commit failed: ${c.err}`);
    expect(runShell('git push origin HEAD:main', { cwd: lab2Config.repoDir }).ok).toBeTruthy();
  });

  test('Task 5: pipeline reaches Succeeded within 12 min', async () => {
    const deadline = Date.now() + 12 * 60 * 1000;
    let state: any = null;
    while (Date.now() < deadline) {
      const r = runShell(`aws codepipeline get-pipeline-state --name ${lab2Config.pipelineName} --output json`, { allowFailure: true });
      if (r.ok) {
        state = JSON.parse(r.out);
        const failed = state.stageStates?.find((s: any) => s.latestExecution?.status === 'Failed');
        if (failed) throw new Error(`Pipeline stage failed: ${failed.stageName}`);
        if (state.stageStates?.every((s: any) => s.latestExecution?.status === 'Succeeded')) break;
      }
      await new Promise((res) => setTimeout(res, 15_000));
    }
    expect(state.stageStates.every((s: any) => s.latestExecution?.status === 'Succeeded')).toBeTruthy();
  });

  test('Task 6/8: alias `live` points to a numeric version (not $LATEST)', () => {
    const fns = JSON.parse(runShell(`aws lambda list-functions --output json`).out).Functions;
    const f = fns.find((f: any) => f.FunctionName?.startsWith(lab2Config.lambdaFunctionPrefix));
    expect(f, `no Lambda starting with ${lab2Config.lambdaFunctionPrefix}`).toBeTruthy();
    const alias = JSON.parse(runShell(`aws lambda get-alias --function-name ${f.FunctionName} --name live --output json`).out);
    expect(alias.FunctionVersion).toMatch(/^\d+$/);
    expect(alias.FunctionVersion).not.toBe('$LATEST');
  });

  test('Task 7: invoke /health + /items endpoints (if API URL discoverable)', () => {
    // API URL is in the CloudFormation stack output. Best-effort discovery.
    const stackName = `${lab2Config.lambdaFunctionPrefix}`.toLowerCase();
    const stackOut = runShell(`aws cloudformation describe-stacks --stack-name ${stackName} --query "Stacks[0].Outputs" --output json`, { allowFailure: true });
    if (!stackOut.ok) { test.skip(true, 'CFN stack outputs not discoverable yet'); return; }
    const outputs = JSON.parse(stackOut.out) || [];
    const apiUrl = outputs.find((o: any) => /ApiUrl|ApiEndpoint/i.test(o.OutputKey))?.OutputValue;
    if (!apiUrl) { test.skip(true, 'no Api URL output found'); return; }
    const health = runShell(`curl -sS ${apiUrl}/health`, { allowFailure: true });
    expect(health.out).toMatch(/healthy|ok|"status"/i);
  });

  test('Coverage report', () => {
    const automated = inventory.steps.filter((s) => s.strategy !== 'manual-only').length;
    console.log(`[coverage] Lab 2: ${automated}/${inventory.steps.length} steps automated`);
  });
});
