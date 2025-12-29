# Step 14: Tester Agent

> **Checkpoint:** CP3 - Build & Test
> **Previous Step:** 13-BACKEND-DEVELOPER.md
> **Next Step:** 15-BUG-FIXER-AGENT.md

---

## Overview

The Tester Agent executes test suites, generates coverage reports, and identifies failures. It's a critical component of the TDD workflow, validating that code meets quality standards before proceeding.

Key responsibilities:
- Execute unit, integration, and e2e tests
- Generate coverage reports
- Identify and categorize test failures
- Create structured failure reports for Bug Fixer
- Run security and accessibility audits
- Track test metrics over time

---

## Deliverables

1. `src/agents/agents/tester.ts` - Tester agent implementation
2. `src/agents/schemas/tester-output.ts` - Output schema
3. `src/agents/executors/test-runner.ts` - Test execution wrapper

---

## 1. Output Schema (`src/agents/schemas/tester-output.ts`)

```typescript
/**
 * Tester Agent Output Schema
 *
 * Defines structured test results, coverage reports, and failure details.
 */

import { z } from 'zod';

/**
 * Test result status
 */
export const TestStatusSchema = z.enum([
  'passed',
  'failed',
  'skipped',
  'todo',
  'error', // Test threw an unexpected error
]);

export type TestStatus = z.infer<typeof TestStatusSchema>;

/**
 * Individual test result
 */
export const TestResultSchema = z.object({
  id: z.string(),
  name: z.string(),
  fullName: z.string(), // Including describe blocks
  status: TestStatusSchema,
  duration: z.number(), // ms
  filePath: z.string(),
  lineNumber: z.number().optional(),

  // Failure details (if failed)
  error: z.object({
    message: z.string(),
    stack: z.string().optional(),
    expected: z.unknown().optional(),
    actual: z.unknown().optional(),
    diff: z.string().optional(),
  }).optional(),

  // Retry info
  retries: z.number().optional(),
  retriedFrom: z.string().optional(), // Previous test id

  // Categorization
  tags: z.array(z.string()).optional(),
  type: z.enum(['unit', 'integration', 'e2e', 'a11y', 'security', 'performance']),
});

export type TestResult = z.infer<typeof TestResultSchema>;

/**
 * Test suite result
 */
export const TestSuiteResultSchema = z.object({
  name: z.string(),
  filePath: z.string(),
  duration: z.number(),
  tests: z.array(TestResultSchema),
  passed: z.number(),
  failed: z.number(),
  skipped: z.number(),
  todo: z.number(),
});

export type TestSuiteResult = z.infer<typeof TestSuiteResultSchema>;

/**
 * Coverage data for a file
 */
export const FileCoverageSchema = z.object({
  path: z.string(),
  statements: z.object({
    total: z.number(),
    covered: z.number(),
    percentage: z.number(),
  }),
  branches: z.object({
    total: z.number(),
    covered: z.number(),
    percentage: z.number(),
  }),
  functions: z.object({
    total: z.number(),
    covered: z.number(),
    percentage: z.number(),
  }),
  lines: z.object({
    total: z.number(),
    covered: z.number(),
    percentage: z.number(),
  }),
  uncoveredLines: z.array(z.number()),
});

export type FileCoverage = z.infer<typeof FileCoverageSchema>;

/**
 * Overall coverage summary
 */
export const CoverageSummarySchema = z.object({
  statements: z.number(),
  branches: z.number(),
  functions: z.number(),
  lines: z.number(),
  files: z.array(FileCoverageSchema),
  thresholds: z.object({
    statements: z.number(),
    branches: z.number(),
    functions: z.number(),
    lines: z.number(),
  }),
  meetsThresholds: z.boolean(),
});

export type CoverageSummary = z.infer<typeof CoverageSummarySchema>;

/**
 * Categorized failure for bug fixing
 */
export const FailureCategorySchema = z.enum([
  'assertion', // expect() failed
  'type_error', // TypeScript type error at runtime
  'reference_error', // Undefined variable/function
  'syntax_error', // Parse error
  'timeout', // Test timed out
  'network', // API/fetch failed
  'database', // DB operation failed
  'validation', // Input validation failed
  'auth', // Authentication/authorization failed
  'async', // Promise rejection, async issue
  'mock', // Mock setup issue
  'environment', // Missing env var, config issue
  'unknown',
]);

export type FailureCategory = z.infer<typeof FailureCategorySchema>;

/**
 * Detailed failure analysis for Bug Fixer
 */
export const FailureAnalysisSchema = z.object({
  testId: z.string(),
  testName: z.string(),
  filePath: z.string(),
  lineNumber: z.number().optional(),

  // Categorization
  category: FailureCategorySchema,
  severity: z.enum(['critical', 'major', 'minor']),

  // Error details
  errorMessage: z.string(),
  errorStack: z.string().optional(),

  // Context
  sourceCode: z.string().optional(), // Relevant code snippet
  testCode: z.string().optional(), // The test that failed
  expectedBehavior: z.string(),
  actualBehavior: z.string(),

  // Suggestions
  possibleCauses: z.array(z.string()),
  suggestedFixes: z.array(z.string()),

  // Related files
  relatedFiles: z.array(z.string()),
});

export type FailureAnalysis = z.infer<typeof FailureAnalysisSchema>;

/**
 * Security audit result
 */
export const SecurityAuditResultSchema = z.object({
  passed: z.boolean(),
  vulnerabilities: z.array(z.object({
    severity: z.enum(['critical', 'high', 'medium', 'low', 'info']),
    type: z.string(),
    description: z.string(),
    file: z.string().optional(),
    line: z.number().optional(),
    recommendation: z.string(),
  })),
  summary: z.object({
    critical: z.number(),
    high: z.number(),
    medium: z.number(),
    low: z.number(),
  }),
});

export type SecurityAuditResult = z.infer<typeof SecurityAuditResultSchema>;

/**
 * Accessibility audit result
 */
export const A11yAuditResultSchema = z.object({
  passed: z.boolean(),
  violations: z.array(z.object({
    id: z.string(),
    impact: z.enum(['critical', 'serious', 'moderate', 'minor']),
    description: z.string(),
    help: z.string(),
    helpUrl: z.string(),
    nodes: z.array(z.object({
      html: z.string(),
      target: z.array(z.string()),
      failureSummary: z.string(),
    })),
  })),
  passes: z.number(),
  incomplete: z.number(),
});

export type A11yAuditResult = z.infer<typeof A11yAuditResultSchema>;

/**
 * Complete Tester output
 */
export const TesterOutputSchema = z.object({
  executionId: z.string(),
  startedAt: z.string(),
  completedAt: z.string(),
  duration: z.number(),

  // Test results
  suites: z.array(TestSuiteResultSchema),
  summary: z.object({
    total: z.number(),
    passed: z.number(),
    failed: z.number(),
    skipped: z.number(),
    todo: z.number(),
    passRate: z.number(),
  }),

  // Coverage
  coverage: CoverageSummarySchema.optional(),

  // Failure analysis (for Bug Fixer)
  failures: z.array(FailureAnalysisSchema),

  // Audits
  securityAudit: SecurityAuditResultSchema.optional(),
  accessibilityAudit: A11yAuditResultSchema.optional(),

  // Overall status
  status: z.enum(['passed', 'failed', 'error']),
  canProceed: z.boolean(), // Whether quality gates are met

  // Quality gates
  qualityGates: z.object({
    testsPass: z.boolean(),
    coverageMet: z.boolean(),
    noSecurityIssues: z.boolean(),
    noA11yViolations: z.boolean(),
  }),

  // Recommendations
  recommendations: z.array(z.string()),
});

export type TesterOutput = z.infer<typeof TesterOutputSchema>;
```

---

## 2. Tester Agent (`src/agents/agents/tester.ts`)

