# Step 05a: Orchestrator Agent

> **Checkpoint:** CP1 - Design System
> **Previous Step:** 05-AGENT-FRAMEWORK.md
> **Next Step:** 05b-PROJECT-MANAGER-AGENT.md

---

## Overview

The **Orchestrator Agent** is the central coordinator of the Aigentflow system. Unlike a simple task queue, it uses AI reasoning to make intelligent routing decisions, synthesize information across agents, and handle complex failure scenarios.

Key responsibilities:
- Analyze user prompts to determine intent
- Route tasks to appropriate agents
- Synthesize outputs from multiple agents
- Handle failures with intelligent recovery
- Make decisions when multiple approaches are valid
- Manage approval gates and user interactions

---

## Deliverables

1. `src/agents/agents/orchestrator.ts` - Orchestrator agent implementation
2. `src/agents/schemas/orchestrator-output.ts` - Output schema
3. `src/orchestration/router.ts` - Routing logic
4. `src/orchestration/synthesizer.ts` - Output synthesis
5. `src/orchestration/decision-engine.ts` - AI reasoning engine

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         ORCHESTRATOR ARCHITECTURE                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│                          ┌─────────────────────┐                            │
│                          │    USER INPUT       │                            │
│                          └──────────┬──────────┘                            │
│                                     │                                        │
│                                     ▼                                        │
│                          ┌─────────────────────┐                            │
│                          │   PROMPT ANALYZER   │                            │
│                          │  Intent detection   │                            │
│                          │  Task classification│                            │
│                          └──────────┬──────────┘                            │
│                                     │                                        │
│                                     ▼                                        │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                       DECISION ENGINE                                 │   │
│  │  ┌────────────────────┐         ┌────────────────────┐               │   │
│  │  │ DETERMINISTIC      │         │ AI REASONING       │               │   │
│  │  │ RULES (85%)        │         │ (15%)              │               │   │
│  │  │                    │         │                    │               │   │
│  │  │ • Failure → BugFix │         │ • Ambiguous tasks  │               │   │
│  │  │ • Approval → Pause │         │ • Complex failures │               │   │
│  │  │ • Security → Compl │         │ • Multi-option     │               │   │
│  │  │ • Tests → Tester   │         │ • Stage transitions│               │   │
│  │  └────────────────────┘         └────────────────────┘               │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                     │                                        │
│                                     ▼                                        │
│                          ┌─────────────────────┐                            │
│                          │      ROUTER         │                            │
│                          │  Agent selection    │                            │
│                          │  Context curation   │                            │
│                          └──────────┬──────────┘                            │
│                                     │                                        │
│            ┌────────────────────────┼────────────────────────┐              │
│            │                        │                        │              │
│            ▼                        ▼                        ▼              │
│     ┌──────────┐            ┌──────────┐            ┌──────────┐           │
│     │ Agent A  │            │ Agent B  │            │ Agent C  │           │
│     └────┬─────┘            └────┬─────┘            └────┬─────┘           │
│          │                       │                       │                  │
│          └───────────────────────┼───────────────────────┘                  │
│                                  │                                          │
│                                  ▼                                          │
│                          ┌─────────────────────┐                            │
│                          │    SYNTHESIZER      │                            │
│                          │  Output aggregation │                            │
│                          │  Conflict resolution│                            │
│                          └─────────────────────┘                            │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 1. Output Schema (`src/agents/schemas/orchestrator-output.ts`)

