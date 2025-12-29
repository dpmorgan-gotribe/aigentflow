# Step 01: Project Setup

> **Checkpoint:** CP0 - Foundation
> **Dependencies:** None
> **Estimated Effort:** 2-3 hours

---

## Objective

Set up the Aigentflow project with proper TypeScript configuration, folder structure, and development tooling.

---

## Deliverables

- [ ] Project folder structure created
- [ ] package.json with all dependencies
- [ ] TypeScript configuration (tsconfig.json)
- [ ] ESLint + Prettier configuration
- [ ] Build script working
- [ ] Basic test setup with Vitest

---

## Folder Structure

```
aigentflow/
├── bin/
│   └── aigentflow.js           # CLI entry point (compiled)
├── src/
│   ├── cli/
│   │   ├── index.ts            # CLI setup
│   │   └── commands/           # Command implementations
│   │       ├── init.ts
│   │       ├── run.ts
│   │       ├── status.ts
│   │       └── config.ts
│   ├── core/
│   │   ├── orchestrator.ts     # Main orchestrator
│   │   ├── state-machine.ts    # Workflow state machine
│   │   └── context-manager.ts  # Context handling
│   ├── agents/
│   │   ├── base-agent.ts       # Base agent class
│   │   ├── registry.ts         # Agent registry
│   │   └── types.ts            # Agent type definitions
│   ├── persistence/
│   │   ├── database.ts         # SQLite wrapper
│   │   ├── state-store.ts      # State persistence
│   │   └── audit-log.ts        # Audit logging
│   ├── utils/
│   │   ├── logger.ts           # Logging utility
│   │   ├── config.ts           # Configuration loader
│   │   └── errors.ts           # Custom error types
│   └── index.ts                # Main export
├── tests/
│   ├── unit/
│   ├── integration/
│   └── fixtures/
├── orchestrator-data/          # Runtime data (gitignored)
│   ├── aigentflow.db
│   └── logs/
├── projects/                   # User projects (gitignored)
├── system/                     # Agent definitions, skills
│   ├── agents/
│   └── skills/
├── package.json
├── tsconfig.json
├── vitest.config.ts
├── .eslintrc.js
├── .prettierrc
└── .gitignore
```

---

## Implementation Guide

### 1. Initialize npm project

```bash
mkdir aigentflow
cd aigentflow
npm init -y
```

### 2. Install dependencies

```bash
# Core dependencies
npm install commander chalk ora inquirer better-sqlite3 zod uuid

# Anthropic SDK
npm install @anthropic-ai/sdk

# Git operations
npm install simple-git

# Development dependencies
npm install -D typescript @types/node @types/better-sqlite3
npm install -D vitest @vitest/coverage-v8
npm install -D eslint @typescript-eslint/eslint-plugin @typescript-eslint/parser
npm install -D prettier eslint-config-prettier
npm install -D tsx                    # For development running
npm install -D tsup                   # For building
```

### 3. Create package.json scripts

```json
{
  "name": "aigentflow",
  "version": "0.1.0",
  "description": "CLI-first multi-agent orchestrator",
  "type": "module",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "bin": {
    "aigentflow": "./bin/aigentflow.js"
  },
  "scripts": {
    "dev": "tsx src/cli/index.ts",
    "build": "tsup src/index.ts src/cli/index.ts --format esm --dts --clean",
    "lint": "eslint src --ext .ts",
    "lint:fix": "eslint src --ext .ts --fix",
    "format": "prettier --write 'src/**/*.ts'",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage",
    "test:cp0": "vitest run tests/cp0",
    "typecheck": "tsc --noEmit",
    "prepare": "npm run build"
  },
  "engines": {
    "node": ">=20.0.0"
  }
}
```

### 4. Create tsconfig.json

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "allowSyntheticDefaultImports": true,
    "paths": {
      "@/*": ["./src/*"]
    },
    "baseUrl": "."
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

### 5. Create vitest.config.ts

```typescript
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules', 'tests', 'dist'],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
```

### 6. Create .eslintrc.js

```javascript
module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'prettier',
  ],
  env: {
    node: true,
    es2022: true,
  },
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
  },
  rules: {
    '@typescript-eslint/explicit-function-return-type': 'off',
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    'no-console': ['warn', { allow: ['warn', 'error'] }],
  },
};
```

### 7. Create .prettierrc

```json
{
  "semi": true,
  "singleQuote": true,
  "tabWidth": 2,
  "trailingComma": "es5",
  "printWidth": 100
}
```

### 8. Create .gitignore

```gitignore
# Dependencies
node_modules/

# Build output
dist/

# Runtime data
orchestrator-data/
projects/

# Environment
.env
.env.local
.env.*.local

# IDE
.vscode/
.idea/
*.swp
*.swo

# OS
.DS_Store
Thumbs.db

# Logs
*.log
logs/

# Test coverage
coverage/

# Misc
*.tgz
.npmrc
```

### 9. Create bin/aigentflow.js

```javascript
#!/usr/bin/env node

import('../dist/cli/index.js');
```

### 10. Create placeholder source files

```typescript
// src/index.ts
export * from './core/orchestrator';
export * from './agents/base-agent';
export * from './persistence/database';

export const VERSION = '0.1.0';
```

