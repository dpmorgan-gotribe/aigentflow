# Step 16a: Lesson Extraction System

> **Checkpoint:** CP3 - Build & Test
> **Previous Step:** 16-REVIEWER-AGENT.md
> **Next Step:** 17-MERGE-WORKFLOW.md (CP4)

---

## Overview

The **Lesson Extraction System** captures, scores, and applies lessons learned from workflow execution. This enables the system to improve over time by learning from successes and failures.

Key responsibilities:
- Extract lessons from agent outputs and feedback
- Score lessons by relevance and quality
- Store lessons in a searchable database
- Apply relevant lessons to future prompts
- Track lesson effectiveness over time

---

## Deliverables

1. `src/learning/types.ts` - Learning system types
2. `src/learning/extractor.ts` - Lesson extraction
3. `src/learning/scorer.ts` - Lesson scoring
4. `src/learning/store.ts` - Lesson storage
5. `src/learning/applicator.ts` - Lesson application

---

## 1. Type Definitions (`src/learning/types.ts`)

```typescript
/**
 * Learning System Types
 */

import { z } from 'zod';
import { AgentType } from '../agents/types';

/**
 * Lesson categories
 */
export const LessonCategorySchema = z.enum([
  'best_practice',       // What worked well
  'anti_pattern',        // What to avoid
  'error_fix',           // How to fix specific errors
  'performance',         // Performance optimization
  'security',            // Security improvement
  'code_quality',        // Code quality insight
  'process',             // Process improvement
  'architecture',        // Architectural decision
  'testing',             // Testing insight
  'tooling',             // Tool-specific knowledge
]);

export type LessonCategory = z.infer<typeof LessonCategorySchema>;

/**
 * Lesson source
 */
export const LessonSourceSchema = z.enum([
  'agent_output',        // Extracted from agent response
  'user_feedback',       // Direct user feedback
  'review_comment',      // From code review
  'test_result',         // From test execution
  'error_resolution',    // From bug fixing
  'pattern_detection',   // Automatically detected pattern
]);

export type LessonSource = z.infer<typeof LessonSourceSchema>;

/**
 * Lesson status
 */
export const LessonStatusSchema = z.enum([
  'pending',             // Awaiting validation
  'validated',           // Confirmed useful
  'rejected',            // Determined not useful
  'deprecated',          // Superseded by newer lesson
]);

export type LessonStatus = z.infer<typeof LessonStatusSchema>;

/**
 * Lesson context
 */
export const LessonContextSchema = z.object({
  technology: z.string().optional(),
  framework: z.string().optional(),
  language: z.string().optional(),
  domain: z.string().optional(),
  projectType: z.string().optional(),
  agentType: z.nativeEnum(AgentType).optional(),
});

export type LessonContext = z.infer<typeof LessonContextSchema>;

/**
 * Lesson definition
 */
export const LessonSchema = z.object({
  // Identity
  id: z.string().uuid(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),

  // Classification
  category: LessonCategorySchema,
  source: LessonSourceSchema,
  status: LessonStatusSchema,

  // Content
  title: z.string().max(100),
  description: z.string().max(1000),
  example: z.string().optional(),
  counterExample: z.string().optional(),

  // Applicability
  context: LessonContextSchema,
  keywords: z.array(z.string()),
  applicableAgents: z.array(z.nativeEnum(AgentType)),

  // Scoring
  score: z.object({
    relevance: z.number().min(0).max(1),
    quality: z.number().min(0).max(1),
    applicability: z.number().min(0).max(1),
    overall: z.number().min(0).max(1),
  }),

  // Usage tracking
  usage: z.object({
    timesApplied: z.number().int().min(0),
    timesHelpful: z.number().int().min(0),
    timesIgnored: z.number().int().min(0),
    lastApplied: z.string().datetime().optional(),
  }),

  // Metadata
  metadata: z.object({
    projectId: z.string().optional(),
    sessionId: z.string().optional(),
    workflowId: z.string().optional(),
    originalAgentId: z.nativeEnum(AgentType).optional(),
  }),
});

export type Lesson = z.infer<typeof LessonSchema>;

/**
 * Lesson extraction result
 */
export interface ExtractionResult {
  lessons: Lesson[];
  confidence: number;
  extractedFrom: string;
}

/**
 * Lesson query options
 */
export interface LessonQueryOptions {
  categories?: LessonCategory[];
  context?: Partial<LessonContext>;
  minScore?: number;
  limit?: number;
  status?: LessonStatus[];
  keywords?: string[];
  applicableAgent?: AgentType;
}

/**
 * Lesson application result
 */
export interface ApplicationResult {
  applied: Lesson[];
  totalTokens: number;
  formatted: string;
}
```

