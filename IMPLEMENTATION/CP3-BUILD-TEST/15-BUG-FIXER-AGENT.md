# 15. Bug Fixer Agent

> Automated bug fixing agent that analyzes test failures and applies targeted fixes

## Overview

The Bug Fixer Agent receives failure analysis from the Tester Agent and applies fixes to make tests pass. Following TDD principles, the tests are considered correct—the implementation needs to be fixed to match the expected behavior.

## Agent Definition

```typescript
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";

// ============================================================================
// Input Schema - From Tester Agent
// ============================================================================

export const FailureInputSchema = z.object({
  testFile: z.string(),
  testName: z.string(),
  category: z.enum([
    'assertion', 'type_error', 'reference_error', 'syntax_error',
    'timeout', 'network', 'database', 'validation', 'auth',
    'async', 'mock', 'environment', 'unknown',
  ]),
  message: z.string(),
  stack: z.string().optional(),
  expected: z.string().optional(),
  actual: z.string().optional(),
  sourceFile: z.string(),
  sourceLine: z.number().optional(),
  suggestedFix: z.string().optional(),
});

export const BugFixerInputSchema = z.object({
  feature: z.string(),
  failures: z.array(FailureInputSchema),
  sourceFiles: z.record(z.string()), // filename -> content
  testFiles: z.record(z.string()),   // filename -> content
  coverageGaps: z.array(z.object({
    file: z.string(),
    uncoveredLines: z.array(z.number()),
  })).optional(),
});

export type BugFixerInput = z.infer<typeof BugFixerInputSchema>;

// ============================================================================
// Output Schema - Fixed Code
// ============================================================================

export const CodeFixSchema = z.object({
  file: z.string(),
  originalContent: z.string(),
  fixedContent: z.string(),
  changes: z.array(z.object({
    line: z.number(),
    type: z.enum(['add', 'remove', 'modify']),
    description: z.string(),
  })),
  fixesFailures: z.array(z.string()), // test names this fix addresses
});

export const FixAnalysisSchema = z.object({
  failureId: z.string(),
  testName: z.string(),
  rootCause: z.string(),
  fixStrategy: z.string(),
  confidence: z.enum(['high', 'medium', 'low']),
  relatedFailures: z.array(z.string()), // other test names with same root cause
});

export const BugFixerOutputSchema = z.object({
  feature: z.string(),
  analyses: z.array(FixAnalysisSchema),
  fixes: z.array(CodeFixSchema),
  unfixable: z.array(z.object({
    testName: z.string(),
    reason: z.string(),
    requiresHumanReview: z.boolean(),
    suggestedApproach: z.string().optional(),
  })),
  summary: z.object({
    totalFailures: z.number(),
    fixedCount: z.number(),
    unfixableCount: z.number(),
    filesModified: z.number(),
    estimatedSuccess: z.number(), // 0-100 confidence that fixes will work
  }),
});

export type BugFixerOutput = z.infer<typeof BugFixerOutputSchema>;

// ============================================================================
// Bug Fixer Agent
// ============================================================================

export class BugFixerAgent {
  private client: Anthropic;
  private model = "claude-sonnet-4-20250514";

  constructor() {
    this.client = new Anthropic();
  }

  async fix(input: BugFixerInput): Promise<BugFixerOutput> {
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

    return this.parseResponse(content.text);
  }

  private buildSystemPrompt(): string {
    return `You are an expert Bug Fixer Agent specializing in test-driven development.

Your role is to analyze test failures and fix the implementation to make tests pass.

CRITICAL TDD PRINCIPLE:
- Tests are the source of truth
- Tests define the expected behavior
- Implementation must be fixed to match tests
- NEVER suggest changing tests to match implementation

FIX STRATEGIES BY CATEGORY:

1. ASSERTION FAILURES
   - Compare expected vs actual values
   - Trace data flow to find where value diverges
   - Check for off-by-one errors, wrong operators, missing transformations

2. TYPE ERRORS
   - Check interface/type definitions
   - Verify function signatures match usage
   - Look for missing type conversions
   - Check for null/undefined handling

3. REFERENCE ERRORS
   - Find undefined variables/imports
   - Check for typos in identifiers
   - Verify module exports
   - Check scope issues

4. ASYNC ERRORS
   - Add missing await keywords
   - Check Promise chain handling
   - Verify async function declarations
   - Handle race conditions

5. MOCK ERRORS
   - Verify mock setup matches usage
   - Check mock return value types
   - Ensure mocks are reset between tests
   - Validate mock call assertions

