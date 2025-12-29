# Step 05e: Project Analyzer Agent

> **Checkpoint:** CP1 - Design System
> **Previous Step:** 05d-ANALYST-AGENT.md
> **Next Step:** 05f-COMPLIANCE-AGENT.md

---

## Overview

The **Project Analyzer Agent** analyzes existing codebases to understand their structure, patterns, tech stack, and architecture. This agent is essential for the `aigentflow init --import` workflow where users want to work with existing projects.

Key responsibilities:
- Analyze directory structure and identify key directories
- Detect technology stack from package files and code
- Identify coding patterns and architecture style
- Detect compliance-relevant code (auth, data handling)
- Generate CLAUDE.md and architecture documentation
- Provide recommendations for improvements

---

## Deliverables

1. `src/agents/agents/project-analyzer.ts` - Project Analyzer agent implementation
2. `src/agents/schemas/project-analyzer-output.ts` - Output schema
3. `src/analysis/code-analyzer.ts` - Code analysis utilities
4. `src/analysis/pattern-detector.ts` - Pattern detection

---

## 1. Output Schema (`src/agents/schemas/project-analyzer-output.ts`)

```typescript
/**
 * Project Analyzer Output Schema
 */

import { z } from 'zod';
import { AgentType } from '../types';

/**
 * Detected language
 */
export const DetectedLanguageSchema = z.object({
  name: z.string(),
  percentage: z.number(),
  files: z.number(),
  lines: z.number(),
  primary: z.boolean(),
});

export type DetectedLanguage = z.infer<typeof DetectedLanguageSchema>;

/**
 * Detected framework
 */
export const DetectedFrameworkSchema = z.object({
  name: z.string(),
  version: z.string().optional(),
  type: z.enum(['frontend', 'backend', 'fullstack', 'testing', 'build', 'utility']),
  confidence: z.number().min(0).max(1),
  evidence: z.array(z.string()),
});

export type DetectedFramework = z.infer<typeof DetectedFrameworkSchema>;

/**
 * Directory analysis
 */
export const DirectoryAnalysisSchema = z.object({
  path: z.string(),
  purpose: z.string(),
  fileCount: z.number(),
  patterns: z.array(z.string()),
  technologies: z.array(z.string()),
  importance: z.enum(['critical', 'high', 'medium', 'low']),
});

export type DirectoryAnalysis = z.infer<typeof DirectoryAnalysisSchema>;

/**
 * Detected pattern
 */
export const DetectedPatternSchema = z.object({
  name: z.string(),
  category: z.enum(['architecture', 'design', 'testing', 'state', 'api', 'data']),
  description: z.string(),
  locations: z.array(z.string()),
  confidence: z.number().min(0).max(1),
});

export type DetectedPattern = z.infer<typeof DetectedPatternSchema>;

/**
 * Code quality indicators
 */
export const CodeQualitySchema = z.object({
  hasTests: z.boolean(),
  testCoverage: z.string().optional(),
  hasLinting: z.boolean(),
  hasTypeChecking: z.boolean(),
  hasDocumentation: z.boolean(),
  hasCI: z.boolean(),
  hasSecurity: z.boolean(),
  issues: z.array(z.object({
    type: z.enum(['warning', 'error', 'suggestion']),
    message: z.string(),
    location: z.string().optional(),
  })),
});

export type CodeQuality = z.infer<typeof CodeQualitySchema>;

/**
 * Compliance indicators
 */
export const ComplianceIndicatorsSchema = z.object({
  handlesPersonalData: z.boolean(),
  hasAuthentication: z.boolean(),
  hasAuthorization: z.boolean(),
  hasAuditLogging: z.boolean(),
  hasEncryption: z.boolean(),
  hasSensitiveData: z.boolean(),
  locations: z.record(z.string(), z.array(z.string())),
});

export type ComplianceIndicators = z.infer<typeof ComplianceIndicatorsSchema>;

/**
 * Entry point
 */
export const EntryPointSchema = z.object({
  path: z.string(),
  type: z.enum(['application', 'library', 'cli', 'api', 'worker']),
  description: z.string(),
});

export type EntryPoint = z.infer<typeof EntryPointSchema>;

/**
 * Dependency analysis
 */
export const DependencyAnalysisSchema = z.object({
  total: z.number(),
  production: z.number(),
  development: z.number(),
  outdated: z.array(z.object({
    name: z.string(),
    current: z.string(),
    latest: z.string(),
    type: z.enum(['major', 'minor', 'patch']),
  })),
  vulnerabilities: z.array(z.object({
    name: z.string(),
    severity: z.enum(['low', 'medium', 'high', 'critical']),
    description: z.string(),
  })),
});

export type DependencyAnalysis = z.infer<typeof DependencyAnalysisSchema>;

/**
 * Recommendation
 */
export const AnalysisRecommendationSchema = z.object({
  category: z.enum(['architecture', 'security', 'testing', 'performance', 'maintainability', 'documentation']),
  priority: z.enum(['critical', 'high', 'medium', 'low']),
  title: z.string(),
  description: z.string(),
  effort: z.string(),
});

export type AnalysisRecommendation = z.infer<typeof AnalysisRecommendationSchema>;

/**
 * Complete project analyzer output
 */
export const ProjectAnalyzerOutputSchema = z.object({
  projectName: z.string(),
  projectType: z.enum(['web-app', 'api', 'library', 'cli', 'monorepo', 'mobile', 'desktop', 'unknown']),

  techStack: z.object({
    languages: z.array(DetectedLanguageSchema),
    frameworks: z.array(DetectedFrameworkSchema),
    databases: z.array(z.string()),
    infrastructure: z.array(z.string()),
  }),

  structure: z.object({
    rootDirectories: z.array(DirectoryAnalysisSchema),
    entryPoints: z.array(EntryPointSchema),
    configFiles: z.array(z.string()),
    totalFiles: z.number(),
    totalLines: z.number(),
  }),

  architecture: z.object({
    pattern: z.string(),
    apiStyle: z.string().optional(),
    stateManagement: z.string().optional(),
    dataFlow: z.string(),
  }),

  patterns: z.array(DetectedPatternSchema),

  codeQuality: CodeQualitySchema,

  complianceIndicators: ComplianceIndicatorsSchema,

  dependencies: DependencyAnalysisSchema,

  recommendations: z.array(AnalysisRecommendationSchema),

  generatedContext: z.object({
    claudeMd: z.string(),
    architectureYaml: z.string(),
  }),

  routingHints: z.object({
    suggestNext: z.array(z.nativeEnum(AgentType)),
    skipAgents: z.array(z.nativeEnum(AgentType)),
    needsApproval: z.boolean(),
    hasFailures: z.boolean(),
    isComplete: z.boolean(),
    notes: z.string().optional(),
  }),
});

export type ProjectAnalyzerOutput = z.infer<typeof ProjectAnalyzerOutputSchema>;
```

