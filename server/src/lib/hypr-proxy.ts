/**
 * HYPR Proxy Client
 * 
 * Client for making API calls through HYPR proxy with automatic secret injection.
 * Used for external API calls like ElevenLabs TTS, Stripe, WorkOS, etc.
 * 
 * @see HYPR-REFACTOR-PLAN.md Phase 2
 */

import { getHyprConfig, getHyprHeaders, HyprConfig } from './hypr-config.js';
import { logger } from '../utils/logger.js';

// ============================================================================
// Types
// ============================================================================

export interface ProxyRequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  body?: unknown;
  headers?: Record<string, string>;
  timeout?: number;
}

export interface ProxyResponse<T = unknown> {
  data: T;
  status: number;
  headers: Headers;
}

export interface ElevenLabsTTSOptions {
  voiceId: string;
  text: string;
  modelId?: string;
  stability?: number;
  similarityBoost?: number;
  style?: number;
  useSpeakerBoost?: boolean;
}

export interface ElevenLabsVoice {
  voice_id: string;
  name: string;
  category?: string;
  labels?: Record<string, string>;
}

// ============================================================================
// HYPR Proxy Client
// ============================================================================

export class HyprProxyClient {
  private config: HyprConfig;
  private baseUrl: string;

  constructor(config?: HyprConfig) {
    this.config = config || getHyprConfig();
    this.baseUrl = `${this.config.platformUrl}/proxy`;
  }

  /**
   * Make a proxied API request
   */
  async request<T = unknown>(
    endpoint: string,
    path: string,
    options: ProxyRequestOptions = {}
  ): Promise<ProxyResponse<T>> {
    const { method = 'GET', body, headers: customHeaders = {}, timeout = 30000 } = options;

    const url = `${this.baseUrl}/${endpoint}${path}`;
    const headers = {
      ...getHyprHeaders(this.config),
      ...customHeaders,
    };

    // Remove Content-Type for GET requests
    if (method === 'GET') {
      delete headers['Content-Type'];
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // Get content type
      const contentType = response.headers.get('content-type') || '';

      // Handle audio/binary responses
      if (contentType.includes('audio/') || contentType.includes('application/octet-stream')) {
        const arrayBuffer = await response.arrayBuffer();
        return {
          data: arrayBuffer as unknown as T,
          status: response.status,
          headers: response.headers,
        };
      }

      // Handle JSON responses
      if (contentType.includes('application/json')) {
        const data = await response.json();
        return {
          data,
          status: response.status,
          headers: response.headers,
        };
      }

      // Handle text responses
      const text = await response.text();
      return {
        data: text as unknown as T,
        status: response.status,
        headers: response.headers,
      };
    } catch (error) {
      clearTimeout(timeoutId);
      
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`Proxy request timed out after ${timeout}ms`);
      }
      
      throw error;
    }
  }

  // ==========================================================================
  // ElevenLabs TTS Methods
  // ==========================================================================

  /**
   * Generate speech using ElevenLabs TTS
   */
  async elevenLabsTTS(options: ElevenLabsTTSOptions): Promise<ArrayBuffer> {
    const { voiceId, text, modelId, stability, similarityBoost, style, useSpeakerBoost } = options;

    logger.debug('Making ElevenLabs TTS request via HYPR proxy', { 
      voiceId, 
      textLength: text.length 
    });

    const response = await this.request<ArrayBuffer>(
      'elevenlabs',
      `/text-to-speech/${voiceId}`,
      {
        method: 'POST',
        body: {
          text,
          model_id: modelId || 'eleven_monolingual_v1',
          voice_settings: {
            stability: stability ?? 0.5,
            similarity_boost: similarityBoost ?? 0.75,
            style: style ?? 0,
            use_speaker_boost: useSpeakerBoost ?? true,
          },
        },
        headers: {
          'Accept': 'audio/mpeg',
        },
        timeout: 60000, // 60s for TTS
      }
    );

    if (response.status !== 200) {
      const errorText = response.data instanceof ArrayBuffer 
        ? new TextDecoder().decode(response.data)
        : String(response.data);
      throw new Error(`ElevenLabs TTS failed: ${response.status} - ${errorText}`);
    }

    logger.info('ElevenLabs TTS successful via HYPR proxy', { 
      voiceId, 
      audioSize: (response.data as ArrayBuffer).byteLength 
    });

    return response.data as ArrayBuffer;
  }

  /**
   * List available ElevenLabs voices
   */
  async elevenLabsListVoices(): Promise<ElevenLabsVoice[]> {
    const response = await this.request<{ voices: ElevenLabsVoice[] }>(
      'elevenlabs',
      '/voices',
      {
        method: 'GET',
      }
    );

    if (response.status !== 200) {
      throw new Error(`Failed to list voices: ${response.status}`);
    }

    return response.data.voices || [];
  }

  // ==========================================================================
  // Stripe Methods (Future)
  // ==========================================================================

  /**
   * Make a Stripe API call through the proxy
   */
  async stripe(
    path: string,
    options: ProxyRequestOptions = {}
  ): Promise<ProxyResponse> {
    return this.request('stripe', path, options);
  }

  // ==========================================================================
  // WorkOS Methods (Future)
  // ==========================================================================

  /**
   * Make a WorkOS API call through the proxy
   */
  async workos(
    path: string,
    options: ProxyRequestOptions = {}
  ): Promise<ProxyResponse> {
    return this.request('workos', path, options);
  }

  // ==========================================================================
  // HYPR Micro Methods
  // ==========================================================================

  /**
   * Make a HYPR Micro API call through the proxy
   */
  async micro(
    path: string,
    options: ProxyRequestOptions = {}
  ): Promise<ProxyResponse> {
    return this.request('hypermicro', path, options);
  }
}

// Singleton instance
let proxyClient: HyprProxyClient | null = null;

/**
 * Get the HYPR Proxy client instance
 */
export function getProxyClient(): HyprProxyClient {
  if (!proxyClient) {
    proxyClient = new HyprProxyClient();
  }
  return proxyClient;
}

/**
 * Initialize the Proxy client with custom config
 */
export function initProxyClient(config?: HyprConfig): HyprProxyClient {
  proxyClient = new HyprProxyClient(config);
  return proxyClient;
}

export default HyprProxyClient;