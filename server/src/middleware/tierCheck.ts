/**
 * Tier Check Middleware for Agent Talk API
 * 
 * Enforces tier-based feature access including:
 * - TTS engine restrictions (Edge only for Hobby, ElevenLabs for Pro+)
 * - Voice cloning access (Enterprise only)
 * - Character limits per memo
 * - Priority queue access
 */

import { Context, Next } from 'hono';
import {
  TIERS,
  TierName,
  getTierConfig,
  tierCanUseTTS,
  isCharacterCountAllowed,
  getTierCharLimit,
} from '../config/tiers.js';
import { findUserById } from '../db-stub/users.js';
import {
  InsufficientTierError,
  ValidationError,
} from '../errors/index.js';

// Extend Hono's context declaration
declare module 'hono' {
  interface ContextVariableMap {
    tierInfo?: {
      tier: TierName;
      config: ReturnType<typeof getTierConfig>;
    };
  }
}

/**
 * Middleware that loads tier info into context
 * Must be called after auth middleware (requires c.var.user)
 */
export async function loadTierInfo(c: Context, next: Next) {
  const user = c.get('user');
  
  if (!user) {
    // No user context - skip tier loading (auth will fail elsewhere)
    await next();
    return;
  }
  
  const fullUser = await findUserById(user.userId);
  
  if (!fullUser) {
    await next();
    return;
  }
  
  const tier = fullUser.tier as TierName;
  const config = getTierConfig(tier);
  
  c.set('tierInfo', { tier, config });
  
  await next();
}

/**
 * Get tier info from context
 */
export function getTierInfo(c: Context): { tier: TierName; config: ReturnType<typeof getTierConfig> } | null {
  return c.get('tierInfo') || null;
}

/**
 * Get current user's tier
 */
export function getUserTier(c: Context): TierName {
  const tierInfo = getTierInfo(c);
  return tierInfo?.tier || 'hobby';
}

/**
 * Require minimum tier for access
 * Use this for feature-gated routes
 */
export function requireTier(minTier: TierName) {
  const tierOrder: TierName[] = ['hobby', 'pro', 'enterprise'];
  
  return async (c: Context, next: Next) => {
    const currentTier = getUserTier(c);
    
    const currentIndex = tierOrder.indexOf(currentTier);
    const requiredIndex = tierOrder.indexOf(minTier);
    
    if (currentIndex < requiredIndex) {
      throw new InsufficientTierError(minTier, currentTier);
    }
    
    await next();
  };
}

/**
 * Check if user can use a specific TTS engine
 * Throws InsufficientTierError if not allowed
 */
export function requireTTSAccess(engine: 'edge' | 'elevenlabs') {
  return async (c: Context, next: Next) => {
    const tier = getUserTier(c);
    
    if (!tierCanUseTTS(tier, engine)) {
      const config = getTierConfig(tier);
      throw new InsufficientTierError(
        engine === 'elevenlabs' ? 'pro' : 'hobby',
        tier
      );
    }
    
    await next();
  };
}

/**
 * Check character count against tier limits
 * Call this in request validation to reject oversized memos early
 */
export function validateCharacterLimit(c: Context, charCount: number): void {
  const tier = getUserTier(c);
  
  if (!isCharacterCountAllowed(tier, charCount)) {
    const limit = getTierCharLimit(tier);
    throw new ValidationError(
      `Character limit exceeded. Your tier allows up to ${limit} characters per memo.`,
      {
        field: 'text',
        limit,
        provided: charCount,
        tier,
        upgradeUrl: '/billing/upgrade',
      }
    );
  }
}

/**
 * Middleware to validate memo text length against tier limits
 * Expects text to be in request body
 */
export async function checkMemoLength(c: Context, next: Next) {
  // Only check for POST/PUT requests with JSON body
  if (!['POST', 'PUT', 'PATCH'].includes(c.req.method)) {
    await next();
    return;
  }
  
  try {
    // Clone the request to read body without consuming it
    const clonedReq = c.req.raw.clone();
    const body = await clonedReq.json() as { text?: string };
    
    if (body.text && typeof body.text === 'string') {
      validateCharacterLimit(c, body.text.length);
    }
  } catch (error) {
    // If JSON parsing fails, let the actual request handler deal with it
    // We only want to validate if there's a text field
  }
  
  await next();
}

/**
 * Check if user has voice cloning access
 */
export function hasVoiceCloningAccess(c: Context): boolean {
  const tierInfo = getTierInfo(c);
  return tierInfo?.config.features.voiceCloning ?? false;
}

/**
 * Check if user has priority access
 */
export function hasPriorityAccess(c: Context): boolean {
  const tierInfo = getTierInfo(c);
  return tierInfo?.config.features.priority ?? false;
}

/**
 * Check if user has webhook access
 */
export function hasWebhookAccess(c: Context): boolean {
  const tierInfo = getTierInfo(c);
  return tierInfo?.config.features.webhooks ?? false;
}

/**
 * Get the effective TTS mode for a request
 * Returns the highest quality TTS the user's tier allows
 */
export function getEffectiveTTSMode(
  c: Context,
  requestedMode: 'simulation' | 'edge' | 'elevenlabs'
): 'simulation' | 'edge' | 'elevenlabs' {
  const tier = getUserTier(c);
  
  // Enterprise can use any TTS
  if (tier === 'enterprise') {
    return requestedMode === 'simulation' ? 'simulation' : 
           requestedMode === 'elevenlabs' ? 'elevenlabs' : 'edge';
  }
  
  // Pro can use ElevenLabs or Edge
  if (tier === 'pro') {
    if (requestedMode === 'elevenlabs') {
      return 'elevenlabs';
    }
    return requestedMode === 'simulation' ? 'simulation' : 'edge';
  }
  
  // Hobby can only use Edge or simulation
  return requestedMode === 'simulation' ? 'simulation' : 'edge';
}

/**
 * Require voice cloning feature
 * Use for voice cloning endpoints
 */
export async function requireVoiceCloning(c: Context, next: Next) {
  if (!hasVoiceCloningAccess(c)) {
    const tier = getUserTier(c);
    throw new InsufficientTierError('enterprise', tier);
  }
  
  await next();
}

/**
 * Get tier feature summary for response headers
 * Useful for showing upgrade prompts in client apps
 */
export function getTierFeatureHeaders(c: Context): Record<string, string> {
  const tierInfo = getTierInfo(c);
  
  if (!tierInfo) {
    return {};
  }
  
  const { tier, config } = tierInfo;
  
  return {
    'X-Tier': tier,
    'X-Tier-Name': config.displayName,
    'X-Tier-Limit': config.limits.callsPerDay?.toString() ?? 'unlimited',
    'X-Tier-TTS': config.features.tts,
    'X-Tier-Priority': config.features.priority.toString(),
  };
}