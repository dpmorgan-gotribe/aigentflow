/**
 * File Lock Manager
 *
 * Manages concurrent file access across worktrees.
 */

import { logger } from '../utils/logger.js';
import type {
  FileLock,
  LockType,
  LockStatus,
  LockRequest,
  LockResult,
  GitEvent,
  FileLockManagerConfig,
} from './types.js';
import { DEFAULT_LOCK_CONFIG } from './types.js';

const log = logger.child({ component: 'file-lock-manager' });

/**
 * File Lock Manager class
 */
export class FileLockManager {
  private config: FileLockManagerConfig;
  private locks: Map<string, FileLock> = new Map();
  private waitQueues: Map<string, LockRequest[]> = new Map();
  private eventListeners: Array<(event: GitEvent) => void> = [];
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;

  constructor(config: Partial<FileLockManagerConfig> = {}) {
    this.config = { ...DEFAULT_LOCK_CONFIG, ...config };
  }

  /**
   * Acquire a lock on a file
   */
  async acquireLock(request: LockRequest): Promise<LockResult> {
    const { path, type, holder, worktree, timeout = this.config.defaultTimeout } = request;

    log.info('Acquiring lock', { path, type, holder, worktree });

    // Check if file is already locked
    const existingLock = this.locks.get(path);

    if (existingLock) {
      return this.handleExistingLock(existingLock, request, timeout);
    }

    // Create new lock
    const lock = this.createLock(path, type, holder, worktree, timeout);
    this.locks.set(path, lock);

    // Emit event
    this.emit({
      type: 'file:locked',
      timestamp: new Date(),
      data: { path, type, holder, worktree },
    });

    log.info('Lock acquired', { path, holder });

    return { success: true, lock };
  }

  /**
   * Handle existing lock
   */
  private async handleExistingLock(
    existingLock: FileLock,
    request: LockRequest,
    timeout: number
  ): Promise<LockResult> {
    const { path, type, holder } = request;

    // Same holder can reacquire
    if (existingLock.holder === holder) {
      // Upgrade shared to exclusive if allowed
      if (type === 'exclusive' && existingLock.type === 'shared') {
        if (this.config.allowSharedUpgrade && !existingLock.waiters?.length) {
          existingLock.type = 'exclusive';
          return { success: true, lock: existingLock };
        }
      }
      // Return existing lock
      return { success: true, lock: existingLock };
    }

    // Shared locks can coexist
    if (type === 'shared' && existingLock.type === 'shared') {
      return { success: true, lock: existingLock };
    }

    // Check if lock is expired
    if (existingLock.expiresAt && existingLock.expiresAt < new Date()) {
      // Remove expired lock and try again
      this.releaseLock(path, existingLock.holder);
      return this.acquireLock(request);
    }

    // Need to wait for lock
    if (timeout === 0) {
      return {
        success: false,
        error: `File '${path}' is locked by '${existingLock.holder}'`,
      };
    }

    // Add to wait queue
    return this.waitForLock(path, request, timeout);
  }

  /**
   * Wait for a lock to become available
   */
  private async waitForLock(
    path: string,
    request: LockRequest,
    timeout: number
  ): Promise<LockResult> {
    // Check max waiters
    const queue = this.waitQueues.get(path) || [];
    if (queue.length >= this.config.maxWaiters) {
      return {
        success: false,
        error: `Maximum waiters (${this.config.maxWaiters}) reached for '${path}'`,
      };
    }

    // Add to queue
    queue.push(request);
    this.waitQueues.set(path, queue);

    const existingLock = this.locks.get(path);
    if (existingLock) {
      existingLock.waiters = existingLock.waiters || [];
      existingLock.waiters.push(request.holder);
    }

    log.info('Waiting for lock', { path, holder: request.holder, position: queue.length });

    // For simplicity in this implementation, we return a waiting result
    // In a real implementation, we would use promises to wait
    return {
      success: false,
      error: 'Lock is held by another process',
      waitPosition: queue.length,
    };
  }

  /**
   * Release a lock on a file
   */
  releaseLock(path: string, holder: string): boolean {
    log.info('Releasing lock', { path, holder });

    const lock = this.locks.get(path);
    if (!lock) {
      log.warn('No lock found', { path });
      return false;
    }

    // Check if holder matches
    if (lock.holder !== holder) {
      log.warn('Lock holder mismatch', { path, expected: lock.holder, actual: holder });
      return false;
    }

    // Remove lock
    this.locks.delete(path);

    // Update lock status
    lock.status = 'released';

    // Process wait queue
    this.processWaitQueue(path);

    // Emit event
    this.emit({
      type: 'file:unlocked',
      timestamp: new Date(),
      data: { path, holder },
    });

    log.info('Lock released', { path, holder });

    return true;
  }

  /**
   * Process the wait queue for a path
   */
  private processWaitQueue(path: string): void {
    const queue = this.waitQueues.get(path);
    if (!queue || queue.length === 0) {
      return;
    }

    // Get next waiter
    const nextRequest = queue.shift();
    if (!nextRequest) {
      return;
    }

    // Update queue
    if (queue.length === 0) {
      this.waitQueues.delete(path);
    } else {
      this.waitQueues.set(path, queue);
    }

    // Grant lock to next waiter
    const lock = this.createLock(
      path,
      nextRequest.type,
      nextRequest.holder,
      nextRequest.worktree,
      nextRequest.timeout
    );
    this.locks.set(path, lock);

    log.info('Lock granted to waiter', { path, holder: nextRequest.holder });
  }

