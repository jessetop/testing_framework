#!/usr/bin/env npx ts-node

/**
 * Setup Script: Anthropic on Bedrock - Lab 1
 *
 * Creates the S3 bucket and uploads sample documents for the
 * Bedrock Knowledge Base RAG lab. Designed to be reusable across
 * AWS accounts.
 *
 * Usage:
 *   npx ts-node scripts/setup-anthropic-lab1.ts                     # Uses .env AWS_ACCOUNT_ID
 *   npx ts-node scripts/setup-anthropic-lab1.ts --account 123456789012
 *   npx ts-node scripts/setup-anthropic-lab1.ts --region us-west-2
 *   npx ts-node scripts/setup-anthropic-lab1.ts --dry-run           # Show what would be created
 *   npx ts-node scripts/setup-anthropic-lab1.ts --teardown          # Remove bucket and contents
 *
 * Prerequisites:
 *   - AWS CLI configured with appropriate credentials
 *   - aws sts get-caller-identity should return the target account
 */

import { execSync } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';

// Load .env
const envPath = path.join(__dirname, '../.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const eqIndex = trimmed.indexOf('=');
      if (eqIndex > 0) {
        const key = trimmed.substring(0, eqIndex);
        const value = trimmed.substring(eqIndex + 1);
        if (!process.env[key]) {
          process.env[key] = value;
        }
      }
    }
  }
}

// ─── CLI Arguments ─────────────────────────────────────────────────

const args = process.argv.slice(2);

function getArg(name: string): string | undefined {
  const idx = args.indexOf(`--${name}`);
  if (idx >= 0 && idx + 1 < args.length) return args[idx + 1];
  return undefined;
}

const dryRun = args.includes('--dry-run');
const teardown = args.includes('--teardown');
const accountId = getArg('account') || process.env.AWS_ACCOUNT_ID || '';
const region = getArg('region') || process.env.AWS_REGION || 'us-east-1';
const profile = getArg('profile') || 'roitraining';

if (!accountId) {
  console.error('ERROR: AWS_ACCOUNT_ID not set. Provide --account or set in .env');
  process.exit(1);
}

const bucketName = `bedrock-training-${accountId}`;
const prefix = 'lab1-documents';
const awsBase = `aws --profile ${profile} --region ${region}`;

// ─── Sample Documents ──────────────────────────────────────────────
// These simulate a product company's knowledge base for RAG testing.
// The lab tests query about return policies, warranties, and account info.

