# Step 06a: Skills Framework

> **Checkpoint:** CP1 - Design System
> **Previous Step:** 05f-COMPLIANCE-AGENT.md
> **Next Step:** 06b-MCP-SERVER-CONFIG.md

---

## Overview

The **Skills Framework** provides modular capability packs that extend agent functionality. Skills are self-contained units of expertise that can be loaded, composed, and injected into agents based on task requirements.

Key responsibilities:
- Define skill structure and interfaces
- Load and validate skill packs
- Register skills with the system
- Inject skills into agent contexts
- Manage skill dependencies and conflicts

---

## Deliverables

1. `src/skills/types.ts` - Core skill types
2. `src/skills/skill-loader.ts` - Skill loading and validation
3. `src/skills/skill-registry.ts` - Skill registration and lookup
4. `src/skills/skill-injector.ts` - Skill injection into prompts
5. `src/skills/built-in/` - Built-in skill definitions

---

## 1. Core Types (`src/skills/types.ts`)

```typescript
/**
 * Skills Framework Types
 */

import { z } from 'zod';
import { AgentType } from '../agents/types';

/**
 * Skill categories
 */
export const SkillCategorySchema = z.enum([
  'coding',      // Code generation and manipulation
  'testing',     // Test writing and execution
  'security',    // Security analysis and hardening
  'compliance',  // Compliance checking and remediation
  'documentation', // Documentation generation
  'analysis',    // Code analysis and metrics
  'devops',      // CI/CD and deployment
  'database',    // Database operations
  'api',         // API design and implementation
  'ui',          // UI/UX implementation
]);

export type SkillCategory = z.infer<typeof SkillCategorySchema>;

/**
 * Skill priority levels
 */
export const SkillPrioritySchema = z.enum([
  'critical',    // Must be included
  'high',        // Should be included if space allows
  'medium',      // Include if relevant
  'low',         // Include only if specifically requested
]);

export type SkillPriority = z.infer<typeof SkillPrioritySchema>;

/**
 * Skill definition schema
 */
export const SkillDefinitionSchema = z.object({
  // Identity
  id: z.string().regex(/^[a-z][a-z0-9-]*$/),
  name: z.string(),
  version: z.string().regex(/^\d+\.\d+\.\d+$/),
  description: z.string(),

  // Classification
  category: SkillCategorySchema,
  tags: z.array(z.string()),

  // Content
  instructions: z.string(),
  examples: z.array(z.object({
    scenario: z.string(),
    input: z.string(),
    output: z.string(),
  })).optional(),

  // Constraints
  tokenBudget: z.number().int().positive(),
  priority: SkillPrioritySchema,

  // Applicability
  applicableAgents: z.array(z.nativeEnum(AgentType)),
  requiredSkills: z.array(z.string()).default([]),
  conflictingSkills: z.array(z.string()).default([]),

  // Conditions
  conditions: z.object({
    languages: z.array(z.string()).optional(),
    frameworks: z.array(z.string()).optional(),
    projectTypes: z.array(z.string()).optional(),
    customCondition: z.string().optional(),
  }).optional(),
});

export type SkillDefinition = z.infer<typeof SkillDefinitionSchema>;

/**
 * Skill pack - collection of related skills
 */
export const SkillPackSchema = z.object({
  id: z.string(),
  name: z.string(),
  version: z.string(),
  description: z.string(),
  skills: z.array(SkillDefinitionSchema),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export type SkillPack = z.infer<typeof SkillPackSchema>;

/**
 * Loaded skill with runtime info
 */
export interface LoadedSkill extends SkillDefinition {
  packId: string;
  loadedAt: Date;
  source: 'built-in' | 'project' | 'external';
}

/**
 * Skill selection criteria
 */
export interface SkillSelectionCriteria {
  agentType: AgentType;
  category?: SkillCategory;
  tags?: string[];
  language?: string;
  framework?: string;
  projectType?: string;
  maxTokens?: number;
  requiredSkills?: string[];
  excludeSkills?: string[];
}

/**
 * Selected skills result
 */
export interface SelectedSkills {
  skills: LoadedSkill[];
  totalTokens: number;
  excluded: Array<{
    skill: LoadedSkill;
    reason: string;
  }>;
}

/**
 * Skill injection result
 */
export interface SkillInjection {
  content: string;
  tokenCount: number;
  skills: string[];
}
```

---

