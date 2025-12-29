# Step 30: Multi-Tenant Security

> **Checkpoint:** CP7 - Platform Infrastructure
> **Previous Step:** 29-MODEL-ABSTRACTION.md
> **Next Step:** 31-FEATURE-FLAGS.md

---

## Overview

Multi-Tenant Security ensures complete isolation between tenants (organizations) while enabling efficient resource sharing. This is critical for SaaS deployment where multiple customers share the same infrastructure.

Key responsibilities:
- Tenant isolation at data and execution levels
- Tenant-aware authentication and authorization
- Resource quotas and rate limiting per tenant
- Tenant-specific configurations
- Cross-tenant security boundaries
- Tenant lifecycle management

---

## Deliverables

1. `src/platform/tenancy/tenant-manager.ts` - Tenant lifecycle
2. `src/platform/tenancy/isolation.ts` - Data isolation
3. `src/platform/tenancy/quotas.ts` - Resource quotas
4. `src/platform/tenancy/middleware.ts` - Request context
5. `orchestrator-data/system/tenancy/` - Tenant configurations

---

## 1. Tenant Model

### 1.1 Tenant Schema

```typescript
/**
 * Tenant Schema
 */

import { z } from 'zod';

export const TenantSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(), // URL-safe identifier
  type: z.enum(['free', 'starter', 'professional', 'enterprise']),

  // Status
  status: z.enum(['active', 'suspended', 'pending', 'deleted']),
  createdAt: z.date(),
  suspendedAt: z.date().optional(),
  deletedAt: z.date().optional(),

  // Contact
  owner: z.object({
    userId: z.string(),
    email: z.string().email(),
    name: z.string(),
  }),

  // Settings
  settings: z.object({
    defaultModel: z.string().optional(),
    allowedModels: z.array(z.string()).optional(),
    complianceFrameworks: z.array(z.string()).optional(),
    dataResidency: z.enum(['us', 'eu', 'ap']).optional(),
  }),

  // Quotas
  quotas: z.object({
    maxUsers: z.number(),
    maxProjects: z.number(),
    maxTokensPerMonth: z.number(),
    maxStorageGB: z.number(),
    maxConcurrentAgents: z.number(),
  }),

  // Usage
  usage: z.object({
    currentUsers: z.number(),
    currentProjects: z.number(),
    tokensThisMonth: z.number(),
    storageUsedGB: z.number(),
  }),

  // Billing
  billing: z.object({
    stripeCustomerId: z.string().optional(),
    subscriptionId: z.string().optional(),
    billingEmail: z.string().email().optional(),
  }).optional(),
});

export type Tenant = z.infer<typeof TenantSchema>;

// Tenant context for request processing
export interface TenantContext {
  tenantId: string;
  tenant: Tenant;
  userId: string;
  permissions: string[];
}
```

### 1.2 Tenant Manager

