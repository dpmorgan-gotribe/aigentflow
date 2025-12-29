/**
 * Default Configuration
 *
 * Default values for all configuration options.
 */

import type { AgentType, ComplianceFramework } from '../types.js';

// ============================================================================
// Global Defaults
// ============================================================================

export const GLOBAL_DEFAULTS = {
  // Database
  database: {
    path: './orchestrator-data/aigentflow.sqlite',
    readonly: false,
  },

  // Logging
  logging: {
    level: 'info' as const,
    format: 'text' as const,
    file: null as string | null,
  },

  // Agent pool
  agentPool: {
    maxConcurrent: 15,
    defaultTimeout: 60000, // 1 minute
    maxRetries: 3,
  },

  // Workflow
  workflow: {
    approvalRequired: true,
    autoCheckpoint: true,
    checkpointInterval: 5, // Create checkpoint every 5 state transitions
  },

  // Model
  model: {
    provider: 'anthropic' as const,
    name: 'claude-sonnet-4-20250514',
    maxTokens: 8192,
    temperature: 0.7,
  },
} as const;

// ============================================================================
// Agent Defaults
// ============================================================================

interface AgentDefault {
  enabled: boolean;
  maxConcurrent: number;
  timeout: number;
  retryCount: number;
  model?: string;
}

export const AGENT_DEFAULTS: Record<AgentType, AgentDefault> = {
  orchestrator: {
    enabled: true,
    maxConcurrent: 1,
    timeout: 30000,
    retryCount: 0,
  },
  'project-manager': {
    enabled: true,
    maxConcurrent: 5,
    timeout: 60000,
    retryCount: 1,
  },
  architect: {
    enabled: true,
    maxConcurrent: 3,
    timeout: 60000,
    retryCount: 1,
  },
  analyst: {
    enabled: true,
    maxConcurrent: 5,
    timeout: 45000,
    retryCount: 2,
  },
  'ui-designer': {
    enabled: false, // Disabled in MVP
    maxConcurrent: 15, // Competitive design
    timeout: 90000,
    retryCount: 1,
  },
  'frontend-developer': {
    enabled: false, // Disabled in MVP
    maxConcurrent: 5,
    timeout: 120000,
    retryCount: 2,
  },
  'backend-developer': {
    enabled: false, // Disabled in MVP
    maxConcurrent: 5,
    timeout: 120000,
    retryCount: 2,
  },
  tester: {
    enabled: false, // Disabled in MVP
    maxConcurrent: 5,
    timeout: 180000,
    retryCount: 1,
  },
  'bug-fixer': {
    enabled: false, // Disabled in MVP
    maxConcurrent: 3,
    timeout: 120000,
    retryCount: 3, // Max 3 fix attempts
  },
  reviewer: {
    enabled: false, // Disabled in MVP
    maxConcurrent: 3,
    timeout: 60000,
    retryCount: 0,
  },
  'git-agent': {
    enabled: false, // Disabled in MVP
    maxConcurrent: 1,
    timeout: 30000,
    retryCount: 2,
  },
  'merge-resolver': {
    enabled: false, // Disabled in MVP
    maxConcurrent: 1,
    timeout: 60000,
    retryCount: 1,
  },
  'project-analyzer': {
    enabled: false, // Disabled in MVP
    maxConcurrent: 1,
    timeout: 120000,
    retryCount: 0,
  },
  'compliance-agent': {
    enabled: false, // Disabled in MVP
    maxConcurrent: 2,
    timeout: 45000,
    retryCount: 0,
  },
} as const;

// ============================================================================
// Project Defaults
// ============================================================================

export const PROJECT_DEFAULTS = {
  features: {
    gitWorktrees: false,
    parallelAgents: true,
    selfEvolution: false,
  },
  compliance: {
    frameworks: [] as ComplianceFramework[],
    strictMode: false,
  },
} as const;

// ============================================================================
// Hook Defaults
// ============================================================================

