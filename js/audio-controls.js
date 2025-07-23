import { getAudioState, setPlayhead, setPlayingState } from './audio-state.js';
import { playAudio, pauseAudio, seekTo, getCurrentTime, isAudioPlaying, isScrubbingActive } from './audio-playback.js';
import { CONFIG } from './utils.js'; // Add this missing import!

export async function togglePlayPause() {
  const audioState = getAudioState();
  if (!audioState.audioBuffer) {
    console.warn('⚠️ No audio buffer loaded');
    return false;
  }
  
  if (audioState.isPlaying) {
    // Pause
    pauseAudio();
    setPlayingState(false);
    console.log('⏸️ Paused');
    return false;
  } else {
    // Play
    const success = await playAudio(audioState.currentPlayhead);
    if (success) {
      setPlayingState(true);
      console.log('▶️ Playing');
      return true;
    }
  }
  
  return false;
}

export function seekToPosition(normalizedPosition) {
  const audioState = getAudioState();
  if (!audioState.audioBuffer) {
    console.warn('⚠️ No audio buffer for seeking');
    return;
  }
  
  // Clamp position to valid range
  const clampedPosition = Math.max(0, Math.min(1, normalizedPosition));
  const targetTime = clampedPosition * audioState.duration;
  
  // Update audio state
  setPlayhead(targetTime);
  
  // Seek audio playback
  seekTo(targetTime);
  
  if (CONFIG.DEBUG_LOGGING) {
    console.log(`🎯 Seeked to ${targetTime.toFixed(2)}s (${(clampedPosition * 100).toFixed(1)}%)`);
  }
}

export function seekRelative(deltaSeconds) {
  const audioState = getAudioState();
  if (!audioState.audioBuffer) return;
  
  const newTime = audioState.currentPlayhead + deltaSeconds;
  const clampedTime = Math.max(0, Math.min(newTime, audioState.duration));
  
  setPlayhead(clampedTime);
  seekTo(clampedTime);
  
  console.log(`🎯 Seeked ${deltaSeconds > 0 ? 'forward' : 'backward'} to ${clampedTime.toFixed(2)}s`);
}

export function updatePlayheadFromAudio() {
  const audioState = getAudioState();
  
  // Don't update playhead from audio during scrubbing
  if (isScrubbingActive()) {
    return false;
  }
  
  if (!audioState.isPlaying || !audioState.audioBuffer) return false;
  
  const currentTime = getCurrentTime();
  setPlayhead(currentTime);
  
  // ✅ SIMPLE: Just stop playback at end, let animation.js handle the reset
  if (currentTime >= audioState.duration - 0.1) {
    setPlayingState(false);
    pauseAudio();
    console.log('🎵 Playback completed, stopping playback');
    return true; // Signal that playback ended
  }
  
  return false;
}