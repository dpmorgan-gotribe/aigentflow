# Step 05b: Project Manager Agent

> **Checkpoint:** CP1 - Design System
> **Previous Step:** 05a-ORCHESTRATOR-AGENT.md
> **Next Step:** 05c-ARCHITECT-AGENT.md

---

## Overview

The **Project Manager Agent** breaks down user requests into executable work units. It creates a structured hierarchy of epics, features, and tasks with proper dependencies, acceptance criteria, and complexity estimates.

Key responsibilities:
- Parse user requirements into structured work breakdown
- Create epics (large initiatives), features (deliverable units), and tasks (atomic work items)
- Define dependencies between work items
- Estimate complexity and identify required agents
- Track compliance-relevant items
- Generate clear acceptance criteria

---

## Deliverables

1. `src/agents/agents/project-manager.ts` - Project Manager agent implementation
2. `src/agents/schemas/project-manager-output.ts` - Output schema
3. `src/planning/work-breakdown.ts` - Work breakdown structure utilities
4. `src/planning/dependency-graph.ts` - Dependency management

---

## 1. Output Schema (`src/agents/schemas/project-manager-output.ts`)

```typescript
/**
 * Project Manager Output Schema
 *
 * Defines the work breakdown structure for project planning.
 */

import { z } from 'zod';
import { AgentType } from '../types';

/**
 * Task types
 */
export const TaskTypeSchema = z.enum([
  'design',
  'frontend',
  'backend',
  'database',
  'testing',
  'integration',
  'documentation',
  'devops',
  'review',
]);

export type TaskType = z.infer<typeof TaskTypeSchema>;

/**
 * Complexity levels
 */
export const ComplexitySchema = z.enum([
  'trivial',   // < 1 hour
  'simple',    // 1-4 hours
  'moderate',  // 4-8 hours
  'complex',   // 1-3 days
  'epic',      // > 3 days (should be broken down)
]);

export type Complexity = z.infer<typeof ComplexitySchema>;

/**
 * Task definition
 */
export const TaskSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  type: TaskTypeSchema,
  complexity: ComplexitySchema,
  dependencies: z.array(z.string()), // Task IDs
  acceptanceCriteria: z.array(z.string()),
  assignedAgents: z.array(z.nativeEnum(AgentType)),
  complianceRelevant: z.boolean(),
  complianceNotes: z.string().optional(),
  estimatedTokens: z.number().optional(), // Estimated LLM tokens
  tags: z.array(z.string()),
});

export type Task = z.infer<typeof TaskSchema>;

/**
 * Feature definition (group of related tasks)
 */
export const FeatureSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  userStory: z.string(), // "As a [user], I want [goal], so that [benefit]"
  tasks: z.array(TaskSchema),
  acceptanceCriteria: z.array(z.string()),
  priority: z.enum(['critical', 'high', 'medium', 'low']),
  dependencies: z.array(z.string()), // Feature IDs
  complianceRelevant: z.boolean(),
});

export type Feature = z.infer<typeof FeatureSchema>;

/**
 * Epic definition (large initiative)
 */
export const EpicSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  objective: z.string(),
  features: z.array(FeatureSchema),
  successMetrics: z.array(z.string()),
  risks: z.array(z.object({
    description: z.string(),
    mitigation: z.string(),
    severity: z.enum(['low', 'medium', 'high']),
  })),
});

export type Epic = z.infer<typeof EpicSchema>;

/**
 * Work breakdown summary
 */
export const WorkBreakdownSummarySchema = z.object({
  totalEpics: z.number(),
  totalFeatures: z.number(),
  totalTasks: z.number(),
  complexityDistribution: z.record(ComplexitySchema, z.number()),
  taskTypeDistribution: z.record(TaskTypeSchema, z.number()),
  estimatedTotalEffort: z.string(),
  criticalPath: z.array(z.string()), // Task IDs in critical path
  complianceTaskCount: z.number(),
});

export type WorkBreakdownSummary = z.infer<typeof WorkBreakdownSummarySchema>;

/**
 * Complete project manager output
 */
export const ProjectManagerOutputSchema = z.object({
  epics: z.array(EpicSchema),
  summary: WorkBreakdownSummarySchema,
  suggestedOrder: z.array(z.string()), // Task IDs in suggested execution order
  parallelizable: z.array(z.array(z.string())), // Groups of task IDs that can run in parallel
  blockers: z.array(z.object({
    taskId: z.string(),
    reason: z.string(),
    resolution: z.string(),
  })),
  routingHints: z.object({
    suggestNext: z.array(z.nativeEnum(AgentType)),
    skipAgents: z.array(z.nativeEnum(AgentType)),
    needsApproval: z.boolean(),
    hasFailures: z.boolean(),
    isComplete: z.boolean(),
    notes: z.string().optional(),
  }),
});

export type ProjectManagerOutput = z.infer<typeof ProjectManagerOutputSchema>;
```

