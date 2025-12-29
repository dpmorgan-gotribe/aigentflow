/**
 * Compliance Engine
 *
 * Evaluates compliance rules against code and configurations.
 */

import { logger } from '../utils/logger.js';
import type {
  ComplianceRule,
  ComplianceContext,
  ComplianceViolation,
  ComplianceCheckResult,
  ComplianceEngineConfig,
  ComplianceFramework,
  ComplianceFrameworkId,
  ComplianceEvent,
  RuleTrigger,
  ViolationSeverity,
} from './types.js';
import { DEFAULT_ENGINE_CONFIG } from './types.js';
import { platformFramework } from './rules/platform.js';
import { gdprFramework } from './rules/gdpr.js';
import { soc2Framework } from './rules/soc2.js';

const log = logger.child({ component: 'compliance-engine' });

/**
 * Compliance Engine class
 */
export class ComplianceEngine {
  private config: ComplianceEngineConfig;
  private frameworks: Map<ComplianceFrameworkId, ComplianceFramework>;
  private eventListeners: Array<(event: ComplianceEvent) => void> = [];

  constructor(config: Partial<ComplianceEngineConfig> = {}) {
    this.config = { ...DEFAULT_ENGINE_CONFIG, ...config };
    this.frameworks = new Map();

    // Register built-in frameworks
    this.registerFramework(platformFramework);
    this.registerFramework(gdprFramework);
    this.registerFramework(soc2Framework);
  }

  /**
   * Register a compliance framework
   */
  registerFramework(framework: ComplianceFramework): void {
    this.frameworks.set(framework.id, framework);
    log.info('Registered compliance framework', {
      id: framework.id,
      ruleCount: framework.rules.length,
    });
  }

  /**
   * Get a registered framework
   */
  getFramework(id: ComplianceFrameworkId): ComplianceFramework | undefined {
    return this.frameworks.get(id);
  }

  /**
   * Get all registered frameworks
   */
  getAllFrameworks(): ComplianceFramework[] {
    return Array.from(this.frameworks.values());
  }

  /**
   * Enable a framework
   */
  enableFramework(id: ComplianceFrameworkId): boolean {
    const framework = this.frameworks.get(id);
    if (!framework) {
      log.warn('Framework not found', { id });
      return false;
    }

    if (!this.config.enabledFrameworks.includes(id)) {
      this.config.enabledFrameworks.push(id);
      this.emit({ type: 'framework:enabled', timestamp: new Date().toISOString(), data: { id } });
    }

    return true;
  }

  /**
   * Disable a framework
   */
  disableFramework(id: ComplianceFrameworkId): boolean {
    const framework = this.frameworks.get(id);
    if (!framework) {
      log.warn('Framework not found', { id });
      return false;
    }

    // Cannot disable mandatory frameworks
    if (framework.mandatory) {
      log.warn('Cannot disable mandatory framework', { id });
      return false;
    }

    const index = this.config.enabledFrameworks.indexOf(id);
    if (index > -1) {
      this.config.enabledFrameworks.splice(index, 1);
      this.emit({ type: 'framework:disabled', timestamp: new Date().toISOString(), data: { id } });
    }

    return true;
  }

