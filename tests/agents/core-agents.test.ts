/**
 * Core Agents Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  OrchestratorAgent,
  ProjectManagerAgent,
  ArchitectAgent,
  AnalystAgent,
  createOrchestratorAgent,
  createProjectManagerAgent,
  createArchitectAgent,
  createAnalystAgent,
} from '../../src/agents/index.js';
import type { AgentRequest, ExecutionContext } from '../../src/agents/types.js';
import { resetFeatureFlags } from '../../src/core/feature-flags.js';
import { resetHookManager } from '../../src/hooks/hook-manager.js';
import { resetTaskRouter } from '../../src/core/routing.js';

const createContext = (overrides: Partial<ExecutionContext> = {}): ExecutionContext => ({
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
  ...overrides,
});

const createRequest = (
  agentType: string,
  prompt: string,
  context: ExecutionContext
): AgentRequest => ({
  id: `req-${Date.now()}`,
  taskId: 'task-1',
  agentType: agentType as AgentRequest['agentType'],
  prompt,
  context,
});

describe('OrchestratorAgent', () => {
  let agent: OrchestratorAgent;

  beforeEach(() => {
    resetFeatureFlags();
    resetHookManager();
    resetTaskRouter();
    agent = createOrchestratorAgent();
  });

  describe('Metadata', () => {
    it('should have correct metadata', () => {
      expect(agent.metadata.type).toBe('orchestrator');
      expect(agent.metadata.name).toBe('Orchestrator');
      expect(agent.metadata.phase).toBe('mvp');
    });

    it('should have routing capabilities', () => {
      expect(agent.getCapabilities()).toContain('task-routing');
      expect(agent.getCapabilities()).toContain('workflow-coordination');
    });
  });

  describe('Execution', () => {
    it('should route feature request to project manager', async () => {
      const context = createContext();
      const request = createRequest(
        'orchestrator',
        'Build a user authentication system',
        context
      );

      const result = await agent.execute(request);

      expect(result.success).toBe(true);
      expect(result.routingHint?.nextAgent).toBe('project-manager');
    });

    it('should route research request to analyst', async () => {
      const context = createContext();
      const request = createRequest(
        'orchestrator',
        'Research best practices for API design',
        context
      );

      const result = await agent.execute(request);

      expect(result.success).toBe(true);
      expect(result.routingHint?.nextAgent).toBe('analyst');
    });

    it('should include task analysis in output', async () => {
      const context = createContext();
      const request = createRequest(
        'orchestrator',
        'Create a REST API for user management',
        context
      );

      const result = await agent.execute(request);
      const output = result.output as Record<string, unknown>;

      expect(output.taskAnalysis).toBeDefined();
      expect((output.taskAnalysis as Record<string, unknown>).taskType).toBeDefined();
    });

    it('should handle any task type', () => {
      const context = createContext();
      expect(agent.canHandle('feature', context)).toBe(true);
      expect(agent.canHandle('research', context)).toBe(true);
      expect(agent.canHandle('unknown', context)).toBe(true);
    });
  });
});

describe('ProjectManagerAgent', () => {
  let agent: ProjectManagerAgent;

  beforeEach(() => {
    resetFeatureFlags();
    resetHookManager();
    agent = createProjectManagerAgent();
  });

  describe('Metadata', () => {
    it('should have correct metadata', () => {
      expect(agent.metadata.type).toBe('project-manager');
      expect(agent.metadata.name).toBe('Project Manager');
      expect(agent.metadata.phase).toBe('mvp');
    });

    it('should have WBS capabilities', () => {
      expect(agent.getCapabilities()).toContain('wbs-generation');
      expect(agent.getCapabilities()).toContain('task-decomposition');
    });
  });

  describe('WBS Generation', () => {
    it('should generate WBS for feature request', async () => {
      const context = createContext({ currentState: 'PLANNING' });
      const request = createRequest(
        'project-manager',
        'Build a dashboard with user analytics',
        context
      );

      const result = await agent.execute(request);
      const output = result.output as Record<string, unknown>;

      expect(result.success).toBe(true);
      expect(output.wbs).toBeDefined();

      const wbs = output.wbs as { tasks: unknown[]; summary: string };
      expect(wbs.tasks).toBeDefined();
      expect(Array.isArray(wbs.tasks)).toBe(true);
      expect(wbs.tasks.length).toBeGreaterThan(0);
    });

    it('should assign appropriate agents to tasks', async () => {
      const context = createContext({ currentState: 'PLANNING' });
      const request = createRequest(
        'project-manager',
        'Build a REST API with database integration',
        context
      );

      const result = await agent.execute(request);
      const wbs = (result.output as Record<string, unknown>).wbs as {
        tasks: Array<{ assignedAgent: string }>;
      };

      const agentTypes = wbs.tasks.map((t) => t.assignedAgent);
      // Should have backend-related agents
      expect(agentTypes.some((a) => ['architect', 'backend-developer'].includes(a))).toBe(true);
    });

    it('should route to architect after WBS', async () => {
      const context = createContext({ currentState: 'PLANNING' });
      const request = createRequest(
        'project-manager',
        'Build a REST API with database integration for user management',
        context
      );

      const result = await agent.execute(request);

      expect(result.routingHint?.nextAgent).toBe('architect');
    });

    it('should handle feature tasks', () => {
      const context = createContext();
      expect(agent.canHandle('feature', context)).toBe(true);
      expect(agent.canHandle('refactor', context)).toBe(true);
    });
  });
});

describe('ArchitectAgent', () => {
  let agent: ArchitectAgent;

  beforeEach(() => {
    resetFeatureFlags();
    resetHookManager();
    agent = createArchitectAgent();
  });

  describe('Metadata', () => {
    it('should have correct metadata', () => {
      expect(agent.metadata.type).toBe('architect');
      expect(agent.metadata.name).toBe('Software Architect');
      expect(agent.metadata.phase).toBe('mvp');
    });

    it('should have ADR capabilities', () => {
      expect(agent.getCapabilities()).toContain('adr-generation');
      expect(agent.getCapabilities()).toContain('architecture-design');
    });
  });

  describe('ADR Generation', () => {
    it('should generate ADR for database decision', async () => {
      const context = createContext({ currentState: 'DESIGNING' });
      const request = createRequest(
        'architect',
        'Choose a database for user data storage',
        context
      );

      const result = await agent.execute(request);
      const output = result.output as Record<string, unknown>;

      expect(result.success).toBe(true);
      expect(output.adr).toBeDefined();

      const adr = output.adr as { title: string; alternatives: unknown[] };
      expect(adr.title).toContain('Database');
      expect(adr.alternatives.length).toBeGreaterThan(0);
    });

    it('should generate ADR for API decision', async () => {
      const context = createContext({ currentState: 'DESIGNING' });
      const request = createRequest(
        'architect',
        'Design the API architecture for the application',
        context
      );

      const result = await agent.execute(request);
      const adr = (result.output as Record<string, unknown>).adr as { title: string };

      expect(adr.title).toContain('API');
    });

    it('should include architecture recommendations', async () => {
      const context = createContext({ currentState: 'DESIGNING' });
      const request = createRequest(
        'architect',
        'Design authentication system',
        context
      );

      const result = await agent.execute(request);
      const output = result.output as Record<string, unknown>;

      expect(output.architecture).toBeDefined();
      const arch = output.architecture as { recommendations: string[] };
      expect(arch.recommendations.length).toBeGreaterThan(0);
    });

    it('should handle API-only tasks', () => {
      const context = createContext();
      expect(agent.canHandle('api-only', context)).toBe(true);
      expect(agent.canHandle('feature', context)).toBe(true);
    });
  });
});

describe('AnalystAgent', () => {
  let agent: AnalystAgent;

  beforeEach(() => {
    resetFeatureFlags();
    resetHookManager();
    agent = createAnalystAgent();
  });

  describe('Metadata', () => {
    it('should have correct metadata', () => {
      expect(agent.metadata.type).toBe('analyst');
      expect(agent.metadata.name).toBe('Technical Analyst');
      expect(agent.metadata.phase).toBe('mvp');
    });

    it('should have research capabilities', () => {
      expect(agent.getCapabilities()).toContain('research');
      expect(agent.getCapabilities()).toContain('best-practice-analysis');
    });
  });

  describe('Analysis', () => {
    it('should produce analysis for security topic', async () => {
      const context = createContext();
      const request = createRequest(
        'analyst',
        'Analyze authentication best practices',
        context
      );

      const result = await agent.execute(request);
      const output = result.output as Record<string, unknown>;

      expect(result.success).toBe(true);
      expect(output.analysis).toBeDefined();

      const analysis = output.analysis as { findings: Array<{ category: string }> };
      expect(analysis.findings.some((f) => f.category === 'security')).toBe(true);
    });

    it('should include recommendations', async () => {
      const context = createContext();
      const request = createRequest(
        'analyst',
        'Research API design patterns',
        context
      );

      const result = await agent.execute(request);
      const analysis = (result.output as Record<string, unknown>).analysis as {
        recommendations: string[];
      };

      expect(analysis.recommendations.length).toBeGreaterThan(0);
    });

    it('should detect compliance requirements', async () => {
      const context = createContext({
        projectConfig: {
          ...createContext().projectConfig,
          compliance: { frameworks: ['SOC2'], strictMode: true },
        },
      });
      const request = createRequest(
        'analyst',
        'Analyze data storage requirements',
        context
      );

      const result = await agent.execute(request);
      const analysis = (result.output as Record<string, unknown>).analysis as {
        findings: Array<{ category: string; finding: string }>;
      };

      expect(analysis.findings.some((f) => f.category === 'compliance')).toBe(true);
    });

    it('should route to project manager for planning', async () => {
      const context = createContext();
      const request = createRequest(
        'analyst',
        'Research and implement user notifications',
        context
      );

      const result = await agent.execute(request);

      expect(result.routingHint?.nextAgent).toBe('project-manager');
    });

    it('should handle research tasks', () => {
      const context = createContext();
      expect(agent.canHandle('research', context)).toBe(true);
      expect(agent.canHandle('unknown', context)).toBe(true);
    });
  });
});

describe('Agent Factory Functions', () => {
  it('should create orchestrator agent', () => {
    const agent = createOrchestratorAgent();
    expect(agent).toBeInstanceOf(OrchestratorAgent);
  });

  it('should create project manager agent', () => {
    const agent = createProjectManagerAgent();
    expect(agent).toBeInstanceOf(ProjectManagerAgent);
  });

  it('should create architect agent', () => {
    const agent = createArchitectAgent();
    expect(agent).toBeInstanceOf(ArchitectAgent);
  });

  it('should create analyst agent', () => {
    const agent = createAnalystAgent();
    expect(agent).toBeInstanceOf(AnalystAgent);
  });
});
