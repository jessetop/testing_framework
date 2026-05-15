#!/usr/bin/env npx ts-node

/**
 * Cleanup Script
 *
 * Terminates orphan EC2 instances and clears stale state files.
 * Use this for recovery from crashes or to clean up after interrupted tests.
 *
 * Usage:
 *   npm run cleanup                    # List all state, prompt for cleanup
 *   npm run cleanup -- --force         # Cleanup without prompting
 *   npm run cleanup -- --dry-run       # Show what would be cleaned up
 */

import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';
import { LockManager, CheckpointManager, LabLock, Checkpoint, LabStateSummary } from '../core/state';

const STATE_DIR = path.join(__dirname, '../.state');

interface CleanupTarget {
  labId: string;
  lock?: LabLock;
  checkpoint?: Checkpoint;
  instanceId?: string;
  publicIp?: string;
  isStale: boolean;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const force = args.includes('--force');
  const dryRun = args.includes('--dry-run');

  const lockManager = new LockManager(STATE_DIR);
  const checkpointManager = new CheckpointManager(STATE_DIR);

  // Gather all state
  const locks = await lockManager.listLocks();
  const checkpoints = await checkpointManager.listCheckpoints();

  // Build cleanup targets
  const targets: CleanupTarget[] = [];
  const labIds = new Set<string>();

  for (const lock of locks) {
    labIds.add(lock.labId);
  }

  for (const checkpoint of checkpoints) {
    labIds.add(checkpoint.labId);
  }

  for (const labId of labIds) {
    const lock = locks.find((l) => l.labId === labId);
    const checkpoint = checkpoints.find((c) => c.labId === labId);

    targets.push({
      labId,
      lock,
      checkpoint,
      instanceId: lock?.instanceId || checkpoint?.instanceId,
      publicIp: lock?.publicIp || checkpoint?.publicIp,
      isStale: lock ? lockManager.isStale(lock) : true,
    });
  }

  if (targets.length === 0) {
    console.log('\n\u2705 No state files found. Nothing to clean up.\n');
    return;
  }

  // Display state
  console.log('\n\u2550\u2550\u2550 Lab Testing Framework - Cleanup \u2550\u2550\u2550\n');

  console.log('Current state:\n');

  for (const target of targets) {
    const staleMarker = target.isStale ? ' (STALE)' : ' (ACTIVE)';
    const lockStatus = target.lock ? `\uD83D\uDD12 Lock${staleMarker}` : '\uD83D\uDD13 No lock';
    const checkpointStatus = target.checkpoint ? `\uD83D\uDCBE Checkpoint` : 'No checkpoint';

    console.log(`  ${target.labId}:`);
    console.log(`    ${lockStatus}`);
    console.log(`    ${checkpointStatus}`);

    if (target.instanceId) {
      console.log(`    Instance: ${target.instanceId}`);
    }

    if (target.publicIp) {
      console.log(`    IP: ${target.publicIp}`);
    }

    if (target.lock) {
      console.log(`    PID: ${target.lock.pid}`);
      console.log(`    Started: ${target.lock.startedAt}`);
      console.log(`    Step: ${target.lock.currentStepName || target.lock.currentStep}`);
    }

    console.log('');
  }

  if (dryRun) {
    console.log('\n[Dry run] Would clean up the above state.\n');
    console.log('\u26A0\uFE0F  EC2 instances must be terminated manually via AWS Console.\n');
    return;
  }

  // Confirm cleanup
  if (!force) {
    const confirmed = await confirm('Clean up all state files? (instances must be terminated manually)');

    if (!confirmed) {
      console.log('\nCleanup cancelled.\n');
      return;
    }
  }

  // Perform cleanup
  console.log('\nCleaning up...\n');

  for (const target of targets) {
    console.log(`  Cleaning ${target.labId}...`);

    if (target.lock) {
      await lockManager.release(target.labId);
      console.log(`    \u2713 Lock released`);
    }

    if (target.checkpoint) {
      await checkpointManager.clear(target.labId);
      console.log(`    \u2713 Checkpoint cleared`);
    }

    if (target.instanceId) {
      console.log(`    \u26A0\uFE0F  Instance ${target.instanceId} must be terminated manually`);
    }
  }

  console.log('\n\u2705 State cleanup complete.\n');
  console.log('\u26A0\uFE0F  Remember to terminate any running EC2 instances via AWS Console!\n');
}

async function confirm(message: string): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(`${message} [y/N] `, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
    });
  });
}

main().catch((error) => {
  console.error('Error:', error.message);
  process.exit(1);
});
