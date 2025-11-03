/**
 * Performance Monitor
 * 
 * Tracks and measures application performance metrics including:
 * - FPS (Frames Per Second)
 * - Frame times (min/max/avg)
 * - Render performance (waveform, playhead, composite)
 * - Memory usage
 * - Operation timing with performance.mark/measure
 * 
 * @module performance-monitor
 */

import { system } from './logger.js';
import { getMemoryInfo } from './memory-manager.js';
import { getRenderStats } from './render-state.js';
import { getLayerStats } from './layer-manager.js';

/**
 * PerformanceMonitor - Tracks and reports performance metrics
 */
export class PerformanceMonitor {
  // FPS tracking
  #frames = [];
  #lastFrameTime = 0;
  #fps = 0;
  #minFps = Infinity;
  #maxFps = 0;
  #avgFps = 0;

  // Frame time tracking (in ms)
  #frameTimes = [];
  #frameTimeWindow = 60; // Track last 60 frames
  #minFrameTime = Infinity;
  #maxFrameTime = 0;
  #avgFrameTime = 0;

  // Operation timing
  #operationTimings = new Map();
  #operationCounts = new Map();

  // Performance marks
  #markPrefix = 'spiral-waveform';
  
  // Monitoring state
  #enabled = false;
  #startTime = 0;
  #totalFrames = 0;

  // Update frequency
  #updateInterval = 1000; // Update stats every 1 second
  #lastUpdate = 0;

  constructor() {
    this.#startTime = performance.now();
    system('PerformanceMonitor initialized', 'debug');
  }

  /**
   * Enable performance monitoring
   */
  enable() {
    this.#enabled = true;
    this.#startTime = performance.now();
    system('Performance monitoring enabled', 'info');
  }

  /**
   * Disable performance monitoring
   */
  disable() {
    this.#enabled = false;
    system('Performance monitoring disabled', 'info');
  }

  /**
   * Check if monitoring is enabled
   */
  isEnabled() {
    return this.#enabled;
  }

