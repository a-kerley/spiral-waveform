/**
 * Memory Manager
 * 
 * Coordinates memory cleanup across all application managers.
 * Provides a centralized interface for disposing resources and preventing memory leaks.
 * 
 * @module memory-manager
 */

import { AudioContextManager } from './audio-context-manager.js';
import { SettingsManager } from './settings-manager.js';
import { renderState } from './render-state.js';
import { TrigCache } from './trig-cache.js';
import { layerManager } from './layer-manager.js';
import { disposeAudioState } from './audio-state.js';
import { system } from './logger.js';

/**
 * MemoryManager - Coordinates cleanup across all managers
 */
export class MemoryManager {
  static #disposeCallbacks = [];
  static #memoryWarningThreshold = 0.8; // 80% of available memory
  static #isMonitoring = false;
  static #monitorInterval = null;

  /**
   * Register a custom dispose callback
   * @param {Function} callback - Function to call during dispose
   */
  static registerDisposeCallback(callback) {
    if (typeof callback === 'function') {
      this.#disposeCallbacks.push(callback);
    }
  }

  /**
   * Dispose of audio-related resources only
   * Call this when loading a new audio file
   * @returns {Promise<void>}
   */
  static async disposeAudio() {
    system('Disposing audio resources...', 'info');
    
    try {
      // Clear audio state and buffer references
      disposeAudioState();
      
      // Clear render state
      renderState.reset();
      
      // Clear layer cache (forces waveform re-render)
      layerManager.clearLayer(0); // Waveform layer
      layerManager.clearLayer(1); // Playhead layer
      
      // Note: We don't dispose AudioContext as it may be reused
      
      system('✅ Audio resources disposed successfully', 'info');
    } catch (error) {
      system(`❌ Error disposing audio resources: ${error.message}`, 'error');
      throw error;
    }
  }

  /**
   * Dispose of all application resources
   * Call this when closing the application or starting fresh
   * @returns {Promise<void>}
   */
  static async disposeAll() {
    system('Disposing all application resources...', 'info');
    
    try {
      // Stop memory monitoring
      this.stopMonitoring();
      
      // Dispose audio resources first
      await this.disposeAudio();
      
      // Dispose managers
      await AudioContextManager.dispose();
      SettingsManager.dispose();
      renderState.dispose();
      TrigCache.dispose();
      layerManager.dispose();
      
      // Call custom dispose callbacks
      for (const callback of this.#disposeCallbacks) {
        try {
          await callback();
        } catch (error) {
          system(`Error in dispose callback: ${error.message}`, 'warn');
        }
      }
      
      system('✅ All resources disposed successfully', 'info');
    } catch (error) {
      system(`❌ Error disposing resources: ${error.message}`, 'error');
      throw error;
    }
  }

  /**
   * Get memory usage information
   * @returns {Object} Memory usage stats
   */
  static getMemoryInfo() {
    if (!performance.memory) {
      return {
        available: false,
        message: 'Memory API not available in this browser'
      };
    }

    const memory = performance.memory;
    const usedMB = (memory.usedJSHeapSize / 1024 / 1024).toFixed(2);
    const totalMB = (memory.totalJSHeapSize / 1024 / 1024).toFixed(2);
    const limitMB = (memory.jsHeapSizeLimit / 1024 / 1024).toFixed(2);
    const percentage = ((memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100).toFixed(1);

    return {
      available: true,
      used: `${usedMB} MB`,
      total: `${totalMB} MB`,
      limit: `${limitMB} MB`,
      percentage: `${percentage}%`,
      raw: {
        used: memory.usedJSHeapSize,
        total: memory.totalJSHeapSize,
        limit: memory.jsHeapSizeLimit
      }
    };
  }

  /**
   * Check if memory usage is high
   * @returns {boolean} True if memory usage exceeds threshold
   */
  static isMemoryHigh() {
    if (!performance.memory) return false;
    
    const usage = performance.memory.usedJSHeapSize / performance.memory.jsHeapSizeLimit;
    return usage > this.#memoryWarningThreshold;
  }

  /**
   * Start monitoring memory usage
   * @param {number} intervalMs - Check interval in milliseconds (default: 5000)
   * @param {Function} onWarning - Callback when memory is high
   */
  static startMonitoring(intervalMs = 5000, onWarning = null) {
    if (this.#isMonitoring) {
      system('Memory monitoring already active', 'warn');
      return;
    }

    if (!performance.memory) {
      system('Memory monitoring not available in this browser', 'warn');
      return;
    }

    this.#isMonitoring = true;
    this.#monitorInterval = setInterval(() => {
      if (this.isMemoryHigh()) {
        const info = this.getMemoryInfo();
        system(`⚠️ High memory usage detected: ${info.percentage}`, 'warn');
        
        if (onWarning && typeof onWarning === 'function') {
          onWarning(info);
        }
      }
    }, intervalMs);

