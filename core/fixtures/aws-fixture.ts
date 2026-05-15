import { test as base, Page } from '@playwright/test';
import * as path from 'path';

const AUTH_FILE = path.join(__dirname, '../../.auth/aws-session.json');

/**
 * Extended test fixture with AWS authentication.
 * Provides an awsPage that's already logged into AWS Console.
 *
 * Also dismisses the AWS cookie consent banner on first navigation
 * (appears on every fresh context until accepted).
 */
export const test = base.extend<{ awsPage: Page }>({
  awsPage: async ({ browser }, use) => {
    // Create context with saved auth state
    const context = await browser.newContext({
      storageState: AUTH_FILE,
    });

    const page = await context.newPage();

    // Dismiss cookie consent banner on first page load
    // AWS shows this on every new context — block it once here
    page.on('load', async () => {
      try {
        const acceptButton = page.locator('button:has-text("Accept")').first();
        if (await acceptButton.isVisible({ timeout: 2000 }).catch(() => false)) {
          await acceptButton.click();
        }
      } catch {
        // Banner not present or already dismissed — fine
      }
    });

    await use(page);
    await context.close();
  },
});

export { expect } from '@playwright/test';
