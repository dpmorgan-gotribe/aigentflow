/**
 * Mock Response Generator
 *
 * Generates template responses for development/testing without AI.
 */

import type { AgentType, TaskType } from '../types.js';
import { HtmlGenerator } from '../design/html-generator.js';
import { ResponsiveStylesGenerator } from '../design/responsive-styles.js';
import { logger } from '../utils/logger.js';

const log = logger.child({ component: 'mock-responses' });

/**
 * Mock response structure
 */
export interface MockAgentResponse {
  agent: AgentType;
  success: boolean;
  output: Record<string, unknown>;
  artifacts?: MockArtifact[];
  nextAgent?: AgentType;
  message: string;
}

export interface MockArtifact {
  type: 'file' | 'html' | 'css' | 'json' | 'markdown';
  name: string;
  content: string;
}

/**
 * Extract key entities from a prompt
 */
function extractEntities(prompt: string): {
  feature: string;
  components: string[];
  actions: string[];
} {
  const promptLower = prompt.toLowerCase();

  // Common features
  const features = ['login', 'signup', 'dashboard', 'profile', 'settings', 'todo', 'cart', 'checkout', 'search', 'list', 'form', 'table', 'modal', 'navigation'];
  const feature = features.find((f) => promptLower.includes(f)) ?? 'feature';

  // Common components
  const componentKeywords = ['page', 'form', 'button', 'input', 'modal', 'card', 'list', 'table', 'header', 'footer', 'sidebar', 'menu'];
  const components = componentKeywords.filter((c) => promptLower.includes(c));
  if (components.length === 0) components.push('page');

  // Common actions
  const actionKeywords = ['create', 'add', 'update', 'delete', 'edit', 'view', 'list', 'search', 'filter', 'sort', 'submit', 'validate'];
  const actions = actionKeywords.filter((a) => promptLower.includes(a));
  if (actions.length === 0) actions.push('create');

  return { feature, components, actions };
}

/**
 * Generate mock orchestrator response
 */
function generateOrchestratorResponse(prompt: string, taskType: TaskType): MockAgentResponse {
  const entities = extractEntities(prompt);

  return {
    agent: 'orchestrator',
    success: true,
    output: {
      taskType,
      routing: {
        primary: 'project-manager',
        sequence: ['project-manager', 'architect', 'ui-designer', 'frontend-developer', 'tester', 'reviewer'],
      },
      context: {
        feature: entities.feature,
        components: entities.components,
        estimatedComplexity: entities.components.length > 2 ? 'medium' : 'low',
      },
    },
    nextAgent: 'project-manager',
    message: `Routed "${entities.feature}" task to project-manager. Identified ${entities.components.length} components.`,
  };
}

/**
 * Generate mock project manager response
 */
function generateProjectManagerResponse(prompt: string): MockAgentResponse {
  const entities = extractEntities(prompt);

  const tasks = [
    { id: 'task-1', name: `Design ${entities.feature} UI`, agent: 'ui-designer', priority: 1 },
    { id: 'task-2', name: `Implement ${entities.feature} frontend`, agent: 'frontend-developer', priority: 2, dependsOn: ['task-1'] },
    { id: 'task-3', name: `Create ${entities.feature} API`, agent: 'backend-developer', priority: 2, dependsOn: ['task-1'] },
    { id: 'task-4', name: `Write ${entities.feature} tests`, agent: 'tester', priority: 3, dependsOn: ['task-2', 'task-3'] },
    { id: 'task-5', name: `Review ${entities.feature}`, agent: 'reviewer', priority: 4, dependsOn: ['task-4'] },
  ];

  return {
    agent: 'project-manager',
    success: true,
    output: {
      workBreakdown: {
        feature: entities.feature,
        tasks,
        estimatedEffort: '2-4 hours',
        criticalPath: ['task-1', 'task-2', 'task-4', 'task-5'],
      },
      dependencies: {
        external: [],
        internal: tasks.filter((t) => t.dependsOn).map((t) => ({ task: t.id, dependsOn: t.dependsOn })),
      },
    },
    nextAgent: 'architect',
    message: `Created work breakdown with ${tasks.length} tasks for "${entities.feature}".`,
  };
}