---

## 2. Lesson Extractor (`src/learning/extractor.ts`)

```typescript
/**
 * Lesson Extractor
 *
 * Extracts lessons from various sources.
 */

import { randomUUID } from 'crypto';
import {
  Lesson,
  LessonSchema,
  LessonCategory,
  LessonSource,
  LessonContext,
  ExtractionResult,
} from './types';
import { AgentType } from '../agents/types';
import { LessonScorer } from './scorer';
import { logger } from '../utils/logger';

/**
 * Extraction patterns
 */
interface ExtractionPattern {
  category: LessonCategory;
  patterns: RegExp[];
  keywords: string[];
}

const EXTRACTION_PATTERNS: ExtractionPattern[] = [
  {
    category: 'best_practice',
    patterns: [
      /best practice[s]?:?\s*(.+)/gi,
      /should always\s+(.+)/gi,
      /recommend(?:ed)?:?\s*(.+)/gi,
      /prefer(?:red)?:?\s*(.+)/gi,
    ],
    keywords: ['best practice', 'recommended', 'should', 'prefer'],
  },
  {
    category: 'anti_pattern',
    patterns: [
      /avoid:?\s*(.+)/gi,
      /don't\s+(.+)/gi,
      /never\s+(.+)/gi,
      /anti-?pattern:?\s*(.+)/gi,
    ],
    keywords: ['avoid', 'don\'t', 'never', 'anti-pattern', 'bad practice'],
  },
  {
    category: 'error_fix',
    patterns: [
      /fix(?:ed)?:?\s*(.+)/gi,
      /resolved?:?\s*(.+)/gi,
      /solution:?\s*(.+)/gi,
      /the (?:issue|problem|error) was\s+(.+)/gi,
    ],
    keywords: ['fix', 'resolved', 'solution', 'error', 'issue'],
  },
  {
    category: 'performance',
    patterns: [
      /performance:?\s*(.+)/gi,
      /optimi[sz](?:ed|ation):?\s*(.+)/gi,
      /faster:?\s*(.+)/gi,
      /improve(?:d|ment)?:?\s*(.+)/gi,
    ],
    keywords: ['performance', 'optimization', 'faster', 'efficient'],
  },
  {
    category: 'security',
    patterns: [
      /security:?\s*(.+)/gi,
      /vulnerab(?:le|ility):?\s*(.+)/gi,
      /secur(?:e|ity):?\s*(.+)/gi,
    ],
    keywords: ['security', 'vulnerability', 'secure', 'CVE'],
  },
];

/**
 * Lesson Extractor implementation
 */
export class LessonExtractor {
  private scorer: LessonScorer;

  constructor(scorer: LessonScorer) {
    this.scorer = scorer;
  }

  /**
   * Extract lessons from agent output
   */
  async extractFromAgentOutput(
    agentId: AgentType,
    output: string,
    context: Partial<LessonContext> = {}
  ): Promise<ExtractionResult> {
    const lessons: Lesson[] = [];
    const now = new Date().toISOString();

    // Pattern-based extraction
    for (const pattern of EXTRACTION_PATTERNS) {
      for (const regex of pattern.patterns) {
        const matches = output.matchAll(regex);
        for (const match of matches) {
          if (match[1] && match[1].length > 10) {
            const lesson = await this.createLesson({
              category: pattern.category,
              source: 'agent_output',
              title: this.extractTitle(match[1]),
              description: match[1].trim(),
              context: { ...context, agentType: agentId },
              keywords: this.extractKeywords(match[1], pattern.keywords),
              applicableAgents: [agentId],
              originalAgentId: agentId,
            });
            lessons.push(lesson);
          }
        }
      }
    }

    // Extract from structured sections
    const structuredLessons = await this.extractStructuredLessons(output, agentId, context);
    lessons.push(...structuredLessons);

    return {
      lessons: this.deduplicateLessons(lessons),
      confidence: this.calculateConfidence(lessons),
      extractedFrom: 'agent_output',
    };
  }

  /**
   * Extract lessons from user feedback
   */
  async extractFromUserFeedback(
    feedback: string,
    rating: number,
    context: Partial<LessonContext> = {}
  ): Promise<ExtractionResult> {
    const lessons: Lesson[] = [];

    // Positive feedback
    if (rating >= 4) {
      const lesson = await this.createLesson({
        category: 'best_practice',
        source: 'user_feedback',
        title: 'User-approved approach',
        description: feedback,
        context,
        keywords: this.extractKeywords(feedback, []),
        applicableAgents: [],
      });
      lessons.push(lesson);
    }

    // Negative feedback
    if (rating <= 2) {
      const lesson = await this.createLesson({
        category: 'anti_pattern',
        source: 'user_feedback',
        title: 'User-rejected approach',
        description: `Avoid: ${feedback}`,
        context,
        keywords: this.extractKeywords(feedback, []),
        applicableAgents: [],
      });
      lessons.push(lesson);
    }

    return {
      lessons,
      confidence: rating >= 4 || rating <= 2 ? 0.8 : 0.5,
      extractedFrom: 'user_feedback',
    };
  }

  /**
   * Extract lessons from test results
   */
  async extractFromTestResult(
    testName: string,
    passed: boolean,
    error?: string,
    fix?: string,
    context: Partial<LessonContext> = {}
  ): Promise<ExtractionResult> {
    const lessons: Lesson[] = [];

    if (!passed && error && fix) {
      const lesson = await this.createLesson({
        category: 'error_fix',
        source: 'test_result',
        title: `Fix for: ${testName}`,
        description: `Error: ${error}\nFix: ${fix}`,
        example: fix,
        counterExample: error,
        context,
        keywords: this.extractKeywords(`${error} ${fix}`, ['error', 'fix']),
        applicableAgents: [AgentType.TESTER, AgentType.BUG_FIXER],
      });
      lessons.push(lesson);
    }

    return {
      lessons,
      confidence: fix ? 0.9 : 0.5,
      extractedFrom: 'test_result',
    };
  }

  /**
   * Extract lessons from code review
   */
  async extractFromReview(
    comments: Array<{ type: 'suggestion' | 'issue' | 'praise'; text: string }>,
    context: Partial<LessonContext> = {}
  ): Promise<ExtractionResult> {
    const lessons: Lesson[] = [];

    for (const comment of comments) {
      let category: LessonCategory;
      switch (comment.type) {
        case 'praise':
          category = 'best_practice';
          break;
        case 'issue':
          category = 'anti_pattern';
          break;
        case 'suggestion':
          category = 'code_quality';
          break;
      }

      const lesson = await this.createLesson({
        category,
        source: 'review_comment',
        title: this.extractTitle(comment.text),
        description: comment.text,
        context,
        keywords: this.extractKeywords(comment.text, []),
        applicableAgents: [AgentType.REVIEWER, AgentType.FRONTEND_DEVELOPER, AgentType.BACKEND_DEVELOPER],
      });
      lessons.push(lesson);
    }

    return {
      lessons,
      confidence: 0.85,
      extractedFrom: 'review_comment',
    };
  }

  /**
   * Create a lesson with scoring
   */
  private async createLesson(options: {
    category: LessonCategory;
    source: LessonSource;
    title: string;
    description: string;
    example?: string;
    counterExample?: string;
    context: Partial<LessonContext>;
    keywords: string[];
    applicableAgents: AgentType[];
    originalAgentId?: AgentType;
  }): Promise<Lesson> {
    const now = new Date().toISOString();

    const lesson: Lesson = {
      id: randomUUID(),
      createdAt: now,
      updatedAt: now,
      category: options.category,
      source: options.source,
      status: 'pending',
      title: options.title,
      description: options.description,
      example: options.example,
      counterExample: options.counterExample,
      context: options.context,
      keywords: options.keywords,
      applicableAgents: options.applicableAgents,
      score: {
        relevance: 0,
        quality: 0,
        applicability: 0,
        overall: 0,
      },
      usage: {
        timesApplied: 0,
        timesHelpful: 0,
        timesIgnored: 0,
      },
      metadata: {
        originalAgentId: options.originalAgentId,
      },
    };

    // Score the lesson
    lesson.score = await this.scorer.score(lesson);

    return LessonSchema.parse(lesson);
  }

  /**
   * Extract structured lessons from markdown sections
   */
  private async extractStructuredLessons(
    content: string,
    agentId: AgentType,
    context: Partial<LessonContext>
  ): Promise<Lesson[]> {
    const lessons: Lesson[] = [];

    // Look for "Lessons Learned" sections
    const lessonsSection = content.match(/## (?:Lessons? Learned|Key Takeaways?|Insights?)\n([\s\S]*?)(?=\n##|$)/i);
    if (lessonsSection) {
      const items = lessonsSection[1].match(/[-*]\s+(.+)/g);
      if (items) {
        for (const item of items) {
          const text = item.replace(/^[-*]\s+/, '').trim();
          if (text.length > 10) {
            const lesson = await this.createLesson({
              category: this.inferCategory(text),
              source: 'agent_output',
              title: this.extractTitle(text),
              description: text,
              context: { ...context, agentType: agentId },
              keywords: this.extractKeywords(text, []),
              applicableAgents: [agentId],
              originalAgentId: agentId,
            });
            lessons.push(lesson);
          }
        }
      }
    }

    return lessons;
  }

  /**
   * Infer category from text
   */
  private inferCategory(text: string): LessonCategory {
    const lower = text.toLowerCase();
    if (lower.includes('avoid') || lower.includes('don\'t') || lower.includes('never')) {
      return 'anti_pattern';
    }
    if (lower.includes('error') || lower.includes('fix') || lower.includes('bug')) {
      return 'error_fix';
    }
    if (lower.includes('performance') || lower.includes('fast') || lower.includes('slow')) {
      return 'performance';
    }
    if (lower.includes('security') || lower.includes('vulnerab')) {
      return 'security';
    }
    if (lower.includes('test') || lower.includes('coverage')) {
      return 'testing';
    }
    return 'best_practice';
  }

  /**
   * Extract title from text
   */
  private extractTitle(text: string): string {
    const firstSentence = text.split(/[.!?]/)[0];
    if (firstSentence.length <= 100) {
      return firstSentence.trim();
    }
    return firstSentence.substring(0, 97) + '...';
  }

  /**
   * Extract keywords from text
   */
  private extractKeywords(text: string, baseKeywords: string[]): string[] {
    const words = text.toLowerCase().match(/\b[a-z]{4,}\b/g) || [];
    const wordFreq = new Map<string, number>();

    for (const word of words) {
      if (!this.isStopWord(word)) {
        wordFreq.set(word, (wordFreq.get(word) || 0) + 1);
      }
    }

    const sorted = Array.from(wordFreq.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([word]) => word);

    return [...new Set([...baseKeywords, ...sorted])];
  }

  /**
   * Check if word is a stop word
   */
  private isStopWord(word: string): boolean {
    const stopWords = ['this', 'that', 'with', 'from', 'have', 'been', 'were', 'they', 'their', 'which', 'would', 'could', 'should', 'about', 'there', 'where', 'when', 'what', 'will', 'more', 'some', 'than', 'then', 'also', 'into', 'only', 'other', 'such', 'very', 'just', 'make', 'made', 'like', 'each', 'even', 'most', 'both', 'after', 'before', 'being', 'these', 'those', 'through', 'during', 'without', 'between', 'under', 'over'];
    return stopWords.includes(word);
  }

  /**
   * Remove duplicate lessons
   */
  private deduplicateLessons(lessons: Lesson[]): Lesson[] {
    const seen = new Map<string, Lesson>();

    for (const lesson of lessons) {
      const key = `${lesson.category}:${lesson.title.toLowerCase()}`;
      if (!seen.has(key) || lesson.score.overall > seen.get(key)!.score.overall) {
        seen.set(key, lesson);
      }
    }

    return Array.from(seen.values());
  }

  /**
   * Calculate extraction confidence
   */
  private calculateConfidence(lessons: Lesson[]): number {
    if (lessons.length === 0) return 0;
    const avgScore = lessons.reduce((sum, l) => sum + l.score.overall, 0) / lessons.length;
    return Math.min(avgScore + 0.1, 1);
  }
}
```