```typescript
/**
 * Orchestrator Output Schema
 *
 * Defines the structured output for orchestration decisions.
 */

import { z } from 'zod';
import { AgentType } from '../types';

/**
 * Task classification
 */
export const TaskClassificationSchema = z.object({
  type: z.enum(['feature', 'bugfix', 'refactor', 'research', 'deployment', 'config']),
  complexity: z.enum(['trivial', 'simple', 'moderate', 'complex', 'epic']),
  requiresDesign: z.boolean(),
  requiresArchitecture: z.boolean(),
  requiresCompliance: z.boolean(),
  estimatedAgents: z.number(),
  confidence: z.number().min(0).max(1),
});

export type TaskClassification = z.infer<typeof TaskClassificationSchema>;

/**
 * Routing decision
 */
export const RoutingDecisionSchema = z.object({
  nextAgent: z.nativeEnum(AgentType),
  reason: z.string(),
  priority: z.number(),
  contextRequirements: z.array(z.string()),
  estimatedDuration: z.string().optional(),
  alternativeAgents: z.array(z.nativeEnum(AgentType)).optional(),
});

export type RoutingDecision = z.infer<typeof RoutingDecisionSchema>;

/**
 * AI reasoning result
 */
export const ReasoningResultSchema = z.object({
  decision: z.string(),
  reasoning: z.string(),
  confidence: z.number().min(0).max(1),
  alternatives: z.array(z.object({
    option: z.string(),
    pros: z.array(z.string()),
    cons: z.array(z.string()),
  })),
  risks: z.array(z.string()),
});

export type ReasoningResult = z.infer<typeof ReasoningResultSchema>;

/**
 * Orchestrator state
 */
export const OrchestratorStateSchema = z.object({
  phase: z.enum(['analyzing', 'planning', 'designing', 'building', 'testing', 'reviewing', 'complete']),
  currentAgent: z.nativeEnum(AgentType).optional(),
  completedAgents: z.array(z.nativeEnum(AgentType)),
  pendingAgents: z.array(z.nativeEnum(AgentType)),
  blockedBy: z.string().optional(),
  approvalsPending: z.array(z.string()),
  failureCount: z.number(),
  lastDecision: z.string(),
});

export type OrchestratorState = z.infer<typeof OrchestratorStateSchema>;

/**
 * Synthesis result
 */
export const SynthesisResultSchema = z.object({
  summary: z.string(),
  keyOutputs: z.array(z.object({
    agent: z.nativeEnum(AgentType),
    output: z.string(),
    artifacts: z.array(z.string()),
  })),
  conflicts: z.array(z.object({
    type: z.string(),
    description: z.string(),
    resolution: z.string().optional(),
  })),
  nextSteps: z.array(z.string()),
  completionStatus: z.number().min(0).max(100),
});

export type SynthesisResult = z.infer<typeof SynthesisResultSchema>;

/**
 * Complete orchestrator output
 */
export const OrchestratorOutputSchema = z.object({
  taskClassification: TaskClassificationSchema,
  routingDecision: RoutingDecisionSchema.optional(),
  reasoning: ReasoningResultSchema.optional(),
  state: OrchestratorStateSchema,
  synthesis: SynthesisResultSchema.optional(),
  userMessage: z.string().optional(),
  requiresUserInput: z.boolean(),
  routingHints: z.object({
    suggestNext: z.array(z.nativeEnum(AgentType)),
    skipAgents: z.array(z.nativeEnum(AgentType)),
    needsApproval: z.boolean(),
    hasFailures: z.boolean(),
    isComplete: z.boolean(),
  }),
});

export type OrchestratorOutput = z.infer<typeof OrchestratorOutputSchema>;
```

---

## 2. Decision Engine (`src/orchestration/decision-engine.ts`)

