/**
 * Project Manager Agent
 *
 * Decomposes requirements into Work Breakdown Structures (WBS).
 */

import { BaseAgent } from './base-agent.js';
import type {
  AgentMetadata,
  AgentRequest,
  AgentResult,
  AgentExecutionOptions,
  WBSOutput,
  ExecutionContext,
  AgentType,
} from './types.js';
import { randomUUID } from 'crypto';

/**
 * Project Manager agent for task decomposition
 */
export class ProjectManagerAgent extends BaseAgent {
  readonly metadata: AgentMetadata = {
    type: 'project-manager',
    name: 'Project Manager',
    description: 'Decomposes requirements into WBS and manages dependencies',
    phase: 'mvp',
    defaultConfig: {
      enabled: true,
      maxConcurrent: 5,
      timeout: 60000,
      retryCount: 1,
    },
    capabilities: [
      'wbs-generation',
      'dependency-analysis',
      'task-decomposition',
      'complexity-estimation',
      'agent-assignment',
    ],
    validStates: ['PLANNING', 'ORCHESTRATING'],
  };

  /**
   * Execute the project manager agent
   */
  protected async executeCore(
    request: AgentRequest,
    _options: Required<AgentExecutionOptions>
  ): Promise<AgentResult> {
    const startTime = Date.now();
    const { prompt, context } = request;

    this.log.info('Project Manager decomposing task', {
      prompt: prompt.substring(0, 100),
    });

    // Analyze the request and generate WBS
    const wbs = this.generateWBS(prompt, context);

    // Validate dependencies
    this.validateDependencies(wbs.tasks);

    // Determine next agent (usually architect after WBS)
    const nextAgent = this.determineNextAgent(wbs, context);

    this.log.info('WBS generated', {
      taskCount: wbs.tasks.length,
      nextAgent,
    });

    return this.createSuccessResult(
      {
        wbs,
        routingHint: {
          nextAgent,
          reasoning: 'WBS complete - proceeding to architecture review',
        },
      },
      startTime,
      500, // Estimated tokens
      0,
      {
        nextAgent,
        reasoning: 'WBS created, architecture decisions needed',
      }
    );
  }

  /**
   * Generate Work Breakdown Structure from prompt
   */
  private generateWBS(prompt: string, context: ExecutionContext): WBSOutput {
    const wbsId = `wbs-${randomUUID().substring(0, 8)}`;
    const lowerPrompt = prompt.toLowerCase();

    // Analyze prompt to determine task breakdown
    const tasks: WBSOutput['tasks'] = [];

    // Always start with analysis/research task
    if (this.needsResearch(prompt)) {
      tasks.push({
        id: `${wbsId}-001`,
        name: 'Research & Analysis',
        description: 'Analyze requirements and research best practices',
        dependencies: [],
        estimatedComplexity: 'low',
        assignedAgent: 'analyst',
      });
    }

    // Architecture task for non-trivial features
    if (this.needsArchitecture(prompt)) {
      tasks.push({
        id: `${wbsId}-002`,
        name: 'Architecture Design',
        description: 'Design system architecture and make technology decisions',
        dependencies: tasks.length > 0 ? [tasks[tasks.length - 1]!.id] : [],
        estimatedComplexity: 'medium',
        assignedAgent: 'architect',
      });
    }

    // Determine if UI work is needed
    if (this.needsUI(prompt)) {
      const uiTaskId = `${wbsId}-${String(tasks.length + 1).padStart(3, '0')}`;
      tasks.push({
        id: uiTaskId,
        name: 'UI Design',
        description: 'Design user interface and user experience',
        dependencies: tasks.length > 0 ? [tasks[tasks.length - 1]!.id] : [],
        estimatedComplexity: 'medium',
        assignedAgent: 'ui-designer',
      });

      tasks.push({
        id: `${wbsId}-${String(tasks.length + 1).padStart(3, '0')}`,
        name: 'Frontend Implementation',
        description: 'Implement frontend components',
        dependencies: [uiTaskId],
        estimatedComplexity: 'medium',
        assignedAgent: 'frontend-developer',
      });
    }

    // Determine if backend work is needed
    if (this.needsBackend(prompt)) {
      const backendDeps = tasks.filter(
        (t) => t.assignedAgent === 'architect'
      ).map((t) => t.id);

      tasks.push({
        id: `${wbsId}-${String(tasks.length + 1).padStart(3, '0')}`,
        name: 'Backend Implementation',
        description: 'Implement backend services and APIs',
        dependencies: backendDeps,
        estimatedComplexity: 'medium',
        assignedAgent: 'backend-developer',
      });
    }

    // Always add testing task if there are implementation tasks
    const implTasks = tasks.filter(
      (t) =>
        t.assignedAgent === 'frontend-developer' ||
        t.assignedAgent === 'backend-developer'
    );
    if (implTasks.length > 0) {
      tasks.push({
        id: `${wbsId}-${String(tasks.length + 1).padStart(3, '0')}`,
        name: 'Testing',
        description: 'Write and run tests for implemented features',
        dependencies: implTasks.map((t) => t.id),
        estimatedComplexity: 'medium',
        assignedAgent: 'tester',
      });
    }

    // Code review task
    if (tasks.length > 2) {
      tasks.push({
        id: `${wbsId}-${String(tasks.length + 1).padStart(3, '0')}`,
        name: 'Code Review',
        description: 'Review implementation for quality and best practices',
        dependencies: [tasks[tasks.length - 1]!.id],
        estimatedComplexity: 'low',
        assignedAgent: 'reviewer',
      });
    }

    // If no specific tasks identified, create a general analysis task
    if (tasks.length === 0) {
      tasks.push({
        id: `${wbsId}-001`,
        name: 'Task Analysis',
        description: `Analyze and research: ${prompt.substring(0, 100)}`,
        dependencies: [],
        estimatedComplexity: 'low',
        assignedAgent: 'analyst',
      });
    }

    return {
      tasks,
      summary: this.generateSummary(prompt, tasks),
    };
  }