## 2. Skill Loader (`src/skills/skill-loader.ts`)

```typescript
/**
 * Skill Loader
 *
 * Loads and validates skill packs from various sources.
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { z } from 'zod';
import {
  SkillDefinition,
  SkillDefinitionSchema,
  SkillPack,
  SkillPackSchema,
  LoadedSkill,
} from './types';
import { logger } from '../utils/logger';

/**
 * Skill loader configuration
 */
export interface SkillLoaderConfig {
  builtInPath: string;
  projectPath?: string;
  externalPaths?: string[];
  validateOnLoad: boolean;
}

/**
 * Skill Loader implementation
 */
export class SkillLoader {
  private config: SkillLoaderConfig;
  private loadedPacks: Map<string, SkillPack> = new Map();
  private loadedSkills: Map<string, LoadedSkill> = new Map();

  constructor(config: SkillLoaderConfig) {
    this.config = config;
  }

  /**
   * Load all skill packs from configured sources
   */
  async loadAll(): Promise<void> {
    // Load built-in skills
    await this.loadFromDirectory(this.config.builtInPath, 'built-in');

    // Load project skills if configured
    if (this.config.projectPath) {
      try {
        await this.loadFromDirectory(this.config.projectPath, 'project');
      } catch (error) {
        logger.debug('No project skills found', { path: this.config.projectPath });
      }
    }

    // Load external skills
    if (this.config.externalPaths) {
      for (const extPath of this.config.externalPaths) {
        try {
          await this.loadFromDirectory(extPath, 'external');
        } catch (error) {
          logger.warn('Failed to load external skills', { path: extPath, error });
        }
      }
    }

    logger.info('Skills loaded', {
      packs: this.loadedPacks.size,
      skills: this.loadedSkills.size,
    });
  }

  /**
   * Load skills from a directory
   */
  private async loadFromDirectory(
    dirPath: string,
    source: 'built-in' | 'project' | 'external'
  ): Promise<void> {
    const files = await fs.readdir(dirPath);

    for (const file of files) {
      if (!file.endsWith('.json') && !file.endsWith('.yaml')) {
        continue;
      }

      const filePath = path.join(dirPath, file);
      await this.loadPackFile(filePath, source);
    }
  }

  /**
   * Load a single skill pack file
   */
  private async loadPackFile(
    filePath: string,
    source: 'built-in' | 'project' | 'external'
  ): Promise<void> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const data = JSON.parse(content);

      // Validate schema
      if (this.config.validateOnLoad) {
        SkillPackSchema.parse(data);
      }

      const pack = data as SkillPack;

      // Check for conflicts
      if (this.loadedPacks.has(pack.id)) {
        const existing = this.loadedPacks.get(pack.id)!;
        logger.warn('Skill pack conflict', {
          packId: pack.id,
          existing: existing.version,
          new: pack.version,
        });
        // Keep the existing one (built-in > project > external)
        return;
      }

      // Register pack
      this.loadedPacks.set(pack.id, pack);

      // Register individual skills
      for (const skill of pack.skills) {
        const loadedSkill: LoadedSkill = {
          ...skill,
          packId: pack.id,
          loadedAt: new Date(),
          source,
        };

        if (this.loadedSkills.has(skill.id)) {
          logger.warn('Skill conflict', {
            skillId: skill.id,
            packId: pack.id,
          });
          continue;
        }

        this.loadedSkills.set(skill.id, loadedSkill);
      }

      logger.debug('Loaded skill pack', {
        packId: pack.id,
        skillCount: pack.skills.length,
        source,
      });
    } catch (error) {
      logger.error('Failed to load skill pack', { filePath, error });
      throw error;
    }
  }

  /**
   * Load a single skill definition
   */
  async loadSkill(definition: SkillDefinition, packId: string = 'dynamic'): Promise<LoadedSkill> {
    if (this.config.validateOnLoad) {
      SkillDefinitionSchema.parse(definition);
    }

    const loadedSkill: LoadedSkill = {
      ...definition,
      packId,
      loadedAt: new Date(),
      source: 'external',
    };

    this.loadedSkills.set(definition.id, loadedSkill);
    return loadedSkill;
  }

  /**
   * Get all loaded skills
   */
  getAllSkills(): LoadedSkill[] {
    return Array.from(this.loadedSkills.values());
  }

  /**
   * Get skill by ID
   */
  getSkill(id: string): LoadedSkill | undefined {
    return this.loadedSkills.get(id);
  }

  /**
   * Get all loaded packs
   */
  getAllPacks(): SkillPack[] {
    return Array.from(this.loadedPacks.values());
  }

  /**
   * Get pack by ID
   */
  getPack(id: string): SkillPack | undefined {
    return this.loadedPacks.get(id);
  }

  /**
   * Clear all loaded skills
   */
  clear(): void {
    this.loadedPacks.clear();
    this.loadedSkills.clear();
  }
}
```

