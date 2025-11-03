/**
 * Accessibility Utilities
 * Provides screen reader announcements, keyboard navigation, and ARIA support
 */

/**
 * Screen reader announcement manager
 */
class ScreenReaderAnnouncer {
  constructor() {
    this.announcementElement = null;
    this.lastAnnouncement = '';
    this.announcementTimeout = null;
  }

  /**
   * Initialize the announcer with the live region element
   */
  initialize() {
    this.announcementElement = document.getElementById('sr-announcements');
    
    if (!this.announcementElement) {
      console.warn('Screen reader announcement element not found');
      // Create it if it doesn't exist
      this.announcementElement = document.createElement('div');
      this.announcementElement.id = 'sr-announcements';
      this.announcementElement.setAttribute('role', 'status');
      this.announcementElement.setAttribute('aria-live', 'polite');
      this.announcementElement.setAttribute('aria-atomic', 'true');
      this.announcementElement.className = 'sr-only';
      document.body.appendChild(this.announcementElement);
    }
  }

  /**
   * Announce a message to screen readers
   * @param {string} message - Message to announce
   * @param {string} priority - 'polite' or 'assertive'
   */
  announce(message, priority = 'polite') {
    if (!this.announcementElement) {
      this.initialize();
    }

    // Don't announce the same message twice in a row
    if (message === this.lastAnnouncement) {
      return;
    }

    this.lastAnnouncement = message;

    // Clear previous timeout
    if (this.announcementTimeout) {
      clearTimeout(this.announcementTimeout);
    }

    // Set the aria-live priority
    this.announcementElement.setAttribute('aria-live', priority);

    // Clear and set new message
    this.announcementElement.textContent = '';
    
    // Use timeout to ensure screen readers detect the change
    setTimeout(() => {
      this.announcementElement.textContent = message;
    }, 100);

    // Clear message after delay to allow re-announcement
    this.announcementTimeout = setTimeout(() => {
      this.lastAnnouncement = '';
    }, 5000);
  }

  /**
   * Announce audio playback state
   */
  announcePlayState(isPlaying, currentTime, duration) {
    const minutes = Math.floor(currentTime / 60);
    const seconds = Math.floor(currentTime % 60);
    const totalMinutes = Math.floor(duration / 60);
    const totalSeconds = Math.floor(duration % 60);
    
    const timeString = `${minutes}:${seconds.toString().padStart(2, '0')} of ${totalMinutes}:${totalSeconds.toString().padStart(2, '0')}`;
    
    if (isPlaying) {
      this.announce(`Playing at ${timeString}`);
    } else {
      this.announce(`Paused at ${timeString}`);
    }
  }

  /**
   * Announce loading state
   */
  announceLoading(filename) {
    this.announce(`Loading ${filename}`, 'assertive');
  }

  /**
   * Announce load complete
   */
  announceLoadComplete(filename, duration) {
    const minutes = Math.floor(duration / 60);
    const seconds = Math.floor(duration % 60);
    this.announce(`${filename} loaded, duration ${minutes}:${seconds.toString().padStart(2, '0')}`);
  }

  /**
   * Announce error
   */
  announceError(message) {
    this.announce(`Error: ${message}`, 'assertive');
  }

  /**
   * Announce seek/scrub position
   */
  announceSeek(currentTime, duration) {
    const minutes = Math.floor(currentTime / 60);
    const seconds = Math.floor(currentTime % 60);
    const percentage = Math.round((currentTime / duration) * 100);
    this.announce(`${percentage}% - ${minutes}:${seconds.toString().padStart(2, '0')}`);
  }
}

/**
 * Keyboard navigation manager
 */
export class KeyboardNavigationManager {
  constructor() {
    this.handlers = new Map();
    this.isEnabled = true;
  }

  /**
   * Initialize keyboard navigation
   * @param {Object} callbacks - Object with play, pause, seek, volumeUp, volumeDown callbacks
   */
  initialize(callbacks) {
    this.callbacks = callbacks;
    this.setupKeyboardListeners();
  }

