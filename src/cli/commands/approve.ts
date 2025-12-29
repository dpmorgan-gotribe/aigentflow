/**
 * Approve Command
 *
 * Approve or reject pending design/architecture checkpoints.
 */

import * as fs from 'fs';
import * as path from 'path';
import chalk from 'chalk';
import { initializeDatabase } from '../../persistence/database.js';
import { getApprovalRepository } from '../../persistence/repositories/approval-repository.js';
import { getAuditRepository } from '../../persistence/repositories/audit-repository.js';
import { getWorkflowEngine } from '../../core/workflow-engine.js';

interface ApproveOptions {
  reject: boolean;
  message?: string;
  all: boolean;
}

export async function approveCommand(
  taskId: string | undefined,
  options: ApproveOptions
): Promise<void> {
  const action = options.reject ? 'Rejecting' : 'Approving';
  const actionPast = options.reject ? 'rejected' : 'approved';

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

  const approvalRepo = getApprovalRepository();
  const auditRepo = getAuditRepository();

  // Get pending approvals
  const pendingApprovals = approvalRepo.getPending();

  if (pendingApprovals.length === 0) {
    console.log(chalk.gray('No pending approvals.'));
    return;
  }

  if (options.all) {
    console.log(chalk.yellow(`${action} all pending items...`));
    console.log('');

    for (const approval of pendingApprovals) {
      console.log(`  ${action}: ${approval.description}`);

      if (options.reject) {
        approvalRepo.reject(approval.id, 'user', options.message);
        auditRepo.logUser('approval_rejected', {
          approvalId: approval.id,
          type: approval.type,
          message: options.message,
        }, approval.task_id);
      } else {
        approvalRepo.approve(approval.id, 'user', options.message);
        auditRepo.logUser('approval_approved', {
          approvalId: approval.id,
          type: approval.type,
          message: options.message,
        }, approval.task_id);
      }
    }

    console.log('');
    console.log(chalk.green(`All ${pendingApprovals.length} items ${actionPast}.`));

    // Resume any paused workflows
    const engine = getWorkflowEngine();
    for (const approval of pendingApprovals) {
      const task = engine.getTask(approval.task_id);
      if (task?.state === 'AWAITING_APPROVAL') {
        // Continue workflow
        try {
          if (!options.reject) {
            await engine.transitionTo(task.id, 'APPROVE');
          } else {
            await engine.transitionTo(task.id, 'REJECT');
          }
        } catch {
          // Task may not be in a state that can transition
        }
      }
    }

    return;
  }

  if (!taskId) {
    console.log(chalk.cyan('Pending Approvals'));
    console.log(chalk.gray('─'.repeat(50)));
    console.log('');

    for (const approval of pendingApprovals) {
      const typeColor = approval.type === 'design'
        ? chalk.blue
        : approval.type === 'architecture'
          ? chalk.magenta
          : chalk.yellow;

      console.log(`  ${chalk.white(approval.id)}`);
      console.log(`    ${approval.description}`);
      console.log(`    Type: ${typeColor(approval.type)} | Task: ${chalk.gray(approval.task_id)}`);
      console.log(`    Created: ${chalk.gray(approval.created_at)}`);

      if (approval.artifact) {
        try {
          const artifact = JSON.parse(approval.artifact);
          if (artifact.preview) {
            console.log(`    Preview: ${chalk.gray(artifact.preview.slice(0, 100))}...`);
          }
        } catch {
          console.log(`    Artifact: ${chalk.gray('attached')}`);
        }
      }

      console.log('');
    }

    console.log(chalk.gray('Use `aigentflow approve <id>` to approve a specific item.'));
    console.log(chalk.gray('Use `aigentflow approve <id> --reject` to reject.'));
    console.log(chalk.gray('Use `aigentflow approve --all` to approve all items.'));
    return;
  }

  // Find approval by ID or task ID
  let approval = approvalRepo.getById(taskId);
  if (!approval) {
    approval = approvalRepo.getByTaskId(taskId);
  }

  if (!approval) {
    console.log(chalk.red(`Approval "${taskId}" not found.`));
    console.log('');
    console.log(chalk.gray('Use `aigentflow approve` to see pending approvals.'));
    process.exit(1);
  }

  console.log(`${action}: ${approval.description}`);

  if (options.message) {
    console.log(`Message: ${options.message}`);
  }

  if (options.reject) {
    approvalRepo.reject(approval.id, 'user', options.message);
    auditRepo.logUser('approval_rejected', {
      approvalId: approval.id,
      type: approval.type,
      message: options.message,
    }, approval.task_id);
  } else {
    approvalRepo.approve(approval.id, 'user', options.message);
    auditRepo.logUser('approval_approved', {
      approvalId: approval.id,
      type: approval.type,
      message: options.message,
    }, approval.task_id);
  }

  console.log(chalk.green(`Approval ${approval.id} ${actionPast}.`));

  // Try to resume the workflow
  const engine = getWorkflowEngine();
  const task = engine.getTask(approval.task_id);
  if (task?.state === 'AWAITING_APPROVAL') {
    try {
      if (!options.reject) {
        await engine.transitionTo(task.id, 'APPROVE');
        console.log(chalk.gray('Workflow resumed.'));
      } else {
        await engine.transitionTo(task.id, 'REJECT');
        console.log(chalk.gray('Workflow reverted for revision.'));
      }
    } catch {
      // Task may not be in a state that can transition
    }
  }
}
