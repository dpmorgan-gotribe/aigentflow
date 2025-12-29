# Step 10: Worktree Isolation

> **Checkpoint:** CP2 - Git Worktrees
> **Previous Step:** 09-GIT-AGENT.md
> **Next Step:** 11-CONFLICT-DETECTION.md

---

## Overview

This step implements the feature worktree isolation model where:

- Each **feature** gets its own worktree (not each agent type)
- **All code-modifying agents** work within the same feature worktree:
  - **Frontend + Backend agents** work in **parallel** during development
  - **Tester agent** creates e2e/integration tests in the same worktree
  - **Bug Fixer agent** applies fixes in the same worktree
- Multiple features can be developed **simultaneously** across different worktrees
- File locking prevents conflicting writes from parallel agents

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         FEATURE-BASED WORKTREE MODEL                         │
└─────────────────────────────────────────────────────────────────────────────┘

  Main Repository (main branch)
  │
  ├── feature/user-auth (worktree 1)
  │   │
  │   │  DEVELOPMENT PHASE (parallel):
  │   ├── Frontend Agent ──┬── Work in PARALLEL
  │   └── Backend Agent  ──┘
  │   │
  │   │  TESTING PHASE:
  │   ├── Tester Agent ────── Creates e2e tests, runs test suite
  │   │
  │   │  FIX LOOP (if tests fail):
  │   ├── Bug Fixer Agent ─── Applies fixes
  │   └── Tester Agent ────── Re-runs tests
  │   │
  │   │  REVIEW PHASE:
  │   └── Reviewer Agent ──── Code review (read-only)
  │
  ├── feature/dashboard (worktree 2)
  │   ├── Frontend Agent ──┬── PARALLEL
  │   ├── Backend Agent  ──┘
  │   ├── Tester Agent
  │   ├── Bug Fixer Agent
  │   └── Reviewer Agent
  │
  └── feature/notifications (worktree 3)
      └── ... (same pattern)
```

---

## Deliverables

1. `src/orchestration/feature-executor.ts` - Parallel agent execution per feature
2. `src/orchestration/file-lock.ts` - File locking for parallel agents
3. `src/orchestration/agent-coordinator.ts` - Coordinates FE+BE agents
4. `src/orchestration/types.ts` - Orchestration types
5. `src/orchestration/index.ts` - Public exports

---

## File Structure

```
src/orchestration/
├── feature-executor.ts   # Feature-level execution
├── file-lock.ts          # File locking mechanism
├── agent-coordinator.ts  # Agent coordination
├── types.ts              # Type definitions
└── index.ts              # Public exports
```

---

## 1. Orchestration Types (`src/orchestration/types.ts`)

```typescript
/**
 * Orchestration Types
 *
 * Types for feature execution, agent coordination, and file locking.
 */

import { AgentType, AgentOutput, TaskAnalysis } from '../agents/types';
import { WorktreeInfo } from '../git/types';

/**
 * Feature execution status
 */
export type FeatureStatus =
  | 'pending'
  | 'initializing'
  | 'designing'
  | 'developing'
  | 'testing'
  | 'reviewing'
  | 'merging'
  | 'completed'
  | 'failed'
  | 'paused';

/**
 * Agent execution state within a feature
 */
export interface AgentExecutionState {
  agentType: AgentType;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'blocked';
  startedAt?: Date;
  completedAt?: Date;
  output?: AgentOutput;
  error?: string;
  blockedBy?: string[];   // Files locked by other agents
  retryCount: number;
}

/**
 * Feature execution context
 */
export interface FeatureContext {
  featureId: string;
  featureName: string;
  description: string;
  worktree: WorktreeInfo;
  task: TaskAnalysis;
  status: FeatureStatus;
  createdAt: Date;
  updatedAt: Date;

  // Agent states
  agents: Map<AgentType, AgentExecutionState>;

  // Outputs collected from agents
  outputs: AgentOutput[];

  // Files modified in this feature
  modifiedFiles: Set<string>;

  // Dependencies on other features
  dependsOn: string[];
  blockedBy: string[];
}

/**
 * Parallel execution plan for agents within a feature
 */
export interface ParallelExecutionPlan {
  featureId: string;

  // Agents that can run in parallel
  parallelGroups: AgentType[][];

  // Agents that must run sequentially
  sequentialAgents: AgentType[];

  // Coordination requirements
  sharedFiles: Map<string, AgentType[]>; // File -> agents that need it
}

/**
 * File lock information
 */
export interface FileLock {
  path: string;
  featureId: string;
  agentType: AgentType;
  lockedAt: Date;
  expiresAt?: Date;
  exclusive: boolean;  // true = write lock, false = read lock
}

/**
 * Lock acquisition result
 */
export interface LockResult {
  success: boolean;
  lock?: FileLock;
  conflictsWith?: FileLock;
  waitTime?: number;  // Suggested wait time if locked
}

/**
 * Agent coordination message
 */
export interface CoordinationMessage {
  id: string;
  featureId: string;
  fromAgent: AgentType;
  toAgent?: AgentType;  // undefined = broadcast
  type: CoordinationMessageType;
  payload: unknown;
  timestamp: Date;
}

export type CoordinationMessageType =
  | 'file_locked'
  | 'file_released'
  | 'work_started'
  | 'work_completed'
  | 'needs_input'
  | 'provides_output'
  | 'error'
  | 'sync_request';

/**
 * Agent work item
 */
export interface AgentWorkItem {
  agentType: AgentType;
  featureId: string;
  worktreePath: string;
  task: TaskAnalysis;
  context: {
    previousOutputs: AgentOutput[];
    sharedFiles: string[];
    constraints: {
      maxRetries: number;
      timeoutMs: number;
    };
  };
}

/**
 * Execution result for a feature
 */
export interface FeatureExecutionResult {
  featureId: string;
  success: boolean;
  status: FeatureStatus;
  agents: {
    completed: AgentType[];
    failed: AgentType[];
    skipped: AgentType[];
  };
  outputs: AgentOutput[];
  duration: number;
  errors?: string[];
}
```

---

## 2. File Lock Manager (`src/orchestration/file-lock.ts`)

```typescript
/**
 * File Lock Manager
 *
 * Manages file locks to prevent conflicting writes when
 * multiple agents work in parallel on the same worktree.
 */

import { EventEmitter } from 'events';
import { AgentType } from '../agents/types';
import { FileLock, LockResult } from './types';
import { logger } from '../utils/logger';

/**
 * Lock expiration time (default 5 minutes)
 */
const DEFAULT_LOCK_TIMEOUT_MS = 5 * 60 * 1000;

/**
 * File Lock Manager class
 */
export class FileLockManager extends EventEmitter {
  private locks: Map<string, FileLock> = new Map();
  private lockQueues: Map<string, Array<{
    agentType: AgentType;
    featureId: string;
    exclusive: boolean;
    resolve: (result: LockResult) => void;
  }>> = new Map();
  private cleanupInterval: NodeJS.Timeout;

