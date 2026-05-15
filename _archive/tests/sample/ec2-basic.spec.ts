import { test, expect } from '../../fixtures/aws-fixture';
import { ec2 } from '../../actions';

/**
 * Sample EC2 Lab Test
 *
 * This demonstrates how to use the framework to test a lab
 * that involves launching and connecting to an EC2 instance.
 */

test.describe('Sample Lab: Launch and Connect to EC2', () => {
  let instanceId: string;

  test('Step 1: Navigate to EC2 console', async ({ awsPage }) => {
    await awsPage.goto('https://us-east-1.console.aws.amazon.com/ec2/home?region=us-east-1');
    await expect(awsPage).toHaveURL(/.*ec2.*/);
  });

  test('Step 2: Launch an EC2 instance', async ({ awsPage }) => {
    instanceId = await ec2.createInstance(awsPage, {
      name: 'lab-test-instance',
      instanceType: 't2.micro',
      ami: 'Amazon Linux 2023',
      keyPair: 'lab-testing-key', // Must exist in your AWS account
    });

    expect(instanceId).toMatch(/^i-[a-z0-9]+$/);
    console.log(`Launched instance: ${instanceId}`);
  });

  test('Step 3: Wait for instance to be running', async ({ awsPage }) => {
    await ec2.waitForRunning(awsPage, instanceId);

    const info = await ec2.getInstanceInfo(awsPage, instanceId);
    expect(info.state).toContain('running');
    expect(info.publicIp).toBeTruthy();
  });

  test('Step 4: Connect via Instance Connect', async ({ awsPage }) => {
    const connect = await ec2.connectToInstance(awsPage, instanceId);

    // Verify we're connected
    const isConnected = await connect.isConnected();
    expect(isConnected).toBe(true);
  });

  test('Step 5: Run commands on the instance', async ({ awsPage }) => {
    const connect = await ec2.connectToInstance(awsPage, instanceId);

    // Run some basic commands
    await connect.runCommandAndExpect('hostname', 'ip-');
    await connect.runCommandAndExpect('whoami', 'ec2-user');
    await connect.runCommandAndExpect('cat /etc/os-release', 'Amazon Linux');
  });

  test.afterAll(async ({ browser }) => {
    // Cleanup: terminate the instance
    if (instanceId) {
      const context = await browser.newContext();
      const page = await context.newPage();
      await ec2.terminateInstance(page, instanceId);
      await context.close();
    }
  });
});
