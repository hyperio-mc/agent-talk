/**
 * Structured Logger for Agent Talk API
 * 
 * Features:
 * - JSON logs in production, pretty logs in development
 * - Log levels: trace, debug, info, warn, error
 * - Request context support
 * - Structured metadata
 */

export type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error';
export type Environment = 'development' | 'production' | 'test';

/**
 * Log metadata structure
 */
export interface LogMetadata {
  [key: string]: unknown;
  requestId?: string;
  method?: string;
  path?: string;
  duration?: number;
  statusCode?: number;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

/**
 * Log entry structure
 */
interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  service: string;
  environment: Environment;
  [key: string]: unknown;
}

/**
 * ANSI color codes for pretty printing
 */
const COLORS = {
  trace: '\x1b[35m', // magenta
  debug: '\x1b[36m', // cyan
  info: '\x1b[32m',  // green
  warn: '\x1b[33m',  // yellow
  error: '\x1b[31m', // red
  reset: '\x1b[0m',
  dim: '\x1b[2m',
  bright: '\x1b[1m'
};

/**
 * Log level priority for filtering
 */
const LOG_LEVELS: Record<LogLevel, number> = {
  trace: 0,
  debug: 1,
  info: 2,
  warn: 3,
  error: 4
};

/**
 * Logger class with structured logging support
 */
export class Logger {
  private readonly service: string;
  private readonly environment: Environment;
  private readonly minLevel: LogLevel;

  constructor(
    service: string = 'agent-talk',
    options?: {
      environment?: Environment;
      minLevel?: LogLevel;
    }
  ) {
    this.service = service;
    this.environment = options?.environment ?? this.detectEnvironment();
    this.minLevel = options?.minLevel ?? this.getDefaultLevel();
  }

  /**
   * Detect environment from NODE_ENV
   */
  private detectEnvironment(): Environment {
    const nodeEnv = process.env.NODE_ENV;
    if (nodeEnv === 'production') return 'production';
    if (nodeEnv === 'test') return 'test';
    return 'development';
  }

  /**
   * Get default log level based on environment
   */
  private getDefaultLevel(): LogLevel {
    switch (this.environment) {
      case 'production':
        return 'info';
      case 'test':
        return 'warn';
      default:
        return 'debug';
    }
  }

  /**
   * Check if a log level should be output
   */
  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVELS[level] >= LOG_LEVELS[this.minLevel];
  }

  /**
   * Format timestamp
   */
  private getTimestamp(): string {
    return new Date().toISOString();
  }

  /**
   * Format log entry for JSON output
   */
  private formatJson(entry: LogEntry): string {
    return JSON.stringify(entry);
  }

  /**
   * Format log entry for pretty output
   */
  private formatPretty(entry: LogEntry): string {
    const color = COLORS[entry.level];
    const timestamp = COLORS.dim + entry.timestamp + COLORS.reset;
    const level = color + COLORS.bright + entry.level.toUpperCase().padEnd(5) + COLORS.reset;
    const message = entry.message;
    
    // Format metadata - exclude built-in fields
    const meta: Record<string, unknown> = {};
    const builtInFields = ['timestamp', 'level', 'message', 'service', 'environment'];
    for (const [key, value] of Object.entries(entry)) {
      if (!builtInFields.includes(key)) {
        meta[key] = value;
      }
    }
    
    let metadata = '';
    if (Object.keys(meta).length > 0) {
      const formattedMeta = Object.entries(meta)
        .map(([key, value]) => {
          if (typeof value === 'object' && value !== null) {
            return `${COLORS.dim}${key}=${COLORS.reset}${JSON.stringify(value)}`;
          }
          return `${COLORS.dim}${key}=${COLORS.reset}${value}`;
        })
        .join(' ');
      metadata = ' ' + formattedMeta;
    }

    return `${timestamp} ${level} ${message}${metadata}`;
  }

  /**
   * Write log to output
   */
  private write(level: LogLevel, message: string, metadata?: LogMetadata): void {
    if (!this.shouldLog(level)) return;

    const entry: LogEntry = {
      timestamp: this.getTimestamp(),
      level,
      message,
      service: this.service,
      environment: this.environment,
      ...metadata
    };

    const output = this.environment === 'production'
      ? this.formatJson(entry)
      : this.formatPretty(entry);

    const stream = level === 'error' || level === 'warn'
      ? process.stderr
      : process.stdout;

    stream.write(output + '\n');
  }

  /**
   * Log at trace level
   */
  trace(message: string, metadata?: LogMetadata): void {
    this.write('trace', message, metadata);
  }

  /**
   * Log at debug level
   */
  debug(message: string, metadata?: LogMetadata): void {
    this.write('debug', message, metadata);
  }

  /**
   * Log at info level
   */
  info(message: string, metadata?: LogMetadata): void {
    this.write('info', message, metadata);
  }

  /**
   * Log at warn level
   */
  warn(message: string, metadata?: LogMetadata): void {
    this.write('warn', message, metadata);
  }

  /**
   * Log at error level
   */
  error(message: string, metadata?: LogMetadata): void {
    this.write('error', message, metadata);
  }

  /**
   * Create a child logger with additional context
   */
  child(context: LogMetadata): ChildLogger {
    return new ChildLogger(this, context);
  }

  /**
   * Log an error with stack trace
   */
  logError(message: string, error: unknown, metadata?: LogMetadata): void {
    const errorMeta: LogMetadata = {
      ...metadata,
      error: error instanceof Error
        ? {
            name: error.name,
            message: error.message,
            stack: this.environment !== 'production' ? error.stack : undefined
          }
        : { name: 'UnknownError', message: String(error) }
    };
    this.error(message, errorMeta);
  }
}

/**
 * Child logger that includes context in all messages
 */
class ChildLogger {
  private readonly parent: Logger;
  private readonly context: LogMetadata;

  constructor(parent: Logger, context: LogMetadata) {
    this.parent = parent;
    this.context = context;
  }

  private merge(metadata?: LogMetadata): LogMetadata | undefined {
    if (!metadata) return this.context;
    return { ...this.context, ...metadata };
  }

  trace(message: string, metadata?: LogMetadata): void {
    this.parent.trace(message, this.merge(metadata));
  }

  debug(message: string, metadata?: LogMetadata): void {
    this.parent.debug(message, this.merge(metadata));
  }

  info(message: string, metadata?: LogMetadata): void {
    this.parent.info(message, this.merge(metadata));
  }

  warn(message: string, metadata?: LogMetadata): void {
    this.parent.warn(message, this.merge(metadata));
  }

  error(message: string, metadata?: LogMetadata): void {
    this.parent.error(message, this.merge(metadata));
  }

  logError(message: string, error: unknown, metadata?: LogMetadata): void {
    this.parent.logError(message, error, this.merge(metadata));
  }
}

/**
 * Default logger instance
 */
export const logger = new Logger();

/**
 * Create a request-scoped logger
 */
export function createRequestLogger(requestId: string, method?: string, path?: string): ChildLogger {
  return logger.child({
    requestId,
    ...(method && { method }),
    ...(path && { path })
  });
}

/**
 * Generate a unique request ID
 */
export function generateRequestId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 10);
  return `req_${timestamp}_${random}`;
}