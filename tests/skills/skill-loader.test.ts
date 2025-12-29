/**
 * Skill Loader Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  SkillLoader,
  getSkillLoader,
  resetSkillLoader,
} from '../../src/skills/skill-loader.js';
import type { Skill, SkillPack } from '../../src/skills/types.js';

const createValidSkill = (id: string, overrides: Partial<Skill> = {}): Skill => ({
  id,
  name: `Test Skill ${id}`,
  description: 'A test skill',
  category: 'coding',
  priority: 'medium',
  version: '1.0.0',
  tokenEstimate: 100,
  conditions: [],
  dependencies: [],
  conflicts: [],
  content: 'Test skill content for testing purposes',
  tags: ['test'],
  enabled: true,
  ...overrides,
});

const createValidPack = (id: string, skills: Skill[] = []): SkillPack => ({
  id,
  name: `Test Pack ${id}`,
  description: 'A test skill pack',
  version: '1.0.0',
  skills: skills.length > 0 ? skills : [createValidSkill('test-skill-1')],
});

describe('SkillLoader', () => {
  beforeEach(() => {
    resetSkillLoader();
  });

  afterEach(() => {
    resetSkillLoader();
  });

  describe('Singleton', () => {
    it('should return singleton instance', () => {
      const loader1 = getSkillLoader();
      const loader2 = getSkillLoader();
      expect(loader1).toBe(loader2);
    });

    it('should reset singleton', () => {
      const loader1 = getSkillLoader();
      resetSkillLoader();
      const loader2 = getSkillLoader();
      expect(loader1).not.toBe(loader2);
    });
  });

  describe('loadPack', () => {
    it('should load a valid skill pack', () => {
      const loader = getSkillLoader();
      const pack = createValidPack('test-pack');

      const result = loader.loadPack(pack);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(loader.getPack('test-pack')).toBeDefined();
    });

    it('should reject pack without id', () => {
      const loader = getSkillLoader();
      const pack = createValidPack('test-pack');
      // @ts-expect-error - intentionally invalid
      delete pack.id;

      const result = loader.loadPack(pack);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Pack missing id');
    });

    it('should reject pack without name', () => {
      const loader = getSkillLoader();
      const pack = createValidPack('test-pack');
      // @ts-expect-error - intentionally invalid
      delete pack.name;

      const result = loader.loadPack(pack);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Pack missing name');
    });

    it('should reject pack without skills array', () => {
      const loader = getSkillLoader();
      const pack = createValidPack('test-pack');
      // @ts-expect-error - intentionally invalid
      pack.skills = 'not an array';

      const result = loader.loadPack(pack);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Pack missing skills array');
    });

    it('should detect duplicate skill ids', () => {
      const loader = getSkillLoader();
      const pack = createValidPack('test-pack', [
        createValidSkill('duplicate-id'),
        createValidSkill('duplicate-id'),
      ]);

      const result = loader.loadPack(pack);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('Duplicate skill id'))).toBe(true);
    });
  });

  describe('validateSkill', () => {
    it('should validate a valid skill', () => {
      const loader = getSkillLoader();
      const skill = createValidSkill('valid-skill');

      const result = loader.validateSkill(skill);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject skill without id', () => {
      const loader = getSkillLoader();
      const skill = createValidSkill('test');
      // @ts-expect-error - intentionally invalid
      delete skill.id;

      const result = loader.validateSkill(skill);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Missing id');
    });

    it('should reject skill without content', () => {
      const loader = getSkillLoader();
      const skill = createValidSkill('test');
      // @ts-expect-error - intentionally invalid
      skill.content = '';

      const result = loader.validateSkill(skill);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Missing content');
    });

    it('should reject invalid category', () => {
      const loader = getSkillLoader();
      const skill = createValidSkill('test');
      // @ts-expect-error - intentionally invalid
      skill.category = 'invalid-category';

      const result = loader.validateSkill(skill);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('Invalid category'))).toBe(true);
    });

    it('should reject invalid priority', () => {
      const loader = getSkillLoader();
      const skill = createValidSkill('test');
      // @ts-expect-error - intentionally invalid
      skill.priority = 'invalid-priority';

      const result = loader.validateSkill(skill);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('Invalid priority'))).toBe(true);
    });

    it('should warn on high token estimate', () => {
      const loader = getSkillLoader();
      const skill = createValidSkill('test', { tokenEstimate: 3000 });

      const result = loader.validateSkill(skill);

      expect(result.valid).toBe(true);
      expect(result.warnings.some((w) => w.includes('High token estimate'))).toBe(true);
    });
  });

  describe('getAllSkills', () => {
    it('should return all skills from all packs', () => {
      const loader = getSkillLoader();
      loader.loadPack(createValidPack('pack-1', [createValidSkill('skill-1')]));
      loader.loadPack(createValidPack('pack-2', [createValidSkill('skill-2')]));

      const skills = loader.getAllSkills();

      expect(skills).toHaveLength(2);
      expect(skills.map((s) => s.id)).toContain('skill-1');
      expect(skills.map((s) => s.id)).toContain('skill-2');
    });
  });

  describe('getSkill', () => {
    it('should get skill by id', () => {
      const loader = getSkillLoader();
      loader.loadPack(createValidPack('pack-1', [createValidSkill('target-skill')]));

      const skill = loader.getSkill('target-skill');

      expect(skill).toBeDefined();
      expect(skill?.id).toBe('target-skill');
    });

    it('should return undefined for unknown skill', () => {
      const loader = getSkillLoader();

      const skill = loader.getSkill('unknown-skill');

      expect(skill).toBeUndefined();
    });
  });

  describe('unloadPack', () => {
    it('should unload a pack', () => {
      const loader = getSkillLoader();
      loader.loadPack(createValidPack('pack-to-unload'));

      const unloaded = loader.unloadPack('pack-to-unload');

      expect(unloaded).toBe(true);
      expect(loader.getPack('pack-to-unload')).toBeUndefined();
    });

    it('should return false for unknown pack', () => {
      const loader = getSkillLoader();

      const unloaded = loader.unloadPack('unknown-pack');

      expect(unloaded).toBe(false);
    });
  });

  describe('getStats', () => {
    it('should return loader statistics', () => {
      const loader = getSkillLoader();
      loader.loadPack(
        createValidPack('test-pack', [
          createValidSkill('skill-1', { category: 'coding', priority: 'high', tokenEstimate: 100 }),
          createValidSkill('skill-2', { category: 'testing', priority: 'low', tokenEstimate: 200 }),
        ])
      );

      const stats = loader.getStats();

      expect(stats.packsLoaded).toBe(1);
      expect(stats.skillsLoaded).toBe(2);
      expect(stats.totalTokens).toBe(300);
      expect((stats.byCategory as Record<string, number>).coding).toBe(1);
      expect((stats.byCategory as Record<string, number>).testing).toBe(1);
    });
  });

  describe('event emission', () => {
    it('should emit skill:loaded event', () => {
      const loader = getSkillLoader();
      const events: string[] = [];
      loader.on((event) => events.push(event.type));

      loader.loadPack(createValidPack('test-pack'));

      expect(events).toContain('skill:loaded');
    });

    it('should emit skill:validated event', () => {
      const loader = getSkillLoader();
      const events: string[] = [];
      loader.on((event) => events.push(event.type));

      loader.loadPack(createValidPack('test-pack'));

      expect(events).toContain('skill:validated');
    });
  });
});
