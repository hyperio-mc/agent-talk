/**
 * Admin Routes
 * Administrative endpoints for user, API key, and usage management
 */

import { Hono } from 'hono';
import { requireAuth, getAuthUser } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/admin.js';
import { checkHealth } from '../db/index.js';
import { 
  getAllUsers,
  findUserById,
  updateUser,
  updateUserTier
} from '../db/users.js';
import { 
  getAllApiKeys,
  getApiKeysByUserId,
  revokeApiKey,
  findApiKeyByIdAsync
} from '../db/keys.js';
import { 
  getAllMemos,
  countMemosByUserId
} from '../db/memos.js';
import { getAllSubscriptions } from '../db/subscriptions.js';
import { 
  ValidationError, 
  NotFoundError,
  ForbiddenError,
  NotImplementedError
} from '../errors/index.js';

export const adminRoutes = new Hono();

// All admin routes require authentication first, then admin role
adminRoutes.use('*', requireAuth);
adminRoutes.use('*', requireAdmin);

// ============ DASHBOARD ============

/**
 * GET /api/v1/admin/dashboard
 * Get admin dashboard metrics
 */
adminRoutes.get('/dashboard', async (c) => {
  // Get all data
  const [users, apiKeys, memos, subscriptions] = await Promise.all([
    getAllUsers(),
    getAllApiKeys(),
    getAllMemos(),
    getAllSubscriptions()
  ]);
  
  // Calculate metrics
  const totalUsers = users.length;
  const usersByTier = {
    hobby: users.filter(u => u.tier === 'hobby').length,
    pro: users.filter(u => u.tier === 'pro').length,
    enterprise: users.filter(u => u.tier === 'enterprise').length,
  };
  
  const totalApiKeys = apiKeys.length;
  const activeApiKeys = apiKeys.filter(k => k.is_active).length;
  
  const totalMemos = memos.length;
  const totalCharacters = memos.reduce((sum, m) => sum + (m.duration_sec || 0), 0);
  
  return c.json({
    success: true,
    metrics: {
      users: {
        total: totalUsers,
        byTier: usersByTier,
        newLast7Days: 0, // Would need created_at filtering
        newLast30Days: 0
      },
      apiKeys: {
        total: totalApiKeys,
        active: activeApiKeys,
        revoked: totalApiKeys - activeApiKeys
      },
      usage: {
        total: 0, // Would need usage_logs table
        last24Hours: 0,
        last7Days: 0,
        last30Days: 0
      },
      memos: {
        total: totalMemos,
        totalCharacters
      },
      topUsers: [] // Would need complex query
    }
  });
});

// ============ USER MANAGEMENT ============

/**
 * GET /api/v1/admin/users
 * List all users with pagination and search
 */
adminRoutes.get('/users', async (c) => {
  const page = parseInt(c.req.query('page') || '1');
  const limit = Math.min(parseInt(c.req.query('limit') || '20'), 100);
  const search = c.req.query('search')?.toLowerCase();
  const tier = c.req.query('tier');
  const role = c.req.query('role');
  
  // Get all users
  let users = await getAllUsers();
  
  // Filter by search
  if (search) {
    users = users.filter(u => u.email.toLowerCase().includes(search));
  }
  
  // Filter by tier
  if (tier) {
    users = users.filter(u => u.tier === tier);
  }
  
  // Filter by role
  if (role) {
    users = users.filter(u => u.role === role);
  }
  
  // Sort by created_at descending
  users.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  
  // Paginate
  const total = users.length;
  const offset = (page - 1) * limit;
  const paginatedUsers = users.slice(offset, offset + limit);
  
  return c.json({
    success: true,
    users: paginatedUsers.map(u => ({
      id: u.id,
      email: u.email,
      tier: u.tier,
      role: u.role,
      created_at: u.createdAt,
      updated_at: u.updatedAt,
      api_key_count: 0, // Would need join
      usage_count: 0
    })),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit)
    }
  });
});

/**
 * GET /api/v1/admin/users/:id
 * Get detailed user information
 */
