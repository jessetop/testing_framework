/**
 * Lab 1: Manual Installation and Hardening - Configuration
 *
 * MANUAL INPUTS REQUIRED
 * ----------------------
 * Before running this test, provide these values via environment variables.
 */

export const lab1Config = {
  /**
   * MANUAL INPUT 1: Splunk Download URL
   * ------------------------------------
   * 1. Go to https://www.splunk.com/
   * 2. Click "Free Splunk" → "Splunk Enterprise"
   * 3. Sign in to your Splunk.com account
   * 4. Select "Linux" tab → find ".tgz" row → click "Copy wget link"
   * 5. Set SPLUNK_DOWNLOAD_URL environment variable
   *
   * NOTE: This URL expires after ~10 minutes!
   */
  splunkDownloadUrl: process.env.SPLUNK_DOWNLOAD_URL || '',

  /**
   * MANUAL INPUT 2: Splunk Admin Password
   * Must be at least 8 characters.
   */
  splunkAdminPassword: process.env.SPLUNK_ADMIN_PASSWORD || 'LabPassword123!',

  /**
   * OPTIONAL: Splunkbase Credentials (for app installation tests)
   */
  splunkbaseUsername: process.env.SPLUNKBASE_USERNAME || '',
  splunkbasePassword: process.env.SPLUNKBASE_PASSWORD || '',

  // Instance Configuration
  instance: {
    name: 'Splunk-Enterprise-Server',
    type: 't3.large',
    ami: 'Amazon Linux 2023' as const,
    storageSizeGiB: 100,
    storageType: 'gp3' as const,
    region: process.env.AWS_REGION || 'us-east-1',
  },

  securityGroup: {
    name: 'splunk-enterprise-sg',
    rules: [
      { type: 'SSH' as const, source: 'Anywhere' as const },
      { type: 'Custom TCP' as const, port: 8000, source: 'My IP' as const },
      { type: 'Custom TCP' as const, port: 8089, source: 'My IP' as const },
    ],
  },

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

export function validateConfig(): { valid: boolean; missing: string[] } {
  const missing: string[] = [];

  if (!lab1Config.splunkDownloadUrl) {
    missing.push('SPLUNK_DOWNLOAD_URL - Get fresh wget link from splunk.com');
  }

  if (!lab1Config.splunkAdminPassword || lab1Config.splunkAdminPassword.length < 8) {
    missing.push('SPLUNK_ADMIN_PASSWORD - Must be at least 8 characters');
  }

  return { valid: missing.length === 0, missing };
}

export function printSetupInstructions() {
  console.log(`
╔════════════════════════════════════════════════════════════════════╗
║              LAB 1: MANUAL INPUTS REQUIRED                         ║
╠════════════════════════════════════════════════════════════════════╣
║                                                                    ║
║  1. SPLUNK_DOWNLOAD_URL                                            ║
║     → Go to splunk.com → Free Splunk → Splunk Enterprise           ║
║     → Sign in → Linux → .tgz → Copy wget link                      ║
║     → This URL expires in ~10 minutes!                             ║
║                                                                    ║
║  2. SPLUNK_ADMIN_PASSWORD (optional, default: LabPassword123!)     ║
║                                                                    ║
║  Example:                                                          ║
║  export SPLUNK_DOWNLOAD_URL="https://download.splunk.com/..."      ║
║  npm test -- --grep "Lab 1"                                        ║
║                                                                    ║
╚════════════════════════════════════════════════════════════════════╝
  `);
}
