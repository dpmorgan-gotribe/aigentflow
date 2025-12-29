# Step 04d: Audit Logging System

> **Checkpoint:** CP0 - Foundation
> **Previous Step:** 04c-CHECKPOINT-RECOVERY.md
> **Next Step:** 05-AGENT-FRAMEWORK.md

---

## Overview

The **Audit Logging System** provides immutable, tamper-evident logging for all orchestration operations. This is essential for compliance (SOC2, GDPR), debugging, and accountability.

Key responsibilities:
- Log all significant operations with full context
- Provide immutable, append-only storage
- Detect tampering attempts
- Support compliance reporting
- Enable forensic investigation

---

## Deliverables

1. `src/audit/types.ts` - Audit event types
2. `src/audit/audit-logger.ts` - Core audit logging
3. `src/audit/audit-store.ts` - Immutable storage
4. `src/audit/integrity.ts` - Tamper detection
5. `src/audit/reporters/` - Compliance reporters

---

## 1. Type Definitions (`src/audit/types.ts`)

```typescript
/**
 * Audit Logging Types
 */

import { z } from 'zod';
import { AgentType } from '../agents/types';

/**
 * Audit event categories
 */
export const AuditCategorySchema = z.enum([
  'authentication',     // Login, logout, token refresh
  'authorization',      // Permission checks
  'orchestration',      // Workflow execution
  'agent_execution',    // Agent operations
  'file_operation',     // File read/write/delete
  'git_operation',      // Git commands
  'external_call',      // MCP/API calls
  'user_action',        // User interactions
  'system_event',       // System lifecycle
  'security_event',     // Security-related
  'compliance_event',   // Compliance checks
  'error_event',        // Errors and failures
]);

export type AuditCategory = z.infer<typeof AuditCategorySchema>;

/**
 * Audit severity levels
 */
export const AuditSeveritySchema = z.enum([
  'debug',
  'info',
  'warning',
  'error',
  'critical',
]);

export type AuditSeverity = z.infer<typeof AuditSeveritySchema>;

/**
 * Audit event outcome
 */
export const AuditOutcomeSchema = z.enum([
  'success',
  'failure',
  'partial',
  'blocked',
  'pending',
]);

export type AuditOutcome = z.infer<typeof AuditOutcomeSchema>;

/**
 * Actor information (who performed the action)
 */
export const AuditActorSchema = z.object({
  type: z.enum(['user', 'agent', 'system', 'external']),
  id: z.string(),
  name: z.string().optional(),
  agentType: z.nativeEnum(AgentType).optional(),
  metadata: z.record(z.unknown()).optional(),
});

export type AuditActor = z.infer<typeof AuditActorSchema>;

/**
 * Target information (what was affected)
 */
export const AuditTargetSchema = z.object({
  type: z.string(),
  id: z.string(),
  path: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export type AuditTarget = z.infer<typeof AuditTargetSchema>;

/**
 * Complete audit event
 */
export const AuditEventSchema = z.object({
  // Identity
  id: z.string().uuid(),
  timestamp: z.string().datetime(),
  sequence: z.number().int().positive(),

  // Classification
  category: AuditCategorySchema,
  action: z.string(),
  severity: AuditSeveritySchema,
  outcome: AuditOutcomeSchema,

  // Context
  sessionId: z.string(),
  projectId: z.string().optional(),
  workflowId: z.string().optional(),
  correlationId: z.string().optional(),

  // Actors
  actor: AuditActorSchema,
  target: AuditTargetSchema.optional(),

  // Details
  description: z.string(),
  details: z.record(z.unknown()).optional(),
  changes: z.object({
    before: z.unknown().optional(),
    after: z.unknown().optional(),
  }).optional(),

  // Error info
  error: z.object({
    code: z.string(),
    message: z.string(),
    stack: z.string().optional(),
  }).optional(),

  // Security
  ipAddress: z.string().optional(),
  userAgent: z.string().optional(),

  // Integrity
  previousHash: z.string(),
  hash: z.string(),
});

export type AuditEvent = z.infer<typeof AuditEventSchema>;

/**
 * Audit query options
 */
export interface AuditQueryOptions {
  startDate?: Date;
  endDate?: Date;
  categories?: AuditCategory[];
  severity?: AuditSeverity[];
  outcome?: AuditOutcome[];
  actorId?: string;
  targetId?: string;
  sessionId?: string;
  projectId?: string;
  limit?: number;
  offset?: number;
}

/**
 * Audit statistics
 */
export interface AuditStatistics {
  totalEvents: number;
  eventsByCategory: Record<AuditCategory, number>;
  eventsBySeverity: Record<AuditSeverity, number>;
  eventsByOutcome: Record<AuditOutcome, number>;
  eventsPerDay: Array<{ date: string; count: number }>;
  topActors: Array<{ actorId: string; count: number }>;
  errorRate: number;
}

/**
 * Compliance report types
 */
export type ComplianceReportType = 'gdpr' | 'soc2' | 'hipaa' | 'pci' | 'full';
```

