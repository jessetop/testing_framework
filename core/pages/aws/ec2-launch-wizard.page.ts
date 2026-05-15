import { Page, Locator } from '@playwright/test';

/**
 * EC2 Launch Wizard Page Object
 * Handles the full instance launch wizard with all configuration options
 */
// Tag applied to all resources created by the test framework
export const LAB_TEST_TAG = {
  key: 'ManagedBy',
  value: 'playwright-lab-tester',
};

export class EC2LaunchWizardPage {
  readonly page: Page;
  readonly region: string;

  constructor(page: Page, region: string = 'us-east-1') {
    this.page = page;
    this.region = region;
  }

  async open() {
    await this.page.goto(
      `https://${this.region}.console.aws.amazon.com/ec2/home?region=${this.region}#LaunchInstances:`
    );
    await this.page.waitForLoadState('networkidle');
    await this.page.waitForSelector('text=Launch an instance', { timeout: 15000 });
  }

  async setName(name: string) {
    const nameInput = this.page.locator('[data-testid="ec2-name-input"], input[placeholder*="Example"]').first();
    await nameInput.waitFor({ state: 'visible', timeout: 10000 });
    await nameInput.fill(name);
  }

  /**
   * Add a tag to the instance (in Name and tags section)
   */
  async addTag(key: string, value: string) {
    // Click "Add additional tags" to expand the tags section
    const addTagsLink = this.page.locator('text=Add additional tags, a:has-text("Add additional tags")');
    if (await addTagsLink.isVisible({ timeout: 2000 }).catch(() => false)) {
      await addTagsLink.click();
    }

    // Click "Add new tag" button
    await this.page.locator('button:has-text("Add new tag"), button:has-text("Add tag")').click();

    // Fill in the new tag (it's added as the last row)
    const tagRows = this.page.locator('[data-testid="tag-row"], .tag-row, tr:has(input[placeholder*="Key"])');
    const lastRow = tagRows.last();

    await lastRow.locator('input[placeholder*="Key"], input:first-of-type').fill(key);
    await lastRow.locator('input[placeholder*="Value"], input:last-of-type').fill(value);
  }

  /**
   * Add the standard lab test tag for resource tracking
   */
  async addLabTestTag() {
    await this.addTag(LAB_TEST_TAG.key, LAB_TEST_TAG.value);
  }

  async selectQuickStartAMI(amiName: 'Amazon Linux 2023' | 'Amazon Linux 2' | 'Ubuntu' | 'Windows' | 'macOS' | 'Red Hat' | 'SUSE') {
    const amiCard = this.page.locator(`button:has-text("${amiName}"), [data-testid="ami-card"]:has-text("${amiName}")`).first();

    if (await amiCard.isVisible({ timeout: 5000 }).catch(() => false)) {
      await amiCard.click();
    } else {
      await this.page.locator(`text=${amiName}`).first().click();
    }
  }

  async selectInstanceType(instanceType: string) {
    const typeSelector = this.page.locator('[data-testid="instance-type-dropdown"], .instance-type-selector').first();

    if (await typeSelector.isVisible({ timeout: 3000 }).catch(() => false)) {
      await typeSelector.click();
    }

    const searchInput = this.page.locator('input[placeholder*="Search"], input[placeholder*="instance type"]');
    if (await searchInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await searchInput.fill(instanceType);
      await this.page.waitForTimeout(500);
    }

    await this.page.locator(`text=${instanceType}`).first().click();
  }

  async selectKeyPair(keyPairName: string) {
    const dropdown = this.page.locator('[data-testid="key-pair-dropdown"], select, button:has-text("Select")').first();
    await dropdown.click();
    await this.page.locator(`text=${keyPairName}`).click();
  }

  async createKeyPair(name: string, type: 'RSA' | 'ED25519' = 'RSA', format: 'pem' | 'ppk' = 'pem') {
    await this.page.locator('text=Create new key pair').click();
    await this.page.locator('input[name="keyPairName"], #keyPairName').fill(name);
    await this.page.locator(`text=${type}`).click();
    await this.page.locator(`text=.${format}`).click();
    await this.page.locator('button:has-text("Create key pair")').click();
    await this.page.waitForTimeout(2000);
  }

  async proceedWithoutKeyPair() {
    const dropdown = this.page.locator('[data-testid="key-pair-dropdown"], select, button:has-text("Select")').first();
    await dropdown.click();
    await this.page.locator('text=Proceed without a key pair').click();
  }

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
    await this.page.locator('text=Network settings').locator('..').locator('button:has-text("Edit")').click();
    await this.page.locator('text=Create security group').click();

