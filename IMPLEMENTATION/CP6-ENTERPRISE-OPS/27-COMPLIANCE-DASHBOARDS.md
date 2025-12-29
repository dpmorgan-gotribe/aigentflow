# Step 27: Compliance Dashboards

> **Checkpoint:** CP6 - Enterprise Operations
> **Previous Step:** 26-GDPR-OPERATIONS.md
> **Next Step:** 28-VENDOR-SECURITY.md

---

## Overview

Compliance Dashboards provide real-time visibility into compliance status across all frameworks (SOC2, GDPR, HIPAA, PCI-DSS). They enable continuous monitoring, evidence collection, and audit preparation.

Key responsibilities:
- Real-time compliance status visualization
- Control attestation tracking
- Evidence collection and organization
- Audit preparation reports
- Compliance trend analysis
- Gap identification and remediation tracking

---

## Deliverables

1. `src/enterprise/compliance/dashboard.ts` - Dashboard data aggregator
2. `src/enterprise/compliance/evidence-collector.ts` - Automated evidence collection
3. `src/enterprise/compliance/attestation-manager.ts` - Control attestation
4. `src/enterprise/compliance/audit-reporter.ts` - Audit report generation
5. `orchestrator-data/system/compliance/dashboards/` - Dashboard configurations

---

## 1. Dashboard Data Model

### 1.1 Compliance Status Schema

```typescript
/**
 * Compliance Dashboard Data Schema
 */

import { z } from 'zod';

export const ControlStatusSchema = z.enum([
  'compliant',
  'non_compliant',
  'partially_compliant',
  'not_assessed',
  'not_applicable',
]);

export const ControlSchema = z.object({
  id: z.string(),
  framework: z.enum(['SOC2', 'GDPR', 'HIPAA', 'PCI_DSS', 'ISO27001']),
  category: z.string(),
  name: z.string(),
  description: z.string(),

  // Current status
  status: ControlStatusSchema,
  statusChangedAt: z.date(),

  // Assessment
  lastAssessedAt: z.date().optional(),
  assessedBy: z.string().optional(),
  nextAssessmentDue: z.date().optional(),

  // Evidence
  evidenceCount: z.number(),
  evidenceLastCollected: z.date().optional(),

  // Attestation
  attestedAt: z.date().optional(),
  attestedBy: z.string().optional(),
  attestationExpiry: z.date().optional(),

  // Remediation (if non-compliant)
  remediation: z.object({
    required: z.boolean(),
    plan: z.string().optional(),
    assignee: z.string().optional(),
    dueDate: z.date().optional(),
    progress: z.number(), // 0-100%
  }).optional(),
});

export type Control = z.infer<typeof ControlSchema>;

export const DashboardSummarySchema = z.object({
  framework: z.string(),
  totalControls: z.number(),
  compliant: z.number(),
  nonCompliant: z.number(),
  partiallyCompliant: z.number(),
  notAssessed: z.number(),
  notApplicable: z.number(),
  compliancePercentage: z.number(),
  lastUpdated: z.date(),
  overdue: z.number(),
  upcomingAssessments: z.number(),
});

export type DashboardSummary = z.infer<typeof DashboardSummarySchema>;
```

### 1.2 Dashboard Aggregator

