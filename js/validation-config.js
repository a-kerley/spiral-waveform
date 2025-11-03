/**
 * Validation Configuration
 * Controls validation behavior for development vs production environments
 */

// ✅ Environment detection
const isProduction = () => {
  // Check for explicit production flag
  if (typeof window !== 'undefined' && window.__SPIRAL_PRODUCTION__) {
    return true;
  }
  
  // Check for NODE_ENV (if bundler sets it)
  if (typeof process !== 'undefined' && process.env && process.env.NODE_ENV === 'production') {
    return true;
  }
  
  // Check hostname patterns for production
  if (typeof window !== 'undefined' && window.location) {
    const hostname = window.location.hostname;
    return !['localhost', '127.0.0.1', ''].includes(hostname) && !hostname.endsWith('.local');
  }
  
  return false;
};

// ✅ Validation configuration
export const ValidationConfig = {
  // Current environment
  isProduction: isProduction(),
  
  // Validation levels
  levels: {
    NONE: 0,        // No validation (fastest)
    CRITICAL: 1,    // Only critical safety checks
    STANDARD: 2,    // Standard validation (production default)
    PARANOID: 3     // All validation (development default)
  },
  
  // Current validation level
  get currentLevel() {
    return this.isProduction ? this.levels.STANDARD : this.levels.PARANOID;
  },
  
  // Feature flags
  features: {
    // Type validation
    typeChecking: true,
    rangeChecking: true,
    nullChecking: true,
    
    // Performance validation
    performanceMonitoring: !isProduction(),
    performanceWarnings: !isProduction(),
    performanceThresholds: {
      waveformDraw: 16,      // 16ms (60 FPS)
      audioLoad: 1000,        // 1 second
      audioDecode: 2000,      // 2 seconds
      canvasResize: 100,      // 100ms
      fileValidation: 50      // 50ms
    },
    
    // Development-only validation
    stackTraces: !isProduction(),
    verboseErrors: !isProduction(),
    assertionChecks: !isProduction(),
    exhaustiveValidation: !isProduction()
  },
  
  // Override methods for testing/debugging
  setProduction(enabled) {
    this.isProduction = enabled;
    this.features.performanceMonitoring = !enabled;
    this.features.performanceWarnings = !enabled;
    this.features.stackTraces = !enabled;
    this.features.verboseErrors = !enabled;
    this.features.assertionChecks = !enabled;
    this.features.exhaustiveValidation = !enabled;
  },
  
  setLevel(level) {
    if (!Object.values(this.levels).includes(level)) {
      throw new Error(`Invalid validation level: ${level}`);
    }
    this._overrideLevel = level;
  },
  
  // Check if validation should run based on level
  shouldValidate(requiredLevel = this.levels.STANDARD) {
    const currentLevel = this._overrideLevel ?? this.currentLevel;
    return currentLevel >= requiredLevel;
  },
  
  // Performance tracking
  performanceMetrics: {
    data: new Map(),
    
    record(operation, duration) {
      // Check if performance monitoring is enabled dynamically
      if (!ValidationConfig.features.performanceMonitoring) return;
      
      if (!this.data.has(operation)) {
        this.data.set(operation, {
          count: 0,
          totalTime: 0,
          minTime: Infinity,
          maxTime: -Infinity,
          avgTime: 0
        });
      }
      
      const metric = this.data.get(operation);
      metric.count++;
      metric.totalTime += duration;
      metric.minTime = Math.min(metric.minTime, duration);
      metric.maxTime = Math.max(metric.maxTime, duration);
      metric.avgTime = metric.totalTime / metric.count;
    },
    
    get(operation) {
      return this.data.get(operation);
    },
    
    getAll() {
      return Array.from(this.data.entries()).map(([operation, metrics]) => ({
        operation,
        ...metrics
      }));
    },
    
    clear() {
      this.data.clear();
    },
    
    getSummary() {
      const operations = this.getAll();
      return {
        totalOperations: operations.reduce((sum, op) => sum + op.count, 0),
        totalTime: operations.reduce((sum, op) => sum + op.totalTime, 0),
        operations: operations.sort((a, b) => b.totalTime - a.totalTime)
      };
    }
  }
};

// ✅ Performance measurement utility
export function measurePerformance(operation, fn, options = {}) {
  const { warnThreshold, criticalThreshold } = options;
  
  if (!ValidationConfig.features.performanceMonitoring) {
    // Production mode: just execute without measurement
    return fn();
  }
  
  const startTime = performance.now();
  let result;
  let error;
  
  try {
    result = fn();
  } catch (e) {
    error = e;
  }
  
  const duration = performance.now() - startTime;
  
  // Record metrics
  ValidationConfig.performanceMetrics.record(operation, duration);
  
  // Check thresholds
  if (ValidationConfig.features.performanceWarnings) {
    const threshold = warnThreshold ?? ValidationConfig.features.performanceThresholds[operation];
    
    if (threshold && duration > threshold) {
      const level = criticalThreshold && duration > criticalThreshold ? 'CRITICAL' : 'WARNING';
      console.warn(
        `⚠️ Performance ${level}: ${operation} took ${duration.toFixed(2)}ms (threshold: ${threshold}ms)`
      );
    }
  }
  
  if (error) throw error;
  return result;
}

// ✅ Async performance measurement
export async function measurePerformanceAsync(operation, fn, options = {}) {
  const { warnThreshold, criticalThreshold } = options;
  
  if (!ValidationConfig.features.performanceMonitoring) {
    // Production mode: just execute without measurement
    return await fn();
  }
  
  const startTime = performance.now();
  let result;
  let error;
  
  try {
    result = await fn();
  } catch (e) {
    error = e;
  }
  
  const duration = performance.now() - startTime;
  
  // Record metrics
  ValidationConfig.performanceMetrics.record(operation, duration);
  
  // Check thresholds
  if (ValidationConfig.features.performanceWarnings) {
    const threshold = warnThreshold ?? ValidationConfig.features.performanceThresholds[operation];
    
    if (threshold && duration > threshold) {
      const level = criticalThreshold && duration > criticalThreshold ? 'CRITICAL' : 'WARNING';
      console.warn(
        `⚠️ Performance ${level}: ${operation} took ${duration.toFixed(2)}ms (threshold: ${threshold}ms)`
      );
    }
  }
  
  if (error) throw error;
  return result;
}

// ✅ Export for global access
if (typeof window !== 'undefined') {
  window.__SPIRAL_VALIDATION_CONFIG__ = ValidationConfig;
}

export default ValidationConfig;
