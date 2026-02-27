# Agent Talk Python SDK

Python SDK for the Agent Talk API - Text-to-speech for AI agents.

## Installation

```bash
pip install agent-talk
```

## Quick Start

```python
from agent_talk import AgentTalk

# Initialize with your API key
client = AgentTalk(api_key="at_live_xxx")  # Get your key at https://talk.onhyper.io

# Create a memo (text-to-speech)
memo = client.memo.create(
    text="Hello from Agent Talk!",
    voice="rachel"
)

print(f"Audio URL: {memo.audio.url}")
print(f"Duration: {memo.audio.duration}s")

# Play audio (requires audio library)
# import pygame
# pygame.mixer.init()
# pygame.mixer.music.load(memo.audio.url)
# pygame.mixer.music.play()
```

## Demo Mode (No API Key)

Try the API without an API key (uses simulated audio):

```python
from agent_talk import AgentTalk

# No API key needed for demo
client = AgentTalk()

# List voices (no auth required)
voices = client.voices.list()
for voice in voices:
    print(f"{voice.id}: {voice.name} - {voice.description}")

# Create demo memo (simulated audio)
memo = client.memo.demo(
    text="This is a demo!",
    voice="rachel"
)
```

## API Reference

### Initialization

```python
from agent_talk import AgentTalk

client = AgentTalk(
    api_key="at_live_xxx",        # Required for memo.create()
    base_url="https://talk.onhyper.io",  # Optional, defaults to production
    timeout=30000                # Optional, request timeout in ms
)
```

### Memo API

#### Create a Memo

Convert text to speech:

```python
memo = client.memo.create(
    text="Hello world",
    voice="rachel"
)

print(memo.id)           # "memo_1739887200_abc123"
print(memo.text)        # "Hello world"
print(memo.voice.name)   # "Rachel"
print(memo.audio.url)   # "data:audio/mpeg;base64,..."
print(memo.audio.duration)  # 1.2
print(memo.audio.format)    # "mp3"
```

#### Demo Mode

```python
# No API key needed
memo = client.memo.demo(
    text="This is a demo",
    voice="rachel"
)
# Audio will be simulated/silent - sign up for real TTS
```

### Voices API

#### List Available Voices

```python
voices = client.voices.list()

for voice in voices:
    print(f"{voice.id}: {voice.name} ({voice.gender}) - {voice.description}")

# rachel: Rachel (female) - Calm, professional
# domi: Domi (female) - Strong, confident
# adam: Adam (male) - Deep narration
# ...
```

#### Get a Specific Voice

```python
voice = client.voices.get("rachel")
if voice:
    print(f"Found voice: {voice.name} - {voice.description}")
```

### Health Check

```python
health = client.health()
print(health.status)  # 'ok' or 'error'
print(health.tts_mode)  # 'simulation', 'edge', or 'elevenlabs'
```

## Error Handling

The SDK provides specific error types for different failure scenarios:

```python
from agent_talk import (
    AgentTalk,
    AgentTalkError,
    InvalidVoiceError,
    RateLimitError,
    InvalidApiKeyError,
    RevokedKeyError,
    MissingApiKeyError
)

try:
    memo = client.memo.create(
        text="Hello",
        voice="invalid_voice"
    )
except InvalidVoiceError as e:
    print(f"Invalid voice. Available voices: {e.details.available_voices}")
except RateLimitError:
    print("Rate limited. Try again later.")
except InvalidApiKeyError:
    print("API key is invalid")
except RevokedKeyError:
    print("API key was revoked. Generate a new one.")
except MissingApiKeyError:
    print("API key is required for this operation")
except AgentTalkError as e:
    print(f"Error: {e.message} (code: {e.code})")
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

## Working with Audio

### Save Audio to File

```python
import base64

memo = client.memo.create(
    text="Hello Python!",
    voice="adam"
)

# Extract base64 data from data URL
if memo.audio.url.startswith("data:audio/"):
    header, base64_data = memo.audio.url.split(",", 1)
    audio_bytes = base64.b64decode(base64_data)
    
    with open("output.mp3", "wb") as f:
        f.write(audio_bytes)
```

### Play Audio (platform-specific)

```python
# macOS - using afplay
import subprocess
import base64
import tempfile

# Decode audio
header, base64_data = memo.audio.url.split(",", 1)
audio_bytes = base64.b64decode(base64_data)

# Save to temp file
with tempfile.NamedTemporaryFile(suffix=".mp3", delete=False) as f:
    f.write(audio_bytes)
    temp_path = f.name

# Play
subprocess.run(["afplay", temp_path])
```

## Type Hints

Full type hints are included:

```python
from agent_talk import AgentTalk
from agent_talk.types import Voice, Memo, CreateMemoOptions

client = AgentTalk(api_key="at_live_xxx")

# All methods have type hints
voices: list[Voice] = client.voices.list()
memo: Memo = client.memo.create(text="Hello", voice="rachel")
```

## Getting an API Key

1. Visit [talk.onhyper.io](https://talk.onhyper.io)
2. Sign up for an account
3. Generate an API key from your dashboard

API keys start with `at_live_` for production or `at_test_` for testing.

## Requirements

- Python 3.8+
- No external dependencies (uses only stdlib)

## License

MIT