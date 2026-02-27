/**
 * Admin Routes
 * Administrative endpoints for user, API key, and usage management
 */

import { Hono } from 'hono';
import { requireAuth, getAuthUser } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/admin.js';
import { getDb, checkHealth } from '../db/index.js';
import { 
  ValidationError, 
  NotFoundError,
  ForbiddenError 
} from '../errors/index.js';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcrypt';
import { existsSync, statSync } from 'fs';
import { dirname } from 'path';

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
  const db = getDb();
  
  // Get total users count
  const totalUsers = db.prepare(
    'SELECT COUNT(*) as count FROM users'
  ).get() as { count: number };
  
  // Get users by tier
  const usersByTier = db.prepare(
    'SELECT tier, COUNT(*) as count FROM users GROUP BY tier'
  ).all() as { tier: string; count: number }[];
  
  // Get total API keys
  const totalApiKeys = db.prepare(
    'SELECT COUNT(*) as count FROM api_keys'
  ).get() as { count: number };
  
  // Get active API keys
  const activeApiKeys = db.prepare(
    'SELECT COUNT(*) as count FROM api_keys WHERE is_active = 1'
  ).get() as { count: number };
  
  // Get total usage (from usage_logs)
  const totalUsage = db.prepare(
    'SELECT COUNT(*) as count FROM usage_logs'
  ).get() as { count: number };
  
  // Get usage in last 24 hours
  const usage24h = db.prepare(
    `SELECT COUNT(*) as count FROM usage_logs 
     WHERE created_at >= datetime('now', '-24 hours')`
  ).get() as { count: number };
  
  // Get usage in last 7 days
  const usage7d = db.prepare(
    `SELECT COUNT(*) as count FROM usage_logs 
     WHERE created_at >= datetime('now', '-7 days')`
  ).get() as { count: number };
  
  // Get usage in last 30 days
  const usage30d = db.prepare(
    `SELECT COUNT(*) as count FROM usage_logs 
     WHERE created_at >= datetime('now', '-30 days')`
  ).get() as { count: number };
  
  // Get total memos (TTS generations)
  const totalMemos = db.prepare(
    'SELECT COUNT(*) as count FROM memos'
  ).get() as { count: number };
  
  // Get total characters processed
  const totalChars = db.prepare(
    'SELECT COALESCE(SUM(character_count), 0) as total FROM memos'
  ).get() as { total: number };
  
  // New users in last 7 days
  const newUsers7d = db.prepare(
    `SELECT COUNT(*) as count FROM users 
     WHERE created_at >= datetime('now', '-7 days')`
  ).get() as { count: number };
  
  // New users in last 30 days
  const newUsers30d = db.prepare(
    `SELECT COUNT(*) as count FROM users 
     WHERE created_at >= datetime('now', '-30 days')`
  ).get() as { count: number };
  
  // Top users by usage
  const topUsers = db.prepare(
    `SELECT u.id, u.email, u.tier, COUNT(ul.id) as usage_count
     FROM users u
     LEFT JOIN usage_logs ul ON u.id = ul.user_id
     GROUP BY u.id
     ORDER BY usage_count DESC
     LIMIT 10`
  ).all() as { id: string; email: string; tier: string; usage_count: number }[];
  
  return c.json({
    success: true,
    metrics: {
      users: {
        total: totalUsers.count,
        byTier: Object.fromEntries(usersByTier.map(t => [t.tier, t.count])),
        newLast7Days: newUsers7d.count,
        newLast30Days: newUsers30d.count
      },
      apiKeys: {
        total: totalApiKeys.count,
        active: activeApiKeys.count,
        revoked: totalApiKeys.count - activeApiKeys.count
      },
      usage: {
        total: totalUsage.count,
        last24Hours: usage24h.count,
        last7Days: usage7d.count,
        last30Days: usage30d.count
      },
      memos: {
        total: totalMemos.count,
        totalCharacters: totalChars.total
      },
      topUsers
    }
  });
});