/**
 * Generate mock architect response
 */
function generateArchitectResponse(prompt: string): MockAgentResponse {
  const entities = extractEntities(prompt);

  const adr = `# ADR-001: ${entities.feature.charAt(0).toUpperCase() + entities.feature.slice(1)} Architecture

## Status
Proposed

## Context
We need to implement a ${entities.feature} feature with the following components: ${entities.components.join(', ')}.

## Decision
We will use a component-based architecture with:
- React functional components with hooks
- TypeScript for type safety
- CSS Modules for styling
- REST API for backend communication

## Consequences
### Positive
- Clean separation of concerns
- Type safety reduces runtime errors
- Scoped styles prevent conflicts

### Negative
- Additional build configuration needed
- Learning curve for TypeScript

## Technical Stack
- Frontend: React 18, TypeScript, CSS Modules
- State: React Context + useReducer
- API: REST with fetch
- Testing: Vitest + React Testing Library
`;

  return {
    agent: 'architect',
    success: true,
    output: {
      architecture: {
        pattern: 'component-based',
        stack: {
          frontend: ['React', 'TypeScript', 'CSS Modules'],
          backend: ['Node.js', 'Express'],
          database: ['PostgreSQL'],
        },
        components: entities.components.map((c) => ({
          name: `${entities.feature}-${c}`,
          type: c,
          responsibility: `Handle ${c} functionality for ${entities.feature}`,
        })),
      },
      decisions: [
        { id: 'ADR-001', title: `${entities.feature} Architecture`, status: 'proposed' },
      ],
    },
    artifacts: [
      { type: 'markdown', name: 'ADR-001.md', content: adr },
    ],
    nextAgent: 'ui-designer',
    message: `Created architecture decision for "${entities.feature}" with ${entities.components.length} components.`,
  };
}

/**
 * Generate mock UI designer response with actual HTML/CSS
 */