  constructor() {
    super();

    // Periodically clean up expired locks
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredLocks();
    }, 30000); // Every 30 seconds
  }

  /**
   * Acquire a lock on a file
   */
  async acquireLock(
    path: string,
    featureId: string,
    agentType: AgentType,
    options: {
      exclusive?: boolean;
      timeoutMs?: number;
      waitForLock?: boolean;
    } = {}
  ): Promise<LockResult> {
    const exclusive = options.exclusive ?? true;
    const timeoutMs = options.timeoutMs ?? DEFAULT_LOCK_TIMEOUT_MS;
    const normalizedPath = this.normalizePath(path);

    // Check existing lock
    const existingLock = this.locks.get(normalizedPath);

    if (existingLock) {
      // Same agent already has the lock
      if (existingLock.agentType === agentType && existingLock.featureId === featureId) {
        return { success: true, lock: existingLock };
      }

      // Check if locks are compatible (multiple read locks allowed)
      if (!exclusive && !existingLock.exclusive) {
        // Both are read locks - allow
        const lock = this.createLock(normalizedPath, featureId, agentType, exclusive, timeoutMs);
        return { success: true, lock };
      }

      // Incompatible lock exists
      if (options.waitForLock) {
        return this.queueLockRequest(normalizedPath, featureId, agentType, exclusive, timeoutMs);
      }

      return {
        success: false,
        conflictsWith: existingLock,
        waitTime: this.estimateWaitTime(existingLock),
      };
    }

    // No existing lock - acquire immediately
    const lock = this.createLock(normalizedPath, featureId, agentType, exclusive, timeoutMs);
    return { success: true, lock };
  }

  /**
   * Release a lock on a file
   */
  releaseLock(path: string, agentType: AgentType, featureId: string): boolean {
    const normalizedPath = this.normalizePath(path);
    const lock = this.locks.get(normalizedPath);

    if (!lock) {
      return true; // Already unlocked
    }

    if (lock.agentType !== agentType || lock.featureId !== featureId) {
      logger.warn('Attempted to release lock owned by another agent', {
        path: normalizedPath,
        requestedBy: agentType,
        ownedBy: lock.agentType,
      });
      return false;
    }

    this.locks.delete(normalizedPath);

    this.emit('lock_released', { path: normalizedPath, agentType, featureId });
    logger.debug('Released lock', { path: normalizedPath, agentType });

    // Process queue for this path
    this.processLockQueue(normalizedPath);

    return true;
  }

  /**
   * Release all locks for an agent
   */
  releaseAllLocks(agentType: AgentType, featureId: string): string[] {
    const released: string[] = [];

    for (const [path, lock] of this.locks) {
      if (lock.agentType === agentType && lock.featureId === featureId) {
        this.locks.delete(path);
        released.push(path);
        this.processLockQueue(path);
      }
    }

    if (released.length > 0) {
      logger.debug('Released all locks for agent', { agentType, count: released.length });
    }

    return released;
  }

  /**
   * Check if a file is locked
   */
  isLocked(path: string): boolean {
    return this.locks.has(this.normalizePath(path));
  }

  /**
   * Get lock info for a file
   */
  getLock(path: string): FileLock | undefined {
    return this.locks.get(this.normalizePath(path));
  }

  /**
   * Get all locks for a feature
   */
  getFeatureLocks(featureId: string): FileLock[] {
    return Array.from(this.locks.values())
      .filter(lock => lock.featureId === featureId);
  }

  /**
   * Get all locks held by an agent
   */
  getAgentLocks(agentType: AgentType, featureId: string): FileLock[] {
    return Array.from(this.locks.values())
      .filter(lock => lock.agentType === agentType && lock.featureId === featureId);
  }

  /**
   * Check if an agent can access a file
   */
  canAccess(path: string, agentType: AgentType, featureId: string, forWrite: boolean): boolean {
    const lock = this.getLock(path);

    if (!lock) {
      return true;
    }

    // Same agent always has access
    if (lock.agentType === agentType && lock.featureId === featureId) {
      return true;
    }

    // For read access, check if it's a non-exclusive lock
    if (!forWrite && !lock.exclusive) {
      return true;
    }

    return false;
  }

  /**
   * Acquire locks for multiple files atomically
   */
  async acquireMultipleLocks(
    paths: string[],
    featureId: string,
    agentType: AgentType,
    exclusive: boolean = true
  ): Promise<{ success: boolean; locks?: FileLock[]; failedPath?: string }> {
    const acquiredLocks: FileLock[] = [];

    for (const path of paths) {
      const result = await this.acquireLock(path, featureId, agentType, { exclusive });

      if (!result.success) {
        // Rollback previously acquired locks
        for (const lock of acquiredLocks) {
          this.releaseLock(lock.path, agentType, featureId);
        }
        return { success: false, failedPath: path };
      }

      acquiredLocks.push(result.lock!);
    }

    return { success: true, locks: acquiredLocks };
  }

  /**
   * Create a lock entry
   */
  private createLock(
    path: string,
    featureId: string,
    agentType: AgentType,
    exclusive: boolean,
    timeoutMs: number
  ): FileLock {
    const lock: FileLock = {
      path,
      featureId,
      agentType,
      lockedAt: new Date(),
      expiresAt: new Date(Date.now() + timeoutMs),
      exclusive,
    };

    this.locks.set(path, lock);

    this.emit('lock_acquired', lock);
    logger.debug('Acquired lock', { path, agentType, exclusive });

    return lock;
  }

  /**
   * Queue a lock request
   */
  private queueLockRequest(
    path: string,
    featureId: string,
    agentType: AgentType,
    exclusive: boolean,
    timeoutMs: number
  ): Promise<LockResult> {
    return new Promise((resolve) => {
      if (!this.lockQueues.has(path)) {
        this.lockQueues.set(path, []);
      }

      this.lockQueues.get(path)!.push({
        agentType,
        featureId,
        exclusive,
        resolve,
      });

      // Set timeout for queued request
      setTimeout(() => {
        const queue = this.lockQueues.get(path);
        if (queue) {
          const index = queue.findIndex(
            q => q.agentType === agentType && q.featureId === featureId
          );
          if (index !== -1) {
            queue.splice(index, 1);
            resolve({
              success: false,
              waitTime: 0,
            });
          }
        }
      }, timeoutMs);
    });
  }

  /**
   * Process queued lock requests
   */
  private processLockQueue(path: string): void {
    const queue = this.lockQueues.get(path);
    if (!queue || queue.length === 0) {
      return;
    }

    const next = queue.shift()!;
    const lock = this.createLock(
      path,
      next.featureId,
      next.agentType,
      next.exclusive,
      DEFAULT_LOCK_TIMEOUT_MS
    );
    next.resolve({ success: true, lock });
  }

  /**
   * Estimate wait time for a locked file
   */
  private estimateWaitTime(lock: FileLock): number {
    if (!lock.expiresAt) {
      return DEFAULT_LOCK_TIMEOUT_MS;
    }
    return Math.max(0, lock.expiresAt.getTime() - Date.now());
  }

  /**
   * Clean up expired locks
   */
  private cleanupExpiredLocks(): void {
    const now = Date.now();
    let cleaned = 0;

    for (const [path, lock] of this.locks) {
      if (lock.expiresAt && lock.expiresAt.getTime() < now) {
        this.locks.delete(path);
        this.processLockQueue(path);
        cleaned++;

        this.emit('lock_expired', lock);
      }
    }

    if (cleaned > 0) {
      logger.debug('Cleaned up expired locks', { count: cleaned });
    }
  }

  /**
   * Normalize file path for consistent lookup
   */
  private normalizePath(path: string): string {
    return path.replace(/\\/g, '/').toLowerCase();
  }

  /**
   * Destroy the lock manager
   */
  destroy(): void {
    clearInterval(this.cleanupInterval);
    this.locks.clear();
    this.lockQueues.clear();
  }
}

/**
 * Singleton instance
 */
let lockManager: FileLockManager | null = null;

export function getFileLockManager(): FileLockManager {
  if (!lockManager) {
    lockManager = new FileLockManager();
  }
  return lockManager;
}
```

---

## 3. Agent Coordinator (`src/orchestration/agent-coordinator.ts`)

```typescript
/**
 * Agent Coordinator
 *
 * Coordinates parallel execution of Frontend and Backend agents
 * within a single feature worktree.
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { AgentType, AgentOutput, TaskAnalysis } from '../agents/types';
import { getRegistry } from '../agents/registry';
import { ContextManager } from '../agents/context-manager';
import {
  AgentExecutionState,
  AgentWorkItem,
  CoordinationMessage,
  CoordinationMessageType,
  ParallelExecutionPlan,
} from './types';
import { FileLockManager, getFileLockManager } from './file-lock';
import { logger } from '../utils/logger';

/**
 * Agent Coordinator class
 */
export class AgentCoordinator extends EventEmitter {
  private featureId: string;
  private worktreePath: string;
  private lockManager: FileLockManager;
  private agentStates: Map<AgentType, AgentExecutionState> = new Map();
  private messages: CoordinationMessage[] = [];
  private outputs: Map<AgentType, AgentOutput> = new Map();

