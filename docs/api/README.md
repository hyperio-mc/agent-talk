# Agent Talk API Documentation

**Version:** 1.0.0  
**Base URL:** `https://talk.onhyper.io`

Agent Talk is a text-to-speech API designed for AI agents. Send text, receive audio — one POST request, instant voice.

## Why Agent Talk?

- **Agent-Native Design** — Built for autonomous AI systems, not humans clicking buttons
- **Deterministic Responses** — Same text + voice = same audio every time
- **Inline Audio** — Audio returned as base64 in the response, no separate fetches
- **Simple Authentication** — API key in the Authorization header
- **Multiple TTS Providers** — ElevenLabs HD audio, Edge TTS, or simulation mode

## Quick Start

```bash
# 1. Sign up and get your API key
curl -X POST https://talk.onhyper.io/api/v1/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email": "you@example.com", "password": "your-password"}'

# 2. Convert text to speech
curl -X POST https://talk.onhyper.io/api/v1/memo \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"text": "Hello from Agent Talk!", "voice": "rachel"}'
```

## Documentation Sections

| Section | Description |
|---------|-------------|
| [Quick Start Guide](./quick-start.md) | Get started in 5 minutes |
| [Authentication](./authentication.md) | API keys and user authentication |
| [Endpoints Reference](./endpoints.md) | Full API endpoint documentation |
| [Voices Reference](./voices.md) | Available voices with descriptions and use cases |
| [Rate Limits](./rate-limits.md) | Usage limits by tier |
| [Error Codes](./errors.md) | Error handling and status codes |
| [Code Examples](./examples.md) | cURL, JavaScript, and Python examples |

## OpenAPI Specification

The full API specification is available in OpenAPI 3.1 format:

- **YAML:** [`openapi.yaml`](./openapi.yaml)
- **View with Swagger UI:** Paste the YAML into [editor.swagger.io](https://editor.swagger.io)
- **View with Redoc:** Use [redocly.com/redoc](https://redocly.com/redoc)

## API Overview

### Available Voices

| Voice ID | Name | Gender | Description |
|----------|------|--------|-------------|
| `rachel` | Rachel | Female | Calm, professional |
| `domi` | Domi | Female | Strong, confident |
| `bella` | Bella | Female | Soft, warm |
| `adam` | Adam | Male | Deep narration |
| `sam` | Sam | Male | Conversational |
| `charlie` | Charlie | Male | Casual conversational |
| `emily` | Emily | Female | Soft, gentle |
| `ethan` | Ethan | Male | Young male |
| `freya` | Freya | Female | Young, energetic |
| `dorothy` | Dorothy | Female | Storyteller |
| `bill` | Bill | Male | Mature male |
| `sarah` | Sarah | Female | Professional female |

### Response Format

All endpoints return JSON with a consistent structure:

**Success Response:**
```json
{
  "success": true,
  // ... response data
}
```

**Error Response:**
```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": { /* optional error details */ }
  }
}
```

### Authentication

API endpoints require authentication via:

- **Session Auth** — For user account management (login, signup, API key management)
- **API Key Auth** — For TTS operations (`Authorization: Bearer YOUR_API_KEY`)

See [Authentication](./authentication.md) for details.

## Health Check

```bash
curl https://talk.onhyper.io/health
```

Response:
```json
{
  "status": "ok",
  "service": "Agent Talk API",
  "version": "1.0.0",
  "timestamp": "2026-02-27T14:00:00Z",
  "ttsMode": "elevenlabs",
  "database": { "status": "ok" }
}
```

## Support

- **GitHub:** [https://github.com/hyperio-mc/agent-talk](https://github.com/hyperio-mc/agent-talk)
- **Email:** hello@hyper.io
