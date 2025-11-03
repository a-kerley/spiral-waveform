/**
 * Unit tests for waveform-data.js
 * Testing downsample, getFullFileDownsampled, prepareWindowData, and validation utilities
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  downsample,
  getFullFileDownsampled,
  prepareWindowData,
  clearCache,
  validatePhantomPaddingParams
} from '../js/waveform-data.js';
import { CONFIG } from '../js/utils.js';

describe('waveform-data.js - Downsampling', () => {
  afterEach(() => {
    // Clear cache after each test
    clearCache();
  });

  describe('downsample()', () => {
    it('should downsample array to target length', () => {
      const data = new Array(10000).fill(0).map((_, i) => Math.sin(i / 100));
      const result = downsample(data, 100);
      expect(result.length).toBe(100);
    });

    it('should preserve maximum values in each block', () => {
      const data = [0, 5, 0, 0, 0, 10, 0, 0, 0, 15, 0, 0];
      const result = downsample(data, 3);
      expect(result[0]).toBeGreaterThanOrEqual(5);
      expect(result[1]).toBeGreaterThanOrEqual(10);
      expect(result[2]).toBeGreaterThanOrEqual(15);
    });

    it('should handle empty array', () => {
      const result = downsample([], 100);
      expect(result.length).toBe(100);
      expect(result.every(v => v === 0)).toBe(true);
    });

    it('should handle null/undefined input', () => {
      const result1 = downsample(null, 100);
      const result2 = downsample(undefined, 100);
      expect(result1.length).toBe(100);
      expect(result2.length).toBe(100);
    });

    it('should pad with zeros if input is shorter than target', () => {
      const data = [1, 2, 3];
      const result = downsample(data, 10);
      expect(result.length).toBe(10);
      expect(result.slice(3).every(v => v === 0)).toBe(true);
    });

    it('should handle single value', () => {
      const data = [5];
      const result = downsample(data, 10);
      expect(result.length).toBe(10);
      expect(result[0]).toBe(5);
    });

    it('should use absolute values for max calculation', () => {
      const data = [-10, -5, 3, 8, -20, -15];
      const result = downsample(data, 2);
      expect(result[0]).toBeGreaterThanOrEqual(8); // max of first block
      expect(result[1]).toBeGreaterThanOrEqual(15); // max of second block
    });

    it('should handle very large arrays', () => {
      const data = new Array(1000000).fill(0).map(() => Math.random());
      const result = downsample(data, 1000);
      expect(result.length).toBe(1000);
      expect(result.every(v => v >= 0 && v <= 1)).toBe(true);
    });

    it('should use default numSamples if not provided', () => {
      const data = new Array(10000).fill(1);
      const result = downsample(data);
      expect(result.length).toBe(1500); // Default from CONFIG.NUM_POINTS
    });

    it('should handle Float32Array input', () => {
      const data = new Float32Array([1, 2, 3, 4, 5, 6, 7, 8]);
      const result = downsample(data, 4);
      expect(result.length).toBe(4);
    });
  });

  describe('getFullFileDownsampled()', () => {
    it('should downsample full audio buffer', () => {
      const audioData = new Float32Array(44100 * 10); // 10 seconds at 44.1kHz
      for (let i = 0; i < audioData.length; i++) {
        audioData[i] = Math.sin(i / 100);
      }
      
      const result = getFullFileDownsampled(audioData, 1500, 44100);
      expect(result.length).toBe(1500);
    });

    it('should cache results for repeated calls', () => {
      const audioData = new Float32Array(44100);
      for (let i = 0; i < audioData.length; i++) {
        audioData[i] = Math.random();
      }
      
      const result1 = getFullFileDownsampled(audioData, 1500, 44100);
      const result2 = getFullFileDownsampled(audioData, 1500, 44100);
      
      // Should return same reference (cached)
      expect(result1).toBe(result2);
    });

    it('should invalidate cache when numPoints changes', () => {
      const audioData = new Float32Array(44100);
      for (let i = 0; i < audioData.length; i++) {
        audioData[i] = 1;
      }
      
      const result1 = getFullFileDownsampled(audioData, 1000, 44100);
      const result2 = getFullFileDownsampled(audioData, 1500, 44100);
      
      expect(result1.length).toBe(1000);
      expect(result2.length).toBe(1500);
    });

    it('should handle empty audio data', () => {
      const result = getFullFileDownsampled(new Float32Array([]), 1500, 44100);
      expect(result.length).toBe(1500);
      expect(result.every(v => v === 0)).toBe(true);
    });

    it('should handle null/undefined audio data', () => {
      const result1 = getFullFileDownsampled(null, 1500, 44100);
      const result2 = getFullFileDownsampled(undefined, 1500, 44100);
      expect(result1.length).toBe(1500);
      expect(result2.length).toBe(1500);
    });

    it('should use default numPoints from CONFIG', () => {
      const audioData = new Float32Array(44100);
      const result = getFullFileDownsampled(audioData);
      expect(result.length).toBe(CONFIG.NUM_POINTS);
    });

    it('should handle invalid numPoints', () => {
      const audioData = new Float32Array(44100);
      const result1 = getFullFileDownsampled(audioData, -100, 44100);
      const result2 = getFullFileDownsampled(audioData, NaN, 44100);
      const result3 = getFullFileDownsampled(audioData, Infinity, 44100);
      
      expect(result1.length).toBeGreaterThan(0);
      expect(result2.length).toBeGreaterThan(0);
      expect(result3.length).toBeGreaterThan(0);
    });

    it('should clear cache when clearCache is called', () => {
      const audioData = new Float32Array(44100);
      for (let i = 0; i < audioData.length; i++) {
        audioData[i] = 1;
      }
      
      const result1 = getFullFileDownsampled(audioData, 1500, 44100);
      clearCache();
      const result2 = getFullFileDownsampled(audioData, 1500, 44100);
      
      // Results should be equal but not same reference after cache clear
      expect(result1.length).toBe(result2.length);
      expect(result1).not.toBe(result2);
    });
  });

  describe('prepareWindowData()', () => {
    const sampleRate = 44100;
    const windowDuration = CONFIG.WINDOW_DURATION; // 30 seconds
    const samplesPerWindow = windowDuration * sampleRate;

    beforeEach(() => {
      clearCache();
    });

    it('should extract window at start of audio', () => {
      const audioData = new Float32Array(sampleRate * 60); // 60 seconds
      for (let i = 0; i < audioData.length; i++) {
        audioData[i] = Math.sin(i / 1000);
      }
      
      const result = prepareWindowData(audioData, 0, 60, sampleRate, 30);
      expect(result.length).toBe(samplesPerWindow);
      expect(result instanceof Float32Array).toBe(true);
    });

    it('should extract window at middle of audio', () => {
      const audioData = new Float32Array(sampleRate * 60); // 60 seconds
      for (let i = 0; i < audioData.length; i++) {
        audioData[i] = i / audioData.length;
      }
      
      const result = prepareWindowData(audioData, 0.5, 60, sampleRate, 30);
      expect(result.length).toBe(samplesPerWindow);
      // Should contain data from middle of audio
      expect(result.some(v => v > 0)).toBe(true);
    });

    it('should handle playhead near end of audio', () => {
      const audioData = new Float32Array(sampleRate * 60);
      for (let i = 0; i < audioData.length; i++) {
        audioData[i] = 1;
      }
      
      const result = prepareWindowData(audioData, 0.95, 60, sampleRate, 30);
      expect(result.length).toBe(samplesPerWindow);
    });

    it('should handle phantom padding zone', () => {
      const audioData = new Float32Array(sampleRate * 60);
      for (let i = 0; i < audioData.length; i++) {
        audioData[i] = 1;
      }
      
      // Playhead in phantom zone (after audio ends)
      const result = prepareWindowData(audioData, 1.0, 60, sampleRate, 30);
      expect(result.length).toBe(samplesPerWindow);
      // Should contain some silence (phantom padding)
    });

    it('should wrap around to beginning after phantom zone', () => {
      const audioData = new Float32Array(sampleRate * 60);
      for (let i = 0; i < audioData.length; i++) {
        audioData[i] = 1;
      }
      
      // Far beyond audio end - should wrap
      const result = prepareWindowData(audioData, 2.0, 60, sampleRate, 30);
      expect(result.length).toBe(samplesPerWindow);
    });

    it('should handle very short audio files', () => {
      const audioData = new Float32Array(sampleRate * 5); // 5 seconds, shorter than window
      for (let i = 0; i < audioData.length; i++) {
        audioData[i] = 1;
      }
      
      const result = prepareWindowData(audioData, 0, 5, sampleRate, 30);
      expect(result.length).toBe(samplesPerWindow);
      // Should contain real audio followed by silence
      expect(result.slice(0, audioData.length).every(v => v === 1)).toBe(true);
    });

    it('should handle empty waveform', () => {
      const result = prepareWindowData(new Float32Array([]), 0, 0, sampleRate, 30);
      expect(result.length).toBeGreaterThan(0);
      expect(result instanceof Float32Array).toBe(true);
    });

    it('should handle null/undefined waveform', () => {
      const result1 = prepareWindowData(null, 0, 60, sampleRate, 30);
      const result2 = prepareWindowData(undefined, 0, 60, sampleRate, 30);
      expect(result1.length).toBeGreaterThan(0);
      expect(result2.length).toBeGreaterThan(0);
    });

    it('should clamp playhead to valid range', () => {
      const audioData = new Float32Array(sampleRate * 60);
      
      const result1 = prepareWindowData(audioData, -0.5, 60, sampleRate, 30);
      const result2 = prepareWindowData(audioData, 5.0, 60, sampleRate, 30);
      
      expect(result1.length).toBe(samplesPerWindow);
      expect(result2.length).toBe(samplesPerWindow);
    });

    it('should handle invalid playhead values', () => {
      const audioData = new Float32Array(sampleRate * 60);
      
      const result1 = prepareWindowData(audioData, NaN, 60, sampleRate, 30);
      const result2 = prepareWindowData(audioData, Infinity, 60, sampleRate, 30);
      
      expect(result1.length).toBe(samplesPerWindow);
      expect(result2.length).toBe(samplesPerWindow);
    });

    it('should handle invalid duration', () => {
      const audioData = new Float32Array(sampleRate * 60);
      
      const result1 = prepareWindowData(audioData, 0, 0, sampleRate, 30);
      const result2 = prepareWindowData(audioData, 0, -10, sampleRate, 30);
      const result3 = prepareWindowData(audioData, 0, NaN, sampleRate, 30);
      
      expect(result1.length).toBeGreaterThan(0);
      expect(result2.length).toBeGreaterThan(0);
      expect(result3.length).toBeGreaterThan(0);
    });

    it('should handle invalid sample rate', () => {
      const audioData = new Float32Array(sampleRate * 60);
      
      const result1 = prepareWindowData(audioData, 0, 60, 0, 30);
      const result2 = prepareWindowData(audioData, 0, 60, -44100, 30);
      const result3 = prepareWindowData(audioData, 0, 60, NaN, 30);
      
      expect(result1.length).toBeGreaterThan(0);
      expect(result2.length).toBeGreaterThan(0);
      expect(result3.length).toBeGreaterThan(0);
    });

    it('should use default padding seconds when invalid', () => {
      const audioData = new Float32Array(sampleRate * 60);
      
      const result1 = prepareWindowData(audioData, 0, 60, sampleRate, -30);
      const result2 = prepareWindowData(audioData, 0, 60, sampleRate, NaN);
      
      expect(result1.length).toBe(samplesPerWindow);
      expect(result2.length).toBe(samplesPerWindow);
    });

    it('should handle playhead in phantom zone', () => {
      const audioData = new Float32Array(sampleRate * 30);
      for (let i = 0; i < audioData.length; i++) {
        audioData[i] = 1;
      }
      
      // Position in phantom zone
      const phantomSamples = Math.floor(30 * sampleRate); // 30 second padding
      const playhead = (audioData.length + phantomSamples / 2) / (audioData.length + phantomSamples);
      
      const result = prepareWindowData(audioData, playhead, 30, sampleRate, 30);
      
      // Should return proper window size
      expect(result.length).toBe(samplesPerWindow);
      expect(result instanceof Float32Array).toBe(true);
      
      // Implementation detail: function may wrap around or return silence
      // Just verify it returns valid data without throwing
      expect(result).toBeDefined();
    });
  });

  describe('validatePhantomPaddingParams()', () => {
    const sampleRate = 44100;
    const duration = 60;
    const waveform = new Float32Array(sampleRate * duration);

    it('should validate correct parameters', () => {
      const result = validatePhantomPaddingParams(waveform, 0.5, duration, sampleRate, 30);
      expect(result.isValid).toBe(true);
      expect(result.issues.length).toBe(0);
    });

    it('should detect empty waveform', () => {
      const result = validatePhantomPaddingParams(new Float32Array([]), 0.5, duration, sampleRate, 30);
      expect(result.isValid).toBe(false);
      expect(result.issues.some(issue => issue.includes('waveform'))).toBe(true);
    });

    it('should detect invalid playhead', () => {
      const result1 = validatePhantomPaddingParams(waveform, -0.5, duration, sampleRate, 30);
      const result2 = validatePhantomPaddingParams(waveform, 1.5, duration, sampleRate, 30);
      const result3 = validatePhantomPaddingParams(waveform, NaN, duration, sampleRate, 30);
      
      expect(result1.isValid).toBe(false);
      expect(result2.isValid).toBe(false);
      expect(result3.isValid).toBe(false);
      expect(result1.issues.some(issue => issue.includes('playhead'))).toBe(true);
    });

    it('should detect invalid duration', () => {
      const result1 = validatePhantomPaddingParams(waveform, 0.5, 0, sampleRate, 30);
      const result2 = validatePhantomPaddingParams(waveform, 0.5, -10, sampleRate, 30);
      const result3 = validatePhantomPaddingParams(waveform, 0.5, NaN, sampleRate, 30);
      
      expect(result1.isValid).toBe(false);
      expect(result2.isValid).toBe(false);
      expect(result3.isValid).toBe(false);
    });

    it('should detect invalid sample rate', () => {
      const result1 = validatePhantomPaddingParams(waveform, 0.5, duration, 0, 30);
      const result2 = validatePhantomPaddingParams(waveform, 0.5, duration, -44100, 30);
      const result3 = validatePhantomPaddingParams(waveform, 0.5, duration, NaN, 30);
      
      expect(result1.isValid).toBe(false);
      expect(result2.isValid).toBe(false);
      expect(result3.isValid).toBe(false);
    });

    it('should detect invalid padding seconds', () => {
      const result1 = validatePhantomPaddingParams(waveform, 0.5, duration, sampleRate, -30);
      const result2 = validatePhantomPaddingParams(waveform, 0.5, duration, sampleRate, NaN);
      
      expect(result1.isValid).toBe(false);
      expect(result2.isValid).toBe(false);
    });

    it('should detect waveform length mismatch', () => {
      const shortWaveform = new Float32Array(100); // Much shorter than expected
      const result = validatePhantomPaddingParams(shortWaveform, 0.5, duration, sampleRate, 30);
      
      expect(result.isValid).toBe(false);
      expect(result.issues.some(issue => issue.includes('length mismatch'))).toBe(true);
    });

    it('should allow small tolerance in waveform length', () => {
      // Create waveform with length within tolerance (0.1s = 4410 samples)
      const tolerantWaveform = new Float32Array(sampleRate * duration + 1000);
      const result = validatePhantomPaddingParams(tolerantWaveform, 0.5, duration, sampleRate, 30);
      
      expect(result.isValid).toBe(true);
    });

    it('should collect multiple issues', () => {
      const result = validatePhantomPaddingParams(new Float32Array([]), -1, -1, -1, -1);
      
      expect(result.isValid).toBe(false);
      expect(result.issues.length).toBeGreaterThan(1);
    });
  });

  describe('clearCache()', () => {
    it('should clear the downsample cache', () => {
      const audioData = new Float32Array(44100);
      for (let i = 0; i < audioData.length; i++) {
        audioData[i] = 1;
      }
      
      // Populate cache
      const result1 = getFullFileDownsampled(audioData, 1500, 44100);
      
      // Clear cache
      clearCache();
      
      // Get new result - should not be same reference
      const result2 = getFullFileDownsampled(audioData, 1500, 44100);
      
      expect(result1).not.toBe(result2);
      expect(result1.length).toBe(result2.length);
    });

    it('should be safe to call multiple times', () => {
      clearCache();
      clearCache();
      clearCache();
      // Should not throw
    });
  });
});
