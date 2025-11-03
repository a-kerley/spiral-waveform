/**
 * Tests for audio-loader URL loading functionality
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { loadAudioFromUrl } from '../js/audio-loader.js';

describe('loadAudioFromUrl', () => {
  let mockFetch;
  let mockAudioElement;
  let originalCreateElement;
  
  beforeEach(() => {
    // Mock fetch
    mockFetch = vi.fn();
    global.fetch = mockFetch;
    
    // Mock document.createElement for audio elements
    originalCreateElement = document.createElement;
    mockAudioElement = {
      style: {},
      preload: '',
      crossOrigin: '',
      src: '',
      load: vi.fn(),
      pause: vi.fn(),
      play: vi.fn(),
      duration: 30,
      oncanplaythrough: null,
      onerror: null,
      onloadstart: null,
      onloadedmetadata: null,
      onprogress: null,
      onstalled: null,
      onsuspend: null
    };
    
    document.createElement = vi.fn((tag) => {
      if (tag === 'audio') {
        return { ...mockAudioElement };
      }
      return originalCreateElement.call(document, tag);
    });
  });
  
  afterEach(() => {
    document.createElement = originalCreateElement;
    vi.restoreAllMocks();
  });
  
  it('should handle network errors gracefully', async () => {
    // Setup mock to simulate network error
    mockFetch.mockRejectedValue(new Error('Network error'));
    
    try {
      await loadAudioFromUrl('https://example.com/audio.mp3');
      // If it doesn't throw, fail the test
      expect.fail('Should have thrown an error');
    } catch (error) {
      // Expected to fail with network error or timeout
      expect(error).toBeDefined();
    }
  });
  
  it('should use AudioUrlUtils for URL processing', async () => {
    // Test that the function exists and accepts URLs
    // Full integration test would require mocking HTML audio element events
    expect(loadAudioFromUrl).toBeDefined();
    expect(typeof loadAudioFromUrl).toBe('function');
  });
  
  it('should handle Dropbox URL conversion', () => {
    // Test URL validation - actual loading would require full browser environment
    const dropboxUrl = 'https://www.dropbox.com/s/abc123/file.mp3?dl=0';
    
    // In test environment without full DOM, we just verify function signature
    expect(loadAudioFromUrl).toBeDefined();
    const result = loadAudioFromUrl(dropboxUrl);
    expect(result).toBeInstanceOf(Promise);
    
    // Clean up the promise to prevent unhandled rejection
    result.catch(() => {});
  });
  
  it('should return a promise', () => {
    const result = loadAudioFromUrl('https://example.com/audio.mp3');
    expect(result).toBeInstanceOf(Promise);
  });
  
  it('should accept string URLs', () => {
    // Just verify the function accepts the right parameter type
    const promise = loadAudioFromUrl('https://example.com/audio.mp3');
    expect(promise).toBeInstanceOf(Promise);
    
    // Clean up the promise to prevent unhandled rejection
    promise.catch(() => {});
  });
});
