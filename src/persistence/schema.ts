/**
 * Database Schema
 *
 * SQLite table definitions for Aigentflow.
 */

import type Database from 'better-sqlite3';

export const SCHEMA_VERSION = 1;

/**
 * Create all database tables
 */
export function createSchema(db: Database.Database): void {
  db.exec(`
    -- Schema version tracking
    CREATE TABLE IF NOT EXISTS schema_version (
      version INTEGER NOT NULL,
      applied_at TEXT NOT NULL DEFAULT (datetime('now')),
      description TEXT
    );

    -- Insert current version
    INSERT INTO schema_version (version, description)
    VALUES (${SCHEMA_VERSION}, 'Initial schema');

    -- =========================================================================
    -- Core Tables
    -- =========================================================================

    -- Projects table
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      path TEXT NOT NULL,
      config TEXT NOT NULL, -- JSON
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_projects_name ON projects(name);

    -- =========================================================================
    -- Workflow Tables
    -- =========================================================================

    -- Workflow states (current state per task)
    CREATE TABLE IF NOT EXISTS workflow_states (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      task_id TEXT NOT NULL UNIQUE,
      state TEXT NOT NULL,
      prompt TEXT NOT NULL,
      context TEXT, -- JSON
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (project_id) REFERENCES projects(id)
    );

    CREATE INDEX IF NOT EXISTS idx_workflow_states_project ON workflow_states(project_id);
    CREATE INDEX IF NOT EXISTS idx_workflow_states_state ON workflow_states(state);
    CREATE INDEX IF NOT EXISTS idx_workflow_states_task ON workflow_states(task_id);

    -- State transitions (history)
    CREATE TABLE IF NOT EXISTS state_transitions (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL,
      from_state TEXT NOT NULL,
      to_state TEXT NOT NULL,
      trigger TEXT NOT NULL,
      agent TEXT,
      metadata TEXT, -- JSON
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (task_id) REFERENCES workflow_states(task_id)
    );

    CREATE INDEX IF NOT EXISTS idx_transitions_task ON state_transitions(task_id);
    CREATE INDEX IF NOT EXISTS idx_transitions_created ON state_transitions(created_at);

    -- Checkpoints for recovery
    CREATE TABLE IF NOT EXISTS checkpoints (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL,
      state TEXT NOT NULL,
      context TEXT NOT NULL, -- JSON (full execution context)
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (task_id) REFERENCES workflow_states(task_id)
    );

    CREATE INDEX IF NOT EXISTS idx_checkpoints_task ON checkpoints(task_id);
    CREATE INDEX IF NOT EXISTS idx_checkpoints_created ON checkpoints(created_at);

    -- =========================================================================
    -- Agent Tables
    -- =========================================================================

    -- Agent invocations (metrics)
    CREATE TABLE IF NOT EXISTS agent_invocations (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL,
      agent_type TEXT NOT NULL,
      started_at TEXT NOT NULL,
      completed_at TEXT,
      success INTEGER NOT NULL DEFAULT 0,
      tokens_used INTEGER DEFAULT 0,
      duration_ms INTEGER DEFAULT 0,
      input TEXT, -- JSON
      output TEXT, -- JSON
      error TEXT,
      FOREIGN KEY (task_id) REFERENCES workflow_states(task_id)
    );

    CREATE INDEX IF NOT EXISTS idx_invocations_task ON agent_invocations(task_id);
    CREATE INDEX IF NOT EXISTS idx_invocations_agent ON agent_invocations(agent_type);
    CREATE INDEX IF NOT EXISTS idx_invocations_started ON agent_invocations(started_at);

    -- =========================================================================
    -- Audit Tables
    -- =========================================================================

    -- Audit logs (immutable)
    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      timestamp TEXT NOT NULL DEFAULT (datetime('now')),
      category TEXT NOT NULL,
      severity TEXT NOT NULL,
      action TEXT NOT NULL,
      actor TEXT NOT NULL,
      task_id TEXT,
      agent_type TEXT,
      details TEXT NOT NULL, -- JSON
      checksum TEXT NOT NULL -- SHA-256 for tamper detection
    );

    CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_logs(timestamp);
    CREATE INDEX IF NOT EXISTS idx_audit_category ON audit_logs(category);
    CREATE INDEX IF NOT EXISTS idx_audit_task ON audit_logs(task_id);
    CREATE INDEX IF NOT EXISTS idx_audit_severity ON audit_logs(severity);

    -- =========================================================================
    -- Lessons Learned
    -- =========================================================================

    -- Lessons table with FTS
    CREATE TABLE IF NOT EXISTS lessons (
      id TEXT PRIMARY KEY,
      content TEXT NOT NULL,
      category TEXT NOT NULL,
      agent TEXT NOT NULL,
      source TEXT NOT NULL,
      tags TEXT, -- JSON array
      usage_count INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_lessons_category ON lessons(category);
    CREATE INDEX IF NOT EXISTS idx_lessons_agent ON lessons(agent);

    -- Full-text search for lessons
    CREATE VIRTUAL TABLE IF NOT EXISTS lessons_fts USING fts5(
      content,
      category,
      tags,
      content=lessons,
      content_rowid=rowid
    );

    -- Triggers to keep FTS in sync
    CREATE TRIGGER IF NOT EXISTS lessons_ai AFTER INSERT ON lessons BEGIN
      INSERT INTO lessons_fts(rowid, content, category, tags)
      VALUES (new.rowid, new.content, new.category, new.tags);
    END;

    CREATE TRIGGER IF NOT EXISTS lessons_ad AFTER DELETE ON lessons BEGIN
      INSERT INTO lessons_fts(lessons_fts, rowid, content, category, tags)
      VALUES ('delete', old.rowid, old.content, old.category, old.tags);
    END;

    CREATE TRIGGER IF NOT EXISTS lessons_au AFTER UPDATE ON lessons BEGIN
      INSERT INTO lessons_fts(lessons_fts, rowid, content, category, tags)
      VALUES ('delete', old.rowid, old.content, old.category, old.tags);
      INSERT INTO lessons_fts(rowid, content, category, tags)
      VALUES (new.rowid, new.content, new.category, new.tags);
    END;

    -- =========================================================================
    -- Configuration Tables
    -- =========================================================================

    -- Global and per-project configuration
    CREATE TABLE IF NOT EXISTS configurations (
      id TEXT PRIMARY KEY,
      scope TEXT NOT NULL, -- 'global' or project_id
      key TEXT NOT NULL,
      value TEXT NOT NULL, -- JSON
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(scope, key)
    );

    CREATE INDEX IF NOT EXISTS idx_config_scope ON configurations(scope);

    -- Feature flags
    CREATE TABLE IF NOT EXISTS feature_flags (
      id TEXT PRIMARY KEY,
      key TEXT NOT NULL UNIQUE,
      enabled INTEGER NOT NULL DEFAULT 0,
      phase TEXT NOT NULL,
      description TEXT,
      targeting TEXT, -- JSON targeting rules
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_flags_key ON feature_flags(key);
    CREATE INDEX IF NOT EXISTS idx_flags_phase ON feature_flags(phase);

    -- =========================================================================
    -- Approval Tables
    -- =========================================================================

    -- Pending approvals
    CREATE TABLE IF NOT EXISTS approvals (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL,
      type TEXT NOT NULL, -- 'design', 'architecture', 'code'
      description TEXT NOT NULL,
      artifact TEXT, -- JSON or path to artifact
      status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
      reviewer TEXT,
      message TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      resolved_at TEXT,
      FOREIGN KEY (task_id) REFERENCES workflow_states(task_id)
    );

    CREATE INDEX IF NOT EXISTS idx_approvals_task ON approvals(task_id);
    CREATE INDEX IF NOT EXISTS idx_approvals_status ON approvals(status);

    -- =========================================================================
    -- Execution Traces (for self-evolution)
    -- =========================================================================

    -- Execution traces
    CREATE TABLE IF NOT EXISTS execution_traces (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL,
      trace_data TEXT NOT NULL, -- JSON (full trace)
      patterns TEXT, -- JSON (detected patterns)
      interventions TEXT, -- JSON (human interventions)
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (task_id) REFERENCES workflow_states(task_id)
    );

    CREATE INDEX IF NOT EXISTS idx_traces_task ON execution_traces(task_id);
    CREATE INDEX IF NOT EXISTS idx_traces_created ON execution_traces(created_at);
  `);
}

