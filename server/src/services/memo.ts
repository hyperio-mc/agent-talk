/**
 * Memo Service - Text-to-speech conversion with ElevenLabs and Edge TTS
 */

import { logger } from '../utils/logger.js';
import { getStorage, initStorage } from './storage.js';
import { getEdgeTTSService, EDGE_VOICE_MAPPINGS } from './edgeTTS.js';

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
    edgeVoice: EDGE_VOICE_MAPPINGS.rachel?.name,
    description: 'Calm, professional'
  },
  domi: {
    id: 'domi',
    name: 'Domi',
    gender: 'female',
    elevenlabsId: 'AZnzlk1XvdvUeBnXmlld',
    edgeVoice: EDGE_VOICE_MAPPINGS.domi?.name,
    description: 'Strong, confident'
  },
  bella: {
    id: 'bella',
    name: 'Bella',
    gender: 'female',
    elevenlabsId: 'EXAVITQu4vr4xnSDxMaL',
    edgeVoice: EDGE_VOICE_MAPPINGS.bella?.name,
    description: 'Soft, warm'
  },
  adam: {
    id: 'adam',
    name: 'Adam',
    gender: 'male',
    elevenlabsId: 'pNInz6obpgDQGcFmaJgB',
    edgeVoice: EDGE_VOICE_MAPPINGS.adam?.name,
    description: 'Deep narration'
  },
  sam: {
    id: 'sam',
    name: 'Sam',
    gender: 'male',
    elevenlabsId: 'yoZ06aMxZJJ28mfd3POQ',
    edgeVoice: EDGE_VOICE_MAPPINGS.sam?.name,
    description: 'Conversational'
  },
  charlie: {
    id: 'charlie',
    name: 'Charlie',
    gender: 'male',
    elevenlabsId: 'IKne3meq5aSn9XLyUdCD',
    edgeVoice: EDGE_VOICE_MAPPINGS.charlie?.name,
    description: 'Casual conversational'
  },
  emily: {
    id: 'emily',
    name: 'Emily',
    gender: 'female',
    elevenlabsId: 'LcfcDJNUP1GQjkzn1xUU',
    edgeVoice: EDGE_VOICE_MAPPINGS.emily?.name,
    description: 'Soft, gentle'
  },
  ethan: {
    id: 'ethan',
    name: 'Ethan',
    gender: 'male',
    elevenlabsId: 'g5CIjZEefAph4nQFvHAz',
    edgeVoice: EDGE_VOICE_MAPPINGS.ethan?.name,
    description: 'Young male'
  },
  freya: {
    id: 'freya',
    name: 'Freya',
    gender: 'female',
    elevenlabsId: 'jsCqWAovK2LkecY7zXl4',
    edgeVoice: EDGE_VOICE_MAPPINGS.freya?.name,
    description: 'Young, energetic'
  },
  dorothy: {
    id: 'dorothy',
    name: 'Dorothy',
    gender: 'female',
    elevenlabsId: 'ThT5KcBeYPX3keUQqHPh',
    edgeVoice: EDGE_VOICE_MAPPINGS.dorothy?.name,
    description: 'Storyteller'
  },
  bill: {
    id: 'bill',
    name: 'Bill',
    gender: 'male',
    elevenlabsId: 'flq6f7yk4E4fJM5XTYuZ',
    edgeVoice: EDGE_VOICE_MAPPINGS.bill?.name,
    description: 'Mature male'
  },
  sarah: {
    id: 'sarah',
    name: 'Sarah',
    gender: 'female',
    elevenlabsId: 'pMsXgVXv3BLzUgSXRplE',
    edgeVoice: EDGE_VOICE_MAPPINGS.sarah?.name,
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
    
    logger.debug('MemoService initialized', { ttsMode: this.ttsMode });
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

    logger.debug('Creating memo', { 
      voice: voiceName, 
      textLength: text.length,
      textPreview: text.substring(0, 100) + (text.length > 100 ? '...' : '')
    });

    // Generate audio
    const audioBuffer = await this.generateAudio(text, voice);

    // Create memo object
    const memoId = this.generateId();

    // Store audio file using storage service
    const storage = getStorage();
    const uploadResult = await storage.upload(audioBuffer, 'mp3');
    
    // Use the URL from storage service (not base64)
    const audioUrl = uploadResult.url;

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

    logger.info('Memo created', { memoId, voice: voiceName, duration: memo.audio.duration, audioUrl });
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
        return this.generateEdgeTTSAudio(text, voice);
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
      logger.warn('No ElevenLabs API key, using simulation');
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
        const errorText = await response.text();
        logger.error('ElevenLabs API error', { 
          statusCode: response.status, 
          errorMessage: errorText 
        });
        throw new Error(`ElevenLabs API error: ${response.status}`);
      }

      logger.info('ElevenLabs audio generated', { voiceId });
      return response.arrayBuffer();
    } catch (error) {
      logger.error('Failed to generate ElevenLabs audio');
      // Fallback to simulation
      return this.generateSimulationAudio(text);
    }
  }

  /**
   * Generate audio using Edge TTS (free)
   */
  private async generateEdgeTTSAudio(text: string, voice: VoiceMapping): Promise<ArrayBuffer> {
    try {
      const edgeTTSService = getEdgeTTSService();
      const voiceId = voice.id; // Use the voice ID (e.g., 'rachel')
      
      logger.debug('Generating Edge TTS audio', { voice: voiceId, textLength: text.length });
      
      const audioBuffer = await edgeTTSService.generateAudio(text, voiceId);
      
      logger.info('Edge TTS audio generated', { 
        voice: voiceId, 
        size: audioBuffer.byteLength 
      });
      
      return audioBuffer;
    } catch (error) {
      logger.error('Failed to generate Edge TTS audio', {
        error: {
          name: error instanceof Error ? error.name : 'Error',
          message: error instanceof Error ? error.message : String(error)
        },
        voice: voice.id
      });
      
      // Fallback to simulation on error
      logger.warn('Falling back to simulation mode');
      return this.generateSimulationAudio(text);
    }
  }

  /**
   * Generate simulation audio (placeholder)
   * Returns a minimal but valid MP3 file with silence
   */
  private async generateSimulationAudio(text: string): Promise<ArrayBuffer> {
    // Create a minimal valid MP3 file with ~1 second of silence
    // This is a proper MP3 header + silent frame
    const silentMp3Base64 = '//uQxAAAAAANIAAAAAExBTUUzLjEwMFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVY=';
    
    // Decode base64 to buffer
    const binaryString = Buffer.from(silentMp3Base64, 'base64').toString('binary');
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    
    logger.debug('Generated simulation audio (silent placeholder)');
    return bytes.buffer as ArrayBuffer;
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