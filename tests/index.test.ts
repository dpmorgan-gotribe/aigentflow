/**
 * Basic Tests
 *
 * Verify the project builds and basic exports work.
 */

import { describe, it, expect } from 'vitest';
import { VERSION } from '../src/index.js';

describe('Aigentflow', () => {
  it('should export VERSION', () => {
    expect(VERSION).toBe('0.1.0-mvp');
  });

  it('should have correct version format', () => {
    expect(VERSION).toMatch(/^\d+\.\d+\.\d+(-\w+)?$/);
  });
});

describe('Types', () => {
  it('should import types without errors', async () => {
    const types = await import('../src/types.js');
    expect(types).toBeDefined();
  });
});
