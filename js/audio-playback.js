import { setPlayhead } from './audio-state.js'; // ✅ ADD THIS IMPORT
import { audio } from './logger.js'; // ✅ NEW: Import logging system

let audioContext = null;
let audioSource = null;
let scrubSource = null; // ✅ NEW: Separate source for scrubbing
let gainNode = null;
let scrubGainNode = null; // ✅ NEW: Separate gain for scrubbing
let startTime = 0;
let pauseTime = 0;
let startOffset = 0;
let isInitialized = false;

// ✅ IMPROVED: Centralized scrubbing state management
class ScrubState {
  constructor() {
    this.reset();
  }

  reset() {
    this.isScrubbing = false;
    this.wasPlaying = false;
    this.startPosition = 0;
    this.currentPosition = 0;
    this.lastUpdateTime = 0;
    this.hasAudioSource = false;
    audio('Scrub state reset', 'debug');
  }

  startScrubbing(position, wasPlaying) {
    if (this.isScrubbing) {
      audio('Scrubbing already active, stopping previous session', 'warn');
      this.stopScrubbing();
    }
    
    this.isScrubbing = true;
    this.wasPlaying = wasPlaying;
    this.startPosition = position;
    this.currentPosition = position;
    this.lastUpdateTime = performance.now();
    this.hasAudioSource = false;
    
    audio(`Scrub state started: position=${position.toFixed(3)}, wasPlaying=${wasPlaying}`, 'debug');
  }

  updateScrubbing(position, velocity = 0) {
    if (!this.isScrubbing) {
      console.warn('⚠️ Attempted to update scrubbing when not active');
      return false;
    }

    this.currentPosition = Math.max(0, Math.min(1, position));
    this.lastUpdateTime = performance.now();

    return true;
  }

  stopScrubbing(finalPosition, shouldResume = false) {
    if (!this.isScrubbing) {
      console.warn('⚠️ Attempted to stop scrubbing when not active');
      return { wasPlaying: false, finalPosition: 0 };
    }

    const result = {
      wasPlaying: this.wasPlaying,
      finalPosition: Math.max(0, Math.min(1, finalPosition || this.currentPosition)),
      shouldResume: shouldResume !== false ? this.wasPlaying : shouldResume
    };

    console.log(`🎚️ Scrub state stopped: finalPosition=${result.finalPosition.toFixed(3)}, shouldResume=${result.shouldResume}`);

    this.reset();
    return result;
  }

  setHasAudioSource(hasSource) {
    this.hasAudioSource = hasSource;
  }

  isActive() {
    return this.isScrubbing;
  }

  getState() {
    return {
      isScrubbing: this.isScrubbing,
      wasPlaying: this.wasPlaying,
      startPosition: this.startPosition,
      currentPosition: this.currentPosition,
      hasAudioSource: this.hasAudioSource,
      lastUpdateTime: this.lastUpdateTime
    };
  }
}

// ✅ NEW: Single source of truth for scrubbing state
const scrubState = new ScrubState();

// ✅ NEW: State management for preventing race conditions
let initializationPromise = null;
let resumePromise = null;
let isInitializing = false;

export async function initializeAudio() {
  // ✅ IMPROVED: Prevent concurrent initialization
  if (isInitializing || isInitialized) {
    if (initializationPromise) {
      return await initializationPromise;
    }
    if (isInitialized) {
      return;
    }
  }

  isInitializing = true;
  
  initializationPromise = (async () => {
    try {
      console.log('🎵 Creating audio context...');
      
      // ✅ IMPROVED: Better state checking and cleanup
      if (audioContext && audioContext.state === 'closed') {
        audioContext = null;
        gainNode = null;
        scrubGainNode = null;
        isInitialized = false;
      }
      
      if (!audioContext) {
        try {
          audioContext = new (window.AudioContext || window.webkitAudioContext)();
          
          // ✅ IMPROVED: Add error event listeners with null check
          if (audioContext) {
            audioContext.addEventListener('statechange', () => {
              if (audioContext && audioContext.state) {
                console.log(`🎵 Audio context state changed to: ${audioContext.state}`);
              }
            });
            
            gainNode = audioContext.createGain();
            gainNode.connect(audioContext.destination);
            
            // ✅ NEW: Create scrub gain node
            scrubGainNode = audioContext.createGain();
            scrubGainNode.connect(audioContext.destination);
            scrubGainNode.gain.value = 0.7; // Slightly quieter for scrubbing
            
            console.log('✅ Audio context created');
          } else {
            throw new Error('AudioContext creation returned null');
          }
        } catch (error) {
          console.error('❌ Failed to create AudioContext:', error);
          audioContext = null;
          return false;
        }
      }
      
      if (audioContext && audioContext.state) {
        console.log(`🎵 Audio context state: ${audioContext.state}`);
      } else {
        console.error('❌ AudioContext is null or has no state');
        return false;
      }
      
      isInitialized = true;
      console.log('✅ Audio initialization complete');
    } catch (error) {
      console.error('❌ Audio initialization failed:', error);
      isInitialized = false;
      throw error;
    } finally {
      isInitializing = false;
    }
  })();
  
  return await initializationPromise;
}

