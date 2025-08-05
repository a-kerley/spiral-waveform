// ✅ Comprehensive type validation utilities for production safety
import { system } from './logger.js';

// ✅ NEW: Core type checking utilities
export class TypeValidator {
  static isNumber(value, options = {}) {
    const { allowNaN = false, allowInfinite = false, min, max } = options;
    
    if (typeof value !== 'number') return false;
    if (!allowNaN && isNaN(value)) return false;
    if (!allowInfinite && !isFinite(value)) return false;
    if (typeof min === 'number' && value < min) return false;
    if (typeof max === 'number' && value > max) return false;
    
    return true;
  }

  static isString(value, options = {}) {
    const { minLength = 0, maxLength, allowEmpty = true } = options;
    
    if (typeof value !== 'string') return false;
    if (!allowEmpty && value.length === 0) return false;
    if (value.length < minLength) return false;
    if (typeof maxLength === 'number' && value.length > maxLength) return false;
    
    return true;
  }

  static isArray(value, options = {}) {
    const { minLength = 0, maxLength, elementValidator } = options;
    
    if (!Array.isArray(value)) return false;
    if (value.length < minLength) return false;
    if (typeof maxLength === 'number' && value.length > maxLength) return false;
    
    if (elementValidator && typeof elementValidator === 'function') {
      return value.every(elementValidator);
    }
    
    return true;
  }

  static isFunction(value, options = {}) {
    const { minArgs = 0, maxArgs } = options;
    
    if (typeof value !== 'function') return false;
    if (value.length < minArgs) return false;
    if (typeof maxArgs === 'number' && value.length > maxArgs) return false;
    
    return true;
  }

  static isObject(value, options = {}) {
    const { allowNull = false, requiredKeys = [], optionalKeys = [] } = options;
    
    if (value === null) return allowNull;
    if (typeof value !== 'object' || Array.isArray(value)) return false;
    
    // Check required keys
    for (const key of requiredKeys) {
      if (!(key in value)) return false;
    }
    
    // Check that all keys are either required or optional
    if (requiredKeys.length > 0 || optionalKeys.length > 0) {
      const allowedKeys = new Set([...requiredKeys, ...optionalKeys]);
      for (const key of Object.keys(value)) {
        if (!allowedKeys.has(key)) return false;
      }
    }
    
    return true;
  }

  static isCanvasElement(value) {
    return value instanceof HTMLCanvasElement;
  }

  static isCanvasContext(value) {
    return value && typeof value.getImageData === 'function' && typeof value.clearRect === 'function';
  }

  static isAudioBuffer(value) {
    return value && typeof value.duration === 'number' && typeof value.getChannelData === 'function';
  }

  static isAudioContext(value) {
    return value && typeof value.createGain === 'function' && typeof value.decodeAudioData === 'function';
  }

  static isNormalizedValue(value) {
    return this.isNumber(value, { min: 0, max: 1 });
  }

  static isTimestamp(value) {
    return this.isNumber(value, { min: 0, allowInfinite: false });
  }

  static isDuration(value) {
    return this.isNumber(value, { min: 0, allowInfinite: false });
  }

  static isPositiveInteger(value) {
    return Number.isInteger(value) && value > 0;
  }

  static isNonNegativeInteger(value) {
    return Number.isInteger(value) && value >= 0;
  }

  // ✅ NEW: Additional specific validators for the spiral waveform application
  static isAngle(value) {
    return this.isNumber(value, { allowInfinite: false }) && value >= 0 && value <= 2 * Math.PI;
  }

  static isVelocity(value) {
    return this.isNumber(value, { allowInfinite: false, min: -10, max: 10 });
  }

  static isVolume(value) {
    return this.isNumber(value, { min: 0, max: 1 });
  }

  static isFrequency(value) {
    return this.isNumber(value, { min: 20, max: 20000 });
  }

  static isPixelValue(value) {
    return this.isNumber(value, { allowInfinite: false, min: 0 });
  }

