/**
 * Base Agent
 *
 * Abstract base class for all agent implementations.
 */

import type {
  IAgent,
  AgentMetadata,
  AgentRequest,
  AgentResult,
  AgentExecutionOptions,
  AgentLifecycleHooks,
  ExecutionContext,
} from './types.js';
import { AgentError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';
import { getHookManager } from '../hooks/hook-manager.js';

const log = logger.child({ component: 'base-agent' });

/**
 * Default execution options
 */
const DEFAULT_OPTIONS: AgentExecutionOptions = {
  timeout: 60000,
  maxRetries: 3,
  temperature: 0.7,
  maxTokens: 8192,
  dryRun: false,
};

/**
 * Abstract base class for all agents
 */
export abstract class BaseAgent implements IAgent {
  protected log = log.child({ agent: this.constructor.name });
  protected hooks: AgentLifecycleHooks = {};

  /**
   * Agent metadata - must be implemented by subclasses
   */
  abstract readonly metadata: AgentMetadata;

  /**
   * Core execution logic - must be implemented by subclasses
   */
  protected abstract executeCore(
    request: AgentRequest,
    options: Required<AgentExecutionOptions>
  ): Promise<AgentResult>;

  /**
   * Execute the agent with the given request
   */
  async execute(request: AgentRequest, options: AgentExecutionOptions = {}): Promise<AgentResult> {
    const opts = { ...DEFAULT_OPTIONS, ...options } as Required<AgentExecutionOptions>;
    const startTime = Date.now();
    let retries = 0;

    this.log.info('Agent execution started', {
      requestId: request.id,
      taskId: request.taskId,
    });

    // Run pre-execution hook
    const hookManager = getHookManager();
    const preResult = await hookManager.execute('pre_agent_execute', {
      taskId: request.taskId,
      agentType: request.agentType,
      data: { request },
    });

    if (preResult.blocked) {
      throw new AgentError(
        request.agentType,
        request.taskId,
        `Pre-execution hook blocked: ${preResult.blockReason}`
      );
    }

    // Call lifecycle hook
    if (this.hooks.beforeExecute) {
      await this.hooks.beforeExecute(request);
    }

    // Dry run mode
    if (opts.dryRun) {
      this.log.info('Dry run mode - skipping actual execution');
      return this.createDryRunResult(request, startTime);
    }

    // Validate request
    const isValid = await this.validate(request);
    if (!isValid) {
      throw new AgentError(request.agentType, request.taskId, 'Request validation failed');
    }

    // Execute with retries
    let lastError: Error | undefined;

    while (retries <= opts.maxRetries) {
      try {
        const result = await this.executeWithTimeout(request, opts);

        // Call lifecycle hook
        if (this.hooks.afterExecute) {
          await this.hooks.afterExecute(request, result);
        }

        // Run post-execution hook
        await hookManager.execute(
          'post_agent_execute',
          {
            taskId: request.taskId,
            agentType: request.agentType,
            data: { request, result },
          },
          { continueOnError: true }
        );

        this.log.info('Agent execution completed', {
          requestId: request.id,
          success: result.success,
          duration: Date.now() - startTime,
          tokensUsed: result.metrics.tokensUsed,
        });

        return result;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        retries++;

        // Call lifecycle hook
        if (this.hooks.onError) {
          await this.hooks.onError(request, lastError);
        }

        if (retries <= opts.maxRetries) {
          this.log.warn('Agent execution failed, retrying', {
            requestId: request.id,
            attempt: retries,
            error: lastError.message,
          });

          // Call lifecycle hook
          if (this.hooks.beforeRetry) {
            await this.hooks.beforeRetry(request, retries);
          }

          // Exponential backoff
          await this.delay(Math.pow(2, retries) * 1000);
        }
      }
    }

    // All retries exhausted
    this.log.error('Agent execution failed after all retries', {
      requestId: request.id,
      totalAttempts: retries,
      error: lastError?.message,
    });

    return {
      success: false,
      output: null,
      error: lastError?.message ?? 'Unknown error',
      metrics: {
        duration: Date.now() - startTime,
        tokensUsed: 0,
        retries,
      },
    };
  }

  /**
   * Execute with timeout
   */
  private async executeWithTimeout(
    request: AgentRequest,
    options: Required<AgentExecutionOptions>
  ): Promise<AgentResult> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new AgentError(request.agentType, request.taskId, 'Execution timed out'));
      }, options.timeout);

      this.executeCore(request, options)
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
   * Validate the request before execution
   */
  async validate(request: AgentRequest): Promise<boolean> {
    // Basic validation
    if (!request.id || !request.taskId || !request.prompt) {
      this.log.warn('Invalid request - missing required fields');
      return false;
    }

    // Check if agent can handle this state
    if (request.context.currentState) {
      const validStates = this.metadata.validStates;
      if (validStates.length > 0 && !validStates.includes(request.context.currentState)) {
        this.log.warn('Agent cannot operate in current state', {
          state: request.context.currentState,
          validStates,
        });
        return false;
      }
    }

    return true;
  }

  /**
   * Get agent capabilities
   */
  getCapabilities(): string[] {
    return this.metadata.capabilities;
  }

  /**
   * Check if agent can handle a specific task type
   */
  canHandle(taskType: string, _context: ExecutionContext): boolean {
    // Default implementation - subclasses can override
    return this.metadata.capabilities.includes(taskType);
  }

  /**
   * Set lifecycle hooks
   */
  setHooks(hooks: Partial<AgentLifecycleHooks>): void {
    this.hooks = { ...this.hooks, ...hooks };
  }

  /**
   * Create a dry run result
   */
  protected createDryRunResult(request: AgentRequest, startTime: number): AgentResult {
    return {
      success: true,
      output: {
        dryRun: true,
        agentType: request.agentType,
        prompt: request.prompt.substring(0, 100) + '...',
      },
      metrics: {
        duration: Date.now() - startTime,
        tokensUsed: 0,
        retries: 0,
      },
    };
  }

  /**
   * Create a success result
   */
  protected createSuccessResult(
    output: unknown,
    startTime: number,
    tokensUsed: number,
    retries: number = 0,
    routingHint?: { nextAgent?: string; reasoning?: string }
  ): AgentResult {
    return {
      success: true,
      output,
      metrics: {
        duration: Date.now() - startTime,
        tokensUsed,
        retries,
      },
      routingHint: routingHint as AgentResult['routingHint'],
    };
  }

  /**
   * Create an error result
   */
  protected createErrorResult(
    error: Error,
    startTime: number,
    retries: number = 0
  ): AgentResult {
    return {
      success: false,
      output: null,
      error: error.message,
      metrics: {
        duration: Date.now() - startTime,
        tokensUsed: 0,
        retries,
      },
    };
  }

  /**
   * Delay helper for retries
   */
  protected delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
