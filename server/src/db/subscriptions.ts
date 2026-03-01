/**
 * Subscriptions Database Operations
 */

import { getDb } from './index.js';
import { v4 as uuidv4 } from 'uuid';

export interface Subscription {
  id: string;
  user_id: string;
  stripe_customer_id: string;
  stripe_subscription_id: string | null;
  stripe_price_id: string | null;
  status: string;
  tier: string;
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  canceled_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateSubscriptionData {
  userId: string;
  stripeCustomerId: string;
  stripeSubscriptionId?: string;
  stripePriceId?: string;
  status?: string;
  tier?: string;
  currentPeriodStart?: string;
  currentPeriodEnd?: string;
  current_period_start?: string;
  current_period_end?: string;
}

/**
 * Create a subscription
 */
export async function createSubscription(data: CreateSubscriptionData): Promise<Subscription> {
  const db = getDb();
  const id = uuidv4();
  const now = new Date().toISOString();
  
  db.prepare(`
    INSERT INTO subscriptions (id, user_id, stripe_customer_id, stripe_subscription_id, 
      stripe_price_id, status, tier, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, data.userId, data.stripeCustomerId, data.stripeSubscriptionId || null,
    data.stripePriceId || null, data.status || 'active', data.tier || 'hobby', now, now);
  
  return {
    id,
    user_id: data.userId,
    stripe_customer_id: data.stripeCustomerId,
    stripe_subscription_id: data.stripeSubscriptionId || null,
    stripe_price_id: data.stripePriceId || null,
    status: data.status || 'active',
    tier: data.tier || 'hobby',
    current_period_start: null,
    current_period_end: null,
    cancel_at_period_end: false,
    canceled_at: null,
    created_at: now,
    updated_at: now,
  };
}

/**
 * Find subscription by user ID
 */
export async function findSubscriptionByUserId(userId: string): Promise<Subscription | null> {
  const db = getDb();
  const row = db.prepare('SELECT * FROM subscriptions WHERE user_id = ?').get(userId) as any;
  return row || null;
}

/**
 * Find subscription by Stripe customer ID
 */
export async function findSubscriptionByStripeCustomerId(customerId: string): Promise<Subscription | null> {
  const db = getDb();
  const row = db.prepare('SELECT * FROM subscriptions WHERE stripe_customer_id = ?').get(customerId) as any;
  return row || null;
}

/**
 * Update subscription
 */
export async function updateSubscription(id: string, data: Partial<Subscription>): Promise<Subscription | null> {
  const db = getDb();
  const now = new Date().toISOString();
  
  const fields: string[] = [];
  const values: any[] = [];
  
  if (data.status !== undefined) { fields.push('status = ?'); values.push(data.status); }
  if (data.tier !== undefined) { fields.push('tier = ?'); values.push(data.tier); }
  if (data.stripe_subscription_id !== undefined) { fields.push('stripe_subscription_id = ?'); values.push(data.stripe_subscription_id); }
  if (data.stripe_price_id !== undefined) { fields.push('stripe_price_id = ?'); values.push(data.stripe_price_id); }
  if (data.current_period_start !== undefined) { fields.push('current_period_start = ?'); values.push(data.current_period_start); }
  if (data.current_period_end !== undefined) { fields.push('current_period_end = ?'); values.push(data.current_period_end); }
  if (data.cancel_at_period_end !== undefined) { fields.push('cancel_at_period_end = ?'); values.push(data.cancel_at_period_end ? 1 : 0); }
  if (data.canceled_at !== undefined) { fields.push('canceled_at = ?'); values.push(data.canceled_at); }
  
  fields.push('updated_at = ?');
  values.push(now);
  values.push(id);
  
  db.prepare(`UPDATE subscriptions SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  
  return findSubscriptionById(id);
}

/**
 * Find subscription by ID
 */
export async function findSubscriptionById(id: string): Promise<Subscription | null> {
  const db = getDb();
  const row = db.prepare('SELECT * FROM subscriptions WHERE id = ?').get(id) as any;
  return row || null;
}

// Aliases for backward compatibility
export const getSubscriptionByUserId = findSubscriptionByUserId;
export const getSubscriptionByStripeCustomerId = findSubscriptionByStripeCustomerId;
export const getSubscriptionByStripeId = findSubscriptionById;


// Type aliases
export type SubscriptionTier = "hobby" | "pro" | "enterprise";
export type SubscriptionStatus = "active" | "canceled" | "past_due" | "unpaid" | "incomplete" | "trialing";
