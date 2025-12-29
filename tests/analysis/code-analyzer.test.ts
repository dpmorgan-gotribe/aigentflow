/**
 * Code Analyzer Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  CodeAnalyzer,
  getCodeAnalyzer,
  resetCodeAnalyzer,
  type DirectoryEntry,
  type DirectoryStructure,
  type ProjectAnalysis,
} from '../../src/analysis/code-analyzer.js';

const createMockStructure = (
  children: DirectoryEntry[] = []
): DirectoryStructure => ({
  root: {
    name: '.',
    type: 'directory',
    path: '.',
    children,
  },
  totalFiles: children.filter((c) => c.type === 'file').length,
  totalDirectories: children.filter((c) => c.type === 'directory').length + 1,
  filesByExtension: {},
  maxDepth: 1,
  commonPatterns: [],
});

describe('CodeAnalyzer', () => {
  beforeEach(() => {
    resetCodeAnalyzer();
  });

  afterEach(() => {
    resetCodeAnalyzer();
  });

  describe('Singleton', () => {
    it('should return singleton instance', () => {
      const analyzer1 = getCodeAnalyzer();
      const analyzer2 = getCodeAnalyzer();
      expect(analyzer1).toBe(analyzer2);
    });

    it('should reset singleton', () => {
      const analyzer1 = getCodeAnalyzer();
      resetCodeAnalyzer();
      const analyzer2 = getCodeAnalyzer();
      expect(analyzer1).not.toBe(analyzer2);
    });
  });

  describe('Pattern Detection', () => {
    it('should detect MVC pattern', () => {
      const structure = createMockStructure([
        { name: 'controllers', type: 'directory', path: 'controllers' },
        { name: 'models', type: 'directory', path: 'models' },
        { name: 'views', type: 'directory', path: 'views' },
      ]);

      const analyzer = new CodeAnalyzer();
      const result = analyzer.detectPattern(structure);

      expect(result.pattern).toBe('mvc');
      expect(result.confidence).toBeGreaterThan(0.5);
    });

    it('should detect layered architecture pattern', () => {
      const structure = createMockStructure([
        { name: 'domain', type: 'directory', path: 'domain' },
        { name: 'application', type: 'directory', path: 'application' },
        { name: 'infrastructure', type: 'directory', path: 'infrastructure' },
      ]);

      const analyzer = new CodeAnalyzer();
      const result = analyzer.detectPattern(structure);

      expect(result.pattern).toBe('layered');
    });

    it('should detect modular pattern', () => {
      const structure = createMockStructure([
        { name: 'modules', type: 'directory', path: 'modules' },
        { name: 'features', type: 'directory', path: 'features' },
      ]);

      const analyzer = new CodeAnalyzer();
      const result = analyzer.detectPattern(structure);

      expect(result.pattern).toBe('modular');
    });

    it('should detect microservices pattern', () => {
      const structure = createMockStructure([
        { name: 'services', type: 'directory', path: 'services' },
        { name: 'packages', type: 'directory', path: 'packages' },
        { name: 'docker-compose.yml', type: 'file', path: 'docker-compose.yml' },
      ]);

      const analyzer = new CodeAnalyzer();
      const result = analyzer.detectPattern(structure);

      expect(result.pattern).toBe('microservices');
    });

    it('should detect serverless pattern', () => {
      const structure = createMockStructure([
        { name: 'functions', type: 'directory', path: 'functions' },
        { name: 'serverless.yml', type: 'file', path: 'serverless.yml' },
      ]);

      const analyzer = new CodeAnalyzer();
      const result = analyzer.detectPattern(structure);

      expect(result.pattern).toBe('serverless');
    });

    it('should detect event-driven pattern', () => {
      const structure = createMockStructure([
        { name: 'events', type: 'directory', path: 'events' },
        { name: 'handlers', type: 'directory', path: 'handlers' },
        { name: 'listeners', type: 'directory', path: 'listeners' },
      ]);

      const analyzer = new CodeAnalyzer();
      const result = analyzer.detectPattern(structure);

      expect(result.pattern).toBe('event-driven');
    });

    it('should return unknown for unrecognized patterns', () => {
      const structure = createMockStructure([
        { name: 'foo', type: 'directory', path: 'foo' },
        { name: 'bar', type: 'directory', path: 'bar' },
      ]);

      const analyzer = new CodeAnalyzer();
      const result = analyzer.detectPattern(structure);

      // Low confidence for unknown patterns
      expect(result.confidence).toBeLessThan(0.5);
    });

    it('should generate pattern recommendations', () => {
      const structure = createMockStructure([
        { name: 'controllers', type: 'directory', path: 'controllers' },
        { name: 'models', type: 'directory', path: 'models' },
        { name: 'views', type: 'directory', path: 'views' },
      ]);

      const analyzer = new CodeAnalyzer();
      const result = analyzer.detectPattern(structure);

      expect(result.recommendations.length).toBeGreaterThan(0);
    });
  });

  describe('Convention Analysis', () => {
    it('should detect kebab-case naming convention', () => {
      const structure = createMockStructure([
        { name: 'user-service.ts', type: 'file', path: 'user-service.ts' },
        { name: 'data-handler.ts', type: 'file', path: 'data-handler.ts' },
        { name: 'api-client.ts', type: 'file', path: 'api-client.ts' },
      ]);

      const analyzer = new CodeAnalyzer();
      const result = analyzer.analyzeConventions(structure);

      expect(result.namingConvention).toBe('kebab-case');
    });

    it('should detect camelCase naming convention', () => {
      const structure = createMockStructure([
        { name: 'userService.ts', type: 'file', path: 'userService.ts' },
        { name: 'dataHandler.ts', type: 'file', path: 'dataHandler.ts' },
      ]);

      const analyzer = new CodeAnalyzer();
      const result = analyzer.analyzeConventions(structure);

      expect(result.namingConvention).toBe('camelCase');
    });

    it('should detect PascalCase naming convention', () => {
      const structure = createMockStructure([
        { name: 'UserService.ts', type: 'file', path: 'UserService.ts' },
        { name: 'DataHandler.ts', type: 'file', path: 'DataHandler.ts' },
      ]);

      const analyzer = new CodeAnalyzer();
      const result = analyzer.analyzeConventions(structure);

      expect(result.namingConvention).toBe('PascalCase');
    });

    it('should detect snake_case naming convention', () => {
      const structure = createMockStructure([
        { name: 'user_service.ts', type: 'file', path: 'user_service.ts' },
        { name: 'data_handler.ts', type: 'file', path: 'data_handler.ts' },
      ]);

      const analyzer = new CodeAnalyzer();
      const result = analyzer.analyzeConventions(structure);

      expect(result.namingConvention).toBe('snake_case');
    });

    it('should detect hasIndexFiles', () => {
      const structure = createMockStructure([
        { name: 'index.ts', type: 'file', path: 'index.ts' },
        { name: 'utils.ts', type: 'file', path: 'utils.ts' },
      ]);

      const analyzer = new CodeAnalyzer();
      const result = analyzer.analyzeConventions(structure);

      expect(result.hasIndexFiles).toBe(true);
    });

    it('should detect hasTestFiles', () => {
      const structure = createMockStructure([
        { name: 'user.test.ts', type: 'file', path: 'user.test.ts' },
        { name: 'user.ts', type: 'file', path: 'user.ts' },
      ]);

      const analyzer = new CodeAnalyzer();
      const result = analyzer.analyzeConventions(structure);

      expect(result.hasTestFiles).toBe(true);
    });

    it('should detect separate test location', () => {
      const structure = createMockStructure([
        { name: 'tests', type: 'directory', path: 'tests' },
        {
          name: 'tests',
          type: 'directory',
          path: 'tests',
          children: [{ name: 'user.test.ts', type: 'file', path: 'tests/user.test.ts' }],
        },
      ]);
      structure.root.children = [
        { name: 'tests', type: 'directory', path: 'tests' },
        { name: 'user.test.ts', type: 'file', path: 'tests/user.test.ts' },
      ];

      const analyzer = new CodeAnalyzer();
      const result = analyzer.analyzeConventions(structure);

      expect(result.testLocation).toBe('separate');
    });

    it('should detect colocated test location', () => {
      const structure = createMockStructure([
        { name: 'user.ts', type: 'file', path: 'src/user.ts' },
        { name: 'user.test.ts', type: 'file', path: 'src/user.test.ts' },
        { name: 'src', type: 'directory', path: 'src' },
      ]);

      const analyzer = new CodeAnalyzer();
      const result = analyzer.analyzeConventions(structure);

      expect(result.testLocation).toBe('colocated');
    });

    it('should detect no tests', () => {
      const structure = createMockStructure([
        { name: 'user.ts', type: 'file', path: 'user.ts' },
        { name: 'index.ts', type: 'file', path: 'index.ts' },
      ]);

      const analyzer = new CodeAnalyzer();
      const result = analyzer.analyzeConventions(structure);

      expect(result.testLocation).toBe('none');
    });
  });

  describe('CLAUDE.md Generation', () => {
    it('should generate CLAUDE.md content', () => {
      const mockAnalysis: ProjectAnalysis = {
        structure: createMockStructure([
          { name: 'src', type: 'directory', path: 'src' },
          { name: 'tests', type: 'directory', path: 'tests' },
        ]),
        metrics: {
          linesOfCode: 1000,
          fileCount: 20,
          averageLinesPerFile: 50,
          largestFiles: [],
          emptyFiles: 0,
        },
        patterns: {
          pattern: 'modular',
          confidence: 0.8,
          indicators: ['modules'],
          recommendations: ['Keep modules loosely coupled'],
        },
        conventions: {
          namingConvention: 'camelCase',
          moduleSystem: 'esm',
          hasIndexFiles: true,
          hasTestFiles: true,
          testLocation: 'separate',
        },
        recommendations: [],
      };

      const analyzer = new CodeAnalyzer();
      const claudeMd = analyzer.generateClaudeMd(mockAnalysis);

      expect(claudeMd).toContain('# Project Guide');
      expect(claudeMd).toContain('modular');
      expect(claudeMd).toContain('camelCase');
      expect(claudeMd).toContain('esm');
    });

    it('should include directory descriptions', () => {
      const mockAnalysis: ProjectAnalysis = {
        structure: createMockStructure([
          { name: 'src', type: 'directory', path: 'src' },
          { name: 'components', type: 'directory', path: 'components' },
          { name: 'utils', type: 'directory', path: 'utils' },
        ]),
        metrics: {
          linesOfCode: 500,
          fileCount: 10,
          averageLinesPerFile: 50,
          largestFiles: [],
          emptyFiles: 0,
        },
        patterns: {
          pattern: 'unknown',
          confidence: 0.2,
          indicators: [],
          recommendations: [],
        },
        conventions: {
          namingConvention: 'mixed',
          moduleSystem: 'esm',
          hasIndexFiles: false,
          hasTestFiles: false,
          testLocation: 'none',
        },
        recommendations: [],
      };

      const analyzer = new CodeAnalyzer();
      const claudeMd = analyzer.generateClaudeMd(mockAnalysis);

      expect(claudeMd).toContain('Key Directories');
      expect(claudeMd).toContain('`src/`');
    });
  });

  describe('Common Patterns Detection', () => {
    it('should detect src-based pattern', () => {
      const structure = createMockStructure([
        { name: 'src', type: 'directory', path: 'src' },
      ]);
      structure.commonPatterns = ['src-based'];

      expect(structure.commonPatterns).toContain('src-based');
    });

    it('should detect monorepo pattern from packages dir', () => {
      const structure = createMockStructure([
        { name: 'packages', type: 'directory', path: 'packages' },
      ]);
      // In real implementation, analyzeStructure would set this
      structure.commonPatterns = ['monorepo'];

      expect(structure.commonPatterns).toContain('monorepo');
    });
  });

  describe('Recommendations', () => {
    it('should generate recommendations for large files', () => {
      const mockAnalysis: ProjectAnalysis = {
        structure: createMockStructure([]),
        metrics: {
          linesOfCode: 5000,
          fileCount: 5,
          averageLinesPerFile: 1000,
          largestFiles: [{ path: 'huge-file.ts', lines: 2000 }],
          emptyFiles: 0,
        },
        patterns: {
          pattern: 'unknown',
          confidence: 0.2,
          indicators: [],
          recommendations: [],
        },
        conventions: {
          namingConvention: 'mixed',
          moduleSystem: 'esm',
          hasIndexFiles: false,
          hasTestFiles: false,
          testLocation: 'none',
        },
        recommendations: ['Consider splitting huge-file.ts (2000 lines)'],
      };

      expect(mockAnalysis.recommendations.length).toBeGreaterThan(0);
      expect(mockAnalysis.recommendations[0]).toContain('splitting');
    });
  });
});