    system(`Memory monitoring started (interval: ${intervalMs}ms)`, 'info');
  }

  /**
   * Stop monitoring memory usage
   */
  static stopMonitoring() {
    if (this.#monitorInterval) {
      clearInterval(this.#monitorInterval);
      this.#monitorInterval = null;
      this.#isMonitoring = false;
      system('Memory monitoring stopped', 'info');
    }
  }

  /**
   * Request garbage collection (only works in Chrome with --expose-gc flag)
   * @returns {boolean} True if GC was triggered
   */
  static requestGarbageCollection() {
    if (window.gc) {
      window.gc();
      system('Garbage collection requested', 'debug');
      return true;
    }
    
    system('Garbage collection not available (requires --expose-gc flag)', 'debug');
    return false;
  }

  /**
   * Get detailed resource information from all managers
   * @returns {Object} Resource usage details
   */
  static getResourceInfo() {
    const info = {
      memory: this.getMemoryInfo(),
      audioContext: AudioContextManager.getInfo(),
      renderState: renderState.getStats(),
      layers: layerManager.getStats(),
      trigCache: {
        initialized: TrigCache.getInfo().initialized,
        memory: TrigCache.getInfo().memoryEstimate
      }
    };

    return info;
  }

  /**
   * Print comprehensive resource report to console
   */
  static printReport() {
    const info = this.getResourceInfo();
    
    console.group('📊 Memory & Resource Report');
    
    if (info.memory.available) {
      console.log('Memory Usage:', info.memory.used, '/', info.memory.limit, `(${info.memory.percentage})`);
    } else {
      console.log('Memory Usage:', info.memory.message);
    }
    
    console.log('Audio Context:', info.audioContext);
    console.log('Render State:', info.renderState);
    console.log('Layers:', info.layers);
    console.log('Trig Cache:', info.trigCache);
    
    console.groupEnd();
  }
}

// Convenience exports
export function disposeAudio() {
  return MemoryManager.disposeAudio();
}

export function disposeAll() {
  return MemoryManager.disposeAll();
}

export function getMemoryInfo() {
  return MemoryManager.getMemoryInfo();
}

export function isMemoryHigh() {
  return MemoryManager.isMemoryHigh();
}

export function startMemoryMonitoring(intervalMs, onWarning) {
  return MemoryManager.startMonitoring(intervalMs, onWarning);
}

export function stopMemoryMonitoring() {
  return MemoryManager.stopMonitoring();
}

export function getResourceInfo() {
  return MemoryManager.getResourceInfo();
}

export function printMemoryReport() {
  return MemoryManager.printReport();
}

// Export for browser console debugging
if (typeof window !== 'undefined') {
  window.disposeAudio = disposeAudio;
  window.disposeAll = disposeAll;
  window.getMemoryInfo = getMemoryInfo;
  window.printMemoryReport = printMemoryReport;
}
