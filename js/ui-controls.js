export function createUI(container) {
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
  document.addEventListener('keydown', (e) => {
    switch (e.code) {
      case 'Space':
        e.preventDefault();
        if (callbacks.onPlayPause) {
          callbacks.onPlayPause();
        }
        break;
      case 'ArrowLeft':
        e.preventDefault();
        if (callbacks.onSeekBackward) {
          callbacks.onSeekBackward();
        }
        break;
      case 'ArrowRight':
        e.preventDefault();
        if (callbacks.onSeekForward) {
          callbacks.onSeekForward();
        }
        break;
    }
  });
}