import { test, expect } from '../../fixtures/aws-fixture';
import { EC2LaunchWizardPage } from '../../pages/aws/ec2-launch-wizard.page';
import { InstanceConnectPage } from '../../pages/aws/instance-connect.page';
import { SplunkWebPage } from '../../pages/splunk/splunk-web.page';
import { lab1Config, validateConfig, printSetupInstructions } from './lab1.config';

/**
 * Lab 1: Manual Installation and Hardening
 *
 * Tests the full lab workflow:
 * - Task 1-3: Launch EC2 instance with security groups and storage
 * - Task 4-5: Connect and create service account
 * - Task 6-7: Download, install, and verify Splunk
 * - Task 8: Configure Splunkbase access
 * - Task 9-10: Configure systemd and test resiliency
 */

// Store state across tests
let instanceId: string;
let publicIp: string;

test.describe('Lab 1: Manual Installation and Hardening', () => {

  test.beforeAll(() => {
    // Validate config before running tests
    const { valid, missing } = validateConfig();
    if (!valid) {
      printSetupInstructions();
      throw new Error(`Missing required config: ${missing.join(', ')}`);
    }
  });

  // ============================================================
  // TASK 1-3: Launch EC2 Instance
  // ============================================================

  test('Task 1-3: Launch EC2 instance with correct configuration', async ({ awsPage }) => {
    const wizard = new EC2LaunchWizardPage(awsPage, lab1Config.instance.region);

    instanceId = await wizard.launchInstance({
      name: lab1Config.instance.name,
      ami: lab1Config.instance.ami,
      instanceType: lab1Config.instance.type,
      securityGroupName: lab1Config.securityGroup.name,
      securityGroupRules: lab1Config.securityGroup.rules,
      storageSizeGiB: lab1Config.instance.storageSizeGiB,
      storageType: lab1Config.instance.storageType,
    });

    expect(instanceId).toMatch(/^i-[a-z0-9]+$/);
    console.log(`✓ Launched instance: ${instanceId}`);
  });

  test('Task 3: Wait for instance to be running', async ({ awsPage }) => {
    // Navigate to instances and wait for running state
    const region = lab1Config.instance.region;
    await awsPage.goto(`https://${region}.console.aws.amazon.com/ec2/home?region=${region}#Instances:`);

    // Wait for running state (up to 3 minutes)
    await expect(async () => {
      await awsPage.locator('button[aria-label="Refresh"]').click();
      await awsPage.waitForTimeout(2000);
      const stateCell = awsPage.locator(`tr:has-text("${instanceId}") td:has-text("Running")`);
      expect(await stateCell.isVisible()).toBe(true);
    }).toPass({ timeout: 180000, intervals: [5000] });

    // Get public IP
    await awsPage.locator(`tr:has-text("${instanceId}")`).click();
    const ipText = await awsPage.locator('text=Public IPv4 address').locator('..').locator('span').last().textContent();
    publicIp = ipText?.trim() || '';

    expect(publicIp).toMatch(/^\d+\.\d+\.\d+\.\d+$/);
    console.log(`✓ Instance running with public IP: ${publicIp}`);
  });

  // ============================================================
  // TASK 4: Connect to Instance
  // ============================================================

  test('Task 4: Connect via EC2 Instance Connect', async ({ awsPage }) => {
    const connect = new InstanceConnectPage(awsPage);
    await connect.openConnectDialog(instanceId);
    await connect.connect('ec2-user');

    const isConnected = await connect.isConnected();
    expect(isConnected).toBe(true);
    console.log('✓ Connected via Instance Connect');
  });

  test('Task 4: Verify Amazon Linux 2023', async ({ awsPage }) => {
    const connect = new InstanceConnectPage(awsPage);
    await connect.openConnectDialog(instanceId);
    await connect.connect('ec2-user');

    await connect.runCommandAndExpect(
      'cat /etc/os-release',
      lab1Config.expected.osVersion
    );
    console.log('✓ Verified Amazon Linux 2023');
  });

  // ============================================================
  // TASK 5: Update System and Create Service Account
  // ============================================================

  test('Task 5: Update system packages', async ({ awsPage }) => {
    const connect = new InstanceConnectPage(awsPage);
    await connect.openConnectDialog(instanceId);
    await connect.connect('ec2-user');

    // This can take a while
    await connect.runCommandAndExpect(
      'sudo dnf update -y',
      'Complete!',
      120000 // 2 minute timeout
    );
    console.log('✓ System packages updated');
  });

  test('Task 5: Create splunk user and group', async ({ awsPage }) => {
    const connect = new InstanceConnectPage(awsPage);
    await connect.openConnectDialog(instanceId);
    await connect.connect('ec2-user');

    // Create group and user
    await connect.runCommand('sudo groupadd splunk');
    await connect.runCommand('sudo useradd -M -g splunk -s /bin/bash splunk');

    // Verify
    await connect.runCommandAndExpect('id splunk', 'splunk');
    console.log('✓ Splunk user and group created');
  });

  // ============================================================
  // TASK 6: Download and Install Splunk
  // ============================================================

  test('Task 6: Download Splunk Enterprise', async ({ awsPage }) => {
    const connect = new InstanceConnectPage(awsPage);
    await connect.openConnectDialog(instanceId);
    await connect.connect('ec2-user');

    // Change to /tmp
    await connect.runCommand('cd /tmp');

    // Download using the URL from config
    // Extract just the wget command portion
    const downloadUrl = lab1Config.splunkDownloadUrl;
    await connect.runCommandAndExpect(
      `wget -O splunk.tgz "${downloadUrl}"`,
      '100%',
      300000 // 5 minute timeout for ~1.6GB download
    );

    // Verify download size (~1.6GB)
    await connect.runCommandAndExpect('ls -lh /tmp/splunk.tgz', 'G');
    console.log('✓ Splunk Enterprise downloaded');
  });

  test('Task 6: Extract and configure Splunk', async ({ awsPage }) => {
    const connect = new InstanceConnectPage(awsPage);
    await connect.openConnectDialog(instanceId);
    await connect.connect('ec2-user');

    // Extract to /opt
    await connect.runCommandAndExpect(
      'sudo tar -xvzf /tmp/splunk.tgz -C /opt/',
      'splunk',
      120000 // 2 minute timeout
    );

    // Set home directory and ownership
    await connect.runCommand('sudo usermod -d /opt/splunk splunk');
    await connect.runCommand('sudo chown -R splunk:splunk /opt/splunk');

    // Verify ownership
    await connect.runCommandAndExpect('ls -la /opt/splunk/', 'splunk splunk');
    console.log('✓ Splunk extracted and ownership set');
  });

  // ============================================================
  // TASK 7: First-Time Startup
  // ============================================================

  test('Task 7: Start Splunk and create admin account', async ({ awsPage }) => {
    const connect = new InstanceConnectPage(awsPage);
    await connect.openConnectDialog(instanceId);
    await connect.connect('ec2-user');

    // Start Splunk (this will prompt for admin credentials)
    // Using --accept-license and providing credentials via stdin
    const password = lab1Config.splunkAdminPassword;
    await connect.runCommandAndExpect(
      `echo -e "admin\\n${password}\\n${password}" | sudo -u splunk /opt/splunk/bin/splunk start --accept-license`,
      'has started successfully',
      180000 // 3 minute timeout for first start
    );

    console.log('✓ Splunk started with admin account');
  });

  test('Task 7: Verify Splunk is running', async ({ awsPage }) => {
    const connect = new InstanceConnectPage(awsPage);
    await connect.openConnectDialog(instanceId);
    await connect.connect('ec2-user');

    await connect.runCommandAndExpect(
      'sudo -u splunk /opt/splunk/bin/splunk status',
      'splunkd is running'
    );
    console.log('✓ Splunk verified running');
  });

  test('Task 7: Access Splunk Web UI', async ({ browser }) => {
    // New context without AWS auth for Splunk
    const context = await browser.newContext();
    const page = await context.newPage();

    const splunk = new SplunkWebPage(page, publicIp, 8000);
    await splunk.login('admin', lab1Config.splunkAdminPassword);

    const isLoggedIn = await splunk.isLoggedIn();
    expect(isLoggedIn).toBe(true);

    await context.close();
    console.log('✓ Splunk Web UI accessible and login successful');
  });

  // ============================================================
  // TASK 8: Configure Splunkbase Authentication
  // ============================================================

  test('Task 8: Enable Splunkbase access', async ({ awsPage }) => {
    const connect = new InstanceConnectPage(awsPage);
    await connect.openConnectDialog(instanceId);
    await connect.connect('ec2-user');

    // Add allowInternetAccess to server.conf
    await connect.runCommand(`sudo -u splunk bash -c 'cat >> /opt/splunk/etc/system/local/server.conf << EOF

[applicationsManagement]
allowInternetAccess = true
EOF'`);

    // Restart Splunk
    await connect.runCommandAndExpect(
      'sudo -u splunk /opt/splunk/bin/splunk restart',
      'has started',
      120000
    );

    console.log('✓ Splunkbase access configured');
  });

  test('Task 8: Verify Splunkbase apps are accessible', async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();

    const splunk = new SplunkWebPage(page, publicIp, 8000);
    await splunk.login('admin', lab1Config.splunkAdminPassword);

    await splunk.gotoFindMoreApps();

    // Should see 900+ apps
    const appCount = await splunk.getAppCount();
    expect(appCount).toBeGreaterThanOrEqual(lab1Config.expected.minSplunkbaseApps);

    // Search for AWS add-on
    await splunk.searchApps('aws');
    const awsAppVisible = await splunk.isAppVisible('Splunk Add-on for Amazon Web Services');
    expect(awsAppVisible).toBe(true);

    await context.close();
    console.log(`✓ Splunkbase accessible with ${appCount}+ apps, AWS Add-on found`);
  });

  // ============================================================
  // TASK 9: Configure Systemd
  // ============================================================

  test('Task 9: Stop Splunk and create systemd service', async ({ awsPage }) => {
    const connect = new InstanceConnectPage(awsPage);
    await connect.openConnectDialog(instanceId);
    await connect.connect('ec2-user');

    // Stop Splunk
    await connect.runCommandAndExpect(
      'sudo -u splunk /opt/splunk/bin/splunk stop',
      'done',
      60000
    );

    // Create systemd service file
    await connect.runCommand(`sudo tee /etc/systemd/system/splunkd.service > /dev/null << 'EOF'
[Unit]
Description=Splunk Enterprise
After=network.target

[Service]
Type=forking
User=splunk
Group=splunk
ExecStart=/opt/splunk/bin/splunk start --accept-license --no-prompt --answer-yes
ExecStop=/opt/splunk/bin/splunk stop
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF`);

    // Enable and start
    await connect.runCommand('sudo systemctl daemon-reload');
    await connect.runCommand('sudo systemctl enable splunkd');
    await connect.runCommandAndExpect('sudo systemctl start splunkd', '', 60000);

    // Wait for Splunk to start
    await connect.page.waitForTimeout(15000);

    // Verify running
    await connect.runCommandAndExpect('sudo systemctl status splunkd', 'active (running)');
    console.log('✓ Systemd service configured and running');
  });

  // ============================================================
  // TASK 10: Resiliency Testing
  // ============================================================

  test('Task 10: Test crash recovery', async ({ awsPage }) => {
    const connect = new InstanceConnectPage(awsPage);
    await connect.openConnectDialog(instanceId);
    await connect.connect('ec2-user');

    // Kill Splunk process
    await connect.runCommand('sudo pkill -9 splunkd');

    // Wait for systemd to restart (RestartSec=10 + buffer)
    await connect.runCommand('sleep 15');

    // Verify it restarted
    await connect.runCommandAndExpect('sudo systemctl status splunkd', 'active (running)');
    console.log('✓ Crash recovery verified - Splunk auto-restarted');
  });

  test('Task 10: Test reboot recovery', async ({ awsPage }) => {
    const connect = new InstanceConnectPage(awsPage);
    await connect.openConnectDialog(instanceId);
    await connect.connect('ec2-user');

    // Reboot
    await connect.runCommand('sudo reboot');

    // Wait for reboot (2-3 minutes)
    await connect.page.waitForTimeout(180000);

    // Reconnect
    await connect.openConnectDialog(instanceId);
    await connect.connect('ec2-user');

    // Verify Splunk started on boot
    await connect.runCommandAndExpect('sudo systemctl status splunkd', 'active (running)');
    console.log('✓ Reboot recovery verified - Splunk started on boot');
  });

  test('Task 10: Verify Splunk Web accessible after reboot', async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();

    const splunk = new SplunkWebPage(page, publicIp, 8000);
    await splunk.goto();

    const onLogin = await splunk.isOnLoginPage();
    expect(onLogin).toBe(true);

    await context.close();
    console.log('✓ Splunk Web UI accessible after reboot');
  });

  // ============================================================
  // CLEANUP
  // ============================================================

  test.afterAll(async ({ browser }) => {
    if (instanceId && process.env.CLEANUP_AFTER_TEST === 'true') {
      console.log(`Terminating instance ${instanceId}...`);
      // Would terminate instance here
    } else {
      console.log(`
╔════════════════════════════════════════════════════════════════════╗
║  LAB 1 COMPLETE - Instance kept for Lab 2                          ║
╠════════════════════════════════════════════════════════════════════╣
║  Instance ID: ${instanceId.padEnd(42)}║
║  Public IP: ${publicIp.padEnd(44)}║
║  Splunk Web: http://${publicIp}:8000${' '.repeat(Math.max(0, 32 - publicIp.length))}║
║                                                                    ║
║  To terminate later:                                               ║
║  aws ec2 terminate-instances --instance-ids ${instanceId}           ║
╚════════════════════════════════════════════════════════════════════╝
      `);
    }
  });
});
