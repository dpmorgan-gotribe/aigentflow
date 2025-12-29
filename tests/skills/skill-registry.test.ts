/**
 * Skill Registry Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  SkillRegistry,
  getSkillRegistry,
  resetSkillRegistry,
} from '../../src/skills/skill-registry.js';
import { getSkillLoader, resetSkillLoader } from '../../src/skills/skill-loader.js';
import type { Skill, SkillPack, SkillMatchContext } from '../../src/skills/types.js';

const createSkill = (id: string, overrides: Partial<Skill> = {}): Skill => ({
  id,
  name: `Skill ${id}`,
  description: 'Test skill',
  category: 'coding',
  priority: 'medium',
  version: '1.0.0',
  tokenEstimate: 100,
  conditions: [],
  dependencies: [],
  conflicts: [],
  content: 'Skill content',
  tags: [],
  enabled: true,
  ...overrides,
});

const createPack = (id: string, skills: Skill[]): SkillPack => ({
  id,
  name: `Pack ${id}`,
  description: 'Test pack',
  version: '1.0.0',
  skills,
});

describe('SkillRegistry', () => {
  beforeEach(() => {
    resetSkillLoader();
    resetSkillRegistry();
  });

  afterEach(() => {
    resetSkillLoader();
    resetSkillRegistry();
  });

  describe('Singleton', () => {
    it('should return singleton instance', () => {
      const reg1 = getSkillRegistry();
      const reg2 = getSkillRegistry();
      expect(reg1).toBe(reg2);
    });
  });

  describe('matchesContext', () => {
    it('should match skill with no conditions', () => {
      const registry = getSkillRegistry();
      const skill = createSkill('no-conditions', { conditions: [] });

      const matches = registry.matchesContext(skill, {});

      expect(matches).toBe(true);
    });

    it('should match equals condition', () => {
      const registry = getSkillRegistry();
      const skill = createSkill('equals-condition', {
        conditions: [{ field: 'taskType', operator: 'equals', value: 'feature' }],
      });

      expect(registry.matchesContext(skill, { taskType: 'feature' })).toBe(true);
      expect(registry.matchesContext(skill, { taskType: 'bugfix' })).toBe(false);
    });

    it('should match contains condition with array field', () => {
      const registry = getSkillRegistry();
      const skill = createSkill('contains-condition', {
        conditions: [{ field: 'languages', operator: 'contains', value: 'typescript' }],
      });

      expect(registry.matchesContext(skill, { languages: ['typescript', 'javascript'] })).toBe(true);
      expect(registry.matchesContext(skill, { languages: ['python'] })).toBe(false);
    });

    it('should match exists condition', () => {
      const registry = getSkillRegistry();
      const skill = createSkill('exists-condition', {
        conditions: [{ field: 'agentType', operator: 'exists' }],
      });

      expect(registry.matchesContext(skill, { agentType: 'orchestrator' })).toBe(true);
      expect(registry.matchesContext(skill, {})).toBe(false);
    });

    it('should match not condition', () => {
      const registry = getSkillRegistry();
      const skill = createSkill('not-condition', {
        conditions: [{ field: 'taskType', operator: 'not', value: 'research' }],
      });

      expect(registry.matchesContext(skill, { taskType: 'feature' })).toBe(true);
      expect(registry.matchesContext(skill, { taskType: 'research' })).toBe(false);
    });

    it('should match regex condition', () => {
      const registry = getSkillRegistry();
      const skill = createSkill('matches-condition', {
        conditions: [{ field: 'taskType', operator: 'matches', value: '^feat' }],
      });

      expect(registry.matchesContext(skill, { taskType: 'feature' })).toBe(true);
      expect(registry.matchesContext(skill, { taskType: 'bugfix' })).toBe(false);
    });

    it('should support dot notation for nested fields', () => {
      const registry = getSkillRegistry();
      const skill = createSkill('nested-condition', {
        conditions: [{ field: 'techStack.frontend', operator: 'contains', value: 'react' }],
      });

      const context: SkillMatchContext = {
        techStack: { frontend: ['react', 'vue'] },
      };

      expect(registry.matchesContext(skill, context)).toBe(true);
    });

    it('should require all conditions to match (AND logic)', () => {
      const registry = getSkillRegistry();
      const skill = createSkill('multi-condition', {
        conditions: [
          { field: 'taskType', operator: 'equals', value: 'feature' },
          { field: 'languages', operator: 'contains', value: 'typescript' },
        ],
      });

      expect(
        registry.matchesContext(skill, { taskType: 'feature', languages: ['typescript'] })
      ).toBe(true);
      expect(
        registry.matchesContext(skill, { taskType: 'feature', languages: ['python'] })
      ).toBe(false);
      expect(
        registry.matchesContext(skill, { taskType: 'bugfix', languages: ['typescript'] })
      ).toBe(false);
    });
  });

  describe('sortByPriority', () => {
    it('should sort skills by priority', () => {
      const registry = getSkillRegistry();
      const skills = [
        createSkill('low', { priority: 'low' }),
        createSkill('critical', { priority: 'critical' }),
        createSkill('medium', { priority: 'medium' }),
        createSkill('high', { priority: 'high' }),
      ];

      const sorted = registry.sortByPriority(skills);

      expect(sorted[0].id).toBe('critical');
      expect(sorted[1].id).toBe('high');
      expect(sorted[2].id).toBe('medium');
      expect(sorted[3].id).toBe('low');
    });
  });

  describe('resolveDependencies', () => {
    it('should order skills with dependencies first', () => {
      const registry = getSkillRegistry();
      const loader = getSkillLoader();

      const skillA = createSkill('skill-a', { dependencies: ['skill-b'] });
      const skillB = createSkill('skill-b', { dependencies: [] });

      loader.loadPack(createPack('test', [skillA, skillB]));

      const { ordered, unresolved } = registry.resolveDependencies([skillA, skillB]);

      expect(unresolved).toHaveLength(0);
      // skill-b should come before skill-a
      const indexA = ordered.findIndex((s) => s.id === 'skill-a');
      const indexB = ordered.findIndex((s) => s.id === 'skill-b');
      expect(indexB).toBeLessThan(indexA);
    });

    it('should detect unresolved dependencies', () => {
      const registry = getSkillRegistry();
      const loader = getSkillLoader();

      const skill = createSkill('skill-with-dep', { dependencies: ['unknown-skill'] });
      loader.loadPack(createPack('test', [skill]));

      const { unresolved } = registry.resolveDependencies([skill]);

      expect(unresolved).toContain('unknown-skill');
    });

    it('should handle circular dependencies gracefully', () => {
      const registry = getSkillRegistry();
      const loader = getSkillLoader();

      const skillA = createSkill('skill-a', { dependencies: ['skill-b'] });
      const skillB = createSkill('skill-b', { dependencies: ['skill-a'] });

      loader.loadPack(createPack('test', [skillA, skillB]));

      // Should not throw, but may not include both
      expect(() => registry.resolveDependencies([skillA, skillB])).not.toThrow();
    });
  });

  describe('handleConflicts', () => {
    it('should exclude conflicting skills', () => {
      const registry = getSkillRegistry();

      const skillA = createSkill('skill-a', { conflicts: ['skill-b'] });
      const skillB = createSkill('skill-b', { conflicts: [] });

      const { selected, excludedByConflict } = registry.handleConflicts([skillA, skillB]);

      expect(selected).toHaveLength(1);
      expect(selected[0].id).toBe('skill-a');
      expect(excludedByConflict).toHaveLength(1);
      expect(excludedByConflict[0].id).toBe('skill-b');
    });

    it('should respect bidirectional conflicts', () => {
      const registry = getSkillRegistry();

      const skillA = createSkill('skill-a', { conflicts: [] });
      const skillB = createSkill('skill-b', { conflicts: ['skill-a'] });

      const { selected, excludedByConflict } = registry.handleConflicts([skillA, skillB]);

      expect(selected).toHaveLength(1);
      expect(excludedByConflict).toHaveLength(1);
    });
  });

  describe('applyBudget', () => {
    it('should exclude skills over budget', () => {
      const registry = getSkillRegistry();
      const skills = [
        createSkill('small', { tokenEstimate: 100 }),
        createSkill('medium', { tokenEstimate: 200 }),
        createSkill('large', { tokenEstimate: 300 }),
      ];

      // Budget of 350: small (100) + medium (200) = 300, fits; large (300) would exceed
      const { withinBudget, excludedByBudget, totalTokens } = registry.applyBudget(skills, 350);

      expect(withinBudget).toHaveLength(2);
      expect(excludedByBudget).toHaveLength(1);
      expect(excludedByBudget[0].id).toBe('large');
      expect(totalTokens).toBe(300);
    });

    it('should respect budget exactly', () => {
      const registry = getSkillRegistry();
      const skills = [createSkill('exact', { tokenEstimate: 100 })];

      const { withinBudget, totalTokens } = registry.applyBudget(skills, 100);

      expect(withinBudget).toHaveLength(1);
      expect(totalTokens).toBe(100);
    });
  });

  describe('selectSkills', () => {
    it('should select matching skills within budget', () => {
      const registry = getSkillRegistry();
      const loader = getSkillLoader();

      loader.loadPack(
        createPack('test', [
          createSkill('typescript', {
            conditions: [{ field: 'languages', operator: 'contains', value: 'typescript' }],
            tokenEstimate: 200,
          }),
          createSkill('python', {
            conditions: [{ field: 'languages', operator: 'contains', value: 'python' }],
            tokenEstimate: 200,
          }),
        ])
      );

      const result = registry.selectSkills({ languages: ['typescript'] }, 1000);

      expect(result.skills).toHaveLength(1);
      expect(result.skills[0].id).toBe('typescript');
    });

    it('should exclude disabled skills', () => {
      const registry = getSkillRegistry();
      const loader = getSkillLoader();

      loader.loadPack(
        createPack('test', [
          createSkill('enabled', { enabled: true }),
          createSkill('disabled', { enabled: false }),
        ])
      );

      const result = registry.selectSkills({}, 1000);

      expect(result.skills).toHaveLength(1);
      expect(result.skills[0].id).toBe('enabled');
    });
  });

  describe('findConflicts', () => {
    it('should find skills that conflict with given skill', () => {
      const registry = getSkillRegistry();
      const loader = getSkillLoader();

      loader.loadPack(
        createPack('test', [
          createSkill('vitest', { conflicts: ['jest'] }),
          createSkill('jest', { conflicts: ['vitest'] }),
          createSkill('mocha', { conflicts: [] }),
        ])
      );

      const conflicts = registry.findConflicts('vitest');

      expect(conflicts).toHaveLength(1);
      expect(conflicts[0].id).toBe('jest');
    });
  });

  describe('getDependencyChain', () => {
    it('should return dependency chain', () => {
      const registry = getSkillRegistry();
      const loader = getSkillLoader();

      loader.loadPack(
        createPack('test', [
          createSkill('skill-a', { dependencies: ['skill-b'] }),
          createSkill('skill-b', { dependencies: ['skill-c'] }),
          createSkill('skill-c', { dependencies: [] }),
        ])
      );

      const chain = registry.getDependencyChain('skill-a');

      expect(chain).toContain('skill-b');
      expect(chain).toContain('skill-c');
      expect(chain).not.toContain('skill-a');
    });
  });
});
