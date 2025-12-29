# Step 09: Git Agent

> **Checkpoint:** CP2 - Git Worktrees
> **Previous Step:** 08-USER-FLOWS.md (CP1)
> **Next Step:** 10-WORKTREE-ISOLATION.md

---

## Overview

The Git Agent manages all git operations for the orchestrator. It handles branch creation, worktree management, commits, and merges. This agent enables parallel feature development through git worktrees.

Key responsibilities:
- Branch creation following naming conventions
- Worktree creation per feature (not per agent type)
- Commit management with structured messages
- Branch status and history tracking
- Safe merge operations

---

## Deliverables

1. `src/git/git-agent.ts` - Git agent implementation
2. `src/git/worktree-manager.ts` - Worktree lifecycle management
3. `src/git/branch-manager.ts` - Branch operations
4. `src/git/types.ts` - Git-related type definitions
5. `src/git/index.ts` - Public exports

---

## File Structure

```
src/git/
├── git-agent.ts        # Main Git agent
├── worktree-manager.ts # Worktree operations
├── branch-manager.ts   # Branch operations
├── types.ts            # Type definitions
└── index.ts            # Public exports
```

---

## 1. Git Types (`src/git/types.ts`)

```typescript
/**
 * Git Types
 *
 * Type definitions for git operations, branches, and worktrees.
 */

import { z } from 'zod';

/**
 * Branch naming convention
 */
export const BranchTypeSchema = z.enum([
  'feature',
  'bugfix',
  'hotfix',
  'release',
  'experiment',
]);

export type BranchType = z.infer<typeof BranchTypeSchema>;

/**
 * Branch information
 */
export interface BranchInfo {
  name: string;
  type: BranchType;
  featureId: string;
  createdAt: Date;
  lastCommit: string;
  ahead: number;
  behind: number;
  isRemote: boolean;
  isCurrent: boolean;
}

/**
 * Worktree status
 */
export type WorktreeStatus = 'active' | 'stale' | 'locked' | 'prunable';

/**
 * Worktree information
 */
export interface WorktreeInfo {
  path: string;
  branch: string;
  featureId: string;
  status: WorktreeStatus;
  createdAt: Date;
  lastActivity: Date;
  isMain: boolean;
  lockedBy?: string;
  lockedReason?: string;
}

/**
 * Commit information
 */
export interface CommitInfo {
  hash: string;
  shortHash: string;
  message: string;
  author: string;
  authorEmail: string;
  date: Date;
  files: string[];
  insertions: number;
  deletions: number;
}

/**
 * File change status
 */
export type FileStatus =
  | 'added'
  | 'modified'
  | 'deleted'
  | 'renamed'
  | 'copied'
  | 'untracked'
  | 'ignored'
  | 'conflicted';

/**
 * File change information
 */
export interface FileChange {
  path: string;
  status: FileStatus;
  oldPath?: string;      // For renames
  staged: boolean;
  insertions?: number;
  deletions?: number;
}

/**
 * Repository status
 */
export interface RepoStatus {
  branch: string;
  isClean: boolean;
  staged: FileChange[];
  unstaged: FileChange[];
  untracked: FileChange[];
  conflicted: FileChange[];
  ahead: number;
  behind: number;
  stashCount: number;
}

/**
 * Merge result
 */
export interface MergeResult {
  success: boolean;
  mergeCommit?: string;
  conflicts?: string[];
  message: string;
}

/**
 * Git operation result
 */
export interface GitOperationResult<T = void> {
  success: boolean;
  data?: T;
  error?: string;
  warnings?: string[];
}

/**
 * Branch creation options
 */
export interface CreateBranchOptions {
  type: BranchType;
  name: string;
  featureId: string;
  baseBranch?: string;
  createWorktree?: boolean;
  checkout?: boolean;
}

/**
 * Worktree creation options
 */
export interface CreateWorktreeOptions {
  featureId: string;
  branch: string;
  basePath?: string;
  lock?: boolean;
  lockReason?: string;
}

/**
 * Commit options
 */
export interface CommitOptions {
  message: string;
  description?: string;
  files?: string[];        // Specific files to commit (default: all staged)
  allowEmpty?: boolean;
  amend?: boolean;
  noVerify?: boolean;      // Skip hooks
  signoff?: boolean;
  author?: string;
}

/**
 * Merge options
 */
export interface MergeOptions {
  source: string;          // Branch to merge from
  target?: string;         // Branch to merge into (default: current)
  strategy?: 'ours' | 'theirs' | 'recursive';
  noFastForward?: boolean;
  squash?: boolean;
  message?: string;
}

/**
 * Git configuration
 */
export interface GitConfig {
  defaultBranch: string;
  remoteName: string;
  branchPrefix: Record<BranchType, string>;
  worktreeBasePath: string;
  commitMessageFormat: string;
  signCommits: boolean;
}

/**
 * Default git configuration
 */
export const DEFAULT_GIT_CONFIG: GitConfig = {
  defaultBranch: 'main',
  remoteName: 'origin',
  branchPrefix: {
    feature: 'feature/',
    bugfix: 'bugfix/',
    hotfix: 'hotfix/',
    release: 'release/',
    experiment: 'experiment/',
  },
  worktreeBasePath: '../worktrees',
  commitMessageFormat: '[{type}] {message}',
  signCommits: false,
};
```

---

## 2. Branch Manager (`src/git/branch-manager.ts`)

