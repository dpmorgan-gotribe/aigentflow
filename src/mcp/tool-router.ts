/**
 * MCP Tool Router
 *
 * Routes tool calls to appropriate MCP servers based on
 * tool availability, permissions, and priority.
 */

import { logger } from '../utils/logger.js';
import { getMCPConnectionManager } from './connection-manager.js';
import { getMCPConfigManager } from './server-config.js';
import type {
  MCPToolCallRequest,
  MCPToolCallResponse,
  MCPRoutingDecision,
  MCPTool,
  MCPPermission,
  MCPRouterOptions,
  MCPEvent,
  MCPEventType,
} from './types.js';
import { DEFAULT_ROUTER_OPTIONS } from './types.js';

const log = logger.child({ component: 'mcp-router' });

/**
 * Routing cache entry
 */
interface RoutingCacheEntry {
  decision: MCPRoutingDecision;
  timestamp: Date;
}

/**
 * MCP Tool Router
 */
export class MCPToolRouter {
  private static instance: MCPToolRouter | null = null;
  private options: MCPRouterOptions;
  private routingCache: Map<string, RoutingCacheEntry> = new Map();
  private eventListeners: Array<(event: MCPEvent) => void> = [];
  private loadBalanceIndex: Map<string, number> = new Map();

  private constructor(options: Partial<MCPRouterOptions> = {}) {
    this.options = { ...DEFAULT_ROUTER_OPTIONS, ...options };
  }

  /**
   * Get singleton instance
   */
  static getInstance(options?: Partial<MCPRouterOptions>): MCPToolRouter {
    if (!MCPToolRouter.instance) {
      MCPToolRouter.instance = new MCPToolRouter(options);
    }
    return MCPToolRouter.instance;
  }

  /**
   * Reset singleton (for testing)
   */
  static reset(): void {
    MCPToolRouter.instance = null;
  }

  /**
   * Add event listener
   */
  on(listener: (event: MCPEvent) => void): void {
    this.eventListeners.push(listener);
  }

  /**
   * Emit event
   */
  private emit(type: MCPEventType, serverId: string, data?: Record<string, unknown>): void {
    const event: MCPEvent = {
      type,
      serverId,
      timestamp: new Date(),
      data,
    };
    this.eventListeners.forEach((listener) => listener(event));
  }

  /**
   * Route a tool call to the appropriate server
   */
  async routeCall(request: MCPToolCallRequest): Promise<MCPToolCallResponse> {
    const startTime = Date.now();

    try {
      // If specific server requested, use it
      if (request.serverId) {
        return this.executeOnServer(request, request.serverId);
      }

      // Find routing decision
      const decision = this.findRoute(request.toolName, request.requiredPermissions);
      if (!decision) {
        return {
          requestId: request.requestId,
          serverId: '',
          toolName: request.toolName,
          success: false,
          error: `No server found for tool: ${request.toolName}`,
          executionTime: Date.now() - startTime,
        };
      }

      return this.executeOnServer(request, decision.serverId);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      log.error('Tool call routing failed', {
        requestId: request.requestId,
        toolName: request.toolName,
        error: errorMessage,
      });

      return {
        requestId: request.requestId,
        serverId: '',
        toolName: request.toolName,
        success: false,
        error: errorMessage,
        executionTime: Date.now() - startTime,
      };
    }
  }

