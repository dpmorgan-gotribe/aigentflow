/**
 * MCP Server Config Templates
 *
 * Pre-built configurations for common MCP servers.
 */

export {
  filesystemServerTemplate,
  createFilesystemConfig,
  filesystemTools,
  type FilesystemServerOptions,
} from './filesystem.js';

export {
  gitServerTemplate,
  createGitConfig,
  gitTools,
  type GitServerOptions,
} from './git.js';

export {
  terminalServerTemplate,
  createTerminalConfig,
  terminalTools,
  type TerminalServerOptions,
} from './terminal.js';

import { filesystemServerTemplate } from './filesystem.js';
import { gitServerTemplate } from './git.js';
import { terminalServerTemplate } from './terminal.js';
import type { MCPServerTemplate } from '../types.js';

/**
 * All built-in server templates
 */
export const builtInServerTemplates: MCPServerTemplate[] = [
  filesystemServerTemplate,
  gitServerTemplate,
  terminalServerTemplate,
];

/**
 * Get template by type
 */
export function getServerTemplate(type: string): MCPServerTemplate | undefined {
  return builtInServerTemplates.find((t) => t.type === type);
}

export default builtInServerTemplates;
