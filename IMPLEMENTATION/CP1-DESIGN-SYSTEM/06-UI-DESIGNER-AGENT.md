# Step 06: UI Designer Agent

> **Checkpoint:** CP1 - Design System
> **Previous Step:** 05-AGENT-FRAMEWORK.md
> **Next Step:** 07-DESIGN-TOKENS.md

---

## Overview

The UI Designer Agent generates HTML mockups based on feature requirements. It produces responsive, accessible designs that can be previewed in a browser before implementation begins.

Key responsibilities:
- Parse feature requirements into UI components
- Generate HTML mockups with inline styles
- Include accessibility attributes (ARIA)
- Create responsive layouts
- Output structured component hierarchy for developers

---

## Deliverables

1. `src/agents/agents/ui-designer.ts` - UI Designer agent implementation
2. `src/agents/schemas/ui-designer-output.ts` - Output schema definition
3. `templates/mockup-base.html` - Base HTML template for mockups

---

## 1. Output Schema (`src/agents/schemas/ui-designer-output.ts`)

```typescript
/**
 * UI Designer Output Schema
 *
 * Defines the structured output format for the UI Designer agent.
 */

import { z } from 'zod';

/**
 * Component types supported by UI Designer
 */
export const ComponentTypeSchema = z.enum([
  'page',
  'section',
  'header',
  'footer',
  'navigation',
  'form',
  'input',
  'button',
  'card',
  'list',
  'table',
  'modal',
  'alert',
  'tabs',
  'accordion',
  'image',
  'text',
  'link',
  'icon',
  'container',
  'grid',
  'flex',
]);

export type ComponentType = z.infer<typeof ComponentTypeSchema>;

/**
 * Accessibility attributes
 */
export const AccessibilitySchema = z.object({
  role: z.string().optional(),
  ariaLabel: z.string().optional(),
  ariaDescribedBy: z.string().optional(),
  ariaLabelledBy: z.string().optional(),
  ariaExpanded: z.boolean().optional(),
  ariaHidden: z.boolean().optional(),
  tabIndex: z.number().optional(),
});

export type Accessibility = z.infer<typeof AccessibilitySchema>;

/**
 * Responsive breakpoints
 */
export const BreakpointSchema = z.enum(['mobile', 'tablet', 'desktop', 'wide']);
export type Breakpoint = z.infer<typeof BreakpointSchema>;

/**
 * Style declaration
 */
export const StyleSchema = z.record(z.string(), z.string());
export type Style = z.infer<typeof StyleSchema>;

/**
 * Responsive styles
 */
export const ResponsiveStylesSchema = z.object({
  base: StyleSchema,
  mobile: StyleSchema.optional(),
  tablet: StyleSchema.optional(),
  desktop: StyleSchema.optional(),
  wide: StyleSchema.optional(),
});

export type ResponsiveStyles = z.infer<typeof ResponsiveStylesSchema>;

/**
 * UI Component definition
 */
export const ComponentSchema: z.ZodType<Component> = z.lazy(() =>
  z.object({
    id: z.string(),
    type: ComponentTypeSchema,
    name: z.string(),
    description: z.string().optional(),
    content: z.string().optional(),
    attributes: z.record(z.string(), z.string()).optional(),
    styles: ResponsiveStylesSchema,
    accessibility: AccessibilitySchema.optional(),
    children: z.array(ComponentSchema).optional(),
    variants: z.array(z.object({
      name: z.string(),
      condition: z.string(),
      styles: StyleSchema,
    })).optional(),
  })
);

export interface Component {
  id: string;
  type: ComponentType;
  name: string;
  description?: string;
  content?: string;
  attributes?: Record<string, string>;
  styles: ResponsiveStyles;
  accessibility?: Accessibility;
  children?: Component[];
  variants?: Array<{
    name: string;
    condition: string;
    styles: Style;
  }>;
}

/**
 * Page layout definition
 */
export const PageLayoutSchema = z.object({
  type: z.enum(['single-column', 'two-column', 'three-column', 'dashboard', 'landing', 'form', 'custom']),
  regions: z.array(z.object({
    name: z.string(),
    area: z.string(), // CSS grid area
    components: z.array(z.string()), // Component IDs
  })),
  gridTemplate: z.string().optional(),
});

export type PageLayout = z.infer<typeof PageLayoutSchema>;

/**
 * Mockup page definition
 */
export const MockupPageSchema = z.object({
  id: z.string(),
  name: z.string(),
  title: z.string(),
  description: z.string(),
  path: z.string(), // e.g., "/login", "/dashboard"
  layout: PageLayoutSchema,
  components: z.array(ComponentSchema),
  meta: z.object({
    viewport: z.string().default('width=device-width, initial-scale=1'),
    theme: z.enum(['light', 'dark', 'auto']).default('auto'),
  }).optional(),
});

export type MockupPage = z.infer<typeof MockupPageSchema>;

/**
 * Complete UI Designer output
 */
export const UIDesignerOutputSchema = z.object({
  projectName: z.string(),
  version: z.string(),
  generatedAt: z.string(),
  pages: z.array(MockupPageSchema),
  sharedComponents: z.array(ComponentSchema),
  colorPalette: z.object({
    primary: z.string(),
    secondary: z.string(),
    accent: z.string(),
    background: z.string(),
    surface: z.string(),
    text: z.string(),
    textSecondary: z.string(),
    error: z.string(),
    warning: z.string(),
    success: z.string(),
    info: z.string(),
  }),
  typography: z.object({
    fontFamily: z.string(),
    headingFamily: z.string().optional(),
    baseFontSize: z.string(),
    scaleRatio: z.number(),
  }),
  spacing: z.object({
    unit: z.number(), // Base spacing unit in px
    scale: z.array(z.number()), // Multipliers
  }),
  notes: z.array(z.string()).optional(),
});

export type UIDesignerOutput = z.infer<typeof UIDesignerOutputSchema>;
```

---

## 2. UI Designer Agent (`src/agents/agents/ui-designer.ts`)

