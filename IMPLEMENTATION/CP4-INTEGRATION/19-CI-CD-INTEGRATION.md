# Step 19: CI/CD Integration

> **Checkpoint:** CP4 - Integration
> **Previous Step:** 18-INTEGRATION-BRANCH.md
> **Next Step:** 20-RELEASE-WORKFLOW.md

---

## Overview

CI/CD Integration automates the build, test, and deployment pipeline using GitHub Actions. This ensures every change is validated before merging and provides automated deployment capabilities.

**Key responsibilities:**
- Generate GitHub Actions workflows
- Configure automated testing on PR/push
- Set up deployment pipelines
- Manage environment secrets
- Provide pipeline status to agents

---

## Deliverables

1. `src/agents/agents/cicd-agent.ts` - CI/CD configuration agent
2. `src/agents/schemas/cicd-config.ts` - CI/CD configuration schemas
3. `src/generators/github-actions.ts` - GitHub Actions workflow generator
4. `src/templates/workflows/` - Workflow templates

---

## 1. CI/CD Configuration Schema (`src/agents/schemas/cicd-config.ts`)

```typescript
/**
 * CI/CD Configuration Schema
 *
 * Defines types for CI/CD pipeline configuration.
 */

import { z } from 'zod';

/**
 * Trigger configuration
 */
export const TriggerConfigSchema = z.object({
  push: z.object({
    branches: z.array(z.string()),
    paths: z.array(z.string()).optional(),
    pathsIgnore: z.array(z.string()).optional(),
  }).optional(),
  pullRequest: z.object({
    branches: z.array(z.string()),
    types: z.array(z.enum(['opened', 'synchronize', 'reopened', 'closed'])).optional(),
  }).optional(),
  schedule: z.array(z.object({
    cron: z.string(),
  })).optional(),
  workflowDispatch: z.object({
    inputs: z.record(z.object({
      description: z.string(),
      required: z.boolean(),
      default: z.string().optional(),
      type: z.enum(['string', 'boolean', 'choice']).optional(),
      options: z.array(z.string()).optional(),
    })).optional(),
  }).optional(),
});

export type TriggerConfig = z.infer<typeof TriggerConfigSchema>;

/**
 * Environment configuration
 */
export const EnvironmentConfigSchema = z.object({
  name: z.string(),
  url: z.string().optional(),
  secrets: z.array(z.string()),
  variables: z.record(z.string()),
  protection: z.object({
    requiredReviewers: z.number().optional(),
    waitTimer: z.number().optional(), // minutes
  }).optional(),
});

export type EnvironmentConfig = z.infer<typeof EnvironmentConfigSchema>;

/**
 * Job step configuration
 */
export const StepConfigSchema = z.object({
  name: z.string(),
  id: z.string().optional(),
  uses: z.string().optional(), // Action reference
  run: z.string().optional(), // Shell command
  with: z.record(z.string()).optional(),
  env: z.record(z.string()).optional(),
  if: z.string().optional(),
  continueOnError: z.boolean().optional(),
  timeoutMinutes: z.number().optional(),
});

export type StepConfig = z.infer<typeof StepConfigSchema>;

/**
 * Job configuration
 */
export const JobConfigSchema = z.object({
  name: z.string(),
  runsOn: z.string().default('ubuntu-latest'),
  needs: z.array(z.string()).optional(),
  if: z.string().optional(),
  environment: z.string().optional(),
  concurrency: z.object({
    group: z.string(),
    cancelInProgress: z.boolean().optional(),
  }).optional(),
  permissions: z.record(z.enum(['read', 'write', 'none'])).optional(),
  steps: z.array(StepConfigSchema),
  outputs: z.record(z.string()).optional(),
  strategy: z.object({
    matrix: z.record(z.array(z.unknown())).optional(),
    failFast: z.boolean().optional(),
    maxParallel: z.number().optional(),
  }).optional(),
  services: z.record(z.object({
    image: z.string(),
    ports: z.array(z.string()).optional(),
    env: z.record(z.string()).optional(),
    options: z.string().optional(),
  })).optional(),
});

export type JobConfig = z.infer<typeof JobConfigSchema>;

/**
 * Complete workflow configuration
 */
export const WorkflowConfigSchema = z.object({
  name: z.string(),
  fileName: z.string(),
  on: TriggerConfigSchema,
  env: z.record(z.string()).optional(),
  concurrency: z.object({
    group: z.string(),
    cancelInProgress: z.boolean().optional(),
  }).optional(),
  permissions: z.record(z.enum(['read', 'write', 'none'])).optional(),
  jobs: z.record(JobConfigSchema),
});

export type WorkflowConfig = z.infer<typeof WorkflowConfigSchema>;

/**
 * Pipeline status
 */
export const PipelineStatusSchema = z.object({
  workflowName: z.string(),
  runId: z.number(),
  status: z.enum(['queued', 'in_progress', 'completed']),
  conclusion: z.enum(['success', 'failure', 'cancelled', 'skipped', 'timed_out']).optional(),
  startedAt: z.string(),
  completedAt: z.string().optional(),
  duration: z.number().optional(), // seconds
  branch: z.string(),
  commit: z.string(),
  actor: z.string(),
  jobs: z.array(z.object({
    name: z.string(),
    status: z.enum(['queued', 'in_progress', 'completed']),
    conclusion: z.enum(['success', 'failure', 'cancelled', 'skipped']).optional(),
    duration: z.number().optional(),
  })),
  artifacts: z.array(z.object({
    name: z.string(),
    sizeBytes: z.number(),
    downloadUrl: z.string(),
  })).optional(),
});

export type PipelineStatus = z.infer<typeof PipelineStatusSchema>;

/**
 * CI/CD configuration output
 */
export const CICDConfigOutputSchema = z.object({
  projectName: z.string(),
  generatedAt: z.string(),

  // Generated workflows
  workflows: z.array(WorkflowConfigSchema),

  // Environment configurations
  environments: z.array(EnvironmentConfigSchema),

  // Required secrets
  requiredSecrets: z.array(z.object({
    name: z.string(),
    description: z.string(),
    required: z.boolean(),
    example: z.string().optional(),
  })),

  // Generated files
  files: z.array(z.object({
    path: z.string(),
    content: z.string(),
  })),
});

export type CICDConfigOutput = z.infer<typeof CICDConfigOutputSchema>;
```

