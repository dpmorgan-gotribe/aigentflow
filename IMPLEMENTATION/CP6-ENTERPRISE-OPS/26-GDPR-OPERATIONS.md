# Step 26: GDPR Operations

> **Checkpoint:** CP6 - Enterprise Operations
> **Previous Step:** 25-INCIDENT-RESPONSE.md
> **Next Step:** 27-COMPLIANCE-DASHBOARDS.md

---

## Overview

GDPR Operations provides automated data subject rights handling, consent management, and data processing documentation. This ensures the platform meets EU data protection requirements.

Key responsibilities:
- Data Subject Access Requests (DSAR) automation
- Right to Erasure (Right to be Forgotten) implementation
- Data portability export in standard formats
- Consent management and tracking
- Data Processing Records (Article 30)
- Retention policy enforcement
- Cross-border transfer documentation

---

## Deliverables

1. `src/enterprise/gdpr/dsar-handler.ts` - DSAR request processor
2. `src/enterprise/gdpr/erasure-engine.ts` - Data deletion orchestrator
3. `src/enterprise/gdpr/export-generator.ts` - Data portability exports
4. `src/enterprise/gdpr/consent-manager.ts` - Consent tracking
5. `src/enterprise/gdpr/retention-enforcer.ts` - Automated retention
6. `orchestrator-data/system/gdpr/` - GDPR configuration

---

## 1. Data Subject Access Request (DSAR) Handler

### 1.1 DSAR Schema

```typescript
/**
 * DSAR Request Schema
 *
 * Tracks data subject access requests through their lifecycle.
 */

import { z } from 'zod';

export const DSARRequestSchema = z.object({
  id: z.string(),
  type: z.enum([
    'access',      // Right to access
    'rectification', // Right to correction
    'erasure',     // Right to deletion
    'portability', // Right to data portability
    'restriction', // Right to restrict processing
    'objection',   // Right to object
  ]),

  // Subject identification
  subject: z.object({
    email: z.string().email(),
    name: z.string().optional(),
    userId: z.string().optional(),
    verificationMethod: z.enum(['email', 'id_document', 'account_login']),
    verified: z.boolean(),
    verifiedAt: z.date().optional(),
  }),

  // Request details
  request: z.object({
    receivedAt: z.date(),
    receivedVia: z.enum(['email', 'web_form', 'postal', 'in_person']),
    description: z.string().optional(),
    scope: z.enum(['all_data', 'specific_data']).default('all_data'),
    specificData: z.array(z.string()).optional(),
  }),

  // Processing status
  status: z.enum([
    'received',
    'verifying_identity',
    'processing',
    'review_required',
    'completed',
    'rejected',
  ]),

  // Timeline
  timeline: z.object({
    receivedAt: z.date(),
    verifiedAt: z.date().optional(),
    processingStartedAt: z.date().optional(),
    completedAt: z.date().optional(),
    deadline: z.date(), // 30 days from receipt
  }),

  // Output
  result: z.object({
    dataPackagePath: z.string().optional(),
    deletedRecords: z.number().optional(),
    rejectionReason: z.string().optional(),
  }).optional(),

  // Audit
  audit: z.object({
    processedBy: z.string(),
    notes: z.array(z.object({
      timestamp: z.date(),
      author: z.string(),
      note: z.string(),
    })),
  }),
});

export type DSARRequest = z.infer<typeof DSARRequestSchema>;
```

### 1.2 DSAR Handler Implementation

