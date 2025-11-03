import { setPlayhead } from './audio-state.js';
import { audio, system } from './logger.js';
import { scrubStateAdapter } from './interaction-state-adapter.js'; // ✅ NEW: Use centralized interaction state

let audioContext = null;
let audioSource = null;
let scrubSource = null;
let gainNode = null;
let scrubGainNode = null;
let startTime = 0;
let pauseTime = 0;
let startOffset = 0;
let isInitialized = false;

// ✅ MIGRATION NOTE: ScrubState class removed - now using scrubStateAdapter from interaction-state-adapter.js
// This consolidates all interaction state (scrubbing, dragging) in StateManager

// State management for preventing race conditions
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
      audio('🎵 Audio: Creating audio context');
      
      // ✅ IMPROVED: Better state checking and cleanup
      if (audioContext && audioContext.state === 'closed') {
        audio('🔄 Audio: Cleaning up closed audio context');
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
                audio(`🔄 Audio: Context state → ${audioContext.state}`);
              }
            });
            
            gainNode = audioContext.createGain();
            gainNode.connect(audioContext.destination);
            
            // ✅ NEW: Create scrub gain node
            scrubGainNode = audioContext.createGain();
            scrubGainNode.connect(audioContext.destination);
            scrubGainNode.gain.value = 0.7; // Slightly quieter for scrubbing
            
            audio('✅ Audio: Context created', 'info', { sampleRate: audioContext.sampleRate });
          } else {
            throw new Error('AudioContext creation returned null');
          }
        } catch (error) {
          system('❌ Audio: Failed to create AudioContext', 'error', error);
          audioContext = null;
          return false;
        }
      }
      
      if (audioContext && audioContext.state) {
        audio(`🎵 Audio: Context state is ${audioContext.state}`);
      } else {
        system('❌ Audio: Context is null or has no state', 'error');
        return false;
      }
      
      isInitialized = true;
      audio('✅ Audio: Initialization complete');
    } catch (error) {
      system('❌ Audio: Initialization failed', 'error', error);
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
    
    audio('🔄 Audio: Resuming suspended context');
    resumePromise = audioContext.resume().then(() => {
      audio('✅ Audio: Context resumed');
      resumePromise = null;
    }).catch((error) => {
      system('❌ Audio: Failed to resume context', 'error', error);
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
  system(`⚠️ Audio: Unexpected context state: ${audioContext.state}`, 'warn');
}

export async function loadAudioForPlayback(audioBuffer) {
  // ✅ NEW: Skip buffer loading for URL audio - use HTML audio element instead
  if (window.urlAudioElement) {
    audio('🎵 Audio: URL element ready for playback');
    return;
  }
  
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
    
    audio('🎵 Audio: Buffer loaded for playback', 'info', { 
      duration: audioBuffer.duration.toFixed(2),
      channels: audioBuffer.numberOfChannels 
    });
  } catch (error) {
    system('❌ Audio: Failed to load for playback', 'error', error);
    throw error;
  }
}

export async function playAudio(startTimeSeconds = 0) {
  // Check if we have URL-loaded audio element
  if (window.urlAudioElement) {
    return playUrlAudio(startTimeSeconds);
  }
  
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
      system('❌ Audio: Source error', 'error', event);
      stopAudio();
    });
    
    startOffset = startTimeSeconds;
    const now = audioContext.currentTime;
    audioSource.start(0, startTimeSeconds);
    startTime = now;
    pauseTime = 0;
    
    audio(`▶️ Audio: Playing from ${startTimeSeconds.toFixed(2)}s`);
    return true;
  } catch (error) {
    system('❌ Audio: Play failed', 'error', error);
    stopAudio();
    return false;
  }
}

