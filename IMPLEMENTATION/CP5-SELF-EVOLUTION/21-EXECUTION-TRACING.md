# Step 21: Execution Tracing

## Overview

This step implements comprehensive execution tracing to capture agent behavior, tool usage, decisions, and outcomes. This data forms the foundation for pattern detection and self-evolution.

## Dependencies

- Step 05: Agent Framework (base agent class)
- Step 04: Persistence Layer (storage)
- All agent implementations (CP1-CP4)

---

## Part 1: Trace Schema Definitions

### Core Trace Types

```typescript
import { z } from 'zod';

// Unique identifiers for trace correlation
export const TraceIdSchema = z.string().uuid();
export const SpanIdSchema = z.string().uuid();

// Span represents a single unit of work
export const SpanKindSchema = z.enum([
  'agent',      // Agent execution
  'tool',       // Tool invocation
  'llm',        // LLM API call
  'internal',   // Internal processing
  'workflow',   // Workflow state transition
]);

export type SpanKind = z.infer<typeof SpanKindSchema>;

export const SpanStatusSchema = z.enum([
  'unset',
  'ok',
  'error',
]);

export type SpanStatus = z.infer<typeof SpanStatusSchema>;

export const SpanSchema = z.object({
  spanId: SpanIdSchema,
  traceId: TraceIdSchema,
  parentSpanId: SpanIdSchema.optional(),
  name: z.string(),
  kind: SpanKindSchema,
  status: SpanStatusSchema,
  startTime: z.number(), // Unix timestamp ms
  endTime: z.number().optional(),
  duration: z.number().optional(), // Calculated
  attributes: z.record(z.string(), z.unknown()),
  events: z.array(z.object({
    name: z.string(),
    timestamp: z.number(),
    attributes: z.record(z.string(), z.unknown()).optional(),
  })),
  links: z.array(z.object({
    traceId: TraceIdSchema,
    spanId: SpanIdSchema,
    attributes: z.record(z.string(), z.unknown()).optional(),
  })).optional(),
});

export type Span = z.infer<typeof SpanSchema>;

// Complete trace containing all spans
export const TraceSchema = z.object({
  traceId: TraceIdSchema,
  rootSpanId: SpanIdSchema,
  projectId: z.string(),
  sessionId: z.string(),
  startTime: z.number(),
  endTime: z.number().optional(),
  status: SpanStatusSchema,
  spans: z.array(SpanSchema),
  metadata: z.object({
    userPrompt: z.string(),
    agentCount: z.number(),
    toolCount: z.number(),
    llmCallCount: z.number(),
    totalTokens: z.number(),
    totalCost: z.number(),
    workflowState: z.string(),
  }),
});

export type Trace = z.infer<typeof TraceSchema>;
```

### Agent-Specific Trace Attributes

```typescript
export const AgentTraceAttributesSchema = z.object({
  'agent.name': z.string(),
  'agent.type': z.string(),
  'agent.version': z.string().optional(),
  'agent.model': z.string(),
  'agent.temperature': z.number().optional(),
  'agent.maxTokens': z.number().optional(),
  'agent.systemPrompt.hash': z.string(), // Hash of system prompt
  'agent.systemPrompt.length': z.number(),
  'agent.input.type': z.string(),
  'agent.input.length': z.number(),
  'agent.output.type': z.string(),
  'agent.output.length': z.number(),
  'agent.output.success': z.boolean(),
  'agent.retryCount': z.number().default(0),
});

export type AgentTraceAttributes = z.infer<typeof AgentTraceAttributesSchema>;

export const ToolTraceAttributesSchema = z.object({
  'tool.name': z.string(),
  'tool.type': z.enum(['file', 'shell', 'api', 'git', 'llm', 'custom']),
  'tool.input.summary': z.string(),
  'tool.input.size': z.number(),
  'tool.output.summary': z.string(),
  'tool.output.size': z.number(),
  'tool.success': z.boolean(),
  'tool.error': z.string().optional(),
  'tool.duration': z.number(),
});

export type ToolTraceAttributes = z.infer<typeof ToolTraceAttributesSchema>;

export const LLMTraceAttributesSchema = z.object({
  'llm.provider': z.string(),
  'llm.model': z.string(),
  'llm.requestType': z.enum(['completion', 'chat', 'embedding']),
  'llm.inputTokens': z.number(),
  'llm.outputTokens': z.number(),
  'llm.totalTokens': z.number(),
  'llm.cost': z.number(),
  'llm.latency': z.number(),
  'llm.cacheHit': z.boolean().optional(),
  'llm.stopReason': z.string(),
  'llm.temperature': z.number().optional(),
  'llm.topP': z.number().optional(),
});

export type LLMTraceAttributes = z.infer<typeof LLMTraceAttributesSchema>;

export const WorkflowTraceAttributesSchema = z.object({
  'workflow.name': z.string(),
  'workflow.fromState': z.string(),
  'workflow.toState': z.string(),
  'workflow.trigger': z.string(),
  'workflow.checkpoint': z.string().optional(),
});

export type WorkflowTraceAttributes = z.infer<typeof WorkflowTraceAttributesSchema>;
```

### Decision Trace Schema

