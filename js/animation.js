import { CONFIG, easeInOutCubic } from './utils.js';
import { getAudioState, setPlayhead } from './audio-state.js';
import { renderState, RenderComponents, needsRedraw } from './render-state.js';
import { frameStart, markOperationStart, markOperationEnd } from './performance-monitor.js';
import { getCurrentTime } from './audio-playback.js';
import { isPlayheadAnimating } from './waveform-draw.js';
import { stateManager } from './audio-state-adapter.js';

export function createAnimationLoop(drawCallback, visualState) {
  let lastTimestamp = null;
  let lastDrawTime = 0;
  const frameInterval = 1000 / CONFIG.TARGET_FPS;

  function animate(timestamp) {
    try {
      // Mark frame start for FPS tracking
      frameStart();
      
      if (!lastTimestamp) lastTimestamp = timestamp;
      const delta = (timestamp - lastTimestamp) / 1000;
      lastTimestamp = timestamp;

      // Frame rate limiting
      if (timestamp - lastDrawTime < frameInterval) {
        requestAnimationFrame(animate);
        return;
      }
      lastDrawTime = timestamp;

      // Get current audio state
      const audioState = getAudioState();

      // Handle end-of-file behavior first
      handleEndOfFile(timestamp, visualState, audioState);

      // Handle transitions
      updateTransitions(timestamp, visualState, audioState);
      
      // Handle playback
      updatePlayback(delta, timestamp, visualState, audioState);

      // Draw only when we have audio loaded AND something is dirty
      if (audioState.waveform && audioState.audioBuffer) {
        // Mark playhead dirty if animation is running (BEFORE needsRedraw check)
        if (isPlayheadAnimating()) {
          renderState.markDirty(RenderComponents.PLAYHEAD);
        }
        
        const shouldRedraw = needsRedraw();
        if (shouldRedraw) {
          // Measure render time
          markOperationStart('render');
          drawCallback();
          markOperationEnd('render');
          
          renderState.frameRendered();
        } else {
          renderState.frameSkipped();
        }
      }
    } catch (error) {
      console.error('🚨 Animation loop error:', error);
    }

    requestAnimationFrame(animate);
  }

  return animate;
}

// ✅ NEW: Handle end-of-file behavior with smooth transitions
function handleEndOfFile(timestamp, visualState, audioState) {
  if (!audioState.audioBuffer) return;
  
  const actualDuration = audioState.audioBuffer.duration;
  const isAtEnd = audioState.currentPlayhead >= (actualDuration - 0.1);
  const justStoppedPlaying = !audioState.isPlaying && visualState.wasPlaying;
  
  // If playback just ended at the file end, start smooth transition back to full view
  if (justStoppedPlaying && isAtEnd && !visualState.isDragging) {
    // Mark that we're doing an end-of-file reset
    visualState.isEndOfFileReset = true;
    visualState.endOfFileResetStartTime = timestamp;
    
    // Start transition to full view
    if (!visualState.isTransitioning) {
      visualState.isTransitioning = true;
      visualState.transitionStartTime = timestamp;
      visualState.lastStateChange = timestamp;
    }
  }
  
  // Handle the end-of-file reset animation
  if (visualState.isEndOfFileReset) {
    const resetElapsed = timestamp - visualState.endOfFileResetStartTime;
    const resetDuration = CONFIG.TRANSITION_DURATION * 0.8; // Slightly shorter than full transition
    
    // Reset playhead to 0 after a brief delay (but before transition completes)
    if (resetElapsed >= resetDuration * 0.3 && audioState.currentPlayhead > 0.1) {
      setPlayhead(0);
      renderState.markDirty(RenderComponents.PLAYHEAD);
      renderState.markDirty(RenderComponents.TIME_DISPLAY);
    }
    
    // Complete the end-of-file reset when transition is nearly done
    if (resetElapsed >= resetDuration) {
      visualState.isEndOfFileReset = false;
      visualState.endOfFileResetStartTime = null;
    }
  }
}

