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
import { getAuditRepository } from '../../persistence/repositories/audit-repository.js';
import { getWorkflowEngine, resetWorkflowEngine } from '../../core/workflow-engine.js';
import { getAgentPool, resetAgentPool } from '../../core/agent-pool.js';
import { analyzeTask } from '../../core/routing.js';
import { generateMockResponse, getAgentSequence, type MockAgentResponse } from '../../core/mock-responses.js';
import { logger } from '../../utils/logger.js';

const log = logger.child({ component: 'cli-run' });

interface RunOptions {
  stopAt?: WorkflowState;
  agent?: AgentType;
  dryRun: boolean;
  dev: boolean;
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

  if (options.dev) {
    console.log(chalk.magenta('DEVELOPMENT MODE - Using mock agent responses'));
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

  // Check if we're in a project directory
  if (fs.existsSync(aigentflowDir)) {
    const dbPath = path.join(aigentflowDir, 'aigentflow.db');
    initializeDatabase(dbPath);
    const projectRepo = getProjectRepository();
    const project = projectRepo.getByPath(cwd);
    projectId = project?.id;
  } else if (fs.existsSync(configFile)) {
    console.log(chalk.yellow('Warning: No .aigentflow directory found. Using in-memory database.'));
    initializeDatabase(':memory:');
  } else {
    console.log(chalk.yellow('Warning: Not in an aigentflow project. Using in-memory database.'));
    console.log(chalk.gray('Run `aigentflow init <name>` to create a project.'));
    console.log('');
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
      devMode: options.dev,
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

    // Development mode - execute with mock responses
    if (options.dev) {
      spinner.succeed('Analysis complete');
      console.log('');

      await executeDevMode(prompt, task.id, analysis.taskType, options, spinner);
      return;
    }

    // Production mode - simulate (until AI integration)
    spinner.text = 'Starting workflow...';
    await engine.startTask(task.id);
    spinner.text = `State: ${engine.getTask(task.id)?.state}`;

    const pool = getAgentPool();
    const poolStats = pool.getStats();

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
    console.log(chalk.gray('Use --dev flag for development mode with mock responses.'));
  } catch (error) {
    spinner.fail('Workflow failed');
    console.error(chalk.red(error instanceof Error ? error.message : String(error)));
    log.error('Workflow execution failed', error instanceof Error ? error : new Error(String(error)));
    process.exit(1);
  }
}

/**
 * Execute in development mode with mock responses
 */
async function executeDevMode(
  prompt: string,
  taskId: string,
  taskType: string,
  options: RunOptions,
  spinner: ReturnType<typeof ora>
): Promise<void> {
  const agentSequence = options.agent
    ? [options.agent]
    : getAgentSequence(taskType as Parameters<typeof getAgentSequence>[0]);

  console.log(chalk.cyan('Agent Execution Pipeline:'));
  console.log(chalk.gray(`  Sequence: ${agentSequence.join(' → ')}`));
  console.log('');

  const results: MockAgentResponse[] = [];
  const artifacts: { agent: string; name: string; type: string; size: number }[] = [];

  for (let i = 0; i < agentSequence.length; i++) {
    const agent = agentSequence[i];
    const stepNum = i + 1;

    spinner.start(`[${stepNum}/${agentSequence.length}] Running ${agent}...`);
    await sleep(800); // Simulate processing time

    try {
      const response = generateMockResponse(agent, prompt, taskType as Parameters<typeof generateMockResponse>[2]);
      results.push(response);

      if (response.artifacts) {
        for (const artifact of response.artifacts) {
          artifacts.push({
            agent,
            name: artifact.name,
            type: artifact.type,
            size: artifact.content.length,
          });
        }
      }

      spinner.succeed(`[${stepNum}/${agentSequence.length}] ${chalk.green(agent)}: ${response.message}`);

      // Show key output details
      if (response.output) {
        const outputPreview = getOutputPreview(agent, response.output);
        if (outputPreview) {
          console.log(chalk.gray(`      └─ ${outputPreview}`));
        }
      }

    } catch (error) {
      spinner.fail(`[${stepNum}/${agentSequence.length}] ${chalk.red(agent)}: Failed`);
      log.error(`Agent ${agent} failed`, error instanceof Error ? error : new Error(String(error)));
    }

    await sleep(200);
  }

  // Summary
  console.log('');
  console.log(chalk.cyan('═'.repeat(50)));
  console.log(chalk.green.bold('✓ Workflow Complete'));
  console.log(chalk.cyan('═'.repeat(50)));
  console.log('');

  console.log(chalk.cyan('Summary:'));
  console.log(`  Task ID: ${chalk.white(taskId)}`);
  console.log(`  Agents Run: ${chalk.white(String(results.length))}`);
  console.log(`  All Succeeded: ${results.every((r) => r.success) ? chalk.green('Yes') : chalk.red('No')}`);
  console.log('');

  if (artifacts.length > 0) {
    console.log(chalk.cyan('Generated Artifacts:'));
    for (const artifact of artifacts) {
      const icon = getArtifactIcon(artifact.type);
      console.log(`  ${icon} ${chalk.white(artifact.name)} ${chalk.gray(`(${formatSize(artifact.size)})`)}`);
    }
    console.log('');
  }

  // Show sample artifact content
  const htmlArtifact = results.find((r) => r.artifacts?.some((a) => a.type === 'html'))?.artifacts?.find((a) => a.type === 'html');
  if (htmlArtifact) {
    console.log(chalk.cyan('Sample Output (HTML Mockup):'));
    console.log(chalk.gray('─'.repeat(50)));
    // Show first 30 lines
    const lines = htmlArtifact.content.split('\n').slice(0, 30);
    for (const line of lines) {
      console.log(chalk.gray(line));
    }
    if (htmlArtifact.content.split('\n').length > 30) {
      console.log(chalk.gray(`... (${htmlArtifact.content.split('\n').length - 30} more lines)`));
    }
    console.log(chalk.gray('─'.repeat(50)));
    console.log('');
  }

  // Final notes
  console.log(chalk.gray('Development mode complete. In production, these would be real AI responses.'));
  console.log(chalk.gray('Use `aigentflow status` to see task details.'));
}

/**
 * Get a preview string for agent output
 */
function getOutputPreview(agent: string, output: Record<string, unknown>): string {
  switch (agent) {
    case 'orchestrator':
      return `Routing: ${(output as Record<string, Record<string, unknown>>).routing?.primary ?? 'unknown'}`;
    case 'project-manager':
      return `Tasks: ${((output as Record<string, Record<string, unknown>>).workBreakdown as Record<string, unknown[]>)?.tasks?.length ?? 0} items`;
    case 'architect':
      return `Pattern: ${(output as Record<string, Record<string, unknown>>).architecture?.pattern ?? 'unknown'}`;
    case 'ui-designer':
      return `Pages: ${((output as Record<string, Record<string, unknown>>).design as Record<string, unknown[]>)?.pages?.length ?? 0}, Responsive: ${(output as Record<string, Record<string, unknown>>).design?.responsive ?? false}`;
    case 'frontend-developer':
      return `Files: ${((output as Record<string, Record<string, unknown>>).implementation as Record<string, string[]>)?.files?.length ?? 0}`;
    case 'tester':
      return `Tests: ${(output as Record<string, Record<string, unknown>>).testResults?.passed ?? 0}/${(output as Record<string, Record<string, unknown>>).testResults?.total ?? 0} passed`;
    case 'reviewer':
      return `Score: ${(output as Record<string, Record<string, unknown>>).review?.score ?? 'N/A'}/10`;
    default:
      return '';
  }
}

/**
 * Get icon for artifact type
 */
function getArtifactIcon(type: string): string {
  switch (type) {
    case 'html':
      return '📄';
    case 'css':
      return '🎨';
    case 'file':
      return '📝';
    case 'json':
      return '📋';
    case 'markdown':
      return '📖';
    default:
      return '📎';
  }
}

/**
 * Format file size
 */
function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