  /**
   * Setup keyboard event listeners
   */
  setupKeyboardListeners() {
    document.addEventListener('keydown', (e) => {
      if (!this.isEnabled) return;

      // Ignore if user is typing in an input
      if (e.target.matches('input, textarea, select')) {
        return;
      }

      switch (e.key) {
        case ' ':
        case 'k':
          // Space or K: Play/Pause
          e.preventDefault();
          e.stopPropagation(); // ✅ FIX: Prevent multiple handlers from firing
          this.callbacks?.togglePlayPause?.();
          break;

        case 'ArrowLeft':
          // Left arrow: Seek backward 5s
          e.preventDefault();
          e.stopPropagation(); // ✅ FIX: Prevent multiple handlers from firing
          this.callbacks?.seekBackward?.(5);
          break;

        case 'ArrowRight':
          // Right arrow: Seek forward 5s
          e.preventDefault();
          e.stopPropagation(); // ✅ FIX: Prevent multiple handlers from firing
          this.callbacks?.seekForward?.(5);
          break;

        case 'ArrowUp':
          // Up arrow: Volume up
          e.preventDefault();
          e.stopPropagation(); // ✅ FIX: Prevent multiple handlers from firing
          this.callbacks?.volumeUp?.(0.1);
          break;

        case 'ArrowDown':
          // Down arrow: Volume down
          e.preventDefault();
          e.stopPropagation(); // ✅ FIX: Prevent multiple handlers from firing
          this.callbacks?.volumeDown?.(0.1);
          break;

        case 'm':
          // M: Mute/unmute
          e.preventDefault();
          e.stopPropagation(); // ✅ FIX: Prevent multiple handlers from firing
          this.callbacks?.toggleMute?.();
          break;

        case '0':
        case 'Home':
          // 0 or Home: Jump to start
          e.preventDefault();
          e.stopPropagation(); // ✅ FIX: Prevent multiple handlers from firing
          this.callbacks?.seekTo?.(0);
          break;

        case 'End':
          // End: Jump to end
          e.preventDefault();
          e.stopPropagation(); // ✅ FIX: Prevent multiple handlers from firing
          this.callbacks?.seekToEnd?.();
          break;

        case 'f':
          // F: Toggle fullscreen (if supported)
          e.preventDefault();
          e.stopPropagation(); // ✅ FIX: Prevent multiple handlers from firing
          this.callbacks?.toggleFullscreen?.();
          break;
      }
    });
  }

  /**
   * Enable keyboard navigation
   */
  enable() {
    this.isEnabled = true;
  }

  /**
   * Disable keyboard navigation
   */
  disable() {
    this.isEnabled = false;
  }
}

/**
 * ARIA attribute manager
 */
export class AriaManager {
  /**
   * Update ARIA attributes for canvas
   */
  static updateCanvasAria(canvas, state) {
    if (!canvas) return;

    // Set role and label
    canvas.setAttribute('role', 'application');
    canvas.setAttribute('aria-label', 'Spiral waveform audio player');
    
    // Set current state
    const { isPlaying, currentTime, duration } = state;
    const percentage = duration > 0 ? Math.round((currentTime / duration) * 100) : 0;
    
    canvas.setAttribute('aria-valuenow', percentage);
    canvas.setAttribute('aria-valuemin', '0');
    canvas.setAttribute('aria-valuemax', '100');
    canvas.setAttribute('aria-valuetext', `${percentage}% played`);
    
    // Set play state
    if (isPlaying) {
      canvas.setAttribute('aria-label', `Playing audio at ${percentage}%`);
    } else {
      canvas.setAttribute('aria-label', `Audio paused at ${percentage}%`);
    }
  }

  /**
   * Update ARIA for button elements
   */
  static updateButtonAria(button, label, state) {
    if (!button) return;
    
    button.setAttribute('role', 'button');
    button.setAttribute('aria-label', label);
    button.setAttribute('tabindex', '0');
    
    if (state) {
      button.setAttribute('aria-pressed', state.toString());
    }
  }

  /**
   * Set loading state
   */
  static setLoadingAria(element, isLoading) {
    if (!element) return;
    
    element.setAttribute('aria-busy', isLoading.toString());
    
    if (isLoading) {
      element.setAttribute('aria-label', 'Loading audio file');
    }
  }
}

// Create singleton instance
export const screenReaderAnnouncer = new ScreenReaderAnnouncer();

// Auto-initialize when DOM is ready
if (typeof window !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      screenReaderAnnouncer.initialize();
    });
  } else {
    screenReaderAnnouncer.initialize();
  }
}