  /**
   * Mark the start of a frame
   * Call this at the beginning of each animation frame
   */
  frameStart() {
    if (!this.#enabled) return;

    const now = performance.now();
    
    if (this.#lastFrameTime > 0) {
      const frameTime = now - this.#lastFrameTime;
      
      // Track frame times
      this.#frameTimes.push(frameTime);
      if (this.#frameTimes.length > this.#frameTimeWindow) {
        this.#frameTimes.shift();
      }

      // Calculate FPS
      const fps = 1000 / frameTime;
      this.#frames.push(fps);
      
      // Keep only last 60 frames for FPS calculation
      if (this.#frames.length > 60) {
        this.#frames.shift();
      }

      this.#totalFrames++;
    }

    this.#lastFrameTime = now;

    // Update stats periodically
    if (now - this.#lastUpdate > this.#updateInterval) {
      this.#updateStats();
      this.#lastUpdate = now;
    }
  }

  /**
   * Mark the start of an operation
   * @param {string} operation - Operation name
   */
  markStart(operation) {
    if (!this.#enabled) return;
    
    const markName = `${this.#markPrefix}-${operation}-start`;
    performance.mark(markName);
  }

  /**
   * Mark the end of an operation and measure duration
   * @param {string} operation - Operation name
   * @returns {number} Duration in milliseconds
   */
  markEnd(operation) {
    if (!this.#enabled) return 0;

    const startMark = `${this.#markPrefix}-${operation}-start`;
    const endMark = `${this.#markPrefix}-${operation}-end`;
    const measureName = `${this.#markPrefix}-${operation}`;

    try {
      performance.mark(endMark);
      performance.measure(measureName, startMark, endMark);

      const measure = performance.getEntriesByName(measureName).pop();
      const duration = measure ? measure.duration : 0;

      // Track timing
      if (!this.#operationTimings.has(operation)) {
        this.#operationTimings.set(operation, []);
        this.#operationCounts.set(operation, 0);
      }

      const timings = this.#operationTimings.get(operation);
      timings.push(duration);
      
      // Keep only last 100 measurements
      if (timings.length > 100) {
        timings.shift();
      }

      this.#operationCounts.set(operation, this.#operationCounts.get(operation) + 1);

      // Clean up marks
      performance.clearMarks(startMark);
      performance.clearMarks(endMark);
      performance.clearMeasures(measureName);

      return duration;
    } catch (error) {
      system(`Error measuring operation ${operation}: ${error.message}`, 'warn');
      return 0;
    }
  }

  /**
   * Update calculated statistics
   */
  #updateStats() {
    // Calculate FPS stats
    if (this.#frames.length > 0) {
      this.#fps = this.#frames[this.#frames.length - 1];
      this.#minFps = Math.min(...this.#frames);
      this.#maxFps = Math.max(...this.#frames);
      this.#avgFps = this.#frames.reduce((a, b) => a + b, 0) / this.#frames.length;
    }

    // Calculate frame time stats
    if (this.#frameTimes.length > 0) {
      this.#minFrameTime = Math.min(...this.#frameTimes);
      this.#maxFrameTime = Math.max(...this.#frameTimes);
      this.#avgFrameTime = this.#frameTimes.reduce((a, b) => a + b, 0) / this.#frameTimes.length;
    }
  }

  /**
   * Get current FPS
   */
  getFPS() {
    return Math.round(this.#fps);
  }

  /**
   * Get FPS statistics
   */
  getFPSStats() {
    return {
      current: Math.round(this.#fps),
      min: Math.round(this.#minFps),
      max: Math.round(this.#maxFps),
      avg: Math.round(this.#avgFps)
    };
  }

  /**
   * Get frame time statistics (in milliseconds)
   */
  getFrameTimeStats() {
    return {
      current: this.#frameTimes[this.#frameTimes.length - 1]?.toFixed(2) || '0.00',
      min: this.#minFrameTime.toFixed(2),
      max: this.#maxFrameTime.toFixed(2),
      avg: this.#avgFrameTime.toFixed(2)
    };
  }

  /**
   * Get operation timing statistics
   * @param {string} operation - Operation name
   */
  getOperationStats(operation) {
    const timings = this.#operationTimings.get(operation);
    const count = this.#operationCounts.get(operation) || 0;

    if (!timings || timings.length === 0) {
      return {
        count: 0,
        min: 0,
        max: 0,
        avg: 0,
        total: 0
      };
    }

    const min = Math.min(...timings);
    const max = Math.max(...timings);
    const total = timings.reduce((a, b) => a + b, 0);
    const avg = total / timings.length;

    return {
      count,
      min: min.toFixed(2),
      max: max.toFixed(2),
      avg: avg.toFixed(2),
      total: total.toFixed(2)
    };
  }

  /**
   * Get all operation statistics
   */
  getAllOperationStats() {
    const stats = {};
    for (const operation of this.#operationTimings.keys()) {
      stats[operation] = this.getOperationStats(operation);
    }
    return stats;
  }

  /**
   * Get comprehensive performance report
   */
  getReport() {
    const uptime = ((performance.now() - this.#startTime) / 1000).toFixed(1);

    return {
      enabled: this.#enabled,
      uptime: `${uptime}s`,
      totalFrames: this.#totalFrames,
      fps: this.getFPSStats(),
      frameTime: this.getFrameTimeStats(),
      operations: this.getAllOperationStats(),
      memory: getMemoryInfo(),
      render: getRenderStats(),
      layers: getLayerStats()
    };
  }

  /**
   * Print performance report to console
   */
  printReport() {
    const report = this.getReport();

    console.group('📊 Performance Report');
    console.log('Enabled:', report.enabled);
    console.log('Uptime:', report.uptime);
    console.log('Total Frames:', report.totalFrames);
    console.log('');
    console.log('FPS:', report.fps);
    console.log('Frame Time (ms):', report.frameTime);
    console.log('');
    
    if (Object.keys(report.operations).length > 0) {
      console.log('Operations:');
      for (const [op, stats] of Object.entries(report.operations)) {
        console.log(`  ${op}:`, stats);
      }
      console.log('');
    }
    
    console.log('Memory:', report.memory);
    console.log('Render State:', report.render);
    console.log('Layers:', report.layers);
    console.groupEnd();
  }

  /**
   * Reset all statistics
   */
  reset() {
    this.#frames = [];
    this.#frameTimes = [];
    this.#lastFrameTime = 0;
    this.#fps = 0;
    this.#minFps = Infinity;
    this.#maxFps = 0;
    this.#avgFps = 0;
    this.#minFrameTime = Infinity;
    this.#maxFrameTime = 0;
    this.#avgFrameTime = 0;
    this.#operationTimings.clear();
    this.#operationCounts.clear();
    this.#startTime = performance.now();
    this.#totalFrames = 0;
    this.#lastUpdate = 0;
    
    system('Performance stats reset', 'info');
  }

  /**
   * Dispose and clean up
   */
  dispose() {
    this.disable();
    this.reset();
    system('PerformanceMonitor disposed', 'info');
  }
}

// Create singleton instance
const performanceMonitor = new PerformanceMonitor();

// Convenience exports
export function enablePerformanceMonitoring() {
  performanceMonitor.enable();
}

export function disablePerformanceMonitoring() {
  performanceMonitor.disable();
}

export function isPerformanceMonitoringEnabled() {
  return performanceMonitor.isEnabled();
}

export function frameStart() {
  performanceMonitor.frameStart();
}

export function markOperationStart(operation) {
  performanceMonitor.markStart(operation);
}

export function markOperationEnd(operation) {
  return performanceMonitor.markEnd(operation);
}

export function getFPS() {
  return performanceMonitor.getFPS();
}

export function getPerformanceReport() {
  return performanceMonitor.getReport();
}

export function printPerformanceReport() {
  performanceMonitor.printReport();
}

export function resetPerformanceStats() {
  performanceMonitor.reset();
}

export { performanceMonitor };
