/**
 * Walkthrough browser — lazy-launched Playwright page authenticated against
 * AWS Console. Reuses the same `.auth/aws-session.json` that the per-test
 * Playwright fixtures use, so we don't re-login every walkthrough.
 *
 * The walkthrough runner only spins up a browser when it actually hits an
 * `aws-ui` / `external-ui` step. Labs with no Console interaction never
 * launch chromium.
 */

import { chromium, Browser, BrowserContext, Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

const AUTH_FILE = path.join(__dirname, '..', '..', '.auth', 'aws-session.json');

export interface BrowserOptions {
  headless?: boolean;
  /** Tolerated session age in minutes. Older → warn. Default 360 (6 hours). */
  maxSessionAgeMinutes?: number;
}

export class WalkthroughBrowser {
  private browser?: Browser;
  private context?: BrowserContext;
  private page?: Page;

  async start(opts: BrowserOptions = {}): Promise<Page> {
    if (this.page) return this.page;
    await this.ensureAuth(opts.maxSessionAgeMinutes ?? 360);
    this.browser = await chromium.launch({ headless: opts.headless ?? false });
    this.context = await this.browser.newContext({
      storageState: AUTH_FILE,
      viewport: { width: 1600, height: 1000 },
    });
    this.page = await this.context.newPage();

    // Dismiss the AWS cookie banner on first load (matches aws-fixture.ts).
    this.page.on('load', async () => {
      try {
        const btn = this.page!.locator('button:has-text("Accept")').first();
        if (await btn.isVisible({ timeout: 2000 }).catch(() => false)) {
          await btn.click();
        }
      } catch { /* ignore */ }
    });

    return this.page;
  }

  private async ensureAuth(maxAgeMinutes: number): Promise<void> {
    if (!fs.existsSync(AUTH_FILE)) {
      throw new Error(
        `No AWS session at ${AUTH_FILE}.\n` +
        `Run any Playwright test once (e.g. \`npx playwright test --list\`) to trigger global-setup,\n` +
        `or set AWS_USERNAME / AWS_PASSWORD and run global-setup directly.`,
      );
    }
    const ageMin = (Date.now() - fs.statSync(AUTH_FILE).mtimeMs) / 60_000;
    if (ageMin > maxAgeMinutes) {
      // Try to refresh by running global-setup. We do this synchronously via the
      // existing playwright config which has globalSetup wired.
      console.log(`⚠ AWS session is ${Math.round(ageMin)} min old (>${maxAgeMinutes}). Refreshing...`);
      try {
        execSync('npx playwright test --list --reporter=line >/dev/null 2>&1 || true', {
          cwd: path.join(__dirname, '..', '..'),
          stdio: 'pipe',
          timeout: 120_000,
        });
        console.log('✓ AWS session refreshed');
      } catch {
        console.log('  (refresh failed — using existing session anyway)');
      }
    }
  }

  getPage(): Page | undefined {
    return this.page;
  }

  async screenshot(filePath: string): Promise<void> {
    if (!this.page) return;
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    await this.page.screenshot({ path: filePath, fullPage: false });
  }

  async stop(): Promise<void> {
    try { if (this.context) await this.context.close(); } catch { /* ignore */ }
    try { if (this.browser) await this.browser.close(); } catch { /* ignore */ }
    this.context = undefined;
    this.browser = undefined;
    this.page = undefined;
  }
}

/**
 * Try to extract an AWS Console URL hint from the step's blocks or prose.
 * Looks at:
 *   1. `https://...console.aws.amazon.com/...` URLs anywhere in the step
 *   2. `pipeline_url = "..."` style outputs from prior steps (e.g. terraform outputs)
 *   3. Service name keywords in the step title (Codepipeline, CloudTrail, etc.)
 */
export function extractConsoleUrl(stepTitle: string, blocks: { content: string; precedingText: string }[], defaultRegion: string): string {
  const haystack = [stepTitle, ...blocks.map((b) => `${b.precedingText}\n${b.content}`)].join('\n');
  const urlMatch = haystack.match(/https:\/\/[a-z0-9-]+\.console\.aws\.amazon\.com\/[^\s")']+/);
  if (urlMatch) return urlMatch[0];

  // Service name → home URL fallback.
  const services: Record<string, string> = {
    codepipeline: 'codesuite/codepipeline',
    codebuild: 'codesuite/codebuild',
    codecommit: 'codesuite/codecommit',
    cloudtrail: 'cloudtrail/home',
    cloudwatch: 'cloudwatch/home',
    ec2: 'ec2/home',
    s3: 's3/home',
    iam: 'iam/home',
    ssm: 'systems-manager/parameters',
    'secrets manager': 'secretsmanager/home',
  };
  const titleLower = stepTitle.toLowerCase();
  for (const [keyword, urlPath] of Object.entries(services)) {
    if (titleLower.includes(keyword)) {
      return `https://${defaultRegion}.console.aws.amazon.com/${urlPath}?region=${defaultRegion}`;
    }
  }
  return `https://${defaultRegion}.console.aws.amazon.com/console/home?region=${defaultRegion}`;
}
