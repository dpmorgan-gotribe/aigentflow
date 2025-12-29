/**
 * MCP Server Configuration Manager
 *
 * Manages MCP server configurations with validation and persistence.
 */

import { logger } from '../utils/logger.js';
import type {
  MCPServerConfig,
  MCPAuthConfig,
  MCPPermission,
  MCPTransport,
} from './types.js';
import { DEFAULT_SERVER_CONFIG } from './types.js';

const log = logger.child({ component: 'mcp-config' });

/**
 * Configuration validation result
 */
export interface ConfigValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * MCP Server Configuration Manager
 */
export class MCPConfigManager {
  private static instance: MCPConfigManager | null = null;
  private configs: Map<string, MCPServerConfig> = new Map();

  private constructor() {}

  /**
   * Get singleton instance
   */
  static getInstance(): MCPConfigManager {
    if (!MCPConfigManager.instance) {
      MCPConfigManager.instance = new MCPConfigManager();
    }
    return MCPConfigManager.instance;
  }

  /**
   * Reset singleton (for testing)
   */
  static reset(): void {
    MCPConfigManager.instance = null;
  }

  /**
   * Add a server configuration
   */
  addConfig(config: Partial<MCPServerConfig> & { id: string; name: string }): ConfigValidationResult {
    const fullConfig = this.mergeWithDefaults(config);
    const validation = this.validateConfig(fullConfig);

    if (validation.valid) {
      this.configs.set(fullConfig.id, fullConfig);
      log.info('Server config added', { serverId: fullConfig.id, name: fullConfig.name });
    } else {
      log.warn('Invalid server config', { serverId: config.id, errors: validation.errors });
    }

    return validation;
  }

  /**
   * Update an existing configuration
   */
  updateConfig(id: string, updates: Partial<MCPServerConfig>): ConfigValidationResult {
    const existing = this.configs.get(id);
    if (!existing) {
      return {
        valid: false,
        errors: [`Server config not found: ${id}`],
        warnings: [],
      };
    }

    const updated: MCPServerConfig = { ...existing, ...updates, id };
    const validation = this.validateConfig(updated);

    if (validation.valid) {
      this.configs.set(id, updated);
      log.info('Server config updated', { serverId: id });
    }

    return validation;
  }

  /**
   * Remove a server configuration
   */
  removeConfig(id: string): boolean {
    const removed = this.configs.delete(id);
    if (removed) {
      log.info('Server config removed', { serverId: id });
    }
    return removed;
  }

  /**
   * Get a server configuration
   */
  getConfig(id: string): MCPServerConfig | undefined {
    return this.configs.get(id);
  }

  /**
   * Get all server configurations
   */
  getAllConfigs(): MCPServerConfig[] {
    return Array.from(this.configs.values());
  }

  /**
   * Get enabled server configurations
   */
  getEnabledConfigs(): MCPServerConfig[] {
    return Array.from(this.configs.values()).filter((c) => c.enabled);
  }

  /**
   * Get configurations by transport type
   */
  getByTransport(transport: MCPTransport): MCPServerConfig[] {
    return Array.from(this.configs.values()).filter((c) => c.transport === transport);
  }

  /**
   * Get configurations with specific permission
   */
  getByPermission(permission: MCPPermission): MCPServerConfig[] {
    return Array.from(this.configs.values()).filter((c) =>
      c.permissions.includes(permission)
    );
  }

  /**
   * Enable a server
   */
  enableServer(id: string): boolean {
    const config = this.configs.get(id);
    if (config) {
      config.enabled = true;
      log.info('Server enabled', { serverId: id });
      return true;
    }
    return false;
  }

  /**
   * Disable a server
   */
  disableServer(id: string): boolean {
    const config = this.configs.get(id);
    if (config) {
      config.enabled = false;
      log.info('Server disabled', { serverId: id });
      return true;
    }
    return false;
  }

  /**
   * Clear all configurations
   */
  clear(): void {
    this.configs.clear();
    log.info('All server configs cleared');
  }

  /**
   * Merge config with defaults
   */
  private mergeWithDefaults(
    config: Partial<MCPServerConfig> & { id: string; name: string }
  ): MCPServerConfig {
    return {
      ...DEFAULT_SERVER_CONFIG,
      description: '',
      transport: 'stdio',
      endpoint: '',
      ...config,
      auth: { ...DEFAULT_SERVER_CONFIG.auth, ...config.auth } as MCPAuthConfig,
    } as MCPServerConfig;
  }

  /**
   * Validate a server configuration
   */
  validateConfig(config: MCPServerConfig): ConfigValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Required fields
    if (!config.id) errors.push('Missing server id');
    if (!config.name) errors.push('Missing server name');
    if (!config.endpoint) errors.push('Missing endpoint');

    // Transport validation
    const validTransports: MCPTransport[] = ['stdio', 'http', 'websocket'];
    if (!validTransports.includes(config.transport)) {
      errors.push(`Invalid transport: ${config.transport}`);
    }

