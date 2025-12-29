# Step 05: Agent Framework

> **Checkpoint:** CP1 - Design System
> **Previous Step:** 04-PERSISTENCE-LAYER.md
> **Next Step:** 06-UI-DESIGNER-AGENT.md

---

## Overview

This step implements the foundational agent framework that all specialized agents will inherit from. The framework provides:

- Base agent class with common lifecycle methods
- Agent registry for dynamic agent loading and routing
- Context manager for providing curated context to agents
- Structured JSON output format with routing hints
- Error handling and retry logic

---

## Deliverables

1. `src/agents/base-agent.ts` - Abstract base class for all agents
2. `src/agents/registry.ts` - Agent registry for dynamic loading
3. `src/agents/context-manager.ts` - Context curation for agents
4. `src/agents/types.ts` - Shared types for agent system
5. `src/agents/index.ts` - Public exports

---

## File Structure

```
src/agents/
├── base-agent.ts       # Abstract BaseAgent class
├── registry.ts         # AgentRegistry singleton
├── context-manager.ts  # ContextManager for curated context
├── types.ts            # Shared agent types
├── index.ts            # Public exports
└── agents/             # Individual agent implementations (future steps)
    └── .gitkeep
```

---

## 1. Agent Types (`src/agents/types.ts`)

```typescript
/**
 * Agent Types - Shared types for the agent system
 */

import { AgentType, TaskAnalysis } from '../state/types';

/**
 * Agent capability declaration
 */
export interface AgentCapability {
  name: string;
  description: string;
  inputTypes: string[];
  outputTypes: string[];
}

/**
 * Agent metadata for registry
 */
export interface AgentMetadata {
  id: AgentType;
  name: string;
  description: string;
  version: string;
  capabilities: AgentCapability[];
  requiredContext: ContextRequirement[];
  outputSchema: string; // JSON Schema reference
}

/**
 * Context requirement declaration
 */
export interface ContextRequirement {
  type: ContextType;
  required: boolean;
  maxItems?: number;
  filter?: Record<string, unknown>;
}

/**
 * Types of context that can be provided to agents
 */
export type ContextType =
  | 'project_config'
  | 'design_tokens'
  | 'user_flows'
  | 'mockups'
  | 'source_code'
  | 'test_results'
  | 'git_status'
  | 'lessons_learned'
  | 'execution_history'
  | 'current_task'
  | 'agent_outputs';

/**
 * Context item wrapper
 */
export interface ContextItem {
  type: ContextType;
  content: unknown;
  metadata: {
    source: string;
    timestamp: Date;
    relevance?: number;
  };
}

/**
 * Curated context provided to agents
 */
export interface AgentContext {
  projectId: string;
  executionId: string;
  task: TaskAnalysis;
  items: ContextItem[];
  previousOutputs: AgentOutput[];
  constraints: AgentConstraints;
}

/**
 * Constraints applied to agent execution
 */
export interface AgentConstraints {
  maxTokens: number;
  maxRetries: number;
  timeoutMs: number;
  allowedTools: string[];
  forbiddenPatterns: string[]; // Patterns to avoid in output
}

/**
 * Agent output structure (from state/types.ts, re-exported for convenience)
 */
export interface AgentOutput {
  agentId: AgentType;
  executionId: string;
  timestamp: Date;
  success: boolean;
  result: unknown;
  artifacts: Artifact[];
  routingHints: RoutingHints;
  metrics: ExecutionMetrics;
  errors?: AgentError[];
}

/**
 * Routing hints for orchestrator
 */
export interface RoutingHints {
  suggestNext: AgentType[];
  skipAgents: AgentType[];
  needsApproval: boolean;
  hasFailures: boolean;
  isComplete: boolean;
  blockedBy?: string;
  notes?: string;
}

/**
 * Artifact produced by agent
 */
export interface Artifact {
  id: string;
  type: ArtifactType;
  path: string;
  content?: string;
  metadata: Record<string, unknown>;
}

/**
 * Types of artifacts agents can produce
 */
export type ArtifactType =
  | 'mockup'
  | 'stylesheet'
  | 'flow_diagram'
  | 'source_file'
  | 'test_file'
  | 'config_file'
  | 'documentation'
  | 'report';

/**
 * Execution metrics for tracing
 */
export interface ExecutionMetrics {
  startTime: Date;
  endTime: Date;
  durationMs: number;
  tokensUsed: number;
  llmCalls: number;
  retryCount: number;
  cacheHits: number;
}

/**
 * Agent error structure
 */
export interface AgentError {
  code: string;
  message: string;
  recoverable: boolean;
  context?: Record<string, unknown>;
  stack?: string;
}

/**
 * Agent execution request
 */
export interface AgentRequest {
  executionId: string;
  task: TaskAnalysis;
  context: AgentContext;
  options?: AgentExecutionOptions;
}

/**
 * Optional execution settings
 */
export interface AgentExecutionOptions {
  dryRun?: boolean;
  verbose?: boolean;
  overrideConstraints?: Partial<AgentConstraints>;
}

/**
 * Agent status for monitoring
 */
export interface AgentStatus {
  agentId: AgentType;
  state: 'idle' | 'running' | 'completed' | 'failed';
  currentTask?: string;
  progress?: number;
  lastExecution?: Date;
  consecutiveFailures: number;
}
```

