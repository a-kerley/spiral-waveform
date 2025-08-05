// ✅ Enhanced logging system with production controls
class Logger {
  constructor() {
    // ✅ NEW: Environment detection and configuration
    this.isDevelopment = this.detectEnvironment();
    this.logLevel = this.getLogLevel();
    this.enabledCategories = this.getEnabledCategories();
    this.enableTimestamps = true;
    this.enableEmojis = true;
    this.maxLogBuffer = 1000;
    this.logBuffer = [];
    
    // ✅ NEW: Performance tracking
    this.performanceMarks = new Map();
    
    console.log(`🔧 Logger initialized - Environment: ${this.isDevelopment ? 'Development' : 'Production'}, Level: ${this.logLevel}`);
  }

  // ✅ NEW: Environment detection
  detectEnvironment() {
    // Check for various development indicators
    return (
      // Local development
      window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1' ||
      window.location.hostname === '' ||
      // Development ports
      window.location.port !== '' ||
      // File protocol (local files)
      window.location.protocol === 'file:' ||
      // Explicit debug flag
      new URLSearchParams(window.location.search).has('debug') ||
      // Development build flag
      window.DEBUG === true ||
      // Console availability check
      typeof console !== 'undefined' && console.assert
    );
  }

  // ✅ NEW: Log level configuration
  getLogLevel() {
    // URL parameter override
    const urlParams = new URLSearchParams(window.location.search);
    const urlLevel = urlParams.get('logLevel');
    if (urlLevel) return urlLevel;
    
    // Environment-based defaults
    if (this.isDevelopment) return 'debug';
    return 'error'; // Production default - only errors
  }

  // ✅ NEW: Category filtering
  getEnabledCategories() {
    const urlParams = new URLSearchParams(window.location.search);
    const categories = urlParams.get('logCategories');
    
    if (categories) {
      return new Set(categories.split(',').map(c => c.trim()));
    }
    
    // Default categories based on environment
    if (this.isDevelopment) {
      return new Set(['audio', 'canvas', 'interaction', 'animation', 'file', 'ui', 'system']);
    } else {
      return new Set(['system']); // Production: only critical system logs
    }
  }

  // ✅ NEW: Log level hierarchy
  shouldLog(level, category = 'general') {
    const levels = {
      'debug': 0,
      'info': 1,
      'warn': 2,
      'error': 3
    };
    
    const currentLevelValue = levels[this.logLevel] || levels['error'];
    const messageLevelValue = levels[level] || levels['debug'];
    
    // Check level threshold
    if (messageLevelValue < currentLevelValue) return false;
    
    // Check category filtering
    if (!this.enabledCategories.has(category) && category !== 'system') return false;
    
    return true;
  }

  // ✅ NEW: Enhanced logging methods with categories
  debug(message, category = 'general', data = null) {
    this._log('debug', message, category, data, '🔍');
  }

  info(message, category = 'general', data = null) {
    this._log('info', message, category, data, 'ℹ️');
  }

  warn(message, category = 'general', data = null) {
    this._log('warn', message, category, data, '⚠️');
  }

  error(message, category = 'general', data = null) {
    this._log('error', message, category, data, '❌');
  }

  // ✅ NEW: Specialized category methods
  audio(message, level = 'info', data = null) {
    this._log(level, message, 'audio', data, '🎵');
  }

  canvas(message, level = 'info', data = null) {
    this._log(level, message, 'canvas', data, '🖼️');
  }

  interaction(message, level = 'info', data = null) {
    this._log(level, message, 'interaction', data, '🖱️');
  }

  animation(message, level = 'info', data = null) {
    this._log(level, message, 'animation', data, '🎬');
  }

  file(message, level = 'info', data = null) {
    this._log(level, message, 'file', data, '📁');
  }

  ui(message, level = 'info', data = null) {
    this._log(level, message, 'ui', data, '🎨');
  }

  system(message, level = 'info', data = null) {
    this._log(level, message, 'system', data, '🔧');
  }

  // ✅ NEW: Performance logging
  time(label, category = 'performance') {
    const key = `${category}:${label}`;
    this.performanceMarks.set(key, performance.now());
    this.debug(`⏱️ Timer started: ${label}`, category);
  }

  timeEnd(label, category = 'performance') {
    const key = `${category}:${label}`;
    const startTime = this.performanceMarks.get(key);
    
    if (startTime) {
      const duration = performance.now() - startTime;
      this.performanceMarks.delete(key);
      this.info(`⏱️ ${label}: ${duration.toFixed(2)}ms`, category);
      return duration;
    } else {
      this.warn(`⏱️ Timer '${label}' was not started`, category);
      return null;
    }
  }

