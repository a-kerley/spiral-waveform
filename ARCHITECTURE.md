# Audio Control Architecture

## Overview

This document describes the consolidated architecture for audio playback control in the Spiral Waveform Player.

## Module Ownership

Clear responsibility boundaries for each module:

### Core Audio Modules
- **audio-loader.js**: Audio file and URL loading, format detection, waveform extraction
  - `loadAudioFile()` - Load from File object
  - `loadAudioFromUrl()` - Load from URL with fallback strategies
  - `handleFileSelect()` - File input handler
  
- **waveform-data.js**: Waveform downsampling, caching, placeholder generation
  - `downsample()` - Downsample waveform for visualization
  - `getFullFileDownsampled()` - Get/cache full-file downsampled waveform
  - `generatePlaceholderWaveform()` - Generate realistic synthetic waveform
  - `getWaveformWindow()` - Extract windowed segment of waveform

- **waveform-draw.js**: Canvas rendering, radial visualization
  - `drawRadialWaveform()` - Main rendering function
  - `drawPlayPauseButton()` - Play/pause button overlay
  - `resetPlayheadAnimation()` - Reset animation state

- **audio-playback.js**: Low-level WebAudio playback lifecycle
  - `initializeAudio()` - Initialize audio context
  - `loadAudioForPlayback()` - Setup audio source
  - `playAudio()` / `pauseAudio()` - Playback control

- **audio-controls.js**: High-level playback API with validation
  - `togglePlayPause()` - Unified play/pause control
  - `seekToPosition()` / `seekRelative()` - Seek control
  - `setVolume()` - Volume control
  - `updatePlayheadFromAudio()` - Sync playhead from audio time

### Player & UI Modules
- **spiral-waveform-player.js**: Main player component, orchestrates UI
  - Creates canvas, file input, URL input
  - Delegates audio operations to audio-loader/audio-controls
  - Manages player instance state (e.g., `_urlAudioElement`)
  - Handles accessibility features

- **ui-controls.js**: UI creation and keyboard controls
- **file-handler.js**: File input setup and handling
- **interaction.js**: Mouse/touch interaction handling

### Utility Modules
- **canvas-math.js**: Geometric helpers (polar/cartesian conversion)
- **utils.js**: Pure utility functions (clamp, lerp, etc.)
- **validation.js**: Input validation and type checking
- **state-manager.js**: Centralized state management

## Layer Separation

### 1. UI Layer (`spiral-waveform-player.js`)
**Purpose:** High-level component that handles UI interaction and accessibility.

**Responsibilities:**
- Canvas setup and rendering coordination
- File loading and URL audio setup
- Accessibility announcements (screen reader, ARIA attributes)
- User interface state management
- Delegates all playback control to audio-controls.js

**Public Methods:**
- `togglePlayPause()` - Delegates to audio-controls, handles accessibility
- `seekToPosition(normalizedPosition)` - Delegates to audio-controls, updates UI
- `seekRelative(deltaSeconds)` - Delegates to audio-controls, updates UI
- `setVolume(volume)` - Delegates to audio-controls, saves settings
- `loadFromUrl(url)` - Handles URL audio loading and waveform extraction
- `loadFromFile(file)` - Handles file loading

### 2. Public API Layer (`audio-controls.js`)
**Purpose:** High-level audio control functions with validation and state management.

**Responsibilities:**
- Validate all inputs (playhead, position, volume)
- Update state synchronously BEFORE async operations
- Handle error recovery (restore state on failure)
- Call low-level audio-playback.js functions
- Provide clean API for UI layer

**Exported Functions:**
- `togglePlayPause()` → Returns `Promise<boolean>` (success/failure)
- `seekToPosition(normalizedPosition)` → Returns `boolean`
- `seekRelative(offsetSeconds)` → Returns `boolean`
- `setVolume(volume)` → Returns `number` (clamped volume)
- `updatePlayheadFromAudio()` → Called by animation loop

**Key Design Decisions:**
- State updates happen BEFORE async playback operations to prevent race conditions
- All inputs are validated using `AudioValidation` and `TypeValidator`
- Errors are logged and handled gracefully with fallback values
- State is restored if operations fail

### 3. Implementation Layer (`audio-playback.js`)
**Purpose:** Low-level audio operations using Web Audio API and HTMLAudioElement.

**Responsibilities:**
- Initialize Web Audio API context
- Create and manage audio sources (BufferSource, MediaElement)
- Handle URL audio vs. buffer audio routing
- Manage scrubbing state
- Provide time information from audio context

**Exported Functions:**
- `playAudio(startTimeSeconds)` → Routes to URL or buffer audio
- `pauseAudio()` → Handles URL or buffer audio
- `seekTo(timeSeconds)` → Seeks to position
- `getCurrentTime()` → Returns current playback time
- `isAudioPlaying()` → Returns playback state
- `setVolume(volume)` → Sets audio volume
- `initializeAudio()` → Initializes Web Audio context
- `loadAudioForPlayback(audioBuffer)` → Loads buffer for playback
- `cleanupAudio()` → Cleanup on disposal

**Audio Source Routing:**
```javascript
if (window.urlAudioElement) {
  // Use HTMLAudioElement for streaming playback
  return playUrlAudio(startTimeSeconds);
} else {
  // Use Web Audio API for decoded buffer playback
  // ... buffer audio code
}
```

### 4. State Layer (`audio-state.js` / `state-manager.js`)
**Purpose:** Single source of truth for application state.

