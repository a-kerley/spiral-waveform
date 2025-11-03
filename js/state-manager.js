/**
 * State Manager - Unified State Management System
 * Provides observable, type-safe state management for the entire application
 */

import { ValidationConfig } from './validation-config.js';

// Default state schema
const DEFAULT_STATE = {
  audio: {
    buffer: null,
    waveform: null,
    maxAmplitude: 1,
    playhead: 0,
    currentTime: 0,
    duration: 0,
    isPlaying: false,
    volume: 1.0,
    isLoading: false,
    loadingProgress: 0,
    error: null
  },
  
  visual: {
    isTransitioning: false,
    transitionStartTime: 0,
    animationProgress: 0,
    lastStateChange: 0,
    
    playheadAnimation: {
      progress: 0,
      startTime: 0,
      targetVisibility: false,
      isAnimating: false
    },
    
    timeDisplayAnimation: {
      progress: 0,
      targetVisibility: false,
      isAnimating: false
    },
    
    boost: {
      current: 1.0,
      target: 1.0
    },
    
    endOfFileReset: {
      isActive: false,
      startTime: null
    }
  },
  
  interaction: {
    isDragging: false,
    dragStartPosition: null,
    dragCurrentPosition: null,
    dragStartAngle: null,
    dragStartPlayhead: null,
    
    isScrubbing: false,
    scrubStartTime: 0,
    lastScrubTime: 0,
    scrubDirection: 1,
    scrubPosition: 0,
    previewDuration: 0,
    
    wasPlaying: false,
    hasAudioSource: false,
    lastUpdateTime: 0
  },
  
  render: {
    components: {
      waveform: true,
      playhead: true,
      button: true,
      timeDisplay: true,
      background: true
    },
    
    cache: {
      gradient: null,
      gradientParams: null,
      lastWaveformData: null
    },
    
    performance: {
      waveformRenderTime: 0,
      playheadRenderTime: 0,
      compositeTime: 0,
      frameTime: 0
    }
  },
  
  ui: {
    error: null,
    errorMessage: '',
    isErrorVisible: false,
    
    isLoading: false,
    loadingMessage: '',
    
    successMessage: '',
    isSuccessVisible: false,
    
    tooltip: {
      text: '',
      isVisible: false,
      x: 0,
      y: 0
    }
  },
  
  settings: {
    defaultVolume: 1.0,
    enableScrubPreview: true,
    scrubPreviewVolume: 0.7,
    
    enableAnimations: true,
    enableLayerOptimization: true,
    showTimeDisplay: true,
    showDebugInfo: false,
    
    enablePerformanceMonitoring: false,
    targetFPS: 60,
    
    lastUrl: '',
    lastVolume: 1.0
  }
};

/**
 * StateManager - Observable state management
 */
export class StateManager {
  #state = null;
  #listeners = new Map();
  #computedProperties = new Map();
  #history = [];
  #historyIndex = -1;
  #maxHistory = 50;
  #batchDepth = 0;
  #batchUpdates = new Map();
  #validators = new Map();
  
  constructor(initialState = null) {
    this.#state = this.#deepClone(initialState || DEFAULT_STATE);
    this.#setupDefaultValidators();
    
    // Initialize history with initial state
    this.#recordHistory();
    
    // Make available globally for debugging
    if (typeof window !== 'undefined') {
      window.__SPIRAL_STATE_MANAGER__ = this;
    }
  }
  
  /**
   * Get value at path
   * @param {string} path - Dot-separated path (e.g., 'audio.isPlaying')
   * @returns {*} Value at path
   */
  get(path) {
    if (!path) {
      return this.#deepClone(this.#state);
    }
    
    // Check if computed property
    if (this.#computedProperties.has(path)) {
      return this.#computeProperty(path);
    }
    
    const value = this.#getByPath(this.#state, path);
    
    // Return deep clone to prevent external mutations
    return this.#deepClone(value);
  }
  
