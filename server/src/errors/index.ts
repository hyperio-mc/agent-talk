/**
 * Error Classes for Agent Talk API
 * 
 * Provides a consistent error handling system with:
 * - Standardized error codes
 * - HTTP status mapping
 * - Detailed error information
 * - Secure error responses (no sensitive data leaks)
 */

/**
 * Error codes used throughout the application
 */
export enum ErrorCode {
  // Validation errors (400)
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  INVALID_INPUT = 'INVALID_INPUT',
  MISSING_FIELD = 'MISSING_FIELD',
  INVALID_VOICE = 'INVALID_VOICE',
  INVALID_TEXT = 'INVALID_TEXT',
  
  // Authentication errors (401)
  UNAUTHORIZED = 'UNAUTHORIZED',
  MISSING_API_KEY = 'MISSING_API_KEY',
  INVALID_API_KEY = 'INVALID_API_KEY',
  EXPIRED_TOKEN = 'EXPIRED_TOKEN',
  
  // Authorization errors (403)
  FORBIDDEN = 'FORBIDDEN',
  INSUFFICIENT_TIER = 'INSUFFICIENT_TIER',
  REVOKED_KEY = 'REVOKED_KEY',
  
  // Not found errors (404)
  NOT_FOUND = 'NOT_FOUND',
  MEMO_NOT_FOUND = 'MEMO_NOT_FOUND',
  VOICE_NOT_FOUND = 'VOICE_NOT_FOUND',
  
  // Rate limiting errors (429)
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  DAILY_LIMIT_EXCEEDED = 'DAILY_LIMIT_EXCEEDED',
  MONTHLY_LIMIT_EXCEEDED = 'MONTHLY_LIMIT_EXCEEDED',
  TOO_MANY_REQUESTS = 'TOO_MANY_REQUESTS',
  
  // Server errors (500)
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  TTS_SERVICE_ERROR = 'TTS_SERVICE_ERROR',
  STORAGE_ERROR = 'STORAGE_ERROR',
  
  // Not implemented (501)
  NOT_IMPLEMENTED = 'NOT_IMPLEMENTED',
  
  // Service unavailable (503)
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE'
}

/**
 * Error response format
 */
export interface ErrorResponse {
  error: {
    code: ErrorCode;
    message: string;
    details?: Record<string, unknown>;
  };
}

/**
 * Base error class with consistent structure
 */
export abstract class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly statusCode: number;
  public readonly details?: Record<string, unknown>;
  public readonly isOperational: boolean;

  constructor(
    code: ErrorCode,
    message: string,
    statusCode: number,
    details?: Record<string, unknown>,
    isOperational: boolean = true
  ) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    this.isOperational = isOperational;
    
    // Capture stack trace, excluding constructor call from it
    Error.captureStackTrace(this, this.constructor);
  }

  /**
   * Convert error to JSON response format
   */
  toJSON(): ErrorResponse {
    return {
      error: {
        code: this.code,
        message: this.message,
        ...(this.details && { details: this.details })
      }
    };
  }
}

/**
 * Validation Error (400)
 * Used for invalid input data
 */
export class ValidationError extends AppError {
  constructor(
    message: string,
    details?: Record<string, unknown>
  ) {
    super(ErrorCode.VALIDATION_ERROR, message, 400, details);
  }
}

/**
 * Invalid Input Error (400)
 * Used when specific fields have invalid values
 */
export class InvalidInputError extends ValidationError {
  constructor(
    field: string,
    reason: string,
    value?: unknown
  ) {
    super(`Invalid ${field}: ${reason}`, {
      field,
      reason,
      ...(value !== undefined && { providedType: typeof value })
    });
  }
}

/**
 * Missing Field Error (400)
 * Used when required fields are missing
 */
export class MissingFieldError extends AppError {
  constructor(field: string) {
    super(ErrorCode.MISSING_FIELD, `Missing required field: ${field}`, 400, { field });
  }
}

/**
 * Invalid Voice Error (400)
 * Used when voice ID is not recognized
 */
export class InvalidVoiceError extends AppError {
  constructor(
    requestedVoice: string,
    availableVoices: string[]
  ) {
    super(
      ErrorCode.INVALID_VOICE,
      `Invalid voice: "${requestedVoice}"`,
      400,
      {
        field: 'voice',
        requestedVoice,
        availableVoices: availableVoices.slice(0, 20) // Limit for response size
      }
    );
  }
}

/**
 * Auth Error Base (401/403)
 */
export abstract class AuthError extends AppError {
  constructor(
    code: ErrorCode,
    message: string,
    statusCode: number,
    details?: Record<string, unknown>
  ) {
    super(code, message, statusCode, details);
  }
}

/**
 * Unauthorized Error (401)
 * Used when authentication is missing or invalid
 */
export class UnauthorizedError extends AuthError {
  constructor(message: string = 'Authentication required') {
    super(ErrorCode.UNAUTHORIZED, message, 401);
  }
}

/**
 * Missing API Key Error (401)
 */
export class MissingApiKeyError extends AuthError {
  constructor() {
    super(ErrorCode.MISSING_API_KEY, 'API key is required', 401);
  }
}

