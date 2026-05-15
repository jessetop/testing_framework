#!/usr/bin/env npx ts-node

/**
 * Setup Script: Anthropic Lab 3 (Fintech)
 *
 * Creates S3 bucket prefix and uploads sample financial regulatory
 * documents for the Fintech industry-specific lab.
 *
 * Usage:
 *   npx ts-node scripts/setup-anthropic-lab3.ts
 *   npx ts-node scripts/setup-anthropic-lab3.ts --teardown
 */

import { execSync } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';

const envPath = path.join(__dirname, '../.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const eqIndex = trimmed.indexOf('=');
      if (eqIndex > 0) {
        const key = trimmed.substring(0, eqIndex);
        const value = trimmed.substring(eqIndex + 1).replace(/^"|"$/g, '');
        if (!process.env[key]) process.env[key] = value;
      }
    }
  }
}

const accountId = process.env.AWS_ACCOUNT_ID || '';
const region = process.env.AWS_REGION || 'us-east-1';
const profile = 'roitraining';
const bucketName = `bedrock-training-${accountId}`;
const prefix = 'lab3-fintech';
const awsBase = `aws --profile ${profile} --region ${region}`;
const teardown = process.argv.includes('--teardown');

const documents = [
  {
    filename: 'aml_policy.txt',
    content: `ACME Financial Services — Anti-Money Laundering (AML) Policy
Last Updated: January 2025

1. OVERVIEW
   ACME Financial Services is committed to preventing money laundering and terrorist financing.
   This policy applies to all employees, contractors, and third-party agents.

2. CUSTOMER DUE DILIGENCE (CDD)
   - All new accounts require identity verification before activation
   - Enhanced Due Diligence (EDD) required for high-risk customers:
     * Politically Exposed Persons (PEPs)
     * Customers from high-risk jurisdictions (FATF grey/black list)
     * Cash-intensive businesses
   - Ongoing monitoring of all customer relationships

3. TRANSACTION MONITORING THRESHOLDS
   - Currency Transaction Reports (CTR): Required for cash transactions over $10,000
   - Suspicious Activity Reports (SAR): Required when transactions exhibit patterns of potential money laundering
   - Structuring detection: Multiple transactions just below $10,000 within 24 hours
   - Wire transfers over $3,000 require originator and beneficiary information

4. RED FLAGS
   - Unusually large cash deposits inconsistent with customer profile
   - Rapid movement of funds between accounts
   - Transactions involving sanctioned countries or individuals
   - Customer reluctance to provide identification
   - Third-party transfers with no apparent business reason

5. REPORTING OBLIGATIONS
   - SAR must be filed within 30 calendar days of initial detection
   - CTR must be filed within 15 calendar days of the transaction
   - All reports filed with FinCEN via BSA E-Filing system
   - Internal escalation: compliance officer must be notified within 24 hours

6. RECORD RETENTION
   - All CDD records: 5 years after account closure
   - Transaction records: 5 years from date of transaction
   - SAR/CTR records: 5 years from filing date
   - Training records: 3 years`,
  },
  {
    filename: 'kyc_requirements.txt',
    content: `ACME Financial Services — Know Your Customer (KYC) Requirements
Effective: January 2025

1. INDIVIDUAL ACCOUNTS
   Required Documentation:
   - Government-issued photo ID (passport, driver's license, or national ID card)
   - Proof of address dated within 90 days (utility bill, bank statement, or tax document)
   - Social Security Number or Tax Identification Number
   - Date of birth verification
   - Source of funds declaration for deposits over $25,000

   Verification Process:
   Step 1: Collect required documents
   Step 2: Verify document authenticity (visual inspection + database check)
   Step 3: Screen against OFAC sanctions list
   Step 4: Screen against PEP databases
   Step 5: Risk score assignment (Low/Medium/High)
   Step 6: Approval by compliance officer (Medium/High risk only)
   Step 7: Account activation

2. BUSINESS ACCOUNTS
   Additional Requirements:
   - Certificate of incorporation or business registration
   - Articles of organization/operating agreement
   - Beneficial ownership disclosure (all individuals owning 25%+ or with significant control)
   - Business financial statements (most recent fiscal year)
   - Business license or permit (if applicable)

3. ENHANCED DUE DILIGENCE (EDD)
   Triggered When:
   - Customer risk score is HIGH
   - Customer is a PEP or PEP associate
   - Transaction patterns are inconsistent with stated business purpose
   - Customer is from a high-risk jurisdiction

   Additional Requirements:
   - Senior management approval for account opening
   - Source of wealth documentation
   - Enhanced transaction monitoring (lower thresholds)
   - Annual review of customer relationship

4. ONGOING MONITORING
   - Account activity reviewed against stated purpose quarterly
   - Risk scores reassessed annually
   - Trigger events require immediate review:
     * Significant change in transaction patterns
     * Negative media screening alerts
     * Change in beneficial ownership`,
  },
  {
    filename: 'transaction_monitoring.txt',
    content: `ACME Financial Services — Transaction Monitoring Procedures
Effective: January 2025

1. MONITORING TIERS

   Tier 1 (Real-Time):
   - OFAC sanctions screening on all transactions
   - Velocity checks: more than 10 transactions in 1 hour from single account
   - Amount threshold: single transactions over $50,000

   Tier 2 (Daily Batch):
   - Structuring detection: aggregate cash over $8,000 in rolling 24-hour window
   - Cross-border wire analysis: all international transfers reviewed
   - Peer group analysis: transactions compared against similar account profiles

   Tier 3 (Weekly Review):
   - Dormant account activity (no transactions for 12+ months then sudden activity)
   - Round-dollar transactions pattern (repeated exact amounts)
   - Layering detection (rapid transfers between multiple accounts)

2. SUSPICIOUS ACTIVITY INDICATORS

   High Priority:
   - Transaction to/from OFAC sanctioned entity — IMMEDIATE BLOCK AND REPORT
   - Transaction amount over $100,000 from account with typical balance under $10,000
   - Multiple wire transfers to different beneficiaries in high-risk jurisdictions same day

   Medium Priority:
   - Cash deposits just below $10,000 (potential structuring)
   - Account receiving funds from 5+ unrelated sources in a single day
   - Transaction narrative doesn't match declared account purpose

   Low Priority:
   - Minor variations in normal transaction patterns
   - Single large transaction within stated income range
   - International transfers to/from low-risk jurisdictions

3. ALERT RESOLUTION
   - Tier 1 alerts: reviewed within 4 hours
   - Tier 2 alerts: reviewed within 24 hours
   - Tier 3 alerts: reviewed within 5 business days
   - All alerts documented with resolution rationale
   - Escalation to SAR filing if suspicious activity confirmed`,
  },
  {
    filename: 'regulatory_reporting.txt',
    content: `ACME Financial Services — Regulatory Reporting Requirements
Effective: January 2025

1. SUSPICIOUS ACTIVITY REPORT (SAR)
   Filing Threshold: Any known or suspected criminal violation involving $5,000 or more
   Deadline: 30 calendar days from initial detection; 60 days if no suspect identified
   Filing Method: FinCEN BSA E-Filing System
   Required Information:
   - Subject information (name, address, SSN/EIN, date of birth)
   - Financial institution information
   - Suspicious activity details (dates, amounts, type)
   - Narrative description of suspicious activity (minimum 5 sentences)

   SAR Narrative Requirements:
   - Who is conducting the suspicious activity?
   - What instruments or mechanisms are being used?
   - When did the suspicious activity occur?
   - Where did the suspicious activity take place?
   - Why does the activity appear suspicious?

2. CURRENCY TRANSACTION REPORT (CTR)
   Filing Threshold: Cash transactions over $10,000 (single or aggregate same day)
   Deadline: 15 calendar days from transaction date
   Filing Method: FinCEN BSA E-Filing System

3. REPORT OF INTERNATIONAL TRANSPORTATION OF CURRENCY (CMIR)
   Filing Threshold: Physical transport of currency over $10,000 across US border
   Deadline: At time of transport (Customs) or within 15 days (FinCEN)

4. FOREIGN BANK ACCOUNT REPORT (FBAR)
   Filing Threshold: US persons with foreign financial accounts exceeding $10,000 aggregate
   Deadline: April 15 annually (automatic extension to October 15)

5. RECORD KEEPING
   - All reports must be retained for 5 years from filing date
   - Supporting documentation must be maintained with the report
   - Reports are confidential — sharing with subjects is prohibited (tipping off)
   - Annual SAR review: all SARs reviewed for patterns and trends`,
  },
  {
    filename: 'data_handling_policy.txt',
    content: `ACME Financial Services — Data Handling and PII Protection Policy
Effective: January 2025

1. CLASSIFICATION OF SENSITIVE DATA
   Restricted (highest sensitivity):
   - Social Security Numbers (SSN)
   - Bank account numbers
   - Credit/debit card numbers
   - Login credentials and passwords
   - Biometric data

   Confidential:
   - Customer names and addresses
   - Date of birth
   - Phone numbers and email addresses
   - Transaction history
   - Account balances
   - Employment and income information

   Internal Use Only:
   - Customer risk scores
   - Internal investigation notes
   - Compliance review outcomes
   - System access logs

2. HANDLING REQUIREMENTS
   Restricted Data:
   - Encryption at rest: AES-256
   - Encryption in transit: TLS 1.2+
   - Access: need-to-know basis with multi-factor authentication
   - Display: masked by default (show last 4 digits only)
   - Storage: dedicated encrypted data stores
   - Sharing: prohibited outside authorized systems

   Confidential Data:
   - Encryption at rest: AES-256
   - Encryption in transit: TLS 1.2+
   - Access: role-based access control
   - Display: visible to authorized personnel
   - Sharing: within organization for business purposes only

3. DATA RETENTION AND DISPOSAL
   - Customer PII: retained 7 years after relationship ends
   - Transaction records: retained 7 years from transaction date
   - Disposal: secure deletion with certificate of destruction
   - Backup data: same retention and disposal schedule as primary

4. BREACH NOTIFICATION
   - Internal notification: within 1 hour of discovery
   - Regulatory notification: within 72 hours (per state laws)
   - Customer notification: within 30 days of confirmed breach
   - Documentation: complete incident report within 5 business days`,
  },
];