```typescript
/**
 * DSAR Handler
 *
 * Processes data subject access requests.
 */

import { EventEmitter } from 'events';
import { DSARRequest } from './schemas';
import { Database } from '../../persistence/database';

export class DSARHandler extends EventEmitter {
  private readonly DEADLINE_DAYS = 30;

  constructor(
    private db: Database,
    private config: {
      autoProcess: boolean;
      requireManualReview: boolean;
      notifyOnReceive: string[];
    }
  ) {
    super();
  }

  /**
   * Submit new DSAR request
   */
  async submitRequest(request: Omit<DSARRequest, 'id' | 'status' | 'timeline'>): Promise<DSARRequest> {
    const dsar: DSARRequest = {
      ...request,
      id: `DSAR-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      status: 'received',
      timeline: {
        receivedAt: new Date(),
        deadline: new Date(Date.now() + this.DEADLINE_DAYS * 24 * 60 * 60 * 1000),
      },
      audit: {
        processedBy: 'system',
        notes: [{
          timestamp: new Date(),
          author: 'system',
          note: 'Request received',
        }],
      },
    };

    await this.db.run(
      `INSERT INTO dsar_requests (id, type, subject, status, timeline, audit)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [dsar.id, dsar.type, JSON.stringify(dsar.subject), dsar.status,
       JSON.stringify(dsar.timeline), JSON.stringify(dsar.audit)]
    );

    this.emit('dsar:received', dsar);

    // Send verification email
    await this.sendVerificationEmail(dsar);

    return dsar;
  }

  /**
   * Verify subject identity
   */
  async verifyIdentity(dsarId: string, verificationCode: string): Promise<boolean> {
    const dsar = await this.getRequest(dsarId);
    if (!dsar) throw new Error('DSAR not found');

    // Verify code
    const isValid = await this.validateVerificationCode(dsar, verificationCode);

    if (isValid) {
      dsar.subject.verified = true;
      dsar.subject.verifiedAt = new Date();
      dsar.status = 'processing';
      dsar.timeline.verifiedAt = new Date();
      dsar.timeline.processingStartedAt = new Date();

      await this.updateRequest(dsar);
      this.emit('dsar:verified', dsar);

      // Start processing if auto-process enabled
      if (this.config.autoProcess) {
        await this.processRequest(dsar);
      }
    }

    return isValid;
  }

  /**
   * Process DSAR request
   */
  async processRequest(dsar: DSARRequest): Promise<void> {
    this.emit('dsar:processing', dsar);

    switch (dsar.type) {
      case 'access':
        await this.handleAccessRequest(dsar);
        break;
      case 'erasure':
        await this.handleErasureRequest(dsar);
        break;
      case 'portability':
        await this.handlePortabilityRequest(dsar);
        break;
      case 'rectification':
        await this.handleRectificationRequest(dsar);
        break;
      default:
        dsar.status = 'review_required';
    }

    await this.updateRequest(dsar);
  }

  /**
   * Handle data access request
   */
  private async handleAccessRequest(dsar: DSARRequest): Promise<void> {
    const userData = await this.collectUserData(dsar.subject.userId || dsar.subject.email);

    // Generate access report
    const report = await this.generateAccessReport(userData);

    // Store package
    const packagePath = await this.storeDataPackage(dsar.id, report);

    dsar.result = { dataPackagePath: packagePath };
    dsar.status = this.config.requireManualReview ? 'review_required' : 'completed';
    dsar.timeline.completedAt = new Date();

    this.emit('dsar:access:complete', dsar);
  }

  /**
   * Handle erasure request
   */
  private async handleErasureRequest(dsar: DSARRequest): Promise<void> {
    const userId = dsar.subject.userId || await this.findUserByEmail(dsar.subject.email);

    // Delete user data from all stores
    const deletedCount = await this.deleteUserData(userId);

    dsar.result = { deletedRecords: deletedCount };
    dsar.status = this.config.requireManualReview ? 'review_required' : 'completed';
    dsar.timeline.completedAt = new Date();

    this.emit('dsar:erasure:complete', dsar);
  }

  /**
   * Handle data portability request
   */
  private async handlePortabilityRequest(dsar: DSARRequest): Promise<void> {
    const userData = await this.collectUserData(dsar.subject.userId || dsar.subject.email);

    // Generate portable format (JSON)
    const portableData = await this.generatePortableExport(userData);

    // Store package
    const packagePath = await this.storeDataPackage(dsar.id, portableData, 'json');

    dsar.result = { dataPackagePath: packagePath };
    dsar.status = this.config.requireManualReview ? 'review_required' : 'completed';
    dsar.timeline.completedAt = new Date();

    this.emit('dsar:portability:complete', dsar);
  }

  /**
   * Collect all user data from system
   */
  private async collectUserData(identifier: string): Promise<Record<string, unknown>> {
    const data: Record<string, unknown> = {};

    // User profile
    data.profile = await this.db.get(
      'SELECT * FROM users WHERE id = ? OR email = ?',
      [identifier, identifier]
    );

    // Projects
    data.projects = await this.db.all(
      'SELECT * FROM projects WHERE owner_id = ?',
      [identifier]
    );

    // Audit logs (user actions only)
    data.activityLog = await this.db.all(
      'SELECT * FROM audit_logs WHERE actor_id = ? LIMIT 10000',
      [identifier]
    );

    // Lessons learned
    data.lessons = await this.db.all(
      'SELECT * FROM lessons WHERE user_id = ?',
      [identifier]
    );

    // Configurations
    data.preferences = await this.db.get(
      'SELECT * FROM user_preferences WHERE user_id = ?',
      [identifier]
    );

    return data;
  }

  /**
   * Delete all user data
   */
  private async deleteUserData(userId: string): Promise<number> {
    let deletedCount = 0;

    // Delete in reverse dependency order
    const tables = [
      { name: 'audit_logs', column: 'actor_id' },
      { name: 'lessons', column: 'user_id' },
      { name: 'user_preferences', column: 'user_id' },
      { name: 'projects', column: 'owner_id' },
      { name: 'users', column: 'id' },
    ];

    for (const table of tables) {
      const result = await this.db.run(
        `DELETE FROM ${table.name} WHERE ${table.column} = ?`,
        [userId]
      );
      deletedCount += result.changes || 0;
    }

    // Log deletion
    await this.db.run(
      `INSERT INTO data_deletion_log (user_id, deleted_at, record_count)
       VALUES (?, ?, ?)`,
      [userId, new Date().toISOString(), deletedCount]
    );

    return deletedCount;
  }

  /**
   * Generate human-readable access report
   */
  private async generateAccessReport(data: Record<string, unknown>): Promise<string> {
    let report = '# Data Access Report\n\n';
    report += `Generated: ${new Date().toISOString()}\n\n`;

    for (const [category, content] of Object.entries(data)) {
      report += `## ${category}\n\n`;
      report += '```json\n';
      report += JSON.stringify(content, null, 2);
      report += '\n```\n\n';
    }

    return report;
  }

  /**
   * Generate portable JSON export
   */
  private async generatePortableExport(data: Record<string, unknown>): Promise<string> {
    return JSON.stringify({
      exportedAt: new Date().toISOString(),
      format: 'GDPR Portable Data Export v1.0',
      data,
    }, null, 2);
  }

  private async sendVerificationEmail(dsar: DSARRequest): Promise<void> {
    // Send verification email
    this.emit('dsar:verification:sent', dsar);
  }

  private async validateVerificationCode(dsar: DSARRequest, code: string): Promise<boolean> {
    // Validate code
    return true;
  }

  private async getRequest(id: string): Promise<DSARRequest | null> {
    return this.db.get('SELECT * FROM dsar_requests WHERE id = ?', [id]);
  }

  private async updateRequest(dsar: DSARRequest): Promise<void> {
    await this.db.run(
      `UPDATE dsar_requests SET status = ?, timeline = ?, result = ?, audit = ?
       WHERE id = ?`,
      [dsar.status, JSON.stringify(dsar.timeline), JSON.stringify(dsar.result),
       JSON.stringify(dsar.audit), dsar.id]
    );
  }

  private async storeDataPackage(dsarId: string, content: string, format = 'md'): Promise<string> {
    const path = `orchestrator-data/gdpr/exports/${dsarId}/data.${format}`;
    // Write file
    return path;
  }

  private async findUserByEmail(email: string): Promise<string> {
    const user = await this.db.get('SELECT id FROM users WHERE email = ?', [email]);
    return user?.id;
  }
}
```

---

## 2. Consent Management

### 2.1 Consent Schema

```typescript
/**
 * Consent Record Schema
 */

