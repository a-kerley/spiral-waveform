/**
 * Test Setup - Global test configuration and mocks
 * 
 * This file runs before all tests and sets up:
 * - Global test utilities
 * - DOM mocks
 * - Web Audio API mocks
 * - Canvas API mocks
 * - Performance API mocks
 */

import { vi } from 'vitest';

// Mock Web Audio API
const createMockAudioContext = () => ({
  createGain: vi.fn(() => ({
    connect: vi.fn(),
    disconnect: vi.fn(),
    gain: {
      value: 1,
      setValueAtTime: vi.fn(),
      linearRampToValueAtTime: vi.fn(),
      exponentialRampToValueAtTime: vi.fn()
    }
  })),
  createBufferSource: vi.fn(() => ({
    buffer: null,
    connect: vi.fn(),
    disconnect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
    onended: null,
    loop: false,
    playbackRate: { value: 1 }
  })),
  createBuffer: vi.fn((channels, length, sampleRate) => ({
    numberOfChannels: channels,
    length: length,
    sampleRate: sampleRate,
    duration: length / sampleRate,
    getChannelData: vi.fn(() => new Float32Array(length))
  })),
  decodeAudioData: vi.fn((arrayBuffer) => 
    Promise.resolve({
      numberOfChannels: 2,
      length: 44100,
      sampleRate: 44100,
      duration: 1.0,
      getChannelData: vi.fn(() => new Float32Array(44100))
    })
  ),
  state: 'running',
  sampleRate: 44100,
  currentTime: 0,
  destination: {},
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  resume: vi.fn(() => Promise.resolve()),
  suspend: vi.fn(() => Promise.resolve()),
  close: vi.fn(() => Promise.resolve())
});

global.AudioContext = vi.fn(createMockAudioContext);
global.webkitAudioContext = vi.fn(createMockAudioContext);

// Mock OffscreenCanvas (for layer-manager tests)
global.OffscreenCanvas = class OffscreenCanvas {
  constructor(width, height) {
    this.width = width;
    this.height = height;
  }
  
  getContext(type, options) {
    return {
      canvas: this,
      clearRect: vi.fn(),
      fillRect: vi.fn(),
      strokeRect: vi.fn(),
      fillText: vi.fn(),
      strokeText: vi.fn(),
      measureText: vi.fn(() => ({ width: 100 })),
      save: vi.fn(),
      restore: vi.fn(),
      scale: vi.fn(),
      translate: vi.fn(),
      rotate: vi.fn(),
      transform: vi.fn(),
      setTransform: vi.fn(),
      beginPath: vi.fn(),
      closePath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      arc: vi.fn(),
      arcTo: vi.fn(),
      quadraticCurveTo: vi.fn(),
      bezierCurveTo: vi.fn(),
      rect: vi.fn(),
      fill: vi.fn(),
      stroke: vi.fn(),
      clip: vi.fn(),
      isPointInPath: vi.fn(() => false),
      drawImage: vi.fn(),
      createImageData: vi.fn(),
      getImageData: vi.fn(),
      putImageData: vi.fn(),
      createLinearGradient: vi.fn(() => ({
        addColorStop: vi.fn()
      })),
      createRadialGradient: vi.fn(() => ({
        addColorStop: vi.fn()
      })),
      imageSmoothingEnabled: true,
      imageSmoothingQuality: 'high'
    };
  }
};

