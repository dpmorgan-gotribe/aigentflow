# Step 04a: Hooks & Guardrails System

> **Checkpoint:** CP0 - Foundation
> **Previous Step:** 04-PERSISTENCE-LAYER.md
> **Next Step:** 04b-CLAUDE-MD-GENERATOR.md

---

## Overview

This step implements the **hooks and guardrails system** that ensures security, compliance, and extensibility throughout the agent lifecycle. Hooks allow custom behavior injection at key points, while guardrails prevent harmful outputs.

Key responsibilities:
- Define hook points across the agent lifecycle
- Implement guardrail validation for inputs and outputs
- Enable custom hook registration
- Provide security scanning for code outputs
- Support compliance rule enforcement

---

## Deliverables

1. `src/hooks/hook-manager.ts` - Central hook management
2. `src/hooks/hook-types.ts` - Hook type definitions
3. `src/hooks/builtin-hooks.ts` - Built-in hook implementations
4. `src/guardrails/guardrail-manager.ts` - Guardrail validation
5. `src/guardrails/input-guardrails.ts` - Input validation rules
6. `src/guardrails/output-guardrails.ts` - Output validation rules
7. `src/guardrails/code-guardrails.ts` - Code security scanning

---

## Hook Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           HOOK LIFECYCLE                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────┐                                                            │
│  │ USER INPUT  │                                                            │
│  └──────┬──────┘                                                            │
│         │                                                                    │
│         ▼                                                                    │
│  ┌─────────────────────┐                                                    │
│  │ pre_orchestrator    │ → Validate input, check permissions                │
│  └──────────┬──────────┘                                                    │
│             │                                                                │
│             ▼                                                                │
│  ┌─────────────────────┐                                                    │
│  │ pre_agent_select    │ → Modify routing, inject context                   │
│  └──────────┬──────────┘                                                    │
│             │                                                                │
│             ▼                                                                │
│  ┌─────────────────────┐                                                    │
│  │ pre_agent_execute   │ → Validate agent context, check constraints        │
│  └──────────┬──────────┘                                                    │
│             │                                                                │
│             ▼                                                                │
│       ┌─────────────┐                                                       │
│       │   AGENT     │                                                       │
│       │  EXECUTION  │                                                       │
│       └──────┬──────┘                                                       │
│              │                                                               │
│              ▼                                                               │
│  ┌─────────────────────┐                                                    │
│  │ post_agent_execute  │ → Validate output, extract lessons                 │
│  └──────────┬──────────┘                                                    │
│             │                                                                │
│             ▼                                                                │
│  ┌─────────────────────┐                                                    │
│  │ pre_file_write      │ → Security scan, compliance check                  │
│  └──────────┬──────────┘                                                    │
│             │                                                                │
│             ▼                                                                │
│  ┌─────────────────────┐                                                    │
│  │ post_file_write     │ → Audit log, trigger tests                         │
│  └──────────┬──────────┘                                                    │
│             │                                                                │
│             ▼                                                                │
│  ┌─────────────────────┐                                                    │
│  │ post_orchestrator   │ → Final validation, cleanup                        │
│  └─────────────────────┘                                                    │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 1. Hook Types (`src/hooks/hook-types.ts`)

```typescript
/**
 * Hook Types
 *
 * Defines all hook points and their payloads.
 */

import { AgentType, AgentOutput, AgentContext } from '../agents/types';
import { TaskAnalysis } from '../state/types';

/**
 * All available hook points
 */
export type HookPoint =
  // Orchestrator lifecycle
  | 'pre_orchestrator'
  | 'post_orchestrator'

  // Agent lifecycle
  | 'pre_agent_select'
  | 'post_agent_select'
  | 'pre_agent_execute'
  | 'post_agent_execute'

  // File operations
  | 'pre_file_write'
  | 'post_file_write'
  | 'pre_file_read'

  // Git operations
  | 'pre_git_commit'
  | 'post_git_commit'
  | 'pre_git_merge'
  | 'post_git_merge'

  // Approval workflow
  | 'pre_approval_request'
  | 'post_approval_response'

  // Learning
  | 'post_lesson_extract'
  | 'pre_lesson_apply'

  // Security
  | 'security_scan'
  | 'compliance_check'

  // Error handling
  | 'on_error'
  | 'on_retry'
  | 'on_escalation';

/**
 * Hook result - can modify, block, or pass through
 */
export interface HookResult<T = unknown> {
  action: 'continue' | 'modify' | 'block' | 'skip';
  data?: T;
  reason?: string;
  warnings?: string[];
}

/**
 * Base hook payload
 */
export interface BaseHookPayload {
  timestamp: Date;
  executionId: string;
  projectId: string;
}

/**
 * Pre-orchestrator payload
 */
export interface PreOrchestratorPayload extends BaseHookPayload {
  userInput: string;
  sessionContext: Record<string, unknown>;
}

/**
 * Post-orchestrator payload
 */
export interface PostOrchestratorPayload extends BaseHookPayload {
  result: unknown;
  agentsExecuted: AgentType[];
  totalDuration: number;
  success: boolean;
}

/**
 * Pre-agent-select payload
 */
export interface PreAgentSelectPayload extends BaseHookPayload {
  task: TaskAnalysis;
  suggestedAgents: AgentType[];
  previousOutputs: AgentOutput[];
}

/**
 * Pre-agent-execute payload
 */
export interface PreAgentExecutePayload extends BaseHookPayload {
  agentType: AgentType;
  context: AgentContext;
  task: TaskAnalysis;
}

/**
 * Post-agent-execute payload
 */
export interface PostAgentExecutePayload extends BaseHookPayload {
  agentType: AgentType;
  output: AgentOutput;
  duration: number;
}

/**
 * Pre-file-write payload
 */
export interface PreFileWritePayload extends BaseHookPayload {
  filePath: string;
  content: string;
  agentType: AgentType;
  operation: 'create' | 'update' | 'delete';
}

/**
 * Post-file-write payload
 */
export interface PostFileWritePayload extends BaseHookPayload {
  filePath: string;
  agentType: AgentType;
  operation: 'create' | 'update' | 'delete';
  success: boolean;
}

/**
 * Pre-git-commit payload
 */
export interface PreGitCommitPayload extends BaseHookPayload {
  message: string;
  files: string[];
  branch: string;
  agentType: AgentType;
}

/**
 * Security scan payload
 */
export interface SecurityScanPayload extends BaseHookPayload {
  content: string;
  contentType: 'code' | 'config' | 'data';
  filePath?: string;
  language?: string;
}

/**
 * Compliance check payload
 */
export interface ComplianceCheckPayload extends BaseHookPayload {
  action: string;
  data: unknown;
  requirements: string[];
}

/**
 * Error payload
 */
export interface ErrorPayload extends BaseHookPayload {
  error: Error;
  agentType?: AgentType;
  context: Record<string, unknown>;
  recoverable: boolean;
}

/**
 * Hook handler function type
 */
export type HookHandler<P extends BaseHookPayload = BaseHookPayload> = (
  payload: P
) => Promise<HookResult>;

/**
 * Hook registration
 */
export interface HookRegistration {
  id: string;
  point: HookPoint;
  handler: HookHandler;
  priority: number;  // Lower = runs first
  enabled: boolean;
  description: string;
  source: 'builtin' | 'plugin' | 'user';
}

/**
 * Hook configuration
 */
export interface HookConfig {
  enabled: boolean;
  timeout: number;
  failureMode: 'block' | 'warn' | 'ignore';
  maxRetries: number;
}
```