function generateUIDesignerResponse(prompt: string): MockAgentResponse {
  const entities = extractEntities(prompt);
  const htmlGen = new HtmlGenerator();
  const stylesGen = new ResponsiveStylesGenerator();

  // Generate actual components based on the feature
  let layout;
  let styles = '';

  if (entities.feature === 'login' || entities.feature === 'signup') {
    layout = {
      id: `${entities.feature}-page`,
      name: `${entities.feature.charAt(0).toUpperCase() + entities.feature.slice(1)} Page`,
      meta: { title: `${entities.feature.charAt(0).toUpperCase() + entities.feature.slice(1)} - App` },
      components: [
        {
          id: 'auth-container',
          type: 'container' as const,
          className: 'auth-container',
          children: [
            { id: 'logo', type: 'image' as const, props: { src: '/logo.svg', alt: 'Logo' } },
            { id: 'title', type: 'heading' as const, content: entities.feature === 'login' ? 'Welcome Back' : 'Create Account', props: { level: 1 } },
            {
              id: 'auth-form',
              type: 'form' as const,
              className: 'auth-form',
              children: [
                ...(entities.feature === 'signup' ? [{
                  id: 'name-group',
                  type: 'container' as const,
                  className: 'form-group',
                  children: [
                    { id: 'name-label', type: 'label' as const, content: 'Full Name', props: { for: 'name' } },
                    { id: 'name', type: 'input' as const, props: { type: 'text', placeholder: 'Enter your name', required: true } },
                  ],
                }] : []),
                {
                  id: 'email-group',
                  type: 'container' as const,
                  className: 'form-group',
                  children: [
                    { id: 'email-label', type: 'label' as const, content: 'Email', props: { for: 'email' } },
                    { id: 'email', type: 'input' as const, props: { type: 'email', placeholder: 'Enter your email', required: true } },
                  ],
                },
                {
                  id: 'password-group',
                  type: 'container' as const,
                  className: 'form-group',
                  children: [
                    { id: 'password-label', type: 'label' as const, content: 'Password', props: { for: 'password' } },
                    { id: 'password', type: 'input' as const, props: { type: 'password', placeholder: 'Enter your password', required: true } },
                  ],
                },
                { id: 'submit', type: 'button' as const, content: entities.feature === 'login' ? 'Sign In' : 'Sign Up', props: { type: 'submit', variant: 'primary' } },
              ],
            },
            { id: 'alt-link', type: 'link' as const, content: entities.feature === 'login' ? "Don't have an account? Sign up" : 'Already have an account? Sign in', props: { href: entities.feature === 'login' ? '/signup' : '/login' } },
          ],
        },
      ],
      styles: `
        .auth-container { max-width: 400px; margin: 4rem auto; padding: 2rem; text-align: center; }
        .auth-form { margin-top: 2rem; text-align: left; }
        .form-group { margin-bottom: 1.5rem; }
        .form-group label { display: block; margin-bottom: 0.5rem; font-weight: 500; }
        .form-group input { width: 100%; padding: 0.75rem; border: 1px solid var(--color-border); border-radius: var(--radius-md); }
        .form-group input:focus { outline: 2px solid var(--color-primary); outline-offset: 2px; }
      `,
    };

    styles = stylesGen.generateComponentStyles('btn', {
      base: { padding: '12px 24px', borderRadius: '8px', fontWeight: '600', width: '100%', cursor: 'pointer' },
      hover: { opacity: '0.9' },
      variants: { primary: { backgroundColor: 'var(--color-primary)', color: 'white', border: 'none' } },
    });
  } else if (entities.feature === 'dashboard') {
    layout = {
      id: 'dashboard-page',
      name: 'Dashboard',
      meta: { title: 'Dashboard - App' },
      components: [
        {
          id: 'dashboard-header',
          type: 'container' as const,
          className: 'dashboard-header',
          children: [
            { id: 'title', type: 'heading' as const, content: 'Dashboard', props: { level: 1 } },
            { id: 'user-menu', type: 'button' as const, content: 'Profile', props: { variant: 'secondary' } },
          ],
        },
        {
          id: 'stats-grid',
          type: 'container' as const,
          className: 'stats-grid',
          children: [
            { id: 'stat-1', type: 'container' as const, className: 'stat-card', children: [{ id: 's1-title', type: 'text' as const, content: 'Total Users' }, { id: 's1-value', type: 'heading' as const, content: '1,234', props: { level: 2 } }] },
            { id: 'stat-2', type: 'container' as const, className: 'stat-card', children: [{ id: 's2-title', type: 'text' as const, content: 'Revenue' }, { id: 's2-value', type: 'heading' as const, content: '$12,345', props: { level: 2 } }] },
            { id: 'stat-3', type: 'container' as const, className: 'stat-card', children: [{ id: 's3-title', type: 'text' as const, content: 'Active Now' }, { id: 's3-value', type: 'heading' as const, content: '42', props: { level: 2 } }] },
          ],
        },
      ],
      styles: `
        .dashboard-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem; }
        .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1.5rem; }
        .stat-card { background: var(--color-surface); padding: 1.5rem; border-radius: var(--radius-lg); box-shadow: var(--shadow-sm); }
      `,
    };

    styles = stylesGen.generateGridLayout('stats-grid', {
      columns: { mobile: 1, tablet: 2, desktop: 3 },
      gap: '24px',
    });
  } else {
    // Generic page
    layout = {
      id: `${entities.feature}-page`,
      name: `${entities.feature.charAt(0).toUpperCase() + entities.feature.slice(1)}`,
      meta: { title: `${entities.feature.charAt(0).toUpperCase() + entities.feature.slice(1)} - App` },
      components: [
        {
          id: 'page-container',
          type: 'container' as const,
          className: 'page-container',
          children: [
            { id: 'title', type: 'heading' as const, content: entities.feature.charAt(0).toUpperCase() + entities.feature.slice(1), props: { level: 1 } },
            { id: 'content', type: 'container' as const, className: 'content', children: entities.components.map((c, i) => ({ id: `component-${i}`, type: 'container' as const, className: c, children: [{ id: `${c}-placeholder`, type: 'text' as const, content: `${c} content goes here` }] })) },
          ],
        },
      ],
      styles: `
        .page-container { max-width: 1200px; margin: 0 auto; padding: 2rem; }
        .content { margin-top: 2rem; }
      `,
    };

    styles = stylesGen.generateContainer('page-container', {
      maxWidth: { mobile: '100%', tablet: '720px', desktop: '960px', wide: '1140px' },
      padding: { mobile: '16px', desktop: '32px' },
      centered: true,
    });
  }

  const html = htmlGen.generatePage(layout);

  return {
    agent: 'ui-designer',
    success: true,
    output: {
      design: {
        pages: [{ id: layout.id, name: layout.name, components: layout.components.length }],
        components: entities.components,
        responsive: true,
        accessibility: true,
      },
    },
    artifacts: [
      { type: 'html', name: `${entities.feature}.html`, content: html },
      { type: 'css', name: `${entities.feature}.css`, content: styles },
    ],
    nextAgent: 'frontend-developer',
    message: `Generated UI mockup for "${entities.feature}" with ${entities.components.length} components. Created HTML (${html.length} chars) and CSS.`,
  };
}