```typescript
/**
 * Decision Engine
 *
 * Combines deterministic rules with AI reasoning for routing decisions.
 */

import Anthropic from '@anthropic-ai/sdk';
import { AgentType, AgentOutput } from '../agents/types';
import { TaskClassification, ReasoningResult, RoutingDecision } from '../agents/schemas/orchestrator-output';
import { config } from '../config';
import { logger } from '../utils/logger';

/**
 * Deterministic routing rule
 */
interface RoutingRule {
  id: string;
  condition: (context: DecisionContext) => boolean;
  action: AgentType | 'pause' | 'complete' | 'escalate';
  priority: number;
  description: string;
}

/**
 * Context for decision making
 */
export interface DecisionContext {
  taskClassification: TaskClassification;
  previousOutputs: AgentOutput[];
  currentPhase: string;
  hasFailures: boolean;
  failureCount: number;
  needsApproval: boolean;
  securityConcern: boolean;
  completedAgents: AgentType[];
}

/**
 * Decision Engine class
 */
export class DecisionEngine {
  private client: Anthropic;
  private rules: RoutingRule[] = [];
  private aiReasoningThreshold = 0.7; // Use AI if rule confidence < 70%

  constructor() {
    this.client = new Anthropic({
      apiKey: config.get('anthropic.apiKey'),
    });
    this.initializeRules();
  }

  /**
   * Initialize deterministic routing rules
   */
  private initializeRules(): void {
    this.rules = [
      // Security concern - highest priority
      {
        id: 'security-concern',
        condition: (ctx) => ctx.securityConcern,
        action: AgentType.COMPLIANCE_AGENT,
        priority: 0,
        description: 'Route to compliance agent on security concerns',
      },

      // Failure handling
      {
        id: 'test-failure',
        condition: (ctx) => ctx.hasFailures && ctx.failureCount < 3,
        action: AgentType.BUG_FIXER,
        priority: 10,
        description: 'Route to bug fixer on test failures',
      },
      {
        id: 'max-failures',
        condition: (ctx) => ctx.failureCount >= 3,
        action: 'escalate',
        priority: 5,
        description: 'Escalate after 3 consecutive failures',
      },

      // Approval gates
      {
        id: 'needs-approval',
        condition: (ctx) => ctx.needsApproval,
        action: 'pause',
        priority: 15,
        description: 'Pause for user approval',
      },

      // Phase-based routing
      {
        id: 'needs-design',
        condition: (ctx) =>
          ctx.taskClassification.requiresDesign &&
          !ctx.completedAgents.includes(AgentType.UI_DESIGNER),
        action: AgentType.UI_DESIGNER,
        priority: 20,
        description: 'Route to UI designer for design work',
      },
      {
        id: 'needs-architecture',
        condition: (ctx) =>
          ctx.taskClassification.requiresArchitecture &&
          !ctx.completedAgents.includes(AgentType.ARCHITECT),
        action: AgentType.ARCHITECT,
        priority: 25,
        description: 'Route to architect for architecture decisions',
      },
      {
        id: 'ready-for-frontend',
        condition: (ctx) =>
          ctx.currentPhase === 'building' &&
          ctx.completedAgents.includes(AgentType.UI_DESIGNER) &&
          !ctx.completedAgents.includes(AgentType.FRONTEND_DEV),
        action: AgentType.FRONTEND_DEV,
        priority: 30,
        description: 'Route to frontend developer after design',
      },
      {
        id: 'ready-for-backend',
        condition: (ctx) =>
          ctx.currentPhase === 'building' &&
          !ctx.completedAgents.includes(AgentType.BACKEND_DEV),
        action: AgentType.BACKEND_DEV,
        priority: 30,
        description: 'Route to backend developer',
      },
      {
        id: 'ready-for-testing',
        condition: (ctx) =>
          ctx.currentPhase === 'testing' &&
          (ctx.completedAgents.includes(AgentType.FRONTEND_DEV) ||
           ctx.completedAgents.includes(AgentType.BACKEND_DEV)) &&
          !ctx.completedAgents.includes(AgentType.TESTER),
        action: AgentType.TESTER,
        priority: 35,
        description: 'Route to tester after implementation',
      },
      {
        id: 'ready-for-review',
        condition: (ctx) =>
          ctx.currentPhase === 'reviewing' &&
          ctx.completedAgents.includes(AgentType.TESTER) &&
          !ctx.completedAgents.includes(AgentType.REVIEWER),
        action: AgentType.REVIEWER,
        priority: 40,
        description: 'Route to reviewer after testing',
      },

      // Completion
      {
        id: 'all-complete',
        condition: (ctx) =>
          ctx.completedAgents.includes(AgentType.REVIEWER) && !ctx.hasFailures,
        action: 'complete',
        priority: 100,
        description: 'Mark complete after review',
      },
    ];

    // Sort by priority
    this.rules.sort((a, b) => a.priority - b.priority);
  }

  /**
   * Make a routing decision
   */
  async decide(context: DecisionContext): Promise<RoutingDecision> {
    // First, try deterministic rules
    const ruleDecision = this.applyRules(context);

    if (ruleDecision) {
      logger.debug(`Deterministic rule matched: ${ruleDecision.reason}`);
      return ruleDecision;
    }

    // Fall back to AI reasoning for complex decisions
    logger.debug('No deterministic rule matched, using AI reasoning');
    return this.aiReason(context);
  }

  /**
   * Apply deterministic rules
   */
  private applyRules(context: DecisionContext): RoutingDecision | null {
    for (const rule of this.rules) {
      if (rule.condition(context)) {
        if (rule.action === 'pause' || rule.action === 'complete' || rule.action === 'escalate') {
          return {
            nextAgent: AgentType.ORCHESTRATOR, // Self-reference for special actions
            reason: rule.description,
            priority: rule.priority,
            contextRequirements: [],
          };
        }

        return {
          nextAgent: rule.action,
          reason: rule.description,
          priority: rule.priority,
          contextRequirements: this.getContextRequirements(rule.action),
        };
      }
    }

    return null;
  }

  /**
   * Use AI for complex reasoning
   */
  private async aiReason(context: DecisionContext): Promise<RoutingDecision> {
    const systemPrompt = `You are the decision engine for a multi-agent orchestration system.
Your task is to decide which agent should handle the next step of a task.

Available agents:
- project_manager: Breaks down tasks into epics/features
- architect: Makes technical decisions
- analyst: Researches best practices
- ui_designer: Creates UI mockups
- frontend_dev: Implements frontend code
- backend_dev: Implements backend code
- tester: Runs tests
- bug_fixer: Fixes failing tests
- reviewer: Reviews code quality
- compliance_agent: Handles security/compliance

