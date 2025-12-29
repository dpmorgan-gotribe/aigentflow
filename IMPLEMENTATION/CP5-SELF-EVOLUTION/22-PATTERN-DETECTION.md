# Step 22: Pattern Detection

## Overview

This step implements pattern detection and gap analysis from execution traces. Identifies recurring patterns, failure modes, bottlenecks, and opportunities for new specialized agents.

## Dependencies

- Step 21: Execution Tracing (trace data)
- Step 04: Persistence Layer (storage)

---

## Part 1: Pattern Schema Definitions

### Core Pattern Types

```typescript
import { z } from 'zod';

export const PatternTypeSchema = z.enum([
  'success',        // Successful execution patterns
  'failure',        // Common failure modes
  'bottleneck',     // Performance bottlenecks
  'delegation',     // Agent delegation patterns
  'tool_chain',     // Common tool sequences
  'retry',          // Retry patterns
  'gap',            // Missing capability gaps
  'optimization',   // Optimization opportunities
]);

export type PatternType = z.infer<typeof PatternTypeSchema>;

export const PatternConfidenceSchema = z.enum([
  'low',      // < 60% confidence
  'medium',   // 60-80% confidence
  'high',     // > 80% confidence
]);

export type PatternConfidence = z.infer<typeof PatternConfidenceSchema>;

export const PatternSchema = z.object({
  id: z.string().uuid(),
  type: PatternTypeSchema,
  name: z.string(),
  description: z.string(),
  confidence: PatternConfidenceSchema,
  frequency: z.number().int().min(1), // How many times observed
  firstSeen: z.number(), // Timestamp
  lastSeen: z.number(),
  traceIds: z.array(z.string()), // Supporting traces
  attributes: z.record(z.string(), z.unknown()),
  metrics: z.object({
    avgDuration: z.number().optional(),
    avgCost: z.number().optional(),
    successRate: z.number().optional(),
    avgRetries: z.number().optional(),
  }),
  suggestedAction: z.string().optional(),
  priority: z.number().min(0).max(100).default(50),
});

export type Pattern = z.infer<typeof PatternSchema>;
```

### Specific Pattern Schemas

```typescript
// Success pattern: captures what works well
export const SuccessPatternSchema = PatternSchema.extend({
  type: z.literal('success'),
  attributes: z.object({
    agentSequence: z.array(z.string()),
    toolSequence: z.array(z.string()),
    decisionPath: z.array(z.string()),
    contextFactors: z.array(z.string()),
  }),
});

export type SuccessPattern = z.infer<typeof SuccessPatternSchema>;

// Failure pattern: captures what goes wrong
export const FailurePatternSchema = PatternSchema.extend({
  type: z.literal('failure'),
  attributes: z.object({
    failureType: z.string(),
    failingAgent: z.string(),
    failingTool: z.string().optional(),
    errorCategory: z.enum([
      'timeout',
      'validation',
      'api_error',
      'logic_error',
      'resource_exhaustion',
      'dependency_failure',
      'unknown',
    ]),
    stackTrace: z.string().optional(),
    preconditions: z.array(z.string()),
    recoveryAttempts: z.number(),
  }),
});

export type FailurePattern = z.infer<typeof FailurePatternSchema>;

// Bottleneck pattern: identifies slow operations
export const BottleneckPatternSchema = PatternSchema.extend({
  type: z.literal('bottleneck'),
  attributes: z.object({
    slowOperation: z.string(),
    operationType: z.enum(['agent', 'tool', 'llm', 'workflow']),
    avgDuration: z.number(),
    p95Duration: z.number(),
    p99Duration: z.number(),
    percentageOfTotal: z.number(),
    causes: z.array(z.string()),
  }),
});

export type BottleneckPattern = z.infer<typeof BottleneckPatternSchema>;

// Gap pattern: identifies missing capabilities
export const GapPatternSchema = PatternSchema.extend({
  type: z.literal('gap'),
  attributes: z.object({
    gapType: z.enum([
      'missing_agent',       // No agent for task type
      'missing_tool',        // Tool not available
      'missing_knowledge',   // LLM lacks domain knowledge
      'missing_integration', // System integration missing
      'workflow_gap',        // Workflow doesn't handle case
    ]),
    requestedCapability: z.string(),
    fallbackUsed: z.string().optional(),
    userFeedback: z.array(z.string()),
    potentialSolution: z.string(),
  }),
});

export type GapPattern = z.infer<typeof GapPatternSchema>;

// Tool chain pattern: common sequences of tools
export const ToolChainPatternSchema = PatternSchema.extend({
  type: z.literal('tool_chain'),
  attributes: z.object({
    toolSequence: z.array(z.object({
      tool: z.string(),
      avgDuration: z.number(),
      successRate: z.number(),
    })),
    triggerContext: z.string(),
    outputType: z.string(),
  }),
});

export type ToolChainPattern = z.infer<typeof ToolChainPatternSchema>;

// Retry pattern: captures retry behavior
export const RetryPatternSchema = PatternSchema.extend({
  type: z.literal('retry'),
  attributes: z.object({
    operation: z.string(),
    avgRetries: z.number(),
    maxRetries: z.number(),
    retryReasons: z.array(z.object({
      reason: z.string(),
      frequency: z.number(),
    })),
    eventualSuccessRate: z.number(),
    avgTimeToSuccess: z.number(),
  }),
});

export type RetryPattern = z.infer<typeof RetryPatternSchema>;
```

---

## Part 2: Pattern Mining Engine

### Pattern Miner

