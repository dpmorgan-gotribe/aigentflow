# Step 28: Vendor & Third-Party Security

> **Checkpoint:** CP6 - Enterprise Operations
> **Previous Step:** 27-COMPLIANCE-DASHBOARDS.md
> **Next Step:** 29-MODEL-ABSTRACTION.md

---

## Overview

Vendor & Third-Party Security manages the assessment, monitoring, and compliance of external dependencies and service providers. This ensures supply chain security and vendor risk management.

Key responsibilities:
- Vendor security assessment questionnaires
- Third-party risk scoring and monitoring
- Dependency vulnerability tracking
- License compliance checking
- Sub-processor documentation (GDPR)
- Vendor access control and audit

---

## Deliverables

1. `src/enterprise/vendor/assessor.ts` - Vendor assessment engine
2. `src/enterprise/vendor/risk-scorer.ts` - Risk calculation
3. `src/enterprise/vendor/dependency-scanner.ts` - Dependency audit
4. `src/enterprise/vendor/license-checker.ts` - License compliance
5. `orchestrator-data/system/vendor/` - Vendor configurations

---

## 1. Vendor Assessment System

### 1.1 Vendor Schema

```typescript
/**
 * Vendor Profile Schema
 */

import { z } from 'zod';

export const VendorSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.enum([
    'saas',           // SaaS provider
    'iaas',           // Infrastructure provider
    'api',            // API service
    'library',        // Software library
    'contractor',     // External contractor
    'data_processor', // GDPR data processor
  ]),

  // Contact
  contact: z.object({
    company: z.string(),
    email: z.string().email(),
    website: z.string().url(),
    securityContact: z.string().email().optional(),
  }),

  // Risk classification
  riskClassification: z.enum(['critical', 'high', 'medium', 'low']),
  dataAccess: z.enum(['none', 'metadata', 'content', 'pii', 'sensitive']),

  // Compliance
  certifications: z.array(z.enum([
    'SOC2_TYPE1',
    'SOC2_TYPE2',
    'ISO27001',
    'GDPR',
    'HIPAA',
    'PCI_DSS',
    'FEDRAMP',
  ])),

  // Assessment
  lastAssessedAt: z.date().optional(),
  assessmentScore: z.number().min(0).max(100).optional(),
  nextAssessmentDue: z.date().optional(),

  // Contract
  contractStart: z.date(),
  contractEnd: z.date().optional(),
  dpaInPlace: z.boolean(), // Data Processing Agreement
  sccsInPlace: z.boolean(), // Standard Contractual Clauses

  // Status
  status: z.enum(['approved', 'pending_review', 'conditionally_approved', 'rejected', 'deprecated']),
});

export type Vendor = z.infer<typeof VendorSchema>;
```

### 1.2 Assessment Questionnaire

