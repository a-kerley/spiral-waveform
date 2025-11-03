/**
 * Application Constants
 * 
 * Centralized configuration and magic numbers with explanations.
 * All constants are grouped by functional area for easier maintenance.
 * 
 * @module constants
 */

/**
 * Canvas and Display Constants
 */
export const CANVAS_CONSTANTS = {
  // Default canvas dimensions (can be overridden by responsive sizing)
  DEFAULT_WIDTH: 800,
  DEFAULT_HEIGHT: 800,
  
  // Maximum canvas dimensions (prevent excessive memory usage)
  MAX_WIDTH: 8192,
  MAX_HEIGHT: 8192,
  
  // Minimum viable canvas size
  MIN_WIDTH: 100,
  MIN_HEIGHT: 100,
  
  // Canvas padding (matches CSS: 24px * 2 sides = 48px total)
  PADDING_PX: 24,
  TOTAL_PADDING_PX: 48,
};

/**
 * Performance Constants
 */
export const PERFORMANCE_CONSTANTS = {
  // Target frame rate for animation loop
  TARGET_FPS: 120,
  
  // Frame interval in milliseconds (1000ms / TARGET_FPS)
  FRAME_INTERVAL_MS: 1000 / 120, // ~8.33ms
  
  // Touch event throttle (~60fps for touch handling)
  TOUCH_THROTTLE_MS: 16,
  
  // Window resize debounce delay
  RESIZE_DEBOUNCE_MS: 150,
  
  // Minimum resize threshold (pixels) to trigger redraw
  MIN_RESIZE_THRESHOLD_PX: 50,
};

/**
 * Audio Processing Constants
 */
export const AUDIO_CONSTANTS = {
  // Maximum audio file size (500MB)
  MAX_FILE_SIZE_BYTES: 500 * 1024 * 1024,
  MAX_FILE_SIZE_MB: 500,
  
  // Audio duration limits
  MIN_DURATION_SEC: 0.1,
  MAX_DURATION_SEC: 7200, // 2 hours
  
  // Default sample rate
  DEFAULT_SAMPLE_RATE: 44100,
  
  // Waveform data points for visualization
  NUM_POINTS: 1500, // Balance between smoothness and performance
  POINTS_TO_RENDER: 1500,
  
  // Window duration for focused view (seconds)
  WINDOW_DURATION_SEC: 30,
  
  // Phantom padding for end-of-file scrolling
  PHANTOM_PADDING_SEC: 30,
  
  // Normalization interval (ms)
  NORMALIZATION_INTERVAL_MS: 1000,
};

/**
 * Visual Layout Constants (Ratios relative to canvas size)
 */
export const LAYOUT_CONSTANTS = {
  // Center button (play/pause)
  BUTTON_RADIUS_RATIO: 0.12, // 12% of canvas size
  
  // Waveform ring dimensions
  INNER_RADIUS_RATIO: 0.15, // 15% - inner edge of waveform
  WAVEFORM_GAP_RATIO: 0.03, // 3% - gap between button and waveform
  MAX_THICKNESS_RATIO: 0.25, // 25% - maximum waveform thickness
  MIN_THICKNESS_RATIO: 0.008, // 0.8% - minimum waveform thickness
  WAVEFORM_THICKNESS_RATIO: 0.25, // Alternate name for consistency
  MIN_WAVEFORM_THICKNESS_RATIO: 0.008,
};

/**
 * Animation Constants
 */
export const ANIMATION_CONSTANTS = {
  // Transition duration between views (ms)
  TRANSITION_DURATION_MS: 1000,
  
  // Playhead fade in/out animation (ms)
  PLAYHEAD_ANIMATION_DURATION_MS: 200,
  
  // Time display fade animation (ms)
  TIME_DISPLAY_ANIMATION_DURATION_MS: 200,
  
  // Boost animation settings
  BOOST_MINIMUM_THRESHOLD: 0.5, // Minimum amplitude to trigger boost
  BOOST_MAX_MULTIPLIER: 2.0, // Maximum boost amplification
  BOOST_LERP_SPEED: 0.15, // Animation speed (0.1=slow, 0.3=fast)
  BOOST_CHANGE_THRESHOLD: 0.1, // Minimum change to trigger new animation
};

/**
 * Waveform Gradient Constants
 * Angles are normalized (0-1 range, 0=top, clockwise)
 */
export const GRADIENT_CONSTANTS = {
  // Fade zones for darkening effect
  FADE_START_ANGLE: 0.68, // ~245° - Start gradual darkening
  FULL_DARK_START_ANGLE: 0.75, // ~270° - Begin full shadow
  FULL_DARK_END_ANGLE: 0.917, // ~330° - End full shadow
  FADE_END_ANGLE: 1.0, // ~360° - Return to full brightness
  
  // Shadow configuration
  SHADOW_START_ANGLE: 0.5, // Where shadow begins
  SHADOW_DEEP_START_ANGLE: 0.75, // Where deeper shadow starts
  SHADOW_DEEPEST_ANGLE: 0.99, // Deepest shadow point
  SHADOW_END_ANGLE: 0.0, // Shadow ends at top
  SHADOW_MAX_DARKENING: 100, // Maximum darkening (0-255)
};

