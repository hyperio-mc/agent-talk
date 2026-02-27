/**
 * Stripe Integration Service
 * 
 * Handles Stripe checkout, customer portal, and subscription management.
 */

import Stripe from 'stripe';
import { 
  findUserById, 
  updateUserTier 
} from '../db/users.js';
import {
  createSubscription,
  getSubscriptionByUserId,
  getSubscriptionByStripeCustomerId,
  getSubscriptionByStripeId,
  updateSubscription,
  SubscriptionTier,
  SubscriptionStatus,
} from '../db/subscriptions.js';
import { TIERS, TierName } from '../config/tiers.js';
import { logger } from '../utils/logger.js';

// Initialize Stripe
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;
const STRIPE_PRO_PRICE_ID = process.env.STRIPE_PRO_PRICE_ID;

// Price ID to tier mapping
const PRICE_TO_TIER: Record<string, TierName> = {
  [STRIPE_PRO_PRICE_ID || '']: 'pro',
  // Add more price IDs here for other tiers
};

// Get Stripe client (lazy initialization)
let stripeClient: Stripe | null = null;

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
  return !!(STRIPE_SECRET_KEY && STRIPE_WEBHOOK_SECRET && STRIPE_PRO_PRICE_ID);
}

/**
 * Get or create a Stripe customer for a user
 */
export async function getOrCreateCustomer(userId: string, email: string): Promise<string> {
  const stripe = getStripe();
  if (!stripe) {
    throw new Error('Stripe is not configured');
  }

  // Check if user already has a subscription record with Stripe customer ID
  const existingSubscription = await getSubscriptionByUserId(userId);
  
  if (existingSubscription?.stripe_customer_id) {
    return existingSubscription.stripe_customer_id;
  }

  // Create new customer in Stripe
  const customer = await stripe.customers.create({
    email,
    metadata: {
      userId,
    },
  });

  // Create subscription record (placeholder - no subscription yet)
  await createSubscription({
    userId,
    stripeSubscriptionId: '', // Will be updated when subscription is created
    stripeCustomerId: customer.id,
    tier: 'hobby',
  });

  logger.info('Created Stripe customer', { 
    userId, 
    customerId: customer.id 
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
  const stripe = getStripe();
  if (!stripe) {
    throw new Error('Stripe is not configured');
  }

  if (!STRIPE_PRO_PRICE_ID) {
    throw new Error('Stripe Pro price ID is not configured');
  }

  // Get or create Stripe customer
  const customerId = await getOrCreateCustomer(userId, email);

  // Create checkout session
  const session = await stripe.checkout.sessions.create({
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

  logger.info('Created checkout session', { 
    userId, 
    sessionId: session.id,
    customerId 
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
  const stripe = getStripe();
  if (!stripe) {
    throw new Error('Stripe is not configured');
  }

  // Get customer ID from subscription record
  const subscription = await getSubscriptionByUserId(userId);
  
  if (!subscription?.stripe_customer_id) {
    throw new Error('No Stripe customer found for user');
  }

  // Create portal session
  const session = await stripe.billingPortal.sessions.create({
    customer: subscription.stripe_customer_id,
    return_url: returnUrl,
  });

  logger.info('Created portal session', { 
    userId, 
    customerId: subscription.stripe_customer_id 
  });

  return session.url;
}

/**
 * Handle checkout.session.completed webhook
 */
export async function handleCheckoutComplete(
  session: Stripe.Checkout.Session
): Promise<void> {
  const stripe = getStripe();
  if (!stripe) return;

  const userId = session.metadata?.userId;
  const tier = session.metadata?.tier as TierName;

  if (!userId || !tier) {
    logger.error('Checkout session missing metadata', { sessionId: session.id });
    return;
  }

  const customerId = session.customer as string;
  const subscriptionId = session.subscription as string;

  // Get subscription details from Stripe
  const stripeSubscription = await stripe.subscriptions.retrieve(subscriptionId);
  const priceId = stripeSubscription.items.data[0]?.price.id;

  // Get or create subscription record
  let subscription = await getSubscriptionByStripeCustomerId(customerId);

  const periodStart = (stripeSubscription as any).current_period_start;
  const periodEnd = (stripeSubscription as any).current_period_end;

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
  const priceId = stripeSubscription.items.data[0]?.price.id;

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
  const stripe = getStripe();
  if (!stripe) {
    throw new Error('Stripe is not configured');
  }

  const subscription = await getSubscriptionByUserId(userId);
  
  if (!subscription?.stripe_subscription_id) {
    throw new Error('No active subscription found');
  }

  // Cancel at period end (don't immediately cancel)
  await stripe.subscriptions.update(subscription.stripe_subscription_id, {
    cancel_at_period_end: true,
  });

  // Update local record
  await updateSubscription(subscription.id, {
    cancel_at_period_end: true,
  });

  logger.info('Subscription scheduled for cancellation', { 
    userId,
    subscriptionId: subscription.stripe_subscription_id 
  });
}

// Alias for compatibility
export const cancelSubscription = cancelSubscriptionService;

/**
 * Reactivate a subscription (undo cancellation)
 */
export async function reactivateSubscription(userId: string): Promise<void> {
  const stripe = getStripe();
  if (!stripe) {
    throw new Error('Stripe is not configured');
  }

  const subscription = await getSubscriptionByUserId(userId);
  
  if (!subscription?.stripe_subscription_id) {
    throw new Error('No subscription found');
  }

  // Remove cancellation schedule
  await stripe.subscriptions.update(subscription.stripe_subscription_id, {
    cancel_at_period_end: false,
  });

  // Update local record
  await updateSubscription(subscription.id, {
    cancel_at_period_end: false,
  });

  logger.info('Subscription reactivated', { 
    userId,
    subscriptionId: subscription.stripe_subscription_id 
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
 */
export function verifyWebhookSignature(
  payload: string | Buffer,
  signature: string
): Stripe.Event | null {
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