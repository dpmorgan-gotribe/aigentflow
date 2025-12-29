# Step 04e: Component Integration

> **Checkpoint:** CP0 - Foundation
> **Previous Step:** 04d-AUDIT-LOGGING.md
> **Next Step:** CP1 - Design System (05-AGENT-FRAMEWORK.md)

---

## Overview

Component Integration defines how all foundation components (Steps 01-04d) connect and communicate. This document specifies the wiring between components, initialization order, and data flow patterns.

Key responsibilities:
- Component dependency graph
- Initialization and shutdown sequences
- Inter-component communication patterns
- Event propagation
- Error handling across components
- Configuration loading order

---

## 1. Component Dependency Graph

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      FOUNDATION COMPONENT DEPENDENCIES                       │
└─────────────────────────────────────────────────────────────────────────────┘

                              ┌─────────────────┐
                              │   CLI (Step 02) │
                              └────────┬────────┘
                                       │ uses
                    ┌──────────────────┼──────────────────┐
                    │                  │                  │
                    ▼                  ▼                  ▼
           ┌──────────────┐   ┌──────────────┐   ┌──────────────┐
           │ State Machine│   │   Hooks &    │   │  CLAUDE.md   │
           │  (Step 03)   │   │  Guardrails  │   │  Generator   │
           │              │   │  (Step 04a)  │   │  (Step 04b)  │
           └──────┬───────┘   └──────┬───────┘   └──────────────┘
                  │                  │
                  │                  │ triggers
                  ▼                  ▼
           ┌──────────────┐   ┌──────────────┐   ┌──────────────┐
           │  Checkpoint  │   │    Audit     │   │   Prompts    │
           │   Recovery   │◄──┤   Logger     │   │  (Step 03a)  │
           │  (Step 04c)  │   │  (Step 04d)  │   │              │
           └──────┬───────┘   └──────┬───────┘   └──────┬───────┘
                  │                  │                  │
                  └──────────────────┼──────────────────┘
                                     │
                                     ▼
                              ┌─────────────────┐
                              │   Persistence   │
                              │   (Step 04)     │
                              │    [SQLite]     │
                              └─────────────────┘

Dependencies:
  CLI ────────► All components (orchestrates)
  State Machine ► Persistence (state storage)
  State Machine ► Checkpoint (creates checkpoints)
  State Machine ► Hooks (fires lifecycle hooks)
  Hooks ────────► Audit Logger (logs hook execution)
  Hooks ────────► Guardrails (input/output validation)
  Checkpoint ──► Persistence (stores checkpoints)
  Audit Logger ► Persistence (stores audit events)
  Prompts ─────► Persistence (loads/caches templates)
```

---

## 2. Initialization Sequence

### 2.1 Startup Order

```typescript
/**
 * Application Initialization
 *
 * Components must be initialized in dependency order.
 */

export class ApplicationBootstrap {
  private components: Map<string, Component> = new Map();

