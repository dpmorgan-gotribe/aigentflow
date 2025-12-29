# Step 03a: Prompt Architecture

> **Checkpoint:** CP0 - Foundation
> **Previous Step:** 03-STATE-MACHINE.md
> **Next Step:** 04-PERSISTENCE-LAYER.md

---

## Overview

This step implements the **18-layer prompt hierarchy** that governs all agent behavior. The prompt architecture ensures consistent, secure, and effective agent interactions by organizing prompts into distinct functional layers.

Key responsibilities:
- Define the 18-layer prompt structure
- Implement prompt composition and injection
- Manage token allocation across layers
- Enable dynamic prompt customization
- Support prompt versioning and A/B testing

---

## Deliverables

1. `src/prompts/prompt-layer.ts` - Layer definitions and types
2. `src/prompts/prompt-composer.ts` - Prompt composition engine
3. `src/prompts/prompt-registry.ts` - Prompt template registry
4. `src/prompts/token-allocator.ts` - Token budget management
5. `src/prompts/types.ts` - Shared types
6. `system/prompts/` - Prompt template files

---

## The 18-Layer Prompt Hierarchy

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         18-LAYER PROMPT HIERARCHY                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  IDENTITY LAYERS (1-3) ─────────────────────────────────────────────────    │
│  │                                                                           │
│  ├── Layer 1: System Identity      "You are {agent_name}..."               │
│  ├── Layer 2: Role Definition      "Your role is to..."                    │
│  └── Layer 3: Core Principles      "You must always..."                    │
│                                                                              │
│  OPERATIONAL LAYERS (4-6) ──────────────────────────────────────────────    │
│  │                                                                           │
│  ├── Layer 4: Capabilities         "You have access to..."                 │
│  ├── Layer 5: Constraints          "You must NOT..."                       │
│  └── Layer 6: Output Format        "Respond in JSON format..."             │
│                                                                              │
│  CONTEXT LAYERS (7-9) ──────────────────────────────────────────────────    │
│  │                                                                           │
│  ├── Layer 7: Project Context      "Working on project {name}..."          │
│  ├── Layer 8: Task Context         "Current task: {description}..."        │
│  └── Layer 9: Historical Context   "Previous outputs: {...}"               │
│                                                                              │
│  REASONING LAYERS (10-13) ──────────────────────────────────────────────    │
│  │                                                                           │
│  ├── Layer 10: Thinking Framework  "Think step by step..."                 │
│  ├── Layer 11: Decision Criteria   "When deciding, consider..."            │
│  ├── Layer 12: Quality Standards   "Ensure code follows..."                │
│  └── Layer 13: Error Handling      "If you encounter errors..."            │
│                                                                              │
│  META LAYERS (14-18) ───────────────────────────────────────────────────    │
│  │                                                                           │
│  ├── Layer 14: Routing Hints       "Include routing_hints in output..."    │
│  ├── Layer 15: Lessons Learned     "Apply these lessons: {...}"            │
│  ├── Layer 16: Compliance Rules    "Follow compliance requirements..."     │
│  ├── Layer 17: Audit Requirements  "Log all decisions..."                  │
│  └── Layer 18: Self-Reflection     "Before responding, verify..."          │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 1. Types (`src/prompts/types.ts`)

