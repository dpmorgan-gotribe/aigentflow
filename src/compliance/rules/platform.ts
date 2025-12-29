/**
 * Platform Compliance Rules
 *
 * Mandatory rules that apply to all projects using Aigentflow.
 * These enforce basic security and code quality standards.
 */

import type {
  ComplianceRule,
  ComplianceContext,
  ComplianceViolation,
  ComplianceFramework,
} from '../types.js';

/**
 * Secret patterns to detect
 */
const SECRET_PATTERNS = [
  { name: 'AWS Access Key', pattern: /AKIA[0-9A-Z]{16}/gi },
  { name: 'AWS Secret Key', pattern: /[A-Za-z0-9/+=]{40}/g, context: 'aws' },
  { name: 'GitHub Token', pattern: /ghp_[A-Za-z0-9]{36}/gi },
  { name: 'GitHub OAuth', pattern: /gho_[A-Za-z0-9]{36}/gi },
  { name: 'GitLab Token', pattern: /glpat-[A-Za-z0-9-]{20}/gi },
  { name: 'Slack Token', pattern: /xox[baprs]-[0-9]{10,13}-[0-9]{10,13}[a-zA-Z0-9-]*/gi },
  { name: 'Generic API Key', pattern: /api[_-]?key['":\s]*[=:]['":\s]*[A-Za-z0-9]{20,}/gi },
  { name: 'Generic Secret', pattern: /secret['":\s]*[=:]['":\s]*[A-Za-z0-9]{20,}/gi },
  { name: 'Private Key', pattern: /-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----/gi },
  { name: 'JWT Token', pattern: /eyJ[A-Za-z0-9-_]+\.eyJ[A-Za-z0-9-_]+\.[A-Za-z0-9-_.+/]*/g },
  { name: 'Basic Auth', pattern: /basic\s+[A-Za-z0-9+/=]{20,}/gi },
  { name: 'Bearer Token', pattern: /bearer\s+[A-Za-z0-9-_.]+/gi },
];

/**
 * Dangerous code patterns
 */
const DANGEROUS_PATTERNS = [
  { name: 'eval()', pattern: /\beval\s*\(/g, severity: 'critical' as const },
  { name: 'Function constructor', pattern: /new\s+Function\s*\(/g, severity: 'critical' as const },
  {
    name: 'innerHTML assignment',
    pattern: /\.innerHTML\s*=/g,
    severity: 'high' as const,
    remediation: 'Use textContent or sanitize input',
  },
  {
    name: 'document.write',
    pattern: /document\.write\s*\(/g,
    severity: 'high' as const,
    remediation: 'Use DOM manipulation methods instead',
  },
  {
    name: 'SQL Injection risk',
    pattern: /`.*\$\{.*\}.*(?:SELECT|INSERT|UPDATE|DELETE|DROP)/gi,
    severity: 'critical' as const,
    remediation: 'Use parameterized queries',
  },
  {
    name: 'Command injection risk',
    pattern: /exec\s*\(\s*`.*\$\{/g,
    severity: 'critical' as const,
    remediation: 'Sanitize user input before shell execution',
  },
];

/**
 * Sensitive file patterns
 */
const SENSITIVE_FILES = [
  '.env',
  '.env.local',
  '.env.production',
  'credentials.json',
  'secrets.json',
  'private.key',
  'id_rsa',
  'id_ed25519',
  '.npmrc',
  '.pypirc',
];

/**
 * No Secrets Rule
 */
const noSecretsRule: ComplianceRule = {
  id: 'platform-no-secrets',
  framework: 'platform',
  name: 'No Hardcoded Secrets',
  description: 'Prevents hardcoded API keys, passwords, and other secrets in code',
  category: 'security',
  severity: 'critical',
  triggers: ['file-write', 'code-generation', 'git-commit'],
  enabled: true,
  autoFixable: false,
  check: (context: ComplianceContext): ComplianceViolation[] => {
    const violations: ComplianceViolation[] = [];
    const content = context.content || context.generatedCode || '';

    if (!content) return violations;

    for (const secretPattern of SECRET_PATTERNS) {
      const matches = content.match(secretPattern.pattern);
      if (matches) {
        for (const match of matches) {
          // Skip if it looks like a placeholder
          if (
            match.includes('xxx') ||
            match.includes('XXX') ||
            match.includes('your-') ||
            match.includes('example')
          ) {
            continue;
          }

          const lines = content.split('\n');
          let lineNumber = 1;
          for (const line of lines) {
            if (line.includes(match)) {
              violations.push({
                ruleId: 'platform-no-secrets',
                framework: 'platform',
                severity: 'critical',
                message: `Potential ${secretPattern.name} detected`,
                location: {
                  file: context.filePath,
                  line: lineNumber,
                  snippet: line.substring(0, 100),
                },
                autoFixable: false,
                remediation:
                  'Move secrets to environment variables or a secrets manager',
              });
              break;
            }
            lineNumber++;
          }
        }
      }
    }

    return violations;
  },
  references: ['OWASP A07:2021 - Security Misconfiguration'],
  tags: ['secrets', 'credentials', 'security'],
};

/**
 * No Dangerous Code Rule
 */
const noDangerousCodeRule: ComplianceRule = {
  id: 'platform-no-dangerous-code',
  framework: 'platform',
  name: 'No Dangerous Code Patterns',
  description: 'Prevents use of dangerous functions like eval() and innerHTML',
  category: 'security',
  severity: 'high',
  triggers: ['code-generation', 'file-write'],
  enabled: true,
  autoFixable: false,
  check: (context: ComplianceContext): ComplianceViolation[] => {
    const violations: ComplianceViolation[] = [];
    const content = context.content || context.generatedCode || '';

    if (!content) return violations;

    for (const pattern of DANGEROUS_PATTERNS) {
      const matches = content.match(pattern.pattern);
      if (matches) {
        const lines = content.split('\n');
        let lineNumber = 1;
        for (const line of lines) {
          if (pattern.pattern.test(line)) {
            violations.push({
              ruleId: 'platform-no-dangerous-code',
              framework: 'platform',
              severity: pattern.severity,
              message: `Dangerous pattern detected: ${pattern.name}`,
              location: {
                file: context.filePath,
                line: lineNumber,
                snippet: line.substring(0, 100),
              },
              autoFixable: false,
              remediation: pattern.remediation || 'Avoid using this pattern',
            });
          }
          lineNumber++;
        }
      }
    }

    return violations;
  },
  references: ['OWASP A03:2021 - Injection'],
  tags: ['injection', 'xss', 'security'],
};

/**
 * No Sensitive Files Rule
 */
const noSensitiveFilesRule: ComplianceRule = {
  id: 'platform-no-sensitive-files',
  framework: 'platform',
  name: 'No Sensitive Files in Repository',
  description: 'Prevents committing sensitive configuration files',
  category: 'security',
  severity: 'critical',
  triggers: ['git-commit', 'file-write'],
  enabled: true,
  autoFixable: false,
  check: (context: ComplianceContext): ComplianceViolation[] => {
    const violations: ComplianceViolation[] = [];

    if (!context.filePath) return violations;

    const fileName = context.filePath.split('/').pop() || '';

    if (SENSITIVE_FILES.some((f) => fileName === f || fileName.endsWith(f))) {
      violations.push({
        ruleId: 'platform-no-sensitive-files',
        framework: 'platform',
        severity: 'critical',
        message: `Sensitive file should not be committed: ${fileName}`,
        location: {
          file: context.filePath,
        },
        autoFixable: false,
        remediation: 'Add this file to .gitignore and use environment variables',
      });
    }

    return violations;
  },
  references: ['CWE-200: Exposure of Sensitive Information'],
  tags: ['files', 'gitignore', 'security'],
};

/**
 * Input Validation Rule
 */
const inputValidationRule: ComplianceRule = {
  id: 'platform-input-validation',
  framework: 'platform',
  name: 'Input Validation Required',
  description: 'Checks for proper input validation in user-facing code',
  category: 'security',
  severity: 'medium',
  triggers: ['code-generation'],
  enabled: true,
  autoFixable: false,
  check: (context: ComplianceContext): ComplianceViolation[] => {
    const violations: ComplianceViolation[] = [];
    const content = context.content || context.generatedCode || '';

    if (!content) return violations;

    // Check for common patterns that should have validation
    const riskyPatterns = [
      { pattern: /req\.body\./g, name: 'Request body access' },
      { pattern: /req\.query\./g, name: 'Query parameter access' },
      { pattern: /req\.params\./g, name: 'URL parameter access' },
      { pattern: /request\.get\(/g, name: 'Request header access' },
    ];

    // Check for validation patterns
    const validationPatterns = [
      /zod/i,
      /yup/i,
      /joi/i,
      /validate/i,
      /sanitize/i,
      /escape/i,
      /parse\w*\(/,
      /typeof\s+\w+\s*[!=]==/,
    ];

    const hasValidation = validationPatterns.some((p) => p.test(content));

    if (!hasValidation) {
      for (const risky of riskyPatterns) {
        if (risky.pattern.test(content)) {
          violations.push({
            ruleId: 'platform-input-validation',
            framework: 'platform',
            severity: 'medium',
            message: `${risky.name} detected without apparent validation`,
            location: {
              file: context.filePath,
            },
            autoFixable: false,
            remediation:
              'Add input validation using a library like Zod, Yup, or Joi',
          });
          break; // One warning is enough
        }
      }
    }

    return violations;
  },
  references: ['OWASP A03:2021 - Injection'],
  tags: ['validation', 'input', 'security'],
};

/**
 * Error Handling Rule
 */
const errorHandlingRule: ComplianceRule = {
  id: 'platform-error-handling',
  framework: 'platform',
  name: 'Proper Error Handling',
  description: 'Ensures errors are handled properly without exposing sensitive information',
  category: 'security',
  severity: 'medium',
  triggers: ['code-generation'],
  enabled: true,
  autoFixable: false,
  check: (context: ComplianceContext): ComplianceViolation[] => {
    const violations: ComplianceViolation[] = [];
    const content = context.content || context.generatedCode || '';

    if (!content) return violations;

    // Check for error exposure patterns
    const exposurePatterns = [
      {
        pattern: /res\.(json|send)\s*\(\s*err/g,
        name: 'Direct error exposure in response',
      },
      {
        pattern: /console\.(log|error)\s*\(\s*err/g,
        name: 'Error logged to console (may be OK for development)',
      },
      { pattern: /throw\s+new\s+Error\s*\(\s*`.*\$\{/g, name: 'Error with dynamic content' },
    ];

    for (const pattern of exposurePatterns) {
      if (pattern.pattern.test(content)) {
        // Skip console.log in non-production contexts
        if (pattern.name.includes('console') && content.includes('development')) {
          continue;
        }

        violations.push({
          ruleId: 'platform-error-handling',
          framework: 'platform',
          severity: 'medium',
          message: pattern.name,
          location: {
            file: context.filePath,
          },
          autoFixable: false,
          remediation:
            'Use a proper error handling middleware that sanitizes error messages',
        });
      }
    }

    return violations;
  },
  references: ['CWE-209: Error Message Information Leak'],
  tags: ['errors', 'logging', 'security'],
};

/**
 * HTTPS Enforcement Rule
 */
const httpsEnforcementRule: ComplianceRule = {
  id: 'platform-https-enforcement',
  framework: 'platform',
  name: 'HTTPS Enforcement',
  description: 'Ensures all external URLs use HTTPS',
  category: 'security',
  severity: 'high',
  triggers: ['code-generation', 'file-write'],
  enabled: true,
  autoFixable: true,
  check: (context: ComplianceContext): ComplianceViolation[] => {
    const violations: ComplianceViolation[] = [];
    const content = context.content || context.generatedCode || '';

    if (!content) return violations;

    // Find HTTP URLs (excluding localhost)
    const httpPattern = /http:\/\/(?!localhost|127\.0\.0\.1)[^\s"'`]+/gi;
    const matches = content.match(httpPattern);

    if (matches) {
      for (const match of matches) {
        violations.push({
          ruleId: 'platform-https-enforcement',
          framework: 'platform',
          severity: 'high',
          message: `Non-HTTPS URL detected: ${match}`,
          location: {
            file: context.filePath,
          },
          autoFixable: true,
          remediation: 'Change http:// to https://',
          context: { originalUrl: match, fixedUrl: match.replace('http://', 'https://') },
        });
      }
    }

    return violations;
  },
  fix: (violation, _context) => {
    if (violation.context?.originalUrl && violation.context?.fixedUrl) {
      return {
        success: true,
        description: `Changed ${violation.context.originalUrl} to ${violation.context.fixedUrl}`,
        changes: [
          {
            type: 'replace',
            location: { file: violation.location?.file || '', line: violation.location?.line || 0 },
            before: violation.context.originalUrl as string,
            after: violation.context.fixedUrl as string,
          },
        ],
      };
    }
    return { success: false, error: 'Missing URL context' };
  },
  references: ['OWASP A02:2021 - Cryptographic Failures'],
  tags: ['https', 'encryption', 'transport'],
};

/**
 * Dependency Security Rule
 */
const dependencySecurityRule: ComplianceRule = {
  id: 'platform-dependency-security',
  framework: 'platform',
  name: 'Dependency Security',
  description: 'Checks for known vulnerable or malicious packages',
  category: 'security',
  severity: 'high',
  triggers: ['file-write'],
  enabled: true,
  autoFixable: false,
  check: (context: ComplianceContext): ComplianceViolation[] => {
    const violations: ComplianceViolation[] = [];

    // Only check package.json files
    if (!context.filePath?.endsWith('package.json')) {
      return violations;
    }

    const content = context.content || '';
    if (!content) return violations;

    try {
      const packageJson = JSON.parse(content);
      const allDeps = {
        ...packageJson.dependencies,
        ...packageJson.devDependencies,
      };

      // Known problematic packages
      const problematicPackages = [
        { name: 'event-stream', reason: 'Known malicious package' },
        { name: 'flatmap-stream', reason: 'Known malicious package' },
        { name: 'ua-parser-js', version: '<0.7.30', reason: 'Crypto-miner injection' },
      ];

      for (const pkg of problematicPackages) {
        if (allDeps[pkg.name]) {
          violations.push({
            ruleId: 'platform-dependency-security',
            framework: 'platform',
            severity: 'critical',
            message: `Problematic package detected: ${pkg.name} - ${pkg.reason}`,
            location: {
              file: context.filePath,
            },
            autoFixable: false,
            remediation: `Remove or replace ${pkg.name}`,
          });
        }
      }
    } catch {
      // Invalid JSON, skip
    }

    return violations;
  },
  references: ['OWASP A06:2021 - Vulnerable and Outdated Components'],
  tags: ['dependencies', 'npm', 'security'],
};

/**
 * All platform rules
 */
export const platformRules: ComplianceRule[] = [
  noSecretsRule,
  noDangerousCodeRule,
  noSensitiveFilesRule,
  inputValidationRule,
  errorHandlingRule,
  httpsEnforcementRule,
  dependencySecurityRule,
];

/**
 * Platform compliance framework
 */
export const platformFramework: ComplianceFramework = {
  id: 'platform',
  name: 'Aigentflow Platform',
  description: 'Mandatory security and code quality rules for all Aigentflow projects',
  mandatory: true,
  version: '1.0.0',
  rules: platformRules,
};

export default platformFramework;
