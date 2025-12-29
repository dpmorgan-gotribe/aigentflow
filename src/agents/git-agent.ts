/**
 * Git Agent
 *
 * Manages Git operations for the orchestrator.
 */

import { BaseAgent } from './base-agent.js';
import type {
  AgentMetadata,
  AgentRequest,
  AgentResult,
  AgentExecutionOptions,
  ExecutionContext,
  AgentType,
} from './types.js';
import {
  getBranchManager,
  getWorktreeManager,
  getFileLockManager,
  type BranchManager,
  type WorktreeManager,
  type FileLockManager,
  type GitAgentOutput,
  type GitOperation,
  type BranchInfo,
  type WorktreeInfo,
  type FileLock,
  type ConflictInfo,
  type BranchType,
} from '../git/index.js';

/**
 * Git Agent class
 */
export class GitAgent extends BaseAgent {
  readonly metadata: AgentMetadata = {
    type: 'git-agent',
    name: 'Git Agent',
    description: 'Manages Git operations, branches, worktrees, and file locks',
    phase: 'v1.0',
    defaultConfig: {
      enabled: true,
      maxConcurrent: 1, // Git operations should be serialized
      timeout: 120000,
      retryCount: 2,
    },
    capabilities: [
      'branch-management',
      'worktree-management',
      'file-locking',
      'merge-operations',
      'conflict-detection',
    ],
    validStates: ['ANALYZING', 'BUILDING', 'REVIEWING', 'TESTING'],
  };

  private branchManager: BranchManager;
  private worktreeManager: WorktreeManager;
  private fileLockManager: FileLockManager;

  constructor() {
    super();
    this.branchManager = getBranchManager();
    this.worktreeManager = getWorktreeManager();
    this.fileLockManager = getFileLockManager();
  }

