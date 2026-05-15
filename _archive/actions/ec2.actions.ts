import { Page } from '@playwright/test';
import { EC2Page } from '../pages/aws/ec2.page';
import { InstanceConnectPage } from '../pages/aws/instance-connect.page';

/**
 * High-level EC2 actions for lab testing
 * These wrap the page objects into simple, reusable operations
 */

export interface LaunchInstanceOptions {
  name: string;
  instanceType?: string;
  ami?: string;
  keyPair?: string;
  securityGroup?: string;
  region?: string;
}

export interface InstanceInfo {
  instanceId: string;
  publicIp: string | null;
  privateIp: string | null;
  state: string | null;
}

/**
 * Create (launch) a new EC2 instance through the console
 */
export async function createInstance(page: Page, options: LaunchInstanceOptions): Promise<string> {
  const region = options.region || process.env.AWS_REGION || 'us-east-1';
  const ec2 = new EC2Page(page, region);

  await ec2.goto();
  await ec2.openLaunchWizard();

  // Set instance name
  await ec2.setInstanceName(options.name);

  // Select AMI (default to Amazon Linux 2023)
  if (options.ami) {
    await ec2.selectAMI(options.ami);
  }

  // Select instance type (default to t2.micro for free tier)
  if (options.instanceType) {
    await ec2.selectInstanceType(options.instanceType);
  }

  // Select key pair if specified
  if (options.keyPair) {
    await ec2.selectKeyPair(options.keyPair);
  }

  // Select security group if specified
  if (options.securityGroup) {
    await ec2.selectSecurityGroup(options.securityGroup);
  }

  // Launch and return instance ID
  const instanceId = await ec2.launchInstance();
  return instanceId;
}

/**
 * Wait for instance to be running
 */
export async function waitForRunning(page: Page, instanceId: string, region?: string): Promise<void> {
  const ec2 = new EC2Page(page, region || process.env.AWS_REGION || 'us-east-1');
  await ec2.gotoInstances();
  await ec2.waitForInstanceState(instanceId, 'running');
}

/**
 * Wait for instance to be stopped
 */
export async function waitForStopped(page: Page, instanceId: string, region?: string): Promise<void> {
  const ec2 = new EC2Page(page, region || process.env.AWS_REGION || 'us-east-1');
  await ec2.gotoInstances();
  await ec2.waitForInstanceState(instanceId, 'stopped');
}

/**
 * Terminate an instance
 */
export async function terminateInstance(page: Page, instanceId: string, region?: string): Promise<void> {
  const ec2 = new EC2Page(page, region || process.env.AWS_REGION || 'us-east-1');
  await ec2.gotoInstances();
  await ec2.terminateInstance(instanceId);
}

/**
 * Get instance details (public IP, private IP, state)
 */
export async function getInstanceInfo(page: Page, instanceId: string, region?: string): Promise<InstanceInfo> {
  const ec2 = new EC2Page(page, region || process.env.AWS_REGION || 'us-east-1');
  await ec2.gotoInstances();
  const details = await ec2.getInstanceDetails(instanceId);
  return details;
}

/**
 * Connect to an instance via EC2 Instance Connect
 */
export async function connectToInstance(
  page: Page,
  instanceId: string,
  username: string = 'ec2-user'
): Promise<InstanceConnectPage> {
  const connect = new InstanceConnectPage(page);
  await connect.openConnectDialog(instanceId);
  await connect.connect(username);
  return connect;
}

/**
 * Run a command on an instance via Instance Connect
 * Returns the terminal output
 */
export async function runCommandOnInstance(
  page: Page,
  instanceId: string,
  command: string,
  username: string = 'ec2-user'
): Promise<string> {
  const connect = await connectToInstance(page, instanceId, username);
  const output = await connect.runCommand(command);
  return output;
}

/**
 * Run a command and verify expected output
 */
export async function runCommandAndExpect(
  page: Page,
  instanceId: string,
  command: string,
  expectedOutput: string,
  username: string = 'ec2-user'
): Promise<boolean> {
  const connect = await connectToInstance(page, instanceId, username);
  await connect.runCommandAndExpect(command, expectedOutput);
  return true;
}

/**
 * Convenience: Create instance and wait for it to be running
 */
export async function createAndWaitForInstance(page: Page, options: LaunchInstanceOptions): Promise<InstanceInfo> {
  const instanceId = await createInstance(page, options);
  await waitForRunning(page, instanceId, options.region);
  const info = await getInstanceInfo(page, instanceId, options.region);
  return info;
}

// Export as namespace for cleaner imports
export const ec2 = {
  createInstance,
  waitForRunning,
  waitForStopped,
  terminateInstance,
  getInstanceInfo,
  connectToInstance,
  runCommandOnInstance,
  runCommandAndExpect,
  createAndWaitForInstance,
};
