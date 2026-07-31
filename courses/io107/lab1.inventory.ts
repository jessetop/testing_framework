/**
 * IO-107 Lab 1 — End-to-End EKS Deployment Pipeline.
 *
 * Authored against:
 *   I:/My Drive/CourseCreationKit/courses/SYF/stream2_aws_intermediate/IO-107_SDLC_Pipeline/content/labs/Lab_1_Guide.md
 *   sha256: 306d7f16fe46d592c9454d24cbba584f68b6437e2e716b041705f90c91c3a9f1
 *
 * Update sourceHash if the lab markdown changes — `analyze` flags drift.
 */

import { LabInventory } from '../../core/inventory';
import { labSourcePath, FIXTURE_REPOS } from './lab-source';

export const inventory: LabInventory = {
  course: 'io107',
  labNumber: 1,
  labName: 'End-to-End EKS Deployment Pipeline',
  sourcePath: labSourcePath(1),
  sourceHash: 'a144702185c7ab5ff600a7a81fbce2938aaea91a546cc9db418cb0a14727fa80',

  externalResources: [
    {
      kind: 'git-repo',
      url: FIXTURE_REPOS[1].url,
      description: 'Lab 1 fixture — Flask app + Helm chart + buildspec. Cloned in Task 1.',
    },
  ],

  tasks: [
    { id: 'T1', title: 'Clone the Application Repository',    stepIds: ['1', '2', '3', '4'] },
    { id: 'T2', title: 'Walk Through the buildspec.yml',      stepIds: ['5', '6', '7'] },
    { id: 'T3', title: 'Review the Helm Chart and IRSA Hook', stepIds: ['8', '9', '10', '10a'] },
    { id: 'T4', title: 'Modify Helm Values and Push',         stepIds: ['11', '12', '13', '14'] },
    { id: 'T5', title: 'Observe Each Pipeline Stage',         stepIds: ['15', '16', '17', '18'] },
    { id: 'T6', title: 'Verify Pods, Service, and Endpoint',  stepIds: ['19', '20', '21', '22', '23'] },
    { id: 'T7', title: 'Validate IRSA from Inside the Pod',   stepIds: ['24', '25', '26'] },
  ],

  steps: [
    // ── Task 1: Clone ────────────────────────────────────────────────────
    { stepId: '1',  title: 'Open terminal',                                 strategy: 'manual-only', notes: 'Setup step — assumed before automation runs' },
    { stepId: '2',  title: 'git clone the lab fixture repo',                strategy: 'local-cli',   tools: ['git'] },
    { stepId: '3',  title: 'cd + ls verifies repo structure',               strategy: 'local-cli',   tools: ['git'] },
    { stepId: '4',  title: 'Open chart values.yaml + values-dev.yaml + buildspec.yml in editor', strategy: 'manual-only', notes: 'Editor open is a human prep step; no automation needed' },

    // ── Task 2: Walk through buildspec ────────────────────────────────────
    { stepId: '5',  title: 'Read buildspec.yml phases',          strategy: 'local-cli',   tools: ['cat'], notes: 'Verify file exists + read content' },
    { stepId: '6',  title: 'Identify phase purposes',            strategy: 'manual-only', notes: 'Comprehension step' },
    { stepId: '7',  title: 'Note --atomic + update-kubeconfig',  strategy: 'manual-only', notes: 'Comprehension step' },

    // ── Task 3: Helm chart + IRSA ─────────────────────────────────────────
    { stepId: '8',  title: 'Open values.yaml + locate serviceAccount block', strategy: 'local-cli', tools: ['cat'] },
    { stepId: '9',  title: 'Open values-dev.yaml + observe IRSA annotation', strategy: 'local-cli', tools: ['cat'] },
    { stepId: '10',  title: 'Confirm serviceaccount.yaml template wires annotation', strategy: 'local-cli', tools: ['cat'] },
    { stepId: '10a', title: 'Substitute IRSA role ARN placeholder (sed)',            strategy: 'local-cli', tools: ['sed', 'grep'] },

    // ── Task 4: Edit + push ───────────────────────────────────────────────
    { stepId: '11', title: 'Edit values-dev.yaml: replicaCount 1 → 2',       strategy: 'local-cli', tools: ['sed', 'cat'] },
    { stepId: '12', title: 'git add + commit + push',                        strategy: 'local-cli', tools: ['git'] },
    { stepId: '13', title: 'Navigate to CodePipeline in AWS Console',        strategy: 'aws-ui',    tools: ['codepipeline'], notes: 'Browser navigation — Playwright drives the Console' },
    { stepId: '14', title: 'Watch Source stage → Build stage transitions',   strategy: 'aws-cli',   tools: ['aws codepipeline get-pipeline-state'], notes: 'CLI-poll is faster + more reliable than UI scrape' },

    // ── Task 5: Pipeline stages ───────────────────────────────────────────
    { stepId: '15', title: 'Click Build > Details, open CodeBuild log',      strategy: 'aws-cli',   tools: ['aws codebuild', 'aws logs'], notes: 'Same evidence as UI: fetch the build log via API' },
    { stepId: '16', title: 'Scan log for kubectl/helm checkpoint lines',     strategy: 'aws-cli',   tools: ['aws logs'] },
    { stepId: '17', title: 'Read approval-gate note',                        strategy: 'manual-only', notes: 'Conceptual — dev path has no approval' },
    { stepId: '18', title: 'Confirm pipeline overall Succeeded',             strategy: 'aws-cli',   tools: ['aws codepipeline get-pipeline-state'] },

    // ── Task 6: Verify pods + svc ─────────────────────────────────────────
    { stepId: '19', title: 'aws eks update-kubeconfig',                      strategy: 'local-cli', tools: ['aws', 'kubectl'] },
    { stepId: '20', title: 'kubectl get pods — confirm 2 replicas Ready',    strategy: 'local-cli', tools: ['kubectl'] },
    { stepId: '21', title: 'kubectl describe pod | grep service account',    strategy: 'local-cli', tools: ['kubectl'] },
    { stepId: '22', title: 'kubectl get svc — capture LB hostname',          strategy: 'local-cli', tools: ['kubectl'] },
    { stepId: '23', title: 'curl /health — expect {"status":"healthy"}',     strategy: 'local-cli', tools: ['curl'] },

    // ── Task 7: IRSA from inside pod ──────────────────────────────────────
    { stepId: '24', title: 'kubectl get sa myapp-sa -o yaml',                strategy: 'local-cli', tools: ['kubectl'] },
    { stepId: '25', title: 'kubectl exec env | grep AWS — confirm IRSA vars', strategy: 'local-cli', tools: ['kubectl'] },
    { stepId: '26', title: 'kubectl exec aws s3 ls — confirm IRSA call works', strategy: 'local-cli', tools: ['kubectl', 'aws'] },
  ],
};

export default inventory;
