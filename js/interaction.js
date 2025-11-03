import { CONFIG } from './utils.js';
import { getAudioState } from './audio-state.js';
import { startScrubbing, updateScrubbing, stopScrubbing, isAudioPlaying, isScrubbingActive, getScrubState } from './audio-playback.js';
import { InteractionValidation, CanvasValidation, ValidationError, TypeValidator, safeExecute, ensureType } from './validation.js';
import { interaction, system } from './logger.js';
import { CanvasCoordinates, getCanvasCoordinates, toPolarCoordinates, calculateDistance, calculateAngle } from './canvas-math.js';
import { renderState, RenderComponents } from './render-state.js';
import { syncInteractionWithScrubState, stopDragging as cleanupDragStateAdapter } from './interaction-state-adapter.js';

// ✅ MIGRATION NOTE: syncInteractionWithScrubState and cleanupDragState now come from interaction-state-adapter.js
// This ensures interaction state is managed through StateManager

// Helper function for backward compatibility with visualState parameter
function cleanupDragState(state) {
  cleanupDragStateAdapter();
  // Also update the passed visualState object for backward compatibility
  state.isDragging = false;
  state.dragCurrentPosition = undefined;
  state.dragStartAngle = undefined;
  state.dragStartPlayhead = undefined;
  state.lastSeekTime = undefined;
  state.dragWasPlaying = undefined;
  state.lastDragPosition = undefined;
  state.lastDragTime = undefined;
  state.lastStateChange = performance.now();
}