Current context:
${JSON.stringify(context, null, 2)}

Decide which agent should handle the next step. Consider:
1. What has already been completed
2. What the task requires
3. Dependencies between agents
4. Efficiency of the workflow

Respond with JSON:
{
  "nextAgent": "agent_type",
  "reason": "why this agent",
  "priority": 50,
  "contextRequirements": ["what context the agent needs"],
  "confidence": 0.8
}`;

    try {
      const response = await this.client.messages.create({
        model: config.get('anthropic.model', 'claude-sonnet-4-20250514'),
        max_tokens: 1000,
        system: systemPrompt,
        messages: [
          {
            role: 'user',
            content: 'What should be the next step?',
          },
        ],
      });

      const textContent = response.content.find(c => c.type === 'text');
      if (!textContent || textContent.type !== 'text') {
        throw new Error('No text response from AI');
      }

      const parsed = JSON.parse(textContent.text);
      return {
        nextAgent: parsed.nextAgent as AgentType,
        reason: parsed.reason,
        priority: parsed.priority,
        contextRequirements: parsed.contextRequirements,
      };
    } catch (error) {
      logger.error('AI reasoning failed:', error);

      // Default fallback
      return {
        nextAgent: AgentType.PROJECT_MANAGER,
        reason: 'Default fallback after AI reasoning failure',
        priority: 50,
        contextRequirements: [],
      };
    }
  }

  /**
   * Get context requirements for an agent
   */
  private getContextRequirements(agent: AgentType): string[] {
    const requirements: Record<AgentType, string[]> = {
      [AgentType.ORCHESTRATOR]: [],
      [AgentType.PROJECT_MANAGER]: ['user_requirements'],
      [AgentType.ARCHITECT]: ['user_requirements', 'existing_architecture'],
      [AgentType.ANALYST]: ['research_question'],
      [AgentType.UI_DESIGNER]: ['feature_requirements', 'design_tokens'],
      [AgentType.GIT_AGENT]: ['branch_info'],
      [AgentType.FRONTEND_DEV]: ['mockups', 'design_tokens', 'tech_stack'],
      [AgentType.BACKEND_DEV]: ['api_spec', 'tech_stack'],
      [AgentType.TESTER]: ['source_code', 'test_requirements'],
      [AgentType.BUG_FIXER]: ['failing_tests', 'source_code'],
      [AgentType.MERGE_CONFLICT_RESOLVER]: ['conflicts', 'source_code'],
      [AgentType.REVIEWER]: ['source_code', 'test_results'],
      [AgentType.PROJECT_ANALYZER]: ['project_root'],
      [AgentType.COMPLIANCE_AGENT]: ['code_changes', 'compliance_requirements'],
      [AgentType.PATTERN_MINER]: ['execution_traces'],
      [AgentType.AGENT_GENERATOR]: ['patterns'],
      [AgentType.TOURNAMENT_MANAGER]: ['agent_pool'],
    };

    return requirements[agent] || [];
  }

  /**
   * Analyze a failure and determine recovery strategy
   */
  async analyzeFailure(
    failure: AgentOutput,
    context: DecisionContext
  ): Promise<{ strategy: 'retry' | 'fix' | 'escalate' | 'skip'; reason: string }> {
    // Simple heuristics first
    if (!failure.errors || failure.errors.length === 0) {
      return { strategy: 'retry', reason: 'No specific error, retrying' };
    }

    const error = failure.errors[0];

    // Check if recoverable
    if (error.recoverable && context.failureCount < 3) {
      return { strategy: 'retry', reason: 'Recoverable error, retrying' };
    }

    // Check if test failure
    if (error.code === 'TEST_FAILURE') {
      return { strategy: 'fix', reason: 'Test failure, routing to bug fixer' };
    }

    // Escalate on repeated failures
    if (context.failureCount >= 3) {
      return { strategy: 'escalate', reason: 'Too many failures, escalating to user' };
    }

    // Default to retry
    return { strategy: 'retry', reason: 'Attempting retry' };
  }
}
```

---

## 3. Router (`src/orchestration/router.ts`)

