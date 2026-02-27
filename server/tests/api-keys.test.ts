/**
 * API Key Endpoint Tests
 * 
 * Tests for create, list, get, update, delete, and revoke operations
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Hono } from 'hono';
import { keysRoutes } from '../src/routes/keys.js';
import { errorHandler } from '../src/middleware/errorHandler.js';
import { createTestUser, resetStores, getAuthToken } from './setup.js';

// Helper to create test app with error handling
function createTestApp() {
  const app = new Hono();
  app.onError(errorHandler());
  app.route('/api/keys', keysRoutes);
  return app;
}

describe('API Key Endpoints', () => {
  let app: Hono;
  let userId: string;
  let token: string;

  beforeEach(async () => {
    app = createTestApp();
    resetStores();

    // Create test user
    const user = await createTestUser('keyuser@example.com', 'testPassword123');
    userId = user.id;
    token = await getAuthToken(userId, 'keyuser@example.com');
  });

  describe('POST /api/keys', () => {
    it('should create a new API key', async () => {
      const response = await app.request('/api/keys', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ name: 'My API Key' }),
      });

      const body = await response.json();
      expect(response.status).toBe(201);
      expect(body.success).toBe(true);
      expect(body.key).toBeDefined();
      expect(body.key.key).toMatch(/^at_live_/);
      expect(body.key.name).toBe('My API Key');
      expect(body.warning).toBeDefined();
    });

    it('should create a test API key', async () => {
      const response = await app.request('/api/keys', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ name: 'Test Key', test: true }),
      });

      const body = await response.json();
      expect(response.status).toBe(201);
      expect(body.key.key).toMatch(/^at_test_/);
    });

    it('should create API key without name', async () => {
      const response = await app.request('/api/keys', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({}),
      });

      const body = await response.json();
      expect(response.status).toBe(201);
      expect(body.key.name).toBeDefined(); // Will be default name
    });

    it('should reject unauthenticated requests', async () => {
      const response = await app.request('/api/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'My Key' }),
      });

      expect(response.status).toBe(401);
    });

    it('should reject name longer than 100 characters', async () => {
      const response = await app.request('/api/keys', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ name: 'a'.repeat(101) }),
      });

      const body = await response.json();
      expect(response.status).toBe(400);
      expect(body.error.message).toContain('100 characters');
    });

    it('should reject non-string name', async () => {
      const response = await app.request('/api/keys', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ name: 123 }),
      });

      expect(response.status).toBe(400);
    });

    it('should reject non-boolean test flag', async () => {
      const response = await app.request('/api/keys', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ test: 'yes' }),
      });

      expect(response.status).toBe(400);
    });

    it('should enforce maximum key limit', async () => {
      // Create 10 keys (the max)
      for (let i = 0; i < 10; i++) {
        await app.request('/api/keys', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({ name: `Key ${i}` }),
        });
      }

      // Try to create 11th key
      const response = await app.request('/api/keys', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ name: 'Extra Key' }),
      });

      const body = await response.json();
      expect(response.status).toBe(400);
      expect(body.error.message).toContain('Maximum number');
    });
  });

  describe('GET /api/keys', () => {
    beforeEach(async () => {
      // Create a few API keys
      await app.request('/api/keys', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ name: 'Key 1' }),
      });
      await app.request('/api/keys', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ name: 'Key 2' }),
      });
    });

    it('should list all API keys for user', async () => {
      const response = await app.request('/api/keys', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const body = await response.json();
      expect(response.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.keys).toHaveLength(2);
    });

    it('should return masked keys', async () => {
      const response = await app.request('/api/keys', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const body = await response.json();
      const keys = body.keys;
      keys.forEach((key: any) => {
        expect(key.maskedKey).toBeDefined();
        expect(key.maskedKey).toMatch(/\*\*\*/);
        expect(key.key).toBeUndefined(); // Full key should not be present
      });
    });

    it('should not show full key hash', async () => {
      const response = await app.request('/api/keys', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const body = await response.json();
      body.keys.forEach((key: any) => {
        expect(key.keyHash).toBeUndefined();
        expect(key.key_hash).toBeUndefined();
      });
    });

    it('should reject unauthenticated requests', async () => {
      const response = await app.request('/api/keys', {
        method: 'GET',
      });

      expect(response.status).toBe(401);
    });

    it('should return empty array for user with no keys', async () => {
      // Create new user with no keys
      const newUser = await createTestUser('nokeys@example.com', 'testPassword123');
      const newToken = await getAuthToken(newUser.id, 'nokeys@example.com');

      const response = await app.request('/api/keys', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${newToken}`,
        },
      });

      const body = await response.json();
      expect(response.status).toBe(200);
      expect(body.keys).toHaveLength(0);
    });
  });

  describe('GET /api/keys/:id', () => {
    let keyId: string;

    beforeEach(async () => {
      const response = await app.request('/api/keys', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ name: 'Test Key' }),
      });
      const body = await response.json();
      keyId = body.key.id;
    });

    it('should return specific API key', async () => {
      const response = await app.request(`/api/keys/${keyId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const body = await response.json();
      expect(response.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.key.id).toBe(keyId);
      expect(body.key.name).toBe('Test Key');
    });

    it('should return masked key', async () => {
      const response = await app.request(`/api/keys/${keyId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const body = await response.json();
      expect(body.key.maskedKey).toBeDefined();
      expect(body.key.key).toBeUndefined();
    });

    it('should return 404 for non-existent key', async () => {
      const response = await app.request('/api/keys/nonexistent-id', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      expect(response.status).toBe(404);
    });

    it('should reject unauthenticated requests', async () => {
      const response = await app.request(`/api/keys/${keyId}`, {
        method: 'GET',
      });

      expect(response.status).toBe(401);
    });
  });

  describe('DELETE /api/keys/:id', () => {
    let keyId: string;

    beforeEach(async () => {
      const response = await app.request('/api/keys', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ name: 'Key to Delete' }),
      });
      const body = await response.json();
      keyId = body.key.id;
    });

    it('should revoke (soft delete) an API key', async () => {
      const response = await app.request(`/api/keys/${keyId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const body = await response.json();
      expect(response.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.message).toContain('revoked');
    });

    it('should mark key as inactive', async () => {
      await app.request(`/api/keys/${keyId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      // Check that key still exists but is inactive
      const response = await app.request('/api/keys', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const body = await response.json();
      // Key should still be listed but marked as inactive
      const revokedKey = body.keys.find((k: any) => k.id === keyId);
      expect(revokedKey.isActive).toBe(false);
    });

    it('should return 404 for non-existent key', async () => {
      const response = await app.request('/api/keys/nonexistent-id', {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      expect(response.status).toBe(404);
    });

    it('should reject unauthenticated requests', async () => {
      const response = await app.request(`/api/keys/${keyId}`, {
        method: 'DELETE',
      });

      expect(response.status).toBe(401);
    });
  });

  describe('POST /api/keys/:id/revoke', () => {
    let keyId: string;

    beforeEach(async () => {
      const response = await app.request('/api/keys', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ name: 'Key to Revoke' }),
      });
      const body = await response.json();
      keyId = body.key.id;
    });

    it('should revoke an API key via POST endpoint', async () => {
      const response = await app.request(`/api/keys/${keyId}/revoke`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const body = await response.json();
      expect(response.status).toBe(200);
      expect(body.success).toBe(true);
    });
  });

  describe('PATCH /api/keys/:id', () => {
    let keyId: string;

    beforeEach(async () => {
      const response = await app.request('/api/keys', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ name: 'Original Name' }),
      });
      const body = await response.json();
      keyId = body.key.id;
    });

    it('should update key name', async () => {
      const response = await app.request(`/api/keys/${keyId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ name: 'Updated Name' }),
      });

      const body = await response.json();
      expect(response.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.key.name).toBe('Updated Name');
    });

    it('should reject empty body', async () => {
      const response = await app.request(`/api/keys/${keyId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({}),
      });

      const body = await response.json();
      expect(response.status).toBe(400);
      expect(body.error.code).toBe('MISSING_FIELD');
    });

    it('should reject name longer than 100 characters', async () => {
      const response = await app.request(`/api/keys/${keyId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ name: 'a'.repeat(101) }),
      });

      expect(response.status).toBe(400);
    });

    it('should return 404 for non-existent key', async () => {
      const response = await app.request('/api/keys/nonexistent-id', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ name: 'New Name' }),
      });

      expect(response.status).toBe(404);
    });

    it('should reject unauthenticated requests', async () => {
      const response = await app.request(`/api/keys/${keyId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'New Name' }),
      });

      expect(response.status).toBe(401);
    });
  });

  describe('API Key Validation', () => {
    it('should validate a valid API key', async () => {
      // Create a key
      const createResponse = await app.request('/api/keys', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ name: 'Validation Test Key' }),
      });

      const createBody = await createResponse.json();
      const fullKey = createBody.key.key;

      // Use the key service to validate
      const { validateApiKey } = await import('../src/services/apiKey.js');
      const result = await validateApiKey(fullKey);

      expect(result.keyId).toBe(createBody.key.id);
      expect(result.userId).toBe(userId);
    });

    it('should reject invalid API key format', async () => {
      const { validateApiKey } = await import('../src/services/apiKey.js');
      
      await expect(validateApiKey('invalid-key')).rejects.toThrow();
    });

    it('should reject revoked API key', async () => {
      const createResponse = await app.request('/api/keys', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ name: 'Key to Revoke' }),
      });

      const createBody = await createResponse.json();
      const fullKey = createBody.key.key;
      const keyId = createBody.key.id;

      // Revoke the key
      await app.request(`/api/keys/${keyId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      // Try to use revoked key
      const { validateApiKey } = await import('../src/services/apiKey.js');
      await expect(validateApiKey(fullKey)).rejects.toThrow();
    });
  });
});