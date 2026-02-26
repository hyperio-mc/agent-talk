/**
 * Memo Service - Text-to-speech conversion with ElevenLabs
 */

export interface Voice {
  id: string;
  name: string;
  gender: string;
  description?: string;
}

export interface VoiceMapping {
  id: string;
  name: string;
  gender: string;
  edgeVoice?: string;
  elevenlabsId: string;
  description?: string;
}

export interface Memo {
  id: string;
  text: string;
  voice: Voice;
  audio: {
    url: string;
    duration?: number;
    format: string;
  };
  createdAt: string;
}

export type TTSService = 'simulation' | 'edge' | 'elevenlabs';

// Voice mappings for ElevenLabs
const VOICES: Record<string, VoiceMapping> = {
  // Popular ElevenLabs voices
  rachel: {
    id: 'rachel',
    name: 'Rachel',
    gender: 'female',
    elevenlabsId: '21m00Tcm4TlvDq8ikWAM',
    description: 'Calm, professional'
  },
  domi: {
    id: 'domi',
    name: 'Domi',
    gender: 'female',
    elevenlabsId: 'AZnzlk1XvdvUeBnXmlld',
    description: 'Strong, confident'
  },
  bella: {
    id: 'bella',
    name: 'Bella',
    gender: 'female',
    elevenlabsId: 'EXAVITQu4vr4xnSDxMaL',
    description: 'Soft, warm'
  },
  adam: {
    id: 'adam',
    name: 'Adam',
    gender: 'male',
    elevenlabsId: 'pNInz6obpgDQGcFmaJgB',
    description: 'Deep narration'
  },
  sam: {
    id: 'sam',
    name: 'Sam',
    gender: 'male',
    elevenlabsId: 'yoZ06aMxZJJ28mfd3POQ',
    description: 'Conversational'
  },
  charlie: {
    id: 'charlie',
    name: 'Charlie',
    gender: 'male',
    elevenlabsId: 'IKne3meq5aSn9XLyUdCD',
    description: 'Casual conversational'
  },
  emily: {
    id: 'emily',
    name: 'Emily',
    gender: 'female',
    elevenlabsId: 'LcfcDJNUP1GQjkzn1xUU',
    description: 'Soft, gentle'
  },
  ethan: {
    id: 'ethan',
    name: 'Ethan',
    gender: 'male',
    elevenlabsId: 'g5CIjZEefAph4nQFvHAz',
    description: 'Young male'
  },
  freya: {
    id: 'freya',
    name: 'Freya',
    gender: 'female',
    elevenlabsId: 'jsCqWAovK2LkecY7zXl4',
    description: 'Young, energetic'
  },
  dorothy: {
    id: 'dorothy',
    name: 'Dorothy',
    gender: 'female',
    elevenlabsId: 'ThT5KcBeYPX3keUQqHPh',
    description: 'Storyteller'
  },
  bill: {
    id: 'bill',
    name: 'Bill',
    gender: 'male',
    elevenlabsId: 'flq6f7yk4E4fJM5XTYuZ',
    description: 'Mature male'
  },
  sarah: {
    id: 'sarah',
    name: 'Sarah',
    gender: 'female',
    elevenlabsId: 'pMsXgVXv3BLzUgSXRplE',
    description: 'Professional female'
  }
};

export class MemoService {
  private ttsMode: TTSService;
  private apiKey: string | null;
  private apiBaseUrl: string = 'https://api.elevenlabs.io/v1';

  constructor(ttsMode: TTSService = 'simulation', apiKey?: string) {
    this.ttsMode = ttsMode;
    this.apiKey = apiKey || null;
    
    console.log(`🎙️ MemoService initialized with TTS mode: ${this.ttsMode}`);
  }

  /**
   * Get available voices
   */
  getAvailableVoices(): Voice[] {
    return Object.entries(VOICES).map(([key, voice]) => ({
      id: key,
      name: voice.name,
      gender: voice.gender,
      description: voice.description
    }));
  }

  /**
   * Check if voice is valid
   */
  isValidVoice(voiceId: string): boolean {
    return VOICES[voiceId.toLowerCase()] !== undefined;
  }

  /**
   * Get current TTS mode
   */
  getTTSMode(): TTSService {
    return this.ttsMode;
  }