```typescript
/**
 * Prompt Architecture Types
 *
 * Defines the structure for the 18-layer prompt system.
 */

import { z } from 'zod';
import { AgentType } from '../agents/types';

/**
 * Prompt layer categories
 */
export type LayerCategory =
  | 'identity'      // Layers 1-3
  | 'operational'   // Layers 4-6
  | 'context'       // Layers 7-9
  | 'reasoning'     // Layers 10-13
  | 'meta';         // Layers 14-18

/**
 * Individual layer definition
 */
export interface PromptLayer {
  id: number;
  name: string;
  category: LayerCategory;
  description: string;
  required: boolean;
  maxTokens: number;
  priority: number;  // Higher = more important to keep if truncating
  template: string;
  variables: string[];
}

/**
 * Token allocation by category
 */
export interface TokenAllocation {
  identity: number;
  operational: number;
  context: number;
  reasoning: number;
  meta: number;
  total: number;
}

/**
 * Default token allocation (for 100k context window)
 */
export const DEFAULT_TOKEN_ALLOCATION: TokenAllocation = {
  identity: 500,
  operational: 800,
  context: 4000,
  reasoning: 1200,
  meta: 1500,
  total: 8000,  // System prompt budget
};

/**
 * Composed prompt result
 */
export interface ComposedPrompt {
  systemPrompt: string;
  userPrompt: string;
  tokenCount: {
    system: number;
    user: number;
    total: number;
  };
  layersIncluded: number[];
  layersOmitted: number[];
  warnings: string[];
}

/**
 * Prompt template definition
 */
export interface PromptTemplate {
  id: string;
  name: string;
  version: string;
  agentType: AgentType | 'universal';
  layers: Partial<Record<number, string>>;  // Layer ID -> template content
  metadata: {
    author: string;
    created: Date;
    updated: Date;
    description: string;
    tags: string[];
  };
}

/**
 * Variable resolution context
 */
export interface PromptVariables {
  // Identity
  agent_name: string;
  agent_role: string;
  agent_goal: string;

  // Project
  project_name: string;
  project_type: string;
  tech_stack: string;

  // Task
  task_description: string;
  task_type: string;
  task_requirements: string;

  // Context
  previous_outputs: string;
  lessons_learned: string;
  compliance_requirements: string;

  // Dynamic
  [key: string]: string | undefined;
}

/**
 * Prompt composition options
 */
export interface CompositionOptions {
  maxTotalTokens?: number;
  prioritizeLayers?: number[];
  excludeLayers?: number[];
  customVariables?: Record<string, string>;
  includeDebugInfo?: boolean;
}
```

---

## 2. Layer Definitions (`src/prompts/prompt-layer.ts`)

```typescript
/**
 * Prompt Layer Definitions
 *
 * Defines all 18 layers of the prompt hierarchy.
 */

import { PromptLayer, LayerCategory } from './types';

/**
 * Complete layer definitions
 */
export const PROMPT_LAYERS: PromptLayer[] = [
  // ═══════════════════════════════════════════════════════════════════
  // IDENTITY LAYERS (1-3)
  // ═══════════════════════════════════════════════════════════════════
  {
    id: 1,
    name: 'System Identity',
    category: 'identity',
    description: 'Core identity and name of the agent',
    required: true,
    maxTokens: 150,
    priority: 100,
    template: `You are {{agent_name}}, an AI agent in the Aigentflow multi-agent orchestration system.`,
    variables: ['agent_name'],
  },
  {
    id: 2,
    name: 'Role Definition',
    category: 'identity',
    description: 'The specific role and responsibilities',
    required: true,
    maxTokens: 200,
    priority: 95,
    template: `Your role is: {{agent_role}}

Your primary goal is: {{agent_goal}}`,
    variables: ['agent_role', 'agent_goal'],
  },
  {
    id: 3,
    name: 'Core Principles',
    category: 'identity',
    description: 'Fundamental principles the agent must follow',
    required: true,
    maxTokens: 150,
    priority: 90,
    template: `Core Principles:
- Produce high-quality, production-ready outputs
- Follow established patterns and conventions
- Communicate clearly through structured outputs
- Escalate when uncertain rather than guessing`,
    variables: [],
  },

  // ═══════════════════════════════════════════════════════════════════
  // OPERATIONAL LAYERS (4-6)
  // ═══════════════════════════════════════════════════════════════════
  {
    id: 4,
    name: 'Capabilities',
    category: 'operational',
    description: 'Tools and skills available to the agent',
    required: true,
    maxTokens: 300,
    priority: 85,
    template: `Available Tools:
{{available_tools}}

Available Skills:
{{available_skills}}`,
    variables: ['available_tools', 'available_skills'],
  },
  {
    id: 5,
    name: 'Constraints',
    category: 'operational',
    description: 'What the agent must NOT do',
    required: true,
    maxTokens: 250,
    priority: 88,
    template: `Constraints - You must NOT:
{{constraints}}

Security Boundaries:
- Never expose secrets or credentials
- Never execute destructive operations without confirmation
- Never bypass security checks`,
    variables: ['constraints'],
  },
  {
    id: 6,
    name: 'Output Format',
    category: 'operational',
    description: 'Required output structure',
    required: true,
    maxTokens: 250,
    priority: 92,
    template: `Output Format:
You MUST respond with valid JSON matching this schema:

{{output_schema}}

Always include:
- routing_hints: Suggestions for next agent
- audit_trail: Key decisions made
- artifacts: Any files or outputs created`,
    variables: ['output_schema'],
  },

  // ═══════════════════════════════════════════════════════════════════
  // CONTEXT LAYERS (7-9)
  // ═══════════════════════════════════════════════════════════════════
  {
    id: 7,
    name: 'Project Context',
    category: 'context',
    description: 'Information about the current project',
    required: false,
    maxTokens: 1500,
    priority: 70,
    template: `Project Context:
- Name: {{project_name}}
- Type: {{project_type}}
- Tech Stack: {{tech_stack}}

Project Structure:
{{project_structure}}`,
    variables: ['project_name', 'project_type', 'tech_stack', 'project_structure'],
  },
  {
    id: 8,
    name: 'Task Context',
    category: 'context',
    description: 'Current task details',
    required: true,
    maxTokens: 1500,
    priority: 80,
    template: `Current Task:
{{task_description}}

Task Type: {{task_type}}

Requirements:
{{task_requirements}}

Acceptance Criteria:
{{acceptance_criteria}}`,
    variables: ['task_description', 'task_type', 'task_requirements', 'acceptance_criteria'],
  },
  {
    id: 9,
    name: 'Historical Context',
    category: 'context',
    description: 'Previous agent outputs and history',
    required: false,
    maxTokens: 1000,
    priority: 60,
    template: `Previous Agent Outputs (most recent first):
{{previous_outputs}}`,
    variables: ['previous_outputs'],
  },

  // ═══════════════════════════════════════════════════════════════════
  // REASONING LAYERS (10-13)
  // ═══════════════════════════════════════════════════════════════════
  {
    id: 10,
    name: 'Thinking Framework',
    category: 'reasoning',
    description: 'How the agent should think through problems',
    required: false,
    maxTokens: 300,
    priority: 65,
    template: `Thinking Framework:
1. Understand the requirement fully before acting
2. Consider edge cases and error scenarios
3. Think about maintainability and scalability
4. Verify your solution meets all criteria before finalizing`,
    variables: [],
  },
  {
    id: 11,
    name: 'Decision Criteria',
    category: 'reasoning',
    description: 'How to make decisions when facing choices',
    required: false,
    maxTokens: 300,
    priority: 55,
    template: `Decision Criteria:
When facing multiple options, prioritize:
1. Security and safety
2. Correctness and reliability
3. Maintainability
4. Performance
5. Developer experience

{{custom_decision_criteria}}`,
    variables: ['custom_decision_criteria'],
  },
  {
    id: 12,
    name: 'Quality Standards',
    category: 'reasoning',
    description: 'Quality standards for outputs',
    required: false,
    maxTokens: 300,
    priority: 75,
    template: `Quality Standards:
- Code must be production-ready, not prototype quality
- Follow {{coding_style}} coding conventions
- Include proper error handling
- Add meaningful comments for complex logic
- Ensure accessibility compliance (WCAG 2.1 AA)`,
    variables: ['coding_style'],
  },
  {
    id: 13,
    name: 'Error Handling',
    category: 'reasoning',
    description: 'How to handle errors and edge cases',
    required: false,
    maxTokens: 300,
    priority: 72,
    template: `Error Handling:
If you encounter an error or uncertainty:
1. Document the issue clearly in your output
2. Set routing_hints.hasFailures = true
3. Suggest potential solutions if possible
4. Never silently fail or produce incomplete work

Recoverable errors: Retry with modified approach
Unrecoverable errors: Escalate to orchestrator`,
    variables: [],
  },

  // ═══════════════════════════════════════════════════════════════════
  // META LAYERS (14-18)
  // ═══════════════════════════════════════════════════════════════════
  {
    id: 14,
    name: 'Routing Hints',
    category: 'meta',
    description: 'Instructions for routing hint generation',
    required: true,
    maxTokens: 300,
    priority: 85,
    template: `Routing Hints:
Your output MUST include routing_hints with:
- suggestNext: Agent types that should process next
- skipAgents: Agent types to skip
- needsApproval: Whether user approval is needed
- hasFailures: Whether any failures occurred
- isComplete: Whether task is fully complete
- blockedBy: What's blocking progress (if any)`,
    variables: [],
  },
  {
    id: 15,
    name: 'Lessons Learned',
    category: 'meta',
    description: 'Previous lessons to apply',
    required: false,
    maxTokens: 400,
    priority: 50,
    template: `Lessons Learned (apply these insights):
{{lessons_learned}}`,
    variables: ['lessons_learned'],
  },
  {
    id: 16,
    name: 'Compliance Rules',
    category: 'meta',
    description: 'Compliance requirements to follow',
    required: false,
    maxTokens: 400,
    priority: 78,
    template: `Compliance Requirements:
{{compliance_requirements}}

Always ensure:
- Personal data is handled according to requirements
- Audit trail captures compliance-relevant decisions
- Security best practices are followed`,
    variables: ['compliance_requirements'],
  },
  {
    id: 17,
    name: 'Audit Requirements',
    category: 'meta',
    description: 'What to log for audit purposes',
    required: false,
    maxTokens: 200,
    priority: 68,
    template: `Audit Trail:
Include in your output:
- Key decisions made and rationale
- Files created or modified
- External services called
- Any security-relevant actions`,
    variables: [],
  },
  {
    id: 18,
    name: 'Self-Reflection',
    category: 'meta',
    description: 'Final verification before responding',
    required: false,
    maxTokens: 200,
    priority: 45,
    template: `Before finalizing your response, verify:
- [ ] Output matches required schema
- [ ] All requirements addressed
- [ ] No security issues introduced
- [ ] Routing hints are accurate
- [ ] Code is complete and functional`,
    variables: [],
  },
];

/**
 * Get layers by category
 */
export function getLayersByCategory(category: LayerCategory): PromptLayer[] {
  return PROMPT_LAYERS.filter(layer => layer.category === category);
}

/**
 * Get layer by ID
 */
export function getLayerById(id: number): PromptLayer | undefined {
  return PROMPT_LAYERS.find(layer => layer.id === id);
}

/**
 * Get required layers
 */
export function getRequiredLayers(): PromptLayer[] {
  return PROMPT_LAYERS.filter(layer => layer.required);
}

/**
 * Get layers sorted by priority (descending)
 */
export function getLayersByPriority(): PromptLayer[] {
  return [...PROMPT_LAYERS].sort((a, b) => b.priority - a.priority);
}
```

---

## 3. Prompt Composer (`src/prompts/prompt-composer.ts`)

```typescript
/**
 * Prompt Composer
 *
 * Assembles prompts from layers, resolves variables, and manages token budgets.
 */

import {
  PromptLayer,
  PromptVariables,
  ComposedPrompt,
  CompositionOptions,
  TokenAllocation,
  DEFAULT_TOKEN_ALLOCATION,
} from './types';
import { PROMPT_LAYERS, getLayersByPriority, getRequiredLayers } from './prompt-layer';
import { PromptRegistry } from './prompt-registry';
import { TokenAllocator } from './token-allocator';
import { AgentType } from '../agents/types';
import { logger } from '../utils/logger';

/**
 * Prompt Composer class
 */
export class PromptComposer {
  private registry: PromptRegistry;
  private allocator: TokenAllocator;
  private defaultAllocation: TokenAllocation;

  constructor(
    registry: PromptRegistry,
    allocation: TokenAllocation = DEFAULT_TOKEN_ALLOCATION
  ) {
    this.registry = registry;
    this.allocator = new TokenAllocator(allocation);
    this.defaultAllocation = allocation;
  }