---

## 2. Base Agent (`src/agents/base-agent.ts`)

```typescript
/**
 * BaseAgent - Abstract base class for all agents
 *
 * All specialized agents inherit from this class and implement
 * the abstract methods for their specific behavior.
 */

import Anthropic from '@anthropic-ai/sdk';
import { v4 as uuidv4 } from 'uuid';
import {
  AgentMetadata,
  AgentContext,
  AgentOutput,
  AgentRequest,
  AgentError,
  ExecutionMetrics,
  RoutingHints,
  Artifact,
  AgentType,
} from './types';
import { logger } from '../utils/logger';
import { config } from '../config';

/**
 * Abstract base class for all agents
 */
export abstract class BaseAgent {
  protected client: Anthropic;
  protected metadata: AgentMetadata;
  private status: 'idle' | 'running' | 'completed' | 'failed' = 'idle';
  private consecutiveFailures = 0;

  constructor(metadata: AgentMetadata) {
    this.metadata = metadata;
    this.client = new Anthropic({
      apiKey: config.get('anthropic.apiKey'),
    });
  }

  /**
   * Get agent metadata
   */
  getMetadata(): AgentMetadata {
    return this.metadata;
  }

  /**
   * Get agent ID
   */
  getId(): AgentType {
    return this.metadata.id;
  }

  /**
   * Get current status
   */
  getStatus(): 'idle' | 'running' | 'completed' | 'failed' {
    return this.status;
  }

  /**
   * Execute the agent with given request
   */
  async execute(request: AgentRequest): Promise<AgentOutput> {
    const metrics: Partial<ExecutionMetrics> = {
      startTime: new Date(),
      tokensUsed: 0,
      llmCalls: 0,
      retryCount: 0,
      cacheHits: 0,
    };

    this.status = 'running';
    const errors: AgentError[] = [];

    try {
      // Validate context
      this.validateContext(request.context);

      // Build system prompt
      const systemPrompt = this.buildSystemPrompt(request.context);

      // Build user prompt
      const userPrompt = this.buildUserPrompt(request);

      // Execute with retry logic
      const maxRetries = request.context.constraints.maxRetries;
      let result: unknown = null;
      let artifacts: Artifact[] = [];

      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          metrics.llmCalls = (metrics.llmCalls || 0) + 1;

          const response = await this.callLLM(systemPrompt, userPrompt, request);

          metrics.tokensUsed = (metrics.tokensUsed || 0) +
            (response.usage?.input_tokens || 0) +
            (response.usage?.output_tokens || 0);

          // Parse and validate response
          const parsed = this.parseResponse(response);

          // Process the parsed response
          const processed = await this.processResult(parsed, request);
          result = processed.result;
          artifacts = processed.artifacts;

          break; // Success, exit retry loop
        } catch (error) {
          metrics.retryCount = (metrics.retryCount || 0) + 1;

          const agentError = this.wrapError(error);
          errors.push(agentError);

          if (!agentError.recoverable || attempt === maxRetries) {
            throw error;
          }

          // Wait before retry with exponential backoff
          await this.delay(Math.pow(2, attempt) * 1000);
        }
      }

      // Generate routing hints
      const routingHints = this.generateRoutingHints(result, artifacts, request);

      // Complete metrics
      metrics.endTime = new Date();
      metrics.durationMs = metrics.endTime.getTime() - metrics.startTime!.getTime();

      this.status = 'completed';
      this.consecutiveFailures = 0;

      return {
        agentId: this.metadata.id,
        executionId: request.executionId,
        timestamp: new Date(),
        success: true,
        result,
        artifacts,
        routingHints,
        metrics: metrics as ExecutionMetrics,
        errors: errors.length > 0 ? errors : undefined,
      };

    } catch (error) {
      this.status = 'failed';
      this.consecutiveFailures++;

      metrics.endTime = new Date();
      metrics.durationMs = metrics.endTime!.getTime() - metrics.startTime!.getTime();

      const finalError = this.wrapError(error);
      errors.push(finalError);

      return {
        agentId: this.metadata.id,
        executionId: request.executionId,
        timestamp: new Date(),
        success: false,
        result: null,
        artifacts: [],
        routingHints: {
          suggestNext: [],
          skipAgents: [],
          needsApproval: false,
          hasFailures: true,
          isComplete: false,
          blockedBy: finalError.message,
        },
        metrics: metrics as ExecutionMetrics,
        errors,
      };
    }
  }

  /**
   * Validate that required context is present
   */
  protected validateContext(context: AgentContext): void {
    for (const req of this.metadata.requiredContext) {
      if (req.required) {
        const hasContext = context.items.some(item => item.type === req.type);
        if (!hasContext) {
          throw new Error(`Missing required context: ${req.type}`);
        }
      }
    }
  }

  /**
   * Build the system prompt for the LLM
   * Override in subclasses for specialized prompts
   */
  protected abstract buildSystemPrompt(context: AgentContext): string;

  /**
   * Build the user prompt for the LLM
   * Override in subclasses for specialized prompts
   */
  protected abstract buildUserPrompt(request: AgentRequest): string;

  /**
   * Parse the LLM response into structured data
   * Override in subclasses for specialized parsing
   */
  protected abstract parseResponse(response: Anthropic.Message): unknown;

  /**
   * Process the parsed result and generate artifacts
   * Override in subclasses for specialized processing
   */
  protected abstract processResult(
    parsed: unknown,
    request: AgentRequest
  ): Promise<{ result: unknown; artifacts: Artifact[] }>;

  /**
   * Generate routing hints based on result
   * Override in subclasses for specialized routing logic
   */
  protected abstract generateRoutingHints(
    result: unknown,
    artifacts: Artifact[],
    request: AgentRequest
  ): RoutingHints;

  /**
   * Call the LLM with the given prompts
   */
  protected async callLLM(
    systemPrompt: string,
    userPrompt: string,
    request: AgentRequest
  ): Promise<Anthropic.Message> {
    const response = await this.client.messages.create({
      model: config.get('anthropic.model', 'claude-sonnet-4-20250514'),
      max_tokens: request.context.constraints.maxTokens,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: userPrompt,
        },
      ],
    });

    return response;
  }

  /**
   * Extract text content from LLM response
   */
  protected extractTextContent(response: Anthropic.Message): string {
    const textBlock = response.content.find(block => block.type === 'text');
    if (!textBlock || textBlock.type !== 'text') {
      throw new Error('No text content in LLM response');
    }
    return textBlock.text;
  }

  /**
   * Parse JSON from LLM response, handling markdown code blocks
   */
  protected parseJSON<T>(text: string): T {
    // Try to extract JSON from markdown code block
    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    const jsonStr = jsonMatch ? jsonMatch[1].trim() : text.trim();

    try {
      return JSON.parse(jsonStr) as T;
    } catch (error) {
      throw new Error(`Failed to parse JSON response: ${error}`);
    }
  }

  /**
   * Wrap an error into AgentError format
   */
  protected wrapError(error: unknown): AgentError {
    if (error instanceof Error) {
      return {
        code: error.name,
        message: error.message,
        recoverable: this.isRecoverableError(error),
        stack: error.stack,
      };
    }
    return {
      code: 'UNKNOWN_ERROR',
      message: String(error),
      recoverable: false,
    };
  }

  /**
   * Determine if an error is recoverable (can retry)
   */
  protected isRecoverableError(error: Error): boolean {
    // Rate limit errors are recoverable
    if (error.message.includes('rate_limit')) return true;
    // Timeout errors are recoverable
    if (error.message.includes('timeout')) return true;
    // Server errors might be recoverable
    if (error.message.includes('500') || error.message.includes('503')) return true;
    return false;
  }

  /**
   * Delay helper for retry logic
   */
  protected delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Generate a unique artifact ID
   */
  protected generateArtifactId(): string {
    return uuidv4();
  }

  /**
   * Log agent activity
   */
  protected log(level: 'debug' | 'info' | 'warn' | 'error', message: string, meta?: Record<string, unknown>): void {
    logger[level](`[${this.metadata.id}] ${message}`, meta);
  }
}

/**
 * Default constraints if not specified
 */
export const DEFAULT_CONSTRAINTS = {
  maxTokens: 4096,
  maxRetries: 3,
  timeoutMs: 60000,
  allowedTools: [],
  forbiddenPatterns: [],
};
```

