# Step 04b: CLAUDE.md Generator

> **Checkpoint:** CP0 - Foundation
> **Previous Step:** 04a-HOOKS-GUARDRAILS.md
> **Next Step:** 05-AGENT-FRAMEWORK.md (CP1)

---

## Overview

This step implements the **CLAUDE.md generator** that creates project context files for Claude Code and other AI assistants. The CLAUDE.md file provides essential project information that helps AI tools understand the codebase structure, conventions, and requirements.

Key responsibilities:
- Analyze project structure to generate context
- Document tech stack and conventions
- Include architecture decisions and patterns
- Maintain living documentation as project evolves
- Support multiple AI assistant formats

---

## Deliverables

1. `src/context/claude-md-generator.ts` - Generator implementation
2. `src/context/project-analyzer.ts` - Project structure analysis
3. `src/context/templates/claude-md.ts` - CLAUDE.md templates
4. `src/context/types.ts` - Type definitions

---

## CLAUDE.md Specification

```markdown
# CLAUDE.md Structure

## Required Sections
1. Project Overview - What the project does
2. Tech Stack - Languages, frameworks, tools
3. Project Structure - Key directories and their purpose
4. Development Commands - Build, test, run commands
5. Code Conventions - Naming, formatting, patterns

## Optional Sections
6. Architecture - System design overview
7. API Documentation - Endpoints, contracts
8. Testing Strategy - Test types and coverage
9. Deployment - CI/CD, environments
10. Compliance - Security and regulatory requirements
```

---

## 1. Types (`src/context/types.ts`)

```typescript
/**
 * CLAUDE.md Context Types
 */

import { z } from 'zod';

/**
 * Tech stack detection result
 */
export interface TechStackInfo {
  languages: LanguageInfo[];
  frameworks: FrameworkInfo[];
  buildTools: string[];
  testingTools: string[];
  databases: string[];
  services: string[];
}

export interface LanguageInfo {
  name: string;
  version?: string;
  primary: boolean;
}

export interface FrameworkInfo {
  name: string;
  version?: string;
  type: 'frontend' | 'backend' | 'fullstack' | 'testing' | 'utility';
}

/**
 * Project structure analysis
 */
export interface ProjectStructure {
  rootDir: string;
  srcDirs: string[];
  testDirs: string[];
  configFiles: string[];
  entryPoints: string[];
  keyDirectories: DirectoryInfo[];
}

export interface DirectoryInfo {
  path: string;
  purpose: string;
  fileCount: number;
  patterns: string[];
}

/**
 * Code conventions detected
 */
export interface CodeConventions {
  namingConventions: {
    files: 'kebab-case' | 'camelCase' | 'PascalCase' | 'snake_case';
    components: 'PascalCase' | 'camelCase';
    functions: 'camelCase' | 'snake_case';
    constants: 'UPPER_SNAKE_CASE' | 'camelCase';
  };
  formatting: {
    indentation: 'tabs' | 'spaces';
    indentSize: number;
    maxLineLength: number;
    semicolons: boolean;
    quotes: 'single' | 'double';
  };
  patterns: string[];
}

/**
 * Development commands
 */
export interface DevCommands {
  install: string;
  build: string;
  dev: string;
  test: string;
  lint: string;
  format: string;
  custom: Record<string, string>;
}

/**
 * Architecture summary
 */
export interface ArchitectureSummary {
  pattern: string;  // e.g., "MVC", "Clean Architecture", "Microservices"
  apiStyle: string; // e.g., "REST", "GraphQL", "gRPC"
  stateManagement?: string;
  dataFlow: string;
  keyComponents: string[];
}

/**
 * Compliance requirements
 */
export interface ComplianceInfo {
  frameworks: string[];  // e.g., ["GDPR", "SOC2", "HIPAA"]
  requirements: string[];
  dataHandling: string[];
}

/**
 * Complete CLAUDE.md context
 */
export interface ClaudeMdContext {
  projectName: string;
  description: string;
  version: string;
  generatedAt: Date;
  techStack: TechStackInfo;
  structure: ProjectStructure;
  conventions: CodeConventions;
  commands: DevCommands;
  architecture?: ArchitectureSummary;
  compliance?: ComplianceInfo;
  additionalContext?: Record<string, unknown>;
}

/**
 * Generator options
 */
export interface GeneratorOptions {
  includeArchitecture: boolean;
  includeCompliance: boolean;
  includeApiDocs: boolean;
  customSections: string[];
  outputFormat: 'markdown' | 'yaml' | 'json';
}
```

