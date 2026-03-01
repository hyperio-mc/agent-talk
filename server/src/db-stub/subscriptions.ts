/**
 * Subscriptions Database Stub
 * 
 * Hybrid implementation that uses HYPR Micro when available,
 * with in-memory fallback for development.
 * 
 * @see task-162-phase3-hypr-micro.md
 */

import { v4 as uuidv4 } from 'uuid';
import { isHyprMode, Subscriptions, Subscription as MicroSubscription } from '../lib/micro-tables.js';

export type SubscriptionTier = 'hobby' | 'pro' | 'enterprise';
export type SubscriptionStatus = 'active' | 'past_due' | 'canceled' | 'incomplete';

export interface Subscription {
  id: string;
  user_id: string;
  stripe_customer_id: string;
  stripe_subscription_id: string;
  tier: SubscriptionTier;
  status: SubscriptionStatus;
  current_period_start?: string;
  current_period_end?: string;
  cancel_at_period_end: boolean;
  created_at: string;
  updated_at: string;
  [key: string]: unknown;
}

export interface CreateSubscriptionData {
  userId: string;
  stripeCustomerId: string;
  stripeSubscriptionId?: string;
  tier?: SubscriptionTier;
  status?: SubscriptionStatus;
  currentPeriodStart?: string;
  currentPeriodEnd?: string;
}

export interface UpdateSubscriptionData {
  tier?: SubscriptionTier;
  status?: SubscriptionStatus;
  current_period_start?: string;
  current_period_end?: string;
  cancel_at_period_end?: boolean;
  [key: string]: unknown;
}

// In-memory storage for development (fallback)
const subscriptionStore = new Map<string, Subscription>();
const userSubscriptionIndex = new Map<string, string>();
const stripeCustomerIndex = new Map<string, string>();
const stripeSubscriptionIndex = new Map<string, string>();

/**
 * Convert between formats (both use snake_case)
 */
function toLegacySub(sub: MicroSubscription): Subscription {
  return sub;
}

function toMicroSub(sub: Subscription): MicroSubscription {
  return sub;
}

/**
 * Create a subscription record
 */
export async function createSubscription(data: CreateSubscriptionData): Promise<Subscription> {
  const id = uuidv4();
  const now = new Date().toISOString();
  
  const subscription: Subscription = {
    id,
    user_id: data.userId,
    stripe_customer_id: data.stripeCustomerId,
    stripe_subscription_id: data.stripeSubscriptionId || '',
    tier: data.tier || 'hobby',
    status: data.status || 'active',
    current_period_start: data.currentPeriodStart,
    current_period_end: data.currentPeriodEnd,
    cancel_at_period_end: false,
    created_at: now,
    updated_at: now,
  };
  
  // Use HYPR Micro in production
  if (isHyprMode()) {
    const microSub = await Subscriptions.create(toMicroSub(subscription));
    return toLegacySub(microSub);
  }
  
  // In-memory fallback
  subscriptionStore.set(id, subscription);
  userSubscriptionIndex.set(data.userId, id);
  
  if (data.stripeCustomerId) {
    stripeCustomerIndex.set(data.stripeCustomerId, id);
  }
  
  if (data.stripeSubscriptionId) {
    stripeSubscriptionIndex.set(data.stripeSubscriptionId, id);
  }
  
  return subscription;
}

/**
 * Get subscription by user ID
 */
export async function getSubscriptionByUserId(userId: string): Promise<Subscription | null> {
  // Use HYPR Micro in production
  if (isHyprMode()) {
    const sub = await Subscriptions.findByUserId(userId);
    return sub ? toLegacySub(sub) : null;
  }
  
  // In-memory fallback
  const id = userSubscriptionIndex.get(userId);
  if (!id) return null;
  return subscriptionStore.get(id) || null;
}

/**
 * Get subscription by Stripe customer ID
 */
export async function getSubscriptionByStripeCustomerId(stripeCustomerId: string): Promise<Subscription | null> {
  // Use HYPR Micro in production
  if (isHyprMode()) {
    const sub = await Subscriptions.findByStripeCustomerId(stripeCustomerId);
    return sub ? toLegacySub(sub) : null;
  }
  
  // In-memory fallback
  const id = stripeCustomerIndex.get(stripeCustomerId);
  if (!id) return null;
  return subscriptionStore.get(id) || null;
}

/**
 * Get subscription by Stripe subscription ID
 */
export async function getSubscriptionByStripeId(stripeSubscriptionId: string): Promise<Subscription | null> {
  // Use HYPR Micro in production
  if (isHyprMode()) {
    const sub = await Subscriptions.findByStripeSubscriptionId(stripeSubscriptionId);
    return sub ? toLegacySub(sub) : null;
  }
  
  // In-memory fallback
  const id = stripeSubscriptionIndex.get(stripeSubscriptionId);
  if (!id) return null;
  return subscriptionStore.get(id) || null;
}

/**
 * Update subscription
 */
export async function updateSubscription(id: string, data: UpdateSubscriptionData): Promise<Subscription | null> {
  // Use HYPR Micro in production
  if (isHyprMode()) {
    const sub = await Subscriptions.update(id, data);
    return sub ? toLegacySub(sub) : null;
  }
  
  // In-memory fallback
  const subscription = subscriptionStore.get(id);
  if (!subscription) return null;
  
  const updated: Subscription = {
    ...subscription,
    ...data,
    id,
    updated_at: new Date().toISOString(),
  };
  
  subscriptionStore.set(id, updated);
  
  return updated;
}

/**
 * Delete subscription
 */
export async function deleteSubscription(id: string): Promise<boolean> {
  // Use HYPR Micro in production
  if (isHyprMode()) {
    return Subscriptions.delete(id);
  }
  
  // In-memory fallback
  const subscription = subscriptionStore.get(id);
  if (!subscription) return false;
  
  subscriptionStore.delete(id);
  userSubscriptionIndex.delete(subscription.user_id);
  
  if (subscription.stripe_customer_id) {
    stripeCustomerIndex.delete(subscription.stripe_customer_id);
  }
  
  if (subscription.stripe_subscription_id) {
    stripeSubscriptionIndex.delete(subscription.stripe_subscription_id);
  }
  
  return true;
}

/**
 * Clear all subscriptions (for testing)
 */
export function clearSubscriptions(): void {
  subscriptionStore.clear();
  userSubscriptionIndex.clear();
  stripeCustomerIndex.clear();
  stripeSubscriptionIndex.clear();
}