async function ensureAudioContextRunning() {
  // ✅ IMPROVED: Better state checking and race condition prevention
  if (!audioContext) {
    throw new Error('Audio context not initialized');
  }
  
  // ✅ IMPROVED: Check if audioContext has state property
  if (!audioContext.state) {
    throw new Error('Audio context has no state property');
  }
  
  // ✅ IMPROVED: Handle all possible states
  if (audioContext.state === 'closed') {
    throw new Error('Audio context is closed and cannot be resumed');
  }
  
  if (audioContext.state === 'suspended') {
    // ✅ IMPROVED: Prevent concurrent resume operations
    if (resumePromise) {
      return await resumePromise;
    }
    
    console.log('🎵 Resuming audio context...');
    resumePromise = audioContext.resume().then(() => {
      console.log('✅ Audio context resumed');
      resumePromise = null;
    }).catch((error) => {
      console.error('❌ Failed to resume audio context:', error);
      resumePromise = null;
      throw error;
    });
    
    return await resumePromise;
  }
  
  // ✅ IMPROVED: Handle 'running' and other states
  if (audioContext.state === 'running') {
    return; // Already running, nothing to do
  }
  
  // ✅ NEW: Log unexpected states
  console.warn(`⚠️ Unexpected audio context state: ${audioContext.state}`);
}

export async function loadAudioForPlayback(audioBuffer) {
  // ✅ IMPROVED: Better validation and error handling
  if (!audioBuffer) {
    throw new Error('No audio buffer provided');
  }
  
  try {
    if (!isInitialized) {
      await initializeAudio();
    }
    
    await ensureAudioContextRunning();
    
    stopAudio();
    
    window.currentAudioBuffer = audioBuffer;
    
    console.log('🎵 Audio loaded for playback');
  } catch (error) {
    console.error('❌ Failed to load audio for playback:', error);
    throw error;
  }
}

export async function playAudio(startTimeSeconds = 0) {
  // ✅ IMPROVED: Better validation and error handling
  if (!isInitialized || !window.currentAudioBuffer) {
    console.warn('Audio not initialized or no buffer loaded');
    return false;
  }
  
  // ✅ IMPROVED: Validate start time
  if (startTimeSeconds < 0) {
    startTimeSeconds = 0;
  }
  
  if (startTimeSeconds > window.currentAudioBuffer.duration) {
    console.warn(`Start time ${startTimeSeconds}s exceeds buffer duration ${window.currentAudioBuffer.duration}s`);
    startTimeSeconds = 0;
  }

  try {
    await ensureAudioContextRunning();
    
    stopAudio();
    
    // ✅ IMPROVED: Better error handling for source creation
    if (!audioContext || audioContext.state === 'closed') {
      throw new Error('Audio context is not available');
    }
    
    // Create new source
    audioSource = audioContext.createBufferSource();
    audioSource.buffer = window.currentAudioBuffer;
    audioSource.connect(gainNode);
    
    // ✅ IMPROVED: Add error event handler
    audioSource.addEventListener('error', (event) => {
      console.error('❌ Audio source error:', event);
      stopAudio();
    });
    
    startOffset = startTimeSeconds;
    const now = audioContext.currentTime;
    audioSource.start(0, startTimeSeconds);
    startTime = now;
    pauseTime = 0;
    
    console.log(`▶️ Playing audio from ${startTimeSeconds.toFixed(2)}s`);
    return true;
  } catch (error) {
    console.error('❌ Failed to play audio:', error);
    stopAudio();
    return false;
  }
}

export function pauseAudio() {
  if (audioSource) {
    const currentTime = getCurrentTime();
    audioSource.stop();
    audioSource = null;
    pauseTime = currentTime;
    console.log(`⏸️ Audio paused at ${pauseTime.toFixed(2)}s`);
  }
}

