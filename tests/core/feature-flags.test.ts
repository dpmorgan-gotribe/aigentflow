/**
 * Feature Flags Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  FeatureFlagManager,
  getFeatureFlags,
  resetFeatureFlags,
  isFeatureEnabled,
  requireFeature,
} from '../../src/core/feature-flags.js';
import { FeatureDisabledError } from '../../src/utils/errors.js';

describe('FeatureFlagManager', () => {
  beforeEach(() => {
    resetFeatureFlags();
  });

  it('should create manager with default flags', () => {
    const manager = new FeatureFlagManager();
    expect(manager.getAllFlags().length).toBeGreaterThan(0);
  });

  it('should check if MVP features are enabled', () => {
    const manager = getFeatureFlags();
    expect(manager.isEnabled('core.stateMachine')).toBe(true);
    expect(manager.isEnabled('core.persistence')).toBe(true);
    expect(manager.isEnabled('agents.orchestrator')).toBe(true);
  });

  it('should check if non-MVP features are disabled', () => {
    const manager = getFeatureFlags();
    expect(manager.isEnabled('features.selfEvolution')).toBe(false);
    expect(manager.isEnabled('features.multiTenant')).toBe(false);
    expect(manager.isEnabled('agents.uiDesigner')).toBe(false);
  });

  it('should return false for unknown flags', () => {
    const manager = getFeatureFlags();
    expect(manager.isEnabled('unknown.flag')).toBe(false);
  });

  it('should allow setting overrides', () => {
    const manager = getFeatureFlags();
    expect(manager.isEnabled('features.selfEvolution')).toBe(false);

    manager.setOverride('features.selfEvolution', true);
    expect(manager.isEnabled('features.selfEvolution')).toBe(true);

    manager.clearOverride('features.selfEvolution');
    expect(manager.isEnabled('features.selfEvolution')).toBe(false);
  });

  it('should throw when requiring disabled feature', () => {
    const manager = getFeatureFlags();
    expect(() => manager.require('features.selfEvolution')).toThrow(FeatureDisabledError);
  });

  it('should not throw when requiring enabled feature', () => {
    const manager = getFeatureFlags();
    expect(() => manager.require('core.stateMachine')).not.toThrow();
  });

  it('should get flags by phase', () => {
    const manager = getFeatureFlags();
    const mvpFlags = manager.getFlagsByPhase('mvp');
    expect(mvpFlags.length).toBeGreaterThan(0);
    expect(mvpFlags.every((f) => f.phase === 'mvp')).toBe(true);
  });

  it('should get enabled flags', () => {
    const manager = getFeatureFlags();
    const enabledFlags = manager.getEnabledFlags();
    expect(enabledFlags.every((f) => f.enabled)).toBe(true);
  });

  it('should update flag definition', () => {
    const manager = getFeatureFlags();
    const originalFlag = manager.getFlag('features.selfEvolution');
    expect(originalFlag?.enabled).toBe(false);

    manager.updateFlag('features.selfEvolution', { enabled: true });
    expect(manager.isEnabled('features.selfEvolution')).toBe(true);
  });
});

describe('Convenience functions', () => {
  beforeEach(() => {
    resetFeatureFlags();
  });

  it('isFeatureEnabled should work', () => {
    expect(isFeatureEnabled('core.stateMachine')).toBe(true);
    expect(isFeatureEnabled('features.selfEvolution')).toBe(false);
  });

  it('requireFeature should work', () => {
    expect(() => requireFeature('core.stateMachine')).not.toThrow();
    expect(() => requireFeature('features.selfEvolution')).toThrow(FeatureDisabledError);
  });
});
