/**
 * Test Setup
 *
 * Global test configuration and utilities.
 */

import { beforeAll, afterAll } from 'vitest';

beforeAll(() => {
  // Global test setup
  process.env.NODE_ENV = 'test';
});

afterAll(() => {
  // Global test teardown
});
