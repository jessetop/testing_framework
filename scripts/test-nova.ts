#!/usr/bin/env npx ts-node
/**
 * Quick test: verify Nova Lite is accessible via Bedrock Runtime
 */
import {
  BedrockRuntimeClient,
  InvokeModelCommand,
} from '@aws-sdk/client-bedrock-runtime';
import { fromIni } from '@aws-sdk/credential-providers';

async function main() {
  console.log('Testing Nova Lite access...');

  const client = new BedrockRuntimeClient({
    region: 'us-east-1',
    credentials: fromIni({ profile: 'roitraining' }),
  });

  const body = JSON.stringify({
    messages: [
      {
        role: 'user',
        content: [{ text: 'Say "hello" and nothing else.' }],
      },
    ],
    inferenceConfig: { maxTokens: 10 },
  });

  const command = new InvokeModelCommand({
    modelId: 'amazon.nova-lite-v1:0',
    contentType: 'application/json',
    accept: 'application/json',
    body: Buffer.from(body),
  });

  try {
    const response = await client.send(command);
    const result = JSON.parse(new TextDecoder().decode(response.body));
    console.log('Response:', JSON.stringify(result, null, 2));
    console.log('\n✅ Nova Lite is accessible!');
  } catch (err: any) {
    console.error('❌ Failed:', err.message);
    if (err.message.includes('AccessDeniedException')) {
      console.error('   → Enable Nova Lite model access in Bedrock console');
    }
  }
}

main();