---

## 2. Work Breakdown Utilities (`src/planning/work-breakdown.ts`)

```typescript
/**
 * Work Breakdown Structure Utilities
 *
 * Helpers for managing work breakdown hierarchies.
 */

import {
  Epic,
  Feature,
  Task,
  TaskType,
  Complexity,
  WorkBreakdownSummary,
} from '../agents/schemas/project-manager-output';
import { v4 as uuidv4 } from 'uuid';

/**
 * Generate a unique ID for work items
 */
export function generateId(prefix: string): string {
  return `${prefix}-${uuidv4().substring(0, 8)}`;
}

/**
 * Create an empty epic
 */
export function createEpic(title: string, description: string): Epic {
  return {
    id: generateId('epic'),
    title,
    description,
    objective: '',
    features: [],
    successMetrics: [],
    risks: [],
  };
}

/**
 * Create an empty feature
 */
export function createFeature(title: string, description: string): Feature {
  return {
    id: generateId('feat'),
    title,
    description,
    userStory: '',
    tasks: [],
    acceptanceCriteria: [],
    priority: 'medium',
    dependencies: [],
    complianceRelevant: false,
  };
}

/**
 * Create a task
 */
export function createTask(
  title: string,
  type: TaskType,
  complexity: Complexity
): Task {
  return {
    id: generateId('task'),
    title,
    description: '',
    type,
    complexity,
    dependencies: [],
    acceptanceCriteria: [],
    assignedAgents: [],
    complianceRelevant: false,
    tags: [],
  };
}

/**
 * Calculate work breakdown summary
 */
export function calculateSummary(epics: Epic[]): WorkBreakdownSummary {
  const allTasks = epics.flatMap(e => e.features.flatMap(f => f.tasks));
  const allFeatures = epics.flatMap(e => e.features);

  const complexityDist: Record<Complexity, number> = {
    trivial: 0,
    simple: 0,
    moderate: 0,
    complex: 0,
    epic: 0,
  };

  const typeDist: Record<TaskType, number> = {
    design: 0,
    frontend: 0,
    backend: 0,
    database: 0,
    testing: 0,
    integration: 0,
    documentation: 0,
    devops: 0,
    review: 0,
  };

  let complianceCount = 0;

  for (const task of allTasks) {
    complexityDist[task.complexity]++;
    typeDist[task.type]++;
    if (task.complianceRelevant) complianceCount++;
  }

  // Estimate total effort
  const effortMap: Record<Complexity, number> = {
    trivial: 0.5,
    simple: 2,
    moderate: 6,
    complex: 16,
    epic: 40,
  };

  const totalHours = allTasks.reduce(
    (sum, task) => sum + effortMap[task.complexity],
    0
  );

  const days = Math.ceil(totalHours / 8);
  const estimatedEffort = days === 1 ? '1 day' : `${days} days`;

  return {
    totalEpics: epics.length,
    totalFeatures: allFeatures.length,
    totalTasks: allTasks.length,
    complexityDistribution: complexityDist,
    taskTypeDistribution: typeDist,
    estimatedTotalEffort: estimatedEffort,
    criticalPath: [], // Calculated by dependency graph
    complianceTaskCount: complianceCount,
  };
}

/**
 * Flatten all tasks from epics
 */
export function flattenTasks(epics: Epic[]): Task[] {
  return epics.flatMap(e => e.features.flatMap(f => f.tasks));
}

/**
 * Get task by ID
 */
export function getTaskById(epics: Epic[], taskId: string): Task | undefined {
  for (const epic of epics) {
    for (const feature of epic.features) {
      const task = feature.tasks.find(t => t.id === taskId);
      if (task) return task;
    }
  }
  return undefined;
}

/**
 * Get feature by ID
 */
export function getFeatureById(epics: Epic[], featureId: string): Feature | undefined {
  for (const epic of epics) {
    const feature = epic.features.find(f => f.id === featureId);
    if (feature) return feature;
  }
  return undefined;
}

/**
 * Validate work breakdown structure
 */
export function validateWorkBreakdown(epics: Epic[]): {
  valid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];
  const allTaskIds = new Set<string>();
  const allFeatureIds = new Set<string>();

  for (const epic of epics) {
    if (!epic.title) errors.push(`Epic ${epic.id} has no title`);
    if (epic.features.length === 0) warnings.push(`Epic ${epic.id} has no features`);

    for (const feature of epic.features) {
      if (allFeatureIds.has(feature.id)) {
        errors.push(`Duplicate feature ID: ${feature.id}`);
      }
      allFeatureIds.add(feature.id);

      if (!feature.userStory) warnings.push(`Feature ${feature.id} has no user story`);
      if (feature.tasks.length === 0) warnings.push(`Feature ${feature.id} has no tasks`);

      for (const task of feature.tasks) {
        if (allTaskIds.has(task.id)) {
          errors.push(`Duplicate task ID: ${task.id}`);
        }
        allTaskIds.add(task.id);

        if (task.acceptanceCriteria.length === 0) {
          warnings.push(`Task ${task.id} has no acceptance criteria`);
        }

        // Check dependencies exist
        for (const depId of task.dependencies) {
          if (!allTaskIds.has(depId) && depId !== task.id) {
            // Dependency might be declared later, check at end
          }
        }
      }
    }
  }

  // Validate all dependencies exist
  const allTasks = flattenTasks(epics);
  const taskIdSet = new Set(allTasks.map(t => t.id));

  for (const task of allTasks) {
    for (const depId of task.dependencies) {
      if (!taskIdSet.has(depId)) {
        errors.push(`Task ${task.id} depends on non-existent task ${depId}`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}
```

