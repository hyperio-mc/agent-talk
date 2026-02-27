/**
 * Input Validation Middleware
 * 
 * Features:
 * - Input length limits (text, voice parameters)
 * - Type validation
 * - Sanitization helpers
 * - XSS prevention
 */

import { Context, Next } from 'hono';
import { ValidationError, InvalidInputError, MissingFieldError } from '../errors/index.js';

// Configuration
export const VALIDATION_LIMITS = {
  // Text input limits
  TEXT_MAX_LENGTH: 5000,        // Max characters for TTS text
  TEXT_MIN_LENGTH: 1,           // Min characters (must have something to speak)
  
  // Field length limits
  EMAIL_MAX_LENGTH: 255,
  PASSWORD_MIN_LENGTH: 8,
  PASSWORD_MAX_LENGTH: 128,
  NAME_MAX_LENGTH: 100,
  API_KEY_NAME_MAX_LENGTH: 100,
  
  // Voice parameters
  VOICE_ID_MAX_LENGTH: 50,
};

/**
 * Validation options for request body
 */
export interface ValidationOptions {
  /** Maximum text length for TTS */
  maxTextLength?: number;
  /** Allowed fields in request body */
  allowedFields?: string[];
  /** Required fields */
  requiredFields?: string[];
  /** Fields that must be strings */
  stringFields?: string[];
}

/**
 * Sanitize a string by trimming and removing null bytes
 */
export function sanitizeString(value: string): string {
  return value
    .replace(/\0/g, '')        // Remove null bytes
    .trim();                    // Trim whitespace
}

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email) && email.length <= VALIDATION_LIMITS.EMAIL_MAX_LENGTH;
}

/**
 * Validate password strength
 */
