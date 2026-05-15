#!/usr/bin/env npx ts-node

/**
 * Status Script
 *
 * Shows the current state of all lab tests - locks, checkpoints, instances.
 *
 * Usage:
 *   npm run status
 *   npm run status -- splunk-lab1
 */

import * as path from 'path';
import { LockManager, CheckpointManager, LabLock, Checkpoint } from '../core/state';

const STATE_DIR = path.join(__dirname, '../.state');

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const specificLabId = args.find((arg) => !arg.startsWith('--'));

  const lockManager = new LockManager(STATE_DIR);
  const checkpointManager = new CheckpointManager(STATE_DIR);

  const locks = await lockManager.listLocks();
  const checkpoints = await checkpointManager.listCheckpoints();

  // Build combined state
  const labIds = new Set<string>();

  for (const lock of locks) {
    labIds.add(lock.labId);
  }

  for (const checkpoint of checkpoints) {
    labIds.add(checkpoint.labId);
  }

  // Filter to specific lab if requested
  const filteredLabIds = specificLabId
    ? [...labIds].filter((id) => id === specificLabId)
    : [...labIds].sort();

  if (filteredLabIds.length === 0) {
    if (specificLabId) {
      console.log(`\n\u2139\uFE0F  No state found for ${specificLabId}\n`);
    } else {
      console.log('\n\u2705 No active lab state. Ready to run tests.\n');
    }
    return;
  }

  console.log('\n\u2550\u2550\u2550 Lab Testing Framework - Status \u2550\u2550\u2550\n');

  for (const labId of filteredLabIds) {
    const lock = locks.find((l) => l.labId === labId);
    const checkpoint = checkpoints.find((c) => c.labId === labId);

    console.log(`\uD83D\uDCCB ${labId}`);
    console.log('\u2500'.repeat(50));

    // Lock status
    if (lock) {
      const isStale = lockManager.isStale(lock);
      const staleTag = isStale ? ' \u26A0\uFE0F STALE' : ' \u2705 ACTIVE';

      console.log(`  Lock:${staleTag}`);
      console.log(`    PID: ${lock.pid}`);
      console.log(`    Started: ${formatTime(lock.startedAt)}`);
      console.log(`    Progress: Step ${lock.currentStep + 1}/${lock.totalSteps}`);

      if (lock.currentStepName) {
        console.log(`    Current: ${lock.currentStepName}`);
      }
    } else {
      console.log(`  Lock: \uD83D\uDD13 None`);
    }

    // Checkpoint status
    if (checkpoint) {
      console.log(`  Checkpoint:`);
      console.log(`    Steps: ${checkpoint.completedSteps.length} completed`);
      console.log(`    Saved: ${formatTime(checkpoint.savedAt)}`);

      if (checkpoint.completedSteps.length > 0) {
        console.log(`    Last: ${checkpoint.completedSteps[checkpoint.completedSteps.length - 1]}`);
      }
    } else {
      console.log(`  Checkpoint: None (fresh run)`);
    }

    // Instance status
    const instanceId = lock?.instanceId || checkpoint?.instanceId;
    const publicIp = lock?.publicIp || checkpoint?.publicIp;

    if (instanceId || publicIp) {
      console.log(`  Instance:`);

      if (instanceId) {
        console.log(`    ID: ${instanceId}`);
      }

      if (publicIp) {
        console.log(`    IP: ${publicIp}`);
      }
    }

    // Actions
    console.log(`  Actions:`);

    if (lock && lockManager.isStale(lock)) {
      console.log(`    \u2022 Unlock: npm run unlock -- ${labId}`);
    }

    if (checkpoint && !lock) {
      console.log(`    \u2022 Resume: npm test -- --grep "${formatGrep(labId)}"`);
      console.log(`    \u2022 Clear: npm run unlock -- ${labId}`);
    }

    if (instanceId) {
      console.log(`    \u2022 AWS Console: Check instance ${instanceId}`);
    }

    console.log('');
  }

  // Summary
  const activeLocks = locks.filter((l) => !lockManager.isStale(l));
  const staleLocks = locks.filter((l) => lockManager.isStale(l));

  console.log('\u2500'.repeat(50));
  console.log(`Summary: ${activeLocks.length} active, ${staleLocks.length} stale, ${checkpoints.length} checkpoints`);

  if (staleLocks.length > 0) {
    console.log(`\n\u26A0\uFE0F  Stale locks detected. Run: npm run cleanup`);
  }

  console.log('');
}

function formatTime(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;

  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

function formatGrep(labId: string): string {
  // Convert 'splunk-lab1' to 'Lab 1'
  const match = labId.match(/lab(\d+)/i);
  return match ? `Lab ${match[1]}` : labId;
}

main().catch((error) => {
  console.error('Error:', error.message);
  process.exit(1);
});
