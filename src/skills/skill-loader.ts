/**
 * Skill Loader
 *
 * Loads and validates skill packs from various sources.
 */

import { existsSync, readdirSync, readFileSync } from 'fs';
import { join, extname } from 'path';
import { logger } from '../utils/logger.js';
import type {
  Skill,
  SkillPack,
  SkillLoaderConfig,
  SkillValidationResult,
  SkillEvent,
} from './types.js';
import { DEFAULT_LOADER_CONFIG } from './types.js';

const log = logger.child({ component: 'skill-loader' });

/**
 * Skill loader singleton
 */
export class SkillLoader {
  private static instance: SkillLoader | null = null;
  private config: SkillLoaderConfig;
  private loadedPacks: Map<string, SkillPack> = new Map();
  private eventListeners: Array<(event: SkillEvent) => void> = [];

  private constructor(config: Partial<SkillLoaderConfig> = {}) {
    this.config = { ...DEFAULT_LOADER_CONFIG, ...config };
  }

  /**
   * Get singleton instance
   */
  static getInstance(config?: Partial<SkillLoaderConfig>): SkillLoader {
    if (!SkillLoader.instance) {
      SkillLoader.instance = new SkillLoader(config);
    }
    return SkillLoader.instance;
  }

  /**
   * Reset singleton (for testing)
   */
  static reset(): void {
    SkillLoader.instance = null;
  }

  /**
   * Add event listener
   */
  on(listener: (event: SkillEvent) => void): void {
    this.eventListeners.push(listener);
  }

  /**
   * Emit skill event
   */
  private emit(event: Omit<SkillEvent, 'timestamp'>): void {
    const fullEvent: SkillEvent = { ...event, timestamp: new Date() };
    this.eventListeners.forEach((listener) => listener(fullEvent));
  }

  /**
   * Load a skill pack from object
   */
  loadPack(pack: SkillPack): SkillValidationResult {
    const result = this.validatePack(pack);

    if (result.valid || result.warnings.length > 0) {
      this.loadedPacks.set(pack.id, pack);
      this.emit({
        type: 'skill:loaded',
        packId: pack.id,
        message: `Loaded skill pack: ${pack.name}`,
        data: { skillCount: pack.skills.length },
      });
      log.info('Loaded skill pack', { packId: pack.id, skills: pack.skills.length });
    }

    return result;
  }

  /**
   * Load skill pack from JSON file
   */
  loadFromFile(filePath: string): SkillValidationResult {
    if (!existsSync(filePath)) {
      return {
        valid: false,
        errors: [`File not found: ${filePath}`],
        warnings: [],
      };
    }

    try {
      const content = readFileSync(filePath, 'utf-8');
      const pack = JSON.parse(content) as SkillPack;
      return this.loadPack(pack);
    } catch (error) {
      return {
        valid: false,
        errors: [`Failed to parse skill pack: ${error instanceof Error ? error.message : String(error)}`],
        warnings: [],
      };
    }
  }

  /**
   * Load all skill packs from a directory
   */
  loadFromDirectory(dirPath: string): Map<string, SkillValidationResult> {
    const results = new Map<string, SkillValidationResult>();

    if (!existsSync(dirPath)) {
      log.warn('Skill directory not found', { path: dirPath });
      return results;
    }

    const files = readdirSync(dirPath);
    for (const file of files) {
      if (extname(file) === '.json') {
        const filePath = join(dirPath, file);
        results.set(filePath, this.loadFromFile(filePath));
      }
    }

    return results;
  }

  /**
   * Load skills from all configured search paths
   */
  loadAll(): void {
    for (const searchPath of this.config.searchPaths) {
      this.loadFromDirectory(searchPath);
    }
  }

  /**
   * Get a loaded skill pack
   */
  getPack(packId: string): SkillPack | undefined {
    return this.loadedPacks.get(packId);
  }

  /**
   * Get all loaded packs
   */
  getAllPacks(): SkillPack[] {
    return Array.from(this.loadedPacks.values());
  }

  /**
   * Get all skills across all packs
   */
  getAllSkills(): Skill[] {
    const skills: Skill[] = [];
    for (const pack of this.loadedPacks.values()) {
      skills.push(...pack.skills);
    }
    return skills;
  }

  /**
   * Get a specific skill by ID
   */
  getSkill(skillId: string): Skill | undefined {
    for (const pack of this.loadedPacks.values()) {
      const skill = pack.skills.find((s) => s.id === skillId);
      if (skill) return skill;
    }
    return undefined;
  }

  /**
   * Validate a skill pack
   */
  validatePack(pack: SkillPack): SkillValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate pack structure
    if (!pack.id) errors.push('Pack missing id');
    if (!pack.name) errors.push('Pack missing name');
    if (!pack.version) errors.push('Pack missing version');
    if (!Array.isArray(pack.skills)) errors.push('Pack missing skills array');

    if (errors.length > 0) {
      return { valid: false, errors, warnings };
    }

