# Step 05d: Analyst Agent

> **Checkpoint:** CP1 - Design System
> **Previous Step:** 05c-ARCHITECT-AGENT.md
> **Next Step:** 05e-PROJECT-ANALYZER-AGENT.md

---

## Overview

The **Analyst Agent** provides research and best practices recommendations. It investigates questions about technologies, patterns, and approaches, providing well-reasoned recommendations with cited sources.

Key responsibilities:
- Research best practices for specific technologies
- Compare and evaluate libraries/frameworks
- Investigate implementation approaches
- Provide recommendations with confidence levels
- Cite sources and documentation

---

## Deliverables

1. `src/agents/agents/analyst.ts` - Analyst agent implementation
2. `src/agents/schemas/analyst-output.ts` - Output schema

---

## 1. Output Schema (`src/agents/schemas/analyst-output.ts`)

```typescript
/**
 * Analyst Agent Output Schema
 */

import { z } from 'zod';
import { AgentType } from '../types';

/**
 * Research source
 */
export const SourceSchema = z.object({
  title: z.string(),
  url: z.string().url().optional(),
  type: z.enum(['documentation', 'article', 'github', 'stackoverflow', 'book', 'video', 'other']),
  credibility: z.enum(['official', 'community', 'expert', 'unknown']),
  date: z.string().optional(),
});

export type Source = z.infer<typeof SourceSchema>;

/**
 * Comparison option
 */
export const ComparisonOptionSchema = z.object({
  name: z.string(),
  description: z.string(),
  pros: z.array(z.string()),
  cons: z.array(z.string()),
  useCases: z.array(z.string()),
  popularity: z.enum(['high', 'medium', 'low', 'unknown']),
  maintenance: z.enum(['active', 'stable', 'declining', 'abandoned', 'unknown']),
  learningCurve: z.enum(['easy', 'moderate', 'steep']),
  communitySize: z.enum(['large', 'medium', 'small', 'unknown']),
  score: z.number().min(0).max(100).optional(),
});

export type ComparisonOption = z.infer<typeof ComparisonOptionSchema>;

/**
 * Best practice
 */
export const BestPracticeSchema = z.object({
  title: z.string(),
  description: z.string(),
  rationale: z.string(),
  example: z.string().optional(),
  caveats: z.array(z.string()),
  sources: z.array(SourceSchema),
});

export type BestPractice = z.infer<typeof BestPracticeSchema>;

/**
 * Research finding
 */
export const FindingSchema = z.object({
  topic: z.string(),
  summary: z.string(),
  details: z.string(),
  evidence: z.array(z.string()),
  confidence: z.number().min(0).max(1),
  sources: z.array(SourceSchema),
});

export type Finding = z.infer<typeof FindingSchema>;

/**
 * Recommendation
 */
export const RecommendationSchema = z.object({
  recommendation: z.string(),
  reasoning: z.string(),
  confidence: z.number().min(0).max(1),
  alternatives: z.array(z.object({
    option: z.string(),
    whenToUse: z.string(),
  })),
  implementation: z.object({
    steps: z.array(z.string()),
    estimatedEffort: z.string(),
    risks: z.array(z.string()),
  }).optional(),
});

export type Recommendation = z.infer<typeof RecommendationSchema>;

/**
 * Research report types
 */
export const ReportTypeSchema = z.enum([
  'comparison',
  'best_practices',
  'investigation',
  'recommendation',
  'feasibility',
]);

export type ReportType = z.infer<typeof ReportTypeSchema>;

/**
 * Complete analyst output
 */
export const AnalystOutputSchema = z.object({
  reportType: ReportTypeSchema,
  question: z.string(),
  executiveSummary: z.string(),

  // For comparison reports
  comparison: z.object({
    options: z.array(ComparisonOptionSchema),
    winner: z.string().optional(),
    criteria: z.array(z.string()),
    matrix: z.record(z.string(), z.record(z.string(), z.number())).optional(),
  }).optional(),

  // For best practices reports
  bestPractices: z.array(BestPracticeSchema).optional(),

  // For investigation reports
  findings: z.array(FindingSchema).optional(),

  // For all reports
  recommendation: RecommendationSchema,
  sources: z.array(SourceSchema),
  limitations: z.array(z.string()),
  furtherResearch: z.array(z.string()),

  routingHints: z.object({
    suggestNext: z.array(z.nativeEnum(AgentType)),
    skipAgents: z.array(z.nativeEnum(AgentType)),
    needsApproval: z.boolean(),
    hasFailures: z.boolean(),
    isComplete: z.boolean(),
    needsUserDecision: z.boolean(),
    suggestedOption: z.string().optional(),
  }),
});

export type AnalystOutput = z.infer<typeof AnalystOutputSchema>;
```

