/**
 * Terminal MCP Server Configuration
 *
 * Configuration template for shell command execution.
 */

import type { MCPServerConfig, MCPServerTemplate, MCPTool } from '../types.js';

/**
 * Terminal server options
 */
export interface TerminalServerOptions {
  /** Working directory */
  cwd?: string;
  /** Shell to use */
  shell?: string;
  /** Environment variables */
  env?: Record<string, string>;
  /** Command timeout in ms */
  commandTimeout?: number;
  /** Allowed commands (empty = all) */
  allowedCommands?: string[];
  /** Blocked commands */
  blockedCommands?: string[];
  /** Enable background processes */
  enableBackground?: boolean;
}

/**
 * Default terminal options
 */
const DEFAULT_OPTIONS: TerminalServerOptions = {
  cwd: process.cwd(),
  shell: process.platform === 'win32' ? 'cmd.exe' : '/bin/bash',
  env: {},
  commandTimeout: 120000, // 2 minutes
  allowedCommands: [],
  blockedCommands: ['rm -rf /', 'format', 'mkfs', ':(){:|:&};:'],
  enableBackground: false,
};

/**
 * Create terminal server configuration
 */
export function createTerminalConfig(options: TerminalServerOptions = {}): MCPServerConfig {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  return {
    id: 'mcp-terminal',
    name: 'Terminal Server',
    description: 'Shell command execution via MCP',
    transport: 'stdio',
    endpoint: 'npx',
    args: ['@modelcontextprotocol/server-terminal'],
    env: {
      TERMINAL_CWD: opts.cwd ?? process.cwd(),
      TERMINAL_SHELL: opts.shell ?? '/bin/bash',
      TERMINAL_TIMEOUT: String(opts.commandTimeout),
      TERMINAL_BLOCKED: opts.blockedCommands?.join(',') ?? '',
      ...opts.env,
    },
    auth: { method: 'none' },
    permissions: ['executeCommands', 'processManagement', 'environmentVariables'],
    timeout: opts.commandTimeout ?? 120000,
    autoReconnect: true,
    maxReconnectAttempts: 3,
    healthCheckInterval: 60000,
    enabled: true,
    priority: 80,
  };
}

/**
 * Terminal tools definition
 */
export const terminalTools: MCPTool[] = [
  {
    name: 'execute_command',
    description: 'Execute a shell command',
    parameters: [
      {
        name: 'command',
        type: 'string',
        description: 'Command to execute',
        required: true,
      },
      {
        name: 'cwd',
        type: 'string',
        description: 'Working directory',
        required: false,
      },
      {
        name: 'timeout',
        type: 'number',
        description: 'Timeout in milliseconds',
        required: false,
      },
      {
        name: 'env',
        type: 'object',
        description: 'Additional environment variables',
        required: false,
      },
    ],
    returns: {
      type: 'object',
      description: 'Command result with stdout, stderr, and exit code',
    },
    requiredPermissions: ['executeCommands'],
  },
  {
    name: 'execute_script',
    description: 'Execute a shell script',
    parameters: [
      {
        name: 'script',
        type: 'string',
        description: 'Script content to execute',
        required: true,
      },
      {
        name: 'interpreter',
        type: 'string',
        description: 'Script interpreter (bash, python, node, etc.)',
        required: false,
        default: 'bash',
      },
      {
        name: 'cwd',
        type: 'string',
        description: 'Working directory',
        required: false,
      },
    ],
    returns: {
      type: 'object',
      description: 'Script execution result',
    },
    requiredPermissions: ['executeCommands'],
  },
  {
    name: 'start_process',
    description: 'Start a background process',
    parameters: [
      {
        name: 'command',
        type: 'string',
        description: 'Command to run',
        required: true,
      },
      {
        name: 'name',
        type: 'string',
        description: 'Process name for reference',
        required: true,
      },
      {
        name: 'cwd',
        type: 'string',
        description: 'Working directory',
        required: false,
      },
    ],
    returns: {
      type: 'object',
      description: 'Process information with PID',
    },
    requiredPermissions: ['executeCommands', 'processManagement'],
  },
  {
    name: 'stop_process',
    description: 'Stop a background process',
    parameters: [
      {
        name: 'name',
        type: 'string',
        description: 'Process name',
        required: true,
      },
      {
        name: 'signal',
        type: 'string',
        description: 'Signal to send (SIGTERM, SIGKILL)',
        required: false,
        default: 'SIGTERM',
      },
    ],
    returns: {
      type: 'object',
      description: 'Stop result',
    },
    requiredPermissions: ['processManagement'],
  },
  {
    name: 'list_processes',
    description: 'List running background processes',
    parameters: [],
    returns: {
      type: 'array',
      description: 'List of running processes',
    },
    requiredPermissions: ['processManagement'],
  },
  {
    name: 'get_env',
    description: 'Get environment variable',
    parameters: [
      {
        name: 'name',
        type: 'string',
        description: 'Variable name',
        required: true,
      },
    ],
    returns: {
      type: 'string',
      description: 'Variable value',
    },
    requiredPermissions: ['environmentVariables'],
  },
];

/**
 * Terminal server template
 */
export const terminalServerTemplate: MCPServerTemplate = {
  type: 'terminal',
  name: 'Terminal Server',
  description: 'Shell command execution via MCP',
  createConfig: (options) => createTerminalConfig(options as TerminalServerOptions),
};

export default terminalServerTemplate;