---

## 2. Project Analyzer (`src/context/project-analyzer.ts`)

```typescript
/**
 * Project Analyzer
 *
 * Analyzes project structure and detects tech stack, conventions, etc.
 */

import fs from 'fs';
import path from 'path';
import {
  TechStackInfo,
  ProjectStructure,
  CodeConventions,
  DevCommands,
  DirectoryInfo,
} from './types';
import { logger } from '../utils/logger';

/**
 * Project Analyzer class
 */
export class ProjectAnalyzer {
  private projectRoot: string;

  constructor(projectRoot: string) {
    this.projectRoot = projectRoot;
  }

  /**
   * Analyze the complete project
   */
  async analyze(): Promise<{
    techStack: TechStackInfo;
    structure: ProjectStructure;
    conventions: CodeConventions;
    commands: DevCommands;
  }> {
    logger.info(`Analyzing project at ${this.projectRoot}`);

    const [techStack, structure, conventions, commands] = await Promise.all([
      this.detectTechStack(),
      this.analyzeStructure(),
      this.detectConventions(),
      this.extractCommands(),
    ]);

    return { techStack, structure, conventions, commands };
  }

  /**
   * Detect tech stack from project files
   */
  async detectTechStack(): Promise<TechStackInfo> {
    const techStack: TechStackInfo = {
      languages: [],
      frameworks: [],
      buildTools: [],
      testingTools: [],
      databases: [],
      services: [],
    };

    // Check package.json for Node.js projects
    const packageJsonPath = path.join(this.projectRoot, 'package.json');
    if (fs.existsSync(packageJsonPath)) {
      const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
      this.parsePackageJson(pkg, techStack);
    }

    // Check for Python
    const requirementsPath = path.join(this.projectRoot, 'requirements.txt');
    const pyprojectPath = path.join(this.projectRoot, 'pyproject.toml');
    if (fs.existsSync(requirementsPath) || fs.existsSync(pyprojectPath)) {
      techStack.languages.push({ name: 'Python', primary: false });
      this.parsePythonDeps(techStack);
    }

    // Check for Go
    const goModPath = path.join(this.projectRoot, 'go.mod');
    if (fs.existsSync(goModPath)) {
      techStack.languages.push({ name: 'Go', primary: false });
    }

    // Check for Rust
    const cargoPath = path.join(this.projectRoot, 'Cargo.toml');
    if (fs.existsSync(cargoPath)) {
      techStack.languages.push({ name: 'Rust', primary: false });
    }

    // Detect TypeScript
    const tsconfigPath = path.join(this.projectRoot, 'tsconfig.json');
    if (fs.existsSync(tsconfigPath)) {
      techStack.languages.push({ name: 'TypeScript', primary: true });
    }

    // Mark primary language
    if (techStack.languages.length > 0 && !techStack.languages.some(l => l.primary)) {
      techStack.languages[0].primary = true;
    }

    return techStack;
  }

  /**
   * Parse package.json dependencies
   */
  private parsePackageJson(pkg: any, techStack: TechStackInfo): void {
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };

    // Detect JavaScript/TypeScript
    if (!techStack.languages.some(l => l.name === 'TypeScript')) {
      techStack.languages.push({ name: 'JavaScript', primary: true });
    }

    // Frameworks
    const frameworkMap: Record<string, { name: string; type: 'frontend' | 'backend' | 'fullstack' }> = {
      'react': { name: 'React', type: 'frontend' },
      'vue': { name: 'Vue', type: 'frontend' },
      'svelte': { name: 'Svelte', type: 'frontend' },
      '@angular/core': { name: 'Angular', type: 'frontend' },
      'next': { name: 'Next.js', type: 'fullstack' },
      'nuxt': { name: 'Nuxt', type: 'fullstack' },
      'express': { name: 'Express', type: 'backend' },
      'fastify': { name: 'Fastify', type: 'backend' },
      'nestjs': { name: 'NestJS', type: 'backend' },
      'hono': { name: 'Hono', type: 'backend' },
    };

    for (const [dep, info] of Object.entries(frameworkMap)) {
      if (deps[dep]) {
        techStack.frameworks.push({
          name: info.name,
          type: info.type,
          version: deps[dep].replace(/[\^~]/g, ''),
        });
      }
    }

    // Build tools
    const buildTools = ['vite', 'webpack', 'esbuild', 'rollup', 'parcel', 'tsup'];
    for (const tool of buildTools) {
      if (deps[tool]) {
        techStack.buildTools.push(tool);
      }
    }

    // Testing tools
    const testingTools = ['vitest', 'jest', '@testing-library/react', 'playwright', 'cypress'];
    for (const tool of testingTools) {
      if (deps[tool]) {
        techStack.testingTools.push(tool.replace('@testing-library/', ''));
      }
    }

    // Databases
    const databases: Record<string, string> = {
      'pg': 'PostgreSQL',
      'mysql2': 'MySQL',
      'mongodb': 'MongoDB',
      'better-sqlite3': 'SQLite',
      'redis': 'Redis',
      'prisma': 'Prisma',
      'drizzle-orm': 'Drizzle',
    };

    for (const [dep, name] of Object.entries(databases)) {
      if (deps[dep]) {
        techStack.databases.push(name);
      }
    }
  }

  /**
   * Parse Python dependencies
   */
  private parsePythonDeps(techStack: TechStackInfo): void {
    const requirementsPath = path.join(this.projectRoot, 'requirements.txt');
    if (!fs.existsSync(requirementsPath)) return;

    const content = fs.readFileSync(requirementsPath, 'utf-8');
    const lines = content.split('\n');

    const frameworkMap: Record<string, { name: string; type: 'backend' | 'fullstack' }> = {
      'fastapi': { name: 'FastAPI', type: 'backend' },
      'django': { name: 'Django', type: 'fullstack' },
      'flask': { name: 'Flask', type: 'backend' },
    };

    for (const line of lines) {
      const pkg = line.split('==')[0].split('>=')[0].toLowerCase().trim();
      if (frameworkMap[pkg]) {
        techStack.frameworks.push({
          name: frameworkMap[pkg].name,
          type: frameworkMap[pkg].type,
        });
      }
      if (pkg === 'pytest') {
        techStack.testingTools.push('pytest');
      }
    }
  }

  /**
   * Analyze project structure
   */
  async analyzeStructure(): Promise<ProjectStructure> {
    const structure: ProjectStructure = {
      rootDir: this.projectRoot,
      srcDirs: [],
      testDirs: [],
      configFiles: [],
      entryPoints: [],
      keyDirectories: [],
    };

    // Common source directories
    const srcCandidates = ['src', 'lib', 'app', 'packages', 'modules'];
    for (const dir of srcCandidates) {
      const fullPath = path.join(this.projectRoot, dir);
      if (fs.existsSync(fullPath) && fs.statSync(fullPath).isDirectory()) {
        structure.srcDirs.push(dir);
        structure.keyDirectories.push(await this.analyzeDirectory(fullPath, dir));
      }
    }

    // Test directories
    const testCandidates = ['tests', 'test', '__tests__', 'spec'];
    for (const dir of testCandidates) {
      const fullPath = path.join(this.projectRoot, dir);
      if (fs.existsSync(fullPath) && fs.statSync(fullPath).isDirectory()) {
        structure.testDirs.push(dir);
      }
    }

    // Config files
    const configPatterns = [
      'package.json', 'tsconfig.json', 'vite.config.*', 'webpack.config.*',
      '.eslintrc.*', '.prettierrc*', 'jest.config.*', 'vitest.config.*',
      'docker-compose.yml', 'Dockerfile', '.env.example',
    ];

    const files = fs.readdirSync(this.projectRoot);
    for (const file of files) {
      for (const pattern of configPatterns) {
        if (this.matchesPattern(file, pattern)) {
          structure.configFiles.push(file);
          break;
        }
      }
    }

    // Entry points
    const entryPointCandidates = [
      'src/index.ts', 'src/index.js', 'src/main.ts', 'src/main.js',
      'src/app.ts', 'src/app.js', 'index.ts', 'index.js',
      'app/page.tsx', 'pages/index.tsx', // Next.js
    ];

    for (const entry of entryPointCandidates) {
      if (fs.existsSync(path.join(this.projectRoot, entry))) {
        structure.entryPoints.push(entry);
      }
    }

    return structure;
  }

  /**
   * Analyze a directory
   */
  private async analyzeDirectory(fullPath: string, relativePath: string): Promise<DirectoryInfo> {
    const files = this.getAllFiles(fullPath);
    const patterns = this.detectPatterns(files);

    return {
      path: relativePath,
      purpose: this.inferPurpose(relativePath, patterns),
      fileCount: files.length,
      patterns,
    };
  }

  /**
   * Get all files recursively
   */
  private getAllFiles(dir: string, files: string[] = []): string[] {
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;

      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        this.getAllFiles(fullPath, files);
      } else {
        files.push(fullPath);
      }
    }

    return files;
  }

  /**
   * Detect file patterns in a directory
   */
  private detectPatterns(files: string[]): string[] {
    const patterns: Set<string> = new Set();

    for (const file of files) {
      const ext = path.extname(file);
      const basename = path.basename(file, ext);

      if (basename.endsWith('.test') || basename.endsWith('.spec')) {
        patterns.add('tests');
      }
      if (basename.endsWith('.stories')) {
        patterns.add('storybook');
      }
      if (ext === '.tsx' || ext === '.jsx') {
        patterns.add('react-components');
      }
      if (basename.includes('controller')) {
        patterns.add('controllers');
      }
      if (basename.includes('service')) {
        patterns.add('services');
      }
      if (basename.includes('hook') || basename.startsWith('use')) {
        patterns.add('hooks');
      }
    }

    return Array.from(patterns);
  }

  /**
   * Infer directory purpose
   */
  private inferPurpose(path: string, patterns: string[]): string {
    const purposeMap: Record<string, string> = {
      'components': 'UI components',
      'pages': 'Page components/routes',
      'api': 'API routes/handlers',
      'lib': 'Shared utilities',
      'utils': 'Utility functions',
      'hooks': 'Custom React hooks',
      'services': 'Business logic services',
      'models': 'Data models',
      'types': 'TypeScript type definitions',
      'styles': 'Stylesheets',
      'assets': 'Static assets',
      'config': 'Configuration files',
    };

    for (const [key, purpose] of Object.entries(purposeMap)) {
      if (path.includes(key)) {
        return purpose;
      }
    }

    if (patterns.includes('react-components')) {
      return 'React components';
    }

    return 'Source code';
  }

  /**
   * Detect code conventions
   */
  async detectConventions(): Promise<CodeConventions> {
    // Check for configuration files
    const prettierConfig = this.readConfigFile(['.prettierrc', '.prettierrc.json', 'prettier.config.js']);
    const eslintConfig = this.readConfigFile(['.eslintrc', '.eslintrc.json', '.eslintrc.js']);

    const conventions: CodeConventions = {
      namingConventions: {
        files: 'kebab-case',
        components: 'PascalCase',
        functions: 'camelCase',
        constants: 'UPPER_SNAKE_CASE',
      },
      formatting: {
        indentation: 'spaces',
        indentSize: 2,
        maxLineLength: 100,
        semicolons: true,
        quotes: 'single',
      },
      patterns: [],
    };

    // Parse prettier config
    if (prettierConfig) {
      if (prettierConfig.useTabs) conventions.formatting.indentation = 'tabs';
      if (prettierConfig.tabWidth) conventions.formatting.indentSize = prettierConfig.tabWidth;
      if (prettierConfig.printWidth) conventions.formatting.maxLineLength = prettierConfig.printWidth;
      if (prettierConfig.semi === false) conventions.formatting.semicolons = false;
      if (prettierConfig.singleQuote === false) conventions.formatting.quotes = 'double';
    }

    // Detect patterns from code
    const srcDir = path.join(this.projectRoot, 'src');
    if (fs.existsSync(srcDir)) {
      const files = fs.readdirSync(srcDir);

      // Detect file naming
      const kebabFiles = files.filter(f => /^[a-z0-9-]+\.[a-z]+$/.test(f));
      const camelFiles = files.filter(f => /^[a-z][a-zA-Z0-9]+\.[a-z]+$/.test(f));
      const pascalFiles = files.filter(f => /^[A-Z][a-zA-Z0-9]+\.[a-z]+$/.test(f));

      if (kebabFiles.length > camelFiles.length && kebabFiles.length > pascalFiles.length) {
        conventions.namingConventions.files = 'kebab-case';
      } else if (pascalFiles.length > camelFiles.length) {
        conventions.namingConventions.files = 'PascalCase';
      } else if (camelFiles.length > 0) {
        conventions.namingConventions.files = 'camelCase';
      }
    }

    return conventions;
  }

  /**
   * Read a config file
   */
  private readConfigFile(candidates: string[]): any {
    for (const candidate of candidates) {
      const fullPath = path.join(this.projectRoot, candidate);
      if (fs.existsSync(fullPath)) {
        try {
          if (candidate.endsWith('.json') || candidate.endsWith('rc')) {
            return JSON.parse(fs.readFileSync(fullPath, 'utf-8'));
          }
        } catch {
          // Ignore parse errors
        }
      }
    }
    return null;
  }

  /**
   * Extract development commands
   */
  async extractCommands(): Promise<DevCommands> {
    const commands: DevCommands = {
      install: 'npm install',
      build: 'npm run build',
      dev: 'npm run dev',
      test: 'npm test',
      lint: 'npm run lint',
      format: 'npm run format',
      custom: {},
    };

    const packageJsonPath = path.join(this.projectRoot, 'package.json');
    if (fs.existsSync(packageJsonPath)) {
      const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
      const scripts = pkg.scripts || {};

      // Map common scripts
      if (scripts.build) commands.build = `npm run build`;
      if (scripts.dev) commands.dev = `npm run dev`;
      if (scripts.start) commands.dev = `npm start`;
      if (scripts.test) commands.test = `npm test`;
      if (scripts.lint) commands.lint = `npm run lint`;
      if (scripts.format) commands.format = `npm run format`;

      // Detect package manager
      if (fs.existsSync(path.join(this.projectRoot, 'pnpm-lock.yaml'))) {
        commands.install = 'pnpm install';
        Object.keys(commands).forEach(key => {
          if (key !== 'install' && key !== 'custom') {
            commands[key as keyof DevCommands] = (commands[key as keyof DevCommands] as string).replace('npm', 'pnpm');
          }
        });
      } else if (fs.existsSync(path.join(this.projectRoot, 'yarn.lock'))) {
        commands.install = 'yarn';
        Object.keys(commands).forEach(key => {
          if (key !== 'install' && key !== 'custom') {
            commands[key as keyof DevCommands] = (commands[key as keyof DevCommands] as string).replace('npm run', 'yarn').replace('npm', 'yarn');
          }
        });
      }

      // Add custom scripts
      const customScripts = ['typecheck', 'e2e', 'storybook', 'db:migrate', 'db:seed'];
      for (const script of customScripts) {
        if (scripts[script]) {
          commands.custom[script] = `npm run ${script}`;
        }
      }
    }

    return commands;
  }

  /**
   * Check if filename matches a pattern (supports * wildcard)
   */
  private matchesPattern(filename: string, pattern: string): boolean {
    if (!pattern.includes('*')) {
      return filename === pattern;
    }
    const regex = new RegExp('^' + pattern.replace(/\./g, '\\.').replace(/\*/g, '.*') + '$');
    return regex.test(filename);
  }
}
```

