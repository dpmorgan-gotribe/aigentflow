/**
 * Intelligent Routing
 *
 * Route tasks to appropriate agents using 85% rules + 15% AI.
 */

import type { AgentType } from '../types.js';
import type {
  TaskAnalysis,
  TaskType,
  RoutingDecision,
  RoutingRule,
  RoutingContext,
  Task,
  AgentOutput,
} from './types.js';
import { logger } from '../utils/logger.js';
import { isFeatureEnabled } from './feature-flags.js';

const log = logger.child({ component: 'routing' });

// ============================================================================
// Task Analysis
// ============================================================================

/**
 * Keywords for task type detection
 */
const TASK_KEYWORDS: Record<TaskType, string[]> = {
  feature: ['add', 'create', 'implement', 'build', 'new', 'feature', 'develop'],
  'bug-fix': ['fix', 'bug', 'issue', 'error', 'broken', 'not working', 'crash', 'problem'],
  refactor: ['refactor', 'clean', 'improve', 'optimize', 'restructure', 'reorganize'],
  documentation: ['document', 'docs', 'readme', 'comment', 'explain', 'describe'],
  research: ['research', 'investigate', 'analyze', 'compare', 'evaluate', 'assess'],
  'api-only': ['api', 'endpoint', 'backend', 'server', 'rest', 'graphql', 'database'],
  'ui-only': ['ui', 'frontend', 'component', 'page', 'screen', 'style', 'css', 'design'],
  'full-stack': ['full', 'stack', 'end-to-end', 'complete', 'entire'],
  unknown: [],
};

/**
 * Analyze a task to determine type and required agents
 */
export function analyzeTask(prompt: string): TaskAnalysis {
  const promptLower = prompt.toLowerCase();

  // Detect task type
  let taskType: TaskType = 'unknown';
  let maxMatches = 0;

  for (const [type, keywords] of Object.entries(TASK_KEYWORDS)) {
    const matches = keywords.filter((k) => promptLower.includes(k)).length;
    if (matches > maxMatches) {
      maxMatches = matches;
      taskType = type as TaskType;
    }
  }

  // Determine complexity based on prompt length and keywords
  const complexity = determineComplexity(prompt);

  // Determine required agents based on task type
  const { required, optional } = getAgentsForTaskType(taskType, complexity);

  // Estimate steps
  const estimatedSteps = estimateSteps(taskType, complexity);

  // Calculate confidence
  const confidence = maxMatches > 0 ? Math.min(0.9, 0.5 + maxMatches * 0.1) : 0.3;

  const analysis: TaskAnalysis = {
    taskType,
    complexity,
    requiredAgents: required,
    optionalAgents: optional,
    estimatedSteps,
    confidence,
  };

  log.debug('Task analyzed', { prompt: prompt.slice(0, 50), ...analysis });

  return analysis;
}

/**
 * Determine task complexity
 */
function determineComplexity(prompt: string): 'low' | 'medium' | 'high' {
  const length = prompt.length;
  const hasMultipleRequirements = /and|also|additionally|furthermore|moreover/i.test(prompt);
  const hasComplexKeywords = /architecture|system|integration|migration|refactor/i.test(prompt);

  if (length > 500 || hasComplexKeywords) {
    return 'high';
  }

  if (length > 200 || hasMultipleRequirements) {
    return 'medium';
  }

  return 'low';
}

/**
 * Get required and optional agents for a task type
 */
function getAgentsForTaskType(
  taskType: TaskType,
  complexity: 'low' | 'medium' | 'high'
): { required: AgentType[]; optional: AgentType[] } {
  // Base agents always needed (if enabled)
  const base: AgentType[] = ['orchestrator'];

  switch (taskType) {
    case 'feature':
      return {
        required: [...base, 'project-manager', 'architect'],
        optional: ['analyst', 'ui-designer', 'frontend-developer', 'backend-developer', 'tester', 'reviewer'],
      };

    case 'bug-fix':
      return {
        required: [...base, 'analyst'],
        optional: ['bug-fixer', 'tester'],
      };

    case 'refactor':
      return {
        required: [...base, 'architect'],
        optional: ['frontend-developer', 'backend-developer', 'reviewer'],
      };

    case 'documentation':
      return {
        required: [...base, 'analyst'],
        optional: [],
      };

    case 'research':
      return {
        required: [...base, 'analyst'],
        optional: ['architect'],
      };

    case 'api-only':
      return {
        required: [...base, 'project-manager', 'architect'],
        optional: ['backend-developer', 'tester', 'reviewer'],
      };

    case 'ui-only':
      return {
        required: [...base, 'project-manager'],
        optional: ['ui-designer', 'frontend-developer', 'tester', 'reviewer'],
      };

    case 'full-stack':
      return {
        required: [...base, 'project-manager', 'architect'],
        optional: [
          'analyst',
          'ui-designer',
          'frontend-developer',
          'backend-developer',
          'tester',
          'reviewer',
        ],
      };

    default:
      return {
        required: [...base, 'analyst'],
        optional: ['project-manager', 'architect'],
      };
  }
}

