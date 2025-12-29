/**
 * AI Configuration
 *
 * Loads AI provider configuration from environment variables.
 */

import * as fs from 'fs';
import * as path from 'path';
import type { AIProviderConfig, AIProviderType } from './types.js';
import { DEFAULT_AI_CONFIG } from './types.js';
import { logger } from '../utils/logger.js';

const log = logger.child({ component: 'ai-config' });

/**
 * Load .env file if it exists
 */
function loadEnvFile(envPath?: string): void {
  const paths = envPath
    ? [envPath]
    : [
        path.join(process.cwd(), '.env'),
        path.join(process.cwd(), '.env.local'),
      ];

  for (const filePath of paths) {
    if (fs.existsSync(filePath)) {
      try {
        const content = fs.readFileSync(filePath, 'utf-8');
        const lines = content.split('\n');

        for (const line of lines) {
          const trimmed = line.trim();
          // Skip comments and empty lines
          if (!trimmed || trimmed.startsWith('#')) continue;

          const eqIndex = trimmed.indexOf('=');
          if (eqIndex === -1) continue;

          const key = trimmed.substring(0, eqIndex).trim();
          let value = trimmed.substring(eqIndex + 1).trim();

          // Remove quotes if present
          if ((value.startsWith('"') && value.endsWith('"')) ||
              (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1);
          }

          // Only set if not already in environment
          if (!process.env[key]) {
            process.env[key] = value;
          }
        }

        log.debug('Loaded environment file', { path: filePath });
      } catch (error) {
        log.warn('Failed to load environment file', { path: filePath, error });
      }
    }
  }
}

/**
 * Get boolean from environment variable
 */
function getEnvBool(key: string, defaultValue: boolean): boolean {
  const value = process.env[key];
  if (value === undefined) return defaultValue;
  return value.toLowerCase() === 'true' || value === '1';
}

/**
 * Get number from environment variable
 */
function getEnvNumber(key: string, defaultValue: number): number {
  const value = process.env[key];
  if (value === undefined) return defaultValue;
  const num = parseInt(value, 10);
  return isNaN(num) ? defaultValue : num;
}

/**
 * Get string from environment variable
 */
function getEnvString(key: string, defaultValue: string): string {
  return process.env[key] ?? defaultValue;
}

/**
 * Determine provider type from environment
 */
function getProviderType(): AIProviderType {
  const useClaudeCli = getEnvBool('USE_CLAUDE_CLI', true);
  const devMode = getEnvBool('DEV_MODE', false);

  if (devMode) {
    return 'mock';
  }

  return useClaudeCli ? 'claude-cli' : 'anthropic-api';
}

/**
 * Load AI configuration from environment
 */
export function loadAIConfig(envPath?: string): AIProviderConfig {
  // Load .env file first
  loadEnvFile(envPath);

  const provider = getProviderType();
  const config: AIProviderConfig = {
    provider,
    model: getEnvString('AI_MODEL', DEFAULT_AI_CONFIG.model),
    maxTokens: getEnvNumber('AI_MAX_TOKENS', DEFAULT_AI_CONFIG.maxTokens),
    temperature: parseFloat(getEnvString('AI_TEMPERATURE', String(DEFAULT_AI_CONFIG.temperature))),
    timeout: getEnvNumber('CLAUDE_CLI_TIMEOUT', DEFAULT_AI_CONFIG.timeout),
  };

  // Add provider-specific config
  if (provider === 'anthropic-api') {
    config.apiKey = process.env.ANTHROPIC_API_KEY;
    if (!config.apiKey) {
      log.warn('ANTHROPIC_API_KEY not set but USE_CLAUDE_CLI=false');
    }
  }

  if (provider === 'claude-cli') {
    config.cliPath = process.env.CLAUDE_CLI_PATH || 'claude';
  }

  log.info('AI configuration loaded', {
    provider: config.provider,
    model: config.model,
    maxTokens: config.maxTokens,
  });

  return config;
}

/**
 * Validate AI configuration
 */
export function validateAIConfig(config: AIProviderConfig): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (config.provider === 'anthropic-api' && !config.apiKey) {
    errors.push('ANTHROPIC_API_KEY is required when USE_CLAUDE_CLI=false');
  }

  if (config.maxTokens < 1 || config.maxTokens > 200000) {
    errors.push('AI_MAX_TOKENS must be between 1 and 200000');
  }

  if (config.temperature < 0 || config.temperature > 1) {
    errors.push('AI_TEMPERATURE must be between 0 and 1');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

// Singleton config instance
let configInstance: AIProviderConfig | null = null;

/**
 * Get AI configuration (cached)
 */
export function getAIConfig(): AIProviderConfig {
  if (!configInstance) {
    configInstance = loadAIConfig();
  }
  return configInstance;
}

/**
 * Reset configuration (for testing)
 */
export function resetAIConfig(): void {
  configInstance = null;
}

/**
 * Check if development mode is enabled
 */
export function isDevMode(): boolean {
  return getEnvBool('DEV_MODE', false);
}

/**
 * Check if Claude CLI mode is enabled
 */
export function useClaudeCli(): boolean {
  return getEnvBool('USE_CLAUDE_CLI', true);
}