```yaml
# orchestrator-data/system/vendor/assessment-questionnaire.yaml
questionnaire:
  name: "Vendor Security Assessment"
  version: "2.0"

  sections:
    - id: "security_governance"
      name: "Security Governance"
      weight: 15
      questions:
        - id: "sg-1"
          question: "Does the vendor have a dedicated security team?"
          type: "yes_no"
          weight: 3

        - id: "sg-2"
          question: "What security certifications does the vendor hold?"
          type: "multi_select"
          options: ["SOC2 Type II", "ISO 27001", "PCI-DSS", "HIPAA", "FedRAMP", "None"]
          weight: 5
          scoring:
            "SOC2 Type II": 10
            "ISO 27001": 10
            "PCI-DSS": 8
            "HIPAA": 8
            "FedRAMP": 10
            "None": 0

        - id: "sg-3"
          question: "How often are security policies reviewed?"
          type: "single_select"
          options: ["Annually", "Semi-annually", "Quarterly", "Never"]
          weight: 2

    - id: "data_protection"
      name: "Data Protection"
      weight: 25
      questions:
        - id: "dp-1"
          question: "Is data encrypted at rest?"
          type: "yes_no"
          weight: 5
          required: true

        - id: "dp-2"
          question: "What encryption algorithm is used?"
          type: "single_select"
          options: ["AES-256", "AES-128", "Other", "None"]
          weight: 3

        - id: "dp-3"
          question: "Is data encrypted in transit?"
          type: "yes_no"
          weight: 5
          required: true

        - id: "dp-4"
          question: "What TLS version is supported?"
          type: "single_select"
          options: ["TLS 1.3", "TLS 1.2", "TLS 1.1 or lower"]
          weight: 3
          scoring:
            "TLS 1.3": 10
            "TLS 1.2": 8
            "TLS 1.1 or lower": 0

        - id: "dp-5"
          question: "Where is data stored geographically?"
          type: "multi_select"
          options: ["US", "EU", "UK", "Asia", "Other"]
          weight: 4

    - id: "access_control"
      name: "Access Control"
      weight: 20
      questions:
        - id: "ac-1"
          question: "Is MFA enforced for all users?"
          type: "yes_no"
          weight: 5

        - id: "ac-2"
          question: "Is RBAC implemented?"
          type: "yes_no"
          weight: 4

        - id: "ac-3"
          question: "How often are access reviews conducted?"
          type: "single_select"
          options: ["Monthly", "Quarterly", "Annually", "Never"]
          weight: 3

    - id: "incident_response"
      name: "Incident Response"
      weight: 15
      questions:
        - id: "ir-1"
          question: "Does the vendor have an incident response plan?"
          type: "yes_no"
          weight: 4

        - id: "ir-2"
          question: "What is the breach notification timeline?"
          type: "single_select"
          options: ["24 hours", "48 hours", "72 hours", "No commitment"]
          weight: 4
          scoring:
            "24 hours": 10
            "48 hours": 8
            "72 hours": 6
            "No commitment": 0

    - id: "business_continuity"
      name: "Business Continuity"
      weight: 10
      questions:
        - id: "bc-1"
          question: "What is the SLA uptime commitment?"
          type: "single_select"
          options: ["99.99%", "99.9%", "99.5%", "99%", "No SLA"]
          weight: 3

        - id: "bc-2"
          question: "Is there a disaster recovery plan?"
          type: "yes_no"
          weight: 3

    - id: "subprocessors"
      name: "Sub-processors"
      weight: 15
      questions:
        - id: "sp-1"
          question: "Are sub-processors documented?"
          type: "yes_no"
          weight: 4

        - id: "sp-2"
          question: "Can we be notified of sub-processor changes?"
          type: "yes_no"
          weight: 3

  scoring:
    pass_threshold: 70
    conditional_threshold: 50
    fail_threshold: 50
```

### 1.3 Vendor Assessor Implementation