---

## 3. Agent Registry (`src/agents/registry.ts`)

```typescript
/**
 * AgentRegistry - Singleton registry for all agents
 *
 * Manages agent registration, lookup, and lifecycle.
 * Agents are loaded dynamically and cached for reuse.
 */

import { BaseAgent } from './base-agent';
import { AgentMetadata, AgentStatus, AgentType } from './types';
import { logger } from '../utils/logger';

/**
 * Agent constructor type
 */
type AgentConstructor = new () => BaseAgent;

/**
 * Registry entry for an agent
 */
interface RegistryEntry {
  metadata: AgentMetadata;
  constructor: AgentConstructor;
  instance?: BaseAgent;
  loadedAt?: Date;
}

/**
 * Singleton registry for all agents
 */
export class AgentRegistry {
  private static instance: AgentRegistry;
  private agents: Map<AgentType, RegistryEntry> = new Map();
  private initialized = false;

  private constructor() {}

  /**
   * Get singleton instance
   */
  static getInstance(): AgentRegistry {
    if (!AgentRegistry.instance) {
      AgentRegistry.instance = new AgentRegistry();
    }
    return AgentRegistry.instance;
  }

  /**
   * Register an agent class
   */
  register(constructor: AgentConstructor): void {
    // Create temporary instance to get metadata
    const tempInstance = new constructor();
    const metadata = tempInstance.getMetadata();

    if (this.agents.has(metadata.id)) {
      logger.warn(`Agent ${metadata.id} is already registered, overwriting`);
    }

    this.agents.set(metadata.id, {
      metadata,
      constructor,
    });

    logger.debug(`Registered agent: ${metadata.id} (${metadata.name})`);
  }

  /**
   * Get agent instance by type (lazy instantiation)
   */
  getAgent(type: AgentType): BaseAgent {
    const entry = this.agents.get(type);
    if (!entry) {
      throw new Error(`Agent not found: ${type}`);
    }

    // Lazy instantiate if needed
    if (!entry.instance) {
      entry.instance = new entry.constructor();
      entry.loadedAt = new Date();
      logger.debug(`Instantiated agent: ${type}`);
    }

    return entry.instance;
  }

  /**
   * Check if agent is registered
   */
  hasAgent(type: AgentType): boolean {
    return this.agents.has(type);
  }

  /**
   * Get all registered agent types
   */
  getAgentTypes(): AgentType[] {
    return Array.from(this.agents.keys());
  }

  /**
   * Get all agent metadata
   */
  getAllMetadata(): AgentMetadata[] {
    return Array.from(this.agents.values()).map(entry => entry.metadata);
  }

  /**
   * Get agent metadata by type
   */
  getMetadata(type: AgentType): AgentMetadata | undefined {
    return this.agents.get(type)?.metadata;
  }

  /**
   * Get status of all agents
   */
  getAgentStatuses(): AgentStatus[] {
    return Array.from(this.agents.entries()).map(([type, entry]) => ({
      agentId: type,
      state: entry.instance?.getStatus() || 'idle',
      lastExecution: entry.loadedAt,
      consecutiveFailures: 0, // TODO: Track failures
    }));
  }

  /**
   * Find agents that match given capabilities
   */
  findAgentsByCapability(capabilityName: string): AgentType[] {
    const matching: AgentType[] = [];

    for (const [type, entry] of this.agents) {
      const hasCapability = entry.metadata.capabilities.some(
        cap => cap.name === capabilityName
      );
      if (hasCapability) {
        matching.push(type);
      }
    }

    return matching;
  }

  /**
   * Find agents that can handle given input type
   */
  findAgentsByInputType(inputType: string): AgentType[] {
    const matching: AgentType[] = [];

    for (const [type, entry] of this.agents) {
      const canHandle = entry.metadata.capabilities.some(
        cap => cap.inputTypes.includes(inputType)
      );
      if (canHandle) {
        matching.push(type);
      }
    }

    return matching;
  }

  /**
   * Reset a specific agent instance
   */
  resetAgent(type: AgentType): void {
    const entry = this.agents.get(type);
    if (entry) {
      entry.instance = undefined;
      entry.loadedAt = undefined;
      logger.debug(`Reset agent: ${type}`);
    }
  }

  /**
   * Reset all agent instances
   */
  resetAll(): void {
    for (const type of this.agents.keys()) {
      this.resetAgent(type);
    }
    logger.info('Reset all agent instances');
  }

  /**
   * Initialize registry with all built-in agents
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    // Import and register all built-in agents
    // These will be added as we implement each agent
    // Example:
    // const { UIDesignerAgent } = await import('./agents/ui-designer');
    // this.register(UIDesignerAgent);

    this.initialized = true;
    logger.info(`Agent registry initialized with ${this.agents.size} agents`);
  }

  /**
   * Get registry statistics
   */
  getStats(): {
    totalRegistered: number;
    totalInstantiated: number;
    agentsByCapability: Record<string, number>;
  } {
    const stats = {
      totalRegistered: this.agents.size,
      totalInstantiated: 0,
      agentsByCapability: {} as Record<string, number>,
    };

    for (const entry of this.agents.values()) {
      if (entry.instance) {
        stats.totalInstantiated++;
      }

      for (const cap of entry.metadata.capabilities) {
        stats.agentsByCapability[cap.name] =
          (stats.agentsByCapability[cap.name] || 0) + 1;
      }
    }

    return stats;
  }
}

/**
 * Get the singleton registry instance
 */
export function getRegistry(): AgentRegistry {
  return AgentRegistry.getInstance();
}

/**
 * Decorator for agent registration
 * Usage: @RegisterAgent
 */
export function RegisterAgent(constructor: AgentConstructor): void {
  getRegistry().register(constructor);
}
```

