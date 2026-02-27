# Rate Limits

Agent Talk enforces rate limits to ensure fair usage and service stability.

## Limits by Tier

| Tier | Daily Limit | Monthly Limit | Concurrent Requests |
|------|-------------|---------------|---------------------|
| **Hobby** | 100 calls/day | 3,000 calls/month | 1 |
| **Pro** | 1,000 calls/day | 30,000 calls/month | 5 |
| **Enterprise** | Unlimited | Unlimited | 50 |

## Character Limits

Each tier has a maximum character limit per memo:

| Tier | Max Characters per Memo |
|------|-------------------------|
| **Hobby** | 5,000 |
| **Pro** | 20,000 |
| **Enterprise** | Unlimited |

## Rate Limit Headers

All API responses include rate limit information in the headers:

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1708732800
```

| Header | Description |
|--------|-------------|
| `X-RateLimit-Limit` | Your daily limit |
| `X-RateLimit-Remaining` | Calls remaining today |
| `X-RateLimit-Reset` | Unix timestamp when limits reset (midnight UTC) |

## Handling Rate Limit Errors

When you exceed your rate limit, the API returns a `429 Too Many Requests` response:

```json
{
  "error": {
    "code": "DAILY_LIMIT_EXCEEDED",
    "message": "Daily rate limit exceeded",
    "details": {
      "limit": 100,
      "used": 100,
      "resetAt": "2026-02-28T00:00:00Z"
    }
  }
}
```

### Best Practices

#### 1. Check Remaining Limits

```javascript
const response = await fetch('https://talk.onhyper.io/api/v1/memo', options);

const remaining = response.headers.get('X-RateLimit-Remaining');
const resetAt = new Date(parseInt(response.headers.get('X-RateLimit-Reset')) * 1000);

if (parseInt(remaining) < 10) {
  console.warn(`Only ${remaining} calls remaining. Resets at ${resetAt}`);
}
```

#### 2. Implement Exponential Backoff

```python
import time
import random

def make_request_with_backoff(url, payload, max_retries=5):
    for attempt in range(max_retries):
        response = requests.post(url, json=payload, headers=headers)
        
        if response.status_code == 429:
            # Exponential backoff with jitter
            wait_time = (2 ** attempt) + random.random()
            time.sleep(wait_time)
            continue
        
        return response
    
    raise Exception("Max retries exceeded")
```

#### 3. Cache Responses

For repetitive text, cache the audio to avoid duplicate API calls:

```javascript
const memoCache = new Map();

async function getCachedSpeech(text, voice) {
  const cacheKey = `${text}:${voice}`;
  
  if (memoCache.has(cacheKey)) {
    return memoCache.get(cacheKey);
  }
  
  const memo = await createMemo(text, voice);
  memoCache.set(cacheKey, memo);
  return memo;
}
```

## Concurrency Limits

Concurrent requests are limited to prevent server overload:

| Tier | Max Concurrent |
|------|----------------|
| Hobby | 1 |
| Pro | 5 |
| Enterprise | 50 |

If you exceed the concurrent request limit, the API returns:

```json
{
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Too many concurrent requests"
  }
}
```

## Upgrading Your Limits

Need more capacity? Upgrade your plan:

1. **Hobby → Pro**: Get 10x daily limit + ElevenLabs HD audio
2. **Pro → Enterprise**: Unlimited calls + dedicated support

Contact <hello@hyper.io> for enterprise pricing.

## Rate Limit Reset Schedule

Daily limits reset at **midnight UTC** each day.

Monthly limits reset on the **1st of each month at midnight UTC**.

```javascript
// Calculate time until reset
const resetTime = new Date(error.details.resetAt);
const now = new Date();
const hoursUntilReset = Math.ceil((resetTime - now) / (1000 * 60 * 60));

console.log(`Rate limit resets in ${hoursUntilReset} hours`);
```