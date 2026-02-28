/**
 * Stripe Integration Service
 * 
 * Handles Stripe checkout, customer portal, and subscription management.
 * Uses HYPR proxy for all Stripe API calls in production.
 * 
 * @see HYPR-REFACTOR-PLAN.md Phase 6 - Billing
 */

import Stripe from 'stripe';
import { 
  findUserById, 
  updateUserTier 
} from '../db-stub/users.js';
import {
  createSubscription,
  getSubscriptionByUserId,
  getSubscriptionByStripeCustomerId,
  getSubscriptionByStripeId,
  updateSubscription,
  SubscriptionTier,
  SubscriptionStatus,
} from '../db-stub/subscriptions.js';
import { TIERS, TierName } from '../config/tiers.js';
import { logger } from '../utils/logger.js';
import { getProxyClient, HyprProxyClient } from '../lib/hypr-proxy.js';
import { getHyprConfig } from '../lib/hypr-config.js';

// Stripe configuration
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;
const STRIPE_PRO_PRICE_ID = process.env.STRIPE_PRO_PRICE_ID;
const USE_HYPR_PROXY = process.env.USE_HYPR_PROXY === 'true' || process.env.HYPR_MODE === 'production';

// Price ID to tier mapping
const PRICE_TO_TIER: Record<string, TierName> = {
  [STRIPE_PRO_PRICE_ID || '']: 'pro',
  // Add more price IDs here for other tiers
};

// Stripe client for webhook verification (uses SDK directly)
let stripeClient: Stripe | null = null;

/**
 * Get Stripe SDK client (for webhook verification only)
 * In production, all Stripe API calls go through HYPR proxy
 */
export function getStripe(): Stripe | null {
  if (!STRIPE_SECRET_KEY) {
    return null;
  }
  if (!stripeClient) {
    stripeClient = new Stripe(STRIPE_SECRET_KEY, {
      apiVersion: '2026-02-25.clover' as Stripe.LatestApiVersion,
    });
  }
  return stripeClient;
}

/**
 * Check if Stripe is configured
 */
export function isStripeConfigured(): boolean {
  // In HYPR mode, STRIPE_SECRET_KEY is injected via proxy
  // We still need STRIPE_WEBHOOK_SECRET and STRIPE_PRO_PRICE_ID locally
  if (USE_HYPR_PROXY) {
    return !!(STRIPE_WEBHOOK_SECRET && STRIPE_PRO_PRICE_ID);
  }
  return !!(STRIPE_SECRET_KEY && STRIPE_WEBHOOK_SECRET && STRIPE_PRO_PRICE_ID);
}

/**
 * Stripe API client using HYPR proxy
 */
class StripeProxyClient {
  private proxy: HyprProxyClient;

  constructor() {
    this.proxy = getProxyClient();
  }

  /**
   * Create a Stripe customer
   */
  async createCustomer(email: string, metadata: Record<string, string>): Promise<{ id: string }> {
    const response = await this.proxy.stripe('/v1/customers', {
      method: 'POST',
      body: {
        email,
        metadata,
      },
    });

    if (response.status !== 200 && response.status !== 201) {
      const error = response.data as any;
      throw new Error(error.error?.message || 'Failed to create customer');
    }

    return response.data as { id: string };
  }

  /**
   * Create a checkout session
   */
  async createCheckoutSession(params: {
    customer: string;
    mode: 'subscription';
    payment_method_types: string[];
    line_items: Array<{ price: string; quantity: number }>;
    success_url: string;
    cancel_url: string;
    metadata: Record<string, string>;
    subscription_data?: { metadata: Record<string, string> };
  }): Promise<{ id: string; url: string | null }> {
    const response = await this.proxy.stripe('/v1/checkout/sessions', {
      method: 'POST',
      body: params,
    });

    if (response.status !== 200 && response.status !== 201) {
      const error = response.data as any;
      throw new Error(error.error?.message || 'Failed to create checkout session');
    }

    return response.data as { id: string; url: string | null };
  }

