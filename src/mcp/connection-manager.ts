/**
 * MCP Connection Manager
 *
 * Manages server connections, lifecycle, and health monitoring.
 */

import { logger } from '../utils/logger.js';
import { getMCPConfigManager } from './server-config.js';
import type {
  MCPServerConfig,
  MCPServerState,
  MCPServerStatus,
  MCPTool,
  MCPHealthCheck,
  MCPEvent,
  MCPEventType,
  MCPConnectionOptions,
} from './types.js';
import { DEFAULT_CONNECTION_OPTIONS } from './types.js';

const log = logger.child({ component: 'mcp-connections' });

/**
 * MCP Connection Manager
 */
export class MCPConnectionManager {
  private static instance: MCPConnectionManager | null = null;
  private serverStates: Map<string, MCPServerState> = new Map();
  private options: MCPConnectionOptions;
  private eventListeners: Array<(event: MCPEvent) => void> = [];
  private healthCheckIntervals: Map<string, NodeJS.Timeout> = new Map();

  private constructor(options: Partial<MCPConnectionOptions> = {}) {
    this.options = { ...DEFAULT_CONNECTION_OPTIONS, ...options };
  }

  /**
   * Get singleton instance
   */
  static getInstance(options?: Partial<MCPConnectionOptions>): MCPConnectionManager {
    if (!MCPConnectionManager.instance) {
      MCPConnectionManager.instance = new MCPConnectionManager(options);
    }
    return MCPConnectionManager.instance;
  }

  /**
   * Reset singleton (for testing)
   */
  static reset(): void {
    if (MCPConnectionManager.instance) {
      MCPConnectionManager.instance.disconnectAll();
    }
    MCPConnectionManager.instance = null;
  }

  /**
   * Add event listener
   */
  on(listener: (event: MCPEvent) => void): void {
    this.eventListeners.push(listener);
  }

