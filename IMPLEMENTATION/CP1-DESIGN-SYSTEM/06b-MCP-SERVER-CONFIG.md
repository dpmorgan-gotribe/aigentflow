# Step 06b: MCP Server Configuration

> **Checkpoint:** CP1 - Design System
> **Previous Step:** 06a-SKILLS-FRAMEWORK.md
> **Next Step:** 07-CONTEXT-MANAGEMENT.md

---

## Overview

The **MCP Server Configuration** system defines and manages connections to Model Context Protocol (MCP) servers that provide extended capabilities to agents. MCP servers enable file system access, git operations, database queries, web fetching, and more.

Key responsibilities:
- Define MCP server configurations
- Manage server connections and lifecycle
- Route tool calls to appropriate servers
- Handle authentication and permissions
- Monitor server health

---

## Deliverables

1. `src/mcp/types.ts` - Core MCP types
2. `src/mcp/server-config.ts` - Server configuration management
3. `src/mcp/connection-manager.ts` - Server connection lifecycle
4. `src/mcp/tool-router.ts` - Route tool calls to servers
5. `src/mcp/configs/` - Built-in server configurations

---

## 1. Core Types (`src/mcp/types.ts`)

```typescript
/**
 * MCP Server Types
 */

import { z } from 'zod';

/**
 * MCP transport type
 */
export const TransportTypeSchema = z.enum([
  'stdio',     // Standard input/output
  'http',      // HTTP/REST
  'websocket', // WebSocket
  'ipc',       // Inter-process communication
]);

export type TransportType = z.infer<typeof TransportTypeSchema>;

/**
 * Server status
 */
export const ServerStatusSchema = z.enum([
  'disconnected',
  'connecting',
  'connected',
  'error',
  'disabled',
]);

export type ServerStatus = z.infer<typeof ServerStatusSchema>;

/**
 * Authentication method
 */
export const AuthMethodSchema = z.enum([
  'none',
  'api_key',
  'oauth',
  'token',
  'certificate',
]);

export type AuthMethod = z.infer<typeof AuthMethodSchema>;

/**
 * MCP tool definition
 */
export const McpToolSchema = z.object({
  name: z.string(),
  description: z.string(),
  inputSchema: z.record(z.unknown()),
  required: z.array(z.string()).optional(),
});

export type McpTool = z.infer<typeof McpToolSchema>;

/**
 * MCP resource definition
 */
export const McpResourceSchema = z.object({
  name: z.string(),
  uri: z.string(),
  mimeType: z.string().optional(),
  description: z.string().optional(),
});

export type McpResource = z.infer<typeof McpResourceSchema>;

/**
 * MCP server configuration
 */
export const McpServerConfigSchema = z.object({
  // Identity
  id: z.string(),
  name: z.string(),
  description: z.string(),
  version: z.string(),

  // Connection
  transport: TransportTypeSchema,
  command: z.string().optional(),      // For stdio
  args: z.array(z.string()).optional(), // Command arguments
  url: z.string().url().optional(),    // For http/websocket
  env: z.record(z.string()).optional(), // Environment variables

  // Authentication
  auth: z.object({
    method: AuthMethodSchema,
    keyEnvVar: z.string().optional(),  // Env var containing the key
    tokenPath: z.string().optional(),  // Path to token file
    certPath: z.string().optional(),   // Path to certificate
  }).optional(),

  // Capabilities
  tools: z.array(McpToolSchema).optional(),
  resources: z.array(McpResourceSchema).optional(),

  // Settings
  enabled: z.boolean().default(true),
  autoConnect: z.boolean().default(true),
  timeout: z.number().int().positive().default(30000),
  retries: z.number().int().min(0).default(3),
  retryDelay: z.number().int().min(0).default(1000),

  // Permissions
  permissions: z.object({
    readFiles: z.boolean().default(false),
    writeFiles: z.boolean().default(false),
    executeCommands: z.boolean().default(false),
    networkAccess: z.boolean().default(false),
    databaseAccess: z.boolean().default(false),
  }).optional(),

  // Scope
  scope: z.enum(['global', 'project', 'session']).default('project'),
});

export type McpServerConfig = z.infer<typeof McpServerConfigSchema>;

/**
 * Server connection state
 */
export interface ServerConnection {
  config: McpServerConfig;
  status: ServerStatus;
  connectedAt?: Date;
  lastError?: Error;
  availableTools: McpTool[];
  availableResources: McpResource[];
}

/**
 * Tool call request
 */
export interface ToolCallRequest {
  serverId: string;
  toolName: string;
  arguments: Record<string, unknown>;
  timeout?: number;
}

/**
 * Tool call result
 */
export interface ToolCallResult {
  success: boolean;
  result?: unknown;
  error?: string;
  duration: number;
}
```

