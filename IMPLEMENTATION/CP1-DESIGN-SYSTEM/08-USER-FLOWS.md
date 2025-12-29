# Step 08: User Flows

> **Checkpoint:** CP1 - Design System
> **Previous Step:** 07-DESIGN-TOKENS.md
> **Next Checkpoint:** CP2 - Git Worktrees (09-GIT-AGENT.md)

---

## Overview

User flows define how users navigate through the application to accomplish tasks. This step implements:

- Flow diagram generation from feature requirements
- State transition documentation
- Approval gate that pauses execution for review
- User approval/rejection handling
- Redesign loop for rejected flows

---

## Deliverables

1. `src/flows/flow-generator.ts` - User flow generation logic
2. `src/flows/flow-schema.ts` - Flow definition schemas
3. `src/flows/approval-gate.ts` - Approval gate implementation
4. `src/flows/diagram-renderer.ts` - Mermaid diagram rendering
5. `src/flows/index.ts` - Public exports

---

## File Structure

```
src/flows/
├── flow-schema.ts      # Flow type definitions
├── flow-generator.ts   # Flow generation logic
├── approval-gate.ts    # Approval workflow
├── diagram-renderer.ts # Mermaid diagram generation
└── index.ts            # Public exports
```

---

## 1. Flow Schema (`src/flows/flow-schema.ts`)

```typescript
/**
 * User Flow Schema
 *
 * Defines the structure for user flow definitions,
 * states, transitions, and approval metadata.
 */

import { z } from 'zod';

/**
 * Flow step types
 */
export const FlowStepTypeSchema = z.enum([
  'start',        // Entry point
  'end',          // Exit point
  'action',       // User action
  'decision',     // Branching point
  'process',      // System process
  'input',        // User input
  'display',      // Information display
  'wait',         // Waiting state
  'error',        // Error handling
  'external',     // External service call
]);

export type FlowStepType = z.infer<typeof FlowStepTypeSchema>;

/**
 * Transition condition
 */
export const TransitionConditionSchema = z.object({
  type: z.enum(['success', 'failure', 'timeout', 'cancel', 'custom']),
  expression: z.string().optional(),
  label: z.string(),
});

export type TransitionCondition = z.infer<typeof TransitionConditionSchema>;

/**
 * Flow transition (edge)
 */
export const FlowTransitionSchema = z.object({
  id: z.string(),
  from: z.string(),
  to: z.string(),
  condition: TransitionConditionSchema.optional(),
  label: z.string().optional(),
  priority: z.number().optional(),
});

export type FlowTransition = z.infer<typeof FlowTransitionSchema>;

/**
 * User action within a step
 */
export const UserActionSchema = z.object({
  type: z.enum(['click', 'input', 'submit', 'navigate', 'drag', 'select', 'hover']),
  target: z.string(),
  description: z.string(),
  required: z.boolean().default(true),
});

export type UserAction = z.infer<typeof UserActionSchema>;

/**
 * System behavior within a step
 */
export const SystemBehaviorSchema = z.object({
  type: z.enum(['api_call', 'validation', 'computation', 'storage', 'notification']),
  description: z.string(),
  async: z.boolean().default(false),
  timeout: z.number().optional(),
});

export type SystemBehavior = z.infer<typeof SystemBehaviorSchema>;

/**
 * Flow step (node)
 */
export const FlowStepSchema = z.object({
  id: z.string(),
  type: FlowStepTypeSchema,
  name: z.string(),
  description: z.string(),
  mockupRef: z.string().optional(),     // Reference to mockup page/component
  userActions: z.array(UserActionSchema).optional(),
  systemBehaviors: z.array(SystemBehaviorSchema).optional(),
  validations: z.array(z.string()).optional(),
  errorHandling: z.object({
    retryable: z.boolean(),
    fallback: z.string().optional(),      // Fallback step ID
    message: z.string(),
  }).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export type FlowStep = z.infer<typeof FlowStepSchema>;

/**
 * Complete user flow definition
 */
export const UserFlowSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  version: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),

  // Entry and exit
  startStep: z.string(),
  endSteps: z.array(z.string()),

  // Flow content
  steps: z.array(FlowStepSchema),
  transitions: z.array(FlowTransitionSchema),

  // Metadata
  actors: z.array(z.object({
    id: z.string(),
    name: z.string(),
    type: z.enum(['user', 'system', 'external']),
  })),

  // Requirements traceability
  requirements: z.array(z.string()).optional(),

  // Approval status
  approval: z.object({
    status: z.enum(['pending', 'approved', 'rejected', 'revision_requested']),
    reviewedBy: z.string().optional(),
    reviewedAt: z.string().optional(),
    comments: z.array(z.object({
      stepId: z.string().optional(),
      author: z.string(),
      content: z.string(),
      timestamp: z.string(),
    })).optional(),
    revisionCount: z.number().default(0),
  }),

  // Tags for organization
  tags: z.array(z.string()).optional(),
});

export type UserFlow = z.infer<typeof UserFlowSchema>;

/**
 * Flow collection (all flows for a feature)
 */
export const FlowCollectionSchema = z.object({
  featureId: z.string(),
  featureName: z.string(),
  flows: z.array(UserFlowSchema),
  generatedAt: z.string(),
  generatedBy: z.string(),
});

export type FlowCollection = z.infer<typeof FlowCollectionSchema>;

/**
 * Approval decision
 */
export const ApprovalDecisionSchema = z.object({
  flowId: z.string(),
  decision: z.enum(['approve', 'reject', 'request_revision']),
  reviewer: z.string(),
  timestamp: z.string(),
  comments: z.string().optional(),
  stepComments: z.array(z.object({
    stepId: z.string(),
    comment: z.string(),
  })).optional(),
});

export type ApprovalDecision = z.infer<typeof ApprovalDecisionSchema>;
```

---

## 2. Flow Generator (`src/flows/flow-generator.ts`)

