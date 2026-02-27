/**
 * API Key Database Operations
 * SQLite implementation for API key management
 */

import { getDb } from './index.js';
import { ApiKey } from './schema.js';
import { v4 as uuidv4 } from 'uuid';

export interface CreateApiKeyInput {
  userId: string;
  keyHash: string;
  prefix: string;
  name?: string;
}

export interface ApiKeyWithUsage extends ApiKey {
  last_used_at: string | null;
  usage_count: number;
}

/**
 * Create a new API key
 */
export function createApiKey(input: CreateApiKeyInput): ApiKey {
  const db = getDb();
  
  const now = new Date().toISOString();
  const id = uuidv4();
  
  const stmt = db.prepare(`
    INSERT INTO api_keys (id, user_id, key_hash, prefix, name, usage_count, is_active, created_at)
    VALUES (?, ?, ?, ?, ?, 0, 1, ?)
  `);
  
  stmt.run(
    id,
    input.userId,
    input.keyHash,
    input.prefix,
    input.name || null,
    now
  );
  
  return {
    id,
    user_id: input.userId,
    key_hash: input.keyHash,
    prefix: input.prefix,
    name: input.name || null,
    usage_count: 0,
    last_used_at: null,
    is_active: true,
    created_at: now,
  };
}

/**
 * Find API key by ID
 */
export function findApiKeyById(id: string): ApiKey | null {
  const db = getDb();
  
  const stmt = db.prepare(`
    SELECT id, user_id, key_hash, prefix, name, usage_count, last_used_at, is_active, created_at
    FROM api_keys
    WHERE id = ?
  `);
  
  const row = stmt.get(id) as ApiKey | undefined;
  return row || null;
}

/**
 * Find API key by key hash
 */
export function findApiKeyByHash(keyHash: string): ApiKey | null {
  const db = getDb();
  
  const stmt = db.prepare(`
    SELECT id, user_id, key_hash, prefix, name, usage_count, last_used_at, is_active, created_at
    FROM api_keys
    WHERE key_hash = ?
  `);
  
  const row = stmt.get(keyHash) as ApiKey | undefined;
  return row || null;
}

/**
 * List API keys for a user
 * Returns keys without the full hash (masked)
 */
export function listApiKeysByUser(userId: string): ApiKey[] {
  const db = getDb();
  
  const stmt = db.prepare(`
    SELECT id, user_id, key_hash, prefix, name, usage_count, last_used_at, is_active, created_at
    FROM api_keys
    WHERE user_id = ?
    ORDER BY created_at DESC
  `);
  
  return stmt.all(userId) as ApiKey[];
}

/**
 * Update API key
 */
export function updateApiKey(id: string, updates: { name?: string; is_active?: boolean }): ApiKey | null {
  const db = getDb();
  
  const key = findApiKeyById(id);
  if (!key) return null;
  
  const fields: string[] = [];
  const values: (string | number)[] = [];
  
  if (updates.name !== undefined) {
    fields.push('name = ?');
    values.push(updates.name);
  }
  if (updates.is_active !== undefined) {
    fields.push('is_active = ?');
    values.push(updates.is_active ? 1 : 0);
  }
  
  if (fields.length === 0) return key;
  
  values.push(id);
  
  const stmt = db.prepare<unknown[], { changes: number }>(`
    UPDATE api_keys
    SET ${fields.join(', ')}
    WHERE id = ?
  `);
  
  stmt.run(...values);
  
  return findApiKeyById(id);
}

/**
 * Revoke (deactivate) an API key
 */
export function revokeApiKey(id: string, userId: string): boolean {
  const db = getDb();
  
  const stmt = db.prepare(`
    UPDATE api_keys
    SET is_active = 0
    WHERE id = ? AND user_id = ?
  `);
  
  const result = stmt.run(id, userId);
  return result.changes > 0;
}

/**
 * Delete an API key permanently
 */
export function deleteApiKey(id: string, userId: string): boolean {
  const db = getDb();
  
  const stmt = db.prepare(`
    DELETE FROM api_keys
    WHERE id = ? AND user_id = ?
  `);
  
  const result = stmt.run(id, userId);
  return result.changes > 0;
}

/**
 * Increment usage count for an API key
 * Also updates last_used_at
 */
export function incrementKeyUsage(keyId: string): void {
  const db = getDb();
  
  const now = new Date().toISOString();
  
  const stmt = db.prepare(`
    UPDATE api_keys
    SET usage_count = usage_count + 1, last_used_at = ?
    WHERE id = ?
  `);
  
  stmt.run(now, keyId);
}

/**
 * Get usage stats for a user's API keys
 */
export function getApiKeyUsageStats(userId: string): {
  totalKeys: number;
  activeKeys: number;
  totalUsage: number;
} {
  const db = getDb();
  
  const stmt = db.prepare(`
    SELECT 
      COUNT(*) as totalKeys,
      SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) as activeKeys,
      COALESCE(SUM(usage_count), 0) as totalUsage
    FROM api_keys
    WHERE user_id = ?
  `);
  
  const result = stmt.get(userId) as { totalKeys: number; activeKeys: number; totalUsage: number };
  
  return {
    totalKeys: result.totalKeys || 0,
    activeKeys: result.activeKeys || 0,
    totalUsage: result.totalUsage || 0,
  };
}

/**
 * Count API keys for a user
 */
export function countApiKeysByUser(userId: string): number {
  const db = getDb();
  
  const stmt = db.prepare(`
    SELECT COUNT(*) as count
    FROM api_keys
    WHERE user_id = ?
  `);
  
  const result = stmt.get(userId) as { count: number };
  return result.count;
}

/**
 * Clear all API keys for a user (for testing)
 */
export function clearApiKeysByUser(userId: string): void {
  const db = getDb();
  
  const stmt = db.prepare('DELETE FROM api_keys WHERE user_id = ?');
  stmt.run(userId);
}

/**
 * Clear all API keys (for testing)
 */
export function clearAllApiKeys(): void {
  const db = getDb();
  
  const stmt = db.prepare('DELETE FROM api_keys');
  stmt.run();
}