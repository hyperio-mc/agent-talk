/**
 * Agent Talk SDK - Voices API
 */

import { HttpClient } from './client.js';
import type { Voice } from './types.js';

/**
 * Voices API - List and manage available voices
 */
export class VoicesApi {
  private readonly client: HttpClient;

  constructor(client: HttpClient) {
    this.client = client;
  }

  /**
   * List all available voices
   * 
   * @returns Array of available voices
   * 
   * @example
   * const voices = await client.voices.list();
   * console.log(voices);
   * // [
   * //   { id: 'rachel', name: 'Rachel', gender: 'female', description: 'Calm, professional' },
   * //   { id: 'domi', name: 'Domi', gender: 'female', description: 'Strong, confident' },
   * //   ...
   * // ]
   */
  async list(): Promise<Voice[]> {
    const response = await this.client.get<{ voices: Voice[] }>('/api/v1/voices');
    return response.voices;
  }

  /**
   * Get a voice by ID
   * 
   * @param voiceId - The voice ID to look up
   * @returns The voice if found, or undefined
   * 
   * @example
   * const voice = await client.voices.get('rachel');
   * if (voice) {
   *   console.log(`Found voice: ${voice.name}`);
   * }
   */
  async get(voiceId: string): Promise<Voice | undefined> {
    const voices = await this.list();
    return voices.find(v => v.id === voiceId);
  }
}