```typescript
/**
 * Flow Generator
 *
 * Generates user flow definitions from feature requirements
 * and mockup information.
 */

import Anthropic from '@anthropic-ai/sdk';
import { v4 as uuidv4 } from 'uuid';
import {
  UserFlow,
  UserFlowSchema,
  FlowStep,
  FlowTransition,
  FlowCollection,
} from './flow-schema';
import { UIDesignerOutput } from '../agents/schemas/ui-designer-output';
import { TaskAnalysis, AgentType } from '../agents/types';
import { config } from '../config';
import { logger } from '../utils/logger';

/**
 * Flow generation options
 */
export interface FlowGeneratorOptions {
  includeErrorFlows: boolean;      // Generate error handling flows
  includeAlternativePaths: boolean; // Generate alternative paths
  maxFlowsPerFeature: number;       // Limit flows per feature
  detailLevel: 'minimal' | 'standard' | 'detailed';
}

const DEFAULT_OPTIONS: FlowGeneratorOptions = {
  includeErrorFlows: true,
  includeAlternativePaths: true,
  maxFlowsPerFeature: 10,
  detailLevel: 'standard',
};

/**
 * Flow Generator class
 */
export class FlowGenerator {
  private client: Anthropic;
  private options: FlowGeneratorOptions;

  constructor(options: Partial<FlowGeneratorOptions> = {}) {
    this.client = new Anthropic({
      apiKey: config.get('anthropic.apiKey'),
    });
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * Generate flows from task analysis and design
   */
  async generateFlows(
    task: TaskAnalysis,
    design: UIDesignerOutput,
    featureId: string,
    featureName: string
  ): Promise<FlowCollection> {
    logger.info('Generating user flows', { featureId, featureName });

    const prompt = this.buildPrompt(task, design);
    const systemPrompt = this.buildSystemPrompt();

    const response = await this.client.messages.create({
      model: config.get('anthropic.model', 'claude-sonnet-4-20250514'),
      max_tokens: 4096,
      system: systemPrompt,
      messages: [{ role: 'user', content: prompt }],
    });

    const textContent = response.content.find(b => b.type === 'text');
    if (!textContent || textContent.type !== 'text') {
      throw new Error('No text response from LLM');
    }

    const flows = this.parseFlows(textContent.text, featureId, featureName);

    logger.info(`Generated ${flows.flows.length} user flows`);
    return flows;
  }

  /**
   * Build system prompt for flow generation
   */
  private buildSystemPrompt(): string {
    return `You are an expert UX designer and user experience analyst.
Your task is to generate user flow definitions from feature requirements and UI designs.

## Output Format
Generate JSON matching this structure:
{
  "flows": [
    {
      "id": "unique-flow-id",
      "name": "Human readable flow name",
      "description": "What this flow accomplishes",
      "startStep": "start-step-id",
      "endSteps": ["end-step-id-1", "end-step-id-2"],
      "steps": [
        {
          "id": "step-id",
          "type": "action|decision|process|input|display|start|end|error",
          "name": "Step name",
          "description": "What happens in this step",
          "mockupRef": "page-id-from-design",
          "userActions": [
            {
              "type": "click|input|submit|navigate|select",
              "target": "Button/Field name",
              "description": "Action description",
              "required": true
            }
          ],
          "systemBehaviors": [
            {
              "type": "api_call|validation|computation|storage",
              "description": "System behavior description",
              "async": false
            }
          ]
        }
      ],
      "transitions": [
        {
          "id": "transition-id",
          "from": "step-id-1",
          "to": "step-id-2",
          "condition": {
            "type": "success|failure|custom",
            "label": "Condition label"
          }
        }
      ],
      "actors": [
        {"id": "user", "name": "User", "type": "user"},
        {"id": "system", "name": "Application", "type": "system"}
      ]
    }
  ]
}

## Flow Design Principles
1. Every flow must have exactly one start step
2. Flows can have multiple end steps (success, cancel, error)
3. Decision points should have clear conditions for each path
4. Include error handling for critical operations
5. Reference mockup IDs for visual context
6. Keep flows focused on a single user goal

