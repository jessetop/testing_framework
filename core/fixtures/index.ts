/**
 * Core Test Fixtures
 */

// Basic AWS fixture (no state management)
export { test as baseTest, expect } from './aws-fixture';

// State-aware fixture (with lock/checkpoint)
export { test, LabStateFixture } from './state-fixture';
