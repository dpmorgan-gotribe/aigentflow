/**
 * Error Classes Tests
 */

import { describe, it, expect } from 'vitest';
import {
  AigentflowError,
  ConfigError,
  DatabaseError,
  StateTransitionError,
  AgentError,
  ValidationError,
  FeatureDisabledError,
  isAigentflowError,
  wrapError,
} from '../../src/utils/errors.js';

describe('Error Classes', () => {
  describe('AigentflowError', () => {
    it('should create error with code and context', () => {
      const error = new AigentflowError('Test error', 'TEST_ERROR', { foo: 'bar' });
      expect(error.message).toBe('Test error');
      expect(error.code).toBe('TEST_ERROR');
      expect(error.context).toEqual({ foo: 'bar' });
      expect(error.timestamp).toBeDefined();
    });

    it('should convert to JSON', () => {
      const error = new AigentflowError('Test error', 'TEST_ERROR');
      const json = error.toJSON();
      expect(json.name).toBe('AigentflowError');
      expect(json.code).toBe('TEST_ERROR');
      expect(json.message).toBe('Test error');
    });
  });

  describe('ConfigError', () => {
    it('should create config error', () => {
      const error = new ConfigError('Config not found');
      expect(error.name).toBe('ConfigError');
      expect(error.code).toBe('CONFIG_ERROR');
    });
  });

  describe('DatabaseError', () => {
    it('should create database error', () => {
      const error = new DatabaseError('Connection failed', { host: 'localhost' });
      expect(error.name).toBe('DatabaseError');
      expect(error.code).toBe('DATABASE_ERROR');
      expect(error.context).toEqual({ host: 'localhost' });
    });
  });

  describe('StateTransitionError', () => {
    it('should create state transition error', () => {
      const error = new StateTransitionError('IDLE', 'BUILDING');
      expect(error.name).toBe('StateTransitionError');
      expect(error.fromState).toBe('IDLE');
      expect(error.toState).toBe('BUILDING');
      expect(error.message).toContain('IDLE');
      expect(error.message).toContain('BUILDING');
    });
  });

  describe('AgentError', () => {
    it('should create agent error', () => {
      const error = new AgentError('orchestrator', 'Agent failed');
      expect(error.name).toBe('AgentError');
      expect(error.agentType).toBe('orchestrator');
    });
  });

  describe('ValidationError', () => {
    it('should create validation error with field info', () => {
      const error = new ValidationError('Invalid value', 'email', 'not-an-email');
      expect(error.name).toBe('ValidationError');
      expect(error.field).toBe('email');
      expect(error.value).toBe('not-an-email');
    });
  });

  describe('FeatureDisabledError', () => {
    it('should create feature disabled error', () => {
      const error = new FeatureDisabledError('selfEvolution', 'v2');
      expect(error.name).toBe('FeatureDisabledError');
      expect(error.feature).toBe('selfEvolution');
      expect(error.phase).toBe('v2');
    });
  });

  describe('isAigentflowError', () => {
    it('should return true for AigentflowError', () => {
      expect(isAigentflowError(new AigentflowError('test', 'TEST'))).toBe(true);
      expect(isAigentflowError(new ConfigError('test'))).toBe(true);
    });

    it('should return false for other errors', () => {
      expect(isAigentflowError(new Error('test'))).toBe(false);
      expect(isAigentflowError('not an error')).toBe(false);
    });
  });

  describe('wrapError', () => {
    it('should return same error if already AigentflowError', () => {
      const original = new ConfigError('test');
      const wrapped = wrapError(original);
      expect(wrapped).toBe(original);
    });

    it('should wrap regular Error', () => {
      const original = new Error('test');
      const wrapped = wrapError(original);
      expect(wrapped).toBeInstanceOf(AigentflowError);
      expect(wrapped.message).toBe('test');
    });

    it('should wrap string', () => {
      const wrapped = wrapError('test error');
      expect(wrapped).toBeInstanceOf(AigentflowError);
      expect(wrapped.message).toBe('test error');
    });
  });
});
