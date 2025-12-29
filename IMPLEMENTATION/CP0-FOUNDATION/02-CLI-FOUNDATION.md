# Step 02: CLI Foundation

> **Checkpoint:** CP0 - Foundation
> **Dependencies:** Step 01 (Project Setup)
> **Estimated Effort:** 3-4 hours

---

## Objective

Implement the CLI framework with all primary commands, argument parsing, and user interaction patterns.

---

## Deliverables

- [ ] All CLI commands implemented
- [ ] Command argument parsing with validation
- [ ] Help text for all commands
- [ ] Interactive prompts where needed
- [ ] Colored output and spinners
- [ ] Error handling with helpful messages

---

## CLI Command Specification

```
aigentflow <command> [options]

Commands:
  init <name>         Initialize a new project
  run <prompt>        Run orchestrator with a prompt
  status              Show current project status
  config              View/edit configuration
  approve             Approve pending checkpoint
  abort               Abort current operation
  history             Show execution history
  lessons             View/search learned lessons

Global Options:
  -v, --version       Show version
  -h, --help          Show help
  --debug             Enable debug output
  --no-color          Disable colored output
```

---

## Implementation Guide

### 1. Create CLI entry point

```typescript
// src/cli/index.ts
import { Command } from 'commander';
import chalk from 'chalk';
import { VERSION } from '../index';
import { initCommand } from './commands/init';
import { runCommand } from './commands/run';
import { statusCommand } from './commands/status';
import { configCommand } from './commands/config';
import { approveCommand } from './commands/approve';
import { abortCommand } from './commands/abort';
import { historyCommand } from './commands/history';
import { lessonsCommand } from './commands/lessons';

const program = new Command();

// Global error handler
process.on('uncaughtException', (error) => {
  console.error(chalk.red('Fatal error:'), error.message);
  if (process.env.DEBUG) {
    console.error(error.stack);
  }
  process.exit(1);
});

program
  .name('aigentflow')
  .description('CLI-first multi-agent orchestrator for full-stack development')
  .version(VERSION, '-v, --version', 'Show version number')
  .option('--debug', 'Enable debug output')
  .option('--no-color', 'Disable colored output')
  .hook('preAction', (thisCommand) => {
    const opts = thisCommand.opts();
    if (opts.debug) {
      process.env.DEBUG = 'true';
    }
    if (opts.noColor) {
      chalk.level = 0;
    }
  });

// Register commands
program.addCommand(initCommand);
program.addCommand(runCommand);
program.addCommand(statusCommand);
program.addCommand(configCommand);
program.addCommand(approveCommand);
program.addCommand(abortCommand);
program.addCommand(historyCommand);
program.addCommand(lessonsCommand);

// Parse arguments
program.parse();
```

### 2. Create init command

