import { Page, Locator } from '@playwright/test';

/**
 * Splunk Web UI Page Object
 * Handles interactions with the Splunk Web interface
 */
export class SplunkWebPage {
  readonly page: Page;
  readonly baseUrl: string;

  // Login
  readonly usernameInput: Locator;
  readonly passwordInput: Locator;
  readonly signInButton: Locator;

  // Navigation
  readonly appsMenu: Locator;
  readonly settingsMenu: Locator;
  readonly searchNav: Locator;

  // Apps
  readonly findMoreAppsLink: Locator;
  readonly appSearchInput: Locator;
  readonly installButton: Locator;

  constructor(page: Page, host: string, port: number = 8000) {
    this.page = page;
    this.baseUrl = `http://${host}:${port}`;

    // Login locators
    this.usernameInput = page.locator('input[name="username"], #username');
    this.passwordInput = page.locator('input[name="password"], #password');
    this.signInButton = page.locator('button[type="submit"], input[value="Sign In"]');

    // Navigation locators
    this.appsMenu = page.locator('[data-test="apps-dropdown"], .app-bar a:has-text("Apps")');
    this.settingsMenu = page.locator('[data-test="settings-dropdown"], a:has-text("Settings")');
    this.searchNav = page.locator('a:has-text("Search & Reporting")');

    // Apps page locators
    this.findMoreAppsLink = page.locator('a:has-text("Find More Apps"), a:has-text("Browse more apps")');
    this.appSearchInput = page.locator('input[placeholder*="Search"], #app-search');
    this.installButton = page.locator('button:has-text("Install")');
  }

  /**
   * Navigate to Splunk Web login page
   */
  async goto() {
    await this.page.goto(this.baseUrl);
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Check if we're on the login page
   */
  async isOnLoginPage(): Promise<boolean> {
    return await this.usernameInput.isVisible({ timeout: 3000 }).catch(() => false);
  }

  /**
   * Check if we're logged in (on home/dashboard)
   */
  async isLoggedIn(): Promise<boolean> {
    // Look for common logged-in indicators
    const homeLink = this.page.locator('a:has-text("Home"), [data-test="home-link"]');
    const userMenu = this.page.locator('[data-test="user-menu"], .user-section');

    return (
      await homeLink.isVisible({ timeout: 3000 }).catch(() => false) ||
      await userMenu.isVisible({ timeout: 3000 }).catch(() => false)
    );
  }

  /**
   * Log in to Splunk
   */
  async login(username: string, password: string) {
    await this.goto();

    // Fill credentials
    await this.usernameInput.fill(username);
    await this.passwordInput.fill(password);
    await this.signInButton.click();

    // Wait for login to complete
    await this.page.waitForURL('**/en-US/app/**', { timeout: 30000 });
  }

  /**
   * Navigate to Apps management
   */
  async gotoApps() {
    await this.appsMenu.click();
    await this.page.locator('a:has-text("Manage Apps")').click();
    await this.page.waitForSelector('text=Apps', { timeout: 10000 });
  }

  /**
   * Navigate to Find More Apps (Splunkbase browser)
   */
  async gotoFindMoreApps() {
    await this.appsMenu.click();
    await this.findMoreAppsLink.click();
    await this.page.waitForSelector('text=Browse More Apps', { timeout: 10000 });
  }

  /**
   * Search for an app in Splunkbase
   */
  async searchApps(query: string) {
    await this.appSearchInput.fill(query);
    await this.page.keyboard.press('Enter');
    await this.page.waitForTimeout(2000); // Wait for search results
  }

  /**
   * Check if an app is visible in search results
   */
  async isAppVisible(appName: string): Promise<boolean> {
    const appCard = this.page.locator(`.app-card:has-text("${appName}"), tr:has-text("${appName}")`);
    return await appCard.isVisible({ timeout: 5000 }).catch(() => false);
  }

  /**
   * Get count of available apps
   */
  async getAppCount(): Promise<number> {
    // Look for "X apps" text or count the app cards
    const countText = await this.page.locator('text=/\\d+\\s+apps?/i').textContent();
    const match = countText?.match(/(\d+)/);
    return match ? parseInt(match[1]) : 0;
  }

  /**
   * Install an app (requires Splunkbase auth)
   */
  async installApp(appName: string, splunkbaseUsername: string, splunkbasePassword: string) {
    // Find the app
    await this.searchApps(appName);

    // Click install
    const appRow = this.page.locator(`tr:has-text("${appName}"), .app-card:has-text("${appName}")`);
    await appRow.locator('button:has-text("Install")').click();

    // Handle Splunkbase login if prompted
    const loginPrompt = this.page.locator('text=Log in to Splunkbase');
    if (await loginPrompt.isVisible({ timeout: 3000 }).catch(() => false)) {
      await this.page.locator('input[name="splunkbaseUsername"]').fill(splunkbaseUsername);
      await this.page.locator('input[name="splunkbasePassword"]').fill(splunkbasePassword);
      await this.page.locator('button:has-text("Login")').click();
    }

    // Wait for installation
    await this.page.waitForSelector('text=Restart Required', { timeout: 60000 });
  }

  /**
   * Navigate to Search & Reporting
   */
  async gotoSearch() {
    await this.searchNav.click();
    await this.page.waitForURL('**/search/**', { timeout: 10000 });
  }

  /**
   * Run a search query
   */
  async runSearch(query: string, timeRange: string = 'Last 15 minutes') {
    // Enter search query
    const searchBar = this.page.locator('.search-bar input, [data-test="search-input"]');
    await searchBar.fill(query);

    // Click search
    await this.page.locator('button:has-text("Search"), [data-test="search-button"]').click();

    // Wait for results
    await this.page.waitForSelector('.search-results, [data-test="search-results"]', { timeout: 30000 });
  }

  /**
   * Navigate to Settings
   */
  async gotoSettings() {
    await this.settingsMenu.click();
    await this.page.waitForSelector('text=System', { timeout: 5000 });
  }

  /**
   * Navigate to a specific settings page
   */
  async gotoSettingsPage(page: 'Server controls' | 'Server settings' | 'Data inputs' | 'Indexes') {
    await this.gotoSettings();
    await this.page.locator(`a:has-text("${page}")`).click();
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Restart Splunk from the web UI
   */
  async restartSplunk() {
    await this.gotoSettingsPage('Server controls');
    await this.page.locator('button:has-text("Restart Splunk")').click();

    // Confirm restart
    const confirmButton = this.page.locator('button:has-text("Restart")').last();
    await confirmButton.click();

    // Wait for restart (page will reload)
    await this.page.waitForTimeout(30000);
    await this.goto();
  }
}
