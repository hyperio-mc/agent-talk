/**
 * Stripe Webhook Routes
 * 
 * Handles Stripe webhook events for subscription management.
 * 
 * @see HYPR-REFACTOR-PLAN.md Phase 6 - Billing
 * 
 * Note: Webhooks come directly from Stripe servers, NOT through HYPR proxy.
 * The STRIPE_WEBHOOK_SECRET must be set locally for signature verification.
 */

import { Hono } from 'hono';
import { 
  verifyWebhookSignature, 
  handleCheckoutComplete, 
  handleCustomerSubscription 
} from '../services/stripe.js';
import { logger } from '../utils/logger.js';
import { updateUserTier } from '../db-stub/users.js';
import { 
  getSubscriptionByStripeCustomerId, 
  updateSubscription 
} from '../db-stub/subscriptions.js';

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
 * - invoice.paid: Invoice paid (renewal confirmation)
 * - invoice.payment_failed: Payment failed
 * - customer.deleted: Customer deleted
 * 
 * Security: Stripe webhook signature is verified using STRIPE_WEBHOOK_SECRET
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
          customerId: invoice.customer,
          subscriptionId: invoice.subscription,
        });
        
        // If this is a renewal, ensure the user's tier is correct
        if (invoice.subscription) {
          try {
            const subRecord = await getSubscriptionByStripeCustomerId(invoice.customer);
            if (subRecord && subRecord.tier) {
              await updateUserTier(subRecord.user_id, subRecord.tier as any);
              logger.info('Renewed subscription tier confirmed', {
                userId: subRecord.user_id,
                tier: subRecord.tier,
              });
            }
          } catch (err) {
            logger.logError('Failed to confirm renewal tier', err, { 
              customerId: invoice.customer,
            });
          }
        }
        break;
      }
      
      case 'invoice.payment_failed': {
        // Payment failed - could mark subscription as past_due
        const invoice = event.data.object as any;
        logger.warn('Invoice payment failed', { 
          invoiceId: invoice.id,
          customerId: invoice.customer,
          attempt: invoice.attempt_count,
          subscriptionId: invoice.subscription,
        });
        
        // Update subscription status if we can find it
        if (invoice.customer) {
          try {
            const subRecord = await getSubscriptionByStripeCustomerId(invoice.customer);
            if (subRecord) {
              await updateSubscription(subRecord.id, {
                status: 'past_due',
              });
              logger.info('Marked subscription as past_due', {
                subscriptionId: subRecord.id,
                userId: subRecord.user_id,
              });
            }
          } catch (err) {
            logger.logError('Failed to update subscription status on payment failure', err, {
              customerId: invoice.customer,
            });
          }
        }
        break;
      }
      
      case 'customer.deleted': {
        // Customer deleted - clean up local data
        const customer = event.data.object as any;
        logger.info('Customer deleted', { customerId: customer.id });
        
        // Find and update the subscription record
        try {
          const subRecord = await getSubscriptionByStripeCustomerId(customer.id);
          if (subRecord) {
            await updateSubscription(subRecord.id, {
              status: 'canceled',
            });
            // Downgrade user to hobby
            await updateUserTier(subRecord.user_id, 'hobby');
            logger.info('Cleaned up deleted customer', {
              userId: subRecord.user_id,
              customerId: customer.id,
            });
          }
        } catch (err) {
          logger.logError('Failed to clean up deleted customer', err, {
            customerId: customer.id,
          });
        }
        break;
      }
      
      case 'customer.updated': {
        // Customer updated - could sync email or other details
        const customer = event.data.object as any;
        logger.debug('Customer updated', { 
          customerId: customer.id,
          email: customer.email,
        });
        break;
      }
      
      case 'payment_intent.succeeded': {
        // Payment intent succeeded - general payment confirmation
        const paymentIntent = event.data.object as any;
        logger.info('Payment intent succeeded', { 
          paymentIntentId: paymentIntent.id,
          customerId: paymentIntent.customer,
        });
        break;
      }
      
      case 'payment_intent.payment_failed': {
        // Payment intent failed
        const paymentIntent = event.data.object as any;
        logger.warn('Payment intent failed', { 
          paymentIntentId: paymentIntent.id,
          customerId: paymentIntent.customer,
          lastPaymentError: paymentIntent.last_payment_error?.message,
        });
        break;
      }
      
      case 'charge.succeeded': {
        // Charge succeeded - could send receipt email
        const charge = event.data.object as any;
        logger.info('Charge succeeded', { 
          chargeId: charge.id,
          customerId: charge.customer,
          amount: charge.amount,
          currency: charge.currency,
        });
        break;
      }
      
      case 'charge.failed': {
        // Charge failed
        const charge = event.data.object as any;
        logger.warn('Charge failed', { 
          chargeId: charge.id,
          customerId: charge.customer,
          failureMessage: charge.failure_message,
        });
        break;
      }
      
      case 'charge.refunded': {
        // Charge refunded - could update user tier
        const charge = event.data.object as any;
        logger.info('Charge refunded', { 
          chargeId: charge.id,
          customerId: charge.customer,
          amountRefunded: charge.amount_refunded,
        });
        
        // If fully refunded, might want to cancel subscription
        if (charge.refunded && charge.customer) {
          try {
            const subRecord = await getSubscriptionByStripeCustomerId(charge.customer);
            if (subRecord) {
              logger.info('Full refund issued for subscription', {
                userId: subRecord.user_id,
                subscriptionId: subRecord.id,
              });
              // Note: We don't auto-cancel on refund - let that be handled by
              // customer.subscription.deleted or manual review
            }
          } catch (err) {
            logger.logError('Failed to process refund webhook', err, {
              customerId: charge.customer,
            });
          }
        }
        break;
      }
      
      default:
        logger.debug('Unhandled Stripe webhook event', { 
          type: event.type,
          id: event.id 
        });
    }
    
    return c.json({ received: true });
  } catch (error) {
    logger.logError('Error processing Stripe webhook', error, { 
      type: event.type,
      id: event.id,
    });
    
    // Return 500 to trigger Stripe retry
    return c.json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error' 
    }, 500);
  }
});

/**
 * GET /api/webhooks/stripe/health
 * Health check endpoint for webhook monitoring
 */
webhookRoutes.get('/stripe/health', (c) => {
  // Check if webhook secret is configured
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  const useHyprProxy = process.env.USE_HYPR_PROXY === 'true' || process.env.HYPR_MODE === 'production';
  
  return c.json({
    status: 'ok',
    configured: {
      webhookSecret: !!webhookSecret,
      stripeKey: !!stripeKey,
      hyprProxy: useHyprProxy,
      stripeViaProxy: useHyprProxy && !stripeKey,
    },
    note: useHyprProxy 
      ? 'Stripe API calls go through HYPR proxy' 
      : 'Stripe SDK used directly (development mode)',
  });
});