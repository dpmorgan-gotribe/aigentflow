# Step 08a: Real-Time Activity System

> **Checkpoint:** CP1 - Design System
> **Previous Step:** 08-USER-FLOWS.md
> **Next Step:** 09-GIT-AGENT.md (CP2)

---

## Overview

The **Real-Time Activity System** provides live streaming of orchestration events to the CLI and potential UI clients. It enables users to see what's happening during workflow execution in real-time.

Key responsibilities:
- Stream activity events in real-time
- Support multiple event types and categories
- Enable subscription-based event filtering
- Persist events for replay and debugging
- Format events for CLI display

---

## Deliverables

1. `src/activity/types.ts` - Activity event types
2. `src/activity/activity-stream.ts` - Event streaming
3. `src/activity/subscriptions.ts` - Subscription management
4. `src/activity/formatters/` - Output formatters
5. `src/activity/persistence.ts` - Event persistence

---

## 1. Type Definitions (`src/activity/types.ts`)

```typescript
/**
 * Activity System Types
 */

import { z } from 'zod';
import { AgentType } from '../agents/types';

/**
 * Activity event types
 */
export const ActivityTypeSchema = z.enum([
  // Workflow events
  'workflow_start',
  'workflow_complete',
  'workflow_error',
  'workflow_pause',
  'workflow_resume',

  // State events
  'state_enter',
  'state_exit',
  'state_transition',

  // Agent events
  'agent_start',
  'agent_thinking',
  'agent_progress',
  'agent_output',
  'agent_complete',
  'agent_error',

  // File events
  'file_read',
  'file_write',
  'file_delete',

  // Git events
  'git_operation',
  'git_commit',
  'git_push',
  'git_conflict',

  // User events
  'user_input',
  'user_approval',
  'user_rejection',

  // System events
  'system_message',
  'system_warning',
  'system_error',

  // Progress events
  'progress_update',
  'task_start',
  'task_complete',
]);

export type ActivityType = z.infer<typeof ActivityTypeSchema>;

/**
 * Activity categories
 */
export const ActivityCategorySchema = z.enum([
  'workflow',
  'agent',
  'file',
  'git',
  'user',
  'system',
  'progress',
]);

export type ActivityCategory = z.infer<typeof ActivityCategorySchema>;

/**
 * Activity severity
 */
export const ActivitySeveritySchema = z.enum([
  'debug',
  'info',
  'success',
  'warning',
  'error',
]);

export type ActivitySeverity = z.infer<typeof ActivitySeveritySchema>;

/**
 * Activity event
 */
export const ActivityEventSchema = z.object({
  // Identity
  id: z.string().uuid(),
  timestamp: z.string().datetime(),
  sequence: z.number().int().positive(),

  // Classification
  type: ActivityTypeSchema,
  category: ActivityCategorySchema,
  severity: ActivitySeveritySchema,

  // Context
  sessionId: z.string(),
  workflowId: z.string().optional(),
  agentId: z.nativeEnum(AgentType).optional(),

  // Content
  title: z.string(),
  message: z.string(),
  details: z.record(z.unknown()).optional(),

  // Progress
  progress: z.object({
    current: z.number(),
    total: z.number(),
    percentage: z.number().min(0).max(100),
  }).optional(),

  // Duration
  duration: z.number().optional(), // milliseconds

  // Correlation
  parentId: z.string().optional(),
  correlationId: z.string().optional(),
});

export type ActivityEvent = z.infer<typeof ActivityEventSchema>;

/**
 * Subscription filter
 */
export interface SubscriptionFilter {
  types?: ActivityType[];
  categories?: ActivityCategory[];
  severities?: ActivitySeverity[];
  agentIds?: AgentType[];
  workflowId?: string;
}

/**
 * Event handler
 */
export type EventHandler = (event: ActivityEvent) => void | Promise<void>;

/**
 * Subscription
 */
export interface Subscription {
  id: string;
  filter: SubscriptionFilter;
  handler: EventHandler;
  createdAt: Date;
}

/**
 * Display format
 */
export type DisplayFormat = 'simple' | 'detailed' | 'json' | 'compact';
```

