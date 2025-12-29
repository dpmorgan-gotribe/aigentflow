/**
 * GDPR Compliance Rules
 *
 * Rules based on the General Data Protection Regulation (EU).
 * These are optional and enabled when GDPR framework is selected.
 */

import type {
  ComplianceRule,
  ComplianceContext,
  ComplianceViolation,
  ComplianceFramework,
} from '../types.js';

/**
 * Personal data field patterns
 */
const PERSONAL_DATA_PATTERNS = [
  { name: 'email', pattern: /email/gi, category: 'contact' },
  { name: 'phone', pattern: /phone|mobile|tel/gi, category: 'contact' },
  { name: 'address', pattern: /address|street|city|zip|postal/gi, category: 'contact' },
  { name: 'name', pattern: /firstName|lastName|fullName|name/g, category: 'identity' },
  { name: 'birthdate', pattern: /birthDate|dateOfBirth|dob|birthday/gi, category: 'identity' },
  { name: 'ssn', pattern: /ssn|socialSecurity|nationalId/gi, category: 'identity' },
  { name: 'ip', pattern: /ipAddress|clientIp|remoteIp/gi, category: 'technical' },
  { name: 'location', pattern: /latitude|longitude|geoLocation|coordinates/gi, category: 'location' },
  { name: 'health', pattern: /health|medical|diagnosis|treatment/gi, category: 'special' },
  { name: 'biometric', pattern: /fingerprint|faceId|biometric/gi, category: 'special' },
  { name: 'genetic', pattern: /genetic|dna|genome/gi, category: 'special' },
  { name: 'religion', pattern: /religion|faith|belief/gi, category: 'special' },
  { name: 'political', pattern: /political|party|vote/gi, category: 'special' },
];

/**
 * Data Minimization Rule
 */
const dataMinimizationRule: ComplianceRule = {
  id: 'gdpr-data-minimization',
  framework: 'gdpr',
  name: 'Data Minimization',
  description: 'Collect only data that is necessary for the specified purpose (Article 5(1)(c))',
  category: 'privacy',
  severity: 'medium',
  triggers: ['code-generation', 'file-write'],
  enabled: true,
  autoFixable: false,
  check: (context: ComplianceContext): ComplianceViolation[] => {
    const violations: ComplianceViolation[] = [];
    const content = context.content || context.generatedCode || '';

    if (!content) return violations;

    // Count personal data fields in forms/schemas
    const foundFields: string[] = [];

    for (const field of PERSONAL_DATA_PATTERNS) {
      if (field.pattern.test(content)) {
        foundFields.push(field.name);
      }
    }

    // If many personal data fields are found, warn about minimization
    if (foundFields.length > 5) {
      violations.push({
        ruleId: 'gdpr-data-minimization',
        framework: 'gdpr',
        severity: 'medium',
        message: `Multiple personal data fields detected (${foundFields.length}). Review data minimization.`,
        location: { file: context.filePath },
        autoFixable: false,
        remediation:
          'Ensure each field is necessary for the processing purpose. Document justification.',
        context: { fields: foundFields },
      });
    }

    // Special category data requires extra scrutiny
    const specialFields = foundFields.filter((f) =>
      ['health', 'biometric', 'genetic', 'religion', 'political'].includes(f)
    );

    if (specialFields.length > 0) {
      violations.push({
        ruleId: 'gdpr-data-minimization',
        framework: 'gdpr',
        severity: 'high',
        message: `Special category data detected: ${specialFields.join(', ')}. Requires explicit consent.`,
        location: { file: context.filePath },
        autoFixable: false,
        remediation:
          'Special category data under Article 9 requires explicit consent and additional safeguards.',
        context: { specialFields },
      });
    }

    return violations;
  },
  references: ['GDPR Article 5(1)(c)', 'GDPR Article 9'],
  tags: ['privacy', 'data-minimization', 'personal-data'],
};

/**
 * Consent Requirement Rule
 */
