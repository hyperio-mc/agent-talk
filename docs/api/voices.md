# Voices Reference

Agent Talk offers 12 natural voices across male and female speakers. Each voice has unique characteristics suited for different use cases.

## Voice List

### Female Voices

| ID | Name | Style | Best For |
|----|------|-------|----------|
| `rachel` | Rachel | Calm, professional | Customer service, tutorials, narration |
| `domi` | Domi | Strong, confident | Presentations, announcements, marketing |
| `bella` | Bella | Soft, warm | Meditation, bedtime stories, relaxation |
| `emily` | Emily | Soft, gentle | Children's content, gentle prompts |
| `freya` | Freya | Young, energetic | Youth-oriented content, gaming |
| `dorothy` | Dorothy | Storyteller | Audiobooks, long-form content |
| `sarah` | Sarah | Professional female | Business, corporate presentations |

### Male Voices

| ID | Name | Style | Best For |
|----|------|-------|----------|
| `adam` | Adam | Deep narration | Documentaries, serious content |
| `sam` | Sam | Conversational | Casual interactions, chatbots |
| `charlie` | Charlie | Casual conversational | Friendly prompts, notifications |
| `ethan` | Ethan | Young male | Youth content, gaming |
| `bill` | Bill | Mature male | Authority, trust, experience |

## Voice Details

### Rachel

```
ID: rachel
Gender: Female
Style: Calm, professional
Provider: ElevenLabs
```

**Best for:** Customer service, tutorials, documentation narration, professional settings

**Characteristics:**
- Clear articulation
- Measured pace
- Neutral accent
- Warm but professional tone

**Sample text:**
> "Welcome to Agent Talk. I'm here to help you get started with our text-to-speech API. Let me guide you through the basics."

---

### Domi

```
ID: domi
Gender: Female
Style: Strong, confident
Provider: ElevenLabs
```

**Best for:** Presentations, announcements, marketing copy, persuasive content

**Characteristics:**
- Confident delivery
- Engaging energy
- Clear projection
- Authoritative but approachable

**Sample text:**
> "Introducing the future of voice technology. Agent Talk transforms your text into natural speech in milliseconds."

---

### Adam

```
ID: adam
Gender: Male
Style: Deep narration
Provider: ElevenLabs
```

**Best for:** Documentaries, serious content, technical explanations, narration

**Characteristics:**
- Deep, resonant voice
- Authoritative presence
- Measured delivery
- Clear enunciation

**Sample text:**
> "In the year 2024, artificial intelligence reached a new milestone. Text-to-speech technology became indistinguishable from human speech."

---

### Charlie

```
ID: charlie
Gender: Male
Style: Casual conversational
Provider: ElevenLabs
```

**Best for:** Friendly prompts, notifications, chatbots, casual interactions

**Characteristics:**
- Relaxed delivery
- Natural pauses
- Friendly tone
- Approachable style

**Sample text:**
> "Hey there! Just wanted to let you know your order has shipped. Pretty cool, right?"

---

### Emily

```
ID: emily
Gender: Female
Style: Soft, gentle
Provider: ElevenLabs
```

**Best for:** Children's content, gentle prompts, bedtime stories, comfort

**Characteristics:**
- Soft, warm tone
- Gentle pace
- Soothing quality
- Approachable and kind

**Sample text:**
> "Once upon a time, in a cozy little cottage by the sea, there lived a curious cat named Whiskers."

---

### Freya

```
ID: freya
Gender: Female
Style: Young, energetic
Provider: ElevenLabs
```

**Best for:** Youth-oriented content, gaming, tutorials, entertainment

**Characteristics:**
- Youthful energy
- Engaging delivery
- Modern expressions
- Upbeat pace

**Sample text:**
> "Ready to level up? Let's dive into this tutorial and master the basics together!"

---

### Bella

```
ID: bella
Gender: Female
Style: Soft, warm
Provider: ElevenLabs
```

**Best for:** Meditation, relaxation, bedtime, comfort

**Characteristics:**
- Very soft delivery
- Calming presence
- Slow, measured pace
- Soothing quality

**Sample text:**
> "Take a deep breath. Feel the tension release from your shoulders. Let your mind drift to a peaceful place."