```typescript
/**
 * Branch Manager
 *
 * Handles all branch-related git operations.
 */

import simpleGit, { SimpleGit, BranchSummary, LogResult } from 'simple-git';
import {
  BranchInfo,
  BranchType,
  CreateBranchOptions,
  GitConfig,
  GitOperationResult,
  CommitInfo,
  DEFAULT_GIT_CONFIG,
} from './types';
import { logger } from '../utils/logger';

/**
 * Branch Manager class
 */
export class BranchManager {
  private git: SimpleGit;
  private config: GitConfig;
  private repoPath: string;

  constructor(repoPath: string, config: Partial<GitConfig> = {}) {
    this.repoPath = repoPath;
    this.config = { ...DEFAULT_GIT_CONFIG, ...config };
    this.git = simpleGit(repoPath);
  }

  /**
   * Initialize git repository if needed
   */
  async ensureRepo(): Promise<GitOperationResult> {
    try {
      const isRepo = await this.git.checkIsRepo();
      if (!isRepo) {
        await this.git.init();
        logger.info('Initialized new git repository', { path: this.repoPath });
      }
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: `Failed to ensure repository: ${error}`,
      };
    }
  }

  /**
   * Get current branch name
   */
  async getCurrentBranch(): Promise<string> {
    const branch = await this.git.revparse(['--abbrev-ref', 'HEAD']);
    return branch.trim();
  }

  /**
   * List all branches
   */
  async listBranches(): Promise<BranchInfo[]> {
    const summary: BranchSummary = await this.git.branch(['-a', '-v']);
    const branches: BranchInfo[] = [];

    for (const [name, data] of Object.entries(summary.branches)) {
      // Parse branch type from name
      const type = this.parseBranchType(name);
      const featureId = this.parseFeatureId(name);

      branches.push({
        name: name.replace('remotes/origin/', ''),
        type,
        featureId,
        createdAt: new Date(), // Would need additional git log call
        lastCommit: data.commit,
        ahead: 0,  // Would need tracking info
        behind: 0,
        isRemote: name.startsWith('remotes/'),
        isCurrent: data.current,
      });
    }

    return branches;
  }

  /**
   * Create a new branch
   */
  async createBranch(options: CreateBranchOptions): Promise<GitOperationResult<BranchInfo>> {
    const prefix = this.config.branchPrefix[options.type];
    const branchName = `${prefix}${options.name}`;
    const baseBranch = options.baseBranch || this.config.defaultBranch;

    try {
      // Ensure we're on the base branch first
      await this.git.checkout(baseBranch);
      await this.git.pull(this.config.remoteName, baseBranch).catch(() => {
        // Ignore pull errors for new repos without remote
      });

      // Create the new branch
      await this.git.checkoutLocalBranch(branchName);

      logger.info('Created branch', { branch: branchName, base: baseBranch });

      const branchInfo: BranchInfo = {
        name: branchName,
        type: options.type,
        featureId: options.featureId,
        createdAt: new Date(),
        lastCommit: await this.git.revparse(['HEAD']),
        ahead: 0,
        behind: 0,
        isRemote: false,
        isCurrent: true,
      };

      return { success: true, data: branchInfo };
    } catch (error) {
      logger.error('Failed to create branch', { branch: branchName, error });
      return {
        success: false,
        error: `Failed to create branch ${branchName}: ${error}`,
      };
    }
  }

  /**
   * Switch to a branch
   */
  async checkout(branchName: string): Promise<GitOperationResult> {
    try {
      await this.git.checkout(branchName);
      logger.debug('Checked out branch', { branch: branchName });
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: `Failed to checkout ${branchName}: ${error}`,
      };
    }
  }

  /**
   * Delete a branch
   */
  async deleteBranch(
    branchName: string,
    options: { force?: boolean; deleteRemote?: boolean } = {}
  ): Promise<GitOperationResult> {
    try {
      // Delete local branch
      const deleteFlag = options.force ? '-D' : '-d';
      await this.git.branch([deleteFlag, branchName]);

      // Delete remote branch if requested
      if (options.deleteRemote) {
        await this.git.push(this.config.remoteName, `:${branchName}`).catch(() => {
          // Ignore if remote doesn't exist
        });
      }

      logger.info('Deleted branch', { branch: branchName });
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: `Failed to delete branch ${branchName}: ${error}`,
      };
    }
  }

  /**
   * Get branch history
   */
  async getBranchHistory(
    branchName: string,
    limit: number = 50
  ): Promise<CommitInfo[]> {
    const log: LogResult = await this.git.log({
      maxCount: limit,
      from: branchName,
    });

    return log.all.map(entry => ({
      hash: entry.hash,
      shortHash: entry.hash.substring(0, 7),
      message: entry.message,
      author: entry.author_name,
      authorEmail: entry.author_email,
      date: new Date(entry.date),
      files: [],  // Would need --stat parsing
      insertions: 0,
      deletions: 0,
    }));
  }

  /**
   * Check if branch exists
   */
  async branchExists(branchName: string): Promise<boolean> {
    try {
      const branches = await this.git.branch(['-a']);
      return branches.all.some(b =>
        b === branchName || b === `remotes/${this.config.remoteName}/${branchName}`
      );
    } catch {
      return false;
    }
  }

  /**
   * Get tracking information for a branch
   */
  async getTrackingInfo(branchName: string): Promise<{ ahead: number; behind: number }> {
    try {
      const remoteBranch = `${this.config.remoteName}/${branchName}`;

      // Fetch latest from remote
      await this.git.fetch(this.config.remoteName, branchName).catch(() => {});

      // Get ahead/behind counts
      const result = await this.git.raw([
        'rev-list',
        '--left-right',
        '--count',
        `${branchName}...${remoteBranch}`,
      ]);

      const [ahead, behind] = result.trim().split('\t').map(Number);
      return { ahead: ahead || 0, behind: behind || 0 };
    } catch {
      return { ahead: 0, behind: 0 };
    }
  }

  /**
   * Parse branch type from name
   */
  private parseBranchType(branchName: string): BranchType {
    for (const [type, prefix] of Object.entries(this.config.branchPrefix)) {
      if (branchName.includes(prefix)) {
        return type as BranchType;
      }
    }
    return 'feature'; // Default
  }

  /**
   * Parse feature ID from branch name
   */
  private parseFeatureId(branchName: string): string {
    // Extract everything after the prefix
    for (const prefix of Object.values(this.config.branchPrefix)) {
      if (branchName.includes(prefix)) {
        return branchName.split(prefix)[1] || branchName;
      }
    }
    return branchName;
  }

  /**
   * Generate branch name from options
   */
  generateBranchName(type: BranchType, name: string): string {
    const prefix = this.config.branchPrefix[type];
    const sanitized = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    return `${prefix}${sanitized}`;
  }
}
```

