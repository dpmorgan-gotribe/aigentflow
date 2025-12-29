/**
 * AI Module
 *
 * AI provider abstraction supporting Claude CLI and Anthropic API.
 */

// Types
export type {
  AIProviderType,
  MessageRole,
  ChatMessage,
  AICompletionRequest,
  AICompletionResponse,
  AIProviderConfig,
  AIProvider,
} from './types.js';

export { DEFAULT_AI_CONFIG } from './types.js';

// Configuration
export {
  loadAIConfig,
  validateAIConfig,
  getAIConfig,
  resetAIConfig,
  isDevMode,
  useClaudeCli,
} from './config.js';

// Providers
export { ClaudeCliProvider, createClaudeCliProvider } from './providers/claude-cli.js';
export { AnthropicApiProvider, createAnthropicApiProvider } from './providers/anthropic-api.js';
export { MockAIProvider, createMockAIProvider } from './providers/mock.js';

import type { AIProvider, AIProviderConfig } from './types.js';
import { getAIConfig } from './config.js';
import { createClaudeCliProvider } from './providers/claude-cli.js';
import { createAnthropicApiProvider } from './providers/anthropic-api.js';
import { createMockAIProvider } from './providers/mock.js';
import { logger } from '../utils/logger.js';

const log = logger.child({ component: 'ai-provider' });

// Singleton provider instance
let providerInstance: AIProvider | null = null;

/**
 * Create AI provider based on configuration
 */
export function createAIProvider(config?: AIProviderConfig): AIProvider {
  const cfg = config ?? getAIConfig();

  log.info('Creating AI provider', { type: cfg.provider });

  switch (cfg.provider) {
    case 'claude-cli':
      return createClaudeCliProvider(cfg);
    case 'anthropic-api':
      return createAnthropicApiProvider(cfg);
    case 'mock':
      return createMockAIProvider(cfg);
    default:
      log.warn('Unknown provider type, falling back to mock', { type: cfg.provider });
      return createMockAIProvider(cfg);
  }
}

/**
 * Get the singleton AI provider instance
 */
export function getAIProvider(): AIProvider {
  if (!providerInstance) {
    providerInstance = createAIProvider();
  }
  return providerInstance;
}

/**
 * Reset the AI provider (for testing)
 */
export function resetAIProvider(): void {
  providerInstance = null;
}

/**
 * Check if AI is available
 */
export async function checkAIAvailability(): Promise<{
  available: boolean;
  provider: string;
  error?: string;
}> {
  const provider = getAIProvider();

  try {
    const available = await provider.isAvailable();
    return {
      available,
      provider: provider.name,
      error: available ? undefined : 'Provider not available',
    };
  } catch (error) {
    return {
      available: false,
      provider: provider.name,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Send a simple completion request
 */
export async function complete(
  prompt: string,
  options?: {
    system?: string;
    model?: string;
    maxTokens?: number;
    metadata?: { agent?: string; taskId?: string; operation?: string };
  }
): Promise<string> {
  const provider = getAIProvider();

  const response = await provider.complete({
    system: options?.system,
    messages: [{ role: 'user', content: prompt }],
    model: options?.model,
    maxTokens: options?.maxTokens,
    metadata: options?.metadata,
  });

  return response.content;
}
