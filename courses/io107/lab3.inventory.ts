/**
 * IO-107 Lab 3 — Policy-as-Code Evaluation & Failure Remediation.
 *
 * Authored against:
 *   I:/My Drive/CourseCreationKit/courses/SYF/stream2_aws_intermediate/IO-107_SDLC_Pipeline/content/labs/Lab_3_Guide.md
 *   sha256: ac5b645342328d8dbb8ca25ae65d3b2c53e75b7cf098cb2b2baf51737c5e27ee
 */

import { LabInventory } from '../../core/inventory';
import { labSourcePath, FIXTURE_REPOS } from './lab-source';

export const inventory: LabInventory = {
  course: 'io107',
  labNumber: 3,
  labName: 'Policy-as-Code Evaluation & Failure Remediation',
  sourcePath: labSourcePath(3),
  sourceHash: 'ac5b645342328d8dbb8ca25ae65d3b2c53e75b7cf098cb2b2baf51737c5e27ee',

  externalResources: [
    { kind: 'git-repo', url: FIXTURE_REPOS[3].url, description: 'Lab 3 fixture — TF + K8s with 17 deliberate policy violations + Rego policies' },
  ],

  tasks: [
    { id: 'T1', title: 'Clone the Violations Repository',            stepIds: ['1', '2', '3', '4'] },
    { id: 'T2', title: 'Identify the Terraform Violations',          stepIds: ['5', '6'] },
    { id: 'T3', title: 'Identify the Kubernetes Violations',         stepIds: ['7', '8'] },
    { id: 'T4', title: 'Trigger the Pipeline and Watch It Fail',     stepIds: ['9', '10', '11', '12'] },
    { id: 'T5', title: 'Read the Conftest Output',                   stepIds: ['13', '14', '15', '16'] },
    { id: 'T6', title: 'Remediate the Terraform File',               stepIds: ['17', '18'] },
    { id: 'T7', title: 'Remediate the Kubernetes Manifest',          stepIds: ['19', '20'] },
    { id: 'T8', title: 'Re-run the Pipeline and Confirm All Pass',   stepIds: ['21', '22', '23', '24'] },
  ],

  steps: [
    { stepId: '1',  title: 'Open terminal',                                strategy: 'manual-only' },
    { stepId: '2',  title: 'git clone fixture repo',                       strategy: 'local-cli', tools: ['git'] },
    { stepId: '3',  title: 'cd + ls verifies structure',                   strategy: 'local-cli', tools: ['git'] },
    { stepId: '4',  title: 'Open TF + K8s + buildspec in editor',          strategy: 'manual-only' },
    { stepId: '5',  title: 'Read terraform/main.tf violations',            strategy: 'local-cli', tools: ['cat'] },
    { stepId: '6',  title: 'Enumerate 5 TF violations',                    strategy: 'manual-only' },
    { stepId: '7',  title: 'Read kubernetes/deployment.yaml',              strategy: 'local-cli', tools: ['cat'] },
    { stepId: '8',  title: 'Enumerate 5 K8s violations',                   strategy: 'manual-only' },
    { stepId: '9',  title: 'Make trivial change to force commit',          strategy: 'local-cli', tools: ['git', 'sed'] },
    { stepId: '10', title: 'git commit + push',                            strategy: 'local-cli', tools: ['git'] },
    { stepId: '11', title: 'Navigate to CodePipeline console',             strategy: 'aws-cli',   tools: ['aws codepipeline get-pipeline-state'] },
    { stepId: '12', title: 'Confirm Validate stage FAILS',                 strategy: 'aws-cli',   tools: ['aws codepipeline get-pipeline-state'], expectFailure: true },
    { stepId: '13', title: 'Open CodeBuild log for failed Validate',       strategy: 'aws-cli',   tools: ['aws codebuild', 'aws logs'] },
    { stepId: '14', title: 'Find Conftest output section in log',          strategy: 'aws-cli',   tools: ['aws logs'] },
    { stepId: '15', title: 'Confirm 17 FAIL lines in output',              strategy: 'aws-cli',   tools: ['aws logs'] },
    { stepId: '16', title: 'Match FAILs to inventory list',                strategy: 'manual-only' },
    { stepId: '17', title: 'Replace main.tf with remediated version',      strategy: 'local-cli', tools: ['cat'] },
    { stepId: '18', title: 'Verify each TF fix lines up with FAIL',        strategy: 'manual-only' },
    { stepId: '19', title: 'Replace deployment.yaml with remediated',      strategy: 'local-cli', tools: ['cat'] },
    { stepId: '20', title: 'Confirm K8s policies satisfied',               strategy: 'manual-only' },
    { stepId: '21', title: 'git commit + push remediated files',           strategy: 'local-cli', tools: ['git'] },
    { stepId: '22', title: 'Poll pipeline — Validate now Succeeded',       strategy: 'aws-cli',   tools: ['aws codepipeline get-pipeline-state'] },
    { stepId: '23', title: 'Confirm Conftest reports 0 failures',          strategy: 'aws-cli',   tools: ['aws logs'] },
    { stepId: '24', title: 'Confirm pipeline overall Succeeded',           strategy: 'aws-cli',   tools: ['aws codepipeline get-pipeline-state'] },
  ],
};

export default inventory;
