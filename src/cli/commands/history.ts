/**
 * History Command
 *
 * Show execution history with filtering options.
 */

import * as fs from 'fs';
import * as path from 'path';
import chalk from 'chalk';
import type { AgentType, WorkflowState } from '../../types.js';
import { initializeDatabase } from '../../persistence/database.js';
import { getWorkflowRepository } from '../../persistence/repositories/workflow-repository.js';
import { getAuditRepository } from '../../persistence/repositories/audit-repository.js';

interface HistoryOptions {
  limit: string;
  agent?: AgentType;
  state?: WorkflowState;
  since?: string;
  json: boolean;
}

export async function historyCommand(options: HistoryOptions): Promise<void> {
  const limit = parseInt(options.limit, 10) || 20;

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

  const workflowRepo = getWorkflowRepository();
  const auditRepo = getAuditRepository();

  // Get workflow states (tasks)
  const allWorkflows = workflowRepo.getStats();

  // Get transition history for analysis
  const auditOptions: Parameters<typeof auditRepo.search>[0] = {
    limit,
    category: 'workflow',
  };

  if (options.since) {
    auditOptions.since = new Date(options.since);
  }

  const auditLogs = auditRepo.search(auditOptions);

  // Group audit logs by task
  const taskHistory = new Map<string, {
    taskId: string;
    prompt?: string;
    state: string;
    status: string;
    agents: string[];
    events: Array<{ action: string; timestamp: string; details: unknown }>;
    startedAt?: string;
    completedAt?: string;
    success: boolean;
  }>();

  for (const log of auditLogs) {
    const taskId = log.task_id;
    if (!taskId) continue;

    if (!taskHistory.has(taskId)) {
      taskHistory.set(taskId, {
        taskId,
        state: 'unknown',
        status: 'unknown',
        agents: [],
        events: [],
        success: false,
      });
    }

    const task = taskHistory.get(taskId)!;
    const details = JSON.parse(log.details);

    task.events.push({
      action: log.action,
      timestamp: log.timestamp,
      details,
    });

    if (log.action === 'task_created') {
      task.prompt = details.prompt;
      task.startedAt = log.timestamp;
    }

    if (log.action === 'task_completed') {
      task.completedAt = log.timestamp;
      task.success = true;
    }

    if (log.action === 'task_aborted' || log.action === 'task_failed') {
      task.completedAt = log.timestamp;
      task.success = false;
    }

    if (log.agent_type && !task.agents.includes(log.agent_type)) {
      task.agents.push(log.agent_type);
    }

    // Update state from latest event
    if (details.state) {
      task.state = details.state;
    }
    if (details.status) {
      task.status = details.status;
    }
  }

  // Convert to array and apply filters
  let history = Array.from(taskHistory.values());

  if (options.agent) {
    history = history.filter((h) => h.agents.includes(options.agent!));
  }

  if (options.state) {
    history = history.filter((h) => h.state === options.state);
  }

  // Sort by most recent
  history.sort((a, b) => {
    const aTime = a.startedAt || '';
    const bTime = b.startedAt || '';
    return bTime.localeCompare(aTime);
  });

  history = history.slice(0, limit);

  if (options.json) {
    console.log(JSON.stringify(history, null, 2));
    return;
  }

  console.log(chalk.cyan('Execution History'));
  console.log(chalk.gray('─'.repeat(60)));
  console.log('');

  if (history.length === 0) {
    console.log(chalk.gray('No history found matching filters.'));
    console.log('');
    console.log(chalk.gray('Run `aigentflow run <prompt>` to create tasks.'));
    return;
  }

  for (const entry of history) {
    const stateColor = entry.success
      ? chalk.green
      : entry.state === 'ABORTED'
        ? chalk.yellow
        : chalk.red;

    console.log(`${chalk.white(entry.taskId)} ${stateColor(entry.state)}`);

    if (entry.prompt) {
      const promptPreview = entry.prompt.length > 50
        ? entry.prompt.slice(0, 50) + '...'
        : entry.prompt;
      console.log(`  Prompt: ${chalk.gray(promptPreview)}`);
    }

    if (entry.agents.length > 0) {
      console.log(`  Agents: ${chalk.gray(entry.agents.join(' → '))}`);
    }

    if (entry.startedAt) {
      console.log(`  Started: ${chalk.gray(entry.startedAt)}`);
    }

    if (entry.completedAt) {
      console.log(`  Completed: ${chalk.gray(entry.completedAt)}`);
    }

    // Show last event if error
    if (!entry.success && entry.events.length > 0) {
      const lastEvent = entry.events[entry.events.length - 1];
      if (lastEvent) {
        const eventDetails = lastEvent.details as Record<string, unknown>;
        if (eventDetails.error) {
          console.log(`  Error: ${chalk.red(String(eventDetails.error))}`);
        }
      }
    }

    console.log('');
  }

  console.log(chalk.gray(`Showing ${history.length} entries`));
  console.log('');

  // Show filter hints
  if (!options.agent && !options.state && !options.since) {
    console.log(chalk.gray('Filter options:'));
    console.log(chalk.gray('  --agent <type>   Filter by agent'));
    console.log(chalk.gray('  --state <state>  Filter by state'));
    console.log(chalk.gray('  --since <date>   Show since date'));
    console.log(chalk.gray('  --json           Output as JSON'));
  }
}
