import { CONFIG } from './utils.js';
import { TypeValidator, AudioValidation, ValidationError, ensureType, safeParseNumber } from './validation.js';
import { system, audio } from './logger.js';

// Cache for performance optimization
let cachedFullFileDownsampled = null;
let cachedFullFileNumPoints = null;

// ✅ NEW: Add phantom padding to waveform data
const PHANTOM_PADDING_SECONDS = 30;

export function downsample(data, numSamples) {
  try {
    // TEMPORARY: Simplified version to bypass validation issues
    if (!data || data.length === 0) {
      return new Array(numSamples || 1500).fill(0);
    }
    
    const validatedNumSamples = numSamples || 1500;
    
    if (data.length <= validatedNumSamples) {
      const result = Array.from(data);
      while (result.length < validatedNumSamples) {
        result.push(0);
      }
      return result;
    }
    
    const blockSize = Math.floor(data.length / validatedNumSamples);
    if (blockSize <= 0) {
      return new Array(validatedNumSamples).fill(0);
    }
    
    const filtered = [];

    for (let i = 0; i < validatedNumSamples; i++) {
      let maxInBlock = 0;
      const startIndex = i * blockSize;
      const endIndex = Math.min(startIndex + blockSize, data.length);
      
      for (let j = startIndex; j < endIndex; j++) {
        // Use raw values directly (validation was causing the zero issue)
        const value = data[j];
        const absValue = Math.abs(value);
        if (absValue > maxInBlock) {
          maxInBlock = absValue;
        }
      }
      filtered.push(maxInBlock);
    }

    return filtered;
  } catch (error) {
    system('Error in downsample function', 'error', error);
    return new Array(Math.max(0, numSamples || 0)).fill(0);
  }
}

// ✅ IMPROVED: Enhanced full file downsampling with better validation
export function getFullFileDownsampled(audioData, numPoints = CONFIG.NUM_POINTS, sampleRate = 44100) {
  // ✅ NEW: Input validation to prevent edge case failures
  if (!audioData || audioData.length === 0) {
    console.warn('⚠️ getFullFileDownsampled: Empty or invalid audio data provided');
    return new Array(Math.max(numPoints, 0)).fill(0);
  }
  
  if (typeof numPoints !== 'number' || numPoints <= 0 || !isFinite(numPoints)) {
    console.warn('⚠️ getFullFileDownsampled: Invalid numPoints, using default');
    numPoints = CONFIG.NUM_POINTS || 1000;
  }
  
  // ✅ IMPROVED: Cache validation with better checks
  const cacheValid = cachedFullFileDownsampled && 
                    cachedFullFileNumPoints === numPoints &&
                    cachedFullFileDownsampled.length === numPoints;
  
  if (!cacheValid) {
    try {
      // ✅ CHANGED: Use original audio data without phantom padding for full view
      cachedFullFileDownsampled = downsample(audioData, numPoints);
      cachedFullFileNumPoints = numPoints;
      
      // ✅ NEW: Validate cache result
      if (!cachedFullFileDownsampled || cachedFullFileDownsampled.length !== numPoints) {
        console.warn('⚠️ getFullFileDownsampled: Cache result validation failed, creating fallback');
        cachedFullFileDownsampled = new Array(numPoints).fill(0);
      }
      
      console.log(`📊 Full file downsampled (no phantom): ${audioData.length} -> ${numPoints} points`);
    } catch (error) {
      console.error('❌ getFullFileDownsampled: Error during downsampling:', error);
      cachedFullFileDownsampled = new Array(numPoints).fill(0);
    }
  }
  
  return cachedFullFileDownsampled;
}

export function clearCache() {
  cachedFullFileDownsampled = null;
  cachedFullFileNumPoints = null;
}

