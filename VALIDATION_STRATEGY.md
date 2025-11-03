# Validation Strategy Documentation

## Overview

The Spiral Waveform Player uses a tiered validation system that automatically adjusts based on the environment (development vs production) to balance safety with performance.

## Environment Detection

The system automatically detects the environment using multiple methods:

1. **Explicit Flag**: `window.__SPIRAL_PRODUCTION__ = true`
2. **NODE_ENV**: Checks `process.env.NODE_ENV === 'production'` (if available from bundler)
3. **Hostname Detection**: Excludes `localhost`, `127.0.0.1`, and `*.local` domains

## Validation Levels

### Level 0: NONE
- **Use Case**: Maximum performance, minimal safety
- **Behavior**: No validation performed
- **Risk**: High - use only in thoroughly tested production environments

### Level 1: CRITICAL
- **Use Case**: Production with critical safety checks only
- **Behavior**: Only validates operations that could cause crashes or data corruption
- **Examples**: Null checks, type existence, buffer validity

### Level 2: STANDARD (Production Default)
- **Use Case**: Production environment
- **Behavior**: Essential validation for safety without heavy performance impact
- **Examples**: Type checking, range validation, null/undefined checks
- **Performance**: Minimal overhead (~1-2% typical workload)

### Level 3: PARANOID (Development Default)
- **Use Case**: Development and testing
- **Behavior**: Comprehensive validation with detailed error messages
- **Examples**: All type checking, exhaustive range validation, assertion checks, performance monitoring
- **Performance**: Higher overhead (~5-10% workload) but catches issues early

## Feature Flags

### Type Validation
- `typeChecking`: Validates argument types (e.g., number, string, function)
- `rangeChecking`: Validates numeric ranges and bounds
- `nullChecking`: Explicit null/undefined checks

### Performance Monitoring
- `performanceMonitoring`: Tracks execution time of operations
- `performanceWarnings`: Console warnings for slow operations
- `performanceThresholds`: Configurable time limits per operation type

### Development Features
- `stackTraces`: Include full stack traces in errors (dev only)
- `verboseErrors`: Detailed error messages with context (dev only)
- `assertionChecks`: Runtime assertions for invariants (dev only)
- `exhaustiveValidation`: Extra validation passes (dev only)

## Configuration

### Setting Production Mode Explicitly

```javascript
// In your build process or entry point
window.__SPIRAL_PRODUCTION__ = true;
```

### Manual Level Override

```javascript
import { ValidationConfig } from './js/validation-config.js';

// Force paranoid mode for debugging
ValidationConfig.setLevel(ValidationConfig.levels.PARANOID);

// Force production mode
ValidationConfig.setProduction(true);
```

### Checking Current Configuration

```javascript
import { ValidationConfig } from './js/validation-config.js';

console.log('Is Production:', ValidationConfig.isProduction);
console.log('Current Level:', ValidationConfig.currentLevel);
console.log('Features:', ValidationConfig.features);
```

## Performance Metrics

### Recording Performance

Performance metrics are automatically recorded in development mode for all validation operations:

```javascript
import { ValidationConfig } from './js/validation-config.js';

// Get metrics for a specific operation
const metrics = ValidationConfig.performanceMetrics.get('AudioValidation.validateBuffer');
console.log('Average time:', metrics.avgTime);
console.log('Max time:', metrics.maxTime);
console.log('Total calls:', metrics.count);

// Get all metrics
const allMetrics = ValidationConfig.performanceMetrics.getAll();

// Get summary report
const summary = ValidationConfig.performanceMetrics.getSummary();
console.log('Total operations:', summary.totalOperations);
console.log('Total time:', summary.totalTime);
console.log('Slowest operations:', summary.operations.slice(0, 5));
```

### Performance Thresholds

Default thresholds (in milliseconds):
- `waveformDraw`: 16ms (60 FPS target)
- `audioLoad`: 1000ms (1 second)
- `audioDecode`: 2000ms (2 seconds)
- `canvasResize`: 100ms
- `fileValidation`: 50ms

Thresholds trigger warnings when exceeded in development mode.

## Usage Examples

### Using Level-Aware Validation

```javascript
import { ValidationConfig, validateAll } from './js/validation.js';

// Standard validation (runs in production)
validateAll([
  { value: buffer, validator: AudioValidation.validateAudioBuffer, context: 'buffer' }
]);

// Paranoid validation (dev only)
validateAll([
  { value: buffer, validator: AudioValidation.validateAudioBuffer, context: 'buffer' }
], { level: ValidationConfig.levels.PARANOID });

// Critical only (minimal overhead)
validateAll([
  { value: buffer, validator: AudioValidation.validateAudioBuffer, context: 'buffer' }
], { level: ValidationConfig.levels.CRITICAL });
```

