/**
 * Conflict Resolver
 *
 * Provides resolution strategies for Git conflicts.
 */

import { logger } from '../utils/logger.js';
import type {
  ConflictInfo,
  ConflictType,
  ConflictResolution,
  GitEvent,
} from './types.js';
import type {
  ExtendedConflictInfo,
  ConflictSeverity,
} from './conflict-detector.js';

const log = logger.child({ component: 'conflict-resolver' });

/**
 * Resolution strategy types
 */
export type ResolutionStrategy =
  | 'ours'           // Accept our version
  | 'theirs'         // Accept their version
  | 'union'          // Include both (for additive changes)
  | 'manual'         // Requires manual intervention
  | 'ai-assisted'    // Use AI for resolution
  | 'smart-merge';   // Intelligent merging

/**
 * Resolution action
 */
export interface ResolutionAction {
  /** Action ID */
  id: string;
  /** Conflict this resolves */
  conflictId: string;
  /** Strategy used */
  strategy: ResolutionStrategy;
  /** Resolved content (if applicable) */
  resolvedContent?: string;
  /** Applied at */
  appliedAt?: Date;
  /** Applied by */
  appliedBy?: string;
  /** Notes about resolution */
  notes?: string;
}

/**
 * Resolution result
 */
export interface ResolutionResult {
  success: boolean;
  conflict: ExtendedConflictInfo;
  action: ResolutionAction;
  error?: string;
  warnings?: string[];
}

/**
 * Batch resolution result
 */
export interface BatchResolutionResult {
  successful: ResolutionResult[];
  failed: ResolutionResult[];
  skipped: ExtendedConflictInfo[];
  summary: {
    total: number;
    resolved: number;
    failed: number;
    skipped: number;
  };
}

/**
 * Resolution suggestion
 */
export interface ResolutionSuggestion {
  conflictId: string;
  strategy: ResolutionStrategy;
  confidence: number;
  reasoning: string;
  previewContent?: string;
}

/**
 * Manual resolution input
 */
export interface ManualResolutionInput {
  conflictId: string;
  resolvedContent: string;
  resolvedBy: string;
  notes?: string;
}

/**
 * Conflict Resolver configuration
 */
export interface ConflictResolverConfig {
  /** Allow auto-resolution */
  allowAutoResolve: boolean;
  /** AI assistance enabled */
  aiAssistEnabled: boolean;
  /** Confidence threshold for auto-resolution */
  autoResolveConfidence: number;
  /** Backup before resolution */
  createBackups: boolean;
  /** Validate resolutions */
  validateResolutions: boolean;
}

const DEFAULT_CONFIG: ConflictResolverConfig = {
  allowAutoResolve: true,
  aiAssistEnabled: false, // Disabled by default
  autoResolveConfidence: 0.9,
  createBackups: true,
  validateResolutions: true,
};

/**
 * Conflict Resolver class
 */
export class ConflictResolver {
  private config: ConflictResolverConfig;
  private eventListeners: Array<(event: GitEvent) => void> = [];
  private resolutionHistory: Map<string, ResolutionAction> = new Map();
  private pendingResolutions: Map<string, ExtendedConflictInfo> = new Map();

