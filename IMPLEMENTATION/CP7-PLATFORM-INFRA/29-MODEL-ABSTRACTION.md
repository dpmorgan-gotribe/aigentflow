# Step 29: Model Abstraction Layer

> **Checkpoint:** CP7 - Platform Infrastructure
> **Previous Step:** 28-VENDOR-SECURITY.md
> **Next Step:** 30-MULTI-TENANT.md

---

## Overview

The Model Abstraction Layer provides a unified interface for interacting with multiple AI model providers. This enables provider flexibility, fallback handling, cost optimization, and future-proofing against provider changes.

Key responsibilities:
- Unified API across model providers (Anthropic, OpenAI, Google, local)
- Automatic failover between providers
- Cost tracking and optimization
- Rate limiting and quota management
- Response normalization
- Provider-specific capability mapping

---

## Deliverables

1. `src/platform/models/provider-interface.ts` - Provider abstraction
2. `src/platform/models/providers/` - Provider implementations
3. `src/platform/models/router.ts` - Model routing logic
4. `src/platform/models/cost-tracker.ts` - Usage and cost tracking
5. `orchestrator-data/system/models/` - Model configurations

---

## 1. Provider Interface

### 1.1 Abstract Provider Definition

```typescript
/**
 * Model Provider Interface
 *
 * Abstract interface all providers must implement.
 */

import { z } from 'zod';

// Message schema
export const MessageSchema = z.object({
  role: z.enum(['system', 'user', 'assistant', 'tool']),
  content: z.union([
    z.string(),
    z.array(z.object({
      type: z.enum(['text', 'image', 'tool_use', 'tool_result']),
      text: z.string().optional(),
      source: z.object({
        type: z.literal('base64'),
        media_type: z.string(),
        data: z.string(),
      }).optional(),
    })),
  ]),
  name: z.string().optional(),
  tool_call_id: z.string().optional(),
});

export type Message = z.infer<typeof MessageSchema>;

// Request schema
export const CompletionRequestSchema = z.object({
  model: z.string(),
  messages: z.array(MessageSchema),
  max_tokens: z.number().optional(),
  temperature: z.number().min(0).max(2).optional(),
  top_p: z.number().min(0).max(1).optional(),
  stop: z.array(z.string()).optional(),
  tools: z.array(z.object({
    name: z.string(),
    description: z.string(),
    input_schema: z.record(z.unknown()),
  })).optional(),
  tool_choice: z.union([
    z.literal('auto'),
    z.literal('none'),
    z.literal('required'),
    z.object({ type: z.literal('tool'), name: z.string() }),
  ]).optional(),
  stream: z.boolean().optional(),
});

export type CompletionRequest = z.infer<typeof CompletionRequestSchema>;

// Response schema
export const CompletionResponseSchema = z.object({
  id: z.string(),
  model: z.string(),
  provider: z.string(),
  content: z.array(z.object({
    type: z.enum(['text', 'tool_use']),
    text: z.string().optional(),
    id: z.string().optional(),
    name: z.string().optional(),
    input: z.record(z.unknown()).optional(),
  })),
  stop_reason: z.enum(['end_turn', 'max_tokens', 'stop_sequence', 'tool_use']),
  usage: z.object({
    input_tokens: z.number(),
    output_tokens: z.number(),
    total_tokens: z.number(),
    cache_read_tokens: z.number().optional(),
    cache_creation_tokens: z.number().optional(),
  }),
  latency_ms: z.number(),
});

export type CompletionResponse = z.infer<typeof CompletionResponseSchema>;

// Provider interface
export interface ModelProvider {
  readonly name: string;
  readonly models: ModelInfo[];

  /**
   * Check if provider is available
   */
  isAvailable(): Promise<boolean>;

  /**
   * Create completion
   */
  createCompletion(request: CompletionRequest): Promise<CompletionResponse>;

  /**
   * Create streaming completion
   */
  createStreamingCompletion(
    request: CompletionRequest
  ): AsyncIterable<StreamChunk>;

  /**
   * Get model capabilities
   */
  getModelCapabilities(modelId: string): ModelCapabilities;

  /**
   * Estimate cost for request
   */
  estimateCost(request: CompletionRequest): CostEstimate;
}

export interface ModelInfo {
  id: string;
  name: string;
  provider: string;
  contextWindow: number;
  maxOutputTokens: number;
  inputCostPer1k: number;
  outputCostPer1k: number;
  capabilities: ModelCapabilities;
}

export interface ModelCapabilities {
  vision: boolean;
  toolUse: boolean;
  streaming: boolean;
  systemPrompt: boolean;
  jsonMode: boolean;
  caching: boolean;
}

export interface CostEstimate {
  inputCost: number;
  outputCost: number;
  totalCost: number;
  currency: string;
}

export interface StreamChunk {
  type: 'content_block_start' | 'content_block_delta' | 'content_block_stop' | 'message_stop';
  index?: number;
  delta?: {
    type: string;
    text?: string;
  };
}
```

