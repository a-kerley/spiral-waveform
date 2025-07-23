import { CONFIG } from './utils.js';

export function setupResponsiveCanvas(canvas, context) {
  const dpr = window.devicePixelRatio || 1;
  const padding = 24 * 2; // match CSS
  const size = Math.min(window.innerWidth - padding, window.innerHeight - padding);

  canvas.width = size * dpr;
  canvas.height = size * dpr;
  canvas.style.width = size + 'px';
  canvas.style.height = size + 'px';

  context.setTransform(dpr, 0, 0, dpr, 0, 0);
}

export function initializeCanvas() {
  const canvas = document.createElement('canvas');
  canvas.id = 'waveCanvas';
  canvas.tabIndex = 0; // Make canvas focusable for accessibility/touch
  
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    console.error('Could not get 2D context');
    return { canvas: null, ctx: null };
  }

  setupResponsiveCanvas(canvas, ctx);
  console.log('✅ Canvas created and initialized');
  
  return { canvas, ctx };
}