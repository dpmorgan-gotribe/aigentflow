/**
 * Code Analyzer
 *
 * Utilities for analyzing code structure, patterns, and architecture.
 */

import { logger } from '../utils/logger.js';
import * as fs from 'fs/promises';
import * as path from 'path';

const log = logger.child({ component: 'code-analyzer' });

/**
 * Architecture pattern types
 */
export type ArchitecturePattern =
  | 'mvc'
  | 'mvvm'
  | 'layered'
  | 'microservices'
  | 'monolith'
  | 'modular'
  | 'serverless'
  | 'event-driven'
  | 'unknown';

/**
 * Directory entry for structure analysis
 */
export interface DirectoryEntry {
  name: string;
  type: 'file' | 'directory';
  path: string;
  extension?: string;
  size?: number;
  children?: DirectoryEntry[];
}

/**
 * Directory structure summary
 */
export interface DirectoryStructure {
  root: DirectoryEntry;
  totalFiles: number;
  totalDirectories: number;
  filesByExtension: Record<string, number>;
  maxDepth: number;
  commonPatterns: string[];
}

/**
 * Code metrics
 */
export interface CodeMetrics {
  linesOfCode: number;
  fileCount: number;
  averageLinesPerFile: number;
  largestFiles: Array<{ path: string; lines: number }>;
  emptyFiles: number;
}

/**
 * Pattern detection result
 */
export interface PatternDetection {
  pattern: ArchitecturePattern;
  confidence: number;
  indicators: string[];
  recommendations: string[];
}

/**
 * Project analysis result
 */
export interface ProjectAnalysis {
  structure: DirectoryStructure;
  metrics: CodeMetrics;
  patterns: PatternDetection;
  conventions: ConventionAnalysis;
  recommendations: string[];
}

/**
 * Convention analysis
 */
export interface ConventionAnalysis {
  namingConvention: 'camelCase' | 'snake_case' | 'kebab-case' | 'PascalCase' | 'mixed';
  moduleSystem: 'esm' | 'commonjs' | 'mixed' | 'unknown';
  hasIndexFiles: boolean;
  hasTestFiles: boolean;
  testLocation: 'colocated' | 'separate' | 'none';
}

/**
 * Pattern indicators map
 */
const PATTERN_INDICATORS: Record<ArchitecturePattern, { directories: string[]; files: string[] }> =
  {
    mvc: {
      directories: ['models', 'views', 'controllers', 'routes'],
      files: ['controller.', 'model.', 'view.'],
    },
    mvvm: {
      directories: ['models', 'viewmodels', 'views'],
      files: ['viewmodel.', '.vm.'],
    },
    layered: {
      directories: ['domain', 'application', 'infrastructure', 'presentation', 'services'],
      files: ['service.', 'repository.'],
    },
    microservices: {
      directories: ['services', 'packages', 'apps'],
      files: ['docker-compose.yml'],
    },
    monolith: {
      directories: ['src', 'lib', 'app'],
      files: [],
    },
    modular: {
      directories: ['modules', 'features', 'components'],
      files: [],
    },
    serverless: {
      directories: ['functions', 'lambdas', 'handlers'],
      files: ['serverless.yml', 'serverless.ts', 'netlify.toml', 'vercel.json'],
    },
    'event-driven': {
      directories: ['events', 'handlers', 'listeners', 'queues'],
      files: ['event.', 'handler.', 'listener.'],
    },
    unknown: {
      directories: [],
      files: [],
    },
  };

/**
 * Code Analyzer class
 */
export class CodeAnalyzer {
  private ignoredDirs = new Set([
    'node_modules',
    '.git',
    'dist',
    'build',
    'coverage',
    '.next',
    '__pycache__',
    '.cache',
    'vendor',
    'target',
  ]);

  private ignoredFiles = new Set(['.DS_Store', 'Thumbs.db', '.gitkeep']);

