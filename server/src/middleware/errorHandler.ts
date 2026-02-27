/**
 * Global Error Handler Middleware
 * 
 * Features:
 * - Catches all errors and returns consistent JSON responses
 * - Maps errors to appropriate HTTP status codes
 * - Logs errors with full context
 * - Hides sensitive information in production
 * - Handles both AppError and unknown errors
 */

import { Context } from 'hono';
import { 
  AppError, 
  isAppError, 
  toAppError, 
  InternalError,
  ErrorCode,
  type ErrorResponse 
} from '../errors/index.js';
import { logger, type LogMetadata } from '../utils/logger.js';
import { getRequestContext } from './requestLogger.js';

/**
 * Error handler options
 */
export interface ErrorHandlerOptions {
  /** Include stack traces in responses (default: development only) */
  includeStackTrace?: boolean;
  /** Log all errors (default: true) */
  logErrors?: boolean;
  /** Custom error transformation */
  transformError?: (error: Error, c: Context) => AppError | null;
}

/**
 * Global error handler middleware for Hono
 */
export function errorHandler(options: ErrorHandlerOptions = {}) {
  const {
    includeStackTrace = process.env.NODE_ENV !== 'production',
    logErrors = true,
    transformError
  } = options;

  return async (err: Error, c: Context): Promise<Response> => {
    // Allow custom error transformation
    let appError: AppError;
    if (transformError) {
      const transformed = transformError(err, c);
      if (transformed) {
        appError = transformed;
      } else {
        appError = toAppError(err);
      }
    } else {
      appError = toAppError(err);
    }

    // Get request context for logging
    const requestContext = getRequestContext(c);
    const requestId = requestContext?.requestId;

    // Log the error
    if (logErrors) {
      const logMeta: LogMetadata = {
        requestId,
        statusCode: appError.statusCode,
        errorCode: appError.code,
        isOperational: appError.isOperational,
        error: {
          name: appError.name,
          message: appError.message,
          stack: includeStackTrace ? appError.stack : undefined
        }
      };

      // Use request-scoped logger if available
      if (requestContext) {
        requestContext.logger.error(`Error: ${appError.message}`, logMeta);
      } else {
        logger.error(`Error: ${appError.message}`, logMeta);
      }
    }

    // Build response
    const response: ErrorResponse = {
      error: {
        code: appError.code,
        message: appError.message,
        ...(appError.details && { details: appError.details })
      }
    };

    // Add stack trace in development
    if (includeStackTrace && appError.stack) {
      response.error.details = {
        ...response.error.details,
        stack: appError.stack
      };
    }

    // Add request ID to response
    if (requestId) {
      response.error.details = {
        ...response.error.details,
        requestId
      };
    }

    return c.json(response, appError.statusCode as 400 | 401 | 403 | 404 | 429 | 500 | 501 | 503);
  };
}

/**
 * Not found handler (404)
 */
export function notFoundHandler(c: Context): Response {
  const requestContext = getRequestContext(c);
  const resource = c.req.path;

  const response: ErrorResponse = {
    error: {
      code: ErrorCode.NOT_FOUND,
      message: `Resource not found: ${resource}`,
      details: {
        path: c.req.path,
        method: c.req.method,
        ...(requestContext?.requestId && { requestId: requestContext.requestId })
      }
    }
  };

  return c.json(response, 404);
}

/**
 * Create an error from common HTTP error conditions
 */
export function createError(
  code: ErrorCode,
  message: string,
  statusCode: number,
  details?: Record<string, unknown>
): AppError {
  class CustomError extends AppError {
    constructor() {
      super(code, message, statusCode, details);
    }
  }
  return new CustomError();
}

/**
 * Async handler wrapper to catch errors in async route handlers
 * 
 * Usage:
 * app.get('/route', asyncHandler(async (c) => {
 *   // Your code here
 * }));
 */
export function asyncHandler<T>(
  handler: (c: Context) => Promise<T>
): (c: Context) => Promise<T | Response> {
  return async (c: Context) => {
    try {
      return await handler(c);
    } catch (error) {
      const appError = toAppError(error);
      
      // Log the error
      const requestContext = getRequestContext(c);
      if (requestContext) {
        requestContext.logger.error(`Async error: ${appError.message}`, {
          statusCode: appError.statusCode,
          errorCode: appError.code
        });
      } else {
        logger.error(`Async error: ${appError.message}`, {
          statusCode: appError.statusCode,
          errorCode: appError.code
        });
      }

      // Return error response
      const response: ErrorResponse = appError.toJSON();
      return c.json(response, appError.statusCode as 400 | 401 | 403 | 404 | 429 | 500 | 501 | 503);
    }
  };
}

/**
 * Validation helper that throws ValidationError
 */
export function validate(
  condition: boolean,
  message: string,
  details?: Record<string, unknown>
): void {
  if (!condition) {
    const { ValidationError } = require('../errors/index.js');
    throw new ValidationError(message, details);
  }
}

/**
 * Require a field to be present
 */
export function requireField<T>(
  value: T | undefined | null,
  fieldName: string
): T {
  if (value === undefined || value === null || value === '') {
    const { MissingFieldError } = require('../errors/index.js');
    throw new MissingFieldError(fieldName);
  }
  return value;
}

/**
 * Validate type of a field
 */
export function validateType(
  value: unknown,
  expectedType: string,
  fieldName: string
): void {
  const actualType = typeof value;
  if (actualType !== expectedType) {
    const { InvalidInputError } = require('../errors/index.js');
    throw new InvalidInputError(fieldName, `expected ${expectedType}, got ${actualType}`, value);
  }
}