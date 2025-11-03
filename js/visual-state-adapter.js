/**
 * Visual State Adapter
 * Provides backward-compatible interface to visualState while using StateManager internally
 * Maps old visualState API to StateManager paths
 */

import { stateManager } from './state-manager.js';

// Property mapping: visualState property -> StateManager path
const STATE_PATH_MAP = {
  isTransitioning: 'visual.isTransitioning',
  transitionStartTime: 'visual.transitionStartTime',
  animationProgress: 'visual.animationProgress',
  lastStateChange: 'visual.lastStateChange',
  isDragging: 'interaction.isDragging',
  dragCurrentPosition: 'interaction.dragCurrentPosition',
  dragStartAngle: 'interaction.dragStartAngle',
  dragStartPlayhead: 'interaction.dragStartPlayhead',
  wasPlaying: 'interaction.wasPlaying',
  isEndOfFileReset: 'visual.endOfFileReset.isActive',
  endOfFileResetStartTime: 'visual.endOfFileReset.startTime'
};

/**
 * Create a Proxy object that syncs with StateManager
 * This allows legacy code to directly read/write properties while using StateManager internally
 */
export function createVisualStateProxy() {
  const handler = {
    get(target, prop) {
      const path = STATE_PATH_MAP[prop];
      if (path) {
        return stateManager.get(path);
      }
      return undefined;
    },
    
    set(target, prop, value) {
      const path = STATE_PATH_MAP[prop];
      if (path) {
        stateManager.set(path, value);
        return true;
      }
      console.warn(`Unknown visual state property: ${prop}`);
      return false;
    },
    
    has(target, prop) {
      return prop in STATE_PATH_MAP;
    },
    
    ownKeys(target) {
      return Object.keys(STATE_PATH_MAP);
    },
    
    getOwnPropertyDescriptor(target, prop) {
      if (prop in STATE_PATH_MAP) {
        return {
          enumerable: true,
          configurable: true
        };
      }
      return undefined;
    }
  };
  
  return new Proxy({}, handler);
}

/**
 * Get current visual state in legacy format (snapshot)
 * Maps StateManager state to old visualState structure
 */
export function getVisualState() {
  const state = stateManager.getState();
  
  return {
    // Transition state
    isTransitioning: state.visual.isTransitioning,
    transitionStartTime: state.visual.transitionStartTime,
    animationProgress: state.visual.animationProgress,
    lastStateChange: state.visual.lastStateChange,
    
    // Drag state (from interaction in StateManager)
    isDragging: state.interaction.isDragging,
    dragCurrentPosition: state.interaction.dragCurrentPosition,
    dragStartAngle: state.interaction.dragStartAngle,
    dragStartPlayhead: state.interaction.dragStartPlayhead,
    
    // Playback state (from interaction)
    wasPlaying: state.interaction.wasPlaying,
    
    // End-of-file reset state
    isEndOfFileReset: state.visual.endOfFileReset.isActive,
    endOfFileResetStartTime: state.visual.endOfFileReset.startTime
  };
}

/**
 * Set transition state
 */
export function setTransitioning(isTransitioning, timestamp = null) {
  const updates = {
    'visual.isTransitioning': isTransitioning
  };
  
  if (timestamp !== null) {
    updates['visual.transitionStartTime'] = timestamp;
  }
  
  stateManager.batch(updates);
}

/**
 * Set animation progress
 */
export function setAnimationProgress(progress) {
  stateManager.set('visual.animationProgress', progress);
}

/**
 * Set last state change timestamp
 */
export function setLastStateChange(timestamp) {
  stateManager.set('visual.lastStateChange', timestamp);
}

/**
 * Set dragging state
 */
export function setDragging(isDragging, dragState = null) {
  const updates = {
    'interaction.isDragging': isDragging
  };
  
  if (dragState) {
    if (dragState.dragCurrentPosition !== undefined) {
      updates['interaction.dragCurrentPosition'] = dragState.dragCurrentPosition;
    }
    if (dragState.dragStartAngle !== undefined) {
      updates['interaction.dragStartAngle'] = dragState.dragStartAngle;
    }
    if (dragState.dragStartPlayhead !== undefined) {
      updates['interaction.dragStartPlayhead'] = dragState.dragStartPlayhead;
    }
  }
  
  // Clear drag state when not dragging
  if (!isDragging) {
    updates['interaction.dragCurrentPosition'] = null;
    updates['interaction.dragStartAngle'] = null;
    updates['interaction.dragStartPlayhead'] = null;
  }
  
  stateManager.batch(updates);
}

/**
 * Set was playing state
 */
export function setWasPlaying(wasPlaying) {
  stateManager.set('interaction.wasPlaying', wasPlaying);
}

/**
 * Set end-of-file reset state
 */
export function setEndOfFileReset(isActive, startTime = null) {
  stateManager.batch({
    'visual.endOfFileReset.isActive': isActive,
    'visual.endOfFileReset.startTime': startTime
  });
}

/**
 * Reset visual state to defaults
 */
export function resetVisualState() {
  stateManager.batch({
    // Transition state
    'visual.isTransitioning': false,
    'visual.transitionStartTime': 0,
    'visual.animationProgress': 0,
    'visual.lastStateChange': 0,
    
    // Drag state
    'interaction.isDragging': false,
    'interaction.dragCurrentPosition': null,
    'interaction.dragStartAngle': null,
    'interaction.dragStartPlayhead': null,
    
    // Playback state
    'interaction.wasPlaying': false,
    
    // End-of-file reset state
    'visual.endOfFileReset.isActive': false,
    'visual.endOfFileReset.startTime': null
  });
}

/**
 * Initialize visual state subscriptions for cross-module synchronization
 * This sets up automatic updates to render state when visual state changes
 */
export async function initializeVisualStateSubscriptions() {
  // Only run in browser environment
  if (typeof window === 'undefined') {
    console.log('⏭️ Skipping visual state subscriptions (not in browser environment)');
    return;
  }
  
  console.log('🔄 Initializing visual state subscriptions...');
  
  try {
    // Lazy import render-state to avoid circular dependencies in tests
    const { renderState } = await import('./render-state.js');
    console.log('📦 render-state module loaded for visual subscriptions');
    
    // Subscribe to transition state changes
    stateManager.subscribe('visual.isTransitioning', (isTransitioning) => {
      renderState.markDirty('all', 'visual.isTransitioning changed');
    });
    
    stateManager.subscribe('visual.animationProgress', (progress) => {
      renderState.markDirty('all', 'visual.animationProgress changed');
    });
    
    // Subscribe to drag state changes
    stateManager.subscribe('interaction.isDragging', (isDragging) => {
      renderState.markDirty('all', 'interaction.isDragging changed');
    });
    
    // Subscribe to end-of-file reset changes
    stateManager.subscribe('visual.endOfFileReset.isActive', (isActive) => {
      renderState.markDirty('all', 'visual.endOfFileReset changed');
    });
    
    console.log('✅ Visual state subscriptions initialized');
  } catch (error) {
    console.error('❌ Failed to initialize visual state subscriptions:', error);
  }
}

// Export stateManager for direct access when needed
export { stateManager };