  async initialize(): Promise<void> {
    console.log('[BOOT] Starting Aigentflow...');

    // Phase 1: Configuration
    // Load all configuration before any component starts
    const config = await this.loadConfiguration();
    console.log('[BOOT] Configuration loaded');

    // Phase 2: Core Infrastructure
    // Database must be first - everything depends on it
    const db = await this.initializeDatabase(config.database);
    this.components.set('database', db);
    console.log('[BOOT] Database initialized');

    // Phase 3: Persistence Layer
    // State store depends on database
    const persistence = await this.initializePersistence(db);
    this.components.set('persistence', persistence);
    console.log('[BOOT] Persistence layer ready');

    // Phase 4: Audit System
    // Audit logger depends on persistence
    const auditLogger = await this.initializeAuditLogger(db, config.audit);
    this.components.set('auditLogger', auditLogger);
    console.log('[BOOT] Audit logging active');

    // Phase 5: Hooks Engine
    // Hooks depend on audit logger for logging
    const hookEngine = await this.initializeHookEngine(config.hooks, auditLogger);
    this.components.set('hookEngine', hookEngine);
    console.log('[BOOT] Hook engine ready');

    // Phase 6: Guardrails
    // Guardrails are used by hooks
    const guardrails = await this.initializeGuardrails(config.guardrails);
    hookEngine.setGuardrails(guardrails);
    this.components.set('guardrails', guardrails);
    console.log('[BOOT] Guardrails loaded');

    // Phase 7: Prompt System
    // Prompts need persistence for caching
    const promptManager = await this.initializePromptManager(config.prompts, persistence);
    this.components.set('promptManager', promptManager);
    console.log('[BOOT] Prompt system ready');

    // Phase 8: State Machine
    // State machine depends on persistence, hooks, checkpoints
    const stateMachine = await this.initializeStateMachine({
      persistence,
      hookEngine,
      auditLogger,
    });
    this.components.set('stateMachine', stateMachine);
    console.log('[BOOT] State machine initialized');

    // Phase 9: Checkpoint Manager
    // Checkpoints depend on state machine and persistence
    const checkpointManager = await this.initializeCheckpointManager({
      db,
      stateMachine,
    });
    stateMachine.setCheckpointManager(checkpointManager);
    this.components.set('checkpointManager', checkpointManager);
    console.log('[BOOT] Checkpoint recovery ready');

    // Phase 10: CLAUDE.md Generator
    // Generator is standalone but needs config
    const claudeGenerator = await this.initializeClaudeGenerator(config.claudemd);
    this.components.set('claudeGenerator', claudeGenerator);
    console.log('[BOOT] CLAUDE.md generator ready');

    // Phase 11: CLI Commands
    // CLI wraps everything
    const cli = await this.initializeCLI({
      stateMachine,
      hookEngine,
      promptManager,
      checkpointManager,
      claudeGenerator,
      auditLogger,
    });
    this.components.set('cli', cli);
    console.log('[BOOT] CLI commands registered');

    console.log('[BOOT] Aigentflow ready!');
  }

  /**
   * Shutdown in reverse order
   */
  async shutdown(): Promise<void> {
    console.log('[SHUTDOWN] Stopping Aigentflow...');

    // Shutdown in reverse initialization order
    const shutdownOrder = [
      'cli',
      'claudeGenerator',
      'checkpointManager',
      'stateMachine',
      'promptManager',
      'guardrails',
      'hookEngine',
      'auditLogger',
      'persistence',
      'database',
    ];

    for (const name of shutdownOrder) {
      const component = this.components.get(name);
      if (component?.shutdown) {
        await component.shutdown();
        console.log(`[SHUTDOWN] ${name} stopped`);
      }
    }

    console.log('[SHUTDOWN] Aigentflow stopped');
  }
}
```

### 2.2 Configuration Loading Order

```yaml
# Configuration is loaded in this order (later overrides earlier)

configuration_loading:
  order:
    1_defaults:
      source: "src/config/defaults.ts"
      description: "Hardcoded defaults"

    2_system:
      source: "orchestrator-data/system/config.yaml"
      description: "Platform-wide configuration"

    3_environment:
      source: "Environment variables"
      prefix: "AIGENTFLOW_"
      description: "Environment overrides"

    4_user:
      source: "~/.aigentflow/config.yaml"
      description: "User-specific settings"

    5_project:
      source: "orchestrator-data/projects/{id}/config.yaml"
      description: "Project-specific settings"

    6_cli:
      source: "CLI arguments"
      description: "Runtime overrides"

  merge_strategy: "deep_merge"
  validation: "on_load"
```

---

## 3. Inter-Component Communication

### 3.1 Event Bus

```typescript
/**
 * Event Bus
 *
 * Central event dispatcher for component communication.
 */

import { EventEmitter } from 'events';

export interface SystemEvent {
  type: string;
  source: string;
  timestamp: Date;
  data: unknown;
  correlationId?: string;
}

export class EventBus extends EventEmitter {
  private history: SystemEvent[] = [];
  private maxHistory = 1000;

  /**
   * Emit typed event
   */
  emitEvent(event: SystemEvent): void {
    // Add to history
    this.history.push(event);
    if (this.history.length > this.maxHistory) {
      this.history.shift();
    }

    // Emit to listeners
    this.emit(event.type, event);
    this.emit('*', event); // Wildcard listeners
  }

  /**
   * Get recent events
   */
  getHistory(filter?: { type?: string; source?: string }): SystemEvent[] {
    return this.history.filter(e => {
      if (filter?.type && e.type !== filter.type) return false;
      if (filter?.source && e.source !== filter.source) return false;
      return true;
    });
  }
}