---

## 2. Activity Stream (`src/activity/activity-stream.ts`)

```typescript
/**
 * Activity Stream
 *
 * Core event streaming functionality.
 */

import { randomUUID } from 'crypto';
import { EventEmitter } from 'events';
import {
  ActivityEvent,
  ActivityEventSchema,
  ActivityType,
  ActivityCategory,
  ActivitySeverity,
} from './types';
import { SubscriptionManager } from './subscriptions';
import { ActivityPersistence } from './persistence';
import { logger } from '../utils/logger';
import { AgentType } from '../agents/types';

/**
 * Stream configuration
 */
export interface ActivityStreamConfig {
  persistEvents: boolean;
  maxEventsInMemory: number;
  enableDebugEvents: boolean;
}

const DEFAULT_CONFIG: ActivityStreamConfig = {
  persistEvents: true,
  maxEventsInMemory: 1000,
  enableDebugEvents: false,
};

/**
 * Category mapping for event types
 */
const TYPE_CATEGORIES: Record<ActivityType, ActivityCategory> = {
  workflow_start: 'workflow',
  workflow_complete: 'workflow',
  workflow_error: 'workflow',
  workflow_pause: 'workflow',
  workflow_resume: 'workflow',
  state_enter: 'workflow',
  state_exit: 'workflow',
  state_transition: 'workflow',
  agent_start: 'agent',
  agent_thinking: 'agent',
  agent_progress: 'agent',
  agent_output: 'agent',
  agent_complete: 'agent',
  agent_error: 'agent',
  file_read: 'file',
  file_write: 'file',
  file_delete: 'file',
  git_operation: 'git',
  git_commit: 'git',
  git_push: 'git',
  git_conflict: 'git',
  user_input: 'user',
  user_approval: 'user',
  user_rejection: 'user',
  system_message: 'system',
  system_warning: 'system',
  system_error: 'system',
  progress_update: 'progress',
  task_start: 'progress',
  task_complete: 'progress',
};

/**
 * Activity Stream implementation
 */
export class ActivityStream extends EventEmitter {
  private config: ActivityStreamConfig;
  private subscriptions: SubscriptionManager;
  private persistence: ActivityPersistence;
  private sequence: number = 0;
  private sessionId: string;
  private workflowId?: string;
  private eventBuffer: ActivityEvent[] = [];

  constructor(
    persistence: ActivityPersistence,
    config: Partial<ActivityStreamConfig> = {}
  ) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.subscriptions = new SubscriptionManager();
    this.persistence = persistence;
    this.sessionId = randomUUID();
  }

  /**
   * Set workflow ID
   */
  setWorkflowId(id: string): void {
    this.workflowId = id;
  }

  /**
   * Emit an activity event
   */
  async emit(
    type: ActivityType,
    title: string,
    options: {
      message?: string;
      severity?: ActivitySeverity;
      agentId?: AgentType;
      details?: Record<string, unknown>;
      progress?: { current: number; total: number };
      duration?: number;
      parentId?: string;
      correlationId?: string;
    } = {}
  ): Promise<ActivityEvent> {
    // Skip debug events if disabled
    if (options.severity === 'debug' && !this.config.enableDebugEvents) {
      return null as any;
    }

    this.sequence++;

    const event: ActivityEvent = {
      id: randomUUID(),
      timestamp: new Date().toISOString(),
      sequence: this.sequence,
      type,
      category: TYPE_CATEGORIES[type],
      severity: options.severity || this.inferSeverity(type),
      sessionId: this.sessionId,
      workflowId: this.workflowId,
      agentId: options.agentId,
      title,
      message: options.message || title,
      details: options.details,
      progress: options.progress ? {
        ...options.progress,
        percentage: Math.round((options.progress.current / options.progress.total) * 100),
      } : undefined,
      duration: options.duration,
      parentId: options.parentId,
      correlationId: options.correlationId,
    };

    // Validate event
    ActivityEventSchema.parse(event);

    // Add to buffer
    this.eventBuffer.push(event);
    if (this.eventBuffer.length > this.config.maxEventsInMemory) {
      this.eventBuffer.shift();
    }

    // Persist if enabled
    if (this.config.persistEvents) {
      await this.persistence.save(event);
    }

    // Notify subscribers
    await this.subscriptions.dispatch(event);

    // Emit on EventEmitter
    super.emit('activity', event);
    super.emit(type, event);

    return event;
  }

  /**
   * Infer severity from event type
   */
  private inferSeverity(type: ActivityType): ActivitySeverity {
    if (type.includes('error') || type.includes('conflict')) {
      return 'error';
    }
    if (type.includes('warning')) {
      return 'warning';
    }
    if (type.includes('complete') || type.includes('success')) {
      return 'success';
    }
    if (type.includes('start') || type.includes('thinking')) {
      return 'info';
    }
    return 'info';
  }

  /**
   * Subscribe to events
   */
  subscribe(handler: (event: ActivityEvent) => void | Promise<void>, filter?: {
    types?: ActivityType[];
    categories?: ActivityCategory[];
    severities?: ActivitySeverity[];
    agentIds?: AgentType[];
  }): string {
    return this.subscriptions.subscribe(handler, filter || {});
  }

  /**
   * Unsubscribe from events
   */
  unsubscribe(subscriptionId: string): void {
    this.subscriptions.unsubscribe(subscriptionId);
  }

  /**
   * Get recent events
   */
  getRecentEvents(count: number = 50): ActivityEvent[] {
    return this.eventBuffer.slice(-count);
  }

  /**
   * Get events by type
   */
  getEventsByType(type: ActivityType, count: number = 50): ActivityEvent[] {
    return this.eventBuffer
      .filter(e => e.type === type)
      .slice(-count);
  }

  /**
   * Clear event buffer
   */
  clearBuffer(): void {
    this.eventBuffer = [];
  }

  // Convenience methods for common events

  /**
   * Workflow started
   */
  async workflowStart(description: string): Promise<ActivityEvent> {
    return this.emit('workflow_start', 'Workflow Started', {
      message: description,
      severity: 'info',
    });
  }

  /**
   * Workflow completed
   */
  async workflowComplete(summary: string, duration: number): Promise<ActivityEvent> {
    return this.emit('workflow_complete', 'Workflow Complete', {
      message: summary,
      severity: 'success',
      duration,
    });
  }

  /**
   * Workflow error
   */
  async workflowError(error: Error): Promise<ActivityEvent> {
    return this.emit('workflow_error', 'Workflow Error', {
      message: error.message,
      severity: 'error',
      details: { error: error.name, stack: error.stack },
    });
  }

  /**
   * Agent started
   */
  async agentStart(agentId: AgentType, task: string): Promise<ActivityEvent> {
    return this.emit('agent_start', `${agentId} Starting`, {
      message: task,
      severity: 'info',
      agentId,
    });
  }

  /**
   * Agent thinking
   */
  async agentThinking(agentId: AgentType, what: string): Promise<ActivityEvent> {
    return this.emit('agent_thinking', `${agentId} Thinking`, {
      message: what,
      severity: 'debug',
      agentId,
    });
  }

  /**
   * Agent progress
   */
  async agentProgress(
    agentId: AgentType,
    message: string,
    current: number,
    total: number
  ): Promise<ActivityEvent> {
    return this.emit('agent_progress', `${agentId} Progress`, {
      message,
      severity: 'info',
      agentId,
      progress: { current, total },
    });
  }

  /**
   * Agent completed
   */
  async agentComplete(agentId: AgentType, summary: string, duration: number): Promise<ActivityEvent> {
    return this.emit('agent_complete', `${agentId} Complete`, {
      message: summary,
      severity: 'success',
      agentId,
      duration,
    });
  }

  /**
   * Agent error
   */
  async agentError(agentId: AgentType, error: Error): Promise<ActivityEvent> {
    return this.emit('agent_error', `${agentId} Error`, {
      message: error.message,
      severity: 'error',
      agentId,
      details: { error: error.name },
    });
  }

  /**
   * File operation
   */
  async fileOperation(operation: 'read' | 'write' | 'delete', path: string): Promise<ActivityEvent> {
    const type = `file_${operation}` as ActivityType;
    return this.emit(type, `File ${operation}`, {
      message: path,
      severity: 'debug',
      details: { path, operation },
    });
  }

  /**
   * System message
   */
  async systemMessage(message: string, severity: ActivitySeverity = 'info'): Promise<ActivityEvent> {
    return this.emit('system_message', 'System', {
      message,
      severity,
    });
  }

  /**
   * Progress update
   */
  async progressUpdate(
    title: string,
    current: number,
    total: number,
    message?: string
  ): Promise<ActivityEvent> {
    return this.emit('progress_update', title, {
      message: message || `${current}/${total}`,
      progress: { current, total },
    });
  }
}
```

