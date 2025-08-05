// Add this at the very top to catch all errors
window.addEventListener('error', (event) => {
  // Use basic console for critical errors before logger is initialized
  console.error('🚨 Global error caught:', event.error);
});

window.addEventListener('unhandledrejection', (event) => {
  // Use basic console for critical errors before logger is initialized
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
import logger, { system, canvas as canvasLog, ui, file, audio, interaction, animation } from './logger.js';
import { CanvasValidation, InteractionValidation, ValidationError } from './validation.js';

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
  endOfFileResetStartTime: null,
  // ✅ NEW: Drag state properties for resize preservation
  dragCurrentPosition: null,
  dragStartAngle: null,
  dragStartPlayhead: null
};

// ✅ ENHANCED: Canvas state validation utility with type checking
function validateCanvasState() {
  const issues = [];
  
  try {
    if (!canvas) {
      issues.push('Canvas element is missing');
    } else {
      // ✅ NEW: Type validation for canvas
      try {
        CanvasValidation.validateCanvas(canvas, 'main canvas');
      } catch (error) {
        if (error instanceof ValidationError) {
          issues.push(`Canvas validation failed: ${error.message}`);
        } else {
          issues.push('Canvas type validation error');
        }
      }
    }
    
    if (!ctx) {
      issues.push('Canvas context is missing');
    } else {
      // ✅ NEW: Type validation for canvas context
      try {
        CanvasValidation.validateCanvasContext(ctx, 'main canvas context');
        // Test if context is still valid
        ctx.save();
        ctx.restore();
      } catch (error) {
        if (error instanceof ValidationError) {
          issues.push(`Canvas context validation failed: ${error.message}`);
        } else {
          issues.push('Canvas context is invalid or corrupted');
        }
      }
    }
    
    if (!drawCallback) {
      issues.push('Draw callback function is missing');
    } else {
      // ✅ NEW: Type validation for draw callback
      try {
        InteractionValidation.validateCallback(drawCallback, 'draw callback');
      } catch (error) {
        if (error instanceof ValidationError) {
          issues.push(`Draw callback validation failed: ${error.message}`);
        }
      }
    }
    
    if (issues.length > 0) {
      canvasLog('Canvas state validation issues: ' + issues.join(', '), 'warn', issues);
      return false;
    }
    
    return true;
  } catch (error) {
    canvasLog('Canvas state validation error', 'error', error);
    return false;
  }
}

// Add these at the top of your file
let canvas, ctx, drawCallback;

// Initialize application
async function init() {
  try {
    // Initialize audio system
    audio('Initializing audio system...');
    logger.time('audio-initialization', 'audio');
    await initializeAudio();
    logger.timeEnd('audio-initialization', 'audio');
    audio('Audio initialized successfully');

    // Continue with rest of initialization...
    ui('Setting up UI components...');
    const container = document.querySelector('.container');
    if (!container) {
      throw new Error('Container element not found!');
    }
    
    createUI(container);
    ui('UI created successfully');
    
    // Setup file input FIRST (before canvas)
    file('Setting up file input handler...');
    setupFileInput(container);
    file('File input created successfully');
    
    // Initialize canvas AFTER file input
    canvasLog('Initializing canvas...');
    logger.time('canvas-initialization', 'canvas');
    const canvasObj = initializeCanvas();
    canvas = canvasObj.canvas;
    ctx = canvasObj.ctx;
    if (!canvas || !ctx) {
      throw new Error('Canvas initialization failed!');
    }
    container.appendChild(canvas);
    logger.timeEnd('canvas-initialization', 'canvas');
    canvasLog('Canvas created and added to container');

    // Setup keyboard controls
    ui('Setting up keyboard controls...');
    setupKeyboardControls({
      onPlayPause: togglePlayPause,
      onSeekBackward: () => seekRelative(-5),
      onSeekForward: () => seekRelative(5)
    });
    ui('Keyboard controls configured successfully');

    // Enhanced draw callback
    drawCallback = () => {
      const audioState = getAudioState();
      
      // ✅ NEW: Debug logging for waveform drawing issues
      console.log('🎨 Draw callback debug:', {
        hasWaveform: !!audioState.waveform,
        waveformLength: audioState.waveform ? audioState.waveform.length : 0,
        hasAudioBuffer: !!audioState.audioBuffer,
        audioBufferDuration: audioState.audioBuffer ? audioState.audioBuffer.duration : 'N/A',
        currentPlayhead: audioState.currentPlayhead,
        isPlaying: audioState.isPlaying,
        visualStateKeys: Object.keys(visualState),
        combinedStateKeys: audioState.waveform && audioState.audioBuffer ? Object.keys({ ...visualState, ...audioState }) : 'N/A'
      });
      
      if (audioState.waveform && audioState.audioBuffer) {
        // Update playhead from audio
        updatePlayheadFromAudio();
        
        const normalizedPlayhead = audioState.duration > 0 ? 
          audioState.currentPlayhead / audioState.duration : 0;
        const combinedState = { ...visualState, ...audioState };
        
        console.log('🖼️ About to draw waveform with:', {
          normalizedPlayhead,
          combinedStateAudioBuffer: !!combinedState.audioBuffer,
          combinedStateWaveform: !!combinedState.waveform,
          combinedStateGlobalMaxAmp: combinedState.globalMaxAmp
        });
        
        drawRadialWaveform(ctx, canvas, audioState.waveform, normalizedPlayhead, audioState.isPlaying, combinedState);
      } else {
        console.warn('⚠️ Cannot draw waveform - missing data:', {
          hasWaveform: !!audioState.waveform,
          hasAudioBuffer: !!audioState.audioBuffer
        });
        // Clear canvas if no audio loaded
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    };

    // Setup interaction
    interaction('Setting up user interaction handlers...');
    setupInteraction(canvas, visualState, drawCallback, {
      onPlayPause: togglePlayPause,
      onSeek: seekToPosition
    });
    interaction('Interaction handlers configured successfully');

    // Start animation loop
    animation('Starting animation loop...');
    const animate = createAnimationLoop(drawCallback, visualState);
    animate(performance.now());
    animation('Animation loop started successfully');

    system('Spiral Waveform initialized successfully', 'info');
    
  } catch (error) {
    system('Initialization failed', 'error', error);
    logger.error('Error stack trace', 'system', error.stack);
    // Display error on page
    const container = document.querySelector('.container');
    if (container) {
      container.innerHTML = `<h1>Error: ${error.message}</h1><p>Check the console for details.</p>`;
    }
  }
}

init().catch(error => {
  system('Init function failed', 'error', error);
});

// ✅ IMPROVED: Enhanced canvas resize handling with state preservation
let resizeTimeout = null;
let isResizing = false;
let lastCanvasSize = { width: 0, height: 0 };

function handleCanvasResize() {
  if (!canvas || !ctx) {
    canvasLog('Canvas not available for resize', 'warn');
    return;
  }

  // ✅ NEW: Prevent excessive resize operations
  if (isResizing) {
    canvasLog('Resize already in progress, skipping', 'debug');
    return;
  }

  isResizing = true;
  logger.time('canvas-resize', 'canvas');

  try {
    // ✅ NEW: Validate canvas state before resize
    if (!validateCanvasState()) {
      canvasLog('Canvas state invalid before resize, attempting recovery...', 'error');
      // Try to recover by reinitializing canvas
      try {
        const container = document.querySelector('.container');
        if (container && canvas) {
          const canvasObj = initializeCanvas();
          const oldCanvas = canvas;
          canvas = canvasObj.canvas;
          ctx = canvasObj.ctx;
          container.replaceChild(canvas, oldCanvas);
          canvasLog('Canvas recovered successfully', 'info');
        }
      } catch (recoveryError) {
        canvasLog('Canvas recovery failed', 'error', recoveryError);
        isResizing = false;
        return;
      }
    }

    // ✅ NEW: Preserve current canvas content before resize
    let currentImageData = null;
    try {
      currentImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    } catch (imageError) {
      canvasLog('Could not preserve canvas image data', 'warn', imageError);
    }
    
    const audioState = getAudioState();
    
    // ✅ NEW: Store current animation and visual state
    const preservedState = {
      animationProgress: visualState.animationProgress,
      isTransitioning: visualState.isTransitioning,
      transitionStartTime: visualState.transitionStartTime,
      isDragging: visualState.isDragging,
      dragCurrentPosition: visualState.dragCurrentPosition,
      dragStartAngle: visualState.dragStartAngle,
      dragStartPlayhead: visualState.dragStartPlayhead,
      lastStateChange: visualState.lastStateChange,
      wasPlaying: visualState.wasPlaying,
      isEndOfFileReset: visualState.isEndOfFileReset,
      endOfFileResetStartTime: visualState.endOfFileResetStartTime
    };

    canvasLog('Resizing canvas with state preservation...', 'info');
    
    // ✅ IMPROVED: Setup responsive canvas with validation
    const oldSize = { width: canvas.width, height: canvas.height };
    setupResponsiveCanvas(canvas, ctx);
    const newSize = { width: canvas.width, height: canvas.height };
    
    // ✅ NEW: Check if size actually changed
    if (oldSize.width === newSize.width && oldSize.height === newSize.height) {
      canvasLog('Canvas size unchanged, skipping redraw', 'debug');
      isResizing = false;
      return;
    }
    
    canvasLog(`Canvas resized: ${oldSize.width}x${oldSize.height} → ${newSize.width}x${newSize.height}`, 'info');
    lastCanvasSize = newSize;
    
    // ✅ NEW: Validate canvas state after resize
    if (!validateCanvasState()) {
      throw new Error('Canvas state invalid after resize');
    }
    
    // ✅ NEW: Restore preserved visual state
    Object.assign(visualState, preservedState);
    
    // ✅ NEW: Adjust transition timing if actively transitioning
    if (visualState.isTransitioning) {
      // Recalculate transition timing to maintain smooth animation
      const currentTime = performance.now();
      const elapsedTransition = currentTime - visualState.transitionStartTime;
      visualState.transitionStartTime = currentTime - elapsedTransition;
      animation('Adjusted transition timing for resize', 'debug');
    }
    
    // ✅ IMPROVED: Force immediate redraw with proper state
    if (drawCallback) {
      drawCallback();
      canvasLog('Canvas redrawn after resize', 'info');
    } else {
      canvasLog('No draw callback available for resize redraw', 'warn');
    }

    // ✅ NEW: Final validation
    if (!validateCanvasState()) {
      canvasLog('Canvas state invalid after resize completion', 'error');
    }

  } catch (error) {
    canvasLog('Error during canvas resize', 'error', error);
    
    // ✅ NEW: Comprehensive error recovery
    try {
      canvasLog('Attempting resize error recovery...', 'info');
      
      // Reset canvas if needed
      if (!validateCanvasState()) {
        const container = document.querySelector('.container');
        if (container) {
          const canvasObj = initializeCanvas();
          const oldCanvas = canvas;
          canvas = canvasObj.canvas;
          ctx = canvasObj.ctx;
          if (oldCanvas && oldCanvas.parentNode) {
            container.replaceChild(canvas, oldCanvas);
          } else {
            container.appendChild(canvas);
          }
          canvasLog('Canvas recreated during error recovery', 'info');
        }
      }
      
      // Fallback redraw attempt
      if (drawCallback && validateCanvasState()) {
        drawCallback();
        canvasLog('Fallback redraw completed', 'info');
      }
    } catch (fallbackError) {
      canvasLog('Resize error recovery also failed', 'error', fallbackError);
      // At this point, we may need user intervention or page reload
      system('Critical canvas failure - may require page reload', 'error');
    }
  } finally {
    logger.timeEnd('canvas-resize', 'canvas');
    isResizing = false;
  }
}

// ✅ IMPROVED: Debounced resize handler to prevent excessive redraws
function debouncedResize() {
  // Clear existing timeout
  if (resizeTimeout) {
    clearTimeout(resizeTimeout);
  }
  
  // ✅ NEW: Immediate feedback for better UX
  if (canvas && ctx) {
    // Quick size update without full redraw
    const dpr = window.devicePixelRatio || 1;
    const padding = 24 * 2;
    const size = Math.min(window.innerWidth - padding, window.innerHeight - padding);
    canvas.style.width = size + 'px';
    canvas.style.height = size + 'px';
  }
  
  // ✅ NEW: Debounced full resize operation
  resizeTimeout = setTimeout(() => {
    handleCanvasResize();
    resizeTimeout = null;
  }, 150); // 150ms debounce for good responsiveness vs performance balance
}

// ✅ IMPROVED: Multiple resize event handlers for better coverage
window.addEventListener('resize', debouncedResize);

// ✅ NEW: Handle orientation changes on mobile devices
window.addEventListener('orientationchange', () => {
  system('Orientation changed', 'debug');
  // Delay to allow for orientation change to complete
  setTimeout(() => {
    debouncedResize();
  }, 100);
});

// ✅ NEW: Handle browser zoom changes
let lastDevicePixelRatio = window.devicePixelRatio || 1;
function checkPixelRatioChange() {
  const currentRatio = window.devicePixelRatio || 1;
  if (Math.abs(currentRatio - lastDevicePixelRatio) > 0.1) {
    system(`Device pixel ratio changed: ${lastDevicePixelRatio} → ${currentRatio}`, 'debug');
    lastDevicePixelRatio = currentRatio;
    debouncedResize();
  }
}

// ✅ NEW: Check for pixel ratio changes periodically (for zoom detection)
setInterval(checkPixelRatioChange, 1000);

// ✅ NEW: Handle fullscreen changes
document.addEventListener('fullscreenchange', () => {
  system('Fullscreen state changed', 'debug');
  setTimeout(debouncedResize, 100);
});

// ✅ NEW: Handle visibility changes (when tab becomes visible again)
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && canvas && ctx) {
    system('Page became visible, checking canvas state', 'debug');
    // Redraw when page becomes visible in case something changed
    setTimeout(() => {
      if (drawCallback) {
        drawCallback();
      }
    }, 50);
  }
});

// ✅ NEW: Export resize function for manual triggering
window.forceCanvasResize = handleCanvasResize;