---

## 2. Provider Implementations

### 2.1 Anthropic Provider

```typescript
/**
 * Anthropic Claude Provider
 */

import Anthropic from '@anthropic-ai/sdk';
import { ModelProvider, CompletionRequest, CompletionResponse, ModelInfo } from '../provider-interface';

export class AnthropicProvider implements ModelProvider {
  readonly name = 'anthropic';
  readonly models: ModelInfo[] = [
    {
      id: 'claude-opus-4-5-20251101',
      name: 'Claude Opus 4.5',
      provider: 'anthropic',
      contextWindow: 200000,
      maxOutputTokens: 32000,
      inputCostPer1k: 0.015,
      outputCostPer1k: 0.075,
      capabilities: {
        vision: true,
        toolUse: true,
        streaming: true,
        systemPrompt: true,
        jsonMode: false,
        caching: true,
      },
    },
    {
      id: 'claude-sonnet-4-20250514',
      name: 'Claude Sonnet 4',
      provider: 'anthropic',
      contextWindow: 200000,
      maxOutputTokens: 64000,
      inputCostPer1k: 0.003,
      outputCostPer1k: 0.015,
      capabilities: {
        vision: true,
        toolUse: true,
        streaming: true,
        systemPrompt: true,
        jsonMode: false,
        caching: true,
      },
    },
    {
      id: 'claude-3-5-haiku-20241022',
      name: 'Claude 3.5 Haiku',
      provider: 'anthropic',
      contextWindow: 200000,
      maxOutputTokens: 8192,
      inputCostPer1k: 0.0008,
      outputCostPer1k: 0.004,
      capabilities: {
        vision: true,
        toolUse: true,
        streaming: true,
        systemPrompt: true,
        jsonMode: false,
        caching: true,
      },
    },
  ];

  private client: Anthropic;

  constructor(apiKey?: string) {
    this.client = new Anthropic({
      apiKey: apiKey || process.env.ANTHROPIC_API_KEY,
    });
  }

  async isAvailable(): Promise<boolean> {
    try {
      // Simple health check
      return true;
    } catch {
      return false;
    }
  }

  async createCompletion(request: CompletionRequest): Promise<CompletionResponse> {
    const startTime = Date.now();

    // Extract system message
    const systemMessages = request.messages.filter(m => m.role === 'system');
    const otherMessages = request.messages.filter(m => m.role !== 'system');

    const response = await this.client.messages.create({
      model: request.model,
      max_tokens: request.max_tokens || 4096,
      system: systemMessages.map(m => m.content as string).join('\n') || undefined,
      messages: otherMessages.map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
      temperature: request.temperature,
      top_p: request.top_p,
      stop_sequences: request.stop,
      tools: request.tools?.map(t => ({
        name: t.name,
        description: t.description,
        input_schema: t.input_schema as any,
      })),
      tool_choice: request.tool_choice as any,
    });

    return {
      id: response.id,
      model: response.model,
      provider: this.name,
      content: response.content.map(c => {
        if (c.type === 'text') {
          return { type: 'text' as const, text: c.text };
        } else {
          return {
            type: 'tool_use' as const,
            id: c.id,
            name: c.name,
            input: c.input as Record<string, unknown>,
          };
        }
      }),
      stop_reason: response.stop_reason as any,
      usage: {
        input_tokens: response.usage.input_tokens,
        output_tokens: response.usage.output_tokens,
        total_tokens: response.usage.input_tokens + response.usage.output_tokens,
        cache_read_tokens: (response.usage as any).cache_read_input_tokens,
        cache_creation_tokens: (response.usage as any).cache_creation_input_tokens,
      },
      latency_ms: Date.now() - startTime,
    };
  }

  async *createStreamingCompletion(request: CompletionRequest): AsyncIterable<StreamChunk> {
    const systemMessages = request.messages.filter(m => m.role === 'system');
    const otherMessages = request.messages.filter(m => m.role !== 'system');

    const stream = await this.client.messages.stream({
      model: request.model,
      max_tokens: request.max_tokens || 4096,
      system: systemMessages.map(m => m.content as string).join('\n') || undefined,
      messages: otherMessages.map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
      temperature: request.temperature,
    });

    for await (const event of stream) {
      if (event.type === 'content_block_start') {
        yield { type: 'content_block_start', index: event.index };
      } else if (event.type === 'content_block_delta') {
        yield {
          type: 'content_block_delta',
          index: event.index,
          delta: { type: 'text_delta', text: (event.delta as any).text },
        };
      } else if (event.type === 'content_block_stop') {
        yield { type: 'content_block_stop', index: event.index };
      } else if (event.type === 'message_stop') {
        yield { type: 'message_stop' };
      }
    }
  }

  getModelCapabilities(modelId: string): ModelCapabilities {
    const model = this.models.find(m => m.id === modelId);
    return model?.capabilities || {
      vision: false,
      toolUse: false,
      streaming: false,
      systemPrompt: false,
      jsonMode: false,
      caching: false,
    };
  }

  estimateCost(request: CompletionRequest): CostEstimate {
    const model = this.models.find(m => m.id === request.model);
    if (!model) {
      return { inputCost: 0, outputCost: 0, totalCost: 0, currency: 'USD' };
    }

    // Rough token estimation
    const inputTokens = JSON.stringify(request.messages).length / 4;
    const outputTokens = request.max_tokens || 4096;

    const inputCost = (inputTokens / 1000) * model.inputCostPer1k;
    const outputCost = (outputTokens / 1000) * model.outputCostPer1k;

    return {
      inputCost,
      outputCost,
      totalCost: inputCost + outputCost,
      currency: 'USD',
    };
  }
}
```