  /**
   * Compose a complete prompt for an agent
   */
  async compose(
    agentType: AgentType,
    variables: Partial<PromptVariables>,
    options: CompositionOptions = {}
  ): Promise<ComposedPrompt> {
    const warnings: string[] = [];
    const layersIncluded: number[] = [];
    const layersOmitted: number[] = [];

    // Get agent-specific template overrides
    const template = this.registry.getTemplate(agentType);

    // Start with base layers
    let layers = [...PROMPT_LAYERS];

    // Apply template overrides if available
    if (template) {
      layers = this.applyTemplateOverrides(layers, template);
    }

    // Filter excluded layers
    if (options.excludeLayers?.length) {
      layers = layers.filter(l => !options.excludeLayers!.includes(l.id));
    }

    // Sort by priority for budget allocation
    layers.sort((a, b) => b.priority - a.priority);

    // Resolve variables and compose
    const maxTokens = options.maxTotalTokens || this.defaultAllocation.total;
    let currentTokens = 0;
    const composedSections: string[] = [];

    for (const layer of layers) {
      // Check if we have budget
      const layerContent = this.resolveLayer(layer, variables, options.customVariables);
      const layerTokens = this.allocator.estimateTokens(layerContent);

      if (currentTokens + layerTokens > maxTokens) {
        // Check if required
        if (layer.required) {
          // Must include, but warn
          warnings.push(`Required layer ${layer.id} (${layer.name}) exceeds budget`);
          composedSections.push(layerContent);
          layersIncluded.push(layer.id);
          currentTokens += layerTokens;
        } else {
          // Skip optional layer
          layersOmitted.push(layer.id);
          logger.debug(`Omitting layer ${layer.id} (${layer.name}) - token budget exceeded`);
        }
      } else {
        composedSections.push(layerContent);
        layersIncluded.push(layer.id);
        currentTokens += layerTokens;
      }
    }

    // Compose final system prompt
    const systemPrompt = composedSections.join('\n\n');

    // Build user prompt from task context
    const userPrompt = this.buildUserPrompt(variables);
    const userTokens = this.allocator.estimateTokens(userPrompt);

    return {
      systemPrompt,
      userPrompt,
      tokenCount: {
        system: currentTokens,
        user: userTokens,
        total: currentTokens + userTokens,
      },
      layersIncluded: layersIncluded.sort((a, b) => a - b),
      layersOmitted: layersOmitted.sort((a, b) => a - b),
      warnings,
    };
  }

  /**
   * Resolve a layer's template with variables
   */
  private resolveLayer(
    layer: PromptLayer,
    variables: Partial<PromptVariables>,
    customVariables?: Record<string, string>
  ): string {
    let content = layer.template;

    // Replace all variables
    const allVariables = { ...variables, ...customVariables };

    for (const [key, value] of Object.entries(allVariables)) {
      const placeholder = `{{${key}}}`;
      if (content.includes(placeholder)) {
        content = content.replace(new RegExp(placeholder, 'g'), value || '');
      }
    }

    // Warn about unresolved variables
    const unresolvedMatches = content.match(/\{\{[\w_]+\}\}/g);
    if (unresolvedMatches) {
      logger.warn(`Unresolved variables in layer ${layer.id}: ${unresolvedMatches.join(', ')}`);
      // Replace with empty string
      content = content.replace(/\{\{[\w_]+\}\}/g, '[Not provided]');
    }

    return `## ${layer.name}\n\n${content}`;
  }

  /**
   * Apply template overrides to base layers
   */
  private applyTemplateOverrides(
    layers: PromptLayer[],
    template: { layers: Partial<Record<number, string>> }
  ): PromptLayer[] {
    return layers.map(layer => {
      if (template.layers[layer.id]) {
        return {
          ...layer,
          template: template.layers[layer.id]!,
        };
      }
      return layer;
    });
  }

  /**
   * Build user prompt from task variables
   */
  private buildUserPrompt(variables: Partial<PromptVariables>): string {
    const parts: string[] = [];

    if (variables.task_description) {
      parts.push(`Task: ${variables.task_description}`);
    }

    if (variables.task_requirements) {
      parts.push(`\nRequirements:\n${variables.task_requirements}`);
    }

    return parts.join('\n') || 'Please proceed with the assigned task.';
  }

  /**
   * Get a minimal prompt (required layers only)
   */
  async composeMinimal(
    agentType: AgentType,
    variables: Partial<PromptVariables>
  ): Promise<ComposedPrompt> {
    const requiredLayerIds = getRequiredLayers().map(l => l.id);

    return this.compose(agentType, variables, {
      prioritizeLayers: requiredLayerIds,
      excludeLayers: PROMPT_LAYERS
        .filter(l => !requiredLayerIds.includes(l.id))
        .map(l => l.id),
    });
  }

