/**
 * Stripe Webhook Routes
 * 
 * Handles Stripe webhook events for subscription management.
 */

import { Hono } from 'hono';
import { verifyWebhookSignature, handleCheckoutComplete, handleCustomerSubscription } from '../services/stripe.js';
import { logger } from '../utils/logger.js';

export const webhookRoutes = new Hono();

/**
 * POST /api/webhooks/stripe
 * Handle Stripe webhook events
 * 
 * This endpoint receives webhooks from Stripe and processes:
 * - checkout.session.completed: User completed checkout
 * - customer.subscription.created: New subscription created
 * - customer.subscription.updated: Subscription updated
 * - customer.subscription.deleted: Subscription canceled
 */
webhookRoutes.post('/stripe', async (c) => {
  const signature = c.req.header('stripe-signature');
  
  if (!signature) {
    logger.error('Stripe webhook missing signature');
    return c.json({ error: 'Missing signature' }, 400);
  }
  
  // Get raw body
  const payload = await c.req.text();
  
  // Verify webhook signature
  const event = verifyWebhookSignature(payload, signature);
  
  if (!event) {
    logger.error('Stripe webhook signature verification failed');
    return c.json({ error: 'Invalid signature' }, 400);
  }
  
  logger.info('Received Stripe webhook', { 
    type: event.type, 
    id: event.id 
  });
  
  // Handle different event types
  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as any;
        await handleCheckoutComplete(session);
        break;
      }
      
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as any;
        await handleCustomerSubscription(subscription, event.type);
        break;
      }
      
      case 'invoice.paid': {
        // Invoice paid - could be for renewal
        const invoice = event.data.object as any;
        logger.info('Invoice paid', { 
          invoiceId: invoice.id,
          customerId: invoice.customer 
        });
        break;
      }
      
      case 'invoice.payment_failed': {
        // Payment failed - could mark subscription as past_due
        const invoice = event.data.object as any;
        logger.warn('Invoice payment failed', { 
          invoiceId: invoice.id,
          customerId: invoice.customer,
          attempt: invoice.attempt_count 
        });
        break;
      }
      
      case 'customer.deleted': {
        // Customer deleted - clean up local data
        const customer = event.data.object as any;
        logger.info('Customer deleted', { customerId: customer.id });
        // Could mark user's subscription as deleted here
        break;
      }
      
      default:
        logger.info('Unhandled Stripe webhook event', { 
          type: event.type,
          id: event.id 
        });
    }
    
    return c.json({ received: true });
  } catch (error) {
    logger.error('Error processing Stripe webhook', { 
      type: event.type,
      id: event.id,
      error: { name: error instanceof Error ? error.constructor.name : 'Error', message: error instanceof Error ? error.message : 'Unknown error' } 
    });
    
    // Return 500 to trigger Stripe retry
    return c.json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error' 
    }, 500);
  }
});