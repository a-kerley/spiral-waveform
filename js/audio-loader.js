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

// Enhanced file format detection with comprehensive audio format support
function getFileFormat(file) {
  const extension = file.name.split('.').pop()?.toLowerCase();
  const mimeType = file.type?.toLowerCase();
  
  console.log(`🔍 Detecting format for: ${file.name}`);
  console.log(`   - Extension: ${extension}`);
  console.log(`   - MIME type: ${mimeType}`);
  
  // Enhanced format mapping with common variants
  const formatMap = {
    // Opus formats
    'opus': 'Opus',
    
    // OGG formats (can contain Vorbis, Opus, or FLAC)
    'ogg': 'OGG',
    'oga': 'OGG Audio',
    
    // MP3 formats
    'mp3': 'MP3',
    
    // WAV formats
    'wav': 'WAV',
    'wave': 'WAV',
    
    // M4A/AAC formats
    'm4a': 'M4A (AAC)',
    'aac': 'AAC',
    'mp4': 'MP4 Audio',
    
    // FLAC formats
    'flac': 'FLAC',
    
    // WebM formats
    'webm': 'WebM Audio',
    
    // Other formats
    'wma': 'WMA',
    'amr': 'AMR',
    '3gp': '3GP Audio'
  };
  
  // MIME type detection with detailed format recognition
  const mimeTypeMap = {
    // Opus
    'audio/opus': 'Opus',
    
    // OGG variants
    'audio/ogg': 'OGG',
    'audio/vorbis': 'OGG Vorbis',
    'application/ogg': 'OGG',
    
    // MP3 variants
    'audio/mpeg': 'MP3',
    'audio/mp3': 'MP3',
    'audio/mpeg3': 'MP3',
    
    // WAV variants
    'audio/wav': 'WAV',
    'audio/wave': 'WAV',
    'audio/x-wav': 'WAV',
    'audio/vnd.wave': 'WAV',
    
    // M4A/AAC variants
    'audio/mp4': 'M4A (AAC)',
    'audio/aac': 'AAC',
    'audio/x-m4a': 'M4A (AAC)',
    'audio/mp4a-latm': 'M4A (AAC)',
    
    // FLAC variants
    'audio/flac': 'FLAC',
    'audio/x-flac': 'FLAC',
    
    // WebM
    'audio/webm': 'WebM Audio',
    
    // Other formats
    'audio/x-ms-wma': 'WMA',
    'audio/amr': 'AMR'
  };
  
  // First try exact MIME type match
  if (mimeType && mimeTypeMap[mimeType]) {
    return mimeTypeMap[mimeType];
  }
  
  // Then try partial MIME type matching
  if (mimeType) {
    if (mimeType.includes('opus')) return 'Opus';
    if (mimeType.includes('ogg')) return 'OGG';
    if (mimeType.includes('vorbis')) return 'OGG Vorbis';
    if (mimeType.includes('mpeg') || mimeType.includes('mp3')) return 'MP3';
    if (mimeType.includes('wav') || mimeType.includes('wave')) return 'WAV';
    if (mimeType.includes('mp4') || mimeType.includes('aac') || mimeType.includes('m4a')) return 'M4A (AAC)';
    if (mimeType.includes('flac')) return 'FLAC';
    if (mimeType.includes('webm')) return 'WebM Audio';
  }
  
  // Finally try extension matching
  if (extension && formatMap[extension]) {
    return formatMap[extension];
  }
  
  return 'Unknown Format';
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
    alert(`Failed to load audio file: ${error.message}\n\nSupported formats: MP3, WAV, OGG/Vorbis, Opus, M4A/AAC, FLAC, WebM Audio`);
    return null;
  }
}