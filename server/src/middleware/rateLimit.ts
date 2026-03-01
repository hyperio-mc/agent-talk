/**
 * Rate Limiting Middleware
 * 
 * Enforces tier-based rate limits and adds X-RateLimit-* headers.
 * Uses database-backed storage for persistence across restarts.
 */

import { Context, Next } from 'hono';
import { 
  checkRateLimit, 
  incrementUsage, 
  getRateLimitHeaders,
  getNextMidnightUTC,
  getUserUsageCount,
  TIER_LIMITS,
  Tier 
} from '../services/rateLimit.js';
import { DailyLimitExceededError } from '../errors/index.js';
import { findUserById } from '../db-stub/users.js';
import { isAdmin } from './admin.js';

// Extend Hono's context with rate limit info
declare module 'hono' {
  interface ContextVariableMap {
    rateLimitInfo?: {
      limit: number;
      remaining: number;
      resetAt: Date;
      keyId: string;
    };
    apiKey?: {
      keyId: string;
      userId: string;
    };
  }
}

/**
 * Rate limit middleware for API key authenticated requests
 * 
 * Prerequisites:
 * - API key must be validated before this middleware
 * - c.var.apiKey must be set with { keyId, userId }
 */
export async function rateLimitMiddleware(c: Context, next: Next) {
  // Get API key info from context (set by API key auth)
  const apiKeyInfo = c.get('apiKey');
  
  if (!apiKeyInfo) {
    // If no API key info, skip rate limiting (shouldn't happen in normal flow)
    await next();
    return;
  }
  
  const { keyId, userId } = apiKeyInfo;
  
  // Admin bypass - admins are not rate limited
  if (await isAdmin(userId)) {
    c.header('X-RateLimit-Limit', 'unlimited');
    c.header('X-RateLimit-Remaining', 'unlimited');
    c.header('X-RateLimit-Reset', String(Math.floor(getNextMidnightUTC().getTime() / 1000)));
    await next();
    return;
  }
  
  // Get user to determine tier
  const user = await findUserById(userId);
  if (!user) {
    // User not found - this shouldn't happen if auth is working
    await next();
    return;
  }
  
  const tier = user.tier as Tier;
  
  // Check rate limit (async - fetches actual usage from db)
  const result = await checkRateLimit(keyId, userId, tier);
  
  // Add rate limit headers to response
  const headers = getRateLimitHeaders(result.info);
  for (const [key, value] of Object.entries(headers)) {
    c.header(key, value, { append: true });
  }
  
  if (!result.allowed) {
    // Set Retry-After header (seconds until reset)
    const retryAfter = Math.ceil((result.info.resetAt.getTime() - Date.now()) / 1000);
    c.header('Retry-After', String(retryAfter));
    
    throw new DailyLimitExceededError(
      result.info.limit,
      result.info.used,
      result.info.resetAt
    );
  }
  
  // Store rate limit info for post-request increment
  c.set('rateLimitInfo', {
    limit: result.info.limit,
    remaining: result.info.remaining,
    resetAt: result.info.resetAt,
    keyId,
  });
  
  await next();
  
  // After the request is processed successfully, increment usage
  // Only increment if the request didn't throw an error
  await incrementUsage(keyId, userId);
}

/**
 * Simple rate limiter that checks and increments in one call
 * Use this when you don't need to track request success/failure separately
 */
export async function simpleRateLimit(
  c: Context,
  keyId: string,
  userId: string
): Promise<void> {
  // Get user to determine tier
  const user = await findUserById(userId);
  if (!user) {
    return; // Skip rate limiting if user not found
  }
  
  // Admin bypass - admins are not rate limited
  if (await isAdmin(userId)) {
    // Set unlimited headers for admin users
    c.header('X-RateLimit-Limit', 'unlimited');
    c.header('X-RateLimit-Remaining', 'unlimited');
    c.header('X-RateLimit-Reset', String(Math.floor(getNextMidnightUTC().getTime() / 1000)));
    return;
  }
  
  const tier = user.tier as Tier;
  
  // Check rate limit first (async - gets actual usage from db)
  const result = await checkRateLimit(keyId, userId, tier);
  
  // Add rate limit headers to response
  const headers = getRateLimitHeaders(result.info);
  for (const [key, value] of Object.entries(headers)) {
    c.header(key, value, { append: true });
  }
  
  if (!result.allowed) {
    const retryAfter = Math.ceil((result.info.resetAt.getTime() - Date.now()) / 1000);
    c.header('Retry-After', String(retryAfter));
    
    throw new DailyLimitExceededError(
      result.info.limit,
      result.info.used,
      result.info.resetAt
    );
  }
  
  // Increment usage immediately
  const newCount = await incrementUsage(keyId, userId);
  
  // Update remaining header after increment
  const newRemaining = result.info.limit === -1 ? -1 : Math.max(0, result.info.limit - newCount);
  c.header('X-RateLimit-Remaining', newRemaining === -1 ? 'unlimited' : String(newRemaining));
}

/**
 * Get rate limit info for a specific user/key
 * Useful for displaying usage in UI
 */
export async function getRateLimitStatus(
  userId: string,
  tier: Tier
): Promise<{
  limit: number;
  used: number;
  remaining: number;
  resetAt: Date;
}> {
  const limit = TIER_LIMITS[tier];
  const used = await getUserUsageCount(userId);
  const remaining = limit === Infinity ? -1 : Math.max(0, limit - used);
  const resetAt = getNextMidnightUTC();
  
  return {
    limit: limit === Infinity ? -1 : limit,
    used,
    remaining,
    resetAt,
  };
}
