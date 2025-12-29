/**
 * Tech Stack Detector
 *
 * Analyzes project files to detect frameworks, libraries, and tech stack.
 */

import { logger } from '../utils/logger.js';
import * as fs from 'fs/promises';
import * as path from 'path';

const log = logger.child({ component: 'tech-detector' });

/**
 * Tech category
 */
export type TechCategory =
  | 'language'
  | 'framework'
  | 'library'
  | 'buildTool'
  | 'testFramework'
  | 'linter'
  | 'bundler'
  | 'database'
  | 'orm'
  | 'runtime'
  | 'cicd'
  | 'containerization';

/**
 * Confidence level for detection
 */
export type ConfidenceLevel = 'high' | 'medium' | 'low';

/**
 * Detected technology
 */
export interface DetectedTech {
  name: string;
  version?: string;
  category: TechCategory;
  confidence: ConfidenceLevel;
  source: string;
  metadata?: Record<string, unknown>;
}

/**
 * Tech detection rule
 */
export interface TechDetectionRule {
  name: string;
  category: TechCategory;
  detect: (context: DetectionContext) => DetectionResult | null;
}

/**
 * Detection context passed to rules
 */
export interface DetectionContext {
  projectPath: string;
  files: string[];
  packageJson?: PackageJsonData;
  configFiles: Map<string, string>;
}

/**
 * Detection result from a rule
 */
export interface DetectionResult {
  name: string;
  version?: string;
  category: TechCategory;
  confidence: ConfidenceLevel;
  source: string;
  metadata?: Record<string, unknown>;
}

/**
 * Package.json data
 */
export interface PackageJsonData {
  name?: string;
  version?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  scripts?: Record<string, string>;
  engines?: Record<string, string>;
}

/**
 * Full detection result
 */
export interface TechStackResult {
  techs: DetectedTech[];
  languages: DetectedTech[];
  frameworks: DetectedTech[];
  libraries: DetectedTech[];
  buildTools: DetectedTech[];
  testFrameworks: DetectedTech[];
  summary: TechStackSummary;
}

/**
 * Summary of detected tech stack
 */
export interface TechStackSummary {
  primaryLanguage: string | null;
  primaryFramework: string | null;
  runtime: string | null;
  hasTypeScript: boolean;
  hasTests: boolean;
  hasCICD: boolean;
  hasDocker: boolean;
  techCount: number;
}

/**
 * Built-in detection rules for common technologies
 */
