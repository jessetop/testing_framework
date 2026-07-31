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
  // ==================== IO-107 (SDLC PIPELINE + DEPLOYMENT GUARDRAILS) ====================
  // Source: roi-cloud-fun/io-107 monorepo. Per-student CodeCommit repos seeded at bootstrap.
  // No GitHub fork needed — CodeCommit is the writable source-of-truth.
  {
    course: 'io107',
    labNumber: 1,
    labName: 'End-to-End EKS Deployment Pipeline',
    testFile: 'courses/io107/tests/lab1-eks-deployment.spec.ts',
    description: 'Clone per-student CodeCommit repo (seeded from roi-cloud-fun/io-107/lab_1/), edit Helm values, push, verify CodePipeline runs green, kubectl-verify pods + IRSA from inside the pod',
    estimatedDuration: '15-20 minutes (after lab_env_student/ apply, which takes ~25-35 min)',
    manualInputs: [
      { name: 'Student ID', envVar: 'IO107_STUDENT_ID', description: 'Short ID matching student_id in the lab_env_student terraform apply', required: true, howToGet: 'Choose a unique short ID (e.g. ltf-smoke)' },
      { name: 'AWS Region', envVar: 'IO107_REGION',     description: 'Region of the lab_env_student apply', required: false, howToGet: 'Default us-east-1' },
    ],
    prerequisites: [
      'lab_env_student/ Terraform applied (self-contained: VPC, EKS, ECR, IRSA OIDC, CodeCommit, pipeline, namespace, IRSA role)',
      'aws CLI v2 + kubectl + git on PATH; codecommit credential helper configured',
      'Test runner IAM role can: codepipeline:*, codebuild:*, eks:DescribeCluster, eks:AccessKubernetesApi, logs:*, codecommit:*',
    ],
  },
  {
    course: 'io107',
    labNumber: 2,
    labName: 'Lambda Deployment with SAM',
    testFile: 'courses/io107/tests/lab2-lambda-sam.spec.ts',
    description: 'Clone per-student CodeCommit repo (roi-cloud-fun/io-107/lab_2/), add POST /items, push to main, pipeline runs sam build + sam deploy with Canary10Percent5Minutes traffic shifting',
    estimatedDuration: '10-15 minutes',
    manualInputs: [
      { name: 'Student ID', envVar: 'IO107_STUDENT_ID', description: 'Same ID used in lab_env_student apply', required: true, howToGet: 'Same as Lab 1' },
    ],
    prerequisites: ['lab_env_student/ applied', 'Lab 1 ideally run first (proves pipeline plumbing)', 'aws CLI v2 + git + python3 on PATH; codecommit credential helper configured'],
  },
  {
    course: 'io107',
    labNumber: 3,
    labName: 'OPA Policy-as-Code Evaluation & Failure Remediation',
    testFile: 'courses/io107/tests/lab3-opa-violations.spec.ts',
    description: 'Clone per-student CodeCommit repo (roi-cloud-fun/io-107/lab_3/), push intentionally non-compliant TF + K8s, observe pipeline Validate stage FAIL with 17 Conftest FAILs, then push remediation and confirm pass',
    estimatedDuration: '10-15 minutes',
    manualInputs: [
      { name: 'Student ID', envVar: 'IO107_STUDENT_ID', description: 'Same ID used in lab_env_student apply', required: true, howToGet: 'Same as Lab 1' },
    ],
    prerequisites: ['lab_env_student/ applied', 'aws CLI v2 + git on PATH; codecommit credential helper configured'],
  },
  {
    course: 'io107',
    labNumber: 4,
    labName: 'Aurora Blue/Green Deployment via Terraform + Pipeline',
    testFile: 'courses/io107/tests/lab4-aurora-bluegreen.spec.ts',
    description: 'Clone per-student CodeCommit repo (roi-cloud-fun/io-107/lab_4/), bump local.target_engine_version to trigger Blue/Green, push, OPA validates, programmatically approve, watch Blue/Green provisioning + switchover',
    estimatedDuration: '25-30 minutes (Blue/Green provisioning + replication catch-up takes most of this)',
    manualInputs: [
      { name: 'Student ID', envVar: 'IO107_STUDENT_ID', description: 'Same ID used in lab_env_student apply', required: true, howToGet: 'Same as Lab 1' },
    ],
    prerequisites: ['lab_env_student/ applied (per-student Aurora cluster provisioned)', 'aws CLI v2 + git on PATH; codecommit credential helper configured', 'Test role can: rds:CreateBlueGreenDeployment, rds:SwitchoverBlueGreenDeployment, codepipeline:PutApprovalResult, cloudtrail:LookupEvents, codecommit:*'],
  },
  // ==================== CF-109 CLOUDOPS FUNDAMENTALS ====================
  {
    course: 'cf109',
    labNumber: 1,
    labName: 'Console Navigation and Resource Discovery',
    testFile: 'courses/cf109/tests/lab1-console-navigation.spec.ts',
    description: 'AWS Console navigation, EC2/S3/VPC resource discovery, service health check; Azure Portal tasks are manual-only',
    estimatedDuration: '45 minutes (AWS automated checks ~5 min; Azure tasks manual)',
    manualInputs: [
      {
        name: 'AWS Account ID',
        envVar: 'CF109_AWS_ACCOUNT_ID',
        description: '12-digit AWS sandbox account number',
        required: true,
        howToGet: 'AWS Console → top-right dropdown → Account ID (or: aws sts get-caller-identity)',
      },
      {
        name: 'AWS Region',
        envVar: 'CF109_REGION',
        description: 'Region where lab resources are deployed (default: us-east-1)',
        required: false,
        howToGet: 'Default us-east-1 — override if your sandbox is in a different region',
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
      'Pre-deployed AWS sandbox with EC2 instances, S3 buckets, VPC tagged course=CF-109',
      'AWS CLI v2 with roitraining profile authenticated',
      'Test runner has: ec2:Describe*, s3api:ListBuckets + GetBucketTagging, cloudtrail:LookupEvents',
      'Azure Portal tasks (Task 2) are manual — complete in browser with instructor-provided SSO credentials',
    ],
  },
  {
    course: 'cf109',
    labNumber: 2,
    labName: 'CloudWatch Monitoring and Alerting Setup',
    testFile: 'courses/cf109/tests/lab2-cloudwatch-monitoring.spec.ts',
    description: 'CloudWatch Agent install (manual via SSM), Logs Insights, CloudWatch Alarms + SNS, Dashboard creation',
    estimatedDuration: '60 minutes (agent install + console steps are manual; outcome verification ~5 min)',
    manualInputs: [
      {
        name: 'AWS Account ID',
        envVar: 'CF109_AWS_ACCOUNT_ID',
        description: '12-digit AWS sandbox account number',
        required: true,
        howToGet: 'AWS Console → top-right → Account ID',
      },
      {
        name: 'Lab 2 EC2 Instance ID',
        envVar: 'CF109_LAB2_INSTANCE_ID',
        description: 'EC2 instance ID for the CloudWatch Agent lab target (optional — auto-discovered)',
        required: false,
        howToGet: 'EC2 Console → find instance tagged course=CF-109,lab=2 → copy instance ID',
      },
      {
        name: 'SNS Alert Email',
        envVar: 'CF109_LAB2_SNS_EMAIL',
        description: 'Email address for SNS alarm notification (default: lab-alerts@example.com)',
        required: false,
        howToGet: 'Use any email address — subscription confirmation is manual',
      },
    ],
    prerequisites: [
      'Pre-deployed EC2 instance tagged course=CF-109,lab=2 with SSM agent running',
      'EC2 IAM role includes CloudWatchAgentServerPolicy and AmazonSSMManagedInstanceCore',
      'AWS CLI v2 with roitraining profile authenticated',
      'Test runner has: ec2:Describe*, cloudwatch:*, logs:*, sns:ListTopics',
      'CloudWatch Agent installation and alarm creation are manual Console steps — LTF verifies outcomes',
    ],
  },
  // ==================== CF-110 TROUBLESHOOTING DEEP DIVE ====================
  {
    course: 'cf110',
    labNumber: 1,
    labName: 'AWS Compute and Storage Troubleshooting',
    testFile: 'courses/cf110/tests/lab1-compute-storage-troubleshooting.spec.ts',
    description: 'Diagnose pre-broken EC2 (status checks), Lambda timeouts, S3 cross-account AccessDenied, EBS I/O degradation',
    estimatedDuration: '60 minutes (diagnosis and remediation are manual; environment verification ~5 min)',
    manualInputs: [
      {
        name: 'AWS Account ID',
        envVar: 'CF110_AWS_ACCOUNT_ID',
        description: '12-digit AWS sandbox account number',
        required: true,
        howToGet: 'AWS Console → top-right → Account ID',
      },
      {
        name: 'Broken EC2 Instance ID',
        envVar: 'CF110_LAB1_EC2_INSTANCE_ID',
        description: 'EC2 instance with status check failures (optional — auto-discovered via tag course=CF-110,lab=1)',
        required: false,
        howToGet: 'EC2 Console → find instance tagged course=CF-110,lab=1 → copy instance ID',
      },
      {
        name: 'Lambda Function Name',
        envVar: 'CF110_LAB1_LAMBDA_NAME',
        description: 'Lambda function with timeout issues (optional — auto-discovered)',
        required: false,
        howToGet: 'Lambda Console → find function with cf110-lab1 in name → copy function name',
      },
      {
        name: 'S3 Bucket Name',
        envVar: 'CF110_LAB1_S3_BUCKET',
        description: 'S3 bucket with cross-account access issue (optional — auto-discovered)',
        required: false,
        howToGet: 'S3 Console → find bucket with cf110-lab1 in name → copy bucket name',
      },
    ],
    prerequisites: [
      'Pre-deployed AWS environment with intentional issues: EC2 status check failure, Lambda timeout, S3 cross-account, EBS I/O',
      'CloudWatch dashboards and logs pre-configured for the broken environment',
      'AWS CLI v2 with roitraining profile authenticated',
      'Test runner has: ec2:Describe*, cloudwatch:GetMetricStatistics, lambda:*, s3api:*, logs:*, cloudtrail:LookupEvents',
    ],
  },
  {
    course: 'cf110',
    labNumber: 2,
    labName: 'AWS IAM and Network Troubleshooting',
    testFile: 'courses/cf110/tests/lab2-iam-network-troubleshooting.spec.ts',
    description: 'Diagnose IAM AccessDenied via CloudTrail + Policy Simulator, cross-account role trust policy, missing NAT route, ALB health check failure via VPC Flow Logs',
    estimatedDuration: '60 minutes (diagnosis and remediation are manual; environment verification ~5 min)',
    manualInputs: [
      {
        name: 'AWS Account ID',
        envVar: 'CF110_AWS_ACCOUNT_ID',
        description: '12-digit AWS sandbox account number',
        required: true,
        howToGet: 'AWS Console → top-right → Account ID',
      },
      {
        name: 'IAM Role Name',
        envVar: 'CF110_LAB2_IAM_ROLE_NAME',
        description: 'IAM role with broken S3 policy (optional — auto-discovered)',
        required: false,
        howToGet: 'IAM Console → find role with cf110 in name → copy role name',
      },
      {
        name: 'Private Subnet Instance ID',
        envVar: 'CF110_LAB2_PRIVATE_INSTANCE_ID',
        description: 'EC2 in private subnet with no internet (optional — auto-discovered via tag broken=network)',
        required: false,
        howToGet: 'EC2 Console → find instance tagged course=CF-110,lab=2,broken=network → copy instance ID',
      },
      {
        name: 'ALB Name',
        envVar: 'CF110_LAB2_ALB_NAME',
        description: 'ALB with failing health checks (optional — auto-discovered)',
        required: false,
        howToGet: 'EC2 Console → Load Balancers → find ALB with cf110-lab2 in name → copy name',
      },
    ],
    prerequisites: [
      'Pre-deployed VPC with public/private subnets, broken NAT routing, ALB, EC2, IAM roles',
      'VPC Flow Logs enabled on the lab VPC',
      'CloudTrail enabled on the sandbox account',
      'AWS CLI v2 with roitraining profile authenticated',
      'Test runner has: ec2:Describe*, iam:GetRole + ListRoles, elbv2:Describe* + DescribeTargetHealth, logs:*, cloudtrail:DescribeTrails',
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
