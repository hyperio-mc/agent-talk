/**
 * Billing Routes Tests
 * 
 * Tests for tier management, subscription, and billing endpoints.
 * Stripe integration tests use mocked responses.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import app from '../src/index.js';

// Mock Stripe service
vi.mock('../src/services/stripe.js', () => ({
  isStripeConfigured: () => true,
  getSubscriptionDetails: vi.fn(),
  createCheckoutSession: vi.fn(),
  createPortalSession: vi.fn(),
  cancelSubscription: vi.fn(),
  reactivateSubscription: vi.fn(),
  getStripe: () => null, // Using proxy mode
  verifyWebhookSignature: vi.fn(() => null), // Returns null for invalid signatures
  handleCheckoutComplete: vi.fn(),
  handleCustomerSubscription: vi.fn(),
}));

describe('Billing Routes', () => {
  describe('GET /api/v1/billing/tiers', () => {
    it('should return all available tiers', async () => {
      const res = await app.request('/api/v1/billing/tiers');
      expect(res.status).toBe(200);
      
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.tiers).toBeInstanceOf(Array);
      expect(data.tiers.length).toBeGreaterThan(0);
      
      // Check tier structure
      const hobbyTier = data.tiers.find((t: any) => t.name === 'hobby');
      expect(hobbyTier).toBeDefined();
      expect(hobbyTier.displayName).toBeDefined();
      expect(hobbyTier.price).toBeDefined();
      expect(hobbyTier.limits).toBeDefined();
      expect(hobbyTier.features).toBeDefined();
    });
    
    it('should include correct values for pro tier', async () => {
      const res = await app.request('/api/v1/billing/tiers');
      const data = await res.json();
      
      const proTier = data.tiers.find((t: any) => t.name === 'pro');
      expect(proTier).toBeDefined();
      expect(proTier.limits.callsPerDay).toBe(1000);
      expect(proTier.limits.charsPerMemo).toBe(20000);
      expect(proTier.features.tts).toBe('elevenlabs');
      expect(proTier.features.priority).toBe(true);
    });
  });
  
  describe('GET /api/v1/billing/tiers/:tier', () => {
    it('should return details for a specific tier', async () => {
      const res = await app.request('/api/v1/billing/tiers/pro');
      expect(res.status).toBe(200);
      
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.tier.name).toBe('pro');
      expect(data.tier.displayName).toBe('Pro');
      expect(data.tier.price).toBe(19); // $19/month
    });
    
    it('should return 400 for invalid tier', async () => {
      const res = await app.request('/api/v1/billing/tiers/invalid');
      expect(res.status).toBe(400);
    });
  });
  
  describe('GET /api/v1/billing/subscription', () => {
    it('should return 401 without authentication', async () => {
      const res = await app.request('/api/v1/billing/subscription');
      expect(res.status).toBe(401);
    });
  });
  
  describe('POST /api/v1/billing/checkout', () => {
    it('should return 401 without authentication', async () => {
      const res = await app.request('/api/v1/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      expect(res.status).toBe(401);
    });
  });
  
  describe('POST /api/v1/billing/portal', () => {
    it('should return 401 without authentication', async () => {
      const res = await app.request('/api/v1/billing/portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      expect(res.status).toBe(401);
    });
  });
  
  describe('POST /api/v1/billing/cancel', () => {
    it('should return 401 without authentication', async () => {
      const res = await app.request('/api/v1/billing/cancel', {
        method: 'POST',
      });
      expect(res.status).toBe(401);
    });
  });
  
  describe('POST /api/v1/billing/reactivate', () => {
    it('should return 401 without authentication', async () => {
      const res = await app.request('/api/v1/billing/reactivate', {
        method: 'POST',
      });
      expect(res.status).toBe(401);
    });
  });
  
  describe('GET /api/v1/billing/compare/:tier', () => {
    it('should return 401 without authentication', async () => {
      const res = await app.request('/api/v1/billing/compare/pro');
      expect(res.status).toBe(401);
    });
  });
});

describe('Webhook Routes', () => {
  describe('POST /api/webhooks/stripe', () => {
    it('should return 400 without signature', async () => {
      const res = await app.request('/api/webhooks/stripe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: 'test', type: 'test.event', data: { object: {} } }),
      });
      expect(res.status).toBe(400);
    });
    
    it('should return 400 with invalid signature', async () => {
      const res = await app.request('/api/webhooks/stripe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'stripe-signature': 'invalid_signature',
        },
        body: JSON.stringify({ id: 'test', type: 'test.event', data: { object: {} } }),
      });
      expect(res.status).toBe(400);
    });
  });
  
  describe('GET /api/webhooks/stripe/health', () => {
    it('should return health status', async () => {
      const res = await app.request('/api/webhooks/stripe/health');
      expect(res.status).toBe(200);
      
      const data = await res.json();
      expect(data.status).toBe('ok');
      expect(data.configured).toBeDefined();
      expect(typeof data.configured.webhookSecret).toBe('boolean');
      expect(typeof data.configured.hyprProxy).toBe('boolean');
    });
  });
});