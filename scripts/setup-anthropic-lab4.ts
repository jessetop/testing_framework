#!/usr/bin/env npx ts-node

/**
 * Setup Script: Anthropic Lab 4 (Healthcare)
 * Creates S3 documents for the HIPAA-Compliant AI Assistant lab.
 *
 * Usage: npx ts-node scripts/setup-anthropic-lab4.ts [--teardown]
 */

import { execSync } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';

const envPath = path.join(__dirname, '../.env');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf-8').split('\n')) {
    const t = line.trim();
    if (t && !t.startsWith('#')) { const i = t.indexOf('='); if (i > 0 && !process.env[t.substring(0, i)]) process.env[t.substring(0, i)] = t.substring(i + 1).replace(/^"|"$/g, ''); }
  }
}

const accountId = process.env.AWS_ACCOUNT_ID || '';
const region = process.env.AWS_REGION || 'us-east-1';
const profile = 'roitraining';
const bucketName = `bedrock-training-${accountId}`;
const prefix = 'lab4-healthcare';
const awsBase = `aws --profile ${profile} --region ${region}`;

const documents = [
  { filename: 'clinical_guidelines.txt', content: `Regional Medical Center — Clinical Practice Guidelines
Last Updated: January 2025

HYPERTENSION MANAGEMENT
First-line therapy: Lifestyle modifications for all patients
- Dietary sodium restriction (<2,300 mg/day)
- Regular aerobic exercise (150 min/week moderate intensity)
- Weight management (BMI target 18.5-24.9)
- Limit alcohol consumption

Pharmacological therapy (if BP remains >140/90 after 3 months):
- Stage 1 (140-159/90-99): Single agent — ACE inhibitor or ARB preferred
  * Lisinopril 10mg daily (first choice for most patients)
  * Losartan 50mg daily (alternative if ACE intolerant — cough)
- Stage 2 (≥160/100): Combination therapy
  * ACE inhibitor + calcium channel blocker (amlodipine 5mg)
  * OR ACE inhibitor + thiazide diuretic (HCTZ 12.5mg)

Monitoring:
- Recheck BP in 4 weeks after starting/adjusting medication
- Labs: BMP (electrolytes, creatinine) at baseline and 2 weeks after starting ACE/ARB
- Annual: lipid panel, HbA1c if diabetic, urinalysis for proteinuria

TYPE 2 DIABETES MANAGEMENT
First-line: Metformin 500mg BID with meals, titrate to 1000mg BID
- Check HbA1c every 3 months until stable, then every 6 months
- Renal function check before starting and annually (contraindicated if eGFR <30)
- Add second agent if HbA1c >7% after 3 months on maximum tolerated metformin

ASTHMA (ADULT)
Step 1 (Intermittent): SABA PRN (albuterol 2 puffs q4-6h as needed)
Step 2 (Mild persistent): Low-dose ICS (fluticasone 88mcg BID) + SABA PRN
Step 3 (Moderate persistent): Medium-dose ICS or low-dose ICS + LABA
Step 4 (Severe persistent): High-dose ICS + LABA, consider biologics referral

DEPRESSION SCREENING
- PHQ-9 annually for all adults
- Score 5-9: Watchful waiting, rescreen in 4 weeks
- Score 10-14: Consider therapy and/or medication
- Score 15-19: Recommend therapy + medication
- Score ≥20: Urgent evaluation, safety assessment, medication + therapy` },
  { filename: 'medication_reference.txt', content: `Regional Medical Center — Medication Quick Reference
Last Updated: January 2025

COMMON DRUG INTERACTIONS

Metformin:
- Alcohol: increased risk of lactic acidosis
- Contrast dye: hold metformin 48 hours before and after CT with IV contrast
- ACE inhibitors: may enhance hypoglycemic effect (monitor blood sugar)
- Cimetidine: increases metformin levels (avoid combination)

Lisinopril (ACE Inhibitor):
- NSAIDs (ibuprofen, naproxen): reduces antihypertensive effect, increases renal risk
- Potassium supplements/spironolactone: risk of hyperkalemia
- Lithium: ACE inhibitors increase lithium levels (monitor closely)
- Aliskiren: contraindicated combination in diabetic patients

Warfarin:
- Antibiotics (especially fluoroquinolones, metronidazole): increased INR
- NSAIDs: increased bleeding risk
- Vitamin K-rich foods: decreased anticoagulant effect
- Acetaminophen >2g/day: may increase INR

Amlodipine (Calcium Channel Blocker):
- Simvastatin: limit simvastatin to 20mg when combined with amlodipine
- Cyclosporine: amlodipine may increase cyclosporine levels
- Grapefruit juice: increases amlodipine levels

DOSING GUIDELINES — HIGH-ALERT MEDICATIONS
- Insulin: always verify dose with second provider
- Heparin: use standard concentration protocols only
- Opioids: start low (morphine 2-4mg IV for opioid-naive patients)
- Potassium IV: never exceed 10 mEq/hour in non-monitored setting` },
  { filename: 'telehealth_protocols.txt', content: `Regional Medical Center — Telehealth Visit Protocols
Effective: January 2025

1. VISIT TYPES AND DURATIONS
   - New patient consultation: 30 minutes
   - Follow-up visit: 15 minutes
   - Urgent care triage: 10 minutes
   - Mental health session: 45 minutes
   - Chronic disease management: 20 minutes

2. PRE-VISIT REQUIREMENTS
   - Patient identity verification (date of birth + last 4 SSN or photo ID)
   - Informed consent for telehealth (annual, documented in chart)
   - Technology check (video/audio confirmed working)
   - Patient location confirmed (must be in state where provider is licensed)

3. DOCUMENTATION REQUIREMENTS
   Every telehealth visit must include:
   - Chief complaint and history of present illness
   - Review of systems (relevant to chief complaint)
   - Assessment and plan
   - Patient education provided
   - Follow-up plan and timeline
   - Notation: "Visit conducted via telehealth video platform"
   - Technology note: "Audio and video connection adequate" or note any issues

4. PRESCRIBING VIA TELEHEALTH
   Allowed:
   - Refills of established medications
   - New non-controlled substances based on clinical assessment
   - Schedule III-V controlled substances (with established patient relationship)

   Not Allowed:
   - Schedule II controlled substances (opioids, stimulants) for new patients
   - Medications requiring in-person examination (certain dermatologics)

5. EMERGENCY PROTOCOLS
   If patient appears to be in emergency during telehealth visit:
   - Obtain patient's current physical location
   - Call 911 for patient's location
   - Stay on video call until EMS arrives
   - Document in chart with timestamp of 911 activation` },
  { filename: 'hipaa_compliance.txt', content: `Regional Medical Center — HIPAA Compliance Reference
Effective: January 2025

1. PROTECTED HEALTH INFORMATION (PHI) — 18 IDENTIFIERS
   The following are considered PHI when associated with health information:
   1. Names
   2. Geographic data smaller than state
   3. Dates (except year) related to an individual
   4. Phone numbers
   5. Fax numbers
   6. Email addresses
   7. Social Security Numbers
   8. Medical record numbers
   9. Health plan beneficiary numbers
   10. Account numbers
   11. Certificate/license numbers
   12. Vehicle identifiers and serial numbers
   13. Device identifiers and serial numbers
   14. Web URLs
   15. IP addresses
   16. Biometric identifiers
   17. Full-face photographs
   18. Any other unique identifying number or code

2. MINIMUM NECESSARY STANDARD
   - Access only the minimum PHI needed to perform your job function
   - Role-based access controls enforced in all systems
   - Audit logs track all PHI access (who, what, when)

3. BREACH NOTIFICATION REQUIREMENTS
   - Internal: Report to Privacy Officer within 24 hours of discovery
   - HHS: Notify within 60 days if breach affects 500+ individuals
   - Individuals: Notify within 60 days of discovery
   - Media: Required if breach affects 500+ individuals in a single state

4. PENALTIES
   Tier 1 (Unaware): $100-$50,000 per violation
   Tier 2 (Reasonable cause): $1,000-$50,000 per violation
   Tier 3 (Willful neglect, corrected): $10,000-$50,000 per violation
   Tier 4 (Willful neglect, not corrected): $50,000 per violation
   Annual maximum: $1,500,000 per violation category

5. AI-SPECIFIC CONSIDERATIONS
   - AI systems processing PHI must have BAA with vendor
   - Model training data must not contain identifiable PHI
   - AI outputs containing PHI must be encrypted in transit and at rest
   - Audit logging required for all AI-PHI interactions` },
  { filename: 'scheduling_policy.txt', content: `Regional Medical Center — Appointment Scheduling Policy
Effective: January 2025

1. APPOINTMENT TYPES
   - Annual physical: 45 min, scheduled 2-4 weeks in advance
   - Sick visit (acute): 15 min, same-day or next-day availability required
   - Follow-up: 15-20 min, per provider recommendation
   - Specialist referral: varies, typically 2-6 week lead time
   - Telehealth: same types as in-person, +5 min for tech setup

2. SCHEDULING RULES
   - New patients: 30 min minimum, assign to provider with availability within 14 days
   - Established patients: schedule with their assigned PCP when possible
   - Urgent: must be seen within 24 hours, any available provider
   - Double-booking: allowed only with provider approval, maximum 1 per half-day session

3. CANCELLATION AND NO-SHOW POLICY
   - Cancellation: 24 hours notice requested
   - No-show: documented in chart, outreach call within 2 business days
   - Chronic no-show (3+ in 12 months): letter sent, care plan review
   - No financial penalty for cancellation or no-show

4. PRESCRIPTION REFILL REQUESTS
   - Routine refills: processed within 48 business hours
   - Urgent refills (patient out of medication): same-day processing
   - Controlled substances: require provider review, 72-hour processing
   - Refill denied if: overdue for follow-up visit (>6 months for chronic meds)

5. PATIENT NOTIFICATIONS
   - Appointment confirmation: sent 7 days before via patient preference (text/email/call)
   - Reminder: sent 24 hours before
   - Follow-up scheduling: offered at end of each visit
   - Lab results: available in patient portal within 3 business days` },
];