```typescript
/**
 * Tenant Manager
 *
 * Manages tenant lifecycle and configuration.
 */

export class TenantManager {
  constructor(private db: Database) {}

  /**
   * Create new tenant
   */
  async createTenant(
    input: Omit<Tenant, 'id' | 'createdAt' | 'usage'>
  ): Promise<Tenant> {
    const tenant: Tenant = {
      ...input,
      id: `ten_${this.generateId()}`,
      createdAt: new Date(),
      usage: {
        currentUsers: 0,
        currentProjects: 0,
        tokensThisMonth: 0,
        storageUsedGB: 0,
      },
    };

    // Create tenant record
    await this.db.run(
      `INSERT INTO tenants (id, name, slug, type, status, owner, settings, quotas, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [tenant.id, tenant.name, tenant.slug, tenant.type, tenant.status,
       JSON.stringify(tenant.owner), JSON.stringify(tenant.settings),
       JSON.stringify(tenant.quotas), tenant.createdAt.toISOString()]
    );

    // Create tenant-specific database schemas or tables
    await this.initializeTenantStorage(tenant.id);

    return tenant;
  }

  /**
   * Get tenant by ID
   */
  async getTenant(tenantId: string): Promise<Tenant | null> {
    const row = await this.db.get(
      'SELECT * FROM tenants WHERE id = ?',
      [tenantId]
    );
    return row ? this.rowToTenant(row) : null;
  }

  /**
   * Get tenant by slug
   */
  async getTenantBySlug(slug: string): Promise<Tenant | null> {
    const row = await this.db.get(
      'SELECT * FROM tenants WHERE slug = ?',
      [slug]
    );
    return row ? this.rowToTenant(row) : null;
  }

  /**
   * Update tenant settings
   */
  async updateSettings(
    tenantId: string,
    settings: Partial<Tenant['settings']>
  ): Promise<void> {
    const tenant = await this.getTenant(tenantId);
    if (!tenant) throw new Error('Tenant not found');

    const newSettings = { ...tenant.settings, ...settings };

    await this.db.run(
      'UPDATE tenants SET settings = ? WHERE id = ?',
      [JSON.stringify(newSettings), tenantId]
    );
  }

  /**
   * Suspend tenant
   */
  async suspendTenant(tenantId: string, reason: string): Promise<void> {
    await this.db.run(
      `UPDATE tenants SET status = 'suspended', suspended_at = ?, suspension_reason = ?
       WHERE id = ?`,
      [new Date().toISOString(), reason, tenantId]
    );

    // Terminate all running agents for this tenant
    await this.terminateTenantAgents(tenantId);
  }

  /**
   * Delete tenant (soft delete)
   */
  async deleteTenant(tenantId: string): Promise<void> {
    await this.db.run(
      `UPDATE tenants SET status = 'deleted', deleted_at = ? WHERE id = ?`,
      [new Date().toISOString(), tenantId]
    );

    // Schedule data deletion per retention policy
    await this.scheduleTenantDataDeletion(tenantId);
  }

  /**
   * Check if tenant is within quotas
   */
  async checkQuotas(tenantId: string): Promise<QuotaStatus> {
    const tenant = await this.getTenant(tenantId);
    if (!tenant) throw new Error('Tenant not found');

    return {
      users: {
        current: tenant.usage.currentUsers,
        limit: tenant.quotas.maxUsers,
        exceeded: tenant.usage.currentUsers >= tenant.quotas.maxUsers,
      },
      projects: {
        current: tenant.usage.currentProjects,
        limit: tenant.quotas.maxProjects,
        exceeded: tenant.usage.currentProjects >= tenant.quotas.maxProjects,
      },
      tokens: {
        current: tenant.usage.tokensThisMonth,
        limit: tenant.quotas.maxTokensPerMonth,
        exceeded: tenant.usage.tokensThisMonth >= tenant.quotas.maxTokensPerMonth,
      },
      storage: {
        current: tenant.usage.storageUsedGB,
        limit: tenant.quotas.maxStorageGB,
        exceeded: tenant.usage.storageUsedGB >= tenant.quotas.maxStorageGB,
      },
    };
  }

  /**
   * Increment usage
   */
  async incrementUsage(
    tenantId: string,
    field: keyof Tenant['usage'],
    amount: number = 1
  ): Promise<void> {
    const columnMap: Record<string, string> = {
      currentUsers: 'current_users',
      currentProjects: 'current_projects',
      tokensThisMonth: 'tokens_this_month',
      storageUsedGB: 'storage_used_gb',
    };

    const column = columnMap[field];
    if (!column) throw new Error(`Invalid usage field: ${field}`);

    await this.db.run(
      `UPDATE tenants SET usage = json_set(usage, '$.${field}',
       COALESCE(json_extract(usage, '$.${field}'), 0) + ?)
       WHERE id = ?`,
      [amount, tenantId]
    );
  }

  /**
   * Initialize tenant storage
   */
  private async initializeTenantStorage(tenantId: string): Promise<void> {
    // Create tenant-specific tables with tenant_id prefix
    // Or create separate schema/database depending on isolation strategy

    // For row-level isolation, create indexes
    await this.db.run(
      `CREATE INDEX IF NOT EXISTS idx_projects_tenant
       ON projects(tenant_id) WHERE tenant_id = ?`,
      [tenantId]
    );
  }

  private async terminateTenantAgents(tenantId: string): Promise<void> {
    // Kill all running agents for tenant
  }

  private async scheduleTenantDataDeletion(tenantId: string): Promise<void> {
    // Schedule background job for data deletion
  }

  private generateId(): string {
    return Math.random().toString(36).substr(2, 12);
  }

  private rowToTenant(row: any): Tenant {
    return {
      id: row.id,
      name: row.name,
      slug: row.slug,
      type: row.type,
      status: row.status,
      createdAt: new Date(row.created_at),
      suspendedAt: row.suspended_at ? new Date(row.suspended_at) : undefined,
      deletedAt: row.deleted_at ? new Date(row.deleted_at) : undefined,
      owner: JSON.parse(row.owner),
      settings: JSON.parse(row.settings),
      quotas: JSON.parse(row.quotas),
      usage: JSON.parse(row.usage || '{}'),
      billing: row.billing ? JSON.parse(row.billing) : undefined,
    };
  }
}

