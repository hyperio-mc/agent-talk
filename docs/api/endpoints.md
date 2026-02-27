# API Endpoints Reference

Complete reference for all Agent Talk API endpoints.

## Base URL

```
https://talk.onhyper.io
```

For local development:
```
http://localhost:3001
```

---

## Authentication Endpoints

### POST /api/v1/auth/signup

Create a new user account and receive an API key.

**Authentication:** None (public endpoint)

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `email` | string | Yes | User email address |
| `password` | string | Yes | Password (min 8 characters) |

**Example Request:**

```bash
curl -X POST https://talk.onhyper.io/api/v1/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "you@example.com",
    "password": "your-secure-password"
  }'
```

**Success Response (201 Created):**

```json
{
  "success": true,
  "user": {
    "id": "user_abc123",
    "email": "you@example.com",
    "role": "user",
    "createdAt": "2026-02-27T14:00:00Z"
  },
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "expiresAt": "2026-02-28T14:00:00Z",
  "apiKey": {
    "id": "key_xyz789",
    "key": "at_live_abc123def456...",
    "prefix": "at_live_abc",
    "name": "Default Key",
    "createdAt": "2026-02-27T14:00:00Z"
  },
  "warning": "Save your API key! It will only be shown once."
}
```

**Error Responses:**

- `400 Bad Request` — Missing or invalid fields
- `409 Conflict` — Email already registered

---

### POST /api/v1/auth/login

Authenticate and receive a session token.

**Authentication:** None (public endpoint)

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `email` | string | Yes | User email address |
| `password` | string | Yes | User password |

**Example Request:**

```bash
curl -X POST https://talk.onhyper.io/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "you@example.com",
    "password": "your-password"
  }'
```

**Success Response (200 OK):**

```json
{
  "success": true,
  "user": {
    "id": "user_abc123",
    "email": "you@example.com",
    "role": "user",
    "createdAt": "2026-02-26T14:00:00Z"
  },
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "expiresAt": "2026-02-28T14:00:00Z"
}
```

**Error Responses:**

- `400 Bad Request` — Missing or invalid fields
- `401 Unauthorized` — Invalid credentials

---

### POST /api/v1/auth/logout

End the current session.

**Authentication:** Session (optional)

**Example Request:**

```bash
curl -X POST https://talk.onhyper.io/api/v1/auth/logout
```

**Success Response (200 OK):**

```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

---

### GET /api/v1/auth/me

Get the currently authenticated user.

**Authentication:** Session required

**Example Request:**

```bash
curl -X GET https://talk.onhyper.io/api/v1/auth/me \
  -H "Cookie: auth_token=eyJhbGciOiJIUzI1NiIs..."
```

**Success Response (200 OK):**

```json
{
  "success": true,
  "user": {
    "id": "user_abc123",
    "email": "you@example.com",
    "role": "user",
    "createdAt": "2026-02-26T14:00:00Z"
  }
}
```

**Error Responses:**

- `401 Unauthorized` — Not authenticated

---

## API Key Management Endpoints

### GET /api/keys

List all API keys for the authenticated user.

**Authentication:** Session required

**Example Request:**

```bash
curl -X GET https://talk.onhyper.io/api/keys
```

**Success Response (200 OK):**

```json
{
  "success": true,
  "keys": [
    {
      "id": "key_abc123",
      "prefix": "at_live_abc",
      "maskedKey": "at_live_abc***...",
      "name": "Default Key",
      "usageCount": 42,
      "lastUsedAt": "2026-02-27T10:30:00Z",
      "isActive": true,
      "createdAt": "2026-02-26T14:00:00Z"
    }
  ]
}
```

---

### POST /api/keys

Create a new API key.

**Authentication:** Session required

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | No | Key name (max 100 characters) |
| `test` | boolean | No | Create a test key (default: false) |

**Example Request:**

```bash
curl -X POST https://talk.onhyper.io/api/keys \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Production Key"
  }'