function run(cmd: string): string {
  try { return execSync(cmd, { encoding: 'utf-8', stdio: 'pipe' }).trim(); }
  catch (err: any) { throw new Error(err.stderr?.toString().trim() || err.message); }
}

if (process.argv.includes('--teardown')) {
  console.log(`Deleting s3://${bucketName}/${prefix}/...`);
  try { run(`${awsBase} s3 rm s3://${bucketName}/${prefix}/ --recursive`); } catch {}
  console.log('Done.'); process.exit(0);
}

console.log(`Setting up Lab 4 (Healthcare) documents...`);
try { run(`${awsBase} s3api head-bucket --bucket ${bucketName}`); }
catch {
  if (region === 'us-east-1') run(`${awsBase} s3api create-bucket --bucket ${bucketName}`);
  else run(`${awsBase} s3api create-bucket --bucket ${bucketName} --create-bucket-configuration LocationConstraint=${region}`);
  run(`${awsBase} s3api wait bucket-exists --bucket ${bucketName}`);
}

const tmpDir = path.join(__dirname, '../.tmp-lab4-docs');
fs.mkdirSync(tmpDir, { recursive: true });
for (const doc of documents) fs.writeFileSync(path.join(tmpDir, doc.filename), doc.content, 'utf-8');
run(`${awsBase} s3 sync "${tmpDir}" s3://${bucketName}/${prefix}/`);
fs.rmSync(tmpDir, { recursive: true, force: true });

const count = run(`${awsBase} s3 ls s3://${bucketName}/${prefix}/`).split('\n').filter(l => l.trim()).length;
console.log(`  ${count} files uploaded to s3://${bucketName}/${prefix}/`);
