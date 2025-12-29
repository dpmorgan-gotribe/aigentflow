/**
 * File Lock Manager Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  FileLockManager,
  getFileLockManager,
  resetFileLockManager,
} from '../../src/git/file-lock-manager.js';
import type { GitEvent } from '../../src/git/types.js';

describe('FileLockManager', () => {
  let manager: FileLockManager;

  beforeEach(() => {
    resetFileLockManager();
    manager = new FileLockManager();
  });

  afterEach(() => {
    manager.reset();
  });

  describe('Singleton', () => {
    it('should return singleton instance', () => {
      const m1 = getFileLockManager();
      const m2 = getFileLockManager();
      expect(m1).toBe(m2);
    });

    it('should reset singleton', () => {
      const m1 = getFileLockManager();
      resetFileLockManager();
      const m2 = getFileLockManager();
      expect(m1).not.toBe(m2);
    });
  });

  describe('acquireLock', () => {
    it('should acquire an exclusive lock', async () => {
      const result = await manager.acquireLock({
        path: '/file.ts',
        type: 'exclusive',
        holder: 'agent-1',
      });

      expect(result.success).toBe(true);
      expect(result.lock).toBeDefined();
      expect(result.lock?.type).toBe('exclusive');
      expect(result.lock?.holder).toBe('agent-1');
    });

    it('should acquire a shared lock', async () => {
      const result = await manager.acquireLock({
        path: '/file.ts',
        type: 'shared',
        holder: 'agent-1',
      });

      expect(result.success).toBe(true);
      expect(result.lock?.type).toBe('shared');
    });

    it('should allow same holder to reacquire', async () => {
      await manager.acquireLock({
        path: '/file.ts',
        type: 'exclusive',
        holder: 'agent-1',
      });

      const result = await manager.acquireLock({
        path: '/file.ts',
        type: 'exclusive',
        holder: 'agent-1',
      });

      expect(result.success).toBe(true);
    });

    it('should allow multiple shared locks', async () => {
      await manager.acquireLock({
        path: '/file.ts',
        type: 'shared',
        holder: 'agent-1',
      });

      const result = await manager.acquireLock({
        path: '/file.ts',
        type: 'shared',
        holder: 'agent-2',
      });

      expect(result.success).toBe(true);
    });

    it('should deny exclusive lock when file is locked', async () => {
      await manager.acquireLock({
        path: '/file.ts',
        type: 'exclusive',
        holder: 'agent-1',
      });

      const result = await manager.acquireLock({
        path: '/file.ts',
        type: 'exclusive',
        holder: 'agent-2',
        timeout: 0,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('locked');
    });

    it('should set expiry time', async () => {
      const result = await manager.acquireLock({
        path: '/file.ts',
        type: 'exclusive',
        holder: 'agent-1',
        timeout: 60000,
      });

      expect(result.lock?.expiresAt).toBeDefined();
      expect(result.lock!.expiresAt!.getTime()).toBeGreaterThan(Date.now());
    });

    it('should emit file:locked event', async () => {
      const events: GitEvent[] = [];
      manager.on((e) => events.push(e));

      await manager.acquireLock({
        path: '/file.ts',
        type: 'exclusive',
        holder: 'agent-1',
      });

      expect(events.some((e) => e.type === 'file:locked')).toBe(true);
    });

    it('should add to wait queue when lock is held', async () => {
      await manager.acquireLock({
        path: '/file.ts',
        type: 'exclusive',
        holder: 'agent-1',
      });

      const result = await manager.acquireLock({
        path: '/file.ts',
        type: 'exclusive',
        holder: 'agent-2',
        timeout: 5000,
      });

      expect(result.success).toBe(false);
      expect(result.waitPosition).toBe(1);
    });
  });

  describe('releaseLock', () => {
    it('should release a lock', async () => {
      await manager.acquireLock({
        path: '/file.ts',
        type: 'exclusive',
        holder: 'agent-1',
      });

      const result = manager.releaseLock('/file.ts', 'agent-1');

      expect(result).toBe(true);
      expect(manager.getLock('/file.ts')).toBeUndefined();
    });

    it('should return false if no lock exists', () => {
      const result = manager.releaseLock('/nonexistent.ts', 'agent-1');
      expect(result).toBe(false);
    });

    it('should return false if holder mismatch', async () => {
      await manager.acquireLock({
        path: '/file.ts',
        type: 'exclusive',
        holder: 'agent-1',
      });

      const result = manager.releaseLock('/file.ts', 'agent-2');

      expect(result).toBe(false);
    });

    it('should emit file:unlocked event', async () => {
      const events: GitEvent[] = [];
      manager.on((e) => events.push(e));

      await manager.acquireLock({
        path: '/file.ts',
        type: 'exclusive',
        holder: 'agent-1',
      });
      manager.releaseLock('/file.ts', 'agent-1');

      expect(events.some((e) => e.type === 'file:unlocked')).toBe(true);
    });
  });

  describe('getLock', () => {
    it('should get lock by path', async () => {
      await manager.acquireLock({
        path: '/file.ts',
        type: 'exclusive',
        holder: 'agent-1',
      });

      const lock = manager.getLock('/file.ts');

      expect(lock).toBeDefined();
      expect(lock?.path).toBe('/file.ts');
    });

    it('should return undefined for nonexistent lock', () => {
      const lock = manager.getLock('/nonexistent.ts');
      expect(lock).toBeUndefined();
    });
  });

  describe('getAllLocks', () => {
    it('should return all locks', async () => {
      await manager.acquireLock({ path: '/file1.ts', type: 'exclusive', holder: 'agent-1' });
      await manager.acquireLock({ path: '/file2.ts', type: 'exclusive', holder: 'agent-2' });
      await manager.acquireLock({ path: '/file3.ts', type: 'shared', holder: 'agent-3' });

      const locks = manager.getAllLocks();

      expect(locks.length).toBe(3);
    });
  });

  describe('getLocksByHolder', () => {
    it('should filter locks by holder', async () => {
      await manager.acquireLock({ path: '/file1.ts', type: 'exclusive', holder: 'agent-1' });
      await manager.acquireLock({ path: '/file2.ts', type: 'exclusive', holder: 'agent-1' });
      await manager.acquireLock({ path: '/file3.ts', type: 'exclusive', holder: 'agent-2' });

      const locks = manager.getLocksByHolder('agent-1');

      expect(locks.length).toBe(2);
    });
  });

  describe('getLocksByWorktree', () => {
    it('should filter locks by worktree', async () => {
      await manager.acquireLock({
        path: '/file1.ts',
        type: 'exclusive',
        holder: 'agent-1',
        worktree: '/wt-1',
      });
      await manager.acquireLock({
        path: '/file2.ts',
        type: 'exclusive',
        holder: 'agent-2',
        worktree: '/wt-1',
      });
      await manager.acquireLock({
        path: '/file3.ts',
        type: 'exclusive',
        holder: 'agent-3',
        worktree: '/wt-2',
      });

      const locks = manager.getLocksByWorktree('/wt-1');

      expect(locks.length).toBe(2);
    });
  });

  describe('getLocksByType', () => {
    it('should filter locks by type', async () => {
      await manager.acquireLock({ path: '/file1.ts', type: 'exclusive', holder: 'agent-1' });
      await manager.acquireLock({ path: '/file2.ts', type: 'shared', holder: 'agent-2' });
      await manager.acquireLock({ path: '/file3.ts', type: 'shared', holder: 'agent-3' });

      const exclusive = manager.getLocksByType('exclusive');
      const shared = manager.getLocksByType('shared');

      expect(exclusive.length).toBe(1);
      expect(shared.length).toBe(2);
    });
  });

  describe('isLocked', () => {
    it('should check if file is locked', async () => {
      await manager.acquireLock({
        path: '/file.ts',
        type: 'exclusive',
        holder: 'agent-1',
      });

      expect(manager.isLocked('/file.ts')).toBe(true);
      expect(manager.isLocked('/other.ts')).toBe(false);
    });
  });

  describe('isExclusivelyLocked', () => {
    it('should check if file is exclusively locked', async () => {
      await manager.acquireLock({
        path: '/exclusive.ts',
        type: 'exclusive',
        holder: 'agent-1',
      });
      await manager.acquireLock({
        path: '/shared.ts',
        type: 'shared',
        holder: 'agent-2',
      });

      expect(manager.isExclusivelyLocked('/exclusive.ts')).toBe(true);
      expect(manager.isExclusivelyLocked('/shared.ts')).toBe(false);
    });
  });

  describe('canAccess', () => {
    it('should allow access when no lock', () => {
      expect(manager.canAccess('/file.ts', 'agent-1')).toBe(true);
    });

    it('should allow access to same holder', async () => {
      await manager.acquireLock({
        path: '/file.ts',
        type: 'exclusive',
        holder: 'agent-1',
      });

      expect(manager.canAccess('/file.ts', 'agent-1')).toBe(true);
    });

    it('should allow shared access to shared lock', async () => {
      await manager.acquireLock({
        path: '/file.ts',
        type: 'shared',
        holder: 'agent-1',
      });

      expect(manager.canAccess('/file.ts', 'agent-2', 'shared')).toBe(true);
    });

    it('should deny exclusive access to locked file', async () => {
      await manager.acquireLock({
        path: '/file.ts',
        type: 'exclusive',
        holder: 'agent-1',
      });

      expect(manager.canAccess('/file.ts', 'agent-2', 'exclusive')).toBe(false);
    });
  });

  describe('getWaitQueue', () => {
    it('should return wait queue for path', async () => {
      await manager.acquireLock({
        path: '/file.ts',
        type: 'exclusive',
        holder: 'agent-1',
      });

      await manager.acquireLock({
        path: '/file.ts',
        type: 'exclusive',
        holder: 'agent-2',
        timeout: 5000,
      });

      const queue = manager.getWaitQueue('/file.ts');

      expect(queue.length).toBe(1);
      expect(queue[0].holder).toBe('agent-2');
    });

    it('should return empty array for path with no waiters', () => {
      const queue = manager.getWaitQueue('/nonexistent.ts');
      expect(queue.length).toBe(0);
    });
  });

  describe('releaseAllByHolder', () => {
    it('should release all locks by holder', async () => {
      await manager.acquireLock({ path: '/file1.ts', type: 'exclusive', holder: 'agent-1' });
      await manager.acquireLock({ path: '/file2.ts', type: 'exclusive', holder: 'agent-1' });
      await manager.acquireLock({ path: '/file3.ts', type: 'exclusive', holder: 'agent-2' });

      const count = manager.releaseAllByHolder('agent-1');

      expect(count).toBe(2);
      expect(manager.getLocksByHolder('agent-1').length).toBe(0);
      expect(manager.getLocksByHolder('agent-2').length).toBe(1);
    });
  });

  describe('releaseAllByWorktree', () => {
    it('should release all locks by worktree', async () => {
      await manager.acquireLock({
        path: '/file1.ts',
        type: 'exclusive',
        holder: 'agent-1',
        worktree: '/wt-1',
      });
      await manager.acquireLock({
        path: '/file2.ts',
        type: 'exclusive',
        holder: 'agent-2',
        worktree: '/wt-1',
      });

      const count = manager.releaseAllByWorktree('/wt-1');

      expect(count).toBe(2);
      expect(manager.getAllLocks().length).toBe(0);
    });
  });

  describe('cleanupExpiredLocks', () => {
    it('should cleanup expired locks', async () => {
      // Create a lock that's already expired
      await manager.acquireLock({
        path: '/file.ts',
        type: 'exclusive',
        holder: 'agent-1',
        timeout: 1, // 1ms timeout
      });

      // Wait for it to expire
      await new Promise((resolve) => setTimeout(resolve, 10));

      const count = manager.cleanupExpiredLocks();

      expect(count).toBe(1);
      expect(manager.getLock('/file.ts')).toBeUndefined();
    });

    it('should not cleanup non-expired locks', async () => {
      await manager.acquireLock({
        path: '/file.ts',
        type: 'exclusive',
        holder: 'agent-1',
        timeout: 60000, // 60 second timeout
      });

      const count = manager.cleanupExpiredLocks();

      expect(count).toBe(0);
      expect(manager.getLock('/file.ts')).toBeDefined();
    });
  });

  describe('extendLock', () => {
    it('should extend lock timeout', async () => {
      await manager.acquireLock({
        path: '/file.ts',
        type: 'exclusive',
        holder: 'agent-1',
        timeout: 60000,
      });

      const beforeExtend = manager.getLock('/file.ts')?.expiresAt?.getTime();
      const result = manager.extendLock('/file.ts', 'agent-1', 30000);
      const afterExtend = manager.getLock('/file.ts')?.expiresAt?.getTime();

      expect(result).toBe(true);
      expect(afterExtend).toBeGreaterThan(beforeExtend!);
    });

    it('should return false for wrong holder', async () => {
      await manager.acquireLock({
        path: '/file.ts',
        type: 'exclusive',
        holder: 'agent-1',
      });

      const result = manager.extendLock('/file.ts', 'agent-2', 30000);

      expect(result).toBe(false);
    });
  });

  describe('startCleanup / stopCleanup', () => {
    it('should start and stop cleanup', () => {
      manager.startCleanup();
      expect(() => manager.stopCleanup()).not.toThrow();
    });

    it('should not start cleanup twice', () => {
      manager.startCleanup();
      manager.startCleanup(); // Should be no-op
      manager.stopCleanup();
    });
  });

  describe('getStats', () => {
    it('should return lock statistics', async () => {
      await manager.acquireLock({ path: '/file1.ts', type: 'exclusive', holder: 'agent-1' });
      await manager.acquireLock({ path: '/file2.ts', type: 'shared', holder: 'agent-2' });
      await manager.acquireLock({ path: '/file3.ts', type: 'shared', holder: 'agent-3' });

      const stats = manager.getStats();

      expect(stats.totalLocks).toBe(3);
      expect(stats.exclusiveLocks).toBe(1);
      expect(stats.sharedLocks).toBe(2);
      expect(stats.holders).toBe(3);
    });
  });

  describe('Configuration', () => {
    it('should get configuration', () => {
      const config = manager.getConfig();
      expect(config.defaultTimeout).toBe(300000);
      expect(config.maxWaiters).toBe(10);
    });

    it('should update configuration', () => {
      manager.updateConfig({ maxWaiters: 20 });
      expect(manager.getConfig().maxWaiters).toBe(20);
    });
  });
});
