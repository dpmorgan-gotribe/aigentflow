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

// Core agents (MVP)
export { OrchestratorAgent, createOrchestratorAgent } from './orchestrator.js';
export { ProjectManagerAgent, createProjectManagerAgent } from './project-manager.js';
export { ArchitectAgent, createArchitectAgent } from './architect.js';
export { AnalystAgent, createAnalystAgent } from './analyst.js';

// Phase 2 agents (v1.0)
export { ProjectAnalyzerAgent, createProjectAnalyzerAgent } from './project-analyzer.js';
export { ComplianceAgent, createComplianceAgent, type ComplianceAgentOutput } from './compliance-agent.js';
export { UIDesignerAgent, createUIDesignerAgent, type UIDesignerConfig } from './ui-designer.js';
export { GitAgent, createGitAgent } from './git-agent.js';

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
