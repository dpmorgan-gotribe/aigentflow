/**
 * Core type definitions for Aigentflow
 *
 * This file contains all shared type definitions used across the system.
 */

// ============================================================================
// Workflow States
// ============================================================================

/**
 * All possible workflow states in the state machine
 */
export type WorkflowState =
  | 'IDLE'
  | 'ANALYZING'
  | 'ORCHESTRATING'
  | 'PLANNING'
  | 'ARCHITECTING'
  | 'DESIGNING'
  | 'BUILDING'
  | 'TESTING'
  | 'FIXING'
  | 'REVIEWING'
  | 'AGENT_WORKING'
  | 'AGENT_COMPLETE'
  | 'AWAITING_APPROVAL'
  | 'COMPLETING'
  | 'COMPLETED'
  | 'ERROR'
  | 'ABORTED'
  | 'ESCALATED'
  | 'RECOVERING';

/**
 * Agent types available in the system
 */
export type AgentType =
  | 'orchestrator'
  | 'project-manager'
  | 'architect'
  | 'analyst'
  | 'ui-designer'
  | 'frontend-developer'
  | 'backend-developer'
  | 'tester'
  | 'bug-fixer'
  | 'reviewer'
  | 'git-agent'
  | 'merge-resolver'
  | 'project-analyzer'
  | 'compliance-agent';

// ============================================================================
// Agent Configuration
// ============================================================================

/**
 * Configuration for an agent
 */
export interface AgentConfig {
  type: AgentType;
  enabled: boolean;
  maxConcurrent: number;
  timeout: number;
  retryCount: number;
  model?: string;
}

/**
 * Result from an agent execution
 */
export interface AgentResult {
  success: boolean;
  output: unknown;
  error?: string;
  metrics: {
    duration: number;
    tokensUsed: number;
    retries: number;
  };
  routingHint?: {
    nextAgent?: AgentType;
    reasoning?: string;
  };
}

// ============================================================================
// Hook System
// ============================================================================

/**
 * Hook execution points in the lifecycle
 */
export type HookPoint =
  | 'pre_orchestrator'
  | 'post_orchestrator'
  | 'pre_agent_select'
  | 'post_agent_select'
  | 'pre_agent_execute'
  | 'post_agent_execute'
  | 'pre_file_write'
  | 'post_file_write'
  | 'pre_git_commit'
  | 'post_git_commit'
  | 'security_scan'
  | 'compliance_check'
  | 'on_error'
  | 'on_retry'
  | 'on_escalation';

/**
 * Hook configuration
 */
export interface HookConfig {
  name: string;
  point: HookPoint;
  enabled: boolean;
  priority: number;
  handler: string; // Path to handler or built-in name
}

/**
 * Result of hook execution
 */
export interface HookResult {
  hookName: string;
  success: boolean;
  blocked: boolean;
  message?: string;
  data?: unknown;
}

// ============================================================================
// Project Configuration
// ============================================================================

/**
 * Compliance framework types
 */
export type ComplianceFramework = 'SOC2' | 'GDPR' | 'HIPAA' | 'PCI-DSS' | 'NONE';

/**
 * Project configuration
 */
export interface ProjectConfig {
  name: string;
  version: string;
  description?: string;
  path: string;
  createdAt: string;
  updatedAt: string;

  // Feature configuration
  features: {
    gitWorktrees: boolean;
    parallelAgents: boolean;
    selfEvolution: boolean;
  };

  // Compliance settings
  compliance: {
    frameworks: ComplianceFramework[];
    strictMode: boolean;
  };

  // Agent overrides
  agents: Partial<Record<AgentType, Partial<AgentConfig>>>;

  // Hook overrides
  hooks: HookConfig[];
}

// ============================================================================
// Execution Context
// ============================================================================

/**
 * Context passed to agents during execution
 */
export interface ExecutionContext {
  taskId: string;
  projectConfig: ProjectConfig;
  currentState: WorkflowState;
  previousOutputs: Map<AgentType, AgentResult>;
  lessonsLearned: string[];
  designTokens?: Record<string, unknown>;
  userFlows?: unknown[];
  sourceCode?: Map<string, string>;
  gitStatus?: {
    branch: string;
    worktree?: string;
    hasChanges: boolean;
  };
}

// ============================================================================
// State Transitions
// ============================================================================

/**
 * A state transition record
 */
export interface StateTransition {
  id: string;
  taskId: string;
  fromState: WorkflowState;
  toState: WorkflowState;
  trigger: string;
  agent?: AgentType;
  metadata?: Record<string, unknown>;
  timestamp: string;
}

/**
 * Checkpoint for recovery
 */
export interface Checkpoint {
  id: string;
  taskId: string;
  state: WorkflowState;
  context: ExecutionContext;
  timestamp: string;
}

// ============================================================================
// Audit Logging
// ============================================================================

/**
 * Audit log severity levels
 */
export type AuditSeverity = 'INFO' | 'WARN' | 'ERROR' | 'CRITICAL';

/**
 * Audit log categories
 */
export type AuditCategory =
  | 'STATE_CHANGE'
  | 'AGENT_EXECUTION'
  | 'USER_ACTION'
  | 'SECURITY'
  | 'COMPLIANCE'
  | 'ERROR';

/**
 * Audit log entry
 */
export interface AuditLogEntry {
  id: string;
  timestamp: string;
  category: AuditCategory;
  severity: AuditSeverity;
  action: string;
  actor: string;
  taskId?: string;
  agentType?: AgentType;
  details: Record<string, unknown>;
  checksum: string;
}

// ============================================================================
// Feature Flags
// ============================================================================

/**
 * Feature flag definition
 */
export interface FeatureFlag {
  key: string;
  enabled: boolean;
  description?: string;
  phase: 'mvp' | 'v1' | 'v2' | 'enterprise';
}

/**
 * Feature flag context for evaluation
 */
export interface FlagContext {
  userId?: string;
  projectId?: string;
  environment?: 'development' | 'staging' | 'production';
  attributes?: Record<string, string | number | boolean>;
}
