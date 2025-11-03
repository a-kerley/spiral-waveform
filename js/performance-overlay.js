/**
 * Performance Overlay UI
 * 
 * Optional visual overlay displaying real-time performance metrics.
 * Shows FPS, frame times, memory usage, and render statistics.
 * 
 * @module performance-overlay
 */

import { performanceMonitor, getFPS } from './performance-monitor.js';
import { getMemoryInfo } from './memory-manager.js';
import { getRenderStats } from './render-state.js';
import { getLayerStats } from './layer-manager.js';

/**
 * PerformanceOverlay - Visual performance statistics display
 */
export class PerformanceOverlay {
  #container = null;
  #visible = false;
  #updateInterval = null;
  #updateFrequency = 500; // Update every 500ms
  #position = 'top-right'; // top-left, top-right, bottom-left, bottom-right

  constructor() {
    this.#createOverlay();
  }

  /**
   * Create the overlay DOM elements
   */
  #createOverlay() {
    // Create container
    this.#container = document.createElement('div');
    this.#container.id = 'performance-overlay';
    this.#container.style.cssText = `
      position: fixed;
      top: 10px;
      right: 10px;
      background: rgba(0, 0, 0, 0.85);
      color: #0f0;
      font-family: 'Courier New', monospace;
      font-size: 12px;
      padding: 12px;
      border-radius: 8px;
      z-index: 10000;
      min-width: 250px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
      backdrop-filter: blur(4px);
      display: none;
      user-select: none;
    `;

    // Create content
    this.#container.innerHTML = `
      <div style="margin-bottom: 8px; border-bottom: 1px solid #0f0; padding-bottom: 4px;">
        <strong>⚡ Performance Monitor</strong>
      </div>
      <div id="perf-fps" style="margin-bottom: 4px;"></div>
      <div id="perf-frametime" style="margin-bottom: 4px;"></div>
      <div id="perf-memory" style="margin-bottom: 4px;"></div>
      <div id="perf-render" style="margin-bottom: 4px;"></div>
      <div id="perf-layers" style="margin-bottom: 4px;"></div>
      <div style="margin-top: 8px; font-size: 10px; color: #888; border-top: 1px solid #333; padding-top: 4px;">
        Press <kbd style="background: #222; padding: 2px 4px; border-radius: 3px;">Ctrl+Shift+P</kbd> to toggle
      </div>
    `;

    // Add to document
    document.body.appendChild(this.#container);

    // Make draggable
    this.#makeDraggable();
  }

  /**
   * Make the overlay draggable
   */
  #makeDraggable() {
    let isDragging = false;
    let currentX = 0;
    let currentY = 0;
    let initialX = 0;
    let initialY = 0;

    const header = this.#container.querySelector('div');

    header.style.cursor = 'move';
    header.addEventListener('mousedown', (e) => {
      isDragging = true;
      initialX = e.clientX - currentX;
      initialY = e.clientY - currentY;
    });

    document.addEventListener('mousemove', (e) => {
      if (isDragging) {
        e.preventDefault();
        currentX = e.clientX - initialX;
        currentY = e.clientY - initialY;

        // Convert to viewport position
        this.#container.style.left = currentX + 'px';
        this.#container.style.top = currentY + 'px';
        this.#container.style.right = 'auto';
        this.#container.style.bottom = 'auto';
      }
    });

    document.addEventListener('mouseup', () => {
      isDragging = false;
    });
  }

  /**
   * Update overlay content with latest stats
   */
  #update() {
    if (!this.#visible) return;

    const report = performanceMonitor.getReport();

    // FPS
    const fpsEl = this.#container.querySelector('#perf-fps');
    const fpsColor = this.#getFPSColor(report.fps.current);
    fpsEl.innerHTML = `
      <strong style="color: ${fpsColor}">FPS: ${report.fps.current}</strong>
      <span style="color: #888; font-size: 10px;">
        (min: ${report.fps.min}, max: ${report.fps.max}, avg: ${report.fps.avg})
      </span>
    `;

    // Frame Time
    const frameEl = this.#container.querySelector('#perf-frametime');
    const frameColor = this.#getFrameTimeColor(parseFloat(report.frameTime.current));
    frameEl.innerHTML = `
      <span style="color: ${frameColor}">Frame: ${report.frameTime.current}ms</span>
      <span style="color: #888; font-size: 10px;">
        (min: ${report.frameTime.min}, max: ${report.frameTime.max})
      </span>
    `;

    // Memory
    const memEl = this.#container.querySelector('#perf-memory');
    if (report.memory.available) {
      const memPercent = parseFloat(report.memory.percentage);
      const memColor = this.#getMemoryColor(memPercent);
      memEl.innerHTML = `
        <span style="color: ${memColor}">Memory: ${report.memory.used}</span>
        <span style="color: #888; font-size: 10px;">
          / ${report.memory.limit} (${report.memory.percentage})
        </span>
      `;
    } else {
      memEl.innerHTML = '<span style="color: #888;">Memory: N/A</span>';
    }

    // Render Stats
    const renderEl = this.#container.querySelector('#perf-render');
    renderEl.innerHTML = `
      <span style="color: #0af;">Rendered: ${report.render.rendered}</span>
      <span style="color: #888; font-size: 10px;">
        / Skipped: ${report.render.skipped}
      </span>
    `;

    // Layer Stats
    const layerEl = this.#container.querySelector('#perf-layers');
    if (report.layers.enabled) {
      layerEl.innerHTML = `
        <span style="color: #fa0;">Waveform: ${report.layers.waveformRenders}</span>
        <span style="color: #888; font-size: 10px;">
          / Playhead: ${report.layers.playheadRenders}
        </span>
      `;
    } else {
      layerEl.innerHTML = '<span style="color: #888;">Layers: Disabled</span>';
    }
  }

  /**
   * Get color for FPS based on value
   */
  #getFPSColor(fps) {
    if (fps >= 55) return '#0f0'; // Green - excellent
    if (fps >= 45) return '#af0'; // Yellow-green - good
    if (fps >= 30) return '#fa0'; // Orange - acceptable
    return '#f00'; // Red - poor
  }

  /**
   * Get color for frame time based on value
   */
  #getFrameTimeColor(ms) {
    if (ms <= 16.7) return '#0f0'; // Green - 60fps
    if (ms <= 22) return '#af0'; // Yellow-green - 45fps
    if (ms <= 33) return '#fa0'; // Orange - 30fps
    return '#f00'; // Red - below 30fps
  }

  /**
   * Get color for memory based on percentage
   */
  #getMemoryColor(percent) {
    if (percent < 60) return '#0f0'; // Green - low
    if (percent < 75) return '#af0'; // Yellow-green - moderate
    if (percent < 85) return '#fa0'; // Orange - high
    return '#f00'; // Red - critical
  }

  /**
   * Show the overlay
   */
  show() {
    if (this.#visible) return;

    this.#visible = true;
    this.#container.style.display = 'block';

    // Start update loop
    this.#updateInterval = setInterval(() => {
      this.#update();
    }, this.#updateFrequency);

    this.#update();
  }

  /**
   * Hide the overlay
   */
  hide() {
    if (!this.#visible) return;

    this.#visible = false;
    this.#container.style.display = 'none';

    // Stop update loop
    if (this.#updateInterval) {
      clearInterval(this.#updateInterval);
      this.#updateInterval = null;
    }
  }

  /**
   * Toggle overlay visibility
   */
  toggle() {
    if (this.#visible) {
      this.hide();
    } else {
      this.show();
    }
  }

  /**
   * Check if overlay is visible
   */
  isVisible() {
    return this.#visible;
  }

  /**
   * Set overlay position
   * @param {string} position - 'top-left', 'top-right', 'bottom-left', 'bottom-right'
   */
  setPosition(position) {
    this.#position = position;

    // Reset all positions
    this.#container.style.top = 'auto';
    this.#container.style.right = 'auto';
    this.#container.style.bottom = 'auto';
    this.#container.style.left = 'auto';

    // Apply new position
    switch (position) {
      case 'top-left':
        this.#container.style.top = '10px';
        this.#container.style.left = '10px';
        break;
      case 'top-right':
        this.#container.style.top = '10px';
        this.#container.style.right = '10px';
        break;
      case 'bottom-left':
        this.#container.style.bottom = '10px';
        this.#container.style.left = '10px';
        break;
      case 'bottom-right':
        this.#container.style.bottom = '10px';
        this.#container.style.right = '10px';
        break;
    }
  }

  /**
   * Dispose and clean up
   */
  dispose() {
    this.hide();
    if (this.#container && this.#container.parentNode) {
      this.#container.parentNode.removeChild(this.#container);
    }
    this.#container = null;
  }
}

// Create singleton instance
const performanceOverlay = new PerformanceOverlay();

// Setup keyboard shortcut (Ctrl+Shift+P)
document.addEventListener('keydown', (e) => {
  if (e.ctrlKey && e.shiftKey && e.key === 'P') {
    e.preventDefault();
    performanceOverlay.toggle();
  }
});

// Convenience exports
export function showPerformanceOverlay() {
  performanceOverlay.show();
}

export function hidePerformanceOverlay() {
  performanceOverlay.hide();
}

export function togglePerformanceOverlay() {
  performanceOverlay.toggle();
}

export function isPerformanceOverlayVisible() {
  return performanceOverlay.isVisible();
}

export { performanceOverlay };

// Export for browser console
if (typeof window !== 'undefined') {
  window.showPerformanceOverlay = showPerformanceOverlay;
  window.hidePerformanceOverlay = hidePerformanceOverlay;
  window.togglePerformanceOverlay = togglePerformanceOverlay;
}
