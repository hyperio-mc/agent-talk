<script>
  import { onMount } from 'svelte';

  // API base URL
  const API_BASE = typeof window !== 'undefined' && window.location.hostname === 'localhost' 
    ? 'http://localhost:3001' 
    : 'https://talk.onhyper.io';

  // State
  let apiKeys = [];
  let loading = true;
  let error = null;
  let user = null;
  
  // Create key modal state
  let showCreateModal = false;
  let newKeyName = '';
  let newKeyTest = false;
  let creatingKey = false;
  let createdKey = null;
  let keyError = null;
  
  // Delete confirmation state
  let showDeleteConfirm = null;
  let deletingKeyId = null;
  let deleting = false;
  
  // Stats
  let stats = { total: 0, active: 0, maxAllowed: 10 };

  // Get auth token
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

  // Fetch user info
  async function fetchUser() {
    const token = getAuthToken();
    if (!token) {
      window.location.href = '/login.html';
      return false;
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
          return false;
        }
        throw new Error('Failed to fetch account');
      }

      const data = await response.json();
      user = data.account;
      return true;
    } catch (e) {
      error = e.message;
      return false;
    }
  }

  // Fetch API keys
  async function fetchKeys() {
    const token = getAuthToken();
    if (!token) return;

    loading = true;
    error = null;

    try {
      const response = await fetch(`${API_BASE}/api/keys`, {
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
        throw new Error('Failed to fetch API keys');
      }

      const data = await response.json();
      apiKeys = data.keys || [];
      
      // Calculate stats
      stats.total = apiKeys.length;
      stats.active = apiKeys.filter(k => k.isActive).length;
      stats.maxAllowed = 10; // Default, could be fetched from user tier

    } catch (e) {
      error = e.message;
    }

    loading = false;
  }

  // Create new API key
  async function createKey() {
    const token = getAuthToken();
    if (!token) return;

    creatingKey = true;
    keyError = null;

    try {
      const response = await fetch(`${API_BASE}/api/keys`, {
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

      // Store the created key to show in modal
      createdKey = data.key;
      
      // Refresh keys list
      await fetchKeys();
      
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
    const token = getAuthToken();
    if (!token) return;

    deleting = true;

    try {
      const response = await fetch(`${API_BASE}/api/keys/${keyId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        await fetchKeys();
        showDeleteConfirm = null;
        deletingKeyId = null;
      } else {
        const data = await response.json();
        throw new Error(data.message || 'Failed to revoke key');
      }
    } catch (e) {
      error = e.message;
    }

    deleting = false;
  }

  // Copy to clipboard
  function copyToClipboard(text) {
    navigator.clipboard.writeText(text);
  }

  // Format date
  function formatDate(dateStr) {
    if (!dateStr) return 'Never';
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  // Format number
  function formatNumber(num) {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num?.toString() || '0';
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

  // Open create modal
  function openCreateModal() {
    showCreateModal = true;
    createdKey = null;
    keyError = null;
    newKeyName = '';
    newKeyTest = false;
  }

  // Close create modal
  function closeCreateModal() {
    showCreateModal = false;
    createdKey = null;
    keyError = null;
  }

  // Initialize
  onMount(async () => {
    const authenticated = await fetchUser();
    if (authenticated) {
      await fetchKeys();
    }
    loading = false;
  });
</script>

<main>
  {#if loading}
    <div class="loading">
      <div class="spinner"></div>
      <p>Loading API keys...</p>
    </div>
  {:else if error && !apiKeys.length}
    <div class="error-page">
      <div class="error-icon">⚠️</div>
      <h2>Error Loading Keys</h2>
      <p>{error}</p>
      <button class="btn-primary" on:click={fetchKeys}>Try Again</button>
    </div>
  {:else if !user}
    <div class="not-authenticated">
      <h2>Please log in</h2>
      <p>You need to be logged in to manage API keys.</p>
      <a href="/login.html" class="btn-primary">Go to Login</a>
    </div>
  {:else}
    <header>
      <div class="header-content">
        <a href="/dashboard.html" class="logo">
          <svg width="32" height="32" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="50" cy="50" r="45" fill="#f97316"/>
            <text x="50" y="68" font-size="50" text-anchor="middle" fill="white">🎙</text>
          </svg>
          <strong>Agent Talk</strong>
        </a>
        
        <nav>
          <a href="/dashboard.html" class="nav-link">Dashboard</a>
          <a href="/keys.html" class="nav-link active">API Keys</a>
        </nav>
        
        <div class="user-menu">
          <span class="user-email">{user.email}</span>
          <button class="btn-logout" on:click={logout}>Logout</button>
        </div>
      </div>
    </header>

    <div class="page-content">
      <div class="page-header">
        <div>
          <h1>API Keys</h1>
          <p class="subtitle">Manage your API keys for authentication</p>
        </div>
        <button class="btn-primary" on:click={openCreateModal}>
          <span class="btn-icon">+</span>
          Create Key
        </button>
      </div>

      <!-- Stats -->
      <div class="stats-row">
        <div class="stat-card">
          <div class="stat-icon">🔑</div>
          <div class="stat-content">
            <span class="stat-value">{stats.active}</span>
            <span class="stat-label">Active Keys</span>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon">📊</div>
          <div class="stat-content">
            <span class="stat-value">{stats.maxAllowed - stats.active}</span>
            <span class="stat-label">Available</span>
          </div>
        </div>
        <div class="stat-card plan-card">
          <div class="stat-icon">⭐</div>
          <div class="stat-content">
            <span class="stat-value">{user.tier}</span>
            <span class="stat-label">Current Plan</span>
          </div>
        </div>
      </div>

      <!-- Keys List -->
      {#if apiKeys.length === 0}
        <div class="empty-state">
          <div class="empty-icon">🔑</div>
          <h3>No API Keys Yet</h3>
          <p>Create your first API key to start using the Agent Talk API</p>
          <button class="btn-primary" on:click={openCreateModal}>
            Create Your First Key
          </button>
        </div>
      {:else}
        <div class="keys-list">
          {#each apiKeys as key (key.id)}
            <div class="key-card" class:revoked={!key.isActive}>
              <div class="key-main">
                <div class="key-header">
                  <h3>{key.name || 'Unnamed Key'}</h3>
                  {#if !key.isActive}
                    <span class="badge revoked">Revoked</span>
                  {:else if key.name?.toLowerCase().includes('test')}
                    <span class="badge test">Test</span>
                  {:else}
                    <span class="badge active">Active</span>
                  {/if}
                </div>
                <code class="key-value">{key.maskedKey}</code>
                <div class="key-meta">
                  <span title="Usage count">📊 {formatNumber(key.usageCount || 0)} calls</span>
                  <span>•</span>
                  <span title="Last used">Last used: {formatDate(key.lastUsedAt)}</span>
                  <span>•</span>
                  <span title="Created">Created: {formatDate(key.createdAt)}</span>
                </div>
              </div>
              {#if key.isActive}
                <div class="key-actions">
                  <button 
                    class="btn-revoke" 
                    on:click={() => { showDeleteConfirm = key.id; deletingKeyId = key.id; }}
                    disabled={deleting && deletingKeyId === key.id}>
                    {#if deleting && deletingKeyId === key.id}
                      Revoking...
                    {:else}
                      Revoke
                    {/if}
                  </button>
                </div>
              {/if}
            </div>
          {/each}
        </div>
      {/if}

      <!-- Info Box -->
      <div class="info-box">
        <div class="info-icon">💡</div>
        <div class="info-content">
          <h4>Keep your keys secure</h4>
          <p>API keys are only shown once when created. Store them securely and never share them publicly. If a key is compromised, revoke it immediately and create a new one.</p>
        </div>
      </div>
    </div>

    <footer>
      <div class="footer-content">
        <p>Agent Talk — Text-to-speech API for AI agents</p>
        <a href="mailto:support@onhyper.io">Support</a>
      </div>
    </footer>

    <!-- Delete Confirmation Modal -->
    {#if showDeleteConfirm}
      <div class="modal-overlay" on:click={() => { showDeleteConfirm = null; deletingKeyId = null; }} on:keydown={(e) => e.key === 'Escape' && (showDeleteConfirm = null)} role="button" tabindex="0">
        <div class="modal" on:click|stopPropagation role="dialog" aria-modal="true" tabindex="-1">
          <div class="modal-warning">
            <div class="warning-icon">⚠️</div>
            <h3>Revoke API Key?</h3>
            <p>This action cannot be undone. Any applications using this key will lose API access immediately.</p>
            <div class="modal-actions">
              <button class="btn-secondary" on:click={() => { showDeleteConfirm = null; deletingKeyId = null; }}>
                Cancel
              </button>
              <button class="btn-danger" on:click={() => revokeKey(showDeleteConfirm)} disabled={deleting}>
                {#if deleting}
                  Revoking...
                {:else}
                  Revoke Key
                {/if}
              </button>
            </div>
          </div>
        </div>
      </div>
    {/if}

    <!-- Create Key Modal -->
    {#if showCreateModal}
      <div class="modal-overlay" on:click={closeCreateModal} on:keydown={(e) => e.key === 'Escape' && closeCreateModal()} role="button" tabindex="0">
        <div class="modal" on:click|stopPropagation on:keydown|stopPropagation role="dialog" aria-modal="true" tabindex="-1">
          {#if createdKey}
            <div class="modal-success">
              <div class="success-icon">🔑</div>
              <h3>API Key Created!</h3>
              <p class="success-message">Copy your key now. You won't be able to see it again.</p>
              
              <div class="created-key-box">
                <code>{createdKey.key}</code>
                <button class="btn-copy" on:click={() => copyToClipboard(createdKey.key)}>
                  📋 Copy
                </button>
              </div>
              
              <div class="key-details">
                <div class="key-detail">
                  <span class="detail-label">Name:</span>
                  <span>{createdKey.name}</span>
                </div>
                <div class="key-detail">
                  <span class="detail-label">Prefix:</span>
                  <code>{createdKey.prefix}</code>
                </div>
                <div class="key-detail">
                  <span class="detail-label">Created:</span>
                  <span>{formatDate(createdKey.createdAt)}</span>
                </div>
              </div>
              
              <div class="warning-box">
                <span>⚠️</span> Store this key securely. It will not be shown again.
              </div>
              
              <button class="btn-primary btn-full" on:click={closeCreateModal}>
                Done
              </button>
            </div>
          {:else}
            <h3>Create API Key</h3>
            
            <form on:submit|preventDefault={createKey}>
              <div class="form-group">
                <label for="key-name">Key Name (optional)</label>
                <input 
                  type="text" 
                  id="key-name" 
                  bind:value={newKeyName} 
                  placeholder="My API Key"
                  maxlength="100"
                  autocomplete="off"
                />
                <span class="hint">Give your key a descriptive name to identify it later</span>
              </div>
              
              <div class="form-group">
                <label class="checkbox-label">
                  <input type="checkbox" bind:checked={newKeyTest} />
                  <span class="checkbox-text">
                    <strong>Test key</strong>
                    <span class="checkbox-hint">Mark this as a development/testing key</span>
                  </span>
                </label>
              </div>
              
              {#if keyError}
                <div class="error-message">{keyError}</div>
              {/if}
              
              <div class="modal-actions">
                <button type="button" class="btn-secondary" on:click={closeCreateModal}>
                  Cancel
                </button>
                <button type="submit" class="btn-primary" disabled={creatingKey}>
                  {#if creatingKey}
                    Creating...
                  {:else}
                    Create Key
                  {/if}
                </button>
              </div>
            </form>
          {/if}
        </div>
      </div>
    {/if}
  {/if}
</main>

<style>
  :global(body) {
    margin: 0;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
    background: #f5f7fa;
    color: #1a1a2e;
    line-height: 1.5;
  }

  :global(*) {
    box-sizing: border-box;
  }

  /* Loading State */
  .loading {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 100vh;
    gap: 1rem;
    color: #6b7280;
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

  /* Error State */
  .error-page {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 100vh;
    text-align: center;
    padding: 2rem;
  }

  .error-icon {
    font-size: 4rem;
    margin-bottom: 1rem;
  }

  .error-page h2 {
    margin: 0 0 0.5rem;
  }

  .error-page p {
    color: #6b7280;
    margin-bottom: 1.5rem;
  }

  /* Not Authenticated */
  .not-authenticated {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 100vh;
    text-align: center;
    padding: 2rem;
  }

  .not-authenticated h2 {
    margin-bottom: 0.5rem;
  }

  .not-authenticated p {
    color: #6b7280;
    margin-bottom: 1.5rem;
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
    color: inherit;
  }

  .logo strong {
    font-size: 1.25rem;
  }

  nav {
    display: flex;
    gap: 0.5rem;
  }

  .nav-link {
    color: #6b7280;
    text-decoration: none;
    padding: 0.5rem 1rem;
    border-radius: 8px;
    font-size: 0.95rem;
    transition: all 0.2s;
  }

  .nav-link:hover {
    background: #f3f4f6;
    color: #1f2937;
  }

  .nav-link.active {
    background: linear-gradient(135deg, #f97316 0%, #ea580c 100%);
    color: white;
  }

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

  /* Page Content */
  .page-content {
    max-width: 1200px;
    margin: 0 auto;
    padding: 2rem;
  }

  .page-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 2rem;
  }

  .page-header h1 {
    font-size: 2rem;
    margin: 0 0 0.25rem;
  }

  .subtitle {
    color: #6b7280;
    margin: 0;
  }

  /* Buttons */
  .btn-primary {
    background: linear-gradient(135deg, #f97316 0%, #ea580c 100%);
    color: white;
    border: none;
    padding: 0.75rem 1.5rem;
    font-size: 1rem;
    font-weight: 600;
    border-radius: 8px;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    transition: transform 0.2s, box-shadow 0.2s;
    text-decoration: none;
  }

  .btn-primary:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(249, 115, 22, 0.3);
  }

  .btn-primary:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    transform: none;
  }

  .btn-icon {
    font-size: 1.25rem;
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

  .btn-danger {
    background: #ef4444;
    color: white;
    border: none;
    padding: 0.75rem 1.5rem;
    font-size: 1rem;
    font-weight: 500;
    border-radius: 8px;
    cursor: pointer;
    transition: background 0.2s;
  }

  .btn-danger:hover:not(:disabled) {
    background: #dc2626;
  }

  .btn-danger:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .btn-full {
    width: 100%;
    justify-content: center;
  }

  /* Stats Row */
  .stats-row {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 1rem;
    margin-bottom: 2rem;
  }

  .stat-card {
    background: white;
    border-radius: 12px;
    padding: 1.25rem;
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

  .stat-card.plan-card {
    background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
  }

  .stat-icon {
    font-size: 1.75rem;
  }

  .stat-content {
    display: flex;
    flex-direction: column;
  }

  .stat-value {
    font-size: 1.5rem;
    font-weight: 700;
    color: #1a1a2e;
  }

  .stat-label {
    font-size: 0.8rem;
    color: #6b7280;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  /* Empty State */
  .empty-state {
    text-align: center;
    padding: 4rem 2rem;
    background: white;
    border-radius: 16px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  }

  .empty-icon {
    font-size: 4rem;
    margin-bottom: 1rem;
  }

  .empty-state h3 {
    margin: 0 0 0.5rem;
    font-size: 1.25rem;
  }

  .empty-state p {
    color: #6b7280;
    margin-bottom: 1.5rem;
  }

  /* Keys List */
  .keys-list {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    margin-bottom: 2rem;
  }

  .key-card {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1.5rem;
    background: white;
    border-radius: 12px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    border: 1px solid #e5e7eb;
    transition: all 0.2s;
  }

  .key-card:hover {
    border-color: #d1d5db;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  }

  .key-card.revoked {
    opacity: 0.6;
    background: #fef2f2;
    border-color: #fecaca;
  }

  .key-main {
    flex: 1;
  }

  .key-header {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    margin-bottom: 0.5rem;
  }

  .key-header h3 {
    margin: 0;
    font-size: 1.1rem;
  }

  .badge {
    font-size: 0.7rem;
    padding: 0.2rem 0.6rem;
    border-radius: 20px;
    text-transform: uppercase;
    font-weight: 600;
    letter-spacing: 0.05em;
  }

  .badge.active {
    background: #d1fae5;
    color: #065f46;
  }

  .badge.revoked {
    background: #fee2e2;
    color: #991b1b;
  }

  .badge.test {
    background: #dbeafe;
    color: #1d4ed8;
  }

  .key-value {
    display: inline-block;
    font-family: 'SF Mono', Monaco, 'Cascadia Code', Consolas, monospace;
    font-size: 0.9rem;
    color: #6b7280;
    background: #f9fafb;
    padding: 0.5rem 0.75rem;
    border-radius: 6px;
    margin-bottom: 0.5rem;
  }

  .key-meta {
    font-size: 0.85rem;
    color: #9ca3af;
  }

  .key-meta span {
    margin-right: 0.25rem;
  }

  .key-actions {
    margin-left: 1.5rem;
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

  .btn-revoke:hover:not(:disabled) {
    background: #fef2f2;
  }

  .btn-revoke:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  /* Info Box */
  .info-box {
    display: flex;
    gap: 1rem;
    padding: 1.25rem;
    background: #eff6ff;
    border-radius: 12px;
    border: 1px solid #bfdbfe;
  }

  .info-icon {
    font-size: 1.5rem;
    flex-shrink: 0;
  }

  .info-content h4 {
    margin: 0 0 0.25rem;
    font-size: 0.95rem;
    color: #1e40af;
  }

  .info-content p {
    margin: 0;
    font-size: 0.9rem;
    color: #3b82f6;
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
    color: #f97316;
    text-decoration: none;
  }

  .footer-content a:hover {
    text-decoration: underline;
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

  .modal-warning {
    text-align: center;
  }

  .warning-icon {
    font-size: 3rem;
    margin-bottom: 1rem;
  }

  .modal-warning h3 {
    margin-bottom: 0.75rem;
  }

  .modal-warning p {
    color: #6b7280;
    margin-bottom: 1.5rem;
  }

  /* Form */
  .form-group {
    margin-bottom: 1.25rem;
  }

  .form-group label {
    display: block;
    font-size: 0.9rem;
    font-weight: 500;
    color: #374151;
    margin-bottom: 0.5rem;
  }

  .form-group input[type="text"] {
    width: 100%;
    padding: 0.75rem 1rem;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    font-size: 1rem;
    transition: all 0.2s;
  }

  .form-group input[type="text"]:focus {
    outline: none;
    border-color: #f97316;
    box-shadow: 0 0 0 3px rgba(249, 115, 22, 0.1);
  }

  .hint {
    display: block;
    font-size: 0.8rem;
    color: #9ca3af;
    margin-top: 0.5rem;
  }

  .checkbox-label {
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
    cursor: pointer;
  }

  .checkbox-label input {
    margin-top: 0.25rem;
  }

  .checkbox-text {
    display: flex;
    flex-direction: column;
  }

  .checkbox-text strong {
    font-size: 0.95rem;
  }

  .checkbox-hint {
    font-size: 0.8rem;
    color: #6b7280;
  }

  .error-message {
    background: #fef2f2;
    color: #991b1b;
    padding: 0.75rem 1rem;
    border-radius: 8px;
    font-size: 0.9rem;
    border: 1px solid #fecaca;
    margin-bottom: 1rem;
  }

  .modal-actions {
    display: flex;
    justify-content: flex-end;
    gap: 1rem;
    margin-top: 1.5rem;
  }

  /* Success State */
  .modal-success {
    text-align: center;
  }

  .success-icon {
    font-size: 4rem;
    margin-bottom: 1rem;
  }

  .modal-success h3 {
    color: #059669;
  }

  .success-message {
    color: #6b7280;
    margin-bottom: 1.5rem;
  }

  .created-key-box {
    background: #f0fdf4;
    border: 2px dashed #86efac;
    border-radius: 8px;
    padding: 1rem;
    margin-bottom: 1rem;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .created-key-box code {
    flex: 1;
    word-break: break-all;
    font-family: 'SF Mono', Monaco, 'Cascadia Code', Consolas, monospace;
    font-size: 0.85rem;
    color: #065f46;
  }

  .btn-copy {
    background: #059669;
    color: white;
    border: none;
    padding: 0.5rem 0.75rem;
    font-size: 0.85rem;
    border-radius: 6px;
    cursor: pointer;
    white-space: nowrap;
    transition: background 0.2s;
  }

  .btn-copy:hover {
    background: #047857;
  }

  .key-details {
    text-align: left;
    background: #f9fafb;
    border-radius: 8px;
    padding: 1rem;
    margin-bottom: 1rem;
  }

  .key-detail {
    display: flex;
    justify-content: space-between;
    padding: 0.25rem 0;
    font-size: 0.9rem;
  }

  .detail-label {
    color: #6b7280;
  }

  .key-detail code {
    font-family: 'SF Mono', Monaco, 'Cascadia Code', Consolas, monospace;
    font-size: 0.85rem;
    background: #e5e7eb;
    padding: 0.125rem 0.375rem;
    border-radius: 4px;
  }

  .warning-box {
    background: #fef3c7;
    color: #92400e;
    padding: 0.75rem 1rem;
    border-radius: 8px;
    font-size: 0.9rem;
    margin-bottom: 1.5rem;
  }

  /* Responsive */
  @media (max-width: 768px) {
    .header-content {
      flex-wrap: wrap;
      padding: 1rem;
    }

    nav {
      order: 3;
      width: 100%;
      justify-content: center;
      margin-top: 0.5rem;
    }

    .user-menu {
      flex-direction: column;
      align-items: flex-end;
      gap: 0.5rem;
    }

    .page-header {
      flex-direction: column;
      gap: 1rem;
    }

    .page-header .btn-primary {
      width: 100%;
      justify-content: center;
    }

    .stats-row {
      grid-template-columns: 1fr;
    }

    .key-card {
      flex-direction: column;
      align-items: flex-start;
    }

    .key-actions {
      margin-left: 0;
      margin-top: 1rem;
      width: 100%;
    }

    .btn-revoke {
      width: 100%;
    }

    .footer-content {
      flex-direction: column;
      gap: 0.5rem;
      text-align: center;
    }

    .modal {
      margin: 1rem;
    }

    .created-key-box {
      flex-direction: column;
      align-items: stretch;
    }

    .btn-copy {
      width: 100%;
      justify-content: center;
    }
  }
</style>