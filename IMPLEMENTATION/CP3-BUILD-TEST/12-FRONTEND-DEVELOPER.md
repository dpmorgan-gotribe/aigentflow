# Step 12: Frontend Developer Agent

> **Checkpoint:** CP3 - Build & Test
> **Previous Step:** 11-CONFLICT-DETECTION.md (CP2)
> **Next Step:** 13-BACKEND-DEVELOPER.md

---

## Overview

The Frontend Developer Agent implements UI components using Test-Driven Development (TDD). It takes design mockups from the UI Designer and creates production-ready components with comprehensive test coverage.

**Tech-Stack Agnostic:** This agent accepts tech stack configuration as input, allowing it to generate code for any frontend framework (React, Vue, Svelte, Angular, etc.) with any styling approach and testing framework.

Key responsibilities:
- Implement UI components from design specs (framework-agnostic)
- Write tests FIRST (TDD approach)
- Apply design tokens for styling
- Ensure accessibility compliance
- Generate typed code
- Create component documentation

---

## Deliverables

1. `src/agents/agents/frontend-developer.ts` - Frontend Developer agent
2. `src/agents/schemas/frontend-output.ts` - Output schema
3. `src/agents/schemas/tech-stack.ts` - Tech stack configuration schema
4. `src/agents/templates/component-templates.ts` - Component templates

---

## 1. Tech Stack Configuration (`src/agents/schemas/tech-stack.ts`)

The tech stack is provided as input from user preferences, planning phase, or architect decisions.

```typescript
/**
 * Tech Stack Configuration Schema
 *
 * Defines the technology choices for frontend development.
 * This configuration is provided by the user, planner, or architect agent.
 */

import { z } from 'zod';

/**
 * Frontend framework configuration
 */
export const FrontendFrameworkSchema = z.object({
  name: z.enum(['react', 'vue', 'svelte', 'angular', 'solid', 'qwik', 'vanilla']),
  version: z.string().optional(),
  variant: z.string().optional(), // e.g., 'next', 'nuxt', 'sveltekit', 'remix'
  features: z.array(z.string()).optional(), // e.g., ['ssr', 'static', 'spa']
});

/**
 * Language configuration
 */
export const LanguageConfigSchema = z.object({
  name: z.enum(['typescript', 'javascript']),
  strict: z.boolean().default(true),
  version: z.string().optional(),
});

/**
 * Styling approach configuration
 */
export const StylingConfigSchema = z.object({
  approach: z.enum([
    'css-modules',
    'styled-components',
    'emotion',
    'tailwind',
    'sass',
    'less',
    'css-in-js',
    'vanilla-css',
    'unocss',
    'panda',
  ]),
  preprocessor: z.enum(['sass', 'less', 'postcss', 'none']).optional(),
  designSystem: z.string().optional(), // e.g., 'chakra', 'mui', 'radix', 'shadcn'
});

/**
 * Testing configuration
 */
export const TestingConfigSchema = z.object({
  unitFramework: z.enum(['vitest', 'jest', 'mocha', 'ava']),
  componentTesting: z.enum([
    'testing-library',
    'enzyme',
    'vue-test-utils',
    'cypress-component',
    'playwright-component',
  ]).optional(),
  e2eFramework: z.enum(['playwright', 'cypress', 'puppeteer', 'testcafe']).optional(),
  coverage: z.object({
    tool: z.enum(['v8', 'istanbul', 'c8']).optional(),
    thresholds: z.object({
      statements: z.number().default(80),
      branches: z.number().default(75),
      functions: z.number().default(80),
      lines: z.number().default(80),
    }).optional(),
  }).optional(),
});

/**
 * State management configuration
 */
export const StateManagementSchema = z.object({
  solution: z.enum([
    'none',
    'redux',
    'zustand',
    'jotai',
    'recoil',
    'mobx',
    'pinia',
    'vuex',
    'ngrx',
    'signals',
    'context',
  ]),
  middleware: z.array(z.string()).optional(),
});

/**
 * Build tool configuration
 */
export const BuildToolSchema = z.object({
  bundler: z.enum(['vite', 'webpack', 'esbuild', 'rollup', 'parcel', 'turbopack']),
  packageManager: z.enum(['npm', 'yarn', 'pnpm', 'bun']),
});

/**
 * Complete frontend tech stack
 */
export const FrontendTechStackSchema = z.object({
  framework: FrontendFrameworkSchema,
  language: LanguageConfigSchema,
  styling: StylingConfigSchema,
  testing: TestingConfigSchema,
  stateManagement: StateManagementSchema.optional(),
  buildTool: BuildToolSchema.optional(),

  // Additional libraries
  formHandling: z.enum(['react-hook-form', 'formik', 'vee-validate', 'native']).optional(),
  dataFetching: z.enum(['tanstack-query', 'swr', 'apollo', 'urql', 'fetch', 'axios']).optional(),
  validation: z.enum(['zod', 'yup', 'joi', 'valibot', 'native']).optional(),

  // Code conventions
  conventions: z.object({
    componentNaming: z.enum(['PascalCase', 'kebab-case']).default('PascalCase'),
    fileNaming: z.enum(['PascalCase', 'kebab-case', 'camelCase']).default('kebab-case'),
    testFileSuffix: z.enum(['.test', '.spec']).default('.test'),
    styleFileSuffix: z.string().optional(), // e.g., '.module.css', '.styles.ts'
  }).optional(),
});

export type FrontendTechStack = z.infer<typeof FrontendTechStackSchema>;

/**
 * Default tech stack (used when no config provided)
 */
export const DEFAULT_FRONTEND_TECH_STACK: FrontendTechStack = {
  framework: { name: 'react', version: '18' },
  language: { name: 'typescript', strict: true },
  styling: { approach: 'css-modules' },
  testing: {
    unitFramework: 'vitest',
    componentTesting: 'testing-library',
  },
};
```

---

## 2. Output Schema (`src/agents/schemas/frontend-output.ts`)

