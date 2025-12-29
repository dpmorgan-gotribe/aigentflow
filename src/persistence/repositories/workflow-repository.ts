/**
 * Workflow Repository
 *
 * Data access layer for workflow states and transitions.
 */

import { randomUUID } from 'crypto';
import type { WorkflowState, AgentType } from '../../types.js';
import { getDatabase } from '../database.js';
import { logger } from '../../utils/logger.js';
import { NotFoundError } from '../../utils/errors.js';

const log = logger.child({ component: 'workflow-repository' });

// ============================================================================
// Types
// ============================================================================

export interface WorkflowStateRecord {
  id: string;
  project_id: string;
  task_id: string;
  state: WorkflowState;
  prompt: string;
  context: string | null;
  created_at: string;
  updated_at: string;
}

export interface StateTransitionRecord {
  id: string;
  task_id: string;
  from_state: WorkflowState;
  to_state: WorkflowState;
  trigger: string;
  agent: string | null;
  metadata: string | null;
  created_at: string;
}

export interface CheckpointRecord {
  id: string;
  task_id: string;
  state: WorkflowState;
  context: string;
  created_at: string;
}

// ============================================================================
// Repository
// ============================================================================

/**
 * Workflow repository for database operations
 */
export class WorkflowRepository {
  /**
   * Create a new workflow state
   */
  createWorkflowState(
    projectId: string,
    taskId: string,
    prompt: string,
    context?: Record<string, unknown>
  ): WorkflowStateRecord {
    const db = getDatabase();
    const id = randomUUID();
    const now = new Date().toISOString();

    db.execute(
      `INSERT INTO workflow_states (id, project_id, task_id, state, prompt, context, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, projectId, taskId, 'IDLE', prompt, context ? JSON.stringify(context) : null, now, now]
    );

    log.debug('Workflow state created', { id, taskId, projectId });

    return {
      id,
      project_id: projectId,
      task_id: taskId,
      state: 'IDLE',
      prompt,
      context: context ? JSON.stringify(context) : null,
      created_at: now,
      updated_at: now,
    };
  }

  /**
   * Get workflow state by task ID
   */
  getByTaskId(taskId: string): WorkflowStateRecord | undefined {
    const db = getDatabase();
    return db.queryOne<WorkflowStateRecord>(
      'SELECT * FROM workflow_states WHERE task_id = ?',
      [taskId]
    );
  }

  /**
   * Get workflow state by ID
   */
  getById(id: string): WorkflowStateRecord | undefined {
    const db = getDatabase();
    return db.queryOne<WorkflowStateRecord>(
      'SELECT * FROM workflow_states WHERE id = ?',
      [id]
    );
  }

  /**
   * Update workflow state
   */
  updateState(taskId: string, state: WorkflowState, context?: Record<string, unknown>): void {
    const db = getDatabase();
    const now = new Date().toISOString();

    const result = db.execute(
      `UPDATE workflow_states
       SET state = ?, context = COALESCE(?, context), updated_at = ?
       WHERE task_id = ?`,
      [state, context ? JSON.stringify(context) : null, now, taskId]
    );

    if (result.changes === 0) {
      throw new NotFoundError('WorkflowState', taskId);
    }

    log.debug('Workflow state updated', { taskId, state });
  }

  /**
   * Get all workflow states for a project
   */
  getByProjectId(projectId: string): WorkflowStateRecord[] {
    const db = getDatabase();
    return db.query<WorkflowStateRecord>(
      'SELECT * FROM workflow_states WHERE project_id = ? ORDER BY created_at DESC',
      [projectId]
    );
  }

  /**
   * Get workflow states by state
   */
  getByState(state: WorkflowState): WorkflowStateRecord[] {
    const db = getDatabase();
    return db.query<WorkflowStateRecord>(
      'SELECT * FROM workflow_states WHERE state = ? ORDER BY updated_at DESC',
      [state]
    );
  }

  /**
   * Record a state transition
   */
  recordTransition(
    taskId: string,
    fromState: WorkflowState,
    toState: WorkflowState,
    trigger: string,
    agent?: AgentType,
    metadata?: Record<string, unknown>
  ): StateTransitionRecord {
    const db = getDatabase();
    const id = randomUUID();
    const now = new Date().toISOString();

    db.execute(
      `INSERT INTO state_transitions (id, task_id, from_state, to_state, trigger, agent, metadata, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, taskId, fromState, toState, trigger, agent ?? null, metadata ? JSON.stringify(metadata) : null, now]
    );

    log.debug('Transition recorded', { taskId, fromState, toState, trigger });

    return {
      id,
      task_id: taskId,
      from_state: fromState,
      to_state: toState,
      trigger,
      agent: agent ?? null,
      metadata: metadata ? JSON.stringify(metadata) : null,
      created_at: now,
    };
  }