```typescript
/**
 * UI Designer Agent
 *
 * Generates HTML mockups based on feature requirements.
 * Produces responsive, accessible designs with structured component hierarchy.
 */

import { BaseAgent, DEFAULT_CONSTRAINTS } from '../base-agent';
import { RegisterAgent, getRegistry } from '../registry';
import {
  AgentMetadata,
  AgentContext,
  AgentRequest,
  AgentOutput,
  Artifact,
  RoutingHints,
  AgentType,
  ContextType,
} from '../types';
import {
  UIDesignerOutput,
  UIDesignerOutputSchema,
  MockupPage,
  Component,
} from '../schemas/ui-designer-output';
import { logger } from '../../utils/logger';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs';

/**
 * Agent metadata
 */
const UI_DESIGNER_METADATA: AgentMetadata = {
  id: AgentType.UI_DESIGNER,
  name: 'UI Designer',
  description: 'Generates HTML mockups from feature requirements',
  version: '1.0.0',
  capabilities: [
    {
      name: 'mockup_generation',
      description: 'Generate HTML mockups from requirements',
      inputTypes: ['requirements', 'user_story', 'feature_spec'],
      outputTypes: ['html', 'component_tree', 'design_spec'],
    },
    {
      name: 'responsive_design',
      description: 'Create responsive layouts for multiple screen sizes',
      inputTypes: ['mockup'],
      outputTypes: ['responsive_mockup'],
    },
    {
      name: 'accessibility',
      description: 'Add accessibility attributes to components',
      inputTypes: ['component'],
      outputTypes: ['accessible_component'],
    },
  ],
  requiredContext: [
    { type: 'current_task', required: true },
    { type: 'project_config', required: false },
    { type: 'design_tokens', required: false },
  ],
  outputSchema: 'ui-designer-output',
};

/**
 * UI Designer Agent implementation
 */
@RegisterAgent
export class UIDesignerAgent extends BaseAgent {
  constructor() {
    super(UI_DESIGNER_METADATA);
  }

  /**
   * Build system prompt for UI design
   */
  protected buildSystemPrompt(context: AgentContext): string {
    const designTokens = context.items.find(i => i.type === 'design_tokens');
    const projectConfig = context.items.find(i => i.type === 'project_config');

    let prompt = `You are an expert UI/UX designer and frontend architect.
Your task is to generate HTML mockups based on feature requirements.

## Your Responsibilities:
1. Analyze the feature requirements thoroughly
2. Design a component hierarchy that is reusable and maintainable
3. Create responsive layouts that work on mobile, tablet, and desktop
4. Include proper accessibility attributes (ARIA roles, labels)
5. Use semantic HTML elements
6. Apply consistent styling patterns

## Output Format:
You must output valid JSON matching this schema:
- projectName: Name of the project
- version: "1.0.0"
- generatedAt: ISO timestamp
- pages: Array of page definitions with:
  - id: Unique identifier
  - name: Human-readable name
  - title: Page title
  - description: What the page does
  - path: URL path
  - layout: Layout configuration
  - components: Array of UI components
- sharedComponents: Reusable components across pages
- colorPalette: Color scheme
- typography: Font settings
- spacing: Spacing scale

## Component Structure:
Each component must have:
- id: Unique identifier (use descriptive names like "login-form", "nav-header")
- type: One of: page, section, header, footer, navigation, form, input, button, card, list, table, modal, alert, tabs, accordion, image, text, link, icon, container, grid, flex
- name: Human-readable name
- styles: Responsive styles with base, mobile, tablet, desktop variants
- accessibility: ARIA attributes as needed
- children: Nested components (if any)

