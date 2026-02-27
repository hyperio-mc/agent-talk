# Authentication

Agent Talk uses two authentication methods for different use cases.

## Authentication Methods

| Method | Use Case | Header Format |
|--------|----------|---------------|
| **Session Auth** | User account management (signup, login, API key management) | Cookie-based session |
| **API Key Auth** | TTS operations (text-to-speech) | `Authorization: Bearer YOUR_API_KEY` |

## API Key Authentication

API keys are used for text-to-speech operations. Include your key in the `Authorization` header with the `Bearer` prefix.

### Header Format

```
Authorization: Bearer at_live_abc123def456ghi789...
```

### Example Request

```bash
curl -X POST https://talk.onhyper.io/api/v1/memo \
  -H "Authorization: Bearer at_live_abc123def456..." \
  -H "Content-Type: application/json" \
  -d '{"text": "Hello!", "voice": "rachel"}'
```

### API Key Format

API keys follow this format:
- **Live keys:** `at_live_` prefix + random characters
- **Test keys:** `at_test_` prefix + random characters

Example: `at_live_abc123def456ghi789jkl012mno345pqr678`

## Getting an API Key

### Method 1: During Signup

When you create an account, a default API key is automatically generated:

```bash
curl -X POST https://talk.onhyper.io/api/v1/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "you@example.com",
    "password": "your-password"
  }'
```

Response includes:
```json
{
  "apiKey": {
    "id": "key_xyz789",
    "key": "at_live_abc123...",  // Full key - save it!
    "prefix": "at_live_abc",
    "name": "Default Key"
  }
}
```

> ⚠️ **Important:** The full API key is only shown once during signup. Store it securely!

### Method 2: Create Additional Keys

After logging in, create additional API keys:

```bash
# First, login to get a session token
curl -X POST https://talk.onhyper.io/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "you@example.com", "password": "your-password"}'

# The token is set as an HttpOnly cookie
# Now create a new API key
curl -X POST https://talk.onhyper.io/api/keys \
  -H "Content-Type: application/json" \
  -d '{"name": "Production Key"}'
```

Response:
```json
{
  "success": true,
  "key": {
    "id": "key_new123",
    "key": "at_live_xyz789...",  // Full key - save it!
    "prefix": "at_live_xyz",
    "name": "Production Key",
    "createdAt": "2026-02-27T14:00:00Z"
  },
  "warning": "This is the only time the full API key will be shown. Store it securely!"
}
```

## Managing API Keys

Endpoints for managing your API keys require session authentication (login first).

### List All Keys

```bash
curl -X GET https://talk.onhyper.io/api/keys
```

Response:
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

### Revoke a Key

```bash
curl -X DELETE https://talk.onhyper.io/api/keys/key_abc123
```

Response:
```json
{
  "success": true,
  "message": "API key revoked successfully"
}
```

## Session Authentication

User account management uses cookie-based session authentication.

### Login

```bash
curl -X POST https://talk.onhyper.io/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "you@example.com",
    "password": "your-password"
  }'
```

Response includes a session token in both the response body and as an HttpOnly cookie:

```json
{
  "success": true,
  "user": {
    "id": "user_xyz789",
    "email": "you@example.com",
    "createdAt": "2026-02-26T14:00:00Z"
  },
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "expiresAt": "2026-02-28T14:00:00Z"
}
```

### Get Current User

```bash
curl -X GET https://talk.onhyper.io/api/v1/auth/me \
  -H "Cookie: auth_token=eyJhbGciOiJIUzI1NiIs..."
```

Response:
```json
{
  "success": true,
  "user": {
    "id": "user_xyz789",
    "email": "you@example.com",
    "role": "user",
    "createdAt": "2026-02-26T14:00:00Z"
  }
}
```

### Logout

```bash
curl -X POST https://talk.onhyper.io/api/v1/auth/logout
```

Response:
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

## Security Best Practices

### Store Keys Securely

- **Never** commit API keys to version control
- Use environment variables: `process.env.AGENT_TALK_API_KEY`
- Use secrets management in production (AWS Secrets Manager, HashiCorp Vault)

### Use Different Keys for Different Environments

Create separate keys for:
- Development
- Staging
- Production

```bash
# Create dev key
curl -X POST https://talk.onhyper.io/api/keys \
  -d '{"name": "Development", "test": true}'

# Create production key
curl -X POST https://talk.onhyper.io/api/keys \
  -d '{"name": "Production"}'
```

### Rotate Keys Periodically

1. Create a new key
2. Update your application with the new key
3. Revoke the old key

```bash
# Revoke old key
curl -X DELETE https://talk.onhyper.io/api/keys/key_old123
```

### Monitor Key Usage

Check usage regularly:
```bash
curl -X GET https://talk.onhyper.io/api/keys
# Look at usageCount and lastUsedAt fields
```

If you see unexpected usage, revoke the key immediately.

## Authentication Errors

### Missing API Key (401)

```json
{
  "error": {
    "code": "MISSING_API_KEY",
    "message": "API key is required"
  }
}
```

**Solution:** Include the `Authorization` header with your request:
```bash
-H "Authorization: Bearer YOUR_API_KEY"
```

### Invalid API Key (401)

```json
{
  "error": {
    "code": "INVALID_API_KEY",
    "message": "Invalid API key"
  }
}
```

**Solution:** Verify your API key is correct. Check for typos or extra whitespace.

### Revoked Key (403)

```json
{
  "error": {
    "code": "REVOKED_KEY",
    "message": "API key has been revoked"
  }
}
```

**Solution:** Generate a new API key from your account.

### Unauthorized (401)

```json
{
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Authentication required"
  }
}
```

**Solution:** Login first to get a session token, or include your API key.

## Token Expiration

Session tokens expire after 24 hours. After expiration:

1. Make a new login request
2. Store the new token
3. Continue making requests

API keys do not expire but can be revoked.
