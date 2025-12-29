/**
 * Config Command
 *
 * View or modify configuration values.
 */

import * as fs from 'fs';
import * as path from 'path';
import chalk from 'chalk';
import { initializeDatabase } from '../../persistence/database.js';
import { getConfigRepository } from '../../persistence/repositories/config-repository.js';
import { DEFAULT_CONFIG } from '../../config/defaults.js';

interface ConfigOptions {
  global: boolean;
  list: boolean;
  reset: boolean;
}

export async function configCommand(
  key: string | undefined,
  value: string | undefined,
  options: ConfigOptions
): Promise<void> {
  const scope = options.global ? 'global' : 'project';

  // Find project and initialize database
  const cwd = process.cwd();
  const aigentflowDir = path.join(cwd, '.aigentflow');

  if (fs.existsSync(aigentflowDir)) {
    const dbPath = path.join(aigentflowDir, 'aigentflow.db');
    initializeDatabase(dbPath);
  } else if (options.global) {
    // For global config, use user home directory
    const homeDir = process.env.HOME || process.env.USERPROFILE || '.';
    const globalDir = path.join(homeDir, '.aigentflow');
    if (!fs.existsSync(globalDir)) {
      fs.mkdirSync(globalDir, { recursive: true });
    }
    const dbPath = path.join(globalDir, 'global.db');
    initializeDatabase(dbPath);
  } else {
    console.log(chalk.yellow('Not in an aigentflow project.'));
    console.log(chalk.gray('Run `aigentflow init <name>` to create a project.'));
    console.log(chalk.gray('Or use `--global` flag for global configuration.'));
    return;
  }

  const configRepo = getConfigRepository();

  if (options.reset) {
    console.log(chalk.yellow(`Resetting ${scope} configuration to defaults...`));
    configRepo.reset(scope);
    console.log(chalk.green('Configuration reset successfully.'));
    return;
  }

  if (options.list || (!key && !value)) {
    console.log(chalk.cyan(`${scope.charAt(0).toUpperCase() + scope.slice(1)} Configuration`));
    console.log(chalk.gray('─'.repeat(50)));
    console.log('');

    // Get merged config (defaults + stored)
    const storedConfig = configRepo.getAllAsObject(scope);
    const mergedConfig = { ...DEFAULT_CONFIG, ...storedConfig };

    // Group by prefix
    const groups = new Map<string, Map<string, unknown>>();

    for (const [k, v] of Object.entries(mergedConfig)) {
      const parts = k.split('.');
      const group = parts[0] ?? 'general';
      const subKey = parts.slice(1).join('.') || k;

      if (!groups.has(group)) {
        groups.set(group, new Map());
      }
      groups.get(group)!.set(subKey, v);
    }

    for (const [group, values] of groups) {
      console.log(chalk.white(`[${group}]`));
      for (const [k, v] of values) {
        const displayValue = formatValue(v);
        const isDefault = !Object.hasOwn(storedConfig, `${group}.${k}`) && !Object.hasOwn(storedConfig, k);
        console.log(`  ${chalk.gray(k)}: ${displayValue}${isDefault ? chalk.gray(' (default)') : ''}`);
      }
      console.log('');
    }

    console.log(chalk.gray('Use `aigentflow config <key> <value>` to set a value.'));
    console.log(chalk.gray('Use `aigentflow config --reset` to restore defaults.'));
    return;
  }

  if (key && value) {
    // Set value
    let parsedValue: unknown = value;

    // Try to parse as JSON for objects/arrays
    if (value.startsWith('{') || value.startsWith('[')) {
      try {
        parsedValue = JSON.parse(value);
      } catch {
        // Keep as string
      }
    } else if (value === 'true') {
      parsedValue = true;
    } else if (value === 'false') {
      parsedValue = false;
    } else if (!isNaN(Number(value))) {
      parsedValue = Number(value);
    }

    configRepo.set(key, parsedValue, scope);
    console.log(chalk.green(`Configuration updated: ${key} = ${formatValue(parsedValue)}`));
    return;
  }

  if (key) {
    // Get value
    const storedValue = configRepo.get(key, scope);
    const defaultValue = DEFAULT_CONFIG[key as keyof typeof DEFAULT_CONFIG];
    const effectiveValue = storedValue ?? defaultValue;

    if (effectiveValue === undefined) {
      console.log(chalk.yellow(`Configuration key "${key}" not found.`));
      return;
    }

    console.log(`${key}: ${formatValue(effectiveValue)}`);
    if (storedValue === undefined && defaultValue !== undefined) {
      console.log(chalk.gray('(using default value)'));
    }
  }
}

function formatValue(value: unknown): string {
  if (value === null) return chalk.gray('null');
  if (value === undefined) return chalk.gray('undefined');
  if (typeof value === 'boolean') return value ? chalk.green('true') : chalk.red('false');
  if (typeof value === 'number') return chalk.yellow(String(value));
  if (typeof value === 'string') return chalk.white(`"${value}"`);
  if (Array.isArray(value)) return chalk.cyan(JSON.stringify(value));
  if (typeof value === 'object') return chalk.cyan(JSON.stringify(value));
  return String(value);
}
