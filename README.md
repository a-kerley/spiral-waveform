# Spiral Waveform Audio Player

A sophisticated HTML5 audio player that visualizes audio waveforms as an interactive spiral/radial pattern.

## Features

- 🎵 **Audio Playback** - Support for multiple formats (MP3, WAV, OGG, Opus, M4A, FLAC, WebM)
- 🌀 **Spiral Visualization** - Beautiful radial waveform display
- 🎯 **Interactive Seeking** - Drag around the waveform to seek
- 🌐 **URL Loading** - Load audio from URLs (including Dropbox)
- ⌨️ **Keyboard Controls** - Spacebar for play/pause, arrows for seeking
- 📱 **Responsive** - Works on desktop and mobile devices
- 🎨 **Smooth Animations** - Transitions between full-file and focused window views

## Quick Start

### Basic Usage

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Spiral Waveform Audio Player</title>
  <link rel="stylesheet" href="css/styles.css">
</head>
<body>
  <div class="container" id="spiral-player-container"></div>
  <script type="module">
    import { SpiralWaveformPlayer } from './js/spiral-waveform-player.js';
    const container = document.getElementById('spiral-player-container');
    new SpiralWaveformPlayer({ container });
  </script>
</body>
</html>
```

### Loading Audio

**From File:**
- Click the file input button
- Select an audio file from your computer

**From URL:**
- Paste a direct audio URL or Dropbox link
- Click "Load from URL"

## Controls

### Mouse/Touch
- **Click center button** - Play/Pause
- **Drag around waveform** - Seek to position
- **Click on waveform** - Jump to position

### Keyboard
- **Space** - Play/Pause
- **Left Arrow** - Seek backward 5 seconds
- **Right Arrow** - Seek forward 5 seconds

## Browser Support

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+

Requires ES6 module support and Web Audio API.

## Project Status

Currently undergoing Phase 1 refactoring (Foundation & Cleanup). See [REFACTORING_ROADMAP.md](./REFACTORING_ROADMAP.md) for details.

## Architecture

The player is built using vanilla JavaScript with ES6 modules:

**Core Components:**
- `spiral-waveform-player.js` - Main player class
- `audio-playback.js` - Web Audio API management
- `waveform-draw.js` - Canvas rendering
- `animation.js` - Animation loop and transitions
- `interaction.js` - Mouse/touch event handling

**Supporting Modules:**
- `audio-state.js` - Centralized audio state
- `canvas-setup.js` - Canvas initialization
- `validation.js` - Type validation system
- `logger.js` - Development logging
- `utils.js` - Shared utilities

## Development

### Local Server

Due to ES6 modules, you need to run a local server:

```bash
# Using Python 3
python3 -m http.server 3000

# Using Node.js
npx http-server -p 3000

# Using PHP
php -S localhost:3000
```

Then open `http://localhost:3000` in your browser.

### File Structure

```
spiral-waveform/
├── index.html              # Entry point
├── css/
│   └── styles.css         # Styles
├── js/
│   ├── spiral-waveform-player.js  # Main player class
│   ├── audio-playback.js          # Audio engine
│   ├── waveform-draw.js           # Rendering
│   ├── animation.js               # Animation loop
│   ├── interaction.js             # Event handling
│   └── [other modules...]
└── assets/
    └── test-audio/        # Test files
```

## Documentation

- [Refactoring Roadmap](./REFACTORING_ROADMAP.md) - Improvement plan
- [Validation System](./VALIDATION.md) - Type validation docs
- [Logging System](./LOGGING.md) - Logging documentation
- [Audio Formats](./AUDIO_FORMATS.md) - Supported formats
- [Error Fixes](./ERROR_FIXES.md) - Bug fix history

## License

MIT License - See LICENSE file for details

## Contributing

Contributions welcome! Please see [REFACTORING_ROADMAP.md](./REFACTORING_ROADMAP.md) for current priorities.

### Development Guidelines

1. Follow existing code style
2. Add tests for new features (when testing infrastructure is ready)
3. Update documentation
4. Use the validation system for type checking
5. Add logging for debugging

## Credits

Created by Alistair Kerley

## Changelog

### Phase 1 - Foundation & Cleanup (In Progress)
- Consolidated initialization logic (main.js deprecated)
- Documentation improvements

### Previous Updates
- Added comprehensive validation system
- Added structured logging
- Support for URL loading (including Dropbox)
- Real waveform extraction for URL audio
- Improved touch support
- End-of-file behavior improvements
