/**
 * API Key Service - Key generation, validation, and management
 */

import { randomBytes, createHash } from 'crypto';
import {
  createApiKey,
  findApiKeyByHash,
  findApiKeyById,
  listApiKeysByUser,
  revokeApiKey as revokeApiKeyDb,
  deleteApiKey as deleteApiKeyDb,
  incrementKeyUsage,
  countApiKeysByUser,
  CreateApiKeyInput,
} from '../db/keys.js';
import { InvalidApiKeyError, RevokedKeyError, ForbiddenError, NotFoundError } from '../errors/index.js';

// Configuration
const KEY_LENGTH = 32; // Bytes for random portion
const PREFIX_LIVE = 'at_live_';
const PREFIX_TEST = 'at_test_';
const MAX_KEYS_PER_USER = 10;

export interface CreateKeyResult {
  id: string;
  key: string; // Full key - only shown once!
  prefix: string;
  name: string | null;
  createdAt: string;
}

export interface MaskedKey {
  id: string;
  prefix: string;
  maskedKey: string; // e.g., "at_live_***...abc123"
  name: string | null;
  usageCount: number;
  lastUsedAt: string | null;
  isActive: boolean;
  createdAt: string;
}

export interface ApiKeyValidation {
  isValid: boolean;
  keyId?: string;
  userId?: string;
  error?: string;
}

/**
 * Generate a secure random API key
 * Format: at_live_xxxxx or at_test_xxxxx
 */
export function generateApiKey(isTestKey: boolean = false): { fullKey: string; prefix: string } {
  const prefix = isTestKey ? PREFIX_TEST : PREFIX_LIVE;
  const randomBytes_buffer = randomBytes(KEY_LENGTH);
  const randomPart = randomBytes_buffer.toString('base64url').slice(0, 43); // 43 chars from 32 bytes
  
  return {
    fullKey: prefix + randomPart,
    prefix,
  };
}

/**
 * Hash an API key for storage
 * Uses SHA-256 for secure one-way hashing
 */
export function hashApiKey(key: string): string {
  return createHash('sha256').update(key).digest('hex');
}

/**
 * Get the prefix from an API key
 * Returns null if the key doesn't match expected format
 */
export function getKeyPrefix(key: string): string | null {
  if (key.startsWith(PREFIX_LIVE)) return PREFIX_LIVE;
  if (key.startsWith(PREFIX_TEST)) return PREFIX_TEST;
  return null;
}

/**
 * Mask an API key for display
 * Shows prefix, asterisks, and last 6 characters
 * e.g., "at_live_***...abc123"
 */
export function maskApiKey(key: string): string {
  const prefix = getKeyPrefix(key);
  if (!prefix) {
    // For already-masked or invalid keys, just show hash portion
    if (key.length > 10) {
      return key.slice(0, 8) + '***...' + key.slice(-6);
    }
    return '***';
  }
  
  const suffix = key.slice(-6);
  return prefix + '***...' + suffix;
}

/**
 * Create a new API key for a user
 */
export function createNewApiKey(
  userId: string,
  name?: string,
  isTestKey: boolean = false
): CreateKeyResult {
  // Check key limit
  const currentCount = countApiKeysByUser(userId);
  if (currentCount >= MAX_KEYS_PER_USER) {
    throw new Error(`Maximum number of API keys (${MAX_KEYS_PER_USER}) reached`);
  }
  
  // Generate key
  const { fullKey, prefix } = generateApiKey(isTestKey);
  const keyHash = hashApiKey(fullKey);
  
  // Store in database
  const input: CreateApiKeyInput = {
    userId,
    keyHash,
    prefix,
    name,
  };
  
  const apiKey = createApiKey(input);
  
  return {
    id: apiKey.id,
    key: fullKey, // Only time the full key is returned!
    prefix: apiKey.prefix,
    name: apiKey.name,
    createdAt: apiKey.created_at,
  };
}

/**
 * Validate an API key
 * Returns key info if valid, throws appropriate error if not
 */