---

## 2. GitHub Actions Generator (`src/generators/github-actions.ts`)

```typescript
/**
 * GitHub Actions Workflow Generator
 *
 * Generates GitHub Actions workflow files from configuration.
 */

import {
  WorkflowConfig,
  JobConfig,
  StepConfig,
  TriggerConfig,
  CICDConfigOutput,
  EnvironmentConfig,
} from '../agents/schemas/cicd-config';
import { FrontendTechStack } from '../agents/schemas/tech-stack';
import { BackendTechStack } from '../agents/schemas/backend-tech-stack';
import YAML from 'yaml';

/**
 * Generator options
 */
export interface GeneratorOptions {
  projectName: string;
  frontendStack?: FrontendTechStack;
  backendStack?: BackendTechStack;
  deployTargets?: ('vercel' | 'netlify' | 'aws' | 'gcp' | 'azure' | 'docker')[];
  enableCodeQL?: boolean;
  enableDependabot?: boolean;
}

/**
 * GitHub Actions Generator
 */
export class GitHubActionsGenerator {
  private options: GeneratorOptions;

  constructor(options: GeneratorOptions) {
    this.options = options;
  }

  /**
   * Generate complete CI/CD configuration
   */
  generate(): CICDConfigOutput {
    const workflows: WorkflowConfig[] = [];
    const files: { path: string; content: string }[] = [];

    // Generate CI workflow
    const ciWorkflow = this.generateCIWorkflow();
    workflows.push(ciWorkflow);
    files.push({
      path: `.github/workflows/${ciWorkflow.fileName}`,
      content: this.toYAML(ciWorkflow),
    });

    // Generate CD workflow if deploy targets specified
    if (this.options.deployTargets?.length) {
      const cdWorkflow = this.generateCDWorkflow();
      workflows.push(cdWorkflow);
      files.push({
        path: `.github/workflows/${cdWorkflow.fileName}`,
        content: this.toYAML(cdWorkflow),
      });
    }

    // Generate CodeQL workflow if enabled
    if (this.options.enableCodeQL) {
      const codeqlWorkflow = this.generateCodeQLWorkflow();
      workflows.push(codeqlWorkflow);
      files.push({
        path: `.github/workflows/${codeqlWorkflow.fileName}`,
        content: this.toYAML(codeqlWorkflow),
      });
    }

    // Generate Dependabot config if enabled
    if (this.options.enableDependabot) {
      files.push({
        path: '.github/dependabot.yml',
        content: this.generateDependabotConfig(),
      });
    }

    return {
      projectName: this.options.projectName,
      generatedAt: new Date().toISOString(),
      workflows,
      environments: this.generateEnvironments(),
      requiredSecrets: this.getRequiredSecrets(),
      files,
    };
  }

  /**
   * Generate CI workflow
   */
  private generateCIWorkflow(): WorkflowConfig {
    const jobs: Record<string, JobConfig> = {};

    // Lint job
    jobs.lint = {
      name: 'Lint',
      runsOn: 'ubuntu-latest',
      steps: [
        this.checkoutStep(),
        this.setupNodeStep(),
        this.installDepsStep(),
        {
          name: 'Run ESLint',
          run: 'npm run lint',
        },
        {
          name: 'Run Prettier',
          run: 'npm run format:check',
        },
      ],
    };

    // Type check job
    if (this.usesTypeScript()) {
      jobs.typecheck = {
        name: 'Type Check',
        runsOn: 'ubuntu-latest',
        steps: [
          this.checkoutStep(),
          this.setupNodeStep(),
          this.installDepsStep(),
          {
            name: 'Run TypeScript',
            run: 'npm run typecheck',
          },
        ],
      };
    }

    // Test job
    jobs.test = {
      name: 'Test',
      runsOn: 'ubuntu-latest',
      needs: ['lint', ...(this.usesTypeScript() ? ['typecheck'] : [])],
      services: this.getTestServices(),
      steps: [
        this.checkoutStep(),
        this.setupNodeStep(),
        this.installDepsStep(),
        {
          name: 'Run Tests',
          run: 'npm run test:ci',
          env: this.getTestEnv(),
        },
        {
          name: 'Upload Coverage',
          uses: 'codecov/codecov-action@v4',
          with: {
            token: '${{ secrets.CODECOV_TOKEN }}',
            files: 'coverage/lcov.info',
            fail_ci_if_error: 'true',
          },
        },
      ],
    };

    // Build job
    jobs.build = {
      name: 'Build',
      runsOn: 'ubuntu-latest',
      needs: ['test'],
      steps: [
        this.checkoutStep(),
        this.setupNodeStep(),
        this.installDepsStep(),
        {
          name: 'Build',
          run: 'npm run build',
        },
        {
          name: 'Upload Build Artifacts',
          uses: 'actions/upload-artifact@v4',
          with: {
            name: 'build',
            path: this.getBuildOutputPath(),
            'retention-days': '7',
          },
        },
      ],
    };

    // E2E tests (if configured)
    if (this.hasE2ETests()) {
      jobs.e2e = {
        name: 'E2E Tests',
        runsOn: 'ubuntu-latest',
        needs: ['build'],
        steps: [
          this.checkoutStep(),
          this.setupNodeStep(),
          this.installDepsStep(),
          {
            name: 'Download Build',
            uses: 'actions/download-artifact@v4',
            with: {
              name: 'build',
              path: this.getBuildOutputPath(),
            },
          },
          {
            name: 'Install Playwright',
            run: 'npx playwright install --with-deps',
          },
          {
            name: 'Run E2E Tests',
            run: 'npm run test:e2e',
          },
          {
            name: 'Upload E2E Report',
            uses: 'actions/upload-artifact@v4',
            if: 'always()',
            with: {
              name: 'playwright-report',
              path: 'playwright-report/',
              'retention-days': '7',
            },
          },
        ],
      };
    }

    return {
      name: 'CI',
      fileName: 'ci.yml',
      on: {
        push: {
          branches: ['main', 'develop'],
        },
        pullRequest: {
          branches: ['main', 'develop'],
        },
      },
      concurrency: {
        group: 'ci-${{ github.ref }}',
        cancelInProgress: true,
      },
      jobs,
    };
  }

  /**
   * Generate CD workflow
   */
  private generateCDWorkflow(): WorkflowConfig {
    const jobs: Record<string, JobConfig> = {};
    const targets = this.options.deployTargets || [];

    // Deploy to staging on develop branch
    if (targets.includes('vercel')) {
      jobs.deployStaging = this.generateVercelDeployJob('staging', 'develop');
      jobs.deployProduction = this.generateVercelDeployJob('production', 'main');
    } else if (targets.includes('netlify')) {
      jobs.deployStaging = this.generateNetlifyDeployJob('staging', 'develop');
      jobs.deployProduction = this.generateNetlifyDeployJob('production', 'main');
    } else if (targets.includes('docker')) {
      jobs.buildAndPush = this.generateDockerBuildJob();
      jobs.deploy = this.generateDockerDeployJob();
    }

    return {
      name: 'CD',
      fileName: 'cd.yml',
      on: {
        push: {
          branches: ['main', 'develop'],
        },
        workflowDispatch: {
          inputs: {
            environment: {
              description: 'Deployment environment',
              required: true,
              type: 'choice',
              options: ['staging', 'production'],
            },
          },
        },
      },
      jobs,
    };
  }

  /**
   * Generate Vercel deploy job
   */
  private generateVercelDeployJob(env: string, branch: string): JobConfig {
    return {
      name: `Deploy to ${env}`,
      runsOn: 'ubuntu-latest',
      if: `github.ref == 'refs/heads/${branch}'`,
      environment: env,
      steps: [
        this.checkoutStep(),
        {
          name: 'Deploy to Vercel',
          uses: 'amondnet/vercel-action@v25',
          with: {
            'vercel-token': '${{ secrets.VERCEL_TOKEN }}',
            'vercel-org-id': '${{ secrets.VERCEL_ORG_ID }}',
            'vercel-project-id': '${{ secrets.VERCEL_PROJECT_ID }}',
            'vercel-args': env === 'production' ? '--prod' : '',
          },
        },
      ],
    };
  }

  /**
   * Generate Netlify deploy job
   */
  private generateNetlifyDeployJob(env: string, branch: string): JobConfig {
    return {
      name: `Deploy to ${env}`,
      runsOn: 'ubuntu-latest',
      if: `github.ref == 'refs/heads/${branch}'`,
      environment: env,
      steps: [
        this.checkoutStep(),
        this.setupNodeStep(),
        this.installDepsStep(),
        {
          name: 'Build',
          run: 'npm run build',
        },
        {
          name: 'Deploy to Netlify',
          uses: 'nwtgck/actions-netlify@v3',
          with: {
            'publish-dir': this.getBuildOutputPath(),
            'production-branch': 'main',
            'github-token': '${{ secrets.GITHUB_TOKEN }}',
            'deploy-message': 'Deploy from GitHub Actions',
            'enable-pull-request-comment': 'true',
            'enable-commit-comment': 'true',
          },
          env: {
            NETLIFY_AUTH_TOKEN: '${{ secrets.NETLIFY_AUTH_TOKEN }}',
            NETLIFY_SITE_ID: '${{ secrets.NETLIFY_SITE_ID }}',
          },
        },
      ],
    };
  }

  /**
   * Generate Docker build job
   */
  private generateDockerBuildJob(): JobConfig {
    return {
      name: 'Build and Push Docker Image',
      runsOn: 'ubuntu-latest',
      permissions: {
        contents: 'read',
        packages: 'write',
      },
      steps: [
        this.checkoutStep(),
        {
          name: 'Set up Docker Buildx',
          uses: 'docker/setup-buildx-action@v3',
        },
        {
          name: 'Login to Container Registry',
          uses: 'docker/login-action@v3',
          with: {
            registry: 'ghcr.io',
            username: '${{ github.actor }}',
            password: '${{ secrets.GITHUB_TOKEN }}',
          },
        },
        {
          name: 'Extract metadata',
          id: 'meta',
          uses: 'docker/metadata-action@v5',
          with: {
            images: 'ghcr.io/${{ github.repository }}',
            tags: [
              'type=ref,event=branch',
              'type=ref,event=pr',
              'type=sha,prefix=',
            ].join('\n'),
          },
        },
        {
          name: 'Build and push',
          uses: 'docker/build-push-action@v5',
          with: {
            context: '.',
            push: 'true',
            tags: '${{ steps.meta.outputs.tags }}',
            labels: '${{ steps.meta.outputs.labels }}',
            cache_from: 'type=gha',
            cache_to: 'type=gha,mode=max',
          },
        },
      ],
      outputs: {
        image: '${{ steps.meta.outputs.tags }}',
      },
    };
  }

  /**
   * Generate Docker deploy job
   */
  private generateDockerDeployJob(): JobConfig {
    return {
      name: 'Deploy',
      runsOn: 'ubuntu-latest',
      needs: ['buildAndPush'],
      environment: 'production',
      steps: [
        {
          name: 'Deploy to server',
          uses: 'appleboy/ssh-action@v1',
          with: {
            host: '${{ secrets.DEPLOY_HOST }}',
            username: '${{ secrets.DEPLOY_USER }}',
            key: '${{ secrets.DEPLOY_KEY }}',
            script: [
              'docker pull ${{ needs.buildAndPush.outputs.image }}',
              'docker stop app || true',
              'docker rm app || true',
              'docker run -d --name app -p 3000:3000 ${{ needs.buildAndPush.outputs.image }}',
            ].join('\n'),
          },
        },
      ],
    };
  }

  /**
   * Generate CodeQL workflow
   */
  private generateCodeQLWorkflow(): WorkflowConfig {
    return {
      name: 'CodeQL',
      fileName: 'codeql.yml',
      on: {
        push: {
          branches: ['main', 'develop'],
        },
        pullRequest: {
          branches: ['main', 'develop'],
        },
        schedule: [{ cron: '0 0 * * 0' }], // Weekly on Sunday
      },
      permissions: {
        actions: 'read',
        contents: 'read',
        'security-events': 'write',
      },
      jobs: {
        analyze: {
          name: 'Analyze',
          runsOn: 'ubuntu-latest',
          strategy: {
            failFast: false,
            matrix: {
              language: [this.getCodeQLLanguage()],
            },
          },
          steps: [
            this.checkoutStep(),
            {
              name: 'Initialize CodeQL',
              uses: 'github/codeql-action/init@v3',
              with: {
                languages: '${{ matrix.language }}',
              },
            },
            {
              name: 'Autobuild',
              uses: 'github/codeql-action/autobuild@v3',
            },
            {
              name: 'Perform CodeQL Analysis',
              uses: 'github/codeql-action/analyze@v3',
            },
          ],
        },
      },
    };
  }

  /**
   * Generate Dependabot configuration
   */
  private generateDependabotConfig(): string {
    const config = {
      version: 2,
      updates: [
        {
          'package-ecosystem': 'npm',
          directory: '/',
          schedule: {
            interval: 'weekly',
          },
          'open-pull-requests-limit': 10,
          labels: ['dependencies'],
          groups: {
            'minor-and-patch': {
              'update-types': ['minor', 'patch'],
            },
          },
        },
        {
          'package-ecosystem': 'github-actions',
          directory: '/',
          schedule: {
            interval: 'weekly',
          },
          labels: ['dependencies', 'github-actions'],
        },
      ],
    };

    return YAML.stringify(config);
  }

  /**
   * Generate environment configurations
   */
  private generateEnvironments(): EnvironmentConfig[] {
    const environments: EnvironmentConfig[] = [
      {
        name: 'staging',
        secrets: ['DATABASE_URL', 'API_KEY'],
        variables: {
          NODE_ENV: 'staging',
          LOG_LEVEL: 'debug',
        },
      },
      {
        name: 'production',
        secrets: ['DATABASE_URL', 'API_KEY'],
        variables: {
          NODE_ENV: 'production',
          LOG_LEVEL: 'info',
        },
        protection: {
          requiredReviewers: 1,
        },
      },
    ];

    return environments;
  }

  /**
   * Get required secrets
   */
  private getRequiredSecrets(): CICDConfigOutput['requiredSecrets'] {
    const secrets: CICDConfigOutput['requiredSecrets'] = [
      {
        name: 'CODECOV_TOKEN',
        description: 'Codecov upload token',
        required: false,
      },
    ];

    if (this.options.deployTargets?.includes('vercel')) {
      secrets.push(
        { name: 'VERCEL_TOKEN', description: 'Vercel API token', required: true },
        { name: 'VERCEL_ORG_ID', description: 'Vercel organization ID', required: true },
        { name: 'VERCEL_PROJECT_ID', description: 'Vercel project ID', required: true }
      );
    }

    if (this.options.deployTargets?.includes('netlify')) {
      secrets.push(
        { name: 'NETLIFY_AUTH_TOKEN', description: 'Netlify auth token', required: true },
        { name: 'NETLIFY_SITE_ID', description: 'Netlify site ID', required: true }
      );
    }

    if (this.options.deployTargets?.includes('docker')) {
      secrets.push(
        { name: 'DEPLOY_HOST', description: 'Deployment server host', required: true },
        { name: 'DEPLOY_USER', description: 'Deployment server user', required: true },
        { name: 'DEPLOY_KEY', description: 'SSH private key for deployment', required: true }
      );
    }

    return secrets;
  }

  // Helper methods

  private checkoutStep(): StepConfig {
    return {
      name: 'Checkout',
      uses: 'actions/checkout@v4',
    };
  }

  private setupNodeStep(): StepConfig {
    return {
      name: 'Setup Node.js',
      uses: 'actions/setup-node@v4',
      with: {
        'node-version': '20',
        cache: 'npm',
      },
    };
  }

  private installDepsStep(): StepConfig {
    return {
      name: 'Install Dependencies',
      run: 'npm ci',
    };
  }

  private usesTypeScript(): boolean {
    return (
      this.options.frontendStack?.language.name === 'typescript' ||
      this.options.backendStack?.language.name === 'typescript'
    );
  }

  private hasE2ETests(): boolean {
    return !!this.options.frontendStack?.testing.e2eFramework;
  }

  private getBuildOutputPath(): string {
    const framework = this.options.frontendStack?.framework.name;
    const variant = this.options.frontendStack?.framework.variant;

    if (variant === 'next') return '.next';
    if (variant === 'nuxt') return '.nuxt';
    if (framework === 'vue' || framework === 'react') return 'dist';

    return 'build';
  }

  private getTestServices(): JobConfig['services'] {
    const dbType = this.options.backendStack?.database.type;

    if (dbType === 'postgresql') {
      return {
        postgres: {
          image: 'postgres:15',
          ports: ['5432:5432'],
          env: {
            POSTGRES_USER: 'test',
            POSTGRES_PASSWORD: 'test',
            POSTGRES_DB: 'test',
          },
          options: '--health-cmd pg_isready --health-interval 10s --health-timeout 5s --health-retries 5',
        },
      };
    }

    if (dbType === 'mysql') {
      return {
        mysql: {
          image: 'mysql:8',
          ports: ['3306:3306'],
          env: {
            MYSQL_ROOT_PASSWORD: 'test',
            MYSQL_DATABASE: 'test',
          },
        },
      };
    }

    return undefined;
  }

  private getTestEnv(): Record<string, string> {
    const env: Record<string, string> = {
      CI: 'true',
    };

    const dbType = this.options.backendStack?.database.type;
    if (dbType === 'postgresql') {
      env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
    } else if (dbType === 'mysql') {
      env.DATABASE_URL = 'mysql://root:test@localhost:3306/test';
    }

    return env;
  }

  private getCodeQLLanguage(): string {
    if (this.usesTypeScript() || this.options.backendStack?.language.name === 'javascript') {
      return 'javascript-typescript';
    }
    if (this.options.backendStack?.language.name === 'python') {
      return 'python';
    }
    if (this.options.backendStack?.language.name === 'go') {
      return 'go';
    }
    return 'javascript-typescript';
  }

  private toYAML(workflow: WorkflowConfig): string {
    const { fileName, ...rest } = workflow;

    // Convert to YAML-compatible format
    const yamlObj = {
      name: rest.name,
      on: rest.on,
      ...(rest.env && { env: rest.env }),
      ...(rest.concurrency && { concurrency: rest.concurrency }),
      ...(rest.permissions && { permissions: rest.permissions }),
      jobs: Object.fromEntries(
        Object.entries(rest.jobs).map(([key, job]) => [
          key,
          {
            name: job.name,
            'runs-on': job.runsOn,
            ...(job.needs && { needs: job.needs }),
            ...(job.if && { if: job.if }),
            ...(job.environment && { environment: job.environment }),
            ...(job.concurrency && { concurrency: job.concurrency }),
            ...(job.permissions && { permissions: job.permissions }),
            ...(job.strategy && { strategy: job.strategy }),
            ...(job.services && { services: job.services }),
            ...(job.outputs && { outputs: job.outputs }),
            steps: job.steps.map(step => ({
              name: step.name,
              ...(step.id && { id: step.id }),
              ...(step.uses && { uses: step.uses }),
              ...(step.run && { run: step.run }),
              ...(step.with && { with: step.with }),
              ...(step.env && { env: step.env }),
              ...(step.if && { if: step.if }),
              ...(step.continueOnError && { 'continue-on-error': step.continueOnError }),
              ...(step.timeoutMinutes && { 'timeout-minutes': step.timeoutMinutes }),
            })),
          },
        ])
      ),
    };

    return YAML.stringify(yamlObj);
  }
}
```

