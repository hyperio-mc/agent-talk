/**
 * Test Setup for Agent Talk API
 * 
 * Provides in-memory implementations for tests with proper async support.
 */

import { beforeAll, beforeEach, afterAll, vi, expect } from 'vitest';
import { Hono } from 'hono';

// Test assertion helpers for Hono responses
export async function expectResponse(response: Response, expectedStatus: number) {
  const body = await response.json();
  expect(response.status).toBe(expectedStatus);
  return body;
}

// Helper to create a test app with all necessary middleware
export function createTestHonoApp(): Hono {
  const app = new Hono({
    strict: false
  });
  return app;
}

// Store original env
const originalEnv = { ...process.env };

// Set test environment variables FIRST
process.env.JWT_SECRET = 'test-secret-key-for-testing-only';
process.env.NODE_ENV = 'test';
process.env.TTS_MODE = 'simulation';
process.env.HYPR_MODE = ''; // Force development mode for tests

// In-memory storage for users
const memoryUsers = new Map<string, any>();
const emailIndex = new Map<string, string>();

// In-memory storage for API keys
const memoryKeys = new Map<string, any>();
const hashIndex = new Map<string, string>();

// In-memory storage for memos
const memoryMemos = new Map<string, any>();

// ID generators
const generateUserId = () => `user_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
const generateKeyId = () => `key_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
const generateMemoId = () => `memo_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

// Helper to reset all stores
function resetAllStores() {
  memoryUsers.clear();
  emailIndex.clear();
  memoryKeys.clear();
  hashIndex.clear();
  memoryMemos.clear();
}

// Mock users database
vi.mock('../src/db/users.js', () => ({
  findUserById: vi.fn(async (id: string) => memoryUsers.get(id) || null),
  
  findUserByEmail: vi.fn(async (email: string) => {
    const normalizedEmail = email.toLowerCase();
    const id = emailIndex.get(normalizedEmail);
    if (!id) return null;
    return memoryUsers.get(id) || null;
  }),
  
  createUser: vi.fn(async (input: { email: string; passwordHash?: string; tier?: string; role?: string }) => {
    const normalizedEmail = input.email.toLowerCase();
    
    // Check if user already exists
    if (emailIndex.has(normalizedEmail)) {
      throw new Error('User with this email already exists');
    }
    
    const id = generateUserId();
    const now = new Date().toISOString();
    const user = {
      id,
      email: normalizedEmail,
      passwordHash: input.passwordHash,
      tier: input.tier || 'hobby',
      role: input.role || 'user',
      createdAt: now,
      updatedAt: now,
      emailVerified: false,
    };
    
    memoryUsers.set(id, user);
    emailIndex.set(normalizedEmail, id);
    
    return user;
  }),
  
  updateUser: vi.fn(async (id: string, data: Record<string, any>) => {
    const user = memoryUsers.get(id);
    if (!user) return null;
    
    // Update email index if email changed
    if (data.email && data.email !== user.email) {
      emailIndex.delete(user.email.toLowerCase());
      emailIndex.set(data.email.toLowerCase(), id);
    }
    
    const updated = { ...user, ...data, updatedAt: new Date().toISOString() };
    memoryUsers.set(id, updated);
    return updated;
  }),
  
  getAllUsers: vi.fn(async () => Array.from(memoryUsers.values())),
  
  updateUserTier: vi.fn(async (userId: string, tier: string) => {
    const user = memoryUsers.get(userId);
    if (user) {
      user.tier = tier;
      user.updatedAt = new Date().toISOString();
      memoryUsers.set(userId, user);
    }
  }),
  
  setPasswordResetToken: vi.fn(async (email: string, token: string, expiresAt: string) => {
    const normalizedEmail = email.toLowerCase();
    const id = emailIndex.get(normalizedEmail);
    if (!id) return false;
    
    const user = memoryUsers.get(id);
    if (!user) return false;
    
    user.resetToken = token;
    user.resetTokenExpires = expiresAt;
    user.updatedAt = new Date().toISOString();
    return true;
  }),
  
  resetPassword: vi.fn(async (token: string, newPasswordHash: string) => {
    for (const user of memoryUsers.values()) {
      if (user.resetToken === token) {
        if (user.resetTokenExpires && new Date(user.resetTokenExpires) < new Date()) {
          return null;
        }
        user.passwordHash = newPasswordHash;
        user.resetToken = undefined;
        user.resetTokenExpires = undefined;
        user.updatedAt = new Date().toISOString();
        return user;
      }
    }
    return null;
  }),
  
  verifyEmail: vi.fn(async (token: string) => {
    for (const user of memoryUsers.values()) {
      if (user.verificationToken === token) {
        user.emailVerified = true;
        user.verificationToken = undefined;
        user.updatedAt = new Date().toISOString();
        return user;
      }
    }
    return null;
  }),
  
  _resetUsers: () => {
    memoryUsers.clear();
    emailIndex.clear();
  },
}));

// Mock API keys database
vi.mock('../src/db/keys.js', () => ({
  createApiKeyRecord: vi.fn(async (data: { userId: string; keyHash: string; prefix: string; name: string }) => {
    const id = generateKeyId();
    const now = new Date().toISOString();
    const apiKey = {
      id,
      user_id: data.userId,
      key_hash: data.keyHash,
      prefix: data.prefix,
      name: data.name,
      is_active: true,
      usage_count: 0,
      created_at: now,
      last_used_at: null,
    };
    
    memoryKeys.set(id, apiKey);
    hashIndex.set(data.keyHash, id);
    
    return apiKey;
  }),
  
  getApiKeyByKey: vi.fn(async (keyHash: string) => {
    const id = hashIndex.get(keyHash);
    if (!id) return null;
    return memoryKeys.get(id) || null;
  }),
  
  findApiKeyByHash: vi.fn(async (keyHash: string) => {
    const id = hashIndex.get(keyHash);
    if (!id) return null;
    return memoryKeys.get(id) || null;
  }),
  
  getApiKeysByUserId: vi.fn(async (userId: string) => {
    return Array.from(memoryKeys.values())
      .filter(k => k.user_id === userId)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }),
  
  listApiKeysByUser: vi.fn(async (userId: string) => {
    return Array.from(memoryKeys.values())
      .filter(k => k.user_id === userId)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }),
  
  revokeApiKey: vi.fn(async (id: string) => {
    const key = memoryKeys.get(id);
    if (!key) return false;
    key.is_active = false;
    memoryKeys.set(id, key);
    return true;
  }),
  
  deleteApiKey: vi.fn(async (id: string) => {
    const key = memoryKeys.get(id);
    if (key) {
      hashIndex.delete(key.key_hash);
    }
    return memoryKeys.delete(id);
  }),
  
  incrementKeyUsage: vi.fn(async (id: string) => {
    const key = memoryKeys.get(id);
    if (key) {
      key.usage_count = (key.usage_count || 0) + 1;
      key.last_used_at = new Date().toISOString();
      memoryKeys.set(id, key);
    }
  }),
  
  getAllApiKeys: vi.fn(async () => Array.from(memoryKeys.values())),
  
  countApiKeysByUser: vi.fn(async (userId: string) => {
    return Array.from(memoryKeys.values()).filter(k => k.user_id === userId).length;
  }),
  
  findApiKeyByIdAsync: vi.fn(async (id: string) => memoryKeys.get(id) || null),
  
  findApiKeyById: vi.fn((id: string) => memoryKeys.get(id) || null),
  
  updateApiKey: vi.fn(async (id: string, updates: { name?: string }) => {
    const key = memoryKeys.get(id);
    if (!key) return null;
    if (updates.name !== undefined) {
      key.name = updates.name;
    }
    memoryKeys.set(id, key);
    return key;
  }),
  
  _resetKeys: () => {
    memoryKeys.clear();
    hashIndex.clear();
  },
}));

// Mock memos database
vi.mock('../src/db/memos.js', () => ({
  createMemo: vi.fn(async (data: { userId: string; audioUrl: string; durationSec?: number; title?: string }) => {
    const id = generateMemoId();
    const memo = {
      id,
      user_id: data.userId,
      audio_url: data.audioUrl,
      duration_seconds: data.durationSec || 0,
      title: data.title || null,
      created_at: new Date().toISOString(),
    };
    memoryMemos.set(id, memo);
    return memo;
  }),
  
  getMemosByUserId: vi.fn(async (userId: string) => {
    return Array.from(memoryMemos.values())
      .filter(m => m.user_id === userId)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }),
  
  getMemoById: vi.fn(async (id: string) => memoryMemos.get(id) || null),
  
  deleteMemo: vi.fn(async (id: string) => memoryMemos.delete(id)),
  
  getAllMemos: vi.fn(async () => Array.from(memoryMemos.values())),
  
  countMemosByUserId: vi.fn(async (userId: string) => {
    return Array.from(memoryMemos.values()).filter(m => m.user_id === userId).length;
  }),
}));

// Mock db/index.js module
vi.mock('../src/db/index.js', () => ({
  getDb: vi.fn(() => null),
  closeDb: vi.fn(() => {}),
  runMigrations: vi.fn(async () => {}),
  initDatabases: vi.fn(async () => {}),
  checkHealth: vi.fn(async () => ({ status: 'ok', message: 'Test database', mode: 'memory' })),
  isHyprMode: vi.fn(() => false),
  DB_NAMES: {
    USERS: 'users',
    API_KEYS: 'api_keys',
    MEMOS: 'memos',
    USAGE_LOGS: 'usage_logs',
    SUBSCRIPTIONS: 'subscriptions',
  },
}));

// Mock storage service
vi.mock('../src/services/storage.js', () => ({
  initStorage: vi.fn(),
  getStorage: vi.fn(() => ({
    upload: vi.fn(async (data: ArrayBuffer, format: string) => ({
      id: 'audio_test123',
      url: 'http://localhost:3001/audio/audio_test123.mp3',
      key: 'audio_test123.mp3',
      size: data.byteLength || 100,
      format,
    })),
    get: vi.fn(),
    delete: vi.fn(),
    getUrl: vi.fn().mockReturnValue('http://localhost:3001/audio/test.mp3'),
  })),
}));

// Mock HYPR Micro client
vi.mock('../src/lib/hypr-micro.js', () => ({
  getMicroClient: vi.fn(() => {
    throw new Error('HYPR Micro should not be used in tests');
  }),
  HyprMicroClient: class {
    async insert() { throw new Error('Not implemented'); }
    async get() { throw new Error('Not implemented'); }
    async update() { throw new Error('Not implemented'); }
    async delete() { throw new Error('Not implemented'); }
    async query() { throw new Error('Not implemented'); }
    async list() { throw new Error('Not implemented'); }
    async createDatabase() { throw new Error('Not implemented'); }
    async listDatabases() { return []; }
  },
}));

// Mock analytics (avoid actual logging in tests)
vi.mock('../src/services/analytics.js', () => ({
  logMemoCreated: vi.fn(),
  logMemoFailed: vi.fn(),
  logKeyCreated: vi.fn(),
  logKeyRevoked: vi.fn(),
  logUserSignup: vi.fn(),
  logUserLogin: vi.fn(),
  getAnalyticsSummary: vi.fn(() => ({ events: [], total: 0 })),
}));

// Mock monitoring
vi.mock('../src/services/monitoring.js', () => ({
  getMetricsSummary: vi.fn(() => ({
    requests: { total: 0, errors: 0 },
    memos: { created: 0, failed: 0 },
    keys: { total: 0, active: 0 },
  })),
  recordRequest: vi.fn(),
  recordError: vi.fn(),
}));

// Global setup/teardown
beforeAll(async () => {
  // Tests are ready
});

afterAll(async () => {
  process.env = originalEnv;
});

beforeEach(async () => {
  // Reset all in-memory stores before each test
  resetAllStores();
});

afterEach(async () => {
  // Cleanup after each test
});

/**
 * Helper to make requests to a Hono app
 * This simulates HTTP requests without needing a server
 */
export async function appRequest(
  app: any,
  method: string,
  path: string,
  options: {
    body?: any;
    headers?: Record<string, string>;
    cookies?: Record<string, string>;
  } = {}
): Promise<{ status: number; body: any; headers: Headers }> {
  const { body, headers = {}, cookies = {} } = options;
  
  // Build headers
  const requestHeaders: Record<string, string> = {
    ...headers,
  };
  
  // Add Content-Type for JSON bodies
  if (body && !requestHeaders['Content-Type']) {
    requestHeaders['Content-Type'] = 'application/json';
  }
  
  // Build cookie header
  if (Object.keys(cookies).length > 0) {
    requestHeaders['Cookie'] = Object.entries(cookies)
      .map(([k, v]) => `${k}=${v}`)
      .join('; ');
  }
  
  // Make the request
  const init: RequestInit = {
    method,
    headers: requestHeaders,
  };
  
  if (body && method !== 'GET' && method !== 'HEAD') {
    init.body = JSON.stringify(body);
  }
  
  const response = await app.request(path, init);
  
  // Parse response
  let responseBody;
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    responseBody = await response.json();
  } else {
    responseBody = await response.text();
  }
  
  return {
    status: response.status,
    body: responseBody,
    headers: response.headers,
  };
}

// Test helpers
export async function createTestUser(email: string = 'test@example.com', password: string = 'testpassword123') {
  const bcrypt = await import('bcrypt');
  const { createUser } = await import('../src/db/users.js');
  
  const passwordHash = await bcrypt.hash(password, 12);
  return createUser({
    email,
    passwordHash,
    tier: 'hobby',
    role: 'user',
  });
}

export async function createTestApiKey(userId: string, name: string = 'Test Key') {
  const { hashApiKey, generateApiKey } = await import('../src/services/apiKey.js');
  const { createApiKeyRecord } = await import('../src/db/keys.js');
  
  const { fullKey, prefix } = generateApiKey(false);
  const keyHash = hashApiKey(fullKey);
  
  const apiKey = await createApiKeyRecord({
    userId,
    keyHash,
    prefix,
    name,
  });
  
  return { apiKey, fullKey };
}

export async function getAuthToken(userId: string, email: string) {
  const { generateToken } = await import('../src/services/user.js');
  return generateToken({ id: userId, email }).token;
}

export function resetStores() {
  resetAllStores();
}

export { vi };