OUTPUT FORMAT:
Return a JSON object matching the BugFixerOutputSchema with:
- Detailed analysis of each failure's root cause
- Complete fixed file contents (not just patches)
- Group related failures that share root cause
- Clearly mark anything requiring human review`;
  }

  private buildUserPrompt(input: BugFixerInput): string {
    let prompt = `# Bug Fix Request for Feature: ${input.feature}

## Test Failures to Fix

`;

    for (const failure of input.failures) {
      prompt += `### ${failure.testName}
- **Category**: ${failure.category}
- **Test File**: ${failure.testFile}
- **Source File**: ${failure.sourceFile}${failure.sourceLine ? `:${failure.sourceLine}` : ''}
- **Message**: ${failure.message}
${failure.expected ? `- **Expected**: ${failure.expected}` : ''}
${failure.actual ? `- **Actual**: ${failure.actual}` : ''}
${failure.stack ? `- **Stack**:\n\`\`\`\n${failure.stack}\n\`\`\`` : ''}
${failure.suggestedFix ? `- **Suggested Fix**: ${failure.suggestedFix}` : ''}

`;
    }

    prompt += `## Source Files\n\n`;
    for (const [filename, content] of Object.entries(input.sourceFiles)) {
      prompt += `### ${filename}\n\`\`\`typescript\n${content}\n\`\`\`\n\n`;
    }

    prompt += `## Test Files\n\n`;
    for (const [filename, content] of Object.entries(input.testFiles)) {
      prompt += `### ${filename}\n\`\`\`typescript\n${content}\n\`\`\`\n\n`;
    }

    if (input.coverageGaps && input.coverageGaps.length > 0) {
      prompt += `## Coverage Gaps\n\n`;
      for (const gap of input.coverageGaps) {
        prompt += `- ${gap.file}: lines ${gap.uncoveredLines.join(', ')}\n`;
      }
    }

    prompt += `
## Instructions

1. Analyze each failure to identify the root cause
2. Group failures that share the same root cause
3. Create fixes for the SOURCE files (not test files)
4. Provide complete fixed file contents
5. Estimate confidence that fixes will work

Return valid JSON matching BugFixerOutputSchema.`;

    return prompt;
  }

  private parseResponse(text: string): BugFixerOutput {
    const jsonMatch = text.match(/```json\n?([\s\S]*?)\n?```/) ||
                      text.match(/\{[\s\S]*\}/);

    if (!jsonMatch) {
      throw new Error("No JSON found in response");
    }

    const jsonStr = jsonMatch[1] || jsonMatch[0];
    const parsed = JSON.parse(jsonStr);

    return BugFixerOutputSchema.parse(parsed);
  }
}
```

## Fix Strategy Engine

```typescript
// ============================================================================
// Specialized Fix Strategies
// ============================================================================

export type FailureCategory = z.infer<typeof FailureInputSchema>['category'];

interface FixStrategy {
  category: FailureCategory;
  patterns: RegExp[];
  apply(failure: z.infer<typeof FailureInputSchema>, sourceContent: string): string | null;
}

export class FixStrategyEngine {
  private strategies: FixStrategy[] = [
    // Assertion failure strategies
    {
      category: 'assertion',
      patterns: [/Expected.*to equal/i, /toBe.*received/i],
      apply: (failure, source) => {
        // Analyze expected vs actual to suggest transformation
        if (failure.expected && failure.actual) {
          return this.fixAssertionMismatch(failure, source);
        }
        return null;
      },
    },

    // Type error strategies
    {
      category: 'type_error',
      patterns: [/Type '.*' is not assignable/i, /Property '.*' does not exist/i],
      apply: (failure, source) => {
        return this.fixTypeError(failure, source);
      },
    },

    // Reference error strategies
    {
      category: 'reference_error',
      patterns: [/is not defined/i, /Cannot read properties of undefined/i],
      apply: (failure, source) => {
        return this.fixReferenceError(failure, source);
      },
    },

    // Async error strategies
    {
      category: 'async',
      patterns: [/not wrapped in act/i, /Promise.*rejected/i],
      apply: (failure, source) => {
        return this.fixAsyncError(failure, source);
      },
    },
  ];

