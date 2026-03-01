---
id: task-137
created: 2026-02-27
completed: 2026-02-28
priority: high
assignee: agent
status: done
project: agent-talk
depends_on: []
---

# Phase 3: Strip SQLite Database Layer

Remove the SQLite database and custom migrations from agent-talk. HYPR Micro will handle data storage.

## Context
Agent-talk uses SQLite with custom migrations in `server/src/db/`. This needs to be removed as HYPR Micro will provide the database layer.

## Acceptance Criteria
- [x] Delete `server/src/db/` directory
- [x] Remove SQLite dependency from `server/package.json`
- [x] Remove any database-related imports from services
- [x] Remove database initialization from `server/src/index.ts`
- [x] Document the expected HYPR Micro schema for migration

## Files to Remove/Modify
- `server/src/db/` - DELETE entire directory
- `server/package.json` - Remove better-sqlite3 or sqlite dependency
- `server/src/index.ts` - Remove db initialization

## HYPR Micro Schema (For Reference)
```sql
-- users
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE,
  tier TEXT DEFAULT 'hobby',
  created_at TIMESTAMP DEFAULT NOW()
)

-- api_keys
CREATE TABLE api_keys (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  prefix TEXT,
  key_hash TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
)

-- memos
CREATE TABLE memos (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  text TEXT,
  voice TEXT,
  audio_url TEXT,
  duration_seconds REAL,
  created_at TIMESTAMP DEFAULT NOW()
)

-- usage_logs
CREATE TABLE usage_logs (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  action TEXT,
  metadata JSON,
  created_at TIMESTAMP DEFAULT NOW()
)
```

## Notes
- This is preparation for HYPR Micro integration
- Data migration will be a separate task