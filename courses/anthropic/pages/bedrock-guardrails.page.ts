/**
 * Bedrock Guardrails Page Object
 *
 * Handles interactions with Amazon Bedrock Guardrails console:
 * - Navigate to Safeguards > Guardrails
 * - Create guardrail with name, description
 * - Configure content filters (Hate, Insults, Sexual, Violence, Misconduct, Prompt Attack)
 * - Add denied topics (name, definition, sample phrases)
 * - Enable PII masking (SSN, credit card, phone, email)
 * - Create and prepare versions
 * - Extract guardrail ID and version
 * - Delete guardrail (for cleanup)
 */

import { Page, expect } from '@playwright/test';

export interface GuardrailConfig {
  name: string;
  description?: string;
  contentFilters?: ContentFilterConfig[];
  deniedTopics?: DeniedTopicConfig[];
  piiFilters?: PIIFilterConfig[];
}

export interface ContentFilterConfig {
  type: 'Hate' | 'Insults' | 'Sexual' | 'Violence' | 'Misconduct' | 'Prompt Attack';
  inputStrength: 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH';
  outputStrength: 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH';
}

export interface DeniedTopicConfig {
  name: string;
  definition: string;
  samplePhrases?: string[];
}

export interface PIIFilterConfig {
  type: 'SSN' | 'Credit Card' | 'Phone' | 'Email' | 'Name' | 'Address';
  action: 'MASK' | 'BLOCK';
}

export interface GuardrailInfo {
  guardrailId: string;
  version: string;
  status: string;
}

export class BedrockGuardrailsPage {
  constructor(
    private page: Page,
    private region: string = 'us-east-1'
  ) {}

  /**
   * Navigate to the Bedrock Guardrails listing page
   */
  async open(): Promise<void> {
    await this.page.goto(
      `https://${this.region}.console.aws.amazon.com/bedrock/home?region=${this.region}#/guardrails`
    );
    await this.page.waitForLoadState('domcontentloaded');
    await this.page.waitForTimeout(2000);
  }

  /**
   * Click "Create guardrail" button
   */
  async clickCreate(): Promise<void> {
    const createButton = this.page.locator(
      'button:has-text("Create guardrail"), button:has-text("Create")'
    ).first();
    await createButton.click();
    await this.page.waitForLoadState('domcontentloaded');
    await this.page.waitForTimeout(2000);
  }

  /**
   * Fill in guardrail name and description (Step 1)
   */
  async configureBasicSettings(name: string, description?: string): Promise<void> {
    // Fill name
    const nameInput = this.page.locator(
      'input[placeholder*="name"], input[name*="name"], label:has-text("Name") ~ input, label:has-text("Name") + div input'
    ).first();
    await nameInput.click();
    await nameInput.fill(name);

    // Fill description if provided
    if (description) {
      const descInput = this.page.locator(
        'textarea[placeholder*="description"], textarea[name*="description"], label:has-text("Description") ~ textarea, label:has-text("Description") + div textarea'
      ).first();
      if (await descInput.isVisible().catch(() => false)) {
        await descInput.click();
        await descInput.fill(description);
      }
    }
  }

  /**
   * Configure a content filter strength for input and output
   */
  async setContentFilter(
    filterType: string,
    inputStrength: string,
    outputStrength: string
  ): Promise<void> {
    // Find the row for this filter type
    const filterRow = this.page.locator(`tr:has-text("${filterType}"), [class*="row"]:has-text("${filterType}")`).first();

    if (await filterRow.isVisible().catch(() => false)) {
      // Set input strength - find the first select/dropdown in the row
      const inputSelect = filterRow.locator('select, [role="listbox"], [class*="select"]').first();
      if (await inputSelect.isVisible().catch(() => false)) {
        await inputSelect.selectOption({ label: inputStrength });
      } else {
        // Try clicking a strength button/radio
        const inputStrengthOption = filterRow.locator(`text=${inputStrength}`).first();
        if (await inputStrengthOption.isVisible().catch(() => false)) {
          await inputStrengthOption.click();
        }
      }

      // Set output strength - find the second select/dropdown in the row
      const outputSelect = filterRow.locator('select, [role="listbox"], [class*="select"]').nth(1);
      if (await outputSelect.isVisible().catch(() => false)) {
        await outputSelect.selectOption({ label: outputStrength });
      } else {
        const outputStrengthOption = filterRow.locator(`text=${outputStrength}`).last();
        if (await outputStrengthOption.isVisible().catch(() => false)) {
          await outputStrengthOption.click();
        }
      }
    }

    await this.page.waitForTimeout(500);
  }