interface QuotaStatus {
  users: { current: number; limit: number; exceeded: boolean };
  projects: { current: number; limit: number; exceeded: boolean };
  tokens: { current: number; limit: number; exceeded: boolean };
  storage: { current: number; limit: number; exceeded: boolean };
}
```

---

## 2. Data Isolation

### 2.1 Isolation Strategies

```typescript
/**
 * Tenant Data Isolation
 *
 * Ensures complete data separation between tenants.
 */

export enum IsolationStrategy {
  ROW_LEVEL = 'row_level',      // Shared tables with tenant_id column
  SCHEMA_LEVEL = 'schema_level', // Separate schemas per tenant
  DATABASE_LEVEL = 'database_level', // Separate databases
}

export class TenantIsolation {
  constructor(
    private db: Database,
    private strategy: IsolationStrategy = IsolationStrategy.ROW_LEVEL
  ) {}

  /**
   * Get tenant-scoped query builder
   */
  scopedQuery(tenantId: string): TenantScopedQuery {
    return new TenantScopedQuery(this.db, tenantId, this.strategy);
  }

  /**
   * Validate tenant access
   */
  async validateAccess(
    tenantId: string,
    resourceType: string,
    resourceId: string
  ): Promise<boolean> {
    switch (this.strategy) {
      case IsolationStrategy.ROW_LEVEL:
        const row = await this.db.get(
          `SELECT tenant_id FROM ${resourceType} WHERE id = ?`,
          [resourceId]
        );
        return row?.tenant_id === tenantId;

      case IsolationStrategy.SCHEMA_LEVEL:
        // Check if resource exists in tenant schema
        return true;

      case IsolationStrategy.DATABASE_LEVEL:
        // Check in tenant-specific database
        return true;

      default:
        return false;
    }
  }

  /**
   * Migrate tenant data (for changing isolation strategy)
   */
  async migrateTenant(
    tenantId: string,
    fromStrategy: IsolationStrategy,
    toStrategy: IsolationStrategy
  ): Promise<void> {
    // Migration logic
  }
}

/**
 * Tenant-scoped query builder
 */
export class TenantScopedQuery {
  constructor(
    private db: Database,
    private tenantId: string,
    private strategy: IsolationStrategy
  ) {}

  /**
   * Select with tenant scope
   */
  async select<T>(
    table: string,
    conditions: Record<string, unknown> = {}
  ): Promise<T[]> {
    const whereClause = Object.keys(conditions)
      .map(k => `${k} = ?`)
      .concat(['tenant_id = ?'])
      .join(' AND ');

    const values = [...Object.values(conditions), this.tenantId];

    return this.db.all(
      `SELECT * FROM ${this.getTableName(table)} WHERE ${whereClause}`,
      values
    );
  }

  /**
   * Insert with tenant scope
   */
  async insert(
    table: string,
    data: Record<string, unknown>
  ): Promise<{ id: string }> {
    const dataWithTenant = { ...data, tenant_id: this.tenantId };
    const columns = Object.keys(dataWithTenant).join(', ');
    const placeholders = Object.keys(dataWithTenant).map(() => '?').join(', ');

    const result = await this.db.run(
      `INSERT INTO ${this.getTableName(table)} (${columns}) VALUES (${placeholders})`,
      Object.values(dataWithTenant)
    );

    return { id: result.lastInsertRowid?.toString() || '' };
  }

  /**
   * Update with tenant scope
   */
  async update(
    table: string,
    id: string,
    data: Record<string, unknown>
  ): Promise<void> {
    const setClause = Object.keys(data).map(k => `${k} = ?`).join(', ');

    await this.db.run(
      `UPDATE ${this.getTableName(table)} SET ${setClause}
       WHERE id = ? AND tenant_id = ?`,
      [...Object.values(data), id, this.tenantId]
    );
  }

  /**
   * Delete with tenant scope
   */
  async delete(table: string, id: string): Promise<void> {
    await this.db.run(
      `DELETE FROM ${this.getTableName(table)} WHERE id = ? AND tenant_id = ?`,
      [id, this.tenantId]
    );
  }

  private getTableName(table: string): string {
    switch (this.strategy) {
      case IsolationStrategy.SCHEMA_LEVEL:
        return `tenant_${this.tenantId}.${table}`;
      case IsolationStrategy.DATABASE_LEVEL:
        // Would use different database connection
        return table;
      default:
        return table;
    }
  }
}
```

---

## 3. Request Middleware

### 3.1 Tenant Context Middleware

```typescript
/**
 * Tenant Context Middleware
 *
 * Extracts and validates tenant context for each request.
 */

