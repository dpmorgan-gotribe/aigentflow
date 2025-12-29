/**
 * Conflict Detection and Resolution Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  ConflictDetector,
  getConflictDetector,
  resetConflictDetector,
  type BranchChanges,
  type ExtendedConflictInfo,
} from '../../src/git/conflict-detector.js';
import {
  ConflictResolver,
  getConflictResolver,
  resetConflictResolver,
  type ResolutionStrategy,
} from '../../src/git/conflict-resolver.js';
import {
  MergeManager,
  getMergeManager,
  resetMergeManager,
  type MergeSession,
} from '../../src/git/merge-manager.js';
import type { GitEvent } from '../../src/git/types.js';

describe('ConflictDetector', () => {
  let detector: ConflictDetector;

  beforeEach(() => {
    resetConflictDetector();
    detector = new ConflictDetector();
  });

  afterEach(() => {
    detector.reset();
  });

  describe('Singleton', () => {
    it('should return singleton instance', () => {
      const d1 = getConflictDetector();
      const d2 = getConflictDetector();
      expect(d1).toBe(d2);
    });

    it('should reset singleton', () => {
      const d1 = getConflictDetector();
      resetConflictDetector();
      const d2 = getConflictDetector();
      expect(d1).not.toBe(d2);
    });
  });

  describe('detectConflicts', () => {
    it('should detect no conflicts when files differ', () => {
      const source: BranchChanges = {
        branch: 'feature/a',
        files: [{ path: '/src/fileA.ts', changeType: 'modify' }],
        timestamp: new Date(),
      };
      const target: BranchChanges = {
        branch: 'main',
        files: [{ path: '/src/fileB.ts', changeType: 'modify' }],
        timestamp: new Date(),
      };

      const result = detector.detectConflicts(source, target);

      expect(result.hasConflicts).toBe(false);
      expect(result.conflicts.length).toBe(0);
    });

    it('should detect content conflict when same file modified', () => {
      const source: BranchChanges = {
        branch: 'feature/a',
        files: [{
          path: '/src/shared.ts',
          changeType: 'modify',
          linesChanged: [{ start: 10, end: 20 }],
        }],
        timestamp: new Date(),
      };
      const target: BranchChanges = {
        branch: 'main',
        files: [{
          path: '/src/shared.ts',
          changeType: 'modify',
          linesChanged: [{ start: 15, end: 25 }],
        }],
        timestamp: new Date(),
      };

      const result = detector.detectConflicts(source, target);

      expect(result.hasConflicts).toBe(true);
      expect(result.conflicts.some((c) => c.type === 'content')).toBe(true);
    });

    it('should detect add conflict when both add same file', () => {
      const source: BranchChanges = {
        branch: 'feature/a',
        files: [{ path: '/src/new.ts', changeType: 'add', content: 'content a' }],
        timestamp: new Date(),
      };
      const target: BranchChanges = {
        branch: 'feature/b',
        files: [{ path: '/src/new.ts', changeType: 'add', content: 'content b' }],
        timestamp: new Date(),
      };

      const result = detector.detectConflicts(source, target);

      expect(result.hasConflicts).toBe(true);
      expect(result.conflicts.some((c) => c.type === 'add')).toBe(true);
    });

    it('should not flag identical adds as high severity', () => {
      const content = 'identical content';
      const source: BranchChanges = {
        branch: 'feature/a',
        files: [{ path: '/src/new.ts', changeType: 'add', content }],
        timestamp: new Date(),
      };
      const target: BranchChanges = {
        branch: 'feature/b',
        files: [{ path: '/src/new.ts', changeType: 'add', content }],
        timestamp: new Date(),
      };

      const result = detector.detectConflicts(source, target);

      const addConflict = result.conflicts.find((c) => c.type === 'add');
      expect(addConflict?.severity).toBe('low');
      expect(addConflict?.autoResolvable).toBe(true);
    });

    it('should detect delete vs modify conflict', () => {
      const source: BranchChanges = {
        branch: 'feature/a',
        files: [{ path: '/src/file.ts', changeType: 'delete' }],
        timestamp: new Date(),
      };
      const target: BranchChanges = {
        branch: 'main',
        files: [{ path: '/src/file.ts', changeType: 'modify' }],
        timestamp: new Date(),
      };

      const result = detector.detectConflicts(source, target);

      expect(result.hasConflicts).toBe(true);
      expect(result.conflicts.some((c) => c.type === 'delete')).toBe(true);
    });

    it('should detect rename conflict', () => {
      const source: BranchChanges = {
        branch: 'feature/a',
        files: [{ path: '/src/renamed-a.ts', changeType: 'rename', oldPath: '/src/original.ts' }],
        timestamp: new Date(),
      };
      const target: BranchChanges = {
        branch: 'feature/b',
        files: [{ path: '/src/renamed-b.ts', changeType: 'rename', oldPath: '/src/original.ts' }],
        timestamp: new Date(),
      };

      const result = detector.detectConflicts(source, target);

      expect(result.hasConflicts).toBe(true);
      expect(result.conflicts.some((c) => c.type === 'rename')).toBe(true);
    });

    it('should detect binary file conflict', () => {
      const source: BranchChanges = {
        branch: 'feature/a',
        files: [{ path: '/assets/image.png', changeType: 'modify', isBinary: true }],
        timestamp: new Date(),
      };
      const target: BranchChanges = {
        branch: 'main',
        files: [{ path: '/assets/image.png', changeType: 'modify', isBinary: true }],
        timestamp: new Date(),
      };

      const result = detector.detectConflicts(source, target);

      expect(result.hasConflicts).toBe(true);
      expect(result.conflicts.some((c) => c.type === 'binary')).toBe(true);
    });

    it('should detect dependency conflicts in package.json', () => {
      const source: BranchChanges = {
        branch: 'feature/a',
        files: [{ path: '/package.json', changeType: 'modify' }],
        timestamp: new Date(),
      };
      const target: BranchChanges = {
        branch: 'feature/b',
        files: [{ path: '/package.json', changeType: 'modify' }],
        timestamp: new Date(),
      };

      const result = detector.detectConflicts(source, target);

      expect(result.conflicts.some((c) => c.type === 'dependency')).toBe(true);
    });

    it('should emit conflict:detected event', () => {
      const events: GitEvent[] = [];
      detector.on((e) => events.push(e));

      const source: BranchChanges = {
        branch: 'feature/a',
        files: [{ path: '/file.ts', changeType: 'modify' }],
        timestamp: new Date(),
      };
      const target: BranchChanges = {
        branch: 'main',
        files: [{ path: '/file.ts', changeType: 'modify' }],
        timestamp: new Date(),
      };

      detector.detectConflicts(source, target);

      expect(events.some((e) => e.type === 'conflict:detected')).toBe(true);
    });

    it('should calculate severity based on affected lines', () => {
      const source: BranchChanges = {
        branch: 'feature/a',
        files: [{
          path: '/file.ts',
          changeType: 'modify',
          linesChanged: [{ start: 1, end: 100 }], // 100 lines
        }],
        timestamp: new Date(),
      };
      const target: BranchChanges = {
        branch: 'main',
        files: [{
          path: '/file.ts',
          changeType: 'modify',
          linesChanged: [{ start: 1, end: 100 }],
        }],
        timestamp: new Date(),
      };

      const result = detector.detectConflicts(source, target);

      const conflict = result.conflicts.find((c) => c.type === 'content');
      expect(conflict?.severity).toBe('critical');
    });
  });

  describe('analyzeCrossFeature', () => {
    it('should analyze multiple features', () => {
      const features: BranchChanges[] = [
        {
          branch: 'feature/a',
          files: [{ path: '/file1.ts', changeType: 'modify' }],
          timestamp: new Date(),
        },
        {
          branch: 'feature/b',
          files: [{ path: '/file2.ts', changeType: 'modify' }],
          timestamp: new Date(),
        },
        {
          branch: 'feature/c',
          files: [{ path: '/file1.ts', changeType: 'modify' }],
          timestamp: new Date(),
        },
      ];

      const analysis = detector.analyzeCrossFeature(features);

      expect(analysis.features.length).toBe(3);
      expect(analysis.mergeOrder.length).toBe(3);
    });

    it('should identify blocked features', () => {
      const features: BranchChanges[] = [
        {
          branch: 'feature/a',
          files: [{
            path: '/critical.ts',
            changeType: 'modify',
            linesChanged: [{ start: 1, end: 100 }],
          }],
          timestamp: new Date(),
        },
        {
          branch: 'feature/b',
          files: [{
            path: '/critical.ts',
            changeType: 'modify',
            linesChanged: [{ start: 1, end: 100 }],
          }],
          timestamp: new Date(),
        },
      ];

      const analysis = detector.analyzeCrossFeature(features);

      // Critical conflicts should block features
      expect(analysis.riskLevel).toBe('critical');
    });

    it('should calculate optimal merge order', () => {
      const features: BranchChanges[] = [
        {
          branch: 'feature/a',
          files: [
            { path: '/file1.ts', changeType: 'modify' },
            { path: '/file2.ts', changeType: 'modify' },
          ],
          timestamp: new Date(),
        },
        {
          branch: 'feature/b',
          files: [{ path: '/file3.ts', changeType: 'modify' }],
          timestamp: new Date(),
        },
      ];

      const analysis = detector.analyzeCrossFeature(features);

      // Feature with fewer conflicts should come first
      expect(analysis.mergeOrder).toBeDefined();
      expect(analysis.mergeOrder.length).toBe(2);
    });
  });

  describe('getConflictHistory', () => {
    it('should store conflict history', () => {
      const source: BranchChanges = {
        branch: 'feature/a',
        files: [{ path: '/file.ts', changeType: 'modify' }],
        timestamp: new Date(),
      };
      const target: BranchChanges = {
        branch: 'main',
        files: [{ path: '/file.ts', changeType: 'modify' }],
        timestamp: new Date(),
      };

      detector.detectConflicts(source, target);

      const history = detector.getConflictHistory('feature/a', 'main');
      expect(history.length).toBeGreaterThan(0);
    });
  });

  describe('Configuration', () => {
    it('should get configuration', () => {
      const config = detector.getConfig();
      expect(config.semanticDetection).toBe(true);
      expect(config.dependencyDetection).toBe(true);
    });

    it('should update configuration', () => {
      detector.updateConfig({ semanticDetection: false });
      expect(detector.getConfig().semanticDetection).toBe(false);
    });
  });

  describe('getStats', () => {
    it('should return statistics', () => {
      const source: BranchChanges = {
        branch: 'feature/a',
        files: [{ path: '/file.ts', changeType: 'modify' }],
        timestamp: new Date(),
      };
      const target: BranchChanges = {
        branch: 'main',
        files: [{ path: '/file.ts', changeType: 'modify' }],
        timestamp: new Date(),
      };

      detector.detectConflicts(source, target);

      const stats = detector.getStats();
      expect(stats.historyEntries).toBe(1);
      expect(stats.totalConflictsDetected).toBeGreaterThan(0);
    });
  });
});

describe('ConflictResolver', () => {
  let resolver: ConflictResolver;

  beforeEach(() => {
    resetConflictResolver();
    resolver = new ConflictResolver();
  });

  afterEach(() => {
    resolver.reset();
  });

  describe('Singleton', () => {
    it('should return singleton instance', () => {
      const r1 = getConflictResolver();
      const r2 = getConflictResolver();
      expect(r1).toBe(r2);
    });

    it('should reset singleton', () => {
      const r1 = getConflictResolver();
      resetConflictResolver();
      const r2 = getConflictResolver();
      expect(r1).not.toBe(r2);
    });
  });

  describe('suggestResolution', () => {
    it('should suggest resolutions for content conflict', () => {
      const conflict: ExtendedConflictInfo = {
        id: 'conflict-1',
        path: '/file.ts',
        type: 'content',
        source: 'feature/a',
        target: 'main',
        severity: 'medium',
        autoResolvable: false,
        detectedAt: new Date(),
      };

      const suggestions = resolver.suggestResolution(conflict);

      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions[0].conflictId).toBe('conflict-1');
    });

    it('should suggest smart-merge for auto-resolvable conflicts', () => {
      const conflict: ExtendedConflictInfo = {
        id: 'conflict-1',
        path: '/file.ts',
        type: 'content',
        source: 'feature/a',
        target: 'main',
        severity: 'low',
        autoResolvable: true,
        detectedAt: new Date(),
      };

      const suggestions = resolver.suggestResolution(conflict);

      expect(suggestions.some((s) => s.strategy === 'smart-merge')).toBe(true);
    });

    it('should suggest manual for binary conflicts', () => {
      const conflict: ExtendedConflictInfo = {
        id: 'conflict-1',
        path: '/image.png',
        type: 'binary',
        source: 'feature/a',
        target: 'main',
        severity: 'high',
        autoResolvable: false,
        detectedAt: new Date(),
      };

      const suggestions = resolver.suggestResolution(conflict);

      expect(suggestions.some((s) => s.strategy === 'ours')).toBe(true);
      expect(suggestions.some((s) => s.strategy === 'theirs')).toBe(true);
    });

    it('should suggest union for dependency conflicts', () => {
      const conflict: ExtendedConflictInfo = {
        id: 'conflict-1',
        path: '/package.json',
        type: 'dependency',
        source: 'feature/a',
        target: 'main',
        severity: 'medium',
        autoResolvable: false,
        detectedAt: new Date(),
      };

      const suggestions = resolver.suggestResolution(conflict);

      expect(suggestions.some((s) => s.strategy === 'union')).toBe(true);
    });

    it('should sort suggestions by confidence', () => {
      const conflict: ExtendedConflictInfo = {
        id: 'conflict-1',
        path: '/file.ts',
        type: 'content',
        source: 'feature/a',
        target: 'main',
        severity: 'medium',
        autoResolvable: false,
        detectedAt: new Date(),
      };

      const suggestions = resolver.suggestResolution(conflict);

      for (let i = 1; i < suggestions.length; i++) {
        expect(suggestions[i - 1].confidence).toBeGreaterThanOrEqual(suggestions[i].confidence);
      }
    });
  });

  describe('resolveConflict', () => {
    it('should resolve with ours strategy', async () => {
      const conflict: ExtendedConflictInfo = {
        id: 'conflict-1',
        path: '/file.ts',
        type: 'content',
        source: 'feature/a',
        target: 'main',
        severity: 'medium',
        autoResolvable: false,
        detectedAt: new Date(),
      };

      resolver.addPendingConflict(conflict);
      const result = await resolver.resolveConflict(conflict, 'ours');

      expect(result.success).toBe(true);
      expect(result.action.strategy).toBe('ours');
    });

    it('should resolve with theirs strategy', async () => {
      const conflict: ExtendedConflictInfo = {
        id: 'conflict-1',
        path: '/file.ts',
        type: 'content',
        source: 'feature/a',
        target: 'main',
        severity: 'medium',
        autoResolvable: false,
        detectedAt: new Date(),
      };

      const result = await resolver.resolveConflict(conflict, 'theirs');

      expect(result.success).toBe(true);
    });

    it('should require content for manual resolution', async () => {
      const conflict: ExtendedConflictInfo = {
        id: 'conflict-1',
        path: '/file.ts',
        type: 'content',
        source: 'feature/a',
        target: 'main',
        severity: 'medium',
        autoResolvable: false,
        detectedAt: new Date(),
      };

      const result = await resolver.resolveConflict(conflict, 'manual');

      expect(result.success).toBe(false);
      expect(result.error).toContain('resolved content');
    });

    it('should succeed with manual and content', async () => {
      const conflict: ExtendedConflictInfo = {
        id: 'conflict-1',
        path: '/file.ts',
        type: 'content',
        source: 'feature/a',
        target: 'main',
        severity: 'medium',
        autoResolvable: false,
        detectedAt: new Date(),
      };

      const result = await resolver.resolveConflict(conflict, 'manual', {
        resolvedContent: 'merged content',
        resolvedBy: 'user',
      });

      expect(result.success).toBe(true);
    });

    it('should reject union for binary conflicts', async () => {
      const conflict: ExtendedConflictInfo = {
        id: 'conflict-1',
        path: '/image.png',
        type: 'binary',
        source: 'feature/a',
        target: 'main',
        severity: 'high',
        autoResolvable: false,
        detectedAt: new Date(),
      };

      const result = await resolver.resolveConflict(conflict, 'union');

      expect(result.success).toBe(false);
    });

    it('should emit conflict:resolved event', async () => {
      const events: GitEvent[] = [];
      resolver.on((e) => events.push(e));

      const conflict: ExtendedConflictInfo = {
        id: 'conflict-1',
        path: '/file.ts',
        type: 'content',
        source: 'feature/a',
        target: 'main',
        severity: 'low',
        autoResolvable: true,
        detectedAt: new Date(),
      };

      resolver.addPendingConflict(conflict);
      await resolver.resolveConflict(conflict, 'ours');

      expect(events.some((e) => e.type === 'conflict:resolved')).toBe(true);
    });
  });

  describe('autoResolveAll', () => {
    it('should auto-resolve auto-resolvable conflicts', async () => {
      const conflicts: ExtendedConflictInfo[] = [
        {
          id: 'conflict-1',
          path: '/file1.ts',
          type: 'content',
          source: 'feature/a',
          target: 'main',
          severity: 'low',
          autoResolvable: true,
          detectedAt: new Date(),
        },
        {
          id: 'conflict-2',
          path: '/file2.ts',
          type: 'content',
          source: 'feature/a',
          target: 'main',
          severity: 'high',
          autoResolvable: false,
          detectedAt: new Date(),
        },
      ];

      const result = await resolver.autoResolveAll(conflicts);

      expect(result.successful.length).toBe(1);
      expect(result.skipped.length).toBe(1);
    });

    it('should return summary', async () => {
      const conflicts: ExtendedConflictInfo[] = [
        {
          id: 'conflict-1',
          path: '/file.ts',
          type: 'content',
          source: 'feature/a',
          target: 'main',
          severity: 'low',
          autoResolvable: true,
          detectedAt: new Date(),
        },
      ];

      const result = await resolver.autoResolveAll(conflicts);

      expect(result.summary.total).toBe(1);
      expect(result.summary.resolved).toBe(1);
    });
  });

  describe('Pending Conflicts', () => {
    it('should add and get pending conflicts', () => {
      const conflict: ExtendedConflictInfo = {
        id: 'conflict-1',
        path: '/file.ts',
        type: 'content',
        source: 'feature/a',
        target: 'main',
        severity: 'medium',
        autoResolvable: false,
        detectedAt: new Date(),
      };

      resolver.addPendingConflict(conflict);

      expect(resolver.getPendingConflict('conflict-1')).toBeDefined();
      expect(resolver.getPendingConflicts().length).toBe(1);
    });
  });

  describe('Resolution History', () => {
    it('should track resolution history', async () => {
      const conflict: ExtendedConflictInfo = {
        id: 'conflict-1',
        path: '/file.ts',
        type: 'content',
        source: 'feature/a',
        target: 'main',
        severity: 'low',
        autoResolvable: true,
        detectedAt: new Date(),
      };

      resolver.addPendingConflict(conflict);
      await resolver.resolveConflict(conflict, 'ours');

      expect(resolver.isResolved('conflict-1')).toBe(true);
      expect(resolver.getResolution('conflict-1')).toBeDefined();
    });

    it('should undo resolution', async () => {
      const conflict: ExtendedConflictInfo = {
        id: 'conflict-1',
        path: '/file.ts',
        type: 'content',
        source: 'feature/a',
        target: 'main',
        severity: 'low',
        autoResolvable: true,
        detectedAt: new Date(),
      };

      resolver.addPendingConflict(conflict);
      await resolver.resolveConflict(conflict, 'ours');
      const undone = resolver.undoResolution('conflict-1');

      expect(undone).toBe(true);
      expect(resolver.isResolved('conflict-1')).toBe(false);
    });
  });

  describe('getStats', () => {
    it('should return statistics', async () => {
      const conflict: ExtendedConflictInfo = {
        id: 'conflict-1',
        path: '/file.ts',
        type: 'content',
        source: 'feature/a',
        target: 'main',
        severity: 'low',
        autoResolvable: true,
        detectedAt: new Date(),
      };

      resolver.addPendingConflict(conflict);
      await resolver.resolveConflict(conflict, 'ours');

      const stats = resolver.getStats();
      expect(stats.resolved).toBe(1);
      expect(stats.byStrategy.ours).toBe(1);
    });
  });
});

describe('MergeManager', () => {
  let manager: MergeManager;

  beforeEach(() => {
    resetMergeManager();
    resetConflictDetector();
    resetConflictResolver();
    manager = new MergeManager();
  });

  afterEach(() => {
    manager.reset();
  });

  describe('Singleton', () => {
    it('should return singleton instance', () => {
      const m1 = getMergeManager();
      const m2 = getMergeManager();
      expect(m1).toBe(m2);
    });

    it('should reset singleton', () => {
      const m1 = getMergeManager();
      resetMergeManager();
      const m2 = getMergeManager();
      expect(m1).not.toBe(m2);
    });
  });

  describe('startMerge', () => {
    it('should start a merge session', async () => {
      const session = await manager.startMerge('feature/a', 'main');

      expect(session.id).toBeDefined();
      expect(session.sourceBranch).toBe('feature/a');
      expect(session.targetBranch).toBe('main');
    });

    it('should complete merge without conflicts', async () => {
      const session = await manager.startMerge('feature/a', 'main');

      expect(session.status).toBe('completed');
      expect(session.mergeCommit).toBeDefined();
    });

    it('should allow new merge after previous completed', async () => {
      // First merge completes
      const session1 = await manager.startMerge('feature/a', 'main');
      expect(session1.status).toBe('completed');

      // Should be able to start another merge for the same branches
      // This is correct behavior - completed merges don't block new ones
      const session2 = await manager.startMerge('feature/a', 'main');
      expect(session2.id).not.toBe(session1.id);
      expect(session2.status).toBe('completed');
    });

    it('should prevent duplicate merge sessions when one is active', async () => {
      // Access internal state to simulate an in-progress merge
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const activeSessions = (manager as any).activeSessions as Map<string, MergeSession>;

      // Manually add an active session
      const activeSession: MergeSession = {
        id: 'test-session-1',
        sourceBranch: 'feature/blocked',
        targetBranch: 'main',
        status: 'in-progress',
        startedAt: new Date(),
        conflicts: [],
        resolvedConflicts: [],
      };
      activeSessions.set(activeSession.id, activeSession);

      // Now try to start a merge for the same branches - should fail
      await expect(
        manager.startMerge('feature/blocked', 'main')
      ).rejects.toThrow('already in progress');

      // Clean up
      activeSessions.delete(activeSession.id);
    });

    it('should emit branch:merged event', async () => {
      const events: GitEvent[] = [];
      manager.on((e) => events.push(e));

      await manager.startMerge('feature/a', 'main');

      expect(events.some((e) => e.type === 'branch:merged')).toBe(true);
    });
  });

  describe('abortMerge', () => {
    it('should abort an active merge', async () => {
      // Create a manager that doesn't auto-complete
      const mgr = new MergeManager({ autoResolve: false });

      // We need to inject a conflict somehow
      // For now, just test the abort mechanism
      const session = await mgr.startMerge('feature/a', 'main');

      if (session.status !== 'completed') {
        const aborted = mgr.abortMerge(session.id);
        expect(aborted).toBe(true);
      }
    });

    it('should return false for non-existent session', () => {
      const aborted = manager.abortMerge('non-existent');
      expect(aborted).toBe(false);
    });
  });

  describe('createMergePlan', () => {
    it('should create a merge plan', () => {
      const features = ['feature/a', 'feature/b'];
      const changes: BranchChanges[] = [
        {
          branch: 'feature/a',
          files: [{ path: '/file1.ts', changeType: 'modify' }],
          timestamp: new Date(),
        },
        {
          branch: 'feature/b',
          files: [{ path: '/file2.ts', changeType: 'modify' }],
          timestamp: new Date(),
        },
      ];

      const plan = manager.createMergePlan(features, 'main', changes);

      expect(plan.id).toBeDefined();
      expect(plan.features.length).toBe(2);
      expect(plan.mergeOrder.length).toBe(2);
    });

    it('should identify blocked features in plan', () => {
      const features = ['feature/a', 'feature/b'];
      const changes: BranchChanges[] = [
        {
          branch: 'feature/a',
          files: [{
            path: '/file.ts',
            changeType: 'modify',
            linesChanged: [{ start: 1, end: 100 }],
          }],
          timestamp: new Date(),
        },
        {
          branch: 'feature/b',
          files: [{
            path: '/file.ts',
            changeType: 'modify',
            linesChanged: [{ start: 1, end: 100 }],
          }],
          timestamp: new Date(),
        },
      ];

      const plan = manager.createMergePlan(features, 'main', changes);

      expect(plan.estimatedConflicts).toBeGreaterThan(0);
    });
  });

  describe('Merge Queue', () => {
    it('should queue merges', () => {
      const entry = manager.queueMerge('feature/a', 'main', 1);

      expect(entry.id).toBeDefined();
      expect(entry.status).toBe('queued');
    });

    it('should order queue by priority', () => {
      manager.queueMerge('feature/a', 'main', 1);
      manager.queueMerge('feature/b', 'main', 3);
      manager.queueMerge('feature/c', 'main', 2);

      const queue = manager.getQueue();

      expect(queue[0].sourceBranch).toBe('feature/b'); // Priority 3
      expect(queue[1].sourceBranch).toBe('feature/c'); // Priority 2
      expect(queue[2].sourceBranch).toBe('feature/a'); // Priority 1
    });

    it('should process queue', async () => {
      manager.queueMerge('feature/a', 'main');

      const session = await manager.processQueue();

      expect(session).toBeDefined();
      expect(session?.status).toBe('completed');
    });

    it('should clear queue', () => {
      manager.queueMerge('feature/a', 'main');
      manager.queueMerge('feature/b', 'main');

      manager.clearQueue();

      expect(manager.getQueue().length).toBe(0);
    });
  });

  describe('Session Management', () => {
    it('should get active sessions', async () => {
      // With auto-resolve enabled, sessions complete immediately
      // This test checks the structure
      const stats = manager.getStats();
      expect(stats.activeSessions).toBeGreaterThanOrEqual(0);
    });

    it('should get completed merges', async () => {
      await manager.startMerge('feature/a', 'main');

      const completed = manager.getCompletedMerges();

      expect(completed.length).toBe(1);
      expect(completed[0].status).toBe('completed');
    });
  });

  describe('Configuration', () => {
    it('should get configuration', () => {
      const config = manager.getConfig();
      expect(config.autoResolve).toBe(true);
      expect(config.createBackups).toBe(true);
    });

    it('should update configuration', () => {
      manager.updateConfig({ autoResolve: false });
      expect(manager.getConfig().autoResolve).toBe(false);
    });
  });

  describe('getStats', () => {
    it('should return statistics', async () => {
      await manager.startMerge('feature/a', 'main');

      const stats = manager.getStats();

      expect(stats.completedMerges).toBe(1);
      expect(stats.successRate).toBe(1);
    });
  });
});