---

## 3. Skill Registry (`src/skills/skill-registry.ts`)

```typescript
/**
 * Skill Registry
 *
 * Central registry for skill lookup and selection.
 */

import {
  LoadedSkill,
  SkillCategory,
  SkillSelectionCriteria,
  SelectedSkills,
  SkillPriority,
} from './types';
import { AgentType } from '../agents/types';
import { logger } from '../utils/logger';

/**
 * Priority weights for sorting
 */
const PRIORITY_WEIGHTS: Record<SkillPriority, number> = {
  critical: 1000,
  high: 100,
  medium: 10,
  low: 1,
};

/**
 * Skill Registry implementation
 */
export class SkillRegistry {
  private skills: Map<string, LoadedSkill> = new Map();
  private byCategory: Map<SkillCategory, Set<string>> = new Map();
  private byAgent: Map<AgentType, Set<string>> = new Map();
  private byTag: Map<string, Set<string>> = new Map();

  /**
   * Register a skill
   */
  register(skill: LoadedSkill): void {
    // Store skill
    this.skills.set(skill.id, skill);

    // Index by category
    if (!this.byCategory.has(skill.category)) {
      this.byCategory.set(skill.category, new Set());
    }
    this.byCategory.get(skill.category)!.add(skill.id);

    // Index by applicable agents
    for (const agent of skill.applicableAgents) {
      if (!this.byAgent.has(agent)) {
        this.byAgent.set(agent, new Set());
      }
      this.byAgent.get(agent)!.add(skill.id);
    }

    // Index by tags
    for (const tag of skill.tags) {
      if (!this.byTag.has(tag)) {
        this.byTag.set(tag, new Set());
      }
      this.byTag.get(tag)!.add(skill.id);
    }

    logger.debug('Skill registered', { skillId: skill.id, category: skill.category });
  }

  /**
   * Register multiple skills
   */
  registerAll(skills: LoadedSkill[]): void {
    for (const skill of skills) {
      this.register(skill);
    }
  }

  /**
   * Get skill by ID
   */
  get(id: string): LoadedSkill | undefined {
    return this.skills.get(id);
  }

  /**
   * Get all skills
   */
  getAll(): LoadedSkill[] {
    return Array.from(this.skills.values());
  }

  /**
   * Select skills based on criteria
   */
  select(criteria: SkillSelectionCriteria): SelectedSkills {
    const candidates: LoadedSkill[] = [];
    const excluded: Array<{ skill: LoadedSkill; reason: string }> = [];

    // Start with skills applicable to this agent
    const agentSkills = this.byAgent.get(criteria.agentType) || new Set();

    for (const skillId of agentSkills) {
      const skill = this.skills.get(skillId)!;

      // Check category filter
      if (criteria.category && skill.category !== criteria.category) {
        continue;
      }

      // Check tag filter
      if (criteria.tags && criteria.tags.length > 0) {
        const hasTag = criteria.tags.some(tag => skill.tags.includes(tag));
        if (!hasTag) {
          continue;
        }
      }

      // Check exclusions
      if (criteria.excludeSkills?.includes(skill.id)) {
        excluded.push({ skill, reason: 'explicitly excluded' });
        continue;
      }

      // Check language condition
      if (skill.conditions?.languages && criteria.language) {
        if (!skill.conditions.languages.includes(criteria.language)) {
          excluded.push({ skill, reason: `language mismatch: ${criteria.language}` });
          continue;
        }
      }

      // Check framework condition
      if (skill.conditions?.frameworks && criteria.framework) {
        if (!skill.conditions.frameworks.includes(criteria.framework)) {
          excluded.push({ skill, reason: `framework mismatch: ${criteria.framework}` });
          continue;
        }
      }

      // Check project type condition
      if (skill.conditions?.projectTypes && criteria.projectType) {
        if (!skill.conditions.projectTypes.includes(criteria.projectType)) {
          excluded.push({ skill, reason: `project type mismatch: ${criteria.projectType}` });
          continue;
        }
      }

      candidates.push(skill);
    }

    // Add required skills
    if (criteria.requiredSkills) {
      for (const requiredId of criteria.requiredSkills) {
        const skill = this.skills.get(requiredId);
        if (skill && !candidates.find(c => c.id === requiredId)) {
          candidates.push(skill);
        }
      }
    }

    // Resolve dependencies
    const resolved = this.resolveDependencies(candidates);

    // Check for conflicts
    const conflictFree = this.removeConflicts(resolved, excluded);

    // Sort by priority
    const sorted = this.sortByPriority(conflictFree);

    // Apply token budget
    const selected = this.applyTokenBudget(sorted, criteria.maxTokens, excluded);

    return {
      skills: selected,
      totalTokens: selected.reduce((sum, s) => sum + s.tokenBudget, 0),
      excluded,
    };
  }

  /**
   * Resolve skill dependencies
   */
  private resolveDependencies(skills: LoadedSkill[]): LoadedSkill[] {
    const result = new Map<string, LoadedSkill>();
    const visited = new Set<string>();

    const addWithDeps = (skill: LoadedSkill) => {
      if (visited.has(skill.id)) return;
      visited.add(skill.id);

      // Add dependencies first
      for (const depId of skill.requiredSkills) {
        const dep = this.skills.get(depId);
        if (dep) {
          addWithDeps(dep);
        }
      }

      result.set(skill.id, skill);
    };

    for (const skill of skills) {
      addWithDeps(skill);
    }

    return Array.from(result.values());
  }

  /**
   * Remove conflicting skills
   */
  private removeConflicts(
    skills: LoadedSkill[],
    excluded: Array<{ skill: LoadedSkill; reason: string }>
  ): LoadedSkill[] {
    const result: LoadedSkill[] = [];
    const includedIds = new Set<string>();

    // Sort by priority first so higher priority wins
    const sorted = [...skills].sort(
      (a, b) => PRIORITY_WEIGHTS[b.priority] - PRIORITY_WEIGHTS[a.priority]
    );

    for (const skill of sorted) {
      // Check if any included skill conflicts with this one
      const hasConflict = skill.conflictingSkills.some(id => includedIds.has(id));

      if (hasConflict) {
        excluded.push({ skill, reason: 'conflicts with higher priority skill' });
        continue;
      }

      result.push(skill);
      includedIds.add(skill.id);
    }

    return result;
  }

  /**
   * Sort skills by priority
   */
  private sortByPriority(skills: LoadedSkill[]): LoadedSkill[] {
    return [...skills].sort(
      (a, b) => PRIORITY_WEIGHTS[b.priority] - PRIORITY_WEIGHTS[a.priority]
    );
  }

  /**
   * Apply token budget constraint
   */
  private applyTokenBudget(
    skills: LoadedSkill[],
    maxTokens: number | undefined,
    excluded: Array<{ skill: LoadedSkill; reason: string }>
  ): LoadedSkill[] {
    if (!maxTokens) {
      return skills;
    }

    const result: LoadedSkill[] = [];
    let totalTokens = 0;

    for (const skill of skills) {
      if (totalTokens + skill.tokenBudget <= maxTokens) {
        result.push(skill);
        totalTokens += skill.tokenBudget;
      } else if (skill.priority === 'critical') {
        // Critical skills always included even if over budget
        result.push(skill);
        totalTokens += skill.tokenBudget;
        logger.warn('Token budget exceeded for critical skill', {
          skillId: skill.id,
          budget: maxTokens,
          current: totalTokens,
        });
      } else {
        excluded.push({ skill, reason: 'token budget exceeded' });
      }
    }

    return result;
  }

  /**
   * Get skills by category
   */
  getByCategory(category: SkillCategory): LoadedSkill[] {
    const ids = this.byCategory.get(category) || new Set();
    return Array.from(ids).map(id => this.skills.get(id)!);
  }

  /**
   * Get skills by agent
   */
  getByAgent(agent: AgentType): LoadedSkill[] {
    const ids = this.byAgent.get(agent) || new Set();
    return Array.from(ids).map(id => this.skills.get(id)!);
  }

  /**
   * Clear registry
   */
  clear(): void {
    this.skills.clear();
    this.byCategory.clear();
    this.byAgent.clear();
    this.byTag.clear();
  }
}
```

