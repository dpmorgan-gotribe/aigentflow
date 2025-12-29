/**
 * Agent System
 *
 * Multi-agent framework for the orchestrator.
 */

// Base agent
export { BaseAgent } from './base-agent.js';

// Registry
export { AgentRegistry, getAgentRegistry, resetAgentRegistry } from './registry.js';

// Context manager
export { ContextManager, getContextManager, resetContextManager } from './context-manager.js';

// Core agents
export { OrchestratorAgent, createOrchestratorAgent } from './orchestrator.js';
export { ProjectManagerAgent, createProjectManagerAgent } from './project-manager.js';
export { ArchitectAgent, createArchitectAgent } from './architect.js';
export { AnalystAgent, createAnalystAgent } from './analyst.js';

// Types
export type {
  AgentType,
  AgentConfig,
  AgentResult,
  ExecutionContext,
  IAgent,
  AgentFactory,
  AgentMetadata,
  AgentRequest,
  AgentExecutionOptions,
  AgentLifecycleHooks,
  WBSOutput,
  ADROutput,
  AnalysisOutput,
  RoutingOutput,
} from './types.js';