  constructor(featureId: string, worktreePath: string) {
    super();
    this.featureId = featureId;
    this.worktreePath = worktreePath;
    this.lockManager = getFileLockManager();
  }

  /**
   * Create execution plan for parallel agents
   */
  createExecutionPlan(task: TaskAnalysis): ParallelExecutionPlan {
    const plan: ParallelExecutionPlan = {
      featureId: this.featureId,
      parallelGroups: [],
      sequentialAgents: [],
      sharedFiles: new Map(),
    };

    // Determine which agents can run in parallel based on task
    if (task.requiresUI && task.requiresBackend) {
      // FE and BE can work in parallel on different file types
      plan.parallelGroups.push([AgentType.FRONTEND_DEV, AgentType.BACKEND_DEV]);

      // Define shared files that need coordination
      plan.sharedFiles.set('src/types/*.ts', [AgentType.FRONTEND_DEV, AgentType.BACKEND_DEV]);
      plan.sharedFiles.set('src/api/types.ts', [AgentType.FRONTEND_DEV, AgentType.BACKEND_DEV]);
    } else if (task.requiresUI) {
      plan.sequentialAgents.push(AgentType.FRONTEND_DEV);
    } else if (task.requiresBackend) {
      plan.sequentialAgents.push(AgentType.BACKEND_DEV);
    }

    // Tester and Reviewer always run after development
    plan.sequentialAgents.push(AgentType.TESTER, AgentType.REVIEWER);

    return plan;
  }

  /**
   * Execute agents in parallel according to plan
   */
  async executeParallel(
    agents: AgentType[],
    task: TaskAnalysis,
    previousOutputs: AgentOutput[] = []
  ): Promise<AgentOutput[]> {
    logger.info('Starting parallel execution', {
      featureId: this.featureId,
      agents,
    });

    // Initialize agent states
    for (const agentType of agents) {
      this.agentStates.set(agentType, {
        agentType,
        status: 'pending',
        retryCount: 0,
      });
    }

    // Create work items
    const workItems: AgentWorkItem[] = agents.map(agentType => ({
      agentType,
      featureId: this.featureId,
      worktreePath: this.worktreePath,
      task,
      context: {
        previousOutputs,
        sharedFiles: this.getSharedFilesForAgent(agentType),
        constraints: {
          maxRetries: 3,
          timeoutMs: 5 * 60 * 1000, // 5 minutes
        },
      },
    }));

    // Execute all agents in parallel
    const results = await Promise.allSettled(
      workItems.map(item => this.executeAgent(item))
    );

    // Collect outputs
    const outputs: AgentOutput[] = [];
    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      const agentType = agents[i];

      if (result.status === 'fulfilled' && result.value) {
        outputs.push(result.value);
        this.outputs.set(agentType, result.value);
      } else if (result.status === 'rejected') {
        logger.error('Agent failed', { agentType, error: result.reason });
        this.agentStates.get(agentType)!.status = 'failed';
        this.agentStates.get(agentType)!.error = String(result.reason);
      }
    }

    // Release all locks for this feature
    for (const agentType of agents) {
      this.lockManager.releaseAllLocks(agentType, this.featureId);
    }

    return outputs;
  }

  /**
   * Execute a single agent
   */
  private async executeAgent(workItem: AgentWorkItem): Promise<AgentOutput | null> {
    const { agentType, task, context } = workItem;
    const state = this.agentStates.get(agentType)!;

    try {
      state.status = 'running';
      state.startedAt = new Date();
      this.emit('agent_started', { agentType, featureId: this.featureId });

      // Broadcast work started
      this.broadcastMessage(agentType, 'work_started', { task });

      // Get agent from registry
      const registry = getRegistry();
      const agent = registry.getAgent(agentType);

      // Build context for agent
      const agentContext = await this.buildAgentContext(agentType, task, context.previousOutputs);

      // Execute agent
      const output = await agent.execute({
        executionId: uuidv4(),
        task,
        context: agentContext,
      });

      state.status = output.success ? 'completed' : 'failed';
      state.completedAt = new Date();
      state.output = output;

      // Broadcast completion
      this.broadcastMessage(agentType, 'work_completed', {
        success: output.success,
        artifacts: output.artifacts,
      });

      this.emit('agent_completed', { agentType, output });

      return output;
    } catch (error) {
      state.status = 'failed';
      state.error = String(error);
      state.completedAt = new Date();

      this.broadcastMessage(agentType, 'error', { error: String(error) });
      this.emit('agent_error', { agentType, error });

      return null;
    }
  }

  /**
   * Build context for an agent
   */
  private async buildAgentContext(
    agentType: AgentType,
    task: TaskAnalysis,
    previousOutputs: AgentOutput[]
  ): Promise<any> {
    // Get other agents' outputs that are relevant
    const relevantOutputs: AgentOutput[] = [...previousOutputs];

    // Add outputs from parallel agents that have completed
    for (const [type, output] of this.outputs) {
      if (type !== agentType && output) {
        relevantOutputs.push(output);
      }
    }

    return {
      projectId: this.featureId,
      executionId: uuidv4(),
      task,
      items: [],
      previousOutputs: relevantOutputs,
      constraints: {
        maxTokens: 4096,
        maxRetries: 3,
        timeoutMs: 60000,
        allowedTools: [],
        forbiddenPatterns: [],
      },
    };
  }

  /**
   * Acquire lock for a file (agent-specific wrapper)
   */
  async acquireFileLock(
    agentType: AgentType,
    path: string,
    exclusive: boolean = true
  ): Promise<boolean> {
    const result = await this.lockManager.acquireLock(
      path,
      this.featureId,
      agentType,
      { exclusive, waitForLock: true }
    );

    if (!result.success) {
      logger.debug('File lock blocked', {
        path,
        agentType,
        conflictsWith: result.conflictsWith?.agentType,
      });
    }

    return result.success;
  }

  /**
   * Release lock for a file
   */
  releaseFileLock(agentType: AgentType, path: string): void {
    this.lockManager.releaseLock(path, agentType, this.featureId);
  }

  /**
   * Get shared files that an agent might need
   */
  private getSharedFilesForAgent(agentType: AgentType): string[] {
    // Define common shared files based on agent type
    // All code-modifying agents work in the same feature worktree
    const sharedFiles: Record<AgentType, string[]> = {
      [AgentType.FRONTEND_DEV]: [
        'src/types/**/*.ts',
        'src/api/client.ts',
        'src/api/types.ts',
        'src/components/**/*.tsx',
        'src/pages/**/*.tsx',
      ],
      [AgentType.BACKEND_DEV]: [
        'src/types/**/*.ts',
        'src/api/types.ts',
        'src/api/**/*.ts',
        'src/db/schema.ts',
        'src/services/**/*.ts',
      ],
      [AgentType.TESTER]: [
        // Unit tests alongside source
        'src/**/*.test.ts',
        'src/**/*.test.tsx',
        // E2E and integration tests
        'tests/**/*.ts',
        'e2e/**/*.ts',
        'cypress/**/*.ts',
        'playwright/**/*.ts',
        // Test utilities
        'src/test-utils/**/*.ts',
      ],
      [AgentType.BUG_FIXER]: [
        // Bug fixer needs access to all source files to apply fixes
        'src/**/*.ts',
        'src/**/*.tsx',
        // Also needs access to tests to fix test-related bugs
        'tests/**/*.ts',
        'e2e/**/*.ts',
      ],
      // Read-only or non-code agents
      [AgentType.REVIEWER]: [
        // Reviewer reads but doesn't typically modify
        'src/**/*.ts',
        'src/**/*.tsx',
      ],
      [AgentType.ORCHESTRATOR]: [],
      [AgentType.ANALYZER]: [],
      [AgentType.PLANNER]: [],
      [AgentType.ARCHITECT]: [],
      [AgentType.UI_DESIGNER]: [],
      [AgentType.GIT_AGENT]: [],
      [AgentType.PATTERN_MINER]: [],
      [AgentType.AGENT_GENERATOR]: [],
      [AgentType.TOURNAMENT_MANAGER]: [],
    };

    return sharedFiles[agentType] || [];
  }

  /**
   * Broadcast a coordination message
   */
  private broadcastMessage(
    fromAgent: AgentType,
    type: CoordinationMessageType,
    payload: unknown
  ): void {
    const message: CoordinationMessage = {
      id: uuidv4(),
      featureId: this.featureId,
      fromAgent,
      type,
      payload,
      timestamp: new Date(),
    };

    this.messages.push(message);
    this.emit('message', message);
  }

  /**
   * Send message to specific agent
   */
  sendMessage(
    fromAgent: AgentType,
    toAgent: AgentType,
    type: CoordinationMessageType,
    payload: unknown
  ): void {
    const message: CoordinationMessage = {
      id: uuidv4(),
      featureId: this.featureId,
      fromAgent,
      toAgent,
      type,
      payload,
      timestamp: new Date(),
    };

    this.messages.push(message);
    this.emit('message', message);
  }

  /**
   * Get agent state
   */
  getAgentState(agentType: AgentType): AgentExecutionState | undefined {
    return this.agentStates.get(agentType);
  }

  /**
   * Get all agent states
   */
  getAllAgentStates(): Map<AgentType, AgentExecutionState> {
    return new Map(this.agentStates);
  }

  /**
   * Get output from specific agent
   */
  getAgentOutput(agentType: AgentType): AgentOutput | undefined {
    return this.outputs.get(agentType);
  }

  /**
   * Get all outputs
   */
  getAllOutputs(): AgentOutput[] {
    return Array.from(this.outputs.values());
  }

  /**
   * Get coordination messages
   */
  getMessages(): CoordinationMessage[] {
    return [...this.messages];
  }

  /**
   * Check if all specified agents have completed
   */
  allCompleted(agents: AgentType[]): boolean {
    for (const agentType of agents) {
      const state = this.agentStates.get(agentType);
      if (!state || (state.status !== 'completed' && state.status !== 'failed')) {
        return false;
      }
    }
    return true;
  }

  /**
   * Check if any agent has failed
   */
  anyFailed(): boolean {
    for (const state of this.agentStates.values()) {
      if (state.status === 'failed') {
        return true;
      }
    }
    return false;
  }

  /**
   * Wait for all agents to complete
   */
  async waitForCompletion(agents: AgentType[], timeoutMs: number = 600000): Promise<void> {
    return new Promise((resolve, reject) => {
      const checkInterval = setInterval(() => {
        if (this.allCompleted(agents)) {
          clearInterval(checkInterval);
          clearTimeout(timeout);
          resolve();
        }
      }, 1000);

      const timeout = setTimeout(() => {
        clearInterval(checkInterval);
        reject(new Error('Timeout waiting for agents to complete'));
      }, timeoutMs);
    });
  }
}
```

---

## 4. Feature Executor (`src/orchestration/feature-executor.ts`)

```typescript
/**
 * Feature Executor
 *
 * Orchestrates the complete execution of a feature across all agents.
 * Manages the feature lifecycle from design through review.
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { AgentType, AgentOutput, TaskAnalysis } from '../agents/types';
import { GitAgent } from '../git/git-agent';
import { WorktreeInfo } from '../git/types';
import {
  FeatureContext,
  FeatureStatus,
  FeatureExecutionResult,
  ParallelExecutionPlan,
} from './types';
import { AgentCoordinator } from './agent-coordinator';
import { logger } from '../utils/logger';

/**
 * Feature executor options
 */