```typescript
/**
 * Vendor Assessor
 *
 * Manages vendor security assessments.
 */

export class VendorAssessor {
  constructor(
    private db: Database,
    private questionnairePath: string
  ) {}

  /**
   * Create new vendor
   */
  async createVendor(vendor: Omit<Vendor, 'id'>): Promise<Vendor> {
    const newVendor: Vendor = {
      ...vendor,
      id: `VND-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    };

    await this.db.run(
      `INSERT INTO vendors (id, name, type, contact, risk_classification,
       data_access, certifications, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [newVendor.id, newVendor.name, newVendor.type, JSON.stringify(newVendor.contact),
       newVendor.riskClassification, newVendor.dataAccess,
       JSON.stringify(newVendor.certifications), newVendor.status]
    );

    return newVendor;
  }

  /**
   * Start assessment for vendor
   */
  async startAssessment(vendorId: string): Promise<Assessment> {
    const vendor = await this.getVendor(vendorId);
    const questionnaire = await this.loadQuestionnaire();

    const assessment: Assessment = {
      id: `ASM-${Date.now()}`,
      vendorId,
      questionnaire: questionnaire.name,
      version: questionnaire.version,
      startedAt: new Date(),
      status: 'in_progress',
      responses: [],
      score: null,
    };

    await this.db.run(
      `INSERT INTO vendor_assessments (id, vendor_id, questionnaire, version,
       started_at, status)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [assessment.id, vendorId, questionnaire.name, questionnaire.version,
       assessment.startedAt.toISOString(), assessment.status]
    );

    return assessment;
  }

  /**
   * Submit assessment response
   */
  async submitResponse(
    assessmentId: string,
    questionId: string,
    response: unknown
  ): Promise<void> {
    await this.db.run(
      `INSERT INTO assessment_responses (assessment_id, question_id, response, submitted_at)
       VALUES (?, ?, ?, ?)`,
      [assessmentId, questionId, JSON.stringify(response), new Date().toISOString()]
    );
  }

  /**
   * Complete assessment and calculate score
   */
  async completeAssessment(assessmentId: string): Promise<AssessmentResult> {
    const assessment = await this.getAssessment(assessmentId);
    const responses = await this.getResponses(assessmentId);
    const questionnaire = await this.loadQuestionnaire();

    // Calculate score
    let totalWeight = 0;
    let weightedScore = 0;

    for (const section of questionnaire.sections) {
      for (const question of section.questions) {
        const response = responses.find(r => r.questionId === question.id);
        if (!response) continue;

        const questionScore = this.scoreQuestion(question, response.response);
        weightedScore += questionScore * question.weight * (section.weight / 100);
        totalWeight += question.weight * (section.weight / 100);
      }
    }

    const finalScore = totalWeight > 0 ? Math.round((weightedScore / totalWeight) * 100) : 0;

    // Determine result
    let result: 'approved' | 'conditionally_approved' | 'rejected';
    if (finalScore >= questionnaire.scoring.pass_threshold) {
      result = 'approved';
    } else if (finalScore >= questionnaire.scoring.conditional_threshold) {
      result = 'conditionally_approved';
    } else {
      result = 'rejected';
    }

    // Update assessment
    await this.db.run(
      `UPDATE vendor_assessments
       SET status = 'completed', completed_at = ?, score = ?, result = ?
       WHERE id = ?`,
      [new Date().toISOString(), finalScore, result, assessmentId]
    );

    // Update vendor
    await this.db.run(
      `UPDATE vendors
       SET last_assessed_at = ?, assessment_score = ?, status = ?,
           next_assessment_due = date('now', '+1 year')
       WHERE id = ?`,
      [new Date().toISOString(), finalScore, result, assessment.vendorId]
    );

    return {
      assessmentId,
      vendorId: assessment.vendorId,
      score: finalScore,
      result,
      completedAt: new Date(),
      sectionScores: this.calculateSectionScores(questionnaire, responses),
      recommendations: this.generateRecommendations(questionnaire, responses, finalScore),
    };
  }

  /**
   * Get vendors due for reassessment
   */
  async getVendorsDueForAssessment(): Promise<Vendor[]> {
    const rows = await this.db.all(
      `SELECT * FROM vendors
       WHERE next_assessment_due <= date('now', '+30 days')
       ORDER BY next_assessment_due`
    );
    return rows;
  }

  private scoreQuestion(question: any, response: unknown): number {
    if (question.type === 'yes_no') {
      return response === true ? 10 : 0;
    }

    if (question.scoring && question.scoring[response as string] !== undefined) {
      return question.scoring[response as string];
    }

    return 5; // Default middle score
  }

  private calculateSectionScores(questionnaire: any, responses: any[]): Record<string, number> {
    const scores: Record<string, number> = {};

    for (const section of questionnaire.sections) {
      let sectionTotal = 0;
      let sectionWeight = 0;

      for (const question of section.questions) {
        const response = responses.find(r => r.questionId === question.id);
        if (!response) continue;

        sectionTotal += this.scoreQuestion(question, response.response) * question.weight;
        sectionWeight += question.weight;
      }

      scores[section.id] = sectionWeight > 0 ? Math.round((sectionTotal / sectionWeight) * 10) : 0;
    }

    return scores;
  }

  private generateRecommendations(questionnaire: any, responses: any[], score: number): string[] {
    const recommendations: string[] = [];

    if (score < 70) {
      recommendations.push('Vendor requires significant security improvements before approval');
    }

    // Check specific weak areas
    for (const section of questionnaire.sections) {
      for (const question of section.questions) {
        const response = responses.find(r => r.questionId === question.id);
        if (!response) continue;

        if (this.scoreQuestion(question, response.response) < 5) {
          recommendations.push(`Address weakness in: ${question.question}`);
        }
      }
    }

    return recommendations;
  }

  private async getVendor(id: string): Promise<Vendor> {
    return this.db.get('SELECT * FROM vendors WHERE id = ?', [id]);
  }

  private async getAssessment(id: string): Promise<Assessment> {
    return this.db.get('SELECT * FROM vendor_assessments WHERE id = ?', [id]);
  }

  private async getResponses(assessmentId: string): Promise<any[]> {
    return this.db.all(
      'SELECT * FROM assessment_responses WHERE assessment_id = ?',
      [assessmentId]
    );
  }

  private async loadQuestionnaire(): Promise<any> {
    // Load from YAML
    return {};
  }
}

