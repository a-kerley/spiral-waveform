# State Management Architecture

## Overview

This document defines the unified state management architecture for the Spiral Waveform Audio Player, consolidating scattered state objects into a single, observable, type-safe state management system.

## Current State Analysis

### State Locations Identified

1. **audio-state.js** - `audioState` object
   - `audioBuffer`: AudioBuffer | null
   - `waveform`: Float32Array | null  
   - `globalMaxAmp`: number
   - `currentPlayhead`: number (0-1)
   - `isPlaying`: boolean
   - `duration`: number (seconds)

2. **main.js** - `visualState` object
   - `isTransitioning`: boolean
   - `transitionStartTime`: number
   - `animationProgress`: number  
   - `lastStateChange`: number
   - `isDragging`: boolean
   - `wasPlaying`: boolean
   - `isEndOfFileReset`: boolean
   - `endOfFileResetStartTime`: number | null
   - `dragCurrentPosition`: {x, y} | null
   - `dragStartAngle`: number | null
   - `dragStartPlayhead`: number | null

3. **audio-playback.js** - `ScrubState` class instance
   - `isScrubbing`: boolean
   - `wasPlaying`: boolean  
   - `scrubStartTime`: number
   - `lastScrubTime`: number
   - `scrubDirection`: 1 | -1
   - `scrubPosition`: number
   - `previewDuration`: number
   - `hasAudioSource`: boolean
   - `lastUpdateTime`: number

4. **waveform-draw.js** - `AnimationState` class instance
   - `playheadAnimationProgress`: number
   - `playheadAnimationStartTime`: number
   - `playheadTargetVisibility`: boolean
   - `isPlayheadAnimatingFlag`: boolean
   - `timeDisplayAnimationProgress`: number
   - `timeDisplayTargetVisibility`: boolean
   - `isTimeDisplayAnimating`: boolean
   - `currentBoostFactor`: number
   - `targetBoostFactor`: number
   - `cachedGradient`: CanvasGradient | null
   - `lastGradientParams`: object | null

5. **render-state.js** - `RenderState` class instance
   - Component dirty flags (waveform, playhead, button, etc.)
   - Performance tracking

6. **spiral-waveform-player.js** - Local instance state
   - `this.visualState`: Copy of visualState
   - Various UI element references

### Problems with Current Architecture

1. **Scattered State**: State spread across 6+ locations
2. **No Single Source of Truth**: Multiple places to update same logical state
3. **Synchronization Issues**: State can become inconsistent across modules
4. **No Change Notification**: Hard to react to state changes
5. **Testing Difficulty**: Must mock multiple state objects
6. **No State History**: Can't implement undo/redo
7. **No Persistence Strategy**: Settings scattered, no coherent save/load
8. **Type Safety**: No runtime type validation
9. **Performance**: Unnecessary re-renders due to lack of change detection

## Proposed Architecture

### Unified State Structure

