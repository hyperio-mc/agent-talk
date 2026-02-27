<script>
  import UsageChart from './lib/UsageChart.svelte';
  import { onMount, onDestroy } from 'svelte';

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
  
  // API Keys state
  let apiKeys = [];
  let keysLoading = false;
  let showCreateKeyModal = false;
  let newKeyName = '';
  let newKeyTest = false;
  let creatingKey = false;
  let createdKey = null;
  let keyError = null;
  
  // Account settings state
  let accountLoading = false;
  let showPasswordModal = false;
  let currentPassword = '';
  let newPassword = '';
  let confirmNewPassword = '';
  let passwordError = null;
  let passwordSuccess = null;
  let changingPassword = false;

  // Mobile menu state
  let mobileMenuOpen = false;

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
      // Store tierInfo for usage display
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
        // Preserve tierInfo from account call if it exists
        const existingTierInfo = stats?.tierInfo;
        stats = data.stats;
        if (!stats.tierInfo && existingTierInfo) {
          stats.tierInfo = existingTierInfo;
        }
        // Add tier info from stats response
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

  // Fetch API keys
  async function fetchApiKeys() {
    const token = getAuthToken();
    if (!token) return;

    keysLoading = true;
    try {
      const response = await fetch(`${API_BASE}/api/v1/dashboard/keys`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        apiKeys = data.keys || [];
      }
    } catch (e) {
      console.error('Failed to fetch API keys:', e);
    }
    keysLoading = false;
  }

  // Create new API key
  async function createApiKey() {
    const token = getAuthToken();
    if (!token) return;

    creatingKey = true;
    keyError = null;

    try {
      const response = await fetch(`${API_BASE}/api/v1/dashboard/keys`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: newKeyName || 'API Key',
          test: newKeyTest
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || data.error || 'Failed to create key');
      }

      // Show the created key
      createdKey = data.key;
      
      // Refresh keys list
      await fetchApiKeys();
      
      // Reset form
      newKeyName = '';
      newKeyTest = false;

    } catch (e) {
      keyError = e.message;
    }

    creatingKey = false;
  }

  // Revoke API key
  async function revokeKey(keyId) {
    if (!confirm('Are you sure you want to revoke this key? This action cannot be undone.')) {
      return;
    }

    const token = getAuthToken();
    if (!token) return;

    try {
      const response = await fetch(`${API_BASE}/api/v1/dashboard/keys/${keyId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        await fetchApiKeys();
      }
    } catch (e) {
      console.error('Failed to revoke key:', e);
    }
  }

  // Copy to clipboard
  function copyToClipboard(text) {
    navigator.clipboard.writeText(text);
  }

  // Change password
  async function changePassword() {
    if (newPassword !== confirmNewPassword) {
      passwordError = 'Passwords do not match';
      return;
    }

    if (newPassword.length < 8) {
      passwordError = 'Password must be at least 8 characters';
      return;
    }

    const token = getAuthToken();
    if (!token) return;

    changingPassword = true;
    passwordError = null;
    passwordSuccess = null;

    try {
      const response = await fetch(`${API_BASE}/api/v1/auth/change-password`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          currentPassword,
          newPassword
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || data.error || 'Failed to change password');
      }

      passwordSuccess = 'Password changed successfully';
      currentPassword = '';
      newPassword = '';
      confirmNewPassword = '';

      // Close modal after 2 seconds
      setTimeout(() => {
        showPasswordModal = false;
        passwordSuccess = null;
      }, 2000);

    } catch (e) {
      passwordError = e.message;
    }

    changingPassword = false;
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
    // Call logout endpoint to clear server-side session
    const token = getAuthToken();
    if (token) {
      fetch(`${API_BASE}/api/v1/auth/logout`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }).catch(() => {});
    }
    
    // Clear local storage and redirect
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

  // Navigate to tab
  function navigateTo(tab) {
    activeTab = tab;
    mobileMenuOpen = false;
    
    // Fetch data on tab change
    if (tab === 'keys' && apiKeys.length === 0) {
      fetchApiKeys();
    }
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
      <a href="/login.html" class="btn-primary">Go to Login</a>
    </div>
  {:else}
    <header>
      <div class="header-content">
        <a href="/" class="logo">
          <strong>Agent Talk</strong>
          <span class="badge">{user.tier}</span>
        </a>
        
        <!-- Mobile menu button -->
        <button class="mobile-menu-btn" on:click={() => mobileMenuOpen = !mobileMenuOpen} aria-label="Toggle menu" aria-expanded={mobileMenuOpen}>
          <span class="hamburger"></span>
        </button>
        
        <!-- Desktop nav -->
        <nav class="desktop-nav">
          <button 
            class:active={activeTab === 'overview'} 
            on:click={() => navigateTo('overview')}>
            Overview
          </button>
          <button 
            class:active={activeTab === 'keys'} 
            on:click={() => navigateTo('keys')}>
            API Keys
          </button>
          <button 
            class:active={activeTab === 'usage'} 
            on:click={() => navigateTo('usage')}>
            Usage
          </button>
          <button 
            class:active={activeTab === 'voices'} 
            on:click={() => navigateTo('voices')}>
            Voices
          </button>
          <button 
            class:active={activeTab === 'settings'} 
            on:click={() => navigateTo('settings')}>
            Settings
          </button>
        </nav>
        
        <div class="user-menu">
          <span class="user-email">{user.email}</span>
          <button class="btn-logout" on:click={logout}>Logout</button>
        </div>
      </div>
      
      <!-- Mobile nav -->
      {#if mobileMenuOpen}
        <nav class="mobile-nav">
          <button 
            class:active={activeTab === 'overview'} 
            on:click={() => navigateTo('overview')}>
            Overview
          </button>
          <button 
            class:active={activeTab === 'keys'} 
            on:click={() => navigateTo('keys')}>
            API Keys
          </button>
          <button 
            class:active={activeTab === 'usage'} 
            on:click={() => navigateTo('usage')}>
            Usage
          </button>
          <button 
            class:active={activeTab === 'voices'} 
            on:click={() => navigateTo('voices')}>
            Voices
          </button>
          <button 
            class:active={activeTab === 'settings'} 
            on:click={() => navigateTo('settings')}>
            Settings
          </button>
          <button class="btn-logout-mobile" on:click={logout}>Logout ({user.email})</button>
        </nav>
      {/if}
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
              <UsageChart data={usageData} days={chartDays} />
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
            </div>
            <button class="btn-export" on:click={exportUsageData}>
              📥 Export CSV
            </button>
          </div>
        </section>

      {:else if activeTab === 'keys'}
        <section class="keys-section">
          <div class="section-header">
            <div>
              <h2>API Keys</h2>
              <p class="subtitle">Manage your API keys for authentication</p>
            </div>
            <button class="btn-primary" on:click={() => showCreateKeyModal = true}>
              + Create Key
            </button>
          </div>

          {#if keysLoading}
            <div class="loading-keys">
              <div class="spinner-small"></div>
              <p>Loading keys...</p>
            </div>
          {:else if apiKeys.length === 0}
            <div class="empty-state">
              <div class="empty-icon">🔑</div>
              <h3>No API Keys Yet</h3>
              <p>Create your first API key to start using the API</p>
              <button class="btn-primary" on:click={() => showCreateKeyModal = true}>
                Create Your First Key
              </button>
            </div>
          {:else}
            <div class="keys-list">
              {#each apiKeys as key}
                <div class="key-card" class:revoked={!key.isActive}>
                  <div class="key-info">
                    <div class="key-header">
                      <h4>{key.name || 'Unnamed Key'}</h4>
                      {#if !key.isActive}
                        <span class="key-status revoked">Revoked</span>
                      {:else}
                        <span class="key-status active">Active</span>
                      {/if}
                    </div>
                    <code class="key-value">{key.maskedKey}</code>
                    <div class="key-meta">
                      <span>Used {formatNumber(key.usageCount)} times</span>
                      <span>•</span>
                      <span>Last used {formatDate(key.lastUsedAt)}</span>
                      <span>•</span>
                      <span>Created {formatDate(key.createdAt)}</span>
                    </div>
                  </div>
                  {#if key.isActive}
                    <div class="key-actions">
                      <button class="btn-revoke" on:click={() => revokeKey(key.id)}>
                        Revoke
                      </button>
                    </div>
                  {/if}
                </div>
              {/each}
            </div>
          {/if}

          <div class="key-limits">
            <p>📋 You have used <strong>{stats?.apiKeys?.active || 0}</strong> of <strong>{stats?.apiKeys?.maxAllowed || 5}</strong> available API keys.</p>
          </div>
        </section>

      {:else if activeTab === 'usage'}
        <section class="usage-section">
          <h2>Usage Statistics</h2>
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
                <span class="summary-value">{formatNumber(stats?.usage?.thisMonth || 0)}</span>
                <span class="summary-label">This Month</span>
              </div>
            </div>
            <div class="summary-card">
              <div class="summary-icon">📈</div>
              <div class="summary-content">
                <span class="summary-value">{formatNumber(stats?.usage?.total || 0)}</span>
                <span class="summary-label">All Time</span>
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
                <p>Need more? <a href="/billing" class="upgrade-link">Upgrade your plan →</a></p>
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
              <div class="empty-icon">🎤</div>
              <h3>No Voice Usage Yet</h3>
              <p>Make API calls to see which voices you use most</p>
            </div>
          {/if}
        </section>

      {:else if activeTab === 'settings'}
        <section class="settings-section">
          <h2>Account Settings</h2>
          
          <div class="settings-card">
            <h3>Account Information</h3>
            <div class="info-grid">
              <div class="info-item">
                <span class="info-label">Email</span>
                <span>{user.email}</span>
              </div>
              <div class="info-item">
                <span class="info-label">Plan</span>
                <span class="tier-badge">{user.tier}</span>
              </div>
              <div class="info-item">
                <span class="info-label">Role</span>
                <span>{user.role}</span>
              </div>
              <div class="info-item">
                <span class="info-label">Member Since</span>
                <span>{formatDate(user.createdAt)}</span>
              </div>
            </div>
          </div>

          <div class="settings-card">
            <h3>Security</h3>
            <div class="security-actions">
              <div class="security-item">
                <div>
                  <h4>Password</h4>
                  <p>Change your account password</p>
                </div>
                <button class="btn-secondary" on:click={() => showPasswordModal = true}>
                  Change Password
                </button>
              </div>
              <div class="security-item">
                <div>
                  <h4>API Keys</h4>
                  <p>Manage your API keys for authentication</p>
                </div>
                <button class="btn-secondary" on:click={() => navigateTo('keys')}>
                  Manage Keys
                </button>
              </div>
            </div>
          </div>

          <div class="settings-card">
            <h3>Danger Zone</h3>
            <div class="danger-actions">
              <div class="danger-item">
                <div>
                  <h4>Delete Account</h4>
                  <p>Permanently delete your account and all data</p>
                </div>
                <button class="btn-danger" disabled>
                  Delete Account
                </button>
              </div>
            </div>
          </div>
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

<!-- Create Key Modal -->
{#if showCreateKeyModal}
  <div class="modal-overlay" on:click={() => showCreateKeyModal = false} on:keydown={(e) => e.key === 'Escape' && (showCreateKeyModal = false)} role="button" tabindex="0">
    <div class="modal" on:click|stopPropagation on:keydown|stopPropagation role="dialog" aria-modal="true" tabindex="-1">
      {#if createdKey}
        <div class="modal-success">
          <div class="success-icon">🔑</div>
          <h3>API Key Created!</h3>
          <p>Copy your key now. It won't be shown again.</p>
          
          <div class="created-key-box">
            <code>{createdKey.key}</code>
            <button class="btn-copy" on:click={() => copyToClipboard(createdKey.key)}>
              Copy
            </button>
          </div>
          
          <button class="btn-primary" on:click={() => { showCreateKeyModal = false; createdKey = null; }}>
            Done
          </button>
        </div>
      {:else}
        <h3>Create API Key</h3>
        
        <div class="modal-form">
          <div class="form-group">
            <label for="key-name">Name (optional)</label>
            <input 
              type="text" 
              id="key-name" 
              bind:value={newKeyName} 
              placeholder="My API Key"
              maxlength="100"
            />
            <span class="hint">Give your key a descriptive name</span>
          </div>
          
          <div class="form-group">
            <label class="checkbox-label">
              <input type="checkbox" bind:checked={newKeyTest} />
              <span>Test key (for development)</span>
            </label>
          </div>
          
          {#if keyError}
            <div class="error-message">{keyError}</div>
          {/if}
          
          <div class="modal-actions">
            <button class="btn-secondary" on:click={() => showCreateKeyModal = false}>
              Cancel
            </button>
            <button class="btn-primary" on:click={createApiKey} disabled={creatingKey}>
              {creatingKey ? 'Creating...' : 'Create Key'}
            </button>
          </div>
        </div>
      {/if}
    </div>
  </div>
{/if}

<!-- Change Password Modal -->
{#if showPasswordModal}
  <div class="modal-overlay" on:click={() => showPasswordModal = false} on:keydown={(e) => e.key === 'Escape' && (showPasswordModal = false)} role="button" tabindex="0">
    <div class="modal" on:click|stopPropagation on:keydown|stopPropagation role="dialog" aria-modal="true" tabindex="-1">
      <h3>Change Password</h3>
      
      <div class="modal-form">
        <div class="form-group">
          <label for="current-password">Current Password</label>
          <input 
            type="password" 
            id="current-password" 
            bind:value={currentPassword} 
            placeholder="Enter current password"
          />
        </div>
        
        <div class="form-group">
          <label for="new-password">New Password</label>
          <input 
            type="password" 
            id="new-password" 
            bind:value={newPassword} 
            placeholder="Enter new password"
          />
        </div>
        
        <div class="form-group">
          <label for="confirm-password">Confirm New Password</label>
          <input 
            type="password" 
            id="confirm-password" 
            bind:value={confirmNewPassword} 
            placeholder="Confirm new password"
          />
        </div>
        
        {#if passwordError}
          <div class="error-message">{passwordError}</div>
        {/if}
        
        {#if passwordSuccess}
          <div class="success-message">{passwordSuccess}</div>
        {/if}
        
        <div class="modal-actions">
          <button class="btn-secondary" on:click={() => showPasswordModal = false}>
            Cancel
          </button>
          <button class="btn-primary" on:click={changePassword} disabled={changingPassword}>
            {changingPassword ? 'Changing...' : 'Change Password'}
          </button>
        </div>
      </div>
    </div>
  </div>
{/if}

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
  }

  .spinner, .spinner-small {
    width: 40px;
    height: 40px;
    border: 3px solid #e5e7eb;
    border-top-color: #3b82f6;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  .spinner-small {
    width: 24px;
    height: 24px;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .error, .not-authenticated {
    text-align: center;
    padding: 3rem;
  }

  .error button, .not-authenticated .btn-primary {
    background: #3b82f6;
    color: white;
    border: none;
    padding: 0.75rem 1.5rem;
    border-radius: 8px;
    font-size: 1rem;
    cursor: pointer;
    text-decoration: none;
    display: inline-block;
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
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    font-size: 0.7rem;
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
    text-transform: uppercase;
    font-weight: 600;
  }

  .desktop-nav {
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
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
  }

  .mobile-menu-btn {
    display: none;
    background: transparent;
    border: none;
    padding: 0.5rem;
    cursor: pointer;
  }

  .hamburger {
    display: block;
    width: 24px;
    height: 2px;
    background: #374151;
    position: relative;
  }

  .hamburger::before,
  .hamburger::after {
    content: '';
    width: 24px;
    height: 2px;
    background: #374151;
    position: absolute;
    left: 0;
  }

  .hamburger::before { top: -8px; }
  .hamburger::after { top: 8px; }

  .user-menu {
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  .user-email {
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

  .btn-logout-mobile {
    background: transparent;
    border: 1px solid #ef4444;
    color: #ef4444;
    padding: 0.75rem 1rem;
    font-size: 0.9rem;
    cursor: pointer;
    border-radius: 6px;
    width: 100%;
    margin-top: 1rem;
  }

  .mobile-nav {
    display: none;
    flex-direction: column;
    padding: 1rem;
    border-top: 1px solid #e5e7eb;
    background: white;
  }

  .mobile-nav button {
    text-align: left;
    padding: 0.75rem 1rem;
  }

  .dashboard {
    max-width: 1200px;
    margin: 0 auto;
    padding: 2rem;
  }

  h1 {
    font-size: 2rem;
    margin: 0 0 0.5rem;
  }

  h2 {
    font-size: 1.5rem;
    margin: 0 0 0.5rem;
  }

  .subtitle {
    color: #6b7280;
    margin: 0 0 2rem;
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
    transition: transform 0.2s, box-shadow 0.2s;
  }

  .stat-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
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
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    border-color: transparent;
  }

  .empty-chart, .empty-state {
    text-align: center;
    padding: 3rem 1rem;
    color: #6b7280;
  }

  .empty-icon {
    font-size: 4rem;
    margin-bottom: 1rem;
  }

  .empty-state h3 {
    margin: 0 0 0.5rem;
    color: #374151;
  }

  .empty-state .btn-primary {
    margin-top: 1.5rem;
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

  .btn-primary {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    border: none;
    padding: 0.75rem 1.5rem;
    font-size: 1rem;
    font-weight: 600;
    border-radius: 8px;
    cursor: pointer;
    transition: transform 0.2s, box-shadow 0.2s;
  }

  .btn-primary:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
  }

  .btn-primary:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .btn-secondary {
    background: white;
    color: #374151;
    border: 1px solid #e5e7eb;
    padding: 0.75rem 1.5rem;
    font-size: 1rem;
    font-weight: 500;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s;
  }

  .btn-secondary:hover {
    background: #f9fafb;
    border-color: #d1d5db;
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
    border-color: #667eea;
  }

  /* Keys Section */
  .keys-section {
    background: white;
    border-radius: 16px;
    padding: 2rem;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  }

  .section-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 2rem;
  }

  .section-header h2 {
    margin: 0;
  }

  .keys-list {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .key-card {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1.25rem;
    background: #f9fafb;
    border-radius: 12px;
    border: 1px solid #e5e7eb;
    transition: all 0.2s;
  }

  .key-card:hover {
    border-color: #d1d5db;
    background: white;
  }

  .key-card.revoked {
    opacity: 0.6;
    background: #fef2f2;
    border-color: #fecaca;
  }

  .key-header {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    margin-bottom: 0.5rem;
  }

  .key-header h4 {
    margin: 0;
    font-size: 1rem;
  }

  .key-status {
    font-size: 0.7rem;
    padding: 0.2rem 0.5rem;
    border-radius: 4px;
    text-transform: uppercase;
    font-weight: 600;
  }

  .key-status.active {
    background: #d1fae5;
    color: #065f46;
  }

  .key-status.revoked {
    background: #fee2e2;
    color: #991b1b;
  }

  .key-value {
    font-family: 'SF Mono', Monaco, 'Cascadia Code', monospace;
    font-size: 0.85rem;
    color: #6b7280;
    background: white;
    padding: 0.5rem 0.75rem;
    border-radius: 6px;
    display: inline-block;
    margin-bottom: 0.5rem;
  }

  .key-meta {
    font-size: 0.8rem;
    color: #9ca3af;
  }

  .key-meta span {
    margin-right: 0.25rem;
  }

  .btn-revoke {
    background: transparent;
    border: 1px solid #fecaca;
    color: #ef4444;
    padding: 0.5rem 1rem;
    font-size: 0.9rem;
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.2s;
  }

  .btn-revoke:hover {
    background: #fef2f2;
  }

  .key-limits {
    margin-top: 2rem;
    padding-top: 1.5rem;
    border-top: 1px solid #e5e7eb;
    color: #6b7280;
    font-size: 0.9rem;
  }

  /* Usage tab */
  .usage-section {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  .usage-section .subtitle {
    margin-top: -0.5rem;
  }

  /* Rate Limit Card */
  .rate-limit-card {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    border-radius: 16px;
    padding: 1.5rem;
    color: white;
    box-shadow: 0 4px 15px rgba(102, 126, 234, 0.3);
  }

  .rate-limit-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1rem;
  }

  .rate-limit-header h3 {
    margin: 0;
    font-size: 1.1rem;
    font-weight: 600;
  }

  .rate-limit-header .tier-badge {
    background: rgba(255, 255, 255, 0.2);
    padding: 0.35rem 0.75rem;
    border-radius: 20px;
    font-size: 0.8rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .rate-limit-display {
    text-align: center;
  }

  .rate-limit-value {
    display: flex;
    align-items: baseline;
    justify-content: center;
    gap: 0.25rem;
    margin-bottom: 1rem;
  }

  .rate-limit-value .used {
    font-size: 3rem;
    font-weight: 700;
    line-height: 1;
  }

  .rate-limit-value .separator {
    font-size: 2rem;
    opacity: 0.7;
  }

  .rate-limit-value .limit {
    font-size: 2rem;
    font-weight: 600;
    opacity: 0.9;
  }

  .rate-limit-value .unit {
    font-size: 1rem;
    opacity: 0.8;
    margin-left: 0.25rem;
  }

  .rate-limit-bar {
    height: 8px;
    background: rgba(255, 255, 255, 0.2);
    border-radius: 4px;
    overflow: hidden;
    margin-bottom: 0.75rem;
  }

  .rate-limit-fill {
    height: 100%;
    background: white;
    border-radius: 4px;
    transition: width 0.3s ease;
  }

  .rate-limit-fill.warning {
    background: #fbbf24;
  }

  .rate-limit-fill.danger {
    background: #ef4444;
  }

  .rate-limit-note {
    margin: 0;
    font-size: 0.9rem;
    opacity: 0.9;
  }

  /* Usage Summary Grid */
  .usage-summary-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 1rem;
  }

  .summary-card {
    background: white;
    border-radius: 12px;
    padding: 1.25rem;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    display: flex;
    align-items: center;
    gap: 1rem;
    transition: transform 0.2s, box-shadow 0.2s;
  }

  .summary-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  }

  .summary-icon {
    font-size: 1.75rem;
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
    font-size: 0.8rem;
    color: #6b7280;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  /* Tier Limits Card */
  .tier-limits-card {
    background: white;
    border-radius: 12px;
    padding: 1.5rem;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  }

  .tier-limits-card h3 {
    margin: 0 0 1rem;
    font-size: 1.1rem;
    color: #374151;
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
    padding: 1rem;
    background: #f9fafb;
    border-radius: 8px;
  }

  .limit-label {
    font-size: 0.75rem;
    color: #6b7280;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .limit-value {
    font-size: 1.1rem;
    font-weight: 600;
    color: #1a1a2e;
  }

  .upgrade-prompt {
    margin-top: 1rem;
    padding-top: 1rem;
    border-top: 1px solid #e5e7eb;
    text-align: center;
  }

  .upgrade-prompt p {
    margin: 0;
    color: #6b7280;
  }

  .upgrade-link {
    color: #667eea;
    text-decoration: none;
    font-weight: 500;
  }

  .upgrade-link:hover {
    text-decoration: underline;
  }

  /* Export Section */
  .export-section {
    text-align: center;
    padding-top: 1rem;
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
    flex-shrink: 0;
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
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    border-radius: 4px;
    transition: width 0.3s;
  }

  .voice-percentage {
    font-size: 0.85rem;
    color: #9ca3af;
    min-width: 45px;
    text-align: right;
  }

  /* Settings Section */
  .settings-section {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  .settings-card {
    background: white;
    border-radius: 12px;
    padding: 1.5rem;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  }

  .settings-card h3 {
    margin: 0 0 1rem;
    font-size: 1.1rem;
    color: #374151;
    padding-bottom: 1rem;
    border-bottom: 1px solid #f3f4f6;
  }

  .info-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 1.5rem;
  }

  .info-item {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .info-item .info-label {
    font-size: 0.8rem;
    color: #6b7280;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    display: block;
  }

  .info-item span {
    font-size: 1rem;
    color: #1a1a2e;
  }

  .tier-badge {
    display: inline-block;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    padding: 0.25rem 0.75rem;
    border-radius: 4px;
    font-size: 0.85rem;
    font-weight: 600;
    text-transform: capitalize;
  }

  .security-actions, .danger-actions {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .security-item, .danger-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1rem;
    background: #f9fafb;
    border-radius: 8px;
  }

  .security-item h4, .danger-item h4 {
    margin: 0;
    font-size: 1rem;
  }

  .security-item p, .danger-item p {
    margin: 0.25rem 0 0;
    font-size: 0.85rem;
    color: #6b7280;
  }

  .danger-item {
    background: #fef2f2;
  }

  .btn-danger {
    background: #ef4444;
    color: white;
    border: none;
    padding: 0.75rem 1.5rem;
    font-size: 0.9rem;
    font-weight: 500;
    border-radius: 8px;
    cursor: pointer;
    transition: background 0.2s;
  }

  .btn-danger:hover:not(:disabled) {
    background: #dc2626;
  }

  .btn-danger:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  /* Modal */
  .modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    padding: 1rem;
  }

  .modal {
    background: white;
    border-radius: 16px;
    padding: 2rem;
    max-width: 480px;
    width: 100%;
    max-height: 90vh;
    overflow-y: auto;
  }

  .modal h3 {
    margin: 0 0 1.5rem;
    font-size: 1.25rem;
  }

  .modal-form {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .form-group {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .form-group label {
    font-size: 0.9rem;
    font-weight: 500;
    color: #374151;
  }

  .form-group input {
    padding: 0.75rem 1rem;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    font-size: 1rem;
    transition: all 0.2s;
  }

  .form-group input:focus {
    outline: none;
    border-color: #667eea;
    box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
  }

  .form-group .hint {
    font-size: 0.8rem;
    color: #9ca3af;
  }

  .checkbox-label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    cursor: pointer;
  }

  .checkbox-label input {
    width: auto;
  }

  .error-message {
    background: #fef2f2;
    color: #991b1b;
    padding: 0.75rem 1rem;
    border-radius: 8px;
    font-size: 0.9rem;
    border: 1px solid #fecaca;
  }

  .success-message {
    background: #d1fae5;
    color: #065f46;
    padding: 0.75rem 1rem;
    border-radius: 8px;
    font-size: 0.9rem;
    border: 1px solid #6ee7b7;
  }

  .modal-actions {
    display: flex;
    justify-content: flex-end;
    gap: 1rem;
    margin-top: 1rem;
  }

  .modal-success {
    text-align: center;
  }

  .modal-success .success-icon {
    font-size: 3rem;
    margin-bottom: 1rem;
  }

  .created-key-box {
    background: #f9fafb;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    padding: 1rem;
    margin: 1rem 0;
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  .created-key-box code {
    flex: 1;
    word-break: break-all;
    font-family: 'SF Mono', Monaco, 'Cascadia Code', monospace;
    font-size: 0.85rem;
  }

  .btn-copy {
    background: #667eea;
    color: white;
    border: none;
    padding: 0.5rem 1rem;
    font-size: 0.85rem;
    border-radius: 6px;
    cursor: pointer;
    white-space: nowrap;
  }

  .btn-copy:hover {
    background: #5a67d8;
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
    color: #667eea;
    text-decoration: none;
  }

  .footer-content a:hover {
    text-decoration: underline;
  }

  /* Responsive */
  @media (max-width: 1024px) {
    .stats-grid {
      grid-template-columns: repeat(2, 1fr);
    }

    .usage-summary-grid {
      grid-template-columns: repeat(2, 1fr);
    }

    .limits-grid {
      grid-template-columns: repeat(2, 1fr);
    }
  }

  @media (max-width: 768px) {
    .header-content {
      padding: 1rem;
    }

    .desktop-nav {
      display: none;
    }

    .mobile-menu-btn {
      display: block;
    }

    .mobile-nav {
      display: flex;
    }

    .user-menu {
      display: none;
    }

    .stats-grid {
      grid-template-columns: 1fr 1fr;
      gap: 1rem;
    }

    .stat-card {
      padding: 1rem;
    }

    .stat-value {
      font-size: 1.5rem;
    }

    .stat-icon {
      font-size: 1.5rem;
    }

    .chart-header {
      flex-direction: column;
      align-items: flex-start;
      gap: 1rem;
    }

    .actions-row {
      flex-direction: column;
      gap: 1rem;
      align-items: stretch;
    }

    .section-header {
      flex-direction: column;
      gap: 1rem;
    }

    .key-card {
      flex-direction: column;
      align-items: flex-start;
      gap: 1rem;
    }

    .key-actions {
      width: 100%;
    }

    .btn-revoke {
      width: 100%;
    }

    .voice-item {
      flex-wrap: wrap;
    }

    .voice-stats {
      width: 100%;
      margin-top: 0.5rem;
    }

    .info-grid {
      grid-template-columns: 1fr;
    }

    .security-item, .danger-item {
      flex-direction: column;
      align-items: flex-start;
      gap: 1rem;
    }

    .security-item button, .danger-item button {
      width: 100%;
    }

    .footer-content {
      flex-direction: column;
      gap: 0.5rem;
      text-align: center;
    }

    /* Usage section responsive */
    .rate-limit-value .used {
      font-size: 2.5rem;
    }

    .rate-limit-value .limit {
      font-size: 1.5rem;
    }

    .usage-summary-grid {
      grid-template-columns: repeat(2, 1fr);
    }

    .limits-grid {
      grid-template-columns: repeat(2, 1fr);
    }
  }

  @media (max-width: 480px) {
    .dashboard {
      padding: 1rem;
    }

    h1 {
      font-size: 1.5rem;
    }

    .period-selector {
      flex-wrap: wrap;
    }

    .period-selector button {
      flex: 1;
      min-width: 80px;
    }

    .modal {
      padding: 1.5rem;
    }

    .created-key-box {
      flex-direction: column;
      align-items: stretch;
    }

    .btn-copy {
      width: 100%;
    }

    /* Usage section mobile */
    .rate-limit-card {
      padding: 1.25rem;
    }

    .rate-limit-value .used {
      font-size: 2rem;
    }

    .rate-limit-value .limit {
      font-size: 1.25rem;
    }

    .usage-summary-grid {
      grid-template-columns: 1fr 1fr;
    }

    .summary-value {
      font-size: 1.25rem;
    }

    .limits-grid {
      grid-template-columns: 1fr 1fr;
    }

    .limit-item {
      padding: 0.75rem;
    }

    .limit-value {
      font-size: 1rem;
    }
  }
</style>