  static isColor(value) {
    if (!this.isString(value)) return false;
    // Basic color validation (hex, rgb, rgba, named colors)
    return /^(#[0-9A-Fa-f]{3,8}|rgb\(|rgba\(|[a-zA-Z]+)/.test(value);
  }

  static isHTMLElement(value, tagName = null) {
    if (!(value instanceof HTMLElement)) return false;
    if (tagName && value.tagName.toLowerCase() !== tagName.toLowerCase()) return false;
    return true;
  }

  static isFileObject(value) {
    return value instanceof File;
  }

  static isArrayBuffer(value) {
    return value instanceof ArrayBuffer;
  }

  static isTypedArray(value) {
    return value && typeof value.buffer === 'object' && typeof value.length === 'number';
  }
}

// ✅ NEW: Validation error types
export class ValidationError extends Error {
  constructor(message, field = null, value = null, expectedType = null) {
    super(message);
    this.name = 'ValidationError';
    this.field = field;
    this.value = value;
    this.expectedType = expectedType;
  }
}

// ✅ NEW: Function parameter validation decorators
export function validateParams(validators) {
  return function(target, propertyKey, descriptor) {
    const originalMethod = descriptor.value;
    
    descriptor.value = function(...args) {
      // Validate each parameter
      Object.keys(validators).forEach(paramName => {
        const index = parseInt(paramName);
        const validator = validators[paramName];
        const value = args[index];
        
        if (!validator(value)) {
          const error = new ValidationError(
            `Invalid parameter at index ${index} for ${propertyKey}`,
            paramName,
            value,
            validator.name
          );
          system(`Parameter validation failed: ${error.message}`, 'error', error);
          throw error;
        }
      });
      
      return originalMethod.apply(this, args);
    };
    
    return descriptor;
  };
}

// ✅ NEW: Comprehensive validation functions for common use cases
export class AudioValidation {
  static validatePlayhead(playhead, context = 'playhead') {
    if (!TypeValidator.isNumber(playhead, { min: 0, allowInfinite: false })) {
      throw new ValidationError(`Invalid ${context}: must be a non-negative finite number`, context, playhead, 'number');
    }
    return Math.max(0, playhead); // Ensure non-negative
  }

  static validateNormalizedPosition(position, context = 'position') {
    if (!TypeValidator.isNormalizedValue(position)) {
      const clamped = Math.max(0, Math.min(1, position));
      system(`${context} clamped from ${position} to ${clamped}`, 'warn');
      return clamped;
    }
    return position;
  }

  static validateAudioBuffer(buffer, context = 'audioBuffer') {
    if (!TypeValidator.isAudioBuffer(buffer)) {
      throw new ValidationError(`Invalid ${context}: must be an AudioBuffer`, context, buffer, 'AudioBuffer');
    }
    if (buffer.duration <= 0) {
      throw new ValidationError(`Invalid ${context}: duration must be positive`, context, buffer.duration, 'positive number');
    }
    return buffer;
  }

  static validateWaveformData(waveform, context = 'waveform') {
    if (!TypeValidator.isArray(waveform, { minLength: 1, elementValidator: (x) => TypeValidator.isNumber(x) })) {
      throw new ValidationError(`Invalid ${context}: must be a non-empty array of numbers`, context, waveform, 'number[]');
    }
    return waveform;
  }

  static validateSampleRate(sampleRate, context = 'sampleRate') {
    if (!TypeValidator.isPositiveInteger(sampleRate) || sampleRate < 8000 || sampleRate > 192000) {
      throw new ValidationError(`Invalid ${context}: must be a positive integer between 8000 and 192000`, context, sampleRate, 'integer');
    }
    return sampleRate;
  }

  static validateDuration(duration, context = 'duration') {
    if (!TypeValidator.isDuration(duration)) {
      throw new ValidationError(`Invalid ${context}: must be a non-negative finite number`, context, duration, 'number');
    }
    return duration;
  }
}

export class CanvasValidation {
  static validateCanvas(canvas, context = 'canvas') {
    if (!TypeValidator.isCanvasElement(canvas)) {
      throw new ValidationError(`Invalid ${context}: must be a HTMLCanvasElement`, context, canvas, 'HTMLCanvasElement');
    }
    if (canvas.width <= 0 || canvas.height <= 0) {
      throw new ValidationError(`Invalid ${context}: dimensions must be positive`, context, {width: canvas.width, height: canvas.height}, 'positive dimensions');
    }
    return canvas;
  }

  static validateCanvasContext(context, contextName = 'context') {
    if (!TypeValidator.isCanvasContext(context)) {
      throw new ValidationError(`Invalid ${contextName}: must be a valid 2D canvas context`, contextName, context, 'CanvasRenderingContext2D');
    }
    return context;
  }

  static validateCoordinates(x, y, context = 'coordinates') {
    if (!TypeValidator.isNumber(x, { allowInfinite: false }) || !TypeValidator.isNumber(y, { allowInfinite: false })) {
      throw new ValidationError(`Invalid ${context}: x and y must be finite numbers`, context, {x, y}, 'finite numbers');
    }
    return { x, y };
  }

