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
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const dpr = window.devicePixelRatio || 1;
  ctx.scale(dpr, dpr);

  // Add better anti-aliasing settings
  ctx.imageSmoothingEnabled = false;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const width = canvas.width / dpr;
  const height = canvas.height / dpr;
  const cx = width / 2;
  const cy = height / 2;

  // Calculate dimensions - shrink everything down, then expand waveform height
  const buttonRadius = Math.min(width, height) * CONFIG.BUTTON_RADIUS_RATIO;
  const waveformInnerRadius =
    buttonRadius + Math.min(width, height) * CONFIG.WAVEFORM_GAP_RATIO;
  const maxWaveformThickness =
    Math.min(width, height) * CONFIG.WAVEFORM_THICKNESS_RATIO;
  const minWaveformThickness =
    Math.min(width, height) * CONFIG.MIN_WAVEFORM_THICKNESS_RATIO;

  // Get waveform data based on current state
  const { downsampled, maxAmp, numPoints } = getWaveformData(
    waveform,
    playhead,
    isPlaying,
    state
  );

  // Draw waveform
  drawWaveformPath(
    ctx,
    downsampled,
    numPoints,
    cx,
    cy,
    waveformInnerRadius,
    maxWaveformThickness,
    minWaveformThickness,
    maxAmp,
    state.animationProgress,
    waveform,
    playhead,
    state
  );

  // Use drag position for visual feedback during dragging
  let effectivePlayhead = playhead;
  if (state.isDragging && state.dragCurrentPosition !== undefined) {
    effectivePlayhead = state.dragCurrentPosition;
  }

  // Draw playhead (pass effectivePlayhead instead of calculating unused angle)
  drawPlayhead(
    ctx,
    cx,
    cy,
    waveformInnerRadius,
    maxWaveformThickness,
    isPlaying,
    state.isDragging,
    state.animationProgress,
    effectivePlayhead
  );

  // Draw playhead time display
  const currentTime = state.currentPlayhead;
  const duration = state.audioBuffer ? state.audioBuffer.duration : 180;
  drawPlayheadTime(
    ctx,
    cx,
    cy,
    waveformInnerRadius,
    maxWaveformThickness,
    currentTime,
    duration,
    width // <-- pass width here
  );

  // Draw button
  drawPlayPauseButton(ctx, cx, cy, buttonRadius, isPlaying);
}

// Keep only ONE set of these variables at the top (around line 66)
let playheadAnimationProgress = 0;
let playheadAnimationStartTime = 0;
let playheadTargetVisibility = false;
let isPlayheadAnimatingFlag = false;
const PLAYHEAD_ANIMATION_DURATION = CONFIG.PLAYHEAD_ANIMATION_DURATION;

let timeDisplayAnimationProgress = 0;
let timeDisplayTargetVisibility = false;
let isTimeDisplayAnimating = false;

// Add boost animation variables here
let currentBoostFactor = 1.0;
let targetBoostFactor = 1.0;