```typescript
/**
 * Tester Agent
 *
 * Executes test suites, generates coverage reports, and analyzes failures.
 * Provides structured output for the Bug Fixer agent.
 */

import { BaseAgent } from '../base-agent';
import { RegisterAgent } from '../registry';
import {
  AgentMetadata,
  AgentContext,
  AgentRequest,
  AgentOutput,
  Artifact,
  RoutingHints,
  AgentType,
} from '../types';
import {
  TesterOutput,
  TesterOutputSchema,
  TestResult,
  FailureAnalysis,
  FailureCategory,
} from '../schemas/tester-output';
import { TestRunner, TestRunnerConfig } from '../executors/test-runner';
import { logger } from '../../utils/logger';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';

/**
 * Agent metadata
 */
const TESTER_METADATA: AgentMetadata = {
  id: AgentType.TESTER,
  name: 'Tester',
  description: 'Executes tests, generates coverage reports, and analyzes failures',
  version: '1.0.0',
  capabilities: [
    {
      name: 'test_execution',
      description: 'Run unit, integration, and e2e test suites',
      inputTypes: ['test_files', 'source_code'],
      outputTypes: ['test_results', 'coverage_report'],
    },
    {
      name: 'failure_analysis',
      description: 'Analyze test failures and categorize issues',
      inputTypes: ['test_results'],
      outputTypes: ['failure_analysis', 'fix_suggestions'],
    },
    {
      name: 'security_audit',
      description: 'Run security vulnerability scans',
      inputTypes: ['source_code'],
      outputTypes: ['security_report'],
    },
    {
      name: 'accessibility_audit',
      description: 'Run accessibility compliance checks',
      inputTypes: ['components', 'pages'],
      outputTypes: ['a11y_report'],
    },
  ],
  requiredContext: [
    { type: 'current_task', required: true },
    { type: 'source_code', required: true },
    { type: 'test_files', required: true },
  ],
  outputSchema: 'tester-output',
};

/**
 * Default coverage thresholds
 */
const DEFAULT_THRESHOLDS = {
  statements: 80,
  branches: 75,
  functions: 80,
  lines: 80,
};

/**
 * Tester Agent implementation
 */
@RegisterAgent
export class TesterAgent extends BaseAgent {
  private testRunner: TestRunner;

  constructor() {
    super(TESTER_METADATA);
    this.testRunner = new TestRunner();
  }

  /**
   * Override execute to run tests directly
   */
  async execute(request: AgentRequest): Promise<AgentOutput> {
    const startTime = Date.now();
    const executionId = uuidv4();

    this.log('info', 'Starting test execution', { executionId });

    try {
      // Determine test configuration
      const config = this.buildTestConfig(request);

      // Run tests
      const testResults = await this.testRunner.run(config);

      // Analyze failures
      const failures = this.analyzeFailures(testResults.results);

      // Run optional audits
      const securityAudit = config.runSecurityAudit
        ? await this.runSecurityAudit(request.context.projectId)
        : undefined;

      const a11yAudit = config.runA11yAudit
        ? await this.runAccessibilityAudit(request.context.projectId)
        : undefined;

      // Build output
      const output = this.buildOutput(
        executionId,
        startTime,
        testResults,
        failures,
        securityAudit,
        a11yAudit
      );

      // Generate artifacts
      const artifacts = await this.generateArtifacts(output, request);

      // Generate routing hints
      const routingHints = this.generateRoutingHints(output, artifacts, request);

      return {
        agentId: this.metadata.id,
        success: output.status === 'passed',
        result: output,
        artifacts,
        routingHints,
        metrics: {
          startTime: new Date(startTime),
          endTime: new Date(),
          durationMs: Date.now() - startTime,
          tokensUsed: 0,
          llmCalls: 0,
          retryCount: 0,
          cacheHits: 0,
        },
      };
    } catch (error) {
      this.log('error', 'Test execution failed', { error });

      return {
        agentId: this.metadata.id,
        success: false,
        result: null,
        artifacts: [],
        routingHints: {
          suggestNext: [],
          skipAgents: [],
          needsApproval: false,
          hasFailures: true,
          isComplete: false,
          notes: `Test execution error: ${error}`,
        },
        metrics: {
          startTime: new Date(startTime),
          endTime: new Date(),
          durationMs: Date.now() - startTime,
          tokensUsed: 0,
          llmCalls: 0,
          retryCount: 0,
          cacheHits: 0,
        },
      };
    }
  }

  /**
   * Build test configuration from request
   */
  private buildTestConfig(request: AgentRequest): TestRunnerConfig {
    const projectPath = request.context.projectId;
    const task = request.context.task;

    return {
      projectPath,
      testPatterns: ['**/*.test.ts', '**/*.test.tsx', '**/*.spec.ts'],
      coverageEnabled: true,
      coverageThresholds: DEFAULT_THRESHOLDS,
      runSecurityAudit: task.taskType !== 'docs',
      runA11yAudit: task.requiresUI,
      timeout: 60000, // 1 minute per test
      maxWorkers: 4,
      bail: false, // Run all tests even if some fail
      verbose: true,
    };
  }

  /**
   * Analyze test failures and categorize them
   */
  private analyzeFailures(results: TestResult[]): FailureAnalysis[] {
    const failures = results.filter(r => r.status === 'failed' || r.status === 'error');

    return failures.map(failure => {
      const category = this.categorizeFailure(failure);
      const analysis = this.generateFailureAnalysis(failure, category);
      return analysis;
    });
  }

  /**
   * Categorize a failure based on error type
   */
  private categorizeFailure(failure: TestResult): FailureCategory {
    const message = failure.error?.message?.toLowerCase() || '';
    const stack = failure.error?.stack?.toLowerCase() || '';

    // Type errors
    if (message.includes('typeerror') || message.includes('is not a function')) {
      return 'type_error';
    }

    // Reference errors
    if (message.includes('referenceerror') || message.includes('is not defined')) {
      return 'reference_error';
    }

    // Syntax errors
    if (message.includes('syntaxerror') || message.includes('unexpected token')) {
      return 'syntax_error';
    }

    // Timeout
    if (message.includes('timeout') || message.includes('exceeded')) {
      return 'timeout';
    }

    // Network errors
    if (message.includes('fetch') || message.includes('network') || message.includes('econnrefused')) {
      return 'network';
    }

    // Database errors
    if (message.includes('prisma') || message.includes('database') || message.includes('sql')) {
      return 'database';
    }

    // Validation errors
    if (message.includes('validation') || message.includes('zod') || message.includes('invalid')) {
      return 'validation';
    }

    // Auth errors
    if (message.includes('unauthorized') || message.includes('forbidden') || message.includes('401') || message.includes('403')) {
      return 'auth';
    }

    // Async errors
    if (message.includes('promise') || message.includes('async') || message.includes('await')) {
      return 'async';
    }

    // Mock errors
    if (message.includes('mock') || message.includes('spy') || message.includes('stub')) {
      return 'mock';
    }

    // Environment errors
    if (message.includes('env') || message.includes('config') || message.includes('missing')) {
      return 'environment';
    }

    // Assertion failures
    if (failure.error?.expected !== undefined || message.includes('expect')) {
      return 'assertion';
    }

    return 'unknown';
  }

  /**
   * Generate detailed failure analysis
   */
  private generateFailureAnalysis(
    failure: TestResult,
    category: FailureCategory
  ): FailureAnalysis {
    const { possibleCauses, suggestedFixes } = this.getSuggestionsForCategory(
      category,
      failure
    );

    return {
      testId: failure.id,
      testName: failure.fullName,
      filePath: failure.filePath,
      lineNumber: failure.lineNumber,
      category,
      severity: this.determineSeverity(category),
      errorMessage: failure.error?.message || 'Unknown error',
      errorStack: failure.error?.stack,
      expectedBehavior: failure.error?.expected
        ? `Expected: ${JSON.stringify(failure.error.expected)}`
        : 'See test description',
      actualBehavior: failure.error?.actual
        ? `Actual: ${JSON.stringify(failure.error.actual)}`
        : failure.error?.message || 'Test failed',
      possibleCauses,
      suggestedFixes,
      relatedFiles: this.findRelatedFiles(failure),
    };
  }

  /**
   * Determine severity based on failure category
   */
  private determineSeverity(category: FailureCategory): 'critical' | 'major' | 'minor' {
    const severityMap: Record<FailureCategory, 'critical' | 'major' | 'minor'> = {
      syntax_error: 'critical',
      type_error: 'critical',
      reference_error: 'critical',
      database: 'critical',
      auth: 'major',
      network: 'major',
      validation: 'major',
      async: 'major',
      assertion: 'major',
      timeout: 'minor',
      mock: 'minor',
      environment: 'minor',
      unknown: 'major',
    };

    return severityMap[category];
  }

  /**
   * Get suggestions based on failure category
   */
  private getSuggestionsForCategory(
    category: FailureCategory,
    failure: TestResult
  ): { possibleCauses: string[]; suggestedFixes: string[] } {
    const suggestions: Record<FailureCategory, { causes: string[]; fixes: string[] }> = {
      assertion: {
        causes: [
          'Expected value does not match actual value',
          'Logic error in implementation',
          'Test expectation may be incorrect',
        ],
        fixes: [
          'Check the expected value in the test',
          'Debug the implementation logic',
          'Verify the test setup is correct',
        ],
      },
      type_error: {
        causes: [
          'Calling method on undefined/null',
          'Incorrect function signature',
          'Missing type conversion',
        ],
        fixes: [
          'Add null checks before accessing properties',
          'Verify function parameters match expected types',
          'Check TypeScript types match runtime values',
        ],
      },
      reference_error: {
        causes: [
          'Variable not defined in scope',
          'Import statement missing',
          'Typo in variable name',
        ],
        fixes: [
          'Check variable declarations',
          'Verify all imports are present',
          'Check for typos in variable names',
        ],
      },
      syntax_error: {
        causes: [
          'Invalid JavaScript/TypeScript syntax',
          'Missing closing bracket or parenthesis',
          'Invalid JSON structure',
        ],
        fixes: [
          'Check for missing brackets, quotes, or semicolons',
          'Validate JSON structure',
          'Run TypeScript compiler to find syntax issues',
        ],
      },
      timeout: {
        causes: [
          'Async operation taking too long',
          'Infinite loop in code',
          'Missing await on Promise',
          'Network request hanging',
        ],
        fixes: [
          'Add timeout handling to async operations',
          'Check for infinite loops',
          'Ensure all Promises are awaited',
          'Mock slow network requests in tests',
        ],
      },
      network: {
        causes: [
          'API endpoint not available',
          'Network request not mocked',
          'Incorrect URL or parameters',
        ],
        fixes: [
          'Mock network requests in tests',
          'Verify API endpoint URL is correct',
          'Check network configuration',
        ],
      },
      database: {
        causes: [
          'Database connection failed',
          'Query syntax error',
          'Missing migrations',
          'Data integrity constraint violation',
        ],
        fixes: [
          'Check database connection settings',
          'Run pending migrations',
          'Use test database for tests',
          'Verify data constraints',
        ],
      },
      validation: {
        causes: [
          'Input does not match schema',
          'Required field missing',
          'Invalid data format',
        ],
        fixes: [
          'Check input against validation schema',
          'Add required fields to test data',
          'Verify data format matches expected type',
        ],
      },
      auth: {
        causes: [
          'Missing authentication token',
          'Token expired or invalid',
          'Insufficient permissions',
        ],
        fixes: [
          'Add authentication to test request',
          'Generate valid test token',
          'Check authorization rules',
        ],
      },
      async: {
        causes: [
          'Unhandled Promise rejection',
          'Missing await keyword',
          'Race condition in async code',
        ],
        fixes: [
          'Add error handling to async operations',
          'Ensure all async calls are awaited',
          'Use proper async test patterns',
        ],
      },
      mock: {
        causes: [
          'Mock not set up correctly',
          'Mock return value incorrect',
          'Spy not called as expected',
        ],
        fixes: [
          'Verify mock implementation',
          'Check mock return values',
          'Ensure mock is used in correct scope',
        ],
      },
      environment: {
        causes: [
          'Missing environment variable',
          'Incorrect configuration',
          'Test environment not set up',
        ],
        fixes: [
          'Set required environment variables',
          'Check configuration files',
          'Verify test setup scripts',
        ],
      },
      unknown: {
        causes: ['Unable to determine specific cause'],
        fixes: [
          'Check error stack trace',
          'Add more logging',
          'Debug step by step',
        ],
      },
    };

    return {
      possibleCauses: suggestions[category].causes,
      suggestedFixes: suggestions[category].fixes,
    };
  }

  /**
   * Find files related to the failing test
   */
  private findRelatedFiles(failure: TestResult): string[] {
    const files: string[] = [failure.filePath];

    // Parse stack trace for other files
    if (failure.error?.stack) {
      const stackFiles = failure.error.stack
        .split('\n')
        .filter(line => line.includes('.ts') || line.includes('.tsx'))
        .map(line => {
          const match = line.match(/\(([^)]+)\)/);
          return match ? match[1].split(':')[0] : null;
        })
        .filter((f): f is string => f !== null && !f.includes('node_modules'));

      files.push(...stackFiles);
    }

    // Remove duplicates
    return [...new Set(files)];
  }

  /**
   * Run security audit
   */
  private async runSecurityAudit(projectPath: string): Promise<any> {
    // Implementation would use npm audit, snyk, or similar
    this.log('info', 'Running security audit');

    // Placeholder - would integrate with actual security tools
    return {
      passed: true,
      vulnerabilities: [],
      summary: { critical: 0, high: 0, medium: 0, low: 0 },
    };
  }

  /**
   * Run accessibility audit
   */
  private async runAccessibilityAudit(projectPath: string): Promise<any> {
    // Implementation would use axe-core or similar
    this.log('info', 'Running accessibility audit');

    // Placeholder - would integrate with actual a11y tools
    return {
      passed: true,
      violations: [],
      passes: 0,
      incomplete: 0,
    };
  }

  /**
   * Build complete output
   */
  private buildOutput(
    executionId: string,
    startTime: number,
    testResults: any,
    failures: FailureAnalysis[],
    securityAudit: any,
    a11yAudit: any
  ): TesterOutput {
    const endTime = Date.now();

    const qualityGates = {
      testsPass: testResults.summary.failed === 0,
      coverageMet: testResults.coverage?.meetsThresholds ?? true,
      noSecurityIssues: securityAudit?.passed ?? true,
      noA11yViolations: a11yAudit?.passed ?? true,
    };

    const canProceed = Object.values(qualityGates).every(Boolean);

    return {
      executionId,
      startedAt: new Date(startTime).toISOString(),
      completedAt: new Date(endTime).toISOString(),
      duration: endTime - startTime,
      suites: testResults.suites,
      summary: testResults.summary,
      coverage: testResults.coverage,
      failures,
      securityAudit,
      accessibilityAudit: a11yAudit,
      status: testResults.summary.failed > 0 ? 'failed' : 'passed',
      canProceed,
      qualityGates,
      recommendations: this.generateRecommendations(testResults, failures, qualityGates),
    };
  }

  /**
   * Generate recommendations based on results
   */
  private generateRecommendations(
    testResults: any,
    failures: FailureAnalysis[],
    qualityGates: any
  ): string[] {
    const recommendations: string[] = [];

    if (!qualityGates.testsPass) {
      recommendations.push(`Fix ${failures.length} failing test(s) before proceeding`);

      // Group by category
      const categories = failures.reduce((acc, f) => {
        acc[f.category] = (acc[f.category] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      for (const [category, count] of Object.entries(categories)) {
        recommendations.push(`  - ${count} ${category} error(s)`);
      }
    }

    if (!qualityGates.coverageMet) {
      recommendations.push('Increase test coverage to meet thresholds');
    }

    if (!qualityGates.noSecurityIssues) {
      recommendations.push('Address security vulnerabilities before deployment');
    }

    if (!qualityGates.noA11yViolations) {
      recommendations.push('Fix accessibility violations for WCAG compliance');
    }

    if (recommendations.length === 0) {
      recommendations.push('All quality gates passed - ready for review');
    }

    return recommendations;
  }

  /**
   * Generate artifacts
   */
  private async generateArtifacts(
    output: TesterOutput,
    request: AgentRequest
  ): Promise<Artifact[]> {
    const artifacts: Artifact[] = [];
    const basePath = path.join(request.context.projectId, 'reports');

    // Test results JSON
    artifacts.push({
      id: this.generateArtifactId(),
      type: 'test_report',
      path: path.join(basePath, 'test-results.json'),
      content: JSON.stringify(output, null, 2),
      metadata: {
        total: output.summary.total,
        passed: output.summary.passed,
        failed: output.summary.failed,
      },
    });

    // Coverage report (if available)
    if (output.coverage) {
      artifacts.push({
        id: this.generateArtifactId(),
        type: 'coverage_report',
        path: path.join(basePath, 'coverage-summary.json'),
        content: JSON.stringify(output.coverage, null, 2),
        metadata: {
          statements: output.coverage.statements,
          branches: output.coverage.branches,
          functions: output.coverage.functions,
          lines: output.coverage.lines,
        },
      });
    }

    // Failure report (for Bug Fixer)
    if (output.failures.length > 0) {
      artifacts.push({
        id: this.generateArtifactId(),
        type: 'failure_report',
        path: path.join(basePath, 'failures.json'),
        content: JSON.stringify(output.failures, null, 2),
        metadata: {
          failureCount: output.failures.length,
          categories: [...new Set(output.failures.map(f => f.category))],
        },
      });
    }

    return artifacts;
  }

  /**
   * Generate routing hints
   */
  protected generateRoutingHints(
    result: TesterOutput,
    artifacts: Artifact[],
    request: AgentRequest
  ): RoutingHints {
    const hasFailures = result.status === 'failed';

    return {
      suggestNext: hasFailures ? [AgentType.BUG_FIXER] : [AgentType.REVIEWER],
      skipAgents: [],
      needsApproval: false,
      hasFailures,
      isComplete: !hasFailures,
      notes: hasFailures
        ? `${result.summary.failed} test(s) failed - routing to Bug Fixer`
        : `All ${result.summary.total} tests passed`,
    };
  }

  // Required abstract methods (not used since we override execute)
  protected buildSystemPrompt(context: AgentContext): string {
    return '';
  }

  protected buildUserPrompt(request: AgentRequest): string {
    return '';
  }

  protected parseResponse(response: any): TesterOutput {
    return response;
  }

  protected async processResult(
    parsed: TesterOutput,
    request: AgentRequest
  ): Promise<{ result: TesterOutput; artifacts: Artifact[] }> {
    return { result: parsed, artifacts: [] };
  }
}
```