  static validateDimensions(width, height, context = 'dimensions') {
    if (!TypeValidator.isNumber(width, { min: 0 }) || !TypeValidator.isNumber(height, { min: 0 })) {
      throw new ValidationError(`Invalid ${context}: width and height must be non-negative numbers`, context, {width, height}, 'non-negative numbers');
    }
    return { width, height };
  }
}

export class InteractionValidation {
  static validateEventObject(event, context = 'event') {
    if (!TypeValidator.isObject(event, { requiredKeys: ['clientX', 'clientY'] })) {
      throw new ValidationError(`Invalid ${context}: must be an event object with clientX and clientY`, context, event, 'Event');
    }
    return event;
  }

  static validateFileEvent(event, context = 'file event') {
    if (!TypeValidator.isObject(event) || !event.target || !event.target.files) {
      throw new ValidationError(`Invalid ${context}: must be a file input event with target.files`, context, event, 'FileEvent');
    }
    return event;
  }

  static validateCallback(callback, context = 'callback') {
    if (callback !== null && callback !== undefined && !TypeValidator.isFunction(callback)) {
      throw new ValidationError(`Invalid ${context}: must be a function or null/undefined`, context, callback, 'function');
    }
    return callback;
  }

  static validateState(state, requiredKeys = [], context = 'state') {
    if (!TypeValidator.isObject(state, { requiredKeys })) {
      throw new ValidationError(`Invalid ${context}: must be an object with required keys: ${requiredKeys.join(', ')}`, context, state, 'object');
    }
    return state;
  }
}

export class AnimationValidation {
  static validateTimestamp(timestamp, context = 'timestamp') {
    if (!TypeValidator.isTimestamp(timestamp)) {
      throw new ValidationError(`Invalid ${context}: must be a non-negative finite number`, context, timestamp, 'timestamp');
    }
    return timestamp;
  }

  static validateAnimationProgress(progress, context = 'animationProgress') {
    return AudioValidation.validateNormalizedPosition(progress, context);
  }

  static validateFrameRate(fps, context = 'frameRate') {
    if (!TypeValidator.isNumber(fps, { min: 1, max: 240 })) {
      throw new ValidationError(`Invalid ${context}: must be between 1 and 240`, context, fps, 'number');
    }
    return fps;
  }
}

// ✅ NEW: File and UI validation classes
export class FileValidation {
  static validateFile(file, context = 'file') {
    if (!TypeValidator.isFileObject(file)) {
      throw new ValidationError(`Invalid ${context}: must be a File object`, context, file, 'File');
    }
    return file;
  }

  static validateAudioFile(file, context = 'audioFile') {
    this.validateFile(file, context);
    
    // Define supported audio formats
    const supportedExtensions = ['mp3', 'wav', 'ogg', 'oga', 'opus', 'm4a', 'aac', 'flac', 'webm', 'mp4'];
    const supportedMimeTypes = [
      'audio/mpeg', 'audio/mp3',           // MP3
      'audio/wav', 'audio/wave', 'audio/x-wav',  // WAV
      'audio/ogg', 'audio/vorbis',         // OGG Vorbis
      'audio/opus',                        // Opus
      'audio/mp4', 'audio/aac', 'audio/x-m4a',   // M4A/AAC
      'audio/flac', 'audio/x-flac',        // FLAC
      'audio/webm',                        // WebM
      'application/ogg'                    // Alternative OGG MIME type
    ];
    
    // Check MIME type first (more reliable)
    const isValidMimeType = file.type && supportedMimeTypes.some(type => 
      file.type.toLowerCase().includes(type.toLowerCase())
    );
    
    // Check file extension as fallback
    const extension = file.name.split('.').pop()?.toLowerCase();
    const isValidExtension = extension && supportedExtensions.includes(extension);
    
    if (!isValidMimeType && !isValidExtension) {
      const supportedFormats = 'MP3, WAV, OGG/Vorbis, Opus, M4A, AAC, FLAC, WebM';
      throw new ValidationError(
        `Invalid ${context}: unsupported audio format. Supported formats: ${supportedFormats}`, 
        context, 
        { type: file.type, extension }, 
        supportedFormats
      );
    }
    
    // Check file size (limit to 100MB)
    if (file.size > 100 * 1024 * 1024) {
      throw new ValidationError(`Invalid ${context}: file too large (max 100MB)`, context, file.size, 'size <= 100MB');
    }
    
    return file;
  }