export interface FeatureExecutorOptions {
  gitAgent: GitAgent;
  autoCommit: boolean;
  autoMerge: boolean;
  requireApproval: boolean;
}

/**
 * Feature Executor class
 */
export class FeatureExecutor extends EventEmitter {
  private gitAgent: GitAgent;
  private options: FeatureExecutorOptions;
  private features: Map<string, FeatureContext> = new Map();
  private coordinators: Map<string, AgentCoordinator> = new Map();

  constructor(options: FeatureExecutorOptions) {
    super();
    this.gitAgent = options.gitAgent;
    this.options = options;
  }

  /**
   * Execute a feature from start to finish
   */
  async executeFeature(
    featureName: string,
    task: TaskAnalysis,
    description: string
  ): Promise<FeatureExecutionResult> {
    const featureId = uuidv4();
    const startTime = Date.now();

    logger.info('Starting feature execution', { featureId, featureName });

    try {
      // 1. Initialize feature
      const context = await this.initializeFeature(featureId, featureName, task, description);
      this.emit('feature_started', { featureId, featureName });

      // 2. Create execution plan
      const plan = this.createExecutionPlan(context, task);
      logger.debug('Execution plan created', { featureId, plan });

      // 3. Execute design phase (if needed)
      if (task.requiresUI || task.requiresArchitecture) {
        await this.executeDesignPhase(context, task);
      }

      // 4. Execute development phase (parallel FE+BE)
      const devOutputs = await this.executeDevelopmentPhase(context, task, plan);

      // 5. Execute test phase
      const testOutputs = await this.executeTestPhase(context, devOutputs);

      // 6. Execute review phase
      const reviewOutput = await this.executeReviewPhase(context, [...devOutputs, ...testOutputs]);

      // 7. Finalize feature
      const result = await this.finalizeFeature(context);

      const duration = Date.now() - startTime;
      logger.info('Feature execution completed', { featureId, duration });

      return {
        featureId,
        success: true,
        status: context.status,
        agents: {
          completed: this.getCompletedAgents(context),
          failed: this.getFailedAgents(context),
          skipped: [],
        },
        outputs: context.outputs,
        duration,
      };
    } catch (error) {
      logger.error('Feature execution failed', { featureId, error });

      const context = this.features.get(featureId);
      if (context) {
        context.status = 'failed';
      }

      return {
        featureId,
        success: false,
        status: 'failed',
        agents: {
          completed: context ? this.getCompletedAgents(context) : [],
          failed: context ? this.getFailedAgents(context) : [],
          skipped: [],
        },
        outputs: context?.outputs || [],
        duration: Date.now() - startTime,
        errors: [String(error)],
      };
    }
  }

  /**
   * Initialize feature with worktree
   */
  private async initializeFeature(
    featureId: string,
    featureName: string,
    task: TaskAnalysis,
    description: string
  ): Promise<FeatureContext> {
    // Create feature worktree
    const result = await this.gitAgent.createFeatureWorktree(featureId, featureName);

    if (!result.success || !result.data) {
      throw new Error(`Failed to create feature worktree: ${result.error}`);
    }

    const context: FeatureContext = {
      featureId,
      featureName,
      description,
      worktree: result.data.worktree,
      task,
      status: 'initializing',
      createdAt: new Date(),
      updatedAt: new Date(),
      agents: new Map(),
      outputs: [],
      modifiedFiles: new Set(),
      dependsOn: [],
      blockedBy: [],
    };

    this.features.set(featureId, context);

    // Create coordinator for this feature
    const coordinator = new AgentCoordinator(featureId, context.worktree.path);
    this.coordinators.set(featureId, coordinator);

    // Forward coordinator events
    coordinator.on('agent_started', (data) => this.emit('agent_started', data));
    coordinator.on('agent_completed', (data) => this.emit('agent_completed', data));
    coordinator.on('agent_error', (data) => this.emit('agent_error', data));

    return context;
  }

  /**
   * Create execution plan for a feature
   */
  private createExecutionPlan(context: FeatureContext, task: TaskAnalysis): ParallelExecutionPlan {
    const coordinator = this.coordinators.get(context.featureId)!;
    return coordinator.createExecutionPlan(task);
  }

  /**
   * Execute design phase
   */
  private async executeDesignPhase(
    context: FeatureContext,
    task: TaskAnalysis
  ): Promise<AgentOutput[]> {
    context.status = 'designing';
    context.updatedAt = new Date();

    const coordinator = this.coordinators.get(context.featureId)!;
    const designAgents: AgentType[] = [];

    if (task.requiresArchitecture) {
      designAgents.push(AgentType.ARCHITECT);
    }
    if (task.requiresUI) {
      designAgents.push(AgentType.UI_DESIGNER);
    }

    if (designAgents.length === 0) {
      return [];
    }

    // Design agents run sequentially
    const outputs: AgentOutput[] = [];
    for (const agentType of designAgents) {
      const [output] = await coordinator.executeParallel([agentType], task, outputs);
      if (output) {
        outputs.push(output);
        context.outputs.push(output);
      }
    }

    return outputs;
  }

