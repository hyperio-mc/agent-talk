# Code Examples

Complete code examples for common use cases in cURL, JavaScript, and Python.

## Table of Contents

1. [Authentication](#authentication)
2. [API Key Management](#api-key-management)
3. [Text-to-Speech](#text-to-speech)
4. [Error Handling](#error-handling)
5. [Complete Examples](#complete-examples)

---

## Authentication

### Sign Up

#### cURL

```bash
curl -X POST https://talk.onhyper.io/api/v1/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "you@example.com",
    "password": "your-secure-password"
  }'
```

#### JavaScript

```javascript
async function signUp(email, password) {
  const response = await fetch('https://talk.onhyper.io/api/v1/auth/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error.message);
  }

  const data = await response.json();
  
  // ⚠️ Save the API key - it's only shown once!
  localStorage.setItem('apiKey', data.apiKey.key);
  localStorage.setItem('token', data.token);
  
  return data;
}

// Usage
signUp('you@example.com', 'your-password')
  .then(data => console.log('API Key:', data.apiKey.key))
  .catch(err => console.error('Signup failed:', err.message));
```

#### Python

```python
import requests

def sign_up(email, password):
    response = requests.post(
        'https://talk.onhyper.io/api/v1/auth/signup',
        json={'email': email, 'password': password}
    )
    
    if not response.ok:
        error = response.json()
        raise Exception(error['error']['message'])
    
    data = response.json()
    
    # ⚠️ Save the API key - it's only shown once!
    with open('.api_key', 'w') as f:
        f.write(data['apiKey']['key'])
    
    return data

# Usage
try:
    data = sign_up('you@example.com', 'your-password')
    print(f"API Key: {data['apiKey']['key']}")
except Exception as e:
    print(f"Signup failed: {e}")
```

---

### Login

#### cURL

```bash
curl -X POST https://talk.onhyper.io/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "you@example.com",
    "password": "your-password"
  }'
```

#### JavaScript

```javascript
async function login(email, password) {
  const response = await fetch('https://talk.onhyper.io/api/v1/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error.message);
  }

  const data = await response.json();
  
  // Token is also set as HttpOnly cookie
  localStorage.setItem('token', data.token);
  
  return data;
}

// Usage
login('you@example.com', 'your-password')
  .then(data => console.log('Logged in as:', data.user.email))
  .catch(err => console.error('Login failed:', err.message));
```

#### Python

```python
import requests

def login(session, email, password):
    response = session.post(
        'https://talk.onhyper.io/api/v1/auth/login',
        json={'email': email, 'password': password}
    )
    
    if not response.ok:
        error = response.json()
        raise Exception(error['error']['message'])
    
    return response.json()

# Usage
session = requests.Session()
try:
    data = login(session, 'you@example.com', 'your-password')
    print(f"Logged in as: {data['user']['email']}")
except Exception as e:
    print(f"Login failed: {e}")
```

---

### Logout

#### cURL

```bash
curl -X POST https://talk.onhyper.io/api/v1/auth/logout
```

#### JavaScript

```javascript
async function logout() {
  const response = await fetch('https://talk.onhyper.io/api/v1/auth/logout', {
    method: 'POST'
  });
  
  localStorage.removeItem('token');
  
  return response.json();
}
```

#### Python

```python
def logout(session):
    response = session.post('https://talk.onhyper.io/api/v1/auth/logout')
    return response.json()
```

---

## API Key Management

### List API Keys

#### cURL

```bash
curl -X GET https://talk.onhyper.io/api/keys
```

#### JavaScript

```javascript
async function listApiKeys() {
  const response = await fetch('https://talk.onhyper.io/api/keys', {
    credentials: 'include' // Include session cookie
  });

  if (!response.ok) {
    throw new Error('Failed to fetch API keys');
  }

  const data = await response.json();
  return data.keys;
}

// Usage
listApiKeys().then(keys => {
  keys.forEach(key => {
    console.log(`${key.name}: ${key.maskedKey} (${key.usageCount} uses)`);
  });
});
```

#### Python

```python
def list_api_keys(session):
    response = session.get('https://talk.onhyper.io/api/keys')
    response.raise_for_status()
    return response.json()['keys']

# Usage
keys = list_api_keys(session)
for key in keys:
    print(f"{key['name']}: {key['maskedKey']} ({key['usageCount']} uses)")
```

---

### Create API Key

#### cURL

```bash
curl -X POST https://talk.onhyper.io/api/keys \
  -H "Content-Type: application/json" \
  -d '{"name": "Production Key"}'
```

#### JavaScript

```javascript
async function createApiKey(name, test = false) {
  const response = await fetch('https://talk.onhyper.io/api/keys', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ name, test })
  });

  if (!response.ok) {
    throw new Error('Failed to create API key');
  }

  const data = await response.json();
  
  // ⚠️ Store the key securely - it's only shown once!
  console.log('New API Key:', data.key.key);
  
  return data.key;
}
```

#### Python

```python
def create_api_key(session, name, test=False):
    response = session.post(
        'https://talk.onhyper.io/api/keys',
        json={'name': name, 'test': test}
    )
    response.raise_for_status()
    
    data = response.json()
    
    # ⚠️ Store the key securely - it's only shown once!
    print(f"New API Key: {data['key']['key']}")
    
    return data['key']
```

---

### Revoke API Key

#### cURL

```bash
curl -X DELETE https://talk.onhyper.io/api/keys/key_abc123
```

#### JavaScript

```javascript
async function revokeApiKey(keyId) {
  const response = await fetch(`https://talk.onhyper.io/api/keys/${keyId}`, {
    method: 'DELETE',
    credentials: 'include'
  });

  if (!response.ok) {
    throw new Error('Failed to revoke API key');
  }

  return response.json();
}
```

#### Python

```python
def revoke_api_key(session, key_id):
    response = session.delete(f'https://talk.onhyper.io/api/keys/{key_id}')
    response.raise_for_status()
    return response.json()
```

---

## Text-to-Speech

### List Voices

#### cURL

```bash
curl https://talk.onhyper.io/api/v1/voices
```

#### JavaScript

```javascript
async function listVoices() {
  const response = await fetch('https://talk.onhyper.io/api/v1/voices');
  const data = await response.json();
  return data.voices;
}

// Usage
listVoices().then(voices => {
  voices.forEach(voice => {
    console.log(`${voice.id}: ${voice.name} (${voice.description})`);
  });
});
```

#### Python

```python
def list_voices():
    response = requests.get('https://talk.onhyper.io/api/v1/voices')
    return response.json()['voices']

# Usage
voices = list_voices()
for voice in voices:
    print(f"{voice['id']}: {voice['name']} ({voice['description']})")
```

---

### Generate Speech

#### cURL

```bash
curl -X POST https://talk.onhyper.io/api/v1/memo \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Hello from Agent Talk!",
    "voice": "rachel"
  }'
```

#### JavaScript (Browser - Play Audio)

```javascript
const API_KEY = 'at_live_abc123...';

async function speak(text, voice = 'rachel') {
  const response = await fetch('https://talk.onhyper.io/api/v1/memo', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ text, voice })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error.message);
  }

  const memo = await response.json();
  
  // Play audio immediately
  const audio = new Audio(memo.audio.url);
  await audio.play();
  
  return memo;
}

