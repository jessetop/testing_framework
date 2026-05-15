/**
 * Terraform + AWS CLI runner helpers.
 *
 * Thin wrappers around child_process.spawn that return structured results
 * (stdout, stderr, exit code, duration). All terraform commands run with
 * TF_INPUT=0 so they never block on interactive prompts. All AWS commands
 * are scoped to a named profile.
 */

import { spawn, spawnSync, SpawnOptionsWithoutStdio, ChildProcess } from 'child_process';

export interface CliResult {
  exitCode: number;
  stdout: string;
  stderr: string;
  durationMs: number;
}

export interface RunOptions {
  cwd?: string;
  /** Extra env merged on top of process.env. */
  env?: Record<string, string>;
  /** Hard timeout in milliseconds. Default 600000 (10 min). */
  timeoutMs?: number;
  /** Stream output to console as it arrives (useful for long applies). */
  stream?: boolean;
}

function runSync(cmd: string, args: string[], opts: RunOptions = {}): CliResult {
  const started = Date.now();
  const child = spawnSync(cmd, args, {
    cwd: opts.cwd,
    env: { ...process.env, ...(opts.env || {}) },
    timeout: opts.timeoutMs ?? 600_000,
    encoding: 'utf8',
    shell: process.platform === 'win32',  // .cmd shims on Windows
  });
  const stdout = child.stdout || '';
  const stderr = child.stderr || '';
  if (opts.stream) {
    if (stdout) process.stdout.write(stdout);
    if (stderr) process.stderr.write(stderr);
  }
  return {
    exitCode: child.status ?? -1,
    stdout,
    stderr,
    durationMs: Date.now() - started,
  };
}

/** Run a terraform command. TF_INPUT=0 prevents interactive prompts. */
export function tf(args: string[], opts: RunOptions = {}): CliResult {
  return runSync('terraform', args, {
    ...opts,
    env: { TF_INPUT: '0', TF_IN_AUTOMATION: '1', ...(opts.env || {}) },
  });
}

/** Spawn terraform asynchronously — for the locking-demo parallel applies. */
export interface AsyncTfHandle {
  child: ChildProcess;
  stdoutPromise: Promise<string>;
  stderrPromise: Promise<string>;
  exitPromise: Promise<number>;
}

export function tfAsync(args: string[], opts: RunOptions = {}): AsyncTfHandle {
  const spawnOpts: SpawnOptionsWithoutStdio = {
    cwd: opts.cwd,
    env: { ...process.env, TF_INPUT: '0', TF_IN_AUTOMATION: '1', ...(opts.env || {}) },
    shell: process.platform === 'win32',
  };
  const child = spawn('terraform', args, spawnOpts);

  const collect = (stream: NodeJS.ReadableStream): Promise<string> =>
    new Promise((resolve) => {
      const chunks: Buffer[] = [];
      stream.on('data', (c) => chunks.push(Buffer.from(c)));
      stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    });

  return {
    child,
    stdoutPromise: collect(child.stdout!),
    stderrPromise: collect(child.stderr!),
    exitPromise: new Promise((resolve) => child.on('exit', (code) => resolve(code ?? -1))),
  };
}

/** Run an AWS CLI command scoped to a profile. JSON output by default. */
export function awsCli(args: string[], profile: string, opts: RunOptions = {}): CliResult {
  const fullArgs = [...args, '--profile', profile];
  // Only add --output json if the caller didn't already specify one.
  if (!args.includes('--output')) fullArgs.push('--output', 'json');
  return runSync('aws', fullArgs, opts);
}

/** Parse the JSON stdout of an AWS CLI call. Throws if non-zero exit or invalid JSON. */
export function awsJson<T = any>(result: CliResult, context: string): T {
  if (result.exitCode !== 0) {
    throw new Error(`${context} failed (exit ${result.exitCode}):\n${result.stderr || result.stdout}`);
  }
  try {
    return JSON.parse(result.stdout) as T;
  } catch (e) {
    throw new Error(`${context} returned non-JSON output:\n${result.stdout}`);
  }
}

/** Assert a CLI result was successful, surfacing stderr in the error message. */
export function assertOk(result: CliResult, context: string): void {
  if (result.exitCode !== 0) {
    throw new Error(
      `${context} failed (exit ${result.exitCode}, ${result.durationMs}ms):\n` +
      `--- stdout ---\n${result.stdout}\n--- stderr ---\n${result.stderr}`,
    );
  }
}