  /**
   * Create a new lock
   */
  private createLock(
    path: string,
    type: LockType,
    holder: string,
    worktree?: string,
    timeout?: number
  ): FileLock {
    const now = new Date();
    const expiresAt = timeout ? new Date(now.getTime() + timeout) : undefined;

    return {
      id: `lock-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      path,
      type,
      holder,
      worktree,
      status: 'acquired',
      acquiredAt: now,
      expiresAt,
    };
  }

  /**
   * Get a lock by path
   */
  getLock(path: string): FileLock | undefined {
    return this.locks.get(path);
  }

  /**
   * Get all locks
   */
  getAllLocks(): FileLock[] {
    return Array.from(this.locks.values());
  }

  /**
   * Get locks by holder
   */
  getLocksByHolder(holder: string): FileLock[] {
    return this.getAllLocks().filter((l) => l.holder === holder);
  }

  /**
   * Get locks by worktree
   */
  getLocksByWorktree(worktree: string): FileLock[] {
    return this.getAllLocks().filter((l) => l.worktree === worktree);
  }

  /**
   * Get locks by type
   */
  getLocksByType(type: LockType): FileLock[] {
    return this.getAllLocks().filter((l) => l.type === type);
  }

  /**
   * Check if a file is locked
   */
  isLocked(path: string): boolean {
    return this.locks.has(path);
  }

  /**
   * Check if a file is exclusively locked
   */
  isExclusivelyLocked(path: string): boolean {
    const lock = this.locks.get(path);
    return lock?.type === 'exclusive';
  }

  /**
   * Check if holder can access file
   */
  canAccess(path: string, holder: string, requiredType: LockType = 'shared'): boolean {
    const lock = this.locks.get(path);

    if (!lock) {
      return true; // No lock, can access
    }

    if (lock.holder === holder) {
      return true; // Same holder
    }

    if (requiredType === 'shared' && lock.type === 'shared') {
      return true; // Shared locks allow shared access
    }

    return false;
  }

  /**
   * Get wait queue for a path
   */
  getWaitQueue(path: string): LockRequest[] {
    return this.waitQueues.get(path) || [];
  }

  /**
   * Release all locks by holder
   */
  releaseAllByHolder(holder: string): number {
    let count = 0;
    const locks = this.getLocksByHolder(holder);

    for (const lock of locks) {
      if (this.releaseLock(lock.path, holder)) {
        count++;
      }
    }

    log.info('Released all locks by holder', { holder, count });
    return count;
  }

  /**
   * Release all locks by worktree
   */
  releaseAllByWorktree(worktree: string): number {
    let count = 0;
    const locks = this.getLocksByWorktree(worktree);

    for (const lock of locks) {
      if (this.releaseLock(lock.path, lock.holder)) {
        count++;
      }
    }

    log.info('Released all locks by worktree', { worktree, count });
    return count;
  }

  /**
   * Clean up expired locks
   */
  cleanupExpiredLocks(): number {
    const now = new Date();
    let count = 0;

    for (const [path, lock] of this.locks) {
      if (lock.expiresAt && lock.expiresAt < now) {
        lock.status = 'expired';
        this.locks.delete(path);
        this.processWaitQueue(path);
        count++;

        log.info('Expired lock cleaned up', { path, holder: lock.holder });
      }
    }

    if (count > 0) {
      log.info('Expired locks cleaned up', { count });
    }

    return count;
  }

  /**
   * Start automatic cleanup
   */
  startCleanup(): void {
    if (this.cleanupTimer) {
      return;
    }

    this.cleanupTimer = setInterval(() => {
      this.cleanupExpiredLocks();
    }, this.config.cleanupInterval);

    log.info('Lock cleanup started', { interval: this.config.cleanupInterval });
  }

  /**
   * Stop automatic cleanup
   */
  stopCleanup(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
      log.info('Lock cleanup stopped');
    }
  }

  /**
   * Extend lock timeout
   */
  extendLock(path: string, holder: string, additionalTime: number): boolean {
    const lock = this.locks.get(path);

    if (!lock || lock.holder !== holder) {
      return false;
    }

    if (lock.expiresAt) {
      lock.expiresAt = new Date(lock.expiresAt.getTime() + additionalTime);
    } else {
      lock.expiresAt = new Date(Date.now() + additionalTime);
    }

    log.info('Lock extended', { path, holder, newExpiry: lock.expiresAt });

    return true;
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
  getConfig(): FileLockManagerConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<FileLockManagerConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get statistics
   */
  getStats(): {
    totalLocks: number;
    exclusiveLocks: number;
    sharedLocks: number;
    waitingRequests: number;
    holders: number;
  } {
    const locks = this.getAllLocks();
    const exclusive = locks.filter((l) => l.type === 'exclusive').length;
    const shared = locks.filter((l) => l.type === 'shared').length;

    let waitingRequests = 0;
    for (const queue of this.waitQueues.values()) {
      waitingRequests += queue.length;
    }

    const holders = new Set(locks.map((l) => l.holder)).size;

    return {
      totalLocks: locks.length,
      exclusiveLocks: exclusive,
      sharedLocks: shared,
      waitingRequests,
      holders,
    };
  }

  /**
   * Reset all locks (for testing)
   */
  reset(): void {
    this.stopCleanup();
    this.locks.clear();
    this.waitQueues.clear();
    this.eventListeners = [];
  }
}

// Singleton instance
let instance: FileLockManager | null = null;

/**
 * Get the singleton FileLockManager instance
 */
export function getFileLockManager(config?: Partial<FileLockManagerConfig>): FileLockManager {
  if (!instance) {
    instance = new FileLockManager(config);
  }
  return instance;
}

/**
 * Reset the singleton (for testing)
 */
export function resetFileLockManager(): void {
  if (instance) {
    instance.reset();
  }
  instance = null;
}