/**
 * Drop all tables (for testing)
 */
export function dropSchema(db: Database.Database): void {
  db.exec(`
    DROP TABLE IF EXISTS execution_traces;
    DROP TABLE IF EXISTS approvals;
    DROP TABLE IF EXISTS feature_flags;
    DROP TABLE IF EXISTS configurations;
    DROP TABLE IF EXISTS lessons_fts;
    DROP TABLE IF EXISTS lessons;
    DROP TABLE IF EXISTS audit_logs;
    DROP TABLE IF EXISTS agent_invocations;
    DROP TABLE IF EXISTS checkpoints;
    DROP TABLE IF EXISTS state_transitions;
    DROP TABLE IF EXISTS workflow_states;
    DROP TABLE IF EXISTS projects;
    DROP TABLE IF EXISTS schema_version;
  `);
}

/**
 * Table names for reference
 */
export const TABLES = {
  SCHEMA_VERSION: 'schema_version',
  PROJECTS: 'projects',
  WORKFLOW_STATES: 'workflow_states',
  STATE_TRANSITIONS: 'state_transitions',
  CHECKPOINTS: 'checkpoints',
  AGENT_INVOCATIONS: 'agent_invocations',
  AUDIT_LOGS: 'audit_logs',
  LESSONS: 'lessons',
  LESSONS_FTS: 'lessons_fts',
  CONFIGURATIONS: 'configurations',
  FEATURE_FLAGS: 'feature_flags',
  APPROVALS: 'approvals',
  EXECUTION_TRACES: 'execution_traces',
} as const;
