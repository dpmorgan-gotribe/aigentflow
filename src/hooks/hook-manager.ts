/**
 * Hook Manager
 *
 * Orchestrates hook registration and execution.
 */

import type {
  HookPoint,
  HookConfig,
  HookResult,
  HookContext,
  HookHandler,
  RegisteredHook,
  HookExecutionOptions,
  HookExecutionResult,
} from './types.js';
import { HOOK_DEFAULTS } from '../config/defaults.js';
import { logger } from '../utils/logger.js';
import { secretDetectionHook } from './built-in/secret-detection.js';
import { securityScanHook } from './built-in/security-scan.js';
import { auditLogHook } from './built-in/audit-log.js';

const log = logger.child({ component: 'hook-manager' });

/**
 * Default execution options
 */
const DEFAULT_OPTIONS: HookExecutionOptions = {
  stopOnBlock: true,
  continueOnError: false,
  timeout: 30000, // 30 seconds
};

/**
 * Hook manager for registering and executing hooks
 */
export class HookManager {
  private hooks: Map<HookPoint, RegisteredHook[]>;
  private builtInHandlers: Map<string, HookHandler>;

  constructor() {
    this.hooks = new Map();
    this.builtInHandlers = new Map();

    // Register built-in handlers
    this.registerBuiltInHandlers();

    // Register default hooks
    this.registerDefaultHooks();

    log.debug('HookManager initialized');
  }

  /**
   * Register built-in hook handlers
   */
  private registerBuiltInHandlers(): void {
    this.builtInHandlers.set('built-in:secret-detection', secretDetectionHook);
    this.builtInHandlers.set('built-in:security-scan', securityScanHook);
    this.builtInHandlers.set('built-in:audit-log', auditLogHook);
  }

  /**
   * Register default hooks from configuration
   */
  private registerDefaultHooks(): void {
    for (const hookConfig of HOOK_DEFAULTS.builtIn) {
      const handler = this.builtInHandlers.get(hookConfig.handler);
      if (handler) {
        this.register({
          ...hookConfig,
          execute: handler,
        });
      } else {
        log.warn('Built-in hook handler not found', { handler: hookConfig.handler });
      }
    }
  }

  /**
   * Register a hook
   */
  register(hook: RegisteredHook): void {
    const point = hook.point;
    const existing = this.hooks.get(point) ?? [];

    // Add hook and sort by priority (lower = higher priority)
    existing.push(hook);
    existing.sort((a, b) => a.priority - b.priority);

    this.hooks.set(point, existing);
    log.debug('Hook registered', { name: hook.name, point, priority: hook.priority });
  }

  /**
   * Unregister a hook by name
   */
  unregister(name: string, point?: HookPoint): boolean {
    let removed = false;

    if (point) {
      // Remove from specific point
      const hooks = this.hooks.get(point);
      if (hooks) {
        const filtered = hooks.filter((h) => h.name !== name);
        if (filtered.length < hooks.length) {
          this.hooks.set(point, filtered);
          removed = true;
        }
      }
    } else {
      // Remove from all points
      for (const [hookPoint, hooks] of this.hooks) {
        const filtered = hooks.filter((h) => h.name !== name);
        if (filtered.length < hooks.length) {
          this.hooks.set(hookPoint, filtered);
          removed = true;
        }
      }
    }

    if (removed) {
      log.debug('Hook unregistered', { name, point });
    }
    return removed;
  }

  /**
   * Get all hooks for a point
   */
  getHooks(point: HookPoint): RegisteredHook[] {
    return (this.hooks.get(point) ?? []).filter((h) => h.enabled);
  }

