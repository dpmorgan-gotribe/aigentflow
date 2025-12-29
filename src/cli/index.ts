#!/usr/bin/env node
/**
 * Aigentflow CLI
 *
 * Main entry point for the command-line interface.
 */

import { Command } from 'commander';
import { VERSION } from '../index.js';

// Create the main program
const program = new Command();

program
  .name('aigentflow')
  .description('Self-evolving multi-agent orchestrator for software development')
  .version(VERSION, '-v, --version', 'Display version number');

// ============================================================================
// Init Command
// ============================================================================
program
  .command('init <name>')
  .description('Initialize a new aigentflow project')
  .option('-t, --template <template>', 'Project template to use', 'default')
  .option('-c, --compliance <frameworks...>', 'Compliance frameworks (SOC2, GDPR, HIPAA, PCI-DSS)')
  .option('--no-git', 'Skip git initialization')
  .action(async (name: string, options) => {
    const { initCommand } = await import('./commands/init.js');
    await initCommand(name, options);
  });

// ============================================================================
// Run Command
// ============================================================================
program
  .command('run <prompt>')
  .description('Execute the orchestrator with a prompt')
  .option('-s, --stop-at <state>', 'Stop execution at specified state')
  .option('-a, --agent <agent>', 'Run specific agent only')
  .option('-d, --dry-run', 'Show what would be executed without running')
  .option('--dev', 'Development mode with mock agent responses')
  .option('--no-approval', 'Skip approval gates (use with caution)')
  .action(async (prompt: string, options) => {
    const { runCommand } = await import('./commands/run.js');
    await runCommand(prompt, options);
  });

// ============================================================================
// Status Command
// ============================================================================
program
  .command('status')
  .description('Show current project state and workflow status')
  .option('-v, --verbose', 'Show detailed status information')
  .option('-j, --json', 'Output as JSON')
  .action(async (options) => {
    const { statusCommand } = await import('./commands/status.js');
    await statusCommand(options);
  });

// ============================================================================
// Config Command
// ============================================================================
program
  .command('config [key] [value]')
  .description('View or modify configuration')
  .option('-g, --global', 'Use global configuration')
  .option('-l, --list', 'List all configuration values')
  .option('--reset', 'Reset configuration to defaults')
  .action(async (key: string | undefined, value: string | undefined, options) => {
    const { configCommand } = await import('./commands/config.js');
    await configCommand(key, value, options);
  });

// ============================================================================
// Approve Command
// ============================================================================
program
  .command('approve [taskId]')
  .description('Approve pending design or architecture checkpoint')
  .option('-r, --reject', 'Reject instead of approve')
  .option('-m, --message <message>', 'Approval/rejection message')
  .option('--all', 'Approve all pending items')
  .action(async (taskId: string | undefined, options) => {
    const { approveCommand } = await import('./commands/approve.js');
    await approveCommand(taskId, options);
  });

// ============================================================================
// Abort Command
// ============================================================================
program
  .command('abort [taskId]')
  .description('Abort running operation')
  .option('-f, --force', 'Force abort without cleanup')
  .option('--rollback', 'Rollback to last checkpoint')
  .action(async (taskId: string | undefined, options) => {
    const { abortCommand } = await import('./commands/abort.js');
    await abortCommand(taskId, options);
  });

// ============================================================================
// History Command
// ============================================================================
program
  .command('history')
  .description('Show execution history')
  .option('-n, --limit <count>', 'Number of entries to show', '20')
  .option('-a, --agent <agent>', 'Filter by agent type')
  .option('-s, --state <state>', 'Filter by workflow state')
  .option('--since <date>', 'Show entries since date')
  .option('-j, --json', 'Output as JSON')
  .action(async (options) => {
    const { historyCommand } = await import('./commands/history.js');
    await historyCommand(options);
  });

// ============================================================================
// Lessons Command
// ============================================================================
program
  .command('lessons')
  .description('View and search learned lessons')
  .option('-s, --search <query>', 'Search lessons by keyword')
  .option('-a, --agent <agent>', 'Filter by agent type')
  .option('-c, --category <category>', 'Filter by category')
  .option('-n, --limit <count>', 'Number of entries to show', '10')
  .option('--add <lesson>', 'Add a new lesson manually')
  .action(async (options) => {
    const { lessonsCommand } = await import('./commands/lessons.js');
    await lessonsCommand(options);
  });

// ============================================================================
// Admin Commands (Emergency Procedures)
// ============================================================================
const admin = program.command('admin').description('Administrative commands');

admin
  .command('emergency')
  .description('Emergency procedures')
  .option('--disable-evolution', 'Disable self-evolution')
  .option('--disable-generated-agents', 'Disable all generated agents')
  .option('--single-tenant-mode', 'Switch to single-tenant mode')
  .option('--pause-all', 'Pause all operations')
  .action(async (options) => {
    const { emergencyCommand } = await import('./commands/admin/emergency.js');
    await emergencyCommand(options);
  });

// Parse and execute
program.parse();
