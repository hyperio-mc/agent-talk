#!/usr/bin/env node
/**
 * Generate voice sample audio files for the landing page
 * Uses Edge TTS to create MP3 files for each voice
 */

import { EdgeTTS } from 'node-edge-tts';
import { mkdirSync, existsSync, writeFileSync, copyFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Voice sample texts - each voice introduces itself
const VOICE_SAMPLES = {
  rachel: "Hi, I'm Rachel. I have a calm, professional voice that's perfect for business applications and clear communication.",
  domi: "Hi, I'm Domi. I have a strong, confident voice that commands attention and conveys authority.",
  bella: "Hi, I'm Bella. I have a soft, warm voice that's inviting and friendly for conversational interfaces.",
  adam: "Hi, I'm Adam. I have a deep narration voice, ideal for storytelling and professional presentations.",
  sam: "Hi, I'm Sam. I have a conversational voice that sounds natural and approachable for everyday interactions.",
  charlie: "Hi, I'm Charlie. I have a casual conversational style that's relaxed and easy-going.",
  emily: "Hi, I'm Emily. I have a soft, gentle voice that's soothing and pleasant for accessibility features.",
  ethan: "Hi, I'm Ethan. I have a young male voice that's energetic and modern for tech applications.",
  freya: "Hi, I'm Freya. I have a young, energetic voice that's vibrant and engaging for dynamic experiences.",
  dorothy: "Hi, I'm Dorothy. I'm a storyteller voice, perfect for narratives and long-form content.",
  bill: "Hi, I'm Bill. I have a mature male voice that conveys wisdom and experience.",
  sarah: "Hi, I'm Sarah. I have a professional female voice that's polished and corporate-friendly."
};

// Edge TTS voice mappings
const EDGE_VOICES = {
  rachel: 'en-US-JennyNeural',
  domi: 'en-US-AriaNeural',
  bella: 'en-GB-SoniaNeural',
  adam: 'en-US-GuyNeural',
  sam: 'en-US-ChristopherNeural',
  charlie: 'en-US-EricNeural',
  emily: 'en-US-MichelleNeural',
  ethan: 'en-US-TonyNeural',
  freya: 'en-US-AnaNeural',
  dorothy: 'en-GB-MiaNeural',
  bill: 'en-US-RogerNeural',
  sarah: 'en-US-JennyNeural'
};

async function generateSamples() {
  const outputDir = join(__dirname, 'public', 'samples');
  
  // Create output directory
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }
  
  console.log('🎙️  Generating voice samples with Edge TTS...\n');
  
  for (const [voiceId, text] of Object.entries(VOICE_SAMPLES)) {
    const edgeVoice = EDGE_VOICES[voiceId];
    const outputPath = join(outputDir, `${voiceId}.mp3`);
    
    // Skip if already exists
    if (existsSync(outputPath)) {
      const stats = { size: (await import('fs')).statSync(outputPath).size };
      console.log(`✓ ${voiceId}: Already exists (${stats.size} bytes)`);
      continue;
    }
    
    console.log(`Generating ${voiceId} (${edgeVoice})...`);
    
    try {
      const tts = new EdgeTTS({
        voice: edgeVoice,
        lang: 'en-US',
        outputFormat: 'audio-24khz-96kbitrate-mono-mp3',
        timeout: 30000
      });
      
      const tempPath = `/tmp/sample-${voiceId}.mp3`;
      await tts.ttsPromise(text, tempPath);
      
      // Copy to output directory
      copyFileSync(tempPath, outputPath);
      
      const stats = (await import('fs')).statSync(outputPath);
      console.log(`✓ ${voiceId}: Generated (${stats.size} bytes)`);
    } catch (error) {
      console.error(`✗ ${voiceId}: Failed - ${error.message}`);
    }
  }
  
  console.log('\n✅ Voice sample generation complete!');
  console.log(`Samples saved to: ${outputDir}`);
}

generateSamples().catch(console.error);