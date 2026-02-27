<script>
  import { onMount } from 'svelte';

  // API base URL
  const API_BASE = typeof window !== 'undefined' && window.location.hostname === 'localhost' 
    ? 'http://localhost:3001' 
    : 'https://talk.onhyper.io';

  // Props
  export let user = null;
  export let stats = null;

  // State
  let subscription = null;
  let tiers = [];
  let loading = true;
  let upgrading = false;
  let canceling = false;
  let error = null;
  let success = null;

  // Check authentication
  function getAuthToken() {
    return localStorage.getItem('auth_token');
  }

  // Fetch subscription info
  async function fetchSubscription() {
    const token = getAuthToken();
    if (!token) return;

    try {
      const response = await fetch(`${API_BASE}/api/v1/billing/subscription`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        subscription = data.subscription;
      }
    } catch (e) {
      console.error('Failed to fetch subscription:', e);
    }
  }

  // Fetch tiers
  async function fetchTiers() {
    try {
      const response = await fetch(`${API_BASE}/api/v1/billing/tiers`);
      if (response.ok) {
        const data = await response.json();
        tiers = data.tiers;
      }
    } catch (e) {
      console.error('Failed to fetch tiers:', e);
    }
  }

  // Start Pro upgrade
  async function startUpgrade() {
    const token = getAuthToken();
    if (!token) return;

    upgrading = true;
    error = null;
    success = null;

    try {
      const response = await fetch(`${API_BASE}/api/v1/billing/checkout`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({})
      });

      const data = await response.json();

      if (data.success && data.checkoutUrl) {
        // Redirect to Stripe checkout
        window.location.href = data.checkoutUrl;
      } else {
        throw new Error(data.message || 'Failed to create checkout session');
      }
    } catch (e) {
      error = e.message;
      upgrading = false;
    }
  }

  // Open billing portal
  async function openPortal() {
    const token = getAuthToken();
    if (!token) return;

    try {
      const response = await fetch(`${API_BASE}/api/v1/billing/portal`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({})
      });

      const data = await response.json();

      if (data.success && data.portalUrl) {
        window.location.href = data.portalUrl;
      } else {
        throw new Error(data.message || 'Failed to open billing portal');
      }
    } catch (e) {
      error = e.message;
    }
  }

  // Cancel subscription
  async function cancelSubscription() {
    if (!confirm('Are you sure you want to cancel? You will lose access to Pro features at the end of your billing period.')) {
      return;
    }

    const token = getAuthToken();
    if (!token) return;

    canceling = true;
    error = null;

    try {
      const response = await fetch(`${API_BASE}/api/v1/billing/cancel`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();

      if (data.success) {
        success = 'Subscription will be canceled at the end of your billing period.';
        await fetchSubscription();
      } else {
        throw new Error(data.message || 'Failed to cancel subscription');
      }
    } catch (e) {
      error = e.message;
    } finally {
      canceling = false;
    }
  }

  // Format price
  function formatPrice(price) {
    if (price === null || price === undefined) return 'Custom';
    return `$${price}/mo`;
  }

  // Format date
  function formatDate(dateStr) {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }

  // Initialize
  onMount(async () => {
    await Promise.all([fetchSubscription(), fetchTiers()]);
    loading = false;
  });

  // Check for billing result in URL params
  $: {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const billingResult = params.get('billing');
      if (billingResult === 'success') {
        success = 'Payment successful! Your account has been upgraded.';
        // Refresh subscription
        fetchSubscription();
        // Clean up URL
        window.history.replaceState({}, '', window.location.pathname + '#billing');
      } else if (billingResult === 'canceled') {
        error = 'Payment was canceled. Please try again.';
        window.history.replaceState({}, '', window.location.pathname + '#billing');
      }
    }
  }
</script>

