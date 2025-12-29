# Step 04c: Checkpoint & Recovery System

> **Checkpoint:** CP0 - Foundation
> **Previous Step:** 04b-CLAUDE-MD-GENERATOR.md
> **Next Step:** 04d-AUDIT-LOGGING.md

---

## Overview

The **Checkpoint & Recovery System** provides fault tolerance and state persistence for the orchestration workflow. It enables pause/resume capabilities, crash recovery, and workflow replay for debugging.

Key responsibilities:
- Create checkpoints at critical workflow stages
- Persist complete orchestration state
- Recover from failures and crashes
- Support manual pause/resume
- Enable workflow replay for debugging

---

## Deliverables

1. `src/core/checkpoint/types.ts` - Checkpoint type definitions
2. `src/core/checkpoint/checkpoint-manager.ts` - Checkpoint creation and storage
3. `src/core/checkpoint/recovery-manager.ts` - State recovery and replay
4. `src/core/checkpoint/triggers.ts` - Automatic checkpoint triggers
5. `src/persistence/checkpoint-store.ts` - Checkpoint persistence layer

---

## 1. Type Definitions (`src/core/checkpoint/types.ts`)

```typescript
/**
 * Checkpoint & Recovery Types
 */

import { z } from 'zod';
import { AgentType } from '../../agents/types';

/**
 * Checkpoint trigger types
 */
export const CheckpointTriggerSchema = z.enum([
  'state_transition',    // Workflow state changed
  'agent_complete',      // Agent finished execution
  'user_approval',       // User approved/rejected
  'error_occurred',      // Error during execution
  'manual',              // User requested checkpoint
  'time_interval',       // Periodic checkpoint
  'before_destructive',  // Before destructive operation
]);

export type CheckpointTrigger = z.infer<typeof CheckpointTriggerSchema>;

/**
 * Checkpoint status
 */
export const CheckpointStatusSchema = z.enum([
  'creating',
  'valid',
  'corrupted',
  'expired',
  'archived',
]);

export type CheckpointStatus = z.infer<typeof CheckpointStatusSchema>;

/**
 * Agent execution state snapshot
 */
export const AgentStateSnapshotSchema = z.object({
  agentId: z.nativeEnum(AgentType),
  status: z.enum(['pending', 'running', 'completed', 'failed', 'skipped']),
  startedAt: z.string().datetime().optional(),
  completedAt: z.string().datetime().optional(),
  input: z.record(z.unknown()).optional(),
  output: z.record(z.unknown()).optional(),
  error: z.string().optional(),
  attempts: z.number().int().min(0),
  tokenUsage: z.object({
    input: z.number(),
    output: z.number(),
  }).optional(),
});

export type AgentStateSnapshot = z.infer<typeof AgentStateSnapshotSchema>;

/**
 * Workflow state snapshot
 */
export const WorkflowStateSnapshotSchema = z.object({
  currentState: z.string(),
  previousState: z.string().optional(),
  stateHistory: z.array(z.object({
    state: z.string(),
    enteredAt: z.string().datetime(),
    exitedAt: z.string().datetime().optional(),
    trigger: z.string(),
  })),
  pendingTransitions: z.array(z.string()),
});

export type WorkflowStateSnapshot = z.infer<typeof WorkflowStateSnapshotSchema>;

/**
 * Context snapshot
 */
export const ContextSnapshotSchema = z.object({
  projectId: z.string(),
  sessionId: z.string(),
  taskDescription: z.string(),
  workBreakdown: z.record(z.unknown()).optional(),
  artifacts: z.array(z.object({
    id: z.string(),
    type: z.string(),
    path: z.string(),
    checksum: z.string(),
  })),
  lessons: z.array(z.string()),
  decisions: z.array(z.object({
    id: z.string(),
    decision: z.string(),
    rationale: z.string(),
    madeAt: z.string().datetime(),
  })),
});

export type ContextSnapshot = z.infer<typeof ContextSnapshotSchema>;

/**
 * File system snapshot
 */
export const FileSystemSnapshotSchema = z.object({
  modifiedFiles: z.array(z.object({
    path: z.string(),
    checksum: z.string(),
    size: z.number(),
    modifiedAt: z.string().datetime(),
  })),
  createdFiles: z.array(z.string()),
  deletedFiles: z.array(z.string()),
  gitStatus: z.object({
    branch: z.string(),
    commitHash: z.string(),
    isDirty: z.boolean(),
    stagedFiles: z.array(z.string()),
    unstagedFiles: z.array(z.string()),
  }).optional(),
});

export type FileSystemSnapshot = z.infer<typeof FileSystemSnapshotSchema>;

/**
 * Complete checkpoint
 */
export const CheckpointSchema = z.object({
  // Identity
  id: z.string().uuid(),
  version: z.string(),
  createdAt: z.string().datetime(),

  // Trigger info
  trigger: CheckpointTriggerSchema,
  triggerReason: z.string(),

  // Status
  status: CheckpointStatusSchema,

  // Snapshots
  workflow: WorkflowStateSnapshotSchema,
  agents: z.array(AgentStateSnapshotSchema),
  context: ContextSnapshotSchema,
  fileSystem: FileSystemSnapshotSchema,

  // Metadata
  metadata: z.object({
    orchestratorVersion: z.string(),
    checkpointSize: z.number(),
    compressionType: z.enum(['none', 'gzip', 'lz4']),
    checksums: z.object({
      workflow: z.string(),
      agents: z.string(),
      context: z.string(),
      fileSystem: z.string(),
      overall: z.string(),
    }),
  }),

  // Recovery info
  recovery: z.object({
    canResume: z.boolean(),
    resumeFromAgent: z.nativeEnum(AgentType).optional(),
    resumeFromState: z.string().optional(),
    blockers: z.array(z.string()),
  }),
});

export type Checkpoint = z.infer<typeof CheckpointSchema>;

/**
 * Recovery options
 */
export interface RecoveryOptions {
  checkpointId: string;
  skipFailedAgent?: boolean;
  resetToState?: string;
  replayMode?: boolean;
  dryRun?: boolean;
}

/**
 * Recovery result
 */
export interface RecoveryResult {
  success: boolean;
  checkpoint: Checkpoint;
  restoredState: string;
  skippedAgents: AgentType[];
  warnings: string[];
  errors: string[];
}
```