## Design Principles:
1. Mobile-first responsive design
2. Minimum touch target size of 44x44px
3. Sufficient color contrast (WCAG AA)
4. Clear visual hierarchy
5. Consistent spacing using 8px grid
6. Semantic HTML structure
`;

    if (designTokens) {
      prompt += `\n## Existing Design Tokens:\n${JSON.stringify(designTokens.content, null, 2)}\nUse these tokens for consistency.\n`;
    }

    if (projectConfig) {
      prompt += `\n## Project Configuration:\n${JSON.stringify(projectConfig.content, null, 2)}\n`;
    }

    return prompt;
  }

  /**
   * Build user prompt with requirements
   */
  protected buildUserPrompt(request: AgentRequest): string {
    const task = request.context.task;
    const previousOutputs = request.context.previousOutputs;

    let prompt = `## Feature Requirements:\n`;
    prompt += `Task Type: ${task.taskType}\n`;
    prompt += `Complexity: ${task.complexity}\n`;
    prompt += `Requires Backend: ${task.requiresBackend}\n\n`;

    // Include original prompt if available
    const taskContext = request.context.items.find(i => i.type === 'current_task');
    if (taskContext && typeof taskContext.content === 'object') {
      prompt += `## Original Request:\n${JSON.stringify(taskContext.content, null, 2)}\n\n`;
    }

    // Include planner output if available
    const plannerOutput = previousOutputs.find(o => o.agentId === AgentType.PLANNER);
    if (plannerOutput) {
      prompt += `## Implementation Plan:\n${JSON.stringify(plannerOutput.result, null, 2)}\n\n`;
    }

    // Include architect output if available
    const architectOutput = previousOutputs.find(o => o.agentId === AgentType.ARCHITECT);
    if (architectOutput) {
      prompt += `## Architecture:\n${JSON.stringify(architectOutput.result, null, 2)}\n\n`;
    }

    prompt += `\nGenerate a complete UI design with mockups for this feature. Output valid JSON only.`;

    return prompt;
  }

  /**
   * Parse LLM response into structured output
   */
  protected parseResponse(response: any): UIDesignerOutput {
    const text = this.extractTextContent(response);
    const parsed = this.parseJSON<UIDesignerOutput>(text);

    // Validate against schema
    const result = UIDesignerOutputSchema.safeParse(parsed);
    if (!result.success) {
      this.log('warn', 'Output validation failed', { errors: result.error.errors });
      throw new Error(`Invalid output format: ${result.error.message}`);
    }

    return result.data;
  }

  /**
   * Process result and generate artifacts
   */
  protected async processResult(
    parsed: UIDesignerOutput,
    request: AgentRequest
  ): Promise<{ result: UIDesignerOutput; artifacts: Artifact[] }> {
    const artifacts: Artifact[] = [];
    const outputDir = path.join(request.context.projectId, 'designs', 'mockups');

    // Generate HTML for each page
    for (const page of parsed.pages) {
      const html = this.generateHTML(page, parsed);
      const fileName = `${this.slugify(page.name)}.html`;
      const filePath = path.join(outputDir, fileName);

      artifacts.push({
        id: this.generateArtifactId(),
        type: 'mockup',
        path: filePath,
        content: html,
        metadata: {
          pageId: page.id,
          pageName: page.name,
          componentCount: this.countComponents(page.components),
        },
      });
    }

    // Generate component library documentation
    if (parsed.sharedComponents.length > 0) {
      const componentDoc = this.generateComponentDoc(parsed.sharedComponents);
      artifacts.push({
        id: this.generateArtifactId(),
        type: 'documentation',
        path: path.join(outputDir, 'components.md'),
        content: componentDoc,
        metadata: {
          componentCount: parsed.sharedComponents.length,
        },
      });
    }

    // Generate design spec JSON
    artifacts.push({
      id: this.generateArtifactId(),
      type: 'config_file',
      path: path.join(outputDir, 'design-spec.json'),
      content: JSON.stringify(parsed, null, 2),
      metadata: {
        pageCount: parsed.pages.length,
        componentCount: parsed.sharedComponents.length,
      },
    });

    return { result: parsed, artifacts };
  }

  /**
   * Generate routing hints for orchestrator
   */
  protected generateRoutingHints(
    result: UIDesignerOutput,
    artifacts: Artifact[],
    request: AgentRequest
  ): RoutingHints {
    const hasPages = result.pages.length > 0;
    const hasComponents = result.sharedComponents.length > 0;

    return {
      suggestNext: [AgentType.FRONTEND_DEV],
      skipAgents: [],
      needsApproval: true, // Designs should be reviewed
      hasFailures: !hasPages,
      isComplete: false,
      notes: hasPages
        ? `Generated ${result.pages.length} page(s) with ${result.sharedComponents.length} shared component(s)`
        : 'No pages generated - design may need revision',
    };
  }

  /**
   * Generate HTML from page definition
   */
  private generateHTML(page: MockupPage, design: UIDesignerOutput): string {
    const { colorPalette, typography, spacing } = design;

    // Generate CSS variables from design tokens
    const cssVars = this.generateCSSVariables(colorPalette, typography, spacing);

    // Generate component HTML
    const componentsHtml = page.components
      .map(comp => this.renderComponent(comp))
      .join('\n');

    // Use base template
    return `<!DOCTYPE html>
<html lang="en" data-theme="${page.meta?.theme || 'auto'}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="${page.meta?.viewport || 'width=device-width, initial-scale=1'}">
  <title>${page.title}</title>
  <style>
    :root {
${cssVars}
    }

    /* Base reset */
    *, *::before, *::after {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      font-family: var(--font-family);
      font-size: var(--font-size-base);
      line-height: 1.5;
      color: var(--color-text);
      background-color: var(--color-background);
    }

    /* Responsive grid */
    .layout-grid {
      display: grid;
      gap: var(--spacing-4);
      padding: var(--spacing-4);
    }

    /* Focus styles for accessibility */
    :focus-visible {
      outline: 2px solid var(--color-primary);
      outline-offset: 2px;
    }

    /* Skip link for accessibility */
    .skip-link {
      position: absolute;
      top: -40px;
      left: 0;
      background: var(--color-primary);
      color: white;
      padding: 8px;
      z-index: 100;
    }

    .skip-link:focus {
      top: 0;
    }

    /* Responsive breakpoints */
    @media (max-width: 640px) {
      .hide-mobile { display: none !important; }
    }

    @media (min-width: 641px) and (max-width: 1024px) {
      .hide-tablet { display: none !important; }
    }

    @media (min-width: 1025px) {
      .hide-desktop { display: none !important; }
    }
  </style>
</head>
<body>
  <a href="#main" class="skip-link">Skip to main content</a>

  <main id="main">
    ${componentsHtml}
  </main>

  <!-- Generated by Aigentflow UI Designer -->
  <!-- Page: ${page.name} (${page.id}) -->
  <!-- Path: ${page.path} -->
</body>
</html>`;
  }

  /**
   * Render a component to HTML
   */
  private renderComponent(component: Component, depth: number = 0): string {
    const indent = '  '.repeat(depth);
    const tag = this.getHtmlTag(component.type);
    const styles = this.styleObjectToString(component.styles.base);
    const attrs = this.renderAttributes(component);
    const a11y = this.renderAccessibility(component.accessibility);

    // Self-closing tags
    if (['input', 'img'].includes(tag)) {
      return `${indent}<${tag} id="${component.id}" style="${styles}"${attrs}${a11y} />`;
    }

    // Tags with children or content
    const children = component.children
      ? component.children.map(c => this.renderComponent(c, depth + 1)).join('\n')
      : '';

    const content = component.content || '';

    if (children) {
      return `${indent}<${tag} id="${component.id}" style="${styles}"${attrs}${a11y}>
${children}
${indent}</${tag}>`;
    }

    return `${indent}<${tag} id="${component.id}" style="${styles}"${attrs}${a11y}>${content}</${tag}>`;
  }

  /**
   * Map component type to HTML tag
   */
  private getHtmlTag(type: string): string {
    const tagMap: Record<string, string> = {
      page: 'div',
      section: 'section',
      header: 'header',
      footer: 'footer',
      navigation: 'nav',
      form: 'form',
      input: 'input',
      button: 'button',
      card: 'article',
      list: 'ul',
      table: 'table',
      modal: 'dialog',
      alert: 'div',
      tabs: 'div',
      accordion: 'div',
      image: 'img',
      text: 'p',
      link: 'a',
      icon: 'span',
      container: 'div',
      grid: 'div',
      flex: 'div',
    };

    return tagMap[type] || 'div';
  }

  /**
   * Convert style object to inline style string
   */
  private styleObjectToString(styles: Record<string, string>): string {
    return Object.entries(styles)
      .map(([key, value]) => `${this.camelToKebab(key)}: ${value}`)
      .join('; ');
  }

  /**
   * Render component attributes
   */
  private renderAttributes(component: Component): string {
    if (!component.attributes) return '';

    return Object.entries(component.attributes)
      .map(([key, value]) => ` ${key}="${value}"`)
      .join('');
  }

  /**
   * Render accessibility attributes
   */
  private renderAccessibility(a11y?: Component['accessibility']): string {
    if (!a11y) return '';

    const attrs: string[] = [];

    if (a11y.role) attrs.push(`role="${a11y.role}"`);
    if (a11y.ariaLabel) attrs.push(`aria-label="${a11y.ariaLabel}"`);
    if (a11y.ariaDescribedBy) attrs.push(`aria-describedby="${a11y.ariaDescribedBy}"`);
    if (a11y.ariaLabelledBy) attrs.push(`aria-labelledby="${a11y.ariaLabelledBy}"`);
    if (a11y.ariaExpanded !== undefined) attrs.push(`aria-expanded="${a11y.ariaExpanded}"`);
    if (a11y.ariaHidden !== undefined) attrs.push(`aria-hidden="${a11y.ariaHidden}"`);
    if (a11y.tabIndex !== undefined) attrs.push(`tabindex="${a11y.tabIndex}"`);

    return attrs.length > 0 ? ' ' + attrs.join(' ') : '';
  }

  /**
   * Generate CSS variables from design tokens
   */
  private generateCSSVariables(
    colors: UIDesignerOutput['colorPalette'],
    typography: UIDesignerOutput['typography'],
    spacing: UIDesignerOutput['spacing']
  ): string {
    const lines: string[] = [];

    // Colors
    for (const [name, value] of Object.entries(colors)) {
      lines.push(`      --color-${this.camelToKebab(name)}: ${value};`);
    }

    // Typography
    lines.push(`      --font-family: ${typography.fontFamily};`);
    if (typography.headingFamily) {
      lines.push(`      --font-heading: ${typography.headingFamily};`);
    }
    lines.push(`      --font-size-base: ${typography.baseFontSize};`);

    // Generate font size scale
    const baseSize = parseFloat(typography.baseFontSize);
    const ratio = typography.scaleRatio;
    for (let i = -2; i <= 6; i++) {
      const size = baseSize * Math.pow(ratio, i);
      lines.push(`      --font-size-${i + 3}: ${size.toFixed(2)}rem;`);
    }

    // Spacing scale
    for (let i = 0; i < spacing.scale.length; i++) {
      const value = spacing.unit * spacing.scale[i];
      lines.push(`      --spacing-${i}: ${value}px;`);
    }

    return lines.join('\n');
  }

  /**
   * Generate component library documentation
   */
  private generateComponentDoc(components: Component[]): string {
    let doc = '# Component Library\n\n';
    doc += `Generated: ${new Date().toISOString()}\n\n`;

    for (const comp of components) {
      doc += `## ${comp.name}\n\n`;
      doc += `**Type:** ${comp.type}\n`;
      doc += `**ID:** \`${comp.id}\`\n\n`;

      if (comp.description) {
        doc += `${comp.description}\n\n`;
      }

      if (comp.accessibility) {
        doc += '### Accessibility\n\n';
        doc += '| Attribute | Value |\n';
        doc += '|-----------|-------|\n';
        for (const [key, value] of Object.entries(comp.accessibility)) {
          if (value !== undefined) {
            doc += `| ${key} | ${value} |\n`;
          }
        }
        doc += '\n';
      }

      if (comp.variants && comp.variants.length > 0) {
        doc += '### Variants\n\n';
        for (const variant of comp.variants) {
          doc += `- **${variant.name}**: ${variant.condition}\n`;
        }
        doc += '\n';
      }

      doc += '---\n\n';
    }

    return doc;
  }

  /**
   * Count total components in a tree
   */
  private countComponents(components: Component[]): number {
    let count = components.length;
    for (const comp of components) {
      if (comp.children) {
        count += this.countComponents(comp.children);
      }
    }
    return count;
  }

  /**
   * Convert string to URL-friendly slug
   */
  private slugify(str: string): string {
    return str
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  }

  /**
   * Convert camelCase to kebab-case
   */
  private camelToKebab(str: string): string {
    return str.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
  }
}
```

---

## 3. Competitive Design Generation

The UI Designer agent supports **competitive design generation** mode where multiple designers (up to 15) create independent mockups for the same requirement. The user then selects the winning design to proceed with.

### Competitive Design Types (`src/agents/schemas/competitive-design.ts`)

```typescript
/**
 * Competitive Design Generation Types
 *
 * When spawning competitive designs, each designer receives a variant
 * number and creates an independent interpretation of the requirements.
 */

