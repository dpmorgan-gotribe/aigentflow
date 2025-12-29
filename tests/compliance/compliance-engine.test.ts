/**
 * Compliance Engine Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  ComplianceEngine,
  getComplianceEngine,
  resetComplianceEngine,
} from '../../src/compliance/compliance-engine.js';
import type { ComplianceContext, ComplianceRule } from '../../src/compliance/types.js';

describe('ComplianceEngine', () => {
  beforeEach(() => {
    resetComplianceEngine();
  });

  afterEach(() => {
    resetComplianceEngine();
  });

  describe('Singleton', () => {
    it('should return singleton instance', () => {
      const engine1 = getComplianceEngine();
      const engine2 = getComplianceEngine();
      expect(engine1).toBe(engine2);
    });

    it('should reset singleton', () => {
      const engine1 = getComplianceEngine();
      resetComplianceEngine();
      const engine2 = getComplianceEngine();
      expect(engine1).not.toBe(engine2);
    });
  });

  describe('Framework Management', () => {
    it('should have platform framework registered by default', () => {
      const engine = new ComplianceEngine();
      const platform = engine.getFramework('platform');
      expect(platform).toBeDefined();
      expect(platform?.mandatory).toBe(true);
    });

    it('should have GDPR framework registered', () => {
      const engine = new ComplianceEngine();
      const gdpr = engine.getFramework('gdpr');
      expect(gdpr).toBeDefined();
      expect(gdpr?.name).toBe('GDPR');
    });

    it('should have SOC2 framework registered', () => {
      const engine = new ComplianceEngine();
      const soc2 = engine.getFramework('soc2');
      expect(soc2).toBeDefined();
      expect(soc2?.name).toBe('SOC 2');
    });

    it('should enable a framework', () => {
      const engine = new ComplianceEngine();
      const result = engine.enableFramework('gdpr');
      expect(result).toBe(true);
      expect(engine.getConfig().enabledFrameworks).toContain('gdpr');
    });

    it('should disable a non-mandatory framework', () => {
      const engine = new ComplianceEngine({ enabledFrameworks: ['platform', 'gdpr'] });
      const result = engine.disableFramework('gdpr');
      expect(result).toBe(true);
      expect(engine.getConfig().enabledFrameworks).not.toContain('gdpr');
    });

    it('should not disable mandatory framework', () => {
      const engine = new ComplianceEngine();
      const result = engine.disableFramework('platform');
      expect(result).toBe(false);
      expect(engine.getConfig().enabledFrameworks).toContain('platform');
    });

    it('should return all frameworks', () => {
      const engine = new ComplianceEngine();
      const frameworks = engine.getAllFrameworks();
      expect(frameworks.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('Check Execution', () => {
    it('should run check without violations for clean content', () => {
      const engine = new ComplianceEngine();
      const context: ComplianceContext = {
        content: 'const x = 1;\nconsole.log(x);',
        filePath: 'test.ts',
      };

      const result = engine.check(context);
      expect(result.score).toBeGreaterThan(0);
      expect(result.timestamp).toBeDefined();
    });

    it('should detect hardcoded secrets', () => {
      const engine = new ComplianceEngine();
      const context: ComplianceContext = {
        content: 'const apiKey = "AKIA1234567890ABCDEF";',
        filePath: 'config.ts',
      };

      const result = engine.check(context, 'code-generation');

      expect(result.violations.length).toBeGreaterThan(0);
      expect(result.violations.some((v) => v.ruleId === 'platform-no-secrets')).toBe(true);
    });

    it('should detect dangerous eval()', () => {
      const engine = new ComplianceEngine();
      const context: ComplianceContext = {
        content: 'eval(userInput);',
        filePath: 'script.ts',
      };

      const result = engine.check(context, 'code-generation');

      expect(result.violations.some((v) => v.ruleId === 'platform-no-dangerous-code')).toBe(true);
    });

    it('should detect sensitive files', () => {
      const engine = new ComplianceEngine();
      const context: ComplianceContext = {
        filePath: '.env',
        content: 'SECRET=value',
      };

      const result = engine.check(context, 'file-write');

      expect(result.violations.some((v) => v.ruleId === 'platform-no-sensitive-files')).toBe(true);
    });

    it('should pass when no violations', () => {
      const engine = new ComplianceEngine({ minimumScore: 70 });
      const context: ComplianceContext = {
        content: 'export const add = (a: number, b: number) => a + b;',
        filePath: 'utils.ts',
      };

      const result = engine.check(context);

      expect(result.passed).toBe(true);
      expect(result.score).toBe(100);
    });

    it('should fail on critical violation', () => {
      const engine = new ComplianceEngine({ failOnSeverity: ['critical'] });
      const context: ComplianceContext = {
        // Use a 36-char token after ghp_ to match the regex
        content: 'const key = "ghp_abcdefghijklmnopqrstuvwxyz1234567890";',
        filePath: 'config.ts',
      };

      const result = engine.check(context, 'code-generation');

      expect(result.passed).toBe(false);
    });

    it('should count violations by severity', () => {
      const engine = new ComplianceEngine();
      const context: ComplianceContext = {
        content: 'eval(input); document.innerHTML = userContent;',
        filePath: 'script.ts',
      };

      const result = engine.check(context, 'code-generation');

      expect(result.bySeverity).toBeDefined();
      expect(typeof result.bySeverity.critical).toBe('number');
      expect(typeof result.bySeverity.high).toBe('number');
    });

    it('should count violations by framework', () => {
      const engine = new ComplianceEngine({ enabledFrameworks: ['platform', 'gdpr'] });
      const context: ComplianceContext = {
        content: 'const email = req.body.email;\nconst password = "secret123";',
        filePath: 'user.ts',
      };

      const result = engine.check(context, 'code-generation');

      expect(result.byFramework).toBeDefined();
    });

    it('should limit violations when maxViolations reached', () => {
      const engine = new ComplianceEngine({ maxViolations: 1 });
      const context: ComplianceContext = {
        content: 'eval(a); eval(b); eval(c);',
        filePath: 'script.ts',
      };

      const result = engine.check(context, 'code-generation');

      expect(result.violations.length).toBeLessThanOrEqual(1);
    });
  });

  describe('File Checking', () => {
    it('should check file content', () => {
      const engine = new ComplianceEngine();
      const result = engine.checkFile('app.ts', 'console.log("Hello");');

      expect(result).toBeDefined();
      expect(result.rulesChecked).toBeGreaterThan(0);
    });

    it('should detect HTTP URLs', () => {
      const engine = new ComplianceEngine();
      const result = engine.checkFile(
        'api.ts',
        'const url = "http://api.example.com/data";'
      );

      expect(
        result.violations.some((v) => v.ruleId === 'platform-https-enforcement')
      ).toBe(true);
    });

    it('should allow localhost HTTP', () => {
      const engine = new ComplianceEngine();
      const result = engine.checkFile(
        'dev.ts',
        'const url = "http://localhost:3000";'
      );

      expect(
        result.violations.some((v) => v.ruleId === 'platform-https-enforcement')
      ).toBe(false);
    });
  });

  describe('Generated Code Checking', () => {
    it('should check generated code', () => {
      const engine = new ComplianceEngine();
      const result = engine.checkGeneratedCode('const safe = true;');

      expect(result).toBeDefined();
    });

    it('should detect issues in generated code', () => {
      const engine = new ComplianceEngine();
      const result = engine.checkGeneratedCode('eval(userInput);');

      expect(result.violations.length).toBeGreaterThan(0);
    });
  });

  describe('Auto-Fix', () => {
    it('should not fix when autoFix is disabled', () => {
      const engine = new ComplianceEngine({ autoFix: false });
      const violations = [
        {
          ruleId: 'platform-https-enforcement',
          framework: 'platform' as const,
          severity: 'high' as const,
          message: 'Test',
          autoFixable: true,
          context: { originalUrl: 'http://test.com', fixedUrl: 'https://test.com' },
        },
      ];

      const result = engine.fix(violations, {});

      expect(result.fixed).toHaveLength(0);
      expect(result.failed).toHaveLength(1);
    });

    it('should attempt fix when autoFix is enabled', () => {
      const engine = new ComplianceEngine({ autoFix: true });
      const violations = [
        {
          ruleId: 'platform-https-enforcement',
          framework: 'platform' as const,
          severity: 'high' as const,
          message: 'Non-HTTPS URL',
          autoFixable: true,
          context: { originalUrl: 'http://test.com', fixedUrl: 'https://test.com' },
        },
      ];

      const result = engine.fix(violations, { content: 'http://test.com' });

      expect(result.fixed.length + result.failed.length).toBe(1);
    });
  });

  describe('Configuration', () => {
    it('should return current configuration', () => {
      const engine = new ComplianceEngine({ strictMode: true });
      const config = engine.getConfig();

      expect(config.strictMode).toBe(true);
    });

    it('should update configuration', () => {
      const engine = new ComplianceEngine();
      engine.updateConfig({ minimumScore: 90 });
      const config = engine.getConfig();

      expect(config.minimumScore).toBe(90);
    });
  });

  describe('Statistics', () => {
    it('should return engine statistics', () => {
      const engine = new ComplianceEngine();
      const stats = engine.getStats();

      expect(stats.enabledFrameworks).toBeGreaterThan(0);
      expect(stats.totalRules).toBeGreaterThan(0);
      expect(stats.rulesByFramework).toBeDefined();
    });
  });

  describe('Events', () => {
    it('should emit check:started event', () => {
      const engine = new ComplianceEngine();
      const events: string[] = [];
      engine.on((event) => events.push(event.type));

      engine.check({ content: 'test' });

      expect(events).toContain('check:started');
    });

    it('should emit check:completed event', () => {
      const engine = new ComplianceEngine();
      const events: string[] = [];
      engine.on((event) => events.push(event.type));

      engine.check({ content: 'test' });

      expect(events).toContain('check:completed');
    });

    it('should emit violation:found event', () => {
      const engine = new ComplianceEngine();
      const events: string[] = [];
      engine.on((event) => events.push(event.type));

      engine.check({ content: 'eval(input);' }, 'code-generation');

      expect(events).toContain('violation:found');
    });

    it('should allow unsubscribing', () => {
      const engine = new ComplianceEngine();
      const events: string[] = [];
      const unsub = engine.on((event) => events.push(event.type));

      unsub();
      engine.check({ content: 'test' });

      expect(events).toHaveLength(0);
    });
  });

  describe('Custom Rules', () => {
    it('should register custom framework with rules', () => {
      const engine = new ComplianceEngine();

      const customRule: ComplianceRule = {
        id: 'custom-rule',
        framework: 'platform',
        name: 'Custom Rule',
        description: 'Test rule',
        category: 'security',
        severity: 'medium',
        triggers: ['always'],
        enabled: true,
        autoFixable: false,
        check: () => [],
      };

      engine.registerFramework({
        id: 'platform',
        name: 'Custom',
        description: 'Custom framework',
        mandatory: false,
        rules: [customRule],
      });

      const framework = engine.getFramework('platform');
      expect(framework?.rules.some((r) => r.id === 'custom-rule')).toBe(true);
    });
  });

  describe('Scoring', () => {
    it('should return 100 for no violations', () => {
      const engine = new ComplianceEngine();
      const result = engine.check({ content: 'const x = 1;' });

      expect(result.score).toBe(100);
    });

    it('should reduce score for violations', () => {
      const engine = new ComplianceEngine();
      const result = engine.check(
        { content: 'eval(input);' },
        'code-generation'
      );

      expect(result.score).toBeLessThan(100);
    });

    it('should fail in strict mode with any violation', () => {
      const engine = new ComplianceEngine({ strictMode: true });
      const result = engine.check(
        { content: 'document.innerHTML = x;' },
        'code-generation'
      );

      expect(result.passed).toBe(false);
    });
  });

  describe('GDPR Rules', () => {
    it('should detect personal data without consent handling', () => {
      const engine = new ComplianceEngine({ enabledFrameworks: ['platform', 'gdpr'] });
      const context: ComplianceContext = {
        content: `
          const userData = {
            email: req.body.email,
            phone: req.body.phone,
            address: req.body.address
          };
          db.save(userData);
        `,
        filePath: 'user-service.ts',
      };

      const result = engine.check(context, 'code-generation');

      expect(result.violations.some((v) => v.framework === 'gdpr')).toBe(true);
    });

    it('should detect special category data', () => {
      const engine = new ComplianceEngine({ enabledFrameworks: ['platform', 'gdpr'] });
      const context: ComplianceContext = {
        content: 'const health = req.body.healthData;',
        filePath: 'medical.ts',
      };

      const result = engine.check(context, 'code-generation');

      expect(
        result.violations.some((v) => v.message.includes('Special category'))
      ).toBe(true);
    });
  });

  describe('SOC 2 Rules', () => {
    it('should detect API endpoints without auth', () => {
      const engine = new ComplianceEngine({ enabledFrameworks: ['platform', 'soc2'] });
      const context: ComplianceContext = {
        content: `
          app.get('/users', (req, res) => {
            res.json(users);
          });
        `,
        filePath: 'routes.ts',
      };

      const result = engine.check(context, 'code-generation');

      expect(
        result.violations.some((v) => v.ruleId === 'soc2-access-control')
      ).toBe(true);
    });

    it('should detect unencrypted sensitive data storage', () => {
      const engine = new ComplianceEngine({ enabledFrameworks: ['platform', 'soc2'] });
      const context: ComplianceContext = {
        content: `
          const User = mongoose.model('User', {
            password: String,
            creditCard: String
          });
        `,
        filePath: 'user.model.ts',
      };

      const result = engine.check(context, 'code-generation');

      expect(
        result.violations.some((v) => v.ruleId === 'soc2-encryption-at-rest')
      ).toBe(true);
    });
  });
});