  /**
   * Configure all content filters from an array of configs
   */
  async configureContentFilters(filters: ContentFilterConfig[]): Promise<void> {
    // Enable content filters section if there's a toggle
    const enableToggle = this.page.locator(
      'label:has-text("Content filter") input[type="checkbox"], [class*="content-filter"] [role="switch"]'
    ).first();
    if (await enableToggle.isVisible().catch(() => false)) {
      const isChecked = await enableToggle.isChecked().catch(() => false);
      if (!isChecked) {
        await enableToggle.click();
        await this.page.waitForTimeout(500);
      }
    }

    for (const filter of filters) {
      await this.setContentFilter(filter.type, filter.inputStrength, filter.outputStrength);
    }
  }

  /**
   * Add a denied topic
   */
  async addDeniedTopic(topic: DeniedTopicConfig): Promise<void> {
    // Click "Add denied topic" button
    const addButton = this.page.locator(
      'button:has-text("Add denied topic"), button:has-text("Add topic")'
    ).first();
    if (await addButton.isVisible().catch(() => false)) {
      await addButton.click();
      await this.page.waitForTimeout(1000);
    }

    // Fill topic name
    const topicNameInput = this.page.locator(
      'input[placeholder*="topic name"], input[placeholder*="Topic name"], label:has-text("Topic name") ~ input, label:has-text("Topic name") + div input'
    ).first();
    if (await topicNameInput.isVisible().catch(() => false)) {
      await topicNameInput.click();
      await topicNameInput.fill(topic.name);
    }

    // Fill definition
    const definitionInput = this.page.locator(
      'textarea[placeholder*="definition"], textarea[placeholder*="Definition"], label:has-text("Definition") ~ textarea, label:has-text("Definition") + div textarea'
    ).first();
    if (await definitionInput.isVisible().catch(() => false)) {
      await definitionInput.click();
      await definitionInput.fill(topic.definition);
    }

    // Add sample phrases if provided
    if (topic.samplePhrases && topic.samplePhrases.length > 0) {
      for (const phrase of topic.samplePhrases) {
        const phraseInput = this.page.locator(
          'input[placeholder*="phrase"], input[placeholder*="sample"], label:has-text("Sample") ~ input, label:has-text("Sample") + div input'
        ).last();
        if (await phraseInput.isVisible().catch(() => false)) {
          await phraseInput.click();
          await phraseInput.fill(phrase);

          // Press Enter or click Add to confirm the phrase
          await phraseInput.press('Enter');
          await this.page.waitForTimeout(300);
        }
      }
    }

    // Confirm/save the topic if there's a confirm button in the dialog
    const confirmButton = this.page.locator(
      'button:has-text("Add"), button:has-text("Save"), button:has-text("Confirm")'
    ).last();
    if (await confirmButton.isVisible().catch(() => false)) {
      await confirmButton.click();
      await this.page.waitForTimeout(500);
    }
  }

