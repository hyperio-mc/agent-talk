# Agent Talk SDK

TypeScript SDK for the Agent Talk API - Text-to-speech for AI agents.

## Installation

```bash
npm install @hyperio/agent-talk
# or
yarn add @hyperio/agent-talk
# or
pnpm add @hyperio/agent-talk
```

## Quick Start

```typescript
import { AgentTalk } from '@hyperio/agent-talk';

// Initialize with your API key
const client = new AgentTalk({
  apiKey: 'at_live_xxx'  // Get your key at https://talk.onhyper.io
});

// Create a memo (text-to-speech)
const memo = await client.memo.create({
  text: "Hello from Agent Talk!",
  voice: "rachel"
});

// In browser: play the audio
const audio = new Audio(memo.audio.url);
audio.play();

// In Node.js: save the audio
// memo.audio.url contains a data URL or remote URL
console.log(`Audio duration: ${memo.audio.duration}s`);
```

## API Reference

### Initialization

```typescript
const client = new AgentTalk({
  apiKey: 'at_live_xxx',     // Required for memo.create()
  baseUrl: 'https://talk.onhyper.io',  // Optional, defaults to production
  timeout: 30000              // Optional, request timeout in ms
});
```

### Memo API

#### Create a Memo

Convert text to speech:

```typescript
const memo = await client.memo.create({
  text: "Hello world",
  voice: "rachel"
});

console.log(memo);
// {
//   id: "memo_1739887200_abc123",
//   text: "Hello world",
//   voice: { id: "rachel", name: "Rachel", gender: "female", description: "Calm, professional" },
//   audio: { url: "data:audio/mpeg;base64,...", duration: 1.2, format: "mp3" },
//   createdAt: "2026-02-27T14:00:00Z"
// }
```

#### Demo Mode (No API Key)

Try the API without an API key (uses simulated audio):

```typescript
const client = new AgentTalk();  // No API key

const memo = await client.memo.demo({
  text: "This is a demo",
  voice: "rachel"
});

// Audio will be simulated/silent - sign up for real TTS
```

### Voices API

#### List Available Voices

```typescript
const voices = await client.voices.list();

console.log(voices);
// [
//   { id: 'rachel', name: 'Rachel', gender: 'female', description: 'Calm, professional' },
//   { id: 'domi', name: 'Domi', gender: 'female', description: 'Strong, confident' },
//   { id: 'adam', name: 'Adam', gender: 'male', description: 'Deep narration' },
//   ...
// ]
```

#### Get a Specific Voice

```typescript
const voice = await client.voices.get('rachel');
if (voice) {
  console.log(`Voice: ${voice.name} - ${voice.description}`);
}
```

### Health Check

```typescript
const health = await client.health();
console.log(health.status); // 'ok' or 'error'
```

## Error Handling

The SDK provides specific error types for different failure scenarios:

```typescript
import {
  AgentTalkError,
  InvalidVoiceError,
  RateLimitError,
  InvalidApiKeyError,
  RevokedKeyError,
  MissingApiKeyError
} from '@hyperio/agent-talk';

try {
  const memo = await client.memo.create({
    text: "Hello",
    voice: "invalid_voice"
  });
} catch (error) {
  if (error instanceof InvalidVoiceError) {
    console.log('Invalid voice. Available voices:', error.details?.availableVoices);
  } else if (error instanceof RateLimitError) {
    console.log('Rate limited. Try again later.');
  } else if (error instanceof InvalidApiKeyError) {
    console.log('API key is invalid');
  } else if (error instanceof RevokedKeyError) {
    console.log('API key was revoked. Generate a new one.');
  } else if (error instanceof MissingApiKeyError) {
    console.log('API key is required for this operation');
  }
}
```

### Error Types

| Error | Code | Description |
|-------|------|-------------|
| `ValidationError` | `VALIDATION_ERROR` | Invalid request data |
| `InvalidVoiceError` | `INVALID_VOICE` | Voice ID doesn't exist |
| `MissingApiKeyError` | `MISSING_API_KEY` | API key not provided |
| `InvalidApiKeyError` | `INVALID_API_KEY` | API key is invalid |
| `RevokedKeyError` | `REVOKED_KEY` | API key was revoked |
| `RateLimitError` | `RATE_LIMIT_EXCEEDED` | Rate limit hit |
| `DailyLimitExceededError` | `DAILY_LIMIT_EXCEEDED` | Daily quota exceeded |
| `MonthlyLimitExceededError` | `MONTHLY_LIMIT_EXCEEDED` | Monthly quota exceeded |
| `TTSServiceError` | `TTS_SERVICE_ERROR` | TTS provider error |
| `ServiceUnavailableError` | `SERVICE_UNAVAILABLE` | Service temporarily down |

## TypeScript Support

Full TypeScript support with exported types:

```typescript
import type {
  Voice,
  Memo,
  CreateMemoOptions,
  HealthResponse,
  AgentTalkConfig
} from '@hyperio/agent-talk';
```

## Browser Usage

The SDK works in modern browsers. For audio playback:

```typescript
const client = new AgentTalk({ apiKey: 'at_live_xxx' });

const memo = await client.memo.create({
  text: "Hello browser!",
  voice: "rachel"
});

// Audio URL can be a data URL or remote URL
const audio = new Audio(memo.audio.url);
await audio.play();
```

## Node.js Usage

In Node.js, you can work with the audio data:

```typescript
import { writeFileSync } from 'fs';

const memo = await client.memo.create({
  text: "Hello Node.js!",
  voice: "adam"
});

// Extract base64 data from data URL
if (memo.audio.url.startsWith('data:audio/')) {
  const [header, base64] = memo.audio.url.split(',');
  const buffer = Buffer.from(base64, 'base64');
  writeFileSync('output.mp3', buffer);
}
```

## Getting an API Key

1. Visit [talk.onhyper.io](https://talk.onhyper.io)
2. Sign up for an account
3. Generate an API key from your dashboard

API keys start with `at_live_` for production or `at_test_` for testing.

## License

MIT
