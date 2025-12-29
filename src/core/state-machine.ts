/**
 * State Machine
 *
 * Defines workflow states and valid transitions.
 */

import type { WorkflowState, AgentType } from '../types.js';
import type {
  StateMetadata,
  TransitionDefinition,
  TransitionTrigger,
  TransitionContext,
} from './types.js';
import { StateTransitionError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';

const log = logger.child({ component: 'state-machine' });

// ============================================================================
// State Definitions
// ============================================================================

/**
 * All workflow states with metadata
 */
export const STATES: Record<WorkflowState, StateMetadata> = {
  IDLE: {
    state: 'IDLE',
    description: 'No active task',
    isTerminal: false,
    allowedTransitions: ['ANALYZING'],
  },

  ANALYZING: {
    state: 'ANALYZING',
    description: 'Analyzing task prompt',
    isTerminal: false,
    allowedTransitions: ['ORCHESTRATING', 'ERROR'],
    timeout: 30000,
  },

  ORCHESTRATING: {
    state: 'ORCHESTRATING',
    description: 'Central hub - routing to next agent',
    isTerminal: false,
    allowedTransitions: [
      'PLANNING',
      'ARCHITECTING',
      'DESIGNING',
      'BUILDING',
      'TESTING',
      'REVIEWING',
      'AGENT_WORKING',
      'AWAITING_APPROVAL',
      'COMPLETING',
      'ERROR',
    ],
    requiresAgent: 'orchestrator',
  },

  PLANNING: {
    state: 'PLANNING',
    description: 'Creating work breakdown structure',
    isTerminal: false,
    allowedTransitions: ['AGENT_WORKING'],
    requiresAgent: 'project-manager',
  },

  ARCHITECTING: {
    state: 'ARCHITECTING',
    description: 'Making architecture decisions',
    isTerminal: false,
    allowedTransitions: ['AGENT_WORKING'],
    requiresAgent: 'architect',
  },

  DESIGNING: {
    state: 'DESIGNING',
    description: 'Creating UI designs',
    isTerminal: false,
    allowedTransitions: ['AGENT_WORKING'],
    requiresAgent: 'ui-designer',
  },

  BUILDING: {
    state: 'BUILDING',
    description: 'Building code',
    isTerminal: false,
    allowedTransitions: ['AGENT_WORKING'],
  },

  TESTING: {
    state: 'TESTING',
    description: 'Running tests',
    isTerminal: false,
    allowedTransitions: ['AGENT_WORKING'],
    requiresAgent: 'tester',
  },

  FIXING: {
    state: 'FIXING',
    description: 'Fixing bugs (max 3 attempts)',
    isTerminal: false,
    allowedTransitions: ['AGENT_WORKING', 'ESCALATED'],
    requiresAgent: 'bug-fixer',
  },

  REVIEWING: {
    state: 'REVIEWING',
    description: 'Reviewing code',
    isTerminal: false,
    allowedTransitions: ['AGENT_WORKING'],
    requiresAgent: 'reviewer',
  },

  AGENT_WORKING: {
    state: 'AGENT_WORKING',
    description: 'Agent is executing',
    isTerminal: false,
    allowedTransitions: ['AGENT_COMPLETE', 'ERROR'],
    timeout: 120000,
  },

  AGENT_COMPLETE: {
    state: 'AGENT_COMPLETE',
    description: 'Agent finished, returning to orchestrator',
    isTerminal: false,
    allowedTransitions: ['ORCHESTRATING', 'FIXING', 'ESCALATED'],
  },

  AWAITING_APPROVAL: {
    state: 'AWAITING_APPROVAL',
    description: 'Waiting for human approval',
    isTerminal: false,
    allowedTransitions: ['ORCHESTRATING', 'ABORTED'],
    requiresApproval: true,
  },

  COMPLETING: {
    state: 'COMPLETING',
    description: 'Finalizing task',
    isTerminal: false,
    allowedTransitions: ['COMPLETED', 'ERROR'],
  },

  COMPLETED: {
    state: 'COMPLETED',
    description: 'Task completed successfully',
    isTerminal: true,
    allowedTransitions: [],
  },

  ERROR: {
    state: 'ERROR',
    description: 'Task failed with error',
    isTerminal: true,
    allowedTransitions: ['RECOVERING'],
  },

  ABORTED: {
    state: 'ABORTED',
    description: 'Task aborted by user',
    isTerminal: true,
    allowedTransitions: [],
  },

  ESCALATED: {
    state: 'ESCALATED',
    description: 'Task escalated after max retries',
    isTerminal: true,
    allowedTransitions: [],
  },

  RECOVERING: {
    state: 'RECOVERING',
    description: 'Recovering from error',
    isTerminal: false,
    allowedTransitions: ['ORCHESTRATING', 'ERROR'],
  },
};

// ============================================================================
// Transition Definitions
// ============================================================================

/**
 * Valid state transitions
 */
export const TRANSITIONS: TransitionDefinition[] = [
  // Start workflow
  { from: 'IDLE', to: 'ANALYZING', trigger: 'START' },

  // Analysis complete
  { from: 'ANALYZING', to: 'ORCHESTRATING', trigger: 'AGENT_COMPLETE' },
  { from: 'ANALYZING', to: 'ERROR', trigger: 'AGENT_ERROR' },

  // Orchestrator routing
  { from: 'ORCHESTRATING', to: 'PLANNING', trigger: 'AGENT_COMPLETE' },
  { from: 'ORCHESTRATING', to: 'ARCHITECTING', trigger: 'AGENT_COMPLETE' },
  { from: 'ORCHESTRATING', to: 'DESIGNING', trigger: 'AGENT_COMPLETE' },
  { from: 'ORCHESTRATING', to: 'BUILDING', trigger: 'AGENT_COMPLETE' },
  { from: 'ORCHESTRATING', to: 'TESTING', trigger: 'AGENT_COMPLETE' },
  { from: 'ORCHESTRATING', to: 'REVIEWING', trigger: 'AGENT_COMPLETE' },
  { from: 'ORCHESTRATING', to: 'AGENT_WORKING', trigger: 'AGENT_COMPLETE' },
  { from: 'ORCHESTRATING', to: 'AWAITING_APPROVAL', trigger: 'AGENT_COMPLETE' },
  { from: 'ORCHESTRATING', to: 'COMPLETING', trigger: 'COMPLETE' },
  { from: 'ORCHESTRATING', to: 'ERROR', trigger: 'AGENT_ERROR' },

  // Agent states to AGENT_WORKING
  { from: 'PLANNING', to: 'AGENT_WORKING', trigger: 'START' },
  { from: 'ARCHITECTING', to: 'AGENT_WORKING', trigger: 'START' },
  { from: 'DESIGNING', to: 'AGENT_WORKING', trigger: 'START' },
  { from: 'BUILDING', to: 'AGENT_WORKING', trigger: 'START' },
  { from: 'TESTING', to: 'AGENT_WORKING', trigger: 'START' },
  { from: 'FIXING', to: 'AGENT_WORKING', trigger: 'START' },
  { from: 'REVIEWING', to: 'AGENT_WORKING', trigger: 'START' },

  // Agent completion
  { from: 'AGENT_WORKING', to: 'AGENT_COMPLETE', trigger: 'AGENT_COMPLETE' },
  { from: 'AGENT_WORKING', to: 'ERROR', trigger: 'AGENT_ERROR' },
  { from: 'AGENT_WORKING', to: 'ERROR', trigger: 'TIMEOUT' },

  // Return to orchestrator
  { from: 'AGENT_COMPLETE', to: 'ORCHESTRATING', trigger: 'AGENT_COMPLETE' },

  // Test failures -> Fixing
  {
    from: 'AGENT_COMPLETE',
    to: 'FIXING',
    trigger: 'RETRY',
    guard: (ctx) => (ctx.retryCount ?? 0) < 3,
  },
  {
    from: 'AGENT_COMPLETE',
    to: 'ESCALATED',
    trigger: 'ESCALATE',
    guard: (ctx) => (ctx.retryCount ?? 0) >= 3,
  },

  // Fix attempts
  { from: 'FIXING', to: 'AGENT_WORKING', trigger: 'START' },
  {
    from: 'FIXING',
    to: 'ESCALATED',
    trigger: 'ESCALATE',
    guard: (ctx) => (ctx.retryCount ?? 0) >= 3,
  },

  // Approval flow
  { from: 'AWAITING_APPROVAL', to: 'ORCHESTRATING', trigger: 'APPROVAL_GRANTED' },
  { from: 'AWAITING_APPROVAL', to: 'ABORTED', trigger: 'APPROVAL_DENIED' },

  // Completion
  { from: 'COMPLETING', to: 'COMPLETED', trigger: 'COMPLETE' },
  { from: 'COMPLETING', to: 'ERROR', trigger: 'AGENT_ERROR' },

  // Abort from any non-terminal state
  { from: 'ANALYZING', to: 'ABORTED', trigger: 'ABORT' },
  { from: 'ORCHESTRATING', to: 'ABORTED', trigger: 'ABORT' },
  { from: 'PLANNING', to: 'ABORTED', trigger: 'ABORT' },
  { from: 'ARCHITECTING', to: 'ABORTED', trigger: 'ABORT' },
  { from: 'DESIGNING', to: 'ABORTED', trigger: 'ABORT' },
  { from: 'BUILDING', to: 'ABORTED', trigger: 'ABORT' },
  { from: 'TESTING', to: 'ABORTED', trigger: 'ABORT' },
  { from: 'FIXING', to: 'ABORTED', trigger: 'ABORT' },
  { from: 'REVIEWING', to: 'ABORTED', trigger: 'ABORT' },
  { from: 'AGENT_WORKING', to: 'ABORTED', trigger: 'ABORT' },
  { from: 'AGENT_COMPLETE', to: 'ABORTED', trigger: 'ABORT' },
  { from: 'COMPLETING', to: 'ABORTED', trigger: 'ABORT' },

  // Recovery
  { from: 'ERROR', to: 'RECOVERING', trigger: 'RECOVER' },
  { from: 'RECOVERING', to: 'ORCHESTRATING', trigger: 'AGENT_COMPLETE' },
  { from: 'RECOVERING', to: 'ERROR', trigger: 'AGENT_ERROR' },
];

// ============================================================================
// State Machine Class
// ============================================================================

/**
 * State machine for workflow management
 */
export class StateMachine {
  private transitionMap: Map<string, TransitionDefinition[]>;

  constructor() {
    // Build transition lookup map
    this.transitionMap = new Map();
    for (const transition of TRANSITIONS) {
      const key = `${transition.from}:${transition.trigger}`;
      const existing = this.transitionMap.get(key) ?? [];
      existing.push(transition);
      this.transitionMap.set(key, existing);
    }
  }

  /**
   * Get state metadata
   */
  getState(state: WorkflowState): StateMetadata {
    return STATES[state];
  }

  /**
   * Check if a state is terminal
   */
  isTerminal(state: WorkflowState): boolean {
    return STATES[state].isTerminal;
  }

  /**
   * Get allowed transitions from a state
   */
  getAllowedTransitions(state: WorkflowState): WorkflowState[] {
    return STATES[state].allowedTransitions;
  }

  /**
   * Check if a transition is valid
   */
  canTransition(from: WorkflowState, to: WorkflowState, trigger: TransitionTrigger): boolean {
    const key = `${from}:${trigger}`;
    const transitions = this.transitionMap.get(key) ?? [];
    return transitions.some((t) => t.to === to);
  }

  /**
   * Get the next state for a trigger
   */
  getNextState(
    from: WorkflowState,
    trigger: TransitionTrigger,
    context?: TransitionContext
  ): WorkflowState | null {
    const key = `${from}:${trigger}`;
    const transitions = this.transitionMap.get(key) ?? [];

    for (const transition of transitions) {
      // Check guard condition if present
      if (transition.guard && context) {
        if (!transition.guard(context)) {
          continue;
        }
      }
      return transition.to;
    }

    return null;
  }

  /**
   * Execute a transition
   */
  async transition(context: TransitionContext): Promise<WorkflowState> {
    const { fromState, trigger, taskId } = context;

    // Find valid transition
    const nextState = this.getNextState(fromState, trigger, context);

    if (!nextState) {
      throw new StateTransitionError(
        fromState,
        'UNKNOWN',
        `No valid transition from ${fromState} with trigger ${trigger}`
      );
    }

    // Validate transition is allowed
    if (!this.canTransition(fromState, nextState, trigger)) {
      throw new StateTransitionError(fromState, nextState);
    }

    log.info('State transition', {
      taskId,
      from: fromState,
      to: nextState,
      trigger,
    });

    // Execute transition action if present
    const key = `${fromState}:${trigger}`;
    const transitions = this.transitionMap.get(key) ?? [];
    const transition = transitions.find((t) => t.to === nextState);

    if (transition?.action) {
      await transition.action({ ...context, toState: nextState });
    }

    return nextState;
  }

  /**
   * Get the required agent for a state
   */
  getRequiredAgent(state: WorkflowState): AgentType | undefined {
    return STATES[state].requiresAgent;
  }

  /**
   * Check if state requires approval
   */
  requiresApproval(state: WorkflowState): boolean {
    return STATES[state].requiresApproval ?? false;
  }

  /**
   * Get state timeout
   */
  getTimeout(state: WorkflowState): number | undefined {
    return STATES[state].timeout;
  }

  /**
   * Get all states
   */
  getAllStates(): StateMetadata[] {
    return Object.values(STATES);
  }

  /**
   * Get terminal states
   */
  getTerminalStates(): WorkflowState[] {
    return Object.values(STATES)
      .filter((s) => s.isTerminal)
      .map((s) => s.state);
  }
}

// Singleton instance
let instance: StateMachine | null = null;

/**
 * Get the state machine singleton
 */
export function getStateMachine(): StateMachine {
  if (!instance) {
    instance = new StateMachine();
  }
  return instance;
}

/**
 * Reset the singleton (for testing)
 */
export function resetStateMachine(): void {
  instance = null;
}
