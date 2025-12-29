# Step 13: Backend Developer Agent

> **Checkpoint:** CP3 - Build & Test
> **Previous Step:** 12-FRONTEND-DEVELOPER.md
> **Next Step:** 14-TESTER-AGENT.md

---

## Overview

The Backend Developer Agent implements server-side code using Test-Driven Development (TDD). It creates APIs, database schemas, services, and middleware with comprehensive test coverage.

**Tech-Stack Agnostic:** This agent accepts tech stack configuration as input, allowing it to generate code for any backend runtime (Node.js, Deno, Bun, Python, Go, Rust, etc.) with any framework and database.

Key responsibilities:
- Implement API endpoints (REST, GraphQL, tRPC, etc.)
- Design database schemas and migrations
- Create service layer with business logic
- Write tests FIRST (TDD approach)
- Handle authentication and authorization
- Implement input validation and error handling

---

## Deliverables

1. `src/agents/agents/backend-developer.ts` - Backend Developer agent
2. `src/agents/schemas/backend-output.ts` - Output schema
3. `src/agents/schemas/backend-tech-stack.ts` - Backend tech stack configuration
4. `src/agents/templates/backend-templates.ts` - Backend code templates

---

## 1. Backend Tech Stack Configuration (`src/agents/schemas/backend-tech-stack.ts`)

```typescript
/**
 * Backend Tech Stack Configuration Schema
 *
 * Defines the technology choices for backend development.
 * This configuration is provided by the user, planner, or architect agent.
 */

import { z } from 'zod';

/**
 * Runtime configuration
 */
export const RuntimeConfigSchema = z.object({
  name: z.enum(['node', 'deno', 'bun', 'python', 'go', 'rust', 'java', 'dotnet']),
  version: z.string().optional(),
});

/**
 * Backend framework configuration
 */
export const BackendFrameworkSchema = z.object({
  name: z.string(), // e.g., 'express', 'fastify', 'hono', 'koa', 'nestjs', 'fastapi', 'gin', 'axum'
  version: z.string().optional(),
  features: z.array(z.string()).optional(), // e.g., ['swagger', 'cors', 'helmet']
});

/**
 * API style configuration
 */
export const ApiStyleSchema = z.object({
  type: z.enum(['rest', 'graphql', 'trpc', 'grpc', 'websocket']),
  specification: z.enum(['openapi', 'graphql-schema', 'protobuf', 'none']).optional(),
  versioning: z.enum(['url', 'header', 'query', 'none']).optional(),
});

/**
 * Database configuration
 */
export const DatabaseConfigSchema = z.object({
  type: z.enum(['postgresql', 'mysql', 'sqlite', 'mongodb', 'redis', 'dynamodb', 'supabase', 'planetscale', 'none']),
  orm: z.enum([
    'prisma',
    'drizzle',
    'typeorm',
    'sequelize',
    'knex',
    'mongoose',
    'sqlalchemy',
    'gorm',
    'diesel',
    'raw',
    'none',
  ]).optional(),
  migrations: z.enum(['orm-managed', 'manual', 'none']).optional(),
});

/**
 * Authentication configuration
 */
export const AuthConfigSchema = z.object({
  strategy: z.enum([
    'jwt',
    'session',
    'oauth',
    'api-key',
    'basic',
    'passkey',
    'none',
  ]),
  provider: z.string().optional(), // e.g., 'passport', 'lucia', 'clerk', 'auth0', 'supabase-auth'
  mfa: z.boolean().optional(),
});

/**
 * Validation library configuration
 */
export const ValidationConfigSchema = z.object({
  library: z.enum(['zod', 'yup', 'joi', 'class-validator', 'valibot', 'typebox', 'native']),
});

/**
 * Testing configuration
 */
export const BackendTestingConfigSchema = z.object({
  framework: z.enum(['vitest', 'jest', 'mocha', 'pytest', 'go-test', 'cargo-test']),
  integration: z.enum(['supertest', 'httpx', 'none']).optional(),
  mocking: z.enum(['vitest', 'jest', 'sinon', 'unittest.mock', 'none']).optional(),
});

/**
 * Complete backend tech stack
 */
export const BackendTechStackSchema = z.object({
  runtime: RuntimeConfigSchema,
  language: z.object({
    name: z.enum(['typescript', 'javascript', 'python', 'go', 'rust', 'java', 'csharp']),
    strict: z.boolean().default(true),
  }),
  framework: BackendFrameworkSchema,
  apiStyle: ApiStyleSchema,
  database: DatabaseConfigSchema,
  auth: AuthConfigSchema.optional(),
  validation: ValidationConfigSchema,
  testing: BackendTestingConfigSchema,

  // Additional configurations
  caching: z.enum(['redis', 'memcached', 'in-memory', 'none']).optional(),
  messageQueue: z.enum(['rabbitmq', 'kafka', 'sqs', 'bullmq', 'none']).optional(),
  logging: z.enum(['pino', 'winston', 'bunyan', 'structlog', 'slog', 'native']).optional(),

  // Code conventions
  conventions: z.object({
    fileNaming: z.enum(['kebab-case', 'camelCase', 'snake_case', 'PascalCase']).default('kebab-case'),
    testFileSuffix: z.enum(['.test', '.spec', '_test']).default('.test'),
    routePrefix: z.string().default('/api'),
  }).optional(),
});

export type BackendTechStack = z.infer<typeof BackendTechStackSchema>;

/**
 * Default backend tech stack (used when no config provided)
 */
export const DEFAULT_BACKEND_TECH_STACK: BackendTechStack = {
  runtime: { name: 'node', version: '20' },
  language: { name: 'typescript', strict: true },
  framework: { name: 'express' },
  apiStyle: { type: 'rest', specification: 'openapi' },
  database: { type: 'postgresql', orm: 'prisma' },
  auth: { strategy: 'jwt' },
  validation: { library: 'zod' },
  testing: { framework: 'vitest', integration: 'supertest' },
};
```

