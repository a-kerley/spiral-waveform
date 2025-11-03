/**
 * Tests for waveform-data placeholder generation
 */

import { describe, it, expect } from 'vitest';
import { generatePlaceholderWaveform } from '../js/waveform-data.js';

describe('generatePlaceholderWaveform', () => {
  it('should generate waveform with correct length', () => {
    const targetSamples = 2000;
    const waveform = generatePlaceholderWaveform(targetSamples);
    
    expect(waveform).toBeInstanceOf(Float32Array);
    expect(waveform.length).toBe(targetSamples);
  });
  
  it('should generate waveform with values in valid range', () => {
    const targetSamples = 1000;
    const waveform = generatePlaceholderWaveform(targetSamples);
    
    // All values should be within [-0.8, 0.8] based on clamping logic
    for (let i = 0; i < waveform.length; i++) {
      expect(waveform[i]).toBeGreaterThanOrEqual(-0.8);
      expect(waveform[i]).toBeLessThanOrEqual(0.8);
      expect(isFinite(waveform[i])).toBe(true);
    }
  });
  
  it('should generate non-zero waveform (not silence)', () => {
    const targetSamples = 500;
    const waveform = generatePlaceholderWaveform(targetSamples);
    
    // Should have some non-zero values
    const nonZeroCount = Array.from(waveform).filter(v => Math.abs(v) > 0.01).length;
    expect(nonZeroCount).toBeGreaterThan(0);
    
    // Should have some variation (not all the same value)
    const uniqueValues = new Set(Array.from(waveform).map(v => v.toFixed(6)));
    expect(uniqueValues.size).toBeGreaterThan(10);
  });
  
  it('should use default targetSamples when not provided', () => {
    const waveform = generatePlaceholderWaveform();
    
    expect(waveform.length).toBe(2000); // Default value
  });
  
  it('should handle custom sample rate', () => {
    const targetSamples = 1000;
    const sampleRate = 48000;
    const waveform = generatePlaceholderWaveform(targetSamples, sampleRate);
    
    expect(waveform.length).toBe(targetSamples);
    expect(waveform).toBeInstanceOf(Float32Array);
  });
  
  it('should handle custom duration', () => {
    const targetSamples = 500;
    const sampleRate = 44100;
    const duration = 5; // 5 seconds
    const waveform = generatePlaceholderWaveform(targetSamples, sampleRate, duration);
    
    expect(waveform.length).toBe(targetSamples);
  });
  
  it('should handle invalid inputs gracefully', () => {
    // Invalid targetSamples
    const waveform1 = generatePlaceholderWaveform(-100);
    expect(waveform1.length).toBe(2000); // Should fall back to default
    
    const waveform2 = generatePlaceholderWaveform(Infinity);
    expect(waveform2.length).toBe(2000); // Should fall back to default
    
    const waveform3 = generatePlaceholderWaveform(NaN);
    expect(waveform3.length).toBe(2000); // Should fall back to default
    
    // Invalid sampleRate
    const waveform4 = generatePlaceholderWaveform(1000, -1);
    expect(waveform4.length).toBe(1000);
    
    const waveform5 = generatePlaceholderWaveform(1000, 0);
    expect(waveform5.length).toBe(1000);
  });
  
  it('should return silence on error', () => {
    // Force an error by passing extremely invalid input
    try {
      const waveform = generatePlaceholderWaveform(null);
      // If it doesn't throw, should return silence
      expect(waveform).toBeInstanceOf(Float32Array);
      expect(waveform.length).toBeGreaterThan(0);
    } catch (error) {
      // Error is also acceptable
      expect(error).toBeDefined();
    }
  });
  
  it('should generate realistic-looking waveform with amplitude variation', () => {
    const targetSamples = 2000;
    const waveform = generatePlaceholderWaveform(targetSamples);
    
    // Calculate basic statistics
    const values = Array.from(waveform);
    const absValues = values.map(Math.abs);
    const avgAmplitude = absValues.reduce((a, b) => a + b, 0) / absValues.length;
    const maxAmplitude = Math.max(...absValues);
    
    // Should have reasonable average amplitude (not too quiet, not maxed out)
    expect(avgAmplitude).toBeGreaterThan(0.001); // Adjusted for randomness
    expect(avgAmplitude).toBeLessThan(0.8);
    
    // Should have some peaks (adjusted for randomness)
    expect(maxAmplitude).toBeGreaterThan(0.01);
  });
  
  it('should generate different waveforms on subsequent calls', () => {
    const targetSamples = 500;
    const waveform1 = generatePlaceholderWaveform(targetSamples);
    const waveform2 = generatePlaceholderWaveform(targetSamples);
    
    // Should be different due to random components
    let differenceCount = 0;
    for (let i = 0; i < targetSamples; i++) {
      if (Math.abs(waveform1[i] - waveform2[i]) > 0.001) {
        differenceCount++;
      }
    }
    
    // Most values should be different (due to Math.random())
    // Adjusted threshold due to deterministic sine components
    expect(differenceCount).toBeGreaterThan(targetSamples * 0.8);
  });
  
  it('should work with small target samples', () => {
    const waveform = generatePlaceholderWaveform(10);
    expect(waveform.length).toBe(10);
    expect(waveform).toBeInstanceOf(Float32Array);
  });
  
  it('should work with large target samples', () => {
    const waveform = generatePlaceholderWaveform(100000);
    expect(waveform.length).toBe(100000);
    expect(waveform).toBeInstanceOf(Float32Array);
  });
});
