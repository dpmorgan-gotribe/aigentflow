# Step 04: Persistence Layer

> **Checkpoint:** CP0 - Foundation
> **Dependencies:** Step 01, Step 02, Step 03
> **Estimated Effort:** 3-4 hours

---

## Objective

Implement SQLite-based persistence for state, audit logs, lessons learned, and configuration. This provides durable storage that survives restarts and enables recovery from failures.

---

## Deliverables

- [ ] SQLite database setup with migrations
- [ ] State store implementation
- [ ] Audit log system
- [ ] Lessons learned storage
- [ ] Configuration persistence
- [ ] Execution history tracking

---

## Database Schema

```sql
-- Schema Version: 1.0.0

-- ═══════════════════════════════════════════════════════════════════
-- METADATA
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE schema_versions (
    version TEXT PRIMARY KEY,
    applied_at TEXT NOT NULL DEFAULT (datetime('now')),
    description TEXT
);

-- ═══════════════════════════════════════════════════════════════════
-- STATE MANAGEMENT
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE workflow_states (
    task_id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    state TEXT NOT NULL,
    context TEXT NOT NULL,  -- JSON
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_workflow_states_project ON workflow_states(project_id);

CREATE TABLE state_transitions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id TEXT NOT NULL,
    from_state TEXT NOT NULL,
    to_state TEXT NOT NULL,
    event TEXT NOT NULL,
    metadata TEXT,  -- JSON
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (task_id) REFERENCES workflow_states(task_id)
);

CREATE INDEX idx_state_transitions_task ON state_transitions(task_id);

CREATE TABLE checkpoints (
    id TEXT PRIMARY KEY,
    task_id TEXT NOT NULL,
    state TEXT NOT NULL,
    context TEXT NOT NULL,  -- JSON
    artifacts TEXT NOT NULL,  -- JSON array
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (task_id) REFERENCES workflow_states(task_id)
);

CREATE INDEX idx_checkpoints_task ON checkpoints(task_id);

-- ═══════════════════════════════════════════════════════════════════
-- AUDIT LOGGING
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp TEXT NOT NULL DEFAULT (datetime('now')),
    project_id TEXT,
    task_id TEXT,
    agent TEXT,
    action TEXT NOT NULL,
    category TEXT NOT NULL,  -- 'state', 'file', 'agent', 'security', 'user'
    details TEXT,  -- JSON
    user_id TEXT,
    ip_address TEXT
);

CREATE INDEX idx_audit_logs_project ON audit_logs(project_id);
CREATE INDEX idx_audit_logs_timestamp ON audit_logs(timestamp);
CREATE INDEX idx_audit_logs_category ON audit_logs(category);

-- ═══════════════════════════════════════════════════════════════════
-- LESSONS LEARNED
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE lessons (
    id TEXT PRIMARY KEY,
    project_id TEXT,
    category TEXT NOT NULL,  -- 'bug', 'pattern', 'preference', 'security', 'performance'
    title TEXT NOT NULL,
    summary TEXT NOT NULL,
    details TEXT,
    tags TEXT,  -- JSON array
    source_agent TEXT,
    source_file TEXT,
    confidence REAL DEFAULT 1.0,
    application_count INTEGER DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_lessons_category ON lessons(category);
CREATE INDEX idx_lessons_project ON lessons(project_id);

CREATE VIRTUAL TABLE lessons_fts USING fts5(
    title,
    summary,
    details,
    content='lessons',
    content_rowid='rowid'
);

-- Triggers to keep FTS in sync
CREATE TRIGGER lessons_ai AFTER INSERT ON lessons BEGIN
    INSERT INTO lessons_fts(rowid, title, summary, details)
    VALUES (new.rowid, new.title, new.summary, new.details);
END;

CREATE TRIGGER lessons_ad AFTER DELETE ON lessons BEGIN
    INSERT INTO lessons_fts(lessons_fts, rowid, title, summary, details)
    VALUES ('delete', old.rowid, old.title, old.summary, old.details);
END;

CREATE TRIGGER lessons_au AFTER UPDATE ON lessons BEGIN
    INSERT INTO lessons_fts(lessons_fts, rowid, title, summary, details)
    VALUES ('delete', old.rowid, old.title, old.summary, old.details);
    INSERT INTO lessons_fts(rowid, title, summary, details)
    VALUES (new.rowid, new.title, new.summary, new.details);
END;

-- ═══════════════════════════════════════════════════════════════════
-- EXECUTION HISTORY
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE execution_traces (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    task_id TEXT NOT NULL,
    prompt TEXT NOT NULL,
    started_at TEXT NOT NULL DEFAULT (datetime('now')),
    completed_at TEXT,
    success INTEGER,
    duration_ms INTEGER,
    token_usage TEXT,  -- JSON
    metadata TEXT  -- JSON
);

CREATE INDEX idx_execution_traces_project ON execution_traces(project_id);
CREATE INDEX idx_execution_traces_started ON execution_traces(started_at);

CREATE TABLE agent_invocations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    trace_id TEXT NOT NULL,
    agent TEXT NOT NULL,
    task_fragment TEXT,
    started_at TEXT NOT NULL DEFAULT (datetime('now')),
    completed_at TEXT,
    outcome TEXT,  -- 'success', 'partial', 'failure', 'escalated'
    quality_score REAL,
    token_usage TEXT,  -- JSON
    output_summary TEXT,
    error TEXT,
    FOREIGN KEY (trace_id) REFERENCES execution_traces(id)
);

CREATE INDEX idx_agent_invocations_trace ON agent_invocations(trace_id);
CREATE INDEX idx_agent_invocations_agent ON agent_invocations(agent);

-- ═══════════════════════════════════════════════════════════════════
-- CONFIGURATION
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE configurations (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,  -- JSON
    scope TEXT NOT NULL DEFAULT 'global',  -- 'global', 'project:{id}'
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

---

## Implementation Guide

### 1. Create database wrapper

```typescript
// src/persistence/database.ts