---

## 3. Worktree Manager (`src/git/worktree-manager.ts`)

```typescript
/**
 * Worktree Manager
 *
 * Manages git worktrees for feature isolation.
 * Each feature gets its own worktree where FE and BE agents work in parallel.
 */

import simpleGit, { SimpleGit } from 'simple-git';
import path from 'path';
import fs from 'fs';
import {
  WorktreeInfo,
  WorktreeStatus,
  CreateWorktreeOptions,
  GitOperationResult,
  GitConfig,
  DEFAULT_GIT_CONFIG,
} from './types';
import { logger } from '../utils/logger';

/**
 * Worktree Manager class
 */
export class WorktreeManager {
  private git: SimpleGit;
  private config: GitConfig;
  private repoPath: string;
  private worktrees: Map<string, WorktreeInfo> = new Map();

  constructor(repoPath: string, config: Partial<GitConfig> = {}) {
    this.repoPath = repoPath;
    this.config = { ...DEFAULT_GIT_CONFIG, ...config };
    this.git = simpleGit(repoPath);
  }

  /**
   * List all worktrees
   */
  async listWorktrees(): Promise<WorktreeInfo[]> {
    try {
      const output = await this.git.raw(['worktree', 'list', '--porcelain']);
      return this.parseWorktreeList(output);
    } catch (error) {
      logger.error('Failed to list worktrees', { error });
      return [];
    }
  }

  /**
   * Create a new worktree for a feature
   */
  async createWorktree(options: CreateWorktreeOptions): Promise<GitOperationResult<WorktreeInfo>> {
    const worktreePath = this.getWorktreePath(options.featureId, options.basePath);

    try {
      // Check if worktree already exists
      const existing = await this.getWorktree(options.featureId);
      if (existing) {
        return {
          success: false,
          error: `Worktree already exists for feature: ${options.featureId}`,
        };
      }

      // Ensure parent directory exists
      const parentDir = path.dirname(worktreePath);
      if (!fs.existsSync(parentDir)) {
        fs.mkdirSync(parentDir, { recursive: true });
      }

      // Create the worktree
      await this.git.raw(['worktree', 'add', worktreePath, options.branch]);

      logger.info('Created worktree', {
        featureId: options.featureId,
        path: worktreePath,
        branch: options.branch,
      });

      // Lock if requested
      if (options.lock) {
        await this.lockWorktree(options.featureId, options.lockReason || 'In use');
      }

      const worktreeInfo: WorktreeInfo = {
        path: worktreePath,
        branch: options.branch,
        featureId: options.featureId,
        status: options.lock ? 'locked' : 'active',
        createdAt: new Date(),
        lastActivity: new Date(),
        isMain: false,
        lockedBy: options.lock ? 'system' : undefined,
        lockedReason: options.lockReason,
      };

      this.worktrees.set(options.featureId, worktreeInfo);

      return { success: true, data: worktreeInfo };
    } catch (error) {
      logger.error('Failed to create worktree', { featureId: options.featureId, error });
      return {
        success: false,
        error: `Failed to create worktree: ${error}`,
      };
    }
  }

  /**
   * Get worktree by feature ID
   */
  async getWorktree(featureId: string): Promise<WorktreeInfo | undefined> {
    // Check cache first
    if (this.worktrees.has(featureId)) {
      return this.worktrees.get(featureId);
    }

    // Refresh from git
    const worktrees = await this.listWorktrees();
    return worktrees.find(w => w.featureId === featureId);
  }

  /**
   * Get worktree path for a feature
   */
  getWorktreePath(featureId: string, basePath?: string): string {
    const base = basePath || path.join(path.dirname(this.repoPath), 'worktrees');
    const sanitizedId = featureId.replace(/[^a-zA-Z0-9-_]/g, '-');
    return path.join(base, sanitizedId);
  }

  /**
   * Remove a worktree
   */
  async removeWorktree(
    featureId: string,
    options: { force?: boolean } = {}
  ): Promise<GitOperationResult> {
    try {
      const worktree = await this.getWorktree(featureId);
      if (!worktree) {
        return {
          success: false,
          error: `Worktree not found: ${featureId}`,
        };
      }

      // Unlock if locked
      if (worktree.status === 'locked') {
        await this.unlockWorktree(featureId);
      }

      // Remove the worktree
      const args = ['worktree', 'remove'];
      if (options.force) {
        args.push('--force');
      }
      args.push(worktree.path);

      await this.git.raw(args);

      // Clean up cache
      this.worktrees.delete(featureId);

      logger.info('Removed worktree', { featureId, path: worktree.path });

      return { success: true };
    } catch (error) {
      logger.error('Failed to remove worktree', { featureId, error });
      return {
        success: false,
        error: `Failed to remove worktree: ${error}`,
      };
    }
  }

  /**
   * Lock a worktree to prevent accidental removal
   */
  async lockWorktree(featureId: string, reason?: string): Promise<GitOperationResult> {
    try {
      const worktree = await this.getWorktree(featureId);
      if (!worktree) {
        return { success: false, error: `Worktree not found: ${featureId}` };
      }

      const args = ['worktree', 'lock', worktree.path];
      if (reason) {
        args.push('--reason', reason);
      }

      await this.git.raw(args);

      // Update cache
      if (this.worktrees.has(featureId)) {
        const info = this.worktrees.get(featureId)!;
        info.status = 'locked';
        info.lockedReason = reason;
      }

      logger.debug('Locked worktree', { featureId, reason });
      return { success: true };
    } catch (error) {
      return { success: false, error: `Failed to lock worktree: ${error}` };
    }
  }

  /**
   * Unlock a worktree
   */
  async unlockWorktree(featureId: string): Promise<GitOperationResult> {
    try {
      const worktree = await this.getWorktree(featureId);
      if (!worktree) {
        return { success: false, error: `Worktree not found: ${featureId}` };
      }

      await this.git.raw(['worktree', 'unlock', worktree.path]);

      // Update cache
      if (this.worktrees.has(featureId)) {
        const info = this.worktrees.get(featureId)!;
        info.status = 'active';
        info.lockedBy = undefined;
        info.lockedReason = undefined;
      }

      logger.debug('Unlocked worktree', { featureId });
      return { success: true };
    } catch (error) {
      return { success: false, error: `Failed to unlock worktree: ${error}` };
    }
  }

  /**
   * Prune stale worktrees
   */
  async pruneWorktrees(): Promise<GitOperationResult<string[]>> {
    try {
      // Find stale worktrees
      const output = await this.git.raw(['worktree', 'prune', '--dry-run']);
      const pruned = output.split('\n').filter(line => line.trim());

      // Actually prune
      await this.git.raw(['worktree', 'prune']);

      logger.info('Pruned worktrees', { count: pruned.length });

      return { success: true, data: pruned };
    } catch (error) {
      return { success: false, error: `Failed to prune worktrees: ${error}` };
    }
  }

  /**
   * Get git instance for a specific worktree
   */
  getWorktreeGit(featureId: string): SimpleGit | undefined {
    const worktree = this.worktrees.get(featureId);
    if (!worktree) {
      return undefined;
    }
    return simpleGit(worktree.path);
  }

  /**
   * Update last activity timestamp for a worktree
   */
  updateActivity(featureId: string): void {
    const worktree = this.worktrees.get(featureId);
    if (worktree) {
      worktree.lastActivity = new Date();
    }
  }

  /**
   * Check if worktree has uncommitted changes
   */
  async hasChanges(featureId: string): Promise<boolean> {
    const git = this.getWorktreeGit(featureId);
    if (!git) {
      return false;
    }

    const status = await git.status();
    return !status.isClean();
  }

  /**
   * Parse worktree list output
   */
  private parseWorktreeList(output: string): WorktreeInfo[] {
    const worktrees: WorktreeInfo[] = [];
    const entries = output.split('\n\n').filter(e => e.trim());

    for (const entry of entries) {
      const lines = entry.split('\n');
      const info: Partial<WorktreeInfo> = {
        status: 'active',
        createdAt: new Date(),
        lastActivity: new Date(),
      };

      for (const line of lines) {
        if (line.startsWith('worktree ')) {
          info.path = line.substring(9);
          info.isMain = info.path === this.repoPath;
        } else if (line.startsWith('HEAD ')) {
          // Skip HEAD
        } else if (line.startsWith('branch ')) {
          info.branch = line.substring(7).replace('refs/heads/', '');
        } else if (line === 'locked') {
          info.status = 'locked';
        } else if (line === 'prunable') {
          info.status = 'prunable';
        }
      }

      if (info.path && info.branch) {
        // Extract feature ID from path
        info.featureId = path.basename(info.path);

        worktrees.push(info as WorktreeInfo);
        this.worktrees.set(info.featureId, info as WorktreeInfo);
      }
    }

    return worktrees;
  }

  /**
   * Get worktree statistics
   */
  async getStats(): Promise<{
    total: number;
    active: number;
    locked: number;
    stale: number;
  }> {
    const worktrees = await this.listWorktrees();

    return {
      total: worktrees.length,
      active: worktrees.filter(w => w.status === 'active').length,
      locked: worktrees.filter(w => w.status === 'locked').length,
      stale: worktrees.filter(w => w.status === 'prunable').length,
    };
  }
}
```