  /**
   * Create a billing portal session
   */
  async createPortalSession(params: {
    customer: string;
    return_url: string;
  }): Promise<{ url: string }> {
    const response = await this.proxy.stripe('/v1/billing_portal/sessions', {
      method: 'POST',
      body: params,
    });

    if (response.status !== 200 && response.status !== 201) {
      const error = response.data as any;
      throw new Error(error.error?.message || 'Failed to create portal session');
    }

    return response.data as { url: string };
  }

  /**
   * Retrieve a subscription
   */
  async retrieveSubscription(subscriptionId: string): Promise<any> {
    const response = await this.proxy.stripe(`/v1/subscriptions/${subscriptionId}`, {
      method: 'GET',
    });

    if (response.status !== 200) {
      const error = response.data as any;
      throw new Error(error.error?.message || 'Failed to retrieve subscription');
    }

    return response.data;
  }

  /**
   * Update a subscription
   */
  async updateSubscription(subscriptionId: string, params: Record<string, any>): Promise<any> {
    const response = await this.proxy.stripe(`/v1/subscriptions/${subscriptionId}`, {
      method: 'POST',
      body: params,
    });

    if (response.status !== 200) {
      const error = response.data as any;
      throw new Error(error.error?.message || 'Failed to update subscription');
    }

    return response.data;
  }
}

// Singleton proxy client
let stripeProxyClient: StripeProxyClient | null = null;

/**
 * Get Stripe proxy client instance
 */
function getStripeProxy(): StripeProxyClient {
  if (!stripeProxyClient) {
    stripeProxyClient = new StripeProxyClient();
  }
  return stripeProxyClient;
}

/**
 * Get or create a Stripe customer for a user
 */
export async function getOrCreateCustomer(userId: string, email: string): Promise<string> {
  // Check if user already has a subscription record with Stripe customer ID
  const existingSubscription = await getSubscriptionByUserId(userId);
  
  if (existingSubscription?.stripe_customer_id) {
    return existingSubscription.stripe_customer_id;
  }

  // Create new customer in Stripe
  let customer: { id: string };
  
  if (USE_HYPR_PROXY) {
    // Use HYPR proxy
    const proxy = getStripeProxy();
    customer = await proxy.createCustomer(email, { userId });
  } else {
    // Use SDK directly (development mode)
    const stripe = getStripe();
    if (!stripe) {
      throw new Error('Stripe is not configured');
    }
    customer = await stripe.customers.create({
      email,
      metadata: { userId },
    });
  }

  // Create subscription record (placeholder - no subscription yet)
  await createSubscription({
    userId,
    stripeSubscriptionId: '',
    stripeCustomerId: customer.id,
    tier: 'hobby',
  });

  logger.info('Created Stripe customer', { 
    userId, 
    customerId: customer.id,
    viaProxy: USE_HYPR_PROXY
  });

  return customer.id;
}

/**
 * Create a Stripe checkout session for Pro tier upgrade
 */
export async function createCheckoutSession(
  userId: string, 
  email: string,
  successUrl: string,
  cancelUrl: string
): Promise<{ url: string; sessionId: string }> {
  if (!STRIPE_PRO_PRICE_ID) {
    throw new Error('Stripe Pro price ID is not configured');
  }

  // Get or create Stripe customer
  const customerId = await getOrCreateCustomer(userId, email);

  let session: { id: string; url: string | null };

  if (USE_HYPR_PROXY) {
    // Use HYPR proxy
    const proxy = getStripeProxy();
    session = await proxy.createCheckoutSession({
      customer: customerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: STRIPE_PRO_PRICE_ID,
          quantity: 1,
        },
      ],
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        userId,
        tier: 'pro',
      },
      subscription_data: {
        metadata: {
          userId,
          tier: 'pro',
        },
      },
    });
  } else {
    // Use SDK directly (development mode)
    const stripe = getStripe();
    if (!stripe) {
      throw new Error('Stripe is not configured');
    }

    const stripeSession = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: STRIPE_PRO_PRICE_ID,
          quantity: 1,
        },
      ],
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        userId,
        tier: 'pro',
      },
      subscription_data: {
        metadata: {
          userId,
          tier: 'pro',
        },
      },
    });

    session = {
      id: stripeSession.id,
      url: stripeSession.url,
    };
  }

  logger.info('Created checkout session', { 
    userId, 
    sessionId: session.id,
    customerId,
    viaProxy: USE_HYPR_PROXY
  });

  return {
    url: session.url || '',
    sessionId: session.id,
  };
}

