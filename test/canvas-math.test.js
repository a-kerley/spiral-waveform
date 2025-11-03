/**
 * Unit tests for canvas-math.js
 * Testing CanvasCoordinates class and coordinate transformation functions
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  CanvasCoordinates,
  getCanvasCoordinates,
  toPolarCoordinates,
  calculateDistance,
  calculateAngle
} from '../js/canvas-math.js';
import { createMockCanvas } from './setup.js';

describe('canvas-math.js - CanvasCoordinates', () => {
  // Mock canvas setup
  let mockCanvas;

  beforeEach(() => {
    // Use helper from test setup to create proper HTMLCanvasElement mock
    mockCanvas = createMockCanvas(800, 800);
    mockCanvas.offsetWidth = 400;
    mockCanvas.offsetHeight = 400;
  });

  describe('toCanvasSpace()', () => {
    it('should convert client coordinates to canvas space', () => {
      const event = { clientX: 200, clientY: 200 };
      const result = CanvasCoordinates.toCanvasSpace(event, mockCanvas);
      
      expect(result.x).toBeDefined();
      expect(result.y).toBeDefined();
      expect(typeof result.x).toBe('number');
      expect(typeof result.y).toBe('number');
    });

    it('should account for canvas position', () => {
      const canvas = createMockCanvas(800, 800);
      canvas.offsetWidth = 400;
      canvas.offsetHeight = 400;
      canvas.getBoundingClientRect = () => ({
        left: 100,
        top: 50,
        width: 400,
        height: 400
      });
      
      const event = { clientX: 200, clientY: 150 };
      const result = CanvasCoordinates.toCanvasSpace(event, canvas);
      
      // (200 - 100) * (800 / 400) / 1 = 200
      expect(result.x).toBe(200);
      expect(result.y).toBe(200);
    });

    it('should handle device pixel ratio', () => {
      const originalDPR = window.devicePixelRatio;
      Object.defineProperty(window, 'devicePixelRatio', { value: 2, writable: true });
      
      const event = { clientX: 200, clientY: 200 };
      const result = CanvasCoordinates.toCanvasSpace(event, mockCanvas);
      
      expect(result).toBeDefined();
      
      // Restore
      Object.defineProperty(window, 'devicePixelRatio', { value: originalDPR, writable: true });
    });

    it('should throw for invalid canvas', () => {
      const event = { clientX: 100, clientY: 100 };
      expect(() => CanvasCoordinates.toCanvasSpace(event, null)).toThrow();
      expect(() => CanvasCoordinates.toCanvasSpace(event, {})).toThrow();
    });

    it('should throw for invalid event', () => {
      expect(() => CanvasCoordinates.toCanvasSpace(null, mockCanvas)).toThrow();
      expect(() => CanvasCoordinates.toCanvasSpace({}, mockCanvas)).toThrow();
      expect(() => CanvasCoordinates.toCanvasSpace({ clientX: 100 }, mockCanvas)).toThrow();
    });
  });

  describe('toPolar()', () => {
    it('should convert cartesian to polar coordinates', () => {
      const result = CanvasCoordinates.toPolar(100, 0, 0, 0);
      
      expect(result.angle).toBeDefined();
      expect(result.radius).toBeDefined();
      expect(result.radius).toBeCloseTo(100, 5);
    });

    it('should calculate radius correctly', () => {
      const result = CanvasCoordinates.toPolar(3, 4, 0, 0);
      expect(result.radius).toBeCloseTo(5, 5); // 3-4-5 triangle
    });

    it('should normalize angle to 0-2π range', () => {
      const result1 = CanvasCoordinates.toPolar(100, 0, 0, 0);
      const result2 = CanvasCoordinates.toPolar(0, 100, 0, 0);
      const result3 = CanvasCoordinates.toPolar(-100, 0, 0, 0);
      const result4 = CanvasCoordinates.toPolar(0, -100, 0, 0);
      
      expect(result1.angle).toBeGreaterThanOrEqual(0);
      expect(result1.angle).toBeLessThan(2 * Math.PI);
      expect(result2.angle).toBeGreaterThanOrEqual(0);
      expect(result2.angle).toBeLessThan(2 * Math.PI);
      expect(result3.angle).toBeGreaterThanOrEqual(0);
      expect(result3.angle).toBeLessThan(2 * Math.PI);
      expect(result4.angle).toBeGreaterThanOrEqual(0);
      expect(result4.angle).toBeLessThan(2 * Math.PI);
    });

    it('should handle point at center', () => {
      const result = CanvasCoordinates.toPolar(0, 0, 0, 0);
      expect(result.radius).toBe(0);
      expect(result.angle).toBeGreaterThanOrEqual(0);
    });

    it('should handle non-zero center', () => {
      const result = CanvasCoordinates.toPolar(150, 200, 50, 100);
      
      // Distance from (150, 200) to (50, 100)
      const expectedRadius = Math.sqrt((150 - 50) ** 2 + (200 - 100) ** 2);
      expect(result.radius).toBeCloseTo(expectedRadius, 5);
    });

    it('should throw for invalid coordinates', () => {
      expect(() => CanvasCoordinates.toPolar('100', 0, 0, 0)).toThrow();
      expect(() => CanvasCoordinates.toPolar(100, NaN, 0, 0)).toThrow();
      expect(() => CanvasCoordinates.toPolar(100, 0, null, 0)).toThrow();
    });
  });

  describe('toCartesian()', () => {
    it('should convert polar to cartesian coordinates', () => {
      const angle = 0; // Top (12 o'clock)
      const radius = 100;
      const result = CanvasCoordinates.toCartesian(angle, radius, 0, 0);
      
      expect(result.x).toBeDefined();
      expect(result.y).toBeDefined();
    });

    it('should be inverse of toPolar()', () => {
      const x = 100;
      const y = 50;
      const centerX = 200;
      const centerY = 200;
      
      const polar = CanvasCoordinates.toPolar(x, y, centerX, centerY);
      const cartesian = CanvasCoordinates.toCartesian(polar.angle, polar.radius, centerX, centerY);
      
      expect(cartesian.x).toBeCloseTo(x, 1);
      expect(cartesian.y).toBeCloseTo(y, 1);
    });

    it('should handle zero radius', () => {
      const result = CanvasCoordinates.toCartesian(Math.PI / 2, 0, 100, 100);
      expect(result.x).toBeCloseTo(100, 5);
      expect(result.y).toBeCloseTo(100, 5);
    });

    it('should handle full circle of angles', () => {
      const centerX = 200;
      const centerY = 200;
      const radius = 100;
      
      // Test at 0°, 90°, 180°, 270°
      const angles = [0, Math.PI / 2, Math.PI, 3 * Math.PI / 2];
      
      angles.forEach(angle => {
        const result = CanvasCoordinates.toCartesian(angle, radius, centerX, centerY);
        const distance = Math.sqrt((result.x - centerX) ** 2 + (result.y - centerY) ** 2);
        expect(distance).toBeCloseTo(radius, 1);
      });
    });

    it('should throw for invalid inputs', () => {
      expect(() => CanvasCoordinates.toCartesian('0', 100, 0, 0)).toThrow();
      expect(() => CanvasCoordinates.toCartesian(0, NaN, 0, 0)).toThrow();
      expect(() => CanvasCoordinates.toCartesian(0, 100, null, 0)).toThrow();
    });
  });

  describe('normalizeAngle()', () => {
    it('should normalize angles to 0-2π range', () => {
      expect(CanvasCoordinates.normalizeAngle(0)).toBe(0);
      expect(CanvasCoordinates.normalizeAngle(Math.PI)).toBeCloseTo(Math.PI, 5);
      expect(CanvasCoordinates.normalizeAngle(2 * Math.PI)).toBeCloseTo(0, 5);
    });

    it('should handle negative angles', () => {
      const result = CanvasCoordinates.normalizeAngle(-Math.PI / 2);
      expect(result).toBeGreaterThanOrEqual(0);
      expect(result).toBeLessThan(2 * Math.PI);
      expect(result).toBeCloseTo(3 * Math.PI / 2, 5);
    });

    it('should handle angles > 2π', () => {
      const result = CanvasCoordinates.normalizeAngle(3 * Math.PI);
      expect(result).toBeGreaterThanOrEqual(0);
      expect(result).toBeLessThan(2 * Math.PI);
      expect(result).toBeCloseTo(Math.PI, 5);
    });

    it('should handle very large angles', () => {
      const result = CanvasCoordinates.normalizeAngle(100 * Math.PI);
      expect(result).toBeGreaterThanOrEqual(0);
      expect(result).toBeLessThan(2 * Math.PI);
    });

    it('should throw for invalid angle', () => {
      expect(() => CanvasCoordinates.normalizeAngle('0')).toThrow();
      expect(() => CanvasCoordinates.normalizeAngle(null)).toThrow();
    });
  });

  describe('angleDelta()', () => {
    it('should calculate angular distance', () => {
      const delta = CanvasCoordinates.angleDelta(0, Math.PI / 2);
      expect(delta).toBeCloseTo(Math.PI / 2, 5);
    });

    it('should return shortest path', () => {
      // From 0 to 3π/2 - shortest path is -π/2
      const delta = CanvasCoordinates.angleDelta(0, 3 * Math.PI / 2);
      expect(delta).toBeCloseTo(-Math.PI / 2, 5);
    });

    it('should handle wrapping around 0/2π', () => {
      const delta = CanvasCoordinates.angleDelta(0.1, 2 * Math.PI - 0.1);
      expect(Math.abs(delta)).toBeLessThan(1);
    });

    it('should return 0 for same angles', () => {
      expect(CanvasCoordinates.angleDelta(Math.PI, Math.PI)).toBe(0);
    });

    it('should be in range -π to π', () => {
      const angles = [0, Math.PI / 4, Math.PI / 2, Math.PI, 3 * Math.PI / 2];
      
      angles.forEach(a1 => {
        angles.forEach(a2 => {
          const delta = CanvasCoordinates.angleDelta(a1, a2);
          expect(delta).toBeGreaterThanOrEqual(-Math.PI);
          expect(delta).toBeLessThanOrEqual(Math.PI);
        });
      });
    });

    it('should throw for invalid angles', () => {
      expect(() => CanvasCoordinates.angleDelta('0', Math.PI)).toThrow();
      expect(() => CanvasCoordinates.angleDelta(0, NaN)).toThrow();
    });
  });

  describe('distance()', () => {
    it('should calculate Euclidean distance', () => {
      expect(CanvasCoordinates.distance(0, 0, 3, 4)).toBeCloseTo(5, 5);
      expect(CanvasCoordinates.distance(0, 0, 0, 0)).toBe(0);
    });

    it('should handle negative coordinates', () => {
      expect(CanvasCoordinates.distance(-3, -4, 0, 0)).toBeCloseTo(5, 5);
      expect(CanvasCoordinates.distance(0, 0, -3, -4)).toBeCloseTo(5, 5);
    });

    it('should be commutative', () => {
      const d1 = CanvasCoordinates.distance(10, 20, 30, 40);
      const d2 = CanvasCoordinates.distance(30, 40, 10, 20);
      expect(d1).toBe(d2);
    });

    it('should handle fractional coordinates', () => {
      const distance = CanvasCoordinates.distance(0.5, 0.5, 1.5, 1.5);
      expect(distance).toBeCloseTo(Math.sqrt(2), 5);
    });

    it('should throw for invalid coordinates', () => {
      expect(() => CanvasCoordinates.distance('0', 0, 0, 0)).toThrow();
      expect(() => CanvasCoordinates.distance(0, NaN, 0, 0)).toThrow();
    });
  });

  describe('isPointInCircle()', () => {
    it('should detect point inside circle', () => {
      expect(CanvasCoordinates.isPointInCircle(5, 5, 0, 0, 10)).toBe(true);
      expect(CanvasCoordinates.isPointInCircle(0, 0, 0, 0, 10)).toBe(true);
    });

    it('should detect point outside circle', () => {
      expect(CanvasCoordinates.isPointInCircle(20, 20, 0, 0, 10)).toBe(false);
    });

    it('should include points on the boundary', () => {
      expect(CanvasCoordinates.isPointInCircle(10, 0, 0, 0, 10)).toBe(true);
      expect(CanvasCoordinates.isPointInCircle(0, 10, 0, 0, 10)).toBe(true);
    });

    it('should handle non-origin centers', () => {
      expect(CanvasCoordinates.isPointInCircle(105, 100, 100, 100, 10)).toBe(true);
      expect(CanvasCoordinates.isPointInCircle(120, 120, 100, 100, 10)).toBe(false);
    });
  });

  describe('isPointInRing()', () => {
    it('should detect point inside ring', () => {
      expect(CanvasCoordinates.isPointInRing(7, 0, 0, 0, 5, 10)).toBe(true);
    });

    it('should detect point outside ring (too close)', () => {
      expect(CanvasCoordinates.isPointInRing(3, 0, 0, 0, 5, 10)).toBe(false);
    });

    it('should detect point outside ring (too far)', () => {
      expect(CanvasCoordinates.isPointInRing(12, 0, 0, 0, 5, 10)).toBe(false);
    });

    it('should include points on boundaries', () => {
      expect(CanvasCoordinates.isPointInRing(5, 0, 0, 0, 5, 10)).toBe(true);
      expect(CanvasCoordinates.isPointInRing(10, 0, 0, 0, 5, 10)).toBe(true);
    });

    it('should handle non-origin centers', () => {
      expect(CanvasCoordinates.isPointInRing(107, 100, 100, 100, 5, 10)).toBe(true);
      expect(CanvasCoordinates.isPointInRing(103, 100, 100, 100, 5, 10)).toBe(false);
    });
  });

  describe('toDegrees()', () => {
    it('should convert radians to degrees', () => {
      expect(CanvasCoordinates.toDegrees(0)).toBe(0);
      expect(CanvasCoordinates.toDegrees(Math.PI)).toBeCloseTo(180, 5);
      expect(CanvasCoordinates.toDegrees(2 * Math.PI)).toBeCloseTo(360, 5);
      expect(CanvasCoordinates.toDegrees(Math.PI / 2)).toBeCloseTo(90, 5);
    });

    it('should handle negative radians', () => {
      expect(CanvasCoordinates.toDegrees(-Math.PI)).toBeCloseTo(-180, 5);
    });

    it('should throw for invalid input', () => {
      expect(() => CanvasCoordinates.toDegrees('0')).toThrow();
      expect(() => CanvasCoordinates.toDegrees(null)).toThrow();
    });
  });

  describe('toRadians()', () => {
    it('should convert degrees to radians', () => {
      expect(CanvasCoordinates.toRadians(0)).toBe(0);
      expect(CanvasCoordinates.toRadians(180)).toBeCloseTo(Math.PI, 5);
      expect(CanvasCoordinates.toRadians(360)).toBeCloseTo(2 * Math.PI, 5);
      expect(CanvasCoordinates.toRadians(90)).toBeCloseTo(Math.PI / 2, 5);
    });

    it('should handle negative degrees', () => {
      expect(CanvasCoordinates.toRadians(-180)).toBeCloseTo(-Math.PI, 5);
    });

    it('should be inverse of toDegrees()', () => {
      const degrees = [0, 45, 90, 135, 180, 225, 270, 315, 360];
      degrees.forEach(deg => {
        const radians = CanvasCoordinates.toRadians(deg);
        expect(CanvasCoordinates.toDegrees(radians)).toBeCloseTo(deg, 5);
      });
    });

    it('should throw for invalid input', () => {
      expect(() => CanvasCoordinates.toRadians('0')).toThrow();
      expect(() => CanvasCoordinates.toRadians(null)).toThrow();
    });
  });

  describe('getCenter()', () => {
    it('should return canvas center', () => {
      const result = CanvasCoordinates.getCenter(mockCanvas);
      expect(result.x).toBeCloseTo(200, 1); // offsetWidth / 2
      expect(result.y).toBeCloseTo(200, 1); // offsetHeight / 2
    });

    it('should handle canvas without offsetWidth/Height', () => {
      const canvas = createMockCanvas(800, 600);
      canvas.getBoundingClientRect = () => ({ left: 0, top: 0, width: 800, height: 600 });
      
      const result = CanvasCoordinates.getCenter(canvas);
      expect(result.x).toBeDefined();
      expect(result.y).toBeDefined();
    });

    it('should throw for invalid canvas', () => {
      expect(() => CanvasCoordinates.getCenter(null)).toThrow();
      expect(() => CanvasCoordinates.getCenter({})).toThrow();
    });
  });

  describe('getDimensions()', () => {
    it('should return canvas dimensions in CSS pixels', () => {
      const result = CanvasCoordinates.getDimensions(mockCanvas);
      expect(result.width).toBe(400);
      expect(result.height).toBe(400);
    });

    it('should handle canvas without offsetWidth/Height', () => {
      const canvas = createMockCanvas(800, 600);
      canvas.getBoundingClientRect = () => ({ left: 0, top: 0, width: 800, height: 600 });
      
      const result = CanvasCoordinates.getDimensions(canvas);
      expect(result.width).toBeDefined();
      expect(result.height).toBeDefined();
    });

    it('should throw for invalid canvas', () => {
      expect(() => CanvasCoordinates.getDimensions(null)).toThrow();
    });
  });

  describe('getMaxSquareSize()', () => {
    it('should return smallest dimension', () => {
      const canvas1 = createMockCanvas(800, 800);
      canvas1.offsetWidth = 400;
      canvas1.offsetHeight = 600;
      expect(CanvasCoordinates.getMaxSquareSize(canvas1)).toBe(400);
      
      const canvas2 = createMockCanvas(800, 800);
      canvas2.offsetWidth = 600;
      canvas2.offsetHeight = 400;
      expect(CanvasCoordinates.getMaxSquareSize(canvas2)).toBe(400);
    });

    it('should handle square canvas', () => {
      expect(CanvasCoordinates.getMaxSquareSize(mockCanvas)).toBe(400);
    });

    it('should throw for invalid canvas', () => {
      expect(() => CanvasCoordinates.getMaxSquareSize(null)).toThrow();
    });
  });
});

describe('canvas-math.js - Convenience Functions', () => {
  let mockCanvas;

  beforeEach(() => {
    mockCanvas = createMockCanvas(800, 800);
    mockCanvas.offsetWidth = 400;
    mockCanvas.offsetHeight = 400;
  });

  describe('getCanvasCoordinates()', () => {
    it('should call CanvasCoordinates.toCanvasSpace()', () => {
      const event = { clientX: 200, clientY: 200 };
      const result = getCanvasCoordinates(event, mockCanvas);
      expect(result).toBeDefined();
      expect(result.x).toBeDefined();
      expect(result.y).toBeDefined();
    });
  });

  describe('toPolarCoordinates()', () => {
    it('should call CanvasCoordinates.toPolar()', () => {
      const result = toPolarCoordinates(100, 100, 0, 0);
      expect(result).toBeDefined();
      expect(result.angle).toBeDefined();
      expect(result.radius).toBeDefined();
    });
  });

  describe('calculateDistance()', () => {
    it('should call CanvasCoordinates.distance()', () => {
      const result = calculateDistance(0, 0, 3, 4);
      expect(result).toBeCloseTo(5, 5);
    });
  });

  describe('calculateAngle()', () => {
    it('should return angle from toPolar()', () => {
      const result = calculateAngle(100, 0, 0, 0);
      expect(typeof result).toBe('number');
      expect(result).toBeGreaterThanOrEqual(0);
      expect(result).toBeLessThan(2 * Math.PI);
    });
  });
});