/**
 * Estimate number of steps
 */
function estimateSteps(taskType: TaskType, complexity: 'low' | 'medium' | 'high'): number {
  const baseSteps: Record<TaskType, number> = {
    feature: 8,
    'bug-fix': 4,
    refactor: 5,
    documentation: 2,
    research: 3,
    'api-only': 6,
    'ui-only': 6,
    'full-stack': 10,
    unknown: 5,
  };

  const complexityMultiplier: Record<string, number> = {
    low: 0.8,
    medium: 1.0,
    high: 1.5,
  };

  return Math.round((baseSteps[taskType] ?? 5) * complexityMultiplier[complexity]);
}

// ============================================================================
// Routing Rules
// ============================================================================

/**
 * Built-in routing rules (85% rule-based)
 */
export const ROUTING_RULES: RoutingRule[] = [
  // Initial routing: Start with project manager for features
  {
    id: 'start-with-pm',
    name: 'Start with Project Manager',
    priority: 100,
    condition: (ctx) =>
      ctx.previousAgents.length === 0 &&
      ['feature', 'full-stack', 'api-only', 'ui-only'].includes(ctx.analysis.taskType),
    action: () => ({
      nextAgent: 'project-manager',
      reasoning: 'Starting with project breakdown for new feature',
      confidence: 0.95,
    }),
  },

  // Initial routing: Start with analyst for research
  {
    id: 'start-with-analyst',
    name: 'Start with Analyst',
    priority: 99,
    condition: (ctx) =>
      ctx.previousAgents.length === 0 &&
      ['research', 'documentation', 'bug-fix', 'unknown'].includes(ctx.analysis.taskType),
    action: () => ({
      nextAgent: 'analyst',
      reasoning: 'Starting with analysis/research',
      confidence: 0.9,
    }),
  },

  // After PM: Go to architect for tech decisions
  {
    id: 'pm-to-architect',
    name: 'PM to Architect',
    priority: 90,
    condition: (ctx) =>
      ctx.previousAgents[ctx.previousAgents.length - 1] === 'project-manager' &&
      ctx.analysis.complexity !== 'low',
    action: () => ({
      nextAgent: 'architect',
      reasoning: 'Getting architecture decisions after project breakdown',
      confidence: 0.9,
    }),
  },

  // After architect: Go to designer for UI tasks
  {
    id: 'architect-to-designer',
    name: 'Architect to Designer',
    priority: 85,
    condition: (ctx) =>
      ctx.previousAgents[ctx.previousAgents.length - 1] === 'architect' &&
      ['feature', 'ui-only', 'full-stack'].includes(ctx.analysis.taskType) &&
      isFeatureEnabled('agents.uiDesigner'),
    action: () => ({
      nextAgent: 'ui-designer',
      reasoning: 'Creating UI designs after architecture',
      confidence: 0.85,
    }),
  },

  // After designer: Go to frontend
  {
    id: 'designer-to-frontend',
    name: 'Designer to Frontend',
    priority: 80,
    condition: (ctx) =>
      ctx.previousAgents[ctx.previousAgents.length - 1] === 'ui-designer' &&
      isFeatureEnabled('agents.frontendDev'),
    action: () => ({
      nextAgent: 'frontend-developer',
      reasoning: 'Building frontend after design approval',
      confidence: 0.9,
    }),
  },

  // After frontend: Go to backend or tester
  {
    id: 'frontend-to-backend',
    name: 'Frontend to Backend',
    priority: 75,
    condition: (ctx) =>
      ctx.previousAgents[ctx.previousAgents.length - 1] === 'frontend-developer' &&
      ['feature', 'full-stack', 'api-only'].includes(ctx.analysis.taskType) &&
      isFeatureEnabled('agents.backendDev'),
    action: () => ({
      nextAgent: 'backend-developer',
      reasoning: 'Building backend after frontend',
      confidence: 0.85,
    }),
  },

  // After build: Go to tester
  {
    id: 'build-to-test',
    name: 'Build to Test',
    priority: 70,
    condition: (ctx) => {
      const lastAgent = ctx.previousAgents[ctx.previousAgents.length - 1];
      return (
        (lastAgent === 'frontend-developer' || lastAgent === 'backend-developer') &&
        isFeatureEnabled('agents.tester')
      );
    },
    action: () => ({
      nextAgent: 'tester',
      reasoning: 'Running tests after build',
      confidence: 0.9,
    }),
  },

  // Test failure: Go to bug fixer
  {
    id: 'test-fail-to-fixer',
    name: 'Test Fail to Bug Fixer',
    priority: 95,
    condition: (ctx) =>
      ctx.previousAgents[ctx.previousAgents.length - 1] === 'tester' &&
      ctx.lastOutput?.success === false &&
      isFeatureEnabled('agents.bugFixer'),
    action: () => ({
      nextAgent: 'bug-fixer',
      reasoning: 'Fixing test failures',
      confidence: 0.95,
    }),
  },

  // After test pass: Go to reviewer
  {
    id: 'test-to-review',
    name: 'Test to Review',
    priority: 65,
    condition: (ctx) =>
      ctx.previousAgents[ctx.previousAgents.length - 1] === 'tester' &&
      ctx.lastOutput?.success === true &&
      isFeatureEnabled('agents.reviewer'),
    action: () => ({
      nextAgent: 'reviewer',
      reasoning: 'Code review after tests pass',
      confidence: 0.9,
    }),
  },

  // Use routing hint from previous agent
  {
    id: 'follow-hint',
    name: 'Follow Agent Hint',
    priority: 200, // High priority
    condition: (ctx) =>
      ctx.lastOutput?.routingHint?.suggestedNext !== undefined &&
      ctx.availableAgents.includes(ctx.lastOutput.routingHint.suggestedNext),
    action: (ctx) => ({
      nextAgent: ctx.lastOutput!.routingHint!.suggestedNext!,
      reasoning: ctx.lastOutput!.routingHint!.reasoning ?? 'Following agent suggestion',
      confidence: ctx.lastOutput!.routingHint!.confidence ?? 0.8,
    }),
  },
];