/**
 * Create a Stripe customer portal session
 */
export async function createPortalSession(
  userId: string,
  returnUrl: string
): Promise<string> {
  // Get customer ID from subscription record
  const subscription = await getSubscriptionByUserId(userId);
  
  if (!subscription?.stripe_customer_id) {
    throw new Error('No Stripe customer found for user');
  }

  let portalUrl: string;

  if (USE_HYPR_PROXY) {
    // Use HYPR proxy
    const proxy = getStripeProxy();
    const session = await proxy.createPortalSession({
      customer: subscription.stripe_customer_id,
      return_url: returnUrl,
    });
    portalUrl = session.url;
  } else {
    // Use SDK directly (development mode)
    const stripe = getStripe();
    if (!stripe) {
      throw new Error('Stripe is not configured');
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: subscription.stripe_customer_id,
      return_url: returnUrl,
    });
    portalUrl = session.url;
  }

  logger.info('Created portal session', { 
    userId, 
    customerId: subscription.stripe_customer_id,
    viaProxy: USE_HYPR_PROXY
  });

  return portalUrl;
}

/**
 * Handle checkout.session.completed webhook
 */
export async function handleCheckoutComplete(
  session: Stripe.Checkout.Session
): Promise<void> {
  const userId = session.metadata?.userId;
  const tier = session.metadata?.tier as TierName;

  if (!userId || !tier) {
    logger.error('Checkout session missing metadata', { sessionId: session.id });
    return;
  }

  const customerId = session.customer as string;
  const subscriptionId = session.subscription as string;

  // Get subscription details from Stripe
  let stripeSubscription: any;

  if (USE_HYPR_PROXY) {
    const proxy = getStripeProxy();
    stripeSubscription = await proxy.retrieveSubscription(subscriptionId);
  } else {
    const stripe = getStripe();
    if (!stripe) return;
    stripeSubscription = await stripe.subscriptions.retrieve(subscriptionId);
  }

  const priceId = stripeSubscription.items?.data?.[0]?.price?.id;

  // Get or create subscription record
  let subscription = await getSubscriptionByStripeCustomerId(customerId);

  const periodStart = stripeSubscription.current_period_start;
  const periodEnd = stripeSubscription.current_period_end;

  if (!subscription) {
    subscription = await createSubscription({
      userId,
      stripeCustomerId: customerId,
      stripeSubscriptionId: subscriptionId,
      tier,
      status: mapStripeStatusToLocal(stripeSubscription.status),
      currentPeriodStart: periodStart ? new Date(periodStart * 1000).toISOString() : undefined,
      currentPeriodEnd: periodEnd ? new Date(periodEnd * 1000).toISOString() : undefined,
    });
  } else {
    // Update existing subscription
    await updateSubscription(subscription.id, {
      tier,
      status: mapStripeStatusToLocal(stripeSubscription.status),
      current_period_start: periodStart ? new Date(periodStart * 1000).toISOString() : undefined,
      current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : undefined,
    });
  }

  // Update user tier
  await updateUserTier(userId, tier);

  logger.info('Checkout completed, user upgraded', { 
    userId, 
    tier,
    subscriptionId,
    sessionId: session.id 
  });
}

/**
 * Handle subscription updated webhook
 */
