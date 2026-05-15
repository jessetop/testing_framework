/**
 * CloudWatch Dashboard Page Object
 *
 * Handles interactions with Amazon CloudWatch Dashboards console:
 * - Navigate to CloudWatch Dashboards
 * - Verify dashboard exists by name
 * - Check widget count and presence
 * - Verify metrics are populated (non-zero values)
 * - Delete dashboard (for cleanup)
 */

import { Page, expect } from '@playwright/test';

export interface DashboardWidget {
  title: string;
  type: string;
  hasData: boolean;
}

export interface DashboardInfo {
  name: string;
  widgetCount: number;
  widgets: DashboardWidget[];
}

export class CloudWatchDashboardPage {
  constructor(
    private page: Page,
    private region: string = 'us-east-1'
  ) {}

  /**
   * Navigate to the CloudWatch Dashboards listing page
   */
  async open(): Promise<void> {
    await this.page.goto(
      `https://${this.region}.console.aws.amazon.com/cloudwatch/home?region=${this.region}#dashboards:`
    );
    await this.page.waitForLoadState('domcontentloaded');
    await this.page.waitForTimeout(2000);
  }

  /**
   * Navigate directly to a specific dashboard by name
   */
  async openDashboard(name: string): Promise<void> {
    await this.page.goto(
      `https://${this.region}.console.aws.amazon.com/cloudwatch/home?region=${this.region}#dashboards/dashboard/${name}`
    );
    await this.page.waitForLoadState('domcontentloaded');
    await this.page.waitForTimeout(3000);
  }

  /**
   * Check if a dashboard with the given name exists in the listing
   */
  async dashboardExists(name: string): Promise<boolean> {
    await this.open();
    const dashboardRow = this.page.locator(`text="${name}"`).first();
    return dashboardRow.isVisible().catch(() => false);
  }

  /**
   * Wait for a dashboard to appear in the listing (e.g., after creation via CLI)
   */
  async waitForDashboardExists(name: string, timeoutMs: number = 120000): Promise<void> {
    console.log(`Waiting for dashboard "${name}" to appear...`);
    await expect(async () => {
      await this.open();
      const dashboardRow = this.page.locator(
        `a:has-text("${name}"), td:has-text("${name}")`
      ).first();
      expect(await dashboardRow.isVisible()).toBe(true);
    }).toPass({ timeout: timeoutMs, intervals: [10000] });

    console.log(`Dashboard "${name}" found`);
  }

  /**
   * Click on a dashboard name to open it from the listing
   */
  async clickDashboard(name: string): Promise<void> {
    const dashboardLink = this.page.locator(
      `a:has-text("${name}"), td:has-text("${name}") a`
    ).first();
    await dashboardLink.click();
    await this.page.waitForLoadState('domcontentloaded');
    await this.page.waitForTimeout(3000);
  }

  /**
   * Get the number of widgets on the currently open dashboard
   */
  async getWidgetCount(): Promise<number> {
    // CloudWatch dashboard widgets are typically rendered as distinct containers
    const widgets = this.page.locator(
      '[class*="widget"], [class*="Widget"], [data-testid*="widget"], [class*="cwdb-dashboard-widget"]'
    );
    const count = await widgets.count();

    // Fallback: count by looking for widget titles/headers
    if (count === 0) {
      const widgetHeaders = this.page.locator(
        '[class*="widget-title"], [class*="WidgetTitle"], h3[class*="widget"]'
      );
      return widgetHeaders.count();
    }

    return count;
  }

  /**
   * Get all widget titles on the currently open dashboard
   */
  async getWidgetTitles(): Promise<string[]> {
    const titles: string[] = [];
    const widgetTitleElements = this.page.locator(
      '[class*="widget-title"], [class*="WidgetTitle"], [class*="cwdb-widget"] h3, [class*="widget"] [class*="title"]'
    );

    const count = await widgetTitleElements.count();
    for (let i = 0; i < count; i++) {
      const text = await widgetTitleElements.nth(i).textContent();
      if (text?.trim()) {
        titles.push(text.trim());
      }
    }

    return titles;
  }

  /**
   * Check if a specific widget exists on the dashboard by title
   */
  async widgetExists(widgetTitle: string): Promise<boolean> {
    const widget = this.page.locator(`text="${widgetTitle}"`).first();
    return widget.isVisible().catch(() => false);
  }

