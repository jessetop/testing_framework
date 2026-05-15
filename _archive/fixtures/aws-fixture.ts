import { test as base, Page } from '@playwright/test';
import * as path from 'path';

const AUTH_FILE = path.join(__dirname, '../.auth/aws-session.json');

// Extended test fixture with AWS authentication
export const test = base.extend<{ awsPage: Page }>({
  awsPage: async ({ browser }, use) => {
    // Create context with saved auth state
    const context = await browser.newContext({
      storageState: AUTH_FILE,
    });

    const page = await context.newPage();
    await use(page);
    await context.close();
  },
});

export { expect } from '@playwright/test';
