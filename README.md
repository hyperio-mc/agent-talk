# Agent Talk

**Give your AI agent a voice.**

Agent Talk is a text-to-speech API designed for AI agents. One API call transforms your text responses into natural speech.

## Features

- 🎙️ **10+ Natural Voices** - Rachel, Domi, Adam, Charlie, Emily, Freya and more
- ⚡ **50ms Avg Latency** - Fast response times for real-time interactions
- 📦 **Persistent Storage** - Audio files stored and served automatically
- 🔄 **Multiple Providers** - ElevenLabs, Edge TTS, and simulation mode
- 🔐 **Simple Auth** - API key authentication with usage tracking

## Quick Start

```bash
# Install dependencies
npm install

# Run dev server
npm run dev

# Build for production
npm run build
```

## API Usage

```javascript
// Create a memo (text-to-speech)
const response = await fetch('https://talk.onhyper.io/api/v1/memo', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer YOUR_API_KEY'
  },
  body: JSON.stringify({
    text: "Hello! I'm your AI assistant.",
    voice: "rachel"
  })
});

const { audio } = await response.json();
// → { url: "https://talk.onhyper.io/audio/memo_abc123.mp3", duration: 2.5 }

// Play the audio
new Audio(audio.url).play();
```

## Voices

| ID | Name | Style |
|----|------|-------|
| `rachel` | Rachel | Calm, professional |
| `domi` | Domi | Strong, confident |
| `adam` | Adam | Deep narration |
| `charlie` | Charlie | Casual conversational |
| `emily` | Emily | Soft, gentle |
| `freya` | Freya | Young, energetic |

## Pricing

- **Hobby** - $0/mo, 100 calls/day, Edge TTS
- **Pro** - $19/mo, 1,000 calls/day, ElevenLabs HD
- **Enterprise** - Custom, unlimited, voice cloning

## Tech Stack

- **Frontend**: Vite + Svelte
- **Backend**: Hono (deployed on HYPR)
- **TTS**: ElevenLabs, Edge TTS
- **Storage**: HYPR storage

## License

MIT