---

## 4. Context Manager (`src/agents/context-manager.ts`)

```typescript
/**
 * ContextManager - Curates context for agent execution
 *
 * Provides relevant context to agents based on their requirements.
 * Handles context retrieval, filtering, and relevance scoring.
 */

import {
  ContextType,
  ContextItem,
  ContextRequirement,
  AgentContext,
  AgentConstraints,
} from './types';
import { AgentType, TaskAnalysis } from '../state/types';
import { StateStore } from '../persistence/state-store';
import { LessonsStore } from '../persistence/lessons-store';
import { ExecutionTracker } from '../persistence/execution-tracker';
import { logger } from '../utils/logger';
import path from 'path';
import fs from 'fs';

/**
 * Context provider interface for extensibility
 */
export interface ContextProvider {
  type: ContextType;
  fetch(projectId: string, filter?: Record<string, unknown>): Promise<unknown>;
}

/**
 * Default constraints for agents
 */
const DEFAULT_CONSTRAINTS: AgentConstraints = {
  maxTokens: 4096,
  maxRetries: 3,
  timeoutMs: 60000,
  allowedTools: [],
  forbiddenPatterns: ['process.exit', 'rm -rf /', 'DROP TABLE'],
};

/**
 * ContextManager class
 */
export class ContextManager {
  private providers: Map<ContextType, ContextProvider> = new Map();
  private stateStore: StateStore;
  private lessonsStore: LessonsStore;
  private executionTracker: ExecutionTracker;
  private projectRoot: string;

  constructor(
    stateStore: StateStore,
    lessonsStore: LessonsStore,
    executionTracker: ExecutionTracker,
    projectRoot: string
  ) {
    this.stateStore = stateStore;
    this.lessonsStore = lessonsStore;
    this.executionTracker = executionTracker;
    this.projectRoot = projectRoot;

    // Register built-in providers
    this.registerBuiltInProviders();
  }

  /**
   * Register built-in context providers
   */
  private registerBuiltInProviders(): void {
    // Project config provider
    this.registerProvider({
      type: 'project_config',
      fetch: async (projectId) => {
        const configPath = path.join(this.projectRoot, 'aigentflow.json');
        if (fs.existsSync(configPath)) {
          return JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        }
        return null;
      },
    });

    // Design tokens provider
    this.registerProvider({
      type: 'design_tokens',
      fetch: async (projectId) => {
        const tokensPath = path.join(this.projectRoot, 'designs', 'tokens.json');
        if (fs.existsSync(tokensPath)) {
          return JSON.parse(fs.readFileSync(tokensPath, 'utf-8'));
        }
        return null;
      },
    });

    // Mockups provider
    this.registerProvider({
      type: 'mockups',
      fetch: async (projectId, filter) => {
        const mockupsDir = path.join(this.projectRoot, 'designs', 'mockups');
        if (!fs.existsSync(mockupsDir)) return [];

        const mockups: Array<{ name: string; content: string }> = [];
        const files = fs.readdirSync(mockupsDir).filter(f => f.endsWith('.html'));

        for (const file of files) {
          if (filter?.name && !file.includes(filter.name as string)) continue;
          mockups.push({
            name: file,
            content: fs.readFileSync(path.join(mockupsDir, file), 'utf-8'),
          });
        }

        return mockups;
      },
    });

    // User flows provider
    this.registerProvider({
      type: 'user_flows',
      fetch: async (projectId) => {
        const flowsDir = path.join(this.projectRoot, 'designs', 'flows');
        if (!fs.existsSync(flowsDir)) return [];

        const flows: Array<{ name: string; content: string }> = [];
        const files = fs.readdirSync(flowsDir).filter(f => f.endsWith('.md'));

        for (const file of files) {
          flows.push({
            name: file,
            content: fs.readFileSync(path.join(flowsDir, file), 'utf-8'),
          });
        }

        return flows;
      },
    });

    // Lessons learned provider
    this.registerProvider({
      type: 'lessons_learned',
      fetch: async (projectId, filter) => {
        const category = filter?.category as string | undefined;
        const limit = (filter?.limit as number) || 10;
        return this.lessonsStore.getRecentLessons(projectId, category, limit);
      },
    });

    // Execution history provider
    this.registerProvider({
      type: 'execution_history',
      fetch: async (projectId, filter) => {
        const limit = (filter?.limit as number) || 5;
        return this.executionTracker.getRecentExecutions(projectId, limit);
      },
    });

    // Git status provider
    this.registerProvider({
      type: 'git_status',
      fetch: async (projectId) => {
        // This will be implemented with the git agent
        return null;
      },
    });

    // Source code provider
    this.registerProvider({
      type: 'source_code',
      fetch: async (projectId, filter) => {
        const srcDir = path.join(this.projectRoot, 'src');
        if (!fs.existsSync(srcDir)) return [];

        const files: Array<{ path: string; content: string }> = [];
        const pattern = filter?.pattern as string | undefined;

        // Simple recursive file reading (would use glob in production)
        const readDir = (dir: string) => {
          const entries = fs.readdirSync(dir, { withFileTypes: true });
          for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            if (entry.isDirectory()) {
              if (!entry.name.startsWith('.') && entry.name !== 'node_modules') {
                readDir(fullPath);
              }
            } else if (entry.isFile()) {
              if (!pattern || fullPath.includes(pattern)) {
                const relativePath = path.relative(this.projectRoot, fullPath);
                files.push({
                  path: relativePath,
                  content: fs.readFileSync(fullPath, 'utf-8'),
                });
              }
            }
          }
        };

        readDir(srcDir);
        return files;
      },
    });

    // Test results provider
    this.registerProvider({
      type: 'test_results',
      fetch: async (projectId) => {
        const resultsPath = path.join(this.projectRoot, 'test-results.json');
        if (fs.existsSync(resultsPath)) {
          return JSON.parse(fs.readFileSync(resultsPath, 'utf-8'));
        }
        return null;
      },
    });
  }

  /**
   * Register a custom context provider
   */
  registerProvider(provider: ContextProvider): void {
    this.providers.set(provider.type, provider);
    logger.debug(`Registered context provider: ${provider.type}`);
  }

  /**
   * Build curated context for an agent
   */
  async buildContext(
    projectId: string,
    executionId: string,
    task: TaskAnalysis,
    requirements: ContextRequirement[],
    previousOutputs: Array<{ agentId: AgentType; output: unknown }> = [],
    constraintOverrides?: Partial<AgentConstraints>
  ): Promise<AgentContext> {
    const items: ContextItem[] = [];

    // Fetch required context
    for (const req of requirements) {
      const provider = this.providers.get(req.type);
      if (!provider) {
        if (req.required) {
          throw new Error(`No provider for required context: ${req.type}`);
        }
        continue;
      }

      try {
        const content = await provider.fetch(projectId, req.filter);
        if (content !== null && content !== undefined) {
          items.push({
            type: req.type,
            content: this.limitContent(content, req.maxItems),
            metadata: {
              source: req.type,
              timestamp: new Date(),
            },
          });
        } else if (req.required) {
          throw new Error(`Required context not found: ${req.type}`);
        }
      } catch (error) {
        if (req.required) {
          throw error;
        }
        logger.warn(`Failed to fetch optional context ${req.type}: ${error}`);
      }
    }

    // Always include current task
    items.push({
      type: 'current_task',
      content: task,
      metadata: {
        source: 'orchestrator',
        timestamp: new Date(),
      },
    });

    // Include previous agent outputs if relevant
    if (previousOutputs.length > 0) {
      items.push({
        type: 'agent_outputs',
        content: previousOutputs,
        metadata: {
          source: 'execution',
          timestamp: new Date(),
        },
      });
    }

    // Build constraints
    const constraints: AgentConstraints = {
      ...DEFAULT_CONSTRAINTS,
      ...constraintOverrides,
    };

    return {
      projectId,
      executionId,
      task,
      items,
      previousOutputs: previousOutputs.map(o => o.output as any),
      constraints,
    };
  }

  /**
   * Limit content to prevent token overflow
   */
  private limitContent(content: unknown, maxItems?: number): unknown {
    if (Array.isArray(content) && maxItems) {
      return content.slice(0, maxItems);
    }
    return content;
  }

  /**
   * Get context item by type
   */
  getContextItem(context: AgentContext, type: ContextType): ContextItem | undefined {
    return context.items.find(item => item.type === type);
  }

  /**
   * Calculate relevance score for a context item
   */
  calculateRelevance(item: ContextItem, task: TaskAnalysis): number {
    // Simple relevance scoring based on task type and context type
    const relevanceMap: Record<string, Record<ContextType, number>> = {
      feature: {
        project_config: 0.8,
        design_tokens: 0.9,
        user_flows: 0.9,
        mockups: 0.9,
        source_code: 0.7,
        test_results: 0.5,
        git_status: 0.3,
        lessons_learned: 0.6,
        execution_history: 0.4,
        current_task: 1.0,
        agent_outputs: 0.8,
      },
      bugfix: {
        project_config: 0.5,
        design_tokens: 0.2,
        user_flows: 0.3,
        mockups: 0.3,
        source_code: 1.0,
        test_results: 0.9,
        git_status: 0.7,
        lessons_learned: 0.8,
        execution_history: 0.6,
        current_task: 1.0,
        agent_outputs: 0.9,
      },
      refactor: {
        project_config: 0.6,
        design_tokens: 0.4,
        user_flows: 0.3,
        mockups: 0.3,
        source_code: 1.0,
        test_results: 0.8,
        git_status: 0.5,
        lessons_learned: 0.7,
        execution_history: 0.5,
        current_task: 1.0,
        agent_outputs: 0.7,
      },
    };

    const taskRelevance = relevanceMap[task.taskType] || relevanceMap.feature;
    return taskRelevance[item.type] || 0.5;
  }

  /**
   * Filter context items by minimum relevance
   */
  filterByRelevance(
    context: AgentContext,
    minRelevance: number = 0.5
  ): ContextItem[] {
    return context.items.filter(item => {
      const relevance = this.calculateRelevance(item, context.task);
      return relevance >= minRelevance;
    });
  }
}
```