/**
 * Time Display Constants
 */
export const TIME_DISPLAY_CONSTANTS = {
  // Positioning offset from waveform (pixels)
  OFFSET_PX: 30,
  
  // Padding inside time display box (pixels)
  PADDING_PX: 8,
  
  // Height of time display box (pixels)
  HEIGHT_PX: 20,
};

/**
 * Interaction Constants
 */
export const INTERACTION_CONSTANTS = {
  // Tap detection thresholds
  TAP_MAX_DURATION_MS: 300, // Maximum time for tap (not drag)
  TAP_MAX_DISTANCE_PX: 10, // Maximum movement for tap
  
  // Seek constants
  SEEK_STEP_SEC: 5, // Seconds to skip with arrow keys
};

/**
 * Color Theme
 */
export const COLOR_THEME = {
  // Background colors
  BACKGROUND: '#111',
  BACKGROUND_RGB: 'rgb(17, 17, 17)',
  
  // Text colors
  TEXT_PRIMARY: '#eee',
  TEXT_SECONDARY: '#999',
  TEXT_DIM: '#666',
  
  // Waveform colors
  WAVEFORM_INNER: '#4fc3f7',
  WAVEFORM_OUTER: '#0277bd',
  WAVEFORM_INNER_RGB: 'rgb(79, 195, 247)',
  WAVEFORM_OUTER_RGB: 'rgb(2, 119, 189)',
  
  // UI element colors
  BUTTON_BG: '#333',
  BUTTON_HOVER: '#444',
  BUTTON_BORDER: '#555',
  
  // Status colors
  ERROR: '#f44336',
  ERROR_RGB: 'rgb(244, 67, 54)',
  SUCCESS: '#4caf50',
  SUCCESS_RGB: 'rgb(76, 175, 80)',
  WARNING: '#ff9800',
  WARNING_RGB: 'rgb(255, 152, 0)',
  INFO: '#2196f3',
  INFO_RGB: 'rgb(33, 150, 243)',
};

/**
 * Logging Constants
 */
export const LOGGING_CONSTANTS = {
  // Maximum log buffer size
  MAX_LOG_BUFFER: 1000,
  
  // Log levels (in order of severity)
  LEVELS: {
    DEBUG: 0,
    INFO: 1,
    WARN: 2,
    ERROR: 3,
  },
  
  // Enable logging in development
  ENABLE_DEBUG_LOGGING: false, // Toggle via URL param or environment
};

/**
 * Validation Constants
 */
export const VALIDATION_CONSTANTS = {
  // Enable comprehensive validation (disable in production for performance)
  ENABLE_VALIDATION: true, // Can be overridden by environment
  
  // Validation strictness levels
  STRICT_MODE: true, // Throw errors vs. log warnings
};

/**
 * Legacy CONFIG object for backward compatibility
 * @deprecated Use specific constant groups instead
 */
