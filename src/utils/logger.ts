/**
 * Logger Utility
 *
 * Structured logging with levels, context, and formatting.
 */

import chalk from 'chalk';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';

export interface LogContext {
  taskId?: string;
  agent?: string;
  component?: string;
  [key: string]: unknown;
}

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: LogContext;
  error?: Error;
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  fatal: 4,
};

const LEVEL_COLORS: Record<LogLevel, (s: string) => string> = {
  debug: chalk.gray,
  info: chalk.blue,
  warn: chalk.yellow,
  error: chalk.red,
  fatal: chalk.bgRed.white,
};

const LEVEL_LABELS: Record<LogLevel, string> = {
  debug: 'DEBUG',
  info: 'INFO ',
  warn: 'WARN ',
  error: 'ERROR',
  fatal: 'FATAL',
};

export class Logger {
  private minLevel: LogLevel;
  private context: LogContext;
  private jsonMode: boolean;

  constructor(options: { minLevel?: LogLevel; context?: LogContext; jsonMode?: boolean } = {}) {
    this.minLevel = options.minLevel ?? 'info';
    this.context = options.context ?? {};
    this.jsonMode = options.jsonMode ?? false;
  }

  /**
   * Create a child logger with additional context
   */
  child(context: LogContext): Logger {
    return new Logger({
      minLevel: this.minLevel,
      context: { ...this.context, ...context },
      jsonMode: this.jsonMode,
    });
  }

  /**
   * Set the minimum log level
   */
  setLevel(level: LogLevel): void {
    this.minLevel = level;
  }

  /**
   * Enable/disable JSON output mode
   */
  setJsonMode(enabled: boolean): void {
    this.jsonMode = enabled;
  }

  /**
   * Log a debug message
   */
  debug(message: string, context?: LogContext): void {
    this.log('debug', message, context);
  }

  /**
   * Log an info message
   */
  info(message: string, context?: LogContext): void {
    this.log('info', message, context);
  }

  /**
   * Log a warning message
   */
  warn(message: string, context?: LogContext): void {
    this.log('warn', message, context);
  }

  /**
   * Log an error message
   */
  error(message: string, error?: Error | LogContext, context?: LogContext): void {
    if (error instanceof Error) {
      this.log('error', message, context, error);
    } else {
      this.log('error', message, error);
    }
  }

  /**
   * Log a fatal message
   */
  fatal(message: string, error?: Error | LogContext, context?: LogContext): void {
    if (error instanceof Error) {
      this.log('fatal', message, context, error);
    } else {
      this.log('fatal', message, error);
    }
  }

  /**
   * Core logging method
   */
  private log(level: LogLevel, message: string, context?: LogContext, error?: Error): void {
    if (LOG_LEVELS[level] < LOG_LEVELS[this.minLevel]) {
      return;
    }

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      context: { ...this.context, ...context },
      error,
    };

    if (this.jsonMode) {
      this.outputJson(entry);
    } else {
      this.outputFormatted(entry);
    }
  }

  /**
   * Output log entry as JSON
   */
  private outputJson(entry: LogEntry): void {
    const output = {
      ...entry,
      error: entry.error
        ? {
            name: entry.error.name,
            message: entry.error.message,
            stack: entry.error.stack,
          }
        : undefined,
    };
    console.log(JSON.stringify(output));
  }

  /**
   * Output formatted log entry
   */
  private outputFormatted(entry: LogEntry): void {
    const colorFn = LEVEL_COLORS[entry.level];
    const label = LEVEL_LABELS[entry.level];
    const time = chalk.gray(entry.timestamp.split('T')[1]?.slice(0, 8) ?? '');

    let line = `${time} ${colorFn(label)} ${entry.message}`;

    // Add context if present
    const ctx = entry.context;
    if (ctx && Object.keys(ctx).length > 0) {
      const ctxStr = Object.entries(ctx)
        .filter(([, v]) => v !== undefined)
        .map(([k, v]) => `${k}=${String(v)}`)
        .join(' ');
      if (ctxStr) {
        line += chalk.gray(` [${ctxStr}]`);
      }
    }

    console.log(line);

    // Print error stack if present
    if (entry.error?.stack) {
      console.log(chalk.gray(entry.error.stack));
    }
  }
}

// Default logger instance
export const logger = new Logger({
  minLevel: process.env.LOG_LEVEL as LogLevel | undefined,
  jsonMode: process.env.LOG_FORMAT === 'json',
});

// Convenience exports
export const debug = logger.debug.bind(logger);
export const info = logger.info.bind(logger);
export const warn = logger.warn.bind(logger);
export const error = logger.error.bind(logger);
export const fatal = logger.fatal.bind(logger);