---

## 3. CI/CD Agent (`src/agents/agents/cicd-agent.ts`)

```typescript
/**
 * CI/CD Agent
 *
 * Manages CI/CD configuration and monitors pipeline status.
 */

import { BaseAgent } from '../base-agent';
import { RegisterAgent } from '../registry';
import {
  AgentMetadata,
  AgentContext,
  AgentRequest,
  Artifact,
  AgentType,
} from '../types';
import {
  CICDConfigOutput,
  CICDConfigOutputSchema,
  PipelineStatus,
  WorkflowConfig,
} from '../schemas/cicd-config';
import { GitHubActionsGenerator, GeneratorOptions } from '../../generators/github-actions';
import { Octokit } from '@octokit/rest';
import { logger } from '../../utils/logger';

/**
 * Agent metadata
 */
const CICD_AGENT_METADATA: AgentMetadata = {
  id: AgentType.CICD,
  name: 'CI/CD Agent',
  description: 'Manages CI/CD configuration and pipeline status',
  version: '1.0.0',
  capabilities: [
    {
      name: 'generate_workflows',
      description: 'Generate GitHub Actions workflows',
      inputTypes: ['tech_stack', 'deploy_config'],
      outputTypes: ['workflow_files'],
    },
    {
      name: 'monitor_pipeline',
      description: 'Monitor pipeline execution status',
      inputTypes: ['workflow_run_id'],
      outputTypes: ['pipeline_status'],
    },
    {
      name: 'trigger_workflow',
      description: 'Manually trigger a workflow',
      inputTypes: ['workflow_name', 'inputs'],
      outputTypes: ['run_id'],
    },
  ],
  requiredContext: [
    { type: 'tech_stack', required: false },
    { type: 'github_config', required: false },
  ],
  outputSchema: 'cicd-config-output',
};

/**
 * CI/CD Agent implementation
 */
@RegisterAgent
export class CICDAgent extends BaseAgent {
  private octokit: Octokit | null = null;

  constructor() {
    super(CICD_AGENT_METADATA);
  }

  /**
   * Initialize GitHub client
   */
  private initGitHub(token?: string): Octokit {
    if (!this.octokit && token) {
      this.octokit = new Octokit({ auth: token });
    }
    if (!this.octokit) {
      throw new Error('GitHub token required for API operations');
    }
    return this.octokit;
  }

  /**
   * Generate CI/CD configuration
   */
  async generateConfig(options: GeneratorOptions): Promise<CICDConfigOutput> {
    this.log('info', 'Generating CI/CD configuration', {
      project: options.projectName,
      deployTargets: options.deployTargets,
    });

    const generator = new GitHubActionsGenerator(options);
    const config = generator.generate();

    this.log('info', 'CI/CD configuration generated', {
      workflows: config.workflows.length,
      files: config.files.length,
    });

    return config;
  }

  /**
   * Write generated files to disk
   */
  async writeConfig(config: CICDConfigOutput, basePath: string): Promise<void> {
    const fs = await import('fs/promises');
    const path = await import('path');

    for (const file of config.files) {
      const fullPath = path.join(basePath, file.path);
      const dir = path.dirname(fullPath);

      // Ensure directory exists
      await fs.mkdir(dir, { recursive: true });

      // Write file
      await fs.writeFile(fullPath, file.content, 'utf-8');

      this.log('info', 'Wrote CI/CD file', { path: file.path });
    }
  }

  /**
   * Get pipeline status
   */
  async getPipelineStatus(
    owner: string,
    repo: string,
    runId: number,
    token: string
  ): Promise<PipelineStatus> {
    const octokit = this.initGitHub(token);

    const { data: run } = await octokit.actions.getWorkflowRun({
      owner,
      repo,
      run_id: runId,
    });

    const { data: jobs } = await octokit.actions.listJobsForWorkflowRun({
      owner,
      repo,
      run_id: runId,
    });

    return {
      workflowName: run.name || 'Unknown',
      runId: run.id,
      status: run.status as PipelineStatus['status'],
      conclusion: run.conclusion as PipelineStatus['conclusion'],
      startedAt: run.created_at,
      completedAt: run.updated_at,
      duration: run.run_started_at
        ? Math.floor((new Date(run.updated_at).getTime() -
            new Date(run.run_started_at).getTime()) / 1000)
        : undefined,
      branch: run.head_branch || 'unknown',
      commit: run.head_sha,
      actor: run.actor?.login || 'unknown',
      jobs: jobs.jobs.map(job => ({
        name: job.name,
        status: job.status as 'queued' | 'in_progress' | 'completed',
        conclusion: job.conclusion as any,
        duration: job.started_at && job.completed_at
          ? Math.floor((new Date(job.completed_at).getTime() -
              new Date(job.started_at).getTime()) / 1000)
          : undefined,
      })),
    };
  }

  /**
   * Get latest pipeline status for a branch
   */
  async getLatestPipelineStatus(
    owner: string,
    repo: string,
    branch: string,
    workflowName: string,
    token: string
  ): Promise<PipelineStatus | null> {
    const octokit = this.initGitHub(token);

    // Get workflow ID by name
    const { data: workflows } = await octokit.actions.listRepoWorkflows({
      owner,
      repo,
    });

    const workflow = workflows.workflows.find(w => w.name === workflowName);
    if (!workflow) {
      return null;
    }

    // Get latest run
    const { data: runs } = await octokit.actions.listWorkflowRuns({
      owner,
      repo,
      workflow_id: workflow.id,
      branch,
      per_page: 1,
    });

    if (runs.workflow_runs.length === 0) {
      return null;
    }

    return this.getPipelineStatus(owner, repo, runs.workflow_runs[0].id, token);
  }

  /**
   * Trigger a workflow manually
   */
  async triggerWorkflow(
    owner: string,
    repo: string,
    workflowId: string,
    ref: string,
    inputs: Record<string, string>,
    token: string
  ): Promise<number> {
    const octokit = this.initGitHub(token);

    await octokit.actions.createWorkflowDispatch({
      owner,
      repo,
      workflow_id: workflowId,
      ref,
      inputs,
    });

    // Wait briefly and get the run ID
    await new Promise(r => setTimeout(r, 2000));

    const { data: runs } = await octokit.actions.listWorkflowRuns({
      owner,
      repo,
      workflow_id: workflowId,
      branch: ref,
      per_page: 1,
    });

    return runs.workflow_runs[0]?.id || 0;
  }

  /**
   * Wait for pipeline completion
   */
  async waitForCompletion(
    owner: string,
    repo: string,
    runId: number,
    token: string,
    timeoutMs = 600000 // 10 minutes
  ): Promise<PipelineStatus> {
    const startTime = Date.now();
    const pollInterval = 10000; // 10 seconds

    while (Date.now() - startTime < timeoutMs) {
      const status = await this.getPipelineStatus(owner, repo, runId, token);

      if (status.status === 'completed') {
        return status;
      }

      this.log('info', 'Waiting for pipeline completion', {
        runId,
        status: status.status,
        elapsed: Math.floor((Date.now() - startTime) / 1000),
      });

      await new Promise(r => setTimeout(r, pollInterval));
    }

    throw new Error(`Pipeline ${runId} did not complete within timeout`);
  }

  /**
   * Check if all quality gates pass
   */
  async checkQualityGates(
    owner: string,
    repo: string,
    ref: string,
    token: string
  ): Promise<{ passed: boolean; details: Record<string, boolean> }> {
    const octokit = this.initGitHub(token);

    // Get combined status
    const { data: status } = await octokit.repos.getCombinedStatusForRef({
      owner,
      repo,
      ref,
    });

    // Get check runs
    const { data: checks } = await octokit.checks.listForRef({
      owner,
      repo,
      ref,
    });

    const details: Record<string, boolean> = {};

    // Process statuses
    for (const s of status.statuses) {
      details[s.context] = s.state === 'success';
    }

    // Process check runs
    for (const check of checks.check_runs) {
      details[check.name] = check.conclusion === 'success';
    }

    const passed = Object.values(details).every(Boolean);

    return { passed, details };
  }
}
```

