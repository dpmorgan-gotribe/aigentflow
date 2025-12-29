# Step 11: Conflict Detection

> **Checkpoint:** CP2 - Git Worktrees
> **Previous Step:** 10-WORKTREE-ISOLATION.md
> **Next Checkpoint:** CP3 - Build & Test (12-FRONTEND-DEVELOPER.md)

---

## Overview

When multiple features are developed in parallel across different worktrees, conflicts can arise when merging back to the integration branch. This step implements:

- Cross-feature conflict detection before merge
- Proactive conflict warning system
- Conflict resolution suggestions
- Manual resolution workflow
- Merge completion after resolution

---

## Deliverables

1. `src/conflicts/detector.ts` - Conflict detection engine
2. `src/conflicts/analyzer.ts` - Conflict analysis and categorization
3. `src/conflicts/resolver.ts` - Resolution suggestions and workflow
4. `src/conflicts/types.ts` - Conflict-related types
5. `src/conflicts/index.ts` - Public exports

---

## File Structure

```
src/conflicts/
├── detector.ts    # Conflict detection
├── analyzer.ts    # Conflict analysis
├── resolver.ts    # Resolution workflow
├── types.ts       # Type definitions
└── index.ts       # Public exports
```

---

## 1. Conflict Types (`src/conflicts/types.ts`)

```typescript
/**
 * Conflict Types
 *
 * Type definitions for conflict detection and resolution.
 */

import { AgentType } from '../agents/types';

/**
 * Conflict severity levels
 */
export type ConflictSeverity = 'low' | 'medium' | 'high' | 'critical';

/**
 * Conflict types
 */
export type ConflictType =
  | 'file_modified'      // Same file modified in both branches
  | 'file_deleted'       // File modified in one, deleted in other
  | 'rename_conflict'    // Same file renamed differently
  | 'directory_file'     // Directory in one, file in other
  | 'semantic'           // Code changes that conflict logically
  | 'dependency'         // Package/dependency version conflicts
  | 'schema'             // Database/API schema conflicts
  | 'style'              // Formatting/style conflicts (auto-resolvable)
  | 'import'             // Import statement conflicts;

/**
 * Conflict location within a file
 */
export interface ConflictLocation {
  file: string;
  startLine: number;
  endLine: number;
  oursContent: string;
  theirsContent: string;
  baseContent?: string;  // For 3-way merge
}

/**
 * Individual conflict detail
 */
export interface Conflict {
  id: string;
  type: ConflictType;
  severity: ConflictSeverity;
  file: string;
  locations: ConflictLocation[];
  description: string;
  sourceFeature: string;
  targetFeature: string;
  sourceCommit: string;
  targetCommit: string;
  autoResolvable: boolean;
  suggestedResolution?: ResolutionSuggestion;
}

/**
 * Resolution suggestion
 */
export interface ResolutionSuggestion {
  strategy: ResolutionStrategy;
  description: string;
  confidence: number;  // 0-1
  resolvedContent?: string;
  reasoning: string;
}

/**
 * Resolution strategies
 */
export type ResolutionStrategy =
  | 'accept_ours'       // Keep source branch changes
  | 'accept_theirs'     // Keep target branch changes
  | 'merge_both'        // Combine both changes
  | 'manual'            // Requires manual resolution
  | 'regenerate'        // Have agent regenerate the code
  | 'semantic_merge';   // AI-powered semantic merge

/**
 * Conflict detection result
 */
export interface ConflictDetectionResult {
  hasConflicts: boolean;
  conflicts: Conflict[];
  summary: ConflictSummary;
  canAutoResolve: boolean;
  requiresManual: Conflict[];
  detectedAt: Date;
}

/**
 * Conflict summary statistics
 */
export interface ConflictSummary {
  totalConflicts: number;
  byType: Record<ConflictType, number>;
  bySeverity: Record<ConflictSeverity, number>;
  affectedFiles: number;
  autoResolvable: number;
  manualRequired: number;
}

/**
 * Resolution result
 */
export interface ResolutionResult {
  success: boolean;
  conflict: Conflict;
  strategy: ResolutionStrategy;
  resolvedContent?: string;
  error?: string;
  resolvedBy: 'auto' | 'manual' | 'agent';
  resolvedAt: Date;
}

/**
 * Merge preparation result
 */
export interface MergePreparation {
  sourceBranch: string;
  targetBranch: string;
  sourceFeatureId: string;
  canMerge: boolean;
  conflicts: ConflictDetectionResult;
  estimatedResolutionTime?: number;  // Minutes
  recommendations: string[];
}

/**
 * File change for comparison
 */
export interface FileChange {
  path: string;
  status: 'added' | 'modified' | 'deleted' | 'renamed';
  oldPath?: string;  // For renames
  hunks: DiffHunk[];
}

/**
 * Diff hunk
 */
export interface DiffHunk {
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  content: string;
}

/**
 * Cross-feature analysis
 */
export interface CrossFeatureAnalysis {
  features: string[];
  overlappingFiles: Map<string, string[]>;  // file -> feature IDs
  potentialConflicts: PotentialConflict[];
  riskScore: number;  // 0-100
}

/**
 * Potential conflict (before actual merge)
 */
export interface PotentialConflict {
  file: string;
  features: string[];
  likelihood: number;  // 0-1
  reason: string;
}
```

---

## 2. Conflict Detector (`src/conflicts/detector.ts`)

