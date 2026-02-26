<script>
  import './app.css';
  
  let activeTab = 'request';
  let voice = 'rachel';
  let demoText = "Hello! I'm your AI assistant. I can now speak to you naturally using Agent Talk's text-to-speech API.";
  let demoAudioUrl = null;
  let isPlaying = false;
  let isLoading = false;
  
  const voices = [
    { id: 'rachel', name: 'Rachel', description: 'Calm, professional' },
    { id: 'domi', name: 'Domi', description: 'Strong, confident' },
    { id: 'adam', name: 'Adam', description: 'Deep narration' },
    { id: 'charlie', name: 'Charlie', description: 'Casual conversational' },
    { id: 'emily', name: 'Emily', description: 'Soft, gentle' },
    { id: 'freya', name: 'Freya', description: 'Young, energetic' },
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
// → { url: "https://talk.onhyper.io/audio/abc123.mp3" }`,
    
    response: `{
  "id": "memo_abc123",
  "text": "Task complete! I've uploaded your report.",
  "voice": { "id": "rachel", "name": "Rachel" },
  "audio": {
    "url": "https://talk.onhyper.io/audio/memo_abc123.mp3",
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

  async function playDemo() {
    isLoading = true;
    try {
      // For now, simulate with a placeholder
      // In production, this would call the actual API
      demoAudioUrl = 'https://demo.example.com/audio.mp3';
      isPlaying = true;
    } catch (e) {
      console.error('Demo failed:', e);
    }
    isLoading = false;
  }
</script>

<main>
  <!-- Hero -->
  <section class="hero">
    <div class="hero-content">
      <div class="badge">Built for AI Agents</div>
      <h1>Give Your Agent<br /><span class="gradient">a Voice</span></h1>
      <p class="hero-subtitle">
        Text-to-speech API designed for autonomous AI agents. 
        One API call transforms your responses into natural speech.
      </p>
      
      <div class="hero-cta">
        <a href="#get-started" class="btn-primary">Get API Key</a>
        <a href="#demo" class="btn-secondary">Try Demo</a>
      </div>
      
      <div class="hero-stats">
        <div class="stat">
          <span class="stat-value">50ms</span>
          <span class="stat-label">Avg Latency</span>
        </div>
        <div class="stat">
          <span class="stat-value">10+</span>
          <span class="stat-label">Voices</span>
        </div>
        <div class="stat">
          <span class="stat-value">∞</span>
          <span class="stat-label">API Calls</span>
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
        <textarea id="demo-text" bind:value={demoText} rows="3"></textarea>
      </div>
      
      <button 
        class="btn-demo" 
        on:click={playDemo}
        disabled={isLoading}>
        {isLoading ? 'Generating...' : '▶ Generate & Play'}
      </button>
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
        <p>One POST request. Get back an audio URL. No complex SDKs, no callbacks, no webhooks.</p>
      </div>
      
      <div class="feature-card">
        <div class="feature-icon">🎯</div>
        <h3>Deterministic Responses</h3>
        <p>Same text + voice = same audio. Cache-friendly, reproducible results.</p>
      </div>
      
      <div class="feature-card">
        <div class="feature-icon">🔊</div>
        <h3>10+ Natural Voices</h3>
        <p>Choose from Rachel, Domi, Adam, Charlie, Emily, Freya and more. Each voice tuned for clarity.</p>
      </div>
      
      <div class="feature-card">
        <div class="feature-icon">📦</div>
        <h3>Persistent Storage</h3>
        <p>Audio files stored and served. No need to manage your own CDN or file storage.</p>
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

  <!-- Pricing -->
  <section class="pricing">
    <h2>Simple Pricing</h2>
    <p class="section-subtitle">Start free, scale as you grow</p>
    
    <div class="pricing-grid">
      <div class="pricing-card">
        <h3>Hobby</h3>
        <div class="price">$0<span>/mo</span></div>
        <ul class="features-list">
          <li>✓ 100 API calls/day</li>
          <li>✓ 5,000 characters/memo</li>
          <li>✓ All voices</li>
          <li>✓ Edge TTS</li>
        </ul>
        <a href="#get-started" class="btn-secondary">Get Started</a>
      </div>
      
      <div class="pricing-card featured">
        <div class="featured-badge">Most Popular</div>
        <h3>Pro</h3>
        <div class="price">$19<span>/mo</span></div>
        <ul class="features-list">
          <li>✓ 1,000 API calls/day</li>
          <li>✓ 10,000 characters/memo</li>
          <li>✓ All voices</li>
          <li>✓ ElevenLabs HD</li>
          <li>✓ Priority processing</li>
        </ul>
        <a href="#get-started" class="btn-primary">Get API Key</a>
      </div>
      
      <div class="pricing-card">
        <h3>Enterprise</h3>
        <div class="price">Custom</div>
        <ul class="features-list">
          <li>✓ Unlimited calls</li>
          <li>✓ Custom voice cloning</li>
          <li>✓ SLA guarantee</li>
          <li>✓ Dedicated support</li>
        </ul>
        <a href="mailto:hello@hyper.io" class="btn-secondary">Contact Us</a>
      </div>
    </div>
  </section>

  <!-- CTA -->
  <section id="get-started" class="cta-section">
    <h2>Ready to Give Your Agent a Voice?</h2>
    <p>Get your API key in seconds. Start converting text to speech today.</p>
    <a href="https://onhyper.io" class="btn-primary btn-large">Get API Key →</a>
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