---

## 4. Git Agent (`src/git/git-agent.ts`)

```typescript
/**
 * Git Agent
 *
 * Orchestrates git operations for the multi-agent system.
 * Handles branches, worktrees, commits, and merges.
 */

import simpleGit, { SimpleGit } from 'simple-git';
import { v4 as uuidv4 } from 'uuid';
import { BaseAgent } from '../agents/base-agent';
import { RegisterAgent } from '../agents/registry';
import {
  AgentMetadata,
  AgentContext,
  AgentRequest,
  Artifact,
  RoutingHints,
  AgentType,
} from '../agents/types';
import {
  GitConfig,
  GitOperationResult,
  RepoStatus,
  FileChange,
  CommitOptions,
  CommitInfo,
  MergeOptions,
  MergeResult,
  BranchInfo,
  WorktreeInfo,
  DEFAULT_GIT_CONFIG,
} from './types';
import { BranchManager } from './branch-manager';
import { WorktreeManager } from './worktree-manager';
import { logger } from '../utils/logger';

/**
 * Git Agent metadata
 */
const GIT_AGENT_METADATA: AgentMetadata = {
  id: AgentType.GIT_AGENT,
  name: 'Git Agent',
  description: 'Manages git operations including branches, worktrees, and merges',
  version: '1.0.0',
  capabilities: [
    {
      name: 'branch_management',
      description: 'Create, delete, and manage branches',
      inputTypes: ['branch_request'],
      outputTypes: ['branch_info'],
    },
    {
      name: 'worktree_management',
      description: 'Create and manage feature worktrees',
      inputTypes: ['worktree_request'],
      outputTypes: ['worktree_info'],
    },
    {
      name: 'commit_operations',
      description: 'Stage, commit, and manage changes',
      inputTypes: ['commit_request'],
      outputTypes: ['commit_info'],
    },
    {
      name: 'merge_operations',
      description: 'Merge branches with conflict detection',
      inputTypes: ['merge_request'],
      outputTypes: ['merge_result'],
    },
  ],
  requiredContext: [
    { type: 'current_task', required: true },
    { type: 'git_status', required: false },
  ],
  outputSchema: 'git-agent-output',
};

/**
 * Git operation types
 */
export type GitOperation =
  | { type: 'create_branch'; options: { name: string; featureId: string; type: 'feature' | 'bugfix' } }
  | { type: 'create_worktree'; options: { featureId: string; branch: string } }
  | { type: 'commit'; options: CommitOptions }
  | { type: 'merge'; options: MergeOptions }
  | { type: 'status' }
  | { type: 'sync' };

/**
 * Git Agent class
 */
@RegisterAgent
export class GitAgent extends BaseAgent {
  private git: SimpleGit;
  private branchManager: BranchManager;
  private worktreeManager: WorktreeManager;
  private config: GitConfig;
  private repoPath: string;

  constructor(repoPath: string = process.cwd(), config: Partial<GitConfig> = {}) {
    super(GIT_AGENT_METADATA);
    this.repoPath = repoPath;
    this.config = { ...DEFAULT_GIT_CONFIG, ...config };
    this.git = simpleGit(repoPath);
    this.branchManager = new BranchManager(repoPath, config);
    this.worktreeManager = new WorktreeManager(repoPath, config);
  }

  /**
   * Initialize repository
   */
  async initialize(): Promise<GitOperationResult> {
    return this.branchManager.ensureRepo();
  }

  /**
   * Get repository status
   */
  async getStatus(worktreePath?: string): Promise<RepoStatus> {
    const git = worktreePath ? simpleGit(worktreePath) : this.git;
    const status = await git.status();

    const mapFileChange = (file: string, staged: boolean): FileChange => ({
      path: file,
      status: 'modified',
      staged,
    });

    return {
      branch: status.current || '',
      isClean: status.isClean(),
      staged: status.staged.map(f => mapFileChange(f, true)),
      unstaged: status.modified.map(f => mapFileChange(f, false)),
      untracked: status.not_added.map(f => ({
        path: f,
        status: 'untracked',
        staged: false,
      })),
      conflicted: status.conflicted.map(f => ({
        path: f,
        status: 'conflicted',
        staged: false,
      })),
      ahead: status.ahead,
      behind: status.behind,
      stashCount: 0, // Would need separate stash list call
    };
  }

  /**
   * Create a feature worktree (the main operation for feature isolation)
   */
  async createFeatureWorktree(
    featureId: string,
    featureName: string
  ): Promise<GitOperationResult<{ branch: BranchInfo; worktree: WorktreeInfo }>> {
    // 1. Create the feature branch
    const branchResult = await this.branchManager.createBranch({
      type: 'feature',
      name: featureName,
      featureId,
      createWorktree: false,
      checkout: false,
    });

    if (!branchResult.success || !branchResult.data) {
      return {
        success: false,
        error: branchResult.error || 'Failed to create branch',
      };
    }

    // 2. Create the worktree for this feature
    const worktreeResult = await this.worktreeManager.createWorktree({
      featureId,
      branch: branchResult.data.name,
      lock: true,
      lockReason: 'Feature in development',
    });

    if (!worktreeResult.success || !worktreeResult.data) {
      // Rollback branch creation
      await this.branchManager.deleteBranch(branchResult.data.name, { force: true });
      return {
        success: false,
        error: worktreeResult.error || 'Failed to create worktree',
      };
    }

    logger.info('Created feature worktree', {
      featureId,
      branch: branchResult.data.name,
      worktreePath: worktreeResult.data.path,
    });

    return {
      success: true,
      data: {
        branch: branchResult.data,
        worktree: worktreeResult.data,
      },
    };
  }

  /**
   * Commit changes in a worktree
   */
  async commit(
    featureId: string,
    options: CommitOptions
  ): Promise<GitOperationResult<CommitInfo>> {
    const worktree = await this.worktreeManager.getWorktree(featureId);
    if (!worktree) {
      return { success: false, error: `Worktree not found: ${featureId}` };
    }

    const git = simpleGit(worktree.path);

    try {
      // Stage files
      if (options.files && options.files.length > 0) {
        await git.add(options.files);
      } else {
        await git.add('.');
      }

      // Build commit message
      let message = options.message;
      if (options.description) {
        message += `\n\n${options.description}`;
      }

      // Commit options
      const commitArgs: string[] = ['-m', message];
      if (options.allowEmpty) commitArgs.push('--allow-empty');
      if (options.noVerify) commitArgs.push('--no-verify');
      if (options.signoff) commitArgs.push('--signoff');
      if (options.author) commitArgs.push('--author', options.author);

      const result = await git.commit(message, undefined, {
        '--allow-empty': options.allowEmpty || null,
        '--no-verify': options.noVerify || null,
        '--signoff': options.signoff || null,
      });

      // Update worktree activity
      this.worktreeManager.updateActivity(featureId);

      const commitInfo: CommitInfo = {
        hash: result.commit,
        shortHash: result.commit.substring(0, 7),
        message: options.message,
        author: options.author || 'Aigentflow',
        authorEmail: 'aigentflow@example.com',
        date: new Date(),
        files: options.files || [],
        insertions: 0,
        deletions: 0,
      };

      logger.info('Created commit', {
        featureId,
        hash: commitInfo.shortHash,
        message: options.message,
      });

      return { success: true, data: commitInfo };
    } catch (error) {
      logger.error('Commit failed', { featureId, error });
      return { success: false, error: `Commit failed: ${error}` };
    }
  }

  /**
   * Merge a feature branch
   */
  async merge(options: MergeOptions): Promise<GitOperationResult<MergeResult>> {
    const targetBranch = options.target || this.config.defaultBranch;

    try {
      // Checkout target branch
      await this.git.checkout(targetBranch);

      // Pull latest
      await this.git.pull(this.config.remoteName, targetBranch).catch(() => {});

      // Perform merge
      const mergeArgs: string[] = [options.source];
      if (options.noFastForward) mergeArgs.push('--no-ff');
      if (options.squash) mergeArgs.push('--squash');
      if (options.message) mergeArgs.push('-m', options.message);

      await this.git.merge(mergeArgs);

      // Get merge commit
      const log = await this.git.log({ maxCount: 1 });
      const mergeCommit = log.latest?.hash;

      logger.info('Merge completed', {
        source: options.source,
        target: targetBranch,
        commit: mergeCommit,
      });

      return {
        success: true,
        data: {
          success: true,
          mergeCommit,
          message: `Merged ${options.source} into ${targetBranch}`,
        },
      };
    } catch (error: any) {
      // Check for merge conflicts
      if (error.message?.includes('CONFLICT')) {
        const status = await this.git.status();
        return {
          success: false,
          data: {
            success: false,
            conflicts: status.conflicted,
            message: 'Merge conflicts detected',
          },
        };
      }

      logger.error('Merge failed', { source: options.source, error });
      return {
        success: false,
        error: `Merge failed: ${error}`,
      };
    }
  }

  /**
   * Push changes to remote
   */
  async push(
    branch: string,
    options: { force?: boolean; setUpstream?: boolean } = {}
  ): Promise<GitOperationResult> {
    try {
      const pushArgs: string[] = [this.config.remoteName, branch];
      if (options.force) pushArgs.push('--force');
      if (options.setUpstream) pushArgs.push('--set-upstream');

      await this.git.push(pushArgs);

      logger.info('Pushed to remote', { branch });
      return { success: true };
    } catch (error) {
      return { success: false, error: `Push failed: ${error}` };
    }
  }

  /**
   * Pull latest changes
   */
  async pull(branch?: string): Promise<GitOperationResult> {
    try {
      const targetBranch = branch || await this.branchManager.getCurrentBranch();
      await this.git.pull(this.config.remoteName, targetBranch);

      logger.debug('Pulled from remote', { branch: targetBranch });
      return { success: true };
    } catch (error) {
      return { success: false, error: `Pull failed: ${error}` };
    }
  }

  /**
   * Clean up a feature (remove worktree and optionally branch)
   */
  async cleanupFeature(
    featureId: string,
    options: { deleteBranch?: boolean; force?: boolean } = {}
  ): Promise<GitOperationResult> {
    const worktree = await this.worktreeManager.getWorktree(featureId);

    if (worktree) {
      // Check for uncommitted changes
      if (!options.force) {
        const hasChanges = await this.worktreeManager.hasChanges(featureId);
        if (hasChanges) {
          return {
            success: false,
            error: 'Worktree has uncommitted changes. Use force to remove anyway.',
          };
        }
      }

      // Remove worktree
      const removeResult = await this.worktreeManager.removeWorktree(featureId, {
        force: options.force,
      });

      if (!removeResult.success) {
        return removeResult;
      }

      // Delete branch if requested
      if (options.deleteBranch && worktree.branch) {
        await this.branchManager.deleteBranch(worktree.branch, {
          force: options.force,
          deleteRemote: true,
        });
      }
    }

    logger.info('Cleaned up feature', { featureId });
    return { success: true };
  }

  // BaseAgent abstract method implementations

  protected buildSystemPrompt(context: AgentContext): string {
    return `You are a Git operations agent. You manage branches, worktrees, commits, and merges for feature development.`;
  }

  protected buildUserPrompt(request: AgentRequest): string {
    return `Execute git operation for task: ${request.task.taskType}`;
  }

  protected parseResponse(response: any): any {
    return this.extractTextContent(response);
  }

  protected async processResult(
    parsed: any,
    request: AgentRequest
  ): Promise<{ result: any; artifacts: Artifact[] }> {
    return { result: parsed, artifacts: [] };
  }

  protected generateRoutingHints(
    result: any,
    artifacts: Artifact[],
    request: AgentRequest
  ): RoutingHints {
    return {
      suggestNext: [],
      skipAgents: [],
      needsApproval: false,
      hasFailures: false,
      isComplete: true,
    };
  }

  // Accessors for sub-managers
  get branches(): BranchManager {
    return this.branchManager;
  }

  get worktrees(): WorktreeManager {
    return this.worktreeManager;
  }
}
```

