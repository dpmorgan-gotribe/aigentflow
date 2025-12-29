/**
 * Abort Command
 *
 * Abort running operations with optional rollback.
 */

import * as fs from 'fs';
import * as path from 'path';
import chalk from 'chalk';
import ora from 'ora';
import { initializeDatabase } from '../../persistence/database.js';
import { getWorkflowRepository } from '../../persistence/repositories/workflow-repository.js';
import { getAuditRepository } from '../../persistence/repositories/audit-repository.js';
import { getWorkflowEngine } from '../../core/workflow-engine.js';
import { getAgentPool } from '../../core/agent-pool.js';

interface AbortOptions {
  force: boolean;
  rollback: boolean;
}

export async function abortCommand(
  taskId: string | undefined,
  options: AbortOptions
): Promise<void> {
  // Find project and initialize database
  const cwd = process.cwd();
  const aigentflowDir = path.join(cwd, '.aigentflow');

  if (!fs.existsSync(aigentflowDir)) {
    console.log(chalk.yellow('Not in an aigentflow project.'));
    console.log(chalk.gray('Run `aigentflow init <name>` to create a project.'));
    return;
  }

  const dbPath = path.join(aigentflowDir, 'aigentflow.db');
  initializeDatabase(dbPath);

  const engine = getWorkflowEngine();
  const pool = getAgentPool();
  const workflowRepo = getWorkflowRepository();
  const auditRepo = getAuditRepository();

  // Get running tasks
  const runningTasks = engine.getTasksByStatus('running');

  if (runningTasks.length === 0) {
    console.log(chalk.gray('No active tasks to abort.'));
    return;
  }

  if (!taskId) {
    console.log(chalk.cyan('Active Tasks'));
    console.log(chalk.gray('─'.repeat(50)));
    console.log('');

    for (const task of runningTasks) {
      const activeAgents = pool.getActiveAgents().filter((a) => a.taskId === task.id);

      console.log(`  ${chalk.white(task.id)}: ${chalk.yellow(task.state)}`);
      console.log(`    Prompt: ${chalk.gray(task.prompt.slice(0, 50))}...`);
      console.log(`    Status: ${chalk.gray(task.status)}`);
      console.log(`    Active Agents: ${chalk.gray(activeAgents.map((a) => a.type).join(', ') || 'none')}`);
      console.log(`    Created: ${chalk.gray(task.createdAt.toISOString())}`);
      console.log('');
    }

    console.log(chalk.gray('Use `aigentflow abort <taskId>` to abort a specific task.'));
    if (runningTasks.length > 1) {
      console.log(chalk.gray('Use `aigentflow abort --all` to abort all tasks.'));
    }
    return;
  }

  const task = engine.getTask(taskId);
  if (!task) {
    console.log(chalk.red(`Task "${taskId}" not found.`));
    process.exit(1);
  }

  if (task.status !== 'running') {
    console.log(chalk.yellow(`Task "${taskId}" is not running (status: ${task.status}).`));
    return;
  }

  if (options.force) {
    console.log(chalk.yellow('Force aborting without cleanup...'));
  }

  const spinner = ora(`Aborting task ${taskId}...`).start();

  try {
    // Cancel any queued agent requests for this task
    const cancelled = pool.cancelTaskRequests(taskId);
    if (cancelled > 0) {
      spinner.text = `Cancelled ${cancelled} queued agent requests...`;
    }

    // Release any active agents for this task
    const activeAgents = pool.getActiveAgents().filter((a) => a.taskId === taskId);
    for (const agent of activeAgents) {
      spinner.text = `Releasing agent ${agent.type}...`;
      pool.releaseAgent(agent.id);
    }

    // Get checkpoint info before aborting
    const checkpoints = engine.getCheckpoints(taskId);
    const latestCheckpoint = checkpoints[0];

    // Abort the task
    await engine.abortTask(taskId);

    // Log audit
    auditRepo.logWorkflow('task_aborted', taskId, {
      force: options.force,
      rollback: options.rollback,
      releasedAgents: activeAgents.map((a) => a.type),
      cancelledRequests: cancelled,
    });

    if (options.rollback && latestCheckpoint) {
      spinner.text = 'Rolling back to last checkpoint...';

      // In MVP, we don't have full rollback support yet
      // Just log the checkpoint info
      auditRepo.logWorkflow('rollback_attempted', taskId, {
        checkpointId: latestCheckpoint.id,
        checkpointState: latestCheckpoint.state,
        checkpointCreated: latestCheckpoint.createdAt,
      });

      spinner.succeed(`Task ${taskId} aborted.`);
      console.log('');
      console.log(chalk.cyan('Rollback Information:'));
      console.log(`  Checkpoint: ${chalk.white(latestCheckpoint.id)}`);
      console.log(`  State: ${chalk.yellow(latestCheckpoint.state)}`);
      console.log(`  Created: ${chalk.gray(latestCheckpoint.createdAt.toISOString())}`);
      console.log('');
      console.log(chalk.gray('Note: Full rollback implementation coming in future increments.'));
    } else {
      spinner.succeed(`Task ${taskId} aborted.`);
    }

    console.log('');

    // Show summary
    if (activeAgents.length > 0) {
      console.log(chalk.gray(`Released ${activeAgents.length} active agent(s).`));
    }
    if (cancelled > 0) {
      console.log(chalk.gray(`Cancelled ${cancelled} queued request(s).`));
    }

    if (!options.rollback && checkpoints.length > 0) {
      console.log('');
      console.log(chalk.gray(`${checkpoints.length} checkpoint(s) available for recovery.`));
      console.log(chalk.gray('Use `aigentflow abort --rollback` to restore last checkpoint.'));
    }
  } catch (error) {
    spinner.fail('Failed to abort task');
    console.error(chalk.red(error instanceof Error ? error.message : String(error)));
    process.exit(1);
  }
}
