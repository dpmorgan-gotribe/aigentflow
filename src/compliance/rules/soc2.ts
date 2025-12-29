/**
 * SOC 2 Compliance Rules
 *
 * Rules based on SOC 2 Trust Service Criteria.
 * These are optional and enabled when SOC2 framework is selected.
 */

import type {
  ComplianceRule,
  ComplianceContext,
  ComplianceViolation,
  ComplianceFramework,
} from '../types.js';

/**
 * Access Control Rule (CC6.1)
 */
const accessControlRule: ComplianceRule = {
  id: 'soc2-access-control',
  framework: 'soc2',
  name: 'Access Control Implementation',
  description: 'Logical and physical access controls are implemented (CC6.1)',
  category: 'access-control',
  severity: 'high',
  triggers: ['code-generation', 'file-write'],
  enabled: true,
  autoFixable: false,
  check: (context: ComplianceContext): ComplianceViolation[] => {
    const violations: ComplianceViolation[] = [];
    const content = context.content || context.generatedCode || '';

    if (!content) return violations;

    // Check for API endpoints without auth
    const endpointPatterns = [
      /app\.(get|post|put|delete|patch)\s*\(/gi,
      /router\.(get|post|put|delete|patch)\s*\(/gi,
      /@(Get|Post|Put|Delete|Patch)\s*\(/gi,
    ];

    const hasEndpoints = endpointPatterns.some((p) => p.test(content));

    if (hasEndpoints) {
      // Look for auth patterns
      const authPatterns = [
        /auth/i,
        /authenticate/i,
        /authorize/i,
        /isAuthenticated/i,
        /requireAuth/i,
        /jwt/i,
        /bearer/i,
        /middleware/i,
        /@UseGuards/i,
      ];

      const hasAuth = authPatterns.some((p) => p.test(content));

      // Check for public endpoint markers
      const publicPatterns = [/public/i, /noAuth/i, /anonymous/i, /health/i, /ping/i];
      const isPublicEndpoint = publicPatterns.some((p) => p.test(content));

      if (!hasAuth && !isPublicEndpoint) {
        violations.push({
          ruleId: 'soc2-access-control',
          framework: 'soc2',
          severity: 'high',
          message: 'API endpoints detected without apparent authentication',
          location: { file: context.filePath },
          autoFixable: false,
          remediation:
            'Implement authentication middleware for all non-public endpoints (CC6.1)',
        });
      }
    }

    return violations;
  },
  references: ['SOC 2 CC6.1'],
  tags: ['access-control', 'authentication', 'security'],
};

/**
 * Encryption at Rest Rule (CC6.7)
 */
const encryptionAtRestRule: ComplianceRule = {
  id: 'soc2-encryption-at-rest',
  framework: 'soc2',
  name: 'Encryption at Rest',
  description: 'Sensitive data should be encrypted when stored (CC6.7)',
  category: 'encryption',
  severity: 'high',
  triggers: ['code-generation', 'file-write'],
  enabled: true,
  autoFixable: false,
  check: (context: ComplianceContext): ComplianceViolation[] => {
    const violations: ComplianceViolation[] = [];
    const content = context.content || context.generatedCode || '';

    if (!content) return violations;

    // Check for database storage patterns
    const storagePatterns = [
      /mongoose\.model/i,
      /sequelize\.define/i,
      /prisma\./i,
      /@Entity/i,
      /CREATE\s+TABLE/i,
    ];

    const hasStorage = storagePatterns.some((p) => p.test(content));

    // Check for sensitive field names
    const sensitivePatterns = [
      /password/i,
      /creditCard/i,
      /ssn/i,
      /socialSecurity/i,
      /bankAccount/i,
      /secret/i,
      /privateKey/i,
    ];

    const hasSensitiveData = sensitivePatterns.some((p) => p.test(content));

    if (hasStorage && hasSensitiveData) {
      // Look for encryption patterns
      const encryptionPatterns = [
        /encrypt/i,
        /hash/i,
        /bcrypt/i,
        /argon2/i,
        /cipher/i,
        /aes/i,
        /@Encrypted/i,
      ];

      const hasEncryption = encryptionPatterns.some((p) => p.test(content));

      if (!hasEncryption) {
        violations.push({
          ruleId: 'soc2-encryption-at-rest',
          framework: 'soc2',
          severity: 'high',
          message: 'Sensitive data storage without apparent encryption',
          location: { file: context.filePath },
          autoFixable: false,
          remediation:
            'Encrypt sensitive data before storage (CC6.7). Use bcrypt for passwords.',
        });
      }
    }

    return violations;
  },
  references: ['SOC 2 CC6.7'],
  tags: ['encryption', 'storage', 'security'],
};

/**
 * Encryption in Transit Rule (CC6.7)
 */
const encryptionInTransitRule: ComplianceRule = {
  id: 'soc2-encryption-in-transit',
  framework: 'soc2',
  name: 'Encryption in Transit',
  description: 'Data should be encrypted during transmission (CC6.7)',
  category: 'encryption',
  severity: 'high',
  triggers: ['code-generation', 'file-write', 'config-change'],
  enabled: true,
  autoFixable: false,
  check: (context: ComplianceContext): ComplianceViolation[] => {
    const violations: ComplianceViolation[] = [];
    const content = context.content || context.generatedCode || '';

    if (!content) return violations;

    // Check for non-TLS configurations
    const insecurePatterns = [
      { pattern: /http:\/\/(?!localhost|127\.0\.0\.1)/gi, name: 'Non-HTTPS URL' },
      { pattern: /ssl:\s*false/gi, name: 'SSL disabled' },
      { pattern: /rejectUnauthorized:\s*false/gi, name: 'TLS verification disabled' },
      { pattern: /secure:\s*false/gi, name: 'Secure flag disabled' },
    ];

    for (const insecure of insecurePatterns) {
      if (insecure.pattern.test(content)) {
        violations.push({
          ruleId: 'soc2-encryption-in-transit',
          framework: 'soc2',
          severity: 'high',
          message: `Insecure transport configuration: ${insecure.name}`,
          location: { file: context.filePath },
          autoFixable: false,
          remediation: 'Use TLS for all data transmission (CC6.7)',
        });
      }
    }

    return violations;
  },
  references: ['SOC 2 CC6.7'],
  tags: ['encryption', 'tls', 'transport'],
};

/**
 * Audit Logging Rule (CC7.2)
 */
const auditLoggingRule: ComplianceRule = {
  id: 'soc2-audit-logging',
  framework: 'soc2',
  name: 'Audit Logging',
  description: 'System activities should be logged for audit purposes (CC7.2)',
  category: 'audit',
  severity: 'medium',
  triggers: ['code-generation'],
  enabled: true,
  autoFixable: false,
  check: (context: ComplianceContext): ComplianceViolation[] => {
    const violations: ComplianceViolation[] = [];
    const content = context.content || context.generatedCode || '';

    if (!content) return violations;

    // Check for significant operations
    const significantPatterns = [
      /login/i,
      /logout/i,
      /delete/i,
      /admin/i,
      /permission/i,
      /role/i,
      /access/i,
    ];

    const hasSignificantOps = significantPatterns.some((p) => p.test(content));

    if (hasSignificantOps) {
      // Look for logging patterns
      const loggingPatterns = [
        /logger\./i,
        /log\./i,
        /audit/i,
        /winston/i,
        /pino/i,
        /bunyan/i,
        /console\.(log|info|warn|error)/,
      ];

      const hasLogging = loggingPatterns.some((p) => p.test(content));

      if (!hasLogging) {
        violations.push({
          ruleId: 'soc2-audit-logging',
          framework: 'soc2',
          severity: 'medium',
          message: 'Significant operations without apparent logging',
          location: { file: context.filePath },
          autoFixable: false,
          remediation: 'Implement audit logging for significant operations (CC7.2)',
        });
      }
    }

    return violations;
  },
  references: ['SOC 2 CC7.2'],
  tags: ['audit', 'logging', 'monitoring'],
};

/**
 * Change Management Rule (CC8.1)
 */
const changeManagementRule: ComplianceRule = {
  id: 'soc2-change-management',
  framework: 'soc2',
  name: 'Change Management',
  description: 'Changes should be authorized and documented (CC8.1)',
  category: 'audit',
  severity: 'low',
  triggers: ['git-commit', 'deployment'],
  enabled: true,
  autoFixable: false,
  check: (context: ComplianceContext): ComplianceViolation[] => {
    const violations: ComplianceViolation[] = [];

    // Check for CI/CD configuration
    if (
      context.filePath?.includes('github/workflows') ||
      context.filePath?.includes('.gitlab-ci') ||
      context.filePath?.includes('Jenkinsfile')
    ) {
      const content = context.content || '';

      // Look for approval patterns
      const approvalPatterns = [
        /approval/i,
        /review/i,
        /protected.*branch/i,
        /require.*approval/i,
        /manual/i,
      ];

      const hasApprovalGate = approvalPatterns.some((p) => p.test(content));

      if (!hasApprovalGate) {
        violations.push({
          ruleId: 'soc2-change-management',
          framework: 'soc2',
          severity: 'low',
          message: 'CI/CD pipeline without apparent approval gates',
          location: { file: context.filePath },
          autoFixable: false,
          remediation: 'Add approval requirements for production deployments (CC8.1)',
        });
      }
    }

    return violations;
  },
  references: ['SOC 2 CC8.1'],
  tags: ['change-management', 'cicd', 'approval'],
};

/**
 * Incident Response Rule (CC7.3)
 */
const incidentResponseRule: ComplianceRule = {
  id: 'soc2-incident-response',
  framework: 'soc2',
  name: 'Incident Response',
  description: 'Security incidents should be detected and responded to (CC7.3)',
  category: 'security',
  severity: 'medium',
  triggers: ['code-generation', 'file-write'],
  enabled: true,
  autoFixable: false,
  check: (context: ComplianceContext): ComplianceViolation[] => {
    const violations: ComplianceViolation[] = [];
    const content = context.content || context.generatedCode || '';

    if (!content) return violations;

    // Check for error handling code
    const errorHandlingPatterns = [
      /catch\s*\(/,
      /\.catch\s*\(/,
      /onError/i,
      /handleError/i,
      /errorHandler/i,
    ];

    const hasErrorHandling = errorHandlingPatterns.some((p) => p.test(content));

    if (hasErrorHandling) {
      // Check for alerting/notification
      const alertingPatterns = [
        /alert/i,
        /notify/i,
        /sentry/i,
        /datadog/i,
        /pagerduty/i,
        /slack/i,
        /webhook/i,
        /email/i,
      ];

      const hasAlerting = alertingPatterns.some((p) => p.test(content));

      // This is just a warning - not all error handlers need alerting
      if (!hasAlerting && context.filePath?.includes('error')) {
        violations.push({
          ruleId: 'soc2-incident-response',
          framework: 'soc2',
          severity: 'low',
          message: 'Error handling without apparent alerting mechanism',
          location: { file: context.filePath },
          autoFixable: false,
          remediation: 'Consider adding alerting for critical errors (CC7.3)',
        });
      }
    }

    return violations;
  },
  references: ['SOC 2 CC7.3'],
  tags: ['incident-response', 'alerting', 'monitoring'],
};

/**
 * System Availability Rule (A1.1)
 */
const systemAvailabilityRule: ComplianceRule = {
  id: 'soc2-system-availability',
  framework: 'soc2',
  name: 'System Availability',
  description: 'Systems should be designed for availability (A1.1)',
  category: 'architecture',
  severity: 'medium',
  triggers: ['code-generation', 'config-change'],
  enabled: true,
  autoFixable: false,
  check: (context: ComplianceContext): ComplianceViolation[] => {
    const violations: ComplianceViolation[] = [];
    const content = context.content || context.generatedCode || '';

    if (!content) return violations;

    // Check for service configuration
    const isServiceConfig =
      context.filePath?.includes('docker') ||
      context.filePath?.includes('kubernetes') ||
      context.filePath?.includes('k8s') ||
      /app\.(listen|start)/i.test(content);

    if (isServiceConfig) {
      // Look for availability patterns
      const availabilityPatterns = [
        /replicas/i,
        /healthCheck/i,
        /readinessProbe/i,
        /livenessProbe/i,
        /loadBalancer/i,
        /retry/i,
        /circuit.*breaker/i,
        /timeout/i,
      ];

      const hasAvailabilityMeasures = availabilityPatterns.some((p) => p.test(content));

      if (!hasAvailabilityMeasures) {
        violations.push({
          ruleId: 'soc2-system-availability',
          framework: 'soc2',
          severity: 'low',
          message: 'Service configuration without apparent availability measures',
          location: { file: context.filePath },
          autoFixable: false,
          remediation:
            'Consider health checks, retries, and redundancy for availability (A1.1)',
        });
      }
    }

    return violations;
  },
  references: ['SOC 2 A1.1'],
  tags: ['availability', 'resilience', 'health-check'],
};

/**
 * Data Integrity Rule (PI1.1)
 */
const dataIntegrityRule: ComplianceRule = {
  id: 'soc2-data-integrity',
  framework: 'soc2',
  name: 'Data Integrity',
  description: 'Data should be protected from unauthorized modification (PI1.1)',
  category: 'data-handling',
  severity: 'high',
  triggers: ['code-generation'],
  enabled: true,
  autoFixable: false,
  check: (context: ComplianceContext): ComplianceViolation[] => {
    const violations: ComplianceViolation[] = [];
    const content = context.content || context.generatedCode || '';

    if (!content) return violations;

    // Check for data modification endpoints
    const modificationPatterns = [
      /\.put\s*\(/gi,
      /\.patch\s*\(/gi,
      /\.post\s*\(/gi,
      /UPDATE\s+/i,
      /INSERT\s+/i,
    ];

    const hasModification = modificationPatterns.some((p) => p.test(content));

    if (hasModification) {
      // Look for validation patterns
      const validationPatterns = [
        /validate/i,
        /schema/i,
        /zod/i,
        /yup/i,
        /joi/i,
        /class-validator/i,
        /sanitize/i,
      ];

      const hasValidation = validationPatterns.some((p) => p.test(content));

      if (!hasValidation) {
        violations.push({
          ruleId: 'soc2-data-integrity',
          framework: 'soc2',
          severity: 'medium',
          message: 'Data modification without apparent input validation',
          location: { file: context.filePath },
          autoFixable: false,
          remediation: 'Implement input validation to protect data integrity (PI1.1)',
        });
      }
    }

    return violations;
  },
  references: ['SOC 2 PI1.1'],
  tags: ['data-integrity', 'validation', 'security'],
};

/**
 * All SOC 2 rules
 */
export const soc2Rules: ComplianceRule[] = [
  accessControlRule,
  encryptionAtRestRule,
  encryptionInTransitRule,
  auditLoggingRule,
  changeManagementRule,
  incidentResponseRule,
  systemAvailabilityRule,
  dataIntegrityRule,
];

/**
 * SOC 2 compliance framework
 */
export const soc2Framework: ComplianceFramework = {
  id: 'soc2',
  name: 'SOC 2',
  description: 'SOC 2 Type II Trust Service Criteria compliance rules',
  mandatory: false,
  version: '2017',
  rules: soc2Rules,
};

export default soc2Framework;
