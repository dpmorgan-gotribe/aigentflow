/**
 * Project Repository
 *
 * Data access layer for project management.
 */

import { randomUUID } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import type { ProjectConfig, ComplianceFramework } from '../../types.js';
import { getDatabase } from '../database.js';
import { logger } from '../../utils/logger.js';
import { NotFoundError, AigentflowError } from '../../utils/errors.js';

const log = logger.child({ component: 'project-repository' });

// ============================================================================
// Types
// ============================================================================

export interface ProjectRecord {
  id: string;
  name: string;
  path: string;
  config: string; // JSON
  created_at: string;
  updated_at: string;
}

// ============================================================================
// Repository
// ============================================================================

/**
 * Project repository for database operations
 */
export class ProjectRepository {
  /**
   * Create a new project
   */
  create(
    name: string,
    projectPath: string,
    config: Partial<ProjectConfig> = {}
  ): ProjectRecord {
    const db = getDatabase();
    const id = randomUUID();
    const now = new Date().toISOString();

    const fullConfig: ProjectConfig = {
      version: '1.0.0',
      name,
      compliance: config.compliance ?? [],
      agents: config.agents ?? {},
      hooks: config.hooks ?? [],
      features: config.features ?? {},
      created: now,
    };

    db.execute(
      `INSERT INTO projects (id, name, path, config, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, name, projectPath, JSON.stringify(fullConfig), now, now]
    );

    log.info('Project created', { id, name, path: projectPath });

    return {
      id,
      name,
      path: projectPath,
      config: JSON.stringify(fullConfig),
      created_at: now,
      updated_at: now,
    };
  }

  /**
   * Get project by name
   */
  getByName(name: string): ProjectRecord | undefined {
    const db = getDatabase();
    return db.queryOne<ProjectRecord>('SELECT * FROM projects WHERE name = ?', [name]);
  }

  /**
   * Get project by ID
   */
  getById(id: string): ProjectRecord | undefined {
    const db = getDatabase();
    return db.queryOne<ProjectRecord>('SELECT * FROM projects WHERE id = ?', [id]);
  }

  /**
   * Get project by path
   */
  getByPath(projectPath: string): ProjectRecord | undefined {
    const db = getDatabase();
    return db.queryOne<ProjectRecord>('SELECT * FROM projects WHERE path = ?', [projectPath]);
  }

  /**
   * Get all projects
   */
  getAll(): ProjectRecord[] {
    const db = getDatabase();
    return db.query<ProjectRecord>('SELECT * FROM projects ORDER BY updated_at DESC');
  }

  /**
   * Update project config
   */
  updateConfig(id: string, config: Partial<ProjectConfig>): void {
    const db = getDatabase();
    const now = new Date().toISOString();

    const existing = this.getById(id);
    if (!existing) {
      throw new NotFoundError('Project', id);
    }

    const currentConfig = JSON.parse(existing.config) as ProjectConfig;
    const newConfig = { ...currentConfig, ...config };

    const result = db.execute(
      'UPDATE projects SET config = ?, updated_at = ? WHERE id = ?',
      [JSON.stringify(newConfig), now, id]
    );

    if (result.changes === 0) {
      throw new NotFoundError('Project', id);
    }

    log.debug('Project config updated', { id });
  }

  /**
   * Delete project
   */
  delete(id: string): void {
    const db = getDatabase();

    const result = db.execute('DELETE FROM projects WHERE id = ?', [id]);

    if (result.changes === 0) {
      throw new NotFoundError('Project', id);
    }

    log.info('Project deleted', { id });
  }

  /**
   * Find project from current working directory
   */
  findFromCwd(cwd: string = process.cwd()): ProjectRecord | undefined {
    // Check for .aigentflow directory
    const aigentflowDir = path.join(cwd, '.aigentflow');
    if (fs.existsSync(aigentflowDir)) {
      return this.getByPath(cwd);
    }

    // Check for aigentflow.json
    const configFile = path.join(cwd, 'aigentflow.json');
    if (fs.existsSync(configFile)) {
      return this.getByPath(cwd);
    }

    return undefined;
  }

  /**
   * Get project statistics
   */
  getStats(): Record<string, unknown> {
    const db = getDatabase();

    const totalProjects = db.queryOne<{ count: number }>(
      'SELECT COUNT(*) as count FROM projects'
    );

    return {
      totalProjects: totalProjects?.count ?? 0,
    };
  }
}

// Singleton instance
let instance: ProjectRepository | null = null;

/**
 * Get the project repository singleton
 */
export function getProjectRepository(): ProjectRepository {
  if (!instance) {
    instance = new ProjectRepository();
  }
  return instance;
}

/**
 * Reset the singleton (for testing)
 */
export function resetProjectRepository(): void {
  instance = null;
}