import { AsyncLocalStorage } from 'async_hooks';

// Async local storage for tenant context
const tenantContext = new AsyncLocalStorage<TenantContext>();

export function getCurrentTenant(): TenantContext | undefined {
  return tenantContext.getStore();
}

export function requireTenant(): TenantContext {
  const ctx = tenantContext.getStore();
  if (!ctx) {
    throw new Error('Tenant context required but not found');
  }
  return ctx;
}

/**
 * Middleware to establish tenant context
 */
export class TenantMiddleware {
  constructor(
    private tenantManager: TenantManager,
    private authService: AuthService
  ) {}

  /**
   * Process request and establish tenant context
   */
  async process<T>(
    request: { headers: Record<string, string>; tenantSlug?: string },
    handler: () => Promise<T>
  ): Promise<T> {
    // Extract tenant identifier
    const tenantSlug = request.tenantSlug ||
                       request.headers['x-tenant-id'] ||
                       this.extractFromHost(request.headers['host']);

    if (!tenantSlug) {
      throw new Error('Tenant identifier required');
    }

    // Load tenant
    const tenant = await this.tenantManager.getTenantBySlug(tenantSlug);
    if (!tenant) {
      throw new Error(`Tenant not found: ${tenantSlug}`);
    }

    // Check tenant status
    if (tenant.status !== 'active') {
      throw new Error(`Tenant is ${tenant.status}`);
    }

    // Extract user from auth header
    const authHeader = request.headers['authorization'];
    const user = await this.authService.validateToken(authHeader, tenant.id);

    // Create context
    const ctx: TenantContext = {
      tenantId: tenant.id,
      tenant,
      userId: user.id,
      permissions: user.permissions,
    };

    // Run handler with context
    return tenantContext.run(ctx, handler);
  }

  private extractFromHost(host?: string): string | null {
    if (!host) return null;

    // Extract tenant from subdomain: {tenant}.aigentflow.com
    const match = host.match(/^([^.]+)\.aigentflow\.com/);
    return match ? match[1] : null;
  }
}
```

---

## 4. Rate Limiting

### 4.1 Tenant Rate Limiter

```typescript
/**
 * Tenant Rate Limiter
 *
 * Applies rate limits per tenant.
 */

export class TenantRateLimiter {
  private windows: Map<string, RateLimitWindow> = new Map();

  constructor(private config: RateLimitConfig) {}

  /**
   * Check if request is allowed
   */
  async checkLimit(
    tenantId: string,
    action: string
  ): Promise<{ allowed: boolean; retryAfter?: number }> {
    const key = `${tenantId}:${action}`;
    const limit = this.config.limits[action] || this.config.defaultLimit;

    let window = this.windows.get(key);
    if (!window || this.isExpired(window)) {
      window = {
        count: 0,
        startTime: Date.now(),
        windowMs: limit.windowMs,
      };
      this.windows.set(key, window);
    }

    if (window.count >= limit.maxRequests) {
      const retryAfter = Math.ceil(
        (window.startTime + window.windowMs - Date.now()) / 1000
      );
      return { allowed: false, retryAfter };
    }

    window.count++;
    return { allowed: true };
  }

  /**
   * Get current rate limit status
   */
  getStatus(tenantId: string, action: string): RateLimitStatus {
    const key = `${tenantId}:${action}`;
    const limit = this.config.limits[action] || this.config.defaultLimit;
    const window = this.windows.get(key);

    if (!window || this.isExpired(window)) {
      return {
        remaining: limit.maxRequests,
        limit: limit.maxRequests,
        reset: Date.now() + limit.windowMs,
      };
    }

    return {
      remaining: Math.max(0, limit.maxRequests - window.count),
      limit: limit.maxRequests,
      reset: window.startTime + window.windowMs,
    };
  }

  private isExpired(window: RateLimitWindow): boolean {
    return Date.now() > window.startTime + window.windowMs;
  }
}

interface RateLimitWindow {
  count: number;
  startTime: number;
  windowMs: number;
}

interface RateLimitConfig {
  defaultLimit: { maxRequests: number; windowMs: number };
  limits: Record<string, { maxRequests: number; windowMs: number }>;
}