// ✅ NEW: Utility function to validate phantom padding parameters
export function validatePhantomPaddingParams(waveform, playhead, actualDuration, sampleRate, paddingSeconds) {
  const issues = [];
  
  if (!waveform || waveform.length === 0) {
    issues.push('Empty or invalid waveform');
  }
  
  if (typeof playhead !== 'number' || !isFinite(playhead) || playhead < 0 || playhead > 1) {
    issues.push(`Invalid playhead: ${playhead} (should be 0-1)`);
  }
  
  if (typeof actualDuration !== 'number' || actualDuration <= 0 || !isFinite(actualDuration)) {
    issues.push(`Invalid duration: ${actualDuration} (should be > 0)`);
  }
  
  if (typeof sampleRate !== 'number' || sampleRate <= 0 || !isFinite(sampleRate)) {
    issues.push(`Invalid sample rate: ${sampleRate} (should be > 0)`);
  }
  
  if (typeof paddingSeconds !== 'number' || paddingSeconds < 0 || !isFinite(paddingSeconds)) {
    issues.push(`Invalid padding: ${paddingSeconds} (should be >= 0)`);
  }
  
  if (waveform && sampleRate && actualDuration) {
    const expectedLength = Math.floor(actualDuration * sampleRate);
    if (Math.abs(waveform.length - expectedLength) > sampleRate * 0.1) { // Allow 0.1s tolerance
      issues.push(`Waveform length mismatch: ${waveform.length} vs expected ${expectedLength}`);
    }
  }
  
  return {
    isValid: issues.length === 0,
    issues: issues
  };
}

