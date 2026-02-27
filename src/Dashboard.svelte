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
  let voicePopularity = [];
  let loading = true;
  let error = null;
  let chartDays = 7;
  let activeTab = 'overview';

  // Check authentication
  function getAuthToken() {
    // Check URL params first (from login redirect)
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
      window.location.href = '/';
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
          window.location.href = '/';
          return;
        }
        throw new Error('Failed to fetch account');
      }

      const data = await response.json();
      user = data.account;
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
        stats = data.stats;
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

  // Fetch voice popularity
  async function fetchVoicePopularity() {
    const token = getAuthToken();
    if (!token) return;

    try {
      const response = await fetch(`${API_BASE}/api/v1/analytics/voices`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        voicePopularity = data.data || [];
      }
    } catch (e) {
      console.error('Failed to fetch voice popularity:', e);
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
    localStorage.removeItem('auth_token');
    window.location.href = '/';
  }

  // Format number
  function formatNumber(num) {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num?.toString() || '0';
  }

  // Initialize
  onMount(async () => {
    await fetchAccount();
    if (user) {
      await Promise.all([
        fetchStats(),
        fetchUsageData(),
        fetchVoicePopularity()
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
      <p>Loading dashboard...</p>
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
      <p>You need to be logged in to view the dashboard.</p>
      <a href="/">Go to Home</a>
    </div>
  {:else}
    <header>
      <div class="header-content">
        <a href="/" class="logo">
          <strong>Agent Talk</strong>
          <span class="badge">{user.tier}</span>
        </a>
        <nav>
          <button 
            class:active={activeTab === 'overview'} 
            on:click={() => activeTab = 'overview'}>
            Overview
          </button>
          <button 
            class:active={activeTab === 'usage'} 
            on:click={() => activeTab = 'usage'}>
            Usage
          </button>
          <button 
            class:active={activeTab === 'voices'} 
            on:click={() => activeTab = 'voices'}>
            Voices
          </button>
        </nav>
        <div class="user-menu">
          <span>{user.email}</span>
          <button class="btn-logout" on:click={logout}>Logout</button>
        </div>
      </div>
    </header>

    <div class="dashboard">
      {#if activeTab === 'overview'}
        <section class="overview-section">
          <h1>Welcome back!</h1>
          <p class="subtitle">Your Agent Talk usage at a glance</p>

          <div class="stats-grid">
            <div class="stat-card">
              <div class="stat-icon">📞</div>
              <div class="stat-content">
                <span class="stat-value">{formatNumber(stats?.usage?.today || 0)}</span>
                <span class="stat-label">Calls Today</span>
              </div>
            </div>

            <div class="stat-card">
              <div class="stat-icon">📊</div>
              <div class="stat-content">
                <span class="stat-value">{formatNumber(stats?.usage?.thisMonth || 0)}</span>
                <span class="stat-label">This Month</span>
              </div>
            </div>

            <div class="stat-card">
              <div class="stat-icon">🔤</div>
              <div class="stat-content">
                <span class="stat-value">{formatNumber(stats?.memos?.totalCharacters || 0)}</span>
                <span class="stat-label">Characters</span>
              </div>
            </div>

            <div class="stat-card">
              <div class="stat-icon">🔑</div>
              <div class="stat-content">
                <span class="stat-value">{stats?.apiKeys?.active || 0}/{stats?.apiKeys?.maxAllowed || 5}</span>
                <span class="stat-label">API Keys</span>
              </div>
            </div>
          </div>

          <div class="chart-section">
            <div class="chart-header">
              <h2>Usage Over Time</h2>
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
              <UsageChart {data} days={chartDays} />
            {:else}
              <div class="empty-chart">
                <p>No usage data yet</p>
                <p class="hint">Make your first API call to see usage here</p>
              </div>
            {/if}
          </div>

          <div class="actions-row">
            <div class="tier-info">
              <span>Current plan: <strong>{stats?.tier?.displayName || 'Hobby'}</strong></span>
              {#if user.tier === 'hobby'}
                <a href="/billing" class="btn-upgrade">Upgrade Plan</a>
              {/if}
            </div>
            <button class="btn-export" on:click={exportUsageData}>
              📥 Export CSV
            </button>
          </div>
        </section>

      {:else if activeTab === 'usage'}
        <section class="usage-section">
          <h2>Usage History</h2>
          
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

          <UsageChart {data} days={chartDays} />

          <div class="usage-stats">
            <div class="stat-item">
              <span class="label">Rate Limit</span>
              <span class="value">{stats?.rateLimit?.remaining || 'unlimited'}/{stats?.rateLimit?.limit || 'unlimited'}</span>
            </div>
            <div class="stat-item">
              <span class="label">Total Calls</span>
              <span class="value">{formatNumber(stats?.usage?.total || 0)}</span>
            </div>
            <div class="stat-item">
              <span class="label">Total Memos</span>
              <span class="value">{formatNumber(stats?.memos?.total || 0)}</span>
            </div>
            <div class="stat-item">
              <span class="label">Total Characters</span>
              <span class="value">{formatNumber(stats?.memos?.totalCharacters || 0)}</span>
            </div>
          </div>

          <button class="btn-export" on:click={exportUsageData}>
            📥 Export Usage Data (CSV)
          </button>
        </section>

      {:else if activeTab === 'voices'}
        <section class="voices-section">
          <h2>Voice Usage</h2>
          <p class="subtitle">Your most-used voices</p>

          {#if voicePopularity.length > 0}
            <div class="voices-list">
              {#each voicePopularity as voice, i}
                <div class="voice-item">
                  <div class="voice-rank">{i + 1}</div>
                  <div class="voice-info">
                    <span class="voice-name">{voice.voiceName}</span>
                    <span class="voice-id">{voice.voiceId}</span>
                  </div>
                  <div class="voice-stats">
                    <span class="voice-count">{formatNumber(voice.callCount)} calls</span>
                    <div class="voice-bar">
                      <div class="voice-bar-fill" style="width: {voice.percentage}%"></div>
                    </div>
                    <span class="voice-percentage">{voice.percentage}%</span>
                  </div>
                </div>
              {/each}
            </div>
          {:else}
            <div class="empty-state">
              <p>No voice usage data yet</p>
              <p class="hint">Make API calls to see which voices you use most</p>
            </div>
          {/if}
        </section>
      {/if}
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

  .loading {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 100vh;
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

  .error, .not-authenticated {
    text-align: center;
    padding: 3rem;
  }

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
    gap: 0.5rem;
    text-decoration: none;
    color: inherit;
  }

  .logo strong {
    font-size: 1.25rem;
  }

  .badge {
    background: #3b82f6;
    color: white;
    font-size: 0.75rem;
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
    text-transform: uppercase;
  }

  nav {
    display: flex;
    gap: 0.5rem;
  }

  nav button {
    background: transparent;
    border: none;
    padding: 0.5rem 1rem;
    font-size: 0.95rem;
    cursor: pointer;
    border-radius: 6px;
    color: #6b7280;
    transition: all 0.2s;
  }

  nav button:hover {
    background: #f3f4f6;
    color: #1f2937;
  }

  nav button.active {
    background: #3b82f6;
    color: white;
  }

  .user-menu {
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  .user-menu span {
    color: #6b7280;
    font-size: 0.9rem;
  }

  .btn-logout {
    background: transparent;
    border: 1px solid #e5e7eb;
    padding: 0.5rem 1rem;
    font-size: 0.9rem;
    cursor: pointer;
    border-radius: 6px;
    transition: all 0.2s;
  }

  .btn-logout:hover {
    background: #fee2e2;
    border-color: #ef4444;
    color: #ef4444;
  }

  .dashboard {
    max-width: 1200px;
    margin: 0 auto;
    padding: 2rem;
  }

  .stats-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 1.5rem;
    margin-bottom: 2rem;
  }

  .stat-card {
    background: white;
    border-radius: 12px;
    padding: 1.5rem;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  .stat-icon {
    font-size: 2rem;
  }

  .stat-content {
    display: flex;
    flex-direction: column;
  }

  .stat-value {
    font-size: 1.75rem;
    font-weight: 700;
    color: #1a1a2e;
  }

  .stat-label {
    font-size: 0.85rem;
    color: #6b7280;
  }

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

  .chart-header h2 {
    margin: 0;
    font-size: 1.25rem;
  }

  .period-selector {
    display: flex;
    gap: 0.5rem;
  }

  .period-selector button {
    background: transparent;
    border: 1px solid #e5e7eb;
    padding: 0.5rem 1rem;
    font-size: 0.85rem;
    cursor: pointer;
    border-radius: 6px;
    transition: all 0.2s;
  }

  .period-selector button:hover {
    background: #f3f4f6;
  }

  .period-selector button.active {
    background: #3b82f6;
    color: white;
    border-color: #3b82f6;
  }

  .empty-chart, .empty-state {
    text-align: center;
    padding: 3rem 1rem;
    color: #6b7280;
  }

  .hint {
    font-size: 0.875rem;
    color: #9ca3af;
  }

  .actions-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .tier-info {
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  .btn-upgrade {
    background: #3b82f6;
    color: white;
    padding: 0.5rem 1rem;
    border-radius: 6px;
    text-decoration: none;
    font-size: 0.9rem;
    transition: background 0.2s;
  }

  .btn-upgrade:hover {
    background: #2563eb;
  }

  .btn-export {
    background: white;
    border: 1px solid #e5e7eb;
    padding: 0.75rem 1.25rem;
    font-size: 0.9rem;
    cursor: pointer;
    border-radius: 8px;
    transition: all 0.2s;
  }

  .btn-export:hover {
    background: #f3f4f6;
    border-color: #3b82f6;
  }

  /* Usage tab */
  .usage-stats {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 1rem;
    margin: 2rem 0;
    background: white;
    border-radius: 12px;
    padding: 1.5rem;
  }

  .stat-item {
    display: flex;
    flex-direction: column;
  }

  .stat-item .label {
    font-size: 0.85rem;
    color: #6b7280;
  }

  .stat-item .value {
    font-size: 1.5rem;
    font-weight: 700;
    color: #1a1a2e;
  }

  /* Voices tab */
  .voices-list {
    background: white;
    border-radius: 12px;
    overflow: hidden;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  }

  .voice-item {
    display: flex;
    align-items: center;
    padding: 1rem 1.5rem;
    border-bottom: 1px solid #f3f4f6;
  }

  .voice-item:last-child {
    border-bottom: none;
  }

  .voice-rank {
    width: 2rem;
    height: 2rem;
    background: #f3f4f6;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 600;
    color: #6b7280;
    margin-right: 1rem;
  }

  .voice-info {
    flex: 1;
  }

  .voice-name {
    font-weight: 600;
    display: block;
  }

  .voice-id {
    font-size: 0.85rem;
    color: #9ca3af;
  }

  .voice-stats {
    display: flex;
    align-items: center;
    gap: 1rem;
    width: 200px;
  }

  .voice-count {
    font-weight: 500;
    color: #6b7280;
    min-width: 80px;
    text-align: right;
  }

  .voice-bar {
    flex: 1;
    height: 8px;
    background: #e5e7eb;
    border-radius: 4px;
    overflow: hidden;
  }

  .voice-bar-fill {
    height: 100%;
    background: #3b82f6;
    border-radius: 4px;
    transition: width 0.3s;
  }

  .voice-percentage {
    font-size: 0.85rem;
    color: #9ca3af;
    min-width: 45px;
    text-align: right;
  }

  /* Footer */
  footer {
    border-top: 1px solid #e5e7eb;
    padding: 2rem;
    margin-top: 3rem;
  }

  .footer-content {
    max-width: 1200px;
    margin: 0 auto;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .footer-content p {
    color: #6b7280;
    margin: 0;
  }

  .footer-content a {
    color: #3b82f6;
    text-decoration: none;
  }

  .footer-content a:hover {
    text-decoration: underline;
  }

  @media (max-width: 768px) {
    .header-content {
      padding: 1rem;
      flex-wrap: wrap;
    }

    .stats-grid {
      grid-template-columns: repeat(2, 1fr);
    }

    .usage-stats {
      grid-template-columns: repeat(2, 1fr);
    }

    .chart-header {
      flex-direction: column;
      align-items: flex-start;
      gap: 1rem;
    }

    .actions-row {
      flex-direction: column;
      gap: 1rem;
    }

    .voice-item {
      flex-wrap: wrap;
    }

    .voice-stats {
      width: 100%;
      margin-top: 0.5rem;
    }
  }
</style>