/**
 * Nova Act TypeScript Bridge
 *
 * Calls Amazon Nova Act (Python) from within Playwright TypeScript tests
 * for complex browser interactions that Playwright selectors can't handle.
 *
 * Nova Act connects to the SAME browser via CDP endpoint, performs the
 * AI-driven interaction, and returns control to the TypeScript test.
 *
 * Usage:
 *   import { novaAct, novaActPreset } from '../../../core/ai/nova-act';
 *
 *   // Single action
 *   await novaAct(page, 'Select OpenSearch Serverless from the vector store dropdown');
 *
 *   // Predefined wizard preset
 *   await novaActPreset(page, 'create-kb-step3-and-4');
 */

import { Page, BrowserContext } from '@playwright/test';
import { execSync } from 'child_process';
import * as path from 'path';

const BRIDGE_SCRIPT = path.join(__dirname, 'nova-act-bridge.py');

/**
 * Get the CDP WebSocket endpoint URL for the current browser.
 * Nova Act needs this to connect to the same browser instance.
 *
 * Playwright's Chromium browser exposes wsEndpoint() when connected
 * via connectOverCDP or launched with debugging port.
 */
async function getCdpEndpoint(page: Page): Promise<string> {
  const browser = page.context().browser();
  if (!browser) throw new Error('No browser instance available');

  // Try direct wsEndpoint (available on connected browsers)
  const wsEndpoint = (browser as any).wsEndpoint?.();
  if (wsEndpoint) return wsEndpoint;

  // Playwright-launched browsers: get the debugging endpoint from browser info
  // The browser was launched by Playwright, so we can get it from the process
  const browserType = (browser as any)._browserType;
  if (browserType) {
    const ws = (browser as any)._wsEndpoint;
    if (ws) return ws;
  }

  // Last resort: get it from the browser's connection
  // Chromium browsers have a /json/version endpoint on the debugging port
  throw new Error(
    'Could not determine CDP endpoint. The Playwright browser may need ' +
    'to be launched with a specific debugging port. Try adding ' +
    '`args: ["--remote-debugging-port=9222"]` to browser launch options ' +
    'in playwright.config.ts, then use ws://localhost:9222'
  );
}

/**
 * Execute a single Nova Act action on the current page.
 */
export async function novaAct(
  page: Page,
  action: string,
  options: { timeout?: number } = {},
): Promise<void> {
  const cdpUrl = await getCdpEndpoint(page);
  const timeout = options.timeout || 120000;

  console.log(`  [Nova Act] Action: ${action}`);
  console.log(`  [Nova Act] CDP: ${cdpUrl}`);

  try {
    const result = execSync(
      `python "${BRIDGE_SCRIPT}" --cdp-url "${cdpUrl}" --action "${action.replace(/"/g, '\\"')}"`,
      {
        encoding: 'utf-8',
        timeout,
        cwd: path.join(__dirname, '../..'),
      }
    );
    console.log(`  [Nova Act] ${result.trim()}`);
  } catch (err: any) {
    const stderr = err.stderr?.toString() || '';
    const stdout = err.stdout?.toString() || '';
    console.error(`  [Nova Act] Failed: ${stderr || stdout || err.message}`);
    throw new Error(`Nova Act failed: ${action}\n${stderr}`);
  }
}

/**
 * Execute a predefined Nova Act preset (a sequence of actions for a known wizard).
 */
export async function novaActPreset(
  page: Page,
  preset: string,
  options: { timeout?: number } = {},
): Promise<void> {
  const cdpUrl = await getCdpEndpoint(page);
  const timeout = options.timeout || 180000;

  console.log(`  [Nova Act] Preset: ${preset}`);
  console.log(`  [Nova Act] CDP: ${cdpUrl}`);

  try {
    const result = execSync(
      `python "${BRIDGE_SCRIPT}" --cdp-url "${cdpUrl}" --preset "${preset}"`,
      {
        encoding: 'utf-8',
        timeout,
        cwd: path.join(__dirname, '../..'),
      }
    );
    console.log(`  [Nova Act] ${result.trim()}`);
  } catch (err: any) {
    const stderr = err.stderr?.toString() || '';
    const stdout = err.stdout?.toString() || '';
    console.error(`  [Nova Act] Failed: ${stderr || stdout || err.message}`);
    throw new Error(`Nova Act preset failed: ${preset}\n${stderr}`);
  }
}

/**
 * Execute a list of Nova Act actions sequentially.
 */
export async function novaActSequence(
  page: Page,
  actions: string[],
  options: { timeout?: number } = {},
): Promise<void> {
  const cdpUrl = await getCdpEndpoint(page);
  const timeout = options.timeout || 180000;

  // Write actions to a temp file
  const fs = require('fs');
  const tmpFile = path.join(__dirname, '../../.tmp-nova-actions.json');
  fs.writeFileSync(tmpFile, JSON.stringify(actions));

  console.log(`  [Nova Act] Sequence: ${actions.length} actions`);

  try {
    const result = execSync(
      `python "${BRIDGE_SCRIPT}" --cdp-url "${cdpUrl}" --actions-file "${tmpFile}"`,
      {
        encoding: 'utf-8',
        timeout,
        cwd: path.join(__dirname, '../..'),
      }
    );
    console.log(`  [Nova Act] ${result.trim()}`);
  } catch (err: any) {
    const stderr = err.stderr?.toString() || '';
    const stdout = err.stdout?.toString() || '';
    console.error(`  [Nova Act] Failed: ${stderr || stdout || err.message}`);
    throw new Error(`Nova Act sequence failed\n${stderr}`);
  } finally {
    fs.unlinkSync(tmpFile).catch?.(() => {});
  }
}