---

## 5. Public Exports (`src/git/index.ts`)

```typescript
/**
 * Git Module Public Exports
 */

// Types
export * from './types';

// Managers
export { BranchManager } from './branch-manager';
export { WorktreeManager } from './worktree-manager';

// Agent
export { GitAgent, GitOperation } from './git-agent';
```

---

## Test Scenarios

### Test 1: Branch Manager

```typescript
// tests/git/branch-manager.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { BranchManager } from '../../src/git/branch-manager';
import simpleGit from 'simple-git';
import fs from 'fs';
import path from 'path';
import os from 'os';

describe('BranchManager', () => {
  let manager: BranchManager;
  let testRepoPath: string;

  beforeEach(async () => {
    // Create temporary test repository
    testRepoPath = path.join(os.tmpdir(), `test-repo-${Date.now()}`);
    fs.mkdirSync(testRepoPath, { recursive: true });

    const git = simpleGit(testRepoPath);
    await git.init();
    await git.addConfig('user.email', 'test@test.com');
    await git.addConfig('user.name', 'Test User');

    // Create initial commit
    fs.writeFileSync(path.join(testRepoPath, 'README.md'), '# Test');
    await git.add('.');
    await git.commit('Initial commit');

    manager = new BranchManager(testRepoPath);
  });

  afterEach(() => {
    fs.rmSync(testRepoPath, { recursive: true, force: true });
  });

  it('should get current branch', async () => {
    const branch = await manager.getCurrentBranch();
    expect(['main', 'master']).toContain(branch);
  });

  it('should create a feature branch', async () => {
    const result = await manager.createBranch({
      type: 'feature',
      name: 'user-auth',
      featureId: 'feat-001',
    });

    expect(result.success).toBe(true);
    expect(result.data?.name).toBe('feature/user-auth');
    expect(result.data?.type).toBe('feature');
  });

  it('should list branches', async () => {
    await manager.createBranch({
      type: 'feature',
      name: 'test-feature',
      featureId: 'feat-002',
    });

    const branches = await manager.listBranches();
    expect(branches.length).toBeGreaterThanOrEqual(2);
    expect(branches.some(b => b.name === 'feature/test-feature')).toBe(true);
  });

  it('should check if branch exists', async () => {
    await manager.createBranch({
      type: 'feature',
      name: 'exists-test',
      featureId: 'feat-003',
    });

    expect(await manager.branchExists('feature/exists-test')).toBe(true);
    expect(await manager.branchExists('feature/does-not-exist')).toBe(false);
  });

  it('should delete a branch', async () => {
    await manager.createBranch({
      type: 'feature',
      name: 'to-delete',
      featureId: 'feat-004',
    });

    // Switch to main first
    await manager.checkout('main');

    const result = await manager.deleteBranch('feature/to-delete');
    expect(result.success).toBe(true);
    expect(await manager.branchExists('feature/to-delete')).toBe(false);
  });

  it('should generate correct branch names', () => {
    expect(manager.generateBranchName('feature', 'User Auth')).toBe('feature/user-auth');
    expect(manager.generateBranchName('bugfix', 'Fix Login Bug')).toBe('bugfix/fix-login-bug');
    expect(manager.generateBranchName('hotfix', 'Security Patch')).toBe('hotfix/security-patch');
  });
});
```