---

## 3. CLAUDE.md Generator (`src/context/claude-md-generator.ts`)

```typescript
/**
 * CLAUDE.md Generator
 *
 * Generates project context files for AI assistants.
 */

import {
  ClaudeMdContext,
  GeneratorOptions,
  TechStackInfo,
  ProjectStructure,
  CodeConventions,
  DevCommands,
} from './types';
import { ProjectAnalyzer } from './project-analyzer';
import { logger } from '../utils/logger';
import fs from 'fs';
import path from 'path';

/**
 * Default generator options
 */
const DEFAULT_OPTIONS: GeneratorOptions = {
  includeArchitecture: true,
  includeCompliance: false,
  includeApiDocs: false,
  customSections: [],
  outputFormat: 'markdown',
};

/**
 * CLAUDE.md Generator class
 */
export class ClaudeMdGenerator {
  private projectRoot: string;
  private analyzer: ProjectAnalyzer;
  private options: GeneratorOptions;

  constructor(projectRoot: string, options: Partial<GeneratorOptions> = {}) {
    this.projectRoot = projectRoot;
    this.analyzer = new ProjectAnalyzer(projectRoot);
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * Generate CLAUDE.md content
   */
  async generate(): Promise<string> {
    logger.info('Generating CLAUDE.md...');

    // Analyze project
    const analysis = await this.analyzer.analyze();

    // Build context
    const context: ClaudeMdContext = {
      projectName: this.getProjectName(),
      description: this.getProjectDescription(),
      version: this.getProjectVersion(),
      generatedAt: new Date(),
      techStack: analysis.techStack,
      structure: analysis.structure,
      conventions: analysis.conventions,
      commands: analysis.commands,
    };

    // Generate markdown
    const markdown = this.renderMarkdown(context);

    logger.info('CLAUDE.md generated successfully');
    return markdown;
  }

  /**
   * Generate and write CLAUDE.md file
   */
  async generateAndWrite(outputPath?: string): Promise<string> {
    const content = await this.generate();
    const filePath = outputPath || path.join(this.projectRoot, 'CLAUDE.md');

    fs.writeFileSync(filePath, content, 'utf-8');
    logger.info(`CLAUDE.md written to ${filePath}`);

    return filePath;
  }

  /**
   * Get project name from package.json or directory
   */
  private getProjectName(): string {
    const packageJsonPath = path.join(this.projectRoot, 'package.json');
    if (fs.existsSync(packageJsonPath)) {
      const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
      if (pkg.name) return pkg.name;
    }
    return path.basename(this.projectRoot);
  }

  /**
   * Get project description
   */
  private getProjectDescription(): string {
    const packageJsonPath = path.join(this.projectRoot, 'package.json');
    if (fs.existsSync(packageJsonPath)) {
      const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
      if (pkg.description) return pkg.description;
    }
    return 'A software project';
  }

  /**
   * Get project version
   */
  private getProjectVersion(): string {
    const packageJsonPath = path.join(this.projectRoot, 'package.json');
    if (fs.existsSync(packageJsonPath)) {
      const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
      if (pkg.version) return pkg.version;
    }
    return '0.0.0';
  }

  /**
   * Render context to markdown
   */
  private renderMarkdown(context: ClaudeMdContext): string {
    const sections: string[] = [];

    // Header
    sections.push(`# ${context.projectName}`);
    sections.push('');
    sections.push(`> ${context.description}`);
    sections.push('');
    sections.push(`*Generated by Aigentflow on ${context.generatedAt.toISOString().split('T')[0]}*`);
    sections.push('');

    // Project Overview
    sections.push('## Project Overview');
    sections.push('');
    sections.push(context.description);
    sections.push('');

    // Tech Stack
    sections.push('## Tech Stack');
    sections.push('');
    sections.push(this.renderTechStack(context.techStack));
    sections.push('');

    // Project Structure
    sections.push('## Project Structure');
    sections.push('');
    sections.push(this.renderStructure(context.structure));
    sections.push('');

    // Development Commands
    sections.push('## Development Commands');
    sections.push('');
    sections.push(this.renderCommands(context.commands));
    sections.push('');

    // Code Conventions
    sections.push('## Code Conventions');
    sections.push('');
    sections.push(this.renderConventions(context.conventions));
    sections.push('');

    // Architecture (if enabled)
    if (this.options.includeArchitecture && context.architecture) {
      sections.push('## Architecture');
      sections.push('');
      sections.push(this.renderArchitecture(context.architecture));
      sections.push('');
    }

    // Compliance (if enabled)
    if (this.options.includeCompliance && context.compliance) {
      sections.push('## Compliance');
      sections.push('');
      sections.push(this.renderCompliance(context.compliance));
      sections.push('');
    }

    // Key Files
    sections.push('## Key Files');
    sections.push('');
    sections.push(this.renderKeyFiles(context.structure));
    sections.push('');

    // Footer
    sections.push('---');
    sections.push('');
    sections.push('*This file is auto-generated. Update by running `aigentflow context update`*');

    return sections.join('\n');
  }

  /**
   * Render tech stack section
   */
  private renderTechStack(techStack: TechStackInfo): string {
    const lines: string[] = [];

    if (techStack.languages.length > 0) {
      lines.push('### Languages');
      for (const lang of techStack.languages) {
        const version = lang.version ? ` (${lang.version})` : '';
        const primary = lang.primary ? ' **(primary)**' : '';
        lines.push(`- ${lang.name}${version}${primary}`);
      }
      lines.push('');
    }

    if (techStack.frameworks.length > 0) {
      lines.push('### Frameworks');
      for (const fw of techStack.frameworks) {
        const version = fw.version ? ` ${fw.version}` : '';
        lines.push(`- **${fw.name}**${version} (${fw.type})`);
      }
      lines.push('');
    }

    if (techStack.buildTools.length > 0) {
      lines.push('### Build Tools');
      lines.push(techStack.buildTools.map(t => `\`${t}\``).join(', '));
      lines.push('');
    }

    if (techStack.testingTools.length > 0) {
      lines.push('### Testing');
      lines.push(techStack.testingTools.map(t => `\`${t}\``).join(', '));
      lines.push('');
    }

    if (techStack.databases.length > 0) {
      lines.push('### Databases');
      lines.push(techStack.databases.join(', '));
      lines.push('');
    }

    return lines.join('\n');
  }

  /**
   * Render structure section
   */
  private renderStructure(structure: ProjectStructure): string {
    const lines: string[] = [];

    lines.push('```');
    lines.push(`${path.basename(structure.rootDir)}/`);

    for (const dir of structure.keyDirectories) {
      lines.push(`├── ${dir.path}/          # ${dir.purpose}`);
    }

    if (structure.testDirs.length > 0) {
      lines.push(`├── ${structure.testDirs[0]}/          # Test files`);
    }

    lines.push('├── package.json');

    for (const config of structure.configFiles.slice(0, 5)) {
      if (config !== 'package.json') {
        lines.push(`├── ${config}`);
      }
    }

    lines.push('```');

    return lines.join('\n');
  }

  /**
   * Render commands section
   */
  private renderCommands(commands: DevCommands): string {
    const lines: string[] = [];

    lines.push('```bash');
    lines.push(`# Install dependencies`);
    lines.push(commands.install);
    lines.push('');
    lines.push('# Start development server');
    lines.push(commands.dev);
    lines.push('');
    lines.push('# Run tests');
    lines.push(commands.test);
    lines.push('');
    lines.push('# Build for production');
    lines.push(commands.build);
    lines.push('');
    lines.push('# Lint code');
    lines.push(commands.lint);
    lines.push('```');

    if (Object.keys(commands.custom).length > 0) {
      lines.push('');
      lines.push('### Additional Commands');
      lines.push('');
      for (const [name, cmd] of Object.entries(commands.custom)) {
        lines.push(`- \`${cmd}\` - ${name}`);
      }
    }

    return lines.join('\n');
  }

  /**
   * Render conventions section
   */
  private renderConventions(conventions: CodeConventions): string {
    const lines: string[] = [];

    lines.push('### Naming');
    lines.push(`- **Files:** ${conventions.namingConventions.files}`);
    lines.push(`- **Components:** ${conventions.namingConventions.components}`);
    lines.push(`- **Functions:** ${conventions.namingConventions.functions}`);
    lines.push(`- **Constants:** ${conventions.namingConventions.constants}`);
    lines.push('');

    lines.push('### Formatting');
    lines.push(`- **Indentation:** ${conventions.formatting.indentation} (${conventions.formatting.indentSize})`);
    lines.push(`- **Max line length:** ${conventions.formatting.maxLineLength}`);
    lines.push(`- **Semicolons:** ${conventions.formatting.semicolons ? 'required' : 'none'}`);
    lines.push(`- **Quotes:** ${conventions.formatting.quotes}`);

    return lines.join('\n');
  }

  /**
   * Render architecture section
   */
  private renderArchitecture(arch: any): string {
    const lines: string[] = [];

    lines.push(`**Pattern:** ${arch.pattern}`);
    lines.push(`**API Style:** ${arch.apiStyle}`);

    if (arch.stateManagement) {
      lines.push(`**State Management:** ${arch.stateManagement}`);
    }

    lines.push('');
    lines.push('### Key Components');
    for (const comp of arch.keyComponents || []) {
      lines.push(`- ${comp}`);
    }

    return lines.join('\n');
  }

  /**
   * Render compliance section
   */
  private renderCompliance(compliance: any): string {
    const lines: string[] = [];

    if (compliance.frameworks?.length > 0) {
      lines.push('### Compliance Frameworks');
      lines.push(compliance.frameworks.join(', '));
      lines.push('');
    }

    if (compliance.requirements?.length > 0) {
      lines.push('### Requirements');
      for (const req of compliance.requirements) {
        lines.push(`- ${req}`);
      }
    }

    return lines.join('\n');
  }

  /**
   * Render key files section
   */
  private renderKeyFiles(structure: ProjectStructure): string {
    const lines: string[] = [];

    if (structure.entryPoints.length > 0) {
      lines.push('### Entry Points');
      for (const entry of structure.entryPoints) {
        lines.push(`- \`${entry}\``);
      }
      lines.push('');
    }

    lines.push('### Configuration');
    for (const config of structure.configFiles) {
      lines.push(`- \`${config}\``);
    }

    return lines.join('\n');
  }
}

