/**
 * Skill Registry
 *
 * Manages skill registration, selection, and dependency resolution.
 * Uses topological sort for dependency ordering and detects conflicts.
 */

import { logger } from '../utils/logger.js';
import { getSkillLoader } from './skill-loader.js';
import type {
  Skill,
  SkillMatchContext,
  SkillSelectionResult,
  SkillCondition,
  SkillPriority,
  SkillEvent,
} from './types.js';
import { PRIORITY_WEIGHTS } from './types.js';

const log = logger.child({ component: 'skill-registry' });

/**
 * Skill registry for selection and conflict detection
 */
export class SkillRegistry {
  private static instance: SkillRegistry | null = null;
  private eventListeners: Array<(event: SkillEvent) => void> = [];

  private constructor() {}

  /**
   * Get singleton instance
   */
  static getInstance(): SkillRegistry {
    if (!SkillRegistry.instance) {
      SkillRegistry.instance = new SkillRegistry();
    }
    return SkillRegistry.instance;
  }

  /**
   * Reset singleton (for testing)
   */
  static reset(): void {
    SkillRegistry.instance = null;
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
   * Select skills based on context and budget
   */
  selectSkills(
    context: SkillMatchContext,
    tokenBudget: number = 4000
  ): SkillSelectionResult {
    const loader = getSkillLoader();
    const allSkills = loader.getAllSkills().filter((s) => s.enabled);

    // Match skills to context
    const matchedSkills = allSkills.filter((skill) =>
      this.matchesContext(skill, context)
    );

    log.debug('Matched skills to context', {
      total: allSkills.length,
      matched: matchedSkills.length,
    });

    // Sort by priority
    const sortedSkills = this.sortByPriority(matchedSkills);

    // Resolve dependencies
    const { ordered, unresolved } = this.resolveDependencies(sortedSkills);

    // Detect and handle conflicts
    const { selected, excludedByConflict } = this.handleConflicts(ordered);

    // Apply token budget
    const { withinBudget, excludedByBudget, totalTokens } = this.applyBudget(
      selected,
      tokenBudget
    );

    // Emit selection event
    this.emit({
      type: 'skill:selected',
      message: `Selected ${withinBudget.length} skills`,
      data: {
        selected: withinBudget.map((s) => s.id),
        excludedByBudget: excludedByBudget.map((s) => s.id),
        excludedByConflict: excludedByConflict.map((s) => s.id),
        totalTokens,
      },
    });

    return {
      skills: withinBudget,
      totalTokens,
      excludedByBudget,
      excludedByConflict,
      unresolved,
    };
  }

  /**
   * Check if a skill matches the given context
   */
  matchesContext(skill: Skill, context: SkillMatchContext): boolean {
    // If no conditions, always matches
    if (skill.conditions.length === 0) {
      return true;
    }

    // All conditions must match (AND logic)
    return skill.conditions.every((condition) =>
      this.evaluateCondition(condition, context)
    );
  }

  /**
   * Evaluate a single condition against context
   */
  evaluateCondition(condition: SkillCondition, context: SkillMatchContext): boolean {
    const fieldValue = this.getFieldValue(condition.field, context);

    switch (condition.operator) {
      case 'equals':
        return this.equalsCheck(fieldValue, condition.value);

      case 'contains':
        return this.containsCheck(fieldValue, condition.value);

      case 'matches':
        return this.matchesCheck(fieldValue, condition.value as string);

      case 'exists':
        return fieldValue !== undefined && fieldValue !== null;

      case 'not':
        return !this.equalsCheck(fieldValue, condition.value);

      default:
        log.warn('Unknown condition operator', { operator: condition.operator });
        return false;
    }
  }

  /**
   * Get a field value from context, supporting dot notation
   */
  private getFieldValue(field: string, context: SkillMatchContext): unknown {
    const parts = field.split('.');
    let value: unknown = context;

    for (const part of parts) {
      if (value === null || value === undefined) {
        return undefined;
      }
      value = (value as Record<string, unknown>)[part];
    }

    return value;
  }

  /**
   * Check equality (supports arrays)
   */
  private equalsCheck(fieldValue: unknown, conditionValue: unknown): boolean {
    if (Array.isArray(fieldValue)) {
      if (Array.isArray(conditionValue)) {
        return conditionValue.some((v) => fieldValue.includes(v));
      }
      return fieldValue.includes(conditionValue);
    }

    if (Array.isArray(conditionValue)) {
      return conditionValue.includes(fieldValue);
    }

    return fieldValue === conditionValue;
  }

  /**
   * Check if field contains value (for strings/arrays)
   */
  private containsCheck(fieldValue: unknown, conditionValue: unknown): boolean {
    if (typeof fieldValue === 'string' && typeof conditionValue === 'string') {
      return fieldValue.toLowerCase().includes(conditionValue.toLowerCase());
    }

    if (Array.isArray(fieldValue)) {
      if (Array.isArray(conditionValue)) {
        return conditionValue.some((v) =>
          fieldValue.some((fv) =>
            typeof fv === 'string' && typeof v === 'string'
              ? fv.toLowerCase().includes(v.toLowerCase())
              : fv === v
          )
        );
      }
      return fieldValue.some((v) =>
        typeof v === 'string' && typeof conditionValue === 'string'
          ? v.toLowerCase().includes(conditionValue.toLowerCase())
          : v === conditionValue
      );
    }

    return false;
  }

  /**
   * Check if field matches regex pattern
   */
  private matchesCheck(fieldValue: unknown, pattern: string): boolean {
    if (typeof fieldValue !== 'string') {
      return false;
    }

    try {
      const regex = new RegExp(pattern, 'i');
      return regex.test(fieldValue);
    } catch {
      log.warn('Invalid regex pattern', { pattern });
      return false;
    }
  }

  /**
   * Sort skills by priority (higher priority first)
   */
  sortByPriority(skills: Skill[]): Skill[] {
    return [...skills].sort((a, b) => {
      const weightA = PRIORITY_WEIGHTS[a.priority];
      const weightB = PRIORITY_WEIGHTS[b.priority];
      return weightB - weightA;
    });
  }

  /**
   * Resolve dependencies using topological sort
   */
  resolveDependencies(skills: Skill[]): { ordered: Skill[]; unresolved: string[] } {
    const skillMap = new Map<string, Skill>();
    const loader = getSkillLoader();

    // Build skill map
    for (const skill of skills) {
      skillMap.set(skill.id, skill);
    }

    // Track visit state for cycle detection
    const visiting = new Set<string>();
    const visited = new Set<string>();
    const ordered: Skill[] = [];
    const unresolved: string[] = [];

    // Topological sort with DFS
    const visit = (skillId: string): void => {
      if (visited.has(skillId)) return;

      if (visiting.has(skillId)) {
        log.warn('Circular dependency detected', { skillId });
        return;
      }

      const skill = skillMap.get(skillId) || loader.getSkill(skillId);
      if (!skill) {
        unresolved.push(skillId);
        return;
      }

      visiting.add(skillId);

      // Visit dependencies first
      for (const depId of skill.dependencies) {
        visit(depId);
      }

      visiting.delete(skillId);
      visited.add(skillId);

      // Only add if it was in our original list
      if (skillMap.has(skillId)) {
        ordered.push(skill);
      }
    };

    // Visit all skills
    for (const skill of skills) {
      visit(skill.id);
    }

    return { ordered, unresolved };
  }

  /**
   * Handle skill conflicts
   */
  handleConflicts(skills: Skill[]): {
    selected: Skill[];
    excludedByConflict: Skill[];
  } {
    const selected: Skill[] = [];
    const excludedByConflict: Skill[] = [];
    const selectedIds = new Set<string>();

    for (const skill of skills) {
      // Check if this skill conflicts with any already selected
      const hasConflict = skill.conflicts.some((conflictId) =>
        selectedIds.has(conflictId)
      );

      // Check if any selected skill conflicts with this one
      const conflictsWithSelected = selected.some((s) =>
        s.conflicts.includes(skill.id)
      );

      if (hasConflict || conflictsWithSelected) {
        excludedByConflict.push(skill);
        this.emit({
          type: 'skill:conflict',
          skillId: skill.id,
          message: `Skill ${skill.id} conflicts with selected skills`,
        });
      } else {
        selected.push(skill);
        selectedIds.add(skill.id);
      }
    }

    return { selected, excludedByConflict };
  }

  /**
   * Apply token budget constraint
   */
  applyBudget(
    skills: Skill[],
    budget: number
  ): {
    withinBudget: Skill[];
    excludedByBudget: Skill[];
    totalTokens: number;
  } {
    const withinBudget: Skill[] = [];
    const excludedByBudget: Skill[] = [];
    let totalTokens = 0;

    for (const skill of skills) {
      if (totalTokens + skill.tokenEstimate <= budget) {
        withinBudget.push(skill);
        totalTokens += skill.tokenEstimate;
      } else {
        excludedByBudget.push(skill);
      }
    }

    return { withinBudget, excludedByBudget, totalTokens };
  }

  /**
   * Get skills by category
   */
  getByCategory(category: string): Skill[] {
    const loader = getSkillLoader();
    return loader.getAllSkills().filter((s) => s.category === category);
  }

  /**
   * Get skills by tags
   */
  getByTags(tags: string[]): Skill[] {
    const loader = getSkillLoader();
    return loader.getAllSkills().filter((s) =>
      tags.some((tag) => s.tags.includes(tag))
    );
  }

  /**
   * Get skills by priority
   */
  getByPriority(priority: SkillPriority): Skill[] {
    const loader = getSkillLoader();
    return loader.getAllSkills().filter((s) => s.priority === priority);
  }

  /**
   * Find skills that would conflict with the given skill
   */
  findConflicts(skillId: string): Skill[] {
    const loader = getSkillLoader();
    const skill = loader.getSkill(skillId);
    if (!skill) return [];

    const conflicts: Skill[] = [];
    const allSkills = loader.getAllSkills();

    for (const other of allSkills) {
      if (other.id === skillId) continue;

      // Check bidirectional conflicts
      if (skill.conflicts.includes(other.id) || other.conflicts.includes(skillId)) {
        conflicts.push(other);
      }
    }

    return conflicts;
  }

  /**
   * Get dependency chain for a skill
   */
  getDependencyChain(skillId: string): string[] {
    const loader = getSkillLoader();
    const chain: string[] = [];
    const visited = new Set<string>();

    const collect = (id: string): void => {
      if (visited.has(id)) return;
      visited.add(id);

      const skill = loader.getSkill(id);
      if (!skill) return;

      for (const depId of skill.dependencies) {
        collect(depId);
      }

      chain.push(id);
    };

    collect(skillId);

    // Remove the original skill from the chain (only deps)
    return chain.filter((id) => id !== skillId);
  }
}

/**
 * Get skill registry singleton
 */
export function getSkillRegistry(): SkillRegistry {
  return SkillRegistry.getInstance();
}

/**
 * Reset skill registry (for testing)
 */
export function resetSkillRegistry(): void {
  SkillRegistry.reset();
}
