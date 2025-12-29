/**
 * Context Manager
 *
 * Manages and curates context for agent execution.
 */

import type { AgentType, ExecutionContext, AgentResult, ProjectConfig } from '../types.js';
import { logger } from '../utils/logger.js';

const log = logger.child({ component: 'context-manager' });

/**
 * Context relevance score
 */
interface RelevanceScore {
  item: string;
  score: number;
  category: string;
}

/**
 * Context budget allocation
 */
interface ContextBudget {
  maxTokens: number;
  allocated: {
    systemPrompt: number;
    projectContext: number;
    previousOutputs: number;
    lessons: number;
    sourceCode: number;
    userPrompt: number;
  };
}

/**
 * Default context budget (for 8192 token limit)
 */
const DEFAULT_BUDGET: ContextBudget = {
  maxTokens: 8192,
  allocated: {
    systemPrompt: 1500,
    projectContext: 1000,
    previousOutputs: 2000,
    lessons: 500,
    sourceCode: 2500,
    userPrompt: 692,
  },
};

/**
 * Context manager for curating and optimizing agent context
 */
export class ContextManager {
  private budget: ContextBudget;

  constructor(budget: Partial<ContextBudget> = {}) {
    this.budget = {
      ...DEFAULT_BUDGET,
      ...budget,
      allocated: { ...DEFAULT_BUDGET.allocated, ...budget.allocated },
    };
  }

  /**
   * Create an optimized execution context for an agent
   */
  createContext(
    taskId: string,
    agentType: AgentType,
    projectConfig: ProjectConfig,
    currentState: string,
    previousOutputs: Map<AgentType, AgentResult> = new Map(),
    lessonsLearned: string[] = [],
    sourceCode: Map<string, string> = new Map()
  ): ExecutionContext {
    log.debug('Creating execution context', { taskId, agentType, currentState });

    // Curate previous outputs based on relevance
    const relevantOutputs = this.curateOutputs(agentType, previousOutputs);

    // Prioritize lessons
    const prioritizedLessons = this.prioritizeLessons(agentType, lessonsLearned);

    // Select relevant source code
    const relevantCode = this.selectSourceCode(agentType, sourceCode);

    const context: ExecutionContext = {
      taskId,
      projectConfig,
      currentState: currentState as ExecutionContext['currentState'],
      previousOutputs: relevantOutputs,
      lessonsLearned: prioritizedLessons,
      sourceCode: relevantCode,
    };

    log.debug('Context created', {
      taskId,
      outputCount: relevantOutputs.size,
      lessonCount: prioritizedLessons.length,
      codeFiles: relevantCode.size,
    });

    return context;
  }

  /**
   * Curate previous outputs based on relevance to current agent
   */
  private curateOutputs(
    agentType: AgentType,
    outputs: Map<AgentType, AgentResult>
  ): Map<AgentType, AgentResult> {
    const relevanceMap = this.getOutputRelevance(agentType);
    const curated = new Map<AgentType, AgentResult>();
    const budget = this.budget.allocated.previousOutputs;
    let usedTokens = 0;

    // Sort outputs by relevance
    const sortedOutputs = Array.from(outputs.entries()).sort((a, b) => {
      const scoreA = relevanceMap.get(a[0]) ?? 0;
      const scoreB = relevanceMap.get(b[0]) ?? 0;
      return scoreB - scoreA;
    });

    for (const [type, result] of sortedOutputs) {
      const estimatedTokens = this.estimateTokens(JSON.stringify(result.output));

      if (usedTokens + estimatedTokens <= budget) {
        curated.set(type, result);
        usedTokens += estimatedTokens;
      } else {
        // Truncate output if partially fits
        const remainingBudget = budget - usedTokens;
        if (remainingBudget > 100) {
          const truncated = this.truncateOutput(result, remainingBudget);
          curated.set(type, truncated);
        }
        break;
      }
    }

    return curated;
  }