```typescript
// src/cli/commands/init.ts
import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';
import fs from 'fs';
import path from 'path';
import { logger } from '../../utils/logger';

interface InitOptions {
  template?: string;
  import?: string;
  compliance?: string[];
  yes?: boolean;
}

export const initCommand = new Command('init')
  .description('Initialize a new Aigentflow project')
  .argument('<name>', 'Project name')
  .option('-t, --template <template>', 'Project template (react, vue, fastapi, express)')
  .option('-i, --import <path>', 'Import existing codebase')
  .option('-c, --compliance <frameworks...>', 'Compliance frameworks (gdpr, soc2, hipaa)')
  .option('-y, --yes', 'Skip prompts, use defaults')
  .action(async (name: string, options: InitOptions) => {
    const spinner = ora();

    try {
      // Validate project name
      if (!/^[a-z0-9-]+$/.test(name)) {
        throw new Error('Project name must be lowercase alphanumeric with hyphens only');
      }

      const projectPath = path.join(process.cwd(), 'projects', name);

      // Check if project exists
      if (fs.existsSync(projectPath)) {
        throw new Error(`Project '${name}' already exists`);
      }

      // Interactive mode if not --yes
      let config: ProjectConfig;
      if (options.yes) {
        config = {
          name,
          template: options.template || 'react',
          compliance: options.compliance || [],
          importPath: options.import,
        };
      } else {
        config = await promptForConfig(name, options);
      }

      // Create project
      spinner.start('Creating project structure...');

      await createProjectStructure(projectPath, config);

      spinner.succeed('Project structure created');

      // Import existing codebase if specified
      if (config.importPath) {
        spinner.start('Analyzing existing codebase...');
        await analyzeExistingCode(projectPath, config.importPath);
        spinner.succeed('Codebase analyzed');
      }

      // Initialize git
      spinner.start('Initializing git repository...');
      await initGit(projectPath);
      spinner.succeed('Git repository initialized');

      // Done
      console.log('');
      logger.success(`Project '${name}' created successfully!`);
      console.log('');
      console.log('Next steps:');
      console.log(chalk.cyan(`  cd projects/${name}`));
      console.log(chalk.cyan('  aigentflow run "Your first feature request"'));
      console.log('');

    } catch (error) {
      spinner.fail('Failed to create project');
      logger.error((error as Error).message);
      process.exit(1);
    }
  });

interface ProjectConfig {
  name: string;
  template: string;
  compliance: string[];
  importPath?: string;
}

async function promptForConfig(name: string, options: InitOptions): Promise<ProjectConfig> {
  const answers = await inquirer.prompt([
    {
      type: 'list',
      name: 'template',
      message: 'Select project template:',
      choices: [
        { name: 'React + TypeScript', value: 'react' },
        { name: 'Vue 3 + TypeScript', value: 'vue' },
        { name: 'FastAPI + Python', value: 'fastapi' },
        { name: 'Express + TypeScript', value: 'express' },
        { name: 'Full Stack (React + FastAPI)', value: 'fullstack' },
        { name: 'Empty (no template)', value: 'empty' },
      ],
      default: options.template || 'react',
    },
    {
      type: 'checkbox',
      name: 'compliance',
      message: 'Select compliance frameworks:',
      choices: [
        { name: 'GDPR (General Data Protection)', value: 'gdpr' },
        { name: 'SOC 2 (Security)', value: 'soc2' },
        { name: 'HIPAA (Healthcare)', value: 'hipaa' },
        { name: 'PCI-DSS (Payment)', value: 'pci' },
      ],
      default: options.compliance || [],
    },
  ]);

  return {
    name,
    template: answers.template,
    compliance: answers.compliance,
    importPath: options.import,
  };
}

async function createProjectStructure(projectPath: string, config: ProjectConfig): Promise<void> {
  // Create directories
  const dirs = [
    '',
    'designs/mockups',
    'designs/styles',
    'designs/flows',
    'src',
    'tests',
    '.aigentflow',
  ];

  for (const dir of dirs) {
    fs.mkdirSync(path.join(projectPath, dir), { recursive: true });
  }

  // Create CLAUDE.md
  const claudeMd = `# ${config.name}

## Project Overview

This project was initialized with Aigentflow.

## Tech Stack

Template: ${config.template}
${config.compliance.length > 0 ? `Compliance: ${config.compliance.join(', ')}` : ''}

## Development Guidelines

[Guidelines will be populated as the project evolves]

## Current Focus

[Current tasks and priorities]
`;

  fs.writeFileSync(path.join(projectPath, 'CLAUDE.md'), claudeMd);

  // Create project config
  const projectConfig = {
    name: config.name,
    version: '0.1.0',
    template: config.template,
    compliance: config.compliance,
    created: new Date().toISOString(),
  };

  fs.writeFileSync(
    path.join(projectPath, '.aigentflow', 'config.json'),
    JSON.stringify(projectConfig, null, 2)
  );
}

async function analyzeExistingCode(projectPath: string, importPath: string): Promise<void> {
  // Placeholder - implemented fully in Step 05 with Project Analyzer agent
  logger.info(`Would analyze codebase at: ${importPath}`);
}

async function initGit(projectPath: string): Promise<void> {
  const simpleGit = (await import('simple-git')).default;
  const git = simpleGit(projectPath);
  await git.init();
  await git.add('.');
  await git.commit('Initial commit from Aigentflow');
}
```

### 3. Create run command

