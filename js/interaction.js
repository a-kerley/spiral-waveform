import { CONFIG } from './utils.js';
import { getAudioState } from './audio-state.js';
import { startScrubbing, updateScrubbing, stopScrubbing, isAudioPlaying } from './audio-playback.js';

export function setupInteraction(canvas, state, drawCallback, audioCallbacks = {}) {
  canvas.addEventListener('mousedown', (e) => handleMouseDown(e, canvas, state, drawCallback, audioCallbacks));
  canvas.addEventListener('mousemove', (e) => handleMouseMove(e, canvas, state, drawCallback, audioCallbacks));
  canvas.addEventListener('mouseup', (e) => handleMouseUp(e, canvas, state, drawCallback, audioCallbacks));
  canvas.addEventListener('mouseleave', () => handleMouseLeave(state, drawCallback));
  
  // Touch support
  canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    const touch = e.touches[0];
    const mouseEvent = new MouseEvent('mousedown', {
      clientX: touch.clientX,
      clientY: touch.clientY
    });
    handleMouseDown(mouseEvent, canvas, state, drawCallback, audioCallbacks);
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
    
    if (state.isDragging && e.changedTouches && e.changedTouches.length > 0) {
      const touch = e.changedTouches[0];
      const mouseEvent = new MouseEvent('mouseup', {
        clientX: touch.clientX,
        clientY: touch.clientY
      });
      handleMouseUp(mouseEvent, canvas, state, drawCallback, audioCallbacks);
    } else {
      handleMouseUp(e, canvas, state, drawCallback, audioCallbacks);
    }
  });
}

function calculateAngleFromMouse(x, y, cx, cy) {
  // Calculate raw angle from mouse position (-π to π)
  const rawAngle = Math.atan2(y - cy, x - cx);
  
  // Convert to normalized angle (0 to 2π) starting from top (12 o'clock)
  // Subtract π/2 to start from top, then invert direction for clockwise = forward
  let normalizedAngle = (-rawAngle + Math.PI / 2 + Math.PI * 2) % (Math.PI * 2);
  
  return normalizedAngle;
}

function handleMouseDown(event, canvas, state, drawCallback, audioCallbacks) {
  const { x, y } = getCanvasCoordinates(event, canvas);
  
  const dpr = window.devicePixelRatio || 1;
  const width = canvas.width / dpr;
  const height = canvas.height / dpr;
  const cx = width / 2;
  const cy = height / 2;
  
  const buttonRadius = Math.min(width, height) * CONFIG.BUTTON_RADIUS_RATIO;
  const buttonDistance = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
  
  if (buttonDistance <= buttonRadius) {
    if (audioCallbacks.onPlayPause) {
      audioCallbacks.onPlayPause();
    }
  } else {
    const distance = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
    const waveformInnerRadius = buttonRadius + Math.min(width, height) * CONFIG.WAVEFORM_GAP_RATIO;
    const maxWaveformThickness = Math.min(width, height) * CONFIG.WAVEFORM_THICKNESS_RATIO;
    const waveformOuterRadius = waveformInnerRadius + maxWaveformThickness;
    
    if (distance >= waveformInnerRadius && distance <= waveformOuterRadius) {
      const audioState = getAudioState();
      const currentPlayhead = audioState.duration > 0 ? 
        audioState.currentPlayhead / audioState.duration : 0;
      
      // ✅ UPDATED: Start scrubbing (audio only if playing, visual always)
      const wasPlaying = startScrubbing(currentPlayhead);
      
      // ✅ UPDATED: Log scrubbing mode for clarity
      if (wasPlaying) {
        console.log('🎚️ Started audio scrubbing (was playing)');
      } else {
        console.log('🎚️ Started silent scrubbing (was paused)');
      }
      
      // Store drag state
      state.isDragging = true;
      state.dragWasPlaying = wasPlaying;
      state.lastStateChange = performance.now();
      
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
    }
  }
}

function handleMouseMove(event, canvas, state, drawCallback, audioCallbacks = {}) {
  if (!state.isDragging) return;
  
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
  
  // ✅ NEW: Calculate velocity for scrubbing
  const now = performance.now();
  const timeDelta = (now - (state.lastDragTime || now)) / 1000; // Convert to seconds
  const positionDelta = newPosition - (state.lastDragPosition || newPosition);
  
  if (timeDelta > 0) {
    const velocity = positionDelta / timeDelta; // Normalized position change per second
    
    // ✅ NEW: Update scrubbing with velocity
    updateScrubbing(velocity, newPosition);
    
    // Store for next calculation
    state.lastDragPosition = newPosition;
    state.lastDragTime = now;
  }
  
  // Store for visual feedback
  state.dragCurrentPosition = newPosition;
  
  // No more regular seeking during drag - scrubbing handles the audio
  drawCallback();
}

function handleMouseUp(event, canvas, state, drawCallback, audioCallbacks = {}) {
  if (state.isDragging) {
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
    
    // ✅ NEW: Stop scrubbing and resume playback if needed
    stopScrubbing(finalPosition, state.dragWasPlaying);
    
    // Clean up drag state
    state.isDragging = false;
    state.dragCurrentPosition = undefined;
    state.dragStartAngle = undefined;
    state.dragStartPlayhead = undefined;
    state.lastSeekTime = undefined;
    state.dragWasPlaying = undefined;
    state.lastDragPosition = undefined;
    state.lastDragTime = undefined;
    state.lastStateChange = performance.now();
    
    setTimeout(() => {
      drawCallback();
    }, 10);
  }
}

function handleMouseLeave(state, drawCallback) {
  if (state.isDragging) {
    // ✅ FIX: Need to stop scrubbing properly
    const finalPosition = state.dragCurrentPosition || state.dragStartPlayhead || 0;
    stopScrubbing(finalPosition, state.dragWasPlaying);
    
    // Clean up ALL drag state (matching handleMouseUp)
    state.isDragging = false;
    state.dragCurrentPosition = undefined;
    state.dragStartAngle = undefined;
    state.dragStartPlayhead = undefined;
    state.lastSeekTime = undefined;
    state.dragWasPlaying = undefined;
    state.lastDragPosition = undefined;
    state.lastDragTime = undefined;
    state.lastStateChange = performance.now();
    
    drawCallback();
  }
}

function getCanvasCoordinates(event, canvas) {
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  
  return {
    x: (event.clientX - rect.left) * (canvas.width / rect.width) / dpr,
    y: (event.clientY - rect.top) * (canvas.height / rect.height) / dpr
  };
}