---

## 3. Test Runner (`src/agents/executors/test-runner.ts`)

```typescript
/**
 * Test Runner
 *
 * Wrapper around Vitest for programmatic test execution.
 */

import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { TestResult, TestSuiteResult, CoverageSummary } from '../schemas/tester-output';
import { logger } from '../../utils/logger';
import { v4 as uuidv4 } from 'uuid';

export interface TestRunnerConfig {
  projectPath: string;
  testPatterns: string[];
  coverageEnabled: boolean;
  coverageThresholds: {
    statements: number;
    branches: number;
    functions: number;
    lines: number;
  };
  runSecurityAudit: boolean;
  runA11yAudit: boolean;
  timeout: number;
  maxWorkers: number;
  bail: boolean;
  verbose: boolean;
}

export interface TestRunnerResult {
  suites: TestSuiteResult[];
  results: TestResult[];
  summary: {
    total: number;
    passed: number;
    failed: number;
    skipped: number;
    todo: number;
    passRate: number;
  };
  coverage?: CoverageSummary;
  duration: number;
}

/**
 * Test Runner class
 */
export class TestRunner {
  /**
   * Run tests with given configuration
   */
  async run(config: TestRunnerConfig): Promise<TestRunnerResult> {
    const startTime = Date.now();

    logger.info('Starting test run', {
      projectPath: config.projectPath,
      patterns: config.testPatterns,
    });

    try {
      // Run vitest programmatically
      const result = await this.executeVitest(config);

      // Parse results
      const parsed = await this.parseResults(config.projectPath);

      // Parse coverage if enabled
      const coverage = config.coverageEnabled
        ? await this.parseCoverage(config.projectPath, config.coverageThresholds)
        : undefined;

      const duration = Date.now() - startTime;

      logger.info('Test run complete', {
        total: parsed.summary.total,
        passed: parsed.summary.passed,
        failed: parsed.summary.failed,
        duration,
      });

      return {
        ...parsed,
        coverage,
        duration,
      };
    } catch (error) {
      logger.error('Test run failed', { error });
      throw error;
    }
  }

  /**
   * Execute vitest process
   */
  private executeVitest(config: TestRunnerConfig): Promise<string> {
    return new Promise((resolve, reject) => {
      const args = [
        'vitest',
        'run',
        '--reporter=json',
        `--outputFile=${path.join(config.projectPath, 'test-results.json')}`,
      ];

      if (config.coverageEnabled) {
        args.push('--coverage');
        args.push('--coverage.reporter=json');
      }

      if (config.bail) {
        args.push('--bail');
      }

      if (config.maxWorkers) {
        args.push(`--maxWorkers=${config.maxWorkers}`);
      }

      const proc = spawn('npx', args, {
        cwd: config.projectPath,
        shell: true,
        env: {
          ...process.env,
          NODE_ENV: 'test',
        },
      });

      let output = '';
      let errorOutput = '';

      proc.stdout.on('data', (data) => {
        output += data.toString();
      });

      proc.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });

      proc.on('close', (code) => {
        // Code 1 means tests failed, but we still want results
        if (code === 0 || code === 1) {
          resolve(output);
        } else {
          reject(new Error(`Test process exited with code ${code}: ${errorOutput}`));
        }
      });

      proc.on('error', reject);
    });
  }

  /**
   * Parse test results from JSON output
   */
  private async parseResults(projectPath: string): Promise<Omit<TestRunnerResult, 'coverage' | 'duration'>> {
    const resultsPath = path.join(projectPath, 'test-results.json');

    try {
      const raw = await fs.promises.readFile(resultsPath, 'utf-8');
      const data = JSON.parse(raw);

      const suites: TestSuiteResult[] = [];
      const allResults: TestResult[] = [];

      let total = 0;
      let passed = 0;
      let failed = 0;
      let skipped = 0;
      let todo = 0;

      for (const file of data.testResults || []) {
        const suiteResults: TestResult[] = [];

        for (const test of file.assertionResults || []) {
          const result: TestResult = {
            id: uuidv4(),
            name: test.title,
            fullName: test.fullName || `${file.name} > ${test.title}`,
            status: this.mapStatus(test.status),
            duration: test.duration || 0,
            filePath: file.name,
            type: this.inferTestType(file.name, test.fullName),
            error: test.failureMessages?.length > 0 ? {
              message: test.failureMessages[0],
              stack: test.failureDetails?.[0]?.stack,
            } : undefined,
          };

          suiteResults.push(result);
          allResults.push(result);

          total++;
          switch (result.status) {
            case 'passed': passed++; break;
            case 'failed': case 'error': failed++; break;
            case 'skipped': skipped++; break;
            case 'todo': todo++; break;
          }
        }

        suites.push({
          name: path.basename(file.name),
          filePath: file.name,
          duration: file.endTime - file.startTime,
          tests: suiteResults,
          passed: suiteResults.filter(t => t.status === 'passed').length,
          failed: suiteResults.filter(t => t.status === 'failed' || t.status === 'error').length,
          skipped: suiteResults.filter(t => t.status === 'skipped').length,
          todo: suiteResults.filter(t => t.status === 'todo').length,
        });
      }

      return {
        suites,
        results: allResults,
        summary: {
          total,
          passed,
          failed,
          skipped,
          todo,
          passRate: total > 0 ? (passed / total) * 100 : 0,
        },
      };
    } catch (error) {
      logger.warn('Failed to parse test results', { error });

      return {
        suites: [],
        results: [],
        summary: {
          total: 0,
          passed: 0,
          failed: 0,
          skipped: 0,
          todo: 0,
          passRate: 0,
        },
      };
    }
  }

  /**
   * Parse coverage from JSON output
   */
  private async parseCoverage(
    projectPath: string,
    thresholds: TestRunnerConfig['coverageThresholds']
  ): Promise<CoverageSummary> {
    const coveragePath = path.join(projectPath, 'coverage', 'coverage-summary.json');

    try {
      const raw = await fs.promises.readFile(coveragePath, 'utf-8');
      const data = JSON.parse(raw);

      const total = data.total || {};
      const files = Object.entries(data)
        .filter(([key]) => key !== 'total')
        .map(([filePath, coverage]: [string, any]) => ({
          path: filePath,
          statements: {
            total: coverage.statements.total,
            covered: coverage.statements.covered,
            percentage: coverage.statements.pct,
          },
          branches: {
            total: coverage.branches.total,
            covered: coverage.branches.covered,
            percentage: coverage.branches.pct,
          },
          functions: {
            total: coverage.functions.total,
            covered: coverage.functions.covered,
            percentage: coverage.functions.pct,
          },
          lines: {
            total: coverage.lines.total,
            covered: coverage.lines.covered,
            percentage: coverage.lines.pct,
          },
          uncoveredLines: [], // Would need line-by-line coverage data
        }));

      const summary: CoverageSummary = {
        statements: total.statements?.pct || 0,
        branches: total.branches?.pct || 0,
        functions: total.functions?.pct || 0,
        lines: total.lines?.pct || 0,
        files,
        thresholds,
        meetsThresholds:
          (total.statements?.pct || 0) >= thresholds.statements &&
          (total.branches?.pct || 0) >= thresholds.branches &&
          (total.functions?.pct || 0) >= thresholds.functions &&
          (total.lines?.pct || 0) >= thresholds.lines,
      };

      return summary;
    } catch (error) {
      logger.warn('Failed to parse coverage', { error });

      return {
        statements: 0,
        branches: 0,
        functions: 0,
        lines: 0,
        files: [],
        thresholds,
        meetsThresholds: false,
      };
    }
  }

  /**
   * Map vitest status to our status enum
   */
  private mapStatus(status: string): TestResult['status'] {
    const statusMap: Record<string, TestResult['status']> = {
      passed: 'passed',
      failed: 'failed',
      skipped: 'skipped',
      pending: 'skipped',
      todo: 'todo',
    };
    return statusMap[status] || 'error';
  }

  /**
   * Infer test type from file path and name
   */
  private inferTestType(filePath: string, testName: string): TestResult['type'] {
    const lower = (filePath + testName).toLowerCase();

    if (lower.includes('e2e') || lower.includes('playwright') || lower.includes('cypress')) {
      return 'e2e';
    }
    if (lower.includes('integration') || lower.includes('api')) {
      return 'integration';
    }
    if (lower.includes('a11y') || lower.includes('accessibility') || lower.includes('axe')) {
      return 'a11y';
    }
    if (lower.includes('security') || lower.includes('xss') || lower.includes('injection')) {
      return 'security';
    }
    if (lower.includes('perf') || lower.includes('benchmark')) {
      return 'performance';
    }

    return 'unit';
  }
}
```