```typescript
// src/cli/commands/run.ts
import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { logger } from '../../utils/logger';
import { findProjectRoot } from '../../utils/project';

interface RunOptions {
  stopAt?: string;
  agent?: string;
  dryRun?: boolean;
  autoApprove?: boolean;
}

export const runCommand = new Command('run')
  .description('Run the orchestrator with a prompt')
  .argument('<prompt>', 'The task/feature to implement')
  .option('-s, --stop-at <stage>', 'Stop at specific stage (plan, design, build, test, review)')
  .option('-a, --agent <agent>', 'Route directly to specific agent')
  .option('--dry-run', 'Show what would be done without executing')
  .option('--auto-approve', 'Auto-approve all checkpoints')
  .action(async (prompt: string, options: RunOptions) => {
    const spinner = ora();

    try {
      // Find project root
      const projectRoot = await findProjectRoot();
      if (!projectRoot) {
        throw new Error('Not in an Aigentflow project. Run "aigentflow init <name>" first.');
      }

      logger.info(`Project: ${projectRoot}`);
      logger.info(`Prompt: "${prompt}"`);

      if (options.dryRun) {
        console.log('');
        console.log(chalk.yellow('DRY RUN - No changes will be made'));
        console.log('');
        console.log('Would execute:');
        console.log('  1. Analyze prompt');
        console.log('  2. Create plan');
        console.log('  3. Generate designs');
        console.log('  4. Build implementation');
        console.log('  5. Run tests');
        console.log('  6. Review code');
        return;
      }

      // Start orchestration - placeholder for Step 03
      spinner.start('Analyzing prompt...');
      await new Promise((resolve) => setTimeout(resolve, 1000));
      spinner.succeed('Prompt analyzed');

      // More steps will be added in Step 03
      logger.info('Orchestrator not yet implemented. See Step 03.');

    } catch (error) {
      spinner.fail('Failed');
      logger.error((error as Error).message);
      process.exit(1);
    }
  });
```

### 4. Create status command

```typescript
// src/cli/commands/status.ts
import { Command } from 'commander';
import chalk from 'chalk';
import { logger } from '../../utils/logger';
import { findProjectRoot } from '../../utils/project';

interface StatusOptions {
  worktrees?: boolean;
  agents?: boolean;
  json?: boolean;
}

export const statusCommand = new Command('status')
  .description('Show current project status')
  .option('-w, --worktrees', 'Show worktree status')
  .option('-a, --agents', 'Show agent status')
  .option('--json', 'Output as JSON')
  .action(async (options: StatusOptions) => {
    try {
      const projectRoot = await findProjectRoot();

      if (!projectRoot) {
        console.log('');
        console.log(chalk.yellow('No active project'));
        console.log('');
        console.log('To start a new project:');
        console.log(chalk.cyan('  aigentflow init <project-name>'));
        console.log('');
        return;
      }

      // Get project status - placeholder for Step 03
      const status = {
        project: projectRoot,
        state: 'idle',
        currentTask: null,
        worktrees: [],
        agents: {
          active: 0,
          pending: 0,
        },
      };

      if (options.json) {
        console.log(JSON.stringify(status, null, 2));
        return;
      }

      console.log('');
      console.log(chalk.bold('Project Status'));
      console.log('─'.repeat(40));
      console.log(`Project:  ${chalk.cyan(status.project)}`);
      console.log(`State:    ${chalk.green(status.state)}`);
      console.log(`Task:     ${status.currentTask || chalk.gray('None')}`);
      console.log('');

      if (options.worktrees) {
        console.log(chalk.bold('Worktrees'));
        console.log('─'.repeat(40));
        if (status.worktrees.length === 0) {
          console.log(chalk.gray('  No active worktrees'));
        }
        console.log('');
      }

      if (options.agents) {
        console.log(chalk.bold('Agents'));
        console.log('─'.repeat(40));
        console.log(`  Active:  ${status.agents.active}`);
        console.log(`  Pending: ${status.agents.pending}`);
        console.log('');
      }

    } catch (error) {
      logger.error((error as Error).message);
      process.exit(1);
    }
  });
```

### 5. Create config command

