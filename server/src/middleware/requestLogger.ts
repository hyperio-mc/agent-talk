/**
 * Request Logger Middleware
 * 
 * Logs all incoming requests with:
 * - Method, path, query params
 * - Request ID for tracing
 * - Response status and duration
 * - IP address and user agent
 * - Metrics collection for monitoring
 */

import { Context, Next } from 'hono';
import { logger, createRequestLogger, generateRequestId, type LogMetadata } from '../utils/logger.js';
import { recordRequest, recordError } from '../services/monitoring.js';

/**
 * Request context stored in Hono's context
 */
export interface RequestContext {
  requestId: string;
  startTime: number;
  logger: ReturnType<typeof createRequestLogger>;
}

/**
 * Key for storing request context in Hono's context
 */
const REQUEST_CONTEXT_KEY = 'requestContext';

/**
 * Extend Hono context type
 */
declare module 'hono' {
  interface ContextVariableMap {
    [REQUEST_CONTEXT_KEY]: RequestContext;
  }
}

/**
 * Get request context from Hono context
 */
export function getRequestContext(c: Context): RequestContext | undefined {
  return c.get(REQUEST_CONTEXT_KEY);
}

/**
 * Get request-scoped logger
 */
export function getRequestLogger(c: Context): ReturnType<typeof createRequestLogger> | undefined {
  return getRequestContext(c)?.logger;
}

/**
 * Request logger middleware options
 */
export interface RequestLoggerOptions {
  /** Include request body in logs (careful with sensitive data) */
  logBody?: boolean;
  /** Include response body in logs (careful with sensitive data) */
  logResponseBody?: boolean;
  /** Skip logging for certain paths */
  skipPaths?: string[];
  /** Custom request ID header */
  requestIdHeader?: string;
}

/**
 * Request logger middleware for Hono
 */
export function requestLogger(options: RequestLoggerOptions = {}) {
  const {
    skipPaths = ['/health', '/favicon.ico'],
    requestIdHeader = 'x-request-id'
  } = options;

  return async (c: Context, next: Next) => {
    const path = c.req.path;
    
    // Skip logging for certain paths
    if (skipPaths.some(skipPath => path.startsWith(skipPath))) {
      return next();
    }

    // Generate or extract request ID
    const requestId = c.req.header(requestIdHeader) || generateRequestId();
    const startTime = Date.now();

    // Create request-scoped logger
    const requestLogger = createRequestLogger(
      requestId,
      c.req.method,
      path
    );

    // Store in context
    const context: RequestContext = {
      requestId,
      startTime,
      logger: requestLogger
    };
    c.set(REQUEST_CONTEXT_KEY, context);

    // Add request ID to response headers
    c.header('x-request-id', requestId);

    // Log incoming request
    const requestMeta: LogMetadata = {
      method: c.req.method,
      path,
      query: c.req.query() || undefined,
      ip: getClientIp(c),
      userAgent: c.req.header('user-agent')
    };

    requestLogger.info('Request started', requestMeta);

    try {
      await next();
    } finally {
      // Calculate duration
      const duration = Date.now() - startTime;
      const status = c.res.status;

      // Record metrics for monitoring
      recordRequest(c.req.method, path, status, duration);

      // Determine log level based on status
      const level = status >= 500 ? 'error' : status >= 400 ? 'warn' : 'info';
      const message = status >= 500 
        ? 'Request failed' 
        : status >= 400 
          ? 'Request client error' 
          : 'Request completed';

      // Log response
      const responseMeta: LogMetadata = {
        method: c.req.method,
        path,
        statusCode: status,
        duration,
        ...(c.req.method !== 'GET' && { contentLength: c.res.headers.get('content-length') })
      };

      requestLogger[level](message, responseMeta);

      // Record error for monitoring (for 5xx errors)
      if (status >= 500) {
        recordError('server_error', `HTTP ${status}`, path);
      }
    }
  };
}

/**
 * Get client IP address from request
 */
function getClientIp(c: Context): string | undefined {
  // Check various headers for real IP
  const forwardedFor = c.req.header('x-forwarded-for');
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim();
  }

  const realIp = c.req.header('x-real-ip');
  if (realIp) {
    return realIp;
  }

  // Fallback to socket address (if available)
  // Note: In Cloudflare Workers or other environments, this may not be available
  return undefined;
}

/**
 * Log a request detail (for use in route handlers)
 */
export function logRequestDetail(c: Context, message: string, metadata?: LogMetadata): void {
  const ctx = getRequestContext(c);
  if (ctx) {
    ctx.logger.debug(message, metadata);
  } else {
    logger.debug(message, metadata);
  }
}

/**
 * Middleware to log request body (use carefully!)
 */
export function logRequestBody(c: Context, body: unknown): void {
  const ctx = getRequestContext(c);
  if (ctx) {
    // Sanitize sensitive fields
    const sanitized = sanitizeBody(body);
    ctx.logger.debug('Request body', { body: sanitized });
  }
}

/**
 * Sanitize request body for logging
 */
function sanitizeBody(body: unknown): unknown {
  if (!body || typeof body !== 'object') {
    return body;
  }

  const sensitiveFields = [
    'password',
    'apiKey',
    'api_key',
    'token',
    'secret',
    'authorization'
  ];

  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(body as Record<string, unknown>)) {
    if (sensitiveFields.some(field => key.toLowerCase().includes(field.toLowerCase()))) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeBody(value);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

/**
 * Timing helper for performance metrics
 */
export class Timer {
  private startTime: number;
  private label: string;

  constructor(label: string) {
    this.label = label;
    this.startTime = Date.now();
  }

  elapsed(): number {
    return Date.now() - this.startTime;
  }

  log(c: Context): number {
    const duration = this.elapsed();
    logRequestDetail(c, `Timer: ${this.label}`, { duration });
    return duration;
  }
}