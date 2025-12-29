/**
 * Database Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { existsSync, rmSync } from 'fs';
import { DatabaseManager, getDatabase, db } from '../../src/persistence/database.js';
import { DatabaseError } from '../../src/utils/errors.js';

const TEST_DB_PATH = './test-data/db-test.sqlite';

function cleanupTestDb(): void {
  // Only clean up our specific test files, not the entire directory
  if (existsSync(TEST_DB_PATH)) {
    rmSync(TEST_DB_PATH);
  }
  const walPath = TEST_DB_PATH + '-wal';
  const shmPath = TEST_DB_PATH + '-shm';
  if (existsSync(walPath)) rmSync(walPath);
  if (existsSync(shmPath)) rmSync(shmPath);
}

describe('DatabaseManager', () => {
  beforeEach(() => {
    // Clean up test database
    DatabaseManager.reset();
    cleanupTestDb();
  });

  afterEach(() => {
    // Clean up
    DatabaseManager.reset();
    cleanupTestDb();
  });

  it('should create singleton instance', () => {
    const instance1 = getDatabase({ path: TEST_DB_PATH });
    const instance2 = getDatabase({ path: TEST_DB_PATH });
    expect(instance1).toBe(instance2);
  });

  it('should initialize database and create schema', () => {
    const manager = getDatabase({ path: TEST_DB_PATH });
    manager.initialize();

    expect(manager.isConnected()).toBe(true);
    expect(existsSync(TEST_DB_PATH)).toBe(true);
  });

  it('should execute queries', () => {
    const manager = getDatabase({ path: TEST_DB_PATH });
    manager.initialize();

    const result = manager.query<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type='table'"
    );
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
  });

  it('should execute single query', () => {
    const manager = getDatabase({ path: TEST_DB_PATH });
    manager.initialize();

    const result = manager.queryOne<{ version: number }>(
      'SELECT version FROM schema_version LIMIT 1'
    );
    expect(result).toBeDefined();
    expect(result?.version).toBe(1);
  });

  it('should execute statements', () => {
    const manager = getDatabase({ path: TEST_DB_PATH });
    manager.initialize();

    const result = manager.execute(
      `INSERT INTO configurations (id, scope, key, value)
       VALUES (?, ?, ?, ?)`,
      ['test-id', 'global', 'test.key', '"test-value"']
    );
    expect(result.changes).toBe(1);
  });

  it('should run transactions', () => {
    const manager = getDatabase({ path: TEST_DB_PATH });
    manager.initialize();

    const result = manager.transaction(() => {
      manager.execute(
        `INSERT INTO configurations (id, scope, key, value)
         VALUES (?, ?, ?, ?)`,
        ['tx-1', 'global', 'key1', '"value1"']
      );
      manager.execute(
        `INSERT INTO configurations (id, scope, key, value)
         VALUES (?, ?, ?, ?)`,
        ['tx-2', 'global', 'key2', '"value2"']
      );
      return 'success';
    });

    expect(result).toBe('success');

    const count = manager.queryOne<{ count: number }>(
      'SELECT COUNT(*) as count FROM configurations'
    );
    expect(count?.count).toBe(2);
  });

  it('should throw when not initialized', () => {
    DatabaseManager.reset();
    const manager = getDatabase({ path: TEST_DB_PATH });
    expect(() => manager.getConnection()).toThrow(DatabaseError);
  });

  it('should get database stats', () => {
    const manager = getDatabase({ path: TEST_DB_PATH });
    manager.initialize();

    const stats = manager.getStats();
    expect(stats.connected).toBe(true);
    expect(stats.path).toBe(TEST_DB_PATH);
    expect(typeof stats.tables).toBe('number');
  });

  it('should close connection', () => {
    const manager = getDatabase({ path: TEST_DB_PATH });
    manager.initialize();
    expect(manager.isConnected()).toBe(true);

    manager.close();
    expect(manager.isConnected()).toBe(false);
  });
});

describe('db helper', () => {
  beforeEach(() => {
    DatabaseManager.reset();
    cleanupTestDb();
  });

  afterEach(() => {
    db.reset();
    cleanupTestDb();
  });

  it('should initialize via helper', () => {
    const manager = db.initialize({ path: TEST_DB_PATH });
    expect(manager.isConnected()).toBe(true);
  });

  it('should close via helper', () => {
    db.initialize({ path: TEST_DB_PATH });
    db.close();
    expect(db.instance.isConnected()).toBe(false);
  });
});
