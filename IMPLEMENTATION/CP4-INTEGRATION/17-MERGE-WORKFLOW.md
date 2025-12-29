# Step 17: Merge Workflow

> **Checkpoint:** CP4 - Integration
> **Previous Step:** 16-REVIEWER-AGENT.md (CP3)
> **Next Step:** 18-INTEGRATION-BRANCH.md

---

## Overview

The Merge Workflow handles merging completed and reviewed code from worktrees back into feature branches. This is the first step of the integration phase, ensuring that parallel frontend and backend work is properly combined.

**Key responsibilities:**
- Coordinate worktree merges after review approval
- Handle merge conflicts automatically where possible
- Escalate complex conflicts to human review
- Validate merged code compiles and tests pass
- Clean up worktrees after successful merge

---

## Deliverables

1. `src/agents/agents/merge-coordinator.ts` - Merge Coordinator agent
2. `src/agents/schemas/merge-workflow.ts` - Merge workflow schemas
3. `src/workflows/merge-workflow.ts` - Merge workflow orchestration
4. `src/utils/merge-strategies.ts` - Conflict resolution strategies

---

## 1. Merge Workflow Schema (`src/agents/schemas/merge-workflow.ts`)

```typescript
/**
 * Merge Workflow Schema
 *
 * Defines types for the merge coordination process.
 */

import { z } from 'zod';

/**
 * Worktree status for merge consideration
 */
export const WorktreeMergeStatusSchema = z.object({
  worktreePath: z.string(),
  featureBranch: z.string(),
  sourceBranch: z.string(), // The worktree's branch (e.g., feature/auth-frontend)
  agentType: z.enum(['frontend', 'backend', 'fullstack']),

  // Review status
  reviewStatus: z.enum(['pending', 'approved', 'changes_requested', 'rejected']),
  reviewedAt: z.string().optional(),
  reviewedBy: z.string().optional(),

  // Code status
  testsPass: z.boolean(),
  coverage: z.number(),
  lintPass: z.boolean(),
  buildPass: z.boolean(),

  // Files changed
  filesChanged: z.number(),
  additions: z.number(),
  deletions: z.number(),

  // Conflict potential
  conflictRisk: z.enum(['none', 'low', 'medium', 'high']),
  potentialConflicts: z.array(z.string()).optional(), // File paths
});

export type WorktreeMergeStatus = z.infer<typeof WorktreeMergeStatusSchema>;

/**
 * Merge conflict details
 */
export const MergeConflictSchema = z.object({
  file: z.string(),
  conflictType: z.enum([
    'content',      // Same lines modified
    'rename',       // File renamed differently
    'delete_modify', // Deleted in one, modified in other
    'add_add',      // Both added same file
  ]),

  // Conflict markers
  oursContent: z.string(),
  theirsContent: z.string(),
  baseContent: z.string().optional(),

  // Resolution
  autoResolvable: z.boolean(),
  suggestedResolution: z.string().optional(),
  resolutionStrategy: z.enum([
    'keep_ours',
    'keep_theirs',
    'merge_both',
    'manual',
  ]).optional(),
});

export type MergeConflict = z.infer<typeof MergeConflictSchema>;

/**
 * Merge operation result
 */
export const MergeResultSchema = z.object({
  success: z.boolean(),
  mergedBranches: z.array(z.string()),
  targetBranch: z.string(),

  // Merge details
  mergeCommit: z.string().optional(),
  mergeStrategy: z.enum(['fast-forward', 'merge-commit', 'squash', 'rebase']),

  // Conflicts
  conflicts: z.array(MergeConflictSchema),
  conflictsResolved: z.number(),
  conflictsPending: z.number(),

  // Validation
  postMergeTests: z.enum(['passed', 'failed', 'skipped']),
  postMergeBuild: z.enum(['passed', 'failed', 'skipped']),

  // Cleanup
  worktreesRemoved: z.array(z.string()),
  branchesDeleted: z.array(z.string()),
});

export type MergeResult = z.infer<typeof MergeResultSchema>;

/**
 * Merge workflow input
 */
export const MergeWorkflowInputSchema = z.object({
  featureId: z.string(),
  featureBranch: z.string(),
  worktrees: z.array(WorktreeMergeStatusSchema),

  // Merge configuration
  config: z.object({
    strategy: z.enum(['sequential', 'parallel-then-merge']).default('sequential'),
    mergeOrder: z.array(z.enum(['frontend', 'backend'])).default(['backend', 'frontend']),
    squashCommits: z.boolean().default(false),
    runTestsAfterMerge: z.boolean().default(true),
    cleanupWorktrees: z.boolean().default(true),
    autoResolveConflicts: z.boolean().default(true),
  }),
});

export type MergeWorkflowInput = z.infer<typeof MergeWorkflowInputSchema>;

/**
 * Complete merge workflow output
 */
export const MergeWorkflowOutputSchema = z.object({
  featureId: z.string(),
  featureBranch: z.string(),
  completedAt: z.string(),

  // Overall status
  status: z.enum(['success', 'partial', 'failed', 'blocked']),

  // Merge results per worktree
  mergeResults: z.array(MergeResultSchema),

  // Summary
  summary: z.object({
    worktreesMerged: z.number(),
    worktreesFailed: z.number(),
    conflictsTotal: z.number(),
    conflictsResolved: z.number(),
    conflictsPending: z.number(),
    testsStatus: z.enum(['passed', 'failed', 'skipped']),
    buildStatus: z.enum(['passed', 'failed', 'skipped']),
  }),

  // Next steps
  nextAction: z.enum([
    'ready_for_integration',
    'needs_conflict_resolution',
    'needs_test_fixes',
    'needs_build_fixes',
    'blocked',
  ]),

  blockers: z.array(z.string()).optional(),
});

export type MergeWorkflowOutput = z.infer<typeof MergeWorkflowOutputSchema>;
```

