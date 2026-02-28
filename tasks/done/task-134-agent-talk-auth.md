---
id: task-134
created: 2026-02-27
completed: 2026-02-28
priority: high
assignee: agent
status: done
project: agent-talk
depends_on: []
---

# Phase 1: Strip Custom Auth System

Remove the standalone authentication system (JWT, password hashing, session handling) from agent-talk since HYPR will handle auth.

## Context
Agent-talk currently has a custom auth system in `server/src/routes/auth.ts` and `server/src/middleware/auth.ts`. This needs to be removed as auth will be handled by HYPR platform.

## Acceptance Criteria
- [x] Delete `server/src/routes/auth.ts`
- [x] Replace `server/src/middleware/auth.ts` with stub that errors until HYPR auth is integrated
- [x] Remove auth-related imports from `server/src/index.ts`
- [x] Remove auth route from route definitions
- [x] Verify server still starts without auth files
- [x] Protected routes fail with "Authentication not configured" message
- [x] Public routes still work correctly

## Files Modified
- `server/src/routes/auth.ts` - DELETED
- `server/src/middleware/auth.ts` - Replaced with stub 
- `server/src/index.ts` - Removed auth import and route
- `server/dist/routes/auth.js` - Removed from dist

## Completion Notes
- Deleted `server/src/routes/auth.ts` (full auth route handlers)
- Replaced `server/src/middleware/auth.ts` with stub that throws `NotImplementedError`
- Removed auth route from `server/src/index.ts`
- Protected routes (keys, dashboard, analytics, billing) now fail with 501 "Authentication not configured. HYPR auth integration pending."
- Public routes (voices, demo, memo with API key) work correctly
- Migration docs updated at `docs/AUTH_MIGRATION.md`
- `server/src/services/user.ts` remains but is unused (can be removed in Phase 2)