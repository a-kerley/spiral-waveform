import { initializeAudio, loadAudioForPlayback, playAudio, pauseAudio, seekTo, getCurrentTime, isAudioPlaying, isScrubbingActive, setVolume, cleanupAudio } from './audio-playback.js';
import { getAudioState, setAudioBuffer, setPlayhead, setPlayingState, resetAudioState } from './audio-state.js';
import { handleFileSelect } from './audio-loader.js';
import { createUI, setupKeyboardControls } from './ui-controls.js';
import { setupFileInput, handleFileLoad } from './file-handler.js';
import { initializeCanvas, setupResponsiveCanvas } from './canvas-setup.js';
import { setupInteraction } from './interaction.js';
import { createAnimationLoop } from './animation.js';
import { drawRadialWaveform, drawPlayPauseButton, resetPlayheadAnimation } from './waveform-draw.js';
import { CONFIG } from './utils.js';
import { updatePlayheadFromAudio } from './audio-controls.js'; // Add this import
// Duplicate class declaration removed
export class SpiralWaveformPlayer {
  // ✅ NEW: Generate realistic placeholder waveform
  _generateRealisticWaveform(channelData, sampleRate) {
    const length = channelData.length;
    
    for (let i = 0; i < length; i++) {
      const time = i / sampleRate;
      
      // Create multiple frequency components like real music
      let sample = 0;
      
      // Bass frequencies (20-250 Hz)
      sample += Math.sin(time * 60 * Math.PI * 2) * 0.4 * Math.random();
      sample += Math.sin(time * 120 * Math.PI * 2) * 0.3 * Math.random();
      
      // Mid frequencies (250-4000 Hz) 
      sample += Math.sin(time * 440 * Math.PI * 2) * 0.2 * Math.random();
      sample += Math.sin(time * 880 * Math.PI * 2) * 0.15 * Math.random();
      sample += Math.sin(time * 1760 * Math.PI * 2) * 0.1 * Math.random();
      
      // High frequencies (4000+ Hz)
      sample += Math.sin(time * 3520 * Math.PI * 2) * 0.05 * Math.random();
      
      // Add musical structure (verses, chorus, etc.)
      const sectionTime = time % 30; // 30-second sections
      const sectionEnvelope = Math.sin(sectionTime / 30 * Math.PI) * 0.8 + 0.2;
      
      // Add beat patterns (4/4 time at ~120 BPM)
      const beatTime = (time * 2) % 1; // 2 beats per second = 120 BPM
      const beatEnvelope = Math.pow(Math.sin(beatTime * Math.PI), 0.3);
      
      // Combine with realistic amplitude variations
      const dynamicRange = 0.3 + 0.7 * Math.sin(time * 0.1) * Math.sin(time * 0.03);
      
      // Apply envelopes and normalize
      sample = sample * sectionEnvelope * beatEnvelope * dynamicRange;
      
      // Add some noise for realism
      sample += (Math.random() - 0.5) * 0.02;
      
      // Clamp to reasonable range
      channelData[i] = Math.max(-0.8, Math.min(0.8, sample));
    }
  }

