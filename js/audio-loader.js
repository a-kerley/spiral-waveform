import { clearCache } from './waveform-data.js';

// Basic audio file loading function
async function loadAudioFile(file) {
  console.log('🎵 Loading audio file with Web Audio API...');
  
  try {
    const arrayBuffer = await file.arrayBuffer();
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    await audioContext.close();
    
    console.log('✅ Audio file decoded successfully');
    return audioBuffer;
  } catch (error) {
    console.error('❌ Direct audio decoding failed:', error);
    throw new Error(`Failed to decode audio file: ${error.message}`);
  }
}

// Extract waveform data from AudioBuffer
function extractWaveformData(audioBuffer) {
  console.log('🔄 Extracting waveform data...');
  
  // Get the first channel (mono or left channel of stereo)
  const channelData = audioBuffer.getChannelData(0);
  
  console.log(`📊 Extracted ${channelData.length} samples from audio buffer`);
  return channelData;
}

// Calculate global maximum amplitude
function calculateGlobalMaxAmplitude(waveformData) {
  console.log('📈 Calculating global maximum amplitude...');
  
  let maxAmp = 0;
  for (let i = 0; i < waveformData.length; i++) {
    const absValue = Math.abs(waveformData[i]);
    if (absValue > maxAmp) {
      maxAmp = absValue;
    }
  }
  
  console.log(`📊 Global max amplitude: ${maxAmp.toFixed(6)}`);
  return maxAmp;
}

// Enhanced file format detection including Opus
function getFileFormat(file) {
  const extension = file.name.split('.').pop().toLowerCase();
  const mimeType = file.type.toLowerCase();
  
  console.log(`🔍 Detecting format for: ${file.name}`);
  console.log(`   - Extension: ${extension}`);
  console.log(`   - MIME type: ${mimeType}`);
  
  const formatMap = {
    'opus': 'Opus',
    'ogg': 'OGG (Vorbis/Opus)', // Could be either
    'oga': 'OGG Audio',
    'mp3': 'MP3',
    'wav': 'WAV',
    'm4a': 'M4A/AAC',
    'aac': 'AAC',
    'flac': 'FLAC',
    'webm': 'WebM (VP8/Opus)'
  };
  
  // Try to detect from extension first
  if (formatMap[extension]) {
    return formatMap[extension];
  }
  
  // Try to detect from MIME type with Opus specifics
  if (mimeType.includes('opus')) return 'Opus';
  if (mimeType.includes('ogg')) return 'OGG (Vorbis/Opus)';
  if (mimeType.includes('webm')) return 'WebM (VP8/Opus)';
  if (mimeType.includes('mpeg')) return 'MP3';
  if (mimeType.includes('wav')) return 'WAV';
  if (mimeType.includes('mp4')) return 'M4A/AAC';
  if (mimeType.includes('flac')) return 'FLAC';
  
  return 'Unknown';
}

// Main file selection handler - Enhanced with Opus support
export async function handleFileSelect(event) {
  const file = event.target.files[0];
  if (!file) return null;

  const detectedFormat = getFileFormat(file);
  console.log(`🎵 Loading file: ${file.name}`);
  console.log(`📋 Detected format: ${detectedFormat}`);

  clearCache();

  try {
    const audioBuffer = await loadAudioFile(file);
    const waveform = extractWaveformData(audioBuffer);
    const globalMaxAmp = calculateGlobalMaxAmplitude(waveform);

    console.log(`✅ Audio loaded successfully:`);
    console.log(`   - Format: ${detectedFormat}`);
    console.log(`   - Duration: ${audioBuffer.duration.toFixed(2)}s`);
    console.log(`   - Sample Rate: ${audioBuffer.sampleRate}Hz`);
    console.log(`   - Channels: ${audioBuffer.numberOfChannels}`);
    console.log(`   - Global Max Amplitude: ${globalMaxAmp.toFixed(6)}`);

    return { audioBuffer, waveform, globalMaxAmp };
    
  } catch (error) {
    console.error('❌ Error loading audio file:', error);
    alert(`Failed to load audio file: ${error.message}\n\nSupported formats: MP3, WAV, OGG/Vorbis, M4A, FLAC`);
    return null;
  }
}