  /**
   * Analyze project directory structure
   */
  async analyzeStructure(projectPath: string, maxDepth: number = 4): Promise<DirectoryStructure> {
    log.info('Analyzing directory structure', { projectPath, maxDepth });

    const filesByExtension: Record<string, number> = {};
    let totalFiles = 0;
    let totalDirectories = 0;
    let actualMaxDepth = 0;

    const scanDir = async (dir: string, depth: number): Promise<DirectoryEntry> => {
      actualMaxDepth = Math.max(actualMaxDepth, depth);
      const relativePath = path.relative(projectPath, dir) || '.';
      const entry: DirectoryEntry = {
        name: path.basename(dir) || '.',
        type: 'directory',
        path: relativePath,
        children: [],
      };

      totalDirectories++;

      if (depth >= maxDepth) {
        return entry;
      }

      try {
        const entries = await fs.readdir(dir, { withFileTypes: true });

        for (const item of entries) {
          if (this.ignoredDirs.has(item.name) || this.ignoredFiles.has(item.name)) {
            continue;
          }

          const fullPath = path.join(dir, item.name);

          if (item.isDirectory()) {
            const childDir = await scanDir(fullPath, depth + 1);
            entry.children?.push(childDir);
          } else if (item.isFile()) {
            const ext = path.extname(item.name).toLowerCase() || 'no-extension';
            filesByExtension[ext] = (filesByExtension[ext] || 0) + 1;
            totalFiles++;

            let size: number | undefined;
            try {
              const stats = await fs.stat(fullPath);
              size = stats.size;
            } catch {
              // Ignore stat errors
            }

            entry.children?.push({
              name: item.name,
              type: 'file',
              path: path.relative(projectPath, fullPath),
              extension: ext,
              size,
            });
          }
        }
      } catch (error) {
        log.warn('Failed to read directory', {
          dir,
          error: error instanceof Error ? error.message : String(error),
        });
      }

      return entry;
    };

    const root = await scanDir(projectPath, 0);

    // Detect common patterns in directory names
    const commonPatterns = this.detectCommonPatterns(root);

    log.info('Structure analysis complete', { totalFiles, totalDirectories });

    return {
      root,
      totalFiles,
      totalDirectories,
      filesByExtension,
      maxDepth: actualMaxDepth,
      commonPatterns,
    };
  }

  /**
   * Analyze code metrics
   */
  async analyzeMetrics(projectPath: string): Promise<CodeMetrics> {
    log.info('Analyzing code metrics', { projectPath });

    const codeExtensions = new Set([
      '.ts',
      '.tsx',
      '.js',
      '.jsx',
      '.py',
      '.go',
      '.rs',
      '.java',
      '.cs',
      '.cpp',
      '.c',
      '.h',
      '.vue',
      '.svelte',
    ]);

    let linesOfCode = 0;
    let fileCount = 0;
    let emptyFiles = 0;
    const fileSizes: Array<{ path: string; lines: number }> = [];

    const scanFiles = async (dir: string): Promise<void> => {
      try {
        const entries = await fs.readdir(dir, { withFileTypes: true });

        for (const entry of entries) {
          if (this.ignoredDirs.has(entry.name)) continue;

          const fullPath = path.join(dir, entry.name);

          if (entry.isDirectory()) {
            await scanFiles(fullPath);
          } else if (entry.isFile()) {
            const ext = path.extname(entry.name).toLowerCase();
            if (codeExtensions.has(ext)) {
              try {
                const content = await fs.readFile(fullPath, 'utf-8');
                const lines = content.split('\n').length;
                linesOfCode += lines;
                fileCount++;

                if (lines === 0 || (lines === 1 && content.trim() === '')) {
                  emptyFiles++;
                }

                fileSizes.push({
                  path: path.relative(projectPath, fullPath),
                  lines,
                });
              } catch {
                // Skip unreadable files
              }
            }
          }
        }
      } catch {
        // Skip unreadable directories
      }
    };

    await scanFiles(projectPath);

    // Sort by lines and get top 10
    fileSizes.sort((a, b) => b.lines - a.lines);
    const largestFiles = fileSizes.slice(0, 10);

    log.info('Metrics analysis complete', { linesOfCode, fileCount });

    return {
      linesOfCode,
      fileCount,
      averageLinesPerFile: fileCount > 0 ? Math.round(linesOfCode / fileCount) : 0,
      largestFiles,
      emptyFiles,
    };
  }

