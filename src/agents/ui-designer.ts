/**
 * UI Designer Agent
 *
 * Generates UI mockups and component designs based on requirements.
 */

import { BaseAgent } from './base-agent.js';
import type {
  AgentMetadata,
  AgentRequest,
  AgentResult,
  AgentExecutionOptions,
  ExecutionContext,
  AgentType,
} from './types.js';
import {
  HtmlGenerator,
  ResponsiveStylesGenerator,
  type PageLayout,
  type ComponentDefinition,
  type DesignTokens,
  type DesignRequest,
  type UIDesignOutput,
  type Breakpoint,
  type AccessibilityAttributes,
  type FormDefinition,
  type NavigationDefinition,
  DEFAULT_TOKENS,
} from '../design/index.js';

/**
 * UI Designer agent configuration
 */
export interface UIDesignerConfig {
  defaultTheme?: 'light' | 'dark';
  accessibilityLevel?: 'AA' | 'AAA';
  defaultBreakpoints?: Breakpoint[];
  tokens?: Partial<DesignTokens>;
}

/**
 * UI Designer Agent class
 */
export class UIDesignerAgent extends BaseAgent {
  readonly metadata: AgentMetadata = {
    type: 'ui-designer',
    name: 'UI Designer',
    description: 'Generates UI mockups and component designs',
    phase: 'v1.0',
    defaultConfig: {
      enabled: true,
      maxConcurrent: 2,
      timeout: 60000,
      retryCount: 1,
    },
    capabilities: [
      'html-mockup-generation',
      'responsive-design',
      'accessibility-compliance',
      'component-library',
      'design-tokens',
    ],
    validStates: ['ANALYZING', 'DESIGNING', 'BUILDING'],
  };

  private htmlGenerator: HtmlGenerator;
  private stylesGenerator: ResponsiveStylesGenerator;
  private config: UIDesignerConfig;

  constructor(config: UIDesignerConfig = {}) {
    super();
    this.config = {
      defaultTheme: config.defaultTheme || 'light',
      accessibilityLevel: config.accessibilityLevel || 'AA',
      defaultBreakpoints: config.defaultBreakpoints || ['mobile', 'tablet', 'desktop', 'wide'],
      tokens: config.tokens,
    };

    const tokens = { ...DEFAULT_TOKENS, ...config.tokens };
    this.htmlGenerator = new HtmlGenerator(tokens);
    this.stylesGenerator = new ResponsiveStylesGenerator(tokens);
  }

