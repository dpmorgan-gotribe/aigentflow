/**
 * Validation Utilities
 *
 * Common validation functions and Zod schemas.
 */

import { z } from 'zod';
import { ValidationError } from './errors.js';

// ============================================================================
// Common Schemas
// ============================================================================

/**
 * UUID v4 schema
 */
export const uuidSchema = z.string().uuid();

/**
 * Non-empty string schema
 */
export const nonEmptyString = z.string().min(1);

/**
 * ISO date string schema
 */
export const isoDateString = z.string().datetime();

/**
 * Positive integer schema
 */
export const positiveInt = z.number().int().positive();

/**
 * Non-negative integer schema
 */
export const nonNegativeInt = z.number().int().nonnegative();

// ============================================================================
// Domain Schemas
// ============================================================================

/**
 * Workflow state schema
 */
export const workflowStateSchema = z.enum([
  'IDLE',
  'ANALYZING',
  'ORCHESTRATING',
  'PLANNING',
  'ARCHITECTING',
  'DESIGNING',
  'BUILDING',
  'TESTING',
  'FIXING',
  'REVIEWING',
  'AGENT_WORKING',
  'AGENT_COMPLETE',
  'AWAITING_APPROVAL',
  'COMPLETING',
  'COMPLETED',
  'ERROR',
  'ABORTED',
  'ESCALATED',
  'RECOVERING',
]);

/**
 * Agent type schema
 */
export const agentTypeSchema = z.enum([
  'orchestrator',
  'project-manager',
  'architect',
  'analyst',
  'ui-designer',
  'frontend-developer',
  'backend-developer',
  'tester',
  'bug-fixer',
  'reviewer',
  'git-agent',
  'merge-resolver',
  'project-analyzer',
  'compliance-agent',
]);

/**
 * Compliance framework schema
 */
export const complianceFrameworkSchema = z.enum(['SOC2', 'GDPR', 'HIPAA', 'PCI-DSS', 'NONE']);

/**
 * Project name schema
 */
export const projectNameSchema = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[a-z0-9][a-z0-9-_]*$/i, 'Project name must be alphanumeric with hyphens/underscores');

/**
 * Agent config schema
 */
export const agentConfigSchema = z.object({
  type: agentTypeSchema,
  enabled: z.boolean(),
  maxConcurrent: positiveInt.max(15),
  timeout: positiveInt,
  retryCount: nonNegativeInt.max(5),
  model: z.string().optional(),
});

/**
 * Hook point schema
 */
export const hookPointSchema = z.enum([
  'pre_orchestrator',
  'post_orchestrator',
  'pre_agent_select',
  'post_agent_select',
  'pre_agent_execute',
  'post_agent_execute',
  'pre_file_write',
  'post_file_write',
  'pre_git_commit',
  'post_git_commit',
  'security_scan',
  'compliance_check',
  'on_error',
  'on_retry',
  'on_escalation',
]);

/**
 * Hook config schema
 */
export const hookConfigSchema = z.object({
  name: nonEmptyString,
  point: hookPointSchema,
  enabled: z.boolean(),
  priority: z.number().int().min(0).max(100),
  handler: nonEmptyString,
});

/**
 * Project config schema
 */
export const projectConfigSchema = z.object({
  name: projectNameSchema,
  version: z.string(),
  description: z.string().optional(),
  path: nonEmptyString,
  createdAt: isoDateString,
  updatedAt: isoDateString,
  features: z.object({
    gitWorktrees: z.boolean(),
    parallelAgents: z.boolean(),
    selfEvolution: z.boolean(),
  }),
  compliance: z.object({
    frameworks: z.array(complianceFrameworkSchema),
    strictMode: z.boolean(),
  }),
  agents: z.record(agentTypeSchema, agentConfigSchema.partial()).optional(),
  hooks: z.array(hookConfigSchema).optional(),
});

// ============================================================================
// Validation Functions
// ============================================================================

/**
 * Validate data against a schema
 */
export function validate<T>(schema: z.ZodSchema<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    const firstError = result.error.errors[0];
    throw new ValidationError(
      firstError?.message ?? 'Validation failed',
      firstError?.path.join('.'),
      data
    );
  }
  return result.data;
}

/**
 * Safely parse data against a schema
 */
export function safeParse<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; error: z.ZodError } {
  return schema.safeParse(data);
}

/**
 * Create a validated parser function
 */
export function createValidator<T>(schema: z.ZodSchema<T>): (data: unknown) => T {
  return (data: unknown) => validate(schema, data);
}

// ============================================================================
// Type Exports
// ============================================================================

export type WorkflowState = z.infer<typeof workflowStateSchema>;
export type AgentType = z.infer<typeof agentTypeSchema>;
export type ComplianceFramework = z.infer<typeof complianceFrameworkSchema>;
export type AgentConfig = z.infer<typeof agentConfigSchema>;
export type HookPoint = z.infer<typeof hookPointSchema>;
export type HookConfig = z.infer<typeof hookConfigSchema>;
export type ProjectConfig = z.infer<typeof projectConfigSchema>;