---

## 3. Lesson Scorer (`src/learning/scorer.ts`)

```typescript
/**
 * Lesson Scorer
 *
 * Scores lessons for relevance and quality.
 */

import { Lesson, LessonCategory } from './types';

/**
 * Scoring weights by category
 */
const CATEGORY_WEIGHTS: Record<LessonCategory, number> = {
  security: 1.0,
  error_fix: 0.9,
  anti_pattern: 0.85,
  best_practice: 0.8,
  performance: 0.75,
  code_quality: 0.7,
  testing: 0.7,
  architecture: 0.65,
  process: 0.6,
  tooling: 0.5,
};

/**
 * Lesson Scorer implementation
 */
export class LessonScorer {
  /**
   * Score a lesson
   */
  async score(lesson: Lesson): Promise<Lesson['score']> {
    const relevance = this.scoreRelevance(lesson);
    const quality = this.scoreQuality(lesson);
    const applicability = this.scoreApplicability(lesson);

    const categoryWeight = CATEGORY_WEIGHTS[lesson.category];
    const overall = (relevance * 0.3 + quality * 0.4 + applicability * 0.3) * categoryWeight;

    return {
      relevance: Math.round(relevance * 100) / 100,
      quality: Math.round(quality * 100) / 100,
      applicability: Math.round(applicability * 100) / 100,
      overall: Math.round(overall * 100) / 100,
    };
  }

  /**
   * Score relevance
   */
  private scoreRelevance(lesson: Lesson): number {
    let score = 0.5;

    // Keywords boost
    if (lesson.keywords.length >= 3) score += 0.1;
    if (lesson.keywords.length >= 5) score += 0.1;

    // Context completeness
    const contextFields = Object.values(lesson.context).filter(Boolean).length;
    score += contextFields * 0.05;

    // Applicable agents
    if (lesson.applicableAgents.length > 0) score += 0.1;
    if (lesson.applicableAgents.length > 2) score += 0.05;

    return Math.min(score, 1);
  }

  /**
   * Score quality
   */
  private scoreQuality(lesson: Lesson): number {
    let score = 0.5;

    // Title quality
    if (lesson.title.length >= 10 && lesson.title.length <= 80) score += 0.1;

    // Description quality
    if (lesson.description.length >= 50) score += 0.1;
    if (lesson.description.length >= 100) score += 0.1;

    // Has example
    if (lesson.example) score += 0.15;

    // Has counter-example
    if (lesson.counterExample) score += 0.1;

    // Source quality
    if (lesson.source === 'user_feedback') score += 0.1;
    if (lesson.source === 'review_comment') score += 0.1;

    return Math.min(score, 1);
  }

  /**
   * Score applicability
   */
  private scoreApplicability(lesson: Lesson): number {
    let score = 0.5;

    // Specificity vs generality balance
    const contextFields = Object.values(lesson.context).filter(Boolean).length;
    if (contextFields >= 1 && contextFields <= 3) score += 0.2;

    // Multiple applicable agents
    if (lesson.applicableAgents.length >= 2) score += 0.15;

    // Actionable description
    const actionWords = ['should', 'must', 'always', 'never', 'avoid', 'use', 'prefer'];
    const hasActionWord = actionWords.some(word =>
      lesson.description.toLowerCase().includes(word)
    );
    if (hasActionWord) score += 0.15;

    return Math.min(score, 1);
  }

  /**
   * Update score based on usage
   */
  async updateFromUsage(lesson: Lesson): Promise<Lesson['score']> {
    const usage = lesson.usage;
    let usageMultiplier = 1;

    if (usage.timesApplied > 0) {
      const helpfulRatio = usage.timesHelpful / usage.timesApplied;
      usageMultiplier = 0.5 + (helpfulRatio * 0.5);
    }

    return {
      relevance: lesson.score.relevance,
      quality: lesson.score.quality,
      applicability: lesson.score.applicability * usageMultiplier,
      overall: lesson.score.overall * usageMultiplier,
    };
  }
}
```

