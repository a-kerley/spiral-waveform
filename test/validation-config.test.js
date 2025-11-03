import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ValidationConfig, measurePerformance, measurePerformanceAsync } from '../js/validation-config.js';

describe('ValidationConfig', () => {
  beforeEach(() => {
    // Reset to defaults
    ValidationConfig.setProduction(false);
    ValidationConfig._overrideLevel = undefined;
    ValidationConfig.performanceMetrics.clear();
  });

  describe('Environment Detection', () => {
    it('should detect development environment by default', () => {
      expect(ValidationConfig.isProduction).toBe(false);
    });

    it('should allow manual production mode setting', () => {
      ValidationConfig.setProduction(true);
      expect(ValidationConfig.isProduction).toBe(true);
    });

    it('should update feature flags when switching to production', () => {
      ValidationConfig.setProduction(false);
      expect(ValidationConfig.features.performanceMonitoring).toBe(true);
      expect(ValidationConfig.features.stackTraces).toBe(true);
      
      ValidationConfig.setProduction(true);
      expect(ValidationConfig.features.performanceMonitoring).toBe(false);
      expect(ValidationConfig.features.stackTraces).toBe(false);
    });
  });

  describe('Validation Levels', () => {
    it('should have correct validation levels', () => {
      expect(ValidationConfig.levels.NONE).toBe(0);
      expect(ValidationConfig.levels.CRITICAL).toBe(1);
      expect(ValidationConfig.levels.STANDARD).toBe(2);
      expect(ValidationConfig.levels.PARANOID).toBe(3);
    });

    it('should use PARANOID level in development', () => {
      ValidationConfig.setProduction(false);
      expect(ValidationConfig.currentLevel).toBe(ValidationConfig.levels.PARANOID);
    });

    it('should use STANDARD level in production', () => {
      ValidationConfig.setProduction(true);
      expect(ValidationConfig.currentLevel).toBe(ValidationConfig.levels.STANDARD);
    });

    it('should allow manual level override', () => {
      ValidationConfig.setLevel(ValidationConfig.levels.CRITICAL);
      expect(ValidationConfig._overrideLevel).toBe(ValidationConfig.levels.CRITICAL);
    });

    it('should throw error for invalid level', () => {
      expect(() => ValidationConfig.setLevel(999)).toThrow('Invalid validation level');
    });
  });

  describe('shouldValidate', () => {
    it('should validate when current level meets required level', () => {
      ValidationConfig.setLevel(ValidationConfig.levels.PARANOID);
      expect(ValidationConfig.shouldValidate(ValidationConfig.levels.STANDARD)).toBe(true);
      expect(ValidationConfig.shouldValidate(ValidationConfig.levels.CRITICAL)).toBe(true);
    });

    it('should not validate when current level is below required level', () => {
      ValidationConfig.setLevel(ValidationConfig.levels.CRITICAL);
      expect(ValidationConfig.shouldValidate(ValidationConfig.levels.STANDARD)).toBe(false);
      expect(ValidationConfig.shouldValidate(ValidationConfig.levels.PARANOID)).toBe(false);
    });

    it('should validate at exact level match', () => {
      ValidationConfig.setLevel(ValidationConfig.levels.STANDARD);
      expect(ValidationConfig.shouldValidate(ValidationConfig.levels.STANDARD)).toBe(true);
    });

    it('should not validate at NONE level', () => {
      ValidationConfig.setLevel(ValidationConfig.levels.NONE);
      expect(ValidationConfig.shouldValidate(ValidationConfig.levels.CRITICAL)).toBe(false);
      expect(ValidationConfig.shouldValidate(ValidationConfig.levels.STANDARD)).toBe(false);
    });
  });

  describe('Performance Metrics', () => {
    it('should record performance metrics', () => {
      ValidationConfig.features.performanceMonitoring = true;
      
      ValidationConfig.performanceMetrics.record('testOp', 10);
      ValidationConfig.performanceMetrics.record('testOp', 20);
      ValidationConfig.performanceMetrics.record('testOp', 15);
      
      const metrics = ValidationConfig.performanceMetrics.get('testOp');
      expect(metrics.count).toBe(3);
      expect(metrics.totalTime).toBe(45);
      expect(metrics.minTime).toBe(10);
      expect(metrics.maxTime).toBe(20);
      expect(metrics.avgTime).toBe(15);
    });

    it('should track multiple operations', () => {
      ValidationConfig.features.performanceMonitoring = true;
      
      ValidationConfig.performanceMetrics.record('op1', 10);
      ValidationConfig.performanceMetrics.record('op2', 20);
      
      const all = ValidationConfig.performanceMetrics.getAll();
      expect(all.length).toBe(2);
      expect(all[0].operation).toBe('op1');
      expect(all[1].operation).toBe('op2');
    });

    it('should clear metrics', () => {
      ValidationConfig.features.performanceMonitoring = true;
      
      ValidationConfig.performanceMetrics.record('testOp', 10);
      expect(ValidationConfig.performanceMetrics.get('testOp')).toBeDefined();
      
      ValidationConfig.performanceMetrics.clear();
      expect(ValidationConfig.performanceMetrics.get('testOp')).toBeUndefined();
    });

    it('should generate summary', () => {
      ValidationConfig.features.performanceMonitoring = true;
      
      ValidationConfig.performanceMetrics.record('op1', 100);
      ValidationConfig.performanceMetrics.record('op1', 50);
      ValidationConfig.performanceMetrics.record('op2', 200);
      
      const summary = ValidationConfig.performanceMetrics.getSummary();
      expect(summary.totalOperations).toBe(3);
      expect(summary.totalTime).toBe(350);
      expect(summary.operations.length).toBe(2);
      expect(summary.operations[0].operation).toBe('op2'); // Sorted by total time
    });

    it('should not record metrics when disabled', () => {
      ValidationConfig.features.performanceMonitoring = false;
      
      ValidationConfig.performanceMetrics.record('testOp', 10);
      expect(ValidationConfig.performanceMetrics.get('testOp')).toBeUndefined();
    });
  });

  describe('Feature Flags', () => {
    it('should have all required feature flags', () => {
      expect(ValidationConfig.features).toHaveProperty('typeChecking');
      expect(ValidationConfig.features).toHaveProperty('rangeChecking');
      expect(ValidationConfig.features).toHaveProperty('nullChecking');
      expect(ValidationConfig.features).toHaveProperty('performanceMonitoring');
      expect(ValidationConfig.features).toHaveProperty('performanceWarnings');
      expect(ValidationConfig.features).toHaveProperty('stackTraces');
      expect(ValidationConfig.features).toHaveProperty('verboseErrors');
      expect(ValidationConfig.features).toHaveProperty('assertionChecks');
      expect(ValidationConfig.features).toHaveProperty('exhaustiveValidation');
    });

    it('should enable dev features in development', () => {
      ValidationConfig.setProduction(false);
      expect(ValidationConfig.features.stackTraces).toBe(true);
      expect(ValidationConfig.features.verboseErrors).toBe(true);
      expect(ValidationConfig.features.performanceMonitoring).toBe(true);
    });

    it('should disable dev features in production', () => {
      ValidationConfig.setProduction(true);
      expect(ValidationConfig.features.stackTraces).toBe(false);
      expect(ValidationConfig.features.verboseErrors).toBe(false);
      expect(ValidationConfig.features.performanceMonitoring).toBe(false);
    });

    it('should have performance thresholds', () => {
      expect(ValidationConfig.features.performanceThresholds).toHaveProperty('waveformDraw');
      expect(ValidationConfig.features.performanceThresholds).toHaveProperty('audioLoad');
      expect(ValidationConfig.features.performanceThresholds).toHaveProperty('audioDecode');
      expect(ValidationConfig.features.performanceThresholds).toHaveProperty('canvasResize');
      expect(ValidationConfig.features.performanceThresholds).toHaveProperty('fileValidation');
    });
  });
});

