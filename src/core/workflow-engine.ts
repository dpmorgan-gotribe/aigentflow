/**
 * Workflow Engine
 *
 * Executes workflows using the state machine.
 */

import { randomUUID } from 'crypto';
import type { WorkflowState, AgentType } from '../types.js';
import type {
  Task,
  TaskContext,
  TaskStatus,
  TransitionContext,
  TransitionTrigger,
  AgentOutput,
  StateMachineEvent,
  EventListener,
  CheckpointData,
  RecoveryOptions,
} from './types.js';
import { getStateMachine } from './state-machine.js';
import { getAgentPool } from './agent-pool.js';
import { AigentflowError, TimeoutError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';

const log = logger.child({ component: 'workflow-engine' });

// ============================================================================
// Workflow Engine
// ============================================================================

/**
 * Workflow engine for executing tasks
 */
export class WorkflowEngine {
  private tasks: Map<string, Task>;
  private listeners: Set<EventListener>;
  private checkpoints: Map<string, CheckpointData[]>;
  private stateMachine = getStateMachine();
  private agentPool = getAgentPool();

  constructor() {
    this.tasks = new Map();
    this.listeners = new Set();
    this.checkpoints = new Map();
  }

  /**
   * Create a new task
   */
  createTask(projectId: string, prompt: string): Task {
    const taskId = randomUUID();
    const now = new Date();

    const task: Task = {
      id: taskId,
      projectId,
      prompt,
      state: 'IDLE',
      status: 'pending',
      context: {
        prompt,
        agentOutputs: new Map(),
        retryCount: 0,
        approvalsPending: [],
        lessonsApplied: [],
        metadata: {},
      },
      createdAt: now,
      updatedAt: now,
    };

    this.tasks.set(taskId, task);
    log.info('Task created', { taskId, projectId });

    return task;
  }

  /**
   * Get a task by ID
   */
  getTask(taskId: string): Task | undefined {
    return this.tasks.get(taskId);
  }

  /**
   * Get all tasks
   */
  getAllTasks(): Task[] {
    return Array.from(this.tasks.values());
  }

  /**
   * Get tasks by status
   */
  getTasksByStatus(status: TaskStatus): Task[] {
    return Array.from(this.tasks.values()).filter((t) => t.status === status);
  }

  /**
   * Start a task
   */
  async startTask(taskId: string): Promise<void> {
    const task = this.tasks.get(taskId);
    if (!task) {
      throw new AigentflowError(`Task not found: ${taskId}`, 'TASK_NOT_FOUND');
    }

    if (task.status !== 'pending') {
      throw new AigentflowError(`Task ${taskId} is not pending`, 'INVALID_TASK_STATE');
    }

    task.status = 'running';
    task.updatedAt = new Date();

    this.emit({ type: 'TASK_STARTED', taskId, prompt: task.prompt });

    try {
      await this.transitionTo(taskId, 'START');
    } catch (error) {
      task.status = 'failed';
      task.updatedAt = new Date();
      this.emit({
        type: 'TASK_FAILED',
        taskId,
        error: error instanceof Error ? error : new Error(String(error)),
      });
      throw error;
    }
  }

  /**
   * Transition a task to a new state
   */
  async transitionTo(taskId: string, trigger: TransitionTrigger, data?: Record<string, unknown>): Promise<WorkflowState> {
    const task = this.tasks.get(taskId);
    if (!task) {
      throw new AigentflowError(`Task not found: ${taskId}`, 'TASK_NOT_FOUND');
    }

    const context: TransitionContext = {
      taskId,
      fromState: task.state,
      toState: task.state, // Will be updated
      trigger,
      agent: task.context.currentAgent,
      data,
      retryCount: task.context.retryCount,
    };

    const newState = await this.stateMachine.transition(context);

    const previousState = task.state;
    task.state = newState;
    task.updatedAt = new Date();

    // Update task status based on state
    if (this.stateMachine.isTerminal(newState)) {
      task.status = newState === 'COMPLETED' ? 'completed' : 'failed';
      task.completedAt = new Date();
    }

    this.emit({ type: 'STATE_CHANGED', taskId, from: previousState, to: newState });

    // Create checkpoint at key states
    if (this.shouldCreateCheckpoint(newState)) {
      await this.createCheckpoint(taskId, trigger);
    }

    return newState;
  }

  /**
   * Execute an agent for a task
   */
  async executeAgent(taskId: string, agentType: AgentType): Promise<AgentOutput> {
    const task = this.tasks.get(taskId);
    if (!task) {
      throw new AigentflowError(`Task not found: ${taskId}`, 'TASK_NOT_FOUND');
    }

    task.context.currentAgent = agentType;
    this.emit({ type: 'AGENT_STARTED', taskId, agent: agentType });

    const startTime = Date.now();

    try {
      // Request agent from pool
      const agentInstance = await this.agentPool.requestAgent(taskId, agentType);

      // TODO: Actually execute the agent here
      // For now, simulate agent execution
      const output: AgentOutput = {
        agentType,
        success: true,
        output: { message: `Agent ${agentType} executed successfully` },
        duration: Date.now() - startTime,
        tokensUsed: 0,
        timestamp: new Date(),
      };

      // Release agent back to pool
      this.agentPool.releaseAgent(agentInstance.id);

      // Store output
      task.context.agentOutputs.set(agentType, output);
      task.updatedAt = new Date();

      this.emit({ type: 'AGENT_COMPLETED', taskId, agent: agentType, output });

      return output;
    } catch (error) {
      const output: AgentOutput = {
        agentType,
        success: false,
        output: null,
        error: error instanceof Error ? error.message : String(error),
        duration: Date.now() - startTime,
        tokensUsed: 0,
        timestamp: new Date(),
      };

      task.context.agentOutputs.set(agentType, output);
      task.updatedAt = new Date();

      this.emit({
        type: 'AGENT_FAILED',
        taskId,
        agent: agentType,
        error: error instanceof Error ? error : new Error(String(error)),
      });

      throw error;
    } finally {
      task.context.currentAgent = undefined;
    }
  }

  /**
   * Request approval for a task
   */
  async requestApproval(taskId: string, approvalId: string): Promise<void> {
    const task = this.tasks.get(taskId);
    if (!task) {
      throw new AigentflowError(`Task not found: ${taskId}`, 'TASK_NOT_FOUND');
    }

    task.context.approvalsPending.push(approvalId);
    task.updatedAt = new Date();

    await this.transitionTo(taskId, 'AGENT_COMPLETE');
    this.emit({ type: 'APPROVAL_REQUESTED', taskId, approvalId });
  }

  /**
   * Resolve an approval
   */
  async resolveApproval(taskId: string, approvalId: string, approved: boolean): Promise<void> {
    const task = this.tasks.get(taskId);
    if (!task) {
      throw new AigentflowError(`Task not found: ${taskId}`, 'TASK_NOT_FOUND');
    }

    // Remove from pending
    task.context.approvalsPending = task.context.approvalsPending.filter((id) => id !== approvalId);
    task.updatedAt = new Date();

    const trigger: TransitionTrigger = approved ? 'APPROVAL_GRANTED' : 'APPROVAL_DENIED';
    await this.transitionTo(taskId, trigger);

    this.emit({ type: 'APPROVAL_RESOLVED', taskId, approvalId, approved });
  }

  /**
   * Abort a task
   */
  async abortTask(taskId: string): Promise<void> {
    const task = this.tasks.get(taskId);
    if (!task) {
      throw new AigentflowError(`Task not found: ${taskId}`, 'TASK_NOT_FOUND');
    }

    if (this.stateMachine.isTerminal(task.state)) {
      throw new AigentflowError(`Task ${taskId} is already in terminal state`, 'INVALID_TASK_STATE');
    }

    await this.transitionTo(taskId, 'ABORT');
    this.emit({ type: 'TASK_ABORTED', taskId });
  }

  /**
   * Increment retry count
   */
  incrementRetry(taskId: string): number {
    const task = this.tasks.get(taskId);
    if (!task) {
      throw new AigentflowError(`Task not found: ${taskId}`, 'TASK_NOT_FOUND');
    }

    task.context.retryCount++;
    task.updatedAt = new Date();
    return task.context.retryCount;
  }

  /**
   * Check if should create checkpoint
   */
  private shouldCreateCheckpoint(state: WorkflowState): boolean {
    // Create checkpoints at key states
    const checkpointStates: WorkflowState[] = [
      'ORCHESTRATING',
      'AWAITING_APPROVAL',
      'AGENT_COMPLETE',
    ];
    return checkpointStates.includes(state);
  }

  /**
   * Create a checkpoint
   */
  async createCheckpoint(taskId: string, trigger: string): Promise<CheckpointData> {
    const task = this.tasks.get(taskId);
    if (!task) {
      throw new AigentflowError(`Task not found: ${taskId}`, 'TASK_NOT_FOUND');
    }

    const checkpoint: CheckpointData = {
      id: randomUUID(),
      taskId,
      state: task.state,
      context: { ...task.context },
      timestamp: new Date(),
      trigger,
    };

    const taskCheckpoints = this.checkpoints.get(taskId) ?? [];
    taskCheckpoints.push(checkpoint);
    this.checkpoints.set(taskId, taskCheckpoints);

    task.context.checkpointId = checkpoint.id;

    log.debug('Checkpoint created', { taskId, checkpointId: checkpoint.id, state: task.state });

    return checkpoint;
  }

  /**
   * Get checkpoints for a task
   */
  getCheckpoints(taskId: string): CheckpointData[] {
    return this.checkpoints.get(taskId) ?? [];
  }

  /**
   * Recover from checkpoint
   */
  async recover(taskId: string, options: RecoveryOptions = {}): Promise<void> {
    const task = this.tasks.get(taskId);
    if (!task) {
      throw new AigentflowError(`Task not found: ${taskId}`, 'TASK_NOT_FOUND');
    }

    let checkpoint: CheckpointData | undefined;

    if (options.checkpointId) {
      const taskCheckpoints = this.checkpoints.get(taskId) ?? [];
      checkpoint = taskCheckpoints.find((c) => c.id === options.checkpointId);
    } else {
      // Use latest checkpoint
      const taskCheckpoints = this.checkpoints.get(taskId) ?? [];
      checkpoint = taskCheckpoints[taskCheckpoints.length - 1];
    }

    if (!checkpoint) {
      throw new AigentflowError(`No checkpoint found for task ${taskId}`, 'CHECKPOINT_NOT_FOUND');
    }

    // Restore state
    task.state = checkpoint.state;
    task.context = { ...checkpoint.context };
    task.status = 'running';
    task.updatedAt = new Date();

    if (options.resetRetryCount) {
      task.context.retryCount = 0;
    }

    log.info('Task recovered from checkpoint', {
      taskId,
      checkpointId: checkpoint.id,
      state: task.state,
    });

    await this.transitionTo(taskId, 'RECOVER');
  }

  /**
   * Add event listener
   */
  on(listener: EventListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Emit an event
   */
  private emit(event: StateMachineEvent): void {
    for (const listener of this.listeners) {
      try {
        const result = listener(event);
        if (result instanceof Promise) {
          result.catch((error) => {
            log.error('Event listener error', error);
          });
        }
      } catch (error) {
        log.error('Event listener error', error instanceof Error ? error : undefined);
      }
    }
  }

  /**
   * Get engine statistics
   */
  getStats(): Record<string, unknown> {
    const tasks = Array.from(this.tasks.values());

    return {
      totalTasks: tasks.length,
      byStatus: {
        pending: tasks.filter((t) => t.status === 'pending').length,
        running: tasks.filter((t) => t.status === 'running').length,
        completed: tasks.filter((t) => t.status === 'completed').length,
        failed: tasks.filter((t) => t.status === 'failed').length,
        aborted: tasks.filter((t) => t.status === 'aborted').length,
      },
      totalCheckpoints: Array.from(this.checkpoints.values()).reduce((sum, c) => sum + c.length, 0),
      agentPool: this.agentPool.getStats(),
    };
  }

  /**
   * Clear all tasks (for testing)
   */
  clear(): void {
    this.tasks.clear();
    this.checkpoints.clear();
    this.listeners.clear();
  }
}

// Singleton instance
let instance: WorkflowEngine | null = null;

/**
 * Get the workflow engine singleton
 */
export function getWorkflowEngine(): WorkflowEngine {
  if (!instance) {
    instance = new WorkflowEngine();
  }
  return instance;
}

/**
 * Reset the singleton (for testing)
 */
export function resetWorkflowEngine(): void {
  instance?.clear();
  instance = null;
}