export const CONFIG = {
  DISPLAY_WIDTH: CANVAS_CONSTANTS.DEFAULT_WIDTH,
  DISPLAY_HEIGHT: CANVAS_CONSTANTS.DEFAULT_HEIGHT,
  TARGET_FPS: PERFORMANCE_CONSTANTS.TARGET_FPS,
  TRANSITION_DURATION: ANIMATION_CONSTANTS.TRANSITION_DURATION_MS,
  NORMALIZATION_INTERVAL: AUDIO_CONSTANTS.NORMALIZATION_INTERVAL_MS,
  WINDOW_DURATION: AUDIO_CONSTANTS.WINDOW_DURATION_SEC,
  NUM_POINTS: AUDIO_CONSTANTS.NUM_POINTS,
  DEBUG_LOGGING: LOGGING_CONSTANTS.ENABLE_DEBUG_LOGGING,
  
  INNER_RADIUS_RATIO: LAYOUT_CONSTANTS.INNER_RADIUS_RATIO,
  MAX_THICKNESS_RATIO: LAYOUT_CONSTANTS.MAX_THICKNESS_RATIO,
  MIN_THICKNESS_RATIO: LAYOUT_CONSTANTS.MIN_THICKNESS_RATIO,
  BUTTON_RADIUS_RATIO: LAYOUT_CONSTANTS.BUTTON_RADIUS_RATIO,
  WAVEFORM_GAP_RATIO: LAYOUT_CONSTANTS.WAVEFORM_GAP_RATIO,
  WAVEFORM_THICKNESS_RATIO: LAYOUT_CONSTANTS.WAVEFORM_THICKNESS_RATIO,
  MIN_WAVEFORM_THICKNESS_RATIO: LAYOUT_CONSTANTS.MIN_WAVEFORM_THICKNESS_RATIO,
  
  BOOST_MINIMUM_THRESHOLD: ANIMATION_CONSTANTS.BOOST_MINIMUM_THRESHOLD,
  BOOST_MAX_MULTIPLIER: ANIMATION_CONSTANTS.BOOST_MAX_MULTIPLIER,
  BOOST_LERP_SPEED: ANIMATION_CONSTANTS.BOOST_LERP_SPEED,
  BOOST_CHANGE_THRESHOLD: ANIMATION_CONSTANTS.BOOST_CHANGE_THRESHOLD,
  
  PLAYHEAD_ANIMATION_DURATION: ANIMATION_CONSTANTS.PLAYHEAD_ANIMATION_DURATION_MS,
  TIME_DISPLAY_ANIMATION_DURATION: ANIMATION_CONSTANTS.TIME_DISPLAY_ANIMATION_DURATION_MS,
  
  FADE_START_ANGLE: GRADIENT_CONSTANTS.FADE_START_ANGLE,
  FULL_DARK_START_ANGLE: GRADIENT_CONSTANTS.FULL_DARK_START_ANGLE,
  FULL_DARK_END_ANGLE: GRADIENT_CONSTANTS.FULL_DARK_END_ANGLE,
  FADE_END_ANGLE: GRADIENT_CONSTANTS.FADE_END_ANGLE,
  
  TIME_DISPLAY_OFFSET: TIME_DISPLAY_CONSTANTS.OFFSET_PX,
  TIME_DISPLAY_PADDING: TIME_DISPLAY_CONSTANTS.PADDING_PX,
  TIME_DISPLAY_HEIGHT: TIME_DISPLAY_CONSTANTS.HEIGHT_PX,
  
  WAVEFORM_SHADOW: {
    START_ANGLE: GRADIENT_CONSTANTS.SHADOW_START_ANGLE,
    DEEP_START_ANGLE: GRADIENT_CONSTANTS.SHADOW_DEEP_START_ANGLE,
    DEEPEST_ANGLE: GRADIENT_CONSTANTS.SHADOW_DEEPEST_ANGLE,
    END_ANGLE: GRADIENT_CONSTANTS.SHADOW_END_ANGLE,
    MAX_DARKENING: GRADIENT_CONSTANTS.SHADOW_MAX_DARKENING,
  },
  
  WAVEFORM_COLORS: {
    INNER: COLOR_THEME.WAVEFORM_INNER,
    OUTER: COLOR_THEME.WAVEFORM_OUTER,
  },
  
  POINTS_TO_RENDER: AUDIO_CONSTANTS.POINTS_TO_RENDER,
  
  // Interaction constants
  TAP_MAX_DURATION: INTERACTION_CONSTANTS.TAP_MAX_DURATION_MS,
  TAP_MAX_DISTANCE: INTERACTION_CONSTANTS.TAP_MAX_DISTANCE_PX,
};

/**
 * Get a constant value with validation
 * @param {object} group - Constant group object
 * @param {string} key - Constant key
 * @param {*} defaultValue - Default value if not found
 * @returns {*} Constant value
 */
export function getConstant(group, key, defaultValue = null) {
  if (!group || typeof group !== 'object') {
    console.warn(`Invalid constant group: ${group}`);
    return defaultValue;
  }
  
  if (!(key in group)) {
    console.warn(`Constant not found: ${key} in group`);
    return defaultValue;
  }
  
  return group[key];
}

/**
 * Validate that all constants are within reasonable ranges
 * Useful for catching configuration errors
 * @returns {Array<string>} Array of validation errors (empty if all valid)
 */
export function validateConstants() {
  const errors = [];
  
  // Canvas validations
  if (CANVAS_CONSTANTS.MAX_WIDTH > 16384) {
    errors.push('Canvas MAX_WIDTH exceeds browser limits');
  }
  
  // Performance validations
  if (PERFORMANCE_CONSTANTS.TARGET_FPS > 240) {
    errors.push('TARGET_FPS unreasonably high (>240)');
  }
  
  // Audio validations
  if (AUDIO_CONSTANTS.NUM_POINTS < 100 || AUDIO_CONSTANTS.NUM_POINTS > 10000) {
    errors.push('NUM_POINTS outside reasonable range (100-10000)');
  }
  
  // Layout validations
  if (LAYOUT_CONSTANTS.BUTTON_RADIUS_RATIO > 0.5) {
    errors.push('BUTTON_RADIUS_RATIO too large (>0.5)');
  }
  
  // Color validations
  const colorRegex = /^#[0-9A-Fa-f]{3,8}$/;
  Object.entries(COLOR_THEME).forEach(([key, value]) => {
    if (typeof value === 'string' && value.startsWith('#') && !colorRegex.test(value)) {
      errors.push(`Invalid color format: ${key} = ${value}`);
    }
  });
  
  return errors;
}

// Run validation in development
if (typeof process === 'undefined' || process.env.NODE_ENV !== 'production') {
  const validationErrors = validateConstants();
  if (validationErrors.length > 0) {
    console.warn('⚠️ Constant validation errors:', validationErrors);
  }
}
