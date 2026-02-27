/**
 * Agent Talk SDK - Custom Error Classes
 */

import type { ErrorCode, ErrorDetails } from './types.js';

/**
 * Base error class for all Agent Talk errors
 */
export class AgentTalkError extends Error {
  public readonly code: ErrorCode;
  public readonly statusCode: number;
  public readonly details?: ErrorDetails;

  constructor(
    code: ErrorCode,
    message: string,
    statusCode: number = 500,
    details?: ErrorDetails
  ) {
    super(message);
    this.name = 'AgentTalkError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    
    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, AgentTalkError);
    }
  }
}

/**
 * Validation errors (400)
 */
export class ValidationError extends AgentTalkError {
  constructor(message: string, details?: ErrorDetails) {
    super('VALIDATION_ERROR' as ErrorCode, message, 400, details);
    this.name = 'ValidationError';
  }
}

export class InvalidInputError extends AgentTalkError {
  constructor(field: string, reason: string, providedType?: string) {
    super('INVALID_INPUT' as ErrorCode, `Invalid ${field}: ${reason}`, 400, {
      field,
      reason,
      providedType,
    });
    this.name = 'InvalidInputError';
  }
}

export class MissingFieldError extends AgentTalkError {
  constructor(field: string) {
    super('MISSING_FIELD' as ErrorCode, `Missing required field: ${field}`, 400, { field });
    this.name = 'MissingFieldError';
  }
}

export class InvalidVoiceError extends AgentTalkError {
  constructor(requestedVoice: string, availableVoices: string[]) {
    super('INVALID_VOICE' as ErrorCode, `Invalid voice: "${requestedVoice}"`, 400, {
      field: 'voice',
      requestedVoice,
      availableVoices,
    });
    this.name = 'InvalidVoiceError';
  }
}

/**
 * Authentication errors (401)
 */
export class UnauthorizedError extends AgentTalkError {
  constructor(message: string = 'Authentication required') {
    super('UNAUTHORIZED' as ErrorCode, message, 401);
    this.name = 'UnauthorizedError';
  }
}

export class MissingApiKeyError extends AgentTalkError {
  constructor() {
    super('MISSING_API_KEY' as ErrorCode, 'API key is required', 401);
    this.name = 'MissingApiKeyError';
  }
}

export class InvalidApiKeyError extends AgentTalkError {
  constructor() {
    super('INVALID_API_KEY' as ErrorCode, 'Invalid API key', 401);
    this.name = 'InvalidApiKeyError';
  }
}

export class ExpiredTokenError extends AgentTalkError {
  constructor() {
    super('EXPIRED_TOKEN' as ErrorCode, 'Token has expired', 401);
    this.name = 'ExpiredTokenError';
  }
}

/**
 * Authorization errors (403)
 */
export class ForbiddenError extends AgentTalkError {
  constructor(message: string = 'Access denied') {
    super('FORBIDDEN' as ErrorCode, message, 403);
    this.name = 'ForbiddenError';
  }
}

export class InsufficientTierError extends AgentTalkError {
  constructor(requiredTier: string, currentTier: string) {
    super('INSUFFICIENT_TIER' as ErrorCode, `This feature requires ${requiredTier} tier`, 403, {
      requiredTier,
      currentTier,
    });
    this.name = 'InsufficientTierError';
  }
}

export class RevokedKeyError extends AgentTalkError {
  constructor() {
    super('REVOKED_KEY' as ErrorCode, 'API key has been revoked', 403);
    this.name = 'RevokedKeyError';
  }
}

/**
 * Not found errors (404)
 */
export class NotFoundError extends AgentTalkError {
  constructor(resource: string = 'Resource') {
    super('NOT_FOUND' as ErrorCode, `${resource} not found`, 404);
    this.name = 'NotFoundError';
  }
}

export class MemoNotFoundError extends AgentTalkError {
  constructor(memoId: string) {
    super('MEMO_NOT_FOUND' as ErrorCode, 'Memo not found', 404, { memoId });
    this.name = 'MemoNotFoundError';
  }
}

/**
 * Rate limiting errors (429)
 */
export class RateLimitError extends AgentTalkError {
  constructor(message: string = 'Rate limit exceeded') {
    super('RATE_LIMIT_EXCEEDED' as ErrorCode, message, 429);
    this.name = 'RateLimitError';
  }
}