import { z } from 'zod';
import { UIDesignerOutputSchema } from './ui-designer-output';

/**
 * Design variant metadata
 */
export const DesignVariantSchema = z.object({
  variantId: z.string(),
  variantNumber: z.number(),
  totalVariants: z.number(),
  designStyle: z.enum([
    'minimal',
    'modern',
    'classic',
    'bold',
    'playful',
    'corporate',
    'elegant',
    'tech',
    'organic',
    'geometric',
  ]),
  designFocus: z.enum([
    'usability',
    'aesthetics',
    'accessibility',
    'performance',
    'innovation',
  ]),
  colorScheme: z.enum([
    'vibrant',
    'muted',
    'monochrome',
    'complementary',
    'analogous',
    'triadic',
  ]),
});

export type DesignVariant = z.infer<typeof DesignVariantSchema>;

/**
 * Competitive design output
 */
export const CompetitiveDesignOutputSchema = UIDesignerOutputSchema.extend({
  competitionMetadata: z.object({
    variant: DesignVariantSchema,
    designRationale: z.string(),
    keyFeatures: z.array(z.string()),
    tradeoffs: z.array(z.object({
      aspect: z.string(),
      choice: z.string(),
      rationale: z.string(),
    })),
  }),
});

export type CompetitiveDesignOutput = z.infer<typeof CompetitiveDesignOutputSchema>;

/**
 * Design competition results
 */
export const DesignCompetitionResultSchema = z.object({
  competitionId: z.string(),
  requirement: z.string(),
  startedAt: z.string(),
  completedAt: z.string(),
  submissions: z.array(z.object({
    variantId: z.string(),
    agentId: z.string(),
    design: CompetitiveDesignOutputSchema,
    score: z.number().optional(),
    selected: z.boolean(),
  })),
  winner: z.object({
    variantId: z.string(),
    reason: z.string(),
  }).optional(),
});

