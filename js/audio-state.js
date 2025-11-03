/**
 * Audio State Module
 * 
 * MIGRATION NOTE: This module now re-exports from audio-state-adapter.js
 * which uses StateManager internally. This maintains backward compatibility
 * while transitioning to the new state management system.
 * 
 * All audio state is now managed by StateManager under the 'audio' path.
 * The adapter provides the same API as before, so no changes are needed
 * in consuming modules during the migration.
 */

export {
  getAudioState,
  setAudioBuffer,
  setPlayhead,
  setPlayingState,
  resetAudioState,
  disposeAudioState,
  initializeAudioStateSubscriptions,
  stateManager
} from './audio-state-adapter.js';