/**
 * API Keys Database Stub
 * 
 * Hybrid implementation that uses HYPR Micro when available,
 * with in-memory fallback for development.
 * 
 * @see task-162-phase3-hypr-micro.md
 */

import { v4 as uuidv4 } from 'uuid';
import { isHyprMode, ApiKeys, ApiKey as MicroApiKey } from '../lib/micro-tables.js';

export interface ApiKey {
  id: string;
  user_id: string;
  prefix: string;
  key_hash: string;
  name: string;
  usage_count: number;
  last_used_at: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  [key: string]: unknown;
}

export interface CreateApiKeyData {
  userId: string;
  keyHash: string;
  prefix: string;
  name?: string;
}

export interface UpdateApiKeyData {
  name?: string;
  is_active?: boolean;
  [key: string]: unknown;
}

// In-memory storage for development (fallback)
const keyStore = new Map<string, ApiKey>();
const keyHashIndex = new Map<string, string>();
const userKeysIndex = new Map<string, Set<string>>();

/**
 * Convert between formats (both use snake_case, so it's direct)
 */
function toLegacyApiKey(key: MicroApiKey): ApiKey {
  return key;
}

function toMicroApiKey(key: ApiKey): MicroApiKey {
  return key;
}

/**
 * Create a new API key
 */
export async function createApiKeyRecord(data: CreateApiKeyData): Promise<ApiKey> {
  const id = uuidv4();
  const now = new Date().toISOString();
  
  const key: ApiKey = {
    id,
    user_id: data.userId,
    prefix: data.prefix,
    key_hash: data.keyHash,
    name: data.name || 'Default Key',
    usage_count: 0,
    last_used_at: null,
    is_active: true,
    created_at: now,
    updated_at: now,
  };
  
  // Use HYPR Micro in production
  if (isHyprMode()) {
    const microKey = await ApiKeys.create(toMicroApiKey(key));
    return toLegacyApiKey(microKey);
  }
  
  // In-memory fallback
  keyStore.set(id, key);
  keyHashIndex.set(data.keyHash, id);
  
  // Update user's key set
  if (!userKeysIndex.has(data.userId)) {
    userKeysIndex.set(data.userId, new Set());
  }
  userKeysIndex.get(data.userId)!.add(id);
  
  return key;
}

/**
 * Get API key by key hash
 */
export async function getApiKeyByKey(keyHash: string): Promise<ApiKey | null> {
  // Use HYPR Micro in production
  if (isHyprMode()) {
    const key = await ApiKeys.findByKeyHash(keyHash);
    return key ? toLegacyApiKey(key) : null;
  }
  
  // In-memory fallback
  const id = keyHashIndex.get(keyHash);
  if (!id) return null;
  return keyStore.get(id) || null;
}

/**
 * Find API key by ID
 */
export async function findApiKeyByIdAsync(id: string): Promise<ApiKey | null> {
  // Use HYPR Micro in production
  if (isHyprMode()) {
    const key = await ApiKeys.findById(id);
    return key ? toLegacyApiKey(key) : null;
  }
  
  // In-memory fallback
  return keyStore.get(id) || null;
}

/**
 * Get all API keys for a user
 */
export async function getApiKeysByUserId(userId: string): Promise<ApiKey[]> {
  // Use HYPR Micro in production
  if (isHyprMode()) {
    const keys = await ApiKeys.findByUserId(userId);
    return keys.map(toLegacyApiKey);
  }
  
  // In-memory fallback
  const keyIds = userKeysIndex.get(userId);
  if (!keyIds) return [];
  
  return Array.from(keyIds)
    .map(id => keyStore.get(id))
    .filter((k): k is ApiKey => k !== undefined);
}

/**
 * List API keys for a user (with pagination)
 */
export async function listApiKeysByUser(userId: string, limit: number = 100, offset: number = 0): Promise<ApiKey[]> {
  // HYPR Micro supports query-based filtering, but we do client-side pagination
  if (isHyprMode()) {
    const allKeys = await ApiKeys.findByUserId(userId);
    // Sort by created_at descending
    return allKeys
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(offset, offset + limit)
      .map(toLegacyApiKey);
  }
  
  // In-memory fallback
  const keys = await getApiKeysByUserId(userId);
  return keys.slice(offset, offset + limit);
}

/**
 * Count API keys for a user
 */
export async function countApiKeysByUser(userId: string): Promise<number> {
  // Use HYPR Micro in production
  if (isHyprMode()) {
    return ApiKeys.countByUser(userId);
  }
  
  // In-memory fallback
  const keyIds = userKeysIndex.get(userId);
  return keyIds ? keyIds.size : 0;
}

/**
 * Revoke an API key (soft delete)
 */
export async function revokeApiKey(id: string): Promise<boolean> {
  // Use HYPR Micro in production
  if (isHyprMode()) {
    const updated = await ApiKeys.update(id, { is_active: false });
    return updated !== null;
  }
  
  // In-memory fallback
  const key = keyStore.get(id);
  if (!key) return false;
  
  key.is_active = false;
  key.updated_at = new Date().toISOString();
  return true;
}

/**
 * Delete an API key permanently
 */
export async function deleteApiKey(id: string): Promise<boolean> {
  // Use HYPR Micro in production
  if (isHyprMode()) {
    return ApiKeys.delete(id);
  }
  
  // In-memory fallback
  const key = keyStore.get(id);
  if (!key) return false;
  
  keyStore.delete(id);
  keyHashIndex.delete(key.key_hash);
  
  // Remove from user's key set
  const userKeys = userKeysIndex.get(key.user_id);
  if (userKeys) {
    userKeys.delete(id);
  }
  
  return true;
}

/**
 * Update an API key
 */
export async function updateApiKey(id: string, data: UpdateApiKeyData): Promise<ApiKey | null> {
  // Use HYPR Micro in production
  if (isHyprMode()) {
    const key = await ApiKeys.update(id, data);
    return key ? toLegacyApiKey(key) : null;
  }
  
  // In-memory fallback
  const key = keyStore.get(id);
  if (!key) return null;
  
  const updated: ApiKey = {
    ...key,
    ...data,
    id,
    updated_at: new Date().toISOString(),
  };
  
  keyStore.set(id, updated);
  return updated;
}

/**
 * Increment key usage count
 */
export async function incrementKeyUsage(id: string): Promise<void> {
  // Use HYPR Micro in production
  if (isHyprMode()) {
    const key = await ApiKeys.findById(id);
    if (key) {
      await ApiKeys.update(id, {
        usage_count: key.usage_count + 1,
        last_used_at: new Date().toISOString(),
      });
    }
    return;
  }
  
  // In-memory fallback
  const key = keyStore.get(id);
  if (key) {
    key.usage_count += 1;
    key.last_used_at = new Date().toISOString();
  }
}

/**
 * Clear all keys (for testing)
 */
export function clearKeys(): void {
  keyStore.clear();
  keyHashIndex.clear();
  userKeysIndex.clear();
}