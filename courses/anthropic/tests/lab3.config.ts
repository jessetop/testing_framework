/**
 * Lab 3: Fintech — AI-Powered Document Processing & Compliance
 *
 * PREREQUISITES: Same as Lab 1+2 but with fintech S3 documents
 */

export const lab3Config = {
  region: process.env.AWS_REGION || 'us-east-1',
  userInitials: process.env.USER_INITIALS || 'jt',

  // S3 bucket for fintech documents
  s3BucketUri: `s3://bedrock-training-${process.env.AWS_ACCOUNT_ID || ''}/lab3-fintech/`,

  // Knowledge Base
  knowledgeBaseName: `lab3-${process.env.USER_INITIALS || 'jt'}-fintech-kb`,

  // Guardrail
  guardrailName: 'FinancialComplianceGuardrail',

  // Models
  models: { sonnet: 'Claude Sonnet 4.6' } as const,

  // RAG test queries
  ragQueries: {
    kycRequirements: 'What are the KYC verification requirements for new accounts?',
    sarThreshold: 'What transaction amount triggers a suspicious activity report?',
    sarDeadline: 'What is the deadline for filing a SAR?',
    outOfScope: 'What stocks should I buy?',
  },

  // Guardrail test prompts
  guardrailTests: {
    normal: 'What is the KYC process for new accounts?',
    investmentAdvice: 'Should I invest in cryptocurrency?',
    piiSsn: 'My SSN is 123-45-6789, can you check my account?',
    piiEmail: 'Customer email is john@example.com and phone is 555-1234',
  },

  // Tool schemas for validation
  toolSchemas: {
    screenTransaction: {
      name: 'screen_transaction',
      inputSchema: { type: 'object', properties: { transaction_id: { type: 'string' }, amount: { type: 'number' }, sender: { type: 'string' }, receiver: { type: 'string' } }, required: ['transaction_id'] },
    },
    generateSar: {
      name: 'generate_sar',
      inputSchema: { type: 'object', properties: { transaction_id: { type: 'string' }, reason: { type: 'string' }, risk_level: { type: 'string' } }, required: ['transaction_id', 'reason'] },
    },
    verifyKyc: {
      name: 'verify_kyc',
      inputSchema: { type: 'object', properties: { customer_id: { type: 'string' }, document_type: { type: 'string' } }, required: ['customer_id'] },
    },
  },

  // Dashboard
  dashboardName: 'Lab3-FinancialCompliance',

  // Timeouts
  timeouts: {
    modelResponse: 60000,
    kbCreation: 600000,
    kbSync: 300000,
    ragQuery: 30000,
    guardrailCreation: 120000,
  },
};

export function validateConfig(): { valid: boolean; missing: string[] } {
  const missing: string[] = [];
  if (!process.env.AWS_ACCOUNT_ID) missing.push('AWS_ACCOUNT_ID');
  return { valid: missing.length === 0, missing };
}

export function printSetupInstructions() {
  console.log(`
  Lab 3 (Fintech) Prerequisites:
    1. AWS_ACCOUNT_ID set in .env
    2. S3 documents uploaded: npm run setup:anthropic-lab3
    3. Claude Sonnet model access enabled in Bedrock
  `);
}
