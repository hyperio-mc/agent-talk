/**
 * Dashboard Routes
 * User dashboard API endpoints for managing API keys and viewing usage
 */

import { Hono } from 'hono';
import { requireAuth, getAuthUser } from '../middleware/auth.js';
import {
  createNewApiKey,
  listUserApiKeys,
  revokeUserApiKey,
} from '../services/apiKey.js';
import {
  ValidationError,
  UnauthorizedError,
} from '../errors/index.js';
import {
  TIERS,
  TierName,
  getTierConfig,
} from '../config/tiers.js';
import { getRateLimitStatus } from '../middleware/rateLimit.js';
import { 
  findUserById, 
} from '../db/users.js';
import { 
  getApiKeysByUserId,
  countApiKeysByUser,
} from '../db/keys.js';
import { 
  countMemosByUserId, 
} from '../db/memos.js';

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
  
  // Get user tier
  const user = await findUserById(authUser.userId);
  const userTier = (user?.tier || 'hobby') as TierName;
  const tierConfig = getTierConfig(userTier);
  
  // Get API key stats
  const totalKeys = await countApiKeysByUser(authUser.userId);
  const keys = await getApiKeysByUserId(authUser.userId);
  const activeKeys = keys.filter(k => k.is_active).length;
  
  // Get memo stats
  const totalMemos = await countMemosByUserId(authUser.userId);
  
  // For usage stats, we'll use placeholder data for now
  // as usage_logs table might not have data
  const todayUsage = 0;
  const monthUsage = totalMemos;
  const totalUsage = totalMemos;
  
  // Get rate limit status
  const rateLimitStatus = await getRateLimitStatus(authUser.userId, userTier);
  
  return c.json({
    success: true,
    stats: {
      usage: {
        today: todayUsage,
        thisMonth: monthUsage,
        total: totalUsage,
      },
      apiKeys: {
        total: totalKeys,
        active: activeKeys,
        maxAllowed: tierConfig.limits.maxApiKeys,
      },
      memos: {
        total: totalMemos,
        totalCharacters: 0, // Placeholder
      },
      rateLimit: {
        limit: rateLimitStatus.limit === -1 ? 'unlimited' : rateLimitStatus.limit,
        used: rateLimitStatus.used,
        remaining: rateLimitStatus.remaining === -1 ? 'unlimited' : rateLimitStatus.remaining,
        resetAt: rateLimitStatus.resetAt.toISOString(),
      },
    },
    tier: {
      name: userTier,
      displayName: tierConfig.displayName,
      price: tierConfig.price,
      tts: tierConfig.features.tts,
      priority: tierConfig.features.priority,
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
  
  // For now, return empty logs as usage_logs might not be populated
  // In a full implementation, this would query usage_logs
  
  return c.json({
    success: true,
    logs: [],
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
    const result = await createNewApiKey(authUser.userId, name, isTestKey);
    
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
  
  await revokeUserApiKey(keyId, authUser.userId);
  
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
  
  const user = await findUserById(authUser.userId);
  
  if (!user) {
    throw new UnauthorizedError('User not found');
  }
  
  const tierConfig = getTierConfig(user.tier as TierName);
  const allTiers = Object.values(TIERS).map(t => ({
    name: t.name,
    displayName: t.displayName,
    price: t.price,
    highlighted: t.highlighted || false,
  }));
  
  return c.json({
    success: true,
    account: {
      id: user.id,
      email: user.email,
      tier: user.tier,
      tierName: tierConfig.displayName,
      role: user.role,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    },
    tierInfo: {
      limits: {
        callsPerDay: tierConfig.limits.callsPerDay === null ? 'unlimited' : tierConfig.limits.callsPerDay,
        charsPerMemo: tierConfig.limits.charsPerMemo === null ? 'unlimited' : tierConfig.limits.charsPerMemo,
        maxApiKeys: tierConfig.limits.maxApiKeys,
        maxConcurrent: tierConfig.limits.maxConcurrent,
      },
      features: {
        voices: tierConfig.features.voices,
        tts: tierConfig.features.tts,
        priority: tierConfig.features.priority,
        voiceCloning: tierConfig.features.voiceCloning,
        customVoices: tierConfig.features.customVoices,
        analytics: tierConfig.features.analytics,
        webhooks: tierConfig.features.webhooks,
        customBranding: tierConfig.features.customBranding,
        dedicatedSupport: tierConfig.features.dedicatedSupport,
        slaPercentage: tierConfig.features.slaPercentage,
      },
    },
    availableTiers: allTiers,
    upgradeUrl: user.tier === 'hobby' ? '/billing/upgrade' : null,
  });
});