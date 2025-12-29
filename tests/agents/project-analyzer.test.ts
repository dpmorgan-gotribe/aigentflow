/**
 * Project Analyzer Agent Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ProjectAnalyzerAgent, createProjectAnalyzerAgent } from '../../src/agents/project-analyzer.js';
import { resetTechDetector } from '../../src/analysis/tech-detector.js';
import { resetCodeAnalyzer } from '../../src/analysis/code-analyzer.js';
import type { AgentRequest, ExecutionContext } from '../../src/agents/types.js';
import type { ProjectConfig } from '../../src/types.js';

const createTestContext = (overrides: Partial<ProjectConfig> = {}): ExecutionContext => ({
  taskId: 'test-task-1',
  currentState: 'ANALYZING',
  projectConfig: {
    name: 'test-project',
    version: '1.0.0',
    description: 'Test project',
    path: process.cwd(), // Use current directory for testing
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    features: {
      gitWorktrees: false,
      parallelAgents: false,
      selfEvolution: false,
    },
    compliance: {
      frameworks: [],
      strictMode: false,
    },
    agents: {},
    hooks: [],
    ...overrides,
  },
  previousOutputs: new Map(),
  lessonsLearned: [],
});

const createTestRequest = (
  prompt: string,
  context: ExecutionContext
): AgentRequest => ({
  id: `req-${Date.now()}`,
  taskId: context.taskId,
  agentType: 'project-analyzer',
  prompt,
  context,
});

describe('ProjectAnalyzerAgent', () => {
  let agent: ProjectAnalyzerAgent;

  beforeEach(() => {
    resetTechDetector();
    resetCodeAnalyzer();
    agent = new ProjectAnalyzerAgent();
  });

  afterEach(() => {
    resetTechDetector();
    resetCodeAnalyzer();
  });

  describe('Metadata', () => {
    it('should have correct agent type', () => {
      expect(agent.metadata.type).toBe('project-analyzer');
    });

    it('should have correct phase', () => {
      expect(agent.metadata.phase).toBe('v1.0');
    });

    it('should have correct name', () => {
      expect(agent.metadata.name).toBe('Project Analyzer');
    });

    it('should have expected capabilities', () => {
      expect(agent.metadata.capabilities).toContain('tech-detection');
      expect(agent.metadata.capabilities).toContain('pattern-recognition');
      expect(agent.metadata.capabilities).toContain('claude-md-generation');
    });

    it('should operate in expected states', () => {
      expect(agent.metadata.validStates).toContain('IDLE');
      expect(agent.metadata.validStates).toContain('ANALYZING');
      expect(agent.metadata.validStates).toContain('ORCHESTRATING');
    });

    it('should have reasonable timeout for large projects', () => {
      expect(agent.metadata.defaultConfig.timeout).toBeGreaterThanOrEqual(60000);
    });
  });

  describe('Factory Function', () => {
    it('should create agent instance', () => {
      const factoryAgent = createProjectAnalyzerAgent();
      expect(factoryAgent).toBeInstanceOf(ProjectAnalyzerAgent);
    });

    it('should create independent instances', () => {
      const agent1 = createProjectAnalyzerAgent();
      const agent2 = createProjectAnalyzerAgent();
      expect(agent1).not.toBe(agent2);
    });
  });

  describe('canHandle', () => {
    it('should handle analyze-project task', () => {
      const context = createTestContext();
      expect(agent.canHandle('analyze-project', context)).toBe(true);
    });

    it('should handle detect-tech task', () => {
      const context = createTestContext();
      expect(agent.canHandle('detect-tech', context)).toBe(true);
    });

    it('should handle generate-docs task', () => {
      const context = createTestContext();
      expect(agent.canHandle('generate-docs', context)).toBe(true);
    });

    it('should not handle unrelated tasks', () => {
      const context = createTestContext();
      expect(agent.canHandle('build-feature', context)).toBe(false);
    });
  });

  describe('Validation', () => {
    it('should validate proper request', async () => {
      const context = createTestContext();
      const request = createTestRequest('Analyze this project', context);

      const isValid = await agent.validate(request);
      expect(isValid).toBe(true);
    });

    it('should reject request without id', async () => {
      const context = createTestContext();
      const request = createTestRequest('Analyze this project', context);
      request.id = '';

      const isValid = await agent.validate(request);
      expect(isValid).toBe(false);
    });

    it('should reject request without taskId', async () => {
      const context = createTestContext();
      const request = createTestRequest('Analyze this project', context);
      request.taskId = '';

      const isValid = await agent.validate(request);
      expect(isValid).toBe(false);
    });

    it('should reject request without prompt', async () => {
      const context = createTestContext();
      const request = createTestRequest('', context);

      const isValid = await agent.validate(request);
      expect(isValid).toBe(false);
    });

    it('should reject request in invalid state', async () => {
      const context = createTestContext();
      context.currentState = 'COMPLETED';
      const request = createTestRequest('Analyze this project', context);

      const isValid = await agent.validate(request);
      expect(isValid).toBe(false);
    });
  });

  describe('Execution', () => {
    it('should execute successfully with current project', async () => {
      const context = createTestContext();
      const request = createTestRequest('Analyze this project', context);

      const result = await agent.execute(request, { dryRun: false });

      expect(result.success).toBe(true);
      expect(result.output).toBeDefined();
    });

    it('should return analysis output structure', async () => {
      const context = createTestContext();
      const request = createTestRequest('Analyze this project', context);

      const result = await agent.execute(request, { dryRun: false });

      expect(result.success).toBe(true);
      const output = result.output as Record<string, unknown>;
      expect(output).toHaveProperty('analysis');
      expect(output).toHaveProperty('recommendations');
      expect(output).toHaveProperty('claudeMd');
    });

    it('should detect tech stack in analysis', async () => {
      const context = createTestContext();
      const request = createTestRequest('Analyze this project', context);

      const result = await agent.execute(request, { dryRun: false });

      expect(result.success).toBe(true);
      const output = result.output as { analysis: { techStack: unknown } };
      expect(output.analysis.techStack).toBeDefined();
    });

    it('should include architecture pattern in analysis', async () => {
      const context = createTestContext();
      const request = createTestRequest('Analyze this project', context);

      const result = await agent.execute(request, { dryRun: false });

      expect(result.success).toBe(true);
      const output = result.output as { analysis: { architecture: { pattern: string } } };
      expect(output.analysis.architecture.pattern).toBeDefined();
    });

    it('should include metrics in analysis', async () => {
      const context = createTestContext();
      const request = createTestRequest('Analyze this project', context);

      const result = await agent.execute(request, { dryRun: false });

      expect(result.success).toBe(true);
      const output = result.output as {
        analysis: { metrics: { linesOfCode: number; fileCount: number } };
      };
      expect(output.analysis.metrics.linesOfCode).toBeGreaterThanOrEqual(0);
      expect(output.analysis.metrics.fileCount).toBeGreaterThanOrEqual(0);
    });

    it('should generate CLAUDE.md content', async () => {
      const context = createTestContext();
      const request = createTestRequest('Analyze this project', context);

      const result = await agent.execute(request, { dryRun: false });

      expect(result.success).toBe(true);
      const output = result.output as { claudeMd: string };
      expect(output.claudeMd).toContain('# Project Guide');
    });

    it('should provide routing hint', async () => {
      const context = createTestContext();
      const request = createTestRequest('Analyze this project', context);

      const result = await agent.execute(request, { dryRun: false });

      expect(result.routingHint).toBeDefined();
      expect(result.routingHint?.nextAgent).toBeDefined();
      expect(result.routingHint?.reasoning).toBeDefined();
    });
  });

  describe('Routing', () => {
    it('should route to compliance-agent when compliance frameworks configured', async () => {
      const context = createTestContext({
        compliance: {
          frameworks: ['SOC2'],
          strictMode: false,
        },
      });
      const request = createTestRequest('Analyze this project', context);

      const result = await agent.execute(request, { dryRun: false });

      expect(result.routingHint?.nextAgent).toBe('compliance-agent');
    });

    it('should route to architect when no compliance frameworks', async () => {
      const context = createTestContext({
        compliance: {
          frameworks: [],
          strictMode: false,
        },
      });
      const request = createTestRequest('Analyze this project', context);

      const result = await agent.execute(request, { dryRun: false });

      expect(result.routingHint?.nextAgent).toBe('architect');
    });
  });

  describe('Recommendations', () => {
    it('should generate recommendations', async () => {
      const context = createTestContext();
      const request = createTestRequest('Analyze this project', context);

      const result = await agent.execute(request, { dryRun: false });

      expect(result.success).toBe(true);
      const output = result.output as { recommendations: unknown[] };
      expect(Array.isArray(output.recommendations)).toBe(true);
    });

    it('should include compliance recommendation when frameworks configured', async () => {
      const context = createTestContext({
        compliance: {
          frameworks: ['GDPR'],
          strictMode: false,
        },
      });
      const request = createTestRequest('Analyze this project', context);

      const result = await agent.execute(request, { dryRun: false });

      expect(result.success).toBe(true);
      const output = result.output as {
        recommendations: Array<{ category: string; description: string }>;
      };
      const securityRec = output.recommendations.find((r) => r.category === 'security');
      expect(securityRec?.description).toContain('GDPR');
    });
  });

  describe('Dry Run', () => {
    it('should return dry run result when dryRun is true', async () => {
      const context = createTestContext();
      const request = createTestRequest('Analyze this project', context);

      const result = await agent.execute(request, { dryRun: true });

      expect(result.success).toBe(true);
      const output = result.output as { dryRun: boolean };
      expect(output.dryRun).toBe(true);
    });

    it('should not run actual analysis in dry run mode', async () => {
      const context = createTestContext();
      const request = createTestRequest('Analyze this project', context);

      const result = await agent.execute(request, { dryRun: true });

      expect(result.metrics.tokensUsed).toBe(0);
    });
  });

  describe('Metrics', () => {
    it('should track execution duration', async () => {
      const context = createTestContext();
      const request = createTestRequest('Analyze this project', context);

      const result = await agent.execute(request, { dryRun: false });

      expect(result.metrics.duration).toBeGreaterThan(0);
    });

    it('should estimate tokens used', async () => {
      const context = createTestContext();
      const request = createTestRequest('Analyze this project', context);

      const result = await agent.execute(request, { dryRun: false });

      expect(result.metrics.tokensUsed).toBeGreaterThan(0);
    });
  });

  describe('Capabilities', () => {
    it('should return all capabilities', () => {
      const capabilities = agent.getCapabilities();

      expect(capabilities).toContain('tech-detection');
      expect(capabilities).toContain('pattern-recognition');
      expect(capabilities).toContain('convention-analysis');
      expect(capabilities).toContain('claude-md-generation');
      expect(capabilities).toContain('recommendation-generation');
    });
  });
});