---

## 3. Dependency Graph (`src/planning/dependency-graph.ts`)

```typescript
/**
 * Dependency Graph
 *
 * Manages task dependencies and execution ordering.
 */

import { Task, Epic } from '../agents/schemas/project-manager-output';
import { flattenTasks } from './work-breakdown';

/**
 * Dependency Graph class
 */
export class DependencyGraph {
  private adjacencyList: Map<string, string[]> = new Map();
  private reverseList: Map<string, string[]> = new Map();
  private tasks: Map<string, Task> = new Map();

  /**
   * Build graph from epics
   */
  static fromEpics(epics: Epic[]): DependencyGraph {
    const graph = new DependencyGraph();
    const tasks = flattenTasks(epics);

    for (const task of tasks) {
      graph.addTask(task);
    }

    return graph;
  }

  /**
   * Add a task to the graph
   */
  addTask(task: Task): void {
    this.tasks.set(task.id, task);
    this.adjacencyList.set(task.id, [...task.dependencies]);

    // Build reverse adjacency for dependents lookup
    for (const dep of task.dependencies) {
      const dependents = this.reverseList.get(dep) || [];
      dependents.push(task.id);
      this.reverseList.set(dep, dependents);
    }
  }

  /**
   * Get dependencies for a task
   */
  getDependencies(taskId: string): string[] {
    return this.adjacencyList.get(taskId) || [];
  }

  /**
   * Get tasks that depend on a given task
   */
  getDependents(taskId: string): string[] {
    return this.reverseList.get(taskId) || [];
  }

  /**
   * Check if task is ready (all dependencies complete)
   */
  isReady(taskId: string, completedTasks: Set<string>): boolean {
    const deps = this.getDependencies(taskId);
    return deps.every(dep => completedTasks.has(dep));
  }

  /**
   * Get all tasks with no dependencies (can start immediately)
   */
  getRootTasks(): string[] {
    const roots: string[] = [];
    for (const [taskId, deps] of this.adjacencyList) {
      if (deps.length === 0) {
        roots.push(taskId);
      }
    }
    return roots;
  }

  /**
   * Get topologically sorted task order
   */
  getTopologicalOrder(): string[] {
    const visited = new Set<string>();
    const result: string[] = [];

    const visit = (taskId: string): void => {
      if (visited.has(taskId)) return;
      visited.add(taskId);

      for (const dep of this.getDependencies(taskId)) {
        visit(dep);
      }

      result.push(taskId);
    };

    for (const taskId of this.adjacencyList.keys()) {
      visit(taskId);
    }

    return result;
  }

  /**
   * Detect circular dependencies
   */
  detectCycles(): string[][] {
    const cycles: string[][] = [];
    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    const path: string[] = [];

    const dfs = (taskId: string): boolean => {
      visited.add(taskId);
      recursionStack.add(taskId);
      path.push(taskId);

      for (const dep of this.getDependencies(taskId)) {
        if (!visited.has(dep)) {
          if (dfs(dep)) return true;
        } else if (recursionStack.has(dep)) {
          // Found cycle
          const cycleStart = path.indexOf(dep);
          cycles.push(path.slice(cycleStart));
          return true;
        }
      }

      path.pop();
      recursionStack.delete(taskId);
      return false;
    };

    for (const taskId of this.adjacencyList.keys()) {
      if (!visited.has(taskId)) {
        dfs(taskId);
      }
    }

    return cycles;
  }

  /**
   * Find critical path (longest dependency chain)
   */
  findCriticalPath(): string[] {
    const order = this.getTopologicalOrder();
    const distances: Map<string, number> = new Map();
    const predecessors: Map<string, string> = new Map();

    // Initialize distances
    for (const taskId of order) {
      distances.set(taskId, 0);
    }

    // Calculate longest path to each node
    for (const taskId of order) {
      const deps = this.getDependencies(taskId);
      for (const dep of deps) {
        const newDist = (distances.get(dep) || 0) + 1;
        if (newDist > (distances.get(taskId) || 0)) {
          distances.set(taskId, newDist);
          predecessors.set(taskId, dep);
        }
      }
    }

    // Find the end of critical path
    let maxDist = 0;
    let endTask = '';
    for (const [taskId, dist] of distances) {
      if (dist > maxDist) {
        maxDist = dist;
        endTask = taskId;
      }
    }

    // Reconstruct critical path
    const criticalPath: string[] = [];
    let current = endTask;
    while (current) {
      criticalPath.unshift(current);
      current = predecessors.get(current) || '';
    }

    return criticalPath;
  }

  /**
   * Get parallelizable task groups
   */
  getParallelGroups(): string[][] {
    const order = this.getTopologicalOrder();
    const levels: Map<string, number> = new Map();

    // Assign levels based on dependencies
    for (const taskId of order) {
      const deps = this.getDependencies(taskId);
      if (deps.length === 0) {
        levels.set(taskId, 0);
      } else {
        const maxDepLevel = Math.max(...deps.map(d => levels.get(d) || 0));
        levels.set(taskId, maxDepLevel + 1);
      }
    }

    // Group by level
    const groups: Map<number, string[]> = new Map();
    for (const [taskId, level] of levels) {
      const group = groups.get(level) || [];
      group.push(taskId);
      groups.set(level, group);
    }

    // Convert to array sorted by level
    return Array.from(groups.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([_, tasks]) => tasks);
  }
}
```