```typescript
import { Trace, Span, DecisionPoint, TraceStorage } from './21-EXECUTION-TRACING';

export interface PatternMinerConfig {
  minFrequency: number;      // Minimum occurrences to be a pattern
  minConfidence: number;     // Minimum confidence threshold (0-1)
  timeWindowDays: number;    // Look back period
  maxPatterns: number;       // Maximum patterns to return
}

export const DEFAULT_MINER_CONFIG: PatternMinerConfig = {
  minFrequency: 3,
  minConfidence: 0.6,
  timeWindowDays: 30,
  maxPatterns: 100,
};

export class PatternMiner {
  private config: PatternMinerConfig;
  private storage: TraceStorage;
  private patterns: Map<string, Pattern> = new Map();

  constructor(storage: TraceStorage, config: Partial<PatternMinerConfig> = {}) {
    this.storage = storage;
    this.config = { ...DEFAULT_MINER_CONFIG, ...config };
  }

  async minePatterns(projectId: string): Promise<Pattern[]> {
    const timeRange = {
      start: Date.now() - this.config.timeWindowDays * 24 * 60 * 60 * 1000,
      end: Date.now(),
    };

    const traces = await this.storage.queryTraces({
      projectId,
      startTimeAfter: timeRange.start,
      startTimeBefore: timeRange.end,
      limit: 1000,
    });

    // Run all pattern miners
    const patterns: Pattern[] = [
      ...await this.mineSuccessPatterns(traces),
      ...await this.mineFailurePatterns(traces),
      ...await this.mineBottleneckPatterns(traces),
      ...await this.mineToolChainPatterns(traces),
      ...await this.mineRetryPatterns(traces),
      ...await this.mineGapPatterns(projectId, traces),
    ];

    // Filter by confidence and frequency
    const filtered = patterns.filter(p =>
      p.frequency >= this.config.minFrequency &&
      this.confidenceToNumber(p.confidence) >= this.config.minConfidence
    );

    // Sort by priority and limit
    return filtered
      .sort((a, b) => b.priority - a.priority)
      .slice(0, this.config.maxPatterns);
  }

  private confidenceToNumber(confidence: PatternConfidence): number {
    switch (confidence) {
      case 'high': return 0.9;
      case 'medium': return 0.7;
      case 'low': return 0.5;
    }
  }

  // Success pattern mining
  private async mineSuccessPatterns(traces: Trace[]): Promise<SuccessPattern[]> {
    const successTraces = traces.filter(t => t.status === 'ok');
    const sequenceMap = new Map<string, {
      count: number;
      traces: string[];
      durations: number[];
      costs: number[];
    }>();

    for (const trace of successTraces) {
      // Extract agent sequence
      const agentSpans = trace.spans
        .filter(s => s.kind === 'agent' && s.status === 'ok')
        .sort((a, b) => a.startTime - b.startTime);

      const sequence = agentSpans.map(s => s.attributes['agent.name'] as string);
      const key = sequence.join(' -> ');

      const existing = sequenceMap.get(key) || {
        count: 0,
        traces: [],
        durations: [],
        costs: [],
      };

      existing.count++;
      existing.traces.push(trace.traceId);
      existing.durations.push(trace.endTime! - trace.startTime);
      existing.costs.push(trace.metadata.totalCost);

      sequenceMap.set(key, existing);
    }

    const patterns: SuccessPattern[] = [];

    for (const [sequence, data] of sequenceMap) {
      if (data.count < this.config.minFrequency) continue;

      const agentSequence = sequence.split(' -> ');

      patterns.push({
        id: crypto.randomUUID(),
        type: 'success',
        name: `Success: ${agentSequence[0]} workflow`,
        description: `Successful completion using ${agentSequence.join(' -> ')}`,
        confidence: this.calculateConfidence(data.count, successTraces.length),
        frequency: data.count,
        firstSeen: Math.min(...data.traces.map(id =>
          traces.find(t => t.traceId === id)?.startTime || Date.now()
        )),
        lastSeen: Math.max(...data.traces.map(id =>
          traces.find(t => t.traceId === id)?.startTime || 0
        )),
        traceIds: data.traces.slice(0, 10),
        attributes: {
          agentSequence,
          toolSequence: [], // Would extract from spans
          decisionPath: [],
          contextFactors: [],
        },
        metrics: {
          avgDuration: this.average(data.durations),
          avgCost: this.average(data.costs),
          successRate: 1.0,
        },
        priority: 30, // Lower priority than failure patterns
      });
    }

    return patterns;
  }

  // Failure pattern mining
  private async mineFailurePatterns(traces: Trace[]): Promise<FailurePattern[]> {
    const failedTraces = traces.filter(t => t.status === 'error');
    const failureMap = new Map<string, {
      count: number;
      traces: string[];
      agents: string[];
      errors: string[];
    }>();

    for (const trace of failedTraces) {
      // Find the failing span
      const failingSpan = trace.spans.find(s => s.status === 'error');
      if (!failingSpan) continue;

      const errorMsg = (failingSpan.attributes['agent.error'] ||
                       failingSpan.attributes['tool.error'] ||
                       'Unknown error') as string;

      // Categorize error
      const category = this.categorizeError(errorMsg);
      const key = `${failingSpan.name}:${category}`;

      const existing = failureMap.get(key) || {
        count: 0,
        traces: [],
        agents: [],
        errors: [],
      };

      existing.count++;
      existing.traces.push(trace.traceId);
      existing.agents.push(failingSpan.name);
      existing.errors.push(errorMsg);

      failureMap.set(key, existing);
    }

    const patterns: FailurePattern[] = [];

    for (const [key, data] of failureMap) {
      if (data.count < this.config.minFrequency) continue;

      const [operation, category] = key.split(':');

      patterns.push({
        id: crypto.randomUUID(),
        type: 'failure',
        name: `Failure: ${operation} - ${category}`,
        description: `${operation} fails with ${category} error`,
        confidence: this.calculateConfidence(data.count, failedTraces.length),
        frequency: data.count,
        firstSeen: Math.min(...data.traces.map(id =>
          traces.find(t => t.traceId === id)?.startTime || Date.now()
        )),
        lastSeen: Math.max(...data.traces.map(id =>
          traces.find(t => t.traceId === id)?.startTime || 0
        )),
        traceIds: data.traces.slice(0, 10),
        attributes: {
          failureType: data.errors[0],
          failingAgent: data.agents[0],
          errorCategory: category as any,
          preconditions: [],
          recoveryAttempts: 0,
        },
        metrics: {
          successRate: 0,
        },
        suggestedAction: this.suggestFailureFix(category, operation),
        priority: 80, // High priority for failures
      });
    }

    return patterns;
  }

  private categorizeError(error: string): string {
    if (error.includes('timeout') || error.includes('ETIMEDOUT')) return 'timeout';
    if (error.includes('validation') || error.includes('invalid')) return 'validation';
    if (error.includes('rate limit') || error.includes('429')) return 'api_error';
    if (error.includes('memory') || error.includes('heap')) return 'resource_exhaustion';
    if (error.includes('ENOENT') || error.includes('not found')) return 'dependency_failure';
    return 'unknown';
  }

  private suggestFailureFix(category: string, operation: string): string {
    const suggestions: Record<string, string> = {
      timeout: `Increase timeout for ${operation} or implement retry with backoff`,
      validation: `Add input validation before ${operation}`,
      api_error: `Implement rate limiting and retry logic for ${operation}`,
      resource_exhaustion: `Optimize memory usage or add streaming to ${operation}`,
      dependency_failure: `Add dependency checks before ${operation}`,
      unknown: `Add better error handling and logging to ${operation}`,
    };
    return suggestions[category] || suggestions.unknown;
  }

  // Bottleneck pattern mining
  private async mineBottleneckPatterns(traces: Trace[]): Promise<BottleneckPattern[]> {
    const operationDurations = new Map<string, {
      durations: number[];
      totalTraceDurations: number[];
      type: 'agent' | 'tool' | 'llm' | 'workflow';
    }>();

    for (const trace of traces) {
      const traceDuration = (trace.endTime || Date.now()) - trace.startTime;

      for (const span of trace.spans) {
        if (!span.duration) continue;

        const key = span.name;
        const existing = operationDurations.get(key) || {
          durations: [],
          totalTraceDurations: [],
          type: span.kind as any,
        };

        existing.durations.push(span.duration);
        existing.totalTraceDurations.push(traceDuration);

        operationDurations.set(key, existing);
      }
    }

    const patterns: BottleneckPattern[] = [];

    for (const [operation, data] of operationDurations) {
      if (data.durations.length < this.config.minFrequency) continue;

      const avgDuration = this.average(data.durations);
      const avgTotalDuration = this.average(data.totalTraceDurations);
      const percentageOfTotal = (avgDuration / avgTotalDuration) * 100;

      // Only flag as bottleneck if > 20% of total time
      if (percentageOfTotal < 20) continue;

      const sortedDurations = [...data.durations].sort((a, b) => a - b);
      const p95Index = Math.floor(sortedDurations.length * 0.95);
      const p99Index = Math.floor(sortedDurations.length * 0.99);

      patterns.push({
        id: crypto.randomUUID(),
        type: 'bottleneck',
        name: `Bottleneck: ${operation}`,
        description: `${operation} takes ${percentageOfTotal.toFixed(1)}% of total execution time`,
        confidence: 'high',
        frequency: data.durations.length,
        firstSeen: Date.now() - this.config.timeWindowDays * 24 * 60 * 60 * 1000,
        lastSeen: Date.now(),
        traceIds: [],
        attributes: {
          slowOperation: operation,
          operationType: data.type,
          avgDuration,
          p95Duration: sortedDurations[p95Index] || avgDuration,
          p99Duration: sortedDurations[p99Index] || avgDuration,
          percentageOfTotal,
          causes: this.identifyBottleneckCauses(operation, data.type),
        },
        metrics: {
          avgDuration,
        },
        suggestedAction: this.suggestBottleneckFix(operation, data.type, percentageOfTotal),
        priority: Math.min(90, Math.floor(percentageOfTotal)),
      });
    }

    return patterns.sort((a, b) =>
      (b.attributes.percentageOfTotal as number) - (a.attributes.percentageOfTotal as number)
    );
  }

  private identifyBottleneckCauses(operation: string, type: string): string[] {
    const causes: string[] = [];

    if (type === 'llm') {
      causes.push('Large prompt size', 'High max_tokens', 'Model latency');
    } else if (type === 'tool') {
      causes.push('I/O operations', 'External API calls', 'File system access');
    } else if (type === 'agent') {
      causes.push('Multiple LLM calls', 'Complex decision logic', 'Tool orchestration');
    }

    return causes;
  }

  private suggestBottleneckFix(operation: string, type: string, percentage: number): string {
    if (type === 'llm') {
      return `Consider caching LLM responses, reducing prompt size, or using a faster model for ${operation}`;
    }
    if (type === 'tool') {
      return `Optimize ${operation} with async operations, caching, or batch processing`;
    }
    if (percentage > 50) {
      return `${operation} dominates execution time - consider parallel execution or specialized optimization`;
    }
    return `Profile ${operation} for optimization opportunities`;
  }

  // Tool chain pattern mining
  private async mineToolChainPatterns(traces: Trace[]): Promise<ToolChainPattern[]> {
    const chainMap = new Map<string, {
      count: number;
      traces: string[];
      toolStats: Map<string, { durations: number[]; successes: number; total: number }>;
    }>();

    for (const trace of traces) {
      const toolSpans = trace.spans
        .filter(s => s.kind === 'tool')
        .sort((a, b) => a.startTime - b.startTime);

      if (toolSpans.length < 2) continue;

      // Create chain key from tool sequence
      const toolNames = toolSpans.map(s => s.attributes['tool.name'] as string);
      const key = toolNames.join(' -> ');

      const existing = chainMap.get(key) || {
        count: 0,
        traces: [],
        toolStats: new Map(),
      };

      existing.count++;
      existing.traces.push(trace.traceId);

      // Track per-tool stats
      for (const span of toolSpans) {
        const toolName = span.attributes['tool.name'] as string;
        const stats = existing.toolStats.get(toolName) || {
          durations: [],
          successes: 0,
          total: 0,
        };

        stats.durations.push(span.duration || 0);
        stats.total++;
        if (span.status === 'ok') stats.successes++;

        existing.toolStats.set(toolName, stats);
      }

      chainMap.set(key, existing);
    }

    const patterns: ToolChainPattern[] = [];

    for (const [chain, data] of chainMap) {
      if (data.count < this.config.minFrequency) continue;

      const toolSequence = chain.split(' -> ').map(tool => {
        const stats = data.toolStats.get(tool)!;
        return {
          tool,
          avgDuration: this.average(stats.durations),
          successRate: stats.successes / stats.total,
        };
      });

      patterns.push({
        id: crypto.randomUUID(),
        type: 'tool_chain',
        name: `Chain: ${toolSequence[0].tool} workflow`,
        description: `Common tool sequence: ${chain}`,
        confidence: this.calculateConfidence(data.count, traces.length),
        frequency: data.count,
        firstSeen: Date.now() - this.config.timeWindowDays * 24 * 60 * 60 * 1000,
        lastSeen: Date.now(),
        traceIds: data.traces.slice(0, 10),
        attributes: {
          toolSequence,
          triggerContext: 'general',
          outputType: 'varies',
        },
        metrics: {
          avgDuration: toolSequence.reduce((sum, t) => sum + t.avgDuration, 0),
          successRate: toolSequence.reduce((prod, t) => prod * t.successRate, 1),
        },
        priority: 40,
      });
    }

    return patterns;
  }

  // Retry pattern mining
  private async mineRetryPatterns(traces: Trace[]): Promise<RetryPattern[]> {
    const retryMap = new Map<string, {
      retries: number[];
      reasons: Map<string, number>;
      eventualSuccesses: number;
      total: number;
      timesToSuccess: number[];
    }>();

    for (const trace of traces) {
      for (const span of trace.spans) {
        const retryCount = span.attributes['agent.retryCount'] as number || 0;
        if (retryCount === 0) continue;

        const operation = span.name;
        const existing = retryMap.get(operation) || {
          retries: [],
          reasons: new Map(),
          eventualSuccesses: 0,
          total: 0,
          timesToSuccess: [],
        };

        existing.retries.push(retryCount);
        existing.total++;

        if (span.status === 'ok') {
          existing.eventualSuccesses++;
          existing.timesToSuccess.push(span.duration || 0);
        }

        // Track retry reasons from events
        for (const event of span.events) {
          if (event.name === 'retry') {
            const reason = (event.attributes?.reason as string) || 'unknown';
            existing.reasons.set(reason, (existing.reasons.get(reason) || 0) + 1);
          }
        }

        retryMap.set(operation, existing);
      }
    }

    const patterns: RetryPattern[] = [];

    for (const [operation, data] of retryMap) {
      if (data.total < this.config.minFrequency) continue;

      const retryReasons = Array.from(data.reasons.entries())
        .map(([reason, frequency]) => ({ reason, frequency }))
        .sort((a, b) => b.frequency - a.frequency);

      patterns.push({
        id: crypto.randomUUID(),
        type: 'retry',
        name: `Retry: ${operation}`,
        description: `${operation} requires ${this.average(data.retries).toFixed(1)} retries on average`,
        confidence: this.calculateConfidence(data.total, traces.length),
        frequency: data.total,
        firstSeen: Date.now() - this.config.timeWindowDays * 24 * 60 * 60 * 1000,
        lastSeen: Date.now(),
        traceIds: [],
        attributes: {
          operation,
          avgRetries: this.average(data.retries),
          maxRetries: Math.max(...data.retries),
          retryReasons,
          eventualSuccessRate: data.eventualSuccesses / data.total,
          avgTimeToSuccess: this.average(data.timesToSuccess),
        },
        metrics: {
          avgRetries: this.average(data.retries),
          successRate: data.eventualSuccesses / data.total,
        },
        suggestedAction: `Investigate retry causes for ${operation}: ${retryReasons[0]?.reason || 'unknown'}`,
        priority: 60,
      });
    }

    return patterns;
  }

  // Gap pattern mining
  private async mineGapPatterns(projectId: string, traces: Trace[]): Promise<GapPattern[]> {
    const gaps: GapPattern[] = [];

    // Analyze decisions for gaps
    for (const trace of traces) {
      const decisions = await this.storage.getDecisions(trace.traceId);

      for (const decision of decisions) {
        // Look for delegation failures or fallbacks
        if (decision.decisionType === 'delegation' && decision.outcome?.success === false) {
          gaps.push(this.createGapFromDecision(decision, 'missing_agent'));
        }

        // Look for tool selection fallbacks
        if (decision.decisionType === 'tool_selection') {
          const chosen = decision.decision.chosen;
          if (chosen.includes('fallback') || chosen.includes('generic')) {
            gaps.push(this.createGapFromDecision(decision, 'missing_tool'));
          }
        }
      }
    }

    // Deduplicate and aggregate gaps
    const gapMap = new Map<string, GapPattern>();
    for (const gap of gaps) {
      const key = `${gap.attributes.gapType}:${gap.attributes.requestedCapability}`;
      const existing = gapMap.get(key);

      if (existing) {
        existing.frequency++;
        existing.traceIds.push(...gap.traceIds);
        existing.lastSeen = Math.max(existing.lastSeen, gap.lastSeen);
      } else {
        gapMap.set(key, gap);
      }
    }

    return Array.from(gapMap.values())
      .filter(g => g.frequency >= this.config.minFrequency);
  }

  private createGapFromDecision(
    decision: DecisionPoint,
    gapType: GapPattern['attributes']['gapType']
  ): GapPattern {
    return {
      id: crypto.randomUUID(),
      type: 'gap',
      name: `Gap: ${decision.context.input.substring(0, 50)}`,
      description: `Missing ${gapType.replace('_', ' ')} for: ${decision.context.input}`,
      confidence: 'medium',
      frequency: 1,
      firstSeen: decision.timestamp,
      lastSeen: decision.timestamp,
      traceIds: [decision.traceId],
      attributes: {
        gapType,
        requestedCapability: decision.context.input,
        fallbackUsed: decision.decision.chosen,
        userFeedback: [],
        potentialSolution: this.suggestGapSolution(gapType, decision),
      },
      metrics: {},
      suggestedAction: `Create specialized ${gapType.replace('_', ' ')} for this capability`,
      priority: 70,
    };
  }

  private suggestGapSolution(gapType: string, decision: DecisionPoint): string {
    switch (gapType) {
      case 'missing_agent':
        return `Generate new agent specialized for: ${decision.context.input}`;
      case 'missing_tool':
        return `Implement tool for: ${decision.context.input}`;
      case 'missing_knowledge':
        return `Add domain knowledge or examples for: ${decision.context.input}`;
      default:
        return `Investigate and address gap: ${decision.context.input}`;
    }
  }

  private calculateConfidence(count: number, total: number): PatternConfidence {
    const ratio = count / total;
    if (ratio > 0.3) return 'high';
    if (ratio > 0.1) return 'medium';
    return 'low';
  }

  private average(numbers: number[]): number {
    if (numbers.length === 0) return 0;
    return numbers.reduce((sum, n) => sum + n, 0) / numbers.length;
  }
}
```