export async function handleSubscriptionUpdated(
  subscription: Stripe.Subscription
): Promise<void> {
  const userId = subscription.metadata?.userId;
  const tier = subscription.metadata?.tier as TierName;

  if (!userId) {
    // Try to find by subscription ID
    const localSub = await getSubscriptionByStripeId(subscription.id);
    if (localSub) {
      await handleSubscriptionUpdate({ id: localSub.id, userId: localSub.user_id, user_id: localSub.user_id }, subscription);
    } else {
      logger.error('Subscription updated but no user found', { 
        subscriptionId: subscription.id 
      });
    }
    return;
  }

  // Find local subscription record
  const localSub = await getSubscriptionByUserId(userId);
  
  if (!localSub) {
    logger.error('No local subscription found for user', { userId });
    return;
  }

  await handleSubscriptionUpdate({ id: localSub.id, userId: localSub.user_id, user_id: localSub.user_id }, subscription);
}

async function handleSubscriptionUpdate(
  localSub: { id: string; userId: string; user_id?: string } | null,
  stripeSubscription: Stripe.Subscription
): Promise<void> {
  if (!localSub) return;

  const userId = localSub.userId || localSub.user_id;
  const tier = (stripeSubscription.metadata?.tier as TierName) || 'pro';
  const priceId = (stripeSubscription as any).items?.data?.[0]?.price?.id;

  // Use type assertion for Stripe subscription properties that may not be in the type
  const subData = stripeSubscription as any;
  const periodStart = subData.current_period_start;
  const periodEnd = subData.current_period_end;

  // Update subscription record
  await updateSubscription(localSub.id, {
    tier,
    status: mapStripeStatusToLocal(stripeSubscription.status),
    current_period_start: periodStart ? new Date(periodStart * 1000).toISOString() : undefined,
    current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : undefined,
    cancel_at_period_end: stripeSubscription.cancel_at_period_end,
  });

  // Update user tier based on subscription status
  if (userId) {
    if (stripeSubscription.status === 'active' || stripeSubscription.status === 'trialing') {
      await updateUserTier(userId, tier);
    } else if (stripeSubscription.status === 'canceled' || stripeSubscription.status === 'unpaid') {
      await updateUserTier(userId, 'hobby');
    }
  }

  logger.info('Subscription updated', { 
    userId,
    status: stripeSubscription.status,
    tier 
  });
}

/**
 * Handle subscription deleted webhook
 */
export async function handleSubscriptionDeleted(
  subscription: Stripe.Subscription
): Promise<void> {
  const userId = subscription.metadata?.userId;

  // Try to find by subscription ID if no userId in metadata
  let localSub: { id: string; userId?: string; user_id?: string } | null = null;
  
  if (userId) {
    localSub = await getSubscriptionByUserId(userId);
  } else {
    localSub = await getSubscriptionByStripeId(subscription.id);
  }

  if (!localSub) {
    logger.error('No local subscription found for deleted subscription', { 
      subscriptionId: subscription.id 
    });
    return;
  }

  // Update subscription record
  await updateSubscription(localSub.id, {
    status: 'canceled',
  });

  // Downgrade user to hobby
  const actualUserId = localSub.userId || localSub.user_id;
  if (actualUserId) {
    await updateUserTier(actualUserId, 'hobby');
  }

  logger.info('Subscription deleted, user downgraded', { 
    userId: actualUserId 
  });
}

/**
 * Handle customer subscription events (generic handler)
 */
export async function handleCustomerSubscription(
  subscription: Stripe.Subscription,
  eventType: string
): Promise<void> {
  switch (eventType) {
    case 'customer.subscription.created':
    case 'customer.subscription.updated':
      await handleSubscriptionUpdated(subscription);
      break;
    case 'customer.subscription.deleted':
      await handleSubscriptionDeleted(subscription);
      break;
    default:
      logger.info('Unhandled subscription event', { eventType });
  }
}

/**
 * Cancel a subscription (schedule cancellation at period end)
 */
