/**
 * Prompt Builder
 *
 * 18-layer prompt architecture for agent execution.
 */

import type { AgentType, ExecutionContext, AgentResult } from '../types.js';
import { logger } from '../utils/logger.js';

const log = logger.child({ component: 'prompt-builder' });

/**
 * Prompt layer types
 */
export type PromptLayerType =
  | 'system_constraints'
  | 'agent_role'
  | 'agent_capabilities'
  | 'task_specification'
  | 'project_context'
  | 'tech_stack'
  | 'coding_standards'
  | 'previous_outputs'
  | 'current_state'
  | 'lessons_learned'
  | 'source_context'
  | 'design_tokens'
  | 'user_flows'
  | 'git_context'
  | 'compliance_rules'
  | 'output_format'
  | 'success_criteria'
  | 'user_prompt';

/**
 * A single prompt layer
 */
export interface PromptLayer {
  type: PromptLayerType;
  content: string;
  priority: number;
  required: boolean;
  tokenEstimate?: number;
}

/**
 * Prompt builder configuration
 */
export interface PromptBuilderConfig {
  maxTokens: number;
  includeSystemConstraints: boolean;
  includeLessons: boolean;
  includeSourceCode: boolean;
  agentTemplates: Map<AgentType, AgentTemplate>;
}

/**
 * Agent-specific template
 */
export interface AgentTemplate {
  role: string;
  capabilities: string[];
  outputFormat: string;
  successCriteria: string[];
  specialInstructions?: string;
}

/**
 * Default system constraints
 */
const SYSTEM_CONSTRAINTS = `You are an AI agent operating within the Aigentflow multi-agent orchestration system.

CONSTRAINTS:
1. Never expose API keys, passwords, or sensitive credentials in outputs
2. Always validate inputs before processing
3. Follow the output format specified
4. Do not perform destructive file operations without explicit approval
5. Report any security concerns immediately
6. Stay within the scope of your assigned role
7. Provide clear reasoning for decisions
8. Include confidence scores when making recommendations`;

/**
 * Default builder configuration
 */
const DEFAULT_CONFIG: PromptBuilderConfig = {
  maxTokens: 8192,
  includeSystemConstraints: true,
  includeLessons: true,
  includeSourceCode: true,
  agentTemplates: new Map(),
};

/**
 * Prompt builder for constructing layered prompts
 */
export class PromptBuilder {
  private layers: PromptLayer[] = [];
  private config: PromptBuilderConfig;
  private agentType?: AgentType;

