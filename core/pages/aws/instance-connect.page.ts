import { Page, Locator } from '@playwright/test';

/**
 * EC2 Instance Connect Page Object
 * Handles browser-based SSH connections to EC2 instances
 */
export class InstanceConnectPage {
  readonly page: Page;

  readonly connectButton: Locator;
  readonly usernameInput: Locator;
  readonly terminal: Locator;
  readonly terminalInput: Locator;

  constructor(page: Page) {
    this.page = page;
    this.connectButton = page.locator('button:has-text("Connect")').last();
    this.usernameInput = page.locator('input[name="username"], #username');
    this.terminal = page.locator('.xterm-screen, [data-testid="terminal"]');
    this.terminalInput = page.locator('.xterm-helper-textarea');
  }

  async openConnectDialog(instanceId: string, region?: string) {
    const r = region || process.env.AWS_REGION || 'us-east-1';
    await this.page.goto(
      `https://${r}.console.aws.amazon.com/ec2/home?region=${r}#ConnectToInstance:instanceId=${instanceId}`
    );
    await this.page.waitForLoadState('networkidle');
  }

  async connect(username: string = 'ec2-user') {
    const instanceConnectTab = this.page.locator('button:has-text("EC2 Instance Connect")');
    if (await instanceConnectTab.isVisible({ timeout: 3000 }).catch(() => false)) {
      await instanceConnectTab.click();
    }

    const usernameField = this.page.locator('#username, input[name="username"]');
    if (await usernameField.isVisible({ timeout: 2000 }).catch(() => false)) {
      await usernameField.fill(username);
    }

    await this.connectButton.click();
    await this.page.waitForSelector('.xterm-screen, [data-testid="terminal"]', { timeout: 30000 });
    await this.page.waitForTimeout(3000);
  }

  async typeCommand(command: string) {
    await this.terminalInput.focus();
    await this.page.keyboard.type(command);
  }

  async runCommand(command: string): Promise<string> {
    await this.typeCommand(command);
    await this.page.keyboard.press('Enter');
    await this.page.waitForTimeout(2000);
    return await this.getTerminalContent();
  }

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

  async getTerminalContent(): Promise<string> {
    const rows = await this.page.locator('.xterm-rows > div').all();
    const content: string[] = [];

    for (const row of rows) {
      const text = await row.textContent();
      if (text) content.push(text);
    }

    return content.join('\n');
  }

  async clear() {
    await this.runCommand('clear');
  }

  async isConnected(): Promise<boolean> {
    const content = await this.getTerminalContent();
    return content.includes('$') || content.includes('#') || content.includes('~]');
  }

  async disconnect() {
    await this.runCommand('exit');
    await this.page.waitForTimeout(1000);
  }
}