adminRoutes.get('/users/:id', async (c) => {
  const userId = c.req.param('id');
  
  const user = await findUserById(userId);
  if (!user) {
    throw new NotFoundError('User');
  }
  
  // Get memo count and API keys in parallel
  const [memoCount, apiKeys] = await Promise.all([
    countMemosByUserId(userId),
    getApiKeysByUserId(userId)
  ]);
  
  return c.json({
    success: true,
    user: {
      id: user.id,
      email: user.email,
      tier: user.tier,
      role: user.role,
      created_at: user.createdAt,
      updated_at: user.updatedAt
    },
    apiKeys: apiKeys.map(k => ({
      id: k.id,
      prefix: k.prefix,
      name: k.name,
      is_active: k.is_active,
      usage_count: k.usage_count || 0,
      created_at: k.created_at,
      last_used_at: k.last_used_at
    })),
    stats: {
      usage: {
        total_requests: apiKeys.reduce((sum, k) => sum + (k.usage_count || 0), 0),
        last_24h: 0,
        last_7d: 0,
        last_30d: 0
      },
      memos: {
        total_memos: memoCount,
        total_characters: 0
      }
    }
  });
});

/**
 * PATCH /api/v1/admin/users/:id/tier
 * Update user tier
 */
adminRoutes.patch('/users/:id/tier', async (c) => {
  const userId = c.req.param('id');
  
  const body = await c.req.json();
  const { tier } = body;
  
  const validTiers = ['hobby', 'pro', 'enterprise'];
  if (!tier || !validTiers.includes(tier)) {
    throw new ValidationError('Invalid tier. Must be one of: hobby, pro, enterprise');
  }
  
  const user = await findUserById(userId);
  if (!user) {
    throw new NotFoundError('User');
  }
  
  await updateUserTier(userId, tier as 'hobby' | 'pro' | 'enterprise');
  
  return c.json({
    success: true,
    message: `User tier updated to ${tier}`
  });
});

/**
 * GET /api/v1/admin/search/api-key
 * Find user by API key prefix
 */
adminRoutes.get('/search/api-key', async (c) => {
  const prefix = c.req.query('prefix');
  
  if (!prefix || prefix.length < 4) {
    throw new ValidationError('API key prefix must be at least 4 characters');
  }
  
  // Get all API keys and filter by prefix
  const allKeys = await getAllApiKeys();
  const matchingKey = allKeys.find(k => 
    k.prefix.toLowerCase().startsWith(prefix.toLowerCase())
  );
  
  if (!matchingKey) {
    return c.json({
      success: false,
      message: 'No API key found with that prefix'
    });
  }
  
  // Get the user for this key
  const user = await findUserById(matchingKey.user_id);
  
  return c.json({
    success: true,
    apiKey: {
      id: matchingKey.id,
      prefix: matchingKey.prefix,
      name: matchingKey.name,
      is_active: matchingKey.is_active,
      usage_count: matchingKey.usage_count || 0,
      created_at: matchingKey.created_at,
      last_used_at: matchingKey.last_used_at
    },
    user: user ? {
      id: user.id,
      email: user.email,
      tier: user.tier,
      role: user.role,
      created_at: user.createdAt
    } : null
  });
});

/**
 * PATCH /api/v1/admin/users/:id/role
 * Update user role (admin/user)
 */
adminRoutes.patch('/users/:id/role', async (c) => {
  const userId = c.req.param('id');
  const authUser = getAuthUser(c);
  
  const body = await c.req.json();
  const { role } = body;
  
  const validRoles = ['user', 'admin'];
  if (!role || !validRoles.includes(role)) {
    throw new ValidationError('Invalid role. Must be one of: user, admin');
  }
  
  // Prevent self-demotion
  if (authUser && authUser.userId === userId && role !== 'admin') {
    throw new ForbiddenError('Cannot remove your own admin role');
  }
  
  const user = await findUserById(userId);
  if (!user) {
    throw new NotFoundError('User');
  }
  
  await updateUser(userId, { role: role as 'user' | 'admin' });
  
  return c.json({
    success: true,
    message: `User role updated to ${role}`
  });
});

/**
 * DELETE /api/v1/admin/users/:id
 * Delete a user and all their data
 */
adminRoutes.delete('/users/:id', async (c) => {
  const userId = c.req.param('id');
  const authUser = getAuthUser(c);
  
  // Prevent self-deletion
  if (authUser && authUser.userId === userId) {
    throw new ForbiddenError('Cannot delete your own account');
  }
  
  const user = await findUserById(userId);
  if (!user) {
    throw new NotFoundError('User');
  }
  
  // Note: Full deletion would need cascading deletes
  // For now, return not implemented
  throw new NotImplementedError('User deletion - requires cascading delete implementation');
});

