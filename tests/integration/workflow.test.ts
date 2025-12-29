/**
 * Integration Tests - End-to-End Workflow
 *
 * Tests the complete MVP workflow from task creation to agent execution.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { existsSync, mkdirSync, rmSync } from 'fs';
import { initializeDatabase, closeDatabase } from '../../src/persistence/database.js';
import { getWorkflowEngine, resetWorkflowEngine } from '../../src/core/workflow-engine.js';
import { resetAgentPool } from '../../src/core/agent-pool.js';
import { resetFeatureFlags, setFlagOverride } from '../../src/core/feature-flags.js';
import { resetHookManager } from '../../src/hooks/hook-manager.js';
import { resetTaskRouter, analyzeTask } from '../../src/core/routing.js';
import {
  createOrchestratorAgent,
  createProjectManagerAgent,
  createArchitectAgent,
  createAnalystAgent,
  resetAgentRegistry,
  getAgentRegistry,
} from '../../src/agents/index.js';
import type { ExecutionContext, AgentRequest } from '../../src/agents/types.js';

const TEST_DB_PATH = './test-data/integration-test.sqlite';

function cleanupTestDb(): void {
  if (existsSync(TEST_DB_PATH)) {
    rmSync(TEST_DB_PATH);
  }
  const walPath = TEST_DB_PATH + '-wal';
  const shmPath = TEST_DB_PATH + '-shm';
  if (existsSync(walPath)) rmSync(walPath);
  if (existsSync(shmPath)) rmSync(shmPath);
}

const createContext = (overrides: Partial<ExecutionContext> = {}): ExecutionContext => ({
  taskId: 'integration-task-1',
  projectConfig: {
    name: 'integration-test-project',
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

describe('Integration: MVP Workflow', () => {
  beforeEach(() => {
    // Ensure test directory exists
    if (!existsSync('./test-data')) {
      mkdirSync('./test-data', { recursive: true });
    }
    cleanupTestDb();

    // Reset all singletons
    resetFeatureFlags();
    resetHookManager();
    resetTaskRouter();
    resetWorkflowEngine();
    resetAgentPool();
    resetAgentRegistry();

    // Enable MVP agents
    setFlagOverride('agents.orchestrator', true);
    setFlagOverride('agents.projectmanager', true);
    setFlagOverride('agents.architect', true);
    setFlagOverride('agents.analyst', true);

    // Initialize database
    initializeDatabase(TEST_DB_PATH);
  });

  afterEach(() => {
    closeDatabase();
    cleanupTestDb();
  });

  describe('Task Analysis', () => {
    it('should analyze a feature request correctly', () => {
      const analysis = analyzeTask('Build a user authentication system with login and registration');

      expect(analysis.taskType).toBe('feature');
      expect(analysis.requiredAgents).toContain('orchestrator');
      expect(analysis.requiredAgents).toContain('project-manager');
    });

    it('should analyze a research task correctly', () => {
      const analysis = analyzeTask('Research best practices for API security');

      expect(analysis.taskType).toBe('research');
      expect(analysis.requiredAgents).toContain('analyst');
    });

    it('should analyze a refactoring task correctly', () => {
      const analysis = analyzeTask('Refactor the authentication module to use JWT');

      expect(analysis.taskType).toBe('refactor');
      expect(analysis.requiredAgents).toContain('architect');
    });
  });

  describe('Workflow Engine Integration', () => {
    it('should create and start a task', async () => {
      const engine = getWorkflowEngine();
      const task = engine.createTask('project-1', 'Build a REST API');

      expect(task).toBeDefined();
      expect(task.status).toBe('pending');
      expect(task.state).toBe('IDLE');

      await engine.startTask(task.id);
      const updatedTask = engine.getTask(task.id);

      expect(updatedTask?.status).toBe('running');
      expect(updatedTask?.state).toBe('ANALYZING');
    });

    it('should transition through states correctly', async () => {
      const engine = getWorkflowEngine();
      const task = engine.createTask('project-1', 'Implement user login');

      // Start
      await engine.startTask(task.id);
      expect(engine.getTask(task.id)?.state).toBe('ANALYZING');

      // Transition to orchestrating
      await engine.transitionTo(task.id, 'AGENT_COMPLETE');
      expect(engine.getTask(task.id)?.state).toBe('ORCHESTRATING');
    });

    it('should emit events during workflow', async () => {
      const engine = getWorkflowEngine();
      const events: string[] = [];

      engine.on((event) => {
        events.push(event.type);
      });

      const task = engine.createTask('project-1', 'Test event emission');
      await engine.startTask(task.id);

      expect(events).toContain('TASK_STARTED');
      expect(events).toContain('STATE_CHANGED');
    });
  });

  describe('Agent Execution', () => {
    it('should execute orchestrator agent', async () => {
      const agent = createOrchestratorAgent();
      const context = createContext();
      const request: AgentRequest = {
        id: 'req-1',
        taskId: 'task-1',
        agentType: 'orchestrator',
        prompt: 'Build a dashboard for user analytics',
        context,
      };

      const result = await agent.execute(request);

      expect(result.success).toBe(true);
      expect(result.output).toBeDefined();
      expect(result.routingHint?.nextAgent).toBeDefined();
    });

    it('should execute project manager agent', async () => {
      const agent = createProjectManagerAgent();
      const context = createContext({ currentState: 'PLANNING' });
      const request: AgentRequest = {
        id: 'req-1',
        taskId: 'task-1',
        agentType: 'project-manager',
        prompt: 'Build a REST API with database integration',
        context,
      };

      const result = await agent.execute(request);
      const output = result.output as Record<string, unknown>;

      expect(result.success).toBe(true);
      expect(output.wbs).toBeDefined();
      expect((output.wbs as { tasks: unknown[] }).tasks.length).toBeGreaterThan(0);
    });

    it('should execute architect agent', async () => {
      const agent = createArchitectAgent();
      const context = createContext({ currentState: 'DESIGNING' });
      const request: AgentRequest = {
        id: 'req-1',
        taskId: 'task-1',
        agentType: 'architect',
        prompt: 'Design the database architecture',
        context,
      };

      const result = await agent.execute(request);
      const output = result.output as Record<string, unknown>;

      expect(result.success).toBe(true);
      expect(output.adr).toBeDefined();
      expect(output.architecture).toBeDefined();
    });

    it('should execute analyst agent', async () => {
      const agent = createAnalystAgent();
      const context = createContext();
      const request: AgentRequest = {
        id: 'req-1',
        taskId: 'task-1',
        agentType: 'analyst',
        prompt: 'Research best practices for authentication',
        context,
      };

      const result = await agent.execute(request);
      const output = result.output as Record<string, unknown>;

      expect(result.success).toBe(true);
      expect(output.analysis).toBeDefined();
    });
  });

  describe('Agent Registry Integration', () => {
    it('should register all MVP agents', () => {
      const registry = getAgentRegistry();

      // Registry expects factory functions, not instances
      registry.register(createOrchestratorAgent);
      registry.register(createProjectManagerAgent);
      registry.register(createArchitectAgent);
      registry.register(createAnalystAgent);

      const types = registry.getRegisteredTypes();
      expect(types).toContain('orchestrator');
      expect(types).toContain('project-manager');
      expect(types).toContain('architect');
      expect(types).toContain('analyst');
    });

    it('should get agents by MVP phase', () => {
      const registry = getAgentRegistry();

      // Registry expects factory functions, not instances
      registry.register(createOrchestratorAgent);
      registry.register(createProjectManagerAgent);
      registry.register(createArchitectAgent);
      registry.register(createAnalystAgent);

      const mvpAgents = registry.getByPhase('mvp');
      expect(mvpAgents.length).toBe(4);
    });
  });

  describe('Full Workflow Simulation', () => {
    it('should simulate complete MVP workflow', async () => {
      // 1. Create task
      const engine = getWorkflowEngine();
      const task = engine.createTask('integration-project', 'Build a user management API with authentication');

      // 2. Start workflow
      await engine.startTask(task.id);
      expect(engine.getTask(task.id)?.state).toBe('ANALYZING');

      // 3. Analyze task
      const analysis = analyzeTask(task.prompt);
      expect(analysis.taskType).toBe('feature');

      // 4. Create context for agents
      const context = createContext({
        taskId: task.id,
        currentState: 'ANALYZING',
      });

      // 5. Execute orchestrator
      const orchestrator = createOrchestratorAgent();
      const orchRequest: AgentRequest = {
        id: 'orch-req-1',
        taskId: task.id,
        agentType: 'orchestrator',
        prompt: task.prompt,
        context,
      };

      const orchResult = await orchestrator.execute(orchRequest);
      expect(orchResult.success).toBe(true);

      // 6. Transition to orchestrating
      await engine.transitionTo(task.id, 'AGENT_COMPLETE');
      expect(engine.getTask(task.id)?.state).toBe('ORCHESTRATING');

      // 7. Execute project manager
      const pm = createProjectManagerAgent();
      const pmContext = createContext({
        taskId: task.id,
        currentState: 'PLANNING',
        previousOutputs: new Map([['orchestrator', orchResult]]),
      });
      const pmRequest: AgentRequest = {
        id: 'pm-req-1',
        taskId: task.id,
        agentType: 'project-manager',
        prompt: task.prompt,
        context: pmContext,
      };

      const pmResult = await pm.execute(pmRequest);
      expect(pmResult.success).toBe(true);
      expect((pmResult.output as Record<string, unknown>).wbs).toBeDefined();

      // 8. Execute architect
      const architect = createArchitectAgent();
      const archContext = createContext({
        taskId: task.id,
        currentState: 'DESIGNING',
        previousOutputs: new Map([
          ['orchestrator', orchResult],
          ['project-manager', pmResult],
        ]),
      });
      const archRequest: AgentRequest = {
        id: 'arch-req-1',
        taskId: task.id,
        agentType: 'architect',
        prompt: task.prompt,
        context: archContext,
      };

      const archResult = await architect.execute(archRequest);
      expect(archResult.success).toBe(true);
      expect((archResult.output as Record<string, unknown>).adr).toBeDefined();

      // Verify workflow integrity
      const finalTask = engine.getTask(task.id);
      expect(finalTask).toBeDefined();
      expect(finalTask?.status).toBe('running');
    });
  });
});