  private fixAssertionMismatch(
    failure: z.infer<typeof FailureInputSchema>,
    source: string
  ): string | null {
    // Common patterns:
    // 1. Missing data transformation
    // 2. Wrong return value
    // 3. Incorrect calculation
    // 4. Missing property

    const { expected, actual, sourceLine } = failure;
    if (!expected || !actual || !sourceLine) return null;

    const lines = source.split('\n');
    const targetLine = lines[sourceLine - 1];

    // Try to infer fix from expected value
    // This is a simplified heuristic - real implementation would be more sophisticated

    return null; // Return null if no automatic fix possible
  }

  private fixTypeError(
    failure: z.infer<typeof FailureInputSchema>,
    source: string
  ): string | null {
    const { message, sourceLine } = failure;
    if (!sourceLine) return null;

    const lines = source.split('\n');
    const targetLine = lines[sourceLine - 1];

    // Pattern: Property does not exist
    const propMatch = message.match(/Property '(\w+)' does not exist on type '(\w+)'/);
    if (propMatch) {
      const [, prop, type] = propMatch;
      // Add optional chaining or type assertion
      const fixed = targetLine.replace(
        new RegExp(`(\\w+)\\.${prop}`),
        `$1?.${prop}`
      );
      if (fixed !== targetLine) {
        lines[sourceLine - 1] = fixed;
        return lines.join('\n');
      }
    }

    return null;
  }

  private fixReferenceError(
    failure: z.infer<typeof FailureInputSchema>,
    source: string
  ): string | null {
    const { message, sourceFile } = failure;

    // Pattern: X is not defined
    const notDefinedMatch = message.match(/(\w+) is not defined/);
    if (notDefinedMatch) {
      const [, identifier] = notDefinedMatch;

      // Check if it's a missing import
      // Add import statement if needed
      if (!source.includes(`import`) || !source.includes(identifier)) {
        // Would need to determine the correct import path
        return null;
      }
    }

    return null;
  }

  private fixAsyncError(
    failure: z.infer<typeof FailureInputSchema>,
    source: string
  ): string | null {
    const { message, sourceLine } = failure;
    if (!sourceLine) return null;

    const lines = source.split('\n');
    const targetLine = lines[sourceLine - 1];

    // Pattern: Missing await
    if (message.includes('Promise') && !targetLine.includes('await')) {
      // Add await to async call
      const fixed = targetLine.replace(
        /(\s*)(return\s+)?(\w+\([^)]*\))/,
        '$1$2await $3'
      );
      if (fixed !== targetLine) {
        lines[sourceLine - 1] = fixed;
        return lines.join('\n');
      }
    }

    return null;
  }

  findStrategy(failure: z.infer<typeof FailureInputSchema>): FixStrategy | null {
    return this.strategies.find(s => s.category === failure.category) || null;
  }

  attemptAutoFix(
    failure: z.infer<typeof FailureInputSchema>,
    sourceContent: string
  ): string | null {
    const strategy = this.findStrategy(failure);
    if (!strategy) return null;
    return strategy.apply(failure, sourceContent);
  }
}
```

## Batch Fix Processor

```typescript
// ============================================================================
// Batch Processing for Multiple Failures
// ============================================================================

export class BatchFixProcessor {
  private agent: BugFixerAgent;
  private strategyEngine: FixStrategyEngine;
  private maxRetries = 3;

  constructor() {
    this.agent = new BugFixerAgent();
    this.strategyEngine = new FixStrategyEngine();
  }

  async processFailures(input: BugFixerInput): Promise<{
    fixes: z.infer<typeof CodeFixSchema>[];
    iterations: number;
    allPassing: boolean;
  }> {
    let currentInput = { ...input };
    let allFixes: z.infer<typeof CodeFixSchema>[] = [];
    let iteration = 0;

    while (iteration < this.maxRetries && currentInput.failures.length > 0) {
      iteration++;
      console.log(`Fix iteration ${iteration}: ${currentInput.failures.length} failures`);

      // Try auto-fix first for simple cases
      const autoFixes = this.attemptAutoFixes(currentInput);

      // Use AI agent for complex cases
      const aiResult = await this.agent.fix({
        ...currentInput,
        failures: currentInput.failures.filter(
          f => !autoFixes.some(af => af.fixesFailures.includes(f.testName))
        ),
      });

      allFixes = [...allFixes, ...autoFixes, ...aiResult.fixes];

      // Apply fixes and re-run tests would happen here
      // For now, we assume fixes are applied and return

      if (aiResult.unfixable.length === currentInput.failures.length) {
        // No progress made, stop
        break;
      }

      // Update failures for next iteration (would come from re-running tests)
      currentInput = {
        ...currentInput,
        failures: [], // Would be populated by running tests again
        sourceFiles: this.applyFixes(currentInput.sourceFiles, allFixes),
      };
    }

    return {
      fixes: allFixes,
      iterations: iteration,
      allPassing: currentInput.failures.length === 0,
    };
  }

