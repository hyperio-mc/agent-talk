/**
 * Edge TTS Service - Free text-to-speech using Microsoft Edge TTS
 */

import { EdgeTTS } from 'node-edge-tts';
import { logger } from '../utils/logger.js';
import { tmpdir } from 'os';
import { join } from 'path';
import { mkdirSync, existsSync, unlinkSync, readFileSync, rmSync } from 'fs';
import { randomUUID } from 'crypto';

export interface EdgeVoice {
  id: string;
  name: string;
  gender: string;
  description?: string;
}

// Voice mappings from ElevenLabs voice IDs to Edge TTS voice names
// These are the closest approximations to ElevenLabs voices
export const EDGE_VOICE_MAPPINGS: Record<string, EdgeVoice> = {
  rachel: {
    id: 'rachel',
    name: 'en-US-JennyNeural',
    gender: 'female',
    description: 'Calm, professional (closest to Rachel)'
  },
  domi: {
    id: 'domi',
    name: 'en-US-AriaNeural',
    gender: 'female',
    description: 'Strong, confident (closest to Domi)'
  },
  bella: {
    id: 'bella',
    name: 'en-GB-SoniaNeural',
    gender: 'female',
    description: 'Soft, warm (closest to Bella)'
  },
  adam: {
    id: 'adam',
    name: 'en-US-GuyNeural',
    gender: 'male',
    description: 'Deep narration (closest to Adam)'
  },
  sam: {
    id: 'sam',
    name: 'en-US-ChristopherNeural',
    gender: 'male',
    description: 'Conversational (closest to Sam)'
  },
  charlie: {
    id: 'charlie',
    name: 'en-US-EricNeural',
    gender: 'male',
    description: 'Casual conversational (closest to Charlie)'
  },
  emily: {
    id: 'emily',
    name: 'en-US-MichelleNeural',
    gender: 'female',
    description: 'Soft, gentle (closest to Emily)'
  },
  ethan: {
    id: 'ethan',
    name: 'en-US-TonyNeural',
    gender: 'male',
    description: 'Young male (closest to Ethan)'
  },
  freya: {
    id: 'freya',
    name: 'en-US-AnaNeural',
    gender: 'female',
    description: 'Young, energetic (closest to Freya)'
  },
  dorothy: {
    id: 'dorothy',
    name: 'en-GB-MiaNeural',
    gender: 'female',
    description: 'Storyteller (closest to Dorothy)'
  },
  bill: {
    id: 'bill',
    name: 'en-US-RogerNeural',
    gender: 'male',
    description: 'Mature male (closest to Bill)'
  },
  sarah: {
    id: 'sarah',
    name: 'en-US-JennyNeural',
    gender: 'female',
    description: 'Professional female (closest to Sarah)'
  }
};

// Cache directory for temporary audio files
const EDGE_TTS_CACHE_DIR = join(tmpdir(), 'edge-tts-cache');

export class EdgeTTSService {
  private tempDir: string;
  private initialized: boolean = false;

  constructor() {
    // Create temp directory for audio files
    this.tempDir = EDGE_TTS_CACHE_DIR;
    this.ensureTempDir();
    this.initialized = true;
    logger.debug('EdgeTTSService initialized', { tempDir: this.tempDir });
  }

  /**
   * Ensure temp directory exists
   */
  private ensureTempDir(): void {
    if (!existsSync(this.tempDir)) {
      mkdirSync(this.tempDir, { recursive: true });
    }
  }

  /**
   * Get Edge TTS voice name for a given voice ID
   */
  getVoiceName(voiceId: string): string {
    const voice = EDGE_VOICE_MAPPINGS[voiceId.toLowerCase()];
    if (!voice) {
      logger.warn(`Unknown voice ID: ${voiceId}, falling back to JennyNeural`);
      return 'en-US-JennyNeural';
    }
    return voice.name;
  }

  /**
   * Generate audio from text using Edge TTS
   * @param text The text to convert to speech
   * @param voiceId The voice ID (e.g., 'rachel', 'adam')
   * @returns ArrayBuffer containing MP3 audio data
   */
  async generateAudio(text: string, voiceId: string): Promise<ArrayBuffer> {
    const voiceName = this.getVoiceName(voiceId);
    const outputFile = join(this.tempDir, `${randomUUID()}.mp3`);

    logger.debug('Edge TTS: Generating audio', {
      voice: voiceName,
      textLength: text.length,
      outputFile
    });

    try {
      const tts = new EdgeTTS({
        voice: voiceName,
        lang: 'en-US',
        outputFormat: 'audio-24khz-96kbitrate-mono-mp3',
        timeout: 30000 // 30 second timeout
      });

      await tts.ttsPromise(text, outputFile);

      // Read the generated audio file
      const audioBuffer = readFileSync(outputFile);
      const arrayBuffer = audioBuffer.buffer.slice(
        audioBuffer.byteOffset,
        audioBuffer.byteOffset + audioBuffer.byteLength
      );

      // Clean up temp file
      try {
        unlinkSync(outputFile);
      } catch {
        // Ignore cleanup errors
      }

      logger.info('Edge TTS: Audio generated successfully', {
        voice: voiceName,
        size: arrayBuffer.byteLength
      });

      return arrayBuffer;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Edge TTS: Failed to generate audio', {
        error: {
          name: error instanceof Error ? error.name : 'Error',
          message: errorMessage
        },
        voice: voiceName
      });

      // Clean up temp file on error
      try {
        if (existsSync(outputFile)) {
          unlinkSync(outputFile);
        }
      } catch {
        // Ignore cleanup errors
      }

      throw new Error(`Edge TTS failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Clean up all cached audio files
   */
  cleanup(): void {
    try {
      if (existsSync(this.tempDir)) {
        rmSync(this.tempDir, { recursive: true, force: true });
        logger.debug('Edge TTS: Cleaned up temp directory');
      }
    } catch (error) {
      logger.error('Edge TTS: Failed to clean up temp directory', {
        error: {
          name: error instanceof Error ? error.name : 'Error',
          message: error instanceof Error ? error.message : String(error)
        }
      });
    }
  }
}

// Singleton instance
let edgeTTSService: EdgeTTSService | null = null;

export function getEdgeTTSService(): EdgeTTSService {
  if (!edgeTTSService) {
    edgeTTSService = new EdgeTTSService();
  }
  return edgeTTSService;
}