```typescript
/**
 * Frontend Developer Output Schema
 *
 * Defines the structured output for frontend component generation.
 */

import { z } from 'zod';

/**
 * Import statement
 */
export const ImportSchema = z.object({
  module: z.string(),
  named: z.array(z.string()).optional(),
  default: z.string().optional(),
  type: z.boolean().optional(), // type-only import
});

export type Import = z.infer<typeof ImportSchema>;

/**
 * TypeScript type/interface definition
 */
export const TypeDefinitionSchema = z.object({
  name: z.string(),
  kind: z.enum(['interface', 'type', 'enum']),
  exported: z.boolean(),
  content: z.string(), // The actual TypeScript code
  description: z.string().optional(),
});

export type TypeDefinition = z.infer<typeof TypeDefinitionSchema>;

/**
 * Component prop definition
 */
export const PropDefinitionSchema = z.object({
  name: z.string(),
  type: z.string(),
  required: z.boolean(),
  defaultValue: z.string().optional(),
  description: z.string(),
});

export type PropDefinition = z.infer<typeof PropDefinitionSchema>;

/**
 * React hook usage
 */
export const HookUsageSchema = z.object({
  hook: z.string(), // useState, useEffect, useCallback, custom hook
  purpose: z.string(),
  dependencies: z.array(z.string()).optional(),
});

export type HookUsage = z.infer<typeof HookUsageSchema>;

/**
 * Component style definition
 */
export const StyleDefinitionSchema = z.object({
  approach: z.enum(['css-modules', 'styled-components', 'tailwind', 'css-in-js', 'inline']),
  fileName: z.string().optional(),
  content: z.string(),
  tokens: z.array(z.string()), // Design tokens used
});

export type StyleDefinition = z.infer<typeof StyleDefinitionSchema>;

/**
 * Test case definition
 */
export const TestCaseSchema = z.object({
  description: z.string(),
  type: z.enum(['unit', 'integration', 'accessibility', 'snapshot']),
  testCode: z.string(),
  assertions: z.array(z.string()),
});

export type TestCase = z.infer<typeof TestCaseSchema>;

/**
 * Test file definition
 */
export const TestFileSchema = z.object({
  fileName: z.string(),
  imports: z.array(ImportSchema),
  setup: z.string().optional(), // beforeEach, test utilities
  testCases: z.array(TestCaseSchema),
  teardown: z.string().optional(), // afterEach, cleanup
});

export type TestFile = z.infer<typeof TestFileSchema>;

/**
 * React component definition
 */
export const ComponentDefinitionSchema = z.object({
  name: z.string(),
  fileName: z.string(),
  type: z.enum(['functional', 'forwardRef', 'memo', 'lazy']),
  description: z.string(),

  // Component structure
  imports: z.array(ImportSchema),
  types: z.array(TypeDefinitionSchema),
  props: z.array(PropDefinitionSchema),
  hooks: z.array(HookUsageSchema),

  // Component code
  componentCode: z.string(),

  // Styling
  styles: StyleDefinitionSchema.optional(),

  // Testing (TDD - tests first!)
  tests: TestFileSchema,

  // Accessibility
  accessibility: z.object({
    ariaAttributes: z.array(z.string()),
    keyboardNavigation: z.boolean(),
    screenReaderSupport: z.boolean(),
    focusManagement: z.boolean(),
  }),

  // Documentation
  storybook: z.object({
    stories: z.array(z.object({
      name: z.string(),
      args: z.record(z.string(), z.unknown()),
      description: z.string().optional(),
    })),
  }).optional(),
});

export type ComponentDefinition = z.infer<typeof ComponentDefinitionSchema>;

/**
 * Utility/helper file
 */
export const UtilityFileSchema = z.object({
  fileName: z.string(),
  description: z.string(),
  imports: z.array(ImportSchema),
  exports: z.array(z.object({
    name: z.string(),
    type: z.enum(['function', 'constant', 'type', 'class']),
    code: z.string(),
  })),
  tests: TestFileSchema.optional(),
});

export type UtilityFile = z.infer<typeof UtilityFileSchema>;

/**
 * Complete Frontend Developer output
 */
export const FrontendOutputSchema = z.object({
  featureId: z.string(),
  featureName: z.string(),
  generatedAt: z.string(),

  // Components created
  components: z.array(ComponentDefinitionSchema),

  // Shared types
  sharedTypes: z.array(TypeDefinitionSchema),

  // Utility files
  utilities: z.array(UtilityFileSchema),

  // API client code (if needed)
  apiClient: z.object({
    fileName: z.string(),
    endpoints: z.array(z.object({
      name: z.string(),
      method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']),
      path: z.string(),
      requestType: z.string().optional(),
      responseType: z.string(),
    })),
    code: z.string(),
    tests: TestFileSchema,
  }).optional(),

  // Summary
  summary: z.object({
    componentsCreated: z.number(),
    testsWritten: z.number(),
    linesOfCode: z.number(),
    testCoverage: z.number(), // Estimated percentage
  }),

  // Files to create
  files: z.array(z.object({
    path: z.string(),
    content: z.string(),
    type: z.enum(['component', 'test', 'style', 'type', 'utility', 'story']),
  })),
});

export type FrontendOutput = z.infer<typeof FrontendOutputSchema>;
```

---

## 3. Frontend Developer Agent (`src/agents/agents/frontend-developer.ts`)

