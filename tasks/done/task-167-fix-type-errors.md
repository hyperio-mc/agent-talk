---
id: task-167
created: 2026-02-27
priority: low
assignee: agent
status: done
project: agent-talk
depends_on: []
---

# Fix TypeScript Build Errors

Fix the 9 pre-existing type errors in the build.

## Context
From PHASE1-COMPLETE.md:
"Build completes with 9 pre-existing type errors (not introduced by Phase 1 changes):
- Stripe API version mismatch (2025-02-24 vs 2026-02-25)
- Type mismatches in billing.ts and webhooks.ts"

## Acceptance Criteria
- [x] Run `npm run build` and capture all type errors
- [x] Fix Stripe API version mismatch in billing.ts
- [x] Fix type mismatches in webhooks.ts
- [x] Verify build completes with 0 errors
- [x] Run `npm run check` to verify types (used `npx tsc --noEmit` - no `check` script)

## Files to Modify
- `server/src/routes/billing.ts`
- `server/src/routes/webhooks.ts`
- Possibly `server/package.json` for Stripe types version

## Notes
- These are pre-existing errors, not introduced by recent changes
- LOW priority but nice to have clean builds
- No dependencies - can run in parallel