---

## 2. Code Analyzer (`src/analysis/code-analyzer.ts`)

```typescript
/**
 * Code Analyzer
 *
 * Analyzes source code for patterns, structure, and quality.
 */

import fs from 'fs';
import path from 'path';
import {
  DetectedLanguage,
  DetectedFramework,
  DirectoryAnalysis,
  CodeQuality,
} from '../agents/schemas/project-analyzer-output';

/**
 * Language detection rules
 */
const LANGUAGE_EXTENSIONS: Record<string, string> = {
  '.ts': 'TypeScript',
  '.tsx': 'TypeScript',
  '.js': 'JavaScript',
  '.jsx': 'JavaScript',
  '.py': 'Python',
  '.go': 'Go',
  '.rs': 'Rust',
  '.java': 'Java',
  '.rb': 'Ruby',
  '.php': 'PHP',
  '.cs': 'C#',
  '.cpp': 'C++',
  '.c': 'C',
  '.swift': 'Swift',
  '.kt': 'Kotlin',
};

/**
 * Framework detection rules
 */
interface FrameworkRule {
  name: string;
  type: 'frontend' | 'backend' | 'fullstack' | 'testing' | 'build' | 'utility';
  indicators: string[];
  packageIndicators?: string[];
}

const FRAMEWORK_RULES: FrameworkRule[] = [
  { name: 'React', type: 'frontend', indicators: ['react-dom', 'jsx', 'tsx'], packageIndicators: ['react'] },
  { name: 'Vue', type: 'frontend', indicators: ['.vue'], packageIndicators: ['vue'] },
  { name: 'Angular', type: 'frontend', indicators: ['@angular'], packageIndicators: ['@angular/core'] },
  { name: 'Svelte', type: 'frontend', indicators: ['.svelte'], packageIndicators: ['svelte'] },
  { name: 'Next.js', type: 'fullstack', indicators: ['next.config', 'pages/', 'app/'], packageIndicators: ['next'] },
  { name: 'Express', type: 'backend', indicators: ['express()'], packageIndicators: ['express'] },
  { name: 'FastAPI', type: 'backend', indicators: ['FastAPI', '@app.get'], packageIndicators: ['fastapi'] },
  { name: 'Django', type: 'backend', indicators: ['django', 'manage.py'], packageIndicators: ['django'] },
  { name: 'NestJS', type: 'backend', indicators: ['@nestjs'], packageIndicators: ['@nestjs/core'] },
  { name: 'Jest', type: 'testing', indicators: ['jest.config'], packageIndicators: ['jest'] },
  { name: 'Vitest', type: 'testing', indicators: ['vitest.config'], packageIndicators: ['vitest'] },
  { name: 'Pytest', type: 'testing', indicators: ['pytest.ini', 'conftest.py'], packageIndicators: ['pytest'] },
];

/**
 * Code Analyzer class
 */
export class CodeAnalyzer {
  private projectRoot: string;
  private fileCache: Map<string, string[]> = new Map();

  constructor(projectRoot: string) {
    this.projectRoot = projectRoot;
  }

  /**
   * Analyze languages used in the project
   */
  analyzeLanguages(): DetectedLanguage[] {
    const languageStats: Map<string, { files: number; lines: number }> = new Map();
    let totalLines = 0;

    this.walkDirectory(this.projectRoot, (filePath) => {
      const ext = path.extname(filePath);
      const language = LANGUAGE_EXTENSIONS[ext];

      if (language) {
        const lines = this.countLines(filePath);
        totalLines += lines;

        const stats = languageStats.get(language) || { files: 0, lines: 0 };
        stats.files++;
        stats.lines += lines;
        languageStats.set(language, stats);
      }
    });

    // Convert to array and calculate percentages
    const languages: DetectedLanguage[] = [];
    let maxLines = 0;
    let primaryLanguage = '';

    for (const [name, stats] of languageStats) {
      const percentage = totalLines > 0 ? (stats.lines / totalLines) * 100 : 0;

      if (stats.lines > maxLines) {
        maxLines = stats.lines;
        primaryLanguage = name;
      }

      languages.push({
        name,
        percentage: Math.round(percentage * 10) / 10,
        files: stats.files,
        lines: stats.lines,
        primary: false,
      });
    }

    // Mark primary language
    const primary = languages.find(l => l.name === primaryLanguage);
    if (primary) primary.primary = true;

    return languages.sort((a, b) => b.percentage - a.percentage);
  }

  /**
   * Detect frameworks used
   */
  detectFrameworks(): DetectedFramework[] {
    const frameworks: DetectedFramework[] = [];
    const packageDeps = this.getPackageDependencies();

    for (const rule of FRAMEWORK_RULES) {
      const evidence: string[] = [];
      let confidence = 0;

      // Check package dependencies
      if (rule.packageIndicators) {
        for (const pkg of rule.packageIndicators) {
          if (packageDeps.has(pkg)) {
            evidence.push(`Found in package.json: ${pkg}`);
            confidence += 0.5;
          }
        }
      }

      // Check file indicators
      for (const indicator of rule.indicators) {
        if (this.hasIndicator(indicator)) {
          evidence.push(`Found indicator: ${indicator}`);
          confidence += 0.3;
        }
      }

      if (evidence.length > 0) {
        frameworks.push({
          name: rule.name,
          type: rule.type,
          confidence: Math.min(confidence, 1),
          evidence,
          version: packageDeps.get(rule.packageIndicators?.[0] || '') || undefined,
        });
      }
    }

    return frameworks.sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * Analyze directory structure
   */
  analyzeDirectories(): DirectoryAnalysis[] {
    const directories: DirectoryAnalysis[] = [];
    const rootEntries = fs.readdirSync(this.projectRoot, { withFileTypes: true });

    for (const entry of rootEntries) {
      if (!entry.isDirectory()) continue;
      if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;

      const dirPath = path.join(this.projectRoot, entry.name);
      const analysis = this.analyzeDirectory(dirPath, entry.name);
      directories.push(analysis);
    }

    return directories;
  }

  /**
   * Analyze a single directory
   */
  private analyzeDirectory(dirPath: string, relativePath: string): DirectoryAnalysis {
    let fileCount = 0;
    const patterns: Set<string> = new Set();
    const technologies: Set<string> = new Set();

    this.walkDirectory(dirPath, (filePath) => {
      fileCount++;
      const ext = path.extname(filePath);
      const basename = path.basename(filePath, ext);

      // Detect patterns
      if (basename.endsWith('.test') || basename.endsWith('.spec')) patterns.add('tests');
      if (basename.endsWith('.stories')) patterns.add('storybook');
      if (basename.includes('component')) patterns.add('components');
      if (basename.includes('hook') || basename.startsWith('use')) patterns.add('hooks');
      if (basename.includes('service')) patterns.add('services');
      if (basename.includes('util')) patterns.add('utilities');

      // Detect technologies
      if (LANGUAGE_EXTENSIONS[ext]) {
        technologies.add(LANGUAGE_EXTENSIONS[ext]);
      }
    });

    return {
      path: relativePath,
      purpose: this.inferPurpose(relativePath, Array.from(patterns)),
      fileCount,
      patterns: Array.from(patterns),
      technologies: Array.from(technologies),
      importance: this.assessImportance(relativePath),
    };
  }

  /**
   * Analyze code quality
   */
  analyzeQuality(): CodeQuality {
    const issues: CodeQuality['issues'] = [];

    const hasTests = fs.existsSync(path.join(this.projectRoot, 'tests')) ||
                     fs.existsSync(path.join(this.projectRoot, '__tests__')) ||
                     fs.existsSync(path.join(this.projectRoot, 'test'));

    const hasLinting = fs.existsSync(path.join(this.projectRoot, '.eslintrc.js')) ||
                       fs.existsSync(path.join(this.projectRoot, '.eslintrc.json')) ||
                       fs.existsSync(path.join(this.projectRoot, 'eslint.config.js'));

    const hasTypeChecking = fs.existsSync(path.join(this.projectRoot, 'tsconfig.json'));

    const hasDocumentation = fs.existsSync(path.join(this.projectRoot, 'README.md')) ||
                             fs.existsSync(path.join(this.projectRoot, 'docs'));

    const hasCI = fs.existsSync(path.join(this.projectRoot, '.github', 'workflows')) ||
                  fs.existsSync(path.join(this.projectRoot, '.gitlab-ci.yml'));

    const hasSecurity = fs.existsSync(path.join(this.projectRoot, '.snyk')) ||
                        this.hasPackage('snyk') || this.hasPackage('@snyk/protect');

    // Generate issues based on findings
    if (!hasTests) {
      issues.push({
        type: 'warning',
        message: 'No test directory found. Consider adding tests.',
      });
    }

    if (!hasLinting) {
      issues.push({
        type: 'suggestion',
        message: 'No ESLint configuration found. Consider adding linting.',
      });
    }

    if (!hasCI) {
      issues.push({
        type: 'suggestion',
        message: 'No CI/CD configuration found. Consider adding automated builds.',
      });
    }

    return {
      hasTests,
      hasLinting,
      hasTypeChecking,
      hasDocumentation,
      hasCI,
      hasSecurity,
      issues,
    };
  }

  /**
   * Get package dependencies
   */
  private getPackageDependencies(): Map<string, string> {
    const deps = new Map<string, string>();
    const packagePath = path.join(this.projectRoot, 'package.json');

    if (fs.existsSync(packagePath)) {
      const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf-8'));
      const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };

      for (const [name, version] of Object.entries(allDeps)) {
        deps.set(name, String(version).replace(/[\^~]/g, ''));
      }
    }

    return deps;
  }

  /**
   * Check if a package is installed
   */
  private hasPackage(name: string): boolean {
    return this.getPackageDependencies().has(name);
  }

  /**
   * Check if project has an indicator
   */
  private hasIndicator(indicator: string): boolean {
    // Check if it's a file path
    if (indicator.includes('/') || indicator.includes('.')) {
      return fs.existsSync(path.join(this.projectRoot, indicator));
    }

    // Check in source files
    let found = false;
    this.walkDirectory(this.projectRoot, (filePath) => {
      if (found) return;
      const ext = path.extname(filePath);
      if (!['.ts', '.tsx', '.js', '.jsx', '.py'].includes(ext)) return;

      const content = fs.readFileSync(filePath, 'utf-8');
      if (content.includes(indicator)) {
        found = true;
      }
    });

    return found;
  }

  /**
   * Walk directory recursively
   */
  private walkDirectory(dir: string, callback: (filePath: string) => void): void {
    if (!fs.existsSync(dir)) return;

    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;

      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        this.walkDirectory(fullPath, callback);
      } else if (entry.isFile()) {
        callback(fullPath);
      }
    }
  }

  /**
   * Count lines in a file
   */
  private countLines(filePath: string): number {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      return content.split('\n').length;
    } catch {
      return 0;
    }
  }

  /**
   * Infer directory purpose
   */
  private inferPurpose(dirName: string, patterns: string[]): string {
    const purposeMap: Record<string, string> = {
      src: 'Source code',
      lib: 'Library code',
      app: 'Application code',
      pages: 'Page components',
      components: 'UI components',
      hooks: 'Custom hooks',
      utils: 'Utility functions',
      services: 'Service layer',
      api: 'API routes',
      models: 'Data models',
      types: 'Type definitions',
      styles: 'Stylesheets',
      public: 'Static assets',
      assets: 'Asset files',
      config: 'Configuration',
      scripts: 'Build/utility scripts',
      docs: 'Documentation',
      tests: 'Test files',
      __tests__: 'Test files',
    };

    return purposeMap[dirName.toLowerCase()] || 'Project files';
  }

  /**
   * Assess directory importance
   */
  private assessImportance(dirName: string): 'critical' | 'high' | 'medium' | 'low' {
    const criticalDirs = ['src', 'app', 'lib'];
    const highDirs = ['api', 'pages', 'components', 'services'];
    const mediumDirs = ['utils', 'hooks', 'types', 'models'];

    const name = dirName.toLowerCase();

    if (criticalDirs.includes(name)) return 'critical';
    if (highDirs.includes(name)) return 'high';
    if (mediumDirs.includes(name)) return 'medium';
    return 'low';
  }
}
```

