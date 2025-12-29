/**
 * Git MCP Server Configuration
 *
 * Configuration template for Git operations.
 */

import type { MCPServerConfig, MCPServerTemplate, MCPTool } from '../types.js';

/**
 * Git server options
 */
export interface GitServerOptions {
  /** Repository path */
  repoPath?: string;
  /** Default branch name */
  defaultBranch?: string;
  /** Enable push operations */
  enablePush?: boolean;
  /** Enable force operations */
  enableForce?: boolean;
  /** Git user name */
  userName?: string;
  /** Git user email */
  userEmail?: string;
}

/**
 * Default git options
 */
const DEFAULT_OPTIONS: GitServerOptions = {
  repoPath: process.cwd(),
  defaultBranch: 'main',
  enablePush: false,
  enableForce: false,
};

/**
 * Create git server configuration
 */
export function createGitConfig(options: GitServerOptions = {}): MCPServerConfig {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  const env: Record<string, string> = {
    GIT_REPO_PATH: opts.repoPath ?? process.cwd(),
    GIT_DEFAULT_BRANCH: opts.defaultBranch ?? 'main',
  };

  if (opts.userName) env.GIT_AUTHOR_NAME = opts.userName;
  if (opts.userEmail) env.GIT_AUTHOR_EMAIL = opts.userEmail;

  return {
    id: 'mcp-git',
    name: 'Git Server',
    description: 'Git version control operations via MCP',
    transport: 'stdio',
    endpoint: 'npx',
    args: ['@modelcontextprotocol/server-git'],
    env,
    auth: { method: 'none' },
    permissions: ['readFiles', 'writeFiles', 'executeCommands'],
    timeout: 60000, // Git operations can be slow
    autoReconnect: true,
    maxReconnectAttempts: 3,
    healthCheckInterval: 120000,
    enabled: true,
    priority: 90,
  };
}

/**
 * Git tools definition
 */
export const gitTools: MCPTool[] = [
  {
    name: 'git_status',
    description: 'Get repository status',
    parameters: [],
    returns: {
      type: 'object',
      description: 'Repository status including staged, unstaged, and untracked files',
    },
    requiredPermissions: ['readFiles'],
  },
  {
    name: 'git_diff',
    description: 'Get diff of changes',
    parameters: [
      {
        name: 'staged',
        type: 'boolean',
        description: 'Show staged changes only',
        required: false,
        default: false,
      },
      {
        name: 'file',
        type: 'string',
        description: 'Specific file to diff',
        required: false,
      },
    ],
    returns: {
      type: 'string',
      description: 'Unified diff output',
    },
    requiredPermissions: ['readFiles'],
  },
  {
    name: 'git_log',
    description: 'Get commit history',
    parameters: [
      {
        name: 'limit',
        type: 'number',
        description: 'Number of commits to retrieve',
        required: false,
        default: 10,
      },
      {
        name: 'branch',
        type: 'string',
        description: 'Branch to get history from',
        required: false,
      },
    ],
    returns: {
      type: 'array',
      description: 'List of commits',
    },
    requiredPermissions: ['readFiles'],
  },
  {
    name: 'git_add',
    description: 'Stage files for commit',
    parameters: [
      {
        name: 'files',
        type: 'array',
        description: 'Files to stage (empty for all)',
        required: false,
        default: [],
      },
    ],
    returns: {
      type: 'object',
      description: 'Staging result',
    },
    requiredPermissions: ['writeFiles'],
  },
  {
    name: 'git_commit',
    description: 'Create a commit',
    parameters: [
      {
        name: 'message',
        type: 'string',
        description: 'Commit message',
        required: true,
      },
    ],
    returns: {
      type: 'object',
      description: 'Commit result including hash',
    },
    requiredPermissions: ['writeFiles'],
  },
  {
    name: 'git_branch',
    description: 'Manage branches',
    parameters: [
      {
        name: 'action',
        type: 'string',
        description: 'Action: list, create, delete, checkout',
        required: true,
        enum: ['list', 'create', 'delete', 'checkout'],
      },
      {
        name: 'name',
        type: 'string',
        description: 'Branch name (for create/delete/checkout)',
        required: false,
      },
    ],
    returns: {
      type: 'object',
      description: 'Branch operation result',
    },
    requiredPermissions: ['writeFiles'],
  },
  {
    name: 'git_worktree',
    description: 'Manage git worktrees',
    parameters: [
      {
        name: 'action',
        type: 'string',
        description: 'Action: list, add, remove',
        required: true,
        enum: ['list', 'add', 'remove'],
      },
      {
        name: 'path',
        type: 'string',
        description: 'Worktree path',
        required: false,
      },
      {
        name: 'branch',
        type: 'string',
        description: 'Branch for new worktree',
        required: false,
      },
    ],
    returns: {
      type: 'object',
      description: 'Worktree operation result',
    },
    requiredPermissions: ['writeFiles', 'executeCommands'],
  },
];

/**
 * Git server template
 */
export const gitServerTemplate: MCPServerTemplate = {
  type: 'git',
  name: 'Git Server',
  description: 'Git version control operations via MCP',
  createConfig: (options) => createGitConfig(options as GitServerOptions),
};

export default gitServerTemplate;
