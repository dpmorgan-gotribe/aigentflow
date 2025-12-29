/**
 * Built-in Hooks Tests
 */

import { describe, it, expect } from 'vitest';
import {
  secretDetectionHook,
  scanForSecrets,
  securityScanHook,
  scanForVulnerabilities,
  auditLogHook,
  sanitizeForLog,
} from '../../src/hooks/built-in/index.js';
import type { HookContext } from '../../src/hooks/types.js';

describe('Secret Detection Hook', () => {
  describe('scanForSecrets', () => {
    it('should detect API keys', () => {
      const content = `const config = {
        api_key: "sk_live_1234567890abcdefghij"
      };`;
      const matches = scanForSecrets(content);
      expect(matches.length).toBeGreaterThan(0);
      expect(matches[0]?.pattern).toContain('API');
    });

    it('should detect AWS access keys', () => {
      const content = 'AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE';
      const matches = scanForSecrets(content);
      expect(matches.some((m) => m.pattern.includes('AWS'))).toBe(true);
    });

    it('should detect private keys', () => {
      const content = '-----BEGIN PRIVATE KEY-----';
      const matches = scanForSecrets(content);
      expect(matches.some((m) => m.pattern.includes('Private Key'))).toBe(true);
    });

    it('should detect passwords', () => {
      const content = 'password: "mysecretpassword123"';
      const matches = scanForSecrets(content);
      expect(matches.some((m) => m.pattern.includes('Password'))).toBe(true);
    });

    it('should detect database connection strings', () => {
      const content = 'mongodb://user:pass@localhost:27017/db';
      const matches = scanForSecrets(content);
      expect(matches.some((m) => m.pattern.includes('Database'))).toBe(true);
    });

    it('should detect GitHub tokens', () => {
      const content = 'token = "ghp_abc123def456ghi789jkl012mno345pqr678"';
      const matches = scanForSecrets(content);
      expect(matches.some((m) => m.pattern.includes('GitHub'))).toBe(true);
    });

    it('should detect Anthropic API keys', () => {
      const content = 'ANTHROPIC_API_KEY=sk-ant-api03-abc123';
      const matches = scanForSecrets(content);
      expect(matches.some((m) => m.pattern.includes('Anthropic'))).toBe(true);
    });

    it('should return empty for clean content', () => {
      const content = `const add = (a, b) => a + b;
        export default add;`;
      const matches = scanForSecrets(content);
      expect(matches.length).toBe(0);
    });

    it('should redact secrets in snippet', () => {
      const content = 'password: "verysecretpassword"';
      const matches = scanForSecrets(content);
      expect(matches[0]?.snippet).not.toContain('verysecretpassword');
    });
  });

  describe('secretDetectionHook', () => {
    it('should pass with no content', async () => {
      const result = await secretDetectionHook({});
      expect(result.success).toBe(true);
      expect(result.blocked).toBe(false);
    });

    it('should pass with clean content', async () => {
      const context: HookContext = {
        fileContent: 'const x = 1;',
        filePath: 'test.ts',
      };
      const result = await secretDetectionHook(context);
      expect(result.success).toBe(true);
      expect(result.blocked).toBe(false);
    });

    it('should block on high severity secrets', async () => {
      const context: HookContext = {
        fileContent: 'API_KEY = "sk_live_FAKE_TEST_KEY_FOR_UNIT_TESTING_1234"',
        filePath: 'config.ts',
      };
      const result = await secretDetectionHook(context);
      expect(result.blocked).toBe(true);
      expect(result.message).toContain('high severity');
    });
  });
});