```typescript
/**
 * Router
 *
 * Routes tasks to appropriate agents based on decisions.
 */

import { AgentType, AgentContext, AgentRequest } from '../agents/types';
import { getRegistry } from '../agents/registry';
import { ContextManager } from '../agents/context-manager';
import { RoutingDecision } from '../agents/schemas/orchestrator-output';
import { logger } from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';

/**
 * Router class
 */
export class Router {
  private contextManager: ContextManager;

  constructor(contextManager: ContextManager) {
    this.contextManager = contextManager;
  }

  /**
   * Route to an agent based on decision
   */
  async route(
    decision: RoutingDecision,
    projectId: string,
    task: any,
    previousOutputs: any[]
  ): Promise<AgentRequest> {
    const registry = getRegistry();

    // Verify agent exists
    if (!registry.hasAgent(decision.nextAgent)) {
      throw new Error(`Agent not found: ${decision.nextAgent}`);
    }

    // Get agent metadata for context requirements
    const metadata = registry.getMetadata(decision.nextAgent);
    if (!metadata) {
      throw new Error(`No metadata for agent: ${decision.nextAgent}`);
    }

    // Build context
    const executionId = uuidv4();
    const context = await this.contextManager.buildContext(
      projectId,
      executionId,
      task,
      metadata.requiredContext,
      previousOutputs
    );

    logger.info(`Routing to ${decision.nextAgent}: ${decision.reason}`);

    return {
      executionId,
      task,
      context,
    };
  }

  /**
   * Execute routing decision
   */
  async execute(
    decision: RoutingDecision,
    projectId: string,
    task: any,
    previousOutputs: any[]
  ): Promise<any> {
    const request = await this.route(decision, projectId, task, previousOutputs);

    const registry = getRegistry();
    const agent = registry.getAgent(decision.nextAgent);

    logger.info(`Executing agent: ${decision.nextAgent}`);
    const result = await agent.execute(request);

    return result;
  }

  /**
   * Route to multiple agents in parallel
   */
  async routeParallel(
    decisions: RoutingDecision[],
    projectId: string,
    task: any,
    previousOutputs: any[]
  ): Promise<any[]> {
    const requests = await Promise.all(
      decisions.map(d => this.route(d, projectId, task, previousOutputs))
    );

    const registry = getRegistry();
    const results = await Promise.all(
      requests.map((req, i) => {
        const agent = registry.getAgent(decisions[i].nextAgent);
        return agent.execute(req);
      })
    );

    return results;
  }
}
```

---

## 4. Synthesizer (`src/orchestration/synthesizer.ts`)