export function setupInteraction(canvas, state, drawCallback, audioCallbacks = {}) {
  try {
    // ✅ NEW: Comprehensive input validation
    CanvasValidation.validateCanvas(canvas, 'setupInteraction canvas');
    
    // ✅ FIXED: Just check that the required property exists, allow other properties
    if (!TypeValidator.isObject(state) || !('isDragging' in state)) {
      throw new ValidationError('Invalid interaction state: must be an object with isDragging property', 'interaction state', state, 'object');
    }
    
    InteractionValidation.validateCallback(drawCallback, 'draw callback');
    
    if (!TypeValidator.isObject(audioCallbacks)) {
      system('Invalid audioCallbacks object in setupInteraction', 'warn', audioCallbacks);
      audioCallbacks = {};
    }
    
    // ✅ NEW: Validate audio callbacks
    const validCallbacks = {};
    if (audioCallbacks.onPlayPause) {
      try {
        InteractionValidation.validateCallback(audioCallbacks.onPlayPause, 'onPlayPause callback');
        validCallbacks.onPlayPause = audioCallbacks.onPlayPause;
      } catch (error) {
        system('Invalid onPlayPause callback, skipping', 'warn', error);
      }
    }
    
    if (audioCallbacks.onSeek) {
      try {
        InteractionValidation.validateCallback(audioCallbacks.onSeek, 'onSeek callback');
        validCallbacks.onSeek = audioCallbacks.onSeek;
      } catch (error) {
        system('Invalid onSeek callback, skipping', 'warn', error);
      }
    }

    // ✅ NEW: Add touch-specific state tracking with validation
    let touchStartTime = 0;
    let touchStartPosition = null;
    const TAP_MAX_DURATION = ensureType(CONFIG.TAP_MAX_DURATION, TypeValidator.isPositiveInteger, 300);
    const TAP_MAX_DISTANCE = ensureType(CONFIG.TAP_MAX_DISTANCE, TypeValidator.isPositiveInteger, 10);
    
    // ✅ NEW: Validated event handlers
    const safeHandleMouseDown = (e) => safeExecute(
      () => handleMouseDown(e, canvas, state, drawCallback, validCallbacks),
      null,
      'mousedown handler'
    );
    
    const safeHandleMouseMove = (e) => safeExecute(
      () => handleMouseMove(e, canvas, state, drawCallback, validCallbacks),
      null,
      'mousemove handler'
    );
    
    const safeHandleMouseUp = (e) => safeExecute(
      () => handleMouseUp(e, canvas, state, drawCallback, validCallbacks),
      null,
      'mouseup handler'
    );
    
    const safeHandleMouseLeave = () => safeExecute(
      () => handleMouseLeave(state, drawCallback),
      null,
      'mouseleave handler'
    );
    
    canvas.addEventListener('mousedown', safeHandleMouseDown);
    canvas.addEventListener('mousemove', safeHandleMouseMove);
    canvas.addEventListener('mouseup', safeHandleMouseUp);
    canvas.addEventListener('mouseleave', safeHandleMouseLeave);
    
    // ✅ IMPROVED: Enhanced touch support with better state tracking and validation
    canvas.addEventListener('touchstart', (e) => {
      try {
        e.preventDefault();
        
        // ✅ NEW: Validate touch event
        if (!e.touches || e.touches.length === 0) {
          interaction('Invalid touch event: no touches', 'warn');
          return;
        }
        
        // ✅ NEW: Track touch start for tap detection with validation
        touchStartTime = performance.now();
        const touch = e.touches[0];
        
        if (!TypeValidator.isNumber(touch.clientX) || !TypeValidator.isNumber(touch.clientY)) {
          interaction('Invalid touch coordinates', 'warn', { x: touch.clientX, y: touch.clientY });
          return;
        }
        
        touchStartPosition = { x: touch.clientX, y: touch.clientY };
        
        const mouseEvent = new MouseEvent('mousedown', {
          clientX: touch.clientX,
          clientY: touch.clientY
        });
        safeHandleMouseDown(mouseEvent);
      } catch (error) {
        system('Error in touchstart handler', 'error', error);
      }
    });
  
  // ✅ ADD: Touch event throttling for better performance
  let lastTouchTime = 0;
  const touchThrottle = 16; // ~60fps
  
  canvas.addEventListener('touchmove', (e) => {
    e.preventDefault();
    
    const now = performance.now();
    if (now - lastTouchTime < touchThrottle) return;
    lastTouchTime = now;
    
    if (state.isDragging) {
      const touch = e.touches[0];
      const mouseEvent = new MouseEvent('mousemove', {
        clientX: touch.clientX,
        clientY: touch.clientY
      });
      handleMouseMove(mouseEvent, canvas, state, drawCallback, audioCallbacks);
    }
  });
  
  canvas.addEventListener('touchend', (e) => {
    e.preventDefault();
    
    // ✅ IMPROVED: Handle both dragging and non-dragging touch end events
    if (state.isDragging) {
      // Handle drag end with proper touch coordinates
      if (e.changedTouches && e.changedTouches.length > 0) {
        const touch = e.changedTouches[0];
        const mouseEvent = new MouseEvent('mouseup', {
          clientX: touch.clientX,
          clientY: touch.clientY
        });
        handleMouseUp(mouseEvent, canvas, state, drawCallback, audioCallbacks);
      } else {
        // Fallback if no touch coordinates available
        handleMouseUp(e, canvas, state, drawCallback, audioCallbacks);
      }
    } else {
      // ✅ IMPROVED: Handle touch end when not dragging (tap events) with better detection
      if (e.changedTouches && e.changedTouches.length > 0) {
        const touch = e.changedTouches[0];
        const touchEndTime = performance.now();
        const touchDuration = touchEndTime - touchStartTime;
        
        // ✅ NEW: Calculate touch distance for tap detection
        let touchDistance = 0;
        if (touchStartPosition) {
          touchDistance = calculateDistance(
            touch.clientX, touch.clientY,
            touchStartPosition.x, touchStartPosition.y
          );
        }
        
        // ✅ NEW: Only handle as tap if it was quick and didn't move much
        if (touchDuration <= TAP_MAX_DURATION && touchDistance <= TAP_MAX_DISTANCE) {
          const { x, y } = getCanvasCoordinates({
            clientX: touch.clientX,
            clientY: touch.clientY
          }, canvas);
          
          const dpr = window.devicePixelRatio || 1;
          const width = canvas.width / dpr;
          const height = canvas.height / dpr;
          const cx = width / 2;
          const cy = height / 2;
          
          const buttonRadius = Math.min(width, height) * CONFIG.BUTTON_RADIUS_RATIO;
          const buttonDistance = calculateDistance(x, y, cx, cy);
          
          // ✅ NEW: Handle tap on play button
          if (buttonDistance <= buttonRadius) {
            interaction('🎵 Play button tapped');
            if (audioCallbacks.onPlayPause) {
              interaction('📞 Calling onPlayPause callback');
              audioCallbacks.onPlayPause();
            } else {
              interaction('⚠️ No onPlayPause callback available');
            }
          }
          // ✅ NEW: Handle tap on waveform (seek functionality)
          else {
            const distance = calculateDistance(x, y, cx, cy);
            const waveformInnerRadius = buttonRadius + Math.min(width, height) * CONFIG.WAVEFORM_GAP_RATIO;
            const maxWaveformThickness = Math.min(width, height) * CONFIG.WAVEFORM_THICKNESS_RATIO;
            const waveformOuterRadius = waveformInnerRadius + maxWaveformThickness;
            
            if (distance >= waveformInnerRadius && distance <= waveformOuterRadius) {
              // Calculate tap position and seek
              const tapAngle = calculateAngleFromMouse(x, y, cx, cy);
              const tapPosition = tapAngle / (Math.PI * 2);
              
              if (audioCallbacks.onSeek) {
                audioCallbacks.onSeek(tapPosition);
              }
            }
          }
        }
        
        // ✅ NEW: Reset touch tracking state
        touchStartTime = 0;
        touchStartPosition = null;
      }
    }
  });
  
  // ✅ NEW: Handle touch cancel events (e.g., when user scrolls or app loses focus)
  canvas.addEventListener('touchcancel', (e) => {
    e.preventDefault();
    
    // Clean up any ongoing drag operation
    if (state.isDragging) {
      interaction('🚫 Interaction: Touch cancelled - cleaning up');
      handleMouseLeave(state, drawCallback);
    }
    
    // Reset touch tracking state
    touchStartTime = 0;
    touchStartPosition = null;
  });
  
  } catch (error) {
    system('Error in setupInteraction', 'error', error);
    throw error;
  }
}