---

## 3. Subscription Manager (`src/activity/subscriptions.ts`)

```typescript
/**
 * Subscription Manager
 *
 * Manages event subscriptions and dispatching.
 */

import { randomUUID } from 'crypto';
import {
  ActivityEvent,
  Subscription,
  SubscriptionFilter,
  EventHandler,
} from './types';
import { logger } from '../utils/logger';

/**
 * Subscription Manager implementation
 */
export class SubscriptionManager {
  private subscriptions: Map<string, Subscription> = new Map();

  /**
   * Subscribe to events
   */
  subscribe(handler: EventHandler, filter: SubscriptionFilter): string {
    const id = randomUUID();

    const subscription: Subscription = {
      id,
      filter,
      handler,
      createdAt: new Date(),
    };

    this.subscriptions.set(id, subscription);
    logger.debug('Subscription created', { id, filter });

    return id;
  }

  /**
   * Unsubscribe
   */
  unsubscribe(id: string): boolean {
    const deleted = this.subscriptions.delete(id);
    if (deleted) {
      logger.debug('Subscription removed', { id });
    }
    return deleted;
  }

  /**
   * Dispatch event to matching subscribers
   */
  async dispatch(event: ActivityEvent): Promise<void> {
    const matchingSubscriptions = this.getMatchingSubscriptions(event);

    await Promise.all(
      matchingSubscriptions.map(async (sub) => {
        try {
          await sub.handler(event);
        } catch (error) {
          logger.error('Subscription handler error', {
            subscriptionId: sub.id,
            eventId: event.id,
            error,
          });
        }
      })
    );
  }

  /**
   * Get subscriptions matching an event
   */
  private getMatchingSubscriptions(event: ActivityEvent): Subscription[] {
    return Array.from(this.subscriptions.values()).filter(sub =>
      this.matchesFilter(event, sub.filter)
    );
  }

  /**
   * Check if event matches filter
   */
  private matchesFilter(event: ActivityEvent, filter: SubscriptionFilter): boolean {
    // Empty filter matches all
    if (
      !filter.types?.length &&
      !filter.categories?.length &&
      !filter.severities?.length &&
      !filter.agentIds?.length &&
      !filter.workflowId
    ) {
      return true;
    }

    // Check each filter criterion
    if (filter.types?.length && !filter.types.includes(event.type)) {
      return false;
    }

    if (filter.categories?.length && !filter.categories.includes(event.category)) {
      return false;
    }

    if (filter.severities?.length && !filter.severities.includes(event.severity)) {
      return false;
    }

    if (filter.agentIds?.length && event.agentId && !filter.agentIds.includes(event.agentId)) {
      return false;
    }

    if (filter.workflowId && event.workflowId !== filter.workflowId) {
      return false;
    }

    return true;
  }

  /**
   * Get subscription count
   */
  getCount(): number {
    return this.subscriptions.size;
  }

  /**
   * Clear all subscriptions
   */
  clear(): void {
    this.subscriptions.clear();
  }
}
```