  /**
   * Remove event listener
   */
  off(listener: (event: MCPEvent) => void): void {
    const index = this.eventListeners.indexOf(listener);
    if (index > -1) {
      this.eventListeners.splice(index, 1);
    }
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
   * Connect to a server
   */
  async connect(serverId: string): Promise<MCPServerState> {
    const configManager = getMCPConfigManager();
    const config = configManager.getConfig(serverId);

    if (!config) {
      throw new Error(`Server config not found: ${serverId}`);
    }

    if (!config.enabled) {
      throw new Error(`Server is disabled: ${serverId}`);
    }

    // Check if already connected
    const existing = this.serverStates.get(serverId);
    if (existing && existing.status === 'connected') {
      return existing;
    }

    // Update state to connecting
    const state: MCPServerState = {
      serverId,
      status: 'connecting',
      reconnectAttempts: existing?.reconnectAttempts ?? 0,
      tools: [],
    };
    this.serverStates.set(serverId, state);

    try {
      // Simulate connection based on transport type
      const tools = await this.establishConnection(config);

      // Update state to connected
      state.status = 'connected';
      state.lastConnected = new Date();
      state.tools = tools;
      state.reconnectAttempts = 0;

      log.info('Server connected', {
        serverId,
        transport: config.transport,
        toolCount: tools.length,
      });

      this.emit('server:connected', serverId, {
        transport: config.transport,
        toolCount: tools.length,
      });

      // Start health check if configured
      if (config.healthCheckInterval > 0) {
        this.startHealthCheck(serverId, config.healthCheckInterval);
      }

      return state;
    } catch (error) {
      state.status = 'error';
      state.lastError = error instanceof Error ? error.message : String(error);

      log.error('Server connection failed', {
        serverId,
        error: state.lastError,
      });

      this.emit('server:error', serverId, { error: state.lastError });

      // Auto-reconnect if enabled
      if (config.autoReconnect && state.reconnectAttempts < config.maxReconnectAttempts) {
        state.reconnectAttempts++;
        log.info('Scheduling reconnection', {
          serverId,
          attempt: state.reconnectAttempts,
        });
        // In real implementation, schedule reconnection with backoff
      }

      throw error;
    }
  }

  /**
   * Establish connection to server (simulated for MVP)
   */
  private async establishConnection(config: MCPServerConfig): Promise<MCPTool[]> {
    // Simulate connection delay
    await new Promise((resolve) => setTimeout(resolve, 100));

    // In real implementation, this would:
    // - For stdio: spawn process and communicate via stdin/stdout
    // - For http: make HTTP requests
    // - For websocket: establish WS connection

    // Return mock tools based on server type for now
    return this.getMockTools(config);
  }

  /**
   * Get mock tools for simulation
   */
  private getMockTools(config: MCPServerConfig): MCPTool[] {
    // Return tools based on permissions
    const tools: MCPTool[] = [];

    if (config.permissions.includes('readFiles')) {
      tools.push({
        name: 'read_file',
        description: 'Read file contents',
        parameters: [
          { name: 'path', type: 'string', description: 'File path', required: true },
        ],
        requiredPermissions: ['readFiles'],
      });
    }

    if (config.permissions.includes('writeFiles')) {
      tools.push({
        name: 'write_file',
        description: 'Write file contents',
        parameters: [
          { name: 'path', type: 'string', description: 'File path', required: true },
          { name: 'content', type: 'string', description: 'File content', required: true },
        ],
        requiredPermissions: ['writeFiles'],
      });
    }

    if (config.permissions.includes('executeCommands')) {
      tools.push({
        name: 'execute_command',
        description: 'Execute shell command',
        parameters: [
          { name: 'command', type: 'string', description: 'Command to execute', required: true },
          { name: 'cwd', type: 'string', description: 'Working directory', required: false },
        ],
        requiredPermissions: ['executeCommands'],
      });
    }

    return tools;
  }

  /**
   * Disconnect from a server
   */
  async disconnect(serverId: string): Promise<void> {
    const state = this.serverStates.get(serverId);
    if (!state) {
      return;
    }

    // Stop health check
    this.stopHealthCheck(serverId);

    // Update state
    state.status = 'disconnected';
    state.tools = [];

    log.info('Server disconnected', { serverId });
    this.emit('server:disconnected', serverId);
  }

  /**
   * Disconnect from all servers
   */
  async disconnectAll(): Promise<void> {
    const serverIds = Array.from(this.serverStates.keys());
    for (const serverId of serverIds) {
      await this.disconnect(serverId);
    }
  }

  /**
   * Get server state
   */
  getState(serverId: string): MCPServerState | undefined {
    return this.serverStates.get(serverId);
  }

  /**
   * Get all server states
   */
  getAllStates(): MCPServerState[] {
    return Array.from(this.serverStates.values());
  }

  /**
   * Get connected servers
   */
  getConnectedServers(): MCPServerState[] {
    return Array.from(this.serverStates.values()).filter((s) => s.status === 'connected');
  }

  /**
   * Check if server is connected
   */
  isConnected(serverId: string): boolean {
    const state = this.serverStates.get(serverId);
    return state?.status === 'connected';
  }

  /**
   * Get tools from a server
   */
  getTools(serverId: string): MCPTool[] {
    const state = this.serverStates.get(serverId);
    return state?.tools ?? [];
  }

  /**
   * Get all available tools across all connected servers
   */
  getAllTools(): Map<string, MCPTool[]> {
    const result = new Map<string, MCPTool[]>();
    for (const [serverId, state] of this.serverStates) {
      if (state.status === 'connected' && state.tools.length > 0) {
        result.set(serverId, state.tools);
      }
    }
    return result;
  }

  /**
   * Find servers that have a specific tool
   */
  findServersWithTool(toolName: string): string[] {
    const servers: string[] = [];
    for (const [serverId, state] of this.serverStates) {
      if (state.status === 'connected' && state.tools.some((t) => t.name === toolName)) {
        servers.push(serverId);
      }
    }
    return servers;
  }

  /**
   * Start health check for a server
   */
  private startHealthCheck(serverId: string, interval: number): void {
    // Stop any existing interval
    this.stopHealthCheck(serverId);

    const intervalId = setInterval(async () => {
      await this.checkHealth(serverId);
    }, interval);

    this.healthCheckIntervals.set(serverId, intervalId);
  }

  /**
   * Stop health check for a server
   */
  private stopHealthCheck(serverId: string): void {
    const intervalId = this.healthCheckIntervals.get(serverId);
    if (intervalId) {
      clearInterval(intervalId);
      this.healthCheckIntervals.delete(serverId);
    }
  }

  /**
   * Check health of a server
   */
  async checkHealth(serverId: string): Promise<MCPHealthCheck> {
    const state = this.serverStates.get(serverId);
    const startTime = Date.now();

    if (!state) {
      return {
        serverId,
        status: 'disconnected',
        latency: 0,
        toolCount: 0,
        lastCheck: new Date(),
        error: 'Server not found',
      };
    }

    try {
      // Simulate health check
      await new Promise((resolve) => setTimeout(resolve, 10));
      const latency = Date.now() - startTime;

      state.latency = latency;

      this.emit('health:check', serverId, {
        status: state.status,
        latency,
        toolCount: state.tools.length,
      });

      return {
        serverId,
        status: state.status,
        latency,
        toolCount: state.tools.length,
        lastCheck: new Date(),
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      state.status = 'error';
      state.lastError = errorMessage;

      return {
        serverId,
        status: 'error',
        latency: Date.now() - startTime,
        toolCount: 0,
        lastCheck: new Date(),
        error: errorMessage,
      };
    }
  }

  /**
   * Check health of all servers
   */
  async checkAllHealth(): Promise<MCPHealthCheck[]> {
    const serverIds = Array.from(this.serverStates.keys());
    return Promise.all(serverIds.map((id) => this.checkHealth(id)));
  }

  /**
   * Connect to all enabled servers
   */
  async connectAll(): Promise<Map<string, MCPServerState | Error>> {
    const configManager = getMCPConfigManager();
    const configs = configManager.getEnabledConfigs();
    const results = new Map<string, MCPServerState | Error>();

    for (const config of configs) {
      try {
        const state = await this.connect(config.id);
        results.set(config.id, state);
      } catch (error) {
        results.set(config.id, error instanceof Error ? error : new Error(String(error)));
      }
    }

    return results;
  }

  /**
   * Get connection statistics
   */
  getStats(): Record<string, unknown> {
    const states = this.getAllStates();
    const statusCounts: Record<MCPServerStatus, number> = {
      disconnected: 0,
      connecting: 0,
      connected: 0,
      error: 0,
      degraded: 0,
    };

    for (const state of states) {
      statusCounts[state.status]++;
    }

    return {
      total: states.length,
      ...statusCounts,
      totalTools: states.reduce((sum, s) => sum + s.tools.length, 0),
      avgLatency:
        states.reduce((sum, s) => sum + (s.latency ?? 0), 0) / Math.max(states.length, 1),
    };
  }
}

/**
 * Get connection manager singleton
 */
export function getMCPConnectionManager(
  options?: Partial<MCPConnectionOptions>
): MCPConnectionManager {
  return MCPConnectionManager.getInstance(options);
}

/**
 * Reset connection manager (for testing)
 */
export function resetMCPConnectionManager(): void {
  MCPConnectionManager.reset();
}
