/**
 * Prompt Builder Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  PromptBuilder,
  getPromptBuilder,
  resetPromptBuilder,
} from '../../src/prompts/prompt-builder.js';
import {
  ORCHESTRATOR_TEMPLATE,
  PROJECT_MANAGER_TEMPLATE,
  getAgentTemplate,
} from '../../src/prompts/templates/base.js';
import type { ExecutionContext, AgentResult } from '../../src/types.js';

describe('PromptBuilder', () => {
  let builder: PromptBuilder;

  beforeEach(() => {
    resetPromptBuilder();
    builder = new PromptBuilder();
  });

  const createContext = (): ExecutionContext => ({
    taskId: 'task-1',
    projectConfig: {
      name: 'test-project',
      version: '1.0.0',
      path: '/test',
      features: { gitWorktrees: false, parallelAgents: true, selfEvolution: false },
      compliance: { frameworks: [], strictMode: false },
      techStack: { frontend: ['React'], backend: ['Node.js'] },
      hooks: [],
      agents: {},
    },
    currentState: 'ANALYZING',
    previousOutputs: new Map(),
    lessonsLearned: [],
  });

  describe('Layer Building', () => {
    it('should add system constraints layer', () => {
      builder.withSystemConstraints();
      expect(builder.getLayerCount()).toBe(1);
    });

    it('should add agent role layer', () => {
      builder.withAgentRole(ORCHESTRATOR_TEMPLATE);
      expect(builder.getLayerCount()).toBeGreaterThanOrEqual(2);
    });

    it('should add task specification layer', () => {
      builder.withTaskSpec('task-1', 'Build a login page');
      expect(builder.getLayerCount()).toBe(1);
    });

    it('should add project context layer', () => {
      const context = createContext();
      builder.withProjectContext(context);
      expect(builder.getLayerCount()).toBeGreaterThanOrEqual(1);
    });

    it('should add previous outputs layer', () => {
      const outputs = new Map<'analyst', AgentResult>([
        [
          'analyst',
          {
            success: true,
            output: { findings: ['Use TypeScript'] },
            metrics: { duration: 100, tokensUsed: 50, retries: 0 },
          },
        ],
      ]);
      builder.withPreviousOutputs(outputs);
      expect(builder.getLayerCount()).toBe(1);
    });

    it('should skip empty previous outputs', () => {
      builder.withPreviousOutputs(new Map());
      expect(builder.getLayerCount()).toBe(0);
    });

    it('should add lessons layer', () => {
      builder.withLessons(['Always use TypeScript', 'Write tests first']);
      expect(builder.getLayerCount()).toBe(1);
    });

    it('should skip empty lessons', () => {
      builder.withLessons([]);
      expect(builder.getLayerCount()).toBe(0);
    });

    it('should add source code layer', () => {
      const code = new Map([['src/index.ts', 'export const x = 1;']]);
      builder.withSourceCode(code);
      expect(builder.getLayerCount()).toBe(1);
    });

    it('should add output format layer', () => {
      builder.withOutputFormat('{ "result": "<value>" }');
      expect(builder.getLayerCount()).toBe(1);
    });

    it('should add success criteria layer', () => {
      builder.withSuccessCriteria(['Output is valid JSON', 'Contains required fields']);
      expect(builder.getLayerCount()).toBe(1);
    });
  });

  describe('Build', () => {
    it('should build a complete prompt', () => {
      const prompt = builder
        .withSystemConstraints()
        .withAgentRole(ORCHESTRATOR_TEMPLATE)
        .withTaskSpec('task-1', 'Analyze the codebase')
        .withOutputFormat('{ "analysis": "<result>" }')
        .build();

      expect(prompt).toContain('CONSTRAINTS');
      expect(prompt).toContain('ROLE');
      expect(prompt).toContain('TASK');
      expect(prompt).toContain('OUTPUT FORMAT');
    });

    it('should chain methods fluently', () => {
      const prompt = builder
        .reset()
        .forAgent('orchestrator')
        .withSystemConstraints()
        .build();

      expect(prompt).toBeDefined();
      expect(prompt.length).toBeGreaterThan(0);
    });

    it('should respect layer priorities', () => {
      builder
        .withTaskSpec('task-1', 'TASK_CONTENT')
        .withSystemConstraints('SYSTEM_CONTENT')
        .withOutputFormat('OUTPUT_CONTENT');

      const prompt = builder.build();

      // System constraints should come before task spec
      const systemIndex = prompt.indexOf('SYSTEM_CONTENT');
      const taskIndex = prompt.indexOf('TASK_CONTENT');
      expect(systemIndex).toBeLessThan(taskIndex);
    });

    it('should reset builder state', () => {
      builder.withSystemConstraints();
      builder.reset();
      expect(builder.getLayerCount()).toBe(0);
    });
  });

  describe('Build from Context', () => {
    it('should build prompt from execution context', () => {
      const context = createContext();
      context.lessonsLearned = ['Always validate inputs'];
      context.previousOutputs = new Map([
        [
          'analyst',
          {
            success: true,
            output: { recommendation: 'Use React' },
            metrics: { duration: 100, tokensUsed: 50, retries: 0 },
          },
        ],
      ]) as ExecutionContext['previousOutputs'];

      builder.forAgent('orchestrator');
      const prompt = builder.buildFromContext(
        'task-1',
        'Build a user dashboard',
        context,
        ORCHESTRATOR_TEMPLATE
      );

      expect(prompt).toContain('ROLE');
      expect(prompt).toContain('Build a user dashboard');
      expect(prompt).toContain('test-project');
    });
  });

  describe('Token Limits', () => {
    it('should respect max token limit', () => {
      const smallBuilder = new PromptBuilder({ maxTokens: 500 });

      // Add many layers
      smallBuilder
        .withSystemConstraints()
        .withAgentRole(ORCHESTRATOR_TEMPLATE)
        .withTaskSpec('task-1', 'A'.repeat(2000)) // Long task
        .withLessons(['Lesson 1', 'Lesson 2', 'Lesson 3']);

      const prompt = smallBuilder.build();

      // Should not exceed rough token limit
      const estimatedTokens = prompt.length / 4;
      expect(estimatedTokens).toBeLessThanOrEqual(1000); // Some buffer
    });
  });
});

describe('Agent Templates', () => {
  it('should get orchestrator template', () => {
    const template = getAgentTemplate('orchestrator');
    expect(template).toBeDefined();
    expect(template?.role).toBe('Central Orchestrator');
  });

  it('should get project manager template', () => {
    const template = getAgentTemplate('project-manager');
    expect(template).toBeDefined();
    expect(template?.capabilities).toContain('Decompose high-level requirements into work breakdown structures');
  });

  it('should get architect template', () => {
    const template = getAgentTemplate('architect');
    expect(template).toBeDefined();
    expect(template?.role).toBe('Software Architect');
  });

  it('should get analyst template', () => {
    const template = getAgentTemplate('analyst');
    expect(template).toBeDefined();
    expect(template?.capabilities).toContain('Research best practices and industry standards');
  });

  it('should return undefined for unknown agent', () => {
    const template = getAgentTemplate('unknown-agent');
    expect(template).toBeUndefined();
  });

  describe('Template Structure', () => {
    it('should have valid output format structure', () => {
      // Verify the output format contains expected sections
      const format = ORCHESTRATOR_TEMPLATE.outputFormat;
      expect(format).toContain('decision');
      expect(format).toContain('nextAgent');
      expect(format).toContain('taskAnalysis');
    });

    it('should have success criteria', () => {
      expect(ORCHESTRATOR_TEMPLATE.successCriteria.length).toBeGreaterThan(0);
      expect(PROJECT_MANAGER_TEMPLATE.successCriteria.length).toBeGreaterThan(0);
    });
  });
});

describe('Prompt Builder Singleton', () => {
  beforeEach(() => {
    resetPromptBuilder();
  });

  it('should return same instance', () => {
    const instance1 = getPromptBuilder();
    const instance2 = getPromptBuilder();
    expect(instance1).toBe(instance2);
  });

  it('should reset singleton', () => {
    const instance1 = getPromptBuilder();
    resetPromptBuilder();
    const instance2 = getPromptBuilder();
    expect(instance1).not.toBe(instance2);
  });
});
