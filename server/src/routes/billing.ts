/**
 * Billing Routes for Agent Talk API
 * 
 * Handles tier upgrades, subscription management, and billing info.
 * Stripe integration for Pro tier upgrades.
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
import { findUserById, updateUserTier } from '../db-stub/users.js';
import {
  ValidationError,
  UnauthorizedError,
  NotImplementedError,
} from '../errors/index.js';
import {
  isStripeConfigured,
  createCheckoutSession,
  createPortalSession,
  getSubscriptionDetails,
  cancelSubscription,
  reactivateSubscription,
} from '../services/stripe.js';
import { logger } from '../utils/logger.js';

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
billingRoutes.get('/subscription', requireAuth, async (c) => {
  const authUser = getAuthUser(c);
  
  if (!authUser) {
    throw new UnauthorizedError('Not authenticated');
  }
  
  const user = await findUserById(authUser.userId);
  
  if (!user) {
    throw new UnauthorizedError('User not found');
  }
  
  const currentTier = user.tier as TierName;
  const tierConfig = getTierConfig(currentTier);
  
  // Get subscription details from Stripe if available
  const subscriptionDetails = await getSubscriptionDetails(authUser.userId);
  
  return c.json({
    success: true,
    subscription: {
      tier: currentTier,
      tierName: tierConfig.displayName,
      price: tierConfig.price,
      limits: tierConfig.limits,
      features: tierConfig.features,
      stripeCustomerId: subscriptionDetails?.stripeCustomerId || null,
      stripeSubscriptionId: subscriptionDetails?.stripeSubscriptionId || null,
      currentPeriodStart: null, // We can add this if needed
      currentPeriodEnd: subscriptionDetails?.currentPeriodEnd || null,
      cancelAtPeriodEnd: subscriptionDetails?.cancelAtPeriodEnd || false,
      status: subscriptionDetails?.status || 'active',
    },
    user: {
      id: user.id,
      email: user.email,
      createdAt: user.createdAt,
    },
    billing: {
      stripeEnabled: isStripeConfigured(),
      canUpgrade: currentTier === 'hobby',
      canManageSubscription: subscriptionDetails?.hasSubscription || false,
    },
  });
});

/**
 * POST /api/v1/billing/checkout
 * Create a Stripe checkout session for Pro tier upgrade
 * Requires authentication
 */
