/**
 * Agent Pool Manager
 *
 * Manages concurrent agent execution with a maximum pool size.
 */

import { randomUUID } from 'crypto';
import type { AgentType } from '../types.js';
import type { AgentInstance, PoolStats, QueuedRequest } from './types.js';
import { AigentflowError, TimeoutError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';
import { isFeatureEnabled } from './feature-flags.js';
import { AGENT_DEFAULTS } from '../config/defaults.js';

const log = logger.child({ component: 'agent-pool' });

// ============================================================================
// Constants
// ============================================================================

const MAX_POOL_SIZE = 15;
const DEFAULT_REQUEST_TIMEOUT = 30000; // 30 seconds

// ============================================================================
// Agent Pool
// ============================================================================

/**
 * Agent pool manager
 */
export class AgentPool {
  private agents: Map<string, AgentInstance>;
  private queue: QueuedRequest[];
  private maxSize: number;

  constructor(maxSize: number = MAX_POOL_SIZE) {
    this.agents = new Map();
    this.queue = [];
    this.maxSize = maxSize;
  }

  /**
   * Get current pool size
   */
  get size(): number {
    return this.agents.size;
  }

  /**
   * Get number of active agents
   */
  get activeCount(): number {
    return Array.from(this.agents.values()).filter((a) => a.status === 'running').length;
  }

  /**
   * Get number of queued requests
   */
  get queueSize(): number {
    return this.queue.length;
  }

  /**
   * Check if an agent type is enabled
   */
  isAgentEnabled(agentType: AgentType): boolean {
    // Convert agent-type to agentType for flag lookup
    const camelCase = agentType.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
    const flagKey = `agents.${camelCase}`;

    // Check feature flag
    if (!isFeatureEnabled(flagKey)) {
      return false;
    }

    // Check agent defaults
    const defaults = AGENT_DEFAULTS[agentType];
    return defaults?.enabled ?? false;
  }

  /**
   * Get max concurrent for an agent type
   */
  getMaxConcurrent(agentType: AgentType): number {
    const defaults = AGENT_DEFAULTS[agentType];
    return defaults?.maxConcurrent ?? 1;
  }

  /**
   * Count agents of a specific type
   */
  countByType(agentType: AgentType): number {
    return Array.from(this.agents.values()).filter(
      (a) => a.type === agentType && a.status === 'running'
    ).length;
  }

  /**
   * Check if can allocate an agent
   */
  canAllocate(agentType: AgentType): boolean {
    // Check pool capacity
    if (this.activeCount >= this.maxSize) {
      return false;
    }

    // Check per-type limit
    const maxForType = this.getMaxConcurrent(agentType);
    if (this.countByType(agentType) >= maxForType) {
      return false;
    }

    return true;
  }

  /**
   * Request an agent from the pool
   */
  async requestAgent(
    taskId: string,
    agentType: AgentType,
    options: { priority?: number; timeout?: number; context?: Record<string, unknown> } = {}
  ): Promise<AgentInstance> {
    const { priority = 0, timeout = DEFAULT_REQUEST_TIMEOUT, context = {} } = options;

    // Check if agent type is enabled
    if (!this.isAgentEnabled(agentType)) {
      throw new AigentflowError(
        `Agent type "${agentType}" is not enabled`,
        'AGENT_DISABLED',
        { agentType }
      );
    }

    // Try to allocate immediately
    if (this.canAllocate(agentType)) {
      return this.allocateAgent(taskId, agentType);
    }

    // Queue the request
    const request: QueuedRequest = {
      id: randomUUID(),
      taskId,
      agentType,
      priority,
      queuedAt: new Date(),
      context,
    };

    log.debug('Agent request queued', { taskId, agentType, requestId: request.id });

    // Insert in priority order (higher priority first)
    const insertIndex = this.queue.findIndex((r) => r.priority < priority);
    if (insertIndex === -1) {
      this.queue.push(request);
    } else {
      this.queue.splice(insertIndex, 0, request);
    }

    // Wait for allocation with timeout
    return this.waitForAllocation(request, timeout);
  }

  /**
   * Allocate an agent
   */
  private allocateAgent(taskId: string, agentType: AgentType): AgentInstance {
    const agent: AgentInstance = {
      id: randomUUID(),
      type: agentType,
      taskId,
      status: 'running',
      startedAt: new Date(),
    };

    this.agents.set(agent.id, agent);

    log.info('Agent allocated', {
      agentId: agent.id,
      taskId,
      agentType,
      poolSize: this.size,
      active: this.activeCount,
    });

    return agent;
  }

  /**
   * Wait for agent allocation
   */
  private waitForAllocation(request: QueuedRequest, timeout: number): Promise<AgentInstance> {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();

      const checkAllocation = () => {
        // Check timeout
        if (Date.now() - startTime > timeout) {
          // Remove from queue
          this.queue = this.queue.filter((r) => r.id !== request.id);
          reject(new TimeoutError(`Agent request for ${request.agentType}`, timeout));
          return;
        }

        // Check if request is still in queue
        const inQueue = this.queue.find((r) => r.id === request.id);
        if (!inQueue) {
          // Request was processed, find the agent
          const agent = Array.from(this.agents.values()).find(
            (a) => a.taskId === request.taskId && a.type === request.agentType && a.status === 'running'
          );

          if (agent) {
            resolve(agent);
          } else {
            // Request was removed but no agent found
            reject(new AigentflowError('Agent request was cancelled', 'REQUEST_CANCELLED'));
          }
          return;
        }

        // Try to allocate
        if (this.canAllocate(request.agentType)) {
          // Remove from queue
          this.queue = this.queue.filter((r) => r.id !== request.id);
          resolve(this.allocateAgent(request.taskId, request.agentType));
          return;
        }

        // Check again later
        setTimeout(checkAllocation, 100);
      };

      checkAllocation();
    });
  }

  /**
   * Release an agent back to the pool
   */
  releaseAgent(agentId: string): void {
    const agent = this.agents.get(agentId);
    if (!agent) {
      log.warn('Attempted to release unknown agent', { agentId });
      return;
    }

    agent.status = 'completed';
    agent.completedAt = new Date();

    // Remove from pool
    this.agents.delete(agentId);

    log.info('Agent released', {
      agentId,
      agentType: agent.type,
      taskId: agent.taskId,
      poolSize: this.size,
      active: this.activeCount,
    });

    // Process queue
    this.processQueue();
  }

  /**
   * Mark an agent as failed
   */
  failAgent(agentId: string, error?: Error): void {
    const agent = this.agents.get(agentId);
    if (!agent) {
      log.warn('Attempted to fail unknown agent', { agentId });
      return;
    }

    agent.status = 'failed';
    agent.completedAt = new Date();

    // Remove from pool
    this.agents.delete(agentId);

    log.error('Agent failed', error, {
      agentId,
      agentType: agent.type,
      taskId: agent.taskId,
    });

    // Process queue
    this.processQueue();
  }

  /**
   * Process queued requests
   */
  private processQueue(): void {
    if (this.queue.length === 0) {
      return;
    }

    // Process requests in priority order
    for (let i = 0; i < this.queue.length; i++) {
      const request = this.queue[i];
      if (request && this.canAllocate(request.agentType)) {
        // Allocation will happen in waitForAllocation
        // Just trigger check by doing nothing here
        break;
      }
    }
  }

  /**
   * Cancel a queued request
   */
  cancelRequest(requestId: string): boolean {
    const index = this.queue.findIndex((r) => r.id === requestId);
    if (index === -1) {
      return false;
    }

    this.queue.splice(index, 1);
    log.debug('Agent request cancelled', { requestId });
    return true;
  }

  /**
   * Cancel all requests for a task
   */
  cancelTaskRequests(taskId: string): number {
    const before = this.queue.length;
    this.queue = this.queue.filter((r) => r.taskId !== taskId);
    const cancelled = before - this.queue.length;

    if (cancelled > 0) {
      log.debug('Task requests cancelled', { taskId, count: cancelled });
    }

    return cancelled;
  }

  /**
   * Get pool statistics
   */
  getStats(): PoolStats {
    const agents = Array.from(this.agents.values());
    const byType = new Map<AgentType, number>();

    for (const agent of agents) {
      if (agent.status === 'running') {
        byType.set(agent.type, (byType.get(agent.type) ?? 0) + 1);
      }
    }

    return {
      total: this.maxSize,
      active: this.activeCount,
      idle: this.maxSize - this.activeCount,
      queued: this.queue.length,
      byType,
    };
  }

  /**
   * Get all active agents
   */
  getActiveAgents(): AgentInstance[] {
    return Array.from(this.agents.values()).filter((a) => a.status === 'running');
  }

  /**
   * Get agent by ID
   */
  getAgent(agentId: string): AgentInstance | undefined {
    return this.agents.get(agentId);
  }

  /**
   * Clear the pool (for testing)
   */
  clear(): void {
    this.agents.clear();
    this.queue = [];
  }
}

// Singleton instance
let instance: AgentPool | null = null;

/**
 * Get the agent pool singleton
 */
export function getAgentPool(): AgentPool {
  if (!instance) {
    instance = new AgentPool();
  }
  return instance;
}

/**
 * Reset the singleton (for testing)
 */
export function resetAgentPool(): void {
  instance?.clear();
  instance = null;
}