function run(cmd: string): string {
  try {
    return execSync(cmd, { encoding: 'utf-8', stdio: 'pipe' }).trim();
  } catch (err: any) {
    throw new Error(err.stderr?.toString().trim() || err.message);
  }
}

if (teardown) {
  console.log(`Deleting s3://${bucketName}/${prefix}/...`);
  try { run(`${awsBase} s3 rm s3://${bucketName}/${prefix}/ --recursive`); } catch {}
  console.log('Done.');
  process.exit(0);
}

console.log(`Setting up Lab 3 (Fintech) documents...`);
console.log(`  Bucket: s3://${bucketName}/${prefix}/`);

// Ensure bucket exists
try { run(`${awsBase} s3api head-bucket --bucket ${bucketName}`); }
catch {
  if (region === 'us-east-1') run(`${awsBase} s3api create-bucket --bucket ${bucketName}`);
  else run(`${awsBase} s3api create-bucket --bucket ${bucketName} --create-bucket-configuration LocationConstraint=${region}`);
  run(`${awsBase} s3api wait bucket-exists --bucket ${bucketName}`);
}

// Write and upload docs
const tmpDir = path.join(__dirname, '../.tmp-lab3-docs');
fs.mkdirSync(tmpDir, { recursive: true });
for (const doc of documents) fs.writeFileSync(path.join(tmpDir, doc.filename), doc.content, 'utf-8');
run(`${awsBase} s3 sync "${tmpDir}" s3://${bucketName}/${prefix}/`);
fs.rmSync(tmpDir, { recursive: true, force: true });

// Verify
const listing = run(`${awsBase} s3 ls s3://${bucketName}/${prefix}/`);
const count = listing.split('\n').filter(l => l.trim()).length;
console.log(`  ${count} files uploaded.`);
console.log(`\n  S3 URI: s3://${bucketName}/${prefix}/`);