billingRoutes.post('/checkout', requireAuth, async (c) => {
  const authUser = getAuthUser(c);
  
  if (!authUser) {
    throw new UnauthorizedError('Not authenticated');
  }
  
  // Check if Stripe is configured
  if (!isStripeConfigured()) {
    throw new ValidationError('Stripe is not configured. Please contact support.', {
      stripeEnabled: false,
    });
  }
  
  // Get current user
  const user = await findUserById(authUser.userId);
  if (!user) {
    throw new UnauthorizedError('User not found');
  }
  
  const currentTier = user.tier as TierName;
  
  // Check if already on Pro tier
  if (currentTier === 'pro') {
    throw new ValidationError('You are already on the Pro tier', {
      currentTier,
    });
  }
  
  // Check if on Enterprise (can't use checkout for upgrades)
  if (currentTier === 'enterprise') {
    throw new ValidationError('Enterprise tier cannot be managed via self-service', {
      currentTier,
      message: 'Please contact support for plan changes.',
    });
  }
  
  // Parse request body for optional success/cancel URLs
  let body: { successUrl?: string; cancelUrl?: string } = {};
  try {
    body = await c.req.json();
  } catch {
    // Use defaults
  }
  
  // Default URLs
  const baseUrl = process.env.BASE_URL || 'http://localhost:3001';
  const successUrl = body.successUrl || `${baseUrl}/dashboard?billing=success`;
  const cancelUrl = body.cancelUrl || `${baseUrl}/dashboard?billing=canceled`;
  
  try {
    const { url, sessionId } = await createCheckoutSession(
      authUser.userId,
      user.email,
      successUrl,
      cancelUrl
    );
    
    logger.info('Created checkout session', { 
      userId: authUser.userId,
      sessionId,
      tier: 'pro' 
    });
    
    return c.json({
      success: true,
      checkoutUrl: url,
      sessionId,
    });
  } catch (error) {
    logger.logError('Failed to create checkout session', error, { 
      userId: authUser.userId
    });
    throw new ValidationError('Failed to create checkout session', {
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/v1/billing/portal
 * Create a Stripe customer portal session for subscription management
 * Requires authentication
 */
billingRoutes.post('/portal', requireAuth, async (c) => {
  const authUser = getAuthUser(c);
  
  if (!authUser) {
    throw new UnauthorizedError('Not authenticated');
  }
  
  // Check if Stripe is configured
  if (!isStripeConfigured()) {
    throw new ValidationError('Stripe is not configured', {
      stripeEnabled: false,
    });
  }
  
  // Parse request body for optional return URL
  let body: { returnUrl?: string } = {};
  try {
    body = await c.req.json();
  } catch {
    // Use default
  }
  
  const baseUrl = process.env.BASE_URL || 'http://localhost:3001';
  const returnUrl = body.returnUrl || `${baseUrl}/dashboard`;
  
  try {
    const portalUrl = await createPortalSession(authUser.userId, returnUrl);
    
    return c.json({
      success: true,
      portalUrl,
    });
  } catch (error) {
    logger.error('Failed to create portal session', { 
      userId: authUser.userId,
      error: { name: error instanceof Error ? error.constructor.name : 'Error', message: error instanceof Error ? error.message : 'Unknown error' } 
    });
    
    // User might not have a subscription yet
    const message = error instanceof Error && error.message.includes('No Stripe customer')
      ? 'No subscription found. Please upgrade first.'
      : 'Failed to open billing portal';
    
    throw new ValidationError(message, {
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
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
  
  if (!isStripeConfigured()) {
    throw new ValidationError('Stripe is not configured', {
      stripeEnabled: false,
    });
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
  
  try {
    await cancelSubscription(authUser.userId);
    
    return c.json({
      success: true,
      message: 'Subscription will be canceled at the end of the current billing period',
      currentTier,
    });
  } catch (error) {
    logger.error('Failed to cancel subscription', { 
      userId: authUser.userId,
      error: { name: error instanceof Error ? error.constructor.name : 'Error', message: error instanceof Error ? error.message : 'Unknown error' } 
    });
    throw new ValidationError(
      error instanceof Error ? error.message : 'Failed to cancel subscription'
    );
  }
});

/**
 * POST /api/v1/billing/reactivate
 * Reactivate a canceled subscription
 * Requires authentication
 */
billingRoutes.post('/reactivate', requireAuth, async (c) => {
  const authUser = getAuthUser(c);
  
  if (!authUser) {
    throw new UnauthorizedError('Not authenticated');
  }
  
  if (!isStripeConfigured()) {
    throw new ValidationError('Stripe is not configured', {
      stripeEnabled: false,
    });
  }
  
  try {
    await reactivateSubscription(authUser.userId);
    
    return c.json({
      success: true,
      message: 'Subscription reactivated successfully',
    });
  } catch (error) {
    logger.error('Failed to reactivate subscription', { 
      userId: authUser.userId,
      error: { name: error instanceof Error ? error.constructor.name : 'Error', message: error instanceof Error ? error.message : 'Unknown error' } 
    });
    throw new ValidationError(
      error instanceof Error ? error.message : 'Failed to reactivate subscription'
    );
  }
});

/**
 * POST /api/v1/billing/upgrade
 * Upgrade to a higher tier (legacy endpoint - redirects to checkout)
 * Requires authentication
 */
billingRoutes.post('/upgrade', requireAuth, async (c) => {
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
    throw new ValidationError('Downgrade not supported via this endpoint. Use the billing portal.', {
      currentTier,
      requestedTier: targetTier,
    });
  }
  
  // Handle enterprise tier
  if (targetTier === 'enterprise') {
    return c.json({
      success: true,
      message: 'Enterprise tier requires custom setup',
      action: 'contact_sales',
      contactEmail: 'sales@onhyper.io',
    });
  }
  
  // Handle hobby to pro upgrade
  if (currentTier === 'hobby' && targetTier === 'pro') {
    // If Stripe is configured, redirect to checkout
    if (isStripeConfigured()) {
      const baseUrl = process.env.BASE_URL || 'http://localhost:3001';
      
      try {
        const { url, sessionId } = await createCheckoutSession(
          authUser.userId,
          user.email,
          `${baseUrl}/dashboard?billing=success`,
          `${baseUrl}/dashboard?billing=canceled`
        );
        
        return c.json({
          success: true,
          message: 'Pro tier upgrade initiated',
          tier: targetTier,
          tierName: targetConfig.displayName,
          price: targetConfig.price,
          checkoutUrl: url,
          sessionId,
        });
      } catch (error) {
        throw new ValidationError('Failed to create checkout session', {
          message: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
    
    // DEVELOPMENT MODE: Allow immediate upgrade for testing
    const developmentMode = process.env.NODE_ENV !== 'production';
    
    if (developmentMode) {
      await updateUserTier(authUser.userId, targetTier);
      
      return c.json({
        success: true,
        message: 'Tier upgraded successfully (development mode - Stripe not configured)',
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
      message: 'Pro tier upgrade requires payment',
      tier: targetTier,
      tierName: targetConfig.displayName,
      price: targetConfig.price,
      note: 'Stripe is not configured. Contact support to complete upgrade.',
      stripeEnabled: false,
    });
  }
  
  // Fallback for any other upgrade path
  return c.json({
    success: true,
    message: 'Upgrade request received',
    currentTier,
    targetTier,
    stripeEnabled: isStripeConfigured(),
  });
});

/**
 * POST /api/v1/billing/downgrade
 * Downgrade to a lower tier (schedule cancellation)
 * Requires authentication
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
  
  // If Stripe is configured, cancel the subscription
  if (isStripeConfigured()) {
    try {
      await cancelSubscription(authUser.userId);
      
      const targetConfig = getTierConfig(targetTier);
      
      return c.json({
        success: true,
        message: `Downgrade scheduled. You'll be moved to ${targetConfig.displayName} at the end of your billing period.`,
        currentTier,
        targetTier,
        effectiveDate: null, // Calculated from subscription
      });
    } catch (error) {
      throw new ValidationError(
        error instanceof Error ? error.message : 'Failed to schedule downgrade'
      );
    }
  }
  
  // Development mode: Allow immediate downgrade
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
    effectiveDate: null,
    note: 'Stripe integration pending',
  });
});

/**
 * GET /api/v1/billing/compare
 * Compare current tier with another tier
 * Requires authentication
 */
billingRoutes.get('/compare/:tier', requireAuth, async (c) => {
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
  
  const user = await findUserById(authUser.userId);
  if (!user) {
    throw new UnauthorizedError('User not found');
  }
  
  const currentTier = user.tier as TierName;
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
    billing: {
      stripeEnabled: isStripeConfigured(),
      checkoutAvailable: comparison < 0 && targetTierParam === 'pro',
      portalAvailable: !!await getSubscriptionDetails(authUser.userId).then(d => d?.hasSubscription),
    },
  });
});