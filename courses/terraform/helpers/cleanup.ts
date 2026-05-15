/**
 * Cleanup helpers for Terraform labs.
 *
 * The S3 state bucket has versioning enabled, so `terraform destroy` on the
 * state-infra stack fails until every object version + delete marker is gone.
 * emptyVersionedBucket() handles that.
 */

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { awsCli, awsJson, tf, assertOk, CliResult } from './terraform-runner';

interface ObjectVersion {
  Key: string;
  VersionId: string;
}

interface ListVersionsResponse {
  Versions?: ObjectVersion[];
  DeleteMarkers?: ObjectVersion[];
  IsTruncated?: boolean;
  NextKeyMarker?: string;
  NextVersionIdMarker?: string;
}

/**
 * Delete every object version and delete marker in a versioned bucket.
 * Safe to call on an already-empty or non-existent bucket — returns false.
 */
export function emptyVersionedBucket(bucket: string, profile: string): boolean {
  const head = awsCli(['s3api', 'head-bucket', '--bucket', bucket], profile);
  if (head.exitCode !== 0) {
    return false;  // bucket doesn't exist or no access — nothing to do
  }

  let keyMarker: string | undefined;
  let versionIdMarker: string | undefined;
  let totalDeleted = 0;

  // Loop through pages.
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const listArgs = ['s3api', 'list-object-versions', '--bucket', bucket, '--max-items', '1000'];
    if (keyMarker) listArgs.push('--starting-token', `${keyMarker}__${versionIdMarker || ''}`);
    const list = awsCli(listArgs, profile);
    if (list.exitCode !== 0) {
      throw new Error(`list-object-versions failed: ${list.stderr}`);
    }
    if (!list.stdout.trim()) break;
    const parsed = awsJson<ListVersionsResponse>(list, 'list-object-versions');
    const objects = [...(parsed.Versions || []), ...(parsed.DeleteMarkers || [])];
    if (objects.length === 0) break;

    // s3api delete-objects takes a Delete struct via --delete. On Windows the
    // shell strips the outer quotes from a JSON-string arg, which makes the CLI
    // fail to parse it. Write the payload to a temp file and pass file://...
    // instead — works on every platform.
    const deletePayload = {
      Objects: objects.map((o) => ({ Key: o.Key, VersionId: o.VersionId })),
      Quiet: true,
    };
    const payloadFile = path.join(os.tmpdir(), `delete-objects-${Date.now()}-${process.pid}.json`);
    fs.writeFileSync(payloadFile, JSON.stringify(deletePayload));
    try {
      const deleteArgs = [
        's3api', 'delete-objects',
        '--bucket', bucket,
        '--delete', `file://${payloadFile}`,
      ];
      const del = awsCli(deleteArgs, profile);
      if (del.exitCode !== 0) {
        throw new Error(`delete-objects failed: ${del.stderr}`);
      }
      totalDeleted += objects.length;
    } finally {
      try { fs.unlinkSync(payloadFile); } catch { /* best effort */ }
    }

    if (!parsed.IsTruncated) break;
    keyMarker = parsed.NextKeyMarker;
    versionIdMarker = parsed.NextVersionIdMarker;
  }

  if (totalDeleted > 0) {
    console.log(`  Emptied ${totalDeleted} object(s) from s3://${bucket}/`);
  }
  return true;
}

/** terraform destroy with auto-approve. Returns the CliResult — caller decides whether to assert.
 *
 *  AWS_PROFILE is propagated to the destroy process; without it, terraform falls
 *  back to env-var credentials which may be invalid on the test machine. */
export function tfDestroy(cwd: string, profile?: string): CliResult {
  if (!fs.existsSync(cwd)) {
    return { exitCode: 0, stdout: '', stderr: '', durationMs: 0 };  // never built — nothing to destroy
  }
  const env: Record<string, string> = {};
  if (profile) env.AWS_PROFILE = profile;
  return tf(['destroy', '-auto-approve', '-no-color'], { cwd, env, timeoutMs: 600_000 });
}

/**
 * Best-effort: assert the lab's two AWS resources no longer exist.
 * Returns a list of leaked resource names (empty = clean).
 */
export function findLeakedResources(
  stateBucketName: string,
  lockTableName: string,
  profile: string,
): string[] {
  const leaks: string[] = [];

  const bucket = awsCli(['s3api', 'head-bucket', '--bucket', stateBucketName], profile);
  if (bucket.exitCode === 0) leaks.push(`s3://${stateBucketName}`);

  const table = awsCli(['dynamodb', 'describe-table', '--table-name', lockTableName], profile);
  if (table.exitCode === 0) leaks.push(`dynamodb:${lockTableName}`);

  return leaks;
}

/** Pretty-print a destroy result without failing the test if it errored. */
export function logDestroyOutcome(label: string, result: CliResult): void {
  if (result.durationMs === 0) {
    console.log(`  [${label}] skipped (no workspace)`);
    return;
  }
  const ok = result.exitCode === 0 ? '✓' : '✗';
  console.log(`  [${label}] ${ok} (exit ${result.exitCode}, ${(result.durationMs / 1000).toFixed(1)}s)`);
  if (result.exitCode !== 0) {
    const tail = result.stderr.split('\n').slice(-10).join('\n');
    console.log(`    stderr tail: ${tail}`);
  }
}

/** Used by assertOk-style callers that want to fail loudly. */
export { assertOk };