```typescript
/**
 * Frontend Developer Agent
 *
 * Implements UI components using Test-Driven Development.
 * Tech-stack agnostic: accepts configuration for any framework.
 */

import { BaseAgent } from '../base-agent';
import { RegisterAgent } from '../registry';
import {
  AgentMetadata,
  AgentContext,
  AgentRequest,
  AgentOutput,
  Artifact,
  RoutingHints,
  AgentType,
} from '../types';
import {
  FrontendOutput,
  FrontendOutputSchema,
  ComponentDefinition,
  TestFile,
} from '../schemas/frontend-output';
import {
  FrontendTechStack,
  FrontendTechStackSchema,
  DEFAULT_FRONTEND_TECH_STACK,
} from '../schemas/tech-stack';
import { UIDesignerOutput } from '../schemas/ui-designer-output';
import { logger } from '../../utils/logger';
import path from 'path';

/**
 * Agent metadata
 */
const FRONTEND_DEV_METADATA: AgentMetadata = {
  id: AgentType.FRONTEND_DEV,
  name: 'Frontend Developer',
  description: 'Implements UI components using TDD (tech-stack agnostic)',
  version: '1.0.0',
  capabilities: [
    {
      name: 'component_creation',
      description: 'Create UI components from design specs',
      inputTypes: ['design_spec', 'mockup', 'component_tree', 'tech_stack'],
      outputTypes: ['component', 'typescript', 'tests'],
    },
    {
      name: 'tdd_implementation',
      description: 'Write tests first, then implementation',
      inputTypes: ['requirements', 'design_spec', 'tech_stack'],
      outputTypes: ['test_file', 'component'],
    },
    {
      name: 'accessibility_implementation',
      description: 'Implement WCAG-compliant accessible components',
      inputTypes: ['accessibility_requirements'],
      outputTypes: ['accessible_component'],
    },
    {
      name: 'api_integration',
      description: 'Create API client code for backend integration',
      inputTypes: ['api_spec', 'endpoints'],
      outputTypes: ['api_client', 'types'],
    },
  ],
  requiredContext: [
    { type: 'current_task', required: true },
    { type: 'tech_stack', required: false }, // If not provided, uses defaults
    { type: 'design_output', required: false },
    { type: 'design_tokens', required: false },
    { type: 'api_spec', required: false },
  ],
  outputSchema: 'frontend-output',
};

/**
 * Frontend Developer Agent implementation
 */
@RegisterAgent
export class FrontendDeveloperAgent extends BaseAgent {
  constructor() {
    super(FRONTEND_DEV_METADATA);
  }

  /**
   * Get tech stack from context or use defaults
   */
  private getTechStack(context: AgentContext): FrontendTechStack {
    const techStackItem = context.items.find(i => i.type === 'tech_stack');

    if (techStackItem?.content?.frontend) {
      const parsed = FrontendTechStackSchema.safeParse(techStackItem.content.frontend);
      if (parsed.success) {
        return parsed.data;
      }
      this.log('warn', 'Invalid tech stack config, using defaults', { errors: parsed.error });
    }

    return DEFAULT_FRONTEND_TECH_STACK;
  }

  /**
   * Build system prompt for frontend development (tech-stack aware)
   */
  protected buildSystemPrompt(context: AgentContext): string {
    const techStack = this.getTechStack(context);
    const designTokens = context.items.find(i => i.type === 'design_tokens');
    const projectConfig = context.items.find(i => i.type === 'project_config');

    // Build framework-specific guidance
    const frameworkGuidance = this.getFrameworkGuidance(techStack);
    const testingGuidance = this.getTestingGuidance(techStack);
    const stylingGuidance = this.getStylingGuidance(techStack);

    let prompt = `You are an expert Frontend Developer specializing in ${this.formatTechStack(techStack)}.
You follow Test-Driven Development (TDD) principles strictly.

## Your Development Process (TDD):
1. FIRST: Write failing tests that describe the expected behavior
2. THEN: Write minimal code to make tests pass
3. FINALLY: Refactor while keeping tests green

## Tech Stack Configuration:
${this.formatTechStackDetails(techStack)}

${frameworkGuidance}

${testingGuidance}

${stylingGuidance}

## Code Quality Requirements:
- All components must have comprehensive tests
- All props/inputs must be properly typed
- All components must be accessible (keyboard nav, ARIA, focus management)
- All components must be responsive
- Prefer composition over inheritance
- Extract reusable logic into hooks/composables/utilities

## Output Format:
You must output valid JSON matching this structure:
- featureId: Unique identifier
- featureName: Human-readable name
- components: Array of component definitions with:
  - name: ${techStack.conventions?.componentNaming || 'PascalCase'} component name
  - fileName: ${techStack.conventions?.fileNaming || 'kebab-case'} file name
  - tests: Test file with test cases (WRITTEN FIRST)
  - componentCode: Implementation code
  - props: Typed prop definitions
  - accessibility: A11y attributes and features
- sharedTypes: Reusable types
- utilities: Helper functions and hooks/composables
- files: Complete file list with paths and content