### Test 2: Worktree Manager

```typescript
// tests/git/worktree-manager.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { WorktreeManager } from '../../src/git/worktree-manager';
import { BranchManager } from '../../src/git/branch-manager';
import simpleGit from 'simple-git';
import fs from 'fs';
import path from 'path';
import os from 'os';

describe('WorktreeManager', () => {
  let worktreeManager: WorktreeManager;
  let branchManager: BranchManager;
  let testRepoPath: string;
  let worktreeBasePath: string;

  beforeEach(async () => {
    // Create temporary test repository
    testRepoPath = path.join(os.tmpdir(), `test-repo-${Date.now()}`);
    worktreeBasePath = path.join(os.tmpdir(), `worktrees-${Date.now()}`);
    fs.mkdirSync(testRepoPath, { recursive: true });

    const git = simpleGit(testRepoPath);
    await git.init();
    await git.addConfig('user.email', 'test@test.com');
    await git.addConfig('user.name', 'Test User');

    fs.writeFileSync(path.join(testRepoPath, 'README.md'), '# Test');
    await git.add('.');
    await git.commit('Initial commit');

    branchManager = new BranchManager(testRepoPath);
    worktreeManager = new WorktreeManager(testRepoPath, {
      worktreeBasePath,
    });
  });

  afterEach(() => {
    fs.rmSync(testRepoPath, { recursive: true, force: true });
    fs.rmSync(worktreeBasePath, { recursive: true, force: true });
  });

  it('should create a worktree', async () => {
    // First create a branch
    await branchManager.createBranch({
      type: 'feature',
      name: 'test-feature',
      featureId: 'wt-001',
    });

    // Checkout main to allow worktree creation on feature branch
    await branchManager.checkout('main');

    const result = await worktreeManager.createWorktree({
      featureId: 'wt-001',
      branch: 'feature/test-feature',
      basePath: worktreeBasePath,
    });

    expect(result.success).toBe(true);
    expect(result.data?.featureId).toBe('wt-001');
    expect(fs.existsSync(result.data!.path)).toBe(true);
  });

  it('should list worktrees', async () => {
    const worktrees = await worktreeManager.listWorktrees();
    // Main repo is always listed as a worktree
    expect(worktrees.length).toBeGreaterThanOrEqual(1);
  });

  it('should lock and unlock worktree', async () => {
    await branchManager.createBranch({
      type: 'feature',
      name: 'lock-test',
      featureId: 'wt-002',
    });
    await branchManager.checkout('main');

    await worktreeManager.createWorktree({
      featureId: 'wt-002',
      branch: 'feature/lock-test',
      basePath: worktreeBasePath,
    });

    // Lock
    const lockResult = await worktreeManager.lockWorktree('wt-002', 'Testing');
    expect(lockResult.success).toBe(true);

    const worktree = await worktreeManager.getWorktree('wt-002');
    expect(worktree?.status).toBe('locked');

    // Unlock
    const unlockResult = await worktreeManager.unlockWorktree('wt-002');
    expect(unlockResult.success).toBe(true);
  });

  it('should remove a worktree', async () => {
    await branchManager.createBranch({
      type: 'feature',
      name: 'remove-test',
      featureId: 'wt-003',
    });
    await branchManager.checkout('main');

    const createResult = await worktreeManager.createWorktree({
      featureId: 'wt-003',
      branch: 'feature/remove-test',
      basePath: worktreeBasePath,
    });

    const worktreePath = createResult.data!.path;
    expect(fs.existsSync(worktreePath)).toBe(true);

    const removeResult = await worktreeManager.removeWorktree('wt-003', { force: true });
    expect(removeResult.success).toBe(true);
    expect(fs.existsSync(worktreePath)).toBe(false);
  });

  it('should get worktree statistics', async () => {
    const stats = await worktreeManager.getStats();
    expect(stats.total).toBeGreaterThanOrEqual(1);
    expect(typeof stats.active).toBe('number');
    expect(typeof stats.locked).toBe('number');
  });
});
```

