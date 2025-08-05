import { CONFIG, easeInOutCubic, WAVEFORM_GRADIENT_COLORS } from "./utils.js";
import {
  downsample,
  getFullFileDownsampled,
  prepareWindowData,
} from "./waveform-data.js";

// Add this polyfill near the top of the file if roundRect is not supported
if (!CanvasRenderingContext2D.prototype.roundRect) {
  CanvasRenderingContext2D.prototype.roundRect = function (
    x,
    y,
    width,
    height,
    radius
  ) {
    this.beginPath();
    this.moveTo(x + radius, y);
    this.lineTo(x + width - radius, y);
    this.quadraticCurveTo(x + width, y, x + width, y + radius);
    this.lineTo(x + width, y + height - radius);
    this.quadraticCurveTo(
      x + width,
      y + height,
      x + width - radius,
      y + height
    );
    this.lineTo(x + radius, y + height);
    this.quadraticCurveTo(x, y + height, x, y + height - radius);
    this.lineTo(x, y + radius);
    this.quadraticCurveTo(x, y, x + radius, y);
  };
}

export function drawRadialWaveform(
  ctx,
  canvas,
  waveform,
  playhead,
  isPlaying,
  state
) {
  // IMPORTANT: Don't reset transform - use the device pixel ratio setup from canvas-setup.js
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  // Get device pixel ratio for proper coordinate calculations
  const dpr = window.devicePixelRatio || 1;
  
  // Calculate coordinates using CSS size, not internal canvas size
  const cssWidth = canvas.offsetWidth || (canvas.width / dpr);
  const cssHeight = canvas.offsetHeight || (canvas.height / dpr);
  const centerX = cssWidth / 2;
  const centerY = cssHeight / 2;
  const size = Math.min(cssWidth, cssHeight);
  
  // Calculate radii and thickness based on CSS size (not internal canvas size)
  const innerRadius = size * CONFIG.INNER_RADIUS_RATIO;
  const maxThickness = size * CONFIG.MAX_THICKNESS_RATIO;
  const minThickness = size * CONFIG.MIN_THICKNESS_RATIO;
  
  // Get waveform data using the original sophisticated system
  const { downsampled, maxAmp, numPoints } = getWaveformData(
    waveform,
    playhead,
    isPlaying,
    state
  );
  
  if (!downsampled || downsampled.length === 0) {
    console.warn('⚠️ No waveform data available for drawing');
    drawPlayPauseButton(ctx, centerX, centerY, innerRadius * 0.8, isPlaying);
    return;
  }

  // Create gradient for the waveform
  const gradient = createWaveformGradient(
    ctx,
    centerX,
    centerY,
    innerRadius,
    maxThickness,
    CONFIG.WAVEFORM_COLORS.INNER
  );
  
  // Use the beautiful gradient for the waveform
  ctx.fillStyle = gradient;
  
  // Draw the main waveform path with real data
  drawWaveformPath(
    ctx,
    downsampled, // Use real data now
    numPoints,
    centerX,
    centerY,
    innerRadius,
    maxThickness,
    minThickness,
    maxAmp || 1, // Ensure maxAmp is not 0
    state.animationProgress || 0,
    waveform,
    playhead,
    state
  );
  
  // Draw playhead indicator
  drawPlayhead(
    ctx,
    centerX,
    centerY,
    innerRadius,
    maxThickness,
    isPlaying,
    state.isDragging || false,
    state.animationProgress || 0,
    playhead
  );
  
  // Draw time display if needed
  if (state.audioBuffer && state.duration > 0) {
    const currentTime = playhead * state.duration;
    drawPlayheadTime(
      ctx,
      centerX,
      centerY,
      innerRadius,
      maxThickness,
      currentTime,
      state.duration,
      cssWidth
    );
  }
  
  // Draw play/pause button in center
  const buttonRadius = Math.min(cssWidth, cssHeight) * CONFIG.BUTTON_RADIUS_RATIO;
  drawPlayPauseButton(ctx, centerX, centerY, buttonRadius, isPlaying);
}