## Testing Requirements:
Each component must have tests for:
1. Rendering: Component renders without crashing
2. Props: All props/inputs work as expected
3. Interactions: User events handled correctly
4. Accessibility: Keyboard navigation, ARIA attributes
5. Edge cases: Empty states, loading, errors
`;

    if (designTokens) {
      prompt += `\n## Design Tokens Available:\n${JSON.stringify(designTokens.content, null, 2)}\nUse these tokens for all styling.\n`;
    }

    if (projectConfig) {
      prompt += `\n## Project Configuration:\n${JSON.stringify(projectConfig.content, null, 2)}\n`;
    }

    return prompt;
  }

  /**
   * Format tech stack for prompt header
   */
  private formatTechStack(ts: FrontendTechStack): string {
    const parts = [ts.framework.name];
    if (ts.framework.variant) parts.push(ts.framework.variant);
    if (ts.language.name === 'typescript') parts.push('TypeScript');
    return parts.join(' with ');
  }

  /**
   * Format tech stack details
   */
  private formatTechStackDetails(ts: FrontendTechStack): string {
    return `- Framework: ${ts.framework.name}${ts.framework.version ? ` ${ts.framework.version}` : ''}${ts.framework.variant ? ` (${ts.framework.variant})` : ''}
- Language: ${ts.language.name}${ts.language.strict ? ' (strict mode)' : ''}
- Styling: ${ts.styling.approach}${ts.styling.designSystem ? ` with ${ts.styling.designSystem}` : ''}
- Testing: ${ts.testing.unitFramework}${ts.testing.componentTesting ? ` + ${ts.testing.componentTesting}` : ''}
${ts.stateManagement?.solution && ts.stateManagement.solution !== 'none' ? `- State: ${ts.stateManagement.solution}` : ''}
${ts.dataFetching ? `- Data Fetching: ${ts.dataFetching}` : ''}
${ts.validation ? `- Validation: ${ts.validation}` : ''}`;
  }

  /**
   * Get framework-specific guidance
   */
  private getFrameworkGuidance(ts: FrontendTechStack): string {
    const guides: Record<string, string> = {
      react: `## React Guidelines:
- Use functional components with hooks
- Prefer React.FC for typed components
- Use forwardRef for components needing ref access
- Memoize with React.memo for expensive components
- Use useCallback and useMemo appropriately`,

      vue: `## Vue Guidelines:
- Use Composition API with <script setup>
- Define props with defineProps<>()
- Define emits with defineEmits<>()
- Use ref() and reactive() for state
- Extract logic into composables`,

      svelte: `## Svelte Guidelines:
- Use reactive declarations ($:)
- Export props for component inputs
- Use {#if}, {#each}, {#await} blocks
- Use actions for DOM manipulation
- Extract logic into stores`,

      angular: `## Angular Guidelines:
- Use standalone components
- Use signals for reactivity
- Implement OnInit, OnDestroy lifecycle hooks
- Use dependency injection
- Follow Angular style guide`,

      solid: `## SolidJS Guidelines:
- Use createSignal for reactive state
- Use createEffect for side effects
- Use createMemo for derived values
- Props are read-only by default
- Use Show and For components`,

      vanilla: `## Vanilla JS Guidelines:
- Use ES modules
- Implement Web Components if reusable
- Use event delegation
- Follow progressive enhancement`,
    };

    return guides[ts.framework.name] || '';
  }

  /**
   * Get testing-specific guidance
   */
  private getTestingGuidance(ts: FrontendTechStack): string {
    const unit = ts.testing.unitFramework;
    const component = ts.testing.componentTesting || 'native';

    let guide = `## Testing Setup:
- Unit tests: ${unit}`;

    if (component === 'testing-library') {
      guide += `
- Component tests: Testing Library (@testing-library/${ts.framework.name})
- Use screen queries (getByRole, getByLabelText, etc.)
- Use userEvent for interactions
- Use axe-core for accessibility testing`;
    } else if (component === 'vue-test-utils') {
      guide += `
- Component tests: Vue Test Utils
- Use mount() for full renders
- Use wrapper.find() for element queries
- Test emitted events with wrapper.emitted()`;
    } else if (component === 'cypress-component') {
      guide += `
- Component tests: Cypress Component Testing
- Use cy.mount() for component mounting
- Use cy.get() for element queries`;
    }

    return guide;
  }

  /**
   * Get styling-specific guidance
   */
  private getStylingGuidance(ts: FrontendTechStack): string {
    const guides: Record<string, string> = {
      'css-modules': `## Styling (CSS Modules):
- Import styles as 'styles' from './${ts.conventions?.styleFileSuffix || '.module.css'}'
- Use styles.className for class references
- Use :global() for global styles`,

      tailwind: `## Styling (Tailwind CSS):
- Use utility classes directly in markup
- Extract repeated patterns to @apply in CSS
- Use cn() or clsx() for conditional classes`,

      'styled-components': `## Styling (styled-components):
- Define styled components above the main component
- Use props for dynamic styling
- Use css\`\` helper for shared styles`,

      emotion: `## Styling (Emotion):
- Use css prop or styled API
- Extract theme values from useTheme()
- Use keyframes for animations`,

      'vanilla-css': `## Styling (Vanilla CSS):
- Use BEM naming convention
- Scope styles to component
- Use CSS custom properties for theming`,
    };

    return guides[ts.styling.approach] || '';
  }

  /**
   * Build user prompt with design specs
   */
  protected buildUserPrompt(request: AgentRequest): string {
    const task = request.context.task;
    const previousOutputs = request.context.previousOutputs;

    let prompt = `## Feature Requirements:\n`;
    prompt += `Task Type: ${task.taskType}\n`;
    prompt += `Complexity: ${task.complexity}\n`;
    prompt += `Requires Backend: ${task.requiresBackend}\n\n`;

    // Include original task
    const taskContext = request.context.items.find(i => i.type === 'current_task');
    if (taskContext) {
      prompt += `## Original Request:\n${JSON.stringify(taskContext.content, null, 2)}\n\n`;
    }

    // Include UI Designer output (critical for frontend)
    const designerOutput = previousOutputs.find(o => o.agentId === AgentType.UI_DESIGNER);
    if (designerOutput) {
      const design = designerOutput.result as UIDesignerOutput;
      prompt += `## UI Design Specification:\n`;
      prompt += `Pages: ${design.pages.length}\n`;
      prompt += `Shared Components: ${design.sharedComponents.length}\n`;
      prompt += `Color Palette: ${JSON.stringify(design.colorPalette)}\n`;
      prompt += `Typography: ${JSON.stringify(design.typography)}\n\n`;

      // Include component details
      prompt += `### Components to Implement:\n`;
      for (const page of design.pages) {
        prompt += `\nPage: ${page.name} (${page.path})\n`;
        for (const comp of page.components) {
          prompt += `- ${comp.name} (${comp.type}): ${comp.description || 'No description'}\n`;
        }
      }
      prompt += `\n### Shared Components:\n`;
      for (const comp of design.sharedComponents) {
        prompt += `- ${comp.name} (${comp.type}): ${comp.description || 'No description'}\n`;
      }
      prompt += '\n';
    }

    // Include architect output if available
    const architectOutput = previousOutputs.find(o => o.agentId === AgentType.ARCHITECT);
    if (architectOutput) {
      prompt += `## Architecture Guidelines:\n${JSON.stringify(architectOutput.result, null, 2)}\n\n`;
    }

    // Include backend API spec if available
    const backendOutput = previousOutputs.find(o => o.agentId === AgentType.BACKEND_DEV);
    if (backendOutput) {
      prompt += `## Backend API Available:\n${JSON.stringify(backendOutput.result, null, 2)}\n\n`;
    }

    prompt += `
## Instructions:
1. Create React components for each UI component in the design
2. Write tests FIRST for each component (TDD)
3. Implement components to pass all tests
4. Ensure all components are accessible
5. Create necessary types and utilities
6. Generate API client if backend integration needed

Output valid JSON only.`;

    return prompt;
  }

  /**
   * Parse LLM response
   */
  protected parseResponse(response: any): FrontendOutput {
    const text = this.extractTextContent(response);
    const parsed = this.parseJSON<FrontendOutput>(text);

    const result = FrontendOutputSchema.safeParse(parsed);
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
    parsed: FrontendOutput,
    request: AgentRequest
  ): Promise<{ result: FrontendOutput; artifacts: Artifact[] }> {
    const artifacts: Artifact[] = [];
    const basePath = path.join(request.context.projectId, 'src');

    // Generate all files from the output
    for (const file of parsed.files) {
      artifacts.push({
        id: this.generateArtifactId(),
        type: this.getArtifactType(file.type),
        path: path.join(basePath, file.path),
        content: file.content,
        metadata: {
          fileType: file.type,
          feature: parsed.featureName,
        },
      });
    }

    // Generate component index file
    if (parsed.components.length > 0) {
      const indexContent = this.generateComponentIndex(parsed.components);
      artifacts.push({
        id: this.generateArtifactId(),
        type: 'source_code',
        path: path.join(basePath, 'components', 'index.ts'),
        content: indexContent,
        metadata: {
          type: 'barrel',
          componentCount: parsed.components.length,
        },
      });
    }

    return { result: parsed, artifacts };
  }

  /**
   * Generate routing hints
   */
  protected generateRoutingHints(
    result: FrontendOutput,
    artifacts: Artifact[],
    request: AgentRequest
  ): RoutingHints {
    const hasComponents = result.components.length > 0;
    const hasTests = result.components.every(c => c.tests.testCases.length > 0);

    return {
      suggestNext: request.context.task.requiresBackend
        ? [AgentType.BACKEND_DEV]
        : [AgentType.TESTER],
      skipAgents: [],
      needsApproval: false,
      hasFailures: !hasComponents || !hasTests,
      isComplete: false,
      notes: hasComponents
        ? `Created ${result.components.length} component(s) with ${result.summary.testsWritten} tests`
        : 'No components generated',
    };
  }

  /**
   * Get artifact type from file type
   */
  private getArtifactType(fileType: string): string {
    const typeMap: Record<string, string> = {
      component: 'source_code',
      test: 'test_file',
      style: 'stylesheet',
      type: 'source_code',
      utility: 'source_code',
      story: 'documentation',
    };
    return typeMap[fileType] || 'source_code';
  }

  /**
   * Generate barrel export file for components
   */
  private generateComponentIndex(components: ComponentDefinition[]): string {
    const exports = components.map(c => {
      const importPath = `./${c.fileName.replace(/\.tsx?$/, '')}`;
      return `export { ${c.name} } from '${importPath}';`;
    });

    return `/**
 * Component Barrel Exports
 * Auto-generated by Aigentflow Frontend Developer
 */

${exports.join('\n')}
`;
  }
}
```

---

## 3. Component Templates (`src/agents/templates/component-templates.ts`)

```typescript
/**
 * Component Templates
 *
 * Templates for generating React components following best practices.
 */

