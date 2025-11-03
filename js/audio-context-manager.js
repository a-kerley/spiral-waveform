/**
 * Audio Context Manager
 * 
 * Manages a singleton Web Audio API context to prevent multiple context creation
 * and handle context state management (suspended/running).
 * 
 * Replaces global window.audioContext with proper encapsulation.
 * 
 * @module audio-context-manager
 */

import { system } from './logger.js';

/**
 * AudioContextManager - Singleton manager for Web Audio API context
 */
export class AudioContextManager {
  static #instance = null;
  static #context = null;

  /**
   * Get the singleton AudioContext instance
   * Creates a new context if one doesn't exist
   * @returns {AudioContext} The shared AudioContext instance
   */
  static getContext() {
    if (!this.#context) {
      this.#context = new (window.AudioContext || window.webkitAudioContext)();
      system('AudioContext created', 'info');
    }
    return this.#context;
  }

  /**
   * Resume the audio context if it's suspended
   * Required for browsers that suspend contexts on page load
   * @returns {Promise<void>}
   */
  static async resume() {
    const context = this.getContext();
    
    if (context.state === 'suspended') {
      await context.resume();
      system(`AudioContext resumed (was ${context.state})`, 'info');
    }
    
    return context;
  }

  /**
   * Get the current state of the audio context
   * @returns {AudioContextState} 'suspended', 'running', or 'closed'
   */
  static getState() {
    return this.#context ? this.#context.state : 'closed';
  }

  /**
   * Close the audio context and release resources
   * Use this when completely done with audio processing
   * @returns {Promise<void>}
   */
  static async close() {
    if (this.#context && this.#context.state !== 'closed') {
      await this.#context.close();
      system('AudioContext closed', 'info');
      this.#context = null;
    }
  }

  /**
   * Create a temporary audio context for one-time processing
   * Automatically closes after use
   * @param {Function} callback - Async function that receives the context
   * @returns {Promise<any>} Result of the callback
   */
  static async withTemporaryContext(callback) {
    const tempContext = new (window.AudioContext || window.webkitAudioContext)();
    
    try {
      system('Temporary AudioContext created', 'debug');
      const result = await callback(tempContext);
      return result;
    } finally {
      await tempContext.close();
      system('Temporary AudioContext closed', 'debug');
    }
  }

  /**
   * Create an audio buffer with the shared context
   * @param {number} numberOfChannels - Number of audio channels
   * @param {number} length - Length in sample frames
   * @param {number} sampleRate - Sample rate in Hz
   * @returns {AudioBuffer}
   */
  static createBuffer(numberOfChannels, length, sampleRate) {
    const context = this.getContext();
    return context.createBuffer(numberOfChannels, length, sampleRate);
  }

  /**
   * Decode audio data using the shared context
   * @param {ArrayBuffer} audioData - Audio data to decode
   * @returns {Promise<AudioBuffer>}
   */
  static async decodeAudioData(audioData) {
    const context = this.getContext();
    await this.resume(); // Ensure context is running
    return context.decodeAudioData(audioData);
  }

  /**
   * Get audio context properties
   * @returns {Object} Context information
   */
  static getInfo() {
    const context = this.#context;
    
    if (!context) {
      return {
        exists: false,
        state: 'closed',
        sampleRate: null,
        currentTime: null
      };
    }

    return {
      exists: true,
      state: context.state,
      sampleRate: context.sampleRate,
      currentTime: context.currentTime,
      baseLatency: context.baseLatency,
      outputLatency: context.outputLatency
    };
  }

  /**
   * Check if audio context exists and is running
   * @returns {boolean}
   */
  static isActive() {
    return this.#context && this.#context.state === 'running';
  }

  /**
   * Dispose of the audio context and release all resources
   * Use this for cleanup when changing audio files or closing the app
   * @returns {Promise<void>}
   */
  static async dispose() {
    if (this.#context) {
      try {
        if (this.#context.state !== 'closed') {
          await this.#context.close();
          system('AudioContext disposed and closed', 'info');
        }
      } catch (error) {
        system(`Error disposing AudioContext: ${error.message}`, 'error');
      } finally {
        this.#context = null;
      }
    }
  }
}

// Convenience exports
export function getAudioContext() {
  return AudioContextManager.getContext();
}

export function resumeAudioContext() {
  return AudioContextManager.resume();
}

export function closeAudioContext() {
  return AudioContextManager.close();
}

export function createAudioBuffer(numberOfChannels, length, sampleRate) {
  return AudioContextManager.createBuffer(numberOfChannels, length, sampleRate);
}

export function decodeAudioData(audioData) {
  return AudioContextManager.decodeAudioData(audioData);
}
