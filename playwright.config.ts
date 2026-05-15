import { defineConfig, devices } from '@playwright/test';
import * as dotenv from 'dotenv';

dotenv.config();

export default defineConfig({
  // Tests are in courses/
  testDir: './courses',
  testMatch: '**/*.spec.ts',
  testIgnore: '**/_archive/**',

  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,

  reporter: [
    ['./core/reporting/lab-reporter.ts'],
    ['html', { open: 'never' }],
    ['list']
  ],

  use: {
    actionTimeout: 30000,
    navigationTimeout: 60000,
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'retain-on-failure',
    headless: process.env.HEADLESS !== 'false',
    viewport: { width: 1920, height: 1080 },
  },

  timeout: 5 * 60 * 1000, // 5 minutes per test

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  globalSetup: './core/fixtures/global-setup.ts',
});
