/**
 * Git Agent Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { GitAgent, createGitAgent } from '../../src/agents/git-agent.js';
import { resetBranchManager } from '../../src/git/branch-manager.js';
import { resetWorktreeManager } from '../../src/git/worktree-manager.js';
import { resetFileLockManager } from '../../src/git/file-lock-manager.js';
import type { AgentRequest, ExecutionContext } from '../../src/agents/types.js';
import type { ProjectConfig } from '../../src/types.js';

const createTestContext = (overrides: Partial<ProjectConfig> = {}): ExecutionContext => ({
  taskId: 'test-task-1',
  currentState: 'ANALYZING',
  projectConfig: {
    name: 'test-project',
    version: '1.0.0',
    description: 'Test project',
    path: process.cwd(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    features: {
      gitWorktrees: true,
      parallelAgents: false,
      selfEvolution: false,
    },
    compliance: {
      frameworks: [],
      strictMode: false,
    },
    agents: {},
    hooks: [],
    ...overrides,
  },
  previousOutputs: new Map(),
  lessonsLearned: [],
});

const createTestRequest = (
  prompt: string,
  context: ExecutionContext
): AgentRequest => ({
  id: `req-${Date.now()}`,
  taskId: context.taskId,
  agentType: 'git-agent',
  prompt,
  context,
});

describe('GitAgent', () => {
  let agent: GitAgent;
  let mockContext: ExecutionContext;

  beforeEach(() => {
    // Reset all Git managers
    resetBranchManager();
    resetWorktreeManager();
    resetFileLockManager();

    agent = createGitAgent();
    mockContext = createTestContext();
  });

  afterEach(() => {
    resetBranchManager();
    resetWorktreeManager();
    resetFileLockManager();
  });

  describe('Metadata', () => {
    it('should have correct metadata', () => {
      expect(agent.metadata.type).toBe('git-agent');
      expect(agent.metadata.name).toBe('Git Agent');
      expect(agent.metadata.phase).toBe('v1.0');
    });

    it('should have correct capabilities', () => {
      expect(agent.metadata.capabilities).toContain('branch-management');
      expect(agent.metadata.capabilities).toContain('worktree-management');
      expect(agent.metadata.capabilities).toContain('file-locking');
      expect(agent.metadata.capabilities).toContain('merge-operations');
      expect(agent.metadata.capabilities).toContain('conflict-detection');
    });

    it('should have valid states', () => {
      expect(agent.metadata.validStates).toContain('ANALYZING');
      expect(agent.metadata.validStates).toContain('BUILDING');
      expect(agent.metadata.validStates).toContain('REVIEWING');
      expect(agent.metadata.validStates).toContain('TESTING');
    });
  });

  describe('Factory', () => {
    it('should create agent via factory', () => {
      const created = createGitAgent();
      expect(created).toBeInstanceOf(GitAgent);
    });
  });

  describe('Manager Access', () => {
    it('should provide access to branch manager', () => {
      const branchManager = agent.getBranchManager();
      expect(branchManager).toBeDefined();
      expect(typeof branchManager.createBranch).toBe('function');
    });

    it('should provide access to worktree manager', () => {
      const worktreeManager = agent.getWorktreeManager();
      expect(worktreeManager).toBeDefined();
      expect(typeof worktreeManager.addWorktree).toBe('function');
    });

    it('should provide access to file lock manager', () => {
      const lockManager = agent.getFileLockManager();
      expect(lockManager).toBeDefined();
      expect(typeof lockManager.acquireLock).toBe('function');
    });
  });

  describe('canHandle', () => {
    it('should handle git-operation tasks', () => {
      expect(agent.canHandle('git-operation', mockContext)).toBe(true);
    });

    it('should handle branch-management tasks', () => {
      expect(agent.canHandle('branch-management', mockContext)).toBe(true);
    });

    it('should handle worktree-management tasks', () => {
      expect(agent.canHandle('worktree-management', mockContext)).toBe(true);
    });

    it('should handle file-locking tasks', () => {
      expect(agent.canHandle('file-locking', mockContext)).toBe(true);
    });

    it('should handle merge-operation tasks', () => {
      expect(agent.canHandle('merge-operation', mockContext)).toBe(true);
    });

    it('should not handle unrelated tasks', () => {
      expect(agent.canHandle('ui-design', mockContext)).toBe(false);
      expect(agent.canHandle('code-review', mockContext)).toBe(false);
    });
  });

  describe('File Locking', () => {
    it('should acquire shared lock', async () => {
      const lock = await agent.acquireFileLock('/test/file.ts', 'agent-1', false);

      expect(lock).toBeDefined();
      expect(lock?.type).toBe('shared');
      expect(lock?.holder).toBe('agent-1');
    });

    it('should acquire exclusive lock', async () => {
      const lock = await agent.acquireFileLock('/test/file.ts', 'agent-1', true);

      expect(lock).toBeDefined();
      expect(lock?.type).toBe('exclusive');
    });

    it('should release lock', async () => {
      await agent.acquireFileLock('/test/file.ts', 'agent-1', true);

      const released = agent.releaseFileLock('/test/file.ts', 'agent-1');

      expect(released).toBe(true);
    });

    it('should return null when lock acquisition fails', async () => {
      // First agent acquires exclusive lock
      await agent.acquireFileLock('/test/file.ts', 'agent-1', true);

      // Second agent tries to acquire (should fail with timeout 0)
      const lockManager = agent.getFileLockManager();
      const result = await lockManager.acquireLock({
        path: '/test/file.ts',
        type: 'exclusive',
        holder: 'agent-2',
        timeout: 0,
      });

      expect(result.success).toBe(false);
    });
  });

  describe('Branch Operations via Manager', () => {
    it('should create branch through manager', async () => {
      const branchManager = agent.getBranchManager();

      const branch = await branchManager.createBranch({
        name: 'test-feature',
        type: 'feature',
      });

      expect(branch.name).toBe('test-feature');
      expect(branch.fullName).toBe('feature/test-feature');
    });

    it('should get all branches', async () => {
      const branchManager = agent.getBranchManager();

      await branchManager.createBranch({ name: 'feat-1', type: 'feature' });
      await branchManager.createBranch({ name: 'fix-1', type: 'bugfix' });

      const branches = branchManager.getAllBranches();

      expect(branches.length).toBe(2);
    });

    it('should check protected branches', () => {
      const branchManager = agent.getBranchManager();

      expect(branchManager.isProtectedBranch('main')).toBe(true);
      expect(branchManager.isProtectedBranch('feature/test')).toBe(false);
    });
  });

  describe('Worktree Operations via Manager', () => {
    it('should add worktree through manager', async () => {
      const worktreeManager = agent.getWorktreeManager();

      const worktree = await worktreeManager.addWorktree({
        path: '/worktrees/feature-1',
        branch: 'feature/test',
      });

      expect(worktree.path).toBe('/worktrees/feature-1');
      expect(worktree.branch).toBe('feature/test');
    });

    it('should get all worktrees', async () => {
      const worktreeManager = agent.getWorktreeManager();

      await worktreeManager.addWorktree({ path: '/wt-1', branch: 'branch-1' });
      await worktreeManager.addWorktree({ path: '/wt-2', branch: 'branch-2' });

      const worktrees = worktreeManager.getAllWorktrees();

      expect(worktrees.length).toBe(2);
    });

    it('should generate worktree path from branch', () => {
      const worktreeManager = agent.getWorktreeManager();

      const path = worktreeManager.generateWorktreePath('feature/my-feature');

      expect(path).toBe('.worktrees/feature-my-feature');
    });
  });

  describe('Lock Operations via Manager', () => {
    it('should get lock stats', async () => {
      const lockManager = agent.getFileLockManager();

      await lockManager.acquireLock({ path: '/f1.ts', type: 'exclusive', holder: 'a1' });
      await lockManager.acquireLock({ path: '/f2.ts', type: 'shared', holder: 'a2' });

      const stats = lockManager.getStats();

      expect(stats.totalLocks).toBe(2);
      expect(stats.exclusiveLocks).toBe(1);
      expect(stats.sharedLocks).toBe(1);
    });

    it('should check lock access', async () => {
      const lockManager = agent.getFileLockManager();

      await lockManager.acquireLock({ path: '/f1.ts', type: 'exclusive', holder: 'a1' });

      expect(lockManager.canAccess('/f1.ts', 'a1')).toBe(true);
      expect(lockManager.canAccess('/f1.ts', 'a2', 'exclusive')).toBe(false);
    });
  });

  describe('Execute', () => {
    it('should execute branch creation', async () => {
      const request = createTestRequest('Create a feature branch named user-auth', mockContext);
      const result = await agent.execute(request, { timeout: 30000 });

      expect(result.success).toBe(true);
      expect(result.output).toBeDefined();
      expect(result.output.operation).toBe('branch-create');
    });

    it('should execute branch checkout', async () => {
      // First create a branch
      const branchManager = agent.getBranchManager();
      await branchManager.createBranch({ name: 'existing', type: 'feature' });

      const request = createTestRequest('Checkout branch feature/existing', mockContext);
      const result = await agent.execute(request, { timeout: 30000 });

      expect(result.success).toBe(true);
      expect(result.output.operation).toBe('branch-checkout');
    });

    it('should execute worktree addition', async () => {
      const request = createTestRequest('Add worktree for feature/new-feature', mockContext);
      const result = await agent.execute(request, { timeout: 30000 });

      expect(result.success).toBe(true);
      expect(result.output.operation).toBe('worktree-add');
    });

    it('should execute merge operation', async () => {
      // Setup branches
      const branchManager = agent.getBranchManager();
      await branchManager.createBranch({ name: 'feature-1', type: 'feature' });
      await branchManager.createBranch({ name: 'main', type: 'main' });

      const request = createTestRequest('Merge feature/feature-1 into main', mockContext);
      const result = await agent.execute(request, { timeout: 30000 });

      expect(result.success).toBe(true);
      expect(result.output.operation).toBe('branch-merge');
    });

    it('should execute worktree prune', async () => {
      const request = createTestRequest('Prune old worktrees', mockContext);
      const result = await agent.execute(request, { timeout: 30000 });

      expect(result.success).toBe(true);
      expect(result.output.operation).toBe('worktree-prune');
    });

    it('should execute branch deletion', async () => {
      // First create and merge a branch
      const branchManager = agent.getBranchManager();
      const branch = await branchManager.createBranch({ name: 'to-delete', type: 'feature' });
      branch.status = 'merged';

      const request = createTestRequest('Delete branch feature/to-delete', mockContext);
      const result = await agent.execute(request, { timeout: 30000 });

      expect(result.success).toBe(true);
      expect(result.output.operation).toBe('branch-delete');
    });

    it('should handle errors gracefully', async () => {
      // Try to delete a protected branch
      const request = createTestRequest('Force delete branch main', mockContext);
      const result = await agent.execute(request, { timeout: 30000 });

      // Should succeed but operation fails
      expect(result.success).toBe(true);
      expect(result.output.success).toBe(false);
      expect(result.output.message).toContain('protected');
    });

    it('should return routing information', async () => {
      const request = createTestRequest('Create feature branch new-feature', mockContext);
      const result = await agent.execute(request, { timeout: 30000 });

      // Routing is optional but output should have suggestions
      expect(result.success).toBe(true);
      expect(result.output.message).toBeDefined();
    });
  });

  describe('Operation Parsing', () => {
    it('should parse create branch operations', async () => {
      const prompts = [
        'Create a new feature branch',
        'Create branch for user-auth',
        'Create a branch called login',
      ];

      for (const prompt of prompts) {
        const request = createTestRequest(prompt, mockContext);
        const result = await agent.execute(request, { timeout: 30000 });
        expect(result.output.operation).toBe('branch-create');
      }
    });

    it('should parse checkout operations', async () => {
      // Setup
      const branchManager = agent.getBranchManager();
      await branchManager.createBranch({ name: 'test', type: 'feature' });

      const prompts = [
        'Checkout feature/test',
        'Switch to feature/test',
      ];

      for (const prompt of prompts) {
        const request = createTestRequest(prompt, mockContext);
        const result = await agent.execute(request, { timeout: 30000 });
        expect(result.output.operation).toBe('branch-checkout');
      }
    });

    it('should parse merge operations', async () => {
      // Setup
      const branchManager = agent.getBranchManager();
      await branchManager.createBranch({ name: 'feature-1', type: 'feature' });
      await branchManager.createBranch({ name: 'main', type: 'main' });

      const request = createTestRequest('Merge feature/feature-1', mockContext);
      const result = await agent.execute(request, { timeout: 30000 });

      expect(result.output.operation).toBe('branch-merge');
    });

    it('should parse worktree operations', async () => {
      const addRequest = createTestRequest('Add a new worktree for branch feature/test', mockContext);
      const addResult = await agent.execute(addRequest, { timeout: 30000 });
      expect(addResult.output.operation).toBe('worktree-add');

      // Setup a worktree first
      const worktreeManager = agent.getWorktreeManager();
      await worktreeManager.addWorktree({ path: '/test-wt', branch: 'branch-to-remove' });

      const removeRequest = createTestRequest('Remove worktree at /test-wt force', mockContext);
      const removeResult = await agent.execute(removeRequest, { timeout: 30000 });
      expect(removeResult.output.operation).toBe('worktree-remove');
    });
  });

  describe('Branch Type Detection', () => {
    it('should detect bugfix type', async () => {
      const request = createTestRequest('Create a bugfix branch for issue-123', mockContext);
      const result = await agent.execute(request, { timeout: 30000 });

      expect(result.output.branches?.[0]?.type).toBe('bugfix');
    });

    it('should detect hotfix type', async () => {
      const request = createTestRequest('Create a hotfix branch for security-patch', mockContext);
      const result = await agent.execute(request, { timeout: 30000 });

      expect(result.output.branches?.[0]?.type).toBe('hotfix');
    });

    it('should default to feature type', async () => {
      const request = createTestRequest('Create branch my-new-feature', mockContext);
      const result = await agent.execute(request, { timeout: 30000 });

      expect(result.output.branches?.[0]?.type).toBe('feature');
    });
  });

  describe('Status Operations', () => {
    it('should return status with branches, worktrees, and locks', async () => {
      // Setup some state
      const branchManager = agent.getBranchManager();
      const worktreeManager = agent.getWorktreeManager();
      const lockManager = agent.getFileLockManager();

      await branchManager.createBranch({ name: 'test', type: 'feature' });
      await worktreeManager.addWorktree({ path: '/wt', branch: 'wt-branch' });
      await lockManager.acquireLock({ path: '/file.ts', type: 'exclusive', holder: 'agent' });

      const request = createTestRequest('Show git status', mockContext);
      const result = await agent.execute(request, { timeout: 30000 });

      expect(result.success).toBe(true);
      expect(result.output.branches?.length).toBe(1);
      expect(result.output.worktrees?.length).toBe(1);
      expect(result.output.locks?.length).toBe(1);
    });
  });

  describe('Integration with Managers', () => {
    it('should share state between agent and direct manager calls', async () => {
      // Create branch via agent
      const request = createTestRequest('Create feature branch shared-test', mockContext);
      await agent.execute(request, { timeout: 30000 });

      // Verify via manager
      const branchManager = agent.getBranchManager();
      const branch = branchManager.getBranch('feature/shared-test');

      expect(branch).toBeDefined();
      expect(branch?.name).toBe('shared-test');
    });

    it('should reflect manager changes in agent operations', async () => {
      // Create worktree via manager
      const worktreeManager = agent.getWorktreeManager();
      await worktreeManager.addWorktree({ path: '/direct-wt', branch: 'direct-branch' });

      // Get status via agent
      const request = createTestRequest('Get status', mockContext);
      const result = await agent.execute(request, { timeout: 30000 });

      expect(result.output.worktrees?.length).toBe(1);
      expect(result.output.worktrees?.[0].path).toBe('/direct-wt');
    });
  });
});
