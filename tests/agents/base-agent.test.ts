/**
 * Base Agent Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BaseAgent } from '../../src/agents/base-agent.js';
import type {
  AgentMetadata,
  AgentRequest,
  AgentResult,
  AgentExecutionOptions,
  ExecutionContext,
} from '../../src/agents/types.js';
import { resetHookManager } from '../../src/hooks/hook-manager.js';
import { resetFeatureFlags } from '../../src/core/feature-flags.js';

/**
 * Test agent implementation
 */
class TestAgent extends BaseAgent {
  readonly metadata: AgentMetadata = {
    type: 'orchestrator',
    name: 'Test Agent',
    description: 'A test agent for unit testing',
    phase: 'mvp',
    defaultConfig: {
      enabled: true,
      maxConcurrent: 1,
      timeout: 5000,
      retryCount: 2,
    },
    capabilities: ['testing', 'validation'],
    validStates: ['IDLE', 'ANALYZING'],
  };

  private shouldFail = false;
  private failCount = 0;
  private executeCount = 0;

  setShouldFail(fail: boolean): void {
    this.shouldFail = fail;
  }

  setFailCount(count: number): void {
    this.failCount = count;
  }

  getExecuteCount(): number {
    return this.executeCount;
  }

  protected async executeCore(
    request: AgentRequest,
    options: Required<AgentExecutionOptions>
  ): Promise<AgentResult> {
    this.executeCount++;

    if (this.shouldFail) {
      if (this.failCount > 0) {
        this.failCount--;
        throw new Error('Simulated failure');
      }
    }

    return {
      success: true,
      output: {
        message: `Processed: ${request.prompt}`,
        model: options.model,
      },
      metrics: {
        duration: 100,
        tokensUsed: 500,
        retries: 0,
      },
      routingHint: {
        nextAgent: 'project-manager',
        reasoning: 'Task needs planning',
      },
    };
  }
}

describe('BaseAgent', () => {
  let agent: TestAgent;

  beforeEach(() => {
    resetHookManager();
    resetFeatureFlags();
    agent = new TestAgent();
  });

  const createRequest = (overrides: Partial<AgentRequest> = {}): AgentRequest => ({
    id: 'req-1',
    taskId: 'task-1',
    agentType: 'orchestrator',
    prompt: 'Test prompt',
    context: {
      taskId: 'task-1',
      projectConfig: {
        name: 'test-project',
        version: '1.0.0',
        path: '/test',
        features: { gitWorktrees: false, parallelAgents: true, selfEvolution: false },
        compliance: { frameworks: [], strictMode: false },
        techStack: {},
        hooks: [],
        agents: {},
      },
      currentState: 'ANALYZING',
      previousOutputs: new Map(),
      lessonsLearned: [],
    } as ExecutionContext,
    ...overrides,
  });

  describe('Metadata', () => {
    it('should have correct metadata', () => {
      expect(agent.metadata.type).toBe('orchestrator');
      expect(agent.metadata.name).toBe('Test Agent');
      expect(agent.metadata.phase).toBe('mvp');
    });

    it('should return capabilities', () => {
      const capabilities = agent.getCapabilities();
      expect(capabilities).toContain('testing');
      expect(capabilities).toContain('validation');
    });
  });

  describe('Validation', () => {
    it('should validate valid request', async () => {
      const request = createRequest();
      const isValid = await agent.validate(request);
      expect(isValid).toBe(true);
    });

    it('should reject request without id', async () => {
      const request = createRequest({ id: '' });
      const isValid = await agent.validate(request);
      expect(isValid).toBe(false);
    });

    it('should reject request without taskId', async () => {
      const request = createRequest({ taskId: '' });
      const isValid = await agent.validate(request);
      expect(isValid).toBe(false);
    });

    it('should reject request without prompt', async () => {
      const request = createRequest({ prompt: '' });
      const isValid = await agent.validate(request);
      expect(isValid).toBe(false);
    });

    it('should reject request for invalid state', async () => {
      const request = createRequest();
      request.context.currentState = 'BUILDING' as ExecutionContext['currentState'];
      const isValid = await agent.validate(request);
      expect(isValid).toBe(false);
    });
  });

  describe('Execution', () => {
    it('should execute successfully', async () => {
      const request = createRequest();
      const result = await agent.execute(request);

      expect(result.success).toBe(true);
      expect(result.output).toBeDefined();
      expect(result.metrics.duration).toBeGreaterThan(0);
    });

    it('should include routing hint in result', async () => {
      const request = createRequest();
      const result = await agent.execute(request);

      expect(result.routingHint).toBeDefined();
      expect(result.routingHint?.nextAgent).toBe('project-manager');
    });

    it('should handle dry run mode', async () => {
      const request = createRequest();
      const result = await agent.execute(request, { dryRun: true });

      expect(result.success).toBe(true);
      expect((result.output as Record<string, unknown>).dryRun).toBe(true);
    });

    it('should retry on failure', async () => {
      agent.setShouldFail(true);
      agent.setFailCount(2); // Fail twice, then succeed

      const request = createRequest();
      const result = await agent.execute(request, { maxRetries: 3 });

      expect(result.success).toBe(true);
      expect(agent.getExecuteCount()).toBe(3); // 2 failures + 1 success
    });

    it('should fail after max retries', async () => {
      agent.setShouldFail(true);
      agent.setFailCount(10); // Always fail

      const request = createRequest();
      const result = await agent.execute(request, { maxRetries: 2 });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('Lifecycle Hooks', () => {
    it('should call beforeExecute hook', async () => {
      const beforeExecute = vi.fn();
      agent.setHooks({ beforeExecute });

      const request = createRequest();
      await agent.execute(request);

      expect(beforeExecute).toHaveBeenCalledWith(request);
    });

    it('should call afterExecute hook on success', async () => {
      const afterExecute = vi.fn();
      agent.setHooks({ afterExecute });

      const request = createRequest();
      await agent.execute(request);

      expect(afterExecute).toHaveBeenCalled();
      const [, result] = afterExecute.mock.calls[0];
      expect(result.success).toBe(true);
    });

    it('should call onError hook on failure', async () => {
      agent.setShouldFail(true);
      agent.setFailCount(10);

      const onError = vi.fn();
      agent.setHooks({ onError });

      const request = createRequest();
      await agent.execute(request, { maxRetries: 1 });

      expect(onError).toHaveBeenCalled();
    });

    it('should call beforeRetry hook', async () => {
      agent.setShouldFail(true);
      agent.setFailCount(1);

      const beforeRetry = vi.fn();
      agent.setHooks({ beforeRetry });

      const request = createRequest();
      await agent.execute(request, { maxRetries: 2 });

      expect(beforeRetry).toHaveBeenCalledWith(request, 1);
    });
  });

  describe('canHandle', () => {
    it('should return true for supported capability', () => {
      const context = createRequest().context;
      expect(agent.canHandle('testing', context)).toBe(true);
    });

    it('should return false for unsupported capability', () => {
      const context = createRequest().context;
      expect(agent.canHandle('unsupported', context)).toBe(false);
    });
  });
});
