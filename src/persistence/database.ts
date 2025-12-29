/**
 * Database Manager
 *
 * SQLite database connection and management.
 */

import Database from 'better-sqlite3';
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { DatabaseError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';
import { createSchema, SCHEMA_VERSION } from './schema.js';

const log = logger.child({ component: 'database' });

export interface DatabaseConfig {
  path: string;
  readonly: boolean;
  verbose: boolean;
}

const DEFAULT_CONFIG: DatabaseConfig = {
  path: './orchestrator-data/aigentflow.sqlite',
  readonly: false,
  verbose: false,
};

/**
 * Database manager singleton
 */
export class DatabaseManager {
  private static instance: DatabaseManager | null = null;
  private db: Database.Database | null = null;
  private config: DatabaseConfig;

  private constructor(config: Partial<DatabaseConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Get the singleton instance
   */
  static getInstance(config?: Partial<DatabaseConfig>): DatabaseManager {
    if (!DatabaseManager.instance) {
      DatabaseManager.instance = new DatabaseManager(config);
    }
    return DatabaseManager.instance;
  }

  /**
   * Reset the singleton (for testing)
   */
  static reset(): void {
    if (DatabaseManager.instance?.db) {
      DatabaseManager.instance.close();
    }
    DatabaseManager.instance = null;
  }

  /**
   * Initialize the database connection
   */
  initialize(): void {
    if (this.db) {
      return;
    }

    try {
      // Ensure directory exists
      const dir = join(this.config.path, '..');
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
        log.debug('Created database directory', { path: dir });
      }

      // Open database connection
      this.db = new Database(this.config.path, {
        readonly: this.config.readonly,
        verbose: this.config.verbose ? (msg) => log.debug(msg) : undefined,
      });

      // Configure database
      this.configure();

      // Create/update schema
      this.initializeSchema();

      log.info('Database initialized', { path: this.config.path });
    } catch (error) {
      throw new DatabaseError(
        `Failed to initialize database: ${error instanceof Error ? error.message : String(error)}`,
        { path: this.config.path }
      );
    }
  }

  /**
   * Configure database settings
   */
  private configure(): void {
    if (!this.db) return;

    // Enable WAL mode for better concurrent access
    this.db.pragma('journal_mode = WAL');

    // Enable foreign keys
    this.db.pragma('foreign_keys = ON');

    // Optimize for performance
    this.db.pragma('synchronous = NORMAL');
    this.db.pragma('cache_size = -64000'); // 64MB cache
    this.db.pragma('temp_store = MEMORY');

    log.debug('Database configured');
  }

  /**
   * Initialize or update schema
   */
  private initializeSchema(): void {
    if (!this.db) return;

    // Check current schema version
    const versionResult = this.db
      .prepare(
        `
      SELECT name FROM sqlite_master
      WHERE type='table' AND name='schema_version'
    `
      )
      .get() as { name: string } | undefined;

    if (!versionResult) {
      // Fresh database - create all tables
      log.info('Creating database schema', { version: SCHEMA_VERSION });
      createSchema(this.db);
    } else {
      // Check version and migrate if needed
      const current = this.db
        .prepare('SELECT version FROM schema_version ORDER BY applied_at DESC LIMIT 1')
        .get() as { version: number } | undefined;

      if (current && current.version < SCHEMA_VERSION) {
        log.info('Migrating database schema', {
          from: current.version,
          to: SCHEMA_VERSION,
        });
        // TODO: Implement migrations
      }
    }
  }

  /**
   * Get the raw database connection
   */
  getConnection(): Database.Database {
    if (!this.db) {
      throw new DatabaseError('Database not initialized. Call initialize() first.');
    }
    return this.db;
  }

  /**
   * Execute a query and return all results
   */
  query<T = unknown>(sql: string, params?: unknown[]): T[] {
    const db = this.getConnection();
    const stmt = db.prepare(sql);
    return (params ? stmt.all(...params) : stmt.all()) as T[];
  }

  /**
   * Execute a query and return first result
   */
  queryOne<T = unknown>(sql: string, params?: unknown[]): T | undefined {
    const db = this.getConnection();
    const stmt = db.prepare(sql);
    return (params ? stmt.get(...params) : stmt.get()) as T | undefined;
  }

  /**
   * Execute a statement (INSERT, UPDATE, DELETE)
   */
  execute(sql: string, params?: unknown[]): Database.RunResult {
    const db = this.getConnection();
    const stmt = db.prepare(sql);
    return params ? stmt.run(...params) : stmt.run();
  }

  /**
   * Run multiple statements in a transaction
   */
  transaction<T>(fn: () => T): T {
    const db = this.getConnection();
    return db.transaction(fn)();
  }

  /**
   * Check if the database is connected
   */
  isConnected(): boolean {
    return this.db !== null && this.db.open;
  }

  /**
   * Close the database connection
   */
  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
      log.info('Database connection closed');
    }
  }

  /**
   * Get database statistics
   */
  getStats(): Record<string, unknown> {
    if (!this.db) {
      return { connected: false };
    }

    const tables = this.query<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
    );

    const stats: Record<string, unknown> = {
      connected: true,
      path: this.config.path,
      tables: tables.length,
    };

    // Get row counts for key tables
    for (const table of ['workflow_states', 'audit_logs', 'lessons', 'checkpoints']) {
      try {
        const result = this.queryOne<{ count: number }>(`SELECT COUNT(*) as count FROM ${table}`);
        stats[`${table}_count`] = result?.count ?? 0;
      } catch {
        // Table might not exist yet
        stats[`${table}_count`] = 0;
      }
    }

    return stats;
  }
}

// Export singleton getter
export function getDatabase(config?: Partial<DatabaseConfig>): DatabaseManager {
  return DatabaseManager.getInstance(config);
}

/**
 * Initialize database with a specific path
 */
export function initializeDatabase(path: string): DatabaseManager {
  // Reset if different path
  DatabaseManager.reset();
  const manager = DatabaseManager.getInstance({ path });
  manager.initialize();
  return manager;
}

// Export for direct access in CLI
export const db = {
  get instance(): DatabaseManager {
    return DatabaseManager.getInstance();
  },
  initialize: (config?: Partial<DatabaseConfig>) => {
    const manager = DatabaseManager.getInstance(config);
    manager.initialize();
    return manager;
  },
  close: () => {
    DatabaseManager.getInstance().close();
  },
  reset: () => {
    DatabaseManager.reset();
  },
};

/**
 * Close the database and reset the singleton (for testing)
 */
export function closeDatabase(): void {
  DatabaseManager.reset();
}