---

## 4. CLI Formatter (`src/activity/formatters/cli-formatter.ts`)

```typescript
/**
 * CLI Formatter
 *
 * Formats activity events for CLI display.
 */

import chalk from 'chalk';
import { ActivityEvent, DisplayFormat, ActivitySeverity, ActivityType } from '../types';
import { AgentType } from '../../agents/types';

/**
 * Severity colors
 */
const SEVERITY_COLORS: Record<ActivitySeverity, chalk.Chalk> = {
  debug: chalk.gray,
  info: chalk.blue,
  success: chalk.green,
  warning: chalk.yellow,
  error: chalk.red,
};

/**
 * Agent icons
 */
const AGENT_ICONS: Partial<Record<AgentType, string>> = {
  [AgentType.ORCHESTRATOR]: '🎯',
  [AgentType.PROJECT_MANAGER]: '📋',
  [AgentType.ARCHITECT]: '🏗️',
  [AgentType.ANALYST]: '🔍',
  [AgentType.UI_DESIGNER]: '🎨',
  [AgentType.FRONTEND_DEVELOPER]: '⚛️',
  [AgentType.BACKEND_DEVELOPER]: '⚙️',
  [AgentType.TESTER]: '🧪',
  [AgentType.BUG_FIXER]: '🔧',
  [AgentType.REVIEWER]: '👀',
  [AgentType.GIT_AGENT]: '📦',
  [AgentType.COMPLIANCE_AGENT]: '🛡️',
};

/**
 * Type icons
 */
const TYPE_ICONS: Partial<Record<ActivityType, string>> = {
  workflow_start: '🚀',
  workflow_complete: '✅',
  workflow_error: '❌',
  workflow_pause: '⏸️',
  workflow_resume: '▶️',
  agent_start: '▶',
  agent_thinking: '💭',
  agent_complete: '✓',
  agent_error: '✗',
  file_write: '📝',
  file_read: '📖',
  file_delete: '🗑️',
  git_commit: '📦',
  git_push: '⬆️',
  git_conflict: '⚠️',
  user_approval: '👍',
  user_rejection: '👎',
  system_warning: '⚠️',
  system_error: '❌',
};

/**
 * CLI Formatter implementation
 */
export class CLIFormatter {
  private format: DisplayFormat;
  private showTimestamps: boolean;
  private showIcons: boolean;

  constructor(options: {
    format?: DisplayFormat;
    showTimestamps?: boolean;
    showIcons?: boolean;
  } = {}) {
    this.format = options.format || 'simple';
    this.showTimestamps = options.showTimestamps ?? true;
    this.showIcons = options.showIcons ?? true;
  }

  /**
   * Format event for display
   */
  format(event: ActivityEvent): string {
    switch (this.format) {
      case 'json':
        return this.formatJson(event);
      case 'compact':
        return this.formatCompact(event);
      case 'detailed':
        return this.formatDetailed(event);
      case 'simple':
      default:
        return this.formatSimple(event);
    }
  }

  /**
   * Simple format
   */
  private formatSimple(event: ActivityEvent): string {
    const color = SEVERITY_COLORS[event.severity];
    const icon = this.showIcons ? this.getIcon(event) + ' ' : '';
    const timestamp = this.showTimestamps ? chalk.gray(`[${this.formatTime(event.timestamp)}] `) : '';
    const agent = event.agentId ? chalk.cyan(`[${event.agentId}] `) : '';

    let line = `${timestamp}${icon}${agent}${color(event.title)}`;

    if (event.message !== event.title) {
      line += ` ${chalk.gray('-')} ${event.message}`;
    }

    if (event.progress) {
      const bar = this.formatProgressBar(event.progress.percentage);
      line += ` ${bar} ${event.progress.percentage}%`;
    }

    if (event.duration) {
      line += ` ${chalk.gray(`(${this.formatDuration(event.duration)})`)}`;
    }

    return line;
  }

  /**
   * Compact format
   */
  private formatCompact(event: ActivityEvent): string {
    const icon = this.getIcon(event);
    const severity = event.severity[0].toUpperCase();
    return `${icon} [${severity}] ${event.title}`;
  }

  /**
   * Detailed format
   */
  private formatDetailed(event: ActivityEvent): string {
    const lines: string[] = [];
    const color = SEVERITY_COLORS[event.severity];

    lines.push(color('─'.repeat(60)));
    lines.push(`${this.getIcon(event)} ${color.bold(event.title)}`);
    lines.push('');
    lines.push(`  ${chalk.gray('Time:')} ${event.timestamp}`);
    lines.push(`  ${chalk.gray('Type:')} ${event.type}`);
    lines.push(`  ${chalk.gray('Category:')} ${event.category}`);
    lines.push(`  ${chalk.gray('Severity:')} ${event.severity}`);

    if (event.agentId) {
      lines.push(`  ${chalk.gray('Agent:')} ${event.agentId}`);
    }

    lines.push('');
    lines.push(`  ${event.message}`);

    if (event.progress) {
      lines.push('');
      lines.push(`  ${chalk.gray('Progress:')} ${this.formatProgressBar(event.progress.percentage, 30)} ${event.progress.current}/${event.progress.total}`);
    }

    if (event.duration) {
      lines.push(`  ${chalk.gray('Duration:')} ${this.formatDuration(event.duration)}`);
    }

    if (event.details && Object.keys(event.details).length > 0) {
      lines.push('');
      lines.push(`  ${chalk.gray('Details:')}`);
      for (const [key, value] of Object.entries(event.details)) {
        lines.push(`    ${key}: ${JSON.stringify(value)}`);
      }
    }

    return lines.join('\n');
  }

  /**
   * JSON format
   */
  private formatJson(event: ActivityEvent): string {
    return JSON.stringify(event, null, 2);
  }

  /**
   * Get icon for event
   */
  private getIcon(event: ActivityEvent): string {
    if (event.agentId && AGENT_ICONS[event.agentId]) {
      return AGENT_ICONS[event.agentId]!;
    }
    return TYPE_ICONS[event.type] || '•';
  }

  /**
   * Format timestamp
   */
  private formatTime(timestamp: string): string {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', { hour12: false });
  }

  /**
   * Format duration
   */
  private formatDuration(ms: number): string {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
  }

  /**
   * Format progress bar
   */
  private formatProgressBar(percentage: number, width: number = 20): string {
    const filled = Math.round((percentage / 100) * width);
    const empty = width - filled;
    return chalk.green('█'.repeat(filled)) + chalk.gray('░'.repeat(empty));
  }
}

/**
 * Create spinner animation frames
 */
export function createSpinner(): string[] {
  return ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
}

/**
 * Create CLI activity display
 */
export function createActivityDisplay(stream: any): {
  start: () => void;
  stop: () => void;
  update: (event: ActivityEvent) => void;
} {
  const formatter = new CLIFormatter();
  let lastLines: string[] = [];

  return {
    start: () => {
      // Clear screen and set up
      console.clear();
    },
    stop: () => {
      // Cleanup
    },
    update: (event: ActivityEvent) => {
      const line = formatter.format(event);
      console.log(line);
    },
  };
}
```

