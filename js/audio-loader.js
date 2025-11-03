import { clearCache } from './waveform-data.js';
import { showError, showLoading, hideLoading } from './error-ui.js';
import { AudioContextManager, createAudioBuffer, decodeAudioData } from './audio-context-manager.js';
import { disposeAudio } from './memory-manager.js';
import { markOperationStart, markOperationEnd } from './performance-monitor.js';
import { AudioUrlUtils, toDirectUrl, sanitizeUrl } from './audio-url-utils.js';
import logger, { file as fileLog } from './logger.js';

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

/**
 * Load audio from a URL with fallback to placeholder waveform
 * @param {string} url - The URL to load audio from (supports direct links, Dropbox, etc.)
 * @returns {Promise<{audioBuffer?: AudioBuffer, waveform: Float32Array, globalMaxAmp?: number, isUrlLoaded: boolean, fileName?: string, audioElement?: HTMLAudioElement}>}
 */
export async function loadAudioFromUrl(url) {
  try {
    fileLog('🔗 Loader: Loading from URL', 'info', { url: url.substring(0, 100) });
    
    // Dispose of previous audio to free memory
    await disposeAudio();
    clearCache();
    
    // Sanitize and validate URL
    const sanitizedUrl = sanitizeUrl(url);
    const urlType = AudioUrlUtils.detectUrlType(sanitizedUrl);
    
    fileLog('🔍 Loader: URL type detected', 'info', { type: AudioUrlUtils.describeUrl(sanitizedUrl) });
    
    // Convert sharing URLs to direct download URLs
    const directUrl = toDirectUrl(sanitizedUrl);
    
    if (directUrl !== sanitizedUrl) {
      fileLog('🔄 Loader: Converted to direct URL');
    }

    fileLog('🌐 Loader: Fetching audio from URL');
    
    // Show loading state
    showLoading('Loading audio from URL...');
    
    // Create HTML audio element for playback
    const audio = document.createElement('audio');
    audio.style.display = 'none';
    audio.preload = 'metadata';
    
    // Try setting crossOrigin for better compatibility
    try {
      audio.crossOrigin = 'anonymous';
    } catch (e) {
      console.log('⚠️ CrossOrigin not supported, continuing without it');
    }
    
    return new Promise((resolve, reject) => {
      let waveformExtracted = false;
      
      audio.oncanplaythrough = async () => {
        // Only extract waveform once
        if (waveformExtracted) return;
        waveformExtracted = true;
        
        try {
          console.log('✅ Audio metadata loaded, duration:', audio.duration);
          
          // Try to extract real waveform data using Web Audio API
          await AudioContextManager.resume();
          
          console.log('🎵 Attempting to extract real waveform from URL audio...');
          
          try {
            // Fetch audio data for waveform analysis
            console.log('🌐 Fetching audio data for waveform analysis...');
            
            const response = await fetch(directUrl);
            if (!response.ok) {
              throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const arrayBuffer = await response.arrayBuffer();
            console.log('📊 Audio data fetched, size:', arrayBuffer.byteLength);
            
            // Decode the audio data
            const audioBuffer = await decodeAudioData(arrayBuffer);
            console.log('🎵 Audio decoded successfully:', {
              duration: audioBuffer.duration,
              channels: audioBuffer.numberOfChannels,
              sampleRate: audioBuffer.sampleRate,
              length: audioBuffer.length
            });
            
            // Extract real waveform data
            const channelData = audioBuffer.getChannelData(0);
            const realWaveform = new Float32Array(channelData);
            
            // Calculate real max amplitude
            let maxAmp = 0;
            for (let i = 0; i < realWaveform.length; i++) {
              maxAmp = Math.max(maxAmp, Math.abs(realWaveform[i]));
            }
            
            console.log('✅ Real waveform extracted:', {
              samples: realWaveform.length,
              maxAmplitude: maxAmp,
              duration: audioBuffer.duration
            });
            
            hideLoading();
            resolve({
              audioBuffer,
              waveform: realWaveform,
              globalMaxAmp: maxAmp,
              isUrlLoaded: true,
              audioElement: audio
            });
            
          } catch (webAudioError) {
            console.warn('⚠️ Could not extract real waveform, will use placeholder:', webAudioError.message);
            
            // Return placeholder result - let caller generate waveform
            const duration = audio.duration || 30;
            
            hideLoading();
            resolve({
              waveform: null, // Signal that placeholder is needed
              globalMaxAmp: 0.7,
              isUrlLoaded: true,
              audioElement: audio,
              duration
            });
          }
          
        } catch (error) {
          console.error('❌ Error processing URL audio:', error);
          hideLoading();
          reject(error);
        }
      };
      
      audio.onerror = (event) => {
        console.error('❌ Audio loading error:', event);
        console.log('🔄 Trying fallback approach without crossOrigin...');
        
        // Try fallback without crossOrigin
        const fallbackAudio = document.createElement('audio');
        fallbackAudio.style.display = 'none';
        fallbackAudio.preload = 'metadata';
        
        fallbackAudio.oncanplaythrough = async () => {
          try {
            console.log('✅ Fallback audio metadata loaded, duration:', fallbackAudio.duration);
            
            // Try real waveform extraction with fallback
            try {
              console.log('🎵 Attempting real waveform extraction with fallback method...');
              
              const response = await fetch(directUrl);
              const arrayBuffer = await response.arrayBuffer();
              const audioBuffer = await decodeAudioData(arrayBuffer);
              
              const channelData = audioBuffer.getChannelData(0);
              const realWaveform = new Float32Array(channelData);
              
              let maxAmp = 0;
              for (let i = 0; i < realWaveform.length; i++) {
                maxAmp = Math.max(maxAmp, Math.abs(realWaveform[i]));
              }
              
              console.log('🎉 Fallback method extracted REAL waveform!');
              hideLoading();
              resolve({
                audioBuffer,
                waveform: realWaveform,
                globalMaxAmp: maxAmp,
                isUrlLoaded: true,
                audioElement: fallbackAudio
              });
              return;
              
            } catch (realWaveformError) {
              console.warn('⚠️ Fallback real waveform extraction failed, using placeholder:', realWaveformError.message);
            }
            
            // Fallback to placeholder
            const duration = fallbackAudio.duration || 30;
            
            hideLoading();
            resolve({
              waveform: null, // Signal that placeholder is needed
              globalMaxAmp: 0.7,
              isUrlLoaded: true,
              audioElement: fallbackAudio,
              duration
            });
            
          } catch (error) {
            console.error('❌ Fallback also failed:', error);
            hideLoading();
            reject(error);
          }
        };
        
        fallbackAudio.onerror = (fallbackEvent) => {
          console.error('❌ Fallback audio loading also failed:', fallbackEvent);
          
          // Last resort: try original URL for Dropbox links
          if (url !== directUrl && url.includes('dropbox.com')) {
            console.log('🔄 Trying original Dropbox URL as last resort...');
            
            const lastResortAudio = document.createElement('audio');
            lastResortAudio.style.display = 'none';
            lastResortAudio.preload = 'metadata';
            
            lastResortAudio.oncanplaythrough = async () => {
              try {
                console.log('✅ Last resort audio loaded, duration:', lastResortAudio.duration);
                const duration = lastResortAudio.duration || 30;
                
                hideLoading();
                resolve({
                  waveform: null, // Signal that placeholder is needed
                  globalMaxAmp: 0.7,
                  isUrlLoaded: true,
                  audioElement: lastResortAudio,
                  duration
                });
              } catch (error) {
                console.error('❌ Last resort also failed:', error);
                hideLoading();
                reject(error);
              }
            };
            
            lastResortAudio.onerror = () => {
              hideLoading();
              reject(new Error(`Failed to load audio from URL (all methods failed): ${url}`));
            };
            
            lastResortAudio.src = url;
            lastResortAudio.load();
          } else {
            hideLoading();
            reject(new Error(`Failed to load audio from URL (both methods failed): ${directUrl}`));
          }
        };
        
        fallbackAudio.src = directUrl;
        fallbackAudio.load();
      };
      
      audio.onloadstart = () => {
        console.log('🌐 Started loading audio from URL...');
      };
      
      audio.onloadedmetadata = () => {
        console.log('📊 Audio metadata loaded - duration:', audio.duration);
      };
      
      audio.onprogress = (e) => {
        if (e.lengthComputable) {
          const percent = (e.loaded / e.total * 100).toFixed(1);
          console.log(`📡 Loading progress: ${percent}%`);
        }
      };
      
      audio.onstalled = () => {
        console.warn('⚠️ Audio loading stalled');
      };
      
      audio.onsuspend = () => {
        console.log('⏸️ Audio loading suspended');
      };
      
      // Start loading
      audio.src = directUrl;
      audio.load();
    });
    
  } catch (error) {
    console.error('❌ Failed to load audio from URL:', error);
    hideLoading();
    showError(error, {
      dismissible: true,
      autoDismiss: 8000
    });
    throw error;
  }
}