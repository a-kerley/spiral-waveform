import { setPlayhead } from './audio-state.js'; // ✅ ADD THIS IMPORT

let audioContext = null;
let audioSource = null;
let scrubSource = null; // ✅ NEW: Separate source for scrubbing
let gainNode = null;
let scrubGainNode = null; // ✅ NEW: Separate gain for scrubbing
let startTime = 0;
let pauseTime = 0;
let startOffset = 0;
let isInitialized = false;
let isScrubbing = false; // ✅ NEW: Track scrubbing state

export async function initializeAudio() {
  try {
    console.log('🎵 Creating audio context...');
    
    if (!audioContext) {
      audioContext = new (window.AudioContext || window.webkitAudioContext)();
      gainNode = audioContext.createGain();
      gainNode.connect(audioContext.destination);
      
      // ✅ NEW: Create scrub gain node
      scrubGainNode = audioContext.createGain();
      scrubGainNode.connect(audioContext.destination);
      scrubGainNode.gain.value = 0.7; // Slightly quieter for scrubbing
      
      console.log('✅ Audio context created');
    }
    
    console.log(`🎵 Audio context state: ${audioContext.state}`);
    
    isInitialized = true;
    console.log('✅ Audio initialization complete');
  } catch (error) {
    console.error('❌ Audio initialization failed:', error);
    throw error;
  }
}

async function ensureAudioContextRunning() {
  if (audioContext && audioContext.state === 'suspended') {
    console.log('🎵 Resuming audio context...');
    try {
      await audioContext.resume();
      console.log('✅ Audio context resumed');
    } catch (error) {
      console.error('❌ Failed to resume audio context:', error);
    }
  }
}

export async function loadAudioForPlayback(audioBuffer) {
  if (!isInitialized) {
    await initializeAudio();
  }
  
  await ensureAudioContextRunning();
  
  stopAudio();
  
  window.currentAudioBuffer = audioBuffer;
  
  console.log('🎵 Audio loaded for playback');
}

export async function playAudio(startTimeSeconds = 0) {
  if (!isInitialized || !window.currentAudioBuffer) {
    console.warn('Audio not initialized or no buffer loaded');
    return false;
  }

  await ensureAudioContextRunning();
  
  stopAudio();
  
  // Create new source
  audioSource = audioContext.createBufferSource();
  audioSource.buffer = window.currentAudioBuffer;
  audioSource.connect(gainNode);
  
  startOffset = startTimeSeconds;
  const now = audioContext.currentTime;
  audioSource.start(0, startTimeSeconds);
  startTime = now;
  pauseTime = 0;
  
  console.log(`▶️ Playing audio from ${startTimeSeconds.toFixed(2)}s`);
  return true;
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
  if (audioSource) {
    audioSource.stop();
    audioSource = null;
  }
  if (scrubSource) {
    scrubSource.stop();
    scrubSource = null;
  }
  startTime = 0;
  pauseTime = 0;
  startOffset = 0;
  isScrubbing = false;
}

// ✅ UPDATED: Start scrubbing mode with conditional audio
export function startScrubbing(position) {
  if (!isInitialized || !window.currentAudioBuffer) return;
  
  // Stop normal playback but remember if we were playing
  const wasPlaying = isAudioPlaying();
  if (audioSource) {
    audioSource.stop();
    audioSource = null;
  }
  
  // ✅ UPDATED: Only create scrub audio source if we were playing
  if (wasPlaying) {
    // Create scrub source for audio feedback during drag
    scrubSource = audioContext.createBufferSource();
    scrubSource.buffer = window.currentAudioBuffer;
    scrubSource.connect(scrubGainNode);
    scrubSource.loop = true; // Enable looping for smooth scrubbing
    
    // Start scrubbing from the specified position
    const startTime = position * window.currentAudioBuffer.duration;
    scrubSource.start(0, startTime);
    scrubSource.playbackRate.value = 0; // Start paused
    
    console.log(`🎚️ Started audio scrubbing from ${(position * 100).toFixed(1)}%`);
  } else {
    console.log(`🎚️ Started silent scrubbing from ${(position * 100).toFixed(1)}%`);
  }
  
  isScrubbing = true;
  return wasPlaying;
}

// ✅ UPDATED: Update scrubbing with conditional audio
export function updateScrubbing(velocity, position) {
  if (!isScrubbing) return;
  
  // ✅ UPDATED: Only update audio scrubbing if we have a scrub source (i.e., was playing)
  if (scrubSource) {
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
  }
  
  // ✅ ALWAYS: Update visual playhead position regardless of audio
  if (window.currentAudioBuffer) {
    const timeSeconds = position * window.currentAudioBuffer.duration;
    setPlayhead(timeSeconds);
  }
}

// ✅ UPDATED: Stop scrubbing with conditional cleanup
export function stopScrubbing(finalPosition, shouldResumePlaying = false) {
  if (!isScrubbing) return;
  
  // ✅ UPDATED: Only stop scrub source if it exists
  if (scrubSource) {
    scrubSource.stop();
    scrubSource = null;
    console.log(`🎚️ Stopped audio scrubbing at ${(finalPosition * 100).toFixed(1)}%`);
  } else {
    console.log(`🎚️ Stopped silent scrubbing at ${(finalPosition * 100).toFixed(1)}%`);
  }
  
  isScrubbing = false;
  
  // Always update visual position before resuming
  if (window.currentAudioBuffer) {
    const finalTimeSeconds = finalPosition * window.currentAudioBuffer.duration;
    setPlayhead(finalTimeSeconds);
  }
  
  // Resume normal playback if requested
  if (shouldResumePlaying) {
    const finalTimeSeconds = finalPosition * window.currentAudioBuffer.duration;
    playAudio(finalTimeSeconds);
  } else {
    // Update pause position
    pauseTime = finalPosition * window.currentAudioBuffer.duration;
    startOffset = pauseTime;
  }
}

// ✅ NEW: Check if currently scrubbing
export function isScrubbingActive() {
  return isScrubbing;
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
  // ✅ UPDATED: Don't seek during scrubbing
  if (isScrubbing) return;
  
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

// ✅ ADD: Cleanup function for page unload
export function cleanupAudio() {
  stopAudio();
  
  if (audioContext && audioContext.state !== 'closed') {
    audioContext.close();
  }
  
  audioContext = null;
  gainNode = null;
  scrubGainNode = null;
  isInitialized = false;
}

// Add cleanup listener
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', cleanupAudio);
}