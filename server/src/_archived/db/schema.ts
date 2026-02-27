/**
 * Agent Talk Database Schema
 * 
 * SQLite types mapping:
 * - TEXT -> string
 * - INTEGER -> number
 * - REAL -> number (floating point)
 * - BLOB -> Buffer
 */

export interface User {
  id: string;
  email: string;
  password_hash: string;
  tier: 'hobby' | 'pro' | 'enterprise';
  role: 'user' | 'admin';
  created_at: string;
  updated_at: string;
}

export interface ApiKey {
  id: string;
  user_id: string;
  key_hash: string;
  prefix: string;
  name: string | null;
  usage_count: number;
  last_used_at: string | null;
  is_active: boolean;
  created_at: string;
}

export interface Memo {
  id: string;
  user_id: string;
  api_key_id: string;
  text: string;
  voice: string;
  audio_url: string;
  duration_seconds: number | null;
  character_count: number;
  created_at: string;
}

export interface UsageLog {
  id: string;
  user_id: string;
  api_key_id: string | null;
  action: string;
  metadata: string | null; // JSON string
  created_at: string;
}

export interface Migration {
  id: number;
  name: string;
  applied_at: string;
}

// SQL schema definitions
export const schema = {
  users: `
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      tier TEXT DEFAULT 'hobby' CHECK(tier IN ('hobby', 'pro', 'enterprise')),
      role TEXT DEFAULT 'user' CHECK(role IN ('user', 'admin')),
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `,

  apiKeys: `
    CREATE TABLE IF NOT EXISTS api_keys (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      key_hash TEXT NOT NULL,
      prefix TEXT NOT NULL,
      name TEXT,
      usage_count INTEGER DEFAULT 0,
      last_used_at TEXT,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `,

  memos: `
    CREATE TABLE IF NOT EXISTS memos (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      api_key_id TEXT REFERENCES api_keys(id) ON DELETE SET NULL,
      text TEXT NOT NULL,
      voice TEXT NOT NULL,
      audio_url TEXT NOT NULL,
      duration_seconds REAL,
      character_count INTEGER,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `,

  usageLogs: `
    CREATE TABLE IF NOT EXISTS usage_logs (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      api_key_id TEXT REFERENCES api_keys(id) ON DELETE SET NULL,
      action TEXT NOT NULL,
      metadata TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `,

  migrations: `
    CREATE TABLE IF NOT EXISTS migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      applied_at TEXT DEFAULT (datetime('now'))
    )
  `,

  // Indexes for common queries
  indexes: [
    `CREATE INDEX IF NOT EXISTS idx_api_keys_user_id ON api_keys(user_id)`,
    `CREATE INDEX IF NOT EXISTS idx_api_keys_key_hash ON api_keys(key_hash)`,
    `CREATE INDEX IF NOT EXISTS idx_memos_user_id ON memos(user_id)`,
    `CREATE INDEX IF NOT EXISTS idx_memos_api_key_id ON memos(api_key_id)`,
    `CREATE INDEX IF NOT EXISTS idx_usage_logs_user_id ON usage_logs(user_id)`,
    `CREATE INDEX IF NOT EXISTS idx_usage_logs_created_at ON usage_logs(created_at)`,
  ]
};

// Migration files (applied in order)
export const migrations: { name: string; sql: string }[] = [
  {
    name: '001_initial_schema',
    sql: [
      schema.users,
      schema.apiKeys,
      schema.memos,
      schema.usageLogs,
      ...schema.indexes
    ].join(';\n')
  },
  // Note: 002_add_user_role migration is no longer needed because
  // the role column is already included in the initial schema.
  // Keeping this as a placeholder for future migrations pattern.
];

// SQL for subscriptions table (migration 003)
export const subscriptionSchema = `
  CREATE TABLE IF NOT EXISTS subscriptions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    stripe_customer_id TEXT NOT NULL,
    stripe_subscription_id TEXT,
    stripe_price_id TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    tier TEXT NOT NULL DEFAULT 'hobby',
    current_period_start TEXT,
    current_period_end TEXT,
    cancel_at_period_end INTEGER DEFAULT 0,
    canceled_at TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);
  CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_customer_id ON subscriptions(stripe_customer_id);
  CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_subscription_id ON subscriptions(stripe_subscription_id);
`;