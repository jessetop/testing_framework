import { chromium, FullConfig } from '@playwright/test';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

dotenv.config();

const AUTH_FILE = path.join(__dirname, '../.auth/aws-session.json');

async function globalSetup(config: FullConfig) {
  // Ensure auth directory exists
  const authDir = path.dirname(AUTH_FILE);
  if (!fs.existsSync(authDir)) {
    fs.mkdirSync(authDir, { recursive: true });
  }

  // Check if we have a valid saved session
  if (fs.existsSync(AUTH_FILE)) {
    const stats = fs.statSync(AUTH_FILE);
    const ageMinutes = (Date.now() - stats.mtimeMs) / 1000 / 60;

    // AWS sessions last ~12 hours, but we'll refresh after 6 hours
    if (ageMinutes < 360) {
      console.log('Using existing AWS session (age: ' + Math.round(ageMinutes) + ' minutes)');
      return;
    }
  }

  console.log('Creating new AWS session...');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // Navigate to AWS console
    const consoleUrl = process.env.AWS_CONSOLE_URL || 'https://console.aws.amazon.com';
    await page.goto(consoleUrl);

    // Handle IAM user login
    if (process.env.AWS_ACCOUNT_ID && process.env.AWS_USERNAME) {
      // Click "IAM user" if on the sign-in selector
      const iamUserButton = page.locator('text=IAM user');
      if (await iamUserButton.isVisible({ timeout: 5000 }).catch(() => false)) {
        await iamUserButton.click();
      }

      // Enter account ID
      await page.fill('#account', process.env.AWS_ACCOUNT_ID);
      await page.click('button:has-text("Next")');

      // Enter credentials
      await page.fill('#username', process.env.AWS_USERNAME);
      await page.fill('#password', process.env.AWS_PASSWORD || '');
      await page.click('button:has-text("Sign in")');

      // Wait for console to load
      await page.waitForURL('**/console/home**', { timeout: 30000 });
    }

    // Save the authenticated state
    await context.storageState({ path: AUTH_FILE });
    console.log('AWS session saved successfully');

  } catch (error) {
    console.error('Failed to create AWS session:', error);
    throw error;
  } finally {
    await browser.close();
  }
}

export default globalSetup;
