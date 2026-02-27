/**
 * Memo Endpoint Tests
 * 
 * Tests for text-to-speech conversion, memo creation, and validation
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Hono } from 'hono';
import request from 'supertest';
import app from '../src/index.js';
import { getDb } from '../src/db/index.js';
import { createUser } from '../src/db/users.js';
import bcrypt from 'bcrypt';
import { generateToken } from '../src/services/user.js';
import { generateApiKey, hashApiKey, createNewApiKey } from '../src/services/apiKey.js';

describe('Memo Endpoints', () => {
  let userId: string;
  let token: string;
  let apiKey: string;

  beforeEach(async () => {
    const db = getDb();
    db.exec('DELETE FROM api_keys');
    db.exec('DELETE FROM users');

    // Create test user
    const passwordHash = await bcrypt.hash('testPassword123', 12);
    const user = await createUser({
      email: 'memouser@example.com',
      passwordHash,
      tier: 'hobby',
    });
    userId = user.id;
    token = generateToken({ id: userId, email: 'memouser@example.com' }).token;

    // Create API key
    const result = createNewApiKey(userId, 'Test Key');
    apiKey = result.key;
  });

  describe('POST /api/v1/memo', () => {
    it('should create memo with valid request', async () => {
      const response = await request(app)
        .post('/api/v1/memo')
        .set('Authorization', `Bearer ${apiKey}`)
        .send({
          text: 'Hello, this is a test.',
          voice: 'rachel',
        });

      expect(response.status).toBe(201);
      expect(response.body.id).toBeDefined();
      expect(response.body.text).toBe('Hello, this is a test.');
      expect(response.body.voice).toBeDefined();
      expect(response.body.voice.id).toBe('rachel');
      expect(response.body.audio).toBeDefined();
      expect(response.body.audio.url).toBeDefined();
      expect(response.body.audio.format).toBe('mp3');
    });

    it('should reject missing API key', async () => {
      const response = await request(app)
        .post('/api/v1/memo')
        .send({
          text: 'Hello, world!',
          voice: 'rachel',
        });

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('MISSING_API_KEY');
    });

    it('should reject invalid API key', async () => {
      const response = await request(app)
        .post('/api/v1/memo')
        .set('Authorization', 'Bearer at_live_invalidkey123')
        .send({
          text: 'Hello, world!',
          voice: 'rachel',
        });

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('INVALID_API_KEY');
    });

    it('should reject revoked API key', async () => {
      // Create and revoke a key
      const revokedResult = createNewApiKey(userId, 'Revoked Key');
      const revokedKey = revokedResult.key;
      
      // Revoke it (mark as inactive)
      const db = getDb();
      db.prepare('UPDATE api_keys SET is_active = 0 WHERE id = ?').run(revokedResult.id);

      const response = await request(app)
        .post('/api/v1/memo')
        .set('Authorization', `Bearer ${revokedKey}`)
        .send({
          text: 'Hello, world!',
          voice: 'rachel',
        });

      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe('REVOKED_KEY');
    });

    it('should reject missing text field', async () => {
      const response = await request(app)
        .post('/api/v1/memo')
        .set('Authorization', `Bearer ${apiKey}`)
        .send({
          voice: 'rachel',
        });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('MISSING_FIELD');
      expect(response.body.error.details.field).toBe('text');
    });

    it('should reject missing voice field', async () => {
      const response = await request(app)
        .post('/api/v1/memo')
        .set('Authorization', `Bearer ${apiKey}`)
        .send({
          text: 'Hello, world!',
        });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('MISSING_FIELD');
      expect(response.body.error.details.field).toBe('voice');
    });

    it('should reject invalid voice', async () => {
      const response = await request(app)
        .post('/api/v1/memo')
        .set('Authorization', `Bearer ${apiKey}`)
        .send({
          text: 'Hello, world!',
          voice: 'nonexistent-voice',
        });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('INVALID_VOICE');
      expect(response.body.error.details.availableVoices).toBeDefined();
    });

    it('should reject non-string text', async () => {
      const response = await request(app)
        .post('/api/v1/memo')
        .set('Authorization', `Bearer ${apiKey}`)
        .send({
          text: 123,
          voice: 'rachel',
        });

      expect(response.status).toBe(400);
    });

    it('should reject non-string voice', async () => {
      const response = await request(app)
        .post('/api/v1/memo')
        .set('Authorization', `Bearer ${apiKey}`)
        .send({
          text: 'Hello, world!',
          voice: { id: 'rachel' },
        });

      expect(response.status).toBe(400);
    });

    it('should reject empty text', async () => {
      const response = await request(app)
        .post('/api/v1/memo')
        .set('Authorization', `Bearer ${apiKey}`)
        .send({
          text: '',
          voice: 'rachel',
        });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('MISSING_FIELD');
    });

    it('should reject empty voice', async () => {
      const response = await request(app)
        .post('/api/v1/memo')
        .set('Authorization', `Bearer ${apiKey}`)
        .send({
          text: 'Hello, world!',
          voice: '',
        });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('MISSING_FIELD');
    });

    it('should accept API key without Bearer prefix', async () => {
      const response = await request(app)
        .post('/api/v1/memo')
        .set('Authorization', apiKey)
        .send({
          text: 'Hello, world!',
          voice: 'rachel',
        });

      expect(response.status).toBe(201);
    });

    it('should increment key usage count', async () => {
      // Get initial usage count
      const db = getDb();
      const initial = db.prepare('SELECT usage_count FROM api_keys WHERE user_id = ?').get(userId) as any;

      await request(app)
        .post('/api/v1/memo')
        .set('Authorization', `Bearer ${apiKey}`)
        .send({
          text: 'Hello, world!',
          voice: 'rachel',
        });

      const after = db.prepare('SELECT usage_count FROM api_keys WHERE user_id = ?').get(userId) as any;
      
      // Usage should have increased
      expect(after.usage_count).toBeGreaterThan(initial.usage_count || 0);
    });

    it('should add rate limit headers', async () => {
      const response = await request(app)
        .post('/api/v1/memo')
        .set('Authorization', `Bearer ${apiKey}`)
        .send({
          text: 'Hello, world!',
          voice: 'rachel',
        });

      expect(response.headers['x-ratelimit-limit']).toBeDefined();
      expect(response.headers['x-ratelimit-remaining']).toBeDefined();
      expect(response.headers['x-ratelimit-reset']).toBeDefined();
    });

    it('should handle various voice IDs', async () => {
      const voices = ['adam', 'sam', 'charlie', 'emily', 'ethan', 'freya', 'dorothy', 'bill', 'sarah', 'domi', 'bella'];

      for (const voice of voices) {
        const response = await request(app)
          .post('/api/v1/memo')
          .set('Authorization', `Bearer ${apiKey}`)
          .send({
            text: `Testing voice ${voice}`,
            voice,
          });

        expect(response.status).toBe(201);
        expect(response.body.voice.id).toBe(voice);
      }
    });

    it('should handle long text', async () => {
      const longText = 'Hello, world! '.repeat(100); // ~1300 characters

      const response = await request(app)
        .post('/api/v1/memo')
        .set('Authorization', `Bearer ${apiKey}`)
        .send({
          text: longText,
          voice: 'rachel',
        });

      expect(response.status).toBe(201);
      expect(response.body.text).toBe(longText);
    });

    it('should estimate audio duration', async () => {
      const response = await request(app)
        .post('/api/v1/memo')
        .set('Authorization', `Bearer ${apiKey}`)
        .send({
          text: 'Hello, this is a test of the audio duration estimation feature.',
          voice: 'rachel',
        });

      expect(response.status).toBe(201);
      expect(response.body.audio.duration).toBeDefined();
      expect(response.body.audio.duration).toBeGreaterThan(0);
    });
  });

  describe('GET /api/v1/memo/:id', () => {
    it('should return 501 Not Implemented', async () => {
      const response = await request(app)
        .get('/api/v1/memo/some-id')
        .set('Authorization', `Bearer ${apiKey}`);

      expect(response.status).toBe(501);
      expect(response.body.error.code).toBe('NOT_IMPLEMENTED');
    });
  });

  describe('GET /api/v1/memos', () => {
    it('should return 501 Not Implemented', async () => {
      const response = await request(app)
        .get('/api/v1/memos')
        .set('Authorization', `Bearer ${apiKey}`);

      expect(response.status).toBe(501);
      expect(response.body.error.code).toBe('NOT_IMPLEMENTED');
    });
  });

  describe('GET /api/v1/voices', () => {
    it('should list available voices', async () => {
      const response = await request(app)
        .get('/api/v1/voices');

      expect(response.status).toBe(200);
      expect(response.body.voices).toBeDefined();
      expect(Array.isArray(response.body.voices)).toBe(true);
      expect(response.body.voices.length).toBeGreaterThan(0);
    });

    it('should include voice properties', async () => {
      const response = await request(app)
        .get('/api/v1/voices');

      const voices = response.body.voices;
      voices.forEach((voice: any) => {
        expect(voice.id).toBeDefined();
        expect(voice.name).toBeDefined();
        expect(voice.gender).toBeDefined();
      });
    });
  });

  describe('POST /api/v1/demo', () => {
    it('should create demo memo without API key', async () => {
      const response = await request(app)
        .post('/api/v1/demo')
        .send({
          text: 'Demo text',
          voice: 'rachel',
        });

      expect(response.status).toBe(201);
      expect(response.body.voice.id).toBe('rachel');
    });

    it('should reject missing text in demo', async () => {
      const response = await request(app)
        .post('/api/v1/demo')
        .send({
          voice: 'rachel',
        });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('MISSING_FIELD');
    });

    it('should reject invalid voice in demo', async () => {
      const response = await request(app)
        .post('/api/v1/demo')
        .send({
          text: 'Demo text',
          voice: 'invalid-voice',
        });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('INVALID_VOICE');
    });
  });

  describe('GET /health', () => {
    it('should return health status', async () => {
      const response = await request(app)
        .get('/health');

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('ok');
      expect(response.body.service).toBe('Agent Talk API');
      expect(response.body.database).toBeDefined();
    });
  });
});