```typescript
// src/cli/index.ts
import { Command } from 'commander';
import { VERSION } from '../index';

const program = new Command();

program
  .name('aigentflow')
  .description('CLI-first multi-agent orchestrator')
  .version(VERSION);

// Commands will be added in Step 02

program.parse();
```

```typescript
// src/core/orchestrator.ts
export class Orchestrator {
  constructor() {
    // Placeholder - implemented in Step 03
  }
}
```

```typescript
// src/agents/base-agent.ts
export abstract class BaseAgent {
  abstract name: string;
  abstract execute(context: unknown): Promise<unknown>;
}
```

```typescript
// src/persistence/database.ts
export class Database {
  constructor() {
    // Placeholder - implemented in Step 04
  }
}
```

```typescript
// src/utils/logger.ts
import chalk from 'chalk';

export const logger = {
  info: (msg: string) => console.log(chalk.blue('ℹ'), msg),
  success: (msg: string) => console.log(chalk.green('✓'), msg),
  warn: (msg: string) => console.log(chalk.yellow('⚠'), msg),
  error: (msg: string) => console.log(chalk.red('✗'), msg),
  debug: (msg: string) => {
    if (process.env.DEBUG) console.log(chalk.gray('⋯'), msg);
  },
};
```

```typescript
// src/utils/errors.ts
export class AigentflowError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: unknown
  ) {
    super(message);
    this.name = 'AigentflowError';
  }
}

export class ConfigError extends AigentflowError {
  constructor(message: string, details?: unknown) {
    super(message, 'CONFIG_ERROR', details);
  }
}

export class AgentError extends AigentflowError {
  constructor(message: string, agentName: string, details?: unknown) {
    super(message, 'AGENT_ERROR', { agentName, ...details });
  }
}

export class StateError extends AigentflowError {
  constructor(message: string, details?: unknown) {
    super(message, 'STATE_ERROR', details);
  }
}
```

---

## Test Scenarios

### Test 1: Project builds successfully

```typescript
// tests/cp0/01-project-setup.test.ts
import { describe, it, expect } from 'vitest';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

describe('Step 01: Project Setup', () => {
  it('should build without errors', () => {
    expect(() => {
      execSync('npm run build', { stdio: 'pipe' });
    }).not.toThrow();
  });

  it('should have correct folder structure', () => {
    const requiredDirs = [
      'src/cli',
      'src/core',
      'src/agents',
      'src/persistence',
      'src/utils',
    ];

    requiredDirs.forEach((dir) => {
      expect(fs.existsSync(dir)).toBe(true);
    });
  });

  it('should have all required config files', () => {
    const requiredFiles = [
      'package.json',
      'tsconfig.json',
      'vitest.config.ts',
      '.eslintrc.js',
      '.prettierrc',
      '.gitignore',
    ];

    requiredFiles.forEach((file) => {
      expect(fs.existsSync(file)).toBe(true);
    });
  });

  it('should pass linting', () => {
    expect(() => {
      execSync('npm run lint', { stdio: 'pipe' });
    }).not.toThrow();
  });

  it('should pass type checking', () => {
    expect(() => {
      execSync('npm run typecheck', { stdio: 'pipe' });
    }).not.toThrow();
  });

  it('should have correct package.json bin entry', () => {
    const pkg = JSON.parse(fs.readFileSync('package.json', 'utf-8'));
    expect(pkg.bin).toBeDefined();
    expect(pkg.bin.aigentflow).toBe('./bin/aigentflow.js');
  });

  it('should have node version requirement', () => {
    const pkg = JSON.parse(fs.readFileSync('package.json', 'utf-8'));
    expect(pkg.engines?.node).toBe('>=20.0.0');
  });
});
```

### Test 2: Development workflow works

```typescript
// tests/cp0/01-dev-workflow.test.ts
import { describe, it, expect } from 'vitest';
import { execSync } from 'child_process';

describe('Development Workflow', () => {
  it('should run in dev mode', () => {
    const result = execSync('npm run dev -- --version', {
      encoding: 'utf-8',
      timeout: 10000,
    });
    expect(result).toContain('0.1.0');
  });

  it('should format code without errors', () => {
    expect(() => {
      execSync('npm run format', { stdio: 'pipe' });
    }).not.toThrow();
  });
});
```

---

## Validation Checklist

```
□ npm install completes without errors
□ npm run build succeeds
□ npm run lint passes
□ npm run typecheck passes
□ npm run test passes
□ Folder structure matches specification
□ bin/aigentflow.js exists and is executable
□ All placeholder files created
```

---

## Common Issues

### Issue: TypeScript path aliases not resolving

**Solution:** Ensure tsup is configured to handle aliases, or use relative imports for now.

### Issue: ESM vs CommonJS conflicts

**Solution:** Ensure `"type": "module"` in package.json and use `.js` extensions in imports after build.

### Issue: better-sqlite3 native module issues

**Solution:** Rebuild native modules: `npm rebuild better-sqlite3`

---

## Next Step

Once all tests pass and checklist is complete, proceed to **Step 02: CLI Foundation**.
