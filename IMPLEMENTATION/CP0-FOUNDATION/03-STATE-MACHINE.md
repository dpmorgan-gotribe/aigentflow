# Step 03: State Machine

> **Checkpoint:** CP0 - Foundation
> **Dependencies:** Step 01, Step 02
> **Estimated Effort:** 4-5 hours

---

## Objective

Implement the StateGraph-based workflow state machine that manages orchestration flow, handles state transitions, and enables recovery from failures.

---

## Deliverables

- [ ] WorkflowState enum with all states
- [ ] StateGraph class with transition logic
- [ ] State persistence and recovery
- [ ] Checkpoint creation and restoration
- [ ] Error state handling
- [ ] Event emission for state changes

---

## Workflow States

### Key Principle: Intelligent Routing, Not Linear Pipeline

The Orchestrator is an **AI that thinks**, not a task queue. It:
- Analyzes each task to determine which agents are needed
- Routes dynamically based on task type and agent outputs
- Skips unnecessary agents (e.g., no UI Designer for backend-only tasks)
- Returns to ORCHESTRATING after each agent completes to decide next step

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    INTELLIGENT ORCHESTRATION STATE MACHINE                   │
└─────────────────────────────────────────────────────────────────────────────┘

                              ┌─────────┐
                              │  IDLE   │
                              └────┬────┘
                                   │ run(prompt)
                                   ▼
                           ┌──────────────┐
                           │  ANALYZING   │  Orchestrator analyzes prompt
                           └──────┬───────┘  to determine task type & needs
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                              │
│                          ┌─────────────────┐                                │
│              ┌──────────▶│  ORCHESTRATING  │◀──────────┐                   │
│              │           └────────┬────────┘           │                   │
│              │                    │                    │                   │
│              │    Orchestrator decides next agent      │                   │
│              │    based on:                            │                   │
│              │    • Task requirements                  │                   │
│              │    • Previous agent outputs             │                   │
│              │    • Routing hints from agents          │                   │
│              │                    │                    │                   │
│              │                    ▼                    │                   │
│              │    ┌───────────────────────────────┐    │                   │
│              │    │      ROUTE TO AGENT           │    │                   │
│              │    │  (intelligent selection)      │    │                   │
│              │    └───────────────┬───────────────┘    │                   │
│              │                    │                    │                   │
│   ┌──────────┼────────────────────┼────────────────────┼──────────┐       │
│   │          │                    │                    │          │       │
│   ▼          ▼                    ▼                    ▼          ▼       │
│ ┌──────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────┐  │
│ │PLAN  │ │ARCHITECT │ │ DESIGN   │ │  BUILD   │ │  TEST    │ │ REVIEW │  │
│ │      │ │          │ │          │ │          │ │          │ │        │  │
│ └──┬───┘ └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘ └───┬────┘  │
│    │          │            │            │            │           │       │
│    │          │            │            │            │           │       │
│    └──────────┴────────────┴────────────┴────────────┴───────────┘       │
│                                   │                                       │
│                                   │ Agent returns structured output       │
│                                   │ with routing_hints                    │
│                                   │                                       │
│                                   ▼                                       │
│                          ┌─────────────────┐                              │
│                          │ AGENT_COMPLETE  │                              │
│                          └────────┬────────┘                              │
│                                   │                                       │
│              ┌────────────────────┼────────────────────┐                  │
│              │                    │                    │                  │
│              ▼                    ▼                    ▼                  │
│     ┌─────────────┐      ┌──────────────┐     ┌──────────────┐           │
│     │NEEDS_ANOTHER│      │NEEDS_APPROVAL│     │  ALL_DONE    │           │
│     │   AGENT     │      │              │     │              │           │
│     └──────┬──────┘      └──────┬───────┘     └──────┬───────┘           │
│            │                    │                    │                    │
│            │                    ▼                    │                    │
│            │           ┌──────────────┐              │                    │
│            │           │  AWAITING    │              │                    │
│            │           │  APPROVAL    │              │                    │
│            │           └──────┬───────┘              │                    │
│            │                  │                      │                    │
│            │         ┌───────┴───────┐              │                    │
│            │         │               │              │                    │
│            │         ▼               ▼              │                    │
│            │    ┌────────┐     ┌──────────┐         │                    │
│            │    │APPROVED│     │ REJECTED │         │                    │
│            │    └───┬────┘     └────┬─────┘         │                    │
│            │        │               │               │                    │
│            └────────┴───────────────┴───────────────┘                    │
│                            │                                              │
│                            │ Back to ORCHESTRATING                        │
└────────────────────────────┼──────────────────────────────────────────────┘
                             │
                             ▼
                      ┌──────────────┐
                      │  COMPLETING  │
                      └──────┬───────┘
                             │
                             ▼
                      ┌──────────────┐
                      │  COMPLETED   │
                      └──────────────┘

Special flows:
─── TEST_FAIL ───▶ FIXING ───▶ back to TEST (max 3 retries, then ESCALATED)
─── ERROR ───▶ Any state can transition to ERROR
─── ABORT ───▶ Any state can transition to ABORTED
```

### Routing Decision Examples

| Task Type | Agents Spawned | Agents Skipped |
|-----------|----------------|----------------|
| "Add login page" | Planner → Architect → Designer → FE Dev → BE Dev → Tester → Reviewer | - |
| "Fix null pointer bug" | Analyzer → Bug Fixer → Tester | Planner, Architect, Designer |
| "Add API endpoint" | Planner → BE Dev → Tester → Reviewer | Architect, Designer, FE Dev |
| "Refactor utils" | Analyzer → Developer → Tester → Reviewer | Planner, Architect, Designer |
| "Update button color" | Designer → FE Dev → Tester | Planner, Architect, BE Dev |

---

## Implementation Guide

### 1. Define workflow states

```typescript
// src/core/states.ts

export enum WorkflowState {
  // Initial states
  IDLE = 'IDLE',
  ANALYZING = 'ANALYZING',

  // Core orchestration state - the "thinking" hub
  ORCHESTRATING = 'ORCHESTRATING',

  // Agent execution states (entered when an agent is working)
  AGENT_WORKING = 'AGENT_WORKING',
  AGENT_COMPLETE = 'AGENT_COMPLETE',

  // Approval gates
  AWAITING_APPROVAL = 'AWAITING_APPROVAL',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',

  // Test-specific states (for fix loops)
  TESTING = 'TESTING',
  TESTS_PASS = 'TESTS_PASS',
  TESTS_FAIL = 'TESTS_FAIL',
  FIXING = 'FIXING',
  ESCALATED = 'ESCALATED',

  // Completion
  COMPLETING = 'COMPLETING',
  COMPLETED = 'COMPLETED',

  // Error states
  ERROR = 'ERROR',
  ABORTED = 'ABORTED',

