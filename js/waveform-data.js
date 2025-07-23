import { CONFIG } from './utils.js';

// Cache for performance optimization
let cachedFullFileDownsampled = null;
let cachedFullFileNumPoints = null;

// ✅ NEW: Add phantom padding to waveform data
const PHANTOM_PADDING_SECONDS = 30;

export function downsample(data, numSamples) {
  if (!data || data.length === 0) {
    return new Array(numSamples).fill(0);
  }
  
  if (data.length <= numSamples) {
    return Array.from(data).concat(new Array(numSamples - data.length).fill(0));
  }
  
  const blockSize = Math.floor(data.length / numSamples);
  const filtered = [];

  for (let i = 0; i < numSamples; i++) {
    let maxInBlock = 0;
    for (let j = 0; j < blockSize; j++) {
      const absValue = Math.abs(data[i * blockSize + j]);
      if (absValue > maxInBlock) {
        maxInBlock = absValue;
      }
    }
    filtered.push(maxInBlock);
  }

  return filtered;
}

// ✅ UPDATED: Don't add phantom padding to full file view
export function getFullFileDownsampled(audioData, numPoints = CONFIG.NUM_POINTS, sampleRate = 44100) {
  if (!cachedFullFileDownsampled || cachedFullFileNumPoints !== numPoints) {
    // ✅ CHANGED: Use original audio data without phantom padding for full view
    cachedFullFileDownsampled = downsample(audioData, numPoints);
    cachedFullFileNumPoints = numPoints;
    
    console.log(`📊 Full file downsampled (no phantom): ${audioData.length} -> ${numPoints} points`);
  }
  return cachedFullFileDownsampled;
}

export function clearCache() {
  cachedFullFileDownsampled = null;
  cachedFullFileNumPoints = null;
}

// ✅ PHANTOM PADDING: Only used for windowed/focus view
export function prepareWindowData(waveform, playhead, actualDuration, sampleRate, paddingSeconds = PHANTOM_PADDING_SECONDS) {
  const samplesPerWindow = CONFIG.WINDOW_DURATION * sampleRate;
  const currentTimeInFile = playhead * actualDuration;
  let startSample = Math.round(currentTimeInFile * sampleRate);
  let endSample = startSample + samplesPerWindow;
  
  // ✅ NEW: Calculate phantom-padded waveform length (only for windowed view)
  const phantomPaddingSamples = Math.floor(paddingSeconds * sampleRate);
  const paddedWaveformLength = waveform.length + phantomPaddingSamples;
  
  // If we're entirely within the original audio, return normally
  if (endSample <= waveform.length) {
    return waveform.slice(startSample, endSample);
  }
  
  // If we're partially or entirely in the phantom zone
  if (startSample < waveform.length) {
    // Mix of real audio and phantom silence
    const realPart = waveform.slice(startSample);
    const phantomLength = endSample - waveform.length;
    const phantomPart = new Float32Array(phantomLength); // Zeros (silence)
    
    const result = new Float32Array(samplesPerWindow);
    result.set(realPart, 0);
    result.set(phantomPart, realPart.length);
    
    return result;
  } else if (startSample < paddedWaveformLength) {
    // Entirely in phantom zone - return silence
    return new Float32Array(samplesPerWindow); // All zeros
  } else {
    // Beyond phantom zone - wrap around to beginning
    const wrappedStart = startSample - paddedWaveformLength;
    const wrappedEnd = wrappedStart + samplesPerWindow;
    
    if (wrappedEnd <= waveform.length) {
      return waveform.slice(wrappedStart, wrappedEnd);
    } else {
      const firstPart = waveform.slice(wrappedStart);
      const secondPart = waveform.slice(0, wrappedEnd - waveform.length);
      return new Float32Array([...firstPart, ...secondPart]);
    }
  }
}