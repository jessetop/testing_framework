/**
 * Nova Vision Helper
 *
 * Uses Amazon Nova (via Bedrock Runtime) to analyze screenshots and
 * determine what to click when Playwright selectors fail.
 *
 * Pattern:
 *   1. Playwright takes a screenshot
 *   2. Nova analyzes it: "Where is the vector store dropdown?"
 *   3. Returns a description or coordinates
 *   4. Playwright clicks based on Nova's response
 *
 * This is the fallback for complex/changing AWS console UI where
 * hardcoded selectors break. The test still navigates the same screens
 * a student would — Nova just helps find the right element.
 */

import { Page } from '@playwright/test';
import {
  BedrockRuntimeClient,
  InvokeModelCommand,
} from '@aws-sdk/client-bedrock-runtime';
import { fromIni } from '@aws-sdk/credential-providers';
import * as fs from 'fs';
import * as path from 'path';

const NOVA_MODEL_ID = 'amazon.nova-lite-v1:0';
const REGION = process.env.AWS_REGION || 'us-east-1';
const PROFILE = 'roitraining';

let client: BedrockRuntimeClient | null = null;

function getClient(): BedrockRuntimeClient {
  if (!client) {
    client = new BedrockRuntimeClient({
      region: REGION,
      credentials: fromIni({ profile: PROFILE }),
    });
  }
  return client;
}

/**
 * Ask Nova a question about a screenshot.
 * Returns Nova's text response.
 */
export async function askNovaAboutScreenshot(
  screenshotBase64: string,
  question: string,
): Promise<string> {
  const bedrock = getClient();

  const body = JSON.stringify({
    messages: [
      {
        role: 'user',
        content: [
          {
            image: {
              format: 'png',
              source: { bytes: screenshotBase64 },
            },
          },
          {
            text: question,
          },
        ],
      },
    ],
    inferenceConfig: {
      maxTokens: 1000,
      temperature: 0.1,
    },
  });

  const command = new InvokeModelCommand({
    modelId: NOVA_MODEL_ID,
    contentType: 'application/json',
    accept: 'application/json',
    body: Buffer.from(body),
  });

  const response = await bedrock.send(command);
  const responseBody = JSON.parse(new TextDecoder().decode(response.body));
  return responseBody.output?.message?.content?.[0]?.text || '';
}

/**
 * Take a screenshot of the current page and ask Nova a question about it.
 */
export async function askNovaAboutPage(
  page: Page,
  question: string,
): Promise<string> {
  const screenshotBuffer = await page.screenshot();
  const base64 = screenshotBuffer.toString('base64');
  const answer = await askNovaAboutScreenshot(base64, question);
  console.log(`  [Nova] Q: ${question.substring(0, 80)}...`);
  console.log(`  [Nova] A: ${answer.substring(0, 200)}`);
  return answer;
}

/**
 * Use Nova to find and click an element described in natural language.
 *
 * Takes a screenshot, asks Nova to describe where the element is,
 * then uses Playwright to click it. Falls back to coordinate-based
 * clicking if Nova provides x,y positions.
 */
export async function novaClick(
  page: Page,
  description: string,
  options: { timeout?: number } = {},
): Promise<boolean> {
  const screenshotBuffer = await page.screenshot();
  const base64 = screenshotBuffer.toString('base64');

  const question = `I need to click: "${description}"

Look at this screenshot of an AWS console page. Tell me EXACTLY how to identify this element for clicking. Respond in this JSON format:
{
  "found": true/false,
  "selector": "the best CSS selector or text content to find it",
  "fallback_text": "exact visible text of the element to click",
  "description": "brief description of where it is on the page"
}

If the element is a dropdown that needs to be opened first, set "needs_open": true.
Only respond with the JSON, no other text.`;

  const answer = await askNovaAboutScreenshot(base64, question);
  console.log(`  [Nova click] Looking for: ${description}`);
  console.log(`  [Nova click] Response: ${answer.substring(0, 300)}`);

  try {
    // Parse Nova's response
    const jsonMatch = answer.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.log('  [Nova click] Could not parse JSON from response');
      return false;
    }

    const info = JSON.parse(jsonMatch[0]);
    if (!info.found) {
      console.log('  [Nova click] Element not found in screenshot');
      return false;
    }

    const timeout = options.timeout || 10000;

    // Try the selector first
    if (info.selector) {
      try {
        const el = page.locator(info.selector).first();
        if (await el.isVisible({ timeout: 3000 }).catch(() => false)) {
          await el.click({ force: true, timeout });
          console.log(`  [Nova click] Clicked via selector: ${info.selector}`);
          return true;
        }
      } catch {
        // Selector didn't work, try fallback
      }
    }

    // Try the fallback text
    if (info.fallback_text) {
      try {
        const el = page.locator(`text="${info.fallback_text}"`).first();
        if (await el.isVisible({ timeout: 3000 }).catch(() => false)) {
          await el.click({ force: true, timeout });
          console.log(`  [Nova click] Clicked via text: ${info.fallback_text}`);
          return true;
        }
      } catch {
        // Text didn't work either
      }
    }

    console.log('  [Nova click] Could not click element with any method');
    return false;
  } catch (err) {
    console.log(`  [Nova click] Error: ${err}`);
    return false;
  }
}