  /**
   * Execute development phase (parallel FE+BE)
   */
  private async executeDevelopmentPhase(
    context: FeatureContext,
    task: TaskAnalysis,
    plan: ParallelExecutionPlan
  ): Promise<AgentOutput[]> {
    context.status = 'developing';
    context.updatedAt = new Date();

    const coordinator = this.coordinators.get(context.featureId)!;
    const previousOutputs = context.outputs;
    const allOutputs: AgentOutput[] = [];

    // Execute parallel groups
    for (const group of plan.parallelGroups) {
      logger.info('Executing parallel agent group', {
        featureId: context.featureId,
        agents: group,
      });

      const outputs = await coordinator.executeParallel(
        group,
        task,
        [...previousOutputs, ...allOutputs]
      );

      allOutputs.push(...outputs);
      context.outputs.push(...outputs);

      // Commit after parallel group completes
      if (this.options.autoCommit && outputs.some(o => o.success)) {
        await this.commitChanges(context, `feat: ${context.featureName} - development`);
      }
    }

    // Execute sequential agents
    for (const agentType of plan.sequentialAgents) {
      // Skip tester and reviewer here (handled in later phases)
      if (agentType === AgentType.TESTER || agentType === AgentType.REVIEWER) {
        continue;
      }

      const [output] = await coordinator.executeParallel(
        [agentType],
        task,
        [...previousOutputs, ...allOutputs]
      );

      if (output) {
        allOutputs.push(output);
        context.outputs.push(output);
      }
    }

    return allOutputs;
  }

  /**
   * Execute test phase
   */
  private async executeTestPhase(
    context: FeatureContext,
    devOutputs: AgentOutput[]
  ): Promise<AgentOutput[]> {
    context.status = 'testing';
    context.updatedAt = new Date();

    const coordinator = this.coordinators.get(context.featureId)!;
    const previousOutputs = context.outputs;

    const outputs = await coordinator.executeParallel(
      [AgentType.TESTER],
      context.task,
      previousOutputs
    );

    context.outputs.push(...outputs);

    // Check for test failures
    const testOutput = outputs.find(o => o.agentId === AgentType.TESTER);
    if (testOutput && testOutput.routingHints.hasFailures) {
      // Bug fix loop
      await this.executeBugFixLoop(context, testOutput);
    }

    return outputs;
  }

  /**
   * Execute bug fix loop
   */
  private async executeBugFixLoop(
    context: FeatureContext,
    testOutput: AgentOutput,
    maxAttempts: number = 3
  ): Promise<void> {
    const coordinator = this.coordinators.get(context.featureId)!;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      logger.info('Starting bug fix attempt', {
        featureId: context.featureId,
        attempt: attempt + 1,
      });

      // Run bug fixer
      const [fixOutput] = await coordinator.executeParallel(
        [AgentType.BUG_FIXER],
        context.task,
        [...context.outputs, testOutput]
      );

      if (fixOutput) {
        context.outputs.push(fixOutput);
      }

      // Re-run tests
      const [retestOutput] = await coordinator.executeParallel(
        [AgentType.TESTER],
        context.task,
        context.outputs
      );

      if (retestOutput) {
        context.outputs.push(retestOutput);

        if (!retestOutput.routingHints.hasFailures) {
          logger.info('Bug fix successful', { featureId: context.featureId, attempt: attempt + 1 });
          return;
        }
      }
    }

    logger.warn('Bug fix loop exhausted', { featureId: context.featureId, maxAttempts });
  }

  /**
   * Execute review phase
   */
  private async executeReviewPhase(
    context: FeatureContext,
    previousOutputs: AgentOutput[]
  ): Promise<AgentOutput | null> {
    context.status = 'reviewing';
    context.updatedAt = new Date();

    const coordinator = this.coordinators.get(context.featureId)!;

    const [reviewOutput] = await coordinator.executeParallel(
      [AgentType.REVIEWER],
      context.task,
      previousOutputs
    );

    if (reviewOutput) {
      context.outputs.push(reviewOutput);
    }

    return reviewOutput;
  }

  /**
   * Finalize feature
   */
  private async finalizeFeature(context: FeatureContext): Promise<FeatureExecutionResult> {
    // Commit any remaining changes
    if (this.options.autoCommit) {
      await this.commitChanges(context, `feat: ${context.featureName} - complete`);
    }

    context.status = 'completed';
    context.updatedAt = new Date();

    this.emit('feature_completed', {
      featureId: context.featureId,
      featureName: context.featureName,
    });

    return {
      featureId: context.featureId,
      success: true,
      status: context.status,
      agents: {
        completed: this.getCompletedAgents(context),
        failed: this.getFailedAgents(context),
        skipped: [],
      },
      outputs: context.outputs,
      duration: Date.now() - context.createdAt.getTime(),
    };
  }

  /**
   * Commit changes in feature worktree
   */
  private async commitChanges(context: FeatureContext, message: string): Promise<void> {
    const hasChanges = await this.gitAgent.worktrees.hasChanges(context.featureId);

    if (hasChanges) {
      await this.gitAgent.commit(context.featureId, { message });
    }
  }

  /**
   * Get completed agents for a feature
   */
  private getCompletedAgents(context: FeatureContext): AgentType[] {
    const completed: AgentType[] = [];
    for (const [agentType, state] of context.agents) {
      if (state.status === 'completed') {
        completed.push(agentType);
      }
    }
    return completed;
  }

  /**
   * Get failed agents for a feature
   */
  private getFailedAgents(context: FeatureContext): AgentType[] {
    const failed: AgentType[] = [];
    for (const [agentType, state] of context.agents) {
      if (state.status === 'failed') {
        failed.push(agentType);
      }
    }
    return failed;
  }

  /**
   * Get feature context
   */
  getFeature(featureId: string): FeatureContext | undefined {
    return this.features.get(featureId);
  }

  /**
   * Get all active features
   */
  getActiveFeatures(): FeatureContext[] {
    return Array.from(this.features.values())
      .filter(f => f.status !== 'completed' && f.status !== 'failed');
  }

  /**
   * Cancel a feature execution
   */
  async cancelFeature(featureId: string): Promise<void> {
    const context = this.features.get(featureId);
    if (!context) {
      throw new Error(`Feature not found: ${featureId}`);
    }

    context.status = 'failed';
    context.updatedAt = new Date();

    // Cleanup worktree
    await this.gitAgent.cleanupFeature(featureId, { force: true });

    this.emit('feature_cancelled', { featureId });
  }
}
```

---

## 5. Multi-Feature Parallel Executor (`src/orchestration/multi-feature-executor.ts`)

This component orchestrates parallel execution across multiple features, maximizing utilization of the 15-agent pool.

```typescript
/**
 * Multi-Feature Parallel Executor
 *
 * Orchestrates parallel execution of multiple features simultaneously.
 * Maximizes agent pool utilization (up to 15 concurrent agents).
 *
 * Key behaviors:
 * • Epic with 5 features → 5 planners in parallel
 * • Development phase → FE+BE per feature, multiple features in parallel
 * • Maximizes pool utilization at all times
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { AgentType, TaskAnalysis } from '../agents/types';
import { FeatureExecutor, FeatureExecutorOptions } from './feature-executor';
import {
  FeatureContext,
  FeatureExecutionResult,
} from './types';
import {
  AgentPoolManager,
  EpicContext,
  FeatureContext as PoolFeatureContext,
  AgentPhase,
  MAX_CONCURRENT_AGENTS,
} from '../core/states';
import { logger } from '../utils/logger';

/**
 * Epic definition - a collection of related features
 */
export interface EpicDefinition {
  epicId: string;
  name: string;
  description: string;
  features: FeatureDefinition[];
}

