import { initializeAudio, loadAudioForPlayback, playAudio, pauseAudio, seekTo, getCurrentTime, isAudioPlaying, isScrubbingActive, setVolume, cleanupAudio } from './audio-playback.js';
import { getAudioState, setAudioBuffer, setPlayhead, setPlayingState, resetAudioState } from './audio-state.js';
import { handleFileSelect } from './audio-loader.js';
import { createUI, setupKeyboardControls } from './ui-controls.js';
import { setupFileInput, handleFileLoad } from './file-handler.js';
import { initializeCanvas, setupResponsiveCanvas } from './canvas-setup.js';
import { setupInteraction } from './interaction.js';
import { createAnimationLoop } from './animation.js';
import { drawRadialWaveform, drawPlayPauseButton, resetPlayheadAnimation, layerManager } from './waveform-draw.js';
import { CONFIG } from './utils.js';
import { updatePlayheadFromAudio } from './audio-controls.js';
import { AudioUrlUtils, toDirectUrl, sanitizeUrl } from './audio-url-utils.js';
import { showError, showLoading, hideLoading } from './error-ui.js';
import { AudioContextManager, createAudioBuffer, decodeAudioData } from './audio-context-manager.js';
import { SettingsManager, loadSettings, updateSetting } from './settings-manager.js';
import { enablePerformanceMonitoring, printPerformanceReport, performanceMonitor } from './performance-monitor.js';
import { performanceOverlay } from './performance-overlay.js';
import { screenReaderAnnouncer, KeyboardNavigationManager, AriaManager } from './accessibility.js';
import logger, { system, audio as audioLog, ui, file as fileLog } from './logger.js';

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
      fileLog('🔗 Player: Loading from URL', 'info', { url: url.substring(0, 100) });
      
      // Dispose of previous audio to free memory
      const { disposeAudio } = await import('./memory-manager.js');
      await disposeAudio();
      
      // Sanitize and validate URL
      const sanitizedUrl = sanitizeUrl(url);
      const urlType = AudioUrlUtils.detectUrlType(sanitizedUrl);
      
      fileLog('� Player: URL type detected', 'info', { type: AudioUrlUtils.describeUrl(sanitizedUrl) });
      
      // Convert sharing URLs to direct download URLs
      const directUrl = toDirectUrl(sanitizedUrl);
      
      if (directUrl !== sanitizedUrl) {
        fileLog('🔄 Player: Converted to direct URL');
      }

      fileLog('🌐 Player: Fetching audio from URL');
      
      // Show loading state
      showLoading('Loading audio from URL...');
      
      // WaveSurfer approach: Use HTML audio element for MediaElement backend
      return new Promise((resolve, reject) => {
        const audio = document.createElement('audio');
        audio.style.display = 'none';
        audio.preload = 'metadata';
        
        // Guard to prevent multiple waveform extractions
        let waveformExtracted = false;
        
        // Try setting crossOrigin for better compatibility, but don't require it
        try {
          audio.crossOrigin = 'anonymous';
        } catch (e) {
          console.log('⚠️ CrossOrigin not supported, continuing without it');
        }
        
        audio.oncanplaythrough = async () => {
          // Only extract waveform once
          if (waveformExtracted) {
            return;
          }
          waveformExtracted = true;
          try {
            console.log('✅ Audio metadata loaded, duration:', audio.duration);
            
            // Now try to extract real waveform data using Web Audio API
            await AudioContextManager.resume();
            
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
              
              // Store the HTML audio element for actual playback (keep it simple)
              this._urlAudioElement = audio;
              
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
              hideLoading();
              resolve();
              
            } catch (webAudioError) {
              console.warn('⚠️ Could not extract real waveform, falling back to placeholder:', webAudioError.message);
              
              // Fallback to placeholder waveform if Web Audio extraction fails
              const duration = audio.duration || 30;
              const sampleRate = 44100;
              const length = Math.floor(duration * sampleRate);
              
              const audioBuffer = createAudioBuffer(1, length, sampleRate);
              const channelData = audioBuffer.getChannelData(0);
              
              // Generate realistic waveform using shared function
              this._generateRealisticWaveform(channelData, sampleRate);
              
              // Store the HTML audio element for actual playback
              this._urlAudioElement = audio;
              
              // Create result object for visualization
              const result = {
                audioBuffer: audioBuffer,
                waveform: channelData,
                globalMaxAmp: 0.7,
                isUrlLoaded: true
              };
              
              await this._onFileLoaded(result);
              console.log('✅ Successfully loaded audio from URL with placeholder waveform');
              hideLoading();
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
                const audioBuffer = await decodeAudioData(arrayBuffer);
                
                const channelData = audioBuffer.getChannelData(0);
                const realWaveform = new Float32Array(channelData);
                
                let maxAmp = 0;
                for (let i = 0; i < realWaveform.length; i++) {
                  maxAmp = Math.max(maxAmp, Math.abs(realWaveform[i]));
                }
                
                this._urlAudioElement = fallbackAudio;
                
                const result = {
                  audioBuffer: audioBuffer,
                  waveform: realWaveform,
                  globalMaxAmp: maxAmp,
                  isUrlLoaded: true
                };
                
                await this._onFileLoaded(result);
                console.log('🎉 Fallback method extracted REAL waveform!');
                hideLoading();
                resolve();
                return;
                
              } catch (realWaveformError) {
                console.warn('⚠️ Fallback real waveform extraction failed, using placeholder:', realWaveformError.message);
              }
              
              // Fallback to placeholder if real extraction fails
              const duration = fallbackAudio.duration || 30;
              const sampleRate = 44100;
              const length = Math.floor(duration * sampleRate);
              
              const audioBuffer = createAudioBuffer(1, length, sampleRate);
              const channelData = audioBuffer.getChannelData(0);
              
              // Generate realistic waveform using shared function
              this._generateRealisticWaveform(channelData, sampleRate);
              
              // Store fallback audio element
              this._urlAudioElement = fallbackAudio;
              
              const result = {
                audioBuffer: audioBuffer,
                waveform: channelData,
                globalMaxAmp: 0.7,
                isUrlLoaded: true
              };
              
              await this._onFileLoaded(result);
              console.log('✅ Successfully loaded audio from URL with fallback method');
              hideLoading();
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
                  
                  const audioBuffer = createAudioBuffer(1, length, sampleRate);
                  const channelData = audioBuffer.getChannelData(0);
                  
                  // Generate realistic waveform using shared function
                  this._generateRealisticWaveform(channelData, sampleRate);
                  
                  this._urlAudioElement = lastResortAudio;
                  
                  const result = {
                    audioBuffer: audioBuffer,
                    waveform: channelData,
                    globalMaxAmp: 0.7,
                    isUrlLoaded: true
                  };
                  
                  await this._onFileLoaded(result);
                  console.log('✅ Successfully loaded audio with original URL');
                  hideLoading();
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
    system('🎵 Player: Initializing SpiralWaveformPlayer', 'info', { options });
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
      system('🎵 Player: Starting initialization');
      await initializeAudio();
      
      // Load saved settings
      const settings = loadSettings();
      system('📋 Player: Loaded settings', 'info', { hasUrl: !!settings.lastUrl, hasFile: !!settings.lastFileName, volume: settings.volume });
      
      // Enhanced UI: add a URL input for Dropbox/direct links
      this.ui = createUI(this.container);
      const urlInput = document.createElement('input');
      urlInput.type = 'text';
      urlInput.placeholder = 'Paste audio URL (Dropbox, direct, etc.)';
      urlInput.id = 'urlInput';
      urlInput.className = 'url-input';
      
      // Restore last URL if available
      if (settings.lastUrl) {
        urlInput.value = settings.lastUrl;
        ui('🔄 Player: Restored last URL', 'info', { url: settings.lastUrl.substring(0, 50) + '...' });
      }
      
      this.container.appendChild(urlInput);
      
      // Show last loaded info with clear button
      if (settings.lastFileName || settings.lastUrl) {
        const lastLoadedInfo = document.createElement('div');
        lastLoadedInfo.className = 'last-loaded-info';
        
        const infoText = document.createElement('div');
        infoText.style.display = 'flex';
        infoText.style.alignItems = 'center';
        infoText.style.gap = 'var(--spacing-sm)';
        infoText.innerHTML = `
          <span class="last-loaded-label">Last loaded:</span>
          <span class="last-loaded-value">${settings.lastFileName || 'URL: ' + settings.lastUrl.substring(0, 50) + '...'}</span>
        `;
        
        const clearButton = document.createElement('button');
        clearButton.textContent = '×';
        clearButton.className = 'clear-settings-btn';
        clearButton.title = 'Clear saved settings';
        clearButton.addEventListener('click', () => {
          if (confirm('Clear all saved settings (URL, volume, etc.)?')) {
            SettingsManager.clear();
            urlInput.value = '';
            lastLoadedInfo.remove();
            ui('🗑️ Player: Settings cleared by user');
          }
        });
        
        lastLoadedInfo.appendChild(infoText);
        lastLoadedInfo.appendChild(clearButton);
        this.container.appendChild(lastLoadedInfo);
      }

      const urlButton = document.createElement('button');
      urlButton.textContent = 'Load from URL';
      urlButton.className = 'url-button';
      this.container.appendChild(urlButton);

      // Save URL when loading
      urlButton.addEventListener('click', async () => {
        const url = urlInput.value.trim();
        if (url) {
          ui('🔗 Player: URL load requested', 'info', { url: url.substring(0, 50) + '...' });
          updateSetting('lastUrl', url);
          await this.loadFromUrl(url);
        }
      });
      
      // Also save URL on Enter key
      urlInput.addEventListener('keypress', async (e) => {
        if (e.key === 'Enter') {
          const url = urlInput.value.trim();
          if (url) {
            ui('🔗 Player: URL load requested (Enter key)', 'info', { url: url.substring(0, 50) + '...' });
            updateSetting('lastUrl', url);
            await this.loadFromUrl(url);
          }
        }
      });
      
      this.fileInput = setupFileInput(this.container, this._onFileLoaded.bind(this));
      const canvasObj = initializeCanvas();
      this.canvas = canvasObj.canvas;
      this.ctx = canvasObj.ctx;
      this.container.appendChild(this.canvas);
      
      // Initialize accessibility features
      this._initializeAccessibility();
      
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
      system('🎬 Player: Animation loop started');

      window.addEventListener('resize', () => {
        ui('📐 Player: Window resized, updating canvas');
        setupResponsiveCanvas(this.canvas, this.ctx);
        this._draw();
      });
      
      // Restore saved volume
      if (settings.volume !== undefined) {
        this.setVolume(settings.volume);
        audioLog('🔊 Player: Restored volume', 'info', { volume: settings.volume });
      }
      
      system('✅ Player: Initialization complete');
    } catch (error) {
      system('❌ Player: Initialization failed', 'error', error);
      this._showError(error);
    }
  }

  /**
   * Initialize accessibility features
   */
  _initializeAccessibility() {
    // Setup keyboard navigation
    this.keyboardNav = new KeyboardNavigationManager();
    this.keyboardNav.initialize({
      togglePlayPause: () => this.togglePlayPause(),
      seekBackward: (seconds) => this.seekRelative(-seconds),
      seekForward: (seconds) => this.seekRelative(seconds),
      volumeUp: (amount) => {
        const audioState = getAudioState();
        this.setVolume(Math.min(1, audioState.volume + amount));
      },
      volumeDown: (amount) => {
        const audioState = getAudioState();
        this.setVolume(Math.max(0, audioState.volume - amount));
      },
      seekTo: (position) => this.seekToPosition(position),
      toggleMute: () => {
        const audioState = getAudioState();
        this.setVolume(audioState.volume > 0 ? 0 : 1);
      }
    });

    // Update canvas ARIA attributes
    const audioState = getAudioState();
    AriaManager.updateCanvasAria(this.canvas, audioState);
    
    // Make canvas focusable
    this.canvas.setAttribute('tabindex', '0');
  }

  async _onFileLoaded(result) {
    if (result) {
      fileLog('📂 Player: File loaded', 'info', { 
        fileName: result.fileName, 
        isUrl: result.isUrlLoaded,
        duration: result.audioBuffer?.duration,
        channels: result.audioBuffer?.numberOfChannels,
        samples: result.waveform?.length
      });
      
      this._loggedMissingData = false; // Reset the logging flag
      
      // Clear URL audio reference when loading a file (not URL)
      if (!result.isUrlLoaded) {
        if (this._urlAudioElement) {
          this._urlAudioElement.pause();
          this._urlAudioElement = null;
          window.urlAudioElement = null;
          audioLog('🔄 Player: Cleared URL audio element for file load');
        }
      } else {
        // Store URL audio element globally for playback
        window.urlAudioElement = this._urlAudioElement;
        audioLog('🎵 Player: Set global URL audio element for playback');
      }
      
      setAudioBuffer(result.audioBuffer, result.waveform, result.globalMaxAmp);
      await loadAudioForPlayback(result.audioBuffer);
      resetPlayheadAnimation();
      
      console.log('🎨 About to call drawCallback, checking state:', {
        hasDrawCallback: !!this.drawCallback,
        hasCanvas: !!this.canvas,
        hasCtx: !!this.ctx,
        canvasVisible: this.canvas ? (this.canvas.style.display !== 'none' && this.canvas.offsetParent !== null) : false,
        canvasWidth: this.canvas?.width,
        canvasHeight: this.canvas?.height
      });
      
      this.drawCallback();
      
      // Announce loaded audio
      const audioState = getAudioState();
      if (result.fileName) {
        screenReaderAnnouncer.announceLoadComplete(result.fileName, audioState.duration);
      }
      
      fileLog('✅ Player: File ready for playback', 'info', { duration: audioState.duration });
    }
  }

  async loadFile(file) {
    fileLog('📥 Player: Loading file', 'info', { name: file.name, size: file.size, type: file.type });
    const event = { target: { files: [file] } };
    await handleFileLoad(event, this._onFileLoaded.bind(this));
    
    // Save filename
    if (file && file.name) {
      updateSetting('lastFileName', file.name);
      fileLog('💾 Player: Saved filename', 'info', { fileName: file.name });
    }
  }

  togglePlayPause() {
    const audioState = getAudioState();
    
    if (!audioState.audioBuffer) {
      audioLog('⚠️ Player: Play/pause ignored - no audio loaded');
      return;
    }
    if (audioState.isPlaying) {
      audioLog('⏸️ Player: Pausing', 'info', { position: audioState.currentPlayhead.toFixed(2) });
      pauseAudio();
      setPlayingState(false);
      screenReaderAnnouncer.announcePlayState(false, audioState.currentPlayhead, audioState.duration);
    } else {
      audioLog('▶️ Player: Playing', 'info', { position: audioState.currentPlayhead.toFixed(2) });
      playAudio(audioState.currentPlayhead).then(success => {
        if (success) {
          setPlayingState(true);
          screenReaderAnnouncer.announcePlayState(true, audioState.currentPlayhead, audioState.duration);
        } else {
          audioLog('❌ Player: Play failed', 'warn');
        }
      });
    }
    this.drawCallback();
    
    // Update ARIA attributes
    AriaManager.updateCanvasAria(this.canvas, getAudioState());
  }

  seekToPosition(normalizedPosition) {
    const audioState = getAudioState();
    if (!audioState.audioBuffer) {
      audioLog('⚠️ Player: Seek ignored - no audio loaded');
      return;
    }
    const clampedPosition = Math.max(0, Math.min(1, normalizedPosition));
    const targetTime = clampedPosition * audioState.duration;
    audioLog('⏩ Player: Seeking', 'info', { 
      from: audioState.currentPlayhead.toFixed(2), 
      to: targetTime.toFixed(2),
      percent: (clampedPosition * 100).toFixed(1) + '%'
    });
    setPlayhead(targetTime);
    seekTo(targetTime);
    this.drawCallback();
    
    // Announce seek position
    screenReaderAnnouncer.announceSeek(targetTime, audioState.duration);
    
    // Update ARIA attributes
    AriaManager.updateCanvasAria(this.canvas, getAudioState());
  }

  seekRelative(deltaSeconds) {
    const audioState = getAudioState();
    if (!audioState.audioBuffer) {
      audioLog('⚠️ Player: Relative seek ignored - no audio loaded');
      return;
    }
    const newTime = audioState.currentPlayhead + deltaSeconds;
    const clampedTime = Math.max(0, Math.min(newTime, audioState.duration));
    audioLog('⏭️ Player: Relative seek', 'info', { 
      delta: deltaSeconds > 0 ? '+' + deltaSeconds : deltaSeconds,
      from: audioState.currentPlayhead.toFixed(2),
      to: clampedTime.toFixed(2)
    });
    setPlayhead(clampedTime);
    seekTo(clampedTime);
    this.drawCallback();
  }

  setVolume(volume) {
    audioLog('🔊 Player: Volume set', 'info', { volume: (volume * 100).toFixed(0) + '%' });
    setVolume(volume);
    // Save volume setting
    updateSetting('volume', volume);
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

    console.log('🎨 _draw called:', {
      hasWaveform: !!audioState.waveform,
      waveformLength: audioState.waveform?.length,
      hasAudioBuffer: !!audioState.audioBuffer,
      duration: audioState.duration,
      currentPlayhead: audioState.currentPlayhead,
      isPlaying: audioState.isPlaying
    });

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
      
      console.log('⚠️ Drawing fallback (no waveform data)');
      
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
    // Hide any loading state
    hideLoading();
    
    // Show styled error overlay
    showError(error, {
      dismissible: true,
      autoDismiss: 8000
    });
    
    console.error(error);
  }
}

// Export debug helpers for browser console
if (typeof window !== 'undefined') {
  window.getLayerStats = () => layerManager.getStats();
  window.resetLayerStats = () => layerManager.resetStats();
  window.enablePerformanceMonitor = () => enablePerformanceMonitoring();
  window.printPerformanceReport = () => printPerformanceReport();
  window.getPerformanceReport = () => performanceMonitor.getReport();
}

// Auto-enable performance monitoring (can be disabled via console)
enablePerformanceMonitoring();
