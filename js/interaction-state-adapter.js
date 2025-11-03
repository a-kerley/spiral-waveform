/**
 * Interaction State Adapter
 * Provides backward-compatible API for interaction state while using StateManager internally
 * Consolidates scrubbing state from audio-playback.js and drag state from interaction.js
 */

import { stateManager } from './state-manager.js';

/**
 * ScrubState-compatible adapter class
 * Wraps StateManager to provide the same API as the old ScrubState class
 */
export class ScrubStateAdapter {
  constructor() {
    // No local state - everything goes through StateManager
  }

  reset() {
    stateManager.batch({
      'interaction.isScrubbing': false,
      'interaction.wasPlaying': false,
      'interaction.scrubStartTime': 0,
      'interaction.scrubPosition': 0,
      'interaction.lastScrubTime': 0,
      'interaction.hasAudioSource': false,
      'interaction.lastUpdateTime': 0
    });
  }

  startScrubbing(position, wasPlaying) {
    const isScrubbing = stateManager.get('interaction.isScrubbing');
    
    if (isScrubbing) {
      console.warn('Scrubbing already active, stopping previous session');
      this.stopScrubbing();
    }
    
    const now = performance.now();
    stateManager.batch({
      'interaction.isScrubbing': true,
      'interaction.wasPlaying': wasPlaying,
      'interaction.scrubStartTime': now,
      'interaction.scrubPosition': position,
      'interaction.lastScrubTime': now,
      'interaction.hasAudioSource': false,
      'interaction.lastUpdateTime': now
    });
  }

  updateScrubbing(position, velocity = 0) {
    const isScrubbing = stateManager.get('interaction.isScrubbing');
    
    if (!isScrubbing) {
      console.warn('⚠️ Attempted to update scrubbing when not active');
      return false;
    }

    const clampedPosition = Math.max(0, Math.min(1, position));
    const now = performance.now();
    
    stateManager.batch({
      'interaction.scrubPosition': clampedPosition,
      'interaction.lastScrubTime': now,
      'interaction.lastUpdateTime': now
    });

    return true;
  }

  stopScrubbing(finalPosition, shouldResume = false) {
    const isScrubbing = stateManager.get('interaction.isScrubbing');
    
    if (!isScrubbing) {
      console.warn('⚠️ Attempted to stop scrubbing when not active');
      return { wasPlaying: false, finalPosition: 0 };
    }

    const wasPlaying = stateManager.get('interaction.wasPlaying');
    const currentPosition = stateManager.get('interaction.scrubPosition');
    
    const result = {
      wasPlaying,
      finalPosition: Math.max(0, Math.min(1, finalPosition || currentPosition)),
      shouldResume: shouldResume !== false ? wasPlaying : shouldResume
    };

    this.reset();
    return result;
  }

  setHasAudioSource(hasSource) {
    stateManager.set('interaction.hasAudioSource', hasSource);
  }

  isActive() {
    return stateManager.get('interaction.isScrubbing');
  }

  getState() {
    return {
      isScrubbing: stateManager.get('interaction.isScrubbing'),
      wasPlaying: stateManager.get('interaction.wasPlaying'),
      startPosition: stateManager.get('interaction.scrubPosition'), // Note: using scrubPosition as startPosition
      currentPosition: stateManager.get('interaction.scrubPosition'),
      hasAudioSource: stateManager.get('interaction.hasAudioSource'),
      lastUpdateTime: stateManager.get('interaction.lastUpdateTime')
    };
  }
}

/**
 * Create a singleton instance of ScrubStateAdapter
 */
export const scrubStateAdapter = new ScrubStateAdapter();

/**
 * Helper functions for drag state management
 */
export function startDragging(startAngle, startPlayhead, wasPlaying) {
  stateManager.batch({
    'interaction.isDragging': true,
    'interaction.dragStartAngle': startAngle,
    'interaction.dragStartPlayhead': startPlayhead,
    'interaction.wasPlaying': wasPlaying,
    'interaction.lastUpdateTime': performance.now()
  });
}