---

## 5. Activity Persistence (`src/activity/persistence.ts`)

```typescript
/**
 * Activity Persistence
 *
 * Persists activity events for replay and analysis.
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { ActivityEvent, ActivityType, ActivityCategory } from './types';
import { logger } from '../utils/logger';

/**
 * Persistence configuration
 */
export interface ActivityPersistenceConfig {
  basePath: string;
  retentionHours: number;
  maxEventsPerFile: number;
}

/**
 * Activity Persistence implementation
 */
export class ActivityPersistence {
  private config: ActivityPersistenceConfig;
  private currentFile: string;
  private eventCount: number = 0;

  constructor(config: ActivityPersistenceConfig) {
    this.config = config;
    this.currentFile = this.getFilename();
  }

  /**
   * Initialize persistence
   */
  async initialize(): Promise<void> {
    await fs.mkdir(this.config.basePath, { recursive: true });
    await this.cleanup();
  }

  /**
   * Save event
   */
  async save(event: ActivityEvent): Promise<void> {
    // Check if rotation needed
    if (this.eventCount >= this.config.maxEventsPerFile) {
      this.rotate();
    }

    const line = JSON.stringify(event) + '\n';
    await fs.appendFile(this.currentFile, line);
    this.eventCount++;
  }

  /**
   * Save batch
   */
  async saveBatch(events: ActivityEvent[]): Promise<void> {
    for (const event of events) {
      await this.save(event);
    }
  }

  /**
   * Load events for session
   */
  async loadSession(sessionId: string): Promise<ActivityEvent[]> {
    const files = await this.getAllFiles();
    const events: ActivityEvent[] = [];

    for (const file of files) {
      const fileEvents = await this.readFile(file);
      events.push(...fileEvents.filter(e => e.sessionId === sessionId));
    }

    return events.sort((a, b) => a.sequence - b.sequence);
  }

  /**
   * Load events by time range
   */
  async loadByTimeRange(startTime: Date, endTime: Date): Promise<ActivityEvent[]> {
    const files = await this.getAllFiles();
    const events: ActivityEvent[] = [];

    for (const file of files) {
      const fileEvents = await this.readFile(file);
      events.push(...fileEvents.filter(e => {
        const eventTime = new Date(e.timestamp);
        return eventTime >= startTime && eventTime <= endTime;
      }));
    }

    return events.sort((a, b) => a.sequence - b.sequence);
  }

  /**
   * Query events
   */
  async query(options: {
    sessionId?: string;
    workflowId?: string;
    types?: ActivityType[];
    categories?: ActivityCategory[];
    limit?: number;
  }): Promise<ActivityEvent[]> {
    const files = await this.getAllFiles();
    let events: ActivityEvent[] = [];

    for (const file of files.reverse()) {
      const fileEvents = await this.readFile(file);

      const filtered = fileEvents.filter(e => {
        if (options.sessionId && e.sessionId !== options.sessionId) return false;
        if (options.workflowId && e.workflowId !== options.workflowId) return false;
        if (options.types?.length && !options.types.includes(e.type)) return false;
        if (options.categories?.length && !options.categories.includes(e.category)) return false;
        return true;
      });

      events = [...filtered, ...events];

      if (options.limit && events.length >= options.limit) {
        break;
      }
    }

    if (options.limit) {
      events = events.slice(-options.limit);
    }

    return events;
  }

  /**
   * Get statistics
   */
  async getStatistics(): Promise<{
    totalEvents: number;
    fileCount: number;
    byType: Record<string, number>;
    byCategory: Record<string, number>;
  }> {
    const files = await this.getAllFiles();
    let totalEvents = 0;
    const byType: Record<string, number> = {};
    const byCategory: Record<string, number> = {};

    for (const file of files) {
      const events = await this.readFile(file);
      totalEvents += events.length;

      for (const event of events) {
        byType[event.type] = (byType[event.type] || 0) + 1;
        byCategory[event.category] = (byCategory[event.category] || 0) + 1;
      }
    }

    return {
      totalEvents,
      fileCount: files.length,
      byType,
      byCategory,
    };
  }

  /**
   * Get filename for current time
   */
  private getFilename(): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    return path.join(this.config.basePath, `activity-${timestamp}.jsonl`);
  }

  /**
   * Rotate to new file
   */
  private rotate(): void {
    this.currentFile = this.getFilename();
    this.eventCount = 0;
  }

  /**
   * Get all activity files
   */
  private async getAllFiles(): Promise<string[]> {
    const entries = await fs.readdir(this.config.basePath);
    return entries
      .filter(e => e.startsWith('activity-') && e.endsWith('.jsonl'))
      .map(e => path.join(this.config.basePath, e))
      .sort();
  }

  /**
   * Read events from file
   */
  private async readFile(filePath: string): Promise<ActivityEvent[]> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      return content
        .trim()
        .split('\n')
        .filter(line => line)
        .map(line => JSON.parse(line) as ActivityEvent);
    } catch {
      return [];
    }
  }

  /**
   * Cleanup old files
   */
  private async cleanup(): Promise<void> {
    const cutoff = new Date();
    cutoff.setHours(cutoff.getHours() - this.config.retentionHours);

    const files = await this.getAllFiles();
    let deleted = 0;

    for (const file of files) {
      try {
        const stat = await fs.stat(file);
        if (stat.mtime < cutoff) {
          await fs.unlink(file);
          deleted++;
        }
      } catch {
        // Ignore errors
      }
    }

    if (deleted > 0) {
      logger.info('Cleaned up old activity files', { count: deleted });
    }
  }
}
```

