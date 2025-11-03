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
  ui('⌨️ UI: Setting up keyboard controls');
  
  document.addEventListener('keydown', (e) => {
    switch (e.code) {
      case 'Space':
        e.preventDefault();
        ui('⌨️ UI: Space key pressed');
        if (callbacks.onPlayPause) {
          callbacks.onPlayPause();
        }
        break;
      case 'ArrowLeft':
        e.preventDefault();
        ui('⌨️ UI: Left arrow pressed');
        if (callbacks.onSeekBackward) {
          callbacks.onSeekBackward();
        }
        break;
      case 'ArrowRight':
        e.preventDefault();
        ui('⌨️ UI: Right arrow pressed');
        if (callbacks.onSeekForward) {
          callbacks.onSeekForward();
        }
        break;
    }
  });
}