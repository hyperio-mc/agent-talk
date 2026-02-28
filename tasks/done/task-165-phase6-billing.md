---
id: task-165
created: 2026-02-27
completed: 2026-02-27
priority: low
assignee: agent
status: done
project: agent-talk
depends_on: [task-162, task-164]
---

# Phase 6: Billing

Integrate Stripe billing via HYPR proxy.

## Summary

Successfully integrated Stripe billing with HYPR proxy support. The implementation allows the application to use either:
- **HYPR Proxy mode** (production): Stripe API calls go through `/api/proxy/stripe/*` endpoints
- **Direct SDK mode** (development): Uses Stripe SDK directly with `STRIPE_SECRET_KEY` env var

## Acceptance Criteria ✓

- [x] Add STRIPE_SECRET_KEY to HYPR secrets - Already configured in `hypr-app.json` secrets array
- [x] Update billing routes to use `/proxy/stripe/*` endpoints - Implemented `StripeProxyClient` class
- [x] Implement tier upgrade/downgrade flows - Already present in `billing.ts`, now works with proxy
- [x] Handle Stripe webhooks - Enhanced webhook handling with more events and better logging
- [x] Test billing flows (test mode) - Added billing.test.ts with 13 passing tests

## Changes Made

### 1. Updated Stripe Service (`server/src/services/stripe.ts`)
- Created `StripeProxyClient` class that uses HYPR proxy for Stripe API calls
- Added dual-mode support: proxy mode (production) and SDK mode (development)
- Implemented proxy methods for: createCustomer, createCheckoutSession, createPortalSession, retrieveSubscription, updateSubscription
- Webhook verification still uses Stripe SDK directly (webhooks come from Stripe servers)
- Added `USE_HYPR_PROXY` environment variable check

### 2. Enhanced Webhook Handling (`server/src/routes/webhooks.ts`)
- Added support for additional Stripe events:
  - `invoice.paid` - handles renewal confirmation
  - `invoice.payment_failed` - marks subscription as past_due
  - `customer.deleted` - cleans up subscription records
  - `customer.updated` - logs customer changes
  - `payment_intent.succeeded/failed` - payment tracking
  - `charge.succeeded/failed/refunded` - charge tracking
- Added `GET /api/webhooks/stripe/health` endpoint for monitoring
- Improved error logging with `logger.logError()`
- Fixed TypeScript type issues with error metadata

### 3. Updated Environment Docs (`.env.example`)
- Documented HYPR proxy mode for Stripe
- Clarified that `STRIPE_SECRET_KEY` is set via HYPR Dashboard in production
- `STRIPE_WEBHOOK_SECRET` and `STRIPE_PRO_PRICE_ID` still needed locally

### 4. Added Billing Tests (`server/tests/billing.test.ts`)
- 13 tests covering:
  - Tier endpoints (public)
  - Subscription endpoints (auth required)
  - Webhook endpoints
  - Health check endpoint

### 5. Verified HYPR Config (`hypr-app.json`)
- Confirmed `STRIPE_SECRET_KEY` is in secrets array
- Confirmed `/api/proxy/stripe/*` proxy route is configured
- Proxy forwards to `https://api.stripe.com` with auth header injection

## Files Modified
- `server/src/services/stripe.ts` - HYPR proxy integration
- `server/src/routes/webhooks.ts` - Enhanced webhook handling
- `server/tests/billing.test.ts` - Added billing tests
- `.env.example` - Updated Stripe documentation

## Notes
- Webhooks come directly from Stripe servers (not through proxy) - this is correct behavior
- STRIPE_WEBHOOK_SECRET must be set locally for signature verification
- In HYPR mode, only STRIPE_WEBHOOK_SECRET and STRIPE_PRO_PRICE_ID are needed locally
- All 138 tests pass (125 existing + 13 new billing tests)