  /**
   * Get transitions for a task
   */
  getTransitions(taskId: string): StateTransitionRecord[] {
    const db = getDatabase();
    return db.query<StateTransitionRecord>(
      'SELECT * FROM state_transitions WHERE task_id = ? ORDER BY created_at ASC',
      [taskId]
    );
  }

  /**
   * Create a checkpoint
   */
  createCheckpoint(
    taskId: string,
    state: WorkflowState,
    context: Record<string, unknown>
  ): CheckpointRecord {
    const db = getDatabase();
    const id = randomUUID();
    const now = new Date().toISOString();

    db.execute(
      `INSERT INTO checkpoints (id, task_id, state, context, created_at)
       VALUES (?, ?, ?, ?, ?)`,
      [id, taskId, state, JSON.stringify(context), now]
    );

    log.debug('Checkpoint created', { id, taskId, state });

    return {
      id,
      task_id: taskId,
      state,
      context: JSON.stringify(context),
      created_at: now,
    };
  }

  /**
   * Get checkpoints for a task
   */
  getCheckpoints(taskId: string): CheckpointRecord[] {
    const db = getDatabase();
    return db.query<CheckpointRecord>(
      'SELECT * FROM checkpoints WHERE task_id = ? ORDER BY created_at DESC',
      [taskId]
    );
  }

  /**
   * Get latest checkpoint for a task
   */
  getLatestCheckpoint(taskId: string): CheckpointRecord | undefined {
    const db = getDatabase();
    return db.queryOne<CheckpointRecord>(
      'SELECT * FROM checkpoints WHERE task_id = ? ORDER BY created_at DESC LIMIT 1',
      [taskId]
    );
  }

  /**
   * Get checkpoint by ID
   */
  getCheckpointById(checkpointId: string): CheckpointRecord | undefined {
    const db = getDatabase();
    return db.queryOne<CheckpointRecord>(
      'SELECT * FROM checkpoints WHERE id = ?',
      [checkpointId]
    );
  }

  /**
   * Delete old checkpoints (keep latest N)
   */
  pruneCheckpoints(taskId: string, keepCount: number = 5): number {
    const db = getDatabase();

    // Get IDs to keep
    const toKeep = db.query<{ id: string }>(
      `SELECT id FROM checkpoints WHERE task_id = ? ORDER BY created_at DESC LIMIT ?`,
      [taskId, keepCount]
    );

    const keepIds = toKeep.map((r) => r.id);

    if (keepIds.length === 0) {
      return 0;
    }

    // Delete the rest
    const placeholders = keepIds.map(() => '?').join(',');
    const result = db.execute(
      `DELETE FROM checkpoints WHERE task_id = ? AND id NOT IN (${placeholders})`,
      [taskId, ...keepIds]
    );

    if (result.changes > 0) {
      log.debug('Checkpoints pruned', { taskId, deleted: result.changes });
    }

    return result.changes;
  }

  /**
   * Get workflow statistics
   */
  getStats(): Record<string, unknown> {
    const db = getDatabase();

    const totalWorkflows = db.queryOne<{ count: number }>(
      'SELECT COUNT(*) as count FROM workflow_states'
    );

    const byState = db.query<{ state: string; count: number }>(
      'SELECT state, COUNT(*) as count FROM workflow_states GROUP BY state'
    );

    const totalTransitions = db.queryOne<{ count: number }>(
      'SELECT COUNT(*) as count FROM state_transitions'
    );

    const totalCheckpoints = db.queryOne<{ count: number }>(
      'SELECT COUNT(*) as count FROM checkpoints'
    );

    return {
      totalWorkflows: totalWorkflows?.count ?? 0,
      byState: Object.fromEntries(byState.map((r) => [r.state, r.count])),
      totalTransitions: totalTransitions?.count ?? 0,
      totalCheckpoints: totalCheckpoints?.count ?? 0,
    };
  }
}

// Singleton instance
let instance: WorkflowRepository | null = null;

/**
 * Get the workflow repository singleton
 */
export function getWorkflowRepository(): WorkflowRepository {
  if (!instance) {
    instance = new WorkflowRepository();
  }
  return instance;
}

/**
 * Reset the singleton (for testing)
 */
export function resetWorkflowRepository(): void {
  instance = null;
}
