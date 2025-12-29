/**
 * Coding Skill Pack
 *
 * Skills for code generation and best practices.
 */

import type { SkillPack, Skill } from '../types.js';

/**
 * TypeScript best practices skill
 */
const typescriptSkill: Skill = {
  id: 'typescript-best-practices',
  name: 'TypeScript Best Practices',
  description: 'Guidelines for writing idiomatic TypeScript code',
  category: 'coding',
  priority: 'high',
  version: '1.0.0',
  tokenEstimate: 450,
  conditions: [
    { field: 'languages', operator: 'contains', value: 'typescript' },
  ],
  dependencies: [],
  conflicts: [],
  content: `## TypeScript Guidelines

### Type Safety
- Use strict mode and avoid \`any\` type
- Prefer interfaces for object shapes, types for unions/primitives
- Use generics for reusable type-safe code
- Leverage type inference where obvious

### Code Organization
- Export types alongside implementations
- Use barrel files (index.ts) for module exports
- Keep related code together in feature modules
- Use readonly for immutable properties

### Error Handling
- Use discriminated unions for error states
- Type guard functions for runtime checks
- Avoid throwing in favor of Result types for expected errors

### Naming Conventions
- PascalCase for types and interfaces
- camelCase for variables and functions
- UPPER_SNAKE_CASE for constants`,
  examples: [
    {
      title: 'Type-safe result pattern',
      input: 'Function that can fail',
      output: 'type Result<T, E> = { success: true; data: T } | { success: false; error: E }',
    },
  ],
  tags: ['typescript', 'types', 'best-practices'],
  enabled: true,
};

/**
 * React patterns skill
 */
const reactSkill: Skill = {
  id: 'react-patterns',
  name: 'React Patterns',
  description: 'Modern React patterns and best practices',
  category: 'coding',
  priority: 'high',
  version: '1.0.0',
  tokenEstimate: 500,
  conditions: [
    { field: 'frameworks', operator: 'contains', value: 'react' },
  ],
  dependencies: [],
  conflicts: [],
  content: `## React Patterns

### Component Design
- Prefer functional components with hooks
- Keep components small and focused
- Use composition over inheritance
- Extract custom hooks for reusable logic

### State Management
- Use useState for local UI state
- Use useReducer for complex state logic
- Lift state only when necessary
- Consider context for cross-cutting concerns

### Performance
- Memoize expensive computations with useMemo
- Use useCallback for stable function references
- Implement React.memo for pure components
- Use lazy loading for code splitting

### Accessibility
- Use semantic HTML elements
- Include ARIA labels where needed
- Ensure keyboard navigation
- Test with screen readers`,
  examples: [
    {
      title: 'Custom hook pattern',
      input: 'Reusable fetch logic',
      output: 'function useApi<T>(url: string): { data: T | null; loading: boolean; error: Error | null }',
    },
  ],
  tags: ['react', 'hooks', 'components', 'frontend'],
  enabled: true,
};

/**
 * Node.js patterns skill
 */
const nodeSkill: Skill = {
  id: 'nodejs-patterns',
  name: 'Node.js Patterns',
  description: 'Node.js best practices for server-side code',
  category: 'coding',
  priority: 'high',
  version: '1.0.0',
  tokenEstimate: 400,
  conditions: [
    { field: 'frameworks', operator: 'contains', value: 'node' },
  ],
  dependencies: [],
  conflicts: [],
  content: `## Node.js Patterns

### Async Programming
- Use async/await over callbacks
- Handle promise rejections
- Use Promise.all for concurrent operations
- Implement proper error boundaries

### File System
- Use fs/promises for async file operations
- Handle file paths with path module
- Validate file paths to prevent traversal
- Use streams for large files

### API Design
- Use proper HTTP status codes
- Validate input at boundaries
- Implement rate limiting
- Use middleware for cross-cutting concerns

### Error Handling
- Create custom error classes
- Log errors with context
- Never expose stack traces in production
- Graceful shutdown on signals`,
  examples: [
    {
      title: 'Graceful shutdown',
      input: 'Handle SIGTERM',
      output: 'process.on("SIGTERM", async () => { await cleanup(); process.exit(0); })',
    },
  ],
  tags: ['nodejs', 'backend', 'server', 'api'],
  enabled: true,
};

/**
 * Clean code skill
 */
const cleanCodeSkill: Skill = {
  id: 'clean-code',
  name: 'Clean Code Principles',
  description: 'Universal clean code guidelines',
  category: 'coding',
  priority: 'medium',
  version: '1.0.0',
  tokenEstimate: 350,
  conditions: [],  // Always applicable
  dependencies: [],
  conflicts: [],
  content: `## Clean Code Principles

### Naming
- Use descriptive, pronounceable names
- Avoid abbreviations except common ones
- Name functions as verbs, variables as nouns
- Be consistent with naming conventions

### Functions
- Keep functions small (< 20 lines ideal)
- Single responsibility per function
- Limit parameters (max 3, use objects for more)
- Avoid side effects where possible

### Comments
- Code should be self-documenting
- Comment the "why", not the "what"
- Keep comments up to date
- Use JSDoc for public APIs

### Structure
- Related code should be close together
- Limit nesting depth (max 3 levels)
- Early returns over nested conditionals
- Extract complex conditions to well-named functions`,
  examples: [
    {
      title: 'Early return',
      input: 'Nested conditions',
      output: 'if (!isValid) return error; if (!hasPermission) return forbidden; return process();',
    },
  ],
  tags: ['clean-code', 'readability', 'maintainability'],
  enabled: true,
};

/**
 * ESM patterns skill
 */
const esmSkill: Skill = {
  id: 'esm-patterns',
  name: 'ES Modules Patterns',
  description: 'Guidelines for ES Modules',
  category: 'coding',
  priority: 'medium',
  version: '1.0.0',
  tokenEstimate: 250,
  conditions: [
    { field: 'languages', operator: 'contains', value: ['typescript', 'javascript'] },
  ],
  dependencies: [],
  conflicts: [],
  content: `## ES Modules Guidelines

### Imports
- Use named exports for multiple exports
- Default exports for main module export
- Group imports: external, internal, types
- Use .js extension for local imports in ESM

### Exports
- Export types and implementations together
- Re-export from barrel files (index.ts)
- Avoid circular dependencies
- Keep export surface area minimal

### Package.json
- Set "type": "module" for ESM
- Configure exports field for subpaths
- Use engines field for Node version`,
  examples: [],
  tags: ['esm', 'modules', 'imports'],
  enabled: true,
};

/**
 * Coding skill pack
 */
export const codingSkillPack: SkillPack = {
  id: 'built-in-coding',
  name: 'Coding Skills',
  description: 'Built-in skills for code generation and best practices',
  version: '1.0.0',
  skills: [
    typescriptSkill,
    reactSkill,
    nodeSkill,
    cleanCodeSkill,
    esmSkill,
  ],
  author: 'Aigentflow',
};

export default codingSkillPack;