describe('measurePerformance', () => {
  beforeEach(() => {
    ValidationConfig.setProduction(false);
    ValidationConfig.performanceMetrics.clear();
  });

  it('should measure synchronous function performance', () => {
    const result = measurePerformance('testSync', () => {
      return 42;
    });
    
    expect(result).toBe(42);
    const metrics = ValidationConfig.performanceMetrics.get('testSync');
    expect(metrics).toBeDefined();
    expect(metrics.count).toBe(1);
  });

  it('should record multiple calls', () => {
    measurePerformance('testMulti', () => 1);
    measurePerformance('testMulti', () => 2);
    measurePerformance('testMulti', () => 3);
    
    const metrics = ValidationConfig.performanceMetrics.get('testMulti');
    expect(metrics.count).toBe(3);
  });

  it('should handle function errors', () => {
    expect(() => {
      measurePerformance('testError', () => {
        throw new Error('Test error');
      });
    }).toThrow('Test error');
    
    // Metrics should still be recorded
    const metrics = ValidationConfig.performanceMetrics.get('testError');
    expect(metrics).toBeDefined();
  });

  it('should skip measurement in production', () => {
    ValidationConfig.setProduction(true);
    
    const result = measurePerformance('testProd', () => {
      return 123;
    });
    
    expect(result).toBe(123);
    expect(ValidationConfig.performanceMetrics.get('testProd')).toBeUndefined();
  });

  it('should warn on threshold exceeded', () => {
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    
    measurePerformance('slowOp', () => {
      // Simulate slow operation
      const start = Date.now();
      while (Date.now() - start < 100) {
        // Busy wait
      }
    }, { warnThreshold: 50 });
    
    expect(consoleWarnSpy).toHaveBeenCalled();
    expect(consoleWarnSpy.mock.calls[0][0]).toContain('Performance WARNING');
    expect(consoleWarnSpy.mock.calls[0][0]).toContain('slowOp');
    
    consoleWarnSpy.mockRestore();
  });
});