  static validateArrayBuffer(buffer, context = 'arrayBuffer') {
    if (!TypeValidator.isArrayBuffer(buffer)) {
      throw new ValidationError(`Invalid ${context}: must be an ArrayBuffer`, context, buffer, 'ArrayBuffer');
    }
    
    if (buffer.byteLength === 0) {
      throw new ValidationError(`Invalid ${context}: buffer is empty`, context, buffer.byteLength, 'non-empty buffer');
    }
    
    return buffer;
  }
}

export class UIValidation {
  static validateContainer(container, context = 'container') {
    if (!TypeValidator.isHTMLElement(container)) {
      throw new ValidationError(`Invalid ${context}: must be an HTML element`, context, container, 'HTMLElement');
    }
    return container;
  }

  static validateColorValue(color, context = 'color') {
    if (!TypeValidator.isColor(color)) {
      throw new ValidationError(`Invalid ${context}: must be a valid color value`, context, color, 'color string');
    }
    return color;
  }

  static validatePixelCoordinate(value, context = 'coordinate') {
    if (!TypeValidator.isPixelValue(value)) {
      throw new ValidationError(`Invalid ${context}: must be a non-negative pixel value`, context, value, 'pixel value');
    }
    return value;
  }

  static validateDOMSelector(selector, context = 'selector') {
    if (!TypeValidator.isString(selector, { minLength: 1 })) {
      throw new ValidationError(`Invalid ${context}: must be a non-empty string`, context, selector, 'CSS selector');
    }
    
    try {
      document.querySelector(selector);
    } catch (error) {
      throw new ValidationError(`Invalid ${context}: not a valid CSS selector`, context, selector, 'valid CSS selector');
    }
    
    return selector;
  }
}

// ✅ NEW: Enhanced runtime type checking utilities
export function assertType(value, validator, context = 'value') {
  if (!validator(value)) {
    throw new ValidationError(`Type assertion failed for ${context}`, context, value);
  }
  return value;
}

export function ensureType(value, validator, fallback, context = 'value') {
  if (!validator(value)) {
    system(`Type validation failed for ${context}, using fallback`, 'warn', { value, fallback });
    return fallback;
  }
  return value;
}

// ✅ NEW: Function parameter validation wrapper
export function withValidation(fn, paramValidators = [], returnValidator = null, functionName = 'anonymous') {
  return function(...args) {
    // Validate parameters
    paramValidators.forEach((validator, index) => {
      if (validator && args[index] !== undefined) {
        try {
          if (typeof validator === 'function') {
            if (!validator(args[index])) {
              throw new ValidationError(
                `Parameter ${index} validation failed in ${functionName}`,
                `param${index}`,
                args[index],
                validator.name
              );
            }
          } else if (typeof validator === 'object' && validator.validate) {
            validator.validate(args[index], `param${index} in ${functionName}`);
          }
        } catch (error) {
          system(`Parameter validation failed in ${functionName}`, 'error', error);
          throw error;
        }
      }
    });

    // Execute function
    const result = fn.apply(this, args);

    // Validate return value if specified
    if (returnValidator && result !== undefined) {
      try {
        if (typeof returnValidator === 'function') {
          if (!returnValidator(result)) {
            throw new ValidationError(
              `Return value validation failed in ${functionName}`,
              'return',
              result,
              returnValidator.name
            );
          }
        } else if (typeof returnValidator === 'object' && returnValidator.validate) {
          returnValidator.validate(result, `return value of ${functionName}`);
        }
      } catch (error) {
        system(`Return value validation failed in ${functionName}`, 'error', error);
        throw error;
      }
    }

    return result;
  };
}

// ✅ NEW: Batch validation utility
export function validateAll(validations) {
  const errors = [];
  
  validations.forEach(({ value, validator, context, required = true }) => {
    try {
      if (value === undefined || value === null) {
        if (required) {
          errors.push(new ValidationError(`Required ${context} is missing`, context, value));
        }
        return;
      }
      
      if (typeof validator === 'function') {
        if (!validator(value)) {
          errors.push(new ValidationError(`Validation failed for ${context}`, context, value));
        }
      } else if (typeof validator === 'object' && validator.validate) {
        validator.validate(value, context);
      }
    } catch (error) {
      errors.push(error instanceof ValidationError ? error : new ValidationError(`Validation error for ${context}: ${error.message}`, context, value));
    }
  });
  
  if (errors.length > 0) {
    const combinedMessage = `Multiple validation errors: ${errors.map(e => e.message).join('; ')}`;
    throw new ValidationError(combinedMessage, 'batch', errors);
  }
  
  return true;
}

// ✅ NEW: Safe wrapper functions
export function safeExecute(fn, fallback = null, context = 'function') {
  try {
    if (!TypeValidator.isFunction(fn)) {
      system(`Safe execute: ${context} is not a function`, 'warn');
      return fallback;
    }
    return fn();
  } catch (error) {
    system(`Safe execute: ${context} threw an error`, 'error', error);
    return fallback;
  }
}

export function safeParseNumber(value, fallback = 0, context = 'number') {
  if (TypeValidator.isNumber(value)) return value;
  
  if (TypeValidator.isString(value)) {
    const parsed = parseFloat(value);
    if (TypeValidator.isNumber(parsed, { allowInfinite: false })) {
      return parsed;
    }
  }
  
  system(`Safe parse: ${context} could not be parsed as number`, 'warn', { value, fallback });
  return fallback;
}

// ✅ NEW: Development-time type checking (can be disabled in production)
export class DevTypeChecker {
  static enabled = true; // Can be disabled in production builds
  
