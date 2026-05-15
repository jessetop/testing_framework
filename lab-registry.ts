/**
 * Lab Test Registry
 *
 * Central registry of all available lab tests and their requirements.
 * Used to validate prerequisites before running tests.
 */

export interface ManualInput {
  name: string;
  envVar: string;
  description: string;
  required: boolean;
  expiresQuickly?: boolean;  // True for things like Splunk download URLs
  howToGet: string;
}

export interface LabTestConfig {
  course: string;
  labNumber: number;
  labName: string;
  testFile: string;
  description: string;
  estimatedDuration: string;
  manualInputs: ManualInput[];
  prerequisites?: string[];  // Other labs that must be completed first
}

/**
 * Registry of all available lab tests
 */
export const LAB_REGISTRY: LabTestConfig[] = [
  // ==================== SPLUNK ====================
  {
    course: 'splunk',
    labNumber: 1,
    labName: 'Manual Installation and Hardening',
    testFile: 'courses/splunk/tests/lab1-installation-hardening.spec.ts',
    description: 'Deploy EC2, install Splunk Enterprise, configure systemd, test resiliency',
    estimatedDuration: '15-20 minutes',
    manualInputs: [
      {
        name: 'Splunk Download URL',
        envVar: 'SPLUNK_DOWNLOAD_URL',
        description: 'wget URL for Splunk Enterprise .tgz file',
        required: true,
        expiresQuickly: true,
        howToGet: 'splunk.com → Free Splunk → Enterprise → Linux → .tgz → Copy wget link',
      },
      {
        name: 'Splunk Admin Password',
        envVar: 'SPLUNK_ADMIN_PASSWORD',
        description: 'Password for Splunk admin account (min 8 chars)',
        required: true,
        howToGet: 'Choose any password, default: LabPassword123!',
      },
    ],
  },
  // ==================== ANTHROPIC ON BEDROCK ====================
  {
    course: 'anthropic',
    labNumber: 1,
    labName: 'Claude on Bedrock with RAG',
    testFile: 'courses/anthropic/tests/lab1-claude-bedrock-rag.spec.ts',
    description: 'Invoke Claude models, compare metrics, create knowledge base, test RAG queries',
    estimatedDuration: '20-30 minutes',
    manualInputs: [
      {
        name: 'AWS Account ID',
        envVar: 'AWS_ACCOUNT_ID',
        description: '12-digit AWS account number for S3 bucket path',
        required: true,
        howToGet: 'AWS Console → top-right dropdown → Account ID',
      },
      {
        name: 'User Initials',
        envVar: 'USER_INITIALS',
        description: 'Your initials for naming the knowledge base (e.g., "jd")',
        required: false,
        howToGet: 'Your initials (default: "pt")',
      },
    ],
    prerequisites: [
      'Model access enabled for Claude Opus 4.6, Sonnet 4.6, Haiku 4.5 in Bedrock',
      'S3 bucket s3://bedrock-training-{account-id}/lab1-documents/ with sample docs uploaded',
    ],
  },
  {
    course: 'anthropic',
    labNumber: 2,
    labName: 'Build a Complete Claude-Powered Application',
    testFile: 'courses/anthropic/tests/lab2-claude-application.spec.ts',
    description: 'Tool use, guardrails, CloudWatch monitoring, SAM deployment',
    estimatedDuration: '30-45 minutes',
    manualInputs: [
      {
        name: 'Knowledge Base ID',
        envVar: 'KNOWLEDGE_BASE_ID',
        description: 'Knowledge Base ID from Lab 1 (Bedrock console → Knowledge bases → copy ID)',
        required: true,
        howToGet: 'Bedrock console → Knowledge bases → Copy KB ID from Lab 1',
      },
      {
        name: 'User Initials',
        envVar: 'USER_INITIALS',
        description: 'Your initials for resource naming (reused from Lab 1)',
        required: false,
        howToGet: 'Your initials (default: "pt")',
      },
    ],
    prerequisites: [
      'Lab 1 must be completed (Knowledge Base created and synced)',
      'Model access enabled for Claude Sonnet 4.6 in Bedrock',
      'Python 3.11+ installed locally with boto3',
      'AWS SAM CLI installed (for Part 5 deployment)',
    ],
  },
  // ==================== ANTHROPIC INDUSTRY LABS ====================
  {
    course: 'anthropic',
    labNumber: 3,
    labName: 'Fintech: Document Processing & Compliance',
    testFile: 'courses/anthropic/tests/lab3-fintech.spec.ts',
    description: 'Financial KB, compliance RAG, AML tools, financial guardrails',
    estimatedDuration: '30-40 minutes',
    manualInputs: [
      { name: 'AWS Account ID', envVar: 'AWS_ACCOUNT_ID', description: '12-digit AWS account number', required: true, howToGet: 'AWS Console → top-right → Account ID' },
    ],
    prerequisites: [
      'S3 documents uploaded: npm run setup:anthropic-lab3',
      'Model access enabled for Claude Sonnet 4.6',
    ],
  },
  {
    course: 'anthropic',
    labNumber: 4,
    labName: 'Healthcare: HIPAA-Compliant AI Assistant',
    testFile: 'courses/anthropic/tests/lab4-healthcare.spec.ts',
    description: 'Clinical KB, medical RAG, scheduling tools, HIPAA guardrails',
    estimatedDuration: '30-40 minutes',
    manualInputs: [
      { name: 'AWS Account ID', envVar: 'AWS_ACCOUNT_ID', description: '12-digit AWS account number', required: true, howToGet: 'AWS Console → top-right → Account ID' },
    ],
    prerequisites: [
      'S3 documents uploaded: npm run setup:anthropic-lab4',
      'Model access enabled for Claude Sonnet 4.6',
    ],
  },
  {
    course: 'anthropic',
    labNumber: 5,
    labName: 'Media: Content Intelligence Platform',
    testFile: 'courses/anthropic/tests/lab5-media.spec.ts',
    description: 'Content catalog KB, recommendation RAG, moderation guardrails',
    estimatedDuration: '30-40 minutes',
    manualInputs: [
      { name: 'AWS Account ID', envVar: 'AWS_ACCOUNT_ID', description: '12-digit AWS account number', required: true, howToGet: 'AWS Console → top-right → Account ID' },
    ],
    prerequisites: [
      'S3 documents uploaded: npm run setup:anthropic-lab5',
      'Model access enabled for Claude Sonnet 4.6',
    ],
  },
  // ==================== TERRAFORM DAY 3 ====================
  // All four labs use shared inputs: TERRAFORM_STUDENT_ID, TERRAFORM_REGION,
  // AWS_PROFILE. Per-lab differences are in prerequisites and lab dependencies.
  {
    course: 'terraform',
    labNumber: 1,
    labName: 'Multi-Environment State Strategy',
    testFile: 'courses/terraform/tests/lab1-multi-env-state.spec.ts',
    description: 'Workspaces, workspace safety guards, cross-state dependencies, S3 native locking',
    estimatedDuration: '15-25 minutes (CLI-driven, runs locally)',
    manualInputs: [
      {
        name: 'Terraform Student ID',
        envVar: 'TERRAFORM_STUDENT_ID',
        description: 'Namespace for lab resources (e.g. "student99" — high number to avoid student collisions)',
        required: true,
        howToGet: 'Pick a high-numbered studentXX value that won\'t collide with real students in the shared AWS account',
      },
      {
        name: 'Terraform Region',
        envVar: 'TERRAFORM_REGION',
        description: 'AWS region for the state bucket and resources (default: us-east-2)',
        required: false,
        howToGet: 'Default us-east-2; override if your assigned region differs',
      },
      {
        name: 'AWS Profile',
        envVar: 'AWS_PROFILE',
        description: 'Named AWS CLI profile (default: roitraining)',
        required: false,
        howToGet: 'Should already be configured: aws configure --profile roitraining',
      },
    ],
    prerequisites: [
      'Terraform >= 1.10 on PATH (required for S3 native locking via use_lockfile = true)',
      'AWS CLI v2 with the configured profile usable',
      'git on PATH (test clones github.com/AWSClassroom-com/Advanced_Terraform)',
      'jq on PATH (used by Task 4 state inspection)',
    ],
  },
  {
    course: 'terraform',
    labNumber: 2,
    labName: 'Import Day 1-2 Infrastructure into Remote State',
    testFile: 'courses/terraform/tests/lab2-import-legacy-infra.spec.ts',
    description: 'terraform import blocks, config generation, prevent_destroy lifecycle guard',
    estimatedDuration: '10-15 minutes (SKELETON — not yet implemented)',
    manualInputs: [
      { name: 'Terraform Student ID', envVar: 'TERRAFORM_STUDENT_ID', description: 'Same as Lab 1', required: true, howToGet: 'Same TERRAFORM_STUDENT_ID used across the Terraform suite' },
    ],
    prerequisites: [
      'Lab 1 must have run (state bucket created)',
      'Same tooling as Lab 1 (terraform, aws-cli, git)',
    ],
  },
  {
    course: 'terraform',
    labNumber: 3,
    labName: 'Pipeline Operations',
    testFile: 'courses/terraform/tests/lab3-pipeline-operations.spec.ts',
    description: 'CodePipeline + CodeBuild + CodeCommit CI/CD, multi-region, secrets injection, manual approvals',
    estimatedDuration: '30-45 minutes (SKELETON — not yet implemented; pipeline waits are long)',
    manualInputs: [
      { name: 'Terraform Student ID', envVar: 'TERRAFORM_STUDENT_ID', description: 'Same as Lab 1', required: true, howToGet: 'Same TERRAFORM_STUDENT_ID used across the Terraform suite' },
    ],
    prerequisites: [
      'Lab 1 must have run (state bucket reused)',
      'Same tooling as Lab 1 (terraform, aws-cli, git, jq, curl)',
      'COST: t3.micro EC2 in staging + prod + Secrets Manager secret until cleanup',
      'Multi-region: us-east-2 staging, us-west-2 prod',
    ],
  },
  {
    course: 'terraform',
    labNumber: 4,
    labName: 'Auditing & Observability',
    testFile: 'courses/terraform/tests/lab4-auditing.spec.ts',
    description: 'CloudTrail queries, Logs Insights, CloudWatch dashboard for Terraform/pipeline activity',
    estimatedDuration: '10-15 minutes (SKELETON — not yet implemented)',
    manualInputs: [
      { name: 'Terraform Student ID', envVar: 'TERRAFORM_STUDENT_ID', description: 'Same as Lab 1', required: true, howToGet: 'Same TERRAFORM_STUDENT_ID used across the Terraform suite' },
    ],
    prerequisites: [
      'Labs 1+3 must have run (CloudTrail events from pipeline activity populate the dashboard)',
      'CloudTrail enabled on the AWS account (typically default)',
      'Same tooling as Lab 1',
      'COST: $3/month per CloudWatch dashboard beyond the first 3 — cleanup matters',
    ],
  },
];