---

## 4. E2E Test Generator (`src/agents/generators/e2e-generator.ts`)

The E2E Test Generator creates Playwright tests from user flows, generating Page Object Models and comprehensive browser-based tests.

### E2E Output Schema

```typescript
/**
 * E2E Test Generator Output Schema
 *
 * Defines structured output for Playwright test generation.
 */

import { z } from 'zod';

/**
 * Page Object Model definition
 */
export const PageObjectSchema = z.object({
  name: z.string(), // e.g., "LoginPage"
  path: z.string(), // e.g., "e2e/pages/LoginPage.ts"
  url: z.string().optional(), // e.g., "/login"
  selectors: z.array(z.object({
    name: z.string(), // e.g., "emailInput"
    selector: z.string(), // e.g., "[data-testid='email-input']"
    type: z.enum(['input', 'button', 'link', 'text', 'container', 'list', 'custom']),
    description: z.string().optional(),
  })),
  actions: z.array(z.object({
    name: z.string(), // e.g., "login"
    parameters: z.array(z.object({
      name: z.string(),
      type: z.string(),
    })),
    steps: z.array(z.string()), // Action implementation steps
    returns: z.string().optional(), // Return type
  })),
  assertions: z.array(z.object({
    name: z.string(), // e.g., "isLoggedIn"
    description: z.string(),
    implementation: z.string(),
  })),
});

export type PageObject = z.infer<typeof PageObjectSchema>;

/**
 * E2E test case definition
 */
export const E2ETestCaseSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  userFlow: z.string(), // Reference to user flow
  tags: z.array(z.string()), // e.g., ['smoke', 'critical', 'auth']

  // Test structure
  beforeEach: z.array(z.string()).optional(),
  afterEach: z.array(z.string()).optional(),
  steps: z.array(z.object({
    action: z.string(),
    target: z.string().optional(),
    value: z.string().optional(),
    assertion: z.string().optional(),
    screenshot: z.boolean().optional(),
  })),

  // Expected outcomes
  assertions: z.array(z.object({
    type: z.enum(['visible', 'hidden', 'text', 'url', 'count', 'attribute', 'screenshot']),
    target: z.string(),
    expected: z.string(),
  })),

  // Visual regression
  visualRegression: z.object({
    enabled: z.boolean(),
    threshold: z.number().optional(), // 0-1, difference threshold
    fullPage: z.boolean().optional(),
    mask: z.array(z.string()).optional(), // Selectors to mask
  }).optional(),
});

export type E2ETestCase = z.infer<typeof E2ETestCaseSchema>;

/**
 * E2E test suite definition
 */
export const E2ETestSuiteSchema = z.object({
  name: z.string(),
  description: z.string(),
  path: z.string(), // e.g., "e2e/tests/auth.spec.ts"

  // Configuration
  config: z.object({
    baseURL: z.string().optional(),
    timeout: z.number().optional(),
    retries: z.number().optional(),
    browsers: z.array(z.enum(['chromium', 'firefox', 'webkit'])),
    viewport: z.object({
      width: z.number(),
      height: z.number(),
    }).optional(),
    video: z.enum(['off', 'on', 'retain-on-failure']).optional(),
    trace: z.enum(['off', 'on', 'retain-on-failure']).optional(),
  }),

  // Dependencies
  fixtures: z.array(z.string()).optional(),
  pageObjects: z.array(z.string()), // References to page objects

  // Tests
  tests: z.array(E2ETestCaseSchema),
});

export type E2ETestSuite = z.infer<typeof E2ETestSuiteSchema>;

/**
 * Complete E2E generator output
 */
export const E2EGeneratorOutputSchema = z.object({
  feature: z.string(),
  generatedAt: z.string(),

  // Generated files
  pageObjects: z.array(PageObjectSchema),
  testSuites: z.array(E2ETestSuiteSchema),
  fixtures: z.array(z.object({
    name: z.string(),
    path: z.string(),
    content: z.string(),
  })),

  // Configuration files
  playwrightConfig: z.string(),

  // Generated code
  files: z.array(z.object({
    path: z.string(),
    content: z.string(),
    type: z.enum(['page-object', 'test-suite', 'fixture', 'config', 'helper']),
  })),

  // Summary
  summary: z.object({
    pageObjectCount: z.number(),
    testSuiteCount: z.number(),
    testCaseCount: z.number(),
    userFlowsCovered: z.array(z.string()),
    browsersCovered: z.array(z.string()),
  }),
});

export type E2EGeneratorOutput = z.infer<typeof E2EGeneratorOutputSchema>;
```

