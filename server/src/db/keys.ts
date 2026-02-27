/**
 * API Keys Database - HYPR Micro Implementation
 * 
 * Manages API key records in HYPR Micro with in-memory fallback.
 * 
 * @see HYPR-REFACTOR-PLAN.md Phase 3
 */

import { getMicroClient } from '../lib/hypr-micro.js';
import { isHyprMode, DB_NAMES } from './index.js';
import { logger } from '../utils/logger.js';

export interface ApiKey {
  id: string;
  user_id: string;
  key_hash: string;
  prefix: string;
  name: string;
  is_active: boolean;
  usage_count: number;
  created_at: string;
  last_used_at: string | null;
  [key: string]: unknown; // Index signature for HYPR Micro compatibility
}

// In-memory fallback storage
const memoryKeys = new Map<string, ApiKey>();
const hashIndex = new Map<string, string>(); // key_hash -> id

/**
 * Create a new API key record
 */
export async function createApiKeyRecord(data: {
  userId: string;
  keyHash: string;
  prefix: string;
  name: string;
}): Promise<ApiKey> {
  const id = generateId();
  const now = new Date().toISOString();
  
  const apiKey: ApiKey = {
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

  if (isHyprMode()) {
    try {
      await getMicroClient().insert(DB_NAMES.API_KEYS, apiKey);
      logger.debug('API key created in HYPR Micro', { id, prefix: apiKey.prefix });
    } catch (error: unknown) {
      logger.error('Failed to create API key in HYPR Micro', { error: { name: 'HyprMicroError', message: error instanceof Error ? error.message : String(error) } });
      throw error;
    }
  } else {
    memoryKeys.set(id, apiKey);
    hashIndex.set(data.keyHash, id);
    logger.debug('API key created in memory', { id, prefix: apiKey.prefix });
  }

  return apiKey;
}

/**
 * Get API key by key hash
 */
export async function getApiKeyByKey(keyHash: string): Promise<ApiKey | null> {
  if (isHyprMode()) {
    try {
      const keys = await getMicroClient().query<ApiKey>(DB_NAMES.API_KEYS, { key_hash: keyHash });
      return keys[0] || null;
    } catch (error: unknown) {
      logger.error('Failed to get API key from HYPR Micro', { error: { name: 'HyprMicroError', message: error instanceof Error ? error.message : String(error) } });
      return null;
    }
  }
  
  const id = hashIndex.get(keyHash);
  if (!id) return null;
  return memoryKeys.get(id) || null;
}

// Alias for compatibility
export const findApiKeyByHash = getApiKeyByKey;

/**
 * Get API keys by user ID
 */
export async function getApiKeysByUserId(userId: string): Promise<ApiKey[]> {
  if (isHyprMode()) {
    try {
      const keys = await getMicroClient().query<ApiKey>(DB_NAMES.API_KEYS, { user_id: userId });
      return keys.sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    } catch (error: unknown) {
      logger.error('Failed to get API keys from HYPR Micro', { userId, error: { name: 'HyprMicroError', message: error instanceof Error ? error.message : String(error) } });
      return [];
    }
  }
  
  return Array.from(memoryKeys.values())
    .filter(k => k.user_id === userId)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

// Alias for compatibility
export const listApiKeysByUser = getApiKeysByUserId;

/**
 * Revoke (deactivate) an API key
 */
export async function revokeApiKey(id: string): Promise<boolean> {
  if (isHyprMode()) {
    try {
      const result = await getMicroClient().update(DB_NAMES.API_KEYS, id, { is_active: false });
      return result !== null;
    } catch (error: unknown) {
      logger.error('Failed to revoke API key in HYPR Micro', { id, error: { name: 'HyprMicroError', message: error instanceof Error ? error.message : String(error) } });
      return false;
    }
  }
  
  const key = memoryKeys.get(id);
  if (!key) return false;
  
  key.is_active = false;
  memoryKeys.set(id, key);
  
  return true;
}

/**
 * Increment key usage count
 */
export async function incrementKeyUsage(id: string): Promise<void> {
  if (isHyprMode()) {
    try {
      const key = await getMicroClient().get<ApiKey>(DB_NAMES.API_KEYS, id);
      if (key) {
        await getMicroClient().update(DB_NAMES.API_KEYS, id, {
          usage_count: (key.usage_count || 0) + 1,
          last_used_at: new Date().toISOString(),
        });
      }
    } catch (error: unknown) {
      logger.error('Failed to increment key usage in HYPR Micro', { id, error: { name: 'HyprMicroError', message: error instanceof Error ? error.message : String(error) } });
    }
    return;
  }
  
  const key = memoryKeys.get(id);
  if (key) {
    key.usage_count = (key.usage_count || 0) + 1;
    key.last_used_at = new Date().toISOString();
    memoryKeys.set(id, key);
  }
}

/**
 * Get all API keys (admin only)
 */
export async function getAllApiKeys(): Promise<ApiKey[]> {
  if (isHyprMode()) {
    try {
      const { docs } = await getMicroClient().list<ApiKey>(DB_NAMES.API_KEYS);
      return docs;
    } catch (error: unknown) {
      logger.error('Failed to get all API keys from HYPR Micro', { error: { name: 'HyprMicroError', message: error instanceof Error ? error.message : String(error) } });
      return [];
    }
  }
  
  return Array.from(memoryKeys.values());
}

/**
 * Delete an API key permanently
 */
export async function deleteApiKey(id: string): Promise<boolean> {
  if (isHyprMode()) {
    try {
      return await getMicroClient().delete(DB_NAMES.API_KEYS, id);
    } catch (error: unknown) {
      logger.error('Failed to delete API key from HYPR Micro', { id, error: { name: 'HyprMicroError', message: error instanceof Error ? error.message : String(error) } });
      return false;
    }
  }
  
  const key = memoryKeys.get(id);
  if (key) {
    hashIndex.delete(key.key_hash);
  }
  return memoryKeys.delete(id);
}

/**
 * Update an API key (e.g., change name)
 */
export async function updateApiKey(id: string, updates: { name?: string }): Promise<ApiKey | null> {
  if (isHyprMode()) {
    try {
      const result = await getMicroClient().update<ApiKey>(DB_NAMES.API_KEYS, id, updates);
      return result;
    } catch (error: unknown) {
      logger.error('Failed to update API key in HYPR Micro', { id, error: { name: 'HyprMicroError', message: error instanceof Error ? error.message : String(error) } });
      return null;
    }
  }
  
  const key = memoryKeys.get(id);
  if (!key) return null;
  
  if (updates.name !== undefined) {
    key.name = updates.name;
  }
  
  memoryKeys.set(id, key);
  return key;
}

/**
 * Count API keys for a user
 */
export async function countApiKeysByUser(userId: string): Promise<number> {
  if (isHyprMode()) {
    try {
      const keys = await getMicroClient().query<ApiKey>(DB_NAMES.API_KEYS, { user_id: userId });
      return keys.length;
    } catch (error: unknown) {
      logger.error('Failed to count API keys in HYPR Micro', { userId, error: { name: 'HyprMicroError', message: error instanceof Error ? error.message : String(error) } });
      return 0;
    }
  }
  
  return Array.from(memoryKeys.values()).filter(k => k.user_id === userId).length;
}

/**
 * Get API key by ID (async version)
 */
export async function findApiKeyByIdAsync(id: string): Promise<ApiKey | null> {
  if (isHyprMode()) {
    try {
      return await getMicroClient().get<ApiKey>(DB_NAMES.API_KEYS, id);
    } catch (error: unknown) {
      logger.error('Failed to get API key by ID from HYPR Micro', { id, error: { name: 'HyprMicroError', message: error instanceof Error ? error.message : String(error) } });
      return null;
    }
  }
  
  return memoryKeys.get(id) || null;
}

// Type alias for create input
export type CreateApiKeyInput = {
  userId: string;
  keyHash: string;
  prefix: string;
  name: string;
};

/**
 * Generate unique ID
 */
function generateId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 9);
  return `key_${timestamp}_${random}`;
}

// Legacy sync function for backward compatibility
export function findApiKeyById(id: string): ApiKey | null {
  // Sync wrapper - returns null in HYPR mode since we can't do async
  if (isHyprMode()) {
    return null;
  }
  return memoryKeys.get(id) || null;
}

/**
 * Reset in-memory storage (for testing only)
 */
export function _resetKeys(): void {
  if (!isHyprMode()) {
    memoryKeys.clear();
    hashIndex.clear();
  }
}