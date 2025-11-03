import { describe, it, expect, beforeEach, vi } from 'vitest';
import { StateManager, DEFAULT_STATE } from '../js/state-manager.js';

describe('StateManager', () => {
  let manager;
  
  beforeEach(() => {
    manager = new StateManager();
  });
  
  describe('Initialization', () => {
    it('should initialize with default state', () => {
      const state = manager.get();
      expect(state).toHaveProperty('audio');
      expect(state).toHaveProperty('visual');
      expect(state).toHaveProperty('interaction');
      expect(state).toHaveProperty('render');
      expect(state).toHaveProperty('ui');
      expect(state).toHaveProperty('settings');
    });
    
    it('should accept custom initial state', () => {
      const customManager = new StateManager({ test: { value: 42 } });
      expect(customManager.get('test.value')).toBe(42);
    });
    
    it('should have default audio state', () => {
      expect(manager.get('audio.isPlaying')).toBe(false);
      expect(manager.get('audio.volume')).toBe(1.0);
      expect(manager.get('audio.playhead')).toBe(0);
    });
  });
  
  describe('Get/Set', () => {
    it('should get value by path', () => {
      expect(manager.get('audio.isPlaying')).toBe(false);
    });
    
    it('should get nested value', () => {
      expect(manager.get('visual.playheadAnimation.progress')).toBe(0);
    });
    
    it('should get entire section', () => {
      const audio = manager.get('audio');
      expect(audio).toHaveProperty('isPlaying');
      expect(audio).toHaveProperty('volume');
    });
    
    it('should get entire state', () => {
      const state = manager.get();
      expect(state).toHaveProperty('audio');
    });
    
    it('should return cloned value to prevent mutations', () => {
      const audio1 = manager.get('audio');
      const audio2 = manager.get('audio');
      expect(audio1).not.toBe(audio2);
      expect(audio1).toEqual(audio2);
    });
    
    it('should set value by path', () => {
      manager.set('audio.isPlaying', true);
      expect(manager.get('audio.isPlaying')).toBe(true);
    });
    
    it('should set nested value', () => {
      manager.set('visual.playheadAnimation.progress', 0.5);
      expect(manager.get('visual.playheadAnimation.progress')).toBe(0.5);
    });
    
    it('should set object value', () => {
      manager.set('audio', { isPlaying: true, volume: 0.5 });
      expect(manager.get('audio.isPlaying')).toBe(true);
      expect(manager.get('audio.volume')).toBe(0.5);
    });
    
    it('should not trigger updates for same value', () => {
      const callback = vi.fn();
      manager.subscribe('audio.isPlaying', callback);
      
      manager.set('audio.isPlaying', false); // Same as default
      expect(callback).not.toHaveBeenCalled();
    });
  });
  
  describe('Subscriptions', () => {
    it('should notify subscriber on change', () => {
      const callback = vi.fn();
      manager.subscribe('audio.isPlaying', callback);
      
      manager.set('audio.isPlaying', true);
      expect(callback).toHaveBeenCalledWith(true, false);
    });
    
    it('should notify multiple subscribers', () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();
      
      manager.subscribe('audio.isPlaying', callback1);
      manager.subscribe('audio.isPlaying', callback2);
      
      manager.set('audio.isPlaying', true);
      expect(callback1).toHaveBeenCalled();
      expect(callback2).toHaveBeenCalled();
    });
    
    it('should notify parent path listeners', () => {
      const callback = vi.fn();
      manager.subscribe('audio', callback);
      
      manager.set('audio.isPlaying', true);
      expect(callback).toHaveBeenCalled();
    });
    
    it('should notify wildcard listeners', () => {
      const callback = vi.fn();
      manager.subscribe('*', callback);
      
      manager.set('audio.isPlaying', true);
      expect(callback).toHaveBeenCalledWith({
        path: 'audio.isPlaying',
        value: true,
        oldValue: false
      });
    });
    
    it('should support immediate option', () => {
      const callback = vi.fn();
      manager.set('audio.isPlaying', true);
      
      manager.subscribe('audio.isPlaying', callback, { immediate: true });
      expect(callback).toHaveBeenCalledWith(true, true);
    });
    
    it('should support once option', () => {
      const callback = vi.fn();
      manager.subscribe('audio.isPlaying', callback, { once: true });
      
      manager.set('audio.isPlaying', true);
      manager.set('audio.isPlaying', false);
      
      expect(callback).toHaveBeenCalledTimes(1);
    });
    
    it('should unsubscribe correctly', () => {
      const callback = vi.fn();
      const unsubscribe = manager.subscribe('audio.isPlaying', callback);
      
      unsubscribe();
      manager.set('audio.isPlaying', true);
      
      expect(callback).not.toHaveBeenCalled();
    });
    
    it('should handle errors in callbacks gracefully', () => {
      const errorCallback = vi.fn(() => {
        throw new Error('Test error');
      });
      const goodCallback = vi.fn();
      
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      manager.subscribe('audio.isPlaying', errorCallback);
      manager.subscribe('audio.isPlaying', goodCallback);
      
      manager.set('audio.isPlaying', true);
      
      expect(consoleErrorSpy).toHaveBeenCalled();
      expect(goodCallback).toHaveBeenCalled();
      
      consoleErrorSpy.mockRestore();
    });
  });
  
  describe('Batch Updates', () => {
    it('should batch multiple updates', () => {
      const callback = vi.fn();
      manager.subscribe('*', callback);
      
      manager.batch({
        'audio.isPlaying': true,
        'audio.volume': 0.5,
        'visual.isTransitioning': true
      });
      
      // Should be called 3 times (once per update)
      expect(callback).toHaveBeenCalledTimes(3);
    });
    
    it('should record single history entry for batch', () => {
      manager.batch({
        'audio.isPlaying': true,
        'audio.volume': 0.5
      });
      
      expect(manager.canUndo()).toBe(true);
      manager.undo();
      
      expect(manager.get('audio.isPlaying')).toBe(false);
      expect(manager.get('audio.volume')).toBe(1.0);
    });
  });
  
  describe('Computed Properties', () => {
    it('should compute property from dependencies', () => {
      manager.set('audio.currentTime', 30);
      manager.set('audio.duration', 100);
      
      manager.compute(
        'audio.percentage',
        ['audio.currentTime', 'audio.duration'],
        (currentTime, duration) => {
          return duration > 0 ? (currentTime / duration) * 100 : 0;
        }
      );
      
      expect(manager.get('audio.percentage')).toBe(30);
    });
    
    it('should cache computed values', () => {
      const computeFn = vi.fn((a, b) => a + b);
      
      manager.set('audio.currentTime', 10);
      manager.set('audio.duration', 20);
      
      manager.compute('audio.sum', ['audio.currentTime', 'audio.duration'], computeFn);
      
      // First access computes
      manager.get('audio.sum');
      expect(computeFn).toHaveBeenCalledTimes(1);
      
      // Second access uses cache
      manager.get('audio.sum');
      expect(computeFn).toHaveBeenCalledTimes(1);
    });
    
    it('should recompute when dependencies change', () => {
      const computeFn = vi.fn((a, b) => a + b);
      
      manager.set('audio.currentTime', 10);
      manager.set('audio.duration', 20);
      
      manager.compute('audio.sum', ['audio.currentTime', 'audio.duration'], computeFn);
      
      manager.get('audio.sum');
      expect(computeFn).toHaveBeenCalledTimes(1);
      
      // Change dependency
      manager.set('audio.currentTime', 15);
      
      // Should recompute
      manager.get('audio.sum');
      expect(computeFn).toHaveBeenCalledTimes(2);
    });
  });
  
  describe('Validation', () => {
    it('should validate values on set', () => {
      expect(() => {
        manager.set('audio.playhead', 1.5);
      }).toThrow('Validation failed');
    });
    
    it('should validate audio.playhead range', () => {
      expect(() => manager.set('audio.playhead', -0.1)).toThrow();
      expect(() => manager.set('audio.playhead', 1.1)).toThrow();
      expect(() => manager.set('audio.playhead', 0.5)).not.toThrow();
    });
    
    it('should validate audio.volume range', () => {
      expect(() => manager.set('audio.volume', -0.1)).toThrow();
      expect(() => manager.set('audio.volume', 1.1)).toThrow();
      expect(() => manager.set('audio.volume', 0.5)).not.toThrow();
    });
    
    it('should allow skipping validation', () => {
      expect(() => {
        manager.set('audio.playhead', 1.5, { validate: false });
      }).not.toThrow();
    });
    
    it('should support custom validators', () => {
      manager.validate('audio.isPlaying', (value) => {
        if (typeof value !== 'boolean') return 'Must be boolean';
        return null;
      });
      
      expect(() => manager.set('audio.isPlaying', 'true')).toThrow();
      expect(() => manager.set('audio.isPlaying', true)).not.toThrow();
    });
  });
  
  describe('History', () => {
    it('should record history on changes', () => {
      manager.set('audio.isPlaying', true);
      expect(manager.canUndo()).toBe(true);
    });
    
    it('should not record history for same value', () => {
      manager.set('audio.isPlaying', false); // Same as default
      expect(manager.canUndo()).toBe(false);
    });
    
    it('should undo changes', () => {
      manager.set('audio.isPlaying', true);
      manager.set('audio.volume', 0.5);
      
      manager.undo();
      expect(manager.get('audio.volume')).toBe(1.0);
      
      manager.undo();
      expect(manager.get('audio.isPlaying')).toBe(false);
    });
    
    it('should redo changes', () => {
      manager.set('audio.isPlaying', true);
      expect(manager.canUndo()).toBe(true);
      
      manager.undo();
      expect(manager.get('audio.isPlaying')).toBe(false);
      expect(manager.canRedo()).toBe(true);
      
      manager.redo();
      expect(manager.get('audio.isPlaying')).toBe(true);
    });
    
    it('should not undo beyond history', () => {
      manager.set('audio.isPlaying', true);
      manager.undo();
      
      expect(manager.undo()).toBe(false);
      expect(manager.canUndo()).toBe(false);
    });
    
    it('should not redo beyond history', () => {
      expect(manager.redo()).toBe(false);
      expect(manager.canRedo()).toBe(false);
    });
    
    it('should clear redo history on new change', () => {
      manager.set('audio.isPlaying', true);
      manager.set('audio.volume', 0.5);
      manager.undo(); // Back to isPlaying=true, volume=1.0
      
      expect(manager.canRedo()).toBe(true);
      
      manager.set('audio.volume', 0.8); // New change should clear redo
      expect(manager.canRedo()).toBe(false);
    });
    
    it('should get history metadata', () => {
      manager.set('audio.isPlaying', true);
      manager.set('audio.volume', 0.5);
      
      const history = manager.getHistory();
      // Initial state + 2 changes = 3 entries
      expect(history.length).toBe(3);
      expect(history[2].isCurrent).toBe(true);
    });
  });
  
  describe('Persistence', () => {
    let storage;
    
    beforeEach(() => {
      // Create real localStorage-like behavior
      storage = {};
      localStorage.getItem = vi.fn((key) => storage[key] || null);
      localStorage.setItem = vi.fn((key, value) => { storage[key] = value; });
      localStorage.removeItem = vi.fn((key) => { delete storage[key]; });
      localStorage.clear = vi.fn(() => { storage = {}; });
    });
    
    it('should save state to localStorage', () => {
      manager.set('settings.defaultVolume', 0.7, { validate: false });
      manager.save(); // Explicitly save
      
      const saved = localStorage.getItem('spiral-waveform-state');
      expect(saved).toBeTruthy();
      
      const parsed = JSON.parse(saved);
      expect(parsed.settings.defaultVolume).toBe(0.7);
    });
    
    it('should load state from localStorage', () => {
      manager.set('settings.defaultVolume', 0.7, { validate: false });
      manager.save(); // Explicitly save
      
      const newManager = new StateManager();
      newManager.load();
      
      expect(newManager.get('settings.defaultVolume')).toBe(0.7);
    });
    
    it('should handle missing localStorage data', () => {
      expect(manager.load()).toBe(false);
    });
    
    it('should handle corrupted localStorage data', () => {
      localStorage.setItem('spiral-waveform-state', 'invalid json');
      expect(manager.load()).toBe(false);
    });
  });
  
  describe('Reset', () => {
    it('should reset entire state', () => {
      manager.set('audio.isPlaying', true);
      manager.set('audio.volume', 0.5);
      
      manager.reset();
      
      expect(manager.get('audio.isPlaying')).toBe(false);
      expect(manager.get('audio.volume')).toBe(1.0);
    });
    
    it('should reset specific section', () => {
      manager.set('audio.isPlaying', true);
      manager.set('visual.isTransitioning', true);
      
      manager.reset('audio');
      
      expect(manager.get('audio.isPlaying')).toBe(false);
      expect(manager.get('visual.isTransitioning')).toBe(true);
    });
  });
  
  describe('Export/Debug', () => {
    it('should export state snapshot', () => {
      manager.set('audio.isPlaying', true);
      
      const snapshot = manager.export();
      expect(snapshot).toHaveProperty('state');
      expect(snapshot).toHaveProperty('timestamp');
      expect(snapshot).toHaveProperty('version');
      expect(snapshot.state.audio.isPlaying).toBe(true);
    });
    
    it('should provide debug information', () => {
      manager.subscribe('audio.isPlaying', () => {});
      manager.compute('test', ['audio.isPlaying'], (v) => v);
      manager.validate('test', () => null);
      
      const debug = manager.debug();
      expect(debug).toHaveProperty('state');
      expect(debug).toHaveProperty('listeners');
      expect(debug).toHaveProperty('computed');
      expect(debug).toHaveProperty('validators');
      expect(debug).toHaveProperty('history');
      
      expect(debug.listeners).toContain('audio.isPlaying');
      expect(debug.computed).toContain('test');
      expect(debug.validators).toContain('test');
    });
  });
  
  describe('Edge Cases', () => {
    it('should handle undefined path', () => {
      const state = manager.get();
      expect(state).toHaveProperty('audio');
    });
    
    it('should handle non-existent path', () => {
      expect(manager.get('nonexistent.path')).toBeUndefined();
    });
    
    it('should handle null values', () => {
      manager.set('audio.buffer', null);
      expect(manager.get('audio.buffer')).toBeNull();
    });
    
    it('should handle array values', () => {
      manager.set('test.array', [1, 2, 3]);
      const arr = manager.get('test.array');
      expect(arr).toEqual([1, 2, 3]);
    });
    
    it('should clone arrays to prevent mutations', () => {
      manager.set('test.array', [1, 2, 3]);
      const arr1 = manager.get('test.array');
      const arr2 = manager.get('test.array');
      expect(arr1).not.toBe(arr2);
    });
    
    it('should handle Date objects', () => {
      const now = new Date();
      manager.set('test.date', now);
      const retrieved = manager.get('test.date');
      expect(retrieved).toEqual(now);
      expect(retrieved).not.toBe(now);
    });
    
    it('should handle TypedArrays', () => {
      const arr = new Float32Array([1, 2, 3]);
      manager.set('audio.waveform', arr);
      const retrieved = manager.get('audio.waveform');
      expect(retrieved).toEqual(arr);
    });
  });
  
  describe('Performance', () => {
    it('should handle many subscribers efficiently', () => {
      const callbacks = Array.from({ length: 100 }, () => vi.fn());
      callbacks.forEach(cb => manager.subscribe('audio.isPlaying', cb));
      
      const start = performance.now();
      manager.set('audio.isPlaying', true);
      const duration = performance.now() - start;
      
      expect(duration).toBeLessThan(20); // Should be very fast
      callbacks.forEach(cb => expect(cb).toHaveBeenCalled());
    });
    
    it('should handle deep state efficiently', () => {
      const start = performance.now();
      for (let i = 0; i < 100; i++) {
        manager.set('visual.playheadAnimation.progress', Math.random());
      }
      const duration = performance.now() - start;
      
      expect(duration).toBeLessThan(50); // Should be fast
    });
  });
});