---

## 2. Analyst Agent (`src/agents/agents/analyst.ts`)

```typescript
/**
 * Analyst Agent
 *
 * Provides research and best practices recommendations.
 */

import { BaseAgent } from '../base-agent';
import {
  AgentMetadata,
  AgentContext,
  AgentRequest,
  RoutingHints,
  Artifact,
  AgentType,
} from '../types';
import { AnalystOutput, ReportType } from '../schemas/analyst-output';
import { logger } from '../../utils/logger';

/**
 * Analyst Agent implementation
 */
export class AnalystAgent extends BaseAgent {
  constructor() {
    super({
      id: AgentType.ANALYST,
      name: 'Analyst',
      description: 'Provides research and best practices recommendations',
      version: '1.0.0',
      capabilities: [
        {
          name: 'technology-comparison',
          description: 'Compare and evaluate technologies',
          inputTypes: ['question'],
          outputTypes: ['comparison-report'],
        },
        {
          name: 'best-practices-research',
          description: 'Research best practices',
          inputTypes: ['topic'],
          outputTypes: ['best-practices-report'],
        },
        {
          name: 'feasibility-analysis',
          description: 'Analyze feasibility of approaches',
          inputTypes: ['proposal'],
          outputTypes: ['feasibility-report'],
        },
      ],
      requiredContext: [
        { type: 'current_task', required: true },
      ],
      outputSchema: 'analyst-output',
    });
  }

  /**
   * Build system prompt
   */
  protected buildSystemPrompt(context: AgentContext): string {
    return `You are the Analyst agent responsible for research and recommendations.

Your responsibilities:
1. Research best practices for technologies and patterns
2. Compare and evaluate libraries, frameworks, and approaches
3. Investigate specific technical questions
4. Provide well-reasoned recommendations
5. Cite sources and documentation

Guidelines:
- Always cite sources for claims
- Present multiple options when applicable
- Be explicit about confidence levels
- Don't make implementation decisions - only recommend
- Acknowledge limitations and gaps in knowledge
- Distinguish between official documentation and community sources

Report Types:
- comparison: When comparing multiple options
- best_practices: When researching how to do something
- investigation: When answering specific questions
- recommendation: When advising on a decision
- feasibility: When assessing if something is possible

