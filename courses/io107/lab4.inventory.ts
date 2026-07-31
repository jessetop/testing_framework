/**
 * IO-107 Lab 4 — Aurora Blue/Green Deployment via Terraform + Pipeline.
 *
 * Authored against:
 *   I:/My Drive/CourseCreationKit/courses/SYF/stream2_aws_intermediate/IO-107_SDLC_Pipeline/content/labs/Lab_4_Guide.md
 *   sha256: 55e6f6b0753870f977e7ee788b0625d3cd65047043b2fb9fcfa46d59d1ef1c3b
 *
 * Lab 4 is the longest end-to-end test — Aurora Blue/Green provisioning +
 * switchover typically takes 10–20 minutes wall-clock. The test approves the
 * pipeline programmatically (no UI click) via aws codepipeline put-approval-result.
 */

import { LabInventory } from '../../core/inventory';
import { labSourcePath, FIXTURE_REPOS } from './lab-source';

export const inventory: LabInventory = {
  course: 'io107',
  labNumber: 4,
  labName: 'Aurora Blue/Green Deployment via Terraform + Pipeline',
  sourcePath: labSourcePath(4),
  sourceHash: '55e6f6b0753870f977e7ee788b0625d3cd65047043b2fb9fcfa46d59d1ef1c3b',

  externalResources: [
    { kind: 'git-repo', url: FIXTURE_REPOS[4].url, description: 'Lab 4 fixture — Aurora TF + engine_version_pin Rego + buildspec with CLI Blue/Green' },
  ],

  tasks: [
    { id: 'T1', title: 'Pre-flight Checks',                                stepIds: ['1', '2', '3'] },
    { id: 'T2', title: 'Clone the Aurora Terraform Repository',            stepIds: ['4', '5', '6'] },
    { id: 'T3', title: "Inspect aws_rds_cluster Definition",               stepIds: ['7', '8'] },
    { id: 'T4', title: 'Bump the Target Engine Version',                   stepIds: ['9', '10'] },
    { id: 'T5', title: 'Push and Watch Pipeline Plan + OPA Validate',      stepIds: ['11', '12', '13', '14', '15'] },
    { id: 'T6', title: 'Approve and Apply',                                stepIds: ['16', '17', '18'] },
    { id: 'T7', title: 'Observe Blue and Green in the RDS Console',        stepIds: ['19', '20', '21'] },
    { id: 'T8', title: 'Find the Switchover Event in CloudTrail',          stepIds: ['22', '23', '24'] },
  ],

  steps: [
    { stepId: '1',  title: 'Open terminal',                                strategy: 'manual-only' },
    { stepId: '2',  title: 'aws sts get-caller-identity + describe-db-clusters', strategy: 'aws-cli', tools: ['aws sts', 'aws rds'] },
    { stepId: '3',  title: 'aws codepipeline list-pipelines',              strategy: 'aws-cli',   tools: ['aws codepipeline'] },
    { stepId: '4',  title: 'git clone fixture repo',                       strategy: 'local-cli', tools: ['git'] },
    { stepId: '5',  title: 'cd + ls verifies structure',                   strategy: 'local-cli', tools: ['git'] },
    { stepId: '6',  title: 'Open aurora_cluster.tf + buildspec.yml',       strategy: 'manual-only' },
    { stepId: '7',  title: 'Read locals + lifecycle + terraform_data shim', strategy: 'local-cli', tools: ['cat'] },
    { stepId: '8',  title: 'Comprehend "why not blue_green_update" note',   strategy: 'manual-only' },
    { stepId: '9',  title: 'Edit aurora_cluster.tf: local.target_engine_version 15.4 → 15.5', strategy: 'local-cli', tools: ['sed'] },
    { stepId: '10', title: 'Save file — one-line change only',             strategy: 'manual-only' },
    { stepId: '11', title: 'git commit + push',                            strategy: 'local-cli', tools: ['git'] },
    { stepId: '12', title: 'Navigate to CodePipeline console',             strategy: 'aws-cli',   tools: ['aws codepipeline'] },
    { stepId: '13', title: 'Watch Source + Build + Validate stages',       strategy: 'aws-cli',   tools: ['aws codepipeline get-pipeline-state'] },
    { stepId: '14', title: 'Read terraform plan output in CodeBuild log',  strategy: 'aws-cli',   tools: ['aws logs'] },
    { stepId: '15', title: 'Validate stage Succeeded (OPA approved version)', strategy: 'aws-cli', tools: ['aws codepipeline get-pipeline-state'] },
    { stepId: '16', title: 'Wait for Approval stage',                      strategy: 'aws-cli',   tools: ['aws codepipeline get-pipeline-state'] },
    { stepId: '17', title: 'Approve programmatically (put-approval-result)', strategy: 'aws-cli', tools: ['aws codepipeline put-approval-result'] },
    { stepId: '18', title: 'Watch Deploy: CLI Blue/Green flow runs',       strategy: 'aws-cli',   tools: ['aws codepipeline', 'aws logs'] },
    { stepId: '19', title: 'aws rds describe-db-clusters — see blue + green', strategy: 'aws-cli', tools: ['aws rds'] },
    { stepId: '20', title: 'Verify cluster identifiers',                   strategy: 'aws-cli',   tools: ['aws rds'] },
    { stepId: '21', title: 'aws rds describe-blue-green-deployments',      strategy: 'aws-cli',   tools: ['aws rds'] },
    { stepId: '22', title: 'aws cloudtrail lookup-events filter rds source', strategy: 'aws-cli', tools: ['aws cloudtrail'] },
    { stepId: '23', title: 'Filter + confirm CreateBlueGreenDeployment event', strategy: 'aws-cli', tools: ['aws cloudtrail'] },
    { stepId: '24', title: 'Confirm SwitchoverBlueGreenDeployment event',  strategy: 'aws-cli',   tools: ['aws cloudtrail'] },
  ],
};

export default inventory;