---

## 4. Pipeline Monitor Integration (`src/utils/pipeline-monitor.ts`)

```typescript
/**
 * Pipeline Monitor
 *
 * Provides real-time monitoring of CI/CD pipelines for agents.
 */

import { CICDAgent } from '../agents/agents/cicd-agent';
import { PipelineStatus } from '../agents/schemas/cicd-config';
import { EventEmitter } from 'events';
import { logger } from './logger';

/**
 * Pipeline events
 */
export interface PipelineEvents {
  'status:change': (status: PipelineStatus) => void;
  'job:complete': (job: PipelineStatus['jobs'][0]) => void;
  'pipeline:complete': (status: PipelineStatus) => void;
  'pipeline:failed': (status: PipelineStatus) => void;
}

/**
 * Pipeline Monitor
 */
export class PipelineMonitor extends EventEmitter {
  private cicdAgent: CICDAgent;
  private activeMonitors: Map<number, NodeJS.Timer> = new Map();

  constructor() {
    super();
    this.cicdAgent = new CICDAgent();
  }

  /**
   * Start monitoring a pipeline
   */
  startMonitoring(
    owner: string,
    repo: string,
    runId: number,
    token: string,
    pollIntervalMs = 10000
  ): void {
    if (this.activeMonitors.has(runId)) {
      return; // Already monitoring
    }

    let lastStatus: PipelineStatus | null = null;

    const poll = async () => {
      try {
        const status = await this.cicdAgent.getPipelineStatus(
          owner,
          repo,
          runId,
          token
        );

        // Check for status changes
        if (!lastStatus || lastStatus.status !== status.status) {
          this.emit('status:change', status);
        }

        // Check for job completions
        if (lastStatus) {
          for (const job of status.jobs) {
            const prevJob = lastStatus.jobs.find(j => j.name === job.name);
            if (prevJob?.status !== 'completed' && job.status === 'completed') {
              this.emit('job:complete', job);
            }
          }
        }

        // Check for pipeline completion
        if (status.status === 'completed') {
          this.stopMonitoring(runId);

          if (status.conclusion === 'success') {
            this.emit('pipeline:complete', status);
          } else {
            this.emit('pipeline:failed', status);
          }
        }

        lastStatus = status;
      } catch (error) {
        logger.error('Pipeline monitoring error', { runId, error });
      }
    };

    // Start polling
    poll();
    const interval = setInterval(poll, pollIntervalMs);
    this.activeMonitors.set(runId, interval);
  }

  /**
   * Stop monitoring a pipeline
   */
  stopMonitoring(runId: number): void {
    const interval = this.activeMonitors.get(runId);
    if (interval) {
      clearInterval(interval);
      this.activeMonitors.delete(runId);
    }
  }

  /**
   * Stop all monitoring
   */
  stopAll(): void {
    for (const [runId] of this.activeMonitors) {
      this.stopMonitoring(runId);
    }
  }
}

/**
 * Integration with orchestrator
 */
export function createPipelineAwareContext(
  monitor: PipelineMonitor
): { onPipelineComplete: Promise<PipelineStatus> } {
  return {
    onPipelineComplete: new Promise((resolve, reject) => {
      monitor.once('pipeline:complete', resolve);
      monitor.once('pipeline:failed', reject);
    }),
  };
}
```

