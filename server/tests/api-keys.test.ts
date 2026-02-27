/**
 * API Key Endpoint Tests
 * 
 * Tests for create, list, get, update, delete, and revoke operations
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Hono } from 'hono';
import request from 'supertest';
import { keysRoutes } from '../src/routes/keys.js';
import { getDb } from '../src/db/index.js';
import { createUser } from '../src/db/users.js';
import bcrypt from 'bcrypt';
import { generateToken } from '../src/services/user.js';
import { generateApiKey, hashApiKey } from '../src/services/apiKey.js';

// Helper to create test app
function createTestApp() {
  const app = new Hono();
  app.route('/api/keys', keysRoutes);
  return app;
}

describe('API Key Endpoints', () => {
  let app: Hono;
  let userId: string;
  let token: string;

  beforeEach(async () => {
    app = createTestApp();
    const db = getDb();
    db.exec('DELETE FROM api_keys');
    db.exec('DELETE FROM users');

    // Create test user
    const passwordHash = await bcrypt.hash('testPassword123', 12);
    const user = await createUser({
      email: 'keyuser@example.com',
      passwordHash,
      tier: 'hobby',
    });
    userId = user.id;
    token = generateToken({ id: userId, email: 'keyuser@example.com' }).token;
  });

  describe('POST /api/keys', () => {
    it('should create a new API key', async () => {
      const response = await request(app)
        .post('/api/keys')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'My API Key' });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.key).toBeDefined();
      expect(response.body.key.key).toMatch(/^at_live_/);
      expect(response.body.key.name).toBe('My API Key');
      expect(response.body.warning).toBeDefined();
    });

    it('should create a test API key', async () => {
      const response = await request(app)
        .post('/api/keys')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Test Key', test: true });

      expect(response.status).toBe(201);
      expect(response.body.key.key).toMatch(/^at_test_/);
    });

    it('should create API key without name', async () => {
      const response = await request(app)
        .post('/api/keys')
        .set('Authorization', `Bearer ${token}`)
        .send({});

      expect(response.status).toBe(201);
      expect(response.body.key.name).toBeNull();
    });

    it('should reject unauthenticated requests', async () => {
      const response = await request(app)
        .post('/api/keys')
        .send({ name: 'My Key' });

      expect(response.status).toBe(401);
    });

    it('should reject name longer than 100 characters', async () => {
      const response = await request(app)
        .post('/api/keys')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'a'.repeat(101) });

      expect(response.status).toBe(400);
      expect(response.body.error.message).toContain('100 characters');
    });

    it('should reject non-string name', async () => {
      const response = await request(app)
        .post('/api/keys')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 123 });

      expect(response.status).toBe(400);
    });

    it('should reject non-boolean test flag', async () => {
      const response = await request(app)
        .post('/api/keys')
        .set('Authorization', `Bearer ${token}`)
        .send({ test: 'yes' });

      expect(response.status).toBe(400);
    });

    it('should enforce maximum key limit', async () => {
      // Create 10 keys (the max)
      for (let i = 0; i < 10; i++) {
        await request(app)
          .post('/api/keys')
          .set('Authorization', `Bearer ${token}`)
          .send({ name: `Key ${i}` });
      }

      // Try to create 11th key
      const response = await request(app)
        .post('/api/keys')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Extra Key' });

      expect(response.status).toBe(400);
      expect(response.body.error.message).toContain('Maximum number');
    });
  });

  describe('GET /api/keys', () => {
    beforeEach(async () => {
      // Create a few API keys
      await request(app)
        .post('/api/keys')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Key 1' });
      await request(app)
        .post('/api/keys')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Key 2' });
    });

    it('should list all API keys for user', async () => {
      const response = await request(app)
        .get('/api/keys')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.keys).toHaveLength(2);
    });

    it('should return masked keys', async () => {
      const response = await request(app)
        .get('/api/keys')
        .set('Authorization', `Bearer ${token}`);

      const keys = response.body.keys;
      keys.forEach((key: any) => {
        expect(key.maskedKey).toBeDefined();
        expect(key.maskedKey).toMatch(/\*\*\*/);
        expect(key.key).toBeUndefined(); // Full key should not be present
      });
    });

    it('should not show full key hash', async () => {
      const response = await request(app)
        .get('/api/keys')
        .set('Authorization', `Bearer ${token}`);

      response.body.keys.forEach((key: any) => {
        expect(key.keyHash).toBeUndefined();
        expect(key.key_hash).toBeUndefined();
      });
    });

    it('should reject unauthenticated requests', async () => {
      const response = await request(app)
        .get('/api/keys');

      expect(response.status).toBe(401);
    });

    it('should return empty array for user with no keys', async () => {
      // Create new user with no keys
      const passwordHash = await bcrypt.hash('testPassword123', 12);
      const newUser = await createUser({
        email: 'nokeys@example.com',
        passwordHash,
        tier: 'hobby',
      });
      const newToken = generateToken({ id: newUser.id, email: 'nokeys@example.com' }).token;

      const response = await request(app)
        .get('/api/keys')
        .set('Authorization', `Bearer ${newToken}`);

      expect(response.status).toBe(200);
      expect(response.body.keys).toHaveLength(0);
    });
  });

  describe('GET /api/keys/:id', () => {
    let keyId: string;

    beforeEach(async () => {
      const response = await request(app)
        .post('/api/keys')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Test Key' });
      keyId = response.body.key.id;
    });

    it('should return specific API key', async () => {
      const response = await request(app)
        .get(`/api/keys/${keyId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.key.id).toBe(keyId);
      expect(response.body.key.name).toBe('Test Key');
    });

    it('should return masked key', async () => {
      const response = await request(app)
        .get(`/api/keys/${keyId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(response.body.key.maskedKey).toBeDefined();
      expect(response.body.key.key).toBeUndefined();
    });

    it('should return 404 for non-existent key', async () => {
      const response = await request(app)
        .get('/api/keys/nonexistent-id')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(404);
    });

    it('should reject unauthenticated requests', async () => {
      const response = await request(app)
        .get(`/api/keys/${keyId}`);

      expect(response.status).toBe(401);
    });
  });

  describe('DELETE /api/keys/:id', () => {
    let keyId: string;

    beforeEach(async () => {
      const response = await request(app)
        .post('/api/keys')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Key to Delete' });
      keyId = response.body.key.id;
    });

    it('should revoke (soft delete) an API key', async () => {
      const response = await request(app)
        .delete(`/api/keys/${keyId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('revoked');
    });

    it('should mark key as inactive', async () => {
      await request(app)
        .delete(`/api/keys/${keyId}`)
        .set('Authorization', `Bearer ${token}`);

      // Check that key still exists but is inactive
      const response = await request(app)
        .get('/api/keys')
        .set('Authorization', `Bearer ${token}`);

      // Key should still be listed but marked as inactive
      const revokedKey = response.body.keys.find((k: any) => k.id === keyId);
      expect(revokedKey.isActive).toBe(false);
    });

    it('should return 404 for non-existent key', async () => {
      const response = await request(app)
        .delete('/api/keys/nonexistent-id')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(404);
    });

    it('should reject unauthenticated requests', async () => {
      const response = await request(app)
        .delete(`/api/keys/${keyId}`);

      expect(response.status).toBe(401);
    });
  });

  describe('POST /api/keys/:id/revoke', () => {
    let keyId: string;

    beforeEach(async () => {
      const response = await request(app)
        .post('/api/keys')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Key to Revoke' });
      keyId = response.body.key.id;
    });

    it('should revoke an API key via POST endpoint', async () => {
      const response = await request(app)
        .post(`/api/keys/${keyId}/revoke`)
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe('PATCH /api/keys/:id', () => {
    let keyId: string;

    beforeEach(async () => {
      const response = await request(app)
        .post('/api/keys')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Original Name' });
      keyId = response.body.key.id;
    });

    it('should update key name', async () => {
      const response = await request(app)
        .patch(`/api/keys/${keyId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Updated Name' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.key.name).toBe('Updated Name');
    });

    it('should reject empty body', async () => {
      const response = await request(app)
        .patch(`/api/keys/${keyId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('MISSING_FIELD');
    });

    it('should reject name longer than 100 characters', async () => {
      const response = await request(app)
        .patch(`/api/keys/${keyId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'a'.repeat(101) });

      expect(response.status).toBe(400);
    });

    it('should reject invalid JSON', async () => {
      const response = await request(app)
        .patch(`/api/keys/${keyId}`)
        .set('Authorization', `Bearer ${token}`)
        .set('Content-Type', 'application/json')
        .send('invalid json');

      expect(response.status).toBe(400);
    });

    it('should return 404 for non-existent key', async () => {
      const response = await request(app)
        .patch('/api/keys/nonexistent-id')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'New Name' });

      expect(response.status).toBe(404);
    });

    it('should reject unauthenticated requests', async () => {
      const response = await request(app)
        .patch(`/api/keys/${keyId}`)
        .send({ name: 'New Name' });

      expect(response.status).toBe(401);
    });
  });

  describe('API Key Validation', () => {
    it('should validate a valid API key', async () => {
      // Create a key
      const createResponse = await request(app)
        .post('/api/keys')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Validation Test Key' });

      const fullKey = createResponse.body.key.key;

      // Use the key service to validate
      const { validateApiKey } = await import('../src/services/apiKey.js');
      const result = validateApiKey(fullKey);

      expect(result.keyId).toBe(createResponse.body.key.id);
      expect(result.userId).toBe(userId);
    });

    it('should reject invalid API key format', async () => {
      const { validateApiKey } = await import('../src/services/apiKey.js');

      expect(() => validateApiKey('invalid-key')).toThrow();
    });

    it('should reject revoked API key', async () => {
      const createResponse = await request(app)
        .post('/api/keys')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Key to Revoke' });

      const fullKey = createResponse.body.key.key;
      const keyId = createResponse.body.key.id;

      // Revoke the key
      await request(app)
        .delete(`/api/keys/${keyId}`)
        .set('Authorization', `Bearer ${token}`);

      // Try to use revoked key
      const { validateApiKey } = await import('../src/services/apiKey.js');

      expect(() => validateApiKey(fullKey)).toThrow();
    });
  });
});
