/**
 * Audio State Adapter
 * 
 * Provides backward-compatible API for audio state while using StateManager internally.
 * This adapter layer allows gradual migration from the old audio-state.js to the new
 * StateManager system without breaking existing code.
 * 
 * Migration Strategy:
 * 1. This adapter wraps StateManager and provides the same API as audio-state.js
 * 2. All audio state is now stored in StateManager under the 'audio' path
 * 3. Subscriptions automatically update render state when audio changes
 * 4. Backward compatibility maintained during transition
 */

import { stateManager } from './state-manager.js';

// Note: We don't import render-state here to avoid issues in test environment
// Instead, subscriptions are initialized from main.js after all modules load

/**
 * Get audio state object (backward compatible)
 * Maps StateManager state to old audio-state.js format
 */
export function getAudioState() {
  return {
    audioBuffer: stateManager.get('audio.buffer'),
    waveform: stateManager.get('audio.waveform'),
    globalMaxAmp: stateManager.get('audio.maxAmplitude'),
    currentPlayhead: stateManager.get('audio.currentTime'),
    isPlaying: stateManager.get('audio.isPlaying'),
    duration: stateManager.get('audio.duration')
  };
}

/**
 * Set audio buffer and related data
 * @param {AudioBuffer|null} buffer - The audio buffer
 * @param {Float32Array|null} waveform - The waveform data
 * @param {number} maxAmp - Maximum amplitude in waveform
 */
export function setAudioBuffer(buffer, waveform, maxAmp) {
  console.log('🔧 setAudioBuffer called with:', {
    hasBuffer: !!buffer,
    bufferDuration: buffer ? buffer.duration : 'N/A',
    bufferChannels: buffer ? buffer.numberOfChannels : 'N/A',
    hasWaveform: !!waveform,
    waveformLength: waveform ? waveform.length : 0,
    waveformConstructor: waveform ? waveform.constructor.name : 'N/A',
    maxAmp,
    maxAmpType: typeof maxAmp
  });
  
  // Batch update all audio properties at once
  const updates = {
    'audio.buffer': buffer,
    'audio.waveform': waveform,
    'audio.maxAmplitude': maxAmp,
    'audio.currentTime': 0,
    'audio.isPlaying': false
  };
  
  // For URL-loaded audio, use the HTML audio element duration if available
  if (window.urlAudioElement && window.urlAudioElement.duration) {
    updates['audio.duration'] = window.urlAudioElement.duration;
  } else {
    updates['audio.duration'] = buffer ? buffer.duration : 0;
  }
  
  // Batch update to avoid multiple notifications
  stateManager.batch(updates);
  
  console.log('✅ Audio state updated:', {
    hasAudioBuffer: !!stateManager.get('audio.buffer'),
    hasWaveform: !!stateManager.get('audio.waveform'),
    waveformLength: stateManager.get('audio.waveform')?.length || 0,
    globalMaxAmp: stateManager.get('audio.maxAmplitude'),
    duration: stateManager.get('audio.duration'),
    isUrlAudio: !!window.urlAudioElement
  });
}

/**
 * Set playhead position
 * @param {number} time - Time in seconds
 */
export function setPlayhead(time) {
  const duration = stateManager.get('audio.duration');
  const newTime = Math.max(0, Math.min(time, duration));
  stateManager.set('audio.currentTime', newTime);
}

/**
 * Set playing state
 * @param {boolean} playing - Whether audio is playing
 */
export function setPlayingState(playing) {
  stateManager.set('audio.isPlaying', playing);
}

/**
 * Reset audio state to defaults
 */
export function resetAudioState() {
  // Batch reset all audio properties
  stateManager.batch({
    'audio.buffer': null,
    'audio.waveform': null,
    'audio.maxAmplitude': 1,
    'audio.currentTime': 0,
    'audio.isPlaying': false,
    'audio.duration': 0
  });
  
  console.log('🔄 Audio state reset to defaults');
}

/**
 * Dispose of audio state and release all memory references
 * Call this before loading new audio to ensure proper cleanup
 */
export function disposeAudioState() {
  // Reset audio state
  stateManager.batch({
    'audio.buffer': null,
    'audio.waveform': null,
    'audio.maxAmplitude': 1,
    'audio.currentTime': 0,
    'audio.isPlaying': false,
    'audio.duration': 0
  });
  
  // Clear URL audio element if exists
  if (window.urlAudioElement) {
    window.urlAudioElement.pause();
    window.urlAudioElement.src = '';
    window.urlAudioElement.load();
    window.urlAudioElement = null;
  }
  
  console.log('🧹 Audio state disposed and memory released');
}

/**
 * Initialize subscriptions to automatically update render state
 * This should be called from main.js after all modules are loaded
 * 
 * Note: Does nothing in test environment to avoid import issues
 */
export async function initializeAudioStateSubscriptions() {
  // Skip in test/Node environment
  if (typeof window === 'undefined' || typeof process !== 'undefined') {
    console.log('⏭️ Skipping audio state subscriptions (not in browser environment)');
    return;
  }
  
  console.log('🔄 Initializing audio state subscriptions...');
  
  try {
    // Dynamically import render-state to avoid circular dependencies
    const { renderState, RenderComponents } = await import('./render-state.js');
    console.log('📦 render-state module loaded successfully');
    
    // Subscribe to playhead changes
    stateManager.subscribe('audio.currentTime', (newTime, oldTime) => {
      if (Math.abs(newTime - oldTime) > 0.001) {
        console.log('⏱️ Playhead changed, marking dirty');
        renderState.markDirty(RenderComponents.PLAYHEAD);
        renderState.markDirty(RenderComponents.TIME_DISPLAY);
      }
    });
    
    // Subscribe to playing state changes
    stateManager.subscribe('audio.isPlaying', (isPlaying) => {
      console.log('▶️ Playing state changed:', isPlaying);
      renderState.markDirty(RenderComponents.PLAY_BUTTON);
      renderState.markDirty(RenderComponents.UI);
    });
    
    // Subscribe to buffer changes
    stateManager.subscribe('audio.buffer', (newBuffer) => {
      console.log('🎵 Audio buffer changed:', !!newBuffer);
      if (newBuffer !== null) {
        renderState.markAllDirty();
      }
    });
    
    // Subscribe to waveform changes
    stateManager.subscribe('audio.waveform', (newWaveform) => {
      console.log('📊 Waveform changed:', !!newWaveform, 'length:', newWaveform?.length);
      if (newWaveform !== null) {
        renderState.markDirty(RenderComponents.WAVEFORM);
        renderState.markDirty(RenderComponents.FULL);
      }
    });
    
    console.log('✅ Audio state subscriptions initialized');
  } catch (err) {
    console.error('❌ Failed to initialize audio state subscriptions:', err);
  }
}

/**
 * Direct access to StateManager for advanced usage
 * Allows subscribing to specific audio state changes
 */
export { stateManager };