## Step Types
- start: Entry point to the flow
- end: Exit point (success or otherwise)
- action: User performs an action
- decision: Branching based on condition
- process: System performs operation
- input: User provides input
- display: Information shown to user
- error: Error handling step`;
  }

  /**
   * Build user prompt with context
   */
  private buildPrompt(task: TaskAnalysis, design: UIDesignerOutput): string {
    let prompt = `## Feature Requirements\n`;
    prompt += `Task Type: ${task.taskType}\n`;
    prompt += `Complexity: ${task.complexity}\n\n`;

    prompt += `## Available UI Pages\n`;
    for (const page of design.pages) {
      prompt += `- ${page.name} (${page.id}): ${page.description}\n`;
      prompt += `  Path: ${page.path}\n`;
      prompt += `  Components: ${page.components.map(c => c.name).join(', ')}\n\n`;
    }

    prompt += `## Generation Options\n`;
    prompt += `- Include error flows: ${this.options.includeErrorFlows}\n`;
    prompt += `- Include alternative paths: ${this.options.includeAlternativePaths}\n`;
    prompt += `- Detail level: ${this.options.detailLevel}\n`;
    prompt += `- Max flows: ${this.options.maxFlowsPerFeature}\n\n`;

    prompt += `Generate comprehensive user flows for this feature. Output valid JSON only.`;

    return prompt;
  }

  /**
   * Parse LLM response into FlowCollection
   */
  private parseFlows(
    text: string,
    featureId: string,
    featureName: string
  ): FlowCollection {
    // Extract JSON from response
    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    const jsonStr = jsonMatch ? jsonMatch[1].trim() : text.trim();

    let parsed: { flows: unknown[] };
    try {
      parsed = JSON.parse(jsonStr);
    } catch (error) {
      throw new Error(`Failed to parse flow JSON: ${error}`);
    }

    // Validate and enhance flows
    const flows: UserFlow[] = [];
    const now = new Date().toISOString();

    for (const rawFlow of parsed.flows) {
      const flow = this.enhanceFlow(rawFlow as Partial<UserFlow>, now);
      const validated = UserFlowSchema.safeParse(flow);

      if (validated.success) {
        flows.push(validated.data);
      } else {
        logger.warn('Flow validation failed', {
          flowId: (rawFlow as any).id,
          errors: validated.error.errors,
        });
      }
    }

    return {
      featureId,
      featureName,
      flows,
      generatedAt: now,
      generatedBy: AgentType.UI_DESIGNER,
    };
  }

  /**
   * Enhance flow with required fields
   */
  private enhanceFlow(flow: Partial<UserFlow>, timestamp: string): UserFlow {
    return {
      id: flow.id || uuidv4(),
      name: flow.name || 'Unnamed Flow',
      description: flow.description || '',
      version: '1.0.0',
      createdAt: timestamp,
      updatedAt: timestamp,
      startStep: flow.startStep || '',
      endSteps: flow.endSteps || [],
      steps: flow.steps || [],
      transitions: flow.transitions || [],
      actors: flow.actors || [
        { id: 'user', name: 'User', type: 'user' },
        { id: 'system', name: 'System', type: 'system' },
      ],
      requirements: flow.requirements || [],
      approval: {
        status: 'pending',
        revisionCount: 0,
      },
      tags: flow.tags || [],
    };
  }

  /**
   * Regenerate a specific flow with feedback
   */
  async regenerateFlow(
    flow: UserFlow,
    feedback: string,
    design: UIDesignerOutput
  ): Promise<UserFlow> {
    logger.info('Regenerating flow with feedback', { flowId: flow.id });

    const prompt = `## Previous Flow
${JSON.stringify(flow, null, 2)}

## Feedback to Address
${feedback}

## Available UI Pages
${design.pages.map(p => `- ${p.name}: ${p.description}`).join('\n')}

Regenerate this flow addressing the feedback. Output valid JSON only.`;

    const response = await this.client.messages.create({
      model: config.get('anthropic.model', 'claude-sonnet-4-20250514'),
      max_tokens: 4096,
      system: this.buildSystemPrompt(),
      messages: [{ role: 'user', content: prompt }],
    });

    const textContent = response.content.find(b => b.type === 'text');
    if (!textContent || textContent.type !== 'text') {
      throw new Error('No text response from LLM');
    }

    const now = new Date().toISOString();
    const rawFlow = JSON.parse(textContent.text.replace(/```(?:json)?|```/g, '').trim());
    const regenerated = this.enhanceFlow(rawFlow, now);

    // Preserve original metadata
    regenerated.id = flow.id;
    regenerated.createdAt = flow.createdAt;
    regenerated.approval.revisionCount = flow.approval.revisionCount + 1;

    return regenerated;
  }

  /**
   * Validate flow structure
   */
  validateFlow(flow: UserFlow): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check start step exists
    const startStep = flow.steps.find(s => s.id === flow.startStep);
    if (!startStep) {
      errors.push(`Start step "${flow.startStep}" not found in steps`);
    }

    // Check end steps exist
    for (const endId of flow.endSteps) {
      const endStep = flow.steps.find(s => s.id === endId);
      if (!endStep) {
        errors.push(`End step "${endId}" not found in steps`);
      }
    }

    // Check all transitions reference valid steps
    for (const transition of flow.transitions) {
      if (!flow.steps.find(s => s.id === transition.from)) {
        errors.push(`Transition from unknown step: ${transition.from}`);
      }
      if (!flow.steps.find(s => s.id === transition.to)) {
        errors.push(`Transition to unknown step: ${transition.to}`);
      }
    }

    // Check for unreachable steps
    const reachable = new Set<string>([flow.startStep]);
    let changed = true;
    while (changed) {
      changed = false;
      for (const t of flow.transitions) {
        if (reachable.has(t.from) && !reachable.has(t.to)) {
          reachable.add(t.to);
          changed = true;
        }
      }
    }

    for (const step of flow.steps) {
      if (!reachable.has(step.id)) {
        errors.push(`Unreachable step: ${step.id}`);
      }
    }

    return { valid: errors.length === 0, errors };
  }
}
```

---

## 3. Diagram Renderer (`src/flows/diagram-renderer.ts`)

```typescript
/**
 * Diagram Renderer
 *
 * Renders user flows as Mermaid diagrams for visualization.
 */

import { UserFlow, FlowStep, FlowTransition } from './flow-schema';

/**
 * Diagram style options
 */
export interface DiagramStyle {
  direction: 'TB' | 'BT' | 'LR' | 'RL';
  theme: 'default' | 'dark' | 'forest' | 'neutral';
  nodeSpacing: number;
  rankSpacing: number;
}

const DEFAULT_STYLE: DiagramStyle = {
  direction: 'TB',
  theme: 'default',
  nodeSpacing: 50,
  rankSpacing: 50,
};

/**
 * Diagram Renderer class
 */
export class DiagramRenderer {
  private style: DiagramStyle;

  constructor(style: Partial<DiagramStyle> = {}) {
    this.style = { ...DEFAULT_STYLE, ...style };
  }

  /**
   * Render flow as Mermaid flowchart
   */
  renderFlowchart(flow: UserFlow): string {
    const lines: string[] = [
      `%%{init: {'theme': '${this.style.theme}'}}%%`,
      `flowchart ${this.style.direction}`,
    ];

    // Render steps (nodes)
    for (const step of flow.steps) {
      lines.push(`    ${this.renderNode(step)}`);
    }

    lines.push('');

    // Render transitions (edges)
    for (const transition of flow.transitions) {
      lines.push(`    ${this.renderEdge(transition)}`);
    }

    // Add styling
    lines.push('');
    lines.push(...this.generateStyles(flow));

    return lines.join('\n');
  }

  /**
   * Render flow as Mermaid state diagram
   */
  renderStateDiagram(flow: UserFlow): string {
    const lines: string[] = [
      `%%{init: {'theme': '${this.style.theme}'}}%%`,
      'stateDiagram-v2',
    ];

    // Add start
    lines.push(`    [*] --> ${this.sanitizeId(flow.startStep)}`);

    // Render transitions
    for (const transition of flow.transitions) {
      const from = this.sanitizeId(transition.from);
      const to = this.sanitizeId(transition.to);
      const label = transition.label || transition.condition?.label || '';

      if (label) {
        lines.push(`    ${from} --> ${to}: ${label}`);
      } else {
        lines.push(`    ${from} --> ${to}`);
      }
    }

    // Add end states
    for (const endId of flow.endSteps) {
      lines.push(`    ${this.sanitizeId(endId)} --> [*]`);
    }

    // Add state descriptions
    lines.push('');
    for (const step of flow.steps) {
      if (step.description) {
        lines.push(`    ${this.sanitizeId(step.id)}: ${step.name}`);
      }
    }

    return lines.join('\n');
  }

