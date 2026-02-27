/**
 * Tier Configuration for Agent Talk API
 * 
 * Defines pricing, limits, and features for each tier.
 * Hobby: Free tier with basic limits
 * Pro: Paid tier with enhanced limits and features
 * Enterprise: Custom tier with unlimited usage and premium features
 */

export type TierName = 'hobby' | 'pro' | 'enterprise';

export interface TierLimits {
  /** Maximum API calls per day. null = unlimited */
  callsPerDay: number | null;
  /** Maximum characters per memo. null = unlimited */
  charsPerMemo: number | null;
  /** Maximum API keys allowed */
  maxApiKeys: number;
  /** Maximum concurrent requests */
  maxConcurrent: number;
}

export interface TierFeatures {
  /** Available voices: 'all' or restricted subset */
  voices: 'all' | 'basic';
  /** TTS engine: 'edge' (free), 'elevenlabs', or 'any' */
  tts: 'edge' | 'elevenlabs' | 'any';
  /** Priority processing queue */
  priority: boolean;
  /** Voice cloning capability */
  voiceCloning: boolean;
  /** Custom voices */
  customVoices: boolean;
  /** Analytics access */
  analytics: 'basic' | 'advanced' | 'none';
  /** API access */
  apiAccess: boolean;
  /** Webhook notifications */
  webhooks: boolean;
  /** Custom branding on audio */
  customBranding: boolean;
  /** Dedicated support */
  dedicatedSupport: boolean;
  /** SLA guarantee (percentage) */
  slaPercentage: number | null;
}

export interface TierConfig {
  name: string;
  displayName: string;
  description: string;
  price: number | null; // Monthly price in USD, null = custom
  priceId?: string; // Stripe price ID for billing
  limits: TierLimits;
  features: TierFeatures;
  highlighted?: boolean; // For pricing page display
}

/**
 * Tier configurations
 */
export const TIERS: Record<TierName, TierConfig> = {
  hobby: {
    name: 'hobby',
    displayName: 'Hobby',
    description: 'Perfect for personal projects and experimentation',
    price: 0,
    limits: {
      callsPerDay: 100,
      charsPerMemo: 5000,
      maxApiKeys: 2,
      maxConcurrent: 1,
    },
    features: {
      voices: 'all',
      tts: 'edge',
      priority: false,
      voiceCloning: false,
      customVoices: false,
      analytics: 'basic',
      apiAccess: true,
      webhooks: false,
      customBranding: false,
      dedicatedSupport: false,
      slaPercentage: null,
    },
  },
  pro: {
    name: 'pro',
    displayName: 'Pro',
    description: 'For professionals and growing businesses',
    price: 19,
    limits: {
      callsPerDay: 1000,
      charsPerMemo: 20000,
      maxApiKeys: 10,
      maxConcurrent: 5,
    },
    features: {
      voices: 'all',
      tts: 'elevenlabs',
      priority: true,
      voiceCloning: false,
      customVoices: false,
      analytics: 'advanced',
      apiAccess: true,
      webhooks: true,
      customBranding: false,
      dedicatedSupport: false,
      slaPercentage: 99.5,
    },
    highlighted: true,
  },
  enterprise: {
    name: 'enterprise',
    displayName: 'Enterprise',
    description: 'For large-scale deployments with custom needs',
    price: null, // Custom pricing
    limits: {
      callsPerDay: null, // Unlimited
      charsPerMemo: null, // Unlimited
      maxApiKeys: 100,
      maxConcurrent: 50,
    },
    features: {
      voices: 'all',
      tts: 'any',
      priority: true,
      voiceCloning: true,
      customVoices: true,
      analytics: 'advanced',
      apiAccess: true,
      webhooks: true,
      customBranding: true,
      dedicatedSupport: true,
      slaPercentage: 99.99,
    },
  },
};

/**
 * Get tier configuration by name
 */
export function getTierConfig(tier: TierName): TierConfig {
  return TIERS[tier];
}

/**
 * Check if a tier allows a specific feature
 */
export function tierHasFeature(tier: TierName, feature: keyof TierFeatures): boolean {
  const config = TIERS[tier];
  const value = config.features[feature];
  
  // Handle different feature types
  if (typeof value === 'boolean') {
    return value;
  }
  
  // For non-boolean features, return true if not 'none'
  if (value === 'none') {
    return false;
  }
  
  return true;
}

/**
 * Check if a tier has access to a specific TTS engine
 */
export function tierCanUseTTS(tier: TierName, engine: 'edge' | 'elevenlabs'): boolean {
  const config = TIERS[tier];
  const ttsFeature = config.features.tts;
  
  // 'any' allows all engines
  if (ttsFeature === 'any') {
    return true;
  }
  
  // Direct match
  if (ttsFeature === engine) {
    return true;
  }
  
  // Pro/Enterprise using elevenlabs can also use edge
  if (engine === 'edge' && ttsFeature === 'elevenlabs') {
    return true;
  }
  
  // Hobby tier can only use edge
  if (tier === 'hobby' && engine === 'edge') {
    return true;
  }
  
  // Hobby tier cannot use elevenlabs
  if (tier === 'hobby' && engine === 'elevenlabs') {
    return false;
  }
  
  return false;
}

/**
 * Get tier from string (with validation)
 */
export function parseTier(value: string): TierName | null {
  const normalized = value.toLowerCase();
  if (normalized in TIERS) {
    return normalized as TierName;
  }
  return null;
}

/**
 * Get all tier names
 */
export function getAllTierNames(): TierName[] {
  return Object.keys(TIERS) as TierName[];
}

/**
 * Get all tier configs for display (e.g., pricing page)
 */
export function getAllTiers(): TierConfig[] {
  return Object.values(TIERS);
}

/**
 * Check if tier is paid
 */
export function isPaidTier(tier: TierName): boolean {
  const config = TIERS[tier];
  return config.price !== null && config.price > 0;
}

/**
 * Get daily call limit for tier (for rate limiting)
 */
export function getTierDailyLimit(tier: TierName): number {
  const config = TIERS[tier];
  // Return Infinity for unlimited, otherwise the limit
  return config.limits.callsPerDay ?? Infinity;
}

/**
 * Check if character count is within tier limits
 */
export function isCharacterCountAllowed(tier: TierName, charCount: number): boolean {
  const config = TIERS[tier];
  const limit = config.limits.charsPerMemo;
  
  // null means unlimited
  if (limit === null) {
    return true;
  }
  
  return charCount <= limit;
}

/**
 * Get the maximum character limit for a tier
 */
export function getTierCharLimit(tier: TierName): number | null {
  return TIERS[tier].limits.charsPerMemo;
}

/**
 * Compare tiers (for upgrade logic)
 * Returns: -1 if a < b, 1 if a > b, 0 if equal
 */
export function compareTiers(a: TierName, b: TierName): number {
  const order: TierName[] = ['hobby', 'pro', 'enterprise'];
  const aIndex = order.indexOf(a);
  const bIndex = order.indexOf(b);
  
  if (aIndex < bIndex) return -1;
  if (aIndex > bIndex) return 1;
  return 0;
}

/**
 * Check if upgrade is required from one tier to another
 */
export function isUpgradeRequired(from: TierName, to: TierName): boolean {
  return compareTiers(from, to) < 0;
}

/**
 * Re-export the limits for backward compatibility with rateLimit service
 */
export const TIER_LIMITS = {
  hobby: TIERS.hobby.limits.callsPerDay ?? 100,
  pro: TIERS.pro.limits.callsPerDay ?? 1000,
  enterprise: Infinity, // Always unlimited for enterprise
} as const;