/**
 * Use Nova to perform a complex multi-step UI interaction.
 *
 * Example: "Open the 'Select a vector store' dropdown and choose
 * 'Amazon OpenSearch Serverless'"
 *
 * Nova guides each step, taking fresh screenshots between actions.
 */
export async function novaPerformAction(
  page: Page,
  action: string,
  maxSteps: number = 5,
): Promise<boolean> {
  for (let step = 0; step < maxSteps; step++) {
    const screenshotBuffer = await page.screenshot();
    const base64 = screenshotBuffer.toString('base64');

    const question = `I need to: "${action}"

Look at this screenshot of an AWS console page. What is the NEXT single action I should take? I may have already completed some steps.

Respond in JSON:
{
  "done": true/false,
  "action": "click" | "type" | "select" | "wait",
  "target_text": "exact text of element to interact with",
  "value": "value to type or select (if applicable)",
  "description": "what this step does"
}

If the action is already complete (e.g., the dropdown already shows the correct value), set "done": true.
Only respond with JSON.`;

    const answer = await askNovaAboutScreenshot(base64, question);
    console.log(`  [Nova step ${step + 1}] ${answer.substring(0, 200)}`);

    try {
      const jsonMatch = answer.match(/\{[\s\S]*\}/);
      if (!jsonMatch) continue;

      const info = JSON.parse(jsonMatch[0]);

      if (info.done) {
        console.log(`  [Nova] Action complete: ${action}`);
        return true;
      }

      if (info.action === 'click' && info.target_text) {
        let clicked = false;

        // Try exact text match with force click
        const el = page.locator(`text="${info.target_text}"`).first();
        if (await el.isVisible({ timeout: 3000 }).catch(() => false)) {
          await el.click({ force: true });
          clicked = true;
        }

        // Try partial text match
        if (!clicked) {
          const partial = page.locator(`text=${info.target_text}`).first();
          if (await partial.isVisible({ timeout: 3000 }).catch(() => false)) {
            await partial.click({ force: true });
            clicked = true;
          }
        }

        // Try getByText for better matching
        if (!clicked) {
          const byText = page.getByText(info.target_text, { exact: false }).first();
          if (await byText.isVisible({ timeout: 3000 }).catch(() => false)) {
            await byText.click({ force: true });
            clicked = true;
          }
        }

        // Last resort: use JavaScript click to bypass all Playwright checks
        if (!clicked) {
          const jsClicked = await page.evaluate((targetText) => {
            const elements = document.querySelectorAll('*');
            for (const el of elements) {
              if (el.textContent?.trim() === targetText ||
                  el.textContent?.includes(targetText)) {
                (el as HTMLElement).click();
                return true;
              }
            }
            return false;
          }, info.target_text);
          if (jsClicked) clicked = true;
        }

        if (clicked) {
          await page.waitForTimeout(1500);
        } else {
          console.log(`  [Nova] Could not click: "${info.target_text}"`);
        }
      } else if (info.action === 'type' && info.value) {
        const input = page.locator('input:visible, textarea:visible').last();
        await input.fill(info.value);
        await page.waitForTimeout(500);
      } else if (info.action === 'wait') {
        await page.waitForTimeout(2000);
      }
    } catch (err) {
      console.log(`  [Nova step ${step + 1}] Error: ${err}`);
    }
  }

  console.log(`  [Nova] Action did not complete in ${maxSteps} steps: ${action}`);
  return false;
}