  /**
   * Configure PII filters
   */
  async configurePIIFilters(piiFilters: PIIFilterConfig[]): Promise<void> {
    // Enable PII section if there's a toggle
    const enableToggle = this.page.locator(
      'label:has-text("PII") input[type="checkbox"], [class*="pii"] [role="switch"], label:has-text("Sensitive information") input[type="checkbox"]'
    ).first();
    if (await enableToggle.isVisible().catch(() => false)) {
      const isChecked = await enableToggle.isChecked().catch(() => false);
      if (!isChecked) {
        await enableToggle.click();
        await this.page.waitForTimeout(500);
      }
    }

    for (const piiFilter of piiFilters) {
      // Find the PII type row
      const piiRow = this.page.locator(
        `tr:has-text("${piiFilter.type}"), [class*="row"]:has-text("${piiFilter.type}")`
      ).first();

      if (await piiRow.isVisible().catch(() => false)) {
        // Enable the PII type checkbox if not already checked
        const checkbox = piiRow.locator('input[type="checkbox"]').first();
        if (await checkbox.isVisible().catch(() => false)) {
          const isChecked = await checkbox.isChecked().catch(() => false);
          if (!isChecked) {
            await checkbox.click();
          }
        }

        // Set the action (MASK or BLOCK)
        const actionSelect = piiRow.locator('select, [role="listbox"]').first();
        if (await actionSelect.isVisible().catch(() => false)) {
          await actionSelect.selectOption({ label: piiFilter.action });
        } else {
          // Try radio buttons or text options
          const actionOption = piiRow.locator(`text=${piiFilter.action}`).first();
          if (await actionOption.isVisible().catch(() => false)) {
            await actionOption.click();
          }
        }
      }

      await this.page.waitForTimeout(300);
    }
  }

  /**
   * Click Next to advance through wizard steps
   */
  async clickNext(): Promise<void> {
    const nextButton = this.page.locator('button:has-text("Next")').first();
    await nextButton.click();
    await this.page.waitForLoadState('domcontentloaded');
    await this.page.waitForTimeout(2000);
  }

  /**
   * Submit the guardrail creation (final step)
   */
  async submitCreate(): Promise<void> {
    const createButton = this.page.locator(
      'button:has-text("Create guardrail"), button:has-text("Create"):not(:has-text("Quick"))'
    ).last();
    await createButton.click();
    await this.page.waitForLoadState('domcontentloaded');
    await this.page.waitForTimeout(3000);
  }

  /**
   * Create a guardrail end-to-end through the wizard
   */
  async createGuardrail(config: GuardrailConfig): Promise<void> {
    await this.clickCreate();

    // Step 1: Basic settings (name, description)
    await this.configureBasicSettings(config.name, config.description);
    await this.clickNext();

    // Step 2: Content filters
    if (config.contentFilters && config.contentFilters.length > 0) {
      await this.configureContentFilters(config.contentFilters);
    }

    // Step 3: Denied topics
    if (config.deniedTopics && config.deniedTopics.length > 0) {
      for (const topic of config.deniedTopics) {
        await this.addDeniedTopic(topic);
      }
    }
    await this.clickNext();

    // Step 4: PII filters
    if (config.piiFilters && config.piiFilters.length > 0) {
      await this.configurePIIFilters(config.piiFilters);
    }
    await this.clickNext();

    // Review and create
    await this.submitCreate();
  }

  /**
   * Click "Prepare" to create a new version of the guardrail
   */
  async prepareVersion(): Promise<void> {
    const prepareButton = this.page.locator(
      'button:has-text("Prepare"), button:has-text("Create version")'
    ).first();
    await prepareButton.click();
    await this.page.waitForTimeout(2000);

    // Confirm if dialog appears
    const confirmButton = this.page.locator(
      'button:has-text("Prepare"), button:has-text("Create"), button:has-text("Confirm")'
    ).last();
    if (await confirmButton.isVisible().catch(() => false)) {
      await confirmButton.click();
      await this.page.waitForTimeout(3000);
    }
  }

  /**
   * Wait for guardrail to become Ready
   */
  async waitForReady(timeoutMs: number = 120000): Promise<void> {
    console.log('Waiting for guardrail to become Ready...');
    await expect(async () => {
      await this.page.locator('button[aria-label="Refresh"], button:has-text("Refresh")').first().click().catch(() => {});
      await this.page.waitForTimeout(2000);

      const readyStatus = this.page.locator(
        'text=Ready, span:has-text("Ready"), text=READY'
      ).first();
      expect(await readyStatus.isVisible()).toBe(true);
    }).toPass({ timeout: timeoutMs, intervals: [10000] });

    console.log('Guardrail is Ready');
  }