---

## 2. Merge Strategies (`src/utils/merge-strategies.ts`)

```typescript
/**
 * Merge Conflict Resolution Strategies
 *
 * Automated strategies for resolving common merge conflicts.
 */

import { MergeConflict } from '../agents/schemas/merge-workflow';

export interface ConflictResolver {
  canResolve(conflict: MergeConflict): boolean;
  resolve(conflict: MergeConflict): string;
}

/**
 * Import statement conflict resolver
 * Merges import statements from both sides
 */
export class ImportConflictResolver implements ConflictResolver {
  private importPattern = /^import\s+.*from\s+['"].*['"];?$/gm;

  canResolve(conflict: MergeConflict): boolean {
    if (conflict.conflictType !== 'content') return false;

    // Check if conflict is purely in import section
    const oursImports = conflict.oursContent.match(this.importPattern) || [];
    const theirsImports = conflict.theirsContent.match(this.importPattern) || [];

    return oursImports.length > 0 || theirsImports.length > 0;
  }

  resolve(conflict: MergeConflict): string {
    const oursImports = new Set(conflict.oursContent.match(this.importPattern) || []);
    const theirsImports = new Set(conflict.theirsContent.match(this.importPattern) || []);

    // Merge all unique imports
    const allImports = [...new Set([...oursImports, ...theirsImports])];

    // Sort imports (external first, then internal)
    const sorted = allImports.sort((a, b) => {
      const aIsRelative = a.includes('./') || a.includes('../');
      const bIsRelative = b.includes('./') || b.includes('../');
      if (aIsRelative && !bIsRelative) return 1;
      if (!aIsRelative && bIsRelative) return -1;
      return a.localeCompare(b);
    });

    return sorted.join('\n');
  }
}

/**
 * Package.json dependency conflict resolver
 * Takes the higher version when both modify
 */
export class PackageJsonConflictResolver implements ConflictResolver {
  canResolve(conflict: MergeConflict): boolean {
    return conflict.file === 'package.json' && conflict.conflictType === 'content';
  }

  resolve(conflict: MergeConflict): string {
    try {
      const ours = JSON.parse(conflict.oursContent);
      const theirs = JSON.parse(conflict.theirsContent);
      const base = conflict.baseContent ? JSON.parse(conflict.baseContent) : {};

      // Deep merge with version comparison
      const merged = this.deepMerge(base, ours, theirs);

      return JSON.stringify(merged, null, 2);
    } catch {
      // If JSON parsing fails, can't auto-resolve
      return '';
    }
  }

  private deepMerge(base: any, ours: any, theirs: any): any {
    const result = { ...base };

    // Merge all keys from both sides
    const allKeys = new Set([...Object.keys(ours), ...Object.keys(theirs)]);

    for (const key of allKeys) {
      if (key === 'dependencies' || key === 'devDependencies') {
        result[key] = this.mergeDependencies(
          base[key] || {},
          ours[key] || {},
          theirs[key] || {}
        );
      } else if (typeof ours[key] === 'object' && typeof theirs[key] === 'object') {
        result[key] = this.deepMerge(base[key] || {}, ours[key], theirs[key]);
      } else {
        // Take theirs if different from base, otherwise ours
        result[key] = theirs[key] !== base[key] ? theirs[key] : ours[key];
      }
    }

    return result;
  }

  private mergeDependencies(
    base: Record<string, string>,
    ours: Record<string, string>,
    theirs: Record<string, string>
  ): Record<string, string> {
    const result = { ...base };

    // Add all dependencies from both sides
    for (const [pkg, version] of Object.entries(ours)) {
      result[pkg] = version;
    }

    for (const [pkg, version] of Object.entries(theirs)) {
      if (result[pkg]) {
        // Both have same package - take higher version
        result[pkg] = this.higherVersion(result[pkg], version);
      } else {
        result[pkg] = version;
      }
    }

    return result;
  }

  private higherVersion(a: string, b: string): string {
    // Simple semver comparison (strip ^ and ~)
    const cleanA = a.replace(/[\^~]/, '');
    const cleanB = b.replace(/[\^~]/, '');

    const partsA = cleanA.split('.').map(Number);
    const partsB = cleanB.split('.').map(Number);

    for (let i = 0; i < 3; i++) {
      if ((partsA[i] || 0) > (partsB[i] || 0)) return a;
      if ((partsB[i] || 0) > (partsA[i] || 0)) return b;
    }

    return a; // Equal, keep ours
  }
}

/**
 * CSS/Style file conflict resolver
 * Merges style blocks
 */
export class StyleConflictResolver implements ConflictResolver {
  canResolve(conflict: MergeConflict): boolean {
    const styleExtensions = ['.css', '.scss', '.sass', '.less'];
    return styleExtensions.some(ext => conflict.file.endsWith(ext)) &&
           conflict.conflictType === 'content';
  }

  resolve(conflict: MergeConflict): string {
    // For CSS, we can usually safely concatenate unique rules
    const oursRules = this.parseRules(conflict.oursContent);
    const theirsRules = this.parseRules(conflict.theirsContent);

    // Merge rules, theirs takes precedence for same selectors
    const merged = new Map([...oursRules, ...theirsRules]);

    return Array.from(merged.entries())
      .map(([selector, rules]) => `${selector} {\n${rules}\n}`)
      .join('\n\n');
  }

  private parseRules(css: string): Map<string, string> {
    const rules = new Map<string, string>();
    const rulePattern = /([^{]+)\{([^}]+)\}/g;

    let match;
    while ((match = rulePattern.exec(css)) !== null) {
      const selector = match[1].trim();
      const body = match[2].trim();
      rules.set(selector, body);
    }

    return rules;
  }
}

/**
 * TypeScript/JavaScript export conflict resolver
 * Merges export statements
 */
export class ExportConflictResolver implements ConflictResolver {
  private exportPattern = /^export\s+(?:\{[^}]+\}|.*)\s*(?:from\s+['"].*['"])?;?$/gm;

  canResolve(conflict: MergeConflict): boolean {
    if (conflict.conflictType !== 'content') return false;

    // Check if conflict involves exports (common in index files)
    return conflict.file.includes('index.') &&
           (conflict.oursContent.includes('export') ||
            conflict.theirsContent.includes('export'));
  }

  resolve(conflict: MergeConflict): string {
    const oursExports = conflict.oursContent.match(this.exportPattern) || [];
    const theirsExports = conflict.theirsContent.match(this.exportPattern) || [];

    // Merge unique exports
    const allExports = [...new Set([...oursExports, ...theirsExports])];

    return allExports.join('\n');
  }
}

/**
 * Conflict Resolution Engine
 */
export class ConflictResolutionEngine {
  private resolvers: ConflictResolver[] = [
    new ImportConflictResolver(),
    new PackageJsonConflictResolver(),
    new StyleConflictResolver(),
    new ExportConflictResolver(),
  ];

  /**
   * Attempt to auto-resolve a conflict
   */
  tryResolve(conflict: MergeConflict): { resolved: boolean; content?: string } {
    for (const resolver of resolvers) {
      if (resolver.canResolve(conflict)) {
        const resolved = resolver.resolve(conflict);
        if (resolved) {
          return { resolved: true, content: resolved };
        }
      }
    }

    return { resolved: false };
  }

  /**
   * Add custom resolver
   */
  addResolver(resolver: ConflictResolver): void {
    this.resolvers.push(resolver);
  }
}
```