  /**
   * Detect architecture pattern
   */
  detectPattern(structure: DirectoryStructure): PatternDetection {
    log.info('Detecting architecture pattern');

    const scores: Record<ArchitecturePattern, number> = {
      mvc: 0,
      mvvm: 0,
      layered: 0,
      microservices: 0,
      monolith: 0,
      modular: 0,
      serverless: 0,
      'event-driven': 0,
      unknown: 0,
    };

    const allPaths = this.flattenPaths(structure.root);
    const dirNames = allPaths
      .filter((p) => p.type === 'directory')
      .map((p) => p.name.toLowerCase());
    const fileNames = allPaths.filter((p) => p.type === 'file').map((p) => p.name.toLowerCase());

    // Score each pattern
    for (const [pattern, indicators] of Object.entries(PATTERN_INDICATORS)) {
      const patternKey = pattern as ArchitecturePattern;

      // Check directories
      for (const dir of indicators.directories) {
        if (dirNames.includes(dir.toLowerCase())) {
          scores[patternKey] += 2;
        }
      }

      // Check files
      for (const file of indicators.files) {
        if (fileNames.some((f) => f.includes(file.toLowerCase()))) {
          scores[patternKey] += 1;
        }
      }
    }

    // Find best match
    let bestPattern: ArchitecturePattern = 'unknown';
    let bestScore = 0;

    for (const [pattern, score] of Object.entries(scores)) {
      if (score > bestScore) {
        bestScore = score;
        bestPattern = pattern as ArchitecturePattern;
      }
    }

    // Calculate confidence (max score would be around 10)
    const confidence = Math.min(bestScore / 6, 1);

    // Get indicators for the detected pattern
    const patternIndicators = PATTERN_INDICATORS[bestPattern];
    const foundIndicators = [
      ...patternIndicators.directories.filter((d) => dirNames.includes(d.toLowerCase())),
      ...patternIndicators.files.filter((f) => fileNames.some((fn) => fn.includes(f))),
    ];

    // Generate recommendations
    const recommendations = this.generatePatternRecommendations(bestPattern, structure);

    log.info('Pattern detection complete', { pattern: bestPattern, confidence });

    return {
      pattern: bestPattern,
      confidence,
      indicators: foundIndicators,
      recommendations,
    };
  }

  /**
   * Analyze coding conventions
   */
  analyzeConventions(structure: DirectoryStructure): ConventionAnalysis {
    log.info('Analyzing conventions');

    const allPaths = this.flattenPaths(structure.root);
    const fileNames = allPaths.filter((p) => p.type === 'file').map((p) => p.name);
    const dirNames = allPaths.filter((p) => p.type === 'directory').map((p) => p.name);

    // Detect naming convention
    const namingConvention = this.detectNamingConvention([...fileNames, ...dirNames]);

    // Check module system
    const hasPackageJson = fileNames.some((f) => f === 'package.json');
    let moduleSystem: ConventionAnalysis['moduleSystem'] = 'unknown';

    if (hasPackageJson) {
      const hasMjsFiles = fileNames.some((f) => f.endsWith('.mjs'));
      const hasCjsFiles = fileNames.some((f) => f.endsWith('.cjs'));

      if (hasMjsFiles && !hasCjsFiles) {
        moduleSystem = 'esm';
      } else if (hasCjsFiles && !hasMjsFiles) {
        moduleSystem = 'commonjs';
      } else if (hasMjsFiles && hasCjsFiles) {
        moduleSystem = 'mixed';
      } else {
        // Default to ESM for modern projects
        moduleSystem = 'esm';
      }
    }

    // Check for index files
    const hasIndexFiles = fileNames.some(
      (f) => f === 'index.ts' || f === 'index.js' || f === 'index.tsx'
    );

    // Check for test files
    const testPatterns = ['.test.', '.spec.', '_test.', '_spec.'];
    const hasTestFiles = fileNames.some((f) => testPatterns.some((p) => f.includes(p)));

    // Determine test location
    let testLocation: ConventionAnalysis['testLocation'] = 'none';
    if (hasTestFiles) {
      const hasTestDir = dirNames.some(
        (d) => d.toLowerCase() === 'tests' || d.toLowerCase() === '__tests__' || d === 'test'
      );
      testLocation = hasTestDir ? 'separate' : 'colocated';
    }

    log.info('Convention analysis complete', { namingConvention, moduleSystem });

    return {
      namingConvention,
      moduleSystem,
      hasIndexFiles,
      hasTestFiles,
      testLocation,
    };
  }