---

## 4. Project Manager Agent (`src/agents/agents/project-manager.ts`)

```typescript
/**
 * Project Manager Agent
 *
 * Breaks down user requests into epics, features, and tasks.
 */

import { BaseAgent } from '../base-agent';
import {
  AgentMetadata,
  AgentContext,
  AgentRequest,
  RoutingHints,
  Artifact,
  AgentType,
} from '../types';
import {
  ProjectManagerOutput,
  Epic,
  Feature,
  Task,
} from '../schemas/project-manager-output';
import { calculateSummary, validateWorkBreakdown } from '../../planning/work-breakdown';
import { DependencyGraph } from '../../planning/dependency-graph';
import { logger } from '../../utils/logger';

/**
 * Project Manager Agent implementation
 */
export class ProjectManagerAgent extends BaseAgent {
  constructor() {
    super({
      id: AgentType.PROJECT_MANAGER,
      name: 'Project Manager',
      description: 'Breaks down user requests into executable work units',
      version: '1.0.0',
      capabilities: [
        {
          name: 'work-breakdown',
          description: 'Create epic/feature/task hierarchy',
          inputTypes: ['requirements'],
          outputTypes: ['work-breakdown'],
        },
        {
          name: 'dependency-analysis',
          description: 'Identify task dependencies',
          inputTypes: ['tasks'],
          outputTypes: ['dependency-graph'],
        },
        {
          name: 'estimation',
          description: 'Estimate complexity and effort',
          inputTypes: ['tasks'],
          outputTypes: ['estimates'],
        },
      ],
      requiredContext: [
        { type: 'current_task', required: true },
        { type: 'project_config', required: false },
      ],
      outputSchema: 'project-manager-output',
    });
  }

  /**
   * Build system prompt
   */
  protected buildSystemPrompt(context: AgentContext): string {
    return `You are the Project Manager agent responsible for breaking down user requests into executable work units.