    // Validate each skill
    const skillIds = new Set<string>();
    for (const skill of pack.skills) {
      const skillResult = this.validateSkill(skill);
      errors.push(...skillResult.errors.map((e) => `Skill ${skill.id}: ${e}`));
      warnings.push(...skillResult.warnings.map((w) => `Skill ${skill.id}: ${w}`));

      if (skillIds.has(skill.id)) {
        errors.push(`Duplicate skill id: ${skill.id}`);
      }
      skillIds.add(skill.id);

      // Run custom validator if provided
      if (this.config.customValidator && !this.config.customValidator(skill)) {
        errors.push(`Skill ${skill.id} failed custom validation`);
      }
    }

    // Validate dependencies exist
    for (const skill of pack.skills) {
      for (const dep of skill.dependencies) {
        if (!skillIds.has(dep) && !this.getSkill(dep)) {
          warnings.push(`Skill ${skill.id} depends on unknown skill: ${dep}`);
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Validate a single skill
   */
  validateSkill(skill: Skill): SkillValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Required fields
    if (!skill.id) errors.push('Missing id');
    if (!skill.name) errors.push('Missing name');
    if (!skill.description) errors.push('Missing description');
    if (!skill.content) errors.push('Missing content');
    if (!skill.version) errors.push('Missing version');
    if (typeof skill.tokenEstimate !== 'number') errors.push('Missing or invalid tokenEstimate');

    // Validate category
    const validCategories = [
      'coding',
      'testing',
      'security',
      'documentation',
      'architecture',
      'devops',
      'debugging',
      'performance',
      'accessibility',
      'custom',
    ];
    if (!validCategories.includes(skill.category)) {
      errors.push(`Invalid category: ${skill.category}`);
    }

    // Validate priority
    const validPriorities = ['critical', 'high', 'medium', 'low'];
    if (!validPriorities.includes(skill.priority)) {
      errors.push(`Invalid priority: ${skill.priority}`);
    }

    // Validate conditions
    if (!Array.isArray(skill.conditions)) {
      errors.push('conditions must be an array');
    } else {
      for (const condition of skill.conditions) {
        const condResult = this.validateCondition(condition);
        errors.push(...condResult.errors);
        warnings.push(...condResult.warnings);
      }
    }

    // Validate arrays
    if (!Array.isArray(skill.dependencies)) errors.push('dependencies must be an array');
    if (!Array.isArray(skill.conflicts)) errors.push('conflicts must be an array');
    if (!Array.isArray(skill.tags)) errors.push('tags must be an array');

    // Warnings
    if (skill.tokenEstimate > 2000) {
      warnings.push(`High token estimate (${skill.tokenEstimate}), may impact budget`);
    }

    if (skill.content.length < 50) {
      warnings.push('Content seems very short');
    }

    // Emit validation event
    this.emit({
      type: 'skill:validated',
      skillId: skill.id,
      message: errors.length === 0 ? 'Skill validated' : 'Skill validation failed',
      data: { errors, warnings },
    });

    return { valid: errors.length === 0, errors, warnings };
  }

  /**
   * Validate a skill condition
   */
  private validateCondition(condition: unknown): SkillValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (typeof condition !== 'object' || condition === null) {
      errors.push('Condition must be an object');
      return { valid: false, errors, warnings };
    }

    const cond = condition as Record<string, unknown>;

    if (typeof cond.field !== 'string') {
      errors.push('Condition missing field');
    }

    const validOperators = ['equals', 'contains', 'matches', 'exists', 'not'];
    if (!validOperators.includes(cond.operator as string)) {
      errors.push(`Invalid condition operator: ${cond.operator}`);
    }

    return { valid: errors.length === 0, errors, warnings };
  }

  /**
   * Unload a skill pack
   */
  unloadPack(packId: string): boolean {
    return this.loadedPacks.delete(packId);
  }

  /**
   * Clear all loaded packs
   */
  clear(): void {
    this.loadedPacks.clear();
  }

  /**
   * Get loader statistics
   */
  getStats(): Record<string, unknown> {
    const packs = this.getAllPacks();
    const skills = this.getAllSkills();

    return {
      packsLoaded: packs.length,
      skillsLoaded: skills.length,
      byCategory: this.groupByCategory(skills),
      byPriority: this.groupByPriority(skills),
      totalTokens: skills.reduce((sum, s) => sum + s.tokenEstimate, 0),
    };
  }

  /**
   * Group skills by category
   */
  private groupByCategory(skills: Skill[]): Record<string, number> {
    const groups: Record<string, number> = {};
    for (const skill of skills) {
      groups[skill.category] = (groups[skill.category] || 0) + 1;
    }
    return groups;
  }

  /**
   * Group skills by priority
   */
  private groupByPriority(skills: Skill[]): Record<string, number> {
    const groups: Record<string, number> = {};
    for (const skill of skills) {
      groups[skill.priority] = (groups[skill.priority] || 0) + 1;
    }
    return groups;
  }
}

/**
 * Get skill loader singleton
 */
export function getSkillLoader(config?: Partial<SkillLoaderConfig>): SkillLoader {
  return SkillLoader.getInstance(config);
}

/**
 * Reset skill loader (for testing)
 */
export function resetSkillLoader(): void {
  SkillLoader.reset();
}