  /**
   * Full project analysis
   */
  async analyzeProject(projectPath: string): Promise<ProjectAnalysis> {
    log.info('Starting full project analysis', { projectPath });

    const [structure, metrics] = await Promise.all([
      this.analyzeStructure(projectPath),
      this.analyzeMetrics(projectPath),
    ]);

    const patterns = this.detectPattern(structure);
    const conventions = this.analyzeConventions(structure);

    // Generate overall recommendations
    const recommendations = this.generateRecommendations(structure, metrics, patterns, conventions);

    log.info('Full project analysis complete');

    return {
      structure,
      metrics,
      patterns,
      conventions,
      recommendations,
    };
  }

  /**
   * Generate CLAUDE.md content
   */
  generateClaudeMd(analysis: ProjectAnalysis): string {
    const { structure, patterns, conventions } = analysis;

    const lines: string[] = ['# Project Guide', ''];

    // Tech summary
    lines.push('## Architecture', '');
    lines.push(`- **Pattern**: ${patterns.pattern}`);
    lines.push(`- **Naming Convention**: ${conventions.namingConvention}`);
    lines.push(`- **Module System**: ${conventions.moduleSystem}`);
    lines.push(`- **Test Location**: ${conventions.testLocation}`);
    lines.push('');

    // Directory structure
    lines.push('## Key Directories', '');
    const topDirs =
      structure.root.children?.filter((c) => c.type === 'directory').slice(0, 10) || [];
    for (const dir of topDirs) {
      lines.push(`- \`${dir.name}/\` - ${this.inferDirPurpose(dir.name)}`);
    }
    lines.push('');

    // Conventions
    lines.push('## Conventions', '');
    if (conventions.hasIndexFiles) {
      lines.push('- Use index files for module exports');
    }
    if (conventions.hasTestFiles) {
      lines.push(`- Tests are ${conventions.testLocation === 'separate' ? 'in separate test directory' : 'colocated with source files'}`);
    }
    lines.push('');

    // Recommendations
    if (analysis.recommendations.length > 0) {
      lines.push('## Notes', '');
      for (const rec of analysis.recommendations) {
        lines.push(`- ${rec}`);
      }
    }

    return lines.join('\n');
  }

  /**
   * Flatten directory structure to list of paths
   */
  private flattenPaths(entry: DirectoryEntry): DirectoryEntry[] {
    const result: DirectoryEntry[] = [entry];

    if (entry.children) {
      for (const child of entry.children) {
        result.push(...this.flattenPaths(child));
      }
    }

    return result;
  }

  /**
   * Detect common directory patterns
   */
  private detectCommonPatterns(root: DirectoryEntry): string[] {
    const patterns: string[] = [];
    const topDirs = root.children?.filter((c) => c.type === 'directory').map((c) => c.name) || [];

    if (topDirs.includes('src')) patterns.push('src-based');
    if (topDirs.includes('lib')) patterns.push('lib-based');
    if (topDirs.includes('app')) patterns.push('app-based');
    if (topDirs.includes('packages')) patterns.push('monorepo');
    if (topDirs.includes('components')) patterns.push('component-based');
    if (topDirs.includes('pages')) patterns.push('page-based');

    return patterns;
  }

