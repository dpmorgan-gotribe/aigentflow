/**
 * CLI Smoke Tests
 *
 * Basic tests to verify CLI commands initialize and run without errors.
 * These tests verify the CLI can be invoked and commands work at a basic level.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execSync } from 'child_process';
import { existsSync, rmSync, mkdirSync } from 'fs';
import path from 'path';

const CLI_PATH = path.resolve(process.cwd(), 'bin', 'aigentflow.js');
const TEST_DIR = path.resolve('./test-data/cli-smoke-test');

function runCLI(args: string, cwd?: string): { stdout: string; stderr: string; exitCode: number } {
  try {
    const stdout = execSync(`node "${CLI_PATH}" ${args}`, {
      encoding: 'utf-8',
      timeout: 15000,
      cwd: cwd ?? TEST_DIR,
      env: { ...process.env, NODE_ENV: 'test' },
    });
    return { stdout, stderr: '', exitCode: 0 };
  } catch (error: unknown) {
    const execError = error as { stdout?: string; stderr?: string; status?: number };
    return {
      stdout: execError.stdout ?? '',
      stderr: execError.stderr ?? '',
      exitCode: execError.status ?? 1,
    };
  }
}

function cleanupTestDir(): void {
  try {
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true, force: true });
    }
  } catch {
    // Ignore cleanup errors
  }
}

describe('CLI Smoke Tests', () => {
  beforeEach(() => {
    cleanupTestDir();
    mkdirSync(TEST_DIR, { recursive: true });
  });

  afterEach(() => {
    // Give time for file handles to close
    cleanupTestDir();
  });

  describe('Help Command', () => {
    it('should display help without errors', () => {
      const result = runCLI('--help');
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('aigentflow');
    });

    it('should display version', () => {
      const result = runCLI('--version');
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toMatch(/\d+\.\d+/);
    });
  });

  describe('Init Command', () => {
    it('should show init help', () => {
      const result = runCLI('init --help');
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('init');
    });
  });

  describe('Status Command', () => {
    it('should show status help', () => {
      const result = runCLI('status --help');
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('status');
    });
  });

  describe('Config Command', () => {
    it('should show config help', () => {
      const result = runCLI('config --help');
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('config');
    });
  });

  describe('Run Command', () => {
    it('should show run help', () => {
      const result = runCLI('run --help');
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('run');
    });
  });

  describe('History Command', () => {
    it('should show history help', () => {
      const result = runCLI('history --help');
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('history');
    });
  });

  describe('Lessons Command', () => {
    it('should show lessons help', () => {
      const result = runCLI('lessons --help');
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('lessons');
    });
  });
});
