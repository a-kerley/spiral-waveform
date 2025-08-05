// Global constants
import { TypeValidator, ensureType, ValidationError } from './validation.js';
import { system } from './logger.js';

export const CONFIG = {
  DISPLAY_WIDTH: 800,
  DISPLAY_HEIGHT: 800,
  TARGET_FPS: 120,
  TRANSITION_DURATION: 1000,
  NORMALIZATION_INTERVAL: 1000,
  WINDOW_DURATION: 30,
  NUM_POINTS: 1500, // Increase from 1000 to 3000 for smoother curves
  DEBUG_LOGGING: false,
  
  // Add these visual constants:
  INNER_RADIUS_RATIO: 0.15,
  MAX_THICKNESS_RATIO: 0.25,
  MIN_THICKNESS_RATIO: 0.008,
  BUTTON_RADIUS_RATIO: 0.12,
  WAVEFORM_GAP_RATIO: 0.03,
  WAVEFORM_THICKNESS_RATIO: 0.25,
  MIN_WAVEFORM_THICKNESS_RATIO: 0.008,
  
  // Boost animation settings
  BOOST_MINIMUM_THRESHOLD: 0.5,
  BOOST_MAX_MULTIPLIER: 2.0,
  BOOST_LERP_SPEED: 0.15, // How fast boost transitions happen (0.1 = slow, 0.3 = fast)
  BOOST_CHANGE_THRESHOLD: 0.1, // Minimum change needed to trigger new target
  
  // Animation constants
  PLAYHEAD_ANIMATION_DURATION: 200,
  TIME_DISPLAY_ANIMATION_DURATION: 200,
  
  // Waveform gradient darkening zones
  FADE_START_ANGLE: 0.68,
  FULL_DARK_START_ANGLE: 0.75,
  FULL_DARK_END_ANGLE: 0.917,
  FADE_END_ANGLE: 1.0,
  
  // Time display positioning
  TIME_DISPLAY_OFFSET: 30,
  TIME_DISPLAY_PADDING: 8,
  TIME_DISPLAY_HEIGHT: 20,
  
  // Waveform shadow configuration
  WAVEFORM_SHADOW: {
    START_ANGLE: 0.5,        // where shadow begins
    DEEP_START_ANGLE: 0.75,   // where deeper shadow starts
    DEEPEST_ANGLE: 0.99,      // deepest shadow point
    END_ANGLE: 0.0,           // shadow ends exactly at top
    MAX_DARKENING: 100,        // Maximum darkening amount (0-255)
  },
  
  // Waveform color configuration
  WAVEFORM_COLORS: {
    INNER: '#4fc3f7',
    OUTER: '#0277bd'
  },
  
  // Points to render for waveform
  POINTS_TO_RENDER: 1500,
};

// ✅ ENHANCED: Easing functions with type validation
export function easeInOutCubic(t) {
  // ✅ NEW: Validate input parameter
  const validatedT = ensureType(
    t, 
    (v) => TypeValidator.isNumber(v, { min: 0, max: 1 }), 
    0.5, 
    'easeInOutCubic parameter t'
  );
  
  return validatedT < 0.5 ? 4 * validatedT * validatedT * validatedT : (validatedT - 1) * (2 * validatedT - 2) * (2 * validatedT - 2) + 1;
}

// ✅ ENHANCED: Utility functions with comprehensive type validation
export function clamp(value, min, max) {
  // ✅ NEW: Validate all parameters
  const validatedValue = ensureType(
    value, 
    (v) => TypeValidator.isNumber(v, { allowInfinite: false }), 
    0, 
    'clamp value'
  );
  
  const validatedMin = ensureType(
    min, 
    (v) => TypeValidator.isNumber(v, { allowInfinite: false }), 
    -Infinity, 
    'clamp min'
  );
  
  const validatedMax = ensureType(
    max, 
    (v) => TypeValidator.isNumber(v, { allowInfinite: false }), 
    Infinity, 
    'clamp max'
  );
  
  // ✅ NEW: Validate that min <= max
  if (validatedMin > validatedMax) {
    system(`clamp: min (${validatedMin}) is greater than max (${validatedMax}), swapping`, 'warn');
    return Math.max(validatedMax, Math.min(validatedValue, validatedMin));
  }
  
  return Math.max(validatedMin, Math.min(validatedMax, validatedValue));
}

