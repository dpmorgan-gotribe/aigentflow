/**
 * MCP Connection Manager Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  MCPConnectionManager,
  getMCPConnectionManager,
  resetMCPConnectionManager,
} from '../../src/mcp/connection-manager.js';
import { getMCPConfigManager, resetMCPConfigManager } from '../../src/mcp/server-config.js';
import type { MCPServerConfig } from '../../src/mcp/types.js';

const createTestConfig = (id: string): Partial<MCPServerConfig> & { id: string; name: string } => ({
  id,
  name: `Server ${id}`,
  transport: 'stdio',
  endpoint: '/test/path',
  auth: { method: 'none' },
  permissions: ['readFiles', 'writeFiles'],
  enabled: true,
  healthCheckInterval: 0, // Disable for tests
});

describe('MCPConnectionManager', () => {
  beforeEach(() => {
    resetMCPConnectionManager();
    resetMCPConfigManager();
  });

  afterEach(() => {
    resetMCPConnectionManager();
    resetMCPConfigManager();
  });

  describe('Singleton', () => {
    it('should return singleton instance', () => {
      const mgr1 = getMCPConnectionManager();
      const mgr2 = getMCPConnectionManager();
      expect(mgr1).toBe(mgr2);
    });
  });

  describe('connect', () => {
    it('should connect to a configured server', async () => {
      const configManager = getMCPConfigManager();
      configManager.addConfig(createTestConfig('test-server'));

      const connectionManager = getMCPConnectionManager();
      const state = await connectionManager.connect('test-server');

      expect(state.status).toBe('connected');
      expect(state.serverId).toBe('test-server');
      expect(state.tools.length).toBeGreaterThan(0);
    });

    it('should fail for unconfigured server', async () => {
      const connectionManager = getMCPConnectionManager();

      await expect(connectionManager.connect('nonexistent')).rejects.toThrow(
        'Server config not found'
      );
    });

    it('should fail for disabled server', async () => {
      const configManager = getMCPConfigManager();
      configManager.addConfig({ ...createTestConfig('disabled-server'), enabled: false });

      const connectionManager = getMCPConnectionManager();

      await expect(connectionManager.connect('disabled-server')).rejects.toThrow(
        'Server is disabled'
      );
    });

    it('should return existing connection if already connected', async () => {
      const configManager = getMCPConfigManager();
      configManager.addConfig(createTestConfig('existing-server'));

      const connectionManager = getMCPConnectionManager();
      const state1 = await connectionManager.connect('existing-server');
      const state2 = await connectionManager.connect('existing-server');

      expect(state1.lastConnected).toBeDefined();
      expect(state2.lastConnected).toEqual(state1.lastConnected);
    });
  });

  describe('disconnect', () => {
    it('should disconnect from a server', async () => {
      const configManager = getMCPConfigManager();
      configManager.addConfig(createTestConfig('disconnect-test'));

      const connectionManager = getMCPConnectionManager();
      await connectionManager.connect('disconnect-test');
      await connectionManager.disconnect('disconnect-test');

      const state = connectionManager.getState('disconnect-test');
      expect(state?.status).toBe('disconnected');
    });

    it('should handle disconnect of non-connected server', async () => {
      const connectionManager = getMCPConnectionManager();

      // Should not throw
      await expect(connectionManager.disconnect('nonexistent')).resolves.toBeUndefined();
    });
  });

  describe('isConnected', () => {
    it('should return true for connected server', async () => {
      const configManager = getMCPConfigManager();
      configManager.addConfig(createTestConfig('connected-check'));

      const connectionManager = getMCPConnectionManager();
      await connectionManager.connect('connected-check');

      expect(connectionManager.isConnected('connected-check')).toBe(true);
    });

    it('should return false for disconnected server', () => {
      const connectionManager = getMCPConnectionManager();

      expect(connectionManager.isConnected('nonexistent')).toBe(false);
    });
  });

  describe('getTools', () => {
    it('should return tools from connected server', async () => {
      const configManager = getMCPConfigManager();
      configManager.addConfig(createTestConfig('tools-test'));

      const connectionManager = getMCPConnectionManager();
      await connectionManager.connect('tools-test');

      const tools = connectionManager.getTools('tools-test');
      expect(tools.length).toBeGreaterThan(0);
      expect(tools.some((t) => t.name === 'read_file')).toBe(true);
    });

    it('should return empty for non-connected server', () => {
      const connectionManager = getMCPConnectionManager();

      const tools = connectionManager.getTools('nonexistent');
      expect(tools).toHaveLength(0);
    });
  });

  describe('getAllTools', () => {
    it('should return tools from all connected servers', async () => {
      const configManager = getMCPConfigManager();
      configManager.addConfig(createTestConfig('server-1'));
      configManager.addConfig(createTestConfig('server-2'));

      const connectionManager = getMCPConnectionManager();
      await connectionManager.connect('server-1');
      await connectionManager.connect('server-2');

      const allTools = connectionManager.getAllTools();
      expect(allTools.size).toBe(2);
    });
  });

  describe('findServersWithTool', () => {
    it('should find servers with specific tool', async () => {
      const configManager = getMCPConfigManager();
      configManager.addConfig(createTestConfig('find-test'));

      const connectionManager = getMCPConnectionManager();
      await connectionManager.connect('find-test');

      const servers = connectionManager.findServersWithTool('read_file');
      expect(servers).toContain('find-test');
    });

    it('should return empty for unknown tool', async () => {
      const configManager = getMCPConfigManager();
      configManager.addConfig(createTestConfig('find-test-2'));

      const connectionManager = getMCPConnectionManager();
      await connectionManager.connect('find-test-2');

      const servers = connectionManager.findServersWithTool('unknown_tool');
      expect(servers).toHaveLength(0);
    });
  });

  describe('checkHealth', () => {
    it('should return health status', async () => {
      const configManager = getMCPConfigManager();
      configManager.addConfig(createTestConfig('health-test'));

      const connectionManager = getMCPConnectionManager();
      await connectionManager.connect('health-test');

      const health = await connectionManager.checkHealth('health-test');
      expect(health.status).toBe('connected');
      expect(health.toolCount).toBeGreaterThan(0);
    });

    it('should handle non-existent server', async () => {
      const connectionManager = getMCPConnectionManager();

      const health = await connectionManager.checkHealth('nonexistent');
      expect(health.status).toBe('disconnected');
      expect(health.error).toBe('Server not found');
    });
  });

  describe('getConnectedServers', () => {
    it('should return only connected servers', async () => {
      const configManager = getMCPConfigManager();
      configManager.addConfig(createTestConfig('connected-1'));
      configManager.addConfig(createTestConfig('connected-2'));

      const connectionManager = getMCPConnectionManager();
      await connectionManager.connect('connected-1');
      // Don't connect connected-2

      const connected = connectionManager.getConnectedServers();
      expect(connected).toHaveLength(1);
      expect(connected[0].serverId).toBe('connected-1');
    });
  });

  describe('Events', () => {
    it('should emit server:connected event', async () => {
      const configManager = getMCPConfigManager();
      configManager.addConfig(createTestConfig('event-test'));

      const connectionManager = getMCPConnectionManager();
      const events: string[] = [];
      connectionManager.on((event) => events.push(event.type));

      await connectionManager.connect('event-test');

      expect(events).toContain('server:connected');
    });

    it('should emit server:disconnected event', async () => {
      const configManager = getMCPConfigManager();
      configManager.addConfig(createTestConfig('event-disconnect'));

      const connectionManager = getMCPConnectionManager();
      await connectionManager.connect('event-disconnect');

      const events: string[] = [];
      connectionManager.on((event) => events.push(event.type));

      await connectionManager.disconnect('event-disconnect');

      expect(events).toContain('server:disconnected');
    });
  });

  describe('getStats', () => {
    it('should return connection statistics', async () => {
      const configManager = getMCPConfigManager();
      configManager.addConfig(createTestConfig('stats-1'));

      const connectionManager = getMCPConnectionManager();
      await connectionManager.connect('stats-1');

      const stats = connectionManager.getStats();
      expect(stats.total).toBe(1);
      expect(stats.connected).toBe(1);
    });
  });
});