---

## Validation Checklist

```
□ CI/CD Configuration Schema
  □ TriggerConfigSchema defined
  □ EnvironmentConfigSchema defined
  □ StepConfigSchema defined
  □ JobConfigSchema defined
  □ WorkflowConfigSchema defined
  □ PipelineStatusSchema defined
  □ CICDConfigOutputSchema defined

□ GitHub Actions Generator
  □ Generate CI workflow works
  □ Generate CD workflow works
  □ Generate CodeQL workflow works
  □ Generate Dependabot config works
  □ Proper YAML output

□ CI/CD Agent
  □ Generate config works
  □ Write config to disk works
  □ Get pipeline status works
  □ Trigger workflow works
  □ Wait for completion works
  □ Check quality gates works

□ Pipeline Monitor
  □ Start monitoring works
  □ Status change events work
  □ Job complete events work
  □ Pipeline complete events work
  □ Stop monitoring works

□ All tests pass
  □ npm run test -- tests/agents/cicd-agent
```

---

## Exports

```typescript
export {
  // Schemas
  TriggerConfigSchema,
  EnvironmentConfigSchema,
  StepConfigSchema,
  JobConfigSchema,
  WorkflowConfigSchema,
  PipelineStatusSchema,
  CICDConfigOutputSchema,

  // Types
  TriggerConfig,
  EnvironmentConfig,
  StepConfig,
  JobConfig,
  WorkflowConfig,
  PipelineStatus,
  CICDConfigOutput,

  // Generator
  GitHubActionsGenerator,
  GeneratorOptions,

  // Agent
  CICDAgent,

  // Monitor
  PipelineMonitor,
  createPipelineAwareContext,
};
```

---

## Next Step

Proceed to **20-RELEASE-WORKFLOW.md** to implement the release workflow for deploying to production.