/**
 * Generate mock frontend developer response
 */
function generateFrontendDeveloperResponse(prompt: string): MockAgentResponse {
  const entities = extractEntities(prompt);

  const componentCode = `import React, { useState } from 'react';
import styles from './${entities.feature}.module.css';

interface ${entities.feature.charAt(0).toUpperCase() + entities.feature.slice(1)}Props {
  onSubmit?: (data: FormData) => void;
}

export function ${entities.feature.charAt(0).toUpperCase() + entities.feature.slice(1)}({ onSubmit }: ${entities.feature.charAt(0).toUpperCase() + entities.feature.slice(1)}Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const formData = new FormData(e.currentTarget);
      await onSubmit?.(formData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>${entities.feature.charAt(0).toUpperCase() + entities.feature.slice(1)}</h1>
      {error && <div className={styles.error} role="alert">{error}</div>}
      <form onSubmit={handleSubmit} className={styles.form}>
        {/* Form fields */}
        <button type="submit" disabled={loading} className={styles.submitButton}>
          {loading ? 'Loading...' : 'Submit'}
        </button>
      </form>
    </div>
  );
}
`;

  const testCode = `import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ${entities.feature.charAt(0).toUpperCase() + entities.feature.slice(1)} } from './${entities.feature}';

describe('${entities.feature.charAt(0).toUpperCase() + entities.feature.slice(1)}', () => {
  it('renders the component', () => {
    render(<${entities.feature.charAt(0).toUpperCase() + entities.feature.slice(1)} />);
    expect(screen.getByRole('heading')).toHaveTextContent('${entities.feature.charAt(0).toUpperCase() + entities.feature.slice(1)}');
  });

  it('handles form submission', async () => {
    const onSubmit = vi.fn();
    render(<${entities.feature.charAt(0).toUpperCase() + entities.feature.slice(1)} onSubmit={onSubmit} />);

    const button = screen.getByRole('button', { name: /submit/i });
    fireEvent.click(button);

    expect(onSubmit).toHaveBeenCalled();
  });

  it('shows loading state', () => {
    render(<${entities.feature.charAt(0).toUpperCase() + entities.feature.slice(1)} />);
    // Test loading state
  });

  it('displays error messages', () => {
    render(<${entities.feature.charAt(0).toUpperCase() + entities.feature.slice(1)} />);
    // Test error display
  });
});
`;

  return {
    agent: 'frontend-developer',
    success: true,
    output: {
      implementation: {
        framework: 'React',
        language: 'TypeScript',
        files: [
          `src/components/${entities.feature}/${entities.feature}.tsx`,
          `src/components/${entities.feature}/${entities.feature}.module.css`,
          `src/components/${entities.feature}/${entities.feature}.test.tsx`,
        ],
        testFirst: true,
      },
    },
    artifacts: [
      { type: 'file', name: `${entities.feature}.tsx`, content: componentCode },
      { type: 'file', name: `${entities.feature}.test.tsx`, content: testCode },
    ],
    nextAgent: 'tester',
    message: `Generated React component for "${entities.feature}" with TypeScript and tests.`,
  };
}