```javascript
const appState = {
  // Audio subsystem
  audio: {
    buffer: null,              // AudioBuffer | null
    waveform: null,            // Float32Array | null
    maxAmplitude: 1,           // number
    playhead: 0,               // number (0-1)
    currentTime: 0,            // number (seconds)
    duration: 0,               // number (seconds)
    isPlaying: false,          // boolean
    volume: 1.0,               // number (0-1)
    isLoading: false,          // boolean
    loadingProgress: 0,        // number (0-1)
    error: null                // Error | null
  },
  
  // Visual/Animation subsystem
  visual: {
    // Transition state
    isTransitioning: false,    // boolean
    transitionStartTime: 0,    // number (timestamp)
    animationProgress: 0,      // number (0-1)
    lastStateChange: 0,        // number (timestamp)
    
    // Playhead animation
    playheadAnimation: {
      progress: 0,             // number (0-1)
      startTime: 0,            // number (timestamp)
      targetVisibility: false, // boolean
      isAnimating: false       // boolean
    },
    
    // Time display animation
    timeDisplayAnimation: {
      progress: 0,             // number (0-1)
      targetVisibility: false, // boolean
      isAnimating: false       // boolean
    },
    
    // Waveform boost
    boost: {
      current: 1.0,            // number
      target: 1.0              // number
    },
    
    // EOF reset
    endOfFileReset: {
      isActive: false,         // boolean
      startTime: null          // number | null
    }
  },
  
  // Interaction subsystem
  interaction: {
    // Drag state
    isDragging: false,         // boolean
    dragStartPosition: null,   // {x, y} | null
    dragCurrentPosition: null, // {x, y} | null
    dragStartAngle: null,      // number | null
    dragStartPlayhead: null,   // number | null
    
    // Scrubbing state
    isScrubbing: false,        // boolean
    scrubStartTime: 0,         // number (timestamp)
    lastScrubTime: 0,          // number (timestamp)
    scrubDirection: 1,         // 1 | -1
    scrubPosition: 0,          // number (0-1)
    previewDuration: 0,        // number (seconds)
    
    // Playback state preservation
    wasPlaying: false,         // boolean
    hasAudioSource: false,     // boolean
    lastUpdateTime: 0          // number (timestamp)
  },
  
  // Render subsystem
  render: {
    // Component dirty flags
    components: {
      waveform: true,          // boolean
      playhead: true,          // boolean
      button: true,            // boolean
      timeDisplay: true,       // boolean
      background: true         // boolean
    },
    
    // Cached resources
    cache: {
      gradient: null,          // CanvasGradient | null
      gradientParams: null,    // object | null
      lastWaveformData: null   // object | null
    },
    
    // Performance tracking
    performance: {
      waveformRenderTime: 0,   // number (ms)
      playheadRenderTime: 0,   // number (ms)
      compositeTime: 0,        // number (ms)
      frameTime: 0             // number (ms)
    }
  },
  
  // UI subsystem
  ui: {
    error: null,               // Error | null
    errorMessage: '',          // string
    isErrorVisible: false,     // boolean
    
    isLoading: false,          // boolean
    loadingMessage: '',        // string
    
    successMessage: '',        // string
    isSuccessVisible: false,   // boolean
    
    tooltip: {
      text: '',                // string
      isVisible: false,        // boolean
      x: 0,                    // number
      y: 0                     // number
    }
  },
  
  // Settings/Preferences
  settings: {
    // Audio preferences
    defaultVolume: 1.0,        // number (0-1)
    enableScrubPreview: true,  // boolean
    scrubPreviewVolume: 0.7,   // number (0-1)
    
    // Visual preferences
    enableAnimations: true,    // boolean
    enableLayerOptimization: true, // boolean
    showTimeDisplay: true,     // boolean
    showDebugInfo: false,      // boolean
    
    // Performance
    enablePerformanceMonitoring: false, // boolean
    targetFPS: 60,             // number
    
    // Last session
    lastUrl: '',               // string
    lastVolume: 1.0            // number (0-1)
  }
};
```

### State Manager Design

```javascript
// js/state-manager.js
export class StateManager {
  #state = { /* initial state */ };
  #listeners = new Map();
  #history = [];
  #historyIndex = -1;
  #maxHistory = 50;
  
  // Subscription management
  subscribe(path, callback, options = {}) {
    // path: 'audio.isPlaying' or 'audio' or '*'
    // options: { immediate: true, once: false }
  }
  
  unsubscribe(path, callback) { }
  
  // State access
  get(path) {
    // Returns deep clone to prevent mutations
  }
  
  set(path, value, options = {}) {
    // options: { silent: false, validate: true, batch: false }
    // Validates, updates, notifies, persists
  }
  
  // Batch updates (single notification)
  batch(updates) {
    // updates: { 'audio.isPlaying': true, 'visual.isTransitioning': false }
  }
  
  // Computed properties
  compute(path, dependencies, computeFn) {
    // Auto-update when dependencies change
  }
  
  // State history (undo/redo)
  canUndo() { }
  canRedo() { }
  undo() { }
  redo() { }
  clearHistory() { }
  
  // Persistence
  save(key = 'spiral-waveform-state') {
    // Save to localStorage
  }
  
  load(key = 'spiral-waveform-state') {
    // Load from localStorage
  }
  
  // Validation
  validate(path, value) {
    // Type and constraint validation
  }
  
  // Reset
  reset(section) {
    // Reset to defaults
  }
  
  // Debugging
  debug() {
    // Return state snapshot with metadata
  }
}
```

### Observable Pattern Implementation