---

## 3. Project Analyzer Agent (`src/agents/agents/project-analyzer.ts`)

```typescript
/**
 * Project Analyzer Agent
 *
 * Analyzes existing codebases to understand structure and patterns.
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
import { ProjectAnalyzerOutput } from '../schemas/project-analyzer-output';
import { CodeAnalyzer } from '../../analysis/code-analyzer';
import { ClaudeMdGenerator } from '../../context/claude-md-generator';
import { logger } from '../../utils/logger';
import path from 'path';

/**
 * Project Analyzer Agent implementation
 */
export class ProjectAnalyzerAgent extends BaseAgent {
  constructor() {
    super({
      id: AgentType.PROJECT_ANALYZER,
      name: 'Project Analyzer',
      description: 'Analyzes existing codebases to understand structure and patterns',
      version: '1.0.0',
      capabilities: [
        {
          name: 'codebase-analysis',
          description: 'Analyze project structure and tech stack',
          inputTypes: ['project-path'],
          outputTypes: ['analysis-report'],
        },
        {
          name: 'pattern-detection',
          description: 'Detect coding patterns and architecture',
          inputTypes: ['source-code'],
          outputTypes: ['patterns'],
        },
        {
          name: 'context-generation',
          description: 'Generate CLAUDE.md and architecture docs',
          inputTypes: ['analysis'],
          outputTypes: ['documentation'],
        },
      ],
      requiredContext: [
        { type: 'current_task', required: true },
      ],
      outputSchema: 'project-analyzer-output',
    });
  }

  /**
   * Build system prompt
   */
  protected buildSystemPrompt(context: AgentContext): string {
    return `You are the Project Analyzer agent responsible for understanding existing codebases.

