# Step 05c: Architect Agent

> **Checkpoint:** CP1 - Design System
> **Previous Step:** 05b-PROJECT-MANAGER-AGENT.md
> **Next Step:** 05d-ANALYST-AGENT.md

---

## Overview

The **Architect Agent** makes technical decisions for the project. It defines the tech stack, creates architecture decision records (ADRs), designs system structure, and ensures technical consistency across the codebase.

Key responsibilities:
- Select appropriate technologies and frameworks
- Design system architecture and component structure
- Create Architecture Decision Records (ADRs)
- Define API contracts and data models
- Establish coding conventions and patterns
- Ensure scalability, security, and maintainability

---

## Deliverables

1. `src/agents/agents/architect.ts` - Architect agent implementation
2. `src/agents/schemas/architect-output.ts` - Output schema
3. `src/architecture/adr-manager.ts` - ADR management
4. `src/architecture/tech-stack.ts` - Tech stack definitions

---

## 1. Output Schema (`src/agents/schemas/architect-output.ts`)

```typescript
/**
 * Architect Agent Output Schema
 */

import { z } from 'zod';
import { AgentType } from '../types';

/**
 * Technology selection
 */
export const TechnologySchema = z.object({
  name: z.string(),
  version: z.string().optional(),
  purpose: z.string(),
  alternatives: z.array(z.string()),
  reasoning: z.string(),
});

export type Technology = z.infer<typeof TechnologySchema>;

/**
 * Tech stack definition
 */
export const TechStackSchema = z.object({
  frontend: z.object({
    framework: TechnologySchema,
    language: TechnologySchema,
    styling: TechnologySchema,
    stateManagement: TechnologySchema.optional(),
    routing: TechnologySchema.optional(),
  }).optional(),
  backend: z.object({
    framework: TechnologySchema,
    language: TechnologySchema,
    runtime: TechnologySchema.optional(),
  }).optional(),
  database: z.object({
    primary: TechnologySchema,
    cache: TechnologySchema.optional(),
    search: TechnologySchema.optional(),
  }).optional(),
  infrastructure: z.object({
    hosting: TechnologySchema.optional(),
    ci: TechnologySchema.optional(),
    containerization: TechnologySchema.optional(),
  }).optional(),
  testing: z.object({
    unit: TechnologySchema,
    integration: TechnologySchema.optional(),
    e2e: TechnologySchema.optional(),
  }),
});

export type TechStack = z.infer<typeof TechStackSchema>;

/**
 * Architecture Decision Record (ADR)
 */
export const ADRSchema = z.object({
  id: z.string(),
  title: z.string(),
  status: z.enum(['proposed', 'accepted', 'deprecated', 'superseded']),
  date: z.string(),
  context: z.string(),
  decision: z.string(),
  consequences: z.object({
    positive: z.array(z.string()),
    negative: z.array(z.string()),
    risks: z.array(z.string()),
  }),
  alternatives: z.array(z.object({
    option: z.string(),
    pros: z.array(z.string()),
    cons: z.array(z.string()),
  })),
  relatedADRs: z.array(z.string()),
});

export type ADR = z.infer<typeof ADRSchema>;

/**
 * Component definition
 */
export const ComponentSchema = z.object({
  name: z.string(),
  type: z.enum(['service', 'library', 'module', 'component', 'utility', 'middleware']),
  description: z.string(),
  responsibilities: z.array(z.string()),
  dependencies: z.array(z.string()),
  interfaces: z.array(z.object({
    name: z.string(),
    type: z.enum(['api', 'event', 'function', 'import']),
    description: z.string(),
  })),
  location: z.string(), // Directory path
});

export type Component = z.infer<typeof ComponentSchema>;

/**
 * API endpoint definition
 */
export const APIEndpointSchema = z.object({
  path: z.string(),
  method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']),
  description: z.string(),
  requestBody: z.object({
    contentType: z.string(),
    schema: z.record(z.unknown()),
  }).optional(),
  responseBody: z.object({
    contentType: z.string(),
    schema: z.record(z.unknown()),
  }),
  authentication: z.boolean(),
  rateLimit: z.string().optional(),
});

export type APIEndpoint = z.infer<typeof APIEndpointSchema>;

/**
 * Data model definition
 */
export const DataModelSchema = z.object({
  name: z.string(),
  description: z.string(),
  fields: z.array(z.object({
    name: z.string(),
    type: z.string(),
    required: z.boolean(),
    description: z.string(),
    constraints: z.array(z.string()).optional(),
  })),
  relationships: z.array(z.object({
    target: z.string(),
    type: z.enum(['one-to-one', 'one-to-many', 'many-to-many']),
    description: z.string(),
  })),
  indexes: z.array(z.string()).optional(),
});

export type DataModel = z.infer<typeof DataModelSchema>;

/**
 * Directory structure
 */
export const DirectoryStructureSchema = z.object({
  path: z.string(),
  description: z.string(),
  children: z.array(z.lazy(() => DirectoryStructureSchema)).optional(),
});

export type DirectoryStructure = z.infer<typeof DirectoryStructureSchema>;

/**
 * Coding conventions
 */
export const CodingConventionsSchema = z.object({
  naming: z.object({
    files: z.string(),
    directories: z.string(),
    components: z.string(),
    functions: z.string(),
    variables: z.string(),
    constants: z.string(),
    types: z.string(),
  }),
  formatting: z.object({
    indentation: z.string(),
    lineLength: z.number(),
    quotes: z.enum(['single', 'double']),
    semicolons: z.boolean(),
  }),
  patterns: z.array(z.object({
    name: z.string(),
    description: z.string(),
    example: z.string(),
  })),
  antiPatterns: z.array(z.object({
    name: z.string(),
    description: z.string(),
    alternative: z.string(),
  })),
});

export type CodingConventions = z.infer<typeof CodingConventionsSchema>;

/**
 * Complete architect output
 */
export const ArchitectOutputSchema = z.object({
  techStack: TechStackSchema,
  adrs: z.array(ADRSchema),
  components: z.array(ComponentSchema),
  directoryStructure: DirectoryStructureSchema,
  apiEndpoints: z.array(APIEndpointSchema).optional(),
  dataModels: z.array(DataModelSchema).optional(),
  codingConventions: CodingConventionsSchema,
  securityConsiderations: z.array(z.string()),
  scalabilityNotes: z.array(z.string()),
  routingHints: z.object({
    suggestNext: z.array(z.nativeEnum(AgentType)),
    skipAgents: z.array(z.nativeEnum(AgentType)),
    needsApproval: z.boolean(),
    hasFailures: z.boolean(),
    isComplete: z.boolean(),
    notes: z.string().optional(),
  }),
});

export type ArchitectOutput = z.infer<typeof ArchitectOutputSchema>;
```

