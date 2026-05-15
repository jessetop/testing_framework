/**
 * State Fixture
 *
 * Playwright fixture that provides lock and checkpoint management for lab tests.
 * Enables resuming tests from where they left off and prevents parallel runs.
 */

import { test as base, Page } from '@playwright/test';
import * as path from 'path';
import { LockManager, CheckpointManager, Checkpoint, LabLock, LockAcquireResult } from '../state';

const AUTH_FILE = path.join(__dirname, '../../.auth/aws-session.json');
const STATE_DIR = path.join(__dirname, '../../.state');

/**
 * Lab state fixture class
 * Manages lock acquisition, checkpoint loading/saving, and resource cleanup
 */
export class LabStateFixture {
  public lock: LockManager;
  public checkpoint: CheckpointManager;
  public labId: string;

  /** Current instance ID (from checkpoint or newly launched) */
  public instanceId?: string;

  /** Current public IP (from checkpoint or newly obtained) */
  public publicIp?: string;

  /** Current security group ID */
  public securityGroupId?: string;

  /** AWS region */
  public region?: string;

  /** Whether this is a resumed run */
  public isResumed: boolean = false;

  /** List of step names that have been completed */
  private completedSteps: string[] = [];

  /** Whether all tests have passed so far */
  private allTestsPassed: boolean = true;

  /** Total steps for this lab */
  private totalSteps: number;

  constructor(labId: string, totalSteps: number = 10) {
    this.labId = labId;
    this.totalSteps = totalSteps;
    this.lock = new LockManager(STATE_DIR);
    this.checkpoint = new CheckpointManager(STATE_DIR);
  }

  /**
   * Initialize the state fixture
   * Called in test.beforeAll
   *
   * 1. Attempts to acquire lock (fails if another run is active)
   * 2. Loads checkpoint if exists
   * 3. Reports resume status
   */
  async initialize(): Promise<void> {
    console.log(`\n\uD83D\uDD12 Acquiring lock for ${this.labId}...`);

    const result: LockAcquireResult = await this.lock.acquire(this.labId, {
      totalSteps: this.totalSteps,
    });

    if (!result.acquired) {
      const lock = result.existingLock!;
      console.log(`\n\u274C Lock held by another process (PID ${lock.pid}, started ${this.formatRelativeTime(lock.startedAt)})`);
      console.log(`   Instance: ${lock.instanceId || 'not yet created'}`);
      console.log(`   Current step: ${lock.currentStepName || `step ${lock.currentStep}`}`);
      console.log(`\nOptions:`);
      console.log(`  - Wait for other test to complete`);
      console.log(`  - Force unlock: npm run unlock -- ${this.labId}`);
      throw new Error(`Lock held by another process (PID ${lock.pid})`);
    }

    if (result.staleLockRemoved) {
      console.log(`\u2705 Lock acquired (removed stale lock)`);
    } else {
      console.log(`\u2705 Lock acquired`);
    }

    // Load checkpoint if exists
    const existingCheckpoint = await this.checkpoint.load(this.labId);

    if (existingCheckpoint && existingCheckpoint.instanceId) {
      this.isResumed = true;
      this.instanceId = existingCheckpoint.instanceId;
      this.publicIp = existingCheckpoint.publicIp;
      this.securityGroupId = existingCheckpoint.securityGroupId;
      this.region = existingCheckpoint.region;
      this.completedSteps = existingCheckpoint.completedSteps;

      console.log(`\uD83D\uDCC2 Found checkpoint: ${this.instanceId}, ${this.completedSteps.length} steps complete`);
      console.log(`   Completed: ${this.completedSteps.join(', ') || '(none)'}`);
    } else {
      console.log(`\u2705 No previous state (fresh run)`);

      // Initialize empty checkpoint
      await this.checkpoint.save(this.labId, {
        labId: this.labId,
        instanceId: '',
        publicIp: '',
        completedSteps: [],
        savedAt: new Date().toISOString(),
      });
    }
  }

  /**
   * Check if a step should be skipped (already completed)
   */
  async shouldSkip(stepName: string): Promise<boolean> {
    return this.completedSteps.includes(stepName);
  }

