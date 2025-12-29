/**
 * Git Types
 *
 * Type definitions for Git operations, branches, and worktrees.
 */

/**
 * Branch type
 */
export type BranchType = 'feature' | 'bugfix' | 'hotfix' | 'release' | 'main' | 'develop' | 'custom';

/**
 * Branch prefix mapping
 */
export const BRANCH_PREFIXES: Record<BranchType, string> = {
  feature: 'feature/',
  bugfix: 'bugfix/',
  hotfix: 'hotfix/',
  release: 'release/',
  main: '',
  develop: '',
  custom: '',
};

/**
 * Branch status
 */
export type BranchStatus = 'active' | 'merged' | 'stale' | 'conflicted' | 'unknown';

/**
 * Worktree status
 */
export type WorktreeStatus = 'active' | 'idle' | 'locked' | 'prunable';

/**
 * File lock type
 */
export type LockType = 'exclusive' | 'shared';

/**
 * Lock status
 */
export type LockStatus = 'acquired' | 'waiting' | 'released' | 'expired';

/**
 * Git operation type
 */
export type GitOperation =
  | 'branch-create'
  | 'branch-delete'
  | 'branch-checkout'
  | 'branch-merge'
  | 'commit'
  | 'push'
  | 'pull'
  | 'fetch'
  | 'rebase'
  | 'stash'
  | 'status'
  | 'worktree-add'
  | 'worktree-remove'
  | 'worktree-prune';

/**
 * Branch info
 */
export interface BranchInfo {
  name: string;
  type: BranchType;
  fullName: string;
  isRemote: boolean;
  tracking?: string;
  ahead?: number;
  behind?: number;
  lastCommit?: CommitInfo;
  status: BranchStatus;
  createdAt?: Date;
  updatedAt?: Date;
}

/**
 * Commit info
 */
export interface CommitInfo {
  hash: string;
  shortHash: string;
  message: string;
  author: string;
  authorEmail: string;
  date: Date;
  parents: string[];
}

/**
 * Worktree info
 */
export interface WorktreeInfo {
  path: string;
  branch: string;
  commit: string;
  isMain: boolean;
  isLocked: boolean;
  lockReason?: string;
  status: WorktreeStatus;
  createdAt?: Date;
}

/**
 * File lock
 */
export interface FileLock {
  id: string;
  path: string;
  type: LockType;
  holder: string;
  worktree?: string;
  status: LockStatus;
  acquiredAt: Date;
  expiresAt?: Date;
  waiters?: string[];
}

/**
 * Lock request
 */
export interface LockRequest {
  path: string;
  type: LockType;
  holder: string;
  worktree?: string;
  timeout?: number;
}

/**
 * Lock result
 */
export interface LockResult {
  success: boolean;
  lock?: FileLock;
  error?: string;
  waitPosition?: number;
}

/**
 * Branch create options
 */
export interface BranchCreateOptions {
  name: string;
  type: BranchType;
  baseBranch?: string;
  checkout?: boolean;
  track?: boolean;
  push?: boolean;
}

/**
 * Branch delete options
 */
export interface BranchDeleteOptions {
  name: string;
  force?: boolean;
  deleteRemote?: boolean;
  pruneWorktree?: boolean;
}

/**
 * Merge options
 */
export interface MergeOptions {
  sourceBranch: string;
  targetBranch?: string;
  strategy?: 'merge' | 'rebase' | 'squash';
  noCommit?: boolean;
  message?: string;
  abortOnConflict?: boolean;
}

/**
 * Merge result
 */
export interface MergeResult {
  success: boolean;
  merged: boolean;
  conflicts?: ConflictInfo[];
  commit?: CommitInfo;
  error?: string;
}

/**
 * Conflict info
 */
export interface ConflictInfo {
  path: string;
  type: ConflictType;
  ourVersion?: string;
  theirVersion?: string;
  baseVersion?: string;
  resolution?: ConflictResolution;
}

/**
 * Conflict type
 */
export type ConflictType =
  | 'content'      // Both modified same lines
  | 'rename'       // Both renamed differently
  | 'delete'       // One deleted, other modified
  | 'add'          // Both added different files
  | 'mode'         // File mode conflict
  | 'binary'       // Binary file conflict
  | 'dependency';  // Semantic dependency conflict

/**
 * Conflict resolution
 */
export type ConflictResolution = 'ours' | 'theirs' | 'manual' | 'merged';

/**
 * Worktree create options
 */
export interface WorktreeCreateOptions {
  path: string;
  branch: string;
  createBranch?: boolean;
  baseBranch?: string;
  checkout?: boolean;
  lock?: boolean;
  lockReason?: string;
}

