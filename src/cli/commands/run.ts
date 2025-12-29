/**
 * Run Command
 *
 * Executes the orchestrator with a given prompt.
 */

import * as fs from 'fs';
import * as path from 'path';
import chalk from 'chalk';
import ora from 'ora';
import type { WorkflowState, AgentType } from '../../types.js';
import { initializeDatabase } from '../../persistence/database.js';
import { getProjectRepository } from '../../persistence/repositories/project-repository.js';
import { getWorkflowRepository } from '../../persistence/repositories/workflow-repository.js';
import { getAuditRepository } from '../../persistence/repositories/audit-repository.js';
import { getWorkflowEngine, resetWorkflowEngine } from '../../core/workflow-engine.js';
import { getAgentPool, resetAgentPool } from '../../core/agent-pool.js';
import { analyzeTask } from '../../core/routing.js';
import { logger } from '../../utils/logger.js';

const log = logger.child({ component: 'cli-run' });

interface RunOptions {
  stopAt?: WorkflowState;
  agent?: AgentType;
  dryRun: boolean;
  approval: boolean;
}

export async function runCommand(prompt: string, options: RunOptions): Promise<void> {
  console.log(chalk.cyan('Aigentflow Orchestrator'));
  console.log(chalk.gray('─'.repeat(50)));
  console.log('');

  if (options.dryRun) {
    console.log(chalk.yellow('DRY RUN MODE - No changes will be made'));
    console.log('');
  }

  console.log(chalk.white('Prompt:'), prompt);
  console.log('');

  if (options.stopAt) {
    console.log(chalk.gray(`Will stop at state: ${options.stopAt}`));
  }

  if (options.agent) {
    console.log(chalk.gray(`Running specific agent: ${options.agent}`));
  }

  if (!options.approval) {
    console.log(chalk.yellow('Warning: Approval gates disabled'));
  }

  // Find project from current directory
  const cwd = process.cwd();
  const aigentflowDir = path.join(cwd, '.aigentflow');
  const configFile = path.join(cwd, 'aigentflow.json');

  let projectId: string | undefined;
  let projectName: string;

  // Check if we're in a project directory
  if (fs.existsSync(aigentflowDir)) {
    const dbPath = path.join(aigentflowDir, 'aigentflow.db');
    initializeDatabase(dbPath);
    const projectRepo = getProjectRepository();
    const project = projectRepo.getByPath(cwd);
    projectId = project?.id;
    projectName = project?.name ?? path.basename(cwd);
  } else if (fs.existsSync(configFile)) {
    // Read config to get project name
    try {
      const config = JSON.parse(fs.readFileSync(configFile, 'utf-8'));
      projectName = config.name ?? path.basename(cwd);
    } catch {
      projectName = path.basename(cwd);
    }
    console.log(chalk.yellow('Warning: No .aigentflow directory found. Using in-memory database.'));
    initializeDatabase(':memory:');
  } else {
    console.log(chalk.yellow('Warning: Not in an aigentflow project. Using in-memory database.'));
    console.log(chalk.gray('Run `aigentflow init <name>` to create a project.'));
    console.log('');
    projectName = 'temp-project';
    initializeDatabase(':memory:');
  }

  const spinner = ora('Analyzing prompt...').start();

  try {
    // Reset singletons to ensure fresh state
    resetWorkflowEngine();
    resetAgentPool();

    // Analyze the task
    const analysis = analyzeTask(prompt);

    spinner.text = `Task type: ${analysis.taskType} (complexity: ${analysis.complexity})`;
    await sleep(500);

    spinner.text = `Required agents: ${analysis.requiredAgents.join(', ')}`;
    await sleep(500);

    // Create task in workflow engine
    const engine = getWorkflowEngine();
    const task = engine.createTask(projectId ?? 'temp-project', prompt);

    // Log audit
    const auditRepo = getAuditRepository();
    auditRepo.logWorkflow('task_created', task.id, {
      prompt,
      analysis,
      dryRun: options.dryRun,
    });

    if (options.dryRun) {
      spinner.succeed('Analysis complete (dry run)');
      console.log('');
      console.log(chalk.cyan('Task Analysis:'));
      console.log(`  ID: ${chalk.white(task.id)}`);
      console.log(`  Type: ${chalk.white(analysis.taskType)}`);
      console.log(`  Complexity: ${chalk.white(analysis.complexity)}`);
      console.log(`  Estimated Steps: ${chalk.white(String(analysis.estimatedSteps))}`);
      console.log(`  Confidence: ${chalk.white((analysis.confidence * 100).toFixed(0))}%`);
      console.log('');
      console.log(chalk.cyan('Required Agents:'));
      for (const agent of analysis.requiredAgents) {
        console.log(`  - ${chalk.green(agent)}`);
      }
      if (analysis.optionalAgents.length > 0) {
        console.log('');
        console.log(chalk.cyan('Optional Agents:'));
        for (const agent of analysis.optionalAgents) {
          console.log(`  - ${chalk.gray(agent)}`);
        }
      }
      console.log('');
      console.log(chalk.gray('Dry run complete. No changes were made.'));
      return;
    }

    spinner.text = 'Starting workflow...';

    // Start the task
    await engine.startTask(task.id);

    spinner.text = `State: ${engine.getTask(task.id)?.state}`;

    // Get agent pool stats
    const pool = getAgentPool();
    const poolStats = pool.getStats();

    // Listen for events
    const events: string[] = [];
    engine.on((event) => {
      events.push(`[${new Date().toISOString()}] ${event.type}: ${event.taskId}`);
      spinner.text = `${event.type} - ${engine.getTask(task.id)?.state ?? 'unknown'}`;
    });

    // In MVP, we don't have actual agent implementations yet
    // So we'll simulate the workflow progression

    spinner.text = 'Orchestrating agents...';
    await sleep(1000);

    // Simulate state transitions
    const stateSequence: WorkflowState[] = ['ANALYZING', 'ORCHESTRATING', 'PLANNING'];

    for (const targetState of stateSequence) {
      if (options.stopAt && targetState === options.stopAt) {
        spinner.info(`Stopped at state: ${targetState}`);
        break;
      }

      const currentTask = engine.getTask(task.id);
      if (!currentTask) break;

      spinner.text = `State: ${currentTask.state}`;
      await sleep(500);
    }

    // Check for approval requirements
    if (options.approval) {
      const currentTask = engine.getTask(task.id);
      if (currentTask?.context.approvalsPending.length ?? 0 > 0) {
        spinner.warn('Awaiting approval');
        console.log('');
        console.log(chalk.yellow('Pending approvals:'));
        for (const approval of currentTask?.context.approvalsPending ?? []) {
          console.log(`  - ${approval}`);
        }
        console.log('');
        console.log(chalk.gray('Run `aigentflow approve` to view and approve pending items.'));
        return;
      }
    }

    spinner.succeed('Workflow initiated');

    console.log('');
    console.log(chalk.green('Task created successfully!'));
    console.log('');
    console.log(chalk.cyan('Task Details:'));
    const finalTask = engine.getTask(task.id);
    console.log(`  ID: ${chalk.white(task.id)}`);
    console.log(`  State: ${chalk.yellow(finalTask?.state ?? 'unknown')}`);
    console.log(`  Status: ${chalk.white(finalTask?.status ?? 'unknown')}`);
    console.log('');
    console.log(chalk.cyan('Agent Pool:'));
    console.log(`  Active: ${poolStats.active}/${poolStats.total}`);
    console.log(`  Queued: ${poolStats.queued}`);
    console.log('');
    console.log(chalk.gray('Run `aigentflow status` to see details.'));
    console.log(chalk.gray('Note: Full agent execution will be available in future increments.'));
  } catch (error) {
    spinner.fail('Workflow failed');
    console.error(chalk.red(error instanceof Error ? error.message : String(error)));
    log.error('Workflow execution failed', error instanceof Error ? error : new Error(String(error)));
    process.exit(1);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