---

## 3. Merge Coordinator Agent (`src/agents/agents/merge-coordinator.ts`)

```typescript
/**
 * Merge Coordinator Agent
 *
 * Coordinates the merging of worktrees back into feature branches.
 */

import { BaseAgent } from '../base-agent';
import { RegisterAgent } from '../registry';
import {
  AgentMetadata,
  AgentContext,
  AgentRequest,
  Artifact,
  RoutingHints,
  AgentType,
} from '../types';
import {
  MergeWorkflowInput,
  MergeWorkflowOutput,
  MergeWorkflowOutputSchema,
  MergeResult,
  MergeConflict,
  WorktreeMergeStatus,
} from '../schemas/merge-workflow';
import { ConflictResolutionEngine } from '../../utils/merge-strategies';
import { GitAgent } from './git-agent';
import { logger } from '../../utils/logger';

/**
 * Agent metadata
 */
const MERGE_COORDINATOR_METADATA: AgentMetadata = {
  id: AgentType.MERGE_COORDINATOR,
  name: 'Merge Coordinator',
  description: 'Coordinates worktree merges into feature branches',
  version: '1.0.0',
  capabilities: [
    {
      name: 'worktree_merge',
      description: 'Merge worktree branches back to feature branch',
      inputTypes: ['worktree_status', 'review_approval'],
      outputTypes: ['merge_result', 'conflict_report'],
    },
    {
      name: 'conflict_resolution',
      description: 'Auto-resolve common merge conflicts',
      inputTypes: ['merge_conflict'],
      outputTypes: ['resolved_content'],
    },
    {
      name: 'post_merge_validation',
      description: 'Validate merged code compiles and tests pass',
      inputTypes: ['merged_branch'],
      outputTypes: ['validation_result'],
    },
  ],
  requiredContext: [
    { type: 'feature_context', required: true },
    { type: 'worktree_status', required: true },
  ],
  outputSchema: 'merge-workflow-output',
};

/**
 * Merge Coordinator Agent implementation
 */
@RegisterAgent
export class MergeCoordinatorAgent extends BaseAgent {
  private gitAgent: GitAgent;
  private conflictEngine: ConflictResolutionEngine;

  constructor() {
    super(MERGE_COORDINATOR_METADATA);
    this.gitAgent = new GitAgent();
    this.conflictEngine = new ConflictResolutionEngine();
  }

  /**
   * Execute merge workflow
   */
  async execute(request: AgentRequest): Promise<MergeWorkflowOutput> {
    const input = this.extractInput(request) as MergeWorkflowInput;

    this.log('info', 'Starting merge workflow', {
      featureId: input.featureId,
      worktreeCount: input.worktrees.length,
    });

    // Check all worktrees are approved
    const pendingReviews = input.worktrees.filter(
      w => w.reviewStatus !== 'approved'
    );

    if (pendingReviews.length > 0) {
      return this.createBlockedOutput(input, pendingReviews);
    }

    // Sort worktrees by merge order
    const sortedWorktrees = this.sortByMergeOrder(
      input.worktrees,
      input.config.mergeOrder
    );

    // Execute merges
    const mergeResults: MergeResult[] = [];
    let allSuccessful = true;

    for (const worktree of sortedWorktrees) {
      const result = await this.mergeWorktree(worktree, input);
      mergeResults.push(result);

      if (!result.success) {
        allSuccessful = false;

        // Stop if sequential strategy and merge failed
        if (input.config.strategy === 'sequential' && result.conflictsPending > 0) {
          this.log('warn', 'Stopping sequential merge due to conflicts', {
            worktree: worktree.worktreePath,
          });
          break;
        }
      }
    }

    // Run post-merge validation if all merges successful
    let testsStatus: 'passed' | 'failed' | 'skipped' = 'skipped';
    let buildStatus: 'passed' | 'failed' | 'skipped' = 'skipped';

    if (allSuccessful && input.config.runTestsAfterMerge) {
      const validation = await this.runPostMergeValidation(input.featureBranch);
      testsStatus = validation.tests;
      buildStatus = validation.build;
    }

    // Cleanup worktrees if configured
    if (allSuccessful && input.config.cleanupWorktrees) {
      await this.cleanupWorktrees(sortedWorktrees);
    }

    // Calculate summary
    const summary = this.calculateSummary(mergeResults, testsStatus, buildStatus);

    return {
      featureId: input.featureId,
      featureBranch: input.featureBranch,
      completedAt: new Date().toISOString(),
      status: this.determineStatus(summary),
      mergeResults,
      summary,
      nextAction: this.determineNextAction(summary),
      blockers: this.identifyBlockers(summary, mergeResults),
    };
  }

  /**
   * Merge a single worktree
   */
  private async mergeWorktree(
    worktree: WorktreeMergeStatus,
    input: MergeWorkflowInput
  ): Promise<MergeResult> {
    this.log('info', 'Merging worktree', {
      source: worktree.sourceBranch,
      target: input.featureBranch,
    });

    try {
      // Checkout feature branch
      await this.gitAgent.checkout(input.featureBranch);

      // Attempt merge
      const mergeOutput = await this.gitAgent.merge(
        worktree.sourceBranch,
        input.config.squashCommits ? 'squash' : 'merge-commit'
      );

      if (mergeOutput.conflicts.length === 0) {
        // Clean merge
        return {
          success: true,
          mergedBranches: [worktree.sourceBranch],
          targetBranch: input.featureBranch,
          mergeCommit: mergeOutput.commitHash,
          mergeStrategy: input.config.squashCommits ? 'squash' : 'merge-commit',
          conflicts: [],
          conflictsResolved: 0,
          conflictsPending: 0,
          postMergeTests: 'skipped',
          postMergeBuild: 'skipped',
          worktreesRemoved: [],
          branchesDeleted: [],
        };
      }

      // Handle conflicts
      const conflicts = await this.processConflicts(
        mergeOutput.conflicts,
        input.config.autoResolveConflicts
      );

      const resolved = conflicts.filter(c => c.autoResolvable).length;
      const pending = conflicts.length - resolved;

      if (pending === 0) {
        // All conflicts auto-resolved, commit
        await this.gitAgent.commitMerge(
          `Merge ${worktree.sourceBranch} into ${input.featureBranch} (auto-resolved)`
        );

        return {
          success: true,
          mergedBranches: [worktree.sourceBranch],
          targetBranch: input.featureBranch,
          mergeCommit: await this.gitAgent.getHeadCommit(),
          mergeStrategy: 'merge-commit',
          conflicts,
          conflictsResolved: resolved,
          conflictsPending: 0,
          postMergeTests: 'skipped',
          postMergeBuild: 'skipped',
          worktreesRemoved: [],
          branchesDeleted: [],
        };
      }

      // Conflicts need manual resolution
      return {
        success: false,
        mergedBranches: [],
        targetBranch: input.featureBranch,
        mergeStrategy: 'merge-commit',
        conflicts,
        conflictsResolved: resolved,
        conflictsPending: pending,
        postMergeTests: 'skipped',
        postMergeBuild: 'skipped',
        worktreesRemoved: [],
        branchesDeleted: [],
      };

    } catch (error) {
      this.log('error', 'Merge failed', { error, worktree: worktree.sourceBranch });

      // Abort merge on error
      await this.gitAgent.abortMerge();

      return {
        success: false,
        mergedBranches: [],
        targetBranch: input.featureBranch,
        mergeStrategy: 'merge-commit',
        conflicts: [],
        conflictsResolved: 0,
        conflictsPending: 0,
        postMergeTests: 'skipped',
        postMergeBuild: 'skipped',
        worktreesRemoved: [],
        branchesDeleted: [],
      };
    }
  }

  /**
   * Process and attempt to resolve conflicts
   */
  private async processConflicts(
    conflictFiles: string[],
    autoResolve: boolean
  ): Promise<MergeConflict[]> {
    const conflicts: MergeConflict[] = [];

    for (const file of conflictFiles) {
      const content = await this.gitAgent.getConflictContent(file);

      const conflict: MergeConflict = {
        file,
        conflictType: 'content',
        oursContent: content.ours,
        theirsContent: content.theirs,
        baseContent: content.base,
        autoResolvable: false,
      };

      if (autoResolve) {
        const resolution = this.conflictEngine.tryResolve(conflict);

        if (resolution.resolved && resolution.content) {
          conflict.autoResolvable = true;
          conflict.suggestedResolution = resolution.content;
          conflict.resolutionStrategy = 'merge_both';

          // Apply the resolution
          await this.gitAgent.resolveConflict(file, resolution.content);
        }
      }

      conflicts.push(conflict);
    }

    return conflicts;
  }

  /**
   * Run post-merge validation
   */
  private async runPostMergeValidation(branch: string): Promise<{
    tests: 'passed' | 'failed' | 'skipped';
    build: 'passed' | 'failed' | 'skipped';
  }> {
    try {
      // Run build
      const buildResult = await this.executeCommand('npm', ['run', 'build']);
      const buildStatus = buildResult.exitCode === 0 ? 'passed' : 'failed';

      // Run tests
      const testResult = await this.executeCommand('npm', ['run', 'test']);
      const testStatus = testResult.exitCode === 0 ? 'passed' : 'failed';

      return { tests: testStatus, build: buildStatus };
    } catch {
      return { tests: 'skipped', build: 'skipped' };
    }
  }

  /**
   * Cleanup merged worktrees
   */
  private async cleanupWorktrees(worktrees: WorktreeMergeStatus[]): Promise<void> {
    for (const worktree of worktrees) {
      try {
        await this.gitAgent.removeWorktree(worktree.worktreePath);
        await this.gitAgent.deleteBranch(worktree.sourceBranch);

        this.log('info', 'Cleaned up worktree', { path: worktree.worktreePath });
      } catch (error) {
        this.log('warn', 'Failed to cleanup worktree', {
          path: worktree.worktreePath,
          error,
        });
      }
    }
  }

  /**
   * Sort worktrees by merge order preference
   */
  private sortByMergeOrder(
    worktrees: WorktreeMergeStatus[],
    order: ('frontend' | 'backend')[]
  ): WorktreeMergeStatus[] {
    return [...worktrees].sort((a, b) => {
      const aIndex = order.indexOf(a.agentType as any);
      const bIndex = order.indexOf(b.agentType as any);
      return aIndex - bIndex;
    });
  }

  /**
   * Create blocked output for pending reviews
   */
  private createBlockedOutput(
    input: MergeWorkflowInput,
    pendingReviews: WorktreeMergeStatus[]
  ): MergeWorkflowOutput {
    return {
      featureId: input.featureId,
      featureBranch: input.featureBranch,
      completedAt: new Date().toISOString(),
      status: 'blocked',
      mergeResults: [],
      summary: {
        worktreesMerged: 0,
        worktreesFailed: 0,
        conflictsTotal: 0,
        conflictsResolved: 0,
        conflictsPending: 0,
        testsStatus: 'skipped',
        buildStatus: 'skipped',
      },
      nextAction: 'blocked',
      blockers: pendingReviews.map(
        w => `Worktree ${w.worktreePath} has review status: ${w.reviewStatus}`
      ),
    };
  }

  /**
   * Calculate summary from merge results
   */
  private calculateSummary(
    results: MergeResult[],
    testsStatus: 'passed' | 'failed' | 'skipped',
    buildStatus: 'passed' | 'failed' | 'skipped'
  ): MergeWorkflowOutput['summary'] {
    return {
      worktreesMerged: results.filter(r => r.success).length,
      worktreesFailed: results.filter(r => !r.success).length,
      conflictsTotal: results.reduce((sum, r) => sum + r.conflicts.length, 0),
      conflictsResolved: results.reduce((sum, r) => sum + r.conflictsResolved, 0),
      conflictsPending: results.reduce((sum, r) => sum + r.conflictsPending, 0),
      testsStatus,
      buildStatus,
    };
  }

  /**
   * Determine overall status
   */
  private determineStatus(
    summary: MergeWorkflowOutput['summary']
  ): MergeWorkflowOutput['status'] {
    if (summary.worktreesFailed === 0 && summary.conflictsPending === 0) {
      if (summary.testsStatus === 'failed' || summary.buildStatus === 'failed') {
        return 'partial';
      }
      return 'success';
    }
    if (summary.worktreesMerged > 0) {
      return 'partial';
    }
    return 'failed';
  }

  /**
   * Determine next action
   */
  private determineNextAction(
    summary: MergeWorkflowOutput['summary']
  ): MergeWorkflowOutput['nextAction'] {
    if (summary.conflictsPending > 0) {
      return 'needs_conflict_resolution';
    }
    if (summary.testsStatus === 'failed') {
      return 'needs_test_fixes';
    }
    if (summary.buildStatus === 'failed') {
      return 'needs_build_fixes';
    }
    if (summary.worktreesFailed > 0) {
      return 'blocked';
    }
    return 'ready_for_integration';
  }

  /**
   * Identify blockers
   */
  private identifyBlockers(
    summary: MergeWorkflowOutput['summary'],
    results: MergeResult[]
  ): string[] {
    const blockers: string[] = [];

    if (summary.conflictsPending > 0) {
      const conflictFiles = results
        .flatMap(r => r.conflicts)
        .filter(c => !c.autoResolvable)
        .map(c => c.file);
      blockers.push(`Unresolved conflicts in: ${conflictFiles.join(', ')}`);
    }

    if (summary.testsStatus === 'failed') {
      blockers.push('Post-merge tests are failing');
    }

    if (summary.buildStatus === 'failed') {
      blockers.push('Post-merge build is failing');
    }

    return blockers;
  }

  private async executeCommand(
    cmd: string,
    args: string[]
  ): Promise<{ exitCode: number; stdout: string }> {
    // Implementation would use child_process
    return { exitCode: 0, stdout: '' };
  }

  private extractInput(request: AgentRequest): MergeWorkflowInput {
    // Extract from context
    return request.context.items.find(i => i.type === 'merge_input')?.content;
  }
}
```

