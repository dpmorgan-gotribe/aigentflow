/**
 * Built-in Skill Packs Tests
 */

import { describe, it, expect } from 'vitest';
import {
  codingSkillPack,
  testingSkillPack,
  securitySkillPack,
  builtInSkillPacks,
} from '../../src/skills/built-in/index.js';

describe('Built-in Skill Packs', () => {
  describe('codingSkillPack', () => {
    it('should have valid pack structure', () => {
      expect(codingSkillPack.id).toBe('built-in-coding');
      expect(codingSkillPack.name).toBe('Coding Skills');
      expect(codingSkillPack.version).toBeDefined();
      expect(codingSkillPack.skills.length).toBeGreaterThan(0);
    });

    it('should include TypeScript skill', () => {
      const tsSkill = codingSkillPack.skills.find((s) => s.id === 'typescript-best-practices');
      expect(tsSkill).toBeDefined();
      expect(tsSkill?.category).toBe('coding');
      expect(tsSkill?.conditions.some((c) => c.field === 'languages')).toBe(true);
    });

    it('should include React skill', () => {
      const reactSkill = codingSkillPack.skills.find((s) => s.id === 'react-patterns');
      expect(reactSkill).toBeDefined();
      expect(reactSkill?.conditions.some((c) => c.value === 'react')).toBe(true);
    });

    it('should include Node.js skill', () => {
      const nodeSkill = codingSkillPack.skills.find((s) => s.id === 'nodejs-patterns');
      expect(nodeSkill).toBeDefined();
    });

    it('should include clean code skill', () => {
      const cleanSkill = codingSkillPack.skills.find((s) => s.id === 'clean-code');
      expect(cleanSkill).toBeDefined();
      // Clean code should have no conditions (always applicable)
      expect(cleanSkill?.conditions).toHaveLength(0);
    });

    it('should have all skills enabled', () => {
      for (const skill of codingSkillPack.skills) {
        expect(skill.enabled).toBe(true);
      }
    });
  });

  describe('testingSkillPack', () => {
    it('should have valid pack structure', () => {
      expect(testingSkillPack.id).toBe('built-in-testing');
      expect(testingSkillPack.name).toBe('Testing Skills');
      expect(testingSkillPack.skills.length).toBeGreaterThan(0);
    });

    it('should include TDD skill', () => {
      const tddSkill = testingSkillPack.skills.find((s) => s.id === 'tdd-principles');
      expect(tddSkill).toBeDefined();
      expect(tddSkill?.category).toBe('testing');
    });

    it('should include unit testing skill', () => {
      const unitSkill = testingSkillPack.skills.find((s) => s.id === 'unit-testing');
      expect(unitSkill).toBeDefined();
    });

    it('should have vitest and jest skills that conflict', () => {
      const vitest = testingSkillPack.skills.find((s) => s.id === 'vitest-patterns');
      const jest = testingSkillPack.skills.find((s) => s.id === 'jest-patterns');

      expect(vitest).toBeDefined();
      expect(jest).toBeDefined();
      expect(vitest?.conflicts).toContain('jest-patterns');
      expect(jest?.conflicts).toContain('vitest-patterns');
    });

    it('should have vitest depend on unit-testing', () => {
      const vitest = testingSkillPack.skills.find((s) => s.id === 'vitest-patterns');
      expect(vitest?.dependencies).toContain('unit-testing');
    });

    it('should include integration testing skill', () => {
      const intSkill = testingSkillPack.skills.find((s) => s.id === 'integration-testing');
      expect(intSkill).toBeDefined();
    });

    it('should include mocking patterns skill', () => {
      const mockSkill = testingSkillPack.skills.find((s) => s.id === 'mocking-patterns');
      expect(mockSkill).toBeDefined();
    });
  });

  describe('securitySkillPack', () => {
    it('should have valid pack structure', () => {
      expect(securitySkillPack.id).toBe('built-in-security');
      expect(securitySkillPack.name).toBe('Security Skills');
      expect(securitySkillPack.skills.length).toBeGreaterThan(0);
    });

    it('should include OWASP skill with critical priority', () => {
      const owaspSkill = securitySkillPack.skills.find((s) => s.id === 'owasp-top-10');
      expect(owaspSkill).toBeDefined();
      expect(owaspSkill?.priority).toBe('critical');
      expect(owaspSkill?.category).toBe('security');
    });

    it('should include input validation skill', () => {
      const inputSkill = securitySkillPack.skills.find((s) => s.id === 'input-validation');
      expect(inputSkill).toBeDefined();
      expect(inputSkill?.priority).toBe('critical');
    });

    it('should include auth security skill', () => {
      const authSkill = securitySkillPack.skills.find((s) => s.id === 'auth-security');
      expect(authSkill).toBeDefined();
    });

    it('should include API security skill', () => {
      const apiSkill = securitySkillPack.skills.find((s) => s.id === 'api-security');
      expect(apiSkill).toBeDefined();
    });

    it('should include secret management skill', () => {
      const secretSkill = securitySkillPack.skills.find((s) => s.id === 'secret-management');
      expect(secretSkill).toBeDefined();
      expect(secretSkill?.priority).toBe('critical');
    });

    it('should include XSS prevention skill', () => {
      const xssSkill = securitySkillPack.skills.find((s) => s.id === 'xss-prevention');
      expect(xssSkill).toBeDefined();
    });
  });

  describe('builtInSkillPacks array', () => {
    it('should include all three packs', () => {
      expect(builtInSkillPacks).toHaveLength(3);
      expect(builtInSkillPacks.map((p) => p.id)).toContain('built-in-coding');
      expect(builtInSkillPacks.map((p) => p.id)).toContain('built-in-testing');
      expect(builtInSkillPacks.map((p) => p.id)).toContain('built-in-security');
    });

    it('should have unique pack ids', () => {
      const ids = builtInSkillPacks.map((p) => p.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });

    it('should have all skills with valid structure', () => {
      for (const pack of builtInSkillPacks) {
        for (const skill of pack.skills) {
          // Required fields
          expect(skill.id).toBeTruthy();
          expect(skill.name).toBeTruthy();
          expect(skill.content).toBeTruthy();
          expect(skill.version).toBeTruthy();
          expect(skill.tokenEstimate).toBeGreaterThan(0);

          // Valid category
          expect([
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
          ]).toContain(skill.category);

          // Valid priority
          expect(['critical', 'high', 'medium', 'low']).toContain(skill.priority);

          // Arrays
          expect(Array.isArray(skill.conditions)).toBe(true);
          expect(Array.isArray(skill.dependencies)).toBe(true);
          expect(Array.isArray(skill.conflicts)).toBe(true);
          expect(Array.isArray(skill.tags)).toBe(true);
        }
      }
    });
  });

  describe('Skill content quality', () => {
    it('should have meaningful content (not too short)', () => {
      for (const pack of builtInSkillPacks) {
        for (const skill of pack.skills) {
          expect(skill.content.length).toBeGreaterThan(100);
        }
      }
    });

    it('should have reasonable token estimates', () => {
      for (const pack of builtInSkillPacks) {
        for (const skill of pack.skills) {
          // Token estimate should be between 100 and 1000 for built-in skills
          expect(skill.tokenEstimate).toBeGreaterThanOrEqual(100);
          expect(skill.tokenEstimate).toBeLessThanOrEqual(1000);
        }
      }
    });
  });
});
