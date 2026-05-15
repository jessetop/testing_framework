# Testing Framework — Claude Instructions

This folder contains the Playwright-based lab testing framework.

## Handling "Test Lab X" Requests

When the user asks to test a lab (e.g., "test lab 2 for splunk", "run the kiro lab 1 test"), follow this workflow:

### Step 1: Parse the Request

Extract:
- **Course name** (splunk, kiro, grafana, etc.)
- **Lab number** (1, 2, 3, etc.)

If unclear, ask: "Which course and lab number would you like to test?"

### Step 2: Check the Registry

Read `lab-registry.ts` to see if a test exists for that course/lab combination.

```typescript
// Check if lab exists
const lab = findLabTest('splunk', 2);
```

**If the lab test does NOT exist:**

Respond with:
```
I don't have a test for [Course] Lab [X] yet.

Available tests for [Course]:
- Lab 1: [Name]
- Lab 2: [Name]

To create a test for Lab [X], please provide the lab markdown file and I'll build the test.
```

### Step 3: Validate Prerequisites

If the lab test EXISTS, check what manual inputs are required by reading the lab's config file (e.g., `courses/splunk/tests/lab1.config.ts`).

**Check environment variables:**
- Read the `.env` file to see what's configured
- Identify any MISSING required inputs

### Step 4: Report Readiness

**If inputs are MISSING:**

```
To test [Course] Lab [X], you need to provide:

❌ SPLUNK_DOWNLOAD_URL
   → Get from: splunk.com → Free Splunk → Enterprise → Linux → .tgz → Copy wget link
   → Note: This URL expires in ~10 minutes, get it right before running

✅ SPLUNK_ADMIN_PASSWORD (already set)

Once you have the URL, run:
  export SPLUNK_DOWNLOAD_URL="https://..."
  npm test -- --grep "Lab [X]"
```

**If ALL inputs are provided:**

```
✅ Ready to test [Course] Lab [X]: [Lab Name]

Estimated duration: [X] minutes
Test file: courses/[course]/tests/[file].spec.ts

Manual inputs configured:
✅ SPLUNK_DOWNLOAD_URL (set) ⚠️ Expires quickly - make sure it's fresh!
✅ SPLUNK_ADMIN_PASSWORD (set)

Run with:
  npm test -- --grep "Lab [X]"          # Headless
  npm run test:headed -- --grep "Lab [X]"  # With browser
```

### Step 5: Do NOT Auto-Run

**NEVER automatically run the test.** Always show the validation result and let the user explicitly run it. Tests:
- Create real AWS resources that cost money
- Take 15-20+ minutes to complete
- Require fresh manual inputs (like Splunk URLs that expire)

## Creating New Lab Tests

When the user provides a lab markdown file to create a test:

1. Read the lab markdown thoroughly
2. Identify all steps that need testing
3. Identify manual inputs required (downloads, passwords, external accounts)
4. Create:
   - `courses/[course]/tests/labX.config.ts` - Configuration and manual inputs
   - `courses/[course]/tests/labX-[name].spec.ts` - The actual test
5. Add the lab to `lab-registry.ts`
6. Create any new page objects needed in `courses/[course]/pages/`

## File Locations

| Purpose | Location |
|---------|----------|
| Lab registry | `lab-registry.ts` |
| Core AWS pages | `core/pages/aws/` |
| Course-specific pages | `courses/[course]/pages/` |
| Lab tests | `courses/[course]/tests/` |
| Lab configs | `courses/[course]/tests/labX.config.ts` |
| Environment | `.env` |

## Available Courses and Labs

Check `lab-registry.ts` for the current list. As of now:

| Course | Lab | Status |
|--------|-----|--------|
| Splunk | 1 - Manual Installation and Hardening | ✅ Ready |
| Splunk | 2+ | Not yet created |
| Kiro | All | Not yet created |

## Tag-Based Security

All resources are tagged with `ManagedBy: playwright-lab-tester`. The IAM policy restricts the test user to only delete resources with this tag. This is documented in `SETUP.md`.