export function stopAudio() {
  // ✅ IMPROVED: Clean up scrubbing state when stopping audio
  if (scrubState.isActive()) {
    console.log('🛑 Stopping audio while scrubbing - cleaning up scrub state');
    scrubState.reset();
  }

  if (audioSource) {
    try {
      audioSource.stop();
    } catch (error) {
      console.warn('⚠️ Error stopping audio source:', error);
    }
    audioSource = null;
  }
  
  if (scrubSource) {
    try {
      scrubSource.stop();
    } catch (error) {
      console.warn('⚠️ Error stopping scrub source:', error);
    }
    scrubSource = null;
  }
  
  startTime = 0;
  pauseTime = 0;
  startOffset = 0;
}

// ✅ IMPROVED: Robust scrubbing with centralized state management
export function startScrubbing(position) {
  // ✅ NEW: Validate inputs
  if (typeof position !== 'number' || !isFinite(position)) {
    console.warn('⚠️ Invalid scrubbing position, using 0');
    position = 0;
  }
  
  position = Math.max(0, Math.min(1, position));
  
  if (!isInitialized || !window.currentAudioBuffer) {
    console.warn('⚠️ Cannot start scrubbing - audio not initialized');
    return false;
  }
  
  // ✅ IMPROVED: Check audioContext availability
  if (!audioContext || audioContext.state === 'closed') {
    console.warn('⚠️ Cannot start scrubbing - audio context not available');
    return false;
  }
  
  // Stop normal playback and remember state
  const wasPlaying = isAudioPlaying();
  if (audioSource) {
    try {
      audioSource.stop();
    } catch (error) {
      console.warn('⚠️ Error stopping audio source for scrubbing:', error);
    }
    audioSource = null;
  }
  
  // ✅ IMPROVED: Use centralized state management
  scrubState.startScrubbing(position, wasPlaying);
  
  // ✅ IMPROVED: Only create scrub audio source if we were playing
  if (wasPlaying) {
    try {
      scrubSource = audioContext.createBufferSource();
      scrubSource.buffer = window.currentAudioBuffer;
      scrubSource.connect(scrubGainNode);
      scrubSource.loop = true; // Enable looping for smooth scrubbing
      
      // ✅ IMPROVED: Add error handling for scrub source
      scrubSource.addEventListener('ended', () => {
        console.log('🎚️ Scrub source ended unexpectedly');
        scrubSource = null;
        scrubState.setHasAudioSource(false);
      });
      
      scrubSource.addEventListener('error', (event) => {
        console.error('❌ Scrub source error:', event);
        scrubSource = null;
        scrubState.setHasAudioSource(false);
      });
      
      // Start scrubbing from the specified position
      const startTime = position * window.currentAudioBuffer.duration;
      scrubSource.start(0, startTime);
      scrubSource.playbackRate.value = 0; // Start paused
      
      scrubState.setHasAudioSource(true);
      console.log(`🎚️ Started audio scrubbing from ${(position * 100).toFixed(1)}%`);
    } catch (error) {
      console.error('❌ Failed to create scrub source:', error);
      scrubSource = null;
      scrubState.setHasAudioSource(false);
    }
  } else {
    console.log(`🎚️ Started silent scrubbing from ${(position * 100).toFixed(1)}%`);
  }
  
  return wasPlaying;
}

// ✅ IMPROVED: Scrubbing update with state validation
export function updateScrubbing(velocity, position) {
  // ✅ NEW: Validate inputs
  if (typeof velocity !== 'number' || !isFinite(velocity)) {
    velocity = 0;
  }
  
  if (typeof position !== 'number' || !isFinite(position)) {
    console.warn('⚠️ Invalid scrubbing position in update');
    return false;
  }
  
  // ✅ IMPROVED: Check audioContext availability
  if (!audioContext || audioContext.state === 'closed') {
    console.warn('⚠️ Cannot update scrubbing - audio context not available');
    return false;
  }
  
  // ✅ IMPROVED: Use centralized state validation
  if (!scrubState.updateScrubbing(position, velocity)) {
    return false;
  }
  
  // ✅ IMPROVED: Only update audio scrubbing if we have a scrub source
  if (scrubSource && scrubState.getState().hasAudioSource) {
    try {
      // Convert velocity to playback rate
      const maxRate = 4;
      const minRate = -4;
      
      let playbackRate = velocity * 20;
      playbackRate = Math.max(minRate, Math.min(maxRate, playbackRate));
      
      // Smooth rate changes to avoid audio artifacts
      const smoothingTime = 0.02;
      scrubSource.playbackRate.setTargetAtTime(
        playbackRate, 
        audioContext.currentTime, 
        smoothingTime
      );
    } catch (error) {
      console.warn('⚠️ Error updating scrub playback rate:', error);
      // Don't fail the entire operation for playback rate errors
    }
  }
  
  // ✅ ALWAYS: Update visual playhead position regardless of audio
  if (window.currentAudioBuffer) {
    try {
      const timeSeconds = position * window.currentAudioBuffer.duration;
      setPlayhead(timeSeconds);
    } catch (error) {
      console.warn('⚠️ Error updating playhead position:', error);
    }
  }
  
  return true;
}