---

## 4. Merge Workflow Orchestration (`src/workflows/merge-workflow.ts`)

```typescript
/**
 * Merge Workflow Orchestration
 *
 * High-level workflow for coordinating merges after feature completion.
 */

import { StateGraph, StateContext } from '../state/state-graph';
import { MergeCoordinatorAgent } from '../agents/agents/merge-coordinator';
import { TesterAgent } from '../agents/agents/tester';
import {
  MergeWorkflowInput,
  MergeWorkflowOutput,
  WorktreeMergeStatus,
} from '../agents/schemas/merge-workflow';
import { logger } from '../utils/logger';

/**
 * Create merge workflow graph
 */
export function createMergeWorkflow(): StateGraph {
  const graph = new StateGraph({
    name: 'merge-workflow',
    initialState: 'check_readiness',
  });

  // Node: Check if all worktrees are ready for merge
  graph.addNode('check_readiness', async (ctx: StateContext) => {
    const worktrees = ctx.worktrees as WorktreeMergeStatus[];

    const allApproved = worktrees.every(w => w.reviewStatus === 'approved');
    const allTestsPass = worktrees.every(w => w.testsPass);
    const allBuildsPass = worktrees.every(w => w.buildPass);

    return {
      ...ctx,
      readyForMerge: allApproved && allTestsPass && allBuildsPass,
      readinessIssues: [
        ...worktrees.filter(w => w.reviewStatus !== 'approved')
          .map(w => `${w.agentType}: pending review`),
        ...worktrees.filter(w => !w.testsPass)
          .map(w => `${w.agentType}: tests failing`),
        ...worktrees.filter(w => !w.buildPass)
          .map(w => `${w.agentType}: build failing`),
      ],
    };
  });

  // Node: Execute merge
  graph.addNode('execute_merge', async (ctx: StateContext) => {
    const coordinator = new MergeCoordinatorAgent();

    const input: MergeWorkflowInput = {
      featureId: ctx.featureId,
      featureBranch: ctx.featureBranch,
      worktrees: ctx.worktrees,
      config: ctx.mergeConfig || {
        strategy: 'sequential',
        mergeOrder: ['backend', 'frontend'],
        squashCommits: false,
        runTestsAfterMerge: true,
        cleanupWorktrees: true,
        autoResolveConflicts: true,
      },
    };

    const result = await coordinator.execute({
      executionId: `merge-${ctx.featureId}`,
      task: ctx.task,
      context: {
        ...ctx,
        items: [{ type: 'merge_input', content: input }],
      },
    });

    return {
      ...ctx,
      mergeResult: result,
    };
  });

  // Node: Handle conflicts
  graph.addNode('handle_conflicts', async (ctx: StateContext) => {
    const result = ctx.mergeResult as MergeWorkflowOutput;

    // Log conflicts for human review
    logger.warn('Merge conflicts require manual resolution', {
      featureId: ctx.featureId,
      conflicts: result.mergeResults.flatMap(r =>
        r.conflicts.filter(c => !c.autoResolvable)
      ),
    });

    return {
      ...ctx,
      needsHumanIntervention: true,
      conflictDetails: result.mergeResults.flatMap(r => r.conflicts),
    };
  });

  // Node: Run integration tests
  graph.addNode('integration_tests', async (ctx: StateContext) => {
    const tester = new TesterAgent();

    // Run full test suite on merged branch
    const testResult = await tester.execute({
      executionId: `test-merge-${ctx.featureId}`,
      task: ctx.task,
      context: ctx,
    });

    return {
      ...ctx,
      integrationTestResult: testResult,
      integrationTestsPassed: !testResult.routingHints.hasFailures,
    };
  });

  // Node: Merge complete
  graph.addNode('merge_complete', async (ctx: StateContext) => {
    logger.info('Merge workflow complete', {
      featureId: ctx.featureId,
      status: ctx.mergeResult.status,
    });

    return {
      ...ctx,
      workflowStatus: 'complete',
      readyForIntegration: ctx.mergeResult.status === 'success',
    };
  });

  // Edges
  graph.addConditionalEdge('check_readiness', (ctx) => {
    return ctx.readyForMerge ? 'execute_merge' : 'merge_complete';
  });

  graph.addConditionalEdge('execute_merge', (ctx) => {
    const result = ctx.mergeResult as MergeWorkflowOutput;

    if (result.summary.conflictsPending > 0) {
      return 'handle_conflicts';
    }
    if (result.status === 'success') {
      return 'integration_tests';
    }
    return 'merge_complete';
  });

  graph.addEdge('handle_conflicts', 'merge_complete');

  graph.addConditionalEdge('integration_tests', (ctx) => {
    return ctx.integrationTestsPassed ? 'merge_complete' : 'merge_complete';
  });

  return graph;
}

/**
 * Execute merge workflow for a feature
 */
export async function executeMergeWorkflow(
  featureId: string,
  featureBranch: string,
  worktrees: WorktreeMergeStatus[]
): Promise<MergeWorkflowOutput> {
  const workflow = createMergeWorkflow();

  const initialContext: StateContext = {
    featureId,
    featureBranch,
    worktrees,
    task: { taskType: 'merge', complexity: 'medium' },
  };

  const result = await workflow.execute(initialContext);

  return result.mergeResult as MergeWorkflowOutput;
}
```

