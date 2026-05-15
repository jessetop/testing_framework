# Manual Inputs Reference

This document lists all manual inputs required for lab testing that cannot be automated.

## Why Manual Inputs?

Some lab steps require human interaction that cannot be automated:
- **Authentication to external services** (Splunk.com accounts)
- **Expiring download URLs** (Splunk wget links expire in ~10 minutes)
- **License acceptance** (Splunk EULA)
- **Account creation** (setting passwords)

## Per-Lab Manual Inputs

### Lab 1: Manual Installation and Hardening

| Input | Environment Variable | How to Get It |
|-------|---------------------|---------------|
| Splunk Download URL | `SPLUNK_DOWNLOAD_URL` | splunk.com → Free Splunk → Enterprise → Linux → .tgz → Copy wget link |
| Splunk Admin Password | `SPLUNK_ADMIN_PASSWORD` | Choose any password (min 8 chars). Default: `LabPassword123!` |
| Splunkbase Username | `SPLUNKBASE_USERNAME` | (Optional) Your splunk.com login email |
| Splunkbase Password | `SPLUNKBASE_PASSWORD` | (Optional) Your splunk.com password |

**Note:** The Splunk download URL expires after ~10 minutes. Generate it immediately before running the test.

### Lab 2: IAM Role Configuration

| Input | Environment Variable | How to Get It |
|-------|---------------------|---------------|
| AWS Account ID | `AWS_ACCOUNT_ID` | AWS Console → top-right → Account ID |
| Instance ID from Lab 1 | `LAB1_INSTANCE_ID` | Output from Lab 1, or EC2 Console |
| Splunk Admin Password | `SPLUNK_ADMIN_PASSWORD` | Same as Lab 1 |

---

## Setting Environment Variables

### Option 1: .env file (recommended)

Create `testing_framework/.env`:

```bash
# AWS
AWS_ACCOUNT_ID=123456789012
AWS_USERNAME=lab-tester
AWS_PASSWORD=your-password
AWS_REGION=us-east-1

# Splunk - Lab 1
SPLUNK_DOWNLOAD_URL=https://download.splunk.com/products/splunk/releases/...
SPLUNK_ADMIN_PASSWORD=LabPassword123!

# Optional - Splunkbase auth
SPLUNKBASE_USERNAME=your-email@example.com
SPLUNKBASE_PASSWORD=your-splunk-password
```

### Option 2: Export before running

```bash
export SPLUNK_DOWNLOAD_URL="https://download.splunk.com/products/..."
export SPLUNK_ADMIN_PASSWORD="LabPassword123!"
npm test -- --grep "Lab 1"
```

### Option 3: Inline with command

```bash
SPLUNK_DOWNLOAD_URL="https://..." npm test -- --grep "Lab 1"
```

---

## Pre-Test Checklist

Before running lab tests:

- [ ] AWS credentials configured in `.env`
- [ ] Splunk.com account created (free)
- [ ] Fresh Splunk download URL obtained (do this last!)
- [ ] Splunk admin password decided
- [ ] AWS region selected (default: us-east-1)

---

## Storing Inputs for Re-use

For inputs that don't expire (passwords, account IDs), store them in `.env`.

For expiring inputs (download URLs), you have two options:

1. **Generate fresh before each test run** (recommended for accuracy)
2. **Download the .tgz file once** and host it on S3 or internal server with a stable URL

### Self-Hosted Splunk Download (Advanced)

```bash
# Download once
wget -O splunk-enterprise-latest.tgz "https://download.splunk.com/..."

# Upload to S3
aws s3 cp splunk-enterprise-latest.tgz s3://your-lab-bucket/splunk/

# Use stable URL in tests
SPLUNK_DOWNLOAD_URL=https://your-lab-bucket.s3.amazonaws.com/splunk/splunk-enterprise-latest.tgz
```

This avoids the expiring URL problem but requires keeping the S3 file updated when Splunk releases new versions.