/**
 * Generate CLAUDE.md for a project
 */
export async function generateClaudeMd(
  projectRoot: string,
  options?: Partial<GeneratorOptions>
): Promise<string> {
  const generator = new ClaudeMdGenerator(projectRoot, options);
  return generator.generate();
}
```

---

## Test Scenarios

```typescript
// tests/context/claude-md-generator.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ClaudeMdGenerator } from '../../src/context/claude-md-generator';
import fs from 'fs';
import path from 'path';
import os from 'os';

describe('ClaudeMdGenerator', () => {
  let testDir: string;

  beforeEach(() => {
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-md-test-'));

    // Create a minimal project structure
    fs.writeFileSync(path.join(testDir, 'package.json'), JSON.stringify({
      name: 'test-project',
      version: '1.0.0',
      description: 'A test project',
      scripts: {
        build: 'tsc',
        dev: 'vite',
        test: 'vitest',
      },
      dependencies: {
        react: '^18.0.0',
      },
      devDependencies: {
        typescript: '^5.0.0',
        vitest: '^1.0.0',
      },
    }));

    fs.mkdirSync(path.join(testDir, 'src'));
    fs.writeFileSync(path.join(testDir, 'src', 'index.ts'), 'export const hello = "world";');
    fs.writeFileSync(path.join(testDir, 'tsconfig.json'), '{}');
  });

  afterEach(() => {
    fs.rmSync(testDir, { recursive: true, force: true });
  });

  it('should generate CLAUDE.md content', async () => {
    const generator = new ClaudeMdGenerator(testDir);
    const content = await generator.generate();

    expect(content).toContain('# test-project');
    expect(content).toContain('A test project');
    expect(content).toContain('## Tech Stack');
    expect(content).toContain('TypeScript');
    expect(content).toContain('React');
  });

  it('should detect development commands', async () => {
    const generator = new ClaudeMdGenerator(testDir);
    const content = await generator.generate();

    expect(content).toContain('npm run dev');
    expect(content).toContain('npm run build');
    expect(content).toContain('npm test');
  });

  it('should write CLAUDE.md file', async () => {
    const generator = new ClaudeMdGenerator(testDir);
    const filePath = await generator.generateAndWrite();

    expect(fs.existsSync(filePath)).toBe(true);
    expect(filePath).toBe(path.join(testDir, 'CLAUDE.md'));
  });
});
```

---

## Validation Checklist

```
□ Project analyzer detects tech stack
□ Structure analysis works
□ Convention detection works
□ Command extraction works
□ Markdown generation produces valid output
□ File writing works
□ All tests pass
```

---

## Next Step

Proceed to **05-AGENT-FRAMEWORK.md** (CP1) to implement the base agent framework.
