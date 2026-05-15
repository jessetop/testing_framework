/**
 * Bedrock Text Playground Page Object
 *
 * Handles interactions with the Amazon Bedrock text playground:
 * - Model selection (Claude Opus, Sonnet, Haiku)
 * - Prompt submission and response capture
 * - Metrics extraction (latency, input/output tokens)
 * - Streaming toggle
 *
 * NOTE: The Bedrock playground UI (as of 2026) shows a landing page
 * with category icons (text, audio, image, video) and "Select a model
 * to get started" before the prompt area appears. After selecting a
 * model the chat/prompt interface loads.
 */

import { Page, expect } from '@playwright/test';

export interface PlaygroundMetrics {
  latencyMs?: number;
  inputTokens?: number;
  outputTokens?: number;
  responseText?: string;
}

export class BedrockPlaygroundPage {
  constructor(
    private page: Page,
    private region: string = 'us-east-1'
  ) {}

  /**
   * Dismiss the AWS cookie consent banner if present
   */
  private async dismissCookieBanner(): Promise<void> {
    const acceptButton = this.page.locator('button:has-text("Accept")').first();
    if (await acceptButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await acceptButton.click();
      await this.page.waitForTimeout(500);
    }
  }

  /**
   * Navigate to the Bedrock text playground
   */
  async open(): Promise<void> {
    await this.page.goto(
      `https://${this.region}.console.aws.amazon.com/bedrock/home?region=${this.region}#/text-playground`
    );
    // Don't use networkidle — AWS console has continuous background traffic
    await this.page.waitForLoadState('domcontentloaded');

    // Dismiss cookie banner first — it blocks all interaction
    await this.dismissCookieBanner();

    // Wait for the playground to load: either the landing page
    // ("Select a model" button) or an already-loaded prompt area
    await this.page.locator(
      'button:has-text("Select model"), textarea, [role="textbox"]'
    ).first().waitFor({ timeout: 30000 });
  }

  /**
   * Select a Claude model.
   *
   * The Bedrock playground flow:
   * 1. Landing page → click "Select model" button
   * 2. Model picker dialog → choose provider (Anthropic) and model
   * 3. Apply the selection → prompt area appears
   */
  async selectModel(modelName: 'Claude Opus 4.6' | 'Claude Sonnet 4.6' | 'Claude Haiku 4.5' | string): Promise<void> {
    // Click "Select model" (landing page) or model name button (already selected)
    const selectModelButton = this.page.locator(
      'button:has-text("Select model"), ' +
      'button:has-text("Choose model"), ' +
      'button:has-text("Change model")'
    ).first();

    if (await selectModelButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await selectModelButton.click();
      await this.page.waitForTimeout(2000);
    }

    // Model picker dialog — look for Anthropic as provider
    const anthropicProvider = this.page.locator(
      'text=Anthropic'
    ).first();

    if (await anthropicProvider.isVisible({ timeout: 5000 }).catch(() => false)) {
      await anthropicProvider.click();
      await this.page.waitForTimeout(1000);
    }

    // Select the specific model from the list
    const modelOption = this.page.locator(`text=${modelName}`).first();
    if (await modelOption.isVisible({ timeout: 5000 }).catch(() => false)) {
      await modelOption.click();
      await this.page.waitForTimeout(1000);
    }

    // Click Apply to confirm model selection.
    // The selected model option creates an overlay that intercepts pointer
    // events across the dialog, so we must use force:true.
    const applyButton = this.page.locator('button:has-text("Apply")').first();
    await applyButton.waitFor({ timeout: 5000 });
    await applyButton.click({ force: true });
    await this.page.waitForTimeout(2000);

    // Wait for the prompt input area to appear after model selection
    await this.waitForPromptArea();
  }

  /**
   * Wait for the prompt input area to become available
   */
  private async waitForPromptArea(timeoutMs: number = 15000): Promise<void> {
    // Wait for the Run button — its presence means the prompt area is ready
    await this.page.locator('button:has-text("Run")').waitFor({
      state: 'visible',
      timeout: timeoutMs,
    });
  }

  /**
   * Get the prompt input element.
   * The playground uses multiple textareas (system prompt, user prompt).
   * The user prompt area is near the Run button.
   */
  private getPromptInput() {
    // The user prompt textarea is the one near the Run button,
    // NOT the system_prompt one. Use the last visible textarea
    // or the contenteditable area near Run.
    return this.page.locator(
      'textarea:not([name="system_prompt"]):visible, ' +
      '[contenteditable="true"]:visible'
    ).last();
  }

  /**
   * Enter a prompt into the text input area
   */
  async enterPrompt(prompt: string): Promise<void> {
    const input = this.getPromptInput();
    await input.click();
    await input.fill(prompt);
  }

  /**
   * Get the playground Run button (not the nav "Send feedback" button)
   */
  private getRunButton() {
    // The Run button is inside the playground area, has exact text "Run"
    // Exclude nav buttons by being specific: look for the Run button near the prompt
    return this.page.locator('button').filter({ hasText: /^Run$/ }).last();
  }

  /**
   * Click the Run button to submit the prompt
   */
  async run(): Promise<void> {
    const runButton = this.getRunButton();
    await runButton.click();
  }

