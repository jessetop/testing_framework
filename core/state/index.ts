/**
 * State Management Module
 *
 * Provides lock and checkpoint systems for test state management.
 * Prevents parallel test runs and enables resuming from checkpoints.
 */

export * from './types';
export { LockManager } from './lock-manager';
export { CheckpointManager } from './checkpoint-manager';