---

## 5. Public Exports (`src/agents/index.ts`)

```typescript
/**
 * Agent Framework Public Exports
 */

// Types
export * from './types';

// Base Agent
export { BaseAgent, DEFAULT_CONSTRAINTS } from './base-agent';

// Registry
export {
  AgentRegistry,
  getRegistry,
  RegisterAgent
} from './registry';

// Context Manager
export { ContextManager, ContextProvider } from './context-manager';

// Re-export agent types from state
export { AgentType, TaskAnalysis } from '../state/types';
```

---

## 6. Update State Types (`src/state/types.ts`)

Add the AgentType enum if not already present:

```typescript
/**
 * All available agent types
 */
export enum AgentType {
  ORCHESTRATOR = 'orchestrator',
  ANALYZER = 'analyzer',
  PLANNER = 'planner',
  ARCHITECT = 'architect',
  UI_DESIGNER = 'ui_designer',
  FRONTEND_DEV = 'frontend_dev',
  BACKEND_DEV = 'backend_dev',
  TESTER = 'tester',
  BUG_FIXER = 'bug_fixer',
  REVIEWER = 'reviewer',
  GIT_AGENT = 'git_agent',
  PATTERN_MINER = 'pattern_miner',
  AGENT_GENERATOR = 'agent_generator',
  TOURNAMENT_MANAGER = 'tournament_manager',
}
```