### E2E Test Generator Agent

```typescript
/**
 * E2E Test Generator
 *
 * Generates Playwright tests from user flows and design specifications.
 */

import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import {
  E2EGeneratorOutput,
  E2EGeneratorOutputSchema,
  PageObject,
  E2ETestSuite,
  E2ETestCase,
} from '../schemas/e2e-output';
import { UserFlow } from '../../CP1-DESIGN-SYSTEM/08-USER-FLOWS';

// ============================================================================
// Input Schema
// ============================================================================

export const E2EGeneratorInputSchema = z.object({
  feature: z.string(),
  userFlows: z.array(z.object({
    id: z.string(),
    name: z.string(),
    description: z.string(),
    steps: z.array(z.object({
      action: z.string(),
      element: z.string().optional(),
      expectedResult: z.string(),
    })),
    entryPoint: z.string(),
    exitPoint: z.string(),
  })),
  mockups: z.array(z.object({
    id: z.string(),
    name: z.string(),
    elements: z.array(z.object({
      id: z.string(),
      type: z.string(),
      testId: z.string().optional(),
      label: z.string().optional(),
    })),
  })).optional(),
  existingPageObjects: z.array(z.string()).optional(),
  config: z.object({
    baseURL: z.string(),
    browsers: z.array(z.enum(['chromium', 'firefox', 'webkit'])),
    enableVisualRegression: z.boolean(),
    enableAccessibility: z.boolean(),
    enablePerformance: z.boolean(),
  }),
});

export type E2EGeneratorInput = z.infer<typeof E2EGeneratorInputSchema>;

// ============================================================================
// E2E Test Generator
// ============================================================================

export class E2ETestGenerator {
  private client: Anthropic;
  private model = "claude-sonnet-4-20250514";

  constructor() {
    this.client = new Anthropic();
  }

  async generate(input: E2EGeneratorInput): Promise<E2EGeneratorOutput> {
    const systemPrompt = this.buildSystemPrompt();
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

    const parsed = this.parseResponse(content.text);

    // Generate actual file contents
    return this.generateFiles(parsed, input);
  }

  private buildSystemPrompt(): string {
    return `You are an expert E2E Test Generator specializing in Playwright.

Your role is to generate comprehensive end-to-end tests from user flows.

## GENERATION PRINCIPLES

1. **Page Object Model (POM)**
   - One page object per page/component
   - Encapsulate selectors and actions
   - Use data-testid attributes when available
   - Fallback to accessible selectors (role, label)

2. **Test Structure**
   - Arrange-Act-Assert pattern
   - One logical assertion per test when possible
   - Descriptive test names that explain the behavior
   - Group related tests in describe blocks

3. **Selector Priority**
   1. data-testid (most reliable)
   2. role + name (accessible)
   3. label/placeholder text
   4. CSS selectors (last resort)

4. **Best Practices**
   - Use fixtures for common setup
   - Implement proper waits (not arbitrary timeouts)
   - Handle loading states explicitly
   - Take screenshots at key points
   - Mock external APIs when needed

## OUTPUT FORMAT

Generate complete, runnable Playwright tests with:
- Page Objects with typed selectors
- Test suites with proper hooks
- Fixtures for auth/data setup
- Visual regression configuration
- Cross-browser setup

