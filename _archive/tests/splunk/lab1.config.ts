/**
 * Lab 1: Manual Installation and Hardening
 *
 * MANUAL INPUTS REQUIRED
 * ----------------------
 * Before running this test, you must provide these values.
 * These cannot be automated due to authentication, expiring URLs, or manual steps.
 */

export const lab1Config = {
  /**
   * MANUAL INPUT 1: Splunk Download URL
   * ------------------------------------
   * 1. Go to https://www.splunk.com/
   * 2. Click "Free Splunk" → "Splunk Enterprise"
   * 3. Sign in to your Splunk.com account
   * 4. Select "Linux" tab → find ".tgz" row → click "Copy wget link"
   * 5. Paste the URL below
   *
   * NOTE: This URL expires after ~10 minutes, so generate it right before running the test
   */
  splunkDownloadUrl: process.env.SPLUNK_DOWNLOAD_URL || '',

  /**
   * MANUAL INPUT 2: Splunk Admin Password
   * --------------------------------------
   * Password for the Splunk admin account that will be created during first boot.
   * Must be at least 8 characters.
   */
  splunkAdminPassword: process.env.SPLUNK_ADMIN_PASSWORD || 'LabPassword123!',

  /**
   * OPTIONAL: Splunkbase Credentials
   * ---------------------------------
   * Only needed if testing app installation (Task 8)
   * Can use the same credentials as splunk.com
   */
  splunkbaseUsername: process.env.SPLUNKBASE_USERNAME || '',
  splunkbasePassword: process.env.SPLUNKBASE_PASSWORD || '',

  // -------------------------------------------------
  // Instance Configuration (can be modified if needed)
  // -------------------------------------------------

  instance: {
    name: 'Splunk-Enterprise-Server',
    type: 't3.large',        // Splunk minimum: 2 vCPUs, 8 GiB RAM
    ami: 'Amazon Linux 2023' as const,
    storageSizeGiB: 100,
    storageType: 'gp3' as const,
    region: process.env.AWS_REGION || 'us-east-1',
  },

  securityGroup: {
    name: 'splunk-enterprise-sg',
    rules: [
      { type: 'SSH' as const, source: 'Anywhere' as const },           // For Instance Connect
      { type: 'Custom TCP' as const, port: 8000, source: 'My IP' as const },  // Splunk Web
      { type: 'Custom TCP' as const, port: 8089, source: 'My IP' as const },  // Splunk Management
    ],
  },

  // Expected values for validation
  expected: {
    osName: 'Amazon Linux',
    osVersion: '2023',
    splunkUser: 'splunk',
    splunkGroup: 'splunk',
    splunkPath: '/opt/splunk',
    splunkWebPort: 8000,
    splunkMgmtPort: 8089,
    minSplunkbaseApps: 900,
  },
};

/**
 * Validate that required manual inputs are provided
 */
export function validateConfig(): { valid: boolean; missing: string[] } {
  const missing: string[] = [];

  if (!lab1Config.splunkDownloadUrl) {
    missing.push('SPLUNK_DOWNLOAD_URL - Get fresh wget link from splunk.com');
  }

  if (!lab1Config.splunkAdminPassword || lab1Config.splunkAdminPassword.length < 8) {
    missing.push('SPLUNK_ADMIN_PASSWORD - Must be at least 8 characters');
  }

  return {
    valid: missing.length === 0,
    missing,
  };
}

/**
 * Print instructions for getting manual inputs
 */
export function printSetupInstructions() {
  console.log(`
╔════════════════════════════════════════════════════════════════════╗
║              LAB 1: MANUAL INPUTS REQUIRED                         ║
╠════════════════════════════════════════════════════════════════════╣
║                                                                    ║
║  Before running this test, set these environment variables:        ║
║                                                                    ║
║  1. SPLUNK_DOWNLOAD_URL                                            ║
║     → Go to splunk.com → Free Splunk → Splunk Enterprise           ║
║     → Sign in → Linux → .tgz → Copy wget link                      ║
║     → This URL expires in ~10 minutes!                             ║
║                                                                    ║
║  2. SPLUNK_ADMIN_PASSWORD                                          ║
║     → Password for Splunk admin (min 8 chars)                      ║
║     → Default: LabPassword123!                                     ║
║                                                                    ║
║  Optional:                                                         ║
║  - SPLUNKBASE_USERNAME / SPLUNKBASE_PASSWORD                       ║
║    (only if testing app installation)                              ║
║                                                                    ║
║  Example:                                                          ║
║  export SPLUNK_DOWNLOAD_URL="https://download.splunk.com/..."      ║
║  export SPLUNK_ADMIN_PASSWORD="MySecurePass123"                    ║
║  npm test -- --grep "Lab 1"                                        ║
║                                                                    ║
╚════════════════════════════════════════════════════════════════════╝
  `);
}