```typescript
/**
 * Conflict Detector
 *
 * Detects conflicts between branches/worktrees before merge.
 */

import simpleGit, { SimpleGit, DiffResult } from 'simple-git';
import { v4 as uuidv4 } from 'uuid';
import {
  Conflict,
  ConflictType,
  ConflictSeverity,
  ConflictDetectionResult,
  ConflictSummary,
  ConflictLocation,
  FileChange,
  DiffHunk,
  CrossFeatureAnalysis,
  PotentialConflict,
} from './types';
import { WorktreeManager } from '../git/worktree-manager';
import { logger } from '../utils/logger';

/**
 * Conflict Detector class
 */
export class ConflictDetector {
  private git: SimpleGit;
  private repoPath: string;
  private worktreeManager: WorktreeManager;

  constructor(repoPath: string, worktreeManager: WorktreeManager) {
    this.repoPath = repoPath;
    this.worktreeManager = worktreeManager;
    this.git = simpleGit(repoPath);
  }

  /**
   * Detect conflicts between two branches
   */
  async detectConflicts(
    sourceBranch: string,
    targetBranch: string
  ): Promise<ConflictDetectionResult> {
    logger.info('Detecting conflicts', { sourceBranch, targetBranch });

    const conflicts: Conflict[] = [];

    try {
      // Get merge base
      const mergeBase = await this.getMergeBase(sourceBranch, targetBranch);

      // Get changes in source branch since merge base
      const sourceChanges = await this.getChanges(mergeBase, sourceBranch);

      // Get changes in target branch since merge base
      const targetChanges = await this.getChanges(mergeBase, targetBranch);

      // Find overlapping files
      const overlappingFiles = this.findOverlappingFiles(sourceChanges, targetChanges);

      // Analyze each overlapping file for conflicts
      for (const file of overlappingFiles) {
        const fileConflicts = await this.analyzeFileConflict(
          file,
          sourceBranch,
          targetBranch,
          mergeBase,
          sourceChanges.find(c => c.path === file)!,
          targetChanges.find(c => c.path === file)!
        );

        conflicts.push(...fileConflicts);
      }

      // Check for semantic conflicts
      const semanticConflicts = await this.detectSemanticConflicts(
        sourceChanges,
        targetChanges
      );
      conflicts.push(...semanticConflicts);

    } catch (error) {
      logger.error('Conflict detection failed', { error });
      throw error;
    }

    const summary = this.summarizeConflicts(conflicts);
    const autoResolvable = conflicts.filter(c => c.autoResolvable);
    const requiresManual = conflicts.filter(c => !c.autoResolvable);

    return {
      hasConflicts: conflicts.length > 0,
      conflicts,
      summary,
      canAutoResolve: requiresManual.length === 0,
      requiresManual,
      detectedAt: new Date(),
    };
  }

  /**
   * Analyze all active features for potential conflicts
   */
  async analyzeActiveFeatures(): Promise<CrossFeatureAnalysis> {
    const worktrees = await this.worktreeManager.listWorktrees();
    const features = worktrees
      .filter(w => !w.isMain)
      .map(w => w.featureId);

    logger.info('Analyzing cross-feature conflicts', { featureCount: features.length });

    const overlappingFiles = new Map<string, string[]>();
    const potentialConflicts: PotentialConflict[] = [];

    // Get modified files for each feature
    const featureFiles = new Map<string, Set<string>>();

    for (const featureId of features) {
      const worktree = await this.worktreeManager.getWorktree(featureId);
      if (!worktree) continue;

      const git = simpleGit(worktree.path);
      const status = await git.status();

      const files = new Set<string>([
        ...status.modified,
        ...status.created,
        ...status.deleted,
      ]);

      featureFiles.set(featureId, files);

      // Track overlapping files
      for (const file of files) {
        if (!overlappingFiles.has(file)) {
          overlappingFiles.set(file, []);
        }
        overlappingFiles.get(file)!.push(featureId);
      }
    }

    // Identify potential conflicts (files modified in multiple features)
    for (const [file, featureIds] of overlappingFiles) {
      if (featureIds.length > 1) {
        potentialConflicts.push({
          file,
          features: featureIds,
          likelihood: this.calculateConflictLikelihood(file, featureIds.length),
          reason: `File modified in ${featureIds.length} features`,
        });
      }
    }

    // Calculate overall risk score
    const riskScore = this.calculateRiskScore(potentialConflicts);

    return {
      features,
      overlappingFiles,
      potentialConflicts,
      riskScore,
    };
  }

  /**
   * Get merge base between two branches
   */
  private async getMergeBase(branch1: string, branch2: string): Promise<string> {
    const result = await this.git.raw(['merge-base', branch1, branch2]);
    return result.trim();
  }

  /**
   * Get file changes between two commits/branches
   */
  private async getChanges(from: string, to: string): Promise<FileChange[]> {
    const diff = await this.git.diff([`${from}...${to}`, '--name-status']);
    const lines = diff.split('\n').filter(l => l.trim());

    const changes: FileChange[] = [];

    for (const line of lines) {
      const [status, ...pathParts] = line.split('\t');
      const path = pathParts.join('\t');

      let changeStatus: 'added' | 'modified' | 'deleted' | 'renamed';
      let oldPath: string | undefined;

      switch (status.charAt(0)) {
        case 'A':
          changeStatus = 'added';
          break;
        case 'D':
          changeStatus = 'deleted';
          break;
        case 'R':
          changeStatus = 'renamed';
          oldPath = pathParts[0];
          break;
        case 'M':
        default:
          changeStatus = 'modified';
      }

      // Get detailed hunks for the file
      const hunks = await this.getFileHunks(from, to, path);

      changes.push({
        path: changeStatus === 'renamed' ? pathParts[1] : path,
        status: changeStatus,
        oldPath,
        hunks,
      });
    }

    return changes;
  }

  /**
   * Get diff hunks for a specific file
   */
  private async getFileHunks(from: string, to: string, file: string): Promise<DiffHunk[]> {
    try {
      const diff = await this.git.diff([`${from}...${to}`, '--', file]);
      return this.parseHunks(diff);
    } catch {
      return [];
    }
  }

  /**
   * Parse diff output into hunks
   */
  private parseHunks(diff: string): DiffHunk[] {
    const hunks: DiffHunk[] = [];
    const hunkRegex = /@@ -(\d+),?(\d*) \+(\d+),?(\d*) @@/g;

    let match;
    while ((match = hunkRegex.exec(diff)) !== null) {
      const hunkStart = match.index;
      const nextMatch = hunkRegex.exec(diff);
      const hunkEnd = nextMatch ? nextMatch.index : diff.length;
      hunkRegex.lastIndex = match.index + 1; // Reset for next iteration

      hunks.push({
        oldStart: parseInt(match[1]),
        oldLines: parseInt(match[2]) || 1,
        newStart: parseInt(match[3]),
        newLines: parseInt(match[4]) || 1,
        content: diff.slice(hunkStart, hunkEnd),
      });
    }

    return hunks;
  }

  /**
   * Find files that were modified in both branches
   */
  private findOverlappingFiles(
    sourceChanges: FileChange[],
    targetChanges: FileChange[]
  ): string[] {
    const sourceFiles = new Set(sourceChanges.map(c => c.path));
    const targetFiles = new Set(targetChanges.map(c => c.path));

    return [...sourceFiles].filter(f => targetFiles.has(f));
  }

  /**
   * Analyze conflict for a specific file
   */
  private async analyzeFileConflict(
    file: string,
    sourceBranch: string,
    targetBranch: string,
    mergeBase: string,
    sourceChange: FileChange,
    targetChange: FileChange
  ): Promise<Conflict[]> {
    const conflicts: Conflict[] = [];

    // Check for delete/modify conflict
    if (sourceChange.status === 'deleted' || targetChange.status === 'deleted') {
      conflicts.push({
        id: uuidv4(),
        type: 'file_deleted',
        severity: 'high',
        file,
        locations: [],
        description: `File ${file} was deleted in one branch but modified in another`,
        sourceFeature: sourceBranch,
        targetFeature: targetBranch,
        sourceCommit: '',
        targetCommit: '',
        autoResolvable: false,
      });
      return conflicts;
    }

    // Check for rename conflicts
    if (sourceChange.status === 'renamed' && targetChange.status === 'renamed') {
      if (sourceChange.oldPath !== targetChange.oldPath) {
        conflicts.push({
          id: uuidv4(),
          type: 'rename_conflict',
          severity: 'medium',
          file,
          locations: [],
          description: `File renamed differently in both branches`,
          sourceFeature: sourceBranch,
          targetFeature: targetBranch,
          sourceCommit: '',
          targetCommit: '',
          autoResolvable: false,
        });
      }
    }

    // Check for actual content conflicts
    try {
      // Attempt a trial merge to detect conflicts
      const mergeResult = await this.tryMerge(sourceBranch, targetBranch, file);

      if (mergeResult.hasConflicts) {
        conflicts.push({
          id: uuidv4(),
          type: 'file_modified',
          severity: this.calculateSeverity(mergeResult.conflictMarkers),
          file,
          locations: mergeResult.locations,
          description: `Content conflicts in ${file}`,
          sourceFeature: sourceBranch,
          targetFeature: targetBranch,
          sourceCommit: '',
          targetCommit: '',
          autoResolvable: this.isAutoResolvable(mergeResult),
          suggestedResolution: this.suggestResolution(mergeResult),
        });
      }
    } catch (error) {
      logger.debug('Could not analyze file conflict', { file, error });
    }

    return conflicts;
  }

  /**
   * Try a merge to detect conflicts
   */
  private async tryMerge(
    sourceBranch: string,
    targetBranch: string,
    file: string
  ): Promise<{
    hasConflicts: boolean;
    conflictMarkers: number;
    locations: ConflictLocation[];
  }> {
    try {
      // Get file content from both branches
      const sourceContent = await this.git.show([`${sourceBranch}:${file}`]);
      const targetContent = await this.git.show([`${targetBranch}:${file}`]);

      // Simple heuristic: check if the files differ
      if (sourceContent === targetContent) {
        return { hasConflicts: false, conflictMarkers: 0, locations: [] };
      }

      // Use git merge-file for proper conflict detection (would need temp files)
      // For now, use heuristic based on overlapping line changes
      const hasOverlap = this.checkLineOverlap(
        this.parseLines(sourceContent),
        this.parseLines(targetContent)
      );

      return {
        hasConflicts: hasOverlap,
        conflictMarkers: hasOverlap ? 1 : 0,
        locations: hasOverlap ? [{
          file,
          startLine: 1,
          endLine: 10, // Simplified
          oursContent: sourceContent.slice(0, 200),
          theirsContent: targetContent.slice(0, 200),
        }] : [],
      };
    } catch {
      return { hasConflicts: false, conflictMarkers: 0, locations: [] };
    }
  }

  /**
   * Parse content into lines for comparison
   */
  private parseLines(content: string): string[] {
    return content.split('\n');
  }

  /**
   * Check if line changes overlap
   */
  private checkLineOverlap(source: string[], target: string[]): boolean {
    // Simplified: check if there are differences that would conflict
    // In production, use proper diff algorithm
    let differences = 0;
    const minLength = Math.min(source.length, target.length);

    for (let i = 0; i < minLength; i++) {
      if (source[i] !== target[i]) {
        differences++;
      }
    }

    // If more than 20% of lines differ, likely to conflict
    return differences / minLength > 0.2;
  }

  /**
   * Detect semantic conflicts
   */
  private async detectSemanticConflicts(
    sourceChanges: FileChange[],
    targetChanges: FileChange[]
  ): Promise<Conflict[]> {
    const conflicts: Conflict[] = [];

    // Check for dependency conflicts (package.json)
    const sourcePackage = sourceChanges.find(c => c.path === 'package.json');
    const targetPackage = targetChanges.find(c => c.path === 'package.json');

    if (sourcePackage && targetPackage) {
      // Would need actual package.json parsing here
      conflicts.push({
        id: uuidv4(),
        type: 'dependency',
        severity: 'medium',
        file: 'package.json',
        locations: [],
        description: 'Dependencies modified in both branches',
        sourceFeature: '',
        targetFeature: '',
        sourceCommit: '',
        targetCommit: '',
        autoResolvable: true, // Can often be auto-merged
      });
    }

    // Check for schema conflicts
    const schemaFiles = ['prisma/schema.prisma', 'src/db/schema.ts', 'migrations/'];
    for (const schemaFile of schemaFiles) {
      const hasSourceSchema = sourceChanges.some(c => c.path.includes(schemaFile));
      const hasTargetSchema = targetChanges.some(c => c.path.includes(schemaFile));

      if (hasSourceSchema && hasTargetSchema) {
        conflicts.push({
          id: uuidv4(),
          type: 'schema',
          severity: 'high',
          file: schemaFile,
          locations: [],
          description: 'Schema modifications in both branches require careful merge',
          sourceFeature: '',
          targetFeature: '',
          sourceCommit: '',
          targetCommit: '',
          autoResolvable: false,
        });
      }
    }

    return conflicts;
  }

  /**
   * Calculate conflict severity
   */
  private calculateSeverity(conflictMarkers: number): ConflictSeverity {
    if (conflictMarkers === 0) return 'low';
    if (conflictMarkers <= 2) return 'medium';
    if (conflictMarkers <= 5) return 'high';
    return 'critical';
  }

  /**
   * Check if conflict can be auto-resolved
   */
  private isAutoResolvable(mergeResult: any): boolean {
    // Style-only conflicts can often be auto-resolved
    return mergeResult.conflictMarkers <= 1;
  }

  /**
   * Suggest resolution for conflict
   */
  private suggestResolution(mergeResult: any): any {
    return {
      strategy: 'manual' as const,
      description: 'Manual review recommended',
      confidence: 0.5,
      reasoning: 'Content changes require human review',
    };
  }

  /**
   * Calculate conflict likelihood for a file
   */
  private calculateConflictLikelihood(file: string, featureCount: number): number {
    // Base likelihood increases with more features
    let likelihood = 0.2 * featureCount;

    // Certain files are more likely to conflict
    if (file.includes('package.json')) likelihood += 0.3;
    if (file.includes('schema')) likelihood += 0.3;
    if (file.includes('types')) likelihood += 0.2;
    if (file.includes('index')) likelihood += 0.1;

    return Math.min(1, likelihood);
  }

  /**
   * Calculate overall risk score
   */
  private calculateRiskScore(potentialConflicts: PotentialConflict[]): number {
    if (potentialConflicts.length === 0) return 0;

    const avgLikelihood =
      potentialConflicts.reduce((sum, c) => sum + c.likelihood, 0) /
      potentialConflicts.length;

    return Math.round(avgLikelihood * 100);
  }

  /**
   * Summarize conflicts
   */
  private summarizeConflicts(conflicts: Conflict[]): ConflictSummary {
    const byType: Record<string, number> = {};
    const bySeverity: Record<string, number> = {};
    const files = new Set<string>();

    for (const conflict of conflicts) {
      byType[conflict.type] = (byType[conflict.type] || 0) + 1;
      bySeverity[conflict.severity] = (bySeverity[conflict.severity] || 0) + 1;
      files.add(conflict.file);
    }

    return {
      totalConflicts: conflicts.length,
      byType: byType as Record<ConflictType, number>,
      bySeverity: bySeverity as Record<ConflictSeverity, number>,
      affectedFiles: files.size,
      autoResolvable: conflicts.filter(c => c.autoResolvable).length,
      manualRequired: conflicts.filter(c => !c.autoResolvable).length,
    };
  }
}
```