  /**
   * Execute all hooks for a point
   */
  async execute(
    point: HookPoint,
    context: HookContext,
    options: HookExecutionOptions = {}
  ): Promise<HookExecutionResult> {
    const opts = { ...DEFAULT_OPTIONS, ...options };
    const hooks = this.getHooks(point);
    const startTime = Date.now();
    const results: HookResult[] = [];

    log.debug('Executing hooks', { point, count: hooks.length });

    for (const hook of hooks) {
      try {
        const result = await this.executeWithTimeout(hook, context, opts.timeout!);
        results.push(result);

        log.debug('Hook executed', {
          name: hook.name,
          success: result.success,
          blocked: result.blocked,
        });

        // Stop on block if configured
        if (result.blocked && opts.stopOnBlock) {
          log.info('Hook blocked operation', { name: hook.name, message: result.message });
          return {
            success: false,
            blocked: true,
            results,
            duration: Date.now() - startTime,
            blockReason: result.message,
          };
        }

        // Stop on error if not continuing
        if (!result.success && !opts.continueOnError) {
          log.warn('Hook failed', { name: hook.name, message: result.message });
          return {
            success: false,
            blocked: false,
            results,
            duration: Date.now() - startTime,
          };
        }
      } catch (error) {
        const errorResult: HookResult = {
          hookName: hook.name,
          success: false,
          blocked: false,
          message: error instanceof Error ? error.message : String(error),
        };
        results.push(errorResult);

        log.error('Hook threw exception', { name: hook.name, error });

        if (!opts.continueOnError) {
          return {
            success: false,
            blocked: false,
            results,
            duration: Date.now() - startTime,
          };
        }
      }
    }

    return {
      success: results.every((r) => r.success),
      blocked: false,
      results,
      duration: Date.now() - startTime,
    };
  }

  /**
   * Execute a hook with timeout
   */
  private async executeWithTimeout(
    hook: RegisteredHook,
    context: HookContext,
    timeout: number
  ): Promise<HookResult> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Hook '${hook.name}' timed out after ${timeout}ms`));
      }, timeout);

      Promise.resolve(hook.execute(context))
        .then((result) => {
          clearTimeout(timer);
          resolve(result);
        })
        .catch((error) => {
          clearTimeout(timer);
          reject(error);
        });
    });
  }

  /**
   * Create a hook from config
   */
  createFromConfig(config: HookConfig, handler: HookHandler): RegisteredHook {
    return {
      ...config,
      execute: handler,
    };
  }

  /**
   * Get a built-in handler by name
   */
  getBuiltInHandler(name: string): HookHandler | undefined {
    return this.builtInHandlers.get(name);
  }

  /**
   * Check if a hook is registered
   */
  isRegistered(name: string, point?: HookPoint): boolean {
    if (point) {
      return this.getHooks(point).some((h) => h.name === name);
    }
    for (const hooks of this.hooks.values()) {
      if (hooks.some((h) => h.name === name)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Enable/disable a hook
   */
  setEnabled(name: string, enabled: boolean): boolean {
    let updated = false;
    for (const hooks of this.hooks.values()) {
      for (const hook of hooks) {
        if (hook.name === name) {
          hook.enabled = enabled;
          updated = true;
        }
      }
    }
    if (updated) {
      log.info('Hook enabled status changed', { name, enabled });
    }
    return updated;
  }

  /**
   * Get all registered hooks
   */
  getAllHooks(): Map<HookPoint, RegisteredHook[]> {
    return new Map(this.hooks);
  }

  /**
   * Get hook statistics
   */
  getStats(): Record<string, unknown> {
    const stats: Record<string, unknown> = {
      totalHooks: 0,
      byPoint: {} as Record<string, number>,
      enabled: 0,
      disabled: 0,
    };

    for (const [point, hooks] of this.hooks) {
      stats.totalHooks = (stats.totalHooks as number) + hooks.length;
      (stats.byPoint as Record<string, number>)[point] = hooks.length;
      for (const hook of hooks) {
        if (hook.enabled) {
          stats.enabled = (stats.enabled as number) + 1;
        } else {
          stats.disabled = (stats.disabled as number) + 1;
        }
      }
    }

    return stats;
  }
}

// Singleton instance
let instance: HookManager | null = null;

/**
 * Get the hook manager singleton
 */
export function getHookManager(): HookManager {
  if (!instance) {
    instance = new HookManager();
  }
  return instance;
}

/**
 * Reset the singleton (for testing)
 */
export function resetHookManager(): void {
  instance = null;
}