### 2.2 OpenAI Provider

```typescript
/**
 * OpenAI Provider
 */

import OpenAI from 'openai';
import { ModelProvider, CompletionRequest, CompletionResponse, ModelInfo } from '../provider-interface';

export class OpenAIProvider implements ModelProvider {
  readonly name = 'openai';
  readonly models: ModelInfo[] = [
    {
      id: 'gpt-4o',
      name: 'GPT-4o',
      provider: 'openai',
      contextWindow: 128000,
      maxOutputTokens: 4096,
      inputCostPer1k: 0.005,
      outputCostPer1k: 0.015,
      capabilities: {
        vision: true,
        toolUse: true,
        streaming: true,
        systemPrompt: true,
        jsonMode: true,
        caching: false,
      },
    },
    {
      id: 'gpt-4o-mini',
      name: 'GPT-4o Mini',
      provider: 'openai',
      contextWindow: 128000,
      maxOutputTokens: 4096,
      inputCostPer1k: 0.00015,
      outputCostPer1k: 0.0006,
      capabilities: {
        vision: true,
        toolUse: true,
        streaming: true,
        systemPrompt: true,
        jsonMode: true,
        caching: false,
      },
    },
  ];

  private client: OpenAI;

  constructor(apiKey?: string) {
    this.client = new OpenAI({
      apiKey: apiKey || process.env.OPENAI_API_KEY,
    });
  }

  async isAvailable(): Promise<boolean> {
    try {
      return !!process.env.OPENAI_API_KEY;
    } catch {
      return false;
    }
  }

  async createCompletion(request: CompletionRequest): Promise<CompletionResponse> {
    const startTime = Date.now();

    const response = await this.client.chat.completions.create({
      model: request.model,
      messages: request.messages.map(m => ({
        role: m.role as any,
        content: m.content as string,
      })),
      max_tokens: request.max_tokens,
      temperature: request.temperature,
      top_p: request.top_p,
      stop: request.stop,
      tools: request.tools?.map(t => ({
        type: 'function' as const,
        function: {
          name: t.name,
          description: t.description,
          parameters: t.input_schema,
        },
      })),
    });

    const choice = response.choices[0];

    return {
      id: response.id,
      model: response.model,
      provider: this.name,
      content: choice.message.tool_calls
        ? choice.message.tool_calls.map(tc => ({
            type: 'tool_use' as const,
            id: tc.id,
            name: tc.function.name,
            input: JSON.parse(tc.function.arguments),
          }))
        : [{ type: 'text' as const, text: choice.message.content || '' }],
      stop_reason: choice.finish_reason === 'stop' ? 'end_turn' :
                   choice.finish_reason === 'length' ? 'max_tokens' :
                   choice.finish_reason === 'tool_calls' ? 'tool_use' : 'end_turn',
      usage: {
        input_tokens: response.usage?.prompt_tokens || 0,
        output_tokens: response.usage?.completion_tokens || 0,
        total_tokens: response.usage?.total_tokens || 0,
      },
      latency_ms: Date.now() - startTime,
    };
  }

  async *createStreamingCompletion(request: CompletionRequest): AsyncIterable<StreamChunk> {
    const stream = await this.client.chat.completions.create({
      model: request.model,
      messages: request.messages.map(m => ({
        role: m.role as any,
        content: m.content as string,
      })),
      max_tokens: request.max_tokens,
      temperature: request.temperature,
      stream: true,
    });

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta;
      if (delta?.content) {
        yield {
          type: 'content_block_delta',
          delta: { type: 'text_delta', text: delta.content },
        };
      }
    }

    yield { type: 'message_stop' };
  }

  getModelCapabilities(modelId: string): ModelCapabilities {
    const model = this.models.find(m => m.id === modelId);
    return model?.capabilities || {
      vision: false,
      toolUse: false,
      streaming: false,
      systemPrompt: false,
      jsonMode: false,
      caching: false,
    };
  }

  estimateCost(request: CompletionRequest): CostEstimate {
    const model = this.models.find(m => m.id === request.model);
    if (!model) {
      return { inputCost: 0, outputCost: 0, totalCost: 0, currency: 'USD' };
    }

    const inputTokens = JSON.stringify(request.messages).length / 4;
    const outputTokens = request.max_tokens || 4096;

    return {
      inputCost: (inputTokens / 1000) * model.inputCostPer1k,
      outputCost: (outputTokens / 1000) * model.outputCostPer1k,
      totalCost: 0,
      currency: 'USD',
    };
  }
}
```