    const sgNameInput = this.page.locator('input[placeholder*="security group name"], #securityGroupName');
    await sgNameInput.fill(config.name);

    if (config.description) {
      const descInput = this.page.locator('input[placeholder*="description"], #securityGroupDescription');
      await descInput.fill(config.description);
    }

    for (let i = 0; i < config.rules.length; i++) {
      const rule = config.rules[i];

      if (i > 0) {
        await this.page.locator('button:has-text("Add security group rule")').click();
      }

      const ruleRow = this.page.locator('.security-group-rule, [data-testid="sg-rule"]').nth(i);

      if (rule.type === 'Custom TCP' && rule.port) {
        await ruleRow.locator('select, [data-testid="rule-type"]').selectOption('Custom TCP');
        await ruleRow.locator('input[placeholder*="Port"], #port').fill(rule.port.toString());
      } else {
        await ruleRow.locator('select, [data-testid="rule-type"]').selectOption(rule.type);
      }

      const sourceSelect = ruleRow.locator('select:has-text("Anywhere"), [data-testid="source-type"]');
      if (rule.source === 'My IP') {
        await sourceSelect.selectOption('My IP');
      } else if (rule.source === 'Custom' && rule.customCidr) {
        await sourceSelect.selectOption('Custom');
        await ruleRow.locator('input[placeholder*="CIDR"]').fill(rule.customCidr);
      }

      if (rule.description) {
        await ruleRow.locator('input[placeholder*="Description"]').fill(rule.description);
      }
    }
  }

  async configureStorage(config: {
    sizeGiB: number;
    volumeType?: 'gp3' | 'gp2' | 'io1' | 'io2' | 'st1' | 'sc1' | 'standard';
    deleteOnTermination?: boolean;
    encrypted?: boolean;
  }) {
    const sizeInput = this.page.locator('input[aria-label*="Size"], input[placeholder*="GiB"]').first();
    await sizeInput.fill(config.sizeGiB.toString());

    if (config.volumeType) {
      const typeDropdown = this.page.locator('select:has-text("gp3"), [data-testid="volume-type"]');
      await typeDropdown.selectOption(config.volumeType);
    }

    if (config.deleteOnTermination !== undefined) {
      const deleteCheckbox = this.page.locator('input[type="checkbox"]:near(:text("Delete on termination"))');
      if (config.deleteOnTermination) {
        await deleteCheckbox.check();
      } else {
        await deleteCheckbox.uncheck();
      }
    }

    if (config.encrypted !== undefined) {
      const encryptCheckbox = this.page.locator('input[type="checkbox"]:near(:text("Encrypted"))');
      if (config.encrypted) {
        await encryptCheckbox.check();
      } else {
        await encryptCheckbox.uncheck();
      }
    }
  }

  async launch(): Promise<string> {
    await this.page.locator('button:has-text("Launch instance")').last().click();
    await this.page.waitForSelector('text=Successfully initiated launch', { timeout: 60000 });

    const instanceLink = this.page.locator('a[href*="Instances:instanceId="], a:has-text("i-")').first();
    const href = await instanceLink.getAttribute('href');
    const text = await instanceLink.textContent();

    const instanceId = href?.match(/instanceId=(i-[a-z0-9]+)/)?.[1]
      || text?.match(/(i-[a-z0-9]+)/)?.[1]
      || '';

    return instanceId;
  }

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
    skipLabTestTag?: boolean;  // Set true to skip adding ManagedBy tag
  }): Promise<string> {
    await this.open();
    await this.setName(config.name);

    // Always add the lab test tag unless explicitly skipped
    if (!config.skipLabTestTag) {
      await this.addLabTestTag();
    }

    if (config.ami) {
      await this.selectQuickStartAMI(config.ami);
    }

    if (config.instanceType) {
      await this.selectInstanceType(config.instanceType);
    }

    if (config.keyPair) {
      await this.selectKeyPair(config.keyPair);
    }

    if (config.securityGroupName && config.securityGroupRules) {
      await this.createSecurityGroup({
        name: config.securityGroupName,
        rules: config.securityGroupRules,
      });
    }

    if (config.storageSizeGiB) {
      await this.configureStorage({
        sizeGiB: config.storageSizeGiB,
        volumeType: config.storageType || 'gp3',
      });
    }

    return await this.launch();
  }
}