Return JSON matching E2EGeneratorOutputSchema.`;
  }

  private buildUserPrompt(input: E2EGeneratorInput): string {
    let prompt = `# E2E Test Generation Request

## Feature: ${input.feature}

## Configuration
- Base URL: ${input.config.baseURL}
- Browsers: ${input.config.browsers.join(', ')}
- Visual Regression: ${input.config.enableVisualRegression ? 'Enabled' : 'Disabled'}
- Accessibility: ${input.config.enableAccessibility ? 'Enabled' : 'Disabled'}
- Performance: ${input.config.enablePerformance ? 'Enabled' : 'Disabled'}

## User Flows to Cover

`;

    for (const flow of input.userFlows) {
      prompt += `### ${flow.name}
- **ID**: ${flow.id}
- **Description**: ${flow.description}
- **Entry**: ${flow.entryPoint}
- **Exit**: ${flow.exitPoint}

**Steps**:
`;
      for (let i = 0; i < flow.steps.length; i++) {
        const step = flow.steps[i];
        prompt += `${i + 1}. ${step.action}${step.element ? ` on "${step.element}"` : ''} → ${step.expectedResult}\n`;
      }
      prompt += '\n';
    }

    if (input.mockups && input.mockups.length > 0) {
      prompt += `## UI Elements from Mockups\n\n`;
      for (const mockup of input.mockups) {
        prompt += `### ${mockup.name}\n`;
        for (const el of mockup.elements) {
          prompt += `- ${el.type}: ${el.label || el.id}${el.testId ? ` [data-testid="${el.testId}"]` : ''}\n`;
        }
        prompt += '\n';
      }
    }

    if (input.existingPageObjects && input.existingPageObjects.length > 0) {
      prompt += `## Existing Page Objects (reuse these)\n`;
      for (const po of input.existingPageObjects) {
        prompt += `- ${po}\n`;
      }
      prompt += '\n';
    }

    prompt += `## Instructions

1. Generate Page Objects for all pages in the user flows
2. Create test suites covering each user flow
3. Include visual regression tests for key screens
4. Add accessibility checks using @axe-core/playwright
5. Include performance assertions where relevant
6. Generate proper fixtures for test data

Return valid JSON matching E2EGeneratorOutputSchema.`;

    return prompt;
  }

  private parseResponse(text: string): any {
    const jsonMatch = text.match(/```json\n?([\s\S]*?)\n?```/) ||
                      text.match(/\{[\s\S]*\}/);

    if (!jsonMatch) {
      throw new Error("No JSON found in response");
    }

    const jsonStr = jsonMatch[1] || jsonMatch[0];
    return JSON.parse(jsonStr);
  }

  private generateFiles(parsed: any, input: E2EGeneratorInput): E2EGeneratorOutput {
    const files: E2EGeneratorOutput['files'] = [];

    // Generate Page Object files
    for (const po of parsed.pageObjects || []) {
      files.push({
        path: po.path,
        content: this.generatePageObjectCode(po),
        type: 'page-object',
      });
    }

    // Generate Test Suite files
    for (const suite of parsed.testSuites || []) {
      files.push({
        path: suite.path,
        content: this.generateTestSuiteCode(suite, parsed.pageObjects),
        type: 'test-suite',
      });
    }

    // Generate fixtures
    for (const fixture of parsed.fixtures || []) {
      files.push({
        path: fixture.path,
        content: fixture.content,
        type: 'fixture',
      });
    }

    // Generate Playwright config
    const configContent = this.generatePlaywrightConfig(input);
    files.push({
      path: 'playwright.config.ts',
      content: configContent,
      type: 'config',
    });

    // Generate helper utilities
    files.push({
      path: 'e2e/helpers/test-utils.ts',
      content: this.generateTestHelpers(input),
      type: 'helper',
    });

    return {
      feature: input.feature,
      generatedAt: new Date().toISOString(),
      pageObjects: parsed.pageObjects || [],
      testSuites: parsed.testSuites || [],
      fixtures: parsed.fixtures || [],
      playwrightConfig: configContent,
      files,
      summary: {
        pageObjectCount: (parsed.pageObjects || []).length,
        testSuiteCount: (parsed.testSuites || []).length,
        testCaseCount: (parsed.testSuites || []).reduce(
          (sum: number, s: any) => sum + (s.tests?.length || 0), 0
        ),
        userFlowsCovered: input.userFlows.map(f => f.id),
        browsersCovered: input.config.browsers,
      },
    };
  }

  private generatePageObjectCode(po: PageObject): string {
    const className = po.name;

    let code = `import { Page, Locator, expect } from '@playwright/test';

/**
 * Page Object: ${po.name}
 * URL: ${po.url || 'N/A'}
 */
export class ${className} {
  readonly page: Page;

  // Selectors
`;

    // Add selector properties
    for (const sel of po.selectors) {
      code += `  readonly ${sel.name}: Locator;\n`;
    }

    // Constructor
    code += `
  constructor(page: Page) {
    this.page = page;
`;
    for (const sel of po.selectors) {
      code += `    this.${sel.name} = page.locator('${sel.selector}');\n`;
    }
    code += `  }

`;

    // Navigation (if URL provided)
    if (po.url) {
      code += `  async goto() {
    await this.page.goto('${po.url}');
    await this.waitForReady();
  }

  async waitForReady() {
    await this.page.waitForLoadState('networkidle');
  }

`;
    }

    // Add action methods
    for (const action of po.actions) {
      const params = action.parameters.map(p => `${p.name}: ${p.type}`).join(', ');
      const returnType = action.returns || 'Promise<void>';

      code += `  async ${action.name}(${params}): ${returnType} {
`;
      for (const step of action.steps) {
        code += `    ${step}\n`;
      }
      code += `  }

`;
    }

    // Add assertion methods
    for (const assertion of po.assertions) {
      code += `  /** ${assertion.description} */
  async ${assertion.name}() {
    ${assertion.implementation}
  }

`;
    }

    code += `}
`;

    return code;
  }

  private generateTestSuiteCode(suite: E2ETestSuite, pageObjects: PageObject[]): string {
    const imports = new Set<string>();
    imports.add("import { test, expect } from '@playwright/test';");

    // Add page object imports
    for (const poName of suite.pageObjects) {
      const po = pageObjects.find(p => p.name === poName);
      if (po) {
        imports.add(`import { ${po.name} } from '../pages/${po.name}';`);
      }
    }

    let code = Array.from(imports).join('\n') + '\n\n';

    code += `/**
 * Test Suite: ${suite.name}
 * ${suite.description}
 */
test.describe('${suite.name}', () => {
`;

    // Configuration
    if (suite.config.timeout) {
      code += `  test.setTimeout(${suite.config.timeout});\n\n`;
    }

    // Page object instances
    for (const poName of suite.pageObjects) {
      const varName = poName.charAt(0).toLowerCase() + poName.slice(1);
      code += `  let ${varName}: ${poName};\n`;
    }
    code += '\n';

    // beforeEach hook
    code += `  test.beforeEach(async ({ page }) => {
`;
    for (const poName of suite.pageObjects) {
      const varName = poName.charAt(0).toLowerCase() + poName.slice(1);
      code += `    ${varName} = new ${poName}(page);\n`;
    }
    code += `  });\n\n`;

    // Generate tests
    for (const testCase of suite.tests) {
      const tags = testCase.tags.map(t => `@${t}`).join(' ');
      code += `  test('${testCase.name}', { tag: [${testCase.tags.map(t => `'@${t}'`).join(', ')}] }, async ({ page }) => {
`;

      // Test steps
      for (const step of testCase.steps) {
        if (step.assertion) {
          code += `    // Assert: ${step.assertion}\n`;
          code += `    await expect(${step.target}).${step.assertion};\n`;
        } else {
          code += `    // ${step.action}\n`;
          if (step.target && step.value) {
            code += `    await ${step.target}.${step.action}('${step.value}');\n`;
          } else if (step.target) {
            code += `    await ${step.target}.${step.action}();\n`;
          } else {
            code += `    await ${step.action};\n`;
          }
        }

        if (step.screenshot) {
          code += `    await page.screenshot({ path: 'screenshots/${testCase.id}-${testCase.steps.indexOf(step)}.png' });\n`;
        }
        code += '\n';
      }

      // Visual regression
      if (testCase.visualRegression?.enabled) {
        code += `    // Visual regression check\n`;
        code += `    await expect(page).toHaveScreenshot('${testCase.id}.png', {\n`;
        code += `      threshold: ${testCase.visualRegression.threshold || 0.2},\n`;
        code += `      fullPage: ${testCase.visualRegression.fullPage || false},\n`;
        if (testCase.visualRegression.mask && testCase.visualRegression.mask.length > 0) {
          code += `      mask: [${testCase.visualRegression.mask.map(m => `page.locator('${m}')`).join(', ')}],\n`;
        }
        code += `    });\n`;
      }

      code += `  });\n\n`;
    }

    code += `});\n`;

    return code;
  }

  private generatePlaywrightConfig(input: E2EGeneratorInput): string {
    return `import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright Configuration
 * Generated for: ${input.feature}
 */
export default defineConfig({
  testDir: './e2e/tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['html', { outputFolder: 'playwright-report' }],
    ['json', { outputFile: 'test-results/e2e-results.json' }],
  ],

  use: {
    baseURL: '${input.config.baseURL}',
    trace: 'retain-on-failure',
    video: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },

  projects: [
${input.config.browsers.includes('chromium') ? `    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },` : ''}
${input.config.browsers.includes('firefox') ? `    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },` : ''}
${input.config.browsers.includes('webkit') ? `    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },` : ''}
    // Mobile viewports
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'Mobile Safari',
      use: { ...devices['iPhone 12'] },
    },
  ],

  // Web server configuration
  webServer: {
    command: 'npm run dev',
    url: '${input.config.baseURL}',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },

  // Expect configuration
  expect: {
    toHaveScreenshot: {
      maxDiffPixels: 100,
      threshold: 0.2,
    },
  },
});
`;
  }

  private generateTestHelpers(input: E2EGeneratorInput): string {
    let code = `import { Page, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/**
 * E2E Test Helpers
 * Generated for: ${input.feature}
 */

/**
 * Wait for network to be idle
 */
export async function waitForNetworkIdle(page: Page, timeout = 5000) {
  await page.waitForLoadState('networkidle', { timeout });
}

/**
 * Wait for element to be stable (no animations)
 */
export async function waitForStable(page: Page, selector: string) {
  const element = page.locator(selector);
  await element.waitFor({ state: 'visible' });

  // Wait for any animations to complete
  await page.waitForFunction(
    (sel) => {
      const el = document.querySelector(sel);
      if (!el) return false;
      const animations = el.getAnimations();
      return animations.every(a => a.playState === 'finished');
    },
    selector
  );
}

`;

    if (input.config.enableAccessibility) {
      code += `/**
 * Run accessibility audit on current page
 */
export async function checkAccessibility(page: Page, disabledRules: string[] = []) {
  const results = await new AxeBuilder({ page })
    .disableRules(disabledRules)
    .analyze();

  expect(results.violations).toEqual([]);

  return results;
}

/**
 * Check specific element for accessibility
 */
export async function checkElementAccessibility(page: Page, selector: string) {
  const results = await new AxeBuilder({ page })
    .include(selector)
    .analyze();

  expect(results.violations).toEqual([]);

  return results;
}

`;
    }

    if (input.config.enablePerformance) {
      code += `/**
 * Measure page performance metrics
 */
export async function measurePerformance(page: Page) {
  const metrics = await page.evaluate(() => {
    const timing = performance.timing;
    const paint = performance.getEntriesByType('paint');

    return {
      domContentLoaded: timing.domContentLoadedEventEnd - timing.navigationStart,
      load: timing.loadEventEnd - timing.navigationStart,
      firstPaint: paint.find(p => p.name === 'first-paint')?.startTime || 0,
      firstContentfulPaint: paint.find(p => p.name === 'first-contentful-paint')?.startTime || 0,
    };
  });

  return metrics;
}

/**
 * Assert performance thresholds
 */
export async function assertPerformance(page: Page, thresholds: {
  domContentLoaded?: number;
  load?: number;
  firstContentfulPaint?: number;
}) {
  const metrics = await measurePerformance(page);

  if (thresholds.domContentLoaded) {
    expect(metrics.domContentLoaded).toBeLessThan(thresholds.domContentLoaded);
  }
  if (thresholds.load) {
    expect(metrics.load).toBeLessThan(thresholds.load);
  }
  if (thresholds.firstContentfulPaint) {
    expect(metrics.firstContentfulPaint).toBeLessThan(thresholds.firstContentfulPaint);
  }

  return metrics;
}

`;
    }

    code += `/**
 * Mock API response
 */
export async function mockAPI(
  page: Page,
  url: string | RegExp,
  response: { status?: number; body?: unknown; headers?: Record<string, string> }
) {
  await page.route(url, (route) => {
    route.fulfill({
      status: response.status || 200,
      contentType: 'application/json',
      headers: response.headers || {},
      body: JSON.stringify(response.body),
    });
  });
}

/**
 * Intercept and collect API calls
 */
export async function interceptAPICalls(page: Page, urlPattern: string | RegExp) {
  const calls: { url: string; method: string; body?: unknown }[] = [];

  await page.route(urlPattern, (route, request) => {
    calls.push({
      url: request.url(),
      method: request.method(),
      body: request.postDataJSON(),
    });
    route.continue();
  });

  return calls;
}

/**
 * Fill form with test data
 */
export async function fillForm(
  page: Page,
  formData: Record<string, string | boolean | number>
) {
  for (const [field, value] of Object.entries(formData)) {
    const locator = page.locator(\`[name="\${field}"], [data-testid="\${field}"]\`);

    if (typeof value === 'boolean') {
      if (value) {
        await locator.check();
      } else {
        await locator.uncheck();
      }
    } else {
      await locator.fill(String(value));
    }
  }
}

/**
 * Take full page screenshot with timestamp
 */
export async function takeScreenshot(page: Page, name: string) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  await page.screenshot({
    path: \`screenshots/\${name}-\${timestamp}.png\`,
    fullPage: true,
  });
}
`;

    return code;
  }
}
```

### E2E Fixture Generator

```typescript
/**
 * E2E Fixture Generator
 *
 * Generates reusable test fixtures for authentication, data setup, etc.
 */

