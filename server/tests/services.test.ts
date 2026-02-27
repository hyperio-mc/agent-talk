/**
 * Services Tests
 * 
 * Unit tests for various services
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createTestUser, resetStores } from './setup.js';

describe('API Key Service', () => {
  let userId: string;

  beforeEach(async () => {
    resetStores();
    const user = await createTestUser('serviceuser@example.com', 'testPassword123');
    userId = user.id;
  });

  describe('generateApiKey', () => {
    it('should generate live keys', async () => {
      const { generateApiKey } = await import('../src/services/apiKey.js');
      
      const result = generateApiKey(false);
      expect(result.fullKey).toMatch(/^at_live_[a-zA-Z0-9_-]+$/);
      expect(result.prefix).toBe('at_live_');
    });

    it('should generate test keys', async () => {
      const { generateApiKey } = await import('../src/services/apiKey.js');
      
      const result = generateApiKey(true);
      expect(result.fullKey).toMatch(/^at_test_[a-zA-Z0-9_-]+$/);
      expect(result.prefix).toBe('at_test_');
    });

    it('should generate unique keys', async () => {
      const { generateApiKey } = await import('../src/services/apiKey.js');
      
      const keys = new Set();
      for (let i = 0; i < 100; i++) {
        const result = generateApiKey(false);
        keys.add(result.fullKey);
      }
      
      expect(keys.size).toBe(100); // All unique
    });
  });

  describe('hashApiKey', () => {
    it('should hash keys consistently', async () => {
      const { hashApiKey } = await import('../src/services/apiKey.js');
      
      const key = 'at_live_abc123def456';
      const hash1 = hashApiKey(key);
      const hash2 = hashApiKey(key);
      
      expect(hash1).toBe(hash2);
      expect(hash1.length).toBe(64); // SHA-256 hex
    });

    it('should produce different hashes for different keys', async () => {
      const { hashApiKey } = await import('../src/services/apiKey.js');
      
      const hash1 = hashApiKey('at_live_key1');
      const hash2 = hashApiKey('at_live_key2');
      
      expect(hash1).not.toBe(hash2);
    });
  });

  describe('isApiKeyFormat', () => {
    it('should validate key format', async () => {
      const { isApiKeyFormat } = await import('../src/services/apiKey.js');
      
      expect(isApiKeyFormat('at_live_abc123')).toBe(true);
      expect(isApiKeyFormat('at_test_xyz789')).toBe(true);
      expect(isApiKeyFormat('at_live_')).toBe(true);
      expect(isApiKeyFormat('at_test_')).toBe(true);
      
      expect(isApiKeyFormat('invalid')).toBe(false);
      expect(isApiKeyFormat('sk_live_abc')).toBe(false);
      expect(isApiKeyFormat('')).toBe(false);
    });
  });

  describe('extractApiKey', () => {
    it('should extract from Bearer header', async () => {
      const { extractApiKey } = await import('../src/services/apiKey.js');
      
      expect(extractApiKey('Bearer at_live_abc123')).toBe('at_live_abc123');
      expect(extractApiKey('bearer at_test_xyz')).toBe('at_test_xyz');
    });

    it('should extract without Bearer prefix', async () => {
      const { extractApiKey } = await import('../src/services/apiKey.js');
      
      expect(extractApiKey('at_live_abc123')).toBe('at_live_abc123');
    });

    it('should return null for invalid formats', async () => {
      const { extractApiKey } = await import('../src/services/apiKey.js');
      
      expect(extractApiKey('Basic abc123')).toBeNull();
      expect(extractApiKey(undefined)).toBeNull();
      expect(extractApiKey('')).toBeNull();
    });
  });

  describe('createNewApiKey', () => {
    it('should create a new API key', async () => {
      const { createNewApiKey } = await import('../src/services/apiKey.js');
      
      const result = await createNewApiKey(userId, 'Test Key', false);
      
      expect(result.id).toBeDefined();
      expect(result.key).toMatch(/^at_live_/);
      expect(result.prefix).toBe('at_live_');
      expect(result.name).toBe('Test Key');
      expect(result.createdAt).toBeDefined();
    });

    it('should create a test API key', async () => {
      const { createNewApiKey } = await import('../src/services/apiKey.js');
      
      const result = await createNewApiKey(userId, 'Test Mode Key', true);
      
      expect(result.key).toMatch(/^at_test_/);
      expect(result.prefix).toBe('at_test_');
    });
  });

  describe('validateApiKey', () => {
    it('should validate a valid key', async () => {
      const { createNewApiKey, validateApiKey } = await import('../src/services/apiKey.js');
      
      const result = await createNewApiKey(userId, 'Validation Key', false);
      const validated = await validateApiKey(result.key);
      
      expect(validated.keyId).toBe(result.id);
      expect(validated.userId).toBe(userId);
    });

    it('should reject invalid key format', async () => {
      const { validateApiKey } = await import('../src/services/apiKey.js');
      
      await expect(validateApiKey('invalid-key')).rejects.toThrow();
    });

    it('should reject non-existent key', async () => {
      const { validateApiKey } = await import('../src/services/apiKey.js');
      
      await expect(validateApiKey('at_live_nonexistent1234567890123456')).rejects.toThrow();
    });
  });

  describe('maskApiKey', () => {
    it('should mask API key correctly', async () => {
      const { maskApiKey, generateApiKey } = await import('../src/services/apiKey.js');
      
      // Use a generated key for realistic test
      const { fullKey } = generateApiKey(false);
      const masked = maskApiKey(fullKey);
      
      // Should have prefix, ***..., and last 6 chars
      expect(masked).toMatch(/^at_live_\*\*\*\.\.\.[a-zA-Z0-9_-]{6}$/);
      expect(masked.length).toBeLessThan(fullKey.length);
    });

    it('should mask test keys correctly', async () => {
      const { maskApiKey, generateApiKey } = await import('../src/services/apiKey.js');
      
      const { fullKey } = generateApiKey(true);
      const masked = maskApiKey(fullKey);
      
      expect(masked).toMatch(/^at_test_\*\*\*\.\.\.[a-zA-Z0-9_-]{6}$/);
    });
  });
});

describe('Memo Service', () => {
  beforeEach(async () => {
    resetStores();
  });

  describe('constructor', () => {
    it('should create service with simulation mode', async () => {
      const { MemoService } = await import('../src/services/memo.js');
      
      const service = new MemoService('simulation');
      expect(service).toBeDefined();
    });

    it('should create service with edge mode', async () => {
      const { MemoService } = await import('../src/services/memo.js');
      
      const service = new MemoService('edge');
      expect(service).toBeDefined();
    });
  });

  describe('getAvailableVoices', () => {
    it('should return list of voices', async () => {
      const { MemoService } = await import('../src/services/memo.js');
      
      const service = new MemoService('simulation');
      const voices = service.getAvailableVoices();
      
      expect(voices.length).toBeGreaterThan(0);
      
      const rachel = voices.find((v: any) => v.id === 'rachel');
      expect(rachel).toBeDefined();
      expect(rachel.name).toBeDefined();
      expect(rachel.gender).toBeDefined();
    });
  });

  describe('isValidVoice', () => {
    it('should validate known voices', async () => {
      const { MemoService } = await import('../src/services/memo.js');
      
      const service = new MemoService('simulation');
      
      expect(service.isValidVoice('rachel')).toBe(true);
      expect(service.isValidVoice('adam')).toBe(true);
      expect(service.isValidVoice('sam')).toBe(true);
      
      expect(service.isValidVoice('unknown')).toBe(false);
      expect(service.isValidVoice('')).toBe(false);
    });
  });

  describe('createMemo', () => {
    it('should create memo in simulation mode', async () => {
      const { MemoService } = await import('../src/services/memo.js');
      
      const service = new MemoService('simulation');
      const memo = await service.createMemo('Hello, world!', 'rachel', 'http://localhost:3001');
      
      expect(memo.text).toBe('Hello, world!');
      expect(memo.voice.id).toBe('rachel');
      expect(memo.audio.url).toBeDefined();
      expect(memo.audio.format).toBe('mp3');
      expect(memo.audio.duration).toBeGreaterThan(0);
    });

    it('should calculate duration based on text length', async () => {
      const { MemoService } = await import('../src/services/memo.js');
      
      const service = new MemoService('simulation');
      
      const shortMemo = await service.createMemo('Hi!', 'rachel', 'http://localhost:3001');
      const longMemo = await service.createMemo('This is a much longer text that should take more time to speak.'.repeat(5), 'rachel', 'http://localhost:3001');
      
      expect(longMemo.audio.duration).toBeGreaterThan(shortMemo.audio.duration);
    });
  });
});

describe('User Service', () => {
  beforeEach(async () => {
    resetStores();
  });

  describe('hashPassword', () => {
    it('should hash password', async () => {
      const { hashPassword } = await import('../src/services/user.js');
      
      const hash = await hashPassword('securePassword123');
      expect(hash).toBeDefined();
      expect(hash).not.toBe('securePassword123');
      expect(hash.startsWith('$2b$')).toBe(true);
    });

    it('should reject short password', async () => {
      const { hashPassword } = await import('../src/services/user.js');
      
      await expect(hashPassword('short')).rejects.toThrow('8 characters');
    });
  });

  describe('verifyPassword', () => {
    it('should verify correct password', async () => {
      const { hashPassword, verifyPassword } = await import('../src/services/user.js');
      
      const hash = await hashPassword('correctPassword');
      expect(await verifyPassword('correctPassword', hash)).toBe(true);
    });

    it('should reject wrong password', async () => {
      const { hashPassword, verifyPassword } = await import('../src/services/user.js');
      
      const hash = await hashPassword('correctPassword');
      expect(await verifyPassword('wrongPassword', hash)).toBe(false);
    });
  });

  describe('generateToken', () => {
    it('should generate valid JWT', async () => {
      const { generateToken, verifyToken } = await import('../src/services/user.js');
      
      const result = generateToken({ id: 'user123', email: 'test@example.com' });
      
      expect(result.token).toBeDefined();
      expect(result.expiresAt).toBeGreaterThan(Date.now());
      
      const payload = verifyToken(result.token);
      expect(payload?.userId).toBe('user123');
      expect(payload?.email).toBe('test@example.com');
    });
  });

  describe('verifyToken', () => {
    it('should verify valid token', async () => {
      const { generateToken, verifyToken } = await import('../src/services/user.js');
      
      const result = generateToken({ id: 'user456', email: 'verify@example.com' });
      const payload = verifyToken(result.token);
      
      expect(payload).not.toBeNull();
      expect(payload?.userId).toBe('user456');
    });

    it('should reject invalid token', async () => {
      const { verifyToken } = await import('../src/services/user.js');
      
      expect(verifyToken('invalid-token')).toBeNull();
      expect(verifyToken('')).toBeNull();
    });
  });

  describe('signUp', () => {
    it('should create new user', async () => {
      const { signUp } = await import('../src/services/user.js');
      
      const result = await signUp({
        email: 'signup@example.com',
        password: 'securePassword123',
      });
      
      expect(result.user).toBeDefined();
      expect(result.user.email).toBe('signup@example.com');
      expect(result.token).toBeDefined();
      expect(result.expiresAt).toBeDefined();
    });

    it('should reject duplicate email', async () => {
      const { signUp } = await import('../src/services/user.js');
      
      await signUp({
        email: 'duplicate@example.com',
        password: 'password123',
      });
      
      await expect(signUp({
        email: 'duplicate@example.com',
        password: 'password456',
      })).rejects.toThrow('already exists');
    });

    it('should validate email format', async () => {
      const { signUp } = await import('../src/services/user.js');
      
      await expect(signUp({
        email: 'not-an-email',
        password: 'password123',
      })).rejects.toThrow('email');
    });

    it('should validate password length', async () => {
      const { signUp } = await import('../src/services/user.js');
      
      await expect(signUp({
        email: 'valid@example.com',
        password: 'short',
      })).rejects.toThrow('8 characters');
    });
  });

  describe('login', () => {
    it('should login with correct credentials', async () => {
      const { signUp, login } = await import('../src/services/user.js');
      
      await signUp({
        email: 'login@example.com',
        password: 'correctPassword',
      });
      
      const result = await login({
        email: 'login@example.com',
        password: 'correctPassword',
      });
      
      expect(result.user).toBeDefined();
      expect(result.user.email).toBe('login@example.com');
      expect(result.token).toBeDefined();
    });

    it('should reject wrong password', async () => {
      const { signUp, login } = await import('../src/services/user.js');
      
      await signUp({
        email: 'wrongpass@example.com',
        password: 'correctPassword',
      });
      
      await expect(login({
        email: 'wrongpass@example.com',
        password: 'wrongPassword',
      })).rejects.toThrow('Invalid email or password');
    });

    it('should reject non-existent user', async () => {
      const { login } = await import('../src/services/user.js');
      
      await expect(login({
        email: 'nonexistent@example.com',
        password: 'somePassword',
      })).rejects.toThrow('Invalid email or password');
    });
  });
});