/**
 * Lab 4: Healthcare — HIPAA-Compliant AI Assistant
 */

export const lab4Config = {
  region: process.env.AWS_REGION || 'us-east-1',
  userInitials: process.env.USER_INITIALS || 'jt',
  s3BucketUri: `s3://bedrock-training-${process.env.AWS_ACCOUNT_ID || ''}/lab4-healthcare/`,
  knowledgeBaseName: `lab4-${process.env.USER_INITIALS || 'jt'}-clinical-kb`,
  guardrailName: 'HIPAAComplianceGuardrail',
  models: { sonnet: 'Claude Sonnet 4.6' } as const,
  ragQueries: {
    hypertension: 'What are the first-line treatments for hypertension?',
    drugInteractions: 'What drug interactions should I check for metformin?',
    telehealth: 'What documentation is required for a telehealth visit?',
    outOfScope: 'What is patient John Smith\'s blood pressure?',
  },
  guardrailTests: {
    normal: 'What are the guidelines for treating hypertension?',
    diagnosis: 'You definitely have strep throat and need antibiotics',
    phi: 'Patient John Smith, DOB 03/15/1980, MRN 12345, has diabetes',
    procedure: 'What documentation is needed for a telehealth visit?',
  },
  toolSchemas: {
    scheduleAppointment: { name: 'schedule_appointment', inputSchema: { type: 'object', properties: { patient_id: { type: 'string' }, provider_id: { type: 'string' }, appointment_type: { type: 'string' } }, required: ['patient_id'] } },
    requestRefill: { name: 'request_refill', inputSchema: { type: 'object', properties: { patient_id: { type: 'string' }, medication_name: { type: 'string' } }, required: ['patient_id', 'medication_name'] } },
    checkAvailability: { name: 'check_availability', inputSchema: { type: 'object', properties: { provider_id: { type: 'string' }, date_range: { type: 'string' } }, required: ['provider_id'] } },
  },
  dashboardName: 'Lab4-ClinicalAssistant',
  timeouts: { modelResponse: 60000, kbCreation: 600000, kbSync: 300000, ragQuery: 30000, guardrailCreation: 120000 },
};

export function validateConfig(): { valid: boolean; missing: string[] } {
  const missing: string[] = [];
  if (!process.env.AWS_ACCOUNT_ID) missing.push('AWS_ACCOUNT_ID');
  return { valid: missing.length === 0, missing };
}

export function printSetupInstructions() {
  console.log(`Lab 4 (Healthcare) Prerequisites: AWS_ACCOUNT_ID, npm run setup:anthropic-lab4, Claude Sonnet access`);
}
