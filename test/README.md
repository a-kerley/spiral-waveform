# Test Suite

This directory contains the complete test suite for the Spiral Waveform Player.

## Setup

Install dependencies:
```bash
npm install
```

## Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with UI
npm run test:ui

# Run tests with coverage
npm run test:coverage

# Run tests in CI mode (no watch)
npm run test:ci
```

## Test Structure

```
test/
├── setup.js              # Global test setup and mocks
├── utils.test.js         # Tests for utility functions
├── validation.test.js    # Tests for validation system
├── canvas-math.test.js   # Tests for coordinate transformations
├── waveform-data.test.js # Tests for waveform processing
├── audio-state.test.js   # Tests for audio state management
├── render-state.test.js  # Tests for render state management
└── integration/          # Integration tests
    └── audio-playback.test.js
```

## Writing Tests

### Unit Tests

Tests for pure functions with no side effects:

```javascript
import { describe, it, expect } from 'vitest';
import { clamp } from '../js/utils.js';

describe('clamp', () => {
  it('should clamp value within range', () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-5, 0, 10)).toBe(0);
    expect(clamp(15, 0, 10)).toBe(10);
  });
});
```

### Integration Tests

Tests for complex interactions between modules:

```javascript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { initializeAudio, playAudio } from '../js/audio-playback.js';

describe('Audio Playback Integration', () => {
  beforeEach(() => {
    // Setup
  });
  
  it('should initialize and play audio', async () => {
    await initializeAudio();
    // ... test logic
  });
});
```

## Mocks

The following APIs are mocked in `setup.js`:
- **Web Audio API**: AudioContext, AudioBuffer, AudioNode
- **Canvas API**: 2D rendering context, OffscreenCanvas
- **Performance API**: performance.now(), mark(), measure()
- **localStorage**: getItem(), setItem(), etc.
- **requestAnimationFrame**: Mocked with setTimeout

## Coverage Goals

- **Pure Functions**: 80%+ coverage
- **State Management**: 75%+ coverage
- **Integration Paths**: 70%+ coverage
- **Overall**: 70%+ coverage

## Debugging Tests

Enable debug logging:
```bash
VITEST_DEBUG=true npm test
```

Run a specific test file:
```bash
npm test utils.test.js
```

Run tests matching a pattern:
```bash
npm test -- -t "clamp"
```

## CI/CD

Tests automatically run on:
- Pull requests
- Commits to main branch
- Before deployment

Coverage reports are generated and uploaded to the coverage service.

## Best Practices

1. **Arrange-Act-Assert**: Structure tests clearly
2. **One assertion per test**: Keep tests focused
3. **Descriptive names**: Use clear, descriptive test names
4. **Isolate tests**: No test should depend on another
5. **Mock external dependencies**: Control test environment
6. **Test edge cases**: Include boundary conditions
7. **Keep tests fast**: Aim for < 100ms per test
