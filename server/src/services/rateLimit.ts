/**
 * Rate Limiting Service for Agent Talk API
 * 
 * Tracks API usage per key and enforces tier-based limits.
 * Daily counters reset at midnight UTC.
 */

import { getMicroClient } from '../lib/hypr-micro.js';
import { isHyprMode, getDb } from '../db-stub/index.js';
import { DailyLimitExceededError } from '../errors/index.js';
import { TIER_LIMITS, TierName } from '../config/tiers.js';
import { logger } from '../utils/logger.js';

// Re-export for backward compatibility
export { TIER_LIMITS } from '../config/tiers.js';

// Type alias for backward compatibility
export type Tier = TierName;

// Database name for HYPR Micro
const DB_NAME = 'rate_limits';

export interface RateLimitRecord {
  id: string;
  api_key_id: string;
  user_id: string;
  date: string;
  count: number;
  created_at: string;
  updated_at: string;
  [key: string]: unknown; // Index signature for HYPR Micro compatibility
}

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

// In-memory fallback storage
const memoryRateLimits = new Map<string, RateLimitRecord>();
const compositeIndex = new Map<string, string>(); // "apiKeyId:date" -> id

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
 * Generate unique ID
 */
function generateId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 9);
  return `rl_${timestamp}_${random}`;
}

/**
 * Ensure the rate_limits database/collection exists
 */
async function ensureDatabase(): Promise<void> {
  if (isHyprMode()) {
    try {
      await getMicroClient().createDatabase(DB_NAME);
    } catch {
      // Database might already exist, that's fine
    }
  }
}

/**
 * Get a rate limit record by API key and date
 */
async function getRecord(apiKeyId: string, date: string): Promise<RateLimitRecord | null> {
  if (isHyprMode()) {
    try {
      const records = await getMicroClient().query<RateLimitRecord>(DB_NAME, {
        api_key_id: apiKeyId,
        date: date
      });
      return records[0] || null;
    } catch (error: unknown) {
      logger.logError('Failed to get rate limit record from HYPR Micro', error, { apiKeyId, date });
      return null;
    }
  }
  
  const key = compositeIndex.get(`${apiKeyId}:${date}`);
  if (!key) return null;
  return memoryRateLimits.get(key) || null;
}

/**
 * Get all rate limit records for a user on a date
 */
async function getRecordsByUser(userId: string, date: string): Promise<RateLimitRecord[]> {
  if (isHyprMode()) {
    try {
      return await getMicroClient().query<RateLimitRecord>(DB_NAME, {
        user_id: userId,
        date: date
      });
    } catch (error: unknown) {
      logger.logError('Failed to get user rate limits from HYPR Micro', error, { userId, date });
      return [];
    }
  }
  
  return Array.from(memoryRateLimits.values())
    .filter(r => r.user_id === userId && r.date === date);
}

/**
 * Create or update a rate limit record
 */
async function upsertRecord(apiKeyId: string, userId: string, date: string): Promise<number> {
  await ensureDatabase();
  const now = new Date().toISOString();
  
  if (isHyprMode()) {
    try {
      const existing = await getRecord(apiKeyId, date);
      
      if (existing) {
        const newCount = existing.count + 1;
        await getMicroClient().update(DB_NAME, existing.id, {
          count: newCount,
          updated_at: now
        });
        return newCount;
      } else {
        const id = generateId();
        const record: RateLimitRecord = {
          id,
          api_key_id: apiKeyId,
          user_id: userId,
          date,
          count: 1,
          created_at: now,
          updated_at: now
        };
        await getMicroClient().insert(DB_NAME, record);
        return 1;
      }
    } catch (error: unknown) {
      logger.logError('Failed to upsert rate limit in HYPR Micro', error, { apiKeyId, userId, date });
      return 0;
    }
  }
  
  // In-memory mode
  const compositeKey = `${apiKeyId}:${date}`;
  const existingId = compositeIndex.get(compositeKey);
  
  if (existingId) {
    const existing = memoryRateLimits.get(existingId);
    if (existing) {
      existing.count += 1;
      existing.updated_at = now;
      return existing.count;
    }
  }
  
  // Create new record
  const id = generateId();
  const record: RateLimitRecord = {
    id,
    api_key_id: apiKeyId,
    user_id: userId,
    date,
    count: 1,
    created_at: now,
    updated_at: now
  };
  memoryRateLimits.set(id, record);
  compositeIndex.set(compositeKey, id);
  return 1;
}

