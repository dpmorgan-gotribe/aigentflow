/**
 * Branch Manager
 *
 * Manages Git branch lifecycle: creation, deletion, merging.
 */

import { logger } from '../utils/logger.js';
import type {
  BranchInfo,
  BranchType,
  BranchStatus,
  BranchCreateOptions,
  BranchDeleteOptions,
  MergeOptions,
  MergeResult,
  CommitInfo,
  GitEvent,
  BranchManagerConfig,
} from './types.js';
import { BRANCH_PREFIXES, DEFAULT_BRANCH_CONFIG } from './types.js';

const log = logger.child({ component: 'branch-manager' });

/**
 * Branch Manager class
 */
export class BranchManager {
  private config: BranchManagerConfig;
  private branches: Map<string, BranchInfo> = new Map();
  private eventListeners: Array<(event: GitEvent) => void> = [];

  constructor(config: Partial<BranchManagerConfig> = {}) {
    this.config = { ...DEFAULT_BRANCH_CONFIG, ...config };
  }

  /**
   * Create a new branch
   */
  async createBranch(options: BranchCreateOptions): Promise<BranchInfo> {
    const { name, type, baseBranch = this.config.defaultBaseBranch } = options;

    log.info('Creating branch', { name, type, baseBranch });

    // Validate branch name
    const validatedName = this.validateBranchName(name, type);

    // Build full branch name with prefix
    const fullName = this.buildBranchName(validatedName, type);

    // Check if branch already exists
    if (this.branches.has(fullName)) {
      throw new Error(`Branch '${fullName}' already exists`);
    }

    // Create branch info
    const branchInfo: BranchInfo = {
      name,
      type,
      fullName,
      isRemote: false,
      tracking: options.track ? `origin/${fullName}` : undefined,
      ahead: 0,
      behind: 0,
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Store branch
    this.branches.set(fullName, branchInfo);

    // Emit event
    this.emit({
      type: 'branch:created',
      timestamp: new Date(),
      operation: 'branch-create',
      data: { branch: branchInfo, baseBranch },
    });

    log.info('Branch created', { fullName, type });

    return branchInfo;
  }

  /**
   * Delete a branch
   */
  async deleteBranch(options: BranchDeleteOptions): Promise<boolean> {
    const { name, force = false, deleteRemote = false } = options;

    log.info('Deleting branch', { name, force, deleteRemote });

    // Check if branch is protected
    if (this.isProtectedBranch(name)) {
      throw new Error(`Cannot delete protected branch '${name}'`);
    }

    // Get branch info
    const branch = this.getBranch(name);
    if (!branch) {
      throw new Error(`Branch '${name}' not found`);
    }

    // Check if branch is merged (unless force)
    if (!force && branch.status !== 'merged') {
      throw new Error(`Branch '${name}' is not merged. Use force=true to delete anyway`);
    }

    // Remove branch
    this.branches.delete(name);

    // Emit event
    this.emit({
      type: 'branch:deleted',
      timestamp: new Date(),
      operation: 'branch-delete',
      data: { branch: name, deleteRemote },
    });

    log.info('Branch deleted', { name });

    return true;
  }

  /**
   * Merge branches
   */
  async mergeBranch(options: MergeOptions): Promise<MergeResult> {
    const {
      sourceBranch,
      targetBranch = this.config.defaultBaseBranch,
      strategy = 'merge',
      noCommit = false,
      message,
    } = options;

    log.info('Merging branches', { sourceBranch, targetBranch, strategy });

    // Get source branch
    const source = this.getBranch(sourceBranch);
    if (!source) {
      return {
        success: false,
        merged: false,
        error: `Source branch '${sourceBranch}' not found`,
      };
    }

    // Get target branch
    const target = this.getBranch(targetBranch);
    if (!target) {
      return {
        success: false,
        merged: false,
        error: `Target branch '${targetBranch}' not found`,
      };
    }

    // Simulate merge (in real implementation, would call git)
    const mergeCommit: CommitInfo = {
      hash: this.generateHash(),
      shortHash: this.generateHash().substring(0, 7),
      message: message || `Merge branch '${sourceBranch}' into ${targetBranch}`,
      author: 'System',
      authorEmail: 'system@aigentflow.local',
      date: new Date(),
      parents: [source.lastCommit?.hash || '', target.lastCommit?.hash || ''].filter(Boolean),
    };

    // Update source branch status
    source.status = 'merged';
    source.updatedAt = new Date();

    // Update target branch
    target.lastCommit = mergeCommit;
    target.updatedAt = new Date();

    // Emit event
    this.emit({
      type: 'branch:merged',
      timestamp: new Date(),
      operation: 'branch-merge',
      data: { sourceBranch, targetBranch, commit: mergeCommit },
    });

    log.info('Branch merged', { sourceBranch, targetBranch });

    return {
      success: true,
      merged: true,
      commit: noCommit ? undefined : mergeCommit,
    };
  }

  /**
   * Checkout a branch
   */
  async checkoutBranch(name: string, create = false): Promise<BranchInfo> {
    log.info('Checking out branch', { name, create });

    let branch = this.getBranch(name);

    if (!branch && create) {
      // Create the branch first
      branch = await this.createBranch({
        name,
        type: this.detectBranchType(name),
      });
    }

    if (!branch) {
      throw new Error(`Branch '${name}' not found`);
    }

    // Update last access
    branch.updatedAt = new Date();

    // Emit event
    this.emit({
      type: 'branch:checked-out',
      timestamp: new Date(),
      operation: 'branch-checkout',
      data: { branch: name },
    });

    log.info('Branch checked out', { name });

    return branch;
  }

  /**
   * Get a branch by name
   */
  getBranch(name: string): BranchInfo | undefined {
    // Try exact match first
    let branch = this.branches.get(name);
    if (branch) return branch;

    // Try with common prefixes
    for (const prefix of Object.values(BRANCH_PREFIXES)) {
      if (prefix && !name.startsWith(prefix)) {
        branch = this.branches.get(prefix + name);
        if (branch) return branch;
      }
    }

    return undefined;
  }

  /**
   * Get all branches
   */
  getAllBranches(): BranchInfo[] {
    return Array.from(this.branches.values());
  }

  /**
   * Get branches by type
   */
  getBranchesByType(type: BranchType): BranchInfo[] {
    return this.getAllBranches().filter((b) => b.type === type);
  }

  /**
   * Get branches by status
   */
  getBranchesByStatus(status: BranchStatus): BranchInfo[] {
    return this.getAllBranches().filter((b) => b.status === status);
  }

  /**
   * Get stale branches
   */
  getStaleBranches(days: number = this.config.staleBranchDays): BranchInfo[] {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);

    return this.getAllBranches().filter(
      (b) => b.updatedAt && b.updatedAt < cutoff && !this.isProtectedBranch(b.fullName)
    );
  }