Your responsibilities:
1. Analyze the user's request to understand all required functionality
2. Create a hierarchy of Epics (large initiatives), Features (deliverable units), and Tasks (atomic work items)
3. For each task, specify:
   - Clear title and description
   - Task type (design, frontend, backend, database, testing, integration, documentation, devops, review)
   - Complexity (trivial, simple, moderate, complex, epic)
   - Dependencies on other tasks (by ID)
   - Acceptance criteria
   - Which agents should handle it
   - Whether it's compliance-relevant

4. Identify dependencies between tasks
5. Consider compliance requirements if specified
6. Create user stories for features in the format: "As a [user], I want [goal], so that [benefit]"

IMPORTANT:
- Tasks should be atomic - one task, one agent, one deliverable
- "Epic" complexity tasks should be broken down further
- Every task needs clear acceptance criteria
- Design tasks should come before implementation
- Testing tasks should follow implementation
- Review tasks should be last

Output must be valid JSON matching the ProjectManagerOutput schema.`;
  }

  /**
   * Build user prompt
   */
  protected buildUserPrompt(request: AgentRequest): string {
    const task = request.context.task;
    const projectConfig = request.context.items.find(i => i.type === 'project_config');

    let prompt = `Break down this request into epics, features, and tasks:\n\n`;
    prompt += `REQUEST:\n${task.description || JSON.stringify(task)}\n\n`;

    if (projectConfig?.content) {
      prompt += `PROJECT CONTEXT:\n${JSON.stringify(projectConfig.content, null, 2)}\n\n`;
    }

    prompt += `Create a complete work breakdown structure with proper dependencies and acceptance criteria.`;

    return prompt;
  }

  /**
   * Parse LLM response
   */
  protected parseResponse(response: any): ProjectManagerOutput {
    const text = this.extractTextContent(response);
    return this.parseJSON<ProjectManagerOutput>(text);
  }

  /**
   * Process result
   */
  protected async processResult(
    parsed: ProjectManagerOutput,
    request: AgentRequest
  ): Promise<{ result: ProjectManagerOutput; artifacts: Artifact[] }> {
    // Validate the work breakdown
    const validation = validateWorkBreakdown(parsed.epics);

    if (!validation.valid) {
      logger.warn('Work breakdown validation errors:', validation.errors);
    }

    if (validation.warnings.length > 0) {
      logger.debug('Work breakdown warnings:', validation.warnings);
    }

    // Build dependency graph
    const graph = DependencyGraph.fromEpics(parsed.epics);

    // Check for cycles
    const cycles = graph.detectCycles();
    if (cycles.length > 0) {
      logger.error('Circular dependencies detected:', cycles);
      throw new Error(`Circular dependencies detected: ${cycles.map(c => c.join(' -> ')).join('; ')}`);
    }

    // Enhance output with computed fields
    const enhancedOutput: ProjectManagerOutput = {
      ...parsed,
      summary: calculateSummary(parsed.epics),
      suggestedOrder: graph.getTopologicalOrder(),
      parallelizable: graph.getParallelGroups(),
    };

    // Update critical path
    enhancedOutput.summary.criticalPath = graph.findCriticalPath();

    // Create artifact
    const artifact: Artifact = {
      id: this.generateArtifactId(),
      type: 'documentation',
      path: 'planning/work-breakdown.json',
      content: JSON.stringify(enhancedOutput, null, 2),
      metadata: {
        totalTasks: enhancedOutput.summary.totalTasks,
        totalFeatures: enhancedOutput.summary.totalFeatures,
        totalEpics: enhancedOutput.summary.totalEpics,
      },
    };

    return {
      result: enhancedOutput,
      artifacts: [artifact],
    };
  }

  /**
   * Generate routing hints
   */
  protected generateRoutingHints(
    result: ProjectManagerOutput,
    artifacts: Artifact[],
    request: AgentRequest
  ): RoutingHints {
    // Determine next agents based on first tasks
    const firstTasks = result.parallelizable[0] || [];
    const suggestNext: AgentType[] = [];

    // Check if architecture decisions needed
    const needsArchitecture = result.epics.some(e =>
      e.features.some(f =>
        f.tasks.some(t => t.type === 'backend' || t.type === 'database')
      )
    );

    if (needsArchitecture) {
      suggestNext.push(AgentType.ARCHITECT);
    }

    // Check if design needed
    const needsDesign = result.epics.some(e =>
      e.features.some(f =>
        f.tasks.some(t => t.type === 'design' || t.type === 'frontend')
      )
    );

    if (needsDesign) {
      suggestNext.push(AgentType.UI_DESIGNER);
    }

    // Check if compliance relevant
    if (result.summary.complianceTaskCount > 0) {
      suggestNext.push(AgentType.COMPLIANCE_AGENT);
    }

    return {
      suggestNext,
      skipAgents: [],
      needsApproval: true, // Plan should be approved before execution
      hasFailures: false,
      isComplete: false,
      notes: `Created ${result.summary.totalTasks} tasks across ${result.summary.totalFeatures} features`,
    };
  }
}
```

