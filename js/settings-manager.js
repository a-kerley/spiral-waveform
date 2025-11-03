/**
 * Settings Manager
 * 
 * Manages persistent user settings using localStorage.
 * Automatically saves and restores settings across page reloads.
 * 
 * @module settings-manager
 */

import { system } from './logger.js';

/**
 * SettingsManager - Handles persistent storage of user preferences
 */
export class SettingsManager {
  static STORAGE_KEY = 'spiral-waveform-settings';
  static VERSION = 1;

  /**
   * Default settings
   */
  static DEFAULT_SETTINGS = {
    version: this.VERSION,
    lastUrl: '',
    volume: 1.0,
    lastFileName: '',
    theme: 'dark',
    // Add more settings as needed
  };

  /**
   * Load settings from localStorage
   * @returns {Object} Settings object
   */
  static load() {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      
      if (!stored) {
        system('No stored settings found, using defaults', 'debug');
        return { ...this.DEFAULT_SETTINGS };
      }

      const settings = JSON.parse(stored);

      // Version migration if needed
      if (settings.version !== this.VERSION) {
        system(`Migrating settings from v${settings.version} to v${this.VERSION}`, 'info');
        return this.migrate(settings);
      }

      system('Settings loaded successfully', 'debug');
      return { ...this.DEFAULT_SETTINGS, ...settings };

    } catch (error) {
      system(`Failed to load settings: ${error.message}`, 'error');
      return { ...this.DEFAULT_SETTINGS };
    }
  }

  /**
   * Save settings to localStorage
   * @param {Object} settings - Settings object to save
   * @returns {boolean} Success status
   */
  static save(settings) {
    try {
      const toSave = {
        ...settings,
        version: this.VERSION,
        lastSaved: new Date().toISOString(),
      };

      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(toSave));
      system('Settings saved successfully', 'debug');
      return true;

    } catch (error) {
      system(`Failed to save settings: ${error.message}`, 'error');
      return false;
    }
  }

  /**
   * Update a specific setting
   * @param {string} key - Setting key
   * @param {*} value - Setting value
   * @returns {boolean} Success status
   */
  static update(key, value) {
    const settings = this.load();
    settings[key] = value;
    return this.save(settings);
  }

  /**
   * Get a specific setting
   * @param {string} key - Setting key
   * @param {*} defaultValue - Default value if not found
   * @returns {*} Setting value
   */
  static get(key, defaultValue = null) {
    const settings = this.load();
    return settings[key] !== undefined ? settings[key] : defaultValue;
  }

  /**
   * Clear all settings
   * @returns {boolean} Success status
   */
  static clear() {
    try {
      localStorage.removeItem(this.STORAGE_KEY);
      system('Settings cleared', 'info');
      return true;
    } catch (error) {
      system(`Failed to clear settings: ${error.message}`, 'error');
      return false;
    }
  }

  /**
   * Migrate settings from older versions
   * @private
   * @param {Object} oldSettings - Old settings object
   * @returns {Object} Migrated settings
   */
  static migrate(oldSettings) {
    const newSettings = { ...this.DEFAULT_SETTINGS };

    // Copy over compatible settings
    Object.keys(oldSettings).forEach(key => {
      if (key in newSettings && key !== 'version') {
        newSettings[key] = oldSettings[key];
      }
    });

    // Save migrated settings
    this.save(newSettings);
    return newSettings;
  }

  /**
   * Check if localStorage is available
   * @returns {boolean} Availability status
   */
  static isAvailable() {
    try {
      const test = '__localStorage_test__';
      localStorage.setItem(test, test);
      localStorage.removeItem(test);
      return true;
    } catch (error) {
      system('localStorage is not available', 'warn');
      return false;
    }
  }

  /**
   * Get storage usage information
   * @returns {Object} Storage info
   */
  static getStorageInfo() {
    try {
      const settings = localStorage.getItem(this.STORAGE_KEY);
      const sizeBytes = settings ? new Blob([settings]).size : 0;
      const sizeKB = (sizeBytes / 1024).toFixed(2);

      return {
        available: this.isAvailable(),
        sizeBytes,
        sizeKB,
        lastSaved: this.get('lastSaved'),
      };
    } catch (error) {
      return {
        available: false,
        error: error.message,
      };
    }
  }

  /**
   * Export settings as JSON string
   * @returns {string} JSON string of settings
   */
  static export() {
    const settings = this.load();
    return JSON.stringify(settings, null, 2);
  }

  /**
   * Import settings from JSON string
   * @param {string} jsonString - JSON string of settings
   * @returns {boolean} Success status
   */
  static import(jsonString) {
    try {
      const settings = JSON.parse(jsonString);
      
      // Validate settings
      if (typeof settings !== 'object' || settings === null) {
        throw new Error('Invalid settings format');
      }

      return this.save(settings);
    } catch (error) {
      system(`Failed to import settings: ${error.message}`, 'error');
      return false;
    }
  }

  /**
   * Dispose of settings manager (no-op for localStorage-based implementation)
   * Provided for consistency with other managers
   */
  static dispose() {
    // SettingsManager doesn't hold references that need cleanup
    // Settings remain in localStorage for persistence
    system('SettingsManager dispose called (no action needed)', 'debug');
  }
}

// Convenience exports
export function loadSettings() {
  return SettingsManager.load();
}

export function saveSettings(settings) {
  return SettingsManager.save(settings);
}

export function updateSetting(key, value) {
  return SettingsManager.update(key, value);
}

export function getSetting(key, defaultValue) {
  return SettingsManager.get(key, defaultValue);
}

export function clearSettings() {
  return SettingsManager.clear();
}