  /**
   * Extract the guardrail ID from the detail page
   */
  async getGuardrailId(): Promise<string> {
    // Look for guardrail ID in the detail view
    const idElement = this.page.locator(
      'text=/Guardrail ID/, dt:has-text("Guardrail ID"), th:has-text("Guardrail ID")'
    ).first();

    if (await idElement.isVisible().catch(() => false)) {
      // The value is typically in the next sibling element
      const valueElement = idElement.locator('.. >> dd, .. >> td, + div, + span').first();
      const text = await valueElement.textContent();
      return text?.trim() || '';
    }

    // Fallback: look for ID pattern in the URL or page content
    const url = this.page.url();
    const urlMatch = url.match(/guardrails?\/([\w-]+)/);
    if (urlMatch) {
      return urlMatch[1];
    }

    // Fallback: search page text for ID pattern
    const pageText = await this.page.locator('[class*="detail"], [class*="summary"]').first().textContent();
    const idMatch = pageText?.match(/([a-z0-9]{10,})/);
    return idMatch ? idMatch[1] : '';
  }

  /**
   * Extract the current guardrail version
   */
  async getGuardrailVersion(): Promise<string> {
    const versionElement = this.page.locator(
      'text=/Version/, dt:has-text("Version"), th:has-text("Version")'
    ).first();

    if (await versionElement.isVisible().catch(() => false)) {
      const valueElement = versionElement.locator('.. >> dd, .. >> td, + div, + span').first();
      const text = await valueElement.textContent();
      const match = text?.match(/(\d+)/);
      return match ? match[1] : '1';
    }

    return '1';
  }

  /**
   * Get full guardrail info (ID, version, status)
   */
  async getGuardrailInfo(): Promise<GuardrailInfo> {
    return {
      guardrailId: await this.getGuardrailId(),
      version: await this.getGuardrailVersion(),
      status: await this.getStatus(),
    };
  }

  /**
   * Get the current status of the guardrail
   */
  async getStatus(): Promise<string> {
    const statusElement = this.page.locator(
      'span:has-text("Ready"), span:has-text("Creating"), span:has-text("Failed"), span:has-text("DRAFT"), span:has-text("Active")'
    ).first();

    if (await statusElement.isVisible().catch(() => false)) {
      return (await statusElement.textContent())?.trim() || 'Unknown';
    }
    return 'Unknown';
  }

  /**
   * Check if a guardrail with the given name exists in the listing
   */
  async guardrailExists(name: string): Promise<boolean> {
    const guardrailRow = this.page.locator(`text="${name}"`).first();
    return guardrailRow.isVisible().catch(() => false);
  }

  /**
   * Open a guardrail by clicking its name in the listing
   */
  async openGuardrail(name: string): Promise<void> {
    const guardrailLink = this.page.locator(
      `a:has-text("${name}"), td:has-text("${name}") a`
    ).first();
    await guardrailLink.click();
    await this.page.waitForLoadState('domcontentloaded');
    await this.page.waitForTimeout(2000);
  }

  /**
   * Delete a guardrail by name (for cleanup)
   */
  async deleteGuardrail(name: string): Promise<void> {
    // Select the guardrail row
    const guardrailRow = this.page.locator(`tr:has-text("${name}")`).first();
    const checkbox = guardrailRow.locator('input[type="checkbox"], input[type="radio"]').first();
    if (await checkbox.isVisible().catch(() => false)) {
      await checkbox.click();
    } else {
      await guardrailRow.click();
    }

    // Click delete
    const deleteButton = this.page.locator('button:has-text("Delete")').first();
    await deleteButton.click();
    await this.page.waitForTimeout(1000);

    // Confirm deletion (type the guardrail name or click confirm)
    const confirmInput = this.page.locator(
      'input[placeholder*="delete"], input[placeholder*="confirm"]'
    ).first();
    if (await confirmInput.isVisible().catch(() => false)) {
      await confirmInput.fill(name);
    }

    const confirmButton = this.page.locator(
      'button:has-text("Delete"), button:has-text("Confirm")'
    ).last();
    await confirmButton.click();
    await this.page.waitForTimeout(3000);
  }
}
