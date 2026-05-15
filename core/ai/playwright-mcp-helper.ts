/**
 * Playwright MCP Helper
 *
 * Uses the @playwright/mcp package to perform AI-driven browser
 * interactions when standard Playwright selectors fail.
 *
 * This connects to an EXISTING browser page (from our test) via CDP,
 * so it shares the same auth session and page state. The MCP server
 * analyzes screenshots and determines what to click/type.
 *
 * Usage in page objects:
 *   import { mcpPerformAction } from '../../../core/ai/playwright-mcp-helper';
 *   await mcpPerformAction(page, 'Select "OpenSearch Serverless" from the vector store dropdown');
 *
 * Fallback: If MCP fails, falls back to Nova vision with coordinate clicking.
 */

import { Page, Browser, CDPSession } from '@playwright/test';
import { askNovaAboutScreenshot } from './nova-vision';

/**
 * Use Nova vision to find an element's coordinates and click it.
 * This is the fallback when Playwright MCP and standard selectors both fail.
 *
 * Takes a screenshot, asks Nova for the x,y coordinates of the target,
 * then uses page.mouse.click() which sends a real OS-level mouse event
 * that bypasses all React/CloudScape overlay issues.
 */
export async function novaCoordinateClick(
  page: Page,
  description: string,
): Promise<boolean> {
  const screenshotBuffer = await page.screenshot();
  const base64 = screenshotBuffer.toString('base64');

  const question = `I need to click: "${description}"

Look at this screenshot (1920x1080 viewport). Find the element I described and tell me the EXACT pixel coordinates (x, y) of where to click it.

Respond ONLY with JSON:
{"found": true, "x": 500, "y": 300, "description": "what you found"}

If you can't find it:
{"found": false, "description": "what you see instead"}`;

  const answer = await askNovaAboutScreenshot(base64, question);
  console.log(`  [Nova coords] Looking for: ${description}`);
  console.log(`  [Nova coords] Response: ${answer.substring(0, 200)}`);

  try {
    const jsonMatch = answer.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return false;

    const info = JSON.parse(jsonMatch[0]);
    if (!info.found || !info.x || !info.y) return false;

    // Click at the exact coordinates Nova provided
    await page.mouse.click(info.x, info.y);
    console.log(`  [Nova coords] Clicked at (${info.x}, ${info.y}): ${info.description}`);
    await page.waitForTimeout(1500);
    return true;
  } catch (err) {
    console.log(`  [Nova coords] Error: ${err}`);
    return false;
  }
}

/**
 * Perform a multi-step UI interaction using Nova coordinate clicking.
 *
 * Each step: screenshot → ask Nova → click coordinates → repeat.
 * This mimics how a human would interact: look at the screen, find
 * the thing, click it, look again.
 */
export async function novaPerformSteps(
  page: Page,
  steps: string[],
): Promise<boolean> {
  for (const step of steps) {
    console.log(`  [Nova step] ${step}`);
    const success = await novaCoordinateClick(page, step);
    if (!success) {
      console.log(`  [Nova step] Failed: ${step}`);
      return false;
    }
    await page.waitForTimeout(1000);
  }
  return true;
}

/**
 * High-level: perform a complex wizard action with Nova coordinate clicking.
 *
 * Breaks the action into steps, takes a fresh screenshot before each step,
 * and asks Nova to verify completion after each click.
 */
export async function performWizardAction(
  page: Page,
  action: string,
  maxAttempts: number = 5,
): Promise<boolean> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const screenshotBuffer = await page.screenshot();
    const base64 = screenshotBuffer.toString('base64');

    const question = `I need to: "${action}"

Look at this screenshot. What is the SINGLE next click I should make?
If the action is already complete, say so.

Respond ONLY with JSON:
{"done": true} if the action is complete, OR
{"done": false, "x": 500, "y": 300, "click_description": "what to click and why"}`;

    const answer = await askNovaAboutScreenshot(base64, question);
    console.log(`  [Wizard ${attempt + 1}/${maxAttempts}] ${answer.substring(0, 200)}`);

    try {
      const jsonMatch = answer.match(/\{[\s\S]*\}/);
      if (!jsonMatch) continue;

      const info = JSON.parse(jsonMatch[0]);

      if (info.done) {
        console.log(`  [Wizard] Action complete: ${action}`);
        return true;
      }

      if (info.x && info.y) {
        await page.mouse.click(info.x, info.y);
        console.log(`  [Wizard] Clicked (${info.x}, ${info.y}): ${info.click_description || ''}`);
        await page.waitForTimeout(1500);
      }
    } catch (err) {
      console.log(`  [Wizard] Parse error: ${err}`);
    }
  }

  console.log(`  [Wizard] Did not complete in ${maxAttempts} attempts: ${action}`);
  return false;
}
