/**
 * Compliance Module
 *
 * Security and compliance enforcement framework.
 */

// Types
export type {
  ComplianceFrameworkId,
  ViolationSeverity,
  RuleCategory,
  RuleTrigger,
  ComplianceRule,
  ComplianceContext,
  ComplianceViolation,
  FixResult,
  ComplianceCheckResult,
  ComplianceFramework,
  ComplianceEngineConfig,
  ComplianceEvent,
  ComplianceEventType,
} from './types.js';

export { DEFAULT_ENGINE_CONFIG, SEVERITY_WEIGHTS } from './types.js';

// Engine
export {
  ComplianceEngine,
  getComplianceEngine,
  resetComplianceEngine,
} from './compliance-engine.js';

// Built-in frameworks
export {
  platformFramework,
  platformRules,
  gdprFramework,
  gdprRules,
  soc2Framework,
  soc2Rules,
  builtInFrameworks,
  getFrameworkById,
} from './rules/index.js';
