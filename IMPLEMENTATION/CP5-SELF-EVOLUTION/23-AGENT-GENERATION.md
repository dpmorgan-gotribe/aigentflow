# Step 23: Agent Generation

## Overview

This step implements automatic agent generation from detected patterns and gaps. Uses DSPy-inspired techniques to generate optimized prompts, tool configurations, and agent specifications.

## Dependencies

- Step 22: Pattern Detection (gap analysis)
- Step 21: Execution Tracing (training data)
- Step 05: Agent Framework (base agent class)

---

## Part 1: Agent Specification Schema

### Generated Agent Schema

```typescript
import { z } from 'zod';

export const GeneratedAgentSpecSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  description: z.string(),
  version: z.string().default('0.1.0'),
  status: z.enum(['draft', 'testing', 'candidate', 'promoted', 'deprecated']),
  createdAt: z.number(),
  updatedAt: z.number(),

  // Source information
  source: z.object({
    type: z.enum(['gap_pattern', 'failure_pattern', 'optimization', 'manual']),
    patternId: z.string().optional(),
    traceIds: z.array(z.string()),
  }),

  // Agent configuration
  config: z.object({
    model: z.string().default('claude-sonnet-4-20250514'),
    temperature: z.number().min(0).max(1).default(0.7),
    maxTokens: z.number().default(4096),
    systemPrompt: z.string(),
    tools: z.array(z.string()),
    inputSchema: z.record(z.string(), z.unknown()),
    outputSchema: z.record(z.string(), z.unknown()),
  }),

  // Training data
  training: z.object({
    examples: z.array(z.object({
      input: z.unknown(),
      expectedOutput: z.unknown(),
      traceId: z.string().optional(),
    })),
    negativeExamples: z.array(z.object({
      input: z.unknown(),
      incorrectOutput: z.unknown(),
      explanation: z.string(),
    })).optional(),
  }),

  // Evaluation metrics
  metrics: z.object({
    testsPassed: z.number().default(0),
    testsFailed: z.number().default(0),
    avgLatency: z.number().optional(),
    avgCost: z.number().optional(),
    successRate: z.number().optional(),
    tournamentScore: z.number().optional(),
  }),
});

export type GeneratedAgentSpec = z.infer<typeof GeneratedAgentSpecSchema>;

export const PromptTemplateSchema = z.object({
  role: z.string(),
  context: z.string(),
  capabilities: z.array(z.string()),
  constraints: z.array(z.string()),
  outputFormat: z.string(),
  examples: z.array(z.object({
    input: z.string(),
    output: z.string(),
  })),
});

export type PromptTemplate = z.infer<typeof PromptTemplateSchema>;
```

### Tool Configuration Schema

```typescript
export const GeneratedToolConfigSchema = z.object({
  name: z.string(),
  description: z.string(),
  parameters: z.array(z.object({
    name: z.string(),
    type: z.string(),
    description: z.string(),
    required: z.boolean().default(true),
  })),
  returns: z.object({
    type: z.string(),
    description: z.string(),
  }),
  usage: z.object({
    when: z.string(),
    example: z.string(),
  }),
});

export type GeneratedToolConfig = z.infer<typeof GeneratedToolConfigSchema>;
```

---

## Part 2: Prompt Generation Engine

### DSPy-Inspired Prompt Optimizer

```typescript
import Anthropic from '@anthropic-ai/sdk';

export interface PromptOptimizationConfig {
  maxIterations: number;
  targetSuccessRate: number;
  evaluationSamples: number;
}

export const DEFAULT_OPTIMIZATION_CONFIG: PromptOptimizationConfig = {
  maxIterations: 5,
  targetSuccessRate: 0.9,
  evaluationSamples: 10,
};

export class PromptGenerator {
  private client: Anthropic;

  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey });
  }

  async generateInitialPrompt(
    capability: string,
    examples: Array<{ input: unknown; output: unknown }>,
    context: string
  ): Promise<PromptTemplate> {
    const response = await this.client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      system: `You are an expert at designing system prompts for AI agents.
