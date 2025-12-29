/**
 * Anthropic API Provider
 *
 * AI provider that uses the Anthropic SDK for direct API calls.
 */

import type {
  AIProvider,
  AIProviderConfig,
  AICompletionRequest,
  AICompletionResponse,
} from '../types.js';
import { logger } from '../../utils/logger.js';

const log = logger.child({ component: 'anthropic-api-provider' });

// Dynamic import for @anthropic-ai/sdk
let Anthropic: typeof import('@anthropic-ai/sdk').default | null = null;

/**
 * Lazy load Anthropic SDK
 */
async function getAnthropicSdk(): Promise<typeof import('@anthropic-ai/sdk').default> {
  if (!Anthropic) {
    try {
      const module = await import('@anthropic-ai/sdk');
      Anthropic = module.default;
    } catch (error) {
      throw new Error(
        'Failed to load @anthropic-ai/sdk. Install it with: npm install @anthropic-ai/sdk'
      );
    }
  }
  return Anthropic;
}

/**
 * Anthropic API Provider implementation
 */
export class AnthropicApiProvider implements AIProvider {
  readonly name = 'Anthropic API';
  readonly type = 'anthropic-api' as const;
  private config: AIProviderConfig;
  private client: InstanceType<typeof import('@anthropic-ai/sdk').default> | null = null;

  constructor(config: AIProviderConfig) {
    this.config = config;
  }

  /**
   * Initialize the Anthropic client
   */
  private async getClient(): Promise<InstanceType<typeof import('@anthropic-ai/sdk').default>> {
    if (!this.client) {
      if (!this.config.apiKey) {
        throw new Error('ANTHROPIC_API_KEY is required for Anthropic API provider');
      }

      const AnthropicClass = await getAnthropicSdk();
      this.client = new AnthropicClass({
        apiKey: this.config.apiKey,
      });
    }
    return this.client;
  }

  /**
   * Check if Anthropic API is available
   */
  async isAvailable(): Promise<boolean> {
    try {
      if (!this.config.apiKey) {
        log.warn('Anthropic API key not configured');
        return false;
      }

      // Try to initialize client
      await this.getClient();
      log.info('Anthropic API available');
      return true;
    } catch (error) {
      log.warn('Anthropic API not available', { error });
      return false;
    }
  }

  /**
   * Send completion request via Anthropic API
   */
  async complete(request: AICompletionRequest): Promise<AICompletionResponse> {
    const startTime = Date.now();
    const client = await this.getClient();

    log.info('Sending request to Anthropic API', {
      agent: request.metadata?.agent,
      operation: request.metadata?.operation,
      messageCount: request.messages.length,
      model: request.model || this.config.model,
    });

    try {
      // Convert messages to Anthropic format
      const messages = request.messages.map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      }));

      const response = await client.messages.create({
        model: request.model || this.config.model,
        max_tokens: request.maxTokens || this.config.maxTokens,
        system: request.system,
        messages,
        temperature: request.temperature ?? this.config.temperature,
        stop_sequences: request.stopSequences,
      });

      const latencyMs = Date.now() - startTime;

      // Extract text content
      const textContent = response.content
        .filter((block): block is { type: 'text'; text: string } => block.type === 'text')
        .map((block) => block.text)
        .join('\n');

      const result: AICompletionResponse = {
        content: textContent,
        model: response.model,
        usage: {
          inputTokens: response.usage.input_tokens,
          outputTokens: response.usage.output_tokens,
          totalTokens: response.usage.input_tokens + response.usage.output_tokens,
        },
        stopReason: this.mapStopReason(response.stop_reason),
        latencyMs,
      };

      log.info('Anthropic API response received', {
        agent: request.metadata?.agent,
        latencyMs,
        inputTokens: result.usage.inputTokens,
        outputTokens: result.usage.outputTokens,
        stopReason: result.stopReason,
      });

      return result;
    } catch (error) {
      const latencyMs = Date.now() - startTime;
      log.error('Anthropic API request failed', {
        agent: request.metadata?.agent,
        latencyMs,
        error,
      });

      if (error instanceof Error) {
        throw error;
      }
      throw new Error(`Anthropic API error: ${String(error)}`);
    }
  }

  /**
   * Map Anthropic stop reason to our format
   */
  private mapStopReason(
    reason: string | null
  ): AICompletionResponse['stopReason'] {
    switch (reason) {
      case 'end_turn':
        return 'end_turn';
      case 'max_tokens':
        return 'max_tokens';
      case 'stop_sequence':
        return 'stop_sequence';
      default:
        return 'end_turn';
    }
  }

  /**
   * Get current configuration
   */
  getConfig(): AIProviderConfig {
    return { ...this.config, apiKey: this.config.apiKey ? '***' : undefined };
  }
}

/**
 * Create Anthropic API provider
 */
export function createAnthropicApiProvider(config: AIProviderConfig): AnthropicApiProvider {
  return new AnthropicApiProvider(config);
}
