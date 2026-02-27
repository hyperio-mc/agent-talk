import { EdgeTTSService } from './src/services/edgeTTS.ts';

async function test() {
  const tts = new EdgeTTSService();
  console.log('Testing Edge TTS...');
  console.log('Testing voice: rachel');
  
  try {
    const audio = await tts.generateAudio('Hello, this is a test of Edge TTS integration.', 'rachel');
    console.log('✅ Audio generated successfully!');
    console.log('Audio buffer size:', audio.byteLength, 'bytes');
    
    if (audio.byteLength > 1000) {
      console.log('✅ Audio file has substantial content (not silent placeholder)');
    } else {
      console.log('⚠️ Audio file is very small, may be invalid');
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

test();