export const ConsentSchema = z.object({
  id: z.string(),
  userId: z.string(),

  // Consent categories
  consents: z.array(z.object({
    purpose: z.enum([
      'essential',      // Required for service
      'analytics',      // Usage analytics
      'marketing',      // Marketing communications
      'ai_training',    // Use data for AI training
      'third_party',    // Share with partners
    ]),
    granted: z.boolean(),
    grantedAt: z.date().optional(),
    revokedAt: z.date().optional(),
    version: z.string(), // Policy version consented to
    source: z.enum(['web', 'api', 'mobile', 'import']),
  })),

  // Audit trail
  history: z.array(z.object({
    timestamp: z.date(),
    action: z.enum(['granted', 'revoked', 'updated']),
    purpose: z.string(),
    source: z.string(),
    ipAddress: z.string().optional(),
  })),
});

export type ConsentRecord = z.infer<typeof ConsentSchema>;
```

### 2.2 Consent Manager

```typescript
/**
 * Consent Manager
 *
 * Tracks and enforces user consent.
 */

export class ConsentManager {
  constructor(private db: Database) {}

  /**
   * Record consent grant
   */
  async grantConsent(
    userId: string,
    purposes: string[],
    source: string,
    policyVersion: string
  ): Promise<void> {
    for (const purpose of purposes) {
      await this.db.run(
        `INSERT INTO consents (user_id, purpose, granted, granted_at, version, source)
         VALUES (?, ?, 1, ?, ?, ?)
         ON CONFLICT(user_id, purpose)
         DO UPDATE SET granted = 1, granted_at = ?, version = ?`,
        [userId, purpose, new Date().toISOString(), policyVersion, source,
         new Date().toISOString(), policyVersion]
      );

      await this.logConsentAction(userId, 'granted', purpose, source);
    }
  }