// ✅ IMPROVED: Consolidated animation state management to prevent memory leaks
class AnimationState {
  constructor() {
    this.reset();
  }

  reset() {
    // Playhead animation
    this.playheadAnimationProgress = 0;
    this.playheadAnimationStartTime = 0;
    this.playheadTargetVisibility = false;
    this.isPlayheadAnimatingFlag = false;
    
    // Time display animation
    this.timeDisplayAnimationProgress = 0;
    this.timeDisplayTargetVisibility = false;
    this.isTimeDisplayAnimating = false;
    
    // Boost animation
    this.currentBoostFactor = 1.0;
    this.targetBoostFactor = 1.0;
    
    // Gradient cache
    this.cachedGradient = null;
    this.lastGradientParams = null;
    
    console.log('🧹 Animation state reset - memory cleaned');
  }

  // ✅ NEW: Cleanup method to prevent memory leaks
  cleanup() {
    this.reset();
    
    // Clear any remaining references
    if (this.cachedGradient) {
      this.cachedGradient = null;
    }
    this.lastGradientParams = null;
  }
}

// ✅ IMPROVED: Single animation state instance instead of scattered variables
const animationState = new AnimationState();

// ✅ IMPROVED: Constants moved to prevent redefinition
const PLAYHEAD_ANIMATION_DURATION = CONFIG.PLAYHEAD_ANIMATION_DURATION;

function getWaveformData(waveform, playhead, isPlaying, state) {
  let downsampled,
    maxAmp,
    numPoints = CONFIG.NUM_POINTS;

  // ✅ TEMPORARY: Test with simple fallback data if missing
  if (!state || !state.audioBuffer || !waveform) {
    console.warn('⚠️ Missing waveform data - creating test pattern');
    
    // Create a simple test waveform pattern
    const testWaveform = new Array(numPoints).fill(0).map((_, i) => 
      Math.sin(i / numPoints * Math.PI * 8) * 0.5 + 0.5
    );
    
    return {
      downsampled: testWaveform,
      maxAmp: 1,
      numPoints,
    };
  }

  if (state.animationProgress > 0 || state.isTransitioning) {
    // ✅ FULL VIEW: No phantom padding - just the actual audio file
    const actualAudioData = state.audioBuffer.getChannelData(0);
    
    const fullFileDownsampled = getFullFileDownsampled(
      actualAudioData,
      numPoints
      // ✅ REMOVED: No sampleRate parameter since no phantom padding
    );

    // ✅ FOCUS/WINDOW VIEW: With phantom padding for smooth transitions at end
    const windowData = prepareWindowData(
      waveform,
      playhead,
      state.audioBuffer.duration,
      state.audioBuffer.sampleRate // ✅ PHANTOM: Only windowed view gets phantom padding
    );
    const windowDownsampled = downsample(windowData, numPoints);

    // Interpolate between full (no phantom) and window (with phantom)
    downsampled = fullFileDownsampled.map((fullVal, i) => {
      const windowVal = windowDownsampled[i] || 0;
      return (
        fullVal * (1 - state.animationProgress) +
        windowVal * state.animationProgress
      );
    });

    maxAmp = state.globalMaxAmp;
  } else if (
    !isPlaying &&
    (!state.currentPlayhead || state.currentPlayhead <= 0.001)
  ) {
    // ✅ FULL FILE VIEW: Show actual audio file without phantom padding
    const actualAudioData = state.audioBuffer.getChannelData(0);
    
    downsampled = getFullFileDownsampled(
      actualAudioData,
      numPoints
      // ✅ NO PHANTOM: Full view shows exact file length
    );
    maxAmp = state.globalMaxAmp;
  } else {
    // ✅ FOCUS VIEW: With phantom padding for smooth end-of-file behavior  
    const windowData = prepareWindowData(
      waveform,
      playhead,
      state.audioBuffer.duration,
      state.audioBuffer.sampleRate // ✅ PHANTOM: Focus view uses phantom padding
    );

    let rawDownsampled = downsample(windowData, numPoints);
    const rawMax = Math.max(...rawDownsampled);

    const ratio = rawMax / state.globalMaxAmp;

    const minimumThreshold = CONFIG.BOOST_MINIMUM_THRESHOLD;

    // ✅ IMPROVED: Use animation state for boost factors
    // Calculate new target boost factor
    const newBoostFactor =
      ratio < minimumThreshold && rawMax > 0
        ? minimumThreshold / Math.max(ratio, 0.01)
        : 1.0;

    // Only update target if there's a significant change
    if (
      Math.abs(newBoostFactor - animationState.targetBoostFactor) >
      CONFIG.BOOST_CHANGE_THRESHOLD
    ) {
      animationState.targetBoostFactor = Math.min(newBoostFactor, CONFIG.BOOST_MAX_MULTIPLIER);
    }

    const lerpSpeed = CONFIG.BOOST_LERP_SPEED;
    animationState.currentBoostFactor += (animationState.targetBoostFactor - animationState.currentBoostFactor) * lerpSpeed;

    // Apply the smoothed boost factor
    downsampled = rawDownsampled.map((amp) => {
      return Math.min(
        amp * animationState.currentBoostFactor,
        state.globalMaxAmp * CONFIG.BOOST_MAX_MULTIPLIER
      );
    });

    if (CONFIG.DEBUG_LOGGING && Math.abs(animationState.currentBoostFactor - 1.0) > 0.01) {
      console.log(
        `📈 Smooth Boost - Current: ${animationState.currentBoostFactor.toFixed(
          3
        )}, Target: ${animationState.targetBoostFactor.toFixed(3)}, Raw: ${rawMax.toFixed(6)}`
      );
    }

    maxAmp = state.globalMaxAmp;
  }

  return { downsampled, maxAmp, numPoints };
}