---

## 2. ADR Manager (`src/architecture/adr-manager.ts`)

```typescript
/**
 * ADR Manager
 *
 * Manages Architecture Decision Records.
 */

import { ADR } from '../agents/schemas/architect-output';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

/**
 * ADR Manager class
 */
export class ADRManager {
  private adrDir: string;

  constructor(projectRoot: string) {
    this.adrDir = path.join(projectRoot, 'docs', 'architecture', 'decisions');
  }

  /**
   * Initialize ADR directory
   */
  initialize(): void {
    if (!fs.existsSync(this.adrDir)) {
      fs.mkdirSync(this.adrDir, { recursive: true });
    }
  }

  /**
   * Create a new ADR
   */
  create(adr: Omit<ADR, 'id' | 'date'>): ADR {
    const id = this.generateId();
    const fullAdr: ADR = {
      ...adr,
      id,
      date: new Date().toISOString().split('T')[0],
    };

    return fullAdr;
  }

  /**
   * Generate ADR ID
   */
  private generateId(): string {
    const existingAdrs = this.list();
    const nextNumber = existingAdrs.length + 1;
    return `ADR-${String(nextNumber).padStart(4, '0')}`;
  }

  /**
   * Save ADR to file
   */
  save(adr: ADR): string {
    this.initialize();

    const filename = `${adr.id}-${this.slugify(adr.title)}.md`;
    const filepath = path.join(this.adrDir, filename);
    const content = this.renderMarkdown(adr);

    fs.writeFileSync(filepath, content, 'utf-8');
    return filepath;
  }

  /**
   * List all ADRs
   */
  list(): ADR[] {
    if (!fs.existsSync(this.adrDir)) {
      return [];
    }

    const files = fs.readdirSync(this.adrDir)
      .filter(f => f.endsWith('.md'))
      .sort();

    return files.map(f => this.parseADR(path.join(this.adrDir, f))).filter(Boolean) as ADR[];
  }

  /**
   * Get ADR by ID
   */
  get(id: string): ADR | null {
    const adrs = this.list();
    return adrs.find(a => a.id === id) || null;
  }

  /**
   * Update ADR status
   */
  updateStatus(id: string, status: ADR['status']): boolean {
    const adr = this.get(id);
    if (!adr) return false;

    adr.status = status;
    this.save(adr);
    return true;
  }

  /**
   * Render ADR as markdown
   */
  renderMarkdown(adr: ADR): string {
    const lines: string[] = [];

    lines.push(`# ${adr.id}: ${adr.title}`);
    lines.push('');
    lines.push(`**Status:** ${adr.status}`);
    lines.push(`**Date:** ${adr.date}`);
    lines.push('');

    lines.push('## Context');
    lines.push('');
    lines.push(adr.context);
    lines.push('');

    lines.push('## Decision');
    lines.push('');
    lines.push(adr.decision);
    lines.push('');

    lines.push('## Consequences');
    lines.push('');
    lines.push('### Positive');
    for (const p of adr.consequences.positive) {
      lines.push(`- ${p}`);
    }
    lines.push('');

    lines.push('### Negative');
    for (const n of adr.consequences.negative) {
      lines.push(`- ${n}`);
    }
    lines.push('');

    if (adr.consequences.risks.length > 0) {
      lines.push('### Risks');
      for (const r of adr.consequences.risks) {
        lines.push(`- ${r}`);
      }
      lines.push('');
    }

    if (adr.alternatives.length > 0) {
      lines.push('## Alternatives Considered');
      lines.push('');
      for (const alt of adr.alternatives) {
        lines.push(`### ${alt.option}`);
        lines.push('');
        lines.push('**Pros:**');
        for (const p of alt.pros) {
          lines.push(`- ${p}`);
        }
        lines.push('');
        lines.push('**Cons:**');
        for (const c of alt.cons) {
          lines.push(`- ${c}`);
        }
        lines.push('');
      }
    }

    if (adr.relatedADRs.length > 0) {
      lines.push('## Related ADRs');
      lines.push('');
      for (const related of adr.relatedADRs) {
        lines.push(`- ${related}`);
      }
    }

    return lines.join('\n');
  }

  /**
   * Parse ADR from markdown (simplified)
   */
  private parseADR(filepath: string): ADR | null {
    try {
      const content = fs.readFileSync(filepath, 'utf-8');
      const filename = path.basename(filepath);

      // Extract ID from filename
      const idMatch = filename.match(/^(ADR-\d+)/);
      if (!idMatch) return null;

      // Simple parsing - in production would use proper markdown parser
      const titleMatch = content.match(/^# (ADR-\d+): (.+)$/m);
      const statusMatch = content.match(/\*\*Status:\*\* (\w+)/);
      const dateMatch = content.match(/\*\*Date:\*\* ([\d-]+)/);

      return {
        id: idMatch[1],
        title: titleMatch?.[2] || 'Unknown',
        status: (statusMatch?.[1] || 'proposed') as ADR['status'],
        date: dateMatch?.[1] || '',
        context: '',
        decision: '',
        consequences: { positive: [], negative: [], risks: [] },
        alternatives: [],
        relatedADRs: [],
      };
    } catch {
      return null;
    }
  }

  /**
   * Slugify title for filename
   */
  private slugify(title: string): string {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }
}
```

---

## 3. Architect Agent (`src/agents/agents/architect.ts`)

```typescript
/**
 * Architect Agent
 *
 * Makes technical decisions and defines system architecture.
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
import { ArchitectOutput, ADR } from '../schemas/architect-output';
import { ADRManager } from '../../architecture/adr-manager';
import { logger } from '../../utils/logger';

/**
 * Architect Agent implementation
 */