```typescript
/**
 * Synthesizer
 *
 * Aggregates and synthesizes outputs from multiple agents.
 */

import { AgentType, AgentOutput } from '../agents/types';
import { SynthesisResult } from '../agents/schemas/orchestrator-output';
import { logger } from '../utils/logger';

/**
 * Synthesizer class
 */
export class Synthesizer {
  /**
   * Synthesize outputs from multiple agents
   */
  synthesize(outputs: AgentOutput[]): SynthesisResult {
    const keyOutputs = outputs.map(output => ({
      agent: output.agentId,
      output: this.summarizeOutput(output),
      artifacts: output.artifacts.map(a => a.path),
    }));

    const conflicts = this.detectConflicts(outputs);
    const nextSteps = this.determineNextSteps(outputs);
    const completionStatus = this.calculateCompletion(outputs);

    return {
      summary: this.generateSummary(outputs),
      keyOutputs,
      conflicts,
      nextSteps,
      completionStatus,
    };
  }

  /**
   * Generate a summary of all outputs
   */
  private generateSummary(outputs: AgentOutput[]): string {
    const successful = outputs.filter(o => o.success).length;
    const failed = outputs.filter(o => !o.success).length;

    const agentSummaries = outputs.map(o => {
      const status = o.success ? '✓' : '✗';
      return `${status} ${o.agentId}: ${o.artifacts.length} artifacts`;
    });

    return `Processed ${outputs.length} agents (${successful} succeeded, ${failed} failed)\n${agentSummaries.join('\n')}`;
  }

  /**
   * Summarize a single output
   */
  private summarizeOutput(output: AgentOutput): string {
    if (!output.success) {
      const error = output.errors?.[0];
      return `Failed: ${error?.message || 'Unknown error'}`;
    }

    return `Completed with ${output.artifacts.length} artifacts`;
  }

  /**
   * Detect conflicts between outputs
   */
  private detectConflicts(outputs: AgentOutput[]): Array<{
    type: string;
    description: string;
    resolution?: string;
  }> {
    const conflicts: Array<{ type: string; description: string; resolution?: string }> = [];

    // Check for file conflicts
    const filesByAgent: Map<string, AgentType[]> = new Map();
    for (const output of outputs) {
      for (const artifact of output.artifacts) {
        const existing = filesByAgent.get(artifact.path) || [];
        existing.push(output.agentId);
        filesByAgent.set(artifact.path, existing);
      }
    }

    for (const [path, agents] of filesByAgent) {
      if (agents.length > 1) {
        conflicts.push({
          type: 'file_conflict',
          description: `Multiple agents modified ${path}: ${agents.join(', ')}`,
          resolution: 'Manual merge required',
        });
      }
    }

    // Check for routing hint conflicts
    const suggestNext = new Set<AgentType>();
    const skipAgents = new Set<AgentType>();

    for (const output of outputs) {
      for (const agent of output.routingHints.suggestNext) {
        if (skipAgents.has(agent)) {
          conflicts.push({
            type: 'routing_conflict',
            description: `Agent ${agent} suggested by one output but skipped by another`,
          });
        }
        suggestNext.add(agent);
      }
      for (const agent of output.routingHints.skipAgents) {
        if (suggestNext.has(agent)) {
          conflicts.push({
            type: 'routing_conflict',
            description: `Agent ${agent} in conflict: suggested and skipped`,
          });
        }
        skipAgents.add(agent);
      }
    }

    return conflicts;
  }

  /**
   * Determine next steps based on outputs
   */
  private determineNextSteps(outputs: AgentOutput[]): string[] {
    const steps: string[] = [];

    // Collect all suggested next agents
    const nextAgents = new Set<AgentType>();
    for (const output of outputs) {
      for (const agent of output.routingHints.suggestNext) {
        nextAgents.add(agent);
      }
    }

    // Check for failures
    const failedOutputs = outputs.filter(o => !o.success);
    if (failedOutputs.length > 0) {
      steps.push(`Fix ${failedOutputs.length} failed agent(s)`);
    }

    // Check for approvals
    if (outputs.some(o => o.routingHints.needsApproval)) {
      steps.push('Obtain user approval');
    }

    // Add next agents
    for (const agent of nextAgents) {
      steps.push(`Execute ${agent}`);
    }

    // Check if complete
    if (outputs.every(o => o.routingHints.isComplete)) {
      steps.push('Workflow complete - finalize');
    }

    return steps;
  }

  /**
   * Calculate overall completion percentage
   */
  private calculateCompletion(outputs: AgentOutput[]): number {
    if (outputs.length === 0) return 0;

    // Weight by success and completeness
    let totalWeight = 0;
    let completedWeight = 0;

    for (const output of outputs) {
      totalWeight += 1;
      if (output.success) {
        completedWeight += output.routingHints.isComplete ? 1 : 0.5;
      }
    }

    return Math.round((completedWeight / totalWeight) * 100);
  }

  /**
   * Merge artifacts from multiple outputs
   */
  mergeArtifacts(outputs: AgentOutput[]): Map<string, { content: string; source: AgentType }> {
    const merged = new Map<string, { content: string; source: AgentType }>();

    for (const output of outputs) {
      for (const artifact of output.artifacts) {
        if (artifact.content) {
          // Later outputs override earlier ones
          merged.set(artifact.path, {
            content: artifact.content,
            source: output.agentId,
          });
        }
      }
    }

    return merged;
  }
}
```

---

## 5. Orchestrator Agent (`src/agents/agents/orchestrator.ts`)

```typescript
/**
 * Orchestrator Agent
 *
 * Central coordinator for the multi-agent system.
 */

import { BaseAgent } from '../base-agent';
import {
  AgentMetadata,
  AgentContext,
  AgentRequest,
  AgentOutput,
  RoutingHints,
  Artifact,
  AgentType,
} from '../types';
import {
  OrchestratorOutput,
  TaskClassification,
  OrchestratorState,
} from '../schemas/orchestrator-output';
import { DecisionEngine, DecisionContext } from '../../orchestration/decision-engine';
import { Router } from '../../orchestration/router';
import { Synthesizer } from '../../orchestration/synthesizer';
import { logger } from '../../utils/logger';

/**
 * Orchestrator Agent implementation
 */
export class OrchestratorAgent extends BaseAgent {
  private decisionEngine: DecisionEngine;
  private router: Router;
  private synthesizer: Synthesizer;
  private state: OrchestratorState;

  constructor(router: Router) {
    super({
      id: AgentType.ORCHESTRATOR,
      name: 'Orchestrator',
      description: 'Central coordinator for multi-agent orchestration',
      version: '1.0.0',
      capabilities: [
        {
          name: 'task-analysis',
          description: 'Analyze user requests to determine intent and requirements',
          inputTypes: ['text'],
          outputTypes: ['json'],
        },
        {
          name: 'routing',
          description: 'Route tasks to appropriate agents',
          inputTypes: ['task'],
          outputTypes: ['routing-decision'],
        },
        {
          name: 'synthesis',
          description: 'Synthesize outputs from multiple agents',
          inputTypes: ['agent-outputs'],
          outputTypes: ['synthesis'],
        },
      ],
      requiredContext: [
        { type: 'current_task', required: true },
      ],
      outputSchema: 'orchestrator-output',
    });

    this.decisionEngine = new DecisionEngine();
    this.router = router;
    this.synthesizer = new Synthesizer();
    this.state = this.initializeState();
  }

  /**
   * Initialize orchestrator state
   */
  private initializeState(): OrchestratorState {
    return {
      phase: 'analyzing',
      completedAgents: [],
      pendingAgents: [],
      approvalsPending: [],
      failureCount: 0,
      lastDecision: '',
    };
  }

  /**
   * Build system prompt
   */
  protected buildSystemPrompt(context: AgentContext): string {
    return `You are the Orchestrator, the central coordinator of the Aigentflow multi-agent system.

