/**
 * Agent Registry Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  AgentRegistry,
  getAgentRegistry,
  resetAgentRegistry,
} from '../../src/agents/registry.js';
import { BaseAgent } from '../../src/agents/base-agent.js';
import type {
  AgentMetadata,
  AgentRequest,
  AgentResult,
  AgentExecutionOptions,
} from '../../src/agents/types.js';
import { resetFeatureFlags, getFeatureFlags } from '../../src/core/feature-flags.js';

/**
 * Mock agent for testing
 */
class MockAgent extends BaseAgent {
  readonly metadata: AgentMetadata;

  constructor(type: string, phase: 'mvp' | 'v1.0' = 'mvp') {
    super();
    this.metadata = {
      type: type as AgentMetadata['type'],
      name: `Mock ${type}`,
      description: `Mock agent for ${type}`,
      phase,
      defaultConfig: {
        enabled: true,
        maxConcurrent: 1,
        timeout: 5000,
        retryCount: 2,
      },
      capabilities: [type],
      validStates: [],
    };
  }

  protected async executeCore(
    _request: AgentRequest,
    _options: Required<AgentExecutionOptions>
  ): Promise<AgentResult> {
    return {
      success: true,
      output: { type: this.metadata.type },
      metrics: { duration: 100, tokensUsed: 0, retries: 0 },
    };
  }
}