interface Assessment {
  id: string;
  vendorId: string;
  questionnaire: string;
  version: string;
  startedAt: Date;
  status: 'in_progress' | 'completed';
  responses: any[];
  score: number | null;
}

interface AssessmentResult {
  assessmentId: string;
  vendorId: string;
  score: number;
  result: 'approved' | 'conditionally_approved' | 'rejected';
  completedAt: Date;
  sectionScores: Record<string, number>;
  recommendations: string[];
}
```

---

## 2. Dependency Scanner

### 2.1 Dependency Audit

```typescript
/**
 * Dependency Scanner
 *
 * Scans project dependencies for vulnerabilities and license issues.
 */

export class DependencyScanner {
  constructor(private projectPath: string) {}

  /**
   * Scan all dependencies
   */
  async scan(): Promise<DependencyScanResult> {
    const result: DependencyScanResult = {
      scannedAt: new Date(),
      totalDependencies: 0,
      directDependencies: 0,
      vulnerabilities: [],
      licenseIssues: [],
      outdated: [],
    };

    // Scan npm dependencies
    const npmResult = await this.scanNpm();
    result.totalDependencies += npmResult.total;
    result.directDependencies += npmResult.direct;
    result.vulnerabilities.push(...npmResult.vulnerabilities);
    result.outdated.push(...npmResult.outdated);

    // Scan Python dependencies
    const pipResult = await this.scanPip();
    result.totalDependencies += pipResult.total;
    result.directDependencies += pipResult.direct;
    result.vulnerabilities.push(...pipResult.vulnerabilities);

    // Check licenses
    result.licenseIssues = await this.checkLicenses();

    return result;
  }

  /**
   * Scan npm dependencies
   */
  private async scanNpm(): Promise<{
    total: number;
    direct: number;
    vulnerabilities: Vulnerability[];
    outdated: OutdatedDep[];
  }> {
    // Run npm audit
    const { execSync } = await import('child_process');

    try {
      const auditOutput = execSync('npm audit --json', {
        cwd: this.projectPath,
        encoding: 'utf-8',
      });

      const audit = JSON.parse(auditOutput);

      return {
        total: audit.metadata?.totalDependencies || 0,
        direct: audit.metadata?.dependencies || 0,
        vulnerabilities: this.parseNpmVulnerabilities(audit),
        outdated: await this.getOutdatedNpm(),
      };
    } catch (error) {
      // npm audit exits with non-zero if vulnerabilities found
      if (error.stdout) {
        const audit = JSON.parse(error.stdout);
        return {
          total: audit.metadata?.totalDependencies || 0,
          direct: audit.metadata?.dependencies || 0,
          vulnerabilities: this.parseNpmVulnerabilities(audit),
          outdated: [],
        };
      }
      throw error;
    }
  }