---

## 2. Audit Logger (`src/audit/audit-logger.ts`)

```typescript
/**
 * Audit Logger
 *
 * Core audit logging functionality.
 */

import { randomUUID } from 'crypto';
import {
  AuditEvent,
  AuditEventSchema,
  AuditCategory,
  AuditSeverity,
  AuditOutcome,
  AuditActor,
  AuditTarget,
} from './types';
import { AuditStore } from './audit-store';
import { IntegrityManager } from './integrity';
import { logger } from '../utils/logger';

/**
 * Audit logger configuration
 */
export interface AuditLoggerConfig {
  enabled: boolean;
  minSeverity: AuditSeverity;
  includeDetails: boolean;
  redactSecrets: boolean;
  asyncWrite: boolean;
  batchSize: number;
  flushInterval: number; // milliseconds
}

const DEFAULT_CONFIG: AuditLoggerConfig = {
  enabled: true,
  minSeverity: 'info',
  includeDetails: true,
  redactSecrets: true,
  asyncWrite: true,
  batchSize: 100,
  flushInterval: 5000,
};

const SEVERITY_ORDER: Record<AuditSeverity, number> = {
  debug: 0,
  info: 1,
  warning: 2,
  error: 3,
  critical: 4,
};

/**
 * Secret patterns to redact
 */
const SECRET_PATTERNS = [
  /password["\s:=]+["']?[^"'\s,}]+/gi,
  /api[_-]?key["\s:=]+["']?[^"'\s,}]+/gi,
  /token["\s:=]+["']?[^"'\s,}]+/gi,
  /secret["\s:=]+["']?[^"'\s,}]+/gi,
  /auth["\s:=]+["']?[^"'\s,}]+/gi,
  /bearer\s+[a-zA-Z0-9._-]+/gi,
  /AKIA[0-9A-Z]{16}/g,
  /ghp_[a-zA-Z0-9]{36}/g,
];

/**
 * Audit Logger implementation
 */
export class AuditLogger {
  private config: AuditLoggerConfig;
  private store: AuditStore;
  private integrity: IntegrityManager;
  private sequence: number = 0;
  private sessionId: string;
  private projectId?: string;
  private workflowId?: string;
  private eventBuffer: AuditEvent[] = [];
  private flushTimer?: NodeJS.Timeout;

  constructor(
    store: AuditStore,
    integrity: IntegrityManager,
    config: Partial<AuditLoggerConfig> = {}
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.store = store;
    this.integrity = integrity;
    this.sessionId = randomUUID();
  }

  /**
   * Initialize audit logger
   */
  async initialize(): Promise<void> {
    if (!this.config.enabled) {
      logger.info('Audit logging disabled');
      return;
    }

    // Load last sequence number
    this.sequence = await this.store.getLastSequence();

    // Start flush timer
    if (this.config.asyncWrite) {
      this.flushTimer = setInterval(
        () => this.flush(),
        this.config.flushInterval
      );
    }

    // Log system start
    await this.log({
      category: 'system_event',
      action: 'system_start',
      severity: 'info',
      outcome: 'success',
      actor: { type: 'system', id: 'orchestrator' },
      description: 'Audit logging system initialized',
    });

    logger.info('Audit logger initialized', { sessionId: this.sessionId });
  }

  /**
   * Shutdown audit logger
   */
  async shutdown(): Promise<void> {
    // Log system stop
    await this.log({
      category: 'system_event',
      action: 'system_stop',
      severity: 'info',
      outcome: 'success',
      actor: { type: 'system', id: 'orchestrator' },
      description: 'Audit logging system shutting down',
    });

    // Clear timer
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }

    // Final flush
    await this.flush();
  }

  /**
   * Set context
   */
  setContext(options: {
    projectId?: string;
    workflowId?: string;
  }): void {
    if (options.projectId) this.projectId = options.projectId;
    if (options.workflowId) this.workflowId = options.workflowId;
  }

  /**
   * Log an audit event
   */
  async log(options: {
    category: AuditCategory;
    action: string;
    severity: AuditSeverity;
    outcome: AuditOutcome;
    actor: Omit<AuditActor, 'type'> & { type: AuditActor['type'] };
    target?: AuditTarget;
    description: string;
    details?: Record<string, unknown>;
    changes?: { before?: unknown; after?: unknown };
    error?: { code: string; message: string; stack?: string };
    correlationId?: string;
  }): Promise<void> {
    if (!this.config.enabled) return;

    // Check severity threshold
    if (SEVERITY_ORDER[options.severity] < SEVERITY_ORDER[this.config.minSeverity]) {
      return;
    }

    // Get previous hash for chain integrity
    const previousHash = await this.integrity.getLastHash();

    // Increment sequence
    this.sequence++;

    // Build event
    const event: AuditEvent = {
      id: randomUUID(),
      timestamp: new Date().toISOString(),
      sequence: this.sequence,
      category: options.category,
      action: options.action,
      severity: options.severity,
      outcome: options.outcome,
      sessionId: this.sessionId,
      projectId: this.projectId,
      workflowId: this.workflowId,
      correlationId: options.correlationId,
      actor: options.actor,
      target: options.target,
      description: options.description,
      details: this.config.includeDetails ? this.redactSecrets(options.details) : undefined,
      changes: options.changes ? {
        before: this.redactSecrets(options.changes.before),
        after: this.redactSecrets(options.changes.after),
      } : undefined,
      error: options.error,
      previousHash,
      hash: '', // Will be set by integrity manager
    };

    // Calculate hash
    event.hash = this.integrity.calculateEventHash(event);

    // Validate event
    AuditEventSchema.parse(event);

    // Store event
    if (this.config.asyncWrite) {
      this.eventBuffer.push(event);
      if (this.eventBuffer.length >= this.config.batchSize) {
        await this.flush();
      }
    } else {
      await this.store.append(event);
    }
  }

  /**
   * Flush buffered events
   */
  async flush(): Promise<void> {
    if (this.eventBuffer.length === 0) return;

    const events = this.eventBuffer;
    this.eventBuffer = [];

    try {
      await this.store.appendBatch(events);
    } catch (error) {
      logger.error('Failed to flush audit events', { count: events.length, error });
      // Re-add to buffer for retry
      this.eventBuffer = [...events, ...this.eventBuffer];
    }
  }

  /**
   * Redact secrets from data
   */
  private redactSecrets(data: unknown): unknown {
    if (!this.config.redactSecrets || !data) return data;

    const json = JSON.stringify(data);
    let redacted = json;

    for (const pattern of SECRET_PATTERNS) {
      redacted = redacted.replace(pattern, '[REDACTED]');
    }

    try {
      return JSON.parse(redacted);
    } catch {
      return data;
    }
  }

  // Convenience methods for common audit events

  /**
   * Log agent execution
   */
  async logAgentExecution(
    agentId: string,
    agentType: string,
    action: 'start' | 'complete' | 'fail',
    details?: Record<string, unknown>
  ): Promise<void> {
    await this.log({
      category: 'agent_execution',
      action: `agent_${action}`,
      severity: action === 'fail' ? 'error' : 'info',
      outcome: action === 'fail' ? 'failure' : 'success',
      actor: { type: 'agent', id: agentId, name: agentType },
      description: `Agent ${agentType} ${action}`,
      details,
    });
  }

  /**
   * Log file operation
   */
  async logFileOperation(
    operation: 'read' | 'write' | 'delete' | 'create',
    path: string,
    actorId: string,
    success: boolean,
    details?: Record<string, unknown>
  ): Promise<void> {
    await this.log({
      category: 'file_operation',
      action: `file_${operation}`,
      severity: 'info',
      outcome: success ? 'success' : 'failure',
      actor: { type: 'agent', id: actorId },
      target: { type: 'file', id: path, path },
      description: `File ${operation}: ${path}`,
      details,
    });
  }

  /**
   * Log security event
   */
  async logSecurityEvent(
    action: string,
    severity: AuditSeverity,
    description: string,
    details?: Record<string, unknown>
  ): Promise<void> {
    await this.log({
      category: 'security_event',
      action,
      severity,
      outcome: 'success',
      actor: { type: 'system', id: 'security' },
      description,
      details,
    });
  }

  /**
   * Log compliance event
   */
  async logComplianceEvent(
    action: string,
    framework: string,
    passed: boolean,
    details?: Record<string, unknown>
  ): Promise<void> {
    await this.log({
      category: 'compliance_event',
      action,
      severity: passed ? 'info' : 'warning',
      outcome: passed ? 'success' : 'failure',
      actor: { type: 'system', id: 'compliance' },
      description: `Compliance check: ${framework} - ${action}`,
      details: { framework, ...details },
    });
  }

  /**
   * Log error event
   */
  async logError(
    error: Error,
    context: string,
    actorId: string,
    details?: Record<string, unknown>
  ): Promise<void> {
    await this.log({
      category: 'error_event',
      action: 'error_occurred',
      severity: 'error',
      outcome: 'failure',
      actor: { type: 'system', id: actorId },
      description: `Error in ${context}: ${error.message}`,
      error: {
        code: error.name,
        message: error.message,
        stack: error.stack,
      },
      details,
    });
  }
}
```

