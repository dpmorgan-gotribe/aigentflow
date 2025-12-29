/**
 * Init Command
 *
 * Initializes a new aigentflow project with the specified configuration.
 */

import * as fs from 'fs';
import * as path from 'path';
import chalk from 'chalk';
import ora from 'ora';
import type { ComplianceFramework } from '../../types.js';
import { initializeDatabase } from '../../persistence/database.js';
import { getProjectRepository } from '../../persistence/repositories/project-repository.js';
import { getAuditRepository } from '../../persistence/repositories/audit-repository.js';
import { logger } from '../../utils/logger.js';

const log = logger.child({ component: 'cli-init' });

interface InitOptions {
  template: string;
  compliance?: string[];
  git: boolean;
}

export async function initCommand(name: string, options: InitOptions): Promise<void> {
  const spinner = ora(`Creating project "${name}"...`).start();

  try {
    // Validate project name
    if (!/^[a-z0-9-_]+$/i.test(name)) {
      spinner.fail('Invalid project name. Use only letters, numbers, hyphens, and underscores.');
      process.exit(1);
    }

    // Parse compliance frameworks
    const frameworks: ComplianceFramework[] = (options.compliance || [])
      .map((f) => f.toUpperCase() as ComplianceFramework)
      .filter((f): f is ComplianceFramework =>
        ['SOC2', 'GDPR', 'HIPAA', 'PCI-DSS', 'NONE'].includes(f)
      );

    // Determine project path
    const projectPath = path.resolve(process.cwd(), name);

    // Check if directory already exists
    if (fs.existsSync(projectPath)) {
      spinner.fail(`Directory "${name}" already exists.`);
      process.exit(1);
    }

    spinner.text = 'Creating project structure...';

    // Create project directory
    fs.mkdirSync(projectPath, { recursive: true });

    // Create .aigentflow directory
    const aigentflowDir = path.join(projectPath, '.aigentflow');
    fs.mkdirSync(aigentflowDir, { recursive: true });

    // Initialize database in .aigentflow
    const dbPath = path.join(aigentflowDir, 'aigentflow.db');
    initializeDatabase(dbPath);

    spinner.text = 'Registering project...';

    // Register project in database
    const projectRepo = getProjectRepository();
    projectRepo.create(name, projectPath, {
      compliance: frameworks,
    });

    // Log audit event
    const auditRepo = getAuditRepository();
    auditRepo.logUser('project_created', {
      name,
      path: projectPath,
      template: options.template,
      compliance: frameworks,
    });

    spinner.text = 'Creating configuration files...';

    // Create aigentflow.json config file
    const configFile = path.join(projectPath, 'aigentflow.json');
    const config = {
      name,
      version: '1.0.0',
      compliance: frameworks,
      agents: {
        maxConcurrent: 15,
      },
      hooks: [],
      features: {},
    };
    fs.writeFileSync(configFile, JSON.stringify(config, null, 2));

    // Create CLAUDE.md
    const claudeMdPath = path.join(projectPath, 'CLAUDE.md');
    const claudeMdContent = `# ${name}

This project is managed by Aigentflow - a self-evolving multi-agent orchestrator.

## Project Setup

- **Template**: ${options.template}
- **Compliance**: ${frameworks.length > 0 ? frameworks.join(', ') : 'None'}

## Commands

\`\`\`bash
# Run a task
aigentflow run "your prompt here"

# Check status
aigentflow status

# View configuration
aigentflow config --list

# View execution history
aigentflow history

# View learned lessons
aigentflow lessons
\`\`\`

## Agents

This project uses the following agents:
- **Orchestrator**: Central routing and coordination
- **Project Manager**: Work breakdown and dependency planning
- **Architect**: Technical decisions and ADR generation
- **Analyst**: Research and best practices

## Links

- [Aigentflow Documentation](https://github.com/your-org/aigentflow)
`;
    fs.writeFileSync(claudeMdPath, claudeMdContent);

    // Initialize git if requested
    if (options.git) {
      spinner.text = 'Initializing git repository...';

      const { execSync } = await import('child_process');
      try {
        execSync('git init', { cwd: projectPath, stdio: 'pipe' });

        // Create .gitignore
        const gitignorePath = path.join(projectPath, '.gitignore');
        const gitignoreContent = `# Dependencies
node_modules/

# Build
dist/

# Aigentflow
.aigentflow/aigentflow.db
.aigentflow/aigentflow.db-*

# Environment
.env
.env.local

# IDE
.vscode/
.idea/

# Logs
*.log
`;
        fs.writeFileSync(gitignorePath, gitignoreContent);
      } catch (error) {
        log.warn('Git initialization failed', { error });
        // Continue without git
      }
    }

    spinner.succeed(`Project "${name}" created successfully!`);

    console.log('');
    console.log(chalk.cyan('Next steps:'));
    console.log(`  ${chalk.gray('$')} cd ${name}`);
    console.log(`  ${chalk.gray('$')} aigentflow run "your prompt here"`);
    console.log('');

    if (frameworks.length > 0) {
      console.log(chalk.yellow(`Compliance frameworks enabled: ${frameworks.join(', ')}`));
      console.log('');
    }

    console.log(chalk.gray('Project structure:'));
    console.log(`  ${name}/`);
    console.log(`  ├── .aigentflow/`);
    console.log(`  │   └── aigentflow.db`);
    console.log(`  ├── aigentflow.json`);
    console.log(`  ├── CLAUDE.md`);
    if (options.git) {
      console.log(`  └── .gitignore`);
    }
    console.log('');
  } catch (error) {
    spinner.fail('Failed to create project');
    console.error(chalk.red(error instanceof Error ? error.message : String(error)));
    log.error('Project creation failed', error instanceof Error ? error : new Error(String(error)));
    process.exit(1);
  }
}
