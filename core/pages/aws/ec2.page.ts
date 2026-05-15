import { Page, Locator, expect } from '@playwright/test';

/**
 * EC2 Console Page Object
 * Handles all interactions with the AWS EC2 console
 */
export class EC2Page {
  readonly page: Page;
  readonly region: string;

  // Navigation
  readonly instancesLink: Locator;
  readonly launchInstanceButton: Locator;
  readonly securityGroupsLink: Locator;
  readonly keyPairsLink: Locator;

  // Instance List
  readonly instanceTable: Locator;
  readonly instanceCheckbox: (instanceId: string) => Locator;
  readonly instanceStateFilter: Locator;
  readonly refreshButton: Locator;

  // Instance Actions
  readonly actionsDropdown: Locator;
  readonly connectButton: Locator;
  readonly terminateButton: Locator;
  readonly stopButton: Locator;
  readonly startButton: Locator;

  constructor(page: Page, region: string = 'us-east-1') {
    this.page = page;
    this.region = region;

    // Navigation locators
    this.instancesLink = page.locator('[data-testid="instances-link"], a:has-text("Instances")').first();
    this.launchInstanceButton = page.locator('button:has-text("Launch instance"), [data-testid="launch-instance-button"]');
    this.securityGroupsLink = page.locator('a:has-text("Security Groups")');
    this.keyPairsLink = page.locator('a:has-text("Key Pairs")');

    // Instance list locators
    this.instanceTable = page.locator('[data-testid="instances-table"], table');
    this.instanceCheckbox = (instanceId: string) =>
      page.locator(`tr:has-text("${instanceId}") input[type="checkbox"]`);
    this.instanceStateFilter = page.locator('[data-testid="state-filter"]');
    this.refreshButton = page.locator('button[aria-label="Refresh"], button:has-text("Refresh")');

    // Action locators
    this.actionsDropdown = page.locator('button:has-text("Actions"), [data-testid="actions-dropdown"]');
    this.connectButton = page.locator('button:has-text("Connect")');
    this.terminateButton = page.locator('button:has-text("Terminate")');
    this.stopButton = page.locator('button:has-text("Stop")');
    this.startButton = page.locator('button:has-text("Start")');
  }

  /**
   * Navigate to EC2 console in the specified region
   */
  async goto() {
    await this.page.goto(`https://${this.region}.console.aws.amazon.com/ec2/home?region=${this.region}`);
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Navigate to Instances page
   */
  async gotoInstances() {
    await this.page.goto(`https://${this.region}.console.aws.amazon.com/ec2/home?region=${this.region}#Instances:`);
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Wait for an instance to reach a specific state
   */
  async waitForInstanceState(instanceId: string, state: 'running' | 'stopped' | 'terminated', timeoutMs: number = 180000) {
    const startTime = Date.now();

    while (Date.now() - startTime < timeoutMs) {
      await this.refreshButton.click();
      await this.page.waitForTimeout(2000);

      const stateCell = this.page.locator(`tr:has-text("${instanceId}") td:has-text("${state}")`);
      if (await stateCell.isVisible({ timeout: 1000 }).catch(() => false)) {
        return true;
      }

      await this.page.waitForTimeout(5000);
    }

    throw new Error(`Instance ${instanceId} did not reach state "${state}" within ${timeoutMs}ms`);
  }

  /**
   * Select an instance by ID
   */
  async selectInstance(instanceId: string) {
    await this.instanceCheckbox(instanceId).click();
  }

  /**
   * Terminate an instance
   */
  async terminateInstance(instanceId: string) {
    await this.selectInstance(instanceId);
    await this.actionsDropdown.click();
    await this.page.locator('text=Instance state').click();
    await this.terminateButton.click();

    // Confirm termination dialog
    await this.page.locator('input[placeholder*="terminate"]').fill('terminate');
    await this.page.locator('button:has-text("Terminate")').last().click();
  }

  /**
   * Get instance details by ID
   */
  async getInstanceDetails(instanceId: string) {
    await this.selectInstance(instanceId);

    return {
      instanceId,
      publicIp: await this.page.locator('text=Public IPv4 address').locator('..').locator('span').last().textContent(),
      privateIp: await this.page.locator('text=Private IPv4 address').locator('..').locator('span').last().textContent(),
      state: await this.page.locator(`tr:has-text("${instanceId}") td`).nth(3).textContent(),
    };
  }
}