// Singleton event bus
export const eventBus = new EventBus();
```

### 3.2 Event Types

```typescript
/**
 * System Event Types
 */

export const SystemEvents = {
  // Lifecycle events
  SYSTEM_STARTED: 'system:started',
  SYSTEM_STOPPING: 'system:stopping',
  SYSTEM_STOPPED: 'system:stopped',

  // State machine events
  STATE_TRANSITION: 'state:transition',
  STATE_ERROR: 'state:error',

  // Agent events
  AGENT_SPAWNING: 'agent:spawning',
  AGENT_SPAWNED: 'agent:spawned',
  AGENT_COMPLETED: 'agent:completed',
  AGENT_FAILED: 'agent:failed',

  // Hook events
  HOOK_EXECUTING: 'hook:executing',
  HOOK_COMPLETED: 'hook:completed',
  HOOK_BLOCKED: 'hook:blocked',

  // Checkpoint events
  CHECKPOINT_CREATED: 'checkpoint:created',
  CHECKPOINT_RESTORED: 'checkpoint:restored',

  // Audit events
  AUDIT_EVENT: 'audit:event',

  // Security events
  SECRET_DETECTED: 'security:secret_detected',
  GUARDRAIL_TRIGGERED: 'security:guardrail_triggered',

  // User events
  APPROVAL_REQUESTED: 'user:approval_requested',
  APPROVAL_RECEIVED: 'user:approval_received',
} as const;
```

### 3.3 Component Communication Patterns

```typescript
/**
 * Component Communication Examples
 */

// Pattern 1: State Machine → Hooks
// State machine fires hooks at transition points

class StateMachine {
  constructor(private hookEngine: HookEngine) {}

  async transition(from: string, to: string, context: unknown): Promise<void> {
    // Fire pre-transition hook
    const preResult = await this.hookEngine.execute('pre_state_transition', {
      from,
      to,
      context,
    });

    if (preResult.action === 'block') {
      throw new Error(`Transition blocked: ${preResult.reason}`);
    }

    // Perform transition
    this.currentState = to;

    // Fire post-transition hook
    await this.hookEngine.execute('post_state_transition', {
      from,
      to,
      context,
    });

    // Emit event for other listeners
    eventBus.emitEvent({
      type: SystemEvents.STATE_TRANSITION,
      source: 'state_machine',
      timestamp: new Date(),
      data: { from, to },
    });
  }
}

// Pattern 2: Hooks → Audit Logger
// Hooks automatically log execution to audit trail

class HookEngine {
  constructor(private auditLogger: AuditLogger) {}

  async execute(hookPoint: string, payload: unknown): Promise<HookResult> {
    const startTime = Date.now();

    // Log hook start
    await this.auditLogger.log({
      category: 'orchestration',
      action: 'hook_executing',
      details: { hookPoint, payload },
    });

    // Execute hooks
    const result = await this.runHooks(hookPoint, payload);

    // Log hook completion
    await this.auditLogger.log({
      category: 'orchestration',
      action: result.action === 'block' ? 'hook_blocked' : 'hook_completed',
      details: {
        hookPoint,
        result: result.action,
        duration: Date.now() - startTime,
      },
    });

    return result;
  }
}

// Pattern 3: State Machine → Checkpoint
// State machine creates checkpoints at key points

class StateMachine {
  constructor(private checkpointManager: CheckpointManager) {}

  async onAgentComplete(agentId: string, output: unknown): Promise<void> {
    // Create checkpoint after agent completion
    await this.checkpointManager.createCheckpoint({
      trigger: 'agent_complete',
      agentId,
      state: this.currentState,
      context: this.context,
    });
  }
}

// Pattern 4: CLI → All Components
// CLI orchestrates high-level operations

class CLIRunCommand {
  constructor(
    private stateMachine: StateMachine,
    private hookEngine: HookEngine,
    private auditLogger: AuditLogger
  ) {}

  async execute(prompt: string): Promise<void> {
    // Log command start
    await this.auditLogger.log({
      category: 'user_action',
      action: 'run_command',
      details: { prompt },
    });

    // Fire pre-run hook
    await this.hookEngine.execute('pre_orchestrator', { prompt });

    // Start state machine
    await this.stateMachine.start(prompt);

    // State machine handles the rest via events
  }
}
```

---

## 4. Error Propagation

### 4.1 Error Handling Strategy

```typescript
/**
 * Error Handling Across Components
 */

