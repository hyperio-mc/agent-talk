/**
 * Memo Endpoint Tests
 * 
 * Tests for text-to-speech conversion, memo creation, and validation
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Hono } from 'hono';
import request from 'supertest';
import { createTestUser, resetStores, createTestApiKey } from './setup.js';

// We need to build the test app fresh each time to avoid initialization issues
function createMemoTestApp() {
  const app = new Hono();
  
  // Import routes dynamically to avoid initialization issues
  return app;
}

describe('Memo Endpoints', () => {
  let userId: string;
  let apiKey: string;

  beforeEach(async () => {
    resetStores();

    // Create test user
    const user = await createTestUser('memouser@example.com', 'testPassword123');
    userId = user.id;

    // Create API key
    const result = await createTestApiKey(userId, 'Test Key');
    apiKey = result.fullKey;
  });

  describe('Memo Service', () => {
    it('should create memo with valid voice', async () => {
      const { MemoService } = await import('../src/services/memo.js');
      const service = new MemoService('simulation');
      
      const memo = await service.createMemo('Hello, world!', 'rachel', 'http://localhost:3001');
      
      expect(memo).toBeDefined();
      expect(memo.text).toBe('Hello, world!');
      expect(memo.voice.id).toBe('rachel');
      expect(memo.audio.url).toBeDefined();
    });

    it('should validate available voices', async () => {
      const { MemoService } = await import('../src/services/memo.js');
      const service = new MemoService('simulation');
      
      const voices = service.getAvailableVoices();
      expect(voices.length).toBeGreaterThan(0);
      
      voices.forEach((voice: any) => {
        expect(voice.id).toBeDefined();
        expect(voice.name).toBeDefined();
      });
    });

    it('should check if voice is valid', async () => {
      const { MemoService } = await import('../src/services/memo.js');
      const service = new MemoService('simulation');
      
      expect(service.isValidVoice('rachel')).toBe(true);
      expect(service.isValidVoice('invalid-voice')).toBe(false);
    });
  });

  describe('API Key Service', () => {
    it('should generate valid API keys', async () => {
      const { generateApiKey, hashApiKey, isApiKeyFormat } = await import('../src/services/apiKey.js');
      
      const result = generateApiKey(false);
      expect(result.fullKey).toMatch(/^at_live_/);
      expect(result.prefix).toBe('at_live_');
      
      const hash = hashApiKey(result.fullKey);
      expect(hash).toBeDefined();
      expect(hash.length).toBe(64); // SHA-256 produces 64 hex chars
      
      expect(isApiKeyFormat(result.fullKey)).toBe(true);
      expect(isApiKeyFormat('invalid')).toBe(false);
    });

    it('should generate test API keys', async () => {
      const { generateApiKey } = await import('../src/services/apiKey.js');
      
      const result = generateApiKey(true);
      expect(result.fullKey).toMatch(/^at_test_/);
      expect(result.prefix).toBe('at_test_');
    });

    it('should extract API key from header', async () => {
      const { extractApiKey } = await import('../src/services/apiKey.js');
      
      expect(extractApiKey('Bearer at_live_abc123')).toBe('at_live_abc123');
      expect(extractApiKey('at_live_abc123')).toBe('at_live_abc123');
      expect(extractApiKey(undefined)).toBeNull();
      expect(extractApiKey('Basic abc123')).toBeNull();
    });
  });

  describe('Tier Configuration', () => {
    it('should have correct tier limits', async () => {
      const { TIER_LIMITS, getTierConfig } = await import('../src/config/tiers.js');
      
      expect(TIER_LIMITS.hobby).toBe(100);
      expect(TIER_LIMITS.pro).toBe(1000);
      expect(TIER_LIMITS.enterprise).toBe(Infinity);
      
      const hobbyConfig = getTierConfig('hobby');
      expect(hobbyConfig.limits.callsPerDay).toBe(100);
      expect(hobbyConfig.limits.charsPerMemo).toBe(5000);
      
      const proConfig = getTierConfig('pro');
      expect(proConfig.limits.callsPerDay).toBe(1000);
      expect(proConfig.limits.charsPerMemo).toBe(20000);
    });

    it('should enforce character limits', async () => {
      const { isCharacterCountAllowed, getTierCharLimit } = await import('../src/config/tiers.js');
      
      expect(isCharacterCountAllowed('hobby', 5000)).toBe(true);
      expect(isCharacterCountAllowed('hobby', 5001)).toBe(false);
      
      expect(isCharacterCountAllowed('pro', 20000)).toBe(true);
      expect(isCharacterCountAllowed('pro', 20001)).toBe(false);
      
      expect(getTierCharLimit('enterprise')).toBe(null); // unlimited
    });

    it('should check TTS availability', async () => {
      const { tierCanUseTTS } = await import('../src/config/tiers.js');
      
      expect(tierCanUseTTS('hobby', 'edge')).toBe(true);
      expect(tierCanUseTTS('hobby', 'elevenlabs')).toBe(false);
      
      expect(tierCanUseTTS('pro', 'edge')).toBe(true);
      expect(tierCanUseTTS('pro', 'elevenlabs')).toBe(true);
    });
  });

  describe('Error Classes', () => {
    it('should create proper error instances', async () => {
      const { 
        ValidationError, 
        MissingFieldError, 
        InvalidApiKeyError,
        MissingApiKeyError,
        InvalidVoiceError 
      } = await import('../src/errors/index.js');
      
      const validationError = new ValidationError('Test error', { field: 'test' });
      expect(validationError.message).toBe('Test error');
      expect(validationError.statusCode).toBe(400);
      
      const missingError = new MissingFieldError('email');
      expect(missingError.message).toContain('email');
      expect(missingError.details.field).toBe('email');
      
      const apiKeyError = new InvalidApiKeyError();
      expect(apiKeyError.code).toBe('INVALID_API_KEY');
      expect(apiKeyError.statusCode).toBe(401);
      
      const missingKeyError = new MissingApiKeyError();
      expect(missingKeyError.code).toBe('MISSING_API_KEY');
      
      const voiceError = new InvalidVoiceError('bad-voice', ['rachel', 'adam']);
      expect(voiceError.code).toBe('INVALID_VOICE');
      expect(voiceError.details.availableVoices).toContain('rachel');
    });
  });

  describe('Token Service', () => {
    it('should generate and verify tokens', async () => {
      const { generateToken, verifyToken } = await import('../src/services/user.js');
      
      const result = generateToken({ id: 'test-id', email: 'test@example.com' });
      expect(result.token).toBeDefined();
      expect(result.expiresAt).toBeGreaterThan(Date.now());
      
      const payload = verifyToken(result.token);
      expect(payload).toBeDefined();
      expect(payload?.email).toBe('test@example.com');
      expect(payload?.userId).toBe('test-id');
    });

    it('should reject invalid tokens', async () => {
      const { verifyToken } = await import('../src/services/user.js');
      
      expect(verifyToken('invalid-token')).toBeNull();
      expect(verifyToken('')).toBeNull();
    });
  });

  describe('Password Service', () => {
    it('should hash and verify passwords', async () => {
      const { hashPassword, verifyPassword } = await import('../src/services/user.js');
      
      const hash = await hashPassword('securePassword123');
      expect(hash).toBeDefined();
      expect(hash).not.toBe('securePassword123');
      
      expect(await verifyPassword('securePassword123', hash)).toBe(true);
      expect(await verifyPassword('wrongPassword', hash)).toBe(false);
    });

    it('should reject short passwords', async () => {
      const { hashPassword } = await import('../src/services/user.js');
      
      await expect(hashPassword('short')).rejects.toThrow('8 characters');
    });
  });
});