# Step 25: Incident Response System

> **Checkpoint:** CP6 - Enterprise Operations
> **Previous Step:** 24-TOURNAMENT-PROMOTION.md
> **Next Step:** 26-GDPR-OPERATIONS.md

---

## Overview

The Incident Response System provides automated detection, classification, and response to security and operational incidents. It integrates with the audit logging and compliance systems to ensure proper handling of events.

Key responsibilities:
- Automated incident detection from audit logs and system events
- Severity classification (P0-P4) with escalation rules
- Runbook execution for known incident types
- Alert routing to appropriate responders
- Post-incident analysis and reporting
- Integration with external alerting systems (PagerDuty, Slack, email)

---

## Deliverables

1. `src/enterprise/incident/detector.ts` - Incident detection engine
2. `src/enterprise/incident/classifier.ts` - Severity classification
3. `src/enterprise/incident/responder.ts` - Automated response executor
4. `src/enterprise/incident/runbooks/` - Incident runbook definitions
5. `orchestrator-data/system/incidents/` - Incident configuration

---

## 1. Incident Detection Engine

### 1.1 Detection Rules Schema

```typescript
/**
 * Incident Detection Rules
 *
 * Defines patterns that trigger incident detection.
 */

import { z } from 'zod';

export const DetectionRuleSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  enabled: z.boolean().default(true),

  // Detection criteria
  detection: z.object({
    source: z.enum(['audit_log', 'system_event', 'metric', 'external']),

    // Pattern matching
    pattern: z.object({
      field: z.string(),
      operator: z.enum(['equals', 'contains', 'regex', 'gt', 'lt', 'in']),
      value: z.union([z.string(), z.number(), z.array(z.string())]),
    }).array(),

    // Threshold for triggering
    threshold: z.object({
      count: z.number(),
      window: z.string(), // "5m", "1h", "24h"
    }).optional(),

    // Correlation rules
    correlate: z.object({
      field: z.string(),
      within: z.string(),
    }).optional(),
  }),

  // Classification
  defaultSeverity: z.enum(['P0', 'P1', 'P2', 'P3', 'P4']),
  category: z.enum([
    'security_breach',
    'data_leak',
    'service_outage',
    'compliance_violation',
    'performance_degradation',
    'authentication_failure',
    'authorization_failure',
    'system_error',
  ]),

  // Response
  runbook: z.string().optional(),
  autoRemediate: z.boolean().default(false),
  notifyChannels: z.array(z.string()),
});

export type DetectionRule = z.infer<typeof DetectionRuleSchema>;
```

### 1.2 Incident Detector Implementation

