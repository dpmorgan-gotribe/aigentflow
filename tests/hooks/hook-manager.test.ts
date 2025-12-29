/**
 * Hook Manager Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  HookManager,
  getHookManager,
  resetHookManager,
} from '../../src/hooks/hook-manager.js';
import type { HookContext, HookResult, RegisteredHook } from '../../src/hooks/types.js';

describe('HookManager', () => {
  let manager: HookManager;

  beforeEach(() => {
    resetHookManager();
    manager = new HookManager();
  });

  afterEach(() => {
    resetHookManager();
  });

  describe('Initialization', () => {
    it('should create manager with built-in hooks', () => {
      const stats = manager.getStats();
      expect(stats.totalHooks).toBeGreaterThan(0);
    });

    it('should register default hooks', () => {
      expect(manager.isRegistered('secret-detection')).toBe(true);
      expect(manager.isRegistered('security-scan')).toBe(true);
      expect(manager.isRegistered('audit-log')).toBe(true);
    });
  });

  describe('Hook Registration', () => {
    it('should register a custom hook', () => {
      const hook: RegisteredHook = {
        name: 'custom-hook',
        point: 'pre_orchestrator',
        enabled: true,
        priority: 50,
        handler: 'custom:test',
        execute: async () => ({
          hookName: 'custom-hook',
          success: true,
          blocked: false,
        }),
      };

      manager.register(hook);
      expect(manager.isRegistered('custom-hook')).toBe(true);
    });

    it('should sort hooks by priority', () => {
      manager.register({
        name: 'low-priority',
        point: 'pre_orchestrator',
        enabled: true,
        priority: 100,
        handler: 'test',
        execute: async () => ({ hookName: 'low-priority', success: true, blocked: false }),
      });

      manager.register({
        name: 'high-priority',
        point: 'pre_orchestrator',
        enabled: true,
        priority: 10,
        handler: 'test',
        execute: async () => ({ hookName: 'high-priority', success: true, blocked: false }),
      });

      const hooks = manager.getHooks('pre_orchestrator');
      expect(hooks[0]?.name).toBe('high-priority');
      expect(hooks[1]?.name).toBe('low-priority');
    });

    it('should unregister hook by name', () => {
      manager.register({
        name: 'temp-hook',
        point: 'pre_orchestrator',
        enabled: true,
        priority: 50,
        handler: 'test',
        execute: async () => ({ hookName: 'temp-hook', success: true, blocked: false }),
      });

      expect(manager.isRegistered('temp-hook')).toBe(true);
      const removed = manager.unregister('temp-hook');
      expect(removed).toBe(true);
      expect(manager.isRegistered('temp-hook')).toBe(false);
    });

    it('should return false when unregistering non-existent hook', () => {
      const removed = manager.unregister('nonexistent');
      expect(removed).toBe(false);
    });
  });

  describe('Hook Execution', () => {
    it('should execute hooks for a point', async () => {
      const executed: string[] = [];

      manager.register({
        name: 'test-hook-1',
        point: 'pre_orchestrator',
        enabled: true,
        priority: 10,
        handler: 'test',
        execute: async () => {
          executed.push('hook-1');
          return { hookName: 'test-hook-1', success: true, blocked: false };
        },
      });

      manager.register({
        name: 'test-hook-2',
        point: 'pre_orchestrator',
        enabled: true,
        priority: 20,
        handler: 'test',
        execute: async () => {
          executed.push('hook-2');
          return { hookName: 'test-hook-2', success: true, blocked: false };
        },
      });

      const result = await manager.execute('pre_orchestrator', {});
      expect(result.success).toBe(true);
      expect(executed).toEqual(['hook-1', 'hook-2']);
    });

    it('should skip disabled hooks', async () => {
      const executed: string[] = [];

      manager.register({
        name: 'enabled-hook',
        point: 'pre_orchestrator',
        enabled: true,
        priority: 10,
        handler: 'test',
        execute: async () => {
          executed.push('enabled');
          return { hookName: 'enabled-hook', success: true, blocked: false };
        },
      });

      manager.register({
        name: 'disabled-hook',
        point: 'pre_orchestrator',
        enabled: false,
        priority: 20,
        handler: 'test',
        execute: async () => {
          executed.push('disabled');
          return { hookName: 'disabled-hook', success: true, blocked: false };
        },
      });

      await manager.execute('pre_orchestrator', {});
      expect(executed).toEqual(['enabled']);
    });

    it('should stop on blocked result', async () => {
      const executed: string[] = [];

      manager.register({
        name: 'blocking-hook',
        point: 'pre_orchestrator',
        enabled: true,
        priority: 10,
        handler: 'test',
        execute: async () => {
          executed.push('blocking');
          return { hookName: 'blocking-hook', success: false, blocked: true, message: 'Blocked!' };
        },
      });

      manager.register({
        name: 'after-hook',
        point: 'pre_orchestrator',
        enabled: true,
        priority: 20,
        handler: 'test',
        execute: async () => {
          executed.push('after');
          return { hookName: 'after-hook', success: true, blocked: false };
        },
      });

      const result = await manager.execute('pre_orchestrator', {}, { stopOnBlock: true });
      expect(result.blocked).toBe(true);
      expect(result.blockReason).toBe('Blocked!');
      expect(executed).toEqual(['blocking']);
    });

    it('should continue on error when configured', async () => {
      const executed: string[] = [];

      manager.register({
        name: 'error-hook',
        point: 'pre_orchestrator',
        enabled: true,
        priority: 10,
        handler: 'test',
        execute: async () => {
          executed.push('error');
          throw new Error('Hook error');
        },
      });

      manager.register({
        name: 'after-error',
        point: 'pre_orchestrator',
        enabled: true,
        priority: 20,
        handler: 'test',
        execute: async () => {
          executed.push('after');
          return { hookName: 'after-error', success: true, blocked: false };
        },
      });

      const result = await manager.execute('pre_orchestrator', {}, { continueOnError: true });
      expect(result.success).toBe(false);
      expect(executed).toEqual(['error', 'after']);
    });

    it('should pass context to hooks', async () => {
      let receivedContext: HookContext | null = null;

      manager.register({
        name: 'context-hook',
        point: 'pre_orchestrator',
        enabled: true,
        priority: 10,
        handler: 'test',
        execute: async (ctx) => {
          receivedContext = ctx;
          return { hookName: 'context-hook', success: true, blocked: false };
        },
      });

      const context: HookContext = {
        taskId: 'task-123',
        projectId: 'project-456',
        agentType: 'orchestrator',
      };

      await manager.execute('pre_orchestrator', context);
      expect(receivedContext).toEqual(context);
    });
  });

  describe('Hook Management', () => {
    it('should enable/disable hooks', () => {
      manager.register({
        name: 'toggle-hook',
        point: 'pre_orchestrator',
        enabled: true,
        priority: 10,
        handler: 'test',
        execute: async () => ({ hookName: 'toggle-hook', success: true, blocked: false }),
      });

      manager.setEnabled('toggle-hook', false);
      const hooks = manager.getHooks('pre_orchestrator');
      expect(hooks.find((h) => h.name === 'toggle-hook')).toBeUndefined();

      manager.setEnabled('toggle-hook', true);
      const hooksAfter = manager.getHooks('pre_orchestrator');
      expect(hooksAfter.find((h) => h.name === 'toggle-hook')).toBeDefined();
    });

    it('should get all hooks', () => {
      const allHooks = manager.getAllHooks();
      expect(allHooks).toBeInstanceOf(Map);
      expect(allHooks.size).toBeGreaterThan(0);
    });

    it('should get stats', () => {
      const stats = manager.getStats();
      expect(stats).toHaveProperty('totalHooks');
      expect(stats).toHaveProperty('byPoint');
      expect(stats).toHaveProperty('enabled');
      expect(stats).toHaveProperty('disabled');
    });
  });
});

describe('Hook Manager Singleton', () => {
  beforeEach(() => {
    resetHookManager();
  });

  afterEach(() => {
    resetHookManager();
  });

  it('should return same instance', () => {
    const instance1 = getHookManager();
    const instance2 = getHookManager();
    expect(instance1).toBe(instance2);
  });

  it('should reset singleton', () => {
    const instance1 = getHookManager();
    resetHookManager();
    const instance2 = getHookManager();
    expect(instance1).not.toBe(instance2);
  });
});