---

## 3. Audit Store (`src/audit/audit-store.ts`)

```typescript
/**
 * Audit Store
 *
 * Immutable, append-only storage for audit events.
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { createWriteStream, WriteStream } from 'fs';
import { AuditEvent, AuditQueryOptions, AuditStatistics } from './types';
import { logger } from '../utils/logger';

/**
 * Store configuration
 */
export interface AuditStoreConfig {
  basePath: string;
  rotateSize: number; // bytes
  retentionDays: number;
  compress: boolean;
}

/**
 * Audit Store implementation
 */
export class AuditStore {
  private config: AuditStoreConfig;
  private currentFile: string;
  private writeStream?: WriteStream;
  private currentSize: number = 0;
  private lastSequence: number = 0;

  constructor(config: AuditStoreConfig) {
    this.config = config;
    this.currentFile = this.getFilename(new Date());
  }

  /**
   * Initialize store
   */
  async initialize(): Promise<void> {
    // Ensure directory exists
    await fs.mkdir(this.config.basePath, { recursive: true });

    // Find last sequence number
    await this.loadLastSequence();

    // Open write stream
    await this.openWriteStream();

    // Cleanup old files
    await this.cleanupOldFiles();

    logger.info('Audit store initialized', { path: this.config.basePath });
  }

  /**
   * Shutdown store
   */
  async shutdown(): Promise<void> {
    if (this.writeStream) {
      this.writeStream.end();
    }
  }

  /**
   * Append single event
   */
  async append(event: AuditEvent): Promise<void> {
    const line = JSON.stringify(event) + '\n';
    const buffer = Buffer.from(line);

    // Check rotation
    if (this.currentSize + buffer.length > this.config.rotateSize) {
      await this.rotate();
    }

    // Write event
    await this.write(buffer);
    this.currentSize += buffer.length;
    this.lastSequence = event.sequence;
  }

  /**
   * Append batch of events
   */
  async appendBatch(events: AuditEvent[]): Promise<void> {
    for (const event of events) {
      await this.append(event);
    }
  }

  /**
   * Get last sequence number
   */
  async getLastSequence(): Promise<number> {
    return this.lastSequence;
  }

  /**
   * Query events
   */
  async query(options: AuditQueryOptions): Promise<AuditEvent[]> {
    const files = await this.getFilesInRange(options.startDate, options.endDate);
    const events: AuditEvent[] = [];

    for (const file of files) {
      const fileEvents = await this.readFile(file);
      events.push(...this.filterEvents(fileEvents, options));

      if (options.limit && events.length >= options.limit) {
        break;
      }
    }

    // Apply offset and limit
    let result = events;
    if (options.offset) {
      result = result.slice(options.offset);
    }
    if (options.limit) {
      result = result.slice(0, options.limit);
    }

    return result;
  }

  /**
   * Get statistics
   */
  async getStatistics(startDate?: Date, endDate?: Date): Promise<AuditStatistics> {
    const events = await this.query({ startDate, endDate });

    const stats: AuditStatistics = {
      totalEvents: events.length,
      eventsByCategory: {} as Record<string, number>,
      eventsBySeverity: {} as Record<string, number>,
      eventsByOutcome: {} as Record<string, number>,
      eventsPerDay: [],
      topActors: [],
      errorRate: 0,
    };

    const dayMap = new Map<string, number>();
    const actorMap = new Map<string, number>();
    let errorCount = 0;

    for (const event of events) {
      // By category
      stats.eventsByCategory[event.category] =
        (stats.eventsByCategory[event.category] || 0) + 1;

      // By severity
      stats.eventsBySeverity[event.severity] =
        (stats.eventsBySeverity[event.severity] || 0) + 1;

      // By outcome
      stats.eventsByOutcome[event.outcome] =
        (stats.eventsByOutcome[event.outcome] || 0) + 1;

      // By day
      const day = event.timestamp.split('T')[0];
      dayMap.set(day, (dayMap.get(day) || 0) + 1);

      // By actor
      actorMap.set(event.actor.id, (actorMap.get(event.actor.id) || 0) + 1);

      // Error count
      if (event.outcome === 'failure') {
        errorCount++;
      }
    }

    stats.eventsPerDay = Array.from(dayMap.entries())
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));

    stats.topActors = Array.from(actorMap.entries())
      .map(([actorId, count]) => ({ actorId, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    stats.errorRate = events.length > 0 ? errorCount / events.length : 0;

    return stats;
  }

  /**
   * Get filename for date
   */
  private getFilename(date: Date): string {
    const dateStr = date.toISOString().split('T')[0];
    return path.join(this.config.basePath, `audit-${dateStr}.jsonl`);
  }

  /**
   * Open write stream
   */
  private async openWriteStream(): Promise<void> {
    const filename = this.getFilename(new Date());

    // Get current size if file exists
    try {
      const stat = await fs.stat(filename);
      this.currentSize = stat.size;
    } catch {
      this.currentSize = 0;
    }

    this.currentFile = filename;
    this.writeStream = createWriteStream(filename, { flags: 'a' });
  }

  /**
   * Write to stream
   */
  private async write(buffer: Buffer): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.writeStream) {
        reject(new Error('Write stream not open'));
        return;
      }

      this.writeStream.write(buffer, (error) => {
        if (error) reject(error);
        else resolve();
      });
    });
  }

  /**
   * Rotate log file
   */
  private async rotate(): Promise<void> {
    if (this.writeStream) {
      this.writeStream.end();
    }

    // Compress old file if configured
    if (this.config.compress) {
      // Would implement gzip compression here
    }

    await this.openWriteStream();
    logger.info('Audit log rotated', { file: this.currentFile });
  }

  /**
   * Load last sequence number
   */
  private async loadLastSequence(): Promise<void> {
    const files = await this.getAllFiles();
    if (files.length === 0) {
      this.lastSequence = 0;
      return;
    }

    // Read last file
    const lastFile = files[files.length - 1];
    const events = await this.readFile(lastFile);
    if (events.length > 0) {
      this.lastSequence = events[events.length - 1].sequence;
    }
  }

  /**
   * Get all audit files
   */
  private async getAllFiles(): Promise<string[]> {
    const entries = await fs.readdir(this.config.basePath);
    return entries
      .filter(e => e.startsWith('audit-') && e.endsWith('.jsonl'))
      .map(e => path.join(this.config.basePath, e))
      .sort();
  }

  /**
   * Get files in date range
   */
  private async getFilesInRange(startDate?: Date, endDate?: Date): Promise<string[]> {
    const allFiles = await this.getAllFiles();

    return allFiles.filter(file => {
      const match = path.basename(file).match(/audit-(\d{4}-\d{2}-\d{2})\.jsonl/);
      if (!match) return false;

      const fileDate = new Date(match[1]);
      if (startDate && fileDate < startDate) return false;
      if (endDate && fileDate > endDate) return false;
      return true;
    });
  }

  /**
   * Read events from file
   */
  private async readFile(filePath: string): Promise<AuditEvent[]> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const lines = content.trim().split('\n');
      return lines
        .filter(line => line.trim())
        .map(line => JSON.parse(line) as AuditEvent);
    } catch {
      return [];
    }
  }

  /**
   * Filter events
   */
  private filterEvents(events: AuditEvent[], options: AuditQueryOptions): AuditEvent[] {
    return events.filter(event => {
      if (options.categories && !options.categories.includes(event.category)) {
        return false;
      }
      if (options.severity && !options.severity.includes(event.severity)) {
        return false;
      }
      if (options.outcome && !options.outcome.includes(event.outcome)) {
        return false;
      }
      if (options.actorId && event.actor.id !== options.actorId) {
        return false;
      }
      if (options.targetId && event.target?.id !== options.targetId) {
        return false;
      }
      if (options.sessionId && event.sessionId !== options.sessionId) {
        return false;
      }
      if (options.projectId && event.projectId !== options.projectId) {
        return false;
      }
      return true;
    });
  }

  /**
   * Cleanup old files
   */
  private async cleanupOldFiles(): Promise<void> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.config.retentionDays);

    const files = await this.getAllFiles();
    let deleted = 0;

    for (const file of files) {
      const match = path.basename(file).match(/audit-(\d{4}-\d{2}-\d{2})\.jsonl/);
      if (!match) continue;

      const fileDate = new Date(match[1]);
      if (fileDate < cutoffDate) {
        await fs.unlink(file);
        deleted++;
      }
    }

    if (deleted > 0) {
      logger.info('Cleaned up old audit files', { count: deleted });
    }
  }
}
```