```typescript
/**
 * Incident Detector
 *
 * Monitors audit logs and system events for incident patterns.
 */

import { EventEmitter } from 'events';
import { DetectionRule } from './schemas';
import { AuditLogger } from '../../persistence/audit-logger';

export interface DetectedIncident {
  id: string;
  ruleId: string;
  ruleName: string;
  severity: 'P0' | 'P1' | 'P2' | 'P3' | 'P4';
  category: string;
  detectedAt: Date;
  source: string;
  triggeringEvents: string[];
  context: Record<string, unknown>;
  status: 'detected' | 'acknowledged' | 'investigating' | 'resolved' | 'closed';
}

export class IncidentDetector extends EventEmitter {
  private rules: DetectionRule[] = [];
  private eventBuffer: Map<string, unknown[]> = new Map();
  private activeIncidents: Map<string, DetectedIncident> = new Map();

  constructor(
    private auditLogger: AuditLogger,
    private config: {
      bufferSize: number;
      checkInterval: number;
    }
  ) {
    super();
    this.startMonitoring();
  }

  /**
   * Load detection rules
   */
  async loadRules(rulesPath: string): Promise<void> {
    // Load from YAML files in orchestrator-data/system/incidents/rules/
  }

  /**
   * Process incoming event
   */
  async processEvent(event: {
    source: string;
    type: string;
    data: Record<string, unknown>;
    timestamp: Date;
  }): Promise<void> {
    // Add to buffer
    const key = `${event.source}:${event.type}`;
    if (!this.eventBuffer.has(key)) {
      this.eventBuffer.set(key, []);
    }
    this.eventBuffer.get(key)!.push(event);

    // Check against rules
    for (const rule of this.rules) {
      if (await this.matchesRule(event, rule)) {
        await this.createIncident(rule, event);
      }
    }
  }

  /**
   * Check if event matches rule
   */
  private async matchesRule(
    event: Record<string, unknown>,
    rule: DetectionRule
  ): Promise<boolean> {
    // Pattern matching logic
    for (const pattern of rule.detection.pattern) {
      const value = this.getNestedValue(event, pattern.field);
      if (!this.matchPattern(value, pattern.operator, pattern.value)) {
        return false;
      }
    }

    // Threshold check
    if (rule.detection.threshold) {
      const count = await this.countMatchingEvents(rule);
      if (count < rule.detection.threshold.count) {
        return false;
      }
    }

    return true;
  }

  /**
   * Create incident from detected pattern
   */
  private async createIncident(
    rule: DetectionRule,
    triggeringEvent: Record<string, unknown>
  ): Promise<DetectedIncident> {
    const incident: DetectedIncident = {
      id: `INC-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      ruleId: rule.id,
      ruleName: rule.name,
      severity: rule.defaultSeverity,
      category: rule.category,
      detectedAt: new Date(),
      source: rule.detection.source,
      triggeringEvents: [JSON.stringify(triggeringEvent)],
      context: {},
      status: 'detected',
    };

    this.activeIncidents.set(incident.id, incident);
    this.emit('incident:detected', incident);

    // Auto-remediate if configured
    if (rule.autoRemediate && rule.runbook) {
      await this.executeRunbook(incident, rule.runbook);
    }

    // Send notifications
    await this.notify(incident, rule.notifyChannels);

    return incident;
  }

  /**
   * Execute runbook for incident
   */
  private async executeRunbook(
    incident: DetectedIncident,
    runbookId: string
  ): Promise<void> {
    // Load and execute runbook
    this.emit('runbook:executing', { incident, runbookId });
  }

  /**
   * Send notifications
   */
  private async notify(
    incident: DetectedIncident,
    channels: string[]
  ): Promise<void> {
    for (const channel of channels) {
      this.emit('notification:send', { incident, channel });
    }
  }

  private startMonitoring(): void {
    // Subscribe to audit log events
    // Poll for new events at configured interval
  }

  private getNestedValue(obj: Record<string, unknown>, path: string): unknown {
    return path.split('.').reduce((o, k) => (o as any)?.[k], obj);
  }

  private matchPattern(
    value: unknown,
    operator: string,
    pattern: unknown
  ): boolean {
    switch (operator) {
      case 'equals': return value === pattern;
      case 'contains': return String(value).includes(String(pattern));
      case 'regex': return new RegExp(String(pattern)).test(String(value));
      case 'gt': return Number(value) > Number(pattern);
      case 'lt': return Number(value) < Number(pattern);
      case 'in': return (pattern as unknown[]).includes(value);
      default: return false;
    }
  }

  private async countMatchingEvents(rule: DetectionRule): Promise<number> {
    // Count events matching rule in threshold window
    return 0;
  }
}
```

---

## 2. Severity Classification

### 2.1 Severity Levels

```yaml
# orchestrator-data/system/incidents/severity-levels.yaml
severity_levels:
  P0:
    name: "Critical"
    description: "Complete service outage or active security breach"
    response_time: "15 minutes"
    escalation_time: "30 minutes"
    notifications:
      - pagerduty_critical
      - slack_incidents
      - email_oncall
    requires:
      - immediate_response
      - executive_notification
      - war_room
    examples:
      - "Production database compromised"
      - "Customer data exfiltration detected"
      - "Complete service unavailable"

  P1:
    name: "High"
    description: "Major feature unavailable or high-risk security event"
    response_time: "1 hour"
    escalation_time: "2 hours"
    notifications:
      - pagerduty_high
      - slack_incidents
    requires:
      - dedicated_responder
    examples:
      - "Authentication service degraded"
      - "Suspicious admin activity"
      - "API rate limiting affecting customers"

  P2:
    name: "Medium"
    description: "Minor feature degradation or potential security issue"
    response_time: "4 hours"
    escalation_time: "8 hours"
    notifications:
      - slack_incidents
    examples:
      - "Non-critical service slow"
      - "Failed login spike detected"
      - "Disk usage warning"

  P3:
    name: "Low"
    description: "Cosmetic issues or informational security events"
    response_time: "24 hours"
    escalation_time: "48 hours"
    notifications:
      - slack_alerts
    examples:
      - "Minor UI bug reported"
      - "Routine security scan findings"

  P4:
    name: "Informational"
    description: "For tracking purposes only"
    response_time: "Best effort"
    escalation_time: "None"
    notifications:
      - email_daily_digest