---

## Validation Checklist

```
□ Merge Workflow Schema
  □ WorktreeMergeStatusSchema defined
  □ MergeConflictSchema defined
  □ MergeResultSchema defined
  □ MergeWorkflowInputSchema defined
  □ MergeWorkflowOutputSchema defined

□ Conflict Resolution
  □ ImportConflictResolver works
  □ PackageJsonConflictResolver works
  □ StyleConflictResolver works
  □ ExportConflictResolver works
  □ ConflictResolutionEngine combines resolvers

□ Merge Coordinator Agent
  □ Extends BaseAgent correctly
  □ Checks review status before merge
  □ Executes merges in correct order
  □ Auto-resolves conflicts where possible
  □ Runs post-merge validation
  □ Cleans up worktrees on success

□ Merge Workflow
  □ Check readiness node works
  □ Execute merge node works
  □ Handle conflicts node works
  □ Integration tests node works
  □ Proper edge routing

□ All tests pass
  □ npm run test -- tests/workflows/merge-workflow
```

---

## Exports

```typescript
export {
  // Schemas
  WorktreeMergeStatusSchema,
  MergeConflictSchema,
  MergeResultSchema,
  MergeWorkflowInputSchema,
  MergeWorkflowOutputSchema,

  // Types
  WorktreeMergeStatus,
  MergeConflict,
  MergeResult,
  MergeWorkflowInput,
  MergeWorkflowOutput,

  // Conflict Resolution
  ConflictResolver,
  ImportConflictResolver,
  PackageJsonConflictResolver,
  StyleConflictResolver,
  ExportConflictResolver,
  ConflictResolutionEngine,

  // Agent
  MergeCoordinatorAgent,

  // Workflow
  createMergeWorkflow,
  executeMergeWorkflow,
};
```

---

## Next Step

Proceed to **18-INTEGRATION-BRANCH.md** to implement the integration branch management and feature merging.
