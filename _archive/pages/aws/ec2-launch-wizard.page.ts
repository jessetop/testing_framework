import { Page, Locator } from '@playwright/test';

/**
 * EC2 Launch Wizard Page Object
 * Handles the full instance launch wizard with all configuration options
 */
export class EC2LaunchWizardPage {
  readonly page: Page;
  readonly region: string;

  constructor(page: Page, region: string = 'us-east-1') {
    this.page = page;
    this.region = region;
  }

  /**
   * Open the launch wizard
   */
  async open() {
    await this.page.goto(
      `https://${this.region}.console.aws.amazon.com/ec2/home?region=${this.region}#LaunchInstances:`
    );
    await this.page.waitForLoadState('networkidle');
    // Wait for wizard to fully load
    await this.page.waitForSelector('text=Launch an instance', { timeout: 15000 });
  }

  /**
   * Set instance name (Name tag)
   */
  async setName(name: string) {
    // The name input is typically the first text input in "Name and tags" section
    const nameInput = this.page.locator('[data-testid="ec2-name-input"], input[placeholder*="Example"]').first();
    await nameInput.waitFor({ state: 'visible', timeout: 10000 });
    await nameInput.fill(name);
  }

  /**
   * Select AMI from Quick Start
   */
  async selectQuickStartAMI(amiName: 'Amazon Linux 2023' | 'Amazon Linux 2' | 'Ubuntu' | 'Windows' | 'macOS' | 'Red Hat' | 'SUSE') {
    // Quick Start AMIs are shown as cards/buttons
    const amiCard = this.page.locator(`button:has-text("${amiName}"), [data-testid="ami-card"]:has-text("${amiName}")`).first();

    if (await amiCard.isVisible({ timeout: 5000 }).catch(() => false)) {
      await amiCard.click();
    } else {
      // Try clicking in the AMI section
      await this.page.locator(`text=${amiName}`).first().click();
    }
  }

  /**
   * Select instance type
   */
  async selectInstanceType(instanceType: string) {
    // Click on the instance type dropdown/selector
    const typeSelector = this.page.locator('[data-testid="instance-type-dropdown"], .instance-type-selector').first();

    // If it's a dropdown, click to open
    if (await typeSelector.isVisible({ timeout: 3000 }).catch(() => false)) {
      await typeSelector.click();
    }

    // Search for the instance type
    const searchInput = this.page.locator('input[placeholder*="Search"], input[placeholder*="instance type"]');
    if (await searchInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await searchInput.fill(instanceType);
      await this.page.waitForTimeout(500);
    }

    // Click the instance type option
    await this.page.locator(`text=${instanceType}`).first().click();
  }

  /**
   * Select or create a key pair
   */
  async selectKeyPair(keyPairName: string) {
    // Find the key pair section
    const keyPairSection = this.page.locator('text=Key pair (login)').locator('..');

    // Click dropdown
    const dropdown = this.page.locator('[data-testid="key-pair-dropdown"], select, button:has-text("Select")').first();
    await dropdown.click();

    // Select the key pair
    await this.page.locator(`text=${keyPairName}`).click();
  }

  /**
   * Create a new key pair
   */
  async createKeyPair(name: string, type: 'RSA' | 'ED25519' = 'RSA', format: 'pem' | 'ppk' = 'pem') {
    await this.page.locator('text=Create new key pair').click();

    // Fill in key pair details
    await this.page.locator('input[name="keyPairName"], #keyPairName').fill(name);

    // Select type
    await this.page.locator(`text=${type}`).click();

    // Select format
    await this.page.locator(`text=.${format}`).click();

    // Create
    await this.page.locator('button:has-text("Create key pair")').click();

    // Wait for download
    await this.page.waitForTimeout(2000);
  }

  /**
   * Proceed without a key pair
   */
  async proceedWithoutKeyPair() {
    const dropdown = this.page.locator('[data-testid="key-pair-dropdown"], select, button:has-text("Select")').first();
    await dropdown.click();
    await this.page.locator('text=Proceed without a key pair').click();
  }