  /**
   * Get relevance scores for different agent outputs relative to current agent
   */
  private getOutputRelevance(agentType: AgentType): Map<AgentType, number> {
    const relevance = new Map<AgentType, number>();

    // Define relevance based on common workflows
    const relevanceRules: Record<AgentType, Record<AgentType, number>> = {
      orchestrator: {
        analyst: 0.9,
        'project-manager': 0.9,
        architect: 0.8,
        tester: 0.7,
        reviewer: 0.7,
      },
      'project-manager': {
        analyst: 0.9,
        orchestrator: 0.7,
      },
      architect: {
        'project-manager': 0.9,
        analyst: 0.8,
        orchestrator: 0.7,
      },
      analyst: {
        orchestrator: 0.6,
      },
      'ui-designer': {
        analyst: 0.8,
        architect: 0.7,
      },
      'frontend-developer': {
        'ui-designer': 0.9,
        architect: 0.8,
        'backend-developer': 0.6,
      },
      'backend-developer': {
        architect: 0.9,
        analyst: 0.6,
      },
      tester: {
        'frontend-developer': 0.9,
        'backend-developer': 0.9,
        architect: 0.6,
      },
      'bug-fixer': {
        tester: 0.9,
        'frontend-developer': 0.8,
        'backend-developer': 0.8,
      },
      reviewer: {
        'frontend-developer': 0.9,
        'backend-developer': 0.9,
        architect: 0.7,
      },
      'git-agent': {
        reviewer: 0.8,
      },
      'merge-resolver': {
        'git-agent': 0.9,
        reviewer: 0.7,
      },
      'project-analyzer': {
        architect: 0.8,
      },
      'compliance-agent': {
        architect: 0.7,
        reviewer: 0.8,
      },
    };

    const rules = relevanceRules[agentType] ?? {};
    for (const [type, score] of Object.entries(rules)) {
      relevance.set(type as AgentType, score);
    }

    return relevance;
  }

  /**
   * Prioritize lessons based on relevance to agent
   */
  private prioritizeLessons(agentType: AgentType, lessons: string[]): string[] {
    if (lessons.length === 0) return [];

    const budget = this.budget.allocated.lessons;
    const prioritized: string[] = [];
    let usedTokens = 0;

    // Score each lesson for relevance
    const scored: RelevanceScore[] = lessons.map((lesson) => ({
      item: lesson,
      score: this.scoreLessonRelevance(lesson, agentType),
      category: this.categorizeLesson(lesson),
    }));

    // Sort by score
    scored.sort((a, b) => b.score - a.score);

    for (const { item } of scored) {
      const tokens = this.estimateTokens(item);
      if (usedTokens + tokens <= budget) {
        prioritized.push(item);
        usedTokens += tokens;
      } else {
        break;
      }
    }

    return prioritized;
  }

  /**
   * Score lesson relevance for an agent
   */
  private scoreLessonRelevance(lesson: string, agentType: AgentType): number {
    const lowerLesson = lesson.toLowerCase();
    let score = 0.5; // Base score

    // Agent-specific keywords
    const agentKeywords: Record<AgentType, string[]> = {
      orchestrator: ['routing', 'workflow', 'coordination', 'task'],
      'project-manager': ['planning', 'wbs', 'dependency', 'timeline', 'scope'],
      architect: ['architecture', 'design', 'pattern', 'adr', 'structure'],
      analyst: ['research', 'analysis', 'best practice', 'recommendation'],
      'ui-designer': ['ui', 'ux', 'design', 'visual', 'accessibility'],
      'frontend-developer': ['frontend', 'react', 'component', 'css', 'javascript'],
      'backend-developer': ['backend', 'api', 'database', 'server', 'endpoint'],
      tester: ['test', 'coverage', 'assertion', 'mock', 'unit'],
      'bug-fixer': ['bug', 'fix', 'debug', 'error', 'issue'],
      reviewer: ['review', 'code quality', 'refactor', 'improvement'],
      'git-agent': ['git', 'commit', 'branch', 'merge', 'conflict'],
      'merge-resolver': ['merge', 'conflict', 'resolution', 'diff'],
      'project-analyzer': ['analyze', 'structure', 'dependency', 'codebase'],
      'compliance-agent': ['security', 'compliance', 'audit', 'vulnerability'],
    };

    const keywords = agentKeywords[agentType] ?? [];
    for (const keyword of keywords) {
      if (lowerLesson.includes(keyword)) {
        score += 0.2;
      }
    }

    // Cap at 1.0
    return Math.min(score, 1.0);
  }

  /**
   * Categorize a lesson
   */
  private categorizeLesson(lesson: string): string {
    const lowerLesson = lesson.toLowerCase();
    if (lowerLesson.includes('security')) return 'security';
    if (lowerLesson.includes('performance')) return 'performance';
    if (lowerLesson.includes('architecture')) return 'architecture';
    if (lowerLesson.includes('test')) return 'testing';
    if (lowerLesson.includes('ui') || lowerLesson.includes('ux')) return 'design';
    return 'general';
  }

