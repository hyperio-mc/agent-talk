# Error Codes Reference

Agent Talk uses consistent error codes and HTTP status codes across all endpoints.

## Error Response Format

All errors follow this structure:

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": {
      // Optional additional context
      "field": "voice",
      "reason": "Invalid voice ID"
    }
  }
}
```

## HTTP Status Codes

| Status | Meaning | Description |
|--------|---------|-------------|
| `200` | OK | Request succeeded |
| `201` | Created | Resource created successfully |
| `400` | Bad Request | Invalid request body or parameters |
| `401` | Unauthorized | Authentication required or invalid |
| `403` | Forbidden | Valid auth but insufficient permissions |
| `404` | Not Found | Resource not found |
| `409` | Conflict | Resource already exists |
| `429` | Too Many Requests | Rate limit exceeded |
| `500` | Internal Server Error | Server error |
| `501` | Not Implemented | Feature not yet implemented |
| `503` | Service Unavailable | Service temporarily down |

---

## Validation Errors (400)

### VALIDATION_ERROR

General validation error.

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid JSON body",
    "details": {}
  }
}
```

### INVALID_INPUT

A field has an invalid value.

```json
{
  "error": {
    "code": "INVALID_INPUT",
    "message": "Invalid text: expected string",
    "details": {
      "field": "text",
      "reason": "expected string",
      "providedType": "number"
    }
  }
}
```

### MISSING_FIELD

A required field is missing.

```json
{
  "error": {
    "code": "MISSING_FIELD",
    "message": "Missing required field: text",
    "details": {
      "field": "text"
    }
  }
}
```

### INVALID_VOICE

The specified voice ID doesn't exist.

```json
{
  "error": {
    "code": "INVALID_VOICE",
    "message": "Invalid voice: \"unknown_voice\"",
    "details": {
      "field": "voice",
      "requestedVoice": "unknown_voice",
      "availableVoices": ["rachel", "domi", "adam", "sam", "charlie"]
    }
  }
}
```

**Solution:** Use `/api/v1/voices` to get valid voice IDs.

---

## Authentication Errors (401)

### UNAUTHORIZED

Authentication is required but missing or invalid.

```json
{
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Authentication required"
  }
}
```

### MISSING_API_KEY

API key is missing from the request.

```json
{
  "error": {
    "code": "MISSING_API_KEY",
    "message": "API key is required"
  }
}
```

**Solution:** Include the `Authorization` header:
```bash
-H "Authorization: Bearer YOUR_API_KEY"
```

### INVALID_API_KEY

The API key is invalid or malformed.

```json
{
  "error": {
    "code": "INVALID_API_KEY",
    "message": "Invalid API key"
  }
}
```

**Solution:** 
- Verify your API key is correct
- Check for typos or extra whitespace
- Ensure you copied the entire key

### EXPIRED_TOKEN

Session token has expired.

```json
{
  "error": {
    "code": "EXPIRED_TOKEN",
    "message": "Token has expired"
  }
}
```

**Solution:** Login again to get a new session token.

---

## Authorization Errors (403)

### FORBIDDEN

Valid authentication but insufficient permissions.

```json
{
  "error": {
    "code": "FORBIDDEN",
    "message": "Access denied"
  }
}
```

### INSUFFICIENT_TIER

Feature requires a higher tier subscription.

```json
{
  "error": {
    "code": "INSUFFICIENT_TIER",
    "message": "This feature requires pro tier",
    "details": {
      "requiredTier": "pro",
      "currentTier": "hobby"
    }
  }
}
```

### REVOKED_KEY

The API key has been revoked.

```json
{
  "error": {
    "code": "REVOKED_KEY",
    "message": "API key has been revoked"
  }
}
```

**Solution:** Generate a new API key from your account dashboard.

---

## Not Found Errors (404)

### NOT_FOUND

Generic resource not found.

```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "Resource not found"
  }
}
```

### MEMO_NOT_FOUND

Memo with specified ID not found.

```json
{
  "error": {
    "code": "MEMO_NOT_FOUND",
    "message": "Memo not found",
    "details": {
      "memoId": "memo_abc123"
    }
  }
}
```

---

## Rate Limiting Errors (429)

### RATE_LIMIT_EXCEEDED

General rate limit error.

```json
{
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Rate limit exceeded"
  }
}
```

### DAILY_LIMIT_EXCEEDED

Daily API call limit reached.

```json
{
  "error": {
    "code": "DAILY_LIMIT_EXCEEDED",
    "message": "Daily rate limit exceeded",
    "details": {
      "limit": 500,
      "used": 500,
      "resetAt": "2026-02-28T00:00:00Z"
    }
  }
}
```