function createWaveformGradient(ctx, cx, cy, innerRadius, maxThickness, innerColor) {
  const outerRadius = innerRadius + maxThickness + 2; // Add 2 pixels
  const gradient = ctx.createRadialGradient(cx, cy, innerRadius, cx, cy, outerRadius);

  // Use the imported color stops
  WAVEFORM_GRADIENT_COLORS.forEach(({ stop, color }, idx) => {
    // Optionally override the inner color
    gradient.addColorStop(stop, idx === 0 ? innerColor : color);
  });

  return gradient;
}

function drawWaveformPath(
  ctx,
  downsampled,
  numPoints,
  cx,
  cy,
  innerRadius,
  maxThickness,
  minThickness,
  maxAmp,
  animationProgress,
  waveform,
  playhead,
  state
) {
  const playheadAngle = -Math.PI / 2;
  const waveformArcLength = Math.PI * 2;

  ctx.save();
  ctx.beginPath();

  // Draw outer edge
  for (let i = 0; i < numPoints; i++) {
    const t = i / (numPoints - 1);
    const angle = playheadAngle + t * waveformArcLength;

    const taperAmount =
      (1 - t * 0.95) * animationProgress + 1 * (1 - animationProgress);
    const thickness =
      maxThickness * taperAmount + minThickness * animationProgress;

    const amp = downsampled[i] || 0;
    const normalizedAmp = maxAmp > 0 ? amp / maxAmp : 0;
    const radius = innerRadius + normalizedAmp * thickness;

    const x = cx + radius * Math.cos(angle);
    const y = cy + radius * Math.sin(angle);

    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }

  // Draw inner edge (reverse)
  for (let i = numPoints - 1; i >= 0; i--) {
    const t = i / (numPoints - 1);
    const angle = playheadAngle + t * waveformArcLength;

    const x = cx + innerRadius * Math.cos(angle);
    const y = cy + innerRadius * Math.sin(angle);
    ctx.lineTo(x, y);
  }

  ctx.closePath();

  // Use the gradient that was passed in (restored original functionality)
  ctx.fill();

  // Apply depth shadow using the consolidated function
  applyWaveformShadow(
    ctx,
    cx,
    cy,
    downsampled,
    numPoints,
    innerRadius,
    maxThickness,
    minThickness,
    maxAmp,
    animationProgress
  );

  ctx.restore();
}

