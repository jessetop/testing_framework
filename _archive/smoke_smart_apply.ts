/**
 * Smoke test: run smart-apply against a real Lab 1 file-content block.
 * Confirms the path the runner uses actually rewrites a file on disk
 * the way a student would after reading the lab.
 */
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { parseLab } from '../core/walkthrough/parser';
import { applyFileContent } from '../core/walkthrough/file-apply';

const labPath = 'I:\\My Drive\\CourseCreationKit\\courses\\Terraform_Day_3\\labforge_iterations\\iteration_1\\Lab_01_Multi_Environment_State_Strategy.md';
const parsed = parseLab(labPath);

// Set up a scratch workspace mimicking what a student starts with.
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'walkthrough-smoke-'));
console.log('Scratch dir:', tmpDir);

// Seed with a starter terraform.tfvars (commented-out version, typical lab repo state).
const tfvarsPath = path.join(tmpDir, 'terraform.tfvars');
fs.writeFileSync(tfvarsPath, `# Set these per student before running.
# student_id          = "studentXX"
# state_bucket_name   = "studentXX-terraform-state-abc123"

# Region stays default for the class.
region = "us-east-1"
`);

// Seed with a starter providers.tf containing the bucket placeholder block.
const providersPath = path.join(tmpDir, 'providers.tf');
fs.writeFileSync(providersPath, `terraform {
  required_providers {
    aws = { source = "hashicorp/aws", version = "~> 5.0" }
  }
  backend "s3" {
    bucket  = "REPLACE_ME"
    key     = "networking/terraform.tfstate"
    region  = "us-east-1"
    encrypt = true
  }
}

provider "aws" {
  region = var.region
}
`);

console.log('\n=== BEFORE ===');
console.log('--- terraform.tfvars ---');
console.log(fs.readFileSync(tfvarsPath, 'utf8'));
console.log('--- providers.tf ---');
console.log(fs.readFileSync(providersPath, 'utf8'));

// Find Step 12's file-content blocks (tfvars + providers.tf per parser output).
const step12 = parsed.steps.find((s) => s.stepId === '12');
if (!step12) { console.error('Step 12 missing'); process.exit(1); }

// outputCache: what the runner would have captured from prior `terraform output`.
const subs = {
  state_bucket_name: 'student99-terraform-state-xyz789',
};
const env = {
  AWS_REGION: 'us-east-2',
  TERRAFORM_STUDENT_ID: 'student99',
  STUDENT: 'student99',
  USER: 'student99',
};

for (const b of step12.blocks) {
  if (b.classification !== 'file-content' || !b.targetPath) continue;
  const target = path.join(tmpDir, path.basename(b.targetPath));
  console.log(`\n>>> applyFileContent → ${b.targetPath}`);
  console.log('block content (first 200 chars):', JSON.stringify(b.content.slice(0, 200)));
  const result = applyFileContent(target, b.content, { substitutions: subs, env });
  console.log('result:', result);
}

console.log('\n=== AFTER ===');
console.log('--- terraform.tfvars ---');
console.log(fs.readFileSync(tfvarsPath, 'utf8'));
console.log('--- providers.tf ---');
console.log(fs.readFileSync(providersPath, 'utf8'));
