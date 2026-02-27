/**
 * Subscription database operations
 * Handles user subscriptions with Stripe integration
 */

import { getMicroClient } from '../lib/hypr-micro.js';
import { isHyprMode } from './index.js';
import { logger } from '../utils/logger.js';

// Database collection name
const DB_NAMES = {
  SUBSCRIPTIONS: 'subscriptions',
} as const;

// Subscription tier types
export type SubscriptionTier = 'hobby' | 'pro' | 'enterprise';

// Subscription status types
export type SubscriptionStatus = 'active' | 'canceled' | 'past_due' | 'incomplete';

/**
 * Subscription record stored in database
 */
export interface Subscription {
  id: string;
  user_id: string;
  stripe_subscription_id: string;
  stripe_customer_id: string;
  status: SubscriptionStatus;
  tier: SubscriptionTier;
  current_period_start: string;
  current_period_end: string;
  cancel_at_period_end: boolean;
  created_at: string;
  updated_at: string;
  [key: string]: unknown; // Index signature for HYPR Micro compatibility
}

// In-memory fallback storage
const memorySubscriptions = new Map<string, Subscription>();

/**
 * Generate unique ID
 */
function generateId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 9);
  return `sub_${timestamp}_${random}`;
}

/**
 * Create a new subscription
 */
export async function createSubscription(data: {
  userId: string;
  stripeSubscriptionId: string;
  stripeCustomerId: string;
  tier?: SubscriptionTier;
  status?: SubscriptionStatus;
  currentPeriodStart?: string;
  currentPeriodEnd?: string;
}): Promise<Subscription> {
  const id = generateId();
  const now = new Date().toISOString();
  
  const subscription: Subscription = {
    id,
    user_id: data.userId,
    stripe_subscription_id: data.stripeSubscriptionId,
    stripe_customer_id: data.stripeCustomerId,
    status: data.status || 'active',
    tier: data.tier || 'hobby',
    current_period_start: data.currentPeriodStart || now,
    current_period_end: data.currentPeriodEnd || now,
    cancel_at_period_end: false,
    created_at: now,
    updated_at: now,
  };

  if (isHyprMode()) {
    try {
      await getMicroClient().insert(DB_NAMES.SUBSCRIPTIONS, subscription);
      logger.info('Subscription created in HYPR Micro', { id });
    } catch (error: unknown) {
      logger.error('Failed to create subscription in HYPR Micro', { 
        error: { 
          name: 'HyprMicroError', 
          message: error instanceof Error ? error.message : String(error) 
        } 
      });
      throw error;
    }
  } else {
    memorySubscriptions.set(id, subscription);
    logger.info('Subscription created in memory', { id });
  }

  return subscription;
}

/**
 * Get subscription by user ID
 */
export async function getSubscriptionByUserId(userId: string): Promise<Subscription | null> {
  if (isHyprMode()) {
    try {
      const subs = await getMicroClient().query<Subscription>(DB_NAMES.SUBSCRIPTIONS, { user_id: userId });
      // Return the most recent active subscription
      const active = subs.filter(s => s.status === 'active');
      return active[0] || subs[0] || null;
    } catch (error: unknown) {
      logger.error('Failed to get subscription from HYPR Micro', { 
        userId, 
        error: { 
          name: 'HyprMicroError', 
          message: error instanceof Error ? error.message : String(error) 
        } 
      });
      return null;
    }
  }
  
  const subs = Array.from(memorySubscriptions.values())
    .filter(s => s.user_id === userId);
  
  const active = subs.filter(s => s.status === 'active');
  return active[0] || subs[0] || null;
}

/**
 * Get subscription by Stripe customer ID
 */