export class ArchitectAgent extends BaseAgent {
  constructor() {
    super({
      id: AgentType.ARCHITECT,
      name: 'Architect',
      description: 'Makes technical decisions and designs system architecture',
      version: '1.0.0',
      capabilities: [
        {
          name: 'tech-stack-selection',
          description: 'Select appropriate technologies',
          inputTypes: ['requirements'],
          outputTypes: ['tech-stack'],
        },
        {
          name: 'architecture-design',
          description: 'Design system architecture',
          inputTypes: ['requirements'],
          outputTypes: ['architecture'],
        },
        {
          name: 'adr-creation',
          description: 'Create architecture decision records',
          inputTypes: ['decision'],
          outputTypes: ['adr'],
        },
      ],
      requiredContext: [
        { type: 'current_task', required: true },
        { type: 'project_config', required: false },
      ],
      outputSchema: 'architect-output',
    });
  }

  /**
   * Build system prompt
   */
  protected buildSystemPrompt(context: AgentContext): string {
    return `You are the Architect agent responsible for technical decisions and system design.

Your responsibilities:
1. Select appropriate technologies based on requirements
2. Design system architecture and component structure
3. Create Architecture Decision Records (ADRs) for significant decisions
4. Define API contracts and data models
5. Establish coding conventions and patterns
6. Consider security, scalability, and maintainability

When making technology choices:
- Consider the team's expertise (prefer mainstream technologies)
- Evaluate maintenance burden
- Consider community support and documentation
- Balance innovation with stability

For each significant decision, create an ADR with:
- Context: Why is this decision needed?
- Decision: What is being decided?
- Consequences: What are the positive, negative, and risks?
- Alternatives: What other options were considered?

Output must be valid JSON matching the ArchitectOutput schema.`;
  }