export type DesignCompetitionResult = z.infer<typeof DesignCompetitionResultSchema>;
```

### Competitive Design Manager (`src/agents/competitive-design-manager.ts`)

```typescript
/**
 * Competitive Design Manager
 *
 * Orchestrates competitive design generation where up to 15 UI designers
 * create independent mockups for the same requirement. User selects the
 * best design to proceed with implementation.
 *
 * Key behaviors:
 * • Spawns up to 15 designers in parallel (using Agent Pool)
 * • Each designer gets a different style/focus assignment
 * • Outputs are collected and presented for user selection
 * • Winning design becomes the implementation blueprint
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { UIDesignerAgent } from './agents/ui-designer';
import {
  DesignVariant,
  CompetitiveDesignOutput,
  DesignCompetitionResult,
} from './schemas/competitive-design';
import {
  AgentPoolManager,
  AgentPhase,
  MAX_CONCURRENT_AGENTS,
} from '../core/states';
import { AgentType, AgentContext, TaskAnalysis } from './types';
import { logger } from '../utils/logger';

/**
 * Design styles for variety in competitive designs
 */
const DESIGN_STYLES = [
  'minimal', 'modern', 'classic', 'bold', 'playful',
  'corporate', 'elegant', 'tech', 'organic', 'geometric',
] as const;

/**
 * Design focus areas for variety
 */
const DESIGN_FOCUSES = [
  'usability', 'aesthetics', 'accessibility', 'performance', 'innovation',
] as const;

/**
 * Color schemes for variety
 */
const COLOR_SCHEMES = [
  'vibrant', 'muted', 'monochrome', 'complementary', 'analogous', 'triadic',
] as const;

export interface CompetitiveDesignOptions {
  maxDesigners?: number;           // Default: 15 (max pool capacity)
  poolManager?: AgentPoolManager;
  timeoutMs?: number;              // Default: 5 minutes per designer
  requireMinimumSubmissions?: number;  // Minimum designs before selection
}

/**
 * Competitive Design Manager class
 */
export class CompetitiveDesignManager extends EventEmitter {
  private poolManager: AgentPoolManager;
  private options: Required<CompetitiveDesignOptions>;
  private activeCompetitions: Map<string, DesignCompetitionResult> = new Map();

  constructor(options: CompetitiveDesignOptions = {}) {
    super();
    this.options = {
      maxDesigners: MAX_CONCURRENT_AGENTS,
      poolManager: options.poolManager || new AgentPoolManager(),
      timeoutMs: 5 * 60 * 1000,
      requireMinimumSubmissions: 3,
      ...options,
    };
    this.poolManager = this.options.poolManager;
  }

  /**
   * Run a competitive design competition
   * Spawns up to 15 designers to create independent mockups
   */
  async runCompetition(
    requirement: string,
    task: TaskAnalysis,
    context: AgentContext
  ): Promise<DesignCompetitionResult> {
    const competitionId = uuidv4();
    const startedAt = new Date().toISOString();

    logger.info('Starting design competition', {
      competitionId,
      requirement: requirement.substring(0, 100),
      maxDesigners: this.options.maxDesigners,
    });

    // Initialize competition result
    const competition: DesignCompetitionResult = {
      competitionId,
      requirement,
      startedAt,
      completedAt: '',
      submissions: [],
    };
    this.activeCompetitions.set(competitionId, competition);

    // Generate variant assignments for each designer
    const variants = this.generateVariantAssignments(this.options.maxDesigners);

    // Spawn competitive designers
    const { agentIds, expectedOutputs } = await this.poolManager.spawnCompetitiveDesign(
      requirement,
      {
        competitionId,
        task,
        context,
      }
    );

    logger.info('Designers spawned', {
      competitionId,
      spawnedCount: agentIds.length,
      expectedOutputs,
    });

    this.emit('competition_started', {
      competitionId,
      designerCount: agentIds.length,
    });

    // Execute all designers in parallel and collect results
    const designPromises = agentIds.map((agentId, index) =>
      this.executeDesigner(
        agentId,
        variants[index],
        requirement,
        task,
        context,
        competitionId
      )
    );

    // Wait for all designers with timeout handling
    const results = await Promise.allSettled(designPromises);

    // Process results
    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      const variant = variants[i];

      if (result.status === 'fulfilled' && result.value) {
        competition.submissions.push({
          variantId: variant.variantId,
          agentId: agentIds[i],
          design: result.value,
          selected: false,
        });

        this.emit('design_submitted', {
          competitionId,
          variantId: variant.variantId,
          designStyle: variant.designStyle,
        });
      } else {
        logger.warn('Designer failed', {
          competitionId,
          variantId: variant.variantId,
          error: result.status === 'rejected' ? result.reason : 'Unknown',
        });
      }
    }

    competition.completedAt = new Date().toISOString();

    logger.info('Design competition completed', {
      competitionId,
      totalSubmissions: competition.submissions.length,
      successRate: `${competition.submissions.length}/${agentIds.length}`,
    });

    this.emit('competition_completed', {
      competitionId,
      submissions: competition.submissions.length,
    });