/**
 * Generate mock tester response
 */
function generateTesterResponse(prompt: string): MockAgentResponse {
  const entities = extractEntities(prompt);

  return {
    agent: 'tester',
    success: true,
    output: {
      testResults: {
        total: 8,
        passed: 8,
        failed: 0,
        skipped: 0,
        coverage: {
          statements: 87,
          branches: 82,
          functions: 90,
          lines: 86,
        },
      },
      testSuites: [
        { name: `${entities.feature}.test.tsx`, tests: 4, passed: 4, failed: 0 },
        { name: `${entities.feature}.integration.test.tsx`, tests: 4, passed: 4, failed: 0 },
      ],
    },
    nextAgent: 'reviewer',
    message: `All 8 tests passed for "${entities.feature}". Coverage: 87% statements, 82% branches.`,
  };
}

/**
 * Generate mock reviewer response
 */
function generateReviewerResponse(prompt: string): MockAgentResponse {
  const entities = extractEntities(prompt);

  return {
    agent: 'reviewer',
    success: true,
    output: {
      review: {
        status: 'approved',
        score: 8.5,
        categories: {
          codeQuality: 9,
          architecture: 8,
          security: 8,
          performance: 8,
          accessibility: 9,
        },
        suggestions: [
          { severity: 'info', message: 'Consider adding loading skeleton for better UX' },
          { severity: 'info', message: 'Could extract form validation to custom hook' },
        ],
        blockers: [],
      },
      lessons: [
        {
          category: 'pattern',
          content: `Form components benefit from loading states and error boundaries`,
          confidence: 0.85,
        },
      ],
    },
    message: `Review approved for "${entities.feature}" with score 8.5/10. 2 suggestions, no blockers.`,
  };
}

/**
 * Generate mock response for any agent
 */
export function generateMockResponse(
  agent: AgentType,
  prompt: string,
  taskType: TaskType = 'feature'
): MockAgentResponse {
  log.info('Generating mock response', { agent, taskType });

  switch (agent) {
    case 'orchestrator':
      return generateOrchestratorResponse(prompt, taskType);
    case 'project-manager':
      return generateProjectManagerResponse(prompt);
    case 'architect':
      return generateArchitectResponse(prompt);
    case 'ui-designer':
      return generateUIDesignerResponse(prompt);
    case 'frontend-developer':
      return generateFrontendDeveloperResponse(prompt);
    case 'tester':
      return generateTesterResponse(prompt);
    case 'reviewer':
      return generateReviewerResponse(prompt);
    default:
      return {
        agent,
        success: true,
        output: { message: `Mock response for ${agent}` },
        message: `${agent} completed (mock)`,
      };
  }
}

/**
 * Get the agent sequence for a task
 */
export function getAgentSequence(taskType: TaskType): AgentType[] {
  switch (taskType) {
    case 'feature':
      return ['orchestrator', 'project-manager', 'architect', 'ui-designer', 'frontend-developer', 'tester', 'reviewer'];
    case 'bugfix':
      return ['orchestrator', 'analyst', 'frontend-developer', 'tester', 'reviewer'];
    case 'refactor':
      return ['orchestrator', 'architect', 'frontend-developer', 'tester', 'reviewer'];
    case 'research':
      return ['orchestrator', 'analyst'];
    case 'ui-only':
      return ['orchestrator', 'ui-designer', 'frontend-developer', 'tester'];
    default:
      return ['orchestrator', 'project-manager', 'architect'];
  }
}
