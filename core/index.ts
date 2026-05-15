/**
 * Core Lab Testing Framework
 *
 * Shared AWS page objects, actions, and fixtures used across all course tests.
 * Import from here for AWS-related testing.
 */

// Fixtures (state-aware by default)
export { test, expect, baseTest, LabStateFixture } from './fixtures';

// AWS Page Objects
export { EC2Page, EC2LaunchWizardPage, InstanceConnectPage } from './pages/aws';

// Actions (high-level helpers)
export * from './actions';

// State Management
export {
  LockManager,
  CheckpointManager,
  LabLock,
  Checkpoint,
  LockAcquireOptions,
  LockAcquireResult,
  LabStateSummary,
} from './state';