    return competition;
  }

  /**
   * Execute a single designer with variant assignment
   */
  private async executeDesigner(
    agentId: string,
    variant: DesignVariant,
    requirement: string,
    task: TaskAnalysis,
    context: AgentContext,
    competitionId: string
  ): Promise<CompetitiveDesignOutput | null> {
    const designer = new UIDesignerAgent();

    // Build variant-specific context
    const variantContext: AgentContext = {
      ...context,
      items: [
        ...context.items,
        {
          type: 'competition_variant' as any,
          content: {
            ...variant,
            competitionId,
            instruction: this.buildVariantInstruction(variant),
          },
        },
      ],
    };

    try {
      const output = await designer.execute({
        executionId: agentId,
        task,
        context: variantContext,
      });

      if (output.success && output.result) {
        return {
          ...output.result as any,
          competitionMetadata: {
            variant,
            designRationale: `Design created with ${variant.designStyle} style, focusing on ${variant.designFocus}`,
            keyFeatures: [],
            tradeoffs: [],
          },
        };
      }

      return null;
    } catch (error) {
      logger.error('Designer execution failed', {
        agentId,
        variantId: variant.variantId,
        error,
      });
      return null;
    }
  }

  /**
   * Generate unique variant assignments for each designer
   */
  private generateVariantAssignments(count: number): DesignVariant[] {
    const variants: DesignVariant[] = [];

    for (let i = 0; i < count; i++) {
      variants.push({
        variantId: uuidv4(),
        variantNumber: i + 1,
        totalVariants: count,
        designStyle: DESIGN_STYLES[i % DESIGN_STYLES.length],
        designFocus: DESIGN_FOCUSES[i % DESIGN_FOCUSES.length],
        colorScheme: COLOR_SCHEMES[i % COLOR_SCHEMES.length],
      });
    }

    return variants;
  }

  /**
   * Build instruction for a specific variant
   */
  private buildVariantInstruction(variant: DesignVariant): string {
    return `
You are Designer #${variant.variantNumber} of ${variant.totalVariants} in a competitive design challenge.

Your assigned style: ${variant.designStyle.toUpperCase()}
Your assigned focus: ${variant.designFocus.toUpperCase()}
Your color scheme: ${variant.colorScheme.toUpperCase()}

Design Guidance:
${this.getStyleGuidance(variant.designStyle)}
${this.getFocusGuidance(variant.designFocus)}
${this.getColorGuidance(variant.colorScheme)}

Remember: Create a UNIQUE design that stands out from other competitors while fulfilling the requirements.
`;
  }

  /**
   * Get style-specific guidance
   */
  private getStyleGuidance(style: string): string {
    const guidance: Record<string, string> = {
      minimal: '• Use plenty of whitespace\n• Limit color palette to 2-3 colors\n• Focus on essential elements only',
      modern: '• Use contemporary UI patterns\n• Include subtle animations/transitions\n• Clean lines and flat design',
      classic: '• Traditional layout patterns\n• Established typography\n• Familiar UI conventions',
      bold: '• Strong visual hierarchy\n• Large typography\n• High contrast elements',
      playful: '• Creative layouts\n• Fun color combinations\n• Engaging micro-interactions',
      corporate: '• Professional appearance\n• Trust-inspiring design\n• Clear information hierarchy',
      elegant: '• Refined aesthetics\n• Sophisticated color palette\n• Premium feel',
      tech: '• Modern tech aesthetic\n• Data-driven visuals\n• Technical precision',
      organic: '• Natural shapes and curves\n• Soft colors\n• Flowing layouts',
      geometric: '• Strong geometric shapes\n• Grid-based layouts\n• Mathematical precision',
    };
    return guidance[style] || '';
  }

  /**
   * Get focus-specific guidance
   */
  private getFocusGuidance(focus: string): string {
    const guidance: Record<string, string> = {
      usability: '• Prioritize ease of use\n• Clear call-to-actions\n• Intuitive navigation',
      aesthetics: '• Visual appeal is paramount\n• Beautiful component styling\n• Cohesive visual language',
      accessibility: '• WCAG AAA compliance\n• Screen reader optimization\n• Keyboard navigation',
      performance: '• Minimal DOM elements\n• Efficient layout structure\n• Fast perceived loading',
      innovation: '• Novel UI patterns\n• Creative interactions\n• Pushing boundaries',
    };
    return guidance[focus] || '';
  }

  /**
   * Get color scheme guidance
   */
  private getColorGuidance(scheme: string): string {
    const guidance: Record<string, string> = {
      vibrant: 'Use bright, energetic colors that grab attention',
      muted: 'Use soft, subdued colors that are easy on the eyes',
      monochrome: 'Use variations of a single color for a cohesive look',
      complementary: 'Use colors opposite on the color wheel for contrast',
      analogous: 'Use colors adjacent on the color wheel for harmony',
      triadic: 'Use three evenly spaced colors for balanced variety',
    };
    return guidance[scheme] || '';
  }

  /**
   * Select a winning design
   */
  async selectWinner(
    competitionId: string,
    variantId: string,
    reason: string
  ): Promise<CompetitiveDesignOutput> {
    const competition = this.activeCompetitions.get(competitionId);

    if (!competition) {
      throw new Error(`Competition not found: ${competitionId}`);
    }

    const submission = competition.submissions.find(s => s.variantId === variantId);

    if (!submission) {
      throw new Error(`Variant not found: ${variantId}`);
    }

    // Mark as selected
    submission.selected = true;
    competition.winner = { variantId, reason };

    // Update all other submissions
    for (const s of competition.submissions) {
      if (s.variantId !== variantId) {
        s.selected = false;
      }
    }

    this.emit('winner_selected', {
      competitionId,
      variantId,
      reason,
    });

    logger.info('Design winner selected', {
      competitionId,
      variantId,
      reason,
    });

    return submission.design;
  }

  /**
   * Get competition status
   */
  getCompetition(competitionId: string): DesignCompetitionResult | undefined {
    return this.activeCompetitions.get(competitionId);
  }

  /**
   * List all submissions for a competition
   */
  getSubmissions(competitionId: string): CompetitiveDesignOutput[] {
    const competition = this.activeCompetitions.get(competitionId);
    if (!competition) return [];
    return competition.submissions.map(s => s.design);
  }
}
```

### Usage Example

```typescript
import { CompetitiveDesignManager } from './agents/competitive-design-manager';
import { AgentPoolManager } from '../core/states';

// Initialize with pool manager (max 15 concurrent agents)
const poolManager = new AgentPoolManager({ maxConcurrent: 15 });
const designManager = new CompetitiveDesignManager({
  maxDesigners: 15,  // Spawn all 15 designers for maximum variety
  poolManager,
});

// Track progress
designManager.on('competition_started', ({ competitionId, designerCount }) => {
  console.log(`Design competition started: ${competitionId} with ${designerCount} designers`);
});

designManager.on('design_submitted', ({ variantId, designStyle }) => {
  console.log(`Design submitted: ${variantId} (${designStyle} style)`);
});

designManager.on('competition_completed', ({ competitionId, submissions }) => {
  console.log(`Competition completed: ${submissions} designs submitted`);
});

// Run competition
const competition = await designManager.runCompetition(
  'Create a modern login page with email/password authentication and social login options',
  {
    taskType: 'feature',
    complexity: 'moderate',
    requiresUI: true,
    requiresBackend: true,
    requiresArchitecture: false,
    requiresApproval: true,
    suggestedAgents: [],
  },
  context
);

