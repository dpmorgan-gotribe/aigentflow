/**
 * MCP Server Configuration Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  MCPConfigManager,
  getMCPConfigManager,
  resetMCPConfigManager,
} from '../../src/mcp/server-config.js';
import type { MCPServerConfig } from '../../src/mcp/types.js';

const createValidConfig = (
  id: string,
  overrides: Partial<MCPServerConfig> = {}
): Partial<MCPServerConfig> & { id: string; name: string } => ({
  id,
  name: `Server ${id}`,
  description: 'Test server',
  transport: 'stdio',
  endpoint: '/test/path',
  auth: { method: 'none' },
  permissions: ['readFiles'],
  ...overrides,
});

describe('MCPConfigManager', () => {
  beforeEach(() => {
    resetMCPConfigManager();
  });

  afterEach(() => {
    resetMCPConfigManager();
  });

  describe('Singleton', () => {
    it('should return singleton instance', () => {
      const mgr1 = getMCPConfigManager();
      const mgr2 = getMCPConfigManager();
      expect(mgr1).toBe(mgr2);
    });

    it('should reset singleton', () => {
      const mgr1 = getMCPConfigManager();
      resetMCPConfigManager();
      const mgr2 = getMCPConfigManager();
      expect(mgr1).not.toBe(mgr2);
    });
  });

  describe('addConfig', () => {
    it('should add a valid configuration', () => {
      const manager = getMCPConfigManager();
      const result = manager.addConfig(createValidConfig('test-server'));

      expect(result.valid).toBe(true);
      expect(manager.getConfig('test-server')).toBeDefined();
    });

    it('should reject config without id', () => {
      const manager = getMCPConfigManager();
      const config = createValidConfig('');

      const result = manager.addConfig(config);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Missing server id');
    });

    it('should reject config without endpoint', () => {
      const manager = getMCPConfigManager();
      const config = createValidConfig('test', { endpoint: '' });

      const result = manager.addConfig(config);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Missing endpoint');
    });

    it('should reject invalid transport', () => {
      const manager = getMCPConfigManager();
      // @ts-expect-error - intentionally invalid
      const config = createValidConfig('test', { transport: 'invalid' });

      const result = manager.addConfig(config);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('Invalid transport'))).toBe(true);
    });

    it('should warn on invalid endpoint URL for http transport', () => {
      const manager = getMCPConfigManager();
      const config = createValidConfig('test', {
        transport: 'http',
        endpoint: '/not/a/url',
      });

      const result = manager.addConfig(config);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('Invalid endpoint URL'))).toBe(true);
    });
  });

  describe('updateConfig', () => {
    it('should update existing config', () => {
      const manager = getMCPConfigManager();
      manager.addConfig(createValidConfig('update-test'));

      const result = manager.updateConfig('update-test', { priority: 200 });

      expect(result.valid).toBe(true);
      expect(manager.getConfig('update-test')?.priority).toBe(200);
    });

    it('should fail for non-existent config', () => {
      const manager = getMCPConfigManager();

      const result = manager.updateConfig('nonexistent', { priority: 100 });

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Server config not found: nonexistent');
    });
  });

  describe('removeConfig', () => {
    it('should remove config', () => {
      const manager = getMCPConfigManager();
      manager.addConfig(createValidConfig('remove-test'));

      const removed = manager.removeConfig('remove-test');

      expect(removed).toBe(true);
      expect(manager.getConfig('remove-test')).toBeUndefined();
    });

    it('should return false for non-existent config', () => {
      const manager = getMCPConfigManager();

      const removed = manager.removeConfig('nonexistent');

      expect(removed).toBe(false);
    });
  });

  describe('enableServer / disableServer', () => {
    it('should enable server', () => {
      const manager = getMCPConfigManager();
      manager.addConfig(createValidConfig('toggle-test', { enabled: false }));

      const result = manager.enableServer('toggle-test');

      expect(result).toBe(true);
      expect(manager.getConfig('toggle-test')?.enabled).toBe(true);
    });

    it('should disable server', () => {
      const manager = getMCPConfigManager();
      manager.addConfig(createValidConfig('toggle-test', { enabled: true }));

      const result = manager.disableServer('toggle-test');

      expect(result).toBe(true);
      expect(manager.getConfig('toggle-test')?.enabled).toBe(false);
    });
  });

  describe('Auth Validation', () => {
    it('should require apiKey for api_key auth', () => {
      const manager = getMCPConfigManager();
      const config = createValidConfig('auth-test', {
        auth: { method: 'api_key' },
      });

      const result = manager.addConfig(config);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('api_key auth requires apiKey'))).toBe(true);
    });

    it('should validate valid api_key auth', () => {
      const manager = getMCPConfigManager();
      const config = createValidConfig('auth-test', {
        auth: { method: 'api_key', apiKey: 'test-key' },
      });

      const result = manager.addConfig(config);

      expect(result.valid).toBe(true);
    });

    it('should require username/password for basic auth', () => {
      const manager = getMCPConfigManager();
      const config = createValidConfig('auth-test', {
        auth: { method: 'basic' },
      });

      const result = manager.addConfig(config);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('basic auth requires'))).toBe(true);
    });

    it('should require oauth config for oauth auth', () => {
      const manager = getMCPConfigManager();
      const config = createValidConfig('auth-test', {
        auth: { method: 'oauth' },
      });

      const result = manager.addConfig(config);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('oauth auth requires'))).toBe(true);
    });
  });

  describe('Queries', () => {
    it('should get enabled configs', () => {
      const manager = getMCPConfigManager();
      manager.addConfig(createValidConfig('enabled-1', { enabled: true }));
      manager.addConfig(createValidConfig('disabled-1', { enabled: false }));

      const enabled = manager.getEnabledConfigs();

      expect(enabled).toHaveLength(1);
      expect(enabled[0].id).toBe('enabled-1');
    });

    it('should get configs by transport', () => {
      const manager = getMCPConfigManager();
      manager.addConfig(createValidConfig('stdio-1', { transport: 'stdio' }));
      manager.addConfig(
        createValidConfig('http-1', { transport: 'http', endpoint: 'http://test' })
      );

      const stdioConfigs = manager.getByTransport('stdio');

      expect(stdioConfigs).toHaveLength(1);
      expect(stdioConfigs[0].id).toBe('stdio-1');
    });

    it('should get configs by permission', () => {
      const manager = getMCPConfigManager();
      manager.addConfig(createValidConfig('read-1', { permissions: ['readFiles'] }));
      manager.addConfig(createValidConfig('write-1', { permissions: ['writeFiles'] }));

      const readConfigs = manager.getByPermission('readFiles');

      expect(readConfigs).toHaveLength(1);
      expect(readConfigs[0].id).toBe('read-1');
    });
  });

  describe('Import/Export', () => {
    it('should export configs with redacted secrets', () => {
      const manager = getMCPConfigManager();
      manager.addConfig(
        createValidConfig('secret-test', {
          auth: { method: 'api_key', apiKey: 'super-secret' },
        })
      );

      const exported = manager.exportConfigs();

      expect(exported[0].auth.apiKey).toBe('***');
    });

    it('should import configs', () => {
      const manager = getMCPConfigManager();

      const result = manager.importConfigs([
        createValidConfig('import-1'),
        createValidConfig('import-2'),
      ]);

      expect(result.imported).toBe(2);
      expect(result.failed).toBe(0);
    });
  });

  describe('Statistics', () => {
    it('should return stats', () => {
      const manager = getMCPConfigManager();
      manager.addConfig(createValidConfig('stat-1', { transport: 'stdio', enabled: true }));
      manager.addConfig(
        createValidConfig('stat-2', { transport: 'http', endpoint: 'http://test', enabled: false })
      );

      const stats = manager.getStats();

      expect(stats.total).toBe(2);
      expect(stats.enabled).toBe(1);
      expect(stats.disabled).toBe(1);
      expect((stats.byTransport as Record<string, number>).stdio).toBe(1);
    });
  });
});