const consentRequirementRule: ComplianceRule = {
  id: 'gdpr-consent-requirement',
  framework: 'gdpr',
  name: 'Consent Requirement',
  description: 'Processing of personal data requires valid consent or other lawful basis',
  category: 'consent',
  severity: 'high',
  triggers: ['code-generation'],
  enabled: true,
  autoFixable: false,
  check: (context: ComplianceContext): ComplianceViolation[] => {
    const violations: ComplianceViolation[] = [];
    const content = context.content || context.generatedCode || '';

    if (!content) return violations;

    // Check if code handles personal data
    const hasPersonalData = PERSONAL_DATA_PATTERNS.some((p) => p.pattern.test(content));

    if (hasPersonalData) {
      // Look for consent handling patterns
      const consentPatterns = [
        /consent/i,
        /optIn/i,
        /opt-in/i,
        /userAgreed/i,
        /acceptTerms/i,
        /privacyPolicy/i,
        /lawfulBasis/i,
      ];

      const hasConsentHandling = consentPatterns.some((p) => p.test(content));

      if (!hasConsentHandling) {
        violations.push({
          ruleId: 'gdpr-consent-requirement',
          framework: 'gdpr',
          severity: 'high',
          message: 'Personal data processing detected without apparent consent mechanism',
          location: { file: context.filePath },
          autoFixable: false,
          remediation:
            'Implement consent collection before processing personal data (Article 6, 7)',
        });
      }
    }

    return violations;
  },
  references: ['GDPR Article 6', 'GDPR Article 7'],
  tags: ['consent', 'lawful-basis', 'privacy'],
};

/**
 * Right to Access Rule
 */
const rightToAccessRule: ComplianceRule = {
  id: 'gdpr-right-to-access',
  framework: 'gdpr',
  name: 'Right to Access (SAR)',
  description: 'Data subjects have the right to access their personal data (Article 15)',
  category: 'data-handling',
  severity: 'medium',
  triggers: ['code-generation'],
  enabled: true,
  autoFixable: false,
  check: (context: ComplianceContext): ComplianceViolation[] => {
    const violations: ComplianceViolation[] = [];
    const content = context.content || context.generatedCode || '';

    if (!content) return violations;

    // Check if this looks like a user data endpoint/service
    const isUserDataService =
      /user.*service/i.test(content) ||
      /profile.*controller/i.test(content) ||
      /customer.*data/i.test(content);

    if (isUserDataService) {
      // Look for data export/access patterns
      const accessPatterns = [
        /exportData/i,
        /downloadData/i,
        /getMyData/i,
        /subjectAccess/i,
        /dataPortability/i,
      ];

      const hasAccessMechanism = accessPatterns.some((p) => p.test(content));

      if (!hasAccessMechanism) {
        violations.push({
          ruleId: 'gdpr-right-to-access',
          framework: 'gdpr',
          severity: 'medium',
          message: 'User data service without apparent data access/export mechanism',
          location: { file: context.filePath },
          autoFixable: false,
          remediation: 'Implement a mechanism for users to access/export their data (Article 15)',
        });
      }
    }

    return violations;
  },
  references: ['GDPR Article 15'],
  tags: ['data-access', 'subject-rights', 'sar'],
};

/**
 * Right to Erasure Rule
 */
