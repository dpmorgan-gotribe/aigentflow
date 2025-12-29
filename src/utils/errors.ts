/**
 * Custom Error Classes
 *
 * Structured errors for better error handling and reporting.
 */

/**
 * Base error class for all Aigentflow errors
 */
export class AigentflowError extends Error {
  public readonly code: string;
  public readonly context?: Record<string, unknown>;
  public readonly timestamp: string;

  constructor(message: string, code: string, context?: Record<string, unknown>) {
    super(message);
    this.name = 'AigentflowError';
    this.code = code;
    this.context = context;
    this.timestamp = new Date().toISOString();

    // Maintains proper stack trace for where error was thrown
    Error.captureStackTrace?.(this, this.constructor);
  }

  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      context: this.context,
      timestamp: this.timestamp,
      stack: this.stack,
    };
  }
}

/**
 * Configuration-related errors
 */
export class ConfigError extends AigentflowError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'CONFIG_ERROR', context);
    this.name = 'ConfigError';
  }
}

/**
 * Database-related errors
 */
export class DatabaseError extends AigentflowError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'DATABASE_ERROR', context);
    this.name = 'DatabaseError';
  }
}

/**
 * State machine transition errors
 */
export class StateTransitionError extends AigentflowError {
  public readonly fromState: string;
  public readonly toState: string;

  constructor(fromState: string, toState: string, message?: string) {
    super(
      message ?? `Invalid state transition: ${fromState} -> ${toState}`,
      'STATE_TRANSITION_ERROR',
      { fromState, toState }
    );
    this.name = 'StateTransitionError';
    this.fromState = fromState;
    this.toState = toState;
  }
}

/**
 * Agent execution errors
 */
export class AgentError extends AigentflowError {
  public readonly agentType: string;
  public readonly taskId?: string;

  constructor(agentType: string, message: string, context?: Record<string, unknown>) {
    super(message, 'AGENT_ERROR', { ...context, agentType });
    this.name = 'AgentError';
    this.agentType = agentType;
    this.taskId = context?.taskId as string | undefined;
  }
}

/**
 * Validation errors
 */
export class ValidationError extends AigentflowError {
  public readonly field?: string;
  public readonly value?: unknown;

  constructor(message: string, field?: string, value?: unknown) {
    super(message, 'VALIDATION_ERROR', { field, value });
    this.name = 'ValidationError';
    this.field = field;
    this.value = value;
  }
}

/**
 * Hook execution errors
 */
export class HookError extends AigentflowError {
  public readonly hookName: string;
  public readonly hookPoint: string;

  constructor(hookName: string, hookPoint: string, message: string) {
    super(message, 'HOOK_ERROR', { hookName, hookPoint });
    this.name = 'HookError';
    this.hookName = hookName;
    this.hookPoint = hookPoint;
  }
}

/**
 * Security-related errors
 */
export class SecurityError extends AigentflowError {
  public readonly violation: string;

  constructor(violation: string, message: string, context?: Record<string, unknown>) {
    super(message, 'SECURITY_ERROR', { ...context, violation });
    this.name = 'SecurityError';
    this.violation = violation;
  }
}

/**
 * Compliance-related errors
 */
export class ComplianceError extends AigentflowError {
  public readonly framework: string;
  public readonly rule: string;

  constructor(framework: string, rule: string, message: string) {
    super(message, 'COMPLIANCE_ERROR', { framework, rule });
    this.name = 'ComplianceError';
    this.framework = framework;
    this.rule = rule;
  }
}

/**
 * Timeout errors
 */
export class TimeoutError extends AigentflowError {
  public readonly operation: string;
  public readonly timeoutMs: number;

  constructor(operation: string, timeoutMs: number) {
    super(`Operation "${operation}" timed out after ${timeoutMs}ms`, 'TIMEOUT_ERROR', {
      operation,
      timeoutMs,
    });
    this.name = 'TimeoutError';
    this.operation = operation;
    this.timeoutMs = timeoutMs;
  }
}

/**
 * Resource not found errors
 */
export class NotFoundError extends AigentflowError {
  public readonly resourceType: string;
  public readonly resourceId: string;

  constructor(resourceType: string, resourceId: string) {
    super(`${resourceType} not found: ${resourceId}`, 'NOT_FOUND_ERROR', {
      resourceType,
      resourceId,
    });
    this.name = 'NotFoundError';
    this.resourceType = resourceType;
    this.resourceId = resourceId;
  }
}

/**
 * Feature not enabled errors
 */
export class FeatureDisabledError extends AigentflowError {
  public readonly feature: string;
  public readonly phase: string;

  constructor(feature: string, phase: string) {
    super(`Feature "${feature}" is disabled. Available in phase: ${phase}`, 'FEATURE_DISABLED', {
      feature,
      phase,
    });
    this.name = 'FeatureDisabledError';
    this.feature = feature;
    this.phase = phase;
  }
}

/**
 * Check if an error is an AigentflowError
 */
export function isAigentflowError(error: unknown): error is AigentflowError {
  return error instanceof AigentflowError;
}

/**
 * Wrap an unknown error as an AigentflowError
 */
export function wrapError(error: unknown, code = 'UNKNOWN_ERROR'): AigentflowError {
  if (error instanceof AigentflowError) {
    return error;
  }

  if (error instanceof Error) {
    const wrapped = new AigentflowError(error.message, code);
    wrapped.stack = error.stack;
    return wrapped;
  }

  return new AigentflowError(String(error), code);
}