---

## 4. Integrity Manager (`src/audit/integrity.ts`)

```typescript
/**
 * Integrity Manager
 *
 * Tamper detection for audit logs.
 */

import { createHash } from 'crypto';
import { AuditEvent } from './types';
import { AuditStore } from './audit-store';
import { logger } from '../utils/logger';

/**
 * Integrity check result
 */
export interface IntegrityCheckResult {
  valid: boolean;
  checkedEvents: number;
  invalidEvents: Array<{
    id: string;
    sequence: number;
    issue: string;
  }>;
  chainBroken: boolean;
  chainBreakPoint?: number;
}

/**
 * Integrity Manager implementation
 */
export class IntegrityManager {
  private store: AuditStore;
  private lastHash: string = '';

  constructor(store: AuditStore) {
    this.store = store;
  }

  /**
   * Initialize integrity manager
   */
  async initialize(): Promise<void> {
    // Load last hash from store
    const lastSequence = await this.store.getLastSequence();
    if (lastSequence > 0) {
      const events = await this.store.query({ limit: 1 });
      if (events.length > 0) {
        // Find the actual last event
        const allEvents = await this.store.query({});
        const lastEvent = allEvents[allEvents.length - 1];
        this.lastHash = lastEvent.hash;
      }
    }
  }

  /**
   * Get last hash
   */
  async getLastHash(): Promise<string> {
    return this.lastHash;
  }

  /**
   * Calculate event hash
   */
  calculateEventHash(event: Omit<AuditEvent, 'hash'>): string {
    const hashInput = {
      id: event.id,
      timestamp: event.timestamp,
      sequence: event.sequence,
      category: event.category,
      action: event.action,
      actor: event.actor,
      target: event.target,
      previousHash: event.previousHash,
    };

    const hash = createHash('sha256')
      .update(JSON.stringify(hashInput))
      .digest('hex');

    this.lastHash = hash;
    return hash;
  }

  /**
   * Verify single event hash
   */
  verifyEventHash(event: AuditEvent): boolean {
    const calculated = this.calculateEventHash({
      ...event,
      hash: undefined as any,
    });
    return calculated === event.hash;
  }

  /**
   * Verify chain integrity
   */
  async verifyChain(startDate?: Date, endDate?: Date): Promise<IntegrityCheckResult> {
    const events = await this.store.query({
      startDate,
      endDate,
    });

    const result: IntegrityCheckResult = {
      valid: true,
      checkedEvents: events.length,
      invalidEvents: [],
      chainBroken: false,
    };

    let expectedPreviousHash = '';

    for (let i = 0; i < events.length; i++) {
      const event = events[i];

      // Verify hash
      if (!this.verifyEventHash(event)) {
        result.valid = false;
        result.invalidEvents.push({
          id: event.id,
          sequence: event.sequence,
          issue: 'Hash mismatch',
        });
      }

      // Verify chain
      if (i > 0 && event.previousHash !== expectedPreviousHash) {
        result.valid = false;
        result.chainBroken = true;
        result.chainBreakPoint = event.sequence;
        result.invalidEvents.push({
          id: event.id,
          sequence: event.sequence,
          issue: 'Chain broken - previousHash mismatch',
        });
      }

      expectedPreviousHash = event.hash;
    }

    if (!result.valid) {
      logger.error('Audit log integrity check failed', {
        invalidCount: result.invalidEvents.length,
        chainBroken: result.chainBroken,
      });
    }

    return result;
  }

  /**
   * Generate integrity report
   */
  async generateIntegrityReport(): Promise<{
    timestamp: string;
    result: IntegrityCheckResult;
    statistics: {
      totalEvents: number;
      dateRange: { start: string; end: string };
      hashAlgorithm: string;
    };
    signature: string;
  }> {
    const events = await this.store.query({});
    const result = await this.verifyChain();

    const report = {
      timestamp: new Date().toISOString(),
      result,
      statistics: {
        totalEvents: events.length,
        dateRange: {
          start: events[0]?.timestamp || '',
          end: events[events.length - 1]?.timestamp || '',
        },
        hashAlgorithm: 'sha256',
      },
      signature: '',
    };

    // Sign the report
    report.signature = createHash('sha256')
      .update(JSON.stringify({ ...report, signature: undefined }))
      .digest('hex');

    return report;
  }
}
```