  /**
   * Set value at path
   * @param {string} path - Dot-separated path
   * @param {*} value - New value
   * @param {object} options - Options { silent, validate, recordHistory }
   */
  set(path, value, options = {}) {
    const {
      silent = false,
      validate = true,
      recordHistory = true
    } = options;
    
    // Validate if enabled
    if (validate && this.#validators.has(path)) {
      const validator = this.#validators.get(path);
      const error = validator(value, this.#state);
      if (error) {
        throw new Error(`Validation failed for ${path}: ${error}`);
      }
    }
    
    // Get old value
    const oldValue = this.#getByPath(this.#state, path);
    
    // Check if value actually changed
    if (this.#deepEquals(oldValue, value)) {
      return; // No change, skip update
    }
    
    // Update state
    this.#setByPath(this.#state, path, value);
    
    // Record history after change
    if (recordHistory && !this.#batchDepth) {
      this.#recordHistory();
    }
    
    // Handle batching
    if (this.#batchDepth > 0) {
      this.#batchUpdates.set(path, { oldValue, newValue: value });
      return;
    }
    
    // Notify listeners
    if (!silent) {
      this.#notifyListeners(path, value, oldValue);
    }
    
    // Auto-persist settings
    if (path.startsWith('settings.')) {
      this.#persistSettings();
    }
  }
  
  /**
   * Batch multiple updates (single notification)
   * @param {object} updates - Object with path: value pairs
   */
  batch(updates) {
    this.#batchDepth++;
    
    try {
      Object.entries(updates).forEach(([path, value]) => {
        this.set(path, value, { recordHistory: false });
      });
    } finally {
      this.#batchDepth--;
      
      if (this.#batchDepth === 0 && this.#batchUpdates.size > 0) {
        // Record history after batch
        this.#recordHistory();
        
        // Notify all affected paths
        this.#batchUpdates.forEach(({ oldValue, newValue }, path) => {
          this.#notifyListeners(path, newValue, oldValue);
        });
        
        this.#batchUpdates.clear();
      }
    }
  }
  
  /**
   * Subscribe to state changes
   * @param {string} path - Path to watch ('*' for all)
   * @param {function} callback - Callback(newValue, oldValue)
   * @param {object} options - { immediate, once }
   * @returns {function} Unsubscribe function
   */
  subscribe(path, callback, options = {}) {
    const { immediate = false, once = false } = options;
    
    if (typeof callback !== 'function') {
      throw new Error('Callback must be a function');
    }
    
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
  
  /**
   * Unsubscribe from state changes
   * @param {string} path - Path that was watched
   * @param {function} callback - Original callback
   */
  unsubscribe(path, callback) {
    const normalizedPath = path === '*' ? '__all__' : path;
    const listeners = this.#listeners.get(normalizedPath);
    if (listeners) {
      listeners.delete(callback);
      if (listeners.size === 0) {
        this.#listeners.delete(normalizedPath);
      }
    }
  }
  
  /**
   * Define computed property
   * @param {string} path - Path for computed value
   * @param {array} dependencies - Paths to depend on
   * @param {function} computeFn - Function to compute value
   */
  compute(path, dependencies, computeFn) {
    if (!Array.isArray(dependencies)) {
      throw new Error('Dependencies must be an array');
    }
    if (typeof computeFn !== 'function') {
      throw new Error('Compute function must be a function');
    }
    
    this.#computedProperties.set(path, {
      dependencies,
      computeFn,
      cachedValue: null,
      isDirty: true
    });
    
    // Subscribe to dependencies to invalidate cache
    dependencies.forEach(dep => {
      this.subscribe(dep, () => {
        const computed = this.#computedProperties.get(path);
        if (computed) {
          computed.isDirty = true;
        }
      });
    });
  }
  
  /**
   * Add validator for path
   * @param {string} path - Path to validate
   * @param {function} validator - Validation function (value, state) => error | null
   */
  validate(path, validator) {
    if (typeof validator !== 'function') {
      throw new Error('Validator must be a function');
    }
    this.#validators.set(path, validator);
  }
  
  /**
   * Reset state to defaults
   * @param {string} section - Optional section to reset
   */
  reset(section = null) {
    if (section) {
      const defaultSection = DEFAULT_STATE[section];
      if (defaultSection) {
        this.set(section, this.#deepClone(defaultSection));
      }
    } else {
      this.#state = this.#deepClone(DEFAULT_STATE);
      this.#notifyListeners('__all__', this.#state, null);
      this.#clearHistory();
    }
  }
  
  /**
   * History management
   */
  canUndo() {
    return this.#historyIndex > 0;
  }
  
  canRedo() {
    return this.#historyIndex < this.#history.length - 1;
  }
  
  undo() {
    if (!this.canUndo()) return false;
    
    this.#historyIndex--;
    this.#state = this.#deepClone(this.#history[this.#historyIndex]);
    this.#notifyListeners('__all__', this.#state, null);
    return true;
  }
  
  redo() {
    if (!this.canRedo()) return false;
    
    this.#historyIndex++;
    this.#state = this.#deepClone(this.#history[this.#historyIndex]);
    this.#notifyListeners('__all__', this.#state, null);
    return true;
  }
  
  getHistory() {
    return this.#history.map((state, index) => ({
      index,
      isCurrent: index === this.#historyIndex,
      timestamp: state.__timestamp || 0
    }));
  }
  
  /**
   * Persistence
   */
  save(key = 'spiral-waveform-state') {
    try {
      const stateToSave = {
        settings: this.get('settings'),
        audio: {
          volume: this.get('audio.volume')
        }
      };
      localStorage.setItem(key, JSON.stringify(stateToSave));
      return true;
    } catch (error) {
      console.error('Failed to save state:', error);
      return false;
    }
  }
  
  load(key = 'spiral-waveform-state') {
    try {
      const saved = localStorage.getItem(key);
      if (!saved) return false;
      
      const parsed = JSON.parse(saved);
      
      // Restore settings
      if (parsed.settings) {
        this.batch({
          ...Object.entries(parsed.settings).reduce((acc, [k, v]) => {
            acc[`settings.${k}`] = v;
            return acc;
          }, {})
        });
      }
      
      // Restore audio volume
      if (parsed.audio?.volume !== undefined) {
        this.set('audio.volume', parsed.audio.volume);
      }
      
      return true;
    } catch (error) {
      console.error('Failed to load state:', error);
      return false;
    }
  }
  
  /**
   * Export state snapshot
   */
  export() {
    return {
      state: this.#deepClone(this.#state),
      timestamp: Date.now(),
      version: '1.0.0'
    };
  }
  
  /**
   * Debug information
   */
  debug() {
    return {
      state: this.#deepClone(this.#state),
      listeners: Array.from(this.#listeners.keys()),
      listenerCounts: Array.from(this.#listeners.entries()).map(([path, listeners]) => ({
        path,
        count: listeners.size
      })),
      computed: Array.from(this.#computedProperties.keys()),
      validators: Array.from(this.#validators.keys()),
      history: {
        length: this.#history.length,
        index: this.#historyIndex,
        canUndo: this.canUndo(),
        canRedo: this.canRedo()
      }
    };
  }
  
  /**
   * Private methods
   */
  
  #getByPath(obj, path) {
    const segments = path.split('.');
    let current = obj;
    
    for (const segment of segments) {
      if (current === null || current === undefined) {
        return undefined;
      }
      current = current[segment];
    }
    
    return current;
  }
  
  #setByPath(obj, path, value) {
    const segments = path.split('.');
    const lastSegment = segments.pop();
    let current = obj;
    
    for (const segment of segments) {
      if (!(segment in current)) {
        current[segment] = {};
      }
      current = current[segment];
    }
    
    current[lastSegment] = value;
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
  
  #computeProperty(path) {
    const computed = this.#computedProperties.get(path);
    if (!computed) return undefined;
    
    if (computed.isDirty) {
      const depValues = computed.dependencies.map(dep => this.get(dep));
      computed.cachedValue = computed.computeFn(...depValues);
      computed.isDirty = false;
    }
    
    return computed.cachedValue;
  }
  
  #recordHistory() {
    // Remove any history after current index
    if (this.#historyIndex < this.#history.length - 1) {
      this.#history = this.#history.slice(0, this.#historyIndex + 1);
    }
    
    // Add timestamp to state
    const stateSnapshot = this.#deepClone(this.#state);
    stateSnapshot.__timestamp = Date.now();
    
    // Add to history
    this.#history.push(stateSnapshot);
    this.#historyIndex++;
    
    // Limit history size
    if (this.#history.length > this.#maxHistory) {
      this.#history.shift();
      this.#historyIndex--;
    }
  }
  
  #clearHistory() {
    this.#history = [];
    this.#historyIndex = -1;
  }
  
  #persistSettings() {
    // Auto-save settings in background
    if (typeof requestIdleCallback !== 'undefined') {
      requestIdleCallback(() => {
        this.save();
      }, { timeout: 1000 });
    } else {
      // Fallback for Node.js environment
      setTimeout(() => {
        this.save();
      }, 100);
    }
  }
  
  #setupDefaultValidators() {
    // Audio validators
    this.validate('audio.playhead', (value) => {
      if (typeof value !== 'number') return 'Must be a number';
      if (value < 0 || value > 1) return 'Must be between 0 and 1';
      if (!isFinite(value)) return 'Must be finite';
      return null;
    });
    
    this.validate('audio.volume', (value) => {
      if (typeof value !== 'number') return 'Must be a number';
      if (value < 0 || value > 1) return 'Must be between 0 and 1';
      return null;
    });
    
    this.validate('audio.duration', (value) => {
      if (typeof value !== 'number') return 'Must be a number';
      if (value < 0) return 'Must be non-negative';
      if (!isFinite(value)) return 'Must be finite';
      return null;
    });
    
    // Visual validators
    this.validate('visual.animationProgress', (value) => {
      if (typeof value !== 'number') return 'Must be a number';
      if (value < 0 || value > 1) return 'Must be between 0 and 1';
      return null;
    });
    
    // Interaction validators
    this.validate('interaction.scrubDirection', (value) => {
      if (value !== 1 && value !== -1) return 'Must be 1 or -1';
      return null;
    });
  }
  
  #deepClone(obj) {
    if (obj === null || typeof obj !== 'object') return obj;
    if (obj instanceof Date) return new Date(obj);
    if (obj instanceof RegExp) return new RegExp(obj);
    if (obj instanceof Map) return new Map(obj);
    if (obj instanceof Set) return new Set(obj);
    if (ArrayBuffer.isView(obj)) return obj.slice(); // TypedArrays
    
    // ✅ FIX: Don't clone Web API objects - they contain non-cloneable data
    // These should be stored by reference, not cloned
    if (obj instanceof AudioBuffer) return obj;
    if (obj instanceof HTMLElement) return obj;
    if (obj instanceof AudioContext) return obj;
    if (obj instanceof AudioNode) return obj;
    if (typeof OffscreenCanvas !== 'undefined' && obj instanceof OffscreenCanvas) return obj;
    
    if (Array.isArray(obj)) {
      return obj.map(item => this.#deepClone(item));
    }
    
    const cloned = {};
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        cloned[key] = this.#deepClone(obj[key]);
      }
    }
    return cloned;
  }
  
  #deepEquals(a, b) {
    if (a === b) return true;
    if (a === null || b === null) return false;
    if (typeof a !== 'object' || typeof b !== 'object') return false;
    
    const keysA = Object.keys(a);
    const keysB = Object.keys(b);
    
    if (keysA.length !== keysB.length) return false;
    
    for (const key of keysA) {
      if (!keysB.includes(key)) return false;
      if (!this.#deepEquals(a[key], b[key])) return false;
    }
    
    return true;
  }
}

// Create singleton instance
export const stateManager = new StateManager();

// Export for testing
export { DEFAULT_STATE };

// Global access for debugging
if (typeof window !== 'undefined') {
  window.__SPIRAL_STATE_MANAGER__ = stateManager;
}