const sampleDocuments: { filename: string; content: string }[] = [
  {
    filename: 'return-policy.txt',
    content: `ACME Corp — Product Return Policy
Last Updated: January 2025

1. STANDARD RETURNS
   - Products may be returned within 30 days of purchase for a full refund.
   - Items must be in original packaging, unused, and include all accessories.
   - A valid receipt or order confirmation is required.

2. DAMAGED PRODUCTS
   - Products arriving damaged may be returned within 60 days.
   - Photo documentation of damage is required.
   - ACME Corp covers return shipping for damaged items.
   - Replacements are shipped within 3-5 business days after receiving the return.

3. DIGITAL PRODUCTS
   - Digital products (software licenses, subscriptions) are non-refundable after activation.
   - Unused digital product keys may be returned within 14 days.

4. HOW TO INITIATE A RETURN
   Step 1: Log into your account at acmecorp.com/returns
   Step 2: Select the order containing the item to return
   Step 3: Choose the reason for return from the dropdown menu
   Step 4: Print the prepaid shipping label (for eligible returns)
   Step 5: Ship the item within 7 days of initiating the return
   Step 6: Refund is processed within 5-7 business days after item is received

5. EXCEPTIONS
   - Custom-built products are non-returnable.
   - Clearance items are final sale.
   - International orders: customer is responsible for return shipping costs.

For questions, contact support@acmecorp.com or call 1-800-ACME-HELP.`,
  },
  {
    filename: 'warranty-coverage.txt',
    content: `ACME Corp — Warranty Coverage Guide
Effective: January 2025

STANDARD WARRANTY (All Products)
- Duration: 1 year from date of purchase
- Covers: Manufacturing defects, hardware failures under normal use
- Does NOT cover: Accidental damage, water damage, unauthorized modifications

PREMIUM WARRANTY (Premium Tier Products)
- Duration: 3 years from date of purchase
- Covers: Everything in Standard, plus accidental damage (up to 2 incidents)
- Includes: Free expedited shipping for replacements
- Includes: Priority support queue (4-hour response time)
- Includes: Loaner device program during repairs

ENTERPRISE WARRANTY (Enterprise Tier)
- Duration: 5 years from date of purchase
- Covers: Everything in Premium, plus on-site repair service
- Includes: Dedicated account manager
- Includes: Quarterly hardware health checks
- SLA: 99.9% uptime guarantee for connected products

HOW TO FILE A WARRANTY CLAIM
1. Visit acmecorp.com/warranty or call 1-800-ACME-HELP
2. Provide your order number and product serial number
3. Describe the issue in detail
4. Our team will diagnose remotely when possible
5. If repair/replacement is needed, you'll receive shipping instructions
6. Turnaround time: 5-7 business days (Standard), 2-3 days (Premium), 1 day (Enterprise)

WARRANTY REGISTRATION
- Products are automatically registered when purchased through acmecorp.com
- Retail purchases: register at acmecorp.com/register within 30 days
- Proof of purchase is required for all warranty claims`,
  },
  {
    filename: 'product-catalog.txt',
    content: `ACME Corp — Product Catalog 2025

CATEGORY: SMART HOME
- ACME Hub Pro ($199) — Central smart home controller, supports Zigbee/Z-Wave/WiFi
- ACME Sensor Kit ($79) — Temperature, humidity, motion, and door/window sensors
- ACME Cam 360 ($149) — Indoor security camera with 360° pan, night vision, 2-way audio
- ACME Thermostat ($129) — AI-powered climate control, learns your schedule

CATEGORY: AUDIO
- ACME SoundBar Ultra ($299) — Dolby Atmos soundbar with wireless subwoofer
- ACME BudsPro ($149) — Active noise canceling wireless earbuds, 8hr battery
- ACME Speaker Mesh ($199/pair) — Multi-room wireless speakers with mesh networking

CATEGORY: ACCESSORIES
- ACME PowerBank 20K ($49) — 20,000mAh portable charger, USB-C PD 65W
- ACME Dock Pro ($89) — USB-C docking station, dual 4K display support
- ACME Cable Kit ($29) — Braided USB-C cables (0.5m, 1m, 2m) with lifetime warranty

PRICING TIERS
- Standard: Base product with 1-year warranty
- Premium: Product + extended 3-year warranty + priority support ($50 additional)
- Enterprise: Product + 5-year warranty + on-site service + dedicated account manager (custom pricing, contact sales@acmecorp.com)

BULK DISCOUNTS
- 10-49 units: 10% discount
- 50-99 units: 15% discount
- 100+ units: 20% discount + free shipping
- Enterprise agreements: Contact sales for volume pricing`,
  },
  {
    filename: 'faq.txt',
    content: `ACME Corp — Frequently Asked Questions

Q: How do I track my order?
A: Log into acmecorp.com/orders. Your tracking number is emailed within 24 hours of shipment. Standard shipping takes 5-7 business days; express shipping takes 2-3 business days.

Q: Can I change or cancel my order after placing it?
A: Orders can be modified or cancelled within 2 hours of placement. After that, the order enters processing and cannot be changed. Contact support immediately if you need changes.

Q: Do you ship internationally?
A: Yes, we ship to 45 countries. International orders typically arrive in 10-15 business days. Customs duties and taxes are the responsibility of the buyer.

Q: How do I reset my ACME Hub Pro?
A: Hold the reset button on the bottom of the device for 10 seconds until the LED flashes red. The hub will restart and enter setup mode. Note: this erases all device pairings.

Q: What payment methods do you accept?
A: We accept Visa, Mastercard, American Express, PayPal, Apple Pay, and Google Pay. Enterprise customers can arrange purchase orders and net-30 terms.

Q: Is my data secure with ACME products?
A: Yes. All ACME smart home products use AES-256 encryption for data at rest and TLS 1.3 for data in transit. We are SOC 2 Type II certified. Data is stored in AWS us-east-1 region. We never sell customer data to third parties.

Q: How do I contact support?
A: Email: support@acmecorp.com | Phone: 1-800-ACME-HELP (Mon-Fri 8am-8pm ET) | Live chat: acmecorp.com/chat (24/7)

Q: What is your price match policy?
A: We match verified lower prices from authorized retailers within 14 days of purchase. Submit a price match request at acmecorp.com/pricematch with a link to the competitor's listing.`,
  },
  {
    filename: 'support-procedures.txt',
    content: `ACME Corp — Customer Support Procedures (Internal)

TICKET PRIORITY LEVELS
- P1 (Critical): Product safety issue, data breach, complete product failure
  → Response time: 1 hour | Resolution target: 4 hours
- P2 (High): Product not functioning, order not received past expected date
  → Response time: 4 hours | Resolution target: 24 hours
- P3 (Medium): Feature not working as expected, minor defect
  → Response time: 24 hours | Resolution target: 3 business days
- P4 (Low): General inquiry, feature request, feedback
  → Response time: 48 hours | Resolution target: 5 business days

ESCALATION PATH
1. Tier 1 Support Agent → handles P3/P4, basic troubleshooting
2. Tier 2 Technical Support → handles P2, advanced diagnostics
3. Tier 3 Engineering → handles P1, root cause analysis
4. VP of Support → customer escalation beyond Tier 3

REFUND AUTHORIZATION LIMITS
- Tier 1: Up to $100
- Tier 2: Up to $500
- Manager: Up to $2,000
- VP: Unlimited

COMMON ISSUE RESOLUTIONS
- "Product won't turn on" → Check power cable, try different outlet, hold power 15s, check for firmware update
- "Can't connect to WiFi" → Verify 2.4GHz network (not 5GHz), check password, reset network settings, update firmware
- "Order shows delivered but not received" → Verify shipping address, check with neighbors, file carrier claim after 48 hours, reship if carrier confirms lost

ACCOUNT MANAGEMENT
- Account status types: Active, Suspended, Closed
- Suspension reasons: Payment failure, security concern, policy violation
- To reactivate: Resolve underlying issue, then submit reactivation request
- Account data retention: 7 years after account closure per legal requirements`,
  },
];