export class DailyLimitExceededError extends AgentTalkError {
  constructor(limit: number, used: number, resetAt: string) {
    super('DAILY_LIMIT_EXCEEDED' as ErrorCode, 'Daily rate limit exceeded', 429, {
      limit,
      used,
      resetAt,
    });
    this.name = 'DailyLimitExceededError';
  }
}

export class MonthlyLimitExceededError extends AgentTalkError {
  constructor(limit: number, used: number, resetAt: string) {
    super('MONTHLY_LIMIT_EXCEEDED' as ErrorCode, 'Monthly rate limit exceeded', 429, {
      limit,
      used,
      resetAt,
    });
    this.name = 'MonthlyLimitExceededError';
  }
}

/**
 * Server errors (500)
 */
export class InternalError extends AgentTalkError {
  constructor(message: string = 'Internal server error') {
    super('INTERNAL_ERROR' as ErrorCode, message, 500);
    this.name = 'InternalError';
  }
}

export class TTSServiceError extends AgentTalkError {
  constructor(message: string = 'Text-to-speech service error') {
    super('TTS_SERVICE_ERROR' as ErrorCode, message, 500);
    this.name = 'TTSServiceError';
  }
}

export class StorageError extends AgentTalkError {
  constructor(operation: string) {
    super('STORAGE_ERROR' as ErrorCode, 'Storage operation failed', 500, { operation });
    this.name = 'StorageError';
  }
}

/**
 * Not implemented error (501)
 */
export class NotImplementedError extends AgentTalkError {
  constructor(feature: string) {
    super('NOT_IMPLEMENTED' as ErrorCode, `${feature} is not implemented`, 501);
    this.name = 'NotImplementedError';
  }
}

/**
 * Service unavailable error (503)
 */
export class ServiceUnavailableError extends AgentTalkError {
  constructor(message: string = 'Service unavailable') {
    super('SERVICE_UNAVAILABLE' as ErrorCode, message, 503);
    this.name = 'ServiceUnavailableError';
  }
}

/**
 * Create appropriate error from API response
 */
export function createErrorFromResponse(statusCode: number, errorResponse: { error: { code: string; message: string; details?: ErrorDetails } }): AgentTalkError {
  const { code, message, details } = errorResponse.error;
  
  switch (code) {
    // Validation errors
    case 'VALIDATION_ERROR':
      return new ValidationError(message, details);
    case 'INVALID_INPUT':
      return new InvalidInputError(details?.field || 'unknown', details?.reason || message, details?.providedType);
    case 'MISSING_FIELD':
      return new MissingFieldError(details?.field || 'unknown');
    case 'INVALID_VOICE':
      return new InvalidVoiceError(details?.requestedVoice || '', details?.availableVoices || []);
    
    // Authentication errors
    case 'UNAUTHORIZED':
      return new UnauthorizedError(message);
    case 'MISSING_API_KEY':
      return new MissingApiKeyError();
    case 'INVALID_API_KEY':
      return new InvalidApiKeyError();
    case 'EXPIRED_TOKEN':
      return new ExpiredTokenError();
    
    // Authorization errors
    case 'FORBIDDEN':
      return new ForbiddenError(message);
    case 'INSUFFICIENT_TIER':
      return new InsufficientTierError(details?.requiredTier || '', details?.currentTier || '');
    case 'REVOKED_KEY':
      return new RevokedKeyError();
    
    // Not found errors
    case 'NOT_FOUND':
      return new NotFoundError(message);
    case 'MEMO_NOT_FOUND':
      return new MemoNotFoundError(details?.field || '');
    
    // Rate limiting errors
    case 'RATE_LIMIT_EXCEEDED':
      return new RateLimitError(message);
    case 'DAILY_LIMIT_EXCEEDED':
      return new DailyLimitExceededError(details?.limit || 0, details?.used || 0, details?.resetAt || '');
    case 'MONTHLY_LIMIT_EXCEEDED':
      return new MonthlyLimitExceededError(details?.limit || 0, details?.used || 0, details?.resetAt || '');
    
    // Server errors
    case 'INTERNAL_ERROR':
      return new InternalError(message);
    case 'TTS_SERVICE_ERROR':
      return new TTSServiceError(message);
    case 'STORAGE_ERROR':
      return new StorageError(details?.operation || 'unknown');
    
    // Not implemented
    case 'NOT_IMPLEMENTED':
      return new NotImplementedError(message);
    
    // Service unavailable
    case 'SERVICE_UNAVAILABLE':
      return new ServiceUnavailableError(message);
    
    // Unknown error code
    default:
      return new AgentTalkError(code as ErrorCode, message, statusCode, details);
  }
}