---

## Test Scenarios

```typescript
// tests/activity/activity-stream.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { ActivityStream } from '../../src/activity/activity-stream';
import { ActivityPersistence } from '../../src/activity/persistence';
import { AgentType } from '../../src/agents/types';

describe('ActivityStream', () => {
  let stream: ActivityStream;
  let persistence: ActivityPersistence;

  beforeEach(async () => {
    persistence = new ActivityPersistence({
      basePath: '/tmp/test-activity',
      retentionHours: 24,
      maxEventsPerFile: 1000,
    });
    await persistence.initialize();

    stream = new ActivityStream(persistence);
  });

  it('should emit workflow events', async () => {
    const events: any[] = [];
    stream.subscribe(e => events.push(e));

    await stream.workflowStart('Test workflow');

    expect(events.length).toBe(1);
    expect(events[0].type).toBe('workflow_start');
  });

  it('should emit agent events', async () => {
    const events: any[] = [];
    stream.subscribe(e => events.push(e));

    await stream.agentStart(AgentType.FRONTEND_DEVELOPER, 'Building component');
    await stream.agentComplete(AgentType.FRONTEND_DEVELOPER, 'Component built', 1000);

    expect(events.length).toBe(2);
    expect(events[0].type).toBe('agent_start');
    expect(events[1].type).toBe('agent_complete');
  });

  it('should filter by subscription', async () => {
    const errorEvents: any[] = [];
    stream.subscribe(e => errorEvents.push(e), {
      severities: ['error'],
    });

    await stream.systemMessage('Info message');
    await stream.agentError(AgentType.TESTER, new Error('Test failed'));

    expect(errorEvents.length).toBe(1);
    expect(errorEvents[0].severity).toBe('error');
  });

  it('should track progress', async () => {
    const events: any[] = [];
    stream.subscribe(e => events.push(e));

    await stream.progressUpdate('Building', 3, 10, 'Component 3 of 10');

    expect(events[0].progress).toEqual({
      current: 3,
      total: 10,
      percentage: 30,
    });
  });
});
```

---

## Validation Checklist

```
□ Activity event types defined
□ ActivityStream emits events
□ Subscription filtering works
□ Event persistence saves events
□ Event replay loads events
□ CLI formatter displays events
□ Progress tracking works
□ Duration tracking works
□ Agent events work
□ Workflow events work
□ File events work
□ System events work
□ Retention cleanup works
□ All tests pass
```

---

## Next Step

Proceed to **09-GIT-AGENT.md** in CP2 to implement git operations.