export class E2EFixtureGenerator {
  /**
   * Generate authentication fixture
   */
  generateAuthFixture(authConfig: {
    loginUrl: string;
    emailField: string;
    passwordField: string;
    submitButton: string;
    successIndicator: string;
  }): string {
    return `import { test as base, expect } from '@playwright/test';

/**
 * Authentication Fixture
 *
 * Provides authenticated page context for tests.
 */

type AuthFixtures = {
  authenticatedPage: Page;
  authContext: BrowserContext;
};

export const test = base.extend<AuthFixtures>({
  authContext: async ({ browser }, use) => {
    // Create a new context with stored auth state
    const context = await browser.newContext({
      storageState: 'playwright/.auth/user.json',
    });
    await use(context);
    await context.close();
  },

  authenticatedPage: async ({ authContext }, use) => {
    const page = await authContext.newPage();
    await use(page);
  },
});

/**
 * Setup authentication state
 * Run this once before all tests: npx playwright test --project=setup
 */
export async function globalSetup(config: FullConfig) {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  // Navigate to login page
  await page.goto('${authConfig.loginUrl}');

  // Fill login form
  await page.fill('${authConfig.emailField}', process.env.TEST_USER_EMAIL!);
  await page.fill('${authConfig.passwordField}', process.env.TEST_USER_PASSWORD!);
  await page.click('${authConfig.submitButton}');

  // Wait for successful login
  await expect(page.locator('${authConfig.successIndicator}')).toBeVisible();

  // Save auth state
  await page.context().storageState({ path: 'playwright/.auth/user.json' });

  await browser.close();
}

export { expect } from '@playwright/test';
`;
  }

  /**
   * Generate database fixture for test data
   */
  generateDataFixture(): string {
    return `import { test as base } from '@playwright/test';

/**
 * Test Data Fixture
 *
 * Provides test data setup and teardown.
 */

type DataFixtures = {
  testData: TestData;
};

interface TestData {
  user: {
    id: string;
    email: string;
    name: string;
  };
  // Add more test data types as needed
}

export const test = base.extend<DataFixtures>({
  testData: async ({ request }, use) => {
    // Setup: Create test data via API
    const response = await request.post('/api/test/setup', {
      data: {
        scenario: 'default',
      },
    });

    const testData = await response.json() as TestData;

    // Use the test data
    await use(testData);

    // Teardown: Clean up test data
    await request.post('/api/test/teardown', {
      data: {
        userId: testData.user.id,
      },
    });
  },
});

export { expect } from '@playwright/test';
`;
  }

