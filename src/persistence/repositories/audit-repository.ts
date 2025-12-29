/**
 * Audit Repository
 *
 * Data access layer for immutable audit logs with tamper detection.
 */

import { randomUUID, createHash } from 'crypto';
import type { AgentType } from '../../types.js';
import { getDatabase } from '../database.js';
import { logger } from '../../utils/logger.js';

const log = logger.child({ component: 'audit-repository' });

// ============================================================================
// Types
// ============================================================================

export type AuditCategory =
  | 'system'
  | 'workflow'
  | 'agent'
  | 'security'
  | 'compliance'
  | 'user';

export type AuditSeverity = 'info' | 'warning' | 'error' | 'critical';

export interface AuditRecord {
  id: string;
  timestamp: string;
  category: AuditCategory;
  severity: AuditSeverity;
  action: string;
  actor: string;
  task_id: string | null;
  agent_type: string | null;
  details: string; // JSON
  checksum: string;
}

export interface AuditSearchOptions {
  category?: AuditCategory;
  severity?: AuditSeverity;
  taskId?: string;
  agent?: AgentType;
  since?: Date;
  until?: Date;
  limit?: number;
  offset?: number;
}

// ============================================================================
// Repository
// ============================================================================

/**
 * Generate checksum for tamper detection
 */
function generateChecksum(
  timestamp: string,
  category: string,
  action: string,
  actor: string,
  details: string
): string {
  const content = `${timestamp}|${category}|${action}|${actor}|${details}`;
  return createHash('sha256').update(content).digest('hex');
}

/**
 * Audit repository for database operations
 */
