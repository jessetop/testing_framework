/**
 * Step inventory for Terraform Day 3 Lab 4: Auditing & Observability.
 *
 * Authored against:
 *   labforge_iterations/iteration_1/Lab_04_Auditing_and_Observability.md
 *   sha256: 0d22449e11696db657de3bbc69a8f15118771eb61d40a8adef5fa0a04f983f8f
 *
 * NOTE: 8 of 14 steps are `aws-ui` (CloudTrail Event History, Logs Insights,
 * CloudWatch Dashboards). All have aws-cli equivalents (cloudtrail lookup-events,
 * logs start-query, etc.) — captured in step notes. Test can use either.
 */

import { LabInventory } from '../../core/inventory';
import { labSourcePath } from './lab-source';

export const inventory: LabInventory = {
  course: 'terraform',
  labNumber: 4,
  labName: 'Auditing & Observability',
  sourcePath: labSourcePath(4),
  sourceHash: '0d22449e11696db657de3bbc69a8f15118771eb61d40a8adef5fa0a04f983f8f',

  externalResources: [
    { kind: 'git-repo', url: 'https://github.com/AWSClassroom-com/Advanced_Terraform', description: 'lab4/observability/' },
    { kind: 'account', url: 'aws://cloudtrail', description: 'CloudTrail must be enabled (typically default on management account); optional delivery to CloudWatch Logs' },
  ],

  tasks: [
    { id: 'T1', title: 'CloudTrail query demo',                stepIds: ['1','2','3','4'] },
    { id: 'T2', title: 'CloudWatch Logs Insights (optional)',  stepIds: ['5','6','7','8','9'] },
    { id: 'T3', title: 'Deploy observability dashboard',       stepIds: ['10','11','12','13','14'] },
  ],

  steps: [
    { stepId: '1',  title: 'Navigate to CloudTrail Event history', strategy: 'aws-ui', notes: 'aws-cli alt: aws cloudtrail lookup-events' },
    { stepId: '2',  title: 'Filter for Terraform activity (3 lookups)', strategy: 'aws-ui', notes: 'aws-cli alt: aws cloudtrail lookup-events --lookup-attributes' },
    { stepId: '3',  title: 'Examine a PutParameter event JSON', strategy: 'aws-ui', notes: 'aws-cli alt: parse cloudtrail lookup-events output for userIdentity.arn / userAgent / sourceIPAddress' },
    { stepId: '4',  title: 'Compare pipeline vs console activity side-by-side', strategy: 'manual-only', notes: 'Conceptual review — comparing two event sets' },
    { stepId: '5',  title: 'Navigate to CloudWatch Logs Insights', strategy: 'aws-ui', notes: 'aws-cli alt: aws logs start-query' },
    { stepId: '6',  title: 'Select CloudTrail log group + 12h range', strategy: 'aws-ui', notes: 'May skip if no CloudTrail→CloudWatch Logs delivery configured (lab documents the bail-out)' },
    { stepId: '7',  title: 'Run Terraform activity Logs Insights query', strategy: 'aws-ui', notes: 'aws-cli alt: aws logs start-query --query-string ... + aws logs get-query-results' },
    { stepId: '8',  title: 'Run resource-scoped SSM PutParameter query', strategy: 'aws-ui', notes: 'aws-cli alt: aws logs start-query' },
    { stepId: '9',  title: 'Save query as userxx-terraform-activity', strategy: 'aws-ui', notes: 'aws-cli alt: aws logs put-query-definition' },
    { stepId: '10', title: 'cd lab4/observability; ls -la', strategy: 'local-cli', tools: ['bash'] },
    { stepId: '11', title: 'Review dashboard.tf configuration', strategy: 'local-cli', tools: ['bash'], notes: 'Read-only inspection (could be manual-only but file exists for ls)' },
    { stepId: '12', title: 'Configure terraform.tfvars and providers.tf backend (Lab 1 bucket name)', strategy: 'local-cli', tools: ['file-edit'] },
    { stepId: '13', title: 'terraform init / plan / apply — deploy dashboard', strategy: 'local-cli', tools: ['terraform'], notes: 'Needs -auto-approve' },
    { stepId: '14', title: 'terraform output dashboard_url + verify accessible', strategy: 'local-cli', tools: ['terraform'], notes: 'Data takes 5-10 min to populate after deploy' },
  ],
};

export default inventory;