  /**
   * Revoke consent
   */
  async revokeConsent(userId: string, purposes: string[], source: string): Promise<void> {
    for (const purpose of purposes) {
      await this.db.run(
        `UPDATE consents SET granted = 0, revoked_at = ? WHERE user_id = ? AND purpose = ?`,
        [new Date().toISOString(), userId, purpose]
      );

      await this.logConsentAction(userId, 'revoked', purpose, source);
    }
  }

  /**
   * Check if user has consent for purpose
   */
  async hasConsent(userId: string, purpose: string): Promise<boolean> {
    const consent = await this.db.get(
      'SELECT granted FROM consents WHERE user_id = ? AND purpose = ?',
      [userId, purpose]
    );
    return consent?.granted === 1;
  }

  /**
   * Get all consents for user
   */
  async getUserConsents(userId: string): Promise<ConsentRecord> {
    const consents = await this.db.all(
      'SELECT * FROM consents WHERE user_id = ?',
      [userId]
    );

    const history = await this.db.all(
      'SELECT * FROM consent_history WHERE user_id = ? ORDER BY timestamp DESC LIMIT 100',
      [userId]
    );

    return {
      id: `consent-${userId}`,
      userId,
      consents: consents.map(c => ({
        purpose: c.purpose,
        granted: c.granted === 1,
        grantedAt: c.granted_at ? new Date(c.granted_at) : undefined,
        revokedAt: c.revoked_at ? new Date(c.revoked_at) : undefined,
        version: c.version,
        source: c.source,
      })),
      history: history.map(h => ({
        timestamp: new Date(h.timestamp),
        action: h.action,
        purpose: h.purpose,
        source: h.source,
        ipAddress: h.ip_address,
      })),
    };
  }