  /**
   * Check if metrics on the dashboard have non-zero/populated data
   * Looks for visual indicators that data points are present (graphs with lines, non-zero numbers)
   */
  async hasPopulatedMetrics(): Promise<boolean> {
    // Check for SVG paths (graph lines) that indicate data
    const graphLines = this.page.locator(
      'svg path[class*="line"], svg path[class*="metric"], svg polyline, canvas'
    );
    const lineCount = await graphLines.count();
    if (lineCount > 0) {
      return true;
    }

    // Check for numeric values in metric widgets that are not zero
    const metricValues = this.page.locator(
      '[class*="metric-value"], [class*="MetricValue"], [class*="singleValue"], [class*="number"]'
    );
    const valueCount = await metricValues.count();
    for (let i = 0; i < valueCount; i++) {
      const text = await metricValues.nth(i).textContent();
      const numMatch = text?.match(/([\d.]+)/);
      if (numMatch && parseFloat(numMatch[1]) > 0) {
        return true;
      }
    }

    return false;
  }

  /**
   * Wait for metrics to populate on the dashboard (may take time after first emission)
   */
  async waitForPopulatedMetrics(timeoutMs: number = 300000): Promise<void> {
    console.log('Waiting for dashboard metrics to populate...');
    await expect(async () => {
      // Refresh the dashboard
      const refreshButton = this.page.locator(
        'button[aria-label="Refresh"], button:has-text("Refresh")'
      ).first();
      if (await refreshButton.isVisible().catch(() => false)) {
        await refreshButton.click();
        await this.page.waitForTimeout(3000);
      } else {
        await this.page.reload();
        await this.page.waitForLoadState('domcontentloaded');
        await this.page.waitForTimeout(3000);
      }

      expect(await this.hasPopulatedMetrics()).toBe(true);
    }).toPass({ timeout: timeoutMs, intervals: [15000] });

    console.log('Dashboard metrics are populated');
  }

  /**
   * Set the dashboard time range (e.g., Last 1 hour, Last 3 hours)
   */
  async setTimeRange(range: '1h' | '3h' | '12h' | '1d' | '3d' | '1w'): Promise<void> {
    const rangeMap: Record<string, string> = {
      '1h': '1 hour',
      '3h': '3 hours',
      '12h': '12 hours',
      '1d': '1 day',
      '3d': '3 days',
      '1w': '1 week',
    };

    // Click the time range selector
    const timeRangeButton = this.page.locator(
      'button:has-text("custom"), button[class*="time-range"], [class*="TimeRange"] button'
    ).first();
    if (await timeRangeButton.isVisible().catch(() => false)) {
      await timeRangeButton.click();
      await this.page.waitForTimeout(500);
    }

    // Select the desired range
    const rangeOption = this.page.locator(`text=${rangeMap[range]}`).first();
    if (await rangeOption.isVisible().catch(() => false)) {
      await rangeOption.click();
      await this.page.waitForTimeout(2000);
    }
  }

  /**
   * Get dashboard information including widget details
   */
  async getDashboardInfo(name: string): Promise<DashboardInfo> {
    const widgetTitles = await this.getWidgetTitles();
    const widgets: DashboardWidget[] = [];

    for (const title of widgetTitles) {
      widgets.push({
        title,
        type: 'unknown', // CloudWatch doesn't easily expose widget type in DOM
        hasData: await this.hasPopulatedMetrics(),
      });
    }

    return {
      name,
      widgetCount: await this.getWidgetCount(),
      widgets,
    };
  }

  /**
   * Delete a dashboard by name (for cleanup)
   */
  async deleteDashboard(name: string): Promise<void> {
    await this.open();

    // Select the dashboard row
    const dashboardRow = this.page.locator(`tr:has-text("${name}")`).first();
    const checkbox = dashboardRow.locator('input[type="checkbox"], input[type="radio"]').first();
    if (await checkbox.isVisible().catch(() => false)) {
      await checkbox.click();
    } else {
      await dashboardRow.click();
    }

    // Click delete
    const deleteButton = this.page.locator(
      'button:has-text("Delete"), button:has-text("Actions")'
    ).first();
    await deleteButton.click();
    await this.page.waitForTimeout(1000);

    // If we clicked Actions, find Delete in the dropdown
    const deleteOption = this.page.locator(
      '[role="menuitem"]:has-text("Delete"), button:has-text("Delete")'
    ).first();
    if (await deleteOption.isVisible().catch(() => false)) {
      await deleteOption.click();
      await this.page.waitForTimeout(1000);
    }

    // Confirm deletion
    const confirmInput = this.page.locator(
      'input[placeholder*="delete"], input[placeholder*="confirm"]'
    ).first();
    if (await confirmInput.isVisible().catch(() => false)) {
      await confirmInput.fill('Delete');
    }

    const confirmButton = this.page.locator(
      'button:has-text("Delete"), button:has-text("Confirm")'
    ).last();
    await confirmButton.click();
    await this.page.waitForTimeout(3000);
  }
}