// ============ USER MANAGEMENT ============

/**
 * GET /api/v1/admin/users
 * List all users with pagination and search
 */
adminRoutes.get('/users', async (c) => {
  const db = getDb();
  
  // Query parameters
  const page = parseInt(c.req.query('page') || '1');
  const limit = Math.min(parseInt(c.req.query('limit') || '20'), 100);
  const search = c.req.query('search')?.trim();
  const tier = c.req.query('tier');
  const role = c.req.query('role');
  
  const offset = (page - 1) * limit;
  
  // Build query
  let whereConditions: string[] = [];
  let params: (string | number)[] = [];
  
  if (search) {
    whereConditions.push('email LIKE ?');
    params.push(`%${search}%`);
  }
  
  if (tier) {
    whereConditions.push('tier = ?');
    params.push(tier);
  }
  
  if (role) {
    whereConditions.push('role = ?');
    params.push(role);
  }
  
  const whereClause = whereConditions.length > 0 
    ? `WHERE ${whereConditions.join(' AND ')}` 
    : '';
  
  // Get total count
  const countQuery = `SELECT COUNT(*) as count FROM users ${whereClause}`;
  const totalCount = db.prepare(countQuery).get(...params) as { count: number };
  
  // Get users
  const usersQuery = `
    SELECT 
      id, email, tier, role, created_at, updated_at,
      (SELECT COUNT(*) FROM api_keys WHERE user_id = users.id) as api_key_count,
      (SELECT COUNT(*) FROM usage_logs WHERE user_id = users.id) as usage_count
    FROM users
    ${whereClause}
    ORDER BY created_at DESC
    LIMIT ? OFFSET ?
  `;
  
  const users = db.prepare(usersQuery).all(...params, limit, offset) as Array<{
    id: string;
    email: string;
    tier: string;
    role: string;
    created_at: string;
    updated_at: string;
    api_key_count: number;
    usage_count: number;
  }>;
  
  return c.json({
    success: true,
    users,
    pagination: {
      page,
      limit,
      total: totalCount.count,
      totalPages: Math.ceil(totalCount.count / limit)
    }
  });
});

/**
 * GET /api/v1/admin/users/:id
 * Get detailed user information
 */
adminRoutes.get('/users/:id', async (c) => {
  const db = getDb();
  const userId = c.req.param('id');
  
  // Get user
  const user = db.prepare(
    `SELECT id, email, tier, role, created_at, updated_at
     FROM users WHERE id = ?`
  ).get(userId) as { 
    id: string; 
    email: string; 
    tier: string; 
    role: string;
    created_at: string; 
    updated_at: string;
  } | undefined;
  
  if (!user) {
    throw new NotFoundError('User');
  }
  
  // Get API keys
  const apiKeys = db.prepare(
    `SELECT id, prefix, name, usage_count, last_used_at, is_active, created_at
     FROM api_keys WHERE user_id = ?`
  ).all(userId) as Array<{
    id: string;
    prefix: string;
    name: string | null;
    usage_count: number;
    last_used_at: string | null;
    is_active: number;
    created_at: string;
  }>;
  
  // Get usage stats
  const usageStats = db.prepare(
    `SELECT 
      COUNT(*) as total_requests,
      COUNT(CASE WHEN created_at >= datetime('now', '-24 hours') THEN 1 END) as last_24h,
      COUNT(CASE WHEN created_at >= datetime('now', '-7 days') THEN 1 END) as last_7d,
      COUNT(CASE WHEN created_at >= datetime('now', '-30 days') THEN 1 END) as last_30d
     FROM usage_logs WHERE user_id = ?`
  ).get(userId) as {
    total_requests: number;
    last_24h: number;
    last_7d: number;
    last_30d: number;
  };
  
  // Get memo stats
  const memoStats = db.prepare(
    `SELECT 
      COUNT(*) as total_memos,
      COALESCE(SUM(character_count), 0) as total_characters
     FROM memos WHERE user_id = ?`
  ).get(userId) as {
    total_memos: number;
    total_characters: number;
  };
  
  return c.json({
    success: true,
    user,
    apiKeys: apiKeys.map(k => ({
      ...k,
      is_active: k.is_active === 1
    })),
    stats: {
      usage: usageStats,
      memos: memoStats
    }
  });
});