```typescript
// Captures decision points for later analysis
export const DecisionPointSchema = z.object({
  id: z.string().uuid(),
  spanId: SpanIdSchema,
  traceId: TraceIdSchema,
  timestamp: z.number(),
  agentName: z.string(),
  decisionType: z.enum([
    'tool_selection',
    'code_generation',
    'test_strategy',
    'error_handling',
    'retry_decision',
    'delegation',
    'approval_request',
    'merge_strategy',
    'rollback_decision',
  ]),
  context: z.object({
    input: z.string(),
    availableOptions: z.array(z.string()),
    constraints: z.array(z.string()).optional(),
    previousAttempts: z.number().default(0),
  }),
  decision: z.object({
    chosen: z.string(),
    reasoning: z.string().optional(),
    confidence: z.number().min(0).max(1).optional(),
    alternatives: z.array(z.object({
      option: z.string(),
      reason: z.string(),
    })).optional(),
  }),
  outcome: z.object({
    success: z.boolean(),
    result: z.string().optional(),
    error: z.string().optional(),
    metrics: z.record(z.string(), z.number()).optional(),
  }).optional(),
});

export type DecisionPoint = z.infer<typeof DecisionPointSchema>;
```

---

## Part 2: Trace Collection Infrastructure

### Tracer Implementation

```typescript
export class Tracer {
  private currentTrace: Trace | null = null;
  private spanStack: Span[] = [];
  private storage: TraceStorage;
  private listeners: TraceListener[] = [];

  constructor(storage: TraceStorage) {
    this.storage = storage;
  }

  startTrace(projectId: string, sessionId: string, userPrompt: string): Trace {
    const traceId = crypto.randomUUID();
    const rootSpanId = crypto.randomUUID();
    const now = Date.now();

    this.currentTrace = {
      traceId,
      rootSpanId,
      projectId,
      sessionId,
      startTime: now,
      status: 'unset',
      spans: [],
      metadata: {
        userPrompt,
        agentCount: 0,
        toolCount: 0,
        llmCallCount: 0,
        totalTokens: 0,
        totalCost: 0,
        workflowState: 'initial',
      },
    };

    // Create root span
    const rootSpan = this.startSpan('workflow:root', 'workflow');
    rootSpan.attributes['workflow.name'] = 'main';
    rootSpan.attributes['workflow.fromState'] = 'initial';

    return this.currentTrace;
  }

  startSpan(name: string, kind: SpanKind, attributes: Record<string, unknown> = {}): Span {
    if (!this.currentTrace) {
      throw new Error('No active trace. Call startTrace first.');
    }

    const parentSpan = this.spanStack[this.spanStack.length - 1];

    const span: Span = {
      spanId: crypto.randomUUID(),
      traceId: this.currentTrace.traceId,
      parentSpanId: parentSpan?.spanId,
      name,
      kind,
      status: 'unset',
      startTime: Date.now(),
      attributes,
      events: [],
    };

    this.spanStack.push(span);
    this.currentTrace.spans.push(span);

    // Update metadata counters
    if (kind === 'agent') this.currentTrace.metadata.agentCount++;
    if (kind === 'tool') this.currentTrace.metadata.toolCount++;
    if (kind === 'llm') this.currentTrace.metadata.llmCallCount++;

    this.notifyListeners('spanStart', span);
    return span;
  }

  endSpan(status: SpanStatus = 'ok', attributes: Record<string, unknown> = {}): Span | null {
    const span = this.spanStack.pop();
    if (!span) return null;

    span.endTime = Date.now();
    span.duration = span.endTime - span.startTime;
    span.status = status;
    Object.assign(span.attributes, attributes);

    // Update cost tracking for LLM spans
    if (span.kind === 'llm' && this.currentTrace) {
      const tokens = (span.attributes['llm.totalTokens'] as number) || 0;
      const cost = (span.attributes['llm.cost'] as number) || 0;
      this.currentTrace.metadata.totalTokens += tokens;
      this.currentTrace.metadata.totalCost += cost;
    }

    this.notifyListeners('spanEnd', span);
    return span;
  }

  addEvent(name: string, attributes?: Record<string, unknown>): void {
    const currentSpan = this.spanStack[this.spanStack.length - 1];
    if (!currentSpan) return;

    currentSpan.events.push({
      name,
      timestamp: Date.now(),
      attributes,
    });
  }

  setSpanAttribute(key: string, value: unknown): void {
    const currentSpan = this.spanStack[this.spanStack.length - 1];
    if (currentSpan) {
      currentSpan.attributes[key] = value;
    }
  }

  recordDecision(decision: Omit<DecisionPoint, 'id' | 'spanId' | 'traceId' | 'timestamp'>): DecisionPoint {
    const currentSpan = this.spanStack[this.spanStack.length - 1];
    if (!currentSpan || !this.currentTrace) {
      throw new Error('No active span for decision recording');
    }

    const decisionPoint: DecisionPoint = {
      id: crypto.randomUUID(),
      spanId: currentSpan.spanId,
      traceId: this.currentTrace.traceId,
      timestamp: Date.now(),
      ...decision,
    };

    this.addEvent('decision', {
      decisionId: decisionPoint.id,
      type: decisionPoint.decisionType,
      chosen: decisionPoint.decision.chosen,
    });

    this.notifyListeners('decision', decisionPoint);
    return decisionPoint;
  }

  async endTrace(status: SpanStatus = 'ok'): Promise<Trace> {
    if (!this.currentTrace) {
      throw new Error('No active trace');
    }

    // End all remaining spans
    while (this.spanStack.length > 0) {
      this.endSpan(status);
    }

    this.currentTrace.endTime = Date.now();
    this.currentTrace.status = status;

    // Persist trace
    await this.storage.saveTrace(this.currentTrace);

    const completedTrace = this.currentTrace;
    this.currentTrace = null;

    this.notifyListeners('traceEnd', completedTrace);
    return completedTrace;
  }

  getCurrentTrace(): Trace | null {
    return this.currentTrace;
  }

  getCurrentSpan(): Span | null {
    return this.spanStack[this.spanStack.length - 1] || null;
  }

  addListener(listener: TraceListener): void {
    this.listeners.push(listener);
  }

  removeListener(listener: TraceListener): void {
    const index = this.listeners.indexOf(listener);
    if (index > -1) {
      this.listeners.splice(index, 1);
    }
  }

  private notifyListeners(event: string, data: unknown): void {
    for (const listener of this.listeners) {
      try {
        listener.onEvent(event, data);
      } catch (error) {
        console.error('Trace listener error:', error);
      }
    }
  }
}

export interface TraceListener {
  onEvent(event: string, data: unknown): void;
}
```