// Usage
speak('Hello from Agent Talk!', 'rachel')
  .then(memo => console.log('Duration:', memo.audio.duration))
  .catch(err => console.error('TTS failed:', err.message));
```

#### JavaScript (Node.js - Save to File)

```javascript
import fs from 'fs';

const API_KEY = 'at_live_abc123...';

async function generateSpeech(text, voice = 'rachel', outputFile = 'output.mp3') {
  const response = await fetch('https://talk.onhyper.io/api/v1/memo', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ text, voice })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error.message);
  }

  const memo = await response.json();
  
  // Extract base64 data and save to file
  const base64Data = memo.audio.url.split(',')[1];
  const buffer = Buffer.from(base64Data, 'base64');
  fs.writeFileSync(outputFile, buffer);
  
  console.log(`Audio saved to ${outputFile}`);
  return memo;
}

// Usage
generateSpeech('Hello from Agent Talk!', 'rachel', 'hello.mp3');
```

#### Python (Save to File)

```python
import requests
import base64

API_KEY = 'at_live_abc123...'

def generate_speech(text, voice='rachel', output_file='output.mp3'):
    response = requests.post(
        'https://talk.onhyper.io/api/v1/memo',
        headers={
            'Authorization': f'Bearer {API_KEY}',
            'Content-Type': 'application/json'
        },
        json={'text': text, 'voice': voice}
    )
    
    if not response.ok:
        error = response.json()
        raise Exception(error['error']['message'])
    
    memo = response.json()
    
    # Extract base64 data and save to file
    base64_data = memo['audio']['url'].split(',')[1]
    audio_bytes = base64.b64decode(base64_data)
    
    with open(output_file, 'wb') as f:
        f.write(audio_bytes)
    
    print(f"Audio saved to {output_file}")
    return memo

