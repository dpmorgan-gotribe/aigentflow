/**
 * Security Skill Pack
 *
 * Skills for secure code development.
 */

import type { SkillPack, Skill } from '../types.js';

/**
 * OWASP Top 10 awareness skill
 */
const owaspSkill: Skill = {
  id: 'owasp-top-10',
  name: 'OWASP Top 10',
  description: 'Awareness of common web security vulnerabilities',
  category: 'security',
  priority: 'critical',
  version: '1.0.0',
  tokenEstimate: 500,
  conditions: [
    { field: 'taskType', operator: 'contains', value: ['feature', 'api'] },
  ],
  dependencies: [],
  conflicts: [],
  content: `## OWASP Top 10 Vulnerabilities

### A01: Broken Access Control
- Verify permissions on every request
- Deny by default
- Enforce record ownership
- Log access control failures

### A02: Cryptographic Failures
- Use strong encryption (AES-256, RSA-2048+)
- Don't store sensitive data unnecessarily
- Use TLS for data in transit
- Hash passwords with bcrypt/argon2

### A03: Injection
- Use parameterized queries
- Validate and sanitize input
- Escape output contextually
- Use ORM with parameter binding

### A04: Insecure Design
- Threat model during design
- Separate tenants properly
- Rate limit critical operations
- Fail securely

### A05: Security Misconfiguration
- Remove default accounts/credentials
- Disable unnecessary features
- Apply security headers
- Keep dependencies updated`,
  examples: [
    {
      title: 'Parameterized query',
      input: 'User query',
      output: "db.query('SELECT * FROM users WHERE id = ?', [userId])",
    },
  ],
  tags: ['owasp', 'security', 'vulnerabilities', 'web'],
  enabled: true,
};

/**
 * Input validation skill
 */
const inputValidationSkill: Skill = {
  id: 'input-validation',
  name: 'Input Validation',
  description: 'Secure input validation practices',
  category: 'security',
  priority: 'critical',
  version: '1.0.0',
  tokenEstimate: 350,
  conditions: [],  // Always applicable
  dependencies: [],
  conflicts: [],
  content: `## Input Validation

### Principles
- Never trust user input
- Validate at system boundaries
- Whitelist over blacklist
- Validate type, length, format, range

### Validation Strategy
- Schema validation for structured data
- Regular expressions for patterns
- Type coercion after validation
- Sanitize before storage/display

### Common Validations
- Email: Use established library
- URLs: Validate scheme (http/https)
- Paths: Prevent directory traversal
- Numbers: Check bounds

### Error Handling
- Return generic error messages
- Log detailed errors server-side
- Don't reveal validation rules in errors
- Rate limit validation endpoints`,
  examples: [
    {
      title: 'Path validation',
      input: 'File path input',
      output: "if (path.includes('..')) throw new Error('Invalid path');",
    },
  ],
  tags: ['validation', 'security', 'input'],
  enabled: true,
};

/**
 * Authentication security skill
 */
const authSecuritySkill: Skill = {
  id: 'auth-security',
  name: 'Authentication Security',
  description: 'Secure authentication practices',
  category: 'security',
  priority: 'critical',
  version: '1.0.0',
  tokenEstimate: 400,
  conditions: [
    { field: 'taskType', operator: 'contains', value: ['auth', 'login', 'authentication'] },
  ],
  dependencies: [],
  conflicts: [],
  content: `## Authentication Security

### Password Handling
- Hash with bcrypt/argon2 (not MD5/SHA1)
- Minimum 12 character passwords
- Check against breach databases
- Never log passwords

### Session Management
- Generate cryptographically random IDs
- Regenerate session on auth change
- Set secure cookie flags (HttpOnly, Secure, SameSite)
- Implement idle and absolute timeouts

### Token Security (JWT)
- Use strong signing algorithm (RS256, ES256)
- Set appropriate expiration
- Validate all claims
- Store refresh tokens securely

### Multi-Factor Authentication
- Implement TOTP as option
- Backup codes for recovery
- Rate limit verification attempts
- Log MFA events`,
  examples: [
    {
      title: 'Secure cookie',
      input: 'Session cookie',
      output: "res.cookie('session', token, { httpOnly: true, secure: true, sameSite: 'strict' })",
    },
  ],
  tags: ['authentication', 'security', 'passwords', 'sessions'],
  enabled: true,
};

