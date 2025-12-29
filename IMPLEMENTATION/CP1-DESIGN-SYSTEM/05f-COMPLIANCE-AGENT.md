# Step 05f: Compliance Agent

> **Checkpoint:** CP1 - Design System
> **Previous Step:** 05e-PROJECT-ANALYZER-AGENT.md
> **Next Step:** 06-UI-DESIGNER-AGENT.md

---

## Overview

The **Compliance Agent** ensures platform and project compliance at all times. It implements a two-tier compliance model: platform compliance (always active) and project compliance (user-configured).

Key responsibilities:
- Monitor platform compliance (audit logs, encryption, access control)
- Enforce project-specific compliance requirements (GDPR, SOC2, HIPAA, PCI-DSS)
- Scan code changes for compliance violations
- Advise other agents on compliance requirements
- Generate compliance reports

---

## Deliverables

1. `src/agents/agents/compliance-agent.ts` - Compliance agent implementation
2. `src/agents/schemas/compliance-output.ts` - Output schema
3. `src/compliance/compliance-engine.ts` - Compliance rule engine
4. `src/compliance/rules/` - Compliance rule definitions

---

## Two-Tier Compliance Model

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        TWO-TIER COMPLIANCE MODEL                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                     TIER 1: PLATFORM COMPLIANCE                      │    │
│  │                        (Always Active)                               │    │
│  │                                                                      │    │
│  │  • Audit log completeness                                           │    │
│  │  • Encryption for sensitive data                                    │    │
│  │  • Access control enforcement                                       │    │
│  │  • Secret exposure prevention                                       │    │
│  │  • Secure defaults                                                  │    │
│  │                                                                      │    │
│  │  Status: MANDATORY - Cannot be disabled                             │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                    TIER 2: PROJECT COMPLIANCE                        │    │
│  │                    (User Configured)                                 │    │
│  │                                                                      │    │
│  │  GDPR:                          SOC2:                               │    │
│  │  • Data minimization            • Change management                 │    │
│  │  • Consent tracking             • Access controls                   │    │
│  │  • Right to deletion            • System monitoring                 │    │
│  │  • Data portability             • Risk assessment                   │    │
│  │                                                                      │    │
│  │  HIPAA:                         PCI-DSS:                            │    │
│  │  • PHI protection               • Cardholder data protection        │    │
│  │  • Access logging               • Encryption requirements           │    │
│  │  • Minimum necessary            • Access restrictions               │    │
│  │                                                                      │    │
│  │  Status: OPTIONAL - Enabled per project                             │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 1. Output Schema (`src/agents/schemas/compliance-output.ts`)