---

## 2. Output Schema (`src/agents/schemas/backend-output.ts`)

```typescript
/**
 * Backend Developer Output Schema
 *
 * Defines the structured output for backend code generation.
 */

import { z } from 'zod';

/**
 * HTTP methods
 */
export const HttpMethodSchema = z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']);
export type HttpMethod = z.infer<typeof HttpMethodSchema>;

/**
 * API endpoint definition
 */
export const EndpointDefinitionSchema = z.object({
  path: z.string(),
  method: HttpMethodSchema,
  name: z.string(),
  description: z.string(),

  // Request
  requestBody: z.object({
    type: z.string(),
    schema: z.string(), // Zod schema code
    example: z.record(z.string(), z.unknown()),
  }).optional(),

  queryParams: z.array(z.object({
    name: z.string(),
    type: z.string(),
    required: z.boolean(),
    description: z.string(),
  })).optional(),

  pathParams: z.array(z.object({
    name: z.string(),
    type: z.string(),
    description: z.string(),
  })).optional(),

  // Response
  responses: z.array(z.object({
    status: z.number(),
    description: z.string(),
    schema: z.string().optional(),
    example: z.record(z.string(), z.unknown()).optional(),
  })),

  // Auth & middleware
  authentication: z.enum(['none', 'jwt', 'api_key', 'session']),
  authorization: z.array(z.string()).optional(), // Required roles/permissions
  rateLimit: z.object({
    requests: z.number(),
    window: z.string(), // e.g., "1m", "1h"
  }).optional(),

  // Implementation
  handlerCode: z.string(),
  middlewares: z.array(z.string()),
});

export type EndpointDefinition = z.infer<typeof EndpointDefinitionSchema>;

/**
 * Database model definition
 */
export const ModelDefinitionSchema = z.object({
  name: z.string(),
  tableName: z.string(),
  description: z.string(),

  fields: z.array(z.object({
    name: z.string(),
    type: z.string(), // SQL type
    tsType: z.string(), // TypeScript type
    nullable: z.boolean(),
    unique: z.boolean().optional(),
    primaryKey: z.boolean().optional(),
    defaultValue: z.string().optional(),
    references: z.object({
      table: z.string(),
      column: z.string(),
      onDelete: z.enum(['CASCADE', 'SET NULL', 'RESTRICT']).optional(),
    }).optional(),
  })),

  indexes: z.array(z.object({
    name: z.string(),
    columns: z.array(z.string()),
    unique: z.boolean(),
  })).optional(),

  // Generated code
  schemaCode: z.string(), // Prisma/Drizzle schema
  typeCode: z.string(), // TypeScript interface
  migrationCode: z.string().optional(),
});

export type ModelDefinition = z.infer<typeof ModelDefinitionSchema>;

/**
 * Service layer definition
 */
export const ServiceDefinitionSchema = z.object({
  name: z.string(),
  fileName: z.string(),
  description: z.string(),

  dependencies: z.array(z.object({
    name: z.string(),
    type: z.string(),
  })),

  methods: z.array(z.object({
    name: z.string(),
    description: z.string(),
    params: z.array(z.object({
      name: z.string(),
      type: z.string(),
    })),
    returnType: z.string(),
    async: z.boolean(),
    code: z.string(),
  })),

  // Complete service code
  code: z.string(),
});

export type ServiceDefinition = z.infer<typeof ServiceDefinitionSchema>;

/**
 * Middleware definition
 */
export const MiddlewareDefinitionSchema = z.object({
  name: z.string(),
  fileName: z.string(),
  description: z.string(),
  type: z.enum(['auth', 'validation', 'logging', 'rateLimit', 'cors', 'custom']),
  code: z.string(),
});

export type MiddlewareDefinition = z.infer<typeof MiddlewareDefinitionSchema>;

/**
 * Test file for backend code
 */
export const BackendTestFileSchema = z.object({
  fileName: z.string(),
  testType: z.enum(['unit', 'integration', 'e2e']),
  imports: z.array(z.object({
    module: z.string(),
    named: z.array(z.string()).optional(),
    default: z.string().optional(),
  })),
  setup: z.string().optional(),
  testCases: z.array(z.object({
    description: z.string(),
    category: z.string(), // e.g., "POST /api/users", "UserService.create"
    testCode: z.string(),
    assertions: z.array(z.string()),
  })),
  teardown: z.string().optional(),
});

export type BackendTestFile = z.infer<typeof BackendTestFileSchema>;

/**
 * Complete Backend Developer output
 */
export const BackendOutputSchema = z.object({
  featureId: z.string(),
  featureName: z.string(),
  generatedAt: z.string(),

  // API layer
  endpoints: z.array(EndpointDefinitionSchema),

  // Data layer
  models: z.array(ModelDefinitionSchema),

  // Business logic layer
  services: z.array(ServiceDefinitionSchema),

  // Middleware
  middlewares: z.array(MiddlewareDefinitionSchema),

  // Shared types
  types: z.array(z.object({
    name: z.string(),
    fileName: z.string(),
    code: z.string(),
  })),

  // Tests (TDD - written first!)
  tests: z.array(BackendTestFileSchema),

  // Configuration
  envVariables: z.array(z.object({
    name: z.string(),
    description: z.string(),
    required: z.boolean(),
    example: z.string(),
  })),

  // Summary
  summary: z.object({
    endpointsCreated: z.number(),
    modelsCreated: z.number(),
    servicesCreated: z.number(),
    testsWritten: z.number(),
    estimatedCoverage: z.number(),
  }),

  // Files to create
  files: z.array(z.object({
    path: z.string(),
    content: z.string(),
    type: z.enum(['route', 'model', 'service', 'middleware', 'test', 'type', 'migration', 'config']),
  })),
});

export type BackendOutput = z.infer<typeof BackendOutputSchema>;
```

