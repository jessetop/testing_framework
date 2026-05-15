/**
 * Lock Manager
 *
 * Prevents parallel test runs by maintaining lock files.
 * Detects and handles stale locks (dead processes or expired locks).
 */

import * as fs from 'fs';
import * as path from 'path';
import { LabLock, LockAcquireOptions, LockAcquireResult } from './types';

/** Default maximum age for locks in hours */
const DEFAULT_MAX_AGE_HOURS = 4;

export class LockManager {
  private stateDir: string;

  constructor(stateDir: string = '.state') {
    this.stateDir = stateDir;
    this.ensureStateDir();
  }

  /**
   * Ensure the state directory exists
   */
  private ensureStateDir(): void {
    if (!fs.existsSync(this.stateDir)) {
      fs.mkdirSync(this.stateDir, { recursive: true });
    }
  }

  /**
   * Get the lock file path for a lab
   */
  private getLockPath(labId: string): string {
    return path.join(this.stateDir, `${labId}.lock`);
  }

  /**
   * Check if a process is still running
   */
  private isProcessRunning(pid: number): boolean {
    try {
      // Sending signal 0 checks if process exists without actually sending a signal
      process.kill(pid, 0);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Check if a lock is stale (process dead or too old)
   */
  isStale(lock: LabLock, maxAgeHours: number = DEFAULT_MAX_AGE_HOURS): boolean {
    // Check if process is dead
    if (!this.isProcessRunning(lock.pid)) {
      return true;
    }

    // Check if lock is too old
    const startedAt = new Date(lock.startedAt);
    const now = new Date();
    const ageHours = (now.getTime() - startedAt.getTime()) / (1000 * 60 * 60);

    return ageHours > maxAgeHours;
  }

  /**
   * Read the current lock for a lab
   */
  async read(labId: string): Promise<LabLock | null> {
    const lockPath = this.getLockPath(labId);

    if (!fs.existsSync(lockPath)) {
      return null;
    }

    try {
      const content = fs.readFileSync(lockPath, 'utf-8');
      return JSON.parse(content) as LabLock;
    } catch {
      // Corrupted lock file, treat as no lock
      return null;
    }
  }

  /**
   * Attempt to acquire a lock for a lab
   *
   * Returns success if:
   * - No existing lock
   * - Existing lock is stale (process dead or > maxAgeHours old)
   * - Force option is true
   */
  async acquire(labId: string, options: LockAcquireOptions): Promise<LockAcquireResult> {
    const existingLock = await this.read(labId);
    const maxAgeHours = options.maxAgeHours ?? DEFAULT_MAX_AGE_HOURS;

    if (existingLock) {
      // Check if lock is stale
      if (this.isStale(existingLock, maxAgeHours)) {
        console.log(`\u26A0\uFE0F  Found stale lock for ${labId} (PID ${existingLock.pid} no longer running or lock expired)`);
        console.log(`   Removing stale lock and proceeding...`);

        // Remove stale lock
        fs.unlinkSync(this.getLockPath(labId));

        // Create new lock
        const newLock = await this.createLock(labId, options.totalSteps);
        return { acquired: true, staleLockRemoved: true };
      }

      // Lock is active - blocked
      if (!options.force) {
        return {
          acquired: false,
          error: `Lock held by PID ${existingLock.pid}`,
          existingLock,
        };
      }

      // Force acquire
      console.log(`\u26A0\uFE0F  Force acquiring lock (removing lock held by PID ${existingLock.pid})`);
    }

    // Create new lock
    await this.createLock(labId, options.totalSteps);
    return { acquired: true };
  }

  /**
   * Create a new lock file
   */
  private async createLock(labId: string, totalSteps: number): Promise<LabLock> {
    const lock: LabLock = {
      labId,
      currentStep: -1,
      totalSteps,
      startedAt: new Date().toISOString(),
      pid: process.pid,
    };

    const lockPath = this.getLockPath(labId);
    fs.writeFileSync(lockPath, JSON.stringify(lock, null, 2));

    return lock;
  }

  /**
   * Update an existing lock with new data
   */
  async update(labId: string, data: Partial<LabLock>): Promise<void> {
    const lock = await this.read(labId);

    if (!lock) {
      throw new Error(`No lock found for ${labId}`);
    }

    const updatedLock: LabLock = {
      ...lock,
      ...data,
    };

    const lockPath = this.getLockPath(labId);
    fs.writeFileSync(lockPath, JSON.stringify(updatedLock, null, 2));
  }

  /**
   * Release a lock
   */
  async release(labId: string): Promise<void> {
    const lockPath = this.getLockPath(labId);

    if (fs.existsSync(lockPath)) {
      fs.unlinkSync(lockPath);
    }
  }

  /**
   * List all active locks
   */
  async listLocks(): Promise<LabLock[]> {
    if (!fs.existsSync(this.stateDir)) {
      return [];
    }

    const files = fs.readdirSync(this.stateDir);
    const locks: LabLock[] = [];

    for (const file of files) {
      if (file.endsWith('.lock')) {
        const labId = file.replace('.lock', '');
        const lock = await this.read(labId);
        if (lock) {
          locks.push(lock);
        }
      }
    }

    return locks;
  }

  /**
   * Force unlock a lab (for manual recovery)
   */
  async forceUnlock(labId: string): Promise<{ removed: boolean; lock?: LabLock }> {
    const lock = await this.read(labId);

    if (!lock) {
      return { removed: false };
    }

    await this.release(labId);
    return { removed: true, lock };
  }
}