---

## Test Scenarios

### Test 1: Base Agent Abstract Methods

```typescript
// tests/agents/base-agent.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BaseAgent } from '../../src/agents/base-agent';
import { AgentMetadata, AgentContext, AgentRequest, Artifact, RoutingHints, AgentType } from '../../src/agents/types';

// Mock implementation for testing
class TestAgent extends BaseAgent {
  constructor() {
    super({
      id: AgentType.ANALYZER,
      name: 'Test Agent',
      description: 'Agent for testing',
      version: '1.0.0',
      capabilities: [
        { name: 'test', description: 'Test capability', inputTypes: ['text'], outputTypes: ['json'] }
      ],
      requiredContext: [],
      outputSchema: 'test-schema',
    });
  }

  protected buildSystemPrompt(context: AgentContext): string {
    return 'You are a test agent.';
  }

  protected buildUserPrompt(request: AgentRequest): string {
    return `Analyze: ${request.task.taskType}`;
  }

  protected parseResponse(response: any): unknown {
    return { parsed: true };
  }

  protected async processResult(parsed: unknown, request: AgentRequest): Promise<{ result: unknown; artifacts: Artifact[] }> {
    return { result: parsed, artifacts: [] };
  }

  protected generateRoutingHints(result: unknown, artifacts: Artifact[], request: AgentRequest): RoutingHints {
    return {
      suggestNext: [],
      skipAgents: [],
      needsApproval: false,
      hasFailures: false,
      isComplete: true,
    };
  }
}

describe('BaseAgent', () => {
  let agent: TestAgent;

  beforeEach(() => {
    agent = new TestAgent();
  });

  it('should return correct metadata', () => {
    const metadata = agent.getMetadata();
    expect(metadata.id).toBe(AgentType.ANALYZER);
    expect(metadata.name).toBe('Test Agent');
    expect(metadata.version).toBe('1.0.0');
  });

  it('should return correct agent ID', () => {
    expect(agent.getId()).toBe(AgentType.ANALYZER);
  });

  it('should start in idle state', () => {
    expect(agent.getStatus()).toBe('idle');
  });

  it('should have capabilities', () => {
    const metadata = agent.getMetadata();
    expect(metadata.capabilities).toHaveLength(1);
    expect(metadata.capabilities[0].name).toBe('test');
  });
});
```

