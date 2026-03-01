# HYPR Proxy Configuration

This document explains how external API calls are routed through the HYPR proxy for secure secret management.

## Overview

Instead of storing API keys in environment variables or code, Agent Talk uses the HYPR proxy to inject secrets at runtime. This provides:

- **Security**: API keys never appear in code or environment variables
- **Rotation**: Secrets can be rotated without redeploying
- **Audit**: All API calls are logged by the HYPR platform
- **Access Control**: Secrets are scoped to specific apps

## How It Works

```
┌─────────────┐     ┌──────────────┐     ┌─────────────────┐
│ Agent Talk  │────▶│  HYPR Proxy  │────▶│ External API    │
│  (Server)   │     │              │     │ (ElevenLabs,    │
│             │     │ - Inject     │     │  Stripe, etc.)  │
│ X-App-Slug  │     │   secrets    │     │                 │
└─────────────┘     └──────────────┘     └─────────────────┘
```

1. Agent Talk makes requests to `/api/proxy/{service}/*`
2. HYPR Proxy receives the request with `X-App-Slug: talk` header
3. HYPR looks up secrets for the app (`talk`) and injects them
4. Request is forwarded to the external API with authentication

## Configured Proxies

### ElevenLabs TTS
- **Path**: `/api/proxy/elevenlabs/*`
- **Target**: `https://api.elevenlabs.io/v1`
- **Secret**: `ELEVENLABS_API_KEY`
- **Header**: `xi-api-key: {{ELEVENLABS_API_KEY}}`

```typescript
// Example: Text-to-speech
const response = await fetch('/api/proxy/elevenlabs/text-to-speech/voice-id', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-App-Slug': 'talk'
  },
  body: JSON.stringify({ text: 'Hello world' })
});
```

### Stripe
- **Path**: `/api/proxy/stripe/*`
- **Target**: `https://api.stripe.com`
- **Secret**: `STRIPE_SECRET_KEY`
- **Header**: `Authorization: Bearer {{STRIPE_SECRET_KEY}}`

```typescript
// Example: Create customer
const response = await fetch('/api/proxy/stripe/v1/customers', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/x-www-form-urlencoded',
    'X-App-Slug': 'talk'
  },
  body: 'email=test@example.com'
});
```

### WorkOS
- **Path**: `/api/proxy/workos/*`
- **Target**: `https://api.workos.com`
- **Secret**: `WORKOS_API_KEY`
- **Header**: `Authorization: Bearer {{WORKOS_API_KEY}}`

### HYPR Micro
- **Path**: `/api/proxy/hypermicro/*`
- **Target**: `{HYPERMICRO_URL}`
- **Secret**: `HYPERMICRO_API_KEY`
- **Header**: `X-API-Key: {{HYPERMICRO_API_KEY}}`

## Setting Secrets

Secrets are managed through the HYPR Dashboard:

1. Navigate to your app (`talk`) in the HYPR Dashboard
2. Go to **Settings > Secrets**
3. Add or update secret values:
   - `ELEVENLABS_API_KEY`: Your ElevenLabs API key
   - `STRIPE_SECRET_KEY`: Your Stripe secret key
   - `WORKOS_API_KEY`: Your WorkOS API key
   - `HYPERMICRO_API_KEY`: Your HYPR Micro API key

**Important**: Never commit secrets to code or set them in `.env` files in production.

## Code Implementation

### Server-Side (Node.js)

```typescript
import { getProxyClient } from './lib/hypr-proxy.js';

const proxy = getProxyClient();

// ElevenLabs TTS
const audioBuffer = await proxy.elevenLabsTTS({
  voiceId: '21m00Tcm4TlvDq8ikWAM',
  text: 'Hello, world!',
  stability: 0.5,
  similarityBoost: 0.75
});

// Generic proxy request
const response = await proxy.request('elevenlabs', '/voices', {
  method: 'GET'
});
```

### Client-Side (Browser)

```typescript
import { proxyElevenLabsTTS } from './lib/hypr.js';

// ElevenLabs TTS from browser
const audioBuffer = await proxyElevenLabsTTS(
  '21m00Tcm4TlvDq8ikWAM',
  'Hello, world!',
  { stability: 0.5, similarityBoost: 0.75 }
);
```

## Environment Variables

### Production (HYPR)
```bash
HYPR_MODE=production
USE_HYPR_PROXY=true
```

Secrets are automatically injected by the HYPR platform.

### Development (Local)
```bash
HYPR_MODE=development
USE_HYPR_PROXY=false
ELEVENLABS_API_KEY=your-dev-key  # Only for local testing
```

In development mode, you can use direct API calls with environment variables for convenience.

## Security Best Practices

1. **Never log secrets** - The proxy handles this automatically
2. **Use HTTPS everywhere** - Required for production
3. **Rotate keys periodically** - Update in HYPR Dashboard
4. **Monitor usage** - Check HYPR Dashboard for API call logs
5. **Scope secrets properly** - Each app has its own secrets

## Troubleshooting

### "Proxy request failed: 401"
- Check that `X-App-Slug` header is set correctly
- Verify the secret is configured in HYPR Dashboard

### "Proxy request failed: 403"
- The app may not have access to the requested proxy endpoint
- Check `hypr-app.json` proxy configuration

### "Proxy request failed: 404"
- Check the proxy path matches the configuration
- Verify the target endpoint exists

### Fallback to Direct API
If `USE_HYPR_PROXY=false` or `HYPR_MODE=development`, the system falls back to direct API calls using environment variables. This is useful for local development.

## Related Files

- `hypr-app.json` - Proxy route configuration
- `server/src/lib/hypr-proxy.ts` - Server proxy client
- `server/src/lib/hypr-config.ts` - Configuration helpers
- `src/lib/hypr.ts` - Client-side proxy helpers