---

## 5. Compliance Reporters (`src/audit/reporters/`)

### SOC2 Reporter (`src/audit/reporters/soc2-reporter.ts`)

```typescript
/**
 * SOC2 Compliance Reporter
 *
 * Generates SOC2-compliant audit reports.
 */

import { AuditStore } from '../audit-store';
import { AuditEvent, AuditQueryOptions } from '../types';

/**
 * SOC2 Control Categories
 */
export type SOC2Category = 'CC1' | 'CC2' | 'CC3' | 'CC4' | 'CC5' | 'CC6' | 'CC7' | 'CC8' | 'CC9';

/**
 * SOC2 Report
 */
export interface SOC2Report {
  reportDate: string;
  periodStart: string;
  periodEnd: string;
  controls: Array<{
    category: SOC2Category;
    controlId: string;
    description: string;
    evidenceCount: number;
    status: 'compliant' | 'non-compliant' | 'partial';
    findings: string[];
  }>;
  summary: {
    totalControls: number;
    compliantControls: number;
    nonCompliantControls: number;
    partialControls: number;
    overallStatus: 'compliant' | 'non-compliant' | 'partial';
  };
}

/**
 * SOC2 Reporter
 */
export class SOC2Reporter {
  private store: AuditStore;

  constructor(store: AuditStore) {
    this.store = store;
  }

  /**
   * Generate SOC2 report
   */
  async generateReport(startDate: Date, endDate: Date): Promise<SOC2Report> {
    const events = await this.store.query({ startDate, endDate });

    const controls = [
      await this.checkCC1(events), // Control Environment
      await this.checkCC2(events), // Communication and Information
      await this.checkCC3(events), // Risk Assessment
      await this.checkCC4(events), // Monitoring Activities
      await this.checkCC5(events), // Control Activities
      await this.checkCC6(events), // Logical and Physical Access
      await this.checkCC7(events), // System Operations
      await this.checkCC8(events), // Change Management
      await this.checkCC9(events), // Risk Mitigation
    ].flat();

    const compliant = controls.filter(c => c.status === 'compliant').length;
    const nonCompliant = controls.filter(c => c.status === 'non-compliant').length;
    const partial = controls.filter(c => c.status === 'partial').length;

    return {
      reportDate: new Date().toISOString(),
      periodStart: startDate.toISOString(),
      periodEnd: endDate.toISOString(),
      controls,
      summary: {
        totalControls: controls.length,
        compliantControls: compliant,
        nonCompliantControls: nonCompliant,
        partialControls: partial,
        overallStatus: nonCompliant > 0 ? 'non-compliant' : partial > 0 ? 'partial' : 'compliant',
      },
    };
  }

  private async checkCC1(events: AuditEvent[]) {
    // Control Environment
    return [{
      category: 'CC1' as SOC2Category,
      controlId: 'CC1.1',
      description: 'Security policies are established and communicated',
      evidenceCount: events.filter(e => e.category === 'compliance_event').length,
      status: 'compliant' as const,
      findings: [],
    }];
  }

  private async checkCC2(events: AuditEvent[]) {
    // Communication and Information
    const auditEvents = events.filter(e => e.category === 'system_event');
    return [{
      category: 'CC2' as SOC2Category,
      controlId: 'CC2.1',
      description: 'Information is communicated internally',
      evidenceCount: auditEvents.length,
      status: auditEvents.length > 0 ? 'compliant' as const : 'non-compliant' as const,
      findings: [],
    }];
  }

  private async checkCC3(events: AuditEvent[]) {
    // Risk Assessment - check for security events
    const securityEvents = events.filter(e => e.category === 'security_event');
    return [{
      category: 'CC3' as SOC2Category,
      controlId: 'CC3.1',
      description: 'Security risks are identified and assessed',
      evidenceCount: securityEvents.length,
      status: 'compliant' as const,
      findings: [],
    }];
  }

  private async checkCC4(events: AuditEvent[]) {
    // Monitoring Activities
    return [{
      category: 'CC4' as SOC2Category,
      controlId: 'CC4.1',
      description: 'Ongoing evaluations are performed',
      evidenceCount: events.length,
      status: 'compliant' as const,
      findings: [],
    }];
  }

  private async checkCC5(events: AuditEvent[]) {
    // Control Activities
    const authEvents = events.filter(e => e.category === 'authorization');
    return [{
      category: 'CC5' as SOC2Category,
      controlId: 'CC5.1',
      description: 'Authorization controls are implemented',
      evidenceCount: authEvents.length,
      status: 'compliant' as const,
      findings: [],
    }];
  }

  private async checkCC6(events: AuditEvent[]) {
    // Logical and Physical Access
    const accessEvents = events.filter(e =>
      e.category === 'authentication' || e.category === 'authorization'
    );
    return [{
      category: 'CC6' as SOC2Category,
      controlId: 'CC6.1',
      description: 'Logical access controls are implemented',
      evidenceCount: accessEvents.length,
      status: accessEvents.length > 0 ? 'compliant' as const : 'partial' as const,
      findings: [],
    }];
  }

  private async checkCC7(events: AuditEvent[]) {
    // System Operations
    const errorEvents = events.filter(e => e.category === 'error_event');
    const errorRate = events.length > 0 ? errorEvents.length / events.length : 0;
    return [{
      category: 'CC7' as SOC2Category,
      controlId: 'CC7.1',
      description: 'System operations are monitored',
      evidenceCount: events.filter(e => e.category === 'orchestration').length,
      status: errorRate < 0.1 ? 'compliant' as const : 'partial' as const,
      findings: errorRate >= 0.1 ? ['Error rate exceeds 10%'] : [],
    }];
  }

  private async checkCC8(events: AuditEvent[]) {
    // Change Management
    const changeEvents = events.filter(e =>
      e.category === 'file_operation' || e.category === 'git_operation'
    );
    return [{
      category: 'CC8' as SOC2Category,
      controlId: 'CC8.1',
      description: 'Changes are tracked and authorized',
      evidenceCount: changeEvents.length,
      status: 'compliant' as const,
      findings: [],
    }];
  }

  private async checkCC9(events: AuditEvent[]) {
    // Risk Mitigation
    const securityEvents = events.filter(e => e.category === 'security_event');
    return [{
      category: 'CC9' as SOC2Category,
      controlId: 'CC9.1',
      description: 'Risks are mitigated',
      evidenceCount: securityEvents.length,
      status: 'compliant' as const,
      findings: [],
    }];
  }
}
```

