/**
 * Rate Limiting Tests
 * 
 * Tests for the rate limiting middleware and service.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { 
  checkRateLimit, 
  incrementUsage, 
  getUserUsageCount, 
  getNextMidnightUTC,
  getRateLimitHeaders,
  cleanupOldRecords,
  resetRateLimitStorage
} from '../src/services/rateLimit.js';
import { 
  createTestUser, 
  createTestApiKey,
  resetStores
} from './setup.js';

describe('Rate Limiting Service', () => {
  let testUserId: string;
  let testKeyId: string;

  beforeEach(async () => {
    // Reset all stores
    resetStores();
    resetRateLimitStorage();
    
    // Create a test user with hobby tier
    const user = await createTestUser('ratelimit-test@example.com', 'testpassword123');
    testUserId = user.id;
    
    // Create a test API key
    const { apiKey } = await createTestApiKey(testUserId, 'Test Key for Rate Limiting');
    testKeyId = apiKey.id;
  });

  afterEach(async () => {
    resetStores();
    resetRateLimitStorage();
  });

  describe('checkRateLimit', () => {
    it('should allow requests under limit for hobby tier', async () => {
      const result = await checkRateLimit(testKeyId, testUserId, 'hobby');
      
      expect(result.allowed).toBe(true);
      expect(result.info.limit).toBe(100);
      expect(result.info.used).toBe(0);
      expect(result.info.remaining).toBe(100);
      expect(result.info.resetAt).toBeInstanceOf(Date);
    });

    it('should allow requests under limit for pro tier', async () => {
      const result = await checkRateLimit(testKeyId, testUserId, 'pro');
      
      expect(result.allowed).toBe(true);
      expect(result.info.limit).toBe(1000);
      expect(result.info.remaining).toBe(1000);
    });

    it('should allow unlimited requests for enterprise tier', async () => {
      const result = await checkRateLimit(testKeyId, testUserId, 'enterprise');
      
      expect(result.allowed).toBe(true);
      expect(result.info.limit).toBe(-1); // -1 = unlimited
      expect(result.info.remaining).toBe(-1);
    });

    it('should track usage correctly', async () => {
      // Increment usage 5 times
      for (let i = 0; i < 5; i++) {
        await incrementUsage(testKeyId, testUserId);
      }
      
      const result = await checkRateLimit(testKeyId, testUserId, 'hobby');
      
      expect(result.allowed).toBe(true);
      expect(result.info.used).toBe(5);
      expect(result.info.remaining).toBe(95);
    });

    it('should block requests when limit exceeded', async () => {
      // Increment usage to limit
      for (let i = 0; i < 100; i++) {
        await incrementUsage(testKeyId, testUserId);
      }
      
      const result = await checkRateLimit(testKeyId, testUserId, 'hobby');
      
      expect(result.allowed).toBe(false);
      expect(result.info.used).toBe(100);
      expect(result.info.remaining).toBe(0);
    });
  });

  describe('incrementUsage', () => {
    it('should increment usage count and return new count', async () => {
      const count1 = await incrementUsage(testKeyId, testUserId);
      expect(count1).toBe(1);
      
      const count2 = await incrementUsage(testKeyId, testUserId);
      expect(count2).toBe(2);
      
      const count3 = await incrementUsage(testKeyId, testUserId);
      expect(count3).toBe(3);
    });

    it('should track usage per user across multiple keys', async () => {
      // Increment for first key
      await incrementUsage(testKeyId, testUserId);
      await incrementUsage(testKeyId, testUserId);
      
      // Create second key and increment
      const { apiKey: key2 } = await createTestApiKey(testUserId, 'Second Key');
      await incrementUsage(key2.id, testUserId);
      
      // Total usage should be 3
      const totalUsage = await getUserUsageCount(testUserId);
      expect(totalUsage).toBe(3);
    });
  });

  describe('getNextMidnightUTC', () => {
    it('should return next midnight UTC', () => {
      const resetAt = getNextMidnightUTC();
      
      expect(resetAt).toBeInstanceOf(Date);
      expect(resetAt.getUTCHours()).toBe(0);
      expect(resetAt.getUTCMinutes()).toBe(0);
      expect(resetAt.getUTCSeconds()).toBe(0);
      expect(resetAt.getUTCMilliseconds()).toBe(0);
      
      // Should be in the future
      expect(resetAt.getTime()).toBeGreaterThan(Date.now());
    });
  });

  describe('getRateLimitHeaders', () => {
    it('should return correct headers for limited tier', () => {
      const resetAt = getNextMidnightUTC();
      const headers = getRateLimitHeaders({
        limit: 100,
        used: 25,
        remaining: 75,
        resetAt,
      });
      
      expect(headers['X-RateLimit-Limit']).toBe('100');
      expect(headers['X-RateLimit-Remaining']).toBe('75');
      expect(headers['X-RateLimit-Reset']).toBe(String(Math.floor(resetAt.getTime() / 1000)));
    });

    it('should return unlimited headers for enterprise', () => {
      const resetAt = getNextMidnightUTC();
      const headers = getRateLimitHeaders({
        limit: -1,
        used: 0,
        remaining: -1,
        resetAt,
      });
      
      expect(headers['X-RateLimit-Limit']).toBe('unlimited');
      expect(headers['X-RateLimit-Remaining']).toBe('unlimited');
    });
  });

  describe('cleanupOldRecords', () => {
    it('should remove records older than 7 days', async () => {
      // This is a maintenance function, just verify it doesn't throw
      const deleted = await cleanupOldRecords();
      expect(typeof deleted).toBe('number');
    });
  });

  describe('Rate limit per key vs per user', () => {
    it('should track usage per key independently', async () => {
      // Create two keys for same user
      const { apiKey: key1 } = await createTestApiKey(testUserId, 'Key 1');
      const { apiKey: key2 } = await createTestApiKey(testUserId, 'Key 2');
      
      // Increment each key different amounts
      await incrementUsage(key1.id, testUserId);
      await incrementUsage(key1.id, testUserId);
      await incrementUsage(key1.id, testUserId); // Key 1: 3 uses
      
      await incrementUsage(key2.id, testUserId);
      await incrementUsage(key2.id, testUserId); // Key 2: 2 uses
      
      // Total user usage should be 5
      const totalUsage = await getUserUsageCount(testUserId);
      expect(totalUsage).toBe(5);
    });

    it('should enforce limits at user level', async () => {
      // Create two keys
      const { apiKey: key1 } = await createTestApiKey(testUserId, 'Key 1');
      const { apiKey: key2 } = await createTestApiKey(testUserId, 'Key 2');
      
      // Use key1 50 times
      for (let i = 0; i < 50; i++) {
        await incrementUsage(key1.id, testUserId);
      }
      
      // Use key2 49 times (total 99)
      for (let i = 0; i < 49; i++) {
        await incrementUsage(key2.id, testUserId);
      }
      
      // Should still be allowed
      let result = await checkRateLimit(key2.id, testUserId, 'hobby');
      expect(result.allowed).toBe(true);
      expect(result.info.remaining).toBe(1);
      
      // One more increment should hit the limit
      await incrementUsage(key2.id, testUserId);
      result = await checkRateLimit(key1.id, testUserId, 'hobby');
      expect(result.allowed).toBe(false);
    });
  });
});