---

## 3. Backend Developer Agent (`src/agents/agents/backend-developer.ts`)

```typescript
/**
 * Backend Developer Agent
 *
 * Implements backend code using Test-Driven Development.
 * Tech-stack agnostic: accepts configuration for any runtime/framework.
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
  BackendOutput,
  BackendOutputSchema,
  EndpointDefinition,
} from '../schemas/backend-output';
import {
  BackendTechStack,
  BackendTechStackSchema,
  DEFAULT_BACKEND_TECH_STACK,
} from '../schemas/backend-tech-stack';
import { logger } from '../../utils/logger';
import path from 'path';

/**
 * Agent metadata
 */
const BACKEND_DEV_METADATA: AgentMetadata = {
  id: AgentType.BACKEND_DEV,
  name: 'Backend Developer',
  description: 'Implements backend APIs and services using TDD (tech-stack agnostic)',
  version: '1.0.0',
  capabilities: [
    {
      name: 'api_creation',
      description: 'Create API endpoints (REST, GraphQL, tRPC, etc.)',
      inputTypes: ['requirements', 'api_spec', 'architecture', 'tech_stack'],
      outputTypes: ['routes', 'handlers', 'openapi'],
    },
    {
      name: 'database_design',
      description: 'Design database schemas and migrations',
      inputTypes: ['requirements', 'architecture', 'tech_stack'],
      outputTypes: ['models', 'migrations', 'types'],
    },
    {
      name: 'service_implementation',
      description: 'Implement business logic services',
      inputTypes: ['requirements', 'models', 'tech_stack'],
      outputTypes: ['services', 'utilities'],
    },
    {
      name: 'tdd_implementation',
      description: 'Write tests first, then implementation',
      inputTypes: ['requirements', 'tech_stack'],
      outputTypes: ['test_file', 'implementation'],
    },
  ],
  requiredContext: [
    { type: 'current_task', required: true },
    { type: 'tech_stack', required: false }, // If not provided, uses defaults
    { type: 'architecture_output', required: false },
    { type: 'database_schema', required: false },
  ],
  outputSchema: 'backend-output',
};

/**
 * Backend Developer Agent implementation
 */
@RegisterAgent
export class BackendDeveloperAgent extends BaseAgent {
  constructor() {
    super(BACKEND_DEV_METADATA);
  }

  /**
   * Get tech stack from context or use defaults
   */
  private getTechStack(context: AgentContext): BackendTechStack {
    const techStackItem = context.items.find(i => i.type === 'tech_stack');

    if (techStackItem?.content?.backend) {
      const parsed = BackendTechStackSchema.safeParse(techStackItem.content.backend);
      if (parsed.success) {
        return parsed.data;
      }
      this.log('warn', 'Invalid tech stack config, using defaults', { errors: parsed.error });
    }

    return DEFAULT_BACKEND_TECH_STACK;
  }

  /**
   * Build system prompt for backend development (tech-stack aware)
   */
  protected buildSystemPrompt(context: AgentContext): string {
    const techStack = this.getTechStack(context);
    const projectConfig = context.items.find(i => i.type === 'project_config');
    const dbConfig = context.items.find(i => i.type === 'database_config');

    // Build tech-stack specific guidance
    const runtimeGuidance = this.getRuntimeGuidance(techStack);
    const frameworkGuidance = this.getFrameworkGuidance(techStack);
    const databaseGuidance = this.getDatabaseGuidance(techStack);
    const testingGuidance = this.getTestingGuidance(techStack);

    let prompt = `You are an expert Backend Developer specializing in ${this.formatTechStack(techStack)}.
You follow Test-Driven Development (TDD) principles strictly.

## Your Development Process (TDD):
1. FIRST: Write failing tests that describe the expected behavior
2. THEN: Write minimal code to make tests pass
3. FINALLY: Refactor while keeping tests green

## Tech Stack Configuration:
${this.formatTechStackDetails(techStack)}

${runtimeGuidance}

${frameworkGuidance}

${databaseGuidance}

${testingGuidance}

## Code Quality Requirements:
- All endpoints must have tests (unit + integration)
- Input validation on all endpoints
- Proper error handling with consistent error format
- Authentication and authorization where needed
- Rate limiting for public endpoints
- Request logging and monitoring hooks
- No injection vulnerabilities (SQL, NoSQL, Command)

## Output Format:
You must output valid JSON with:
- endpoints: API endpoint definitions
- models: Database model definitions
- services: Business logic services
- middlewares: Custom middleware
- tests: Test files (WRITTEN FIRST)
- files: Complete file list with content

## API Design Guidelines:
${this.getApiStyleGuidance(techStack)}

