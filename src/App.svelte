<script>
  import './app.css';
  
  let activeTab = 'request';
  let voice = 'rachel';
  let demoText = "Hello! I'm your AI assistant. I can now speak to you naturally using Agent Talk's text-to-speech API.";
  let demoAudioUrl = null;
  let isPlaying = false;
  let isLoading = false;
  let demoError = null;
  let audioElement = null;
  
  // Voice sample playback
  let sampleAudioElement = null;
  let currentlyPlayingVoice = null;
  
  // Signup flow state
  let showSignupModal = false;
  let signupEmail = '';
  let signupPassword = '';
  let signupLoading = false;
  let signupError = null;
  let signupSuccess = false;
  let apiKey = null;
  
  // Pricing calculator state
  let monthlyCalls = 1000;
  
  // FAQ state
  let openFaq = null;
  
  const voices = [
    { id: 'rachel', name: 'Rachel', description: 'Calm, professional', gender: 'female' },
    { id: 'domi', name: 'Domi', description: 'Strong, confident', gender: 'female' },
    { id: 'bella', name: 'Bella', description: 'Soft, warm', gender: 'female' },
    { id: 'adam', name: 'Adam', description: 'Deep narration', gender: 'male' },
    { id: 'sam', name: 'Sam', description: 'Conversational', gender: 'male' },
    { id: 'charlie', name: 'Charlie', description: 'Casual conversational', gender: 'male' },
    { id: 'emily', name: 'Emily', description: 'Soft, gentle', gender: 'female' },
    { id: 'ethan', name: 'Ethan', description: 'Young male', gender: 'male' },
    { id: 'freya', name: 'Freya', description: 'Young, energetic', gender: 'female' },
    { id: 'dorothy', name: 'Dorothy', description: 'Storyteller', gender: 'female' },
    { id: 'bill', name: 'Bill', description: 'Mature male', gender: 'male' },
    { id: 'sarah', name: 'Sarah', description: 'Professional female', gender: 'female' },
  ];
  
  const codeExamples = {
    request: `// One API call, instant voice
const response = await fetch('https://talk.onhyper.io/api/v1/memo', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    text: "Task complete! I've uploaded your report.",
    voice: "rachel"
  })
});

const { audio } = await response.json();
// → { url: "data:audio/mpeg;base64,..." }`,
    
    response: `{
  "id": "memo_abc123",
  "text": "Task complete! I've uploaded your report.",
  "voice": { "id": "rachel", "name": "Rachel" },
  "audio": {
    "url": "data:audio/mpeg;base64,//uQx...",
    "duration": 3.2,
    "format": "mp3"
  },
  "createdAt": "2026-02-26T17:00:00Z"
}`,
    
    play: `// Play directly in browser
const audio = new Audio(memo.audio.url);
audio.play();

// Or send to user
return {
  text: "Task complete!",
  audio_url: memo.audio.url
};`
  };
  
  const faqs = [
    {
      question: "How does Agent Talk differ from other TTS APIs?",
      answer: "Agent Talk is specifically designed for AI agents. Our API is stateless, deterministic, and returns audio directly in the response - no webhooks or callbacks needed. Same text + same voice = same audio every time, making it perfect for caching and reproducible agent behaviors."
    },
    {
      question: "What TTS providers do you use?",
      answer: "We support multiple providers: ElevenLabs for production-quality HD audio on paid plans, and Edge TTS for free/hobby tier. You can also use simulation mode for testing without API costs. Switch between providers with a single config flag."
    },
    {
      question: "Is there a free tier?",
      answer: "Yes! Our Hobby plan at $29/month includes 500 API calls/day with Edge TTS. Perfect for development and small projects. Need more? Pro plan offers 5,000 calls/day with ElevenLabs HD audio for $99/month."
    },
    {
      question: "How fast is the API response?",
      answer: "Average latency is under 50ms for Edge TTS and 200-500ms for ElevenLabs. Audio is returned inline as base64, so there's no additional fetch time. For most agent use cases, you'll have audio ready before your response completes."
    },
    {
      question: "Can I use this for commercial applications?",
      answer: "Absolutely! All plans include commercial usage rights. Pro and Scale plans include priority processing and dedicated infrastructure for high-volume production workloads."
    },
    {
      question: "How do I authenticate API requests?",
      answer: "Simple API key authentication. Include your key in the Authorization header: `Authorization: Bearer your-api-key`. Generate and manage keys from your dashboard. Each key can be tracked separately for usage analytics."
    }
  ];

  // API base URL - use local server in dev, production URL otherwise
  const API_BASE = typeof window !== 'undefined' && window.location.hostname === 'localhost' 
    ? 'http://localhost:3001' 
    : 'https://talk.onhyper.io';

  // Get API base URL (uses relative path for same-origin, or env var for production)
  const getApiBase = () => {
    // In production, use the deployed URL
    if (typeof window !== 'undefined' && window.location.hostname !== 'localhost') {
      return window.ONHYPER?.apiBaseUrl || '';
    }
    // In development, use localhost
    return 'http://localhost:3001';
  };

  async function playDemo() {
    isLoading = true;
    demoError = null;
    
    // Stop any playing audio
    if (audioElement) {
      audioElement.pause();
      audioElement = null;
    }
    
    try {
      // Use local API for TTS demo
      const apiBase = getApiBase();
      const response = await fetch(`${apiBase}/api/v1/demo`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          text: demoText,
          voice: voice
        })
      });
      
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || error.message || `API error: ${response.status}`);
      }
      
      const data = await response.json();
      // Response should have audio URL
      if (data.audio?.url) {
        demoAudioUrl = data.audio.url;
      } else if (data.audio_url) {
        demoAudioUrl = data.audio_url;
      } else {
        throw new Error('No audio in response');
      }
      
      // Play audio
      audioElement = new Audio(demoAudioUrl);
      audioElement.onended = () => {
        isPlaying = false;
      };
      await audioElement.play();
      isPlaying = true;
      
    } catch (e) {
      console.error('Demo failed:', e);
      demoError = e.message || 'Failed to generate audio. Please try again.';
    }
    
    isLoading = false;
  }
  
  function stopAudio() {
    if (audioElement) {
      audioElement.pause();
      audioElement = null;
    }
    isPlaying = false;
  }
  
  async function handleSignup() {
    if (!signupEmail || !signupPassword) {
      signupError = 'Please fill in all fields';
      return;
    }
    
    if (signupPassword.length < 8) {
      signupError = 'Password must be at least 8 characters';
      return;
    }
    
    signupLoading = true;
    signupError = null;
    
    try {
      const response = await fetch(`${API_BASE}/api/v1/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: signupEmail,
          password: signupPassword
        })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || data.error || 'Signup failed');
      }
      
      // Store the auth token
      if (data.token) {
        localStorage.setItem('auth_token', data.token);
      }
      
      // Use the API key from the response
      if (data.apiKey && data.apiKey.key) {
        apiKey = data.apiKey.key;
        signupSuccess = true;
      } else {
        // Fallback: generate a placeholder key if API didn't return one
        apiKey = `at_live_${btoa(signupEmail).slice(0, 20)}_${Date.now().toString(36)}`;
        signupSuccess = true;
      }
      
    } catch (e) {
      signupError = e.message || 'Signup failed. Please try again.';
    }
    
    signupLoading = false;
  }
  
  function openSignup() {
    showSignupModal = true;
    signupEmail = '';
    signupPassword = '';
    signupError = null;
    signupSuccess = false;
    apiKey = null;
  }
  
  function closeSignup() {
    showSignupModal = false;
  }
  
  function calculatePrice(calls) {
    // Hobby: $29 for 15,000 calls/month
    // Pro: $99 for 150,000 calls/month  
    // Scale: $249 for 750,000 calls/month
    
    if (calls <= 15000) {
      return { plan: 'Hobby', price: 29, overage: 0 };
    } else if (calls <= 150000) {
      return { plan: 'Pro', price: 99, overage: 0 };
    } else if (calls <= 750000) {
      return { plan: 'Scale', price: 249, overage: 0 };
    } else {
      const overage = calls - 750000;
      const overageCost = Math.ceil(overage / 1000) * 0.02;
      return { plan: 'Scale', price: 249, overage: overageCost, total: 249 + overageCost };
    }
  }
  
  function toggleFaq(index) {
    openFaq = openFaq === index ? null : index;
  }
  
  // Play pre-generated voice sample
  function playVoiceSample(voiceId) {
    // Stop any currently playing audio
    if (sampleAudioElement) {
      sampleAudioElement.pause();
      sampleAudioElement = null;
    }
    if (audioElement) {
      audioElement.pause();
      audioElement = null;
      isPlaying = false;
    }
    
    // If same voice was playing, stop it
    if (currentlyPlayingVoice === voiceId) {
      currentlyPlayingVoice = null;
      return;
    }
    
    // Play the sample
    const samplePath = `/samples/${voiceId}.mp3`;
    sampleAudioElement = new Audio(samplePath);
    
    sampleAudioElement.onended = () => {
      currentlyPlayingVoice = null;
    };
    
    sampleAudioElement.onerror = () => {
      console.error('Failed to load sample:', samplePath);
      // Fallback: scroll to demo section
      document.getElementById('demo')?.scrollIntoView({ behavior: 'smooth' });
      currentlyPlayingVoice = null;
    };
    
    sampleAudioElement.play().catch(err => {
      console.error('Failed to play sample:', err);
      currentlyPlayingVoice = null;
    });
    
    currentlyPlayingVoice = voiceId;
  }
  
  // Cleanup audio on destroy
  import { onMount, onDestroy } from 'svelte';
  onMount(() => {
    // Component mounted
  });
  onDestroy(() => {
    if (audioElement) {
      audioElement.pause();
      audioElement = null;
    }
    if (sampleAudioElement) {
      sampleAudioElement.pause();
      sampleAudioElement = null;
    }
  });
</script>

<main>
  <!-- Hero -->
  <section class="hero">
    <div class="hero-content">
      <div class="badge">🎯 Built for AI Agents</div>
      <h1>Give Your Agent<br /><span class="gradient">a Voice</span></h1>
      <p class="hero-subtitle">
        <strong>Text-to-speech API designed for autonomous AI systems.</strong><br />
        One POST request returns playable audio. No webhooks, no callbacks, no hassle.
      </p>
      
      <div class="hero-cta">
        <button class="btn-primary" on:click={openSignup}>
          Get API Key →
        </button>
        <a href="#demo" class="btn-secondary">Try Demo</a>
      </div>
      
      <div class="hero-stats">
        <div class="stat">
          <span class="stat-value">&lt;50ms</span>
          <span class="stat-label">Avg Latency</span>
        </div>
        <div class="stat">
          <span class="stat-value">12</span>
          <span class="stat-label">Voices</span>
        </div>
        <div class="stat">
          <span class="stat-value">99.9%</span>
          <span class="stat-label">Uptime</span>
        </div>
      </div>
    </div>
    
    <div class="hero-visual">
      <div class="code-window">
        <div class="code-header">
          <span class="dot red"></span>
          <span class="dot yellow"></span>
          <span class="dot green"></span>
          <span class="code-title">api-call.js</span>
        </div>
        <div class="code-tabs">
          <button 
            class:active={activeTab === 'request'} 
            on:click={() => activeTab = 'request'}>
            Request
          </button>
          <button 
            class:active={activeTab === 'response'} 
            on:click={() => activeTab = 'response'}>
            Response
          </button>
          <button 
            class:active={activeTab === 'play'} 
            on:click={() => activeTab = 'play'}>
            Play
          </button>
        </div>
        <pre class="code-content"><code>{codeExamples[activeTab]}</code></pre>
      </div>
    </div>
  </section>

  <!-- How It Works -->
  <section class="how-it-works">
    <h2>How It Works</h2>
    <p class="section-subtitle">Three simple steps to give your agent a voice</p>
    
    <div class="steps-grid">
      <div class="step-card">
        <div class="step-number">1</div>
        <h3>Get Your API Key</h3>
        <p>Sign up and receive your API key instantly. No complex setup required.</p>
      </div>
      
      <div class="step-arrow">→</div>
      
      <div class="step-card">
        <div class="step-number">2</div>
        <h3>Send Text to API</h3>
        <p>POST your text to our endpoint. Choose from 12 natural voices.</p>
      </div>
      
      <div class="step-arrow">→</div>
      
      <div class="step-card">
        <div class="step-number">3</div>
        <h3>Play Audio</h3>
        <p>Receive audio URL instantly. Play it directly or send to your users.</p>
      </div>
    </div>
  </section>

  <!-- Demo Section -->
  <section id="demo" class="demo-section">
    <h2>Hear It Yourself</h2>
    <p class="section-subtitle">Select a voice and enter text to generate speech</p>
    
    <div class="demo-container">
      <div class="demo-input">
        <label for="voice-select">Voice</label>
        <select id="voice-select" bind:value={voice}>
          {#each voices as v}
            <option value={v.id}>{v.name} - {v.description}</option>
          {/each}
        </select>
      </div>
      
      <div class="demo-input">
        <label for="demo-text">Text to Speak</label>
        <textarea id="demo-text" bind:value={demoText} rows="3" maxlength="500"></textarea>
        <span class="char-count">{demoText.length}/500</span>
      </div>
      
      {#if demoError}
        <div class="demo-error">
          ⚠️ {demoError}
        </div>
      {/if}
      
      {#if demoAudioUrl}
        <div class="demo-success">
          ✅ Audio generated! Click play again to generate new audio.
        </div>
      {/if}
      
      <div class="demo-buttons">
        <button 
          class="btn-demo" 
          on:click={playDemo}
          disabled={isLoading}>
          {isLoading ? '⏳ Generating...' : isPlaying ? '⏹️ Playing...' : '▶️ Generate & Play'}
        </button>
        
        {#if isPlaying}
          <button class="btn-demo btn-stop" on:click={stopAudio}>
            ⏹️ Stop
          </button>
        {/if}
      </div>
      
      <p class="demo-note">
        💡 Demo uses simulation mode (silent audio). <button class="link-btn" on:click={openSignup}>Get a free API key</button> for production-quality ElevenLabs audio.
      </p>
    </div>
  </section>

  <!-- Voice Samples -->
  <section class="voice-samples">
    <h2>Meet Our Voices</h2>
    <p class="section-subtitle">12 professional voices for any use case</p>
    
    <div class="voices-grid">
      {#each voices as v}
        <div class="voice-card">
          <div class="voice-avatar" class:male={v.gender === 'male'} class:female={v.gender === 'female'}>
            {v.name[0]}
          </div>
          <div class="voice-info">
            <h4>{v.name}</h4>
            <p>{v.description}</p>
          </div>
          <button class="btn-voice-sample" on:click={() => playVoiceSample(v.id)}>
            {currentlyPlayingVoice === v.id ? '⏹️ Stop' : '▶ Sample'}
          </button>
        </div>
      {/each}
    </div>
  </section>

  <!-- Features -->
  <section class="features">
    <h2>Built for the Agent-First Future</h2>
    <p class="section-subtitle">Simple APIs designed for autonomous AI systems</p>
    
    <div class="feature-grid">
      <div class="feature-card">
        <div class="feature-icon">⚡</div>
        <h3>Agent-Native API</h3>
        <p>One POST request. Get back audio inline. No complex SDKs, no callbacks, no webhooks.</p>
      </div>
      
      <div class="feature-card">
        <div class="feature-icon">🎯</div>
        <h3>Deterministic Responses</h3>
        <p>Same text + voice = same audio. Cache-friendly, reproducible results.</p>
      </div>
      
      <div class="feature-card">
        <div class="feature-icon">🔊</div>
        <h3>12 Natural Voices</h3>
        <p>Rachel, Domi, Adam, Charlie, Emily, Freya and more. Each voice tuned for clarity.</p>
      </div>
      
      <div class="feature-card">
        <div class="feature-icon">📦</div>
        <h3>Inline Audio</h3>
        <p>Audio returned as base64 in the response. No separate fetches, instant playback.</p>
      </div>
      
      <div class="feature-card">
        <div class="feature-icon">🔄</div>
        <h3>Multiple Providers</h3>
        <p>ElevenLabs for production quality. Edge TTS for free tier. Simulation mode for testing.</p>
      </div>
      
      <div class="feature-card">
        <div class="feature-icon">🔐</div>
        <h3>Simple Auth</h3>
        <p>API key authentication. Generate keys for different agents. Track usage per key.</p>
      </div>
    </div>
  </section>

  <!-- Use Cases -->
  <section class="use-cases">
    <h2>How Agents Use Agent Talk</h2>
    
    <div class="use-case-list">
      <div class="use-case">
        <div class="use-case-icon">🗣️</div>
        <div class="use-case-content">
          <h3>Voice Responses</h3>
          <p>Convert your text responses to speech for voice-enabled interfaces</p>
        </div>
      </div>
      
      <div class="use-case">
        <div class="use-case-icon">📢</div>
        <div class="use-case-content">
          <h3>Notifications</h3>
          <p>Announce task completions, alerts, and important updates with voice</p>
        </div>
      </div>
      
      <div class="use-case">
        <div class="use-case-icon">♿</div>
        <div class="use-case-content">
          <h3>Accessibility</h3>
          <p>Make your agent's output accessible to users who prefer audio</p>
        </div>
      </div>
      
      <div class="use-case">
        <div class="use-case-icon">🤝</div>
        <div class="use-case-content">
          <h3>Agent-to-Agent</h3>
          <p>Enable voice communication between autonomous AI systems</p>
        </div>
      </div>
    </div>
  </section>

  <!-- Pricing Calculator -->
  <section class="pricing-calculator">
    <h2>Simple, Transparent Pricing</h2>
    <p class="section-subtitle">Calculate your monthly cost</p>
    
    <div class="calculator-container">
      <div class="calculator-input">
        <label for="monthly-calls">Monthly API Calls</label>
        <input 
          type="range" 
          id="monthly-calls" 
          min="1000" 
          max="1000000" 
          step="1000" 
          bind:value={monthlyCalls}
        />
        <span class="calls-value">{monthlyCalls.toLocaleString()} calls/month</span>
      </div>
      
      <div class="calculator-result">
        <div class="recommended-plan">
          <span class="plan-label">Recommended Plan</span>
          <span class="plan-name">{calculatePrice(monthlyCalls).plan}</span>
        </div>
        <div class="price-breakdown">
          <span class="price">${calculatePrice(monthlyCalls).total || calculatePrice(monthlyCalls).price}</span>
          <span class="price-period">/month</span>
        </div>
        {#if calculatePrice(monthlyCalls).overage > 0}
          <p class="overage-note">Includes ${calculatePrice(monthlyCalls).overage.toFixed(2)} overage</p>
        {/if}
      </div>
    </div>
    
    <div class="pricing-grid">
      <div class="pricing-card">
        <h3>Hobby</h3>
        <div class="price">$29<span>/mo</span></div>
        <ul class="features-list">
          <li>✓ 500 API calls/day</li>
          <li>✓ 5,000 characters/memo</li>
          <li>✓ All voices</li>
          <li>✓ Edge TTS</li>
          <li>✓ Email support</li>
        </ul>
        <button class="btn-secondary" on:click={openSignup}>Get Started</button>
      </div>
      
      <div class="pricing-card featured">
        <div class="featured-badge">Most Popular</div>
        <h3>Pro</h3>
        <div class="price">$99<span>/mo</span></div>
        <ul class="features-list">
          <li>✓ 5,000 API calls/day</li>
          <li>✓ 10,000 characters/memo</li>
          <li>✓ All voices</li>
          <li>✓ ElevenLabs HD audio</li>
          <li>✓ Priority processing</li>
          <li>✓ Slack support</li>
        </ul>
        <button class="btn-primary" on:click={openSignup}>Get API Key</button>
      </div>
      
      <div class="pricing-card">
        <h3>Scale</h3>
        <div class="price">$249<span>/mo</span></div>
        <ul class="features-list">
          <li>✓ 25,000 API calls/day</li>
          <li>✓ Unlimited characters</li>
          <li>✓ All voices + custom</li>
          <li>✓ ElevenLabs HD audio</li>
          <li>✓ Dedicated infrastructure</li>
          <li>✓ Priority support</li>
        </ul>
        <button class="btn-secondary" on:click={openSignup}>Contact Sales</button>
      </div>
    </div>
  </section>

  <!-- FAQ Section -->
  <section class="faq-section">
    <h2>Frequently Asked Questions</h2>
    <p class="section-subtitle">Everything you need to know about Agent Talk</p>
    
    <div class="faq-list">
      {#each faqs as faq, i}
        <div class="faq-item" class:open={openFaq === i}>
          <button class="faq-question" on:click={() => toggleFaq(i)}>
            <span>{faq.question}</span>
            <span class="faq-icon">{openFaq === i ? '−' : '+'}</span>
          </button>
          {#if openFaq === i}
            <div class="faq-answer">
              <p>{faq.answer}</p>
            </div>
          {/if}
        </div>
      {/each}
    </div>
  </section>

  <!-- CTA -->
  <section class="cta-section">
    <h2>Ready to Give Your Agent a Voice?</h2>
    <p>Get your API key in seconds. Start converting text to speech today.</p>
    <button class="btn-primary btn-large" on:click={openSignup}>Get API Key →</button>
    <p class="cta-note">No credit card required • Free trial included</p>
  </section>

  <!-- Footer -->
  <footer>
    <div class="footer-content">
      <div class="footer-brand">
        <strong>Agent Talk</strong>
        <p>Give your AI agent a voice</p>
      </div>
      <div class="footer-links">
        <a href="#demo">Demo</a>
        <a href="#pricing">Pricing</a>
        <a href="https://github.com/hyperio-mc/agent-talk">GitHub</a>
        <a href="mailto:hello@hyper.io">Contact</a>
      </div>
      <div class="footer-powered">
        <span>Powered by</span>
        <a href="https://onhyper.io">HYPR</a>
      </div>
    </div>
  </footer>
</main>

<!-- Signup Modal -->
{#if showSignupModal}
  <div class="modal-overlay" on:click={closeSignup} on:keydown={(e) => e.key === 'Escape' && closeSignup()} role="button" tabindex="0">
    <div class="modal" on:click|stopPropagation role="dialog" aria-modal="true" tabindex="-1">
      {#if signupSuccess}
        <div class="signup-success">
          <div class="success-icon">✅</div>
          <h3>Welcome to Agent Talk!</h3>
          <p>Your account has been created.</p>
          
          <div class="api-key-display">
            <span class="api-key-label">Your API Key</span>
            <div class="api-key-value">
              <code>{apiKey}</code>
            </div>
            <p class="api-key-note">Save this key! You won't be able to see it again.</p>
          </div>
          
          <button class="btn-primary" on:click={() => { closeSignup(); window.location.href = '/dashboard.html'; }}>Go to Dashboard →</button>
        </div>
      {:else}
        <button class="modal-close" on:click={closeSignup} aria-label="Close">×</button>
        <h3>Get Your API Key</h3>
        <p class="modal-subtitle">Create an account to start using Agent Talk</p>
        
        <form on:submit|preventDefault={handleSignup}>
          <div class="form-group">
            <label for="signup-email">Email</label>
            <input 
              type="email" 
              id="signup-email" 
              bind:value={signupEmail} 
              placeholder="you@example.com"
              required
            />
          </div>
          
          <div class="form-group">
            <label for="signup-password">Password</label>
            <input 
              type="password" 
              id="signup-password" 
              bind:value={signupPassword} 
              placeholder="••••••••"
              minlength="8"
              required
            />
          </div>
          
          {#if signupError}
            <div class="form-error">{signupError}</div>
          {/if}
          
          <button type="submit" class="btn-primary btn-full" disabled={signupLoading}>
            {signupLoading ? 'Creating Account...' : 'Create Account →'}
          </button>
        </form>
        
        <p class="form-footer">
          Already have an account? <button class="link-btn" on:click={openSignup}>Sign in</button>
        </p>
      {/if}
    </div>
  </div>
{/if}
