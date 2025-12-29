/**
 * Logger Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Logger, LogLevel } from '../../src/utils/logger.js';

describe('Logger', () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  it('should create a logger instance', () => {
    const logger = new Logger();
    expect(logger).toBeDefined();
  });

  it('should log info messages', () => {
    const logger = new Logger({ minLevel: 'info' });
    logger.info('Test message');
    expect(consoleSpy).toHaveBeenCalled();
  });

  it('should respect log level filtering', () => {
    const logger = new Logger({ minLevel: 'error' });
    logger.info('Should not appear');
    logger.debug('Should not appear');
    expect(consoleSpy).not.toHaveBeenCalled();

    logger.error('Should appear');
    expect(consoleSpy).toHaveBeenCalled();
  });

  it('should create child loggers with context', () => {
    const logger = new Logger({ minLevel: 'info' });
    const child = logger.child({ component: 'test' });
    expect(child).toBeInstanceOf(Logger);
  });

  it('should output JSON when jsonMode is enabled', () => {
    const logger = new Logger({ minLevel: 'info', jsonMode: true });
    logger.info('Test message', { key: 'value' });
    expect(consoleSpy).toHaveBeenCalled();
    const output = consoleSpy.mock.calls[0]?.[0];
    expect(() => JSON.parse(output)).not.toThrow();
  });

  it('should allow changing log level', () => {
    const logger = new Logger({ minLevel: 'error' });
    logger.debug('Should not appear');
    expect(consoleSpy).not.toHaveBeenCalled();

    logger.setLevel('debug');
    logger.debug('Should appear');
    expect(consoleSpy).toHaveBeenCalled();
  });
});