---

## 4. Skill Injector (`src/skills/skill-injector.ts`)

```typescript
/**
 * Skill Injector
 *
 * Injects selected skills into agent prompts.
 */

import {
  LoadedSkill,
  SkillInjection,
  SkillSelectionCriteria,
  SelectedSkills,
} from './types';
import { SkillRegistry } from './skill-registry';
import { logger } from '../utils/logger';

/**
 * Injection format options
 */
export type InjectionFormat = 'markdown' | 'xml' | 'plain';

/**
 * Skill Injector configuration
 */
export interface SkillInjectorConfig {
  format: InjectionFormat;
  includeExamples: boolean;
  maxExamplesPerSkill: number;
  sectionHeader: string;
}

const DEFAULT_CONFIG: SkillInjectorConfig = {
  format: 'markdown',
  includeExamples: true,
  maxExamplesPerSkill: 2,
  sectionHeader: 'Skills & Capabilities',
};

/**
 * Skill Injector implementation
 */
export class SkillInjector {
  private registry: SkillRegistry;
  private config: SkillInjectorConfig;

  constructor(registry: SkillRegistry, config: Partial<SkillInjectorConfig> = {}) {
    this.registry = registry;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Select and inject skills based on criteria
   */
  inject(criteria: SkillSelectionCriteria): SkillInjection {
    const selected = this.registry.select(criteria);
    return this.format(selected.skills);
  }

  /**
   * Inject specific skills by ID
   */
  injectById(skillIds: string[]): SkillInjection {
    const skills: LoadedSkill[] = [];

    for (const id of skillIds) {
      const skill = this.registry.get(id);
      if (skill) {
        skills.push(skill);
      } else {
        logger.warn('Skill not found', { skillId: id });
      }
    }

    return this.format(skills);
  }

  /**
   * Format skills for injection
   */
  private format(skills: LoadedSkill[]): SkillInjection {
    if (skills.length === 0) {
      return { content: '', tokenCount: 0, skills: [] };
    }

    let content: string;

    switch (this.config.format) {
      case 'markdown':
        content = this.formatMarkdown(skills);
        break;
      case 'xml':
        content = this.formatXml(skills);
        break;
      case 'plain':
        content = this.formatPlain(skills);
        break;
      default:
        content = this.formatMarkdown(skills);
    }

    // Estimate token count (rough approximation: ~4 chars per token)
    const tokenCount = Math.ceil(content.length / 4);

    return {
      content,
      tokenCount,
      skills: skills.map(s => s.id),
    };
  }

  /**
   * Format as markdown
   */
  private formatMarkdown(skills: LoadedSkill[]): string {
    const lines: string[] = [];

    lines.push(`## ${this.config.sectionHeader}`);
    lines.push('');

    for (const skill of skills) {
      lines.push(`### ${skill.name}`);
      lines.push('');
      lines.push(skill.instructions);
      lines.push('');

      if (this.config.includeExamples && skill.examples) {
        const examples = skill.examples.slice(0, this.config.maxExamplesPerSkill);
        if (examples.length > 0) {
          lines.push('**Examples:**');
          lines.push('');
          for (const example of examples) {
            lines.push(`*${example.scenario}*`);
            lines.push('```');
            lines.push(`Input: ${example.input}`);
            lines.push(`Output: ${example.output}`);
            lines.push('```');
            lines.push('');
          }
        }
      }
    }

    return lines.join('\n');
  }

  /**
   * Format as XML
   */
  private formatXml(skills: LoadedSkill[]): string {
    const lines: string[] = [];

    lines.push(`<${this.config.sectionHeader.toLowerCase().replace(/\s+/g, '-')}>`);

    for (const skill of skills) {
      lines.push(`  <skill id="${skill.id}" category="${skill.category}">`);
      lines.push(`    <name>${skill.name}</name>`);
      lines.push(`    <instructions>${this.escapeXml(skill.instructions)}</instructions>`);

      if (this.config.includeExamples && skill.examples) {
        const examples = skill.examples.slice(0, this.config.maxExamplesPerSkill);
        if (examples.length > 0) {
          lines.push('    <examples>');
          for (const example of examples) {
            lines.push(`      <example scenario="${this.escapeXml(example.scenario)}">`);
            lines.push(`        <input>${this.escapeXml(example.input)}</input>`);
            lines.push(`        <output>${this.escapeXml(example.output)}</output>`);
            lines.push('      </example>');
          }
          lines.push('    </examples>');
        }
      }

      lines.push('  </skill>');
    }

    lines.push(`</${this.config.sectionHeader.toLowerCase().replace(/\s+/g, '-')}>`);

    return lines.join('\n');
  }

  /**
   * Format as plain text
   */
  private formatPlain(skills: LoadedSkill[]): string {
    const lines: string[] = [];

    lines.push(this.config.sectionHeader.toUpperCase());
    lines.push('='.repeat(this.config.sectionHeader.length));
    lines.push('');

    for (const skill of skills) {
      lines.push(`[${skill.name}]`);
      lines.push(skill.instructions);
      lines.push('');

      if (this.config.includeExamples && skill.examples) {
        const examples = skill.examples.slice(0, this.config.maxExamplesPerSkill);
        for (const example of examples) {
          lines.push(`Example: ${example.scenario}`);
          lines.push(`  Input: ${example.input}`);
          lines.push(`  Output: ${example.output}`);
          lines.push('');
        }
      }

      lines.push('-'.repeat(40));
      lines.push('');
    }

    return lines.join('\n');
  }

  /**
   * Escape XML special characters
   */
  private escapeXml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }
}
```

---

## 5. Built-in Skills (`src/skills/built-in/`)

### 5.1 Coding Skills (`src/skills/built-in/coding.json`)

```json
{
  "id": "coding-pack",
  "name": "Coding Skills Pack",
  "version": "1.0.0",
  "description": "Core coding skills for code generation and manipulation",
  "skills": [
    {
      "id": "clean-code",
      "name": "Clean Code Practices",
      "version": "1.0.0",
      "description": "Write clean, maintainable code",
      "category": "coding",
      "tags": ["code-quality", "maintainability", "best-practices"],
      "instructions": "Follow clean code principles:\n- Use meaningful, descriptive names for variables, functions, and classes\n- Keep functions small and focused on a single responsibility\n- Avoid deep nesting; prefer early returns\n- Write self-documenting code; comments explain 'why', not 'what'\n- Follow DRY (Don't Repeat Yourself) but avoid premature abstraction\n- Keep related code together\n- Make the code read like well-written prose",
      "examples": [
        {
          "scenario": "Naming a function",
          "input": "function calc(x, y) { return x * y * 0.15; }",
          "output": "function calculateSalesTax(price: number, quantity: number): number { return price * quantity * TAX_RATE; }"
        }
      ],
      "tokenBudget": 200,
      "priority": "high",
      "applicableAgents": ["frontend_developer", "backend_developer"],
      "requiredSkills": [],
      "conflictingSkills": []
    },
    {
      "id": "error-handling",
      "name": "Error Handling",
      "version": "1.0.0",
      "description": "Proper error handling patterns",
      "category": "coding",
      "tags": ["errors", "reliability", "robustness"],
      "instructions": "Implement robust error handling:\n- Use specific error types rather than generic errors\n- Include contextual information in error messages\n- Handle errors at the appropriate level\n- Use try-catch for expected failures, let unexpected errors propagate\n- Log errors with sufficient context for debugging\n- Provide user-friendly error messages separate from technical details\n- Consider error recovery strategies where appropriate",
      "tokenBudget": 180,
      "priority": "high",
      "applicableAgents": ["frontend_developer", "backend_developer"],
      "requiredSkills": [],
      "conflictingSkills": []
    },
    {
      "id": "typescript-strict",
      "name": "TypeScript Strict Mode",
      "version": "1.0.0",
      "description": "TypeScript best practices with strict mode",
      "category": "coding",
      "tags": ["typescript", "types", "strict"],
      "instructions": "Write TypeScript with strict mode in mind:\n- Always provide explicit types for function parameters and returns\n- Avoid 'any' type; use 'unknown' for truly unknown types\n- Use discriminated unions for complex state\n- Leverage type inference where it improves readability\n- Use readonly for immutable data\n- Define interfaces for object shapes\n- Use generics for reusable type-safe code",
      "tokenBudget": 200,
      "priority": "high",
      "applicableAgents": ["frontend_developer", "backend_developer"],
      "requiredSkills": [],
      "conflictingSkills": [],
      "conditions": {
        "languages": ["typescript"]
      }
    }
  ]
}
```

### 5.2 Testing Skills (`src/skills/built-in/testing.json`)

```json
{
  "id": "testing-pack",
  "name": "Testing Skills Pack",
  "version": "1.0.0",
  "description": "Skills for writing effective tests",
  "skills": [
    {
      "id": "unit-testing",
      "name": "Unit Testing",
      "version": "1.0.0",
      "description": "Write effective unit tests",
      "category": "testing",
      "tags": ["unit-tests", "isolation", "mocking"],
      "instructions": "Write effective unit tests:\n- Test one thing per test case\n- Use descriptive test names that explain the expected behavior\n- Follow Arrange-Act-Assert pattern\n- Mock external dependencies to isolate the unit under test\n- Test edge cases and error conditions\n- Keep tests independent and deterministic\n- Aim for high coverage of business logic, not 100% line coverage",
      "examples": [
        {
          "scenario": "Testing a validation function",
          "input": "Test email validation",
          "output": "describe('validateEmail', () => {\n  it('should return true for valid email addresses', () => {\n    expect(validateEmail('user@example.com')).toBe(true);\n  });\n  it('should return false for email without domain', () => {\n    expect(validateEmail('user@')).toBe(false);\n  });\n});"
        }
      ],
      "tokenBudget": 250,
      "priority": "high",
      "applicableAgents": ["tester", "frontend_developer", "backend_developer"],
      "requiredSkills": [],
      "conflictingSkills": []
    },
    {
      "id": "integration-testing",
      "name": "Integration Testing",
      "version": "1.0.0",
      "description": "Write integration tests",
      "category": "testing",
      "tags": ["integration-tests", "api-testing", "database-testing"],
      "instructions": "Write effective integration tests:\n- Test the interaction between components\n- Use realistic test data\n- Set up and tear down test environment properly\n- Test happy paths and error scenarios\n- Consider test execution order and isolation\n- Use test databases or containers for data layer tests\n- Mock external services at network boundaries",
      "tokenBudget": 200,
      "priority": "medium",
      "applicableAgents": ["tester", "backend_developer"],
      "requiredSkills": [],
      "conflictingSkills": []
    }
  ]
}
```

### 5.3 Security Skills (`src/skills/built-in/security.json`)

```json
{
  "id": "security-pack",
  "name": "Security Skills Pack",
  "version": "1.0.0",
  "description": "Security-focused coding skills",
  "skills": [
    {
      "id": "input-validation",
      "name": "Input Validation",
      "version": "1.0.0",
      "description": "Secure input validation",
      "category": "security",
      "tags": ["validation", "sanitization", "security"],
      "instructions": "Implement secure input validation:\n- Validate all input on the server side, never trust client validation alone\n- Use allowlists over denylists when possible\n- Validate input type, length, format, and range\n- Sanitize output based on context (HTML, SQL, shell, etc.)\n- Use parameterized queries for database operations\n- Escape special characters appropriately\n- Reject invalid input rather than attempting to fix it",
      "tokenBudget": 200,
      "priority": "critical",
      "applicableAgents": ["backend_developer", "frontend_developer", "compliance_agent"],
      "requiredSkills": [],
      "conflictingSkills": []
    },
    {
      "id": "authentication",
      "name": "Authentication Best Practices",
      "version": "1.0.0",
      "description": "Secure authentication implementation",
      "category": "security",
      "tags": ["auth", "passwords", "sessions"],
      "instructions": "Implement secure authentication:\n- Use proven authentication libraries rather than custom implementations\n- Hash passwords with bcrypt, scrypt, or Argon2\n- Implement proper session management\n- Use secure, httpOnly, sameSite cookies for session tokens\n- Implement account lockout after failed attempts\n- Use constant-time comparison for secrets\n- Support MFA where appropriate\n- Log authentication events for audit trails",
      "tokenBudget": 250,
      "priority": "critical",
      "applicableAgents": ["backend_developer", "compliance_agent"],
      "requiredSkills": [],
      "conflictingSkills": []
    },
    {
      "id": "secrets-management",
      "name": "Secrets Management",
      "version": "1.0.0",
      "description": "Secure handling of secrets",
      "category": "security",
      "tags": ["secrets", "credentials", "environment"],
      "instructions": "Manage secrets securely:\n- Never hardcode secrets in source code\n- Use environment variables or secret management systems\n- Don't log secrets or sensitive data\n- Rotate secrets regularly\n- Use different secrets for different environments\n- Encrypt secrets at rest\n- Limit secret access to only what's needed",
      "tokenBudget": 180,
      "priority": "critical",
      "applicableAgents": ["backend_developer", "devops", "compliance_agent"],
      "requiredSkills": [],
      "conflictingSkills": []
    }
  ]
}
```

---

## 6. Skills Index (`src/skills/index.ts`)

```typescript
/**
 * Skills Framework
 *
 * Export all skills-related functionality.
 */