  // ✅ NEW: Core logging implementation
  _log(level, message, category, data, emoji) {
    if (!this.shouldLog(level, category)) return;

    try {
      // Build log entry
      const timestamp = this.enableTimestamps ? 
        `[${new Date().toISOString().substr(11, 12)}]` : '';
      
      const categoryTag = category !== 'general' ? `[${category.toUpperCase()}]` : '';
      
      const emojiPrefix = this.enableEmojis && emoji ? `${emoji} ` : '';
      
      const logMessage = `${timestamp}${categoryTag} ${emojiPrefix}${message}`;
      
      // Store in buffer for debugging
      this.logBuffer.push({
        timestamp: Date.now(),
        level,
        category,
        message,
        data
      });
      
      // Trim buffer if too large
      if (this.logBuffer.length > this.maxLogBuffer) {
        this.logBuffer = this.logBuffer.slice(-this.maxLogBuffer);
      }

      // Output to console
      const consoleMethod = this._getConsoleMethod(level);
      if (data !== null && typeof data !== 'undefined') {
        consoleMethod(logMessage, data);
      } else {
        consoleMethod(logMessage);
      }

    } catch (error) {
      // Fallback logging if something goes wrong
      console.error('Logger error:', error);
      console.log(message, data);
    }
  }

  // ✅ NEW: Console method mapping
  _getConsoleMethod(level) {
    switch (level) {
      case 'debug': return console.debug || console.log;
      case 'info': return console.info || console.log;
      case 'warn': return console.warn || console.log;
      case 'error': return console.error || console.log;
      default: return console.log;
    }
  }

  // ✅ NEW: Utility methods
  group(label, category = 'general') {
    if (this.shouldLog('info', category) && console.group) {
      console.group(`🗂️ ${label}`);
    }
  }

  groupEnd() {
    if (console.groupEnd) {
      console.groupEnd();
    }
  }

  table(data, category = 'general') {
    if (this.shouldLog('info', category) && console.table) {
      console.table(data);
    }
  }

  // ✅ NEW: Debug utilities
  getLogBuffer() {
    return [...this.logBuffer];
  }

  clearBuffer() {
    this.logBuffer = [];
    this.info('Log buffer cleared', 'system');
  }

  exportLogs() {
    const logs = this.getLogBuffer();
    const blob = new Blob([JSON.stringify(logs, null, 2)], {
      type: 'application/json'
    });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `spiral-waveform-logs-${Date.now()}.json`;
    a.click();
    
    URL.revokeObjectURL(url);
    this.info('Logs exported', 'system');
  }

  // ✅ NEW: Configuration methods
  setLogLevel(level) {
    this.logLevel = level;
    this.info(`Log level changed to: ${level}`, 'system');
  }

  enableCategory(category) {
    this.enabledCategories.add(category);
    this.info(`Category enabled: ${category}`, 'system');
  }

  disableCategory(category) {
    this.enabledCategories.delete(category);
    this.info(`Category disabled: ${category}`, 'system');
  }

  getStatus() {
    return {
      environment: this.isDevelopment ? 'development' : 'production',
      logLevel: this.logLevel,
      enabledCategories: Array.from(this.enabledCategories),
      bufferSize: this.logBuffer.length,
      performanceTimers: this.performanceMarks.size
    };
  }
}

// ✅ NEW: Create singleton instance
const logger = new Logger();

// ✅ NEW: Expose global debug utilities
if (logger.isDevelopment) {
  window.logger = logger;
  window.loggerStatus = () => logger.getStatus();
  window.exportLogs = () => logger.exportLogs();
}

// ✅ NEW: Export for modules
export default logger;

// ✅ NEW: Export convenience methods
export const audio = (msg, level, data) => logger.audio(msg, level, data);
export const canvas = (msg, level, data) => logger.canvas(msg, level, data);
export const interaction = (msg, level, data) => logger.interaction(msg, level, data);
export const animation = (msg, level, data) => logger.animation(msg, level, data);
export const file = (msg, level, data) => logger.file(msg, level, data);
export const ui = (msg, level, data) => logger.ui(msg, level, data);
export const system = (msg, level, data) => logger.system(msg, level, data);
export const time = (label, category) => logger.time(label, category);
export const timeEnd = (label, category) => logger.timeEnd(label, category);