  /**
   * Generate visual regression baseline fixture
   */
  generateVisualFixture(): string {
    return `import { test as base, expect } from '@playwright/test';

/**
 * Visual Regression Fixture
 *
 * Provides utilities for visual comparison testing.
 */

type VisualFixtures = {
  snapshotPage: (name: string, options?: SnapshotOptions) => Promise<void>;
  compareScreenshot: (name: string, threshold?: number) => Promise<void>;
};

interface SnapshotOptions {
  fullPage?: boolean;
  mask?: string[];
  clip?: { x: number; y: number; width: number; height: number };
}

export const test = base.extend<VisualFixtures>({
  snapshotPage: async ({ page }, use) => {
    const snapshotPage = async (name: string, options?: SnapshotOptions) => {
      // Wait for animations to complete
      await page.waitForTimeout(500);

      const maskLocators = options?.mask?.map(selector => page.locator(selector)) || [];

      await expect(page).toHaveScreenshot(\`\${name}.png\`, {
        fullPage: options?.fullPage ?? true,
        mask: maskLocators,
        clip: options?.clip,
        animations: 'disabled',
      });
    };

    await use(snapshotPage);
  },

  compareScreenshot: async ({ page }, use) => {
    const compareScreenshot = async (name: string, threshold = 0.2) => {
      await expect(page).toHaveScreenshot(\`\${name}.png\`, {
        threshold,
        maxDiffPixels: 100,
      });
    };

    await use(compareScreenshot);
  },
});

export { expect } from '@playwright/test';
`;
  }
}
```

### Integration with Tester Agent

```typescript
// Add to TesterAgent class

import { E2ETestGenerator, E2EGeneratorInput } from '../generators/e2e-generator';
import { E2EFixtureGenerator } from '../generators/e2e-fixture-generator';

/**
 * Extended Tester Agent with E2E generation capability
 */
export class TesterAgentWithE2E extends TesterAgent {
  private e2eGenerator: E2ETestGenerator;
  private fixtureGenerator: E2EFixtureGenerator;

  constructor() {
    super();
    this.e2eGenerator = new E2ETestGenerator();
    this.fixtureGenerator = new E2EFixtureGenerator();
  }

  /**
   * Generate E2E tests from user flows
   */
  async generateE2ETests(input: E2EGeneratorInput): Promise<E2EGeneratorOutput> {
    this.log('info', 'Generating E2E tests', {
      feature: input.feature,
      flowCount: input.userFlows.length,
    });

    const result = await this.e2eGenerator.generate(input);

    this.log('info', 'E2E tests generated', {
      pageObjects: result.summary.pageObjectCount,
      testSuites: result.summary.testSuiteCount,
      testCases: result.summary.testCaseCount,
    });

    return result;
  }

  /**
   * Generate auth fixture for E2E tests
   */
  generateAuthFixture(config: Parameters<E2EFixtureGenerator['generateAuthFixture']>[0]): string {
    return this.fixtureGenerator.generateAuthFixture(config);
  }

  /**
   * Run E2E tests with Playwright
   */
  async runE2ETests(projectPath: string, config?: {
    browsers?: string[];
    headed?: boolean;
    workers?: number;
  }): Promise<any> {
    const args = ['playwright', 'test'];

    if (config?.headed) {
      args.push('--headed');
    }

    if (config?.workers) {
      args.push(`--workers=${config.workers}`);
    }

    if (config?.browsers) {
      for (const browser of config.browsers) {
        args.push(`--project=${browser}`);
      }
    }

    args.push('--reporter=json');

    return this.executeCommand('npx', args, projectPath);
  }

  private executeCommand(cmd: string, args: string[], cwd: string): Promise<any> {
    return new Promise((resolve, reject) => {
      const { spawn } = require('child_process');
      const proc = spawn(cmd, args, { cwd, shell: true });

      let output = '';
      proc.stdout.on('data', (data: Buffer) => output += data.toString());
      proc.stderr.on('data', (data: Buffer) => output += data.toString());

      proc.on('close', (code: number) => {
        if (code === 0 || code === 1) {
          try {
            resolve(JSON.parse(output));
          } catch {
            resolve({ output, code });
          }
        } else {
          reject(new Error(`Command failed with code ${code}`));
        }
      });
    });
  }
}
```

### Example: Generated E2E Test

```typescript
// Example output for a login flow

// e2e/pages/LoginPage.ts
import { Page, Locator, expect } from '@playwright/test';

export class LoginPage {
  readonly page: Page;
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly submitButton: Locator;
  readonly errorMessage: Locator;
  readonly forgotPasswordLink: Locator;

  constructor(page: Page) {
    this.page = page;
    this.emailInput = page.locator('[data-testid="email-input"]');
    this.passwordInput = page.locator('[data-testid="password-input"]');
    this.submitButton = page.locator('[data-testid="login-submit"]');
    this.errorMessage = page.locator('[data-testid="error-message"]');
    this.forgotPasswordLink = page.locator('a[href="/forgot-password"]');
  }

  async goto() {
    await this.page.goto('/login');
    await this.waitForReady();
  }

  async waitForReady() {
    await this.page.waitForLoadState('networkidle');
  }

  async login(email: string, password: string): Promise<void> {
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.submitButton.click();
  }

  async expectError(message: string): Promise<void> {
    await expect(this.errorMessage).toBeVisible();
    await expect(this.errorMessage).toHaveText(message);
  }

  async expectNoError(): Promise<void> {
    await expect(this.errorMessage).not.toBeVisible();
  }
}

// e2e/tests/auth.spec.ts
import { test, expect } from '@playwright/test';
import { LoginPage } from '../pages/LoginPage';
import { DashboardPage } from '../pages/DashboardPage';
import { checkAccessibility } from '../helpers/test-utils';

test.describe('User Authentication', () => {
  let loginPage: LoginPage;
  let dashboardPage: DashboardPage;

  test.beforeEach(async ({ page }) => {
    loginPage = new LoginPage(page);
    dashboardPage = new DashboardPage(page);
  });

  test('successful login redirects to dashboard', { tag: ['@smoke', '@auth', '@critical'] }, async ({ page }) => {
    await loginPage.goto();
    await loginPage.login('user@example.com', 'validpassword');

    await expect(page).toHaveURL('/dashboard');
    await dashboardPage.expectWelcomeMessage('Welcome back');
  });

  test('invalid credentials show error message', { tag: ['@auth'] }, async ({ page }) => {
    await loginPage.goto();
    await loginPage.login('user@example.com', 'wrongpassword');

    await loginPage.expectError('Invalid email or password');
    await expect(page).toHaveURL('/login');
  });

  test('login page is accessible', { tag: ['@a11y'] }, async ({ page }) => {
    await loginPage.goto();
    await checkAccessibility(page);
  });

  test('login page visual regression', { tag: ['@visual'] }, async ({ page }) => {
    await loginPage.goto();

    await expect(page).toHaveScreenshot('login-page.png', {
      threshold: 0.2,
      fullPage: true,
      mask: [page.locator('[data-testid="dynamic-content"]')],
    });
  });
});
```

---

## Validation Checklist

```
□ Output Schema
  □ Test result schema
  □ Test suite schema
  □ Coverage schema
  □ Failure analysis schema
  □ Security audit schema
  □ A11y audit schema
  □ Complete tester output schema

□ Tester Agent
  □ Extends BaseAgent correctly
  □ Override execute for direct test run
  □ Registered with decorator
  □ Correct metadata and capabilities

□ Test Runner
  □ Vitest integration works
  □ JSON output parsing
  □ Coverage parsing
  □ Error handling
  □ Timeout handling

□ Failure Analysis
  □ Categorization works
  □ Severity assignment
  □ Suggestions generated
  □ Related files found

□ Quality Gates
  □ Test pass check
  □ Coverage threshold check
  □ Security check
  □ A11y check

□ Artifacts
  □ Test results JSON
  □ Coverage report
  □ Failure report for Bug Fixer

□ Routing
  □ Routes to Bug Fixer on failure
  □ Routes to Reviewer on success
  □ Correct routing hints

□ E2E Test Generation
  □ E2EGeneratorOutputSchema defined
  □ PageObjectSchema for Page Object Model
  □ E2ETestCaseSchema with visual regression
  □ E2ETestSuiteSchema with cross-browser config
  □ E2ETestGenerator generates from user flows
  □ Page Object code generation
  □ Test suite code generation
  □ Playwright config generation
  □ Test helpers with a11y/perf utilities
  □ E2EFixtureGenerator for auth/data fixtures
  □ TesterAgentWithE2E integration
  □ runE2ETests executes Playwright

□ All tests pass
  □ npm run test -- tests/agents/tester
  □ npx playwright test (E2E tests)
```

---

## Next Step

Proceed to **15-BUG-FIXER-AGENT.md** to implement the Bug Fixer Agent for fixing test failures.