// ✅ NEW: Handle URL audio playback (MediaElement approach like WaveSurfer)
async function playUrlAudio(startTimeSeconds = 0) {
  try {
    const audio = window.urlAudioElement;
    if (!audio) {
      console.warn('No URL audio element available');
      return false;
    }
    
    console.log('🎵 URL audio element state:', {
      src: audio.src,
      duration: audio.duration,
      currentTime: audio.currentTime,
      paused: audio.paused,
      readyState: audio.readyState,
      networkState: audio.networkState
    });
    
    // Validate start time
    if (startTimeSeconds < 0) {
      startTimeSeconds = 0;
    }
    
    if (startTimeSeconds > audio.duration) {
      console.warn(`Start time ${startTimeSeconds}s exceeds audio duration ${audio.duration}s`);
      startTimeSeconds = 0;
    }
    
    // Set current time and play
    audio.currentTime = startTimeSeconds;
    
    console.log('🎵 Attempting to play URL audio...');
    const playPromise = audio.play();
    if (playPromise !== undefined) {
      await playPromise;
    }
    
    console.log(`▶️ Playing URL audio from ${startTimeSeconds.toFixed(2)}s`);
    return true;
    
  } catch (error) {
    console.error('❌ Failed to play URL audio:', error);
    return false;
  }
}

export function pauseAudio() {
  // Handle URL audio
  if (window.urlAudioElement) {
    window.urlAudioElement.pause();
    audio(`⏸️ Audio: URL paused at ${window.urlAudioElement.currentTime.toFixed(2)}s`);
    return;
  }
  
  // Handle buffer audio
  if (audioSource) {
    const currentTime = getCurrentTime();
    audioSource.stop();
    audioSource = null;
    pauseTime = currentTime;
    audio(`⏸️ Audio: Paused at ${pauseTime.toFixed(2)}s`);
  }
}