---

## Part 3: Gap Analyzer

### Specialized Gap Detection

```typescript
export interface GapAnalysis {
  gaps: GapPattern[];
  recommendations: GapRecommendation[];
  priority: 'critical' | 'high' | 'medium' | 'low';
}

export interface GapRecommendation {
  gapId: string;
  type: 'new_agent' | 'new_tool' | 'prompt_improvement' | 'workflow_change';
  description: string;
  effort: 'low' | 'medium' | 'high';
  impact: 'low' | 'medium' | 'high';
  implementation: string;
}

export class GapAnalyzer {
  private miner: PatternMiner;

  constructor(miner: PatternMiner) {
    this.miner = miner;
  }

  async analyzeGaps(projectId: string): Promise<GapAnalysis> {
    const patterns = await this.miner.minePatterns(projectId);
    const gaps = patterns.filter((p): p is GapPattern => p.type === 'gap');
    const failures = patterns.filter((p): p is FailurePattern => p.type === 'failure');

    // Generate recommendations
    const recommendations: GapRecommendation[] = [];

    for (const gap of gaps) {
      recommendations.push(this.generateRecommendation(gap));
    }

    // Analyze failures for hidden gaps
    for (const failure of failures) {
      if (this.isHiddenGap(failure)) {
        recommendations.push(this.recommendationFromFailure(failure));
      }
    }

    // Determine overall priority
    const priority = this.calculateOverallPriority(gaps, failures);

    return {
      gaps,
      recommendations: recommendations.sort((a, b) => {
        const impactOrder = { high: 3, medium: 2, low: 1 };
        const effortOrder = { low: 3, medium: 2, high: 1 };
        return (impactOrder[b.impact] * effortOrder[b.effort]) -
               (impactOrder[a.impact] * effortOrder[a.effort]);
      }),
      priority,
    };
  }

  private generateRecommendation(gap: GapPattern): GapRecommendation {
    const gapType = gap.attributes.gapType;

    switch (gapType) {
      case 'missing_agent':
        return {
          gapId: gap.id,
          type: 'new_agent',
          description: `Create agent for: ${gap.attributes.requestedCapability}`,
          effort: 'high',
          impact: gap.frequency > 10 ? 'high' : 'medium',
          implementation: this.generateAgentSpec(gap),
        };

      case 'missing_tool':
        return {
          gapId: gap.id,
          type: 'new_tool',
          description: `Implement tool: ${gap.attributes.requestedCapability}`,
          effort: 'medium',
          impact: gap.frequency > 5 ? 'high' : 'medium',
          implementation: this.generateToolSpec(gap),
        };

      case 'missing_knowledge':
        return {
          gapId: gap.id,
          type: 'prompt_improvement',
          description: `Add domain knowledge for: ${gap.attributes.requestedCapability}`,
          effort: 'low',
          impact: 'medium',
          implementation: `Add examples and context to system prompt for ${gap.attributes.requestedCapability}`,
        };

      default:
        return {
          gapId: gap.id,
          type: 'workflow_change',
          description: `Address workflow gap: ${gap.attributes.requestedCapability}`,
          effort: 'medium',
          impact: 'medium',
          implementation: gap.attributes.potentialSolution,
        };
    }
  }

  private generateAgentSpec(gap: GapPattern): string {
    return `
