/**
 * Mock AI Provider
 *
 * AI provider that returns mock responses for development/testing.
 */

import type {
  AIProvider,
  AIProviderConfig,
  AICompletionRequest,
  AICompletionResponse,
} from '../types.js';
import { logger } from '../../utils/logger.js';

const log = logger.child({ component: 'mock-ai-provider' });

/**
 * Mock AI Provider implementation
 */
export class MockAIProvider implements AIProvider {
  readonly name = 'Mock AI';
  readonly type = 'mock' as const;
  private config: AIProviderConfig;

  constructor(config: AIProviderConfig) {
    this.config = config;
  }

  /**
   * Always available
   */
  async isAvailable(): Promise<boolean> {
    return true;
  }

  /**
   * Return mock response
   */
  async complete(request: AICompletionRequest): Promise<AICompletionResponse> {
    const startTime = Date.now();

    log.info('Generating mock AI response', {
      agent: request.metadata?.agent,
      operation: request.metadata?.operation,
    });

    // Simulate processing time
    await new Promise((resolve) => setTimeout(resolve, 500 + Math.random() * 500));

    // Generate contextual mock response based on system prompt
    const content = this.generateMockContent(request);

    const latencyMs = Date.now() - startTime;

    // Estimate tokens
    const inputText = (request.system || '') + request.messages.map((m) => m.content).join('');
    const inputTokens = Math.ceil(inputText.length / 4);
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

    log.info('Mock AI response generated', {
      agent: request.metadata?.agent,
      latencyMs,
      outputLength: content.length,
    });

    return response;
  }

  /**
   * Generate contextual mock content
   */
  private generateMockContent(request: AICompletionRequest): string {
    const system = request.system?.toLowerCase() || '';
    const lastMessage = request.messages[request.messages.length - 1]?.content || '';

    // Detect agent type from system prompt
    if (system.includes('orchestrator')) {
      return JSON.stringify({
        routing: {
          primary: 'project-manager',
          sequence: ['project-manager', 'architect', 'ui-designer'],
        },
        analysis: {
          taskType: 'feature',
          complexity: 'medium',
          confidence: 0.85,
        },
      }, null, 2);
    }

    if (system.includes('project manager') || system.includes('project-manager')) {
      return JSON.stringify({
        workBreakdown: {
          tasks: [
            { id: 'task-1', name: 'Design UI', agent: 'ui-designer' },
            { id: 'task-2', name: 'Implement frontend', agent: 'frontend-developer' },
            { id: 'task-3', name: 'Write tests', agent: 'tester' },
          ],
          estimatedEffort: '4-6 hours',
        },
      }, null, 2);
    }

    if (system.includes('architect')) {
      return JSON.stringify({
        architecture: {
          pattern: 'component-based',
          stack: ['React', 'TypeScript', 'CSS Modules'],
          decisions: [
            { id: 'ADR-001', title: 'Use React for frontend', status: 'approved' },
          ],
        },
      }, null, 2);
    }

    if (system.includes('ui') || system.includes('designer')) {
      return JSON.stringify({
        design: {
          components: ['Header', 'Form', 'Button'],
          responsive: true,
          accessibility: true,
        },
        mockupPath: '/mockups/design.html',
      }, null, 2);
    }

    if (system.includes('frontend') || system.includes('developer')) {
      return `// Generated React Component
import React from 'react';

export function Component() {
  return (
    <div className="component">
      <h1>Generated Component</h1>
    </div>
  );
}`;
    }

    if (system.includes('tester')) {
      return JSON.stringify({
        testResults: {
          total: 10,
          passed: 10,
          failed: 0,
          coverage: { statements: 85, branches: 80 },
        },
      }, null, 2);
    }

    if (system.includes('reviewer')) {
      return JSON.stringify({
        review: {
          status: 'approved',
          score: 8.5,
          suggestions: ['Consider adding loading states'],
        },
      }, null, 2);
    }

    // Default response
    return `Mock AI response for: ${lastMessage.slice(0, 100)}...

This is a development mode response. In production, this would be a real AI response.

To enable real AI responses:
- Set USE_CLAUDE_CLI=true to use Claude CLI
- Or set USE_CLAUDE_CLI=false and provide ANTHROPIC_API_KEY`;
  }

  /**
   * Get current configuration
   */
  getConfig(): AIProviderConfig {
    return { ...this.config };
  }
}

/**
 * Create Mock AI provider
 */
export function createMockAIProvider(config: AIProviderConfig): MockAIProvider {
  return new MockAIProvider(config);
}