export * from './types';
export * from './skill-loader';
export * from './skill-registry';
export * from './skill-injector';

import { SkillLoader, SkillLoaderConfig } from './skill-loader';
import { SkillRegistry } from './skill-registry';
import { SkillInjector, SkillInjectorConfig } from './skill-injector';

/**
 * Create and initialize the skills system
 */
export async function createSkillsSystem(
  loaderConfig: SkillLoaderConfig,
  injectorConfig?: Partial<SkillInjectorConfig>
): Promise<{
  loader: SkillLoader;
  registry: SkillRegistry;
  injector: SkillInjector;
}> {
  const loader = new SkillLoader(loaderConfig);
  const registry = new SkillRegistry();
  const injector = new SkillInjector(registry, injectorConfig);

  // Load all skills
  await loader.loadAll();

  // Register loaded skills
  registry.registerAll(loader.getAllSkills());

  return { loader, registry, injector };
}
```

---

## Test Scenarios

```typescript
// tests/skills/skill-registry.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { SkillRegistry } from '../../src/skills/skill-registry';
import { LoadedSkill, SkillCategory } from '../../src/skills/types';
import { AgentType } from '../../src/agents/types';

describe('SkillRegistry', () => {
  let registry: SkillRegistry;

  const mockSkill: LoadedSkill = {
    id: 'test-skill',
    name: 'Test Skill',
    version: '1.0.0',
    description: 'A test skill',
    category: 'coding',
    tags: ['test', 'demo'],
    instructions: 'Test instructions',
    tokenBudget: 100,
    priority: 'medium',
    applicableAgents: [AgentType.BACKEND_DEVELOPER],
    requiredSkills: [],
    conflictingSkills: [],
    packId: 'test-pack',
    loadedAt: new Date(),
    source: 'built-in',
  };

  beforeEach(() => {
    registry = new SkillRegistry();
  });

  it('should register and retrieve skills', () => {
    registry.register(mockSkill);
    expect(registry.get('test-skill')).toEqual(mockSkill);
  });

  it('should select skills by agent type', () => {
    registry.register(mockSkill);
    const selected = registry.select({
      agentType: AgentType.BACKEND_DEVELOPER,
    });
    expect(selected.skills).toHaveLength(1);
    expect(selected.skills[0].id).toBe('test-skill');
  });

  it('should respect token budget', () => {
    registry.register(mockSkill);
    const selected = registry.select({
      agentType: AgentType.BACKEND_DEVELOPER,
      maxTokens: 50,
    });
    expect(selected.skills).toHaveLength(0);
    expect(selected.excluded).toHaveLength(1);
  });

  it('should handle skill conflicts', () => {
    const skill1: LoadedSkill = {
      ...mockSkill,
      id: 'skill-1',
      priority: 'high',
      conflictingSkills: ['skill-2'],
    };
    const skill2: LoadedSkill = {
      ...mockSkill,
      id: 'skill-2',
      priority: 'low',
    };

    registry.register(skill1);
    registry.register(skill2);

    const selected = registry.select({
      agentType: AgentType.BACKEND_DEVELOPER,
    });

    // Higher priority skill should win
    expect(selected.skills.find(s => s.id === 'skill-1')).toBeDefined();
    expect(selected.excluded.find(e => e.skill.id === 'skill-2')).toBeDefined();
  });
});
```

---

## Validation Checklist

```
□ Core types defined
□ Skill loader implemented
□ Skill registry with selection logic
□ Skill injector with multiple formats
□ Built-in coding skills pack
□ Built-in testing skills pack
□ Built-in security skills pack
□ Dependency resolution works
□ Conflict detection works
□ Token budget enforcement works
□ All tests pass
```

---

## Next Step

Proceed to **06b-MCP-SERVER-CONFIG.md** to implement MCP server configuration.