export const HOOK_DEFAULTS = {
  // Built-in hooks that are always enabled
  builtIn: [
    {
      name: 'audit-log',
      point: 'post_agent_execute' as const,
      enabled: true,
      priority: 100, // Run last
      handler: 'built-in:audit-log',
    },
    {
      name: 'secret-detection',
      point: 'pre_file_write' as const,
      enabled: true,
      priority: 0, // Run first
      handler: 'built-in:secret-detection',
    },
    {
      name: 'security-scan',
      point: 'security_scan' as const,
      enabled: true,
      priority: 0,
      handler: 'built-in:security-scan',
    },
  ],
} as const;

// ============================================================================
// Template Defaults
// ============================================================================

export const TEMPLATES = {
  default: {
    name: 'Default',
    description: 'Standard project setup',
    features: PROJECT_DEFAULTS.features,
    compliance: PROJECT_DEFAULTS.compliance,
  },
  enterprise: {
    name: 'Enterprise',
    description: 'Enterprise setup with compliance',
    features: {
      gitWorktrees: true,
      parallelAgents: true,
      selfEvolution: false,
    },
    compliance: {
      frameworks: ['SOC2'] as ComplianceFramework[],
      strictMode: true,
    },
  },
  minimal: {
    name: 'Minimal',
    description: 'Minimal setup for quick start',
    features: {
      gitWorktrees: false,
      parallelAgents: false,
      selfEvolution: false,
    },
    compliance: {
      frameworks: [] as ComplianceFramework[],
      strictMode: false,
    },
  },
} as const;

// ============================================================================
// Environment Overrides
// ============================================================================

/**
 * Get configuration from environment variables
 */
export function getEnvOverrides(): Partial<typeof GLOBAL_DEFAULTS> {
  const overrides: Record<string, unknown> = {};

  // Database path
  if (process.env.AIGENTFLOW_DB_PATH) {
    overrides.database = { path: process.env.AIGENTFLOW_DB_PATH };
  }

  // Log level
  if (process.env.LOG_LEVEL) {
    overrides.logging = { level: process.env.LOG_LEVEL };
  }

  // Model provider
  if (process.env.AIGENTFLOW_MODEL) {
    overrides.model = { name: process.env.AIGENTFLOW_MODEL };
  }

  return overrides as Partial<typeof GLOBAL_DEFAULTS>;
}

/**
 * Merge defaults with overrides
 */
export function mergeConfig<T extends Record<string, unknown>>(
  defaults: T,
  overrides: Partial<T>
): T {
  const result = { ...defaults };

  for (const [key, value] of Object.entries(overrides)) {
    if (value !== undefined) {
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        result[key as keyof T] = mergeConfig(
          defaults[key as keyof T] as Record<string, unknown>,
          value as Record<string, unknown>
        ) as T[keyof T];
      } else {
        result[key as keyof T] = value as T[keyof T];
      }
    }
  }

  return result;
}

// ============================================================================
// Flat DEFAULT_CONFIG for config repository
// ============================================================================

/**
 * Flat configuration object for use with config repository
 */
export const DEFAULT_CONFIG: Record<string, unknown> = {
  'agents.maxConcurrent': GLOBAL_DEFAULTS.agentPool.maxConcurrent,
  'agents.timeout': GLOBAL_DEFAULTS.agentPool.defaultTimeout,
  'agents.maxRetries': GLOBAL_DEFAULTS.agentPool.maxRetries,
  'workflow.approvalRequired': GLOBAL_DEFAULTS.workflow.approvalRequired,
  'workflow.autoCheckpoint': GLOBAL_DEFAULTS.workflow.autoCheckpoint,
  'compliance.strictMode': PROJECT_DEFAULTS.compliance.strictMode,
  'features.gitWorktrees': PROJECT_DEFAULTS.features.gitWorktrees,
  'features.parallelAgents': PROJECT_DEFAULTS.features.parallelAgents,
  'features.selfEvolution': PROJECT_DEFAULTS.features.selfEvolution,
  'model.provider': GLOBAL_DEFAULTS.model.provider,
  'model.name': GLOBAL_DEFAULTS.model.name,
  'model.maxTokens': GLOBAL_DEFAULTS.model.maxTokens,
  'model.temperature': GLOBAL_DEFAULTS.model.temperature,
  'logging.level': GLOBAL_DEFAULTS.logging.level,
  'logging.format': GLOBAL_DEFAULTS.logging.format,
};
