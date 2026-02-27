/**
 * Auth Rate Limiting Middleware
 * 
 * Prevents brute force attacks on authentication endpoints.
 * Uses IP-based rate limiting with stricter limits than API rate limiting.
 */

import { Context, Next } from 'hono';
import { TooManyRequestsError } from '../errors/index.js';

// Extend Hono's context with auth rate limit info
declare module 'hono' {
  interface ContextVariableMap {
    authRateLimitIp?: string;
  }
}

// Configuration
const AUTH_RATE_LIMITS = {
  // Maximum failed login attempts per IP per 15 minutes
  MAX_LOGIN_ATTEMPTS: 5,
  // Window for counting failed attempts (milliseconds)
  LOGIN_WINDOW_MS: 15 * 60 * 1000, // 15 minutes
  
  // Maximum signup attempts per IP per hour
  MAX_SIGNUP_ATTEMPTS: 3,
  // Window for signup attempts
  SIGNUP_WINDOW_MS: 60 * 60 * 1000, // 1 hour
  
  // Maximum password reset attempts per IP per hour
  MAX_RESET_ATTEMPTS: 3,
  RESET_WINDOW_MS: 60 * 60 * 1000, // 1 hour
};

// In-memory rate limit tracking
// Keyed by IP address
interface RateLimitEntry {
  count: number;
  firstAttempt: number;
  blocked: boolean;
  blockedUntil?: number;
}

const loginAttempts = new Map<string, RateLimitEntry>();
const signupAttempts = new Map<string, RateLimitEntry>();
const resetAttempts = new Map<string, RateLimitEntry>();

/**
 * Get client IP from request
 */
function getClientIp(c: Context): string {
  // Check X-Forwarded-For header (for proxies/load balancers)
  const forwardedFor = c.req.header('X-Forwarded-For');
  if (forwardedFor) {
    // Use the first IP in the chain (original client)
    return forwardedFor.split(',')[0].trim();
  }
  
  // Check X-Real-IP header (for nginx)
  const realIp = c.req.header('X-Real-IP');
  if (realIp) {
    return realIp;
  }
  
  // Fallback to a default (Hono doesn't expose remote address directly)
  return 'unknown';
}

/**
 * Check if an IP is rate limited
 */
function checkRateLimit(
  attemptsMap: Map<string, RateLimitEntry>,
  ip: string,
  maxAttempts: number,
  windowMs: number
): { allowed: boolean; remaining: number; resetAt: Date } {
  const now = Date.now();
  const entry = attemptsMap.get(ip);
  
  if (entry) {
    // Check if currently blocked
    if (entry.blocked && entry.blockedUntil && now < entry.blockedUntil) {
      return {
        allowed: false,
        remaining: 0,
        resetAt: new Date(entry.blockedUntil),
      };
    }
    
    // Check if window has expired
    if (now - entry.firstAttempt > windowMs) {
      // Reset the window
      attemptsMap.delete(ip);
    } else if (entry.count >= maxAttempts) {
      // Block the IP
      entry.blocked = true;
      entry.blockedUntil = now + windowMs;
      return {
        allowed: false,
        remaining: 0,
        resetAt: new Date(entry.blockedUntil),
      };
    }
  }
  
  const currentEntry = attemptsMap.get(ip);
  const currentCount = currentEntry?.count || 0;
  const remaining = Math.max(0, maxAttempts - currentCount - 1);
  const resetAt = currentEntry 
    ? new Date(currentEntry.firstAttempt + windowMs)
    : new Date(now + windowMs);
  
  return { allowed: true, remaining, resetAt };
}

/**
 * Record an attempt (increment counter)
 */
function recordAttempt(
  attemptsMap: Map<string, RateLimitEntry>,
  ip: string,
  windowMs: number
): void {
  const now = Date.now();
  const entry = attemptsMap.get(ip);
  
  if (entry) {
    // Check if window has expired
    if (now - entry.firstAttempt > windowMs) {
      // Reset the window
      attemptsMap.set(ip, {
        count: 1,
        firstAttempt: now,
        blocked: false,
      });
    } else {
      entry.count += 1;
    }
  } else {
    attemptsMap.set(ip, {
      count: 1,
      firstAttempt: now,
      blocked: false,
    });
  }
}

/**
 * Clear an IP's rate limit (after successful login)
 */
function clearRateLimit(
  attemptsMap: Map<string, RateLimitEntry>,
  ip: string
): void {
  attemptsMap.delete(ip);
}

/**
 * Clean up old entries (call periodically)
 */
