/**
 * Subscription Database Operations
 * Tracks Stripe subscriptions and customer data
 */

import { v4 as uuidv4 } from 'uuid';
import { getDb } from './index.js';

export type SubscriptionStatus = 
  | 'active'
  | 'past_due'
  | 'canceled'
  | 'incomplete'
  | 'incomplete_expired'
  | 'trialing'
  | 'unpaid'
  | 'paused';

export type SubscriptionTier = 'hobby' | 'pro' | 'enterprise';

export interface Subscription {
  id: string;
  userId: string;
  stripeCustomerId: string;
  stripeSubscriptionId: string | null;
  stripePriceId: string | null;
  status: SubscriptionStatus;
  tier: SubscriptionTier;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  canceledAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSubscriptionInput {
  userId: string;
  stripeCustomerId: string;
  stripeSubscriptionId?: string;
  stripePriceId?: string;
  status?: SubscriptionStatus;
  tier: SubscriptionTier;
  currentPeriodStart?: string;
  currentPeriodEnd?: string;
}

export interface UpdateSubscriptionInput {
  stripeSubscriptionId?: string;
  stripePriceId?: string;
  status?: SubscriptionStatus;
  tier?: SubscriptionTier;
  currentPeriodStart?: string;
  currentPeriodEnd?: string;
  cancelAtPeriodEnd?: boolean;
  canceledAt?: string;
}

/**
 * Create a new subscription record
 */
export function createSubscription(input: CreateSubscriptionInput): Subscription {
  const db = getDb();
  const id = `sub_${uuidv4().replace(/-/g, '').slice(0, 20)}`;
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO subscriptions (
      id, user_id, stripe_customer_id, stripe_subscription_id, stripe_price_id,
      status, tier, current_period_start, current_period_end, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    input.userId,
    input.stripeCustomerId,
    input.stripeSubscriptionId || null,
    input.stripePriceId || null,
    input.status || 'active',
    input.tier,
    input.currentPeriodStart || null,
    input.currentPeriodEnd || null,
    now,
    now
  );

  return {
    id,
    userId: input.userId,
    stripeCustomerId: input.stripeCustomerId,
    stripeSubscriptionId: input.stripeSubscriptionId || null,
    stripePriceId: input.stripePriceId || null,
    status: input.status || 'active',
    tier: input.tier,
    currentPeriodStart: input.currentPeriodStart || null,
    currentPeriodEnd: input.currentPeriodEnd || null,
    cancelAtPeriodEnd: false,
    canceledAt: null,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Find subscription by user ID
 */
export function findSubscriptionByUserId(userId: string): Subscription | null {
  const db = getDb();
  const row = db.prepare(`
    SELECT * FROM subscriptions 
    WHERE user_id = ? 
    ORDER BY created_at DESC 
    LIMIT 1
  `).get(userId) as any;

  if (!row) return null;

  return mapRowToSubscription(row);
}

/**
 * Find subscription by Stripe customer ID
 */
export function findSubscriptionByStripeCustomerId(stripeCustomerId: string): Subscription | null {
  const db = getDb();
  const row = db.prepare(`
    SELECT * FROM subscriptions 
    WHERE stripe_customer_id = ? 
    ORDER BY created_at DESC 
    LIMIT 1
  `).get(stripeCustomerId) as any;

  if (!row) return null;

  return mapRowToSubscription(row);
}

/**
 * Find subscription by Stripe subscription ID
 */
export function findSubscriptionByStripeSubscriptionId(stripeSubscriptionId: string): Subscription | null {
  const db = getDb();
  const row = db.prepare(`
    SELECT * FROM subscriptions 
    WHERE stripe_subscription_id = ?
  `).get(stripeSubscriptionId) as any;

  if (!row) return null;

  return mapRowToSubscription(row);
}

/**
 * Update subscription
 */
export function updateSubscription(id: string, input: UpdateSubscriptionInput): Subscription | null {
  const db = getDb();
  const sub = db.prepare('SELECT * FROM subscriptions WHERE id = ?').get(id) as any;
  
  if (!sub) return null;

  const now = new Date().toISOString();
  const updates: string[] = ['updated_at = ?'];
  const values: any[] = [now];

  if (input.stripeSubscriptionId !== undefined) {
    updates.push('stripe_subscription_id = ?');
    values.push(input.stripeSubscriptionId);
  }
  if (input.stripePriceId !== undefined) {
    updates.push('stripe_price_id = ?');
    values.push(input.stripePriceId);
  }
  if (input.status !== undefined) {
    updates.push('status = ?');
    values.push(input.status);
  }
  if (input.tier !== undefined) {
    updates.push('tier = ?');
    values.push(input.tier);
  }
  if (input.currentPeriodStart !== undefined) {
    updates.push('current_period_start = ?');
    values.push(input.currentPeriodStart);
  }
  if (input.currentPeriodEnd !== undefined) {
    updates.push('current_period_end = ?');
    values.push(input.currentPeriodEnd);
  }
  if (input.cancelAtPeriodEnd !== undefined) {
    updates.push('cancel_at_period_end = ?');
    values.push(input.cancelAtPeriodEnd ? 1 : 0);
  }
  if (input.canceledAt !== undefined) {
    updates.push('canceled_at = ?');
    values.push(input.canceledAt);
  }

  values.push(id);

  db.prepare(`
    UPDATE subscriptions 
    SET ${updates.join(', ')} 
    WHERE id = ?
  `).run(...values);

  return findSubscriptionById(id);
}

/**
 * Get subscription by ID
 */
export function findSubscriptionById(id: string): Subscription | null {
  const db = getDb();
  const row = db.prepare('SELECT * FROM subscriptions WHERE id = ?').get(id) as any;
  
  if (!row) return null;
  
  return mapRowToSubscription(row);
}

/**
 * Delete subscription
 */
export function deleteSubscription(id: string): boolean {
  const db = getDb();
  const result = db.prepare('DELETE FROM subscriptions WHERE id = ?').run(id);
  return result.changes > 0;
}

/**
 * Get or create Stripe customer for a user
 */
export function getOrCreateStripeCustomer(userId: string, email: string): { stripeCustomerId: string; isNew: boolean } {
  const existing = findSubscriptionByUserId(userId);
  
  if (existing && existing.stripeCustomerId) {
    return { stripeCustomerId: existing.stripeCustomerId, isNew: false };
  }

  return { stripeCustomerId: '', isNew: true };
}

/**
 * Maps database row to Subscription interface
 */
function mapRowToSubscription(row: any): Subscription {
  return {
    id: row.id,
    userId: row.user_id,
    stripeCustomerId: row.stripe_customer_id,
    stripeSubscriptionId: row.stripe_subscription_id,
    stripePriceId: row.stripe_price_id,
    status: row.status,
    tier: row.tier,
    currentPeriodStart: row.current_period_start,
    currentPeriodEnd: row.current_period_end,
    cancelAtPeriodEnd: row.cancel_at_period_end === 1,
    canceledAt: row.canceled_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}