/**
 * Functional component template
 */
export const FUNCTIONAL_COMPONENT_TEMPLATE = `
import React from 'react';
{{imports}}

{{types}}

/**
 * {{description}}
 */
export const {{name}}: React.FC<{{propsType}}> = ({{props}}) => {
  {{hooks}}

  {{handlers}}

  return (
    {{jsx}}
  );
};

{{name}}.displayName = '{{name}}';

export default {{name}};
`;

/**
 * ForwardRef component template
 */
export const FORWARD_REF_TEMPLATE = `
import React, { forwardRef } from 'react';
{{imports}}

{{types}}

/**
 * {{description}}
 */
export const {{name}} = forwardRef<{{refType}}, {{propsType}}>(
  ({{props}}, ref) => {
    {{hooks}}

    {{handlers}}

    return (
      {{jsx}}
    );
  }
);

{{name}}.displayName = '{{name}}';

export default {{name}};
`;

/**
 * Test file template
 */
export const TEST_FILE_TEMPLATE = `
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe, toHaveNoViolations } from 'jest-axe';
import { {{name}} } from './{{fileName}}';

expect.extend(toHaveNoViolations);

describe('{{name}}', () => {
  {{setup}}

  describe('Rendering', () => {
    it('renders without crashing', () => {
      render(<{{name}} {{defaultProps}} />);
      expect(screen.getByRole('{{primaryRole}}')).toBeInTheDocument();
    });

    {{renderTests}}
  });

  describe('Props', () => {
    {{propTests}}
  });

  describe('Interactions', () => {
    {{interactionTests}}
  });

  describe('Accessibility', () => {
    it('has no accessibility violations', async () => {
      const { container } = render(<{{name}} {{defaultProps}} />);
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('supports keyboard navigation', async () => {
      render(<{{name}} {{defaultProps}} />);
      const element = screen.getByRole('{{primaryRole}}');

      element.focus();
      expect(document.activeElement).toBe(element);

      {{keyboardTests}}
    });

    {{a11yTests}}
  });

  describe('Edge Cases', () => {
    {{edgeCaseTests}}
  });

  {{teardown}}
});
`;

/**
 * Storybook story template
 */
export const STORYBOOK_TEMPLATE = `
import type { Meta, StoryObj } from '@storybook/react';
import { {{name}} } from './{{fileName}}';

const meta: Meta<typeof {{name}}> = {
  title: '{{category}}/{{name}}',
  component: {{name}},
  parameters: {
    layout: '{{layout}}',
    docs: {
      description: {
        component: '{{description}}',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    {{argTypes}}
  },
};

export default meta;
type Story = StoryObj<typeof {{name}}>;

export const Default: Story = {
  args: {
    {{defaultArgs}}
  },
};

{{stories}}
`;

/**
 * Custom hook template
 */
export const CUSTOM_HOOK_TEMPLATE = `
import { useState, useEffect, useCallback, useMemo } from 'react';
{{imports}}

{{types}}

/**
 * {{description}}
 *
 * @example
 * {{example}}
 */
export function {{name}}({{params}}): {{returnType}} {
  {{implementation}}
}
`;

/**
 * API client template
 */
export const API_CLIENT_TEMPLATE = `
import { z } from 'zod';

{{types}}

/**
 * API Client for {{featureName}}
 */
class {{name}}Client {
  private baseUrl: string;

  constructor(baseUrl: string = '/api') {
    this.baseUrl = baseUrl;
  }

  private async request<T>(
    method: string,
    path: string,
    data?: unknown
  ): Promise<T> {
    const response = await fetch(\`\${this.baseUrl}\${path}\`, {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
      body: data ? JSON.stringify(data) : undefined,
    });

    if (!response.ok) {
      throw new Error(\`API Error: \${response.status}\`);
    }

    return response.json();
  }

  {{methods}}
}

export const {{instanceName}} = new {{name}}Client();
`;