export class AuditRepository {
  /**
   * Log an audit event
   */
  log(
    category: AuditCategory,
    severity: AuditSeverity,
    action: string,
    actor: string,
    details: Record<string, unknown>,
    taskId?: string,
    agentType?: AgentType
  ): AuditRecord {
    const db = getDatabase();
    const id = randomUUID();
    const timestamp = new Date().toISOString();
    const detailsJson = JSON.stringify(details);
    const checksum = generateChecksum(timestamp, category, action, actor, detailsJson);

    db.execute(
      `INSERT INTO audit_logs (id, timestamp, category, severity, action, actor, task_id, agent_type, details, checksum)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, timestamp, category, severity, action, actor, taskId ?? null, agentType ?? null, detailsJson, checksum]
    );

    log.debug('Audit log created', { id, category, action });

    return {
      id,
      timestamp,
      category,
      severity,
      action,
      actor,
      task_id: taskId ?? null,
      agent_type: agentType ?? null,
      details: detailsJson,
      checksum,
    };
  }

  /**
   * Log a system event
   */
  logSystem(action: string, details: Record<string, unknown>, severity: AuditSeverity = 'info'): AuditRecord {
    return this.log('system', severity, action, 'system', details);
  }

  /**
   * Log a workflow event
   */
  logWorkflow(
    action: string,
    taskId: string,
    details: Record<string, unknown>,
    severity: AuditSeverity = 'info'
  ): AuditRecord {
    return this.log('workflow', severity, action, 'workflow-engine', details, taskId);
  }

  /**
   * Log an agent event
   */
  logAgent(
    action: string,
    agentType: AgentType,
    taskId: string,
    details: Record<string, unknown>,
    severity: AuditSeverity = 'info'
  ): AuditRecord {
    return this.log('agent', severity, action, agentType, details, taskId, agentType);
  }

  /**
   * Log a security event
   */
  logSecurity(
    action: string,
    actor: string,
    details: Record<string, unknown>,
    severity: AuditSeverity = 'warning'
  ): AuditRecord {
    return this.log('security', severity, action, actor, details);
  }

  /**
   * Log a user action
   */
  logUser(
    action: string,
    details: Record<string, unknown>,
    taskId?: string
  ): AuditRecord {
    return this.log('user', 'info', action, 'user', details, taskId);
  }

  /**
   * Search audit logs
   */
  search(options: AuditSearchOptions = {}): AuditRecord[] {
    const db = getDatabase();
    const { category, severity, taskId, agent, since, until, limit = 50, offset = 0 } = options;

    const conditions: string[] = [];
    const params: unknown[] = [];

    if (category) {
      conditions.push('category = ?');
      params.push(category);
    }

    if (severity) {
      conditions.push('severity = ?');
      params.push(severity);
    }

    if (taskId) {
      conditions.push('task_id = ?');
      params.push(taskId);
    }

    if (agent) {
      conditions.push('agent_type = ?');
      params.push(agent);
    }

    if (since) {
      conditions.push('timestamp >= ?');
      params.push(since.toISOString());
    }

    if (until) {
      conditions.push('timestamp <= ?');
      params.push(until.toISOString());
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    params.push(limit, offset);

    return db.query<AuditRecord>(
      `SELECT * FROM audit_logs ${whereClause} ORDER BY timestamp DESC LIMIT ? OFFSET ?`,
      params
    );
  }

  /**
   * Get audit log by ID
   */
  getById(id: string): AuditRecord | undefined {
    const db = getDatabase();
    return db.queryOne<AuditRecord>('SELECT * FROM audit_logs WHERE id = ?', [id]);
  }

  /**
   * Get recent logs
   */
  getRecent(limit: number = 20): AuditRecord[] {
    const db = getDatabase();
    return db.query<AuditRecord>(
      'SELECT * FROM audit_logs ORDER BY timestamp DESC LIMIT ?',
      [limit]
    );
  }

  /**
   * Get logs for a task
   */
  getForTask(taskId: string): AuditRecord[] {
    const db = getDatabase();
    return db.query<AuditRecord>(
      'SELECT * FROM audit_logs WHERE task_id = ? ORDER BY timestamp ASC',
      [taskId]
    );
  }

  /**
   * Get critical/error logs
   */
  getProblems(since?: Date): AuditRecord[] {
    const db = getDatabase();
    const params: unknown[] = [];

    let whereClause = "WHERE severity IN ('error', 'critical')";
    if (since) {
      whereClause += ' AND timestamp >= ?';
      params.push(since.toISOString());
    }

    return db.query<AuditRecord>(
      `SELECT * FROM audit_logs ${whereClause} ORDER BY timestamp DESC`,
      params
    );
  }

  /**
   * Verify audit log integrity
   */
  verifyIntegrity(id: string): boolean {
    const record = this.getById(id);
    if (!record) {
      return false;
    }

    const expectedChecksum = generateChecksum(
      record.timestamp,
      record.category,
      record.action,
      record.actor,
      record.details
    );

    const valid = record.checksum === expectedChecksum;
    if (!valid) {
      log.error('Audit log integrity check failed', { id, expected: expectedChecksum, actual: record.checksum });
    }

    return valid;
  }

  /**
   * Verify all audit logs integrity
   */
  verifyAllIntegrity(): { valid: number; invalid: number; invalidIds: string[] } {
    const db = getDatabase();
    const records = db.query<AuditRecord>('SELECT * FROM audit_logs');

    let valid = 0;
    let invalid = 0;
    const invalidIds: string[] = [];

    for (const record of records) {
      if (this.verifyIntegrity(record.id)) {
        valid++;
      } else {
        invalid++;
        invalidIds.push(record.id);
      }
    }

    return { valid, invalid, invalidIds };
  }

  /**
   * Get audit statistics
   */
  getStats(): Record<string, unknown> {
    const db = getDatabase();

    const totalLogs = db.queryOne<{ count: number }>(
      'SELECT COUNT(*) as count FROM audit_logs'
    );

    const byCategory = db.query<{ category: string; count: number }>(
      'SELECT category, COUNT(*) as count FROM audit_logs GROUP BY category'
    );

    const bySeverity = db.query<{ severity: string; count: number }>(
      'SELECT severity, COUNT(*) as count FROM audit_logs GROUP BY severity'
    );

    const recentErrors = this.getProblems(new Date(Date.now() - 24 * 60 * 60 * 1000));

    return {
      totalLogs: totalLogs?.count ?? 0,
      byCategory: Object.fromEntries(byCategory.map((r) => [r.category, r.count])),
      bySeverity: Object.fromEntries(bySeverity.map((r) => [r.severity, r.count])),
      recentErrors: recentErrors.length,
    };
  }
}

// Singleton instance
let instance: AuditRepository | null = null;

/**
 * Get the audit repository singleton
 */
export function getAuditRepository(): AuditRepository {
  if (!instance) {
    instance = new AuditRepository();
  }
  return instance;
}

/**
 * Reset the singleton (for testing)
 */
export function resetAuditRepository(): void {
  instance = null;
}
