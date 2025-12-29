# 16. Reviewer Agent

> Automated code review agent that ensures quality, security, and adherence to project standards

## Overview

The Reviewer Agent performs comprehensive code review before merging to main. It checks code quality, security vulnerabilities, accessibility compliance, performance patterns, and adherence to project conventions. This is the final quality gate before code is merged.

## Agent Definition

```typescript
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";

// ============================================================================
// Review Categories
// ============================================================================

export const ReviewCategorySchema = z.enum([
  'code_quality',
  'security',
  'accessibility',
  'performance',
  'testing',
  'documentation',
  'architecture',
  'conventions',
]);

export type ReviewCategory = z.infer<typeof ReviewCategorySchema>;

// ============================================================================
// Input Schema
// ============================================================================

export const FileChangeSchema = z.object({
  path: z.string(),
  content: z.string(),
  originalContent: z.string().optional(),
  changeType: z.enum(['added', 'modified', 'deleted']),
});

export const ReviewerInputSchema = z.object({
  feature: z.string(),
  featureDescription: z.string(),
  files: z.array(FileChangeSchema),
  testResults: z.object({
    passed: z.number(),
    failed: z.number(),
    coverage: z.number(),
  }),
  designTokens: z.record(z.string()).optional(),
  projectConventions: z.object({
    namingConventions: z.record(z.string()),
    fileStructure: z.string(),
    codeStyle: z.string(),
  }).optional(),
});

export type ReviewerInput = z.infer<typeof ReviewerInputSchema>;

// ============================================================================
// Output Schema
// ============================================================================

export const SeveritySchema = z.enum(['critical', 'major', 'minor', 'suggestion']);

export const ReviewIssueSchema = z.object({
  id: z.string(),
  category: ReviewCategorySchema,
  severity: SeveritySchema,
  file: z.string(),
  line: z.number().optional(),
  lineEnd: z.number().optional(),
  title: z.string(),
  description: z.string(),
  suggestion: z.string().optional(),
  codeSnippet: z.string().optional(),
  suggestedFix: z.string().optional(),
  references: z.array(z.string()).optional(), // Links to docs, OWASP, WCAG, etc.
});

export const ReviewSummarySchema = z.object({
  approved: z.boolean(),
  approvalConditions: z.array(z.string()).optional(), // What must be fixed before approval
  overallQuality: z.enum(['excellent', 'good', 'acceptable', 'needs_work', 'poor']),
  highlights: z.array(z.string()), // Positive aspects
  concerns: z.array(z.string()),   // Main concerns
});

export const CategoryScoreSchema = z.object({
  category: ReviewCategorySchema,
  score: z.number().min(0).max(100),
  issues: z.number(),
  passed: z.array(z.string()),
  failed: z.array(z.string()),
});

export const ReviewerOutputSchema = z.object({
  feature: z.string(),
  summary: ReviewSummarySchema,
  scores: z.array(CategoryScoreSchema),
  issues: z.array(ReviewIssueSchema),
  statistics: z.object({
    totalFiles: z.number(),
    totalLines: z.number(),
    issuesBySeverity: z.object({
      critical: z.number(),
      major: z.number(),
      minor: z.number(),
      suggestion: z.number(),
    }),
    issuesByCategory: z.record(z.number()),
  }),
});

export type ReviewerOutput = z.infer<typeof ReviewerOutputSchema>;

// ============================================================================
// Reviewer Agent
// ============================================================================

export class ReviewerAgent {
  private client: Anthropic;
  private model = "claude-sonnet-4-20250514";

  constructor() {
    this.client = new Anthropic();
  }

  async review(input: ReviewerInput): Promise<ReviewerOutput> {
    const systemPrompt = this.buildSystemPrompt(input);
    const userPrompt = this.buildUserPrompt(input);

    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 16000,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    });

    const content = response.content[0];
    if (content.type !== "text") {
      throw new Error("Expected text response");
    }

    return this.parseResponse(content.text);
  }

  private buildSystemPrompt(input: ReviewerInput): string {
    let prompt = `You are an expert Code Reviewer Agent performing the final quality gate before merging.

Your review must be thorough but fair. Focus on actionable feedback.

## Review Categories

### 1. CODE QUALITY
- Clean code principles (SOLID, DRY, KISS)
- Proper error handling
- Code readability and maintainability
- Appropriate abstractions
- No dead code or commented-out code