/**
 * API security skill
 */
const apiSecuritySkill: Skill = {
  id: 'api-security',
  name: 'API Security',
  description: 'Secure API development practices',
  category: 'security',
  priority: 'high',
  version: '1.0.0',
  tokenEstimate: 400,
  conditions: [
    { field: 'taskType', operator: 'contains', value: ['api', 'endpoint', 'rest'] },
  ],
  dependencies: [],
  conflicts: [],
  content: `## API Security

### Authentication & Authorization
- Use OAuth 2.0 / OpenID Connect
- Implement API keys for service-to-service
- Verify permissions on every request
- Use short-lived access tokens

### Rate Limiting
- Implement per-user limits
- Use sliding window algorithm
- Return 429 with Retry-After
- Different limits for different endpoints

### Request Validation
- Validate Content-Type header
- Limit request body size
- Validate JSON structure
- Check required fields

### Response Security
- Use correct Content-Type
- Remove sensitive headers (X-Powered-By)
- Set security headers (CSP, HSTS)
- Filter sensitive data from responses`,
  examples: [
    {
      title: 'Rate limit header',
      input: 'Rate limit response',
      output: "res.set('X-RateLimit-Remaining', remaining);",
    },
  ],
  tags: ['api', 'security', 'rest', 'rate-limiting'],
  enabled: true,
};

/**
 * Secret management skill
 */
const secretsSkill: Skill = {
  id: 'secret-management',
  name: 'Secret Management',
  description: 'Secure handling of secrets and credentials',
  category: 'security',
  priority: 'critical',
  version: '1.0.0',
  tokenEstimate: 300,
  conditions: [],
  dependencies: [],
  conflicts: [],
  content: `## Secret Management

### Storage
- Never commit secrets to version control
- Use environment variables or secret managers
- Encrypt secrets at rest
- Rotate secrets regularly

### Access
- Principle of least privilege
- Audit secret access
- Different secrets per environment
- Never log secrets

### .gitignore
- .env files
- *.pem, *.key files
- credentials.json
- secrets.yaml

### Detection
- Use pre-commit hooks
- Scan for patterns (API keys, tokens)
- Block commits with secrets
- Alert on exposure`,
  examples: [
    {
      title: 'Environment variable',
      input: 'API key',
      output: "const apiKey = process.env.API_KEY ?? throwError('API_KEY required');",
    },
  ],
  tags: ['secrets', 'security', 'credentials'],
  enabled: true,
};

/**
 * XSS prevention skill
 */
const xssPreventionSkill: Skill = {
  id: 'xss-prevention',
  name: 'XSS Prevention',
  description: 'Cross-site scripting prevention techniques',
  category: 'security',
  priority: 'high',
  version: '1.0.0',
  tokenEstimate: 300,
  conditions: [
    { field: 'frameworks', operator: 'contains', value: ['react', 'vue', 'angular'] },
  ],
  dependencies: [],
  conflicts: [],
  content: `## XSS Prevention

### Output Encoding
- HTML encode for HTML context
- JavaScript encode for script context
- URL encode for URL context
- CSS encode for style context

### Framework Protection
- React escapes by default (JSX)
- Avoid dangerouslySetInnerHTML
- Vue uses v-text by default
- Use v-html only with sanitized content

### Content Security Policy
- Restrict script sources
- Disable inline scripts
- Use nonce for necessary inline
- Report violations

### Sanitization
- Use DOMPurify for HTML
- Strip dangerous tags/attributes
- Whitelist allowed elements`,
  examples: [
    {
      title: 'CSP header',
      input: 'Security header',
      output: "res.set('Content-Security-Policy', \"default-src 'self'; script-src 'self'\")",
    },
  ],
  tags: ['xss', 'security', 'frontend', 'csp'],
  enabled: true,
};

/**
 * Security skill pack
 */
export const securitySkillPack: SkillPack = {
  id: 'built-in-security',
  name: 'Security Skills',
  description: 'Built-in skills for secure code development',
  version: '1.0.0',
  skills: [
    owaspSkill,
    inputValidationSkill,
    authSecuritySkill,
    apiSecuritySkill,
    secretsSkill,
    xssPreventionSkill,
  ],
  author: 'Aigentflow',
};

export default securitySkillPack;