  private attemptAutoFixes(input: BugFixerInput): z.infer<typeof CodeFixSchema>[] {
    const fixes: z.infer<typeof CodeFixSchema>[] = [];

    for (const failure of input.failures) {
      const sourceContent = input.sourceFiles[failure.sourceFile];
      if (!sourceContent) continue;

      const fixed = this.strategyEngine.attemptAutoFix(failure, sourceContent);
      if (fixed) {
        fixes.push({
          file: failure.sourceFile,
          originalContent: sourceContent,
          fixedContent: fixed,
          changes: [{ line: failure.sourceLine || 0, type: 'modify', description: 'Auto-fix applied' }],
          fixesFailures: [failure.testName],
        });
      }
    }

    return fixes;
  }

  private applyFixes(
    sourceFiles: Record<string, string>,
    fixes: z.infer<typeof CodeFixSchema>[]
  ): Record<string, string> {
    const updated = { ...sourceFiles };

    for (const fix of fixes) {
      updated[fix.file] = fix.fixedContent;
    }

    return updated;
  }
}
```

## Integration with Orchestrator

```typescript
// ============================================================================
// Orchestrator Integration
// ============================================================================

import { StateGraph, StateContext } from '../CP0-FOUNDATION/03-STATE-MACHINE';

interface BugFixNode {
  id: 'bug_fixer';
  input: BugFixerInput;
  output: BugFixerOutput;
}

export function addBugFixerToGraph(graph: StateGraph): void {
  const processor = new BatchFixProcessor();

  graph.addNode('bug_fixer', async (ctx: StateContext) => {
    const testResults = ctx.testResults;
    if (!testResults || testResults.failures.length === 0) {
      return { ...ctx, bugFixResult: null };
    }

    // Build input from test results
    const input: BugFixerInput = {
      feature: ctx.currentFeature!,
      failures: testResults.failures.map(f => ({
        testFile: f.file,
        testName: f.name,
        category: f.analysis?.category || 'unknown',
        message: f.message,
        stack: f.stack,
        expected: f.expected,
        actual: f.actual,
        sourceFile: f.analysis?.sourceFile || '',
        sourceLine: f.analysis?.sourceLine,
        suggestedFix: f.analysis?.suggestedFix,
      })),
      sourceFiles: ctx.generatedCode || {},
      testFiles: ctx.generatedTests || {},
    };

    const result = await processor.processFailures(input);

    return {
      ...ctx,
      bugFixResult: result,
      generatedCode: processor['applyFixes'](ctx.generatedCode || {}, result.fixes),
    };
  });

  // Add edge from tester to bug_fixer when tests fail
  graph.addConditionalEdge('tester', (ctx: StateContext) => {
    if (ctx.testResults?.failures && ctx.testResults.failures.length > 0) {
      return 'bug_fixer';
    }
    return 'reviewer'; // Skip to review if all tests pass
  });

  // Add edge from bug_fixer back to tester for verification
  graph.addEdge('bug_fixer', 'tester');
}
```

## Example: Fixing a Login Component

```typescript
// Example failure input from Tester Agent
const exampleInput: BugFixerInput = {
  feature: "User Authentication",
  failures: [
    {
      testFile: "src/components/LoginForm.test.tsx",
      testName: "shows error message on invalid credentials",
      category: "assertion",
      message: "Expected 'Invalid email or password' but received ''",
      expected: "Invalid email or password",
      actual: "",
      sourceFile: "src/components/LoginForm.tsx",
      sourceLine: 42,
      suggestedFix: "Ensure error state is set when login fails",
    },
    {
      testFile: "src/components/LoginForm.test.tsx",
      testName: "disables submit button while loading",
      category: "assertion",
      message: "Expected button to be disabled",
      expected: "disabled",
      actual: "enabled",
      sourceFile: "src/components/LoginForm.tsx",
      sourceLine: 67,
      suggestedFix: "Add disabled prop bound to loading state",
    },
  ],
  sourceFiles: {
    "src/components/LoginForm.tsx": `
import { useState } from 'react';
import { useAuth } from '../hooks/useAuth';

export function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await login(email, password);
    } catch (err) {
      // Error handling missing!
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <input
        type="email"
        value={email}
        onChange={e => setEmail(e.target.value)}
        placeholder="Email"
      />
      <input
        type="password"
        value={password}
        onChange={e => setPassword(e.target.value)}
        placeholder="Password"
      />
      <button type="submit">Login</button>
    </form>
  );
}`,
  },
  testFiles: {
    "src/components/LoginForm.test.tsx": `
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { LoginForm } from './LoginForm';
import { useAuth } from '../hooks/useAuth';

vi.mock('../hooks/useAuth');

describe('LoginForm', () => {
  it('shows error message on invalid credentials', async () => {
    const mockLogin = vi.fn().mockRejectedValue(new Error('Invalid credentials'));
    vi.mocked(useAuth).mockReturnValue({ login: mockLogin });

    render(<LoginForm />);

    fireEvent.change(screen.getByPlaceholderText('Email'), {
      target: { value: 'test@example.com' },
    });
    fireEvent.change(screen.getByPlaceholderText('Password'), {
      target: { value: 'wrongpassword' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Login' }));

    await waitFor(() => {
      expect(screen.getByText('Invalid email or password')).toBeInTheDocument();
    });
  });

  it('disables submit button while loading', async () => {
    const mockLogin = vi.fn().mockImplementation(() => new Promise(() => {}));
    vi.mocked(useAuth).mockReturnValue({ login: mockLogin });

    render(<LoginForm />);

    fireEvent.click(screen.getByRole('button', { name: 'Login' }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Login' })).toBeDisabled();
    });
  });
});`,
  },
};

