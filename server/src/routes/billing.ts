/**
 * Billing Routes for Agent Talk API
 * 
 * Handles tier upgrades, subscription management, and billing info.
 * Stripe integration is planned for future implementation.
 */

import { Hono } from 'hono';
import { requireAuth, getAuthUser } from '../middleware/auth.js';
import { loadTierInfo, getTierInfo, getUserTier } from '../middleware/tierCheck.js';
import {
  TIERS,
  TierName,
  getAllTiers,
  getTierConfig,
  compareTiers,
} from '../config/tiers.js';
import { findUserById, updateUserTier } from '../db/users.js';
import {
  ValidationError,
  UnauthorizedError,
  NotImplementedError,
} from '../errors/index.js';

export const billingRoutes = new Hono();

/**
 * GET /api/v1/billing/tiers
 * Get all available tiers with pricing and features
 * Public endpoint - no auth required
 */
billingRoutes.get('/tiers', async (c) => {
  const tiers = getAllTiers().map(tier => ({
    name: tier.name,
    displayName: tier.displayName,
    description: tier.description,
    price: tier.price,
    highlighted: tier.highlighted || false,
    limits: {
      callsPerDay: tier.limits.callsPerDay === null ? 'unlimited' : tier.limits.callsPerDay,
      charsPerMemo: tier.limits.charsPerMemo === null ? 'unlimited' : tier.limits.charsPerMemo,
      maxApiKeys: tier.limits.maxApiKeys,
    },
    features: {
      tts: tier.features.tts,
      voices: tier.features.voices,
      priority: tier.features.priority,
      voiceCloning: tier.features.voiceCloning,
      customVoices: tier.features.customVoices,
      analytics: tier.features.analytics,
      webhooks: tier.features.webhooks,
      customBranding: tier.features.customBranding,
      dedicatedSupport: tier.features.dedicatedSupport,
      slaPercentage: tier.features.slaPercentage,
    },
  }));
  
  return c.json({
    success: true,
    tiers,
  });
});

/**
 * GET /api/v1/billing/tiers/:tier
 * Get details for a specific tier
 * Public endpoint - no auth required
 */
billingRoutes.get('/tiers/:tier', async (c) => {
  const tierParam = c.req.param('tier').toLowerCase() as TierName;
  
  if (!(tierParam in TIERS)) {
    throw new ValidationError(`Invalid tier: ${tierParam}`, {
      validTiers: Object.keys(TIERS),
    });
  }
  
  const tier = getTierConfig(tierParam);
  
  return c.json({
    success: true,
    tier: {
      name: tier.name,
      displayName: tier.displayName,
      description: tier.description,
      price: tier.price,
      limits: {
        callsPerDay: tier.limits.callsPerDay,
        charsPerMemo: tier.limits.charsPerMemo,
        maxApiKeys: tier.limits.maxApiKeys,
        maxConcurrent: tier.limits.maxConcurrent,
      },
      features: tier.features,
    },
  });
});

/**
 * GET /api/v1/billing/subscription
 * Get current user's subscription status
 * Requires authentication
 */
billingRoutes.get('/subscription', requireAuth, loadTierInfo, async (c) => {
  const authUser = getAuthUser(c);
  
  if (!authUser) {
    throw new UnauthorizedError('Not authenticated');
  }
  
  const tierInfo = getTierInfo(c);
  const user = await findUserById(authUser.userId);
  
  if (!user) {
    throw new UnauthorizedError('User not found');
  }
  
  const currentTier = user.tier as TierName;
  const tierConfig = getTierConfig(currentTier);
  
  return c.json({
    success: true,
    subscription: {
      tier: currentTier,
      tierName: tierConfig.displayName,
      price: tierConfig.price,
      limits: tierConfig.limits,
      features: tierConfig.features,
      // Placeholder fields for Stripe integration
      stripeCustomerId: null,
      stripeSubscriptionId: null,
      currentPeriodStart: null,
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
    },
    user: {
      id: user.id,
      email: user.email,
      createdAt: user.createdAt,
    },
  });
});

/**
 * POST /api/v1/billing/upgrade
 * Upgrade to a higher tier
 * Requires authentication
 * 
 * TODO: Implement Stripe checkout session creation
 */