interface RateLimitStatus {
  remaining: number;
  limit: number;
  reset: number;
}
```

---

## 5. Tenant Plans

```yaml
# orchestrator-data/system/tenancy/plans.yaml
plans:
  free:
    name: "Free"
    price: 0
    quotas:
      maxUsers: 1
      maxProjects: 3
      maxTokensPerMonth: 100000
      maxStorageGB: 1
      maxConcurrentAgents: 2
    features:
      - basic_orchestration
    rate_limits:
      api_requests: { maxRequests: 100, windowMs: 60000 }
      agent_spawns: { maxRequests: 10, windowMs: 60000 }

  starter:
    name: "Starter"
    price: 29
    quotas:
      maxUsers: 5
      maxProjects: 10
      maxTokensPerMonth: 1000000
      maxStorageGB: 10
      maxConcurrentAgents: 5
    features:
      - basic_orchestration
      - custom_skills
      - priority_support
    rate_limits:
      api_requests: { maxRequests: 500, windowMs: 60000 }
      agent_spawns: { maxRequests: 50, windowMs: 60000 }

  professional:
    name: "Professional"
    price: 99
    quotas:
      maxUsers: 25
      maxProjects: 50
      maxTokensPerMonth: 5000000
      maxStorageGB: 100
      maxConcurrentAgents: 15
    features:
      - basic_orchestration
      - custom_skills
      - custom_agents
      - compliance_tools
      - priority_support
    rate_limits:
      api_requests: { maxRequests: 2000, windowMs: 60000 }
      agent_spawns: { maxRequests: 200, windowMs: 60000 }

  enterprise:
    name: "Enterprise"
    price: custom
    quotas:
      maxUsers: unlimited
      maxProjects: unlimited
      maxTokensPerMonth: unlimited
      maxStorageGB: unlimited
      maxConcurrentAgents: 50
    features:
      - all
      - sso
      - dedicated_support
      - sla
      - audit_logs
      - compliance_dashboards
    rate_limits:
      api_requests: { maxRequests: 10000, windowMs: 60000 }
      agent_spawns: { maxRequests: 1000, windowMs: 60000 }
    isolation: schema_level  # Enhanced isolation for enterprise
```

---

## 6. Test Scenarios

```typescript
describe('Multi-Tenant Security', () => {
  describe('TenantManager', () => {
    it('should create tenant with correct quotas', async () => {
      const tenant = await manager.createTenant({
        name: 'Test Org',
        slug: 'test-org',
        type: 'starter',
        status: 'active',
        owner: { userId: 'user-1', email: 'admin@test.org', name: 'Admin' },
        settings: {},
        quotas: {
          maxUsers: 5,
          maxProjects: 10,
          maxTokensPerMonth: 1000000,
          maxStorageGB: 10,
          maxConcurrentAgents: 5,
        },
      });

      expect(tenant.id).toBeDefined();
      expect(tenant.quotas.maxUsers).toBe(5);
    });

    it('should enforce quota limits', async () => {
      await manager.incrementUsage('tenant-1', 'currentProjects', 10);
      const status = await manager.checkQuotas('tenant-1');
      expect(status.projects.exceeded).toBe(true);
    });
  });

  describe('TenantIsolation', () => {
    it('should prevent cross-tenant data access', async () => {
      const query1 = isolation.scopedQuery('tenant-1');
      const query2 = isolation.scopedQuery('tenant-2');

      // Insert data for tenant-1
      await query1.insert('projects', { name: 'Project A' });

      // Tenant-2 should not see tenant-1's data
      const results = await query2.select('projects');
      expect(results.length).toBe(0);
    });
  });

  describe('TenantRateLimiter', () => {
    it('should enforce rate limits per tenant', async () => {
      for (let i = 0; i < 100; i++) {
        await limiter.checkLimit('tenant-1', 'api_requests');
      }

      const result = await limiter.checkLimit('tenant-1', 'api_requests');
      expect(result.allowed).toBe(false);
      expect(result.retryAfter).toBeGreaterThan(0);
    });
  });
});
```

---

## 7. Dependencies

- Step 04: Persistence Layer (tenant data storage)
- Step 04d: Audit Logging (tenant-scoped auditing)
- Authentication service

---

## 8. Acceptance Criteria

- [ ] Tenant creation with quotas works
- [ ] Data isolation prevents cross-tenant access
- [ ] Tenant context established for all requests
- [ ] Rate limits enforced per tenant
- [ ] Quota exceeded errors returned appropriately
- [ ] Tenant suspension stops all activity
- [ ] Tenant deletion schedules cleanup
- [ ] All tests pass
