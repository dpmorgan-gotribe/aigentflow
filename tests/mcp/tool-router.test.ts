/**
 * MCP Tool Router Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  MCPToolRouter,
  getMCPToolRouter,
  resetMCPToolRouter,
  routeToolCall,
} from '../../src/mcp/tool-router.js';
import { getMCPConnectionManager, resetMCPConnectionManager } from '../../src/mcp/connection-manager.js';
import { getMCPConfigManager, resetMCPConfigManager } from '../../src/mcp/server-config.js';
import type { MCPServerConfig } from '../../src/mcp/types.js';

const createTestConfig = (
  id: string,
  options: Partial<MCPServerConfig> = {}
): Partial<MCPServerConfig> & { id: string; name: string } => ({
  id,
  name: `Server ${id}`,
  transport: 'stdio',
  endpoint: '/test/path',
  auth: { method: 'none' },
  permissions: ['readFiles', 'writeFiles', 'executeCommands'],
  enabled: true,
  priority: 100,
  healthCheckInterval: 0,
  ...options,
});

describe('MCPToolRouter', () => {
  beforeEach(() => {
    resetMCPToolRouter();
    resetMCPConnectionManager();
    resetMCPConfigManager();
  });

  afterEach(() => {
    resetMCPToolRouter();
    resetMCPConnectionManager();
    resetMCPConfigManager();
  });

  describe('Singleton', () => {
    it('should return singleton instance', () => {
      const router1 = getMCPToolRouter();
      const router2 = getMCPToolRouter();
      expect(router1).toBe(router2);
    });
  });

  describe('findRoute', () => {
    it('should find route for available tool', async () => {
      const configManager = getMCPConfigManager();
      configManager.addConfig(createTestConfig('route-test'));

      const connectionManager = getMCPConnectionManager();
      await connectionManager.connect('route-test');

      const router = getMCPToolRouter();
      const decision = router.findRoute('read_file');

      expect(decision).toBeDefined();
      expect(decision?.serverId).toBe('route-test');
      expect(decision?.tool.name).toBe('read_file');
    });

    it('should return undefined for unavailable tool', () => {
      const router = getMCPToolRouter();
      const decision = router.findRoute('nonexistent_tool');

      expect(decision).toBeUndefined();
    });

    it('should prefer higher priority server', async () => {
      const configManager = getMCPConfigManager();
      configManager.addConfig(createTestConfig('low-priority', { priority: 50 }));
      configManager.addConfig(createTestConfig('high-priority', { priority: 150 }));

      const connectionManager = getMCPConnectionManager();
      await connectionManager.connect('low-priority');
      await connectionManager.connect('high-priority');

      const router = getMCPToolRouter();
      const decision = router.findRoute('read_file');

      expect(decision?.serverId).toBe('high-priority');
    });
  });

  describe('routeCall', () => {
    it('should route and execute tool call', async () => {
      const configManager = getMCPConfigManager();
      configManager.addConfig(createTestConfig('exec-test'));

      const connectionManager = getMCPConnectionManager();
      await connectionManager.connect('exec-test');

      const response = await routeToolCall({
        requestId: 'req-1',
        toolName: 'read_file',
        arguments: { path: '/test/file.txt' },
      });

      expect(response.success).toBe(true);
      expect(response.serverId).toBe('exec-test');
      expect(response.result).toBeDefined();
    });

    it('should route to specific server if specified', async () => {
      const configManager = getMCPConfigManager();
      configManager.addConfig(createTestConfig('specific-test'));

      const connectionManager = getMCPConnectionManager();
      await connectionManager.connect('specific-test');

      const response = await routeToolCall({
        requestId: 'req-2',
        serverId: 'specific-test',
        toolName: 'read_file',
        arguments: { path: '/test/file.txt' },
      });

      expect(response.success).toBe(true);
      expect(response.serverId).toBe('specific-test');
    });

    it('should fail for unavailable tool', async () => {
      const configManager = getMCPConfigManager();
      configManager.addConfig(createTestConfig('unavailable-test'));

      const connectionManager = getMCPConnectionManager();
      await connectionManager.connect('unavailable-test');

      const response = await routeToolCall({
        requestId: 'req-3',
        toolName: 'nonexistent_tool',
        arguments: {},
      });

      expect(response.success).toBe(false);
      expect(response.error).toContain('No server found');
    });

    it('should fail for disconnected server', async () => {
      const configManager = getMCPConfigManager();
      configManager.addConfig(createTestConfig('disconnected-test'));

      // Don't connect the server

      const response = await routeToolCall({
        requestId: 'req-4',
        serverId: 'disconnected-test',
        toolName: 'read_file',
        arguments: {},
      });

      expect(response.success).toBe(false);
      expect(response.error).toContain('not connected');
    });
  });

  describe('isToolAvailable', () => {
    it('should return true for available tool', async () => {
      const configManager = getMCPConfigManager();
      configManager.addConfig(createTestConfig('available-test'));

      const connectionManager = getMCPConnectionManager();
      await connectionManager.connect('available-test');

      const router = getMCPToolRouter();
      expect(router.isToolAvailable('read_file')).toBe(true);
    });

    it('should return false for unavailable tool', () => {
      const router = getMCPToolRouter();
      expect(router.isToolAvailable('nonexistent_tool')).toBe(false);
    });
  });

  describe('getAvailableTools', () => {
    it('should return map of tools to servers', async () => {
      const configManager = getMCPConfigManager();
      configManager.addConfig(createTestConfig('tools-1'));
      configManager.addConfig(createTestConfig('tools-2'));

      const connectionManager = getMCPConnectionManager();
      await connectionManager.connect('tools-1');
      await connectionManager.connect('tools-2');

      const router = getMCPToolRouter();
      const tools = router.getAvailableTools();

      expect(tools.size).toBeGreaterThan(0);
      expect(tools.get('read_file')).toContain('tools-1');
      expect(tools.get('read_file')).toContain('tools-2');
    });
  });

  describe('Caching', () => {
    it('should cache routing decisions', async () => {
      const configManager = getMCPConfigManager();
      configManager.addConfig(createTestConfig('cache-test'));

      const connectionManager = getMCPConnectionManager();
      await connectionManager.connect('cache-test');

      const router = getMCPToolRouter({ cacheRouting: true, cacheTtl: 60000 });

      const decision1 = router.findRoute('read_file');
      const decision2 = router.findRoute('read_file');

      expect(decision1).toEqual(decision2);
    });

    it('should clear cache', async () => {
      const configManager = getMCPConfigManager();
      configManager.addConfig(createTestConfig('clear-cache-test'));

      const connectionManager = getMCPConnectionManager();
      await connectionManager.connect('clear-cache-test');

      const router = getMCPToolRouter({ cacheRouting: true });
      router.findRoute('read_file');

      const statsBefore = router.getStats();
      expect(statsBefore.cacheSize).toBe(1);

      router.clearCache();

      const statsAfter = router.getStats();
      expect(statsAfter.cacheSize).toBe(0);
    });
  });

  describe('Events', () => {
    it('should emit tool:call_started event', async () => {
      const configManager = getMCPConfigManager();
      configManager.addConfig(createTestConfig('event-start-test'));

      const connectionManager = getMCPConnectionManager();
      await connectionManager.connect('event-start-test');

      const router = getMCPToolRouter();
      const events: string[] = [];
      router.on((event) => events.push(event.type));

      await routeToolCall({
        requestId: 'req-event',
        toolName: 'read_file',
        arguments: { path: '/test' },
      });

      expect(events).toContain('tool:call_started');
    });

    it('should emit tool:call_completed event', async () => {
      const configManager = getMCPConfigManager();
      configManager.addConfig(createTestConfig('event-complete-test'));

      const connectionManager = getMCPConnectionManager();
      await connectionManager.connect('event-complete-test');

      const router = getMCPToolRouter();
      const events: string[] = [];
      router.on((event) => events.push(event.type));

      await routeToolCall({
        requestId: 'req-event-2',
        toolName: 'read_file',
        arguments: { path: '/test' },
      });

      expect(events).toContain('tool:call_completed');
    });
  });

  describe('getStats', () => {
    it('should return router statistics', async () => {
      const configManager = getMCPConfigManager();
      configManager.addConfig(createTestConfig('stats-test'));

      const connectionManager = getMCPConnectionManager();
      await connectionManager.connect('stats-test');

      const router = getMCPToolRouter();
      router.findRoute('read_file');

      const stats = router.getStats();
      expect(stats.availableTools).toBeGreaterThan(0);
    });
  });
});