    // Endpoint format validation
    if (config.transport === 'http' || config.transport === 'websocket') {
      if (!config.endpoint.startsWith('http') && !config.endpoint.startsWith('ws')) {
        errors.push(`Invalid endpoint URL for ${config.transport}: ${config.endpoint}`);
      }
    }

    // Auth validation
    const authResult = this.validateAuth(config.auth);
    errors.push(...authResult.errors);
    warnings.push(...authResult.warnings);

    // Permission validation
    const validPermissions: MCPPermission[] = [
      'readFiles',
      'writeFiles',
      'deleteFiles',
      'executeCommands',
      'networkAccess',
      'environmentVariables',
      'processManagement',
    ];
    for (const perm of config.permissions) {
      if (!validPermissions.includes(perm)) {
        errors.push(`Invalid permission: ${perm}`);
      }
    }

    // Timeout validation
    if (config.timeout < 1000) {
      warnings.push('Timeout less than 1 second may cause issues');
    }
    if (config.timeout > 300000) {
      warnings.push('Timeout greater than 5 minutes is not recommended');
    }

    // Priority validation
    if (config.priority < 0 || config.priority > 1000) {
      warnings.push('Priority should be between 0 and 1000');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Validate authentication configuration
   */
  private validateAuth(auth: MCPAuthConfig): { errors: string[]; warnings: string[] } {
    const errors: string[] = [];
    const warnings: string[] = [];

    const validMethods = ['none', 'api_key', 'oauth', 'token', 'basic'];
    if (!validMethods.includes(auth.method)) {
      errors.push(`Invalid auth method: ${auth.method}`);
      return { errors, warnings };
    }

    switch (auth.method) {
      case 'api_key':
        if (!auth.apiKey) {
          errors.push('api_key auth requires apiKey');
        }
        break;

      case 'token':
        if (!auth.token) {
          errors.push('token auth requires token');
        }
        break;

      case 'basic':
        if (!auth.username || !auth.password) {
          errors.push('basic auth requires username and password');
        }
        break;

      case 'oauth':
        if (!auth.oauth) {
          errors.push('oauth auth requires oauth configuration');
        } else {
          if (!auth.oauth.clientId) errors.push('oauth requires clientId');
          if (!auth.oauth.clientSecret) errors.push('oauth requires clientSecret');
          if (!auth.oauth.tokenUrl) errors.push('oauth requires tokenUrl');
        }
        break;

      case 'none':
        if (auth.apiKey || auth.token || auth.username) {
          warnings.push('Auth method is none but credentials are provided');
        }
        break;
    }

    return { errors, warnings };
  }

  /**
   * Export configurations for persistence
   */
  exportConfigs(): MCPServerConfig[] {
    return this.getAllConfigs().map((config) => ({
      ...config,
      // Redact sensitive auth data
      auth: {
        method: config.auth.method,
        ...(config.auth.apiKey && { apiKey: '***' }),
        ...(config.auth.token && { token: '***' }),
        ...(config.auth.password && { password: '***' }),
        ...(config.auth.oauth && {
          oauth: {
            ...config.auth.oauth,
            clientSecret: '***',
          },
        }),
      } as MCPAuthConfig,
    }));
  }

  /**
   * Import configurations
   */
  importConfigs(configs: Array<Partial<MCPServerConfig> & { id: string; name: string }>): {
    imported: number;
    failed: number;
    errors: string[];
  } {
    let imported = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const config of configs) {
      const result = this.addConfig(config);
      if (result.valid) {
        imported++;
      } else {
        failed++;
        errors.push(`${config.id}: ${result.errors.join(', ')}`);
      }
    }

    log.info('Configs imported', { imported, failed });
    return { imported, failed, errors };
  }

  /**
   * Get configuration statistics
   */
  getStats(): Record<string, unknown> {
    const configs = this.getAllConfigs();
    const enabled = configs.filter((c) => c.enabled);

    return {
      total: configs.length,
      enabled: enabled.length,
      disabled: configs.length - enabled.length,
      byTransport: {
        stdio: configs.filter((c) => c.transport === 'stdio').length,
        http: configs.filter((c) => c.transport === 'http').length,
        websocket: configs.filter((c) => c.transport === 'websocket').length,
      },
      byAuth: {
        none: configs.filter((c) => c.auth.method === 'none').length,
        api_key: configs.filter((c) => c.auth.method === 'api_key').length,
        token: configs.filter((c) => c.auth.method === 'token').length,
        oauth: configs.filter((c) => c.auth.method === 'oauth').length,
        basic: configs.filter((c) => c.auth.method === 'basic').length,
      },
    };
  }
}

/**
 * Get config manager singleton
 */
export function getMCPConfigManager(): MCPConfigManager {
  return MCPConfigManager.getInstance();
}

/**
 * Reset config manager (for testing)
 */
export function resetMCPConfigManager(): void {
  MCPConfigManager.reset();
}