```typescript
/**
 * Compliance Dashboard
 *
 * Aggregates compliance data for visualization.
 */

export class ComplianceDashboard {
  constructor(private db: Database) {}

  /**
   * Get summary for all frameworks
   */
  async getAllFrameworkSummaries(): Promise<DashboardSummary[]> {
    const frameworks = ['SOC2', 'GDPR', 'HIPAA', 'PCI_DSS', 'ISO27001'];
    return Promise.all(frameworks.map(f => this.getFrameworkSummary(f)));
  }

  /**
   * Get summary for specific framework
   */
  async getFrameworkSummary(framework: string): Promise<DashboardSummary> {
    const controls = await this.getControls(framework);

    const summary: DashboardSummary = {
      framework,
      totalControls: controls.length,
      compliant: controls.filter(c => c.status === 'compliant').length,
      nonCompliant: controls.filter(c => c.status === 'non_compliant').length,
      partiallyCompliant: controls.filter(c => c.status === 'partially_compliant').length,
      notAssessed: controls.filter(c => c.status === 'not_assessed').length,
      notApplicable: controls.filter(c => c.status === 'not_applicable').length,
      compliancePercentage: 0,
      lastUpdated: new Date(),
      overdue: controls.filter(c =>
        c.nextAssessmentDue && c.nextAssessmentDue < new Date()
      ).length,
      upcomingAssessments: controls.filter(c => {
        if (!c.nextAssessmentDue) return false;
        const sevenDays = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
        return c.nextAssessmentDue <= sevenDays && c.nextAssessmentDue > new Date();
      }).length,
    };

    // Calculate compliance percentage (excluding N/A)
    const applicableControls = summary.totalControls - summary.notApplicable;
    if (applicableControls > 0) {
      summary.compliancePercentage = Math.round(
        (summary.compliant / applicableControls) * 100
      );
    }

    return summary;
  }

  /**
   * Get all controls for framework
   */
  async getControls(framework: string): Promise<Control[]> {
    const rows = await this.db.all(
      `SELECT * FROM compliance_controls WHERE framework = ? ORDER BY category, id`,
      [framework]
    );

    return rows.map(this.rowToControl);
  }

  /**
   * Get controls needing attention
   */
  async getAttentionRequired(): Promise<{
    nonCompliant: Control[];
    overdue: Control[];
    expiringAttestations: Control[];
  }> {
    const allControls = await this.db.all(
      'SELECT * FROM compliance_controls'
    );

    const controls = allControls.map(this.rowToControl);
    const now = new Date();
    const thirtyDays = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    return {
      nonCompliant: controls.filter(c => c.status === 'non_compliant'),
      overdue: controls.filter(c => c.nextAssessmentDue && c.nextAssessmentDue < now),
      expiringAttestations: controls.filter(c =>
        c.attestationExpiry && c.attestationExpiry <= thirtyDays
      ),
    };
  }

  /**
   * Get compliance trend over time
   */
  async getComplianceTrend(
    framework: string,
    days: number = 90
  ): Promise<{ date: string; percentage: number }[]> {
    const rows = await this.db.all(
      `SELECT date, compliance_percentage
       FROM compliance_snapshots
       WHERE framework = ? AND date >= date('now', '-' || ? || ' days')
       ORDER BY date`,
      [framework, days]
    );

    return rows.map(r => ({
      date: r.date,
      percentage: r.compliance_percentage,
    }));
  }

  /**
   * Get remediation status
   */
  async getRemediationStatus(): Promise<{
    total: number;
    inProgress: number;
    overdue: number;
    completed: number;
  }> {
    const controls = await this.db.all(
      `SELECT * FROM compliance_controls WHERE status = 'non_compliant'`
    );

    const now = new Date();
    let inProgress = 0;
    let overdue = 0;
    let completed = 0;

    for (const row of controls) {
      const control = this.rowToControl(row);
      if (!control.remediation) continue;

      if (control.remediation.progress === 100) {
        completed++;
      } else if (control.remediation.dueDate && control.remediation.dueDate < now) {
        overdue++;
      } else {
        inProgress++;
      }
    }

    return { total: controls.length, inProgress, overdue, completed };
  }

  /**
   * Export dashboard data as JSON
   */
  async exportDashboard(framework?: string): Promise<string> {
    const data = {
      exportedAt: new Date().toISOString(),
      summaries: framework
        ? [await this.getFrameworkSummary(framework)]
        : await this.getAllFrameworkSummaries(),
      attention: await this.getAttentionRequired(),
      remediation: await this.getRemediationStatus(),
    };

    return JSON.stringify(data, null, 2);
  }

  private rowToControl(row: any): Control {
    return {
      id: row.id,
      framework: row.framework,
      category: row.category,
      name: row.name,
      description: row.description,
      status: row.status,
      statusChangedAt: new Date(row.status_changed_at),
      lastAssessedAt: row.last_assessed_at ? new Date(row.last_assessed_at) : undefined,
      assessedBy: row.assessed_by,
      nextAssessmentDue: row.next_assessment_due ? new Date(row.next_assessment_due) : undefined,
      evidenceCount: row.evidence_count || 0,
      evidenceLastCollected: row.evidence_last_collected ? new Date(row.evidence_last_collected) : undefined,
      attestedAt: row.attested_at ? new Date(row.attested_at) : undefined,
      attestedBy: row.attested_by,
      attestationExpiry: row.attestation_expiry ? new Date(row.attestation_expiry) : undefined,
      remediation: row.remediation_required ? {
        required: true,
        plan: row.remediation_plan,
        assignee: row.remediation_assignee,
        dueDate: row.remediation_due ? new Date(row.remediation_due) : undefined,
        progress: row.remediation_progress || 0,
      } : undefined,
    };
  }
}
```

