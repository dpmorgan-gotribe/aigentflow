/**
 * Lesson Repository
 *
 * Data access layer for learned lessons with FTS5 search.
 */

import { randomUUID } from 'crypto';
import type { AgentType } from '../../types.js';
import { getDatabase } from '../database.js';
import { logger } from '../../utils/logger.js';
import { NotFoundError } from '../../utils/errors.js';

const log = logger.child({ component: 'lesson-repository' });

// ============================================================================
// Types
// ============================================================================

export interface LessonRecord {
  id: string;
  content: string;
  category: string;
  agent: string;
  source: string;
  tags: string | null; // JSON array
  usage_count: number;
  created_at: string;
  updated_at: string;
}

export interface LessonSearchOptions {
  query?: string;
  category?: string;
  agent?: AgentType;
  limit?: number;
  offset?: number;
}

// ============================================================================
// Repository
// ============================================================================

/**
 * Lesson repository for database operations
 */
export class LessonRepository {
  /**
   * Create a new lesson
   */
  create(
    content: string,
    category: string,
    agent: AgentType,
    source: string,
    tags?: string[]
  ): LessonRecord {
    const db = getDatabase();
    const id = randomUUID();
    const now = new Date().toISOString();

    db.execute(
      `INSERT INTO lessons (id, content, category, agent, source, tags, usage_count, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?)`,
      [id, content, category, agent, source, tags ? JSON.stringify(tags) : null, now, now]
    );

    log.info('Lesson created', { id, category, agent });

    return {
      id,
      content,
      category,
      agent,
      source,
      tags: tags ? JSON.stringify(tags) : null,
      usage_count: 0,
      created_at: now,
      updated_at: now,
    };
  }

  /**
   * Get lesson by ID
   */
  getById(id: string): LessonRecord | undefined {
    const db = getDatabase();
    return db.queryOne<LessonRecord>('SELECT * FROM lessons WHERE id = ?', [id]);
  }

  /**
   * Search lessons using FTS5
   */
  search(options: LessonSearchOptions = {}): LessonRecord[] {
    const db = getDatabase();
    const { query, category, agent, limit = 10, offset = 0 } = options;

    const conditions: string[] = [];
    const params: unknown[] = [];

    if (query) {
      // Use FTS5 search
      conditions.push(
        `id IN (SELECT rowid FROM lessons_fts WHERE lessons_fts MATCH ?)`
      );
      params.push(query);
    }

    if (category) {
      conditions.push('category = ?');
      params.push(category);
    }

    if (agent) {
      conditions.push('agent = ?');
      params.push(agent);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    params.push(limit, offset);

    return db.query<LessonRecord>(
      `SELECT * FROM lessons ${whereClause} ORDER BY usage_count DESC, updated_at DESC LIMIT ? OFFSET ?`,
      params
    );
  }

  /**
   * Get all lessons
   */
  getAll(limit: number = 100): LessonRecord[] {
    const db = getDatabase();
    return db.query<LessonRecord>(
      'SELECT * FROM lessons ORDER BY usage_count DESC, updated_at DESC LIMIT ?',
      [limit]
    );
  }

  /**
   * Get lessons by category
   */
  getByCategory(category: string, limit: number = 10): LessonRecord[] {
    const db = getDatabase();
    return db.query<LessonRecord>(
      'SELECT * FROM lessons WHERE category = ? ORDER BY usage_count DESC LIMIT ?',
      [category, limit]
    );
  }

  /**
   * Get lessons by agent
   */
  getByAgent(agent: AgentType, limit: number = 10): LessonRecord[] {
    const db = getDatabase();
    return db.query<LessonRecord>(
      'SELECT * FROM lessons WHERE agent = ? ORDER BY usage_count DESC LIMIT ?',
      [agent, limit]
    );
  }

  /**
   * Increment usage count
   */
  incrementUsage(id: string): void {
    const db = getDatabase();
    const now = new Date().toISOString();

    const result = db.execute(
      'UPDATE lessons SET usage_count = usage_count + 1, updated_at = ? WHERE id = ?',
      [now, id]
    );

    if (result.changes === 0) {
      throw new NotFoundError('Lesson', id);
    }

    log.debug('Lesson usage incremented', { id });
  }

  /**
   * Update lesson content
   */
  update(id: string, updates: Partial<Pick<LessonRecord, 'content' | 'category' | 'tags'>>): void {
    const db = getDatabase();
    const now = new Date().toISOString();

    const existing = this.getById(id);
    if (!existing) {
      throw new NotFoundError('Lesson', id);
    }

    const newContent = updates.content ?? existing.content;
    const newCategory = updates.category ?? existing.category;
    const newTags = updates.tags !== undefined ? updates.tags : existing.tags;

    db.execute(
      'UPDATE lessons SET content = ?, category = ?, tags = ?, updated_at = ? WHERE id = ?',
      [newContent, newCategory, newTags, now, id]
    );

    log.debug('Lesson updated', { id });
  }

  /**
   * Delete a lesson
   */
  delete(id: string): void {
    const db = getDatabase();

    const result = db.execute('DELETE FROM lessons WHERE id = ?', [id]);

    if (result.changes === 0) {
      throw new NotFoundError('Lesson', id);
    }

    log.info('Lesson deleted', { id });
  }

  /**
   * Get lessons relevant to a task context
   */
  getRelevant(context: string, limit: number = 5): LessonRecord[] {
    // Extract keywords from context for FTS search
    const keywords = context
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 3)
      .slice(0, 10)
      .join(' OR ');

    if (!keywords) {
      return this.getAll(limit);
    }

    return this.search({ query: keywords, limit });
  }

  /**
   * Get lesson statistics
   */
  getStats(): Record<string, unknown> {
    const db = getDatabase();

    const totalLessons = db.queryOne<{ count: number }>(
      'SELECT COUNT(*) as count FROM lessons'
    );

    const byCategory = db.query<{ category: string; count: number }>(
      'SELECT category, COUNT(*) as count FROM lessons GROUP BY category ORDER BY count DESC'
    );

    const byAgent = db.query<{ agent: string; count: number }>(
      'SELECT agent, COUNT(*) as count FROM lessons GROUP BY agent ORDER BY count DESC'
    );

    const mostUsed = db.query<LessonRecord>(
      'SELECT * FROM lessons ORDER BY usage_count DESC LIMIT 5'
    );

    return {
      totalLessons: totalLessons?.count ?? 0,
      byCategory: Object.fromEntries(byCategory.map((r) => [r.category, r.count])),
      byAgent: Object.fromEntries(byAgent.map((r) => [r.agent, r.count])),
      mostUsed: mostUsed.map((l) => ({ id: l.id, content: l.content, usage: l.usage_count })),
    };
  }

  /**
   * Get categories
   */
  getCategories(): string[] {
    const db = getDatabase();
    const results = db.query<{ category: string }>(
      'SELECT DISTINCT category FROM lessons ORDER BY category'
    );
    return results.map((r) => r.category);
  }
}

// Singleton instance
let instance: LessonRepository | null = null;

/**
 * Get the lesson repository singleton
 */
export function getLessonRepository(): LessonRepository {
  if (!instance) {
    instance = new LessonRepository();
  }
  return instance;
}

/**
 * Reset the singleton (for testing)
 */
export function resetLessonRepository(): void {
  instance = null;
}
