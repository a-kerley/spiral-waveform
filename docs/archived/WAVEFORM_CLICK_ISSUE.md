# Waveform Click Playback Issue - Diagnostic Summary

## Problem
When clicking the waveform to scrub (while audio is NOT playing), playback starts and the UI shows "playing" state.

## Investigation Results

### Suspected Root Cause
The scrubbing resume logic may be incorrectly determining whether to resume playback after scrubbing stops.

### Key Code Paths

**1. When you click the waveform:**
- `handleMouseDown()` in `interaction.js` line 281
- Calls `startScrubbing(currentPlayhead)` 
- Records `wasPlaying = isAudioPlaying()` before stopping audio
- Stores in `state.dragWasPlaying = wasPlaying`

**2. When you release the click (stop scrubbing):**
- `handleMouseUp()` or `handleMouseLeave()` in `interaction.js` calls
- `stopScrubbing(finalPosition, state.dragWasPlaying)`
- Should NOT resume if `dragWasPlaying` is `false`

**3. The resume decision is made in `audio-playback.js` line 571:**
```javascript
const scrubResult = scrubStateAdapter.stopScrubbing(finalPosition, shouldResumePlaying);
```

Then at lines 574-576:
```javascript
if (!scrubResult.wasPlaying && shouldResumePlaying === null) {
  scrubResult.shouldResume = false;
}
```

## New Diagnostic Logs

### Three critical new logs added:

1. **`[SCRUB-START-DIAG]`** - When you click waveform to start scrubbing
   - Location: `js/interaction.js` line 304
   - Shows: `wasPlaying` value returned from `startScrubbing` and what's stored in `state.dragWasPlaying`
   - Example: `[SCRUB-START-DIAG] startScrubbing returned wasPlaying=false, isPlaying=false`

2. **`[SCRUB-STOP]`** - When you release click to stop scrubbing  
   - Location: `js/audio-playback.js` lines 557, 573, 579
   - Shows: Input parameters and final decision
   - Example: `[SCRUB-STOP] stopScrubbing called: finalPosition=0.250, shouldResumePlaying=false`
   - Example: `[SCRUB-STOP] FINAL DECISION: shouldResume=false, about to NOT RESUME playback`

3. **`[SCRUB-STOP]`** - Confirming resume/pause action (line 594, 599)
   - Shows which branch is taken: "Resuming playback" or "NOT resuming playback"
   - Example: `[SCRUB-STOP] NOT resuming playback, scrubResult.shouldResume=false`

## Test Instructions

1. **Open browser console (F12)**

2. **Clear the console**

3. **Test Scenario A: Click waveform while NOT playing**
   - Make sure audio is NOT playing
   - Click on the waveform to scrub
   - **Watch console for:**
     ```
     [SCRUB-START-DIAG] startScrubbing returned wasPlaying=false, isPlaying=false
     [SCRUB-START-DIAG] state.dragWasPlaying set to false
     ```
   - Release the mouse
   - **Watch for:**
     ```
     [SCRUB-STOP] stopScrubbing called: finalPosition=0.XXX, shouldResumePlaying=false
     [SCRUB-STOP] scrubResult: wasPlaying=false, shouldResume=???
     [SCRUB-STOP] FINAL DECISION: shouldResume=false, about to NOT RESUME playback
     [SCRUB-STOP] NOT resuming playback, scrubResult.shouldResume=false
     ```
   
   **If playback starts despite these logs**, there's a bug in the resume logic.
   **If the logs show `shouldResume=true`**, the problem is in scrubStateAdapter.

4. **Test Scenario B: Click waveform while PLAYING**
   - Start audio by clicking play button
   - Click on the waveform to scrub
   - Release mouse
   - **Should resume playback with logs:**
     ```
     [SCRUB-START-DIAG] startScrubbing returned wasPlaying=true
     [SCRUB-START-DIAG] state.dragWasPlaying set to true
     ...
     [SCRUB-STOP] scrubResult: wasPlaying=true, shouldResume=true
     [SCRUB-STOP] FINAL DECISION: shouldResume=true, about to RESUME playback
     [SCRUB-STOP] Resuming playback, scrubResult.shouldResume=true
     ```

## Report These Logs

When you test, please copy and paste the console logs showing:
1. What `wasPlaying` was when scrubbing started
2. What `shouldResumePlaying` parameter was passed to `stopScrubbing`
3. What the final `shouldResume` decision was
4. Whether playback actually started or not

This will help identify exactly where the logic is failing.

## Possible Issues to Check

### If shouldResume is incorrectly `true`:
- Check line 82 in `interaction-state-adapter.js`:
  ```javascript
  shouldResume: shouldResume !== false ? wasPlaying : shouldResume
  ```
  This logic might be wrong

### If shouldResume is `false` but playback still starts:
- Check if `playAudio()` is being called from somewhere else
- Or if `setPlayingState(true)` is being called without `playAudio()`

### If state.dragWasPlaying is wrong:
- Check if `startScrubbing()` is returning the wrong value
- Or if something is modifying `state.dragWasPlaying` after it's set