### Test 3: Git Agent

```typescript
// tests/git/git-agent.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { GitAgent } from '../../src/git/git-agent';
import simpleGit from 'simple-git';
import fs from 'fs';
import path from 'path';
import os from 'os';

describe('GitAgent', () => {
  let agent: GitAgent;
  let testRepoPath: string;

  beforeEach(async () => {
    testRepoPath = path.join(os.tmpdir(), `test-repo-${Date.now()}`);
    fs.mkdirSync(testRepoPath, { recursive: true });

    const git = simpleGit(testRepoPath);
    await git.init();
    await git.addConfig('user.email', 'test@test.com');
    await git.addConfig('user.name', 'Test User');

    fs.writeFileSync(path.join(testRepoPath, 'README.md'), '# Test');
    await git.add('.');
    await git.commit('Initial commit');

    agent = new GitAgent(testRepoPath);
    await agent.initialize();
  });

  afterEach(() => {
    fs.rmSync(testRepoPath, { recursive: true, force: true });
  });

  it('should have correct metadata', () => {
    const metadata = agent.getMetadata();
    expect(metadata.id).toBe('git_agent');
    expect(metadata.capabilities.length).toBeGreaterThan(0);
  });

  it('should get repository status', async () => {
    const status = await agent.getStatus();

    expect(status.branch).toBeDefined();
    expect(status.isClean).toBe(true);
    expect(status.staged).toEqual([]);
    expect(status.unstaged).toEqual([]);
  });

  it('should detect uncommitted changes', async () => {
    // Create a new file
    fs.writeFileSync(path.join(testRepoPath, 'new-file.txt'), 'content');

    const status = await agent.getStatus();
    expect(status.isClean).toBe(false);
    expect(status.untracked.length).toBe(1);
  });

  it('should create feature worktree', async () => {
    const result = await agent.createFeatureWorktree('feat-001', 'user-authentication');

    expect(result.success).toBe(true);
    expect(result.data?.branch.name).toBe('feature/user-authentication');
    expect(result.data?.worktree.featureId).toBe('feat-001');
    expect(fs.existsSync(result.data!.worktree.path)).toBe(true);
  });

  it('should commit changes in worktree', async () => {
    // Create feature worktree
    const createResult = await agent.createFeatureWorktree('feat-002', 'test-commit');
    expect(createResult.success).toBe(true);

    // Add a file in the worktree
    const worktreePath = createResult.data!.worktree.path;
    fs.writeFileSync(path.join(worktreePath, 'feature-file.txt'), 'feature content');

    // Commit
    const commitResult = await agent.commit('feat-002', {
      message: 'Add feature file',
    });

    expect(commitResult.success).toBe(true);
    expect(commitResult.data?.message).toBe('Add feature file');
  });

  it('should clean up feature', async () => {
    const createResult = await agent.createFeatureWorktree('feat-003', 'cleanup-test');
    expect(createResult.success).toBe(true);

    const worktreePath = createResult.data!.worktree.path;
    expect(fs.existsSync(worktreePath)).toBe(true);

    const cleanupResult = await agent.cleanupFeature('feat-003', {
      deleteBranch: true,
      force: true,
    });

    expect(cleanupResult.success).toBe(true);
    expect(fs.existsSync(worktreePath)).toBe(false);
  });
});
```

