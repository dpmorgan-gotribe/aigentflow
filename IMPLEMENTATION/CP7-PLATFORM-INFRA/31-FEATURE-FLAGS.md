# Step 31: Feature Flags

> **Checkpoint:** CP7 - Platform Infrastructure
> **Previous Step:** 30-MULTI-TENANT.md
> **Next Step:** 32-GENUI-OUTPUT.md

---

## Overview

Feature Flags enable controlled rollout of new features, A/B testing, and instant kill switches. This supports safe deployment of experimental functionality and gradual exposure to user base.

Key responsibilities:
- Feature flag definition and management
- Gradual rollout (percentage-based)
- Targeting rules (tenant, user, environment)
- A/B testing support
- Kill switches for instant disable
- Flag evaluation with caching

---

## Deliverables

1. `src/platform/flags/flag-manager.ts` - Flag management
2. `src/platform/flags/evaluator.ts` - Flag evaluation
3. `src/platform/flags/targeting.ts` - Targeting rules
4. `src/platform/flags/experiments.ts` - A/B testing
5. `orchestrator-data/system/flags/` - Flag configurations

---

## 1. Feature Flag Schema

### 1.1 Flag Definition

```typescript
/**
 * Feature Flag Schema
 */

import { z } from 'zod';

export const FeatureFlagSchema = z.object({
  key: z.string(), // Unique identifier: 'self-evolution-v2'
  name: z.string(),
  description: z.string(),

  // Flag type
  type: z.enum([
    'boolean',    // Simple on/off
    'string',     // String variants
    'number',     // Numeric values
    'json',       // Complex configuration
  ]),

  // Default value when flag is off or no rules match
  defaultValue: z.unknown(),

  // Enabled state
  enabled: z.boolean(),

  // Targeting rules (evaluated in order)
  rules: z.array(z.object({
    id: z.string(),
    description: z.string().optional(),
    conditions: z.array(z.object({
      attribute: z.string(), // 'tenant.type', 'user.id', 'env'
      operator: z.enum([
        'equals', 'not_equals',
        'contains', 'not_contains',
        'in', 'not_in',
        'gt', 'lt', 'gte', 'lte',
        'regex',
        'semver_gt', 'semver_lt',
      ]),
      value: z.unknown(),
    })),
    percentage: z.number().min(0).max(100).optional(),
    value: z.unknown(),
  })),

  // Fallthrough value when enabled but no rules match
  fallthrough: z.object({
    percentage: z.number().min(0).max(100).optional(),
    value: z.unknown(),
  }).optional(),

  // Variants for A/B testing
  variants: z.array(z.object({
    key: z.string(),
    name: z.string(),
    value: z.unknown(),
    weight: z.number(), // Percentage weight
  })).optional(),

  // Metadata
  tags: z.array(z.string()),
  owner: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),

  // Kill switch
  killSwitch: z.boolean().default(false), // If true, always returns default

  // Environment overrides
  environments: z.record(z.object({
    enabled: z.boolean(),
    value: z.unknown().optional(),
  })).optional(),
});

export type FeatureFlag = z.infer<typeof FeatureFlagSchema>;
```

### 1.2 Flag Manager

