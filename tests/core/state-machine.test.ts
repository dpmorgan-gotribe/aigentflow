/**
 * State Machine Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  StateMachine,
  getStateMachine,
  resetStateMachine,
  STATES,
  TRANSITIONS,
} from '../../src/core/state-machine.js';
import { StateTransitionError } from '../../src/utils/errors.js';

describe('StateMachine', () => {
  let sm: StateMachine;

  beforeEach(() => {
    resetStateMachine();
    sm = getStateMachine();
  });

  describe('State Definitions', () => {
    it('should have all required states defined', () => {
      const requiredStates = [
        'IDLE',
        'ANALYZING',
        'ORCHESTRATING',
        'PLANNING',
        'BUILDING',
        'TESTING',
        'REVIEWING',
        'AGENT_WORKING',
        'AGENT_COMPLETE',
        'AWAITING_APPROVAL',
        'COMPLETED',
        'ERROR',
        'ABORTED',
      ];

      for (const state of requiredStates) {
        expect(STATES[state as keyof typeof STATES]).toBeDefined();
      }
    });

    it('should have terminal states marked correctly', () => {
      expect(sm.isTerminal('COMPLETED')).toBe(true);
      expect(sm.isTerminal('ERROR')).toBe(true);
      expect(sm.isTerminal('ABORTED')).toBe(true);
      expect(sm.isTerminal('ESCALATED')).toBe(true);

      expect(sm.isTerminal('IDLE')).toBe(false);
      expect(sm.isTerminal('ORCHESTRATING')).toBe(false);
    });

    it('should return correct allowed transitions', () => {
      const idleTransitions = sm.getAllowedTransitions('IDLE');
      expect(idleTransitions).toContain('ANALYZING');

      const orchestratingTransitions = sm.getAllowedTransitions('ORCHESTRATING');
      expect(orchestratingTransitions).toContain('PLANNING');
      expect(orchestratingTransitions).toContain('BUILDING');
      expect(orchestratingTransitions).toContain('AWAITING_APPROVAL');
    });
  });

  describe('Transition Validation', () => {
    it('should allow valid transitions', () => {
      expect(sm.canTransition('IDLE', 'ANALYZING', 'START')).toBe(true);
      expect(sm.canTransition('ANALYZING', 'ORCHESTRATING', 'AGENT_COMPLETE')).toBe(true);
      expect(sm.canTransition('AGENT_WORKING', 'AGENT_COMPLETE', 'AGENT_COMPLETE')).toBe(true);
    });

    it('should reject invalid transitions', () => {
      expect(sm.canTransition('IDLE', 'COMPLETED', 'START')).toBe(false);
      expect(sm.canTransition('COMPLETED', 'IDLE', 'START')).toBe(false);
    });

    it('should allow abort from non-terminal states', () => {
      expect(sm.canTransition('ANALYZING', 'ABORTED', 'ABORT')).toBe(true);
      expect(sm.canTransition('ORCHESTRATING', 'ABORTED', 'ABORT')).toBe(true);
      expect(sm.canTransition('BUILDING', 'ABORTED', 'ABORT')).toBe(true);
    });
  });

  describe('Transition Execution', () => {
    it('should execute valid transition', async () => {
      const newState = await sm.transition({
        taskId: 'test-task',
        fromState: 'IDLE',
        toState: 'ANALYZING',
        trigger: 'START',
      });

      expect(newState).toBe('ANALYZING');
    });

    it('should throw on invalid transition', async () => {
      await expect(
        sm.transition({
          taskId: 'test-task',
          fromState: 'IDLE',
          toState: 'COMPLETED',
          trigger: 'COMPLETE',
        })
      ).rejects.toThrow(StateTransitionError);
    });

    it('should get next state for trigger', () => {
      expect(sm.getNextState('IDLE', 'START')).toBe('ANALYZING');
      expect(sm.getNextState('ANALYZING', 'AGENT_COMPLETE')).toBe('ORCHESTRATING');
      expect(sm.getNextState('AGENT_WORKING', 'AGENT_COMPLETE')).toBe('AGENT_COMPLETE');
    });
  });

  describe('State Metadata', () => {
    it('should return state metadata', () => {
      const idleMeta = sm.getState('IDLE');
      expect(idleMeta.state).toBe('IDLE');
      expect(idleMeta.isTerminal).toBe(false);
      expect(idleMeta.allowedTransitions).toContain('ANALYZING');
    });

    it('should return required agent for state', () => {
      expect(sm.getRequiredAgent('ORCHESTRATING')).toBe('orchestrator');
      expect(sm.getRequiredAgent('PLANNING')).toBe('project-manager');
      expect(sm.getRequiredAgent('IDLE')).toBeUndefined();
    });

    it('should check if state requires approval', () => {
      expect(sm.requiresApproval('AWAITING_APPROVAL')).toBe(true);
      expect(sm.requiresApproval('ORCHESTRATING')).toBe(false);
    });

    it('should return state timeout', () => {
      expect(sm.getTimeout('ANALYZING')).toBe(30000);
      expect(sm.getTimeout('AGENT_WORKING')).toBe(120000);
      expect(sm.getTimeout('IDLE')).toBeUndefined();
    });
  });

  describe('State Collections', () => {
    it('should get all states', () => {
      const allStates = sm.getAllStates();
      expect(allStates.length).toBeGreaterThan(10);
    });

    it('should get terminal states', () => {
      const terminalStates = sm.getTerminalStates();
      expect(terminalStates).toContain('COMPLETED');
      expect(terminalStates).toContain('ERROR');
      expect(terminalStates).toContain('ABORTED');
      expect(terminalStates).not.toContain('IDLE');
    });
  });
});