### Test 4: Branch Naming Conventions

```typescript
// tests/git/branch-naming.test.ts
import { describe, it, expect } from 'vitest';
import { BranchManager } from '../../src/git/branch-manager';
import { DEFAULT_GIT_CONFIG } from '../../src/git/types';

describe('Branch Naming', () => {
  it('should use correct prefixes for branch types', () => {
    expect(DEFAULT_GIT_CONFIG.branchPrefix.feature).toBe('feature/');
    expect(DEFAULT_GIT_CONFIG.branchPrefix.bugfix).toBe('bugfix/');
    expect(DEFAULT_GIT_CONFIG.branchPrefix.hotfix).toBe('hotfix/');
    expect(DEFAULT_GIT_CONFIG.branchPrefix.release).toBe('release/');
    expect(DEFAULT_GIT_CONFIG.branchPrefix.experiment).toBe('experiment/');
  });

  it('should sanitize branch names', () => {
    // Using a mock manager without actual repo
    const manager = new BranchManager('/tmp/fake');

    expect(manager.generateBranchName('feature', 'Add User Auth'))
      .toBe('feature/add-user-auth');

    expect(manager.generateBranchName('bugfix', 'Fix Login Bug #123'))
      .toBe('bugfix/fix-login-bug-123');

    expect(manager.generateBranchName('feature', '  Spaces  Everywhere  '))
      .toBe('feature/spaces-everywhere');

    expect(manager.generateBranchName('feature', 'UPPERCASE-test'))
      .toBe('feature/uppercase-test');
  });
});
```

---

## Validation Checklist

```
□ Git Types
  □ Branch types defined
  □ Worktree status types
  □ Commit/merge options
  □ Default configuration

□ Branch Manager
  □ Create branches with naming convention
  □ List/delete branches
  □ Check branch existence
  □ Get tracking info

□ Worktree Manager
  □ Create worktrees per feature
  □ List/remove worktrees
  □ Lock/unlock worktrees
  □ Get worktree git instance
  □ Prune stale worktrees

□ Git Agent
  □ Extends BaseAgent
  □ Initialize repository
  □ Get status
  □ Create feature worktree (branch + worktree)
  □ Commit in worktree
  □ Merge branches
  □ Push/pull operations
  □ Feature cleanup

□ All tests pass
  □ npm run test -- tests/git/
```

---

## Next Step

Proceed to **10-WORKTREE-ISOLATION.md** to implement feature isolation and parallel agent execution within worktrees.