```javascript
class StateManager {
  subscribe(path, callback, options = {}) {
    const { immediate = false, once = false } = options;
    
    // Normalize path
    const normalizedPath = path === '*' ? '__all__' : path;
    
    // Create listener entry
    if (!this.#listeners.has(normalizedPath)) {
      this.#listeners.set(normalizedPath, new Set());
    }
    
    // Wrap callback if 'once' option
    const wrappedCallback = once
      ? (...args) => {
          callback(...args);
          this.unsubscribe(path, wrappedCallback);
        }
      : callback;
    
    this.#listeners.get(normalizedPath).add(wrappedCallback);
    
    // Call immediately if requested
    if (immediate) {
      const value = this.get(path);
      wrappedCallback(value, value);
    }
    
    // Return unsubscribe function
    return () => this.unsubscribe(path, wrappedCallback);
  }
  
  #notifyListeners(path, newValue, oldValue) {
    // Notify exact path listeners
    const exactListeners = this.#listeners.get(path);
    if (exactListeners) {
      exactListeners.forEach(callback => {
        try {
          callback(newValue, oldValue);
        } catch (error) {
          console.error(`Error in state listener for ${path}:`, error);
        }
      });
    }
    
    // Notify parent path listeners
    const segments = path.split('.');
    for (let i = segments.length - 1; i > 0; i--) {
      const parentPath = segments.slice(0, i).join('.');
      const parentListeners = this.#listeners.get(parentPath);
      if (parentListeners) {
        const parentValue = this.get(parentPath);
        parentListeners.forEach(callback => {
          try {
            callback(parentValue, parentValue);
          } catch (error) {
            console.error(`Error in state listener for ${parentPath}:`, error);
          }
        });
      }
    }
    
    // Notify wildcard listeners
    const wildcardListeners = this.#listeners.get('__all__');
    if (wildcardListeners) {
      wildcardListeners.forEach(callback => {
        try {
          callback({ path, value: newValue, oldValue });
        } catch (error) {
          console.error('Error in wildcard state listener:', error);
        }
      });
    }
  }
}
```

## Migration Strategy

### Phase 1: Infrastructure (Week 7, Days 1-2)

**Tasks:**
1. Create `js/state-manager.js` with core functionality
2. Define complete state schema with TypeScript types/JSDoc
3. Implement observable pattern
4. Add validation system
5. Write comprehensive tests (100+ test cases)

**Deliverables:**
- ✅ `js/state-manager.js` (400-500 lines)
- ✅ `js/state-schema.js` (type definitions)
- ✅ `test/state-manager.test.js` (100+ tests)
- ✅ Documentation for state manager API

### Phase 2: Audio State Migration (Week 7, Days 3-4)

**Tasks:**
1. Create StateManager instance
2. Initialize with audio state
3. Create adapter layer for backward compatibility
4. Update `audio-state.js` to use StateManager internally
5. Update all audio state consumers
6. Add state change events
7. Test thoroughly

**Migration Pattern:**
```javascript
// Before
import { getAudioState, setAudioBuffer } from './audio-state.js';
const state = getAudioState();
state.isPlaying = true;

// After (backward compatible)
import { getAudioState, setAudioBuffer } from './audio-state.js';
const state = getAudioState(); // Returns proxy to state manager
state.isPlaying = true; // Updates through state manager

// After (preferred)
import { stateManager } from './state-manager.js';
stateManager.set('audio.isPlaying', true);
stateManager.subscribe('audio.isPlaying', (value) => {
  console.log('Playing state changed:', value);
});
```

### Phase 3: Visual State Migration (Week 8, Days 1-2)

**Tasks:**
1. Migrate `visualState` from main.js
2. Migrate `AnimationState` from waveform-draw.js
3. Update render loop to observe state
4. Remove scattered animation state
5. Consolidate transition logic

### Phase 4: Interaction State Migration (Week 8, Days 3-4)

**Tasks:**
1. Migrate `ScrubState` from audio-playback.js
2. Consolidate drag state from main.js
3. Add state synchronization
4. Simplify interaction handlers

### Phase 5: Render State Migration (Week 8, Day 5)

**Tasks:**
1. Integrate RenderState with StateManager
2. Auto-mark dirty on relevant state changes
3. Optimize re-render logic

### Phase 6: Settings & Persistence (Week 9, Days 1-2)

**Tasks:**
1. Migrate settings to state manager
2. Implement localStorage persistence
3. Add settings UI
4. Add import/export functionality

### Phase 7: Cleanup & Optimization (Week 9, Days 3-5)

**Tasks:**
1. Remove old state files
2. Update all imports
3. Remove adapter layers
4. Performance optimization
5. Final testing
6. Documentation update

## Benefits