---

## 2. Server Configuration (`src/mcp/server-config.ts`)

```typescript
/**
 * MCP Server Configuration Manager
 *
 * Manages loading and validation of MCP server configurations.
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { z } from 'zod';
import {
  McpServerConfig,
  McpServerConfigSchema,
} from './types';
import { logger } from '../utils/logger';

/**
 * Configuration sources
 */
export interface ConfigSources {
  builtInPath: string;
  globalPath?: string;
  projectPath?: string;
}

/**
 * Server Configuration Manager
 */
export class ServerConfigManager {
  private configs: Map<string, McpServerConfig> = new Map();
  private sources: ConfigSources;

  constructor(sources: ConfigSources) {
    this.sources = sources;
  }

  /**
   * Load all configurations
   */
  async loadAll(): Promise<void> {
    // Load built-in configs (lowest priority)
    await this.loadFromDirectory(this.sources.builtInPath, 'built-in');

    // Load global configs (medium priority)
    if (this.sources.globalPath) {
      try {
        await this.loadFromDirectory(this.sources.globalPath, 'global');
      } catch (error) {
        logger.debug('No global MCP configs found');
      }
    }

    // Load project configs (highest priority)
    if (this.sources.projectPath) {
      try {
        await this.loadFromDirectory(this.sources.projectPath, 'project');
      } catch (error) {
        logger.debug('No project MCP configs found');
      }
    }

    logger.info('MCP configs loaded', { count: this.configs.size });
  }

  /**
   * Load configs from a directory
   */
  private async loadFromDirectory(dirPath: string, source: string): Promise<void> {
    let files: string[];

    try {
      files = await fs.readdir(dirPath);
    } catch (error) {
      logger.debug('Config directory not found', { path: dirPath });
      return;
    }

    for (const file of files) {
      if (!file.endsWith('.json')) continue;

      const filePath = path.join(dirPath, file);
      await this.loadConfigFile(filePath, source);
    }
  }

  /**
   * Load a single config file
   */
  private async loadConfigFile(filePath: string, source: string): Promise<void> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const data = JSON.parse(content);

      // Can be a single config or array of configs
      const configs = Array.isArray(data) ? data : [data];

      for (const config of configs) {
        const validated = McpServerConfigSchema.parse(config);

        // Override existing configs from lower priority sources
        if (this.configs.has(validated.id)) {
          logger.debug('Overriding MCP config', {
            id: validated.id,
            source,
          });
        }

        this.configs.set(validated.id, validated);
      }
    } catch (error) {
      logger.error('Failed to load MCP config', { filePath, error });
    }
  }

  /**
   * Get config by ID
   */
  get(id: string): McpServerConfig | undefined {
    return this.configs.get(id);
  }

  /**
   * Get all configs
   */
  getAll(): McpServerConfig[] {
    return Array.from(this.configs.values());
  }

  /**
   * Get enabled configs
   */
  getEnabled(): McpServerConfig[] {
    return this.getAll().filter(c => c.enabled);
  }

  /**
   * Get configs with auto-connect enabled
   */
  getAutoConnect(): McpServerConfig[] {
    return this.getEnabled().filter(c => c.autoConnect);
  }

  /**
   * Add or update a config
   */
  set(config: McpServerConfig): void {
    McpServerConfigSchema.parse(config);
    this.configs.set(config.id, config);
  }

  /**
   * Remove a config
   */
  remove(id: string): boolean {
    return this.configs.delete(id);
  }

  /**
   * Enable/disable a server
   */
  setEnabled(id: string, enabled: boolean): void {
    const config = this.configs.get(id);
    if (config) {
      config.enabled = enabled;
    }
  }

  /**
   * Get servers by permission
   */
  getByPermission(permission: keyof NonNullable<McpServerConfig['permissions']>): McpServerConfig[] {
    return this.getEnabled().filter(c => c.permissions?.[permission] === true);
  }
}
```

