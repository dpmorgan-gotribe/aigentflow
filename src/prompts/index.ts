/**
 * Prompts
 *
 * Prompt building system for agent execution.
 */

// Prompt builder
export {
  PromptBuilder,
  getPromptBuilder,
  resetPromptBuilder,
} from './prompt-builder.js';

export type {
  PromptLayerType,
  PromptLayer,
  PromptBuilderConfig,
  AgentTemplate,
} from './prompt-builder.js';

// Templates
export {
  ORCHESTRATOR_TEMPLATE,
  PROJECT_MANAGER_TEMPLATE,
  ARCHITECT_TEMPLATE,
  ANALYST_TEMPLATE,
  getAgentTemplate,
  AGENT_TEMPLATES,
} from './templates/index.js';