/**
 * Get current usage count for an API key today
 */
export async function getUsageCount(apiKeyId: string): Promise<number> {
  const record = await getRecord(apiKeyId, getTodayUTC());
  return record?.count || 0;
}

/**
 * Get total usage count for a user across all keys today
 */
export async function getUserUsageCount(userId: string): Promise<number> {
  const records = await getRecordsByUser(userId, getTodayUTC());
  return records.reduce((sum, r) => sum + r.count, 0);
}

/**
 * Increment usage count for an API key
 * Returns the new count after increment
 */
export async function incrementUsage(apiKeyId: string, userId: string): Promise<number> {
  return upsertRecord(apiKeyId, userId, getTodayUTC());
}

/**
 * Check if a request is allowed based on rate limits
 * Must be called with await to get actual usage count
 */
export async function checkRateLimit(
  apiKeyId: string,
  userId: string,
  tier: Tier
): Promise<RateLimitResult> {
  const limit = TIER_LIMITS[tier];
  const resetAt = getNextMidnightUTC();
  
  // Enterprise users have unlimited access
  if (limit === Infinity) {
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
  
  // Get actual usage count from database/storage
  const used = await getUserUsageCount(userId);
  const remaining = Math.max(0, limit - used);
  
  return {
    allowed: used < limit,
    info: {
      limit,
      used,
      remaining,
      resetAt,
    },
  };
}

/**
 * Enforce rate limit - throws if exceeded
 */
export async function enforceRateLimit(
  apiKeyId: string,
  userId: string,
  tier: Tier
): Promise<RateLimitInfo> {
  const limit = TIER_LIMITS[tier];
  
  // Enterprise users have unlimited access
  if (limit === Infinity) {
    const resetAt = getNextMidnightUTC();
    return {
      limit: -1,
      used: 0,
      remaining: -1,
      resetAt,
    };
  }
  
  const used = await getUserUsageCount(userId);
  const remaining = Math.max(0, limit - used);
  const resetAt = getNextMidnightUTC();
  
  const info: RateLimitInfo = {
    limit,
    used,
    remaining,
    resetAt,
  };
  
  if (used >= limit) {
    throw new DailyLimitExceededError(
      limit,
      used,
      resetAt
    );
  }
  
  return info;
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
 * Record a usage increment (call after successful request)
 */
export async function recordUsage(apiKeyId: string, userId: string): Promise<number> {
  return incrementUsage(apiKeyId, userId);
}

/**
 * Clear old rate limit records (for cleanup/maintenance)
 * Removes records older than 7 days
 */
export async function cleanupOldRecords(): Promise<number> {
  const cutoff = new Date();
  cutoff.setUTCDate(cutoff.getUTCDate() - 7);
  const cutoffStr = `${cutoff.getUTCFullYear()}-${String(cutoff.getUTCMonth() + 1).padStart(2, '0')}-${String(cutoff.getUTCDate()).padStart(2, '0')}`;
  
  if (isHyprMode()) {
    try {
      // HYPR Micro doesn't have a direct delete by query, so we iterate
      const { docs } = await getMicroClient().list<RateLimitRecord>(DB_NAME);
      let deleted = 0;
      for (const doc of docs) {
        if (doc.date < cutoffStr) {
          await getMicroClient().delete(DB_NAME, doc.id);
          deleted++;
        }
      }
      return deleted;
    } catch (error: unknown) {
      logger.logError('Failed to cleanup rate limits in HYPR Micro', error);
      return 0;
    }
  }
  
  // In-memory cleanup
  let deleted = 0;
  for (const [id, record] of memoryRateLimits) {
    if (record.date < cutoffStr) {
      memoryRateLimits.delete(id);
      compositeIndex.delete(`${record.api_key_id}:${record.date}`);
      deleted++;
    }
  }
  return deleted;
}

/**
 * Reset in-memory storage (for testing)
 */
export function resetRateLimitStorage(): void {
  memoryRateLimits.clear();
  compositeIndex.clear();
}