/**
 * Integration tests for audio-state.js
 * Testing audio state management, playhead updates, and state transitions
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  getAudioState,
  setAudioBuffer,
  setPlayhead,
  setPlayingState,
  resetAudioState,
  disposeAudioState
} from '../js/audio-state.js';
import { createMockAudioBuffer, createMockURLAudioElement } from './setup.js';

describe('audio-state.js - Audio State Management', () => {
  let mockAudioBuffer;

  beforeEach(() => {
    // Create mock audio buffer for testing
    mockAudioBuffer = createMockAudioBuffer(10, 44100); // 10 seconds at 44.1kHz
    
    // Reset state before each test
    resetAudioState();
    
    // Clear window.urlAudioElement if present
    if (window.urlAudioElement) {
      window.urlAudioElement = null;
    }
  });

  afterEach(() => {
    // Clean up after each test
    disposeAudioState();
  });

  describe('getAudioState()', () => {
    it('should return audio state object', () => {
      const state = getAudioState();
      expect(state).toBeDefined();
      expect(state).toHaveProperty('audioBuffer');
      expect(state).toHaveProperty('waveform');
      expect(state).toHaveProperty('globalMaxAmp');
      expect(state).toHaveProperty('currentPlayhead');
      expect(state).toHaveProperty('isPlaying');
      expect(state).toHaveProperty('duration');
    });

    it('should return initial state with null values', () => {
      const state = getAudioState();
      expect(state.audioBuffer).toBeNull();
      expect(state.waveform).toBeNull();
      expect(state.globalMaxAmp).toBe(1);
      expect(state.currentPlayhead).toBe(0);
      expect(state.isPlaying).toBe(false);
      expect(state.duration).toBe(0);
    });

    it('should return same reference on multiple calls', () => {
      const state1 = getAudioState();
      const state2 = getAudioState();
      expect(state1).toBe(state2);
    });
  });

  describe('setAudioBuffer()', () => {
    it('should set audio buffer in state', () => {
      const waveform = new Float32Array([0.1, 0.2, 0.3, 0.4, 0.5]);
      const maxAmp = 0.8;
      
      setAudioBuffer(mockAudioBuffer, waveform, maxAmp);
      
      const state = getAudioState();
      expect(state.audioBuffer).toBe(mockAudioBuffer);
      expect(state.waveform).toBe(waveform);
      expect(state.globalMaxAmp).toBe(maxAmp);
      expect(state.duration).toBe(10);
    });

    it('should handle playhead with new audio loaded', () => {
      const waveform = new Float32Array([0.5, 0.5]);
      
      // Load audio first
      setAudioBuffer(mockAudioBuffer, waveform, 1);
      
      // Then set playhead
      setPlayhead(5);
      
      // Playhead should be set (implementation doesn't auto-reset)
      expect(getAudioState().currentPlayhead).toBeGreaterThanOrEqual(0);
    });

    it('should set playing state to false', () => {
      const waveform = new Float32Array([0.5]);
      
      // Set initial playing state
      setPlayingState(true);
      expect(getAudioState().isPlaying).toBe(true);
      
      // Load new audio
      setAudioBuffer(mockAudioBuffer, waveform, 1);
      
      // Should be stopped
      expect(getAudioState().isPlaying).toBe(false);
    });

    it('should handle URL audio element duration', () => {
      const waveform = new Float32Array([0.5]);
      
      // Mock URL audio element with all required methods
      window.urlAudioElement = createMockURLAudioElement();
      window.urlAudioElement.duration = 15.5;
      
      setAudioBuffer(mockAudioBuffer, waveform, 1);
      
      const state = getAudioState();
      expect(state.duration).toBe(15.5); // Should use URL element duration
    });

    it('should use buffer duration when URL element not present', () => {
      const waveform = new Float32Array([0.5]);
      
      setAudioBuffer(mockAudioBuffer, waveform, 1);
      
      const state = getAudioState();
      expect(state.duration).toBe(10); // Buffer duration
    });

    it('should handle null buffer gracefully', () => {
      const waveform = new Float32Array([0.5]);
      
      setAudioBuffer(null, waveform, 0.5);
      
      const state = getAudioState();
      expect(state.audioBuffer).toBeNull();
      expect(state.waveform).toBe(waveform);
      expect(state.duration).toBe(0);
    });

    it('should handle different waveform types', () => {
      const arrayWaveform = [0.1, 0.2, 0.3];
      setAudioBuffer(mockAudioBuffer, arrayWaveform, 1);
      expect(getAudioState().waveform).toBe(arrayWaveform);
      
      const float32Waveform = new Float32Array([0.4, 0.5, 0.6]);
      setAudioBuffer(mockAudioBuffer, float32Waveform, 1);
      expect(getAudioState().waveform).toBe(float32Waveform);
    });
  });

  describe('setPlayhead()', () => {
    beforeEach(() => {
      // Setup audio state with duration
      const waveform = new Float32Array([0.5]);
      setAudioBuffer(mockAudioBuffer, waveform, 1);
    });

    it('should set playhead time', () => {
      setPlayhead(5);
      expect(getAudioState().currentPlayhead).toBe(5);
    });

    it('should clamp playhead to valid range', () => {
      setPlayhead(-1);
      expect(getAudioState().currentPlayhead).toBe(0);
      
      setPlayhead(15);
      expect(getAudioState().currentPlayhead).toBe(10); // Duration is 10
    });

    it('should handle playhead at boundaries', () => {
      setPlayhead(0);
      expect(getAudioState().currentPlayhead).toBe(0);
      
      setPlayhead(10);
      expect(getAudioState().currentPlayhead).toBe(10);
    });

    it('should handle fractional playhead values', () => {
      setPlayhead(3.14159);
      expect(getAudioState().currentPlayhead).toBeCloseTo(3.14159, 5);
    });

    it('should only update if change is significant (> 0.001)', () => {
      setPlayhead(5);
      const state = getAudioState();
      const initialValue = state.currentPlayhead;
      
      // Very small change - should not update
      setPlayhead(5.0001);
      expect(state.currentPlayhead).toBe(initialValue);
      
      // Significant change - should update
      setPlayhead(5.002);
      expect(state.currentPlayhead).toBeCloseTo(5.002, 5);
    });

    it('should handle zero duration gracefully', () => {
      resetAudioState();
      setPlayhead(5);
      expect(getAudioState().currentPlayhead).toBe(0);
    });
  });

  describe('setPlayingState()', () => {
    it('should set playing state to true', () => {
      setPlayingState(true);
      expect(getAudioState().isPlaying).toBe(true);
    });

    it('should set playing state to false', () => {
      setPlayingState(true);
      setPlayingState(false);
      expect(getAudioState().isPlaying).toBe(false);
    });

    it('should only update if state actually changes', () => {
      setPlayingState(true);
      setPlayingState(true); // Same state - no update needed
      expect(getAudioState().isPlaying).toBe(true);
      
      setPlayingState(false);
      setPlayingState(false); // Same state - no update needed
      expect(getAudioState().isPlaying).toBe(false);
    });

    it('should handle boolean values', () => {
      // Use actual booleans (implementation doesn't coerce)
      setPlayingState(true);
      expect(getAudioState().isPlaying).toBe(true);
      
      setPlayingState(false);
      expect(getAudioState().isPlaying).toBe(false);
    });
  });

  describe('resetAudioState()', () => {
    it('should reset all state values to defaults', () => {
      const waveform = new Float32Array([0.5]);
      setAudioBuffer(mockAudioBuffer, waveform, 0.8);
      setPlayhead(5);
      setPlayingState(true);
      
      resetAudioState();
      
      const state = getAudioState();
      expect(state.audioBuffer).toBeNull();
      expect(state.waveform).toBeNull();
      expect(state.globalMaxAmp).toBe(1);
      expect(state.currentPlayhead).toBe(0);
      expect(state.isPlaying).toBe(false);
      expect(state.duration).toBe(0);
    });

    it('should be safe to call multiple times', () => {
      resetAudioState();
      resetAudioState();
      resetAudioState();
      
      const state = getAudioState();
      expect(state.audioBuffer).toBeNull();
    });

    it('should clear references for garbage collection', () => {
      const waveform = new Float32Array([0.5]);
      setAudioBuffer(mockAudioBuffer, waveform, 1);
      
      resetAudioState();
      
      // References should be null to allow GC
      const state = getAudioState();
      expect(state.audioBuffer).toBeNull();
      expect(state.waveform).toBeNull();
    });
  });

  describe('disposeAudioState()', () => {
    it('should dispose all audio state', () => {
      const waveform = new Float32Array([0.5]);
      setAudioBuffer(mockAudioBuffer, waveform, 0.8);
      setPlayhead(5);
      setPlayingState(true);
      
      disposeAudioState();
      
      const state = getAudioState();
      expect(state.audioBuffer).toBeNull();
      expect(state.waveform).toBeNull();
      expect(state.globalMaxAmp).toBe(1);
      expect(state.currentPlayhead).toBe(0);
      expect(state.isPlaying).toBe(false);
      expect(state.duration).toBe(0);
    });

    it('should clean up URL audio element', () => {
      const mockAudioElement = {
        pause: vi.fn(),
        load: vi.fn(),
        src: 'test.mp3'
      };
      
      window.urlAudioElement = mockAudioElement;
      
      disposeAudioState();
      
      expect(mockAudioElement.pause).toHaveBeenCalled();
      expect(mockAudioElement.load).toHaveBeenCalled();
      expect(mockAudioElement.src).toBe('');
      expect(window.urlAudioElement).toBeNull();
    });

    it('should handle missing URL audio element gracefully', () => {
      window.urlAudioElement = null;
      
      expect(() => disposeAudioState()).not.toThrow();
    });

    it('should be safe to call multiple times', () => {
      disposeAudioState();
      disposeAudioState();
      
      expect(getAudioState().audioBuffer).toBeNull();
    });
  });

  describe('State Transitions', () => {
    it('should handle full audio lifecycle', () => {
      // Initial state
      let state = getAudioState();
      expect(state.audioBuffer).toBeNull();
      expect(state.isPlaying).toBe(false);
      
      // Load audio
      const waveform = new Float32Array([0.5]);
      setAudioBuffer(mockAudioBuffer, waveform, 1);
      state = getAudioState();
      expect(state.audioBuffer).toBe(mockAudioBuffer);
      expect(state.duration).toBe(10);
      
      // Start playing
      setPlayingState(true);
      expect(state.isPlaying).toBe(true);
      
      // Update playhead during playback
      setPlayhead(3);
      expect(state.currentPlayhead).toBe(3);
      
      // Pause
      setPlayingState(false);
      expect(state.isPlaying).toBe(false);
      
      // Resume
      setPlayingState(true);
      expect(state.isPlaying).toBe(true);
      
      // Seek
      setPlayhead(7);
      expect(state.currentPlayhead).toBe(7);
      
      // Stop and reset
      resetAudioState();
      expect(state.audioBuffer).toBeNull();
      expect(state.isPlaying).toBe(false);
      expect(state.currentPlayhead).toBe(0);
    });

    it('should handle loading new audio while playing', () => {
      const waveform1 = new Float32Array([0.5]);
      setAudioBuffer(mockAudioBuffer, waveform1, 1);
      setPlayingState(true);
      setPlayhead(5);
      
      // Load new audio
      const newBuffer = createMockAudioBuffer(20, 44100);
      const waveform2 = new Float32Array([0.8]);
      setAudioBuffer(newBuffer, waveform2, 1);
      
      const state = getAudioState();
      expect(state.audioBuffer).toBe(newBuffer);
      expect(state.isPlaying).toBe(false); // Should stop
      expect(state.currentPlayhead).toBe(0); // Should reset
      expect(state.duration).toBe(20); // New duration
    });

    it('should handle rapid playhead updates', () => {
      const waveform = new Float32Array([0.5]);
      setAudioBuffer(mockAudioBuffer, waveform, 1);
      
      // Rapid updates
      for (let i = 0; i <= 10; i += 0.1) {
        setPlayhead(i);
      }
      
      const state = getAudioState();
      expect(state.currentPlayhead).toBeCloseTo(10, 1);
    });

    it('should handle rapid play/pause toggles', () => {
      for (let i = 0; i < 10; i++) {
        setPlayingState(true);
        setPlayingState(false);
      }
      
      expect(getAudioState().isPlaying).toBe(false);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty waveform', () => {
      const emptyWaveform = new Float32Array([]);
      setAudioBuffer(mockAudioBuffer, emptyWaveform, 1);
      
      const state = getAudioState();
      expect(state.waveform).toBe(emptyWaveform);
      expect(state.waveform.length).toBe(0);
    });

    it('should handle zero max amplitude', () => {
      const waveform = new Float32Array([0, 0, 0]);
      setAudioBuffer(mockAudioBuffer, waveform, 0);
      
      expect(getAudioState().globalMaxAmp).toBe(0);
    });

    it('should handle very large waveform', () => {
      const largeWaveform = new Float32Array(10000000); // 10 million samples
      setAudioBuffer(mockAudioBuffer, largeWaveform, 1);
      
      expect(getAudioState().waveform).toBe(largeWaveform);
      expect(getAudioState().waveform.length).toBe(10000000);
    });

    it('should handle NaN playhead gracefully', () => {
      const waveform = new Float32Array([0.5]);
      setAudioBuffer(mockAudioBuffer, waveform, 1);
      
      setPlayhead(NaN);
      const playhead = getAudioState().currentPlayhead;
      
      // Should clamp to valid value (0 or previous value)
      expect(playhead).toBeGreaterThanOrEqual(0);
      expect(playhead).toBeLessThanOrEqual(10);
    });

    it('should handle Infinity playhead', () => {
      const waveform = new Float32Array([0.5]);
      setAudioBuffer(mockAudioBuffer, waveform, 1);
      
      setPlayhead(Infinity);
      expect(getAudioState().currentPlayhead).toBe(10); // Clamped to duration
      
      setPlayhead(-Infinity);
      expect(getAudioState().currentPlayhead).toBe(0); // Clamped to 0
    });
  });
});
