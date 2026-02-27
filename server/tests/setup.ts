/**
 * Test Setup for Agent Talk API
 * 
 * This file is run before each test file and sets up:
 * - In-memory SQLite database for isolated tests
 * - Mock implementations where needed
 * - Test utilities and helpers
 */

import { beforeAll, beforeEach, afterAll, afterEach, vi } from 'vitest';
import Database from 'better-sqlite3';
import { join } from 'path';
import { tmpdir } from 'os';
import { mkdirSync, rmSync, existsSync } from 'fs';

// Store original env
const originalEnv = { ...process.env };

// Test database path (in-memory for speed)
let testDbPath: string;
let testDb: Database.Database | null = null;

// Mock the getDb function to use test database
vi.mock('../src/db/index.js', () => {
  const Database = require('better-sqlite3');
  
  let testDb: Database.Database | null = null;
  
  const getTestDb = () => {
    if (!testDb) {
      testDb = new Database(':memory:');
      testDb.pragma('journal_mode = WAL');
      testDb.pragma('foreign_keys = ON');
      
      // Create tables
      testDb.exec(`
        CREATE TABLE IF NOT EXISTS users (
          id TEXT PRIMARY KEY,
          email TEXT UNIQUE NOT NULL,
          password_hash TEXT NOT NULL,
          tier TEXT DEFAULT 'hobby' CHECK(tier IN ('hobby', 'pro', 'enterprise')),
          role TEXT DEFAULT 'user' CHECK(role IN ('user', 'admin')),
          created_at TEXT DEFAULT (datetime('now')),
          updated_at TEXT DEFAULT (datetime('now'))
        )
      `);
      
      testDb.exec(`
        CREATE TABLE IF NOT EXISTS api_keys (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          key_hash TEXT NOT NULL,
          prefix TEXT NOT NULL,
          name TEXT,
          usage_count INTEGER DEFAULT 0,
          last_used_at TEXT,
          is_active INTEGER DEFAULT 1,
          created_at TEXT DEFAULT (datetime('now'))
        )
      `);
      
      testDb.exec(`
        CREATE TABLE IF NOT EXISTS memos (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          api_key_id TEXT REFERENCES api_keys(id) ON DELETE SET NULL,
          text TEXT NOT NULL,
          voice TEXT NOT NULL,
          audio_url TEXT NOT NULL,
          duration_seconds REAL,
          character_count INTEGER,
          created_at TEXT DEFAULT (datetime('now'))
        )
      `);
      
      testDb.exec(`
        CREATE TABLE IF NOT EXISTS usage_logs (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          api_key_id TEXT REFERENCES api_keys(id) ON DELETE SET NULL,
          action TEXT NOT NULL,
          metadata TEXT,
          created_at TEXT DEFAULT (datetime('now'))
        )
      `);
      
      testDb.exec(`
        CREATE TABLE IF NOT EXISTS migrations (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL UNIQUE,
          applied_at TEXT DEFAULT (datetime('now'))
        )
      `);
      
      // Create indexes
      testDb.exec(`CREATE INDEX IF NOT EXISTS idx_api_keys_user_id ON api_keys(user_id)`);
      testDb.exec(`CREATE INDEX IF NOT EXISTS idx_api_keys_key_hash ON api_keys(key_hash)`);
      testDb.exec(`CREATE INDEX IF NOT EXISTS idx_memos_user_id ON memos(user_id)`);
      testDb.exec(`CREATE INDEX IF NOT EXISTS idx_memos_api_key_id ON memos(api_key_id)`);
      testDb.exec(`CREATE INDEX IF NOT EXISTS idx_usage_logs_user_id ON usage_logs(user_id)`);
      testDb.exec(`CREATE INDEX IF NOT EXISTS idx_usage_logs_created_at ON usage_logs(created_at)`);
      
      // Create rate limits table
      testDb.exec(`
        CREATE TABLE IF NOT EXISTS rate_limits (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          api_key_id TEXT NOT NULL,
          user_id TEXT NOT NULL,
          date TEXT NOT NULL,
          count INTEGER DEFAULT 0,
          created_at TEXT DEFAULT (datetime('now')),
          updated_at TEXT DEFAULT (datetime('now')),
          UNIQUE(api_key_id, date)
        )
      `);
      testDb.exec(`CREATE INDEX IF NOT EXISTS idx_rate_limits_api_key_date ON rate_limits(api_key_id, date)`);
      testDb.exec(`CREATE INDEX IF NOT EXISTS idx_rate_limits_user_date ON rate_limits(user_id, date)`);
    }
    return testDb;
  };
  
  return {
    getDb: getTestDb,
    closeDb: () => {
      if (testDb) {
        testDb.close();
        testDb = null;
      }
    },
    runMigrations: () => {
      // Tables already created in getTestDb
    },
    checkHealth: () => ({ status: 'ok', path: ':memory:', tables: 5 }),
  };
});