  /**
   * Create a memo (convert text to audio)
   */
  async createMemo(text: string, voiceName: string, baseUrl: string): Promise<Memo> {
    const voiceKey = voiceName.toLowerCase();
    const voice = VOICES[voiceKey];

    if (!voice) {
      throw new Error(`Unknown voice: ${voiceName}`);
    }

    console.log(`🎙️ Creating memo with voice "${voiceName}"...`);
    console.log(`📝 Text: ${text.substring(0, 100)}${text.length > 100 ? '...' : ''}`);

    // Generate audio
    const audioBuffer = await this.generateAudio(text, voice);

    // Create memo object
    const memoId = this.generateId();
    const filename = `memo_${memoId}.mp3`;

    // In a full implementation, we'd store the audio in object storage
    // For now, we'll encode it as base64 and return it inline
    const audioBase64 = this.bufferToBase64(audioBuffer);
    const audioUrl = `data:audio/mpeg;base64,${audioBase64}`;

    const memo: Memo = {
      id: memoId,
      text,
      voice: {
        id: voiceKey,
        name: voice.name,
        gender: voice.gender,
        description: voice.description
      },
      audio: {
        url: audioUrl,
        duration: this.estimateDuration(text),
        format: 'mp3'
      },
      createdAt: new Date().toISOString()
    };

    console.log(`✅ Memo created: ${memoId}`);
    return memo;
  }

  /**
   * Generate audio from text
   */
  private async generateAudio(text: string, voice: VoiceMapping): Promise<ArrayBuffer> {
    switch (this.ttsMode) {
      case 'elevenlabs':
        return this.generateElevenLabsAudio(text, voice.elevenlabsId);
      case 'edge':
        // Edge TTS would be implemented here
        // For now, fall back to simulation
        console.log('⚠️ Edge TTS not implemented, using simulation');
        return this.generateSimulationAudio(text);
      case 'simulation':
      default:
        return this.generateSimulationAudio(text);
    }
  }

  /**
   * Generate audio using ElevenLabs API
   */
  private async generateElevenLabsAudio(text: string, voiceId: string): Promise<ArrayBuffer> {
    if (!this.apiKey) {
      console.log('⚠️ No ElevenLabs API key, using simulation');
      return this.generateSimulationAudio(text);
    }

    try {
      const response = await fetch(
        `${this.apiBaseUrl}/text-to-speech/${voiceId}`,
        {
          method: 'POST',
          headers: {
            'Accept': 'audio/mpeg',
            'Content-Type': 'application/json',
            'xi-api-key': this.apiKey
          },
          body: JSON.stringify({
            text,
            model_id: 'eleven_monolingual_v1',
            voice_settings: {
              stability: 0.5,
              similarity_boost: 0.75
            }
          })
        }
      );

      if (!response.ok) {
        const error = await response.text();
        console.error(`ElevenLabs API error: ${response.status} ${error}`);
        throw new Error(`ElevenLabs API error: ${response.status}`);
      }

      console.log('✅ ElevenLabs audio generated');
      return response.arrayBuffer();
    } catch (error) {
      console.error('Failed to generate ElevenLabs audio:', error);
      // Fallback to simulation
      return this.generateSimulationAudio(text);
    }
  }

  /**
   * Generate simulation audio (placeholder)
   * In a real implementation, this would return a minimal audio file
   */
  private async generateSimulationAudio(text: string): Promise<ArrayBuffer> {
    // Return a minimal MP3 header (silent audio)
    // This is a valid MP3 file with 1 frame of silence
    const silentMp3 = Buffer.from([
      0xff, 0xfb, 0x90, 0x00, // MP3 frame header
      0x00, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x00
    ]);
    
    console.log('🔊 Generated simulation audio (silent placeholder)');
    return silentMp3.buffer as ArrayBuffer;
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }

  /**
   * Estimate audio duration from text
   */
  private estimateDuration(text: string): number {
    // Average speaking rate: 150 words per minute
    // Average word length: 5 characters
    const wordsPerMinute = 150;
    const avgWordLength = 5;
    const words = text.length / avgWordLength;
    const minutes = words / wordsPerMinute;
    return Math.round(minutes * 60 * 10) / 10; // Round to 1 decimal
  }

  /**
   * Convert ArrayBuffer to base64
   */
  private bufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }
}