export function validateApiKey(key: string): { keyId: string; userId: string } {
  // Check key format
  const prefix = getKeyPrefix(key);
  if (!prefix) {
    throw new InvalidApiKeyError();
  }
  
  // Hash and look up
  const keyHash = hashApiKey(key);
  const apiKey = findApiKeyByHash(keyHash);
  
  if (!apiKey) {
    throw new InvalidApiKeyError();
  }
  
  if (!apiKey.is_active) {
    throw new RevokedKeyError();
  }
  
  return {
    keyId: apiKey.id,
    userId: apiKey.user_id,
  };
}

/**
 * Validate API key without throwing
 * Returns validation result for use in middleware
 */
export function validateApiKeySafe(key: string): ApiKeyValidation {
  try {
    const prefix = getKeyPrefix(key);
    if (!prefix) {
      return { isValid: false, error: 'Invalid key format' };
    }
    
    const keyHash = hashApiKey(key);
    const apiKey = findApiKeyByHash(keyHash);
    
    if (!apiKey) {
      return { isValid: false, error: 'Invalid API key' };
    }
    
    if (!apiKey.is_active) {
      return { isValid: false, error: 'API key has been revoked' };
    }
    
    return {
      isValid: true,
      keyId: apiKey.id,
      userId: apiKey.user_id,
    };
  } catch (error) {
    return { isValid: false, error: 'Validation failed' };
  }
}

/**
 * Record usage of an API key
 */
export function recordKeyUsage(keyId: string): void {
  incrementKeyUsage(keyId);
}

/**
 * List API keys for a user (masked)
 */
export function listUserApiKeys(userId: string): MaskedKey[] {
  const keys = listApiKeysByUser(userId);
  
  return keys.map(key => ({
    id: key.id,
    prefix: key.prefix,
    // Create masked key from stored prefix and simulated suffix
    maskedKey: key.prefix + '***...',
    name: key.name,
    usageCount: key.usage_count,
    lastUsedAt: key.last_used_at,
    isActive: Boolean(key.is_active),
    createdAt: key.created_at,
  }));
}

/**
 * Revoke an API key
 */
export function revokeUserApiKey(keyId: string, userId: string): boolean {
  const success = revokeApiKeyDb(keyId, userId);
  
  if (!success) {
    throw new NotFoundError('API key');
  }
  
  return true;
}

/**
 * Delete an API key permanently
 */
export function deleteUserApiKey(keyId: string, userId: string): boolean {
  const success = deleteApiKeyDb(keyId, userId);
  
  if (!success) {
    throw new NotFoundError('API key');
  }
  
  return true;
}

/**
 * Get a single API key by ID (masked)
 */
export function getApiKeyById(keyId: string, userId: string): MaskedKey | null {
  const key = findApiKeyById(keyId);
  
  if (!key || key.user_id !== userId) {
    return null;
  }
  
  return {
    id: key.id,
    prefix: key.prefix,
    maskedKey: key.prefix + '***...',
    name: key.name,
    usageCount: key.usage_count,
    lastUsedAt: key.last_used_at,
    isActive: Boolean(key.is_active),
    createdAt: key.created_at,
  };
}

/**
 * Extract API key from Authorization header
 * Supports both "Bearer <key>" and just "<key>"
 */
export function extractApiKey(authHeader: string | undefined): string | null {
  if (!authHeader) return null;
  
  // Handle "Bearer <key>" format
  if (authHeader.toLowerCase().startsWith('bearer ')) {
    const key = authHeader.slice(7).trim();
    // Check if it looks like an API key (starts with at_live_ or at_test_)
    if (key.startsWith('at_live_') || key.startsWith('at_test_')) {
      return key;
    }
    // Might be a JWT token, not an API key
    return null;
  }
  
  // Handle just the key (no Bearer prefix)
  const trimmed = authHeader.trim();
  if (trimmed.startsWith('at_live_') || trimmed.startsWith('at_test_')) {
    return trimmed;
  }
  
  return null;
}

/**
 * Check if a string looks like an API key
 */
export function isApiKeyFormat(value: string): boolean {
  return value.startsWith('at_live_') || value.startsWith('at_test_');
}