Agent Specification:
- Name: ${this.suggestAgentName(gap.attributes.requestedCapability)}
- Purpose: Handle ${gap.attributes.requestedCapability}
- Triggers: ${gap.attributes.requestedCapability}
- Tools needed: TBD based on capability analysis
- Success criteria: Successfully handle cases that currently fall back to generic agents
- Training data: Collect from ${gap.traceIds.length} existing traces
    `.trim();
  }

  private generateToolSpec(gap: GapPattern): string {
    return `
Tool Specification:
- Name: ${this.suggestToolName(gap.attributes.requestedCapability)}
- Input: Based on ${gap.attributes.requestedCapability}
- Output: Appropriate response type
- Implementation: Native function or API integration
- Testing: Verify against ${gap.traceIds.length} historical cases
    `.trim();
  }

  private suggestAgentName(capability: string): string {
    const words = capability.toLowerCase().split(/\s+/).slice(0, 3);
    return words.map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('') + 'Agent';
  }

  private suggestToolName(capability: string): string {
    const words = capability.toLowerCase().split(/\s+/).slice(0, 2);
    return words.join('_') + '_tool';
  }

  private isHiddenGap(failure: FailurePattern): boolean {
    // Check if failure might indicate a missing capability
    return (
      failure.attributes.errorCategory === 'unknown' ||
      failure.attributes.recoveryAttempts > 2 ||
      failure.frequency > 5
    );
  }

  private recommendationFromFailure(failure: FailurePattern): GapRecommendation {
    return {
      gapId: failure.id,
      type: 'workflow_change',
      description: `Address recurring failure in ${failure.attributes.failingAgent}`,
      effort: 'medium',
      impact: failure.frequency > 10 ? 'high' : 'medium',
      implementation: failure.suggestedAction || 'Investigate and fix root cause',
    };
  }

  private calculateOverallPriority(
    gaps: GapPattern[],
    failures: FailurePattern[]
  ): 'critical' | 'high' | 'medium' | 'low' {
    const totalGapFrequency = gaps.reduce((sum, g) => sum + g.frequency, 0);
    const totalFailureFrequency = failures.reduce((sum, f) => sum + f.frequency, 0);

    if (totalFailureFrequency > 50 || gaps.some(g => g.frequency > 20)) {
      return 'critical';
    }
    if (totalGapFrequency > 20 || totalFailureFrequency > 20) {
      return 'high';
    }
    if (totalGapFrequency > 5 || totalFailureFrequency > 5) {
      return 'medium';
    }
    return 'low';
  }
}
```