/**
 * Find a lab test by course and lab number
 */
export function findLabTest(course: string, labNumber: number): LabTestConfig | undefined {
  return LAB_REGISTRY.find(
    lab => lab.course.toLowerCase() === course.toLowerCase() && lab.labNumber === labNumber
  );
}

/**
 * Get all labs for a course
 */
export function getLabsForCourse(course: string): LabTestConfig[] {
  return LAB_REGISTRY.filter(lab => lab.course.toLowerCase() === course.toLowerCase());
}

/**
 * Get all available courses
 */
export function getAvailableCourses(): string[] {
  return [...new Set(LAB_REGISTRY.map(lab => lab.course))];
}

/**
 * Validate that all required inputs are provided for a lab
 */
export function validateLabInputs(lab: LabTestConfig): {
  valid: boolean;
  missing: ManualInput[];
  provided: ManualInput[];
  warnings: string[];
} {
  const missing: ManualInput[] = [];
  const provided: ManualInput[] = [];
  const warnings: string[] = [];

  for (const input of lab.manualInputs) {
    const value = process.env[input.envVar];

    if (!value || value.trim() === '') {
      if (input.required) {
        missing.push(input);
      }
    } else {
      provided.push(input);

      // Check for potentially stale URLs
      if (input.expiresQuickly) {
        warnings.push(`${input.name} expires quickly - make sure it's fresh!`);
      }
    }
  }

  return {
    valid: missing.length === 0,
    missing,
    provided,
    warnings,
  };
}