# Usage
memo = generate_speech('Hello from Agent Talk!', 'rachel', 'hello.mp3')
print(f"Duration: {memo['audio']['duration']} seconds")
```

---

### Demo Endpoint (No API Key)

#### cURL

```bash
curl -X POST https://talk.onhyper.io/api/v1/demo \
  -H "Content-Type: application/json" \
  -d '{
    "text": "This is a demo!",
    "voice": "rachel"
  }'
```

#### JavaScript

```javascript
async function tryDemo(text, voice = 'rachel') {
  const response = await fetch('https://talk.onhyper.io/api/v1/demo', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, voice })
  });

  return response.json();
}

// Usage
tryDemo('This is a demo!', 'rachel')
  .then(memo => console.log('Memo created:', memo.id))
  .catch(err => console.error('Demo failed:', err));
```

---

## Error Handling

### JavaScript

```javascript
async function safeSpeak(text, voice = 'rachel') {
  try {
    const response = await fetch('https://talk.onhyper.io/api/v1/memo', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ text, voice })
    });

    const data = await response.json();

    if (!response.ok) {
      // Handle specific error codes
      switch (data.error.code) {
        case 'MISSING_API_KEY':
          throw new Error('Please set your API key');
        case 'INVALID_API_KEY':
          throw new Error('API key is invalid. Check your credentials.');
        case 'REVOKED_KEY':
          throw new Error('API key was revoked. Generate a new one.');
        case 'INVALID_VOICE':
          const validVoices = data.error.details.availableVoices.join(', ');
          throw new Error(`Invalid voice. Available: ${validVoices}`);
        case 'DAILY_LIMIT_EXCEEDED':
          const resetAt = new Date(data.error.details.resetAt);
          throw new Error(`Daily limit exceeded. Resets at ${resetAt.toLocaleTimeString()}`);
        default:
          throw new Error(data.error.message);
      }
    }

    return data;
  } catch (error) {
    console.error('TTS Error:', error.message);
    throw error;
  }
}
```

### Python

```python
import requests
from datetime import datetime

def safe_speak(text, voice='rachel'):
    try:
        response = requests.post(
            'https://talk.onhyper.io/api/v1/memo',
            headers={
                'Authorization': f'Bearer {API_KEY}',
                'Content-Type': 'application/json'
            },
            json={'text': text, 'voice': voice}
        )
        
        data = response.json()
        
        if not response.ok:
            error_code = data.get('error', {}).get('code')
            error_message = data.get('error', {}).get('message', 'Unknown error')
            details = data.get('error', {}).get('details', {})
            
            if error_code == 'MISSING_API_KEY':
                raise Exception('Please set your API key')
            elif error_code == 'INVALID_API_KEY':
                raise Exception('API key is invalid. Check your credentials.')
            elif error_code == 'REVOKED_KEY':
                raise Exception('API key was revoked. Generate a new one.')
            elif error_code == 'INVALID_VOICE':
                voices = details.get('availableVoices', [])
                raise Exception(f'Invalid voice. Available: {", ".join(voices)}')
            elif error_code == 'DAILY_LIMIT_EXCEEDED':
                reset_at = details.get('resetAt')
                reset_time = datetime.fromisoformat(reset_at.replace('Z', '+00:00'))
                raise Exception(f'Daily limit exceeded. Resets at {reset_time}')
            else:
                raise Exception(error_message)
        
        return data
        
    except requests.RequestException as e:
        raise Exception(f'Network error: {e}')