```

### 2.2 Classification Logic

```typescript
/**
 * Incident Classifier
 *
 * Determines severity based on context and impact.
 */

export interface ClassificationContext {
  affectedUsers: number;
  affectedRevenue: number;
  dataAtRisk: boolean;
  serviceAvailability: number; // 0-100%
  complianceImpact: boolean;
  securityBreach: boolean;
  previousIncidents: number; // Related incidents in last 24h
}

export class IncidentClassifier {
  /**
   * Classify incident severity based on context
   */
  classify(
    baseRuleSeverity: string,
    context: ClassificationContext
  ): 'P0' | 'P1' | 'P2' | 'P3' | 'P4' {
    let severity = this.severityToNumber(baseRuleSeverity);

    // Escalate for data breach
    if (context.securityBreach || context.dataAtRisk) {
      severity = Math.max(severity, 4); // At least P1
    }

    // Escalate for compliance impact
    if (context.complianceImpact) {
      severity = Math.max(severity, 4); // At least P1
    }

    // Escalate for service outage
    if (context.serviceAvailability < 50) {
      severity = 5; // P0
    } else if (context.serviceAvailability < 80) {
      severity = Math.max(severity, 4); // At least P1
    }

    // Escalate for high user impact
    if (context.affectedUsers > 1000) {
      severity = Math.max(severity, 4);
    }
    if (context.affectedUsers > 10000) {
      severity = 5;
    }

    // Escalate for recurring incidents
    if (context.previousIncidents > 3) {
      severity = Math.min(5, severity + 1);
    }

    return this.numberToSeverity(severity);
  }

  private severityToNumber(s: string): number {
    const map: Record<string, number> = { P0: 5, P1: 4, P2: 3, P3: 2, P4: 1 };
    return map[s] || 1;
  }

  private numberToSeverity(n: number): 'P0' | 'P1' | 'P2' | 'P3' | 'P4' {
    if (n >= 5) return 'P0';
    if (n >= 4) return 'P1';
    if (n >= 3) return 'P2';
    if (n >= 2) return 'P3';
    return 'P4';
  }
}
```

---

## 3. Runbook System

### 3.1 Runbook Schema

```yaml
# orchestrator-data/system/incidents/runbooks/secret-exposure.yaml
runbook:
  id: "runbook-secret-exposure"
  name: "Secret Exposure Response"
  description: "Automated response to detected secret exposure"
  category: "security_breach"

  triggers:
    - "secret_detected_in_commit"
    - "secret_detected_in_output"

  steps:
    - id: "step-1"
      name: "Block offending commit"
      type: "automated"
      action: "git_revert"
      parameters:
        commit: "{{incident.context.commit_sha}}"
      on_failure: "continue"

    - id: "step-2"
      name: "Revoke exposed credential"
      type: "automated"
      action: "revoke_credential"
      parameters:
        credential_type: "{{incident.context.secret_type}}"
        credential_id: "{{incident.context.secret_id}}"
      on_failure: "escalate"

    - id: "step-3"
      name: "Generate new credential"
      type: "manual"
      instructions: |
        1. Log into {{incident.context.service}}
        2. Navigate to API credentials
        3. Generate new credential
        4. Update secrets manager
      assignee: "security_team"

    - id: "step-4"
      name: "Scan for credential usage"
      type: "automated"
      action: "credential_scan"
      parameters:
        credential_pattern: "{{incident.context.secret_pattern}}"
        scope: "all_repos"

    - id: "step-5"
      name: "Notify affected parties"
      type: "automated"
      action: "notify"
      parameters:
        template: "secret_exposure_notification"
        recipients:
          - "security_team"
          - "affected_project_owner"

    - id: "step-6"
      name: "Create audit record"
      type: "automated"
      action: "create_audit_record"
      parameters:
        incident_id: "{{incident.id}}"
        actions_taken: "{{runbook.completed_steps}}"

  completion:
    auto_close: false
    require_review: true
    reviewers: ["security_lead"]
