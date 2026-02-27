# Quick Start Guide

Get up and running with Agent Talk in 5 minutes.

## Prerequisites

- A valid email address
- cURL, JavaScript (fetch), or Python (requests) installed

## Step 1: Create Your Account

Sign up for a new account and receive your API key instantly.

### cURL

```bash
curl -X POST https://talk.onhyper.io/api/v1/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "you@example.com",
    "password": "your-secure-password"
  }'
```

### JavaScript

```javascript
const response = await fetch('https://talk.onhyper.io/api/v1/auth/signup', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'you@example.com',
    password: 'your-secure-password'
  })
});

const data = await response.json();
console.log('Your API Key:', data.apiKey.key);
// ⚠️ Save this key! It will only be shown once.
```

### Python

```python
import requests

response = requests.post(
    'https://talk.onhyper.io/api/v1/auth/signup',
    json={
        'email': 'you@example.com',
        'password': 'your-secure-password'
    }
)

data = response.json()
print(f'Your API Key: {data["apiKey"]["key"]}')
# ⚠️ Save this key! It will only be shown once.
```

**Response:**
```json
{
  "success": true,
  "user": {
    "id": "user_abc123",
    "email": "you@example.com",
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

> **Important:** Store your API key securely! It will only be shown once during signup.

## Step 2: List Available Voices

Before converting text to speech, see what voices are available.

### cURL

```bash
curl https://talk.onhyper.io/api/v1/voices
```

### JavaScript

```javascript
const response = await fetch('https://talk.onhyper.io/api/v1/voices');
const { voices } = await response.json();
console.log(voices);
```

### Python

```python
response = requests.get('https://talk.onhyper.io/api/v1/voices')
voices = response.json()['voices']
for voice in voices:
    print(f"{voice['id']}: {voice['name']} ({voice['description']})")
```

**Response:**
```json
{
  "voices": [
    { "id": "rachel", "name": "Rachel", "gender": "female", "description": "Calm, professional" },
    { "id": "domi", "name": "Domi", "gender": "female", "description": "Strong, confident" },
    { "id": "adam", "name": "Adam", "gender": "male", "description": "Deep narration" },
    // ... more voices
  ]
}
```

## Step 3: Convert Text to Speech

Now convert your first text to audio!

### cURL

```bash
curl -X POST https://talk.onhyper.io/api/v1/memo \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Hello from Agent Talk! This is your AI assistant speaking.",
    "voice": "rachel"
  }'
```

### JavaScript

```javascript
const API_KEY = 'at_live_abc123def456...'; // Your API key

const response = await fetch('https://talk.onhyper.io/api/v1/memo', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${API_KEY}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    text: 'Hello from Agent Talk! This is your AI assistant speaking.',
    voice: 'rachel'
  })
});

const memo = await response.json();
console.log('Memo ID:', memo.id);
console.log('Audio URL:', memo.audio.url);
```

### Python

```python
API_KEY = 'at_live_abc123def456...'  # Your API key

response = requests.post(
    'https://talk.onhyper.io/api/v1/memo',
    headers={
        'Authorization': f'Bearer {API_KEY}',
        'Content-Type': 'application/json'
    },
    json={
        'text': 'Hello from Agent Talk! This is your AI assistant speaking.',
        'voice': 'rachel'
    }
)

memo = response.json()
print(f'Memo ID: {memo["id"]}')
print(f'Audio URL: {memo["audio"]["url"][:50]}...')
```

**Response:**
```json
{
  "id": "memo_1739887200_abc123",
  "text": "Hello from Agent Talk! This is your AI assistant speaking.",
  "voice": {
    "id": "rachel",
    "name": "Rachel",
    "gender": "female",
    "description": "Calm, professional"
  },
  "audio": {
    "url": "data:audio/mpeg;base64,//uQxAAAAAANIA...",
    "duration": 3.5,
    "format": "mp3"
  },
  "createdAt": "2026-02-27T14:00:00Z"
}
```

## Step 4: Play the Audio

The audio is returned as a base64-encoded data URL. You can play it directly in a browser or decode it to save as a file.

### JavaScript (Browser)

```javascript
// The audio URL is a data URL that can be used directly
const audio = new Audio(memo.audio.url);
audio.play();
```

### JavaScript (Node.js)

```javascript
import fs from 'fs';

// Extract base64 data from the data URL
const base64Data = memo.audio.url.split(',')[1];
const buffer = Buffer.from(base64Data, 'base64');
fs.writeFileSync('output.mp3', buffer);
console.log('Audio saved to output.mp3');
```

### Python

```python
import base64

# Extract base64 data from the data URL
base64_data = memo['audio']['url'].split(',')[1]
audio_bytes = base64.b64decode(base64_data)

with open('output.mp3', 'wb') as f:
    f.write(audio_bytes)

print('Audio saved to output.mp3')
```

## Step 5: Try the Demo (No API Key Required)

Want to test before signing up? Use the demo endpoint — no authentication required!

```bash
curl -X POST https://talk.onhyper.io/api/v1/demo \
  -H "Content-Type: application/json" \
  -d '{
    "text": "This is a demo!",
    "voice": "rachel"
  }'
```

> **Note:** Demo mode uses simulation (silent audio). For production-quality ElevenLabs audio, sign up for an API key.

## Next Steps

- Read the full [Endpoints Reference](./endpoints.md)
- Learn about [Authentication](./authentication.md)
- See more [Code Examples](./examples.md)
- Handle errors with the [Error Codes](./errors.md) reference

## Common Issues

### Invalid API Key

Make sure you're using the correct header format:
```bash
Authorization: Bearer at_live_abc123...
```

### Missing Fields

Both `text` and `voice` are required:
```json
{
  "text": "Your text here",
  "voice": "rachel"
}
```

### Invalid Voice

Check available voices with `/api/v1/voices` before making requests.