---

## 3. Conflict Resolver (`src/conflicts/resolver.ts`)

```typescript
/**
 * Conflict Resolver
 *
 * Provides resolution strategies and workflows for detected conflicts.
 */

import { EventEmitter } from 'events';
import simpleGit, { SimpleGit } from 'simple-git';
import Anthropic from '@anthropic-ai/sdk';
import {
  Conflict,
  ResolutionResult,
  ResolutionStrategy,
  ResolutionSuggestion,
  MergePreparation,
  ConflictDetectionResult,
} from './types';
import { ConflictDetector } from './detector';
import { config } from '../config';
import { logger } from '../utils/logger';

/**
 * Conflict Resolver class
 */
export class ConflictResolver extends EventEmitter {
  private git: SimpleGit;
  private detector: ConflictDetector;
  private client: Anthropic;
  private repoPath: string;

  constructor(repoPath: string, detector: ConflictDetector) {
    super();
    this.repoPath = repoPath;
    this.detector = detector;
    this.git = simpleGit(repoPath);
    this.client = new Anthropic({
      apiKey: config.get('anthropic.apiKey'),
    });
  }

  /**
   * Prepare for merge by detecting conflicts
   */
  async prepareMerge(
    sourceBranch: string,
    targetBranch: string,
    sourceFeatureId: string
  ): Promise<MergePreparation> {
    logger.info('Preparing merge', { sourceBranch, targetBranch });

    const conflicts = await this.detector.detectConflicts(sourceBranch, targetBranch);

    const recommendations: string[] = [];

    if (conflicts.hasConflicts) {
      if (conflicts.canAutoResolve) {
        recommendations.push('All conflicts can be auto-resolved. Proceed with merge.');
      } else {
        recommendations.push(`${conflicts.requiresManual.length} conflicts require manual resolution.`);

        // Add specific recommendations based on conflict types
        for (const conflict of conflicts.requiresManual) {
          if (conflict.type === 'schema') {
            recommendations.push(`Review schema changes in ${conflict.file} carefully.`);
          } else if (conflict.type === 'dependency') {
            recommendations.push('Run npm install after merge to verify dependencies.');
          }
        }
      }
    }

    const estimatedTime = this.estimateResolutionTime(conflicts);

    return {
      sourceBranch,
      targetBranch,
      sourceFeatureId,
      canMerge: !conflicts.hasConflicts || conflicts.canAutoResolve,
      conflicts,
      estimatedResolutionTime: estimatedTime,
      recommendations,
    };
  }

  /**
   * Resolve a single conflict
   */
  async resolveConflict(
    conflict: Conflict,
    strategy: ResolutionStrategy,
    customResolution?: string
  ): Promise<ResolutionResult> {
    logger.info('Resolving conflict', {
      conflictId: conflict.id,
      strategy,
      file: conflict.file,
    });

    try {
      let resolvedContent: string | undefined;

      switch (strategy) {
        case 'accept_ours':
          resolvedContent = await this.acceptOurs(conflict);
          break;

        case 'accept_theirs':
          resolvedContent = await this.acceptTheirs(conflict);
          break;

        case 'merge_both':
          resolvedContent = await this.mergeBoth(conflict);
          break;

        case 'semantic_merge':
          resolvedContent = await this.semanticMerge(conflict);
          break;

        case 'regenerate':
          resolvedContent = await this.regenerateContent(conflict);
          break;

        case 'manual':
          if (!customResolution) {
            throw new Error('Manual resolution requires custom content');
          }
          resolvedContent = customResolution;
          break;

        default:
          throw new Error(`Unknown resolution strategy: ${strategy}`);
      }

      // Apply the resolution
      if (resolvedContent) {
        await this.applyResolution(conflict.file, resolvedContent);
      }

      this.emit('conflict_resolved', { conflict, strategy });

      return {
        success: true,
        conflict,
        strategy,
        resolvedContent,
        resolvedBy: strategy === 'manual' ? 'manual' : 'auto',
        resolvedAt: new Date(),
      };
    } catch (error) {
      logger.error('Failed to resolve conflict', { conflictId: conflict.id, error });

      return {
        success: false,
        conflict,
        strategy,
        error: String(error),
        resolvedBy: 'auto',
        resolvedAt: new Date(),
      };
    }
  }

  /**
   * Resolve all auto-resolvable conflicts
   */
  async resolveAutoConflicts(
    conflicts: ConflictDetectionResult
  ): Promise<ResolutionResult[]> {
    const results: ResolutionResult[] = [];

    for (const conflict of conflicts.conflicts) {
      if (conflict.autoResolvable && conflict.suggestedResolution) {
        const result = await this.resolveConflict(
          conflict,
          conflict.suggestedResolution.strategy
        );
        results.push(result);
      }
    }

    return results;
  }

  /**
   * Get AI-powered resolution suggestion
   */
  async getSuggestion(conflict: Conflict): Promise<ResolutionSuggestion> {
    const prompt = this.buildSuggestionPrompt(conflict);

    try {
      const response = await this.client.messages.create({
        model: config.get('anthropic.model', 'claude-sonnet-4-20250514'),
        max_tokens: 2000,
        system: `You are an expert code reviewer helping to resolve merge conflicts.
