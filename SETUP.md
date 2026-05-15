# Lab Testing Framework - Setup Guide

This guide covers setting up AWS credentials and permissions for the lab testing framework.

## Prerequisites

- Node.js 18+ installed
- AWS account with IAM admin access (to create the test user)
- Splunk.com account (free) for Splunk labs

## Step 1: Create IAM Test User

Create a dedicated IAM user for Playwright testing. This user will have restricted permissions to only delete resources it creates.

### In AWS Console:

1. Go to **IAM → Users → Create user**
2. User name: `lab_tester` (or your preferred name)
3. Select **Provide user access to the AWS Management Console**
4. Set a console password
5. Uncheck "Users must create a new password at next sign-in"
6. Click **Next**, then **Create user**

### Attach the IAM Policy:

1. Go to **IAM → Users → lab_tester → Add permissions → Create inline policy**
2. Click the **JSON** tab
3. Paste the contents of `iam-policy-lab-tester.json` (included in this repo)
4. Name it `lab-tester-policy`
5. Click **Create policy**

## Step 2: Understand the Tag-Based Security

All resources created by this framework are automatically tagged with:

```
ManagedBy: playwright-lab-tester
```

The IAM policy enforces:

| Action | Permission |
|--------|------------|
| Describe/List resources | ✅ Allowed (all) |
| Create resources | ✅ Allowed (tag is auto-added) |
| Terminate/Delete resources | ⚠️ Only if tagged with `ManagedBy: playwright-lab-tester` |

**This means:**
- The test user CANNOT delete resources created by other users
- The test user CANNOT delete resources created manually in the console (unless you manually add the tag)
- Old test resources can be identified and cleaned up by filtering on the tag

### Finding Test Resources

To find all resources created by the framework:

```
EC2 Console → Instances → Filter → Tag: ManagedBy = playwright-lab-tester
```

## Step 3: Configure Environment

Copy `.env.example` to `.env` and fill in your values:

```bash
cp .env.example .env
```

Edit `.env`:

```bash
# AWS Console Credentials
AWS_CONSOLE_URL=https://YOUR-ACCOUNT-ALIAS.signin.aws.amazon.com/console
AWS_ACCOUNT_ID=123456789012
AWS_USERNAME=lab_tester
AWS_PASSWORD=your-password-here
AWS_REGION=us-east-1

# Splunk (for Splunk labs)
SPLUNK_ADMIN_PASSWORD=LabPassword123!

# Test settings
HEADLESS=true   # Set to 'false' to see the browser
```

**Note:** The `.env` file is gitignored and will not be committed.

## Step 4: Install Dependencies

```bash
cd testing_framework
npm install
```

## Step 5: Run Your First Test

### For Splunk Labs:

1. Get a fresh Splunk download URL (expires in ~10 minutes):
   - Go to https://www.splunk.com/
   - Click **Free Splunk → Splunk Enterprise**
   - Sign in to your Splunk.com account
   - Select **Linux** tab → find **.tgz** row → click **Copy wget link**

2. Set the environment variable:
   ```bash
   export SPLUNK_DOWNLOAD_URL="https://download.splunk.com/products/splunk/releases/..."
   ```

3. Run the test:
   ```bash
   # With browser visible (recommended for first run)
   npm run test:headed -- --grep "Lab 1"

   # Headless
   npm test -- --grep "Lab 1"
   ```

## IAM Policy Reference

The policy in `iam-policy-lab-tester.json` includes:

```json
{
  "Sid": "AllowDeleteOnlyTaggedResources",
  "Effect": "Allow",
  "Action": [
    "ec2:TerminateInstances",
    "ec2:StopInstances",
    "ec2:DeleteSecurityGroup",
    ...
  ],
  "Resource": "*",
  "Condition": {
    "StringEquals": {
      "ec2:ResourceTag/ManagedBy": "playwright-lab-tester"
    }
  }
}
```

This condition block is what restricts deletions to only tagged resources.

## Cleanup

### Manual Cleanup

To terminate all test instances:

1. EC2 Console → Instances
2. Filter by tag: `ManagedBy = playwright-lab-tester`
3. Select all → Instance state → Terminate

### Automated Cleanup (TODO)

A cleanup script can be added to terminate all tagged resources:

```bash
npm run cleanup  # Not yet implemented
```

## Troubleshooting

### "Access Denied" when terminating instances

The instance wasn't tagged properly. Either:
- The tag wasn't added during creation (bug in test)
- You're trying to delete a manually-created instance

Fix: Manually add the tag `ManagedBy: playwright-lab-tester` to the resource, or delete it with admin credentials.

### Login fails

- Check your AWS_CONSOLE_URL matches your account's sign-in URL
- Verify the username and password are correct
- Check if MFA is enabled (not currently supported)

### Selectors not finding elements

AWS updates their console UI frequently. If tests fail on element selection:
1. Run with `HEADLESS=false` to see what's happening
2. Update selectors in `core/pages/aws/*.page.ts`
3. Submit a PR with the fix

## Cost Considerations

Lab tests create real AWS resources that cost money:

| Resource | Approximate Cost |
|----------|------------------|
| t3.large instance | ~$0.08/hour |
| 100 GiB gp3 storage | ~$0.08/day |

**Always terminate test instances when done!**

The framework does NOT auto-terminate instances (to allow debugging). Check for orphaned resources:

```
EC2 Console → Instances → Filter: ManagedBy = playwright-lab-tester
```
