/**
 * Step inventory for Terraform Day 3 Lab 3: Pipeline Operations.
 *
 * Authored against:
 *   labforge_iterations/iteration_1/Lab_03_Pipeline_Operations.md
 *   sha256: bf58313313509c28e93ca3db18baf819a9255ad9b70f8624def97b0647f7cdb5
 *
 * NOTE: Lab 3 has 8 steps the lab teaches as `aws-ui` (CodePipeline approval
 * gates, CodeBuild log inspection). Most have aws-cli equivalents — captured in
 * step notes. The test implementation can either drive the console via
 * Playwright or use the CLI equivalents.
 */

import { LabInventory } from '../../core/inventory';
import { labSourcePath } from './lab-source';

export const inventory: LabInventory = {
  course: 'terraform',
  labNumber: 3,
  labName: 'Pipeline Operations',
  sourcePath: labSourcePath(3),
  sourceHash: 'bf58313313509c28e93ca3db18baf819a9255ad9b70f8624def97b0647f7cdb5',

  externalResources: [
    { kind: 'git-repo', url: 'https://github.com/AWSClassroom-com/Advanced_Terraform', description: 'lab3/pipeline/ + lab3/app-repo/' },
    { kind: 'account', url: 'aws://codecommit', description: 'Lab 3 creates a CodeCommit repo (userxx-webapp) that the student pushes to' },
  ],

  tasks: [
    { id: 'T1', title: 'Review pipeline infrastructure',         stepIds: ['1','2','3','4'] },
    { id: 'T2', title: 'Deploy pipeline infrastructure',         stepIds: ['5','6','7','8'] },
    { id: 'T3', title: 'Push web app code to CodeCommit',        stepIds: ['9','10','11','12','13','14','15'] },
    { id: 'T4', title: 'Deploy to staging (with approval gate)', stepIds: ['16','17','18','19','20'] },
    { id: 'T5', title: 'Inject secrets via SSM + Secrets Manager', stepIds: ['21','22','23','24','25','26'] },
    { id: 'T6', title: 'Promote to production',                  stepIds: ['27','28','29'] },
    { id: 'T7', title: 'Verify in AWS Console',                  stepIds: ['30'] },
    { id: 'T8', title: 'Cleanup',                                stepIds: ['31','32'] },
  ],

  steps: [
    { stepId: '1',  title: 'cd lab3/pipeline; ls files', strategy: 'local-cli', tools: ['bash'] },
    { stepId: '2',  title: 'Review codepipeline.tf — 8-stage flow', strategy: 'manual-only', notes: 'Read/understand' },
    { stepId: '3',  title: 'Review codebuild.tf — Golden Rule', strategy: 'manual-only', notes: 'Read/understand' },
    { stepId: '4',  title: 'Review iam.tf — pipeline + codebuild roles', strategy: 'manual-only', notes: 'Read/understand' },
    { stepId: '5',  title: 'Configure terraform.tfvars (account, state_bucket from Lab 1)', strategy: 'local-cli', tools: ['file-edit'] },
    { stepId: '6',  title: 'Edit providers.tf backend block', strategy: 'local-cli', tools: ['file-edit'] },
    { stepId: '7',  title: 'terraform init/plan/apply (~15 resources)', strategy: 'local-cli', tools: ['terraform'], notes: 'Needs -auto-approve' },
    { stepId: '8',  title: 'Open CodePipeline console — stages show as failed (empty repo)', strategy: 'aws-ui', notes: 'aws-cli alt: aws codepipeline get-pipeline-state' },
    { stepId: '9',  title: 'Configure git credential helper for CodeCommit', strategy: 'local-cli', tools: ['git', 'aws-cli'] },
    { stepId: '10', title: 'Clone empty CodeCommit repo as webapp-repo', strategy: 'local-cli', tools: ['git'] },
    { stepId: '11', title: 'Copy lab3/app-repo/* into webapp-repo', strategy: 'local-cli', tools: ['bash'] },
    { stepId: '12', title: 'Review vpc.tf tagging', strategy: 'manual-only', notes: 'Read/understand' },
    { stepId: '13', title: 'Review compute.tf EC2 user_data', strategy: 'manual-only', notes: 'Read/understand' },
    { stepId: '14', title: 'Edit environments/{staging,prod}/terraform.tfvars', strategy: 'local-cli', tools: ['file-edit'] },
    { stepId: '15', title: 'git checkout -b main; commit; push — triggers pipeline', strategy: 'local-cli', tools: ['git'] },
    { stepId: '16', title: 'Watch pipeline progress', strategy: 'aws-ui', notes: 'aws-cli alt: poll aws codepipeline get-pipeline-state' },
    { stepId: '17', title: 'Handle Validate failure with terraform fmt', strategy: 'local-cli', tools: ['terraform', 'git'], expectFailure: true, notes: 'Conditional — only if Validate stage actually fails' },
    { stepId: '18', title: 'Review Plan-Staging in CodeBuild logs (expect 7 to add)', strategy: 'aws-ui', notes: 'aws-cli alt: aws logs filter-log-events' },
    { stepId: '19', title: 'Approve Staging deployment (Review → Approve)', strategy: 'aws-ui', notes: 'aws-cli alt: aws codepipeline put-approval-result --action-name Approve --result summary=ok,status=Approved' },
    { stepId: '20', title: 'Verify staging via S3 state + curl public IP', strategy: 'aws-cli', tools: ['aws-cli', 'jq', 'curl'] },
    { stepId: '21', title: 'aws ssm put-parameter db_host + verify', strategy: 'aws-cli', tools: ['aws-cli'] },
    { stepId: '22', title: 'aws secretsmanager create-secret db_password', strategy: 'aws-cli', tools: ['aws-cli'] },
    { stepId: '23', title: 'Edit codebuild.tf buildspec env: block', strategy: 'local-cli', tools: ['file-edit'] },
    { stepId: '24', title: 'Wire DB_HOST/DB_PASSWORD via -var; add variables.tf', strategy: 'local-cli', tools: ['file-edit'] },
    { stepId: '25', title: 'Re-apply pipeline; git push webapp-repo', strategy: 'local-cli', tools: ['terraform', 'git'] },
    { stepId: '26', title: 'Verify env vars + masked secret in CodeBuild logs', strategy: 'aws-ui', notes: 'aws-cli alt: aws logs filter-log-events for DB_HOST/DB_PASSWORD' },
    { stepId: '27', title: 'Review Plan-Prod in CodeBuild logs (us-west-2)', strategy: 'aws-ui', notes: 'aws-cli alt: aws logs filter-log-events' },
    { stepId: '28', title: 'Approve Production deployment', strategy: 'aws-ui', notes: 'aws-cli alt: aws codepipeline put-approval-result' },
    { stepId: '29', title: 'curl production public IP', strategy: 'local-cli', tools: ['curl'] },
    { stepId: '30', title: 'Verify resources in EC2/VPC consoles by tag', strategy: 'aws-ui', notes: 'aws-cli alt: aws ec2 describe-instances --filters' },
    { stepId: '31', title: 'terraform destroy staging + prod', strategy: 'local-cli', tools: ['terraform'] },
    { stepId: '32', title: 'aws ec2 describe-instances to verify cleanup in both regions', strategy: 'aws-cli', tools: ['aws-cli'] },
  ],
};

export default inventory;