function calculateAngleFromMouse(x, y, cx, cy) {
  // Use shared canvas math utility for consistent angle calculation
  return calculateAngle(x, y, cx, cy);
}

function handleMouseDown(event, canvas, state, drawCallback, audioCallbacks) {
  // ✅ NEW: Sync states before starting new interaction
  syncInteractionWithScrubState(state);
  
  const { x, y } = getCanvasCoordinates(event, canvas);
  
  const dpr = window.devicePixelRatio || 1;
  const width = canvas.width / dpr;
  const height = canvas.height / dpr;
  const cx = width / 2;
  const cy = height / 2;
  
  const buttonRadius = Math.min(width, height) * CONFIG.BUTTON_RADIUS_RATIO;
  const buttonDistance = calculateDistance(x, y, cx, cy);
  
  if (buttonDistance <= buttonRadius) {
    interaction('🖱️ Interaction: Button clicked');
    if (audioCallbacks.onPlayPause) {
      audioCallbacks.onPlayPause();
    }
  } else {
    const distance = calculateDistance(x, y, cx, cy);
    const waveformInnerRadius = buttonRadius + Math.min(width, height) * CONFIG.WAVEFORM_GAP_RATIO;
    const maxWaveformThickness = Math.min(width, height) * CONFIG.WAVEFORM_THICKNESS_RATIO;
    const waveformOuterRadius = waveformInnerRadius + maxWaveformThickness;
    
    if (distance >= waveformInnerRadius && distance <= waveformOuterRadius) {
      const audioState = getAudioState();
      const currentPlayhead = audioState.duration > 0 ? 
        audioState.currentPlayhead / audioState.duration : 0;
      
      // ✅ IMPROVED: Start scrubbing with better error handling
      try {
        const wasPlaying = startScrubbing(currentPlayhead);
        
        // ✅ IMPROVED: Validate scrubbing started successfully
        if (!isScrubbingActive()) {
          system('❌ Interaction: Failed to start scrubbing', 'error');
          return;
        }
        
        // ✅ UPDATED: Log scrubbing mode for clarity
        if (wasPlaying) {
          interaction('🖱️ Interaction: Drag started (audio scrubbing)', 'info');
        } else {
          interaction('🖱️ Interaction: Drag started (silent)', 'info');
        }
        
        // Store drag state - ensure consistency with scrubbing state
        state.isDragging = true;
        state.dragWasPlaying = wasPlaying;
        state.lastStateChange = performance.now();
        
        // Mark components dirty when dragging starts
        renderState.markDirty(RenderComponents.PLAYHEAD);
        renderState.markDirty(RenderComponents.UI);
        
        // Force transition to focus view if not already there
        if (state.animationProgress < 1 && !state.isTransitioning) {
          state.isTransitioning = true;
          state.transitionStartTime = performance.now() - (state.animationProgress * 1000);
        }
        
        // Store drag tracking info
        const initialMouseAngle = calculateAngleFromMouse(x, y, cx, cy);
        state.dragStartAngle = initialMouseAngle;
        state.dragStartPlayhead = currentPlayhead;
        state.dragCurrentPosition = currentPlayhead;
        state.lastDragPosition = currentPlayhead;
        state.lastDragTime = performance.now();
        
        drawCallback();
      } catch (error) {
        system('❌ Interaction: Error starting scrubbing', 'error', error);
        cleanupDragState(state);
      }
    }
  }
}

