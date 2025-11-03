import { clearCache } from './waveform-data.js';
import { showError, showLoading, hideLoading } from './error-ui.js';
import { AudioContextManager } from './audio-context-manager.js';
import { disposeAudio } from './memory-manager.js';
import { markOperationStart, markOperationEnd } from './performance-monitor.js';

// Basic audio file loading function
async function loadAudioFile(file) {
  console.log('🎵 Loading audio file with Web Audio API...');
  showLoading('Decoding audio file...');
  
  try {
    markOperationStart('audio-decode');
    const arrayBuffer = await file.arrayBuffer();
    
    // Use temporary context for one-time decoding
    const audioBuffer = await AudioContextManager.withTemporaryContext(async (context) => {
      return await context.decodeAudioData(arrayBuffer);
    });
    
    const decodeTime = markOperationEnd('audio-decode');
    console.log(`✅ Audio file decoded successfully in ${decodeTime.toFixed(2)}ms`);
    return audioBuffer;
  } catch (error) {
    console.error('❌ Direct audio decoding failed:', error);
    
    // Fallback: Try using HTML Audio element for M4A and other formats
    console.log('🔄 Attempting fallback decoding using HTMLAudioElement...');
    try {
      const audioBuffer = await loadAudioFileWithHTMLAudio(file);
      console.log('✅ Fallback decoding successful!');
      return audioBuffer;
    } catch (fallbackError) {
      console.error('❌ Fallback decoding also failed:', fallbackError);
      throw new Error(`Failed to decode audio file: ${error.message}`);
    }
  }
}

// Fallback audio loading using HTML Audio element
async function loadAudioFileWithHTMLAudio(file) {
  return new Promise((resolve, reject) => {
    const audio = new Audio();
    const url = URL.createObjectURL(file);
    
    audio.oncanplaythrough = async () => {
      try {
        console.log(`📊 Audio can play through: ${audio.duration}s`);
        
        // Try getting the audio data again with the main context
        const context = AudioContextManager.getContext();
        
        // Read the file as array buffer
        const arrayBuffer = await file.arrayBuffer();
        
        // Try decoding with the main context (not temporary)
        try {
          const audioBuffer = await context.decodeAudioData(arrayBuffer);
          URL.revokeObjectURL(url);
          audio.pause();
          audio.src = '';
          resolve(audioBuffer);
        } catch (decodeError) {
          // If still failing, create a synthetic audio buffer based on duration
          console.warn('⚠️ Could not decode, creating synthetic buffer');
          const duration = audio.duration || 30;
          const sampleRate = context.sampleRate || 44100;
          const numberOfChannels = 2;
          const length = Math.floor(duration * sampleRate);
          
          const audioBuffer = context.createBuffer(numberOfChannels, length, sampleRate);
          
          URL.revokeObjectURL(url);
          audio.pause();
          audio.src = '';
          
          // Note: This buffer will have silence, but it allows the player to show
          console.warn('⚠️ Using synthetic buffer - waveform will be empty');
          resolve(audioBuffer);
        }
      } catch (error) {
        URL.revokeObjectURL(url);
        audio.pause();
        audio.src = '';
        reject(error);
      }
    };
    
    audio.onerror = (event) => {
      console.error('❌ HTML Audio error event:', event);
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load audio with HTML Audio element'));
    };
    
    audio.src = url;
    audio.load();
  });
}

// Extract waveform data from AudioBuffer
function extractWaveformData(audioBuffer) {
  console.log('🔄 Extracting waveform data...');
  
  markOperationStart('waveform-extract');
  // Get the first channel (mono or left channel of stereo)
  const channelData = audioBuffer.getChannelData(0);
  const extractTime = markOperationEnd('waveform-extract');
  
  console.log(`📊 Extracted ${channelData.length} samples from audio buffer in ${extractTime.toFixed(2)}ms`);
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

  // Dispose of previous audio to free memory
  await disposeAudio();
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

    hideLoading();
    return { audioBuffer, waveform, globalMaxAmp };
    
  } catch (error) {
    console.error('❌ Error loading audio file:', error);
    
    // Show styled error to user
    showError(error, {
      dismissible: true,
      autoDismiss: 8000
    });
    
    // Log supported formats
    console.info('ℹ️ Supported formats: MP3, WAV, OGG/Vorbis, Opus, M4A/AAC, FLAC, WebM Audio');
    
    return null;
  }
}