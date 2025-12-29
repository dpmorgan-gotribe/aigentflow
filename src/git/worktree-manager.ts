/**
 * Worktree Manager
 *
 * Manages Git worktrees for parallel development.
 */

import { logger } from '../utils/logger.js';
import type {
  WorktreeInfo,
  WorktreeStatus,
  WorktreeCreateOptions,
  WorktreeRemoveOptions,
  GitEvent,
  WorktreeManagerConfig,
} from './types.js';
import { DEFAULT_WORKTREE_CONFIG } from './types.js';

const log = logger.child({ component: 'worktree-manager' });

/**
 * Worktree Manager class
 */
export class WorktreeManager {
  private config: WorktreeManagerConfig;
  private worktrees: Map<string, WorktreeInfo> = new Map();
  private eventListeners: Array<(event: GitEvent) => void> = [];

  constructor(config: Partial<WorktreeManagerConfig> = {}) {
    this.config = { ...DEFAULT_WORKTREE_CONFIG, ...config };
  }

  /**
   * Add a new worktree
   */
  async addWorktree(options: WorktreeCreateOptions): Promise<WorktreeInfo> {
    const { path, branch, createBranch = false, lock = false, lockReason } = options;

    log.info('Adding worktree', { path, branch, createBranch });

    // Check max worktrees limit
    if (this.worktrees.size >= this.config.maxWorktrees) {
      throw new Error(`Maximum worktrees limit (${this.config.maxWorktrees}) reached`);
    }

    // Check if path already exists
    if (this.worktrees.has(path)) {
      throw new Error(`Worktree at '${path}' already exists`);
    }

    // Check if branch is already checked out
    const existingWorktree = this.getWorktreeByBranch(branch);
    if (existingWorktree) {
      throw new Error(`Branch '${branch}' is already checked out at '${existingWorktree.path}'`);
    }

    // Create worktree info
    const worktreeInfo: WorktreeInfo = {
      path,
      branch,
      commit: this.generateCommitHash(),
      isMain: false,
      isLocked: lock,
      lockReason: lock ? lockReason : undefined,
      status: lock ? 'locked' : 'active',
      createdAt: new Date(),
    };

    // Store worktree
    this.worktrees.set(path, worktreeInfo);

    // Emit event
    this.emit({
      type: 'worktree:added',
      timestamp: new Date(),
      operation: 'worktree-add',
      data: { worktree: worktreeInfo },
    });

    log.info('Worktree added', { path, branch });

    return worktreeInfo;
  }

  /**
   * Remove a worktree
   */
  async removeWorktree(options: WorktreeRemoveOptions): Promise<boolean> {
    const { path, force = false } = options;

    log.info('Removing worktree', { path, force });

    const worktree = this.worktrees.get(path);
    if (!worktree) {
      throw new Error(`Worktree at '${path}' not found`);
    }

    // Check if worktree is main
    if (worktree.isMain) {
      throw new Error('Cannot remove main worktree');
    }

    // Check if worktree is locked (unless force)
    if (!force && worktree.isLocked) {
      throw new Error(`Worktree at '${path}' is locked: ${worktree.lockReason}`);
    }

    // Remove worktree
    this.worktrees.delete(path);

    // Emit event
    this.emit({
      type: 'worktree:removed',
      timestamp: new Date(),
      operation: 'worktree-remove',
      data: { path, branch: worktree.branch },
    });

    log.info('Worktree removed', { path });

    return true;
  }

  /**
   * Lock a worktree
   */
  lockWorktree(path: string, reason?: string): boolean {
    log.info('Locking worktree', { path, reason });

    const worktree = this.worktrees.get(path);
    if (!worktree) {
      throw new Error(`Worktree at '${path}' not found`);
    }

    if (worktree.isLocked) {
      return false; // Already locked
    }

    worktree.isLocked = true;
    worktree.lockReason = reason;
    worktree.status = 'locked';

    // Emit event
    this.emit({
      type: 'worktree:locked',
      timestamp: new Date(),
      data: { path, reason },
    });

    log.info('Worktree locked', { path });

    return true;
  }

  /**
   * Unlock a worktree
   */
  unlockWorktree(path: string): boolean {
    log.info('Unlocking worktree', { path });

    const worktree = this.worktrees.get(path);
    if (!worktree) {
      throw new Error(`Worktree at '${path}' not found`);
    }

    if (!worktree.isLocked) {
      return false; // Not locked
    }

    worktree.isLocked = false;
    worktree.lockReason = undefined;
    worktree.status = 'active';

    // Emit event
    this.emit({
      type: 'worktree:unlocked',
      timestamp: new Date(),
      data: { path },
    });

    log.info('Worktree unlocked', { path });

    return true;
  }

  /**
   * Get a worktree by path
   */
  getWorktree(path: string): WorktreeInfo | undefined {
    return this.worktrees.get(path);
  }

  /**
   * Get worktree by branch
   */
  getWorktreeByBranch(branch: string): WorktreeInfo | undefined {
    for (const worktree of this.worktrees.values()) {
      if (worktree.branch === branch) {
        return worktree;
      }
    }
    return undefined;
  }

  /**
   * Get all worktrees
   */
  getAllWorktrees(): WorktreeInfo[] {
    return Array.from(this.worktrees.values());
  }