  // Recovery
  RECOVERING = 'RECOVERING',
}

// Agent types that can be routed to
export enum AgentType {
  PROJECT_MANAGER = 'project_manager',
  ARCHITECT = 'architect',
  ANALYST = 'analyst',
  UI_DESIGNER = 'ui_designer',
  GIT_AGENT = 'git_agent',
  FRONTEND_DEVELOPER = 'frontend_developer',
  BACKEND_DEVELOPER = 'backend_developer',
  TESTER = 'tester',
  BUG_FIXER = 'bug_fixer',
  MERGE_RESOLVER = 'merge_resolver',
  REVIEWER = 'reviewer',
  PROJECT_ANALYZER = 'project_analyzer',
  COMPLIANCE_AGENT = 'compliance_agent',
}

export interface StateContext {
  projectId: string;
  taskId: string;
  prompt: string;

  // Intelligent routing context
  taskAnalysis?: TaskAnalysis;
  currentAgent?: AgentType;
  agentQueue: AgentType[];           // Remaining agents to invoke
  completedAgents: AgentType[];      // Agents that have completed
  agentOutputs: Map<AgentType, AgentOutput>;  // Outputs from each agent

  // Agent pool context (max 15 concurrent agents)
  activeAgents: ActiveAgent[];       // Currently running agents
  maxConcurrentAgents: number;       // Pool limit (default: 15)
  epicContext?: EpicContext;         // For multi-feature epics

  // Standard context
  error?: Error;
  retryCount: number;
  maxRetries: number;
  checkpoints: Checkpoint[];
  metadata: Record<string, unknown>;
}

// ═══════════════════════════════════════════════════════════════════════════
// AGENT POOL MANAGEMENT (Max 15 Concurrent Agents)
// ═══════════════════════════════════════════════════════════════════════════

export interface ActiveAgent {
  id: string;
  type: AgentType;
  featureId?: string;           // Which feature this agent is working on
  phase: AgentPhase;
  startedAt: string;
  status: 'running' | 'completed' | 'failed';
}

export enum AgentPhase {
  PLANNING = 'planning',
  DESIGN_COMPETITION = 'design_competition',
  DEVELOPMENT = 'development',
  TESTING = 'testing',
  FIXING = 'fixing',
  REVIEW = 'review',
}

export interface EpicContext {
  epicId: string;
  features: FeatureContext[];
  parallelFeatures: number;     // How many features to work on in parallel
}

export interface FeatureContext {
  featureId: string;
  name: string;
  status: 'pending' | 'planning' | 'designing' | 'developing' | 'testing' | 'reviewing' | 'completed';
  worktreePath?: string;
  assignedAgents: string[];     // Agent IDs working on this feature
}

export interface TaskAnalysis {
  taskType: 'feature' | 'bugfix' | 'refactor' | 'docs' | 'config' | 'test';
  complexity: 'trivial' | 'simple' | 'moderate' | 'complex';
  requiresUI: boolean;
  requiresBackend: boolean;
  requiresArchitecture: boolean;
  requiresApproval: boolean;
  suggestedAgents: AgentType[];
}

export interface AgentOutput {
  agent: AgentType;
  success: boolean;
  output: unknown;
  routingHints: RoutingHints;
  timestamp: string;
}

export interface RoutingHints {
  suggestNext?: AgentType[];
  needsApproval?: boolean;
  needsUserInput?: boolean;
  hasFailures?: boolean;
  isComplete?: boolean;
}

export interface Checkpoint {
  id: string;
  state: WorkflowState;
  timestamp: string;
  context: Partial<StateContext>;
  artifacts: string[];
}

export interface StateTransition {
  from: WorkflowState;
  to: WorkflowState;
  event: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}
```

### 2. Define valid transitions

```typescript
// src/core/transitions.ts

import { WorkflowState, StateContext, AgentType } from './states';

export interface TransitionRule {
  from: WorkflowState | WorkflowState[];
  to: WorkflowState;
  event: string;
  guard?: (context: StateContext) => boolean;
  action?: (context: StateContext) => Promise<void>;
}

