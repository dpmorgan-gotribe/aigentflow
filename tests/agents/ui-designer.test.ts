/**
 * UI Designer Agent Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { UIDesignerAgent, createUIDesignerAgent } from '../../src/agents/ui-designer.js';
import type { AgentRequest, ExecutionContext } from '../../src/agents/types.js';
import type { ProjectConfig } from '../../src/types.js';
import type { UIDesignOutput } from '../../src/design/types.js';

const createTestContext = (overrides: Partial<ProjectConfig> = {}): ExecutionContext => ({
  taskId: 'test-task-1',
  currentState: 'DESIGNING',
  projectConfig: {
    name: 'test-project',
    version: '1.0.0',
    description: 'Test project',
    path: process.cwd(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    features: {
      gitWorktrees: false,
      parallelAgents: false,
      selfEvolution: false,
    },
    compliance: {
      frameworks: [],
      strictMode: false,
    },
    agents: {},
    hooks: [],
    ...overrides,
  },
  previousOutputs: new Map(),
  lessonsLearned: [],
});

const createTestRequest = (
  prompt: string,
  context: ExecutionContext
): AgentRequest => ({
  id: `req-${Date.now()}`,
  taskId: context.taskId,
  agentType: 'ui-designer',
  prompt,
  context,
});

describe('UIDesignerAgent', () => {
  let agent: UIDesignerAgent;

  beforeEach(() => {
    agent = new UIDesignerAgent();
  });

  describe('Metadata', () => {
    it('should have correct agent type', () => {
      expect(agent.metadata.type).toBe('ui-designer');
    });

    it('should have correct phase', () => {
      expect(agent.metadata.phase).toBe('v1.0');
    });

    it('should have correct name', () => {
      expect(agent.metadata.name).toBe('UI Designer');
    });

    it('should have expected capabilities', () => {
      expect(agent.metadata.capabilities).toContain('html-mockup-generation');
      expect(agent.metadata.capabilities).toContain('responsive-design');
      expect(agent.metadata.capabilities).toContain('accessibility-compliance');
      expect(agent.metadata.capabilities).toContain('component-library');
      expect(agent.metadata.capabilities).toContain('design-tokens');
    });

    it('should operate in expected states', () => {
      expect(agent.metadata.validStates).toContain('ANALYZING');
      expect(agent.metadata.validStates).toContain('DESIGNING');
      expect(agent.metadata.validStates).toContain('BUILDING');
    });
  });

  describe('Factory Function', () => {
    it('should create agent instance', () => {
      const factoryAgent = createUIDesignerAgent();
      expect(factoryAgent).toBeInstanceOf(UIDesignerAgent);
    });

    it('should accept configuration', () => {
      const factoryAgent = createUIDesignerAgent({
        defaultTheme: 'dark',
        accessibilityLevel: 'AAA',
      });
      expect(factoryAgent).toBeInstanceOf(UIDesignerAgent);
    });

    it('should create independent instances', () => {
      const agent1 = createUIDesignerAgent();
      const agent2 = createUIDesignerAgent();
      expect(agent1).not.toBe(agent2);
    });
  });

  describe('canHandle', () => {
    it('should handle ui-design task', () => {
      const context = createTestContext();
      expect(agent.canHandle('ui-design', context)).toBe(true);
    });

    it('should handle mockup-generation task', () => {
      const context = createTestContext();
      expect(agent.canHandle('mockup-generation', context)).toBe(true);
    });

    it('should handle component-design task', () => {
      const context = createTestContext();
      expect(agent.canHandle('component-design', context)).toBe(true);
    });

    it('should handle page-layout task', () => {
      const context = createTestContext();
      expect(agent.canHandle('page-layout', context)).toBe(true);
    });

    it('should handle form-design task', () => {
      const context = createTestContext();
      expect(agent.canHandle('form-design', context)).toBe(true);
    });

    it('should not handle unrelated tasks', () => {
      const context = createTestContext();
      expect(agent.canHandle('database-migration', context)).toBe(false);
    });
  });

  describe('Validation', () => {
    it('should validate proper request', async () => {
      const context = createTestContext();
      const request = createTestRequest('Design a login page', context);

      const isValid = await agent.validate(request);
      expect(isValid).toBe(true);
    });

    it('should reject request without id', async () => {
      const context = createTestContext();
      const request = createTestRequest('Design a login page', context);
      request.id = '';

      const isValid = await agent.validate(request);
      expect(isValid).toBe(false);
    });
  });

  describe('Execution', () => {
    it('should execute successfully', async () => {
      const context = createTestContext();
      const request = createTestRequest('Design a landing page', context);

      const result = await agent.execute(request);

      expect(result.success).toBe(true);
      expect(result.output).toBeDefined();
    });

    it('should return UI design output structure', async () => {
      const context = createTestContext();
      const request = createTestRequest('Design a dashboard', context);

      const result = await agent.execute(request);

      const output = result.output as UIDesignOutput;
      expect(output).toHaveProperty('layout');
      expect(output).toHaveProperty('html');
      expect(output).toHaveProperty('css');
      expect(output).toHaveProperty('components');
      expect(output).toHaveProperty('tokens');
      expect(output).toHaveProperty('accessibility');
      expect(output).toHaveProperty('responsive');
    });

    it('should generate HTML output', async () => {
      const context = createTestContext();
      const request = createTestRequest('Design a simple page', context);

      const result = await agent.execute(request);

      const output = result.output as UIDesignOutput;
      expect(output.html).toContain('<!DOCTYPE html>');
      expect(output.html).toContain('<html');
      expect(output.html).toContain('</html>');
    });

    it('should generate CSS output', async () => {
      const context = createTestContext();
      const request = createTestRequest('Design a page', context);

      const result = await agent.execute(request);

      const output = result.output as UIDesignOutput;
      expect(output.css).toBeDefined();
      expect(output.css.length).toBeGreaterThan(0);
    });

    it('should include design tokens', async () => {
      const context = createTestContext();
      const request = createTestRequest('Design a page', context);

      const result = await agent.execute(request);

      const output = result.output as UIDesignOutput;
      expect(output.tokens).toHaveProperty('colors');
      expect(output.tokens).toHaveProperty('typography');
      expect(output.tokens).toHaveProperty('spacing');
    });

    it('should include accessibility score', async () => {
      const context = createTestContext();
      const request = createTestRequest('Design a page', context);

      const result = await agent.execute(request);

      const output = result.output as UIDesignOutput;
      expect(typeof output.accessibility.score).toBe('number');
      expect(output.accessibility.score).toBeGreaterThanOrEqual(0);
      expect(output.accessibility.score).toBeLessThanOrEqual(100);
    });

    it('should include responsive breakpoints', async () => {
      const context = createTestContext();
      const request = createTestRequest('Design a page', context);

      const result = await agent.execute(request);

      const output = result.output as UIDesignOutput;
      expect(Array.isArray(output.responsive.breakpoints)).toBe(true);
      expect(output.responsive.breakpoints.length).toBeGreaterThan(0);
    });

    it('should provide routing hint', async () => {
      const context = createTestContext();
      const request = createTestRequest('Design a page', context);

      const result = await agent.execute(request);

      expect(result.routingHint).toBeDefined();
      expect(result.routingHint?.nextAgent).toBeDefined();
    });
  });

  describe('Design Types', () => {
    it('should generate page design', async () => {
      const context = createTestContext();
      const request = createTestRequest('Design a home page', context);

      const result = await agent.execute(request);

      const output = result.output as UIDesignOutput;
      expect(output.components.length).toBeGreaterThan(0);
    });

    it('should generate form design', async () => {
      const context = createTestContext();
      const request = createTestRequest('Design a contact form', context);

      const result = await agent.execute(request);

      const output = result.output as UIDesignOutput;
      expect(output.html).toContain('form');
    });

    it('should generate navigation design', async () => {
      const context = createTestContext();
      const request = createTestRequest('Design a page with navigation and header', context);

      const result = await agent.execute(request);

      const output = result.output as UIDesignOutput;
      expect(output.html).toContain('nav');
    });

    it('should generate dashboard design', async () => {
      const context = createTestContext();
      const request = createTestRequest('Design a dashboard with analytics', context);

      const result = await agent.execute(request);

      const output = result.output as UIDesignOutput;
      expect(output.html).toContain('dashboard');
    });

    it('should generate table design', async () => {
      const context = createTestContext();
      const request = createTestRequest('Design a data table with rows', context);

      const result = await agent.execute(request);

      const output = result.output as UIDesignOutput;
      expect(output.html).toContain('table');
    });
  });

  describe('Authentication Forms', () => {
    it('should generate login form', async () => {
      const context = createTestContext();
      const request = createTestRequest('Design a login page', context);

      const result = await agent.execute(request);

      const output = result.output as UIDesignOutput;
      expect(output.html).toContain('Sign In');
      expect(output.html).toContain('email');
      expect(output.html).toContain('password');
    });

    it('should generate registration form', async () => {
      const context = createTestContext();
      const request = createTestRequest('Design a register page', context);

      const result = await agent.execute(request);

      const output = result.output as UIDesignOutput;
      expect(output.html).toContain('Create Account');
    });
  });

  describe('Content Display', () => {
    it('should generate card layout', async () => {
      const context = createTestContext();
      const request = createTestRequest('Design a page with card grid', context);

      const result = await agent.execute(request);

      const output = result.output as UIDesignOutput;
      expect(output.html).toContain('card');
    });

    it('should generate list layout', async () => {
      const context = createTestContext();
      const request = createTestRequest('Design a page with list view', context);

      const result = await agent.execute(request);

      expect(result.success).toBe(true);
    });
  });

  describe('Accessibility Checking', () => {
    it('should return accessibility issues array', async () => {
      const context = createTestContext();
      const request = createTestRequest('Design a simple page', context);

      const result = await agent.execute(request);

      const output = result.output as UIDesignOutput;
      expect(Array.isArray(output.accessibility.issues)).toBe(true);
    });

    it('should detect accessibility issues', async () => {
      const context = createTestContext();
      const request = createTestRequest('Design a page', context);

      const result = await agent.execute(request);

      const output = result.output as UIDesignOutput;
      // Score should be calculated
      expect(typeof output.accessibility.score).toBe('number');
    });
  });

  describe('Responsive Design', () => {
    it('should include media queries', async () => {
      const context = createTestContext();
      const request = createTestRequest('Design a responsive page', context);

      const result = await agent.execute(request);

      const output = result.output as UIDesignOutput;
      expect(output.responsive.mediaQueries).toBeDefined();
      expect(output.responsive.mediaQueries).toContain('@media');
    });

    it('should include all breakpoints', async () => {
      const context = createTestContext();
      const request = createTestRequest('Design a page', context);

      const result = await agent.execute(request);

      const output = result.output as UIDesignOutput;
      expect(output.responsive.breakpoints).toContain('mobile');
      expect(output.responsive.breakpoints).toContain('tablet');
      expect(output.responsive.breakpoints).toContain('desktop');
    });
  });

  describe('Component Generation', () => {
    it('should generate layout components', async () => {
      const context = createTestContext();
      const request = createTestRequest('Design a layout with sidebar', context);

      const result = await agent.execute(request);

      const output = result.output as UIDesignOutput;
      expect(output.components.length).toBeGreaterThan(0);
    });

    it('should generate component hierarchy', async () => {
      const context = createTestContext();
      const request = createTestRequest('Design a page', context);

      const result = await agent.execute(request);

      const output = result.output as UIDesignOutput;
      // Check that components have nested children
      const hasChildren = output.components.some((c) => c.children && c.children.length > 0);
      expect(hasChildren).toBe(true);
    });
  });

  describe('Dry Run', () => {
    it('should return dry run result when dryRun is true', async () => {
      const context = createTestContext();
      const request = createTestRequest('Design a page', context);

      const result = await agent.execute(request, { dryRun: true });

      expect(result.success).toBe(true);
      const output = result.output as { dryRun: boolean };
      expect(output.dryRun).toBe(true);
    });
  });

  describe('Metrics', () => {
    it('should track execution duration', async () => {
      const context = createTestContext();
      const request = createTestRequest('Design a page', context);

      const result = await agent.execute(request);

      expect(result.metrics.duration).toBeGreaterThanOrEqual(0);
    });

    it('should track token usage', async () => {
      const context = createTestContext();
      const request = createTestRequest('Design a page', context);

      const result = await agent.execute(request);

      expect(result.metrics.tokensUsed).toBeGreaterThan(0);
    });
  });

  describe('Capabilities', () => {
    it('should return all capabilities', () => {
      const capabilities = agent.getCapabilities();

      expect(capabilities).toContain('html-mockup-generation');
      expect(capabilities).toContain('responsive-design');
      expect(capabilities).toContain('accessibility-compliance');
      expect(capabilities).toContain('component-library');
      expect(capabilities).toContain('design-tokens');
    });
  });

  describe('Configuration', () => {
    it('should accept dark theme', () => {
      const darkAgent = createUIDesignerAgent({ defaultTheme: 'dark' });
      expect(darkAgent).toBeInstanceOf(UIDesignerAgent);
    });

    it('should accept AAA accessibility level', () => {
      const aaaAgent = createUIDesignerAgent({ accessibilityLevel: 'AAA' });
      expect(aaaAgent).toBeInstanceOf(UIDesignerAgent);
    });

    it('should accept custom breakpoints', () => {
      const customAgent = createUIDesignerAgent({
        defaultBreakpoints: ['mobile', 'desktop'],
      });
      expect(customAgent).toBeInstanceOf(UIDesignerAgent);
    });

    it('should accept custom tokens', () => {
      const customAgent = createUIDesignerAgent({
        tokens: {
          colors: {
            primary: '#ff0000',
            secondary: '#00ff00',
            accent: '#0000ff',
            background: '#ffffff',
            surface: '#f5f5f5',
            text: '#000000',
            textMuted: '#666666',
            border: '#cccccc',
            error: '#ff0000',
            warning: '#ffaa00',
            success: '#00ff00',
            info: '#0000ff',
          },
        },
      });
      expect(customAgent).toBeInstanceOf(UIDesignerAgent);
    });
  });

  describe('Routing', () => {
    it('should route to architect by default', async () => {
      const context = createTestContext();
      const request = createTestRequest('Design a page', context);

      const result = await agent.execute(request);

      expect(result.routingHint?.nextAgent).toBe('architect');
    });

    it('should route to frontend-developer when parallel agents enabled', async () => {
      const context = createTestContext({
        features: {
          gitWorktrees: false,
          parallelAgents: true,
          selfEvolution: false,
        },
      });
      const request = createTestRequest('Design a page', context);

      const result = await agent.execute(request);

      expect(result.routingHint?.nextAgent).toBe('frontend-developer');
    });
  });
});
