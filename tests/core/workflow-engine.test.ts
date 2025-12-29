/**
 * Workflow Engine Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  WorkflowEngine,
  getWorkflowEngine,
  resetWorkflowEngine,
} from '../../src/core/workflow-engine.js';
import { resetStateMachine } from '../../src/core/state-machine.js';
import { resetAgentPool } from '../../src/core/agent-pool.js';
import { resetFeatureFlags } from '../../src/core/feature-flags.js';
import { AigentflowError } from '../../src/utils/errors.js';

describe('WorkflowEngine', () => {
  let engine: WorkflowEngine;

  beforeEach(() => {
    resetWorkflowEngine();
    resetStateMachine();
    resetAgentPool();
    resetFeatureFlags();
    engine = getWorkflowEngine();
  });

  describe('Task Creation', () => {
    it('should create a new task', () => {
      const task = engine.createTask('project-1', 'Build a login page');

      expect(task.id).toBeDefined();
      expect(task.projectId).toBe('project-1');
      expect(task.prompt).toBe('Build a login page');
      expect(task.state).toBe('IDLE');
      expect(task.status).toBe('pending');
    });

    it('should store task in engine', () => {
      const task = engine.createTask('project-1', 'Test prompt');
      const retrieved = engine.getTask(task.id);

      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(task.id);
    });

    it('should get all tasks', () => {
      engine.createTask('project-1', 'Task 1');
      engine.createTask('project-1', 'Task 2');

      const tasks = engine.getAllTasks();
      expect(tasks.length).toBe(2);
    });

    it('should get tasks by status', () => {
      const task1 = engine.createTask('project-1', 'Task 1');
      engine.createTask('project-1', 'Task 2');

      const pendingTasks = engine.getTasksByStatus('pending');
      expect(pendingTasks.length).toBe(2);
    });
  });

  describe('Task Lifecycle', () => {
    it('should start a pending task', async () => {
      const task = engine.createTask('project-1', 'Test prompt');

      await engine.startTask(task.id);

      const updated = engine.getTask(task.id);
      expect(updated?.status).toBe('running');
      expect(updated?.state).toBe('ANALYZING');
    });

    it('should not start non-pending task', async () => {
      const task = engine.createTask('project-1', 'Test prompt');
      await engine.startTask(task.id);

      await expect(engine.startTask(task.id)).rejects.toThrow(AigentflowError);
    });

    it('should abort a running task', async () => {
      const task = engine.createTask('project-1', 'Test prompt');
      await engine.startTask(task.id);

      await engine.abortTask(task.id);

      const updated = engine.getTask(task.id);
      expect(updated?.state).toBe('ABORTED');
    });

    it('should not abort terminal task', async () => {
      const task = engine.createTask('project-1', 'Test prompt');
      await engine.startTask(task.id);
      await engine.abortTask(task.id);

      await expect(engine.abortTask(task.id)).rejects.toThrow(AigentflowError);
    });
  });

  describe('State Transitions', () => {
    it('should transition task state', async () => {
      const task = engine.createTask('project-1', 'Test prompt');

      const newState = await engine.transitionTo(task.id, 'START');

      expect(newState).toBe('ANALYZING');
      expect(engine.getTask(task.id)?.state).toBe('ANALYZING');
    });

    it('should throw for unknown task', async () => {
      await expect(engine.transitionTo('unknown-id', 'START')).rejects.toThrow(AigentflowError);
    });
  });

  describe('Checkpoints', () => {
    it('should create checkpoint', async () => {
      const task = engine.createTask('project-1', 'Test prompt');
      await engine.startTask(task.id);

      const checkpoint = await engine.createCheckpoint(task.id, 'manual');

      expect(checkpoint.id).toBeDefined();
      expect(checkpoint.taskId).toBe(task.id);
      expect(checkpoint.state).toBe('ANALYZING');
    });

    it('should get checkpoints for task', async () => {
      const task = engine.createTask('project-1', 'Test prompt');
      await engine.startTask(task.id);
      await engine.createCheckpoint(task.id, 'checkpoint-1');
      await engine.createCheckpoint(task.id, 'checkpoint-2');

      const checkpoints = engine.getCheckpoints(task.id);
      expect(checkpoints.length).toBe(2);
    });

    it('should store and retrieve checkpoints for recovery', async () => {
      const task = engine.createTask('project-1', 'Test prompt');
      await engine.startTask(task.id);

      // Move to ORCHESTRATING state
      await engine.transitionTo(task.id, 'AGENT_COMPLETE');

      const checkpoint = await engine.createCheckpoint(task.id, 'at-orchestrating');

      // Verify checkpoint was created with correct state
      expect(checkpoint.state).toBe('ORCHESTRATING');
      expect(checkpoint.taskId).toBe(task.id);

      // Get checkpoints and verify
      const checkpoints = engine.getCheckpoints(task.id);
      expect(checkpoints.length).toBeGreaterThan(0);
      expect(checkpoints.some((c) => c.id === checkpoint.id)).toBe(true);
    });
  });

  describe('Retry Management', () => {
    it('should increment retry count', () => {
      const task = engine.createTask('project-1', 'Test prompt');

      expect(engine.getTask(task.id)?.context.retryCount).toBe(0);

      engine.incrementRetry(task.id);
      expect(engine.getTask(task.id)?.context.retryCount).toBe(1);

      engine.incrementRetry(task.id);
      expect(engine.getTask(task.id)?.context.retryCount).toBe(2);
    });
  });

  describe('Event Listeners', () => {
    it('should emit events', async () => {
      const listener = vi.fn();
      engine.on(listener);

      const task = engine.createTask('project-1', 'Test prompt');
      await engine.startTask(task.id);

      expect(listener).toHaveBeenCalled();
      expect(listener.mock.calls.some((call) => call[0].type === 'TASK_STARTED')).toBe(true);
    });

    it('should allow removing listeners', async () => {
      const listener = vi.fn();
      const unsubscribe = engine.on(listener);

      unsubscribe();

      const task = engine.createTask('project-1', 'Test prompt');
      await engine.startTask(task.id);

      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe('Statistics', () => {
    it('should return engine stats', async () => {
      const task1 = engine.createTask('project-1', 'Task 1');
      const task2 = engine.createTask('project-1', 'Task 2');
      await engine.startTask(task1.id);

      const stats = engine.getStats();

      expect(stats.totalTasks).toBe(2);
      expect((stats.byStatus as Record<string, number>).pending).toBe(1);
      expect((stats.byStatus as Record<string, number>).running).toBe(1);
    });
  });
});