---

## 3. Connection Manager (`src/mcp/connection-manager.ts`)

```typescript
/**
 * MCP Connection Manager
 *
 * Manages MCP server connections and lifecycle.
 */

import { spawn, ChildProcess } from 'child_process';
import {
  McpServerConfig,
  ServerConnection,
  ServerStatus,
  McpTool,
  McpResource,
} from './types';
import { ServerConfigManager } from './server-config';
import { logger } from '../utils/logger';

/**
 * MCP Protocol message types
 */
interface McpMessage {
  jsonrpc: '2.0';
  id?: number;
  method?: string;
  params?: unknown;
  result?: unknown;
  error?: { code: number; message: string };
}

/**
 * Connection Manager implementation
 */
export class ConnectionManager {
  private configManager: ServerConfigManager;
  private connections: Map<string, ServerConnection> = new Map();
  private processes: Map<string, ChildProcess> = new Map();
  private messageId: number = 0;
  private pendingRequests: Map<number, {
    resolve: (value: unknown) => void;
    reject: (error: Error) => void;
    timeout: NodeJS.Timeout;
  }> = new Map();

  constructor(configManager: ServerConfigManager) {
    this.configManager = configManager;
  }

  /**
   * Connect to all auto-connect servers
   */
  async connectAll(): Promise<void> {
    const configs = this.configManager.getAutoConnect();

    const results = await Promise.allSettled(
      configs.map(config => this.connect(config.id))
    );

    const succeeded = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;

    logger.info('MCP connections established', { succeeded, failed });
  }

  /**
   * Connect to a specific server
   */
  async connect(serverId: string): Promise<ServerConnection> {
    const config = this.configManager.get(serverId);
    if (!config) {
      throw new Error(`Unknown MCP server: ${serverId}`);
    }

    // Check if already connected
    const existing = this.connections.get(serverId);
    if (existing?.status === 'connected') {
      return existing;
    }

    // Update status
    const connection: ServerConnection = {
      config,
      status: 'connecting',
      availableTools: [],
      availableResources: [],
    };
    this.connections.set(serverId, connection);

    try {
      // Connect based on transport type
      switch (config.transport) {
        case 'stdio':
          await this.connectStdio(serverId, config);
          break;
        case 'http':
          await this.connectHttp(serverId, config);
          break;
        case 'websocket':
          await this.connectWebSocket(serverId, config);
          break;
        default:
          throw new Error(`Unsupported transport: ${config.transport}`);
      }

      // Initialize and discover capabilities
      await this.initialize(serverId);

      connection.status = 'connected';
      connection.connectedAt = new Date();

      logger.info('MCP server connected', {
        serverId,
        tools: connection.availableTools.length,
        resources: connection.availableResources.length,
      });

      return connection;
    } catch (error) {
      connection.status = 'error';
      connection.lastError = error as Error;
      logger.error('MCP connection failed', { serverId, error });
      throw error;
    }
  }

  /**
   * Connect via stdio
   */
  private async connectStdio(serverId: string, config: McpServerConfig): Promise<void> {
    if (!config.command) {
      throw new Error('Stdio transport requires command');
    }

    // Build environment
    const env = { ...process.env, ...config.env };

    // Handle authentication
    if (config.auth?.method === 'api_key' && config.auth.keyEnvVar) {
      // Key should already be in environment
    }

    // Spawn process
    const proc = spawn(config.command, config.args || [], {
      env,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    this.processes.set(serverId, proc);

    // Handle stdout (responses)
    proc.stdout?.on('data', (data: Buffer) => {
      this.handleMessage(serverId, data.toString());
    });

    // Handle stderr (logging)
    proc.stderr?.on('data', (data: Buffer) => {
      logger.debug('MCP stderr', { serverId, message: data.toString() });
    });

    // Handle process exit
    proc.on('exit', (code) => {
      const connection = this.connections.get(serverId);
      if (connection) {
        connection.status = 'disconnected';
      }
      this.processes.delete(serverId);
      logger.info('MCP process exited', { serverId, code });
    });

    // Wait for process to be ready
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Connection timeout'));
      }, config.timeout);

      proc.stdout?.once('data', () => {
        clearTimeout(timeout);
        resolve();
      });

      proc.on('error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });
  }

  /**
   * Connect via HTTP
   */
  private async connectHttp(serverId: string, config: McpServerConfig): Promise<void> {
    if (!config.url) {
      throw new Error('HTTP transport requires url');
    }

    // Test connection with a ping
    const response = await fetch(config.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(config.auth?.method === 'api_key' && config.auth.keyEnvVar
          ? { 'Authorization': `Bearer ${process.env[config.auth.keyEnvVar]}` }
          : {}),
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: ++this.messageId,
        method: 'ping',
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP connection failed: ${response.status}`);
    }
  }

  /**
   * Connect via WebSocket
   */
  private async connectWebSocket(serverId: string, config: McpServerConfig): Promise<void> {
    // WebSocket implementation would go here
    throw new Error('WebSocket transport not yet implemented');
  }

  /**
   * Initialize server and discover capabilities
   */
  private async initialize(serverId: string): Promise<void> {
    // Initialize
    await this.sendRequest(serverId, 'initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: {
        name: 'aigentflow',
        version: '1.0.0',
      },
    });

    // List tools
    const toolsResult = await this.sendRequest(serverId, 'tools/list', {});
    const connection = this.connections.get(serverId)!;
    connection.availableTools = (toolsResult as { tools: McpTool[] }).tools || [];

    // List resources
    try {
      const resourcesResult = await this.sendRequest(serverId, 'resources/list', {});
      connection.availableResources = (resourcesResult as { resources: McpResource[] }).resources || [];
    } catch {
      // Resources may not be supported
      connection.availableResources = [];
    }

    // Send initialized notification
    await this.sendNotification(serverId, 'notifications/initialized', {});
  }

  /**
   * Send request and wait for response
   */
  async sendRequest(serverId: string, method: string, params: unknown): Promise<unknown> {
    const config = this.configManager.get(serverId);
    if (!config) {
      throw new Error(`Unknown server: ${serverId}`);
    }

    const id = ++this.messageId;
    const message: McpMessage = {
      jsonrpc: '2.0',
      id,
      method,
      params,
    };

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error(`Request timeout: ${method}`));
      }, config.timeout);

      this.pendingRequests.set(id, { resolve, reject, timeout });
      this.send(serverId, message);
    });
  }

  /**
   * Send notification (no response expected)
   */
  async sendNotification(serverId: string, method: string, params: unknown): Promise<void> {
    const message: McpMessage = {
      jsonrpc: '2.0',
      method,
      params,
    };
    this.send(serverId, message);
  }

  /**
   * Send message to server
   */
  private send(serverId: string, message: McpMessage): void {
    const config = this.configManager.get(serverId)!;

    switch (config.transport) {
      case 'stdio': {
        const proc = this.processes.get(serverId);
        if (proc?.stdin) {
          proc.stdin.write(JSON.stringify(message) + '\n');
        }
        break;
      }
      case 'http':
        // HTTP is request/response, handled in sendRequest
        break;
    }
  }

  /**
   * Handle incoming message
   */
  private handleMessage(serverId: string, data: string): void {
    try {
      const message: McpMessage = JSON.parse(data);

      if (message.id !== undefined) {
        const pending = this.pendingRequests.get(message.id);
        if (pending) {
          clearTimeout(pending.timeout);
          this.pendingRequests.delete(message.id);

          if (message.error) {
            pending.reject(new Error(message.error.message));
          } else {
            pending.resolve(message.result);
          }
        }
      }
    } catch (error) {
      logger.error('Failed to parse MCP message', { serverId, data, error });
    }
  }

  /**
   * Disconnect from a server
   */
  async disconnect(serverId: string): Promise<void> {
    const proc = this.processes.get(serverId);
    if (proc) {
      proc.kill();
      this.processes.delete(serverId);
    }

    const connection = this.connections.get(serverId);
    if (connection) {
      connection.status = 'disconnected';
    }

    logger.info('MCP server disconnected', { serverId });
  }

  /**
   * Disconnect from all servers
   */
  async disconnectAll(): Promise<void> {
    const serverIds = Array.from(this.connections.keys());
    await Promise.all(serverIds.map(id => this.disconnect(id)));
  }

  /**
   * Get connection status
   */
  getConnection(serverId: string): ServerConnection | undefined {
    return this.connections.get(serverId);
  }

  /**
   * Get all connections
   */
  getAllConnections(): ServerConnection[] {
    return Array.from(this.connections.values());
  }

  /**
   * Get connected servers
   */
  getConnected(): ServerConnection[] {
    return this.getAllConnections().filter(c => c.status === 'connected');
  }
}
```

---

## 4. Tool Router (`src/mcp/tool-router.ts`)

```typescript
/**
 * MCP Tool Router
 *
 * Routes tool calls to the appropriate MCP server.
 */

