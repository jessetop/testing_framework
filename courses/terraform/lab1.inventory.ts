/**
 * Step inventory for Terraform Day 3 Lab 1: Multi-Environment State Strategy.
 *
 * Authored against:
 *   labforge_iterations/iteration_1/Lab_01_Multi_Environment_State_Strategy.md
 *   sha256: d7b039b7a6ee1e1d2300abc3b8f693a488955147ec3149a65b69adeca31964b9
 *
 * Update sourceHash if the lab markdown changes (the `analyze` command will flag drift).
 */

import { LabInventory } from '../../core/inventory';
import { labSourcePath } from './lab-source';

export const inventory: LabInventory = {
  course: 'terraform',
  labNumber: 1,
  labName: 'Multi-Environment State Strategy',
  sourcePath: labSourcePath(1),
  sourceHash: 'd7b039b7a6ee1e1d2300abc3b8f693a488955147ec3149a65b69adeca31964b9',

  externalResources: [
    { kind: 'git-repo', url: 'https://github.com/AWSClassroom-com/Advanced_Terraform', description: 'Lab repo — clone in step 1; has lab1/state-infra, lab1/networking, lab1/directories' },
  ],

  tasks: [
    { id: 'T1', title: 'Workspace Fundamentals',         stepIds: ['1','2','3','4','5','6','7','8','9','10'] },
    { id: 'T2', title: 'Workspace Safety Guards',        stepIds: ['11','12','13','14','15','16'] },
    { id: 'T3', title: 'Cross-State Dependencies',       stepIds: ['17','18','19','20','21','22'] },
    { id: 'T4', title: 'State Inspection & Troubleshooting', stepIds: ['23','24','25'] },
    { id: 'T5', title: 'Workspaces vs Directories (review-only)', stepIds: ['26','27','28','29'] },
    { id: 'B',  title: 'Bonus: Workspace State Isolation', stepIds: ['30'] },
    { id: 'T6', title: 'Cleanup',                        stepIds: ['31','32','33','34','35'] },
  ],

  steps: [
    // ── Task 1: Workspace Fundamentals ─────────────────────────────────────
    { stepId: '1',  title: 'Clone Advanced_Terraform repo', strategy: 'local-cli', tools: ['git'] },
    { stepId: '2',  title: 'Review backend configuration in providers.tf', strategy: 'manual-only', notes: 'Read-only — confirm backend block is present and commented out (chicken-and-egg with bucket creation)' },
    { stepId: '3',  title: 'terraform init', strategy: 'local-cli', tools: ['terraform'] },
    { stepId: '4',  title: 'terraform workspace list (default only)', strategy: 'local-cli', tools: ['terraform'] },
    { stepId: '5',  title: 'Understand env:/<workspace>/ state path pattern', strategy: 'manual-only', notes: 'Conceptual — no command to assert' },
    { stepId: '6',  title: 'terraform workspace new dev/staging/prod', strategy: 'local-cli', tools: ['terraform'] },
    { stepId: '7',  title: 'terraform workspace select + show', strategy: 'local-cli', tools: ['terraform'] },
    { stepId: '8',  title: 'Review terraform.workspace usage in variables.tf', strategy: 'manual-only', notes: 'Read-only review of locals block selecting config per workspace' },
    { stepId: '9',  title: 'Verify state isolation across workspaces (terraform state list)', strategy: 'local-cli', tools: ['terraform'], expectFailure: true, notes: 'Lab demonstrates empty state — terraform state list exits 1 with "No state file was found!" before any apply' },
    { stepId: '10', title: 'Delete prod workspace (cleanup)', strategy: 'local-cli', tools: ['terraform'] },

    // ── Task 2: Workspace Safety Guards ────────────────────────────────────
    { stepId: '11', title: 'Recreate prod workspace + select dev', strategy: 'local-cli', tools: ['terraform'] },
    { stepId: '12', title: 'Configure tfvars, apply state-infra, migrate to remote backend', strategy: 'local-cli', tools: ['terraform', 'aws-cli'], notes: 'Long step: cp tfvars, edit, plan, apply, capture output bucket name, uncomment backend, init -migrate-state -force-copy, verify with aws s3 ls' },
    { stepId: '13', title: 'Review workspace_guard.tf (null_resource + preconditions)', strategy: 'manual-only', notes: 'Conceptual review of the guard mechanism' },
    { stepId: '14', title: 'terraform plan in default workspace (expect failure)', strategy: 'local-cli', tools: ['terraform'], expectFailure: true, notes: 'Guard precondition blocks plan with error "Workspace default is not allowed"' },
    { stepId: '15', title: 'terraform plan in dev workspace (expect success)', strategy: 'local-cli', tools: ['terraform'] },
    { stepId: '16', title: 'Create feature-* workspace and plan (expect success), then delete', strategy: 'local-cli', tools: ['terraform'] },

    // ── Task 3: Cross-State Dependencies ───────────────────────────────────
    { stepId: '17', title: 'Deploy networking state (lab1/networking) with backend pointing at same bucket', strategy: 'local-cli', tools: ['terraform'] },
    { stepId: '18', title: 'Review terraform_remote_state usage in main.tf', strategy: 'manual-only', notes: 'Read-only review of data source + locals + app_config SSM parameter' },
    { stepId: '19', title: 'Update tfvars to uncomment state_bucket_name', strategy: 'local-cli', tools: ['file-edit'] },
    { stepId: '20', title: 'terraform plan + apply app config', strategy: 'local-cli', tools: ['terraform'] },
    { stepId: '21', title: 'terraform output — verify VPC ID matches networking output', strategy: 'local-cli', tools: ['terraform'] },
    { stepId: '22', title: 'Understand state boundaries (factor table)', strategy: 'manual-only', notes: 'Conceptual — no command' },

    // ── Task 4: State Inspection & Troubleshooting ─────────────────────────
    { stepId: '23', title: 'terraform state pull → /tmp/lab1-state.json', strategy: 'local-cli', tools: ['terraform'] },
    { stepId: '24', title: 'Inspect state with jq (resource counts, attribute extraction)', strategy: 'local-cli', tools: ['jq'] },
    { stepId: '25', title: 'Conceptual: terraform force-unlock <LOCK_ID>', strategy: 'manual-only', notes: 'No execution — reading the docs is the goal. Verify .tflock object visible via aws s3 ls.' },

    // ── Task 5: Workspaces vs Directories (review-only) ────────────────────
    { stepId: '26', title: 'Review lab1/directories/ structure (ls -la)', strategy: 'local-cli', tools: ['ls'] },
    { stepId: '27', title: 'Review modules/app/main.tf (cat)', strategy: 'manual-only', notes: 'Read-only file inspection' },
    { stepId: '28', title: 'Review dev/main.tf (cat)', strategy: 'manual-only', notes: 'Read-only file inspection' },
    { stepId: '29', title: 'Pick a pattern (workspaces vs directories)', strategy: 'manual-only', notes: 'Decision exercise — no assertable outcome' },

    // ── Bonus: Workspace State Isolation ───────────────────────────────────
    { stepId: '30', title: 'Materialize prod state via apply -refresh-only, verify env:/ paths', strategy: 'local-cli', tools: ['terraform', 'aws-cli'], notes: 'Optional in lab; we run it for the test because it adds a real assertion' },

    // ── Task 6: Cleanup ────────────────────────────────────────────────────
    { stepId: '31', title: 'Capture bucket name + terraform state rm bootstrap resources', strategy: 'local-cli', tools: ['terraform'] },
    { stepId: '32', title: 'terraform destroy (rest of state-infra)', strategy: 'local-cli', tools: ['terraform'] },
    { stepId: '33', title: 'terraform destroy networking', strategy: 'local-cli', tools: ['terraform'] },
    { stepId: '34', title: 'Clean up workspaces (delete dev/staging/prod)', strategy: 'local-cli', tools: ['terraform'] },
    { stepId: '35', title: 'aws s3 rb --force (delete bootstrap bucket)', strategy: 'aws-cli', tools: ['aws-cli'] },
  ],
};

export default inventory;
