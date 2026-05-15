/**
 * Lab 5: Media & Entertainment — Content Intelligence Platform
 * Industry-specific lab (replaces standard Labs 1 & 2)
 */
import { createIndustryLabTests } from './industry-lab-shared';
import { lab5Config, validateConfig, printSetupInstructions } from './lab5.config';

createIndustryLabTests(
  'Media — Content Intelligence Platform',
  5,
  lab5Config,
  validateConfig,
  printSetupInstructions,
);