### Test 2: Agent Registry

```typescript
// tests/agents/registry.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { AgentRegistry, getRegistry } from '../../src/agents/registry';
import { BaseAgent } from '../../src/agents/base-agent';
import { AgentType } from '../../src/agents/types';

// Mock agent for testing
class MockAgent extends BaseAgent {
  constructor() {
    super({
      id: AgentType.PLANNER,
      name: 'Mock Planner',
      description: 'Mock planner for testing',
      version: '1.0.0',
      capabilities: [],
      requiredContext: [],
      outputSchema: 'mock-schema',
    });
  }

  protected buildSystemPrompt(): string { return ''; }
  protected buildUserPrompt(): string { return ''; }
  protected parseResponse(): unknown { return {}; }
  protected async processResult(): Promise<any> { return { result: {}, artifacts: [] }; }
  protected generateRoutingHints(): any { return {}; }
}

describe('AgentRegistry', () => {
  let registry: AgentRegistry;

  beforeEach(() => {
    registry = AgentRegistry.getInstance();
    registry.resetAll();
  });

  it('should be a singleton', () => {
    const instance1 = AgentRegistry.getInstance();
    const instance2 = AgentRegistry.getInstance();
    expect(instance1).toBe(instance2);
  });

  it('should register an agent', () => {
    registry.register(MockAgent);
    expect(registry.hasAgent(AgentType.PLANNER)).toBe(true);
  });

  it('should return registered agent types', () => {
    registry.register(MockAgent);
    const types = registry.getAgentTypes();
    expect(types).toContain(AgentType.PLANNER);
  });

  it('should lazy instantiate agents', () => {
    registry.register(MockAgent);
    const stats1 = registry.getStats();
    expect(stats1.totalInstantiated).toBe(0);

    registry.getAgent(AgentType.PLANNER);
    const stats2 = registry.getStats();
    expect(stats2.totalInstantiated).toBe(1);
  });

  it('should throw for unregistered agent', () => {
    expect(() => registry.getAgent(AgentType.ARCHITECT)).toThrow('Agent not found');
  });

  it('should reset agent instances', () => {
    registry.register(MockAgent);
    registry.getAgent(AgentType.PLANNER);

    registry.resetAgent(AgentType.PLANNER);

    const stats = registry.getStats();
    expect(stats.totalInstantiated).toBe(0);
  });
});
```

### Test 3: Context Manager