### MONTHLY_LIMIT_EXCEEDED

Monthly API call limit reached.

```json
{
  "error": {
    "code": "MONTHLY_LIMIT_EXCEEDED",
    "message": "Monthly rate limit exceeded",
    "details": {
      "limit": 15000,
      "used": 15000,
      "resetAt": "2026-03-01T00:00:00Z"
    }
  }
}
```

**Solution:** Wait for the reset time or upgrade your plan.

---

## Server Errors (500)

### INTERNAL_ERROR

Unexpected server error.

```json
{
  "error": {
    "code": "INTERNAL_ERROR",
    "message": "Internal server error"
  }
}
```

### TTS_SERVICE_ERROR

Text-to-speech provider error.

```json
{
  "error": {
    "code": "TTS_SERVICE_ERROR",
    "message": "Text-to-speech service temporarily unavailable"
  }
}
```

**Solution:** Retry the request. If the error persists, contact support.

### STORAGE_ERROR

Storage operation failed.

```json
{
  "error": {
    "code": "STORAGE_ERROR",
    "message": "Storage operation failed",
    "details": {
      "operation": "write"
    }
  }
}
```

---

## Not Implemented (501)

### NOT_IMPLEMENTED

Feature is not yet implemented.

```json
{
  "error": {
    "code": "NOT_IMPLEMENTED",
    "message": "Memo retrieval is not implemented"
  }
}
```

---

## Service Unavailable (503)

### SERVICE_UNAVAILABLE

Service is temporarily unavailable.

```json
{
  "error": {
    "code": "SERVICE_UNAVAILABLE",
    "message": "ElevenLabs is temporarily unavailable"
  }
}
```

---

## Common Error Scenarios

### Scenario 1: Missing Authorization Header

**Request:**
```bash
curl -X POST https://talk.onhyper.io/api/v1/memo \
  -H "Content-Type: application/json" \
  -d '{"text": "Hello", "voice": "rachel"}'
```

**Response:**
```json
{
  "error": {
    "code": "MISSING_API_KEY",
    "message": "API key is required"
  }
}
```

**Fix:**
```bash
curl -X POST https://talk.onhyper.io/api/v1/memo \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"text": "Hello", "voice": "rachel"}'
```

---

### Scenario 2: Invalid Voice ID

**Request:**
```bash
curl -X POST https://talk.onhyper.io/api/v1/memo \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"text": "Hello", "voice": "robot"}'
```

**Response:**
```json
{
  "error": {
    "code": "INVALID_VOICE",
    "message": "Invalid voice: \"robot\"",
    "details": {
      "field": "voice",
      "requestedVoice": "robot",
      "availableVoices": ["rachel", "domi", "adam"]
    }
  }
}
```

**Fix:** Use a valid voice ID from the `availableVoices` list or call `/api/v1/voices` first.

---

### Scenario 3: Revoked API Key

**Request:**
```bash
curl -X POST https://talk.onhyper.io/api/v1/memo \
  -H "Authorization: Bearer REVOKED_KEY" \
  -H "Content-Type: application/json" \
  -d '{"text": "Hello", "voice": "rachel"}'
```

**Response:**
```json
{
  "error": {
    "code": "REVOKED_KEY",
    "message": "API key has been revoked"
  }
}
```

**Fix:** Login to your account and generate a new API key.

---

## Error Handling Best Practices

### 1. Check Both Code and Status

```javascript
if (response.status === 401) {
  const error = await response.json();
  if (error.error.code === 'MISSING_API_KEY') {
    // Prompt user for API key
  } else if (error.error.code === 'INVALID_API_KEY') {
    // API key is wrong
  } else if (error.error.code === 'REVOKED_KEY') {
    // Key was revoked, generate new one
  }
}
```

### 2. Use Details for Better Messages

```javascript
const error = await response.json();
if (error.error.details?.availableVoices) {
  console.log(`Invalid voice. Available voices: ${error.error.details.availableVoices.join(', ')}`);
}
```

### 3. Handle Rate Limits Gracefully

```javascript
if (response.status === 429) {
  const error = await response.json();
  const resetAt = new Date(error.error.details.resetAt);
  const waitMs = resetAt - new Date();
  console.log(`Rate limited. Try again in ${Math.ceil(waitMs / 60000)} minutes.`);
}
```

### 4. Retry Server Errors

```javascript
async function retryRequest(url, options, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    const response = await fetch(url, options);
    if (response.ok || response.status < 500) return response;
    await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
  }
  throw new Error('Request failed after retries');
}
```
