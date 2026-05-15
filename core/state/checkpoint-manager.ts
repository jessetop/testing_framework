/**
 * Checkpoint Manager
 *
 * Saves and loads test state to enable resuming from where tests left off.
 * Works in conjunction with the lock manager.
 */

import * as fs from 'fs';
import * as path from 'path';
import { Checkpoint } from './types';

export class CheckpointManager {
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
   * Get the checkpoint file path for a lab
   */
  private getCheckpointPath(labId: string): string {
    return path.join(this.stateDir, `${labId}.checkpoint.json`);
  }

  /**
   * Save a checkpoint for a lab
   */
  async save(labId: string, checkpoint: Checkpoint): Promise<void> {
    const checkpointPath = this.getCheckpointPath(labId);

    // Ensure savedAt is set
    const checkpointWithTimestamp: Checkpoint = {
      ...checkpoint,
      savedAt: new Date().toISOString(),
    };

    fs.writeFileSync(checkpointPath, JSON.stringify(checkpointWithTimestamp, null, 2));
  }

  /**
   * Load a checkpoint for a lab
   */
  async load(labId: string): Promise<Checkpoint | null> {
    const checkpointPath = this.getCheckpointPath(labId);

    if (!fs.existsSync(checkpointPath)) {
      return null;
    }

    try {
      const content = fs.readFileSync(checkpointPath, 'utf-8');
      return JSON.parse(content) as Checkpoint;
    } catch {
      // Corrupted checkpoint, treat as none
      return null;
    }
  }

  /**
   * Clear the checkpoint for a lab (on full success)
   */
  async clear(labId: string): Promise<void> {
    const checkpointPath = this.getCheckpointPath(labId);

    if (fs.existsSync(checkpointPath)) {
      fs.unlinkSync(checkpointPath);
    }
  }

  /**
   * Get the list of completed steps for a lab
   */
  async getCompletedSteps(labId: string): Promise<string[]> {
    const checkpoint = await this.load(labId);
    return checkpoint?.completedSteps ?? [];
  }

  /**
   * Add a completed step to an existing checkpoint
   */
  async addCompletedStep(labId: string, stepName: string): Promise<void> {
    const checkpoint = await this.load(labId);

    if (!checkpoint) {
      throw new Error(`No checkpoint found for ${labId}. Initialize state first.`);
    }

    if (!checkpoint.completedSteps.includes(stepName)) {
      checkpoint.completedSteps.push(stepName);
      await this.save(labId, checkpoint);
    }
  }

  /**
   * Update checkpoint with new instance data
   */
  async updateInstanceData(
    labId: string,
    data: { instanceId?: string; publicIp?: string; securityGroupId?: string; region?: string }
  ): Promise<void> {
    let checkpoint = await this.load(labId);

    if (!checkpoint) {
      // Create new checkpoint
      checkpoint = {
        labId,
        instanceId: data.instanceId ?? '',
        publicIp: data.publicIp ?? '',
        securityGroupId: data.securityGroupId,
        region: data.region,
        completedSteps: [],
        savedAt: new Date().toISOString(),
      };
    } else {
      // Update existing
      if (data.instanceId !== undefined) checkpoint.instanceId = data.instanceId;
      if (data.publicIp !== undefined) checkpoint.publicIp = data.publicIp;
      if (data.securityGroupId !== undefined) checkpoint.securityGroupId = data.securityGroupId;
      if (data.region !== undefined) checkpoint.region = data.region;
    }

    await this.save(labId, checkpoint);
  }

  /**
   * Check if a step has been completed
   */
  async isStepCompleted(labId: string, stepName: string): Promise<boolean> {
    const completedSteps = await this.getCompletedSteps(labId);
    return completedSteps.includes(stepName);
  }

  /**
   * Set metadata on the checkpoint
   */
  async setMetadata(labId: string, key: string, value: unknown): Promise<void> {
    const checkpoint = await this.load(labId);

    if (!checkpoint) {
      throw new Error(`No checkpoint found for ${labId}`);
    }

    checkpoint.metadata = checkpoint.metadata ?? {};
    checkpoint.metadata[key] = value;

    await this.save(labId, checkpoint);
  }

  /**
   * Get metadata from the checkpoint
   */
  async getMetadata<T = unknown>(labId: string, key: string): Promise<T | undefined> {
    const checkpoint = await this.load(labId);
    return checkpoint?.metadata?.[key] as T | undefined;
  }

  /**
   * List all checkpoints
   */
  async listCheckpoints(): Promise<Checkpoint[]> {
    if (!fs.existsSync(this.stateDir)) {
      return [];
    }

    const files = fs.readdirSync(this.stateDir);
    const checkpoints: Checkpoint[] = [];

    for (const file of files) {
      if (file.endsWith('.checkpoint.json')) {
        const labId = file.replace('.checkpoint.json', '');
        const checkpoint = await this.load(labId);
        if (checkpoint) {
          checkpoints.push(checkpoint);
        }
      }
    }

    return checkpoints;
  }
}