  /**
   * Wait for the response to complete (stop generating)
   */
  async waitForResponse(timeoutMs: number = 60000): Promise<void> {
    // Wait a moment for generation to start
    await this.page.waitForTimeout(3000);

    // The Bedrock playground keeps the Run button disabled after generation
    // completes (until prompt is modified). Instead, wait for the Latency
    // metric to show a value (changes from "---" to e.g., "4797 ms").
    // The metrics use underlined labels with separate value elements, so
    // look for "ms" text appearing near Latency.
    await expect(async () => {
      const pageText = await this.page.textContent('body') || '';
      // Latency shows "ms" only after generation completes
      const hasLatency = /Latency:\s*[\d,]+\s*ms/.test(pageText) ||
                         pageText.includes(' ms');
      expect(hasLatency).toBe(true);
    }).toPass({ timeout: timeoutMs, intervals: [3000] });

    // Extra settle time for UI
    await this.page.waitForTimeout(1000);
  }

  /**
   * Submit a prompt and wait for the response
   */
  async submitPrompt(prompt: string, timeoutMs: number = 60000): Promise<void> {
    await this.enterPrompt(prompt);
    await this.run();
    await this.waitForResponse(timeoutMs);
  }

  /**
   * Get the response text from the output area
   */
  async getResponseText(): Promise<string> {
    const responseArea = this.page.locator(
      '[class*="output"], [class*="response"], [class*="result"], ' +
      '[data-testid*="output"], [data-testid*="response"]'
    ).first();

    if (await responseArea.isVisible().catch(() => false)) {
      return (await responseArea.textContent()) || '';
    }

    // Fallback: last message/content block
    const allText = await this.page.locator(
      '[class*="message"], [class*="content"]'
    ).last().textContent();
    return allText || '';
  }

  /**
   * Extract metrics from the playground UI (tokens, latency)
   */
  async getMetrics(): Promise<PlaygroundMetrics> {
    const metrics: PlaygroundMetrics = {};

    const inputTokenEl = this.page.locator('text=/[Ii]nput\\s*tokens?/').locator('..').first();
    if (await inputTokenEl.isVisible().catch(() => false)) {
      const text = await inputTokenEl.textContent();
      const match = text?.match(/(\d+)/);
      if (match) metrics.inputTokens = parseInt(match[1]);
    }

    const outputTokenEl = this.page.locator('text=/[Oo]utput\\s*tokens?/').locator('..').first();
    if (await outputTokenEl.isVisible().catch(() => false)) {
      const text = await outputTokenEl.textContent();
      const match = text?.match(/(\d+)/);
      if (match) metrics.outputTokens = parseInt(match[1]);
    }

    const latencyEl = this.page.locator('text=/[Ll]atency|[Dd]uration/').locator('..').first();
    if (await latencyEl.isVisible().catch(() => false)) {
      const text = await latencyEl.textContent();
      const match = text?.match(/([\d.]+)\s*(ms|s|sec)/i);
      if (match) {
        const value = parseFloat(match[1]);
        const unit = match[2].toLowerCase();
        metrics.latencyMs = unit === 'ms' ? value : value * 1000;
      }
    }

    metrics.responseText = await this.getResponseText();
    return metrics;
  }

  /**
   * Check if the response area has content
   */
  async hasResponse(): Promise<boolean> {
    const text = await this.getResponseText();
    return text.trim().length > 0;
  }

  /**
   * Toggle streaming on or off
   */
  async setStreaming(enabled: boolean): Promise<void> {
    const toggle = this.page.locator(
      '[class*="streaming"] input[type="checkbox"], ' +
      'label:has-text("Streaming") input, ' +
      '[aria-label*="streaming"], [aria-label*="Streaming"]'
    ).first();

    if (await toggle.isVisible().catch(() => false)) {
      const isChecked = await toggle.isChecked();
      if (isChecked !== enabled) {
        await toggle.click();
        await this.page.waitForTimeout(500);
      }
    } else {
      const streamingLabel = this.page.locator('text=/[Ss]treaming/').first();
      if (await streamingLabel.isVisible().catch(() => false)) {
        const toggleNear = streamingLabel.locator('..').locator(
          'input[type="checkbox"], [role="switch"]'
        ).first();
        if (await toggleNear.isVisible().catch(() => false)) {
          const isChecked = await toggleNear.isChecked().catch(() => false);
          if (isChecked !== enabled) {
            await toggleNear.click();
            await this.page.waitForTimeout(500);
          }
        }
      }
    }
  }

  /**
   * Clear the current conversation/prompt
   */
  async clear(): Promise<void> {
    const clearButton = this.page.locator(
      'button:has-text("Clear"), button:has-text("Reset"), button:has-text("New")'
    ).first();
    if (await clearButton.isVisible().catch(() => false)) {
      await clearButton.click();
      await this.page.waitForTimeout(500);
    }
  }

  /**
   * Check what model is currently selected
   */
  async getCurrentModelName(): Promise<string> {
    const modelDisplay = this.page.locator(
      '[class*="model-name"], [class*="model-selector"] span, button:has-text("Claude")'
    ).first();
    return (await modelDisplay.textContent()) || '';
  }
}