```

---

## Complete Examples

### Browser Widget

```html
<!DOCTYPE html>
<html>
<head>
  <title>Agent Talk Demo</title>
</head>
<body>
  <textarea id="text" placeholder="Enter text...">Hello from Agent Talk!</textarea>
  <select id="voice">
    <option value="rachel">Rachel</option>
    <option value="adam">Adam</option>
    <option value="sam">Sam</option>
  </select>
  <button id="speak">Speak</button>
  <div id="error"></div>

  <script>
    const API_KEY = 'your-api-key-here';
    
    document.getElementById('speak').addEventListener('click', async () => {
      const text = document.getElementById('text').value;
      const voice = document.getElementById('voice').value;
      const errorDiv = document.getElementById('error');
      
      errorDiv.textContent = '';
      
      try {
        const response = await fetch('https://talk.onhyper.io/api/v1/memo', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${API_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ text, voice })
        });
        
        const data = await response.json();
        
        if (!response.ok) {
          throw new Error(data.error.message);
        }
        
        const audio = new Audio(data.audio.url);
        await audio.play();
        
      } catch (error) {
        errorDiv.textContent = error.message;
      }
    });
  </script>
</body>
</html>
```

---

### Python Command-Line Tool

```python
#!/usr/bin/env python3
import requests
import base64
import argparse
import sys
import os

API_KEY = os.environ.get('AGENT_TALK_API_KEY')
BASE_URL = 'https://talk.onhyper.io'

def speak(text, voice='rachel', output=None):
    """Convert text to speech"""
    if not API_KEY:
        print("Error: Set AGENT_TALK_API_KEY environment variable")
        sys.exit(1)
    
    response = requests.post(
        f'{BASE_URL}/api/v1/memo',
        headers={
            'Authorization': f'Bearer {API_KEY}',
            'Content-Type': 'application/json'
        },
        json={'text': text, 'voice': voice}
    )
    
    if not response.ok:
        error = response.json()
        print(f"Error: {error['error']['message']}")
        sys.exit(1)
    
    memo = response.json()
    
    if output:
        base64_data = memo['audio']['url'].split(',')[1]
        audio_bytes = base64.b64decode(base64_data)
        with open(output, 'wb') as f:
            f.write(audio_bytes)
        print(f"Saved to {output} ({memo['audio']['duration']} seconds)")
    else:
        print(memo['audio']['url'])
    
    return memo

def list_voices():
    """List available voices"""
    response = requests.get(f'{BASE_URL}/api/v1/voices')
    voices = response.json()['voices']
    
    for v in voices:
        print(f"{v['id']:12} {v['name']:10} {v['description']}")

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Agent Talk CLI')
    subparsers = parser.add_subparsers(dest='command', required=True)
    
    # speak command
    speak_parser = subparsers.add_parser('speak', help='Convert text to speech')
    speak_parser.add_argument('text', help='Text to convert')
    speak_parser.add_argument('--voice', '-v', default='rachel', help='Voice ID')
    speak_parser.add_argument('--output', '-o', help='Output file (default: print URL)')
    
    # voices command
    subparsers.add_parser('voices', help='List available voices')
    
    args = parser.parse_args()
    
    if args.command == 'speak':
        speak(args.text, args.voice, args.output)
    elif args.command == 'voices':
        list_voices()
```

Usage:
```bash
export AGENT_TALK_API_KEY=at_live_abc123...
python agent_talk.py speak "Hello world" --voice rachel --output hello.mp3
python agent_talk.py voices
```