  constructor(config: Partial<ConflictResolverConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Suggest resolution strategies for a conflict
   */
  suggestResolution(conflict: ExtendedConflictInfo): ResolutionSuggestion[] {
    log.info('Suggesting resolution', { conflictId: conflict.id, type: conflict.type });

    const suggestions: ResolutionSuggestion[] = [];

    switch (conflict.type) {
      case 'content':
        suggestions.push(...this.suggestContentResolution(conflict));
        break;
      case 'rename':
        suggestions.push(...this.suggestRenameResolution(conflict));
        break;
      case 'delete':
        suggestions.push(...this.suggestDeleteResolution(conflict));
        break;
      case 'add':
        suggestions.push(...this.suggestAddResolution(conflict));
        break;
      case 'binary':
        suggestions.push(...this.suggestBinaryResolution(conflict));
        break;
      case 'dependency':
        suggestions.push(...this.suggestDependencyResolution(conflict));
        break;
      default:
        suggestions.push({
          conflictId: conflict.id,
          strategy: 'manual',
          confidence: 0.5,
          reasoning: 'Unknown conflict type - manual review recommended',
        });
    }

    // Sort by confidence
    suggestions.sort((a, b) => b.confidence - a.confidence);

    return suggestions;
  }

  /**
   * Suggest resolutions for content conflicts
   */
  private suggestContentResolution(
    conflict: ExtendedConflictInfo
  ): ResolutionSuggestion[] {
    const suggestions: ResolutionSuggestion[] = [];

    // If auto-resolvable, suggest smart-merge
    if (conflict.autoResolvable) {
      suggestions.push({
        conflictId: conflict.id,
        strategy: 'smart-merge',
        confidence: 0.95,
        reasoning: 'Non-overlapping changes can be automatically merged',
      });
    }

    // Based on severity
    if (conflict.severity === 'low') {
      suggestions.push({
        conflictId: conflict.id,
        strategy: 'union',
        confidence: 0.7,
        reasoning: 'Low severity - both changes may be included',
      });
    }

    // Always offer manual as fallback
    suggestions.push({
      conflictId: conflict.id,
      strategy: 'manual',
      confidence: 0.5,
      reasoning: 'Manual review for precise control',
    });

    // Offer ours/theirs based on affected lines
    const affectedLines = conflict.affectedLines?.reduce(
      (sum, r) => sum + (r.end - r.start + 1),
      0
    ) || 0;

    if (affectedLines < 10) {
      suggestions.push({
        conflictId: conflict.id,
        strategy: 'ours',
        confidence: 0.4,
        reasoning: 'Small conflict - consider keeping your version',
      });
      suggestions.push({
        conflictId: conflict.id,
        strategy: 'theirs',
        confidence: 0.4,
        reasoning: 'Small conflict - consider accepting their version',
      });
    }

    return suggestions;
  }

  /**
   * Suggest resolutions for rename conflicts
   */
  private suggestRenameResolution(
    conflict: ExtendedConflictInfo
  ): ResolutionSuggestion[] {
    return [
      {
        conflictId: conflict.id,
        strategy: 'ours',
        confidence: 0.5,
        reasoning: `Keep our rename: ${conflict.ourVersion}`,
      },
      {
        conflictId: conflict.id,
        strategy: 'theirs',
        confidence: 0.5,
        reasoning: `Accept their rename: ${conflict.theirVersion}`,
      },
      {
        conflictId: conflict.id,
        strategy: 'manual',
        confidence: 0.6,
        reasoning: 'Choose a new name that works for both',
      },
    ];
  }

  /**
   * Suggest resolutions for delete vs modify conflicts
   */
  private suggestDeleteResolution(
    conflict: ExtendedConflictInfo
  ): ResolutionSuggestion[] {
    return [
      {
        conflictId: conflict.id,
        strategy: 'theirs',
        confidence: 0.4,
        reasoning: 'Keep the file and modifications',
      },
      {
        conflictId: conflict.id,
        strategy: 'ours',
        confidence: 0.3,
        reasoning: 'Proceed with deletion (data loss warning)',
      },
      {
        conflictId: conflict.id,
        strategy: 'manual',
        confidence: 0.7,
        reasoning: 'Review modifications before deciding',
      },
    ];
  }

  /**
   * Suggest resolutions for add conflicts
   */
  private suggestAddResolution(
    conflict: ExtendedConflictInfo
  ): ResolutionSuggestion[] {
    const suggestions: ResolutionSuggestion[] = [];

    if (conflict.autoResolvable) {
      suggestions.push({
        conflictId: conflict.id,
        strategy: 'smart-merge',
        confidence: 0.95,
        reasoning: 'Files are identical - can auto-merge',
      });
    } else {
      suggestions.push({
        conflictId: conflict.id,
        strategy: 'union',
        confidence: 0.6,
        reasoning: 'Combine both versions into single file',
      });
      suggestions.push({
        conflictId: conflict.id,
        strategy: 'ours',
        confidence: 0.4,
        reasoning: 'Keep our version of the file',
      });
      suggestions.push({
        conflictId: conflict.id,
        strategy: 'theirs',
        confidence: 0.4,
        reasoning: 'Use their version of the file',
      });
    }

    return suggestions;
  }

  /**
   * Suggest resolutions for binary conflicts
   */
  private suggestBinaryResolution(
    conflict: ExtendedConflictInfo
  ): ResolutionSuggestion[] {
    return [
      {
        conflictId: conflict.id,
        strategy: 'ours',
        confidence: 0.5,
        reasoning: 'Keep our binary file',
      },
      {
        conflictId: conflict.id,
        strategy: 'theirs',
        confidence: 0.5,
        reasoning: 'Use their binary file',
      },
      {
        conflictId: conflict.id,
        strategy: 'manual',
        confidence: 0.3,
        reasoning: 'Binary files cannot be merged - must choose one',
      },
    ];
  }

  /**
   * Suggest resolutions for dependency conflicts
   */
  private suggestDependencyResolution(
    conflict: ExtendedConflictInfo
  ): ResolutionSuggestion[] {
    return [
      {
        conflictId: conflict.id,
        strategy: 'union',
        confidence: 0.6,
        reasoning: 'Merge both dependency changes',
      },
      {
        conflictId: conflict.id,
        strategy: 'manual',
        confidence: 0.8,
        reasoning: 'Review for version conflicts and compatibility',
      },
      {
        conflictId: conflict.id,
        strategy: 'theirs',
        confidence: 0.4,
        reasoning: 'Accept their dependency versions',
      },
    ];
  }

  /**
   * Resolve a single conflict
   */
  async resolveConflict(
    conflict: ExtendedConflictInfo,
    strategy: ResolutionStrategy,
    options: {
      resolvedContent?: string;
      resolvedBy?: string;
      notes?: string;
    } = {}
  ): Promise<ResolutionResult> {
    log.info('Resolving conflict', {
      conflictId: conflict.id,
      strategy,
      path: conflict.path,
    });

    const action: ResolutionAction = {
      id: `action-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      conflictId: conflict.id,
      strategy,
      resolvedContent: options.resolvedContent,
      appliedAt: new Date(),
      appliedBy: options.resolvedBy || 'system',
      notes: options.notes,
    };

    try {
      // Validate resolution if enabled
      if (this.config.validateResolutions) {
        const validation = this.validateResolution(conflict, strategy, options.resolvedContent);
        if (!validation.valid) {
          return {
            success: false,
            conflict,
            action,
            error: validation.error,
            warnings: validation.warnings,
          };
        }
      }

      // Apply resolution based on strategy
      const result = await this.applyResolution(conflict, strategy, options.resolvedContent);

      if (result.success) {
        // Store in history
        this.resolutionHistory.set(conflict.id, action);

        // Remove from pending
        this.pendingResolutions.delete(conflict.id);

        // Emit event
        this.emit({
          type: 'conflict:resolved',
          timestamp: new Date(),
          operation: 'status',
          data: {
            conflictId: conflict.id,
            strategy,
            path: conflict.path,
          },
        });
      }

      log.info('Conflict resolution complete', {
        conflictId: conflict.id,
        success: result.success,
      });

      return {
        success: result.success,
        conflict,
        action,
        error: result.error,
        warnings: result.warnings,
      };
    } catch (error) {
      log.error('Conflict resolution failed', {
        conflictId: conflict.id,
        error: error instanceof Error ? error.message : String(error),
      });

      return {
        success: false,
        conflict,
        action,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Validate a resolution before applying
   */
  private validateResolution(
    conflict: ExtendedConflictInfo,
    strategy: ResolutionStrategy,
    resolvedContent?: string
  ): { valid: boolean; error?: string; warnings?: string[] } {
    const warnings: string[] = [];

    // Manual resolution requires content
    if (strategy === 'manual' && !resolvedContent) {
      return {
        valid: false,
        error: 'Manual resolution requires resolved content',
      };
    }

    // Binary conflicts can't use union or smart-merge
    if (conflict.type === 'binary' && (strategy === 'union' || strategy === 'smart-merge')) {
      return {
        valid: false,
        error: 'Binary conflicts cannot use union or smart-merge strategies',
      };
    }

    // Warn about data loss for delete conflicts
    if (conflict.type === 'delete' && strategy === 'ours') {
      warnings.push('This resolution will permanently delete modified file');
    }

    // Warn about high severity conflicts with auto-resolve
    if (conflict.severity === 'critical' && strategy !== 'manual') {
      warnings.push('Critical conflict being resolved automatically - verify result');
    }

    return { valid: true, warnings };
  }

  /**
   * Apply a resolution strategy
   */
  private async applyResolution(
    conflict: ExtendedConflictInfo,
    strategy: ResolutionStrategy,
    resolvedContent?: string
  ): Promise<{ success: boolean; error?: string; warnings?: string[] }> {
    // In a real implementation, this would modify files
    // For now, we simulate the resolution

    switch (strategy) {
      case 'ours':
        return { success: true };

      case 'theirs':
        return { success: true };

      case 'union':
        if (conflict.type === 'binary') {
          return { success: false, error: 'Cannot union binary files' };
        }
        return { success: true };

      case 'smart-merge':
        if (!conflict.autoResolvable) {
          return {
            success: false,
            error: 'Conflict is not auto-resolvable',
          };
        }
        return { success: true };

      case 'manual':
        if (!resolvedContent) {
          return { success: false, error: 'No resolved content provided' };
        }
        return { success: true };

      case 'ai-assisted':
        if (!this.config.aiAssistEnabled) {
          return { success: false, error: 'AI assistance is not enabled' };
        }
        // Would call AI service here
        return { success: true, warnings: ['AI-assisted resolution should be reviewed'] };

      default:
        return { success: false, error: `Unknown strategy: ${strategy}` };
    }
  }

  /**
   * Auto-resolve all auto-resolvable conflicts
   */
  async autoResolveAll(
    conflicts: ExtendedConflictInfo[]
  ): Promise<BatchResolutionResult> {
    log.info('Auto-resolving conflicts', { total: conflicts.length });

    if (!this.config.allowAutoResolve) {
      return {
        successful: [],
        failed: [],
        skipped: conflicts,
        summary: {
          total: conflicts.length,
          resolved: 0,
          failed: 0,
          skipped: conflicts.length,
        },
      };
    }

    const successful: ResolutionResult[] = [];
    const failed: ResolutionResult[] = [];
    const skipped: ExtendedConflictInfo[] = [];

    for (const conflict of conflicts) {
      if (!conflict.autoResolvable) {
        skipped.push(conflict);
        continue;
      }

      const suggestions = this.suggestResolution(conflict);
      const bestSuggestion = suggestions[0];

      if (bestSuggestion && bestSuggestion.confidence >= this.config.autoResolveConfidence) {
        const result = await this.resolveConflict(conflict, bestSuggestion.strategy);

        if (result.success) {
          successful.push(result);
        } else {
          failed.push(result);
        }
      } else {
        skipped.push(conflict);
      }
    }

    log.info('Auto-resolution complete', {
      resolved: successful.length,
      failed: failed.length,
      skipped: skipped.length,
    });

    return {
      successful,
      failed,
      skipped,
      summary: {
        total: conflicts.length,
        resolved: successful.length,
        failed: failed.length,
        skipped: skipped.length,
      },
    };
  }

  /**
   * Resolve with manual input
   */
  async resolveManual(input: ManualResolutionInput): Promise<ResolutionResult> {
    const conflict = this.pendingResolutions.get(input.conflictId);

    if (!conflict) {
      // Create a placeholder conflict for the result
      const placeholderConflict: ExtendedConflictInfo = {
        id: input.conflictId,
        path: 'unknown',
        type: 'content',
        source: 'unknown',
        target: 'unknown',
        severity: 'medium',
        autoResolvable: false,
        detectedAt: new Date(),
      };

      return {
        success: false,
        conflict: placeholderConflict,
        action: {
          id: 'invalid',
          conflictId: input.conflictId,
          strategy: 'manual',
        },
        error: 'Conflict not found in pending resolutions',
      };
    }

    return this.resolveConflict(conflict, 'manual', {
      resolvedContent: input.resolvedContent,
      resolvedBy: input.resolvedBy,
      notes: input.notes,
    });
  }

  /**
   * Add conflict to pending resolutions
   */
  addPendingConflict(conflict: ExtendedConflictInfo): void {
    this.pendingResolutions.set(conflict.id, conflict);
  }

  /**
   * Add multiple conflicts to pending
   */
  addPendingConflicts(conflicts: ExtendedConflictInfo[]): void {
    for (const conflict of conflicts) {
      this.pendingResolutions.set(conflict.id, conflict);
    }
  }

  /**
   * Get pending conflicts
   */
  getPendingConflicts(): ExtendedConflictInfo[] {
    return Array.from(this.pendingResolutions.values());
  }

  /**
   * Get pending conflict by ID
   */
  getPendingConflict(conflictId: string): ExtendedConflictInfo | undefined {
    return this.pendingResolutions.get(conflictId);
  }

  /**
   * Get resolution history
   */
  getResolutionHistory(): ResolutionAction[] {
    return Array.from(this.resolutionHistory.values());
  }

  /**
   * Get resolution for a conflict
   */
  getResolution(conflictId: string): ResolutionAction | undefined {
    return this.resolutionHistory.get(conflictId);
  }

  /**
   * Check if conflict is resolved
   */
  isResolved(conflictId: string): boolean {
    return this.resolutionHistory.has(conflictId);
  }

  /**
   * Undo a resolution
   */
  undoResolution(conflictId: string): boolean {
    const action = this.resolutionHistory.get(conflictId);
    if (!action) {
      return false;
    }

    // In a real implementation, would restore from backup
    this.resolutionHistory.delete(conflictId);

    this.emit({
      type: 'conflict:unresolved',
      timestamp: new Date(),
      operation: 'status',
      data: { conflictId },
    });

    log.info('Resolution undone', { conflictId });

    return true;
  }

  /**
   * Subscribe to events
   */
  on(listener: (event: GitEvent) => void): () => void {
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
  private emit(event: GitEvent): void {
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
  getConfig(): ConflictResolverConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<ConflictResolverConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get statistics
   */
  getStats(): {
    pending: number;
    resolved: number;
    byStrategy: Record<ResolutionStrategy, number>;
  } {
    const byStrategy: Record<ResolutionStrategy, number> = {
      ours: 0,
      theirs: 0,
      union: 0,
      manual: 0,
      'ai-assisted': 0,
      'smart-merge': 0,
    };

    for (const action of this.resolutionHistory.values()) {
      byStrategy[action.strategy]++;
    }

    return {
      pending: this.pendingResolutions.size,
      resolved: this.resolutionHistory.size,
      byStrategy,
    };
  }

  /**
   * Reset resolver state
   */
  reset(): void {
    this.pendingResolutions.clear();
    this.resolutionHistory.clear();
    this.eventListeners = [];
  }
}

// Singleton instance
let instance: ConflictResolver | null = null;

/**
 * Get the singleton ConflictResolver instance
 */
export function getConflictResolver(
  config?: Partial<ConflictResolverConfig>
): ConflictResolver {
  if (!instance) {
    instance = new ConflictResolver(config);
  }
  return instance;
}

/**
 * Reset the singleton (for testing)
 */
export function resetConflictResolver(): void {
  if (instance) {
    instance.reset();
  }
  instance = null;
}
