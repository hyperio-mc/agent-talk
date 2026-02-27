/**
 * HYPR Platform Configuration
 * 
 * Configuration for connecting to HYPR services:
 * - HYPR Proxy: For external API calls with secret injection
 * - HYPR Micro: For database operations
 * - HYPR Storage: For file storage
 */

export interface HyprConfig {
  // App identification
  appSlug: string;
  
  // HYPR Platform URLs
  platformUrl: string;  // https://onhyper.io
  proxyUrl: string;    // https://onhyper.io/proxy
  microUrl: string;    // https://onhyper.io/proxy/hypermicro
  storageUrl: string;   // https://onhyper.io/api/hypr/storage
  
  // API Key for HYPR Micro (HYPERMICRO_API_KEY secret in HYPR)
  microApiKey?: string;
  
  // App ID for authentication (X-App-Slug header)
  useAppSlug: boolean;
}

/**
 * Get HYPR configuration from environment
 */
export function getHyprConfig(): HyprConfig {
  const appSlug = process.env.HYPR_APP_SLUG || 'talk';
  const platformUrl = process.env.HYPR_PLATFORM_URL || 'https://onhyper.io';
  
  return {
    appSlug,
    platformUrl,
    proxyUrl: `${platformUrl}/proxy`,
    microUrl: `${platformUrl}/proxy/hypermicro`,
    storageUrl: `${platformUrl}/api/hypr/storage`,
    microApiKey: process.env.HYPERMICRO_API_KEY,
    useAppSlug: true,
  };
}

/**
 * HYPR Proxy endpoint names
 */
export const HYPR_ENDPOINTS = {
  ELEVENLABS: 'elevenlabs',
  STRIPE: 'stripe',
  WORKOS: 'workos',
  HYPERMICRO: 'hypermicro',
} as const;

/**
 * Headers for HYPR authentication
 */
export function getHyprHeaders(config: HyprConfig): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  
  if (config.useAppSlug) {
    headers['X-App-Slug'] = config.appSlug;
  }
  
  // Add API key if available (for direct micro access)
  if (config.microApiKey) {
    headers['X-API-Key'] = config.microApiKey;
  }
  
  return headers;
}

export default getHyprConfig;