## Security Requirements:
- Validate all input with ${techStack.validation.library}
- Sanitize user-provided data
- Use parameterized queries / prepared statements
- Implement rate limiting
- Hash passwords with bcrypt/argon2
- Use HTTPS in production
`;

    if (projectConfig) {
      prompt += `\n## Project Configuration:\n${JSON.stringify(projectConfig.content, null, 2)}\n`;
    }

    if (dbConfig) {
      prompt += `\n## Database Configuration:\n${JSON.stringify(dbConfig.content, null, 2)}\n`;
    }

    return prompt;
  }

  /**
   * Format tech stack for prompt header
   */
  private formatTechStack(ts: BackendTechStack): string {
    const parts = [ts.runtime.name, ts.framework.name];
    if (ts.language.name !== 'javascript') parts.push(ts.language.name);
    return parts.join(' with ');
  }

  /**
   * Format tech stack details
   */
  private formatTechStackDetails(ts: BackendTechStack): string {
    return `- Runtime: ${ts.runtime.name}${ts.runtime.version ? ` ${ts.runtime.version}` : ''}
- Language: ${ts.language.name}${ts.language.strict ? ' (strict mode)' : ''}
- Framework: ${ts.framework.name}${ts.framework.version ? ` ${ts.framework.version}` : ''}
- API Style: ${ts.apiStyle.type}${ts.apiStyle.specification ? ` (${ts.apiStyle.specification})` : ''}
- Database: ${ts.database.type}${ts.database.orm ? ` with ${ts.database.orm}` : ''}
- Auth: ${ts.auth?.strategy || 'none'}${ts.auth?.provider ? ` (${ts.auth.provider})` : ''}
- Validation: ${ts.validation.library}
- Testing: ${ts.testing.framework}${ts.testing.integration ? ` + ${ts.testing.integration}` : ''}
${ts.caching && ts.caching !== 'none' ? `- Caching: ${ts.caching}` : ''}
${ts.logging ? `- Logging: ${ts.logging}` : ''}`;
  }

  /**
   * Get runtime-specific guidance
   */
  private getRuntimeGuidance(ts: BackendTechStack): string {
    const guides: Record<string, string> = {
      node: `## Node.js Guidelines:
- Use ES modules (import/export)
- Handle async errors with try/catch
- Use environment variables for config
- Implement graceful shutdown`,

      deno: `## Deno Guidelines:
- Use URL imports or import maps
- Leverage built-in TypeScript support
- Use Deno.serve for HTTP
- Follow permission model (--allow-net, etc.)`,

      bun: `## Bun Guidelines:
- Leverage Bun's native APIs
- Use Bun.serve for HTTP server
- Take advantage of built-in SQLite
- Use Bun's test runner`,

      python: `## Python Guidelines:
- Use async/await for I/O operations
- Follow PEP 8 style guide
- Use type hints throughout
- Use virtual environments`,

      go: `## Go Guidelines:
- Follow effective Go patterns
- Use context for cancellation
- Handle errors explicitly
- Use go mod for dependencies`,

      rust: `## Rust Guidelines:
- Use async runtime (tokio/async-std)
- Handle errors with Result<T, E>
- Leverage the borrow checker
- Use cargo for dependencies`,
    };

    return guides[ts.runtime.name] || '';
  }

  /**
   * Get framework-specific guidance
   */
  private getFrameworkGuidance(ts: BackendTechStack): string {
    const guides: Record<string, string> = {
      express: `## Express.js Guidelines:
- Use Router for route grouping
- Apply middleware in correct order
- Use express.json() for body parsing
- Implement error handling middleware`,

      fastify: `## Fastify Guidelines:
- Use schema validation for routes
- Leverage plugins for modularity
- Use hooks for lifecycle events
- Enable request logging`,

      hono: `## Hono Guidelines:
- Use route groups for organization
- Leverage middleware chaining
- Use validator middleware
- Works across runtimes (Node, Deno, Bun, CF Workers)`,

      nestjs: `## NestJS Guidelines:
- Use decorators for routes (@Get, @Post, etc.)
- Implement DTOs for validation
- Use dependency injection
- Follow module structure`,

      fastapi: `## FastAPI Guidelines:
- Use Pydantic models for validation
- Leverage automatic OpenAPI docs
- Use dependency injection
- Implement async endpoints`,

      gin: `## Gin Guidelines:
- Use route groups for organization
- Implement middleware properly
- Use binding for validation
- Handle errors with c.JSON`,

      axum: `## Axum Guidelines:
- Use extractors for request data
- Implement tower middleware
- Handle errors with Result
- Use state for shared data`,
    };

    return guides[ts.framework.name] || '';
  }

  /**
   * Get database-specific guidance
   */
  private getDatabaseGuidance(ts: BackendTechStack): string {
    if (ts.database.type === 'none') {
      return '## No database configured';
    }

    let guide = `## Database Guidelines (${ts.database.type}):
- Proper indexing for queries
- Foreign key constraints where applicable
- Soft deletes where appropriate
- Audit timestamps (createdAt, updatedAt)`;

    const ormGuides: Record<string, string> = {
      prisma: `
- Use Prisma Client for queries
- Define schema in schema.prisma
- Use migrations for schema changes
- Leverage type-safe queries`,

      drizzle: `
- Define schema with drizzle-orm
- Use prepared statements
- Leverage type inference
- Use drizzle-kit for migrations`,

      typeorm: `
- Use decorators for entities
- Define relations explicitly
- Use migrations for schema changes
- Leverage QueryBuilder for complex queries`,

      mongoose: `
- Define schemas with validation
- Use virtuals for computed fields
- Implement middleware hooks
- Index frequently queried fields`,

      sqlalchemy: `
- Define models with declarative base
- Use sessions for transactions
- Implement migrations with Alembic
- Use query builder for complex queries`,
    };

    if (ts.database.orm && ormGuides[ts.database.orm]) {
      guide += ormGuides[ts.database.orm];
    }

    return guide;
  }

  /**
   * Get testing-specific guidance
   */
  private getTestingGuidance(ts: BackendTechStack): string {
    let guide = `## Testing Setup:
- Unit tests: ${ts.testing.framework}`;

    if (ts.testing.integration) {
      guide += `
- Integration tests: ${ts.testing.integration}`;
    }

    const frameworkGuides: Record<string, string> = {
      vitest: `
- Use describe/it/expect pattern
- Mock with vi.mock()
- Use beforeEach/afterEach for setup`,

      jest: `
- Use describe/it/expect pattern
- Mock with jest.mock()
- Use beforeEach/afterEach for setup`,

      pytest: `
- Use fixtures for setup
- Use pytest.mark for test categories
- Mock with unittest.mock or pytest-mock`,

      'go-test': `
- Use testing.T for test functions
- Use table-driven tests
- Mock with interfaces`,
    };

    if (frameworkGuides[ts.testing.framework]) {
      guide += frameworkGuides[ts.testing.framework];
    }

    return guide;
  }

  /**
   * Get API style-specific guidance
   */
  private getApiStyleGuidance(ts: BackendTechStack): string {
    const guides: Record<string, string> = {
      rest: `- RESTful resource naming (plural nouns)
- Consistent response format: { data, error, meta }
- Proper HTTP status codes
- Pagination for list endpoints
- Filtering and sorting support
- API versioning (${ts.apiStyle.versioning || 'url-based'})`,

      graphql: `- Define clear type definitions
- Use resolvers for each field
- Implement DataLoader for N+1
- Handle errors in resolver
- Use input types for mutations`,

      trpc: `- Define router procedures
- Use input validation with zod
- Leverage type inference
- Handle errors with TRPCError
- Use context for auth`,

      grpc: `- Define protobuf messages
- Implement service handlers
- Use streaming where appropriate
- Handle errors with status codes
- Generate client code`,
    };

    return guides[ts.apiStyle.type] || '';
  }

  /**
   * Build user prompt with requirements
   */
  protected buildUserPrompt(request: AgentRequest): string {
    const task = request.context.task;
    const previousOutputs = request.context.previousOutputs;

    let prompt = `## Feature Requirements:\n`;
    prompt += `Task Type: ${task.taskType}\n`;
    prompt += `Complexity: ${task.complexity}\n`;
    prompt += `Requires UI: ${task.requiresUI}\n\n`;

    // Include original task
    const taskContext = request.context.items.find(i => i.type === 'current_task');
    if (taskContext) {
      prompt += `## Original Request:\n${JSON.stringify(taskContext.content, null, 2)}\n\n`;
    }

    // Include architect output if available
    const architectOutput = previousOutputs.find(o => o.agentId === AgentType.ARCHITECT);
    if (architectOutput) {
      prompt += `## Architecture Specification:\n${JSON.stringify(architectOutput.result, null, 2)}\n\n`;
    }

    // Include frontend output if available (for API contract)
    const frontendOutput = previousOutputs.find(o => o.agentId === AgentType.FRONTEND_DEV);
    if (frontendOutput) {
      prompt += `## Frontend API Requirements:\n`;
      prompt += `The frontend expects these API endpoints based on the implemented UI.\n`;
      prompt += `${JSON.stringify((frontendOutput.result as any)?.apiClient, null, 2)}\n\n`;
    }

    prompt += `
## Instructions:
1. Design the database schema for required data
2. Write tests FIRST for each endpoint and service (TDD)
3. Implement API endpoints to pass all tests
4. Create services for business logic
5. Add proper validation and error handling
6. Include authentication/authorization as needed

Output valid JSON only.`;

    return prompt;
  }

  /**
   * Parse LLM response
   */
  protected parseResponse(response: any): BackendOutput {
    const text = this.extractTextContent(response);
    const parsed = this.parseJSON<BackendOutput>(text);

    const result = BackendOutputSchema.safeParse(parsed);
    if (!result.success) {
      this.log('warn', 'Output validation failed', { errors: result.error.errors });
      throw new Error(`Invalid output format: ${result.error.message}`);
    }

    return result.data;
  }

  /**
   * Process result and generate artifacts
   */
  protected async processResult(
    parsed: BackendOutput,
    request: AgentRequest
  ): Promise<{ result: BackendOutput; artifacts: Artifact[] }> {
    const artifacts: Artifact[] = [];
    const basePath = path.join(request.context.projectId, 'src');

    // Generate all files from the output
    for (const file of parsed.files) {
      artifacts.push({
        id: this.generateArtifactId(),
        type: this.getArtifactType(file.type),
        path: path.join(basePath, file.path),
        content: file.content,
        metadata: {
          fileType: file.type,
          feature: parsed.featureName,
        },
      });
    }

    // Generate OpenAPI spec
    const openApiSpec = this.generateOpenApiSpec(parsed);
    artifacts.push({
      id: this.generateArtifactId(),
      type: 'api_spec',
      path: path.join(request.context.projectId, 'docs', 'openapi.yaml'),
      content: openApiSpec,
      metadata: {
        endpointCount: parsed.endpoints.length,
      },
    });

    // Generate .env.example
    if (parsed.envVariables.length > 0) {
      const envExample = this.generateEnvExample(parsed.envVariables);
      artifacts.push({
        id: this.generateArtifactId(),
        type: 'config_file',
        path: path.join(request.context.projectId, '.env.example'),
        content: envExample,
        metadata: {
          variableCount: parsed.envVariables.length,
        },
      });
    }

    return { result: parsed, artifacts };
  }

  /**
   * Generate routing hints
   */
  protected generateRoutingHints(
    result: BackendOutput,
    artifacts: Artifact[],
    request: AgentRequest
  ): RoutingHints {
    const hasEndpoints = result.endpoints.length > 0;
    const hasTests = result.tests.length > 0;

    return {
      suggestNext: [AgentType.TESTER],
      skipAgents: [],
      needsApproval: false,
      hasFailures: !hasEndpoints || !hasTests,
      isComplete: false,
      notes: hasEndpoints
        ? `Created ${result.endpoints.length} endpoint(s) with ${result.summary.testsWritten} tests`
        : 'No endpoints generated',
    };
  }

  /**
   * Get artifact type from file type
   */
  private getArtifactType(fileType: string): string {
    const typeMap: Record<string, string> = {
      route: 'source_code',
      model: 'database_schema',
      service: 'source_code',
      middleware: 'source_code',
      test: 'test_file',
      type: 'source_code',
      migration: 'database_migration',
      config: 'config_file',
    };
    return typeMap[fileType] || 'source_code';
  }

  /**
   * Generate OpenAPI specification
   */
  private generateOpenApiSpec(output: BackendOutput): string {
    const paths: Record<string, any> = {};

    for (const endpoint of output.endpoints) {
      const pathKey = endpoint.path;
      if (!paths[pathKey]) {
        paths[pathKey] = {};
      }

      paths[pathKey][endpoint.method.toLowerCase()] = {
        summary: endpoint.name,
        description: endpoint.description,
        tags: [output.featureName],
        security: endpoint.authentication !== 'none'
          ? [{ [endpoint.authentication]: [] }]
          : undefined,
        requestBody: endpoint.requestBody ? {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: `#/components/schemas/${endpoint.requestBody.type}` },
              example: endpoint.requestBody.example,
            },
          },
        } : undefined,
        parameters: [
          ...(endpoint.pathParams || []).map(p => ({
            name: p.name,
            in: 'path',
            required: true,
            schema: { type: p.type },
            description: p.description,
          })),
          ...(endpoint.queryParams || []).map(p => ({
            name: p.name,
            in: 'query',
            required: p.required,
            schema: { type: p.type },
            description: p.description,
          })),
        ],
        responses: Object.fromEntries(
          endpoint.responses.map(r => [
            r.status.toString(),
            {
              description: r.description,
              content: r.schema ? {
                'application/json': {
                  schema: { $ref: `#/components/schemas/${r.schema}` },
                  example: r.example,
                },
              } : undefined,
            },
          ])
        ),
      };
    }

    const spec = {
      openapi: '3.0.3',
      info: {
        title: `${output.featureName} API`,
        version: '1.0.0',
        description: `API for ${output.featureName}`,
      },
      paths,
      components: {
        securitySchemes: {
          jwt: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
          },
          api_key: {
            type: 'apiKey',
            in: 'header',
            name: 'X-API-Key',
          },
        },
        schemas: {},
      },
    };

    return JSON.stringify(spec, null, 2);
  }

  /**
   * Generate .env.example file
   */
  private generateEnvExample(envVars: BackendOutput['envVariables']): string {
    let content = '# Environment Variables\n';
    content += '# Copy this file to .env and fill in the values\n\n';

    for (const envVar of envVars) {
      content += `# ${envVar.description}\n`;
      content += `# Required: ${envVar.required ? 'Yes' : 'No'}\n`;
      content += `${envVar.name}=${envVar.example}\n\n`;
    }

    return content;
  }
}
```

---

## 3. Backend Templates (`src/agents/templates/backend-templates.ts`)

```typescript
/**
 * Backend Code Templates
 *
 * Templates for generating backend code following best practices.
 */

