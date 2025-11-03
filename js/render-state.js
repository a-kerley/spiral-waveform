/**
 * Render State Manager
 * 
 * Tracks what components need to be redrawn using dirty flags.
 * Prevents unnecessary canvas operations by only redrawing changed components.
 * 
 * @module render-state
 */

import { system } from './logger.js';

/**
 * Component types that can be marked dirty
 */
export const RenderComponents = {
  WAVEFORM: 'waveform',
  PLAYHEAD: 'playhead',
  UI: 'ui',
  TIME_DISPLAY: 'timeDisplay',
  PLAY_BUTTON: 'playButton',
  FULL: 'full'
};

/**
 * RenderState - Manages dirty flags for selective rendering
 */
export class RenderState {
  #dirty = {
    waveform: true,      // Static waveform visualization
    playhead: true,      // Playhead indicator
    ui: true,            // UI controls
    timeDisplay: true,   // Time display text
    playButton: true,    // Play/pause button
    full: true           // Full redraw needed
  };

  #frameCount = 0;
  #lastCleanTime = performance.now();
  #redrawCount = 0;
  #skipCount = 0;

  constructor() {
    system('RenderState initialized', 'debug');
  }

  /**
   * Mark a component as needing redraw
   * @param {string} component - Component to mark dirty ('all' to mark everything)
   * @param {string} reason - Optional reason for debugging
   */
  markDirty(component, reason = '') {
    if (component === 'all') {
      this.markAllDirty();
      if (reason) {
        system(`Marked all components dirty: ${reason}`, 'debug');
      }
    } else if (component in this.#dirty) {
      this.#dirty[component] = true;
      this.#dirty.full = true;
      const message = reason ? `Marked ${component} dirty: ${reason}` : `Marked ${component} dirty`;
      system(message, 'debug');
    } else {
      system(`Unknown component: ${component}`, 'warn');
    }
  }

  /**
   * Mark all components as dirty
   */
  markAllDirty() {
    Object.keys(this.#dirty).forEach(key => {
      this.#dirty[key] = true;
    });
    system('Marked all components dirty', 'debug');
  }

  /**
   * Mark a component as clean (rendered)
   * @param {string} component - Component to mark clean
   */
  markClean(component) {
    if (component in this.#dirty) {
      this.#dirty[component] = false;
      
      // Check if full redraw flag can be cleared
      if (!this.needsRedraw()) {
        this.#dirty.full = false;
      }
    }
  }

  /**
   * Mark all components as clean
   */
  markAllClean() {
    Object.keys(this.#dirty).forEach(key => {
      this.#dirty[key] = false;
    });
    this.#lastCleanTime = performance.now();
  }

  /**
   * Check if a specific component needs redraw
   * @param {string} component - Component to check
   * @returns {boolean} Whether component is dirty
   */
  isDirty(component) {
    return this.#dirty[component] === true;
  }

  /**
   * Check if any component needs redraw
   * @returns {boolean} Whether any redraw is needed
   */
  needsRedraw() {
    const result = Object.entries(this.#dirty)
      .filter(([key]) => key !== 'full')
      .some(([, value]) => value === true);
    
    return result;
  }

  /**
   * Check if full redraw is needed
   * @returns {boolean} Whether full redraw is needed
   */
  needsFullRedraw() {
    return this.#dirty.full === true;
  }

  /**
   * Get all dirty components
   * @returns {string[]} Array of dirty component names
   */
  getDirtyComponents() {
    return Object.entries(this.#dirty)
      .filter(([key, value]) => key !== 'full' && value === true)
      .map(([key]) => key);
  }

  /**
   * Reset dirty flags after render
   * Call this after successfully rendering all dirty components
   */
  reset() {
    this.markAllClean();
    this.#frameCount++;
  }

  /**
   * Track that a frame was rendered
   */
  frameRendered() {
    this.#redrawCount++;
    this.#frameCount++;
  }

  /**
   * Track that a frame was skipped
   */
  frameSkipped() {
    this.#skipCount++;
    this.#frameCount++;
  }

  /**
   * Get performance statistics
   * @returns {Object} Performance metrics
   */
  getStats() {
    const totalFrames = this.#redrawCount + this.#skipCount;
    const skipRate = totalFrames > 0 ? (this.#skipCount / totalFrames) * 100 : 0;
    const timeSinceClean = performance.now() - this.#lastCleanTime;

    return {
      totalFrames,
      redrawCount: this.#redrawCount,
      skipCount: this.#skipCount,
      skipRate: skipRate.toFixed(1) + '%',
      timeSinceClean: Math.round(timeSinceClean) + 'ms',
      currentlyDirty: this.getDirtyComponents(),
      needsRedraw: this.needsRedraw()
    };
  }

  /**
   * Reset performance counters
   */
  resetStats() {
    this.#frameCount = 0;
    this.#redrawCount = 0;
    this.#skipCount = 0;
    this.#lastCleanTime = performance.now();
    system('RenderState stats reset', 'debug');
  }

  /**
   * Log current dirty state (for debugging)
   */
  logState() {
    const dirty = Object.entries(this.#dirty)
      .filter(([, value]) => value === true)
      .map(([key]) => key);
    
    const stats = this.getStats();
    
    console.group('🎨 RenderState Status');
    console.log('Dirty components:', dirty.length > 0 ? dirty.join(', ') : 'none');
    console.log('Needs redraw:', this.needsRedraw());
    console.log('Stats:', stats);
    console.groupEnd();
  }

  /**
   * Create a snapshot of current state
   * Useful for debugging and testing
   * @returns {Object} State snapshot
   */
  snapshot() {
    return {
      dirty: { ...this.#dirty },
      stats: this.getStats(),
      timestamp: Date.now()
    };
  }

  /**
   * Dispose of render state and release resources
   * Resets all tracking data
   */
  dispose() {
    this.reset();
    system('RenderState disposed', 'info');
  }
}

// Create singleton instance
const renderState = new RenderState();

// Convenience exports
export function markDirty(component) {
  renderState.markDirty(component);
}

export function markAllDirty() {
  renderState.markAllDirty();
}

export function isDirty(component) {
  return renderState.isDirty(component);
}

export function needsRedraw() {
  return renderState.needsRedraw();
}

export function resetRenderState() {
  renderState.reset();
}

export function getRenderStats() {
  return renderState.getStats();
}

export { renderState };