  /**
   * Execute the Git agent
   */
  protected async executeCore(
    request: AgentRequest,
    _options: Required<AgentExecutionOptions>
  ): Promise<AgentResult> {
    const startTime = Date.now();
    const { context, prompt } = request;

    this.log.info('Starting Git operation', {
      projectName: context.projectConfig.name,
      prompt: prompt.substring(0, 100),
    });

    try {
      // Parse Git operation from prompt
      const operation = this.parseOperation(prompt);

      // Execute the operation
      const output = await this.executeOperation(operation, prompt, context);

      // Determine next agent
      const nextAgent = this.determineNextAgent(output, context);

      this.log.info('Git operation complete', {
        operation,
        success: output.success,
        nextAgent,
      });

      return this.createSuccessResult(
        output,
        startTime,
        200, // Estimated tokens
        0,
        {
          nextAgent,
          reasoning: output.message || 'Git operation completed',
        }
      );
    } catch (error) {
      this.log.error('Git operation failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Parse Git operation from prompt
   */
  private parseOperation(prompt: string): GitOperation {
    const lower = prompt.toLowerCase();

    // Branch operations
    if (lower.includes('create') && lower.includes('branch')) {
      return 'branch-create';
    }
    if (lower.includes('delete') && lower.includes('branch')) {
      return 'branch-delete';
    }
    if (lower.includes('checkout') || lower.includes('switch')) {
      return 'branch-checkout';
    }
    if (lower.includes('merge')) {
      return 'branch-merge';
    }

    // Worktree operations
    if ((lower.includes('add') || lower.includes('create')) && lower.includes('worktree')) {
      return 'worktree-add';
    }
    if ((lower.includes('remove') || lower.includes('delete')) && lower.includes('worktree')) {
      return 'worktree-remove';
    }
    if (lower.includes('prune') && lower.includes('worktree')) {
      return 'worktree-prune';
    }

    // Git operations
    if (lower.includes('commit')) {
      return 'commit';
    }
    if (lower.includes('push')) {
      return 'push';
    }
    if (lower.includes('pull')) {
      return 'pull';
    }
    if (lower.includes('fetch')) {
      return 'fetch';
    }
    if (lower.includes('rebase')) {
      return 'rebase';
    }
    if (lower.includes('stash')) {
      return 'stash';
    }
    if (lower.includes('status') || lower.includes('list') || lower.includes('show')) {
      return 'status';
    }

    // Default to branch checkout
    return 'branch-checkout';
  }

  /**
   * Execute a Git operation
   */
  private async executeOperation(
    operation: GitOperation,
    prompt: string,
    context: ExecutionContext
  ): Promise<GitAgentOutput> {
    switch (operation) {
      case 'branch-create':
        return this.createBranch(prompt, context);
      case 'branch-delete':
        return this.deleteBranch(prompt, context);
      case 'branch-checkout':
        return this.checkoutBranch(prompt, context);
      case 'branch-merge':
        return this.mergeBranch(prompt, context);
      case 'worktree-add':
        return this.addWorktree(prompt, context);
      case 'worktree-remove':
        return this.removeWorktree(prompt, context);
      case 'worktree-prune':
        return this.pruneWorktrees(context);
      case 'status':
        return this.getStatus(context);
      default:
        return this.getStatus(context);
    }
  }

  /**
   * Create a branch
   */
  private async createBranch(
    prompt: string,
    context: ExecutionContext
  ): Promise<GitAgentOutput> {
    const { name, type } = this.extractBranchInfo(prompt);

    try {
      const branch = await this.branchManager.createBranch({
        name,
        type,
        baseBranch: context.projectConfig.name === 'main' ? 'main' : 'develop',
      });

      return {
        operation: 'branch-create',
        success: true,
        branches: [branch],
        message: `Created branch '${branch.fullName}'`,
        suggestions: [
          `Checkout branch with 'git checkout ${branch.fullName}'`,
          'Create a worktree for parallel development',
        ],
      };
    } catch (error) {
      return {
        operation: 'branch-create',
        success: false,
        message: error instanceof Error ? error.message : 'Failed to create branch',
      };
    }
  }

  /**
   * Delete a branch
   */
  private async deleteBranch(
    prompt: string,
    _context: ExecutionContext
  ): Promise<GitAgentOutput> {
    const { name } = this.extractBranchInfo(prompt);
    const force = prompt.toLowerCase().includes('force');

    try {
      await this.branchManager.deleteBranch({ name, force });

      return {
        operation: 'branch-delete',
        success: true,
        message: `Deleted branch '${name}'`,
      };
    } catch (error) {
      return {
        operation: 'branch-delete',
        success: false,
        message: error instanceof Error ? error.message : 'Failed to delete branch',
      };
    }
  }

  /**
   * Checkout a branch
   */
  private async checkoutBranch(
    prompt: string,
    _context: ExecutionContext
  ): Promise<GitAgentOutput> {
    const { name } = this.extractBranchInfo(prompt);
    const create = prompt.toLowerCase().includes('create') || prompt.includes('-b');

    try {
      const branch = await this.branchManager.checkoutBranch(name, create);

      return {
        operation: 'branch-checkout',
        success: true,
        branches: [branch],
        message: `Checked out branch '${branch.fullName}'`,
      };
    } catch (error) {
      return {
        operation: 'branch-checkout',
        success: false,
        message: error instanceof Error ? error.message : 'Failed to checkout branch',
      };
    }
  }

  /**
   * Merge branches
   */
  private async mergeBranch(
    prompt: string,
    _context: ExecutionContext
  ): Promise<GitAgentOutput> {
    const { source, target } = this.extractMergeInfo(prompt);

    try {
      const result = await this.branchManager.mergeBranch({
        sourceBranch: source,
        targetBranch: target,
      });

      if (result.conflicts && result.conflicts.length > 0) {
        return {
          operation: 'branch-merge',
          success: false,
          conflicts: result.conflicts,
          message: `Merge conflicts detected in ${result.conflicts.length} file(s)`,
          suggestions: [
            'Resolve conflicts manually',
            'Use conflict resolver agent',
            'Abort merge and retry',
          ],
        };
      }

      return {
        operation: 'branch-merge',
        success: result.success,
        message: result.merged
          ? `Merged '${source}' into '${target}'`
          : 'Merge failed',
      };
    } catch (error) {
      return {
        operation: 'branch-merge',
        success: false,
        message: error instanceof Error ? error.message : 'Failed to merge branches',
      };
    }
  }

  /**
   * Add a worktree
   */
  private async addWorktree(
    prompt: string,
    _context: ExecutionContext
  ): Promise<GitAgentOutput> {
    const { name } = this.extractBranchInfo(prompt);
    const path = this.worktreeManager.generateWorktreePath(name);

    try {
      const worktree = await this.worktreeManager.addWorktree({
        path,
        branch: name,
        createBranch: true,
      });

      return {
        operation: 'worktree-add',
        success: true,
        worktrees: [worktree],
        message: `Added worktree at '${path}' for branch '${name}'`,
        suggestions: [
          `cd ${path} to work in the worktree`,
          'Acquire file locks before editing shared files',
        ],
      };
    } catch (error) {
      return {
        operation: 'worktree-add',
        success: false,
        message: error instanceof Error ? error.message : 'Failed to add worktree',
      };
    }
  }

  /**
   * Remove a worktree
   */
  private async removeWorktree(
    prompt: string,
    _context: ExecutionContext
  ): Promise<GitAgentOutput> {
    const pathMatch = prompt.match(/(?:at|path|from)\s+['"]?([^\s'"]+)['"]?/i);
    const path = pathMatch ? pathMatch[1] : '';
    const force = prompt.toLowerCase().includes('force');

    try {
      await this.worktreeManager.removeWorktree({ path, force });

      return {
        operation: 'worktree-remove',
        success: true,
        message: `Removed worktree at '${path}'`,
      };
    } catch (error) {
      return {
        operation: 'worktree-remove',
        success: false,
        message: error instanceof Error ? error.message : 'Failed to remove worktree',
      };
    }
  }

  /**
   * Prune worktrees
   */
  private async pruneWorktrees(
    _context: ExecutionContext
  ): Promise<GitAgentOutput> {
    const pruned = await this.worktreeManager.pruneWorktrees();

    return {
      operation: 'worktree-prune',
      success: true,
      message: `Pruned ${pruned.length} worktree(s)`,
      suggestions: pruned.length > 0 ? pruned.map((p) => `Removed: ${p}`) : [],
    };
  }

  /**
   * Get current status
   */
  private async getStatus(
    _context: ExecutionContext
  ): Promise<GitAgentOutput> {
    const branches = this.branchManager.getAllBranches();
    const worktrees = this.worktreeManager.getAllWorktrees();
    const locks = this.fileLockManager.getAllLocks();

    return {
      operation: 'status',
      success: true,
      branches,
      worktrees,
      locks,
      message: `${branches.length} branches, ${worktrees.length} worktrees, ${locks.length} locks`,
    };
  }

  /**
   * Extract branch info from prompt
   */
  private extractBranchInfo(prompt: string): { name: string; type: BranchType } {
    // Try to extract branch name from various patterns
    const patterns = [
      /branch\s+['"]?([^\s'"]+)['"]?/i,
      /['"]([^'"]+)['"]/,
      /feature\/(\S+)/i,
      /bugfix\/(\S+)/i,
      /hotfix\/(\S+)/i,
    ];

    let name = 'new-branch';
    for (const pattern of patterns) {
      const match = prompt.match(pattern);
      if (match) {
        name = match[1];
        break;
      }
    }

    // Detect type from prompt or name
    let type: BranchType = 'feature';
    const lower = prompt.toLowerCase();

    if (lower.includes('bugfix') || lower.includes('bug fix') || name.startsWith('bugfix/')) {
      type = 'bugfix';
    } else if (lower.includes('hotfix') || lower.includes('hot fix') || name.startsWith('hotfix/')) {
      type = 'hotfix';
    } else if (lower.includes('release') || name.startsWith('release/')) {
      type = 'release';
    }

    return { name, type };
  }

  /**
   * Extract merge info from prompt
   */
  private extractMergeInfo(prompt: string): { source: string; target: string } {
    // Pattern: merge X into Y
    const intoMatch = prompt.match(/merge\s+['"]?(\S+)['"]?\s+into\s+['"]?(\S+)['"]?/i);
    if (intoMatch) {
      return { source: intoMatch[1], target: intoMatch[2] };
    }

    // Pattern: merge X
    const simpleMatch = prompt.match(/merge\s+['"]?(\S+)['"]?/i);
    if (simpleMatch) {
      return { source: simpleMatch[1], target: 'main' };
    }

    return { source: 'develop', target: 'main' };
  }

  /**
   * Acquire file lock
   */
  async acquireFileLock(
    path: string,
    holder: string,
    exclusive = false
  ): Promise<FileLock | null> {
    const result = await this.fileLockManager.acquireLock({
      path,
      type: exclusive ? 'exclusive' : 'shared',
      holder,
    });

    return result.success ? result.lock! : null;
  }

  /**
   * Release file lock
   */
  releaseFileLock(path: string, holder: string): boolean {
    return this.fileLockManager.releaseLock(path, holder);
  }

  /**
   * Determine next agent based on operation result
   */
  private determineNextAgent(
    output: GitAgentOutput,
    context: ExecutionContext
  ): AgentType {
    // If conflicts, may need conflict resolver
    if (output.conflicts && output.conflicts.length > 0) {
      return 'architect'; // Architect can help resolve
    }

    // If worktree created, frontend or backend developer can use it
    if (output.operation === 'worktree-add' && output.success) {
      if (context.previousOutputs.has('ui-designer')) {
        return 'frontend-developer';
      }
      return 'architect';
    }

    // Default to orchestrator for routing
    return 'orchestrator';
  }

  /**
   * Check if agent can handle task
   */
  canHandle(taskType: string, _context: ExecutionContext): boolean {
    return [
      'git-operation',
      'branch-management',
      'worktree-management',
      'file-locking',
      'merge-operation',
    ].includes(taskType);
  }

  /**
   * Get branch manager
   */
  getBranchManager(): BranchManager {
    return this.branchManager;
  }

  /**
   * Get worktree manager
   */
  getWorktreeManager(): WorktreeManager {
    return this.worktreeManager;
  }

  /**
   * Get file lock manager
   */
  getFileLockManager(): FileLockManager {
    return this.fileLockManager;
  }
}

/**
 * Factory function for Git agent
 */
export function createGitAgent(): GitAgent {
  return new GitAgent();
}
