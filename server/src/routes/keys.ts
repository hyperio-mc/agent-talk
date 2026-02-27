/**
 * API Key Management Routes
 */

import { Hono } from 'hono';
import { requireAuth, getAuthUser } from '../middleware/auth.js';
import {
  createNewApiKey,
  listUserApiKeys,
  revokeUserApiKey,
  deleteUserApiKey,
  getApiKeyById,
} from '../services/apiKey.js';
import {
  ValidationError,
  MissingFieldError,
  NotFoundError,
  UnauthorizedError,
} from '../errors/index.js';
import { logKeyCreated, logKeyRevoked } from '../services/analytics.js';

export const keysRoutes = new Hono();

/**
 * POST /api/keys
 * Create a new API key
 * Returns the full key - only shown once!
 */
keysRoutes.post('/', requireAuth, async (c) => {
  const authUser = getAuthUser(c);
  
  if (!authUser) {
    throw new UnauthorizedError('Not authenticated');
  }
  
  // Parse request body
  let body: { name?: unknown; test?: unknown } = {};
  try {
    const rawBody = await c.req.json();
    body = rawBody || {};
  } catch {
    // Body is optional, continue with defaults
  }
  
  // Validate name if provided
  let name: string | undefined;
  if (body.name !== undefined) {
    if (typeof body.name !== 'string') {
      throw new ValidationError('Name must be a string', { field: 'name' });
    }
    name = body.name.trim();
    
    if (name.length > 100) {
      throw new ValidationError('Name must be 100 characters or less', { field: 'name', maxLength: 100 });
    }
  }
  
  // Validate test flag if provided
  let isTestKey = false;
  if (body.test !== undefined) {
    if (typeof body.test !== 'boolean') {
      throw new ValidationError('Test must be a boolean', { field: 'test' });
    }
    isTestKey = body.test;
  }
  
  try {
    const result = await createNewApiKey(authUser.userId, name, isTestKey);
    
    // Log key creation event
    logKeyCreated(authUser.userId, name || undefined);
    
    // Return the full key - this is the only time it will be shown!
    return c.json({
      success: true,
      key: {
        id: result.id,
        key: result.key, // Full API key - store securely!
        prefix: result.prefix,
        name: result.name,
        createdAt: result.createdAt,
      },
      warning: 'This is the only time the full API key will be shown. Store it securely!',
    }, 201);
  } catch (error) {
    if (error instanceof Error && error.message.includes('Maximum number')) {
      throw new ValidationError(error.message, { limit: 10 });
    }
    throw error;
  }
});

/**
 * GET /api/keys
 * List all API keys for the authenticated user
 * Keys are masked for security
 */
keysRoutes.get('/', requireAuth, async (c) => {
  const authUser = getAuthUser(c);
  
  if (!authUser) {
    throw new UnauthorizedError('Not authenticated');
  }
  
  const keys = await listUserApiKeys(authUser.userId);
  
  return c.json({
    success: true,
    keys: keys.map(key => ({
      id: key.id,
      prefix: key.prefix,
      maskedKey: key.maskedKey,
      name: key.name,
      usageCount: key.usageCount,
      lastUsedAt: key.lastUsedAt,
      isActive: key.isActive,
      createdAt: key.createdAt,
    })),
  });
});

/**
 * GET /api/keys/:id
 * Get a specific API key by ID
 */
keysRoutes.get('/:id', requireAuth, async (c) => {
  const authUser = getAuthUser(c);
  
  if (!authUser) {
    throw new UnauthorizedError('Not authenticated');
  }
  
  const keyId = c.req.param('id');
  const key = await getApiKeyById(keyId, authUser.userId);
  
  if (!key) {
    throw new NotFoundError('API key');
  }
  
  return c.json({
    success: true,
    key: {
      id: key.id,
      prefix: key.prefix,
      maskedKey: key.maskedKey,
      name: key.name,
      usageCount: key.usageCount,
      lastUsedAt: key.lastUsedAt,
      isActive: key.isActive,
      createdAt: key.createdAt,
    },
  });
});

/**
 * DELETE /api/keys/:id
 * Revoke (soft delete) an API key
 */
keysRoutes.delete('/:id', requireAuth, async (c) => {
  const authUser = getAuthUser(c);
  
  if (!authUser) {
    throw new UnauthorizedError('Not authenticated');
  }
  
  const keyId = c.req.param('id');
  
  await revokeUserApiKey(keyId, authUser.userId);
  
  // Log key revocation event
  logKeyRevoked(authUser.userId, keyId);
  
  return c.json({
    success: true,
    message: 'API key revoked successfully',
  });
});

/**
 * POST /api/keys/:id/revoke
 * Alternative endpoint to revoke an API key
 */
keysRoutes.post('/:id/revoke', requireAuth, async (c) => {
  const authUser = getAuthUser(c);
  
  if (!authUser) {
    throw new UnauthorizedError('Not authenticated');
  }
  
  const keyId = c.req.param('id');
  
  await revokeUserApiKey(keyId, authUser.userId);
  
  // Log key revocation event
  logKeyRevoked(authUser.userId, keyId);
  
  return c.json({
    success: true,
    message: 'API key revoked successfully',
  });
});

/**
 * PATCH /api/keys/:id
 * Update an API key (currently only name)
 */
keysRoutes.patch('/:id', requireAuth, async (c) => {
  const authUser = getAuthUser(c);
  
  if (!authUser) {
    throw new UnauthorizedError('Not authenticated');
  }
  
  const keyId = c.req.param('id');
  
  // Parse request body
  let body: { name?: unknown } = {};
  try {
    const rawBody = await c.req.json();
    body = rawBody || {};
  } catch {
    throw new ValidationError('Invalid JSON body');
  }
  
  // Validate name
  if (body.name === undefined) {
    throw new MissingFieldError('name');
  }
  
  if (typeof body.name !== 'string') {
    throw new ValidationError('Name must be a string', { field: 'name' });
  }
  
  const name = body.name.trim();
  
  if (name.length > 100) {
    throw new ValidationError('Name must be 100 characters or less', { field: 'name', maxLength: 100 });
  }
  
  // Import update function
  const { updateApiKey } = await import('../db/keys.js');
  const updated = await updateApiKey(keyId, { name });
  
  if (!updated || updated.user_id !== authUser.userId) {
    throw new NotFoundError('API key');
  }
  
  return c.json({
    success: true,
    key: {
      id: updated.id,
      prefix: updated.prefix,
      maskedKey: updated.prefix + '***...',
      name: updated.name,
      usageCount: updated.usage_count,
      lastUsedAt: updated.last_used_at,
      isActive: Boolean(updated.is_active),
      createdAt: updated.created_at,
    },
  });
});