  /**
   * Get worktrees by status
   */
  getWorktreesByStatus(status: WorktreeStatus): WorktreeInfo[] {
    return this.getAllWorktrees().filter((w) => w.status === status);
  }

  /**
   * Get active worktrees
   */
  getActiveWorktrees(): WorktreeInfo[] {
    return this.getWorktreesByStatus('active');
  }

  /**
   * Get locked worktrees
   */
  getLockedWorktrees(): WorktreeInfo[] {
    return this.getAllWorktrees().filter((w) => w.isLocked);
  }

  /**
   * Get prunable worktrees
   */
  getPrunableWorktrees(): WorktreeInfo[] {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - this.config.cleanupDays);

    return this.getAllWorktrees().filter(
      (w) => !w.isMain && !w.isLocked && w.createdAt && w.createdAt < cutoff
    );
  }

  /**
   * Check if path is a worktree
   */
  isWorktree(path: string): boolean {
    return this.worktrees.has(path);
  }

  /**
   * Check if branch has a worktree
   */
  hasBranchWorktree(branch: string): boolean {
    return this.getWorktreeByBranch(branch) !== undefined;
  }

  /**
   * Prune worktrees
   */
  async pruneWorktrees(dryRun = false): Promise<string[]> {
    log.info('Pruning worktrees', { dryRun });

    const prunable = this.getPrunableWorktrees();
    const pruned: string[] = [];

    for (const worktree of prunable) {
      if (!dryRun) {
        await this.removeWorktree({ path: worktree.path, force: true });
      }
      pruned.push(worktree.path);
    }

    log.info('Worktrees pruned', { count: pruned.length, dryRun });

    return pruned;
  }

  /**
   * Update worktree commit
   */
  updateWorktreeCommit(path: string, commit: string): boolean {
    const worktree = this.worktrees.get(path);
    if (!worktree) {
      return false;
    }

    worktree.commit = commit;
    return true;
  }

  /**
   * Set main worktree
   */
  setMainWorktree(path: string): void {
    // Clear previous main
    for (const worktree of this.worktrees.values()) {
      worktree.isMain = false;
    }

    // Set new main
    const worktree = this.worktrees.get(path);
    if (worktree) {
      worktree.isMain = true;
    }
  }

  /**
   * Get main worktree
   */
  getMainWorktree(): WorktreeInfo | undefined {
    for (const worktree of this.worktrees.values()) {
      if (worktree.isMain) {
        return worktree;
      }
    }
    return undefined;
  }

  /**
   * Generate worktree path
   */
  generateWorktreePath(branch: string): string {
    // Sanitize branch name for path
    const sanitized = branch.replace(/[/\\:]/g, '-').replace(/^-+|-+$/g, '');
    return `${this.config.baseDir}/${sanitized}`;
  }

  /**
   * Subscribe to events
   */
  on(listener: (event: GitEvent) => void): () => void {
    this.eventListeners.push(listener);
    return () => {
      const index = this.eventListeners.indexOf(listener);
      if (index > -1) {
        this.eventListeners.splice(index, 1);
      }
    };
  }

  /**
   * Emit an event
   */
  private emit(event: GitEvent): void {
    for (const listener of this.eventListeners) {
      try {
        listener(event);
      } catch (error) {
        log.error('Event listener error', {
          eventType: event.type,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  /**
   * Generate a random commit hash
   */
  private generateCommitHash(): string {
    const chars = '0123456789abcdef';
    let hash = '';
    for (let i = 0; i < 40; i++) {
      hash += chars[Math.floor(Math.random() * chars.length)];
    }
    return hash;
  }

  /**
   * Get configuration
   */
  getConfig(): WorktreeManagerConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<WorktreeManagerConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get statistics
   */
  getStats(): {
    total: number;
    active: number;
    locked: number;
    prunable: number;
    maxAllowed: number;
    available: number;
  } {
    const active = this.getActiveWorktrees().length;
    const locked = this.getLockedWorktrees().length;
    const prunable = this.getPrunableWorktrees().length;
    const total = this.worktrees.size;

    return {
      total,
      active,
      locked,
      prunable,
      maxAllowed: this.config.maxWorktrees,
      available: this.config.maxWorktrees - total,
    };
  }

  /**
   * Initialize with existing worktrees
   */
  initializeWorktrees(worktrees: WorktreeInfo[]): void {
    for (const worktree of worktrees) {
      this.worktrees.set(worktree.path, worktree);
    }
    log.info('Worktrees initialized', { count: worktrees.length });
  }

  /**
   * Reset all worktrees (for testing)
   */
  reset(): void {
    this.worktrees.clear();
    this.eventListeners = [];
  }
}

// Singleton instance
let instance: WorktreeManager | null = null;

/**
 * Get the singleton WorktreeManager instance
 */
export function getWorktreeManager(config?: Partial<WorktreeManagerConfig>): WorktreeManager {
  if (!instance) {
    instance = new WorktreeManager(config);
  }
  return instance;
}

/**
 * Reset the singleton (for testing)
 */
export function resetWorktreeManager(): void {
  if (instance) {
    instance.reset();
  }
  instance = null;
}
