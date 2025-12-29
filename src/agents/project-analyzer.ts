/**
 * Project Analyzer Agent
 *
 * Analyzes codebases to detect tech stack, patterns, and generate CLAUDE.md.
 */

import { BaseAgent } from './base-agent.js';
import type {
  AgentMetadata,
  AgentRequest,
  AgentResult,
  AgentExecutionOptions,
  ExecutionContext,
  AgentType,
} from './types.js';
import { getTechDetector, type TechStackResult } from '../analysis/tech-detector.js';
import { getCodeAnalyzer, type ProjectAnalysis } from '../analysis/code-analyzer.js';
import type { ProjectAnalyzerOutput } from '../prompts/templates/project-analyzer.js';

/**
 * Project Analyzer agent for codebase analysis
 */
export class ProjectAnalyzerAgent extends BaseAgent {
  readonly metadata: AgentMetadata = {
    type: 'project-analyzer',
    name: 'Project Analyzer',
    description: 'Analyzes codebases to detect tech stack, patterns, and generate documentation',
    phase: 'v1.0',
    defaultConfig: {
      enabled: true,
      maxConcurrent: 2,
      timeout: 120000, // 2 minutes for large projects
      retryCount: 2,
    },
    capabilities: [
      'tech-detection',
      'pattern-recognition',
      'convention-analysis',
      'claude-md-generation',
      'recommendation-generation',
    ],
    validStates: ['IDLE', 'ANALYZING', 'ORCHESTRATING'],
  };

  private techDetector = getTechDetector();
  private codeAnalyzer = getCodeAnalyzer();