import {
  ToolCallRequest,
  ToolCallResult,
  McpTool,
  ServerConnection,
} from './types';
import { ConnectionManager } from './connection-manager';
import { logger } from '../utils/logger';

/**
 * Tool routing entry
 */
interface ToolRoute {
  serverId: string;
  tool: McpTool;
}

/**
 * Tool Router implementation
 */
export class ToolRouter {
  private connectionManager: ConnectionManager;
  private routes: Map<string, ToolRoute> = new Map();

  constructor(connectionManager: ConnectionManager) {
    this.connectionManager = connectionManager;
  }

  /**
   * Build routing table from connected servers
   */
  buildRoutes(): void {
    this.routes.clear();

    const connections = this.connectionManager.getConnected();

    for (const connection of connections) {
      for (const tool of connection.availableTools) {
        const existingRoute = this.routes.get(tool.name);

        if (existingRoute) {
          logger.warn('Duplicate tool name', {
            tool: tool.name,
            existingServer: existingRoute.serverId,
            newServer: connection.config.id,
          });
          // Keep the first one (could implement priority system)
          continue;
        }

        this.routes.set(tool.name, {
          serverId: connection.config.id,
          tool,
        });
      }
    }

    logger.info('Tool routes built', { count: this.routes.size });
  }

  /**
   * Get all available tools
   */
  getAvailableTools(): McpTool[] {
    return Array.from(this.routes.values()).map(r => r.tool);
  }