export const BUILT_IN_RULES: TechDetectionRule[] = [
  // Languages
  {
    name: 'TypeScript',
    category: 'language',
    detect: (ctx) => {
      if (ctx.files.some((f) => f.endsWith('.ts') || f.endsWith('.tsx'))) {
        const version = ctx.packageJson?.devDependencies?.['typescript'];
        return {
          name: 'TypeScript',
          version,
          category: 'language',
          confidence: 'high',
          source: version ? 'package.json' : 'file extension',
        };
      }
      return null;
    },
  },
  {
    name: 'JavaScript',
    category: 'language',
    detect: (ctx) => {
      if (ctx.files.some((f) => f.endsWith('.js') || f.endsWith('.jsx') || f.endsWith('.mjs'))) {
        return {
          name: 'JavaScript',
          category: 'language',
          confidence: 'high',
          source: 'file extension',
        };
      }
      return null;
    },
  },
  {
    name: 'Python',
    category: 'language',
    detect: (ctx) => {
      if (ctx.files.some((f) => f.endsWith('.py'))) {
        return {
          name: 'Python',
          category: 'language',
          confidence: 'high',
          source: 'file extension',
        };
      }
      return null;
    },
  },
  {
    name: 'Go',
    category: 'language',
    detect: (ctx) => {
      if (ctx.files.some((f) => f.endsWith('.go'))) {
        return {
          name: 'Go',
          category: 'language',
          confidence: 'high',
          source: 'file extension',
        };
      }
      return null;
    },
  },
  {
    name: 'Rust',
    category: 'language',
    detect: (ctx) => {
      if (ctx.files.some((f) => f.endsWith('.rs'))) {
        return {
          name: 'Rust',
          category: 'language',
          confidence: 'high',
          source: 'file extension',
        };
      }
      return null;
    },
  },

  // Frameworks
  {
    name: 'React',
    category: 'framework',
    detect: (ctx) => {
      const version =
        ctx.packageJson?.dependencies?.['react'] || ctx.packageJson?.devDependencies?.['react'];
      if (version) {
        return {
          name: 'React',
          version,
          category: 'framework',
          confidence: 'high',
          source: 'package.json',
        };
      }
      return null;
    },
  },
  {
    name: 'Vue',
    category: 'framework',
    detect: (ctx) => {
      const version =
        ctx.packageJson?.dependencies?.['vue'] || ctx.packageJson?.devDependencies?.['vue'];
      if (version) {
        return {
          name: 'Vue',
          version,
          category: 'framework',
          confidence: 'high',
          source: 'package.json',
        };
      }
      return null;
    },
  },
  {
    name: 'Angular',
    category: 'framework',
    detect: (ctx) => {
      const version =
        ctx.packageJson?.dependencies?.['@angular/core'] ||
        ctx.packageJson?.devDependencies?.['@angular/core'];
      if (version) {
        return {
          name: 'Angular',
          version,
          category: 'framework',
          confidence: 'high',
          source: 'package.json',
        };
      }
      return null;
    },
  },
  {
    name: 'Next.js',
    category: 'framework',
    detect: (ctx) => {
      const version =
        ctx.packageJson?.dependencies?.['next'] || ctx.packageJson?.devDependencies?.['next'];
      if (version) {
        return {
          name: 'Next.js',
          version,
          category: 'framework',
          confidence: 'high',
          source: 'package.json',
        };
      }
      return null;
    },
  },
  {
    name: 'Express',
    category: 'framework',
    detect: (ctx) => {
      const version =
        ctx.packageJson?.dependencies?.['express'] ||
        ctx.packageJson?.devDependencies?.['express'];
      if (version) {
        return {
          name: 'Express',
          version,
          category: 'framework',
          confidence: 'high',
          source: 'package.json',
        };
      }
      return null;
    },
  },
  {
    name: 'Fastify',
    category: 'framework',
    detect: (ctx) => {
      const version =
        ctx.packageJson?.dependencies?.['fastify'] ||
        ctx.packageJson?.devDependencies?.['fastify'];
      if (version) {
        return {
          name: 'Fastify',
          version,
          category: 'framework',
          confidence: 'high',
          source: 'package.json',
        };
      }
      return null;
    },
  },

  // Test Frameworks
  {
    name: 'Vitest',
    category: 'testFramework',
    detect: (ctx) => {
      const version = ctx.packageJson?.devDependencies?.['vitest'];
      if (version) {
        return {
          name: 'Vitest',
          version,
          category: 'testFramework',
          confidence: 'high',
          source: 'package.json',
        };
      }
      return null;
    },
  },
  {
    name: 'Jest',
    category: 'testFramework',
    detect: (ctx) => {
      const version = ctx.packageJson?.devDependencies?.['jest'];
      if (version) {
        return {
          name: 'Jest',
          version,
          category: 'testFramework',
          confidence: 'high',
          source: 'package.json',
        };
      }
      return null;
    },
  },
  {
    name: 'Mocha',
    category: 'testFramework',
    detect: (ctx) => {
      const version = ctx.packageJson?.devDependencies?.['mocha'];
      if (version) {
        return {
          name: 'Mocha',
          version,
          category: 'testFramework',
          confidence: 'high',
          source: 'package.json',
        };
      }
      return null;
    },
  },
  {
    name: 'Playwright',
    category: 'testFramework',
    detect: (ctx) => {
      const version =
        ctx.packageJson?.devDependencies?.['@playwright/test'] ||
        ctx.packageJson?.devDependencies?.['playwright'];
      if (version) {
        return {
          name: 'Playwright',
          version,
          category: 'testFramework',
          confidence: 'high',
          source: 'package.json',
        };
      }
      return null;
    },
  },

  // Build Tools
  {
    name: 'Vite',
    category: 'bundler',
    detect: (ctx) => {
      const version = ctx.packageJson?.devDependencies?.['vite'];
      if (version) {
        return {
          name: 'Vite',
          version,
          category: 'bundler',
          confidence: 'high',
          source: 'package.json',
        };
      }
      return null;
    },
  },
  {
    name: 'Webpack',
    category: 'bundler',
    detect: (ctx) => {
      const version = ctx.packageJson?.devDependencies?.['webpack'];
      if (version) {
        return {
          name: 'Webpack',
          version,
          category: 'bundler',
          confidence: 'high',
          source: 'package.json',
        };
      }
      return null;
    },
  },
  {
    name: 'esbuild',
    category: 'bundler',
    detect: (ctx) => {
      const version = ctx.packageJson?.devDependencies?.['esbuild'];
      if (version) {
        return {
          name: 'esbuild',
          version,
          category: 'bundler',
          confidence: 'high',
          source: 'package.json',
        };
      }
      return null;
    },
  },
  {
    name: 'tsup',
    category: 'buildTool',
    detect: (ctx) => {
      const version = ctx.packageJson?.devDependencies?.['tsup'];
      if (version) {
        return {
          name: 'tsup',
          version,
          category: 'buildTool',
          confidence: 'high',
          source: 'package.json',
        };
      }
      return null;
    },
  },

  // Linters
  {
    name: 'ESLint',
    category: 'linter',
    detect: (ctx) => {
      const version = ctx.packageJson?.devDependencies?.['eslint'];
      if (version || ctx.files.some((f) => f.includes('.eslint'))) {
        return {
          name: 'ESLint',
          version,
          category: 'linter',
          confidence: 'high',
          source: version ? 'package.json' : 'config file',
        };
      }
      return null;
    },
  },
  {
    name: 'Prettier',
    category: 'linter',
    detect: (ctx) => {
      const version = ctx.packageJson?.devDependencies?.['prettier'];
      if (version || ctx.files.some((f) => f.includes('.prettier'))) {
        return {
          name: 'Prettier',
          version,
          category: 'linter',
          confidence: 'high',
          source: version ? 'package.json' : 'config file',
        };
      }
      return null;
    },
  },

  // Runtime
  {
    name: 'Node.js',
    category: 'runtime',
    detect: (ctx) => {
      if (ctx.packageJson?.engines?.['node'] || ctx.files.some((f) => f === 'package.json')) {
        return {
          name: 'Node.js',
          version: ctx.packageJson?.engines?.['node'],
          category: 'runtime',
          confidence: 'high',
          source: ctx.packageJson?.engines?.['node'] ? 'package.json engines' : 'package.json',
        };
      }
      return null;
    },
  },
  {
    name: 'Deno',
    category: 'runtime',
    detect: (ctx) => {
      if (ctx.files.some((f) => f.includes('deno.json') || f.includes('deno.jsonc'))) {
        return {
          name: 'Deno',
          category: 'runtime',
          confidence: 'high',
          source: 'deno.json',
        };
      }
      return null;
    },
  },
  {
    name: 'Bun',
    category: 'runtime',
    detect: (ctx) => {
      if (ctx.files.some((f) => f === 'bun.lockb') || ctx.packageJson?.engines?.['bun']) {
        return {
          name: 'Bun',
          version: ctx.packageJson?.engines?.['bun'],
          category: 'runtime',
          confidence: 'high',
          source: 'bun.lockb or package.json',
        };
      }
      return null;
    },
  },

  // CI/CD
  {
    name: 'GitHub Actions',
    category: 'cicd',
    detect: (ctx) => {
      if (ctx.files.some((f) => f.includes('.github/workflows'))) {
        return {
          name: 'GitHub Actions',
          category: 'cicd',
          confidence: 'high',
          source: '.github/workflows',
        };
      }
      return null;
    },
  },
  {
    name: 'GitLab CI',
    category: 'cicd',
    detect: (ctx) => {
      if (ctx.files.some((f) => f === '.gitlab-ci.yml')) {
        return {
          name: 'GitLab CI',
          category: 'cicd',
          confidence: 'high',
          source: '.gitlab-ci.yml',
        };
      }
      return null;
    },
  },

  // Containerization
  {
    name: 'Docker',
    category: 'containerization',
    detect: (ctx) => {
      if (ctx.files.some((f) => f === 'Dockerfile' || f === 'docker-compose.yml')) {
        return {
          name: 'Docker',
          category: 'containerization',
          confidence: 'high',
          source: 'Dockerfile',
        };
      }
      return null;
    },
  },

  // ORM/Database
  {
    name: 'Prisma',
    category: 'orm',
    detect: (ctx) => {
      const version =
        ctx.packageJson?.dependencies?.['@prisma/client'] ||
        ctx.packageJson?.devDependencies?.['prisma'];
      if (version || ctx.files.some((f) => f.includes('prisma/schema.prisma'))) {
        return {
          name: 'Prisma',
          version,
          category: 'orm',
          confidence: 'high',
          source: version ? 'package.json' : 'schema.prisma',
        };
      }
      return null;
    },
  },
  {
    name: 'Drizzle',
    category: 'orm',
    detect: (ctx) => {
      const version =
        ctx.packageJson?.dependencies?.['drizzle-orm'] ||
        ctx.packageJson?.devDependencies?.['drizzle-kit'];
      if (version) {
        return {
          name: 'Drizzle',
          version,
          category: 'orm',
          confidence: 'high',
          source: 'package.json',
        };
      }
      return null;
    },
  },
];

