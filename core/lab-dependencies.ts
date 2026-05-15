/**
 * Lab Dependency System
 *
 * Manages dependencies between labs. When running Lab 2, automatically
 * runs Lab 1 first if needed. Resources are only cleaned up after ALL
 * dependent labs complete.
 *
 * Usage in test specs:
 *   import { ensureLabDependency } from '../../../core/lab-dependencies';
 *   // In beforeAll:
 *   await ensureLabDependency('anthropic', 1);  // Ensures Lab 1 ran and KB exists
 */

import { execSync } from 'child_process';

export interface DependencyResult {
  satisfied: boolean;
  knowledgeBaseId?: string;
  resources: string[];
}

/**
 * Check if Lab 1's Knowledge Base exists and is Active.
 * Returns the KB ID if found.
 */
export function checkAnthropicLab1(): DependencyResult {
  try {
    const result = JSON.parse(execSync(
      'aws --profile roitraining bedrock-agent list-knowledge-bases --region us-east-1 --output json',
      { encoding: 'utf-8', timeout: 15000 }
    ));
    const activeKb = result.knowledgeBaseSummaries?.find(
      (kb: any) => kb.status === 'ACTIVE'
    );
    if (activeKb) {
      return {
        satisfied: true,
        knowledgeBaseId: activeKb.knowledgeBaseId,
        resources: [`KB:${activeKb.knowledgeBaseId}`],
      };
    }
  } catch {}
  return { satisfied: false, resources: [] };
}

/**
 * Run Lab 1 to create the Knowledge Base.
 * Called automatically when Lab 2 needs it.
 */
export function runAnthropicLab1(): DependencyResult {
  console.log('Lab 2 depends on Lab 1 — running Lab 1 first...');
  console.log('(Lab 1 resources will be cleaned up after Lab 2 completes)');

  try {
    // Run Lab 1 but tell it NOT to clean up resources
    execSync(
      'npx playwright test --grep "Anthropic Lab 1"',
      {
        encoding: 'utf-8',
        timeout: 30 * 60 * 1000, // 30 min
        env: { ...process.env, SKIP_CLEANUP: 'true' },
        cwd: process.cwd(),
        stdio: 'inherit',
      }
    );
  } catch (err: any) {
    console.log('Lab 1 had some failures but checking if KB was created...');
  }

  return checkAnthropicLab1();
}

/**
 * Ensure a lab dependency is satisfied.
 * If not, runs the dependency lab first.
 */
export async function ensureLabDependency(
  course: string,
  labNumber: number,
): Promise<DependencyResult> {
  if (course === 'anthropic' && labNumber === 1) {
    const check = checkAnthropicLab1();
    if (check.satisfied) {
      console.log(`Lab 1 dependency satisfied: KB ${check.knowledgeBaseId} is Active`);
      return check;
    }
    return runAnthropicLab1();
  }

  throw new Error(`Unknown dependency: ${course} Lab ${labNumber}`);
}

/**
 * Clean up ALL resources for a course (run after the final lab completes).
 */
export function cleanupAllResources(course: string): void {
  if (course === 'anthropic') {
    console.log('Cleaning up all Anthropic lab resources...');
    try {
      // Delete all KBs
      const kbs = JSON.parse(execSync(
        'aws --profile roitraining bedrock-agent list-knowledge-bases --region us-east-1 --output json',
        { encoding: 'utf-8', timeout: 15000 }
      ));
      for (const kb of kbs.knowledgeBaseSummaries || []) {
        console.log(`  Deleting KB: ${kb.name} (${kb.knowledgeBaseId})`);
        execSync(`aws --profile roitraining bedrock-agent delete-knowledge-base --knowledge-base-id ${kb.knowledgeBaseId} --region us-east-1`,
          { timeout: 15000 });
      }

      // Delete OpenSearch collections
      const cols = JSON.parse(execSync(
        'aws --profile roitraining opensearchserverless list-collections --region us-east-1 --output json',
        { encoding: 'utf-8', timeout: 15000 }
      ));
      for (const col of cols.collectionSummaries || []) {
        if (col.name.startsWith('bedrock-knowledge-base')) {
          console.log(`  Deleting OpenSearch collection: ${col.name}`);
          execSync(`aws --profile roitraining opensearchserverless delete-collection --id ${col.id} --region us-east-1`,
            { timeout: 15000 });
        }
      }

      // Delete Guardrails
      const guardrails = JSON.parse(execSync(
        'aws --profile roitraining bedrock list-guardrails --region us-east-1 --output json',
        { encoding: 'utf-8', timeout: 15000 }
      ));
      for (const gr of guardrails.guardrails || []) {
        console.log(`  Deleting Guardrail: ${gr.name} (${gr.id})`);
        execSync(`aws --profile roitraining bedrock delete-guardrail --guardrail-identifier ${gr.id} --region us-east-1`,
          { timeout: 15000 });
      }

      // Delete CloudWatch dashboards
      try {
        execSync(
          'aws --profile roitraining cloudwatch delete-dashboards --dashboard-names Lab2-Monitoring --region us-east-1',
          { timeout: 15000 }
        );
        console.log('  Deleted CloudWatch dashboard: Lab2-Monitoring');
      } catch {}

      // Delete SAM stack
      try {
        execSync(
          'aws --profile roitraining cloudformation delete-stack --stack-name lab2-claude-app --region us-east-1',
          { timeout: 15000 }
        );
        console.log('  Deleted SAM stack: lab2-claude-app');
      } catch {}

      console.log('All Anthropic resources cleaned up');
    } catch (e) {
      console.log(`Cleanup error: ${e}`);
    }
  }
}