```

---

## 4. Alert Routing

### 4.1 Notification Channels

```typescript
/**
 * Alert Router
 *
 * Routes incident notifications to appropriate channels.
 */

export interface NotificationChannel {
  id: string;
  type: 'pagerduty' | 'slack' | 'email' | 'webhook' | 'sms';
  config: Record<string, string>;
  filters: {
    minSeverity?: string;
    categories?: string[];
  };
}

export class AlertRouter {
  private channels: Map<string, NotificationChannel> = new Map();

  /**
   * Send alert to configured channels
   */
  async route(incident: DetectedIncident, channelIds: string[]): Promise<void> {
    const notifications = channelIds.map(async (channelId) => {
      const channel = this.channels.get(channelId);
      if (!channel) return;

      // Check filters
      if (!this.passesFilters(incident, channel.filters)) return;

      // Format message for channel
      const message = this.formatMessage(incident, channel.type);

      // Send via appropriate handler
      await this.send(channel, message);
    });

    await Promise.all(notifications);
  }

  private formatMessage(incident: DetectedIncident, type: string): string {
    const base = `[${incident.severity}] ${incident.ruleName}\n` +
                 `Category: ${incident.category}\n` +
                 `Detected: ${incident.detectedAt.toISOString()}\n` +
                 `ID: ${incident.id}`;

    switch (type) {
      case 'slack':
        return this.formatSlack(incident);
      case 'pagerduty':
        return this.formatPagerDuty(incident);
      default:
        return base;
    }
  }

  private formatSlack(incident: DetectedIncident): string {
    return JSON.stringify({
      blocks: [
        {
          type: 'header',
          text: { type: 'plain_text', text: `🚨 ${incident.severity} Incident` }
        },
        {
          type: 'section',
          fields: [
            { type: 'mrkdwn', text: `*Rule:*\n${incident.ruleName}` },
            { type: 'mrkdwn', text: `*Category:*\n${incident.category}` },
            { type: 'mrkdwn', text: `*Status:*\n${incident.status}` },
            { type: 'mrkdwn', text: `*ID:*\n${incident.id}` },
          ]
        }
      ]
    });
  }

  private formatPagerDuty(incident: DetectedIncident): string {
    return JSON.stringify({
      routing_key: '{{PAGERDUTY_ROUTING_KEY}}',
      event_action: 'trigger',
      dedup_key: incident.id,
      payload: {
        summary: `[${incident.severity}] ${incident.ruleName}`,
        severity: incident.severity === 'P0' ? 'critical' : 'warning',
        source: 'aigentflow',
        custom_details: incident.context,
      }
    });
  }

  private passesFilters(
    incident: DetectedIncident,
    filters: NotificationChannel['filters']
  ): boolean {
    if (filters.minSeverity) {
      const severityOrder = ['P4', 'P3', 'P2', 'P1', 'P0'];
      const minIdx = severityOrder.indexOf(filters.minSeverity);
      const incidentIdx = severityOrder.indexOf(incident.severity);
      if (incidentIdx < minIdx) return false;
    }

    if (filters.categories && !filters.categories.includes(incident.category)) {
      return false;
    }

    return true;
  }

