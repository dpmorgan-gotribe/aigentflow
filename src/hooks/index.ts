/**
 * Hook System
 *
 * Extensible hook system for the orchestrator.
 */

// Hook manager
export { HookManager, getHookManager, resetHookManager } from './hook-manager.js';

// Types
export type {
  HookPoint,
  HookConfig,
  HookResult,
  HookContext,
  HookHandler,
  RegisteredHook,
  HookExecutionOptions,
  HookExecutionResult,
  BuiltInHook,
} from './types.js';

// Built-in hooks
export {
  secretDetectionHook,
  scanForSecrets,
  securityScanHook,
  scanForVulnerabilities,
  auditLogHook,
  sanitizeForLog,
} from './built-in/index.js';
