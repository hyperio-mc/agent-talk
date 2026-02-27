/**
 * Agent Talk SDK - Memo API
 */

import { HttpClient } from './client.js';
import type { Memo, CreateMemoOptions } from './types.js';

/**
 * Memo API - Create and manage text-to-speech memos
 */
export class MemoApi {
  private readonly client: HttpClient;

  constructor(client: HttpClient) {
    this.client = client;
  }

  /**
   * Create a new memo (convert text to speech)
   * 
   * Requires an API key to be configured.
   * 
   * @param options - Memo creation options
   * @param options.text - The text to convert to speech
   * @param options.voice - The voice ID to use (e.g., 'rachel', 'domi', 'adam')
   * @returns The created memo with audio URL
   * 
   * @throws {MissingApiKeyError} If no API key is configured
   * @throws {InvalidVoiceError} If the voice ID is invalid
   * @throws {RateLimitError} If rate limit is exceeded
   * 
   * @example
   * const memo = await client.memo.create({
   *   text: "Hello from Agent Talk!",
   *   voice: "rachel"
   * });
   * 
   * console.log(memo.audio.url);
   * // Play audio: new Audio(memo.audio.url).play()
   */
  async create(options: CreateMemoOptions): Promise<Memo> {
    return this.client.post<Memo>('/api/v1/memo', options, { auth: true });
  }

  /**
   * Create a demo memo (no API key required)
   * 
   * Uses simulation mode - audio will be silent/placeholder.
   * For production-quality audio, use create() with an API key.
   * 
   * @param options - Memo creation options
   * @param options.text - The text to convert to speech
   * @param options.voice - The voice ID to use
   * @returns The created memo with simulated audio
   * 
   * @example
   * // No API key needed for demo
   * const memo = await client.memo.demo({
   *   text: "This is a demo!",
   *   voice: "rachel"
   * });
   */
  async demo(options: CreateMemoOptions): Promise<Memo> {
    return this.client.post<Memo>('/api/v1/demo', options, { auth: false });
  }
}