  private async send(channel: NotificationChannel, message: string): Promise<void> {
    // Implement channel-specific sending
  }
}
```

---

## 5. Built-in Detection Rules

```yaml
# orchestrator-data/system/incidents/rules/security.yaml
rules:
  - id: "rule-secret-in-output"
    name: "Secret Detected in Agent Output"
    description: "Agent output contains potential credentials"
    enabled: true
    detection:
      source: "audit_log"
      pattern:
        - field: "action"
          operator: "equals"
          value: "secret_detected"
    defaultSeverity: "P1"
    category: "data_leak"
    runbook: "runbook-secret-exposure"
    autoRemediate: true
    notifyChannels: ["slack_security", "email_security"]

  - id: "rule-auth-brute-force"
    name: "Authentication Brute Force Attempt"
    description: "Multiple failed authentication attempts detected"
    enabled: true
    detection:
      source: "audit_log"
      pattern:
        - field: "action"
          operator: "equals"
          value: "authentication_failed"
      threshold:
        count: 10
        window: "5m"
      correlate:
        field: "actor.ip"
        within: "5m"
    defaultSeverity: "P2"
    category: "authentication_failure"
    notifyChannels: ["slack_security"]

  - id: "rule-unauthorized-access"
    name: "Unauthorized Resource Access"
    description: "Access to restricted resource denied"
    enabled: true
    detection:
      source: "audit_log"
      pattern:
        - field: "action"
          operator: "equals"
          value: "authorization_denied"
        - field: "target.sensitivity"
          operator: "in"
          value: ["critical", "restricted"]
    defaultSeverity: "P1"
    category: "authorization_failure"
    notifyChannels: ["slack_security", "pagerduty_high"]

  - id: "rule-compliance-violation"
    name: "Compliance Control Violation"
    description: "Compliance control check failed"
    enabled: true
    detection:
      source: "audit_log"
      pattern:
        - field: "category"
          operator: "equals"
          value: "compliance_event"
        - field: "outcome"
          operator: "equals"
          value: "violation"
    defaultSeverity: "P1"
    category: "compliance_violation"
    notifyChannels: ["slack_compliance", "email_compliance"]
```

---

## 6. Test Scenarios

### Unit Tests

```typescript
describe('IncidentDetector', () => {
  it('should detect secret in output', async () => {
    const detector = new IncidentDetector(mockAuditLogger, config);
    await detector.loadRules('./rules');

    await detector.processEvent({
      source: 'audit_log',
      type: 'secret_detected',
      data: { action: 'secret_detected', secretType: 'api_key' },
      timestamp: new Date(),
    });

    expect(detector.activeIncidents.size).toBe(1);
  });

  it('should classify P0 for data breach', () => {
    const classifier = new IncidentClassifier();
    const severity = classifier.classify('P2', {
      affectedUsers: 100,
      affectedRevenue: 0,
      dataAtRisk: true,
      serviceAvailability: 100,
      complianceImpact: true,
      securityBreach: true,
      previousIncidents: 0,
    });

    expect(severity).toBe('P0');
  });

  it('should execute runbook steps in order', async () => {
    // Test runbook execution
  });

  it('should route alerts to correct channels', async () => {
    // Test alert routing
  });
});
```

---

## 7. Dependencies

- Step 04d: Audit Logging (event source)
- Step 05f: Compliance Agent (violation detection)
- External: PagerDuty API, Slack API

---

## 8. Acceptance Criteria

- [ ] Detection rules load from YAML configuration
- [ ] Events are processed and matched against rules
- [ ] Incidents are created with correct severity
- [ ] Runbooks execute automated steps
- [ ] Alerts route to configured channels
- [ ] P0/P1 incidents escalate within SLA
- [ ] Incident lifecycle tracked (detected → resolved)
- [ ] All tests pass