---

## 2. Checkpoint Manager (`src/core/checkpoint/checkpoint-manager.ts`)

```typescript
/**
 * Checkpoint Manager
 *
 * Creates and manages workflow checkpoints.
 */

import { randomUUID } from 'crypto';
import { createHash } from 'crypto';
import {
  Checkpoint,
  CheckpointSchema,
  CheckpointTrigger,
  CheckpointStatus,
  AgentStateSnapshot,
  WorkflowStateSnapshot,
  ContextSnapshot,
  FileSystemSnapshot,
} from './types';
import { CheckpointStore } from '../../persistence/checkpoint-store';
import { StateGraph } from '../state-machine';
import { AgentRegistry } from '../../agents/registry';
import { ContextManager } from '../../agents/context-manager';
import { logger } from '../../utils/logger';

/**
 * Checkpoint configuration
 */
export interface CheckpointConfig {
  enabled: boolean;
  maxCheckpoints: number;
  compressionType: 'none' | 'gzip' | 'lz4';
  autoCheckpointInterval: number; // milliseconds, 0 = disabled
  checkpointOnStateTransition: boolean;
  checkpointOnAgentComplete: boolean;
  checkpointBeforeDestructive: boolean;
  retentionDays: number;
}

const DEFAULT_CONFIG: CheckpointConfig = {
  enabled: true,
  maxCheckpoints: 50,
  compressionType: 'gzip',
  autoCheckpointInterval: 300000, // 5 minutes
  checkpointOnStateTransition: true,
  checkpointOnAgentComplete: true,
  checkpointBeforeDestructive: true,
  retentionDays: 30,
};

/**
 * Checkpoint Manager implementation
 */
export class CheckpointManager {
  private config: CheckpointConfig;
  private store: CheckpointStore;
  private stateGraph: StateGraph;
  private agentRegistry: AgentRegistry;
  private contextManager: ContextManager;
  private intervalTimer?: NodeJS.Timeout;
  private currentSessionId: string;

  constructor(
    store: CheckpointStore,
    stateGraph: StateGraph,
    agentRegistry: AgentRegistry,
    contextManager: ContextManager,
    config: Partial<CheckpointConfig> = {}
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.store = store;
    this.stateGraph = stateGraph;
    this.agentRegistry = agentRegistry;
    this.contextManager = contextManager;
    this.currentSessionId = randomUUID();
  }

  /**
   * Initialize checkpoint manager
   */
  async initialize(): Promise<void> {
    if (!this.config.enabled) {
      logger.info('Checkpoint system disabled');
      return;
    }

    // Start auto-checkpoint interval if configured
    if (this.config.autoCheckpointInterval > 0) {
      this.intervalTimer = setInterval(
        () => this.createCheckpoint('time_interval', 'Periodic checkpoint'),
        this.config.autoCheckpointInterval
      );
    }

    // Cleanup old checkpoints
    await this.cleanupExpiredCheckpoints();

    logger.info('Checkpoint manager initialized', {
      maxCheckpoints: this.config.maxCheckpoints,
      autoInterval: this.config.autoCheckpointInterval,
    });
  }

  /**
   * Shutdown checkpoint manager
   */
  async shutdown(): Promise<void> {
    if (this.intervalTimer) {
      clearInterval(this.intervalTimer);
    }

    // Create final checkpoint before shutdown
    await this.createCheckpoint('manual', 'Shutdown checkpoint');
  }

  /**
   * Create a checkpoint
   */
  async createCheckpoint(
    trigger: CheckpointTrigger,
    reason: string
  ): Promise<Checkpoint> {
    if (!this.config.enabled) {
      throw new Error('Checkpoint system is disabled');
    }

    const checkpointId = randomUUID();
    const createdAt = new Date().toISOString();

    logger.info('Creating checkpoint', { checkpointId, trigger, reason });

    try {
      // Capture all snapshots in parallel
      const [workflow, agents, context, fileSystem] = await Promise.all([
        this.captureWorkflowState(),
        this.captureAgentStates(),
        this.captureContext(),
        this.captureFileSystem(),
      ]);

      // Calculate checksums
      const checksums = {
        workflow: this.calculateChecksum(workflow),
        agents: this.calculateChecksum(agents),
        context: this.calculateChecksum(context),
        fileSystem: this.calculateChecksum(fileSystem),
        overall: '',
      };
      checksums.overall = this.calculateChecksum(checksums);

      // Determine recovery capability
      const recovery = this.analyzeRecoveryCapability(workflow, agents);

      const checkpoint: Checkpoint = {
        id: checkpointId,
        version: '1.0.0',
        createdAt,
        trigger,
        triggerReason: reason,
        status: 'valid',
        workflow,
        agents,
        context,
        fileSystem,
        metadata: {
          orchestratorVersion: '1.0.0',
          checkpointSize: 0, // Will be set after serialization
          compressionType: this.config.compressionType,
          checksums,
        },
        recovery,
      };

      // Validate checkpoint
      CheckpointSchema.parse(checkpoint);

      // Store checkpoint
      await this.store.save(checkpoint);

      // Enforce max checkpoints limit
      await this.enforceCheckpointLimit();

      logger.info('Checkpoint created', {
        checkpointId,
        canResume: recovery.canResume,
      });

      return checkpoint;
    } catch (error) {
      logger.error('Failed to create checkpoint', { checkpointId, error });
      throw error;
    }
  }

  /**
   * Capture workflow state
   */
  private async captureWorkflowState(): Promise<WorkflowStateSnapshot> {
    const state = this.stateGraph.getState();
    const history = this.stateGraph.getHistory();

    return {
      currentState: state.current,
      previousState: state.previous,
      stateHistory: history.map(h => ({
        state: h.state,
        enteredAt: h.enteredAt.toISOString(),
        exitedAt: h.exitedAt?.toISOString(),
        trigger: h.trigger,
      })),
      pendingTransitions: state.pendingTransitions || [],
    };
  }

  /**
   * Capture agent states
   */
  private async captureAgentStates(): Promise<AgentStateSnapshot[]> {
    const agents = this.agentRegistry.getAllAgents();
    const snapshots: AgentStateSnapshot[] = [];

    for (const agent of agents) {
      const state = agent.getState();
      snapshots.push({
        agentId: agent.getId(),
        status: state.status,
        startedAt: state.startedAt?.toISOString(),
        completedAt: state.completedAt?.toISOString(),
        input: state.input,
        output: state.output,
        error: state.error?.message,
        attempts: state.attempts,
        tokenUsage: state.tokenUsage,
      });
    }

    return snapshots;
  }

  /**
   * Capture context
   */
  private async captureContext(): Promise<ContextSnapshot> {
    const context = this.contextManager.getFullContext();

    return {
      projectId: context.projectId,
      sessionId: this.currentSessionId,
      taskDescription: context.taskDescription,
      workBreakdown: context.workBreakdown,
      artifacts: context.artifacts.map(a => ({
        id: a.id,
        type: a.type,
        path: a.path,
        checksum: this.calculateChecksum(a.content),
      })),
      lessons: context.lessons || [],
      decisions: context.decisions || [],
    };
  }

  /**
   * Capture file system state
   */
  private async captureFileSystem(): Promise<FileSystemSnapshot> {
    // This would integrate with git and file system tracking
    return {
      modifiedFiles: [],
      createdFiles: [],
      deletedFiles: [],
      gitStatus: undefined, // Would be populated by git integration
    };
  }

  /**
   * Analyze recovery capability
   */
  private analyzeRecoveryCapability(
    workflow: WorkflowStateSnapshot,
    agents: AgentStateSnapshot[]
  ): Checkpoint['recovery'] {
    const blockers: string[] = [];
    let canResume = true;
    let resumeFromAgent: AgentStateSnapshot | undefined;
    let resumeFromState: string | undefined;

    // Check for running agents
    const runningAgent = agents.find(a => a.status === 'running');
    if (runningAgent) {
      blockers.push(`Agent ${runningAgent.agentId} was in progress`);
      resumeFromAgent = runningAgent;
    }

    // Check for failed agents without retry capability
    const failedAgents = agents.filter(a => a.status === 'failed' && a.attempts >= 3);
    if (failedAgents.length > 0) {
      blockers.push(`${failedAgents.length} agent(s) exceeded retry limit`);
      canResume = false;
    }

    // Check workflow state
    if (workflow.currentState === 'ERROR' || workflow.currentState === 'ABORTED') {
      blockers.push(`Workflow in ${workflow.currentState} state`);
      canResume = false;
    }

    resumeFromState = workflow.currentState;

    return {
      canResume,
      resumeFromAgent: resumeFromAgent?.agentId,
      resumeFromState,
      blockers,
    };
  }

  /**
   * Calculate checksum for data
   */
  private calculateChecksum(data: unknown): string {
    const json = JSON.stringify(data);
    return createHash('sha256').update(json).digest('hex').substring(0, 16);
  }

  /**
   * Enforce checkpoint limit
   */
  private async enforceCheckpointLimit(): Promise<void> {
    const checkpoints = await this.store.list();

    if (checkpoints.length > this.config.maxCheckpoints) {
      // Sort by creation date, oldest first
      const sorted = checkpoints.sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );

      // Archive oldest checkpoints
      const toArchive = sorted.slice(0, checkpoints.length - this.config.maxCheckpoints);
      for (const checkpoint of toArchive) {
        await this.store.archive(checkpoint.id);
      }

      logger.info('Archived old checkpoints', { count: toArchive.length });
    }
  }

  /**
   * Cleanup expired checkpoints
   */
  private async cleanupExpiredCheckpoints(): Promise<void> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.config.retentionDays);

    const deleted = await this.store.deleteOlderThan(cutoffDate);
    if (deleted > 0) {
      logger.info('Deleted expired checkpoints', { count: deleted });
    }
  }

  /**
   * Get checkpoint by ID
   */
  async getCheckpoint(id: string): Promise<Checkpoint | null> {
    return this.store.get(id);
  }

  /**
   * List all checkpoints
   */
  async listCheckpoints(): Promise<Checkpoint[]> {
    return this.store.list();
  }

  /**
   * Get latest checkpoint
   */
  async getLatestCheckpoint(): Promise<Checkpoint | null> {
    const checkpoints = await this.store.list();
    if (checkpoints.length === 0) return null;

    return checkpoints.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )[0];
  }

  /**
   * Validate checkpoint integrity
   */
  async validateCheckpoint(id: string): Promise<boolean> {
    const checkpoint = await this.store.get(id);
    if (!checkpoint) return false;

    // Recalculate checksums
    const checksums = {
      workflow: this.calculateChecksum(checkpoint.workflow),
      agents: this.calculateChecksum(checkpoint.agents),
      context: this.calculateChecksum(checkpoint.context),
      fileSystem: this.calculateChecksum(checkpoint.fileSystem),
      overall: '',
    };
    checksums.overall = this.calculateChecksum(checksums);

    // Compare with stored checksums
    const stored = checkpoint.metadata.checksums;
    return (
      checksums.workflow === stored.workflow &&
      checksums.agents === stored.agents &&
      checksums.context === stored.context &&
      checksums.fileSystem === stored.fileSystem &&
      checksums.overall === stored.overall
    );
  }
}
```