/**
 * Worktree remove options
 */
export interface WorktreeRemoveOptions {
  path: string;
  force?: boolean;
  pruneBranch?: boolean;
}

/**
 * Git status
 */
export interface GitStatus {
  branch: string;
  ahead: number;
  behind: number;
  staged: FileChange[];
  unstaged: FileChange[];
  untracked: string[];
  conflicts: string[];
  stashed: number;
}

/**
 * File change
 */
export interface FileChange {
  path: string;
  status: FileStatus;
  oldPath?: string;
}

/**
 * File status
 */
export type FileStatus =
  | 'added'
  | 'modified'
  | 'deleted'
  | 'renamed'
  | 'copied'
  | 'untracked'
  | 'ignored';

/**
 * Git config
 */
export interface GitConfig {
  user?: {
    name?: string;
    email?: string;
  };
  remote?: {
    origin?: string;
  };
  branch?: {
    default?: string;
  };
}

/**
 * Repository info
 */
export interface RepositoryInfo {
  path: string;
  isGitRepo: boolean;
  isBare: boolean;
  remotes: RemoteInfo[];
  branches: BranchInfo[];
  worktrees: WorktreeInfo[];
  config: GitConfig;
  head?: string;
}

/**
 * Remote info
 */
export interface RemoteInfo {
  name: string;
  fetchUrl?: string;
  pushUrl?: string;
}

/**
 * Git operation result
 */
export interface GitOperationResult {
  success: boolean;
  operation: GitOperation;
  message?: string;
  error?: string;
  data?: unknown;
  duration: number;
}

/**
 * Git event
 */
export interface GitEvent {
  type: GitEventType;
  timestamp: Date;
  operation?: GitOperation;
  data?: unknown;
}

/**
 * Git event type
 */
export type GitEventType =
  | 'branch:created'
  | 'branch:deleted'
  | 'branch:merged'
  | 'branch:checked-out'
  | 'worktree:added'
  | 'worktree:removed'
  | 'worktree:locked'
  | 'worktree:unlocked'
  | 'file:locked'
  | 'file:unlocked'
  | 'commit:created'
  | 'push:completed'
  | 'pull:completed'
  | 'conflict:detected'
  | 'conflict:resolved'
  | 'error:occurred';

/**
 * Branch manager config
 */
export interface BranchManagerConfig {
  defaultBaseBranch: string;
  protectedBranches: string[];
  branchPatterns: Record<BranchType, string>;
  autoDeleteMerged: boolean;
  staleBranchDays: number;
}

/**
 * Default branch manager config
 */
export const DEFAULT_BRANCH_CONFIG: BranchManagerConfig = {
  defaultBaseBranch: 'main',
  protectedBranches: ['main', 'master', 'develop', 'staging', 'production'],
  branchPatterns: {
    feature: 'feature/{name}',
    bugfix: 'bugfix/{name}',
    hotfix: 'hotfix/{name}',
    release: 'release/{version}',
    main: 'main',
    develop: 'develop',
    custom: '{name}',
  },
  autoDeleteMerged: true,
  staleBranchDays: 30,
};

/**
 * Worktree manager config
 */
export interface WorktreeManagerConfig {
  baseDir: string;
  maxWorktrees: number;
  autoCleanup: boolean;
  cleanupDays: number;
  lockTimeout: number;
}

/**
 * Default worktree manager config
 */
export const DEFAULT_WORKTREE_CONFIG: WorktreeManagerConfig = {
  baseDir: '.worktrees',
  maxWorktrees: 10,
  autoCleanup: true,
  cleanupDays: 7,
  lockTimeout: 3600000, // 1 hour
};

/**
 * File lock manager config
 */
export interface FileLockManagerConfig {
  lockDir: string;
  defaultTimeout: number;
  maxWaiters: number;
  cleanupInterval: number;
  allowSharedUpgrade: boolean;
}

/**
 * Default file lock manager config
 */
export const DEFAULT_LOCK_CONFIG: FileLockManagerConfig = {
  lockDir: '.locks',
  defaultTimeout: 300000, // 5 minutes
  maxWaiters: 10,
  cleanupInterval: 60000, // 1 minute
  allowSharedUpgrade: true,
};

/**
 * Git agent output
 */
export interface GitAgentOutput {
  operation: GitOperation;
  success: boolean;
  result?: GitOperationResult;
  branches?: BranchInfo[];
  worktrees?: WorktreeInfo[];
  status?: GitStatus;
  conflicts?: ConflictInfo[];
  locks?: FileLock[];
  message?: string;
  suggestions?: string[];
}