```typescript
/**
 * Flag Manager
 *
 * Manages feature flag lifecycle.
 */

export class FlagManager {
  private flags: Map<string, FeatureFlag> = new Map();
  private cache: Map<string, { value: unknown; expiry: number }> = new Map();

  constructor(
    private db: Database,
    private config: { cacheMs: number; environment: string }
  ) {}

  /**
   * Initialize flags from database
   */
  async initialize(): Promise<void> {
    const rows = await this.db.all('SELECT * FROM feature_flags');
    for (const row of rows) {
      const flag = this.rowToFlag(row);
      this.flags.set(flag.key, flag);
    }
  }

  /**
   * Create new flag
   */
  async createFlag(flag: Omit<FeatureFlag, 'createdAt' | 'updatedAt'>): Promise<FeatureFlag> {
    const newFlag: FeatureFlag = {
      ...flag,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await this.db.run(
      `INSERT INTO feature_flags (key, name, description, type, default_value,
       enabled, rules, tags, owner, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [newFlag.key, newFlag.name, newFlag.description, newFlag.type,
       JSON.stringify(newFlag.defaultValue), newFlag.enabled,
       JSON.stringify(newFlag.rules), JSON.stringify(newFlag.tags),
       newFlag.owner, newFlag.createdAt.toISOString(),
       newFlag.updatedAt.toISOString()]
    );

    this.flags.set(newFlag.key, newFlag);
    return newFlag;
  }

  /**
   * Update flag
   */
  async updateFlag(
    key: string,
    updates: Partial<FeatureFlag>
  ): Promise<FeatureFlag> {
    const existing = this.flags.get(key);
    if (!existing) throw new Error(`Flag not found: ${key}`);

    const updated: FeatureFlag = {
      ...existing,
      ...updates,
      updatedAt: new Date(),
    };

    await this.db.run(
      `UPDATE feature_flags SET
       name = ?, description = ?, enabled = ?, rules = ?,
       default_value = ?, kill_switch = ?, updated_at = ?
       WHERE key = ?`,
      [updated.name, updated.description, updated.enabled,
       JSON.stringify(updated.rules), JSON.stringify(updated.defaultValue),
       updated.killSwitch, updated.updatedAt.toISOString(), key]
    );

    this.flags.set(key, updated);
    this.clearCache(key);

    return updated;
  }

  /**
   * Toggle flag (quick enable/disable)
   */
  async toggleFlag(key: string, enabled: boolean): Promise<void> {
    await this.updateFlag(key, { enabled });
  }

  /**
   * Activate kill switch
   */
  async activateKillSwitch(key: string): Promise<void> {
    await this.updateFlag(key, { killSwitch: true, enabled: false });
    console.log(`Kill switch activated for flag: ${key}`);
  }

  /**
   * Get flag
   */
  getFlag(key: string): FeatureFlag | undefined {
    return this.flags.get(key);
  }

  /**
   * Get all flags
   */
  getAllFlags(): FeatureFlag[] {
    return Array.from(this.flags.values());
  }

  /**
   * Get flags by tag
   */
  getFlagsByTag(tag: string): FeatureFlag[] {
    return this.getAllFlags().filter(f => f.tags.includes(tag));
  }

  private clearCache(key: string): void {
    for (const [cacheKey] of this.cache) {
      if (cacheKey.startsWith(`${key}:`)) {
        this.cache.delete(cacheKey);
      }
    }
  }

  private rowToFlag(row: any): FeatureFlag {
    return {
      key: row.key,
      name: row.name,
      description: row.description,
      type: row.type,
      defaultValue: JSON.parse(row.default_value),
      enabled: row.enabled,
      rules: JSON.parse(row.rules || '[]'),
      fallthrough: row.fallthrough ? JSON.parse(row.fallthrough) : undefined,
      variants: row.variants ? JSON.parse(row.variants) : undefined,
      tags: JSON.parse(row.tags || '[]'),
      owner: row.owner,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      killSwitch: row.kill_switch,
      environments: row.environments ? JSON.parse(row.environments) : undefined,
    };
  }
}
```

---

## 2. Flag Evaluator

### 2.1 Evaluation Context

```typescript
/**
 * Evaluation Context
 */

export interface EvaluationContext {
  tenant?: {
    id: string;
    type: string;
    slug: string;
  };
  user?: {
    id: string;
    email: string;
    role: string;
  };
  environment: string;
  attributes?: Record<string, unknown>;
}
```

### 2.2 Flag Evaluator

```typescript
/**
 * Flag Evaluator
 *
 * Evaluates feature flags for given context.
 */

import { createHash } from 'crypto';

export class FlagEvaluator {
  constructor(
    private flagManager: FlagManager,
    private environment: string
  ) {}

