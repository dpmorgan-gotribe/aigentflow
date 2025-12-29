/**
 * Branch Manager Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  BranchManager,
  getBranchManager,
  resetBranchManager,
} from '../../src/git/branch-manager.js';
import type { BranchType, GitEvent } from '../../src/git/types.js';

describe('BranchManager', () => {
  let manager: BranchManager;

  beforeEach(() => {
    resetBranchManager();
    manager = new BranchManager();
  });

  afterEach(() => {
    manager.reset();
  });

  describe('Singleton', () => {
    it('should return singleton instance', () => {
      const m1 = getBranchManager();
      const m2 = getBranchManager();
      expect(m1).toBe(m2);
    });

    it('should reset singleton', () => {
      const m1 = getBranchManager();
      resetBranchManager();
      const m2 = getBranchManager();
      expect(m1).not.toBe(m2);
    });
  });

  describe('createBranch', () => {
    it('should create a feature branch', async () => {
      const branch = await manager.createBranch({
        name: 'new-feature',
        type: 'feature',
      });

      expect(branch.name).toBe('new-feature');
      expect(branch.type).toBe('feature');
      expect(branch.fullName).toBe('feature/new-feature');
      expect(branch.status).toBe('active');
    });

    it('should create a bugfix branch', async () => {
      const branch = await manager.createBranch({
        name: 'fix-bug',
        type: 'bugfix',
      });

      expect(branch.type).toBe('bugfix');
      expect(branch.fullName).toBe('bugfix/fix-bug');
    });

    it('should create a hotfix branch', async () => {
      const branch = await manager.createBranch({
        name: 'urgent-fix',
        type: 'hotfix',
      });

      expect(branch.type).toBe('hotfix');
      expect(branch.fullName).toBe('hotfix/urgent-fix');
    });

    it('should set tracking branch when requested', async () => {
      const branch = await manager.createBranch({
        name: 'tracked-feature',
        type: 'feature',
        track: true,
      });

      expect(branch.tracking).toBe('origin/feature/tracked-feature');
    });

    it('should throw if branch already exists', async () => {
      await manager.createBranch({ name: 'test', type: 'feature' });

      await expect(
        manager.createBranch({ name: 'test', type: 'feature' })
      ).rejects.toThrow('already exists');
    });

    it('should emit branch:created event', async () => {
      const events: GitEvent[] = [];
      manager.on((e) => events.push(e));

      await manager.createBranch({ name: 'test', type: 'feature' });

      expect(events.some((e) => e.type === 'branch:created')).toBe(true);
    });
  });

  describe('deleteBranch', () => {
    it('should delete a merged branch', async () => {
      const branch = await manager.createBranch({ name: 'to-delete', type: 'feature' });
      branch.status = 'merged';

      const result = await manager.deleteBranch({ name: branch.fullName });

      expect(result).toBe(true);
      expect(manager.getBranch(branch.fullName)).toBeUndefined();
    });

    it('should throw when deleting unmerged branch without force', async () => {
      await manager.createBranch({ name: 'unmerged', type: 'feature' });

      await expect(
        manager.deleteBranch({ name: 'feature/unmerged' })
      ).rejects.toThrow('not merged');
    });

    it('should delete unmerged branch with force', async () => {
      await manager.createBranch({ name: 'unmerged', type: 'feature' });

      const result = await manager.deleteBranch({ name: 'feature/unmerged', force: true });

      expect(result).toBe(true);
    });

    it('should throw when deleting protected branch', async () => {
      // main is protected by default
      await expect(
        manager.deleteBranch({ name: 'main', force: true })
      ).rejects.toThrow('protected');
    });

    it('should emit branch:deleted event', async () => {
      const events: GitEvent[] = [];
      manager.on((e) => events.push(e));

      await manager.createBranch({ name: 'to-delete', type: 'feature' });
      const branch = manager.getBranch('feature/to-delete')!;
      branch.status = 'merged';

      await manager.deleteBranch({ name: 'feature/to-delete' });

      expect(events.some((e) => e.type === 'branch:deleted')).toBe(true);
    });
  });

  describe('mergeBranch', () => {
    it('should merge branches successfully', async () => {
      await manager.createBranch({ name: 'feature-1', type: 'feature' });
      await manager.createBranch({ name: 'main', type: 'main' });

      const result = await manager.mergeBranch({
        sourceBranch: 'feature/feature-1',
        targetBranch: 'main',
      });

      expect(result.success).toBe(true);
      expect(result.merged).toBe(true);
      expect(result.commit).toBeDefined();
    });

    it('should update source branch status to merged', async () => {
      await manager.createBranch({ name: 'feature-1', type: 'feature' });
      await manager.createBranch({ name: 'main', type: 'main' });

      await manager.mergeBranch({
        sourceBranch: 'feature/feature-1',
        targetBranch: 'main',
      });

      const source = manager.getBranch('feature/feature-1');
      expect(source?.status).toBe('merged');
    });

    it('should fail if source branch not found', async () => {
      await manager.createBranch({ name: 'main', type: 'main' });

      const result = await manager.mergeBranch({
        sourceBranch: 'nonexistent',
        targetBranch: 'main',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('should emit branch:merged event', async () => {
      const events: GitEvent[] = [];
      manager.on((e) => events.push(e));

      await manager.createBranch({ name: 'feature-1', type: 'feature' });
      await manager.createBranch({ name: 'main', type: 'main' });

      await manager.mergeBranch({
        sourceBranch: 'feature/feature-1',
        targetBranch: 'main',
      });

      expect(events.some((e) => e.type === 'branch:merged')).toBe(true);
    });
  });

  describe('checkoutBranch', () => {
    it('should checkout existing branch', async () => {
      await manager.createBranch({ name: 'existing', type: 'feature' });

      const branch = await manager.checkoutBranch('feature/existing');

      expect(branch.fullName).toBe('feature/existing');
    });

    it('should create and checkout branch when create=true', async () => {
      const branch = await manager.checkoutBranch('new-branch', true);

      expect(branch).toBeDefined();
      expect(branch.name).toBe('new-branch');
    });

    it('should throw if branch not found and create=false', async () => {
      await expect(manager.checkoutBranch('nonexistent')).rejects.toThrow('not found');
    });

    it('should emit branch:checked-out event', async () => {
      const events: GitEvent[] = [];
      manager.on((e) => events.push(e));

      await manager.createBranch({ name: 'test', type: 'feature' });
      await manager.checkoutBranch('feature/test');

      expect(events.some((e) => e.type === 'branch:checked-out')).toBe(true);
    });
  });

  describe('getBranch', () => {
    it('should get branch by full name', async () => {
      await manager.createBranch({ name: 'test', type: 'feature' });

      const branch = manager.getBranch('feature/test');

      expect(branch).toBeDefined();
      expect(branch?.fullName).toBe('feature/test');
    });

    it('should get branch by short name', async () => {
      await manager.createBranch({ name: 'test', type: 'feature' });

      const branch = manager.getBranch('test');

      expect(branch).toBeDefined();
    });

    it('should return undefined for nonexistent branch', () => {
      const branch = manager.getBranch('nonexistent');
      expect(branch).toBeUndefined();
    });
  });

  describe('getAllBranches', () => {
    it('should return all branches', async () => {
      await manager.createBranch({ name: 'feature-1', type: 'feature' });
      await manager.createBranch({ name: 'bugfix-1', type: 'bugfix' });
      await manager.createBranch({ name: 'hotfix-1', type: 'hotfix' });

      const branches = manager.getAllBranches();

      expect(branches.length).toBe(3);
    });
  });

  describe('getBranchesByType', () => {
    it('should filter branches by type', async () => {
      await manager.createBranch({ name: 'feature-1', type: 'feature' });
      await manager.createBranch({ name: 'feature-2', type: 'feature' });
      await manager.createBranch({ name: 'bugfix-1', type: 'bugfix' });

      const features = manager.getBranchesByType('feature');

      expect(features.length).toBe(2);
      expect(features.every((b) => b.type === 'feature')).toBe(true);
    });
  });

  describe('getBranchesByStatus', () => {
    it('should filter branches by status', async () => {
      const b1 = await manager.createBranch({ name: 'active-1', type: 'feature' });
      const b2 = await manager.createBranch({ name: 'merged-1', type: 'feature' });
      b2.status = 'merged';

      const active = manager.getBranchesByStatus('active');
      const merged = manager.getBranchesByStatus('merged');

      expect(active.length).toBe(1);
      expect(merged.length).toBe(1);
    });
  });

  describe('getStaleBranches', () => {
    it('should find stale branches', async () => {
      const branch = await manager.createBranch({ name: 'old', type: 'feature' });
      // Set old date
      branch.updatedAt = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000); // 40 days ago

      const stale = manager.getStaleBranches(30);

      expect(stale.length).toBe(1);
      expect(stale[0].name).toBe('old');
    });

    it('should not include protected branches in stale', async () => {
      const branch = await manager.createBranch({ name: 'main', type: 'main' });
      branch.updatedAt = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000);

      const stale = manager.getStaleBranches(30);

      expect(stale.length).toBe(0);
    });
  });

  describe('isProtectedBranch', () => {
    it('should identify protected branches', () => {
      expect(manager.isProtectedBranch('main')).toBe(true);
      expect(manager.isProtectedBranch('master')).toBe(true);
      expect(manager.isProtectedBranch('develop')).toBe(true);
    });

    it('should not protect feature branches', () => {
      expect(manager.isProtectedBranch('feature/test')).toBe(false);
    });
  });

  describe('validateBranchName', () => {
    it('should validate and clean branch names', () => {
      expect(manager.validateBranchName('test branch', 'feature')).toBe('test-branch');
      expect(manager.validateBranchName('test--branch', 'feature')).toBe('test-branch');
      expect(manager.validateBranchName('-test-', 'feature')).toBe('test');
    });

    it('should throw for empty names', () => {
      expect(() => manager.validateBranchName('', 'feature')).toThrow('cannot be empty');
    });

    it('should throw for reserved names', () => {
      expect(() => manager.validateBranchName('HEAD', 'feature')).toThrow('reserved');
    });
  });

  describe('buildBranchName', () => {
    it('should build branch names with prefixes', () => {
      expect(manager.buildBranchName('test', 'feature')).toBe('feature/test');
      expect(manager.buildBranchName('fix', 'bugfix')).toBe('bugfix/fix');
      expect(manager.buildBranchName('urgent', 'hotfix')).toBe('hotfix/urgent');
    });

    it('should not add prefix for main/develop', () => {
      expect(manager.buildBranchName('main', 'main')).toBe('main');
      expect(manager.buildBranchName('develop', 'develop')).toBe('develop');
    });
  });

  describe('detectBranchType', () => {
    it('should detect branch types from names', () => {
      expect(manager.detectBranchType('feature/test')).toBe('feature');
      expect(manager.detectBranchType('bugfix/issue-123')).toBe('bugfix');
      expect(manager.detectBranchType('hotfix/security')).toBe('hotfix');
      expect(manager.detectBranchType('main')).toBe('main');
      expect(manager.detectBranchType('develop')).toBe('develop');
      expect(manager.detectBranchType('random-branch')).toBe('custom');
    });
  });

  describe('parseBranchName', () => {
    it('should parse branch names', () => {
      const result = manager.parseBranchName('feature/my-feature');
      expect(result.type).toBe('feature');
      expect(result.name).toBe('my-feature');
    });
  });

  describe('cleanupMergedBranches', () => {
    it('should cleanup merged branches', async () => {
      const b1 = await manager.createBranch({ name: 'merged-1', type: 'feature' });
      const b2 = await manager.createBranch({ name: 'merged-2', type: 'feature' });
      b1.status = 'merged';
      b2.status = 'merged';

      const deleted = await manager.cleanupMergedBranches();

      expect(deleted.length).toBe(2);
      expect(manager.getAllBranches().length).toBe(0);
    });

    it('should not cleanup protected branches', async () => {
      const branch = await manager.createBranch({ name: 'main', type: 'main' });
      branch.status = 'merged';

      const deleted = await manager.cleanupMergedBranches();

      expect(deleted.length).toBe(0);
    });

    it('should support dry run', async () => {
      const branch = await manager.createBranch({ name: 'merged-1', type: 'feature' });
      branch.status = 'merged';

      const deleted = await manager.cleanupMergedBranches(true);

      expect(deleted.length).toBe(1);
      expect(manager.getAllBranches().length).toBe(1); // Still exists
    });
  });

  describe('getStats', () => {
    it('should return branch statistics', async () => {
      await manager.createBranch({ name: 'feature-1', type: 'feature' });
      await manager.createBranch({ name: 'bugfix-1', type: 'bugfix' });
      const merged = await manager.createBranch({ name: 'merged-1', type: 'feature' });
      merged.status = 'merged';

      const stats = manager.getStats();

      expect(stats.total).toBe(3);
      expect(stats.byType.feature).toBe(2);
      expect(stats.byType.bugfix).toBe(1);
      expect(stats.byStatus.active).toBe(2);
      expect(stats.byStatus.merged).toBe(1);
    });
  });

  describe('Configuration', () => {
    it('should get configuration', () => {
      const config = manager.getConfig();
      expect(config.defaultBaseBranch).toBe('main');
      expect(config.protectedBranches).toContain('main');
    });

    it('should update configuration', () => {
      manager.updateConfig({ defaultBaseBranch: 'develop' });
      expect(manager.getConfig().defaultBaseBranch).toBe('develop');
    });
  });

  describe('initializeBranches', () => {
    it('should initialize with existing branches', () => {
      manager.initializeBranches([
        { name: 'main', type: 'main', fullName: 'main', isRemote: false, status: 'active' },
        { name: 'feature', type: 'feature', fullName: 'feature/test', isRemote: false, status: 'active' },
      ]);

      expect(manager.getAllBranches().length).toBe(2);
    });
  });
});