Given a capability description and examples, generate an optimal system prompt template.
Output valid JSON matching the PromptTemplate schema.`,
      messages: [{
        role: 'user',
        content: `Generate a system prompt for an agent with this capability:

Capability: ${capability}

Context: ${context}

Examples:
${examples.map((e, i) => `
Example ${i + 1}:
Input: ${JSON.stringify(e.input)}
Expected Output: ${JSON.stringify(e.output)}
`).join('\n')}

Generate a PromptTemplate with:
- role: A clear role description
- context: Background context the agent needs
- capabilities: List of specific capabilities
- constraints: Rules and limitations
- outputFormat: Expected output format
- examples: 2-3 few-shot examples

Return as JSON:`,
      }],
    });

    const content = response.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type');
    }

    const jsonMatch = content.text.match(/```json\n?([\s\S]*?)\n?```/) ||
                      content.text.match(/\{[\s\S]*\}/);

    if (!jsonMatch) {
      throw new Error('Failed to parse prompt template');
    }

    return PromptTemplateSchema.parse(JSON.parse(jsonMatch[1] || jsonMatch[0]));
  }

  templateToSystemPrompt(template: PromptTemplate): string {
    return `You are ${template.role}.

## Context
${template.context}

## Capabilities
${template.capabilities.map(c => `- ${c}`).join('\n')}

## Constraints
${template.constraints.map(c => `- ${c}`).join('\n')}

## Output Format
${template.outputFormat}

## Examples
${template.examples.map((e, i) => `
### Example ${i + 1}
Input: ${e.input}
Output: ${e.output}
`).join('\n')}`;
  }
}

export class PromptOptimizer {
  private client: Anthropic;
  private config: PromptOptimizationConfig;

  constructor(apiKey: string, config: Partial<PromptOptimizationConfig> = {}) {
    this.client = new Anthropic({ apiKey });
    this.config = { ...DEFAULT_OPTIMIZATION_CONFIG, ...config };
  }

  async optimize(
    initialPrompt: string,
    evaluationFn: (prompt: string) => Promise<EvaluationResult>,
    feedback?: string[]
  ): Promise<OptimizationResult> {
    let currentPrompt = initialPrompt;
    let bestPrompt = initialPrompt;
    let bestScore = 0;
    const history: OptimizationIteration[] = [];

    for (let i = 0; i < this.config.maxIterations; i++) {
      // Evaluate current prompt
      const evaluation = await evaluationFn(currentPrompt);
      history.push({
        iteration: i,
        prompt: currentPrompt,
        evaluation,
      });

      if (evaluation.successRate > bestScore) {
        bestScore = evaluation.successRate;
        bestPrompt = currentPrompt;
      }

      // Check if target reached
      if (evaluation.successRate >= this.config.targetSuccessRate) {
        return {
          optimizedPrompt: currentPrompt,
          finalScore: evaluation.successRate,
          iterations: i + 1,
          history,
          converged: true,
        };
      }

      // Generate improved prompt
      currentPrompt = await this.improvePrompt(
        currentPrompt,
        evaluation,
        feedback
      );
    }

    return {
      optimizedPrompt: bestPrompt,
      finalScore: bestScore,
      iterations: this.config.maxIterations,
      history,
      converged: false,
    };
  }

  private async improvePrompt(
    currentPrompt: string,
    evaluation: EvaluationResult,
    feedback?: string[]
  ): Promise<string> {
    const response = await this.client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      system: `You are an expert at improving AI system prompts based on evaluation feedback.
Analyze the failures and suggest specific improvements.`,
      messages: [{
        role: 'user',
        content: `Current prompt:
${currentPrompt}

Evaluation results:
- Success rate: ${(evaluation.successRate * 100).toFixed(1)}%
- Failures: ${evaluation.failures.length}

Failure analysis:
${evaluation.failures.map((f, i) => `
Failure ${i + 1}:
- Input: ${JSON.stringify(f.input)}
- Expected: ${JSON.stringify(f.expected)}
- Actual: ${JSON.stringify(f.actual)}
- Error: ${f.error || 'Output mismatch'}
`).join('\n')}

