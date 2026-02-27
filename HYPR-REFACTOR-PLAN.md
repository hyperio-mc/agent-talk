# Agent-Talk HYPR-Native Refactoring Plan

## Goal
Refactor agent-talk from a standalone monolithic app to a HYPR-native deployment that leverages onhyper.io's infrastructure (auth, secrets, storage, monitoring) while keeping business logic in the SPA.

## Current State (What Agents Built)
- Standalone Railway deployment
- SQLite database with custom migrations
- Local auth system (JWT, password hashing)
- Local file storage for audio
- ElevenLabs key in environment
- Custom health/monitoring endpoints
- Billing routes (no Stripe integration)

## Target Architecture

```
┌────────────────────────────────────────────────────────────────┐
│                    HYPR Platform (onhyper.io)                   │
├────────────────────────────────────────────────────────────────┤
│                                                                 │
│   Frontend SPA (Vite + Svelte)                                  │
│   ├── Deployed as HYPR app at talk.onhyper.io                  │
│   ├── Handles all UI/UX                                        │
│   └── Calls /proxy/* endpoints for external APIs               │
│                                                                 │
│   HYPR Secret Store                                             │
│   ├── ELEVENLABS_API_KEY → injected via /proxy/elevenlabs/*    │
│   └── Future: STRIPE_SECRET_KEY, WORKOS_API_KEY                │
│                                                                 │
│   HYPR Micro (Data)                                             │
│   ├── users table (id, email, tier, created_at)                │
│   ├── api_keys table (id, user_id, prefix, is_active)          │
│   ├── memos table (id, user_id, text, voice, audio_url)        │
│   └── usage_logs table (id, user_id, action, timestamp)        │
│                                                                 │
│   HYPR Storage (Files)                                          │
│   └── Audio files (.mp3) via HYPR file storage API             │
│                                                                 │
│   External Services (via HYPR Proxy)                            │
│   ├── ElevenLabs → TTS generation                              │
│   ├── WorkOS → Auth (future)                                   │
│   └── Stripe → Billing (future)                                │
│                                                                 │
└────────────────────────────────────────────────────────────────┘
```

## Refactoring Phases

### Phase 1: HYPR App Scaffold (Priority: High)
**Goal**: Get the SPA running as a HYPR app

- [ ] Create new HYPR app in onhyper.io dashboard
- [ ] Move frontend code to HYPR app structure
- [ ] Configure app slug (e.g., `talk`)
- [ ] Strip out standalone server (keep only proxy logic)
- [ ] Deploy SPA to talk.onhyper.io

**Files to keep:**
- `src/` (frontend)
- `public/` (static assets)
- `index.html`
- `vite.config.ts`

**Files to remove:**
- `server/src/db/` (replaced by HYPR Micro)
- `server/src/routes/auth.ts` (replaced by WorkOS or HYPR auth)
- `server/src/routes/health.ts` (HYPR handles)
- `server/src/routes/admin.ts` (HYPR dashboard)
- `server/src/middleware/auth.ts` (HYPR auth)

### Phase 2: HYPR Secrets + Proxy (Priority: High)
**Goal**: Route ElevenLabs calls through HYPR proxy

- [ ] Add ELEVENLABS_API_KEY to HYPR secrets
- [ ] Replace direct ElevenLabs calls with `/proxy/elevenlabs/*`
- [ ] Update TTS service to use proxy endpoint
- [ ] Test TTS generation through proxy

**Code change:**
```typescript
// Before
const response = await fetch('https://api.elevenlabs.io/v1/text-to-speech/...', {
  headers: { 'xi-api-key': process.env.ELEVENLABS_API_KEY }
})

// After
const response = await fetch('/proxy/elevenlabs/v1/text-to-speech/...', {
  headers: { 'X-App-Slug': 'talk' }
})
```

### Phase 3: HYPR Micro for Data (Priority: High)
**Goal**: Replace SQLite with HYPR Micro tables

- [ ] Create HYPR Micro tables: `users`, `api_keys`, `memos`, `usage_logs`
- [ ] Create API routes that query HYPR Micro
- [ ] Migrate data operations from SQLite to HYPR Micro
- [ ] Test CRUD operations