/**
 * Express route file template
 */
export const ROUTE_FILE_TEMPLATE = `
import { Router } from 'express';
import { z } from 'zod';
import { validateBody, validateQuery } from '../middleware/validation';
import { authenticate } from '../middleware/auth';
import { {{serviceName}} } from '../services/{{serviceFileName}}';

const router = Router();

{{handlers}}

export default router;
`;

/**
 * Route handler template
 */
export const ROUTE_HANDLER_TEMPLATE = `
/**
 * {{description}}
 * {{method}} {{path}}
 */
router.{{methodLower}}(
  '{{path}}',
  {{middlewares}}
  async (req, res, next) => {
    try {
      {{implementation}}
    } catch (error) {
      next(error);
    }
  }
);
`;

/**
 * Service class template
 */
export const SERVICE_TEMPLATE = `
import { prisma } from '../lib/prisma';
{{imports}}

{{types}}

/**
 * {{description}}
 */
export class {{name}} {
  {{methods}}
}

export const {{instanceName}} = new {{name}}();
`;

/**
 * Service method template
 */
export const SERVICE_METHOD_TEMPLATE = `
  /**
   * {{description}}
   */
  {{async}}{{name}}({{params}}): {{returnType}} {
    {{implementation}}
  }
`;

/**
 * Prisma model template
 */
