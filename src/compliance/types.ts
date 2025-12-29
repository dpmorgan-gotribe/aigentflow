/**
 * Compliance Types
 *
 * Type definitions for the compliance framework.
 */

/**
 * Compliance framework identifier
 */
export type ComplianceFrameworkId = 'platform' | 'gdpr' | 'soc2' | 'hipaa' | 'pci-dss';

/**
 * Violation severity levels
 */
export type ViolationSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';

/**
 * Rule category
 */
export type RuleCategory =
  | 'security'
  | 'privacy'
  | 'data-handling'
  | 'access-control'
  | 'audit'
  | 'encryption'
  | 'retention'
  | 'disclosure'
  | 'consent'
  | 'architecture';

/**
 * Rule trigger - when the rule is evaluated
 */
export type RuleTrigger =
  | 'file-write'
  | 'file-read'
  | 'git-commit'
  | 'code-generation'
  | 'api-call'
  | 'data-access'
  | 'config-change'
  | 'deployment'
  | 'always';

/**
 * Compliance rule definition
 */
export interface ComplianceRule {
  /** Unique rule ID */
  id: string;
  /** Framework this rule belongs to */
  framework: ComplianceFrameworkId;
  /** Human-readable name */
  name: string;
  /** Detailed description */
  description: string;
  /** Rule category */
  category: RuleCategory;
  /** Severity when violated */
  severity: ViolationSeverity;
  /** When to evaluate this rule */
  triggers: RuleTrigger[];
  /** Whether the rule is enabled */
  enabled: boolean;
  /** Whether violations can be auto-fixed */
  autoFixable: boolean;
  /** Check function - returns violations */
  check: (context: ComplianceContext) => ComplianceViolation[];
  /** Optional auto-fix function */
  fix?: (violation: ComplianceViolation, context: ComplianceContext) => FixResult;
  /** References (documentation, standard sections) */
  references?: string[];
  /** Tags for filtering */
  tags?: string[];
}

/**
 * Context passed to rule checks
 */
export interface ComplianceContext {
  /** File path being checked (if applicable) */
  filePath?: string;
  /** File content being checked */
  content?: string;
  /** Code being generated */
  generatedCode?: string;
  /** Project configuration */
  projectConfig?: {
    name: string;
    frameworks: ComplianceFrameworkId[];
    strictMode: boolean;
  };
  /** Metadata about the operation */
  metadata?: Record<string, unknown>;
  /** Previous agent outputs */
  previousOutputs?: Map<string, unknown>;
}

/**
 * Compliance violation
 */
export interface ComplianceViolation {
  /** Rule that was violated */
  ruleId: string;
  /** Framework the rule belongs to */
  framework: ComplianceFrameworkId;
  /** Violation severity */
  severity: ViolationSeverity;
  /** Human-readable message */
  message: string;
  /** Location of violation (file path, line, column) */
  location?: {
    file?: string;
    line?: number;
    column?: number;
    snippet?: string;
  };
  /** Whether this can be auto-fixed */
  autoFixable: boolean;
  /** Suggested remediation */
  remediation?: string;
  /** Additional context */
  context?: Record<string, unknown>;
}

/**
 * Result of attempting to fix a violation
 */
export interface FixResult {
  /** Whether the fix was successful */
  success: boolean;
  /** Description of what was fixed */
  description?: string;
  /** Error message if fix failed */
  error?: string;
  /** Changes made */
  changes?: Array<{
    type: 'replace' | 'insert' | 'delete';
    location: { file: string; line: number };
    before?: string;
    after?: string;
  }>;
}

/**
 * Compliance check result
 */
export interface ComplianceCheckResult {
  /** Whether all checks passed */
  passed: boolean;
  /** Compliance score (0-100) */
  score: number;
  /** List of violations found */
  violations: ComplianceViolation[];
  /** Violations by severity */
  bySeverity: Record<ViolationSeverity, number>;
  /** Violations by framework */
  byFramework: Record<ComplianceFrameworkId, number>;
  /** Rules that were checked */
  rulesChecked: number;
  /** Rules that passed */
  rulesPassed: number;
  /** Timestamp of check */
  timestamp: string;
  /** Duration of check in ms */
  duration: number;
}

/**
 * Compliance framework definition
 */
export interface ComplianceFramework {
  /** Framework ID */
  id: ComplianceFrameworkId;
  /** Display name */
  name: string;
  /** Description */
  description: string;
  /** Whether this framework is mandatory (platform) or optional */
  mandatory: boolean;
  /** Version of the framework/standard */
  version?: string;
  /** Rules in this framework */
  rules: ComplianceRule[];
}

/**
 * Compliance engine configuration
 */
export interface ComplianceEngineConfig {
  /** Frameworks to enable */
  enabledFrameworks: ComplianceFrameworkId[];
  /** Whether to run in strict mode (fail on any violation) */
  strictMode: boolean;
  /** Minimum score required to pass (0-100) */
  minimumScore: number;
  /** Severity levels that cause failure */
  failOnSeverity: ViolationSeverity[];
  /** Whether to attempt auto-fixes */
  autoFix: boolean;
  /** Maximum violations before stopping check */
  maxViolations: number;
}

/**
 * Default engine configuration
 */
export const DEFAULT_ENGINE_CONFIG: ComplianceEngineConfig = {
  enabledFrameworks: ['platform'],
  strictMode: false,
  minimumScore: 70,
  failOnSeverity: ['critical'],
  autoFix: false,
  maxViolations: 100,
};

/**
 * Severity weights for scoring
 */
export const SEVERITY_WEIGHTS: Record<ViolationSeverity, number> = {
  critical: 20,
  high: 10,
  medium: 5,
  low: 2,
  info: 0,
};

/**
 * Compliance event types
 */
export type ComplianceEventType =
  | 'check:started'
  | 'check:completed'
  | 'violation:found'
  | 'violation:fixed'
  | 'framework:enabled'
  | 'framework:disabled';

/**
 * Compliance event
 */
export interface ComplianceEvent {
  type: ComplianceEventType;
  timestamp: string;
  data: Record<string, unknown>;
}
