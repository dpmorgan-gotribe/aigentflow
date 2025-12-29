/**
 * Merge Manager
 *
 * Orchestrates merge operations with conflict detection and resolution.
 */

import { logger } from '../utils/logger.js';
import type {
  BranchInfo,
  MergeOptions,
  MergeResult,
  ConflictInfo,
  CommitInfo,
  GitEvent,
} from './types.js';
import {
  ConflictDetector,
  getConflictDetector,
  type BranchChanges,
  type ExtendedConflictInfo,
  type ConflictDetectionResult,
  type CrossFeatureAnalysis,
} from './conflict-detector.js';
import {
  ConflictResolver,
  getConflictResolver,
  type ResolutionStrategy,
  type BatchResolutionResult,
} from './conflict-resolver.js';

const log = logger.child({ component: 'merge-manager' });

/**
 * Merge status
 */
export type MergeStatus =
  | 'pending'
  | 'in-progress'
  | 'conflict'
  | 'resolving'
  | 'completed'
  | 'aborted'
  | 'failed';

/**
 * Merge session tracking
 */
export interface MergeSession {
  id: string;
  sourceBranch: string;
  targetBranch: string;
  status: MergeStatus;
  startedAt: Date;
  completedAt?: Date;
  conflicts: ExtendedConflictInfo[];
  resolvedConflicts: string[];
  mergeCommit?: CommitInfo;
  error?: string;
}

/**
 * Merge plan for multiple features
 */
export interface MergePlan {
  id: string;
  features: string[];
  targetBranch: string;
  mergeOrder: string[];
  analysis: CrossFeatureAnalysis;
  estimatedConflicts: number;
  blockedFeatures: string[];
  createdAt: Date;
}

/**
 * Merge queue entry
 */
export interface MergeQueueEntry {
  id: string;
  sourceBranch: string;
  targetBranch: string;
  priority: number;
  addedAt: Date;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  session?: MergeSession;
}

/**
 * Merge Manager configuration
 */
export interface MergeManagerConfig {
  /** Auto-resolve low-severity conflicts */
  autoResolve: boolean;
  /** Create backup branches before merge */
  createBackups: boolean;
  /** Run tests after merge */
  runTestsAfterMerge: boolean;
  /** Maximum concurrent merges */
  maxConcurrentMerges: number;
  /** Require approval for critical conflicts */
  requireApprovalForCritical: boolean;
}

const DEFAULT_CONFIG: MergeManagerConfig = {
  autoResolve: true,
  createBackups: true,
  runTestsAfterMerge: false,
  maxConcurrentMerges: 1,
  requireApprovalForCritical: true,
};

/**
 * Merge Manager class
 */
export class MergeManager {
  private config: MergeManagerConfig;
  private conflictDetector: ConflictDetector;
  private conflictResolver: ConflictResolver;
  private eventListeners: Array<(event: GitEvent) => void> = [];
  private activeSessions: Map<string, MergeSession> = new Map();
  private mergeQueue: MergeQueueEntry[] = [];
  private completedMerges: MergeSession[] = [];

  constructor(config: Partial<MergeManagerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.conflictDetector = getConflictDetector();
    this.conflictResolver = getConflictResolver();
  }