  /**
   * Generate consent report for audit
   */
  async generateConsentReport(userId: string): Promise<string> {
    const consents = await this.getUserConsents(userId);

    let report = `# Consent Report for User ${userId}\n\n`;
    report += `Generated: ${new Date().toISOString()}\n\n`;

    report += '## Current Consents\n\n';
    for (const c of consents.consents) {
      report += `- **${c.purpose}**: ${c.granted ? 'Granted' : 'Not granted'}`;
      if (c.grantedAt) report += ` (${c.grantedAt.toISOString()})`;
      report += '\n';
    }

    report += '\n## History\n\n';
    for (const h of consents.history.slice(0, 20)) {
      report += `- ${h.timestamp.toISOString()}: ${h.action} ${h.purpose} via ${h.source}\n`;
    }

    return report;
  }

  private async logConsentAction(
    userId: string,
    action: string,
    purpose: string,
    source: string
  ): Promise<void> {
    await this.db.run(
      `INSERT INTO consent_history (user_id, action, purpose, source, timestamp)
       VALUES (?, ?, ?, ?, ?)`,
      [userId, action, purpose, source, new Date().toISOString()]
    );
  }
}
```

---

## 3. Data Retention Enforcer

### 3.1 Retention Policy Schema

```yaml
# orchestrator-data/system/gdpr/retention-policies.yaml
retention_policies:
  # User data
  user_accounts:
    description: "User account information"
    retention_period: "account_lifetime_plus_30_days"
    deletion_trigger: "account_deletion"
    archive_before_delete: true

  # Project data
  project_data:
    description: "Project files and configurations"
    retention_period: "account_lifetime_plus_90_days"
    deletion_trigger: "account_deletion"
    archive_before_delete: true

  # Audit logs
  audit_logs:
    description: "Security and compliance audit logs"
    retention_period: "7_years"  # Legal requirement
    deletion_trigger: "time_based"
    archive_before_delete: true
    archive_location: "cold_storage"

  # Execution traces
  execution_traces:
    description: "Agent execution history"
    retention_period: "90_days"
    deletion_trigger: "time_based"
    archive_before_delete: false

  # Lessons learned
  lessons:
    description: "Extracted knowledge"
    retention_period: "indefinite"  # Anonymized
    requires_anonymization: true

  # Session data
  sessions:
    description: "User session tokens"
    retention_period: "30_days"
    deletion_trigger: "time_based"
    archive_before_delete: false
```

### 3.2 Retention Enforcer

```typescript
/**
 * Retention Enforcer
 *
 * Automatically enforces data retention policies.
 */

export class RetentionEnforcer {
  constructor(
    private db: Database,
    private config: { dryRun: boolean }
  ) {}

  /**
   * Run retention enforcement
   */
  async enforce(): Promise<RetentionReport> {
    const report: RetentionReport = {
      runAt: new Date(),
      policies: [],
      totalDeleted: 0,
      totalArchived: 0,
      errors: [],
    };

    const policies = await this.loadPolicies();

    for (const policy of policies) {
      try {
        const result = await this.enforcePolicy(policy);
        report.policies.push(result);
        report.totalDeleted += result.deleted;
        report.totalArchived += result.archived;
      } catch (error) {
        report.errors.push({
          policy: policy.name,
          error: error.message,
        });
      }
    }

    await this.logEnforcement(report);

    return report;
  }

  /**
   * Enforce single policy
   */
  private async enforcePolicy(policy: RetentionPolicy): Promise<PolicyResult> {
    const result: PolicyResult = {
      policy: policy.name,
      deleted: 0,
      archived: 0,
      skipped: 0,
    };

    // Calculate cutoff date
    const cutoffDate = this.calculateCutoff(policy.retention_period);

    // Find expired records
    const expiredRecords = await this.findExpiredRecords(policy.table, cutoffDate);

    for (const record of expiredRecords) {
      // Archive if required
      if (policy.archive_before_delete) {
        await this.archiveRecord(policy, record);
        result.archived++;
      }

      // Anonymize if required
      if (policy.requires_anonymization) {
        await this.anonymizeRecord(policy, record);
        result.skipped++; // Don't delete, just anonymize
        continue;
      }

      // Delete
      if (!this.config.dryRun) {
        await this.deleteRecord(policy.table, record.id);
      }
      result.deleted++;
    }

    return result;
  }