export async function getSubscriptionByStripeCustomerId(stripeCustomerId: string): Promise<Subscription | null> {
  if (isHyprMode()) {
    try {
      const subs = await getMicroClient().query<Subscription>(DB_NAMES.SUBSCRIPTIONS, { stripe_customer_id: stripeCustomerId });
      return subs[0] || null;
    } catch (error: unknown) {
      logger.error('Failed to get subscription by Stripe Customer ID from HYPR Micro', { 
        stripeCustomerId, 
        error: { 
          name: 'HyprMicroError', 
          message: error instanceof Error ? error.message : String(error) 
        } 
      });
      return null;
    }
  }
  
  const sub = Array.from(memorySubscriptions.values())
    .find(s => s.stripe_customer_id === stripeCustomerId);
  return sub || null;
}

/**
 * Get subscription by Stripe subscription ID
 */
export async function getSubscriptionByStripeId(stripeSubscriptionId: string): Promise<Subscription | null> {
  if (isHyprMode()) {
    try {
      const subs = await getMicroClient().query<Subscription>(DB_NAMES.SUBSCRIPTIONS, { stripe_subscription_id: stripeSubscriptionId });
      return subs[0] || null;
    } catch (error: unknown) {
      logger.error('Failed to get subscription by Stripe Subscription ID from HYPR Micro', { 
        stripeSubscriptionId, 
        error: { 
          name: 'HyprMicroError', 
          message: error instanceof Error ? error.message : String(error) 
        } 
      });
      return null;
    }
  }
  
  const sub = Array.from(memorySubscriptions.values())
    .find(s => s.stripe_subscription_id === stripeSubscriptionId);
  return sub || null;
}

/**
 * Update subscription
 */
export async function updateSubscription(id: string, data: Partial<{
  status: SubscriptionStatus;
  tier: SubscriptionTier;
  current_period_start: string;
  current_period_end: string;
  cancel_at_period_end: boolean;
}>): Promise<Subscription | null> {
  if (isHyprMode()) {
    try {
      const updated = await getMicroClient().update<Subscription>(DB_NAMES.SUBSCRIPTIONS, id, {
        ...data,
        updated_at: new Date().toISOString(),
      });
      logger.info('Subscription updated in HYPR Micro', { id });
      return updated;
    } catch (error: unknown) {
      logger.error('Failed to update subscription in HYPR Micro', { 
        id, 
        error: { 
          name: 'HyprMicroError', 
          message: error instanceof Error ? error.message : String(error) 
        } 
      });
      return null;
    }
  }
  
  const sub = memorySubscriptions.get(id);
  if (!sub) return null;
  
  Object.assign(sub, data, { updated_at: new Date().toISOString() });
  memorySubscriptions.set(id, sub);
  return sub;
}

/**
 * Cancel subscription
 */
export async function cancelSubscription(id: string): Promise<boolean> {
  if (isHyprMode()) {
    try {
      await getMicroClient().update(DB_NAMES.SUBSCRIPTIONS, id, {
        status: 'canceled',
        cancel_at_period_end: true,
        updated_at: new Date().toISOString(),
      });
      logger.info('Subscription canceled in HYPR Micro', { id });
      return true;
    } catch (error: unknown) {
      logger.error('Failed to cancel subscription in HYPR Micro', { 
        id, 
        error: { 
          name: 'HyprMicroError', 
          message: error instanceof Error ? error.message : String(error) 
        } 
      });
      return false;
    }
  }
  
  const sub = memorySubscriptions.get(id);
  if (!sub) return false;
  
  sub.status = 'canceled';
  sub.cancel_at_period_end = true;
  sub.updated_at = new Date().toISOString();
  memorySubscriptions.set(id, sub);
  return true;
}

/**
 * Get all subscriptions
 */
export async function getAllSubscriptions(): Promise<Subscription[]> {
  if (isHyprMode()) {
    try {
      const { docs } = await getMicroClient().list<Subscription>(DB_NAMES.SUBSCRIPTIONS);
      return docs;
    } catch (error: unknown) {
      logger.error('Failed to get all subscriptions from HYPR Micro', { 
        error: { 
          name: 'HyprMicroError', 
          message: error instanceof Error ? error.message : String(error) 
        } 
      });
      return [];
    }
  }
  
  return Array.from(memorySubscriptions.values());
}