export function updateDragging(currentPosition, currentAngle) {
  const isDragging = stateManager.get('interaction.isDragging');
  
  if (!isDragging) {
    console.warn('⚠️ Attempted to update dragging when not active');
    return false;
  }

  stateManager.batch({
    'interaction.dragCurrentPosition': currentPosition,
    'interaction.lastUpdateTime': performance.now()
  });
  
  return true;
}

export function stopDragging() {
  const isDragging = stateManager.get('interaction.isDragging');
  
  if (!isDragging) {
    return {
      wasPlaying: false,
      finalAngle: null,
      finalPlayhead: null
    };
  }

  const wasPlaying = stateManager.get('interaction.wasPlaying');
  const finalAngle = stateManager.get('interaction.dragStartAngle');
  const finalPlayhead = stateManager.get('interaction.dragStartPlayhead');
  
  // Reset drag state
  stateManager.batch({
    'interaction.isDragging': false,
    'interaction.dragStartPosition': null,
    'interaction.dragCurrentPosition': null,
    'interaction.dragStartAngle': null,
    'interaction.dragStartPlayhead': null
  });
  
  return {
    wasPlaying,
    finalAngle,
    finalPlayhead
  };
}

/**
 * Get current drag state
 */
export function getDragState() {
  return {
    isDragging: stateManager.get('interaction.isDragging'),
    dragStartPosition: stateManager.get('interaction.dragStartPosition'),
    dragCurrentPosition: stateManager.get('interaction.dragCurrentPosition'),
    dragStartAngle: stateManager.get('interaction.dragStartAngle'),
    dragStartPlayhead: stateManager.get('interaction.dragStartPlayhead'),
    wasPlaying: stateManager.get('interaction.wasPlaying')
  };
}

/**
 * Check if currently dragging
 */
export function isDragging() {
  return stateManager.get('interaction.isDragging');
}

/**
 * Get the entire interaction state
 */
export function getInteractionState() {
  return stateManager.get('interaction');
}

/**
 * Reset interaction state to defaults
 */
export function resetInteractionState() {
  stateManager.batch({
    'interaction.isDragging': false,
    'interaction.dragStartPosition': null,
    'interaction.dragCurrentPosition': null,
    'interaction.dragStartAngle': null,
    'interaction.dragStartPlayhead': null,
    'interaction.isScrubbing': false,
    'interaction.scrubStartTime': 0,
    'interaction.lastScrubTime': 0,
    'interaction.scrubDirection': 1,
    'interaction.scrubPosition': 0,
    'interaction.previewDuration': 0,
    'interaction.wasPlaying': false,
    'interaction.hasAudioSource': false,
    'interaction.lastUpdateTime': 0
  });
}

/**
 * Subscribe to interaction state changes
 */
export function subscribeToInteractionState(path, callback) {
  return stateManager.subscribe(`interaction.${path}`, callback);
}

/**
 * Sync interaction state with scrubbing state (for backward compatibility)
 */
export function syncInteractionWithScrubState(visualState) {
  const scrubState = scrubStateAdapter.getState();
  const dragState = getDragState();
  
  // Ensure interaction state matches audio scrubbing state
  if (scrubState.isScrubbing && !dragState.isDragging) {
    console.warn('⚠️ Scrubbing active but interaction not dragging - syncing states');
    startDragging(null, scrubState.currentPosition, scrubState.wasPlaying);
    
    // Sync with visualState if provided (for backward compatibility)
    if (visualState) {
      visualState.isDragging = true;
      visualState.dragCurrentPosition = scrubState.currentPosition;
    }
  } else if (!scrubState.isScrubbing && dragState.isDragging) {
    console.warn('⚠️ Interaction dragging but scrubbing not active - cleaning up');
    stopDragging();
    
    // Sync with visualState if provided
    if (visualState) {
      visualState.isDragging = false;
      visualState.dragCurrentPosition = undefined;
      visualState.dragStartAngle = undefined;
      visualState.dragStartPlayhead = undefined;
    }
  }
}

// Export the StateManager instance for direct access if needed
export { stateManager };