---

## Test Scenarios

```typescript
// tests/agents/project-manager.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ProjectManagerAgent } from '../../src/agents/agents/project-manager';
import { DependencyGraph } from '../../src/planning/dependency-graph';
import { validateWorkBreakdown, calculateSummary } from '../../src/planning/work-breakdown';

describe('ProjectManagerAgent', () => {
  let agent: ProjectManagerAgent;

  beforeEach(() => {
    agent = new ProjectManagerAgent();
  });

  it('should have correct metadata', () => {
    const metadata = agent.getMetadata();
    expect(metadata.id).toBe('project_manager');
    expect(metadata.capabilities).toHaveLength(3);
  });
});

describe('DependencyGraph', () => {
  it('should detect circular dependencies', () => {
    const graph = new DependencyGraph();

    graph.addTask({
      id: 'task-1',
      title: 'Task 1',
      dependencies: ['task-2'],
    } as any);

    graph.addTask({
      id: 'task-2',
      title: 'Task 2',
      dependencies: ['task-1'],
    } as any);

    const cycles = graph.detectCycles();
    expect(cycles.length).toBeGreaterThan(0);
  });

  it('should find topological order', () => {
    const graph = new DependencyGraph();

    graph.addTask({ id: 'task-1', title: 'Task 1', dependencies: [] } as any);
    graph.addTask({ id: 'task-2', title: 'Task 2', dependencies: ['task-1'] } as any);
    graph.addTask({ id: 'task-3', title: 'Task 3', dependencies: ['task-2'] } as any);

    const order = graph.getTopologicalOrder();
    expect(order.indexOf('task-1')).toBeLessThan(order.indexOf('task-2'));
    expect(order.indexOf('task-2')).toBeLessThan(order.indexOf('task-3'));
  });

  it('should find parallel groups', () => {
    const graph = new DependencyGraph();

    graph.addTask({ id: 'task-a', title: 'Task A', dependencies: [] } as any);
    graph.addTask({ id: 'task-b', title: 'Task B', dependencies: [] } as any);
    graph.addTask({ id: 'task-c', title: 'Task C', dependencies: ['task-a', 'task-b'] } as any);

    const groups = graph.getParallelGroups();
    expect(groups[0]).toContain('task-a');
    expect(groups[0]).toContain('task-b');
    expect(groups[1]).toContain('task-c');
  });
});

describe('WorkBreakdown', () => {
  it('should validate work breakdown', () => {
    const epics = [{
      id: 'epic-1',
      title: 'Epic 1',
      description: 'Test',
      objective: '',
      features: [{
        id: 'feat-1',
        title: 'Feature 1',
        description: 'Test',
        userStory: 'As a user...',
        tasks: [{
          id: 'task-1',
          title: 'Task 1',
          description: '',
          type: 'frontend',
          complexity: 'simple',
          dependencies: [],
          acceptanceCriteria: ['Works'],
          assignedAgents: [],
          complianceRelevant: false,
          tags: [],
        }],
        acceptanceCriteria: [],
        priority: 'medium',
        dependencies: [],
        complianceRelevant: false,
      }],
      successMetrics: [],
      risks: [],
    }];

    const result = validateWorkBreakdown(epics);
    expect(result.valid).toBe(true);
  });

  it('should calculate summary', () => {
    const epics = [{
      id: 'epic-1',
      title: 'Epic 1',
      description: '',
      objective: '',
      features: [{
        id: 'feat-1',
        title: 'Feature 1',
        description: '',
        userStory: '',
        tasks: [
          { id: 't1', type: 'frontend', complexity: 'simple' } as any,
          { id: 't2', type: 'backend', complexity: 'moderate' } as any,
        ],
        acceptanceCriteria: [],
        priority: 'medium',
        dependencies: [],
        complianceRelevant: false,
      }],
      successMetrics: [],
      risks: [],
    }];

    const summary = calculateSummary(epics);
    expect(summary.totalEpics).toBe(1);
    expect(summary.totalFeatures).toBe(1);
    expect(summary.totalTasks).toBe(2);
  });
});
```

---

## Validation Checklist

```
□ Project Manager agent implemented
□ Output schema complete
□ Work breakdown utilities work
□ Dependency graph works
  □ Cycle detection
  □ Topological sort
  □ Parallel groups
  □ Critical path
□ Validation works
□ Summary calculation works
□ All tests pass
```

---

## Next Step

Proceed to **05c-ARCHITECT-AGENT.md** to implement the architect agent.