export const TRANSITION_RULES: TransitionRule[] = [
  // ═══════════════════════════════════════════════════════════════════
  // STARTUP FLOW
  // ═══════════════════════════════════════════════════════════════════

  // Start workflow - analyze the prompt
  {
    from: WorkflowState.IDLE,
    to: WorkflowState.ANALYZING,
    event: 'START',
  },

  // Analysis complete - move to orchestration
  {
    from: WorkflowState.ANALYZING,
    to: WorkflowState.ORCHESTRATING,
    event: 'ANALYSIS_COMPLETE',
    action: async (ctx) => {
      // TaskAnalysis determines which agents are needed
      // This is populated by the analysis phase
    },
  },

  // ═══════════════════════════════════════════════════════════════════
  // INTELLIGENT ROUTING (Hub and Spoke Model)
  // ═══════════════════════════════════════════════════════════════════

  // Orchestrator decides to spawn an agent
  {
    from: WorkflowState.ORCHESTRATING,
    to: WorkflowState.AGENT_WORKING,
    event: 'SPAWN_AGENT',
    guard: (ctx) => ctx.agentQueue.length > 0 || ctx.taskAnalysis?.suggestedAgents.length > 0,
  },

  // Agent completes its work
  {
    from: WorkflowState.AGENT_WORKING,
    to: WorkflowState.AGENT_COMPLETE,
    event: 'AGENT_DONE',
  },

  // After agent completion - return to orchestrator for next decision
  {
    from: WorkflowState.AGENT_COMPLETE,
    to: WorkflowState.ORCHESTRATING,
    event: 'ROUTE_NEXT',
    guard: (ctx) => {
      const lastOutput = ctx.agentOutputs.get(ctx.currentAgent!);
      return !lastOutput?.routingHints.isComplete && !lastOutput?.routingHints.needsApproval;
    },
  },

  // After agent completion - needs user approval
  {
    from: WorkflowState.AGENT_COMPLETE,
    to: WorkflowState.AWAITING_APPROVAL,
    event: 'NEEDS_APPROVAL',
    guard: (ctx) => {
      const lastOutput = ctx.agentOutputs.get(ctx.currentAgent!);
      return lastOutput?.routingHints.needsApproval === true;
    },
  },

  // After agent completion - all done
  {
    from: WorkflowState.AGENT_COMPLETE,
    to: WorkflowState.COMPLETING,
    event: 'ALL_COMPLETE',
    guard: (ctx) => {
      const lastOutput = ctx.agentOutputs.get(ctx.currentAgent!);
      return lastOutput?.routingHints.isComplete === true;
    },
  },

  // ═══════════════════════════════════════════════════════════════════
  // APPROVAL FLOW
  // ═══════════════════════════════════════════════════════════════════

  // User approves
  {
    from: WorkflowState.AWAITING_APPROVAL,
    to: WorkflowState.APPROVED,
    event: 'APPROVE',
  },

  // User rejects
  {
    from: WorkflowState.AWAITING_APPROVAL,
    to: WorkflowState.REJECTED,
    event: 'REJECT',
  },

  // After approval/rejection - back to orchestrator to decide next
  {
    from: [WorkflowState.APPROVED, WorkflowState.REJECTED],
    to: WorkflowState.ORCHESTRATING,
    event: 'CONTINUE',
  },

  // ═══════════════════════════════════════════════════════════════════
  // TEST/FIX LOOP (Special handling for test failures)
  // ═══════════════════════════════════════════════════════════════════

  // Tester agent reports - goes to specialized testing state
  {
    from: WorkflowState.AGENT_COMPLETE,
    to: WorkflowState.TESTING,
    event: 'ENTER_TEST_PHASE',
    guard: (ctx) => ctx.currentAgent === AgentType.TESTER,
  },

  // Testing outcomes
  {
    from: WorkflowState.TESTING,
    to: WorkflowState.TESTS_PASS,
    event: 'ALL_TESTS_PASS',
  },
  {
    from: WorkflowState.TESTING,
    to: WorkflowState.TESTS_FAIL,
    event: 'TESTS_FAILED',
  },

  // Tests passed - back to orchestrator for next decision
  {
    from: WorkflowState.TESTS_PASS,
    to: WorkflowState.ORCHESTRATING,
    event: 'TESTS_PASSED_CONTINUE',
  },

  // Test fail - attempt fix (if under retry limit)
  {
    from: WorkflowState.TESTS_FAIL,
    to: WorkflowState.FIXING,
    event: 'START_FIX',
    guard: (ctx) => ctx.retryCount < ctx.maxRetries,
  },

  // Test fail - escalate (max retries exceeded)
  {
    from: WorkflowState.TESTS_FAIL,
    to: WorkflowState.ESCALATED,
    event: 'MAX_RETRIES_EXCEEDED',
    guard: (ctx) => ctx.retryCount >= ctx.maxRetries,
  },

  // Fix complete - back to testing
  {
    from: WorkflowState.FIXING,
    to: WorkflowState.TESTING,
    event: 'FIX_COMPLETE',
  },

  // ═══════════════════════════════════════════════════════════════════
  // COMPLETION FLOW
  // ═══════════════════════════════════════════════════════════════════

  // Orchestrator determines all work is complete
  {
    from: WorkflowState.ORCHESTRATING,
    to: WorkflowState.COMPLETING,
    event: 'WORKFLOW_COMPLETE',
    guard: (ctx) => ctx.agentQueue.length === 0,
  },

  // Completing to completed
  {
    from: WorkflowState.COMPLETING,
    to: WorkflowState.COMPLETED,
    event: 'FINALIZE',
  },

  // Global error transition (from any state)
  {
    from: Object.values(WorkflowState).filter(
      (s) => s !== WorkflowState.ERROR && s !== WorkflowState.ABORTED
    ),
    to: WorkflowState.ERROR,
    event: 'ERROR',
  },

  // Global abort transition (from any state)
  {
    from: Object.values(WorkflowState).filter(
      (s) => s !== WorkflowState.ABORTED && s !== WorkflowState.COMPLETED
    ),
    to: WorkflowState.ABORTED,
    event: 'ABORT',
  },

  // Recovery from error
  {
    from: WorkflowState.ERROR,
    to: WorkflowState.RECOVERING,
    event: 'START_RECOVERY',
  },

  // Recovery can go to any checkpoint state
  {
    from: WorkflowState.RECOVERING,
    to: WorkflowState.IDLE, // Will be overridden by checkpoint state
    event: 'RESTORE_CHECKPOINT',
  },
];
```

### 2.1 Intelligent Routing Decision Logic

The Orchestrator uses AI reasoning to determine which agent to spawn next:

```typescript
// src/core/router.ts

import { StateContext, AgentType, TaskAnalysis, RoutingHints } from './states';
import { Anthropic } from '@anthropic-ai/sdk';

export class IntelligentRouter {
  private client: Anthropic;

  constructor() {
    this.client = new Anthropic();
  }