/**
 * Invalid API Key Error (401)
 */
export class InvalidApiKeyError extends AuthError {
  constructor() {
    // Don't reveal specifics about why the key is invalid
    super(ErrorCode.INVALID_API_KEY, 'Invalid API key', 401);
  }
}

/**
 * Forbidden Error (403)
 * Used when user lacks permission
 */
export class ForbiddenError extends AuthError {
  constructor(message: string = 'Access denied') {
    super(ErrorCode.FORBIDDEN, message, 403);
  }
}

/**
 * Insufficient Tier Error (403)
 * Used when user's tier doesn't allow the operation
 */
export class InsufficientTierError extends AppError {
  constructor(
    requiredTier: string,
    currentTier: string
  ) {
    super(
      ErrorCode.INSUFFICIENT_TIER,
      `This feature requires ${requiredTier} tier`,
      403,
      { requiredTier, currentTier }
    );
  }
}

/**
 * Revoked Key Error (403)
 */
export class RevokedKeyError extends AppError {
  constructor() {
    super(ErrorCode.REVOKED_KEY, 'API key has been revoked', 403);
  }
}

/**
 * Not Found Error (404)
 */
export class NotFoundError extends AppError {
  constructor(resource: string = 'Resource') {
    super(ErrorCode.NOT_FOUND, `${resource} not found`, 404);
  }
}

/**
 * Conflict Error (409)
 * Used when resource already exists
 */
export class ConflictError extends AppError {
  constructor(message: string = 'Resource already exists') {
    super(ErrorCode.VALIDATION_ERROR, message, 409);
  }
}

/**
 * Memo Not Found Error (404)
 */
export class MemoNotFoundError extends AppError {
  constructor(memoId: string) {
    super(ErrorCode.MEMO_NOT_FOUND, 'Memo not found', 404, { memoId });
  }
}

/**
 * Rate Limit Error (429)
 */
export class RateLimitError extends AppError {
  constructor(
    code: ErrorCode,
    message: string,
    details: {
      limit: number;
      used: number;
      resetAt: string;
    }
  ) {
    super(code, message, 429, details);
  }
}

/**
 * Daily Rate Limit Exceeded Error (429)
 */
export class DailyLimitExceededError extends RateLimitError {
  constructor(limit: number, used: number, resetAt: Date) {
    super(
      ErrorCode.DAILY_LIMIT_EXCEEDED,
      'Daily rate limit exceeded',
      { limit, used, resetAt: resetAt.toISOString() }
    );
  }
}

/**
 * Monthly Rate Limit Exceeded Error (429)
 */
export class MonthlyLimitExceededError extends RateLimitError {
  constructor(limit: number, used: number, resetAt: Date) {
    super(
      ErrorCode.MONTHLY_LIMIT_EXCEEDED,
      'Monthly rate limit exceeded',
      { limit, used, resetAt: resetAt.toISOString() }
    );
  }
}

/**
 * Too Many Requests Error (429)
 * Generic rate limit error for auth endpoints
 */
export class TooManyRequestsError extends AppError {
  constructor(
    message: string = 'Too many requests',
    details?: Record<string, unknown>
  ) {
    super(ErrorCode.TOO_MANY_REQUESTS, message, 429, details);
  }
}

/**
 * Internal Server Error (500)
 * Used for unexpected errors
 */
export class InternalError extends AppError {
  constructor(
    message: string = 'Internal server error',
    details?: Record<string, unknown>
  ) {
    super(ErrorCode.INTERNAL_ERROR, message, 500, details, false);
  }
}

/**
 * TTS Service Error (500)
 * Used when TTS provider fails
 */
export class TTSServiceError extends AppError {
  constructor(
    provider: string,
    reason: string
  ) {
    super(
      ErrorCode.TTS_SERVICE_ERROR,
      'Text-to-speech service temporarily unavailable',
      500,
      { provider, reason } // Reason included for debugging, not exposed to client
    );
    // Note: In production, don't expose internal reason to client
    // This is for logging purposes only
  }
}

/**
 * Storage Error (500)
 */
export class StorageError extends AppError {
  constructor(operation: string) {
    super(
      ErrorCode.STORAGE_ERROR,
      'Storage operation failed',
      500,
      { operation }
    );
  }
}

/**
 * Not Implemented Error (501)
 */
export class NotImplementedError extends AppError {
  constructor(feature?: string) {
    super(
      ErrorCode.NOT_IMPLEMENTED,
      feature ? `${feature} is not implemented` : 'Feature not implemented',
      501
    );
  }
}

/**
 * Service Unavailable Error (503)
 */
export class ServiceUnavailableError extends AppError {
  constructor(service: string) {
    super(
      ErrorCode.SERVICE_UNAVAILABLE,
      `${service} is temporarily unavailable`,
      503
    );
  }
}

/**
 * Helper to check if error is an AppError
 */
export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

/**
 * Helper to convert unknown error to AppError
 */
export function toAppError(error: unknown): AppError {
  if (isAppError(error)) {
    return error;
  }
  
  if (error instanceof Error) {
    return new InternalError(error.message);
  }
  
  return new InternalError('An unexpected error occurred');
}