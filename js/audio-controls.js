import { getAudioState, setPlayhead, setPlayingState } from './audio-state.js';
import { playAudio, pauseAudio, seekTo, getCurrentTime, isAudioPlaying, isScrubbingActive } from './audio-playback.js';
import { CONFIG } from './utils.js'; // Add this missing import!
import { AudioValidation, ValidationError, safeExecute, withValidation, TypeValidator } from './validation.js';
import { audio, system } from './logger.js';

// ✅ ENHANCED: Toggle play/pause with comprehensive validation
export async function togglePlayPause() {
  try {
    audio('🎵 togglePlayPause called');
    const audioState = getAudioState();
    
    audio('📊 Audio state:', {
      hasAudioState: !!audioState,
      hasAudioBuffer: !!audioState?.audioBuffer,
      isPlaying: audioState?.isPlaying,
      duration: audioState?.duration
    });
    
    // ✅ NEW: Validate audio state and buffer
    if (!audioState || typeof audioState !== 'object') {
      system('Invalid audio state object', 'error', audioState);
      return false;
    }
    
    if (!audioState.audioBuffer) {
      audio('No audio buffer loaded', 'warn');
      return false;
    }
    
    // ✅ NEW: Validate audio buffer
    try {
      AudioValidation.validateAudioBuffer(audioState.audioBuffer, 'toggle play/pause');
    } catch (error) {
      if (error instanceof ValidationError) {
        audio(`Audio buffer validation failed: ${error.message}`, 'error');
        return false;
      }
      throw error;
    }
    
    if (audioState.isPlaying) {
      // Pause
      const pauseResult = safeExecute(() => pauseAudio(), false, 'pauseAudio');
      if (pauseResult !== false) {
        setPlayingState(false);
        audio('Paused', 'info');
        return false;
      } else {
        audio('Failed to pause audio', 'error');
        return false;
      }
    } else {
      // Play
      // ✅ NEW: Validate playhead before playing
      const validatedPlayhead = AudioValidation.validatePlayhead(audioState.currentPlayhead, 'play position');
      
      const success = await safeExecute(
        () => playAudio(validatedPlayhead), 
        false, 
        'playAudio'
      );
      
      if (success) {
        setPlayingState(true);
        audio('Playing', 'info');
        return true;
      } else {
        audio('Failed to start playback', 'error');
        return false;
      }
    }
  } catch (error) {
    system('Error in togglePlayPause', 'error', error);
    return false;
  }
}

// ✅ ENHANCED: Seek to position with comprehensive validation
export const seekToPosition = withValidation(
  function(normalizedPosition) {
    const audioState = getAudioState();
    if (!audioState || typeof audioState !== 'object') {
      system('Invalid audio state object in seekToPosition', 'error', audioState);
      return false;
    }
    
    if (!audioState.audioBuffer) {
      audio('No audio buffer for seeking', 'warn');
      return false;
    }
    
    // Calculate time position
    const timePosition = normalizedPosition * audioState.duration;
    
    // Update playhead state
    setPlayhead(timePosition);
    
    // If scrubbing is active, don't interfere
    if (isScrubbingActive()) {
      audio('Seek blocked - scrubbing is active', 'debug');
      return false;
    }
    
    // Perform actual seek
    const success = safeExecute(
      () => seekTo(timePosition),
      false,
      'seekTo'
    );
    
    if (success) {
      audio(`Seeked to position: ${(normalizedPosition * 100).toFixed(1)}%`, 'debug');
      return true;
    } else {
      audio('Seek operation failed', 'warn');
      return false;
    }
  },
  [
    // Parameter validators
    (pos) => TypeValidator.isNumber(pos, { min: 0, max: 1 }) // normalizedPosition
  ],
  // Return validator
  (result) => typeof result === 'boolean',
  'seekToPosition'
);

// ✅ ENHANCED: Relative seek with validation
export const seekRelative = withValidation(
  function(offsetSeconds) {
    const audioState = getAudioState();
    if (!audioState || !audioState.audioBuffer) {
      audio('No audio loaded for relative seek', 'warn');
      return false;
    }
    
    const currentTime = getCurrentTime();
    const newTime = Math.max(0, Math.min(audioState.duration, currentTime + offsetSeconds));
    const normalizedPosition = audioState.duration > 0 ? newTime / audioState.duration : 0;
    
    return seekToPosition(normalizedPosition);
  },
  [
    // Parameter validators  
    (offset) => TypeValidator.isNumber(offset, { allowInfinite: false }) // offsetSeconds
  ],
  // Return validator
  (result) => typeof result === 'boolean',
  'seekRelative'
);

// ✅ ENHANCED: Update playhead from audio with validation
export function updatePlayheadFromAudio() {
  try {
    const audioState = getAudioState();
    
    // Don't update playhead from audio during scrubbing
    if (isScrubbingActive()) {
      return false;
    }
    
    if (!audioState.isPlaying || !audioState.audioBuffer) return false;
    
    const currentTime = getCurrentTime();
    if (TypeValidator.isNumber(currentTime, { min: 0, allowInfinite: false })) {
      setPlayhead(currentTime);
      
      // ✅ SIMPLE: Just stop playback at end, let animation.js handle the reset
      if (currentTime >= audioState.duration - 0.1) {
        setPlayingState(false);
        pauseAudio();
        audio('Playback completed, stopping playback', 'info');
        return true; // Signal that playback ended
      }
    } else {
      audio('Invalid current time from audio context', 'warn', currentTime);
    }
    
    return false;
  } catch (error) {
    system('Error updating playhead from audio', 'error', error);
    return false;
  }
}