function applyWaveformShadow(
  ctx,
  cx,
  cy,
  downsampled,
  numPoints,
  innerRadius,
  maxThickness,
  minThickness,
  maxAmp,
  animationProgress
) {
  ctx.save();
  ctx.globalCompositeOperation = "multiply";

  // Create the shadow gradient using config values
  const shadowGradient = createShadowGradient(ctx, cx, cy);

  // Clip to waveform shape
  ctx.beginPath();
  drawWaveformClipPath(
    ctx,
    cx,
    cy,
    downsampled,
    numPoints,
    innerRadius,
    maxThickness,
    minThickness,
    maxAmp,
    animationProgress
  );
  ctx.clip();

  // Apply shadow to fill
  ctx.fillStyle = shadowGradient;
  ctx.fillRect(
    cx - innerRadius - maxThickness,
    cy - innerRadius - maxThickness,
    (innerRadius + maxThickness) * 2,
    (innerRadius + maxThickness) * 2
  );

  ctx.restore();
}

// Simplified shadow gradient creation
function createShadowGradient(ctx, cx, cy) {
  const gradient = ctx.createConicGradient(-Math.PI / 2, cx, cy);

  // Use config values for all shadow parameters
  const shadow = CONFIG.WAVEFORM_SHADOW;

  for (let i = 0; i <= 100; i++) {
    const t = i / 100;
    let darkness = 0; // 0 = no darkening, 1 = full darkening

    // Calculate shadow intensity based on position
    if (t >= shadow.START_ANGLE || t <= shadow.END_ANGLE) {
      darkness = calculateShadowIntensity(t, shadow);
    }

    // Convert darkness to RGB value (255 = no darkening, lower = darker)
    const grayValue = Math.round(255 - darkness * shadow.MAX_DARKENING);
    gradient.addColorStop(
      t,
      `rgba(${grayValue}, ${grayValue}, ${grayValue}, 1)`
    );
  }

  return gradient;
}

// Helper function to calculate shadow intensity with smooth transitions
function calculateShadowIntensity(t, shadowConfig) {
  const { START_ANGLE, DEEP_START_ANGLE, DEEPEST_ANGLE, END_ANGLE } =
    shadowConfig;

  let position;

  // Handle wraparound shadow that ends exactly at 12:00 (t = 0.0)
  if (t >= START_ANGLE) {
    // From start angle to end of circle (1.0)
    position = ((t - START_ANGLE) / (1.0 - START_ANGLE)) * 0.5;
  } else if (END_ANGLE === 0.0) {
    // Special case: shadow ends exactly at 12:00, so no shadow in early positions
    return 0;
  } else if (t <= END_ANGLE) {
    // From start of circle (0.0) to end angle
    position = 0.5 + (t / END_ANGLE) * 0.5;
  } else {
    return 0; // No shadow
  }

  // Create smooth shadow curve
  if (position <= 0.3) {
    // Gentle fade in
    return Math.pow(position / 0.3, 2) * 0.4;
  } else if (position <= 0.7) {
    // Peak shadow zone
    const peakProgress = (position - 0.3) / 0.4;
    return 0.4 + Math.sin(peakProgress * Math.PI) * 0.6;
  } else {
    // Gentle fade out - make this end more sharply at 12:00
    const fadeProgress = (position - 0.7) / 0.3;
    return 1.0 - Math.pow(fadeProgress, 1.5) * 1.0; // Steeper fade out
  }
}