export function stopAudio() {
  // ✅ IMPROVED: Clean up scrubbing state when stopping audio
  if (scrubStateAdapter.isActive()) {
    audio('🛑 Audio: Stopping while scrubbing - cleaning up');
    scrubStateAdapter.reset();
  }

  // Handle URL audio
  if (window.urlAudioElement) {
    window.urlAudioElement.pause();
    window.urlAudioElement.currentTime = 0;
    audio('🛑 Audio: URL audio stopped');
    return;
  }

  // Handle buffer audio
  if (audioSource) {
    try {
      audioSource.stop();
      audio('🛑 Audio: Source stopped');
    } catch (error) {
      system('⚠️ Audio: Error stopping source', 'warn', error);
    }
    audioSource = null;
  }
  
  if (scrubSource) {
    try {
      scrubSource.stop();
    } catch (error) {
      system('⚠️ Audio: Error stopping scrub source', 'warn', error);
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
  
  // ✅ NEW: Check for either buffer audio OR URL audio
  const hasBufferAudio = isInitialized && window.currentAudioBuffer;
  const hasUrlAudio = window.urlAudioElement;
  
  if (!hasBufferAudio && !hasUrlAudio) {
    console.warn('⚠️ Cannot start scrubbing - no audio loaded');
    return false;
  }
  
  // Handle URL audio scrubbing differently
  if (hasUrlAudio && !hasBufferAudio) {
    return startUrlScrubbing(position);
  }
  
  // ✅ IMPROVED: Check audioContext availability for buffer audio
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
  scrubStateAdapter.startScrubbing(position, wasPlaying);
  
  // ✅ IMPROVED: Only create scrub audio source if we were playing
  if (wasPlaying) {
    try {
      scrubSource = audioContext.createBufferSource();
      scrubSource.buffer = window.currentAudioBuffer;
      scrubSource.connect(scrubGainNode);
      scrubSource.loop = true; // Enable looping for smooth scrubbing
      
      // ✅ IMPROVED: Add error handling for scrub source
      scrubSource.addEventListener('ended', () => {
        audio('🎚️ Audio: Scrub source ended');
        scrubSource = null;
        scrubStateAdapter.setHasAudioSource(false);
      });
      
      scrubSource.addEventListener('error', (event) => {
        system('❌ Audio: Scrub source error', 'error', event);
        scrubSource = null;
        scrubStateAdapter.setHasAudioSource(false);
      });
      
      // Start scrubbing from the specified position
      const startTime = position * window.currentAudioBuffer.duration;
      scrubSource.start(0, startTime);
      scrubSource.playbackRate.value = 0; // Start paused
      
      scrubStateAdapter.setHasAudioSource(true);
      audio(`🎚️ Audio: Scrubbing started`, 'info', { position: (position * 100).toFixed(1) + '%' });
    } catch (error) {
      system('❌ Audio: Failed to create scrub source', 'error', error);
      scrubSource = null;
      scrubStateAdapter.setHasAudioSource(false);
    }
  } else {
    audio(`🎚️ Audio: Silent scrubbing started`, 'info', { position: (position * 100).toFixed(1) + '%' });
  }
  
  return wasPlaying;
}

// ✅ NEW: Handle URL audio scrubbing (simplified approach)
function startUrlScrubbing(position) {
  try {
    const audioElement = window.urlAudioElement;
    if (!audioElement || !audioElement.duration) {
      console.warn('⚠️ Cannot scrub URL audio - no duration available');
      return false;
    }
    
    const wasPlaying = !audioElement.paused;
    const targetTime = position * audioElement.duration;
    
    // For URL audio, we'll use a simplified scrubbing approach
    // Just set the time directly and track the state
    audioElement.currentTime = targetTime;
    
    // Use the same scrub state system for consistency
    scrubStateAdapter.startScrubbing(position, wasPlaying);
    
    audio('Started URL audio scrubbing', 'debug', {
      position,
      targetTime: targetTime.toFixed(3),
      wasPlaying
    });
    
    return true;
    
  } catch (error) {
    console.error('❌ Failed to start URL audio scrubbing:', error);
    return false;
  }
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
  
  // Handle URL audio scrubbing
  if (window.urlAudioElement) {
    return updateUrlScrubbing(position);
  }
  
  // ✅ IMPROVED: Check audioContext availability for buffer audio
  if (!audioContext || audioContext.state === 'closed') {
    console.warn('⚠️ Cannot update scrubbing - audio context not available');
    return false;
  }
  
  // ✅ IMPROVED: Use centralized state validation
  if (!scrubStateAdapter.updateScrubbing(position, velocity)) {
    return false;
  }
  
  // ✅ IMPROVED: Only update audio scrubbing if we have a scrub source
  if (scrubSource && scrubStateAdapter.getState().hasAudioSource) {
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

// ✅ NEW: Handle URL audio scrubbing updates
function updateUrlScrubbing(position) {
  try {
    const audioElement = window.urlAudioElement;
    if (!audioElement || !audioElement.duration) {
      return false;
    }
    
    const targetTime = position * audioElement.duration;
    audioElement.currentTime = targetTime;
    
    // Update scrub state
    scrubStateAdapter.updateScrubbing(position);
    
    return true;
    
  } catch (error) {
    console.error('❌ Failed to update URL audio scrubbing:', error);
    return false;
  }
}

// ✅ IMPROVED: Stop scrubbing with comprehensive state management
export function stopScrubbing(finalPosition, shouldResumePlaying = null) {
  // ✅ NEW: Validate final position
  if (typeof finalPosition !== 'number' || !isFinite(finalPosition)) {
    console.warn('⚠️ Invalid final position for stopScrubbing, using current state');
    finalPosition = scrubStateAdapter.getState().currentPosition;
  }
  
  // Handle URL audio scrubbing
  if (window.urlAudioElement) {
    return stopUrlScrubbing(finalPosition, shouldResumePlaying);
  }
  
  // ✅ IMPROVED: Use centralized state management
  const scrubResult = scrubStateAdapter.stopScrubbing(finalPosition, shouldResumePlaying);
  
  if (!scrubResult.wasPlaying && shouldResumePlaying === null) {
    // If we weren't playing and no explicit resume instruction, don't resume
    scrubResult.shouldResume = false;
  }
  
  // ✅ IMPROVED: Clean up scrub source with error handling
  if (scrubSource) {
    try {
      scrubSource.stop();
    } catch (error) {
      system('⚠️ Audio: Error stopping scrub source', 'warn', error);
    }
    scrubSource = null;
    
    if (scrubResult.wasPlaying) {
      audio(`🎚️ Audio: Scrubbing stopped`, 'info', { position: (scrubResult.finalPosition * 100).toFixed(1) + '%' });
    } else {
      audio(`🎚️ Audio: Silent scrubbing stopped`, 'info', { position: (scrubResult.finalPosition * 100).toFixed(1) + '%' });
    }
  }
  
  // ✅ ALWAYS: Update visual position before resuming
  if (window.currentAudioBuffer) {
    try {
      const finalTimeSeconds = scrubResult.finalPosition * window.currentAudioBuffer.duration;
      setPlayhead(finalTimeSeconds);
      
      // Resume normal playback if requested
      if (scrubResult.shouldResume) {
        audio(`🔄 Audio: Resuming playback`, 'info', { from: finalTimeSeconds.toFixed(2) + 's' });
        playAudio(finalTimeSeconds);
      } else {
        // Update pause position
        pauseTime = finalTimeSeconds;
        startOffset = pauseTime;
      }
    } catch (error) {
      system('❌ Audio: Error in stopScrubbing cleanup', 'error', error);
    }
  }
  
  return scrubResult;
}

// ✅ IMPROVED: Check scrubbing state using centralized management
export function isScrubbingActive() {
  return scrubStateAdapter.isActive();
}

// ✅ NEW: Get detailed scrubbing state for debugging
export function getScrubState() {
  return scrubStateAdapter.getState();
}

// ✅ NEW: Handle URL audio scrubbing stop
function stopUrlScrubbing(finalPosition, shouldResumePlaying = null) {
  try {
    const audioElement = window.urlAudioElement;
    if (!audioElement) {
      return { finalPosition: 0, shouldResume: false };
    }
    
    // Get scrub state before resetting
    const scrubResult = scrubStateAdapter.stopScrubbing(finalPosition, shouldResumePlaying);
    
    // Set final position
    const targetTime = finalPosition * audioElement.duration;
    audioElement.currentTime = targetTime;
    
    // Resume playback if needed
    if (scrubResult.shouldResume) {
      audioElement.play().catch(error => {
        console.error('❌ Failed to resume URL audio after scrubbing:', error);
      });
    }
    
    audio('Stopped URL audio scrubbing', 'debug', {
      finalPosition,
      targetTime: targetTime.toFixed(3),
      shouldResume: scrubResult.shouldResume
    });
    
    return scrubResult;
    
  } catch (error) {
    console.error('❌ Failed to stop URL audio scrubbing:', error);
    return { finalPosition: 0, shouldResume: false };
  }
}

export function getCurrentTime() {
  // Handle URL audio
  if (window.urlAudioElement) {
    return window.urlAudioElement.currentTime || 0;
  }
  
  // Handle buffer audio
  if (!audioSource || !audioSource.buffer || !startTime) {
    const fallbackTime = pauseTime || 0;
    return fallbackTime;
  }
  
  const elapsed = audioContext.currentTime - startTime;
  const currentTime = startOffset + elapsed;
  
  return Math.max(0, Math.min(currentTime, audioSource.buffer.duration));
}

export function isAudioPlaying() {
  // Handle URL audio
  if (window.urlAudioElement) {
    return !window.urlAudioElement.paused;
  }
  
  // Handle buffer audio
  return audioSource !== null && startTime > 0;
}

export function seekTo(timeSeconds) {
  // ✅ IMPROVED: Don't seek during scrubbing using centralized state
  if (scrubStateAdapter.isActive()) {
    console.log('🚫 Seek blocked - scrubbing is active');
    return;
  }
  
  // Handle URL audio
  if (window.urlAudioElement) {
    const wasPlaying = !window.urlAudioElement.paused;
    window.urlAudioElement.currentTime = timeSeconds;
    // No need to restart playback for URL audio - it continues playing
    return;
  }
  
  // Handle buffer audio
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
  // Handle URL audio
  if (window.urlAudioElement) {
    window.urlAudioElement.volume = Math.max(0, Math.min(1, volume));
  }
  
  // Handle buffer audio
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
  if (scrubStateAdapter.isActive()) {
    console.log('🧹 Cleaning up active scrubbing state');
    scrubStateAdapter.reset();
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