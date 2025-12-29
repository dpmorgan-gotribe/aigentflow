/**
 * Secret Detection Hook
 *
 * Scans file content for potential secrets and sensitive data.
 */

import type { HookContext, HookResult, HookHandler } from '../types.js';
import { logger } from '../../utils/logger.js';

const log = logger.child({ component: 'secret-detection' });

/**
 * Patterns that indicate potential secrets
 */
const SECRET_PATTERNS: Array<{ name: string; pattern: RegExp; severity: 'high' | 'medium' | 'low' }> =
  [
    // API Keys
    {
      name: 'API Key',
      pattern: /(?:api[_-]?key|apikey)\s*[:=]\s*['"]?[a-zA-Z0-9_-]{20,}['"]?/gi,
      severity: 'high',
    },

    // AWS credentials
    {
      name: 'AWS Access Key',
      pattern: /AKIA[0-9A-Z]{16}/g,
      severity: 'high',
    },
    {
      name: 'AWS Secret Key',
      pattern: /(?:aws[_-]?secret|secret[_-]?key)\s*[:=]\s*['"]?[a-zA-Z0-9/+=]{40}['"]?/gi,
      severity: 'high',
    },

    // Private keys
    {
      name: 'Private Key',
      pattern: /-----BEGIN (?:RSA |DSA |EC |OPENSSH )?PRIVATE KEY-----/g,
      severity: 'high',
    },

    // Passwords in common formats
    {
      name: 'Password',
      pattern: /(?:password|passwd|pwd)\s*[:=]\s*['"][^'"]{4,}['"]/gi,
      severity: 'high',
    },

    // Database connection strings
    {
      name: 'Database Connection String',
      pattern:
        /(?:mongodb|postgres|mysql|redis):\/\/[^:]+:[^@]+@/gi,
      severity: 'high',
    },

    // Generic secrets
    {
      name: 'Secret Token',
      pattern: /(?:secret|token|auth)\s*[:=]\s*['"]?[a-zA-Z0-9_-]{20,}['"]?/gi,
      severity: 'medium',
    },

    // Bearer tokens
    {
      name: 'Bearer Token',
      pattern: /Bearer\s+[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/g,
      severity: 'medium',
    },

    // GitHub tokens
    {
      name: 'GitHub Token',
      pattern: /gh[pousr]_[a-zA-Z0-9]{36,}/g,
      severity: 'high',
    },

    // Slack tokens
    {
      name: 'Slack Token',
      pattern: /xox[baprs]-[a-zA-Z0-9-]+/g,
      severity: 'high',
    },

    // Anthropic API key
    {
      name: 'Anthropic API Key',
      pattern: /sk-ant-[a-zA-Z0-9_-]+/g,
      severity: 'high',
    },

    // OpenAI API key
    {
      name: 'OpenAI API Key',
      pattern: /sk-[a-zA-Z0-9]{48}/g,
      severity: 'high',
    },

    // Environment variable assignments with secrets
    {
      name: 'Hardcoded Environment Secret',
      pattern:
        /(?:export\s+)?(?:API_KEY|SECRET|PASSWORD|TOKEN|CREDENTIALS)\s*=\s*['"]?[a-zA-Z0-9_-]{8,}['"]?/gi,
      severity: 'medium',
    },
  ];

/**
 * Files that should always be scanned
 */
const ALWAYS_SCAN = ['.env', '.env.local', '.env.production', 'credentials.json', 'secrets.yaml'];

/**
 * Files that are typically safe to skip
 */
const SKIP_PATTERNS = [
  /\.test\.(ts|js)$/,
  /\.spec\.(ts|js)$/,
  /\.mock\.(ts|js)$/,
  /node_modules\//,
  /\.git\//,
  /package-lock\.json$/,
  /yarn\.lock$/,
];

/**
 * Result of secret detection
 */
interface SecretMatch {
  pattern: string;
  severity: 'high' | 'medium' | 'low';
  line: number;
  snippet: string;
}

/**
 * Scan content for secrets
 */
function scanForSecrets(content: string, filePath?: string): SecretMatch[] {
  const matches: SecretMatch[] = [];
  const lines = content.split('\n');

  // Check if we should skip this file
  if (filePath && SKIP_PATTERNS.some((p) => p.test(filePath))) {
    // Still scan if it's a sensitive file
    const fileName = filePath.split('/').pop() ?? '';
    if (!ALWAYS_SCAN.includes(fileName)) {
      return [];
    }
  }

  for (let lineNum = 0; lineNum < lines.length; lineNum++) {
    const line = lines[lineNum] ?? '';

    for (const { name, pattern, severity } of SECRET_PATTERNS) {
      // Reset regex state
      pattern.lastIndex = 0;

      if (pattern.test(line)) {
        // Create redacted snippet
        const snippet = redactSecret(line);

        matches.push({
          pattern: name,
          severity,
          line: lineNum + 1,
          snippet,
        });
      }
    }
  }

  return matches;
}

/**
 * Redact secret from line for logging
 */
function redactSecret(line: string): string {
  // Redact anything that looks like a secret value
  return line.replace(
    /(['"])[a-zA-Z0-9_/+=.-]{8,}\1/g,
    '"***REDACTED***"'
  ).replace(
    /[:=]\s*[a-zA-Z0-9_/+=.-]{20,}/g,
    ': ***REDACTED***'
  );
}

/**
 * Secret detection hook handler
 */
export const secretDetectionHook: HookHandler = async (context: HookContext): Promise<HookResult> => {
  const { fileContent, filePath, taskId } = context;

  // If no file content, pass through
  if (!fileContent) {
    return {
      hookName: 'secret-detection',
      success: true,
      blocked: false,
    };
  }

  log.debug('Scanning for secrets', { filePath, taskId });

  const matches = scanForSecrets(fileContent, filePath);

  if (matches.length === 0) {
    return {
      hookName: 'secret-detection',
      success: true,
      blocked: false,
    };
  }

  // Check for high severity matches
  const highSeverity = matches.filter((m) => m.severity === 'high');
  const mediumSeverity = matches.filter((m) => m.severity === 'medium');

  // Log findings
  log.warn('Potential secrets detected', {
    filePath,
    taskId,
    high: highSeverity.length,
    medium: mediumSeverity.length,
    matches: matches.map((m) => ({
      pattern: m.pattern,
      severity: m.severity,
      line: m.line,
    })),
  });

  // Block on high severity
  if (highSeverity.length > 0) {
    return {
      hookName: 'secret-detection',
      success: false,
      blocked: true,
      message: `Potential secrets detected (${highSeverity.length} high severity). File: ${filePath ?? 'unknown'}`,
      data: {
        matches: highSeverity.map((m) => ({
          pattern: m.pattern,
          line: m.line,
          snippet: m.snippet,
        })),
      },
    };
  }

  // Warn but allow on medium severity
  return {
    hookName: 'secret-detection',
    success: true,
    blocked: false,
    message: `Potential secrets detected (${mediumSeverity.length} medium severity). Review recommended.`,
    data: {
      matches: mediumSeverity.map((m) => ({
        pattern: m.pattern,
        line: m.line,
        snippet: m.snippet,
      })),
    },
  };
};

/**
 * Export scan function for direct use
 */
export { scanForSecrets };
