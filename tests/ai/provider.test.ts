/**
 * AI Provider Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  createAIProvider,
  getAIProvider,
  resetAIProvider,
  checkAIAvailability,
  complete,
  MockAIProvider,
  ClaudeCliProvider,
  AnthropicApiProvider,
  resetAIConfig,
  type AIProviderConfig,
} from '../../src/ai/index.js';

describe('AI Provider', () => {
  beforeEach(() => {
    resetAIProvider();
    resetAIConfig();
    // Reset environment
    delete process.env.USE_CLAUDE_CLI;
    delete process.env.DEV_MODE;
    delete process.env.ANTHROPIC_API_KEY;
  });

  afterEach(() => {
    resetAIProvider();
    resetAIConfig();
  });

  describe('createAIProvider', () => {
    it('should create mock provider when DEV_MODE=true', () => {
      process.env.DEV_MODE = 'true';
      resetAIConfig();

      const provider = createAIProvider();

      expect(provider).toBeInstanceOf(MockAIProvider);
      expect(provider.name).toBe('Mock AI');
      expect(provider.type).toBe('mock');
    });

    it('should create Claude CLI provider when USE_CLAUDE_CLI=true', () => {
      process.env.USE_CLAUDE_CLI = 'true';
      process.env.DEV_MODE = 'false';
      resetAIConfig();

      const provider = createAIProvider();

      expect(provider).toBeInstanceOf(ClaudeCliProvider);
      expect(provider.name).toBe('Claude CLI');
      expect(provider.type).toBe('claude-cli');
    });

    it('should create Anthropic API provider when USE_CLAUDE_CLI=false', () => {
      process.env.USE_CLAUDE_CLI = 'false';
      process.env.DEV_MODE = 'false';
      process.env.ANTHROPIC_API_KEY = 'test-key';
      resetAIConfig();

      const provider = createAIProvider();

      expect(provider).toBeInstanceOf(AnthropicApiProvider);
      expect(provider.name).toBe('Anthropic API');
      expect(provider.type).toBe('anthropic-api');
    });

    it('should create provider from explicit config', () => {
      const config: AIProviderConfig = {
        provider: 'mock',
        model: 'test-model',
        maxTokens: 1000,
        temperature: 0.5,
        timeout: 30000,
      };

      const provider = createAIProvider(config);

      expect(provider).toBeInstanceOf(MockAIProvider);
      expect(provider.getConfig().model).toBe('test-model');
      expect(provider.getConfig().maxTokens).toBe(1000);
    });
  });

  describe('getAIProvider', () => {
    it('should return singleton instance', () => {
      process.env.DEV_MODE = 'true';
      resetAIConfig();

      const provider1 = getAIProvider();
      const provider2 = getAIProvider();

      expect(provider1).toBe(provider2);
    });

    it('should create new instance after reset', () => {
      process.env.DEV_MODE = 'true';
      resetAIConfig();

      const provider1 = getAIProvider();
      resetAIProvider();
      const provider2 = getAIProvider();

      expect(provider1).not.toBe(provider2);
    });
  });

  describe('MockAIProvider', () => {
    it('should always be available', async () => {
      const provider = new MockAIProvider({
        provider: 'mock',
        model: 'test',
        maxTokens: 1000,
        temperature: 0.7,
        timeout: 30000,
      });

      const available = await provider.isAvailable();

      expect(available).toBe(true);
    });

    it('should return mock response', async () => {
      const provider = new MockAIProvider({
        provider: 'mock',
        model: 'test-model',
        maxTokens: 1000,
        temperature: 0.7,
        timeout: 30000,
      });

      const response = await provider.complete({
        messages: [{ role: 'user', content: 'Hello' }],
        metadata: { agent: 'test' },
      });

      expect(response.content).toBeTruthy();
      expect(response.model).toBe('test-model');
      expect(response.usage.totalTokens).toBeGreaterThan(0);
      expect(response.stopReason).toBe('end_turn');
      expect(response.latencyMs).toBeGreaterThan(0);
    });

    it('should generate contextual response for orchestrator', async () => {
      const provider = new MockAIProvider({
        provider: 'mock',
        model: 'test',
        maxTokens: 1000,
        temperature: 0.7,
        timeout: 30000,
      });

      const response = await provider.complete({
        system: 'You are an orchestrator agent',
        messages: [{ role: 'user', content: 'Route this task' }],
      });

      const parsed = JSON.parse(response.content);
      expect(parsed.routing).toBeDefined();
      expect(parsed.analysis).toBeDefined();
    });

    it('should generate contextual response for architect', async () => {
      const provider = new MockAIProvider({
        provider: 'mock',
        model: 'test',
        maxTokens: 1000,
        temperature: 0.7,
        timeout: 30000,
      });

      const response = await provider.complete({
        system: 'You are an architect agent',
        messages: [{ role: 'user', content: 'Design the architecture' }],
      });

      const parsed = JSON.parse(response.content);
      expect(parsed.architecture).toBeDefined();
      expect(parsed.architecture.pattern).toBeDefined();
    });
  });

  describe('checkAIAvailability', () => {
    it('should return availability status', async () => {
      process.env.DEV_MODE = 'true';
      resetAIConfig();
      resetAIProvider();

      const status = await checkAIAvailability();

      expect(status.available).toBe(true);
      expect(status.provider).toBe('Mock AI');
      expect(status.error).toBeUndefined();
    });
  });

  describe('complete helper', () => {
    it('should send completion request', async () => {
      process.env.DEV_MODE = 'true';
      resetAIConfig();
      resetAIProvider();

      const result = await complete('Hello, world!', {
        metadata: { agent: 'test', operation: 'greeting' },
      });

      expect(result).toBeTruthy();
      expect(typeof result).toBe('string');
    });

    it('should pass system prompt', async () => {
      process.env.DEV_MODE = 'true';
      resetAIConfig();
      resetAIProvider();

      const result = await complete('Design the system', {
        system: 'You are an architect agent',
      });

      expect(result).toContain('architecture');
    });
  });

  describe('ClaudeCliProvider', () => {
    it('should have correct properties', () => {
      const provider = new ClaudeCliProvider({
        provider: 'claude-cli',
        model: 'claude-sonnet-4-20250514',
        maxTokens: 8192,
        temperature: 0.7,
        timeout: 120000,
        cliPath: 'claude',
      });

      expect(provider.name).toBe('Claude CLI');
      expect(provider.type).toBe('claude-cli');
    });

    it('should return config without sensitive data', () => {
      const provider = new ClaudeCliProvider({
        provider: 'claude-cli',
        model: 'claude-sonnet-4-20250514',
        maxTokens: 8192,
        temperature: 0.7,
        timeout: 120000,
      });

      const config = provider.getConfig();

      expect(config.model).toBe('claude-sonnet-4-20250514');
      expect(config.maxTokens).toBe(8192);
    });
  });

  describe('AnthropicApiProvider', () => {
    it('should have correct properties', () => {
      const provider = new AnthropicApiProvider({
        provider: 'anthropic-api',
        model: 'claude-sonnet-4-20250514',
        maxTokens: 8192,
        temperature: 0.7,
        timeout: 120000,
        apiKey: 'test-key',
      });

      expect(provider.name).toBe('Anthropic API');
      expect(provider.type).toBe('anthropic-api');
    });

    it('should mask API key in config', () => {
      const provider = new AnthropicApiProvider({
        provider: 'anthropic-api',
        model: 'claude-sonnet-4-20250514',
        maxTokens: 8192,
        temperature: 0.7,
        timeout: 120000,
        apiKey: 'sk-ant-secret-key',
      });

      const config = provider.getConfig();

      expect(config.apiKey).toBe('***');
    });

    it('should report unavailable without API key', async () => {
      const provider = new AnthropicApiProvider({
        provider: 'anthropic-api',
        model: 'claude-sonnet-4-20250514',
        maxTokens: 8192,
        temperature: 0.7,
        timeout: 120000,
      });

      const available = await provider.isAvailable();

      expect(available).toBe(false);
    });
  });
});
