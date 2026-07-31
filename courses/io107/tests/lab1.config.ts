/**
 * IO-107 Lab 1 — End-to-End EKS Deployment Pipeline.
 *
 * Lab flow:
 *   1. Run lab_env_student/ Terraform — creates per-student EKS cluster, ECR, pipeline,
 *      CodeCommit repo (seeded from roi-cloud-fun/io-107 lab_1/ subdir), IRSA role, etc.
 *   2. LTF reads `terraform output -json` to discover the per-student CodeCommit URL,
 *      pipeline name, namespace, IRSA role ARN.
 *   3. LTF clones the CodeCommit repo (writable — student identity), substitutes the
 *      IRSA role ARN placeholder, edits replicaCount, commits + pushes.
 *   4. Pipeline runs end-to-end; LTF asserts pod count, IRSA env vars, etc.
 *
 * MANUAL INPUTS
 * -------------
 *   IO107_STUDENT_ID   (required) Short ID matching the student_id in the TF apply.
 *   IO107_REGION       (optional) Default us-east-1.
 *   AWS_PROFILE        (optional) Default 'roitraining'.
 *   LAB_ENV_TF_DIR     (optional) Override path to the lab_env_student/ apply dir.
 *
 *   No fork URL needed — the per-student CodeCommit is the writable source-of-truth
 *   and the LTF runner's IAM identity provides credentials via the codecommit
 *   credential helper.
 */

import { execSync } from 'child_process';
import * as path from 'path';
import { LAB_ENV_TF_PATH, COURSE_MONOREPO } from '../lab-source';

export const lab1Config = {
  studentId: process.env.IO107_STUDENT_ID || '',
  awsProfile: process.env.AWS_PROFILE || 'roitraining',
  region: process.env.IO107_REGION || 'us-east-1',
  labEnvTfDir: process.env.LAB_ENV_TF_DIR || LAB_ENV_TF_PATH,

  /** Per-student workspace where the CodeCommit repo is cloned and edited. */
  get workspaceRoot(): string {
    return path.resolve(__dirname, '..', '..', '..', 'test-results', 'io107-lab1', this.studentId || 'unset');
  },

  /** Where the CodeCommit clone lands. Note: this is the lab-flattened repo
   *  (no `lab_1/` prefix — the seed flattens the monorepo subdir to root). */
  get repoDir(): string {
    return path.join(this.workspaceRoot, 'student-repo');
  },

  get tfOutputsFile(): string {
    return path.join(this.workspaceRoot, '.tf-outputs.json');
  },

  expectedReplicaCount: 2,

  /** Per-student K8s namespace pattern (matches lab_env_student TF). */
  get namespace(): string { return `lab1-${this.studentId}`; },
  /** Pipeline / CodeBuild names (matches lab_env_student TF). */
  get pipelineName(): string { return `io107-${this.studentId}-lab1`; },
  get codebuildProjectName(): string { return `io107-${this.studentId}-lab1-build`; },

  monorepo: COURSE_MONOREPO,
};

export interface ToolRequirement {
  name: string;
  check: () => { ok: boolean; detail: string };
  howToFix: string;
  optional?: boolean;
}

export const requirements: ToolRequirement[] = [
  {
    name: 'aws CLI v2',
    check: () => {
      try {
        const out = execSync('aws --version', { encoding: 'utf8' }).trim();
        return { ok: /aws-cli\/2\./.test(out), detail: out };
      } catch { return { ok: false, detail: 'aws not on PATH' }; }
    },
    howToFix: 'Install AWS CLI v2',
  },
  {
    name: 'kubectl',
    check: () => {
      try {
        const out = execSync('kubectl version --client --output=yaml', { encoding: 'utf8' }).trim();
        return { ok: /clientVersion/.test(out), detail: out.split('\n')[0] };
      } catch { return { ok: false, detail: 'kubectl not on PATH' }; }
    },
    howToFix: 'Install kubectl',
  },
  {
    name: 'git',
    check: () => {
      try { return { ok: true, detail: execSync('git --version', { encoding: 'utf8' }).trim() }; }
      catch { return { ok: false, detail: 'git not on PATH' }; }
    },
    howToFix: 'Install Git',
  },
  {
    name: `aws profile "${lab1Config.awsProfile}" authenticates`,
    check: () => {
      try {
        const out = execSync(`aws sts get-caller-identity --profile ${lab1Config.awsProfile}`, { encoding: 'utf8' }).trim();
        return { ok: out.includes('Account'), detail: out };
      } catch (e: any) { return { ok: false, detail: e.message?.split('\n')[0] || 'sts call failed' }; }
    },
    howToFix: `aws configure --profile ${lab1Config.awsProfile}`,
  },
  {
    name: 'codecommit credential helper available',
    check: () => {
      try {
        execSync('aws codecommit help', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
        return { ok: true, detail: 'aws codecommit subcommand present' };
      } catch { return { ok: false, detail: 'aws codecommit subcommand missing' }; }
    },
    howToFix: 'Comes with AWS CLI v2 — same install path',
  },
];

export function validateConfig(): { ok: boolean; missing: string[]; warnings: string[] } {
  const missing: string[] = [];
  const warnings: string[] = [];

  if (!lab1Config.studentId) missing.push('IO107_STUDENT_ID');

  for (const r of requirements) {
    const result = r.check();
    if (!result.ok) {
      if (r.optional) warnings.push(`${r.name}: ${result.detail} — ${r.howToFix}`);
      else missing.push(`${r.name}: ${result.detail} — ${r.howToFix}`);
    }
  }
  return { ok: missing.length === 0, missing, warnings };
}

export function printSetupInstructions(): void {
  const v = validateConfig();
  if (v.ok) {
    console.log('IO-107 Lab 1 — all inputs + tooling satisfied');
    return;
  }
  console.log('IO-107 Lab 1 — missing:\n');
  v.missing.forEach((m) => console.log(`  ✗ ${m}`));
  console.log('\nSet env vars and re-run:');
  console.log('  export IO107_STUDENT_ID="ltf-smoke"');
  console.log('  export AWS_PROFILE="roitraining"   # optional');
  console.log('  export IO107_REGION="us-east-1"    # optional');
  console.log('\nThen: npm test -- --grep "IO-107 Lab 1"');
}