Your responsibilities:
1. Analyze user requests to understand intent and requirements
2. Classify tasks by type and complexity
3. Determine which agents are needed
4. Make routing decisions
5. Handle failures intelligently
6. Synthesize results from multiple agents

Current state:
- Phase: ${this.state.phase}
- Completed agents: ${this.state.completedAgents.join(', ') || 'none'}
- Failure count: ${this.state.failureCount}

Output must be valid JSON matching the OrchestratorOutput schema.`;
  }

  /**
   * Build user prompt
   */
  protected buildUserPrompt(request: AgentRequest): string {
    const task = request.task;
    const previousOutputs = request.context.previousOutputs;

    let prompt = `Analyze this task and determine next steps:\n\n`;
    prompt += `Task: ${JSON.stringify(task, null, 2)}\n\n`;

    if (previousOutputs.length > 0) {
      prompt += `Previous agent outputs:\n`;
      for (const output of previousOutputs) {
        prompt += `- ${output.agentId}: ${output.success ? 'succeeded' : 'failed'}\n`;
      }
    }

    prompt += `\nProvide your analysis and routing decision.`;

    return prompt;
  }

  /**
   * Parse LLM response
   */
  protected parseResponse(response: any): OrchestratorOutput {
    const text = this.extractTextContent(response);
    return this.parseJSON<OrchestratorOutput>(text);
  }

  /**
   * Process result
   */
  protected async processResult(
    parsed: OrchestratorOutput,
    request: AgentRequest
  ): Promise<{ result: OrchestratorOutput; artifacts: Artifact[] }> {
    // Update state based on output
    this.state.phase = parsed.state.phase;
    this.state.lastDecision = parsed.routingDecision?.reason || '';

    if (parsed.routingDecision) {
      this.state.pendingAgents.push(parsed.routingDecision.nextAgent);
    }

    return {
      result: parsed,
      artifacts: [],
    };
  }

  /**
   * Generate routing hints
   */
  protected generateRoutingHints(
    result: OrchestratorOutput,
    artifacts: Artifact[],
    request: AgentRequest
  ): RoutingHints {
    return result.routingHints;
  }

  /**
   * Classify a task
   */
  async classifyTask(userInput: string): Promise<TaskClassification> {
    // Use LLM to classify the task
    const response = await this.client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 500,
      system: `Classify this task. Output JSON with:
- type: feature|bugfix|refactor|research|deployment|config
- complexity: trivial|simple|moderate|complex|epic
- requiresDesign: boolean
- requiresArchitecture: boolean
- requiresCompliance: boolean
- estimatedAgents: number
- confidence: 0-1`,
      messages: [{ role: 'user', content: userInput }],
    });

    const text = this.extractTextContent(response);
    return this.parseJSON<TaskClassification>(text);
  }

  /**
   * Run the orchestration loop
   */
  async orchestrate(
    projectId: string,
    userInput: string,
    maxIterations: number = 50
  ): Promise<SynthesisResult> {
    logger.info('Starting orchestration');

    // Classify the task
    const classification = await this.classifyTask(userInput);
    logger.info(`Task classified as ${classification.type} (${classification.complexity})`);

    // Initialize
    this.state = this.initializeState();
    const outputs: AgentOutput[] = [];
    let iterations = 0;

    // Main orchestration loop
    while (iterations < maxIterations) {
      iterations++;

      // Build decision context
      const decisionContext: DecisionContext = {
        taskClassification: classification,
        previousOutputs: outputs,
        currentPhase: this.state.phase,
        hasFailures: outputs.some(o => !o.success),
        failureCount: this.state.failureCount,
        needsApproval: this.state.approvalsPending.length > 0,
        securityConcern: false, // TODO: Detect from outputs
        completedAgents: this.state.completedAgents,
      };

      // Make routing decision
      const decision = await this.decisionEngine.decide(decisionContext);
      this.state.lastDecision = decision.reason;

      // Check for completion
      if (decision.nextAgent === AgentType.ORCHESTRATOR) {
        // Special actions
        if (decision.reason.includes('complete')) {
          logger.info('Orchestration complete');
          break;
        }
        if (decision.reason.includes('pause')) {
          logger.info('Paused for approval');
          // TODO: Implement approval waiting
          break;
        }
        if (decision.reason.includes('escalate')) {
          logger.warn('Escalating to user');
          break;
        }
      }

      // Execute the agent
      try {
        const output = await this.router.execute(
          decision,
          projectId,
          { ...classification, userInput },
          outputs
        );

        outputs.push(output);

        if (output.success) {
          this.state.completedAgents.push(decision.nextAgent);
          this.state.failureCount = 0;
        } else {
          this.state.failureCount++;
        }
      } catch (error) {
        logger.error(`Agent execution failed: ${error}`);
        this.state.failureCount++;
      }

      // Update phase based on progress
      this.updatePhase();
    }

    // Synthesize results
    return this.synthesizer.synthesize(outputs);
  }

  /**
   * Update orchestration phase based on completed agents
   */
  private updatePhase(): void {
    const completed = this.state.completedAgents;

    if (completed.includes(AgentType.REVIEWER)) {
      this.state.phase = 'complete';
    } else if (completed.includes(AgentType.TESTER)) {
      this.state.phase = 'reviewing';
    } else if (completed.includes(AgentType.FRONTEND_DEV) || completed.includes(AgentType.BACKEND_DEV)) {
      this.state.phase = 'testing';
    } else if (completed.includes(AgentType.UI_DESIGNER)) {
      this.state.phase = 'building';
    } else if (completed.includes(AgentType.ARCHITECT)) {
      this.state.phase = 'designing';
    } else if (completed.includes(AgentType.PROJECT_MANAGER)) {
      this.state.phase = 'planning';
    }
  }
}
```

---

## Test Scenarios

```typescript
// tests/agents/orchestrator.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { OrchestratorAgent } from '../../src/agents/agents/orchestrator';
import { DecisionEngine } from '../../src/orchestration/decision-engine';
import { AgentType } from '../../src/agents/types';

describe('OrchestratorAgent', () => {
  // Tests would go here
  it('should classify tasks correctly', async () => {
    // Mock implementation
  });

  it('should route to appropriate agents', async () => {
    // Test routing logic
  });

  it('should handle failures with retry', async () => {
    // Test failure handling
  });
});

describe('DecisionEngine', () => {
  let engine: DecisionEngine;

  beforeEach(() => {
    engine = new DecisionEngine();
  });

  it('should route to compliance on security concerns', async () => {
    const decision = await engine.decide({
      taskClassification: { type: 'feature', complexity: 'moderate' } as any,
      previousOutputs: [],
      currentPhase: 'building',
      hasFailures: false,
      failureCount: 0,
      needsApproval: false,
      securityConcern: true,
      completedAgents: [],
    });

    expect(decision.nextAgent).toBe(AgentType.COMPLIANCE_AGENT);
  });

  it('should route to bug fixer on test failures', async () => {
    const decision = await engine.decide({
      taskClassification: { type: 'feature', complexity: 'moderate' } as any,
      previousOutputs: [],
      currentPhase: 'testing',
      hasFailures: true,
      failureCount: 1,
      needsApproval: false,
      securityConcern: false,
      completedAgents: [AgentType.FRONTEND_DEV],
    });

    expect(decision.nextAgent).toBe(AgentType.BUG_FIXER);
  });
});
```

---

## Validation Checklist

```
□ Decision engine implemented
  □ Deterministic rules work
  □ AI reasoning fallback works
  □ Priority ordering correct

□ Router implemented
  □ Context building works
  □ Agent execution works
  □ Parallel routing works

□ Synthesizer implemented
  □ Output aggregation works
  □ Conflict detection works
  □ Next steps determination works

□ Orchestrator agent complete
  □ Task classification works
  □ Orchestration loop works
  □ Phase transitions correct

□ All tests pass
```

---

## Next Step

Proceed to **05b-PROJECT-MANAGER-AGENT.md** to implement the project manager agent.