---

## Part 4: Pattern Storage

### Pattern Persistence

```typescript
export interface PatternStorage {
  savePattern(pattern: Pattern): Promise<void>;
  getPattern(id: string): Promise<Pattern | null>;
  queryPatterns(query: PatternQuery): Promise<Pattern[]>;
  updatePattern(id: string, updates: Partial<Pattern>): Promise<void>;
  deletePattern(id: string): Promise<void>;
  getPatternHistory(id: string): Promise<PatternVersion[]>;
}

export const PatternQuerySchema = z.object({
  type: PatternTypeSchema.optional(),
  confidence: PatternConfidenceSchema.optional(),
  minFrequency: z.number().optional(),
  minPriority: z.number().optional(),
  projectId: z.string().optional(),
  limit: z.number().default(50),
  offset: z.number().default(0),
});

export type PatternQuery = z.infer<typeof PatternQuerySchema>;

export interface PatternVersion {
  version: number;
  timestamp: number;
  changes: string;
  pattern: Pattern;
}

export class SQLitePatternStorage implements PatternStorage {
  private db: Database;

  constructor(dbPath: string) {
    this.db = new Database(dbPath);
    this.initializeSchema();
  }

  private initializeSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS patterns (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        confidence TEXT NOT NULL,
        frequency INTEGER NOT NULL,
        first_seen INTEGER NOT NULL,
        last_seen INTEGER NOT NULL,
        trace_ids JSON NOT NULL,
        attributes JSON NOT NULL,
        metrics JSON NOT NULL,
        suggested_action TEXT,
        priority INTEGER NOT NULL,
        created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
        updated_at INTEGER DEFAULT (strftime('%s', 'now') * 1000)
      );

      CREATE INDEX IF NOT EXISTS idx_patterns_type ON patterns(type);
      CREATE INDEX IF NOT EXISTS idx_patterns_confidence ON patterns(confidence);
      CREATE INDEX IF NOT EXISTS idx_patterns_priority ON patterns(priority);

      CREATE TABLE IF NOT EXISTS pattern_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        pattern_id TEXT NOT NULL,
        version INTEGER NOT NULL,
        timestamp INTEGER NOT NULL,
        changes TEXT,
        snapshot JSON NOT NULL,
        FOREIGN KEY (pattern_id) REFERENCES patterns(id)
      );

      CREATE INDEX IF NOT EXISTS idx_pattern_history_pattern ON pattern_history(pattern_id);
    `);
  }

  async savePattern(pattern: Pattern): Promise<void> {
    const existing = await this.getPattern(pattern.id);

    if (existing) {
      // Archive current version
      await this.archivePattern(existing);
    }

    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO patterns
      (id, type, name, description, confidence, frequency, first_seen, last_seen,
       trace_ids, attributes, metrics, suggested_action, priority, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      pattern.id,
      pattern.type,
      pattern.name,
      pattern.description,
      pattern.confidence,
      pattern.frequency,
      pattern.firstSeen,
      pattern.lastSeen,
      JSON.stringify(pattern.traceIds),
      JSON.stringify(pattern.attributes),
      JSON.stringify(pattern.metrics),
      pattern.suggestedAction,
      pattern.priority,
      Date.now()
    );
  }

  async getPattern(id: string): Promise<Pattern | null> {
    const row = this.db.prepare('SELECT * FROM patterns WHERE id = ?').get(id) as any;
    return row ? this.mapRow(row) : null;
  }

  async queryPatterns(query: PatternQuery): Promise<Pattern[]> {
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (query.type) {
      conditions.push('type = ?');
      params.push(query.type);
    }
    if (query.confidence) {
      conditions.push('confidence = ?');
      params.push(query.confidence);
    }
    if (query.minFrequency) {
      conditions.push('frequency >= ?');
      params.push(query.minFrequency);
    }
    if (query.minPriority) {
      conditions.push('priority >= ?');
      params.push(query.minPriority);
    }

    const whereClause = conditions.length > 0
      ? `WHERE ${conditions.join(' AND ')}`
      : '';

    const sql = `
      SELECT * FROM patterns
      ${whereClause}
      ORDER BY priority DESC, frequency DESC
      LIMIT ? OFFSET ?
    `;

    params.push(query.limit, query.offset);

    const rows = this.db.prepare(sql).all(...params) as any[];
    return rows.map(this.mapRow);
  }

  async updatePattern(id: string, updates: Partial<Pattern>): Promise<void> {
    const existing = await this.getPattern(id);
    if (!existing) {
      throw new Error(`Pattern not found: ${id}`);
    }

    await this.archivePattern(existing);

    const updated = { ...existing, ...updates };
    await this.savePattern(updated);
  }

  async deletePattern(id: string): Promise<void> {
    this.db.prepare('DELETE FROM patterns WHERE id = ?').run(id);
    this.db.prepare('DELETE FROM pattern_history WHERE pattern_id = ?').run(id);
  }

  async getPatternHistory(id: string): Promise<PatternVersion[]> {
    const rows = this.db.prepare(`
      SELECT * FROM pattern_history
      WHERE pattern_id = ?
      ORDER BY version DESC
    `).all(id) as any[];

    return rows.map(row => ({
      version: row.version,
      timestamp: row.timestamp,
      changes: row.changes,
      pattern: JSON.parse(row.snapshot),
    }));
  }

  private async archivePattern(pattern: Pattern): Promise<void> {
    const history = await this.getPatternHistory(pattern.id);
    const version = history.length + 1;

    this.db.prepare(`
      INSERT INTO pattern_history
      (pattern_id, version, timestamp, changes, snapshot)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      pattern.id,
      version,
      Date.now(),
      'Updated',
      JSON.stringify(pattern)
    );
  }

  private mapRow(row: any): Pattern {
    return {
      id: row.id,
      type: row.type,
      name: row.name,
      description: row.description,
      confidence: row.confidence,
      frequency: row.frequency,
      firstSeen: row.first_seen,
      lastSeen: row.last_seen,
      traceIds: JSON.parse(row.trace_ids),
      attributes: JSON.parse(row.attributes),
      metrics: JSON.parse(row.metrics),
      suggestedAction: row.suggested_action,
      priority: row.priority,
    };
  }
}
```

---

## Part 5: Pattern Reporting

### Pattern Reporter

```typescript
export interface PatternReport {
  summary: PatternSummary;
  criticalPatterns: Pattern[];
  recommendations: GapRecommendation[];
  trends: PatternTrend[];
  generatedAt: number;
}

export interface PatternSummary {
  totalPatterns: number;
  byType: Record<PatternType, number>;
  byConfidence: Record<PatternConfidence, number>;
  avgFrequency: number;
  topPriorityCount: number; // Priority > 70
}

export interface PatternTrend {
  patternId: string;
  patternName: string;
  direction: 'increasing' | 'decreasing' | 'stable';
  changePercent: number;
  period: string;
}

export class PatternReporter {
  private storage: PatternStorage;
  private analyzer: GapAnalyzer;

  constructor(storage: PatternStorage, analyzer: GapAnalyzer) {
    this.storage = storage;
    this.analyzer = analyzer;
  }

  async generateReport(projectId: string): Promise<PatternReport> {
    const patterns = await this.storage.queryPatterns({
      projectId,
      limit: 1000,
    });

    const gapAnalysis = await this.analyzer.analyzeGaps(projectId);

    const summary = this.calculateSummary(patterns);
    const criticalPatterns = patterns.filter(p => p.priority >= 70);
    const trends = await this.calculateTrends(patterns);

    return {
      summary,
      criticalPatterns,
      recommendations: gapAnalysis.recommendations,
      trends,
      generatedAt: Date.now(),
    };
  }

  private calculateSummary(patterns: Pattern[]): PatternSummary {
    const byType: Record<string, number> = {};
    const byConfidence: Record<string, number> = {};

    for (const pattern of patterns) {
      byType[pattern.type] = (byType[pattern.type] || 0) + 1;
      byConfidence[pattern.confidence] = (byConfidence[pattern.confidence] || 0) + 1;
    }

    return {
      totalPatterns: patterns.length,
      byType: byType as Record<PatternType, number>,
      byConfidence: byConfidence as Record<PatternConfidence, number>,
      avgFrequency: patterns.length > 0
        ? patterns.reduce((sum, p) => sum + p.frequency, 0) / patterns.length
        : 0,
      topPriorityCount: patterns.filter(p => p.priority > 70).length,
    };
  }

  private async calculateTrends(patterns: Pattern[]): Promise<PatternTrend[]> {
    const trends: PatternTrend[] = [];

    for (const pattern of patterns.slice(0, 20)) {
      const history = await this.storage.getPatternHistory(pattern.id);

      if (history.length < 2) {
        trends.push({
          patternId: pattern.id,
          patternName: pattern.name,
          direction: 'stable',
          changePercent: 0,
          period: 'insufficient data',
        });
        continue;
      }

      const oldFreq = history[history.length - 1].pattern.frequency;
      const newFreq = pattern.frequency;
      const changePercent = ((newFreq - oldFreq) / oldFreq) * 100;

      trends.push({
        patternId: pattern.id,
        patternName: pattern.name,
        direction: changePercent > 10 ? 'increasing' : changePercent < -10 ? 'decreasing' : 'stable',
        changePercent,
        period: `${history.length} versions`,
      });
    }

    return trends;
  }

  formatReport(report: PatternReport): string {
    const lines: string[] = [];

    lines.push('# Pattern Analysis Report');
    lines.push(`Generated: ${new Date(report.generatedAt).toISOString()}`);
    lines.push('');

    // Summary
    lines.push('## Summary');
    lines.push(`- Total Patterns: ${report.summary.totalPatterns}`);
    lines.push(`- Critical (priority > 70): ${report.summary.topPriorityCount}`);
    lines.push(`- Average Frequency: ${report.summary.avgFrequency.toFixed(1)}`);
    lines.push('');

    // By type
    lines.push('### By Type');
    for (const [type, count] of Object.entries(report.summary.byType)) {
      lines.push(`- ${type}: ${count}`);
    }
    lines.push('');

    // Critical patterns
    if (report.criticalPatterns.length > 0) {
      lines.push('## Critical Patterns');
      for (const pattern of report.criticalPatterns) {
        lines.push(`### ${pattern.name}`);
        lines.push(`- Type: ${pattern.type}`);
        lines.push(`- Priority: ${pattern.priority}`);
        lines.push(`- Frequency: ${pattern.frequency}`);
        lines.push(`- Description: ${pattern.description}`);
        if (pattern.suggestedAction) {
          lines.push(`- Action: ${pattern.suggestedAction}`);
        }
        lines.push('');
      }
    }

    // Recommendations
    if (report.recommendations.length > 0) {
      lines.push('## Recommendations');
      for (const rec of report.recommendations) {
        lines.push(`### ${rec.description}`);
        lines.push(`- Type: ${rec.type}`);
        lines.push(`- Effort: ${rec.effort}`);
        lines.push(`- Impact: ${rec.impact}`);
        lines.push(`- Implementation: ${rec.implementation}`);
        lines.push('');
      }
    }

    // Trends
    if (report.trends.length > 0) {
      lines.push('## Trends');
      for (const trend of report.trends) {
        const arrow = trend.direction === 'increasing' ? '↑' :
                     trend.direction === 'decreasing' ? '↓' : '→';
        lines.push(`- ${trend.patternName}: ${arrow} ${Math.abs(trend.changePercent).toFixed(1)}%`);
      }
    }

    return lines.join('\n');
  }
}
```

---

## Part 6: Integration

### Pattern Detection Integration

```typescript
export class PatternDetectionService {
  private miner: PatternMiner;
  private analyzer: GapAnalyzer;
  private storage: PatternStorage;
  private reporter: PatternReporter;