  /**
   * Validate that a prompt can be composed with given variables
   */
  validateVariables(variables: Partial<PromptVariables>): {
    valid: boolean;
    missing: string[];
    warnings: string[];
  } {
    const requiredLayers = getRequiredLayers();
    const missing: string[] = [];
    const warnings: string[] = [];

    for (const layer of requiredLayers) {
      for (const varName of layer.variables) {
        if (!variables[varName as keyof PromptVariables]) {
          missing.push(varName);
        }
      }
    }

    return {
      valid: missing.length === 0,
      missing: [...new Set(missing)],
      warnings,
    };
  }
}

/**
 * Create a default prompt composer
 */
export function createPromptComposer(): PromptComposer {
  const registry = new PromptRegistry();
  return new PromptComposer(registry);
}
```

---

## 4. Token Allocator (`src/prompts/token-allocator.ts`)

```typescript
/**
 * Token Allocator
 *
 * Manages token budgets across prompt layers.
 */

import { TokenAllocation, LayerCategory } from './types';

/**
 * Simple token estimation (1 token ~= 4 characters for English)
 */
const CHARS_PER_TOKEN = 4;

/**
 * Token Allocator class
 */
export class TokenAllocator {
  private allocation: TokenAllocation;
  private usage: Record<LayerCategory, number>;

  constructor(allocation: TokenAllocation) {
    this.allocation = allocation;
    this.usage = {
      identity: 0,
      operational: 0,
      context: 0,
      reasoning: 0,
      meta: 0,
    };
  }

  /**
   * Estimate tokens for a string
   */
  estimateTokens(text: string): number {
    return Math.ceil(text.length / CHARS_PER_TOKEN);
  }

  /**
   * Check if budget available for category
   */
  hasBudget(category: LayerCategory, tokens: number): boolean {
    return this.usage[category] + tokens <= this.allocation[category];
  }

  /**
   * Allocate tokens for a category
   */
  allocate(category: LayerCategory, tokens: number): boolean {
    if (!this.hasBudget(category, tokens)) {
      return false;
    }
    this.usage[category] += tokens;
    return true;
  }

  /**
   * Get remaining budget for category
   */
  getRemainingBudget(category: LayerCategory): number {
    return this.allocation[category] - this.usage[category];
  }

  /**
   * Get total remaining budget
   */
  getTotalRemaining(): number {
    const totalUsed = Object.values(this.usage).reduce((a, b) => a + b, 0);
    return this.allocation.total - totalUsed;
  }

  /**
   * Get usage summary
   */
  getSummary(): Record<LayerCategory | 'total', { used: number; budget: number; percent: number }> {
    const summary: any = {};

    for (const category of Object.keys(this.usage) as LayerCategory[]) {
      summary[category] = {
        used: this.usage[category],
        budget: this.allocation[category],
        percent: Math.round((this.usage[category] / this.allocation[category]) * 100),
      };
    }

    const totalUsed = Object.values(this.usage).reduce((a, b) => a + b, 0);
    summary.total = {
      used: totalUsed,
      budget: this.allocation.total,
      percent: Math.round((totalUsed / this.allocation.total) * 100),
    };

    return summary;
  }

  /**
   * Reset usage counters
   */
  reset(): void {
    this.usage = {
      identity: 0,
      operational: 0,
      context: 0,
      reasoning: 0,
      meta: 0,
    };
  }

  /**
   * Create adjusted allocation based on context size
   */
  static createForContextSize(contextTokens: number): TokenAllocation {
    // Reserve 8% of context for system prompt
    const systemBudget = Math.floor(contextTokens * 0.08);

    return {
      identity: Math.floor(systemBudget * 0.06),    // 6%
      operational: Math.floor(systemBudget * 0.10),  // 10%
      context: Math.floor(systemBudget * 0.50),      // 50%
      reasoning: Math.floor(systemBudget * 0.15),    // 15%
      meta: Math.floor(systemBudget * 0.19),         // 19%
      total: systemBudget,
    };
  }
}
```

---

## 5. Prompt Registry (`src/prompts/prompt-registry.ts`)

```typescript
/**
 * Prompt Registry
 *
 * Manages prompt templates for different agents and versions.
 */

import { PromptTemplate } from './types';
import { AgentType } from '../agents/types';
import { logger } from '../utils/logger';
import fs from 'fs';
import path from 'path';

/**
 * Prompt Registry class
 */
export class PromptRegistry {
  private templates: Map<string, PromptTemplate> = new Map();
  private agentTemplates: Map<AgentType, string> = new Map();

