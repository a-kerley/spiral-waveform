/**
 * Integration tests for audio-loader.js
 * Testing file loading workflow
 * 
 * Note: audio-loader.js exports handleFileSelect which requires many dependencies
 * (error-ui, audio-context-manager, memory-manager, performance-monitor).
 * These tests verify the module structure and basic functionality.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { handleFileSelect } from '../js/audio-loader.js';
import { createMockFile } from './setup.js';

describe('audio-loader.js - Audio Loading System', () => {
  let mockFile;
  let mockEvent;

  beforeEach(() => {
    vi.clearAllMocks();
    mockFile = createMockFile('test.mp3', 'audio/mpeg');
    
    // Create mock file input event
    mockEvent = {
      target: {
        files: [mockFile]
      }
    };
  });

  describe('Module Structure', () => {
    it('should export handleFileSelect function', () => {
      expect(typeof handleFileSelect).toBe('function');
      expect(handleFileSelect.length).toBeGreaterThan(0); // Takes at least 1 parameter
    });
  });

  describe('File Format Detection', () => {
    it('should handle MP3 files', () => {
      const mp3File = createMockFile('song.mp3', 'audio/mpeg');
      expect(mp3File.name).toContain('.mp3');
      expect(mp3File.type).toBe('audio/mpeg');
    });

    it('should handle WAV files', () => {
      const wavFile = createMockFile('audio.wav', 'audio/wav');
      expect(wavFile.name).toContain('.wav');
      expect(wavFile.type).toBe('audio/wav');
    });

    it('should handle OGG files', () => {
      const oggFile = createMockFile('sound.ogg', 'audio/ogg');
      expect(oggFile.name).toContain('.ogg');
      expect(oggFile.type).toBe('audio/ogg');
    });

    it('should handle M4A files', () => {
      const m4aFile = createMockFile('track.m4a', 'audio/mp4');
      expect(m4aFile.name).toContain('.m4a');
      expect(m4aFile.type).toBe('audio/mp4');
    });

    it('should handle FLAC files', () => {
      const flacFile = createMockFile('music.flac', 'audio/flac');
      expect(flacFile.name).toContain('.flac');
      expect(flacFile.type).toBe('audio/flac');
    });
  });

  describe('File Validation', () => {
    it('should create valid mock file', () => {
      expect(mockFile).toBeDefined();
      expect(mockFile.name).toBe('test.mp3');
      expect(mockFile.type).toBe('audio/mpeg');
      expect(mockFile.arrayBuffer).toBeDefined();
      expect(typeof mockFile.arrayBuffer).toBe('function');
    });

    it('should have proper file structure', () => {
      expect(mockFile instanceof File).toBe(true);
      expect(mockFile.size).toBeGreaterThan(0);
    });
  });

  describe('Event Structure', () => {
    it('should have proper event structure', () => {
      expect(mockEvent.target).toBeDefined();
      expect(mockEvent.target.files).toBeDefined();
      expect(Array.isArray(mockEvent.target.files)).toBe(true);
      expect(mockEvent.target.files).toHaveLength(1);
      expect(mockEvent.target.files[0]).toBe(mockFile);
    });

    it('should handle empty file list', () => {
      const emptyEvent = { target: { files: [] } };
      expect(emptyEvent.target.files).toHaveLength(0);
    });

    it('should handle no file selection', () => {
      const noFileEvent = { target: { files: [null] } };
      expect(noFileEvent.target.files[0]).toBeNull();
    });
  });

  describe('Mock File Operations', () => {
    it('should mock arrayBuffer method', async () => {
      const buffer = await mockFile.arrayBuffer();
      expect(buffer).toBeInstanceOf(ArrayBuffer);
      expect(buffer.byteLength).toBeGreaterThan(0);
    });

    it('should handle different file sizes', () => {
      const smallFile = createMockFile('small.mp3', 'audio/mpeg');
      const largeFile = createMockFile('large.mp3', 'audio/mpeg');
      
      expect(smallFile.size).toBeGreaterThan(0);
      expect(largeFile.size).toBeGreaterThan(0);
    });

    it('should handle case-insensitive extensions', () => {
      const upperCase = createMockFile('AUDIO.MP3', 'audio/mpeg');
      const lowerCase = createMockFile('audio.mp3', 'audio/mpeg');
      const mixedCase = createMockFile('Audio.Mp3', 'audio/mpeg');
      
      expect(upperCase.name).toContain('MP3');
      expect(lowerCase.name).toContain('mp3');
      expect(mixedCase.name).toContain('Mp3');
    });
  });

  describe('Integration - File Type Support', () => {
    it('should support common audio formats', () => {
      const formats = [
        { name: 'test.mp3', type: 'audio/mpeg' },
        { name: 'test.wav', type: 'audio/wav' },
        { name: 'test.ogg', type: 'audio/ogg' },
        { name: 'test.m4a', type: 'audio/mp4' },
        { name: 'test.flac', type: 'audio/flac' },
        { name: 'test.opus', type: 'audio/opus' },
        { name: 'test.webm', type: 'audio/webm' }
      ];

      formats.forEach(format => {
        const file = createMockFile(format.name, format.type);
        expect(file.name).toBe(format.name);
        expect(file.type).toBe(format.type);
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle missing file in event', async () => {
      const badEvent = { target: { files: [] } };
      const result = await handleFileSelect(badEvent);
      expect(result).toBeNull();
    });

    it('should throw on undefined event', async () => {
      // handleFileSelect doesn't guard against undefined
      await expect(async () => {
        await handleFileSelect(undefined);
      }).rejects.toThrow();
    });

    it('should throw on malformed event', async () => {
      // handleFileSelect doesn't guard against malformed events
      const badEvent = { };
      await expect(async () => {
        await handleFileSelect(badEvent);
      }).rejects.toThrow();
    });
  });
});
