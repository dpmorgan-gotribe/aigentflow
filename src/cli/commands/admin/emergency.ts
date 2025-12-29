/**
 * Emergency Admin Command
 *
 * Emergency procedures for critical situations.
 */

import * as fs from 'fs';
import * as path from 'path';
import chalk from 'chalk';
import ora from 'ora';
import { initializeDatabase } from '../../../persistence/database.js';
import { getConfigRepository } from '../../../persistence/repositories/config-repository.js';
import { getAuditRepository } from '../../../persistence/repositories/audit-repository.js';
import { getWorkflowEngine } from '../../../core/workflow-engine.js';
import { getAgentPool } from '../../../core/agent-pool.js';
import { setFeatureFlag } from '../../../core/feature-flags.js';

interface EmergencyOptions {
  disableEvolution: boolean;
  disableGeneratedAgents: boolean;
  singleTenantMode: boolean;
  pauseAll: boolean;
}

export async function emergencyCommand(options: EmergencyOptions): Promise<void> {
  const hasOption = Object.values(options).some(Boolean);

  if (!hasOption) {
    console.log(chalk.red('EMERGENCY PROCEDURES'));
    console.log(chalk.gray('─'.repeat(50)));
    console.log('');
    console.log(chalk.yellow('Available emergency commands:'));
    console.log('');
    console.log('  --disable-evolution        Disable self-evolution features');
    console.log('  --disable-generated-agents Disable all generated agents');
    console.log('  --single-tenant-mode       Switch to single-tenant mode');
    console.log('  --pause-all                Pause all operations');
    console.log('');
    console.log(chalk.red('Warning: These are emergency procedures. Use with caution.'));
    return;
  }

  // Initialize database
  const cwd = process.cwd();
  const aigentflowDir = path.join(cwd, '.aigentflow');

  if (fs.existsSync(aigentflowDir)) {
    const dbPath = path.join(aigentflowDir, 'aigentflow.db');
    initializeDatabase(dbPath);
  } else {
    // Use home directory for global operations
    const homeDir = process.env.HOME || process.env.USERPROFILE || '.';
    const globalDir = path.join(homeDir, '.aigentflow');
    if (!fs.existsSync(globalDir)) {
      fs.mkdirSync(globalDir, { recursive: true });
    }
    const dbPath = path.join(globalDir, 'global.db');
    initializeDatabase(dbPath);
  }

  const configRepo = getConfigRepository();
  const auditRepo = getAuditRepository();
  const engine = getWorkflowEngine();
  const pool = getAgentPool();

  const spinner = ora('Executing emergency procedure...').start();
  const actionsPerformed: string[] = [];

  try {
    if (options.pauseAll) {
      spinner.text = 'Pausing all operations...';

      // Abort all running tasks
      const runningTasks = engine.getTasksByStatus('running');
      for (const task of runningTasks) {
        try {
          await engine.abortTask(task.id);
        } catch {
          // Continue with other tasks
        }
      }

      // Release all active agents
      const activeAgents = pool.getActiveAgents();
      for (const agent of activeAgents) {
        pool.releaseAgent(agent.id);
      }

      // Set pause flag
      configRepo.set('system.paused', true, 'global');

      auditRepo.log(
        'security',
        'critical',
        'emergency_pause_all',
        'admin',
        {
          reason: 'emergency-procedure',
          abortedTasks: runningTasks.length,
          releasedAgents: activeAgents.length,
        }
      );

      actionsPerformed.push(`Paused all operations (${runningTasks.length} tasks, ${activeAgents.length} agents)`);
    }

    if (options.disableEvolution) {
      spinner.text = 'Disabling self-evolution...';

      setFeatureFlag('features.selfEvolution', false);
      configRepo.set('features.selfEvolution', false, 'global');

      auditRepo.log(
        'security',
        'critical',
        'emergency_disable_evolution',
        'admin',
        { reason: 'emergency-procedure' }
      );

      actionsPerformed.push('Self-evolution disabled');
    }

    if (options.disableGeneratedAgents) {
      spinner.text = 'Disabling generated agents...';

      setFeatureFlag('features.generatedAgents', false);
      configRepo.set('features.generatedAgents', false, 'global');

      auditRepo.log(
        'security',
        'critical',
        'emergency_disable_generated_agents',
        'admin',
        { reason: 'emergency-procedure' }
      );

      actionsPerformed.push('Generated agents disabled');
    }

    if (options.singleTenantMode) {
      spinner.text = 'Switching to single-tenant mode...';

      setFeatureFlag('features.multiTenant', false);
      configRepo.set('features.multiTenant', false, 'global');

      auditRepo.log(
        'security',
        'critical',
        'emergency_single_tenant',
        'admin',
        { reason: 'emergency-procedure' }
      );

      actionsPerformed.push('Single-tenant mode enabled');
    }

    spinner.succeed('Emergency procedures completed');
    console.log('');

    console.log(chalk.yellow('Actions performed:'));
    for (const action of actionsPerformed) {
      console.log(`  ${chalk.red('!')} ${action}`);
    }
    console.log('');

    console.log(chalk.gray('All actions logged to audit trail.'));
    console.log('');

    // Show recovery instructions
    console.log(chalk.yellow('To restore normal operation:'));
    if (options.pauseAll) {
      console.log('  aigentflow config system.paused false --global');
    }
    if (options.disableEvolution) {
      console.log('  aigentflow config features.selfEvolution true --global');
    }
    if (options.disableGeneratedAgents) {
      console.log('  aigentflow config features.generatedAgents true --global');
    }
    if (options.singleTenantMode) {
      console.log('  aigentflow config features.multiTenant true --global');
    }
  } catch (error) {
    spinner.fail('Emergency procedure failed');
    console.error(chalk.red(error instanceof Error ? error.message : String(error)));

    // Log failure
    auditRepo.log(
      'security',
      'critical',
      'emergency_procedure_failed',
      'admin',
      {
        error: error instanceof Error ? error.message : String(error),
        options,
      }
    );

    process.exit(1);
  }
}
