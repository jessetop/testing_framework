import { Page, Locator, expect } from '@playwright/test';

/**
 * EC2 Instance Connect Page Object
 * Handles browser-based SSH connections to EC2 instances
 */
export class InstanceConnectPage {
  readonly page: Page;

  // Connection dialog
  readonly connectButton: Locator;
  readonly usernameInput: Locator;
  readonly connectionTypeSelect: Locator;
  readonly ec2InstanceConnectOption: Locator;

  // Terminal
  readonly terminal: Locator;
  readonly terminalInput: Locator;

  constructor(page: Page) {
    this.page = page;

    // Connection dialog locators
    this.connectButton = page.locator('button:has-text("Connect")').last();
    this.usernameInput = page.locator('input[name="username"], #username');
    this.connectionTypeSelect = page.locator('[data-testid="connection-type"]');
    this.ec2InstanceConnectOption = page.locator('text=EC2 Instance Connect');

    // Terminal locators - Instance Connect uses xterm.js
    this.terminal = page.locator('.xterm-screen, [data-testid="terminal"]');
    this.terminalInput = page.locator('.xterm-helper-textarea');
  }

  /**
   * Open the connect dialog for an instance
   */
  async openConnectDialog(instanceId: string) {
    // Navigate to the connect page
    const region = process.env.AWS_REGION || 'us-east-1';
    await this.page.goto(
      `https://${region}.console.aws.amazon.com/ec2/home?region=${region}#ConnectToInstance:instanceId=${instanceId}`
    );
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Connect using EC2 Instance Connect (browser-based SSH)
   */
  async connect(username: string = 'ec2-user') {
    // Select EC2 Instance Connect tab if not already selected
    const instanceConnectTab = this.page.locator('button:has-text("EC2 Instance Connect")');
    if (await instanceConnectTab.isVisible({ timeout: 3000 }).catch(() => false)) {
      await instanceConnectTab.click();
    }

    // Set username if the field is visible
    const usernameField = this.page.locator('#username, input[name="username"]');
    if (await usernameField.isVisible({ timeout: 2000 }).catch(() => false)) {
      await usernameField.fill(username);
    }

    // Click connect
    await this.connectButton.click();

    // Wait for terminal to load
    await this.page.waitForSelector('.xterm-screen, [data-testid="terminal"]', { timeout: 30000 });

    // Wait a moment for the SSH connection to establish
    await this.page.waitForTimeout(3000);
  }

  /**
   * Type a command in the terminal
   */
  async typeCommand(command: string) {
    // xterm.js uses a hidden textarea for input
    await this.terminalInput.focus();
    await this.page.keyboard.type(command);
  }

  /**
   * Run a command and wait for output
   */
  async runCommand(command: string): Promise<string> {
    await this.typeCommand(command);
    await this.page.keyboard.press('Enter');

    // Wait for command to execute (look for next prompt)
    await this.page.waitForTimeout(2000);

    // Get terminal content
    const terminalContent = await this.getTerminalContent();
    return terminalContent;
  }

  /**
   * Run a command and verify expected output appears
   */
  async runCommandAndExpect(command: string, expectedOutput: string, timeoutMs: number = 30000) {
    await this.runCommand(command);

    const startTime = Date.now();
    while (Date.now() - startTime < timeoutMs) {
      const content = await this.getTerminalContent();
      if (content.includes(expectedOutput)) {
        return true;
      }
      await this.page.waitForTimeout(1000);
    }

    throw new Error(`Expected output "${expectedOutput}" not found after running "${command}"`);
  }

  /**
   * Get current terminal content
   */
  async getTerminalContent(): Promise<string> {
    // xterm.js renders text in rows of spans
    const rows = await this.page.locator('.xterm-rows > div').all();
    const content: string[] = [];

    for (const row of rows) {
      const text = await row.textContent();
      if (text) content.push(text);
    }

    return content.join('\n');
  }

  /**
   * Clear the terminal
   */
  async clear() {
    await this.runCommand('clear');
  }

  /**
   * Check if connected (prompt is visible)
   */
  async isConnected(): Promise<boolean> {
    const content = await this.getTerminalContent();
    // Look for common prompt patterns
    return content.includes('$') || content.includes('#') || content.includes('~]');
  }

  /**
   * Disconnect from the instance
   */
  async disconnect() {
    await this.runCommand('exit');
    await this.page.waitForTimeout(1000);
  }
}
