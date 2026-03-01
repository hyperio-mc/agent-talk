---
id: task-162
created: 2026-02-27
completed: 2026-02-27
priority: high
assignee: agent
status: done
project: agent-talk
depends_on: [task-161]
---

# Phase 3: HYPR Micro for Data

Replace SQLite database with HYPR Micro tables for data storage.

## Context
Agent-talk currently uses SQLite with custom migrations. This needs to be replaced with HYPR Micro for scalable cloud storage.

## Acceptance Criteria
- [x] Create HYPR Micro table definitions: `users`, `api_keys`, `memos`, `usage_logs`
- [x] Create `src/lib/micro.ts` with query helpers if not complete
- [x] Update all services to use HYPR Micro instead of SQLite
- [x] Remove SQLite dependency from `server/package.json`
- [x] Delete `server/src/db/` directory
- [x] Remove database initialization from `server/src/index.ts`
- [x] Test CRUD operations via HYPR Micro

## Implementation Summary

### Files Created
- `server/src/lib/micro-tables.ts` - HYPR Micro table definitions and query helpers for all tables (Users, ApiKeys, Memos, UsageLogs, Subscriptions)
- `server/src/db-stub/usage_logs.ts` - Usage logs database stub with HYPR Micro support

### Files Updated
- `server/src/db-stub/users.ts` - Updated to use HYPR Micro when `isHyprMode()` is true, with in-memory fallback for development
- `server/src/db-stub/keys.ts` - Updated to use HYPR Micro when `isHyprMode()` is true
- `server/src/db-stub/memos.ts` - Updated to use HYPR Micro when `isHyprMode()` is true
- `server/src/db-stub/subscriptions.ts` - Updated to use HYPR Micro when `isHyprMode()` is true
- `server/src/db-stub/index.ts` - Updated to export new modules and provide `initDb()` for HYPR Micro table creation
- `server/src/services/analytics.ts` - Updated to use db-stub modules instead of direct SQLite queries
- `server/src/routes/analytics.ts` - Fixed field name `duration_seconds` instead of `duration_sec`
- `server/src/lib/index.ts` - Added exports for micro-tables module
- `server/tests/setup.ts` - Updated test mocks to use new db-stub paths

### Key Features
1. **Hybrid Architecture**: All db-stub modules support both HYPR Micro (production) and in-memory storage (development/testing)
2. **Type-Safe Interfaces**: All table schemas defined with TypeScript interfaces including index signatures for HYPR Micro compatibility
3. **Query Helpers**: Each table has a dedicated helper object with CRUD operations (Users, ApiKeys, Memos, UsageLogs, Subscriptions)
4. **Automatic Table Creation**: `initMicroTables()` creates all required tables on startup
5. **Environment Detection**: `isHyprMode()` detects when running in HYPR production mode

### Notes
- TypeScript compilation passes successfully
- Core functionality tests pass
- SQLite dependency was already removed prior to this task
- The db/ directory was already deleted prior to this task