### 2. SECURITY (OWASP Top 10)
- Injection vulnerabilities (SQL, XSS, Command)
- Broken authentication
- Sensitive data exposure
- Security misconfiguration
- Missing input validation
- Insecure dependencies

### 3. ACCESSIBILITY (WCAG 2.1 AA)
- Semantic HTML usage
- ARIA labels and roles
- Keyboard navigation
- Color contrast
- Focus management
- Screen reader compatibility

### 4. PERFORMANCE
- Unnecessary re-renders (React)
- Memory leaks
- Inefficient algorithms (O(n²) when O(n) possible)
- Bundle size impact
- Database query efficiency
- Caching opportunities

### 5. TESTING
- Test coverage adequacy
- Test quality (not just coverage numbers)
- Edge cases covered
- Integration tests present
- No flaky tests

### 6. DOCUMENTATION
- Complex logic explained
- Public APIs documented
- Types fully specified
- README updated if needed

### 7. ARCHITECTURE
- Proper separation of concerns
- Dependency direction (clean architecture)
- No circular dependencies
- Appropriate patterns used

### 8. CONVENTIONS
- Naming conventions followed
- File structure respected
- Code style consistent
- Import ordering`;

    if (input.projectConventions) {
      prompt += `

## Project Conventions
- Naming: ${JSON.stringify(input.projectConventions.namingConventions)}
- Structure: ${input.projectConventions.fileStructure}
- Style: ${input.projectConventions.codeStyle}`;
    }

    prompt += `

## Severity Levels

- **CRITICAL**: Must fix. Security vulnerability, data loss risk, or breaking bug.
- **MAJOR**: Should fix. Significant quality issue, performance problem, or accessibility violation.
- **MINOR**: Nice to fix. Code smell, minor improvement opportunity.
- **SUGGESTION**: Optional. Enhancement idea, alternative approach.

## Approval Criteria

APPROVE if:
- No critical issues
- No more than 2 major issues
- Test coverage >= 80%
- All tests pass

REQUEST CHANGES if:
- Any critical issues
- More than 2 major issues
- Test coverage < 80%
- Tests are failing

Output valid JSON matching ReviewerOutputSchema.`;

    return prompt;
  }

  private buildUserPrompt(input: ReviewerInput): string {
    let prompt = `# Code Review Request

## Feature: ${input.feature}

${input.featureDescription}

## Test Results
- Passed: ${input.testResults.passed}
- Failed: ${input.testResults.failed}
- Coverage: ${input.testResults.coverage}%

## Files to Review

`;

    for (const file of input.files) {
      prompt += `### ${file.path} (${file.changeType})

\`\`\`typescript
${file.content}
\`\`\`

`;
    }

    if (input.designTokens) {
      prompt += `## Design Tokens
\`\`\`json
${JSON.stringify(input.designTokens, null, 2)}
\`\`\`

`;
    }

    prompt += `## Instructions

1. Review each file thoroughly for all categories
2. Identify issues with specific line numbers
3. Provide actionable suggestions with code examples
4. Score each category 0-100
5. Determine if the code is approved or needs changes

Return valid JSON matching ReviewerOutputSchema.`;

    return prompt;
  }

  private parseResponse(text: string): ReviewerOutput {
    const jsonMatch = text.match(/```json\n?([\s\S]*?)\n?```/) ||
                      text.match(/\{[\s\S]*\}/);

    if (!jsonMatch) {
      throw new Error("No JSON found in response");
    }

    const jsonStr = jsonMatch[1] || jsonMatch[0];
    const parsed = JSON.parse(jsonStr);

    return ReviewerOutputSchema.parse(parsed);
  }
}
```

## Specialized Reviewers

```typescript
// ============================================================================
// Security Reviewer
// ============================================================================