  // Load audio from a URL (supports direct links, Dropbox, etc.)
  async loadFromUrl(url) {
    try {
      // Enhanced Dropbox URL handling for modern sharing links
      let directUrl = url;
      
      // Handle different Dropbox URL formats
      if (url.includes('dropbox.com')) {
        console.log('🔗 Detected Dropbox URL, converting to direct download...');
        
        // Modern Dropbox sharing links: /scl/fi/ format
        if (url.includes('/scl/fi/')) {
          // Method 1: Try the raw.githubusercontent-style approach
          const rawUrl = url.replace('www.dropbox.com', 'dl.dropboxusercontent.com')
                            .replace('dropbox.com', 'dl.dropboxusercontent.com')
                            .replace('?rlkey=', '?raw=1&rlkey=')
                            .replace('dl=1', 'raw=1');
          
          console.log('🔄 Trying raw Dropbox URL:', rawUrl);
          directUrl = rawUrl;
        }
        // Legacy method: Ensure dl=1 parameter
        else {
          if (url.includes('dl=0')) {
            directUrl = url.replace('dl=0', 'dl=1');
          } else if (!url.includes('dl=1')) {
            directUrl = url + (url.includes('?') ? '&' : '?') + 'dl=1';
          }
        }
        
        console.log('🔄 Converted Dropbox URL:', directUrl);
      }

      console.log('🌐 Loading audio from URL:', directUrl);
      
      // WaveSurfer approach: Use HTML audio element for MediaElement backend
      return new Promise((resolve, reject) => {
        const audio = document.createElement('audio');
        audio.style.display = 'none';
        audio.preload = 'metadata';
        
        // Try setting crossOrigin for better compatibility, but don't require it
        try {
          audio.crossOrigin = 'anonymous';
        } catch (e) {
          console.log('⚠️ CrossOrigin not supported, continuing without it');
        }
        
        audio.oncanplaythrough = async () => {
          try {
            console.log('✅ Audio metadata loaded, duration:', audio.duration);
            
            // Now try to extract real waveform data using Web Audio API
            if (!window.audioContext) {
              window.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            }
            
            // Resume audio context if needed
            if (window.audioContext.state === 'suspended') {
              await window.audioContext.resume();
            }
            
            console.log('🎵 Attempting to extract real waveform from URL audio...');
            
            try {
              // For real waveform extraction, we need to use fetch to get the raw audio data
              // We'll avoid creating MediaElementSource to keep HTML audio playback simple
              console.log('🌐 Fetching audio data for waveform analysis...');
              
              const response = await fetch(directUrl);
              if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
              }
              
              const arrayBuffer = await response.arrayBuffer();
              console.log('📊 Audio data fetched, size:', arrayBuffer.byteLength);
              
              // Decode the audio data
              const audioBuffer = await window.audioContext.decodeAudioData(arrayBuffer);
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
              
              // Store the HTML audio element for actual playback (keep it simple)
              this._urlAudioElement = audio;
              window.urlAudioElement = audio;
              
              // Create result object with REAL waveform data
              const result = {
                audioBuffer: audioBuffer,
                waveform: realWaveform,
                globalMaxAmp: maxAmp,
                isUrlLoaded: true
              };
              
              // Use existing file loading system for visualization
              await this._onFileLoaded(result);
              
              console.log('🎉 Successfully loaded URL audio with REAL waveform data!');
              resolve();
              
            } catch (webAudioError) {
              console.warn('⚠️ Could not extract real waveform, falling back to placeholder:', webAudioError.message);
              
              // Fallback to placeholder waveform if Web Audio extraction fails
              const duration = audio.duration || 30;
              const sampleRate = 44100;
              const length = Math.floor(duration * sampleRate);
              
              const audioBuffer = window.audioContext.createBuffer(1, length, sampleRate);
              const channelData = audioBuffer.getChannelData(0);
              
              // Generate realistic waveform using shared function
              this._generateRealisticWaveform(channelData, sampleRate);
              
              // Store the HTML audio element for actual playback
              this._urlAudioElement = audio;
              window.urlAudioElement = audio;
              
              // Create result object for visualization
              const result = {
                audioBuffer: audioBuffer,
                waveform: channelData,
                globalMaxAmp: 0.7,
                isUrlLoaded: true
              };
              
              await this._onFileLoaded(result);
              console.log('✅ Successfully loaded audio from URL with placeholder waveform');
              resolve();
            }
            
          } catch (error) {
            console.error('❌ Error processing URL audio:', error);
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
          // Don't set crossOrigin for fallback
          
          fallbackAudio.oncanplaythrough = async () => {
            try {
              console.log('✅ Fallback audio metadata loaded, duration:', fallbackAudio.duration);
              
              // Try to extract real waveform from fallback audio too
              try {
                console.log('🎵 Attempting real waveform extraction with fallback method...');
                
                const response = await fetch(directUrl);
                const arrayBuffer = await response.arrayBuffer();
                const audioBuffer = await window.audioContext.decodeAudioData(arrayBuffer);
                
                const channelData = audioBuffer.getChannelData(0);
                const realWaveform = new Float32Array(channelData);
                
                let maxAmp = 0;
                for (let i = 0; i < realWaveform.length; i++) {
                  maxAmp = Math.max(maxAmp, Math.abs(realWaveform[i]));
                }
                
                this._urlAudioElement = fallbackAudio;
                window.urlAudioElement = fallbackAudio;
                
                const result = {
                  audioBuffer: audioBuffer,
                  waveform: realWaveform,
                  globalMaxAmp: maxAmp,
                  isUrlLoaded: true
                };
                
                await this._onFileLoaded(result);
                console.log('🎉 Fallback method extracted REAL waveform!');
                resolve();
                return;
                
              } catch (realWaveformError) {
                console.warn('⚠️ Fallback real waveform extraction failed, using placeholder:', realWaveformError.message);
              }
              
              // Fallback to placeholder if real extraction fails
              const duration = fallbackAudio.duration || 30;
              const sampleRate = 44100;
              const length = Math.floor(duration * sampleRate);
              
              if (!window.audioContext) {
                window.audioContext = new (window.AudioContext || window.webkitAudioContext)();
              }
              
              const audioBuffer = window.audioContext.createBuffer(1, length, sampleRate);
              const channelData = audioBuffer.getChannelData(0);
              
              // Generate realistic waveform using shared function
              this._generateRealisticWaveform(channelData, sampleRate);
              
              // Store fallback audio element
              this._urlAudioElement = fallbackAudio;
              window.urlAudioElement = fallbackAudio;
              
              const result = {
                audioBuffer: audioBuffer,
                waveform: channelData,
                globalMaxAmp: 0.7,
                isUrlLoaded: true
              };
              
              await this._onFileLoaded(result);
              console.log('✅ Successfully loaded audio from URL with fallback method');
              resolve();
              
            } catch (error) {
              console.error('❌ Fallback also failed:', error);
              reject(error);
            }
          };
          
          fallbackAudio.onerror = (fallbackEvent) => {
            console.error('❌ Fallback audio loading also failed:', fallbackEvent);
            
            // Third attempt: try original URL if it was a Dropbox link
            if (url !== directUrl && url.includes('dropbox.com')) {
              console.log('🔄 Trying original Dropbox URL as last resort...');
              
              const lastResortAudio = document.createElement('audio');
              lastResortAudio.style.display = 'none';
              lastResortAudio.preload = 'metadata';
              
              lastResortAudio.oncanplaythrough = async () => {
                try {
                  console.log('✅ Last resort audio loaded, duration:', lastResortAudio.duration);
                  
                  const duration = lastResortAudio.duration || 30;
                  const sampleRate = 44100;
                  const length = Math.floor(duration * sampleRate);
                  
                  if (!window.audioContext) {
                    window.audioContext = new (window.AudioContext || window.webkitAudioContext)();
                  }
                  
                  const audioBuffer = window.audioContext.createBuffer(1, length, sampleRate);
                  const channelData = audioBuffer.getChannelData(0);
                  
                  // Generate realistic waveform using shared function
                  this._generateRealisticWaveform(channelData, sampleRate);
                  
                  this._urlAudioElement = lastResortAudio;
                  window.urlAudioElement = lastResortAudio;
                  
                  const result = {
                    audioBuffer: audioBuffer,
                    waveform: channelData,
                    globalMaxAmp: 0.7,
                    isUrlLoaded: true
                  };
                  
                  await this._onFileLoaded(result);
                  console.log('✅ Successfully loaded audio with original URL');
                  resolve();
                  
                } catch (error) {
                  console.error('❌ Last resort also failed:', error);
                  reject(error);
                }
              };
              
              lastResortAudio.onerror = () => {
                reject(new Error(`Failed to load audio from URL (all methods failed): ${url}`));
              };
              
              lastResortAudio.src = url; // Try original URL
              lastResortAudio.load();
            } else {
              reject(new Error(`Failed to load audio from URL (both methods failed): ${directUrl}`));
            }
          };
          
          // Try loading with fallback
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
      this._showError(error);
    }
  }
  constructor(options = {}) {
    this.options = options;
    this.container = options.container || document.body;
    this.visualState = {
      isTransitioning: false,
      transitionStartTime: 0,
      animationProgress: 0,
      lastStateChange: 0,
      isDragging: false,
      wasPlaying: false,
      isEndOfFileReset: false,
      endOfFileResetStartTime: null
    };
    this.canvas = null;
    this.ctx = null;
    this.drawCallback = null;
    this.fileInput = null;
    this.ui = null;
    this._init();
  }

  async _init() {
    try {
      await initializeAudio();
      // Enhanced UI: add a URL input for Dropbox/direct links
      this.ui = createUI(this.container);
      const urlInput = document.createElement('input');
      urlInput.type = 'text';
      urlInput.placeholder = 'Paste audio URL (Dropbox, direct, etc.)';
      urlInput.id = 'urlInput';
      urlInput.style.margin = '12px auto';
      urlInput.style.width = '80%';
      urlInput.style.padding = '8px';
      urlInput.style.fontSize = '16px';
      this.container.appendChild(urlInput);

      const urlButton = document.createElement('button');
      urlButton.textContent = 'Load from URL';
      urlButton.style.margin = '8px auto';
      urlButton.style.padding = '8px 16px';
      urlButton.style.fontSize = '16px';
      this.container.appendChild(urlButton);

      urlButton.addEventListener('click', async () => {
        const url = urlInput.value.trim();
        if (url) {
          await this.loadFromUrl(url);
        }
      });
      this.fileInput = setupFileInput(this.container, this._onFileLoaded.bind(this));
      const canvasObj = initializeCanvas();
      this.canvas = canvasObj.canvas;
      this.ctx = canvasObj.ctx;
      this.container.appendChild(this.canvas);
      setupKeyboardControls({
        onPlayPause: this.togglePlayPause.bind(this),
        onSeekBackward: () => this.seekRelative(-5),
        onSeekForward: () => this.seekRelative(5)
      });
      this.drawCallback = this._draw.bind(this);
      setupInteraction(this.canvas, this.visualState, this.drawCallback, {
        onPlayPause: this.togglePlayPause.bind(this),
        onSeek: this.seekToPosition.bind(this)
      });

      // ✅ Only call createAnimationLoop ONCE, then start it
      const animate = createAnimationLoop(this._draw.bind(this), this.visualState);
      animate(performance.now());

      window.addEventListener('resize', () => {
        setupResponsiveCanvas(this.canvas, this.ctx);
        this._draw();
      });
    } catch (error) {
      this._showError(error);
    }
  }

  async _onFileLoaded(result) {
    if (result) {
      this._loggedMissingData = false; // Reset the logging flag
      
      // Clear URL audio reference when loading a file (not URL)
      if (!result.isUrlLoaded) {
        if (window.urlAudioElement) {
          window.urlAudioElement.pause();
          window.urlAudioElement = null;
        }
        if (this._urlAudioElement) {
          this._urlAudioElement.pause();
          this._urlAudioElement = null;
        }
      }
      
      setAudioBuffer(result.audioBuffer, result.waveform, result.globalMaxAmp);
      await loadAudioForPlayback(result.audioBuffer);
      resetPlayheadAnimation();
      this.drawCallback();
    }
  }

  async loadFile(file) {
    const event = { target: { files: [file] } };
    await handleFileLoad(event, this._onFileLoaded.bind(this));
  }

  togglePlayPause() {
    const audioState = getAudioState();
    if (!audioState.audioBuffer) return;
    if (audioState.isPlaying) {
      pauseAudio();
      setPlayingState(false);
    } else {
      playAudio(audioState.currentPlayhead).then(success => {
        if (success) setPlayingState(true);
      });
    }
    this.drawCallback();
  }

  seekToPosition(normalizedPosition) {
    const audioState = getAudioState();
    if (!audioState.audioBuffer) return;
    const clampedPosition = Math.max(0, Math.min(1, normalizedPosition));
    const targetTime = clampedPosition * audioState.duration;
    setPlayhead(targetTime);
    seekTo(targetTime);
    this.drawCallback();
  }

  seekRelative(deltaSeconds) {
    const audioState = getAudioState();
    if (!audioState.audioBuffer) return;
    const newTime = audioState.currentPlayhead + deltaSeconds;
    const clampedTime = Math.max(0, Math.min(newTime, audioState.duration));
    setPlayhead(clampedTime);
    seekTo(clampedTime);
    this.drawCallback();
  }

  setVolume(volume) {
    setVolume(volume);
  }

  cleanup() {
    cleanupAudio();
    resetAudioState();
    if (this.canvas && this.canvas.parentNode) {
      this.canvas.parentNode.removeChild(this.canvas);
    }
    if (this.fileInput && this.fileInput.parentNode) {
      this.fileInput.parentNode.removeChild(this.fileInput);
    }
    this.ui = null;
    this.canvas = null;
    this.ctx = null;
    this.fileInput = null;
  }

  _draw() {
    const audioState = getAudioState();

    // ✅ Update playhead from audio during playback (not scrubbing)
    if (audioState.isPlaying && !isScrubbingActive()) {
      updatePlayheadFromAudio();
    }

    if (audioState.waveform && audioState.audioBuffer) {
      const combinedState = { ...this.visualState, ...audioState };
      
      drawRadialWaveform(
        this.ctx,
        this.canvas,
        audioState.waveform,
        audioState.duration > 0 ? audioState.currentPlayhead / audioState.duration : 0,
        audioState.isPlaying,
        combinedState
      );
      // Note: drawPlayPauseButton is called inside drawRadialWaveform
    } else {
      // Only log missing data once per load attempt
      if (!this._loggedMissingData) {
        console.warn('⚠️ Waveform not available:', {
          hasWaveform: !!audioState.waveform,
          hasAudioBuffer: !!audioState.audioBuffer
        });
        this._loggedMissingData = true;
      }
      
      // Still draw the play button even without waveform data
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      
      // Set up coordinate system for button
      this.ctx.setTransform(1, 0, 0, 1, 0, 0);
      const dpr = window.devicePixelRatio || 1;
      this.ctx.scale(dpr, dpr);
      
      const width = this.canvas.width / dpr;
      const height = this.canvas.height / dpr;
      
      drawPlayPauseButton(
        this.ctx,
        width / 2,
        height / 2,
        Math.min(width, height) * CONFIG.BUTTON_RADIUS_RATIO,
        audioState.isPlaying
      );
    }
  }

  _showError(error) {
    this.container.innerHTML = `<h1>Error: ${error.message}</h1><p>Check the console for details.</p>`;
    console.error(error);
  }
}