  /**
   * Execute tool call on a specific server
   */
  private async executeOnServer(
    request: MCPToolCallRequest,
    serverId: string
  ): Promise<MCPToolCallResponse> {
    const startTime = Date.now();
    const connectionManager = getMCPConnectionManager();

    // Check server is connected
    if (!connectionManager.isConnected(serverId)) {
      return {
        requestId: request.requestId,
        serverId,
        toolName: request.toolName,
        success: false,
        error: `Server not connected: ${serverId}`,
        executionTime: Date.now() - startTime,
      };
    }

    // Check tool exists on server
    const tools = connectionManager.getTools(serverId);
    const tool = tools.find((t) => t.name === request.toolName);
    if (!tool) {
      return {
        requestId: request.requestId,
        serverId,
        toolName: request.toolName,
        success: false,
        error: `Tool not found on server: ${request.toolName}`,
        executionTime: Date.now() - startTime,
      };
    }

    // Check permissions
    const configManager = getMCPConfigManager();
    const config = configManager.getConfig(serverId);
    if (config && !this.hasRequiredPermissions(config.permissions, tool.requiredPermissions)) {
      return {
        requestId: request.requestId,
        serverId,
        toolName: request.toolName,
        success: false,
        error: 'Insufficient permissions for tool',
        executionTime: Date.now() - startTime,
      };
    }

    this.emit('tool:call_started', serverId, {
      requestId: request.requestId,
      toolName: request.toolName,
    });

    try {
      // Simulate tool execution (in real implementation, send to server)
      const result = await this.simulateToolExecution(tool, request.arguments);

      log.info('Tool call completed', {
        requestId: request.requestId,
        serverId,
        toolName: request.toolName,
        executionTime: Date.now() - startTime,
      });

      this.emit('tool:call_completed', serverId, {
        requestId: request.requestId,
        toolName: request.toolName,
        executionTime: Date.now() - startTime,
      });

      return {
        requestId: request.requestId,
        serverId,
        toolName: request.toolName,
        success: true,
        result,
        executionTime: Date.now() - startTime,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      this.emit('tool:call_failed', serverId, {
        requestId: request.requestId,
        toolName: request.toolName,
        error: errorMessage,
      });

      return {
        requestId: request.requestId,
        serverId,
        toolName: request.toolName,
        success: false,
        error: errorMessage,
        executionTime: Date.now() - startTime,
      };
    }
  }

  /**
   * Simulate tool execution (placeholder for real implementation)
   */
  private async simulateToolExecution(
    tool: MCPTool,
    args: Record<string, unknown>
  ): Promise<unknown> {
    // Simulate async execution
    await new Promise((resolve) => setTimeout(resolve, 50));

    // Return mock result based on tool
    switch (tool.name) {
      case 'read_file':
        return { content: `Mock content for ${args.path}`, size: 100 };
      case 'write_file':
        return { success: true, bytesWritten: (args.content as string)?.length ?? 0 };
      case 'execute_command':
        return { exitCode: 0, stdout: `Executed: ${args.command}`, stderr: '' };
      default:
        return { executed: tool.name, args };
    }
  }

  /**
   * Find the best route for a tool call
   */
  findRoute(
    toolName: string,
    requiredPermissions?: MCPPermission[]
  ): MCPRoutingDecision | undefined {
    // Check cache first
    if (this.options.cacheRouting) {
      const cached = this.getCachedRoute(toolName);
      if (cached) {
        return cached;
      }
    }

    const connectionManager = getMCPConnectionManager();
    const configManager = getMCPConfigManager();
    const candidates: Array<{
      serverId: string;
      serverName: string;
      tool: MCPTool;
      priority: number;
      latency: number;
    }> = [];

    // Find all servers with this tool
    const serverIds = connectionManager.findServersWithTool(toolName);

    for (const serverId of serverIds) {
      const config = configManager.getConfig(serverId);
      const state = connectionManager.getState(serverId);
      const tools = connectionManager.getTools(serverId);
      const tool = tools.find((t) => t.name === toolName);

      if (!config || !tool || state?.status !== 'connected') {
        continue;
      }

      // Check permissions
      if (requiredPermissions && !this.hasRequiredPermissions(config.permissions, requiredPermissions)) {
        continue;
      }

      candidates.push({
        serverId,
        serverName: config.name,
        tool,
        priority: config.priority,
        latency: state.latency ?? 0,
      });
    }

    if (candidates.length === 0) {
      return undefined;
    }

    // Sort by priority (higher first), then by latency (lower first)
    candidates.sort((a, b) => {
      if (a.priority !== b.priority) {
        return b.priority - a.priority;
      }
      return a.latency - b.latency;
    });

    // Select server (with optional load balancing)
    let selected = candidates[0];
    if (this.options.loadBalance && candidates.length > 1) {
      selected = this.selectWithLoadBalance(toolName, candidates);
    }

    const decision: MCPRoutingDecision = {
      serverId: selected.serverId,
      serverName: selected.serverName,
      tool: selected.tool,
      confidence: 1.0,
      reason: `Selected by priority (${selected.priority}) and latency (${selected.latency}ms)`,
    };

    // Cache decision
    if (this.options.cacheRouting) {
      this.cacheRoute(toolName, decision);
    }

    return decision;
  }

  /**
   * Select server with round-robin load balancing
   */
  private selectWithLoadBalance(
    toolName: string,
    candidates: Array<{ serverId: string; serverName: string; tool: MCPTool; priority: number; latency: number }>
  ): typeof candidates[0] {
    // Get current index for this tool
    const currentIndex = this.loadBalanceIndex.get(toolName) ?? 0;
    const nextIndex = (currentIndex + 1) % candidates.length;
    this.loadBalanceIndex.set(toolName, nextIndex);

    return candidates[currentIndex];
  }

  /**
   * Check if server has required permissions
   */
  private hasRequiredPermissions(
    serverPermissions: MCPPermission[],
    required: MCPPermission[]
  ): boolean {
    return required.every((perm) => serverPermissions.includes(perm));
  }

  /**
   * Get cached routing decision
   */
  private getCachedRoute(toolName: string): MCPRoutingDecision | undefined {
    const entry = this.routingCache.get(toolName);
    if (!entry) {
      return undefined;
    }

    // Check if cache is still valid
    const age = Date.now() - entry.timestamp.getTime();
    if (age > this.options.cacheTtl) {
      this.routingCache.delete(toolName);
      return undefined;
    }

    return entry.decision;
  }

  /**
   * Cache a routing decision
   */
  private cacheRoute(toolName: string, decision: MCPRoutingDecision): void {
    this.routingCache.set(toolName, {
      decision,
      timestamp: new Date(),
    });
  }

  /**
   * Clear routing cache
   */
  clearCache(): void {
    this.routingCache.clear();
    this.loadBalanceIndex.clear();
  }

  /**
   * Get all available tools with their servers
   */
  getAvailableTools(): Map<string, string[]> {
    const result = new Map<string, string[]>();
    const connectionManager = getMCPConnectionManager();
    const allTools = connectionManager.getAllTools();

    for (const [serverId, tools] of allTools) {
      for (const tool of tools) {
        const servers = result.get(tool.name) ?? [];
        servers.push(serverId);
        result.set(tool.name, servers);
      }
    }

    return result;
  }

  /**
   * Check if a tool is available
   */
  isToolAvailable(toolName: string): boolean {
    const connectionManager = getMCPConnectionManager();
    return connectionManager.findServersWithTool(toolName).length > 0;
  }

  /**
   * Get router statistics
   */
  getStats(): Record<string, unknown> {
    const availableTools = this.getAvailableTools();

    return {
      cacheSize: this.routingCache.size,
      cacheTtl: this.options.cacheTtl,
      loadBalancing: this.options.loadBalance,
      availableTools: availableTools.size,
      toolServers: Object.fromEntries(availableTools),
    };
  }
}

/**
 * Get tool router singleton
 */
export function getMCPToolRouter(options?: Partial<MCPRouterOptions>): MCPToolRouter {
  return MCPToolRouter.getInstance(options);
}

/**
 * Reset tool router (for testing)
 */
export function resetMCPToolRouter(): void {
  MCPToolRouter.reset();
}

/**
 * Convenience function to route a tool call
 */
export async function routeToolCall(
  request: MCPToolCallRequest
): Promise<MCPToolCallResponse> {
  return getMCPToolRouter().routeCall(request);
}