billingRoutes.post('/upgrade', requireAuth, loadTierInfo, async (c) => {
  const authUser = getAuthUser(c);
  
  if (!authUser) {
    throw new UnauthorizedError('Not authenticated');
  }
  
  // Parse request body
  let body: { tier?: unknown };
  try {
    body = await c.req.json();
  } catch {
    throw new ValidationError('Invalid JSON body');
  }
  
  // Validate tier
  if (!body.tier || typeof body.tier !== 'string') {
    throw new ValidationError('Missing required field: tier', {
      field: 'tier',
      validOptions: Object.keys(TIERS),
    });
  }
  
  const targetTier = body.tier.toLowerCase() as TierName;
  
  if (!(targetTier in TIERS)) {
    throw new ValidationError(`Invalid tier: ${body.tier}`, {
      field: 'tier',
      validOptions: Object.keys(TIERS),
    });
  }
  
  // Get current user
  const user = await findUserById(authUser.userId);
  if (!user) {
    throw new UnauthorizedError('User not found');
  }
  
  const currentTier = user.tier as TierName;
  const targetConfig = getTierConfig(targetTier);
  
  // Check if this is actually an upgrade
  const comparison = compareTiers(currentTier, targetTier);
  
  if (comparison === 0) {
    throw new ValidationError('You are already on this tier', {
      currentTier,
      requestedTier: targetTier,
    });
  }
  
  if (comparison > 0) {
    throw new ValidationError('Downgrade not supported via this endpoint', {
      currentTier,
      requestedTier: targetTier,
      message: 'Please contact support for downgrade requests',
    });
  }
  
  // Handle enterprise tier
  if (targetTier === 'enterprise') {
    return c.json({
      success: true,
      message: 'Enterprise tier requires custom setup',
      action: 'contact_sales',
      contactEmail: 'sales@onhyper.io',
      // For now, allow immediate upgrade for testing
      note: 'Stripe integration pending. For testing, upgrades are processed immediately.',
      testing: {
        upgradeAvailable: true,
        targetTier,
        currentTier,
      },
    });
  }
  
  // Handle hobby to pro upgrade
  if (currentTier === 'hobby' && targetTier === 'pro') {
    // TODO: Create Stripe checkout session
    // For now, return placeholder response
    
    // DEVELOPMENT MODE: Allow immediate upgrade for testing
    const developmentMode = process.env.NODE_ENV !== 'production';
    
    if (developmentMode) {
      // Update user tier directly for testing
      await updateUserTier(authUser.userId, targetTier);
      
      return c.json({
        success: true,
        message: 'Tier upgraded successfully (development mode)',
        tier: targetTier,
        tierName: targetConfig.displayName,
        price: targetConfig.price,
        limits: targetConfig.limits,
        features: targetConfig.features,
        note: 'In production, this would redirect to Stripe checkout',
      });
    }
    
    return c.json({
      success: true,
      message: 'Pro tier upgrade initiated',
      tier: targetTier,
      tierName: targetConfig.displayName,
      price: targetConfig.price,
      // TODO: Replace with actual Stripe checkout URL
      checkoutUrl: null,
      stripeSessionId: null,
      note: 'Stripe integration pending. Contact support to complete upgrade.',
    });
  }
  
  // Fallback for any other upgrade path
  return c.json({
    success: true,
    message: 'Upgrade request received',
    currentTier,
    targetTier,
    stripeIntegration: 'pending',
    note: 'Stripe integration will be available soon',
  });
});

/**
 * POST /api/v1/billing/downgrade
 * Downgrade to a lower tier
 * Requires authentication
 * 
 * Note: Downgrades typically take effect at end of billing period
 */
billingRoutes.post('/downgrade', requireAuth, async (c) => {
  const authUser = getAuthUser(c);
  
  if (!authUser) {
    throw new UnauthorizedError('Not authenticated');
  }
  
  // Parse request body
  let body: { tier?: unknown };
  try {
    body = await c.req.json();
  } catch {
    throw new ValidationError('Invalid JSON body');
  }
  
  // Validate tier
  if (!body.tier || typeof body.tier !== 'string') {
    throw new ValidationError('Missing required field: tier', {
      field: 'tier',
      validOptions: Object.keys(TIERS),
    });
  }
  
  const targetTier = body.tier.toLowerCase() as TierName;
  
  if (!(targetTier in TIERS)) {
    throw new ValidationError(`Invalid tier: ${body.tier}`, {
      field: 'tier',
      validOptions: Object.keys(TIERS),
    });
  }
  
  // Get current user
  const user = await findUserById(authUser.userId);
  if (!user) {
    throw new UnauthorizedError('User not found');
  }
  
  const currentTier = user.tier as TierName;
  
  // Check if this is actually a downgrade
  const comparison = compareTiers(currentTier, targetTier);
  
  if (comparison <= 0) {
    throw new ValidationError('Downgrade to higher or same tier not allowed', {
      currentTier,
      requestedTier: targetTier,
    });
  }
  
  // Downgrade to hobby is always allowed
  if (targetTier === 'hobby') {
    // DEVELOPMENT MODE: Allow immediate downgrade for testing
    const developmentMode = process.env.NODE_ENV !== 'production';
    
    if (developmentMode) {
      await updateUserTier(authUser.userId, targetTier);
      const targetConfig = getTierConfig(targetTier);
      
      return c.json({
        success: true,
        message: 'Tier downgraded successfully (development mode)',
        tier: targetTier,
        tierName: targetConfig.displayName,
        note: 'In production, this would take effect at end of billing period',
      });
    }
    
    return c.json({
      success: true,
      message: 'Downgrade scheduled for end of billing period',
      currentTier,
      targetTier,
      effectiveDate: null, // TODO: Calculate from Stripe subscription
      note: 'Stripe integration pending',
    });
  }
  
  throw new NotImplementedError('Tier downgrade');
});

