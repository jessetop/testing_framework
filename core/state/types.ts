/**
 * State Management Types
 *
 * Interfaces for lock and checkpoint systems that prevent parallel test runs
 * and enable resuming from where tests left off.
 */

/**
 * Lock file structure - one per lab
 * Prevents multiple test runs from creating orphan EC2 instances
 */
export interface LabLock {
  /** Lab identifier (e.g., 'splunk-lab1') */
  labId: string;

  /** EC2 instance ID if created */
  instanceId?: string;

  /** Public IP address of the instance */
  publicIp?: string;

  /** Security group ID created for the instance */
  securityGroupId?: string;

  /** Last completed step number (0-indexed) */
  currentStep: number;

  /** Total number of steps in the lab */
  totalSteps: number;

  /** ISO timestamp when test started */
  startedAt: string;

  /** Process ID for stale detection */
  pid: number;

  /** Human-readable description of current step */
  currentStepName?: string;
}

/**
 * Checkpoint file structure
 * Enables resuming tests from where they left off
 */
export interface Checkpoint {
  /** Lab identifier (e.g., 'splunk-lab1') */
  labId: string;

  /** EC2 instance ID (required for resume) */
  instanceId: string;

  /** Public IP address (required for resume) */
  publicIp: string;

  /** Security group ID (for cleanup) */
  securityGroupId?: string;

  /** List of completed step names */
  completedSteps: string[];

  /** ISO timestamp when checkpoint was saved */
  savedAt: string;

  /** AWS region where resources were created */
  region?: string;

  /** Additional metadata that tests might need */
  metadata?: Record<string, unknown>;
}

/**
 * Options for acquiring a lock
 */
export interface LockAcquireOptions {
  /** Total number of steps in the lab */
  totalSteps: number;

  /** Force acquire even if lock exists (use with caution) */
  force?: boolean;

  /** Maximum age in hours before lock is considered stale (default: 4) */
  maxAgeHours?: number;
}

/**
 * Result of attempting to acquire a lock
 */
export interface LockAcquireResult {
  /** Whether lock was successfully acquired */
  acquired: boolean;

  /** Error message if acquisition failed */
  error?: string;

  /** Existing lock data if blocked by another process */
  existingLock?: LabLock;

  /** Whether the existing lock was stale and removed */
  staleLockRemoved?: boolean;
}

/**
 * Lab state summary for display
 */
export interface LabStateSummary {
  /** Lab identifier */
  labId: string;

  /** Whether a lock is currently held */
  hasLock: boolean;

  /** Whether a checkpoint exists */
  hasCheckpoint: boolean;

  /** Instance ID if exists */
  instanceId?: string;

  /** Public IP if exists */
  publicIp?: string;

  /** Number of completed steps */
  completedStepsCount: number;

  /** Total steps in lab */
  totalSteps: number;

  /** Whether the lock is stale */
  isStale: boolean;

  /** PID holding the lock */
  lockPid?: number;

  /** When the lock was acquired */
  lockStartedAt?: string;
}