```typescript
// tests/agents/context-manager.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ContextManager } from '../../src/agents/context-manager';
import { AgentType, TaskAnalysis } from '../../src/agents/types';
import fs from 'fs';
import path from 'path';

// Mock dependencies
const mockStateStore = {
  getCurrentState: vi.fn(),
};

const mockLessonsStore = {
  getRecentLessons: vi.fn().mockResolvedValue([]),
};

const mockExecutionTracker = {
  getRecentExecutions: vi.fn().mockResolvedValue([]),
};

describe('ContextManager', () => {
  let contextManager: ContextManager;
  const testProjectRoot = '/tmp/test-project';

  beforeEach(() => {
    contextManager = new ContextManager(
      mockStateStore as any,
      mockLessonsStore as any,
      mockExecutionTracker as any,
      testProjectRoot
    );
  });

  it('should create context with task', async () => {
    const task: TaskAnalysis = {
      taskType: 'feature',
      complexity: 'moderate',
      requiresUI: true,
      requiresBackend: true,
      requiresArchitecture: false,
      requiresApproval: true,
      suggestedAgents: [AgentType.UI_DESIGNER],
    };

    const context = await contextManager.buildContext(
      'project-1',
      'exec-1',
      task,
      []
    );

    expect(context.projectId).toBe('project-1');
    expect(context.executionId).toBe('exec-1');
    expect(context.task).toEqual(task);
  });

  it('should include current task in context items', async () => {
    const task: TaskAnalysis = {
      taskType: 'bugfix',
      complexity: 'simple',
      requiresUI: false,
      requiresBackend: true,
      requiresArchitecture: false,
      requiresApproval: false,
      suggestedAgents: [AgentType.BUG_FIXER],
    };

    const context = await contextManager.buildContext(
      'project-1',
      'exec-1',
      task,
      []
    );

    const taskItem = context.items.find(i => i.type === 'current_task');
    expect(taskItem).toBeDefined();
    expect(taskItem?.content).toEqual(task);
  });

  it('should apply constraint overrides', async () => {
    const task: TaskAnalysis = {
      taskType: 'feature',
      complexity: 'simple',
      requiresUI: true,
      requiresBackend: false,
      requiresArchitecture: false,
      requiresApproval: false,
      suggestedAgents: [],
    };

    const context = await contextManager.buildContext(
      'project-1',
      'exec-1',
      task,
      [],
      [],
      { maxTokens: 8192 }
    );

    expect(context.constraints.maxTokens).toBe(8192);
  });

  it('should register custom provider', async () => {
    const customProvider = {
      type: 'project_config' as const,
      fetch: vi.fn().mockResolvedValue({ name: 'test-project' }),
    };

    contextManager.registerProvider(customProvider);

    const context = await contextManager.buildContext(
      'project-1',
      'exec-1',
      { taskType: 'feature' } as TaskAnalysis,
      [{ type: 'project_config', required: true }]
    );

    expect(customProvider.fetch).toHaveBeenCalled();
    const configItem = context.items.find(i => i.type === 'project_config');
    expect(configItem?.content).toEqual({ name: 'test-project' });
  });

  it('should calculate relevance scores', () => {
    const task: TaskAnalysis = {
      taskType: 'bugfix',
      complexity: 'moderate',
      requiresUI: false,
      requiresBackend: true,
      requiresArchitecture: false,
      requiresApproval: false,
      suggestedAgents: [],
    };

    const codeItem = {
      type: 'source_code' as const,
      content: {},
      metadata: { source: 'test', timestamp: new Date() },
    };

    const relevance = contextManager.calculateRelevance(codeItem, task);
    expect(relevance).toBe(1.0); // Source code is highly relevant for bugfix
  });
});
```

### Test 4: Agent Output Structure

```typescript
// tests/agents/types.test.ts
import { describe, it, expect } from 'vitest';
import { AgentType, ArtifactType, RoutingHints, AgentOutput } from '../../src/agents/types';

describe('Agent Types', () => {
  it('should have all required AgentType values', () => {
    expect(AgentType.ORCHESTRATOR).toBe('orchestrator');
    expect(AgentType.UI_DESIGNER).toBe('ui_designer');
    expect(AgentType.FRONTEND_DEV).toBe('frontend_dev');
    expect(AgentType.BACKEND_DEV).toBe('backend_dev');
    expect(AgentType.TESTER).toBe('tester');
    expect(AgentType.REVIEWER).toBe('reviewer');
  });

  it('should validate RoutingHints structure', () => {
    const hints: RoutingHints = {
      suggestNext: [AgentType.TESTER],
      skipAgents: [AgentType.UI_DESIGNER],
      needsApproval: false,
      hasFailures: false,
      isComplete: false,
      notes: 'Ready for testing',
    };

    expect(hints.suggestNext).toContain(AgentType.TESTER);
    expect(hints.skipAgents).toContain(AgentType.UI_DESIGNER);
    expect(hints.isComplete).toBe(false);
  });

  it('should validate AgentOutput structure', () => {
    const output: AgentOutput = {
      agentId: AgentType.FRONTEND_DEV,
      executionId: 'exec-123',
      timestamp: new Date(),
      success: true,
      result: { component: 'Button' },
      artifacts: [
        {
          id: 'art-1',
          type: 'source_file',
          path: 'src/components/Button.tsx',
          metadata: { lines: 50 },
        },
      ],
      routingHints: {
        suggestNext: [AgentType.TESTER],
        skipAgents: [],
        needsApproval: false,
        hasFailures: false,
        isComplete: false,
      },
      metrics: {
        startTime: new Date(),
        endTime: new Date(),
        durationMs: 5000,
        tokensUsed: 1500,
        llmCalls: 2,
        retryCount: 0,
        cacheHits: 1,
      },
    };

    expect(output.success).toBe(true);
    expect(output.artifacts).toHaveLength(1);
    expect(output.metrics.tokensUsed).toBe(1500);
  });
});
```

---

## Validation Checklist

```
□ BaseAgent class implemented
  □ Abstract methods defined
  □ Execute method with retry logic
  □ Error handling and wrapping
  □ Metrics collection

□ AgentRegistry singleton
  □ Register method works
  □ Lazy instantiation works
  □ FindByCapability works
  □ Reset methods work

□ ContextManager
  □ Built-in providers registered
  □ Custom provider registration works
  □ Context building works
  □ Relevance scoring works

□ Types complete
  □ All agent types defined
  □ All artifact types defined
  □ RoutingHints complete
  □ ExecutionMetrics complete

□ All tests pass
  □ npm run test -- tests/agents/
```

---

## Next Step

Proceed to **06-UI-DESIGNER-AGENT.md** to implement the first specialized agent using this framework.
