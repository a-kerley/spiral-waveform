import { handleFileSelect } from './audio-loader.js';
import { setAudioBuffer, resetAudioState } from './audio-state.js';
import { loadAudioForPlayback } from './audio-playback.js';
import { resetPlayheadAnimation } from './waveform-draw.js';
import { UIValidation, InteractionValidation, FileValidation, ValidationError, validateAll } from './validation.js';
import { file, system } from './logger.js';

// ✅ ENHANCED: File input setup with comprehensive validation
export function setupFileInput(container, onFileLoaded = null) {
  try {
    // ✅ NEW: Validate input parameters
    validateAll([
      { value: container, validator: UIValidation.validateContainer, context: 'container' },
      { value: onFileLoaded, validator: InteractionValidation.validateCallback, context: 'onFileLoaded callback', required: false }
    ]);
    
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'audio/*,.mp3,.wav,.ogg,.oga,.opus,.m4a,.aac,.flac,.webm,.mp4';
    fileInput.id = 'fileInput';
    
    // ✅ NEW: Validate file input creation
    if (!fileInput || fileInput.type !== 'file') {
      throw new ValidationError('Failed to create file input element', 'fileInput', fileInput);
    }
    
    container.appendChild(fileInput);

    fileInput.addEventListener('change', async (event) => {
      await handleFileLoad(event, onFileLoaded);
    });

    file('File input created and attached successfully', 'info');
    return fileInput;
    
  } catch (error) {
    system('Failed to setup file input', 'error', error);
    throw error;
  }
}

// ✅ ENHANCED: File loading with comprehensive validation
export async function handleFileLoad(event, callback = null) {
  try {
    // ✅ FIXED: Validate file event (not interaction event)
    InteractionValidation.validateFileEvent(event, 'file load event');
    
    if (callback !== null) {
      InteractionValidation.validateCallback(callback, 'file load callback');
    }
    
    // ✅ NEW: Validate file selection
    if (!event.target || !event.target.files || event.target.files.length === 0) {
      throw new ValidationError('No file selected', 'fileSelection', event.target);
    }
    
    const selectedFile = event.target.files[0];
    
    // ✅ NEW: Validate the selected file
    FileValidation.validateAudioFile(selectedFile, 'selected audio file');
    
    file(`File selected: ${selectedFile.name} (${(selectedFile.size / 1024 / 1024).toFixed(2)}MB)`, 'info');
    
    const result = await handleFileSelect(event);
    
    if (!result) {
      throw new ValidationError('File processing returned null result', 'fileProcessing', result);
    }
    
    // ✅ NEW: Validate processing result
    validateAll([
      { value: result.audioBuffer, validator: (v) => v && typeof v.duration === 'number', context: 'processed audio buffer' },
      { value: result.waveform, validator: (v) => (Array.isArray(v) || (v && typeof v.length === 'number')) && v.length > 0, context: 'processed waveform data' },
      { value: result.globalMaxAmp, validator: (v) => typeof v === 'number' && v > 0, context: 'global max amplitude' }
    ]);
    
    file('File processing completed successfully', 'info');
    
    // Update centralized audio state FIRST
    setAudioBuffer(result.audioBuffer, result.waveform, result.globalMaxAmp);
    
    // THEN load audio for playback
    await loadAudioForPlayback(result.audioBuffer);
      
    // Reset animations
    resetPlayheadAnimation();
    
    file('Audio file loaded and ready for playback', 'info');
    
    // ✅ NEW: Call callback if provided and validate its execution
    if (callback) {
      try {
        const callbackResult = callback(result);
        file('File load callback executed successfully', 'debug');
        if (callbackResult instanceof Promise) {
          await callbackResult;
        }
      } catch (callbackError) {
        system('File load callback failed', 'warn', callbackError);
        // Don't rethrow callback errors - file loading succeeded
      }
    }
    
    return result;
    
  } catch (error) {
    file('File loading failed', 'error', error);
    resetAudioState();
    throw error;
  }
}