<main>
  {#if loading}
    <div class="loading">
      <div class="spinner"></div>
      <p>Loading billing info...</p>
    </div>
  {:else}
    <section class="billing-section">
      {#if success}
        <div class="alert alert-success">
          {success}
          <button on:click={() => success = null}>×</button>
        </div>
      {/if}

      {#if error}
        <div class="alert alert-error">
          {error}
          <button on:click={() => error = null}>×</button>
        </div>
      {/if}

      <!-- Current Plan -->
      <div class="current-plan">
        <h2>Current Plan</h2>
        <div class="plan-card">
          <div class="plan-header">
            <span class="plan-name">{subscription?.tierName || 'Hobby'}</span>
            <span class="plan-price">{formatPrice(subscription?.price)}</span>
          </div>
          
          {#if subscription?.status && subscription.status !== 'active'}
            <div class="plan-status status-{subscription.status}">
              Status: {subscription.status}
            </div>
          {/if}

          {#if subscription?.cancelAtPeriodEnd}
            <div class="plan-cancelation">
              ⚠️ Your subscription will end on {formatDate(subscription?.currentPeriodEnd)}
            </div>
          {/if}

          {#if subscription?.currentPeriodEnd && subscription.tier !== 'hobby'}
            <div class="plan-period">
              Current period ends: {formatDate(subscription?.currentPeriodEnd)}
            </div>
          {/if}

          <div class="plan-actions">
            {#if subscription?.tier === 'hobby'}
              <button class="btn-upgrade" on:click={startUpgrade} disabled={upgrading}>
                {#if upgrading}
                  Processing...
                {:else}
                  Upgrade to Pro
                {/if}
              </button>
            {:else if subscription?.tier === 'pro'}
              {#if subscription?.billing?.canManageSubscription}
                <button class="btn-secondary" on:click={openPortal}>
                  Manage Subscription
                </button>
              {/if}
              {#if !subscription?.cancelAtPeriodEnd}
                <button class="btn-cancel" on:click={cancelSubscription} disabled={canceling}>
                  {#if canceling}
                    Canceling...
                  {:else}
                    Cancel Subscription
                  {/if}
                </button>
              {/if}
            {:else}
              <button class="btn-secondary" on:click={openPortal}>
                Manage Subscription
              </button>
            {/if}
          </div>
        </div>
      </div>

      <!-- Pricing Tiers -->
      <div class="pricing-section">
        <h2>Available Plans</h2>
        <div class="pricing-grid">
          {#each tiers as tier}
            <div class="tier-card" class:highlighted={tier.highlighted} class:current={tier.name === subscription?.tier}>
              {#if tier.highlighted}
                <div class="tier-badge">Most Popular</div>
              {/if}
              {#if tier.name === subscription?.tier}
                <div class="tier-badge current">Current Plan</div>
              {/if}
              
              <h3>{tier.displayName}</h3>
              <p class="tier-description">{tier.description}</p>
              <div class="tier-price">
                <span class="amount">{formatPrice(tier.price)}</span>
              </div>

              <div class="tier-limits">
                <div class="limit-item">
                  <span class="limit-label">API Calls</span>
                  <span class="limit-value">{tier.limits.callsPerDay === 'unlimited' ? 'Unlimited' : tier.limits.callsPerDay + '/day'}</span>
                </div>
                <div class="limit-item">
                  <span class="limit-label">Characters</span>
                  <span class="limit-value">{tier.limits.charsPerMemo === 'unlimited' ? 'Unlimited' : tier.limits.charsPerMemo.toLocaleString()}</span>
                </div>
                <div class="limit-item">
                  <span class="limit-label">API Keys</span>
                  <span class="limit-value">{tier.limits.maxApiKeys}</span>
                </div>
              </div>

              <div class="tier-features">
                {#if tier.features.tts}
                  <div class="feature">
                    ✓ {tier.features.tts === 'edge' ? 'Edge TTS' : tier.features.tts === 'elevenlabs' ? 'ElevenLabs TTS' : 'Premium TTS'}
                  </div>
                {/if}
                {#if tier.features.priority}
                  <div class="feature">✓ Priority Processing</div>
                {/if}
                {#if tier.features.webhooks}
                  <div class="feature">✓ Webhooks</div>
                {/if}
                {#if tier.features.analytics === 'advanced'}
                  <div class="feature">✓ Advanced Analytics</div>
                {/if}
                {#if tier.features.voiceCloning}
                  <div class="feature">✓ Voice Cloning</div>
                {/if}
                {#if tier.features.slaPercentage}
                  <div class="feature">✓ {tier.features.slaPercentage}% SLA</div>
                {/if}
              </div>

              {#if tier.name !== subscription?.tier && tier.name === 'pro'}
                <button 
                  class="btn-upgrade" 
                  on:click={startUpgrade}
                  disabled={upgrading}
                >
                  Upgrade
                </button>
              {:else if tier.name === 'enterprise'}
                <a href="mailto:sales@onhyper.io" class="btn-contact">Contact Sales</a>
              {:else}
                <button class="btn-current" disabled>Current</button>
              {/if}
            </div>
          {/each}
        </div>
      </div>

      <!-- Support -->
      <div class="support-section">
        <p>Need help with billing? <a href="mailto:support@onhyper.io">Contact Support</a></p>
      </div>
    </section>
  {/if}
</main>

<style>
  .loading {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 400px;
  }

  .spinner {
    width: 40px;
    height: 40px;
    border: 3px solid #e5e7eb;
    border-top-color: #3b82f6;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .billing-section {
    max-width: 1200px;
    margin: 0 auto;
    padding: 2rem;
  }

  .alert {
    padding: 1rem 1.5rem;
    border-radius: 8px;
    margin-bottom: 1.5rem;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .alert-success {
    background: #d1fae5;
    color: #065f46;
    border: 1px solid #6ee7b7;
  }

  .alert-error {
    background: #fee2e2;
    color: #991b1b;
    border: 1px solid #fca5a5;
  }

  .alert button {
    background: transparent;
    border: none;
    font-size: 1.25rem;
    cursor: pointer;
    opacity: 0.7;
  }

  .alert button:hover {
    opacity: 1;
  }

  h2 {
    font-size: 1.5rem;
    margin-bottom: 1.25rem;
  }

  .current-plan {
    margin-bottom: 3rem;
  }

  .plan-card {
    background: white;
    border-radius: 12px;
    padding: 2rem;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  }

  .plan-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1rem;
  }

  .plan-name {
    font-size: 1.75rem;
    font-weight: 700;
    text-transform: capitalize;
  }

  .plan-price {
    font-size: 1.5rem;
    color: #3b82f6;
    font-weight: 600;
  }

  .plan-status {
    padding: 0.5rem 1rem;
    border-radius: 6px;
    font-size: 0.875rem;
    margin-bottom: 1rem;
  }

  .status-active {
    background: #d1fae5;
    color: #065f46;
  }

  .status-past_due, .status-unpaid {
    background: #fee2e2;
    color: #991b1b;
  }

  .status-canceled {
    background: #f3f4f6;
    color: #6b7280;
  }

  .plan-cancelation {
    padding: 0.75rem 1rem;
    background: #fef3c7;
    border-radius: 8px;
    color: #92400e;
    margin-bottom: 1rem;
  }

  .plan-period {
    color: #6b7280;
    font-size: 0.9rem;
    margin-bottom: 1.5rem;
  }

  .plan-actions {
    display: flex;
    gap: 1rem;
    flex-wrap: wrap;
  }

  .btn-upgrade {
    background: #3b82f6;
    color: white;
    border: none;
    padding: 0.75rem 1.5rem;
    font-size: 1rem;
    font-weight: 600;
    border-radius: 8px;
    cursor: pointer;
    transition: background 0.2s;
  }

  .btn-upgrade:hover:not(:disabled) {
    background: #2563eb;
  }

  .btn-upgrade:disabled {
    background: #9ca3af;
    cursor: not-allowed;
  }

  .btn-secondary {
    background: white;
    color: #3b82f6;
    border: 1px solid #3b82f6;
    padding: 0.75rem 1.5rem;
    font-size: 1rem;
    font-weight: 600;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s;
  }

  .btn-secondary:hover {
    background: #eff6ff;
  }

  .btn-cancel {
    background: transparent;
    color: #ef4444;
    border: 1px solid #ef4444;
    padding: 0.75rem 1.5rem;
    font-size: 1rem;
    font-weight: 600;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s;
  }

  .btn-cancel:hover:not(:disabled) {
    background: #fee2e2;
  }

  .btn-cancel:disabled {
    color: #9ca3af;
    border-color: #9ca3af;
    cursor: not-allowed;
  }

  .pricing-section {
    margin-bottom: 2rem;
  }

  .pricing-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 1.5rem;
  }

  .tier-card {
    background: white;
    border-radius: 12px;
    padding: 1.5rem;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    position: relative;
    border: 2px solid transparent;
    transition: border-color 0.2s, transform 0.2s;
  }

  .tier-card:hover {
    transform: translateY(-2px);
  }

  .tier-card.highlighted {
    border-color: #3b82f6;
  }

  .tier-card.current {
    border-color: #10b981;
  }

  .tier-badge {
    position: absolute;
    top: -12px;
    left: 50%;
    transform: translateX(-50%);
    background: #3b82f6;
    color: white;
    padding: 0.25rem 1rem;
    border-radius: 20px;
    font-size: 0.75rem;
    font-weight: 600;
  }

  .tier-badge.current {
    background: #10b981;
  }

  .tier-card h3 {
    margin: 0.5rem 0;
    font-size: 1.25rem;
    color: #1a1a2e;
  }

  .tier-description {
    color: #6b7280;
    font-size: 0.9rem;
    margin-bottom: 1rem;
  }

  .tier-price {
    margin-bottom: 1.5rem;
  }

  .tier-price .amount {
    font-size: 2rem;
    font-weight: 700;
  }

  .tier-limits {
    padding: 1rem 0;
    border-top: 1px solid #f3f4f6;
    border-bottom: 1px solid #f3f4f6;
    margin-bottom: 1rem;
  }

  .limit-item {
    display: flex;
    justify-content: space-between;
    padding: 0.5rem 0;
  }

  .limit-label {
    color: #6b7280;
    font-size: 0.9rem;
  }

  .limit-value {
    font-weight: 600;
    font-size: 0.9rem;
  }

  .tier-features {
    margin-bottom: 1.5rem;
  }

  .feature {
    padding: 0.25rem 0;
    font-size: 0.9rem;
    color: #374151;
  }

  .btn-current {
    width: 100%;
    background: #f3f4f6;
    color: #6b7280;
    border: none;
    padding: 0.75rem;
    font-size: 1rem;
    font-weight: 600;
    border-radius: 8px;
    cursor: not-allowed;
  }

  .btn-contact {
    display: block;
    width: 100%;
    text-align: center;
    background: #1a1a2e;
    color: white;
    padding: 0.75rem;
    font-size: 1rem;
    font-weight: 600;
    border-radius: 8px;
    text-decoration: none;
    transition: background 0.2s;
  }

  .btn-contact:hover {
    background: #374151;
  }

  .support-section {
    text-align: center;
    padding: 2rem;
    color: #6b7280;
  }

  .support-section a {
    color: #3b82f6;
    text-decoration: none;
  }

  .support-section a:hover {
    text-decoration: underline;
  }

  @media (max-width: 768px) {
    .pricing-grid {
      grid-template-columns: 1fr;
    }

    .plan-header {
      flex-direction: column;
      align-items: flex-start;
      gap: 0.5rem;
    }

    .plan-actions {
      flex-direction: column;
    }
  }
</style>