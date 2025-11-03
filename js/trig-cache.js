/**
 * Trigonometry Cache
 * 
 * Pre-calculated sine and cosine lookup tables for performance optimization.
 * Eliminates repeated Math.sin() and Math.cos() calls during rendering.
 * 
 * @module trig-cache
 */

import { system } from './logger.js';

/**
 * TrigCache - Fast sine/cosine lookups using pre-calculated tables
 */
export class TrigCache {
  // High-resolution lookup tables (0.1 degree precision = 3600 entries)
  static #sineTable = null;
  static #cosineTable = null;
  static #initialized = false;
  static #resolution = 3600; // 0.1 degree precision
  static #degreesPerIndex = 360 / 3600; // 0.1 degrees

  /**
   * Initialize the lookup tables
   * Called automatically on first use
   */
  static initialize() {
    if (this.#initialized) return;

    const startTime = performance.now();
    
    this.#sineTable = new Float32Array(this.#resolution);
    this.#cosineTable = new Float32Array(this.#resolution);

    for (let i = 0; i < this.#resolution; i++) {
      const radians = (i * this.#degreesPerIndex * Math.PI) / 180;
      this.#sineTable[i] = Math.sin(radians);
      this.#cosineTable[i] = Math.cos(radians);
    }

    this.#initialized = true;
    
    const duration = (performance.now() - startTime).toFixed(2);
    system(`TrigCache initialized in ${duration}ms (${this.#resolution} entries)`, 'info');
  }

  /**
   * Get sine of angle in degrees
   * @param {number} degrees - Angle in degrees
   * @returns {number} Sine value
   */
  static sin(degrees) {
    if (!this.#initialized) this.initialize();
    
    // Normalize to 0-360 range
    const normalized = ((degrees % 360) + 360) % 360;
    
    // Convert to table index
    const index = Math.round(normalized / this.#degreesPerIndex) % this.#resolution;
    
    return this.#sineTable[index];
  }

  /**
   * Get cosine of angle in degrees
   * @param {number} degrees - Angle in degrees
   * @returns {number} Cosine value
   */
  static cos(degrees) {
    if (!this.#initialized) this.initialize();
    
    // Normalize to 0-360 range
    const normalized = ((degrees % 360) + 360) % 360;
    
    // Convert to table index
    const index = Math.round(normalized / this.#degreesPerIndex) % this.#resolution;
    
    return this.#cosineTable[index];
  }

  /**
   * Get sine of angle in radians
   * @param {number} radians - Angle in radians
   * @returns {number} Sine value
   */
  static sinRad(radians) {
    const degrees = (radians * 180) / Math.PI;
    return this.sin(degrees);
  }

  /**
   * Get cosine of angle in radians
   * @param {number} radians - Angle in radians
   * @returns {number} Cosine value
   */
  static cosRad(radians) {
    const degrees = (radians * 180) / Math.PI;
    return this.cos(degrees);
  }

  /**
   * Get both sin and cos at once (more efficient for polar conversions)
   * @param {number} degrees - Angle in degrees
   * @returns {{sin: number, cos: number}} Object with sin and cos values
   */
  static sinCos(degrees) {
    if (!this.#initialized) this.initialize();
    
    const normalized = ((degrees % 360) + 360) % 360;
    const index = Math.round(normalized / this.#degreesPerIndex) % this.#resolution;
    
    return {
      sin: this.#sineTable[index],
      cos: this.#cosineTable[index]
    };
  }

  /**
   * Get both sin and cos for radians
   * @param {number} radians - Angle in radians
   * @returns {{sin: number, cos: number}} Object with sin and cos values
   */
  static sinCosRad(radians) {
    const degrees = (radians * 180) / Math.PI;
    return this.sinCos(degrees);
  }

  /**
   * Convert polar to cartesian coordinates (optimized)
   * @param {number} angle - Angle in degrees
   * @param {number} radius - Radius
   * @param {number} centerX - Center X coordinate
   * @param {number} centerY - Center Y coordinate
   * @returns {{x: number, y: number}} Cartesian coordinates
   */
  static polarToCartesian(angle, radius, centerX, centerY) {
    const { sin, cos } = this.sinCos(angle);
    return {
      x: centerX + radius * cos,
      y: centerY + radius * sin
    };
  }

  /**
   * Get memory usage info
   * @returns {Object} Memory information
   */
  static getMemoryInfo() {
    const bytesPerEntry = 4; // Float32Array uses 4 bytes per entry
    const totalEntries = this.#resolution * 2; // sin + cos tables
    const totalBytes = totalEntries * bytesPerEntry;
    const totalKB = (totalBytes / 1024).toFixed(2);

    return {
      initialized: this.#initialized,
      resolution: this.#resolution,
      entriesPerTable: this.#resolution,
      totalEntries,
      bytesPerEntry,
      totalBytes,
      totalKB: totalKB + ' KB',
      degreesPerIndex: this.#degreesPerIndex
    };
  }

  /**
   * Reset and clear the cache (for testing)
   */
  static reset() {
    this.#sineTable = null;
    this.#cosineTable = null;
    this.#initialized = false;
    system('TrigCache reset', 'debug');
  }

  /**
   * Benchmark the cache vs native Math functions
   * @param {number} iterations - Number of iterations to test
   * @returns {Object} Benchmark results
   */
  static benchmark(iterations = 100000) {
    this.initialize();

    // Test cached version
    const cachedStart = performance.now();
    for (let i = 0; i < iterations; i++) {
      const angle = (i * 360) / iterations;
      this.sin(angle);
      this.cos(angle);
    }
    const cachedTime = performance.now() - cachedStart;

    // Test native Math version
    const nativeStart = performance.now();
    for (let i = 0; i < iterations; i++) {
      const angle = (i * 360) / iterations;
      const radians = (angle * Math.PI) / 180;
      Math.sin(radians);
      Math.cos(radians);
    }
    const nativeTime = performance.now() - nativeStart;

    const speedup = (nativeTime / cachedTime).toFixed(2);
    const improvement = (((nativeTime - cachedTime) / nativeTime) * 100).toFixed(1);

    return {
      iterations,
      cachedTime: cachedTime.toFixed(2) + 'ms',
      nativeTime: nativeTime.toFixed(2) + 'ms',
      speedup: speedup + 'x faster',
      improvement: improvement + '% faster'
    };
  }

  /**
   * Get cache information
   * @returns {Object} Cache stats and memory usage
   */
  static getInfo() {
    const memoryBytes = this.#initialized ? (this.#resolution * 4 * 2) : 0; // Float32 = 4 bytes, 2 tables
    const memoryKB = (memoryBytes / 1024).toFixed(2);

    return {
      initialized: this.#initialized,
      resolution: this.#resolution,
      degreesPerIndex: this.#degreesPerIndex,
      memoryEstimate: `${memoryKB} KB`
    };
  }

  /**
   * Dispose of lookup tables and release memory
   * Call this to free ~28KB of memory when trig cache is no longer needed
   */
  static dispose() {
    if (this.#initialized) {
      this.#sineTable = null;
      this.#cosineTable = null;
      this.#initialized = false;
      system('TrigCache disposed and memory released', 'info');
    }
  }
}

// Auto-initialize on module load for immediate availability
TrigCache.initialize();

// Convenience exports
export function sin(degrees) {
  return TrigCache.sin(degrees);
}

export function cos(degrees) {
  return TrigCache.cos(degrees);
}

export function sinRad(radians) {
  return TrigCache.sinRad(radians);
}

export function cosRad(radians) {
  return TrigCache.cosRad(radians);
}

export function sinCos(degrees) {
  return TrigCache.sinCos(degrees);
}

export function polarToCartesian(angle, radius, centerX, centerY) {
  return TrigCache.polarToCartesian(angle, radius, centerX, centerY);
}