import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { logger } from '../utils/logger';

const SCHEMA_VERSION = '1.0.0';

export interface DatabaseOptions {
  dbPath?: string;
  inMemory?: boolean;
}

export class AigentflowDatabase {
  private db: Database.Database;
  private dbPath: string;

  constructor(options: DatabaseOptions = {}) {
    if (options.inMemory) {
      this.dbPath = ':memory:';
      this.db = new Database(':memory:');
    } else {
      this.dbPath = options.dbPath ?? this.getDefaultDbPath();
      this.ensureDirectory(this.dbPath);
      this.db = new Database(this.dbPath);
    }

    // Enable foreign keys and WAL mode for better performance
    this.db.pragma('foreign_keys = ON');
    this.db.pragma('journal_mode = WAL');

    // Initialize schema
    this.initializeSchema();
  }

  private getDefaultDbPath(): string {
    const dataDir = path.join(process.cwd(), 'orchestrator-data');
    return path.join(dataDir, 'aigentflow.db');
  }

  private ensureDirectory(filePath: string): void {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  private initializeSchema(): void {
    // Check if schema is already initialized
    const tableExists = this.db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='schema_versions'"
      )
      .get();

    if (!tableExists) {
      logger.debug('Initializing database schema...');
      this.createSchema();
      this.recordSchemaVersion(SCHEMA_VERSION, 'Initial schema');
      logger.debug('Database schema initialized');
    } else {
      // Check for migrations
      this.runMigrations();
    }
  }

  private createSchema(): void {
    const schema = `
      CREATE TABLE schema_versions (
          version TEXT PRIMARY KEY,
          applied_at TEXT NOT NULL DEFAULT (datetime('now')),
          description TEXT
      );

      CREATE TABLE workflow_states (
          task_id TEXT PRIMARY KEY,
          project_id TEXT NOT NULL,
          state TEXT NOT NULL,
          context TEXT NOT NULL,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE INDEX idx_workflow_states_project ON workflow_states(project_id);

      CREATE TABLE state_transitions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          task_id TEXT NOT NULL,
          from_state TEXT NOT NULL,
          to_state TEXT NOT NULL,
          event TEXT NOT NULL,
          metadata TEXT,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          FOREIGN KEY (task_id) REFERENCES workflow_states(task_id)
      );

      CREATE INDEX idx_state_transitions_task ON state_transitions(task_id);

      CREATE TABLE checkpoints (
          id TEXT PRIMARY KEY,
          task_id TEXT NOT NULL,
          state TEXT NOT NULL,
          context TEXT NOT NULL,
          artifacts TEXT NOT NULL,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          FOREIGN KEY (task_id) REFERENCES workflow_states(task_id)
      );

      CREATE INDEX idx_checkpoints_task ON checkpoints(task_id);

      CREATE TABLE audit_logs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          timestamp TEXT NOT NULL DEFAULT (datetime('now')),
          project_id TEXT,
          task_id TEXT,
          agent TEXT,
          action TEXT NOT NULL,
          category TEXT NOT NULL,
          details TEXT,
          user_id TEXT,
          ip_address TEXT
      );

      CREATE INDEX idx_audit_logs_project ON audit_logs(project_id);
      CREATE INDEX idx_audit_logs_timestamp ON audit_logs(timestamp);
      CREATE INDEX idx_audit_logs_category ON audit_logs(category);

      CREATE TABLE lessons (
          id TEXT PRIMARY KEY,
          project_id TEXT,
          category TEXT NOT NULL,
          title TEXT NOT NULL,
          summary TEXT NOT NULL,
          details TEXT,
          tags TEXT,
          source_agent TEXT,
          source_file TEXT,
          confidence REAL DEFAULT 1.0,
          application_count INTEGER DEFAULT 0,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE INDEX idx_lessons_category ON lessons(category);
      CREATE INDEX idx_lessons_project ON lessons(project_id);

      CREATE TABLE execution_traces (
          id TEXT PRIMARY KEY,
          project_id TEXT NOT NULL,
          task_id TEXT NOT NULL,
          prompt TEXT NOT NULL,
          started_at TEXT NOT NULL DEFAULT (datetime('now')),
          completed_at TEXT,
          success INTEGER,
          duration_ms INTEGER,
          token_usage TEXT,
          metadata TEXT
      );

      CREATE INDEX idx_execution_traces_project ON execution_traces(project_id);
      CREATE INDEX idx_execution_traces_started ON execution_traces(started_at);

      CREATE TABLE agent_invocations (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          trace_id TEXT NOT NULL,
          agent TEXT NOT NULL,
          task_fragment TEXT,
          started_at TEXT NOT NULL DEFAULT (datetime('now')),
          completed_at TEXT,
          outcome TEXT,
          quality_score REAL,
          token_usage TEXT,
          output_summary TEXT,
          error TEXT,
          FOREIGN KEY (trace_id) REFERENCES execution_traces(id)
      );

      CREATE INDEX idx_agent_invocations_trace ON agent_invocations(trace_id);
      CREATE INDEX idx_agent_invocations_agent ON agent_invocations(agent);

      CREATE TABLE configurations (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL,
          scope TEXT NOT NULL DEFAULT 'global',
          updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `;

    this.db.exec(schema);
  }

