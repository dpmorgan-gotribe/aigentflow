/**
 * Filesystem MCP Server Configuration
 *
 * Configuration template for filesystem operations.
 */

import type { MCPServerConfig, MCPServerTemplate, MCPTool } from '../types.js';

/**
 * Filesystem server options
 */
export interface FilesystemServerOptions {
  /** Base directory for file operations */
  basePath?: string;
  /** Allowed file extensions (empty = all) */
  allowedExtensions?: string[];
  /** Max file size in bytes */
  maxFileSize?: number;
  /** Enable write operations */
  enableWrite?: boolean;
  /** Enable delete operations */
  enableDelete?: boolean;
}

/**
 * Default filesystem options
 */
const DEFAULT_OPTIONS: FilesystemServerOptions = {
  basePath: process.cwd(),
  allowedExtensions: [],
  maxFileSize: 10 * 1024 * 1024, // 10MB
  enableWrite: true,
  enableDelete: false,
};

/**
 * Create filesystem server configuration
 */
export function createFilesystemConfig(
  options: FilesystemServerOptions = {}
): MCPServerConfig {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  const permissions: MCPServerConfig['permissions'] = ['readFiles'];
  if (opts.enableWrite) permissions.push('writeFiles');
  if (opts.enableDelete) permissions.push('deleteFiles');

  return {
    id: 'mcp-filesystem',
    name: 'Filesystem Server',
    description: 'File read/write operations via MCP',
    transport: 'stdio',
    endpoint: 'npx',
    args: ['@modelcontextprotocol/server-filesystem', opts.basePath ?? process.cwd()],
    env: {
      MCP_ALLOWED_EXTENSIONS: opts.allowedExtensions?.join(',') ?? '',
      MCP_MAX_FILE_SIZE: String(opts.maxFileSize),
    },
    auth: { method: 'none' },
    permissions,
    timeout: 30000,
    autoReconnect: true,
    maxReconnectAttempts: 3,
    healthCheckInterval: 60000,
    enabled: true,
    priority: 100,
  };
}

/**
 * Filesystem tools definition
 */
export const filesystemTools: MCPTool[] = [
  {
    name: 'read_file',
    description: 'Read the contents of a file',
    parameters: [
      {
        name: 'path',
        type: 'string',
        description: 'Path to the file to read',
        required: true,
      },
    ],
    returns: {
      type: 'object',
      description: 'File contents and metadata',
    },
    requiredPermissions: ['readFiles'],
  },
  {
    name: 'write_file',
    description: 'Write content to a file',
    parameters: [
      {
        name: 'path',
        type: 'string',
        description: 'Path to the file to write',
        required: true,
      },
      {
        name: 'content',
        type: 'string',
        description: 'Content to write to the file',
        required: true,
      },
    ],
    returns: {
      type: 'object',
      description: 'Write operation result',
    },
    requiredPermissions: ['writeFiles'],
  },
  {
    name: 'list_directory',
    description: 'List contents of a directory',
    parameters: [
      {
        name: 'path',
        type: 'string',
        description: 'Path to the directory',
        required: true,
      },
      {
        name: 'recursive',
        type: 'boolean',
        description: 'List recursively',
        required: false,
        default: false,
      },
    ],
    returns: {
      type: 'array',
      description: 'List of files and directories',
    },
    requiredPermissions: ['readFiles'],
  },
  {
    name: 'delete_file',
    description: 'Delete a file',
    parameters: [
      {
        name: 'path',
        type: 'string',
        description: 'Path to the file to delete',
        required: true,
      },
    ],
    returns: {
      type: 'object',
      description: 'Delete operation result',
    },
    requiredPermissions: ['deleteFiles'],
  },
  {
    name: 'file_info',
    description: 'Get file metadata',
    parameters: [
      {
        name: 'path',
        type: 'string',
        description: 'Path to the file',
        required: true,
      },
    ],
    returns: {
      type: 'object',
      description: 'File metadata (size, modified, etc.)',
    },
    requiredPermissions: ['readFiles'],
  },
];

/**
 * Filesystem server template
 */
export const filesystemServerTemplate: MCPServerTemplate = {
  type: 'filesystem',
  name: 'Filesystem Server',
  description: 'File read/write operations via MCP',
  createConfig: (options) => createFilesystemConfig(options as FilesystemServerOptions),
};

export default filesystemServerTemplate;