  /**
   * Execute the UI designer agent
   */
  protected async executeCore(
    request: AgentRequest,
    _options: Required<AgentExecutionOptions>
  ): Promise<AgentResult> {
    const startTime = Date.now();
    const { context, prompt } = request;

    this.log.info('Starting UI design', {
      projectName: context.projectConfig.name,
      prompt: prompt.substring(0, 100),
    });

    try {
      // Parse design request from context
      const designRequest = this.parseDesignRequest(prompt, context);

      // Generate the UI design
      const output = await this.generateDesign(designRequest, context);

      // Determine next agent
      const nextAgent = this.determineNextAgent(output, context);

      this.log.info('UI design complete', {
        components: output.components.length,
        accessibilityScore: output.accessibility.score,
        nextAgent,
      });

      return this.createSuccessResult(
        output,
        startTime,
        800, // Estimated tokens
        0,
        {
          nextAgent,
          reasoning: `Generated ${output.components.length} components with accessibility score ${output.accessibility.score}`,
        }
      );
    } catch (error) {
      this.log.error('UI design failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Parse design request from prompt and context
   */
  private parseDesignRequest(prompt: string, context: ExecutionContext): DesignRequest {
    // Extract design type from prompt
    const type = this.extractDesignType(prompt);

    // Extract name
    const nameMatch = prompt.match(/(?:design|create|build|make)\s+(?:a\s+)?(.+?)(?:\s+page|\s+component|\s+form|\s+layout|$)/i);
    const name = nameMatch ? nameMatch[1].trim() : 'UI Design';

    // Extract requirements from prompt
    const requirements = this.extractRequirements(prompt);

    // Get previous architect output for constraints
    const architectOutput = context.previousOutputs.get('architect');
    const constraints = this.extractConstraints(architectOutput?.output);

    return {
      type,
      name,
      description: prompt,
      requirements,
      constraints: {
        colorScheme: this.config.defaultTheme,
        accessibility: this.config.accessibilityLevel,
        responsive: this.config.defaultBreakpoints,
        ...constraints,
      },
    };
  }

  /**
   * Extract design type from prompt
   */
  private extractDesignType(prompt: string): DesignRequest['type'] {
    const lower = prompt.toLowerCase();

    if (lower.includes('form') || lower.includes('input') || lower.includes('field')) {
      return 'form';
    }
    if (lower.includes('component') || lower.includes('widget') || lower.includes('element')) {
      return 'component';
    }
    if (lower.includes('layout') || lower.includes('structure') || lower.includes('grid')) {
      return 'layout';
    }

    return 'page';
  }

  /**
   * Extract requirements from prompt
   */
  private extractRequirements(prompt: string): string[] {
    const requirements: string[] = [];
    const lower = prompt.toLowerCase();

    // Navigation
    if (lower.includes('nav') || lower.includes('menu') || lower.includes('header')) {
      requirements.push('navigation');
    }

    // Form elements
    if (lower.includes('form') || lower.includes('input') || lower.includes('submit')) {
      requirements.push('form');
    }

    // Cards/Lists
    if (lower.includes('card') || lower.includes('list') || lower.includes('grid')) {
      requirements.push('content-display');
    }

    // Authentication
    if (lower.includes('login') || lower.includes('register') || lower.includes('auth')) {
      requirements.push('authentication');
    }

    // Dashboard
    if (lower.includes('dashboard') || lower.includes('analytics') || lower.includes('chart')) {
      requirements.push('dashboard');
    }

    // Tables
    if (lower.includes('table') || lower.includes('data') || lower.includes('rows')) {
      requirements.push('data-table');
    }

    // Modal/Dialog
    if (lower.includes('modal') || lower.includes('dialog') || lower.includes('popup')) {
      requirements.push('modal');
    }

    return requirements;
  }

  /**
   * Extract constraints from architect output
   */
  private extractConstraints(output: unknown): Partial<DesignRequest['constraints']> {
    if (!output || typeof output !== 'object') {
      return {};
    }

    const constraints: Partial<DesignRequest['constraints']> = {};
    const obj = output as Record<string, unknown>;

    if (obj.maxWidth && typeof obj.maxWidth === 'string') {
      constraints.maxWidth = obj.maxWidth;
    }

    return constraints;
  }

  /**
   * Generate UI design output
   */
  private async generateDesign(
    request: DesignRequest,
    context: ExecutionContext
  ): Promise<UIDesignOutput> {
    const tokens: DesignTokens = {
      ...DEFAULT_TOKENS,
      ...this.config.tokens,
      ...request.existingTokens,
    };

    // Generate components based on type
    const components = this.generateComponents(request);

    // Create page layout
    const layout = this.createPageLayout(request, components);

    // Generate HTML
    const html = this.htmlGenerator.generatePage(layout);

    // Generate CSS
    const css = this.generateCSS(components);

    // Run accessibility check
    const accessibility = this.checkAccessibility(components);

    // Build responsive info
    const responsive = {
      breakpoints: request.constraints?.responsive || this.config.defaultBreakpoints!,
      mediaQueries: this.stylesGenerator.generateAllMediaQueries(),
    };

    return {
      layout,
      html,
      css,
      components,
      tokens,
      accessibility,
      responsive,
    };
  }

  /**
   * Generate components based on design request
   */
  private generateComponents(request: DesignRequest): ComponentDefinition[] {
    const components: ComponentDefinition[] = [];

    // Always add a main container
    const mainContainer: ComponentDefinition = {
      id: 'main-container',
      type: 'container',
      className: 'container',
      children: [],
    };

    // Generate components based on requirements
    if (request.requirements?.includes('navigation')) {
      mainContainer.children?.push(this.generateNavigation(request));
    }

    if (request.requirements?.includes('authentication')) {
      mainContainer.children?.push(this.generateAuthForm(request));
    } else if (request.requirements?.includes('form')) {
      mainContainer.children?.push(this.generateFormComponent(request));
    }

    if (request.requirements?.includes('dashboard')) {
      mainContainer.children?.push(this.generateDashboard(request));
    }

    if (request.requirements?.includes('content-display')) {
      mainContainer.children?.push(this.generateContentGrid(request));
    }

    if (request.requirements?.includes('data-table')) {
      mainContainer.children?.push(this.generateDataTable(request));
    }

    // If no specific requirements, generate based on type
    if (!request.requirements || request.requirements.length === 0) {
      switch (request.type) {
        case 'page':
          mainContainer.children?.push(this.generateDefaultPage(request));
          break;
        case 'form':
          mainContainer.children?.push(this.generateFormComponent(request));
          break;
        case 'component':
          mainContainer.children?.push(this.generateGenericComponent(request));
          break;
        case 'layout':
          mainContainer.children?.push(this.generateLayoutComponent(request));
          break;
      }
    }

    components.push(mainContainer);
    return components;
  }

  /**
   * Generate navigation component
   */
  private generateNavigation(request: DesignRequest): ComponentDefinition {
    return {
      id: 'nav-header',
      type: 'header',
      className: 'header',
      children: [
        {
          id: 'nav-main',
          type: 'nav',
          className: 'nav-main',
          accessibility: {
            role: 'navigation',
            ariaLabel: 'Main navigation',
          },
          children: [
            {
              id: 'nav-brand',
              type: 'link',
              className: 'nav-brand',
              content: request.name,
              props: { href: '/' },
            },
            {
              id: 'nav-links',
              type: 'list',
              className: 'nav-links',
              props: {
                items: ['Home', 'About', 'Services', 'Contact'],
              },
            },
          ],
        },
      ],
    };
  }

  /**
   * Generate authentication form
   */
  private generateAuthForm(request: DesignRequest): ComponentDefinition {
    const isRegister = request.description?.toLowerCase().includes('register');

    return {
      id: 'auth-section',
      type: 'section',
      className: 'auth-section',
      children: [
        {
          id: 'auth-card',
          type: 'card',
          className: 'auth-card',
          props: {
            title: isRegister ? 'Create Account' : 'Sign In',
            subtitle: isRegister ? 'Join us today' : 'Welcome back',
          },
          children: [
            {
              id: 'auth-form',
              type: 'form',
              className: 'auth-form',
              props: {
                fields: [
                  ...(isRegister
                    ? [{ id: 'name', name: 'name', label: 'Full Name', type: 'text', required: true }]
                    : []),
                  { id: 'email', name: 'email', label: 'Email', type: 'email', required: true },
                  { id: 'password', name: 'password', label: 'Password', type: 'password', required: true },
                  ...(isRegister
                    ? [{ id: 'confirm', name: 'confirmPassword', label: 'Confirm Password', type: 'password', required: true }]
                    : []),
                ],
                submitLabel: isRegister ? 'Create Account' : 'Sign In',
              } as FormDefinition,
            },
          ],
        },
      ],
    };
  }

  /**
   * Generate generic form component
   */
  private generateFormComponent(request: DesignRequest): ComponentDefinition {
    return {
      id: 'form-section',
      type: 'section',
      className: 'form-section',
      children: [
        {
          id: 'form-heading',
          type: 'heading',
          content: request.name,
          props: { level: 2 },
        },
        {
          id: 'main-form',
          type: 'form',
          className: 'main-form',
          props: {
            fields: [
              { id: 'field-1', name: 'field1', label: 'Field 1', type: 'text', required: true },
              { id: 'field-2', name: 'field2', label: 'Field 2', type: 'text' },
              { id: 'field-3', name: 'field3', label: 'Description', type: 'textarea' },
            ],
            submitLabel: 'Submit',
            cancelLabel: 'Cancel',
          } as FormDefinition,
        },
      ],
    };
  }

  /**
   * Generate dashboard component
   */
  private generateDashboard(request: DesignRequest): ComponentDefinition {
    return {
      id: 'dashboard-section',
      type: 'section',
      className: 'dashboard-section',
      children: [
        {
          id: 'dashboard-heading',
          type: 'heading',
          content: 'Dashboard',
          props: { level: 1 },
        },
        {
          id: 'stats-grid',
          type: 'grid',
          className: 'stats-grid',
          props: { cols: 4, gap: 4 },
          children: [
            this.createStatCard('stat-1', 'Total Users', '1,234'),
            this.createStatCard('stat-2', 'Revenue', '$12,345'),
            this.createStatCard('stat-3', 'Orders', '567'),
            this.createStatCard('stat-4', 'Conversion', '5.2%'),
          ],
        },
        {
          id: 'charts-grid',
          type: 'grid',
          className: 'charts-grid',
          props: { cols: 2, gap: 4 },
          children: [
            {
              id: 'chart-1',
              type: 'card',
              className: 'chart-card',
              props: { title: 'Sales Overview' },
              children: [
                {
                  id: 'chart-placeholder-1',
                  type: 'text',
                  content: '[Chart Placeholder]',
                  className: 'chart-placeholder',
                },
              ],
            },
            {
              id: 'chart-2',
              type: 'card',
              className: 'chart-card',
              props: { title: 'User Activity' },
              children: [
                {
                  id: 'chart-placeholder-2',
                  type: 'text',
                  content: '[Chart Placeholder]',
                  className: 'chart-placeholder',
                },
              ],
            },
          ],
        },
      ],
    };
  }

  /**
   * Create a stat card
   */
  private createStatCard(id: string, label: string, value: string): ComponentDefinition {
    return {
      id,
      type: 'card',
      className: 'stat-card',
      children: [
        { id: `${id}-label`, type: 'text', content: label, className: 'stat-label' },
        { id: `${id}-value`, type: 'text', content: value, className: 'stat-value', props: { tag: 'strong' } },
      ],
    };
  }

  /**
   * Generate content grid
   */
  private generateContentGrid(request: DesignRequest): ComponentDefinition {
    return {
      id: 'content-section',
      type: 'section',
      className: 'content-section',
      children: [
        {
          id: 'content-heading',
          type: 'heading',
          content: request.name,
          props: { level: 2 },
        },
        {
          id: 'content-grid',
          type: 'grid',
          className: 'content-grid',
          props: { cols: 3, gap: 4 },
          children: [
            this.createContentCard('card-1', 'Item 1', 'Description for item 1'),
            this.createContentCard('card-2', 'Item 2', 'Description for item 2'),
            this.createContentCard('card-3', 'Item 3', 'Description for item 3'),
          ],
        },
      ],
    };
  }

  /**
   * Create a content card
   */
  private createContentCard(id: string, title: string, description: string): ComponentDefinition {
    return {
      id,
      type: 'card',
      className: 'content-card',
      props: {
        title,
        content: description,
        actions: [{ label: 'View', variant: 'primary' }],
      },
    };
  }

  /**
   * Generate data table component
   */
  private generateDataTable(request: DesignRequest): ComponentDefinition {
    return {
      id: 'table-section',
      type: 'section',
      className: 'table-section',
      children: [
        {
          id: 'table-heading',
          type: 'heading',
          content: request.name,
          props: { level: 2 },
        },
        {
          id: 'data-table',
          type: 'table',
          className: 'data-table',
          props: {
            columns: [
              { id: 'col-1', header: 'Name', accessor: 'name' },
              { id: 'col-2', header: 'Email', accessor: 'email' },
              { id: 'col-3', header: 'Role', accessor: 'role' },
              { id: 'col-4', header: 'Status', accessor: 'status' },
            ],
            data: [
              { name: 'John Doe', email: 'john@example.com', role: 'Admin', status: 'Active' },
              { name: 'Jane Smith', email: 'jane@example.com', role: 'User', status: 'Active' },
              { name: 'Bob Wilson', email: 'bob@example.com', role: 'User', status: 'Inactive' },
            ],
          },
        },
      ],
    };
  }

  /**
   * Generate default page
   */
  private generateDefaultPage(request: DesignRequest): ComponentDefinition {
    return {
      id: 'default-page',
      type: 'main',
      className: 'main-content',
      children: [
        {
          id: 'hero-section',
          type: 'section',
          className: 'hero',
          children: [
            {
              id: 'hero-heading',
              type: 'heading',
              content: request.name,
              props: { level: 1 },
            },
            {
              id: 'hero-text',
              type: 'text',
              content: request.description || 'Welcome to our page',
            },
            {
              id: 'hero-cta',
              type: 'button',
              content: 'Get Started',
              props: { variant: 'primary' },
            },
          ],
        },
      ],
    };
  }

  /**
   * Generate generic component
   */
  private generateGenericComponent(request: DesignRequest): ComponentDefinition {
    return {
      id: 'component-wrapper',
      type: 'section',
      className: 'component-section',
      children: [
        {
          id: 'component-card',
          type: 'card',
          className: 'component-card',
          props: {
            title: request.name,
            content: request.description,
          },
        },
      ],
    };
  }

  /**
   * Generate layout component
   */
  private generateLayoutComponent(request: DesignRequest): ComponentDefinition {
    return {
      id: 'layout-wrapper',
      type: 'flex',
      className: 'layout-wrapper',
      props: { direction: 'row', gap: 4 },
      children: [
        {
          id: 'sidebar',
          type: 'sidebar',
          className: 'sidebar',
          children: [
            {
              id: 'sidebar-nav',
              type: 'nav',
              className: 'sidebar-nav',
              children: [
                {
                  id: 'sidebar-links',
                  type: 'list',
                  props: { items: ['Dashboard', 'Users', 'Settings', 'Reports'] },
                },
              ],
            },
          ],
        },
        {
          id: 'main-area',
          type: 'main',
          className: 'main-area',
          children: [
            {
              id: 'layout-content',
              type: 'heading',
              content: request.name,
              props: { level: 1 },
            },
          ],
        },
      ],
    };
  }

  /**
   * Create page layout
   */
  private createPageLayout(
    request: DesignRequest,
    components: ComponentDefinition[]
  ): PageLayout {
    return {
      id: `layout-${Date.now()}`,
      name: request.name,
      description: request.description,
      components,
      meta: {
        title: request.name,
        description: request.description,
        viewport: 'width=device-width, initial-scale=1.0',
        charset: 'UTF-8',
      },
    };
  }

  /**
   * Generate CSS for components
   */
  private generateCSS(components: ComponentDefinition[]): string {
    let css = '';

    // Add base component styles
    css += this.getBaseStyles();

    // Add utility classes
    css += this.stylesGenerator.generateUtilities();

    // Add grid utilities
    css += this.stylesGenerator.generateGridUtilities();

    return css;
  }

  /**
   * Get base component styles
   */
  private getBaseStyles(): string {
    return `
/* Component Styles */

.container {
  width: 100%;
  max-width: 1280px;
  margin: 0 auto;
  padding: var(--spacing-md);
}

.header {
  background-color: var(--color-surface);
  border-bottom: 1px solid var(--color-border);
  padding: var(--spacing-md);
}

.nav-main {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.nav-brand {
  font-weight: var(--font-weight-bold);
  font-size: var(--font-size-large);
  text-decoration: none;
  color: var(--color-text);
}

.nav-links {
  display: flex;
  gap: var(--spacing-lg);
  list-style: none;
}

.card {
  background-color: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  overflow: hidden;
}

.card-header {
  padding: var(--spacing-md);
  border-bottom: 1px solid var(--color-border);
}

.card-title {
  font-size: var(--font-size-large);
  font-weight: var(--font-weight-bold);
  margin: 0;
}

.card-subtitle {
  color: var(--color-text-muted);
  margin: var(--spacing-xs) 0 0 0;
}

.card-body {
  padding: var(--spacing-md);
}

.card-actions {
  padding: var(--spacing-md);
  border-top: 1px solid var(--color-border);
  display: flex;
  gap: var(--spacing-sm);
}

.card-footer {
  padding: var(--spacing-md);
  background-color: var(--color-background);
  border-top: 1px solid var(--color-border);
}

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: var(--spacing-sm) var(--spacing-md);
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-medium);
  border-radius: var(--radius-sm);
  border: none;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.btn-primary {
  background-color: var(--color-primary);
  color: white;
}

.btn-primary:hover {
  opacity: 0.9;
}

.btn-secondary {
  background-color: var(--color-secondary);
  color: white;
}

.btn-outline {
  background-color: transparent;
  border: 1px solid var(--color-border);
  color: var(--color-text);
}

.form-field {
  margin-bottom: var(--spacing-md);
}

.form-label {
  display: block;
  font-weight: var(--font-weight-medium);
  margin-bottom: var(--spacing-xs);
}

.form-input,
.form-select,
.form-textarea {
  width: 100%;
  padding: var(--spacing-sm);
  font-size: var(--font-size-base);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  transition: border-color var(--transition-fast);
}

.form-input:focus,
.form-select:focus,
.form-textarea:focus {
  outline: none;
  border-color: var(--color-primary);
}

.form-actions {
  display: flex;
  gap: var(--spacing-sm);
  margin-top: var(--spacing-lg);
}

.alert {
  padding: var(--spacing-md);
  border-radius: var(--radius-sm);
  margin-bottom: var(--spacing-md);
}

.alert-info {
  background-color: #e0f2fe;
  color: #0369a1;
}

.alert-success {
  background-color: #dcfce7;
  color: #166534;
}

.alert-warning {
  background-color: #fef3c7;
  color: #92400e;
}

.alert-error {
  background-color: #fee2e2;
  color: #dc2626;
}

.hero {
  padding: var(--spacing-xl) var(--spacing-md);
  text-align: center;
}

.stat-card {
  padding: var(--spacing-md);
}

.stat-label {
  color: var(--color-text-muted);
  font-size: var(--font-size-small);
}

.stat-value {
  font-size: 1.5rem;
  font-weight: var(--font-weight-bold);
}

.sidebar {
  width: 250px;
  background-color: var(--color-surface);
  border-right: 1px solid var(--color-border);
  padding: var(--spacing-md);
}

.main-area {
  flex: 1;
  padding: var(--spacing-md);
}

table {
  width: 100%;
  border-collapse: collapse;
}

th, td {
  padding: var(--spacing-sm) var(--spacing-md);
  text-align: left;
  border-bottom: 1px solid var(--color-border);
}

th {
  background-color: var(--color-surface);
  font-weight: var(--font-weight-medium);
}

.auth-section {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 80vh;
  padding: var(--spacing-md);
}

.auth-card {
  width: 100%;
  max-width: 400px;
}

`;
  }

  /**
   * Check accessibility of components
   */
  private checkAccessibility(
    components: ComponentDefinition[]
  ): UIDesignOutput['accessibility'] {
    const issues: UIDesignOutput['accessibility']['issues'] = [];
    let score = 100;

    // Check components recursively
    const checkComponent = (component: ComponentDefinition): void => {
      // Check for missing alt on images
      if (component.type === 'image') {
        const props = component.props as { alt?: string } | undefined;
        if (!props?.alt) {
          issues.push({
            component: component.id,
            issue: 'Image missing alt text',
            severity: 'error',
            suggestion: 'Add descriptive alt text for the image',
          });
          score -= 10;
        }
      }

      // Check for missing form labels
      if (component.type === 'input') {
        if (!component.accessibility?.ariaLabel && !component.accessibility?.ariaLabelledBy) {
          issues.push({
            component: component.id,
            issue: 'Form input missing accessible label',
            severity: 'error',
            suggestion: 'Add aria-label or aria-labelledby',
          });
          score -= 5;
        }
      }

      // Check for button content
      if (component.type === 'button') {
        if (!component.content && !component.accessibility?.ariaLabel) {
          issues.push({
            component: component.id,
            issue: 'Button missing text content or aria-label',
            severity: 'error',
            suggestion: 'Add button text or aria-label',
          });
          score -= 5;
        }
      }

      // Check for navigation landmark
      if (component.type === 'nav') {
        if (!component.accessibility?.ariaLabel) {
          issues.push({
            component: component.id,
            issue: 'Navigation missing aria-label',
            severity: 'warning',
            suggestion: 'Add aria-label to distinguish navigation regions',
          });
          score -= 3;
        }
      }

      // Check children
      if (component.children) {
        for (const child of component.children) {
          checkComponent(child);
        }
      }
    };

    for (const component of components) {
      checkComponent(component);
    }

    return {
      score: Math.max(0, score),
      issues,
    };
  }

  /**
   * Determine next agent based on design output
   */
  private determineNextAgent(
    output: UIDesignOutput,
    context: ExecutionContext
  ): AgentType {
    // If accessibility issues, might need review
    if (output.accessibility.score < 70) {
      return 'architect';
    }

    // If frontend developer is available, route there
    if (context.projectConfig.features.parallelAgents) {
      return 'frontend-developer';
    }

    // Default to architect for implementation planning
    return 'architect';
  }

  /**
   * Check if agent can handle task
   */
  canHandle(taskType: string, _context: ExecutionContext): boolean {
    return [
      'ui-design',
      'mockup-generation',
      'component-design',
      'page-layout',
      'form-design',
    ].includes(taskType);
  }

  /**
   * Get capabilities
   */
  getCapabilities(): string[] {
    return this.metadata.capabilities;
  }
}

/**
 * Factory function for UI designer agent
 */
export function createUIDesignerAgent(config?: UIDesignerConfig): UIDesignerAgent {
  return new UIDesignerAgent(config);
}
