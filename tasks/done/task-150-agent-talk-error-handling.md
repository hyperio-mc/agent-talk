---
id: task-150
created: 2026-02-27
priority: medium
assignee: agent
status: done
project: agent-talk
depends_on: []
completed: 2026-02-27
---

# Phase 1: Remove Standalone Health Endpoints

Remove custom health and monitoring endpoints since HYPR platform handles this.

## Context
Agent-talk has custom health/monitoring endpoints in `server/src/routes/health.ts`. HYPR provides built-in health monitoring so these can be removed.

## Acceptance Criteria
- [x] Delete `server/src/routes/health.ts`
- [x] Remove health route registration from `server/src/index.ts`
- [x] Remove admin routes in `server/src/routes/admin.ts` if HYPR dashboard replaces them
- [x] Verify server starts without health endpoints
- [x] Document what HYPR provides for health monitoring

## Files Removed/Modified
- `server/src/routes/health.ts` - DELETED
- `server/src/routes/admin.ts` - DELETED
- `server/src/index.ts` - Removed health and admin imports and route registrations

## HYPR Platform Health Monitoring

The following features are now provided by HYPR platform:

### Uptime Monitoring
- HYPR tracks service availability automatically
- No need for custom `/health/live` or `/health/ready` endpoints
- Platform-level alerting for service downtime

### Health Checks
- Built-in Kubernetes-style health probes
- Automatic instance health tracking
- Database connectivity monitoring via HYPR Micro

### Metrics Collection
- No need for custom `/health/metrics` endpoint
- HYPR provides:
  - Request latency tracking
  - Memory and CPU usage
  - Error rate monitoring
  - API response times

### Admin Dashboard
- HYPR dashboard provides:
  - User management (view/edit users, tiers, roles)
  - API key management (view, revoke, create)
  - Usage analytics and logs
  - Billing and subscription management
  - System health status

### What Was Removed

**health.ts endpoints:**
- `GET /health` - Basic health check
- `GET /health/detailed` - Detailed health with all services
- `GET /health/ready` - Kubernetes readiness probe
- `GET /health/live` - Kubernetes liveness probe
- `GET /health/metrics` - Prometheus-style metrics

**admin.ts endpoints:**
- `GET /api/v1/admin/dashboard` - Admin metrics
- `GET /api/v1/admin/users` - User listing
- `GET /api/v1/admin/users/:id` - User details
- `PATCH /api/v1/admin/users/:id/tier` - Update user tier
- `PATCH /api/v1/admin/users/:id/role` - Update user role
- `DELETE /api/v1/admin/users/:id` - Delete user
- `GET /api/v1/admin/api-keys` - List API keys
- `POST /api/v1/admin/api-keys/:id/revoke` - Revoke key
- `GET /api/v1/admin/health` - System health
- `GET /api/v1/admin/stats` - System stats
- `GET /api/v1/admin/analytics/*` - Various analytics endpoints

### Migration Notes
- The `/api/v1/metrics` endpoint is retained for internal use
- Admin middleware (`server/src/middleware/admin.ts`) is kept for potential future use
- Dashboard and analytics routes (`/api/v1/dashboard`, `/api/v1/analytics`) are retained for user-facing features