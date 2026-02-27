<script>
  import { onMount } from 'svelte';
  
  // API base URL
  const API_BASE = typeof window !== 'undefined' && window.location.hostname === 'localhost' 
    ? 'http://localhost:3001' 
    : 'https://talk.onhyper.io';

  let mode = 'login'; // 'login' or 'signup'
  let email = '';
  let password = '';
  let confirmPassword = '';
  let loading = false;
  let error = null;
  let success = null;
  let rememberMe = false;
  
  // Check for existing session
  onMount(() => {
    const token = localStorage.getItem('auth_token');
    if (token) {
      // Verify token is still valid
      verifyToken(token);
    }
  });
  
  async function verifyToken(token) {
    try {
      const response = await fetch(`${API_BASE}/api/v1/auth/me`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        // Token is valid, redirect to dashboard
        window.location.href = '/dashboard.html';
      } else {
        // Token invalid, clear it
        localStorage.removeItem('auth_token');
      }
    } catch (e) {
      console.error('Token verification failed:', e);
    }
  }
  
  async function handleSubmit() {
    // Validate
    if (!email || !password) {
      error = 'Please fill in all fields';
      return;
    }
    
    if (mode === 'signup' && password !== confirmPassword) {
      error = 'Passwords do not match';
      return;
    }
    
    if (password.length < 8) {
      error = 'Password must be at least 8 characters';
      return;
    }
    
    loading = true;
    error = null;
    success = null;
    
    try {
      const endpoint = mode === 'login' ? '/api/v1/auth/login' : '/api/v1/auth/signup';
      const response = await fetch(`${API_BASE}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || data.error || 'Authentication failed');
      }
      
      // Store token
      localStorage.setItem('auth_token', data.token);
      
      if (mode === 'signup' && data.apiKey) {
        // Show API key on signup
        success = {
          message: 'Account created successfully!',
          apiKey: data.apiKey.key
        };
        
        // Redirect after showing the key
        setTimeout(() => {
          window.location.href = '/dashboard.html';
        }, 5000);
      } else {
        // Redirect to dashboard
        window.location.href = '/dashboard.html';
      }
      
    } catch (e) {
      error = e.message || 'Authentication failed. Please try again.';
    }
    
    loading = false;
  }
  
  function switchMode() {
    mode = mode === 'login' ? 'signup' : 'login';
    error = null;
    success = null;
  }
</script>

<main>
  <div class="login-container">
    <div class="login-card">
      <div class="login-header">
        <a href="/" class="logo">
          <strong>Agent Talk</strong>
        </a>
        <h1>{mode === 'login' ? 'Welcome Back' : 'Create Account'}</h1>
        <p>{mode === 'login' ? 'Sign in to access your dashboard' : 'Get started with your API key'}</p>
      </div>
      
      {#if success}
        <div class="success-message">
          <div class="success-icon">✅</div>
          <h3>{success.message}</h3>
          <div class="api-key-box">
            <span class="api-key-label">Your API Key (save this!)</span>
            <code>{success.apiKey}</code>
            <p class="warning">This key will only be shown once. Copy it now!</p>
          </div>
          <p class="redirect-notice">Redirecting to dashboard in 5 seconds...</p>
        </div>
      {:else}
        <form on:submit|preventDefault={handleSubmit}>
          <div class="form-group">
            <label for="email">Email</label>
            <input 
              type="email" 
              id="email" 
              bind:value={email} 
              placeholder="you@example.com"
              autocomplete="email"
              required
            />
          </div>
          
          <div class="form-group">
            <label for="password">Password</label>
            <input 
              type="password" 
              id="password" 
              bind:value={password} 
              placeholder="••••••••"
              autocomplete={mode === 'login' ? 'current-password' : 'new-password'}
              required
            />
          </div>
          
          {#if mode === 'signup'}
            <div class="form-group">
              <label for="confirm-password">Confirm Password</label>
              <input 
                type="password" 
                id="confirm-password" 
                bind:value={confirmPassword} 
                placeholder="••••••••"
                autocomplete="new-password"
                required
              />
            </div>
          {/if}
          
          {#if mode === 'login'}
            <div class="form-options">
              <label class="checkbox-label">
                <input type="checkbox" bind:checked={rememberMe} />
                <span>Remember me</span>
              </label>
              <a href="#forgot" class="forgot-link">Forgot password?</a>
            </div>
          {/if}
          
          {#if error}
            <div class="error-message">
              ⚠️ {error}
            </div>
          {/if}
          
          <button type="submit" class="btn-primary" disabled={loading}>
            {#if loading}
              {mode === 'login' ? 'Signing in...' : 'Creating account...'}
            {:else}
              {mode === 'login' ? 'Sign In' : 'Create Account'}
            {/if}
          </button>
        </form>
        
        <div class="switch-mode">
          {mode === 'login' ? "Don't have an account?" : 'Already have an account?'}
          <button type="button" class="btn-link" on:click={switchMode}>
            {mode === 'login' ? 'Sign up' : 'Sign in'}
          </button>
        </div>
      {/if}
    </div>
    
    <div class="login-footer">
      <p>By continuing, you agree to our <a href="/terms">Terms of Service</a> and <a href="/privacy">Privacy Policy</a>.</p>
    </div>
  </div>
</main>

<style>
  :global(body) {
    margin: 0;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  
  main {
    width: 100%;
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1rem;
  }
  
  .login-container {
    width: 100%;
    max-width: 420px;
  }
  
  .login-card {
    background: white;
    border-radius: 16px;
    padding: 2.5rem;
    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
  }
  
  .login-header {
    text-align: center;
    margin-bottom: 2rem;
  }
  
  .logo {
    text-decoration: none;
    color: #1a1a2e;
    font-size: 1.5rem;
  }
  
  .logo strong {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }
  
  .login-header h1 {
    margin: 1rem 0 0.5rem;
    font-size: 1.75rem;
    color: #1a1a2e;
  }
  
  .login-header p {
    color: #6b7280;
    margin: 0;
  }
  
  .form-group {
    margin-bottom: 1.25rem;
  }
  
  .form-group label {
    display: block;
    margin-bottom: 0.5rem;
    font-weight: 500;
    color: #374151;
    font-size: 0.9rem;
  }
  
  .form-group input {
    width: 100%;
    padding: 0.875rem 1rem;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    font-size: 1rem;
    transition: all 0.2s;
    box-sizing: border-box;
  }
  
  .form-group input:focus {
    outline: none;
    border-color: #667eea;
    box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
  }
  
  .form-options {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1.5rem;
  }
  
  .checkbox-label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    cursor: pointer;
    font-size: 0.9rem;
    color: #6b7280;
  }
  
  .checkbox-label input {
    width: auto;
  }
  
  .forgot-link {
    font-size: 0.9rem;
    color: #667eea;
    text-decoration: none;
  }
  
  .forgot-link:hover {
    text-decoration: underline;
  }
  
  .error-message {
    background: #fef2f2;
    color: #991b1b;
    padding: 0.875rem 1rem;
    border-radius: 8px;
    margin-bottom: 1rem;
    font-size: 0.9rem;
    border: 1px solid #fecaca;
  }
  
  .btn-primary {
    width: 100%;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    border: none;
    padding: 1rem;
    font-size: 1rem;
    font-weight: 600;
    border-radius: 8px;
    cursor: pointer;
    transition: transform 0.2s, box-shadow 0.2s;
  }
  
  .btn-primary:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: 0 10px 20px -10px rgba(102, 126, 234, 0.5);
  }
  
  .btn-primary:disabled {
    opacity: 0.7;
    cursor: not-allowed;
  }
  
  .switch-mode {
    text-align: center;
    margin-top: 1.5rem;
    color: #6b7280;
    font-size: 0.9rem;
  }
  
  .btn-link {
    background: none;
    border: none;
    color: #667eea;
    font-weight: 600;
    cursor: pointer;
    padding: 0;
    margin-left: 0.25rem;
  }
  
  .btn-link:hover {
    text-decoration: underline;
  }
  
  .login-footer {
    text-align: center;
    margin-top: 1.5rem;
  }
  
  .login-footer p {
    color: rgba(255, 255, 255, 0.8);
    font-size: 0.8rem;
    margin: 0;
  }
  
  .login-footer a {
    color: white;
    text-decoration: underline;
  }
  
  /* Success state */
  .success-message {
    text-align: center;
  }
  
  .success-icon {
    font-size: 3rem;
    margin-bottom: 1rem;
  }
  
  .success-message h3 {
    margin: 0 0 1.5rem;
    color: #1a1a2e;
  }
  
  .api-key-box {
    background: #f9fafb;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    padding: 1rem;
    margin-bottom: 1rem;
  }
  
  .api-key-box label {
    display: block;
    font-size: 0.8rem;
    color: #6b7280;
    margin-bottom: 0.5rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  
  .api-key-box code {
    display: block;
    word-break: break-all;
    font-family: 'SF Mono', Monaco, 'Cascadia Code', monospace;
    font-size: 0.85rem;
    color: #1a1a2e;
    background: white;
    padding: 0.75rem;
    border-radius: 4px;
    margin-top: 0.5rem;
  }
  
  .api-key-box .warning {
    color: #f59e0b;
    font-size: 0.85rem;
    margin: 0.75rem 0 0;
  }
  
  .redirect-notice {
    color: #6b7280;
    font-size: 0.85rem;
  }
  
  @media (max-width: 480px) {
    .login-card {
      padding: 1.5rem;
    }
    
    .login-header h1 {
      font-size: 1.5rem;
    }
    
    .form-options {
      flex-direction: column;
      gap: 0.75rem;
      align-items: flex-start;
    }
  }
</style>