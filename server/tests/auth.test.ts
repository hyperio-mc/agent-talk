/**
 * Auth Endpoint Tests
 * 
 * Tests for signup, login, logout, and token validation
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Hono } from 'hono';
import request from 'supertest';
import { authRoutes } from '../src/routes/auth.js';
import { getDb } from '../src/db/index.js';
import { createUser, clearUsers, findUserByEmail } from '../src/db/users.js';
import { clearAllApiKeys } from '../src/db/keys.js';
import bcrypt from 'bcrypt';
import { generateToken, verifyToken } from '../src/services/user.js';

// Helper to create test app
function createTestApp() {
  const app = new Hono();
  app.route('/api/v1/auth', authRoutes);
  return app;
}

describe('Auth Endpoints', () => {
  let app: Hono;

  beforeEach(async () => {
    app = createTestApp();
    const db = getDb();
    db.exec('DELETE FROM api_keys');
    db.exec('DELETE FROM users');
  });

  describe('POST /api/v1/auth/signup', () => {
    it('should create a new user with valid credentials', async () => {
      const response = await request(app)
        .post('/api/v1/auth/signup')
        .send({
          email: 'newuser@example.com',
          password: 'securePassword123',
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.user).toBeDefined();
      expect(response.body.user.email).toBe('newuser@example.com');
      expect(response.body.token).toBeDefined();
      expect(response.body.apiKey).toBeDefined();
      expect(response.body.apiKey.key).toBeDefined();
      expect(response.body.apiKey.key).toMatch(/^at_live_/);
    });

    it('should reject signup with missing email', async () => {
      const response = await request(app)
        .post('/api/v1/auth/signup')
        .send({
          password: 'securePassword123',
        });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('MISSING_FIELD');
      expect(response.body.error.details.field).toBe('email');
    });

    it('should reject signup with missing password', async () => {
      const response = await request(app)
        .post('/api/v1/auth/signup')
        .send({
          email: 'test@example.com',
        });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('MISSING_FIELD');
      expect(response.body.error.details.field).toBe('password');
    });

    it('should reject signup with short password', async () => {
      const response = await request(app)
        .post('/api/v1/auth/signup')
        .send({
          email: 'test@example.com',
          password: 'short',
        });

      expect(response.status).toBe(400);
      expect(response.body.error.message).toContain('8 characters');
    });

    it('should reject signup with invalid email', async () => {
      const response = await request(app)
        .post('/api/v1/auth/signup')
        .send({
          email: 'not-an-email',
          password: 'securePassword123',
        });

      expect(response.status).toBe(400);
      expect(response.body.error.message).toContain('email');
    });

    it('should reject duplicate email', async () => {
      // Create first user
      await request(app)
        .post('/api/v1/auth/signup')
        .send({
          email: 'duplicate@example.com',
          password: 'securePassword123',
        });

      // Try to create second user with same email
      const response = await request(app)
        .post('/api/v1/auth/signup')
        .send({
          email: 'duplicate@example.com',
          password: 'anotherPassword456',
        });

      expect(response.status).toBe(409);
      expect(response.body.error.message).toContain('already exists');
    });

    it('should set auth cookie on successful signup', async () => {
      const response = await request(app)
        .post('/api/v1/auth/signup')
        .send({
          email: 'cookie@example.com',
          password: 'securePassword123',
        });

      expect(response.headers['set-cookie']).toBeDefined();
      expect(response.headers['set-cookie']).toMatch(/auth_token=/);
    });

    it('should reject non-string email', async () => {
      const response = await request(app)
        .post('/api/v1/auth/signup')
        .send({
          email: 123,
          password: 'securePassword123',
        });

      expect(response.status).toBe(400);
    });

    it('should reject non-string password', async () => {
      const response = await request(app)
        .post('/api/v1/auth/signup')
        .send({
          email: 'test@example.com',
          password: { value: 'secret' },
        });

      expect(response.status).toBe(400);
    });
  });

  describe('POST /api/v1/auth/login', () => {
    beforeEach(async () => {
      // Create a test user
      const passwordHash = await bcrypt.hash('correctPassword123', 12);
      await createUser({
        email: 'login@example.com',
        passwordHash,
        tier: 'hobby',
      });
    });

    it('should login with valid credentials', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'login@example.com',
          password: 'correctPassword123',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.user).toBeDefined();
      expect(response.body.user.email).toBe('login@example.com');
      expect(response.body.token).toBeDefined();
      expect(response.body.expiresAt).toBeDefined();
    });

    it('should reject login with wrong password', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'login@example.com',
          password: 'wrongPassword',
        });

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('UNAUTHORIZED');
    });

    it('should reject login with non-existent email', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'somePassword123',
        });

      expect(response.status).toBe(401);
      // Should not reveal if email exists or not
      expect(response.body.error.message).toContain('Invalid email or password');
    });

    it('should reject login with missing email', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          password: 'somePassword123',
        });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('MISSING_FIELD');
    });

    it('should reject login with missing password', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'test@example.com',
        });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('MISSING_FIELD');
    });

    it('should set auth cookie on successful login', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'login@example.com',
          password: 'correctPassword123',
        });

      expect(response.headers['set-cookie']).toBeDefined();
      expect(response.headers['set-cookie']).toMatch(/auth_token=/);
    });

    it('should return valid JWT token', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'login@example.com',
          password: 'correctPassword123',
        });

      const token = response.body.token;
      const payload = verifyToken(token);

      expect(payload).toBeDefined();
      expect(payload?.email).toBe('login@example.com');
    });
  });

  describe('POST /api/v1/auth/logout', () => {
    it('should clear auth cookie', async () => {
      const response = await request(app)
        .post('/api/v1/auth/logout');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.headers['set-cookie']).toMatch(/auth_token=;/);
    });
  });

  describe('GET /api/v1/auth/me', () => {
    let userId: string;
    let token: string;

    beforeEach(async () => {
      // Create test user
      const passwordHash = await bcrypt.hash('testPassword123', 12);
      const user = await createUser({
        email: 'me@example.com',
        passwordHash,
        tier: 'hobby',
      });
      userId = user.id;
      token = generateToken({ id: userId, email: 'me@example.com' }).token;
    });

    it('should return user info when authenticated', async () => {
      const response = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.user.email).toBe('me@example.com');
    });

    it('should accept token from cookie', async () => {
      const response = await request(app)
        .get('/api/v1/auth/me')
        .set('Cookie', `auth_token=${token}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should reject request without token', async () => {
      const response = await request(app)
        .get('/api/v1/auth/me');

      expect(response.status).toBe(401);
    });

    it('should reject request with invalid token', async () => {
      const response = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', 'Bearer invalid-token');

      expect(response.status).toBe(401);
    });

    it('should not return password hash', async () => {
      const response = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(response.body.user.passwordHash).toBeUndefined();
      expect(response.body.user.password_hash).toBeUndefined();
    });
  });

  describe('POST /api/v1/auth/forgot-password', () => {
    beforeEach(async () => {
      const passwordHash = await bcrypt.hash('testPassword123', 12);
      await createUser({
        email: 'forgot@example.com',
        passwordHash,
        tier: 'hobby',
      });
    });

    it('should accept password reset request', async () => {
      const response = await request(app)
        .post('/api/v1/auth/forgot-password')
        .send({
          email: 'forgot@example.com',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should return success even for non-existent email (security)', async () => {
      const response = await request(app)
        .post('/api/v1/auth/forgot-password')
        .send({
          email: 'nonexistent@example.com',
        });

      // Should return same response to avoid revealing email existence
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should reject missing email', async () => {
      const response = await request(app)
        .post('/api/v1/auth/forgot-password')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('MISSING_FIELD');
    });
  });

  describe('POST /api/v1/auth/reset-password', () => {
    it('should reject invalid reset token', async () => {
      const response = await request(app)
        .post('/api/v1/auth/reset-password')
        .send({
          token: 'invalid-token',
          newPassword: 'newPassword123',
        });

      expect(response.status).toBe(400);
      expect(response.body.error.message).toContain('Invalid or expired');
    });

    it('should reject missing token', async () => {
      const response = await request(app)
        .post('/api/v1/auth/reset-password')
        .send({
          newPassword: 'newPassword123',
        });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('MISSING_FIELD');
    });

    it('should reject missing newPassword', async () => {
      const response = await request(app)
        .post('/api/v1/auth/reset-password')
        .send({
          token: 'some-token',
        });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('MISSING_FIELD');
    });
  });

  describe('POST /api/v1/auth/change-password', () => {
    let userId: string;
    let token: string;

    beforeEach(async () => {
      const passwordHash = await bcrypt.hash('oldPassword123', 12);
      const user = await createUser({
        email: 'changepass@example.com',
        passwordHash,
        tier: 'hobby',
      });
      userId = user.id;
      token = generateToken({ id: userId, email: 'changepass@example.com' }).token;
    });

    it('should change password with valid credentials', async () => {
      const response = await request(app)
        .post('/api/v1/auth/change-password')
        .set('Authorization', `Bearer ${token}`)
        .send({
          currentPassword: 'oldPassword123',
          newPassword: 'newPassword456',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should reject wrong current password', async () => {
      const response = await request(app)
        .post('/api/v1/auth/change-password')
        .set('Authorization', `Bearer ${token}`)
        .send({
          currentPassword: 'wrongPassword',
          newPassword: 'newPassword456',
        });

      expect(response.status).toBe(500); // Error thrown
    });

    it('should reject without authentication', async () => {
      const response = await request(app)
        .post('/api/v1/auth/change-password')
        .send({
          currentPassword: 'oldPassword123',
          newPassword: 'newPassword456',
        });

      expect(response.status).toBe(401);
    });

    it('should reject short new password', async () => {
      const response = await request(app)
        .post('/api/v1/auth/change-password')
        .set('Authorization', `Bearer ${token}`)
        .send({
          currentPassword: 'oldPassword123',
          newPassword: 'short',
        });

      expect(response.status).toBe(500); // Error thrown
      expect(response.body.error.message).toContain('8 characters');
    });
  });
});
