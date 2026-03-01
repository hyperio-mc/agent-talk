/**
 * HYPR Micro Table Definitions
 * 
 * Defines schemas and helpers for agent-talk database tables.
 * These tables are stored in HYPR Micro (LMDB-backed cloud storage).
 * 
 * @see task-162-phase3-hypr-micro.md
 */

import { getMicroClient } from './hypr-micro.js';
import { logger } from '../utils/logger.js';

// ============================================================================
// Table Names
// ============================================================================

export const TABLES = {
  USERS: 'users',
  API_KEYS: 'api_keys',
  MEMOS: 'memos',
  USAGE_LOGS: 'usage_logs',
  SUBSCRIPTIONS: 'subscriptions',
} as const;

// ============================================================================
// Table Schemas (TypeScript Interfaces)
 // All interfaces include index signature for HYPR Micro compatibility
// ============================================================================

/**
 * Users table schema
 */
export interface User {
  id: string;
  email: string;
  password_hash?: string;
  tier: 'hobby' | 'pro' | 'enterprise';
  role: 'user' | 'admin';
  verification_token?: string;
  reset_token?: string;
  reset_token_expires?: string;
  created_at: string;
  updated_at: string;
  [key: string]: unknown;
}

/**
 * API Keys table schema
 */
export interface ApiKey {
  id: string;
  user_id: string;
  prefix: string;
  key_hash: string;
  name: string;
  usage_count: number;
  last_used_at: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  [key: string]: unknown;
}

/**
 * Memos table schema
 */
export interface Memo {
  id: string;
  user_id: string;
  text?: string;
  audio_url: string;
  duration_seconds: number;
  voice?: string;
  character_count?: number;
  title?: string;
  created_at: string;
  [key: string]: unknown;
}

/**
 * Usage Logs table schema
 */
export interface UsageLog {
  id: string;
  user_id: string;
  api_key_id: string | null;
  action: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
  [key: string]: unknown;
}

/**
 * Subscriptions table schema
 */
export interface Subscription {
  id: string;
  user_id: string;
  stripe_customer_id: string;
  stripe_subscription_id: string;
  tier: 'hobby' | 'pro' | 'enterprise';
  status: 'active' | 'past_due' | 'canceled' | 'incomplete';
  current_period_start?: string;
  current_period_end?: string;
  cancel_at_period_end: boolean;
  created_at: string;
  updated_at: string;
  [key: string]: unknown;
}

// ============================================================================
// Helper Functions for HYPR Mode Detection
// ============================================================================

/**
 * Check if running in HYPR mode (production)
 */
export function isHyprMode(): boolean {
  return process.env.HYPR_MODE === 'production' || 
         process.env.HYPR_URL !== undefined ||
         process.env.HYPERMICRO_API_KEY !== undefined;
}

// ============================================================================
// Table Initialization
// ============================================================================

/**
 * Initialize all required HYPR Micro tables
 */
export async function initMicroTables(): Promise<void> {
  const client = getMicroClient();
  
  try {
    // Get existing databases
    const existingDbs = await client.listDatabases();
    
    // Create tables that don't exist
    for (const tableName of Object.values(TABLES)) {
      if (!existingDbs.includes(tableName)) {
        logger.info(`Creating HYPR Micro table: ${tableName}`);
        await client.createDatabase(tableName);
      }
    }
    
    logger.info('HYPR Micro tables initialized');
  } catch (error) {
    const err = error as Error;
    logger.error('Failed to initialize HYPR Micro tables', { error: { name: err.name, message: err.message } });
    throw error;
  }
}

// ============================================================================
// Type-Safe Query Helpers
// ============================================================================

/**
 * Users table helpers
 */
export const Users = {
  async create(userData: Omit<User, 'created_at' | 'updated_at'>): Promise<User> {
    const client = getMicroClient();
    const now = new Date().toISOString();
    const doc: User = {
      ...userData,
      created_at: now,
      updated_at: now,
    } as User;
    return client.insert(TABLES.USERS, doc) as Promise<User>;
  },

  async findById(id: string): Promise<User | null> {
    const client = getMicroClient();
    return client.get<User>(TABLES.USERS, id);
  },

  async findByEmail(email: string): Promise<User | null> {
    const client = getMicroClient();
    const users = await client.query<User>(TABLES.USERS, { email });
    return users[0] || null;
  },

  async update(id: string, updates: Partial<User>): Promise<User | null> {
    const client = getMicroClient();
    return client.update<User>(TABLES.USERS, id, {
      ...updates,
      updated_at: new Date().toISOString(),
    } as Partial<User>);
  },

  async delete(id: string): Promise<boolean> {
    const client = getMicroClient();
    return client.delete(TABLES.USERS, id);
  },

  async list(limit = 100, offset = 0): Promise<User[]> {
    const client = getMicroClient();
    const { docs } = await client.list<User>(TABLES.USERS, { limit, offset });
    return docs;
  },
};

/**
 * API Keys table helpers
 */