  /**
   * Configure network settings - create new security group
   */
  async createSecurityGroup(config: {
    name: string;
    description?: string;
    rules: Array<{
      type: 'SSH' | 'HTTP' | 'HTTPS' | 'Custom TCP' | 'Custom UDP' | 'All traffic';
      port?: number;
      source: 'Anywhere' | 'My IP' | 'Custom';
      customCidr?: string;
      description?: string;
    }>;
  }) {
    // Click Edit on Network settings
    await this.page.locator('text=Network settings').locator('..').locator('button:has-text("Edit")').click();

    // Select "Create security group"
    await this.page.locator('text=Create security group').click();

    // Set security group name
    const sgNameInput = this.page.locator('input[placeholder*="security group name"], #securityGroupName');
    await sgNameInput.fill(config.name);

    // Set description if provided
    if (config.description) {
      const descInput = this.page.locator('input[placeholder*="description"], #securityGroupDescription');
      await descInput.fill(config.description);
    }

    // The first rule (SSH) is usually pre-populated, modify it
    for (let i = 0; i < config.rules.length; i++) {
      const rule = config.rules[i];

      if (i > 0) {
        // Add new rule
        await this.page.locator('button:has-text("Add security group rule")').click();
      }

      // Get the rule row (nth rule)
      const ruleRow = this.page.locator('.security-group-rule, [data-testid="sg-rule"]').nth(i);

      // Set rule type
      if (rule.type === 'Custom TCP' && rule.port) {
        await ruleRow.locator('select, [data-testid="rule-type"]').selectOption('Custom TCP');
        await ruleRow.locator('input[placeholder*="Port"], #port').fill(rule.port.toString());
      } else {
        // Pre-defined rule types
        await ruleRow.locator('select, [data-testid="rule-type"]').selectOption(rule.type);
      }

      // Set source
      const sourceSelect = ruleRow.locator('select:has-text("Anywhere"), [data-testid="source-type"]');
      if (rule.source === 'My IP') {
        await sourceSelect.selectOption('My IP');
      } else if (rule.source === 'Custom' && rule.customCidr) {
        await sourceSelect.selectOption('Custom');
        await ruleRow.locator('input[placeholder*="CIDR"]').fill(rule.customCidr);
      }
      // 'Anywhere' is often the default

      // Set description if provided
      if (rule.description) {
        await ruleRow.locator('input[placeholder*="Description"]').fill(rule.description);
      }
    }
  }

  /**
   * Configure storage
   */
  async configureStorage(config: {
    sizeGiB: number;
    volumeType?: 'gp3' | 'gp2' | 'io1' | 'io2' | 'st1' | 'sc1' | 'standard';
    deleteOnTermination?: boolean;
    encrypted?: boolean;
  }) {
    // Expand storage section if collapsed
    const storageSection = this.page.locator('text=Configure storage').locator('..');

    // Set size
    const sizeInput = this.page.locator('input[aria-label*="Size"], input[placeholder*="GiB"]').first();
    await sizeInput.fill(config.sizeGiB.toString());

    // Set volume type
    if (config.volumeType) {
      const typeDropdown = this.page.locator('select:has-text("gp3"), [data-testid="volume-type"]');
      await typeDropdown.selectOption(config.volumeType);
    }

    // Set delete on termination
    if (config.deleteOnTermination !== undefined) {
      const deleteCheckbox = this.page.locator('input[type="checkbox"]:near(:text("Delete on termination"))');
      if (config.deleteOnTermination) {
        await deleteCheckbox.check();
      } else {
        await deleteCheckbox.uncheck();
      }
    }

    // Set encryption
    if (config.encrypted !== undefined) {
      const encryptCheckbox = this.page.locator('input[type="checkbox"]:near(:text("Encrypted"))');
      if (config.encrypted) {
        await encryptCheckbox.check();
      } else {
        await encryptCheckbox.uncheck();
      }
    }
  }

  /**
   * Launch the instance
   */
  async launch(): Promise<string> {
    // Click Launch instance button
    await this.page.locator('button:has-text("Launch instance")').last().click();

    // Wait for success
    await this.page.waitForSelector('text=Successfully initiated launch', { timeout: 60000 });

    // Extract instance ID
    const instanceLink = this.page.locator('a[href*="Instances:instanceId="], a:has-text("i-")').first();
    const href = await instanceLink.getAttribute('href');
    const text = await instanceLink.textContent();

    // Try to get instance ID from href or text
    const instanceId = href?.match(/instanceId=(i-[a-z0-9]+)/)?.[1]
      || text?.match(/(i-[a-z0-9]+)/)?.[1]
      || '';

    return instanceId;
  }

  /**
   * Full launch flow with common options
   */
  async launchInstance(config: {
    name: string;
    ami?: 'Amazon Linux 2023' | 'Amazon Linux 2' | 'Ubuntu' | 'Windows';
    instanceType?: string;
    keyPair?: string;
    securityGroupName?: string;
    securityGroupRules?: Array<{
      type: 'SSH' | 'HTTP' | 'HTTPS' | 'Custom TCP';
      port?: number;
      source: 'Anywhere' | 'My IP';
    }>;
    storageSizeGiB?: number;
    storageType?: 'gp3' | 'gp2';
  }): Promise<string> {
    await this.open();

    // Name
    await this.setName(config.name);

    // AMI
    if (config.ami) {
      await this.selectQuickStartAMI(config.ami);
    }

    // Instance type
    if (config.instanceType) {
      await this.selectInstanceType(config.instanceType);
    }

    // Key pair
    if (config.keyPair) {
      await this.selectKeyPair(config.keyPair);
    }

    // Security group
    if (config.securityGroupName && config.securityGroupRules) {
      await this.createSecurityGroup({
        name: config.securityGroupName,
        rules: config.securityGroupRules,
      });
    }

    // Storage
    if (config.storageSizeGiB) {
      await this.configureStorage({
        sizeGiB: config.storageSizeGiB,
        volumeType: config.storageType || 'gp3',
      });
    }

    // Launch
    return await this.launch();
  }
}