```typescript
/**
 * Compliance Agent Output Schema
 */

import { z } from 'zod';
import { AgentType } from '../types';

/**
 * Compliance framework types
 */
export const ComplianceFrameworkSchema = z.enum([
  'platform',  // Built-in platform compliance
  'gdpr',
  'soc2',
  'hipaa',
  'pci-dss',
  'iso27001',
  'ccpa',
  'custom',
]);

export type ComplianceFramework = z.infer<typeof ComplianceFrameworkSchema>;

/**
 * Violation severity
 */
export const ViolationSeveritySchema = z.enum([
  'critical',  // Must be fixed immediately
  'high',      // Should be fixed before release
  'medium',    // Should be addressed
  'low',       // Nice to fix
  'info',      // Informational
]);

export type ViolationSeverity = z.infer<typeof ViolationSeveritySchema>;

/**
 * Compliance violation
 */
export const ViolationSchema = z.object({
  id: z.string(),
  framework: ComplianceFrameworkSchema,
  rule: z.string(),
  severity: ViolationSeveritySchema,
  title: z.string(),
  description: z.string(),
  location: z.object({
    file: z.string(),
    line: z.number().optional(),
    column: z.number().optional(),
    code: z.string().optional(),
  }).optional(),
  remediation: z.string(),
  references: z.array(z.string()),
  autoFixable: z.boolean(),
  fixCode: z.string().optional(),
});

export type Violation = z.infer<typeof ViolationSchema>;

/**
 * Compliance check result
 */
export const CheckResultSchema = z.object({
  rule: z.string(),
  framework: ComplianceFrameworkSchema,
  passed: z.boolean(),
  message: z.string(),
  details: z.string().optional(),
});

export type CheckResult = z.infer<typeof CheckResultSchema>;

/**
 * Data handling assessment
 */
export const DataHandlingSchema = z.object({
  dataTypes: z.array(z.object({
    type: z.string(),
    sensitivity: z.enum(['public', 'internal', 'confidential', 'restricted']),
    locations: z.array(z.string()),
    protection: z.array(z.string()),
  })),
  dataFlows: z.array(z.object({
    from: z.string(),
    to: z.string(),
    dataType: z.string(),
    encrypted: z.boolean(),
    logged: z.boolean(),
  })),
  retentionPolicies: z.array(z.object({
    dataType: z.string(),
    period: z.string(),
    implemented: z.boolean(),
  })),
});

export type DataHandling = z.infer<typeof DataHandlingSchema>;

/**
 * Security assessment
 */
export const SecurityAssessmentSchema = z.object({
  authentication: z.object({
    implemented: z.boolean(),
    methods: z.array(z.string()),
    mfaAvailable: z.boolean(),
    sessionManagement: z.boolean(),
  }),
  authorization: z.object({
    implemented: z.boolean(),
    model: z.string(), // RBAC, ABAC, etc.
    granularity: z.string(),
  }),
  encryption: z.object({
    atRest: z.boolean(),
    inTransit: z.boolean(),
    algorithms: z.array(z.string()),
  }),
  secretManagement: z.object({
    noHardcodedSecrets: z.boolean(),
    secretsManager: z.string().optional(),
    rotation: z.boolean(),
  }),
});

export type SecurityAssessment = z.infer<typeof SecurityAssessmentSchema>;

/**
 * Compliance recommendation
 */
export const ComplianceRecommendationSchema = z.object({
  framework: ComplianceFrameworkSchema,
  priority: ViolationSeveritySchema,
  title: z.string(),
  description: z.string(),
  implementation: z.array(z.string()),
  effort: z.enum(['minimal', 'moderate', 'significant']),
});

export type ComplianceRecommendation = z.infer<typeof ComplianceRecommendationSchema>;

/**
 * Compliance score
 */
export const ComplianceScoreSchema = z.object({
  framework: ComplianceFrameworkSchema,
  score: z.number().min(0).max(100),
  passed: z.number(),
  failed: z.number(),
  notApplicable: z.number(),
});

export type ComplianceScore = z.infer<typeof ComplianceScoreSchema>;

/**
 * Complete compliance output
 */
export const ComplianceOutputSchema = z.object({
  scanType: z.enum(['full', 'incremental', 'targeted']),
  timestamp: z.string(),

  // Active frameworks
  activeFrameworks: z.array(ComplianceFrameworkSchema),

  // Violations found
  violations: z.array(ViolationSchema),

  // Check results
  checkResults: z.array(CheckResultSchema),

  // Scores by framework
  scores: z.array(ComplianceScoreSchema),

  // Data handling assessment
  dataHandling: DataHandlingSchema.optional(),

  // Security assessment
  security: SecurityAssessmentSchema.optional(),

  // Recommendations
  recommendations: z.array(ComplianceRecommendationSchema),

  // Summary
  summary: z.object({
    overallStatus: z.enum(['compliant', 'non-compliant', 'needs-attention']),
    criticalViolations: z.number(),
    highViolations: z.number(),
    totalViolations: z.number(),
    averageScore: z.number(),
  }),

  routingHints: z.object({
    suggestNext: z.array(z.nativeEnum(AgentType)),
    skipAgents: z.array(z.nativeEnum(AgentType)),
    needsApproval: z.boolean(),
    hasFailures: z.boolean(),
    isComplete: z.boolean(),
    blockingViolations: z.boolean(),
  }),
});

export type ComplianceOutput = z.infer<typeof ComplianceOutputSchema>;
```

---

## 2. Compliance Engine (`src/compliance/compliance-engine.ts`)