---

## 3. Model Router

### 3.1 Routing Logic

```typescript
/**
 * Model Router
 *
 * Routes requests to appropriate providers with failover.
 */

import { ModelProvider, CompletionRequest, CompletionResponse, ModelInfo } from './provider-interface';

export interface RoutingConfig {
  primaryProvider: string;
  fallbackProviders: string[];
  costOptimization: boolean;
  maxRetries: number;
  retryDelay: number;
}

export class ModelRouter {
  private providers: Map<string, ModelProvider> = new Map();
  private modelToProvider: Map<string, string> = new Map();

  constructor(private config: RoutingConfig) {}

  /**
   * Register provider
   */
  registerProvider(provider: ModelProvider): void {
    this.providers.set(provider.name, provider);

    // Map models to provider
    for (const model of provider.models) {
      this.modelToProvider.set(model.id, provider.name);
    }
  }

  /**
   * Get all available models
   */
  getAvailableModels(): ModelInfo[] {
    const models: ModelInfo[] = [];
    for (const provider of this.providers.values()) {
      models.push(...provider.models);
    }
    return models;
  }

  /**
   * Route completion request
   */
  async createCompletion(request: CompletionRequest): Promise<CompletionResponse> {
    // Determine provider
    const providerName = this.modelToProvider.get(request.model);
    if (!providerName) {
      throw new Error(`Unknown model: ${request.model}`);
    }

    const provider = this.providers.get(providerName);
    if (!provider) {
      throw new Error(`Provider not registered: ${providerName}`);
    }

    // Try primary provider
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
      try {
        if (await provider.isAvailable()) {
          return await provider.createCompletion(request);
        }
      } catch (error) {
        lastError = error as Error;

        // Wait before retry
        if (attempt < this.config.maxRetries) {
          await this.delay(this.config.retryDelay * Math.pow(2, attempt));
        }
      }
    }

    // Try fallback providers
    for (const fallbackName of this.config.fallbackProviders) {
      const fallbackProvider = this.providers.get(fallbackName);
      if (!fallbackProvider) continue;

      // Find equivalent model
      const equivalentModel = this.findEquivalentModel(request.model, fallbackProvider);
      if (!equivalentModel) continue;

      try {
        if (await fallbackProvider.isAvailable()) {
          const fallbackRequest = { ...request, model: equivalentModel.id };
          return await fallbackProvider.createCompletion(fallbackRequest);
        }
      } catch (error) {
        lastError = error as Error;
      }
    }

    throw lastError || new Error('All providers unavailable');
  }

  /**
   * Route with cost optimization
   */
  async createCompletionOptimized(
    request: CompletionRequest,
    options: { maxCost?: number; preferredProvider?: string }
  ): Promise<CompletionResponse> {
    if (!this.config.costOptimization) {
      return this.createCompletion(request);
    }

    // Find cheapest suitable model
    const candidates = this.getAvailableModels().filter(m => {
      const capabilities = this.providers.get(m.provider)?.getModelCapabilities(m.id);
      if (!capabilities) return false;

      // Check if model meets requirements
      if (request.tools && !capabilities.toolUse) return false;

      return true;
    });

    // Sort by cost
    candidates.sort((a, b) => {
      const costA = a.inputCostPer1k + a.outputCostPer1k;
      const costB = b.inputCostPer1k + b.outputCostPer1k;
      return costA - costB;
    });

    // Use cheapest
    if (candidates.length > 0) {
      const cheapest = candidates[0];
      const cheapestRequest = { ...request, model: cheapest.id };
      return this.createCompletion(cheapestRequest);
    }

    return this.createCompletion(request);
  }

  /**
   * Find equivalent model in another provider
   */
  private findEquivalentModel(modelId: string, provider: ModelProvider): ModelInfo | null {
    // Map models across providers
    const equivalents: Record<string, string[]> = {
      'claude-opus-4-5-20251101': ['gpt-4o'],
      'claude-sonnet-4-20250514': ['gpt-4o-mini'],
      'gpt-4o': ['claude-sonnet-4-20250514'],
    };

    const modelEquivalents = equivalents[modelId] || [];
    for (const eq of modelEquivalents) {
      const found = provider.models.find(m => m.id === eq);
      if (found) return found;
    }

    return null;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
```