  private calculateCutoff(period: string): Date {
    const now = new Date();

    switch (period) {
      case '30_days':
        return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      case '90_days':
        return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      case '7_years':
        return new Date(now.getFullYear() - 7, now.getMonth(), now.getDate());
      default:
        return now;
    }
  }

  private async loadPolicies(): Promise<RetentionPolicy[]> {
    // Load from YAML config
    return [];
  }

  private async findExpiredRecords(table: string, cutoff: Date): Promise<any[]> {
    return this.db.all(
      `SELECT * FROM ${table} WHERE created_at < ? AND NOT retained`,
      [cutoff.toISOString()]
    );
  }

  private async archiveRecord(policy: RetentionPolicy, record: any): Promise<void> {
    // Write to archive storage
  }

  private async anonymizeRecord(policy: RetentionPolicy, record: any): Promise<void> {
    // Remove PII, keep structure
    await this.db.run(
      `UPDATE ${policy.table} SET
       user_id = 'anonymized',
       email = NULL,
       name = NULL,
       anonymized_at = ?
       WHERE id = ?`,
      [new Date().toISOString(), record.id]
    );
  }

  private async deleteRecord(table: string, id: string): Promise<void> {
    await this.db.run(`DELETE FROM ${table} WHERE id = ?`, [id]);
  }

  private async logEnforcement(report: RetentionReport): Promise<void> {
    await this.db.run(
      `INSERT INTO retention_runs (run_at, deleted, archived, errors)
       VALUES (?, ?, ?, ?)`,
      [report.runAt.toISOString(), report.totalDeleted, report.totalArchived,
       JSON.stringify(report.errors)]
    );
  }
}

interface RetentionPolicy {
  name: string;
  table: string;
  retention_period: string;
  archive_before_delete: boolean;
  requires_anonymization: boolean;
}

interface RetentionReport {
  runAt: Date;
  policies: PolicyResult[];
  totalDeleted: number;
  totalArchived: number;
  errors: { policy: string; error: string }[];
}

interface PolicyResult {
  policy: string;
  deleted: number;
  archived: number;
  skipped: number;
}
```

---

## 4. Data Processing Records (Article 30)

### 4.1 Processing Activity Schema

```yaml
# orchestrator-data/system/gdpr/processing-activities.yaml
processing_activities:
  - name: "User Account Management"
    description: "Creation, management, and deletion of user accounts"
    controller: "Aigentflow Ltd"
    processor: null  # Self-processed
    categories_of_data:
      - "Name"
      - "Email address"
      - "Password hash"
      - "Account preferences"
    categories_of_subjects:
      - "Platform users"
    purposes:
      - "Account authentication"
      - "Service delivery"
      - "Communication"
    lawful_basis: "contract"
    retention: "Account lifetime + 30 days"
    recipients:
      - "Internal: Authentication service"
      - "External: Email service provider (for communications)"
    transfers_outside_eu: false
    security_measures:
      - "Encryption at rest (AES-256)"
      - "Encryption in transit (TLS 1.3)"
      - "Access control (RBAC)"
      - "Audit logging"

  - name: "AI Agent Orchestration"
    description: "Coordination of AI agents for software development"
    controller: "Aigentflow Ltd"
    processor: "Anthropic (Claude API)"
    categories_of_data:
      - "Source code"
      - "Project configurations"
      - "Development prompts"
    categories_of_subjects:
      - "Platform users"
      - "End users of generated software (indirect)"
    purposes:
      - "AI-assisted development"
      - "Code generation"
      - "Quality assurance"
    lawful_basis: "contract"
    retention: "Project lifetime + 90 days"
    recipients:
      - "Internal: Orchestrator service"
      - "External: Anthropic Claude API"
    transfers_outside_eu: true
    transfer_mechanism: "Standard Contractual Clauses"
    security_measures:
      - "Data minimization in prompts"
      - "No PII in agent context"
      - "Encryption in transit"