**State Structure:**
```javascript
{
  audio: {
    audioBuffer: AudioBuffer | null,
    waveform: Float32Array | null,
    globalMaxAmp: number,
    currentPlayhead: number,  // seconds
    isPlaying: boolean,
    duration: number,         // seconds
    volume: number           // 0-1
  }
}
```

**State Update Functions:**
- `setPlayingState(isPlaying)` → Updates `audio.isPlaying`, marks PLAYHEAD dirty
- `setPlayhead(timeSeconds)` → Updates `audio.currentPlayhead`
- `setAudioBuffer(buffer, waveform, maxAmp)` → Loads new audio data
- `getAudioState()` → Returns current audio state snapshot

## Data Flow

### Playback State Flow
```
User Action (click, spacebar)
    ↓
SpiralWaveformPlayer.togglePlayPause()
    ↓
audio-controls.js:togglePlayPause()
    ├─ Validate state
    ├─ setPlayingState(true/false)  ← State updated FIRST
    ├─ playAudio() / pauseAudio()
    └─ Handle errors (restore state if failed)
    ↓
audio-playback.js:playAudio()
    ├─ Route to URL or buffer audio
    ├─ Start audio source
    └─ Return success/failure
    ↓
State subscribers notified
    ├─ audio-state-adapter marks PLAYHEAD dirty
    └─ RenderState triggers redraw
    ↓
animation.js reads state on next frame
    ├─ Checks audioState.isPlaying
    ├─ Calls getCurrentTime()
    ├─ Updates setPlayhead(currentTime)
    └─ Marks components dirty
    ↓
drawCallback() renders frame
```

### Single Source of Truth for Playback Time

**Audio Source (Ground Truth):**
- URL audio: `window.urlAudioElement.currentTime`
- Buffer audio: `audioContext.currentTime` + offset calculations

**Reading on Each Frame:**
```javascript
// animation.js:updatePlayback()
if (audioState.isPlaying) {
  const currentTime = getCurrentTime();  // Reads from audio source
  if (Math.abs(currentTime - audioState.currentPlayhead) > 0.016) {
    setPlayhead(currentTime);  // Updates state
    renderState.markDirty(RenderComponents.PLAYHEAD);
    renderState.markDirty(RenderComponents.TIME_DISPLAY);
  }
}
```

## Key Architectural Patterns

### 1. State-First Pattern
State updates happen **synchronously** before async operations:
```javascript
// ✅ CORRECT
setPlayingState(true);
await playAudio(position);

// ❌ WRONG
await playAudio(position);
setPlayingState(true);  // Race condition!
```

### 2. Validation Wrapper Pattern
All public API functions use validation:
```javascript
export const seekToPosition = withValidation(
  function(normalizedPosition) { /* implementation */ },
  [(pos) => TypeValidator.isNumber(pos, { min: 0, max: 1 })],
  (result) => typeof result === 'boolean',
  'seekToPosition'
);
```

### 3. Error Recovery Pattern
Restore state if operations fail:
```javascript
setPlayingState(true);
const success = await playAudio(position);
if (!success) {
  setPlayingState(false);  // Restore state
}
```

### 4. Delegation Pattern
UI layer delegates to control layer:
```javascript
// SpiralWaveformPlayer
async togglePlayPause() {
  const success = await audioTogglePlayPause();  // Delegate
  if (success) {
    screenReaderAnnouncer.announce(...);  // Handle UI concerns
    this.drawCallback();
  }
}
```

## Public vs. Internal APIs

### Public (Called by UI)
- `audio-controls.js`: All exported functions
  - `togglePlayPause()`
  - `seekToPosition()`
  - `seekRelative()`
  - `setVolume()`
  - `updatePlayheadFromAudio()`

### Internal (Implementation Details)
- `audio-playback.js`: All functions except initialization
  - `playAudio()` - Called by audio-controls
  - `pauseAudio()` - Called by audio-controls
  - `playUrlAudio()` - Called internally by playAudio()
  - `getCurrentTime()` - Called by animation loop and audio-controls
  - `seekTo()` - Called by audio-controls

### Both Public and Internal
- `audio-playback.js` initialization:
  - `initializeAudio()` - Called by UI on startup
  - `loadAudioForPlayback()` - Called by UI after file/URL load
  - `cleanupAudio()` - Called by UI on disposal

## Migration Notes

### Removed Duplicate Code
- `main.js` is **unused** (index.html uses SpiralWaveformPlayer)
- Removed duplicate logic from `SpiralWaveformPlayer` class methods
- All control logic now in `audio-controls.js`

### Files Modified
1. `audio-controls.js`: Added `setVolume()` wrapper
2. `audio-playback.js`: Fixed URL audio routing condition
3. `spiral-waveform-player.js`: Converted to delegation pattern

### Breaking Changes
None - public API unchanged, only internal implementation consolidated.

## Testing Strategy

### Unit Tests
- `audio-controls.js`: Validate input/output, state updates
- `audio-playback.js`: Mock Web Audio API, test routing logic
- `state-manager.js`: Test state subscriptions and updates

### Integration Tests
- Animation loop updates playhead during playback
- State changes trigger visual updates
- Error recovery works correctly

### Browser Tests
Must verify:
1. Play/pause button works
2. Playhead rotates during playback
3. Time display updates in real-time
4. UI button shows correct play/pause icon
5. Spacebar toggles correctly
6. Volume control works
7. Seeking works (click, drag, arrow keys)

## Future Improvements

1. **Remove console.log debug statements** from audio-controls.js
2. **Delete or document main.js** as deprecated
3. **Add more comprehensive error types** for better error handling
4. **Consider async state updates** for better performance
5. **Add playback rate control** to audio-controls.js