// ─── Helpers ───────────────────────────────────────────────────────

function run(cmd: string, silent = false): string {
  if (dryRun) {
    console.log(`  [dry-run] ${cmd}`);
    return '';
  }
  try {
    const result = execSync(cmd, { encoding: 'utf-8', stdio: silent ? 'pipe' : 'pipe' });
    return result.trim();
  } catch (err: any) {
    if (err.stderr) {
      throw new Error(err.stderr.toString().trim());
    }
    throw err;
  }
}

function printHeader(text: string) {
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`  ${text}`);
  console.log(`${'═'.repeat(60)}`);
}

// ─── Teardown ──────────────────────────────────────────────────────

function doTeardown() {
  printHeader(`Teardown: s3://${bucketName}/${prefix}/`);

  console.log(`\nDeleting objects in s3://${bucketName}/${prefix}/...`);
  try {
    run(`${awsBase} s3 rm s3://${bucketName}/${prefix}/ --recursive`);
    console.log('  Objects deleted');
  } catch (err: any) {
    console.log(`  No objects to delete or bucket doesn't exist: ${err.message}`);
  }

  // Don't delete the bucket itself — other labs/prefixes might use it
  console.log(`\nNote: Bucket "${bucketName}" was NOT deleted (may contain other lab data).`);
  console.log('  To fully remove: aws s3 rb s3://' + bucketName + ' --force');
  console.log('\nTeardown complete.');
}

// ─── Setup ─────────────────────────────────────────────────────────