  /**
   * Start a merge operation
   */
  async startMerge(
    sourceBranch: string,
    targetBranch: string,
    options: MergeOptions = {}
  ): Promise<MergeSession> {
    log.info('Starting merge', { sourceBranch, targetBranch });

    // Check for existing session
    const existingSession = this.findActiveSession(sourceBranch, targetBranch);
    if (existingSession) {
      throw new Error(`Merge already in progress: ${existingSession.id}`);
    }

    // Create session
    const session: MergeSession = {
      id: `merge-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      sourceBranch,
      targetBranch,
      status: 'pending',
      startedAt: new Date(),
      conflicts: [],
      resolvedConflicts: [],
    };

    this.activeSessions.set(session.id, session);

    // Emit event
    this.emit({
      type: 'branch:merged',
      timestamp: new Date(),
      operation: 'branch-merge',
      data: { session: session.id, status: 'started' },
    });

    try {
      // Update status
      session.status = 'in-progress';

      // Create backup if configured
      if (this.config.createBackups) {
        await this.createBackupBranch(targetBranch);
      }

      // Detect conflicts
      const sourceChanges = await this.getBranchChanges(sourceBranch);
      const targetChanges = await this.getBranchChanges(targetBranch);

      const detection = this.conflictDetector.detectConflicts(
        sourceChanges,
        targetChanges
      );

      if (detection.hasConflicts) {
        session.conflicts = detection.conflicts;
        session.status = 'conflict';

        // Add to resolver pending
        this.conflictResolver.addPendingConflicts(detection.conflicts);

        // Auto-resolve if configured
        if (this.config.autoResolve) {
          const autoResult = await this.conflictResolver.autoResolveAll(
            detection.conflicts
          );

          session.resolvedConflicts = autoResult.successful.map(
            (r) => r.conflict.id
          );

          // Check if all resolved
          if (autoResult.skipped.length === 0 && autoResult.failed.length === 0) {
            session.status = 'in-progress';
          } else if (
            this.config.requireApprovalForCritical &&
            this.hasCriticalConflicts(autoResult.skipped)
          ) {
            session.status = 'resolving';
            log.info('Critical conflicts require approval', {
              sessionId: session.id,
              critical: autoResult.skipped.filter((c) => c.severity === 'critical').length,
            });
          }
        }

        // If still has conflicts, wait for resolution
        if (session.status === 'conflict' || session.status === 'resolving') {
          log.info('Merge waiting for conflict resolution', {
            sessionId: session.id,
            remaining: session.conflicts.length - session.resolvedConflicts.length,
          });
          return session;
        }
      }

      // Proceed with merge
      const result = await this.performMerge(session, options);

      if (result.success) {
        session.status = 'completed';
        session.completedAt = new Date();
        session.mergeCommit = result.commit;

        // Move to completed
        this.activeSessions.delete(session.id);
        this.completedMerges.push(session);

        log.info('Merge completed', {
          sessionId: session.id,
          commit: result.commit?.shortHash,
        });
      } else {
        session.status = 'failed';
        session.error = result.error;

        log.error('Merge failed', {
          sessionId: session.id,
          error: result.error,
        });
      }

      return session;
    } catch (error) {
      session.status = 'failed';
      session.error = error instanceof Error ? error.message : String(error);

      log.error('Merge error', {
        sessionId: session.id,
        error: session.error,
      });

      return session;
    }
  }

  /**
   * Continue a merge after conflict resolution
   */
  async continueMerge(sessionId: string): Promise<MergeSession> {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      throw new Error(`Merge session not found: ${sessionId}`);
    }

    if (session.status !== 'conflict' && session.status !== 'resolving') {
      throw new Error(`Merge is not in conflict state: ${session.status}`);
    }

    log.info('Continuing merge', { sessionId });

    // Check if all conflicts resolved
    const unresolvedConflicts = session.conflicts.filter(
      (c) => !session.resolvedConflicts.includes(c.id)
    );

    if (unresolvedConflicts.length > 0) {
      throw new Error(
        `${unresolvedConflicts.length} conflict(s) still unresolved`
      );
    }

    // Perform merge
    session.status = 'in-progress';
    const result = await this.performMerge(session, {});

    if (result.success) {
      session.status = 'completed';
      session.completedAt = new Date();
      session.mergeCommit = result.commit;

      this.activeSessions.delete(session.id);
      this.completedMerges.push(session);
    } else {
      session.status = 'failed';
      session.error = result.error;
    }

    return session;
  }

  /**
   * Abort a merge
   */
  abortMerge(sessionId: string): boolean {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      return false;
    }

    log.info('Aborting merge', { sessionId });

    session.status = 'aborted';
    session.completedAt = new Date();

    // Clear pending resolutions
    for (const conflict of session.conflicts) {
      this.conflictResolver.undoResolution(conflict.id);
    }

    this.activeSessions.delete(sessionId);
    this.completedMerges.push(session);

    this.emit({
      type: 'branch:merged',
      timestamp: new Date(),
      operation: 'branch-merge',
      data: { session: sessionId, status: 'aborted' },
    });

    return true;
  }

  /**
   * Resolve a conflict in a session
   */
  async resolveSessionConflict(
    sessionId: string,
    conflictId: string,
    strategy: ResolutionStrategy,
    options: { resolvedContent?: string; resolvedBy?: string } = {}
  ): Promise<boolean> {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    const conflict = session.conflicts.find((c) => c.id === conflictId);
    if (!conflict) {
      throw new Error(`Conflict not found: ${conflictId}`);
    }

    const result = await this.conflictResolver.resolveConflict(
      conflict,
      strategy,
      options
    );

    if (result.success) {
      session.resolvedConflicts.push(conflictId);

      // Check if all resolved
      if (session.resolvedConflicts.length === session.conflicts.length) {
        session.status = 'in-progress';
      }
    }

    return result.success;
  }

  /**
   * Create a merge plan for multiple features
   */
  createMergePlan(
    features: string[],
    targetBranch: string,
    featureChanges: BranchChanges[]
  ): MergePlan {
    log.info('Creating merge plan', { features: features.length, targetBranch });

    // Analyze cross-feature conflicts
    const analysis = this.conflictDetector.analyzeCrossFeature(featureChanges);

    const plan: MergePlan = {
      id: `plan-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      features,
      targetBranch,
      mergeOrder: analysis.mergeOrder,
      analysis,
      estimatedConflicts: analysis.conflicts.length,
      blockedFeatures: analysis.blockedFeatures,
      createdAt: new Date(),
    };

    log.info('Merge plan created', {
      planId: plan.id,
      order: plan.mergeOrder,
      conflicts: plan.estimatedConflicts,
    });

    return plan;
  }