function handleMouseMove(event, canvas, state, drawCallback, audioCallbacks = {}) {
  // ✅ NEW: Validate state consistency before processing
  if (!state.isDragging) return;
  
  if (!isScrubbingActive()) {
    interaction('⚠️ Interaction: Inconsistent state - dragging without scrubbing', 'warn');
    cleanupDragState(state);
    drawCallback();
    return;
  }
  
  const { x, y } = getCanvasCoordinates(event, canvas);
  
  const dpr = window.devicePixelRatio || 1;
  const width = canvas.width / dpr;
  const height = canvas.height / dpr;
  const cx = width / 2;
  const cy = height / 2;
  
  // Calculate current mouse angle and position
  const currentMouseAngle = calculateAngleFromMouse(x, y, cx, cy);
  let deltaAngle = currentMouseAngle - state.dragStartAngle;
  
  // Handle wrap-around
  if (deltaAngle > Math.PI) {
    deltaAngle -= Math.PI * 2;
  } else if (deltaAngle < -Math.PI) {
    deltaAngle += Math.PI * 2;
  }
  
  const deltaPosition = deltaAngle / (Math.PI * 2);
  let newPosition = state.dragStartPlayhead + deltaPosition;
  newPosition = Math.max(0, Math.min(1, newPosition));
  
  // ✅ IMPROVED: Calculate velocity for scrubbing with validation
  const now = performance.now();
  const timeDelta = (now - (state.lastDragTime || now)) / 1000; // Convert to seconds
  const positionDelta = newPosition - (state.lastDragPosition || newPosition);
  
  if (timeDelta > 0) {
    const velocity = positionDelta / timeDelta; // Normalized position change per second
    
    // ✅ IMPROVED: Update scrubbing with error handling
    try {
      const success = updateScrubbing(velocity, newPosition);
      if (!success) {
        interaction('⚠️ Interaction: Scrub update failed', 'warn');
        return;
      }
      
      // Store for next calculation only if update succeeded
      state.lastDragPosition = newPosition;
      state.lastDragTime = now;
    } catch (error) {
      system('❌ Interaction: Error updating scrubbing', 'error', error);
      // Don't break the drag operation for update errors
    }
  }
  
  // Store for visual feedback
  state.dragCurrentPosition = newPosition;
  
  drawCallback();
}

function handleMouseUp(event, canvas, state, drawCallback, audioCallbacks = {}) {
  if (!state.isDragging) return;
  
  // ✅ NEW: Validate scrubbing state before finishing
  if (!isScrubbingActive()) {
    interaction('⚠️ Interaction: MouseUp without active scrubbing', 'warn');
    cleanupDragState(state);
    drawCallback();
    return;
  }
  
  const { x, y } = getCanvasCoordinates(event, canvas);
  
  const dpr = window.devicePixelRatio || 1;
  const width = canvas.width / dpr;
  const height = canvas.height / dpr;
  const cx = width / 2;
  const cy = height / 2;
  
  // Calculate final position
  const currentMouseAngle = calculateAngleFromMouse(x, y, cx, cy);
  let deltaAngle = currentMouseAngle - state.dragStartAngle;
  
  if (deltaAngle > Math.PI) {
    deltaAngle -= Math.PI * 2;
  } else if (deltaAngle < -Math.PI) {
    deltaAngle += Math.PI * 2;
  }
  
  const deltaPosition = deltaAngle / (Math.PI * 2);
  let finalPosition = state.dragStartPlayhead + deltaPosition;
  finalPosition = Math.max(0, Math.min(1, finalPosition));
  
  // ✅ IMPROVED: Stop scrubbing with error handling
  try {
    const scrubResult = stopScrubbing(finalPosition, state.dragWasPlaying);
    interaction(`🖱️ Interaction: Drag completed`, 'info', { 
      position: (scrubResult.finalPosition * 100).toFixed(1) + '%',
      resuming: scrubResult.shouldResume 
    });
  } catch (error) {
    system('❌ Interaction: Error stopping scrubbing', 'error', error);
    // Force cleanup even if stopScrubbing failed
  }
  
  // ✅ IMPROVED: Clean up drag state using centralized function
  cleanupDragState(state);
  
  setTimeout(() => {
    drawCallback();
  }, 10);
}

function handleMouseLeave(state, drawCallback) {
  if (state.isDragging) {
    interaction('🖱️ Interaction: Mouse left canvas - stopping drag');
    
    // ✅ IMPROVED: Stop scrubbing properly with error handling
    const finalPosition = state.dragCurrentPosition || state.dragStartPlayhead || 0;
    
    try {
      const scrubResult = stopScrubbing(finalPosition, state.dragWasPlaying);
      interaction(`🖱️ Interaction: Drag ended`, 'info', { position: (scrubResult.finalPosition * 100).toFixed(1) + '%' });
    } catch (error) {
      system('❌ Interaction: Error on mouse leave', 'error', error);
    }
    
    // ✅ IMPROVED: Clean up drag state using centralized function
    cleanupDragState(state);
    
    drawCallback();
  }
}

// Removed: getCanvasCoordinates - now imported from canvas-math.js