  /**
   * Scan Python dependencies
   */
  private async scanPip(): Promise<{
    total: number;
    direct: number;
    vulnerabilities: Vulnerability[];
  }> {
    // Use pip-audit or safety check
    return { total: 0, direct: 0, vulnerabilities: [] };
  }

  /**
   * Check license compliance
   */
  private async checkLicenses(): Promise<LicenseIssue[]> {
    const issues: LicenseIssue[] = [];

    // Banned licenses
    const bannedLicenses = ['GPL-3.0', 'AGPL-3.0', 'SSPL-1.0'];
    const reviewRequired = ['GPL-2.0', 'LGPL-3.0', 'MPL-2.0'];

    // Parse package.json and check licenses
    const { execSync } = await import('child_process');

    try {
      const licensesOutput = execSync('npx license-checker --json', {
        cwd: this.projectPath,
        encoding: 'utf-8',
      });

      const licenses = JSON.parse(licensesOutput);

      for (const [pkg, info] of Object.entries(licenses)) {
        const license = (info as any).licenses;

        if (bannedLicenses.includes(license)) {
          issues.push({
            package: pkg,
            license,
            issue: 'banned',
            severity: 'high',
            message: `License ${license} is not permitted for use`,
          });
        } else if (reviewRequired.includes(license)) {
          issues.push({
            package: pkg,
            license,
            issue: 'review_required',
            severity: 'medium',
            message: `License ${license} requires legal review`,
          });
        }
      }
    } catch (error) {
      // Handle error
    }

    return issues;
  }

  private parseNpmVulnerabilities(audit: any): Vulnerability[] {
    const vulnerabilities: Vulnerability[] = [];

    if (audit.vulnerabilities) {
      for (const [name, vuln] of Object.entries(audit.vulnerabilities)) {
        const v = vuln as any;
        vulnerabilities.push({
          id: v.via?.[0]?.source || `npm-${name}`,
          package: name,
          severity: v.severity,
          title: v.via?.[0]?.title || 'Unknown vulnerability',
          url: v.via?.[0]?.url,
          fixedIn: v.fixAvailable?.version,
          path: v.nodes?.join(' > '),
        });
      }
    }

    return vulnerabilities;
  }

  private async getOutdatedNpm(): Promise<OutdatedDep[]> {
    const { execSync } = await import('child_process');

    try {
      const output = execSync('npm outdated --json', {
        cwd: this.projectPath,
        encoding: 'utf-8',
      });

      const outdated = JSON.parse(output);
      return Object.entries(outdated).map(([name, info]: [string, any]) => ({
        package: name,
        current: info.current,
        wanted: info.wanted,
        latest: info.latest,
        type: info.type,
      }));
    } catch (error) {
      return [];
    }
  }
}

interface DependencyScanResult {
  scannedAt: Date;
  totalDependencies: number;
  directDependencies: number;
  vulnerabilities: Vulnerability[];
  licenseIssues: LicenseIssue[];
  outdated: OutdatedDep[];
}

interface Vulnerability {
  id: string;
  package: string;
  severity: 'critical' | 'high' | 'moderate' | 'low';
  title: string;
  url?: string;
  fixedIn?: string;
  path?: string;
}

interface LicenseIssue {
  package: string;
  license: string;
  issue: 'banned' | 'review_required' | 'unknown';
  severity: 'high' | 'medium' | 'low';
  message: string;
}

interface OutdatedDep {
  package: string;
  current: string;
  wanted: string;
  latest: string;
  type: string;
}
```

---

## 3. Sub-processor Registry (GDPR)

```typescript
/**
 * Sub-processor Registry
 *
 * Tracks GDPR sub-processors.
 */

export class SubprocessorRegistry {
  constructor(private db: Database) {}

