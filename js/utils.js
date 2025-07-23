// Global constants
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
};

// Easing functions
export function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1;
}

// Utility functions
export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function normalizeAngle(angle) {
  return (angle + Math.PI / 2 + 2 * Math.PI) % (2 * Math.PI);
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
