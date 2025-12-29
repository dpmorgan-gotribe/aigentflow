#!/usr/bin/env node

/**
 * Aigentflow CLI Entry Point
 *
 * This file bootstraps the CLI by importing the compiled TypeScript module.
 * All actual CLI logic resides in src/cli/index.ts
 */

import('../dist/cli/index.js').catch((error) => {
  console.error('Failed to start aigentflow:', error.message);
  console.error('');
  console.error('If this is a fresh installation, try running: npm run build');
  process.exit(1);
});
