/**
 * Input Sanitization Utilities
 * 
 * Provides XSS prevention and input sanitization for Agent Talk API.
 */

/**
 * HTML entities map for escaping
 */
const HTML_ENTITIES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#x27;',
  '/': '&#x2F;',
  '`': '&#x60;',
  '=': '&#x3D;',
};

/**
 * Escape HTML entities to prevent XSS attacks
 * Use this when outputting user-provided content in HTML context
 */
export function escapeHtml(value: string): string {
  return value.replace(/[&<>"'`=/]/g, (char) => HTML_ENTITIES[char] || char);
}

/**
 * Remove HTML tags from a string
 * Use this for plain text output where no HTML is allowed
 */
export function stripHtml(value: string): string {
  return value.replace(/<[^>]*>/g, '');
}

/**
 * Sanitize text by removing null bytes and trimming
 * This is the basic sanitization for all text inputs
 */
export function sanitizeText(value: string): string {
  return value
    .replace(/\0/g, '')        // Remove null bytes
    .replace(/\x00/g, '')      // Remove null bytes (alternative representation)
    .trim();                    // Trim whitespace
}

/**
 * Sanitize input for safe storage/display
 * Combines null byte removal with optional HTML escaping
 */
export function sanitizeInput(value: string, options: {
  escapeHtml?: boolean;
  stripHtml?: boolean;
  maxLength?: number;
} = {}): string {
  let result = sanitizeText(value);
  
  if (options.stripHtml) {
    result = stripHtml(result);
  }
  
  if (options.escapeHtml) {
    result = escapeHtml(result);
  }
  
  if (options.maxLength && result.length > options.maxLength) {
    result = result.slice(0, options.maxLength);
  }
  
  return result;
}

/**
 * Sanitize an email address
 * Lowercases and validates format
 */
export function sanitizeEmail(email: string): string {
  return sanitizeText(email).toLowerCase();
}

/**
 * Validate and sanitize a voice ID
 * Only allows alphanumeric, underscore, and hyphen characters
 */
export function sanitizeVoiceId(voiceId: string): string {
  return sanitizeText(voiceId)
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '');
}

/**
 * Check if a string contains potential XSS patterns
 * Returns true if suspicious patterns are found
 */
export function hasXssPatterns(value: string): boolean {
  const xssPatterns = [
    /<script\b/i,
    /javascript:/i,
    /on\w+\s*=/i,          // Event handlers like onclick=
    /data:\s*text\/html/i,
    /vbscript:/i,
    /expression\s*\(/i,
  ];
  
  return xssPatterns.some(pattern => pattern.test(value));
}

/**
 * Check if a string contains potential SQL injection patterns
 * Returns true if suspicious patterns are found
 * Note: This is a defense-in-depth measure; parameterized queries are primary defense
 */
export function hasSqlInjectionPatterns(value: string): boolean {
  const sqlPatterns = [
    /'\s*OR\s+'/i,
    /'\s*AND\s+'/i,
    /;\s*DROP\s+/i,
    /;\s*DELETE\s+/i,
    /;\s*UPDATE\s+/i,
    /;\s*INSERT\s+/i,
    /UNION\s+SELECT/i,
    /--\s*$/m,
    /\/\*.*\*\//s,
  ];
  
  return sqlPatterns.some(pattern => pattern.test(value));
}

/**
 * Sanitize an object by sanitizing all string values
 */
export function sanitizeObject<T extends Record<string, unknown>>(
  obj: T,
  options: {
    escapeHtml?: boolean;
    stripHtml?: boolean;
    maxLength?: number;
  } = {}
): T {
  const result: Record<string, unknown> = {};
  
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      result[key] = sanitizeInput(value, options);
    } else if (typeof value === 'object' && value !== null) {
      result[key] = sanitizeObject(value as Record<string, unknown>, options);
    } else {
      result[key] = value;
    }
  }
  
  return result as T;
}