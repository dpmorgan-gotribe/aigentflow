/**
 * Security Scan Hook
 *
 * Scans code for common security vulnerabilities.
 */

import type { HookContext, HookResult, HookHandler } from '../types.js';
import { logger } from '../../utils/logger.js';

const log = logger.child({ component: 'security-scan' });

/**
 * Security vulnerability pattern
 */
interface SecurityPattern {
  name: string;
  category: string;
  pattern: RegExp;
  severity: 'critical' | 'high' | 'medium' | 'low';
  message: string;
  cwe?: string;
}

/**
 * Security vulnerability patterns (OWASP-inspired)
 */
const SECURITY_PATTERNS: SecurityPattern[] = [
  // SQL Injection
  {
    name: 'SQL Injection',
    category: 'injection',
    pattern: /(?:execute|query|raw)\s*\(\s*[`'"].*\$\{/gi,
    severity: 'critical',
    message: 'Potential SQL injection - use parameterized queries',
    cwe: 'CWE-89',
  },
  {
    name: 'SQL String Concatenation',
    category: 'injection',
    pattern: /(?:SELECT|INSERT|UPDATE|DELETE|FROM|WHERE).*\+\s*(?:req\.|params\.|query\.|body\.)/gi,
    severity: 'critical',
    message: 'SQL query built with string concatenation - use parameterized queries',
    cwe: 'CWE-89',
  },

  // Command Injection
  {
    name: 'Command Injection',
    category: 'injection',
    pattern: /(?:exec|spawn|execSync|spawnSync)\s*\(\s*[`'"].*\$\{/gi,
    severity: 'critical',
    message: 'Potential command injection - sanitize inputs',
    cwe: 'CWE-78',
  },
  {
    name: 'Shell Command with User Input',
    category: 'injection',
    pattern: /(?:child_process|shelljs).*(?:exec|spawn).*(?:req\.|params\.|query\.|body\.)/gi,
    severity: 'critical',
    message: 'Shell command may include user input - validate and escape',
    cwe: 'CWE-78',
  },

  // XSS
  {
    name: 'Potential XSS',
    category: 'xss',
    pattern: /innerHTML\s*=|document\.write\s*\(/gi,
    severity: 'high',
    message: 'Potential XSS - use textContent or sanitize HTML',
    cwe: 'CWE-79',
  },
  {
    name: 'Dangerous HTML Rendering',
    category: 'xss',
    pattern: /dangerouslySetInnerHTML|v-html/gi,
    severity: 'medium',
    message: 'Dangerous HTML rendering - ensure content is sanitized',
    cwe: 'CWE-79',
  },

  // Path Traversal
  {
    name: 'Path Traversal',
    category: 'path-traversal',
    pattern: /(?:readFile|writeFile|unlink|rmdir)\s*\(.*(?:req\.|params\.|query\.|body\.)/gi,
    severity: 'high',
    message: 'Potential path traversal - validate file paths',
    cwe: 'CWE-22',
  },

  // Insecure Randomness
  {
    name: 'Insecure Randomness',
    category: 'crypto',
    pattern: /Math\.random\s*\(\)/g,
    severity: 'medium',
    message: 'Math.random() is not cryptographically secure - use crypto.randomBytes()',
    cwe: 'CWE-330',
  },

  // Hardcoded Credentials
  {
    name: 'Hardcoded Password',
    category: 'credentials',
    pattern: /(?:password|passwd|pwd)\s*[:=]\s*['"][^'"]+['"]/gi,
    severity: 'high',
    message: 'Hardcoded password detected - use environment variables',
    cwe: 'CWE-798',
  },

  // Insecure Cookie
  {
    name: 'Insecure Cookie',
    category: 'cookies',
    pattern: /cookie.*(?:httpOnly|secure)\s*:\s*false/gi,
    severity: 'medium',
    message: 'Cookie security flags disabled - enable httpOnly and secure',
    cwe: 'CWE-614',
  },

  // Eval Usage
  {
    name: 'Eval Usage',
    category: 'injection',
    pattern: /\beval\s*\(/g,
    severity: 'high',
    message: 'eval() is dangerous - avoid using it',
    cwe: 'CWE-95',
  },

  // Prototype Pollution
  {
    name: 'Prototype Pollution',
    category: 'prototype-pollution',
    pattern: /__proto__|constructor\s*\[|Object\.assign\s*\(\s*\{\}/gi,
    severity: 'medium',
    message: 'Potential prototype pollution vulnerability',
    cwe: 'CWE-1321',
  },

  // Insecure Deserialization
  {
    name: 'Unsafe Deserialization',
    category: 'deserialization',
    pattern: /JSON\.parse\s*\(.*(?:req\.|params\.|query\.|body\.)/gi,
    severity: 'low',
    message: 'Parsing untrusted JSON - validate structure after parsing',
    cwe: 'CWE-502',
  },

  // Debug/Development Code
  {
    name: 'Debug Code in Production',
    category: 'debug',
    pattern: /console\.log|debugger\s*;/g,
    severity: 'low',
    message: 'Debug code should be removed for production',
  },

  // Disabled TLS Verification
  {
    name: 'Disabled TLS Verification',
    category: 'tls',
    pattern: /rejectUnauthorized\s*:\s*false|NODE_TLS_REJECT_UNAUTHORIZED\s*=\s*['"]?0/gi,
    severity: 'high',
    message: 'TLS certificate verification disabled - security risk',
    cwe: 'CWE-295',
  },

  // CORS Misconfiguration
  {
    name: 'CORS Allow All',
    category: 'cors',
    pattern: /Access-Control-Allow-Origin.*\*/gi,
    severity: 'medium',
    message: 'CORS allows all origins - restrict if possible',
    cwe: 'CWE-942',
  },
];

/**
 * Security scan result
 */
interface SecurityFinding {
  name: string;
  category: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  message: string;
  line: number;
  snippet: string;
  cwe?: string;
}

/**
 * Scan content for security vulnerabilities
 */
function scanForVulnerabilities(content: string, filePath?: string): SecurityFinding[] {
  const findings: SecurityFinding[] = [];
  const lines = content.split('\n');

  // Skip test files for some checks
  const isTestFile = filePath && /\.(test|spec)\.[jt]sx?$/.test(filePath);

  for (let lineNum = 0; lineNum < lines.length; lineNum++) {
    const line = lines[lineNum] ?? '';

    // Skip comments
    const trimmedLine = line.trim();
    if (trimmedLine.startsWith('//') || trimmedLine.startsWith('*') || trimmedLine.startsWith('/*')) {
      continue;
    }

    for (const pattern of SECURITY_PATTERNS) {
      // Reset regex state
      pattern.pattern.lastIndex = 0;

      // Skip low severity in test files
      if (isTestFile && (pattern.severity === 'low' || pattern.category === 'debug')) {
        continue;
      }

      if (pattern.pattern.test(line)) {
        findings.push({
          name: pattern.name,
          category: pattern.category,
          severity: pattern.severity,
          message: pattern.message,
          line: lineNum + 1,
          snippet: line.trim().substring(0, 100),
          cwe: pattern.cwe,
        });
      }
    }
  }

  return findings;
}

/**
 * Get severity score for sorting
 */
function severityScore(severity: string): number {
  switch (severity) {
    case 'critical':
      return 4;
    case 'high':
      return 3;
    case 'medium':
      return 2;
    case 'low':
      return 1;
    default:
      return 0;
  }
}

/**
 * Security scan hook handler
 */
export const securityScanHook: HookHandler = async (context: HookContext): Promise<HookResult> => {
  const { fileContent, filePath, taskId } = context;

  // If no file content, pass through
  if (!fileContent) {
    return {
      hookName: 'security-scan',
      success: true,
      blocked: false,
    };
  }

  // Only scan code files
  if (filePath && !/\.[jt]sx?$/.test(filePath)) {
    return {
      hookName: 'security-scan',
      success: true,
      blocked: false,
    };
  }

  log.debug('Scanning for security vulnerabilities', { filePath, taskId });

  const findings = scanForVulnerabilities(fileContent, filePath);

  if (findings.length === 0) {
    return {
      hookName: 'security-scan',
      success: true,
      blocked: false,
    };
  }

  // Sort by severity
  findings.sort((a, b) => severityScore(b.severity) - severityScore(a.severity));

  // Count by severity
  const critical = findings.filter((f) => f.severity === 'critical');
  const high = findings.filter((f) => f.severity === 'high');
  const medium = findings.filter((f) => f.severity === 'medium');
  const low = findings.filter((f) => f.severity === 'low');

  log.warn('Security vulnerabilities detected', {
    filePath,
    taskId,
    critical: critical.length,
    high: high.length,
    medium: medium.length,
    low: low.length,
    findings: findings.map((f) => ({
      name: f.name,
      severity: f.severity,
      line: f.line,
      cwe: f.cwe,
    })),
  });

  // Block on critical vulnerabilities
  if (critical.length > 0) {
    return {
      hookName: 'security-scan',
      success: false,
      blocked: true,
      message: `Critical security vulnerabilities detected (${critical.length}). File: ${filePath ?? 'unknown'}`,
      data: {
        findings: critical.map((f) => ({
          name: f.name,
          message: f.message,
          line: f.line,
          cwe: f.cwe,
        })),
      },
    };
  }

  // Warn but allow on other severities
  return {
    hookName: 'security-scan',
    success: true,
    blocked: false,
    message: `Security findings: ${high.length} high, ${medium.length} medium, ${low.length} low`,
    data: {
      findings: findings.map((f) => ({
        name: f.name,
        severity: f.severity,
        message: f.message,
        line: f.line,
        cwe: f.cwe,
      })),
    },
  };
};

/**
 * Export scan function for direct use
 */
export { scanForVulnerabilities };