### Conditional Validation

```javascript
import { ValidationConfig } from './js/validation-config.js';

function processWaveform(data) {
  // Heavy validation only in development
  if (ValidationConfig.features.exhaustiveValidation) {
    // Expensive checks here
    validateWaveformIntegrity(data);
    validateWaveformStatistics(data);
  }
  
  // Always validate critical safety
  if (!data || data.length === 0) {
    throw new Error('Invalid waveform data');
  }
  
  // Process waveform
  return processData(data);
}
```

### Performance Measurement

```javascript
import { measurePerformance, measurePerformanceAsync } from './js/validation-config.js';

// Synchronous operation
const result = measurePerformance('drawWaveform', () => {
  return drawComplexWaveform(data);
}, { warnThreshold: 16 }); // Warn if > 16ms

// Asynchronous operation
const audioData = await measurePerformanceAsync('loadAudio', async () => {
  return await fetch(url).then(r => r.arrayBuffer());
}, { warnThreshold: 1000, criticalThreshold: 5000 });
```

## Best Practices

### 1. Use Appropriate Levels
- Use `CRITICAL` for hot paths in production
- Use `STANDARD` for normal production code
- Use `PARANOID` in development and testing

### 2. Separate Critical from Nice-to-Have
```javascript
// Critical validation - always run
if (!buffer) throw new Error('Buffer required');

// Detailed validation - development only
if (ValidationConfig.features.exhaustiveValidation) {
  validateBufferIntegrity(buffer);
}
```

### 3. Performance-Aware Validation
```javascript
// Fast path for production
if (!ValidationConfig.isProduction) {
  // Expensive validation logic here
}

// Or use level checking
if (ValidationConfig.shouldValidate(ValidationConfig.levels.PARANOID)) {
  // Expensive validation logic here
}
```

### 4. Monitor Performance
```javascript
// Periodically check metrics in development
if (!ValidationConfig.isProduction) {
  setInterval(() => {
    const summary = ValidationConfig.performanceMetrics.getSummary();
    console.log('Validation overhead:', summary.totalTime, 'ms');
  }, 30000);
}
```

## Production Optimization

### Build-Time Optimization

For maximum performance, use a bundler to strip development code:

```javascript
// webpack.config.js or similar
plugins: [
  new webpack.DefinePlugin({
    'process.env.NODE_ENV': JSON.stringify('production')
  })
]
```

This enables dead code elimination for development-only features.

### Runtime Configuration

```javascript
// In production entry point
import { ValidationConfig } from './js/validation-config.js';

// Explicitly disable all dev features
ValidationConfig.setProduction(true);

// Or set minimal validation level
ValidationConfig.setLevel(ValidationConfig.levels.CRITICAL);
```

## Performance Impact

Typical performance overhead by level:

| Level | Overhead | Use Case |
|-------|----------|----------|
| NONE | 0% | Not recommended |
| CRITICAL | <1% | Optimized production |
| STANDARD | 1-2% | Normal production |
| PARANOID | 5-10% | Development/Testing |

## Debugging

### Enable Verbose Logging

```javascript
import { ValidationConfig } from './js/validation-config.js';

// Temporarily enable dev features in production
ValidationConfig.features.verboseErrors = true;
ValidationConfig.features.stackTraces = true;
ValidationConfig.features.performanceMonitoring = true;
```

### View Performance Report

```javascript
// In browser console
const summary = window.__SPIRAL_VALIDATION_CONFIG__.performanceMetrics.getSummary();
console.table(summary.operations);
```

## Migration Guide

### Updating Existing Code

Old code continues to work, but can be optimized:

```javascript
// Before (always validates)
validateAll([...]);

// After (level-aware)
validateAll([...], { level: ValidationConfig.levels.STANDARD });

// Or skip in production
if (ValidationConfig.shouldValidate()) {
  validateAll([...]);
}
```

### Testing

All validation levels should be tested:

```javascript
import { ValidationConfig } from './js/validation-config.js';

describe('with different validation levels', () => {
  it('validates in paranoid mode', () => {
    ValidationConfig.setLevel(ValidationConfig.levels.PARANOID);
    // Test validation behavior
  });
  
  it('skips in production mode', () => {
    ValidationConfig.setProduction(true);
    // Test that validation is skipped
  });
});
```

## Conclusion

This tiered validation system provides:
- ✅ Safety in development with comprehensive checks
- ✅ Performance in production with minimal overhead
- ✅ Flexibility to adjust validation level per environment
- ✅ Performance monitoring to identify bottlenecks
- ✅ Clear migration path for existing code

The system automatically adapts to the environment, requiring no configuration for standard use cases.