  private recordSchemaVersion(version: string, description: string): void {
    this.db
      .prepare('INSERT INTO schema_versions (version, description) VALUES (?, ?)')
      .run(version, description);
  }

  private runMigrations(): void {
    const currentVersion = this.db
      .prepare('SELECT version FROM schema_versions ORDER BY applied_at DESC LIMIT 1')
      .get() as { version: string } | undefined;

    if (currentVersion?.version === SCHEMA_VERSION) {
      return;
    }

    // Add migration logic here as schema evolves
    logger.debug(`Current schema version: ${currentVersion?.version ?? 'none'}`);
  }

  /**
   * Get the underlying database instance
   */
  getDb(): Database.Database {
    return this.db;
  }

  /**
   * Close database connection
   */
  close(): void {
    this.db.close();
  }

  /**
   * Run in transaction
   */
  transaction<T>(fn: () => T): T {
    return this.db.transaction(fn)();
  }
}
```

### 2. Implement SQLite state store

```typescript
// src/persistence/sqlite-state-store.ts

import { v4 as uuid } from 'uuid';
import { AigentflowDatabase } from './database';
import { StateStore, PersistedState } from './state-store';
import { WorkflowState, StateContext, StateTransition, Checkpoint } from '../core/states';

export class SQLiteStateStore implements StateStore {
  private db: AigentflowDatabase;

  constructor(db: AigentflowDatabase) {
    this.db = db;
  }

  async saveState(state: PersistedState): Promise<void> {
    const db = this.db.getDb();

    this.db.transaction(() => {
      // Upsert workflow state
      db.prepare(`
        INSERT INTO workflow_states (task_id, project_id, state, context, updated_at)
        VALUES (?, ?, ?, ?, datetime('now'))
        ON CONFLICT(task_id) DO UPDATE SET
          state = excluded.state,
          context = excluded.context,
          updated_at = datetime('now')
      `).run(
        state.taskId,
        state.projectId,
        state.state,
        JSON.stringify(state.context)
      );

      // Save new transitions (append only)
      const existingCount = db
        .prepare('SELECT COUNT(*) as count FROM state_transitions WHERE task_id = ?')
        .get(state.taskId) as { count: number };

      const newTransitions = state.history.slice(existingCount.count);

      const insertTransition = db.prepare(`
        INSERT INTO state_transitions (task_id, from_state, to_state, event, metadata)
        VALUES (?, ?, ?, ?, ?)
      `);

      for (const transition of newTransitions) {
        insertTransition.run(
          state.taskId,
          transition.from,
          transition.to,
          transition.event,
          transition.metadata ? JSON.stringify(transition.metadata) : null
        );
      }

      // Save checkpoints
      const insertCheckpoint = db.prepare(`
        INSERT OR REPLACE INTO checkpoints (id, task_id, state, context, artifacts)
        VALUES (?, ?, ?, ?, ?)
      `);

      for (const checkpoint of state.context.checkpoints) {
        insertCheckpoint.run(
          checkpoint.id,
          state.taskId,
          checkpoint.state,
          JSON.stringify(checkpoint.context),
          JSON.stringify(checkpoint.artifacts)
        );
      }
    });
  }

  async loadState(taskId: string): Promise<PersistedState | null> {
    const db = this.db.getDb();

    const row = db
      .prepare('SELECT * FROM workflow_states WHERE task_id = ?')
      .get(taskId) as any;

    if (!row) {
      return null;
    }

    // Load transitions
    const transitions = db
      .prepare('SELECT * FROM state_transitions WHERE task_id = ? ORDER BY id')
      .all(taskId) as any[];

    // Load checkpoints
    const checkpoints = db
      .prepare('SELECT * FROM checkpoints WHERE task_id = ? ORDER BY created_at')
      .all(taskId) as any[];

    const context: StateContext = JSON.parse(row.context);
    context.checkpoints = checkpoints.map((cp) => ({
      id: cp.id,
      state: cp.state as WorkflowState,
      timestamp: cp.created_at,
      context: JSON.parse(cp.context),
      artifacts: JSON.parse(cp.artifacts),
    }));

    return {
      taskId: row.task_id,
      projectId: row.project_id,
      state: row.state as WorkflowState,
      context,
      history: transitions.map((t) => ({
        from: t.from_state as WorkflowState,
        to: t.to_state as WorkflowState,
        event: t.event,
        timestamp: t.created_at,
        metadata: t.metadata ? JSON.parse(t.metadata) : undefined,
      })),
    };
  }

  async listStates(projectId: string): Promise<PersistedState[]> {
    const db = this.db.getDb();

    const rows = db
      .prepare('SELECT task_id FROM workflow_states WHERE project_id = ?')
      .all(projectId) as { task_id: string }[];

    const states: PersistedState[] = [];
    for (const row of rows) {
      const state = await this.loadState(row.task_id);
      if (state) {
        states.push(state);
      }
    }

    return states;
  }

  async deleteState(taskId: string): Promise<void> {
    const db = this.db.getDb();

    this.db.transaction(() => {
      db.prepare('DELETE FROM checkpoints WHERE task_id = ?').run(taskId);
      db.prepare('DELETE FROM state_transitions WHERE task_id = ?').run(taskId);
      db.prepare('DELETE FROM workflow_states WHERE task_id = ?').run(taskId);
    });
  }
}
```

### 3. Implement audit logger

```typescript
// src/persistence/audit-log.ts

import { AigentflowDatabase } from './database';

export type AuditCategory = 'state' | 'file' | 'agent' | 'security' | 'user';

