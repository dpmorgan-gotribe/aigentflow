/**
 * MCP Server Framework Types
 *
 * Type definitions for Model Context Protocol (MCP) server integration.
 * Supports stdio, HTTP, and WebSocket transports with various auth methods.
 */

/**
 * Transport types for MCP servers
 */
export type MCPTransport = 'stdio' | 'http' | 'websocket';

/**
 * Authentication methods
 */
export type MCPAuthMethod = 'none' | 'api_key' | 'oauth' | 'token' | 'basic';

/**
 * Server health status
 */
export type MCPServerStatus = 'disconnected' | 'connecting' | 'connected' | 'error' | 'degraded';

/**
 * Permission types for MCP servers
 */
export type MCPPermission =
  | 'readFiles'
  | 'writeFiles'
  | 'deleteFiles'
  | 'executeCommands'
  | 'networkAccess'
  | 'environmentVariables'
  | 'processManagement';

/**
 * Tool parameter schema
 */
export interface MCPToolParameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  description: string;
  required: boolean;
  default?: unknown;
  enum?: unknown[];
}

/**
 * Tool definition from MCP server
 */
export interface MCPTool {
  name: string;
  description: string;
  parameters: MCPToolParameter[];
  returns?: {
    type: string;
    description: string;
  };
  requiredPermissions: MCPPermission[];
}

/**
 * Server authentication configuration
 */
export interface MCPAuthConfig {
  method: MCPAuthMethod;
  apiKey?: string;
  token?: string;
  username?: string;
  password?: string;
  oauth?: {
    clientId: string;
    clientSecret: string;
    tokenUrl: string;
    scopes: string[];
  };
}

/**
 * Server connection configuration
 */
export interface MCPServerConfig {
  /** Unique server identifier */
  id: string;
  /** Display name */
  name: string;
  /** Server description */
  description: string;
  /** Transport protocol */
  transport: MCPTransport;
  /** Connection endpoint (path for stdio, URL for http/ws) */
  endpoint: string;
  /** Command args for stdio transport */
  args?: string[];
  /** Environment variables for the server process */
  env?: Record<string, string>;
  /** Authentication configuration */
  auth: MCPAuthConfig;
  /** Granted permissions */
  permissions: MCPPermission[];
  /** Connection timeout in ms */
  timeout: number;
  /** Auto-reconnect on disconnect */
  autoReconnect: boolean;
  /** Max reconnection attempts */
  maxReconnectAttempts: number;
  /** Health check interval in ms (0 to disable) */
  healthCheckInterval: number;
  /** Whether server is enabled */
  enabled: boolean;
  /** Server priority for tool routing */
  priority: number;
}

/**
 * Default server config values
 */
export const DEFAULT_SERVER_CONFIG: Partial<MCPServerConfig> = {
  auth: { method: 'none' },
  permissions: [],
  timeout: 30000,
  autoReconnect: true,
  maxReconnectAttempts: 3,
  healthCheckInterval: 60000,
  enabled: true,
  priority: 100,
};

/**
 * Server connection state
 */
export interface MCPServerState {
  serverId: string;
  status: MCPServerStatus;
  lastConnected?: Date;
  lastError?: string;
  reconnectAttempts: number;
  tools: MCPTool[];
  latency?: number;
}

/**
 * Tool call request
 */
export interface MCPToolCallRequest {
  /** Request ID for tracking */
  requestId: string;
  /** Target server ID (optional, will be routed if not specified) */
  serverId?: string;
  /** Tool name */
  toolName: string;
  /** Tool arguments */
  arguments: Record<string, unknown>;
  /** Timeout override */
  timeout?: number;
  /** Required permissions for this call */
  requiredPermissions?: MCPPermission[];
}

/**
 * Tool call response
 */
export interface MCPToolCallResponse {
  /** Original request ID */
  requestId: string;
  /** Server that handled the request */
  serverId: string;
  /** Tool name */
  toolName: string;
  /** Success status */
  success: boolean;
  /** Result data */
  result?: unknown;
  /** Error message if failed */
  error?: string;
  /** Execution time in ms */
  executionTime: number;
}

/**
 * Tool routing decision
 */
export interface MCPRoutingDecision {
  /** Selected server ID */
  serverId: string;
  /** Server name */
  serverName: string;
  /** Tool to invoke */
  tool: MCPTool;
  /** Routing confidence */
  confidence: number;
  /** Reason for selection */
  reason: string;
}

/**
 * MCP event types
 */
export type MCPEventType =
  | 'server:connected'
  | 'server:disconnected'
  | 'server:error'
  | 'server:tools_updated'
  | 'tool:call_started'
  | 'tool:call_completed'
  | 'tool:call_failed'
  | 'health:check';

/**
 * MCP event
 */
export interface MCPEvent {
  type: MCPEventType;
  serverId: string;
  timestamp: Date;
  data?: Record<string, unknown>;
}

/**
 * Health check result
 */
export interface MCPHealthCheck {
  serverId: string;
  status: MCPServerStatus;
  latency: number;
  toolCount: number;
  lastCheck: Date;
  error?: string;
}

/**
 * Connection manager options
 */
export interface MCPConnectionOptions {
  /** Maximum concurrent connections */
  maxConnections: number;
  /** Default timeout for operations */
  defaultTimeout: number;
  /** Enable connection pooling */
  poolConnections: boolean;
  /** Log verbosity */
  verbose: boolean;
}

/**
 * Default connection options
 */
export const DEFAULT_CONNECTION_OPTIONS: MCPConnectionOptions = {
  maxConnections: 10,
  defaultTimeout: 30000,
  poolConnections: true,
  verbose: false,
};

/**
 * Tool router options
 */
export interface MCPRouterOptions {
  /** Enable caching of routing decisions */
  cacheRouting: boolean;
  /** Cache TTL in ms */
  cacheTtl: number;
  /** Prefer local servers */
  preferLocal: boolean;
  /** Load balance between servers with same tools */
  loadBalance: boolean;
}

/**
 * Default router options
 */
export const DEFAULT_ROUTER_OPTIONS: MCPRouterOptions = {
  cacheRouting: true,
  cacheTtl: 300000, // 5 minutes
  preferLocal: true,
  loadBalance: false,
};

/**
 * Built-in server type
 */
export type MCPBuiltInServer = 'filesystem' | 'git' | 'terminal';

/**
 * Server template for built-in configurations
 */
export interface MCPServerTemplate {
  type: MCPBuiltInServer;
  name: string;
  description: string;
  createConfig: (options?: Record<string, unknown>) => MCPServerConfig;
}