/**
 * POST /api/v1/billing/cancel
 * Cancel subscription (downgrade to hobby at end of period)
 * Requires authentication
 */
billingRoutes.post('/cancel', requireAuth, async (c) => {
  const authUser = getAuthUser(c);
  
  if (!authUser) {
    throw new UnauthorizedError('Not authenticated');
  }
  
  const user = await findUserById(authUser.userId);
  if (!user) {
    throw new UnauthorizedError('User not found');
  }
  
  const currentTier = user.tier as TierName;
  
  if (currentTier === 'hobby') {
    throw new ValidationError('No active subscription to cancel', {
      currentTier,
    });
  }
  
  // TODO: Implement Stripe subscription cancellation
  
  return c.json({
    success: true,
    message: 'Subscription cancellation requested',
    currentTier,
    note: 'Stripe integration pending. Contact support to cancel.',
  });
});

/**
 * GET /api/v1/billing/compare
 * Compare current tier with another tier
 * Requires authentication
 */
billingRoutes.get('/compare/:tier', requireAuth, loadTierInfo, async (c) => {
  const authUser = getAuthUser(c);
  
  if (!authUser) {
    throw new UnauthorizedError('Not authenticated');
  }
  
  const targetTierParam = c.req.param('tier').toLowerCase() as TierName;
  
  if (!(targetTierParam in TIERS)) {
    throw new ValidationError(`Invalid tier: ${targetTierParam}`, {
      validTiers: Object.keys(TIERS),
    });
  }
  
  const currentTier = getUserTier(c);
  const currentConfig = getTierConfig(currentTier);
  const targetConfig = getTierConfig(targetTierParam);
  
  const comparison = compareTiers(currentTier, targetTierParam);
  
  const changes: {
    feature: string;
    current: any;
    target: any;
    improvement: boolean;
  }[] = [];
  
  // Compare limits
  if (currentConfig.limits.callsPerDay !== targetConfig.limits.callsPerDay) {
    changes.push({
      feature: 'Daily API Calls',
      current: currentConfig.limits.callsPerDay ?? 'Unlimited',
      target: targetConfig.limits.callsPerDay ?? 'Unlimited',
      improvement: comparison < 0,
    });
  }
  
  if (currentConfig.limits.charsPerMemo !== targetConfig.limits.charsPerMemo) {
    changes.push({
      feature: 'Characters per Memo',
      current: currentConfig.limits.charsPerMemo ?? 'Unlimited',
      target: targetConfig.limits.charsPerMemo ?? 'Unlimited',
      improvement: comparison < 0,
    });
  }
  
  // Compare features
  if (currentConfig.features.tts !== targetConfig.features.tts) {
    changes.push({
      feature: 'TTS Engine',
      current: currentConfig.features.tts,
      target: targetConfig.features.tts,
      improvement: comparison < 0,
    });
  }
  
  if (currentConfig.features.priority !== targetConfig.features.priority) {
    changes.push({
      feature: 'Priority Processing',
      current: currentConfig.features.priority ? 'Yes' : 'No',
      target: targetConfig.features.priority ? 'Yes' : 'No',
      improvement: targetConfig.features.priority,
    });
  }
  
  if (currentConfig.features.voiceCloning !== targetConfig.features.voiceCloning) {
    changes.push({
      feature: 'Voice Cloning',
      current: currentConfig.features.voiceCloning ? 'Yes' : 'No',
      target: targetConfig.features.voiceCloning ? 'Yes' : 'No',
      improvement: targetConfig.features.voiceCloning,
    });
  }
  
  return c.json({
    success: true,
    comparison: {
      isUpgrade: comparison < 0,
      isDowngrade: comparison > 0,
      isSameTier: comparison === 0,
      currentTier: {
        name: currentTier,
        displayName: currentConfig.displayName,
        price: currentConfig.price,
      },
      targetTier: {
        name: targetTierParam,
        displayName: targetConfig.displayName,
        price: targetConfig.price,
      },
      changes,
    },
  });
});