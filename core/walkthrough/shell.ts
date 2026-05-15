/**
 * Persistent bash shell — the executor for `local-cli` / `aws-cli` strategies.
 *
 * Spawns a single `bash` process (Git Bash on Windows, /bin/bash on Linux/macOS)
 * and pipes commands to its stdin. CWD and env vars persist across all
 * commands sent to the same shell — same as if a student typed the commands
 * into a terminal session.
 *
 * Output is captured by appending an end-of-command marker after each
 * caller-issued command. The shell echoes the marker (along with the prior
 * command's `$?` and `pwd`); we read stdout/stderr up to the marker and parse
 * exit code + new CWD from it.
 */

import { spawn, ChildProcessWithoutNullStreams } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

export interface ShellOptions {
  cwd: string;
  env?: Record<string, string>;
  /** Override bash binary. Auto-detected if omitted. */
  bashPath?: string;
}

export interface RunOptions {
  /** Max time before this command is aborted (ms). Default 600000 (10 min). */
  timeoutMs?: number;
  /** Stream output to console as it arrives (useful for very long commands). */
  stream?: boolean;
}

export interface RunResult {
  command: string;
  stdout: string;
  stderr: string;
  exitCode: number;
  /** CWD after the command completed (may differ if command was `cd`). */
  cwdAfter: string;
  durationMs: number;
  timedOut: boolean;
}

function findBash(override?: string): string {
  if (override && fs.existsSync(override)) return override;
  if (process.platform === 'win32') {
    const candidates = [
      'C:\\Program Files\\Git\\bin\\bash.exe',
      'C:\\Program Files (x86)\\Git\\bin\\bash.exe',
    ];
    for (const c of candidates) {
      if (fs.existsSync(c)) return c;
    }
    return 'bash.exe';  // fall back to PATH lookup
  }
  return '/bin/bash';
}

export class PersistentShell {
  private child?: ChildProcessWithoutNullStreams;
  private cwd: string;
  private env: Record<string, string>;
  private bashPath: string;
  private stdoutBuf = '';
  private stderrBuf = '';
  private stdoutListeners: Array<(chunk: string) => void> = [];
  private stderrListeners: Array<(chunk: string) => void> = [];

  constructor(opts: ShellOptions) {
    this.cwd = path.resolve(opts.cwd);
    this.env = { ...process.env, ...(opts.env || {}) } as Record<string, string>;
    this.bashPath = findBash(opts.bashPath);
  }

  async start(): Promise<void> {
    if (this.child) return;
    fs.mkdirSync(this.cwd, { recursive: true });
    this.child = spawn(this.bashPath, ['--noprofile', '--norc', '-i'], {
      cwd: this.cwd,
      env: this.env,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    this.child.stdout.setEncoding('utf8');
    this.child.stderr.setEncoding('utf8');
    this.child.stdout.on('data', (chunk: string) => {
      this.stdoutBuf += chunk;
      for (const l of this.stdoutListeners) l(chunk);
    });
    this.child.stderr.on('data', (chunk: string) => {
      this.stderrBuf += chunk;
      for (const l of this.stderrListeners) l(chunk);
    });
    // Disable terminal control sequences and PS1 noise to keep output clean.
    await this.send('export PS1=""; export PS2=""; set +o history; export TERM=dumb');
    // Drain whatever the shell prints on startup (banners, etc.).
    await this.waitForMarker('___SHELL_READY___', 5_000).catch(() => { /* ignore */ });
  }

  /** Lower-level send — writes a single line to bash stdin. */
  private send(line: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.child) return reject(new Error('shell not started'));
      this.child.stdin.write(line + '\n', (err) => (err ? reject(err) : resolve()));
    });
  }

  /**
   * Run a multi-line command and wait for the end-of-command marker.
   *
   * The command itself can span multiple lines (we just write all of it to
   * stdin, then write a `printf` line with the marker so we know it finished).
   */
  async run(command: string, opts: RunOptions = {}): Promise<RunResult> {
    if (!this.child) throw new Error('shell not started — call start() first');
    const marker = `___WALKTHROUGH_END_${Date.now()}_${Math.random().toString(36).slice(2, 8)}___`;
    // Reset buffers so we read only THIS command's output.
    this.stdoutBuf = '';
    this.stderrBuf = '';
    const started = Date.now();

    // Write the command, then a marker line that captures $? and pwd.
    // We use bash command grouping `{ ...; }` to ensure $? reflects the last
    // command in the user's block (terminated by a newline).
    const wrapped = `{\n${command}\n}\n__rc=$?; __pwd=$(pwd); printf "\\n${marker} %d %s\\n" "$__rc" "$__pwd" 1>&2`;
    await this.send(wrapped);

    let stderrCaptured = '';
    let timedOut = false;
    const markerRe = new RegExp(`\\n?${marker} (\\d+) (.*)\\n?`);
    const deadline = Date.now() + (opts.timeoutMs ?? 600_000);

    while (true) {
      const m = this.stderrBuf.match(markerRe);
      if (m) {
        const exitCode = parseInt(m[1], 10);
        const newCwd = m[2].trim();
        const stderrText = this.stderrBuf.replace(markerRe, '').replace(/\s+$/g, '');
        const stdoutText = this.stdoutBuf.replace(/\s+$/g, '');
        stderrCaptured = stderrText;
        this.cwd = newCwd;
        return {
          command,
          stdout: stdoutText,
          stderr: stderrCaptured,
          exitCode,
          cwdAfter: newCwd,
          durationMs: Date.now() - started,
          timedOut: false,
        };
      }
      if (Date.now() > deadline) {
        timedOut = true;
        // Try to abort the running command with Ctrl-C.
        this.child!.stdin.write('\x03');
        return {
          command,
          stdout: this.stdoutBuf,
          stderr: this.stderrBuf,
          exitCode: -1,
          cwdAfter: this.cwd,
          durationMs: Date.now() - started,
          timedOut: true,
        };
      }
      await sleep(100);
    }
  }

  /** Wait until a substring appears in stderr; used during shell startup. */
  private waitForMarker(marker: string, timeoutMs: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const deadline = Date.now() + timeoutMs;
      const check = () => {
        if (this.stderrBuf.includes(marker) || this.stdoutBuf.includes(marker)) return resolve();
        if (Date.now() > deadline) return reject(new Error(`timeout waiting for ${marker}`));
        setTimeout(check, 50);
      };
      check();
    });
  }

  getCwd(): string {
    return this.cwd;
  }

  async stop(): Promise<void> {
    if (!this.child) return;
    this.child.stdin.end();
    return new Promise((resolve) => {
      this.child!.on('exit', () => resolve());
      setTimeout(() => {
        if (this.child) this.child.kill('SIGKILL');
        resolve();
      }, 2000);
    });
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
