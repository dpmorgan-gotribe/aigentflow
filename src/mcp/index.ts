/**
 * MCP Server Framework
 *
 * Model Context Protocol integration for tool routing.
 */

// Types
export type {
  MCPTransport,
  MCPAuthMethod,
  MCPServerStatus,
  MCPPermission,
  MCPToolParameter,
  MCPTool,
  MCPAuthConfig,
  MCPServerConfig,
  MCPServerState,
  MCPToolCallRequest,
  MCPToolCallResponse,
  MCPRoutingDecision,
  MCPEventType,
  MCPEvent,
  MCPHealthCheck,
  MCPConnectionOptions,
  MCPRouterOptions,
  MCPBuiltInServer,
  MCPServerTemplate,
} from './types.js';

export {
  DEFAULT_SERVER_CONFIG,
  DEFAULT_CONNECTION_OPTIONS,
  DEFAULT_ROUTER_OPTIONS,
} from './types.js';

// Config Manager
export {
  MCPConfigManager,
  getMCPConfigManager,
  resetMCPConfigManager,
  type ConfigValidationResult,
} from './server-config.js';

// Connection Manager
export {
  MCPConnectionManager,
  getMCPConnectionManager,
  resetMCPConnectionManager,
} from './connection-manager.js';

// Tool Router
export {
  MCPToolRouter,
  getMCPToolRouter,
  resetMCPToolRouter,
  routeToolCall,
} from './tool-router.js';

// Server Templates
export {
  builtInServerTemplates,
  getServerTemplate,
  createFilesystemConfig,
  createGitConfig,
  createTerminalConfig,
  filesystemTools,
  gitTools,
  terminalTools,
  type FilesystemServerOptions,
  type GitServerOptions,
  type TerminalServerOptions,
} from './configs/index.js';

import { getMCPConfigManager } from './server-config.js';
import { getMCPConnectionManager } from './connection-manager.js';
import { builtInServerTemplates } from './configs/index.js';
import { logger } from '../utils/logger.js';

const log = logger.child({ component: 'mcp' });

/**
 * Initialize MCP framework with built-in servers
 */
export function initializeMCP(options?: {
  enableFilesystem?: boolean;
  enableGit?: boolean;
  enableTerminal?: boolean;
  autoConnect?: boolean;
}): void {
  const opts = {
    enableFilesystem: true,
    enableGit: true,
    enableTerminal: false, // Disabled by default for safety
    autoConnect: false,
    ...options,
  };

  const configManager = getMCPConfigManager();

  // Add built-in server configs
  for (const template of builtInServerTemplates) {
    const shouldEnable =
      (template.type === 'filesystem' && opts.enableFilesystem) ||
      (template.type === 'git' && opts.enableGit) ||
      (template.type === 'terminal' && opts.enableTerminal);

    if (shouldEnable) {
      const config = template.createConfig();
      configManager.addConfig(config);
    }
  }

  const stats = configManager.getStats();
  log.info('MCP framework initialized', {
    servers: stats.total,
    enabled: stats.enabled,
  });

  // Auto-connect if requested
  if (opts.autoConnect) {
    const connectionManager = getMCPConnectionManager();
    connectionManager.connectAll().then((results) => {
      const connected = Array.from(results.values()).filter(
        (r) => !(r instanceof Error)
      ).length;
      log.info('Auto-connect completed', {
        connected,
        failed: results.size - connected,
      });
    });
  }
}

/**
 * Reset all MCP singletons (for testing)
 */
export function resetMCP(): void {
  const { resetMCPConfigManager } = require('./server-config.js');
  const { resetMCPConnectionManager } = require('./connection-manager.js');
  const { resetMCPToolRouter } = require('./tool-router.js');

  resetMCPToolRouter();
  resetMCPConnectionManager();
  resetMCPConfigManager();
}