function doSetup() {
  printHeader('Anthropic Lab 1 — S3 Bucket Setup');
  console.log(`  Account:  ${accountId}`);
  console.log(`  Region:   ${region}`);
  console.log(`  Profile:  ${profile}`);
  console.log(`  Bucket:   s3://${bucketName}`);
  console.log(`  Prefix:   ${prefix}/`);
  console.log(`  Docs:     ${sampleDocuments.length} sample files`);
  if (dryRun) console.log(`  Mode:     DRY RUN`);

  // Step 1: Verify AWS identity
  console.log('\n[1/4] Verifying AWS credentials...');
  try {
    const identity = run(`${awsBase} sts get-caller-identity --output json`);
    if (!dryRun) {
      const parsed = JSON.parse(identity);
      console.log(`  Identity: ${parsed.Arn}`);
      if (parsed.Account !== accountId) {
        console.error(`  WARNING: CLI account (${parsed.Account}) != target account (${accountId})`);
        console.error('  Set --account or fix your AWS profile');
        process.exit(1);
      }
    }
  } catch (err: any) {
    console.error(`  Failed to verify credentials: ${err.message}`);
    console.error(`  Ensure "aws --profile ${profile}" is configured correctly`);
    process.exit(1);
  }

  // Step 2: Create bucket if it doesn't exist
  console.log('\n[2/4] Creating S3 bucket...');
  try {
    run(`${awsBase} s3api head-bucket --bucket ${bucketName}`, true);
    console.log(`  Bucket already exists: s3://${bucketName}`);
  } catch {
    console.log(`  Creating bucket: s3://${bucketName}`);
    // us-east-1 doesn't use LocationConstraint
    if (region === 'us-east-1') {
      run(`${awsBase} s3api create-bucket --bucket ${bucketName}`);
    } else {
      run(`${awsBase} s3api create-bucket --bucket ${bucketName} --create-bucket-configuration LocationConstraint=${region}`);
    }
    console.log('  Bucket created');
    // S3 bucket creation can take a moment to propagate
    console.log('  Waiting for bucket to propagate...');
    if (!dryRun) {
      run(`${awsBase} s3api wait bucket-exists --bucket ${bucketName}`);
    }
  }

  // Step 3: Write sample documents to temp dir and upload
  console.log('\n[3/4] Uploading sample documents...');
  const tmpDir = path.join(__dirname, '../.tmp-lab1-docs');
  if (!dryRun) {
    fs.mkdirSync(tmpDir, { recursive: true });

    for (const doc of sampleDocuments) {
      const filePath = path.join(tmpDir, doc.filename);
      fs.writeFileSync(filePath, doc.content, 'utf-8');
    }
  }

  // Upload all at once
  if (dryRun) {
    for (const doc of sampleDocuments) {
      console.log(`  [dry-run] Upload ${doc.filename} (${doc.content.length} bytes)`);
    }
  } else {
    run(`${awsBase} s3 sync "${tmpDir}" s3://${bucketName}/${prefix}/`);
    // Clean up temp dir
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }

  // Verify
  console.log('\n[4/4] Verifying uploads...');
  if (!dryRun) {
    const listing = run(`${awsBase} s3 ls s3://${bucketName}/${prefix}/`);
    const lines = listing.split('\n').filter(l => l.trim());
    console.log(`  ${lines.length} files in s3://${bucketName}/${prefix}/:`);
    for (const line of lines) {
      console.log(`    ${line.trim()}`);
    }

    if (lines.length !== sampleDocuments.length) {
      console.error(`  WARNING: Expected ${sampleDocuments.length} files, found ${lines.length}`);
    }
  }

  // Summary
  printHeader('Setup Complete');
  console.log(`
  S3 URI for Bedrock Knowledge Base:
    s3://${bucketName}/${prefix}/

  Documents uploaded:
${sampleDocuments.map(d => `    - ${d.filename}`).join('\n')}

  Next steps:
    1. Verify Bedrock model access (Opus, Sonnet, Haiku) in ${region}
    2. Run Lab 1: npm test -- --grep "Anthropic Lab 1"
`);
}

// ─── Main ──────────────────────────────────────────────────────────

if (teardown) {
  doTeardown();
} else {
  doSetup();
}
