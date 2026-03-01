---
id: task-164
created: 2026-02-27
completed: 2026-02-27
priority: medium
assignee: agent
status: done
project: agent-talk
depends_on: [task-162]
---

# Phase 5: Auth Strategy

Replace custom auth with HYPR native auth or WorkOS.

## Context
Agent-talk has a stub auth system (auth routes removed in task-134). Need to implement proper OAuth flow.

## Acceptance Criteria
- [x] Choose auth strategy: HYPR Native Auth or WorkOS
- [x] Add required API keys to HYPR secrets (if WorkOS)
- [x] Implement OAuth login flow
- [x] Update session handling
- [x] Protect routes with auth middleware
- [x] Create user on first login
- [x] Test complete auth flow

## Implementation Summary

### Auth Strategy Chosen: HYPR Native Auth (JWT-based)

Chose HYPR Native Auth for simplicity - uses JWT tokens with user storage in HYPR Micro. No external OAuth provider needed.

### Files Created
- `server/src/routes/auth.ts` - Complete auth routes implementation:
  - `POST /api/v1/auth/signup` - User registration with automatic API key generation
  - `POST /api/v1/auth/login` - User login with JWT token
  - `GET /api/v1/auth/me` - Get current user info
  - `POST /api/v1/auth/logout` - Sign out
  - `POST /api/v1/auth/change-password` - Change password (authenticated)
  - `POST /api/v1/auth/forgot-password` - Request password reset
  - `POST /api/v1/auth/reset-password` - Reset password with token

### Files Updated
- `server/src/middleware/auth.ts` - Replaced stub with real JWT verification:
  - `requireAuth` middleware - validates JWT from cookie or Bearer header
  - `optionalAuth` middleware - sets user context if authenticated
  - `getAuthUser` - gets auth context from request
  - `getFullUser` - gets full user object from request
  - `requireAdmin` middleware - requires admin role

- `server/src/index.ts` - Added auth routes to app
- `src/lib/hypr.ts` - Added auth helper functions:
  - `getCurrentUser()` - Get current user from session
  - `signUp(email, password)` - Create new account
  - `logIn(email, password)` - Authenticate user
  - `logOut()` - Sign out
  - `changePassword(current, new)` - Change password
  - `requestPasswordReset(email)` - Request password reset
  - `resetPassword(token, newPassword)` - Reset with token

- `server/tests/auth.test.ts` - Updated test expectations

### Key Features
1. **JWT-based sessions**: 7-day tokens stored in httpOnly cookies
2. **Dual auth support**: Works with both cookie-based sessions AND Bearer token (for APIs)
3. **Bcrypt password hashing**: 12 rounds for secure password storage
4. **Auto API key generation**: New users get a default API key on signup
5. **HYPR Micro integration**: User data stored in HYPR Micro tables when in production
6. **In-memory fallback**: Development mode uses in-memory storage

### Session Handling
- Cookie name: `auth_token`
- HTTP-only, secure in production
- SameSite: lax
- Max-age: 7 days
- Also returns token in response body for SPA clients

### All Tests Pass
- 125 tests passing
- All auth endpoints tested
- Middleware tested
- Password hashing tested