// Display all designs for user review (in CLI or web interface)
console.log(`\n${competition.submissions.length} designs generated:\n`);
for (const submission of competition.submissions) {
  console.log(`
Design ${submission.design.competitionMetadata.variant.variantNumber}:
  Style: ${submission.design.competitionMetadata.variant.designStyle}
  Focus: ${submission.design.competitionMetadata.variant.designFocus}
  Color Scheme: ${submission.design.competitionMetadata.variant.colorScheme}
  Pages: ${submission.design.pages.length}
  Components: ${submission.design.sharedComponents.length}
  `);
}

// User selects winning design (e.g., variant #7)
const selectedVariantId = competition.submissions[6].variantId;
const winningDesign = await designManager.selectWinner(
  competition.competitionId,
  selectedVariantId,
  'Best balance of usability and aesthetics'
);

// Winning design is now used for implementation
console.log('Selected design:', winningDesign.projectName);
```

---

## 4. Base HTML Template (`templates/mockup-base.html`)

```html
<!DOCTYPE html>
<html lang="en" data-theme="{{theme}}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="{{viewport}}">
  <title>{{title}}</title>
  <style>
    {{styles}}
  </style>
</head>
<body>
  <a href="#main" class="skip-link">Skip to main content</a>

  {{content}}

  <!-- Generated by Aigentflow UI Designer -->
  <!-- Page: {{pageName}} ({{pageId}}) -->
</body>
</html>
```

---

## 4. Register Agent in Registry

Update `src/agents/registry.ts` to import the UI Designer agent:

```typescript
/**
 * Initialize registry with all built-in agents
 */
async initialize(): Promise<void> {
  if (this.initialized) {
    return;
  }

  // Import and register built-in agents
  const { UIDesignerAgent } = await import('./agents/ui-designer');
  this.register(UIDesignerAgent);

  // Future agents will be added here
  // const { FrontendDevAgent } = await import('./agents/frontend-dev');
  // this.register(FrontendDevAgent);

  this.initialized = true;
  logger.info(`Agent registry initialized with ${this.agents.size} agents`);
}
```

---

## Test Scenarios

### Test 1: UI Designer Agent Metadata

```typescript
// tests/agents/ui-designer.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { UIDesignerAgent } from '../../src/agents/agents/ui-designer';
import { AgentType } from '../../src/agents/types';

describe('UIDesignerAgent', () => {
  let agent: UIDesignerAgent;

  beforeEach(() => {
    agent = new UIDesignerAgent();
  });

  it('should have correct metadata', () => {
    const metadata = agent.getMetadata();

    expect(metadata.id).toBe(AgentType.UI_DESIGNER);
    expect(metadata.name).toBe('UI Designer');
    expect(metadata.version).toBe('1.0.0');
  });

  it('should have mockup generation capability', () => {
    const metadata = agent.getMetadata();
    const mockupCap = metadata.capabilities.find(c => c.name === 'mockup_generation');

    expect(mockupCap).toBeDefined();
    expect(mockupCap?.inputTypes).toContain('requirements');
    expect(mockupCap?.outputTypes).toContain('html');
  });

  it('should have responsive design capability', () => {
    const metadata = agent.getMetadata();
    const responsiveCap = metadata.capabilities.find(c => c.name === 'responsive_design');

    expect(responsiveCap).toBeDefined();
  });

  it('should have accessibility capability', () => {
    const metadata = agent.getMetadata();
    const a11yCap = metadata.capabilities.find(c => c.name === 'accessibility');

    expect(a11yCap).toBeDefined();
  });

  it('should require current_task context', () => {
    const metadata = agent.getMetadata();
    const taskReq = metadata.requiredContext.find(r => r.type === 'current_task');

    expect(taskReq).toBeDefined();
    expect(taskReq?.required).toBe(true);
  });
});
```

### Test 2: Output Schema Validation

```typescript
// tests/agents/schemas/ui-designer-output.test.ts
import { describe, it, expect } from 'vitest';
import { UIDesignerOutputSchema, ComponentSchema, MockupPageSchema } from '../../../src/agents/schemas/ui-designer-output';

describe('UIDesignerOutput Schema', () => {
  it('should validate a minimal valid output', () => {
    const output = {
      projectName: 'test-project',
      version: '1.0.0',
      generatedAt: new Date().toISOString(),
      pages: [],
      sharedComponents: [],
      colorPalette: {
        primary: '#007bff',
        secondary: '#6c757d',
        accent: '#17a2b8',
        background: '#ffffff',
        surface: '#f8f9fa',
        text: '#212529',
        textSecondary: '#6c757d',
        error: '#dc3545',
        warning: '#ffc107',
        success: '#28a745',
        info: '#17a2b8',
      },
      typography: {
        fontFamily: 'system-ui, sans-serif',
        baseFontSize: '1rem',
        scaleRatio: 1.25,
      },
      spacing: {
        unit: 8,
        scale: [0, 0.5, 1, 2, 3, 4, 6, 8, 12, 16],
      },
    };

    const result = UIDesignerOutputSchema.safeParse(output);
    expect(result.success).toBe(true);
  });

  it('should validate a component with children', () => {
    const component = {
      id: 'form-container',
      type: 'form',
      name: 'Login Form',
      styles: {
        base: {
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
        },
      },
      accessibility: {
        role: 'form',
        ariaLabel: 'Login form',
      },
      children: [
        {
          id: 'email-input',
          type: 'input',
          name: 'Email Input',
          styles: { base: { padding: '8px' } },
          attributes: { type: 'email', placeholder: 'Enter email' },
        },
      ],
    };

    const result = ComponentSchema.safeParse(component);
    expect(result.success).toBe(true);
  });

  it('should validate a page with layout', () => {
    const page = {
      id: 'login-page',
      name: 'Login Page',
      title: 'Sign In',
      description: 'User authentication page',
      path: '/login',
      layout: {
        type: 'single-column',
        regions: [
          { name: 'main', area: 'main', components: ['login-form'] },
        ],
      },
      components: [
        {
          id: 'login-form',
          type: 'form',
          name: 'Login Form',
          styles: { base: {} },
        },
      ],
    };

    const result = MockupPageSchema.safeParse(page);
    expect(result.success).toBe(true);
  });

  it('should reject invalid component type', () => {
    const component = {
      id: 'test',
      type: 'invalid-type',
      name: 'Test',
      styles: { base: {} },
    };

    const result = ComponentSchema.safeParse(component);
    expect(result.success).toBe(false);
  });
});
```

### Test 3: HTML Generation

```typescript
// tests/agents/ui-designer-html.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { UIDesignerAgent } from '../../src/agents/agents/ui-designer';

