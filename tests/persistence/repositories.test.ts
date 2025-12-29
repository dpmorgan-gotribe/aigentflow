/**
 * Repository Tests
 *
 * Tests for all repository implementations.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { initializeDatabase, DatabaseManager } from '../../src/persistence/database.js';
import {
  getProjectRepository,
  resetProjectRepository,
} from '../../src/persistence/repositories/project-repository.js';
import {
  getConfigRepository,
  resetConfigRepository,
} from '../../src/persistence/repositories/config-repository.js';
import {
  getApprovalRepository,
  resetApprovalRepository,
} from '../../src/persistence/repositories/approval-repository.js';
import {
  getLessonRepository,
  resetLessonRepository,
} from '../../src/persistence/repositories/lesson-repository.js';
import {
  getAuditRepository,
  resetAuditRepository,
} from '../../src/persistence/repositories/audit-repository.js';

const TEST_DB_DIR = './test-data';
const TEST_DB_PATH = path.join(TEST_DB_DIR, 'repos-test.sqlite');

function cleanupTestDb(): void {
  if (fs.existsSync(TEST_DB_PATH)) {
    fs.unlinkSync(TEST_DB_PATH);
  }
  const walPath = TEST_DB_PATH + '-wal';
  const shmPath = TEST_DB_PATH + '-shm';
  if (fs.existsSync(walPath)) fs.unlinkSync(walPath);
  if (fs.existsSync(shmPath)) fs.unlinkSync(shmPath);
}

describe('ProjectRepository', () => {
  beforeEach(() => {
    cleanupTestDb();
    initializeDatabase(TEST_DB_PATH);
    resetProjectRepository();
  });

  afterEach(() => {
    DatabaseManager.reset();
    cleanupTestDb();
  });

  it('should create a project', () => {
    const repo = getProjectRepository();
    const project = repo.create('test-project', '/path/to/project');

    expect(project.id).toBeDefined();
    expect(project.name).toBe('test-project');
    expect(project.path).toBe('/path/to/project');
  });

  it('should get project by name', () => {
    const repo = getProjectRepository();
    repo.create('my-project', '/path/to/project');

    const found = repo.getByName('my-project');
    expect(found).toBeDefined();
    expect(found?.name).toBe('my-project');
  });

  it('should get project by path', () => {
    const repo = getProjectRepository();
    repo.create('my-project', '/path/to/project');

    const found = repo.getByPath('/path/to/project');
    expect(found).toBeDefined();
    expect(found?.name).toBe('my-project');
  });

  it('should get all projects', () => {
    const repo = getProjectRepository();
    repo.create('project-1', '/path/1');
    repo.create('project-2', '/path/2');

    const all = repo.getAll();
    expect(all.length).toBe(2);
  });

  it('should update project config', () => {
    const repo = getProjectRepository();
    const project = repo.create('my-project', '/path/to/project');

    repo.updateConfig(project.id, { name: 'updated-name' });

    const updated = repo.getById(project.id);
    const config = JSON.parse(updated!.config);
    expect(config.name).toBe('updated-name');
  });

  it('should delete project', () => {
    const repo = getProjectRepository();
    const project = repo.create('my-project', '/path/to/project');

    repo.delete(project.id);

    const found = repo.getById(project.id);
    expect(found).toBeUndefined();
  });
});

describe('ConfigRepository', () => {
  beforeEach(() => {
    cleanupTestDb();
    initializeDatabase(TEST_DB_PATH);
    resetConfigRepository();
  });

  afterEach(() => {
    DatabaseManager.reset();
    cleanupTestDb();
  });

  it('should set and get config value', () => {
    const repo = getConfigRepository();
    repo.set('test.key', 'test-value');

    const value = repo.get<string>('test.key');
    expect(value).toBe('test-value');
  });

  it('should return undefined for missing key', () => {
    const repo = getConfigRepository();
    const value = repo.get('missing.key');
    expect(value).toBeUndefined();
  });

  it('should get with default value', () => {
    const repo = getConfigRepository();
    const value = repo.getOrDefault('missing.key', 'default');
    expect(value).toBe('default');
  });

  it('should delete config value', () => {
    const repo = getConfigRepository();
    repo.set('test.key', 'value');
    repo.delete('test.key');

    const value = repo.get('test.key');
    expect(value).toBeUndefined();
  });

  it('should get all config values', () => {
    const repo = getConfigRepository();
    repo.set('key1', 'value1');
    repo.set('key2', 'value2');

    const all = repo.getAll();
    expect(all.size).toBe(2);
    expect(all.get('key1')).toBe('value1');
  });

  it('should support different scopes', () => {
    const repo = getConfigRepository();
    repo.set('test.key', 'global-value', 'global');
    repo.set('test.key', 'project-value', 'project-123');

    expect(repo.get('test.key', 'global')).toBe('global-value');
    expect(repo.get('test.key', 'project-123')).toBe('project-value');
  });
});

describe('ApprovalRepository', () => {
  let taskId1: string;
  let taskId2: string;

  beforeEach(() => {
    cleanupTestDb();
    initializeDatabase(TEST_DB_PATH);
    resetApprovalRepository();

    // Create workflow states to satisfy foreign key constraints
    const db = DatabaseManager.getInstance().getConnection();
    const { randomUUID } = require('crypto');
    const now = new Date().toISOString();

    // Create project
    db.prepare(
      'INSERT INTO projects (id, name, path, config, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
    ).run('proj-1', 'test-project', '/path', '{}', now, now);

    // Create workflow states
    taskId1 = randomUUID();
    taskId2 = randomUUID();
    db.prepare(
      'INSERT INTO workflow_states (id, project_id, task_id, state, prompt, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run(randomUUID(), 'proj-1', taskId1, 'IDLE', 'test', now, now);
    db.prepare(
      'INSERT INTO workflow_states (id, project_id, task_id, state, prompt, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run(randomUUID(), 'proj-1', taskId2, 'IDLE', 'test', now, now);
  });

  afterEach(() => {
    DatabaseManager.reset();
    cleanupTestDb();
  });

  it('should create approval request', () => {
    const repo = getApprovalRepository();
    const approval = repo.create(taskId1, 'design', 'UI mockup review');

    expect(approval.id).toBeDefined();
    expect(approval.task_id).toBe(taskId1);
    expect(approval.type).toBe('design');
    expect(approval.status).toBe('pending');
  });

  it('should get pending approvals', () => {
    const repo = getApprovalRepository();
    repo.create(taskId1, 'design', 'Design review');
    repo.create(taskId2, 'architecture', 'Architecture review');

    const pending = repo.getPending();
    expect(pending.length).toBe(2);
  });

  it('should approve request', () => {
    const repo = getApprovalRepository();
    const approval = repo.create(taskId1, 'design', 'Design review');

    repo.approve(approval.id, 'reviewer', 'Looks good!');

    const updated = repo.getById(approval.id);
    expect(updated?.status).toBe('approved');
    expect(updated?.reviewer).toBe('reviewer');
    expect(updated?.message).toBe('Looks good!');
  });

  it('should reject request', () => {
    const repo = getApprovalRepository();
    const approval = repo.create(taskId1, 'design', 'Design review');

    repo.reject(approval.id, 'reviewer', 'Needs work');

    const updated = repo.getById(approval.id);
    expect(updated?.status).toBe('rejected');
  });

  it('should approve all pending', () => {
    const repo = getApprovalRepository();
    repo.create(taskId1, 'design', 'Design 1');
    repo.create(taskId2, 'design', 'Design 2');

    const count = repo.approveAll('reviewer');
    expect(count).toBe(2);

    const pending = repo.getPending();
    expect(pending.length).toBe(0);
  });
});

describe('LessonRepository', () => {
  beforeEach(() => {
    cleanupTestDb();
    initializeDatabase(TEST_DB_PATH);
    resetLessonRepository();
  });

  afterEach(() => {
    DatabaseManager.reset();
    cleanupTestDb();
  });

  it('should create lesson', () => {
    const repo = getLessonRepository();
    const lesson = repo.create(
      'Always validate user input',
      'security',
      'analyst',
      'code-review',
      ['validation', 'security']
    );

    expect(lesson.id).toBeDefined();
    expect(lesson.content).toBe('Always validate user input');
    expect(lesson.category).toBe('security');
  });

  it('should search lessons', () => {
    const repo = getLessonRepository();
    repo.create('Validate user input', 'security', 'analyst', 'review');
    repo.create('Use semantic HTML', 'accessibility', 'reviewer', 'review');

    const security = repo.search({ category: 'security' });
    expect(security.length).toBe(1);
    expect(security[0]?.content).toContain('Validate');
  });

  it('should get lessons by category', () => {
    const repo = getLessonRepository();
    repo.create('Security lesson 1', 'security', 'analyst', 'source');
    repo.create('Security lesson 2', 'security', 'analyst', 'source');
    repo.create('Performance lesson', 'performance', 'analyst', 'source');

    const securityLessons = repo.getByCategory('security');
    expect(securityLessons.length).toBe(2);
  });

  it('should increment usage count', () => {
    const repo = getLessonRepository();
    const lesson = repo.create('Test lesson', 'general', 'analyst', 'source');

    expect(lesson.usage_count).toBe(0);

    repo.incrementUsage(lesson.id);
    repo.incrementUsage(lesson.id);

    const updated = repo.getById(lesson.id);
    expect(updated?.usage_count).toBe(2);
  });

  it('should delete lesson', () => {
    const repo = getLessonRepository();
    const lesson = repo.create('Test lesson', 'general', 'analyst', 'source');

    repo.delete(lesson.id);

    const found = repo.getById(lesson.id);
    expect(found).toBeUndefined();
  });
});

describe('AuditRepository', () => {
  let taskId1: string;
  let taskId2: string;

  beforeEach(() => {
    cleanupTestDb();
    initializeDatabase(TEST_DB_PATH);
    resetAuditRepository();

    // Generate task IDs for reference (audit logs don't have FK constraint)
    const { randomUUID } = require('crypto');
    taskId1 = randomUUID();
    taskId2 = randomUUID();
  });

  afterEach(() => {
    DatabaseManager.reset();
    cleanupTestDb();
  });

  it('should log audit event', () => {
    const repo = getAuditRepository();
    const log = repo.log(
      'system',
      'info',
      'test_action',
      'tester',
      { key: 'value' }
    );

    expect(log.id).toBeDefined();
    expect(log.category).toBe('system');
    expect(log.action).toBe('test_action');
    expect(log.checksum).toBeDefined();
  });

  it('should log workflow event', () => {
    const repo = getAuditRepository();
    const log = repo.logWorkflow('task_created', taskId1, { prompt: 'test' });

    expect(log.task_id).toBe(taskId1);
    expect(log.category).toBe('workflow');
  });

  it('should log security event', () => {
    const repo = getAuditRepository();
    const log = repo.logSecurity('secret_detected', 'scanner', { file: 'test.env' });

    expect(log.category).toBe('security');
    expect(log.severity).toBe('warning');
  });

  it('should search audit logs', () => {
    const repo = getAuditRepository();
    repo.logWorkflow('task_created', taskId1, {});
    repo.logWorkflow('task_started', taskId1, {});
    repo.logSecurity('scan_completed', 'scanner', {});

    const workflowLogs = repo.search({ category: 'workflow' });
    expect(workflowLogs.length).toBe(2);
  });

  it('should verify integrity', () => {
    const repo = getAuditRepository();
    const log = repo.log('system', 'info', 'test', 'tester', {});

    const valid = repo.verifyIntegrity(log.id);
    expect(valid).toBe(true);
  });

  it('should get logs for task', () => {
    const repo = getAuditRepository();
    repo.logWorkflow('action1', taskId1, {});
    repo.logWorkflow('action2', taskId1, {});
    repo.logWorkflow('action3', taskId2, {});

    const task1Logs = repo.getForTask(taskId1);
    expect(task1Logs.length).toBe(2);
  });
});
