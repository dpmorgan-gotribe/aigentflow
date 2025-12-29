/**
 * Worktree Manager Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  WorktreeManager,
  getWorktreeManager,
  resetWorktreeManager,
} from '../../src/git/worktree-manager.js';
import type { GitEvent } from '../../src/git/types.js';

describe('WorktreeManager', () => {
  let manager: WorktreeManager;

  beforeEach(() => {
    resetWorktreeManager();
    manager = new WorktreeManager();
  });

  afterEach(() => {
    manager.reset();
  });

  describe('Singleton', () => {
    it('should return singleton instance', () => {
      const m1 = getWorktreeManager();
      const m2 = getWorktreeManager();
      expect(m1).toBe(m2);
    });

    it('should reset singleton', () => {
      const m1 = getWorktreeManager();
      resetWorktreeManager();
      const m2 = getWorktreeManager();
      expect(m1).not.toBe(m2);
    });
  });

  describe('addWorktree', () => {
    it('should add a worktree', async () => {
      const worktree = await manager.addWorktree({
        path: '/worktrees/feature-1',
        branch: 'feature/test',
      });

      expect(worktree.path).toBe('/worktrees/feature-1');
      expect(worktree.branch).toBe('feature/test');
      expect(worktree.isMain).toBe(false);
      expect(worktree.status).toBe('active');
    });

    it('should add locked worktree', async () => {
      const worktree = await manager.addWorktree({
        path: '/worktrees/feature-1',
        branch: 'feature/test',
        lock: true,
        lockReason: 'In development',
      });

      expect(worktree.isLocked).toBe(true);
      expect(worktree.lockReason).toBe('In development');
      expect(worktree.status).toBe('locked');
    });

    it('should throw if path already exists', async () => {
      await manager.addWorktree({ path: '/test', branch: 'branch-1' });

      await expect(
        manager.addWorktree({ path: '/test', branch: 'branch-2' })
      ).rejects.toThrow('already exists');
    });

    it('should throw if branch is already checked out', async () => {
      await manager.addWorktree({ path: '/path-1', branch: 'feature/test' });

      await expect(
        manager.addWorktree({ path: '/path-2', branch: 'feature/test' })
      ).rejects.toThrow('already checked out');
    });

    it('should throw if max worktrees reached', async () => {
      const smallManager = new WorktreeManager({ maxWorktrees: 2 });

      await smallManager.addWorktree({ path: '/wt-1', branch: 'branch-1' });
      await smallManager.addWorktree({ path: '/wt-2', branch: 'branch-2' });

      await expect(
        smallManager.addWorktree({ path: '/wt-3', branch: 'branch-3' })
      ).rejects.toThrow('Maximum worktrees limit');
    });

    it('should emit worktree:added event', async () => {
      const events: GitEvent[] = [];
      manager.on((e) => events.push(e));

      await manager.addWorktree({ path: '/test', branch: 'test' });

      expect(events.some((e) => e.type === 'worktree:added')).toBe(true);
    });
  });

  describe('removeWorktree', () => {
    it('should remove a worktree', async () => {
      await manager.addWorktree({ path: '/test', branch: 'test' });

      const result = await manager.removeWorktree({ path: '/test' });

      expect(result).toBe(true);
      expect(manager.getWorktree('/test')).toBeUndefined();
    });

    it('should throw if worktree not found', async () => {
      await expect(
        manager.removeWorktree({ path: '/nonexistent' })
      ).rejects.toThrow('not found');
    });

    it('should throw if removing main worktree', async () => {
      await manager.addWorktree({ path: '/main', branch: 'main' });
      manager.setMainWorktree('/main');

      await expect(
        manager.removeWorktree({ path: '/main' })
      ).rejects.toThrow('Cannot remove main worktree');
    });

    it('should throw if worktree is locked without force', async () => {
      await manager.addWorktree({ path: '/test', branch: 'test', lock: true, lockReason: 'Locked' });

      await expect(
        manager.removeWorktree({ path: '/test' })
      ).rejects.toThrow('locked');
    });

    it('should remove locked worktree with force', async () => {
      await manager.addWorktree({ path: '/test', branch: 'test', lock: true });

      const result = await manager.removeWorktree({ path: '/test', force: true });

      expect(result).toBe(true);
    });

    it('should emit worktree:removed event', async () => {
      const events: GitEvent[] = [];
      manager.on((e) => events.push(e));

      await manager.addWorktree({ path: '/test', branch: 'test' });
      await manager.removeWorktree({ path: '/test' });

      expect(events.some((e) => e.type === 'worktree:removed')).toBe(true);
    });
  });

  describe('lockWorktree', () => {
    it('should lock a worktree', async () => {
      await manager.addWorktree({ path: '/test', branch: 'test' });

      const result = manager.lockWorktree('/test', 'Development in progress');

      expect(result).toBe(true);
      const worktree = manager.getWorktree('/test');
      expect(worktree?.isLocked).toBe(true);
      expect(worktree?.lockReason).toBe('Development in progress');
    });

    it('should return false if already locked', async () => {
      await manager.addWorktree({ path: '/test', branch: 'test', lock: true });

      const result = manager.lockWorktree('/test');

      expect(result).toBe(false);
    });

    it('should throw if worktree not found', () => {
      expect(() => manager.lockWorktree('/nonexistent')).toThrow('not found');
    });

    it('should emit worktree:locked event', async () => {
      const events: GitEvent[] = [];
      manager.on((e) => events.push(e));

      await manager.addWorktree({ path: '/test', branch: 'test' });
      manager.lockWorktree('/test');

      expect(events.some((e) => e.type === 'worktree:locked')).toBe(true);
    });
  });

  describe('unlockWorktree', () => {
    it('should unlock a worktree', async () => {
      await manager.addWorktree({ path: '/test', branch: 'test', lock: true });

      const result = manager.unlockWorktree('/test');

      expect(result).toBe(true);
      const worktree = manager.getWorktree('/test');
      expect(worktree?.isLocked).toBe(false);
      expect(worktree?.lockReason).toBeUndefined();
    });

    it('should return false if not locked', async () => {
      await manager.addWorktree({ path: '/test', branch: 'test' });

      const result = manager.unlockWorktree('/test');

      expect(result).toBe(false);
    });

    it('should emit worktree:unlocked event', async () => {
      const events: GitEvent[] = [];
      manager.on((e) => events.push(e));

      await manager.addWorktree({ path: '/test', branch: 'test', lock: true });
      manager.unlockWorktree('/test');

      expect(events.some((e) => e.type === 'worktree:unlocked')).toBe(true);
    });
  });

  describe('getWorktree', () => {
    it('should get worktree by path', async () => {
      await manager.addWorktree({ path: '/test', branch: 'test' });

      const worktree = manager.getWorktree('/test');

      expect(worktree).toBeDefined();
      expect(worktree?.path).toBe('/test');
    });

    it('should return undefined for nonexistent path', () => {
      const worktree = manager.getWorktree('/nonexistent');
      expect(worktree).toBeUndefined();
    });
  });

  describe('getWorktreeByBranch', () => {
    it('should get worktree by branch', async () => {
      await manager.addWorktree({ path: '/test', branch: 'feature/test' });

      const worktree = manager.getWorktreeByBranch('feature/test');

      expect(worktree).toBeDefined();
      expect(worktree?.branch).toBe('feature/test');
    });

    it('should return undefined for nonexistent branch', () => {
      const worktree = manager.getWorktreeByBranch('nonexistent');
      expect(worktree).toBeUndefined();
    });
  });

  describe('getAllWorktrees', () => {
    it('should return all worktrees', async () => {
      await manager.addWorktree({ path: '/wt-1', branch: 'branch-1' });
      await manager.addWorktree({ path: '/wt-2', branch: 'branch-2' });
      await manager.addWorktree({ path: '/wt-3', branch: 'branch-3' });

      const worktrees = manager.getAllWorktrees();

      expect(worktrees.length).toBe(3);
    });
  });

  describe('getWorktreesByStatus', () => {
    it('should filter by status', async () => {
      await manager.addWorktree({ path: '/active', branch: 'active' });
      await manager.addWorktree({ path: '/locked', branch: 'locked', lock: true });

      const active = manager.getWorktreesByStatus('active');
      const locked = manager.getWorktreesByStatus('locked');

      expect(active.length).toBe(1);
      expect(locked.length).toBe(1);
    });
  });

  describe('getActiveWorktrees', () => {
    it('should return only active worktrees', async () => {
      await manager.addWorktree({ path: '/active-1', branch: 'active-1' });
      await manager.addWorktree({ path: '/active-2', branch: 'active-2' });
      await manager.addWorktree({ path: '/locked', branch: 'locked', lock: true });

      const active = manager.getActiveWorktrees();

      expect(active.length).toBe(2);
    });
  });

  describe('getLockedWorktrees', () => {
    it('should return only locked worktrees', async () => {
      await manager.addWorktree({ path: '/active', branch: 'active' });
      await manager.addWorktree({ path: '/locked-1', branch: 'locked-1', lock: true });
      await manager.addWorktree({ path: '/locked-2', branch: 'locked-2', lock: true });

      const locked = manager.getLockedWorktrees();

      expect(locked.length).toBe(2);
    });
  });

  describe('isWorktree', () => {
    it('should check if path is a worktree', async () => {
      await manager.addWorktree({ path: '/test', branch: 'test' });

      expect(manager.isWorktree('/test')).toBe(true);
      expect(manager.isWorktree('/nonexistent')).toBe(false);
    });
  });

  describe('hasBranchWorktree', () => {
    it('should check if branch has a worktree', async () => {
      await manager.addWorktree({ path: '/test', branch: 'feature/test' });

      expect(manager.hasBranchWorktree('feature/test')).toBe(true);
      expect(manager.hasBranchWorktree('nonexistent')).toBe(false);
    });
  });

  describe('pruneWorktrees', () => {
    it('should prune old worktrees', async () => {
      const worktree = await manager.addWorktree({ path: '/old', branch: 'old' });
      worktree.createdAt = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000); // 10 days ago

      const cleanupManager = new WorktreeManager({ cleanupDays: 7 });
      cleanupManager.initializeWorktrees([worktree]);

      const pruned = await cleanupManager.pruneWorktrees();

      expect(pruned.length).toBe(1);
    });

    it('should not prune locked worktrees', async () => {
      const worktree = await manager.addWorktree({
        path: '/old',
        branch: 'old',
        lock: true,
      });
      worktree.createdAt = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);

      const cleanupManager = new WorktreeManager({ cleanupDays: 7 });
      cleanupManager.initializeWorktrees([worktree]);

      const pruned = await cleanupManager.pruneWorktrees();

      expect(pruned.length).toBe(0);
    });

    it('should support dry run', async () => {
      const worktree = await manager.addWorktree({ path: '/old', branch: 'old' });
      worktree.createdAt = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);

      const cleanupManager = new WorktreeManager({ cleanupDays: 7 });
      cleanupManager.initializeWorktrees([worktree]);

      const pruned = await cleanupManager.pruneWorktrees(true);

      expect(pruned.length).toBe(1);
      expect(cleanupManager.getAllWorktrees().length).toBe(1); // Still exists
    });
  });

  describe('setMainWorktree / getMainWorktree', () => {
    it('should set and get main worktree', async () => {
      await manager.addWorktree({ path: '/main', branch: 'main' });

      manager.setMainWorktree('/main');

      const main = manager.getMainWorktree();
      expect(main?.path).toBe('/main');
      expect(main?.isMain).toBe(true);
    });

    it('should clear previous main when setting new one', async () => {
      await manager.addWorktree({ path: '/main-1', branch: 'main-1' });
      await manager.addWorktree({ path: '/main-2', branch: 'main-2' });

      manager.setMainWorktree('/main-1');
      manager.setMainWorktree('/main-2');

      expect(manager.getWorktree('/main-1')?.isMain).toBe(false);
      expect(manager.getWorktree('/main-2')?.isMain).toBe(true);
    });
  });

  describe('generateWorktreePath', () => {
    it('should generate path from branch name', () => {
      const path = manager.generateWorktreePath('feature/my-feature');
      expect(path).toBe('.worktrees/feature-my-feature');
    });

    it('should handle colons and backslashes', () => {
      const path = manager.generateWorktreePath('feature\\test:branch');
      expect(path).toBe('.worktrees/feature-test-branch');
    });
  });

  describe('updateWorktreeCommit', () => {
    it('should update commit hash', async () => {
      await manager.addWorktree({ path: '/test', branch: 'test' });

      const result = manager.updateWorktreeCommit('/test', 'abc123');

      expect(result).toBe(true);
      expect(manager.getWorktree('/test')?.commit).toBe('abc123');
    });

    it('should return false for nonexistent worktree', () => {
      const result = manager.updateWorktreeCommit('/nonexistent', 'abc123');
      expect(result).toBe(false);
    });
  });

  describe('getStats', () => {
    it('should return worktree statistics', async () => {
      await manager.addWorktree({ path: '/active-1', branch: 'active-1' });
      await manager.addWorktree({ path: '/active-2', branch: 'active-2' });
      await manager.addWorktree({ path: '/locked', branch: 'locked', lock: true });

      const stats = manager.getStats();

      expect(stats.total).toBe(3);
      expect(stats.active).toBe(2);
      expect(stats.locked).toBe(1);
      expect(stats.maxAllowed).toBe(10);
      expect(stats.available).toBe(7);
    });
  });

  describe('Configuration', () => {
    it('should get configuration', () => {
      const config = manager.getConfig();
      expect(config.baseDir).toBe('.worktrees');
      expect(config.maxWorktrees).toBe(10);
    });

    it('should update configuration', () => {
      manager.updateConfig({ maxWorktrees: 20 });
      expect(manager.getConfig().maxWorktrees).toBe(20);
    });
  });

  describe('initializeWorktrees', () => {
    it('should initialize with existing worktrees', () => {
      manager.initializeWorktrees([
        { path: '/wt-1', branch: 'branch-1', commit: 'abc', isMain: true, isLocked: false, status: 'active' },
        { path: '/wt-2', branch: 'branch-2', commit: 'def', isMain: false, isLocked: false, status: 'active' },
      ]);

      expect(manager.getAllWorktrees().length).toBe(2);
    });
  });
});