export const PRISMA_MODEL_TEMPLATE = `
model {{name}} {
  {{fields}}

  {{relations}}

  @@map("{{tableName}}")
  {{indexes}}
}
`;

/**
 * Database migration template
 */
export const MIGRATION_TEMPLATE = `
-- Migration: {{name}}
-- Created: {{timestamp}}

{{upSql}}

-- Rollback
-- {{downSql}}
`;

/**
 * Zod validation schema template
 */
export const VALIDATION_SCHEMA_TEMPLATE = `
import { z } from 'zod';

/**
 * {{description}}
 */
export const {{name}}Schema = z.object({
  {{fields}}
});

export type {{name}} = z.infer<typeof {{name}}Schema>;
`;

/**
 * Middleware template
 */
export const MIDDLEWARE_TEMPLATE = `
import { Request, Response, NextFunction } from 'express';
{{imports}}

/**
 * {{description}}
 */
export const {{name}} = {{async}}(
  req: Request,
  res: Response,
  next: NextFunction
){{returnType}} => {
  {{implementation}}
};
`;

/**
 * API error class template
 */
export const API_ERROR_TEMPLATE = `
export class ApiError extends Error {
  constructor(
    public statusCode: number,
    public message: string,
    public code?: string,
    public details?: unknown
  ) {
    super(message);
    this.name = 'ApiError';
  }

  static badRequest(message: string, details?: unknown) {
    return new ApiError(400, message, 'BAD_REQUEST', details);
  }

  static unauthorized(message = 'Unauthorized') {
    return new ApiError(401, message, 'UNAUTHORIZED');
  }

  static forbidden(message = 'Forbidden') {
    return new ApiError(403, message, 'FORBIDDEN');
  }

  static notFound(message = 'Not found') {
    return new ApiError(404, message, 'NOT_FOUND');
  }

  static conflict(message: string) {
    return new ApiError(409, message, 'CONFLICT');
  }

  static internal(message = 'Internal server error') {
    return new ApiError(500, message, 'INTERNAL_ERROR');
  }
}
`;

/**
 * Test file template for backend
 */
