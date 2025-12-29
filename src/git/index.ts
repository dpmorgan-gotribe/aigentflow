/**
 * Git Module
 *
 * Git operations, branch management, worktrees, and file locking.
 */

// Types
export type {
  BranchType,
  BranchStatus,
  WorktreeStatus,
  LockType,
  LockStatus,
  GitOperation,
  BranchInfo,
  CommitInfo,
  WorktreeInfo,
  FileLock,
  LockRequest,
  LockResult,
  BranchCreateOptions,
  BranchDeleteOptions,
  MergeOptions,
  MergeResult,
  ConflictInfo,
  ConflictType,
  ConflictResolution,
  WorktreeCreateOptions,
  WorktreeRemoveOptions,
  GitStatus,
  FileChange,
  FileStatus,
  GitConfig,
  RepositoryInfo,
  RemoteInfo,
  GitOperationResult,
  GitEvent,
  GitEventType,
  BranchManagerConfig,
  WorktreeManagerConfig,
  FileLockManagerConfig,
  GitAgentOutput,
} from './types.js';

export {
  BRANCH_PREFIXES,
  DEFAULT_BRANCH_CONFIG,
  DEFAULT_WORKTREE_CONFIG,
  DEFAULT_LOCK_CONFIG,
} from './types.js';

// Branch Manager
export {
  BranchManager,
  getBranchManager,
  resetBranchManager,
} from './branch-manager.js';

// Worktree Manager
export {
  WorktreeManager,
  getWorktreeManager,
  resetWorktreeManager,
} from './worktree-manager.js';

// File Lock Manager
export {
  FileLockManager,
  getFileLockManager,
  resetFileLockManager,
} from './file-lock-manager.js';