  constructor(config: Partial<PromptBuilderConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Reset the builder for a new prompt
   */
  reset(): this {
    this.layers = [];
    this.agentType = undefined;
    return this;
  }

  /**
   * Set the agent type for this prompt
   */
  forAgent(type: AgentType): this {
    this.agentType = type;
    return this;
  }

  /**
   * Add a layer to the prompt
   */
  addLayer(layer: PromptLayer): this {
    this.layers.push(layer);
    return this;
  }

  /**
   * Add system constraints layer
   */
  withSystemConstraints(customConstraints?: string): this {
    if (!this.config.includeSystemConstraints) return this;

    this.addLayer({
      type: 'system_constraints',
      content: customConstraints ?? SYSTEM_CONSTRAINTS,
      priority: 0,
      required: true,
    });
    return this;
  }

  /**
   * Add agent role layer
   */
  withAgentRole(template: AgentTemplate): this {
    this.addLayer({
      type: 'agent_role',
      content: `ROLE: ${template.role}`,
      priority: 1,
      required: true,
    });

    this.addLayer({
      type: 'agent_capabilities',
      content: `CAPABILITIES:\n${template.capabilities.map((c) => `- ${c}`).join('\n')}`,
      priority: 2,
      required: true,
    });

    if (template.specialInstructions) {
      this.addLayer({
        type: 'agent_capabilities',
        content: `SPECIAL INSTRUCTIONS:\n${template.specialInstructions}`,
        priority: 3,
        required: false,
      });
    }

    return this;
  }

  /**
   * Add task specification layer
   */
  withTaskSpec(taskId: string, prompt: string): this {
    this.addLayer({
      type: 'task_specification',
      content: `TASK ID: ${taskId}\n\nTASK:\n${prompt}`,
      priority: 4,
      required: true,
    });
    return this;
  }

  /**
   * Add project context layer
   */
  withProjectContext(context: ExecutionContext): this {
    const projectInfo = [
      `Project: ${context.projectConfig.name}`,
      `Version: ${context.projectConfig.version}`,
      `Current State: ${context.currentState}`,
    ];

    this.addLayer({
      type: 'project_context',
      content: `PROJECT CONTEXT:\n${projectInfo.join('\n')}`,
      priority: 5,
      required: true,
    });

    // Tech stack if available
    if (context.projectConfig.techStack) {
      this.addLayer({
        type: 'tech_stack',
        content: `TECH STACK:\n${JSON.stringify(context.projectConfig.techStack, null, 2)}`,
        priority: 6,
        required: false,
      });
    }

    return this;
  }

  /**
   * Add previous outputs layer
   */
  withPreviousOutputs(outputs: Map<AgentType, AgentResult>): this {
    if (outputs.size === 0) return this;

    const outputSummaries: string[] = [];
    for (const [agentType, result] of outputs) {
      if (result.success) {
        outputSummaries.push(
          `--- ${agentType.toUpperCase()} OUTPUT ---\n${this.formatOutput(result.output)}`
        );
      }
    }

    if (outputSummaries.length > 0) {
      this.addLayer({
        type: 'previous_outputs',
        content: `PREVIOUS AGENT OUTPUTS:\n\n${outputSummaries.join('\n\n')}`,
        priority: 7,
        required: false,
      });
    }

    return this;
  }

  /**
   * Add lessons learned layer
   */
  withLessons(lessons: string[]): this {
    if (!this.config.includeLessons || lessons.length === 0) return this;

    this.addLayer({
      type: 'lessons_learned',
      content: `LESSONS LEARNED (apply these insights):\n${lessons.map((l) => `- ${l}`).join('\n')}`,
      priority: 8,
      required: false,
    });
    return this;
  }

  /**
   * Add source code context layer
   */
  withSourceCode(sourceCode: Map<string, string>): this {
    if (!this.config.includeSourceCode || sourceCode.size === 0) return this;

    const codeBlocks: string[] = [];
    for (const [path, content] of sourceCode) {
      codeBlocks.push(`--- ${path} ---\n\`\`\`\n${content}\n\`\`\``);
    }

    this.addLayer({
      type: 'source_context',
      content: `RELEVANT SOURCE CODE:\n\n${codeBlocks.join('\n\n')}`,
      priority: 9,
      required: false,
    });
    return this;
  }

  /**
   * Add design tokens layer
   */
  withDesignTokens(tokens: Record<string, unknown>): this {
    if (Object.keys(tokens).length === 0) return this;

    this.addLayer({
      type: 'design_tokens',
      content: `DESIGN TOKENS:\n${JSON.stringify(tokens, null, 2)}`,
      priority: 10,
      required: false,
    });
    return this;
  }

  /**
   * Add user flows layer
   */
  withUserFlows(flows: unknown[]): this {
    if (flows.length === 0) return this;

    this.addLayer({
      type: 'user_flows',
      content: `USER FLOWS:\n${JSON.stringify(flows, null, 2)}`,
      priority: 11,
      required: false,
    });
    return this;
  }

  /**
   * Add git context layer
   */
  withGitContext(gitStatus?: ExecutionContext['gitStatus']): this {
    if (!gitStatus) return this;

    this.addLayer({
      type: 'git_context',
      content: `GIT STATUS:\nBranch: ${gitStatus.branch}\nWorktree: ${gitStatus.worktree ?? 'main'}\nHas Changes: ${gitStatus.hasChanges}`,
      priority: 12,
      required: false,
    });
    return this;
  }

  /**
   * Add compliance rules layer
   */
  withComplianceRules(rules: string[]): this {
    if (rules.length === 0) return this;

    this.addLayer({
      type: 'compliance_rules',
      content: `COMPLIANCE REQUIREMENTS:\n${rules.map((r) => `- ${r}`).join('\n')}`,
      priority: 13,
      required: false,
    });
    return this;
  }

  /**
   * Add output format layer
   */
  withOutputFormat(format: string): this {
    this.addLayer({
      type: 'output_format',
      content: `OUTPUT FORMAT:\n${format}`,
      priority: 14,
      required: true,
    });
    return this;
  }

  /**
   * Add success criteria layer
   */
  withSuccessCriteria(criteria: string[]): this {
    if (criteria.length === 0) return this;

    this.addLayer({
      type: 'success_criteria',
      content: `SUCCESS CRITERIA:\n${criteria.map((c) => `- ${c}`).join('\n')}`,
      priority: 15,
      required: true,
    });
    return this;
  }

  /**
   * Build the final prompt
   */
  build(): string {
    log.debug('Building prompt', {
      agentType: this.agentType,
      layerCount: this.layers.length,
    });

    // Sort layers by priority
    const sortedLayers = [...this.layers].sort((a, b) => a.priority - b.priority);

    // Calculate total tokens
    let totalTokens = 0;
    const includedLayers: PromptLayer[] = [];

    // First pass: include all required layers
    for (const layer of sortedLayers) {
      const tokens = layer.tokenEstimate ?? this.estimateTokens(layer.content);
      if (layer.required) {
        includedLayers.push(layer);
        totalTokens += tokens;
      }
    }

    // Second pass: include optional layers if within budget
    for (const layer of sortedLayers) {
      if (layer.required) continue;

      const tokens = layer.tokenEstimate ?? this.estimateTokens(layer.content);
      if (totalTokens + tokens <= this.config.maxTokens) {
        includedLayers.push(layer);
        totalTokens += tokens;
      }
    }

    // Sort by priority again and join
    includedLayers.sort((a, b) => a.priority - b.priority);
    const prompt = includedLayers.map((l) => l.content).join('\n\n---\n\n');

    log.debug('Prompt built', {
      finalLayers: includedLayers.length,
      estimatedTokens: totalTokens,
    });

    return prompt;
  }

  /**
   * Build prompt from execution context
   */
  buildFromContext(
    taskId: string,
    prompt: string,
    context: ExecutionContext,
    template: AgentTemplate
  ): string {
    return this.reset()
      .forAgent(this.agentType!)
      .withSystemConstraints()
      .withAgentRole(template)
      .withTaskSpec(taskId, prompt)
      .withProjectContext(context)
      .withPreviousOutputs(context.previousOutputs)
      .withLessons(context.lessonsLearned)
      .withSourceCode(context.sourceCode ?? new Map())
      .withDesignTokens(context.designTokens ?? {})
      .withUserFlows(context.userFlows ?? [])
      .withGitContext(context.gitStatus)
      .withOutputFormat(template.outputFormat)
      .withSuccessCriteria(template.successCriteria)
      .build();
  }

  /**
   * Format output for inclusion in prompt
   */
  private formatOutput(output: unknown): string {
    if (typeof output === 'string') {
      return output;
    }
    return JSON.stringify(output, null, 2);
  }

  /**
   * Estimate token count
   */
  private estimateTokens(text: string): number {
    // Rough estimate: ~4 characters per token
    return Math.ceil(text.length / 4);
  }

  /**
   * Get layer count
   */
  getLayerCount(): number {
    return this.layers.length;
  }
}

// Singleton instance
let instance: PromptBuilder | null = null;

/**
 * Get the prompt builder singleton
 */
export function getPromptBuilder(): PromptBuilder {
  if (!instance) {
    instance = new PromptBuilder();
  }
  return instance;
}

/**
 * Reset the singleton (for testing)
 */
export function resetPromptBuilder(): void {
  instance = null;
}