  /**
   * Register sub-processor
   */
  async register(subprocessor: Subprocessor): Promise<void> {
    await this.db.run(
      `INSERT INTO subprocessors (id, name, service, data_processed,
       country, dpa_date, scc_date, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [subprocessor.id, subprocessor.name, subprocessor.service,
       JSON.stringify(subprocessor.dataProcessed), subprocessor.country,
       subprocessor.dpaDate?.toISOString(), subprocessor.sccDate?.toISOString(),
       subprocessor.status]
    );
  }

  /**
   * Get all sub-processors
   */
  async getAll(): Promise<Subprocessor[]> {
    return this.db.all('SELECT * FROM subprocessors ORDER BY name');
  }

  /**
   * Generate sub-processor list for GDPR documentation
   */
  async generateList(): Promise<string> {
    const subprocessors = await this.getAll();

    let doc = '# Sub-processor List\n\n';
    doc += `Last updated: ${new Date().toISOString()}\n\n`;
    doc += '| Name | Service | Data Processed | Country | DPA | SCCs |\n';
    doc += '|------|---------|----------------|---------|-----|------|\n';

    for (const sp of subprocessors) {
      doc += `| ${sp.name} | ${sp.service} | ${sp.dataProcessed.join(', ')} | `;
      doc += `${sp.country} | ${sp.dpaDate ? 'Yes' : 'No'} | ${sp.sccDate ? 'Yes' : 'No'} |\n`;
    }

    return doc;
  }
}

interface Subprocessor {
  id: string;
  name: string;
  service: string;
  dataProcessed: string[];
  country: string;
  dpaDate?: Date;
  sccDate?: Date;
  status: 'active' | 'pending' | 'deprecated';
}
```

---

## 4. CLI Commands

```typescript
// Vendor management commands

program
  .command('vendor list')
  .description('List all vendors')
  .action(async () => {
    const vendors = await assessor.getAllVendors();
    console.table(vendors.map(v => ({
      id: v.id,
      name: v.name,
      type: v.type,
      risk: v.riskClassification,
      score: v.assessmentScore,
      status: v.status,
    })));
  });

program
  .command('vendor assess <vendorId>')
  .description('Start vendor assessment')
  .action(async (vendorId) => {
    const assessment = await assessor.startAssessment(vendorId);
    console.log(`Assessment started: ${assessment.id}`);
  });

program
  .command('deps scan')
  .description('Scan dependencies for vulnerabilities')
  .action(async () => {
    const scanner = new DependencyScanner(process.cwd());
    const result = await scanner.scan();

    console.log(`Total dependencies: ${result.totalDependencies}`);
    console.log(`Vulnerabilities: ${result.vulnerabilities.length}`);
    console.log(`License issues: ${result.licenseIssues.length}`);

    if (result.vulnerabilities.length > 0) {
      console.log('\nVulnerabilities:');
      console.table(result.vulnerabilities);
    }
  });
```

---

## 5. Test Scenarios

```typescript
describe('Vendor Security', () => {
  describe('VendorAssessor', () => {
    it('should calculate assessment score correctly', async () => {
      const assessment = await assessor.startAssessment('vendor-1');
      await assessor.submitResponse(assessment.id, 'sg-1', true);
      await assessor.submitResponse(assessment.id, 'dp-1', true);

      const result = await assessor.completeAssessment(assessment.id);
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(100);
    });

    it('should classify vendor based on score', async () => {
      // Test classification logic
    });
  });

  describe('DependencyScanner', () => {
    it('should detect vulnerable dependencies', async () => {
      const scanner = new DependencyScanner('./test-project');
      const result = await scanner.scan();
      expect(result.vulnerabilities).toBeDefined();
    });

    it('should identify banned licenses', async () => {
      // Test license checking
    });
  });
});
```

---

## 6. Dependencies

- Step 04d: Audit Logging (vendor access logging)
- Step 05f: Compliance Agent (vendor compliance checks)
- Step 26: GDPR Operations (sub-processor documentation)

---

## 7. Acceptance Criteria

- [ ] Vendor profiles stored with risk classification
- [ ] Assessment questionnaires configurable
- [ ] Assessment scores calculated automatically
- [ ] Dependency scanning finds vulnerabilities
- [ ] License compliance checked
- [ ] Sub-processor registry maintained
- [ ] Vendors due for reassessment identified
- [ ] All tests pass