/**
 * Feature definition within an epic
 */
export interface FeatureDefinition {
  featureId: string;
  name: string;
  description: string;
  task: TaskAnalysis;
  priority: 'high' | 'normal' | 'low';
  dependencies: string[];  // featureIds this depends on
}

/**
 * Multi-feature execution options
 */
export interface MultiFeatureExecutorOptions extends FeatureExecutorOptions {
  maxConcurrentFeatures?: number;     // Limit parallel features (default: pool capacity / 2)
  maxAgentsPerFeature?: number;       // Limit agents per feature (default: 4)
  poolManager?: AgentPoolManager;     // Optional external pool manager
}

/**
 * Multi-Feature Parallel Executor
 */
export class MultiFeatureExecutor extends EventEmitter {
  private featureExecutor: FeatureExecutor;
  private poolManager: AgentPoolManager;
  private options: MultiFeatureExecutorOptions;
  private activeFeatures: Map<string, FeatureContext> = new Map();
  private completedFeatures: Map<string, FeatureExecutionResult> = new Map();
  private pendingFeatures: FeatureDefinition[] = [];

  constructor(options: MultiFeatureExecutorOptions) {
    super();
    this.options = {
      maxConcurrentFeatures: Math.floor(MAX_CONCURRENT_AGENTS / 2),
      maxAgentsPerFeature: 4,
      ...options,
    };

    this.featureExecutor = new FeatureExecutor(options);
    this.poolManager = options.poolManager || new AgentPoolManager({
      maxConcurrent: MAX_CONCURRENT_AGENTS,
      maxAgentsPerFeature: this.options.maxAgentsPerFeature!,
    });

    this.setupEventForwarding();
  }

  /**
   * Execute an entire epic (multiple features in parallel)
   */
  async executeEpic(epic: EpicDefinition): Promise<Map<string, FeatureExecutionResult>> {
    logger.info('Starting epic execution', {
      epicId: epic.epicId,
      featureCount: epic.features.length,
    });

    const startTime = Date.now();
    this.emit('epic_started', { epic });

    // Build epic context for pool manager
    const epicContext: EpicContext = {
      epicId: epic.epicId,
      features: epic.features.map(f => ({
        featureId: f.featureId,
        name: f.name,
        status: 'pending' as const,
        assignedAgents: [],
      })),
      parallelFeatures: this.options.maxConcurrentFeatures!,
    };

    // Sort features by priority and dependencies
    const sortedFeatures = this.sortFeaturesByPriority(epic.features);
    this.pendingFeatures = [...sortedFeatures];

    // Execute planning phase in parallel (up to pool capacity)
    await this.executePlanningPhase(epicContext, sortedFeatures);

    // Execute features in parallel waves
    while (this.pendingFeatures.length > 0 || this.activeFeatures.size > 0) {
      // Start as many features as pool capacity allows
      await this.startPendingFeatures();

      // Wait for at least one feature to complete
      if (this.activeFeatures.size > 0) {
        await this.waitForAnyFeatureCompletion();
      }
    }

    const results = new Map(this.completedFeatures);
    const duration = Date.now() - startTime;

    logger.info('Epic execution completed', {
      epicId: epic.epicId,
      duration,
      completed: results.size,
      successful: Array.from(results.values()).filter(r => r.success).length,
    });

    this.emit('epic_completed', {
      epic,
      results,
      duration,
    });

    return results;
  }

  /**
   * Execute planning phase for all features in parallel
   * Example: 5 features → 5 planners running simultaneously
   */
  private async executePlanningPhase(
    epicContext: EpicContext,
    features: FeatureDefinition[]
  ): Promise<void> {
    logger.info('Starting parallel planning phase', {
      epicId: epicContext.epicId,
      featureCount: features.length,
    });

    // Spawn planners for all features in parallel
    const spawnResults = await this.poolManager.spawnEpicPlanners(epicContext);

    const spawnedCount = spawnResults.filter(r => r.spawned).length;
    logger.info('Spawned planners', { count: spawnedCount, total: features.length });

    // Wait for all planning to complete
    await this.poolManager.waitForPhase(AgentPhase.PLANNING);

    // Update feature statuses
    for (const feature of epicContext.features) {
      feature.status = 'designing';
    }

    this.emit('planning_complete', {
      epicId: epicContext.epicId,
      featuresPlanned: features.length,
    });
  }

  /**
   * Start pending features based on pool capacity
   */
  private async startPendingFeatures(): Promise<void> {
    const poolStatus = this.poolManager.getStatus();
    const availableCapacity = poolStatus.utilization.available;

    if (availableCapacity === 0 || this.pendingFeatures.length === 0) {
      return;
    }

    // Calculate how many features we can start
    const agentsPerFeature = this.options.maxAgentsPerFeature!;
    const featuresToStart = Math.min(
      Math.floor(availableCapacity / agentsPerFeature),
      this.pendingFeatures.length,
      this.options.maxConcurrentFeatures! - this.activeFeatures.size
    );

    for (let i = 0; i < featuresToStart; i++) {
      const feature = this.getNextReadyFeature();
      if (!feature) break;

      this.startFeature(feature);
    }
  }

  /**
   * Get next feature that's ready to start (dependencies met)
   */
  private getNextReadyFeature(): FeatureDefinition | null {
    for (let i = 0; i < this.pendingFeatures.length; i++) {
      const feature = this.pendingFeatures[i];

      // Check if dependencies are complete
      const dependenciesMet = feature.dependencies.every(
        depId => this.completedFeatures.has(depId)
      );

      if (dependenciesMet) {
        this.pendingFeatures.splice(i, 1);
        return feature;
      }
    }

    return null;
  }

  /**
   * Start a feature execution
   */
  private async startFeature(feature: FeatureDefinition): Promise<void> {
    logger.info('Starting feature', { featureId: feature.featureId, name: feature.name });

    // Track as active
    this.emit('feature_starting', { feature });

    // Execute in background
    this.featureExecutor
      .executeFeature(feature.name, feature.task, feature.description)
      .then(result => {
        this.onFeatureComplete(feature.featureId, result);
      })
      .catch(error => {
        logger.error('Feature failed', { featureId: feature.featureId, error });
        this.onFeatureComplete(feature.featureId, {
          featureId: feature.featureId,
          success: false,
          status: 'failed',
          agents: { completed: [], failed: [], skipped: [] },
          outputs: [],
          duration: 0,
          errors: [String(error)],
        });
      });
  }

  /**
   * Handle feature completion
   */
  private onFeatureComplete(featureId: string, result: FeatureExecutionResult): void {
    this.activeFeatures.delete(featureId);
    this.completedFeatures.set(featureId, result);

    this.emit('feature_completed', { featureId, result });

    // Try to start more features
    this.startPendingFeatures();
  }

  /**
   * Wait for any active feature to complete
   */
  private waitForAnyFeatureCompletion(): Promise<void> {
    return new Promise(resolve => {
      const handler = () => {
        this.off('feature_completed', handler);
        resolve();
      };
      this.once('feature_completed', handler);
    });
  }

  /**
   * Sort features by priority and dependency order
   */
  private sortFeaturesByPriority(features: FeatureDefinition[]): FeatureDefinition[] {
    const priorityOrder = { high: 0, normal: 1, low: 2 };

    // Topological sort with priority as secondary sort
    const sorted: FeatureDefinition[] = [];
    const visited = new Set<string>();
    const visiting = new Set<string>();

    const featureMap = new Map(features.map(f => [f.featureId, f]));

    const visit = (feature: FeatureDefinition): void => {
      if (visited.has(feature.featureId)) return;
      if (visiting.has(feature.featureId)) {
        throw new Error(`Circular dependency detected: ${feature.featureId}`);
      }

      visiting.add(feature.featureId);

      // Visit dependencies first
      for (const depId of feature.dependencies) {
        const dep = featureMap.get(depId);
        if (dep) visit(dep);
      }

      visiting.delete(feature.featureId);
      visited.add(feature.featureId);
      sorted.push(feature);
    };

    // Sort by priority first, then topologically
    const byPriority = [...features].sort(
      (a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]
    );

    for (const feature of byPriority) {
      visit(feature);
    }

    return sorted;
  }