function updateTransitions(timestamp, visualState, audioState) {
  if (visualState.isTransitioning) {
    const elapsed = timestamp - visualState.transitionStartTime;
    const progress = Math.min(elapsed / CONFIG.TRANSITION_DURATION, 1);
    
    const actualDuration = audioState.audioBuffer ? audioState.audioBuffer.duration : 0;
    
    const isPlayheadInValidRange = actualDuration > 0 && 
      audioState.currentPlayhead > 0.001 && 
      audioState.currentPlayhead < actualDuration;
    
    // ✅ UPDATED: During end-of-file reset, always go to full view
    const shouldBeInFocusView = visualState.isEndOfFileReset ? false : 
      (audioState.isPlaying || isPlayheadInValidRange || visualState.isDragging);
    
    visualState.animationProgress = shouldBeInFocusView ? 
      easeInOutCubic(progress) : 
      1 - easeInOutCubic(progress);
    
    // Mark waveform dirty during transition
    renderState.markDirty(RenderComponents.WAVEFORM);
    
    if (progress >= 1) {
      visualState.isTransitioning = false;
      visualState.animationProgress = shouldBeInFocusView ? 1 : 0;
      renderState.markDirty(RenderComponents.WAVEFORM);
      
      // ✅ UPDATED: Clean up end-of-file reset state when transition completes
      if (visualState.isEndOfFileReset) {
        visualState.isEndOfFileReset = false;
        visualState.endOfFileResetStartTime = null;
      }
    }
  } else {
    // Handle immediate state changes when not transitioning
    const actualDuration = audioState.audioBuffer ? audioState.audioBuffer.duration : 0;
    
    const isPlayheadInValidRange = actualDuration > 0 && 
      audioState.currentPlayhead > 0.001 && 
      audioState.currentPlayhead < actualDuration;
    
    // ✅ UPDATED: Don't start new transitions during end-of-file reset
    const shouldBeInFocusView = audioState.isPlaying || isPlayheadInValidRange || visualState.isDragging;
    
    const currentlyInFocusView = visualState.animationProgress > 0.5;
    if (shouldBeInFocusView !== currentlyInFocusView && !visualState.isDragging && !visualState.isEndOfFileReset) {
      const timeSinceLastChange = timestamp - (visualState.lastStateChange || 0);
      if (timeSinceLastChange > 100) {
        visualState.isTransitioning = true;
        visualState.transitionStartTime = timestamp;
        visualState.lastStateChange = timestamp;
      }
    }
  }
}

function updatePlayback(delta, timestamp, visualState, audioState) {
  const playbackJustStarted = audioState.isPlaying && !visualState.wasPlaying;
  const playbackJustStopped = !audioState.isPlaying && visualState.wasPlaying;
  
  if (playbackJustStarted) {
    // ✅ UPDATED: Cancel any ongoing end-of-file reset when playback starts
    if (visualState.isEndOfFileReset) {
      visualState.isEndOfFileReset = false;
      visualState.endOfFileResetStartTime = null;
    }
    
    const currentlyDragging = visualState.isDragging;
    
    if (visualState.animationProgress < 1 && !visualState.isTransitioning && !currentlyDragging) {
      visualState.isTransitioning = true;
      visualState.transitionStartTime = timestamp - (visualState.animationProgress * CONFIG.TRANSITION_DURATION);
      visualState.lastStateChange = timestamp;
    }
  }
  
  // ✅ UPDATED: Don't animate out when pausing mid-playback
  // The focused view should remain active so the user can easily resume from the same position
  // or drag to a new position. Only transition out at end-of-file (handled separately above).
  if (playbackJustStopped && !visualState.isDragging && !visualState.isEndOfFileReset) {
    const actualDuration = audioState.audioBuffer ? audioState.audioBuffer.duration : 0;
    const isAtEnd = audioState.currentPlayhead >= (actualDuration - 0.1);
    
    // Don't auto-transition when pausing - let playhead hiding handle the visual feedback
    // End-of-file is already handled in handleEndOfFile()
    // Mid-track pauses stay in focused view so playhead hiding provides visual feedback
  }
  
  // Update playhead position during playback
  if (audioState.isPlaying) {
    const currentTime = getCurrentTime();
    if (Math.abs(currentTime - audioState.currentPlayhead) > 0.016) { // ~1 frame tolerance
      setPlayhead(currentTime);
      renderState.markDirty(RenderComponents.PLAYHEAD);
      renderState.markDirty(RenderComponents.TIME_DISPLAY);
    }
  }
  
  visualState.wasPlaying = audioState.isPlaying;
}