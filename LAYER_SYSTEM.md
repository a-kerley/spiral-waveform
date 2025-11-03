# Layer System Testing Guide

## Overview
The layer system separates static and dynamic rendering for performance optimization.

## Architecture

### Layer 0: Static Waveform
- **Content**: Waveform shape and gradient
- **Redraws**: Only when audio changes
- **Performance**: Eliminates redundant waveform rendering

### Layer 1: Dynamic Playhead/UI
- **Content**: Playhead indicator, time display, play/pause button
- **Redraws**: Every frame during playback
- **Performance**: Only redraws small, fast-changing elements

## Browser Console Commands

### Check Layer Stats
```javascript
getLayerStats()
```

Returns:
- `enabled`: Whether OffscreenCanvas is supported
- `waveformRenders`: Count of waveform layer renders
- `playheadRenders`: Count of playhead layer renders
- `composites`: Count of layer composites
- `lastWaveformRenderTime`: Time (ms) for last waveform render
- `lastPlayheadRenderTime`: Time (ms) for last playhead render
- `lastCompositeTime`: Time (ms) for last composite operation
- `memoryEstimate`: Estimated memory usage for layers

### Reset Stats
```javascript
resetLayerStats()
```

## Testing Procedure

### 1. Load Audio File
- Load any audio file
- Check console for "LayerManager initialized" message
- Run `getLayerStats()` - should show `enabled: true`

### 2. Verify Waveform Layer Caching
```javascript
// Before playing
const before = getLayerStats();
console.log('Waveform renders before play:', before.waveformRenders);

// Start playback and wait 5 seconds

// After playing
const after = getLayerStats();
console.log('Waveform renders after play:', after.waveformRenders);
console.log('Playhead renders after play:', after.playheadRenders);
```

**Expected Result**:
- `waveformRenders` should be 1-2 (initial render + possible resize)
- `playheadRenders` should be high (~300 for 5 seconds at 60 FPS)
- This proves waveform is cached and only playhead redraws

### 3. Performance Comparison
Before layers (baseline):
- Every frame rendered full waveform + playhead
- ~16ms per frame at 60 FPS

With layers:
- Waveform: rendered once (~10-15ms)
- Playhead: ~2-4ms per frame
- Composite: ~1-2ms per frame
- **Total per frame: ~3-6ms** (50-70% reduction)

### 4. Test Waveform Invalidation
```javascript
// Load audio file
resetLayerStats();

// Play for a bit
// ...

// Load a different audio file
// Waveform layer should invalidate and re-render

const stats = getLayerStats();
console.log('Waveform renders:', stats.waveformRenders); // Should increment
```

## Fallback Behavior

If OffscreenCanvas is not supported:
- System falls back to non-layered rendering
- Console shows: "⚠️ OffscreenCanvas not supported - layer caching disabled"
- `getLayerStats()` returns `enabled: false`
- Functionality remains intact, just without performance optimization

## Browser Compatibility

### Full Support (OffscreenCanvas enabled)
- Chrome 69+
- Edge 79+
- Firefox 105+
- Safari 16.4+
- Opera 56+

### Fallback Mode (no OffscreenCanvas)
- All other browsers
- Works perfectly, just without layer caching

## Expected Performance Gains

### During Playback
- **Waveform rendering**: 1 render vs continuous renders = 99%+ reduction
- **CPU usage**: 50-70% reduction
- **Battery life**: Significantly improved on mobile/laptop
- **Frame time**: 3-6ms vs 12-16ms = 50-70% faster

### During Pause
- Dirty flag system prevents all rendering
- Near-zero CPU usage when idle

### During Interaction
- Waveform layer stays cached
- Only playhead layer redraws
- Smooth 60 FPS maintained

## Debugging

### Check if layers are active
```javascript
const stats = getLayerStats();
if (stats.enabled) {
  console.log('✅ Layers active');
  console.log(`Memory: ${stats.memoryEstimate}`);
} else {
  console.log('⚠️ Fallback mode');
}
```

### Monitor render times
```javascript
setInterval(() => {
  const stats = getLayerStats();
  console.log(`Waveform: ${stats.lastWaveformRenderTime.toFixed(2)}ms`);
  console.log(`Playhead: ${stats.lastPlayheadRenderTime.toFixed(2)}ms`);
  console.log(`Composite: ${stats.lastCompositeTime.toFixed(2)}ms`);
}, 1000);
```

### Track render efficiency
```javascript
const trackEfficiency = () => {
  resetLayerStats();
  
  setTimeout(() => {
    const stats = getLayerStats();
    const waveformEfficiency = stats.composites / Math.max(1, stats.waveformRenders);
    console.log(`Efficiency: ${waveformEfficiency.toFixed(1)}x`);
    console.log(`(composited ${stats.composites} frames with only ${stats.waveformRenders} waveform renders)`);
  }, 5000);
};

// Run after starting playback
trackEfficiency();
```

**Expected efficiency**: 150-300x (300 composites with 1-2 waveform renders)

## Memory Usage

Typical layer memory:
- 800x800 canvas at 2x DPR = 1600x1600 pixels
- 2 layers × 4 bytes/pixel × 1600 × 1600 = ~20 MB
- Acceptable for modern browsers
- Automatically disposed on canvas resize

## Known Limitations

1. **Browser support**: Falls back gracefully in older browsers
2. **Memory overhead**: ~20MB for high-DPI displays (acceptable trade-off)
3. **Canvas size**: Limited to 8192×8192 pixels (browser constraint)

## Integration Points

Files modified:
- `layer-manager.js` - Core layer management
- `waveform-draw.js` - Layer-based rendering
- `canvas-setup.js` - Layer initialization on resize
- `spiral-waveform-player.js` - Debug helpers
