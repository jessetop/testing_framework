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

  // Instance Launch Wizard
  readonly instanceNameInput: Locator;
  readonly amiSearchInput: Locator;
  readonly instanceTypeSelect: Locator;
  readonly keyPairSelect: Locator;
  readonly securityGroupSelect: Locator;
  readonly launchButton: Locator;

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

    // Launch wizard locators - AWS updates these frequently, so multiple selectors
    this.instanceNameInput = page.locator('[data-testid="instance-name-input"], input[placeholder*="Name"]').first();
    this.amiSearchInput = page.locator('[data-testid="ami-search"], input[placeholder*="Search"]').first();
    this.instanceTypeSelect = page.locator('[data-testid="instance-type-dropdown"]');
    this.keyPairSelect = page.locator('[data-testid="key-pair-dropdown"]');
    this.securityGroupSelect = page.locator('[data-testid="security-group-dropdown"]');
    this.launchButton = page.locator('button:has-text("Launch instance")').last();

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
   * Click Launch Instance button to start the wizard
   */
  async openLaunchWizard() {
    await this.launchInstanceButton.click();
    // Wait for wizard to load
    await this.page.waitForSelector('text=Launch an instance', { timeout: 10000 });
  }

  /**
   * Set instance name in the launch wizard
   */
  async setInstanceName(name: string) {
    // The name input is in a section labeled "Name and tags"
    const nameInput = this.page.locator('input[type="text"]').first();
    await nameInput.fill(name);
  }

  /**
   * Select an AMI by searching for it
   */
  async selectAMI(amiName: string) {
    // Quick Start AMIs are shown by default
    // Look for the AMI name in the list
    const amiOption = this.page.locator(`text=${amiName}`).first();
    if (await amiOption.isVisible({ timeout: 5000 }).catch(() => false)) {
      await amiOption.click();
    } else {
      // If not in quick start, search for it
      await this.page.locator('button:has-text("Browse more AMIs")').click();
      await this.page.locator('input[placeholder*="Search"]').fill(amiName);
      await this.page.locator(`text=${amiName}`).first().click();
      await this.page.locator('button:has-text("Select")').click();
    }
  }

  /**
   * Select instance type from dropdown
   */
  async selectInstanceType(instanceType: string) {
    // Instance type section
    const typeDropdown = this.page.locator('[data-testid="instance-type-dropdown"], button:has-text("t2.micro")').first();
    await typeDropdown.click();

    // Search for the instance type
    const searchInput = this.page.locator('input[placeholder*="Search"]');
    if (await searchInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await searchInput.fill(instanceType);
    }

    await this.page.locator(`text=${instanceType}`).first().click();
  }

  /**
   * Select or create a key pair
   */
  async selectKeyPair(keyPairName: string) {
    const keyPairDropdown = this.page.locator('button:has-text("Select"), [data-testid="key-pair-dropdown"]').first();
    await keyPairDropdown.click();
    await this.page.locator(`text=${keyPairName}`).click();
  }

  /**
   * Configure security group - select existing or create new
   */
  async selectSecurityGroup(sgName: string) {
    // Click "Select existing security group" radio
    await this.page.locator('text=Select existing security group').click();

    // Select the security group
    const sgDropdown = this.page.locator('[data-testid="security-group-dropdown"]');
    await sgDropdown.click();
    await this.page.locator(`text=${sgName}`).click();
  }

  /**
   * Launch the instance (final step of wizard)
   */
  async launchInstance(): Promise<string> {
    // Click the launch button
    await this.page.locator('button:has-text("Launch instance")').last().click();

    // Wait for success message and extract instance ID
    await this.page.waitForSelector('text=Successfully initiated', { timeout: 60000 });

    // Get the instance ID from the success message
    const instanceLink = this.page.locator('a[href*="Instances:instanceId="]').first();
    const href = await instanceLink.getAttribute('href');
    const instanceId = href?.match(/instanceId=(i-[a-z0-9]+)/)?.[1] || '';

    return instanceId;
  }

  /**
   * Wait for an instance to reach a specific state
   */
  async waitForInstanceState(instanceId: string, state: 'running' | 'stopped' | 'terminated', timeoutMs: number = 180000) {
    const startTime = Date.now();

    while (Date.now() - startTime < timeoutMs) {
      await this.refreshButton.click();
      await this.page.waitForTimeout(2000); // Wait for refresh

      const stateCell = this.page.locator(`tr:has-text("${instanceId}") td:has-text("${state}")`);
      if (await stateCell.isVisible({ timeout: 1000 }).catch(() => false)) {
        return true;
      }

      await this.page.waitForTimeout(5000); // Poll every 5 seconds
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

    // Read from details pane
    const detailsPane = this.page.locator('[data-testid="instance-details"]');

    return {
      instanceId,
      publicIp: await this.page.locator('text=Public IPv4 address').locator('..').locator('span').last().textContent(),
      privateIp: await this.page.locator('text=Private IPv4 address').locator('..').locator('span').last().textContent(),
      state: await this.page.locator(`tr:has-text("${instanceId}") td`).nth(3).textContent(),
    };
  }
}