---

## 4. Lesson Store (`src/learning/store.ts`)

```typescript
/**
 * Lesson Store
 *
 * Persists and retrieves lessons.
 */

import { Lesson, LessonQueryOptions, LessonStatus } from './types';
import { Database } from '../persistence/database';
import { logger } from '../utils/logger';

/**
 * Lesson Store implementation
 */
export class LessonStore {
  private db: Database;

  constructor(db: Database) {
    this.db = db;
  }

  /**
   * Initialize store
   */
  async initialize(): Promise<void> {
    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS lessons (
        id TEXT PRIMARY KEY,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        category TEXT NOT NULL,
        source TEXT NOT NULL,
        status TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        example TEXT,
        counter_example TEXT,
        context TEXT NOT NULL,
        keywords TEXT NOT NULL,
        applicable_agents TEXT NOT NULL,
        score TEXT NOT NULL,
        usage TEXT NOT NULL,
        metadata TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_lessons_category ON lessons(category);
      CREATE INDEX IF NOT EXISTS idx_lessons_status ON lessons(status);
      CREATE INDEX IF NOT EXISTS idx_lessons_score ON lessons(json_extract(score, '$.overall'));
    `);
  }

  /**
   * Save lesson
   */
  async save(lesson: Lesson): Promise<void> {
    await this.db.run(`
      INSERT OR REPLACE INTO lessons (
        id, created_at, updated_at, category, source, status,
        title, description, example, counter_example,
        context, keywords, applicable_agents, score, usage, metadata
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      lesson.id,
      lesson.createdAt,
      lesson.updatedAt,
      lesson.category,
      lesson.source,
      lesson.status,
      lesson.title,
      lesson.description,
      lesson.example,
      lesson.counterExample,
      JSON.stringify(lesson.context),
      JSON.stringify(lesson.keywords),
      JSON.stringify(lesson.applicableAgents),
      JSON.stringify(lesson.score),
      JSON.stringify(lesson.usage),
      JSON.stringify(lesson.metadata),
    ]);
  }

  /**
   * Get lesson by ID
   */
  async get(id: string): Promise<Lesson | null> {
    const row = await this.db.get('SELECT * FROM lessons WHERE id = ?', [id]);
    return row ? this.rowToLesson(row) : null;
  }

  /**
   * Query lessons
   */
  async query(options: LessonQueryOptions): Promise<Lesson[]> {
    let sql = 'SELECT * FROM lessons WHERE 1=1';
    const params: unknown[] = [];

    if (options.categories?.length) {
      sql += ` AND category IN (${options.categories.map(() => '?').join(',')})`;
      params.push(...options.categories);
    }

    if (options.status?.length) {
      sql += ` AND status IN (${options.status.map(() => '?').join(',')})`;
      params.push(...options.status);
    }

    if (options.minScore !== undefined) {
      sql += ` AND json_extract(score, '$.overall') >= ?`;
      params.push(options.minScore);
    }

    if (options.applicableAgent) {
      sql += ` AND applicable_agents LIKE ?`;
      params.push(`%"${options.applicableAgent}"%`);
    }

    if (options.context) {
      for (const [key, value] of Object.entries(options.context)) {
        if (value) {
          sql += ` AND json_extract(context, '$.${key}') = ?`;
          params.push(value);
        }
      }
    }

    if (options.keywords?.length) {
      for (const keyword of options.keywords) {
        sql += ` AND keywords LIKE ?`;
        params.push(`%"${keyword}"%`);
      }
    }

    sql += ` ORDER BY json_extract(score, '$.overall') DESC`;

    if (options.limit) {
      sql += ` LIMIT ?`;
      params.push(options.limit);
    }

    const rows = await this.db.all(sql, params);
    return rows.map(row => this.rowToLesson(row));
  }

  /**
   * Update lesson status
   */
  async updateStatus(id: string, status: LessonStatus): Promise<void> {
    await this.db.run(
      'UPDATE lessons SET status = ?, updated_at = ? WHERE id = ?',
      [status, new Date().toISOString(), id]
    );
  }

  /**
   * Update lesson usage
   */
  async updateUsage(id: string, helpful: boolean): Promise<void> {
    const lesson = await this.get(id);
    if (!lesson) return;

    lesson.usage.timesApplied++;
    if (helpful) {
      lesson.usage.timesHelpful++;
    } else {
      lesson.usage.timesIgnored++;
    }
    lesson.usage.lastApplied = new Date().toISOString();
    lesson.updatedAt = new Date().toISOString();

    await this.save(lesson);
  }

  /**
   * Get top lessons for context
   */
  async getTopLessons(
    context: Partial<Lesson['context']>,
    limit: number = 10
  ): Promise<Lesson[]> {
    return this.query({
      context,
      status: ['validated'],
      minScore: 0.5,
      limit,
    });
  }

  /**
   * Convert database row to Lesson
   */
  private rowToLesson(row: Record<string, unknown>): Lesson {
    return {
      id: row.id as string,
      createdAt: row.created_at as string,
      updatedAt: row.updated_at as string,
      category: row.category as Lesson['category'],
      source: row.source as Lesson['source'],
      status: row.status as Lesson['status'],
      title: row.title as string,
      description: row.description as string,
      example: row.example as string | undefined,
      counterExample: row.counter_example as string | undefined,
      context: JSON.parse(row.context as string),
      keywords: JSON.parse(row.keywords as string),
      applicableAgents: JSON.parse(row.applicable_agents as string),
      score: JSON.parse(row.score as string),
      usage: JSON.parse(row.usage as string),
      metadata: JSON.parse(row.metadata as string),
    };
  }

  /**
   * Get statistics
   */
  async getStatistics(): Promise<{
    total: number;
    byCategory: Record<string, number>;
    byStatus: Record<string, number>;
    avgScore: number;
    mostApplied: Lesson[];
  }> {
    const total = await this.db.get('SELECT COUNT(*) as count FROM lessons');
    const byCategory = await this.db.all(
      'SELECT category, COUNT(*) as count FROM lessons GROUP BY category'
    );
    const byStatus = await this.db.all(
      'SELECT status, COUNT(*) as count FROM lessons GROUP BY status'
    );
    const avgScore = await this.db.get(
      'SELECT AVG(json_extract(score, \'$.overall\')) as avg FROM lessons'
    );
    const mostApplied = await this.query({
      status: ['validated'],
      limit: 5,
    });

    return {
      total: (total as { count: number }).count,
      byCategory: Object.fromEntries(
        (byCategory as Array<{ category: string; count: number }>).map(r => [r.category, r.count])
      ),
      byStatus: Object.fromEntries(
        (byStatus as Array<{ status: string; count: number }>).map(r => [r.status, r.count])
      ),
      avgScore: (avgScore as { avg: number }).avg || 0,
      mostApplied,
    };
  }
}
```

---

## 5. Lesson Applicator (`src/learning/applicator.ts`)

```typescript
/**
 * Lesson Applicator
 *
 * Applies relevant lessons to agent prompts.
 */

import { Lesson, LessonQueryOptions, ApplicationResult } from './types';
import { LessonStore } from './store';
import { AgentType } from '../agents/types';
import { logger } from '../utils/logger';

/**
 * Applicator configuration
 */
export interface ApplicatorConfig {
  maxLessons: number;
  maxTokens: number;
  minScore: number;
  includeExamples: boolean;
}

const DEFAULT_CONFIG: ApplicatorConfig = {
  maxLessons: 5,
  maxTokens: 1000,
  minScore: 0.6,
  includeExamples: true,
};

/**
 * Lesson Applicator implementation
 */
export class LessonApplicator {
  private store: LessonStore;
  private config: ApplicatorConfig;

  constructor(store: LessonStore, config: Partial<ApplicatorConfig> = {}) {
    this.store = store;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Get applicable lessons for an agent
   */
  async getApplicableLessons(
    agentType: AgentType,
    context: Partial<Lesson['context']> = {}
  ): Promise<ApplicationResult> {
    // Query relevant lessons
    const lessons = await this.store.query({
      applicableAgent: agentType,
      context,
      status: ['validated'],
      minScore: this.config.minScore,
      limit: this.config.maxLessons * 2, // Get extra for token budget
    });

    // Apply token budget
    const selected: Lesson[] = [];
    let totalTokens = 0;

    for (const lesson of lessons) {
      const tokenEstimate = this.estimateTokens(lesson);
      if (totalTokens + tokenEstimate <= this.config.maxTokens) {
        selected.push(lesson);
        totalTokens += tokenEstimate;

        if (selected.length >= this.config.maxLessons) break;
      }
    }

    // Format for prompt injection
    const formatted = this.formatLessons(selected);

    // Track usage
    for (const lesson of selected) {
      await this.store.updateUsage(lesson.id, true);
    }

    logger.debug('Lessons applied', {
      agentType,
      count: selected.length,
      tokens: totalTokens,
    });

    return {
      applied: selected,
      totalTokens,
      formatted,
    };
  }

  /**
   * Estimate token count for a lesson
   */
  private estimateTokens(lesson: Lesson): number {
    let text = lesson.title + lesson.description;
    if (this.config.includeExamples) {
      if (lesson.example) text += lesson.example;
      if (lesson.counterExample) text += lesson.counterExample;
    }
    // Rough estimate: ~4 characters per token
    return Math.ceil(text.length / 4);
  }

  /**
   * Format lessons for prompt injection
   */
  private formatLessons(lessons: Lesson[]): string {
    if (lessons.length === 0) return '';

    const lines: string[] = [];
    lines.push('<lessons-learned>');
    lines.push('Apply these lessons from previous experience:');
    lines.push('');

    for (const lesson of lessons) {
      lines.push(`### ${lesson.title}`);
      lines.push('');
      lines.push(lesson.description);

      if (this.config.includeExamples) {
        if (lesson.example) {
          lines.push('');
          lines.push('**Good example:**');
          lines.push('```');
          lines.push(lesson.example);
          lines.push('```');
        }

        if (lesson.counterExample) {
          lines.push('');
          lines.push('**Avoid this:**');
          lines.push('```');
          lines.push(lesson.counterExample);
          lines.push('```');
        }
      }

      lines.push('');
    }

    lines.push('</lessons-learned>');
    return lines.join('\n');
  }

  /**
   * Record feedback on lesson application
   */
  async recordFeedback(lessonId: string, helpful: boolean): Promise<void> {
    await this.store.updateUsage(lessonId, helpful);

    // If consistently unhelpful, consider deprecating
    const lesson = await this.store.get(lessonId);
    if (lesson && lesson.usage.timesApplied >= 5) {
      const helpfulRatio = lesson.usage.timesHelpful / lesson.usage.timesApplied;
      if (helpfulRatio < 0.3) {
        await this.store.updateStatus(lessonId, 'deprecated');
        logger.info('Lesson deprecated due to low helpfulness', { lessonId, helpfulRatio });
      }
    }
  }

  /**
   * Validate a pending lesson
   */
  async validateLesson(lessonId: string, valid: boolean): Promise<void> {
    await this.store.updateStatus(
      lessonId,
      valid ? 'validated' : 'rejected'
    );
  }
}
```

---

## Test Scenarios

```typescript
// tests/learning/extractor.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { LessonExtractor } from '../../src/learning/extractor';
import { LessonScorer } from '../../src/learning/scorer';
import { AgentType } from '../../src/agents/types';