export async function cancelSubscriptionService(userId: string): Promise<void> {
  const subscription = await getSubscriptionByUserId(userId);
  
  if (!subscription?.stripe_subscription_id) {
    throw new Error('No active subscription found');
  }

  // Cancel at period end (don't immediately cancel)
  if (USE_HYPR_PROXY) {
    const proxy = getStripeProxy();
    await proxy.updateSubscription(subscription.stripe_subscription_id, {
      cancel_at_period_end: true,
    });
  } else {
    const stripe = getStripe();
    if (!stripe) {
      throw new Error('Stripe is not configured');
    }
    await stripe.subscriptions.update(subscription.stripe_subscription_id, {
      cancel_at_period_end: true,
    });
  }

  // Update local record
  await updateSubscription(subscription.id, {
    cancel_at_period_end: true,
  });

  logger.info('Subscription scheduled for cancellation', { 
    userId,
    subscriptionId: subscription.stripe_subscription_id,
    viaProxy: USE_HYPR_PROXY
  });
}

// Alias for compatibility
export const cancelSubscription = cancelSubscriptionService;

/**
 * Reactivate a subscription (undo cancellation)
 */
export async function reactivateSubscription(userId: string): Promise<void> {
  const subscription = await getSubscriptionByUserId(userId);
  
  if (!subscription?.stripe_subscription_id) {
    throw new Error('No subscription found');
  }

  // Remove cancellation schedule
  if (USE_HYPR_PROXY) {
    const proxy = getStripeProxy();
    await proxy.updateSubscription(subscription.stripe_subscription_id, {
      cancel_at_period_end: false,
    });
  } else {
    const stripe = getStripe();
    if (!stripe) {
      throw new Error('Stripe is not configured');
    }
    await stripe.subscriptions.update(subscription.stripe_subscription_id, {
      cancel_at_period_end: false,
    });
  }

  // Update local record
  await updateSubscription(subscription.id, {
    cancel_at_period_end: false,
  });

  logger.info('Subscription reactivated', { 
    userId,
    subscriptionId: subscription.stripe_subscription_id,
    viaProxy: USE_HYPR_PROXY
  });
}

/**
 * Get subscription details for a user
 */
export async function getSubscriptionDetails(userId: string): Promise<{
  hasSubscription: boolean;
  tier: TierName;
  status: SubscriptionStatus | null;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
} | null> {
  const user = await findUserById(userId);
  if (!user) return null;

  const subscription = await getSubscriptionByUserId(userId);
  
  return {
    hasSubscription: !!subscription?.stripe_subscription_id,
    tier: user.tier as TierName,
    status: subscription?.status || null,
    stripeCustomerId: subscription?.stripe_customer_id || null,
    stripeSubscriptionId: subscription?.stripe_subscription_id || null,
    currentPeriodEnd: subscription?.current_period_end || null,
    cancelAtPeriodEnd: subscription?.cancel_at_period_end || false,
  };
}

/**
 * Verify Stripe webhook signature
 * 
 * Note: This still uses the Stripe SDK directly because webhooks come from
 * Stripe servers, not through our proxy. The webhook secret is set locally.
 */
export function verifyWebhookSignature(
  payload: string | Buffer,
  signature: string
): Stripe.Event | null {
  // Webhook verification must use SDK directly - webhooks come from Stripe
  const stripe = getStripe();
  if (!stripe || !STRIPE_WEBHOOK_SECRET) {
    logger.error('Stripe not configured for webhook verification');
    return null;
  }

  try {
    const event = stripe.webhooks.constructEvent(
      payload,
      signature,
      STRIPE_WEBHOOK_SECRET
    );
    return event;
  } catch (err) {
    logger.logError('Webhook signature verification failed', err);
    return null;
  }
}

/**
 * Map Stripe subscription status to local status
 */
function mapStripeStatusToLocal(status: Stripe.Subscription.Status): SubscriptionStatus {
  const mapping: Record<string, SubscriptionStatus> = {
    active: 'active',
    past_due: 'past_due',
    canceled: 'canceled',
    incomplete: 'incomplete',
    incomplete_expired: 'incomplete',
    trialing: 'active', // Treat trialing as active
    unpaid: 'canceled',
    paused: 'canceled',
  };
  return mapping[status] || 'active';
}

// Re-export types
export { Stripe };