/**
 * CSS Module template
 */
export const CSS_MODULE_TEMPLATE = `
/* {{name}} styles */
/* Using design tokens from theme */

.container {
  {{containerStyles}}
}

.{{primaryClass}} {
  {{primaryStyles}}
}

{{additionalClasses}}

/* Responsive styles */
@media (max-width: 768px) {
  {{mobileStyles}}
}

@media (min-width: 769px) and (max-width: 1024px) {
  {{tabletStyles}}
}

/* Accessibility */
@media (prefers-reduced-motion: reduce) {
  .{{primaryClass}} {
    animation: none;
    transition: none;
  }
}

/* Dark mode */
@media (prefers-color-scheme: dark) {
  {{darkModeStyles}}
}
`;

/**
 * Index barrel template
 */
export const INDEX_TEMPLATE = `
/**
 * {{folderName}} exports
 * Auto-generated by Aigentflow
 */

{{exports}}
`;
```

---

## 4. TDD Workflow Integration

The Frontend Developer integrates with the test/fix loop:

```typescript
// src/agents/workflows/frontend-tdd-workflow.ts

import { FrontendDeveloperAgent } from '../agents/frontend-developer';
import { TesterAgent } from '../agents/tester';
import { BugFixerAgent } from '../agents/bug-fixer';
import { AgentOutput, TaskAnalysis, AgentContext } from '../types';
import { logger } from '../../utils/logger';

/**
 * TDD Workflow for Frontend Development
 *
 * 1. Write tests based on requirements
 * 2. Run tests (should fail initially)
 * 3. Implement code to pass tests
 * 4. Run tests again
 * 5. If failures, fix and repeat
 */
export class FrontendTDDWorkflow {
  private frontendAgent: FrontendDeveloperAgent;
  private testerAgent: TesterAgent;
  private bugFixerAgent: BugFixerAgent;

  private maxFixAttempts = 3;

  constructor() {
    this.frontendAgent = new FrontendDeveloperAgent();
    this.testerAgent = new TesterAgent();
    this.bugFixerAgent = new BugFixerAgent();
  }

  /**
   * Execute TDD workflow
   */
  async execute(
    task: TaskAnalysis,
    context: AgentContext
  ): Promise<{
    success: boolean;
    output: AgentOutput;
    testResults: AgentOutput;
    fixAttempts: number;
  }> {
    logger.info('Starting Frontend TDD workflow');

    // Step 1: Generate tests and implementation
    const frontendOutput = await this.frontendAgent.execute({
      executionId: `fe-${Date.now()}`,
      task,
      context,
    });

    if (!frontendOutput.success) {
      return {
        success: false,
        output: frontendOutput,
        testResults: {} as AgentOutput,
        fixAttempts: 0,
      };
    }

    // Step 2: Run tests
    let testResults = await this.testerAgent.execute({
      executionId: `test-${Date.now()}`,
      task,
      context: {
        ...context,
        previousOutputs: [...context.previousOutputs, frontendOutput],
      },
    });

    let fixAttempts = 0;

    // Step 3: Fix loop if tests fail
    while (testResults.routingHints.hasFailures && fixAttempts < this.maxFixAttempts) {
      fixAttempts++;
      logger.info(`Fix attempt ${fixAttempts}/${this.maxFixAttempts}`);

      // Run bug fixer
      const fixOutput = await this.bugFixerAgent.execute({
        executionId: `fix-${Date.now()}`,
        task,
        context: {
          ...context,
          previousOutputs: [...context.previousOutputs, frontendOutput, testResults],
        },
      });

      if (!fixOutput.success) {
        logger.warn('Bug fixer failed', { attempt: fixAttempts });
        continue;
      }

      // Re-run tests
      testResults = await this.testerAgent.execute({
        executionId: `test-retry-${Date.now()}`,
        task,
        context: {
          ...context,
          previousOutputs: [...context.previousOutputs, frontendOutput, fixOutput],
        },
      });
    }

    const success = !testResults.routingHints.hasFailures;

    logger.info('Frontend TDD workflow complete', {
      success,
      fixAttempts,
    });

    return {
      success,
      output: frontendOutput,
      testResults,
      fixAttempts,
    };
  }
}
```

---

## 5. Example Generated Component

Here's an example of what the Frontend Developer generates:

### Test File (Written FIRST)

```typescript
// src/components/login-form/login-form.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe, toHaveNoViolations } from 'jest-axe';
import { LoginForm } from './login-form';

expect.extend(toHaveNoViolations);

