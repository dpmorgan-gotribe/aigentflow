/**
 * Orchestrator Agent
 *
 * Central routing agent that uses 85% rule-based decisions
 * and 15% AI-assisted for edge cases.
 */

import { BaseAgent } from './base-agent.js';
import type {
  AgentMetadata,
  AgentRequest,
  AgentResult,
  AgentExecutionOptions,
  RoutingOutput,
  ExecutionContext,
} from './types.js';
import { analyzeTask, TaskRouter, getTaskRouter } from '../core/routing.js';
import { ORCHESTRATOR_TEMPLATE } from '../prompts/templates/base.js';

/**
 * Orchestrator agent for task routing and coordination
 */
export class OrchestratorAgent extends BaseAgent {
  readonly metadata: AgentMetadata = {
    type: 'orchestrator',
    name: 'Orchestrator',
    description: 'Central routing and coordination agent',
    phase: 'mvp',
    defaultConfig: {
      enabled: true,
      maxConcurrent: 1,
      timeout: 30000,
      retryCount: 0,
    },
    capabilities: [
      'task-routing',
      'workflow-coordination',
      'task-analysis',
      'escalation-handling',
    ],
    validStates: ['IDLE', 'ANALYZING', 'ORCHESTRATING'],
  };

  private router: TaskRouter;

  constructor() {
    super();
    this.router = getTaskRouter();
  }