```typescript
// src/cli/commands/config.ts
import { Command } from 'commander';
import chalk from 'chalk';
import inquirer from 'inquirer';
import fs from 'fs';
import path from 'path';
import { logger } from '../../utils/logger';
import { getConfigPath, loadConfig, saveConfig } from '../../utils/config';

export const configCommand = new Command('config')
  .description('View or edit configuration')
  .argument('[key]', 'Configuration key to get/set')
  .argument('[value]', 'Value to set')
  .option('-g, --global', 'Use global configuration')
  .option('-e, --edit', 'Open in editor')
  .option('--reset', 'Reset to defaults')
  .action(async (key: string | undefined, value: string | undefined, options) => {
    try {
      const configPath = getConfigPath(options.global);
      const config = loadConfig(configPath);

      // Reset config
      if (options.reset) {
        const { confirm } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'confirm',
            message: 'Reset configuration to defaults?',
            default: false,
          },
        ]);

        if (confirm) {
          fs.unlinkSync(configPath);
          logger.success('Configuration reset');
        }
        return;
      }

      // Get specific key
      if (key && !value) {
        const val = getNestedValue(config, key);
        if (val === undefined) {
          logger.error(`Key '${key}' not found`);
          process.exit(1);
        }
        console.log(typeof val === 'object' ? JSON.stringify(val, null, 2) : val);
        return;
      }

      // Set specific key
      if (key && value) {
        setNestedValue(config, key, parseValue(value));
        saveConfig(configPath, config);
        logger.success(`Set ${key} = ${value}`);
        return;
      }

      // Show all config
      console.log('');
      console.log(chalk.bold('Configuration'));
      console.log('─'.repeat(40));
      console.log(chalk.gray(`Path: ${configPath}`));
      console.log('');
      console.log(JSON.stringify(config, null, 2));
      console.log('');

    } catch (error) {
      logger.error((error as Error).message);
      process.exit(1);
    }
  });

function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce((o, k) => (o as Record<string, unknown>)?.[k], obj);
}

function setNestedValue(obj: Record<string, unknown>, path: string, value: unknown): void {
  const keys = path.split('.');
  const last = keys.pop()!;
  const target = keys.reduce((o, k) => {
    if (!(k in o)) o[k] = {};
    return o[k] as Record<string, unknown>;
  }, obj);
  target[last] = value;
}

function parseValue(value: string): unknown {
  if (value === 'true') return true;
  if (value === 'false') return false;
  if (!isNaN(Number(value))) return Number(value);
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}
```

### 6. Create approve command

```typescript
// src/cli/commands/approve.ts
import { Command } from 'commander';
import chalk from 'chalk';
import inquirer from 'inquirer';
import { logger } from '../../utils/logger';
import { findProjectRoot } from '../../utils/project';

export const approveCommand = new Command('approve')
  .description('Approve pending checkpoint')
  .option('-a, --all', 'Approve all pending checkpoints')
  .option('--with-comments <comments>', 'Add comments to approval')
  .action(async (options) => {
    try {
      const projectRoot = await findProjectRoot();
      if (!projectRoot) {
        throw new Error('Not in an Aigentflow project');
      }

      // Get pending approvals - placeholder for Step 03
      const pendingApprovals: Approval[] = [];

      if (pendingApprovals.length === 0) {
        logger.info('No pending approvals');
        return;
      }

      if (options.all) {
        // Approve all
        for (const approval of pendingApprovals) {
          await processApproval(approval, true, options.withComments);
        }
        logger.success(`Approved ${pendingApprovals.length} checkpoints`);
      } else {
        // Interactive approval
        for (const approval of pendingApprovals) {
          await interactiveApproval(approval);
        }
      }

    } catch (error) {
      logger.error((error as Error).message);
      process.exit(1);
    }
  });

interface Approval {
  id: string;
  type: string;
  description: string;
  artifacts: string[];
}

async function interactiveApproval(approval: Approval): Promise<void> {
  console.log('');
  console.log(chalk.bold(`Approval Required: ${approval.type}`));
  console.log('─'.repeat(40));
  console.log(approval.description);
  console.log('');
  console.log('Artifacts:');
  approval.artifacts.forEach((a) => console.log(`  - ${a}`));
  console.log('');

  const { action } = await inquirer.prompt([
    {
      type: 'list',
      name: 'action',
      message: 'Action:',
      choices: [
        { name: 'Approve', value: 'approve' },
        { name: 'Reject', value: 'reject' },
        { name: 'View artifacts', value: 'view' },
        { name: 'Skip for now', value: 'skip' },
      ],
    },
  ]);

  if (action === 'approve') {
    await processApproval(approval, true);
    logger.success('Approved');
  } else if (action === 'reject') {
    const { reason } = await inquirer.prompt([
      { type: 'input', name: 'reason', message: 'Rejection reason:' },
    ]);
    await processApproval(approval, false, reason);
    logger.info('Rejected');
  }
}

async function processApproval(
  approval: Approval,
  approved: boolean,
  comments?: string
): Promise<void> {
  // Placeholder - implemented in Step 03
  logger.debug(`Processing approval ${approval.id}: ${approved}`);
}
```