```typescript
/**
 * Compliance Engine
 *
 * Core engine for evaluating compliance rules.
 */

import {
  ComplianceFramework,
  Violation,
  CheckResult,
  ViolationSeverity,
} from '../agents/schemas/compliance-output';
import { logger } from '../utils/logger';
import fs from 'fs';
import path from 'path';

/**
 * Compliance rule definition
 */
export interface ComplianceRule {
  id: string;
  framework: ComplianceFramework;
  title: string;
  description: string;
  severity: ViolationSeverity;
  check: (context: RuleContext) => Promise<RuleResult>;
  remediation: string;
  references: string[];
  autoFix?: (context: RuleContext) => Promise<string>;
}

/**
 * Rule evaluation context
 */
export interface RuleContext {
  projectRoot: string;
  changedFiles?: string[];
  config: ProjectComplianceConfig;
  codeContent?: Map<string, string>;
}

/**
 * Rule evaluation result
 */
export interface RuleResult {
  passed: boolean;
  message: string;
  violations?: Array<{
    file: string;
    line?: number;
    code?: string;
    details: string;
  }>;
}

/**
 * Project compliance configuration
 */
export interface ProjectComplianceConfig {
  frameworks: ComplianceFramework[];
  customRules?: ComplianceRule[];
  exclusions?: {
    files?: string[];
    rules?: string[];
  };
  dataClassification?: Record<string, string>;
}

/**
 * Compliance Engine class
 */
export class ComplianceEngine {
  private rules: Map<string, ComplianceRule> = new Map();
  private platformRules: ComplianceRule[] = [];
  private frameworkRules: Map<ComplianceFramework, ComplianceRule[]> = new Map();

  constructor() {
    this.initializePlatformRules();
    this.initializeFrameworkRules();
  }

  /**
   * Initialize mandatory platform compliance rules
   */
  private initializePlatformRules(): void {
    this.platformRules = [
      // No hardcoded secrets
      {
        id: 'platform-001',
        framework: 'platform',
        title: 'No hardcoded secrets',
        description: 'Secrets must not be hardcoded in source files',
        severity: 'critical',
        check: async (ctx) => this.checkHardcodedSecrets(ctx),
        remediation: 'Move secrets to environment variables or a secrets manager',
        references: ['https://owasp.org/www-community/vulnerabilities/Use_of_hard-coded_password'],
      },

      // Audit logging required
      {
        id: 'platform-002',
        framework: 'platform',
        title: 'Audit logging implemented',
        description: 'Security-relevant actions must be logged',
        severity: 'high',
        check: async (ctx) => this.checkAuditLogging(ctx),
        remediation: 'Implement audit logging for authentication, authorization, and data access',
        references: [],
      },

      // Input validation
      {
        id: 'platform-003',
        framework: 'platform',
        title: 'Input validation present',
        description: 'User inputs must be validated',
        severity: 'high',
        check: async (ctx) => this.checkInputValidation(ctx),
        remediation: 'Add input validation using a schema validation library',
        references: ['https://owasp.org/www-community/Input_Validation'],
      },

      // HTTPS enforcement
      {
        id: 'platform-004',
        framework: 'platform',
        title: 'HTTPS enforced',
        description: 'All network communication must use HTTPS',
        severity: 'critical',
        check: async (ctx) => this.checkHttpsEnforcement(ctx),
        remediation: 'Ensure all URLs use HTTPS and redirect HTTP to HTTPS',
        references: [],
      },
    ];

    // Register platform rules
    for (const rule of this.platformRules) {
      this.rules.set(rule.id, rule);
    }
  }

  /**
   * Initialize framework-specific rules
   */
  private initializeFrameworkRules(): void {
    // GDPR rules
    const gdprRules: ComplianceRule[] = [
      {
        id: 'gdpr-001',
        framework: 'gdpr',
        title: 'Data minimization',
        description: 'Only collect data that is necessary',
        severity: 'medium',
        check: async (ctx) => ({ passed: true, message: 'Manual review required' }),
        remediation: 'Review data collection points and remove unnecessary fields',
        references: ['https://gdpr.eu/article-5-how-to-process-personal-data/'],
      },
      {
        id: 'gdpr-002',
        framework: 'gdpr',
        title: 'Consent mechanism',
        description: 'User consent must be obtained for data processing',
        severity: 'high',
        check: async (ctx) => this.checkConsentMechanism(ctx),
        remediation: 'Implement consent tracking and management',
        references: ['https://gdpr.eu/article-7-how-to-get-consent-to-process-data/'],
      },
      {
        id: 'gdpr-003',
        framework: 'gdpr',
        title: 'Right to deletion',
        description: 'Users must be able to request data deletion',
        severity: 'high',
        check: async (ctx) => this.checkDeletionCapability(ctx),
        remediation: 'Implement data deletion API and process',
        references: ['https://gdpr.eu/article-17-right-to-be-forgotten/'],
      },
    ];

    this.frameworkRules.set('gdpr', gdprRules);
    gdprRules.forEach(r => this.rules.set(r.id, r));

    // SOC2 rules
    const soc2Rules: ComplianceRule[] = [
      {
        id: 'soc2-001',
        framework: 'soc2',
        title: 'Access control',
        description: 'Implement role-based access control',
        severity: 'high',
        check: async (ctx) => this.checkAccessControl(ctx),
        remediation: 'Implement RBAC or ABAC',
        references: [],
      },
      {
        id: 'soc2-002',
        framework: 'soc2',
        title: 'Change management',
        description: 'All changes must be tracked and reviewed',
        severity: 'medium',
        check: async (ctx) => this.checkChangeManagement(ctx),
        remediation: 'Use version control and code review process',
        references: [],
      },
    ];

    this.frameworkRules.set('soc2', soc2Rules);
    soc2Rules.forEach(r => this.rules.set(r.id, r));

    // PCI-DSS rules
    const pciRules: ComplianceRule[] = [
      {
        id: 'pci-001',
        framework: 'pci-dss',
        title: 'No card data storage',
        description: 'Do not store full card numbers',
        severity: 'critical',
        check: async (ctx) => this.checkCardDataStorage(ctx),
        remediation: 'Use tokenization for card data',
        references: ['https://www.pcisecuritystandards.org/'],
      },
      {
        id: 'pci-002',
        framework: 'pci-dss',
        title: 'Encryption of card data',
        description: 'Card data must be encrypted',
        severity: 'critical',
        check: async (ctx) => ({ passed: true, message: 'Manual review required' }),
        remediation: 'Encrypt all card data at rest and in transit',
        references: [],
      },
    ];

    this.frameworkRules.set('pci-dss', pciRules);
    pciRules.forEach(r => this.rules.set(r.id, r));
  }

  /**
   * Run compliance checks
   */
  async evaluate(context: RuleContext): Promise<{
    results: CheckResult[];
    violations: Violation[];
  }> {
    const results: CheckResult[] = [];
    const violations: Violation[] = [];

    // Always run platform rules
    for (const rule of this.platformRules) {
      if (this.isExcluded(rule.id, context.config)) continue;

      try {
        const result = await rule.check(context);
        results.push({
          rule: rule.id,
          framework: rule.framework,
          passed: result.passed,
          message: result.message,
        });

        if (!result.passed && result.violations) {
          for (const v of result.violations) {
            violations.push({
              id: `${rule.id}-${violations.length}`,
              framework: rule.framework,
              rule: rule.id,
              severity: rule.severity,
              title: rule.title,
              description: v.details,
              location: {
                file: v.file,
                line: v.line,
                code: v.code,
              },
              remediation: rule.remediation,
              references: rule.references,
              autoFixable: !!rule.autoFix,
            });
          }
        }
      } catch (error) {
        logger.error(`Rule ${rule.id} failed:`, error);
      }
    }

    // Run framework-specific rules
    for (const framework of context.config.frameworks) {
      const rules = this.frameworkRules.get(framework) || [];

      for (const rule of rules) {
        if (this.isExcluded(rule.id, context.config)) continue;

        try {
          const result = await rule.check(context);
          results.push({
            rule: rule.id,
            framework: rule.framework,
            passed: result.passed,
            message: result.message,
          });

          if (!result.passed && result.violations) {
            for (const v of result.violations) {
              violations.push({
                id: `${rule.id}-${violations.length}`,
                framework: rule.framework,
                rule: rule.id,
                severity: rule.severity,
                title: rule.title,
                description: v.details,
                location: {
                  file: v.file,
                  line: v.line,
                  code: v.code,
                },
                remediation: rule.remediation,
                references: rule.references,
                autoFixable: !!rule.autoFix,
              });
            }
          }
        } catch (error) {
          logger.error(`Rule ${rule.id} failed:`, error);
        }
      }
    }

    return { results, violations };
  }

  /**
   * Check if a rule is excluded
   */
  private isExcluded(ruleId: string, config: ProjectComplianceConfig): boolean {
    return config.exclusions?.rules?.includes(ruleId) || false;
  }

  // ═══════════════════════════════════════════════════════════════════
  // Rule Implementations
  // ═══════════════════════════════════════════════════════════════════

  private async checkHardcodedSecrets(ctx: RuleContext): Promise<RuleResult> {
    const violations: RuleResult['violations'] = [];
    const secretPatterns = [
      /api[_-]?key\s*[=:]\s*['"][^'"]{20,}['"]/gi,
      /password\s*[=:]\s*['"][^'"]+['"]/gi,
      /secret\s*[=:]\s*['"][^'"]{16,}['"]/gi,
      /AKIA[0-9A-Z]{16}/g, // AWS access key
    ];

    this.walkSourceFiles(ctx.projectRoot, (file, content) => {
      const lines = content.split('\n');
      lines.forEach((line, i) => {
        for (const pattern of secretPatterns) {
          if (pattern.test(line)) {
            violations.push({
              file,
              line: i + 1,
              code: line.trim().substring(0, 100),
              details: 'Potential hardcoded secret detected',
            });
          }
        }
      });
    });

    return {
      passed: violations.length === 0,
      message: violations.length === 0
        ? 'No hardcoded secrets detected'
        : `Found ${violations.length} potential secrets`,
      violations,
    };
  }

  private async checkAuditLogging(ctx: RuleContext): Promise<RuleResult> {
    let hasAuditLog = false;

    this.walkSourceFiles(ctx.projectRoot, (file, content) => {
      if (content.includes('audit') || content.includes('logger')) {
        hasAuditLog = true;
      }
    });

    return {
      passed: hasAuditLog,
      message: hasAuditLog ? 'Audit logging detected' : 'No audit logging found',
    };
  }

  private async checkInputValidation(ctx: RuleContext): Promise<RuleResult> {
    let hasValidation = false;
    const validationIndicators = ['zod', 'yup', 'joi', 'validator', 'class-validator'];

    // Check package.json
    const pkgPath = path.join(ctx.projectRoot, 'package.json');
    if (fs.existsSync(pkgPath)) {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
      const deps = { ...pkg.dependencies, ...pkg.devDependencies };

      for (const indicator of validationIndicators) {
        if (deps[indicator]) {
          hasValidation = true;
          break;
        }
      }
    }

    return {
      passed: hasValidation,
      message: hasValidation
        ? 'Input validation library detected'
        : 'No input validation library found',
    };
  }

  private async checkHttpsEnforcement(ctx: RuleContext): Promise<RuleResult> {
    const violations: RuleResult['violations'] = [];

    this.walkSourceFiles(ctx.projectRoot, (file, content) => {
      const lines = content.split('\n');
      lines.forEach((line, i) => {
        if (line.includes('http://') && !line.includes('localhost') && !line.includes('127.0.0.1')) {
          violations.push({
            file,
            line: i + 1,
            code: line.trim(),
            details: 'Non-HTTPS URL detected',
          });
        }
      });
    });

    return {
      passed: violations.length === 0,
      message: violations.length === 0
        ? 'No insecure URLs detected'
        : `Found ${violations.length} insecure URLs`,
      violations,
    };
  }

  private async checkConsentMechanism(ctx: RuleContext): Promise<RuleResult> {
    let hasConsent = false;

    this.walkSourceFiles(ctx.projectRoot, (file, content) => {
      if (content.includes('consent') || content.includes('gdpr')) {
        hasConsent = true;
      }
    });

    return {
      passed: hasConsent,
      message: hasConsent
        ? 'Consent mechanism indicators found'
        : 'No consent mechanism detected - manual review required',
    };
  }

  private async checkDeletionCapability(ctx: RuleContext): Promise<RuleResult> {
    let hasDeletion = false;

    this.walkSourceFiles(ctx.projectRoot, (file, content) => {
      if (content.includes('DELETE') || content.includes('deleteUser') || content.includes('removeData')) {
        hasDeletion = true;
      }
    });

    return {
      passed: hasDeletion,
      message: hasDeletion
        ? 'Data deletion capability detected'
        : 'No data deletion API found',
    };
  }

  private async checkAccessControl(ctx: RuleContext): Promise<RuleResult> {
    let hasAccessControl = false;
    const indicators = ['rbac', 'permission', 'authorize', 'canAccess', 'hasRole'];

    this.walkSourceFiles(ctx.projectRoot, (file, content) => {
      const lower = content.toLowerCase();
      for (const indicator of indicators) {
        if (lower.includes(indicator)) {
          hasAccessControl = true;
          break;
        }
      }
    });

    return {
      passed: hasAccessControl,
      message: hasAccessControl
        ? 'Access control mechanism detected'
        : 'No access control mechanism found',
    };
  }

  private async checkChangeManagement(ctx: RuleContext): Promise<RuleResult> {
    const hasGit = fs.existsSync(path.join(ctx.projectRoot, '.git'));
    const hasCI = fs.existsSync(path.join(ctx.projectRoot, '.github', 'workflows')) ||
                  fs.existsSync(path.join(ctx.projectRoot, '.gitlab-ci.yml'));

    return {
      passed: hasGit && hasCI,
      message: hasGit && hasCI
        ? 'Version control and CI/CD detected'
        : 'Missing version control or CI/CD',
    };
  }

  private async checkCardDataStorage(ctx: RuleContext): Promise<RuleResult> {
    const violations: RuleResult['violations'] = [];
    const cardPatterns = [
      /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g,
      /card[_-]?number/gi,
      /creditCard/gi,
    ];

    this.walkSourceFiles(ctx.projectRoot, (file, content) => {
      const lines = content.split('\n');
      lines.forEach((line, i) => {
        for (const pattern of cardPatterns) {
          if (pattern.test(line)) {
            violations.push({
              file,
              line: i + 1,
              code: line.trim().substring(0, 100),
              details: 'Potential card data storage detected',
            });
          }
        }
      });
    });

    return {
      passed: violations.length === 0,
      message: violations.length === 0
        ? 'No card data storage detected'
        : `Found ${violations.length} potential card data references`,
      violations,
    };
  }

  /**
   * Walk source files in project
   */
  private walkSourceFiles(
    dir: string,
    callback: (file: string, content: string) => void
  ): void {
    if (!fs.existsSync(dir)) return;

    const extensions = ['.ts', '.tsx', '.js', '.jsx', '.py', '.go', '.java'];

    const walk = (currentDir: string) => {
      const entries = fs.readdirSync(currentDir, { withFileTypes: true });

      for (const entry of entries) {
        if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;

        const fullPath = path.join(currentDir, entry.name);

        if (entry.isDirectory()) {
          walk(fullPath);
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name);
          if (extensions.includes(ext)) {
            try {
              const content = fs.readFileSync(fullPath, 'utf-8');
              callback(fullPath, content);
            } catch {
              // Skip files that can't be read
            }
          }
        }
      }
    };

    walk(dir);
  }
}
```

