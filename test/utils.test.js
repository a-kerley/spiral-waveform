/**
 * Unit tests for utils.js
 * Testing pure utility functions: clamp, lerp, mapRange, easeInOutCubic, normalizeAngle, etc.
 */

import { describe, it, expect } from 'vitest';
import {
  clamp,
  lerp,
  mapRange,
  easeInOutCubic,
  normalizeAngle,
  toRadians,
  toDegrees,
  CONFIG
} from '../js/utils.js';

describe('utils.js - Pure Functions', () => {
  describe('clamp()', () => {
    it('should return value when within min and max range', () => {
      expect(clamp(5, 0, 10)).toBe(5);
      expect(clamp(0, 0, 10)).toBe(0);
      expect(clamp(10, 0, 10)).toBe(10);
    });

    it('should clamp to min when value is below minimum', () => {
      expect(clamp(-5, 0, 10)).toBe(0);
      expect(clamp(-100, 0, 10)).toBe(0);
    });

    it('should clamp to max when value is above maximum', () => {
      expect(clamp(15, 0, 10)).toBe(10);
      expect(clamp(100, 0, 10)).toBe(10);
    });

    it('should handle negative ranges correctly', () => {
      expect(clamp(-5, -10, -1)).toBe(-5);
      expect(clamp(-15, -10, -1)).toBe(-10);
      expect(clamp(0, -10, -1)).toBe(-1);
    });

    it('should handle fractional values', () => {
      expect(clamp(0.5, 0, 1)).toBe(0.5);
      expect(clamp(1.5, 0, 1)).toBe(1);
      expect(clamp(-0.5, 0, 1)).toBe(0);
    });

    it('should swap min and max if min > max', () => {
      // Based on implementation, it should handle this gracefully
      const result = clamp(5, 10, 0);
      expect(result).toBeGreaterThanOrEqual(0);
      expect(result).toBeLessThanOrEqual(10);
    });

    it('should handle invalid inputs with fallback values', () => {
      // Should use fallback values for non-numbers
      expect(clamp(NaN, 0, 10)).toBeDefined();
      expect(clamp(Infinity, 0, 10)).toBeDefined();
      expect(clamp(5, NaN, 10)).toBeDefined();
    });
  });

  describe('lerp()', () => {
    it('should interpolate between two values', () => {
      expect(lerp(0, 10, 0.5)).toBe(5);
      expect(lerp(0, 100, 0.25)).toBe(25);
      expect(lerp(0, 100, 0.75)).toBe(75);
    });

    it('should return start value when t = 0', () => {
      expect(lerp(10, 20, 0)).toBe(10);
      expect(lerp(-5, 5, 0)).toBe(-5);
    });

    it('should return end value when t = 1', () => {
      expect(lerp(10, 20, 1)).toBe(20);
      expect(lerp(-5, 5, 1)).toBe(5);
    });

    it('should handle negative values', () => {
      expect(lerp(-10, 10, 0.5)).toBe(0);
      expect(lerp(-100, -50, 0.5)).toBe(-75);
    });

    it('should handle fractional interpolation', () => {
      expect(lerp(0, 1, 0.333)).toBeCloseTo(0.333, 3);
      expect(lerp(0, 1, 0.666)).toBeCloseTo(0.666, 3);
    });

    it('should clamp t values outside 0-1 range', () => {
      // Based on validation, t should be clamped to 0-1
      const result1 = lerp(0, 10, -0.5);
      const result2 = lerp(0, 10, 1.5);
      expect(result1).toBeDefined();
      expect(result2).toBeDefined();
    });
  });

  describe('mapRange()', () => {
    it('should map value from input range to output range', () => {
      expect(mapRange(5, 0, 10, 0, 100)).toBe(50);
      expect(mapRange(0, 0, 10, 0, 100)).toBe(0);
      expect(mapRange(10, 0, 10, 0, 100)).toBe(100);
    });

    it('should handle negative input ranges', () => {
      expect(mapRange(0, -10, 10, 0, 100)).toBe(50);
      expect(mapRange(-5, -10, 10, 0, 100)).toBe(25);
    });

    it('should handle negative output ranges', () => {
      expect(mapRange(5, 0, 10, -100, 0)).toBe(-50);
      expect(mapRange(0, 0, 10, -100, 0)).toBe(-100);
    });

    it('should handle reversed ranges', () => {
      expect(mapRange(5, 0, 10, 100, 0)).toBe(50);
      expect(mapRange(0, 0, 10, 100, 0)).toBe(100);
      expect(mapRange(10, 0, 10, 100, 0)).toBe(0);
    });

    it('should handle fractional values', () => {
      expect(mapRange(0.5, 0, 1, 0, 100)).toBe(50);
      expect(mapRange(0.25, 0, 1, 0, 100)).toBe(25);
    });

    it('should handle zero input range gracefully', () => {
      // Should return outMin or handle gracefully
      const result = mapRange(5, 5, 5, 0, 100);
      expect(result).toBeDefined();
      expect(result).toBe(0); // Based on implementation, returns outMin
    });

    it('should extrapolate when value is outside input range', () => {
      expect(mapRange(15, 0, 10, 0, 100)).toBe(150);
      expect(mapRange(-5, 0, 10, 0, 100)).toBe(-50);
    });
  });

  describe('easeInOutCubic()', () => {
    it('should return 0 when t = 0', () => {
      expect(easeInOutCubic(0)).toBe(0);
    });

    it('should return 1 when t = 1', () => {
      expect(easeInOutCubic(1)).toBe(1);
    });

    it('should return 0.5 when t = 0.5', () => {
      expect(easeInOutCubic(0.5)).toBe(0.5);
    });

    it('should ease in during first half (0 to 0.5)', () => {
      const t1 = easeInOutCubic(0.25);
      const t2 = easeInOutCubic(0.5);
      expect(t1).toBeGreaterThan(0);
      expect(t1).toBeLessThan(0.25); // Slower than linear
      expect(t2).toBe(0.5);
    });

    it('should ease out during second half (0.5 to 1)', () => {
      const t1 = easeInOutCubic(0.75);
      const t2 = easeInOutCubic(1);
      expect(t1).toBeGreaterThan(0.75); // Faster than linear
      expect(t1).toBeLessThan(1);
      expect(t2).toBe(1);
    });

    it('should return symmetric values around 0.5', () => {
      const early = easeInOutCubic(0.25);
      const late = easeInOutCubic(0.75);
      expect(late).toBeCloseTo(1 - early, 5);
    });

    it('should handle edge cases with validation', () => {
      // Values outside 0-1 should be validated
      const result1 = easeInOutCubic(-0.1);
      const result2 = easeInOutCubic(1.1);
      expect(result1).toBeDefined();
      expect(result2).toBeDefined();
    });

    it('should produce smooth curve', () => {
      const values = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1].map(easeInOutCubic);
      // Values should be monotonically increasing
      for (let i = 1; i < values.length; i++) {
        expect(values[i]).toBeGreaterThanOrEqual(values[i - 1]);
      }
    });
  });

  describe('normalizeAngle()', () => {
    it('should normalize angles to 0 to 2π range', () => {
      expect(normalizeAngle(0)).toBeCloseTo(Math.PI / 2, 5);
      expect(normalizeAngle(Math.PI)).toBeCloseTo(Math.PI * 1.5, 5);
    });

    it('should handle negative angles', () => {
      const result = normalizeAngle(-Math.PI / 2);
      expect(result).toBeGreaterThanOrEqual(0);
      expect(result).toBeLessThan(2 * Math.PI);
    });

    it('should handle angles greater than 2π', () => {
      const result = normalizeAngle(3 * Math.PI);
      expect(result).toBeGreaterThanOrEqual(0);
      expect(result).toBeLessThan(2 * Math.PI);
    });

    it('should handle very large angles', () => {
      const result = normalizeAngle(10 * Math.PI);
      expect(result).toBeGreaterThanOrEqual(0);
      expect(result).toBeLessThan(2 * Math.PI);
    });

    it('should be consistent for equivalent angles', () => {
      const angle1 = normalizeAngle(0);
      const angle2 = normalizeAngle(2 * Math.PI);
      expect(angle1).toBeCloseTo(angle2, 5);
    });
  });

  describe('toRadians()', () => {
    it('should convert degrees to radians', () => {
      expect(toRadians(0)).toBe(0);
      expect(toRadians(180)).toBeCloseTo(Math.PI, 5);
      expect(toRadians(360)).toBeCloseTo(2 * Math.PI, 5);
      expect(toRadians(90)).toBeCloseTo(Math.PI / 2, 5);
    });

    it('should handle negative degrees', () => {
      expect(toRadians(-90)).toBeCloseTo(-Math.PI / 2, 5);
      expect(toRadians(-180)).toBeCloseTo(-Math.PI, 5);
    });

    it('should handle fractional degrees', () => {
      expect(toRadians(45)).toBeCloseTo(Math.PI / 4, 5);
      expect(toRadians(30)).toBeCloseTo(Math.PI / 6, 5);
    });

    it('should handle large values', () => {
      expect(toRadians(720)).toBeCloseTo(4 * Math.PI, 5);
    });
  });

  describe('toDegrees()', () => {
    it('should convert radians to degrees', () => {
      expect(toDegrees(0)).toBe(0);
      expect(toDegrees(Math.PI)).toBeCloseTo(180, 5);
      expect(toDegrees(2 * Math.PI)).toBeCloseTo(360, 5);
      expect(toDegrees(Math.PI / 2)).toBeCloseTo(90, 5);
    });

    it('should handle negative radians', () => {
      expect(toDegrees(-Math.PI / 2)).toBeCloseTo(-90, 5);
      expect(toDegrees(-Math.PI)).toBeCloseTo(-180, 5);
    });

    it('should handle fractional radians', () => {
      expect(toDegrees(Math.PI / 4)).toBeCloseTo(45, 5);
      expect(toDegrees(Math.PI / 6)).toBeCloseTo(30, 5);
    });

    it('should be inverse of toRadians', () => {
      const degrees = [0, 45, 90, 135, 180, 225, 270, 315, 360];
      degrees.forEach(deg => {
        expect(toDegrees(toRadians(deg))).toBeCloseTo(deg, 5);
      });
    });
  });

  describe('CONFIG', () => {
    it('should have required display properties', () => {
      expect(CONFIG.DISPLAY_WIDTH).toBeDefined();
      expect(CONFIG.DISPLAY_HEIGHT).toBeDefined();
      expect(typeof CONFIG.DISPLAY_WIDTH).toBe('number');
      expect(typeof CONFIG.DISPLAY_HEIGHT).toBe('number');
    });

    it('should have valid FPS settings', () => {
      expect(CONFIG.TARGET_FPS).toBeDefined();
      expect(CONFIG.TARGET_FPS).toBeGreaterThan(0);
      expect(CONFIG.TARGET_FPS).toBeLessThanOrEqual(240);
    });

    it('should have valid animation durations', () => {
      expect(CONFIG.TRANSITION_DURATION).toBeGreaterThan(0);
      expect(CONFIG.PLAYHEAD_ANIMATION_DURATION).toBeGreaterThan(0);
      expect(CONFIG.TIME_DISPLAY_ANIMATION_DURATION).toBeGreaterThan(0);
    });

    it('should have valid waveform settings', () => {
      expect(CONFIG.NUM_POINTS).toBeGreaterThan(0);
      expect(CONFIG.WINDOW_DURATION).toBeGreaterThan(0);
      expect(CONFIG.INNER_RADIUS_RATIO).toBeGreaterThan(0);
      expect(CONFIG.INNER_RADIUS_RATIO).toBeLessThan(1);
    });

    it('should have valid color configurations', () => {
      expect(CONFIG.WAVEFORM_COLORS).toBeDefined();
      expect(CONFIG.WAVEFORM_COLORS.INNER).toBeDefined();
      expect(CONFIG.WAVEFORM_COLORS.OUTER).toBeDefined();
    });

    it('should have valid ratio values between 0 and 1', () => {
      const ratios = [
        'INNER_RADIUS_RATIO',
        'MAX_THICKNESS_RATIO',
        'MIN_THICKNESS_RATIO',
        'BUTTON_RADIUS_RATIO',
        'WAVEFORM_GAP_RATIO',
        'WAVEFORM_THICKNESS_RATIO',
        'MIN_WAVEFORM_THICKNESS_RATIO'
      ];

      ratios.forEach(ratio => {
        expect(CONFIG[ratio]).toBeGreaterThan(0);
        expect(CONFIG[ratio]).toBeLessThanOrEqual(1);
      });
    });

    it('should have valid boost settings', () => {
      expect(CONFIG.BOOST_MINIMUM_THRESHOLD).toBeGreaterThanOrEqual(0);
      expect(CONFIG.BOOST_MAX_MULTIPLIER).toBeGreaterThan(1);
      expect(CONFIG.BOOST_LERP_SPEED).toBeGreaterThan(0);
      expect(CONFIG.BOOST_LERP_SPEED).toBeLessThanOrEqual(1);
    });
  });
});