/**
 * PATCH /api/v1/admin/users/:id/tier
 * Update user tier
 */
adminRoutes.patch('/users/:id/tier', async (c) => {
  const db = getDb();
  const userId = c.req.param('id');
  
  // Parse body
  const body = await c.req.json();
  const { tier } = body;
  
  // Validate tier
  const validTiers = ['hobby', 'pro', 'enterprise'];
  if (!tier || !validTiers.includes(tier)) {
    throw new ValidationError('Invalid tier. Must be one of: hobby, pro, enterprise');
  }
  
  // Check user exists
  const user = db.prepare('SELECT id FROM users WHERE id = ?').get(userId);
  if (!user) {
    throw new NotFoundError('User');
  }
  
  // Update tier
  db.prepare(
    'UPDATE users SET tier = ?, updated_at = datetime("now") WHERE id = ?'
  ).run(tier, userId);
  
  return c.json({
    success: true,
    message: `User tier updated to ${tier}`
  });
});

/**
 * PATCH /api/v1/admin/users/:id/role
 * Update user role (admin/user)
 */
adminRoutes.patch('/users/:id/role', async (c) => {
  const db = getDb();
  const userId = c.req.param('id');
  const authUser = getAuthUser(c);
  
  // Parse body
  const body = await c.req.json();
  const { role } = body;
  
  // Validate role
  const validRoles = ['user', 'admin'];
  if (!role || !validRoles.includes(role)) {
    throw new ValidationError('Invalid role. Must be one of: user, admin');
  }
  
  // Prevent self-demotion (admin can't remove their own admin status)
  if (authUser && authUser.userId === userId && role !== 'admin') {
    throw new ForbiddenError('Cannot remove your own admin role');
  }
  
  // Check user exists
  const user = db.prepare('SELECT id FROM users WHERE id = ?').get(userId);
  if (!user) {
    throw new NotFoundError('User');
  }
  
  // Update role
  db.prepare(
    'UPDATE users SET role = ?, updated_at = datetime("now") WHERE id = ?'
  ).run(role, userId);
  
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
  const db = getDb();
  const userId = c.req.param('id');
  const authUser = getAuthUser(c);
  
  // Prevent self-deletion
  if (authUser && authUser.userId === userId) {
    throw new ForbiddenError('Cannot delete your own account');
  }
  
  // Check user exists
  const user = db.prepare('SELECT id, email FROM users WHERE id = ?').get(userId) as { id: string; email: string } | undefined;
  if (!user) {
    throw new NotFoundError('User');
  }
  
  // Delete in transaction (cascade will handle related data)
  const deleteTransaction = db.transaction(() => {
    // Delete usage logs
    db.prepare('DELETE FROM usage_logs WHERE user_id = ?').run(userId);
    
    // Delete memos
    db.prepare('DELETE FROM memos WHERE user_id = ?').run(userId);
    
    // Delete API keys
    db.prepare('DELETE FROM api_keys WHERE user_id = ?').run(userId);
    
    // Delete user
    db.prepare('DELETE FROM users WHERE id = ?').run(userId);
  });
  
  deleteTransaction();
  
  return c.json({
    success: true,
    message: `User ${user.email} deleted successfully`
  });
});

// ============ API KEY MANAGEMENT ============

/**
 * GET /api/v1/admin/api-keys
 * List all API keys with pagination
 */
