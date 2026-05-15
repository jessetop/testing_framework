#!/usr/bin/env npx ts-node

/**
 * Unlock Script
 *
 * Force unlock a specific lab to allow running a new test.
 * Use when a previous test crashed without releasing its lock.
 *
 * Usage:
 *   npm run unlock -- splunk-lab1
 *   npm run unlock -- kiro-lab1 --keep-checkpoint
 */

import * as path from 'path';
import { LockManager, CheckpointManager } from '../core/state';

const STATE_DIR = path.join(__dirname, '../.state');

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  // Filter out flags
  const labId = args.find((arg) => !arg.startsWith('--'));
  const keepCheckpoint = args.includes('--keep-checkpoint');

  if (!labId) {
    console.log(`
Usage: npm run unlock -- <lab-id> [options]

Options:
  --keep-checkpoint    Keep checkpoint file (for resuming later)

Examples:
  npm run unlock -- splunk-lab1
  npm run unlock -- kiro-lab1 --keep-checkpoint

Available lab IDs are based on the pattern: <course>-lab<number>
  e.g., splunk-lab1, kiro-lab1, grafana-lab2
`);

    // List existing locks
    const lockManager = new LockManager(STATE_DIR);
    const locks = await lockManager.listLocks();

    if (locks.length > 0) {
      console.log('Current locks:\n');

      for (const lock of locks) {
        const staleMarker = lockManager.isStale(lock) ? ' (STALE)' : ' (ACTIVE)';
        console.log(`  ${lock.labId}${staleMarker}`);
        console.log(`    PID: ${lock.pid}`);
        console.log(`    Instance: ${lock.instanceId || 'none'}`);
        console.log(`    Started: ${lock.startedAt}`);
        console.log('');
      }
    } else {
      console.log('No active locks found.\n');
    }

    process.exit(1);
  }

  const lockManager = new LockManager(STATE_DIR);
  const checkpointManager = new CheckpointManager(STATE_DIR);

  // Check if lock exists
  const lock = await lockManager.read(labId);

  if (!lock) {
    console.log(`\n\u2139\uFE0F  No lock found for ${labId}\n`);

    // Check for checkpoint
    const checkpoint = await checkpointManager.load(labId);

    if (checkpoint) {
      console.log(`Checkpoint exists:`);
      console.log(`  Instance: ${checkpoint.instanceId}`);
      console.log(`  IP: ${checkpoint.publicIp}`);
      console.log(`  Steps completed: ${checkpoint.completedSteps.length}`);
      console.log(`  Saved: ${checkpoint.savedAt}\n`);

      if (!keepCheckpoint) {
        await checkpointManager.clear(labId);
        console.log(`\u2705 Checkpoint cleared.\n`);
      }
    }

    return;
  }

  // Show lock details
  console.log(`\n\uD83D\uDD12 Lock found for ${labId}:`);
  console.log(`  PID: ${lock.pid}`);
  console.log(`  Instance: ${lock.instanceId || 'none'}`);
  console.log(`  IP: ${lock.publicIp || 'none'}`);
  console.log(`  Step: ${lock.currentStepName || lock.currentStep}`);
  console.log(`  Started: ${lock.startedAt}`);
  console.log(`  Stale: ${lockManager.isStale(lock) ? 'Yes' : 'No'}\n`);

  // Force unlock
  const result = await lockManager.forceUnlock(labId);

  if (result.removed) {
    console.log(`\u2705 Lock released for ${labId}\n`);

    // Handle checkpoint
    const checkpoint = await checkpointManager.load(labId);

    if (checkpoint) {
      if (keepCheckpoint) {
        console.log(`\uD83D\uDCBE Checkpoint preserved (${checkpoint.completedSteps.length} steps completed)`);
        console.log(`   Run tests to resume from checkpoint.\n`);
      } else {
        await checkpointManager.clear(labId);
        console.log(`\uD83D\uDCBE Checkpoint cleared (fresh run on next test).\n`);
      }
    }

    // Reminder about instance
    if (lock.instanceId) {
      console.log(`\u26A0\uFE0F  Instance ${lock.instanceId} may still be running!`);
      console.log(`   Terminate manually via AWS Console if no longer needed.\n`);
    }
  } else {
    console.log(`\u274C Failed to release lock.\n`);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('Error:', error.message);
  process.exit(1);
});
