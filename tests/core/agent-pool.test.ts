/**
 * Agent Pool Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  AgentPool,
  getAgentPool,
  resetAgentPool,
} from '../../src/core/agent-pool.js';
import { resetFeatureFlags, getFeatureFlags } from '../../src/core/feature-flags.js';
import { AigentflowError, TimeoutError } from '../../src/utils/errors.js';

describe('AgentPool', () => {
  let pool: AgentPool;

  beforeEach(() => {
    resetAgentPool();
    resetFeatureFlags();
    pool = getAgentPool();
  });

  describe('Pool Initialization', () => {
    it('should create pool with default max size', () => {
      expect(pool.size).toBe(0);
      expect(pool.activeCount).toBe(0);
      expect(pool.queueSize).toBe(0);
    });

    it('should create pool with custom max size', () => {
      const customPool = new AgentPool(10);
      expect(customPool.size).toBe(0);
    });
  });

  describe('Agent Availability', () => {
    it('should check if agent is enabled', () => {
      // MVP agents should be enabled
      expect(pool.isAgentEnabled('orchestrator')).toBe(true);
      expect(pool.isAgentEnabled('project-manager')).toBe(true);
      expect(pool.isAgentEnabled('architect')).toBe(true);
      expect(pool.isAgentEnabled('analyst')).toBe(true);

      // Non-MVP agents should be disabled
      expect(pool.isAgentEnabled('ui-designer')).toBe(false);
      expect(pool.isAgentEnabled('frontend-developer')).toBe(false);
    });

    it('should get max concurrent for agent type', () => {
      expect(pool.getMaxConcurrent('orchestrator')).toBe(1);
      expect(pool.getMaxConcurrent('project-manager')).toBe(5);
      expect(pool.getMaxConcurrent('analyst')).toBe(5);
    });
  });

  describe('Agent Allocation', () => {
    it('should allocate enabled agent', async () => {
      const agent = await pool.requestAgent('task-1', 'orchestrator');

      expect(agent).toBeDefined();
      expect(agent.type).toBe('orchestrator');
      expect(agent.taskId).toBe('task-1');
      expect(agent.status).toBe('running');
      expect(pool.activeCount).toBe(1);
    });

    it('should reject disabled agent', async () => {
      await expect(pool.requestAgent('task-1', 'ui-designer')).rejects.toThrow(AigentflowError);
    });

    it('should respect per-type limits', async () => {
      // Orchestrator has max 1
      const agent1 = await pool.requestAgent('task-1', 'orchestrator');
      expect(pool.countByType('orchestrator')).toBe(1);

      // Second request should queue
      const requestPromise = pool.requestAgent('task-2', 'orchestrator', { timeout: 500 });

      // Release first agent
      setTimeout(() => pool.releaseAgent(agent1.id), 100);

      const agent2 = await requestPromise;
      expect(agent2.taskId).toBe('task-2');
    });

    it('should release agent', async () => {
      const agent = await pool.requestAgent('task-1', 'orchestrator');
      expect(pool.activeCount).toBe(1);

      pool.releaseAgent(agent.id);
      expect(pool.activeCount).toBe(0);
    });

    it('should fail agent', async () => {
      const agent = await pool.requestAgent('task-1', 'orchestrator');
      expect(pool.activeCount).toBe(1);

      pool.failAgent(agent.id, new Error('Test error'));
      expect(pool.activeCount).toBe(0);
    });
  });

  describe('Queue Management', () => {
    it('should queue requests when at capacity', async () => {
      // Fill orchestrator slot
      const agent1 = await pool.requestAgent('task-1', 'orchestrator');

      // This should queue
      const requestPromise = pool.requestAgent('task-2', 'orchestrator', { timeout: 1000 });

      expect(pool.queueSize).toBe(1);

      // Release to process queue
      pool.releaseAgent(agent1.id);

      const agent2 = await requestPromise;
      expect(agent2.taskId).toBe('task-2');
      expect(pool.queueSize).toBe(0);
    });

    it('should timeout queued requests', async () => {
      // Fill orchestrator slot
      await pool.requestAgent('task-1', 'orchestrator');

      // This should timeout
      await expect(
        pool.requestAgent('task-2', 'orchestrator', { timeout: 100 })
      ).rejects.toThrow(TimeoutError);
    });

    it('should queue with priority ordering', () => {
      // Test that queue is ordered by priority
      pool['queue'] = []; // Access private for testing

      const request1 = { id: '1', taskId: 't1', agentType: 'orchestrator' as const, priority: 1, queuedAt: new Date(), context: {} };
      const request2 = { id: '2', taskId: 't2', agentType: 'orchestrator' as const, priority: 10, queuedAt: new Date(), context: {} };
      const request3 = { id: '3', taskId: 't3', agentType: 'orchestrator' as const, priority: 5, queuedAt: new Date(), context: {} };

      // Insert in priority order (higher priority first)
      const insertInOrder = (req: typeof request1) => {
        const insertIndex = pool['queue'].findIndex((r) => r.priority < req.priority);
        if (insertIndex === -1) {
          pool['queue'].push(req);
        } else {
          pool['queue'].splice(insertIndex, 0, req);
        }
      };

      insertInOrder(request1);
      insertInOrder(request2);
      insertInOrder(request3);

      expect(pool['queue'][0]?.priority).toBe(10);
      expect(pool['queue'][1]?.priority).toBe(5);
      expect(pool['queue'][2]?.priority).toBe(1);
    });

    it('should cancel queued request', async () => {
      await pool.requestAgent('task-1', 'orchestrator');

      // Queue another
      const requestPromise = pool.requestAgent('task-2', 'orchestrator', { timeout: 5000 });

      // Cancel by task
      const cancelled = pool.cancelTaskRequests('task-2');
      expect(cancelled).toBe(1);
      expect(pool.queueSize).toBe(0);
    });
  });

  describe('Statistics', () => {
    it('should return pool stats', async () => {
      await pool.requestAgent('task-1', 'orchestrator');
      await pool.requestAgent('task-2', 'analyst');

      const stats = pool.getStats();

      expect(stats.total).toBe(15);
      expect(stats.active).toBe(2);
      expect(stats.idle).toBe(13);
      expect(stats.byType.get('orchestrator')).toBe(1);
      expect(stats.byType.get('analyst')).toBe(1);
    });

    it('should get active agents', async () => {
      await pool.requestAgent('task-1', 'orchestrator');
      await pool.requestAgent('task-2', 'analyst');

      const active = pool.getActiveAgents();
      expect(active.length).toBe(2);
    });
  });
});