  /**
   * Build user prompt
   */
  protected buildUserPrompt(request: AgentRequest): string {
    const task = request.context.task;
    const projectConfig = request.context.items.find(i => i.type === 'project_config');
    const previousOutputs = request.context.previousOutputs;

    let prompt = `Design the architecture for this project:\n\n`;
    prompt += `REQUIREMENTS:\n${task.description || JSON.stringify(task)}\n\n`;

    if (projectConfig?.content) {
      prompt += `EXISTING PROJECT CONTEXT:\n${JSON.stringify(projectConfig.content, null, 2)}\n\n`;
    }

    // Include work breakdown if available
    const pmOutput = previousOutputs.find(o => o.agentId === AgentType.PROJECT_MANAGER);
    if (pmOutput) {
      prompt += `WORK BREAKDOWN:\n${JSON.stringify(pmOutput.result, null, 2)}\n\n`;
    }

    prompt += `Provide:
1. Complete tech stack with reasoning
2. ADRs for significant decisions
3. Component structure
4. Directory structure
5. API endpoints (if applicable)
6. Data models (if applicable)
7. Coding conventions`;

    return prompt;
  }

  /**
   * Parse LLM response
   */
  protected parseResponse(response: any): ArchitectOutput {
    const text = this.extractTextContent(response);
    return this.parseJSON<ArchitectOutput>(text);
  }