  /**
   * Evaluate flag for context
   */
  evaluate<T = unknown>(key: string, context: EvaluationContext): T {
    const flag = this.flagManager.getFlag(key);
    if (!flag) {
      console.warn(`Flag not found: ${key}`);
      return undefined as T;
    }

    // Check kill switch
    if (flag.killSwitch) {
      return flag.defaultValue as T;
    }

    // Check environment override
    if (flag.environments?.[this.environment]) {
      const envOverride = flag.environments[this.environment];
      if (!envOverride.enabled) {
        return flag.defaultValue as T;
      }
      if (envOverride.value !== undefined) {
        return envOverride.value as T;
      }
    }

    // Check if globally enabled
    if (!flag.enabled) {
      return flag.defaultValue as T;
    }

    // Evaluate rules in order
    for (const rule of flag.rules) {
      if (this.evaluateRule(rule, context)) {
        // Check percentage rollout
        if (rule.percentage !== undefined) {
          if (!this.isInPercentage(key, context, rule.percentage)) {
            continue;
          }
        }
        return rule.value as T;
      }
    }

    // Check variants (A/B testing)
    if (flag.variants && flag.variants.length > 0) {
      return this.selectVariant(key, context, flag.variants) as T;
    }

    // Fallthrough
    if (flag.fallthrough) {
      if (flag.fallthrough.percentage !== undefined) {
        if (this.isInPercentage(key, context, flag.fallthrough.percentage)) {
          return flag.fallthrough.value as T;
        }
      } else {
        return flag.fallthrough.value as T;
      }
    }

    return flag.defaultValue as T;
  }

  /**
   * Check if flag is enabled (boolean shorthand)
   */
  isEnabled(key: string, context: EvaluationContext): boolean {
    return this.evaluate<boolean>(key, context) === true;
  }

  /**
   * Get string variant
   */
  getString(key: string, context: EvaluationContext, defaultValue: string = ''): string {
    const value = this.evaluate<string>(key, context);
    return typeof value === 'string' ? value : defaultValue;
  }

  /**
   * Get number value
   */
  getNumber(key: string, context: EvaluationContext, defaultValue: number = 0): number {
    const value = this.evaluate<number>(key, context);
    return typeof value === 'number' ? value : defaultValue;
  }

  /**
   * Evaluate single rule
   */
  private evaluateRule(
    rule: FeatureFlag['rules'][0],
    context: EvaluationContext
  ): boolean {
    return rule.conditions.every(condition =>
      this.evaluateCondition(condition, context)
    );
  }

  /**
   * Evaluate single condition
   */
  private evaluateCondition(
    condition: FeatureFlag['rules'][0]['conditions'][0],
    context: EvaluationContext
  ): boolean {
    const value = this.getAttributeValue(condition.attribute, context);

    switch (condition.operator) {
      case 'equals':
        return value === condition.value;
      case 'not_equals':
        return value !== condition.value;
      case 'contains':
        return String(value).includes(String(condition.value));
      case 'not_contains':
        return !String(value).includes(String(condition.value));
      case 'in':
        return (condition.value as unknown[]).includes(value);
      case 'not_in':
        return !(condition.value as unknown[]).includes(value);
      case 'gt':
        return Number(value) > Number(condition.value);
      case 'lt':
        return Number(value) < Number(condition.value);
      case 'gte':
        return Number(value) >= Number(condition.value);
      case 'lte':
        return Number(value) <= Number(condition.value);
      case 'regex':
        return new RegExp(String(condition.value)).test(String(value));
      default:
        return false;
    }
  }

  /**
   * Get attribute value from context
   */
  private getAttributeValue(
    attribute: string,
    context: EvaluationContext
  ): unknown {
    const parts = attribute.split('.');
    let value: unknown = context;

    for (const part of parts) {
      if (value === null || value === undefined) return undefined;
      value = (value as Record<string, unknown>)[part];
    }

    return value;
  }

  /**
   * Check if context is in percentage bucket
   */
  private isInPercentage(
    flagKey: string,
    context: EvaluationContext,
    percentage: number
  ): boolean {
    const bucketKey = context.user?.id || context.tenant?.id || 'anonymous';
    const hash = this.hashKey(`${flagKey}:${bucketKey}`);
    const bucket = hash % 100;
    return bucket < percentage;
  }

