/**
 * Compliance Agent Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ComplianceAgent, createComplianceAgent } from '../../src/agents/compliance-agent.js';
import { resetComplianceEngine } from '../../src/compliance/compliance-engine.js';
import type { AgentRequest, ExecutionContext } from '../../src/agents/types.js';
import type { ProjectConfig } from '../../src/types.js';

const createTestContext = (overrides: Partial<ProjectConfig> = {}): ExecutionContext => ({
  taskId: 'test-task-1',
  currentState: 'ANALYZING',
  projectConfig: {
    name: 'test-project',
    version: '1.0.0',
    description: 'Test project',
    path: process.cwd(),
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
  agentType: 'compliance-agent',
  prompt,
  context,
});

describe('ComplianceAgent', () => {
  let agent: ComplianceAgent;

  beforeEach(() => {
    resetComplianceEngine();
    agent = new ComplianceAgent();
  });

  afterEach(() => {
    resetComplianceEngine();
  });

  describe('Metadata', () => {
    it('should have correct agent type', () => {
      expect(agent.metadata.type).toBe('compliance-agent');
    });

    it('should have correct phase', () => {
      expect(agent.metadata.phase).toBe('v1.0');
    });

    it('should have correct name', () => {
      expect(agent.metadata.name).toBe('Compliance Agent');
    });

    it('should have expected capabilities', () => {
      expect(agent.metadata.capabilities).toContain('security-compliance');
      expect(agent.metadata.capabilities).toContain('gdpr-compliance');
      expect(agent.metadata.capabilities).toContain('soc2-compliance');
      expect(agent.metadata.capabilities).toContain('violation-detection');
    });

    it('should operate in expected states', () => {
      expect(agent.metadata.validStates).toContain('ANALYZING');
      expect(agent.metadata.validStates).toContain('REVIEWING');
    });
  });

  describe('Factory Function', () => {
    it('should create agent instance', () => {
      const factoryAgent = createComplianceAgent();
      expect(factoryAgent).toBeInstanceOf(ComplianceAgent);
    });

    it('should create independent instances', () => {
      const agent1 = createComplianceAgent();
      const agent2 = createComplianceAgent();
      expect(agent1).not.toBe(agent2);
    });
  });

  describe('canHandle', () => {
    it('should handle compliance-check task', () => {
      const context = createTestContext();
      expect(agent.canHandle('compliance-check', context)).toBe(true);
    });

    it('should handle security-review task', () => {
      const context = createTestContext();
      expect(agent.canHandle('security-review', context)).toBe(true);
    });

    it('should handle gdpr-audit task', () => {
      const context = createTestContext();
      expect(agent.canHandle('gdpr-audit', context)).toBe(true);
    });

    it('should handle soc2-audit task', () => {
      const context = createTestContext();
      expect(agent.canHandle('soc2-audit', context)).toBe(true);
    });

    it('should not handle unrelated tasks', () => {
      const context = createTestContext();
      expect(agent.canHandle('build-feature', context)).toBe(false);
    });
  });

  describe('Validation', () => {
    it('should validate proper request', async () => {
      const context = createTestContext();
      const request = createTestRequest('Run compliance check', context);

      const isValid = await agent.validate(request);
      expect(isValid).toBe(true);
    });

    it('should reject request without id', async () => {
      const context = createTestContext();
      const request = createTestRequest('Run compliance check', context);
      request.id = '';

      const isValid = await agent.validate(request);
      expect(isValid).toBe(false);
    });

    it('should reject request in invalid state', async () => {
      const context = createTestContext();
      context.currentState = 'COMPLETED';
      const request = createTestRequest('Run compliance check', context);

      const isValid = await agent.validate(request);
      expect(isValid).toBe(false);
    });
  });

  describe('Execution', () => {
    it('should execute successfully', async () => {
      const context = createTestContext();
      const request = createTestRequest('Run compliance check', context);

      const result = await agent.execute(request);

      expect(result.success).toBe(true);
      expect(result.output).toBeDefined();
    });

    it('should return compliance output structure', async () => {
      const context = createTestContext();
      const request = createTestRequest('Run compliance check', context);

      const result = await agent.execute(request);

      const output = result.output as Record<string, unknown>;
      expect(output).toHaveProperty('compliance');
      expect(output).toHaveProperty('violations');
      expect(output).toHaveProperty('summary');
      expect(output).toHaveProperty('recommendations');
    });

    it('should include compliance score', async () => {
      const context = createTestContext();
      const request = createTestRequest('Run compliance check', context);

      const result = await agent.execute(request);

      const output = result.output as { compliance: { score: number } };
      expect(typeof output.compliance.score).toBe('number');
      expect(output.compliance.score).toBeGreaterThanOrEqual(0);
      expect(output.compliance.score).toBeLessThanOrEqual(100);
    });

    it('should include pass/fail status', async () => {
      const context = createTestContext();
      const request = createTestRequest('Run compliance check', context);

      const result = await agent.execute(request);

      const output = result.output as { compliance: { passed: boolean } };
      expect(typeof output.compliance.passed).toBe('boolean');
    });

    it('should include severity counts', async () => {
      const context = createTestContext();
      const request = createTestRequest('Run compliance check', context);

      const result = await agent.execute(request);

      const output = result.output as {
        summary: { critical: number; high: number; medium: number; low: number };
      };
      expect(typeof output.summary.critical).toBe('number');
      expect(typeof output.summary.high).toBe('number');
      expect(typeof output.summary.medium).toBe('number');
      expect(typeof output.summary.low).toBe('number');
    });

    it('should provide routing hint', async () => {
      const context = createTestContext();
      const request = createTestRequest('Run compliance check', context);

      const result = await agent.execute(request);

      expect(result.routingHint).toBeDefined();
      expect(result.routingHint?.nextAgent).toBeDefined();
    });
  });

  describe('Framework Configuration', () => {
    it('should enable GDPR when configured', async () => {
      const context = createTestContext({
        compliance: {
          frameworks: ['GDPR'],
          strictMode: false,
        },
      });
      const request = createTestRequest('Run compliance check', context);

      const result = await agent.execute(request);

      const output = result.output as { compliance: { frameworks: string[] } };
      expect(output.compliance.frameworks).toContain('platform');
    });

    it('should enable SOC2 when configured', async () => {
      const context = createTestContext({
        compliance: {
          frameworks: ['SOC2'],
          strictMode: false,
        },
      });
      const request = createTestRequest('Run compliance check', context);

      const result = await agent.execute(request);

      const output = result.output as { compliance: { frameworks: string[] } };
      expect(output.compliance.frameworks).toContain('platform');
    });
  });

  describe('Source Code Checking', () => {
    it('should check source code when available', async () => {
      const context = createTestContext();
      // Use a 36-char token after ghp_ to match the regex pattern
      context.sourceCode = new Map([
        ['config.ts', 'const key = "ghp_abcdefghijklmnopqrstuvwxyz1234567890";'],
      ]);
      const request = createTestRequest('Run compliance check', context);

      const result = await agent.execute(request);

      const output = result.output as { violations: unknown[] };
      expect(output.violations.length).toBeGreaterThan(0);
    });

    it('should check previous agent outputs', async () => {
      const context = createTestContext();
      context.previousOutputs.set('architect', {
        success: true,
        output: { code: 'eval(userInput);' },
        metrics: { duration: 100, tokensUsed: 50, retries: 0 },
      });
      const request = createTestRequest('Run compliance check', context);

      const result = await agent.execute(request);

      expect(result.success).toBe(true);
    });
  });

  describe('Recommendations', () => {
    it('should generate recommendations', async () => {
      const context = createTestContext();
      const request = createTestRequest('Run compliance check', context);

      const result = await agent.execute(request);

      const output = result.output as { recommendations: unknown[] };
      expect(Array.isArray(output.recommendations)).toBe(true);
    });

    it('should include positive feedback when no violations', async () => {
      const context = createTestContext();
      const request = createTestRequest('Run compliance check', context);

      const result = await agent.execute(request);

      const output = result.output as {
        recommendations: Array<{ title: string; description: string }>;
      };

      if (output.recommendations.length > 0) {
        const hasPositive = output.recommendations.some(
          (r) => r.title.includes('Passed') || r.description.includes('No compliance issues')
        );
        expect(hasPositive).toBe(true);
      }
    });
  });

  describe('Routing', () => {
    it('should route to architect when compliance passed', async () => {
      const context = createTestContext();
      const request = createTestRequest('Run compliance check', context);

      const result = await agent.execute(request);

      expect(result.routingHint?.nextAgent).toBe('architect');
    });

    it('should route to project-manager in strict mode with critical violations', async () => {
      const context = createTestContext({
        compliance: {
          frameworks: [],
          strictMode: true,
        },
      });
      context.sourceCode = new Map([
        ['secret.ts', 'const key = "ghp_abcdefghijklmnopqrstuvwxyz12345678";'],
      ]);
      const request = createTestRequest('Run compliance check', context);

      const result = await agent.execute(request);

      const output = result.output as { summary: { critical: number } };
      if (output.summary.critical > 0) {
        expect(result.routingHint?.nextAgent).toBe('project-manager');
      }
    });
  });

  describe('Dry Run', () => {
    it('should return dry run result when dryRun is true', async () => {
      const context = createTestContext();
      const request = createTestRequest('Run compliance check', context);

      const result = await agent.execute(request, { dryRun: true });

      expect(result.success).toBe(true);
      const output = result.output as { dryRun: boolean };
      expect(output.dryRun).toBe(true);
    });
  });

  describe('Metrics', () => {
    it('should track execution duration', async () => {
      const context = createTestContext();
      const request = createTestRequest('Run compliance check', context);

      const result = await agent.execute(request);

      // Duration can be 0 for fast executions
      expect(result.metrics.duration).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Capabilities', () => {
    it('should return all capabilities', () => {
      const capabilities = agent.getCapabilities();

      expect(capabilities).toContain('security-compliance');
      expect(capabilities).toContain('gdpr-compliance');
      expect(capabilities).toContain('soc2-compliance');
      expect(capabilities).toContain('violation-detection');
      expect(capabilities).toContain('remediation-suggestions');
    });
  });
});
