/**
 * Anthropic on Bedrock - Page Objects
 */

export { BedrockPlaygroundPage } from './bedrock-playground.page';
export type { PlaygroundMetrics } from './bedrock-playground.page';

export { BedrockKnowledgeBasePage } from './bedrock-knowledge-base.page';
export type { KnowledgeBaseConfig, RAGQueryResult } from './bedrock-knowledge-base.page';

export { BedrockGuardrailsPage } from './bedrock-guardrails.page';
export type {
  GuardrailConfig,
  ContentFilterConfig,
  DeniedTopicConfig,
  PIIFilterConfig,
  GuardrailInfo,
} from './bedrock-guardrails.page';

export { CloudWatchDashboardPage } from './cloudwatch-dashboard.page';
export type { DashboardWidget, DashboardInfo } from './cloudwatch-dashboard.page';

// SAM deployment is handled via CLI in test specs - see sam-deployment.page.ts for details
