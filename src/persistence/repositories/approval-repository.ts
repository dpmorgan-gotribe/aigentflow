/**
 * Approval Repository
 *
 * Data access layer for pending approvals.
 */

import { randomUUID } from 'crypto';
import { getDatabase } from '../database.js';
import { logger } from '../../utils/logger.js';
import { NotFoundError } from '../../utils/errors.js';

const log = logger.child({ component: 'approval-repository' });

// ============================================================================
// Types
// ============================================================================

export type ApprovalType = 'design' | 'architecture' | 'code';
export type ApprovalStatus = 'pending' | 'approved' | 'rejected';

export interface ApprovalRecord {
  id: string;
  task_id: string;
  type: ApprovalType;
  description: string;
  artifact: string | null; // JSON or path
  status: ApprovalStatus;
  reviewer: string | null;
  message: string | null;
  created_at: string;
  resolved_at: string | null;
}

// ============================================================================
// Repository
// ============================================================================

/**
 * Approval repository for database operations
 */
export class ApprovalRepository {
  /**
   * Create a new approval request
   */
  create(
    taskId: string,
    type: ApprovalType,
    description: string,
    artifact?: unknown
  ): ApprovalRecord {
    const db = getDatabase();
    const id = randomUUID();
    const now = new Date().toISOString();

    db.execute(
      `INSERT INTO approvals (id, task_id, type, description, artifact, status, created_at)
       VALUES (?, ?, ?, ?, ?, 'pending', ?)`,
      [id, taskId, type, description, artifact ? JSON.stringify(artifact) : null, now]
    );

    log.info('Approval request created', { id, taskId, type });

    return {
      id,
      task_id: taskId,
      type,
      description,
      artifact: artifact ? JSON.stringify(artifact) : null,
      status: 'pending',
      reviewer: null,
      message: null,
      created_at: now,
      resolved_at: null,
    };
  }

  /**
   * Get approval by ID
   */
  getById(id: string): ApprovalRecord | undefined {
    const db = getDatabase();
    return db.queryOne<ApprovalRecord>('SELECT * FROM approvals WHERE id = ?', [id]);
  }

  /**
   * Get approval by task ID
   */
  getByTaskId(taskId: string): ApprovalRecord | undefined {
    const db = getDatabase();
    return db.queryOne<ApprovalRecord>(
      'SELECT * FROM approvals WHERE task_id = ? AND status = ?',
      [taskId, 'pending']
    );
  }

  /**
   * Get all pending approvals
   */
  getPending(): ApprovalRecord[] {
    const db = getDatabase();
    return db.query<ApprovalRecord>(
      "SELECT * FROM approvals WHERE status = 'pending' ORDER BY created_at ASC"
    );
  }

  /**
   * Get pending approvals by type
   */
  getPendingByType(type: ApprovalType): ApprovalRecord[] {
    const db = getDatabase();
    return db.query<ApprovalRecord>(
      "SELECT * FROM approvals WHERE status = 'pending' AND type = ? ORDER BY created_at ASC",
      [type]
    );
  }

  /**
   * Approve a request
   */
  approve(id: string, reviewer: string, message?: string): void {
    const db = getDatabase();
    const now = new Date().toISOString();

    const result = db.execute(
      `UPDATE approvals
       SET status = 'approved', reviewer = ?, message = ?, resolved_at = ?
       WHERE id = ? AND status = 'pending'`,
      [reviewer, message ?? null, now, id]
    );

    if (result.changes === 0) {
      throw new NotFoundError('Approval', id);
    }

    log.info('Approval approved', { id, reviewer });
  }

  /**
   * Reject a request
   */
  reject(id: string, reviewer: string, message?: string): void {
    const db = getDatabase();
    const now = new Date().toISOString();

    const result = db.execute(
      `UPDATE approvals
       SET status = 'rejected', reviewer = ?, message = ?, resolved_at = ?
       WHERE id = ? AND status = 'pending'`,
      [reviewer, message ?? null, now, id]
    );

    if (result.changes === 0) {
      throw new NotFoundError('Approval', id);
    }

    log.info('Approval rejected', { id, reviewer });
  }

  /**
   * Approve all pending
   */
  approveAll(reviewer: string, message?: string): number {
    const db = getDatabase();
    const now = new Date().toISOString();

    const result = db.execute(
      `UPDATE approvals
       SET status = 'approved', reviewer = ?, message = ?, resolved_at = ?
       WHERE status = 'pending'`,
      [reviewer, message ?? null, now]
    );

    log.info('All approvals approved', { count: result.changes, reviewer });
    return result.changes;
  }

  /**
   * Get all approvals for a task
   */
  getAllForTask(taskId: string): ApprovalRecord[] {
    const db = getDatabase();
    return db.query<ApprovalRecord>(
      'SELECT * FROM approvals WHERE task_id = ? ORDER BY created_at DESC',
      [taskId]
    );
  }

  /**
   * Get approval statistics
   */
  getStats(): Record<string, unknown> {
    const db = getDatabase();

    const pending = db.queryOne<{ count: number }>(
      "SELECT COUNT(*) as count FROM approvals WHERE status = 'pending'"
    );

    const approved = db.queryOne<{ count: number }>(
      "SELECT COUNT(*) as count FROM approvals WHERE status = 'approved'"
    );

    const rejected = db.queryOne<{ count: number }>(
      "SELECT COUNT(*) as count FROM approvals WHERE status = 'rejected'"
    );

    return {
      pending: pending?.count ?? 0,
      approved: approved?.count ?? 0,
      rejected: rejected?.count ?? 0,
    };
  }
}

// Singleton instance
let instance: ApprovalRepository | null = null;

/**
 * Get the approval repository singleton
 */
export function getApprovalRepository(): ApprovalRepository {
  if (!instance) {
    instance = new ApprovalRepository();
  }
  return instance;
}

/**
 * Reset the singleton (for testing)
 */
export function resetApprovalRepository(): void {
  instance = null;
}