---

## 3. Recovery Manager (`src/core/checkpoint/recovery-manager.ts`)

```typescript
/**
 * Recovery Manager
 *
 * Handles state recovery and workflow replay.
 */

import {
  Checkpoint,
  RecoveryOptions,
  RecoveryResult,
  AgentStateSnapshot,
} from './types';
import { CheckpointManager } from './checkpoint-manager';
import { StateGraph } from '../state-machine';
import { AgentRegistry } from '../../agents/registry';
import { ContextManager } from '../../agents/context-manager';
import { AgentType } from '../../agents/types';
import { logger } from '../../utils/logger';

/**
 * Recovery Manager implementation
 */
export class RecoveryManager {
  private checkpointManager: CheckpointManager;
  private stateGraph: StateGraph;
  private agentRegistry: AgentRegistry;
  private contextManager: ContextManager;

  constructor(
    checkpointManager: CheckpointManager,
    stateGraph: StateGraph,
    agentRegistry: AgentRegistry,
    contextManager: ContextManager
  ) {
    this.checkpointManager = checkpointManager;
    this.stateGraph = stateGraph;
    this.agentRegistry = agentRegistry;
    this.contextManager = contextManager;
  }

  /**
   * Recover from a checkpoint
   */
  async recover(options: RecoveryOptions): Promise<RecoveryResult> {
    const { checkpointId, skipFailedAgent, resetToState, replayMode, dryRun } = options;

    logger.info('Starting recovery', { checkpointId, options });

    // Load checkpoint
    const checkpoint = await this.checkpointManager.getCheckpoint(checkpointId);
    if (!checkpoint) {
      return {
        success: false,
        checkpoint: null as any,
        restoredState: '',
        skippedAgents: [],
        warnings: [],
        errors: [`Checkpoint ${checkpointId} not found`],
      };
    }

    // Validate checkpoint integrity
    const isValid = await this.checkpointManager.validateCheckpoint(checkpointId);
    if (!isValid) {
      return {
        success: false,
        checkpoint,
        restoredState: '',
        skippedAgents: [],
        warnings: [],
        errors: ['Checkpoint integrity validation failed'],
      };
    }

    // Check if recovery is possible
    if (!checkpoint.recovery.canResume && !skipFailedAgent && !resetToState) {
      return {
        success: false,
        checkpoint,
        restoredState: '',
        skippedAgents: [],
        warnings: [],
        errors: ['Recovery not possible: ' + checkpoint.recovery.blockers.join(', ')],
      };
    }

    const warnings: string[] = [];
    const errors: string[] = [];
    const skippedAgents: AgentType[] = [];

    if (dryRun) {
      logger.info('Dry run mode - no changes will be made');
      return {
        success: true,
        checkpoint,
        restoredState: resetToState || checkpoint.workflow.currentState,
        skippedAgents,
        warnings: ['Dry run - no changes made'],
        errors: [],
      };
    }

    try {
      // Restore workflow state
      const targetState = resetToState || checkpoint.workflow.currentState;
      await this.restoreWorkflowState(checkpoint, targetState);

      // Restore agent states
      const agentResult = await this.restoreAgentStates(checkpoint, skipFailedAgent);
      skippedAgents.push(...agentResult.skipped);
      warnings.push(...agentResult.warnings);

      // Restore context
      await this.restoreContext(checkpoint);

      // If replay mode, prepare for step-by-step execution
      if (replayMode) {
        await this.prepareReplayMode(checkpoint);
        warnings.push('Replay mode enabled - step through with next()');
      }

      logger.info('Recovery completed', {
        checkpointId,
        restoredState: targetState,
        skippedAgents,
      });

      return {
        success: true,
        checkpoint,
        restoredState: targetState,
        skippedAgents,
        warnings,
        errors,
      };
    } catch (error) {
      logger.error('Recovery failed', { checkpointId, error });
      return {
        success: false,
        checkpoint,
        restoredState: '',
        skippedAgents,
        warnings,
        errors: [error instanceof Error ? error.message : 'Unknown error'],
      };
    }
  }

  /**
   * Restore workflow state
   */
  private async restoreWorkflowState(
    checkpoint: Checkpoint,
    targetState: string
  ): Promise<void> {
    logger.debug('Restoring workflow state', { targetState });

    // Reset state machine to target state
    await this.stateGraph.reset();
    await this.stateGraph.transitionTo(targetState, 'recovery');

    // Restore state history for context
    for (const historyItem of checkpoint.workflow.stateHistory) {
      this.stateGraph.recordHistory({
        state: historyItem.state,
        enteredAt: new Date(historyItem.enteredAt),
        exitedAt: historyItem.exitedAt ? new Date(historyItem.exitedAt) : undefined,
        trigger: historyItem.trigger,
      });
    }
  }

  /**
   * Restore agent states
   */
  private async restoreAgentStates(
    checkpoint: Checkpoint,
    skipFailed: boolean = false
  ): Promise<{ skipped: AgentType[]; warnings: string[] }> {
    const skipped: AgentType[] = [];
    const warnings: string[] = [];

    for (const agentState of checkpoint.agents) {
      const agent = this.agentRegistry.getAgent(agentState.agentId);
      if (!agent) {
        warnings.push(`Agent ${agentState.agentId} not found in registry`);
        continue;
      }

      // Skip failed agents if requested
      if (skipFailed && agentState.status === 'failed') {
        skipped.push(agentState.agentId);
        warnings.push(`Skipping failed agent: ${agentState.agentId}`);
        continue;
      }

      // Restore agent state
      await agent.restoreState({
        status: agentState.status === 'running' ? 'pending' : agentState.status,
        input: agentState.input,
        output: agentState.output,
        attempts: agentState.attempts,
        tokenUsage: agentState.tokenUsage,
      });
    }

    return { skipped, warnings };
  }

  /**
   * Restore context
   */
  private async restoreContext(checkpoint: Checkpoint): Promise<void> {
    logger.debug('Restoring context');

    await this.contextManager.restore({
      projectId: checkpoint.context.projectId,
      sessionId: checkpoint.context.sessionId,
      taskDescription: checkpoint.context.taskDescription,
      workBreakdown: checkpoint.context.workBreakdown,
      lessons: checkpoint.context.lessons,
      decisions: checkpoint.context.decisions,
    });
  }

  /**
   * Prepare replay mode
   */
  private async prepareReplayMode(checkpoint: Checkpoint): Promise<void> {
    logger.debug('Preparing replay mode');
    // Set up step-by-step execution mode
    this.stateGraph.setReplayMode(true);
  }

  /**
   * Get recovery status for a checkpoint
   */
  async getRecoveryStatus(checkpointId: string): Promise<{
    canRecover: boolean;
    blockers: string[];
    suggestions: string[];
  }> {
    const checkpoint = await this.checkpointManager.getCheckpoint(checkpointId);
    if (!checkpoint) {
      return {
        canRecover: false,
        blockers: ['Checkpoint not found'],
        suggestions: [],
      };
    }

    const suggestions: string[] = [];

    if (!checkpoint.recovery.canResume) {
      if (checkpoint.recovery.blockers.some(b => b.includes('exceeded retry limit'))) {
        suggestions.push('Use skipFailedAgent: true to skip failed agents');
      }
      if (checkpoint.recovery.blockers.some(b => b.includes('ERROR state'))) {
        suggestions.push('Use resetToState to rollback to a previous state');
      }
    }

    return {
      canRecover: checkpoint.recovery.canResume,
      blockers: checkpoint.recovery.blockers,
      suggestions,
    };
  }

  /**
   * List available recovery points
   */
  async listRecoveryPoints(): Promise<Array<{
    id: string;
    createdAt: string;
    trigger: string;
    state: string;
    canResume: boolean;
  }>> {
    const checkpoints = await this.checkpointManager.listCheckpoints();

    return checkpoints.map(cp => ({
      id: cp.id,
      createdAt: cp.createdAt,
      trigger: cp.trigger,
      state: cp.workflow.currentState,
      canResume: cp.recovery.canResume,
    }));
  }

  /**
   * Attempt automatic recovery from crash
   */
  async attemptAutoRecovery(): Promise<RecoveryResult | null> {
    const latest = await this.checkpointManager.getLatestCheckpoint();
    if (!latest) {
      logger.info('No checkpoint available for auto-recovery');
      return null;
    }

    // Check if recovery is needed (workflow was interrupted)
    if (latest.workflow.currentState === 'COMPLETE') {
      logger.info('Last workflow completed successfully, no recovery needed');
      return null;
    }

    logger.info('Attempting auto-recovery from latest checkpoint', {
      checkpointId: latest.id,
      state: latest.workflow.currentState,
    });

    return this.recover({
      checkpointId: latest.id,
      skipFailedAgent: false,
    });
  }
}
```