  /**
   * Execute the project analyzer agent
   */
  protected async executeCore(
    request: AgentRequest,
    _options: Required<AgentExecutionOptions>
  ): Promise<AgentResult> {
    const startTime = Date.now();
    const { context } = request;

    const projectPath = context.projectConfig.path;

    this.log.info('Analyzing project', {
      projectPath,
      projectName: context.projectConfig.name,
    });

    try {
      // Run tech detection and code analysis in parallel
      const [techStack, projectAnalysis] = await Promise.all([
        this.techDetector.detect(projectPath),
        this.codeAnalyzer.analyzeProject(projectPath),
      ]);

      // Build output
      const output = this.buildOutput(techStack, projectAnalysis, context);

      // Determine next agent
      const nextAgent = this.determineNextAgent(context);

      this.log.info('Project analysis complete', {
        techCount: techStack.summary.techCount,
        pattern: projectAnalysis.patterns.pattern,
        recommendationCount: output.recommendations.length,
        nextAgent,
      });

      return this.createSuccessResult(
        output,
        startTime,
        800, // Estimated tokens
        0,
        {
          nextAgent,
          reasoning: 'Project analysis complete, proceeding to compliance check',
        }
      );
    } catch (error) {
      this.log.error('Project analysis failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Build output from analysis results
   */
  private buildOutput(
    techStack: TechStackResult,
    projectAnalysis: ProjectAnalysis,
    context: ExecutionContext
  ): ProjectAnalyzerOutput {
    const { structure, metrics, patterns, conventions } = projectAnalysis;

    // Build tech stack output
    const techStackOutput = {
      languages: techStack.languages.map((l) => ({
        name: l.name,
        version: l.version,
        confidence: l.confidence,
      })),
      frameworks: techStack.frameworks.map((f) => f.name),
      libraries: techStack.techs
        .filter((t) => t.category === 'library')
        .map((l) => l.name),
      buildTools: techStack.buildTools.map((b) => b.name),
      testFrameworks: techStack.testFrameworks.map((t) => t.name),
    };

    // Build structure output
    const rootDirectories =
      structure.root.children
        ?.filter((c) => c.type === 'directory')
        .map((d) => d.name)
        .slice(0, 10) || [];

    const entryPoints = this.detectEntryPoints(structure);
    const keyFiles = this.detectKeyFiles(structure);

    // Build recommendations
    const recommendations = this.buildRecommendations(
      techStack,
      projectAnalysis,
      context
    );

    // Generate CLAUDE.md
    const claudeMd = this.codeAnalyzer.generateClaudeMd(projectAnalysis);

    return {
      analysis: {
        projectName: context.projectConfig.name,
        version: context.projectConfig.version,
        summary: this.generateSummary(techStack, patterns),
        techStack: techStackOutput,
        architecture: {
          pattern: patterns.pattern,
          confidence: patterns.confidence,
          indicators: patterns.indicators,
        },
        structure: {
          rootDirectories,
          entryPoints,
          keyFiles,
        },
        conventions: {
          namingConvention: conventions.namingConvention,
          moduleSystem: conventions.moduleSystem,
          testLocation: conventions.testLocation,
          hasIndexFiles: conventions.hasIndexFiles,
        },
        metrics: {
          linesOfCode: metrics.linesOfCode,
          fileCount: metrics.fileCount,
          directoryCount: structure.totalDirectories,
          averageLinesPerFile: metrics.averageLinesPerFile,
        },
      },
      recommendations,
      claudeMd,
    };
  }

  /**
   * Generate project summary
   */
  private generateSummary(
    techStack: TechStackResult,
    patterns: ProjectAnalysis['patterns']
  ): string {
    const { summary } = techStack;

    const parts: string[] = [];

    if (summary.primaryLanguage) {
      parts.push(`${summary.primaryLanguage} project`);
    }

    if (summary.primaryFramework) {
      parts.push(`using ${summary.primaryFramework}`);
    }

    if (patterns.pattern !== 'unknown') {
      parts.push(`with ${patterns.pattern} architecture`);
    }

    if (summary.hasTests) {
      parts.push('(includes tests)');
    }

    return parts.join(' ') || 'Software project';
  }

  /**
   * Detect entry point files
   */
  private detectEntryPoints(structure: ProjectAnalysis['structure']): string[] {
    const entryPoints: string[] = [];
    const entryPatterns = [
      'index.ts',
      'index.js',
      'main.ts',
      'main.js',
      'app.ts',
      'app.js',
      'server.ts',
      'server.js',
      'cli.ts',
      'cli.js',
    ];

    const allFiles = this.flattenFiles(structure.root);

    for (const pattern of entryPatterns) {
      const match = allFiles.find(
        (f) => f.name === pattern || f.path.endsWith(`/src/${pattern}`)
      );
      if (match) {
        entryPoints.push(match.path);
      }
    }

    return entryPoints.slice(0, 5);
  }

  /**
   * Detect key files in the project
   */
  private detectKeyFiles(structure: ProjectAnalysis['structure']): string[] {
    const keyFiles: string[] = [];
    const keyPatterns = [
      'package.json',
      'tsconfig.json',
      'README.md',
      '.eslintrc',
      '.prettierrc',
      'vitest.config.ts',
      'jest.config.js',
      'Dockerfile',
      'docker-compose.yml',
    ];

    const allFiles = this.flattenFiles(structure.root);

    for (const pattern of keyPatterns) {
      const match = allFiles.find((f) => f.name === pattern || f.name.includes(pattern));
      if (match) {
        keyFiles.push(match.path);
      }
    }

    return keyFiles;
  }

  /**
   * Flatten directory structure to list of files
   */
  private flattenFiles(
    entry: ProjectAnalysis['structure']['root']
  ): Array<{ name: string; path: string }> {
    const files: Array<{ name: string; path: string }> = [];

    if (entry.type === 'file') {
      files.push({ name: entry.name, path: entry.path });
    }

    if (entry.children) {
      for (const child of entry.children) {
        files.push(...this.flattenFiles(child));
      }
    }

    return files;
  }

  /**
   * Build recommendations from analysis
   */
  private buildRecommendations(
    techStack: TechStackResult,
    projectAnalysis: ProjectAnalysis,
    context: ExecutionContext
  ): ProjectAnalyzerOutput['recommendations'] {
    const recommendations: ProjectAnalyzerOutput['recommendations'] = [];

    // Add pattern recommendations
    for (const rec of projectAnalysis.patterns.recommendations) {
      recommendations.push({
        category: 'structure',
        priority: 'medium',
        title: 'Architecture',
        description: rec,
        effort: 'medium',
      });
    }

    // Add general recommendations
    for (const rec of projectAnalysis.recommendations) {
      const category = this.categorizeRecommendation(rec);
      recommendations.push({
        category,
        priority: rec.toLowerCase().includes('split') ? 'medium' : 'low',
        title: this.extractTitle(rec),
        description: rec,
        effort: 'small',
      });
    }

    // Testing recommendation if no tests
    if (!techStack.summary.hasTests) {
      recommendations.push({
        category: 'testing',
        priority: 'high',
        title: 'Add Tests',
        description: 'No test framework detected. Add tests to improve code quality and prevent regressions.',
        effort: 'large',
      });
    }

    // TypeScript recommendation if JS only
    if (!techStack.summary.hasTypeScript && techStack.languages.some((l) => l.name === 'JavaScript')) {
      recommendations.push({
        category: 'structure',
        priority: 'medium',
        title: 'Consider TypeScript',
        description: 'Project uses JavaScript. Consider migrating to TypeScript for better type safety.',
        effort: 'large',
      });
    }

    // CI/CD recommendation
    if (!techStack.summary.hasCICD) {
      recommendations.push({
        category: 'structure',
        priority: 'medium',
        title: 'Add CI/CD',
        description: 'No CI/CD configuration detected. Add automated testing and deployment.',
        effort: 'medium',
      });
    }

    // Docker recommendation for larger projects
    if (!techStack.summary.hasDocker && projectAnalysis.metrics.fileCount > 20) {
      recommendations.push({
        category: 'structure',
        priority: 'low',
        title: 'Consider Containerization',
        description: 'Add Docker support for consistent development and deployment environments.',
        effort: 'medium',
      });
    }

    // Compliance recommendations
    if (context.projectConfig.compliance.frameworks.length > 0) {
      recommendations.push({
        category: 'security',
        priority: 'high',
        title: 'Compliance Review',
        description: `Project requires ${context.projectConfig.compliance.frameworks.join(', ')} compliance. Run compliance agent for detailed checks.`,
        effort: 'medium',
      });
    }

    return recommendations.slice(0, 10); // Limit to 10 recommendations
  }

  /**
   * Categorize a recommendation
   */
  private categorizeRecommendation(rec: string): string {
    const lower = rec.toLowerCase();
    if (lower.includes('test')) return 'testing';
    if (lower.includes('security') || lower.includes('auth')) return 'security';
    if (lower.includes('doc')) return 'documentation';
    if (lower.includes('perform') || lower.includes('optim')) return 'performance';
    return 'structure';
  }

  /**
   * Extract title from recommendation
   */
  private extractTitle(rec: string): string {
    // Extract first few words as title
    const words = rec.split(' ').slice(0, 3).join(' ');
    return words.length > 30 ? words.substring(0, 30) + '...' : words;
  }

  /**
   * Determine next agent
   */
  private determineNextAgent(context: ExecutionContext): AgentType {
    // If compliance frameworks are configured, go to compliance agent
    if (context.projectConfig.compliance.frameworks.length > 0) {
      return 'compliance-agent';
    }

    // Otherwise, go to architect for design decisions
    return 'architect';
  }

  /**
   * Check if agent can handle task
   */
  canHandle(taskType: string, _context: ExecutionContext): boolean {
    return ['analyze-project', 'detect-tech', 'generate-docs'].includes(taskType);
  }
}

/**
 * Factory function for project analyzer agent
 */
export function createProjectAnalyzerAgent(): ProjectAnalyzerAgent {
  return new ProjectAnalyzerAgent();
}
