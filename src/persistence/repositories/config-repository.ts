/**
 * Configuration Repository
 *
 * Data access layer for global and project configuration.
 */

import { randomUUID } from 'crypto';
import { getDatabase } from '../database.js';
import { logger } from '../../utils/logger.js';
import { DEFAULT_CONFIG } from '../../config/defaults.js';

const log = logger.child({ component: 'config-repository' });

// ============================================================================
// Types
// ============================================================================

export interface ConfigRecord {
  id: string;
  scope: string;
  key: string;
  value: string; // JSON
  created_at: string;
  updated_at: string;
}

// ============================================================================
// Repository
// ============================================================================

/**
 * Configuration repository for database operations
 */
export class ConfigRepository {
  /**
   * Get a configuration value
   */
  get<T = unknown>(key: string, scope: string = 'global'): T | undefined {
    const db = getDatabase();
    const record = db.queryOne<ConfigRecord>(
      'SELECT * FROM configurations WHERE scope = ? AND key = ?',
      [scope, key]
    );

    if (!record) {
      return undefined;
    }

    return JSON.parse(record.value) as T;
  }

  /**
   * Get a configuration value with default
   */
  getOrDefault<T>(key: string, defaultValue: T, scope: string = 'global'): T {
    const value = this.get<T>(key, scope);
    return value !== undefined ? value : defaultValue;
  }

  /**
   * Set a configuration value
   */
  set<T = unknown>(key: string, value: T, scope: string = 'global'): void {
    const db = getDatabase();
    const id = randomUUID();
    const now = new Date().toISOString();

    db.execute(
      `INSERT INTO configurations (id, scope, key, value, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(scope, key) DO UPDATE SET value = ?, updated_at = ?`,
      [id, scope, key, JSON.stringify(value), now, now, JSON.stringify(value), now]
    );

    log.debug('Config set', { scope, key });
  }

  /**
   * Delete a configuration value
   */
  delete(key: string, scope: string = 'global'): boolean {
    const db = getDatabase();
    const result = db.execute(
      'DELETE FROM configurations WHERE scope = ? AND key = ?',
      [scope, key]
    );

    if (result.changes > 0) {
      log.debug('Config deleted', { scope, key });
      return true;
    }

    return false;
  }

  /**
   * Get all configuration values for a scope
   */
  getAll(scope: string = 'global'): Map<string, unknown> {
    const db = getDatabase();
    const records = db.query<ConfigRecord>(
      'SELECT * FROM configurations WHERE scope = ? ORDER BY key',
      [scope]
    );

    const config = new Map<string, unknown>();
    for (const record of records) {
      config.set(record.key, JSON.parse(record.value));
    }

    return config;
  }

  /**
   * Get all configuration as flat object
   */
  getAllAsObject(scope: string = 'global'): Record<string, unknown> {
    const map = this.getAll(scope);
    return Object.fromEntries(map);
  }

  /**
   * Reset configuration to defaults
   */
  reset(scope: string = 'global'): void {
    const db = getDatabase();

    // Delete all for scope
    db.execute('DELETE FROM configurations WHERE scope = ?', [scope]);

    if (scope === 'global') {
      // Restore defaults
      for (const [key, value] of Object.entries(DEFAULT_CONFIG)) {
        this.set(key, value, 'global');
      }
    }

    log.info('Configuration reset', { scope });
  }

  /**
   * Initialize defaults if not present
   */
  initializeDefaults(): void {
    for (const [key, value] of Object.entries(DEFAULT_CONFIG)) {
      if (this.get(key) === undefined) {
        this.set(key, value, 'global');
      }
    }
  }

  /**
   * Get merged configuration (defaults + global + project)
   */
  getMerged(projectId?: string): Record<string, unknown> {
    // Start with defaults
    const config: Record<string, unknown> = { ...DEFAULT_CONFIG };

    // Layer global config
    const globalConfig = this.getAllAsObject('global');
    Object.assign(config, globalConfig);

    // Layer project config if provided
    if (projectId) {
      const projectConfig = this.getAllAsObject(projectId);
      Object.assign(config, projectConfig);
    }

    return config;
  }
}

// Singleton instance
let instance: ConfigRepository | null = null;

/**
 * Get the config repository singleton
 */
export function getConfigRepository(): ConfigRepository {
  if (!instance) {
    instance = new ConfigRepository();
  }
  return instance;
}

/**
 * Reset the singleton (for testing)
 */
export function resetConfigRepository(): void {
  instance = null;
}