  constructor() {
    this.loadBuiltInTemplates();
  }

  /**
   * Load built-in templates
   */
  private loadBuiltInTemplates(): void {
    // Templates will be loaded from system/prompts/ directory
    // For now, using defaults
    logger.debug('Prompt registry initialized with default templates');
  }

  /**
   * Register a template
   */
  register(template: PromptTemplate): void {
    const key = `${template.id}@${template.version}`;
    this.templates.set(key, template);

    // Set as default for agent type if not already set
    if (template.agentType !== 'universal' && !this.agentTemplates.has(template.agentType)) {
      this.agentTemplates.set(template.agentType, key);
    }

    logger.debug(`Registered prompt template: ${key}`);
  }

  /**
   * Get template for agent type
   */
  getTemplate(agentType: AgentType): PromptTemplate | undefined {
    const templateKey = this.agentTemplates.get(agentType);
    if (templateKey) {
      return this.templates.get(templateKey);
    }
    return undefined;
  }

  /**
   * Get template by ID and version
   */
  getTemplateById(id: string, version?: string): PromptTemplate | undefined {
    if (version) {
      return this.templates.get(`${id}@${version}`);
    }

    // Find latest version
    const matching = Array.from(this.templates.entries())
      .filter(([key]) => key.startsWith(`${id}@`))
      .sort((a, b) => b[0].localeCompare(a[0]));

    return matching[0]?.[1];
  }

  /**
   * Set default template for agent
   */
  setAgentTemplate(agentType: AgentType, templateId: string, version: string): void {
    const key = `${templateId}@${version}`;
    if (!this.templates.has(key)) {
      throw new Error(`Template not found: ${key}`);
    }
    this.agentTemplates.set(agentType, key);
  }

  /**
   * List all registered templates
   */
  listTemplates(): Array<{ id: string; version: string; agentType: string }> {
    return Array.from(this.templates.values()).map(t => ({
      id: t.id,
      version: t.version,
      agentType: t.agentType,
    }));
  }

  /**
   * Load templates from directory
   */
  async loadFromDirectory(dir: string): Promise<number> {
    if (!fs.existsSync(dir)) {
      logger.warn(`Prompt template directory not found: ${dir}`);
      return 0;
    }

    const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));
    let loaded = 0;

    for (const file of files) {
      try {
        const content = fs.readFileSync(path.join(dir, file), 'utf-8');
        const template = JSON.parse(content) as PromptTemplate;
        this.register(template);
        loaded++;
      } catch (error) {
        logger.error(`Failed to load template ${file}: ${error}`);
      }
    }

    logger.info(`Loaded ${loaded} prompt templates from ${dir}`);
    return loaded;
  }
}
```

---

## 6. Public Exports (`src/prompts/index.ts`)

```typescript
/**
 * Prompt Architecture Public Exports
 */

// Types
export * from './types';

// Layers
export {
  PROMPT_LAYERS,
  getLayersByCategory,
  getLayerById,
  getRequiredLayers,
  getLayersByPriority,
} from './prompt-layer';

// Composer
export { PromptComposer, createPromptComposer } from './prompt-composer';

// Allocator
export { TokenAllocator } from './token-allocator';

// Registry
export { PromptRegistry } from './prompt-registry';
```

---

## Test Scenarios

### Test 1: Layer Definitions

```typescript
// tests/prompts/prompt-layer.test.ts
import { describe, it, expect } from 'vitest';
import {
  PROMPT_LAYERS,
  getLayersByCategory,
  getRequiredLayers,
  getLayerById,
} from '../../src/prompts/prompt-layer';