  /**
   * Execute a merge plan
   */
  async executeMergePlan(
    plan: MergePlan,
    options: { stopOnConflict?: boolean } = {}
  ): Promise<MergeSession[]> {
    log.info('Executing merge plan', { planId: plan.id });

    const sessions: MergeSession[] = [];

    for (const feature of plan.mergeOrder) {
      if (plan.blockedFeatures.includes(feature)) {
        log.warn('Skipping blocked feature', { feature });
        continue;
      }

      try {
        const session = await this.startMerge(feature, plan.targetBranch);
        sessions.push(session);

        if (session.status === 'conflict' && options.stopOnConflict) {
          log.info('Stopping plan execution on conflict', {
            feature,
            sessionId: session.id,
          });
          break;
        }

        if (session.status === 'failed') {
          log.error('Feature merge failed', { feature, error: session.error });
          if (options.stopOnConflict) {
            break;
          }
        }
      } catch (error) {
        log.error('Error merging feature', {
          feature,
          error: error instanceof Error ? error.message : String(error),
        });

        if (options.stopOnConflict) {
          break;
        }
      }
    }

    return sessions;
  }

  /**
   * Add to merge queue
   */
  queueMerge(
    sourceBranch: string,
    targetBranch: string,
    priority: number = 0
  ): MergeQueueEntry {
    const entry: MergeQueueEntry = {
      id: `queue-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      sourceBranch,
      targetBranch,
      priority,
      addedAt: new Date(),
      status: 'queued',
    };

    // Insert based on priority
    const insertIndex = this.mergeQueue.findIndex((e) => e.priority < priority);
    if (insertIndex === -1) {
      this.mergeQueue.push(entry);
    } else {
      this.mergeQueue.splice(insertIndex, 0, entry);
    }

    log.info('Added to merge queue', {
      entryId: entry.id,
      position: insertIndex === -1 ? this.mergeQueue.length - 1 : insertIndex,
    });

    return entry;
  }

  /**
   * Process next in queue
   */
  async processQueue(): Promise<MergeSession | null> {
    const entry = this.mergeQueue.find((e) => e.status === 'queued');
    if (!entry) {
      return null;
    }

    // Check concurrent limit
    if (this.activeSessions.size >= this.config.maxConcurrentMerges) {
      log.info('Concurrent merge limit reached', {
        active: this.activeSessions.size,
        max: this.config.maxConcurrentMerges,
      });
      return null;
    }

    entry.status = 'processing';

    try {
      const session = await this.startMerge(
        entry.sourceBranch,
        entry.targetBranch
      );

      entry.session = session;
      entry.status = session.status === 'completed' ? 'completed' : 'failed';

      return session;
    } catch (error) {
      entry.status = 'failed';
      throw error;
    }
  }

  /**
   * Get merge queue
   */
  getQueue(): MergeQueueEntry[] {
    return [...this.mergeQueue];
  }

  /**
   * Clear merge queue
   */
  clearQueue(): void {
    this.mergeQueue = [];
  }

  /**
   * Find active session
   */
  private findActiveSession(
    sourceBranch: string,
    targetBranch: string
  ): MergeSession | undefined {
    for (const session of this.activeSessions.values()) {
      if (
        session.sourceBranch === sourceBranch &&
        session.targetBranch === targetBranch
      ) {
        return session;
      }
    }
    return undefined;
  }

  /**
   * Check for critical conflicts
   */
  private hasCriticalConflicts(conflicts: ExtendedConflictInfo[]): boolean {
    return conflicts.some((c) => c.severity === 'critical');
  }

  /**
   * Create backup branch
   */
  private async createBackupBranch(branchName: string): Promise<string> {
    const backupName = `backup/${branchName}-${Date.now()}`;
    log.info('Creating backup branch', { original: branchName, backup: backupName });
    // In real implementation, would create actual branch
    return backupName;
  }

  /**
   * Get branch changes (simulated)
   */
  private async getBranchChanges(branchName: string): Promise<BranchChanges> {
    // In real implementation, would get actual changes from git
    return {
      branch: branchName,
      files: [],
      timestamp: new Date(),
    };
  }

  /**
   * Perform the actual merge
   */
  private async performMerge(
    session: MergeSession,
    options: MergeOptions
  ): Promise<MergeResult> {
    log.info('Performing merge', {
      sessionId: session.id,
      source: session.sourceBranch,
      target: session.targetBranch,
    });

    // In real implementation, would perform actual git merge
    const mergeCommit: CommitInfo = {
      hash: this.generateHash(),
      shortHash: this.generateHash().substring(0, 7),
      message: options.message ||
        `Merge branch '${session.sourceBranch}' into ${session.targetBranch}`,
      author: 'System',
      authorEmail: 'system@aigentflow.local',
      date: new Date(),
      parents: [],
    };

    this.emit({
      type: 'branch:merged',
      timestamp: new Date(),
      operation: 'branch-merge',
      data: {
        session: session.id,
        commit: mergeCommit.shortHash,
        status: 'completed',
      },
    });

    return {
      success: true,
      merged: true,
      commit: mergeCommit,
    };
  }

  /**
   * Generate random hash
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
   * Get active session
   */
  getSession(sessionId: string): MergeSession | undefined {
    return this.activeSessions.get(sessionId);
  }

  /**
   * Get all active sessions
   */
  getActiveSessions(): MergeSession[] {
    return Array.from(this.activeSessions.values());
  }

  /**
   * Get completed merges
   */
  getCompletedMerges(): MergeSession[] {
    return [...this.completedMerges];
  }

  /**
   * Get session by branches
   */
  getSessionByBranches(
    sourceBranch: string,
    targetBranch: string
  ): MergeSession | undefined {
    return this.findActiveSession(sourceBranch, targetBranch);
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
   * Get configuration
   */
  getConfig(): MergeManagerConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<MergeManagerConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get statistics
   */
  getStats(): {
    activeSessions: number;
    completedMerges: number;
    queuedMerges: number;
    successRate: number;
  } {
    const completed = this.completedMerges.length;
    const successful = this.completedMerges.filter(
      (s) => s.status === 'completed'
    ).length;

    return {
      activeSessions: this.activeSessions.size,
      completedMerges: completed,
      queuedMerges: this.mergeQueue.filter((e) => e.status === 'queued').length,
      successRate: completed > 0 ? successful / completed : 0,
    };
  }

  /**
   * Reset manager state
   */
  reset(): void {
    this.activeSessions.clear();
    this.mergeQueue = [];
    this.completedMerges = [];
    this.eventListeners = [];
  }
}

// Singleton instance
let instance: MergeManager | null = null;

/**
 * Get the singleton MergeManager instance
 */
export function getMergeManager(
  config?: Partial<MergeManagerConfig>
): MergeManager {
  if (!instance) {
    instance = new MergeManager(config);
  }
  return instance;
}

/**
 * Reset the singleton (for testing)
 */
export function resetMergeManager(): void {
  if (instance) {
    instance.reset();
  }
  instance = null;
}