/**
 * Format lab info for display
 */
export function formatLabInfo(lab: LabTestConfig): string {
  const lines = [
    ``,
    `╔════════════════════════════════════════════════════════════════════╗`,
    `║  ${lab.course.toUpperCase()} - Lab ${lab.labNumber}: ${lab.labName.padEnd(40)}║`,
    `╠════════════════════════════════════════════════════════════════════╣`,
    `║  ${lab.description.substring(0, 64).padEnd(64)}║`,
    `║  Duration: ${lab.estimatedDuration.padEnd(53)}║`,
    `╚════════════════════════════════════════════════════════════════════╝`,
  ];
  return lines.join('\n');
}

/**
 * Format validation result for display
 */
export function formatValidationResult(lab: LabTestConfig, validation: ReturnType<typeof validateLabInputs>): string {
  const lines: string[] = [];

  if (validation.valid) {
    lines.push(`\n✅ All required inputs provided for ${lab.course} Lab ${lab.labNumber}`);

    if (validation.warnings.length > 0) {
      lines.push(`\n⚠️  Warnings:`);
      validation.warnings.forEach(w => lines.push(`   - ${w}`));
    }

    lines.push(`\nReady to run: npm test -- --grep "Lab ${lab.labNumber}"`);
  } else {
    lines.push(`\n❌ Missing required inputs for ${lab.course} Lab ${lab.labNumber}:\n`);

    validation.missing.forEach(input => {
      lines.push(`   ${input.name}`);
      lines.push(`   └─ Set: export ${input.envVar}="..."`);
      lines.push(`   └─ How: ${input.howToGet}`);
      lines.push(``);
    });
  }

  return lines.join('\n');
}

