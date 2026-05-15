import { Page, Locator } from '@playwright/test';

/**
 * Splunk Web UI Page Object
 * Course-specific: Only used by Splunk labs
 */
export class SplunkWebPage {
  readonly page: Page;
  readonly baseUrl: string;

  readonly usernameInput: Locator;
  readonly passwordInput: Locator;
  readonly signInButton: Locator;
  readonly appsMenu: Locator;
  readonly settingsMenu: Locator;
  readonly searchNav: Locator;
  readonly findMoreAppsLink: Locator;
  readonly appSearchInput: Locator;

  constructor(page: Page, host: string, port: number = 8000) {
    this.page = page;
    this.baseUrl = `http://${host}:${port}`;

    this.usernameInput = page.locator('input[name="username"], #username');
    this.passwordInput = page.locator('input[name="password"], #password');
    this.signInButton = page.locator('button[type="submit"], input[value="Sign In"]');
    this.appsMenu = page.locator('[data-test="apps-dropdown"], .app-bar a:has-text("Apps")');
    this.settingsMenu = page.locator('[data-test="settings-dropdown"], a:has-text("Settings")');
    this.searchNav = page.locator('a:has-text("Search & Reporting")');
    this.findMoreAppsLink = page.locator('a:has-text("Find More Apps"), a:has-text("Browse more apps")');
    this.appSearchInput = page.locator('input[placeholder*="Search"], #app-search');
  }

  async goto() {
    await this.page.goto(this.baseUrl);
    await this.page.waitForLoadState('networkidle');
  }

  async isOnLoginPage(): Promise<boolean> {
    return await this.usernameInput.isVisible({ timeout: 3000 }).catch(() => false);
  }

  async isLoggedIn(): Promise<boolean> {
    const homeLink = this.page.locator('a:has-text("Home"), [data-test="home-link"]');
    const userMenu = this.page.locator('[data-test="user-menu"], .user-section');
    return (
      await homeLink.isVisible({ timeout: 3000 }).catch(() => false) ||
      await userMenu.isVisible({ timeout: 3000 }).catch(() => false)
    );
  }

  async login(username: string, password: string) {
    await this.goto();
    await this.usernameInput.fill(username);
    await this.passwordInput.fill(password);
    await this.signInButton.click();
    await this.page.waitForURL('**/en-US/app/**', { timeout: 30000 });
  }

  async gotoApps() {
    await this.appsMenu.click();
    await this.page.locator('a:has-text("Manage Apps")').click();
    await this.page.waitForSelector('text=Apps', { timeout: 10000 });
  }

  async gotoFindMoreApps() {
    await this.appsMenu.click();
    await this.findMoreAppsLink.click();
    await this.page.waitForSelector('text=Browse More Apps', { timeout: 10000 });
  }

  async searchApps(query: string) {
    await this.appSearchInput.fill(query);
    await this.page.keyboard.press('Enter');
    await this.page.waitForTimeout(2000);
  }

  async isAppVisible(appName: string): Promise<boolean> {
    const appCard = this.page.locator(`.app-card:has-text("${appName}"), tr:has-text("${appName}")`);
    return await appCard.isVisible({ timeout: 5000 }).catch(() => false);
  }

  async getAppCount(): Promise<number> {
    const countText = await this.page.locator('text=/\\d+\\s+apps?/i').textContent();
    const match = countText?.match(/(\d+)/);
    return match ? parseInt(match[1]) : 0;
  }

  async gotoSearch() {
    await this.searchNav.click();
    await this.page.waitForURL('**/search/**', { timeout: 10000 });
  }

  async runSearch(query: string) {
    const searchBar = this.page.locator('.search-bar input, [data-test="search-input"]');
    await searchBar.fill(query);
    await this.page.locator('button:has-text("Search"), [data-test="search-button"]').click();
    await this.page.waitForSelector('.search-results, [data-test="search-results"]', { timeout: 30000 });
  }

  async gotoSettings() {
    await this.settingsMenu.click();
    await this.page.waitForSelector('text=System', { timeout: 5000 });
  }
}