---

## 2. Hook Manager (`src/hooks/hook-manager.ts`)

```typescript
/**
 * Hook Manager
 *
 * Central management for all hooks in the system.
 */

import {
  HookPoint,
  HookHandler,
  HookResult,
  HookRegistration,
  HookConfig,
  BaseHookPayload,
} from './hook-types';
import { logger } from '../utils/logger';
import { EventEmitter } from 'events';

/**
 * Default hook configuration
 */
const DEFAULT_CONFIG: HookConfig = {
  enabled: true,
  timeout: 5000,
  failureMode: 'warn',
  maxRetries: 1,
};

/**
 * Hook Manager class
 */
export class HookManager extends EventEmitter {
  private hooks: Map<HookPoint, HookRegistration[]> = new Map();
  private config: HookConfig;
  private executionStats: Map<string, { calls: number; failures: number; avgDuration: number }> = new Map();

  constructor(config: Partial<HookConfig> = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.initializeHookPoints();
  }

  /**
   * Initialize all hook points
   */
  private initializeHookPoints(): void {
    const points: HookPoint[] = [
      'pre_orchestrator', 'post_orchestrator',
      'pre_agent_select', 'post_agent_select',
      'pre_agent_execute', 'post_agent_execute',
      'pre_file_write', 'post_file_write', 'pre_file_read',
      'pre_git_commit', 'post_git_commit',
      'pre_git_merge', 'post_git_merge',
      'pre_approval_request', 'post_approval_response',
      'post_lesson_extract', 'pre_lesson_apply',
      'security_scan', 'compliance_check',
      'on_error', 'on_retry', 'on_escalation',
    ];

    for (const point of points) {
      this.hooks.set(point, []);
    }
  }

  /**
   * Register a hook
   */
  register(registration: Omit<HookRegistration, 'enabled'> & { enabled?: boolean }): void {
    const point = registration.point;
    const hooks = this.hooks.get(point);

    if (!hooks) {
      throw new Error(`Invalid hook point: ${point}`);
    }

    const fullRegistration: HookRegistration = {
      ...registration,
      enabled: registration.enabled ?? true,
    };

    // Insert in priority order
    const insertIndex = hooks.findIndex(h => h.priority > fullRegistration.priority);
    if (insertIndex === -1) {
      hooks.push(fullRegistration);
    } else {
      hooks.splice(insertIndex, 0, fullRegistration);
    }

    logger.debug(`Registered hook: ${registration.id} at ${point} (priority: ${registration.priority})`);
    this.emit('hook:registered', fullRegistration);
  }

  /**
   * Unregister a hook by ID
   */
  unregister(hookId: string): boolean {
    for (const [point, hooks] of this.hooks) {
      const index = hooks.findIndex(h => h.id === hookId);
      if (index !== -1) {
        hooks.splice(index, 1);
        logger.debug(`Unregistered hook: ${hookId}`);
        this.emit('hook:unregistered', hookId);
        return true;
      }
    }
    return false;
  }

  /**
   * Execute all hooks for a point
   */
  async execute<P extends BaseHookPayload>(
    point: HookPoint,
    payload: P
  ): Promise<HookResult<P>> {
    if (!this.config.enabled) {
      return { action: 'continue', data: payload };
    }

    const hooks = this.hooks.get(point);
    if (!hooks || hooks.length === 0) {
      return { action: 'continue', data: payload };
    }

    let currentPayload = payload;
    const warnings: string[] = [];

    for (const hook of hooks) {
      if (!hook.enabled) continue;

      const startTime = Date.now();

      try {
        const result = await this.executeHook(hook, currentPayload);
        this.recordExecution(hook.id, Date.now() - startTime, false);

        switch (result.action) {
          case 'block':
            logger.warn(`Hook ${hook.id} blocked execution: ${result.reason}`);
            this.emit('hook:blocked', { hook, result });
            return {
              action: 'block',
              reason: result.reason,
              warnings: [...warnings, ...(result.warnings || [])],
            };

          case 'skip':
            // Skip remaining hooks
            return {
              action: 'continue',
              data: currentPayload,
              warnings: [...warnings, ...(result.warnings || [])],
            };

          case 'modify':
            if (result.data) {
              currentPayload = result.data as P;
            }
            if (result.warnings) {
              warnings.push(...result.warnings);
            }
            break;

          case 'continue':
          default:
            if (result.warnings) {
              warnings.push(...result.warnings);
            }
            break;
        }
      } catch (error) {
        this.recordExecution(hook.id, Date.now() - startTime, true);
        const errorMsg = error instanceof Error ? error.message : String(error);

        switch (this.config.failureMode) {
          case 'block':
            logger.error(`Hook ${hook.id} failed, blocking: ${errorMsg}`);
            return {
              action: 'block',
              reason: `Hook failure: ${errorMsg}`,
              warnings,
            };

          case 'warn':
            logger.warn(`Hook ${hook.id} failed: ${errorMsg}`);
            warnings.push(`Hook ${hook.id} failed: ${errorMsg}`);
            break;

          case 'ignore':
            logger.debug(`Hook ${hook.id} failed (ignored): ${errorMsg}`);
            break;
        }
      }
    }

    return {
      action: 'continue',
      data: currentPayload,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  }

  /**
   * Execute a single hook with timeout
   */
  private async executeHook<P extends BaseHookPayload>(
    hook: HookRegistration,
    payload: P
  ): Promise<HookResult> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Hook ${hook.id} timed out after ${this.config.timeout}ms`));
      }, this.config.timeout);

      hook.handler(payload)
        .then(result => {
          clearTimeout(timeout);
          resolve(result);
        })
        .catch(error => {
          clearTimeout(timeout);
          reject(error);
        });
    });
  }

  /**
   * Record execution statistics
   */
  private recordExecution(hookId: string, duration: number, failed: boolean): void {
    const stats = this.executionStats.get(hookId) || { calls: 0, failures: 0, avgDuration: 0 };
    stats.calls++;
    if (failed) stats.failures++;
    stats.avgDuration = (stats.avgDuration * (stats.calls - 1) + duration) / stats.calls;
    this.executionStats.set(hookId, stats);
  }

  /**
   * Enable/disable a hook
   */
  setEnabled(hookId: string, enabled: boolean): boolean {
    for (const hooks of this.hooks.values()) {
      const hook = hooks.find(h => h.id === hookId);
      if (hook) {
        hook.enabled = enabled;
        logger.debug(`Hook ${hookId} ${enabled ? 'enabled' : 'disabled'}`);
        return true;
      }
    }
    return false;
  }

  /**
   * Get all registered hooks
   */
  getHooks(point?: HookPoint): HookRegistration[] {
    if (point) {
      return [...(this.hooks.get(point) || [])];
    }
    return Array.from(this.hooks.values()).flat();
  }

  /**
   * Get execution statistics
   */
  getStats(): Map<string, { calls: number; failures: number; avgDuration: number }> {
    return new Map(this.executionStats);
  }

  /**
   * Clear all hooks
   */
  clear(): void {
    for (const hooks of this.hooks.values()) {
      hooks.length = 0;
    }
    this.executionStats.clear();
    logger.info('Cleared all hooks');
  }
}