function cleanupOldEntries(): void {
  const now = Date.now();
  
  for (const [ip, entry] of loginAttempts) {
    if (now - entry.firstAttempt > AUTH_RATE_LIMITS.LOGIN_WINDOW_MS) {
      loginAttempts.delete(ip);
    }
  }
  
  for (const [ip, entry] of signupAttempts) {
    if (now - entry.firstAttempt > AUTH_RATE_LIMITS.SIGNUP_WINDOW_MS) {
      signupAttempts.delete(ip);
    }
  }
  
  for (const [ip, entry] of resetAttempts) {
    if (now - entry.firstAttempt > AUTH_RATE_LIMITS.RESET_WINDOW_MS) {
      resetAttempts.delete(ip);
    }
  }
}

// Run cleanup every 5 minutes
setInterval(cleanupOldEntries, 5 * 60 * 1000);

/**
 * Rate limit middleware for login endpoint
 * Limits: 5 attempts per 15 minutes per IP
 */
export async function loginRateLimit(c: Context, next: Next): Promise<void> {
  const ip = getClientIp(c);
  const { allowed, remaining, resetAt } = checkRateLimit(
    loginAttempts,
    ip,
    AUTH_RATE_LIMITS.MAX_LOGIN_ATTEMPTS,
    AUTH_RATE_LIMITS.LOGIN_WINDOW_MS
  );
  
  // Add rate limit headers
  c.header('X-RateLimit-Limit', String(AUTH_RATE_LIMITS.MAX_LOGIN_ATTEMPTS));
  c.header('X-RateLimit-Remaining', String(remaining));
  c.header('X-RateLimit-Reset', String(Math.floor(resetAt.getTime() / 1000)));
  
  if (!allowed) {
    const retryAfter = Math.ceil((resetAt.getTime() - Date.now()) / 1000);
    c.header('Retry-After', String(retryAfter));
    
    throw new TooManyRequestsError(
      'Too many login attempts. Please try again later.',
      { retryAfter: resetAt }
    );
  }
  
  // Store IP for recording after failed login
  c.set('authRateLimitIp', ip);
  
  await next();
}

/**
 * Rate limit middleware for signup endpoint
 * Limits: 3 attempts per hour per IP
 */
export async function signupRateLimit(c: Context, next: Next): Promise<void> {
  const ip = getClientIp(c);
  const { allowed, remaining, resetAt } = checkRateLimit(
    signupAttempts,
    ip,
    AUTH_RATE_LIMITS.MAX_SIGNUP_ATTEMPTS,
    AUTH_RATE_LIMITS.SIGNUP_WINDOW_MS
  );
  
  c.header('X-RateLimit-Limit', String(AUTH_RATE_LIMITS.MAX_SIGNUP_ATTEMPTS));
  c.header('X-RateLimit-Remaining', String(remaining));
  c.header('X-RateLimit-Reset', String(Math.floor(resetAt.getTime() / 1000)));
  
  if (!allowed) {
    const retryAfter = Math.ceil((resetAt.getTime() - Date.now()) / 1000);
    c.header('Retry-After', String(retryAfter));
    
    throw new TooManyRequestsError(
      'Too many signup attempts. Please try again later.',
      { retryAfter: resetAt }
    );
  }
  
  await next();
}

/**
 * Rate limit middleware for password reset endpoint
 * Limits: 3 attempts per hour per IP
 */
export async function passwordResetRateLimit(c: Context, next: Next): Promise<void> {
  const ip = getClientIp(c);
  const { allowed, remaining, resetAt } = checkRateLimit(
    resetAttempts,
    ip,
    AUTH_RATE_LIMITS.MAX_RESET_ATTEMPTS,
    AUTH_RATE_LIMITS.RESET_WINDOW_MS
  );
  
  c.header('X-RateLimit-Limit', String(AUTH_RATE_LIMITS.MAX_RESET_ATTEMPTS));
  c.header('X-RateLimit-Remaining', String(remaining));
  c.header('X-RateLimit-Reset', String(Math.floor(resetAt.getTime() / 1000)));
  
  if (!allowed) {
    const retryAfter = Math.ceil((resetAt.getTime() - Date.now()) / 1000);
    c.header('Retry-After', String(retryAfter));
    
    throw new TooManyRequestsError(
      'Too many password reset attempts. Please try again later.',
      { retryAfter: resetAt }
    );
  }
  
  await next();
}

/**
 * Record a failed login attempt
 * Call this after a failed login authentication
 */
export function recordFailedLogin(ip: string): void {
  recordAttempt(loginAttempts, ip, AUTH_RATE_LIMITS.LOGIN_WINDOW_MS);
}

/**
 * Record a failed signup attempt
 */
export function recordFailedSignup(ip: string): void {
  recordAttempt(signupAttempts, ip, AUTH_RATE_LIMITS.SIGNUP_WINDOW_MS);
}

/**
 * Clear rate limit after successful login
 */
export function clearLoginRateLimit(ip: string): void {
  clearRateLimit(loginAttempts, ip);
}