/**
 * Lab step inventory — classification of each step in a lab into a testing
 * strategy. One `LabInventory` per lab, authored from reading the lab
 * markdown. The framework consumes inventories to:
 *
 *   1. Tell the test author which steps can be automated vs. need a human
 *   2. Derive the lab's tooling requirements (terraform, aws CLI, git, …)
 *   3. (future) Route step execution at runtime: shell out, Playwright + AWS
 *      console, Nova Act, or print a "manual verification required" notice
 */

export type StepStrategy =
  /** Shell out to local CLI tooling: terraform, git, npm, file edits, jq, etc. */
  | 'local-cli'
  /** Installs software on the test machine (e.g., Splunk Enterprise binary). */
  | 'local-install'
  /** AWS CLI command — verification, ls, describe, occasional deletion. */
  | 'aws-cli'
  /** Requires Playwright driving the AWS Console UI (CloudScape components, wizards). */
  | 'aws-ui'
  /** Requires Playwright driving a non-AWS web UI (Splunk Web, vendor consoles). */
  | 'external-ui'
  /** Cannot be automated — student reads, decides, or observes. Test prints a
   *  "manual verification required" notice and tracks it but does not assert. */
  | 'manual-only';

export interface LabStep {
  /** Step identifier matching the lab markdown's numbering. */
  stepId: string;
  /** Short human-readable title. */
  title: string;
  /** How the test should execute this step. */
  strategy: StepStrategy;
  /** Why this strategy was chosen. Especially valuable for `manual-only`. */
  notes?: string;
  /** Tooling this step exercises. Aggregated across the inventory to compute
   *  lab-level requirements. */
  tools?: string[];
  /** Mark steps that intentionally expect failure (e.g. workspace guard test). */
  expectFailure?: boolean;
}

export interface LabInventory {
  course: string;
  labNumber: number;
  labName: string;
  /** Path used when authoring the inventory. Compared to status file on analyze. */
  sourcePath: string;
  /** Lab markdown SHA-256 at the time the inventory was authored. Drift detection. */
  sourceHash: string;
  /** Coarse-grained "tasks" or "parts" the lab is divided into. */
  tasks?: { id: string; title: string; stepIds: string[] }[];
  steps: LabStep[];
  /** External resources the test depends on (repos to clone, accounts, etc). */
  externalResources?: { kind: 'git-repo' | 'account' | 'documentation'; url: string; description?: string }[];
}

export interface StrategyBreakdown {
  total: number;
  byStrategy: Record<StepStrategy, number>;
  manualSteps: LabStep[];
  failureSteps: LabStep[];
  toolUsage: Record<string, number>;
}

export function summarize(inv: LabInventory): StrategyBreakdown {
  const byStrategy: Record<StepStrategy, number> = {
    'local-cli': 0,
    'local-install': 0,
    'aws-cli': 0,
    'aws-ui': 0,
    'external-ui': 0,
    'manual-only': 0,
  };
  const toolUsage: Record<string, number> = {};
  const manualSteps: LabStep[] = [];
  const failureSteps: LabStep[] = [];

  for (const step of inv.steps) {
    byStrategy[step.strategy]++;
    if (step.strategy === 'manual-only') manualSteps.push(step);
    if (step.expectFailure) failureSteps.push(step);
    for (const t of step.tools || []) toolUsage[t] = (toolUsage[t] || 0) + 1;
  }

  return { total: inv.steps.length, byStrategy, manualSteps, failureSteps, toolUsage };
}

/** Strategies that require local tooling beyond what the framework supplies. */
export function automatableStrategies(): StepStrategy[] {
  return ['local-cli', 'local-install', 'aws-cli', 'aws-ui', 'external-ui'];
}
