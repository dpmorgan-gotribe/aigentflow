/**
 * Feature Flags System
 *
 * Feature flag evaluation with targeting rules.
 */

import type { FeatureFlag, FlagContext } from '../types.js';
import { MVP_FLAGS } from '../config/mvp-flags.js';
import { FeatureDisabledError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';

const log = logger.child({ component: 'feature-flags' });

/**
 * Targeting rule for feature flags
 */
interface TargetingRule {
  attribute: string;
  operator: 'eq' | 'neq' | 'contains' | 'in' | 'percentage';
  value: unknown;
}

/**
 * Feature flag with targeting
 */
interface TargetedFlag extends FeatureFlag {
  targeting?: TargetingRule[];
  percentage?: number;
}

/**
 * Feature flag manager
 */
export class FeatureFlagManager {
  private flags: Map<string, TargetedFlag>;
  private overrides: Map<string, boolean>;

  constructor(initialFlags: Record<string, FeatureFlag> = MVP_FLAGS) {
    this.flags = new Map();
    this.overrides = new Map();

    // Initialize with default flags
    for (const [key, flag] of Object.entries(initialFlags)) {
      this.flags.set(key, flag as TargetedFlag);
    }

    log.debug('Feature flags initialized', { count: this.flags.size });
  }

  /**
   * Check if a feature is enabled
   */
  isEnabled(key: string, context?: FlagContext): boolean {
    // Check overrides first
    const override = this.overrides.get(key);
    if (override !== undefined) {
      return override;
    }

    const flag = this.flags.get(key);
    if (!flag) {
      log.warn('Unknown feature flag', { key });
      return false;
    }

    // Simple enabled check
    if (!flag.enabled) {
      return false;
    }

    // If no context or targeting rules, return base enabled status
    if (!context || !flag.targeting || flag.targeting.length === 0) {
      return flag.enabled;
    }

    // Evaluate targeting rules
    return this.evaluateTargeting(flag, context);
  }

  /**
   * Require a feature to be enabled (throws if disabled)
   */
  require(key: string, context?: FlagContext): void {
    if (!this.isEnabled(key, context)) {
      const flag = this.flags.get(key);
      throw new FeatureDisabledError(key, flag?.phase ?? 'unknown');
    }
  }

  /**
   * Get a feature flag definition
   */
  getFlag(key: string): TargetedFlag | undefined {
    return this.flags.get(key);
  }

  /**
   * Get all flags
   */
  getAllFlags(): TargetedFlag[] {
    return Array.from(this.flags.values());
  }

  /**
   * Get flags by phase
   */
  getFlagsByPhase(phase: string): TargetedFlag[] {
    return Array.from(this.flags.values()).filter((f) => f.phase === phase);
  }

  /**
   * Get enabled flags
   */
  getEnabledFlags(context?: FlagContext): TargetedFlag[] {
    return Array.from(this.flags.values()).filter((f) => this.isEnabled(f.key, context));
  }

  /**
   * Set a runtime override
   */
  setOverride(key: string, enabled: boolean): void {
    this.overrides.set(key, enabled);
    log.info('Feature flag override set', { key, enabled });
  }

  /**
   * Clear a runtime override
   */
  clearOverride(key: string): void {
    this.overrides.delete(key);
    log.info('Feature flag override cleared', { key });
  }

  /**
   * Clear all overrides
   */
  clearAllOverrides(): void {
    this.overrides.clear();
    log.info('All feature flag overrides cleared');
  }

  /**
   * Update a flag's definition
   */
  updateFlag(key: string, updates: Partial<TargetedFlag>): void {
    const existing = this.flags.get(key);
    if (existing) {
      this.flags.set(key, { ...existing, ...updates });
      log.info('Feature flag updated', { key, updates });
    }
  }

  /**
   * Add a new flag
   */
  addFlag(flag: TargetedFlag): void {
    this.flags.set(flag.key, flag);
    log.info('Feature flag added', { key: flag.key });
  }

  /**
   * Evaluate targeting rules
   */
  private evaluateTargeting(flag: TargetedFlag, context: FlagContext): boolean {
    if (!flag.targeting || flag.targeting.length === 0) {
      return flag.enabled;
    }

    // All rules must pass (AND logic)
    for (const rule of flag.targeting) {
      if (!this.evaluateRule(rule, context)) {
        return false;
      }
    }

    // Check percentage rollout
    if (flag.percentage !== undefined && flag.percentage < 100) {
      return this.evaluatePercentage(flag.key, context, flag.percentage);
    }

    return true;
  }

  /**
   * Evaluate a single targeting rule
   */
  private evaluateRule(rule: TargetingRule, context: FlagContext): boolean {
    const value = this.getContextValue(rule.attribute, context);

    switch (rule.operator) {
      case 'eq':
        return value === rule.value;

      case 'neq':
        return value !== rule.value;

      case 'contains':
        return typeof value === 'string' && value.includes(String(rule.value));

      case 'in':
        return Array.isArray(rule.value) && rule.value.includes(value);

      case 'percentage':
        return this.evaluatePercentage(
          rule.attribute,
          context,
          typeof rule.value === 'number' ? rule.value : 0
        );

      default:
        return false;
    }
  }

  /**
   * Get a value from the context
   */
  private getContextValue(attribute: string, context: FlagContext): unknown {
    switch (attribute) {
      case 'userId':
        return context.userId;
      case 'projectId':
        return context.projectId;
      case 'environment':
        return context.environment;
      default:
        return context.attributes?.[attribute];
    }
  }

  /**
   * Evaluate percentage-based rollout
   */
  private evaluatePercentage(key: string, context: FlagContext, percentage: number): boolean {
    // Use userId or projectId for consistent bucketing
    const bucketKey = context.userId ?? context.projectId ?? 'default';
    const hash = this.simpleHash(`${key}:${bucketKey}`);
    const bucket = hash % 100;
    return bucket < percentage;
  }

  /**
   * Simple string hash for bucketing
   */
  private simpleHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }
}

// Singleton instance
let instance: FeatureFlagManager | null = null;

/**
 * Get the feature flag manager singleton
 */
export function getFeatureFlags(): FeatureFlagManager {
  if (!instance) {
    instance = new FeatureFlagManager();
  }
  return instance;
}

/**
 * Reset the singleton (for testing)
 */
export function resetFeatureFlags(): void {
  instance = null;
}

// Convenience functions
export const isFeatureEnabled = (key: string, context?: FlagContext): boolean =>
  getFeatureFlags().isEnabled(key, context);

export const requireFeature = (key: string, context?: FlagContext): void =>
  getFeatureFlags().require(key, context);

/**
 * Set a feature flag value (for emergency procedures)
 */
export function setFeatureFlag(key: string, enabled: boolean): void {
  getFeatureFlags().setOverride(key, enabled);
}

/**
 * Set a flag override (alias for setFeatureFlag)
 */
export const setFlagOverride = setFeatureFlag;
