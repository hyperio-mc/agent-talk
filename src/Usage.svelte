<script>
  import UsageChart from './lib/UsageChart.svelte';
  import { onMount } from 'svelte';

  // API base URL
  const API_BASE = typeof window !== 'undefined' && window.location.hostname === 'localhost' 
    ? 'http://localhost:3001' 
    : 'https://talk.onhyper.io';

  // State
  let user = null;
  let stats = null;
  let usageData = [];
  let loading = true;
  let error = null;
  let chartDays = 7;
  
  // Mobile menu state
  let mobileMenuOpen = false;

  // Check authentication
  function getAuthToken() {
    const params = new URLSearchParams(window.location.search);
    const tokenFromUrl = params.get('token');
    if (tokenFromUrl) {
      localStorage.setItem('auth_token', tokenFromUrl);
      window.history.replaceState({}, '', window.location.pathname);
      return tokenFromUrl;
    }
    return localStorage.getItem('auth_token');
  }

  // Fetch user account info
  async function fetchAccount() {
    const token = getAuthToken();
    if (!token) {
      window.location.href = '/login.html';
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/api/v1/dashboard/account`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        if (response.status === 401) {
          localStorage.removeItem('auth_token');
          window.location.href = '/login.html';
          return;
        }
        throw new Error('Failed to fetch account');
      }

      const data = await response.json();
      user = data.account;
      if (data.tierInfo) {
        if (!stats) stats = {};
        stats.tierInfo = data.tierInfo;
      }
    } catch (e) {
      error = e.message;
    }
  }

  // Fetch dashboard stats
  async function fetchStats() {
    const token = getAuthToken();
    if (!token) return;

    try {
      const response = await fetch(`${API_BASE}/api/v1/dashboard/stats`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        const existingTierInfo = stats?.tierInfo;
        stats = data.stats;
        if (!stats.tierInfo && existingTierInfo) {
          stats.tierInfo = existingTierInfo;
        }
        if (data.tier) {
          stats.tier = data.tier;
        }
      }
    } catch (e) {
      console.error('Failed to fetch stats:', e);
    }
  }

  // Fetch usage chart data
  async function fetchUsageData() {
    const token = getAuthToken();
    if (!token) return;

    try {
      const response = await fetch(`${API_BASE}/api/v1/analytics/charts?days=${chartDays}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        usageData = data.data.daily || [];
      }
    } catch (e) {
      console.error('Failed to fetch usage data:', e);
    }
  }

  // Export usage data as CSV
  async function exportUsageData() {
    const token = getAuthToken();
    if (!token) return;

    try {
      const response = await fetch(`${API_BASE}/api/v1/analytics/export?days=${chartDays}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const csv = await response.text();
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `agent-talk-usage-${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (e) {
      console.error('Failed to export:', e);
    }
  }

  // Logout
  function logout() {
    const token = getAuthToken();
    if (token) {
      fetch(`${API_BASE}/api/v1/auth/logout`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }).catch(() => {});
    }
    localStorage.removeItem('auth_token');
    window.location.href = '/login.html';
  }

  // Format number
  function formatNumber(num) {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num?.toString() || '0';
  }

  // Format date
  function formatDate(dateStr) {
    if (!dateStr) return 'Never';
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }

  // Calculate weekly usage from daily data
  function getWeeklyUsage() {
    if (!usageData || usageData.length === 0) return 0;
    const last7Days = usageData.slice(-7);
    return last7Days.reduce((sum, d) => sum + (d.calls || 0), 0);
  }

  // Calculate monthly usage from daily data
  function getMonthlyUsage() {
    if (!usageData || usageData.length === 0) return 0;
    const last30Days = usageData.slice(-30);
    return last30Days.reduce((sum, d) => sum + (d.calls || 0), 0);
  }

  // Initialize
  onMount(async () => {
    await fetchAccount();
    if (user) {
      await Promise.all([
        fetchStats(),
        fetchUsageData()
      ]);
    }
    loading = false;
  });

  // Watch for chartDays changes
  $: if (chartDays && !loading) {
    fetchUsageData();
  }
</script>

<main>
  {#if loading}
    <div class="loading">
      <div class="spinner"></div>
      <p>Loading usage stats...</p>
    </div>
  {:else if error}
    <div class="error">
      <h2>Error</h2>
      <p>{error}</p>
      <button on:click={() => window.location.reload()}>Retry</button>
    </div>
  {:else if !user}
    <div class="not-authenticated">
      <h2>Please log in</h2>
      <p>You need to be logged in to view usage statistics.</p>
      <a href="/login.html" class="btn-primary">Go to Login</a>
    </div>
  {:else}
    <header>
      <div class="header-content">
        <a href="/dashboard.html" class="logo">
          <strong>Agent Talk</strong>
          <span class="badge">{user.tier}</span>
        </a>
        
        <button class="mobile-menu-btn" on:click={() => mobileMenuOpen = !mobileMenuOpen} aria-label="Toggle menu">
          <span class="hamburger"></span>
        </button>
        
        <nav class="desktop-nav">
          <a href="/dashboard.html">Overview</a>
          <a href="/usage.html" class="active">Usage</a>
          <a href="/billing.html">Billing</a>
        </nav>
        
        <div class="user-menu">
          <span class="user-email">{user.email}</span>
          <button class="btn-logout" on:click={logout}>Logout</button>
        </div>
      </div>
      
      {#if mobileMenuOpen}
        <nav class="mobile-nav">
          <a href="/dashboard.html">Overview</a>
          <a href="/usage.html" class="active">Usage</a>
          <a href="/billing.html">Billing</a>
          <button class="btn-logout-mobile" on:click={logout}>Logout ({user.email})</button>
        </nav>
      {/if}
    </header>

    <div class="usage-page">
      <section class="usage-section">
        <h1>Usage Statistics</h1>
        <p class="subtitle">Track your API usage and rate limits</p>

        <!-- Rate Limit Card -->
        <div class="rate-limit-card">
          <div class="rate-limit-header">
            <h3>📊 Today's Usage</h3>
            <span class="tier-badge">{stats?.tier?.displayName || 'Hobby'}</span>
          </div>
          <div class="rate-limit-display">
            <div class="rate-limit-value">
              <span class="used">{stats?.usage?.today || 0}</span>
              <span class="separator">/</span>
              <span class="limit">{stats?.rateLimit?.limit || '∞'}</span>
              <span class="unit">calls</span>
            </div>
            <div class="rate-limit-bar">
              {#if stats?.rateLimit?.limit && stats.rateLimit.limit !== 'unlimited'}
                {@const percentage = Math.min(100, ((stats?.usage?.today || 0) / stats.rateLimit.limit) * 100)}
                <div class="rate-limit-fill" style="width: {percentage}%" class:warning={percentage >= 80} class:danger={percentage >= 95}></div>
              {:else}
                <div class="rate-limit-fill unlimited" style="width: 0%"></div>
              {/if}
            </div>
            <p class="rate-limit-note">
              {#if stats?.rateLimit?.limit === 'unlimited'}
                ♾️ Unlimited calls on your plan
              {:else if (stats?.usage?.today || 0) >= (stats?.rateLimit?.limit || 0)}
                ⚠️ Daily limit reached. Resets at midnight UTC.
              {:else}
                ✅ {stats?.rateLimit?.remaining || 0} calls remaining today
              {/if}
            </p>
          </div>
        </div>

        <!-- Usage Summary Cards -->
        <div class="usage-summary-grid">
          <div class="summary-card">
            <div class="summary-icon">📅</div>
            <div class="summary-content">
              <span class="summary-value">{formatNumber(stats?.usage?.today || 0)}</span>
              <span class="summary-label">Today</span>
            </div>
          </div>
          <div class="summary-card">
            <div class="summary-icon">📆</div>
            <div class="summary-content">
              <span class="summary-value">{formatNumber(getWeeklyUsage())}</span>
              <span class="summary-label">This Week</span>
            </div>
          </div>
          <div class="summary-card">
            <div class="summary-icon">📈</div>
            <div class="summary-content">
              <span class="summary-value">{formatNumber(stats?.usage?.thisMonth || getMonthlyUsage())}</span>
              <span class="summary-label">This Month</span>
            </div>
          </div>
          <div class="summary-card">
            <div class="summary-icon">🔤</div>
            <div class="summary-content">
              <span class="summary-value">{formatNumber(stats?.memos?.totalCharacters || 0)}</span>
              <span class="summary-label">Characters</span>
            </div>
          </div>
        </div>

        <!-- Usage Details Table -->
        <div class="usage-table-section">
          <h3>Usage Details</h3>
          {#if usageData.length > 0}
            <div class="table-container">
              <table class="usage-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Calls</th>
                    <th>Characters</th>
                    <th>Avg Duration</th>
                  </tr>
                </thead>
                <tbody>
                  {#each usageData.slice().reverse().slice(0, 14) as day}
                    <tr>
                      <td>{formatDate(day.date)}</td>
                      <td>{formatNumber(day.calls || 0)}</td>
                      <td>{formatNumber(day.characters || 0)}</td>
                      <td>{day.avgDuration ? day.avgDuration.toFixed(2) + 's' : '—'}</td>
                    </tr>
                  {/each}
                </tbody>
              </table>
            </div>
          {:else}
            <div class="empty-table">
              <p>No usage data yet</p>
              <p class="hint">Make your first API call to see usage details</p>
            </div>
          {/if}
        </div>

        <!-- Period Selector -->
        <div class="chart-section">
          <div class="chart-header">
            <h3>Usage Over Time</h3>
            <div class="period-selector">
              <button 
                class:active={chartDays === 7} 
                on:click={() => chartDays = 7}>
                7 Days
              </button>
              <button 
                class:active={chartDays === 30} 
                on:click={() => chartDays = 30}>
                30 Days
              </button>
              <button 
                class:active={chartDays === 90} 
                on:click={() => chartDays = 90}>
                90 Days
              </button>
            </div>
          </div>
          {#if usageData.length > 0}
            <UsageChart data={usageData} days={chartDays} />
          {:else}
            <div class="empty-chart">
              <p>No usage data yet</p>
              <p class="hint">Make your first API call to see usage here</p>
            </div>
          {/if}
        </div>

        <!-- Tier Limits -->
        <div class="tier-limits-card">
          <h3>Plan Limits</h3>
          <div class="limits-grid">
            <div class="limit-item">
              <span class="limit-label">Daily Calls</span>
              <span class="limit-value">
                {#if stats?.rateLimit?.limit === 'unlimited'}
                  ♾️ Unlimited
                {:else}
                  {formatNumber(stats?.rateLimit?.limit || 0)}
                {/if}
              </span>
            </div>
            <div class="limit-item">
              <span class="limit-label">Characters per Memo</span>
              <span class="limit-value">
                {#if stats?.tierInfo?.limits?.charsPerMemo === 'unlimited'}
                  ♾️ Unlimited
                {:else if stats?.tierInfo?.limits?.charsPerMemo}
                  {formatNumber(stats.tierInfo.limits.charsPerMemo)}
                {:else}
                  5,000
                {/if}
              </span>
            </div>
            <div class="limit-item">
              <span class="limit-label">API Keys</span>
              <span class="limit-value">{stats?.apiKeys?.active || 0} / {stats?.apiKeys?.maxAllowed || 5}</span>
            </div>
            <div class="limit-item">
              <span class="limit-label">TTS Provider</span>
              <span class="limit-value">{stats?.tier?.tts || 'Edge TTS'}</span>
            </div>
          </div>
          {#if stats?.tier?.name === 'hobby'}
            <div class="upgrade-prompt">
              <p>Need more? <a href="/billing.html" class="upgrade-link">Upgrade your plan →</a></p>
            </div>
          {/if}
        </div>

        <!-- Export -->
        <div class="export-section">
          <button class="btn-export" on:click={exportUsageData}>
            📥 Export Usage Data (CSV)
          </button>
        </div>
      </section>
    </div>

    <footer>
      <div class="footer-content">
        <p>Agent Talk — Text-to-speech API for AI agents</p>
        <a href="mailto:support@onhyper.io">Support</a>
      </div>
    </footer>
  {/if}
</main>

<style>
  :global(body) {
    margin: 0;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
    background: #f5f7fa;
    color: #1a1a2e;
  }

  .loading, .loading-keys {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 100vh;
    background: #f5f7fa;
  }

  .spinner {
    width: 40px;
    height: 40px;
    border: 3px solid #e5e7eb;
    border-top-color: #f97316;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .error, .not-authenticated {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 100vh;
    text-align: center;
    padding: 2rem;
  }

  .error h2, .not-authenticated h2 {
    color: #dc2626;
    margin-bottom: 1rem;
  }

  .btn-primary {
    display: inline-block;
    background: #f97316;
    color: white;
    padding: 0.75rem 1.5rem;
    border-radius: 8px;
    text-decoration: none;
    font-weight: 600;
    border: none;
    cursor: pointer;
    transition: background 0.2s;
  }

  .btn-primary:hover {
    background: #ea580c;
  }

  /* Header */
  header {
    background: white;
    border-bottom: 1px solid #e5e7eb;
    position: sticky;
    top: 0;
    z-index: 100;
  }

  .header-content {
    max-width: 1200px;
    margin: 0 auto;
    padding: 1rem 2rem;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 2rem;
  }

  .logo {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    text-decoration: none;
    color: #1a1a2e;
  }

  .logo strong {
    font-size: 1.25rem;
  }

  .badge {
    background: #f97316;
    color: white;
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
  }

  .desktop-nav {
    display: flex;
    gap: 0.5rem;
  }

  .desktop-nav a, .desktop-nav button {
    padding: 0.5rem 1rem;
    border: none;
    background: transparent;
    color: #6b7280;
    font-size: 0.9rem;
    cursor: pointer;
    border-radius: 6px;
    text-decoration: none;
    transition: all 0.2s;
  }

  .desktop-nav a:hover, .desktop-nav button:hover {
    background: #f3f4f6;
    color: #1a1a2e;
  }

  .desktop-nav a.active, .desktop-nav button.active {
    background: #fff7ed;
    color: #f97316;
  }

  .user-menu {
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  .user-email {
    color: #6b7280;
    font-size: 0.875rem;
  }

  .btn-logout {
    padding: 0.5rem 1rem;
    background: transparent;
    border: 1px solid #e5e7eb;
    border-radius: 6px;
    color: #6b7280;
    font-size: 0.875rem;
    cursor: pointer;
    transition: all 0.2s;
  }

  .btn-logout:hover {
    background: #fee2e2;
    border-color: #fca5a5;
    color: #dc2626;
  }

  .mobile-menu-btn {
    display: none;
    width: 40px;
    height: 40px;
    background: transparent;
    border: none;
    cursor: pointer;
    position: relative;
  }

  .hamburger, .hamburger::before, .hamburger::after {
    display: block;
    width: 24px;
    height: 2px;
    background: #1a1a2e;
    position: absolute;
    left: 8px;
    transition: all 0.2s;
  }

  .hamburger {
    top: 19px;
  }

  .hamburger::before {
    content: '';
    top: -8px;
  }

  .hamburger::after {
    content: '';
    top: 8px;
  }

  .mobile-nav {
    display: none;
    flex-direction: column;
    padding: 1rem;
    border-top: 1px solid #e5e7eb;
    background: white;
  }

  .mobile-nav a, .mobile-nav button {
    padding: 0.75rem 1rem;
    border: none;
    background: transparent;
    color: #6b7280;
    font-size: 0.9rem;
    cursor: pointer;
    text-align: left;
    text-decoration: none;
  }

  .mobile-nav a.active {
    background: #fff7ed;
    color: #f97316;
  }

  .btn-logout-mobile {
    margin-top: 1rem;
    padding-top: 1rem;
    border-top: 1px solid #e5e7eb;
    color: #dc2626;
  }

  @media (max-width: 768px) {
    .mobile-menu-btn {
      display: block;
    }
    .desktop-nav, .user-menu {
      display: none;
    }
    .mobile-nav {
      display: flex;
    }
  }

  /* Usage Page */
  .usage-page {
    max-width: 1000px;
    margin: 0 auto;
    padding: 2rem;
  }

  .usage-section h1 {
    font-size: 1.75rem;
    margin: 0 0 0.5rem;
    color: #1a1a2e;
  }

  .subtitle {
    color: #6b7280;
    margin: 0 0 2rem;
  }

  /* Rate Limit Card */
  .rate-limit-card {
    background: white;
    border-radius: 12px;
    padding: 1.5rem;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    margin-bottom: 1.5rem;
  }

  .rate-limit-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1rem;
  }

  .rate-limit-header h3 {
    margin: 0;
    font-size: 1.125rem;
  }

  .tier-badge {
    background: linear-gradient(135deg, #f97316, #f59e0b);
    color: white;
    padding: 0.25rem 0.75rem;
    border-radius: 20px;
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
  }

  .rate-limit-value {
    display: flex;
    align-items: baseline;
    gap: 0.25rem;
    margin-bottom: 1rem;
  }

  .rate-limit-value .used {
    font-size: 2.5rem;
    font-weight: 700;
    color: #1a1a2e;
  }

  .rate-limit-value .separator {
    font-size: 1.5rem;
    color: #9ca3af;
  }

  .rate-limit-value .limit {
    font-size: 1.5rem;
    font-weight: 600;
    color: #6b7280;
  }

  .rate-limit-value .unit {
    font-size: 1rem;
    color: #9ca3af;
    margin-left: 0.5rem;
  }

  .rate-limit-bar {
    height: 12px;
    background: #e5e7eb;
    border-radius: 6px;
    overflow: hidden;
    margin-bottom: 0.75rem;
  }

  .rate-limit-fill {
    height: 100%;
    background: linear-gradient(90deg, #22c55e, #16a34a);
    border-radius: 6px;
    transition: width 0.5s ease;
  }

  .rate-limit-fill.warning {
    background: linear-gradient(90deg, #f59e0b, #d97706);
  }

  .rate-limit-fill.danger {
    background: linear-gradient(90deg, #ef4444, #dc2626);
  }

  .rate-limit-note {
    margin: 0;
    font-size: 0.875rem;
    color: #6b7280;
  }

  /* Usage Summary Grid */
  .usage-summary-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 1rem;
    margin-bottom: 1.5rem;
  }

  .summary-card {
    background: white;
    border-radius: 12px;
    padding: 1.25rem;
    display: flex;
    align-items: center;
    gap: 1rem;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  }

  .summary-icon {
    font-size: 2rem;
  }

  .summary-content {
    display: flex;
    flex-direction: column;
  }

  .summary-value {
    font-size: 1.5rem;
    font-weight: 700;
    color: #1a1a2e;
  }

  .summary-label {
    font-size: 0.75rem;
    color: #6b7280;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  @media (max-width: 768px) {
    .usage-summary-grid {
      grid-template-columns: repeat(2, 1fr);
    }
  }

  @media (max-width: 480px) {
    .usage-summary-grid {
      grid-template-columns: 1fr;
    }
  }

  /* Usage Table */
  .usage-table-section {
    background: white;
    border-radius: 12px;
    padding: 1.5rem;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    margin-bottom: 1.5rem;
  }

  .usage-table-section h3 {
    margin: 0 0 1rem;
    font-size: 1.125rem;
  }

  .table-container {
    overflow-x: auto;
  }

  .usage-table {
    width: 100%;
    border-collapse: collapse;
  }

  .usage-table th,
  .usage-table td {
    padding: 0.75rem 1rem;
    text-align: left;
    border-bottom: 1px solid #e5e7eb;
  }

  .usage-table th {
    font-size: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: #6b7280;
    background: #f9fafb;
  }

  .usage-table td {
    font-size: 0.875rem;
    color: #1a1a2e;
  }

  .usage-table tbody tr:hover {
    background: #f9fafb;
  }

  .empty-table {
    text-align: center;
    padding: 3rem 1rem;
    color: #6b7280;
  }

  .empty-table .hint {
    font-size: 0.875rem;
    color: #9ca3af;
    margin-top: 0.5rem;
  }

  /* Chart Section */
  .chart-section {
    background: white;
    border-radius: 12px;
    padding: 1.5rem;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    margin-bottom: 1.5rem;
  }

  .chart-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1rem;
  }

  .chart-header h3 {
    margin: 0;
    font-size: 1.125rem;
  }

  .period-selector {
    display: flex;
    gap: 0.5rem;
  }

  .period-selector button {
    padding: 0.5rem 1rem;
    background: #f3f4f6;
    border: none;
    border-radius: 6px;
    font-size: 0.875rem;
    cursor: pointer;
    transition: all 0.2s;
  }

  .period-selector button:hover {
    background: #e5e7eb;
  }

  .period-selector button.active {
    background: #f97316;
    color: white;
  }

  .empty-chart {
    text-align: center;
    padding: 3rem 1rem;
    color: #6b7280;
  }

  .empty-chart .hint {
    font-size: 0.875rem;
    color: #9ca3af;
    margin-top: 0.5rem;
  }

  /* Tier Limits Card */
  .tier-limits-card {
    background: white;
    border-radius: 12px;
    padding: 1.5rem;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    margin-bottom: 1.5rem;
  }

  .tier-limits-card h3 {
    margin: 0 0 1rem;
    font-size: 1.125rem;
  }

  .limits-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 1rem;
  }

  .limit-item {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .limit-label {
    font-size: 0.75rem;
    color: #6b7280;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .limit-value {
    font-size: 1.125rem;
    font-weight: 600;
    color: #1a1a2e;
  }

  .upgrade-prompt {
    margin-top: 1.5rem;
    padding-top: 1.5rem;
    border-top: 1px solid #e5e7eb;
    text-align: center;
  }

  .upgrade-prompt p {
    margin: 0;
    color: #6b7280;
  }

  .upgrade-link {
    color: #f97316;
    text-decoration: none;
    font-weight: 600;
  }

  .upgrade-link:hover {
    text-decoration: underline;
  }

  @media (max-width: 768px) {
    .limits-grid {
      grid-template-columns: repeat(2, 1fr);
    }
  }

  /* Export Section */
  .export-section {
    text-align: center;
  }

  .btn-export {
    padding: 0.75rem 1.5rem;
    background: white;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    font-size: 0.9rem;
    cursor: pointer;
    transition: all 0.2s;
  }

  .btn-export:hover {
    background: #f9fafb;
    border-color: #d1d5db;
  }

  /* Footer */
  footer {
    background: white;
    border-top: 1px solid #e5e7eb;
    padding: 1.5rem 2rem;
    margin-top: 2rem;
  }

  .footer-content {
    max-width: 1200px;
    margin: 0 auto;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .footer-content p {
    margin: 0;
    color: #6b7280;
    font-size: 0.875rem;
  }

  .footer-content a {
    color: #6b7280;
    text-decoration: none;
    font-size: 0.875rem;
  }

  .footer-content a:hover {
    color: #f97316;
  }

  @media (max-width: 480px) {
    .footer-content {
      flex-direction: column;
      gap: 0.5rem;
      text-align: center;
    }
  }
</style>