Output must be valid JSON matching the AnalystOutput schema.`;
  }

  /**
   * Build user prompt
   */
  protected buildUserPrompt(request: AgentRequest): string {
    const task = request.context.task;

    // Determine report type from task
    const reportType = this.determineReportType(task);

    let prompt = `Research Question: ${task.description || JSON.stringify(task)}\n\n`;
    prompt += `Report Type: ${reportType}\n\n`;
    prompt += `Provide a comprehensive analysis with:\n`;
    prompt += `- Executive summary (2-3 sentences)\n`;
    prompt += `- Detailed findings with evidence\n`;
    prompt += `- Clear recommendation with confidence level\n`;
    prompt += `- Cited sources\n`;
    prompt += `- Limitations of this analysis\n`;

    return prompt;
  }

  /**
   * Determine report type from task
   */
  private determineReportType(task: any): ReportType {
    const description = (task.description || JSON.stringify(task)).toLowerCase();

    if (description.includes('compare') || description.includes('vs') || description.includes('versus')) {
      return 'comparison';
    }
    if (description.includes('best practice') || description.includes('how to') || description.includes('how should')) {
      return 'best_practices';
    }
    if (description.includes('feasible') || description.includes('possible') || description.includes('can we')) {
      return 'feasibility';
    }
    if (description.includes('recommend') || description.includes('should we') || description.includes('which')) {
      return 'recommendation';
    }

    return 'investigation';
  }

  /**
   * Parse LLM response
   */
  protected parseResponse(response: any): AnalystOutput {
    const text = this.extractTextContent(response);
    return this.parseJSON<AnalystOutput>(text);
  }

  /**
   * Process result
   */
  protected async processResult(
    parsed: AnalystOutput,
    request: AgentRequest
  ): Promise<{ result: AnalystOutput; artifacts: Artifact[] }> {
    const artifacts: Artifact[] = [];

    // Create research report artifact
    artifacts.push({
      id: this.generateArtifactId(),
      type: 'report',
      path: `research/${this.slugify(parsed.question)}.md`,
      content: this.renderReport(parsed),
      metadata: {
        reportType: parsed.reportType,
        confidence: parsed.recommendation.confidence,
        sourcesCount: parsed.sources.length,
      },
    });

    return { result: parsed, artifacts };
  }

  /**
   * Generate routing hints
   */
  protected generateRoutingHints(
    result: AnalystOutput,
    artifacts: Artifact[],
    request: AgentRequest
  ): RoutingHints {
    return {
      suggestNext: result.routingHints.suggestNext,
      skipAgents: result.routingHints.skipAgents,
      needsApproval: result.routingHints.needsUserDecision,
      hasFailures: false,
      isComplete: true,
      notes: `Research complete with ${result.recommendation.confidence * 100}% confidence`,
    };
  }

  /**
   * Render report as markdown
   */
  private renderReport(output: AnalystOutput): string {
    const lines: string[] = [];

    lines.push(`# Research Report: ${output.question}`);
    lines.push('');
    lines.push(`**Report Type:** ${output.reportType}`);
    lines.push(`**Confidence:** ${Math.round(output.recommendation.confidence * 100)}%`);
    lines.push('');

    lines.push('## Executive Summary');
    lines.push('');
    lines.push(output.executiveSummary);
    lines.push('');

    // Comparison section
    if (output.comparison) {
      lines.push('## Comparison');
      lines.push('');
      for (const option of output.comparison.options) {
        lines.push(`### ${option.name}`);
        lines.push('');
        lines.push(option.description);
        lines.push('');
        lines.push('**Pros:**');
        option.pros.forEach(p => lines.push(`- ${p}`));
        lines.push('');
        lines.push('**Cons:**');
        option.cons.forEach(c => lines.push(`- ${c}`));
        lines.push('');
      }
      if (output.comparison.winner) {
        lines.push(`**Recommended:** ${output.comparison.winner}`);
        lines.push('');
      }
    }

    // Best practices section
    if (output.bestPractices && output.bestPractices.length > 0) {
      lines.push('## Best Practices');
      lines.push('');
      for (const practice of output.bestPractices) {
        lines.push(`### ${practice.title}`);
        lines.push('');
        lines.push(practice.description);
        lines.push('');
        lines.push(`**Rationale:** ${practice.rationale}`);
        if (practice.example) {
          lines.push('');
          lines.push('**Example:**');
          lines.push('```');
          lines.push(practice.example);
          lines.push('```');
        }
        lines.push('');
      }
    }

    // Findings section
    if (output.findings && output.findings.length > 0) {
      lines.push('## Findings');
      lines.push('');
      for (const finding of output.findings) {
        lines.push(`### ${finding.topic}`);
        lines.push('');
        lines.push(finding.summary);
        lines.push('');
        lines.push(finding.details);
        lines.push('');
        lines.push(`**Confidence:** ${Math.round(finding.confidence * 100)}%`);
        lines.push('');
      }
    }

    // Recommendation
    lines.push('## Recommendation');
    lines.push('');
    lines.push(output.recommendation.recommendation);
    lines.push('');
    lines.push(`**Reasoning:** ${output.recommendation.reasoning}`);
    lines.push('');

    if (output.recommendation.alternatives.length > 0) {
      lines.push('**Alternatives:**');
      for (const alt of output.recommendation.alternatives) {
        lines.push(`- **${alt.option}:** ${alt.whenToUse}`);
      }
      lines.push('');
    }

    // Sources
    lines.push('## Sources');
    lines.push('');
    for (const source of output.sources) {
      const url = source.url ? ` - ${source.url}` : '';
      lines.push(`- [${source.credibility}] ${source.title}${url}`);
    }
    lines.push('');

    // Limitations
    if (output.limitations.length > 0) {
      lines.push('## Limitations');
      lines.push('');
      output.limitations.forEach(l => lines.push(`- ${l}`));
      lines.push('');
    }

    return lines.join('\n');
  }

  /**
   * Slugify string for filename
   */
  private slugify(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .substring(0, 50);
  }
}
```

---

## Test Scenarios

```typescript
// tests/agents/analyst.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { AnalystAgent } from '../../src/agents/agents/analyst';

describe('AnalystAgent', () => {
  let agent: AnalystAgent;

  beforeEach(() => {
    agent = new AnalystAgent();
  });

  it('should have correct metadata', () => {
    const metadata = agent.getMetadata();
    expect(metadata.id).toBe('analyst');
    expect(metadata.capabilities).toHaveLength(3);
  });

  it('should detect comparison report type', () => {
    // Test that "compare X vs Y" triggers comparison type
    // Implementation would test the private method through integration tests
  });

  it('should detect best practices report type', () => {
    // Test that "best practices for X" triggers best_practices type
  });
});
```

---

## Validation Checklist

```
□ Analyst agent implemented
□ Output schema complete
□ Report type detection works
□ Markdown report generation works
□ Source citation included
□ Confidence levels reported
□ All tests pass
```

---

## Next Step

Proceed to **05e-PROJECT-ANALYZER-AGENT.md** to implement the project analyzer agent.