---

### Sam

```
ID: sam
Gender: Male
Style: Conversational
Provider: ElevenLabs
```

**Best for:** Chatbots, casual interactions, AI assistants, dialogue

**Characteristics:**
- Natural conversation flow
- Casual but clear
- Friendly approachability
- Versatile tone

**Sample text:**
> "So I was thinking about what you said earlier. That's actually a really good point. Here's what I'd suggest..."

---

### Ethan

```
ID: ethan
Gender: Male
Style: Young male
Provider: ElevenLabs
```

**Best for:** Youth content, gaming, tech tutorials, modern applications

**Characteristics:**
- Youthful sound
- Tech-friendly delivery
- Modern expressions
- Energetic but measured

**Sample text:**
> "Alright, let's get started. First, you'll want to click on the settings icon in the top right corner."

---

### Dorothy

```
ID: dorothy
Gender: Female
Style: Storyteller
Provider: ElevenLabs
```

**Best for:** Audiobooks, long-form content, narratives, documentaries

**Characteristics:**
- Engaging narration style
- Character differentiation
- Appropriate pacing
- Clear story structure

**Sample text:**
> "The old house at the end of the lane had been empty for years. But tonight, a light flickered in the upstairs window."

---

### Bill

```
ID: bill
Gender: Male
Style: Mature male
Provider: ElevenLabs
```

**Best for:** Authority, trust, experience, business leadership

**Characteristics:**
- Mature, experienced voice
- Trustworthy delivery
- Measured confidence
- Clear articulation

**Sample text:**
> "After thirty years in this industry, I can tell you that quality always matters more than speed."

---

### Sarah

```
ID: sarah
Gender: Female
Style: Professional female
Provider: ElevenLabs
```

**Best for:** Business, corporate, presentations, professional settings

**Characteristics:**
- Clear professional tone
- Business-appropriate pace
- Articulate delivery
- Confidence without being aggressive

**Sample text:**
> "Thank you for joining today's meeting. I'd like to present our quarterly results and discuss our strategy for the coming year."

---

## Using Voices via API

### List All Voices

```bash
curl https://talk.onhyper.io/api/v1/voices
```

Response:
```json
{
  "voices": [
    {
      "id": "rachel",
      "name": "Rachel",
      "gender": "female",
      "description": "Calm, professional"
    },
    // ... more voices
  ]
}
```

### Generate Speech with a Voice

```bash
curl -X POST https://talk.onhyper.io/api/v1/memo \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Hello, I am Rachel.",
    "voice": "rachel"
  }'
```

## Voice Selection Tips

### For Customer Service
**Best: Rachel, Sarah**
- Professional and clear
- Patient-sounding delivery
- Easy to understand at any speed

### For Marketing & Announcements
**Best: Domi, Bill**
- Confident and engaging
- Captures attention
- Persuasive delivery

### For Narration & Audiobooks
**Best: Adam, Dorothy**
- Sustained engagement
- Good for long content
- Clear story delivery

### For AI Assistants & Chatbots
**Best: Sam, Charlie**
- Conversational and natural
- Doesn't sound robotic
- Friendly and approachable

### For Children's Content
**Best: Emily, Freya**
- Appropriate tone
- Engaging for young listeners
- Warm and friendly

### For Meditation & Relaxation
**Best: Bella**
- Very soft and calming
- Slower pace
- Soothing quality

## Voice Quality by Tier

| Tier | Audio Quality | Provider |
|------|---------------|----------|
| Hobby | Standard | Edge TTS |
| Pro | HD | ElevenLabs |
| Enterprise | HD + Custom | ElevenLabs + Cloning |

**Note:** Pro and Enterprise tiers use ElevenLabs for higher quality, more natural speech. Hobby tier uses Edge TTS for cost-effective synthesis.

## Voice Samples

To hear a voice, use the demo endpoint:

```bash
# Try any voice for free (simulation mode)
curl -X POST https://talk.onhyper.io/api/v1/demo \
  -H "Content-Type: application/json" \
  -d '{"text": "I am Rachel, nice to meet you.", "voice": "rachel"}'
```

> **Note:** Demo mode uses simulation (silent audio). For production-quality audio, sign up for an API key.