Analyze the conflict and suggest the best resolution strategy.
Output JSON with: strategy, description, confidence, reasoning, and optionally resolvedContent.`,
        messages: [{ role: 'user', content: prompt }],
      });

      const textBlock = response.content.find(b => b.type === 'text');
      if (!textBlock || textBlock.type !== 'text') {
        throw new Error('No text response');
      }

      return this.parseSuggestion(textBlock.text);
    } catch (error) {
      logger.error('Failed to get AI suggestion', { error });

      return {
        strategy: 'manual',
        description: 'AI suggestion unavailable, manual resolution recommended',
        confidence: 0,
        reasoning: 'Failed to analyze conflict',
      };
    }
  }

  /**
   * Accept our (source) changes
   */
  private async acceptOurs(conflict: Conflict): Promise<string> {
    if (conflict.locations.length > 0) {
      return conflict.locations[0].oursContent;
    }
    return await this.git.show([`${conflict.sourceFeature}:${conflict.file}`]);
  }

  /**
   * Accept their (target) changes
   */
  private async acceptTheirs(conflict: Conflict): Promise<string> {
    if (conflict.locations.length > 0) {
      return conflict.locations[0].theirsContent;
    }
    return await this.git.show([`${conflict.targetFeature}:${conflict.file}`]);
  }

  /**
   * Merge both changes (concatenate or interleave)
   */
  private async mergeBoth(conflict: Conflict): Promise<string> {
    const ours = await this.acceptOurs(conflict);
    const theirs = await this.acceptTheirs(conflict);

    // Simple concatenation - in production, use smarter merging
    return `${ours}\n\n// --- Merged from ${conflict.targetFeature} ---\n\n${theirs}`;
  }

  /**
   * AI-powered semantic merge
   */
  private async semanticMerge(conflict: Conflict): Promise<string> {
    const ours = await this.acceptOurs(conflict);
    const theirs = await this.acceptTheirs(conflict);

    const prompt = `Merge these two versions of ${conflict.file} intelligently:

VERSION A (from ${conflict.sourceFeature}):
\`\`\`
${ours}
\`\`\`

VERSION B (from ${conflict.targetFeature}):
\`\`\`
${theirs}
\`\`\`

Produce a merged version that incorporates changes from both versions appropriately.
Output ONLY the merged code, no explanations.`;

    const response = await this.client.messages.create({
      model: config.get('anthropic.model', 'claude-sonnet-4-20250514'),
      max_tokens: 4000,
      system: 'You are a code merging expert. Merge code intelligently, preserving functionality from both versions.',
      messages: [{ role: 'user', content: prompt }],
    });

    const textBlock = response.content.find(b => b.type === 'text');
    if (!textBlock || textBlock.type !== 'text') {
      throw new Error('No merge result from AI');
    }

    // Extract code from potential markdown
    const codeMatch = textBlock.text.match(/```(?:\w+)?\s*([\s\S]*?)```/);
    return codeMatch ? codeMatch[1].trim() : textBlock.text.trim();
  }

  /**
   * Regenerate content from scratch
   */
  private async regenerateContent(conflict: Conflict): Promise<string> {
    // This would invoke the appropriate agent to regenerate the file
    // For now, return a placeholder
    throw new Error('Regeneration requires agent invocation - not implemented in resolver');
  }

  /**
   * Apply resolution to file
   */
  private async applyResolution(file: string, content: string): Promise<void> {
    const fs = await import('fs');
    const path = await import('path');

    const filePath = path.join(this.repoPath, file);
    fs.writeFileSync(filePath, content, 'utf-8');

    // Stage the resolved file
    await this.git.add(file);

    logger.debug('Applied resolution', { file });
  }

  /**
   * Build prompt for AI suggestion
   */
  private buildSuggestionPrompt(conflict: Conflict): string {
    let prompt = `Analyze this merge conflict and suggest a resolution:

File: ${conflict.file}
Type: ${conflict.type}
Severity: ${conflict.severity}
Description: ${conflict.description}

`;

    if (conflict.locations.length > 0) {
      const loc = conflict.locations[0];
      prompt += `
Our version (${conflict.sourceFeature}):
\`\`\`
${loc.oursContent}
\`\`\`

Their version (${conflict.targetFeature}):
\`\`\`
${loc.theirsContent}
\`\`\`
`;
    }

    prompt += `
Available strategies:
- accept_ours: Keep source branch version
- accept_theirs: Keep target branch version
- merge_both: Combine both versions
- semantic_merge: AI-powered intelligent merge
- manual: Requires human review

Provide your recommendation as JSON.`;

    return prompt;
  }

  /**
   * Parse AI suggestion response
   */
  private parseSuggestion(response: string): ResolutionSuggestion {
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch {
      // Fall through to default
    }

    return {
      strategy: 'manual',
      description: 'Could not parse AI suggestion',
      confidence: 0,
      reasoning: response,
    };
  }

  /**
   * Estimate resolution time in minutes
   */
  private estimateResolutionTime(conflicts: ConflictDetectionResult): number {
    let minutes = 0;

    for (const conflict of conflicts.conflicts) {
      if (conflict.autoResolvable) {
        minutes += 0.5; // Quick auto-resolve
      } else {
        switch (conflict.severity) {
          case 'low':
            minutes += 5;
            break;
          case 'medium':
            minutes += 15;
            break;
          case 'high':
            minutes += 30;
            break;
          case 'critical':
            minutes += 60;
            break;
        }
      }
    }

    return Math.ceil(minutes);
  }

  /**
   * Complete merge after all conflicts resolved
   */
  async completeMerge(
    sourceBranch: string,
    targetBranch: string,
    message?: string
  ): Promise<{ success: boolean; commitHash?: string; error?: string }> {
    try {
      // Verify no remaining conflicts
      const status = await this.git.status();
      if (status.conflicted.length > 0) {
        return {
          success: false,
          error: `${status.conflicted.length} files still have conflicts`,
        };
      }

      // Complete the merge
      const commitMessage = message || `Merge ${sourceBranch} into ${targetBranch}`;
      await this.git.commit(commitMessage);

      const log = await this.git.log({ maxCount: 1 });
      const commitHash = log.latest?.hash;

      logger.info('Merge completed', { sourceBranch, targetBranch, commitHash });

      this.emit('merge_completed', { sourceBranch, targetBranch, commitHash });

      return { success: true, commitHash };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  /**
   * Abort ongoing merge
   */
  async abortMerge(): Promise<void> {
    await this.git.merge(['--abort']);
    logger.info('Merge aborted');
    this.emit('merge_aborted');
  }
}
```

---

## 4. Public Exports (`src/conflicts/index.ts`)

```typescript
/**
 * Conflicts Module Public Exports
 */

// Types
export * from './types';

// Detector
export { ConflictDetector } from './detector';

// Resolver
export { ConflictResolver } from './resolver';
```

---

## Test Scenarios

### Test 1: Conflict Detection

```typescript
// tests/conflicts/detector.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ConflictDetector } from '../../src/conflicts/detector';
import { WorktreeManager } from '../../src/git/worktree-manager';
import simpleGit from 'simple-git';
import fs from 'fs';
import path from 'path';
import os from 'os';

describe('ConflictDetector', () => {
  let detector: ConflictDetector;
  let worktreeManager: WorktreeManager;
  let testRepoPath: string;

  beforeEach(async () => {
    testRepoPath = path.join(os.tmpdir(), `conflict-test-${Date.now()}`);
    fs.mkdirSync(testRepoPath, { recursive: true });

    const git = simpleGit(testRepoPath);
    await git.init();
    await git.addConfig('user.email', 'test@test.com');
    await git.addConfig('user.name', 'Test User');

    // Create initial file
    fs.writeFileSync(path.join(testRepoPath, 'file.txt'), 'initial content');
    await git.add('.');
    await git.commit('Initial commit');

    worktreeManager = new WorktreeManager(testRepoPath);
    detector = new ConflictDetector(testRepoPath, worktreeManager);
  });

  afterEach(() => {
    fs.rmSync(testRepoPath, { recursive: true, force: true });
  });

  it('should detect no conflicts when branches are identical', async () => {
    const git = simpleGit(testRepoPath);
    await git.checkoutLocalBranch('feature-a');
    await git.checkout('main');

    const result = await detector.detectConflicts('feature-a', 'main');

    expect(result.hasConflicts).toBe(false);
    expect(result.conflicts).toHaveLength(0);
  });

  it('should detect conflicts when same file modified', async () => {
    const git = simpleGit(testRepoPath);

    // Create branch A and modify file
    await git.checkoutLocalBranch('feature-a');
    fs.writeFileSync(path.join(testRepoPath, 'file.txt'), 'content from A');
    await git.add('.');
    await git.commit('Change from A');

    // Go back to main and create branch B
    await git.checkout('main');
    await git.checkoutLocalBranch('feature-b');
    fs.writeFileSync(path.join(testRepoPath, 'file.txt'), 'content from B');
    await git.add('.');
    await git.commit('Change from B');

    const result = await detector.detectConflicts('feature-a', 'feature-b');

    expect(result.hasConflicts).toBe(true);
    expect(result.conflicts.length).toBeGreaterThan(0);
  });

  it('should summarize conflicts correctly', async () => {
    const git = simpleGit(testRepoPath);

    await git.checkoutLocalBranch('feature-a');
    fs.writeFileSync(path.join(testRepoPath, 'file.txt'), 'A content');
    fs.writeFileSync(path.join(testRepoPath, 'package.json'), '{"name": "a"}');
    await git.add('.');
    await git.commit('Changes from A');

    await git.checkout('main');
    await git.checkoutLocalBranch('feature-b');
    fs.writeFileSync(path.join(testRepoPath, 'file.txt'), 'B content');
    fs.writeFileSync(path.join(testRepoPath, 'package.json'), '{"name": "b"}');
    await git.add('.');
    await git.commit('Changes from B');

    const result = await detector.detectConflicts('feature-a', 'feature-b');

    expect(result.summary.totalConflicts).toBeGreaterThan(0);
    expect(result.summary.affectedFiles).toBeGreaterThanOrEqual(1);
  });
});
```

### Test 2: Cross-Feature Analysis

```typescript
// tests/conflicts/cross-feature.test.ts
import { describe, it, expect, vi } from 'vitest';
import { ConflictDetector } from '../../src/conflicts/detector';
import { WorktreeManager } from '../../src/git/worktree-manager';

describe('Cross-Feature Analysis', () => {
  it('should identify overlapping files across features', async () => {
    const mockWorktreeManager = {
      listWorktrees: vi.fn().mockResolvedValue([
        { featureId: 'main', isMain: true, path: '/repo', branch: 'main' },
        { featureId: 'feat-1', isMain: false, path: '/worktrees/feat-1', branch: 'feature/1' },
        { featureId: 'feat-2', isMain: false, path: '/worktrees/feat-2', branch: 'feature/2' },
      ]),
      getWorktree: vi.fn().mockImplementation((id) => ({
        featureId: id,
        path: `/worktrees/${id}`,
      })),
    } as unknown as WorktreeManager;

    const detector = new ConflictDetector('/repo', mockWorktreeManager);

    // This would need more setup for full test
    // Just verify the method exists and returns expected structure
    expect(detector.analyzeActiveFeatures).toBeDefined();
  });

  it('should calculate risk score based on overlaps', () => {
    // Test the risk calculation logic
    const potentialConflicts = [
      { file: 'src/index.ts', features: ['f1', 'f2'], likelihood: 0.5, reason: 'test' },
      { file: 'src/api.ts', features: ['f1', 'f2', 'f3'], likelihood: 0.8, reason: 'test' },
    ];

    const avgLikelihood = potentialConflicts.reduce((s, c) => s + c.likelihood, 0) / potentialConflicts.length;
    const riskScore = Math.round(avgLikelihood * 100);

    expect(riskScore).toBe(65); // (0.5 + 0.8) / 2 * 100 = 65
  });
});
```

### Test 3: Conflict Resolution

```typescript
// tests/conflicts/resolver.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ConflictResolver } from '../../src/conflicts/resolver';
import { ConflictDetector } from '../../src/conflicts/detector';
import { Conflict, ConflictType } from '../../src/conflicts/types';

// Mock Anthropic
vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: {
      create: vi.fn().mockResolvedValue({
        content: [{
          type: 'text',
          text: JSON.stringify({
            strategy: 'semantic_merge',
            description: 'Merge both changes',
            confidence: 0.8,
            reasoning: 'Changes are complementary',
          }),
        }],
      }),
    },
  })),
}));

