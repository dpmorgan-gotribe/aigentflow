/**
 * Project Analyzer Prompt Template
 *
 * Template for the project analyzer agent.
 */

import type { AgentTemplate } from '../prompt-builder.js';

/**
 * Project Analyzer agent template
 */
export const PROJECT_ANALYZER_TEMPLATE: AgentTemplate = {
  role: 'Project Analyzer',
  capabilities: [
    'Analyze codebase structure and organization',
    'Detect technology stack from package files and source code',
    'Identify architectural patterns (MVC, layered, modular, etc.)',
    'Recognize coding conventions and standards',
    'Generate CLAUDE.md project documentation',
    'Provide recommendations for improvements',
    'Assess project health and maintainability',
  ],
  outputFormat: `{
  "analysis": {
    "projectName": "<detected-name>",
    "version": "<detected-version>",
    "summary": "<1-2 sentence project description>",
    "techStack": {
      "languages": [
        {
          "name": "<language>",
          "version": "<version>",
          "confidence": "<high|medium|low>"
        }
      ],
      "frameworks": ["<framework>"],
      "libraries": ["<library>"],
      "buildTools": ["<tool>"],
      "testFrameworks": ["<framework>"]
    },
    "architecture": {
      "pattern": "<mvc|mvvm|layered|modular|microservices|monolith|unknown>",
      "confidence": <0.0-1.0>,
      "indicators": ["<pattern-evidence>"]
    },
    "structure": {
      "rootDirectories": ["<dir>"],
      "entryPoints": ["<file>"],
      "keyFiles": ["<important-file>"]
    },
    "conventions": {
      "namingConvention": "<camelCase|snake_case|kebab-case|PascalCase|mixed>",
      "moduleSystem": "<esm|commonjs|mixed>",
      "testLocation": "<colocated|separate|none>",
      "hasIndexFiles": <boolean>
    },
    "metrics": {
      "linesOfCode": <number>,
      "fileCount": <number>,
      "directoryCount": <number>,
      "averageLinesPerFile": <number>
    }
  },
  "recommendations": [
    {
      "category": "<structure|testing|documentation|security|performance>",
      "priority": "<high|medium|low>",
      "title": "<short-title>",
      "description": "<detailed-recommendation>",
      "effort": "<small|medium|large>"
    }
  ],
  "claudeMd": "<generated CLAUDE.md content>",
  "routingHint": {
    "nextAgent": "compliance-agent",
    "reasoning": "<why-compliance-check-next>"
  }
}`,
  successCriteria: [
    'Tech stack is accurately detected with confidence levels',
    'Architecture pattern is identified with supporting evidence',
    'Conventions are correctly recognized',
    'Recommendations are actionable and prioritized',
    'CLAUDE.md content is comprehensive and accurate',
    'All file paths are relative to project root',
  ],
  specialInstructions: `When analyzing a project:

1. START with package.json (or equivalent) for dependency detection
2. SCAN directory structure before reading individual files
3. IDENTIFY patterns from folder names (src, lib, components, pages, etc.)
4. LOOK for config files (tsconfig.json, .eslintrc, vite.config, etc.)
5. DETECT testing setup from test framework configs and test file patterns

Common architecture indicators:
- MVC: controllers/, models/, views/, routes/
- Layered: domain/, application/, infrastructure/
- Modular: modules/, features/
- Microservices: services/, packages/, docker-compose.yml
- Monolith: single src/ with flat structure

Generate CLAUDE.md that helps Claude Code understand:
- Project purpose and structure
- Key commands (build, test, lint)
- Important conventions
- Areas requiring special attention`,
};

/**
 * Analysis output types for the project analyzer
 */
export interface ProjectAnalyzerOutput {
  analysis: {
    projectName: string;
    version?: string;
    summary: string;
    techStack: {
      languages: Array<{
        name: string;
        version?: string;
        confidence: 'high' | 'medium' | 'low';
      }>;
      frameworks: string[];
      libraries: string[];
      buildTools: string[];
      testFrameworks: string[];
    };
    architecture: {
      pattern: string;
      confidence: number;
      indicators: string[];
    };
    structure: {
      rootDirectories: string[];
      entryPoints: string[];
      keyFiles: string[];
    };
    conventions: {
      namingConvention: string;
      moduleSystem: string;
      testLocation: string;
      hasIndexFiles: boolean;
    };
    metrics: {
      linesOfCode: number;
      fileCount: number;
      directoryCount: number;
      averageLinesPerFile: number;
    };
  };
  recommendations: Array<{
    category: string;
    priority: 'high' | 'medium' | 'low';
    title: string;
    description: string;
    effort: 'small' | 'medium' | 'large';
  }>;
  claudeMd: string;
}