describe('LoginForm', () => {
  const mockOnSubmit = vi.fn();
  const defaultProps = {
    onSubmit: mockOnSubmit,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('renders email and password inputs', () => {
      render(<LoginForm {...defaultProps} />);

      expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    });

    it('renders submit button', () => {
      render(<LoginForm {...defaultProps} />);

      expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
    });

    it('renders forgot password link', () => {
      render(<LoginForm {...defaultProps} />);

      expect(screen.getByRole('link', { name: /forgot password/i })).toBeInTheDocument();
    });
  });

  describe('Validation', () => {
    it('shows error for invalid email', async () => {
      render(<LoginForm {...defaultProps} />);

      const emailInput = screen.getByLabelText(/email/i);
      await userEvent.type(emailInput, 'invalid-email');
      fireEvent.blur(emailInput);

      expect(await screen.findByText(/valid email/i)).toBeInTheDocument();
    });

    it('shows error for empty password', async () => {
      render(<LoginForm {...defaultProps} />);

      const passwordInput = screen.getByLabelText(/password/i);
      fireEvent.focus(passwordInput);
      fireEvent.blur(passwordInput);

      expect(await screen.findByText(/password is required/i)).toBeInTheDocument();
    });

    it('shows error for short password', async () => {
      render(<LoginForm {...defaultProps} />);

      const passwordInput = screen.getByLabelText(/password/i);
      await userEvent.type(passwordInput, '123');
      fireEvent.blur(passwordInput);

      expect(await screen.findByText(/at least 8 characters/i)).toBeInTheDocument();
    });
  });

  describe('Submission', () => {
    it('calls onSubmit with credentials on valid submission', async () => {
      render(<LoginForm {...defaultProps} />);

      await userEvent.type(screen.getByLabelText(/email/i), 'test@example.com');
      await userEvent.type(screen.getByLabelText(/password/i), 'password123');
      await userEvent.click(screen.getByRole('button', { name: /sign in/i }));

      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalledWith({
          email: 'test@example.com',
          password: 'password123',
        });
      });
    });

    it('disables submit button while submitting', async () => {
      mockOnSubmit.mockImplementation(() => new Promise(r => setTimeout(r, 100)));
      render(<LoginForm {...defaultProps} />);

      await userEvent.type(screen.getByLabelText(/email/i), 'test@example.com');
      await userEvent.type(screen.getByLabelText(/password/i), 'password123');
      await userEvent.click(screen.getByRole('button', { name: /sign in/i }));

      expect(screen.getByRole('button', { name: /signing in/i })).toBeDisabled();
    });

    it('shows loading spinner while submitting', async () => {
      mockOnSubmit.mockImplementation(() => new Promise(r => setTimeout(r, 100)));
      render(<LoginForm {...defaultProps} />);

      await userEvent.type(screen.getByLabelText(/email/i), 'test@example.com');
      await userEvent.type(screen.getByLabelText(/password/i), 'password123');
      await userEvent.click(screen.getByRole('button', { name: /sign in/i }));

      expect(screen.getByRole('status')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('has no accessibility violations', async () => {
      const { container } = render(<LoginForm {...defaultProps} />);
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('associates labels with inputs', () => {
      render(<LoginForm {...defaultProps} />);

      const emailInput = screen.getByLabelText(/email/i);
      const passwordInput = screen.getByLabelText(/password/i);

      expect(emailInput).toHaveAttribute('id');
      expect(passwordInput).toHaveAttribute('id');
    });

    it('marks required fields', () => {
      render(<LoginForm {...defaultProps} />);

      expect(screen.getByLabelText(/email/i)).toHaveAttribute('aria-required', 'true');
      expect(screen.getByLabelText(/password/i)).toHaveAttribute('aria-required', 'true');
    });

    it('announces errors to screen readers', async () => {
      render(<LoginForm {...defaultProps} />);

      const emailInput = screen.getByLabelText(/email/i);
      await userEvent.type(emailInput, 'invalid');
      fireEvent.blur(emailInput);

      const errorMessage = await screen.findByText(/valid email/i);
      expect(errorMessage).toHaveAttribute('role', 'alert');
    });

    it('supports keyboard navigation', async () => {
      render(<LoginForm {...defaultProps} />);

      const emailInput = screen.getByLabelText(/email/i);
      const passwordInput = screen.getByLabelText(/password/i);
      const submitButton = screen.getByRole('button', { name: /sign in/i });

      emailInput.focus();
      expect(document.activeElement).toBe(emailInput);

      await userEvent.tab();
      expect(document.activeElement).toBe(passwordInput);

      await userEvent.tab();
      expect(document.activeElement).toBe(submitButton);
    });
  });

  describe('Error Handling', () => {
    it('displays server error message', async () => {
      mockOnSubmit.mockRejectedValue(new Error('Invalid credentials'));
      render(<LoginForm {...defaultProps} />);

      await userEvent.type(screen.getByLabelText(/email/i), 'test@example.com');
      await userEvent.type(screen.getByLabelText(/password/i), 'password123');
      await userEvent.click(screen.getByRole('button', { name: /sign in/i }));

      expect(await screen.findByText(/invalid credentials/i)).toBeInTheDocument();
    });

    it('allows retry after error', async () => {
      mockOnSubmit.mockRejectedValueOnce(new Error('Network error'));
      mockOnSubmit.mockResolvedValueOnce(undefined);

      render(<LoginForm {...defaultProps} />);

      await userEvent.type(screen.getByLabelText(/email/i), 'test@example.com');
      await userEvent.type(screen.getByLabelText(/password/i), 'password123');
      await userEvent.click(screen.getByRole('button', { name: /sign in/i }));

      await screen.findByText(/network error/i);

      await userEvent.click(screen.getByRole('button', { name: /sign in/i }));

      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalledTimes(2);
      });
    });
  });
});
```

### Component Implementation (Written to pass tests)

```typescript
// src/components/login-form/login-form.tsx
import React, { useState, useCallback } from 'react';
import styles from './login-form.module.css';

export interface LoginFormProps {
  onSubmit: (credentials: { email: string; password: string }) => Promise<void>;
  forgotPasswordUrl?: string;
}

interface FormErrors {
  email?: string;
  password?: string;
  submit?: string;
}