// Helper function to draw waveform clip path (extracted to avoid duplication)
function drawWaveformClipPath(
  ctx,
  cx,
  cy,
  downsampled,
  numPoints,
  innerRadius,
  maxThickness,
  minThickness,
  maxAmp,
  animationProgress
) {
  const playheadAngle = -Math.PI / 2;
  const waveformArcLength = Math.PI * 2;

  // Draw outer edge
  for (let i = 0; i < numPoints; i++) {
    const t = i / (numPoints - 1);
    const angle = playheadAngle + t * waveformArcLength;

    const taperAmount =
      (1 - t * 0.95) * animationProgress + 1 * (1 - animationProgress);
    const thickness =
      maxThickness * taperAmount + minThickness * animationProgress;

    const amp = downsampled[i] || 0;
    const normalizedAmp = maxAmp > 0 ? amp / maxAmp : 0;
    const radius = innerRadius + normalizedAmp * thickness;

    const x = cx + radius * Math.cos(angle);
    const y = cy + radius * Math.sin(angle);

    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }

  // Draw inner edge
  for (let i = numPoints - 1; i >= 0; i--) {
    const t = i / (numPoints - 1);
    const angle = playheadAngle + t * waveformArcLength;

    const x = cx + innerRadius * Math.cos(angle);
    const y = cy + innerRadius * Math.sin(angle);
    ctx.lineTo(x, y);
  }

  ctx.closePath();
}

function drawPlayhead(
  ctx,
  cx,
  cy,
  innerRadius,
  maxThickness,
  isPlaying,
  isDragging,
  animationProgress,
  effectivePlayhead
) {
  // Enhanced visibility logic - show when playing OR dragging
  const shouldShowPlayhead = isPlaying || isDragging;

  // ✅ IMPROVED: Use animation state for all playhead animation variables
  // Detect visibility changes
  const now = performance.now();
  if (shouldShowPlayhead !== animationState.playheadTargetVisibility) {
    animationState.playheadTargetVisibility = shouldShowPlayhead;
    animationState.playheadAnimationStartTime = now;
    animationState.isPlayheadAnimatingFlag = true;

    // Also trigger time display animation
    animationState.timeDisplayTargetVisibility = shouldShowPlayhead;
    animationState.isTimeDisplayAnimating = true;

    console.log(`🎯 Playhead visibility changed: ${shouldShowPlayhead}`);
  }

  // Update playhead animation progress
  if (animationState.isPlayheadAnimatingFlag) {
    const elapsed = now - animationState.playheadAnimationStartTime;
    const rawProgress = Math.min(elapsed / PLAYHEAD_ANIMATION_DURATION, 1);

    if (animationState.playheadTargetVisibility) {
      animationState.playheadAnimationProgress = rawProgress;
    } else {
      animationState.playheadAnimationProgress = 1 - rawProgress;
    }

    if (rawProgress >= 1) {
      animationState.isPlayheadAnimatingFlag = false;
      animationState.playheadAnimationProgress = animationState.playheadTargetVisibility ? 1 : 0;
    }
  }

  // ✅ IMPROVED: Update time display animation progress using animation state
  if (animationState.isTimeDisplayAnimating) {
    const elapsed = now - animationState.playheadAnimationStartTime;
    const rawProgress = Math.min(
      elapsed / CONFIG.TIME_DISPLAY_ANIMATION_DURATION,
      1
    );

    if (animationState.timeDisplayTargetVisibility) {
      animationState.timeDisplayAnimationProgress = rawProgress;
    } else {
      animationState.timeDisplayAnimationProgress = 1 - rawProgress;
    }

    if (rawProgress >= 1) {
      animationState.isTimeDisplayAnimating = false;
      animationState.timeDisplayAnimationProgress = animationState.timeDisplayTargetVisibility ? 1 : 0;
    }
  }

  // Don't draw playhead if completely retracted
  if (animationState.playheadAnimationProgress <= 0) return;

  ctx.save();

  // Enhanced styling for drag state
  if (isDragging) {
    ctx.strokeStyle = "#00ffff"; // Brighter cyan when dragging
    ctx.lineWidth = 2; // Thicker line when dragging
    ctx.shadowColor = "#00ffff";
    ctx.shadowBlur = 4;
  } else {
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 2;
  }

  ctx.beginPath();

  // Apply easing
  const easedProgress = easeInOutCubic(animationState.playheadAnimationProgress);

  const playheadInnerRadius = innerRadius;
  const playheadOuterRadius = innerRadius + maxThickness * easedProgress;

  // Enhanced opacity for drag state
  const baseOpacity = isDragging ? 0.9 : 0.7;
  ctx.globalAlpha = Math.min(1, easedProgress * 1.2) * baseOpacity;

  ctx.moveTo(cx, cy - playheadInnerRadius);
  ctx.lineTo(cx, cy - playheadOuterRadius);
  ctx.stroke();
  ctx.restore();
}