export class SecurityReviewer {
  private patterns = {
    sqlInjection: [
      /`.*\$\{.*\}.*`.*query/gi,
      /\.query\s*\(\s*['"`].*\+/gi,
      /execute\s*\(\s*['"`].*\$\{/gi,
    ],
    xss: [
      /dangerouslySetInnerHTML/gi,
      /innerHTML\s*=/gi,
      /document\.write/gi,
      /eval\s*\(/gi,
    ],
    sensitiveData: [
      /password\s*[:=]\s*['"`][^'"]*['"`]/gi,
      /api[_-]?key\s*[:=]\s*['"`][^'"]*['"`]/gi,
      /secret\s*[:=]\s*['"`][^'"]*['"`]/gi,
      /token\s*[:=]\s*['"`][^'"]*['"`]/gi,
    ],
    commandInjection: [
      /exec\s*\(\s*.*\$\{/gi,
      /spawn\s*\(\s*.*\+/gi,
      /child_process/gi,
    ],
    pathTraversal: [
      /\.\.\/|\.\.\\|%2e%2e/gi,
      /readFile\s*\(\s*.*\+/gi,
    ],
  };

  review(files: z.infer<typeof FileChangeSchema>[]): z.infer<typeof ReviewIssueSchema>[] {
    const issues: z.infer<typeof ReviewIssueSchema>[] = [];

    for (const file of files) {
      const lines = file.content.split('\n');

      for (const [vuln, patterns] of Object.entries(this.patterns)) {
        for (const pattern of patterns) {
          lines.forEach((line, index) => {
            if (pattern.test(line)) {
              issues.push({
                id: `sec-${vuln}-${file.path}-${index}`,
                category: 'security',
                severity: this.getSeverity(vuln),
                file: file.path,
                line: index + 1,
                title: this.getTitle(vuln),
                description: this.getDescription(vuln),
                codeSnippet: line.trim(),
                suggestedFix: this.getSuggestedFix(vuln),
                references: this.getReferences(vuln),
              });
            }
          });
        }
      }
    }

    return issues;
  }

  private getSeverity(vuln: string): z.infer<typeof SeveritySchema> {
    const critical = ['sqlInjection', 'commandInjection', 'sensitiveData'];
    const major = ['xss', 'pathTraversal'];
    return critical.includes(vuln) ? 'critical' : major.includes(vuln) ? 'major' : 'minor';
  }

  private getTitle(vuln: string): string {
    const titles: Record<string, string> = {
      sqlInjection: 'Potential SQL Injection',
      xss: 'Potential XSS Vulnerability',
      sensitiveData: 'Hardcoded Sensitive Data',
      commandInjection: 'Potential Command Injection',
      pathTraversal: 'Potential Path Traversal',
    };
    return titles[vuln] || 'Security Issue';
  }

  private getDescription(vuln: string): string {
    const descriptions: Record<string, string> = {
      sqlInjection: 'User input may be directly interpolated into SQL query, allowing SQL injection attacks.',
      xss: 'Unsanitized content is being rendered, potentially allowing XSS attacks.',
      sensitiveData: 'Sensitive data appears to be hardcoded. Use environment variables instead.',
      commandInjection: 'User input may be passed to shell commands, allowing command injection.',
      pathTraversal: 'File paths may be manipulated to access unauthorized files.',
    };
    return descriptions[vuln] || 'A security issue was detected.';
  }

  private getSuggestedFix(vuln: string): string {
    const fixes: Record<string, string> = {
      sqlInjection: 'Use parameterized queries or an ORM with proper escaping.',
      xss: 'Sanitize content before rendering or use framework-provided safe methods.',
      sensitiveData: 'Move sensitive data to environment variables and use process.env.',
      commandInjection: 'Validate and sanitize all inputs before passing to shell commands.',
      pathTraversal: 'Use path.resolve() and validate paths are within allowed directories.',
    };
    return fixes[vuln] || 'Review and fix the security issue.';
  }

  private getReferences(vuln: string): string[] {
    const refs: Record<string, string[]> = {
      sqlInjection: ['https://owasp.org/www-community/attacks/SQL_Injection'],
      xss: ['https://owasp.org/www-community/attacks/xss/'],
      sensitiveData: ['https://owasp.org/Top10/A02_2021-Cryptographic_Failures/'],
      commandInjection: ['https://owasp.org/www-community/attacks/Command_Injection'],
      pathTraversal: ['https://owasp.org/www-community/attacks/Path_Traversal'],
    };
    return refs[vuln] || [];
  }
}

// ============================================================================
// Accessibility Reviewer
// ============================================================================

export class AccessibilityReviewer {
  private rules = [
    {
      id: 'a11y-alt-text',
      pattern: /<img(?![^>]*alt=)[^>]*>/gi,
      severity: 'major' as const,
      title: 'Missing alt text on image',
      description: 'Images must have alt text for screen readers.',
      wcag: '1.1.1',
    },
    {
      id: 'a11y-button-label',
      pattern: /<button[^>]*>(\s*<[^>]+>\s*)*<\/button>/gi,
      severity: 'major' as const,
      title: 'Button has no accessible label',
      description: 'Buttons with only icons must have aria-label.',
      wcag: '4.1.2',
    },
    {
      id: 'a11y-form-label',
      pattern: /<input(?![^>]*(?:aria-label|id=[^>]*<label))[^>]*>/gi,
      severity: 'major' as const,
      title: 'Form input missing label',
      description: 'Form inputs must have associated labels.',
      wcag: '1.3.1',
    },
    {
      id: 'a11y-heading-order',
      pattern: /<h([1-6])[^>]*>.*<\/h\1>.*<h([1-6])/gis,
      severity: 'minor' as const,
      title: 'Heading levels may be out of order',
      description: 'Heading levels should not skip (e.g., h1 to h3).',
      wcag: '1.3.1',
    },
    {
      id: 'a11y-interactive-role',
      pattern: /<div[^>]*onClick(?![^>]*role=)[^>]*>/gi,
      severity: 'major' as const,
      title: 'Interactive element missing role',
      description: 'Clickable divs should have role="button" and keyboard handlers.',
      wcag: '4.1.2',
    },
    {
      id: 'a11y-tabindex-positive',
      pattern: /tabIndex=["']?[1-9]/gi,
      severity: 'minor' as const,
      title: 'Positive tabindex value',
      description: 'Avoid positive tabindex values; use 0 or -1 instead.',
      wcag: '2.4.3',
    },
  ];

  review(files: z.infer<typeof FileChangeSchema>[]): z.infer<typeof ReviewIssueSchema>[] {
    const issues: z.infer<typeof ReviewIssueSchema>[] = [];
    const jsxFiles = files.filter(f =>
      f.path.endsWith('.tsx') || f.path.endsWith('.jsx')
    );

    for (const file of jsxFiles) {
      for (const rule of this.rules) {
        const matches = file.content.matchAll(new RegExp(rule.pattern));

        for (const match of matches) {
          const lineNumber = this.getLineNumber(file.content, match.index || 0);

          issues.push({
            id: `${rule.id}-${file.path}-${lineNumber}`,
            category: 'accessibility',
            severity: rule.severity,
            file: file.path,
            line: lineNumber,
            title: rule.title,
            description: `${rule.description} (WCAG ${rule.wcag})`,
            codeSnippet: match[0].substring(0, 100),
            references: [`https://www.w3.org/WAI/WCAG21/Understanding/${rule.wcag}`],
          });
        }
      }
    }

    return issues;
  }

  private getLineNumber(content: string, index: number): number {
    return content.substring(0, index).split('\n').length;
  }
}

// ============================================================================
// Performance Reviewer
// ============================================================================

export class PerformanceReviewer {
  private patterns = [
    {
      id: 'perf-inline-function',
      pattern: /onClick=\{(?:\(\)\s*=>|function)/g,
      severity: 'minor' as const,
      title: 'Inline function in render',
      description: 'Inline functions cause unnecessary re-renders. Use useCallback.',
    },
    {
      id: 'perf-missing-key',
      pattern: /\.map\([^)]+\)\s*=>\s*<(?!.*key=)/g,
      severity: 'major' as const,
      title: 'Missing key prop in list',
      description: 'List items should have stable, unique key props.',
    },
    {
      id: 'perf-index-key',
      pattern: /key=\{(?:index|i|idx)\}/g,
      severity: 'minor' as const,
      title: 'Using index as key',
      description: 'Using array index as key can cause issues with reordering.',
    },
    {
      id: 'perf-no-memo',
      pattern: /export\s+(?:default\s+)?function\s+\w+/g,
      severity: 'suggestion' as const,
      title: 'Component not memoized',
      description: 'Consider wrapping with React.memo for expensive components.',
    },
    {
      id: 'perf-useeffect-deps',
      pattern: /useEffect\([^,]+,\s*\[\s*\]\)/g,
      severity: 'minor' as const,
      title: 'Empty useEffect dependencies',
      description: 'Empty deps array runs only on mount. Verify this is intended.',
    },
    {
      id: 'perf-n-plus-one',
      pattern: /for.*await.*(?:find|query|get)/gi,
      severity: 'major' as const,
      title: 'Potential N+1 query',
      description: 'Awaiting database queries in a loop causes N+1 problem.',
    },
  ];

  review(files: z.infer<typeof FileChangeSchema>[]): z.infer<typeof ReviewIssueSchema>[] {
    const issues: z.infer<typeof ReviewIssueSchema>[] = [];

    for (const file of files) {
      for (const rule of this.patterns) {
        const matches = file.content.matchAll(new RegExp(rule.pattern));

        for (const match of matches) {
          const lineNumber = this.getLineNumber(file.content, match.index || 0);

          issues.push({
            id: `${rule.id}-${file.path}-${lineNumber}`,
            category: 'performance',
            severity: rule.severity,
            file: file.path,
            line: lineNumber,
            title: rule.title,
            description: rule.description,
            codeSnippet: match[0],
          });
        }
      }
    }

    return issues;
  }

  private getLineNumber(content: string, index: number): number {
    return content.substring(0, index).split('\n').length;
  }
}
```

## Review Orchestrator

```typescript
// ============================================================================
// Review Orchestrator - Combines All Reviewers
// ============================================================================

export class ReviewOrchestrator {
  private aiReviewer: ReviewerAgent;
  private securityReviewer: SecurityReviewer;
  private a11yReviewer: AccessibilityReviewer;
  private perfReviewer: PerformanceReviewer;

  constructor() {
    this.aiReviewer = new ReviewerAgent();
    this.securityReviewer = new SecurityReviewer();
    this.a11yReviewer = new AccessibilityReviewer();
    this.perfReviewer = new PerformanceReviewer();
  }

  async review(input: ReviewerInput): Promise<ReviewerOutput> {
    // Run static analysis in parallel
    const [securityIssues, a11yIssues, perfIssues] = await Promise.all([
      Promise.resolve(this.securityReviewer.review(input.files)),
      Promise.resolve(this.a11yReviewer.review(input.files)),
      Promise.resolve(this.perfReviewer.review(input.files)),
    ]);

    // Run AI review
    const aiResult = await this.aiReviewer.review(input);

    // Merge issues, avoiding duplicates
    const allIssues = this.mergeIssues([
      ...securityIssues,
      ...a11yIssues,
      ...perfIssues,
      ...aiResult.issues,
    ]);

    // Recalculate statistics
    const statistics = this.calculateStatistics(allIssues, input.files);

    // Recalculate scores
    const scores = this.calculateScores(allIssues, aiResult.scores);

    // Determine approval
    const summary = this.determineSummary(allIssues, input.testResults, scores);

    return {
      feature: input.feature,
      summary,
      scores,
      issues: allIssues,
      statistics,
    };
  }

  private mergeIssues(
    issues: z.infer<typeof ReviewIssueSchema>[]
  ): z.infer<typeof ReviewIssueSchema>[] {
    const seen = new Set<string>();
    const merged: z.infer<typeof ReviewIssueSchema>[] = [];

    for (const issue of issues) {
      const key = `${issue.file}:${issue.line}:${issue.title}`;
      if (!seen.has(key)) {
        seen.add(key);
        merged.push(issue);
      }
    }

    return merged.sort((a, b) => {
      const severityOrder = { critical: 0, major: 1, minor: 2, suggestion: 3 };
      return severityOrder[a.severity] - severityOrder[b.severity];
    });
  }

  private calculateStatistics(
    issues: z.infer<typeof ReviewIssueSchema>[],
    files: z.infer<typeof FileChangeSchema>[]
  ) {
    const issuesBySeverity = { critical: 0, major: 0, minor: 0, suggestion: 0 };
    const issuesByCategory: Record<string, number> = {};

    for (const issue of issues) {
      issuesBySeverity[issue.severity]++;
      issuesByCategory[issue.category] = (issuesByCategory[issue.category] || 0) + 1;
    }

    return {
      totalFiles: files.length,
      totalLines: files.reduce((sum, f) => sum + f.content.split('\n').length, 0),
      issuesBySeverity,
      issuesByCategory,
    };
  }

  private calculateScores(
    issues: z.infer<typeof ReviewIssueSchema>[],
    aiScores: z.infer<typeof CategoryScoreSchema>[]
  ): z.infer<typeof CategoryScoreSchema>[] {
    // Adjust AI scores based on static analysis findings
    const categories = ['code_quality', 'security', 'accessibility', 'performance',
                       'testing', 'documentation', 'architecture', 'conventions'];

    return categories.map(cat => {
      const aiScore = aiScores.find(s => s.category === cat);
      const catIssues = issues.filter(i => i.category === cat);

      // Deduct points based on issue severity
      let deduction = 0;
      for (const issue of catIssues) {
        switch (issue.severity) {
          case 'critical': deduction += 25; break;
          case 'major': deduction += 10; break;
          case 'minor': deduction += 3; break;
          case 'suggestion': deduction += 1; break;
        }
      }

      const baseScore = aiScore?.score || 80;
      const finalScore = Math.max(0, baseScore - deduction);

      return {
        category: cat as ReviewCategory,
        score: finalScore,
        issues: catIssues.length,
        passed: aiScore?.passed || [],
        failed: aiScore?.failed || catIssues.map(i => i.title),
      };
    });
  }

  private determineSummary(
    issues: z.infer<typeof ReviewIssueSchema>[],
    testResults: ReviewerInput['testResults'],
    scores: z.infer<typeof CategoryScoreSchema>[]
  ): z.infer<typeof ReviewSummarySchema> {
    const criticalCount = issues.filter(i => i.severity === 'critical').length;
    const majorCount = issues.filter(i => i.severity === 'major').length;
    const testsFailing = testResults.failed > 0;
    const lowCoverage = testResults.coverage < 80;

    const approved = criticalCount === 0 &&
                     majorCount <= 2 &&
                     !testsFailing &&
                     !lowCoverage;

    const approvalConditions: string[] = [];
    if (criticalCount > 0) approvalConditions.push(`Fix ${criticalCount} critical issues`);
    if (majorCount > 2) approvalConditions.push(`Fix at least ${majorCount - 2} major issues`);
    if (testsFailing) approvalConditions.push(`Fix ${testResults.failed} failing tests`);
    if (lowCoverage) approvalConditions.push(`Increase coverage to 80% (currently ${testResults.coverage}%)`);

    const avgScore = scores.reduce((sum, s) => sum + s.score, 0) / scores.length;
    const overallQuality =
      avgScore >= 90 ? 'excellent' :
      avgScore >= 80 ? 'good' :
      avgScore >= 70 ? 'acceptable' :
      avgScore >= 50 ? 'needs_work' : 'poor';

    return {
      approved,
      approvalConditions: approved ? undefined : approvalConditions,
      overallQuality,
      highlights: scores.filter(s => s.score >= 90).map(s => `${s.category}: excellent`),
      concerns: issues
        .filter(i => i.severity === 'critical' || i.severity === 'major')
        .slice(0, 5)
        .map(i => i.title),
    };
  }
}
```

## Integration with Orchestrator

```typescript
// ============================================================================
// StateGraph Integration
// ============================================================================

import { StateGraph, StateContext } from '../CP0-FOUNDATION/03-STATE-MACHINE';

interface ReviewNode {
  id: 'reviewer';
  input: ReviewerInput;
  output: ReviewerOutput;
}

export function addReviewerToGraph(graph: StateGraph): void {
  const orchestrator = new ReviewOrchestrator();

  graph.addNode('reviewer', async (ctx: StateContext) => {
    const input: ReviewerInput = {
      feature: ctx.currentFeature!,
      featureDescription: ctx.featureSpec?.description || '',
      files: Object.entries(ctx.generatedCode || {}).map(([path, content]) => ({
        path,
        content,
        changeType: 'added' as const,
      })),
      testResults: {
        passed: ctx.testResults?.passed || 0,
        failed: ctx.testResults?.failed || 0,
        coverage: ctx.testResults?.coverage?.overall || 0,
      },
      designTokens: ctx.designTokens,
      projectConventions: ctx.projectConventions,
    };

    const result = await orchestrator.review(input);

    return {
      ...ctx,
      reviewResult: result,
      approved: result.summary.approved,
    };
  });

  // Conditional edge based on approval
  graph.addConditionalEdge('reviewer', (ctx: StateContext) => {
    if (ctx.approved) {
      return 'merge_to_main';
    }
    // Route back to appropriate fixer based on issues
    const issues = ctx.reviewResult?.issues || [];
    const hasCriticalSecurity = issues.some(
      i => i.category === 'security' && i.severity === 'critical'
    );
    if (hasCriticalSecurity) {
      return 'security_fix';
    }
    return 'bug_fixer';
  });
}
```

## Example Review Output

```typescript
const exampleOutput: ReviewerOutput = {
  feature: "User Authentication",
  summary: {
    approved: false,
    approvalConditions: [
      "Fix 1 critical security issue",
      "Fix 2 major accessibility issues",
    ],
    overallQuality: "needs_work",
    highlights: [
      "testing: excellent",
      "conventions: excellent",
    ],
    concerns: [
      "Potential XSS vulnerability in error display",
      "Form input missing label",
      "Button has no accessible label",
    ],
  },
  scores: [
    { category: "code_quality", score: 85, issues: 2, passed: ["Clean functions", "Good naming"], failed: ["Some code duplication"] },
    { category: "security", score: 50, issues: 1, passed: ["CSRF protection"], failed: ["XSS vulnerability"] },
    { category: "accessibility", score: 60, issues: 2, passed: ["Semantic HTML"], failed: ["Missing labels", "No keyboard support"] },
    { category: "performance", score: 90, issues: 0, passed: ["Memoized components", "Efficient queries"], failed: [] },
    { category: "testing", score: 95, issues: 0, passed: ["High coverage", "Edge cases tested"], failed: [] },
    { category: "documentation", score: 80, issues: 1, passed: ["Types documented"], failed: ["Complex logic unexplained"] },
    { category: "architecture", score: 85, issues: 0, passed: ["Clean separation"], failed: [] },
    { category: "conventions", score: 95, issues: 0, passed: ["Naming consistent", "Structure followed"], failed: [] },
  ],
  issues: [
    {
      id: "sec-xss-LoginForm.tsx-25",
      category: "security",
      severity: "critical",
      file: "src/components/LoginForm.tsx",
      line: 25,
      title: "Potential XSS Vulnerability",
      description: "dangerouslySetInnerHTML used without sanitization",
      codeSnippet: "dangerouslySetInnerHTML={{ __html: errorMessage }}",
      suggestedFix: "Use textContent or sanitize with DOMPurify",
      references: ["https://owasp.org/www-community/attacks/xss/"],
    },
    {
      id: "a11y-form-label-LoginForm.tsx-30",
      category: "accessibility",
      severity: "major",
      file: "src/components/LoginForm.tsx",
      line: 30,
      title: "Form input missing label",
      description: "Form inputs must have associated labels. (WCAG 1.3.1)",
      suggestedFix: "Add <label htmlFor='email'> or aria-label attribute",
      references: ["https://www.w3.org/WAI/WCAG21/Understanding/1.3.1"],
    },
  ],
  statistics: {
    totalFiles: 5,
    totalLines: 350,
    issuesBySeverity: { critical: 1, major: 2, minor: 3, suggestion: 2 },
    issuesByCategory: { security: 1, accessibility: 2, performance: 1, code_quality: 4 },
  },
};
```

## Validation Checklist

- [ ] ReviewerAgent performs comprehensive AI review
- [ ] SecurityReviewer detects OWASP Top 10 vulnerabilities
- [ ] AccessibilityReviewer checks WCAG 2.1 AA compliance
- [ ] PerformanceReviewer identifies React/backend anti-patterns
- [ ] ReviewOrchestrator merges and deduplicates issues
- [ ] Approval criteria enforced (no critical, ≤2 major, coverage ≥80%)
- [ ] Issue severity correctly assigned
- [ ] Category scores calculated with deductions
- [ ] Integration with StateGraph for routing
- [ ] Clear approval conditions when rejected

## Exports

```typescript
export {
  // Schemas
  ReviewCategorySchema,
  FileChangeSchema,
  ReviewerInputSchema,
  SeveritySchema,
  ReviewIssueSchema,
  ReviewSummarySchema,
  CategoryScoreSchema,
  ReviewerOutputSchema,

  // Types
  ReviewCategory,
  ReviewerInput,
  ReviewerOutput,

  // Classes
  ReviewerAgent,
  SecurityReviewer,
  AccessibilityReviewer,
  PerformanceReviewer,
  ReviewOrchestrator,

  // Graph integration
  addReviewerToGraph,
};
```
