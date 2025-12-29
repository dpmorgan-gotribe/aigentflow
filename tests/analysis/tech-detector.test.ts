/**
 * Tech Detector Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  TechDetector,
  getTechDetector,
  resetTechDetector,
  BUILT_IN_RULES,
  type DetectionContext,
  type PackageJsonData,
} from '../../src/analysis/tech-detector.js';

const createContext = (
  files: string[] = [],
  packageJson?: PackageJsonData
): DetectionContext => ({
  projectPath: '/test/project',
  files,
  packageJson,
  configFiles: new Map(),
});

describe('TechDetector', () => {
  beforeEach(() => {
    resetTechDetector();
  });

  afterEach(() => {
    resetTechDetector();
  });

  describe('Singleton', () => {
    it('should return singleton instance', () => {
      const detector1 = getTechDetector();
      const detector2 = getTechDetector();
      expect(detector1).toBe(detector2);
    });

    it('should reset singleton', () => {
      const detector1 = getTechDetector();
      resetTechDetector();
      const detector2 = getTechDetector();
      expect(detector1).not.toBe(detector2);
    });
  });

  describe('Language Detection', () => {
    it('should detect TypeScript from files', () => {
      const context = createContext(['src/index.ts', 'src/types.ts']);
      const detector = new TechDetector();
      const result = detector.detectFromContext(context);

      expect(result.languages).toHaveLength(1);
      expect(result.languages[0].name).toBe('TypeScript');
      expect(result.languages[0].confidence).toBe('high');
    });

    it('should detect TypeScript with version from package.json', () => {
      const context = createContext(['src/index.ts'], {
        devDependencies: { typescript: '^5.0.0' },
      });
      const detector = new TechDetector();
      const result = detector.detectFromContext(context);

      expect(result.languages[0].name).toBe('TypeScript');
      expect(result.languages[0].version).toBe('^5.0.0');
    });

    it('should detect JavaScript from files', () => {
      const context = createContext(['src/index.js', 'src/utils.mjs']);
      const detector = new TechDetector();
      const result = detector.detectFromContext(context);

      expect(result.languages.some((l) => l.name === 'JavaScript')).toBe(true);
    });

    it('should detect Python from files', () => {
      const context = createContext(['main.py', 'utils.py']);
      const detector = new TechDetector();
      const result = detector.detectFromContext(context);

      expect(result.languages.some((l) => l.name === 'Python')).toBe(true);
    });

    it('should detect Go from files', () => {
      const context = createContext(['main.go', 'pkg/utils.go']);
      const detector = new TechDetector();
      const result = detector.detectFromContext(context);

      expect(result.languages.some((l) => l.name === 'Go')).toBe(true);
    });

    it('should detect Rust from files', () => {
      const context = createContext(['main.rs', 'lib.rs']);
      const detector = new TechDetector();
      const result = detector.detectFromContext(context);

      expect(result.languages.some((l) => l.name === 'Rust')).toBe(true);
    });
  });

  describe('Framework Detection', () => {
    it('should detect React from package.json', () => {
      const context = createContext([], {
        dependencies: { react: '^18.2.0' },
      });
      const detector = new TechDetector();
      const result = detector.detectFromContext(context);

      expect(result.frameworks.some((f) => f.name === 'React')).toBe(true);
      expect(result.frameworks.find((f) => f.name === 'React')?.version).toBe('^18.2.0');
    });

    it('should detect Vue from package.json', () => {
      const context = createContext([], {
        dependencies: { vue: '^3.0.0' },
      });
      const detector = new TechDetector();
      const result = detector.detectFromContext(context);

      expect(result.frameworks.some((f) => f.name === 'Vue')).toBe(true);
    });

    it('should detect Angular from package.json', () => {
      const context = createContext([], {
        dependencies: { '@angular/core': '^17.0.0' },
      });
      const detector = new TechDetector();
      const result = detector.detectFromContext(context);

      expect(result.frameworks.some((f) => f.name === 'Angular')).toBe(true);
    });

    it('should detect Next.js from package.json', () => {
      const context = createContext([], {
        dependencies: { next: '^14.0.0' },
      });
      const detector = new TechDetector();
      const result = detector.detectFromContext(context);

      expect(result.frameworks.some((f) => f.name === 'Next.js')).toBe(true);
    });

    it('should detect Express from package.json', () => {
      const context = createContext([], {
        dependencies: { express: '^4.18.0' },
      });
      const detector = new TechDetector();
      const result = detector.detectFromContext(context);

      expect(result.frameworks.some((f) => f.name === 'Express')).toBe(true);
    });

    it('should detect Fastify from package.json', () => {
      const context = createContext([], {
        dependencies: { fastify: '^4.0.0' },
      });
      const detector = new TechDetector();
      const result = detector.detectFromContext(context);

      expect(result.frameworks.some((f) => f.name === 'Fastify')).toBe(true);
    });
  });

  describe('Test Framework Detection', () => {
    it('should detect Vitest from package.json', () => {
      const context = createContext([], {
        devDependencies: { vitest: '^1.0.0' },
      });
      const detector = new TechDetector();
      const result = detector.detectFromContext(context);

      expect(result.testFrameworks.some((t) => t.name === 'Vitest')).toBe(true);
    });

    it('should detect Jest from package.json', () => {
      const context = createContext([], {
        devDependencies: { jest: '^29.0.0' },
      });
      const detector = new TechDetector();
      const result = detector.detectFromContext(context);

      expect(result.testFrameworks.some((t) => t.name === 'Jest')).toBe(true);
    });

    it('should detect Mocha from package.json', () => {
      const context = createContext([], {
        devDependencies: { mocha: '^10.0.0' },
      });
      const detector = new TechDetector();
      const result = detector.detectFromContext(context);

      expect(result.testFrameworks.some((t) => t.name === 'Mocha')).toBe(true);
    });

    it('should detect Playwright from package.json', () => {
      const context = createContext([], {
        devDependencies: { '@playwright/test': '^1.40.0' },
      });
      const detector = new TechDetector();
      const result = detector.detectFromContext(context);

      expect(result.testFrameworks.some((t) => t.name === 'Playwright')).toBe(true);
    });
  });

  describe('Build Tool Detection', () => {
    it('should detect Vite from package.json', () => {
      const context = createContext([], {
        devDependencies: { vite: '^5.0.0' },
      });
      const detector = new TechDetector();
      const result = detector.detectFromContext(context);

      expect(result.buildTools.some((b) => b.name === 'Vite')).toBe(true);
    });

    it('should detect Webpack from package.json', () => {
      const context = createContext([], {
        devDependencies: { webpack: '^5.0.0' },
      });
      const detector = new TechDetector();
      const result = detector.detectFromContext(context);

      expect(result.buildTools.some((b) => b.name === 'Webpack')).toBe(true);
    });

    it('should detect esbuild from package.json', () => {
      const context = createContext([], {
        devDependencies: { esbuild: '^0.20.0' },
      });
      const detector = new TechDetector();
      const result = detector.detectFromContext(context);

      expect(result.buildTools.some((b) => b.name === 'esbuild')).toBe(true);
    });

    it('should detect tsup from package.json', () => {
      const context = createContext([], {
        devDependencies: { tsup: '^8.0.0' },
      });
      const detector = new TechDetector();
      const result = detector.detectFromContext(context);

      expect(result.buildTools.some((b) => b.name === 'tsup')).toBe(true);
    });
  });

  describe('Linter Detection', () => {
    it('should detect ESLint from package.json', () => {
      const context = createContext([], {
        devDependencies: { eslint: '^8.0.0' },
      });
      const detector = new TechDetector();
      const result = detector.detectFromContext(context);

      expect(result.techs.some((t) => t.name === 'ESLint')).toBe(true);
    });

    it('should detect Prettier from package.json', () => {
      const context = createContext([], {
        devDependencies: { prettier: '^3.0.0' },
      });
      const detector = new TechDetector();
      const result = detector.detectFromContext(context);

      expect(result.techs.some((t) => t.name === 'Prettier')).toBe(true);
    });

    it('should detect ESLint from config file', () => {
      const context = createContext(['.eslintrc.json']);
      const detector = new TechDetector();
      const result = detector.detectFromContext(context);

      expect(result.techs.some((t) => t.name === 'ESLint')).toBe(true);
    });
  });

  describe('Runtime Detection', () => {
    it('should detect Node.js from package.json', () => {
      const context = createContext(['package.json'], {
        engines: { node: '>=18.0.0' },
      });
      const detector = new TechDetector();
      const result = detector.detectFromContext(context);

      expect(result.techs.some((t) => t.name === 'Node.js')).toBe(true);
      expect(result.summary.runtime).toBe('Node.js');
    });

    it('should detect Deno from deno.json', () => {
      const context = createContext(['deno.json']);
      const detector = new TechDetector();
      const result = detector.detectFromContext(context);

      expect(result.techs.some((t) => t.name === 'Deno')).toBe(true);
    });

    it('should detect Bun from bun.lockb', () => {
      const context = createContext(['bun.lockb']);
      const detector = new TechDetector();
      const result = detector.detectFromContext(context);

      expect(result.techs.some((t) => t.name === 'Bun')).toBe(true);
    });
  });

  describe('CI/CD Detection', () => {
    it('should detect GitHub Actions', () => {
      const context = createContext(['.github/workflows/ci.yml']);
      const detector = new TechDetector();
      const result = detector.detectFromContext(context);

      expect(result.techs.some((t) => t.name === 'GitHub Actions')).toBe(true);
      expect(result.summary.hasCICD).toBe(true);
    });

    it('should detect GitLab CI', () => {
      const context = createContext(['.gitlab-ci.yml']);
      const detector = new TechDetector();
      const result = detector.detectFromContext(context);

      expect(result.techs.some((t) => t.name === 'GitLab CI')).toBe(true);
    });
  });

  describe('Containerization Detection', () => {
    it('should detect Docker from Dockerfile', () => {
      const context = createContext(['Dockerfile']);
      const detector = new TechDetector();
      const result = detector.detectFromContext(context);

      expect(result.techs.some((t) => t.name === 'Docker')).toBe(true);
      expect(result.summary.hasDocker).toBe(true);
    });

    it('should detect Docker from docker-compose.yml', () => {
      const context = createContext(['docker-compose.yml']);
      const detector = new TechDetector();
      const result = detector.detectFromContext(context);

      expect(result.techs.some((t) => t.name === 'Docker')).toBe(true);
    });
  });

  describe('ORM Detection', () => {
    it('should detect Prisma from package.json', () => {
      const context = createContext([], {
        dependencies: { '@prisma/client': '^5.0.0' },
      });
      const detector = new TechDetector();
      const result = detector.detectFromContext(context);

      expect(result.techs.some((t) => t.name === 'Prisma')).toBe(true);
    });

    it('should detect Drizzle from package.json', () => {
      const context = createContext([], {
        dependencies: { 'drizzle-orm': '^0.29.0' },
      });
      const detector = new TechDetector();
      const result = detector.detectFromContext(context);

      expect(result.techs.some((t) => t.name === 'Drizzle')).toBe(true);
    });
  });

  describe('Summary Generation', () => {
    it('should set primaryLanguage to TypeScript when present', () => {
      const context = createContext(['index.ts', 'index.js'], {
        devDependencies: { typescript: '^5.0.0' },
      });
      const detector = new TechDetector();
      const result = detector.detectFromContext(context);

      expect(result.summary.primaryLanguage).toBe('TypeScript');
      expect(result.summary.hasTypeScript).toBe(true);
    });

    it('should set hasTests when test framework detected', () => {
      const context = createContext([], {
        devDependencies: { vitest: '^1.0.0' },
      });
      const detector = new TechDetector();
      const result = detector.detectFromContext(context);

      expect(result.summary.hasTests).toBe(true);
    });

    it('should count all detected techs', () => {
      const context = createContext(['index.ts', '.github/workflows/ci.yml'], {
        dependencies: { react: '^18.0.0' },
        devDependencies: { vitest: '^1.0.0', typescript: '^5.0.0' },
      });
      const detector = new TechDetector();
      const result = detector.detectFromContext(context);

      expect(result.summary.techCount).toBeGreaterThan(3);
    });
  });

  describe('Custom Rules', () => {
    it('should allow adding custom detection rules', () => {
      const detector = new TechDetector();
      detector.addRule({
        name: 'CustomTech',
        category: 'library',
        detect: (ctx) => {
          if (ctx.files.some((f) => f.includes('custom.config'))) {
            return {
              name: 'CustomTech',
              category: 'library',
              confidence: 'high',
              source: 'custom.config',
            };
          }
          return null;
        },
      });

      const context = createContext(['custom.config.js']);
      const result = detector.detectFromContext(context);

      expect(result.techs.some((t) => t.name === 'CustomTech')).toBe(true);
    });
  });

  describe('Built-in Rules', () => {
    it('should have expected number of built-in rules', () => {
      expect(BUILT_IN_RULES.length).toBeGreaterThan(20);
    });

    it('should cover all major categories', () => {
      const categories = new Set(BUILT_IN_RULES.map((r) => r.category));
      expect(categories.has('language')).toBe(true);
      expect(categories.has('framework')).toBe(true);
      expect(categories.has('testFramework')).toBe(true);
      expect(categories.has('bundler')).toBe(true);
      expect(categories.has('linter')).toBe(true);
      expect(categories.has('runtime')).toBe(true);
    });
  });
});