export function isValidPassword(password: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (password.length < VALIDATION_LIMITS.PASSWORD_MIN_LENGTH) {
    errors.push(`Password must be at least ${VALIDATION_LIMITS.PASSWORD_MIN_LENGTH} characters`);
  }
  
  if (password.length > VALIDATION_LIMITS.PASSWORD_MAX_LENGTH) {
    errors.push(`Password must be at most ${VALIDATION_LIMITS.PASSWORD_MAX_LENGTH} characters`);
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Escape HTML entities to prevent XSS
 */
export function escapeHtml(value: string): string {
  const htmlEntities: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
    '/': '&#x2F;',
  };
  
  return value.replace(/[&<>"'/]/g, (char) => htmlEntities[char] || char);
}

/**
 * Validate TTS text input
 */
export function validateText(text: unknown, maxLength: number = VALIDATION_LIMITS.TEXT_MAX_LENGTH): string {
  // Check presence
  if (text === undefined || text === null || text === '') {
    throw new MissingFieldError('text');
  }
  
  // Check type
  if (typeof text !== 'string') {
    throw new InvalidInputError('text', 'expected string', text);
  }
  
  // Sanitize
  const sanitized = sanitizeString(text);
  
  // Check length
  if (sanitized.length < VALIDATION_LIMITS.TEXT_MIN_LENGTH) {
    throw new ValidationError('Text is too short', { 
      field: 'text',
      minLength: VALIDATION_LIMITS.TEXT_MIN_LENGTH,
      providedLength: sanitized.length 
    });
  }
  
  if (sanitized.length > maxLength) {
    throw new ValidationError('Text exceeds maximum length', { 
      field: 'text',
      maxLength,
      providedLength: sanitized.length 
    });
  }
  
  return sanitized;
}

/**
 * Validate voice ID input
 */
export function validateVoice(voice: unknown): string {
  // Check presence
  if (voice === undefined || voice === null || voice === '') {
    throw new MissingFieldError('voice');
  }
  
  // Check type
  if (typeof voice !== 'string') {
    throw new InvalidInputError('voice', 'expected string', voice);
  }
  
  // Sanitize
  const sanitized = sanitizeString(voice);
  
  // Check length
  if (sanitized.length > VALIDATION_LIMITS.VOICE_ID_MAX_LENGTH) {
    throw new ValidationError('Voice ID is too long', { 
      field: 'voice',
      maxLength: VALIDATION_LIMITS.VOICE_ID_MAX_LENGTH,
      providedLength: sanitized.length 
    });
  }
  
  return sanitized.toLowerCase();
}

/**
 * Validate email input
 */
export function validateEmail(email: unknown): string {
  // Check presence
  if (email === undefined || email === null || email === '') {
    throw new MissingFieldError('email');
  }
  
  // Check type
  if (typeof email !== 'string') {
    throw new InvalidInputError('email', 'expected string', email);
  }
  
  // Sanitize
  const sanitized = sanitizeString(email).toLowerCase();
  
  // Check format
  if (!isValidEmail(sanitized)) {
    throw new ValidationError('Invalid email format', { field: 'email' });
  }
  
  return sanitized;
}

/**
 * Validate password input
 */
export function validatePassword(password: unknown): string {
  // Check presence
  if (password === undefined || password === null || password === '') {
    throw new MissingFieldError('password');
  }
  
  // Check type
  if (typeof password !== 'string') {
    throw new InvalidInputError('password', 'expected string', typeof password);
  }
  
  // Validate strength
  const validation = isValidPassword(password);
  if (!validation.valid) {
    throw new ValidationError(validation.errors.join(', '), { field: 'password' });
  }
  
  return password;
}

/**
 * Validate generic string field
 */
export function validateStringField(
  value: unknown, 
  fieldName: string, 
  options: { required?: boolean; maxLength?: number; minLength?: number } = {}
): string | null {
  const { required = false, maxLength, minLength } = options;
  
  // Check presence
  if (value === undefined || value === null || value === '') {
    if (required) {
      throw new MissingFieldError(fieldName);
    }
    return null;
  }
  
  // Check type
  if (typeof value !== 'string') {
    throw new InvalidInputError(fieldName, 'expected string', typeof value);
  }
  
  // Sanitize
  const sanitized = sanitizeString(value);
  
  // Check length constraints
  if (minLength !== undefined && sanitized.length < minLength) {
    throw new ValidationError(`${fieldName} is too short`, { 
      field: fieldName,
      minLength,
      providedLength: sanitized.length 
    });
  }
  
  if (maxLength !== undefined && sanitized.length > maxLength) {
    throw new ValidationError(`${fieldName} exceeds maximum length`, { 
      field: fieldName,
      maxLength,
      providedLength: sanitized.length 
    });
  }
  
  return sanitized;
}

/**
 * Validate request body size
 */
export function validateBodySize(maxSizeBytes: number = 1024 * 1024): (c: Context, next: Next) => Promise<void> {
  return async (c: Context, next: Next) => {
    const contentLength = c.req.header('Content-Length');
    
    if (contentLength) {
      const size = parseInt(contentLength, 10);
      if (size > maxSizeBytes) {
        throw new ValidationError('Request body too large', {
          maxSize: maxSizeBytes,
          providedSize: size
        });
      }
    }
    
    await next();
  };
}

/**
 * Validate field types in request body
 */
export function validateFieldTypes(
  c: Context,
  body: Record<string, unknown>,
  fieldTypes: Record<string, 'string' | 'number' | 'boolean' | 'object' | 'array'>
): void {
  for (const [field, expectedType] of Object.entries(fieldTypes)) {
    const value = body[field];
    
    if (value === undefined) continue; // Skip missing fields
    
    let valid = false;
    switch (expectedType) {
      case 'string':
        valid = typeof value === 'string';
        break;
      case 'number':
        valid = typeof value === 'number' && !isNaN(value);
        break;
      case 'boolean':
        valid = typeof value === 'boolean';
        break;
      case 'object':
        valid = typeof value === 'object' && value !== null && !Array.isArray(value);
        break;
      case 'array':
        valid = Array.isArray(value);
        break;
    }
    
    if (!valid) {
      throw new InvalidInputError(field, `expected ${expectedType}`, typeof value);
    }
  }
}

/**
 * Check for unexpected fields in request body
 */
export function checkUnexpectedFields(
  body: Record<string, unknown>,
  allowedFields: string[]
): void {
  const unexpectedFields = Object.keys(body).filter(key => !allowedFields.includes(key));
  
  if (unexpectedFields.length > 0) {
    throw new ValidationError('Unexpected fields in request', {
      unexpectedFields,
      allowedFields
    });
  }
}