${feedback ? `Additional feedback:\n${feedback.join('\n')}` : ''}

Improve this prompt to address the failures. Keep what works, fix what doesn't.
Return ONLY the improved prompt, no explanation.`,
      }],
    });

    const content = response.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type');
    }

    return content.text;
  }
}

export interface EvaluationResult {
  successRate: number;
  successes: Array<{
    input: unknown;
    output: unknown;
  }>;
  failures: Array<{
    input: unknown;
    expected: unknown;
    actual: unknown;
    error?: string;
  }>;
}

export interface OptimizationIteration {
  iteration: number;
  prompt: string;
  evaluation: EvaluationResult;
}

export interface OptimizationResult {
  optimizedPrompt: string;
  finalScore: number;
  iterations: number;
  history: OptimizationIteration[];
  converged: boolean;
}
```

---

## Part 3: Agent Generator

### Agent Factory

```typescript
import { GapPattern, GapRecommendation, PatternStorage } from './22-PATTERN-DETECTION';
import { TraceStorage, Trace, DecisionPoint } from './21-EXECUTION-TRACING';

export class AgentGenerator {
  private promptGenerator: PromptGenerator;
  private promptOptimizer: PromptOptimizer;
  private traceStorage: TraceStorage;
  private patternStorage: PatternStorage;

  constructor(
    apiKey: string,
    traceStorage: TraceStorage,
    patternStorage: PatternStorage
  ) {
    this.promptGenerator = new PromptGenerator(apiKey);
    this.promptOptimizer = new PromptOptimizer(apiKey);
    this.traceStorage = traceStorage;
    this.patternStorage = patternStorage;
  }

  async generateFromGap(gap: GapPattern): Promise<GeneratedAgentSpec> {
    // Extract training examples from traces
    const examples = await this.extractExamples(gap.traceIds);

    // Generate initial prompt
    const template = await this.promptGenerator.generateInitialPrompt(
      gap.attributes.requestedCapability,
      examples,
      `This agent handles: ${gap.description}`
    );

    // Determine required tools
    const tools = await this.inferRequiredTools(gap, examples);

    // Generate input/output schemas
    const schemas = this.inferSchemas(examples);

    const spec: GeneratedAgentSpec = {
      id: crypto.randomUUID(),
      name: this.generateAgentName(gap.attributes.requestedCapability),
      description: gap.description,
      version: '0.1.0',
      status: 'draft',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      source: {
        type: 'gap_pattern',
        patternId: gap.id,
        traceIds: gap.traceIds,
      },
      config: {
        model: 'claude-sonnet-4-20250514',
        temperature: 0.7,
        maxTokens: 4096,
        systemPrompt: this.promptGenerator.templateToSystemPrompt(template),
        tools,
        inputSchema: schemas.input,
        outputSchema: schemas.output,
      },
      training: {
        examples,
        negativeExamples: [],
      },
      metrics: {
        testsPassed: 0,
        testsFailed: 0,
      },
    };

    return spec;
  }

  async generateFromRecommendation(
    recommendation: GapRecommendation
  ): Promise<GeneratedAgentSpec> {
    // Get the associated pattern
    const pattern = await this.patternStorage.getPattern(recommendation.gapId);
    if (!pattern || pattern.type !== 'gap') {
      throw new Error(`Gap pattern not found: ${recommendation.gapId}`);
    }

    return this.generateFromGap(pattern as GapPattern);
  }

  private async extractExamples(
    traceIds: string[]
  ): Promise<Array<{ input: unknown; output: unknown }>> {
    const examples: Array<{ input: unknown; output: unknown }> = [];

    for (const traceId of traceIds.slice(0, 10)) {
      const trace = await this.traceStorage.getTrace(traceId);
      if (!trace) continue;

      // Extract successful operations as positive examples
      const successfulSpans = trace.spans.filter(s =>
        s.status === 'ok' && s.kind === 'agent'
      );

      for (const span of successfulSpans) {
        if (span.attributes['agent.input'] && span.attributes['agent.output']) {
          examples.push({
            input: span.attributes['agent.input'],
            output: span.attributes['agent.output'],
          });
        }
      }

      // Extract decision points as examples
      const decisions = await this.traceStorage.getDecisions(traceId);
      for (const decision of decisions) {
        if (decision.outcome?.success) {
          examples.push({
            input: decision.context.input,
            output: decision.decision.chosen,
          });
        }
      }
    }

    return examples.slice(0, 20); // Limit examples
  }

  private async inferRequiredTools(
    gap: GapPattern,
    examples: Array<{ input: unknown; output: unknown }>
  ): Promise<string[]> {
    // Analyze traces to find commonly used tools
    const toolUsage = new Map<string, number>();

    for (const traceId of gap.traceIds) {
      const trace = await this.traceStorage.getTrace(traceId);
      if (!trace) continue;

      for (const span of trace.spans) {
        if (span.kind === 'tool') {
          const tool = span.attributes['tool.name'] as string;
          toolUsage.set(tool, (toolUsage.get(tool) || 0) + 1);
        }
      }
    }

    // Return top tools by usage
    return Array.from(toolUsage.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([tool]) => tool);
  }

  private inferSchemas(
    examples: Array<{ input: unknown; output: unknown }>
  ): { input: Record<string, unknown>; output: Record<string, unknown> } {
    // Infer schema from examples
    const inputFields = new Set<string>();
    const outputFields = new Set<string>();

    for (const example of examples) {
      if (typeof example.input === 'object' && example.input !== null) {
        Object.keys(example.input).forEach(k => inputFields.add(k));
      }
      if (typeof example.output === 'object' && example.output !== null) {
        Object.keys(example.output).forEach(k => outputFields.add(k));
      }
    }

    return {
      input: Object.fromEntries(
        Array.from(inputFields).map(field => [field, { type: 'string' }])
      ),
      output: Object.fromEntries(
        Array.from(outputFields).map(field => [field, { type: 'string' }])
      ),
    };
  }

  private generateAgentName(capability: string): string {
    const words = capability
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .split(/\s+/)
      .slice(0, 3);

    return words
      .map(w => w.charAt(0).toUpperCase() + w.slice(1))
      .join('') + 'Agent';
  }

  async optimizeAgent(
    spec: GeneratedAgentSpec,
    testCases: Array<{ input: unknown; expectedOutput: unknown }>
  ): Promise<GeneratedAgentSpec> {
    const evaluationFn = async (prompt: string): Promise<EvaluationResult> => {
      const successes: EvaluationResult['successes'] = [];
      const failures: EvaluationResult['failures'] = [];

      for (const testCase of testCases) {
        try {
          const result = await this.runAgentWithPrompt(prompt, spec, testCase.input);

          if (this.outputMatches(result, testCase.expectedOutput)) {
            successes.push({ input: testCase.input, output: result });
          } else {
            failures.push({
              input: testCase.input,
              expected: testCase.expectedOutput,
              actual: result,
            });
          }
        } catch (error) {
          failures.push({
            input: testCase.input,
            expected: testCase.expectedOutput,
            actual: null,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      return {
        successRate: successes.length / testCases.length,
        successes,
        failures,
      };
    };

    const result = await this.promptOptimizer.optimize(
      spec.config.systemPrompt,
      evaluationFn
    );

    return {
      ...spec,
      config: {
        ...spec.config,
        systemPrompt: result.optimizedPrompt,
      },
      metrics: {
        ...spec.metrics,
        successRate: result.finalScore,
      },
      updatedAt: Date.now(),
    };
  }

  private async runAgentWithPrompt(
    prompt: string,
    spec: GeneratedAgentSpec,
    input: unknown
  ): Promise<unknown> {
    const client = new Anthropic();

    const response = await client.messages.create({
      model: spec.config.model,
      max_tokens: spec.config.maxTokens,
      temperature: spec.config.temperature,
      system: prompt,
      messages: [{
        role: 'user',
        content: JSON.stringify(input),
      }],
    });

    const content = response.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type');
    }

    try {
      return JSON.parse(content.text);
    } catch {
      return content.text;
    }
  }

  private outputMatches(actual: unknown, expected: unknown): boolean {
    // Simple comparison - could be made more sophisticated
    if (typeof actual === 'string' && typeof expected === 'string') {
      return actual.toLowerCase().includes(expected.toLowerCase()) ||
             expected.toLowerCase().includes(actual.toLowerCase());
    }

    return JSON.stringify(actual) === JSON.stringify(expected);
  }
}
```

