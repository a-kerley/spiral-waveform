/**
 * Canvas Math Utilities
 * 
 * Shared mathematical operations for canvas coordinate transformations,
 * polar/cartesian conversions, and geometric calculations.
 * 
 * @module canvas-math
 */

import { TypeValidator, ValidationError } from './validation.js';
import { TrigCache, sinRad, cosRad } from './trig-cache.js';

/**
 * Canvas coordinate transformation and geometry utilities
 */
export class CanvasCoordinates {
  /**
   * Convert client coordinates (mouse/touch) to canvas coordinates
   * Takes into account canvas scaling, device pixel ratio, and CSS transforms
   * 
   * @param {MouseEvent|Touch} event - Mouse or touch event
   * @param {HTMLCanvasElement} canvas - Canvas element
   * @returns {{x: number, y: number}} Canvas coordinates
   */
  static toCanvasSpace(event, canvas) {
    if (!TypeValidator.isHTMLElement(canvas, 'canvas')) {
      throw new ValidationError('Invalid canvas element', 'canvas', canvas, 'HTMLCanvasElement');
    }

    if (!event || typeof event.clientX !== 'number' || typeof event.clientY !== 'number') {
      throw new ValidationError('Invalid event coordinates', 'event', event, 'Event with clientX/clientY');
    }

    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    return {
      x: (event.clientX - rect.left) * (canvas.width / rect.width) / dpr,
      y: (event.clientY - rect.top) * (canvas.height / rect.height) / dpr
    };
  }

  /**
   * Convert canvas coordinates to polar coordinates (angle and radius)
   * relative to a center point
   * 
   * @param {number} x - X coordinate in canvas space
   * @param {number} y - Y coordinate in canvas space
   * @param {number} centerX - Center X coordinate
   * @param {number} centerY - Center Y coordinate
   * @returns {{angle: number, radius: number}} Polar coordinates (angle in radians 0-2π, radius in pixels)
   */
  static toPolar(x, y, centerX, centerY) {
    if (!TypeValidator.isNumber(x) || !TypeValidator.isNumber(y)) {
      throw new ValidationError('Invalid coordinates', 'x,y', {x, y}, 'numbers');
    }

    if (!TypeValidator.isNumber(centerX) || !TypeValidator.isNumber(centerY)) {
      throw new ValidationError('Invalid center coordinates', 'centerX,centerY', {centerX, centerY}, 'numbers');
    }

    // Calculate distance from center
    const radius = Math.sqrt((x - centerX) ** 2 + (y - centerY) ** 2);

    // Calculate raw angle from mouse position (-π to π)
    const rawAngle = Math.atan2(y - centerY, x - centerX);

    // Convert to normalized angle (0 to 2π) starting from top (12 o'clock)
    // Subtract π/2 to start from top, then invert direction for clockwise = forward
    const angle = (-rawAngle + Math.PI / 2 + Math.PI * 2) % (Math.PI * 2);

    return { angle, radius };
  }

  /**
   * Convert polar coordinates to cartesian coordinates
   * 
   * @param {number} angle - Angle in radians (0 = top, clockwise positive)
   * @param {number} radius - Distance from center
   * @param {number} centerX - Center X coordinate
   * @param {number} centerY - Center Y coordinate
   * @returns {{x: number, y: number}} Cartesian coordinates
   */
  static toCartesian(angle, radius, centerX, centerY) {
    if (!TypeValidator.isNumber(angle) || !TypeValidator.isNumber(radius)) {
      throw new ValidationError('Invalid polar coordinates', 'angle,radius', {angle, radius}, 'numbers');
    }

    if (!TypeValidator.isNumber(centerX) || !TypeValidator.isNumber(centerY)) {
      throw new ValidationError('Invalid center coordinates', 'centerX,centerY', {centerX, centerY}, 'numbers');
    }

    // Convert our normalized angle (0 = top, clockwise) back to standard coordinates
    const standardAngle = -angle + Math.PI / 2;

    // Use cached trig functions for better performance
    return {
      x: centerX + radius * cosRad(standardAngle),
      y: centerY + radius * sinRad(standardAngle)
    };
  }

