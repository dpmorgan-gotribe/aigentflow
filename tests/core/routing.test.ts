/**
 * Routing Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  analyzeTask,
  TaskRouter,
  getTaskRouter,
  resetTaskRouter,
  ROUTING_RULES,
} from '../../src/core/routing.js';
import { resetFeatureFlags, getFeatureFlags } from '../../src/core/feature-flags.js';
import type { RoutingContext, Task, TaskAnalysis } from '../../src/core/types.js';

describe('Task Analysis', () => {
  it('should detect feature task type', () => {
    const analysis = analyzeTask('Create a new login page with authentication');

    expect(analysis.taskType).toBe('feature');
    expect(analysis.requiredAgents).toContain('orchestrator');
    expect(analysis.requiredAgents).toContain('project-manager');
  });

  it('should detect bug-fix task type', () => {
    const analysis = analyzeTask('Fix the bug where users cannot login');

    expect(analysis.taskType).toBe('bug-fix');
    expect(analysis.requiredAgents).toContain('analyst');
  });

  it('should detect refactor task type', () => {
    const analysis = analyzeTask('Refactor the authentication module');

    expect(analysis.taskType).toBe('refactor');
    expect(analysis.requiredAgents).toContain('architect');
  });

  it('should detect research task type', () => {
    const analysis = analyzeTask('Research best practices for API design');

    expect(analysis.taskType).toBe('research');
    expect(analysis.requiredAgents).toContain('analyst');
  });

  it('should detect api-only task type', () => {
    const analysis = analyzeTask('Build a REST API endpoint for users');

    expect(analysis.taskType).toBe('api-only');
  });

  it('should detect ui-only task type', () => {
    const analysis = analyzeTask('Style the dashboard UI component with CSS');

    expect(analysis.taskType).toBe('ui-only');
  });

  it('should determine complexity based on prompt', () => {
    const lowComplexity = analyzeTask('Fix typo');
    expect(lowComplexity.complexity).toBe('low');

    const mediumComplexity = analyzeTask(
      'Add a new feature that allows users to upload files and also displays them in a gallery'
    );
    expect(mediumComplexity.complexity).toBe('medium');

    const highComplexity = analyzeTask(
      'Design and implement a new architecture for the entire application including database migration, ' +
        'API redesign, and frontend restructuring with proper testing and documentation'
    );
    expect(highComplexity.complexity).toBe('high');
  });

  it('should estimate steps based on task type and complexity', () => {
    const featureHigh = analyzeTask(
      'Build a complete user management system with authentication, authorization, and admin dashboard'
    );
    expect(featureHigh.estimatedSteps).toBeGreaterThan(8);

    const bugFixLow = analyzeTask('Fix typo in error message');
    expect(bugFixLow.estimatedSteps).toBeLessThan(5);
  });
});

describe('TaskRouter', () => {
  let router: TaskRouter;

  beforeEach(() => {
    resetTaskRouter();
    resetFeatureFlags();
    router = getTaskRouter();
  });

  function createContext(overrides: Partial<RoutingContext> = {}): RoutingContext {
    const task: Task = {
      id: 'task-1',
      projectId: 'project-1',
      prompt: 'Test task',
      state: 'ORCHESTRATING',
      status: 'running',
      context: {
        prompt: 'Test task',
        agentOutputs: new Map(),
        retryCount: 0,
        approvalsPending: [],
        lessonsApplied: [],
        metadata: {},
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const analysis: TaskAnalysis = {
      taskType: 'feature',
      complexity: 'medium',
      requiredAgents: ['orchestrator', 'project-manager'],
      optionalAgents: ['architect'],
      estimatedSteps: 5,
      confidence: 0.8,
    };

    return {
      task,
      analysis,
      previousAgents: [],
      availableAgents: ['orchestrator', 'project-manager', 'architect', 'analyst'],
      ...overrides,
    };
  }

  describe('Routing Rules', () => {
    it('should have built-in routing rules', () => {
      expect(ROUTING_RULES.length).toBeGreaterThan(0);
    });

    it('should have start-with-pm rule for features', () => {
      // Test that the rule exists and has correct structure
      const pmRule = ROUTING_RULES.find((r) => r.id === 'start-with-pm');
      expect(pmRule).toBeDefined();
      expect(pmRule?.name).toBe('Start with Project Manager');

      // The rule condition checks for feature task type with no previous agents
      const mockContext = {
        previousAgents: [],
        analysis: { taskType: 'feature' as const },
      } as RoutingContext;

      expect(pmRule?.condition(mockContext)).toBe(true);

      // The rule action returns project-manager
      const decision = pmRule?.action(mockContext);
      expect(decision?.nextAgent).toBe('project-manager');
    });

    it('should start with analyst for research', () => {
      const context = createContext({
        analysis: {
          taskType: 'research',
          complexity: 'low',
          requiredAgents: ['orchestrator', 'analyst'],
          optionalAgents: [],
          estimatedSteps: 3,
          confidence: 0.8,
        },
      });

      const decision = router.route(context);

      expect(decision.nextAgent).toBe('analyst');
    });

    it('should route PM to architect', () => {
      const context = createContext({
        previousAgents: ['project-manager'],
        analysis: {
          taskType: 'feature',
          complexity: 'medium',
          requiredAgents: ['orchestrator', 'project-manager', 'architect'],
          optionalAgents: [],
          estimatedSteps: 5,
          confidence: 0.8,
        },
      });

      const decision = router.route(context);

      expect(decision.nextAgent).toBe('architect');
    });

    it('should follow routing hints', () => {
      const context = createContext({
        previousAgents: ['analyst'],
        lastOutput: {
          agentType: 'analyst',
          success: true,
          output: {},
          duration: 1000,
          tokensUsed: 100,
          timestamp: new Date(),
          routingHint: {
            suggestedNext: 'architect',
            reasoning: 'Need architecture review',
            confidence: 0.9,
          },
        },
      });

      const decision = router.route(context);

      expect(decision.nextAgent).toBe('architect');
    });

    it('should fallback to orchestrator when no rule matches', () => {
      const context = createContext({
        previousAgents: ['analyst', 'architect', 'project-manager'],
        analysis: {
          taskType: 'unknown',
          complexity: 'low',
          requiredAgents: ['orchestrator'],
          optionalAgents: [],
          estimatedSteps: 2,
          confidence: 0.3,
        },
      });

      const decision = router.route(context);

      expect(decision.nextAgent).toBe('orchestrator');
    });
  });

  describe('Custom Rules', () => {
    it('should add custom rule', () => {
      const beforeCount = router.getRules().length;

      router.addRule({
        id: 'custom-rule',
        name: 'Custom Rule',
        priority: 1000,
        condition: () => true,
        action: () => ({
          nextAgent: 'analyst',
          reasoning: 'Custom rule',
          confidence: 1.0,
        }),
      });

      expect(router.getRules().length).toBe(beforeCount + 1);
    });

    it('should remove rule by ID', () => {
      router.addRule({
        id: 'temp-rule',
        name: 'Temp Rule',
        priority: 1,
        condition: () => false,
        action: () => ({
          nextAgent: 'analyst',
          reasoning: 'Temp',
          confidence: 0.5,
        }),
      });

      const removed = router.removeRule('temp-rule');
      expect(removed).toBe(true);
    });

    it('should return false when removing non-existent rule', () => {
      const removed = router.removeRule('non-existent');
      expect(removed).toBe(false);
    });
  });
});