  /**
   * Select variant based on weights
   */
  private selectVariant(
    flagKey: string,
    context: EvaluationContext,
    variants: NonNullable<FeatureFlag['variants']>
  ): unknown {
    const bucketKey = context.user?.id || context.tenant?.id || 'anonymous';
    const hash = this.hashKey(`${flagKey}:${bucketKey}:variant`);
    const bucket = hash % 100;

    let cumulative = 0;
    for (const variant of variants) {
      cumulative += variant.weight;
      if (bucket < cumulative) {
        return variant.value;
      }
    }

    return variants[0]?.value;
  }

  /**
   * Hash string to number
   */
  private hashKey(key: string): number {
    const hash = createHash('md5').update(key).digest('hex');
    return parseInt(hash.slice(0, 8), 16);
  }
}
```

---

## 3. Experiments (A/B Testing)

### 3.1 Experiment Schema

```typescript
/**
 * Experiment Schema
 */

export const ExperimentSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  flagKey: z.string(), // Associated feature flag

  // Variants
  control: z.object({
    key: z.string(),
    name: z.string(),
  }),
  treatment: z.array(z.object({
    key: z.string(),
    name: z.string(),
    weight: z.number(),
  })),

  // Metrics
  primaryMetric: z.string(),
  secondaryMetrics: z.array(z.string()).optional(),

  // Status
  status: z.enum(['draft', 'running', 'paused', 'completed', 'cancelled']),
  startDate: z.date().optional(),
  endDate: z.date().optional(),

  // Results
  results: z.object({
    sampleSize: z.number(),
    controlConversion: z.number(),
    treatmentConversions: z.record(z.number()),
    statisticalSignificance: z.number(),
    winner: z.string().optional(),
  }).optional(),
});

export type Experiment = z.infer<typeof ExperimentSchema>;
```

### 3.2 Experiment Manager

```typescript
/**
 * Experiment Manager
 *
 * Manages A/B test experiments.
 */

export class ExperimentManager {
  constructor(
    private db: Database,
    private flagManager: FlagManager
  ) {}