  /**
   * Detect naming convention from file/dir names
   */
  private detectNamingConvention(names: string[]): ConventionAnalysis['namingConvention'] {
    const stats = {
      camelCase: 0,
      snake_case: 0,
      'kebab-case': 0,
      PascalCase: 0,
    };

    for (const name of names) {
      const baseName = name.replace(/\.[^.]+$/, ''); // Remove extension
      if (!baseName || baseName.length < 2) continue;

      if (baseName.includes('-')) stats['kebab-case']++;
      else if (baseName.includes('_')) stats['snake_case']++;
      else if (/^[A-Z]/.test(baseName)) stats['PascalCase']++;
      else if (/^[a-z]/.test(baseName) && /[A-Z]/.test(baseName)) stats['camelCase']++;
    }

    const max = Math.max(...Object.values(stats));
    if (max === 0) return 'mixed';

    for (const [convention, count] of Object.entries(stats)) {
      if (count === max) {
        return convention as ConventionAnalysis['namingConvention'];
      }
    }

    return 'mixed';
  }

  /**
   * Generate pattern-specific recommendations
   */
  private generatePatternRecommendations(
    pattern: ArchitecturePattern,
    _structure: DirectoryStructure
  ): string[] {
    const recommendations: string[] = [];

    switch (pattern) {
      case 'mvc':
        recommendations.push('Keep controllers thin, move business logic to services');
        recommendations.push('Consider using DTOs for data transfer');
        break;
      case 'layered':
        recommendations.push('Maintain strict layer dependencies (upper layers depend on lower)');
        recommendations.push('Use interfaces for cross-layer communication');
        break;
      case 'modular':
        recommendations.push('Keep modules loosely coupled');
        recommendations.push('Consider using a shared module for common utilities');
        break;
      case 'microservices':
        recommendations.push('Ensure services are independently deployable');
        recommendations.push('Implement proper service discovery');
        break;
    }

    return recommendations;
  }

  /**
   * Generate overall recommendations
   */
  private generateRecommendations(
    structure: DirectoryStructure,
    metrics: CodeMetrics,
    patterns: PatternDetection,
    conventions: ConventionAnalysis
  ): string[] {
    const recommendations: string[] = [];

    // Large file warnings
    for (const file of metrics.largestFiles.slice(0, 3)) {
      if (file.lines > 500) {
        recommendations.push(`Consider splitting ${file.path} (${file.lines} lines)`);
      }
    }

    // Test recommendations
    if (!conventions.hasTestFiles) {
      recommendations.push('Add tests to improve code quality');
    }

    // Pattern confidence
    if (patterns.confidence < 0.5 && patterns.pattern !== 'unknown') {
      recommendations.push(
        `Architecture pattern (${patterns.pattern}) is not strongly defined, consider clarifying structure`
      );
    }

    // Extension diversity
    const extCount = Object.keys(structure.filesByExtension).length;
    if (extCount > 15) {
      recommendations.push('Many file types detected, consider consolidating tech stack');
    }

    return recommendations;
  }

  /**
   * Infer directory purpose from name
   */
  private inferDirPurpose(name: string): string {
    const purposes: Record<string, string> = {
      src: 'Source code',
      lib: 'Library code',
      app: 'Application code',
      components: 'UI components',
      pages: 'Page components',
      api: 'API routes',
      routes: 'Route handlers',
      services: 'Business logic services',
      utils: 'Utility functions',
      helpers: 'Helper functions',
      hooks: 'Custom hooks',
      types: 'Type definitions',
      models: 'Data models',
      controllers: 'Request controllers',
      views: 'View templates',
      tests: 'Test files',
      __tests__: 'Test files',
      config: 'Configuration',
      public: 'Static assets',
      assets: 'Static assets',
      styles: 'Stylesheets',
      docs: 'Documentation',
    };

    return purposes[name.toLowerCase()] || 'Project files';
  }
}

// Singleton instance
let instance: CodeAnalyzer | null = null;

/**
 * Get the singleton CodeAnalyzer instance
 */
export function getCodeAnalyzer(): CodeAnalyzer {
  if (!instance) {
    instance = new CodeAnalyzer();
  }
  return instance;
}

/**
 * Reset the singleton (for testing)
 */
export function resetCodeAnalyzer(): void {
  instance = null;
}