// ============================================================================
// Router
// ============================================================================

/**
 * Task router
 */
export class TaskRouter {
  private rules: RoutingRule[];

  constructor(customRules: RoutingRule[] = []) {
    // Combine custom rules with built-in rules, sorted by priority
    this.rules = [...customRules, ...ROUTING_RULES].sort((a, b) => b.priority - a.priority);
  }

  /**
   * Get the next agent for a task
   */
  route(context: RoutingContext): RoutingDecision {
    // Filter available agents based on feature flags
    const availableAgents = context.availableAgents.filter((agent) => {
      const flagKey = `agents.${agent.replace(/-/g, '')}`;
      return isFeatureEnabled(flagKey);
    });

    const filteredContext = { ...context, availableAgents };

    // Try each rule in priority order
    for (const rule of this.rules) {
      if (rule.condition(filteredContext)) {
        const decision = rule.action(filteredContext);

        // Verify agent is available
        if (availableAgents.includes(decision.nextAgent)) {
          log.info('Routing decision', {
            rule: rule.name,
            nextAgent: decision.nextAgent,
            confidence: decision.confidence,
          });
          return decision;
        }
      }
    }

    // Fallback: return to orchestrator or complete
    if (context.previousAgents.length > 0) {
      return {
        nextAgent: 'orchestrator',
        reasoning: 'No matching rule, returning to orchestrator',
        confidence: 0.5,
      };
    }

    // Default start with analyst
    return {
      nextAgent: 'analyst',
      reasoning: 'Default start with analyst',
      confidence: 0.5,
    };
  }

  /**
   * Add a custom rule
   */
  addRule(rule: RoutingRule): void {
    this.rules.push(rule);
    this.rules.sort((a, b) => b.priority - a.priority);
  }

  /**
   * Remove a rule by ID
   */
  removeRule(ruleId: string): boolean {
    const index = this.rules.findIndex((r) => r.id === ruleId);
    if (index !== -1) {
      this.rules.splice(index, 1);
      return true;
    }
    return false;
  }

  /**
   * Get all rules
   */
  getRules(): RoutingRule[] {
    return [...this.rules];
  }
}

// Singleton instance
let instance: TaskRouter | null = null;

/**
 * Get the task router singleton
 */
export function getTaskRouter(): TaskRouter {
  if (!instance) {
    instance = new TaskRouter();
  }
  return instance;
}

/**
 * Reset the singleton (for testing)
 */
export function resetTaskRouter(): void {
  instance = null;
}