### Cost Calculator

```typescript
export const ModelPricingSchema = z.object({
  inputPer1k: z.number(),
  outputPer1k: z.number(),
  cacheReadPer1k: z.number().optional(),
  cacheWritePer1k: z.number().optional(),
});

export type ModelPricing = z.infer<typeof ModelPricingSchema>;

export class CostCalculator {
  private pricing: Map<string, ModelPricing> = new Map([
    ['claude-sonnet-4-20250514', { inputPer1k: 0.003, outputPer1k: 0.015 }],
    ['claude-opus-4-20250514', { inputPer1k: 0.015, outputPer1k: 0.075 }],
    ['claude-haiku-3-20250514', { inputPer1k: 0.00025, outputPer1k: 0.00125 }],
  ]);

  calculateCost(
    model: string,
    inputTokens: number,
    outputTokens: number,
    cacheReadTokens?: number,
    cacheWriteTokens?: number
  ): number {
    const price = this.pricing.get(model);
    if (!price) {
      console.warn(`Unknown model pricing: ${model}`);
      return 0;
    }

    let cost = 0;
    cost += (inputTokens / 1000) * price.inputPer1k;
    cost += (outputTokens / 1000) * price.outputPer1k;

    if (cacheReadTokens && price.cacheReadPer1k) {
      cost += (cacheReadTokens / 1000) * price.cacheReadPer1k;
    }
    if (cacheWriteTokens && price.cacheWritePer1k) {
      cost += (cacheWriteTokens / 1000) * price.cacheWritePer1k;
    }

    return cost;
  }

  setPricing(model: string, pricing: ModelPricing): void {
    this.pricing.set(model, pricing);
  }

  getSessionCost(trace: Trace): {
    total: number;
    byModel: Record<string, number>;
    byAgent: Record<string, number>;
  } {
    const byModel: Record<string, number> = {};
    const byAgent: Record<string, number> = {};
    let total = 0;

    for (const span of trace.spans) {
      if (span.kind === 'llm') {
        const model = span.attributes['llm.model'] as string;
        const cost = span.attributes['llm.cost'] as number || 0;

        total += cost;
        byModel[model] = (byModel[model] || 0) + cost;

        // Find parent agent span
        const parentAgent = this.findParentAgent(trace, span);
        if (parentAgent) {
          const agentName = parentAgent.attributes['agent.name'] as string;
          byAgent[agentName] = (byAgent[agentName] || 0) + cost;
        }
      }
    }

    return { total, byModel, byAgent };
  }

  private findParentAgent(trace: Trace, span: Span): Span | null {
    if (!span.parentSpanId) return null;

    const parent = trace.spans.find(s => s.spanId === span.parentSpanId);
    if (!parent) return null;

    if (parent.kind === 'agent') return parent;
    return this.findParentAgent(trace, parent);
  }
}
```

---

## Part 3: Trace Storage

### Storage Interface and SQLite Implementation