  /**
   * Process result
   */
  protected async processResult(
    parsed: ArchitectOutput,
    request: AgentRequest
  ): Promise<{ result: ArchitectOutput; artifacts: Artifact[] }> {
    const artifacts: Artifact[] = [];

    // Create tech stack artifact
    artifacts.push({
      id: this.generateArtifactId(),
      type: 'config_file',
      path: 'architecture/tech-stack.json',
      content: JSON.stringify(parsed.techStack, null, 2),
      metadata: { type: 'tech-stack' },
    });

    // Create ADR artifacts
    for (const adr of parsed.adrs) {
      artifacts.push({
        id: this.generateArtifactId(),
        type: 'documentation',
        path: `docs/architecture/decisions/${adr.id}.md`,
        content: this.renderADRMarkdown(adr),
        metadata: { type: 'adr', adrId: adr.id },
      });
    }

    // Create directory structure artifact
    artifacts.push({
      id: this.generateArtifactId(),
      type: 'documentation',
      path: 'architecture/directory-structure.md',
      content: this.renderDirectoryStructure(parsed.directoryStructure),
      metadata: { type: 'directory-structure' },
    });

    // Create coding conventions artifact
    artifacts.push({
      id: this.generateArtifactId(),
      type: 'documentation',
      path: 'docs/CONVENTIONS.md',
      content: this.renderConventions(parsed.codingConventions),
      metadata: { type: 'conventions' },
    });

    // Create API spec if present
    if (parsed.apiEndpoints && parsed.apiEndpoints.length > 0) {
      artifacts.push({
        id: this.generateArtifactId(),
        type: 'documentation',
        path: 'docs/api/endpoints.json',
        content: JSON.stringify(parsed.apiEndpoints, null, 2),
        metadata: { type: 'api-spec' },
      });
    }

    // Create data models if present
    if (parsed.dataModels && parsed.dataModels.length > 0) {
      artifacts.push({
        id: this.generateArtifactId(),
        type: 'documentation',
        path: 'docs/database/models.json',
        content: JSON.stringify(parsed.dataModels, null, 2),
        metadata: { type: 'data-models' },
      });
    }

    return { result: parsed, artifacts };
  }

  /**
   * Generate routing hints
   */
  protected generateRoutingHints(
    result: ArchitectOutput,
    artifacts: Artifact[],
    request: AgentRequest
  ): RoutingHints {
    const suggestNext: AgentType[] = [];

    // If there are frontend components, suggest UI designer
    const hasFrontend = result.components.some(c =>
      c.type === 'component' || c.location.includes('frontend')
    );
    if (hasFrontend) {
      suggestNext.push(AgentType.UI_DESIGNER);
    }

    // If there are security considerations, suggest compliance
    if (result.securityConsiderations.length > 0) {
      suggestNext.push(AgentType.COMPLIANCE_AGENT);
    }

    return {
      suggestNext,
      skipAgents: [],
      needsApproval: true, // Architecture should be approved
      hasFailures: false,
      isComplete: false,
      notes: `Created ${parsed.adrs.length} ADRs, defined ${result.components.length} components`,
    };
  }

  /**
   * Render ADR as markdown
   */
  private renderADRMarkdown(adr: ADR): string {
    const lines: string[] = [];

    lines.push(`# ${adr.id}: ${adr.title}`);
    lines.push('');
    lines.push(`**Status:** ${adr.status}`);
    lines.push(`**Date:** ${adr.date}`);
    lines.push('');
    lines.push('## Context');
    lines.push(adr.context);
    lines.push('');
    lines.push('## Decision');
    lines.push(adr.decision);
    lines.push('');
    lines.push('## Consequences');
    lines.push('');
    lines.push('### Positive');
    adr.consequences.positive.forEach(p => lines.push(`- ${p}`));
    lines.push('');
    lines.push('### Negative');
    adr.consequences.negative.forEach(n => lines.push(`- ${n}`));
    lines.push('');
    lines.push('### Risks');
    adr.consequences.risks.forEach(r => lines.push(`- ${r}`));

    return lines.join('\n');
  }

  /**
   * Render directory structure
   */
  private renderDirectoryStructure(structure: any, indent = 0): string {
    const prefix = '  '.repeat(indent);
    let result = `${prefix}${structure.path}/`;

    if (structure.description) {
      result += ` # ${structure.description}`;
    }
    result += '\n';

    if (structure.children) {
      for (const child of structure.children) {
        result += this.renderDirectoryStructure(child, indent + 1);
      }
    }

    return result;
  }

