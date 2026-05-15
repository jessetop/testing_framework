/**
 * Terraform Day 3 — Lab 4: Auditing & Observability
 *
 * SOC 2-style visibility: CloudTrail Event History queries, CloudWatch Logs
 * Insights, CloudWatch dashboard for Terraform/CodeBuild/CodePipeline activity.
 *
 * Lab is console-heavy as written. Test uses aws-cli equivalents:
 *   - cloudtrail lookup-events for steps 1-3
 *   - logs start-query / get-query-results for steps 5-9 (if CloudTrail→CWL exists)
 *   - terraform for the dashboard deploy (steps 10-14)
 *
 * REQUIRES: Lab 3 to have run (CloudTrail events from pipeline activity).
 *           Lab 1's state bucket name.
 */

import * as path from 'path';
import { lab1Config, requirements, jqAvailable } from './lab1.config';
import inventory from '../lab4.inventory';

export const lab4Config = {
  studentId: lab1Config.studentId,
  awsProfile: lab1Config.awsProfile,
  region: lab1Config.region,

  get workspaceRoot(): string {
    return path.resolve(__dirname, '..', '..', '..', 'test-results', 'terraform-lab4', this.studentId || 'unset');
  },
  get repoDir(): string {
    return path.join(this.workspaceRoot, 'Advanced_Terraform');
  },
  get observabilityDir(): string {
    return path.join(this.repoDir, 'lab4', 'observability');
  },

  repoUrl: 'https://github.com/AWSClassroom-com/Advanced_Terraform.git',

  /** How far back the CloudTrail lookup-events should scan (steps 1-3). */
  cloudtrailLookbackMinutes: 60,
  /** Task 2 (Logs Insights) is optional — depends on CloudTrail→CWL delivery. */
  logsInsightsRequired: false,
};

export function validateConfig() {
  const missing: string[] = [];
  const toolFailures: string[] = [];
  const warnings: string[] = [];

  if (!lab4Config.studentId) missing.push('TERRAFORM_STUDENT_ID');

  for (const req of requirements) {
    const r = req.check();
    if (!r.ok) {
      const msg = `${req.name}: ${r.detail}\n        Fix: ${req.howToFix}`;
      if (req.optional) warnings.push(msg);
      else toolFailures.push(msg);
    }
  }

  return { valid: missing.length === 0 && toolFailures.length === 0, missing, toolFailures, warnings };
}

export { inventory };
export { jqAvailable };