  /**
   * Create experiment
   */
  async createExperiment(
    experiment: Omit<Experiment, 'id' | 'status' | 'results'>
  ): Promise<Experiment> {
    const exp: Experiment = {
      ...experiment,
      id: `exp_${Date.now()}`,
      status: 'draft',
    };

    // Create associated feature flag with variants
    await this.flagManager.createFlag({
      key: experiment.flagKey,
      name: experiment.name,
      description: experiment.description,
      type: 'string',
      defaultValue: experiment.control.key,
      enabled: false,
      rules: [],
      variants: [
        { key: experiment.control.key, name: experiment.control.name, value: experiment.control.key, weight: 50 },
        ...experiment.treatment.map(t => ({ ...t, value: t.key })),
      ],
      tags: ['experiment'],
      owner: 'experiment-manager',
    });

    await this.db.run(
      `INSERT INTO experiments (id, name, description, flag_key, control,
       treatment, primary_metric, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [exp.id, exp.name, exp.description, exp.flagKey,
       JSON.stringify(exp.control), JSON.stringify(exp.treatment),
       exp.primaryMetric, exp.status]
    );

    return exp;
  }

  /**
   * Start experiment
   */
  async startExperiment(experimentId: string): Promise<void> {
    const exp = await this.getExperiment(experimentId);
    if (!exp) throw new Error('Experiment not found');

    // Enable the feature flag
    await this.flagManager.toggleFlag(exp.flagKey, true);

    // Update experiment status
    await this.db.run(
      `UPDATE experiments SET status = 'running', start_date = ? WHERE id = ?`,
      [new Date().toISOString(), experimentId]
    );
  }

  /**
   * Record conversion
   */
  async recordConversion(
    experimentId: string,
    userId: string,
    variant: string,
    metric: string
  ): Promise<void> {
    await this.db.run(
      `INSERT INTO experiment_conversions (experiment_id, user_id, variant, metric, timestamp)
       VALUES (?, ?, ?, ?, ?)`,
      [experimentId, userId, variant, metric, new Date().toISOString()]
    );
  }

  /**
   * Calculate results
   */
  async calculateResults(experimentId: string): Promise<Experiment['results']> {
    const exp = await this.getExperiment(experimentId);
    if (!exp) throw new Error('Experiment not found');

    // Get sample sizes
    const samples = await this.db.all(
      `SELECT variant, COUNT(DISTINCT user_id) as count
       FROM experiment_exposures WHERE experiment_id = ?
       GROUP BY variant`,
      [experimentId]
    );

    // Get conversions
    const conversions = await this.db.all(
      `SELECT variant, COUNT(DISTINCT user_id) as count
       FROM experiment_conversions
       WHERE experiment_id = ? AND metric = ?
       GROUP BY variant`,
      [experimentId, exp.primaryMetric]
    );

    const sampleMap = Object.fromEntries(samples.map(s => [s.variant, s.count]));
    const conversionMap = Object.fromEntries(conversions.map(c => [c.variant, c.count]));

    const controlSample = sampleMap[exp.control.key] || 0;
    const controlConversions = conversionMap[exp.control.key] || 0;
    const controlRate = controlSample > 0 ? controlConversions / controlSample : 0;

    const treatmentConversions: Record<string, number> = {};
    for (const t of exp.treatment) {
      const sample = sampleMap[t.key] || 0;
      const conv = conversionMap[t.key] || 0;
      treatmentConversions[t.key] = sample > 0 ? conv / sample : 0;
    }

    // Calculate statistical significance (simplified)
    const totalSample = Object.values(sampleMap).reduce((a, b) => a + b, 0);

    return {
      sampleSize: totalSample,
      controlConversion: controlRate,
      treatmentConversions,
      statisticalSignificance: this.calculateSignificance(
        controlSample, controlConversions,
        sampleMap, conversionMap, exp.treatment
      ),
    };
  }

  private calculateSignificance(
    controlSample: number,
    controlConversions: number,
    sampleMap: Record<string, number>,
    conversionMap: Record<string, number>,
    treatments: Experiment['treatment']
  ): number {
    // Simplified significance calculation
    // In production, use proper statistical tests
    return 0.95;
  }

  private async getExperiment(id: string): Promise<Experiment | null> {
    const row = await this.db.get('SELECT * FROM experiments WHERE id = ?', [id]);
    return row ? this.rowToExperiment(row) : null;
  }

  private rowToExperiment(row: any): Experiment {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      flagKey: row.flag_key,
      control: JSON.parse(row.control),
      treatment: JSON.parse(row.treatment),
      primaryMetric: row.primary_metric,
      secondaryMetrics: row.secondary_metrics ? JSON.parse(row.secondary_metrics) : undefined,
      status: row.status,
      startDate: row.start_date ? new Date(row.start_date) : undefined,
      endDate: row.end_date ? new Date(row.end_date) : undefined,
      results: row.results ? JSON.parse(row.results) : undefined,
    };
  }
}
```

---

## 4. Predefined Flags

```yaml
# orchestrator-data/system/flags/default-flags.yaml
flags:
  - key: "self-evolution-enabled"
    name: "Self-Evolution System"
    description: "Enable the self-evolution agent generation system"
    type: "boolean"
    defaultValue: false
    enabled: true
    rules:
      - id: "enterprise-only"
        conditions:
          - attribute: "tenant.type"
            operator: "equals"
            value: "enterprise"
        value: true
    tags: ["self-evolution", "enterprise"]
    owner: "platform-team"

  - key: "parallel-agents-limit"
    name: "Parallel Agents Limit"
    description: "Maximum concurrent agents per feature"
    type: "number"
    defaultValue: 4
    enabled: true
    rules:
      - id: "enterprise-higher-limit"
        conditions:
          - attribute: "tenant.type"
            operator: "equals"
            value: "enterprise"
        value: 15
      - id: "professional-medium-limit"
        conditions:
          - attribute: "tenant.type"
            operator: "equals"
            value: "professional"
        value: 10
    tags: ["performance"]
    owner: "platform-team"

  - key: "new-orchestrator-v2"
    name: "New Orchestrator V2"
    description: "Enable new orchestrator implementation"
    type: "boolean"
    defaultValue: false
    enabled: true
    rules:
      - id: "beta-testers"
        conditions:
          - attribute: "tenant.id"
            operator: "in"
            value: ["tenant-beta-1", "tenant-beta-2"]
        value: true
    fallthrough:
      percentage: 10  # 10% rollout
      value: true
    tags: ["orchestrator", "beta"]
    owner: "core-team"

  - key: "model-provider"
    name: "Default Model Provider"
    description: "Which AI model provider to use"
    type: "string"
    defaultValue: "anthropic"
    enabled: true
    rules:
      - id: "openai-override"
        conditions:
          - attribute: "tenant.settings.preferredProvider"
            operator: "equals"
            value: "openai"
        value: "openai"
    tags: ["models"]
    owner: "platform-team"
```

---

## 5. CLI Commands

```typescript
// Feature flag CLI commands

program
  .command('flags list')
  .description('List all feature flags')
  .option('--tag <tag>', 'Filter by tag')
  .action(async (options) => {
    const flags = options.tag
      ? flagManager.getFlagsByTag(options.tag)
      : flagManager.getAllFlags();

    console.table(flags.map(f => ({
      key: f.key,
      enabled: f.enabled,
      type: f.type,
      tags: f.tags.join(', '),
    })));
  });

program
  .command('flags toggle <key>')
  .description('Toggle feature flag')
  .option('--on', 'Enable flag')
  .option('--off', 'Disable flag')
  .action(async (key, options) => {
    const enabled = options.on ? true : options.off ? false : undefined;
    if (enabled === undefined) {
      const flag = flagManager.getFlag(key);
      await flagManager.toggleFlag(key, !flag?.enabled);
    } else {
      await flagManager.toggleFlag(key, enabled);
    }
    console.log(`Flag ${key} ${enabled ? 'enabled' : 'disabled'}`);
  });

program
  .command('flags kill <key>')
  .description('Activate kill switch for flag')
  .action(async (key) => {
    await flagManager.activateKillSwitch(key);
    console.log(`Kill switch activated for ${key}`);
  });
```

---

## 6. Test Scenarios

```typescript
describe('Feature Flags', () => {
  describe('FlagEvaluator', () => {
    it('should return default value when flag disabled', () => {
      const result = evaluator.evaluate('test-flag', { environment: 'test' });
      expect(result).toBe(false); // Default value
    });

    it('should match tenant type rule', () => {
      const result = evaluator.evaluate('enterprise-feature', {
        environment: 'production',
        tenant: { id: 't1', type: 'enterprise', slug: 'acme' },
      });
      expect(result).toBe(true);
    });

    it('should apply percentage rollout consistently', () => {
      const results = new Set<boolean>();
      for (let i = 0; i < 100; i++) {
        const result = evaluator.evaluate('rollout-flag', {
          environment: 'production',
          user: { id: `user-${i}`, email: '', role: '' },
        });
        results.add(result as boolean);
      }
      // Should have both true and false results
      expect(results.size).toBe(2);
    });

    it('should activate kill switch', async () => {
      await flagManager.activateKillSwitch('test-flag');
      const result = evaluator.evaluate('test-flag', { environment: 'test' });
      expect(result).toBe(false); // Default value due to kill switch
    });
  });

  describe('ExperimentManager', () => {
    it('should create experiment with variants', async () => {
      const exp = await experimentManager.createExperiment({
        name: 'Button Color Test',
        description: 'Test button colors',
        flagKey: 'button-color-exp',
        control: { key: 'blue', name: 'Blue Button' },
        treatment: [{ key: 'green', name: 'Green Button', weight: 50 }],
        primaryMetric: 'click_rate',
      });

      expect(exp.id).toBeDefined();
      expect(exp.status).toBe('draft');
    });
  });
});
```

---

## 7. Dependencies

- Step 04: Persistence Layer (flag storage)
- Step 30: Multi-Tenant (tenant-aware flags)

---

## 8. Acceptance Criteria

- [ ] Boolean flags work correctly
- [ ] Percentage rollout distributes consistently
- [ ] Tenant/user targeting rules evaluate correctly
- [ ] Kill switch immediately disables flag
- [ ] A/B experiments track conversions
- [ ] Environment overrides work
- [ ] CLI commands function properly
- [ ] All tests pass