---

## Part 4: Agent Code Generator

### TypeScript Agent Generator

```typescript
export class AgentCodeGenerator {
  generateAgentCode(spec: GeneratedAgentSpec): string {
    const className = spec.name;
    const inputTypeName = `${className}Input`;
    const outputTypeName = `${className}Output`;

    return `// Auto-generated agent: ${spec.name}
// Generated at: ${new Date(spec.createdAt).toISOString()}
// Source: ${spec.source.type} (${spec.source.patternId || 'manual'})

import { z } from 'zod';
import Anthropic from '@anthropic-ai/sdk';
import { BaseAgent, AgentContext, AgentResult } from './base-agent';

// Input Schema
export const ${inputTypeName}Schema = z.object(${this.generateZodSchema(spec.config.inputSchema)});
export type ${inputTypeName} = z.infer<typeof ${inputTypeName}Schema>;

// Output Schema
export const ${outputTypeName}Schema = z.object(${this.generateZodSchema(spec.config.outputSchema)});
export type ${outputTypeName} = z.infer<typeof ${outputTypeName}Schema>;

// Agent Implementation
export class ${className} extends BaseAgent<${inputTypeName}, ${outputTypeName}> {
  readonly name = '${spec.name}';
  readonly description = '${spec.description.replace(/'/g, "\\'")}';
  readonly version = '${spec.version}';

  private client: Anthropic;

  constructor(apiKey: string) {
    super();
    this.client = new Anthropic({ apiKey });
  }

  protected getSystemPrompt(): string {
    return \`${spec.config.systemPrompt.replace(/`/g, '\\`')}\`;
  }

  protected getTools(): string[] {
    return ${JSON.stringify(spec.config.tools)};
  }

  async execute(input: ${inputTypeName}, context?: AgentContext): Promise<AgentResult<${outputTypeName}>> {
    // Validate input
    const validatedInput = ${inputTypeName}Schema.parse(input);

    const startTime = Date.now();

    try {
      const response = await this.client.messages.create({
        model: '${spec.config.model}',
        max_tokens: ${spec.config.maxTokens},
        temperature: ${spec.config.temperature},
        system: this.getSystemPrompt(),
        messages: [{
          role: 'user',
          content: JSON.stringify(validatedInput),
        }],
      });

      const content = response.content[0];
      if (content.type !== 'text') {
        throw new Error('Unexpected response type');
      }

      // Parse and validate output
      const rawOutput = JSON.parse(content.text);
      const output = ${outputTypeName}Schema.parse(rawOutput);

      return {
        success: true,
        output,
        metrics: {
          duration: Date.now() - startTime,
          tokens: response.usage?.input_tokens + response.usage?.output_tokens || 0,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        metrics: {
          duration: Date.now() - startTime,
        },
      };
    }
  }
}

// Factory function
export function create${className}(apiKey: string): ${className} {
  return new ${className}(apiKey);
}
`;
  }

  private generateZodSchema(schema: Record<string, unknown>): string {
    const fields = Object.entries(schema)
      .map(([key, value]) => {
        const type = (value as any).type || 'string';
        let zodType = 'z.string()';

        switch (type) {
          case 'number': zodType = 'z.number()'; break;
          case 'boolean': zodType = 'z.boolean()'; break;
          case 'array': zodType = 'z.array(z.unknown())'; break;
          case 'object': zodType = 'z.record(z.string(), z.unknown())'; break;
          default: zodType = 'z.string()';
        }

        return `  ${key}: ${zodType}`;
      })
      .join(',\n');

    return `{\n${fields}\n}`;
  }

  generateTestFile(spec: GeneratedAgentSpec): string {
    const className = spec.name;

    return `// Auto-generated tests for: ${spec.name}

import { describe, it, expect, beforeAll } from 'vitest';
import { ${className}, create${className} } from './${this.toKebabCase(spec.name)}';

describe('${className}', () => {
  let agent: ${className};

  beforeAll(() => {
    agent = create${className}(process.env.ANTHROPIC_API_KEY!);
  });

${spec.training.examples.map((example, i) => `
  it('should handle example ${i + 1}', async () => {
    const input = ${JSON.stringify(example.input, null, 4)};
    const expectedOutput = ${JSON.stringify(example.expectedOutput, null, 4)};

    const result = await agent.execute(input);

    expect(result.success).toBe(true);
    // Add more specific assertions based on expected output
  });
`).join('\n')}

  it('should handle invalid input gracefully', async () => {
    const invalidInput = {};

    const result = await agent.execute(invalidInput as any);

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });
});
`;
  }

  private toKebabCase(str: string): string {
    return str
      .replace(/([a-z])([A-Z])/g, '$1-$2')
      .replace(/[\s_]+/g, '-')
      .toLowerCase();
  }
}
```

---

## Part 5: Agent Registry

### Generated Agent Storage

```typescript
export interface AgentRegistry {
  saveSpec(spec: GeneratedAgentSpec): Promise<void>;
  getSpec(id: string): Promise<GeneratedAgentSpec | null>;
  getSpecByName(name: string): Promise<GeneratedAgentSpec | null>;
  querySpecs(query: AgentSpecQuery): Promise<GeneratedAgentSpec[]>;
  updateSpec(id: string, updates: Partial<GeneratedAgentSpec>): Promise<void>;
  deleteSpec(id: string): Promise<void>;
  promoteSpec(id: string): Promise<void>;
  deprecateSpec(id: string): Promise<void>;
}