// Example output from Bug Fixer Agent
const exampleOutput: BugFixerOutput = {
  feature: "User Authentication",
  analyses: [
    {
      failureId: "failure-1",
      testName: "shows error message on invalid credentials",
      rootCause: "Error state is not being set when login fails. The catch block is empty.",
      fixStrategy: "Add error state and set it in catch block. Display error in JSX.",
      confidence: "high",
      relatedFailures: [],
    },
    {
      failureId: "failure-2",
      testName: "disables submit button while loading",
      rootCause: "Button is missing the disabled prop bound to loading state.",
      fixStrategy: "Add disabled={loading} prop to the submit button.",
      confidence: "high",
      relatedFailures: [],
    },
  ],
  fixes: [
    {
      file: "src/components/LoginForm.tsx",
      originalContent: "...", // original content
      fixedContent: `
import { useState } from 'react';
import { useAuth } from '../hooks/useAuth';

export function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { login } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await login(email, password);
    } catch (err) {
      setError('Invalid email or password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      {error && <div role="alert">{error}</div>}
      <input
        type="email"
        value={email}
        onChange={e => setEmail(e.target.value)}
        placeholder="Email"
      />
      <input
        type="password"
        value={password}
        onChange={e => setPassword(e.target.value)}
        placeholder="Password"
      />
      <button type="submit" disabled={loading}>
        Login
      </button>
    </form>
  );
}`,
      changes: [
        { line: 8, type: "add", description: "Added error state" },
        { line: 14, type: "add", description: "Reset error on submit" },
        { line: 19, type: "modify", description: "Set error message in catch block" },
        { line: 25, type: "add", description: "Added error display div" },
        { line: 37, type: "modify", description: "Added disabled prop to button" },
      ],
      fixesFailures: [
        "shows error message on invalid credentials",
        "disables submit button while loading",
      ],
    },
  ],
  unfixable: [],
  summary: {
    totalFailures: 2,
    fixedCount: 2,
    unfixableCount: 0,
    filesModified: 1,
    estimatedSuccess: 95,
  },
};
```

## Validation Checklist

- [ ] BugFixerAgent receives FailureInput from Tester
- [ ] Fix strategies defined for each failure category
- [ ] Auto-fix engine attempts simple fixes first
- [ ] AI agent handles complex fixes
- [ ] Output includes complete fixed file contents
- [ ] Related failures grouped by root cause
- [ ] Unfixable issues marked for human review
- [ ] Integration with StateGraph for fix loop
- [ ] Retry mechanism with max iterations
- [ ] Tests are NEVER modified (TDD principle)

## Exports

```typescript
export {
  // Schemas
  FailureInputSchema,
  BugFixerInputSchema,
  CodeFixSchema,
  FixAnalysisSchema,
  BugFixerOutputSchema,

  // Types
  BugFixerInput,
  BugFixerOutput,
  FailureCategory,

  // Classes
  BugFixerAgent,
  FixStrategyEngine,
  BatchFixProcessor,

  // Graph integration
  addBugFixerToGraph,
};
```
