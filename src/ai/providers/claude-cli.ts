/**
 * Claude CLI Provider
 *
 * AI provider that uses Claude CLI (claude-code) for completions.
 */

import { spawn } from 'child_process';
import type {
  AIProvider,
  AIProviderConfig,
  AICompletionRequest,
  AICompletionResponse,
} from '../types.js';
import { logger } from '../../utils/logger.js';

const log = logger.child({ component: 'claude-cli-provider' });

/**
 * Claude CLI Provider implementation
 */
export class ClaudeCliProvider implements AIProvider {
  readonly name = 'Claude CLI';
  readonly type = 'claude-cli' as const;
  private config: AIProviderConfig;

  constructor(config: AIProviderConfig) {
    this.config = config;
  }

  /**
   * Check if Claude CLI is available
   */
  async isAvailable(): Promise<boolean> {
    return new Promise((resolve) => {
      const cliPath = this.config.cliPath || 'claude';

      const proc = spawn(cliPath, ['--version'], {
        shell: true,
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      let output = '';
      proc.stdout?.on('data', (data) => {
        output += data.toString();
      });

      proc.on('close', (code) => {
        if (code === 0 && output.includes('claude')) {
          log.info('Claude CLI available', { version: output.trim() });
          resolve(true);
        } else {
          log.warn('Claude CLI not available');
          resolve(false);
        }
      });

      proc.on('error', () => {
        log.warn('Claude CLI not found');
        resolve(false);
      });

      // Timeout after 5 seconds
      setTimeout(() => {
        proc.kill();
        resolve(false);
      }, 5000);
    });
  }

  /**
   * Send completion request via Claude CLI
   */
  async complete(request: AICompletionRequest): Promise<AICompletionResponse> {
    const startTime = Date.now();
    const cliPath = this.config.cliPath || 'claude';

    log.info('Sending request to Claude CLI', {
      agent: request.metadata?.agent,
      operation: request.metadata?.operation,
      messageCount: request.messages.length,
    });

    // Build the prompt from messages
    const prompt = this.buildPrompt(request);

    return new Promise((resolve, reject) => {
      // Use claude with --print flag for non-interactive output
      const args = [
        '--print',  // Output response and exit
        '--model', request.model || this.config.model,
      ];

      // Add system prompt if provided
      if (request.system) {
        args.push('--system-prompt', request.system);
      }

      // Add max tokens
      const maxTokens = request.maxTokens || this.config.maxTokens;
      args.push('--max-tokens', String(maxTokens));

      // Add the prompt as the last argument
      args.push(prompt);

      log.debug('Spawning Claude CLI', { cliPath, args: args.slice(0, -1) }); // Don't log full prompt

      const proc = spawn(cliPath, args, {
        shell: true,
        stdio: ['pipe', 'pipe', 'pipe'],
        env: {
          ...process.env,
          // Ensure Claude CLI doesn't try to use interactive mode
          CLAUDE_CODE_HEADLESS: '1',
        },
      });

      let stdout = '';
      let stderr = '';

      proc.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      proc.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      const timeout = setTimeout(() => {
        proc.kill();
        reject(new Error(`Claude CLI timeout after ${this.config.timeout}ms`));
      }, this.config.timeout);

      proc.on('close', (code) => {
        clearTimeout(timeout);
        const latencyMs = Date.now() - startTime;

        if (code !== 0) {
          log.error('Claude CLI failed', { code, stderr });
          reject(new Error(`Claude CLI exited with code ${code}: ${stderr}`));
          return;
        }

        // Parse the output
        const content = stdout.trim();

        // Estimate token usage (rough approximation)
        const inputTokens = Math.ceil(prompt.length / 4);
        const outputTokens = Math.ceil(content.length / 4);

        const response: AICompletionResponse = {
          content,
          model: request.model || this.config.model,
          usage: {
            inputTokens,
            outputTokens,
            totalTokens: inputTokens + outputTokens,
          },
          stopReason: 'end_turn',
          latencyMs,
        };

        log.info('Claude CLI response received', {
          agent: request.metadata?.agent,
          latencyMs,
          outputLength: content.length,
          estimatedTokens: response.usage.totalTokens,
        });

        resolve(response);
      });

      proc.on('error', (error) => {
        clearTimeout(timeout);
        log.error('Claude CLI spawn error', { error });
        reject(new Error(`Failed to spawn Claude CLI: ${error.message}`));
      });
    });
  }

  /**
   * Build prompt from messages
   */
  private buildPrompt(request: AICompletionRequest): string {
    const parts: string[] = [];

    for (const message of request.messages) {
      if (message.role === 'user') {
        parts.push(message.content);
      } else if (message.role === 'assistant') {
        parts.push(`Assistant: ${message.content}`);
      }
    }

    return parts.join('\n\n');
  }

  /**
   * Get current configuration
   */
  getConfig(): AIProviderConfig {
    return { ...this.config };
  }
}

/**
 * Create Claude CLI provider
 */
export function createClaudeCliProvider(config: AIProviderConfig): ClaudeCliProvider {
  return new ClaudeCliProvider(config);
}