// ✅ IMPROVED: Stop scrubbing with comprehensive state management
export function stopScrubbing(finalPosition, shouldResumePlaying = null) {
  // ✅ NEW: Validate final position
  if (typeof finalPosition !== 'number' || !isFinite(finalPosition)) {
    console.warn('⚠️ Invalid final position for stopScrubbing, using current state');
    finalPosition = scrubState.getState().currentPosition;
  }
  
  // ✅ IMPROVED: Use centralized state management
  const scrubResult = scrubState.stopScrubbing(finalPosition, shouldResumePlaying);
  
  if (!scrubResult.wasPlaying && shouldResumePlaying === null) {
    // If we weren't playing and no explicit resume instruction, don't resume
    scrubResult.shouldResume = false;
  }
  
  // ✅ IMPROVED: Clean up scrub source with error handling
  if (scrubSource) {
    try {
      scrubSource.stop();
    } catch (error) {
      console.warn('⚠️ Error stopping scrub source:', error);
    }
    scrubSource = null;
    
    if (scrubResult.wasPlaying) {
      console.log(`🎚️ Stopped audio scrubbing at ${(scrubResult.finalPosition * 100).toFixed(1)}%`);
    } else {
      console.log(`🎚️ Stopped silent scrubbing at ${(scrubResult.finalPosition * 100).toFixed(1)}%`);
    }
  }
  
  // ✅ ALWAYS: Update visual position before resuming
  if (window.currentAudioBuffer) {
    try {
      const finalTimeSeconds = scrubResult.finalPosition * window.currentAudioBuffer.duration;
      setPlayhead(finalTimeSeconds);
      
      // Resume normal playback if requested
      if (scrubResult.shouldResume) {
        console.log(`🔄 Resuming playback from ${finalTimeSeconds.toFixed(2)}s`);
        playAudio(finalTimeSeconds);
      } else {
        // Update pause position
        pauseTime = finalTimeSeconds;
        startOffset = pauseTime;
      }
    } catch (error) {
      console.error('❌ Error in stopScrubbing cleanup:', error);
    }
  }
  
  return scrubResult;
}

// ✅ IMPROVED: Check scrubbing state using centralized management
export function isScrubbingActive() {
  return scrubState.isActive();
}

// ✅ NEW: Get detailed scrubbing state for debugging
export function getScrubState() {
  return scrubState.getState();
}

export function getCurrentTime() {
  if (!audioSource || !audioSource.buffer || !startTime) {
    const fallbackTime = pauseTime || 0;
    return fallbackTime;
  }
  
  const elapsed = audioContext.currentTime - startTime;
  const currentTime = startOffset + elapsed;
  
  return Math.max(0, Math.min(currentTime, audioSource.buffer.duration));
}

export function isAudioPlaying() {
  return audioSource !== null && startTime > 0;
}

export function seekTo(timeSeconds) {
  // ✅ IMPROVED: Don't seek during scrubbing using centralized state
  if (scrubState.isActive()) {
    console.log('🚫 Seek blocked - scrubbing is active');
    return;
  }
  
  const wasPlaying = isAudioPlaying();
  
  if (wasPlaying) {
    stopAudio();
    playAudio(timeSeconds);
  } else {
    pauseTime = timeSeconds;
    startOffset = timeSeconds;
  }
}

export function setVolume(volume) {
  if (gainNode) {
    gainNode.gain.value = Math.max(0, Math.min(1, volume));
  }
  if (scrubGainNode) {
    scrubGainNode.gain.value = Math.max(0, Math.min(1, volume * 0.7));
  }
}

// ✅ IMPROVED: Enhanced cleanup function with scrubbing state reset
export function cleanupAudio() {
  // ✅ NEW: Clean up scrubbing state first
  if (scrubState.isActive()) {
    console.log('🧹 Cleaning up active scrubbing state');
    scrubState.reset();
  }
  
  stopAudio();
  
  // ✅ IMPROVED: Reset all state variables
  initializationPromise = null;
  resumePromise = null;
  isInitializing = false;
  isInitialized = false;
  
  if (audioContext && audioContext.state !== 'closed') {
    try {
      audioContext.close();
    } catch (error) {
      console.warn('⚠️ Error closing audio context:', error);
    }
  }
  
  audioContext = null;
  gainNode = null;
  scrubGainNode = null;
  
  console.log('🧹 Audio cleanup completed');
}

// Add cleanup listener
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', cleanupAudio);
}