const rightToErasureRule: ComplianceRule = {
  id: 'gdpr-right-to-erasure',
  framework: 'gdpr',
  name: 'Right to Erasure (RTBF)',
  description: 'Data subjects have the right to erasure of their personal data (Article 17)',
  category: 'data-handling',
  severity: 'medium',
  triggers: ['code-generation'],
  enabled: true,
  autoFixable: false,
  check: (context: ComplianceContext): ComplianceViolation[] => {
    const violations: ComplianceViolation[] = [];
    const content = context.content || context.generatedCode || '';

    if (!content) return violations;

    // Check if this handles user data deletion
    const isUserDataService =
      /user.*repository/i.test(content) ||
      /delete.*user/i.test(content) ||
      /remove.*account/i.test(content);

    if (isUserDataService) {
      // Look for soft delete patterns (which may not satisfy RTBF)
      const softDeletePattern = /softDelete|isDeleted|deletedAt|archived/i;
      const hardDeletePattern = /DELETE\s+FROM|\.remove\(|\.destroy\(|\.delete\(/i;

      if (softDeletePattern.test(content) && !hardDeletePattern.test(content)) {
        violations.push({
          ruleId: 'gdpr-right-to-erasure',
          framework: 'gdpr',
          severity: 'medium',
          message: 'Soft delete pattern detected. RTBF may require actual data erasure.',
          location: { file: context.filePath },
          autoFixable: false,
          remediation:
            'Implement hard delete or anonymization for RTBF compliance (Article 17)',
        });
      }
    }

    return violations;
  },
  references: ['GDPR Article 17'],
  tags: ['data-erasure', 'rtbf', 'subject-rights'],
};

/**
 * Data Retention Rule
 */
const dataRetentionRule: ComplianceRule = {
  id: 'gdpr-data-retention',
  framework: 'gdpr',
  name: 'Data Retention Limits',
  description: 'Personal data should not be kept longer than necessary (Article 5(1)(e))',
  category: 'retention',
  severity: 'medium',
  triggers: ['code-generation', 'file-write'],
  enabled: true,
  autoFixable: false,
  check: (context: ComplianceContext): ComplianceViolation[] => {
    const violations: ComplianceViolation[] = [];
    const content = context.content || context.generatedCode || '';

    if (!content) return violations;

    // Check for data storage without retention policy
    const storagePatterns = [
      /\.save\(/i,
      /\.create\(/i,
      /INSERT\s+INTO/i,
      /\.insert\(/i,
      /localStorage/i,
      /sessionStorage/i,
    ];

    const hasStorage = storagePatterns.some((p) => p.test(content));
    const hasPersonalData = PERSONAL_DATA_PATTERNS.some((p) => p.pattern.test(content));

    if (hasStorage && hasPersonalData) {
      // Look for retention patterns
      const retentionPatterns = [
        /retentionPeriod/i,
        /expiresAt/i,
        /ttl/i,
        /cleanupJob/i,
        /purge/i,
        /retention/i,
      ];

      const hasRetentionPolicy = retentionPatterns.some((p) => p.test(content));

      if (!hasRetentionPolicy) {
        violations.push({
          ruleId: 'gdpr-data-retention',
          framework: 'gdpr',
          severity: 'medium',
          message: 'Personal data storage without apparent retention policy',
          location: { file: context.filePath },
          autoFixable: false,
          remediation:
            'Implement data retention limits and automatic cleanup (Article 5(1)(e))',
        });
      }
    }

    return violations;
  },
  references: ['GDPR Article 5(1)(e)'],
  tags: ['retention', 'storage', 'data-lifecycle'],
};

/**
 * Cross-Border Transfer Rule
 */
const crossBorderTransferRule: ComplianceRule = {
  id: 'gdpr-cross-border-transfer',
  framework: 'gdpr',
  name: 'Cross-Border Data Transfer',
  description: 'Data transfers outside EEA require appropriate safeguards (Chapter V)',
  category: 'data-handling',
  severity: 'high',
  triggers: ['code-generation', 'config-change'],
  enabled: true,
  autoFixable: false,
  check: (context: ComplianceContext): ComplianceViolation[] => {
    const violations: ComplianceViolation[] = [];
    const content = context.content || context.generatedCode || '';

    if (!content) return violations;

    // Check for non-EU cloud services
    const nonEuServices = [
      { pattern: /\.amazonaws\.com(?!\.eu)/gi, name: 'AWS (non-EU region)' },
      { pattern: /us-central|us-east|us-west/gi, name: 'US region' },
      { pattern: /asia-/gi, name: 'Asia region' },
    ];

    for (const service of nonEuServices) {
      if (service.pattern.test(content)) {
        violations.push({
          ruleId: 'gdpr-cross-border-transfer',
          framework: 'gdpr',
          severity: 'high',
          message: `Potential non-EU data transfer detected: ${service.name}`,
          location: { file: context.filePath },
          autoFixable: false,
          remediation:
            'Ensure appropriate safeguards (SCCs, adequacy decision) for non-EU transfers',
        });
      }
    }

    return violations;
  },
  references: ['GDPR Chapter V', 'GDPR Article 44-49'],
  tags: ['transfer', 'cross-border', 'international'],
};

/**
 * Breach Notification Rule
 */
const breachNotificationRule: ComplianceRule = {
  id: 'gdpr-breach-notification',
  framework: 'gdpr',
  name: 'Breach Notification Capability',
  description: 'Must be able to detect and report data breaches within 72 hours (Article 33)',
  category: 'audit',
  severity: 'medium',
  triggers: ['code-generation'],
  enabled: true,
  autoFixable: false,
  check: (context: ComplianceContext): ComplianceViolation[] => {
    const violations: ComplianceViolation[] = [];
    const content = context.content || context.generatedCode || '';

    if (!content) return violations;

    // Check for security-related code
    const isSecurityCode =
      /auth/i.test(content) ||
      /security/i.test(content) ||
      /login/i.test(content) ||
      /access.*control/i.test(content);

    if (isSecurityCode) {
      // Look for audit/logging patterns
      const auditPatterns = [
        /auditLog/i,
        /securityLog/i,
        /logAccess/i,
        /trackActivity/i,
        /breach/i,
        /incident/i,
      ];

      const hasAuditCapability = auditPatterns.some((p) => p.test(content));

      if (!hasAuditCapability) {
        violations.push({
          ruleId: 'gdpr-breach-notification',
          framework: 'gdpr',
          severity: 'medium',
          message: 'Security-related code without apparent audit/logging capability',
          location: { file: context.filePath },
          autoFixable: false,
          remediation:
            'Implement security audit logging for breach detection (Article 33)',
        });
      }
    }

    return violations;
  },
  references: ['GDPR Article 33', 'GDPR Article 34'],
  tags: ['breach', 'notification', 'audit', 'logging'],
};

/**
 * Privacy by Design Rule
 */
const privacyByDesignRule: ComplianceRule = {
  id: 'gdpr-privacy-by-design',
  framework: 'gdpr',
  name: 'Privacy by Design',
  description: 'Data protection should be considered from the design phase (Article 25)',
  category: 'architecture',
  severity: 'low',
  triggers: ['code-generation'],
  enabled: true,
  autoFixable: false,
  check: (context: ComplianceContext): ComplianceViolation[] => {
    const violations: ComplianceViolation[] = [];
    const content = context.content || context.generatedCode || '';

    if (!content) return violations;

    const hasPersonalData = PERSONAL_DATA_PATTERNS.some((p) => p.pattern.test(content));

    if (hasPersonalData) {
      // Check for privacy-enhancing patterns
      const privacyPatterns = [
        /encrypt/i,
        /hash/i,
        /anonymize/i,
        /pseudonymize/i,
        /mask/i,
        /redact/i,
      ];

      const hasPrivacyMeasures = privacyPatterns.some((p) => p.test(content));

      if (!hasPrivacyMeasures) {
        violations.push({
          ruleId: 'gdpr-privacy-by-design',
          framework: 'gdpr',
          severity: 'low',
          message: 'Personal data handling without apparent privacy-enhancing measures',
          location: { file: context.filePath },
          autoFixable: false,
          remediation:
            'Consider encryption, pseudonymization, or other privacy measures (Article 25)',
        });
      }
    }

    return violations;
  },
  references: ['GDPR Article 25'],
  tags: ['privacy-by-design', 'architecture', 'encryption'],
};

/**
 * All GDPR rules
 */
export const gdprRules: ComplianceRule[] = [
  dataMinimizationRule,
  consentRequirementRule,
  rightToAccessRule,
  rightToErasureRule,
  dataRetentionRule,
  crossBorderTransferRule,
  breachNotificationRule,
  privacyByDesignRule,
];

/**
 * GDPR compliance framework
 */
export const gdprFramework: ComplianceFramework = {
  id: 'gdpr',
  name: 'GDPR',
  description: 'General Data Protection Regulation (EU) compliance rules',
  mandatory: false,
  version: '2016/679',
  rules: gdprRules,
};

export default gdprFramework;