---

## 4. Checkpoint Triggers (`src/core/checkpoint/triggers.ts`)

```typescript
/**
 * Checkpoint Triggers
 *
 * Automatic checkpoint creation based on events.
 */

import { CheckpointManager } from './checkpoint-manager';
import { CheckpointTrigger } from './types';
import { AgentType } from '../../agents/types';
import { logger } from '../../utils/logger';

/**
 * Trigger configuration
 */
export interface TriggerConfig {
  onStateTransition: boolean;
  onAgentComplete: boolean;
  onUserApproval: boolean;
  onError: boolean;
  beforeDestructive: boolean;
  destructiveOperations: string[];
}

const DEFAULT_TRIGGER_CONFIG: TriggerConfig = {
  onStateTransition: true,
  onAgentComplete: true,
  onUserApproval: true,
  onError: true,
  beforeDestructive: true,
  destructiveOperations: [
    'git_push',
    'git_force_push',
    'file_delete',
    'database_migrate',
    'deploy',
    'publish',
  ],
};

/**
 * Checkpoint Trigger Manager
 */
export class CheckpointTriggerManager {
  private checkpointManager: CheckpointManager;
  private config: TriggerConfig;
  private enabled: boolean = true;

  constructor(
    checkpointManager: CheckpointManager,
    config: Partial<TriggerConfig> = {}
  ) {
    this.checkpointManager = checkpointManager;
    this.config = { ...DEFAULT_TRIGGER_CONFIG, ...config };
  }

  /**
   * Enable/disable triggers
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  /**
   * Handle state transition
   */
  async onStateTransition(
    fromState: string,
    toState: string,
    trigger: string
  ): Promise<void> {
    if (!this.enabled || !this.config.onStateTransition) return;

    await this.createCheckpoint(
      'state_transition',
      `State transition: ${fromState} → ${toState} (${trigger})`
    );
  }

  /**
   * Handle agent completion
   */
  async onAgentComplete(
    agentId: AgentType,
    success: boolean,
    result?: unknown
  ): Promise<void> {
    if (!this.enabled || !this.config.onAgentComplete) return;

    const status = success ? 'completed' : 'failed';
    await this.createCheckpoint(
      'agent_complete',
      `Agent ${agentId} ${status}`
    );
  }

  /**
   * Handle user approval
   */
  async onUserApproval(
    approved: boolean,
    itemType: string,
    itemId: string
  ): Promise<void> {
    if (!this.enabled || !this.config.onUserApproval) return;

    const action = approved ? 'approved' : 'rejected';
    await this.createCheckpoint(
      'user_approval',
      `User ${action} ${itemType}: ${itemId}`
    );
  }

  /**
   * Handle error
   */
  async onError(
    error: Error,
    context: string
  ): Promise<void> {
    if (!this.enabled || !this.config.onError) return;

    await this.createCheckpoint(
      'error_occurred',
      `Error in ${context}: ${error.message}`
    );
  }

  /**
   * Handle destructive operation
   */
  async beforeDestructiveOperation(
    operation: string,
    target: string
  ): Promise<boolean> {
    if (!this.enabled || !this.config.beforeDestructive) return true;

    if (this.config.destructiveOperations.includes(operation)) {
      await this.createCheckpoint(
        'before_destructive',
        `Before ${operation}: ${target}`
      );
      return true;
    }

    return true;
  }

  /**
   * Create manual checkpoint
   */
  async createManualCheckpoint(reason: string): Promise<void> {
    await this.createCheckpoint('manual', reason);
  }

  /**
   * Create checkpoint with error handling
   */
  private async createCheckpoint(
    trigger: CheckpointTrigger,
    reason: string
  ): Promise<void> {
    try {
      await this.checkpointManager.createCheckpoint(trigger, reason);
    } catch (error) {
      logger.error('Failed to create triggered checkpoint', {
        trigger,
        reason,
        error,
      });
      // Don't throw - checkpoint failure shouldn't stop workflow
    }
  }
}
```