  /**
   * Render flow as sequence diagram
   */
  renderSequenceDiagram(flow: UserFlow): string {
    const lines: string[] = [
      `%%{init: {'theme': '${this.style.theme}'}}%%`,
      'sequenceDiagram',
    ];

    // Define actors
    for (const actor of flow.actors) {
      const actorType = actor.type === 'user' ? 'actor' : 'participant';
      lines.push(`    ${actorType} ${actor.id} as ${actor.name}`);
    }

    lines.push('');

    // Walk through flow and generate sequence
    const visited = new Set<string>();
    this.walkFlowForSequence(flow, flow.startStep, visited, lines);

    return lines.join('\n');
  }

  /**
   * Walk flow to generate sequence diagram
   */
  private walkFlowForSequence(
    flow: UserFlow,
    stepId: string,
    visited: Set<string>,
    lines: string[]
  ): void {
    if (visited.has(stepId)) return;
    visited.add(stepId);

    const step = flow.steps.find(s => s.id === stepId);
    if (!step) return;

    // Add user actions
    if (step.userActions) {
      for (const action of step.userActions) {
        lines.push(`    user->>system: ${action.description}`);
      }
    }

    // Add system behaviors
    if (step.systemBehaviors) {
      for (const behavior of step.systemBehaviors) {
        if (behavior.async) {
          lines.push(`    system-->>system: ${behavior.description}`);
        } else {
          lines.push(`    system->>system: ${behavior.description}`);
        }
      }
    }

    // Add display
    if (step.type === 'display') {
      lines.push(`    system-->>user: ${step.description}`);
    }

    // Continue to next steps
    const outgoing = flow.transitions.filter(t => t.from === stepId);
    for (const transition of outgoing) {
      if (transition.condition) {
        lines.push(`    alt ${transition.condition.label}`);
        this.walkFlowForSequence(flow, transition.to, visited, lines);
        lines.push('    end');
      } else {
        this.walkFlowForSequence(flow, transition.to, visited, lines);
      }
    }
  }

  /**
   * Render node based on step type
   */
  private renderNode(step: FlowStep): string {
    const id = this.sanitizeId(step.id);
    const label = this.escapeLabel(step.name);

    switch (step.type) {
      case 'start':
        return `${id}((${label}))`;
      case 'end':
        return `${id}((${label}))`;
      case 'decision':
        return `${id}{${label}}`;
      case 'process':
        return `${id}[[${label}]]`;
      case 'input':
        return `${id}[/${label}/]`;
      case 'display':
        return `${id}[\\${label}\\]`;
      case 'error':
        return `${id}{{${label}}}`;
      case 'action':
      default:
        return `${id}[${label}]`;
    }
  }

  /**
   * Render edge with optional label
   */
  private renderEdge(transition: FlowTransition): string {
    const from = this.sanitizeId(transition.from);
    const to = this.sanitizeId(transition.to);
    const label = transition.label || transition.condition?.label;

    if (label) {
      return `${from} -->|${this.escapeLabel(label)}| ${to}`;
    }
    return `${from} --> ${to}`;
  }

  /**
   * Generate CSS styles for nodes
   */
  private generateStyles(flow: UserFlow): string[] {
    const lines: string[] = [];
    const styleGroups: Record<string, string[]> = {
      start: [],
      end: [],
      decision: [],
      error: [],
      action: [],
    };

    for (const step of flow.steps) {
      const id = this.sanitizeId(step.id);
      if (step.type in styleGroups) {
        styleGroups[step.type].push(id);
      } else {
        styleGroups.action.push(id);
      }
    }

    // Apply styles
    if (styleGroups.start.length > 0) {
      lines.push(`    style ${styleGroups.start.join(',')} fill:#22c55e,stroke:#16a34a,color:#fff`);
    }
    if (styleGroups.end.length > 0) {
      lines.push(`    style ${styleGroups.end.join(',')} fill:#3b82f6,stroke:#2563eb,color:#fff`);
    }
    if (styleGroups.decision.length > 0) {
      lines.push(`    style ${styleGroups.decision.join(',')} fill:#f59e0b,stroke:#d97706,color:#fff`);
    }
    if (styleGroups.error.length > 0) {
      lines.push(`    style ${styleGroups.error.join(',')} fill:#ef4444,stroke:#dc2626,color:#fff`);
    }

    return lines;
  }

  /**
   * Sanitize ID for Mermaid compatibility
   */
  private sanitizeId(id: string): string {
    return id.replace(/[^a-zA-Z0-9]/g, '_');
  }