export const BACKEND_TEST_TEMPLATE = `
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../app';
import { prisma } from '../lib/prisma';
{{imports}}

describe('{{testSuite}}', () => {
  {{setup}}

  beforeAll(async () => {
    // Setup test database
    {{beforeAll}}
  });

  afterAll(async () => {
    // Cleanup
    {{afterAll}}
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    // Reset state between tests
    {{beforeEach}}
  });

  {{testCases}}
});
`;

/**
 * Integration test case template
 */
export const INTEGRATION_TEST_TEMPLATE = `
  describe('{{method}} {{path}}', () => {
    it('{{successCase}}', async () => {
      const response = await request(app)
        .{{methodLower}}('{{path}}')
        {{auth}}
        {{body}}
        .expect({{successStatus}});

      {{successAssertions}}
    });

    it('returns 400 for invalid input', async () => {
      const response = await request(app)
        .{{methodLower}}('{{path}}')
        {{auth}}
        .send({{invalidBody}})
        .expect(400);

      expect(response.body.error).toBeDefined();
    });

    {{authTest}}

    {{additionalTests}}
  });
`;

/**
 * Unit test case template
 */
export const UNIT_TEST_TEMPLATE = `
  describe('{{methodName}}', () => {
    it('{{successDescription}}', async () => {
      {{arrange}}

      {{act}}

      {{assert}}
    });

    it('throws error for invalid input', async () => {
      {{invalidArrange}}

      await expect({{invalidAct}}).rejects.toThrow({{expectedError}});
    });

    {{additionalTests}}
  });
`;

/**
 * Error handler middleware template
 */
export const ERROR_HANDLER_TEMPLATE = `
import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { ApiError } from '../utils/api-error';
import { logger } from '../utils/logger';

export const errorHandler = (
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  logger.error('Request error', {
    error: error.message,
    stack: error.stack,
    path: req.path,
    method: req.method,
  });

  if (error instanceof ApiError) {
    return res.status(error.statusCode).json({
      error: {
        message: error.message,
        code: error.code,
        details: error.details,
      },
    });
  }

  if (error instanceof ZodError) {
    return res.status(400).json({
      error: {
        message: 'Validation failed',
        code: 'VALIDATION_ERROR',
        details: error.errors,
      },
    });
  }

  // Don't expose internal errors in production
  const message = process.env.NODE_ENV === 'production'
    ? 'Internal server error'
    : error.message;

  return res.status(500).json({
    error: {
      message,
      code: 'INTERNAL_ERROR',
    },
  });
};
`;
```

---

## 4. Example Generated Backend Code

### Test File (Written FIRST)

```typescript
// src/api/users/__tests__/users.test.ts
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../../../app';
import { prisma } from '../../../lib/prisma';
import { generateToken } from '../../../utils/auth';
import { hashPassword } from '../../../utils/password';

