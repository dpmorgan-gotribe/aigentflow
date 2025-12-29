/**
 * Skill Injector Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  SkillInjector,
  getSkillInjector,
  resetSkillInjector,
  injectSkills,
} from '../../src/skills/skill-injector.js';
import { getSkillLoader, resetSkillLoader } from '../../src/skills/skill-loader.js';
import { resetSkillRegistry } from '../../src/skills/skill-registry.js';
import type { Skill, SkillPack } from '../../src/skills/types.js';

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
  content: `Content for ${id}`,
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

describe('SkillInjector', () => {
  beforeEach(() => {
    resetSkillLoader();
    resetSkillRegistry();
    resetSkillInjector();
  });

  afterEach(() => {
    resetSkillLoader();
    resetSkillRegistry();
    resetSkillInjector();
  });

  describe('Singleton', () => {
    it('should return singleton instance', () => {
      const inj1 = getSkillInjector();
      const inj2 = getSkillInjector();
      expect(inj1).toBe(inj2);
    });
  });

  describe('inject', () => {
    it('should inject matching skills into prompt', () => {
      const loader = getSkillLoader();
      loader.loadPack(
        createPack('test', [
          createSkill('typescript', {
            conditions: [{ field: 'languages', operator: 'contains', value: 'typescript' }],
          }),
        ])
      );

      const result = injectSkills('Write a function', { languages: ['typescript'] });

      expect(result.injectedSkills).toContain('typescript');
      expect(result.content).toContain('Content for typescript');
      expect(result.content).toContain('Write a function');
    });

    it('should return base prompt if no skills match', () => {
      const loader = getSkillLoader();
      loader.loadPack(
        createPack('test', [
          createSkill('python', {
            conditions: [{ field: 'languages', operator: 'contains', value: 'python' }],
          }),
        ])
      );

      const result = injectSkills('Write a function', { languages: ['typescript'] });

      expect(result.injectedSkills).toHaveLength(0);
      expect(result.content).toBe('Write a function');
    });

    it('should respect token budget', () => {
      const loader = getSkillLoader();
      loader.loadPack(
        createPack('test', [
          createSkill('skill-1', { tokenEstimate: 100 }),
          createSkill('skill-2', { tokenEstimate: 200 }),
        ])
      );

      const result = injectSkills('Prompt', {}, { tokenBudget: 150 });

      expect(result.injectedSkills).toHaveLength(1);
      expect(result.budgetExceeded).toBe(true);
    });

    it('should replace {{SKILLS}} marker in prompt', () => {
      const loader = getSkillLoader();
      loader.loadPack(createPack('test', [createSkill('test-skill')]));

      const result = injectSkills('Before {{SKILLS}} After', {});

      expect(result.content).toContain('Before');
      expect(result.content).toContain('After');
      expect(result.content).toContain('Content for test-skill');
      expect(result.content).not.toContain('{{SKILLS}}');
    });
  });

  describe('injectSkills (specific skills)', () => {
    it('should inject specific skills', () => {
      const injector = getSkillInjector();
      const skills = [createSkill('specific-1'), createSkill('specific-2')];

      const result = injector.injectSkills('Base prompt', skills);

      expect(result.injectedSkills).toContain('specific-1');
      expect(result.injectedSkills).toContain('specific-2');
      expect(result.tokenCount).toBe(200);
    });

    it('should respect budget for specific skills', () => {
      const injector = getSkillInjector();
      const skills = [
        createSkill('large-1', { tokenEstimate: 300 }),
        createSkill('large-2', { tokenEstimate: 300 }),
      ];

      const result = injector.injectSkills('Prompt', skills, { tokenBudget: 400 });

      expect(result.injectedSkills).toHaveLength(1);
      expect(result.budgetExceeded).toBe(true);
    });
  });

  describe('formatSkills - markdown', () => {
    it('should format skills as markdown', () => {
      const injector = getSkillInjector();
      const skills = [createSkill('md-skill')];

      const formatted = injector.formatSkills(skills, {
        tokenBudget: 1000,
        includeExamples: false,
        format: 'markdown',
        sectionHeader: 'Skills',
        includeMetadata: false,
      });

      expect(formatted).toContain('## Skills');
      expect(formatted).toContain('### Skill md-skill');
      expect(formatted).toContain('Content for md-skill');
    });

    it('should include metadata when requested', () => {
      const injector = getSkillInjector();
      const skills = [createSkill('meta-skill', { category: 'testing', priority: 'high' })];

      const formatted = injector.formatSkills(skills, {
        tokenBudget: 1000,
        includeExamples: false,
        format: 'markdown',
        includeMetadata: true,
      });

      expect(formatted).toContain('testing');
      expect(formatted).toContain('high');
    });

    it('should include examples when requested', () => {
      const injector = getSkillInjector();
      const skills = [
        createSkill('example-skill', {
          examples: [
            { title: 'Example 1', input: 'Input text', output: 'Output text' },
          ],
        }),
      ];

      const formatted = injector.formatSkills(skills, {
        tokenBudget: 1000,
        includeExamples: true,
        format: 'markdown',
        includeMetadata: false,
      });

      expect(formatted).toContain('Examples');
      expect(formatted).toContain('Example 1');
      expect(formatted).toContain('Input text');
      expect(formatted).toContain('Output text');
    });
  });

  describe('formatSkills - xml', () => {
    it('should format skills as XML', () => {
      const injector = getSkillInjector();
      const skills = [createSkill('xml-skill')];

      const formatted = injector.formatSkills(skills, {
        tokenBudget: 1000,
        includeExamples: false,
        format: 'xml',
        sectionHeader: 'skills',
        includeMetadata: false,
      });

      expect(formatted).toContain('<skills>');
      expect(formatted).toContain('</skills>');
      expect(formatted).toContain('<skill id="xml-skill"');
      expect(formatted).toContain('<content>');
    });

    it('should include metadata in XML', () => {
      const injector = getSkillInjector();
      const skills = [createSkill('xml-meta', { category: 'security' })];

      const formatted = injector.formatSkills(skills, {
        tokenBudget: 1000,
        includeExamples: false,
        format: 'xml',
        includeMetadata: true,
      });

      expect(formatted).toContain('<metadata>');
      expect(formatted).toContain('<category>security</category>');
    });
  });

  describe('formatSkills - plain', () => {
    it('should format skills as plain text', () => {
      const injector = getSkillInjector();
      const skills = [createSkill('plain-skill')];

      const formatted = injector.formatSkills(skills, {
        tokenBudget: 1000,
        includeExamples: false,
        format: 'plain',
        sectionHeader: 'SKILLS',
        includeMetadata: false,
      });

      expect(formatted).toContain('SKILLS');
      expect(formatted).toContain('[Skill plain-skill]');
      expect(formatted).toContain('Content for plain-skill');
    });
  });

  describe('estimateTokens', () => {
    it('should estimate token count', () => {
      const injector = getSkillInjector();

      // ~4 chars per token
      const estimate = injector.estimateTokens('1234567890123456'); // 16 chars

      expect(estimate).toBe(4);
    });
  });

  describe('createSection', () => {
    it('should create standalone skill section', () => {
      const injector = getSkillInjector();
      const skills = [createSkill('section-skill')];

      const section = injector.createSection(skills, { format: 'markdown' });

      expect(section).toContain('Skill section-skill');
      expect(section).toContain('Content for section-skill');
    });
  });

  describe('event emission', () => {
    it('should emit skill:injected event', () => {
      const loader = getSkillLoader();
      loader.loadPack(createPack('test', [createSkill('event-skill')]));

      const injector = getSkillInjector();
      const events: string[] = [];
      injector.on((event) => events.push(event.type));

      injectSkills('Prompt', {});

      expect(events).toContain('skill:injected');
    });
  });
});