/**
 * Singleton hook manager instance
 */
let hookManagerInstance: HookManager | null = null;

export function getHookManager(): HookManager {
  if (!hookManagerInstance) {
    hookManagerInstance = new HookManager();
  }
  return hookManagerInstance;
}

export function resetHookManager(): void {
  hookManagerInstance = null;
}
```

---

## 3. Built-in Hooks (`src/hooks/builtin-hooks.ts`)

```typescript
/**
 * Built-in Hooks
 *
 * Default hooks that provide core functionality.
 */

import { HookManager } from './hook-manager';
import {
  PreFileWritePayload,
  SecurityScanPayload,
  PreGitCommitPayload,
  PostAgentExecutePayload,
  ErrorPayload,
  HookResult,
} from './hook-types';
import { scanForSecrets } from '../guardrails/code-guardrails';
import { logger } from '../utils/logger';

/**
 * Register all built-in hooks
 */
export function registerBuiltinHooks(manager: HookManager): void {
  // Secret detection hook
  manager.register({
    id: 'builtin:secret-detection',
    point: 'pre_file_write',
    priority: 10,
    description: 'Scans files for secrets before writing',
    source: 'builtin',
    handler: async (payload: PreFileWritePayload): Promise<HookResult> => {
      const secrets = scanForSecrets(payload.content);

      if (secrets.length > 0) {
        logger.error(`Secrets detected in ${payload.filePath}:`, secrets);
        return {
          action: 'block',
          reason: `Potential secrets detected: ${secrets.map(s => s.type).join(', ')}`,
        };
      }

      return { action: 'continue' };
    },
  });

  // Code security scan hook
  manager.register({
    id: 'builtin:code-security-scan',
    point: 'security_scan',
    priority: 20,
    description: 'Scans code for security vulnerabilities',
    source: 'builtin',
    handler: async (payload: SecurityScanPayload): Promise<HookResult> => {
      if (payload.contentType !== 'code') {
        return { action: 'continue' };
      }

      const vulnerabilities = scanForVulnerabilities(payload.content, payload.language);
      const warnings = vulnerabilities.map(v => `${v.type}: ${v.description}`);

      if (vulnerabilities.some(v => v.severity === 'critical')) {
        return {
          action: 'block',
          reason: 'Critical security vulnerabilities detected',
          warnings,
        };
      }

      return {
        action: 'continue',
        warnings: warnings.length > 0 ? warnings : undefined,
      };
    },
  });

  // Commit message validation hook
  manager.register({
    id: 'builtin:commit-message-validation',
    point: 'pre_git_commit',
    priority: 30,
    description: 'Validates commit message format',
    source: 'builtin',
    handler: async (payload: PreGitCommitPayload): Promise<HookResult> => {
      const { message } = payload;

      // Check minimum length
      if (message.length < 10) {
        return {
          action: 'block',
          reason: 'Commit message too short (minimum 10 characters)',
        };
      }

      // Check for conventional commit format (optional warning)
      const conventionalFormat = /^(feat|fix|docs|style|refactor|test|chore)(\(.+\))?: .+/;
      if (!conventionalFormat.test(message)) {
        return {
          action: 'continue',
          warnings: ['Commit message does not follow conventional commit format'],
        };
      }

      return { action: 'continue' };
    },
  });

  // Audit logging hook
  manager.register({
    id: 'builtin:audit-logging',
    point: 'post_agent_execute',
    priority: 100,
    description: 'Logs agent execution for audit trail',
    source: 'builtin',
    handler: async (payload: PostAgentExecutePayload): Promise<HookResult> => {
      logger.info(`[AUDIT] Agent ${payload.agentType} completed`, {
        executionId: payload.executionId,
        success: payload.output.success,
        duration: payload.duration,
        artifacts: payload.output.artifacts.length,
      });

      return { action: 'continue' };
    },
  });

  // Error telemetry hook
  manager.register({
    id: 'builtin:error-telemetry',
    point: 'on_error',
    priority: 50,
    description: 'Collects error telemetry',
    source: 'builtin',
    handler: async (payload: ErrorPayload): Promise<HookResult> => {
      logger.error(`[ERROR] ${payload.error.message}`, {
        executionId: payload.executionId,
        agentType: payload.agentType,
        recoverable: payload.recoverable,
        stack: payload.error.stack,
      });

      return { action: 'continue' };
    },
  });

  // Dangerous file protection
  manager.register({
    id: 'builtin:dangerous-file-protection',
    point: 'pre_file_write',
    priority: 5,
    description: 'Prevents writing to dangerous paths',
    source: 'builtin',
    handler: async (payload: PreFileWritePayload): Promise<HookResult> => {
      const dangerousPaths = [
        /^\/etc\//,
        /^\/usr\//,
        /^\/bin\//,
        /^\/sbin\//,
        /^C:\\Windows\\/i,
        /^C:\\Program Files/i,
        /\.env$/,
        /credentials/i,
        /secrets/i,
      ];

      for (const pattern of dangerousPaths) {
        if (pattern.test(payload.filePath)) {
          return {
            action: 'block',
            reason: `Writing to protected path: ${payload.filePath}`,
          };
        }
      }

      return { action: 'continue' };
    },
  });

  logger.info('Registered built-in hooks');
}

