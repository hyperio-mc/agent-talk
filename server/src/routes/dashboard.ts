/**
 * Dashboard Routes
 * User dashboard API endpoints for managing API keys and viewing usage
 */

import { Hono } from 'hono';
import { requireAuth, getAuthUser } from '../middleware/auth.js';
import { getDb } from '../db/index.js';
import {
  createNewApiKey,
  listUserApiKeys,
  revokeUserApiKey,
} from '../services/apiKey.js';
import {
  ValidationError,
  UnauthorizedError,
} from '../errors/index.js';

export const dashboardRoutes = new Hono();

/**
 * GET /api/v1/dashboard/stats
 * Get usage stats for the authenticated user
 */
dashboardRoutes.get('/stats', requireAuth, async (c) => {
  const authUser = getAuthUser(c);
  
  if (!authUser) {
    throw new UnauthorizedError('Not authenticated');
  }
  
  const db = getDb();
  
  // Get usage stats
  const todayUsage = db.prepare(`
    SELECT COUNT(*) as count 
    FROM usage_logs 
    WHERE user_id = ? AND date(created_at) = date('now')
  `).get(authUser.userId) as { count: number };
  
  const monthUsage = db.prepare(`
    SELECT COUNT(*) as count 
    FROM usage_logs 
    WHERE user_id = ? AND strftime('%Y-%m', created_at) = strftime('%Y-%m', 'now')
  `).get(authUser.userId) as { count: number };
  
  const totalUsage = db.prepare(`
    SELECT COUNT(*) as count 
    FROM usage_logs 
    WHERE user_id = ?
  `).get(authUser.userId) as { count: number };
  
  // Get API key stats
  const keyStats = db.prepare(`
    SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) as active
    FROM api_keys 
    WHERE user_id = ?
  `).get(authUser.userId) as { total: number; active: number };
  
  // Get memo stats
  const memoStats = db.prepare(`
    SELECT 
      COUNT(*) as total,
      COALESCE(SUM(character_count), 0) as total_characters
    FROM memos 
    WHERE user_id = ?
  `).get(authUser.userId) as { total: number; total_characters: number };
  
  return c.json({
    success: true,
    stats: {
      usage: {
        today: todayUsage.count || 0,
        thisMonth: monthUsage.count || 0,
        total: totalUsage.count || 0,
      },
      apiKeys: {
        total: keyStats.total || 0,
        active: keyStats.active || 0,
      },
      memos: {
        total: memoStats.total || 0,
        totalCharacters: memoStats.total_characters || 0,
      },
    },
  });
});

/**
 * GET /api/v1/dashboard/usage-history
 * Get recent usage history for the authenticated user
 */
dashboardRoutes.get('/usage-history', requireAuth, async (c) => {
  const authUser = getAuthUser(c);
  
  if (!authUser) {
    throw new UnauthorizedError('Not authenticated');
  }
  
  const db = getDb();
  
  const limit = Math.min(parseInt(c.req.query('limit') || '50'), 100);
  
  const usageLogs = db.prepare(`
    SELECT 
      ul.id,
      ul.action,
      ul.metadata,
      ul.created_at,
      ak.name as api_key_name,
      ak.prefix as api_key_prefix
    FROM usage_logs ul
    LEFT JOIN api_keys ak ON ul.api_key_id = ak.id
    WHERE ul.user_id = ?
    ORDER BY ul.created_at DESC
    LIMIT ?
  `).all(authUser.userId, limit) as Array<{
    id: string;
    action: string;
    metadata: string | null;
    created_at: string;
    api_key_name: string | null;
    api_key_prefix: string | null;
  }>;
  
  return c.json({
    success: true,
    logs: usageLogs.map(log => ({
      id: log.id,
      action: log.action,
      metadata: log.metadata ? JSON.parse(log.metadata) : null,
      createdAt: log.created_at,
      apiKeyName: log.api_key_name,
      apiKeyPrefix: log.api_key_prefix,
    })),
  });
});

/**
 * GET /api/v1/dashboard/keys
 * List API keys for the authenticated user (alias for /api/keys)
 */
dashboardRoutes.get('/keys', requireAuth, async (c) => {
  const authUser = getAuthUser(c);
  
  if (!authUser) {
    throw new UnauthorizedError('Not authenticated');
  }
  
  const keys = listUserApiKeys(authUser.userId);
  
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
 * POST /api/v1/dashboard/keys
 * Create a new API key (alias for /api/keys)
 */
dashboardRoutes.post('/keys', requireAuth, async (c) => {
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
    const result = createNewApiKey(authUser.userId, name, isTestKey);
    
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
 * DELETE /api/v1/dashboard/keys/:id
 * Revoke an API key (alias for /api/keys/:id)
 */
dashboardRoutes.delete('/keys/:id', requireAuth, async (c) => {
  const authUser = getAuthUser(c);
  
  if (!authUser) {
    throw new UnauthorizedError('Not authenticated');
  }
  
  const keyId = c.req.param('id');
  
  revokeUserApiKey(keyId, authUser.userId);
  
  return c.json({
    success: true,
    message: 'API key revoked successfully',
  });
});

/**
 * GET /api/v1/dashboard/account
 * Get account information for the authenticated user
 */
dashboardRoutes.get('/account', requireAuth, async (c) => {
  const authUser = getAuthUser(c);
  
  if (!authUser) {
    throw new UnauthorizedError('Not authenticated');
  }
  
  const db = getDb();
  
  const user = db.prepare(`
    SELECT id, email, tier, role, created_at, updated_at
    FROM users
    WHERE id = ?
  `).get(authUser.userId) as {
    id: string;
    email: string;
    tier: string;
    role: string;
    created_at: string;
    updated_at: string;
  } | undefined;
  
  if (!user) {
    throw new UnauthorizedError('User not found');
  }
  
  return c.json({
    success: true,
    account: {
      id: user.id,
      email: user.email,
      tier: user.tier,
      role: user.role,
      createdAt: user.created_at,
      updatedAt: user.updated_at,
    },
  });
});
