/**
 * MVP Feature Flags
 *
 * Feature flags for the MVP (Phase 1) release.
 */

import type { FeatureFlag } from '../types.js';

/**
 * MVP feature flags configuration
 */
export const MVP_FLAGS: Record<string, FeatureFlag> = {
  // =========================================================================
  // Core Features - ENABLED
  // =========================================================================

  'core.stateMachine': {
    key: 'core.stateMachine',
    enabled: true,
    description: 'Core state machine for workflow management',
    phase: 'mvp',
  },

  'core.persistence': {
    key: 'core.persistence',
    enabled: true,
    description: 'SQLite persistence layer',
    phase: 'mvp',
  },

  'core.basicHooks': {
    key: 'core.basicHooks',
    enabled: true,
    description: 'Basic hook system with built-in hooks',
    phase: 'mvp',
  },

  'core.auditLogging': {
    key: 'core.auditLogging',
    enabled: true,
    description: 'Audit logging for compliance',
    phase: 'mvp',
  },

  'core.checkpointRecovery': {
    key: 'core.checkpointRecovery',
    enabled: true,
    description: 'Checkpoint and recovery system',
    phase: 'mvp',
  },

  // =========================================================================
  // Agents - MVP Set ENABLED
  // =========================================================================

  'agents.orchestrator': {
    key: 'agents.orchestrator',
    enabled: true,
    description: 'Central orchestrator agent (rule-based routing)',
    phase: 'mvp',
  },

  'agents.projectManager': {
    key: 'agents.projectManager',
    enabled: true,
    description: 'Project manager agent for WBS',
    phase: 'mvp',
  },

  'agents.architect': {
    key: 'agents.architect',
    enabled: true,
    description: 'Architect agent for tech decisions',
    phase: 'mvp',
  },

  'agents.analyst': {
    key: 'agents.analyst',
    enabled: true,
    description: 'Analyst agent for research',
    phase: 'mvp',
  },

  // =========================================================================
  // Agents - DISABLED in MVP (v1.0+)
  // =========================================================================

  'agents.uiDesigner': {
    key: 'agents.uiDesigner',
    enabled: false,
    description: 'UI Designer agent for mockups',
    phase: 'v1',
  },

  'agents.frontendDev': {
    key: 'agents.frontendDev',
    enabled: false,
    description: 'Frontend developer agent',
    phase: 'v1',
  },

  'agents.backendDev': {
    key: 'agents.backendDev',
    enabled: false,
    description: 'Backend developer agent',
    phase: 'v1',
  },

  'agents.tester': {
    key: 'agents.tester',
    enabled: false,
    description: 'Tester agent for test execution',
    phase: 'v1',
  },

  'agents.bugFixer': {
    key: 'agents.bugFixer',
    enabled: false,
    description: 'Bug fixer agent (max 3 attempts)',
    phase: 'v1',
  },

  'agents.reviewer': {
    key: 'agents.reviewer',
    enabled: false,
    description: 'Code reviewer agent',
    phase: 'v1',
  },

  'agents.gitAgent': {
    key: 'agents.gitAgent',
    enabled: false,
    description: 'Git operations agent',
    phase: 'v1',
  },

  'agents.mergeResolver': {
    key: 'agents.mergeResolver',
    enabled: false,
    description: 'Merge conflict resolver agent',
    phase: 'v1',
  },

  'agents.projectAnalyzer': {
    key: 'agents.projectAnalyzer',
    enabled: false,
    description: 'Project analyzer for imports',
    phase: 'v1',
  },

  'agents.complianceAgent': {
    key: 'agents.complianceAgent',
    enabled: false,
    description: 'Compliance checking agent',
    phase: 'v1',
  },

  // =========================================================================
  // Features - DISABLED in MVP
  // =========================================================================

  'features.gitWorktrees': {
    key: 'features.gitWorktrees',
    enabled: false,
    description: 'Git worktree-based isolation',
    phase: 'v1',
  },

  'features.parallelDevelopment': {
    key: 'features.parallelDevelopment',
    enabled: false,
    description: 'Parallel FE+BE development',
    phase: 'v1',
  },

  'features.conflictDetection': {
    key: 'features.conflictDetection',
    enabled: false,
    description: 'Cross-feature conflict detection',
    phase: 'v1',
  },

  'features.tddWorkflow': {
    key: 'features.tddWorkflow',
    enabled: false,
    description: 'Test-driven development workflow',
    phase: 'v1',
  },

  'features.coverageTracking': {
    key: 'features.coverageTracking',
    enabled: false,
    description: 'Code coverage tracking',
    phase: 'v1',
  },

  'features.bugFixLoop': {
    key: 'features.bugFixLoop',
    enabled: false,
    description: 'Automated bug fix loop (max 3)',
    phase: 'v1',
  },

  'features.codeReview': {
    key: 'features.codeReview',
    enabled: false,
    description: 'Automated code review',
    phase: 'v1',
  },

  'features.cicdIntegration': {
    key: 'features.cicdIntegration',
    enabled: false,
    description: 'CI/CD pipeline integration',
    phase: 'v1',
  },

  'features.releaseWorkflow': {
    key: 'features.releaseWorkflow',
    enabled: false,
    description: 'Release workflow automation',
    phase: 'v1',
  },

  // =========================================================================
  // Self-Evolution - DISABLED (v2.0+)
  // =========================================================================

  'features.selfEvolution': {
    key: 'features.selfEvolution',
    enabled: false,
    description: 'Self-evolution capabilities',
    phase: 'v2',
  },

  'evolution.tracing': {
    key: 'evolution.tracing',
    enabled: false,
    description: 'Execution trace capture',
    phase: 'v2',
  },

  'evolution.patternDetection': {
    key: 'evolution.patternDetection',
    enabled: false,
    description: 'Pattern detection and mining',
    phase: 'v2',
  },

  'evolution.agentGeneration': {
    key: 'evolution.agentGeneration',
    enabled: false,
    description: 'DSPy agent generation',
    phase: 'v2',
  },

  'evolution.tournament': {
    key: 'evolution.tournament',
    enabled: false,
    description: 'TrueSkill tournament system',
    phase: 'v2',
  },

  // =========================================================================
  // Enterprise - DISABLED (Enterprise+)
  // =========================================================================

  'features.multiTenant': {
    key: 'features.multiTenant',
    enabled: false,
    description: 'Multi-tenant isolation',
    phase: 'enterprise',
  },

  'features.complianceDashboard': {
    key: 'features.complianceDashboard',
    enabled: false,
    description: 'Compliance status dashboard',
    phase: 'enterprise',
  },

  'enterprise.incidentResponse': {
    key: 'enterprise.incidentResponse',
    enabled: false,
    description: 'Incident response system',
    phase: 'enterprise',
  },

  'enterprise.gdprOperations': {
    key: 'enterprise.gdprOperations',
    enabled: false,
    description: 'GDPR DSAR handling',
    phase: 'enterprise',
  },

  'enterprise.vendorSecurity': {
    key: 'enterprise.vendorSecurity',
    enabled: false,
    description: 'Vendor security assessment',
    phase: 'enterprise',
  },

  'platform.modelAbstraction': {
    key: 'platform.modelAbstraction',
    enabled: false,
    description: 'Multi-provider model abstraction',
    phase: 'enterprise',
  },

  'platform.featureFlags': {
    key: 'platform.featureFlags',
    enabled: false,
    description: 'Advanced feature flag targeting',
    phase: 'enterprise',
  },

  'platform.genUIOutput': {
    key: 'platform.genUIOutput',
    enabled: false,
    description: 'GenUI structured output',
    phase: 'enterprise',
  },
} as const;

/**
 * Get all flags for a specific phase
 */
export function getFlagsForPhase(phase: 'mvp' | 'v1' | 'v2' | 'enterprise'): FeatureFlag[] {
  return Object.values(MVP_FLAGS).filter((flag) => flag.phase === phase);
}

/**
 * Get all enabled flags
 */
export function getEnabledFlags(): FeatureFlag[] {
  return Object.values(MVP_FLAGS).filter((flag) => flag.enabled);
}

/**
 * Get all disabled flags
 */
export function getDisabledFlags(): FeatureFlag[] {
  return Object.values(MVP_FLAGS).filter((flag) => !flag.enabled);
}
