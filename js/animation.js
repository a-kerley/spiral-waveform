import { CONFIG, easeInOutCubic } from './utils.js';
import { getAudioState, setPlayhead } from './audio-state.js';
import { renderState, RenderComponents, needsRedraw } from './render-state.js';
import { frameStart, markOperationStart, markOperationEnd } from './performance-monitor.js';
import { getCurrentTime } from './audio-playback.js';
import { isPlayheadAnimating } from './waveform-draw.js';

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
        
        if (needsRedraw()) {
          // Measure render time
          markOperationStart('render');
          drawCallback();
          markOperationEnd('render');
          
          renderState.frameRendered();
        } else {
          // Log occasionally to see if animation loop is running
          if (Math.random() < 0.02) {
            console.log('⏭️ Animation loop running but frame skipped - nothing dirty');
          }
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
    console.log('🎬 Playback ended at file end, starting reset sequence');
    
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
      console.log('🔄 Playhead reset to start during end-of-file transition');
    }
    
    // Complete the end-of-file reset when transition is nearly done
    if (resetElapsed >= resetDuration) {
      visualState.isEndOfFileReset = false;
      visualState.endOfFileResetStartTime = null;
      console.log('✅ End-of-file reset sequence completed');
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
    
    if (progress >= 1) {
      visualState.isTransitioning = false;
      visualState.animationProgress = shouldBeInFocusView ? 1 : 0;
      
      // ✅ UPDATED: Clean up end-of-file reset state when transition completes
      if (visualState.isEndOfFileReset) {
        visualState.isEndOfFileReset = false;
        visualState.endOfFileResetStartTime = null;
        console.log('🎬 End-of-file transition completed, returned to full view');
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
      console.log('🎬 Cancelled end-of-file reset - playback started');
    }
    
    const currentlyDragging = visualState.isDragging;
    
    if (visualState.animationProgress < 1 && !visualState.isTransitioning && !currentlyDragging) {
      visualState.isTransitioning = true;
      visualState.transitionStartTime = timestamp - (visualState.animationProgress * CONFIG.TRANSITION_DURATION);
      visualState.lastStateChange = timestamp;
    }
  }
  
  // Handle playback stopping (animate out to full view)
  if (playbackJustStopped && !visualState.isDragging && !visualState.isEndOfFileReset) {
    const actualDuration = audioState.audioBuffer ? audioState.audioBuffer.duration : 0;
    const isAtEnd = audioState.currentPlayhead >= (actualDuration - 0.1);
    
    // Only animate out if we're not at the end (end-of-file is handled separately)
    if (!isAtEnd && visualState.animationProgress > 0 && !visualState.isTransitioning) {
      visualState.isTransitioning = true;
      visualState.transitionStartTime = timestamp - ((1 - visualState.animationProgress) * CONFIG.TRANSITION_DURATION);
      visualState.lastStateChange = timestamp;
      console.log('🎬 Playback stopped - animating out to full view');
    }
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