describe('LessonExtractor', () => {
  let extractor: LessonExtractor;
  let scorer: LessonScorer;

  beforeEach(() => {
    scorer = new LessonScorer();
    extractor = new LessonExtractor(scorer);
  });

  it('should extract best practice lessons', async () => {
    const output = `
      Best practice: Always use parameterized queries to prevent SQL injection.
      Recommended: Use TypeScript strict mode for better type safety.
    `;

    const result = await extractor.extractFromAgentOutput(
      AgentType.BACKEND_DEVELOPER,
      output
    );

    expect(result.lessons.length).toBeGreaterThanOrEqual(2);
    expect(result.lessons.some(l => l.category === 'best_practice')).toBe(true);
  });

  it('should extract anti-pattern lessons', async () => {
    const output = `
      Avoid: Using any type in TypeScript as it defeats the purpose of type checking.
      Never store passwords in plain text.
    `;

    const result = await extractor.extractFromAgentOutput(
      AgentType.BACKEND_DEVELOPER,
      output
    );

    expect(result.lessons.some(l => l.category === 'anti_pattern')).toBe(true);
  });

  it('should extract lessons from user feedback', async () => {
    const result = await extractor.extractFromUserFeedback(
      'This approach worked great for our use case',
      5
    );

    expect(result.lessons.length).toBe(1);
    expect(result.lessons[0].category).toBe('best_practice');
  });

  it('should extract lessons from test results', async () => {
    const result = await extractor.extractFromTestResult(
      'UserAuth.test.ts',
      false,
      'TypeError: Cannot read property of undefined',
      'Added null check before accessing user property',
      { language: 'typescript' }
    );

    expect(result.lessons.length).toBe(1);
    expect(result.lessons[0].category).toBe('error_fix');
  });
});
```

---

## Validation Checklist

```
□ Lesson types defined
□ LessonExtractor extracts from agent output
□ LessonExtractor extracts from user feedback
□ LessonExtractor extracts from test results
□ LessonExtractor extracts from code reviews
□ LessonScorer calculates scores
□ LessonStore persists lessons
□ LessonStore queries work correctly
□ LessonApplicator selects relevant lessons
□ LessonApplicator respects token budget
□ Lesson formatting works
□ Usage tracking works
□ Lesson validation works
□ All tests pass
```

---

## Next Step

Proceed to **17-MERGE-WORKFLOW.md** in CP4 to implement the merge workflow.
