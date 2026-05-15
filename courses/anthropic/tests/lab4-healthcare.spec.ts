/**
 * Lab 4: Healthcare — HIPAA-Compliant AI Assistant
 * Industry-specific lab (replaces standard Labs 1 & 2)
 */
import { createIndustryLabTests } from './industry-lab-shared';
import { lab4Config, validateConfig, printSetupInstructions } from './lab4.config';

createIndustryLabTests(
  'Healthcare — HIPAA-Compliant AI Assistant',
  4,
  lab4Config,
  validateConfig,
  printSetupInstructions,
);
