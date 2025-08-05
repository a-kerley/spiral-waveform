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
  // Load audio from a URL (supports direct links, Dropbox, etc.)
  async loadFromUrl(url) {
    try {
      // Only replace dl=0 with dl=1 for Dropbox links
      let directUrl = url;
      const dropboxRegex = /^https?:\/\/(www\.)?dropbox\.com\/scl\/fi\/(.+)/;
      if (dropboxRegex.test(url)) {
        directUrl = directUrl.replace('dl=0', 'dl=1');
      }

      // Create or reuse <audio> element
      if (!this.audioEl) {
        this.audioEl = document.createElement('audio');
        this.audioEl.controls = true;
        this.audioEl.style.display = 'block';
        this.audioEl.style.margin = '16px auto';
        this.container.appendChild(this.audioEl);

        // Optional: connect to Web Audio for visualization
        this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        this.sourceNode = this.audioCtx.createMediaElementSource(this.audioEl);
        this.sourceNode.connect(this.audioCtx.destination);
      }

      this.audioEl.src = directUrl;
      this.audioEl.load();

      // When metadata is loaded, you can extract waveform data if needed
      this.audioEl.onloadedmetadata = () => {
        // You can visualize using Web Audio API here if desired
        // For simple playback, nothing else is needed
      };

      // Optionally auto-play
      // this.audioEl.play();

      // Redraw UI if needed
      this.drawCallback();
    } catch (error) {
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