describe('Prompt Layers', () => {
  it('should have exactly 18 layers', () => {
    expect(PROMPT_LAYERS).toHaveLength(18);
  });

  it('should have unique layer IDs', () => {
    const ids = PROMPT_LAYERS.map(l => l.id);
    expect(new Set(ids).size).toBe(18);
  });

  it('should have IDs from 1 to 18', () => {
    const ids = PROMPT_LAYERS.map(l => l.id).sort((a, b) => a - b);
    expect(ids).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18]);
  });

  it('should have correct category distribution', () => {
    expect(getLayersByCategory('identity')).toHaveLength(3);
    expect(getLayersByCategory('operational')).toHaveLength(3);
    expect(getLayersByCategory('context')).toHaveLength(3);
    expect(getLayersByCategory('reasoning')).toHaveLength(4);
    expect(getLayersByCategory('meta')).toHaveLength(5);
  });

  it('should have at least 5 required layers', () => {
    const required = getRequiredLayers();
    expect(required.length).toBeGreaterThanOrEqual(5);
  });

  it('should get layer by ID', () => {
    const layer = getLayerById(1);
    expect(layer?.name).toBe('System Identity');
  });
});
```

### Test 2: Prompt Composer

```typescript
// tests/prompts/prompt-composer.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { PromptComposer, createPromptComposer } from '../../src/prompts/prompt-composer';
import { PromptRegistry } from '../../src/prompts/prompt-registry';
import { AgentType } from '../../src/agents/types';

describe('PromptComposer', () => {
  let composer: PromptComposer;

  beforeEach(() => {
    composer = createPromptComposer();
  });

  it('should compose prompt with required layers', async () => {
    const result = await composer.compose(AgentType.UI_DESIGNER, {
      agent_name: 'UI Designer',
      agent_role: 'Design user interfaces',
      agent_goal: 'Create beautiful mockups',
      task_description: 'Design a login page',
    });

    expect(result.systemPrompt).toContain('UI Designer');
    expect(result.systemPrompt).toContain('Design user interfaces');
    expect(result.layersIncluded.length).toBeGreaterThan(0);
  });

  it('should include all required layers', async () => {
    const result = await composer.compose(AgentType.FRONTEND_DEV, {
      agent_name: 'Frontend Developer',
      agent_role: 'Build UI components',
      agent_goal: 'Implement designs',
    });

    // Required layers: 1, 2, 3, 4, 5, 6, 8, 14
    expect(result.layersIncluded).toContain(1);
    expect(result.layersIncluded).toContain(2);
    expect(result.layersIncluded).toContain(6);
    expect(result.layersIncluded).toContain(14);
  });

  it('should respect token budget', async () => {
    const result = await composer.compose(AgentType.TESTER, {
      agent_name: 'Tester',
    }, {
      maxTotalTokens: 1000,
    });

    expect(result.tokenCount.system).toBeLessThanOrEqual(1200); // Some flexibility
    expect(result.layersOmitted.length).toBeGreaterThan(0);
  });

  it('should validate variables', () => {
    const validation = composer.validateVariables({
      agent_name: 'Test',
    });

    expect(validation.valid).toBe(false);
    expect(validation.missing.length).toBeGreaterThan(0);
  });
});
```

### Test 3: Token Allocator

```typescript
// tests/prompts/token-allocator.test.ts
import { describe, it, expect } from 'vitest';
import { TokenAllocator } from '../../src/prompts/token-allocator';
import { DEFAULT_TOKEN_ALLOCATION } from '../../src/prompts/types';

describe('TokenAllocator', () => {
  it('should estimate tokens correctly', () => {
    const allocator = new TokenAllocator(DEFAULT_TOKEN_ALLOCATION);

    // ~4 chars per token
    expect(allocator.estimateTokens('hello')).toBe(2);
    expect(allocator.estimateTokens('hello world!')).toBe(3);
  });

  it('should track budget usage', () => {
    const allocator = new TokenAllocator(DEFAULT_TOKEN_ALLOCATION);

    expect(allocator.hasBudget('identity', 100)).toBe(true);
    allocator.allocate('identity', 100);
    expect(allocator.getRemainingBudget('identity')).toBe(400);
  });

  it('should prevent over-allocation', () => {
    const allocator = new TokenAllocator(DEFAULT_TOKEN_ALLOCATION);

    expect(allocator.allocate('identity', 1000)).toBe(false);
  });

  it('should create allocation for context size', () => {
    const allocation = TokenAllocator.createForContextSize(100000);

    expect(allocation.total).toBe(8000); // 8% of 100k
    expect(allocation.context).toBeGreaterThan(allocation.identity);
  });
});
```

---

## Validation Checklist

```
□ 18 layers defined with correct categories
□ All required layers marked
□ Priority system working
□ Variable resolution working
□ Token budget enforcement working
□ Template registry loading
□ Prompt composition produces valid output
□ All tests pass
```

---

## Next Step

Proceed to **04-PERSISTENCE-LAYER.md** to implement state persistence.