function getWaveformData(waveform, playhead, isPlaying, state) {
  let downsampled,
    maxAmp,
    numPoints = CONFIG.NUM_POINTS;

  // Make sure we have valid state data
  if (!state || !state.audioBuffer || !waveform) {
    return {
      downsampled: new Array(numPoints).fill(0),
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

    // Calculate new target boost factor
    const newBoostFactor =
      ratio < minimumThreshold && rawMax > 0
        ? minimumThreshold / Math.max(ratio, 0.01)
        : 1.0;

    // Only update target if there's a significant change
    if (
      Math.abs(newBoostFactor - targetBoostFactor) >
      CONFIG.BOOST_CHANGE_THRESHOLD
    ) {
      targetBoostFactor = Math.min(newBoostFactor, CONFIG.BOOST_MAX_MULTIPLIER);
    }

    const lerpSpeed = CONFIG.BOOST_LERP_SPEED;
    currentBoostFactor += (targetBoostFactor - currentBoostFactor) * lerpSpeed;

    // Apply the smoothed boost factor
    downsampled = rawDownsampled.map((amp) => {
      return Math.min(
        amp * currentBoostFactor,
        state.globalMaxAmp * CONFIG.BOOST_MAX_MULTIPLIER
      );
    });

    if (CONFIG.DEBUG_LOGGING && Math.abs(currentBoostFactor - 1.0) > 0.01) {
      console.log(
        `📈 Smooth Boost - Current: ${currentBoostFactor.toFixed(
          3
        )}, Target: ${targetBoostFactor.toFixed(3)}, Raw: ${rawMax.toFixed(6)}`
      );
    }

    maxAmp = state.globalMaxAmp;
  }

  return { downsampled, maxAmp, numPoints };
}

let cachedGradient = null;
let lastGradientParams = null;

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

  // --- REMOVE LOW-END ENERGY MODULATION ---
  // Use a fixed color for the gradient
  const innerColor = "rgba(0,255,255,1)"; // Fixed cyan

  const baseGradient = createWaveformGradient(
    ctx,
    cx,
    cy,
    innerRadius,
    maxThickness,
    innerColor
  );
  ctx.fillStyle = baseGradient;
  ctx.fill();

  // Do NOT draw the outline stroke
  // ctx.strokeStyle = "rgba(0, 255, 255, 0.3)";
  // ctx.lineWidth = 0.5;
  // ctx.stroke();

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

  // Detect visibility changes
  const now = performance.now();
  if (shouldShowPlayhead !== playheadTargetVisibility) {
    playheadTargetVisibility = shouldShowPlayhead;
    playheadAnimationStartTime = now;
    isPlayheadAnimatingFlag = true;

    // Also trigger time display animation
    timeDisplayTargetVisibility = shouldShowPlayhead;
    isTimeDisplayAnimating = true;

    console.log(`🎯 Playhead visibility changed: ${shouldShowPlayhead}`);
  }

  // Update playhead animation progress
  if (isPlayheadAnimatingFlag) {
    const elapsed = now - playheadAnimationStartTime;
    const rawProgress = Math.min(elapsed / PLAYHEAD_ANIMATION_DURATION, 1);

    if (playheadTargetVisibility) {
      playheadAnimationProgress = rawProgress;
    } else {
      playheadAnimationProgress = 1 - rawProgress;
    }

    if (rawProgress >= 1) {
      isPlayheadAnimatingFlag = false;
      playheadAnimationProgress = playheadTargetVisibility ? 1 : 0;
    }
  }

  // Update time display animation progress
  if (isTimeDisplayAnimating) {
    const elapsed = now - playheadAnimationStartTime;
    const rawProgress = Math.min(
      elapsed / CONFIG.TIME_DISPLAY_ANIMATION_DURATION,
      1
    );

    if (timeDisplayTargetVisibility) {
      timeDisplayAnimationProgress = rawProgress;
    } else {
      timeDisplayAnimationProgress = 1 - rawProgress;
    }

    if (rawProgress >= 1) {
      isTimeDisplayAnimating = false;
      timeDisplayAnimationProgress = timeDisplayTargetVisibility ? 1 : 0;
    }
  }

  // Don't draw playhead if completely retracted
  if (playheadAnimationProgress <= 0) return;

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
  const easedProgress = easeInOutCubic(playheadAnimationProgress);

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
  // Don't draw if time display animation is not active
  if (timeDisplayAnimationProgress <= 0) return;

  ctx.save();

  // Apply easing to time display animation
  const easedProgress = easeInOutCubic(timeDisplayAnimationProgress);

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

// Export function to check if playhead is animating (for redraw logic)
export function isPlayheadAnimating() {
  return isPlayheadAnimatingFlag || isTimeDisplayAnimating;
}

export function resetPlayheadAnimation() {
  playheadAnimationProgress = 0;
  playheadTargetVisibility = false;
  isPlayheadAnimatingFlag = false;
  playheadAnimationStartTime = 0;

  timeDisplayAnimationProgress = 0;
  timeDisplayTargetVisibility = false;
  isTimeDisplayAnimating = false;

  // Reset boost animation too
  currentBoostFactor = 1.0;
  targetBoostFactor = 1.0;

  // Reset any playhead animation state
  console.log("🔄 Playhead animation reset");
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
