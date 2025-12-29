/**
 * AI Provider Types
 *
 * Common types for AI provider abstraction.
 */

/**
 * AI Provider type
 */
export type AIProviderType = 'claude-cli' | 'anthropic-api' | 'mock';

/**
 * Message role
 */
export type MessageRole = 'user' | 'assistant' | 'system';

/**
 * Chat message
 */
export interface ChatMessage {
  role: MessageRole;
  content: string;
}

/**
 * AI completion request
 */
export interface AICompletionRequest {
  /** System prompt */
  system?: string;
  /** Messages */
  messages: ChatMessage[];
  /** Model to use (optional, uses config default) */
  model?: string;
  /** Max tokens (optional, uses config default) */
  maxTokens?: number;
  /** Temperature (optional, uses config default) */
  temperature?: number;
  /** Stop sequences */
  stopSequences?: string[];
  /** Request metadata for logging */
  metadata?: {
    agent?: string;
    taskId?: string;
    operation?: string;
  };
}

/**
 * AI completion response
 */
export interface AICompletionResponse {
  /** Response content */
  content: string;
  /** Model used */
  model: string;
  /** Token usage */
  usage: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  };
  /** Stop reason */
  stopReason: 'end_turn' | 'max_tokens' | 'stop_sequence' | 'error';
  /** Response latency in ms */
  latencyMs: number;
}

/**
 * AI provider configuration
 */
export interface AIProviderConfig {
  /** Provider type */
  provider: AIProviderType;
  /** Model name */
  model: string;
  /** Max tokens */
  maxTokens: number;
  /** Temperature */
  temperature: number;
  /** API key (for anthropic-api) */
  apiKey?: string;
  /** CLI path (for claude-cli) */
  cliPath?: string;
  /** Timeout in ms */
  timeout: number;
}

/**
 * AI Provider interface
 */
export interface AIProvider {
  /** Provider name */
  readonly name: string;
  /** Provider type */
  readonly type: AIProviderType;
  /** Check if provider is available */
  isAvailable(): Promise<boolean>;
  /** Send completion request */
  complete(request: AICompletionRequest): Promise<AICompletionResponse>;
  /** Get current configuration */
  getConfig(): AIProviderConfig;
}

/**
 * Default configuration
 */
export const DEFAULT_AI_CONFIG: AIProviderConfig = {
  provider: 'claude-cli',
  model: 'claude-sonnet-4-20250514',
  maxTokens: 8192,
  temperature: 0.7,
  timeout: 120000,
};