describe('AgentRegistry', () => {
  let registry: AgentRegistry;

  beforeEach(() => {
    resetAgentRegistry();
    resetFeatureFlags();
    registry = new AgentRegistry();
  });

  afterEach(() => {
    resetAgentRegistry();
    resetFeatureFlags();
  });

  describe('Registration', () => {
    it('should register an agent', () => {
      registry.register(() => new MockAgent('orchestrator'));
      expect(registry.isRegistered('orchestrator')).toBe(true);
    });

    it('should unregister an agent', () => {
      registry.register(() => new MockAgent('orchestrator'));
      const removed = registry.unregister('orchestrator');
      expect(removed).toBe(true);
      expect(registry.isRegistered('orchestrator')).toBe(false);
    });

    it('should return false when unregistering non-existent agent', () => {
      const removed = registry.unregister('nonexistent' as AgentMetadata['type']);
      expect(removed).toBe(false);
    });

    it('should overwrite existing registration', () => {
      registry.register(() => new MockAgent('orchestrator'));
      registry.register(() => new MockAgent('orchestrator'));
      expect(registry.isRegistered('orchestrator')).toBe(true);
    });
  });

  describe('Instance Retrieval', () => {
    it('should return agent instance', () => {
      registry.register(() => new MockAgent('orchestrator'));

      // Enable the feature flag
      getFeatureFlags().setOverride('agents.orchestrator', true);

      const agent = registry.get('orchestrator');
      expect(agent).toBeDefined();
      expect(agent?.metadata.type).toBe('orchestrator');
    });

    it('should return undefined for unregistered agent', () => {
      const agent = registry.get('nonexistent' as AgentMetadata['type']);
      expect(agent).toBeUndefined();
    });

    it('should return singleton in singleton mode', () => {
      const singletonRegistry = new AgentRegistry(true);
      singletonRegistry.register(() => new MockAgent('orchestrator'));

      // Enable the feature flag
      getFeatureFlags().setOverride('agents.orchestrator', true);

      const agent1 = singletonRegistry.get('orchestrator');
      const agent2 = singletonRegistry.get('orchestrator');
      expect(agent1).toBe(agent2);
    });

    it('should return new instance when not in singleton mode', () => {
      const instanceRegistry = new AgentRegistry(false);
      instanceRegistry.register(() => new MockAgent('orchestrator'));

      // Enable the feature flag
      getFeatureFlags().setOverride('agents.orchestrator', true);

      const agent1 = instanceRegistry.get('orchestrator');
      const agent2 = instanceRegistry.get('orchestrator');
      expect(agent1).not.toBe(agent2);
    });

    it('should return undefined when agent is disabled by feature flag', () => {
      registry.register(() => new MockAgent('orchestrator'));

      // Explicitly disable
      getFeatureFlags().setOverride('agents.orchestrator', false);

      const agent = registry.get('orchestrator');
      expect(agent).toBeUndefined();
    });
  });

  describe('Metadata', () => {
    it('should return agent metadata', () => {
      registry.register(() => new MockAgent('orchestrator'));
      const metadata = registry.getMetadata('orchestrator');
      expect(metadata).toBeDefined();
      expect(metadata?.type).toBe('orchestrator');
    });

    it('should return undefined for unregistered agent', () => {
      const metadata = registry.getMetadata('nonexistent' as AgentMetadata['type']);
      expect(metadata).toBeUndefined();
    });
  });

  describe('Availability', () => {
    it('should check if agent is available', () => {
      registry.register(() => new MockAgent('orchestrator'));
      getFeatureFlags().setOverride('agents.orchestrator', true);
      expect(registry.isAvailable('orchestrator')).toBe(true);
    });

    it('should return false for disabled agent', () => {
      registry.register(() => new MockAgent('orchestrator'));
      getFeatureFlags().setOverride('agents.orchestrator', false);
      expect(registry.isAvailable('orchestrator')).toBe(false);
    });
  });

  describe('Queries', () => {
    beforeEach(() => {
      registry.register(() => new MockAgent('orchestrator', 'mvp'));
      registry.register(() => new MockAgent('project-manager', 'mvp'));
      registry.register(() => new MockAgent('ui-designer', 'v1.0'));
    });

    it('should get all registered types', () => {
      const types = registry.getRegisteredTypes();
      expect(types).toHaveLength(3);
      expect(types).toContain('orchestrator');
    });

    it('should get available types', () => {
      getFeatureFlags().setOverride('agents.orchestrator', true);
      getFeatureFlags().setOverride('agents.projectmanager', true);
      getFeatureFlags().setOverride('agents.uidesigner', false);

      const types = registry.getAvailableTypes();
      expect(types).toHaveLength(2);
      expect(types).not.toContain('ui-designer');
    });

    it('should get agents by phase', () => {
      const mvpAgents = registry.getByPhase('mvp');
      expect(mvpAgents).toHaveLength(2);

      const v1Agents = registry.getByPhase('v1.0');
      expect(v1Agents).toHaveLength(1);
    });

    it('should get agents by capability', () => {
      const agents = registry.getByCapability('orchestrator');
      expect(agents).toHaveLength(1);
      expect(agents[0]?.type).toBe('orchestrator');
    });
  });

  describe('Statistics', () => {
    it('should return registry stats', () => {
      registry.register(() => new MockAgent('orchestrator', 'mvp'));
      registry.register(() => new MockAgent('project-manager', 'mvp'));

      getFeatureFlags().setOverride('agents.orchestrator', true);

      const stats = registry.getStats();
      expect(stats.totalRegistered).toBe(2);
      expect(stats.totalAvailable).toBe(1);
      expect((stats.byPhase as Record<string, number>).mvp).toBe(2);
    });
  });

  describe('Clear and Reset', () => {
    it('should clear all registrations', () => {
      registry.register(() => new MockAgent('orchestrator'));
      registry.clear();
      expect(registry.getRegisteredTypes()).toHaveLength(0);
    });

    it('should reset singleton instances', () => {
      registry.register(() => new MockAgent('orchestrator'));
      getFeatureFlags().setOverride('agents.orchestrator', true);

      const agent1 = registry.get('orchestrator');
      registry.resetInstances();
      const agent2 = registry.get('orchestrator');

      expect(agent1).not.toBe(agent2);
    });
  });
});

describe('Registry Singleton', () => {
  beforeEach(() => {
    resetAgentRegistry();
    resetFeatureFlags();
  });

  afterEach(() => {
    resetAgentRegistry();
    resetFeatureFlags();
  });

  it('should return same instance', () => {
    const instance1 = getAgentRegistry();
    const instance2 = getAgentRegistry();
    expect(instance1).toBe(instance2);
  });

  it('should reset singleton', () => {
    const instance1 = getAgentRegistry();
    resetAgentRegistry();
    const instance2 = getAgentRegistry();
    expect(instance1).not.toBe(instance2);
  });
});
