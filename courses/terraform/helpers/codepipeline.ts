/**
 * CodePipeline helpers — wait for stages, approve manual gates programmatically.
 *
 * Lab 3 teaches console-driven approval; the test uses these aws-cli wrappers
 * to drive the same flow programmatically. Notes for that decision are
 * captured in `lab3.inventory.ts` per-step.
 */

import { awsCli, awsJson, assertOk } from './terraform-runner';

export interface PipelineState {
  pipelineName: string;
  stageStates: StageState[];
}

export interface StageState {
  stageName: string;
  inboundExecution?: { pipelineExecutionId?: string; status?: string };
  latestExecution?: { pipelineExecutionId?: string; status?: string };
  actionStates: ActionState[];
}

export interface ActionState {
  actionName: string;
  latestExecution?: {
    status?: string;
    summary?: string;
    errorDetails?: { code?: string; message?: string };
    token?: string;  // present on InProgress Manual_Approval actions
  };
}

export function getPipelineState(name: string, profile: string, region: string): PipelineState {
  const r = awsCli(['codepipeline', 'get-pipeline-state', '--name', name, '--region', region], profile);
  if (r.exitCode !== 0) {
    throw new Error(`get-pipeline-state failed: ${r.stderr}`);
  }
  return awsJson<PipelineState>(r, 'get-pipeline-state');
}

/** Sleep for ms (Promise-friendly). */
export const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms));

export interface WaitOptions {
  pipelineName: string;
  stageName: string;
  /** Status string to wait for on this stage's latestExecution. */
  targetStatus: 'Succeeded' | 'InProgress' | 'Failed' | 'Cancelled' | 'Stopped';
  profile: string;
  region: string;
  /** Total timeout in ms. Default 10 min. */
  timeoutMs?: number;
  /** Poll interval. Default 10s. */
  pollMs?: number;
  /** If true, also accept "Failed" as a terminal state and return that. */
  acceptFailure?: boolean;
}

export interface WaitResult {
  state: StageState;
  finalStatus: string;
  durationMs: number;
}

/**
 * Poll until the named stage's latest execution reaches targetStatus
 * (or, if acceptFailure, any terminal status). Throws on timeout.
 */
export async function waitForStage(opts: WaitOptions): Promise<WaitResult> {
  const start = Date.now();
  const timeout = opts.timeoutMs ?? 10 * 60 * 1000;
  const poll = opts.pollMs ?? 10_000;
  const terminalFailures = new Set(['Failed', 'Cancelled', 'Stopped']);

  while (Date.now() - start < timeout) {
    const state = getPipelineState(opts.pipelineName, opts.profile, opts.region);
    const stage = state.stageStates.find((s) => s.stageName === opts.stageName);
    if (!stage) throw new Error(`Stage ${opts.stageName} not found in pipeline ${opts.pipelineName}`);
    const status = stage.latestExecution?.status || '(no execution yet)';
    if (status === opts.targetStatus) {
      return { state: stage, finalStatus: status, durationMs: Date.now() - start };
    }
    if (opts.acceptFailure && terminalFailures.has(status)) {
      return { state: stage, finalStatus: status, durationMs: Date.now() - start };
    }
    await sleep(poll);
  }
  const final = getPipelineState(opts.pipelineName, opts.profile, opts.region);
  const finalStage = final.stageStates.find((s) => s.stageName === opts.stageName);
  throw new Error(
    `Timed out waiting for stage "${opts.stageName}" to reach ${opts.targetStatus} after ${timeout / 1000}s.\n` +
    `Last status: ${finalStage?.latestExecution?.status || '(none)'}`,
  );
}

/** Programmatically approve a Manual_Approval action that's currently InProgress. */
export function approveStage(opts: {
  pipelineName: string;
  stageName: string;
  actionName: string;
  summary: string;
  profile: string;
  region: string;
}): void {
  const state = getPipelineState(opts.pipelineName, opts.profile, opts.region);
  const stage = state.stageStates.find((s) => s.stageName === opts.stageName);
  const action = stage?.actionStates.find((a) => a.actionName === opts.actionName);
  const token = action?.latestExecution?.token;
  if (!token) {
    throw new Error(
      `No approval token found for ${opts.pipelineName}/${opts.stageName}/${opts.actionName}. ` +
      `Action status: ${action?.latestExecution?.status || '(none)'}`,
    );
  }
  // Avoid spaces/parens in summary — Windows shell with shell:true mangles
  // the --result "summary=...,status=Approved" string. Use no-space summary.
  const safeSummary = opts.summary.replace(/[^A-Za-z0-9_-]/g, '_');
  const r = awsCli([
    'codepipeline', 'put-approval-result',
    '--pipeline-name', opts.pipelineName,
    '--stage-name', opts.stageName,
    '--action-name', opts.actionName,
    '--result', `summary=${safeSummary},status=Approved`,
    '--token', token,
    '--region', opts.region,
  ], opts.profile);
  assertOk(r, `put-approval-result ${opts.stageName}/${opts.actionName}`);
}
