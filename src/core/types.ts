/**
 * Core Types for State Machine
 *
 * Type definitions for workflow states, transitions, and execution.
 */

import type { AgentType, WorkflowState } from '../types.js';

// ============================================================================
// State Machine Types
// ============================================================================

/**
 * State metadata
 */
export interface StateMetadata {
  state: WorkflowState;
  description: string;
  isTerminal: boolean;
  allowedTransitions: WorkflowState[];
  requiresAgent?: AgentType;
  requiresApproval?: boolean;
  timeout?: number;
}

/**
 * Transition trigger types
 */
export type TransitionTrigger =
  | 'START'
  | 'AGENT_COMPLETE'
  | 'AGENT_ERROR'
  | 'APPROVAL_GRANTED'
  | 'APPROVAL_DENIED'
  | 'TIMEOUT'
  | 'ABORT'
  | 'RETRY'
  | 'ESCALATE'
  | 'RECOVER'
  | 'COMPLETE';

/**
 * Transition definition
 */
export interface TransitionDefinition {
  from: WorkflowState;
  to: WorkflowState;
  trigger: TransitionTrigger;
  guard?: (context: TransitionContext) => boolean;
  action?: (context: TransitionContext) => Promise<void>;
}

/**
 * Context passed during transitions
 */
export interface TransitionContext {
  taskId: string;
  fromState: WorkflowState;
  toState: WorkflowState;
  trigger: TransitionTrigger;
  agent?: AgentType;
  data?: Record<string, unknown>;
  error?: Error;
  retryCount?: number;
}

// ============================================================================
// Task Types
// ============================================================================

/**
 * Task status
 */
export type TaskStatus = 'pending' | 'running' | 'paused' | 'completed' | 'failed' | 'aborted';

/**
 * Task definition
 */
export interface Task {
  id: string;
  projectId: string;
  prompt: string;
  state: WorkflowState;
  status: TaskStatus;
  context: TaskContext;
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
}

/**
 * Task execution context
 */
export interface TaskContext {
  prompt: string;
  agentOutputs: Map<AgentType, AgentOutput>;
  currentAgent?: AgentType;
  retryCount: number;
  checkpointId?: string;
  approvalsPending: string[];
  lessonsApplied: string[];
  metadata: Record<string, unknown>;
}

/**
 * Agent output stored in context
 */
export interface AgentOutput {
  agentType: AgentType;
  success: boolean;
  output: unknown;
  error?: string;
  duration: number;
  tokensUsed: number;
  timestamp: Date;
  routingHint?: RoutingHint;
}

/**
 * Routing hint from agent
 */
export interface RoutingHint {
  suggestedNext?: AgentType;
  skipAgents?: AgentType[];
  reasoning?: string;
  confidence?: number;
}

// ============================================================================
// Agent Pool Types
// ============================================================================

/**
 * Agent instance in the pool
 */
export interface AgentInstance {
  id: string;
  type: AgentType;
  taskId: string;
  status: 'idle' | 'running' | 'completed' | 'failed';
  startedAt?: Date;
  completedAt?: Date;
}

/**
 * Agent pool statistics
 */
export interface PoolStats {
  total: number;
  active: number;
  idle: number;
  queued: number;
  byType: Map<AgentType, number>;
}

/**
 * Queued agent request
 */
export interface QueuedRequest {
  id: string;
  taskId: string;
  agentType: AgentType;
  priority: number;
  queuedAt: Date;
  context: Record<string, unknown>;
}

// ============================================================================
// Routing Types
// ============================================================================

/**
 * Task analysis result
 */
export interface TaskAnalysis {
  taskType: TaskType;
  complexity: 'low' | 'medium' | 'high';
  requiredAgents: AgentType[];
  optionalAgents: AgentType[];
  estimatedSteps: number;
  confidence: number;
}

/**
 * Task types for routing
 */
export type TaskType =
  | 'feature'
  | 'bug-fix'
  | 'refactor'
  | 'documentation'
  | 'research'
  | 'api-only'
  | 'ui-only'
  | 'full-stack'
  | 'unknown';

/**
 * Routing decision
 */
export interface RoutingDecision {
  nextAgent: AgentType;
  reasoning: string;
  confidence: number;
  alternativeAgents?: AgentType[];
  skipToState?: WorkflowState;
}

/**
 * Routing rule
 */
export interface RoutingRule {
  id: string;
  name: string;
  condition: (context: RoutingContext) => boolean;
  action: (context: RoutingContext) => RoutingDecision;
  priority: number;
}

/**
 * Context for routing decisions
 */
export interface RoutingContext {
  task: Task;
  analysis: TaskAnalysis;
  previousAgents: AgentType[];
  lastOutput?: AgentOutput;
  availableAgents: AgentType[];
}

// ============================================================================
// Event Types
// ============================================================================

/**
 * State machine events
 */
export type StateMachineEvent =
  | { type: 'TASK_STARTED'; taskId: string; prompt: string }
  | { type: 'STATE_CHANGED'; taskId: string; from: WorkflowState; to: WorkflowState }
  | { type: 'AGENT_STARTED'; taskId: string; agent: AgentType }
  | { type: 'AGENT_COMPLETED'; taskId: string; agent: AgentType; output: AgentOutput }
  | { type: 'AGENT_FAILED'; taskId: string; agent: AgentType; error: Error }
  | { type: 'APPROVAL_REQUESTED'; taskId: string; approvalId: string }
  | { type: 'APPROVAL_RESOLVED'; taskId: string; approvalId: string; approved: boolean }
  | { type: 'TASK_COMPLETED'; taskId: string }
  | { type: 'TASK_FAILED'; taskId: string; error: Error }
  | { type: 'TASK_ABORTED'; taskId: string };

/**
 * Event listener
 */
export type EventListener = (event: StateMachineEvent) => void | Promise<void>;

// ============================================================================
// Checkpoint Types
// ============================================================================

/**
 * Checkpoint data for recovery
 */
export interface CheckpointData {
  id: string;
  taskId: string;
  state: WorkflowState;
  context: TaskContext;
  timestamp: Date;
  trigger: string;
}

/**
 * Recovery options
 */
export interface RecoveryOptions {
  checkpointId?: string;
  fromState?: WorkflowState;
  resetRetryCount?: boolean;
}