**HYPR Micro Tables:**
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

### Phase 4: HYPR Storage for Audio (Priority: Medium)
**Goal**: Store generated audio in HYPR file storage

- [ ] Configure HYPR storage bucket for audio files
- [ ] Update audio service to upload to HYPR storage
- [ ] Generate public URLs for stored files
- [ ] Test audio upload/retrieval

**API pattern:**
```typescript
// Upload audio
const file = await HYPR.storage.upload({
  bucket: 'audio',
  filename: `memo_${id}.mp3`,
  data: audioBuffer,
  contentType: 'audio/mpeg'
})

// Get URL
const url = HYPR.storage.getUrl(file.id)
```

### Phase 5: Auth Strategy (Priority: Medium)
**Goal**: Replace custom auth with WorkOS or HYPR native auth

**Option A: HYPR Native Auth (Simpler)**
- [ ] Use HYPR's built-in user management
- [ ] Users table in HYPR Micro
- [ ] Session handling via HYPR

**Option B: WorkOS (More features)**
- [ ] Create WorkOS application
- [ ] Add WORKOS_API_KEY to HYPR secrets
- [ ] Implement OAuth flow via `/proxy/workos/*`
- [ ] Handle user sessions in SPA

### Phase 6: Billing (Priority: Low)
**Goal**: Stripe billing via HYPR proxy

- [ ] Add STRIPE_SECRET_KEY to HYPR secrets
- [ ] Create billing routes using `/proxy/stripe/*`
- [ ] Implement tier upgrade/downgrade flows
- [ ] Handle webhooks (or use HYPR billing if available)

## Files to Refactor

### Keep (Hybrid)
| File | Changes |
|------|---------|
| `server/src/services/tts.ts` | Replace direct API calls with HYPR proxy |
| `server/src/services/memo.ts` | Replace SQLite with HYPR Micro queries |
| `server/src/index.ts` | Strip down to minimal proxy routes |
| `src/lib/api.ts` | Update to use HYPR endpoints |

### Remove
| File | Reason |
|------|--------|
| `server/src/db/*` | Replaced by HYPR Micro |
| `server/src/routes/auth.ts` | Replaced by WorkOS/HYPR auth |
| `server/src/routes/health.ts` | HYPR handles |
| `server/src/middleware/auth.ts` | HYPR/auth service handles |
| `server/src/services/user.ts` | Moved to HYPR Micro |
| `Dockerfile` | Not needed for HYPR app |
| `railway.toml` | Not needed for HYPR app |

### Create
| File | Purpose |
|------|---------|
| `src/lib/hypr.ts` | HYPR client SDK wrapper |
| `src/lib/micro.ts` | HYPR Micro query helpers |
| `src/lib/storage.ts` | HYPR storage helpers |
| `hypr-app.json` | HYPR app configuration |

## Benefits of HYPR-Native Approach

1. **Simpler deployment** — No server to manage, just SPA + proxy
2. **Built-in monitoring** — HYPR handles uptime, health, metrics
3. **Secure secrets** — API keys never in code, HYPR injects them
4. **Scalable storage** — HYPR Micro + storage scales automatically
5. **Auth ready** — WorkOS or HYPR auth without custom JWT handling
6. **Billing ready** — Stripe via proxy, or HYPR billing when available

## Estimated Effort

| Phase | Hours | Priority |
|-------|-------|----------|
| Phase 1: HYPR Scaffold | 2-3h | High |
| Phase 2: Secrets + Proxy | 2-3h | High |
| Phase 3: HYPR Micro | 4-6h | High |
| Phase 4: Storage | 2-3h | Medium |
| Phase 5: Auth | 3-4h | Medium |
| Phase 6: Billing | 3-4h | Low |
| **Total** | **16-23h** | |

## Next Steps

1. **Confirm HYPR app creation** — Create `talk` app in onhyper.io dashboard
2. **Phase 1 kickoff** — Start with SPA migration and proxy setup
3. **Test ElevenLabs proxy** — Verify `/proxy/elevenlabs/*` works with HYPR secrets
4. **Iterate** — Deploy early, test often

---

**Created:** 2026-02-27
**Status:** Draft
**Related:** task-142 (billing), task-148 (deploy)