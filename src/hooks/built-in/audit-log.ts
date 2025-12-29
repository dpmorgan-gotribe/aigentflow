/**
 * Audit Log Hook
 *
 * Logs agent executions and operations for audit trail.
 */

import type { HookContext, HookResult, HookHandler } from '../types.js';
import { logger } from '../../utils/logger.js';

const log = logger.child({ component: 'audit-hook' });

/**
 * Audit log hook handler
 *
 * This hook runs after agent execution to log the operation.
 * It does not block operations but ensures all actions are recorded.
 */
export const auditLogHook: HookHandler = async (context: HookContext): Promise<HookResult> => {
  const { taskId, projectId, agentType, state, data } = context;

  try {
    // Log the audit event
    log.info('Agent execution audit', {
      taskId,
      projectId,
      agentType,
      state,
      timestamp: new Date().toISOString(),
      data: sanitizeForLog(data),
    });

    // In a real implementation, this would write to the audit repository
    // For now, we just log it. The integration will happen when we wire
    // everything together in Increment 8.

    return {
      hookName: 'audit-log',
      success: true,
      blocked: false,
      data: {
        logged: true,
        timestamp: new Date().toISOString(),
      },
    };
  } catch (error) {
    // Audit logging should never block operations
    log.error('Audit logging failed', {
      error: error instanceof Error ? error.message : String(error),
      taskId,
      agentType,
    });

    return {
      hookName: 'audit-log',
      success: false, // Mark as failed but don't block
      blocked: false,
      message: `Audit logging failed: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
};

/**
 * Sanitize data for logging
 *
 * Removes or redacts sensitive information before logging.
 */
function sanitizeForLog(data?: Record<string, unknown>): Record<string, unknown> | undefined {
  if (!data) {
    return undefined;
  }

  const sanitized: Record<string, unknown> = {};
  const sensitiveKeys = [
    'password',
    'secret',
    'token',
    'apiKey',
    'api_key',
    'apikey',
    'authorization',
    'auth',
    'credentials',
    'private',
    'key',
  ];

  for (const [key, value] of Object.entries(data)) {
    const lowerKey = key.toLowerCase();

    // Check if key contains sensitive terms
    if (sensitiveKeys.some((sk) => lowerKey.includes(sk))) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      // Recursively sanitize nested objects
      if (Array.isArray(value)) {
        sanitized[key] = value.map((item) =>
          typeof item === 'object' && item !== null
            ? sanitizeForLog(item as Record<string, unknown>)
            : item
        );
      } else {
        sanitized[key] = sanitizeForLog(value as Record<string, unknown>);
      }
    } else if (typeof value === 'string' && value.length > 500) {
      // Truncate long strings
      sanitized[key] = value.substring(0, 500) + '... [TRUNCATED]';
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

/**
 * Export sanitization for testing
 */
export { sanitizeForLog };