/**
 * Main validation entry point
 */
export function checkLabReadiness(course: string, labNumber: number): void {
  const lab = findLabTest(course, labNumber);

  if (!lab) {
    const availableLabs = getLabsForCourse(course);

    if (availableLabs.length === 0) {
      console.log(`\n❌ No lab tests found for course: ${course}`);
      console.log(`\nAvailable courses: ${getAvailableCourses().join(', ')}`);
    } else {
      console.log(`\n❌ Lab ${labNumber} not found for ${course}`);
      console.log(`\nAvailable labs for ${course}:`);
      availableLabs.forEach(l => {
        console.log(`   Lab ${l.labNumber}: ${l.labName}`);
      });
    }

    console.log(`\nTo create a new lab test, provide the lab markdown file.`);
    return;
  }

  console.log(formatLabInfo(lab));

  const validation = validateLabInputs(lab);
  console.log(formatValidationResult(lab, validation));
}

// CLI entry point
if (require.main === module) {
  const args = process.argv.slice(2);

  if (args.length < 2) {
    console.log('Usage: npx ts-node lab-registry.ts <course> <lab-number>');
    console.log('Example: npx ts-node lab-registry.ts splunk 1');
    console.log(`\nAvailable courses: ${getAvailableCourses().join(', ')}`);
    process.exit(1);
  }

  const [course, labNum] = args;
  checkLabReadiness(course, parseInt(labNum));
}