adminRoutes.get('/api-keys', async (c) => {
  const db = getDb();
  
  const page = parseInt(c.req.query('page') || '1');
  const limit = Math.min(parseInt(c.req.query('limit') || '20'), 100);
  const activeOnly = c.req.query('active') === 'true';
  
  const offset = (page - 1) * limit;
  
  const whereClause = activeOnly ? 'WHERE k.is_active = 1' : '';
  
  // Get total count
  const totalCount = db.prepare(
    `SELECT COUNT(*) as count FROM api_keys k ${whereClause}`
  ).get() as { count: number };
  
  // Get API keys with user info
  const apiKeys = db.prepare(`
    SELECT 
      k.id, k.prefix, k.name, k.usage_count, k.last_used_at, k.is_active, k.created_at,
      u.id as user_id, u.email as user_email, u.tier as user_tier
    FROM api_keys k
    JOIN users u ON k.user_id = u.id
    ${whereClause}
    ORDER BY k.created_at DESC
    LIMIT ? OFFSET ?
  `).all(limit, offset) as Array<{
    id: string;
    prefix: string;
    name: string | null;
    usage_count: number;
    last_used_at: string | null;
    is_active: number;
    created_at: string;
    user_id: string;
    user_email: string;
    user_tier: string;
  }>;
  
  return c.json({
    success: true,
    apiKeys: apiKeys.map(k => ({
      ...k,
      is_active: k.is_active === 1
    })),
    pagination: {
      page,
      limit,
      total: totalCount.count,
      totalPages: Math.ceil(totalCount.count / limit)
    }
  });
});

/**
 * POST /api/v1/admin/api-keys/:id/revoke
 * Revoke an API key
 */
adminRoutes.post('/api-keys/:id/revoke', async (c) => {
  const db = getDb();
  const keyId = c.req.param('id');
  
  // Check key exists
  const key = db.prepare(
    'SELECT k.id, k.prefix, u.email as user_email FROM api_keys k JOIN users u ON k.user_id = u.id WHERE k.id = ?'
  ).get(keyId) as { id: string; prefix: string; user_email: string } | undefined;
  
  if (!key) {
    throw new NotFoundError('API key');
  }
  
  // Revoke key
  db.prepare(
    'UPDATE api_keys SET is_active = 0 WHERE id = ?'
  ).run(keyId);
  
  return c.json({
    success: true,
    message: `API key ${key.prefix}... revoked for user ${key.user_email}`
  });
});

/**
 * POST /api/v1/admin/api-keys/:id/restore
 * Restore a revoked API key
 */
adminRoutes.post('/api-keys/:id/restore', async (c) => {
  const db = getDb();
  const keyId = c.req.param('id');
  
  // Check key exists
  const key = db.prepare(
    'SELECT k.id, k.prefix, u.email as user_email FROM api_keys k JOIN users u ON k.user_id = u.id WHERE k.id = ?'
  ).get(keyId) as { id: string; prefix: string; user_email: string } | undefined;
  
  if (!key) {
    throw new NotFoundError('API key');
  }
  
  // Restore key
  db.prepare(
    'UPDATE api_keys SET is_active = 1 WHERE id = ?'
  ).run(keyId);
  
  return c.json({
    success: true,
    message: `API key ${key.prefix}... restored for user ${key.user_email}`
  });
});

// ============ SYSTEM HEALTH & STATS ============

/**
 * GET /api/v1/admin/health
 * System health check (database, storage)
 */