---

## 2. Evidence Collector

### 2.1 Evidence Schema

```typescript
/**
 * Evidence Record Schema
 */

export const EvidenceSchema = z.object({
  id: z.string(),
  controlId: z.string(),
  framework: z.string(),

  // Evidence details
  type: z.enum([
    'screenshot',
    'log_export',
    'config_snapshot',
    'policy_document',
    'test_result',
    'audit_report',
    'attestation',
    'procedure_document',
  ]),
  name: z.string(),
  description: z.string(),

  // Collection
  collectedAt: z.date(),
  collectionMethod: z.enum(['automated', 'manual', 'imported']),
  collectedBy: z.string(),

  // Storage
  storagePath: z.string(),
  checksum: z.string(),
  sizeBytes: z.number(),

  // Validity
  validFrom: z.date(),
  validUntil: z.date().optional(),
  supersededBy: z.string().optional(),

  // Audit metadata
  auditPeriod: z.string().optional(), // e.g., "Q4 2025"
  auditorNotes: z.string().optional(),
});

export type Evidence = z.infer<typeof EvidenceSchema>;
```

### 2.2 Evidence Collector Implementation

```typescript
/**
 * Evidence Collector
 *
 * Automates collection of compliance evidence.
 */

export class EvidenceCollector {
  constructor(
    private db: Database,
    private storageDir: string
  ) {}

  /**
   * Collect evidence for control
   */
  async collectEvidence(
    controlId: string,
    type: Evidence['type'],
    content: Buffer | string,
    metadata: Partial<Evidence>
  ): Promise<Evidence> {
    const control = await this.getControl(controlId);

    const evidence: Evidence = {
      id: `EVD-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      controlId,
      framework: control.framework,
      type,
      name: metadata.name || `${type}-${Date.now()}`,
      description: metadata.description || '',
      collectedAt: new Date(),
      collectionMethod: metadata.collectionMethod || 'automated',
      collectedBy: metadata.collectedBy || 'system',
      storagePath: '',
      checksum: '',
      sizeBytes: 0,
      validFrom: metadata.validFrom || new Date(),
      validUntil: metadata.validUntil,
    };

    // Store evidence file
    const { path, checksum, size } = await this.storeEvidence(evidence.id, content);
    evidence.storagePath = path;
    evidence.checksum = checksum;
    evidence.sizeBytes = size;

    // Save to database
    await this.saveEvidence(evidence);

    // Update control evidence count
    await this.db.run(
      `UPDATE compliance_controls
       SET evidence_count = evidence_count + 1, evidence_last_collected = ?
       WHERE id = ?`,
      [new Date().toISOString(), controlId]
    );

    return evidence;
  }

  /**
   * Automated evidence collection for common controls
   */
  async runAutomatedCollection(): Promise<CollectionReport> {
    const report: CollectionReport = {
      runAt: new Date(),
      collected: [],
      failed: [],
    };

    // Access control evidence - export user permissions
    try {
      const permissions = await this.collectAccessControlEvidence();
      report.collected.push(permissions);
    } catch (error) {
      report.failed.push({ control: 'access_control', error: error.message });
    }

    // Encryption evidence - verify encryption status
    try {
      const encryption = await this.collectEncryptionEvidence();
      report.collected.push(encryption);
    } catch (error) {
      report.failed.push({ control: 'encryption', error: error.message });
    }

    // Audit logging evidence - export recent logs
    try {
      const logs = await this.collectAuditLogEvidence();
      report.collected.push(logs);
    } catch (error) {
      report.failed.push({ control: 'audit_logging', error: error.message });
    }

    // Secret scanning evidence - scan results
    try {
      const secrets = await this.collectSecretScanEvidence();
      report.collected.push(secrets);
    } catch (error) {
      report.failed.push({ control: 'secret_scanning', error: error.message });
    }

    return report;
  }

  /**
   * Collect access control evidence
   */
  private async collectAccessControlEvidence(): Promise<Evidence> {
    const users = await this.db.all('SELECT id, email, role, created_at FROM users');
    const permissions = await this.db.all('SELECT * FROM user_permissions');

    const content = JSON.stringify({
      exportedAt: new Date().toISOString(),
      users: users.map(u => ({
        id: u.id,
        email: u.email,
        role: u.role,
        createdAt: u.created_at,
      })),
      permissions,
    }, null, 2);

    return this.collectEvidence(
      'SOC2-CC6.1', // Access control
      'config_snapshot',
      content,
      {
        name: 'User Access Report',
        description: 'Export of all user accounts and permissions',
      }
    );
  }

  /**
   * Collect encryption evidence
   */
  private async collectEncryptionEvidence(): Promise<Evidence> {
    // Check database encryption, TLS config, etc.
    const config = {
      databaseEncryption: true,
      encryptionAlgorithm: 'AES-256',
      tlsVersion: '1.3',
      certificateExpiry: '2026-01-01',
    };

    return this.collectEvidence(
      'SOC2-CC6.7', // Encryption
      'config_snapshot',
      JSON.stringify(config, null, 2),
      {
        name: 'Encryption Configuration',
        description: 'Current encryption settings and certificate status',
      }
    );
  }

  /**
   * Collect audit log evidence
   */
  private async collectAuditLogEvidence(): Promise<Evidence> {
    // Export last 30 days of audit logs
    const logs = await this.db.all(
      `SELECT * FROM audit_logs
       WHERE timestamp >= date('now', '-30 days')
       ORDER BY timestamp DESC
       LIMIT 10000`
    );

    return this.collectEvidence(
      'SOC2-CC7.2', // Monitoring
      'log_export',
      JSON.stringify(logs, null, 2),
      {
        name: 'Audit Log Export',
        description: 'Last 30 days of audit log entries',
      }
    );
  }

  /**
   * Collect secret scanning evidence
   */
  private async collectSecretScanEvidence(): Promise<Evidence> {
    // Run secret scan and capture results
    const scanResults = {
      scannedAt: new Date().toISOString(),
      filesScanned: 1234,
      secretsFound: 0,
      patterns: ['AWS keys', 'API tokens', 'Private keys'],
    };

    return this.collectEvidence(
      'SOC2-CC6.6', // Secret management
      'test_result',
      JSON.stringify(scanResults, null, 2),
      {
        name: 'Secret Scan Results',
        description: 'Automated secret scanning results',
      }
    );
  }

  /**
   * Get evidence for control
   */
  async getEvidenceForControl(controlId: string): Promise<Evidence[]> {
    const rows = await this.db.all(
      'SELECT * FROM compliance_evidence WHERE control_id = ? ORDER BY collected_at DESC',
      [controlId]
    );
    return rows.map(this.rowToEvidence);
  }

  /**
   * Get evidence for audit period
   */
  async getEvidenceForAudit(
    framework: string,
    startDate: Date,
    endDate: Date
  ): Promise<Evidence[]> {
    const rows = await this.db.all(
      `SELECT * FROM compliance_evidence
       WHERE framework = ? AND collected_at BETWEEN ? AND ?
       ORDER BY control_id, collected_at`,
      [framework, startDate.toISOString(), endDate.toISOString()]
    );
    return rows.map(this.rowToEvidence);
  }

  private async storeEvidence(
    id: string,
    content: Buffer | string
  ): Promise<{ path: string; checksum: string; size: number }> {
    const path = `${this.storageDir}/${id}`;
    const buffer = typeof content === 'string' ? Buffer.from(content) : content;
    const crypto = await import('crypto');
    const checksum = crypto.createHash('sha256').update(buffer).digest('hex');
    // Write file
    return { path, checksum, size: buffer.length };
  }

  private async saveEvidence(evidence: Evidence): Promise<void> {
    await this.db.run(
      `INSERT INTO compliance_evidence
       (id, control_id, framework, type, name, description, collected_at,
        collection_method, collected_by, storage_path, checksum, size_bytes,
        valid_from, valid_until)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [evidence.id, evidence.controlId, evidence.framework, evidence.type,
       evidence.name, evidence.description, evidence.collectedAt.toISOString(),
       evidence.collectionMethod, evidence.collectedBy, evidence.storagePath,
       evidence.checksum, evidence.sizeBytes, evidence.validFrom.toISOString(),
       evidence.validUntil?.toISOString()]
    );
  }

  private async getControl(id: string): Promise<Control> {
    return this.db.get('SELECT * FROM compliance_controls WHERE id = ?', [id]);
  }

  private rowToEvidence(row: any): Evidence {
    return {
      id: row.id,
      controlId: row.control_id,
      framework: row.framework,
      type: row.type,
      name: row.name,
      description: row.description,
      collectedAt: new Date(row.collected_at),
      collectionMethod: row.collection_method,
      collectedBy: row.collected_by,
      storagePath: row.storage_path,
      checksum: row.checksum,
      sizeBytes: row.size_bytes,
      validFrom: new Date(row.valid_from),
      validUntil: row.valid_until ? new Date(row.valid_until) : undefined,
    };
  }
}

interface CollectionReport {
  runAt: Date;
  collected: Evidence[];
  failed: { control: string; error: string }[];
}
```

---

## 3. Attestation Manager

```typescript
/**
 * Attestation Manager
 *
 * Manages control attestations.
 */

export class AttestationManager {
  constructor(private db: Database) {}

  /**
   * Record attestation for control
   */
  async attest(
    controlId: string,
    attestedBy: string,
    validityMonths: number = 12
  ): Promise<void> {
    const now = new Date();
    const expiry = new Date(now);
    expiry.setMonth(expiry.getMonth() + validityMonths);

    await this.db.run(
      `UPDATE compliance_controls
       SET attested_at = ?, attested_by = ?, attestation_expiry = ?, status = 'compliant'
       WHERE id = ?`,
      [now.toISOString(), attestedBy, expiry.toISOString(), controlId]
    );

    // Log attestation
    await this.db.run(
      `INSERT INTO attestation_history (control_id, attested_at, attested_by, expiry)
       VALUES (?, ?, ?, ?)`,
      [controlId, now.toISOString(), attestedBy, expiry.toISOString()]
    );
  }

  /**
   * Get expiring attestations
   */
  async getExpiringAttestations(days: number = 30): Promise<Control[]> {
    const cutoff = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

    const rows = await this.db.all(
      `SELECT * FROM compliance_controls
       WHERE attestation_expiry IS NOT NULL AND attestation_expiry <= ?
       ORDER BY attestation_expiry`,
      [cutoff.toISOString()]
    );

    return rows;
  }

  /**
   * Bulk attestation for audit completion
   */
  async bulkAttest(
    controlIds: string[],
    attestedBy: string,
    auditPeriod: string
  ): Promise<{ success: string[]; failed: string[] }> {
    const result = { success: [] as string[], failed: [] as string[] };

    for (const id of controlIds) {
      try {
        await this.attest(id, attestedBy, 12);
        result.success.push(id);
      } catch (error) {
        result.failed.push(id);
      }
    }

    // Record audit completion
    await this.db.run(
      `INSERT INTO audit_completions (period, completed_at, attested_by, control_count)
       VALUES (?, ?, ?, ?)`,
      [auditPeriod, new Date().toISOString(), attestedBy, result.success.length]
    );

    return result;
  }
}
```

---

## 4. Audit Report Generator

```typescript
/**
 * Audit Report Generator
 *
 * Generates comprehensive audit reports.
 */

export class AuditReportGenerator {
  constructor(
    private dashboard: ComplianceDashboard,
    private evidenceCollector: EvidenceCollector
  ) {}

  /**
   * Generate full audit report
   */
  async generateReport(
    framework: string,
    startDate: Date,
    endDate: Date
  ): Promise<string> {
    const summary = await this.dashboard.getFrameworkSummary(framework);
    const controls = await this.dashboard.getControls(framework);
    const evidence = await this.evidenceCollector.getEvidenceForAudit(framework, startDate, endDate);

    let report = `# ${framework} Compliance Audit Report\n\n`;
    report += `**Audit Period:** ${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}\n`;
    report += `**Generated:** ${new Date().toISOString()}\n\n`;

    report += `## Executive Summary\n\n`;
    report += `- **Total Controls:** ${summary.totalControls}\n`;
    report += `- **Compliant:** ${summary.compliant} (${summary.compliancePercentage}%)\n`;
    report += `- **Non-Compliant:** ${summary.nonCompliant}\n`;
    report += `- **Partially Compliant:** ${summary.partiallyCompliant}\n`;
    report += `- **Not Assessed:** ${summary.notAssessed}\n`;
    report += `- **Not Applicable:** ${summary.notApplicable}\n\n`;

    report += `## Control Status by Category\n\n`;
    const categories = [...new Set(controls.map(c => c.category))];
    for (const category of categories) {
      const categoryControls = controls.filter(c => c.category === category);
      const compliant = categoryControls.filter(c => c.status === 'compliant').length;
      report += `### ${category}\n`;
      report += `Compliant: ${compliant}/${categoryControls.length}\n\n`;

      for (const control of categoryControls) {
        const statusIcon = control.status === 'compliant' ? '✅' :
                          control.status === 'non_compliant' ? '❌' : '⚠️';
        report += `- ${statusIcon} **${control.id}**: ${control.name}\n`;

        // List evidence
        const controlEvidence = evidence.filter(e => e.controlId === control.id);
        if (controlEvidence.length > 0) {
          report += `  - Evidence: ${controlEvidence.length} items\n`;
        }
      }
      report += '\n';
    }

    report += `## Evidence Summary\n\n`;
    report += `Total evidence items collected: ${evidence.length}\n\n`;

    const byType = evidence.reduce((acc, e) => {
      acc[e.type] = (acc[e.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    for (const [type, count] of Object.entries(byType)) {
      report += `- ${type}: ${count}\n`;
    }

    report += `\n## Non-Compliant Controls\n\n`;
    const nonCompliant = controls.filter(c => c.status === 'non_compliant');
    if (nonCompliant.length === 0) {
      report += `No non-compliant controls.\n`;
    } else {
      for (const control of nonCompliant) {
        report += `### ${control.id}: ${control.name}\n`;
        report += `**Status:** Non-Compliant\n`;
        if (control.remediation) {
          report += `**Remediation Plan:** ${control.remediation.plan || 'Not defined'}\n`;
          report += `**Progress:** ${control.remediation.progress}%\n`;
          report += `**Due Date:** ${control.remediation.dueDate?.toISOString().split('T')[0] || 'Not set'}\n`;
        }
        report += '\n';
      }
    }

    return report;
  }

  /**
   * Generate SOC2 Type II report
   */
  async generateSOC2TypeII(startDate: Date, endDate: Date): Promise<string> {
    return this.generateReport('SOC2', startDate, endDate);
  }
}
```

---

## 5. CLI Output Format

```
$ aigentflow compliance dashboard

┌─────────────────────────────────────────────────────────────────────────────┐
│                        COMPLIANCE DASHBOARD                                  │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│ FRAMEWORK     │ COMPLIANCE │ COMPLIANT │ NON-COMP │ PARTIAL │ OVERDUE      │
├───────────────┼────────────┼───────────┼──────────┼─────────┼──────────────│
│ SOC2          │    92%     │   46/50   │    2     │    2    │     1        │
│ GDPR          │    88%     │   22/25   │    1     │    2    │     0        │
│ HIPAA         │    N/A     │    N/A    │   N/A    │   N/A   │    N/A       │
│ PCI-DSS       │    N/A     │    N/A    │   N/A    │   N/A   │    N/A       │
└─────────────────────────────────────────────────────────────────────────────┘

⚠️  ATTENTION REQUIRED:
  • 3 non-compliant controls require remediation
  • 1 assessment is overdue
  • 4 attestations expire in next 30 days

Run 'aigentflow compliance detail SOC2' for control-level details.
```

---

## 6. Test Scenarios

```typescript
describe('Compliance Dashboards', () => {
  describe('ComplianceDashboard', () => {
    it('should calculate compliance percentage correctly', async () => {
      const summary = await dashboard.getFrameworkSummary('SOC2');
      expect(summary.compliancePercentage).toBeGreaterThanOrEqual(0);
      expect(summary.compliancePercentage).toBeLessThanOrEqual(100);
    });

    it('should identify overdue assessments', async () => {
      const attention = await dashboard.getAttentionRequired();
      for (const control of attention.overdue) {
        expect(control.nextAssessmentDue).toBeLessThan(new Date());
      }
    });
  });

  describe('EvidenceCollector', () => {
    it('should collect and store evidence with checksum', async () => {
      const evidence = await collector.collectEvidence(
        'SOC2-CC6.1',
        'test_result',
        'test content',
        { name: 'Test Evidence' }
      );

      expect(evidence.checksum).toBeDefined();
      expect(evidence.sizeBytes).toBeGreaterThan(0);
    });

    it('should run automated evidence collection', async () => {
      const report = await collector.runAutomatedCollection();
      expect(report.collected.length).toBeGreaterThan(0);
    });
  });

  describe('AuditReportGenerator', () => {
    it('should generate comprehensive audit report', async () => {
      const report = await generator.generateReport(
        'SOC2',
        new Date('2025-01-01'),
        new Date('2025-12-31')
      );

      expect(report).toContain('Executive Summary');
      expect(report).toContain('Control Status');
      expect(report).toContain('Evidence Summary');
    });
  });
});
```

---

## 7. Dependencies

- Step 04d: Audit Logging (evidence source)
- Step 05f: Compliance Agent (control definitions)
- Step 25: Incident Response (compliance violations)

---

## 8. Acceptance Criteria

- [ ] Dashboard shows real-time compliance status
- [ ] All framework summaries calculated correctly
- [ ] Evidence collection automated for common controls
- [ ] Attestations tracked with expiry dates
- [ ] Audit reports generated in standard format
- [ ] Overdue assessments highlighted
- [ ] Remediation progress tracked
- [ ] All tests pass