/**
 * Tech Stack Detector class
 */
export class TechDetector {
  private rules: TechDetectionRule[] = [...BUILT_IN_RULES];

  constructor(customRules: TechDetectionRule[] = []) {
    this.rules = [...BUILT_IN_RULES, ...customRules];
  }

  /**
   * Add a custom detection rule
   */
  addRule(rule: TechDetectionRule): void {
    this.rules.push(rule);
  }

  /**
   * Detect tech stack from a project path
   */
  async detect(projectPath: string): Promise<TechStackResult> {
    log.info('Starting tech detection', { projectPath });

    const context = await this.buildContext(projectPath);
    const techs: DetectedTech[] = [];

    for (const rule of this.rules) {
      try {
        const result = rule.detect(context);
        if (result) {
          techs.push(result);
          log.debug('Detected tech', { name: result.name, category: result.category });
        }
      } catch (error) {
        log.warn('Rule detection failed', {
          rule: rule.name,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    const result = this.categorizeResults(techs);
    log.info('Tech detection complete', { techCount: result.summary.techCount });
    return result;
  }

  /**
   * Detect from pre-built context (for testing)
   */
  detectFromContext(context: DetectionContext): TechStackResult {
    const techs: DetectedTech[] = [];

    for (const rule of this.rules) {
      try {
        const result = rule.detect(context);
        if (result) {
          techs.push(result);
        }
      } catch {
        // Ignore
      }
    }

    return this.categorizeResults(techs);
  }

  /**
   * Build detection context from project path
   */
  private async buildContext(projectPath: string): Promise<DetectionContext> {
    const files = await this.listFiles(projectPath);
    const configFiles = new Map<string, string>();

    // Try to load package.json
    let packageJson: PackageJsonData | undefined;
    try {
      const packageJsonPath = path.join(projectPath, 'package.json');
      const content = await fs.readFile(packageJsonPath, 'utf-8');
      packageJson = JSON.parse(content);
    } catch {
      // No package.json
    }

    // Load common config files
    const configFileNames = [
      'tsconfig.json',
      '.eslintrc.json',
      '.prettierrc',
      'vite.config.ts',
      'vitest.config.ts',
      'jest.config.js',
    ];

    for (const configFile of configFileNames) {
      try {
        const configPath = path.join(projectPath, configFile);
        const content = await fs.readFile(configPath, 'utf-8');
        configFiles.set(configFile, content);
      } catch {
        // Config file doesn't exist
      }
    }

    return {
      projectPath,
      files,
      packageJson,
      configFiles,
    };
  }

  /**
   * List all files in project (recursive, limited depth)
   */
  private async listFiles(dir: string, depth: number = 3): Promise<string[]> {
    const files: string[] = [];

    const scanDir = async (currentDir: string, currentDepth: number): Promise<void> => {
      if (currentDepth > depth) return;

      try {
        const entries = await fs.readdir(currentDir, { withFileTypes: true });

        for (const entry of entries) {
          // Skip common ignored directories
          if (
            entry.isDirectory() &&
            ['node_modules', '.git', 'dist', 'build', 'coverage', '.next', '__pycache__'].includes(
              entry.name
            )
          ) {
            continue;
          }

          const fullPath = path.join(currentDir, entry.name);
          const relativePath = path.relative(dir, fullPath);

          if (entry.isFile()) {
            files.push(relativePath);
          } else if (entry.isDirectory()) {
            await scanDir(fullPath, currentDepth + 1);
          }
        }
      } catch {
        // Directory not readable
      }
    };

    await scanDir(dir, 0);
    return files;
  }

  /**
   * Categorize detection results
   */
  private categorizeResults(techs: DetectedTech[]): TechStackResult {
    const languages = techs.filter((t) => t.category === 'language');
    const frameworks = techs.filter((t) => t.category === 'framework');
    const libraries = techs.filter((t) => t.category === 'library');
    const buildTools = techs.filter(
      (t) => t.category === 'buildTool' || t.category === 'bundler'
    );
    const testFrameworks = techs.filter((t) => t.category === 'testFramework');

    // Determine primary language (TypeScript takes precedence)
    let primaryLanguage: string | null = null;
    if (languages.find((l) => l.name === 'TypeScript')) {
      primaryLanguage = 'TypeScript';
    } else if (languages.length > 0) {
      primaryLanguage = languages[0].name;
    }

    // Determine primary framework
    const primaryFramework = frameworks.length > 0 ? frameworks[0].name : null;

    // Get runtime
    const runtimeTech = techs.find((t) => t.category === 'runtime');
    const runtime = runtimeTech?.name ?? null;

    const summary: TechStackSummary = {
      primaryLanguage,
      primaryFramework,
      runtime,
      hasTypeScript: languages.some((l) => l.name === 'TypeScript'),
      hasTests: testFrameworks.length > 0,
      hasCICD: techs.some((t) => t.category === 'cicd'),
      hasDocker: techs.some((t) => t.name === 'Docker'),
      techCount: techs.length,
    };

    return {
      techs,
      languages,
      frameworks,
      libraries,
      buildTools,
      testFrameworks,
      summary,
    };
  }
}

// Singleton instance
let instance: TechDetector | null = null;

/**
 * Get the singleton TechDetector instance
 */
export function getTechDetector(): TechDetector {
  if (!instance) {
    instance = new TechDetector();
  }
  return instance;
}

/**
 * Reset the singleton (for testing)
 */
export function resetTechDetector(): void {
  instance = null;
}