  constructor(
    traceStorage: TraceStorage,
    patternStorage: PatternStorage,
    config?: Partial<PatternMinerConfig>
  ) {
    this.storage = patternStorage;
    this.miner = new PatternMiner(traceStorage, config);
    this.analyzer = new GapAnalyzer(this.miner);
    this.reporter = new PatternReporter(patternStorage, this.analyzer);
  }

  async runAnalysis(projectId: string): Promise<{
    patterns: Pattern[];
    gaps: GapAnalysis;
    report: PatternReport;
  }> {
    // Mine patterns from traces
    const patterns = await this.miner.minePatterns(projectId);

    // Save patterns
    for (const pattern of patterns) {
      await this.storage.savePattern(pattern);
    }

    // Analyze gaps
    const gaps = await this.analyzer.analyzeGaps(projectId);

    // Generate report
    const report = await this.reporter.generateReport(projectId);

    return { patterns, gaps, report };
  }

  async getAgentCandidates(): Promise<GapRecommendation[]> {
    const patterns = await this.storage.queryPatterns({
      type: 'gap',
      minPriority: 60,
    });

    const gaps = patterns as GapPattern[];

    return gaps
      .filter(g => g.attributes.gapType === 'missing_agent')
      .map(g => ({
        gapId: g.id,
        type: 'new_agent' as const,
        description: `Create agent for: ${g.attributes.requestedCapability}`,
        effort: 'high' as const,
        impact: g.frequency > 10 ? 'high' as const : 'medium' as const,
        implementation: g.attributes.potentialSolution,
      }));
  }
}
```

---

## Validation Checklist

- [ ] Success patterns capture agent sequences that work
- [ ] Failure patterns identify recurring error modes
- [ ] Bottleneck patterns flag slow operations (> 20% of time)
- [ ] Tool chain patterns capture common tool sequences
- [ ] Retry patterns track retry behavior and reasons
- [ ] Gap patterns identify missing capabilities
- [ ] Pattern confidence calculated from frequency ratios
- [ ] Patterns persisted with version history
- [ ] Pattern queries filter by type, confidence, priority
- [ ] Gap analyzer generates actionable recommendations
- [ ] Pattern reporter produces formatted markdown reports
- [ ] Trends calculated from pattern version history

---

## Next Steps

Proceed to **23-AGENT-GENERATION.md** to implement automatic agent generation from detected patterns.