  /**
   * Check compliance for a given context
   */
  check(context: ComplianceContext, trigger: RuleTrigger = 'always'): ComplianceCheckResult {
    const startTime = Date.now();
    const violations: ComplianceViolation[] = [];
    let rulesChecked = 0;
    let rulesPassed = 0;

    log.info('Starting compliance check', {
      trigger,
      filePath: context.filePath,
      frameworks: this.config.enabledFrameworks,
    });

    this.emit({
      type: 'check:started',
      timestamp: new Date().toISOString(),
      data: { trigger, filePath: context.filePath },
    });

    // Get rules from enabled frameworks
    const rules = this.getEnabledRules(trigger);

    for (const rule of rules) {
      if (violations.length >= this.config.maxViolations) {
        log.warn('Max violations reached, stopping check');
        break;
      }

      try {
        rulesChecked++;
        const ruleViolations = rule.check(context);

        if (ruleViolations.length > 0) {
          for (const violation of ruleViolations) {
            violations.push(violation);
            this.emit({
              type: 'violation:found',
              timestamp: new Date().toISOString(),
              data: { ruleId: violation.ruleId, severity: violation.severity },
            });
          }
        } else {
          rulesPassed++;
        }
      } catch (error) {
        log.error('Rule check failed', {
          ruleId: rule.id,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    // Calculate score
    const score = this.calculateScore(violations, rulesChecked);

    // Determine pass/fail
    const passed = this.determinePassFail(violations, score);

    // Build severity counts
    const bySeverity = this.countBySeverity(violations);
    const byFramework = this.countByFramework(violations);

    const result: ComplianceCheckResult = {
      passed,
      score,
      violations,
      bySeverity,
      byFramework,
      rulesChecked,
      rulesPassed,
      timestamp: new Date().toISOString(),
      duration: Date.now() - startTime,
    };

    log.info('Compliance check completed', {
      passed,
      score,
      violationCount: violations.length,
      duration: result.duration,
    });

    this.emit({
      type: 'check:completed',
      timestamp: new Date().toISOString(),
      data: { passed, score, violationCount: violations.length },
    });

    return result;
  }

  /**
   * Check a specific file
   */
  checkFile(filePath: string, content: string, trigger: RuleTrigger = 'file-write'): ComplianceCheckResult {
    return this.check({ filePath, content }, trigger);
  }

  /**
   * Check generated code
   */
  checkGeneratedCode(generatedCode: string, context?: Partial<ComplianceContext>): ComplianceCheckResult {
    return this.check({ ...context, generatedCode }, 'code-generation');
  }

  /**
   * Attempt to fix violations
   */
  fix(violations: ComplianceViolation[], context: ComplianceContext): {
    fixed: ComplianceViolation[];
    failed: ComplianceViolation[];
  } {
    const fixed: ComplianceViolation[] = [];
    const failed: ComplianceViolation[] = [];

    if (!this.config.autoFix) {
      log.info('Auto-fix disabled');
      return { fixed, failed: violations.filter((v) => v.autoFixable) };
    }

    for (const violation of violations) {
      if (!violation.autoFixable) {
        continue;
      }

      const rule = this.findRule(violation.ruleId);
      if (!rule?.fix) {
        failed.push(violation);
        continue;
      }

      try {
        const result = rule.fix(violation, context);
        if (result.success) {
          fixed.push(violation);
          this.emit({
            type: 'violation:fixed',
            timestamp: new Date().toISOString(),
            data: { ruleId: violation.ruleId, description: result.description },
          });
        } else {
          failed.push(violation);
        }
      } catch (error) {
        log.error('Fix failed', {
          ruleId: violation.ruleId,
          error: error instanceof Error ? error.message : String(error),
        });
        failed.push(violation);
      }
    }

    return { fixed, failed };
  }

  /**
   * Get rules from enabled frameworks that match the trigger
   */
  private getEnabledRules(trigger: RuleTrigger): ComplianceRule[] {
    const rules: ComplianceRule[] = [];

    for (const frameworkId of this.config.enabledFrameworks) {
      const framework = this.frameworks.get(frameworkId);
      if (!framework) continue;

      for (const rule of framework.rules) {
        if (rule.enabled && (rule.triggers.includes(trigger) || rule.triggers.includes('always'))) {
          rules.push(rule);
        }
      }
    }

    return rules;
  }

  /**
   * Find a rule by ID
   */
  private findRule(ruleId: string): ComplianceRule | undefined {
    for (const framework of this.frameworks.values()) {
      const rule = framework.rules.find((r) => r.id === ruleId);
      if (rule) return rule;
    }
    return undefined;
  }

  /**
   * Calculate compliance score
   */
  private calculateScore(violations: ComplianceViolation[], rulesChecked: number): number {
    if (rulesChecked === 0) return 100;

    // Use imported severity weights
    const severityWeights: Record<ViolationSeverity, number> = {
      critical: 20,
      high: 10,
      medium: 5,
      low: 2,
      info: 0,
    };

    // Calculate penalty based on violations
    let penalty = 0;
    for (const violation of violations) {
      penalty += severityWeights[violation.severity];
    }

    // Max penalty is 100 (from 5 critical violations)
    const maxPenalty = 100;
    const score = Math.max(0, 100 - (penalty / maxPenalty) * 100);

    return Math.round(score);
  }

  /**
   * Determine if check passed
   */
  private determinePassFail(violations: ComplianceViolation[], score: number): boolean {
    // Fail if any violation matches fail severity
    for (const violation of violations) {
      if (this.config.failOnSeverity.includes(violation.severity)) {
        return false;
      }
    }

    // Fail if score is below minimum
    if (score < this.config.minimumScore) {
      return false;
    }

    // Fail in strict mode if any violations
    if (this.config.strictMode && violations.length > 0) {
      return false;
    }

    return true;
  }

  /**
   * Count violations by severity
   */
  private countBySeverity(violations: ComplianceViolation[]): Record<ViolationSeverity, number> {
    const counts: Record<ViolationSeverity, number> = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
      info: 0,
    };

    for (const violation of violations) {
      counts[violation.severity]++;
    }

    return counts;
  }

  /**
   * Count violations by framework
   */
  private countByFramework(violations: ComplianceViolation[]): Record<ComplianceFrameworkId, number> {
    const counts: Record<string, number> = {};

    for (const violation of violations) {
      counts[violation.framework] = (counts[violation.framework] || 0) + 1;
    }

    return counts as Record<ComplianceFrameworkId, number>;
  }

  /**
   * Subscribe to compliance events
   */
  on(listener: (event: ComplianceEvent) => void): () => void {
    this.eventListeners.push(listener);
    return () => {
      const index = this.eventListeners.indexOf(listener);
      if (index > -1) {
        this.eventListeners.splice(index, 1);
      }
    };
  }

  /**
   * Emit an event
   */
  private emit(event: ComplianceEvent): void {
    for (const listener of this.eventListeners) {
      try {
        listener(event);
      } catch (error) {
        log.error('Event listener error', {
          eventType: event.type,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  /**
   * Get configuration
   */
  getConfig(): ComplianceEngineConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<ComplianceEngineConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get statistics
   */
  getStats(): {
    enabledFrameworks: number;
    totalRules: number;
    enabledRules: number;
    rulesByFramework: Record<string, number>;
  } {
    let totalRules = 0;
    let enabledRules = 0;
    const rulesByFramework: Record<string, number> = {};

    for (const [id, framework] of this.frameworks) {
      rulesByFramework[id] = framework.rules.length;
      totalRules += framework.rules.length;

      if (this.config.enabledFrameworks.includes(id)) {
        enabledRules += framework.rules.filter((r) => r.enabled).length;
      }
    }

    return {
      enabledFrameworks: this.config.enabledFrameworks.length,
      totalRules,
      enabledRules,
      rulesByFramework,
    };
  }
}

// Singleton instance
let instance: ComplianceEngine | null = null;

/**
 * Get the singleton ComplianceEngine instance
 */
export function getComplianceEngine(config?: Partial<ComplianceEngineConfig>): ComplianceEngine {
  if (!instance) {
    instance = new ComplianceEngine(config);
  }
  return instance;
}

/**
 * Reset the singleton (for testing)
 */
export function resetComplianceEngine(): void {
  instance = null;
}
