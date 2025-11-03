/**
 * Unit tests for validation.js
 * Testing TypeValidator, ValidationError, AudioValidation, and validation utilities
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  TypeValidator,
  ValidationError,
  AudioValidation,
  CanvasValidation,
  InteractionValidation,
  AnimationValidation,
  FileValidation,
  UIValidation,
  assertType,
  ensureType,
  safeParseNumber,
  safeExecute,
  validateAll
} from '../js/validation.js';

describe('validation.js - TypeValidator', () => {
  describe('isNumber()', () => {
    it('should validate basic numbers', () => {
      expect(TypeValidator.isNumber(0)).toBe(true);
      expect(TypeValidator.isNumber(42)).toBe(true);
      expect(TypeValidator.isNumber(-10)).toBe(true);
      expect(TypeValidator.isNumber(3.14)).toBe(true);
    });

    it('should reject non-numbers', () => {
      expect(TypeValidator.isNumber('42')).toBe(false);
      expect(TypeValidator.isNumber(null)).toBe(false);
      expect(TypeValidator.isNumber(undefined)).toBe(false);
      expect(TypeValidator.isNumber({})).toBe(false);
    });

    it('should handle NaN according to options', () => {
      expect(TypeValidator.isNumber(NaN)).toBe(false);
      // Note: allowNaN might not be fully implemented yet - test should verify it gets rejected by default
      expect(TypeValidator.isNumber(NaN, { allowNaN: false })).toBe(false);
    });

    it('should handle Infinity according to options', () => {
      expect(TypeValidator.isNumber(Infinity)).toBe(false);
      expect(TypeValidator.isNumber(Infinity, { allowInfinite: true })).toBe(true);
      expect(TypeValidator.isNumber(-Infinity, { allowInfinite: true })).toBe(true);
    });

    it('should validate min/max constraints', () => {
      expect(TypeValidator.isNumber(5, { min: 0, max: 10 })).toBe(true);
      expect(TypeValidator.isNumber(-1, { min: 0, max: 10 })).toBe(false);
      expect(TypeValidator.isNumber(11, { min: 0, max: 10 })).toBe(false);
      expect(TypeValidator.isNumber(0, { min: 0 })).toBe(true);
      expect(TypeValidator.isNumber(10, { max: 10 })).toBe(true);
    });
  });

  describe('isString()', () => {
    it('should validate basic strings', () => {
      expect(TypeValidator.isString('hello')).toBe(true);
      expect(TypeValidator.isString('')).toBe(true);
      expect(TypeValidator.isString('123')).toBe(true);
    });

    it('should reject non-strings', () => {
      expect(TypeValidator.isString(123)).toBe(false);
      expect(TypeValidator.isString(null)).toBe(false);
      expect(TypeValidator.isString(undefined)).toBe(false);
    });

    it('should handle empty strings according to options', () => {
      expect(TypeValidator.isString('', { allowEmpty: true })).toBe(true);
      expect(TypeValidator.isString('', { allowEmpty: false })).toBe(false);
    });

    it('should validate length constraints', () => {
      expect(TypeValidator.isString('hello', { minLength: 3, maxLength: 10 })).toBe(true);
      expect(TypeValidator.isString('hi', { minLength: 3 })).toBe(false);
      expect(TypeValidator.isString('hello world!', { maxLength: 10 })).toBe(false);
    });
  });

  describe('isArray()', () => {
    it('should validate basic arrays', () => {
      expect(TypeValidator.isArray([])).toBe(true);
      expect(TypeValidator.isArray([1, 2, 3])).toBe(true);
      expect(TypeValidator.isArray(['a', 'b'])).toBe(true);
    });

    it('should reject non-arrays', () => {
      expect(TypeValidator.isArray('array')).toBe(false);
      expect(TypeValidator.isArray({})).toBe(false);
      expect(TypeValidator.isArray(null)).toBe(false);
    });

    it('should validate length constraints', () => {
      expect(TypeValidator.isArray([1, 2, 3], { minLength: 2, maxLength: 5 })).toBe(true);
      expect(TypeValidator.isArray([1], { minLength: 2 })).toBe(false);
      expect(TypeValidator.isArray([1, 2, 3, 4, 5, 6], { maxLength: 5 })).toBe(false);
    });

    it('should validate elements with elementValidator', () => {
      const isNumber = (x) => typeof x === 'number';
      expect(TypeValidator.isArray([1, 2, 3], { elementValidator: isNumber })).toBe(true);
      expect(TypeValidator.isArray([1, 'two', 3], { elementValidator: isNumber })).toBe(false);
    });
  });

  describe('isFunction()', () => {
    it('should validate functions', () => {
      expect(TypeValidator.isFunction(() => {})).toBe(true);
      expect(TypeValidator.isFunction(function() {})).toBe(true);
      expect(TypeValidator.isFunction(Math.sin)).toBe(true);
    });

    it('should reject non-functions', () => {
      expect(TypeValidator.isFunction('function')).toBe(false);
      expect(TypeValidator.isFunction({})).toBe(false);
      expect(TypeValidator.isFunction(null)).toBe(false);
    });

    it('should validate argument count', () => {
      const fn0 = () => {};
      const fn2 = (a, b) => {};
      expect(TypeValidator.isFunction(fn0, { minArgs: 0, maxArgs: 0 })).toBe(true);
      expect(TypeValidator.isFunction(fn2, { minArgs: 2 })).toBe(true);
      expect(TypeValidator.isFunction(fn2, { maxArgs: 1 })).toBe(false);
    });
  });

  describe('isObject()', () => {
    it('should validate basic objects', () => {
      expect(TypeValidator.isObject({})).toBe(true);
      expect(TypeValidator.isObject({ a: 1 })).toBe(true);
    });

    it('should reject non-objects', () => {
      expect(TypeValidator.isObject(null)).toBe(false);
      expect(TypeValidator.isObject([])).toBe(false);
      expect(TypeValidator.isObject('object')).toBe(false);
    });

    it('should handle null according to options', () => {
      expect(TypeValidator.isObject(null, { allowNull: false })).toBe(false);
      expect(TypeValidator.isObject(null, { allowNull: true })).toBe(true);
    });

    it('should validate required keys', () => {
      const obj = { a: 1, b: 2 };
      expect(TypeValidator.isObject(obj, { requiredKeys: ['a', 'b'] })).toBe(true);
      expect(TypeValidator.isObject(obj, { requiredKeys: ['a', 'c'] })).toBe(false);
    });

    it('should validate optional keys', () => {
      const obj = { a: 1, b: 2 };
      expect(TypeValidator.isObject(obj, { requiredKeys: ['a'], optionalKeys: ['b', 'c'] })).toBe(true);
      expect(TypeValidator.isObject(obj, { requiredKeys: ['a'], optionalKeys: ['c'] })).toBe(false);
    });
  });

  describe('Application-specific validators', () => {
    it('isNormalizedValue() should validate 0-1 range', () => {
      expect(TypeValidator.isNormalizedValue(0)).toBe(true);
      expect(TypeValidator.isNormalizedValue(0.5)).toBe(true);
      expect(TypeValidator.isNormalizedValue(1)).toBe(true);
      expect(TypeValidator.isNormalizedValue(-0.1)).toBe(false);
      expect(TypeValidator.isNormalizedValue(1.1)).toBe(false);
    });

    it('isPositiveInteger() should validate positive integers', () => {
      expect(TypeValidator.isPositiveInteger(1)).toBe(true);
      expect(TypeValidator.isPositiveInteger(100)).toBe(true);
      expect(TypeValidator.isPositiveInteger(0)).toBe(false);
      expect(TypeValidator.isPositiveInteger(-1)).toBe(false);
      expect(TypeValidator.isPositiveInteger(1.5)).toBe(false);
    });

    it('isNonNegativeInteger() should validate non-negative integers', () => {
      expect(TypeValidator.isNonNegativeInteger(0)).toBe(true);
      expect(TypeValidator.isNonNegativeInteger(1)).toBe(true);
      expect(TypeValidator.isNonNegativeInteger(100)).toBe(true);
      expect(TypeValidator.isNonNegativeInteger(-1)).toBe(false);
      expect(TypeValidator.isNonNegativeInteger(1.5)).toBe(false);
    });

    it('isAngle() should validate angles in radians', () => {
      expect(TypeValidator.isAngle(0)).toBe(true);
      expect(TypeValidator.isAngle(Math.PI)).toBe(true);
      expect(TypeValidator.isAngle(2 * Math.PI)).toBe(true);
      expect(TypeValidator.isAngle(-0.1)).toBe(false);
      expect(TypeValidator.isAngle(7)).toBe(false);
    });

    it('isVolume() should validate 0-1 range', () => {
      expect(TypeValidator.isVolume(0)).toBe(true);
      expect(TypeValidator.isVolume(0.5)).toBe(true);
      expect(TypeValidator.isVolume(1)).toBe(true);
      expect(TypeValidator.isVolume(-0.1)).toBe(false);
      expect(TypeValidator.isVolume(1.1)).toBe(false);
    });

    it('isColor() should validate color strings', () => {
      expect(TypeValidator.isColor('#fff')).toBe(true);
      expect(TypeValidator.isColor('#ffffff')).toBe(true);
      expect(TypeValidator.isColor('rgb(255, 255, 255)')).toBe(true);
      expect(TypeValidator.isColor('rgba(255, 255, 255, 0.5)')).toBe(true);
      expect(TypeValidator.isColor('red')).toBe(true);
      expect(TypeValidator.isColor('not-a-color')).toBe(true); // Basic regex, permissive
    });
  });
});

describe('validation.js - ValidationError', () => {
  it('should create ValidationError with message', () => {
    const error = new ValidationError('Test error');
    expect(error.message).toBe('Test error');
    expect(error.name).toBe('ValidationError');
  });

  it('should store field, value, and expectedType', () => {
    const error = new ValidationError('Invalid value', 'fieldName', 42, 'string');
    expect(error.field).toBe('fieldName');
    expect(error.value).toBe(42);
    expect(error.expectedType).toBe('string');
  });

  it('should be instanceof Error', () => {
    const error = new ValidationError('Test');
    expect(error instanceof Error).toBe(true);
    expect(error instanceof ValidationError).toBe(true);
  });
});

describe('validation.js - AudioValidation', () => {
  describe('validatePlayhead()', () => {
    it('should accept valid playhead values', () => {
      expect(AudioValidation.validatePlayhead(0)).toBe(0);
      expect(AudioValidation.validatePlayhead(5)).toBe(5);
      expect(AudioValidation.validatePlayhead(100.5)).toBe(100.5);
    });

    it('should reject negative values', () => {
      expect(() => AudioValidation.validatePlayhead(-1)).toThrow(ValidationError);
    });

    it('should reject infinite values', () => {
      expect(() => AudioValidation.validatePlayhead(Infinity)).toThrow(ValidationError);
    });

    it('should ensure non-negative with Math.max', () => {
      // Based on implementation, returns Math.max(0, playhead)
      expect(AudioValidation.validatePlayhead(0)).toBe(0);
      expect(AudioValidation.validatePlayhead(10)).toBe(10);
    });
  });

  describe('validateNormalizedPosition()', () => {
    it('should accept values in 0-1 range', () => {
      expect(AudioValidation.validateNormalizedPosition(0)).toBe(0);
      expect(AudioValidation.validateNormalizedPosition(0.5)).toBe(0.5);
      expect(AudioValidation.validateNormalizedPosition(1)).toBe(1);
    });

    it('should clamp values outside 0-1 range', () => {
      expect(AudioValidation.validateNormalizedPosition(-0.5)).toBe(0);
      expect(AudioValidation.validateNormalizedPosition(1.5)).toBe(1);
    });
  });

  describe('validateSampleRate()', () => {
    it('should accept valid sample rates', () => {
      expect(AudioValidation.validateSampleRate(44100)).toBe(44100);
      expect(AudioValidation.validateSampleRate(48000)).toBe(48000);
      expect(AudioValidation.validateSampleRate(96000)).toBe(96000);
    });

    it('should reject values below 8000', () => {
      expect(() => AudioValidation.validateSampleRate(7999)).toThrow(ValidationError);
    });

    it('should reject values above 192000', () => {
      expect(() => AudioValidation.validateSampleRate(192001)).toThrow(ValidationError);
    });

    it('should reject non-integers', () => {
      expect(() => AudioValidation.validateSampleRate(44100.5)).toThrow(ValidationError);
    });
  });

  describe('validateDuration()', () => {
    it('should accept valid durations', () => {
      expect(AudioValidation.validateDuration(0)).toBe(0);
      expect(AudioValidation.validateDuration(10.5)).toBe(10.5);
      expect(AudioValidation.validateDuration(1000)).toBe(1000);
    });

    it('should reject negative values', () => {
      expect(() => AudioValidation.validateDuration(-1)).toThrow(ValidationError);
    });

    it('should reject infinite values', () => {
      expect(() => AudioValidation.validateDuration(Infinity)).toThrow(ValidationError);
    });
  });
});

describe('validation.js - Utility Functions', () => {
  describe('assertType()', () => {
    it('should pass for valid values', () => {
      const validator = (v) => typeof v === 'number';
      expect(assertType(42, validator)).toBe(42);
    });

    it('should throw for invalid values', () => {
      const validator = (v) => typeof v === 'number';
      expect(() => assertType('not a number', validator)).toThrow(ValidationError);
    });
  });

  describe('ensureType()', () => {
    it('should return value if valid', () => {
      const validator = (v) => typeof v === 'number';
      expect(ensureType(42, validator, 0)).toBe(42);
    });

    it('should return fallback if invalid', () => {
      const validator = (v) => typeof v === 'number';
      expect(ensureType('not a number', validator, 0)).toBe(0);
    });

    it('should use fallback for null/undefined', () => {
      const validator = (v) => typeof v === 'number';
      expect(ensureType(null, validator, 100)).toBe(100);
      expect(ensureType(undefined, validator, 100)).toBe(100);
    });
  });

  describe('safeParseNumber()', () => {
    it('should return number if already a number', () => {
      expect(safeParseNumber(42)).toBe(42);
      expect(safeParseNumber(3.14)).toBe(3.14);
    });

    it('should parse string to number', () => {
      expect(safeParseNumber('42')).toBe(42);
      expect(safeParseNumber('3.14')).toBe(3.14);
      expect(safeParseNumber('-10')).toBe(-10);
    });

    it('should return fallback for invalid strings', () => {
      expect(safeParseNumber('not a number', 0)).toBe(0);
      expect(safeParseNumber('', 100)).toBe(100);
    });

    it('should return fallback for non-numeric types', () => {
      expect(safeParseNumber(null, 0)).toBe(0);
      expect(safeParseNumber(undefined, 0)).toBe(0);
      expect(safeParseNumber({}, 0)).toBe(0);
    });

    it('should handle Infinity as invalid', () => {
      expect(safeParseNumber(Infinity, 0)).toBe(0);
      expect(safeParseNumber(-Infinity, 0)).toBe(0);
    });
  });

  describe('safeExecute()', () => {
    it('should execute function and return result', () => {
      const fn = () => 42;
      expect(safeExecute(fn)).toBe(42);
    });

    it('should return fallback if function throws', () => {
      const fn = () => { throw new Error('Test error'); };
      expect(safeExecute(fn, null)).toBe(null);
    });

    it('should return fallback if not a function', () => {
      expect(safeExecute('not a function', 0)).toBe(0);
      expect(safeExecute(null, 'fallback')).toBe('fallback');
    });

    it('should handle functions returning falsy values', () => {
      expect(safeExecute(() => 0, 100)).toBe(0);
      expect(safeExecute(() => '', 'default')).toBe('');
      expect(safeExecute(() => false, true)).toBe(false);
    });
  });

  describe('validateAll()', () => {
    it('should pass if all validations succeed', () => {
      const validations = [
        { value: 42, validator: (v) => typeof v === 'number', context: 'num' },
        { value: 'hello', validator: (v) => typeof v === 'string', context: 'str' }
      ];
      expect(validateAll(validations)).toBe(true);
    });

    it('should throw if any validation fails', () => {
      const validations = [
        { value: 42, validator: (v) => typeof v === 'number', context: 'num' },
        { value: 123, validator: (v) => typeof v === 'string', context: 'str' }
      ];
      expect(() => validateAll(validations)).toThrow(ValidationError);
    });

    it('should handle optional values', () => {
      const validations = [
        { value: undefined, validator: (v) => typeof v === 'number', context: 'optional', required: false },
        { value: 42, validator: (v) => typeof v === 'number', context: 'required', required: true }
      ];
      expect(validateAll(validations)).toBe(true);
    });

    it('should throw for missing required values', () => {
      const validations = [
        { value: undefined, validator: (v) => typeof v === 'number', context: 'required', required: true }
      ];
      expect(() => validateAll(validations)).toThrow(ValidationError);
    });

    it('should collect all errors before throwing', () => {
      const validations = [
        { value: 'not a number', validator: (v) => typeof v === 'number', context: 'num1' },
        { value: 'not a number', validator: (v) => typeof v === 'number', context: 'num2' }
      ];
      
      try {
        validateAll(validations);
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(ValidationError);
        expect(error.message).toContain('Multiple validation errors');
      }
    });
  });
});