// ✅ IMPROVED: Robust phantom padding with comprehensive edge case handling
export function prepareWindowData(waveform, playhead, actualDuration, sampleRate, paddingSeconds = PHANTOM_PADDING_SECONDS) {
  // ✅ NEW: Input validation to prevent edge case failures
  if (!waveform || waveform.length === 0) {
    console.warn('⚠️ prepareWindowData: Empty or invalid waveform provided');
    return new Float32Array(Math.max(CONFIG.WINDOW_DURATION * sampleRate, 0));
  }
  
  if (typeof playhead !== 'number' || !isFinite(playhead)) {
    console.warn('⚠️ prepareWindowData: Invalid playhead value, using 0');
    playhead = 0;
  }
  
  if (typeof actualDuration !== 'number' || actualDuration <= 0 || !isFinite(actualDuration)) {
    console.warn('⚠️ prepareWindowData: Invalid duration, calculating from waveform');
    actualDuration = waveform.length / sampleRate;
  }
  
  if (typeof sampleRate !== 'number' || sampleRate <= 0 || !isFinite(sampleRate)) {
    console.warn('⚠️ prepareWindowData: Invalid sample rate, using default 44100');
    sampleRate = 44100;
  }
  
  if (typeof paddingSeconds !== 'number' || paddingSeconds < 0 || !isFinite(paddingSeconds)) {
    console.warn('⚠️ prepareWindowData: Invalid padding seconds, using default');
    paddingSeconds = PHANTOM_PADDING_SECONDS;
  }

  // ✅ NEW: Calculate window size with validation
  const samplesPerWindow = Math.max(Math.floor(CONFIG.WINDOW_DURATION * sampleRate), 1);
  
  // ✅ NEW: Clamp playhead to valid range
  playhead = Math.max(0, Math.min(1, playhead));
  
  const currentTimeInFile = playhead * actualDuration;
  let startSample = Math.max(0, Math.round(currentTimeInFile * sampleRate));
  let endSample = startSample + samplesPerWindow;
  
  // ✅ NEW: Calculate phantom padding with validation
  const phantomPaddingSamples = Math.max(0, Math.floor(paddingSeconds * sampleRate));
  const paddedWaveformLength = waveform.length + phantomPaddingSamples;
  
  // ✅ IMPROVED: Handle very short audio files
  if (waveform.length < samplesPerWindow) {
    console.log(`📏 Short audio detected: ${waveform.length} samples < ${samplesPerWindow} window`);
    
    // For very short files, handle differently based on playhead position
    if (endSample <= waveform.length) {
      // Window fits entirely in the short audio
      const result = new Float32Array(samplesPerWindow);
      const audioSlice = waveform.slice(startSample, endSample);
      result.set(audioSlice, 0);
      // Rest remains silent (zeros)
      return result;
    } else if (startSample < waveform.length) {
      // Window partially overlaps with short audio
      const result = new Float32Array(samplesPerWindow);
      const realPart = waveform.slice(startSample);
      result.set(realPart, 0);
      // Rest is phantom silence
      return result;
    } else {
      // ✅ NEW: Handle case where startSample is beyond short audio
      if (startSample < paddedWaveformLength) {
        // In phantom zone - return silence
        return new Float32Array(samplesPerWindow);
      } else {
        // ✅ IMPROVED: Better wrap-around for short audio
        const effectiveStart = startSample % paddedWaveformLength;
        if (effectiveStart < waveform.length) {
          const result = new Float32Array(samplesPerWindow);
          const availableFromStart = Math.min(waveform.length - effectiveStart, samplesPerWindow);
          result.set(waveform.slice(effectiveStart, effectiveStart + availableFromStart), 0);
          return result;
        } else {
          // Still in phantom zone after wrap
          return new Float32Array(samplesPerWindow);
        }
      }
    }
  }
  
  // ✅ IMPROVED: Standard case handling with better bounds checking
  // If we're entirely within the original audio, return normally
  if (endSample <= waveform.length) {
    // ✅ NEW: Validate slice parameters
    const validStart = Math.max(0, Math.min(startSample, waveform.length));
    const validEnd = Math.max(validStart, Math.min(endSample, waveform.length));
    
    const slice = waveform.slice(validStart, validEnd);
    
    // ✅ NEW: Ensure we return the expected window size
    if (slice.length < samplesPerWindow) {
      const result = new Float32Array(samplesPerWindow);
      result.set(slice, 0);
      return result;
    }
    
    return slice;
  }
  
  // ✅ IMPROVED: Handle partial phantom zone overlap
  if (startSample < waveform.length) {
    // Mix of real audio and phantom silence
    const realPart = waveform.slice(startSample);
    const phantomLength = Math.max(0, endSample - waveform.length);
    
    const result = new Float32Array(samplesPerWindow);
    
    // ✅ NEW: Validate real part fits in result
    const realPartLength = Math.min(realPart.length, samplesPerWindow);
    result.set(realPart.slice(0, realPartLength), 0);
    
    // Phantom part is already zeros in Float32Array
    
    return result;
  } else if (startSample < paddedWaveformLength) {
    // ✅ IMPROVED: Entirely in phantom zone - return silence
    return new Float32Array(samplesPerWindow);
  } else {
    // ✅ IMPROVED: Beyond phantom zone - wrap around to beginning with validation
    const wrappedStart = startSample - paddedWaveformLength;
    const wrappedEnd = wrappedStart + samplesPerWindow;
    
    // ✅ NEW: Validate wrapped coordinates
    if (wrappedStart < 0 || wrappedStart >= waveform.length) {
      console.warn(`⚠️ Invalid wrapped start: ${wrappedStart}, returning silence`);
      return new Float32Array(samplesPerWindow);
    }
    
    if (wrappedEnd <= waveform.length) {
      // ✅ IMPROVED: Simple case - wrapped window fits entirely
      const validEnd = Math.min(wrappedEnd, waveform.length);
      const slice = waveform.slice(wrappedStart, validEnd);
      
      if (slice.length < samplesPerWindow) {
        const result = new Float32Array(samplesPerWindow);
        result.set(slice, 0);
        return result;
      }
      
      return slice;
    } else {
      // ✅ IMPROVED: Complex case - wrapped window spans around
      const firstPartEnd = Math.min(waveform.length, waveform.length);
      const firstPart = waveform.slice(wrappedStart, firstPartEnd);
      
      const secondPartLength = Math.max(0, Math.min(
        wrappedEnd - waveform.length, 
        waveform.length,
        samplesPerWindow - firstPart.length
      ));
      
      const result = new Float32Array(samplesPerWindow);
      
      if (firstPart.length > 0) {
        result.set(firstPart, 0);
      }
      
      if (secondPartLength > 0) {
        const secondPart = waveform.slice(0, secondPartLength);
        result.set(secondPart, firstPart.length);
      }
      
      return result;
    }
  }
}