```

---

## 5. CLI Commands

```typescript
// GDPR-related CLI commands

program
  .command('gdpr dsar submit')
  .description('Submit a data subject access request')
  .option('--type <type>', 'Request type (access/erasure/portability)')
  .option('--email <email>', 'Subject email')
  .action(async (options) => {
    const handler = new DSARHandler(db, config);
    const request = await handler.submitRequest({
      type: options.type,
      subject: { email: options.email, verificationMethod: 'email', verified: false },
      request: { receivedAt: new Date(), receivedVia: 'api' },
    });
    console.log(`DSAR submitted: ${request.id}`);
  });

program
  .command('gdpr dsar status <id>')
  .description('Check DSAR status')
  .action(async (id) => {
    const request = await dsarHandler.getRequest(id);
    console.log(`Status: ${request.status}`);
    console.log(`Deadline: ${request.timeline.deadline}`);
  });

program
  .command('gdpr retention run')
  .description('Run retention enforcement')
  .option('--dry-run', 'Preview without deleting')
  .action(async (options) => {
    const enforcer = new RetentionEnforcer(db, { dryRun: options.dryRun });
    const report = await enforcer.enforce();
    console.log(`Deleted: ${report.totalDeleted}, Archived: ${report.totalArchived}`);
  });

program
  .command('gdpr consent report <userId>')
  .description('Generate consent report')
  .action(async (userId) => {
    const manager = new ConsentManager(db);
    const report = await manager.generateConsentReport(userId);
    console.log(report);
  });
```

---

## 6. Test Scenarios

```typescript
describe('GDPR Operations', () => {
  describe('DSARHandler', () => {
    it('should create DSAR with 30-day deadline', async () => {
      const request = await handler.submitRequest({
        type: 'access',
        subject: { email: 'user@example.com', verificationMethod: 'email', verified: false },
        request: { receivedAt: new Date(), receivedVia: 'email' },
      });

      const daysDiff = Math.ceil(
        (request.timeline.deadline.getTime() - request.timeline.receivedAt.getTime())
        / (1000 * 60 * 60 * 24)
      );
      expect(daysDiff).toBe(30);
    });

    it('should collect all user data for access request', async () => {
      // Test data collection
    });

    it('should delete all user data for erasure request', async () => {
      // Test data deletion
    });
  });

  describe('ConsentManager', () => {
    it('should track consent grants with audit trail', async () => {
      await manager.grantConsent('user-1', ['analytics'], 'web', 'v1.0');
      const consents = await manager.getUserConsents('user-1');
      expect(consents.consents.find(c => c.purpose === 'analytics')?.granted).toBe(true);
    });

    it('should revoke consent and update history', async () => {
      // Test revocation
    });
  });

  describe('RetentionEnforcer', () => {
    it('should delete records past retention period', async () => {
      // Test deletion
    });

    it('should archive before delete when configured', async () => {
      // Test archiving
    });

    it('should anonymize instead of delete when required', async () => {
      // Test anonymization
    });
  });
});
```

---

## 7. Dependencies

- Step 04: Persistence Layer (database)
- Step 04d: Audit Logging (DSAR audit trail)
- Step 05f: Compliance Agent (policy enforcement)

---

## 8. Acceptance Criteria

- [ ] DSAR requests created with 30-day deadline
- [ ] Identity verification workflow complete
- [ ] Data access exports include all user data
- [ ] Erasure removes data from all stores
- [ ] Consent tracked with full audit trail
- [ ] Retention policies enforce automatically
- [ ] Processing records documented per Article 30
- [ ] All tests pass