### 7. Create abort command

```typescript
// src/cli/commands/abort.ts
import { Command } from 'commander';
import chalk from 'chalk';
import inquirer from 'inquirer';
import { logger } from '../../utils/logger';
import { findProjectRoot } from '../../utils/project';

export const abortCommand = new Command('abort')
  .description('Abort current operation')
  .option('-f, --force', 'Force abort without confirmation')
  .option('--rollback', 'Rollback to last checkpoint')
  .action(async (options) => {
    try {
      const projectRoot = await findProjectRoot();
      if (!projectRoot) {
        throw new Error('Not in an Aigentflow project');
      }

      // Check if operation is running - placeholder
      const isRunning = false;

      if (!isRunning) {
        logger.info('No operation in progress');
        return;
      }

      if (!options.force) {
        const { confirm } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'confirm',
            message: chalk.yellow('Are you sure you want to abort the current operation?'),
            default: false,
          },
        ]);

        if (!confirm) {
          logger.info('Abort cancelled');
          return;
        }
      }

      // Abort operation - placeholder for Step 03
      if (options.rollback) {
        logger.info('Rolling back to last checkpoint...');
      }

      logger.success('Operation aborted');

    } catch (error) {
      logger.error((error as Error).message);
      process.exit(1);
    }
  });
```

### 8. Create history command

```typescript
// src/cli/commands/history.ts
import { Command } from 'commander';
import chalk from 'chalk';
import { logger } from '../../utils/logger';
import { findProjectRoot } from '../../utils/project';

interface HistoryOptions {
  limit?: number;
  agent?: string;
  json?: boolean;
}

export const historyCommand = new Command('history')
  .description('Show execution history')
  .option('-l, --limit <count>', 'Limit results', '10')
  .option('-a, --agent <agent>', 'Filter by agent')
  .option('--json', 'Output as JSON')
  .action(async (options: HistoryOptions) => {
    try {
      const projectRoot = await findProjectRoot();
      if (!projectRoot) {
        throw new Error('Not in an Aigentflow project');
      }

      // Get history - placeholder for Step 04
      const history: HistoryEntry[] = [];

      if (options.json) {
        console.log(JSON.stringify(history, null, 2));
        return;
      }

      if (history.length === 0) {
        logger.info('No execution history');
        return;
      }

      console.log('');
      console.log(chalk.bold('Execution History'));
      console.log('─'.repeat(60));

      for (const entry of history) {
        const status = entry.success
          ? chalk.green('✓')
          : chalk.red('✗');

        console.log(
          `${status} ${chalk.gray(entry.timestamp)} ${entry.agent} - ${entry.task}`
        );
      }

      console.log('');

    } catch (error) {
      logger.error((error as Error).message);
      process.exit(1);
    }
  });

interface HistoryEntry {
  id: string;
  timestamp: string;
  agent: string;
  task: string;
  success: boolean;
  duration: number;
}
```

### 9. Create lessons command