// Mock the Anthropic client
vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: {
      create: vi.fn(),
    },
  })),
}));

describe('UIDesignerAgent HTML Generation', () => {
  let agent: UIDesignerAgent;

  beforeEach(() => {
    agent = new UIDesignerAgent();
  });

  it('should generate valid HTML structure', () => {
    // Access private method through prototype for testing
    const generateHTML = (agent as any).generateHTML.bind(agent);

    const page = {
      id: 'test-page',
      name: 'Test Page',
      title: 'Test',
      description: 'Test page',
      path: '/test',
      layout: { type: 'single-column', regions: [] },
      components: [
        {
          id: 'test-section',
          type: 'section',
          name: 'Test Section',
          content: 'Hello World',
          styles: { base: { padding: '16px' } },
        },
      ],
    };

    const design = {
      colorPalette: {
        primary: '#007bff',
        secondary: '#6c757d',
        accent: '#17a2b8',
        background: '#ffffff',
        surface: '#f8f9fa',
        text: '#212529',
        textSecondary: '#6c757d',
        error: '#dc3545',
        warning: '#ffc107',
        success: '#28a745',
        info: '#17a2b8',
      },
      typography: {
        fontFamily: 'system-ui',
        baseFontSize: '1rem',
        scaleRatio: 1.25,
      },
      spacing: {
        unit: 8,
        scale: [0, 1, 2, 4],
      },
    };

    const html = generateHTML(page, design);

    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('<html lang="en"');
    expect(html).toContain('<title>Test</title>');
    expect(html).toContain('id="test-section"');
    expect(html).toContain('Hello World');
    expect(html).toContain('--color-primary: #007bff');
    expect(html).toContain('skip-link');
  });

  it('should include accessibility attributes', () => {
    const generateHTML = (agent as any).generateHTML.bind(agent);

    const page = {
      id: 'a11y-page',
      name: 'Accessible Page',
      title: 'Accessible',
      description: 'Page with accessibility',
      path: '/accessible',
      layout: { type: 'single-column', regions: [] },
      components: [
        {
          id: 'nav',
          type: 'navigation',
          name: 'Main Navigation',
          styles: { base: {} },
          accessibility: {
            role: 'navigation',
            ariaLabel: 'Main site navigation',
          },
        },
      ],
    };

    const design = {
      colorPalette: { primary: '#000', secondary: '#000', accent: '#000', background: '#fff', surface: '#fff', text: '#000', textSecondary: '#666', error: '#f00', warning: '#ff0', success: '#0f0', info: '#00f' },
      typography: { fontFamily: 'sans-serif', baseFontSize: '16px', scaleRatio: 1.2 },
      spacing: { unit: 8, scale: [0, 1, 2] },
    };

    const html = generateHTML(page, design);

    expect(html).toContain('role="navigation"');
    expect(html).toContain('aria-label="Main site navigation"');
  });
});
```

### Test 4: Routing Hints

```typescript
// tests/agents/ui-designer-routing.test.ts
import { describe, it, expect } from 'vitest';
import { UIDesignerAgent } from '../../src/agents/agents/ui-designer';
import { AgentType } from '../../src/agents/types';

describe('UIDesignerAgent Routing', () => {
  it('should suggest frontend dev as next agent', () => {
    const agent = new UIDesignerAgent();
    const generateRoutingHints = (agent as any).generateRoutingHints.bind(agent);

    const result = {
      pages: [{ id: 'p1', name: 'Page 1' }],
      sharedComponents: [],
    };

    const hints = generateRoutingHints(result, [], {});

    expect(hints.suggestNext).toContain(AgentType.FRONTEND_DEV);
  });

  it('should request approval for designs', () => {
    const agent = new UIDesignerAgent();
    const generateRoutingHints = (agent as any).generateRoutingHints.bind(agent);

    const result = {
      pages: [{ id: 'p1', name: 'Page 1' }],
      sharedComponents: [],
    };

    const hints = generateRoutingHints(result, [], {});

    expect(hints.needsApproval).toBe(true);
  });

  it('should indicate failure when no pages generated', () => {
    const agent = new UIDesignerAgent();
    const generateRoutingHints = (agent as any).generateRoutingHints.bind(agent);

    const result = {
      pages: [],
      sharedComponents: [],
    };

    const hints = generateRoutingHints(result, [], {});

    expect(hints.hasFailures).toBe(true);
  });
});
```

---

## Validation Checklist

```
□ Output Schema
  □ Zod schema defined for all types
  □ Component schema supports nesting
  □ Page layout schema defined
  □ Color palette and typography schemas
  □ Competitive design schemas (variant, competition)

□ UI Designer Agent
  □ Extends BaseAgent correctly
  □ Implements all abstract methods
  □ Registered with @RegisterAgent
  □ Correct metadata and capabilities

□ HTML Generation
  □ Valid HTML5 structure
  □ CSS variables from tokens
  □ Semantic HTML tags
  □ Accessibility attributes
  □ Skip link included
  □ Responsive breakpoints

□ Artifacts
  □ HTML mockup files generated
  □ Component documentation generated
  □ Design spec JSON generated

□ Routing
  □ Suggests frontend dev next
  □ Requests approval
  □ Indicates failures correctly

□ Competitive Design Generation
  □ CompetitiveDesignManager class implemented
  □ Spawns up to 15 designers in parallel
  □ Each designer gets unique style/focus/color assignment
  □ Variant instructions generated correctly
  □ Competition results collected
  □ Winner selection works
  □ Events emitted for tracking

□ All tests pass
  □ npm run test -- tests/agents/ui-designer
```

---

## Next Step

Proceed to **07-DESIGN-TOKENS.md** to implement the design token generation system.
