/**
 * Rate Limiting Service for Agent Talk API
 * 
 * Tracks API usage per key and enforces tier-based limits.
 * Daily counters reset at midnight UTC.
 */

import { getDb } from '../db/index.js';
import { DailyLimitExceededError } from '../errors/index.js';
import { TIER_LIMITS, TierName } from '../config/tiers.js';

// Re-export for backward compatibility
export { TIER_LIMITS } from '../config/tiers.js';

// Type alias for backward compatibility
export type Tier = TierName;

export interface RateLimitInfo {
  limit: number;
  used: number;
  remaining: number;
  resetAt: Date;
}

export interface RateLimitResult {
  allowed: boolean;
  info: RateLimitInfo;
}

/**
 * Get the start of the next day in UTC (midnight)
 */
export function getNextMidnightUTC(): Date {
  const now = new Date();
  const tomorrow = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() + 1,
    0, 0, 0, 0
  ));
  return tomorrow;
}

/**
 * Get today's date string in UTC (YYYY-MM-DD format)
 */
function getTodayUTC(): string {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-${String(now.getUTCDate()).padStart(2, '0')}`;
}

/**
 * Initialize the rate limits table if it doesn't exist
 */
function ensureRateLimitTable(): void {
  const db = getDb();
  
  db.exec(`
    CREATE TABLE IF NOT EXISTS rate_limits (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      api_key_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      date TEXT NOT NULL,
      count INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      UNIQUE(api_key_id, date)
    )
  `);
  
  // Create index for faster lookups
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_rate_limits_api_key_date 
    ON rate_limits(api_key_id, date)
  `);
  
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_rate_limits_user_date 
    ON rate_limits(user_id, date)
  `);
}

/**
 * Get current usage count for an API key today
 */
export function getUsageCount(apiKeyId: string): number {
  ensureRateLimitTable();
  
  const db = getDb();
  const today = getTodayUTC();
  
  const stmt = db.prepare(`
    SELECT count FROM rate_limits 
    WHERE api_key_id = ? AND date = ?
  `);
  
  const row = stmt.get(apiKeyId, today) as { count: number } | undefined;
  return row?.count || 0;
}

/**
 * Get total usage count for a user across all keys today
 */
export function getUserUsageCount(userId: string): number {
  ensureRateLimitTable();
  
  const db = getDb();
  const today = getTodayUTC();
  
  const stmt = db.prepare(`
    SELECT COALESCE(SUM(count), 0) as total 
    FROM rate_limits 
    WHERE user_id = ? AND date = ?
  `);
  
  const row = stmt.get(userId, today) as { total: number } | undefined;
  return row?.total || 0;
}

/**
 * Increment usage count for an API key
 * Returns the new count after increment
 */
export function incrementUsage(apiKeyId: string, userId: string): number {
  ensureRateLimitTable();
  
  const db = getDb();
  const today = getTodayUTC();
  const now = new Date().toISOString();
  
  // Use UPSERT to insert or update atomically
  const stmt = db.prepare(`
    INSERT INTO rate_limits (api_key_id, user_id, date, count, created_at, updated_at)
    VALUES (?, ?, ?, 1, ?, ?)
    ON CONFLICT(api_key_id, date) DO UPDATE SET 
      count = count + 1,
      updated_at = excluded.updated_at
  `);
  
  stmt.run(apiKeyId, userId, today, now, now);
  
  // Get the new count
  return getUsageCount(apiKeyId);
}

/**
 * Check if a request is allowed based on rate limits
 * Throws DailyLimitExceededError if limit exceeded
 */
export function checkRateLimit(
  apiKeyId: string,
  userId: string,
  tier: Tier
): RateLimitResult {
  const limit = TIER_LIMITS[tier];
  
  // Enterprise users have unlimited access
  if (limit === Infinity) {
    const resetAt = getNextMidnightUTC();
    return {
      allowed: true,
      info: {
        limit: -1, // -1 indicates unlimited
        used: 0,
        remaining: -1, // -1 indicates unlimited
        resetAt,
      },
    };
  }
  
  const used = getUserUsageCount(userId);
  const remaining = Math.max(0, limit - used);
  const resetAt = getNextMidnightUTC();
  
  const info: RateLimitInfo = {
    limit,
    used,
    remaining,
    resetAt,
  };
  
  if (used >= limit) {
    return {
      allowed: false,
      info,
    };
  }
  
  return {
    allowed: true,
    info,
  };
}

/**
 * Enforce rate limit - throws if exceeded
 */
export function enforceRateLimit(
  apiKeyId: string,
  userId: string,
  tier: Tier
): RateLimitInfo {
  const result = checkRateLimit(apiKeyId, userId, tier);
  
  if (!result.allowed) {
    throw new DailyLimitExceededError(
      result.info.limit,
      result.info.used,
      result.info.resetAt
    );
  }
  
  return result.info;
}

/**
 * Get rate limit headers for a response
 */
export function getRateLimitHeaders(info: RateLimitInfo): Record<string, string> {
  return {
    'X-RateLimit-Limit': info.limit === -1 ? 'unlimited' : String(info.limit),
    'X-RateLimit-Remaining': info.remaining === -1 ? 'unlimited' : String(info.remaining),
    'X-RateLimit-Reset': String(Math.floor(info.resetAt.getTime() / 1000)),
  };
}

/**
 * Get the Unix timestamp for reset
 */
export function getResetTimestamp(): number {
  return Math.floor(getNextMidnightUTC().getTime() / 1000);
}

/**
 * Clear old rate limit records (for cleanup/maintenance)
 * Removes records older than 7 days
 */
export function cleanupOldRecords(): number {
  ensureRateLimitTable();
  
  const db = getDb();
  
  // Get date 7 days ago
  const cutoff = new Date();
  cutoff.setUTCDate(cutoff.getUTCDate() - 7);
  const cutoffStr = `${cutoff.getUTCFullYear()}-${String(cutoff.getUTCMonth() + 1).padStart(2, '0')}-${String(cutoff.getUTCDate()).padStart(2, '0')}`;
  
  const stmt = db.prepare('DELETE FROM rate_limits WHERE date < ?');
  const result = stmt.run(cutoffStr);
  
  return result.changes;
}