  /**
   * Select relevant source code files
   */
  private selectSourceCode(
    agentType: AgentType,
    sourceCode: Map<string, string>
  ): Map<string, string> {
    if (sourceCode.size === 0) return new Map();

    const budget = this.budget.allocated.sourceCode;
    const selected = new Map<string, string>();
    let usedTokens = 0;

    // Score files for relevance
    const scored = Array.from(sourceCode.entries()).map(([path, content]) => ({
      path,
      content,
      score: this.scoreFileRelevance(path, agentType),
    }));

    // Sort by score
    scored.sort((a, b) => b.score - a.score);

    for (const { path, content } of scored) {
      const tokens = this.estimateTokens(content);
      if (usedTokens + tokens <= budget) {
        selected.set(path, content);
        usedTokens += tokens;
      } else {
        // Try to include a truncated version
        const remainingBudget = budget - usedTokens;
        if (remainingBudget > 200) {
          const truncated = this.truncateCode(content, remainingBudget);
          selected.set(path, truncated);
        }
        break;
      }
    }

    return selected;
  }

  /**
   * Score file relevance for an agent
   */
  private scoreFileRelevance(path: string, agentType: AgentType): number {
    const lowerPath = path.toLowerCase();
    let score = 0.5;

    // File type relevance
    const agentFilePatterns: Record<AgentType, RegExp[]> = {
      'frontend-developer': [/\.(tsx?|jsx?)$/, /\.(css|scss|less)$/, /\.html$/],
      'backend-developer': [/\.(ts|js)$/, /\.json$/, /\.(sql|prisma)$/],
      'ui-designer': [/\.(css|scss|less)$/, /\.svg$/, /theme/i],
      tester: [/\.(test|spec)\.(ts|js)x?$/, /__tests__/],
      architect: [/config/, /\.json$/, /package\.json$/],
      'compliance-agent': [/security/, /auth/, /\.env/],
      orchestrator: [],
      'project-manager': [],
      analyst: [],
      'bug-fixer': [],
      reviewer: [],
      'git-agent': [],
      'merge-resolver': [],
      'project-analyzer': [],
    };

    const patterns = agentFilePatterns[agentType] ?? [];
    for (const pattern of patterns) {
      if (pattern.test(lowerPath)) {
        score += 0.3;
      }
    }

    // Recently modified files are more relevant
    // (In real implementation, would check git status)

    return Math.min(score, 1.0);
  }

  /**
   * Estimate token count for text
   */
  private estimateTokens(text: string): number {
    // Rough estimate: ~4 characters per token
    return Math.ceil(text.length / 4);
  }

  /**
   * Truncate output to fit budget
   */
  private truncateOutput(result: AgentResult, maxTokens: number): AgentResult {
    const outputStr = JSON.stringify(result.output);
    const maxChars = maxTokens * 4;

    if (outputStr.length <= maxChars) {
      return result;
    }

    return {
      ...result,
      output: {
        truncated: true,
        summary: outputStr.substring(0, maxChars - 50) + '... [TRUNCATED]',
      },
    };
  }

  /**
   * Truncate code to fit budget
   */
  private truncateCode(code: string, maxTokens: number): string {
    const maxChars = maxTokens * 4;
    if (code.length <= maxChars) {
      return code;
    }

    const lines = code.split('\n');
    const truncatedLines: string[] = [];
    let charCount = 0;

    for (const line of lines) {
      if (charCount + line.length + 1 > maxChars - 30) {
        truncatedLines.push('// ... [TRUNCATED]');
        break;
      }
      truncatedLines.push(line);
      charCount += line.length + 1;
    }

    return truncatedLines.join('\n');
  }

  /**
   * Get current budget allocation
   */
  getBudget(): ContextBudget {
    return { ...this.budget };
  }

  /**
   * Update budget allocation
   */
  updateBudget(updates: Partial<ContextBudget['allocated']>): void {
    this.budget.allocated = { ...this.budget.allocated, ...updates };
  }
}

// Singleton instance
let instance: ContextManager | null = null;

/**
 * Get the context manager singleton
 */
export function getContextManager(): ContextManager {
  if (!instance) {
    instance = new ContextManager();
  }
  return instance;
}

/**
 * Reset the singleton (for testing)
 */
export function resetContextManager(): void {
  instance = null;
}