---

## 3. Compliance Agent (`src/agents/agents/compliance-agent.ts`)

```typescript
/**
 * Compliance Agent
 *
 * Ensures platform and project compliance.
 */

import { BaseAgent } from '../base-agent';
import {
  AgentMetadata,
  AgentContext,
  AgentRequest,
  RoutingHints,
  Artifact,
  AgentType,
} from '../types';
import {
  ComplianceOutput,
  ComplianceScore,
  ComplianceFramework,
} from '../schemas/compliance-output';
import { ComplianceEngine, ProjectComplianceConfig } from '../../compliance/compliance-engine';
import { logger } from '../../utils/logger';

/**
 * Compliance Agent implementation
 */
export class ComplianceAgent extends BaseAgent {
  private engine: ComplianceEngine;

  constructor() {
    super({
      id: AgentType.COMPLIANCE_AGENT,
      name: 'Compliance Agent',
      description: 'Ensures platform and project compliance',
      version: '1.0.0',
      capabilities: [
        {
          name: 'compliance-scan',
          description: 'Scan codebase for compliance violations',
          inputTypes: ['source-code'],
          outputTypes: ['compliance-report'],
        },
        {
          name: 'compliance-advisory',
          description: 'Provide compliance guidance to other agents',
          inputTypes: ['question'],
          outputTypes: ['guidance'],
        },
      ],
      requiredContext: [
        { type: 'current_task', required: true },
        { type: 'project_config', required: false },
      ],
      outputSchema: 'compliance-output',
    });

    this.engine = new ComplianceEngine();
  }

  /**
   * Build system prompt
   */
  protected buildSystemPrompt(context: AgentContext): string {
    const config = context.items.find(i => i.type === 'project_config')?.content as any;
    const frameworks = config?.compliance?.frameworks || ['platform'];

    return `You are the Compliance Agent responsible for security and compliance.