---

## 5. Checkpoint Store (`src/persistence/checkpoint-store.ts`)

```typescript
/**
 * Checkpoint Store
 *
 * Persistence layer for checkpoints.
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { gzip, gunzip } from 'zlib';
import { promisify } from 'util';
import { Checkpoint, CheckpointSchema } from '../core/checkpoint/types';
import { logger } from '../utils/logger';

const gzipAsync = promisify(gzip);
const gunzipAsync = promisify(gunzip);

/**
 * Store configuration
 */
export interface CheckpointStoreConfig {
  basePath: string;
  compression: boolean;
  indexEnabled: boolean;
}

/**
 * Checkpoint index entry
 */
interface CheckpointIndex {
  id: string;
  createdAt: string;
  trigger: string;
  status: string;
  state: string;
  canResume: boolean;
  size: number;
  path: string;
}

/**
 * Checkpoint Store implementation
 */
export class CheckpointStore {
  private config: CheckpointStoreConfig;
  private index: Map<string, CheckpointIndex> = new Map();
  private indexPath: string;

  constructor(config: CheckpointStoreConfig) {
    this.config = config;
    this.indexPath = path.join(config.basePath, 'index.json');
  }

  /**
   * Initialize store
   */
  async initialize(): Promise<void> {
    // Ensure directory exists
    await fs.mkdir(this.config.basePath, { recursive: true });

    // Load index if enabled
    if (this.config.indexEnabled) {
      await this.loadIndex();
    }
  }

  /**
   * Save checkpoint
   */
  async save(checkpoint: Checkpoint): Promise<void> {
    const filename = `${checkpoint.id}.json${this.config.compression ? '.gz' : ''}`;
    const filePath = path.join(this.config.basePath, filename);

    let data = JSON.stringify(checkpoint, null, 2);
    let buffer = Buffer.from(data);

    if (this.config.compression) {
      buffer = await gzipAsync(buffer);
    }

    await fs.writeFile(filePath, buffer);

    // Update checkpoint with size
    checkpoint.metadata.checkpointSize = buffer.length;

    // Update index
    if (this.config.indexEnabled) {
      this.index.set(checkpoint.id, {
        id: checkpoint.id,
        createdAt: checkpoint.createdAt,
        trigger: checkpoint.trigger,
        status: checkpoint.status,
        state: checkpoint.workflow.currentState,
        canResume: checkpoint.recovery.canResume,
        size: buffer.length,
        path: filePath,
      });
      await this.saveIndex();
    }

    logger.debug('Checkpoint saved', {
      id: checkpoint.id,
      size: buffer.length,
      compressed: this.config.compression,
    });
  }

  /**
   * Get checkpoint by ID
   */
  async get(id: string): Promise<Checkpoint | null> {
    const indexEntry = this.index.get(id);
    let filePath: string;

    if (indexEntry) {
      filePath = indexEntry.path;
    } else {
      // Try to find file
      const filename = `${id}.json${this.config.compression ? '.gz' : ''}`;
      filePath = path.join(this.config.basePath, filename);
    }

    try {
      let buffer = await fs.readFile(filePath);

      if (this.config.compression || filePath.endsWith('.gz')) {
        buffer = await gunzipAsync(buffer);
      }

      const data = JSON.parse(buffer.toString());
      return CheckpointSchema.parse(data);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return null;
      }
      throw error;
    }
  }

  /**
   * List all checkpoints
   */
  async list(): Promise<Checkpoint[]> {
    if (this.config.indexEnabled && this.index.size > 0) {
      const checkpoints: Checkpoint[] = [];
      for (const entry of this.index.values()) {
        const checkpoint = await this.get(entry.id);
        if (checkpoint) {
          checkpoints.push(checkpoint);
        }
      }
      return checkpoints;
    }

    // Fallback to directory scan
    const files = await fs.readdir(this.config.basePath);
    const checkpoints: Checkpoint[] = [];

    for (const file of files) {
      if (file.endsWith('.json') || file.endsWith('.json.gz')) {
        const id = file.replace('.json.gz', '').replace('.json', '');
        const checkpoint = await this.get(id);
        if (checkpoint) {
          checkpoints.push(checkpoint);
        }
      }
    }

    return checkpoints;
  }

  /**
   * Delete checkpoint
   */
  async delete(id: string): Promise<boolean> {
    const indexEntry = this.index.get(id);
    let filePath: string;

    if (indexEntry) {
      filePath = indexEntry.path;
    } else {
      const filename = `${id}.json${this.config.compression ? '.gz' : ''}`;
      filePath = path.join(this.config.basePath, filename);
    }

    try {
      await fs.unlink(filePath);
      this.index.delete(id);
      await this.saveIndex();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Archive checkpoint
   */
  async archive(id: string): Promise<void> {
    const checkpoint = await this.get(id);
    if (!checkpoint) return;

    checkpoint.status = 'archived';
    await this.save(checkpoint);
  }

  /**
   * Delete checkpoints older than date
   */
  async deleteOlderThan(date: Date): Promise<number> {
    const checkpoints = await this.list();
    let deleted = 0;

    for (const checkpoint of checkpoints) {
      if (new Date(checkpoint.createdAt) < date) {
        if (await this.delete(checkpoint.id)) {
          deleted++;
        }
      }
    }

    return deleted;
  }

  /**
   * Load index from disk
   */
  private async loadIndex(): Promise<void> {
    try {
      const data = await fs.readFile(this.indexPath, 'utf-8');
      const entries = JSON.parse(data) as CheckpointIndex[];
      this.index = new Map(entries.map(e => [e.id, e]));
    } catch {
      this.index = new Map();
    }
  }

  /**
   * Save index to disk
   */
  private async saveIndex(): Promise<void> {
    const entries = Array.from(this.index.values());
    await fs.writeFile(this.indexPath, JSON.stringify(entries, null, 2));
  }

  /**
   * Get store statistics
   */
  async getStats(): Promise<{
    count: number;
    totalSize: number;
    oldestCheckpoint: string | null;
    newestCheckpoint: string | null;
  }> {
    const checkpoints = await this.list();

    if (checkpoints.length === 0) {
      return {
        count: 0,
        totalSize: 0,
        oldestCheckpoint: null,
        newestCheckpoint: null,
      };
    }

    const sorted = checkpoints.sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );

    return {
      count: checkpoints.length,
      totalSize: checkpoints.reduce((sum, cp) => sum + cp.metadata.checkpointSize, 0),
      oldestCheckpoint: sorted[0].id,
      newestCheckpoint: sorted[sorted.length - 1].id,
    };
  }
}
```