// Mock Canvas API
HTMLCanvasElement.prototype.getContext = vi.fn(function(type, options) {
  return {
    canvas: this,
    clearRect: vi.fn(),
    fillRect: vi.fn(),
    strokeRect: vi.fn(),
    fillText: vi.fn(),
    strokeText: vi.fn(),
    measureText: vi.fn(() => ({ width: 100 })),
    save: vi.fn(),
    restore: vi.fn(),
    scale: vi.fn(),
    translate: vi.fn(),
    rotate: vi.fn(),
    transform: vi.fn(),
    setTransform: vi.fn(),
    beginPath: vi.fn(),
    closePath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    arc: vi.fn(),
    arcTo: vi.fn(),
    quadraticCurveTo: vi.fn(),
    bezierCurveTo: vi.fn(),
    rect: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    clip: vi.fn(),
    isPointInPath: vi.fn(() => false),
    drawImage: vi.fn(),
    createImageData: vi.fn(),
    getImageData: vi.fn(),
    putImageData: vi.fn(),
    createLinearGradient: vi.fn(() => ({
      addColorStop: vi.fn()
    })),
    createRadialGradient: vi.fn(() => ({
      addColorStop: vi.fn()
    })),
    globalAlpha: 1,
    globalCompositeOperation: 'source-over',
    fillStyle: '#000',
    strokeStyle: '#000',
    lineWidth: 1,
    lineCap: 'butt',
    lineJoin: 'miter',
    miterLimit: 10,
    shadowBlur: 0,
    shadowColor: 'rgba(0,0,0,0)',
    shadowOffsetX: 0,
    shadowOffsetY: 0,
    font: '10px sans-serif',
    textAlign: 'start',
    textBaseline: 'alphabetic',
    imageSmoothingEnabled: true
  };
});

// Mock requestAnimationFrame
global.requestAnimationFrame = vi.fn((callback) => {
  return setTimeout(callback, 16); // ~60fps
});

global.cancelAnimationFrame = vi.fn((id) => {
  clearTimeout(id);
});

// Mock performance API
global.performance = global.performance || {};
global.performance.now = vi.fn(() => Date.now());
global.performance.mark = vi.fn();
global.performance.measure = vi.fn();
global.performance.clearMarks = vi.fn();
global.performance.clearMeasures = vi.fn();
global.performance.getEntriesByName = vi.fn(() => []);
global.performance.memory = {
  usedJSHeapSize: 10000000,
  totalJSHeapSize: 50000000,
  jsHeapSizeLimit: 2000000000
};

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
  length: 0,
  key: vi.fn()
};

global.localStorage = localStorageMock;

// Mock console methods for cleaner test output
const originalConsole = { ...console };
global.console = {
  ...console,
  log: vi.fn((...args) => {
    if (process.env.VITEST_DEBUG) {
      originalConsole.log(...args);
    }
  }),
  info: vi.fn((...args) => {
    if (process.env.VITEST_DEBUG) {
      originalConsole.info(...args);
    }
  }),
  warn: vi.fn((...args) => {
    if (process.env.VITEST_DEBUG) {
      originalConsole.warn(...args);
    }
  }),
  error: originalConsole.error, // Always show errors
  debug: vi.fn((...args) => {
    if (process.env.VITEST_DEBUG) {
      originalConsole.debug(...args);
    }
  })
};

// Helper to restore console for specific tests
export function restoreConsole() {
  global.console = originalConsole;
}

// Helper to create mock audio buffer
export function createMockAudioBuffer(duration = 1.0, sampleRate = 44100, channels = 2) {
  const length = Math.floor(duration * sampleRate);
  return {
    numberOfChannels: channels,
    length,
    sampleRate,
    duration,
    getChannelData: vi.fn((channel) => {
      const data = new Float32Array(length);
      // Generate simple sine wave for testing
      for (let i = 0; i < length; i++) {
        data[i] = Math.sin((i / sampleRate) * 440 * Math.PI * 2) * 0.5;
      }
      return data;
    })
  };
}

// Helper to create mock file
export function createMockFile(name, type = 'audio/mpeg') {
  const content = new ArrayBuffer(1024); // Small mock file
  const blob = new Blob([content], { type });
  const file = new File([blob], name, { type });
  
  // Mock arrayBuffer method
  file.arrayBuffer = vi.fn().mockResolvedValue(content);
  
  return file;
}

// Helper to create mock URL audio element
export function createMockURLAudioElement() {
  return {
    pause: vi.fn(),
    play: vi.fn().mockResolvedValue(undefined),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    src: '',
    load: vi.fn(),
    currentTime: 0,
    duration: 10,
    paused: true,
    ended: false,
    readyState: 4,
    volume: 1
  };
}

// Helper to create mock canvas
export function createMockCanvas(width = 800, height = 800) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  canvas.offsetWidth = width;
  canvas.offsetHeight = height;
  return canvas;
}

// Helper to wait for async operations
export function wait(ms = 0) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Helper to flush promises
export function flushPromises() {
  return new Promise(resolve => setImmediate(resolve));
}

console.log('✅ Test environment setup complete');