export function normalizeAngle(angle) {
  // ✅ NEW: Validate input parameter
  const validatedAngle = ensureType(
    angle, 
    (v) => TypeValidator.isNumber(v, { allowInfinite: false }), 
    0, 
    'normalizeAngle angle'
  );
  
  return (validatedAngle + Math.PI / 2 + 2 * Math.PI) % (2 * Math.PI);
}

// ✅ NEW: Additional utility functions with validation
export function lerp(a, b, t) {
  const validatedA = ensureType(a, (v) => TypeValidator.isNumber(v), 0, 'lerp start value');
  const validatedB = ensureType(b, (v) => TypeValidator.isNumber(v), 1, 'lerp end value');
  const validatedT = ensureType(t, (v) => TypeValidator.isNumber(v, { min: 0, max: 1 }), 0.5, 'lerp interpolation factor');
  
  return validatedA + (validatedB - validatedA) * validatedT;
}

export function mapRange(value, inMin, inMax, outMin, outMax) {
  const validatedValue = ensureType(value, (v) => TypeValidator.isNumber(v), 0, 'mapRange value');
  const validatedInMin = ensureType(inMin, (v) => TypeValidator.isNumber(v), 0, 'mapRange inMin');
  const validatedInMax = ensureType(inMax, (v) => TypeValidator.isNumber(v), 1, 'mapRange inMax');
  const validatedOutMin = ensureType(outMin, (v) => TypeValidator.isNumber(v), 0, 'mapRange outMin');
  const validatedOutMax = ensureType(outMax, (v) => TypeValidator.isNumber(v), 1, 'mapRange outMax');
  
  // ✅ NEW: Prevent division by zero
  const inputRange = validatedInMax - validatedInMin;
  if (Math.abs(inputRange) < Number.EPSILON) {
    system('mapRange: input range is zero, returning outMin', 'warn');
    return validatedOutMin;
  }
  
  return validatedOutMin + (validatedValue - validatedInMin) * (validatedOutMax - validatedOutMin) / inputRange;
}

export function toRadians(degrees) {
  const validatedDegrees = ensureType(degrees, (v) => TypeValidator.isNumber(v), 0, 'toRadians degrees');
  return validatedDegrees * Math.PI / 180;
}

export function toDegrees(radians) {
  const validatedRadians = ensureType(radians, (v) => TypeValidator.isNumber(v), 0, 'toDegrees radians');
  return validatedRadians * 180 / Math.PI;
}

export const COLORS = {
  WAVEFORM_GRADIENT: [
    "rgba(0, 255, 255, 0.8)",
    "rgba(0, 200, 255, 0.7)", 
    "rgba(0, 150, 255, 0.6)",
    "rgba(0, 100, 255, 0.4)"
  ],
  WAVEFORM_STROKE: "rgba(0, 255, 255, 0.3)",
  PLAYHEAD: "#fff",
  BUTTON_BACKGROUND: "rgba(0, 0, 0, 0.7)",
  BUTTON_BORDER: "#fff",
  TIME_BACKGROUND: "rgba(0, 0, 0, 0.7)",
  TIME_TEXT: "#fff"
};

export const WAVEFORM_GRADIENT_COLORS = [
  { stop: 0, color: "rgba(0,255,255,1)" },         // Inner cyan
  { stop: 0.15, color: "rgba(0,200,255,1)" },
  { stop: 0.5, color: "rgba(0, 66, 189, 1)" },
  { stop: 1, color: "rgba(0, 6, 111, 1)" }          // Outer orange
];