---

## Test Scenarios

```typescript
// tests/core/checkpoint/checkpoint-manager.test.ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { CheckpointManager } from '../../../src/core/checkpoint/checkpoint-manager';
import { RecoveryManager } from '../../../src/core/checkpoint/recovery-manager';
import { CheckpointStore } from '../../../src/persistence/checkpoint-store';

describe('CheckpointManager', () => {
  let manager: CheckpointManager;
  let store: CheckpointStore;

  beforeEach(async () => {
    store = new CheckpointStore({
      basePath: '/tmp/test-checkpoints',
      compression: false,
      indexEnabled: true,
    });
    await store.initialize();

    // Mock dependencies
    const stateGraph = { getState: vi.fn(), getHistory: vi.fn() };
    const agentRegistry = { getAllAgents: vi.fn().mockReturnValue([]) };
    const contextManager = { getFullContext: vi.fn() };

    manager = new CheckpointManager(
      store,
      stateGraph as any,
      agentRegistry as any,
      contextManager as any
    );
    await manager.initialize();
  });

  it('should create checkpoint on state transition', async () => {
    const checkpoint = await manager.createCheckpoint(
      'state_transition',
      'Test transition'
    );

    expect(checkpoint.id).toBeDefined();
    expect(checkpoint.trigger).toBe('state_transition');
    expect(checkpoint.status).toBe('valid');
  });

  it('should validate checkpoint integrity', async () => {
    const checkpoint = await manager.createCheckpoint('manual', 'Test');
    const isValid = await manager.validateCheckpoint(checkpoint.id);
    expect(isValid).toBe(true);
  });

  it('should enforce max checkpoint limit', async () => {
    // Create more than limit
    for (let i = 0; i < 55; i++) {
      await manager.createCheckpoint('manual', `Test ${i}`);
    }

    const checkpoints = await manager.listCheckpoints();
    expect(checkpoints.length).toBeLessThanOrEqual(50);
  });
});

describe('RecoveryManager', () => {
  it('should recover from valid checkpoint', async () => {
    // Test recovery from checkpoint
  });

  it('should skip failed agents when requested', async () => {
    // Test skipFailedAgent option
  });

  it('should detect unrecoverable checkpoints', async () => {
    // Test recovery blocker detection
  });
});
```

---

## Validation Checklist

```
□ Checkpoint types defined
□ CheckpointManager creates checkpoints
□ Workflow state captured correctly
□ Agent states captured correctly
□ Context captured correctly
□ Checksum validation works
□ RecoveryManager restores state
□ Skip failed agent option works
□ Reset to state option works
□ Replay mode works
□ Checkpoint triggers fire correctly
□ Checkpoint store saves/loads
□ Compression works
□ Index management works
□ Auto-cleanup of expired checkpoints
□ All tests pass
```

---

## Next Step

Proceed to **04d-AUDIT-LOGGING.md** to implement the audit logging system.
