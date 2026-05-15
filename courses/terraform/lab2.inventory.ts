/**
 * Step inventory for Terraform Day 3 Lab 2: Import Day 1-2 Infrastructure into Remote State.
 *
 * Authored against:
 *   labforge_iterations/iteration_1/Lab_02_Import_Legacy_Application.md
 *   sha256: 08b81378374196bce6d29ce93f70ee0a56ca841b4c49aea6340556ac4ea720f8
 */

import { LabInventory } from '../../core/inventory';

export const inventory: LabInventory = {
  course: 'terraform',
  labNumber: 2,
  labName: 'Import Day 1-2 Infrastructure into Remote State',
  sourcePath: 'I:/My Drive/CourseCreationKit/courses/Terraform_Day_3/labforge_iterations/iteration_1/Lab_02_Import_Legacy_Application.md',
  sourceHash: '08b81378374196bce6d29ce93f70ee0a56ca841b4c49aea6340556ac4ea720f8',

  externalResources: [
    { kind: 'git-repo', url: 'https://github.com/AWSClassroom-com/Advanced_Terraform', description: 'lab2/import/ and lab2/day1-vpc-lean/' },
  ],

  tasks: [
    { id: 'T1', title: 'Check existing infra (branch decision)', stepIds: ['1','2','3'] },
    { id: 'T2', title: 'Configure import workspace',             stepIds: ['4','5','6','7'] },
    { id: 'T3', title: 'Review import block declarations',       stepIds: ['8','9'] },
    { id: 'T4', title: 'Generate config (expect conflict)',      stepIds: ['10','11','12'] },
    { id: 'T5', title: 'Import 9 resources',                     stepIds: ['13','14','15','16','17'] },
    { id: 'T6', title: 'prevent_destroy lifecycle guard',        stepIds: ['18','19','20','21'] },
    { id: 'T7', title: 'Cleanup',                                stepIds: ['22','23','24'] },
  ],

  steps: [
    { stepId: '1',  title: 'Check existing VPC + state bucket (s3 ls + describe-vpcs)', strategy: 'aws-cli', tools: ['aws-cli'], notes: 'Branch: skip step 2 if VPC and bucket already exist from Day 1-2' },
    { stepId: '2',  title: 'Deploy lean VPC fallback (cd day1-vpc-lean; init+plan+apply)', strategy: 'local-cli', tools: ['terraform'], notes: 'Only runs if Step 1 found nothing — use -auto-approve' },
    { stepId: '3',  title: 'Capture resource IDs (vpc, subnet, igw, rt, sg, rules)', strategy: 'local-cli', tools: ['terraform', 'aws-cli'] },
    { stepId: '4',  title: 'cd lab2/import', strategy: 'local-cli', tools: ['bash'] },
    { stepId: '5',  title: 'Edit terraform.tfvars with captured IDs', strategy: 'local-cli', tools: ['file-edit'] },
    { stepId: '6',  title: 'Review providers.tf backend block', strategy: 'manual-only', notes: 'Read-only inspection' },
    { stepId: '7',  title: 'terraform init -backend-config + workspace new dev', strategy: 'local-cli', tools: ['terraform'], notes: 'workspace new may error if already exists — treat as benign' },
    { stepId: '8',  title: 'Read imports.tf import blocks', strategy: 'manual-only', notes: 'Conceptual review of import declarations' },
    { stepId: '9',  title: 'Notice compound ID for route table association', strategy: 'manual-only', notes: 'Conceptual review' },
    { stepId: '10', title: 'terraform plan -generate-config-out=generated.tf (expect conflict error)', strategy: 'local-cli', tools: ['terraform'], expectFailure: true, notes: 'Intentional failure: "Conflicting configuration arguments"' },
    { stepId: '11', title: 'cat/head generated.tf to inspect partial output', strategy: 'local-cli', tools: ['bash'] },
    { stepId: '12', title: 'rm generated.tf', strategy: 'local-cli', tools: ['bash'] },
    { stepId: '13', title: 'Review pre-written network.tf + security-group.tf', strategy: 'manual-only', notes: 'Read-only inspection' },
    { stepId: '14', title: 'terraform plan — expect "9 to import, 0 to change"', strategy: 'local-cli', tools: ['terraform'] },
    { stepId: '15', title: 'terraform apply — actually import 9 resources', strategy: 'local-cli', tools: ['terraform'], notes: 'Needs -auto-approve' },
    { stepId: '16', title: 'terraform plan — expect "No changes"', strategy: 'local-cli', tools: ['terraform'] },
    { stepId: '17', title: 'terraform state list shows exactly 9 resources', strategy: 'local-cli', tools: ['terraform'] },
    { stepId: '18', title: 'Add prevent_destroy to VPC in network.tf', strategy: 'local-cli', tools: ['file-edit'] },
    { stepId: '19', title: 'Add prevent_destroy to SG in security-group.tf', strategy: 'local-cli', tools: ['file-edit'] },
    { stepId: '20', title: 'terraform apply to record lifecycle change', strategy: 'local-cli', tools: ['terraform'], notes: 'Needs -auto-approve' },
    { stepId: '21', title: 'terraform plan -destroy — expect prevent_destroy error', strategy: 'local-cli', tools: ['terraform'], expectFailure: true, notes: 'Validates the guard works' },
    { stepId: '22', title: 'Remove prevent_destroy blocks for cleanup', strategy: 'local-cli', tools: ['file-edit'] },
    { stepId: '23', title: 'terraform destroy', strategy: 'local-cli', tools: ['terraform'], notes: 'Lab 1 state bucket untouched' },
    { stepId: '24', title: 'Delete dev workspace', strategy: 'local-cli', tools: ['terraform'] },
  ],
};

export default inventory;