  static check(condition, message, value = null) {
    if (!this.enabled) return;
    
    if (!condition) {
      const error = new ValidationError(`Dev type check failed: ${message}`, null, value);
      system(error.message, 'warn', error);
      console.warn(error); // Always log in dev mode
    }
  }
  
  static enable() {
    this.enabled = true;
  }
  
  static disable() {
    this.enabled = false;
  }
}

// ✅ NEW: Export convenient validation shortcuts
export const validate = {
  // Basic types
  number: (v, opts) => TypeValidator.isNumber(v, opts),
  string: (v, opts) => TypeValidator.isString(v, opts),
  array: (v, opts) => TypeValidator.isArray(v, opts),
  function: (v, opts) => TypeValidator.isFunction(v, opts),
  object: (v, opts) => TypeValidator.isObject(v, opts),
  
  // Web API types
  canvas: (v) => TypeValidator.isCanvasElement(v),
  context: (v) => TypeValidator.isCanvasContext(v),
  htmlElement: (v, tag) => TypeValidator.isHTMLElement(v, tag),
  file: (v) => TypeValidator.isFileObject(v),
  arrayBuffer: (v) => TypeValidator.isArrayBuffer(v),
  
  // Audio types
  audioBuffer: (v) => TypeValidator.isAudioBuffer(v),
  audioContext: (v) => TypeValidator.isAudioContext(v),
  playhead: (v) => AudioValidation.validatePlayhead(v),
  normalizedPosition: (v) => AudioValidation.validateNormalizedPosition(v),
  sampleRate: (v) => AudioValidation.validateSampleRate(v),
  duration: (v) => AudioValidation.validateDuration(v),
  waveform: (v) => AudioValidation.validateWaveformData(v),
  
  // Animation types
  timestamp: (v) => AnimationValidation.validateTimestamp(v),
  frameRate: (v) => AnimationValidation.validateFrameRate(v),
  animationProgress: (v) => AnimationValidation.validateAnimationProgress(v),
  
  // Canvas types
  coordinates: (x, y) => CanvasValidation.validateCoordinates(x, y),
  dimensions: (w, h) => CanvasValidation.validateDimensions(w, h),
  
  // Interaction types
  event: (v) => InteractionValidation.validateEventObject(v),
  fileEvent: (v) => InteractionValidation.validateFileEvent(v),
  callback: (v) => InteractionValidation.validateCallback(v),
  state: (v, keys) => InteractionValidation.validateState(v, keys),
  
  // File types
  audioFile: (v) => FileValidation.validateAudioFile(v),
  
  // UI types
  container: (v) => UIValidation.validateContainer(v),
  color: (v) => UIValidation.validateColorValue(v),
  pixelCoordinate: (v) => UIValidation.validatePixelCoordinate(v),
  domSelector: (v) => UIValidation.validateDOMSelector(v),
  
  // Application-specific types
  angle: (v) => TypeValidator.isAngle(v),
  velocity: (v) => TypeValidator.isVelocity(v),
  volume: (v) => TypeValidator.isVolume(v),
  frequency: (v) => TypeValidator.isFrequency(v),
  pixelValue: (v) => TypeValidator.isPixelValue(v)
};
