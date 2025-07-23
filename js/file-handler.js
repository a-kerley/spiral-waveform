import { handleFileSelect } from './audio-loader.js';
import { setAudioBuffer, resetAudioState } from './audio-state.js';
import { loadAudioForPlayback } from './audio-playback.js';
import { resetPlayheadAnimation } from './waveform-draw.js';

export function setupFileInput(container, onFileLoaded = null) {
  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = 'audio/*';
  fileInput.id = 'fileInput';
  container.appendChild(fileInput);

  fileInput.addEventListener('change', async (event) => {
    await handleFileLoad(event, onFileLoaded);
  });

  return fileInput;
}

export async function handleFileLoad(event, callback = null) {
  console.log('📁 File selected');
  
  try {
    const result = await handleFileSelect(event);
    if (result) {
      // Update centralized audio state FIRST
      setAudioBuffer(result.audioBuffer, result.waveform, result.globalMaxAmp);
      
      // THEN load audio for playback
      await loadAudioForPlayback(result.audioBuffer);
      
      // Reset animations
      resetPlayheadAnimation();
      
      console.log('✅ Audio file loaded and ready for playback');
      
      // Call callback if provided
      if (callback) {
        callback(result);
      }
      
      return result;
    }
  } catch (error) {
    console.error('❌ File loading failed:', error);
    resetAudioState();
    throw error;
  }
  
  return null;
}