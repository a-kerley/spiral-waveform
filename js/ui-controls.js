import { ui } from './logger.js';

export function createUI(container) {
  ui('🎨 UI: Creating UI elements');
  
  // Create title
  const title = document.createElement('h1');
  title.textContent = 'Spiral Waveform Audio Player';
  container.appendChild(title);

  // Create instructions
  const instructions = document.createElement('p');
  instructions.textContent = 'Click the center button to play/pause • Drag around the waveform to seek • Press spacebar for play/pause';
  container.appendChild(instructions);

  return {
    title,
    instructions
  };
}

export function setupKeyboardControls(callbacks = {}) {
  // Keyboard controls are handled by accessibility.js::KeyboardNavigationManager
  ui('⌨️ UI: Keyboard controls handled by accessibility module');
}