  /**
   * Get pool status
   */
  getPoolStatus(): {
    utilization: { active: number; available: number; max: number };
    activeFeatures: number;
    pendingFeatures: number;
    completedFeatures: number;
  } {
    return {
      utilization: this.poolManager.getUtilization(),
      activeFeatures: this.activeFeatures.size,
      pendingFeatures: this.pendingFeatures.length,
      completedFeatures: this.completedFeatures.size,
    };
  }

  /**
   * Setup event forwarding from feature executor
   */
  private setupEventForwarding(): void {
    this.featureExecutor.on('feature_started', (data) => this.emit('feature_started', data));
    this.featureExecutor.on('agent_started', (data) => this.emit('agent_started', data));
    this.featureExecutor.on('agent_completed', (data) => this.emit('agent_completed', data));
    this.featureExecutor.on('agent_error', (data) => this.emit('agent_error', data));
  }

  /**
   * Cancel all active features
   */
  async cancelAll(): Promise<void> {
    for (const featureId of this.activeFeatures.keys()) {
      await this.featureExecutor.cancelFeature(featureId);
    }
    this.pendingFeatures = [];
    this.emit('cancelled');
  }
}
```

---

## 6. Usage Examples

### Example 1: Execute Epic with 5 Features in Parallel

```typescript
import { MultiFeatureExecutor } from './orchestration/multi-feature-executor';
import { GitAgent } from './git/git-agent';

// Initialize
const gitAgent = new GitAgent('/path/to/repo');
const executor = new MultiFeatureExecutor({
  gitAgent,
  autoCommit: true,
  autoMerge: false,
  requireApproval: true,
  maxConcurrentFeatures: 5,  // Allow 5 features in parallel
  maxAgentsPerFeature: 3,    // FE + BE + Tester per feature = 15 agents max
});

// Define epic with 5 features
const epic: EpicDefinition = {
  epicId: 'epic-001',
  name: 'User Management System',
  description: 'Complete user management with auth, profiles, and settings',
  features: [
    {
      featureId: 'feat-001',
      name: 'User Authentication',
      description: 'Login, register, password reset',
      task: { taskType: 'feature', complexity: 'complex', requiresUI: true, requiresBackend: true, requiresArchitecture: true, requiresApproval: true, suggestedAgents: [] },
      priority: 'high',
      dependencies: [],
    },
    {
      featureId: 'feat-002',
      name: 'User Profiles',
      description: 'User profile page and settings',
      task: { taskType: 'feature', complexity: 'moderate', requiresUI: true, requiresBackend: true, requiresArchitecture: false, requiresApproval: true, suggestedAgents: [] },
      priority: 'normal',
      dependencies: ['feat-001'],  // Depends on auth
    },
    {
      featureId: 'feat-003',
      name: 'Admin Dashboard',
      description: 'Admin user management',
      task: { taskType: 'feature', complexity: 'moderate', requiresUI: true, requiresBackend: true, requiresArchitecture: false, requiresApproval: true, suggestedAgents: [] },
      priority: 'normal',
      dependencies: ['feat-001'],  // Depends on auth
    },
    {
      featureId: 'feat-004',
      name: 'User Settings',
      description: 'Account settings and preferences',
      task: { taskType: 'feature', complexity: 'simple', requiresUI: true, requiresBackend: true, requiresArchitecture: false, requiresApproval: false, suggestedAgents: [] },
      priority: 'low',
      dependencies: ['feat-002'],  // Depends on profiles
    },
    {
      featureId: 'feat-005',
      name: 'Notifications',
      description: 'User notifications system',
      task: { taskType: 'feature', complexity: 'moderate', requiresUI: true, requiresBackend: true, requiresArchitecture: false, requiresApproval: true, suggestedAgents: [] },
      priority: 'normal',
      dependencies: [],
    },
  ],
};

// Track progress
executor.on('feature_started', ({ featureId }) => {
  console.log(`Feature started: ${featureId}`);
});

executor.on('feature_completed', ({ featureId, result }) => {
  console.log(`Feature completed: ${featureId} - ${result.success ? 'SUCCESS' : 'FAILED'}`);
});

// Execute epic
const results = await executor.executeEpic(epic);

// Execution flow:
// 1. Planning phase: 5 planners run in parallel (uses 5 agents)
// 2. Wave 1: feat-001 (auth) and feat-005 (notifications) start in parallel
//    - Each has FE + BE agents = 4 agents total
// 3. When feat-001 completes: feat-002 (profiles) and feat-003 (admin) start
// 4. When feat-002 completes: feat-004 (settings) starts
// 5. All features run through test and review phases

console.log('Epic completed!');
for (const [featureId, result] of results) {
  console.log(`  ${featureId}: ${result.success ? 'SUCCESS' : 'FAILED'} (${result.duration}ms)`);
}
```

### Example 2: Pool Utilization Monitoring

```typescript
// Monitor pool utilization
setInterval(() => {
  const status = executor.getPoolStatus();
  console.log(`
Pool: ${status.utilization.active}/${status.utilization.max} agents active
Features: ${status.activeFeatures} active, ${status.pendingFeatures} pending, ${status.completedFeatures} completed
  `);
}, 5000);
```

---

## 7. Public Exports (`src/orchestration/index.ts`)

```typescript
/**
 * Orchestration Module Public Exports
 */

// Types
export * from './types';

// File Locking
export { FileLockManager, getFileLockManager } from './file-lock';

// Agent Coordination
export { AgentCoordinator } from './agent-coordinator';

// Feature Execution
export { FeatureExecutor, FeatureExecutorOptions } from './feature-executor';

// Multi-Feature Parallel Execution
export {
  MultiFeatureExecutor,
  MultiFeatureExecutorOptions,
  EpicDefinition,
  FeatureDefinition,
} from './multi-feature-executor';
```

---

## Test Scenarios

### Test 1: File Lock Manager

```typescript
// tests/orchestration/file-lock.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { FileLockManager } from '../../src/orchestration/file-lock';
import { AgentType } from '../../src/agents/types';

describe('FileLockManager', () => {
  let manager: FileLockManager;

  beforeEach(() => {
    manager = new FileLockManager();
  });

  afterEach(() => {
    manager.destroy();
  });

  it('should acquire a lock', async () => {
    const result = await manager.acquireLock(
      'src/components/Button.tsx',
      'feat-001',
      AgentType.FRONTEND_DEV
    );

    expect(result.success).toBe(true);
    expect(result.lock?.path).toBe('src/components/button.tsx');
    expect(result.lock?.agentType).toBe(AgentType.FRONTEND_DEV);
  });

  it('should block conflicting exclusive locks', async () => {
    // First lock
    await manager.acquireLock('src/file.ts', 'feat-001', AgentType.FRONTEND_DEV);

    // Second conflicting lock
    const result = await manager.acquireLock('src/file.ts', 'feat-001', AgentType.BACKEND_DEV);

    expect(result.success).toBe(false);
    expect(result.conflictsWith?.agentType).toBe(AgentType.FRONTEND_DEV);
  });

  it('should allow multiple read locks', async () => {
    await manager.acquireLock('src/file.ts', 'feat-001', AgentType.FRONTEND_DEV, {
      exclusive: false,
    });

    const result = await manager.acquireLock('src/file.ts', 'feat-001', AgentType.BACKEND_DEV, {
      exclusive: false,
    });

    expect(result.success).toBe(true);
  });

  it('should release locks', async () => {
    await manager.acquireLock('src/file.ts', 'feat-001', AgentType.FRONTEND_DEV);

    expect(manager.isLocked('src/file.ts')).toBe(true);

    manager.releaseLock('src/file.ts', AgentType.FRONTEND_DEV, 'feat-001');

    expect(manager.isLocked('src/file.ts')).toBe(false);
  });

  it('should release all locks for an agent', async () => {
    await manager.acquireLock('src/file1.ts', 'feat-001', AgentType.FRONTEND_DEV);
    await manager.acquireLock('src/file2.ts', 'feat-001', AgentType.FRONTEND_DEV);
    await manager.acquireLock('src/file3.ts', 'feat-001', AgentType.FRONTEND_DEV);

    const released = manager.releaseAllLocks(AgentType.FRONTEND_DEV, 'feat-001');

    expect(released.length).toBe(3);
    expect(manager.getFeatureLocks('feat-001').length).toBe(0);
  });

  it('should acquire multiple locks atomically', async () => {
    const result = await manager.acquireMultipleLocks(
      ['src/a.ts', 'src/b.ts', 'src/c.ts'],
      'feat-001',
      AgentType.FRONTEND_DEV
    );

    expect(result.success).toBe(true);
    expect(result.locks?.length).toBe(3);
  });

  it('should rollback on failed multi-lock', async () => {
    // Lock one file first
    await manager.acquireLock('src/b.ts', 'feat-001', AgentType.BACKEND_DEV);

    // Try to acquire multiple including blocked file
    const result = await manager.acquireMultipleLocks(
      ['src/a.ts', 'src/b.ts', 'src/c.ts'],
      'feat-001',
      AgentType.FRONTEND_DEV
    );

    expect(result.success).toBe(false);
    expect(result.failedPath).toBe('src/b.ts');

    // a.ts should have been rolled back
    expect(manager.isLocked('src/a.ts')).toBe(false);
  });
});
```

### Test 2: Agent Coordinator

```typescript
// tests/orchestration/agent-coordinator.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AgentCoordinator } from '../../src/orchestration/agent-coordinator';
import { AgentType, TaskAnalysis } from '../../src/agents/types';