describe('Users API', () => {
  let authToken: string;
  let testUserId: string;

  beforeAll(async () => {
    // Create a test user for authenticated requests
    const hashedPassword = await hashPassword('testpassword123');
    const testUser = await prisma.user.create({
      data: {
        email: 'test@example.com',
        password: hashedPassword,
        name: 'Test User',
      },
    });
    testUserId = testUser.id;
    authToken = generateToken({ userId: testUser.id });
  });

  afterAll(async () => {
    // Cleanup test data
    await prisma.user.deleteMany({
      where: { email: { contains: 'test' } },
    });
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    // Reset any modified state
  });

  describe('POST /api/users', () => {
    it('creates a new user with valid data', async () => {
      const userData = {
        email: 'newuser@example.com',
        password: 'securepassword123',
        name: 'New User',
      };

      const response = await request(app)
        .post('/api/users')
        .send(userData)
        .expect(201);

      expect(response.body.data).toMatchObject({
        email: userData.email,
        name: userData.name,
      });
      expect(response.body.data.password).toBeUndefined();
      expect(response.body.data.id).toBeDefined();
    });

    it('returns 400 for invalid email', async () => {
      const response = await request(app)
        .post('/api/users')
        .send({
          email: 'invalid-email',
          password: 'password123',
          name: 'Test',
        })
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('returns 400 for short password', async () => {
      const response = await request(app)
        .post('/api/users')
        .send({
          email: 'valid@example.com',
          password: '123',
          name: 'Test',
        })
        .expect(400);

      expect(response.body.error.details).toContainEqual(
        expect.objectContaining({
          path: ['password'],
        })
      );
    });

    it('returns 409 for duplicate email', async () => {
      await request(app)
        .post('/api/users')
        .send({
          email: 'duplicate@example.com',
          password: 'password123',
          name: 'First User',
        })
        .expect(201);

      const response = await request(app)
        .post('/api/users')
        .send({
          email: 'duplicate@example.com',
          password: 'password123',
          name: 'Second User',
        })
        .expect(409);

      expect(response.body.error.code).toBe('CONFLICT');
    });
  });

  describe('GET /api/users/:id', () => {
    it('returns user by id', async () => {
      const response = await request(app)
        .get(`/api/users/${testUserId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.data.id).toBe(testUserId);
      expect(response.body.data.email).toBe('test@example.com');
      expect(response.body.data.password).toBeUndefined();
    });

    it('returns 401 without authentication', async () => {
      await request(app)
        .get(`/api/users/${testUserId}`)
        .expect(401);
    });

    it('returns 404 for non-existent user', async () => {
      await request(app)
        .get('/api/users/non-existent-id')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });
  });

  describe('PATCH /api/users/:id', () => {
    it('updates user profile', async () => {
      const response = await request(app)
        .patch(`/api/users/${testUserId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Updated Name' })
        .expect(200);

      expect(response.body.data.name).toBe('Updated Name');
    });

    it('returns 403 when updating another user', async () => {
      const otherUser = await prisma.user.create({
        data: {
          email: 'other@example.com',
          password: await hashPassword('password'),
          name: 'Other',
        },
      });

      await request(app)
        .patch(`/api/users/${otherUser.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Hacked' })
        .expect(403);
    });

    it('validates update data', async () => {
      const response = await request(app)
        .patch(`/api/users/${testUserId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ email: 'invalid-email' })
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('DELETE /api/users/:id', () => {
    it('deletes own account', async () => {
      const userToDelete = await prisma.user.create({
        data: {
          email: 'todelete@example.com',
          password: await hashPassword('password'),
          name: 'To Delete',
        },
      });
      const token = generateToken({ userId: userToDelete.id });

      await request(app)
        .delete(`/api/users/${userToDelete.id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(204);

      const deleted = await prisma.user.findUnique({
        where: { id: userToDelete.id },
      });
      expect(deleted).toBeNull();
    });

    it('returns 403 when deleting another user', async () => {
      const otherUser = await prisma.user.create({
        data: {
          email: 'cannotdelete@example.com',
          password: await hashPassword('password'),
          name: 'Cannot Delete',
        },
      });

      await request(app)
        .delete(`/api/users/${otherUser.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(403);
    });
  });
});
```

### Route Implementation (Written to pass tests)

```typescript
// src/api/users/users.routes.ts
import { Router } from 'express';
import { z } from 'zod';
import { validateBody } from '../../middleware/validation';
import { authenticate, authorize } from '../../middleware/auth';
import { userService } from '../../services/user.service';
import { ApiError } from '../../utils/api-error';

const router = Router();

// Validation schemas
const createUserSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  name: z.string().min(1, 'Name is required'),
});

const updateUserSchema = z.object({
  email: z.string().email('Invalid email address').optional(),
  name: z.string().min(1).optional(),
}).refine(data => Object.keys(data).length > 0, {
  message: 'At least one field must be provided',
});

/**
 * Create a new user
 * POST /api/users
 */
router.post(
  '/',
  validateBody(createUserSchema),
  async (req, res, next) => {
    try {
      const user = await userService.create(req.body);
      res.status(201).json({ data: user });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Get user by ID
 * GET /api/users/:id
 */
router.get(
  '/:id',
  authenticate,
  async (req, res, next) => {
    try {
      const user = await userService.findById(req.params.id);

      if (!user) {
        throw ApiError.notFound('User not found');
      }

      res.json({ data: user });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Update user
 * PATCH /api/users/:id
 */
router.patch(
  '/:id',
  authenticate,
  authorize((req) => req.params.id === req.user!.id),
  validateBody(updateUserSchema),
  async (req, res, next) => {
    try {
      const user = await userService.update(req.params.id, req.body);
      res.json({ data: user });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Delete user
 * DELETE /api/users/:id
 */
router.delete(
  '/:id',
  authenticate,
  authorize((req) => req.params.id === req.user!.id),
  async (req, res, next) => {
    try {
      await userService.delete(req.params.id);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }
);

export default router;
```

### Service Implementation

```typescript
// src/services/user.service.ts
import { prisma } from '../lib/prisma';
import { hashPassword } from '../utils/password';
import { ApiError } from '../utils/api-error';

export interface CreateUserData {
  email: string;
  password: string;
  name: string;
}

export interface UpdateUserData {
  email?: string;
  name?: string;
}

export interface UserDTO {
  id: string;
  email: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}

class UserService {
  /**
   * Create a new user
   */
  async create(data: CreateUserData): Promise<UserDTO> {
    // Check for existing user
    const existing = await prisma.user.findUnique({
      where: { email: data.email },
    });

    if (existing) {
      throw ApiError.conflict('Email already registered');
    }

    // Hash password
    const hashedPassword = await hashPassword(data.password);

    // Create user
    const user = await prisma.user.create({
      data: {
        email: data.email,
        password: hashedPassword,
        name: data.name,
      },
      select: {
        id: true,
        email: true,
        name: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return user;
  }

  /**
   * Find user by ID
   */
  async findById(id: string): Promise<UserDTO | null> {
    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        name: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return user;
  }

  /**
   * Update user
   */
  async update(id: string, data: UpdateUserData): Promise<UserDTO> {
    const user = await prisma.user.update({
      where: { id },
      data,
      select: {
        id: true,
        email: true,
        name: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return user;
  }

  /**
   * Delete user
   */
  async delete(id: string): Promise<void> {
    await prisma.user.delete({
      where: { id },
    });
  }

  /**
   * Find user by email (for auth)
   */
  async findByEmail(email: string) {
    return prisma.user.findUnique({
      where: { email },
    });
  }
}

export const userService = new UserService();
```

---

## Validation Checklist

```
□ Output Schema
  □ Endpoint definition schema
  □ Model definition schema
  □ Service definition schema
  □ Test file schema
  □ Backend output schema

□ Backend Developer Agent
  □ Extends BaseAgent correctly
  □ Implements all abstract methods
  □ Registered with decorator
  □ Correct metadata and capabilities

□ TDD Implementation
  □ Tests written before implementation
  □ All endpoints have tests
  □ All services have unit tests
  □ Integration tests included

□ Generated Code Quality
  □ Valid TypeScript code
  □ Proper error handling
  □ Input validation
  □ Authentication/authorization
  □ Database operations

□ API Standards
  □ RESTful endpoints
  □ Consistent response format
  □ Proper HTTP status codes
  □ OpenAPI spec generated

□ Artifacts
  □ Route files generated
  □ Service files generated
  □ Model files generated
  □ Test files generated
  □ Migration files generated
  □ OpenAPI spec generated

□ All tests pass
  □ npm run test -- tests/agents/backend-developer
```

---

## Next Step

Proceed to **14-TESTER-AGENT.md** to implement the Tester Agent for running test suites and generating coverage reports.