export const LoginForm: React.FC<LoginFormProps> = ({
  onSubmit,
  forgotPasswordUrl = '/forgot-password',
}) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [touched, setTouched] = useState({ email: false, password: false });

  const validateEmail = useCallback((value: string): string | undefined => {
    if (!value) return 'Email is required';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      return 'Please enter a valid email address';
    }
    return undefined;
  }, []);

  const validatePassword = useCallback((value: string): string | undefined => {
    if (!value) return 'Password is required';
    if (value.length < 8) {
      return 'Password must be at least 8 characters';
    }
    return undefined;
  }, []);

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setEmail(value);
    if (touched.email) {
      setErrors(prev => ({ ...prev, email: validateEmail(value) }));
    }
  };

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setPassword(value);
    if (touched.password) {
      setErrors(prev => ({ ...prev, password: validatePassword(value) }));
    }
  };

  const handleBlur = (field: 'email' | 'password') => {
    setTouched(prev => ({ ...prev, [field]: true }));
    if (field === 'email') {
      setErrors(prev => ({ ...prev, email: validateEmail(email) }));
    } else {
      setErrors(prev => ({ ...prev, password: validatePassword(password) }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const emailError = validateEmail(email);
    const passwordError = validatePassword(password);

    setErrors({ email: emailError, password: passwordError });
    setTouched({ email: true, password: true });

    if (emailError || passwordError) {
      return;
    }

    setIsSubmitting(true);
    setErrors(prev => ({ ...prev, submit: undefined }));

    try {
      await onSubmit({ email, password });
    } catch (error) {
      setErrors(prev => ({
        ...prev,
        submit: error instanceof Error ? error.message : 'An error occurred',
      }));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form
      className={styles.form}
      onSubmit={handleSubmit}
      noValidate
    >
      <div className={styles.field}>
        <label htmlFor="email" className={styles.label}>
          Email
        </label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={handleEmailChange}
          onBlur={() => handleBlur('email')}
          aria-required="true"
          aria-invalid={!!errors.email}
          aria-describedby={errors.email ? 'email-error' : undefined}
          className={styles.input}
          disabled={isSubmitting}
        />
        {errors.email && (
          <span id="email-error" className={styles.error} role="alert">
            {errors.email}
          </span>
        )}
      </div>

      <div className={styles.field}>
        <label htmlFor="password" className={styles.label}>
          Password
        </label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={handlePasswordChange}
          onBlur={() => handleBlur('password')}
          aria-required="true"
          aria-invalid={!!errors.password}
          aria-describedby={errors.password ? 'password-error' : undefined}
          className={styles.input}
          disabled={isSubmitting}
        />
        {errors.password && (
          <span id="password-error" className={styles.error} role="alert">
            {errors.password}
          </span>
        )}
      </div>

      {errors.submit && (
        <div className={styles.submitError} role="alert">
          {errors.submit}
        </div>
      )}

      <button
        type="submit"
        className={styles.submitButton}
        disabled={isSubmitting}
      >
        {isSubmitting ? (
          <>
            <span role="status" aria-label="Signing in" className={styles.spinner} />
            Signing in...
          </>
        ) : (
          'Sign in'
        )}
      </button>

      <a href={forgotPasswordUrl} className={styles.forgotLink}>
        Forgot password?
      </a>
    </form>
  );
};

LoginForm.displayName = 'LoginForm';

export default LoginForm;
```

---

## Test Scenarios

### Test 1: Agent Metadata

```typescript
// tests/agents/frontend-developer.test.ts
import { describe, it, expect } from 'vitest';
import { FrontendDeveloperAgent } from '../../src/agents/agents/frontend-developer';
import { AgentType } from '../../src/agents/types';

describe('FrontendDeveloperAgent', () => {
  it('should have correct metadata', () => {
    const agent = new FrontendDeveloperAgent();
    const metadata = agent.getMetadata();

    expect(metadata.id).toBe(AgentType.FRONTEND_DEV);
    expect(metadata.name).toBe('Frontend Developer');
  });

  it('should have TDD capability', () => {
    const agent = new FrontendDeveloperAgent();
    const metadata = agent.getMetadata();
    const tddCap = metadata.capabilities.find(c => c.name === 'tdd_implementation');

    expect(tddCap).toBeDefined();
    expect(tddCap?.outputTypes).toContain('test_file');
  });

  it('should require current_task context', () => {
    const agent = new FrontendDeveloperAgent();
    const metadata = agent.getMetadata();
    const taskReq = metadata.requiredContext.find(r => r.type === 'current_task');

    expect(taskReq?.required).toBe(true);
  });
});
```

### Test 2: Output Schema Validation

```typescript
// tests/agents/schemas/frontend-output.test.ts
import { describe, it, expect } from 'vitest';
import {
  FrontendOutputSchema,
  ComponentDefinitionSchema,
  TestFileSchema,
} from '../../../src/agents/schemas/frontend-output';

describe('Frontend Output Schema', () => {
  it('should validate component with tests', () => {
    const component = {
      name: 'Button',
      fileName: 'button.tsx',
      type: 'functional',
      description: 'A button component',
      imports: [{ module: 'react', named: ['FC'] }],
      types: [],
      props: [{ name: 'onClick', type: '() => void', required: true, description: 'Click handler' }],
      hooks: [],
      componentCode: 'export const Button: FC = () => <button>Click</button>;',
      tests: {
        fileName: 'button.test.tsx',
        imports: [{ module: 'vitest', named: ['describe', 'it', 'expect'] }],
        testCases: [{
          description: 'renders correctly',
          type: 'unit',
          testCode: 'render(<Button />)',
          assertions: ['expect(screen.getByRole("button")).toBeInTheDocument()'],
        }],
      },
      accessibility: {
        ariaAttributes: ['aria-label'],
        keyboardNavigation: true,
        screenReaderSupport: true,
        focusManagement: true,
      },
    };

    const result = ComponentDefinitionSchema.safeParse(component);
    expect(result.success).toBe(true);
  });

  it('should require tests for components', () => {
    const componentWithoutTests = {
      name: 'Button',
      fileName: 'button.tsx',
      type: 'functional',
      description: 'A button component',
      imports: [],
      types: [],
      props: [],
      hooks: [],
      componentCode: 'const Button = () => <button />;',
      accessibility: {
        ariaAttributes: [],
        keyboardNavigation: false,
        screenReaderSupport: false,
        focusManagement: false,
      },
    };

    const result = ComponentDefinitionSchema.safeParse(componentWithoutTests);
    expect(result.success).toBe(false);
  });
});
```

---

## Validation Checklist

```
□ Output Schema
  □ Component definition schema
  □ Test file schema
  □ Import schema
  □ Type definition schema
  □ Frontend output schema

□ Frontend Developer Agent
  □ Extends BaseAgent correctly
  □ Implements all abstract methods
  □ Registered with decorator
  □ Correct metadata and capabilities

□ TDD Workflow
  □ Tests written before implementation
  □ Component code passes all tests
  □ Accessibility tests included
  □ Integration with tester agent

□ Generated Components
  □ Valid React/TypeScript code
  □ Proper prop typing
  □ Accessibility attributes
  □ Responsive styles
  □ Test coverage

□ Artifacts
  □ Component files generated
  □ Test files generated
  □ Style files generated
  □ Type files generated
  □ Index barrel files

□ All tests pass
  □ npm run test -- tests/agents/frontend-developer
```

---

## Next Step

Proceed to **13-BACKEND-DEVELOPER.md** to implement the Backend Developer agent for API and server-side code.