```typescript
export interface TraceStorage {
  saveTrace(trace: Trace): Promise<void>;
  getTrace(traceId: string): Promise<Trace | null>;
  queryTraces(query: TraceQuery): Promise<Trace[]>;
  saveDecision(decision: DecisionPoint): Promise<void>;
  getDecisions(traceId: string): Promise<DecisionPoint[]>;
  queryDecisions(query: DecisionQuery): Promise<DecisionPoint[]>;
  getTraceStats(projectId: string, timeRange?: TimeRange): Promise<TraceStats>;
}

export const TraceQuerySchema = z.object({
  projectId: z.string().optional(),
  sessionId: z.string().optional(),
  status: SpanStatusSchema.optional(),
  minDuration: z.number().optional(),
  maxDuration: z.number().optional(),
  agentName: z.string().optional(),
  hasError: z.boolean().optional(),
  startTimeAfter: z.number().optional(),
  startTimeBefore: z.number().optional(),
  limit: z.number().default(100),
  offset: z.number().default(0),
});

export type TraceQuery = z.infer<typeof TraceQuerySchema>;

export const DecisionQuerySchema = z.object({
  traceId: z.string().optional(),
  agentName: z.string().optional(),
  decisionType: z.string().optional(),
  success: z.boolean().optional(),
  minConfidence: z.number().optional(),
  limit: z.number().default(100),
  offset: z.number().default(0),
});

export type DecisionQuery = z.infer<typeof DecisionQuerySchema>;

export interface TimeRange {
  start: number;
  end: number;
}

export interface TraceStats {
  totalTraces: number;
  totalSpans: number;
  totalDecisions: number;
  avgDuration: number;
  avgTokens: number;
  avgCost: number;
  successRate: number;
  agentUsage: Record<string, number>;
  toolUsage: Record<string, number>;
  decisionTypeBreakdown: Record<string, number>;
}

export class SQLiteTraceStorage implements TraceStorage {
  private db: Database;

  constructor(dbPath: string) {
    this.db = new Database(dbPath);
    this.initializeSchema();
  }

  private initializeSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS traces (
        trace_id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        session_id TEXT NOT NULL,
        start_time INTEGER NOT NULL,
        end_time INTEGER,
        status TEXT NOT NULL,
        metadata JSON NOT NULL,
        spans JSON NOT NULL,
        created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000)
      );

      CREATE INDEX IF NOT EXISTS idx_traces_project ON traces(project_id);
      CREATE INDEX IF NOT EXISTS idx_traces_session ON traces(session_id);
      CREATE INDEX IF NOT EXISTS idx_traces_start_time ON traces(start_time);
      CREATE INDEX IF NOT EXISTS idx_traces_status ON traces(status);

      CREATE TABLE IF NOT EXISTS decisions (
        id TEXT PRIMARY KEY,
        trace_id TEXT NOT NULL,
        span_id TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        agent_name TEXT NOT NULL,
        decision_type TEXT NOT NULL,
        context JSON NOT NULL,
        decision JSON NOT NULL,
        outcome JSON,
        created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
        FOREIGN KEY (trace_id) REFERENCES traces(trace_id)
      );

      CREATE INDEX IF NOT EXISTS idx_decisions_trace ON decisions(trace_id);
      CREATE INDEX IF NOT EXISTS idx_decisions_agent ON decisions(agent_name);
      CREATE INDEX IF NOT EXISTS idx_decisions_type ON decisions(decision_type);

      CREATE TABLE IF NOT EXISTS span_metrics (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        trace_id TEXT NOT NULL,
        span_id TEXT NOT NULL,
        span_name TEXT NOT NULL,
        span_kind TEXT NOT NULL,
        duration INTEGER NOT NULL,
        tokens INTEGER DEFAULT 0,
        cost REAL DEFAULT 0,
        success INTEGER NOT NULL,
        created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
        FOREIGN KEY (trace_id) REFERENCES traces(trace_id)
      );

      CREATE INDEX IF NOT EXISTS idx_span_metrics_trace ON span_metrics(trace_id);
      CREATE INDEX IF NOT EXISTS idx_span_metrics_kind ON span_metrics(span_kind);
      CREATE INDEX IF NOT EXISTS idx_span_metrics_name ON span_metrics(span_name);
    `);
  }

  async saveTrace(trace: Trace): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO traces
      (trace_id, project_id, session_id, start_time, end_time, status, metadata, spans)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      trace.traceId,
      trace.projectId,
      trace.sessionId,
      trace.startTime,
      trace.endTime,
      trace.status,
      JSON.stringify(trace.metadata),
      JSON.stringify(trace.spans)
    );

    // Index span metrics for faster queries
    const metricsStmt = this.db.prepare(`
      INSERT INTO span_metrics
      (trace_id, span_id, span_name, span_kind, duration, tokens, cost, success)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertMetrics = this.db.transaction((spans: Span[]) => {
      for (const span of spans) {
        if (span.duration) {
          metricsStmt.run(
            trace.traceId,
            span.spanId,
            span.name,
            span.kind,
            span.duration,
            span.attributes['llm.totalTokens'] || 0,
            span.attributes['llm.cost'] || 0,
            span.status === 'ok' ? 1 : 0
          );
        }
      }
    });

    insertMetrics(trace.spans);
  }

  async getTrace(traceId: string): Promise<Trace | null> {
    const row = this.db.prepare(`
      SELECT * FROM traces WHERE trace_id = ?
    `).get(traceId) as any;

    if (!row) return null;

    return {
      traceId: row.trace_id,
      rootSpanId: JSON.parse(row.spans)[0]?.spanId,
      projectId: row.project_id,
      sessionId: row.session_id,
      startTime: row.start_time,
      endTime: row.end_time,
      status: row.status,
      metadata: JSON.parse(row.metadata),
      spans: JSON.parse(row.spans),
    };
  }

  async queryTraces(query: TraceQuery): Promise<Trace[]> {
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (query.projectId) {
      conditions.push('project_id = ?');
      params.push(query.projectId);
    }
    if (query.sessionId) {
      conditions.push('session_id = ?');
      params.push(query.sessionId);
    }
    if (query.status) {
      conditions.push('status = ?');
      params.push(query.status);
    }
    if (query.startTimeAfter) {
      conditions.push('start_time >= ?');
      params.push(query.startTimeAfter);
    }
    if (query.startTimeBefore) {
      conditions.push('start_time <= ?');
      params.push(query.startTimeBefore);
    }

    const whereClause = conditions.length > 0
      ? `WHERE ${conditions.join(' AND ')}`
      : '';

    const sql = `
      SELECT * FROM traces
      ${whereClause}
      ORDER BY start_time DESC
      LIMIT ? OFFSET ?
    `;

    params.push(query.limit, query.offset);

    const rows = this.db.prepare(sql).all(...params) as any[];

    return rows.map(row => ({
      traceId: row.trace_id,
      rootSpanId: JSON.parse(row.spans)[0]?.spanId,
      projectId: row.project_id,
      sessionId: row.session_id,
      startTime: row.start_time,
      endTime: row.end_time,
      status: row.status,
      metadata: JSON.parse(row.metadata),
      spans: JSON.parse(row.spans),
    }));
  }

  async saveDecision(decision: DecisionPoint): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT INTO decisions
      (id, trace_id, span_id, timestamp, agent_name, decision_type, context, decision, outcome)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      decision.id,
      decision.traceId,
      decision.spanId,
      decision.timestamp,
      decision.agentName,
      decision.decisionType,
      JSON.stringify(decision.context),
      JSON.stringify(decision.decision),
      decision.outcome ? JSON.stringify(decision.outcome) : null
    );
  }

  async getDecisions(traceId: string): Promise<DecisionPoint[]> {
    const rows = this.db.prepare(`
      SELECT * FROM decisions WHERE trace_id = ? ORDER BY timestamp
    `).all(traceId) as any[];

    return rows.map(this.mapDecisionRow);
  }

  async queryDecisions(query: DecisionQuery): Promise<DecisionPoint[]> {
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (query.traceId) {
      conditions.push('trace_id = ?');
      params.push(query.traceId);
    }
    if (query.agentName) {
      conditions.push('agent_name = ?');
      params.push(query.agentName);
    }
    if (query.decisionType) {
      conditions.push('decision_type = ?');
      params.push(query.decisionType);
    }

    const whereClause = conditions.length > 0
      ? `WHERE ${conditions.join(' AND ')}`
      : '';

    const sql = `
      SELECT * FROM decisions
      ${whereClause}
      ORDER BY timestamp DESC
      LIMIT ? OFFSET ?
    `;

    params.push(query.limit, query.offset);

    const rows = this.db.prepare(sql).all(...params) as any[];
    return rows.map(this.mapDecisionRow);
  }

  private mapDecisionRow(row: any): DecisionPoint {
    return {
      id: row.id,
      traceId: row.trace_id,
      spanId: row.span_id,
      timestamp: row.timestamp,
      agentName: row.agent_name,
      decisionType: row.decision_type,
      context: JSON.parse(row.context),
      decision: JSON.parse(row.decision),
      outcome: row.outcome ? JSON.parse(row.outcome) : undefined,
    };
  }

  async getTraceStats(projectId: string, timeRange?: TimeRange): Promise<TraceStats> {
    let timeCondition = '';
    const params: unknown[] = [projectId];

    if (timeRange) {
      timeCondition = 'AND start_time >= ? AND start_time <= ?';
      params.push(timeRange.start, timeRange.end);
    }

    // Basic stats
    const basicStats = this.db.prepare(`
      SELECT
        COUNT(*) as total_traces,
        AVG(end_time - start_time) as avg_duration,
        AVG(json_extract(metadata, '$.totalTokens')) as avg_tokens,
        AVG(json_extract(metadata, '$.totalCost')) as avg_cost,
        SUM(CASE WHEN status = 'ok' THEN 1 ELSE 0 END) * 1.0 / COUNT(*) as success_rate
      FROM traces
      WHERE project_id = ? ${timeCondition}
    `).get(...params) as any;

    // Span counts
    const spanCount = this.db.prepare(`
      SELECT COUNT(*) as total_spans
      FROM span_metrics sm
      JOIN traces t ON sm.trace_id = t.trace_id
      WHERE t.project_id = ? ${timeCondition}
    `).get(...params) as any;

    // Decision counts
    const decisionCount = this.db.prepare(`
      SELECT COUNT(*) as total_decisions
      FROM decisions d
      JOIN traces t ON d.trace_id = t.trace_id
      WHERE t.project_id = ? ${timeCondition}
    `).get(...params) as any;

    // Agent usage
    const agentUsage = this.db.prepare(`
      SELECT span_name, COUNT(*) as count
      FROM span_metrics sm
      JOIN traces t ON sm.trace_id = t.trace_id
      WHERE t.project_id = ? AND sm.span_kind = 'agent' ${timeCondition}
      GROUP BY span_name
    `).all(...params) as any[];

    // Tool usage
    const toolUsage = this.db.prepare(`
      SELECT span_name, COUNT(*) as count
      FROM span_metrics sm
      JOIN traces t ON sm.trace_id = t.trace_id
      WHERE t.project_id = ? AND sm.span_kind = 'tool' ${timeCondition}
      GROUP BY span_name
    `).all(...params) as any[];

    // Decision type breakdown
    const decisionTypes = this.db.prepare(`
      SELECT decision_type, COUNT(*) as count
      FROM decisions d
      JOIN traces t ON d.trace_id = t.trace_id
      WHERE t.project_id = ? ${timeCondition}
      GROUP BY decision_type
    `).all(...params) as any[];

    return {
      totalTraces: basicStats.total_traces,
      totalSpans: spanCount.total_spans,
      totalDecisions: decisionCount.total_decisions,
      avgDuration: basicStats.avg_duration || 0,
      avgTokens: basicStats.avg_tokens || 0,
      avgCost: basicStats.avg_cost || 0,
      successRate: basicStats.success_rate || 0,
      agentUsage: Object.fromEntries(agentUsage.map(r => [r.span_name, r.count])),
      toolUsage: Object.fromEntries(toolUsage.map(r => [r.span_name, r.count])),
      decisionTypeBreakdown: Object.fromEntries(decisionTypes.map(r => [r.decision_type, r.count])),
    };
  }
}
```

---

## Part 4: Instrumentation Wrappers

### Agent Instrumentation

```typescript
export function instrumentAgent<T extends BaseAgent>(
  agent: T,
  tracer: Tracer
): T {
  const originalExecute = agent.execute.bind(agent);

  agent.execute = async function(input: unknown): Promise<unknown> {
    const span = tracer.startSpan(`agent:${agent.name}`, 'agent', {
      'agent.name': agent.name,
      'agent.type': agent.constructor.name,
      'agent.model': agent.model,
      'agent.input.type': typeof input,
      'agent.input.length': JSON.stringify(input).length,
    });

    try {
      const result = await originalExecute(input);

      tracer.setSpanAttribute('agent.output.type', typeof result);
      tracer.setSpanAttribute('agent.output.length', JSON.stringify(result).length);
      tracer.setSpanAttribute('agent.output.success', true);

      tracer.endSpan('ok');
      return result;
    } catch (error) {
      tracer.setSpanAttribute('agent.output.success', false);
      tracer.setSpanAttribute('agent.error', error instanceof Error ? error.message : String(error));
      tracer.endSpan('error');
      throw error;
    }
  };

  return agent;
}

// Decorator version for class methods
export function Traced(spanName?: string, kind: SpanKind = 'internal') {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: unknown[]) {
      const tracer = (this as any).tracer as Tracer;
      if (!tracer) {
        return originalMethod.apply(this, args);
      }

      const name = spanName || `${target.constructor.name}:${propertyKey}`;
      tracer.startSpan(name, kind);

      try {
        const result = await originalMethod.apply(this, args);
        tracer.endSpan('ok');
        return result;
      } catch (error) {
        tracer.endSpan('error', {
          error: error instanceof Error ? error.message : String(error),
        });
        throw error;
      }
    };

    return descriptor;
  };
}
```

### LLM Client Instrumentation

```typescript
export function instrumentLLMClient(
  client: Anthropic,
  tracer: Tracer,
  costCalculator: CostCalculator
): Anthropic {
  const originalCreate = client.messages.create.bind(client.messages);

  client.messages.create = async function(params: any): Promise<any> {
    const span = tracer.startSpan('llm:anthropic', 'llm', {
      'llm.provider': 'anthropic',
      'llm.model': params.model,
      'llm.requestType': 'chat',
      'llm.maxTokens': params.max_tokens,
      'llm.temperature': params.temperature,
    });

    const startTime = Date.now();

    try {
      const response = await originalCreate(params);

      const inputTokens = response.usage?.input_tokens || 0;
      const outputTokens = response.usage?.output_tokens || 0;
      const totalTokens = inputTokens + outputTokens;
      const cost = costCalculator.calculateCost(
        params.model,
        inputTokens,
        outputTokens
      );

      tracer.setSpanAttribute('llm.inputTokens', inputTokens);
      tracer.setSpanAttribute('llm.outputTokens', outputTokens);
      tracer.setSpanAttribute('llm.totalTokens', totalTokens);
      tracer.setSpanAttribute('llm.cost', cost);
      tracer.setSpanAttribute('llm.latency', Date.now() - startTime);
      tracer.setSpanAttribute('llm.stopReason', response.stop_reason);

      tracer.endSpan('ok');
      return response;
    } catch (error) {
      tracer.endSpan('error', {
        'llm.error': error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  };

  return client;
}
```

### Tool Instrumentation

```typescript
export function instrumentTool<T extends (...args: any[]) => Promise<any>>(
  tool: T,
  toolName: string,
  toolType: ToolTraceAttributes['tool.type'],
  tracer: Tracer
): T {
  return (async (...args: Parameters<T>): Promise<ReturnType<T>> => {
    const inputSummary = JSON.stringify(args).substring(0, 200);

    const span = tracer.startSpan(`tool:${toolName}`, 'tool', {
      'tool.name': toolName,
      'tool.type': toolType,
      'tool.input.summary': inputSummary,
      'tool.input.size': JSON.stringify(args).length,
    });

    const startTime = Date.now();

    try {
      const result = await tool(...args);

      const outputSummary = JSON.stringify(result).substring(0, 200);
      tracer.setSpanAttribute('tool.output.summary', outputSummary);
      tracer.setSpanAttribute('tool.output.size', JSON.stringify(result).length);
      tracer.setSpanAttribute('tool.success', true);
      tracer.setSpanAttribute('tool.duration', Date.now() - startTime);

      tracer.endSpan('ok');
      return result;
    } catch (error) {
      tracer.setSpanAttribute('tool.success', false);
      tracer.setSpanAttribute('tool.error', error instanceof Error ? error.message : String(error));
      tracer.setSpanAttribute('tool.duration', Date.now() - startTime);

      tracer.endSpan('error');
      throw error;
    }
  }) as T;
}
```

---

## Part 5: Trace Visualization

### Trace Tree Builder

```typescript
export interface TraceTreeNode {
  span: Span;
  children: TraceTreeNode[];
  depth: number;
}

export class TraceTreeBuilder {
  buildTree(trace: Trace): TraceTreeNode {
    const spanMap = new Map<string, Span>();
    const childrenMap = new Map<string, Span[]>();

    // Index spans
    for (const span of trace.spans) {
      spanMap.set(span.spanId, span);
      if (!childrenMap.has(span.spanId)) {
        childrenMap.set(span.spanId, []);
      }
      if (span.parentSpanId) {
        const siblings = childrenMap.get(span.parentSpanId) || [];
        siblings.push(span);
        childrenMap.set(span.parentSpanId, siblings);
      }
    }

    // Find root span
    const rootSpan = spanMap.get(trace.rootSpanId);
    if (!rootSpan) {
      throw new Error('Root span not found');
    }

    // Build tree recursively
    const buildNode = (span: Span, depth: number): TraceTreeNode => {
      const children = childrenMap.get(span.spanId) || [];
      return {
        span,
        depth,
        children: children
          .sort((a, b) => a.startTime - b.startTime)
          .map(child => buildNode(child, depth + 1)),
      };
    };

    return buildNode(rootSpan, 0);
  }

  toASCII(node: TraceTreeNode, prefix = ''): string {
    const lines: string[] = [];
    const statusIcon = node.span.status === 'ok' ? '✓' : node.span.status === 'error' ? '✗' : '○';
    const duration = node.span.duration ? `${node.span.duration}ms` : 'running';

    lines.push(`${prefix}${statusIcon} ${node.span.name} (${duration})`);

    for (let i = 0; i < node.children.length; i++) {
      const isLast = i === node.children.length - 1;
      const childPrefix = prefix + (isLast ? '└── ' : '├── ');
      const grandchildPrefix = prefix + (isLast ? '    ' : '│   ');
      lines.push(this.toASCII(node.children[i], childPrefix).replace(childPrefix, childPrefix));

      // Fix the recursive call to use proper prefix
      const childLines = this.toASCII(node.children[i], '').split('\n');
      lines.pop(); // Remove the incorrectly added line
      lines.push(`${childPrefix}${childLines[0]}`);
      for (let j = 1; j < childLines.length; j++) {
        lines.push(`${grandchildPrefix}${childLines[j]}`);
      }
    }

    return lines.join('\n');
  }

  toTimeline(trace: Trace): string {
    const lines: string[] = [];
    const minTime = trace.startTime;
    const maxTime = trace.endTime || Date.now();
    const totalDuration = maxTime - minTime;
    const width = 60;

    lines.push(`Timeline (${totalDuration}ms total)`);
    lines.push('─'.repeat(width + 20));

    const sortedSpans = [...trace.spans].sort((a, b) => a.startTime - b.startTime);

    for (const span of sortedSpans) {
      const startOffset = Math.floor(((span.startTime - minTime) / totalDuration) * width);
      const duration = span.duration || (Date.now() - span.startTime);
      const barWidth = Math.max(1, Math.floor((duration / totalDuration) * width));

      const bar = ' '.repeat(startOffset) + '█'.repeat(barWidth);
      const statusIcon = span.status === 'ok' ? '✓' : span.status === 'error' ? '✗' : '○';

      lines.push(`${statusIcon} ${span.name.substring(0, 15).padEnd(15)} |${bar}`);
    }

    return lines.join('\n');
  }
}
```

### Trace Export

```typescript
export class TraceExporter {
  // Export to OpenTelemetry-compatible format
  toOTLP(trace: Trace): object {
    return {
      resourceSpans: [{
        resource: {
          attributes: [
            { key: 'service.name', value: { stringValue: 'aigentflow' } },
            { key: 'project.id', value: { stringValue: trace.projectId } },
          ],
        },
        scopeSpans: [{
          scope: { name: 'aigentflow-tracer', version: '1.0.0' },
          spans: trace.spans.map(span => ({
            traceId: span.traceId.replace(/-/g, ''),
            spanId: span.spanId.replace(/-/g, '').substring(0, 16),
            parentSpanId: span.parentSpanId?.replace(/-/g, '').substring(0, 16),
            name: span.name,
            kind: this.mapSpanKind(span.kind),
            startTimeUnixNano: span.startTime * 1000000,
            endTimeUnixNano: (span.endTime || Date.now()) * 1000000,
            status: { code: span.status === 'ok' ? 1 : span.status === 'error' ? 2 : 0 },
            attributes: Object.entries(span.attributes).map(([key, value]) => ({
              key,
              value: this.mapAttributeValue(value),
            })),
            events: span.events.map(event => ({
              name: event.name,
              timeUnixNano: event.timestamp * 1000000,
              attributes: event.attributes
                ? Object.entries(event.attributes).map(([key, value]) => ({
                    key,
                    value: this.mapAttributeValue(value),
                  }))
                : [],
            })),
          })),
        }],
      }],
    };
  }

  private mapSpanKind(kind: SpanKind): number {
    const mapping: Record<SpanKind, number> = {
      agent: 1,     // INTERNAL
      tool: 3,      // CLIENT
      llm: 3,       // CLIENT
      internal: 1,  // INTERNAL
      workflow: 1,  // INTERNAL
    };
    return mapping[kind];
  }

  private mapAttributeValue(value: unknown): object {
    if (typeof value === 'string') return { stringValue: value };
    if (typeof value === 'number') {
      return Number.isInteger(value)
        ? { intValue: value }
        : { doubleValue: value };
    }
    if (typeof value === 'boolean') return { boolValue: value };
    return { stringValue: JSON.stringify(value) };
  }

  // Export to JSON for debugging
  toJSON(trace: Trace): string {
    return JSON.stringify(trace, null, 2);
  }

  // Export to CSV for analysis
  toCSV(traces: Trace[]): string {
    const headers = [
      'trace_id',
      'span_id',
      'parent_span_id',
      'name',
      'kind',
      'status',
      'start_time',
      'duration_ms',
      'tokens',
      'cost',
    ];

    const rows = [headers.join(',')];

    for (const trace of traces) {
      for (const span of trace.spans) {
        rows.push([
          trace.traceId,
          span.spanId,
          span.parentSpanId || '',
          `"${span.name}"`,
          span.kind,
          span.status,
          span.startTime,
          span.duration || '',
          span.attributes['llm.totalTokens'] || '',
          span.attributes['llm.cost'] || '',
        ].join(','));
      }
    }

    return rows.join('\n');
  }
}
```

---

## Part 6: Integration with Orchestrator

### Tracing-Enabled Orchestrator

```typescript
export class TracingOrchestrator {
  private tracer: Tracer;
  private costCalculator: CostCalculator;
  private treeBuilder: TraceTreeBuilder;
  private exporter: TraceExporter;

  constructor(
    private orchestrator: any,
    traceStorage: TraceStorage
  ) {
    this.tracer = new Tracer(traceStorage);
    this.costCalculator = new CostCalculator();
    this.treeBuilder = new TraceTreeBuilder();
    this.exporter = new TraceExporter();

    this.setupInstrumentation();
  }

  private setupInstrumentation(): void {
    // Instrument all agents
    for (const [name, agent] of this.orchestrator.agents) {
      this.orchestrator.agents.set(name, instrumentAgent(agent, this.tracer));
    }

    // Instrument LLM client
    this.orchestrator.llmClient = instrumentLLMClient(
      this.orchestrator.llmClient,
      this.tracer,
      this.costCalculator
    );

    // Instrument tools
    this.orchestrator.tools = Object.fromEntries(
      Object.entries(this.orchestrator.tools).map(([name, tool]) => [
        name,
        instrumentTool(tool as any, name, 'custom', this.tracer),
      ])
    );
  }

  async execute(prompt: string): Promise<{ result: unknown; trace: Trace }> {
    const trace = this.tracer.startTrace(
      this.orchestrator.projectId,
      crypto.randomUUID(),
      prompt
    );

    try {
      const result = await this.orchestrator.execute(prompt);
      const completedTrace = await this.tracer.endTrace('ok');

      return { result, trace: completedTrace };
    } catch (error) {
      const completedTrace = await this.tracer.endTrace('error');
      throw { error, trace: completedTrace };
    }
  }

  recordDecision(
    agentName: string,
    decisionType: DecisionPoint['decisionType'],
    context: DecisionPoint['context'],
    decision: DecisionPoint['decision']
  ): DecisionPoint {
    return this.tracer.recordDecision({
      agentName,
      decisionType,
      context,
      decision,
    });
  }

  updateDecisionOutcome(
    decisionId: string,
    outcome: DecisionPoint['outcome']
  ): void {
    // Update decision outcome in storage
    // This allows correlating decisions with their eventual outcomes
  }

  getTraceVisualization(trace: Trace): string {
    const tree = this.treeBuilder.buildTree(trace);
    return this.treeBuilder.toASCII(tree);
  }

  getTraceTimeline(trace: Trace): string {
    return this.treeBuilder.toTimeline(trace);
  }

  getCostSummary(trace: Trace): ReturnType<CostCalculator['getSessionCost']> {
    return this.costCalculator.getSessionCost(trace);
  }

  exportTrace(trace: Trace, format: 'json' | 'otlp' | 'csv'): string | object {
    switch (format) {
      case 'json':
        return this.exporter.toJSON(trace);
      case 'otlp':
        return this.exporter.toOTLP(trace);
      case 'csv':
        return this.exporter.toCSV([trace]);
    }
  }
}
```

---

## Validation Checklist

- [ ] Trace captures all agent executions with timing
- [ ] Spans properly nested with parent-child relationships
- [ ] LLM calls tracked with token counts and costs
- [ ] Tool invocations captured with input/output summaries
- [ ] Decision points recorded with context and reasoning
- [ ] Traces persisted to SQLite with efficient indexing
- [ ] Query API returns traces matching filter criteria
- [ ] Cost calculation accurate for all model types
- [ ] Trace tree visualization renders correctly
- [ ] Timeline visualization shows span ordering
- [ ] OTLP export compatible with standard observability tools
- [ ] Agent instrumentation preserves original behavior
- [ ] Stats aggregation provides meaningful metrics

---

## Next Steps

Proceed to **22-PATTERN-DETECTION.md** to implement pattern mining from collected traces.