  /**
   * Escape special characters in labels
   */
  private escapeLabel(label: string): string {
    return label.replace(/"/g, '\\"').replace(/\n/g, '<br/>');
  }

  /**
   * Generate HTML page with diagram
   */
  generateHtmlPage(flow: UserFlow, diagramType: 'flowchart' | 'state' | 'sequence' = 'flowchart'): string {
    let diagram: string;
    switch (diagramType) {
      case 'state':
        diagram = this.renderStateDiagram(flow);
        break;
      case 'sequence':
        diagram = this.renderSequenceDiagram(flow);
        break;
      default:
        diagram = this.renderFlowchart(flow);
    }

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${flow.name} - User Flow</title>
  <script src="https://cdn.jsdelivr.net/npm/mermaid/dist/mermaid.min.js"></script>
  <style>
    body {
      font-family: system-ui, sans-serif;
      max-width: 1200px;
      margin: 0 auto;
      padding: 20px;
      background: #f9fafb;
    }
    h1 { color: #111827; }
    .description { color: #6b7280; margin-bottom: 20px; }
    .mermaid {
      background: white;
      padding: 20px;
      border-radius: 8px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }
    .meta {
      margin-top: 20px;
      padding: 16px;
      background: white;
      border-radius: 8px;
      font-size: 14px;
      color: #6b7280;
    }
  </style>
</head>
<body>
  <h1>${flow.name}</h1>
  <p class="description">${flow.description}</p>

  <div class="mermaid">
${diagram}
  </div>

  <div class="meta">
    <strong>Flow ID:</strong> ${flow.id}<br>
    <strong>Version:</strong> ${flow.version}<br>
    <strong>Created:</strong> ${flow.createdAt}<br>
    <strong>Steps:</strong> ${flow.steps.length}<br>
    <strong>Transitions:</strong> ${flow.transitions.length}
  </div>

  <script>
    mermaid.initialize({ startOnLoad: true, theme: '${this.style.theme}' });
  </script>
</body>
</html>`;
  }
}
```

---

## 4. Approval Gate (`src/flows/approval-gate.ts`)

```typescript
/**
 * Approval Gate
 *
 * Implements the approval workflow for user flows.
 * Pauses execution until user approves or rejects designs.
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import {
  UserFlow,
  FlowCollection,
  ApprovalDecision,
  ApprovalDecisionSchema,
} from './flow-schema';
import { StateStore } from '../persistence/state-store';
import { logger } from '../utils/logger';

/**
 * Approval request status
 */
export interface ApprovalRequest {
  id: string;
  flowCollectionId: string;
  flowIds: string[];
  status: 'pending' | 'approved' | 'rejected' | 'revision_requested';
  createdAt: Date;
  respondedAt?: Date;
  decisions: ApprovalDecision[];
  timeoutMs?: number;
}

/**
 * Approval gate events
 */
export interface ApprovalGateEvents {
  'request:created': (request: ApprovalRequest) => void;
  'request:approved': (request: ApprovalRequest) => void;
  'request:rejected': (request: ApprovalRequest) => void;
  'request:revision': (request: ApprovalRequest) => void;
  'request:timeout': (request: ApprovalRequest) => void;
}

/**
 * Approval Gate class
 */
export class ApprovalGate extends EventEmitter {
  private stateStore: StateStore;
  private pendingRequests: Map<string, ApprovalRequest> = new Map();
  private timeouts: Map<string, NodeJS.Timeout> = new Map();

  constructor(stateStore: StateStore) {
    super();
    this.stateStore = stateStore;
  }

  /**
   * Create an approval request for flows
   */
  async createRequest(
    collection: FlowCollection,
    options: { timeoutMs?: number } = {}
  ): Promise<ApprovalRequest> {
    const request: ApprovalRequest = {
      id: uuidv4(),
      flowCollectionId: collection.featureId,
      flowIds: collection.flows.map(f => f.id),
      status: 'pending',
      createdAt: new Date(),
      decisions: [],
      timeoutMs: options.timeoutMs,
    };

    this.pendingRequests.set(request.id, request);

    // Persist to state store
    await this.stateStore.saveApprovalRequest(request);

    // Set timeout if specified
    if (options.timeoutMs) {
      const timeout = setTimeout(() => {
        this.handleTimeout(request.id);
      }, options.timeoutMs);
      this.timeouts.set(request.id, timeout);
    }

    this.emit('request:created', request);
    logger.info('Approval request created', { requestId: request.id });

    return request;
  }

  /**
   * Wait for approval decision
   */
  async waitForApproval(
    requestId: string,
    pollIntervalMs: number = 1000
  ): Promise<ApprovalRequest> {
    return new Promise((resolve, reject) => {
      const checkStatus = async () => {
        const request = this.pendingRequests.get(requestId);
        if (!request) {
          reject(new Error(`Request not found: ${requestId}`));
          return;
        }

        if (request.status !== 'pending') {
          resolve(request);
          return;
        }

        // Continue polling
        setTimeout(checkStatus, pollIntervalMs);
      };

      checkStatus();
    });
  }

  /**
   * Submit approval decision
   */
  async submitDecision(decision: ApprovalDecision): Promise<ApprovalRequest> {
    // Validate decision
    const validated = ApprovalDecisionSchema.safeParse(decision);
    if (!validated.success) {
      throw new Error(`Invalid decision: ${validated.error.message}`);
    }

    // Find request containing this flow
    let request: ApprovalRequest | undefined;
    for (const [id, req] of this.pendingRequests) {
      if (req.flowIds.includes(decision.flowId)) {
        request = req;
        break;
      }
    }

    if (!request) {
      throw new Error(`No pending request for flow: ${decision.flowId}`);
    }

    // Add decision
    request.decisions.push(validated.data);

    // Check if all flows have decisions
    const allDecided = request.flowIds.every(flowId =>
      request!.decisions.some(d => d.flowId === flowId)
    );

    if (allDecided) {
      request.respondedAt = new Date();

      // Determine overall status
      const hasReject = request.decisions.some(d => d.decision === 'reject');
      const hasRevision = request.decisions.some(d => d.decision === 'request_revision');

      if (hasReject) {
        request.status = 'rejected';
        this.emit('request:rejected', request);
      } else if (hasRevision) {
        request.status = 'revision_requested';
        this.emit('request:revision', request);
      } else {
        request.status = 'approved';
        this.emit('request:approved', request);
      }

      // Clear timeout
      const timeout = this.timeouts.get(request.id);
      if (timeout) {
        clearTimeout(timeout);
        this.timeouts.delete(request.id);
      }

      // Persist final state
      await this.stateStore.saveApprovalRequest(request);
    }

    logger.info('Decision submitted', {
      requestId: request.id,
      flowId: decision.flowId,
      decision: decision.decision,
    });

    return request;
  }

  /**
   * Approve all flows in a request
   */
  async approveAll(
    requestId: string,
    reviewer: string,
    comments?: string
  ): Promise<ApprovalRequest> {
    const request = this.pendingRequests.get(requestId);
    if (!request) {
      throw new Error(`Request not found: ${requestId}`);
    }

    const now = new Date().toISOString();

    for (const flowId of request.flowIds) {
      await this.submitDecision({
        flowId,
        decision: 'approve',
        reviewer,
        timestamp: now,
        comments,
      });
    }

    return this.pendingRequests.get(requestId)!;
  }

  /**
   * Reject all flows in a request
   */
  async rejectAll(
    requestId: string,
    reviewer: string,
    comments: string
  ): Promise<ApprovalRequest> {
    const request = this.pendingRequests.get(requestId);
    if (!request) {
      throw new Error(`Request not found: ${requestId}`);
    }

    const now = new Date().toISOString();

    for (const flowId of request.flowIds) {
      await this.submitDecision({
        flowId,
        decision: 'reject',
        reviewer,
        timestamp: now,
        comments,
      });
    }

    return this.pendingRequests.get(requestId)!;
  }

  /**
   * Get pending requests
   */
  getPendingRequests(): ApprovalRequest[] {
    return Array.from(this.pendingRequests.values())
      .filter(r => r.status === 'pending');
  }

  /**
   * Get request by ID
   */
  getRequest(requestId: string): ApprovalRequest | undefined {
    return this.pendingRequests.get(requestId);
  }

  /**
   * Handle request timeout
   */
  private async handleTimeout(requestId: string): Promise<void> {
    const request = this.pendingRequests.get(requestId);
    if (!request || request.status !== 'pending') {
      return;
    }

    request.status = 'rejected';
    request.respondedAt = new Date();

    await this.stateStore.saveApprovalRequest(request);

    this.emit('request:timeout', request);
    logger.warn('Approval request timed out', { requestId });
  }

  /**
   * Cancel a pending request
   */
  async cancelRequest(requestId: string): Promise<void> {
    const request = this.pendingRequests.get(requestId);
    if (!request) {
      throw new Error(`Request not found: ${requestId}`);
    }

    // Clear timeout
    const timeout = this.timeouts.get(requestId);
    if (timeout) {
      clearTimeout(timeout);
      this.timeouts.delete(requestId);
    }

    // Remove from pending
    this.pendingRequests.delete(requestId);

    logger.info('Approval request cancelled', { requestId });
  }

  /**
   * Load pending requests from store (recovery)
   */
  async loadPendingRequests(): Promise<void> {
    const requests = await this.stateStore.getPendingApprovalRequests();

    for (const request of requests) {
      this.pendingRequests.set(request.id, request);

      // Restore timeouts
      if (request.timeoutMs) {
        const elapsed = Date.now() - request.createdAt.getTime();
        const remaining = request.timeoutMs - elapsed;

        if (remaining > 0) {
          const timeout = setTimeout(() => {
            this.handleTimeout(request.id);
          }, remaining);
          this.timeouts.set(request.id, timeout);
        } else {
          // Already timed out
          await this.handleTimeout(request.id);
        }
      }
    }

    logger.info(`Loaded ${requests.length} pending approval requests`);
  }
}

/**
 * CLI helper for interactive approval
 */
export async function promptForApproval(
  flows: FlowCollection,
  gate: ApprovalGate,
  reviewer: string
): Promise<ApprovalRequest> {
  const request = await gate.createRequest(flows);

  console.log('\n' + '='.repeat(60));
  console.log('APPROVAL REQUIRED');
  console.log('='.repeat(60));
  console.log(`\nFeature: ${flows.featureName}`);
  console.log(`Flows: ${flows.flows.length}`);
  console.log('\nFlows to review:');

  for (const flow of flows.flows) {
    console.log(`  - ${flow.name}: ${flow.description}`);
    console.log(`    Steps: ${flow.steps.length}, Transitions: ${flow.transitions.length}`);
  }

  console.log('\nOptions:');
  console.log('  [A] Approve all');
  console.log('  [R] Reject all');
  console.log('  [V] Request revision');
  console.log('  [D] View detailed flows');
  console.log('');

  // In real implementation, this would use readline or inquirer
  // For now, return the request for CLI handling
  return request;
}
```

---

## 5. Public Exports (`src/flows/index.ts`)

```typescript
/**
 * User Flows Public Exports
 */

// Schema
export * from './flow-schema';

// Generator
export { FlowGenerator, FlowGeneratorOptions } from './flow-generator';

// Diagram Renderer
export { DiagramRenderer, DiagramStyle } from './diagram-renderer';

// Approval Gate
export {
  ApprovalGate,
  ApprovalRequest,
  ApprovalGateEvents,
  promptForApproval,
} from './approval-gate';
```

---

## Test Scenarios

### Test 1: Flow Schema Validation

```typescript
// tests/flows/flow-schema.test.ts
import { describe, it, expect } from 'vitest';
import { UserFlowSchema, FlowStepSchema, FlowTransitionSchema } from '../../src/flows/flow-schema';

describe('Flow Schema', () => {
  it('should validate a complete flow', () => {
    const flow = {
      id: 'login-flow',
      name: 'User Login',
      description: 'Standard login flow',
      version: '1.0.0',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      startStep: 'start',
      endSteps: ['success', 'cancel'],
      steps: [
        { id: 'start', type: 'start', name: 'Start', description: 'Flow entry', styles: { base: {} } },
        { id: 'input', type: 'input', name: 'Enter Credentials', description: 'User enters credentials', styles: { base: {} } },
        { id: 'success', type: 'end', name: 'Success', description: 'Login successful', styles: { base: {} } },
        { id: 'cancel', type: 'end', name: 'Cancel', description: 'User cancelled', styles: { base: {} } },
      ],
      transitions: [
        { id: 't1', from: 'start', to: 'input' },
        { id: 't2', from: 'input', to: 'success', condition: { type: 'success', label: 'Valid credentials' } },
        { id: 't3', from: 'input', to: 'cancel', condition: { type: 'cancel', label: 'User cancels' } },
      ],
      actors: [
        { id: 'user', name: 'User', type: 'user' },
        { id: 'system', name: 'System', type: 'system' },
      ],
      approval: {
        status: 'pending',
        revisionCount: 0,
      },
    };

    const result = UserFlowSchema.safeParse(flow);
    expect(result.success).toBe(true);
  });

  it('should validate step with user actions', () => {
    const step = {
      id: 'submit-form',
      type: 'action',
      name: 'Submit Form',
      description: 'User submits the form',
      userActions: [
        { type: 'click', target: 'Submit Button', description: 'Click submit', required: true },
      ],
      systemBehaviors: [
        { type: 'api_call', description: 'POST /api/submit', async: true },
      ],
    };

    const result = FlowStepSchema.safeParse(step);
    expect(result.success).toBe(true);
  });

  it('should validate transition with condition', () => {
    const transition = {
      id: 'success-transition',
      from: 'validate',
      to: 'success',
      condition: {
        type: 'success',
        label: 'Validation passed',
      },
    };

    const result = FlowTransitionSchema.safeParse(transition);
    expect(result.success).toBe(true);
  });

  it('should reject invalid step type', () => {
    const step = {
      id: 'bad-step',
      type: 'invalid-type',
      name: 'Bad Step',
      description: 'Invalid type',
    };

    const result = FlowStepSchema.safeParse(step);
    expect(result.success).toBe(false);
  });
});
```

### Test 2: Diagram Rendering

```typescript
// tests/flows/diagram-renderer.test.ts
import { describe, it, expect } from 'vitest';
import { DiagramRenderer } from '../../src/flows/diagram-renderer';
import { UserFlow } from '../../src/flows/flow-schema';

describe('DiagramRenderer', () => {
  const sampleFlow: UserFlow = {
    id: 'test-flow',
    name: 'Test Flow',
    description: 'A test flow',
    version: '1.0.0',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    startStep: 'start',
    endSteps: ['end'],
    steps: [
      { id: 'start', type: 'start', name: 'Start', description: 'Begin', styles: { base: {} } },
      { id: 'action1', type: 'action', name: 'Do Action', description: 'Perform action', styles: { base: {} } },
      { id: 'decision1', type: 'decision', name: 'Check', description: 'Decision point', styles: { base: {} } },
      { id: 'end', type: 'end', name: 'End', description: 'Complete', styles: { base: {} } },
    ],
    transitions: [
      { id: 't1', from: 'start', to: 'action1' },
      { id: 't2', from: 'action1', to: 'decision1' },
      { id: 't3', from: 'decision1', to: 'end', label: 'Yes' },
    ],
    actors: [{ id: 'user', name: 'User', type: 'user' }],
    approval: { status: 'pending', revisionCount: 0 },
  };

  it('should render flowchart diagram', () => {
    const renderer = new DiagramRenderer();
    const diagram = renderer.renderFlowchart(sampleFlow);

    expect(diagram).toContain('flowchart TB');
    expect(diagram).toContain('start((Start))');
    expect(diagram).toContain('action1[Do Action]');
    expect(diagram).toContain('decision1{Check}');
    expect(diagram).toContain('end((End))');
    expect(diagram).toContain('-->');
  });

  it('should render state diagram', () => {
    const renderer = new DiagramRenderer();
    const diagram = renderer.renderStateDiagram(sampleFlow);

    expect(diagram).toContain('stateDiagram-v2');
    expect(diagram).toContain('[*] --> start');
    expect(diagram).toContain('end --> [*]');
  });

  it('should apply theme setting', () => {
    const renderer = new DiagramRenderer({ theme: 'dark' });
    const diagram = renderer.renderFlowchart(sampleFlow);

    expect(diagram).toContain("'theme': 'dark'");
  });

  it('should apply direction setting', () => {
    const renderer = new DiagramRenderer({ direction: 'LR' });
    const diagram = renderer.renderFlowchart(sampleFlow);

    expect(diagram).toContain('flowchart LR');
  });

  it('should generate HTML page', () => {
    const renderer = new DiagramRenderer();
    const html = renderer.generateHtmlPage(sampleFlow);

    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain(sampleFlow.name);
    expect(html).toContain('mermaid');
    expect(html).toContain('class="mermaid"');
  });

  it('should escape special characters in labels', () => {
    const flowWithSpecialChars: UserFlow = {
      ...sampleFlow,
      steps: [
        { id: 'step1', type: 'action', name: 'Do "Something"', description: 'Test', styles: { base: {} } },
      ],
    };

    const renderer = new DiagramRenderer();
    const diagram = renderer.renderFlowchart(flowWithSpecialChars);

    expect(diagram).not.toContain('Do "Something"');
    expect(diagram).toContain('Do \\"Something\\"');
  });
});
```

### Test 3: Approval Gate

```typescript
// tests/flows/approval-gate.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ApprovalGate, ApprovalRequest } from '../../src/flows/approval-gate';
import { FlowCollection, UserFlow } from '../../src/flows/flow-schema';

// Mock state store
const mockStateStore = {
  saveApprovalRequest: vi.fn(),
  getPendingApprovalRequests: vi.fn().mockResolvedValue([]),
};

describe('ApprovalGate', () => {
  let gate: ApprovalGate;
  let sampleCollection: FlowCollection;

  beforeEach(() => {
    gate = new ApprovalGate(mockStateStore as any);
    vi.clearAllMocks();

    sampleCollection = {
      featureId: 'feature-1',
      featureName: 'Test Feature',
      flows: [
        {
          id: 'flow-1',
          name: 'Flow 1',
          description: 'First flow',
          version: '1.0.0',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          startStep: 's1',
          endSteps: ['e1'],
          steps: [],
          transitions: [],
          actors: [],
          approval: { status: 'pending', revisionCount: 0 },
        },
        {
          id: 'flow-2',
          name: 'Flow 2',
          description: 'Second flow',
          version: '1.0.0',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          startStep: 's1',
          endSteps: ['e1'],
          steps: [],
          transitions: [],
          actors: [],
          approval: { status: 'pending', revisionCount: 0 },
        },
      ],
      generatedAt: new Date().toISOString(),
      generatedBy: 'test',
    };
  });

  it('should create approval request', async () => {
    const request = await gate.createRequest(sampleCollection);

    expect(request.id).toBeDefined();
    expect(request.status).toBe('pending');
    expect(request.flowIds).toContain('flow-1');
    expect(request.flowIds).toContain('flow-2');
    expect(mockStateStore.saveApprovalRequest).toHaveBeenCalled();
  });

  it('should approve all flows', async () => {
    const request = await gate.createRequest(sampleCollection);
    const approved = await gate.approveAll(request.id, 'test-user', 'Looks good');

    expect(approved.status).toBe('approved');
    expect(approved.decisions).toHaveLength(2);
    expect(approved.decisions.every(d => d.decision === 'approve')).toBe(true);
  });

  it('should reject all flows', async () => {
    const request = await gate.createRequest(sampleCollection);
    const rejected = await gate.rejectAll(request.id, 'test-user', 'Needs work');

    expect(rejected.status).toBe('rejected');
    expect(rejected.decisions.every(d => d.decision === 'reject')).toBe(true);
  });

  it('should handle mixed decisions', async () => {
    const request = await gate.createRequest(sampleCollection);

    await gate.submitDecision({
      flowId: 'flow-1',
      decision: 'approve',
      reviewer: 'test-user',
      timestamp: new Date().toISOString(),
    });

    await gate.submitDecision({
      flowId: 'flow-2',
      decision: 'request_revision',
      reviewer: 'test-user',
      timestamp: new Date().toISOString(),
      comments: 'Please add error handling',
    });

    const finalRequest = gate.getRequest(request.id);
    expect(finalRequest?.status).toBe('revision_requested');
  });

  it('should emit events on approval', async () => {
    const approvedHandler = vi.fn();
    gate.on('request:approved', approvedHandler);

    const request = await gate.createRequest(sampleCollection);
    await gate.approveAll(request.id, 'test-user');

    expect(approvedHandler).toHaveBeenCalledWith(expect.objectContaining({
      status: 'approved',
    }));
  });

  it('should return pending requests', async () => {
    await gate.createRequest(sampleCollection);
    await gate.createRequest(sampleCollection);

    const pending = gate.getPendingRequests();
    expect(pending).toHaveLength(2);
  });

  it('should cancel request', async () => {
    const request = await gate.createRequest(sampleCollection);
    await gate.cancelRequest(request.id);

    expect(gate.getRequest(request.id)).toBeUndefined();
  });
});
```

### Test 4: Flow Generator

```typescript
// tests/flows/flow-generator.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { FlowGenerator } from '../../src/flows/flow-generator';
import { TaskAnalysis, AgentType } from '../../src/agents/types';
import { UIDesignerOutput } from '../../src/agents/schemas/ui-designer-output';

// Mock Anthropic
vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: {
      create: vi.fn().mockResolvedValue({
        content: [{
          type: 'text',
          text: JSON.stringify({
            flows: [{
              id: 'generated-flow',
              name: 'Generated Flow',
              description: 'Auto-generated flow',
              startStep: 'start',
              endSteps: ['end'],
              steps: [
                { id: 'start', type: 'start', name: 'Start', description: 'Begin' },
                { id: 'end', type: 'end', name: 'End', description: 'Complete' },
              ],
              transitions: [
                { id: 't1', from: 'start', to: 'end' },
              ],
            }],
          }),
        }],
      }),
    },
  })),
}));

describe('FlowGenerator', () => {
  let generator: FlowGenerator;
  let mockTask: TaskAnalysis;
  let mockDesign: UIDesignerOutput;

  beforeEach(() => {
    generator = new FlowGenerator();

    mockTask = {
      taskType: 'feature',
      complexity: 'moderate',
      requiresUI: true,
      requiresBackend: true,
      requiresArchitecture: false,
      requiresApproval: true,
      suggestedAgents: [AgentType.UI_DESIGNER],
    };

    mockDesign = {
      projectName: 'test',
      version: '1.0.0',
      generatedAt: new Date().toISOString(),
      pages: [
        {
          id: 'login-page',
          name: 'Login Page',
          title: 'Login',
          description: 'User login page',
          path: '/login',
          layout: { type: 'single-column', regions: [] },
          components: [],
        },
      ],
      sharedComponents: [],
      colorPalette: {} as any,
      typography: {} as any,
      spacing: { unit: 8, scale: [] },
    };
  });

  it('should generate flows from design', async () => {
    const collection = await generator.generateFlows(
      mockTask,
      mockDesign,
      'feature-1',
      'Test Feature'
    );

    expect(collection.featureId).toBe('feature-1');
    expect(collection.featureName).toBe('Test Feature');
    expect(collection.flows).toHaveLength(1);
    expect(collection.flows[0].id).toBe('generated-flow');
  });

  it('should validate generated flows', async () => {
    const collection = await generator.generateFlows(
      mockTask,
      mockDesign,
      'feature-1',
      'Test Feature'
    );

    for (const flow of collection.flows) {
      const validation = generator.validateFlow(flow);
      expect(validation.valid).toBe(true);
    }
  });

  it('should set approval status to pending', async () => {
    const collection = await generator.generateFlows(
      mockTask,
      mockDesign,
      'feature-1',
      'Test Feature'
    );

    for (const flow of collection.flows) {
      expect(flow.approval.status).toBe('pending');
      expect(flow.approval.revisionCount).toBe(0);
    }
  });
});
```

---

## Validation Checklist

```
□ Flow Schema
  □ Step types defined
  □ Transition schema with conditions
  □ User actions and system behaviors
  □ Approval status tracking

□ Flow Generator
  □ Generates from design and task
  □ Creates valid flow structures
  □ Includes actors (user, system)
  □ Validates generated flows

□ Diagram Renderer
  □ Flowchart rendering
  □ State diagram rendering
  □ Sequence diagram rendering
  □ HTML page generation
  □ Theme support

□ Approval Gate
  □ Create approval requests
  □ Submit decisions
  □ Approve/reject all
  □ Event emission
  □ Timeout handling
  □ Request persistence

□ All tests pass
  □ npm run test -- tests/flows/
```

---

## CP1 Completion

With this step complete, **Checkpoint 1: Design System** is finished. The system now has:

1. **Agent Framework** - Base agent class, registry, context manager
2. **UI Designer Agent** - Generates HTML mockups from requirements
3. **Design Tokens** - CSS variable generation, theme support
4. **User Flows** - Flow diagrams, approval gates, redesign loops

### Next Checkpoint

Proceed to **CP2: Git Worktrees** starting with **09-GIT-AGENT.md** to implement feature branch management and parallel agent execution.