### Developer Experience
- ✅ Single import for all state access
- ✅ Clear state structure and ownership
- ✅ Type-safe state access (with TypeScript/JSDoc)
- ✅ Easier testing (single mock point)
- ✅ Better debugging (state history, time travel)

### Performance
- ✅ Precise change detection (only notify affected listeners)
- ✅ Batch updates (single notification for multiple changes)
- ✅ Computed properties (cache derived values)
- ✅ Lazy evaluation (only compute when needed)

### Reliability
- ✅ No state synchronization bugs
- ✅ Validation at state boundaries
- ✅ Predictable state updates
- ✅ State history for debugging
- ✅ Better error handling

### Features
- ✅ Undo/redo support
- ✅ State persistence
- ✅ State snapshots
- ✅ Time-travel debugging
- ✅ Change tracking and audit log

## API Examples

### Basic Usage

```javascript
import { stateManager } from './state-manager.js';

// Get state
const isPlaying = stateManager.get('audio.isPlaying');
const audioState = stateManager.get('audio');

// Set state
stateManager.set('audio.isPlaying', true);
stateManager.set('audio.volume', 0.5);

// Batch updates
stateManager.batch({
  'audio.isPlaying': true,
  'visual.isTransitioning': true,
  'interaction.isDragging': false
});
```

### Subscriptions

```javascript
// Subscribe to specific path
const unsubscribe = stateManager.subscribe('audio.isPlaying', (isPlaying, wasPlaying) => {
  console.log(`Playing: ${wasPlaying} -> ${isPlaying}`);
});

// Subscribe to parent path (notified on any child change)
stateManager.subscribe('audio', (audioState) => {
  console.log('Audio state changed:', audioState);
});

// Subscribe to all changes
stateManager.subscribe('*', ({ path, value, oldValue }) => {
  console.log(`${path}: ${oldValue} -> ${value}`);
});

// Unsubscribe
unsubscribe();
```

### Computed Properties

```javascript
// Define computed property
stateManager.compute(
  'audio.percentage',
  ['audio.currentTime', 'audio.duration'],
  (currentTime, duration) => {
    return duration > 0 ? (currentTime / duration) * 100 : 0;
  }
);

// Access computed property
const percentage = stateManager.get('audio.percentage');

// Subscribe to computed property
stateManager.subscribe('audio.percentage', (percentage) => {
  console.log(`Progress: ${percentage.toFixed(1)}%`);
});
```

### History & Time Travel

```javascript
// Make changes
stateManager.set('audio.isPlaying', true);
stateManager.set('audio.volume', 0.7);

// Undo
if (stateManager.canUndo()) {
  stateManager.undo();
}

// Redo
if (stateManager.canRedo()) {
  stateManager.redo();
}

// Get history
const history = stateManager.getHistory();
console.log('State history:', history);
```

### Persistence

```javascript
// Save state
stateManager.save(); // Uses default key

// Load state
stateManager.load();

// Save specific section
const audioSettings = stateManager.get('settings');
localStorage.setItem('audio-settings', JSON.stringify(audioSettings));

// Export state
const stateSnapshot = stateManager.export();
// Send to server or download as file
```

## Testing Strategy

### Unit Tests
- State manager core functionality
- Observable pattern
- Validation system
- Persistence layer
- History management

### Integration Tests
- State migrations
- Backward compatibility
- Cross-module state updates
- Performance benchmarks

### E2E Tests
- UI interactions with state
- State persistence across sessions
- Error recovery

## Success Criteria

- ✅ All state consolidated into StateManager
- ✅ No direct state mutations outside StateManager
- ✅ 100% test coverage for StateManager
- ✅ Performance equal or better than current
- ✅ Zero regressions in functionality
- ✅ Complete documentation
- ✅ Migration guide for future state additions

## Timeline

- **Week 7**: Infrastructure + Audio State (5 days)
- **Week 8**: Visual + Interaction + Render State (5 days)
- **Week 9**: Settings + Cleanup + Testing (5 days)

**Total: 15 days**

## Risks & Mitigation

### Risk: Breaking Changes
**Mitigation**: Maintain backward compatibility with adapter layer during migration

### Risk: Performance Regression
**Mitigation**: Benchmark at each step, optimize notification system

### Risk: Complex Migration
**Mitigation**: Migrate one subsystem at a time, extensive testing

### Risk: Learning Curve
**Mitigation**: Comprehensive documentation, clear examples, gradual adoption