Your responsibilities:
1. ALWAYS enforce platform compliance (audit logging, encryption, secrets, access control)
2. Enforce project-specific compliance (${frameworks.join(', ')})
3. Scan code changes for violations
4. Provide compliance guidance to other agents
5. Generate compliance reports

Two-Tier Model:
- Platform Compliance: MANDATORY, cannot be disabled
- Project Compliance: Based on project configuration

Severity Levels:
- critical: Block deployment until fixed
- high: Should fix before release
- medium: Should address soon
- low: Nice to fix
- info: Informational only

Output must be valid JSON matching the ComplianceOutput schema.`;
  }

  /**
   * Build user prompt
   */
  protected buildUserPrompt(request: AgentRequest): string {
    const task = request.context.task;

    let prompt = `Perform a compliance scan:\n\n`;
    prompt += `TASK: ${task.description || JSON.stringify(task)}\n\n`;

    // Include scan results from engine
    const scanResults = (request as any).scanResults;
    if (scanResults) {
      prompt += `AUTOMATED SCAN RESULTS:\n${JSON.stringify(scanResults, null, 2)}\n\n`;
    }

    prompt += `Provide:\n`;
    prompt += `1. Complete violation list with severity\n`;
    prompt += `2. Scores by compliance framework\n`;
    prompt += `3. Security assessment\n`;
    prompt += `4. Recommendations\n`;
    prompt += `5. Overall compliance status\n`;

    return prompt;
  }

  /**
   * Execute with pre-scan
   */
  async execute(request: AgentRequest): Promise<any> {
    const projectRoot = request.context.task.projectRoot || process.cwd();
    const config = request.context.items.find(i => i.type === 'project_config')?.content as any;

    // Build compliance config
    const complianceConfig: ProjectComplianceConfig = {
      frameworks: config?.compliance?.frameworks || ['platform'],
      exclusions: config?.compliance?.exclusions,
    };

    // Run automated scan
    const scanResults = await this.engine.evaluate({
      projectRoot,
      config: complianceConfig,
    });

    // Attach results to request
    (request as any).scanResults = scanResults;

    return super.execute(request);
  }

  /**
   * Parse LLM response
   */
  protected parseResponse(response: any): ComplianceOutput {
    const text = this.extractTextContent(response);
    return this.parseJSON<ComplianceOutput>(text);
  }

  /**
   * Process result
   */
  protected async processResult(
    parsed: ComplianceOutput,
    request: AgentRequest
  ): Promise<{ result: ComplianceOutput; artifacts: Artifact[] }> {
    const artifacts: Artifact[] = [];

    // Create compliance report artifact
    artifacts.push({
      id: this.generateArtifactId(),
      type: 'report',
      path: 'compliance/compliance-report.md',
      content: this.renderComplianceReport(parsed),
      metadata: {
        status: parsed.summary.overallStatus,
        violations: parsed.summary.totalViolations,
      },
    });

    // Create violations CSV for tracking
    if (parsed.violations.length > 0) {
      artifacts.push({
        id: this.generateArtifactId(),
        type: 'report',
        path: 'compliance/violations.csv',
        content: this.renderViolationsCSV(parsed),
        metadata: { count: parsed.violations.length },
      });
    }

    return { result: parsed, artifacts };
  }

  /**
   * Generate routing hints
   */
  protected generateRoutingHints(
    result: ComplianceOutput,
    artifacts: Artifact[],
    request: AgentRequest
  ): RoutingHints {
    const hasCritical = result.summary.criticalViolations > 0;
    const hasHigh = result.summary.highViolations > 0;

    return {
      suggestNext: hasCritical ? [] : result.routingHints.suggestNext,
      skipAgents: result.routingHints.skipAgents,
      needsApproval: hasCritical || hasHigh,
      hasFailures: hasCritical,
      isComplete: true,
      notes: hasCritical
        ? `BLOCKING: ${result.summary.criticalViolations} critical violations must be fixed`
        : `${result.summary.totalViolations} violations found`,
    };
  }

  /**
   * Render compliance report
   */
  private renderComplianceReport(output: ComplianceOutput): string {
    const lines: string[] = [];

    lines.push('# Compliance Report');
    lines.push('');
    lines.push(`**Status:** ${output.summary.overallStatus.toUpperCase()}`);
    lines.push(`**Scan Type:** ${output.scanType}`);
    lines.push(`**Timestamp:** ${output.timestamp}`);
    lines.push('');

    lines.push('## Summary');
    lines.push('');
    lines.push(`| Metric | Value |`);
    lines.push(`|--------|-------|`);
    lines.push(`| Total Violations | ${output.summary.totalViolations} |`);
    lines.push(`| Critical | ${output.summary.criticalViolations} |`);
    lines.push(`| High | ${output.summary.highViolations} |`);
    lines.push(`| Average Score | ${output.summary.averageScore}% |`);
    lines.push('');

    lines.push('## Scores by Framework');
    lines.push('');
    for (const score of output.scores) {
      lines.push(`- **${score.framework}:** ${score.score}% (${score.passed} passed, ${score.failed} failed)`);
    }
    lines.push('');

    if (output.violations.length > 0) {
      lines.push('## Violations');
      lines.push('');
      for (const violation of output.violations) {
        lines.push(`### [${violation.severity.toUpperCase()}] ${violation.title}`);
        lines.push('');
        lines.push(`**Rule:** ${violation.rule}`);
        lines.push(`**Framework:** ${violation.framework}`);
        if (violation.location) {
          lines.push(`**Location:** ${violation.location.file}:${violation.location.line || '?'}`);
        }
        lines.push('');
        lines.push(violation.description);
        lines.push('');
        lines.push(`**Remediation:** ${violation.remediation}`);
        lines.push('');
      }
    }

    if (output.recommendations.length > 0) {
      lines.push('## Recommendations');
      lines.push('');
      for (const rec of output.recommendations) {
        lines.push(`### [${rec.priority}] ${rec.title}`);
        lines.push(rec.description);
        lines.push('');
      }
    }

    return lines.join('\n');
  }

  /**
   * Render violations as CSV
   */
  private renderViolationsCSV(output: ComplianceOutput): string {
    const lines: string[] = [];

    lines.push('ID,Framework,Rule,Severity,Title,File,Line,Remediation');

    for (const v of output.violations) {
      const file = v.location?.file || '';
      const line = v.location?.line || '';
      lines.push(`"${v.id}","${v.framework}","${v.rule}","${v.severity}","${v.title}","${file}","${line}","${v.remediation}"`);
    }

    return lines.join('\n');
  }
}
```

---

## Validation Checklist

```
□ Compliance Agent implemented
□ Two-tier compliance model works
  □ Platform rules always active
  □ Framework rules configurable
□ Compliance engine rules implemented
  □ Hardcoded secrets detection
  □ Audit logging check
  □ Input validation check
  □ HTTPS enforcement
□ Framework-specific rules
  □ GDPR rules
  □ SOC2 rules
  □ PCI-DSS rules
□ Report generation works
□ All tests pass
```

---

## Next Step

Proceed to **06-UI-DESIGNER-AGENT.md** to continue with the existing implementation plan.