/**
 * Simple vulnerability scanner
 */
function scanForVulnerabilities(
  content: string,
  language?: string
): Array<{ type: string; description: string; severity: 'low' | 'medium' | 'high' | 'critical' }> {
  const vulnerabilities: Array<{ type: string; description: string; severity: 'low' | 'medium' | 'high' | 'critical' }> = [];

  // SQL Injection patterns
  if (/(\$\{.*\}|' ?\+ ?|" ?\+ ?).*(?:SELECT|INSERT|UPDATE|DELETE|DROP)/i.test(content)) {
    vulnerabilities.push({
      type: 'SQL_INJECTION',
      description: 'Potential SQL injection via string concatenation',
      severity: 'critical',
    });
  }

  // XSS patterns
  if (/innerHTML\s*=|document\.write\(|eval\(/i.test(content)) {
    vulnerabilities.push({
      type: 'XSS',
      description: 'Potential XSS vulnerability via unsafe DOM manipulation',
      severity: 'high',
    });
  }

  // Command injection
  if (/exec\(|spawn\(|system\(/.test(content) && /\$\{|\+/.test(content)) {
    vulnerabilities.push({
      type: 'COMMAND_INJECTION',
      description: 'Potential command injection via string interpolation',
      severity: 'critical',
    });
  }

  // Hardcoded credentials
  if (/password\s*=\s*['"][^'"]+['"]|api_key\s*=\s*['"][^'"]+['"]/i.test(content)) {
    vulnerabilities.push({
      type: 'HARDCODED_CREDENTIALS',
      description: 'Hardcoded credentials detected',
      severity: 'high',
    });
  }

  return vulnerabilities;
}
```

---

## 4. Guardrail Manager (`src/guardrails/guardrail-manager.ts`)

```typescript
/**
 * Guardrail Manager
 *
 * Validates inputs and outputs against security and compliance rules.
 */

import {
  InputGuardrail,
  OutputGuardrail,
  GuardrailResult,
  GuardrailConfig,
} from './types';
import { getInputGuardrails } from './input-guardrails';
import { getOutputGuardrails } from './output-guardrails';
import { logger } from '../utils/logger';

/**
 * Default guardrail configuration
 */
const DEFAULT_CONFIG: GuardrailConfig = {
  enabled: true,
  strictMode: false,
  logViolations: true,
};

/**
 * Guardrail Manager class
 */
export class GuardrailManager {
  private inputGuardrails: InputGuardrail[] = [];
  private outputGuardrails: OutputGuardrail[] = [];
  private config: GuardrailConfig;

  constructor(config: Partial<GuardrailConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.loadDefaultGuardrails();
  }

  /**
   * Load default guardrails
   */
  private loadDefaultGuardrails(): void {
    this.inputGuardrails = getInputGuardrails();
    this.outputGuardrails = getOutputGuardrails();
    logger.debug(`Loaded ${this.inputGuardrails.length} input and ${this.outputGuardrails.length} output guardrails`);
  }

  /**
   * Validate input
   */
  async validateInput(input: string, context?: Record<string, unknown>): Promise<GuardrailResult> {
    if (!this.config.enabled) {
      return { valid: true, violations: [], warnings: [] };
    }

    const violations: string[] = [];
    const warnings: string[] = [];

    for (const guardrail of this.inputGuardrails) {
      if (!guardrail.enabled) continue;

      try {
        const result = await guardrail.validate(input, context);

        if (!result.valid) {
          if (guardrail.severity === 'error') {
            violations.push(`[${guardrail.id}] ${result.message}`);
          } else {
            warnings.push(`[${guardrail.id}] ${result.message}`);
          }
        }
      } catch (error) {
        logger.error(`Guardrail ${guardrail.id} failed:`, error);
        if (this.config.strictMode) {
          violations.push(`Guardrail ${guardrail.id} failed to execute`);
        }
      }
    }

    if (this.config.logViolations && violations.length > 0) {
      logger.warn('Input guardrail violations:', violations);
    }

    return {
      valid: violations.length === 0,
      violations,
      warnings,
    };
  }

  /**
   * Validate output
   */
  async validateOutput(
    output: unknown,
    outputType: 'code' | 'text' | 'json' | 'file',
    context?: Record<string, unknown>
  ): Promise<GuardrailResult> {
    if (!this.config.enabled) {
      return { valid: true, violations: [], warnings: [] };
    }

    const violations: string[] = [];
    const warnings: string[] = [];

    const outputStr = typeof output === 'string' ? output : JSON.stringify(output);

    for (const guardrail of this.outputGuardrails) {
      if (!guardrail.enabled) continue;
      if (guardrail.outputTypes && !guardrail.outputTypes.includes(outputType)) continue;

      try {
        const result = await guardrail.validate(outputStr, outputType, context);

        if (!result.valid) {
          if (guardrail.severity === 'error') {
            violations.push(`[${guardrail.id}] ${result.message}`);
          } else {
            warnings.push(`[${guardrail.id}] ${result.message}`);
          }
        }
      } catch (error) {
        logger.error(`Guardrail ${guardrail.id} failed:`, error);
        if (this.config.strictMode) {
          violations.push(`Guardrail ${guardrail.id} failed to execute`);
        }
      }
    }

    if (this.config.logViolations && violations.length > 0) {
      logger.warn('Output guardrail violations:', violations);
    }

    return {
      valid: violations.length === 0,
      violations,
      warnings,
    };
  }

  /**
   * Add custom input guardrail
   */
  addInputGuardrail(guardrail: InputGuardrail): void {
    this.inputGuardrails.push(guardrail);
    logger.debug(`Added input guardrail: ${guardrail.id}`);
  }

  /**
   * Add custom output guardrail
   */
  addOutputGuardrail(guardrail: OutputGuardrail): void {
    this.outputGuardrails.push(guardrail);
    logger.debug(`Added output guardrail: ${guardrail.id}`);
  }

  /**
   * Enable/disable a guardrail
   */
  setEnabled(guardrailId: string, enabled: boolean): boolean {
    const inputGuardrail = this.inputGuardrails.find(g => g.id === guardrailId);
    if (inputGuardrail) {
      inputGuardrail.enabled = enabled;
      return true;
    }

    const outputGuardrail = this.outputGuardrails.find(g => g.id === guardrailId);
    if (outputGuardrail) {
      outputGuardrail.enabled = enabled;
      return true;
    }

    return false;
  }

  /**
   * List all guardrails
   */
  listGuardrails(): Array<{ id: string; type: 'input' | 'output'; enabled: boolean; description: string }> {
    const result: Array<{ id: string; type: 'input' | 'output'; enabled: boolean; description: string }> = [];

    for (const g of this.inputGuardrails) {
      result.push({ id: g.id, type: 'input', enabled: g.enabled, description: g.description });
    }

    for (const g of this.outputGuardrails) {
      result.push({ id: g.id, type: 'output', enabled: g.enabled, description: g.description });
    }

    return result;
  }
}

/**
 * Singleton guardrail manager
 */
let guardrailManagerInstance: GuardrailManager | null = null;

export function getGuardrailManager(): GuardrailManager {
  if (!guardrailManagerInstance) {
    guardrailManagerInstance = new GuardrailManager();
  }
  return guardrailManagerInstance;
}
```

---

## 5. Input Guardrails (`src/guardrails/input-guardrails.ts`)

```typescript
/**
 * Input Guardrails
 *
 * Validates user inputs before processing.
 */

import { InputGuardrail, GuardrailValidationResult } from './types';

/**
 * Get all input guardrails
 */
export function getInputGuardrails(): InputGuardrail[] {
  return [
    // Prompt injection detection
    {
      id: 'input:prompt-injection',
      description: 'Detects potential prompt injection attempts',
      enabled: true,
      severity: 'error',
      validate: async (input: string): Promise<GuardrailValidationResult> => {
        const injectionPatterns = [
          /ignore\s+(all\s+)?(previous|above|prior)\s+instructions/i,
          /disregard\s+(all\s+)?(previous|above|prior)/i,
          /forget\s+(everything|all|your)\s+(instructions|rules|guidelines)/i,
          /you\s+are\s+now\s+(?:a|an)\s+/i,
          /system:\s*override/i,
          /jailbreak/i,
          /\[\[SYSTEM\]\]/i,
          /<\|im_start\|>system/i,
        ];

        for (const pattern of injectionPatterns) {
          if (pattern.test(input)) {
            return {
              valid: false,
              message: 'Potential prompt injection detected',
            };
          }
        }

        return { valid: true };
      },
    },

    // PII detection
    {
      id: 'input:pii-detection',
      description: 'Detects personally identifiable information',
      enabled: true,
      severity: 'warning',
      validate: async (input: string): Promise<GuardrailValidationResult> => {
        const piiPatterns = [
          // SSN
          { pattern: /\b\d{3}-\d{2}-\d{4}\b/, type: 'SSN' },
          // Credit card
          { pattern: /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/, type: 'Credit Card' },
          // Email
          { pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/, type: 'Email' },
          // Phone
          { pattern: /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/, type: 'Phone' },
        ];

        const detected: string[] = [];
        for (const { pattern, type } of piiPatterns) {
          if (pattern.test(input)) {
            detected.push(type);
          }
        }

        if (detected.length > 0) {
          return {
            valid: false,
            message: `Potential PII detected: ${detected.join(', ')}`,
          };
        }

        return { valid: true };
      },
    },

    // Input length limit
    {
      id: 'input:length-limit',
      description: 'Enforces maximum input length',
      enabled: true,
      severity: 'error',
      validate: async (input: string): Promise<GuardrailValidationResult> => {
        const maxLength = 100000; // 100k characters

        if (input.length > maxLength) {
          return {
            valid: false,
            message: `Input exceeds maximum length of ${maxLength} characters`,
          };
        }

        return { valid: true };
      },
    },

    // Malicious code detection
    {
      id: 'input:malicious-code',
      description: 'Detects potentially malicious code in input',
      enabled: true,
      severity: 'error',
      validate: async (input: string): Promise<GuardrailValidationResult> => {
        const maliciousPatterns = [
          /rm\s+-rf\s+\/(?!\w)/,           // rm -rf /
          /:(){ :\|:& };:/,                 // Fork bomb
          /mkfs\./,                          // Format disk
          /dd\s+if=.*of=\/dev/,             // DD to device
          />\s*\/dev\/sd[a-z]/,             // Write to disk device
        ];

        for (const pattern of maliciousPatterns) {
          if (pattern.test(input)) {
            return {
              valid: false,
              message: 'Potentially malicious command detected',
            };
          }
        }

        return { valid: true };
      },
    },
  ];
}
```

---

## 6. Output Guardrails (`src/guardrails/output-guardrails.ts`)

```typescript
/**
 * Output Guardrails
 *
 * Validates agent outputs before committing.
 */

import { OutputGuardrail, GuardrailValidationResult } from './types';
import { scanForSecrets } from './code-guardrails';

/**
 * Get all output guardrails
 */
export function getOutputGuardrails(): OutputGuardrail[] {
  return [
    // Secret leakage prevention
    {
      id: 'output:secret-leakage',
      description: 'Prevents secrets from appearing in output',
      enabled: true,
      severity: 'error',
      outputTypes: ['code', 'text', 'file'],
      validate: async (output: string): Promise<GuardrailValidationResult> => {
        const secrets = scanForSecrets(output);

        if (secrets.length > 0) {
          return {
            valid: false,
            message: `Potential secrets in output: ${secrets.map(s => s.type).join(', ')}`,
          };
        }

        return { valid: true };
      },
    },

    // Output size limit
    {
      id: 'output:size-limit',
      description: 'Enforces maximum output size',
      enabled: true,
      severity: 'error',
      validate: async (output: string): Promise<GuardrailValidationResult> => {
        const maxSize = 1024 * 1024; // 1MB

        if (output.length > maxSize) {
          return {
            valid: false,
            message: `Output exceeds maximum size of 1MB`,
          };
        }

        return { valid: true };
      },
    },

    // JSON validity check
    {
      id: 'output:json-validity',
      description: 'Validates JSON output structure',
      enabled: true,
      severity: 'error',
      outputTypes: ['json'],
      validate: async (output: string): Promise<GuardrailValidationResult> => {
        try {
          JSON.parse(output);
          return { valid: true };
        } catch {
          return {
            valid: false,
            message: 'Invalid JSON output',
          };
        }
      },
    },

    // Code completeness check
    {
      id: 'output:code-completeness',
      description: 'Checks for incomplete code markers',
      enabled: true,
      severity: 'warning',
      outputTypes: ['code'],
      validate: async (output: string): Promise<GuardrailValidationResult> => {
        const incompleteMarkers = [
          /\/\/\s*TODO/i,
          /\/\/\s*FIXME/i,
          /\/\*\s*\.\.\.\s*\*\//,
          /\.\.\./,
          /PLACEHOLDER/i,
          /NOT_IMPLEMENTED/i,
        ];

        for (const pattern of incompleteMarkers) {
          if (pattern.test(output)) {
            return {
              valid: false,
              message: 'Incomplete code markers detected',
            };
          }
        }

        return { valid: true };
      },
    },

    // Routing hints validation
    {
      id: 'output:routing-hints',
      description: 'Validates routing hints are present',
      enabled: true,
      severity: 'warning',
      outputTypes: ['json'],
      validate: async (output: string): Promise<GuardrailValidationResult> => {
        try {
          const parsed = JSON.parse(output);

          if (!parsed.routing_hints && !parsed.routingHints) {
            return {
              valid: false,
              message: 'Missing routing_hints in agent output',
            };
          }

          return { valid: true };
        } catch {
          return { valid: true }; // Skip if not valid JSON
        }
      },
    },
  ];
}
```

---

## 7. Code Guardrails (`src/guardrails/code-guardrails.ts`)

```typescript
/**
 * Code Guardrails
 *
 * Security scanning for code outputs.
 */

/**
 * Secret detection result
 */
export interface SecretDetection {
  type: string;
  confidence: 'low' | 'medium' | 'high';
  line?: number;
  masked: string;
}

/**
 * Scan content for secrets
 */
export function scanForSecrets(content: string): SecretDetection[] {
  const secrets: SecretDetection[] = [];

  const patterns = [
    // AWS
    { type: 'AWS Access Key', pattern: /AKIA[0-9A-Z]{16}/, confidence: 'high' as const },
    { type: 'AWS Secret Key', pattern: /[A-Za-z0-9/+=]{40}(?=.*aws)/i, confidence: 'medium' as const },

    // API Keys
    { type: 'API Key', pattern: /api[_-]?key['":\s]*[=:]\s*['"]?([A-Za-z0-9_\-]{20,})['"]?/i, confidence: 'medium' as const },
    { type: 'Bearer Token', pattern: /bearer\s+[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+/i, confidence: 'high' as const },

    // Private Keys
    { type: 'Private Key', pattern: /-----BEGIN (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----/, confidence: 'high' as const },

    // Passwords
    { type: 'Password', pattern: /password['":\s]*[=:]\s*['"]([^'"]{8,})['"](?!.*\{\{)/i, confidence: 'medium' as const },

    // Database URLs
    { type: 'Database URL', pattern: /(?:postgres|mysql|mongodb):\/\/[^:]+:[^@]+@/i, confidence: 'high' as const },

    // GitHub
    { type: 'GitHub Token', pattern: /gh[ps]_[A-Za-z0-9]{36}/, confidence: 'high' as const },
    { type: 'GitHub Token', pattern: /github_pat_[A-Za-z0-9]{22}_[A-Za-z0-9]{59}/, confidence: 'high' as const },

    // Slack
    { type: 'Slack Token', pattern: /xox[baprs]-[A-Za-z0-9-]+/, confidence: 'high' as const },

    // Stripe
    { type: 'Stripe Key', pattern: /sk_live_[A-Za-z0-9]{24}/, confidence: 'high' as const },

    // Generic secrets
    { type: 'Generic Secret', pattern: /secret['":\s]*[=:]\s*['"]([^'"]{16,})['"](?!.*\{\{)/i, confidence: 'low' as const },
  ];

  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    for (const { type, pattern, confidence } of patterns) {
      const match = line.match(pattern);
      if (match) {
        secrets.push({
          type,
          confidence,
          line: i + 1,
          masked: match[0].substring(0, 4) + '****' + match[0].substring(match[0].length - 4),
        });
      }
    }
  }

  return secrets;
}

/**
 * OWASP vulnerability patterns
 */
export const OWASP_PATTERNS = {
  SQL_INJECTION: [
    /(?:execute|query)\s*\(\s*[`'"].*\$\{/,
    /(?:execute|query)\s*\(\s*['"].*\+/,
  ],
  XSS: [
    /innerHTML\s*=/,
    /document\.write\s*\(/,
    /\$\(.+\)\.html\s*\(/,
    /dangerouslySetInnerHTML/,
  ],
  COMMAND_INJECTION: [
    /exec\s*\(\s*[`'"].*\$\{/,
    /spawn\s*\(\s*[`'"].*\$\{/,
    /system\s*\(\s*[`'"].*\$\{/,
  ],
  PATH_TRAVERSAL: [
    /\.\.\/|\.\.\\/, // Basic path traversal
  ],
  INSECURE_DESERIALIZATION: [
    /JSON\.parse\s*\(\s*(?:req|request)\./,
    /unserialize\s*\(\s*\$/,
  ],
};

/**
 * Scan code for OWASP vulnerabilities
 */
export function scanForOWASP(
  code: string,
  language?: string
): Array<{ type: string; severity: string; line?: number; description: string }> {
  const results: Array<{ type: string; severity: string; line?: number; description: string }> = [];
  const lines = code.split('\n');

  for (const [category, patterns] of Object.entries(OWASP_PATTERNS)) {
    for (let i = 0; i < lines.length; i++) {
      for (const pattern of patterns) {
        if (pattern.test(lines[i])) {
          results.push({
            type: category,
            severity: category === 'SQL_INJECTION' || category === 'COMMAND_INJECTION' ? 'critical' : 'high',
            line: i + 1,
            description: `Potential ${category.replace(/_/g, ' ').toLowerCase()} vulnerability`,
          });
        }
      }
    }
  }

  return results;
}
```

---

## 8. Types (`src/guardrails/types.ts`)

```typescript
/**
 * Guardrail Types
 */

export interface GuardrailValidationResult {
  valid: boolean;
  message?: string;
}

export interface GuardrailResult {
  valid: boolean;
  violations: string[];
  warnings: string[];
}

export interface InputGuardrail {
  id: string;
  description: string;
  enabled: boolean;
  severity: 'error' | 'warning';
  validate: (input: string, context?: Record<string, unknown>) => Promise<GuardrailValidationResult>;
}

export interface OutputGuardrail {
  id: string;
  description: string;
  enabled: boolean;
  severity: 'error' | 'warning';
  outputTypes?: Array<'code' | 'text' | 'json' | 'file'>;
  validate: (output: string, outputType: string, context?: Record<string, unknown>) => Promise<GuardrailValidationResult>;
}

export interface GuardrailConfig {
  enabled: boolean;
  strictMode: boolean;
  logViolations: boolean;
}
```

---

## Test Scenarios

### Test 1: Hook Manager

```typescript
// tests/hooks/hook-manager.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { HookManager } from '../../src/hooks/hook-manager';

describe('HookManager', () => {
  let manager: HookManager;

  beforeEach(() => {
    manager = new HookManager();
  });

  it('should register hooks', () => {
    manager.register({
      id: 'test-hook',
      point: 'pre_file_write',
      priority: 10,
      description: 'Test hook',
      source: 'user',
      handler: async () => ({ action: 'continue' }),
    });

    const hooks = manager.getHooks('pre_file_write');
    expect(hooks).toHaveLength(1);
    expect(hooks[0].id).toBe('test-hook');
  });

  it('should execute hooks in priority order', async () => {
    const order: number[] = [];

    manager.register({
      id: 'hook-2',
      point: 'pre_file_write',
      priority: 20,
      description: 'Second',
      source: 'user',
      handler: async () => { order.push(2); return { action: 'continue' }; },
    });

    manager.register({
      id: 'hook-1',
      point: 'pre_file_write',
      priority: 10,
      description: 'First',
      source: 'user',
      handler: async () => { order.push(1); return { action: 'continue' }; },
    });

    await manager.execute('pre_file_write', {
      timestamp: new Date(),
      executionId: 'test',
      projectId: 'test',
      filePath: 'test.ts',
      content: 'test',
      agentType: 'frontend_dev' as any,
      operation: 'create' as const,
    });

    expect(order).toEqual([1, 2]);
  });

  it('should block execution when hook returns block', async () => {
    manager.register({
      id: 'blocking-hook',
      point: 'pre_file_write',
      priority: 10,
      description: 'Blocker',
      source: 'user',
      handler: async () => ({ action: 'block', reason: 'Blocked!' }),
    });

    const result = await manager.execute('pre_file_write', {
      timestamp: new Date(),
      executionId: 'test',
      projectId: 'test',
      filePath: 'test.ts',
      content: 'test',
      agentType: 'frontend_dev' as any,
      operation: 'create' as const,
    });

    expect(result.action).toBe('block');
    expect(result.reason).toBe('Blocked!');
  });
});
```

### Test 2: Secret Detection

```typescript
// tests/guardrails/code-guardrails.test.ts
import { describe, it, expect } from 'vitest';
import { scanForSecrets } from '../../src/guardrails/code-guardrails';

describe('Secret Detection', () => {
  it('should detect AWS access keys', () => {
    const code = 'const key = "AKIAIOSFODNN7EXAMPLE";';
    const secrets = scanForSecrets(code);
    expect(secrets).toHaveLength(1);
    expect(secrets[0].type).toBe('AWS Access Key');
  });

  it('should detect GitHub tokens', () => {
    const code = 'const token = "ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx";';
    const secrets = scanForSecrets(code);
    expect(secrets).toHaveLength(1);
    expect(secrets[0].type).toBe('GitHub Token');
  });

  it('should detect database URLs', () => {
    const code = 'const db = "postgres://user:password@localhost/db";';
    const secrets = scanForSecrets(code);
    expect(secrets).toHaveLength(1);
    expect(secrets[0].type).toBe('Database URL');
  });

  it('should not flag template variables', () => {
    const code = 'const key = process.env.API_KEY;';
    const secrets = scanForSecrets(code);
    expect(secrets).toHaveLength(0);
  });
});
```

---

## Validation Checklist

```
□ Hook manager implemented
  □ Hook registration works
  □ Priority ordering correct
  □ Block/modify/continue actions work
  □ Timeout handling works

□ Built-in hooks registered
  □ Secret detection hook
  □ Code security scan
  □ Commit message validation
  □ Audit logging

□ Guardrails implemented
  □ Input guardrails (prompt injection, PII)
  □ Output guardrails (secrets, JSON, completeness)
  □ Code guardrails (OWASP, secrets)

□ All tests pass
```

---

## Next Step

Proceed to **04b-CLAUDE-MD-GENERATOR.md** to implement project context file generation.
