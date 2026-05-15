# Lab Testing Framework

Playwright-based testing framework for validating course labs through AWS Console and third-party UIs.

## First Time Setup

See **[SETUP.md](SETUP.md)** for complete setup instructions including:
- Creating an IAM test user with restricted permissions
- Understanding the tag-based security model
- Configuring environment variables

## Architecture

```
testing_framework/
├── core/                       # Shared AWS infrastructure (used by all courses)
│   ├── pages/aws/              # EC2, VPC, IAM page objects
│   ├── actions/                # High-level helpers (ec2.waitForRunning, etc.)
│   └── fixtures/               # AWS auth, test fixtures
│
├── courses/                    # Course-specific modules (isolated)
│   ├── splunk/
│   │   ├── pages/              # SplunkWebPage
│   │   └── tests/              # Splunk lab tests
│   ├── kiro/
│   │   ├── pages/              # KiroPage (if needed)
│   │   └── tests/              # Kiro lab tests
│   └── grafana/
│       └── ...
│
├── playwright.config.ts
└── package.json
```

**Key principle:** Core AWS stuff is shared. Course-specific stuff is isolated. Testing Kiro labs won't require Splunk dependencies.

## Quick Start

```bash
cd testing_framework
npm install

# Configure AWS credentials
cp .env.example .env
# Edit .env with your AWS account details

# Check if a lab test is ready to run
npm run check splunk 1

# Run specific lab test
npm test -- --grep "Lab 1"

# Run with browser visible
npm run test:headed -- --grep "Lab 1"
```

## Testing a Lab

### Step 1: Check Readiness

Before running a test, check what inputs are needed:

```bash
npm run check splunk 1
```

This will tell you:
- If the test exists
- What manual inputs are required
- Which inputs are missing vs. configured

### Step 2: Provide Manual Inputs

Some labs require inputs that can't be automated:

```bash
# Example: Splunk download URL (expires in ~10 min)
export SPLUNK_DOWNLOAD_URL="https://download.splunk.com/..."
```

### Step 3: Run the Test

```bash
# Headless (faster)
npm test -- --grep "Lab 1"

# With browser visible (for debugging)
npm run test:headed -- --grep "Lab 1"
```

## Available Lab Tests

| Course | Lab | Name | Status |
|--------|-----|------|--------|
| Splunk | 1 | Manual Installation and Hardening | ✅ Ready |
| Splunk | 2+ | - | Not yet created |
| Kiro | All | - | Not yet created |

To add a new lab test, provide the lab markdown file.

## Writing Tests

### Import from core for AWS operations

```typescript
import { test, expect, EC2LaunchWizardPage, InstanceConnectPage, ec2 } from '../../../core';

test('Launch EC2', async ({ awsPage }) => {
  const wizard = new EC2LaunchWizardPage(awsPage, 'us-east-1');
  const instanceId = await wizard.launchInstance({
    name: 'test-instance',
    ami: 'Amazon Linux 2023',
    instanceType: 't2.micro',
  });
});
```

### Import course-specific modules locally

```typescript
// In courses/splunk/tests/lab1.spec.ts
import { SplunkWebPage } from '../pages';

const splunk = new SplunkWebPage(page, publicIp, 8000);
await splunk.login('admin', 'password');
```

## Manual Inputs

Some labs require manual inputs that can't be automated. See `MANUAL_INPUTS.md` for details.

**Example: Splunk Lab 1**
```bash
# Get fresh download URL from splunk.com (expires in ~10 min)
export SPLUNK_DOWNLOAD_URL="https://download.splunk.com/..."
export SPLUNK_ADMIN_PASSWORD="LabPassword123!"
npm test -- --grep "Lab 1"
```

## Core AWS Actions

| Action | Description |
|--------|-------------|
| `ec2.waitForRunning(page, instanceId)` | Wait for instance to reach running state |
| `ec2.waitForStopped(page, instanceId)` | Wait for instance to stop |
| `ec2.terminateInstance(page, instanceId)` | Terminate an instance |
| `ec2.getInstanceInfo(page, instanceId)` | Get public IP, private IP, state |
| `ec2.connectToInstance(page, instanceId)` | Open Instance Connect session |

## Adding a New Course

1. Create folder: `courses/[course-name]/`
2. Add pages: `courses/[course-name]/pages/`
3. Add tests: `courses/[course-name]/tests/`
4. Create index: `courses/[course-name]/index.ts`

```typescript
// courses/newcourse/index.ts
export { NewCoursePage } from './pages';
```

Tests import core AWS stuff from `../../../core` and local pages from `../pages`.

## Resource Tagging & Security

All resources created by this framework are automatically tagged:

```
ManagedBy: playwright-lab-tester
```

The IAM policy (see `iam-policy-lab-tester.json`) restricts the test user:
- **Can create** any EC2 resources (instances, security groups, etc.)
- **Can only delete** resources with the `ManagedBy: playwright-lab-tester` tag
- **Cannot delete** resources created by other users or manually

This prevents accidental deletion of production resources.

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `AWS_ACCOUNT_ID` | Yes | 12-digit AWS account ID |
| `AWS_USERNAME` | Yes | IAM username |
| `AWS_PASSWORD` | Yes | IAM password |
| `AWS_REGION` | No | Default: us-east-1 |
| `HEADLESS` | No | Set to 'false' to see browser |

## Tips

- AWS Console changes frequently. If selectors break, update page objects in `core/pages/aws/`.
- Auth is cached for 6 hours in `.auth/aws-session.json`.
- Screenshots on failure are in `test-results/`.
- Labs can take time. Default timeout is 5 minutes per test.