---

## 4. Cost Tracker

```typescript
/**
 * Cost Tracker
 *
 * Tracks model usage and costs.
 */

export class CostTracker {
  constructor(private db: Database) {}

  /**
   * Record usage
   */
  async recordUsage(usage: {
    requestId: string;
    model: string;
    provider: string;
    inputTokens: number;
    outputTokens: number;
    cost: number;
    latencyMs: number;
    projectId?: string;
    agentId?: string;
  }): Promise<void> {
    await this.db.run(
      `INSERT INTO model_usage
       (request_id, model, provider, input_tokens, output_tokens, cost,
        latency_ms, project_id, agent_id, timestamp)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [usage.requestId, usage.model, usage.provider, usage.inputTokens,
       usage.outputTokens, usage.cost, usage.latencyMs, usage.projectId,
       usage.agentId, new Date().toISOString()]
    );
  }

  /**
   * Get usage summary
   */
  async getUsageSummary(
    startDate: Date,
    endDate: Date,
    groupBy: 'model' | 'provider' | 'project' | 'agent' = 'model'
  ): Promise<UsageSummary[]> {
    const groupColumn = groupBy === 'model' ? 'model' :
                       groupBy === 'provider' ? 'provider' :
                       groupBy === 'project' ? 'project_id' : 'agent_id';

    const rows = await this.db.all(
      `SELECT ${groupColumn} as group_key,
              COUNT(*) as request_count,
              SUM(input_tokens) as total_input_tokens,
              SUM(output_tokens) as total_output_tokens,
              SUM(cost) as total_cost,
              AVG(latency_ms) as avg_latency
       FROM model_usage
       WHERE timestamp BETWEEN ? AND ?
       GROUP BY ${groupColumn}
       ORDER BY total_cost DESC`,
      [startDate.toISOString(), endDate.toISOString()]
    );

    return rows.map(r => ({
      groupKey: r.group_key,
      requestCount: r.request_count,
      totalInputTokens: r.total_input_tokens,
      totalOutputTokens: r.total_output_tokens,
      totalCost: r.total_cost,
      avgLatencyMs: r.avg_latency,
    }));
  }

  /**
   * Get daily costs
   */
  async getDailyCosts(days: number = 30): Promise<{ date: string; cost: number }[]> {
    return this.db.all(
      `SELECT date(timestamp) as date, SUM(cost) as cost
       FROM model_usage
       WHERE timestamp >= date('now', '-' || ? || ' days')
       GROUP BY date(timestamp)
       ORDER BY date`,
      [days]
    );
  }

  /**
   * Check budget
   */
  async checkBudget(projectId: string, monthlyBudget: number): Promise<{
    spent: number;
    remaining: number;
    percentUsed: number;
  }> {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const result = await this.db.get(
      `SELECT SUM(cost) as spent
       FROM model_usage
       WHERE project_id = ? AND timestamp >= ?`,
      [projectId, startOfMonth.toISOString()]
    );

    const spent = result?.spent || 0;

    return {
      spent,
      remaining: monthlyBudget - spent,
      percentUsed: (spent / monthlyBudget) * 100,
    };
  }
}