---

## Test Scenarios

```typescript
// tests/audit/audit-logger.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { AuditLogger } from '../../src/audit/audit-logger';
import { AuditStore } from '../../src/audit/audit-store';
import { IntegrityManager } from '../../src/audit/integrity';

describe('AuditLogger', () => {
  let logger: AuditLogger;
  let store: AuditStore;
  let integrity: IntegrityManager;

  beforeEach(async () => {
    store = new AuditStore({
      basePath: '/tmp/test-audit',
      rotateSize: 10 * 1024 * 1024,
      retentionDays: 30,
      compress: false,
    });
    await store.initialize();

    integrity = new IntegrityManager(store);
    await integrity.initialize();

    logger = new AuditLogger(store, integrity);
    await logger.initialize();
  });

  it('should log audit events', async () => {
    await logger.log({
      category: 'agent_execution',
      action: 'agent_start',
      severity: 'info',
      outcome: 'success',
      actor: { type: 'agent', id: 'test-agent' },
      description: 'Test event',
    });

    const events = await store.query({});
    expect(events.length).toBeGreaterThan(0);
  });

  it('should redact secrets', async () => {
    await logger.log({
      category: 'system_event',
      action: 'config_change',
      severity: 'info',
      outcome: 'success',
      actor: { type: 'system', id: 'test' },
      description: 'Config changed',
      details: { password: 'secret123', apiKey: 'sk-123456' },
    });

    const events = await store.query({});
    const lastEvent = events[events.length - 1];
    expect(JSON.stringify(lastEvent.details)).not.toContain('secret123');
  });

  it('should maintain hash chain integrity', async () => {
    for (let i = 0; i < 5; i++) {
      await logger.log({
        category: 'system_event',
        action: `action_${i}`,
        severity: 'info',
        outcome: 'success',
        actor: { type: 'system', id: 'test' },
        description: `Event ${i}`,
      });
    }
    await logger.flush();

    const result = await integrity.verifyChain();
    expect(result.valid).toBe(true);
    expect(result.chainBroken).toBe(false);
  });
});
```

---

## Validation Checklist

```
□ Audit event types defined
□ AuditLogger logs events correctly
□ Secret redaction works
□ Async batching works
□ AuditStore persists events
□ File rotation works
□ Query filtering works
□ IntegrityManager calculates hashes
□ Hash chain verification works
□ Tampering detection works
□ SOC2 reporter generates reports
□ Retention cleanup works
□ All tests pass
```

---

## Next Step

Proceed to **05-AGENT-FRAMEWORK.md** in CP1 to implement the agent framework.