```typescript
// src/cli/commands/lessons.ts
import { Command } from 'commander';
import chalk from 'chalk';
import { logger } from '../../utils/logger';
import { findProjectRoot } from '../../utils/project';

interface LessonsOptions {
  search?: string;
  category?: string;
  limit?: number;
  json?: boolean;
}

export const lessonsCommand = new Command('lessons')
  .description('View or search learned lessons')
  .option('-s, --search <query>', 'Search lessons')
  .option('-c, --category <category>', 'Filter by category')
  .option('-l, --limit <count>', 'Limit results', '20')
  .option('--json', 'Output as JSON')
  .action(async (options: LessonsOptions) => {
    try {
      const projectRoot = await findProjectRoot();
      if (!projectRoot) {
        throw new Error('Not in an Aigentflow project');
      }

      // Get lessons - placeholder for Step 04
      const lessons: Lesson[] = [];

      if (options.json) {
        console.log(JSON.stringify(lessons, null, 2));
        return;
      }

      if (lessons.length === 0) {
        logger.info('No lessons recorded yet');
        return;
      }

      console.log('');
      console.log(chalk.bold('Learned Lessons'));
      console.log('─'.repeat(60));

      for (const lesson of lessons) {
        console.log('');
        console.log(chalk.cyan(`[${lesson.category}]`), chalk.bold(lesson.title));
        console.log(chalk.gray(lesson.summary));
      }

      console.log('');

    } catch (error) {
      logger.error((error as Error).message);
      process.exit(1);
    }
  });

interface Lesson {
  id: string;
  category: string;
  title: string;
  summary: string;
  details: string;
  created: string;
}
```

### 10. Create utility functions

```typescript
// src/utils/project.ts
import fs from 'fs';
import path from 'path';

export async function findProjectRoot(): Promise<string | null> {
  let current = process.cwd();

  while (current !== path.parse(current).root) {
    const configPath = path.join(current, '.aigentflow', 'config.json');
    if (fs.existsSync(configPath)) {
      return current;
    }

    // Check if we're in the projects directory
    const projectsPath = path.join(current, 'projects');
    if (fs.existsSync(projectsPath)) {
      // We're at aigentflow root, check if cwd is inside a project
      const relativePath = path.relative(projectsPath, process.cwd());
      if (!relativePath.startsWith('..')) {
        const projectName = relativePath.split(path.sep)[0];
        if (projectName) {
          const projectPath = path.join(projectsPath, projectName);
          if (fs.existsSync(path.join(projectPath, '.aigentflow', 'config.json'))) {
            return projectPath;
          }
        }
      }
    }

    current = path.dirname(current);
  }

  return null;
}

export function getProjectConfig(projectPath: string): ProjectConfig | null {
  const configPath = path.join(projectPath, '.aigentflow', 'config.json');
  if (!fs.existsSync(configPath)) {
    return null;
  }

  return JSON.parse(fs.readFileSync(configPath, 'utf-8'));
}

interface ProjectConfig {
  name: string;
  version: string;
  template: string;
  compliance: string[];
  created: string;
}
```

```typescript
// src/utils/config.ts
import fs from 'fs';
import path from 'path';
import os from 'os';

export interface GlobalConfig {
  anthropicApiKey?: string;
  defaultTemplate: string;
  debug: boolean;
  editor: string;
  theme: 'auto' | 'light' | 'dark';
}

const DEFAULT_CONFIG: GlobalConfig = {
  defaultTemplate: 'react',
  debug: false,
  editor: process.env.EDITOR || 'code',
  theme: 'auto',
};

export function getConfigPath(global: boolean = false): string {
  if (global) {
    const configDir = path.join(os.homedir(), '.aigentflow');
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }
    return path.join(configDir, 'config.json');
  }

  return path.join(process.cwd(), '.aigentflow', 'config.json');
}

export function loadConfig(configPath: string): GlobalConfig {
  if (!fs.existsSync(configPath)) {
    return { ...DEFAULT_CONFIG };
  }

  const content = fs.readFileSync(configPath, 'utf-8');
  return { ...DEFAULT_CONFIG, ...JSON.parse(content) };
}

export function saveConfig(configPath: string, config: GlobalConfig): void {
  const dir = path.dirname(configPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
}
```

---

## Test Scenarios

