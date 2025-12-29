/**
 * Skills Framework Types
 *
 * Type definitions for modular capability packs that can be
 * injected into agent prompts based on context.
 */

/**
 * Skill condition types for matching
 */
export type ConditionOperator = 'equals' | 'contains' | 'matches' | 'exists' | 'not';

export interface SkillCondition {
  /** Field to check (language, framework, taskType, etc.) */
  field: string;
  /** Operator for comparison */
  operator: ConditionOperator;
  /** Value to compare against */
  value?: string | string[] | boolean;
}

/**
 * Skill priority levels
 */
export type SkillPriority = 'critical' | 'high' | 'medium' | 'low';

/**
 * Skill categories
 */
export type SkillCategory =
  | 'coding'
  | 'testing'
  | 'security'
  | 'documentation'
  | 'architecture'
  | 'devops'
  | 'debugging'
  | 'performance'
  | 'accessibility'
  | 'custom';

/**
 * A single skill capability
 */
export interface Skill {
  /** Unique identifier */
  id: string;
  /** Display name */
  name: string;
  /** Description of what this skill provides */
  description: string;
  /** Category for organization */
  category: SkillCategory;
  /** Priority for ordering */
  priority: SkillPriority;
  /** Version string */
  version: string;
  /** Estimated token count for budget management */
  tokenEstimate: number;
  /** Conditions when this skill applies */
  conditions: SkillCondition[];
  /** Skills this depends on (loaded first) */
  dependencies: string[];
  /** Skills that conflict with this one */
  conflicts: string[];
  /** The actual prompt content to inject */
  content: string;
  /** Optional examples to include */
  examples?: SkillExample[];
  /** Tags for filtering */
  tags: string[];
  /** Whether this skill is enabled */
  enabled: boolean;
}

/**
 * Example for a skill
 */
export interface SkillExample {
  /** Example title */
  title: string;
  /** Input/scenario description */
  input: string;
  /** Expected output/behavior */
  output: string;
}

/**
 * A collection of related skills
 */
export interface SkillPack {
  /** Pack identifier */
  id: string;
  /** Pack display name */
  name: string;
  /** Pack description */
  description: string;
  /** Pack version */
  version: string;
  /** Skills in this pack */
  skills: Skill[];
  /** Pack author */
  author?: string;
  /** Pack homepage/docs */
  homepage?: string;
}

/**
 * Context for skill matching
 */
export interface SkillMatchContext {
  /** Programming language(s) */
  languages?: string[];
  /** Frameworks in use */
  frameworks?: string[];
  /** Task type being performed */
  taskType?: string;
  /** Agent type requesting skills */
  agentType?: string;
  /** Current workflow state */
  workflowState?: string;
  /** Project tech stack */
  techStack?: Record<string, string[]>;
  /** Additional context fields */
  [key: string]: unknown;
}

/**
 * Result of skill selection
 */
export interface SkillSelectionResult {
  /** Selected skills in order */
  skills: Skill[];
  /** Total token estimate */
  totalTokens: number;
  /** Skills excluded due to budget */
  excludedByBudget: Skill[];
  /** Skills excluded due to conflicts */
  excludedByConflict: Skill[];
  /** Skills that couldn't be loaded (missing deps) */
  unresolved: string[];
}

/**
 * Options for skill injection
 */
export interface SkillInjectionOptions {
  /** Maximum tokens to use for skills */
  tokenBudget: number;
  /** Include examples in injection */
  includeExamples: boolean;
  /** Format for injection */
  format: 'markdown' | 'xml' | 'plain';
  /** Section header text */
  sectionHeader?: string;
  /** Whether to include skill metadata */
  includeMetadata: boolean;
}

/**
 * Default injection options
 */
export const DEFAULT_INJECTION_OPTIONS: SkillInjectionOptions = {
  tokenBudget: 4000,
  includeExamples: true,
  format: 'markdown',
  sectionHeader: 'Applicable Skills',
  includeMetadata: false,
};

/**
 * Result of skill injection
 */
export interface SkillInjectionResult {
  /** The injected content */
  content: string;
  /** Skills that were injected */
  injectedSkills: string[];
  /** Token count of injected content */
  tokenCount: number;
  /** Whether budget was exceeded */
  budgetExceeded: boolean;
}

/**
 * Skill loader configuration
 */
export interface SkillLoaderConfig {
  /** Paths to search for skill packs */
  searchPaths: string[];
  /** Whether to load built-in skills */
  loadBuiltIn: boolean;
  /** Whether to validate skills on load */
  validateOnLoad: boolean;
  /** Custom validator function */
  customValidator?: (skill: Skill) => boolean;
}

/**
 * Default loader config
 */
export const DEFAULT_LOADER_CONFIG: SkillLoaderConfig = {
  searchPaths: ['./skills', './node_modules/@aigentflow/skills'],
  loadBuiltIn: true,
  validateOnLoad: true,
};

/**
 * Skill validation result
 */
export interface SkillValidationResult {
  /** Whether the skill is valid */
  valid: boolean;
  /** Validation errors */
  errors: string[];
  /** Validation warnings */
  warnings: string[];
}

/**
 * Priority weights for sorting
 */
export const PRIORITY_WEIGHTS: Record<SkillPriority, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
};

/**
 * Skill events for logging/hooks
 */
export type SkillEventType =
  | 'skill:loaded'
  | 'skill:validated'
  | 'skill:selected'
  | 'skill:injected'
  | 'skill:conflict'
  | 'skill:error';

export interface SkillEvent {
  type: SkillEventType;
  skillId?: string;
  packId?: string;
  message: string;
  timestamp: Date;
  data?: Record<string, unknown>;
}
