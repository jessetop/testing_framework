/**
 * Inline state-bucket creation for Terraform labs that need a backend but
 * don't include the bucket in their own state. Mirrors what Day 1-2 Lab 3
 * and Lab 1's state-infra create, but as a thin AWS CLI shim — we don't want
 * a full terraform apply just to provision a bucket for another lab to use.
 */

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { awsCli, assertOk } from './terraform-runner';

/** Write a JSON payload to a temp file and return its file:// URI for AWS CLI.
 *  On Windows + shell:true, inline JSON args lose their quotes; file:// works
 *  everywhere. Caller is responsible for cleaning up via the returned cleanup fn. */
function jsonArg(payload: unknown): { arg: string; cleanup: () => void } {
  const file = path.join(os.tmpdir(), `aws-arg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.json`);
  fs.writeFileSync(file, JSON.stringify(payload));
  return { arg: `file://${file}`, cleanup: () => { try { fs.unlinkSync(file); } catch { /* ignore */ } } };
}

export interface StateBucketOptions {
  bucket: string;
  region: string;
  profile: string;
}

/**
 * Create a versioned, encrypted, public-access-blocked S3 bucket suitable
 * for use as a Terraform `backend "s3"` with `use_lockfile = true`.
 * Idempotent: if the bucket already exists and is ours, returns silently.
 */
export function createStateBucket(opts: StateBucketOptions): void {
  const { bucket, region, profile } = opts;

  // Probe — if the bucket already exists and we own it, we're done.
  const head = awsCli(['s3api', 'head-bucket', '--bucket', bucket], profile);
  if (head.exitCode === 0) return;

  const createArgs = ['s3api', 'create-bucket', '--bucket', bucket];
  // us-east-1 is the implicit default; any other region requires a LocationConstraint.
  if (region !== 'us-east-1') {
    createArgs.push('--region', region);
    createArgs.push('--create-bucket-configuration', `LocationConstraint=${region}`);
  }
  assertOk(awsCli(createArgs, profile), `s3api create-bucket ${bucket}`);

  assertOk(
    awsCli(
      ['s3api', 'put-bucket-versioning', '--bucket', bucket, '--versioning-configuration', 'Status=Enabled'],
      profile,
    ),
    'put-bucket-versioning',
  );

  // AES256 default encryption — via file:// to avoid Windows shell quote stripping.
  const enc = jsonArg({
    Rules: [{ ApplyServerSideEncryptionByDefault: { SSEAlgorithm: 'AES256' } }],
  });
  try {
    assertOk(
      awsCli(
        ['s3api', 'put-bucket-encryption', '--bucket', bucket, '--server-side-encryption-configuration', enc.arg],
        profile,
      ),
      'put-bucket-encryption',
    );
  } finally { enc.cleanup(); }

  const pab = jsonArg({
    BlockPublicAcls: true,
    BlockPublicPolicy: true,
    IgnorePublicAcls: true,
    RestrictPublicBuckets: true,
  });
  try {
    assertOk(
      awsCli(
        ['s3api', 'put-public-access-block', '--bucket', bucket, '--public-access-block-configuration', pab.arg],
        profile,
      ),
      'put-public-access-block',
    );
  } finally { pab.cleanup(); }
}

/** Random 6-char lowercase suffix, matching the Day 1-2 / Lab 1 naming convention. */
export function randomSuffix(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let out = '';
  for (let i = 0; i < 6; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}