interface UsageSummary {
  groupKey: string;
  requestCount: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCost: number;
  avgLatencyMs: number;
}
```

---

## 5. Configuration

```yaml
# orchestrator-data/system/models/config.yaml
model_config:
  primary_provider: "anthropic"
  fallback_providers:
    - "openai"

  cost_optimization: true
  max_retries: 3
  retry_delay_ms: 1000

  provider_configs:
    anthropic:
      api_key_env: "ANTHROPIC_API_KEY"
      default_model: "claude-sonnet-4-20250514"
      rate_limit:
        requests_per_minute: 60
        tokens_per_minute: 100000

    openai:
      api_key_env: "OPENAI_API_KEY"
      default_model: "gpt-4o"
      rate_limit:
        requests_per_minute: 100
        tokens_per_minute: 150000

  model_aliases:
    default: "claude-sonnet-4-20250514"
    fast: "claude-3-5-haiku-20241022"
    smart: "claude-opus-4-5-20251101"
    cheap: "gpt-4o-mini"

  budgets:
    default_monthly: 500
    warning_threshold: 0.8
    hard_limit: 1.0
```

---

## 6. Test Scenarios

```typescript
describe('Model Abstraction Layer', () => {
  describe('AnthropicProvider', () => {
    it('should create completion', async () => {
      const provider = new AnthropicProvider();
      const response = await provider.createCompletion({
        model: 'claude-sonnet-4-20250514',
        messages: [{ role: 'user', content: 'Hello' }],
      });

      expect(response.provider).toBe('anthropic');
      expect(response.content.length).toBeGreaterThan(0);
    });
  });

  describe('ModelRouter', () => {
    it('should route to correct provider', async () => {
      const router = new ModelRouter(config);
      router.registerProvider(new AnthropicProvider());
      router.registerProvider(new OpenAIProvider());

      const response = await router.createCompletion({
        model: 'claude-sonnet-4-20250514',
        messages: [{ role: 'user', content: 'Test' }],
      });

      expect(response.provider).toBe('anthropic');
    });

    it('should failover to fallback provider', async () => {
      // Test failover logic
    });
  });

  describe('CostTracker', () => {
    it('should track usage correctly', async () => {
      await tracker.recordUsage({
        requestId: 'test-1',
        model: 'claude-sonnet-4-20250514',
        provider: 'anthropic',
        inputTokens: 100,
        outputTokens: 200,
        cost: 0.003,
        latencyMs: 500,
      });

      const summary = await tracker.getUsageSummary(
        new Date('2025-01-01'),
        new Date('2025-12-31'),
        'model'
      );

      expect(summary.length).toBeGreaterThan(0);
    });
  });
});
```

---

## 7. Dependencies

- Anthropic SDK
- OpenAI SDK (optional)
- Step 04: Persistence Layer (usage tracking)

---

## 8. Acceptance Criteria

- [ ] Anthropic provider fully implemented
- [ ] OpenAI provider available as fallback
- [ ] Automatic failover works correctly
- [ ] Cost tracking captures all usage
- [ ] Budget warnings triggered at threshold
- [ ] Model routing respects capabilities
- [ ] Streaming responses work
- [ ] All tests pass
