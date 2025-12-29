/**
 * Agent Types
 *
 * Extended types for the agent framework.
 */

import type { AgentType, AgentConfig, AgentResult, ExecutionContext } from '../types.js';

/**
 * Agent execution request
 */
export interface AgentRequest {
  /** Unique request ID */
  id: string;
  /** Task this request belongs to */
  taskId: string;
  /** Type of agent to execute */
  agentType: AgentType;
  /** The prompt/instruction for the agent */
  prompt: string;
  /** Execution context */
  context: ExecutionContext;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Agent execution options
 */
export interface AgentExecutionOptions {
  /** Override timeout */
  timeout?: number;
  /** Override retry count */
  maxRetries?: number;
  /** Model to use */
  model?: string;
  /** Temperature for generation */
  temperature?: number;
  /** Max tokens */
  maxTokens?: number;
  /** Dry run mode (don't actually execute) */
  dryRun?: boolean;
}

/**
 * Agent metadata for registration
 */
export interface AgentMetadata {
  /** Agent type identifier */
  type: AgentType;
  /** Human-readable name */
  name: string;
  /** Description of agent capabilities */
  description: string;
  /** MVP phase this agent is available in */
  phase: 'mvp' | 'v1.0' | 'v2.0' | 'enterprise';
  /** Default configuration */
  defaultConfig: Partial<AgentConfig>;
  /** Capabilities this agent provides */
  capabilities: string[];
  /** Workflow states this agent can operate in */
  validStates: string[];
}

/**
 * Agent interface that all agents must implement
 */
export interface IAgent {
  /** Agent metadata */
  readonly metadata: AgentMetadata;

  /** Execute the agent with given request */
  execute(request: AgentRequest, options?: AgentExecutionOptions): Promise<AgentResult>;

  /** Validate the request before execution */
  validate(request: AgentRequest): Promise<boolean>;

  /** Get agent capabilities */
  getCapabilities(): string[];

  /** Check if agent can handle a specific task type */
  canHandle(taskType: string, context: ExecutionContext): boolean;
}

/**
 * Agent factory function type
 */
export type AgentFactory = () => IAgent;

/**
 * Agent lifecycle hooks
 */
export interface AgentLifecycleHooks {
  /** Called before agent execution starts */
  beforeExecute?: (request: AgentRequest) => Promise<void>;
  /** Called after agent execution completes */
  afterExecute?: (request: AgentRequest, result: AgentResult) => Promise<void>;
  /** Called when agent encounters an error */
  onError?: (request: AgentRequest, error: Error) => Promise<void>;
  /** Called before retry */
  beforeRetry?: (request: AgentRequest, attempt: number) => Promise<void>;
}

/**
 * Agent output types
 */
export interface WBSOutput {
  tasks: Array<{
    id: string;
    name: string;
    description: string;
    dependencies: string[];
    estimatedComplexity: 'low' | 'medium' | 'high';
    assignedAgent?: AgentType;
  }>;
  summary: string;
}

export interface ADROutput {
  title: string;
  status: 'proposed' | 'accepted' | 'deprecated' | 'superseded';
  context: string;
  decision: string;
  consequences: string[];
  alternatives: Array<{
    option: string;
    pros: string[];
    cons: string[];
  }>;
}

export interface AnalysisOutput {
  findings: Array<{
    category: string;
    finding: string;
    severity: 'info' | 'warning' | 'critical';
    recommendation?: string;
  }>;
  summary: string;
  recommendations: string[];
}

export interface RoutingOutput {
  nextAgent: AgentType;
  reasoning: string;
  confidence: number;
  alternativeAgents?: AgentType[];
}

// Re-export base types
export type { AgentType, AgentConfig, AgentResult, ExecutionContext };