describe('measurePerformanceAsync', () => {
  beforeEach(() => {
    ValidationConfig.setProduction(false);
    ValidationConfig.performanceMetrics.clear();
  });

  it('should measure async function performance', async () => {
    const result = await measurePerformanceAsync('testAsync', async () => {
      return await Promise.resolve(42);
    });
    
    expect(result).toBe(42);
    const metrics = ValidationConfig.performanceMetrics.get('testAsync');
    expect(metrics).toBeDefined();
    expect(metrics.count).toBe(1);
  });

  it('should handle async errors', async () => {
    await expect(async () => {
      await measurePerformanceAsync('testAsyncError', async () => {
        throw new Error('Async error');
      });
    }).rejects.toThrow('Async error');
    
    // Metrics should still be recorded
    const metrics = ValidationConfig.performanceMetrics.get('testAsyncError');
    expect(metrics).toBeDefined();
  });

  it('should skip measurement in production', async () => {
    ValidationConfig.setProduction(true);
    
    const result = await measurePerformanceAsync('testAsyncProd', async () => {
      return await Promise.resolve(456);
    });
    
    expect(result).toBe(456);
    expect(ValidationConfig.performanceMetrics.get('testAsyncProd')).toBeUndefined();
  });

  it('should record timing for delayed operations', async () => {
    await measurePerformanceAsync('delayedOp', async () => {
      await new Promise(resolve => setTimeout(resolve, 50));
      return 'done';
    });
    
    const metrics = ValidationConfig.performanceMetrics.get('delayedOp');
    expect(metrics.maxTime).toBeGreaterThan(40); // Should be at least 50ms
  });
});