Your responsibilities:
1. Analyze directory structure and identify key directories
2. Detect technology stack from package files and code patterns
3. Identify architectural patterns and coding conventions
4. Detect compliance-relevant code (authentication, data handling)
5. Generate recommendations for improvements

Analysis approach:
- Start with package files (package.json, requirements.txt, etc.)
- Examine directory structure for patterns
- Look at key files for architectural hints
- Check for testing, CI, and documentation
- Identify security and compliance concerns

Output must be valid JSON matching the ProjectAnalyzerOutput schema.`;
  }

  /**
   * Build user prompt
   */
  protected buildUserPrompt(request: AgentRequest): string {
    const task = request.context.task;

    // Get analysis data from pre-processing
    const analysisData = (request as any).analysisData;

    let prompt = `Analyze this project:\n\n`;

    if (analysisData) {
      prompt += `DETECTED INFORMATION:\n${JSON.stringify(analysisData, null, 2)}\n\n`;
    }

    prompt += `Based on this analysis, provide:\n`;
    prompt += `1. Complete tech stack assessment\n`;
    prompt += `2. Architecture pattern identification\n`;
    prompt += `3. Code quality assessment\n`;
    prompt += `4. Compliance indicators\n`;
    prompt += `5. Recommendations for improvement\n`;
    prompt += `6. Generated CLAUDE.md content\n`;

    return prompt;
  }

  /**
   * Execute with pre-analysis
   */
  async execute(request: AgentRequest): Promise<any> {
    // Get project root from task
    const projectRoot = request.context.task.projectRoot ||
                        request.context.items.find(i => i.type === 'project_config')?.content?.root ||
                        process.cwd();

    // Pre-analyze with code analyzer
    const analyzer = new CodeAnalyzer(projectRoot);
    const languages = analyzer.analyzeLanguages();
    const frameworks = analyzer.detectFrameworks();
    const directories = analyzer.analyzeDirectories();
    const quality = analyzer.analyzeQuality();

    // Attach analysis data to request
    (request as any).analysisData = {
      languages,
      frameworks,
      directories,
      quality,
    };

    // Continue with normal execution
    return super.execute(request);
  }

  /**
   * Parse LLM response
   */
  protected parseResponse(response: any): ProjectAnalyzerOutput {
    const text = this.extractTextContent(response);
    return this.parseJSON<ProjectAnalyzerOutput>(text);
  }

  /**
   * Process result
   */
  protected async processResult(
    parsed: ProjectAnalyzerOutput,
    request: AgentRequest
  ): Promise<{ result: ProjectAnalyzerOutput; artifacts: Artifact[] }> {
    const artifacts: Artifact[] = [];

    // Create CLAUDE.md artifact
    artifacts.push({
      id: this.generateArtifactId(),
      type: 'documentation',
      path: 'CLAUDE.md',
      content: parsed.generatedContext.claudeMd,
      metadata: { type: 'claude-md' },
    });

    // Create architecture.yaml artifact
    artifacts.push({
      id: this.generateArtifactId(),
      type: 'config_file',
      path: 'architecture.yaml',
      content: parsed.generatedContext.architectureYaml,
      metadata: { type: 'architecture' },
    });

    // Create analysis report
    artifacts.push({
      id: this.generateArtifactId(),
      type: 'report',
      path: 'docs/analysis-report.md',
      content: this.renderAnalysisReport(parsed),
      metadata: { type: 'analysis-report' },
    });

    return { result: parsed, artifacts };
  }

  /**
   * Generate routing hints
   */
  protected generateRoutingHints(
    result: ProjectAnalyzerOutput,
    artifacts: Artifact[],
    request: AgentRequest
  ): RoutingHints {
    const suggestNext: AgentType[] = [];

    // If compliance concerns, suggest compliance agent
    if (result.complianceIndicators.handlesPersonalData ||
        result.complianceIndicators.hasSensitiveData) {
      suggestNext.push(AgentType.COMPLIANCE_AGENT);
    }

    // If architecture needs work, suggest architect
    if (result.recommendations.some(r => r.category === 'architecture')) {
      suggestNext.push(AgentType.ARCHITECT);
    }

    return {
      suggestNext,
      skipAgents: [],
      needsApproval: false,
      hasFailures: false,
      isComplete: true,
      notes: `Analyzed ${result.structure.totalFiles} files across ${result.techStack.languages.length} languages`,
    };
  }

  /**
   * Render analysis report
   */
  private renderAnalysisReport(output: ProjectAnalyzerOutput): string {
    const lines: string[] = [];

    lines.push(`# Project Analysis Report: ${output.projectName}`);
    lines.push('');
    lines.push(`**Project Type:** ${output.projectType}`);
    lines.push(`**Total Files:** ${output.structure.totalFiles}`);
    lines.push(`**Total Lines:** ${output.structure.totalLines}`);
    lines.push('');

    lines.push('## Tech Stack');
    lines.push('');
    lines.push('### Languages');
    for (const lang of output.techStack.languages) {
      const primary = lang.primary ? ' (primary)' : '';
      lines.push(`- **${lang.name}**${primary}: ${lang.percentage}% (${lang.files} files)`);
    }
    lines.push('');

    lines.push('### Frameworks');
    for (const fw of output.techStack.frameworks) {
      lines.push(`- **${fw.name}** (${fw.type}): ${Math.round(fw.confidence * 100)}% confidence`);
    }
    lines.push('');

    lines.push('## Architecture');
    lines.push('');
    lines.push(`- **Pattern:** ${output.architecture.pattern}`);
    if (output.architecture.apiStyle) {
      lines.push(`- **API Style:** ${output.architecture.apiStyle}`);
    }
    lines.push(`- **Data Flow:** ${output.architecture.dataFlow}`);
    lines.push('');

    lines.push('## Code Quality');
    lines.push('');
    lines.push(`- Tests: ${output.codeQuality.hasTests ? 'Yes' : 'No'}`);
    lines.push(`- Linting: ${output.codeQuality.hasLinting ? 'Yes' : 'No'}`);
    lines.push(`- Type Checking: ${output.codeQuality.hasTypeChecking ? 'Yes' : 'No'}`);
    lines.push(`- CI/CD: ${output.codeQuality.hasCI ? 'Yes' : 'No'}`);
    lines.push('');

    if (output.recommendations.length > 0) {
      lines.push('## Recommendations');
      lines.push('');
      for (const rec of output.recommendations) {
        lines.push(`### [${rec.priority.toUpperCase()}] ${rec.title}`);
        lines.push(rec.description);
        lines.push(`**Effort:** ${rec.effort}`);
        lines.push('');
      }
    }

    return lines.join('\n');
  }
}
```

---

## Validation Checklist

```
□ Project Analyzer agent implemented
□ Output schema complete
□ Code analyzer works
  □ Language detection
  □ Framework detection
  □ Directory analysis
  □ Quality analysis
□ CLAUDE.md generation
□ Analysis report generation
□ All tests pass
```

---

## Next Step

Proceed to **05f-COMPLIANCE-AGENT.md** to implement the compliance agent.