// Mock the registry
vi.mock('../../src/agents/registry', () => ({
  getRegistry: () => ({
    getAgent: vi.fn().mockReturnValue({
      execute: vi.fn().mockResolvedValue({
        agentId: AgentType.FRONTEND_DEV,
        success: true,
        result: {},
        artifacts: [],
        routingHints: { suggestNext: [], skipAgents: [], needsApproval: false, hasFailures: false, isComplete: true },
        metrics: { startTime: new Date(), endTime: new Date(), durationMs: 100, tokensUsed: 100, llmCalls: 1, retryCount: 0, cacheHits: 0 },
      }),
    }),
  }),
}));

describe('AgentCoordinator', () => {
  let coordinator: AgentCoordinator;

  beforeEach(() => {
    coordinator = new AgentCoordinator('feat-001', '/tmp/worktree');
  });

  it('should create execution plan', () => {
    const task: TaskAnalysis = {
      taskType: 'feature',
      complexity: 'moderate',
      requiresUI: true,
      requiresBackend: true,
      requiresArchitecture: false,
      requiresApproval: true,
      suggestedAgents: [],
    };

    const plan = coordinator.createExecutionPlan(task);

    expect(plan.featureId).toBe('feat-001');
    expect(plan.parallelGroups.length).toBeGreaterThan(0);
    expect(plan.parallelGroups[0]).toContain(AgentType.FRONTEND_DEV);
    expect(plan.parallelGroups[0]).toContain(AgentType.BACKEND_DEV);
  });

  it('should track agent states', async () => {
    const task: TaskAnalysis = {
      taskType: 'feature',
      complexity: 'simple',
      requiresUI: true,
      requiresBackend: false,
      requiresArchitecture: false,
      requiresApproval: false,
      suggestedAgents: [],
    };

    await coordinator.executeParallel([AgentType.FRONTEND_DEV], task);

    const state = coordinator.getAgentState(AgentType.FRONTEND_DEV);
    expect(state).toBeDefined();
    expect(state?.status).toBe('completed');
  });

  it('should collect outputs from agents', async () => {
    const task: TaskAnalysis = {
      taskType: 'feature',
      complexity: 'simple',
      requiresUI: true,
      requiresBackend: false,
      requiresArchitecture: false,
      requiresApproval: false,
      suggestedAgents: [],
    };

    const outputs = await coordinator.executeParallel([AgentType.FRONTEND_DEV], task);

    expect(outputs.length).toBe(1);
    expect(outputs[0].agentId).toBe(AgentType.FRONTEND_DEV);
  });

  it('should emit events', async () => {
    const startedHandler = vi.fn();
    const completedHandler = vi.fn();

    coordinator.on('agent_started', startedHandler);
    coordinator.on('agent_completed', completedHandler);

    const task: TaskAnalysis = {
      taskType: 'feature',
      complexity: 'simple',
      requiresUI: true,
      requiresBackend: false,
      requiresArchitecture: false,
      requiresApproval: false,
      suggestedAgents: [],
    };

    await coordinator.executeParallel([AgentType.FRONTEND_DEV], task);

    expect(startedHandler).toHaveBeenCalled();
    expect(completedHandler).toHaveBeenCalled();
  });
});
```

### Test 3: Parallel Execution

```typescript
// tests/orchestration/parallel-execution.test.ts
import { describe, it, expect, vi } from 'vitest';
import { AgentCoordinator } from '../../src/orchestration/agent-coordinator';
import { AgentType, TaskAnalysis } from '../../src/agents/types';

// Mock for tracking parallel execution
const executionLog: { agent: AgentType; time: number }[] = [];

vi.mock('../../src/agents/registry', () => ({
  getRegistry: () => ({
    getAgent: (agentType: AgentType) => ({
      execute: vi.fn().mockImplementation(async () => {
        executionLog.push({ agent: agentType, time: Date.now() });

        // Simulate some work
        await new Promise(r => setTimeout(r, 100));

        return {
          agentId: agentType,
          success: true,
          result: {},
          artifacts: [],
          routingHints: { suggestNext: [], skipAgents: [], needsApproval: false, hasFailures: false, isComplete: true },
          metrics: { startTime: new Date(), endTime: new Date(), durationMs: 100, tokensUsed: 100, llmCalls: 1, retryCount: 0, cacheHits: 0 },
        };
      }),
    }),
  }),
}));

describe('Parallel Execution', () => {
  it('should execute agents in parallel', async () => {
    executionLog.length = 0;

    const coordinator = new AgentCoordinator('feat-001', '/tmp/worktree');

    const task: TaskAnalysis = {
      taskType: 'feature',
      complexity: 'moderate',
      requiresUI: true,
      requiresBackend: true,
      requiresArchitecture: false,
      requiresApproval: false,
      suggestedAgents: [],
    };

    await coordinator.executeParallel(
      [AgentType.FRONTEND_DEV, AgentType.BACKEND_DEV],
      task
    );

    // Both agents should have started at approximately the same time
    expect(executionLog.length).toBe(2);

    const timeDiff = Math.abs(executionLog[0].time - executionLog[1].time);
    expect(timeDiff).toBeLessThan(50); // Should start within 50ms of each other
  });
});
```

---

## Validation Checklist

```
□ Orchestration Types
  □ FeatureStatus states
  □ AgentExecutionState
  □ FeatureContext
  □ ParallelExecutionPlan
  □ File lock types
  □ Epic and Feature definitions

□ File Lock Manager
  □ Acquire locks (exclusive/shared)
  □ Release locks
  □ Lock queuing
  □ Expiration cleanup
  □ Multi-lock atomic acquisition
  □ Path normalization

□ Agent Coordinator
  □ Create execution plan
  □ Execute agents in parallel
  □ Track agent states
  □ Collect outputs
  □ Coordination messages
  □ File lock integration

□ Feature Executor
  □ Initialize feature with worktree
  □ Execute design phase
  □ Execute parallel development
  □ Execute test phase
  □ Bug fix loop
  □ Review phase
  □ Auto-commit support

□ Multi-Feature Executor (Pool Management)
  □ Execute epic with multiple features
  □ Parallel planning phase (5 planners for 5 features)
  □ Respect pool capacity (max 15 agents)
  □ Feature dependency ordering
  □ Wave-based feature execution
  □ Pool utilization monitoring
  □ Event forwarding

□ All tests pass
  □ npm run test -- tests/orchestration/
```

---

## Next Step

Proceed to **11-CONFLICT-DETECTION.md** to implement cross-feature conflict detection and resolution.