  /**
   * Analyze prompt to determine task type and required agents
   */
  async analyzeTask(prompt: string, projectContext: ProjectContext): Promise<TaskAnalysis> {
    const response = await this.client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      messages: [{
        role: 'user',
        content: `Analyze this development task and determine requirements:

Task: "${prompt}"

Project context:
- Tech stack: ${projectContext.techStack.join(', ')}
- Has existing UI: ${projectContext.hasUI}
- Has existing backend: ${projectContext.hasBackend}

Respond in JSON:
{
  "taskType": "feature" | "bugfix" | "refactor" | "docs" | "config" | "test",
  "complexity": "trivial" | "simple" | "moderate" | "complex",
  "requiresUI": boolean,
  "requiresBackend": boolean,
  "requiresArchitecture": boolean,
  "requiresApproval": boolean,
  "suggestedAgents": ["agent_type", ...]
}`,
      }],
    });

    return JSON.parse(response.content[0].text);
  }

  /**
   * Determine next agent based on current context
   */
  async decideNextAgent(context: StateContext): Promise<AgentType | null> {
    // 1. If agents queued, take from queue
    if (context.agentQueue.length > 0) {
      return context.agentQueue.shift()!;
    }

    // 2. Check routing hints from last agent
    const lastOutput = context.currentAgent
      ? context.agentOutputs.get(context.currentAgent)
      : null;

    if (lastOutput?.routingHints.suggestNext?.length) {
      const suggested = lastOutput.routingHints.suggestNext[0];
      if (!context.completedAgents.includes(suggested)) {
        return suggested;
      }
    }

    // 3. Use AI reasoning for ambiguous cases
    if (this.needsAIDecision(context)) {
      return this.aiDecideNextAgent(context);
    }

    // 4. No more agents needed
    return null;
  }

  /**
   * Build initial agent queue based on task analysis
   */
  buildAgentQueue(analysis: TaskAnalysis): AgentType[] {
    const queue: AgentType[] = [];

    // Planning (for complex features)
    if (analysis.complexity === 'complex' || analysis.complexity === 'moderate') {
      queue.push(AgentType.PROJECT_MANAGER);
    }

    // Architecture (for new features or significant changes)
    if (analysis.requiresArchitecture) {
      queue.push(AgentType.ARCHITECT);
    }

    // UI Design (only if UI work needed)
    if (analysis.requiresUI && analysis.taskType !== 'bugfix') {
      queue.push(AgentType.UI_DESIGNER);
    }

    // Development (based on what's needed)
    if (analysis.requiresUI) {
      queue.push(AgentType.FRONTEND_DEVELOPER);
    }
    if (analysis.requiresBackend) {
      queue.push(AgentType.BACKEND_DEVELOPER);
    }

    // For bugfixes, use bug fixer directly
    if (analysis.taskType === 'bugfix') {
      queue.length = 0; // Clear queue
      queue.push(AgentType.BUG_FIXER);
    }

    // Always test and review
    queue.push(AgentType.TESTER);
    queue.push(AgentType.REVIEWER);

    return queue;
  }

  private needsAIDecision(context: StateContext): boolean {
    // Use AI when:
    // - Multiple agents could be next
    // - Failure analysis needed
    // - Ambiguous requirements
    return false; // Implement based on specific conditions
  }

  private async aiDecideNextAgent(context: StateContext): Promise<AgentType | null> {
    // Use Claude to reason about next agent
    // This is for complex/ambiguous situations
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// AGENT POOL MANAGER (Maximum 15 Concurrent Agents)
// ═══════════════════════════════════════════════════════════════════════════
//
// The orchestrator aggressively maximizes parallelism:
// • Epic with 5 features → 5 planners in parallel
// • Initial mockup → 15 designers create competing designs
// • Development phase → FE+BE per feature, multiple features in parallel
//
// ═══════════════════════════════════════════════════════════════════════════

export const MAX_CONCURRENT_AGENTS = 15;

export interface AgentPoolConfig {
  maxConcurrent: number;
  competitiveDesignCount: number;  // How many designers for competitive phase
  maxAgentsPerFeature: number;     // Limit agents per single feature
}

export const DEFAULT_POOL_CONFIG: AgentPoolConfig = {
  maxConcurrent: 15,
  competitiveDesignCount: 15,      // All 15 agents for initial design competition
  maxAgentsPerFeature: 4,          // FE + BE + Tester + Bug Fixer max per feature
};

export interface SpawnRequest {
  agentType: AgentType;
  featureId?: string;
  phase: AgentPhase;
  priority: 'high' | 'normal' | 'low';
  context: Record<string, unknown>;
}

export interface SpawnResult {
  spawned: boolean;
  agentId?: string;
  reason?: string;  // If not spawned, why
}

export class AgentPoolManager {
  private config: AgentPoolConfig;
  private activeAgents: Map<string, ActiveAgent> = new Map();
  private pendingQueue: SpawnRequest[] = [];

  constructor(config: Partial<AgentPoolConfig> = {}) {
    this.config = { ...DEFAULT_POOL_CONFIG, ...config };
  }

  /**
   * Get current pool utilization
   */
  getUtilization(): { active: number; available: number; max: number } {
    const active = this.activeAgents.size;
    return {
      active,
      available: this.config.maxConcurrent - active,
      max: this.config.maxConcurrent,
    };
  }

  /**
   * Check if we can spawn more agents
   */
  canSpawn(count: number = 1): boolean {
    return this.activeAgents.size + count <= this.config.maxConcurrent;
  }

  /**
   * Spawn a single agent if pool has capacity
   */
  async spawn(request: SpawnRequest): Promise<SpawnResult> {
    if (!this.canSpawn()) {
      this.pendingQueue.push(request);
      return { spawned: false, reason: 'Pool at capacity, queued for later' };
    }

    const agentId = `agent-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const agent: ActiveAgent = {
      id: agentId,
      type: request.agentType,
      featureId: request.featureId,
      phase: request.phase,
      startedAt: new Date().toISOString(),
      status: 'running',
    };

    this.activeAgents.set(agentId, agent);
    return { spawned: true, agentId };
  }

  /**
   * Spawn multiple agents in parallel (up to pool capacity)
   */
  async spawnBatch(requests: SpawnRequest[]): Promise<SpawnResult[]> {
    const results: SpawnResult[] = [];
    const available = this.config.maxConcurrent - this.activeAgents.size;

    // Sort by priority (high first)
    const sorted = [...requests].sort((a, b) => {
      const priority = { high: 0, normal: 1, low: 2 };
      return priority[a.priority] - priority[b.priority];
    });

    for (let i = 0; i < sorted.length; i++) {
      if (i < available) {
        results.push(await this.spawn(sorted[i]));
      } else {
        this.pendingQueue.push(sorted[i]);
        results.push({ spawned: false, reason: 'Pool at capacity, queued' });
      }
    }

    return results;
  }

  /**
   * Mark an agent as completed and process pending queue
   */
  async complete(agentId: string): Promise<SpawnResult | null> {
    const agent = this.activeAgents.get(agentId);
    if (agent) {
      agent.status = 'completed';
      this.activeAgents.delete(agentId);
    }

    // Process pending queue if we have capacity
    if (this.pendingQueue.length > 0 && this.canSpawn()) {
      const next = this.pendingQueue.shift()!;
      return this.spawn(next);
    }

    return null;
  }

  /**
   * Mark an agent as failed
   */
  fail(agentId: string, error: Error): void {
    const agent = this.activeAgents.get(agentId);
    if (agent) {
      agent.status = 'failed';
      this.activeAgents.delete(agentId);
    }
  }

  /**
   * Get all active agents for a specific feature
   */
  getAgentsForFeature(featureId: string): ActiveAgent[] {
    return Array.from(this.activeAgents.values()).filter(
      (a) => a.featureId === featureId
    );
  }

  /**
   * Get all active agents in a specific phase
   */
  getAgentsInPhase(phase: AgentPhase): ActiveAgent[] {
    return Array.from(this.activeAgents.values()).filter(
      (a) => a.phase === phase
    );
  }

  /**
   * Wait for all agents in a specific phase to complete
   */
  async waitForPhase(phase: AgentPhase): Promise<void> {
    // Implementation would use event emitters or polling
    // to wait for all agents in the phase to complete
  }

  // ═══════════════════════════════════════════════════════════════════════
  // COMPETITIVE DESIGN GENERATION
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Spawn competitive design generation (up to 15 designers)
   * Each designer creates an independent mockup for the same requirement
   * User then selects the best design to proceed with
   */
  async spawnCompetitiveDesign(
    requirement: string,
    designContext: Record<string, unknown>
  ): Promise<{ agentIds: string[]; expectedOutputs: number }> {
    const designerCount = Math.min(
      this.config.competitiveDesignCount,
      this.config.maxConcurrent - this.activeAgents.size
    );

    const requests: SpawnRequest[] = Array(designerCount)
      .fill(null)
      .map((_, index) => ({
        agentType: AgentType.UI_DESIGNER,
        phase: AgentPhase.DESIGN_COMPETITION,
        priority: 'high' as const,
        context: {
          ...designContext,
          requirement,
          designVariant: index + 1,
          totalVariants: designerCount,
          competitionMode: true,
        },
      }));

    const results = await this.spawnBatch(requests);
    const agentIds = results
      .filter((r) => r.spawned && r.agentId)
      .map((r) => r.agentId!);

    return {
      agentIds,
      expectedOutputs: agentIds.length,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════
  // EPIC-LEVEL PARALLELISM
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Spawn planners for all features in an epic (in parallel)
   * Example: Epic with 5 features → 5 planners running simultaneously
   */
  async spawnEpicPlanners(epic: EpicContext): Promise<SpawnResult[]> {
    const pendingFeatures = epic.features.filter(
      (f) => f.status === 'pending'
    );

    // Calculate how many planners we can spawn
    const maxPlanners = Math.min(
      pendingFeatures.length,
      this.config.maxConcurrent - this.activeAgents.size,
      epic.parallelFeatures
    );

    const requests: SpawnRequest[] = pendingFeatures
      .slice(0, maxPlanners)
      .map((feature) => ({
        agentType: AgentType.PROJECT_MANAGER,
        featureId: feature.featureId,
        phase: AgentPhase.PLANNING,
        priority: 'high' as const,
        context: {
          featureName: feature.name,
          epicId: epic.epicId,
        },
      }));

    return this.spawnBatch(requests);
  }

  /**
   * Spawn development agents across multiple features
   * Maximizes pool utilization across parallel feature development
   */
  async spawnDevelopmentWave(
    features: FeatureContext[],
    needsFrontend: boolean[],
    needsBackend: boolean[]
  ): Promise<Map<string, SpawnResult[]>> {
    const results = new Map<string, SpawnResult[]>();
    let remaining = this.config.maxConcurrent - this.activeAgents.size;

    for (let i = 0; i < features.length && remaining > 0; i++) {
      const feature = features[i];
      const featureResults: SpawnResult[] = [];

      // Spawn FE and BE in parallel for each feature
      if (needsFrontend[i] && remaining > 0) {
        const feResult = await this.spawn({
          agentType: AgentType.FRONTEND_DEVELOPER,
          featureId: feature.featureId,
          phase: AgentPhase.DEVELOPMENT,
          priority: 'normal',
          context: { featureName: feature.name },
        });
        featureResults.push(feResult);
        if (feResult.spawned) remaining--;
      }

      if (needsBackend[i] && remaining > 0) {
        const beResult = await this.spawn({
          agentType: AgentType.BACKEND_DEVELOPER,
          featureId: feature.featureId,
          phase: AgentPhase.DEVELOPMENT,
          priority: 'normal',
          context: { featureName: feature.name },
        });
        featureResults.push(beResult);
        if (beResult.spawned) remaining--;
      }

      results.set(feature.featureId, featureResults);
    }

    return results;
  }

  /**
   * Get current pool status for display
   */
  getStatus(): {
    utilization: { active: number; available: number; max: number };
    byPhase: Record<AgentPhase, number>;
    byFeature: Record<string, number>;
    pending: number;
  } {
    const agents = Array.from(this.activeAgents.values());

    const byPhase: Record<AgentPhase, number> = {
      [AgentPhase.PLANNING]: 0,
      [AgentPhase.DESIGN_COMPETITION]: 0,
      [AgentPhase.DEVELOPMENT]: 0,
      [AgentPhase.TESTING]: 0,
      [AgentPhase.FIXING]: 0,
      [AgentPhase.REVIEW]: 0,
    };

    const byFeature: Record<string, number> = {};

    for (const agent of agents) {
      byPhase[agent.phase]++;
      if (agent.featureId) {
        byFeature[agent.featureId] = (byFeature[agent.featureId] || 0) + 1;
      }
    }

    return {
      utilization: this.getUtilization(),
      byPhase,
      byFeature,
      pending: this.pendingQueue.length,
    };
  }
}
```

### 3. Implement StateGraph class

```typescript
// src/core/state-machine.ts

import { EventEmitter } from 'events';
import { v4 as uuid } from 'uuid';
import { WorkflowState, StateContext, Checkpoint, StateTransition } from './states';
import { TRANSITION_RULES, TransitionRule } from './transitions';
import { StateStore } from '../persistence/state-store';
import { logger } from '../utils/logger';

export interface StateGraphOptions {
  projectId: string;
  stateStore: StateStore;
  maxRetries?: number;
  maxConcurrentAgents?: number;  // Default: 15
}

export class StateGraph extends EventEmitter {
  private state: WorkflowState = WorkflowState.IDLE;
  private context: StateContext;
  private stateStore: StateStore;
  private transitionHistory: StateTransition[] = [];

  constructor(options: StateGraphOptions) {
    super();

    this.stateStore = options.stateStore;

    this.context = {
      projectId: options.projectId,
      taskId: uuid(),
      prompt: '',

      // Intelligent routing context
      taskAnalysis: undefined,
      currentAgent: undefined,
      agentQueue: [],
      completedAgents: [],
      agentOutputs: new Map(),

      // Agent pool context (max 15 concurrent agents)
      activeAgents: [],
      maxConcurrentAgents: options.maxConcurrentAgents ?? MAX_CONCURRENT_AGENTS,
      epicContext: undefined,

      // Standard context
      retryCount: 0,
      maxRetries: options.maxRetries ?? 3,
      checkpoints: [],
      metadata: {},
    };
  }

  /**
   * Get current state
   */
  getState(): WorkflowState {
    return this.state;
  }

  /**
   * Get current context
   */
  getContext(): StateContext {
    return { ...this.context };
  }

  /**
   * Get transition history
   */
  getHistory(): StateTransition[] {
    return [...this.transitionHistory];
  }

  /**
   * Attempt a state transition
   */
  async transition(event: string, metadata?: Record<string, unknown>): Promise<boolean> {
    const rule = this.findTransitionRule(event);

    if (!rule) {
      logger.warn(`No transition rule for event '${event}' from state '${this.state}'`);
      return false;
    }

    // Check guard condition
    if (rule.guard && !rule.guard(this.context)) {
      logger.debug(`Guard blocked transition for event '${event}'`);
      return false;
    }

    const fromState = this.state;
    const toState = rule.to;

    // Execute action if defined
    if (rule.action) {
      try {
        await rule.action(this.context);
      } catch (error) {
        logger.error(`Action failed for transition: ${error}`);
        await this.transition('ERROR', { error });
        return false;
      }
    }

    // Perform transition
    this.state = toState;

    // Record transition
    const transition: StateTransition = {
      from: fromState,
      to: toState,
      event,
      timestamp: new Date().toISOString(),
      metadata,
    };

    this.transitionHistory.push(transition);

    // Persist state
    await this.persistState();

    // Emit events
    this.emit('transition', transition);
    this.emit(`state:${toState}`, this.context);

    logger.debug(`Transition: ${fromState} -> ${toState} (${event})`);

    return true;
  }

  /**
   * Find valid transition rule for event
   */
  private findTransitionRule(event: string): TransitionRule | undefined {
    return TRANSITION_RULES.find((rule) => {
      const fromStates = Array.isArray(rule.from) ? rule.from : [rule.from];
      return fromStates.includes(this.state) && rule.event === event;
    });
  }

  /**
   * Check if transition is valid
   */
  canTransition(event: string): boolean {
    const rule = this.findTransitionRule(event);
    if (!rule) return false;
    if (rule.guard && !rule.guard(this.context)) return false;
    return true;
  }

  /**
   * Get valid next events from current state
   */
  getValidEvents(): string[] {
    return TRANSITION_RULES.filter((rule) => {
      const fromStates = Array.isArray(rule.from) ? rule.from : [rule.from];
      return fromStates.includes(this.state);
    })
      .filter((rule) => !rule.guard || rule.guard(this.context))
      .map((rule) => rule.event);
  }

  /**
   * Create a checkpoint at current state
   */
  async createCheckpoint(artifacts: string[] = []): Promise<Checkpoint> {
    const checkpoint: Checkpoint = {
      id: uuid(),
      state: this.state,
      timestamp: new Date().toISOString(),
      context: {
        prompt: this.context.prompt,
        currentAgent: this.context.currentAgent,
        retryCount: this.context.retryCount,
        metadata: { ...this.context.metadata },
      },
      artifacts,
    };

    this.context.checkpoints.push(checkpoint);
    await this.persistState();

    this.emit('checkpoint', checkpoint);
    logger.info(`Checkpoint created: ${checkpoint.id} at state ${checkpoint.state}`);

    return checkpoint;
  }

  /**
   * Restore from checkpoint
   */
  async restoreCheckpoint(checkpointId: string): Promise<boolean> {
    const checkpoint = this.context.checkpoints.find((cp) => cp.id === checkpointId);

    if (!checkpoint) {
      logger.error(`Checkpoint not found: ${checkpointId}`);
      return false;
    }

    // Must be in RECOVERING state to restore
    if (this.state !== WorkflowState.RECOVERING) {
      await this.transition('START_RECOVERY');
    }

    // Restore state and context
    this.state = checkpoint.state;
    Object.assign(this.context, checkpoint.context);

    // Record recovery transition
    const transition: StateTransition = {
      from: WorkflowState.RECOVERING,
      to: checkpoint.state,
      event: 'RESTORE_CHECKPOINT',
      timestamp: new Date().toISOString(),
      metadata: { checkpointId },
    };

    this.transitionHistory.push(transition);
    await this.persistState();

    this.emit('restore', checkpoint);
    logger.info(`Restored checkpoint: ${checkpointId} to state ${checkpoint.state}`);

    return true;
  }

  /**
   * Get latest checkpoint
   */
  getLatestCheckpoint(): Checkpoint | undefined {
    return this.context.checkpoints[this.context.checkpoints.length - 1];
  }

  /**
   * Update context
   */
  updateContext(updates: Partial<StateContext>): void {
    Object.assign(this.context, updates);
  }

  /**
   * Increment retry count
   */
  incrementRetry(): number {
    this.context.retryCount++;
    return this.context.retryCount;
  }

  /**
   * Reset retry count
   */
  resetRetries(): void {
    this.context.retryCount = 0;
  }

  /**
   * Persist current state to storage
   */
  private async persistState(): Promise<void> {
    await this.stateStore.saveState({
      projectId: this.context.projectId,
      taskId: this.context.taskId,
      state: this.state,
      context: this.context,
      history: this.transitionHistory,
    });
  }

  /**
   * Load state from storage
   */
  async loadState(taskId: string): Promise<boolean> {
    const saved = await this.stateStore.loadState(taskId);

    if (!saved) {
      return false;
    }

    this.state = saved.state;
    this.context = saved.context;
    this.transitionHistory = saved.history;

    this.emit('loaded', { state: this.state, context: this.context });

    return true;
  }

  /**
   * Check if in terminal state
   */
  isTerminal(): boolean {
    return [
      WorkflowState.COMPLETED,
      WorkflowState.ABORTED,
      WorkflowState.ESCALATED,
    ].includes(this.state);
  }

  /**
   * Check if in error state
   */
  isError(): boolean {
    return this.state === WorkflowState.ERROR;
  }

  /**
   * Check if awaiting user input
   */
  isAwaitingInput(): boolean {
    return [
      WorkflowState.AWAITING_APPROVAL,
      WorkflowState.ESCALATED,
    ].includes(this.state);
  }
}
```

### 4. Create state store interface

```typescript
// src/persistence/state-store.ts

import { WorkflowState, StateContext, StateTransition } from '../core/states';

export interface PersistedState {
  projectId: string;
  taskId: string;
  state: WorkflowState;
  context: StateContext;
  history: StateTransition[];
}

export interface StateStore {
  saveState(state: PersistedState): Promise<void>;
  loadState(taskId: string): Promise<PersistedState | null>;
  listStates(projectId: string): Promise<PersistedState[]>;
  deleteState(taskId: string): Promise<void>;
}

// In-memory implementation for testing (SQLite implementation in Step 04)
export class InMemoryStateStore implements StateStore {
  private states: Map<string, PersistedState> = new Map();

  async saveState(state: PersistedState): Promise<void> {
    this.states.set(state.taskId, { ...state });
  }

  async loadState(taskId: string): Promise<PersistedState | null> {
    return this.states.get(taskId) ?? null;
  }

  async listStates(projectId: string): Promise<PersistedState[]> {
    return Array.from(this.states.values()).filter(
      (s) => s.projectId === projectId
    );
  }

  async deleteState(taskId: string): Promise<void> {
    this.states.delete(taskId);
  }
}
```

### 5. Integrate with orchestrator

```typescript
// src/core/orchestrator.ts

import { StateGraph, StateGraphOptions } from './state-machine';
import { WorkflowState } from './states';
import { StateStore, InMemoryStateStore } from '../persistence/state-store';
import { logger } from '../utils/logger';

export interface OrchestratorOptions {
  projectId: string;
  stateStore?: StateStore;
}

export class Orchestrator {
  private stateGraph: StateGraph;
  private projectId: string;

  constructor(options: OrchestratorOptions) {
    this.projectId = options.projectId;

    this.stateGraph = new StateGraph({
      projectId: options.projectId,
      stateStore: options.stateStore ?? new InMemoryStateStore(),
    });

    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    this.stateGraph.on('transition', (transition) => {
      logger.debug(`State transition: ${transition.from} -> ${transition.to}`);
    });

    this.stateGraph.on(`state:${WorkflowState.AWAITING_APPROVAL}`, () => {
      logger.info('Awaiting user approval. Run "aigentflow approve" to continue.');
    });

    this.stateGraph.on(`state:${WorkflowState.COMPLETED}`, () => {
      logger.success('Workflow completed successfully!');
    });

    this.stateGraph.on(`state:${WorkflowState.ERROR}`, (context) => {
      logger.error(`Workflow error: ${context.error?.message}`);
    });
  }

  /**
   * Run the orchestrator with a prompt
   */
  async run(prompt: string): Promise<void> {
    this.stateGraph.updateContext({ prompt });

    // Start the workflow
    await this.stateGraph.transition('START');

    // Main execution loop
    while (!this.stateGraph.isTerminal() && !this.stateGraph.isAwaitingInput()) {
      const state = this.stateGraph.getState();
      await this.executeState(state);
    }

    if (this.stateGraph.isAwaitingInput()) {
      const state = this.stateGraph.getState();
      logger.info(`Paused at ${state}. Waiting for user input.`);
    }
  }

  /**
   * Execute logic for current state
   */
  private async executeState(state: WorkflowState): Promise<void> {
    switch (state) {
      case WorkflowState.ANALYZING:
        await this.analyzePrompt();
        break;

      case WorkflowState.PLANNING:
        await this.createPlan();
        break;

      case WorkflowState.ARCHITECTING:
        await this.createArchitecture();
        break;

      case WorkflowState.DESIGNING:
        await this.createDesigns();
        break;

      case WorkflowState.BUILDING:
        await this.build();
        break;

      case WorkflowState.TESTING:
        await this.runTests();
        break;

      case WorkflowState.FIXING:
        await this.fixBugs();
        break;

      case WorkflowState.REVIEWING:
        await this.review();
        break;

      case WorkflowState.COMPLETING:
        await this.complete();
        break;

      default:
        logger.debug(`No action for state: ${state}`);
    }
  }

  // Placeholder methods - implemented with agents in later steps

  private async analyzePrompt(): Promise<void> {
    logger.info('Analyzing prompt...');
    // Placeholder - agent implementation in Step 05
    await this.stateGraph.transition('ANALYSIS_COMPLETE');
  }

  private async createPlan(): Promise<void> {
    logger.info('Creating plan...');
    await this.stateGraph.transition('PLAN_COMPLETE');
  }

  private async createArchitecture(): Promise<void> {
    logger.info('Creating architecture...');
    await this.stateGraph.transition('ARCHITECTURE_COMPLETE');
  }

  private async createDesigns(): Promise<void> {
    logger.info('Creating designs...');
    await this.stateGraph.createCheckpoint(['designs/mockups']);
    await this.stateGraph.transition('DESIGN_COMPLETE');
  }

  private async build(): Promise<void> {
    logger.info('Building...');
    await this.stateGraph.transition('BUILD_COMPLETE');
  }

  private async runTests(): Promise<void> {
    logger.info('Running tests...');
    // Simulate test result
    const testsPassed = true;
    if (testsPassed) {
      await this.stateGraph.transition('ALL_TESTS_PASS');
    } else {
      await this.stateGraph.transition('TESTS_FAILED');
    }
  }

  private async fixBugs(): Promise<void> {
    logger.info('Fixing bugs...');
    this.stateGraph.incrementRetry();
    await this.stateGraph.transition('FIX_COMPLETE');
  }

  private async review(): Promise<void> {
    logger.info('Reviewing...');
    await this.stateGraph.transition('REVIEW_COMPLETE');
  }

  private async complete(): Promise<void> {
    logger.info('Completing...');
    await this.stateGraph.transition('COMPLETE');
  }

  /**
   * Approve pending checkpoint
   */
  async approve(): Promise<boolean> {
    if (this.stateGraph.getState() !== WorkflowState.AWAITING_APPROVAL) {
      logger.warn('Nothing to approve');
      return false;
    }

    return this.stateGraph.transition('APPROVE');
  }

  /**
   * Reject pending checkpoint
   */
  async reject(reason?: string): Promise<boolean> {
    if (this.stateGraph.getState() !== WorkflowState.AWAITING_APPROVAL) {
      logger.warn('Nothing to reject');
      return false;
    }

    this.stateGraph.updateContext({
      metadata: { ...this.stateGraph.getContext().metadata, rejectionReason: reason },
    });

    return this.stateGraph.transition('REJECT');
  }

  /**
   * Abort current workflow
   */
  async abort(): Promise<boolean> {
    return this.stateGraph.transition('ABORT');
  }

  /**
   * Get current state
   */
  getState(): WorkflowState {
    return this.stateGraph.getState();
  }

  /**
   * Get workflow status
   */
  getStatus() {
    return {
      state: this.stateGraph.getState(),
      context: this.stateGraph.getContext(),
      isTerminal: this.stateGraph.isTerminal(),
      isAwaitingInput: this.stateGraph.isAwaitingInput(),
      validEvents: this.stateGraph.getValidEvents(),
    };
  }
}
```

---

## Test Scenarios

```typescript
// tests/cp0/03-state-machine.test.ts

import { describe, it, expect, beforeEach } from 'vitest';
import { StateGraph } from '../../src/core/state-machine';
import { WorkflowState } from '../../src/core/states';
import { InMemoryStateStore } from '../../src/persistence/state-store';

describe('Step 03: State Machine', () => {
  let stateGraph: StateGraph;
  let stateStore: InMemoryStateStore;

  beforeEach(() => {
    stateStore = new InMemoryStateStore();
    stateGraph = new StateGraph({
      projectId: 'test-project',
      stateStore,
    });
  });

  describe('Initial state', () => {
    it('should start in IDLE state', () => {
      expect(stateGraph.getState()).toBe(WorkflowState.IDLE);
    });

    it('should have empty transition history', () => {
      expect(stateGraph.getHistory()).toHaveLength(0);
    });
  });

  describe('Valid transitions', () => {
    it('should transition from IDLE to ANALYZING on START', async () => {
      const result = await stateGraph.transition('START');
      expect(result).toBe(true);
      expect(stateGraph.getState()).toBe(WorkflowState.ANALYZING);
    });

    it('should follow happy path through workflow', async () => {
      await stateGraph.transition('START');
      expect(stateGraph.getState()).toBe(WorkflowState.ANALYZING);

      await stateGraph.transition('ANALYSIS_COMPLETE');
      expect(stateGraph.getState()).toBe(WorkflowState.PLANNING);

      await stateGraph.transition('PLAN_COMPLETE');
      expect(stateGraph.getState()).toBe(WorkflowState.ARCHITECTING);

      await stateGraph.transition('ARCHITECTURE_COMPLETE');
      expect(stateGraph.getState()).toBe(WorkflowState.DESIGNING);

      await stateGraph.transition('DESIGN_COMPLETE');
      expect(stateGraph.getState()).toBe(WorkflowState.AWAITING_APPROVAL);
    });

    it('should record transition history', async () => {
      await stateGraph.transition('START');
      await stateGraph.transition('ANALYSIS_COMPLETE');

      const history = stateGraph.getHistory();
      expect(history).toHaveLength(2);
      expect(history[0].from).toBe(WorkflowState.IDLE);
      expect(history[0].to).toBe(WorkflowState.ANALYZING);
    });
  });

  describe('Invalid transitions', () => {
    it('should reject invalid transitions', async () => {
      const result = await stateGraph.transition('APPROVE');
      expect(result).toBe(false);
      expect(stateGraph.getState()).toBe(WorkflowState.IDLE);
    });

    it('should not allow skipping states', async () => {
      const result = await stateGraph.transition('BUILD_COMPLETE');
      expect(result).toBe(false);
    });
  });

  describe('Approval flow', () => {
    beforeEach(async () => {
      await stateGraph.transition('START');
      await stateGraph.transition('ANALYSIS_COMPLETE');
      await stateGraph.transition('PLAN_COMPLETE');
      await stateGraph.transition('ARCHITECTURE_COMPLETE');
      await stateGraph.transition('DESIGN_COMPLETE');
    });

    it('should handle approval', async () => {
      expect(stateGraph.getState()).toBe(WorkflowState.AWAITING_APPROVAL);

      await stateGraph.transition('APPROVE');
      expect(stateGraph.getState()).toBe(WorkflowState.APPROVED);
    });

    it('should handle rejection and redesign loop', async () => {
      await stateGraph.transition('REJECT');
      expect(stateGraph.getState()).toBe(WorkflowState.REJECTED);

      await stateGraph.transition('REDESIGN');
      expect(stateGraph.getState()).toBe(WorkflowState.DESIGNING);
    });
  });

  describe('Retry logic', () => {
    it('should respect max retries', async () => {
      // Get to TESTS_FAIL state
      await stateGraph.transition('START');
      await stateGraph.transition('ANALYSIS_COMPLETE');
      await stateGraph.transition('PLAN_COMPLETE');
      await stateGraph.transition('ARCHITECTURE_COMPLETE');
      await stateGraph.transition('DESIGN_COMPLETE');
      await stateGraph.transition('APPROVE');
      await stateGraph.transition('START_BUILD');
      await stateGraph.transition('BUILD_COMPLETE');
      await stateGraph.transition('TESTS_FAILED');

      // Should allow fixing under max retries
      expect(stateGraph.canTransition('START_FIX')).toBe(true);

      // Exhaust retries
      stateGraph.updateContext({ retryCount: 3 });

      // Should escalate instead of fix
      expect(stateGraph.canTransition('START_FIX')).toBe(false);
      expect(stateGraph.canTransition('MAX_RETRIES_EXCEEDED')).toBe(true);
    });
  });

  describe('Checkpoints', () => {
    it('should create checkpoint', async () => {
      await stateGraph.transition('START');
      const checkpoint = await stateGraph.createCheckpoint(['file1.ts']);

      expect(checkpoint).toBeDefined();
      expect(checkpoint.state).toBe(WorkflowState.ANALYZING);
      expect(checkpoint.artifacts).toContain('file1.ts');
    });

    it('should restore from checkpoint', async () => {
      await stateGraph.transition('START');
      await stateGraph.transition('ANALYSIS_COMPLETE');
      const checkpoint = await stateGraph.createCheckpoint();

      await stateGraph.transition('PLAN_COMPLETE');
      await stateGraph.transition('ERROR');

      await stateGraph.transition('START_RECOVERY');
      const restored = await stateGraph.restoreCheckpoint(checkpoint.id);

      expect(restored).toBe(true);
      expect(stateGraph.getState()).toBe(WorkflowState.PLANNING);
    });
  });

  describe('Error handling', () => {
    it('should transition to ERROR from any state', async () => {
      await stateGraph.transition('START');
      await stateGraph.transition('ANALYSIS_COMPLETE');

      await stateGraph.transition('ERROR');
      expect(stateGraph.getState()).toBe(WorkflowState.ERROR);
    });
  });

  describe('Abort handling', () => {
    it('should transition to ABORTED from any state', async () => {
      await stateGraph.transition('START');

      await stateGraph.transition('ABORT');
      expect(stateGraph.getState()).toBe(WorkflowState.ABORTED);
    });
  });

  describe('State persistence', () => {
    it('should persist state', async () => {
      stateGraph.updateContext({ prompt: 'Test prompt' });
      await stateGraph.transition('START');

      const taskId = stateGraph.getContext().taskId;
      const saved = await stateStore.loadState(taskId);

      expect(saved).not.toBeNull();
      expect(saved?.state).toBe(WorkflowState.ANALYZING);
      expect(saved?.context.prompt).toBe('Test prompt');
    });

    it('should load persisted state', async () => {
      await stateGraph.transition('START');
      await stateGraph.transition('ANALYSIS_COMPLETE');
      const taskId = stateGraph.getContext().taskId;

      const newStateGraph = new StateGraph({
        projectId: 'test-project',
        stateStore,
      });

      const loaded = await newStateGraph.loadState(taskId);
      expect(loaded).toBe(true);
      expect(newStateGraph.getState()).toBe(WorkflowState.PLANNING);
    });
  });

  describe('Terminal states', () => {
    it('should identify terminal states', async () => {
      expect(stateGraph.isTerminal()).toBe(false);

      await stateGraph.transition('ABORT');
      expect(stateGraph.isTerminal()).toBe(true);
    });
  });

  describe('Event emission', () => {
    it('should emit transition events', async () => {
      const transitions: any[] = [];
      stateGraph.on('transition', (t) => transitions.push(t));

      await stateGraph.transition('START');

      expect(transitions).toHaveLength(1);
      expect(transitions[0].event).toBe('START');
    });

    it('should emit state-specific events', async () => {
      let analyzingEmitted = false;
      stateGraph.on(`state:${WorkflowState.ANALYZING}`, () => {
        analyzingEmitted = true;
      });

      await stateGraph.transition('START');
      expect(analyzingEmitted).toBe(true);
    });
  });
});
```

---

## Validation Checklist

```
□ All workflow states defined
□ Valid transitions work correctly
□ Invalid transitions are rejected
□ Retry logic respects max retries
□ Checkpoints can be created
□ Checkpoints can be restored
□ Error state transition works from any state
□ Abort transition works from any state
□ State persists across restarts
□ Event emission works for transitions
□ Terminal state detection works
□ Awaiting input detection works
```

---

## Next Step

Once all tests pass and checklist is complete, proceed to **Step 04: Persistence Layer**.
