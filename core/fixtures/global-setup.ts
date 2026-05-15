import { chromium, FullConfig } from '@playwright/test';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

dotenv.config();

const AUTH_FILE = path.join(__dirname, '../../.auth/aws-session.json');
const AUTH_DIR = path.dirname(AUTH_FILE);

/**
 * Global setup: creates an authenticated AWS Console session.
 *
 * Shared across ALL lab tests — any login fixes here apply everywhere.
 *
 * Flow:
 *  1. Check for cached session (<6 hours old) — reuse if valid
 *  2. Otherwise launch headless browser, log in via IAM user form
 *  3. Save browser storage state (cookies/tokens) to .auth/aws-session.json
 *  4. Per-test fixtures load that state into fresh browser contexts
 *
 * Supports both:
 *  - Account-specific URLs: https://alias.signin.aws.amazon.com/console
 *    → Goes directly to username/password form
 *  - Generic URLs: https://console.aws.amazon.com
 *    → Shows account selector first, then username/password
 *
 * IMPORTANT: Passwords with special characters (!, #, etc.) MUST be
 * quoted in .env — otherwise dotenv treats # as a comment delimiter.
 * Example:  AWS_PASSWORD="!vGG#t7]"
 */
async function globalSetup(config: FullConfig) {
  // Ensure auth directory exists
  if (!fs.existsSync(AUTH_DIR)) {
    fs.mkdirSync(AUTH_DIR, { recursive: true });
  }

  // Check if we have a valid saved session
  if (fs.existsSync(AUTH_FILE)) {
    const stats = fs.statSync(AUTH_FILE);
    const ageMinutes = (Date.now() - stats.mtimeMs) / 1000 / 60;

    // AWS sessions last ~12 hours, refresh after 6 hours to be safe
    if (ageMinutes < 360) {
      console.log(`Using existing AWS session (age: ${Math.round(ageMinutes)} minutes)`);
      return;
    }
  }

  // Validate credentials are present before attempting login
  const username = process.env.AWS_USERNAME;
  const password = process.env.AWS_PASSWORD;
  if (!username || !password) {
    throw new Error(
      'AWS_USERNAME and AWS_PASSWORD must be set in .env.\n' +
      'IMPORTANT: If the password contains # or other special chars, wrap it in double quotes:\n' +
      '  AWS_PASSWORD="your#password!"'
    );
  }

  console.log('Creating new AWS session...');

  const browser = await chromium.launch({
    headless: config.projects[0]?.use?.headless !== false,
  });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    const consoleUrl = process.env.AWS_CONSOLE_URL || 'https://console.aws.amazon.com';
    await page.goto(consoleUrl);

    // Account-specific URLs (alias.signin.aws.amazon.com) skip the account selector
    const isAccountSpecificUrl = consoleUrl.includes('.signin.aws.amazon.com');

    if (!isAccountSpecificUrl) {
      // Generic console URL — need to select IAM user and enter account ID
      const iamUserButton = page.locator('text=IAM user');
      if (await iamUserButton.isVisible({ timeout: 5000 }).catch(() => false)) {
        await iamUserButton.click();
      }
      if (process.env.AWS_ACCOUNT_ID) {
        await page.fill('#account', process.env.AWS_ACCOUNT_ID);
        await page.click('button:has-text("Next")');
      }
    }

    // Wait for the IAM username/password form
    await page.waitForSelector('#username', { timeout: 15000 });

    // Fill credentials
    await page.fill('#username', username);
    await page.fill('#password', password);
    await page.click('#signin_button');

    // Wait for post-login navigation to settle
    // AWS redirects through an OAuth flow before landing on the console
    await page.waitForLoadState('networkidle', { timeout: 30000 });

    const postLoginUrl = page.url();
    console.log('Post-login URL:', postLoginUrl);

    // Check for auth errors (still on signin page with no OAuth redirect)
    if (postLoginUrl.includes('signin.aws.amazon.com') && !postLoginUrl.includes('oauth')) {
      const errorText = await page.locator('#error_message, .alertText, [class*="error"]')
        .first().textContent().catch(() => '');

      // Save screenshot for debugging
      await page.screenshot({ path: path.join(AUTH_DIR, 'debug-login-failed.png') });

      throw new Error(
        `AWS login failed: ${errorText || 'unknown error'}\n` +
        'Check AWS_USERNAME and AWS_PASSWORD in .env.\n' +
        'Remember to quote passwords with special characters: AWS_PASSWORD="pass#word!"'
      );
    }

    // Follow OAuth redirect chain to the actual console
    if (postLoginUrl.includes('oauth') || postLoginUrl.includes('signin.aws.amazon.com')) {
      console.log('Following OAuth redirect...');
      await page.waitForURL(
        url => !url.toString().includes('signin.aws.amazon.com'),
        { timeout: 30000 }
      );
    }

    console.log('Logged in:', page.url());

    // Save the authenticated state for per-test reuse
    await context.storageState({ path: AUTH_FILE });
    console.log('AWS session saved successfully');

  } catch (error) {
    // Save a debug screenshot on any failure
    await page.screenshot({ path: path.join(AUTH_DIR, 'debug-login-failed.png') }).catch(() => {});
    console.error('Failed to create AWS session:', error);
    throw error;
  } finally {
    await browser.close();
  }
}

export default globalSetup;