// Base error types
export class AigentflowError extends Error {
  constructor(
    message: string,
    public code: string,
    public recoverable: boolean,
    public source: string,
    public context?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'AigentflowError';
  }
}

export class ValidationError extends AigentflowError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'VALIDATION_ERROR', true, 'validation', context);
  }
}

export class SecurityError extends AigentflowError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'SECURITY_ERROR', false, 'security', context);
  }
}

export class StateError extends AigentflowError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'STATE_ERROR', true, 'state_machine', context);
  }
}

/**
 * Global Error Handler
 */
export class GlobalErrorHandler {
  constructor(
    private auditLogger: AuditLogger,
    private hookEngine: HookEngine
  ) {}

  async handle(error: Error, context: { component: string; operation: string }): Promise<void> {
    // Log to audit trail
    await this.auditLogger.log({
      category: 'error_event',
      action: 'error_occurred',
      outcome: 'failure',
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,
        code: (error as AigentflowError).code,
      },
      details: context,
    });

    // Fire error hook
    await this.hookEngine.execute('on_error', {
      error,
      context,
      recoverable: (error as AigentflowError).recoverable ?? false,
    });

    // Emit error event
    eventBus.emitEvent({
      type: SystemEvents.STATE_ERROR,
      source: context.component,
      timestamp: new Date(),
      data: { error, context },
    });
  }
}
```

### 4.2 Error Recovery Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          ERROR RECOVERY FLOW                                 │
└─────────────────────────────────────────────────────────────────────────────┘

  Error Occurs
       │
       ▼
  ┌─────────────┐
  │ Log to      │
  │ Audit Trail │
  └─────┬───────┘
        │
        ▼
  ┌─────────────┐
  │ Fire Error  │
  │ Hook        │
  └─────┬───────┘
        │
        ▼
  ┌─────────────────┐
  │ Is Recoverable? │
  └────────┬────────┘
           │
     ┌─────┴─────┐
     │           │
     ▼           ▼
   Yes          No
     │           │
     ▼           ▼
┌─────────┐  ┌─────────┐
│ Retry?  │  │ Create  │
│ (< max) │  │ Error   │
└────┬────┘  │ State   │
     │       └────┬────┘
   ┌─┴─┐         │
   │   │         ▼
   ▼   ▼    ┌─────────┐
 Yes   No   │ Notify  │
   │   │    │ User    │
   │   │    └─────────┘
   ▼   ▼
┌─────┐ ┌─────────┐
│Retry│ │Escalate │
│     │ │to User  │
└─────┘ └─────────┘
```

---

## 5. Data Flow Patterns

### 5.1 Request Processing Flow

```typescript
/**
 * Request Processing Through Components
 */

async function processRequest(prompt: string): Promise<void> {
  // 1. CLI receives request
  const requestId = generateId();

  // 2. Input guardrails check
  const inputCheck = await guardrails.validateInput(prompt);
  if (!inputCheck.valid) {
    throw new ValidationError(inputCheck.reason);
  }

  // 3. Audit log request
  await auditLogger.log({
    category: 'user_action',
    action: 'request_received',
    details: { requestId, promptLength: prompt.length },
  });

  // 4. Hook: pre_orchestrator
  const preHookResult = await hookEngine.execute('pre_orchestrator', { prompt });
  const processedPrompt = preHookResult.modifiedPayload?.prompt || prompt;

  // 5. State machine transition
  await stateMachine.transition('IDLE', 'ANALYZING', { prompt: processedPrompt });

  // 6. Checkpoint creation
  await checkpointManager.createCheckpoint({ trigger: 'request_start' });

  // 7. Prompt construction
  const systemPrompt = await promptManager.compose('orchestrator', {
    task: processedPrompt,
  });

  // 8. Agent execution (handled by state machine)
  // ... (continues in CP1)
}
```

### 5.2 State Persistence Flow

```typescript
/**
 * State Persistence Across Components
 */

// State machine saves state
await stateMachine.saveState();
  │
  ├──► persistence.saveWorkflowState(state)
  │       │
  │       └──► db.run('INSERT INTO workflow_states...')
  │
  ├──► auditLogger.log({ action: 'state_saved' })
  │       │
  │       └──► db.run('INSERT INTO audit_logs...')
  │
  └──► checkpointManager.maybeCreateCheckpoint()
          │
          └──► db.run('INSERT INTO checkpoints...')
```