  /**
   * Render coding conventions
   */
  private renderConventions(conventions: any): string {
    const lines: string[] = [];

    lines.push('# Coding Conventions');
    lines.push('');
    lines.push('## Naming Conventions');
    lines.push('');
    lines.push(`- **Files:** ${conventions.naming.files}`);
    lines.push(`- **Directories:** ${conventions.naming.directories}`);
    lines.push(`- **Components:** ${conventions.naming.components}`);
    lines.push(`- **Functions:** ${conventions.naming.functions}`);
    lines.push(`- **Variables:** ${conventions.naming.variables}`);
    lines.push(`- **Constants:** ${conventions.naming.constants}`);
    lines.push(`- **Types:** ${conventions.naming.types}`);
    lines.push('');
    lines.push('## Formatting');
    lines.push('');
    lines.push(`- **Indentation:** ${conventions.formatting.indentation}`);
    lines.push(`- **Line Length:** ${conventions.formatting.lineLength}`);
    lines.push(`- **Quotes:** ${conventions.formatting.quotes}`);
    lines.push(`- **Semicolons:** ${conventions.formatting.semicolons ? 'Required' : 'None'}`);
    lines.push('');

    if (conventions.patterns.length > 0) {
      lines.push('## Patterns');
      lines.push('');
      for (const pattern of conventions.patterns) {
        lines.push(`### ${pattern.name}`);
        lines.push(pattern.description);
        lines.push('');
        lines.push('```');
        lines.push(pattern.example);
        lines.push('```');
        lines.push('');
      }
    }

    if (conventions.antiPatterns.length > 0) {
      lines.push('## Anti-Patterns (Avoid)');
      lines.push('');
      for (const anti of conventions.antiPatterns) {
        lines.push(`### ${anti.name}`);
        lines.push(anti.description);
        lines.push(`**Instead:** ${anti.alternative}`);
        lines.push('');
      }
    }

    return lines.join('\n');
  }
}
```

---

## Test Scenarios

```typescript
// tests/agents/architect.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { ArchitectAgent } from '../../src/agents/agents/architect';
import { ADRManager } from '../../src/architecture/adr-manager';
import fs from 'fs';
import path from 'path';
import os from 'os';

describe('ArchitectAgent', () => {
  let agent: ArchitectAgent;

  beforeEach(() => {
    agent = new ArchitectAgent();
  });

  it('should have correct metadata', () => {
    const metadata = agent.getMetadata();
    expect(metadata.id).toBe('architect');
    expect(metadata.capabilities).toHaveLength(3);
  });
});

describe('ADRManager', () => {
  let manager: ADRManager;
  let testDir: string;

  beforeEach(() => {
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'adr-test-'));
    manager = new ADRManager(testDir);
  });

  afterEach(() => {
    fs.rmSync(testDir, { recursive: true, force: true });
  });

  it('should create ADR with correct ID', () => {
    const adr = manager.create({
      title: 'Use React for frontend',
      status: 'proposed',
      context: 'Need a frontend framework',
      decision: 'Use React 18',
      consequences: {
        positive: ['Large ecosystem'],
        negative: ['Learning curve'],
        risks: ['Breaking changes'],
      },
      alternatives: [],
      relatedADRs: [],
    });

    expect(adr.id).toBe('ADR-0001');
    expect(adr.title).toBe('Use React for frontend');
  });

  it('should save and list ADRs', () => {
    const adr = manager.create({
      title: 'Test ADR',
      status: 'accepted',
      context: 'Test',
      decision: 'Test',
      consequences: { positive: [], negative: [], risks: [] },
      alternatives: [],
      relatedADRs: [],
    });

    manager.save(adr);

    const adrs = manager.list();
    expect(adrs.length).toBe(1);
  });
});
```

---

## Validation Checklist

```
□ Architect agent implemented
□ Output schema complete
□ ADR manager works
  □ Create ADRs
  □ Save to files
  □ List ADRs
  □ Update status
□ Tech stack output generated
□ Directory structure rendered
□ Coding conventions documented
□ All tests pass
```

---

## Next Step

Proceed to **05d-ANALYST-AGENT.md** to implement the analyst agent.
