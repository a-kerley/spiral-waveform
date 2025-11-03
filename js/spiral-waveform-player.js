import { initializeAudio, loadAudioForPlayback, cleanupAudio, isScrubbingActive } from './audio-playback.js';
import { togglePlayPause as audioTogglePlayPause, seekToPosition as audioSeekToPosition, seekRelative as audioSeekRelative, setVolume as audioSetVolume, updatePlayheadFromAudio } from './audio-controls.js';
import { getAudioState, setAudioBuffer, resetAudioState } from './audio-state.js';
import { loadAudioFromUrl } from './audio-loader.js';
import { generatePlaceholderWaveform } from './waveform-data.js';
import { createUI, setupKeyboardControls } from './ui-controls.js';
import { setupFileInput, handleFileLoad } from './file-handler.js';
import { initializeCanvas, setupResponsiveCanvas } from './canvas-setup.js';
import { setupInteraction } from './interaction.js';
import { createAnimationLoop } from './animation.js';
import { drawRadialWaveform, drawPlayPauseButton, resetPlayheadAnimation, layerManager } from './waveform-draw.js';
import { CONFIG } from './utils.js';
import { showError, hideLoading } from './error-ui.js';
import { createAudioBuffer } from './audio-context-manager.js';
import { SettingsManager, loadSettings, updateSetting } from './settings-manager.js';
import { enablePerformanceMonitoring, printPerformanceReport, performanceMonitor } from './performance-monitor.js';
import { performanceOverlay } from './performance-overlay.js';
import { screenReaderAnnouncer, KeyboardNavigationManager, AriaManager } from './accessibility.js';
import logger, { system, audio as audioLog, ui, file as fileLog } from './logger.js';

export class SpiralWaveformPlayer {
  /**
   * Load audio from a URL (supports direct links, Dropbox, etc.)
   * Delegates to audio-loader.js and handles placeholder waveform generation if needed
   */
  async loadFromUrl(url) {
    try {
      // Use centralized loader
      const loaderResult = await loadAudioFromUrl(url);
      
      // Store audio element on instance (not global)
      this._urlAudioElement = loaderResult.audioElement;
      
      // If waveform is null, need to generate placeholder
      let waveform = loaderResult.waveform;
      let audioBuffer = loaderResult.audioBuffer;
      
      if (!waveform) {
        // Generate placeholder waveform
        const duration = loaderResult.duration || 30;
        const sampleRate = 44100;
        const length = Math.floor(duration * sampleRate);
        
        audioBuffer = createAudioBuffer(1, length, sampleRate);
        const channelData = audioBuffer.getChannelData(0);
        
        // Use centralized placeholder generator
        const placeholderWaveform = generatePlaceholderWaveform(length, sampleRate, duration);
        channelData.set(placeholderWaveform);
        waveform = channelData;
        
        fileLog('� Player: Generated placeholder waveform', 'info', { samples: length, duration });
      }
      
      // Create result object for visualization
      const result = {
        audioBuffer,
        waveform,
        globalMaxAmp: loaderResult.globalMaxAmp || 0.7,
        isUrlLoaded: true
      };
      
      // Use existing file loading system for visualization
      await this._onFileLoaded(result);
      
      fileLog('✅ Player: URL audio loaded successfully');
      
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
      
      // Add test file button
      const testFileButton = document.createElement('button');
      testFileButton.textContent = 'Load Test File';
      testFileButton.className = 'test-file-button';
      testFileButton.title = 'Load local test audio file';
      this.container.appendChild(testFileButton);
      
      testFileButton.addEventListener('click', async () => {
        const testFilePath = 'assets/test-audio/09. Machines in the Ruins.ogg';
        // Convert relative path to absolute URL
        const testFileUrl = new URL(testFilePath, window.location.origin).href;
        ui('🎵 Player: Test file load requested', 'info', { url: testFileUrl });
        urlInput.value = testFileUrl;
        updateSetting('lastUrl', testFileUrl);
        await this.loadFromUrl(testFileUrl);
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
          
          // DEPRECATED: Sync window global for backwards compatibility
          if (typeof window !== 'undefined') {
            window.urlAudioElement = null;
          }
          
          audioLog('🔄 Player: Cleared URL audio element for file load');
        }
      } else {
        // Keep audio element on instance
        audioLog('🎵 Player: URL audio element stored on player instance');
        
        // DEPRECATED: Sync window global for backwards compatibility
        // TODO: Remove after audio-playback.js and audio-state-adapter.js are refactored
        if (typeof window !== 'undefined') {
          window.urlAudioElement = this._urlAudioElement;
          if (!this._deprecationWarningShown) {
            console.warn('⚠️ DEPRECATED: window.urlAudioElement is deprecated. Use player.getUrlAudioElement() instead.');
            this._deprecationWarningShown = true;
          }
        }
      }
      
      setAudioBuffer(result.audioBuffer, result.waveform, result.globalMaxAmp);
      await loadAudioForPlayback(result.audioBuffer);
      resetPlayheadAnimation();
      
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

  async togglePlayPause() {
    const audioState = getAudioState();
    
    // Delegate to audio-controls.js for state management and playback
    const wasPlaying = audioState.isPlaying;
    const success = await audioTogglePlayPause();
    
    // Handle accessibility announcements
    if (success !== wasPlaying) {
      const newState = getAudioState();
      screenReaderAnnouncer.announcePlayState(newState.isPlaying, newState.currentPlayhead, newState.duration);
    }
    
    // Update visual representation
    this.drawCallback();
    
    // Update ARIA attributes
    AriaManager.updateCanvasAria(this.canvas, getAudioState());
  }

  seekToPosition(normalizedPosition) {
    // Delegate to audio-controls.js for state management and seeking
    const success = audioSeekToPosition(normalizedPosition);
    
    if (success) {
      const audioState = getAudioState();
      // Announce seek position
      screenReaderAnnouncer.announceSeek(audioState.currentPlayhead, audioState.duration);
      
      // Update visual representation
      this.drawCallback();
      
      // Update ARIA attributes
      AriaManager.updateCanvasAria(this.canvas, audioState);
    }
  }

  seekRelative(deltaSeconds) {
    // Delegate to audio-controls.js for state management and seeking
    const success = audioSeekRelative(deltaSeconds);
    
    if (success) {
      // Update visual representation
      this.drawCallback();
    }
  }

  setVolume(volume) {
    // Delegate to audio-controls.js for validation and volume setting
    const actualVolume = audioSetVolume(volume);
    // Save volume setting
    updateSetting('volume', actualVolume);
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
    // Hide any loading state
    hideLoading();
    
    // Show styled error overlay
    showError(error, {
      dismissible: true,
      autoDismiss: 8000
    });
    
    console.error(error);
  }
  
  /**
   * Debug method to access URL audio element (dev only)
   * Exposes internal audio element for debugging without polluting globals
   * @returns {HTMLAudioElement|null}
   */
  getUrlAudioElement() {
    return this._urlAudioElement || null;
  }
}

// Export debug helpers for browser console
if (typeof window !== 'undefined') {
  window.getLayerStats = () => layerManager.getStats();
  window.resetLayerStats = () => layerManager.resetStats();
  window.enablePerformanceMonitor = () => enablePerformanceMonitoring();
  window.printPerformanceReport = () => printPerformanceReport();
  window.getPerformanceReport = () => performanceMonitor.getReport();
  
  // Store player instance for debug access
  window._debugPlayerInstance = null;
  window.getUrlAudioElement = () => window._debugPlayerInstance?.getUrlAudioElement() || null;
}

// Auto-enable performance monitoring (can be disabled via console)
enablePerformanceMonitoring();