---

## 6. Component Interfaces

### 6.1 Component Contract

```typescript
/**
 * Component Interface
 *
 * All components implement this interface.
 */

export interface Component {
  readonly name: string;
  readonly version: string;
  readonly dependencies: string[];

  /**
   * Initialize component
   */
  initialize(config: unknown): Promise<void>;

  /**
   * Shutdown component
   */
  shutdown(): Promise<void>;

  /**
   * Health check
   */
  healthCheck(): Promise<{ healthy: boolean; details?: unknown }>;
}
```

### 6.2 Component Registry

```typescript
/**
 * Component Registry
 *
 * Manages component lifecycle and dependencies.
 */

export class ComponentRegistry {
  private components: Map<string, Component> = new Map();
  private initialized: Set<string> = new Set();

  register(component: Component): void {
    this.components.set(component.name, component);
  }

  async initializeAll(): Promise<void> {
    // Topological sort by dependencies
    const sorted = this.topologicalSort();

    for (const name of sorted) {
      const component = this.components.get(name)!;
      await component.initialize({});
      this.initialized.add(name);
    }
  }

  async shutdownAll(): Promise<void> {
    // Shutdown in reverse order
    const sorted = this.topologicalSort().reverse();

    for (const name of sorted) {
      const component = this.components.get(name)!;
      await component.shutdown();
      this.initialized.delete(name);
    }
  }

  private topologicalSort(): string[] {
    // Kahn's algorithm for topological sort
    const result: string[] = [];
    const inDegree: Map<string, number> = new Map();
    const adjList: Map<string, string[]> = new Map();

    // Initialize
    for (const [name, component] of this.components) {
      inDegree.set(name, component.dependencies.length);
      for (const dep of component.dependencies) {
        if (!adjList.has(dep)) adjList.set(dep, []);
        adjList.get(dep)!.push(name);
      }
    }

    // Process
    const queue = [...this.components.keys()].filter(n => inDegree.get(n) === 0);

    while (queue.length > 0) {
      const current = queue.shift()!;
      result.push(current);

      for (const next of adjList.get(current) || []) {
        inDegree.set(next, inDegree.get(next)! - 1);
        if (inDegree.get(next) === 0) {
          queue.push(next);
        }
      }
    }

    return result;
  }
}
```

---

## 7. Test Scenarios

```typescript
describe('Component Integration', () => {
  describe('Initialization', () => {
    it('should initialize components in correct order', async () => {
      const initOrder: string[] = [];

      // Mock components to track init order
      const mockDb = { initialize: () => initOrder.push('database') };
      const mockPersistence = { initialize: () => initOrder.push('persistence') };
      const mockAudit = { initialize: () => initOrder.push('audit') };
      const mockHooks = { initialize: () => initOrder.push('hooks') };
      const mockState = { initialize: () => initOrder.push('state') };

      await bootstrap.initialize();

      expect(initOrder[0]).toBe('database');
      expect(initOrder.indexOf('persistence')).toBeLessThan(initOrder.indexOf('audit'));
      expect(initOrder.indexOf('hooks')).toBeLessThan(initOrder.indexOf('state'));
    });
  });

  describe('Event Propagation', () => {
    it('should propagate events between components', async () => {
      const events: string[] = [];
      eventBus.on('*', (e) => events.push(e.type));

      await stateMachine.transition('IDLE', 'ANALYZING');

      expect(events).toContain('state:transition');
    });
  });

  describe('Error Handling', () => {
    it('should log errors to audit trail', async () => {
      const error = new SecurityError('Test error');
      await errorHandler.handle(error, { component: 'test', operation: 'test' });

      const logs = await auditLogger.query({ action: 'error_occurred' });
      expect(logs.length).toBe(1);
    });
  });
});
```

---

## 8. Dependencies

- All CP0 components (01-04d)
- Node.js EventEmitter

---

## 9. Acceptance Criteria

- [ ] Components initialize in correct dependency order
- [ ] Shutdown happens in reverse order
- [ ] Events propagate between components
- [ ] Errors are logged and handled consistently
- [ ] Configuration loads in correct priority order
- [ ] Health checks work for all components
- [ ] Component registry tracks initialization state
- [ ] All tests pass
