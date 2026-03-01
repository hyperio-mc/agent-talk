/**
 * Auth Endpoint Tests
 * 
 * Tests for signup, login, logout, and token validation
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Hono } from 'hono';
import { authRoutes } from '../src/routes/auth.js';
import { errorHandler } from '../src/middleware/errorHandler.js';
import { createTestUser, resetStores, getAuthToken } from './setup.js';

// Helper to create test app with error handling
function createTestApp() {
  const app = new Hono();
  app.onError(errorHandler());
  app.route('/api/v1/auth', authRoutes);
  return app;
}

describe('Auth Endpoints', () => {
  let app: Hono;

  beforeEach(async () => {
    app = createTestApp();
    resetStores();
  });

  describe('POST /api/v1/auth/signup', () => {
    it('should create a new user with valid credentials', async () => {
      const response = await app.request('/api/v1/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'newuser@example.com',
          password: 'securePassword123',
        }),
      });

      const body = await response.json();
      expect(response.status).toBe(201);
      expect(body.success).toBe(true);
      expect(body.user).toBeDefined();
      expect(body.user.email).toBe('newuser@example.com');
      expect(body.token).toBeDefined();
      expect(body.apiKey).toBeDefined();
      expect(body.apiKey.key).toMatch(/^at_live_/);
    });

    it('should reject signup with missing email', async () => {
      const response = await app.request('/api/v1/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          password: 'securePassword123',
        }),
      });

      const body = await response.json();
      expect(response.status).toBe(400);
      expect(body.error.code).toBe('MISSING_FIELD');
      expect(body.error.details.field).toBe('email');
    });

    it('should reject signup with missing password', async () => {
      const response = await app.request('/api/v1/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'test@example.com',
        }),
      });

      const body = await response.json();
      expect(response.status).toBe(400);
      expect(body.error.code).toBe('MISSING_FIELD');
      expect(body.error.details.field).toBe('password');
    });

    it('should reject signup with short password', async () => {
      const response = await app.request('/api/v1/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'test@example.com',
          password: 'short',
        }),
      });

      const body = await response.json();
      expect(response.status).toBe(400);
      expect(body.error.message).toContain('8 characters');
    });

    it('should reject signup with invalid email', async () => {
      const response = await app.request('/api/v1/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'not-an-email',
          password: 'securePassword123',
        }),
      });

      const body = await response.json();
      expect(response.status).toBe(400);
      expect(body.error.message).toContain('email');
    });

    it('should reject duplicate email', async () => {
      // Create first user
      await app.request('/api/v1/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'duplicate@example.com',
          password: 'securePassword123',
        }),
      });

      // Try to create second user with same email
      const response = await app.request('/api/v1/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'duplicate@example.com',
          password: 'anotherPassword456',
        }),
      });

      const body = await response.json();
      expect(response.status).toBe(409);
      expect(body.error.message).toContain('already exists');
    });

    it('should set auth cookie on successful signup', async () => {
      const response = await app.request('/api/v1/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'cookie@example.com',
          password: 'securePassword123',
        }),
      });

      const setCookie = response.headers.get('Set-Cookie');
      expect(setCookie).toBeDefined();
      expect(setCookie).toMatch(/auth_token=/);
    });

    it('should reject non-string email', async () => {
      const response = await app.request('/api/v1/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 123,
          password: 'securePassword123',
        }),
      });

      expect(response.status).toBe(400);
    });

    it('should reject non-string password', async () => {
      const response = await app.request('/api/v1/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'test@example.com',
          password: { value: 'secret' },
        }),
      });

      expect(response.status).toBe(400);
    });
  });

  describe('POST /api/v1/auth/login', () => {
    beforeEach(async () => {
      // Create a test user
      await createTestUser('login@example.com', 'correctPassword123');
    });

    it('should login with valid credentials', async () => {
      const response = await app.request('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'login@example.com',
          password: 'correctPassword123',
        }),
      });

      const body = await response.json();
      expect(response.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.user).toBeDefined();
      expect(body.user.email).toBe('login@example.com');
      expect(body.token).toBeDefined();
      expect(body.expiresAt).toBeDefined();
    });

    it('should reject login with wrong password', async () => {
      const response = await app.request('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'login@example.com',
          password: 'wrongPassword',
        }),
      });

      const body = await response.json();
      expect(response.status).toBe(401);
      expect(body.error.code).toBe('UNAUTHORIZED');
    });

    it('should reject login with non-existent email', async () => {
      const response = await app.request('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'nonexistent@example.com',
          password: 'somePassword123',
        }),
      });

      const body = await response.json();
      expect(response.status).toBe(401);
      // Should not reveal if email exists or not
      expect(body.error.message).toContain('Invalid email or password');
    });

    it('should reject login with missing email', async () => {
      const response = await app.request('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          password: 'somePassword123',
        }),
      });

      const body = await response.json();
      expect(response.status).toBe(400);
      expect(body.error.code).toBe('MISSING_FIELD');
    });

    it('should reject login with missing password', async () => {
      const response = await app.request('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'test@example.com',
        }),
      });

      const body = await response.json();
      expect(response.status).toBe(400);
      expect(body.error.code).toBe('MISSING_FIELD');
    });

    it('should set auth cookie on successful login', async () => {
      const response = await app.request('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'login@example.com',
          password: 'correctPassword123',
        }),
      });

      const setCookie = response.headers.get('Set-Cookie');
      expect(setCookie).toBeDefined();
      expect(setCookie).toMatch(/auth_token=/);
    });

    it('should return valid JWT token', async () => {
      const response = await app.request('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'login@example.com',
          password: 'correctPassword123',
        }),
      });

      const body = await response.json();
      const token = body.token;
      const { verifyToken } = await import('../src/services/user.js');
      const payload = verifyToken(token);

      expect(payload).toBeDefined();
      expect(payload?.email).toBe('login@example.com');
    });
  });

  describe('POST /api/v1/auth/logout', () => {
    it('should clear auth cookie', async () => {
      const response = await app.request('/api/v1/auth/logout', {
        method: 'POST',
      });

      const body = await response.json();
      expect(response.status).toBe(200);
      expect(body.success).toBe(true);
      const setCookie = response.headers.get('Set-Cookie');
      expect(setCookie).toMatch(/auth_token=;/);
    });
  });

  describe('GET /api/v1/auth/me', () => {
    let userId: string;
    let token: string;

    beforeEach(async () => {
      // Create test user
      const user = await createTestUser('me@example.com', 'testPassword123');
      userId = user.id;
      token = await getAuthToken(userId, 'me@example.com');
    });

    it('should return user info when authenticated', async () => {
      const response = await app.request('/api/v1/auth/me', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const body = await response.json();
      expect(response.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.user.email).toBe('me@example.com');
    });

    it('should accept token from cookie', async () => {
      const response = await app.request('/api/v1/auth/me', {
        method: 'GET',
        headers: {
          'Cookie': `auth_token=${token}`,
        },
      });

      const body = await response.json();
      expect(response.status).toBe(200);
      expect(body.success).toBe(true);
    });

    it('should reject request without token', async () => {
      const response = await app.request('/api/v1/auth/me', {
        method: 'GET',
      });

      expect(response.status).toBe(401);
    });

    it('should reject request with invalid token', async () => {
      const response = await app.request('/api/v1/auth/me', {
        method: 'GET',
        headers: {
          'Authorization': 'Bearer invalid-token',
        },
      });

      expect(response.status).toBe(401);
    });

    it('should not return password hash', async () => {
      const response = await app.request('/api/v1/auth/me', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const body = await response.json();
      expect(body.user.passwordHash).toBeUndefined();
      expect(body.user.password_hash).toBeUndefined();
    });
  });

  describe('POST /api/v1/auth/forgot-password', () => {
    beforeEach(async () => {
      await createTestUser('forgot@example.com', 'testPassword123');
    });

    it('should accept password reset request', async () => {
      const response = await app.request('/api/v1/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'forgot@example.com',
        }),
      });

      const body = await response.json();
      expect(response.status).toBe(200);
      expect(body.success).toBe(true);
    });

    it('should return success even for non-existent email (security)', async () => {
      const response = await app.request('/api/v1/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'nonexistent@example.com',
        }),
      });

      const body = await response.json();
      // Should return same response to avoid revealing email existence
      expect(response.status).toBe(200);
      expect(body.success).toBe(true);
    });

    it('should reject missing email', async () => {
      const response = await app.request('/api/v1/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      const body = await response.json();
      expect(response.status).toBe(400);
      expect(body.error.code).toBe('MISSING_FIELD');
    });
  });

  describe('POST /api/v1/auth/reset-password', () => {
    it('should reject invalid reset token', async () => {
      const response = await app.request('/api/v1/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: 'invalid-token',
          newPassword: 'newPassword123',
        }),
      });

      const body = await response.json();
      expect(response.status).toBe(400);
      expect(body.error.message).toContain('Invalid or expired');
    });

    it('should reject missing token', async () => {
      const response = await app.request('/api/v1/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          newPassword: 'newPassword123',
        }),
      });

      const body = await response.json();
      expect(response.status).toBe(400);
      expect(body.error.code).toBe('MISSING_FIELD');
    });

    it('should reject missing newPassword', async () => {
      const response = await app.request('/api/v1/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: 'some-token',
        }),
      });

      const body = await response.json();
      expect(response.status).toBe(400);
      expect(body.error.code).toBe('MISSING_FIELD');
    });
  });

  describe('POST /api/v1/auth/change-password', () => {
    let userId: string;
    let token: string;

    beforeEach(async () => {
      const user = await createTestUser('changepass@example.com', 'oldPassword123');
      userId = user.id;
      token = await getAuthToken(userId, 'changepass@example.com');
    });

    it('should change password with valid credentials', async () => {
      const response = await app.request('/api/v1/auth/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          currentPassword: 'oldPassword123',
          newPassword: 'newPassword456',
        }),
      });

      const body = await response.json();
      expect(response.status).toBe(200);
      expect(body.success).toBe(true);
    });

    it('should reject wrong current password', async () => {
      const response = await app.request('/api/v1/auth/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          currentPassword: 'wrongPassword',
          newPassword: 'newPassword456',
        }),
      });

      // Should return 401 for wrong password
      expect(response.status).toBe(401);
    });

    it('should reject without authentication', async () => {
      const response = await app.request('/api/v1/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword: 'oldPassword123',
          newPassword: 'newPassword456',
        }),
      });

      expect(response.status).toBe(401);
    });

    it('should reject short new password', async () => {
      const response = await app.request('/api/v1/auth/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          currentPassword: 'oldPassword123',
          newPassword: 'short',
        }),
      });

      const body = await response.json();
      expect(response.status).toBe(400);
      expect(body.error.message).toContain('8 characters');
    });
  });
});