  /**
   * Normalize angle to 0-2π range
   * 
   * @param {number} angle - Angle in radians
   * @returns {number} Normalized angle in range [0, 2π]
   */
  static normalizeAngle(angle) {
    if (!TypeValidator.isNumber(angle)) {
      throw new ValidationError('Invalid angle', 'angle', angle, 'number');
    }

    return ((angle % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
  }

  /**
   * Calculate the shortest angular distance between two angles
   * Accounts for wrapping around 2π
   * 
   * @param {number} angle1 - First angle in radians
   * @param {number} angle2 - Second angle in radians
   * @returns {number} Angular distance in radians (-π to π)
   */
  static angleDelta(angle1, angle2) {
    if (!TypeValidator.isNumber(angle1) || !TypeValidator.isNumber(angle2)) {
      throw new ValidationError('Invalid angles', 'angle1,angle2', {angle1, angle2}, 'numbers');
    }

    let delta = angle2 - angle1;

    // Normalize to shortest path
    if (delta > Math.PI) {
      delta -= 2 * Math.PI;
    } else if (delta < -Math.PI) {
      delta += 2 * Math.PI;
    }

    return delta;
  }

  /**
   * Calculate Euclidean distance between two points
   * 
   * @param {number} x1 - First point X
   * @param {number} y1 - First point Y
   * @param {number} x2 - Second point X
   * @param {number} y2 - Second point Y
   * @returns {number} Distance in pixels
   */
  static distance(x1, y1, x2, y2) {
    if (!TypeValidator.isNumber(x1) || !TypeValidator.isNumber(y1) ||
        !TypeValidator.isNumber(x2) || !TypeValidator.isNumber(y2)) {
      throw new ValidationError('Invalid coordinates', 'x1,y1,x2,y2', {x1, y1, x2, y2}, 'numbers');
    }

    return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
  }

  /**
   * Check if a point is within a circular region
   * 
   * @param {number} x - Point X coordinate
   * @param {number} y - Point Y coordinate
   * @param {number} centerX - Circle center X
   * @param {number} centerY - Circle center Y
   * @param {number} radius - Circle radius
   * @returns {boolean} True if point is inside circle
   */
  static isPointInCircle(x, y, centerX, centerY, radius) {
    const dist = this.distance(x, y, centerX, centerY);
    return dist <= radius;
  }

  /**
   * Check if a point is within a ring/annulus (donut shape)
   * 
   * @param {number} x - Point X coordinate
   * @param {number} y - Point Y coordinate
   * @param {number} centerX - Ring center X
   * @param {number} centerY - Ring center Y
   * @param {number} innerRadius - Inner radius
   * @param {number} outerRadius - Outer radius
   * @returns {boolean} True if point is inside ring
   */
  static isPointInRing(x, y, centerX, centerY, innerRadius, outerRadius) {
    const dist = this.distance(x, y, centerX, centerY);
    return dist >= innerRadius && dist <= outerRadius;
  }

  /**
   * Convert angle in radians to degrees
   * 
   * @param {number} radians - Angle in radians
   * @returns {number} Angle in degrees
   */
  static toDegrees(radians) {
    if (!TypeValidator.isNumber(radians)) {
      throw new ValidationError('Invalid angle', 'radians', radians, 'number');
    }

    return radians * 180 / Math.PI;
  }

  /**
   * Convert angle in degrees to radians
   * 
   * @param {number} degrees - Angle in degrees
   * @returns {number} Angle in radians
   */
  static toRadians(degrees) {
    if (!TypeValidator.isNumber(degrees)) {
      throw new ValidationError('Invalid angle', 'degrees', degrees, 'number');
    }

    return degrees * Math.PI / 180;
  }

  /**
   * Get canvas center point
   * 
   * @param {HTMLCanvasElement} canvas - Canvas element
   * @returns {{x: number, y: number}} Center coordinates
   */
  static getCenter(canvas) {
    if (!TypeValidator.isHTMLElement(canvas, 'canvas')) {
      throw new ValidationError('Invalid canvas element', 'canvas', canvas, 'HTMLCanvasElement');
    }

    const dpr = window.devicePixelRatio || 1;
    const cssWidth = canvas.offsetWidth || (canvas.width / dpr);
    const cssHeight = canvas.offsetHeight || (canvas.height / dpr);

    return {
      x: cssWidth / 2,
      y: cssHeight / 2
    };
  }

  /**
   * Get canvas dimensions in CSS pixels (not internal canvas size)
   * 
   * @param {HTMLCanvasElement} canvas - Canvas element
   * @returns {{width: number, height: number}} Canvas dimensions in CSS pixels
   */
  static getDimensions(canvas) {
    if (!TypeValidator.isHTMLElement(canvas, 'canvas')) {
      throw new ValidationError('Invalid canvas element', 'canvas', canvas, 'HTMLCanvasElement');
    }

    const dpr = window.devicePixelRatio || 1;

    return {
      width: canvas.offsetWidth || (canvas.width / dpr),
      height: canvas.offsetHeight || (canvas.height / dpr)
    };
  }

  /**
   * Calculate the size of a square that fits within the canvas
   * 
   * @param {HTMLCanvasElement} canvas - Canvas element
   * @returns {number} Size of largest square that fits
   */
  static getMaxSquareSize(canvas) {
    const { width, height } = this.getDimensions(canvas);
    return Math.min(width, height);
  }
}

/**
 * Convenience function: Convert event coordinates to canvas space
 * @param {MouseEvent|Touch} event - Event with clientX/clientY
 * @param {HTMLCanvasElement} canvas - Canvas element
 * @returns {{x: number, y: number}} Canvas coordinates
 */
export function getCanvasCoordinates(event, canvas) {
  return CanvasCoordinates.toCanvasSpace(event, canvas);
}

/**
 * Convenience function: Convert to polar coordinates from center
 * @param {number} x - X coordinate
 * @param {number} y - Y coordinate
 * @param {number} centerX - Center X
 * @param {number} centerY - Center Y
 * @returns {{angle: number, radius: number}} Polar coordinates
 */
export function toPolarCoordinates(x, y, centerX, centerY) {
  return CanvasCoordinates.toPolar(x, y, centerX, centerY);
}

/**
 * Convenience function: Calculate distance between two points
 * @param {number} x1 - First point X
 * @param {number} y1 - First point Y
 * @param {number} x2 - Second point X
 * @param {number} y2 - Second point Y
 * @returns {number} Distance
 */
export function calculateDistance(x1, y1, x2, y2) {
  return CanvasCoordinates.distance(x1, y1, x2, y2);
}

/**
 * Convenience function: Calculate angle from point to center
 * @param {number} x - Point X
 * @param {number} y - Point Y
 * @param {number} centerX - Center X
 * @param {number} centerY - Center Y
 * @returns {number} Angle in radians (0-2π, 0 = top, clockwise positive)
 */
export function calculateAngle(x, y, centerX, centerY) {
  return CanvasCoordinates.toPolar(x, y, centerX, centerY).angle;
}
