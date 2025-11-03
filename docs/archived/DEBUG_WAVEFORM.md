# Waveform Drawing Debug Guide

## Expected Flow for Waveform Display

### 1. File Loading
- User selects audio file
- `handleFileLoad()` in file-handler.js processes file
- `handleFileSelect()` in audio-loader.js loads and processes audio
- Returns `{ audioBuffer, waveform, globalMaxAmp }`

### 2. State Management
- `setAudioBuffer(buffer, waveform, maxAmp)` called in audio-state.js
- Should store waveform data in centralized state

### 3. Drawing Loop
- Animation loop calls `drawCallback()` in main.js
- Checks `audioState.waveform && audioState.audioBuffer`
- Calls `drawRadialWaveform()` with combined state

### 4. Waveform Processing
- `getWaveformData()` processes waveform data
- Handles different view modes (full vs window)
- Returns downsampled data for drawing

### 5. Actual Drawing
- `drawWaveformPath()` creates canvas path
- Uses radial coordinates around center
- Applies gradient and fills path

## Debug Points Added

### In setAudioBuffer (audio-state.js)
```javascript
console.log('🔧 setAudioBuffer called with:', ...)
console.log('✅ Audio state updated:', ...)
```

### In drawCallback (main.js) 
```javascript
console.log('🎨 Draw callback debug:', ...)
console.log('🖼️ About to draw waveform with:', ...)
console.warn('⚠️ Cannot draw waveform - missing data:', ...)
```

### In getWaveformData (waveform-draw.js)
```javascript
console.log('🔍 getWaveformData debug:', ...)
console.warn('⚠️ Missing required waveform data, returning zeros:', ...)
console.log('🧪 Created test waveform:', ...)
```

### In drawWaveformPath (waveform-draw.js)
```javascript
console.log('🎨 drawWaveformPath called with:', ...)
```

## Expected Console Output Sequence

When loading a file successfully, you should see:
1. `🔧 setAudioBuffer called with:` - Shows file was processed
2. `✅ Audio state updated:` - Shows state was stored
3. `🎨 Draw callback debug:` - Shows drawing is being attempted
4. `🖼️ About to draw waveform with:` - Shows data is available for drawing
5. `🔍 getWaveformData debug:` - Shows waveform processing
6. `🎨 drawWaveformPath called with:` - Shows actual drawing

If any step is missing, that's where the problem is.

## Temporary Test Pattern

Added test sine wave generation when real data is missing:
- Creates visible pattern to test if drawing mechanism works
- Should show curved spiral if drawing is functional
- Helps isolate data vs drawing issues

## Common Issues to Check

1. **File validation blocking waveform**: Check if new validation is too strict
2. **Canvas context issues**: Verify canvas is properly initialized  
3. **Animation progress blocking**: Check if animation state prevents drawing
4. **Data type mismatches**: Float32Array vs Array validation
5. **Coordinate calculation errors**: Canvas positioning or scaling issues