  /**
   * Check if branch is protected
   */
  isProtectedBranch(name: string): boolean {
    return this.config.protectedBranches.some(
      (pattern) => name === pattern || name.endsWith('/' + pattern)
    );
  }

  /**
   * Validate branch name
   */
  validateBranchName(name: string, type: BranchType): string {
    // Remove leading/trailing whitespace
    let validated = name.trim();

    // Remove invalid characters
    validated = validated.replace(/[^a-zA-Z0-9\-_/.]/g, '-');

    // Remove consecutive dashes
    validated = validated.replace(/--+/g, '-');

    // Remove leading/trailing dashes
    validated = validated.replace(/^-+|-+$/g, '');

    // Ensure it's not empty
    if (!validated) {
      throw new Error('Branch name cannot be empty');
    }

    // Check for reserved names
    const reserved = ['HEAD', 'FETCH_HEAD', 'ORIG_HEAD', 'MERGE_HEAD'];
    if (reserved.includes(validated.toUpperCase())) {
      throw new Error(`'${validated}' is a reserved name`);
    }

    return validated;
  }

  /**
   * Build full branch name with prefix
   */
  buildBranchName(name: string, type: BranchType): string {
    const prefix = BRANCH_PREFIXES[type];
    const pattern = this.config.branchPatterns[type];

    if (pattern) {
      return pattern.replace('{name}', name).replace('{version}', name);
    }

    return prefix + name;
  }

  /**
   * Detect branch type from name
   */
  detectBranchType(name: string): BranchType {
    for (const [type, prefix] of Object.entries(BRANCH_PREFIXES)) {
      if (prefix && name.startsWith(prefix)) {
        return type as BranchType;
      }
    }

    if (name === 'main' || name === 'master') return 'main';
    if (name === 'develop' || name === 'development') return 'develop';

    return 'custom';
  }

  /**
   * Parse branch name to extract type and name
   */
  parseBranchName(fullName: string): { type: BranchType; name: string } {
    for (const [type, prefix] of Object.entries(BRANCH_PREFIXES)) {
      if (prefix && fullName.startsWith(prefix)) {
        return {
          type: type as BranchType,
          name: fullName.substring(prefix.length),
        };
      }
    }

    return {
      type: this.detectBranchType(fullName),
      name: fullName,
    };
  }

  /**
   * Clean up merged branches
   */
  async cleanupMergedBranches(dryRun = false): Promise<string[]> {
    const merged = this.getBranchesByStatus('merged');
    const toDelete: string[] = [];

    for (const branch of merged) {
      if (!this.isProtectedBranch(branch.fullName)) {
        toDelete.push(branch.fullName);
        if (!dryRun) {
          await this.deleteBranch({ name: branch.fullName, force: true });
        }
      }
    }

    log.info('Cleanup merged branches', { count: toDelete.length, dryRun });

    return toDelete;
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
   * Generate a random hash
   */
  private generateHash(): string {
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
  getConfig(): BranchManagerConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<BranchManagerConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get statistics
   */
  getStats(): {
    total: number;
    byType: Record<BranchType, number>;
    byStatus: Record<BranchStatus, number>;
    stale: number;
  } {
    const branches = this.getAllBranches();
    const stale = this.getStaleBranches();

    const byType: Record<string, number> = {};
    const byStatus: Record<string, number> = {};

    for (const branch of branches) {
      byType[branch.type] = (byType[branch.type] || 0) + 1;
      byStatus[branch.status] = (byStatus[branch.status] || 0) + 1;
    }

    return {
      total: branches.length,
      byType: byType as Record<BranchType, number>,
      byStatus: byStatus as Record<BranchStatus, number>,
      stale: stale.length,
    };
  }

  /**
   * Initialize with existing branches
   */
  initializeBranches(branches: BranchInfo[]): void {
    for (const branch of branches) {
      this.branches.set(branch.fullName, branch);
    }
    log.info('Branches initialized', { count: branches.length });
  }

  /**
   * Reset all branches (for testing)
   */
  reset(): void {
    this.branches.clear();
    this.eventListeners = [];
  }
}

// Singleton instance
let instance: BranchManager | null = null;

/**
 * Get the singleton BranchManager instance
 */
export function getBranchManager(config?: Partial<BranchManagerConfig>): BranchManager {
  if (!instance) {
    instance = new BranchManager(config);
  }
  return instance;
}

/**
 * Reset the singleton (for testing)
 */
export function resetBranchManager(): void {
  if (instance) {
    instance.reset();
  }
  instance = null;
}