export const AgentSpecQuerySchema = z.object({
  status: z.enum(['draft', 'testing', 'candidate', 'promoted', 'deprecated']).optional(),
  sourceType: z.enum(['gap_pattern', 'failure_pattern', 'optimization', 'manual']).optional(),
  minSuccessRate: z.number().optional(),
  limit: z.number().default(50),
  offset: z.number().default(0),
});

export type AgentSpecQuery = z.infer<typeof AgentSpecQuerySchema>;

export class SQLiteAgentRegistry implements AgentRegistry {
  private db: Database;

  constructor(dbPath: string) {
    this.db = new Database(dbPath);
    this.initializeSchema();
  }

  private initializeSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS agent_specs (
        id TEXT PRIMARY KEY,
        name TEXT UNIQUE NOT NULL,
        description TEXT,
        version TEXT NOT NULL,
        status TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        source JSON NOT NULL,
        config JSON NOT NULL,
        training JSON NOT NULL,
        metrics JSON NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_agent_specs_name ON agent_specs(name);
      CREATE INDEX IF NOT EXISTS idx_agent_specs_status ON agent_specs(status);
    `);
  }

  async saveSpec(spec: GeneratedAgentSpec): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO agent_specs
      (id, name, description, version, status, created_at, updated_at,
       source, config, training, metrics)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      spec.id,
      spec.name,
      spec.description,
      spec.version,
      spec.status,
      spec.createdAt,
      spec.updatedAt,
      JSON.stringify(spec.source),
      JSON.stringify(spec.config),
      JSON.stringify(spec.training),
      JSON.stringify(spec.metrics)
    );
  }

  async getSpec(id: string): Promise<GeneratedAgentSpec | null> {
    const row = this.db.prepare('SELECT * FROM agent_specs WHERE id = ?').get(id);
    return row ? this.mapRow(row) : null;
  }

  async getSpecByName(name: string): Promise<GeneratedAgentSpec | null> {
    const row = this.db.prepare('SELECT * FROM agent_specs WHERE name = ?').get(name);
    return row ? this.mapRow(row) : null;
  }

  async querySpecs(query: AgentSpecQuery): Promise<GeneratedAgentSpec[]> {
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (query.status) {
      conditions.push('status = ?');
      params.push(query.status);
    }
    if (query.sourceType) {
      conditions.push("json_extract(source, '$.type') = ?");
      params.push(query.sourceType);
    }
    if (query.minSuccessRate !== undefined) {
      conditions.push("json_extract(metrics, '$.successRate') >= ?");
      params.push(query.minSuccessRate);
    }

    const whereClause = conditions.length > 0
      ? `WHERE ${conditions.join(' AND ')}`
      : '';

    const sql = `
      SELECT * FROM agent_specs
      ${whereClause}
      ORDER BY updated_at DESC
      LIMIT ? OFFSET ?
    `;

    params.push(query.limit, query.offset);

    const rows = this.db.prepare(sql).all(...params) as any[];
    return rows.map(this.mapRow);
  }

  async updateSpec(id: string, updates: Partial<GeneratedAgentSpec>): Promise<void> {
    const existing = await this.getSpec(id);
    if (!existing) {
      throw new Error(`Agent spec not found: ${id}`);
    }

    const updated = {
      ...existing,
      ...updates,
      updatedAt: Date.now(),
    };

    await this.saveSpec(updated);
  }

  async deleteSpec(id: string): Promise<void> {
    this.db.prepare('DELETE FROM agent_specs WHERE id = ?').run(id);
  }

  async promoteSpec(id: string): Promise<void> {
    await this.updateSpec(id, { status: 'promoted' });
  }

  async deprecateSpec(id: string): Promise<void> {
    await this.updateSpec(id, { status: 'deprecated' });
  }

  private mapRow(row: any): GeneratedAgentSpec {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      version: row.version,
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      source: JSON.parse(row.source),
      config: JSON.parse(row.config),
      training: JSON.parse(row.training),
      metrics: JSON.parse(row.metrics),
    };
  }
}
```

---

## Part 6: Agent Generation Pipeline

### Complete Generation Pipeline

```typescript
export class AgentGenerationPipeline {
  private generator: AgentGenerator;
  private codeGenerator: AgentCodeGenerator;
  private registry: AgentRegistry;
  private outputDir: string;

  constructor(
    apiKey: string,
    traceStorage: TraceStorage,
    patternStorage: PatternStorage,
    registry: AgentRegistry,
    outputDir: string
  ) {
    this.generator = new AgentGenerator(apiKey, traceStorage, patternStorage);
    this.codeGenerator = new AgentCodeGenerator();
    this.registry = registry;
    this.outputDir = outputDir;
  }

  async generateFromGaps(
    gaps: GapPattern[],
    options: { optimize?: boolean; generateCode?: boolean } = {}
  ): Promise<GenerationResult[]> {
    const results: GenerationResult[] = [];

    for (const gap of gaps) {
      try {
        // Generate agent spec
        let spec = await this.generator.generateFromGap(gap);

        // Optionally optimize with test cases
        if (options.optimize && spec.training.examples.length > 0) {
          const testCases = spec.training.examples.map(e => ({
            input: e.input,
            expectedOutput: e.expectedOutput,
          }));
          spec = await this.generator.optimizeAgent(spec, testCases);
        }

        // Save to registry
        await this.registry.saveSpec(spec);

        // Optionally generate code
        let codePath: string | undefined;
        let testPath: string | undefined;

        if (options.generateCode) {
          const code = this.codeGenerator.generateAgentCode(spec);
          const tests = this.codeGenerator.generateTestFile(spec);

          const fileName = this.toKebabCase(spec.name);
          codePath = `${this.outputDir}/${fileName}.ts`;
          testPath = `${this.outputDir}/${fileName}.test.ts`;

          await this.writeFile(codePath, code);
          await this.writeFile(testPath, tests);
        }

        results.push({
          success: true,
          spec,
          codePath,
          testPath,
        });
      } catch (error) {
        results.push({
          success: false,
          error: error instanceof Error ? error.message : String(error),
          gapId: gap.id,
        });
      }
    }

    return results;
  }

  async runTestsForSpec(specId: string): Promise<TestRunResult> {
    const spec = await this.registry.getSpec(specId);
    if (!spec) {
      throw new Error(`Agent spec not found: ${specId}`);
    }

    const testCases = spec.training.examples;
    let passed = 0;
    let failed = 0;
    const failures: Array<{ input: unknown; expected: unknown; actual: unknown; error?: string }> = [];

    for (const testCase of testCases) {
      try {
        const result = await this.runAgent(spec, testCase.input);

        if (this.outputMatches(result, testCase.expectedOutput)) {
          passed++;
        } else {
          failed++;
          failures.push({
            input: testCase.input,
            expected: testCase.expectedOutput,
            actual: result,
          });
        }
      } catch (error) {
        failed++;
        failures.push({
          input: testCase.input,
          expected: testCase.expectedOutput,
          actual: null,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    // Update metrics
    await this.registry.updateSpec(specId, {
      metrics: {
        ...spec.metrics,
        testsPassed: passed,
        testsFailed: failed,
        successRate: testCases.length > 0 ? passed / testCases.length : 0,
      },
      status: failed === 0 && passed > 0 ? 'candidate' : 'testing',
    });

    return {
      specId,
      passed,
      failed,
      successRate: testCases.length > 0 ? passed / testCases.length : 0,
      failures,
    };
  }

  private async runAgent(spec: GeneratedAgentSpec, input: unknown): Promise<unknown> {
    const client = new Anthropic();

    const response = await client.messages.create({
      model: spec.config.model,
      max_tokens: spec.config.maxTokens,
      temperature: spec.config.temperature,
      system: spec.config.systemPrompt,
      messages: [{
        role: 'user',
        content: JSON.stringify(input),
      }],
    });

    const content = response.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type');
    }

    try {
      return JSON.parse(content.text);
    } catch {
      return content.text;
    }
  }

  private outputMatches(actual: unknown, expected: unknown): boolean {
    if (typeof actual === 'string' && typeof expected === 'string') {
      return actual.toLowerCase().includes(expected.toLowerCase()) ||
             expected.toLowerCase().includes(actual.toLowerCase());
    }
    return JSON.stringify(actual) === JSON.stringify(expected);
  }

  private toKebabCase(str: string): string {
    return str
      .replace(/([a-z])([A-Z])/g, '$1-$2')
      .replace(/[\s_]+/g, '-')
      .toLowerCase();
  }

  private async writeFile(path: string, content: string): Promise<void> {
    const fs = await import('fs/promises');
    await fs.writeFile(path, content, 'utf-8');
  }
}

export interface GenerationResult {
  success: boolean;
  spec?: GeneratedAgentSpec;
  codePath?: string;
  testPath?: string;
  error?: string;
  gapId?: string;
}

export interface TestRunResult {
  specId: string;
  passed: number;
  failed: number;
  successRate: number;
  failures: Array<{
    input: unknown;
    expected: unknown;
    actual: unknown;
    error?: string;
  }>;
}
```

---

## Validation Checklist

- [ ] Prompt templates generated from capability descriptions
- [ ] System prompts include role, context, capabilities, constraints
- [ ] Few-shot examples extracted from successful traces
- [ ] Prompt optimization iterates based on test failures
- [ ] Convergence detected when target success rate reached
- [ ] Agent specs include input/output schemas
- [ ] Required tools inferred from trace analysis
- [ ] TypeScript agent code generated with Zod schemas
- [ ] Test files generated with examples
- [ ] Agent specs persisted in registry
- [ ] Status transitions: draft -> testing -> candidate -> promoted
- [ ] Metrics updated after test runs

---

## Next Steps

Proceed to **24-TOURNAMENT-PROMOTION.md** to implement competitive evaluation and promotion of generated agents.