  /**
   * Mark a step as complete and save checkpoint
   */
  async markStepComplete(stepName: string): Promise<void> {
    if (!this.completedSteps.includes(stepName)) {
      this.completedSteps.push(stepName);

      // Update checkpoint
      await this.checkpoint.save(this.labId, {
        labId: this.labId,
        instanceId: this.instanceId || '',
        publicIp: this.publicIp || '',
        securityGroupId: this.securityGroupId,
        region: this.region,
        completedSteps: this.completedSteps,
        savedAt: new Date().toISOString(),
      });

      // Update lock with current step
      await this.lock.update(this.labId, {
        currentStep: this.completedSteps.length,
        currentStepName: stepName,
        instanceId: this.instanceId,
        publicIp: this.publicIp,
        securityGroupId: this.securityGroupId,
      });

      console.log(`\uD83D\uDCBE Checkpoint saved: ${stepName} complete`);
    }
  }

  /**
   * Record a test failure
   * Prevents automatic cleanup on afterAll
   */
  markTestFailed(): void {
    this.allTestsPassed = false;
  }

  /**
   * Update instance data (after launching EC2)
   */
  async setInstanceData(data: { instanceId: string; publicIp?: string; securityGroupId?: string; region?: string }): Promise<void> {
    this.instanceId = data.instanceId;
    if (data.publicIp) this.publicIp = data.publicIp;
    if (data.securityGroupId) this.securityGroupId = data.securityGroupId;
    if (data.region) this.region = data.region;

    await this.checkpoint.updateInstanceData(this.labId, data);
    await this.lock.update(this.labId, {
      instanceId: this.instanceId,
      publicIp: this.publicIp,
      securityGroupId: this.securityGroupId,
    });
  }

  /**
   * Check if all tests passed
   */
  didAllTestsPass(): boolean {
    return this.allTestsPassed;
  }

  /**
   * Cleanup after successful completion
   * Releases lock and clears checkpoint
   */
  async cleanup(): Promise<void> {
    await this.lock.release(this.labId);
    await this.checkpoint.clear(this.labId);
    console.log(`\n\uD83D\uDD13 Lock released, checkpoint cleared`);
  }

  /**
   * Retain state for resume (after failure)
   */
  async retainForResume(): Promise<void> {
    console.log(`\n\uD83D\uDD12 Lock retained for resume`);
    console.log(`\uD83D\uDCBE State saved: ${this.instanceId}, steps ${this.completedSteps.join(', ')} complete`);
    console.log(`\u2139\uFE0F  Resume with: npm test -- --grep "${this.labId.replace('-', ' ').replace('lab', 'Lab ')}"`);

    // Release lock but keep checkpoint (so other runs can resume)
    await this.lock.release(this.labId);
  }

  /**
   * Format relative time for display
   */
  private formatRelativeTime(isoString: string): string {
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins} min ago`;

    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;

    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  }
}

/**
 * Extract lab ID from test file path
 * e.g., 'courses/splunk/tests/lab1-installation-hardening.spec.ts' -> 'splunk-lab1'
 */
function extractLabId(filePath: string): string {
  const normalized = filePath.replace(/\\/g, '/');

  // Match pattern: courses/{course}/tests/lab{N}
  const match = normalized.match(/courses\/([^/]+)\/tests\/lab(\d+)/i);

  if (match) {
    return `${match[1]}-lab${match[2]}`;
  }

  // Fallback: use filename
  const basename = path.basename(filePath, '.spec.ts');
  return basename.replace(/[^a-z0-9-]/gi, '-').toLowerCase();
}

/**
 * Count total tests in a describe block
 * This is a rough estimate based on typical lab structure
 */
function estimateTotalSteps(): number {
  // Default to 10 steps for now
  // Could be configured per-lab in the future
  return 10;
}

/**
 * Extended test fixture with AWS authentication AND state management
 */
export const test = base.extend<{
  awsPage: Page;
  labState: LabStateFixture;
}>({
  awsPage: async ({ browser }, use) => {
    const context = await browser.newContext({
      storageState: AUTH_FILE,
    });

    const page = await context.newPage();
    await use(page);
    await context.close();
  },

  labState: async ({}, use, testInfo) => {
    const labId = extractLabId(testInfo.file);
    const totalSteps = estimateTotalSteps();
    const state = new LabStateFixture(labId, totalSteps);

    await use(state);
  },
});

export { expect } from '@playwright/test';