// Add new function to draw the time display
function drawPlayheadTime(
  ctx,
  cx,
  cy,
  innerRadius,
  maxThickness,
  currentTime,
  duration,
  width // <-- add this parameter
) {
  // ✅ IMPROVED: Don't draw if time display animation is not active using animation state
  if (animationState.timeDisplayAnimationProgress <= 0) return;

  ctx.save();

  // Apply easing to time display animation
  const easedProgress = easeInOutCubic(animationState.timeDisplayAnimationProgress);

  // Format time
  const timeText = formatTime(currentTime);
  const durationText = formatTime(duration);
  const displayText = `${timeText} / ${durationText}`;

  // Position the time display above the waveform
  const timeY = cy - innerRadius - maxThickness - CONFIG.TIME_DISPLAY_OFFSET;

  // Set font and measure text
  ctx.font = `${Math.round(width * 0.018)}px monospace`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  const textMetrics = ctx.measureText(displayText);
  const textWidth = textMetrics.width;
  const textHeight = 20;

  // Draw background with animation
  ctx.globalAlpha = easedProgress * 0.8;
  ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
  ctx.roundRect(
    cx - textWidth / 2 - 8,
    timeY - textHeight / 2 - 4,
    textWidth + 16,
    textHeight + 8,
    4
  );
  ctx.fill();

  // Draw text with animation
  ctx.globalAlpha = easedProgress;
  ctx.fillStyle = "#fff";
  ctx.fillText(displayText, cx, timeY);

  ctx.restore();
}

// Add helper function to format time
function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

// ✅ IMPROVED: Export function to check if playhead is animating using animation state
export function isPlayheadAnimating() {
  return animationState.isPlayheadAnimatingFlag || animationState.isTimeDisplayAnimating;
}

// ✅ IMPROVED: Reset animation using centralized state management
export function resetPlayheadAnimation() {
  animationState.reset();
}

// ✅ NEW: Export cleanup function for proper memory management
export function cleanupAnimations() {
  animationState.cleanup();
}

export function drawPlayPauseButton(ctx, cx, cy, radius, isPlaying) {
  // radius is already calculated from canvas size!
  // All icon sizes use radius as a base

  ctx.save();

  // Draw circular button background
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, 2 * Math.PI);
  ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
  ctx.fill();
  ctx.strokeStyle = "#fff";
  ctx.lineWidth = 2;
  ctx.stroke();

  // Draw play or pause icon
  ctx.fillStyle = "#fff";
  if (isPlaying) {
    // Pause icon
    const barWidth = radius * 0.3;
    const barHeight = radius * 0.8;
    const spacing = radius * 0.2;
    ctx.fillRect(
      cx - spacing - barWidth / 2,
      cy - barHeight / 2,
      barWidth,
      barHeight
    );
    ctx.fillRect(
      cx + spacing - barWidth / 2,
      cy - barHeight / 2,
      barWidth,
      barHeight
    );
  } else {
    // Play icon
    const size = radius * 0.6;
    ctx.beginPath();
    ctx.moveTo(cx - size / 3, cy - size / 2);
    ctx.lineTo(cx - size / 3, cy + size / 2);
    ctx.lineTo(cx + (size * 2) / 3, cy);
    ctx.closePath();
    ctx.fill();
  }

  ctx.restore();
}