adminRoutes.get('/health', async (c) => {
  const checks: {
    database: { status: string; latency?: number; error?: string };
    storage: { status: string; available?: boolean; error?: string };
  } = {
    database: { status: 'unknown' },
    storage: { status: 'unknown' }
  };
  
  // Check database
  try {
    const start = Date.now();
    const db = getDb();
    db.prepare('SELECT 1').get();
    checks.database = {
      status: 'ok',
      latency: Date.now() - start
    };
  } catch (error) {
    checks.database = {
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown database error'
    };
  }
  
  // Check storage (audio files directory)
  try {
    const db = getDb();
    const dbPath = db.prepare("SELECT file FROM pragma_database_list").get() as { file: string } | undefined;
    const dataDir = dbPath?.file ? dirname(dbPath.file) : null;
    
    if (dataDir && existsSync(dataDir)) {
      checks.storage = {
        status: 'ok',
        available: true
      };
    } else {
      checks.storage = {
        status: 'warning',
        available: false,
        error: 'Storage directory not found'
      };
    }
  } catch (error) {
    checks.storage = {
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown storage error'
    };
  }
  
  const allHealthy = checks.database.status === 'ok' && checks.storage.status === 'ok';
  
  return c.json({
    success: true,
    status: allHealthy ? 'healthy' : 'degraded',
    checks,
    timestamp: new Date().toISOString()
  });
});

/**
 * GET /api/v1/admin/stats
 * System-wide statistics
 */
