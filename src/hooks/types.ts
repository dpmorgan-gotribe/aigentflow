/**
 * Hook System Types
 *
 * Extended types for the hook system.
 */

import type { HookPoint, HookConfig, HookResult } from '../types.js';

/**
 * Context passed to hooks during execution
 */
export interface HookContext {
  /** Current task ID if applicable */
  taskId?: string;
  /** Current project ID if applicable */
  projectId?: string;
  /** Current agent type if applicable */
  agentType?: string;
  /** Current workflow state */
  state?: string;
  /** Hook-specific data */
  data?: Record<string, unknown>;
  /** File path for file-related hooks */
  filePath?: string;
  /** File content for file-related hooks */
  fileContent?: string;
  /** Error for error hooks */
  error?: Error;
  /** Retry count for retry hooks */
  retryCount?: number;
}

/**
 * Hook handler function signature
 */
export type HookHandler = (context: HookContext) => Promise<HookResult> | HookResult;

/**
 * Registered hook with handler
 */
export interface RegisteredHook extends HookConfig {
  /** The handler function */
  execute: HookHandler;
}

/**
 * Options for hook execution
 */
export interface HookExecutionOptions {
  /** Stop on first blocked result */
  stopOnBlock?: boolean;
  /** Continue on error */
  continueOnError?: boolean;
  /** Timeout in milliseconds */
  timeout?: number;
}

/**
 * Aggregated result from running multiple hooks
 */
export interface HookExecutionResult {
  /** Did all hooks succeed */
  success: boolean;
  /** Was the operation blocked */
  blocked: boolean;
  /** Individual hook results */
  results: HookResult[];
  /** Total execution time in ms */
  duration: number;
  /** Blocking message if blocked */
  blockReason?: string;
}

/**
 * Built-in hook names
 */
export type BuiltInHook = 'audit-log' | 'secret-detection' | 'security-scan';

// Re-export base types
export type { HookPoint, HookConfig, HookResult };
