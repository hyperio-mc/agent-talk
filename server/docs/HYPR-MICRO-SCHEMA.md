# HYPR Micro Database Schema

This document defines the database schema required by agent-talk when migrating to HYPR Micro.

## Overview

Agent-talk requires the following tables/collections for data persistence. These will be created in HYPR Micro's LMDB-backed storage.

## Tables

### users

Primary user accounts and authentication data.

```sql
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT,
  tier TEXT DEFAULT 'hobby' CHECK(tier IN ('hobby', 'pro', 'enterprise')),
  role TEXT DEFAULT 'user' CHECK(role IN ('user', 'admin')),
  verification_token TEXT,
  reset_token TEXT,
  reset_token_expires TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_reset_token ON users(reset_token);
CREATE INDEX idx_users_verification_token ON users(verification_token);
```

**Fields:**
- `id` - UUID v4, primary key
- `email` - Unique user email address
- `password_hash` - bcrypt hashed password (nullable for OAuth users)
- `tier` - Subscription tier: 'hobby' | 'pro' | 'enterprise'
- `role` - User role: 'user' | 'admin'
- `verification_token` - Email verification token
- `reset_token` - Password reset token
- `reset_token_expires` - Password reset token expiration
- `created_at` - Account creation timestamp
- `updated_at` - Last update timestamp

---

### api_keys

API key management for authenticated API access.

```sql
CREATE TABLE api_keys (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  prefix TEXT NOT NULL,
  key_hash TEXT NOT NULL UNIQUE,
  name TEXT DEFAULT 'Default Key',
  usage_count INTEGER DEFAULT 0,
  last_used_at TIMESTAMP,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_api_keys_user_id ON api_keys(user_id);
CREATE INDEX idx_api_keys_key_hash ON api_keys(key_hash);
CREATE UNIQUE INDEX idx_api_keys_prefix_hash ON api_keys(prefix, key_hash);
```

**Fields:**
- `id` - UUID v4, primary key
- `user_id` - Foreign key to users table
- `prefix` - Key prefix: 'at_live_' | 'at_test_'
- `key_hash` - SHA-256 hash of full API key
- `name` - User-defined key name
- `usage_count` - Number of API calls made with this key
- `last_used_at` - Timestamp of last API call
- `is_active` - Soft delete flag (revoked keys are inactive)
- `created_at` - Key creation timestamp
- `updated_at` - Last update timestamp

---

### memos

Generated audio memos/tts recordings.

```sql
CREATE TABLE memos (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  audio_url TEXT NOT NULL,
  duration_sec REAL NOT NULL,
  voice TEXT,
  character_count INTEGER,
  title TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_memos_user_id ON memos(user_id);
CREATE INDEX idx_memos_created_at ON memos(created_at DESC);
CREATE INDEX idx_memos_voice ON memos(voice);
```

**Fields:**
- `id` - UUID v4, primary key
- `user_id` - Foreign key to users table
- `audio_url` - URL to the generated audio file
- `duration_sec` - Audio duration in seconds
- `voice` - Voice ID used for generation
- `character_count` - Number of characters in the input text
- `title` - Optional memo title
- `created_at` - Creation timestamp

---

### usage_logs

Analytics and usage tracking for rate limiting and reporting.

```sql
CREATE TABLE usage_logs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  api_key_id TEXT REFERENCES api_keys(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  metadata JSON,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_usage_logs_user_id ON usage_logs(user_id);
CREATE INDEX idx_usage_logs_action ON usage_logs(action);
CREATE INDEX idx_usage_logs_created_at ON usage_logs(created_at DESC);
```

**Fields:**
- `id` - UUID v4, primary key
- `user_id` - Foreign key to users table
- `api_key_id` - Foreign key to api_keys table (nullable)
- `action` - Action type (see below)
- `metadata` - JSON metadata for the action
- `created_at` - Timestamp

**Action Types:**
- `memo_created` - Memo successfully generated
- `memo_failed` - Memo generation failed
- `key_created` - API key created
- `key_revoked` - API key revoked
- `key_used` - API key used
- `user_login` - User logged in
- `user_signup` - New user registered
- `error_api` - API error occurred
- `error_tts` - TTS service error
- `error_rate_limit` - Rate limit exceeded

---

### rate_limits

Daily rate limit counters per user/key.

```sql
CREATE TABLE rate_limits (
  id TEXT PRIMARY KEY,
  api_key_id TEXT NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  count INTEGER DEFAULT 1,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(api_key_id, date)
);

CREATE INDEX idx_rate_limits_user_date ON rate_limits(user_id, date);
CREATE INDEX idx_rate_limits_date ON rate_limits(date);
```

**Fields:**
- `id` - UUID v4, primary key
- `api_key_id` - API key identifier
- `user_id` - Foreign key to users table
- `date` - Date in YYYY-MM-DD format (UTC)
- `count` - Number of API calls for this date
- `created_at` - Record creation timestamp
- `updated_at` - Last update timestamp

---

### subscriptions

Stripe subscription management (for Pro tier).

```sql
CREATE TABLE subscriptions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT UNIQUE,
  tier TEXT DEFAULT 'hobby',
  status TEXT DEFAULT 'active',
  current_period_start TIMESTAMP,
  current_period_end TIMESTAMP,
  cancel_at_period_end BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id)
);

CREATE INDEX idx_subscriptions_stripe_customer ON subscriptions(stripe_customer_id);
CREATE INDEX idx_subscriptions_stripe_subscription ON subscriptions(stripe_subscription_id);
```

**Fields:**
- `id` - UUID v4, primary key
- `user_id` - Foreign key to users table (one subscription per user)
- `stripe_customer_id` - Stripe customer ID
- `stripe_subscription_id` - Stripe subscription ID
- `tier` - Current subscription tier
- `status` - Subscription status: 'active' | 'past_due' | 'canceled' | 'incomplete'
- `current_period_start` - Billing period start
- `current_period_end` - Billing period end
- `cancel_at_period_end` - Scheduled for cancellation
- `created_at` - Record creation timestamp
- `updated_at` - Last update timestamp

---

## HYPR Micro Client API

The db-stub modules map to HYPR Micro client operations:

```typescript
// Example HYPR Micro operations
const client = getMicroClient();

// Create
await client.insert('users', { id: '...', email: '...', ... });

// Read
const user = await client.get('users', userId);

// Query
const keys = await client.query('api_keys', { user_id: userId });

// Update
await client.update('users', userId, { tier: 'pro' });

// Delete
await client.delete('api_keys', keyId);
```

## Migration Notes

1. **Data Migration**: Existing SQLite data should be exported and migrated to HYPR Micro
2. **Index Creation**: HYPR Micro creates indexes automatically based on query patterns
3. **Soft Deletes**: Use `is_active` flags instead of hard deletes for audit trails
4. **Timestamps**: All timestamps in ISO 8601 format (UTC)

## Related Files

- `server/src/db-stub/index.ts` - Main database client stub
- `server/src/db-stub/users.ts` - User operations
- `server/src/db-stub/keys.ts` - API key operations
- `server/src/db-stub/memos.ts` - Memo operations
- `server/src/db-stub/subscriptions.ts` - Subscription operations
- `server/src/lib/hypr-micro.ts` - HYPR Micro client