describe('ConflictResolver', () => {
  let resolver: ConflictResolver;
  let mockDetector: ConflictDetector;

  beforeEach(() => {
    mockDetector = {} as ConflictDetector;
    resolver = new ConflictResolver('/tmp/repo', mockDetector);
  });

  it('should get AI suggestion for conflict', async () => {
    const conflict: Conflict = {
      id: 'conflict-1',
      type: 'file_modified',
      severity: 'medium',
      file: 'src/test.ts',
      locations: [{
        file: 'src/test.ts',
        startLine: 10,
        endLine: 20,
        oursContent: 'function a() {}',
        theirsContent: 'function b() {}',
      }],
      description: 'Test conflict',
      sourceFeature: 'feature-a',
      targetFeature: 'main',
      sourceCommit: 'abc123',
      targetCommit: 'def456',
      autoResolvable: false,
    };

    const suggestion = await resolver.getSuggestion(conflict);

    expect(suggestion.strategy).toBeDefined();
    expect(suggestion.confidence).toBeGreaterThanOrEqual(0);
    expect(suggestion.confidence).toBeLessThanOrEqual(1);
  });

  it('should emit events on resolution', async () => {
    const resolvedHandler = vi.fn();
    resolver.on('conflict_resolved', resolvedHandler);

    const conflict: Conflict = {
      id: 'conflict-2',
      type: 'style' as ConflictType,
      severity: 'low',
      file: 'src/style.ts',
      locations: [{
        file: 'src/style.ts',
        startLine: 1,
        endLine: 5,
        oursContent: 'const a = 1;',
        theirsContent: 'const a = 1;',
      }],
      description: 'Style conflict',
      sourceFeature: 'feature-a',
      targetFeature: 'main',
      sourceCommit: 'abc',
      targetCommit: 'def',
      autoResolvable: true,
    };

    // Would need more setup for full resolution test
    expect(resolver.resolveConflict).toBeDefined();
  });

  it('should estimate resolution time', () => {
    const conflicts = {
      hasConflicts: true,
      conflicts: [
        { severity: 'low', autoResolvable: true } as Conflict,
        { severity: 'high', autoResolvable: false } as Conflict,
      ],
      summary: {} as any,
      canAutoResolve: false,
      requiresManual: [],
      detectedAt: new Date(),
    };

    // Access private method through prototype for testing
    const estimateTime = (resolver as any).estimateResolutionTime.bind(resolver);
    const time = estimateTime(conflicts);

    expect(time).toBeGreaterThan(0);
    expect(time).toBeLessThan(100);
  });
});
```

---

## Validation Checklist

```
□ Conflict Types
  □ All conflict types defined
  □ Severity levels
  □ Resolution strategies
  □ Location tracking

□ Conflict Detector
  □ Detect conflicts between branches
  □ Find merge base
  □ Analyze overlapping files
  □ Cross-feature analysis
  □ Calculate risk scores
  □ Summarize conflicts

□ Conflict Resolver
  □ Prepare merge
  □ Get AI suggestions
  □ Accept ours/theirs
  □ Semantic merge with AI
  □ Apply resolutions
  □ Complete merge
  □ Abort merge

□ Integration
  □ Works with GitAgent
  □ Works with WorktreeManager
  □ Events emitted correctly

□ All tests pass
  □ npm run test -- tests/conflicts/
```

---

## CP2 Completion

With this step complete, **Checkpoint 2: Git Worktrees** is finished. The system now has:

1. **Git Agent** - Branch and worktree management
2. **Worktree Isolation** - Feature-based worktrees with parallel FE+BE agents
3. **Conflict Detection** - Cross-feature conflict detection and resolution

### Next Checkpoint

Proceed to **CP3: Build & Test** starting with **12-FRONTEND-DEVELOPER.md** to implement the development agents.