// ============ API KEY MANAGEMENT ============

/**
 * GET /api/v1/admin/api-keys
 * List all API keys with pagination
 */
adminRoutes.get('/api-keys', async (c) => {
  const page = parseInt(c.req.query('page') || '1');
  const limit = Math.min(parseInt(c.req.query('limit') || '20'), 100);
  const activeOnly = c.req.query('active') === 'true';
  
  let apiKeys = await getAllApiKeys();
  
  if (activeOnly) {
    apiKeys = apiKeys.filter(k => k.is_active);
  }
  
  // Sort by created_at descending
  apiKeys.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  
  const total = apiKeys.length;
  const offset = (page - 1) * limit;
  const paginatedKeys = apiKeys.slice(offset, offset + limit);
  
  return c.json({
    success: true,
    apiKeys: paginatedKeys.map(k => ({
      ...k,
      is_active: Boolean(k.is_active)
    })),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit)
    }
  });
});

/**
 * POST /api/v1/admin/api-keys/:id/revoke
 * Revoke an API key
 */
adminRoutes.post('/api-keys/:id/revoke', async (c) => {
  const keyId = c.req.param('id');
  
  const key = await findApiKeyByIdAsync(keyId);
  if (!key) {
    throw new NotFoundError('API key');
  }
  
  await revokeApiKey(keyId);
  
  return c.json({
    success: true,
    message: `API key ${key.prefix}... revoked`
  });
});

/**
 * POST /api/v1/admin/api-keys/:id/restore
 * Restore a revoked API key
 */
adminRoutes.post('/api-keys/:id/restore', async (c) => {
  throw new NotImplementedError('API key restoration');
});

// ============ SYSTEM HEALTH & STATS ============

/**
 * GET /api/v1/admin/health
 * System health check (database, storage)
 */
adminRoutes.get('/health', async (c) => {
  const health = await checkHealth();
  
  return c.json({
    success: true,
    status: health.status,
    checks: {
      database: {
        status: health.status,
        message: health.message
      },
      storage: {
        status: health.status === 'ok' ? 'ok' : 'unknown'
      }
    },
    timestamp: new Date().toISOString()
  });
});

/**
 * GET /api/v1/admin/stats
 * System-wide statistics
 */
adminRoutes.get('/stats', async (c) => {
  const [users, apiKeys, memos] = await Promise.all([
    getAllUsers(),
    getAllApiKeys(),
    getAllMemos()
  ]);
  
  return c.json({
    success: true,
    stats: {
      users: {
        total: users.length,
        byTier: {
          hobby: users.filter(u => u.tier === 'hobby').length,
          pro: users.filter(u => u.tier === 'pro').length,
          enterprise: users.filter(u => u.tier === 'enterprise').length,
        }
      },
      apiKeys: {
        total: apiKeys.length,
        active: apiKeys.filter(k => k.is_active).length
      },
      memos: {
        total: memos.length
      }
    }
  });
});

// ============ USAGE ANALYTICS ============

/**
 * GET /api/v1/admin/analytics/daily
 * Get daily usage analytics
 */
adminRoutes.get('/analytics/daily', async (c) => {
  throw new NotImplementedError('Daily analytics - requires usage_logs table');
});

/**
 * GET /api/v1/admin/analytics/weekly
 * Get weekly usage analytics
 */
adminRoutes.get('/analytics/weekly', async (c) => {
  throw new NotImplementedError('Weekly analytics - requires usage_logs table');
});

/**
 * GET /api/v1/admin/analytics/monthly
 * Get monthly usage analytics
 */
adminRoutes.get('/analytics/monthly', async (c) => {
  throw new NotImplementedError('Monthly analytics - requires usage_logs table');
});

/**
 * GET /api/v1/admin/analytics/by-action
 * Get usage breakdown by action type
 */
adminRoutes.get('/analytics/by-action', async (c) => {
  throw new NotImplementedError('Action analytics - requires usage_logs table');
});

/**
 * GET /api/v1/admin/analytics/by-tier
 * Get usage breakdown by user tier
 */
adminRoutes.get('/analytics/by-tier', async (c) => {
  throw new NotImplementedError('Tier analytics - requires usage_logs table');
});