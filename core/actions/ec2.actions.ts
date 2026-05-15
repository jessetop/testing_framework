import { Page } from '@playwright/test';
import { EC2Page } from '../pages/aws/ec2.page';
import { InstanceConnectPage } from '../pages/aws/instance-connect.page';

/**
 * High-level EC2 actions for lab testing
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

export async function waitForRunning(page: Page, instanceId: string, region?: string): Promise<void> {
  const ec2 = new EC2Page(page, region || process.env.AWS_REGION || 'us-east-1');
  await ec2.gotoInstances();
  await ec2.waitForInstanceState(instanceId, 'running');
}

export async function waitForStopped(page: Page, instanceId: string, region?: string): Promise<void> {
  const ec2 = new EC2Page(page, region || process.env.AWS_REGION || 'us-east-1');
  await ec2.gotoInstances();
  await ec2.waitForInstanceState(instanceId, 'stopped');
}

export async function terminateInstance(page: Page, instanceId: string, region?: string): Promise<void> {
  const ec2 = new EC2Page(page, region || process.env.AWS_REGION || 'us-east-1');
  await ec2.gotoInstances();
  await ec2.terminateInstance(instanceId);
}

export async function getInstanceInfo(page: Page, instanceId: string, region?: string): Promise<InstanceInfo> {
  const ec2 = new EC2Page(page, region || process.env.AWS_REGION || 'us-east-1');
  await ec2.gotoInstances();
  return await ec2.getInstanceDetails(instanceId);
}

export async function connectToInstance(
  page: Page,
  instanceId: string,
  username: string = 'ec2-user',
  region?: string
): Promise<InstanceConnectPage> {
  const connect = new InstanceConnectPage(page);
  await connect.openConnectDialog(instanceId, region);
  await connect.connect(username);
  return connect;
}

export async function runCommandOnInstance(
  page: Page,
  instanceId: string,
  command: string,
  username: string = 'ec2-user',
  region?: string
): Promise<string> {
  const connect = await connectToInstance(page, instanceId, username, region);
  return await connect.runCommand(command);
}

export const ec2 = {
  waitForRunning,
  waitForStopped,
  terminateInstance,
  getInstanceInfo,
  connectToInstance,
  runCommandOnInstance,
};
