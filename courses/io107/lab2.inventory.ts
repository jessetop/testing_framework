/**
 * IO-107 Lab 2 — Lambda Deployment with SAM.
 *
 * Authored against:
 *   I:/My Drive/CourseCreationKit/courses/SYF/stream2_aws_intermediate/IO-107_SDLC_Pipeline/content/labs/Lab_2_Guide.md
 *   sha256: df439a5a295e6ce4e2176d8db042d5b9cd25690513052f3938575c7bd0dca320
 */

import { LabInventory } from '../../core/inventory';
import { labSourcePath, FIXTURE_REPOS } from './lab-source';

export const inventory: LabInventory = {
  course: 'io107',
  labNumber: 2,
  labName: 'Lambda Deployment with SAM',
  sourcePath: labSourcePath(2),
  sourceHash: '928e8761b4a7015134ff35dd218c4f983a262c98ee26ae1924a7248f252f466d',

  externalResources: [
    { kind: 'git-repo', url: FIXTURE_REPOS[2].url, description: 'Lab 2 fixture — SAM template + Python handler + buildspec' },
  ],

  tasks: [
    { id: 'T1', title: 'Clone the Serverless Repository',          stepIds: ['1', '2', '3', '4'] },
    { id: 'T2', title: 'Review the SAM Template',                  stepIds: ['5', '6', '7', '8'] },
    { id: 'T3', title: 'Review the Function Code',                 stepIds: ['9', '10'] },
    { id: 'T4', title: 'Add a New POST /items Endpoint',           stepIds: ['11', '12', '13', '14', '15', '16'] },
    { id: 'T5', title: 'Commit and Trigger the Pipeline',          stepIds: ['17', '18'] },
    { id: 'T6', title: 'Observe Traffic Shifting on the Alias',    stepIds: ['19', '20', '21', '22'] },
    { id: 'T7', title: 'Test Both Endpoints',                      stepIds: ['23', '24', '25'] },
    { id: 'T8', title: 'Inspect the Alias from the CLI',           stepIds: ['26', '27', '28'] },
  ],

  steps: [
    { stepId: '1',  title: 'Open terminal',                                 strategy: 'manual-only' },
    { stepId: '2',  title: 'git clone fixture repo',                        strategy: 'local-cli',  tools: ['git'] },
    { stepId: '3',  title: 'cd + ls verifies structure',                    strategy: 'local-cli',  tools: ['git'] },
    { stepId: '4',  title: 'Create working branch',                         strategy: 'local-cli',  tools: ['git'] },
    { stepId: '5',  title: 'Read template.yaml Transform line',             strategy: 'local-cli',  tools: ['cat'] },
    { stepId: '6',  title: 'Read Globals block',                            strategy: 'local-cli',  tools: ['cat'] },
    { stepId: '7',  title: 'Locate ApiFunction + DeploymentPreference',     strategy: 'local-cli',  tools: ['cat'] },
    { stepId: '8',  title: 'Locate ApiErrorAlarm',                          strategy: 'local-cli',  tools: ['cat'] },
    { stepId: '9',  title: 'Read src/app.py handler',                       strategy: 'local-cli',  tools: ['cat'] },
    { stepId: '10', title: 'Confirm routing on path + httpMethod',          strategy: 'manual-only' },
    { stepId: '11', title: 'Edit template.yaml — add CreateItem event',     strategy: 'local-cli',  tools: ['python', 'sed'] },
    { stepId: '12', title: 'Edit src/app.py — add POST handler',            strategy: 'local-cli',  tools: ['python', 'sed'] },
    { stepId: '13', title: 'Sanity-check yaml/python parse',                strategy: 'local-cli',  tools: ['python'] },
    { stepId: '14', title: 'Run pytest locally',                            strategy: 'local-cli',  tools: ['python', 'pytest'] },
    { stepId: '15', title: 'Confirm route registered',                      strategy: 'manual-only' },
    { stepId: '16', title: 'Read remediated handler',                       strategy: 'manual-only' },
    { stepId: '17', title: 'git commit + push (triggers pipeline)',         strategy: 'local-cli',  tools: ['git'] },
    { stepId: '18', title: 'Poll CodePipeline Build + Deploy stages',       strategy: 'aws-cli',    tools: ['aws codepipeline get-pipeline-state'] },
    { stepId: '19', title: 'Open Lambda console > function',                strategy: 'aws-cli',    tools: ['aws lambda list-functions'], notes: 'Console view ↔ CLI equivalence' },
    { stepId: '20', title: 'View alias weights (10/90 canary)',             strategy: 'aws-cli',    tools: ['aws lambda get-alias'] },
    { stepId: '21', title: 'Watch shift to 100%',                           strategy: 'aws-cli',    tools: ['aws lambda get-alias'] },
    { stepId: '22', title: 'Confirm CodeDeploy deployment record',          strategy: 'aws-cli',    tools: ['aws deploy list-deployments'] },
    { stepId: '23', title: 'curl GET /items endpoint',                      strategy: 'local-cli',  tools: ['curl'] },
    { stepId: '24', title: 'curl POST /items endpoint',                     strategy: 'local-cli',  tools: ['curl'] },
    { stepId: '25', title: 'curl GET /health',                              strategy: 'local-cli',  tools: ['curl'] },
    { stepId: '26', title: 'aws lambda list-versions-by-function',          strategy: 'aws-cli',    tools: ['aws lambda list-versions-by-function'] },
    { stepId: '27', title: 'aws lambda get-alias live',                     strategy: 'aws-cli',    tools: ['aws lambda get-alias'] },
    { stepId: '28', title: 'Confirm alias FunctionVersion is current',      strategy: 'aws-cli',    tools: ['aws lambda get-alias'] },
  ],
};

export default inventory;
