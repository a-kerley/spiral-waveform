// Centralized audio state
const audioState = {
  audioBuffer: null,
  waveform: null,
  globalMaxAmp: 1,
  currentPlayhead: 0,
  isPlaying: false,
  duration: 0
};

export function getAudioState() {
  return audioState;
}

export function setAudioBuffer(buffer, waveform, maxAmp) {
  audioState.audioBuffer = buffer;
  audioState.waveform = waveform;
  audioState.globalMaxAmp = maxAmp;
  audioState.duration = buffer ? buffer.duration : 0;
  audioState.currentPlayhead = 0;
  audioState.isPlaying = false;
}

export function setPlayhead(time) {
  audioState.currentPlayhead = Math.max(0, Math.min(time, audioState.duration));
}

export function setPlayingState(playing) {
  audioState.isPlaying = playing;
}

export function resetAudioState() {
  audioState.audioBuffer = null;
  audioState.waveform = null;
  audioState.globalMaxAmp = 1;
  audioState.currentPlayhead = 0;
  audioState.isPlaying = false;
  audioState.duration = 0;
}