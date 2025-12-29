/**
 * Status Command
 *
 * Shows current project state and workflow status.
 */

import * as fs from 'fs';
import * as path from 'path';
import chalk from 'chalk';
import { initializeDatabase, getDatabase } from '../../persistence/database.js';
import { getProjectRepository } from '../../persistence/repositories/project-repository.js';
import { getWorkflowRepository } from '../../persistence/repositories/workflow-repository.js';
import { getApprovalRepository } from '../../persistence/repositories/approval-repository.js';
import { getLessonRepository } from '../../persistence/repositories/lesson-repository.js';
import { getAgentPool } from '../../core/agent-pool.js';
import { getWorkflowEngine } from '../../core/workflow-engine.js';

interface StatusOptions {
  verbose: boolean;
  json: boolean;
}

export async function statusCommand(options: StatusOptions): Promise<void> {
  // Find project from current directory
  const cwd = process.cwd();
  const aigentflowDir = path.join(cwd, '.aigentflow');
  const configFile = path.join(cwd, 'aigentflow.json');

  let projectName = 'No project';
  let projectPath = cwd;
  let dbConnected = false;

  // Check if we're in a project directory
  if (fs.existsSync(aigentflowDir)) {
    const dbPath = path.join(aigentflowDir, 'aigentflow.db');
    initializeDatabase(dbPath);
    dbConnected = true;

    const projectRepo = getProjectRepository();
    const project = projectRepo.getByPath(cwd);
    if (project) {
      projectName = project.name;
      const config = JSON.parse(project.config);
      projectPath = project.path;
    }
  } else if (fs.existsSync(configFile)) {
    try {
      const config = JSON.parse(fs.readFileSync(configFile, 'utf-8'));
      projectName = config.name ?? path.basename(cwd);
    } catch {
      projectName = path.basename(cwd);
    }
  }

  // Gather status information
  const workflowRepo = dbConnected ? getWorkflowRepository() : null;
  const approvalRepo = dbConnected ? getApprovalRepository() : null;
  const lessonRepo = dbConnected ? getLessonRepository() : null;

  // Get workflow stats
  const workflowStats = workflowRepo?.getStats() ?? {};
  const pendingApprovals = approvalRepo?.getPending() ?? [];
  const lessonStats = lessonRepo?.getStats() ?? {};

  // Get agent pool stats
  const pool = getAgentPool();
  const poolStats = pool.getStats();

  // Get active tasks
  const engine = getWorkflowEngine();
  const allTasks = engine.getAllTasks();
  const runningTasks = engine.getTasksByStatus('running');

  const status = {
    project: {
      name: projectName,
      path: projectPath,
      version: '1.0.0',
    },
    workflow: {
      state: runningTasks.length > 0 ? runningTasks[0]?.state : 'IDLE',
      activeTasks: runningTasks.length,
      totalTasks: allTasks.length,
      pendingApprovals: pendingApprovals.length,
      stats: workflowStats,
    },
    agents: {
      active: poolStats.active,
      queued: poolStats.queued,
      maxConcurrent: poolStats.total,
      byType: Object.fromEntries(poolStats.byType),
    },
    database: {
      connected: dbConnected,
      tasksCount: workflowStats.totalWorkflows ?? 0,
      lessonsCount: lessonStats.totalLessons ?? 0,
    },
  };

  if (options.json) {
    console.log(JSON.stringify(status, null, 2));
    return;
  }

  console.log(chalk.cyan('Aigentflow Status'));
  console.log(chalk.gray('─'.repeat(50)));
  console.log('');

  // Project info
  console.log(chalk.white('Project:'));
  console.log(`  Name: ${chalk.green(status.project.name)}`);
  console.log(`  Path: ${chalk.gray(status.project.path)}`);
  console.log('');

  // Workflow state
  console.log(chalk.white('Workflow:'));
  console.log(`  State: ${chalk.yellow(String(status.workflow.state))}`);
  console.log(`  Active Tasks: ${status.workflow.activeTasks}`);
  console.log(`  Total Tasks: ${status.workflow.totalTasks}`);
  console.log(`  Pending Approvals: ${pendingApprovals.length > 0 ? chalk.yellow(String(pendingApprovals.length)) : '0'}`);
  console.log('');

  // Agent pool
  console.log(chalk.white('Agent Pool:'));
  console.log(`  Active: ${status.agents.active}/${status.agents.maxConcurrent}`);
  console.log(`  Queued: ${status.agents.queued}`);

  if (Object.keys(status.agents.byType).length > 0) {
    console.log('  By Type:');
    for (const [type, count] of Object.entries(status.agents.byType)) {
      console.log(`    ${type}: ${count}`);
    }
  }
  console.log('');

  if (options.verbose) {
    // Database stats
    console.log(chalk.white('Database:'));
    console.log(`  Connected: ${status.database.connected ? chalk.green('yes') : chalk.red('no')}`);
    console.log(`  Tasks: ${status.database.tasksCount}`);
    console.log(`  Lessons: ${status.database.lessonsCount}`);
    console.log('');

    // Pending approvals detail
    if (pendingApprovals.length > 0) {
      console.log(chalk.white('Pending Approvals:'));
      for (const approval of pendingApprovals.slice(0, 5)) {
        console.log(`  ${chalk.yellow(approval.id)}: ${approval.description}`);
        console.log(`    Type: ${chalk.gray(approval.type)} | Created: ${chalk.gray(approval.created_at)}`);
      }
      if (pendingApprovals.length > 5) {
        console.log(`  ... and ${pendingApprovals.length - 5} more`);
      }
      console.log('');
    }

    // Active tasks detail
    if (runningTasks.length > 0) {
      console.log(chalk.white('Running Tasks:'));
      for (const task of runningTasks.slice(0, 5)) {
        console.log(`  ${chalk.yellow(task.id)}: ${task.prompt.slice(0, 40)}...`);
        console.log(`    State: ${chalk.gray(task.state)} | Status: ${chalk.gray(task.status)}`);
      }
      if (runningTasks.length > 5) {
        console.log(`  ... and ${runningTasks.length - 5} more`);
      }
      console.log('');
    }

    // Workflow statistics
    if (workflowStats.byState && typeof workflowStats.byState === 'object') {
      console.log(chalk.white('Tasks by State:'));
      for (const [state, count] of Object.entries(workflowStats.byState)) {
        console.log(`  ${state}: ${count}`);
      }
      console.log('');
    }
  }

  // Quick actions
  if (pendingApprovals.length > 0) {
    console.log(chalk.gray('Run `aigentflow approve` to handle pending approvals.'));
  }
  if (!dbConnected) {
    console.log(chalk.gray('Run `aigentflow init <name>` to create a project.'));
  }
}