describe('Security Scan Hook', () => {
  describe('scanForVulnerabilities', () => {
    it('should detect SQL injection', () => {
      const content = 'db.query(`SELECT * FROM users WHERE id = ${userId}`);';
      const findings = scanForVulnerabilities(content);
      expect(findings.some((f) => f.category === 'injection')).toBe(true);
    });

    it('should detect command injection', () => {
      const content = 'exec(`ls -la ${userInput}`);';
      const findings = scanForVulnerabilities(content);
      expect(findings.some((f) => f.name.includes('Command'))).toBe(true);
    });

    it('should detect XSS via innerHTML', () => {
      const content = 'element.innerHTML = userInput;';
      const findings = scanForVulnerabilities(content);
      expect(findings.some((f) => f.category === 'xss')).toBe(true);
    });

    it('should detect eval usage', () => {
      const content = 'eval(userCode);';
      const findings = scanForVulnerabilities(content);
      expect(findings.some((f) => f.name.includes('Eval'))).toBe(true);
    });

    it('should detect insecure randomness', () => {
      const content = 'const token = Math.random().toString(36);';
      const findings = scanForVulnerabilities(content);
      expect(findings.some((f) => f.name.includes('Random'))).toBe(true);
    });

    it('should detect disabled TLS verification', () => {
      const content = 'rejectUnauthorized: false';
      const findings = scanForVulnerabilities(content);
      expect(findings.some((f) => f.name.includes('TLS'))).toBe(true);
    });

    it('should detect CORS misconfiguration', () => {
      const content = "res.setHeader('Access-Control-Allow-Origin', '*');";
      const findings = scanForVulnerabilities(content);
      expect(findings.some((f) => f.category === 'cors')).toBe(true);
    });

    it('should return empty for secure code', () => {
      const content = `
        const users = await db.query('SELECT * FROM users WHERE id = ?', [userId]);
        return users;
      `;
      const findings = scanForVulnerabilities(content);
      expect(findings.filter((f) => f.severity === 'critical').length).toBe(0);
    });

    it('should skip comments', () => {
      const content = '// eval(dangerousCode);';
      const findings = scanForVulnerabilities(content);
      expect(findings.filter((f) => f.name.includes('Eval')).length).toBe(0);
    });

    it('should include CWE references', () => {
      const content = 'db.query(`SELECT * FROM users WHERE id = ${userId}`);';
      const findings = scanForVulnerabilities(content);
      const sqlInjection = findings.find((f) => f.category === 'injection');
      expect(sqlInjection?.cwe).toBe('CWE-89');
    });
  });

  describe('securityScanHook', () => {
    it('should pass with no content', async () => {
      const result = await securityScanHook({});
      expect(result.success).toBe(true);
      expect(result.blocked).toBe(false);
    });

    it('should skip non-code files', async () => {
      const context: HookContext = {
        fileContent: 'eval(code);',
        filePath: 'readme.md',
      };
      const result = await securityScanHook(context);
      expect(result.success).toBe(true);
      expect(result.blocked).toBe(false);
    });

    it('should block on critical vulnerabilities', async () => {
      const context: HookContext = {
        fileContent: 'db.query(`SELECT * FROM users WHERE id = ${req.params.id}`);',
        filePath: 'api.ts',
      };
      const result = await securityScanHook(context);
      expect(result.blocked).toBe(true);
      expect(result.message).toContain('Critical');
    });

    it('should warn on non-critical issues', async () => {
      const context: HookContext = {
        fileContent: 'const token = Math.random();',
        filePath: 'utils.ts',
      };
      const result = await securityScanHook(context);
      expect(result.success).toBe(true);
      expect(result.blocked).toBe(false);
      expect(result.message).toContain('medium');
    });
  });
});

describe('Audit Log Hook', () => {
  describe('sanitizeForLog', () => {
    it('should redact password fields', () => {
      const data = { password: 'secret123', username: 'john' };
      const sanitized = sanitizeForLog(data);
      expect(sanitized?.password).toBe('[REDACTED]');
      expect(sanitized?.username).toBe('john');
    });

    it('should redact API key fields', () => {
      const data = { apiKey: 'sk-123abc', name: 'test' };
      const sanitized = sanitizeForLog(data);
      expect(sanitized?.apiKey).toBe('[REDACTED]');
    });

    it('should redact nested sensitive fields', () => {
      const data = {
        config: {
          secret: 'mysecret',
          timeout: 5000,
        },
      };
      const sanitized = sanitizeForLog(data);
      expect((sanitized?.config as Record<string, unknown>)?.secret).toBe('[REDACTED]');
      expect((sanitized?.config as Record<string, unknown>)?.timeout).toBe(5000);
    });

    it('should truncate long strings', () => {
      const longString = 'a'.repeat(600);
      const data = { content: longString };
      const sanitized = sanitizeForLog(data);
      expect((sanitized?.content as string).length).toBeLessThan(600);
      expect(sanitized?.content).toContain('[TRUNCATED]');
    });

    it('should return undefined for undefined input', () => {
      const sanitized = sanitizeForLog(undefined);
      expect(sanitized).toBeUndefined();
    });

    it('should handle arrays', () => {
      const data = {
        items: [{ password: 'secret' }, { name: 'test' }],
      };
      const sanitized = sanitizeForLog(data);
      const items = sanitized?.items as Array<Record<string, unknown>>;
      expect(items[0]?.password).toBe('[REDACTED]');
      expect(items[1]?.name).toBe('test');
    });
  });

  describe('auditLogHook', () => {
    it('should always succeed', async () => {
      const context: HookContext = {
        taskId: 'task-123',
        projectId: 'project-456',
        agentType: 'orchestrator',
      };
      const result = await auditLogHook(context);
      expect(result.success).toBe(true);
      expect(result.blocked).toBe(false);
    });

    it('should never block operations', async () => {
      const context: HookContext = {
        taskId: 'task-123',
        data: { password: 'secret' },
      };
      const result = await auditLogHook(context);
      expect(result.blocked).toBe(false);
    });

    it('should include timestamp in result', async () => {
      const result = await auditLogHook({});
      expect(result.data).toHaveProperty('timestamp');
    });
  });
});