  /**
   * Check if research is needed
   */
  private needsResearch(prompt: string): boolean {
    const researchIndicators = [
      'research',
      'investigate',
      'explore',
      'best practice',
      'recommend',
      'evaluate',
      'compare',
      'analyze',
    ];
    const lower = prompt.toLowerCase();
    return researchIndicators.some((i) => lower.includes(i));
  }

  /**
   * Check if architecture work is needed
   */
  private needsArchitecture(prompt: string): boolean {
    const archIndicators = [
      'architect',
      'design',
      'structure',
      'system',
      'database',
      'api',
      'service',
      'microservice',
      'integration',
      'pattern',
      'scale',
    ];
    const lower = prompt.toLowerCase();
    return archIndicators.some((i) => lower.includes(i)) || prompt.length > 200;
  }

  /**
   * Check if UI work is needed
   */
  private needsUI(prompt: string): boolean {
    const uiIndicators = [
      'ui',
      'ux',
      'user interface',
      'frontend',
      'page',
      'screen',
      'component',
      'button',
      'form',
      'dashboard',
      'visual',
      'display',
      'view',
    ];
    const lower = prompt.toLowerCase();
    return uiIndicators.some((i) => lower.includes(i));
  }

  /**
   * Check if backend work is needed
   */
  private needsBackend(prompt: string): boolean {
    const backendIndicators = [
      'backend',
      'api',
      'server',
      'database',
      'endpoint',
      'service',
      'authentication',
      'authorization',
      'crud',
      'rest',
      'graphql',
      'storage',
      'persist',
    ];
    const lower = prompt.toLowerCase();
    return backendIndicators.some((i) => lower.includes(i));
  }

  /**
   * Generate WBS summary
   */
  private generateSummary(prompt: string, tasks: WBSOutput['tasks']): string {
    const taskTypes = [...new Set(tasks.map((t) => t.assignedAgent))];
    return `Work Breakdown Structure for: "${prompt.substring(0, 50)}..."\n` +
      `Total tasks: ${tasks.length}\n` +
      `Agents involved: ${taskTypes.join(', ')}`;
  }

  /**
   * Validate task dependencies (no cycles, all deps exist)
   */
  private validateDependencies(tasks: WBSOutput['tasks']): void {
    const taskIds = new Set(tasks.map((t) => t.id));

    for (const task of tasks) {
      for (const depId of task.dependencies) {
        if (!taskIds.has(depId)) {
          this.log.warn('Invalid dependency reference', {
            taskId: task.id,
            missingDep: depId,
          });
        }
      }
    }

    // Check for cycles (simple check - would need topological sort for complex cases)
    // For now, just log a warning if there might be cycles
    const hasPotentialCycle = tasks.some((task) =>
      task.dependencies.some((depId) =>
        tasks.find((t) => t.id === depId)?.dependencies.includes(task.id)
      )
    );

    if (hasPotentialCycle) {
      this.log.warn('Potential circular dependency detected');
    }
  }

  /**
   * Determine next agent after WBS
   */
  private determineNextAgent(
    wbs: WBSOutput,
    context: ExecutionContext
  ): AgentType {
    // If architect task exists and hasn't been done, go to architect
    const archTask = wbs.tasks.find((t) => t.assignedAgent === 'architect');
    if (archTask && !context.previousOutputs.has('architect')) {
      return 'architect';
    }

    // Otherwise, start with the first unblocked task's agent
    const unblockedTasks = wbs.tasks.filter(
      (t) => t.dependencies.length === 0
    );
    if (unblockedTasks.length > 0) {
      return unblockedTasks[0]!.assignedAgent as AgentType;
    }

    // Default to architect
    return 'architect';
  }

  /**
   * Check if agent can handle task
   */
  canHandle(taskType: string, _context: ExecutionContext): boolean {
    // PM handles feature planning and decomposition
    return ['feature', 'refactor', 'unknown'].includes(taskType);
  }
}

/**
 * Factory function for project manager agent
 */
export function createProjectManagerAgent(): ProjectManagerAgent {
  return new ProjectManagerAgent();
}