  /**
   * Get tool by name
   */
  getTool(name: string): McpTool | undefined {
    return this.routes.get(name)?.tool;
  }

  /**
   * Check if tool is available
   */
  hasTool(name: string): boolean {
    return this.routes.has(name);
  }

  /**
   * Get server ID for a tool
   */
  getServerForTool(name: string): string | undefined {
    return this.routes.get(name)?.serverId;
  }

  /**
   * Call a tool
   */
  async callTool(request: ToolCallRequest): Promise<ToolCallResult> {
    const startTime = Date.now();

    // Find route
    const route = this.routes.get(request.toolName);
    if (!route) {
      return {
        success: false,
        error: `Unknown tool: ${request.toolName}`,
        duration: Date.now() - startTime,
      };
    }

    // Use specified server or routed server
    const serverId = request.serverId || route.serverId;

    try {
      // Call the tool via MCP
      const result = await this.connectionManager.sendRequest(
        serverId,
        'tools/call',
        {
          name: request.toolName,
          arguments: request.arguments,
        }
      );

      return {
        success: true,
        result,
        duration: Date.now() - startTime,
      };
    } catch (error) {
      logger.error('Tool call failed', {
        tool: request.toolName,
        serverId,
        error,
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * Call multiple tools in parallel
   */
  async callToolsParallel(requests: ToolCallRequest[]): Promise<ToolCallResult[]> {
    return Promise.all(requests.map(req => this.callTool(req)));
  }

  /**
   * Get tools by server
   */
  getToolsByServer(serverId: string): McpTool[] {
    return Array.from(this.routes.values())
      .filter(r => r.serverId === serverId)
      .map(r => r.tool);
  }
}
```

---

## 5. Built-in Configurations

### 5.1 Filesystem Server (`src/mcp/configs/filesystem.json`)

```json
{
  "id": "filesystem",
  "name": "Filesystem Server",
  "description": "Provides file system operations",
  "version": "1.0.0",
  "transport": "stdio",
  "command": "npx",
  "args": ["-y", "@modelcontextprotocol/server-filesystem", "/"],
  "enabled": true,
  "autoConnect": true,
  "timeout": 30000,
  "retries": 3,
  "permissions": {
    "readFiles": true,
    "writeFiles": true,
    "executeCommands": false,
    "networkAccess": false,
    "databaseAccess": false
  },
  "scope": "project",
  "tools": [
    {
      "name": "read_file",
      "description": "Read contents of a file",
      "inputSchema": {
        "type": "object",
        "properties": {
          "path": { "type": "string", "description": "Path to the file" }
        },
        "required": ["path"]
      }
    },
    {
      "name": "write_file",
      "description": "Write contents to a file",
      "inputSchema": {
        "type": "object",
        "properties": {
          "path": { "type": "string", "description": "Path to the file" },
          "content": { "type": "string", "description": "Content to write" }
        },
        "required": ["path", "content"]
      }
    },
    {
      "name": "list_directory",
      "description": "List contents of a directory",
      "inputSchema": {
        "type": "object",
        "properties": {
          "path": { "type": "string", "description": "Path to the directory" }
        },
        "required": ["path"]
      }
    }
  ]
}
```

### 5.2 Git Server (`src/mcp/configs/git.json`)

```json
{
  "id": "git",
  "name": "Git Server",
  "description": "Provides git operations",
  "version": "1.0.0",
  "transport": "stdio",
  "command": "npx",
  "args": ["-y", "@modelcontextprotocol/server-git"],
  "enabled": true,
  "autoConnect": true,
  "timeout": 60000,
  "retries": 3,
  "permissions": {
    "readFiles": true,
    "writeFiles": true,
    "executeCommands": true,
    "networkAccess": true,
    "databaseAccess": false
  },
  "scope": "project",
  "tools": [
    {
      "name": "git_status",
      "description": "Get git status",
      "inputSchema": {
        "type": "object",
        "properties": {
          "repo_path": { "type": "string", "description": "Path to the repository" }
        },
        "required": ["repo_path"]
      }
    },
    {
      "name": "git_diff",
      "description": "Get git diff",
      "inputSchema": {
        "type": "object",
        "properties": {
          "repo_path": { "type": "string", "description": "Path to the repository" },
          "target": { "type": "string", "description": "Diff target (commit, branch, or file)" }
        },
        "required": ["repo_path"]
      }
    },
    {
      "name": "git_commit",
      "description": "Create a git commit",
      "inputSchema": {
        "type": "object",
        "properties": {
          "repo_path": { "type": "string", "description": "Path to the repository" },
          "message": { "type": "string", "description": "Commit message" }
        },
        "required": ["repo_path", "message"]
      }
    },
    {
      "name": "git_log",
      "description": "Get git log",
      "inputSchema": {
        "type": "object",
        "properties": {
          "repo_path": { "type": "string", "description": "Path to the repository" },
          "count": { "type": "number", "description": "Number of commits to show" }
        },
        "required": ["repo_path"]
      }
    }
  ]
}
```

### 5.3 Terminal Server (`src/mcp/configs/terminal.json`)

```json
{
  "id": "terminal",
  "name": "Terminal Server",
  "description": "Provides terminal/shell command execution",
  "version": "1.0.0",
  "transport": "stdio",
  "command": "npx",
  "args": ["-y", "@anthropic/mcp-server-terminal"],
  "enabled": true,
  "autoConnect": false,
  "timeout": 120000,
  "retries": 1,
  "permissions": {
    "readFiles": true,
    "writeFiles": true,
    "executeCommands": true,
    "networkAccess": true,
    "databaseAccess": false
  },
  "scope": "session",
  "tools": [
    {
      "name": "execute_command",
      "description": "Execute a shell command",
      "inputSchema": {
        "type": "object",
        "properties": {
          "command": { "type": "string", "description": "Command to execute" },
          "cwd": { "type": "string", "description": "Working directory" },
          "timeout": { "type": "number", "description": "Timeout in milliseconds" }
        },
        "required": ["command"]
      }
    }
  ]
}
```

### 5.4 GitHub Server (`src/mcp/configs/github.json`)

```json
{
  "id": "github",
  "name": "GitHub Server",
  "description": "Provides GitHub API operations",
  "version": "1.0.0",
  "transport": "stdio",
  "command": "npx",
  "args": ["-y", "@modelcontextprotocol/server-github"],
  "env": {},
  "auth": {
    "method": "api_key",
    "keyEnvVar": "GITHUB_TOKEN"
  },
  "enabled": true,
  "autoConnect": false,
  "timeout": 30000,
  "retries": 3,
  "permissions": {
    "readFiles": false,
    "writeFiles": false,
    "executeCommands": false,
    "networkAccess": true,
    "databaseAccess": false
  },
  "scope": "global",
  "tools": [
    {
      "name": "create_issue",
      "description": "Create a GitHub issue",
      "inputSchema": {
        "type": "object",
        "properties": {
          "owner": { "type": "string" },
          "repo": { "type": "string" },
          "title": { "type": "string" },
          "body": { "type": "string" }
        },
        "required": ["owner", "repo", "title"]
      }
    },
    {
      "name": "create_pull_request",
      "description": "Create a GitHub pull request",
      "inputSchema": {
        "type": "object",
        "properties": {
          "owner": { "type": "string" },
          "repo": { "type": "string" },
          "title": { "type": "string" },
          "body": { "type": "string" },
          "head": { "type": "string" },
          "base": { "type": "string" }
        },
        "required": ["owner", "repo", "title", "head", "base"]
      }
    },
    {
      "name": "list_issues",
      "description": "List GitHub issues",
      "inputSchema": {
        "type": "object",
        "properties": {
          "owner": { "type": "string" },
          "repo": { "type": "string" },
          "state": { "type": "string", "enum": ["open", "closed", "all"] }
        },
        "required": ["owner", "repo"]
      }
    }
  ]
}
```

### 5.5 Memory Server (`src/mcp/configs/memory.json`)

```json
{
  "id": "memory",
  "name": "Memory Server",
  "description": "Provides persistent memory and knowledge storage",
  "version": "1.0.0",
  "transport": "stdio",
  "command": "npx",
  "args": ["-y", "@modelcontextprotocol/server-memory"],
  "enabled": true,
  "autoConnect": true,
  "timeout": 10000,
  "retries": 3,
  "permissions": {
    "readFiles": true,
    "writeFiles": true,
    "executeCommands": false,
    "networkAccess": false,
    "databaseAccess": false
  },
  "scope": "project",
  "tools": [
    {
      "name": "store_memory",
      "description": "Store information in memory",
      "inputSchema": {
        "type": "object",
        "properties": {
          "key": { "type": "string", "description": "Memory key" },
          "value": { "type": "string", "description": "Value to store" },
          "tags": { "type": "array", "items": { "type": "string" } }
        },
        "required": ["key", "value"]
      }
    },
    {
      "name": "retrieve_memory",
      "description": "Retrieve information from memory",
      "inputSchema": {
        "type": "object",
        "properties": {
          "key": { "type": "string", "description": "Memory key" }
        },
        "required": ["key"]
      }
    },
    {
      "name": "search_memory",
      "description": "Search memory by query or tags",
      "inputSchema": {
        "type": "object",
        "properties": {
          "query": { "type": "string", "description": "Search query" },
          "tags": { "type": "array", "items": { "type": "string" } }
        }
      }
    }
  ]
}
```

### 5.6 Web Server (`src/mcp/configs/web.json`)

```json
{
  "id": "web",
  "name": "Web Fetch Server",
  "description": "Provides web fetching and browsing capabilities",
  "version": "1.0.0",
  "transport": "stdio",
  "command": "npx",
  "args": ["-y", "@modelcontextprotocol/server-fetch"],
  "enabled": true,
  "autoConnect": false,
  "timeout": 60000,
  "retries": 2,
  "permissions": {
    "readFiles": false,
    "writeFiles": false,
    "executeCommands": false,
    "networkAccess": true,
    "databaseAccess": false
  },
  "scope": "session",
  "tools": [
    {
      "name": "fetch_url",
      "description": "Fetch content from a URL",
      "inputSchema": {
        "type": "object",
        "properties": {
          "url": { "type": "string", "description": "URL to fetch" },
          "method": { "type": "string", "enum": ["GET", "POST"], "default": "GET" },
          "headers": { "type": "object" },
          "body": { "type": "string" }
        },
        "required": ["url"]
      }
    }
  ]
}
```

---

## 6. MCP Index (`src/mcp/index.ts`)

```typescript
/**
 * MCP Module
 *
 * Export all MCP-related functionality.
 */

export * from './types';
export * from './server-config';
export * from './connection-manager';
export * from './tool-router';

import { ServerConfigManager, ConfigSources } from './server-config';
import { ConnectionManager } from './connection-manager';
import { ToolRouter } from './tool-router';
import { logger } from '../utils/logger';

/**
 * Create and initialize the MCP system
 */
export async function createMcpSystem(sources: ConfigSources): Promise<{
  configManager: ServerConfigManager;
  connectionManager: ConnectionManager;
  toolRouter: ToolRouter;
}> {
  // Create managers
  const configManager = new ServerConfigManager(sources);
  const connectionManager = new ConnectionManager(configManager);
  const toolRouter = new ToolRouter(connectionManager);

  // Load configurations
  await configManager.loadAll();

  // Connect to auto-connect servers
  await connectionManager.connectAll();

  // Build routing table
  toolRouter.buildRoutes();

  logger.info('MCP system initialized', {
    servers: configManager.getAll().length,
    connected: connectionManager.getConnected().length,
    tools: toolRouter.getAvailableTools().length,
  });

  return { configManager, connectionManager, toolRouter };
}

/**
 * Shutdown MCP system
 */
export async function shutdownMcpSystem(
  connectionManager: ConnectionManager
): Promise<void> {
  await connectionManager.disconnectAll();
  logger.info('MCP system shutdown complete');
}
```

---

## Test Scenarios

```typescript
// tests/mcp/tool-router.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ToolRouter } from '../../src/mcp/tool-router';
import { ConnectionManager } from '../../src/mcp/connection-manager';
import { ServerConnection, McpTool } from '../../src/mcp/types';

describe('ToolRouter', () => {
  let router: ToolRouter;
  let mockConnectionManager: ConnectionManager;

  const mockTool: McpTool = {
    name: 'test_tool',
    description: 'A test tool',
    inputSchema: { type: 'object', properties: {} },
  };

  const mockConnection: ServerConnection = {
    config: {
      id: 'test-server',
      name: 'Test Server',
      description: 'Test',
      version: '1.0.0',
      transport: 'stdio',
      command: 'test',
      enabled: true,
      autoConnect: true,
      timeout: 30000,
      retries: 3,
      retryDelay: 1000,
      scope: 'project',
    },
    status: 'connected',
    availableTools: [mockTool],
    availableResources: [],
  };

  beforeEach(() => {
    mockConnectionManager = {
      getConnected: vi.fn().mockReturnValue([mockConnection]),
      sendRequest: vi.fn().mockResolvedValue({ success: true }),
    } as unknown as ConnectionManager;

    router = new ToolRouter(mockConnectionManager);
  });

  it('should build routes from connected servers', () => {
    router.buildRoutes();
    expect(router.hasTool('test_tool')).toBe(true);
  });

  it('should return available tools', () => {
    router.buildRoutes();
    const tools = router.getAvailableTools();
    expect(tools).toHaveLength(1);
    expect(tools[0].name).toBe('test_tool');
  });

  it('should route tool calls to correct server', async () => {
    router.buildRoutes();

    await router.callTool({
      serverId: 'test-server',
      toolName: 'test_tool',
      arguments: {},
    });

    expect(mockConnectionManager.sendRequest).toHaveBeenCalledWith(
      'test-server',
      'tools/call',
      expect.any(Object)
    );
  });

  it('should handle unknown tools', async () => {
    router.buildRoutes();

    const result = await router.callTool({
      serverId: '',
      toolName: 'unknown_tool',
      arguments: {},
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('Unknown tool');
  });
});
```

---

## Validation Checklist

```
□ Core MCP types defined
□ Server configuration management works
□ Connection manager handles stdio transport
□ Connection manager handles HTTP transport
□ Tool router builds routes correctly
□ Tool calls are routed to correct servers
□ Built-in filesystem config present
□ Built-in git config present
□ Built-in terminal config present
□ Built-in GitHub config present
□ Built-in memory config present
□ Built-in web config present
□ Authentication methods work
□ All tests pass
```

---

## Next Step

Proceed to **07-CONTEXT-MANAGEMENT.md** to implement context management.