  /**
   * Execute the orchestrator agent
   */
  protected async executeCore(
    request: AgentRequest,
    _options: Required<AgentExecutionOptions>
  ): Promise<AgentResult> {
    const startTime = Date.now();
    const { prompt, context } = request;

    this.log.info('Orchestrator analyzing task', { prompt: prompt.substring(0, 100) });

    // Step 1: Analyze the task
    const analysis = analyzeTask(prompt);

    // Step 2: Get routing decision (85% rule-based)
    const previousAgents = Array.from(context.previousOutputs.keys()) as import('../types.js').AgentType[];
    const lastOutput = previousAgents.length > 0
      ? context.previousOutputs.get(previousAgents[previousAgents.length - 1]!)
      : undefined;

    const routingContext = {
      task: {
        id: request.taskId,
        projectId: context.projectConfig.name,
        prompt,
        state: context.currentState,
        status: 'running' as const,
        context: {
          prompt,
          agentOutputs: context.previousOutputs as Map<import('../types.js').AgentType, import('../core/types.js').AgentOutput>,
          retryCount: 0,
          approvalsPending: [],
          lessonsApplied: context.lessonsLearned,
          metadata: {},
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      analysis,
      previousAgents,
      lastOutput: lastOutput ? {
        agentType: previousAgents[previousAgents.length - 1]!,
        success: lastOutput.success,
        output: lastOutput.output,
        duration: lastOutput.duration ?? 0,
        tokensUsed: lastOutput.tokensUsed ?? 0,
        timestamp: new Date(),
        routingHint: lastOutput.routingHint,
      } : undefined,
      availableAgents: ['orchestrator', 'project-manager', 'architect', 'analyst'] as import('../types.js').AgentType[],
    };

    const routingDecision = this.router.route(routingContext);

    // Step 3: Determine if AI assistance is needed (edge cases)
    const needsAI = this.shouldUseAI(analysis, routingDecision);

    let output: RoutingOutput;

    if (needsAI) {
      // Would call Claude API here for edge cases
      // For now, use enhanced rule-based logic
      this.log.debug('Edge case detected, using enhanced routing');
      output = this.handleEdgeCase(analysis, routingDecision, context);
    } else {
      // Pure rule-based decision
      output = {
        nextAgent: routingDecision.nextAgent,
        reasoning: routingDecision.reasoning,
        confidence: routingDecision.confidence,
        alternativeAgents: this.getAlternatives(analysis.taskType),
      };
    }

    this.log.info('Orchestrator decision', {
      nextAgent: output.nextAgent,
      confidence: output.confidence,
      isAIAssisted: needsAI,
    });

    return this.createSuccessResult(
      {
        decision: output,
        taskAnalysis: analysis,
        routingHints: {
          alternativeAgents: output.alternativeAgents,
          blockers: this.identifyBlockers(context),
        },
      },
      startTime,
      50, // Estimated tokens (minimal for rule-based)
      0,
      {
        nextAgent: output.nextAgent,
        reasoning: output.reasoning,
      }
    );
  }

  /**
   * Get the last agent that executed
   */
  private getLastAgent(context: ExecutionContext): string | undefined {
    const outputs = Array.from(context.previousOutputs.entries());
    if (outputs.length === 0) return undefined;
    return outputs[outputs.length - 1]?.[0];
  }

  /**
   * Extract routing hint from previous agent output
   */
  private extractRoutingHint(context: ExecutionContext): string | undefined {
    const outputs = Array.from(context.previousOutputs.values());
    const lastOutput = outputs[outputs.length - 1];
    return lastOutput?.routingHint?.nextAgent;
  }

  /**
   * Determine if AI assistance is needed
   */
  private shouldUseAI(
    analysis: ReturnType<typeof analyzeTask>,
    decision: { confidence: number }
  ): boolean {
    // Edge cases that need AI:
    // 1. Low confidence routing
    if (decision.confidence < 0.6) return true;

    // 2. Unknown or ambiguous task type
    if (analysis.taskType === 'unknown') return true;

    // 3. Very high complexity
    if (analysis.complexity === 'high' && analysis.estimatedSteps > 10) return true;

    return false;
  }

  /**
   * Handle edge cases with enhanced logic
   */
  private handleEdgeCase(
    analysis: ReturnType<typeof analyzeTask>,
    baseDecision: { nextAgent: string; reasoning: string; confidence: number },
    context: ExecutionContext
  ): RoutingOutput {
    // Enhanced routing for edge cases
    let nextAgent = baseDecision.nextAgent;
    let reasoning = baseDecision.reasoning;
    let confidence = baseDecision.confidence;

    // If unknown type, start with analyst to research
    if (analysis.taskType === 'unknown') {
      nextAgent = 'analyst';
      reasoning = 'Task type unclear - sending to analyst for research';
      confidence = 0.7;
    }

    // If high complexity feature, ensure PM sees it first
    if (analysis.taskType === 'feature' && analysis.complexity === 'high') {
      if (!context.previousOutputs.has('project-manager')) {
        nextAgent = 'project-manager';
        reasoning = 'High complexity feature - requires WBS from project manager';
        confidence = 0.85;
      }
    }

    return {
      nextAgent: nextAgent as RoutingOutput['nextAgent'],
      reasoning,
      confidence,
      alternativeAgents: this.getAlternatives(analysis.taskType),
    };
  }

  /**
   * Get alternative agents for a task type
   */
  private getAlternatives(taskType: string): RoutingOutput['nextAgent'][] {
    const alternatives: Record<string, RoutingOutput['nextAgent'][]> = {
      feature: ['architect', 'analyst'],
      'bug-fix': ['tester', 'analyst'],
      refactor: ['architect', 'reviewer'],
      research: ['project-manager'],
      'api-only': ['architect'],
      'ui-only': ['architect'],
      unknown: ['analyst', 'project-manager'],
    };
    return alternatives[taskType] ?? ['analyst'];
  }

  /**
   * Identify blockers for the current task
   */
  private identifyBlockers(context: ExecutionContext): string[] {
    const blockers: string[] = [];

    // Check for missing context
    if (!context.projectConfig.techStack || Object.keys(context.projectConfig.techStack).length === 0) {
      blockers.push('Tech stack not defined - architect review recommended');
    }

    // Check for compliance requirements
    if (context.projectConfig.compliance.frameworks.length > 0) {
      blockers.push(`Compliance requirements: ${context.projectConfig.compliance.frameworks.join(', ')}`);
    }

    return blockers;
  }

  /**
   * Check if agent can handle task
   */
  canHandle(taskType: string, _context: ExecutionContext): boolean {
    // Orchestrator can handle any task (routing)
    return true;
  }
}

/**
 * Factory function for orchestrator agent
 */
export function createOrchestratorAgent(): OrchestratorAgent {
  return new OrchestratorAgent();
}