adminRoutes.get('/stats', async (c) => {
  const db = getDb();
  
  // User stats
  const userStats = db.prepare(`
    SELECT 
      COUNT(*) as total,
      COUNT(CASE WHEN created_at >= datetime('now', '-24 hours') THEN 1 END) as new_24h,
      COUNT(CASE WHEN created_at >= datetime('now', '-7 days') THEN 1 END) as new_7d,
      COUNT(CASE WHEN created_at >= datetime('now', '-30 days') THEN 1 END) as new_30d
    FROM users
  `).get() as {
    total: number;
    new_24h: number;
    new_7d: number;
    new_30d: number;
  };
  
  // Users by tier
  const usersByTier = db.prepare(`
    SELECT tier, COUNT(*) as count 
    FROM users 
    GROUP BY tier
  `).all() as { tier: string; count: number }[];
  
  // API key stats
  const keyStats = db.prepare(`
    SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) as active,
      SUM(CASE WHEN is_active = 0 THEN 1 ELSE 0 END) as revoked
    FROM api_keys
  `).get() as {
    total: number;
    active: number;
    revoked: number;
  };
  
  // Usage stats
  const usageStats = db.prepare(`
    SELECT 
      COUNT(*) as total_requests,
      COUNT(CASE WHEN created_at >= datetime('now', '-24 hours') THEN 1 END) as requests_24h,
      COUNT(CASE WHEN created_at >= datetime('now', '-7 days') THEN 1 END) as requests_7d,
      COUNT(CASE WHEN created_at >= datetime('now', '-30 days') THEN 1 END) as requests_30d,
      COUNT(DISTINCT user_id) as unique_users
    FROM usage_logs
  `).get() as {
    total_requests: number;
    requests_24h: number;
    requests_7d: number;
    requests_30d: number;
    unique_users: number;
  };
  
  // Memo stats
  const memoStats = db.prepare(`
    SELECT 
      COUNT(*) as total_memos,
      COALESCE(SUM(character_count), 0) as total_characters
    FROM memos
  `).get() as {
    total_memos: number;
    total_characters: number;
  };
  
  // Active users (used API in last 7 days)
  const activeUsers = db.prepare(`
    SELECT COUNT(DISTINCT user_id) as count 
    FROM usage_logs 
    WHERE created_at >= datetime('now', '-7 days')
  `).get() as { count: number };
  
  return c.json({
    success: true,
    stats: {
      users: {
        total: userStats.total,
        newLast24Hours: userStats.new_24h,
        newLast7Days: userStats.new_7d,
        newLast30Days: userStats.new_30d,
        byTier: Object.fromEntries(usersByTier.map(t => [t.tier, t.count])),
        activeLast7Days: activeUsers.count
      },
      apiKeys: {
        total: keyStats.total,
        active: keyStats.active || 0,
        revoked: keyStats.revoked || 0
      },
      usage: {
        totalRequests: usageStats.total_requests,
        last24Hours: usageStats.requests_24h,
        last7Days: usageStats.requests_7d,
        last30Days: usageStats.requests_30d,
        uniqueUsersTotal: usageStats.unique_users
      },
      memos: {
        total: memoStats.total_memos,
        totalCharacters: memoStats.total_characters
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
  const db = getDb();
  
  const days = parseInt(c.req.query('days') || '30');
  
  const dailyStats = db.prepare(`
    SELECT 
      date(created_at) as date,
      COUNT(*) as total_requests,
      COUNT(DISTINCT user_id) as unique_users
    FROM usage_logs
    WHERE created_at >= datetime('now', '-${days} days')
    GROUP BY date(created_at)
    ORDER BY date DESC
  `).all() as Array<{
    date: string;
    total_requests: number;
    unique_users: number;
  }>;
  
  return c.json({
    success: true,
    daily: dailyStats
  });
});

/**
 * GET /api/v1/admin/analytics/weekly
 * Get weekly usage analytics
 */
adminRoutes.get('/analytics/weekly', async (c) => {
  const db = getDb();
  
  const weeks = parseInt(c.req.query('weeks') || '12');
  
  const weeklyStats = db.prepare(`
    SELECT 
      strftime('%Y-%W', created_at) as week,
      COUNT(*) as total_requests,
      COUNT(DISTINCT user_id) as unique_users
    FROM usage_logs
    WHERE created_at >= datetime('now', '-${weeks * 7} days')
    GROUP BY strftime('%Y-%W', created_at)
    ORDER BY week DESC
  `).all() as Array<{
    week: string;
    total_requests: number;
    unique_users: number;
  }>;
  
  return c.json({
    success: true,
    weekly: weeklyStats
  });
});

/**
 * GET /api/v1/admin/analytics/monthly
 * Get monthly usage analytics
 */
adminRoutes.get('/analytics/monthly', async (c) => {
  const db = getDb();
  
  const months = parseInt(c.req.query('months') || '12');
  
  const monthlyStats = db.prepare(`
    SELECT 
      strftime('%Y-%m', created_at) as month,
      COUNT(*) as total_requests,
      COUNT(DISTINCT user_id) as unique_users
    FROM usage_logs
    WHERE created_at >= datetime('now', '-${months * 30} days')
    GROUP BY strftime('%Y-%m', created_at)
    ORDER BY month DESC
  `).all() as Array<{
    month: string;
    total_requests: number;
    unique_users: number;
  }>;
  
  return c.json({
    success: true,
    monthly: monthlyStats
  });
});

/**
 * GET /api/v1/admin/analytics/by-action
 * Get usage breakdown by action type
 */
adminRoutes.get('/analytics/by-action', async (c) => {
  const db = getDb();
  
  const days = parseInt(c.req.query('days') || '30');
  
  const actionStats = db.prepare(`
    SELECT 
      action,
      COUNT(*) as count,
      COUNT(DISTINCT user_id) as unique_users
    FROM usage_logs
    WHERE created_at >= datetime('now', '-${days} days')
    GROUP BY action
    ORDER BY count DESC
  `).all() as Array<{
    action: string;
    count: number;
    unique_users: number;
  }>;
  
  return c.json({
    success: true,
    byAction: actionStats
  });
});

/**
 * GET /api/v1/admin/analytics/by-tier
 * Get usage breakdown by user tier
 */
adminRoutes.get('/analytics/by-tier', async (c) => {
  const db = getDb();
  
  const days = parseInt(c.req.query('days') || '30');
  
  const tierStats = db.prepare(`
    SELECT 
      u.tier,
      COUNT(ul.id) as total_requests,
      COUNT(DISTINCT ul.user_id) as unique_users
    FROM users u
    LEFT JOIN usage_logs ul ON u.id = ul.user_id 
      AND ul.created_at >= datetime('now', '-${days} days')
    GROUP BY u.tier
    ORDER BY total_requests DESC
  `).all() as Array<{
    tier: string;
    total_requests: number;
    unique_users: number;
  }>;
  
  return c.json({
    success: true,
    byTier: tierStats
  });
});
