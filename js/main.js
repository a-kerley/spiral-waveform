// Add this at the very top to catch all errors
window.addEventListener('error', (event) => {
  console.error('🚨 Global error caught:', event.error);
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('🚨 Unhandled promise rejection:', event.reason);
});

import { initializeCanvas, setupResponsiveCanvas } from './canvas-setup.js';
import { drawRadialWaveform } from './waveform-draw.js';
import { setupInteraction } from './interaction.js';
import { createAnimationLoop } from './animation.js';
import { initializeAudio } from './audio-playback.js';
import { setupFileInput } from './file-handler.js';
import { createUI, setupKeyboardControls } from './ui-controls.js';
import { togglePlayPause, seekToPosition, seekRelative, updatePlayheadFromAudio } from './audio-controls.js';
import { getAudioState } from './audio-state.js';

// UI/Visual state (separate from audio state)
const visualState = {
  isTransitioning: false,
  transitionStartTime: 0,
  animationProgress: 0,
  lastStateChange: 0,
  isDragging: false,
  wasPlaying: false,
  // ✅ NEW: End-of-file reset state
  isEndOfFileReset: false,
  endOfFileResetStartTime: null
};

// Add these at the top of your file
let canvas, ctx, drawCallback;

// Initialize application
async function init() {
  try {
    // Initialize audio system
    console.log('🎵 Initializing audio...');
    await initializeAudio();
    console.log('✅ Audio initialized successfully');

    // Continue with rest of initialization...
    console.log('🎨 Setting up UI...');
    const container = document.querySelector('.container');
    if (!container) {
      throw new Error('Container element not found!');
    }
    
    createUI(container);
    console.log('✅ UI created');
    
    // Setup file input FIRST (before canvas)
    console.log('📁 Setting up file input...');
    setupFileInput(container);
    console.log('✅ File input created');
    
    // Initialize canvas AFTER file input
    console.log('🖼️ Initializing canvas...');
    const canvasObj = initializeCanvas();
    canvas = canvasObj.canvas;
    ctx = canvasObj.ctx;
    if (!canvas || !ctx) {
      throw new Error('Canvas initialization failed!');
    }
    container.appendChild(canvas);
    console.log('✅ Canvas created and added to container');

    // Setup keyboard controls
    console.log('⌨️ Setting up keyboard controls...');
    setupKeyboardControls({
      onPlayPause: togglePlayPause,
      onSeekBackward: () => seekRelative(-5),
      onSeekForward: () => seekRelative(5)
    });
    console.log('✅ Keyboard controls set up');

    // Enhanced draw callback
    drawCallback = () => {
      const audioState = getAudioState();
      
      if (audioState.waveform && audioState.audioBuffer) {
        // Update playhead from audio
        updatePlayheadFromAudio();
        
        const normalizedPlayhead = audioState.duration > 0 ? 
          audioState.currentPlayhead / audioState.duration : 0;
        const combinedState = { ...visualState, ...audioState };
        
        drawRadialWaveform(ctx, canvas, audioState.waveform, normalizedPlayhead, audioState.isPlaying, combinedState);
      } else {
        // Clear canvas if no audio loaded
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    };

    // Setup interaction
    console.log('🖱️ Setting up interaction...');
    setupInteraction(canvas, visualState, drawCallback, {
      onPlayPause: togglePlayPause,
      onSeek: seekToPosition
    });
    console.log('✅ Interaction set up');

    // Start animation loop
    console.log('🎬 Starting animation loop...');
    const animate = createAnimationLoop(drawCallback, visualState);
    animate(performance.now());
    console.log('✅ Animation loop started');

    console.log('✅ Spiral Waveform initialized successfully');
    
  } catch (error) {
    console.error('❌ Initialization failed:', error);
    console.error('❌ Error stack:', error.stack);
    // Display error on page
    const container = document.querySelector('.container');
    if (container) {
      container.innerHTML = `<h1>Error: ${error.message}</h1><p>Check the console for details.</p>`;
    }
  }
}

init().catch(error => {
  console.error('❌ Init function failed:', error);
});

// Handle window resize
window.addEventListener('resize', () => {
  setupResponsiveCanvas(canvas, ctx);
  drawCallback();
});