```typescript
// tests/cp0/02-cli-foundation.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const CLI = 'npx tsx src/cli/index.ts';
const TEST_PROJECT = 'test-cli-project';

describe('Step 02: CLI Foundation', () => {
  beforeAll(() => {
    // Clean up any existing test project
    const projectPath = path.join('projects', TEST_PROJECT);
    if (fs.existsSync(projectPath)) {
      fs.rmSync(projectPath, { recursive: true });
    }
  });

  afterAll(() => {
    // Clean up test project
    const projectPath = path.join('projects', TEST_PROJECT);
    if (fs.existsSync(projectPath)) {
      fs.rmSync(projectPath, { recursive: true });
    }
  });

  describe('Global options', () => {
    it('should show version', () => {
      const result = execSync(`${CLI} --version`, { encoding: 'utf-8' });
      expect(result.trim()).toMatch(/^\d+\.\d+\.\d+$/);
    });

    it('should show help', () => {
      const result = execSync(`${CLI} --help`, { encoding: 'utf-8' });
      expect(result).toContain('Usage:');
      expect(result).toContain('Commands:');
      expect(result).toContain('init');
      expect(result).toContain('run');
      expect(result).toContain('status');
    });
  });

  describe('init command', () => {
    it('should create a new project', () => {
      execSync(`${CLI} init ${TEST_PROJECT} --yes`, { encoding: 'utf-8' });

      const projectPath = path.join('projects', TEST_PROJECT);
      expect(fs.existsSync(projectPath)).toBe(true);
      expect(fs.existsSync(path.join(projectPath, 'CLAUDE.md'))).toBe(true);
      expect(fs.existsSync(path.join(projectPath, '.aigentflow', 'config.json'))).toBe(true);
    });

    it('should reject invalid project names', () => {
      expect(() => {
        execSync(`${CLI} init "Invalid Name!" --yes`, { encoding: 'utf-8' });
      }).toThrow();
    });

    it('should reject duplicate project names', () => {
      expect(() => {
        execSync(`${CLI} init ${TEST_PROJECT} --yes`, { encoding: 'utf-8' });
      }).toThrow();
    });
  });

  describe('status command', () => {
    it('should show status outside project', () => {
      const result = execSync(`${CLI} status`, { encoding: 'utf-8' });
      expect(result).toContain('No active project');
    });

    it('should show JSON output with --json flag', () => {
      const result = execSync(`${CLI} status --json`, {
        encoding: 'utf-8',
        cwd: path.join('projects', TEST_PROJECT),
      });
      const status = JSON.parse(result);
      expect(status).toHaveProperty('project');
      expect(status).toHaveProperty('state');
    });
  });

  describe('config command', () => {
    it('should show configuration', () => {
      const result = execSync(`${CLI} config --global`, { encoding: 'utf-8' });
      expect(result).toContain('Configuration');
    });

    it('should set configuration value', () => {
      execSync(`${CLI} config debug true --global`, { encoding: 'utf-8' });
      const result = execSync(`${CLI} config debug --global`, { encoding: 'utf-8' });
      expect(result.trim()).toBe('true');
    });
  });

  describe('run command', () => {
    it('should show dry run output', () => {
      const result = execSync(`${CLI} run "test" --dry-run`, {
        encoding: 'utf-8',
        cwd: path.join('projects', TEST_PROJECT),
      });
      expect(result).toContain('DRY RUN');
      expect(result).toContain('Would execute');
    });
  });

  describe('error handling', () => {
    it('should show helpful error for unknown command', () => {
      try {
        execSync(`${CLI} unknown-command`, { encoding: 'utf-8' });
      } catch (error: any) {
        expect(error.stderr.toString()).toContain('unknown command');
      }
    });
  });
});
```

---

## Validation Checklist

```
□ aigentflow --version shows version
□ aigentflow --help lists all commands
□ aigentflow init creates project with correct structure
□ aigentflow status works inside and outside projects
□ aigentflow config shows and sets configuration
□ aigentflow run --dry-run shows execution plan
□ aigentflow approve works (with placeholder)
□ aigentflow abort works (with placeholder)
□ aigentflow history works (with placeholder)
□ aigentflow lessons works (with placeholder)
□ Colored output works
□ Error messages are helpful
□ --debug flag enables debug output
□ --no-color disables colors
```

---

## Next Step

Once all tests pass and checklist is complete, proceed to **Step 03: State Machine**.
