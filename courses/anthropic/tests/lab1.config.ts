/**
 * Lab 1: Claude on Bedrock with RAG - Configuration
 *
 * PREREQUISITES
 * -------------
 * Before running this test:
 * 1. Model access must be enabled for Claude Opus 4.6, Sonnet 4.6, Haiku 4.5 in Bedrock
 * 2. S3 bucket must exist with sample documents uploaded
 * 3. AWS console credentials must be configured in .env
 */

export const lab1Config = {
  /**
   * AWS Account ID (used to construct S3 bucket path)
   * Read from .env or AWS_ACCOUNT_ID environment variable
   */
  accountId: process.env.AWS_ACCOUNT_ID || '',

  /**
   * User initials for naming the knowledge base (e.g., "jd" -> "lab1-jd-kb")
   */
  userInitials: process.env.USER_INITIALS || 'pt',

  region: process.env.AWS_REGION || 'us-east-1',

  // S3 bucket path for lab documents
  get s3BucketUri(): string {
    return `s3://bedrock-training-${this.accountId}/lab1-documents/`;
  },

  // Knowledge base naming
  get knowledgeBaseName(): string {
    return `lab1-${this.userInitials}-kb`;
  },

  // Models to test
  models: {
    opus: 'Claude Opus 4.6',
    sonnet: 'Claude Sonnet 4.6',
    haiku: 'Claude Haiku 4.5',
  } as const,

  // Test prompts (must be identical across models for fair comparison)
  prompts: {
    comparison: 'You are a helpful assistant. Explain the concept of cloud computing in 3-4 sentences for someone who has never heard of it before.',
    simple: 'What is AWS?',
    moderate: 'Explain the difference between IaaS, PaaS, and SaaS. Include one example of each.',
    complex: 'You are a cloud architect. Design a high-level architecture for a web application that needs to handle 1 million daily active users, requires high availability across multiple regions, and must comply with GDPR. List the key AWS services you would use and explain why.',
  },

  // RAG test queries
  ragQueries: {
    returnPolicy: 'What is the return policy for damaged products?',
    warranty: 'What warranty coverage is included with the premium product tier?',
    hallucination: "What is the CEO's favorite color?",
    vague: 'How do I return something?',
    specific: 'What is the step-by-step process for initiating a product return, including any required documentation and timelines?',
  },

  // Expected metrics ranges (for validation, not strict assertion)
  expectedMetrics: {
    sonnet: {
      latencyMs: { min: 500, max: 5000 },
      inputTokens: { min: 20, max: 50 },
      outputTokens: { min: 50, max: 200 },
    },
    opus: {
      latencyMs: { min: 2000, max: 15000 },
      inputTokens: { min: 20, max: 50 },
      outputTokens: { min: 50, max: 300 },
    },
    haiku: {
      latencyMs: { min: 100, max: 3000 },
      inputTokens: { min: 20, max: 50 },
      outputTokens: { min: 30, max: 150 },
    },
  },

  // Timeouts
  timeouts: {
    modelResponse: 60000,         // 60s for model to respond
    kbCreation: 600000,           // 10 min for KB to become Active
    kbSync: 300000,               // 5 min for sync to complete
    ragQuery: 30000,              // 30s for RAG query
  },

  // Pricing (for cost calculation verification)
  pricing: {
    sonnet: {
      inputPerMillion: 3,
      outputPerMillion: 15,
    },
  },
};

export function validateConfig(): { valid: boolean; missing: string[] } {
  const missing: string[] = [];

  if (!lab1Config.accountId) {
    missing.push('AWS_ACCOUNT_ID - Your 12-digit AWS account ID');
  }

  if (!lab1Config.userInitials || lab1Config.userInitials === 'pt') {
    // pt is the default placeholder - warn but don't block
    console.log('Note: USER_INITIALS not set, using default "pt" for knowledge base name');
  }

  return { valid: missing.length === 0, missing };
}

export function printSetupInstructions() {
  console.log(`
╔════════════════════════════════════════════════════════════════════╗
║              LAB 1: PREREQUISITES REQUIRED                         ║
╠════════════════════════════════════════════════════════════════════╣
║                                                                    ║
║  1. AWS_ACCOUNT_ID                                                 ║
║     → Your 12-digit AWS account number                             ║
║     → Console top-right → Account ID                               ║
║                                                                    ║
║  2. Model Access (manual step in Bedrock console)                  ║
║     → Bedrock → Model access → Request for Claude models           ║
║     → Opus 4.6, Sonnet 4.6, Haiku 4.5 must be enabled             ║
║                                                                    ║
║  3. S3 Bucket with Sample Documents                                ║
║     → s3://bedrock-training-{account-id}/lab1-documents/           ║
║     → Upload: product manuals, FAQs, return policies, etc.        ║
║                                                                    ║
║  4. USER_INITIALS (optional, default: "pt")                        ║
║     → Used for KB name: lab1-{initials}-kb                         ║
║                                                                    ║
║  Example:                                                          ║
║  export AWS_ACCOUNT_ID="123456789012"                              ║
║  export USER_INITIALS="jd"                                         ║
║  npm test -- --grep "Anthropic Lab 1"                              ║
║                                                                    ║
╚════════════════════════════════════════════════════════════════════╝
  `);
}