export interface AuditEntry {
  id?: number;
  timestamp?: string;
  projectId?: string;
  taskId?: string;
  agent?: string;
  action: string;
  category: AuditCategory;
  details?: Record<string, unknown>;
  userId?: string;
  ipAddress?: string;
}

export interface AuditQueryOptions {
  projectId?: string;
  taskId?: string;
  category?: AuditCategory;
  agent?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
}

export class AuditLogger {
  private db: AigentflowDatabase;

  constructor(db: AigentflowDatabase) {
    this.db = db;
  }

  /**
   * Log an audit entry
   */
  log(entry: AuditEntry): number {
    const result = this.db.getDb().prepare(`
      INSERT INTO audit_logs (project_id, task_id, agent, action, category, details, user_id, ip_address)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      entry.projectId ?? null,
      entry.taskId ?? null,
      entry.agent ?? null,
      entry.action,
      entry.category,
      entry.details ? JSON.stringify(entry.details) : null,
      entry.userId ?? null,
      entry.ipAddress ?? null
    );

    return result.lastInsertRowid as number;
  }

  /**
   * Query audit logs
   */
  query(options: AuditQueryOptions = {}): AuditEntry[] {
    let sql = 'SELECT * FROM audit_logs WHERE 1=1';
    const params: unknown[] = [];

    if (options.projectId) {
      sql += ' AND project_id = ?';
      params.push(options.projectId);
    }

    if (options.taskId) {
      sql += ' AND task_id = ?';
      params.push(options.taskId);
    }

    if (options.category) {
      sql += ' AND category = ?';
      params.push(options.category);
    }

    if (options.agent) {
      sql += ' AND agent = ?';
      params.push(options.agent);
    }

    if (options.startDate) {
      sql += ' AND timestamp >= ?';
      params.push(options.startDate);
    }

    if (options.endDate) {
      sql += ' AND timestamp <= ?';
      params.push(options.endDate);
    }

    sql += ' ORDER BY timestamp DESC';

    if (options.limit) {
      sql += ' LIMIT ?';
      params.push(options.limit);
    }

    if (options.offset) {
      sql += ' OFFSET ?';
      params.push(options.offset);
    }

    const rows = this.db.getDb().prepare(sql).all(...params) as any[];

    return rows.map((row) => ({
      id: row.id,
      timestamp: row.timestamp,
      projectId: row.project_id,
      taskId: row.task_id,
      agent: row.agent,
      action: row.action,
      category: row.category as AuditCategory,
      details: row.details ? JSON.parse(row.details) : undefined,
      userId: row.user_id,
      ipAddress: row.ip_address,
    }));
  }

  /**
   * Get audit summary for a project
   */
  getSummary(projectId: string): { category: string; count: number }[] {
    const rows = this.db.getDb().prepare(`
      SELECT category, COUNT(*) as count
      FROM audit_logs
      WHERE project_id = ?
      GROUP BY category
      ORDER BY count DESC
    `).all(projectId) as { category: string; count: number }[];

    return rows;
  }

  /**
   * Export audit logs for compliance
   */
  export(projectId: string, format: 'json' | 'csv' = 'json'): string {
    const logs = this.query({ projectId });

    if (format === 'csv') {
      const headers = ['timestamp', 'action', 'category', 'agent', 'details'];
      const rows = logs.map((log) => [
        log.timestamp,
        log.action,
        log.category,
        log.agent ?? '',
        JSON.stringify(log.details ?? {}),
      ]);
      return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    }

    return JSON.stringify(logs, null, 2);
  }
}
```

### 4. Implement lessons store

```typescript
// src/persistence/lessons-store.ts

import { v4 as uuid } from 'uuid';
import { AigentflowDatabase } from './database';

export type LessonCategory = 'bug' | 'pattern' | 'preference' | 'security' | 'performance';

export interface Lesson {
  id: string;
  projectId?: string;
  category: LessonCategory;
  title: string;
  summary: string;
  details?: string;
  tags?: string[];
  sourceAgent?: string;
  sourceFile?: string;
  confidence: number;
  applicationCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface LessonInput {
  projectId?: string;
  category: LessonCategory;
  title: string;
  summary: string;
  details?: string;
  tags?: string[];
  sourceAgent?: string;
  sourceFile?: string;
  confidence?: number;
}

export interface LessonSearchOptions {
  query?: string;
  category?: LessonCategory;
  projectId?: string;
  tags?: string[];
  limit?: number;
  offset?: number;
}

export class LessonsStore {
  private db: AigentflowDatabase;

  constructor(db: AigentflowDatabase) {
    this.db = db;
  }

  /**
   * Create a new lesson
   */
  create(input: LessonInput): Lesson {
    const id = uuid();
    const now = new Date().toISOString();

    this.db.getDb().prepare(`
      INSERT INTO lessons (id, project_id, category, title, summary, details, tags, source_agent, source_file, confidence, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      input.projectId ?? null,
      input.category,
      input.title,
      input.summary,
      input.details ?? null,
      input.tags ? JSON.stringify(input.tags) : null,
      input.sourceAgent ?? null,
      input.sourceFile ?? null,
      input.confidence ?? 1.0,
      now,
      now
    );

    return this.getById(id)!;
  }

  /**
   * Get lesson by ID
   */
  getById(id: string): Lesson | null {
    const row = this.db.getDb()
      .prepare('SELECT * FROM lessons WHERE id = ?')
      .get(id) as any;

    return row ? this.rowToLesson(row) : null;
  }

  /**
   * Search lessons
   */
  search(options: LessonSearchOptions = {}): Lesson[] {
    let sql: string;
    const params: unknown[] = [];

    if (options.query) {
      // Use FTS for text search
      sql = `
        SELECT l.* FROM lessons l
        JOIN lessons_fts f ON l.rowid = f.rowid
        WHERE lessons_fts MATCH ?
      `;
      params.push(options.query);
    } else {
      sql = 'SELECT * FROM lessons WHERE 1=1';
    }

    if (options.category) {
      sql += ' AND category = ?';
      params.push(options.category);
    }

    if (options.projectId) {
      sql += ' AND (project_id = ? OR project_id IS NULL)';
      params.push(options.projectId);
    }

    if (options.tags && options.tags.length > 0) {
      // SQLite JSON contains check
      for (const tag of options.tags) {
        sql += ' AND tags LIKE ?';
        params.push(`%"${tag}"%`);
      }
    }

    sql += ' ORDER BY confidence DESC, application_count DESC';

    if (options.limit) {
      sql += ' LIMIT ?';
      params.push(options.limit);
    }

    if (options.offset) {
      sql += ' OFFSET ?';
      params.push(options.offset);
    }

    const rows = this.db.getDb().prepare(sql).all(...params) as any[];
    return rows.map(this.rowToLesson);
  }

  /**
   * Update lesson
   */
  update(id: string, updates: Partial<LessonInput>): Lesson | null {
    const existing = this.getById(id);
    if (!existing) return null;

    const fields: string[] = ['updated_at = datetime("now")'];
    const params: unknown[] = [];

    if (updates.title !== undefined) {
      fields.push('title = ?');
      params.push(updates.title);
    }

    if (updates.summary !== undefined) {
      fields.push('summary = ?');
      params.push(updates.summary);
    }

    if (updates.details !== undefined) {
      fields.push('details = ?');
      params.push(updates.details);
    }

    if (updates.tags !== undefined) {
      fields.push('tags = ?');
      params.push(JSON.stringify(updates.tags));
    }

    if (updates.confidence !== undefined) {
      fields.push('confidence = ?');
      params.push(updates.confidence);
    }

    params.push(id);

    this.db.getDb().prepare(`
      UPDATE lessons SET ${fields.join(', ')} WHERE id = ?
    `).run(...params);

    return this.getById(id);
  }

  /**
   * Record lesson application (used when applying a lesson)
   */
  recordApplication(id: string): void {
    this.db.getDb().prepare(`
      UPDATE lessons SET application_count = application_count + 1, updated_at = datetime('now')
      WHERE id = ?
    `).run(id);
  }

  /**
   * Delete lesson
   */
  delete(id: string): boolean {
    const result = this.db.getDb()
      .prepare('DELETE FROM lessons WHERE id = ?')
      .run(id);
    return result.changes > 0;
  }

  /**
   * Get lessons by category
   */
  getByCategory(category: LessonCategory, limit: number = 20): Lesson[] {
    return this.search({ category, limit });
  }

  /**
   * Get most applied lessons
   */
  getMostApplied(limit: number = 10): Lesson[] {
    const rows = this.db.getDb().prepare(`
      SELECT * FROM lessons
      ORDER BY application_count DESC
      LIMIT ?
    `).all(limit) as any[];

    return rows.map(this.rowToLesson);
  }

  private rowToLesson(row: any): Lesson {
    return {
      id: row.id,
      projectId: row.project_id,
      category: row.category as LessonCategory,
      title: row.title,
      summary: row.summary,
      details: row.details,
      tags: row.tags ? JSON.parse(row.tags) : undefined,
      sourceAgent: row.source_agent,
      sourceFile: row.source_file,
      confidence: row.confidence,
      applicationCount: row.application_count,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
```

### 5. Implement execution history tracker

```typescript
// src/persistence/execution-tracker.ts

import { v4 as uuid } from 'uuid';
import { AigentflowDatabase } from './database';

export interface ExecutionTrace {
  id: string;
  projectId: string;
  taskId: string;
  prompt: string;
  startedAt: string;
  completedAt?: string;
  success?: boolean;
  durationMs?: number;
  tokenUsage?: TokenUsage;
  metadata?: Record<string, unknown>;
}

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

export interface AgentInvocation {
  id?: number;
  traceId: string;
  agent: string;
  taskFragment?: string;
  startedAt: string;
  completedAt?: string;
  outcome?: 'success' | 'partial' | 'failure' | 'escalated';
  qualityScore?: number;
  tokenUsage?: TokenUsage;
  outputSummary?: string;
  error?: string;
}

export class ExecutionTracker {
  private db: AigentflowDatabase;

  constructor(db: AigentflowDatabase) {
    this.db = db;
  }

  /**
   * Start a new execution trace
   */
  startTrace(projectId: string, taskId: string, prompt: string): ExecutionTrace {
    const id = uuid();
    const startedAt = new Date().toISOString();

    this.db.getDb().prepare(`
      INSERT INTO execution_traces (id, project_id, task_id, prompt, started_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(id, projectId, taskId, prompt, startedAt);

    return {
      id,
      projectId,
      taskId,
      prompt,
      startedAt,
    };
  }

  /**
   * Complete an execution trace
   */
  completeTrace(
    id: string,
    success: boolean,
    tokenUsage?: TokenUsage,
    metadata?: Record<string, unknown>
  ): void {
    const completedAt = new Date().toISOString();
    const trace = this.getTrace(id);
    const durationMs = trace
      ? new Date(completedAt).getTime() - new Date(trace.startedAt).getTime()
      : 0;

    this.db.getDb().prepare(`
      UPDATE execution_traces
      SET completed_at = ?, success = ?, duration_ms = ?, token_usage = ?, metadata = ?
      WHERE id = ?
    `).run(
      completedAt,
      success ? 1 : 0,
      durationMs,
      tokenUsage ? JSON.stringify(tokenUsage) : null,
      metadata ? JSON.stringify(metadata) : null,
      id
    );
  }

  /**
   * Record an agent invocation
   */
  recordInvocation(invocation: AgentInvocation): number {
    const result = this.db.getDb().prepare(`
      INSERT INTO agent_invocations (trace_id, agent, task_fragment, started_at, completed_at, outcome, quality_score, token_usage, output_summary, error)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      invocation.traceId,
      invocation.agent,
      invocation.taskFragment ?? null,
      invocation.startedAt,
      invocation.completedAt ?? null,
      invocation.outcome ?? null,
      invocation.qualityScore ?? null,
      invocation.tokenUsage ? JSON.stringify(invocation.tokenUsage) : null,
      invocation.outputSummary ?? null,
      invocation.error ?? null
    );

    return result.lastInsertRowid as number;
  }

  /**
   * Update an agent invocation
   */
  updateInvocation(id: number, updates: Partial<AgentInvocation>): void {
    const fields: string[] = [];
    const params: unknown[] = [];

    if (updates.completedAt !== undefined) {
      fields.push('completed_at = ?');
      params.push(updates.completedAt);
    }

    if (updates.outcome !== undefined) {
      fields.push('outcome = ?');
      params.push(updates.outcome);
    }

    if (updates.qualityScore !== undefined) {
      fields.push('quality_score = ?');
      params.push(updates.qualityScore);
    }

    if (updates.tokenUsage !== undefined) {
      fields.push('token_usage = ?');
      params.push(JSON.stringify(updates.tokenUsage));
    }

    if (updates.outputSummary !== undefined) {
      fields.push('output_summary = ?');
      params.push(updates.outputSummary);
    }

    if (updates.error !== undefined) {
      fields.push('error = ?');
      params.push(updates.error);
    }

    if (fields.length === 0) return;

    params.push(id);
    this.db.getDb().prepare(`
      UPDATE agent_invocations SET ${fields.join(', ')} WHERE id = ?
    `).run(...params);
  }

  /**
   * Get execution trace
   */
  getTrace(id: string): ExecutionTrace | null {
    const row = this.db.getDb()
      .prepare('SELECT * FROM execution_traces WHERE id = ?')
      .get(id) as any;

    return row ? this.rowToTrace(row) : null;
  }

  /**
   * Get recent traces for a project
   */
  getRecentTraces(projectId: string, limit: number = 20): ExecutionTrace[] {
    const rows = this.db.getDb().prepare(`
      SELECT * FROM execution_traces
      WHERE project_id = ?
      ORDER BY started_at DESC
      LIMIT ?
    `).all(projectId, limit) as any[];

    return rows.map(this.rowToTrace);
  }

  /**
   * Get invocations for a trace
   */
  getInvocations(traceId: string): AgentInvocation[] {
    const rows = this.db.getDb().prepare(`
      SELECT * FROM agent_invocations
      WHERE trace_id = ?
      ORDER BY started_at
    `).all(traceId) as any[];

    return rows.map((row) => ({
      id: row.id,
      traceId: row.trace_id,
      agent: row.agent,
      taskFragment: row.task_fragment,
      startedAt: row.started_at,
      completedAt: row.completed_at,
      outcome: row.outcome,
      qualityScore: row.quality_score,
      tokenUsage: row.token_usage ? JSON.parse(row.token_usage) : undefined,
      outputSummary: row.output_summary,
      error: row.error,
    }));
  }

  /**
   * Get agent performance metrics
   */
  getAgentMetrics(agent: string, days: number = 30): AgentMetrics {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const rows = this.db.getDb().prepare(`
      SELECT
        COUNT(*) as total_invocations,
        SUM(CASE WHEN outcome = 'success' THEN 1 ELSE 0 END) as successes,
        SUM(CASE WHEN outcome = 'failure' THEN 1 ELSE 0 END) as failures,
        AVG(quality_score) as avg_quality,
        AVG(CASE WHEN token_usage IS NOT NULL THEN JSON_EXTRACT(token_usage, '$.totalTokens') END) as avg_tokens
      FROM agent_invocations
      WHERE agent = ? AND started_at >= ?
    `).get(agent, startDate.toISOString()) as any;

    return {
      agent,
      totalInvocations: rows.total_invocations,
      successRate: rows.total_invocations > 0
        ? rows.successes / rows.total_invocations
        : 0,
      failureRate: rows.total_invocations > 0
        ? rows.failures / rows.total_invocations
        : 0,
      avgQualityScore: rows.avg_quality,
      avgTokensPerInvocation: rows.avg_tokens,
    };
  }

  private rowToTrace(row: any): ExecutionTrace {
    return {
      id: row.id,
      projectId: row.project_id,
      taskId: row.task_id,
      prompt: row.prompt,
      startedAt: row.started_at,
      completedAt: row.completed_at,
      success: row.success === 1,
      durationMs: row.duration_ms,
      tokenUsage: row.token_usage ? JSON.parse(row.token_usage) : undefined,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
    };
  }
}

export interface AgentMetrics {
  agent: string;
  totalInvocations: number;
  successRate: number;
  failureRate: number;
  avgQualityScore?: number;
  avgTokensPerInvocation?: number;
}
```

---

## Test Scenarios

```typescript
// tests/cp0/04-persistence-layer.test.ts

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { AigentflowDatabase } from '../../src/persistence/database';
import { SQLiteStateStore } from '../../src/persistence/sqlite-state-store';
import { AuditLogger } from '../../src/persistence/audit-log';
import { LessonsStore } from '../../src/persistence/lessons-store';
import { ExecutionTracker } from '../../src/persistence/execution-tracker';
import { WorkflowState } from '../../src/core/states';

const TEST_DB_PATH = 'test-aigentflow.db';

describe('Step 04: Persistence Layer', () => {
  let db: AigentflowDatabase;

  beforeEach(() => {
    // Use in-memory database for tests
    db = new AigentflowDatabase({ inMemory: true });
  });

  afterEach(() => {
    db.close();
  });

  describe('Database initialization', () => {
    it('should create database with schema', () => {
      const tables = db.getDb()
        .prepare("SELECT name FROM sqlite_master WHERE type='table'")
        .all() as { name: string }[];

      const tableNames = tables.map((t) => t.name);
      expect(tableNames).toContain('workflow_states');
      expect(tableNames).toContain('audit_logs');
      expect(tableNames).toContain('lessons');
      expect(tableNames).toContain('execution_traces');
    });

    it('should record schema version', () => {
      const version = db.getDb()
        .prepare('SELECT version FROM schema_versions ORDER BY applied_at DESC LIMIT 1')
        .get() as { version: string };

      expect(version.version).toBe('1.0.0');
    });
  });

  describe('SQLiteStateStore', () => {
    let stateStore: SQLiteStateStore;

    beforeEach(() => {
      stateStore = new SQLiteStateStore(db);
    });

    it('should save and load state', async () => {
      const state = {
        taskId: 'task-1',
        projectId: 'project-1',
        state: WorkflowState.ANALYZING,
        context: {
          projectId: 'project-1',
          taskId: 'task-1',
          prompt: 'Test prompt',
          retryCount: 0,
          maxRetries: 3,
          checkpoints: [],
          metadata: {},
        },
        history: [
          {
            from: WorkflowState.IDLE,
            to: WorkflowState.ANALYZING,
            event: 'START',
            timestamp: new Date().toISOString(),
          },
        ],
      };

      await stateStore.saveState(state);
      const loaded = await stateStore.loadState('task-1');

      expect(loaded).not.toBeNull();
      expect(loaded?.state).toBe(WorkflowState.ANALYZING);
      expect(loaded?.context.prompt).toBe('Test prompt');
      expect(loaded?.history).toHaveLength(1);
    });

    it('should list states by project', async () => {
      await stateStore.saveState({
        taskId: 'task-1',
        projectId: 'project-1',
        state: WorkflowState.IDLE,
        context: {
          projectId: 'project-1',
          taskId: 'task-1',
          prompt: '',
          retryCount: 0,
          maxRetries: 3,
          checkpoints: [],
          metadata: {},
        },
        history: [],
      });

      await stateStore.saveState({
        taskId: 'task-2',
        projectId: 'project-1',
        state: WorkflowState.ANALYZING,
        context: {
          projectId: 'project-1',
          taskId: 'task-2',
          prompt: '',
          retryCount: 0,
          maxRetries: 3,
          checkpoints: [],
          metadata: {},
        },
        history: [],
      });

      const states = await stateStore.listStates('project-1');
      expect(states).toHaveLength(2);
    });

    it('should delete state', async () => {
      await stateStore.saveState({
        taskId: 'task-1',
        projectId: 'project-1',
        state: WorkflowState.IDLE,
        context: {
          projectId: 'project-1',
          taskId: 'task-1',
          prompt: '',
          retryCount: 0,
          maxRetries: 3,
          checkpoints: [],
          metadata: {},
        },
        history: [],
      });

      await stateStore.deleteState('task-1');
      const loaded = await stateStore.loadState('task-1');

      expect(loaded).toBeNull();
    });
  });

  describe('AuditLogger', () => {
    let auditLogger: AuditLogger;

    beforeEach(() => {
      auditLogger = new AuditLogger(db);
    });

    it('should log audit entries', () => {
      const id = auditLogger.log({
        projectId: 'project-1',
        action: 'state_transition',
        category: 'state',
        details: { from: 'IDLE', to: 'ANALYZING' },
      });

      expect(id).toBeGreaterThan(0);
    });

    it('should query audit logs', () => {
      auditLogger.log({
        projectId: 'project-1',
        action: 'file_write',
        category: 'file',
      });

      auditLogger.log({
        projectId: 'project-1',
        action: 'agent_invoke',
        category: 'agent',
      });

      const logs = auditLogger.query({ projectId: 'project-1' });
      expect(logs).toHaveLength(2);

      const fileLogs = auditLogger.query({ category: 'file' });
      expect(fileLogs).toHaveLength(1);
    });

    it('should get summary', () => {
      auditLogger.log({ projectId: 'project-1', action: 'a1', category: 'state' });
      auditLogger.log({ projectId: 'project-1', action: 'a2', category: 'state' });
      auditLogger.log({ projectId: 'project-1', action: 'a3', category: 'agent' });

      const summary = auditLogger.getSummary('project-1');
      expect(summary).toHaveLength(2);
      expect(summary[0].category).toBe('state');
      expect(summary[0].count).toBe(2);
    });

    it('should export to JSON and CSV', () => {
      auditLogger.log({
        projectId: 'project-1',
        action: 'test',
        category: 'state',
      });

      const json = auditLogger.export('project-1', 'json');
      expect(JSON.parse(json)).toHaveLength(1);

      const csv = auditLogger.export('project-1', 'csv');
      expect(csv).toContain('timestamp');
      expect(csv).toContain('test');
    });
  });

  describe('LessonsStore', () => {
    let lessonsStore: LessonsStore;

    beforeEach(() => {
      lessonsStore = new LessonsStore(db);
    });

    it('should create and retrieve lesson', () => {
      const lesson = lessonsStore.create({
        category: 'bug',
        title: 'Fix null pointer',
        summary: 'Always check for null before accessing properties',
        tags: ['typescript', 'safety'],
      });

      expect(lesson.id).toBeDefined();
      expect(lesson.title).toBe('Fix null pointer');

      const retrieved = lessonsStore.getById(lesson.id);
      expect(retrieved?.summary).toBe('Always check for null before accessing properties');
    });

    it('should search lessons', () => {
      lessonsStore.create({
        category: 'pattern',
        title: 'React hooks pattern',
        summary: 'Use custom hooks for shared logic',
      });

      lessonsStore.create({
        category: 'bug',
        title: 'React state bug',
        summary: 'State updates are async',
      });

      const reactLessons = lessonsStore.search({ query: 'React' });
      expect(reactLessons).toHaveLength(2);

      const bugLessons = lessonsStore.search({ category: 'bug' });
      expect(bugLessons).toHaveLength(1);
    });

    it('should record application', () => {
      const lesson = lessonsStore.create({
        category: 'pattern',
        title: 'Test pattern',
        summary: 'Test summary',
      });

      expect(lesson.applicationCount).toBe(0);

      lessonsStore.recordApplication(lesson.id);
      lessonsStore.recordApplication(lesson.id);

      const updated = lessonsStore.getById(lesson.id);
      expect(updated?.applicationCount).toBe(2);
    });
  });

  describe('ExecutionTracker', () => {
    let tracker: ExecutionTracker;

    beforeEach(() => {
      tracker = new ExecutionTracker(db);
    });

    it('should track execution trace', () => {
      const trace = tracker.startTrace('project-1', 'task-1', 'Test prompt');
      expect(trace.id).toBeDefined();
      expect(trace.prompt).toBe('Test prompt');

      tracker.completeTrace(trace.id, true, {
        inputTokens: 100,
        outputTokens: 200,
        totalTokens: 300,
      });

      const completed = tracker.getTrace(trace.id);
      expect(completed?.success).toBe(true);
      expect(completed?.tokenUsage?.totalTokens).toBe(300);
    });

    it('should record agent invocations', () => {
      const trace = tracker.startTrace('project-1', 'task-1', 'Test');

      const invocationId = tracker.recordInvocation({
        traceId: trace.id,
        agent: 'planner',
        taskFragment: 'Create plan',
        startedAt: new Date().toISOString(),
      });

      tracker.updateInvocation(invocationId, {
        completedAt: new Date().toISOString(),
        outcome: 'success',
        qualityScore: 0.9,
      });

      const invocations = tracker.getInvocations(trace.id);
      expect(invocations).toHaveLength(1);
      expect(invocations[0].outcome).toBe('success');
    });

    it('should get recent traces', () => {
      tracker.startTrace('project-1', 'task-1', 'Test 1');
      tracker.startTrace('project-1', 'task-2', 'Test 2');
      tracker.startTrace('project-2', 'task-3', 'Test 3');

      const traces = tracker.getRecentTraces('project-1');
      expect(traces).toHaveLength(2);
    });

    it('should calculate agent metrics', () => {
      const trace = tracker.startTrace('project-1', 'task-1', 'Test');

      tracker.recordInvocation({
        traceId: trace.id,
        agent: 'builder',
        startedAt: new Date().toISOString(),
        outcome: 'success',
        qualityScore: 0.9,
      });

      tracker.recordInvocation({
        traceId: trace.id,
        agent: 'builder',
        startedAt: new Date().toISOString(),
        outcome: 'success',
        qualityScore: 0.8,
      });

      tracker.recordInvocation({
        traceId: trace.id,
        agent: 'builder',
        startedAt: new Date().toISOString(),
        outcome: 'failure',
      });

      const metrics = tracker.getAgentMetrics('builder');
      expect(metrics.totalInvocations).toBe(3);
      expect(metrics.successRate).toBeCloseTo(0.67, 1);
      expect(metrics.avgQualityScore).toBeCloseTo(0.85, 1);
    });
  });

  describe('Data integrity', () => {
    it('should not persist secrets', () => {
      const auditLogger = new AuditLogger(db);

      // Simulate logging with potential secrets
      auditLogger.log({
        action: 'config_update',
        category: 'user',
        details: {
          setting: 'api_key',
          // The actual secret should never be logged
          value: '***REDACTED***',
        },
      });

      const logs = auditLogger.query({});
      expect(JSON.stringify(logs)).not.toContain('sk-ant-');
      expect(JSON.stringify(logs)).not.toContain('AKIA');
    });
  });
});
```

---

## Validation Checklist

```
□ SQLite database creates on first run
□ Schema version tracking works
□ State persists across restarts
□ State transitions are recorded
□ Checkpoints are saved and loadable
□ Audit log captures all operations
□ Audit log supports filtering and export
□ Lessons can be created and searched
□ Lessons FTS search works
□ Execution traces are recorded
□ Agent invocations are tracked
□ Agent metrics can be calculated
□ Secrets are never written to database
□ Transactions maintain data integrity
```

---

## CP0 Checkpoint Complete

After completing this step, run the full CP0 validation:

```bash
npm run test:cp0
```

All tests should pass. Then create the checkpoint tag:

```bash
git tag cp0-foundation -m "Checkpoint 0: Foundation complete"
```

---

## Next Checkpoint

Proceed to **CP1: Design System** starting with **Step 05: Agent Framework**.
