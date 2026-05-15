/**
 * Lab 3: Fintech — AI-Powered Document Processing & Compliance
 * Industry-specific lab (replaces standard Labs 1 & 2)
 */
import { createIndustryLabTests } from './industry-lab-shared';
import { lab3Config, validateConfig, printSetupInstructions } from './lab3.config';

createIndustryLabTests(
  'Fintech — Document Processing & Compliance',
  3,
  lab3Config,
  validateConfig,
  printSetupInstructions,
);