export const ApiKeys = {
  async create(keyData: Omit<ApiKey, 'created_at' | 'updated_at'>): Promise<ApiKey> {
    const client = getMicroClient();
    const now = new Date().toISOString();
    const doc: ApiKey = {
      ...keyData,
      created_at: now,
      updated_at: now,
    } as ApiKey;
    return client.insert(TABLES.API_KEYS, doc) as Promise<ApiKey>;
  },

  async findById(id: string): Promise<ApiKey | null> {
    const client = getMicroClient();
    return client.get<ApiKey>(TABLES.API_KEYS, id);
  },

  async findByKeyHash(keyHash: string): Promise<ApiKey | null> {
    const client = getMicroClient();
    const keys = await client.query<ApiKey>(TABLES.API_KEYS, { key_hash: keyHash });
    return keys[0] || null;
  },

  async findByUserId(userId: string): Promise<ApiKey[]> {
    const client = getMicroClient();
    return client.query<ApiKey>(TABLES.API_KEYS, { user_id: userId });
  },

  async update(id: string, updates: Partial<ApiKey>): Promise<ApiKey | null> {
    const client = getMicroClient();
    return client.update<ApiKey>(TABLES.API_KEYS, id, {
      ...updates,
      updated_at: new Date().toISOString(),
    } as Partial<ApiKey>);
  },

  async delete(id: string): Promise<boolean> {
    const client = getMicroClient();
    return client.delete(TABLES.API_KEYS, id);
  },

  async countByUser(userId: string): Promise<number> {
    const client = getMicroClient();
    return client.count(TABLES.API_KEYS, { user_id: userId });
  },
};

/**
 * Memos table helpers
 */
export const Memos = {
  async create(memoData: Omit<Memo, 'created_at'>): Promise<Memo> {
    const client = getMicroClient();
    const doc: Memo = {
      ...memoData,
      created_at: new Date().toISOString(),
    } as Memo;
    return client.insert(TABLES.MEMOS, doc) as Promise<Memo>;
  },

  async findById(id: string): Promise<Memo | null> {
    const client = getMicroClient();
    return client.get<Memo>(TABLES.MEMOS, id);
  },

  async findByUserId(userId: string, limit = 100, offset = 0): Promise<Memo[]> {
    const client = getMicroClient();
    const all = await client.query<Memo>(TABLES.MEMOS, { user_id: userId });
    // Sort by created_at desc and apply pagination
    return all
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(offset, offset + limit);
  },

  async countByUser(userId: string): Promise<number> {
    const client = getMicroClient();
    return client.count(TABLES.MEMOS, { user_id: userId });
  },

  async delete(id: string): Promise<boolean> {
    const client = getMicroClient();
    return client.delete(TABLES.MEMOS, id);
  },
};

/**
 * Usage Logs table helpers
 */
export const UsageLogs = {
  async create(logData: Omit<UsageLog, 'id' | 'created_at'>): Promise<UsageLog> {
    const client = getMicroClient();
    const id = `${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
    const doc: UsageLog = {
      ...logData,
      id,
      created_at: new Date().toISOString(),
    } as UsageLog;
    return client.insert(TABLES.USAGE_LOGS, doc) as Promise<UsageLog>;
  },

  async findByUserId(userId: string, limit = 100): Promise<UsageLog[]> {
    const client = getMicroClient();
    const all = await client.query<UsageLog>(TABLES.USAGE_LOGS, { user_id: userId });
    return all
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, limit);
  },

  async findByAction(action: string, limit = 100): Promise<UsageLog[]> {
    const client = getMicroClient();
    const all = await client.query<UsageLog>(TABLES.USAGE_LOGS, { action });
    return all
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, limit);
  },

  async count(userId?: string): Promise<number> {
    const client = getMicroClient();
    if (userId) {
      return client.count(TABLES.USAGE_LOGS, { user_id: userId });
    }
    return client.count(TABLES.USAGE_LOGS);
  },
};

/**
 * Subscriptions table helpers
 */
export const Subscriptions = {
  async create(subData: Omit<Subscription, 'created_at' | 'updated_at'>): Promise<Subscription> {
    const client = getMicroClient();
    const now = new Date().toISOString();
    const doc: Subscription = {
      ...subData,
      created_at: now,
      updated_at: now,
    } as Subscription;
    return client.insert(TABLES.SUBSCRIPTIONS, doc) as Promise<Subscription>;
  },

  async findById(id: string): Promise<Subscription | null> {
    const client = getMicroClient();
    return client.get<Subscription>(TABLES.SUBSCRIPTIONS, id);
  },

  async findByUserId(userId: string): Promise<Subscription | null> {
    const client = getMicroClient();
    const subs = await client.query<Subscription>(TABLES.SUBSCRIPTIONS, { user_id: userId });
    return subs[0] || null;
  },

  async findByStripeCustomerId(customerId: string): Promise<Subscription | null> {
    const client = getMicroClient();
    const subs = await client.query<Subscription>(TABLES.SUBSCRIPTIONS, { stripe_customer_id: customerId });
    return subs[0] || null;
  },

  async findByStripeSubscriptionId(subscriptionId: string): Promise<Subscription | null> {
    const client = getMicroClient();
    const subs = await client.query<Subscription>(TABLES.SUBSCRIPTIONS, { stripe_subscription_id: subscriptionId });
    return subs[0] || null;
  },

  async update(id: string, updates: Partial<Subscription>): Promise<Subscription | null> {
    const client = getMicroClient();
    return client.update<Subscription>(TABLES.SUBSCRIPTIONS, id, {
      ...updates,
      updated_at: new Date().toISOString(),
    } as Partial<Subscription>);
  },

  async delete(id: string): Promise<boolean> {
    const client = getMicroClient();
    return client.delete(TABLES.SUBSCRIPTIONS, id);
  },
};

export default {
  TABLES,
  isHyprMode,
  initMicroTables,
  Users,
  ApiKeys,
  Memos,
  UsageLogs,
  Subscriptions,
};