```

**Success Response (201 Created):**

```json
{
  "success": true,
  "key": {
    "id": "key_xyz789",
    "key": "at_live_def456ghi789...",
    "prefix": "at_live_def",
    "name": "Production Key",
    "createdAt": "2026-02-27T14:00:00Z"
  },
  "warning": "This is the only time the full API key will be shown. Store it securely!"
}
```

> **Note:** The full `key` is only shown once. Store it immediately!

---

### DELETE /api/keys/:id

Revoke an API key.

**Authentication:** Session required

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string | API key ID |

**Example Request:**

```bash
curl -X DELETE https://talk.onhyper.io/api/keys/key_abc123
```

**Success Response (200 OK):**

```json
{
  "success": true,
  "message": "API key revoked successfully"
}
```

**Error Responses:**

- `404 Not Found` — API key not found

---

## Text-to-Speech Endpoints

### GET /api/v1/voices

List all available voices.

**Authentication:** None (public endpoint)

**Example Request:**

```bash
curl https://talk.onhyper.io/api/v1/voices
```

**Success Response (200 OK):**

```json
{
  "voices": [
    {
      "id": "rachel",
      "name": "Rachel",
      "gender": "female",
      "description": "Calm, professional"
    },
    {
      "id": "domi",
      "name": "Domi",
      "gender": "female",
      "description": "Strong, confident"
    },
    {
      "id": "adam",
      "name": "Adam",
      "gender": "male",
      "description": "Deep narration"
    }
    // ... more voices
  ]
}
```

---

### POST /api/v1/memo

Convert text to speech.

**Authentication:** API Key required

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `text` | string | Yes | Text to convert (max varies by plan) |
| `voice` | string | Yes | Voice ID (see `/api/v1/voices`) |

**Example Request:**

```bash
curl -X POST https://talk.onhyper.io/api/v1/memo \
  -H "Authorization: Bearer at_live_abc123..." \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Hello from Agent Talk!",
    "voice": "rachel"
  }'
```

**Success Response (201 Created):**

```json
{
  "id": "memo_1739887200_abc123",
  "text": "Hello from Agent Talk!",
  "voice": {
    "id": "rachel",
    "name": "Rachel",
    "gender": "female",
    "description": "Calm, professional"
  },
  "audio": {
    "url": "data:audio/mpeg;base64,//uQxAAAAAANIA...",
    "duration": 1.2,
    "format": "mp3"
  },
  "createdAt": "2026-02-27T14:00:00Z"
}
```

**Error Responses:**

- `400 Bad Request` — Missing or invalid fields
- `401 Unauthorized` — Missing or invalid API key
- `403 Forbidden` — Revoked API key

---

### GET /api/v1/memo/:id

Get a memo by ID.

**Authentication:** API Key required

**Status:** Not implemented (returns 501)

---

### POST /api/v1/demo

Try text-to-speech without an API key (simulation mode).

**Authentication:** None (public)

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `text` | string | Yes | Text to convert |
| `voice` | string | Yes | Voice ID |

**Example Request:**

```bash
curl -X POST https://talk.onhyper.io/api/v1/demo \
  -H "Content-Type: application/json" \
  -d '{
    "text": "This is a demo!",
    "voice": "rachel"
  }'
```

**Success Response (201 Created):**

Returns the same format as `/api/v1/memo`, but audio is simulated (silent).

**Note:** Demo mode uses simulation audio. For production-quality ElevenLabs audio, sign up for an API key.

---

## Health Endpoint

### GET /health

Check API health and status.

**Authentication:** None (public)

**Example Request:**

```bash
curl https://talk.onhyper.io/health
```

**Success Response (200 OK):**

```json
{
  "status": "ok",
  "service": "Agent Talk API",
  "version": "1.0.0",
  "timestamp": "2026-02-27T14:00:00Z",
  "ttsMode": "elevenlabs",
  "database": {
    "status": "ok"
  }
}
```

---

## Response Format

All endpoints follow a consistent response format.

### Success Response

```json
{
  "success": true,
  // ... additional data
}
```

### Error Response

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": {
      "field": "voice",
      "reason": "Invalid voice ID",
      "availableVoices": ["rachel", "domi", "adam"]
    }
  }
}
```

See [Error Codes](./errors.md) for a complete list of error codes.