// Mock storage service
vi.mock('../src/services/storage.js', () => ({
  initStorage: () => ({
    upload: vi.fn().mockImplementation(async (data: ArrayBuffer, format: string) => ({
      id: 'audio_test123',
      url: 'http://localhost:3001/audio/audio_test123.mp3',
      key: 'audio_test123.mp3',
      size: data.byteLength || 100,
      format,
    })),
    get: vi.fn(),
    delete: vi.fn(),
    getUrl: vi.fn().mockReturnValue('http://localhost:3001/audio/test.mp3'),
  }),
  getStorage: () => ({
    upload: vi.fn().mockImplementation(async (data: ArrayBuffer, format: string) => ({
      id: 'audio_test123',
      url: 'http://localhost:3001/audio/audio_test123.mp3',
      key: 'audio_test123.mp3',
      size: data.byteLength || 100,
      format,
    })),
    get: vi.fn(),
    delete: vi.fn(),
    getUrl: vi.fn().mockReturnValue('http://localhost:3001/audio/test.mp3'),
  }),
}));

// Set test environment variables
process.env.JWT_SECRET = 'test-secret-key-for-testing-only';
process.env.NODE_ENV = 'test';
process.env.DATABASE_PATH = ':memory:';
process.env.TTS_MODE = 'simulation';

// Global test utilities
beforeAll(async () => {
  // Any global setup needed
});

afterAll(async () => {
  // Cleanup
  process.env = originalEnv;
});

beforeEach(async () => {
  // Reset database state before each test
  const { getDb } = await import('../src/db/index.js');
  const db = getDb();
  
  // Clear tables
  db.exec('DELETE FROM rate_limits');
  db.exec('DELETE FROM usage_logs');
  db.exec('DELETE FROM memos');
  db.exec('DELETE FROM api_keys');
  db.exec('DELETE FROM users');
});

afterEach(async () => {
  // Cleanup after each test
});

// Test helpers
export async function createTestUser(email: string = 'test@example.com', password: string = 'testpassword123') {
  const { createUser } = await import('../src/db/users.js');
  const bcrypt = await import('bcrypt');
  
  const passwordHash = await bcrypt.hash(password, 12);
  const user = await createUser({
    email,
    passwordHash,
    tier: 'hobby',
    role: 'user',
  });
  
  return user;
}

export async function createTestApiKey(userId: string, name: string = 'Test Key') {
  const { createApiKey } = await import('../src/db/keys.js');
  const { hashApiKey, generateApiKey } = await import('../src/services/apiKey.js');
  
  const { fullKey, prefix } = generateApiKey(false);
  const keyHash = hashApiKey(fullKey);
  
  const apiKey = createApiKey({
    userId,
    keyHash,
    prefix,
    name,
  });
  
  return { apiKey, fullKey };
}

export async function getAuthToken(userId: string, email: string) {
  const { generateToken } = await import('../src/services/user.js');
  return generateToken({ id: userId, email });
}

// Export for convenience
export { vi };
