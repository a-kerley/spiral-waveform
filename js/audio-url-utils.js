/**
 * Audio URL Utilities
 * 
 * Handles URL processing, validation, and conversion for audio loading.
 * Supports direct URLs, Dropbox links, and other streaming services.
 * 
 * @module audio-url-utils
 */

import { TypeValidator, ValidationError } from './validation.js';
import { system } from './logger.js';

/**
 * URL Types
 */
export const URL_TYPES = {
  DIRECT: 'direct',
  DROPBOX: 'dropbox',
  GOOGLE_DRIVE: 'google-drive',
  STREAMING: 'streaming',
  UNKNOWN: 'unknown'
};

/**
 * Audio URL utilities class
 */
export class AudioUrlUtils {
  /**
   * Detect the type of URL
   * @param {string} url - URL to analyze
   * @returns {string} URL type from URL_TYPES
   */
  static detectUrlType(url) {
    if (!TypeValidator.isString(url, { minLength: 1 })) {
      return URL_TYPES.UNKNOWN;
    }

    const urlLower = url.toLowerCase();

    if (urlLower.includes('dropbox.com')) {
      return URL_TYPES.DROPBOX;
    }

    if (urlLower.includes('drive.google.com') || urlLower.includes('docs.google.com')) {
      return URL_TYPES.GOOGLE_DRIVE;
    }

    // Check for direct audio file extensions
    const audioExtensions = ['.mp3', '.wav', '.ogg', '.m4a', '.aac', '.flac', '.webm', '.opus'];
    if (audioExtensions.some(ext => urlLower.includes(ext))) {
      return URL_TYPES.DIRECT;
    }

    // Check for streaming patterns
    if (urlLower.includes('/stream') || urlLower.includes('/audio') || urlLower.includes('/media')) {
      return URL_TYPES.STREAMING;
    }

    return URL_TYPES.UNKNOWN;
  }

  /**
   * Convert Dropbox sharing URL to direct download URL
   * Handles both legacy and modern Dropbox URL formats
   * 
   * @param {string} url - Dropbox sharing URL
   * @returns {string} Direct download URL
   */
  static convertDropboxUrl(url) {
    if (!TypeValidator.isString(url, { minLength: 1 })) {
      throw new ValidationError('Invalid URL for Dropbox conversion', 'url', url, 'string');
    }

    if (!url.includes('dropbox.com')) {
      // Not a Dropbox URL, return as-is
      return url;
    }

    system(`Converting Dropbox URL: ${url.substring(0, 50)}...`, 'debug');

    // Modern Dropbox sharing links: /scl/fi/ format
    if (url.includes('/scl/fi/')) {
      // Method 1: Convert to raw download URL
      let directUrl = url
        .replace('www.dropbox.com', 'dl.dropboxusercontent.com')
        .replace('dropbox.com', 'dl.dropboxusercontent.com');

      // Handle rlkey parameter for modern links
      if (url.includes('?rlkey=')) {
        directUrl = directUrl.replace('?rlkey=', '?raw=1&rlkey=');
      } else if (!directUrl.includes('raw=1')) {
        directUrl += (directUrl.includes('?') ? '&' : '?') + 'raw=1';
      }

      // Replace dl=1 with raw=1 if present
      directUrl = directUrl.replace('dl=1', 'raw=1');

      system(`Converted modern Dropbox URL to: ${directUrl.substring(0, 50)}...`, 'debug');
      return directUrl;
    }

    // Legacy Dropbox links
    let directUrl = url;

    // Ensure dl=1 parameter for download
    if (url.includes('dl=0')) {
      directUrl = url.replace('dl=0', 'dl=1');
    } else if (!url.includes('dl=1')) {
      directUrl = url + (url.includes('?') ? '&' : '?') + 'dl=1';
    }

    system(`Converted legacy Dropbox URL to: ${directUrl.substring(0, 50)}...`, 'debug');
    return directUrl;
  }

  /**
   * Convert Google Drive sharing URL to direct download URL
   * 
   * @param {string} url - Google Drive sharing URL
   * @returns {string} Direct download URL
   */
  static convertGoogleDriveUrl(url) {
    if (!TypeValidator.isString(url, { minLength: 1 })) {
      throw new ValidationError('Invalid URL for Google Drive conversion', 'url', url, 'string');
    }

    if (!url.includes('drive.google.com') && !url.includes('docs.google.com')) {
      // Not a Google Drive URL, return as-is
      return url;
    }

    system(`Converting Google Drive URL: ${url.substring(0, 50)}...`, 'debug');

    // Extract file ID from various Google Drive URL formats
    let fileId = null;

    // Format 1: /file/d/FILE_ID/
    const match1 = url.match(/\/file\/d\/([^/]+)/);
    if (match1) {
      fileId = match1[1];
    }

    // Format 2: id=FILE_ID
    const match2 = url.match(/[?&]id=([^&]+)/);
    if (match2) {
      fileId = match2[1];
    }

    if (!fileId) {
      system('Could not extract Google Drive file ID', 'warn');
      return url;
    }

    // Convert to direct download URL
    const directUrl = `https://drive.google.com/uc?export=download&id=${fileId}`;
    system(`Converted Google Drive URL to: ${directUrl}`, 'debug');
    return directUrl;
  }

  /**
   * Convert any supported sharing URL to a direct download URL
   * 
   * @param {string} url - Sharing URL
   * @returns {string} Direct download URL
   */
  static convertToDirectUrl(url) {
    if (!TypeValidator.isString(url, { minLength: 1 })) {
      throw new ValidationError('Invalid URL', 'url', url, 'string');
    }

    const urlType = this.detectUrlType(url);

    switch (urlType) {
      case URL_TYPES.DROPBOX:
        return this.convertDropboxUrl(url);
      
      case URL_TYPES.GOOGLE_DRIVE:
        return this.convertGoogleDriveUrl(url);
      
      case URL_TYPES.DIRECT:
      case URL_TYPES.STREAMING:
      case URL_TYPES.UNKNOWN:
      default:
        return url;
    }
  }

  /**
   * Validate and sanitize a URL
   * 
   * @param {string} url - URL to validate
   * @returns {string} Sanitized URL
   * @throws {ValidationError} If URL is invalid
   */
  static sanitizeUrl(url) {
    if (!TypeValidator.isString(url, { minLength: 1 })) {
      throw new ValidationError('Invalid URL: must be a non-empty string', 'url', url, 'string');
    }

    // Trim whitespace
    url = url.trim();

    // Basic URL validation
    try {
      const urlObj = new URL(url);
      
      // Only allow http and https protocols
      if (urlObj.protocol !== 'http:' && urlObj.protocol !== 'https:') {
        throw new ValidationError(
          `Invalid URL protocol: ${urlObj.protocol} (only http and https allowed)`,
          'url.protocol',
          urlObj.protocol,
          'http: or https:'
        );
      }

      return url;
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new ValidationError(
        `Invalid URL format: ${error.message}`,
        'url',
        url,
        'valid URL string'
      );
    }
  }

  /**
   * Check if a URL points to a streaming source
   * 
   * @param {string} url - URL to check
   * @returns {boolean} True if URL is likely a streaming source
   */
  static isStreamingUrl(url) {
    if (!TypeValidator.isString(url, { minLength: 1 })) {
      return false;
    }

    const streamingIndicators = [
      '/stream',
      '/live',
      '/broadcast',
      '.m3u8',
      '.m3u',
      '.pls',
      'icecast',
      'shoutcast'
    ];

    const urlLower = url.toLowerCase();
    return streamingIndicators.some(indicator => urlLower.includes(indicator));
  }

  /**
   * Get a user-friendly description of the URL type
   * 
   * @param {string} url - URL to describe
   * @returns {string} Human-readable URL type description
   */
  static describeUrl(url) {
    const type = this.detectUrlType(url);

    const descriptions = {
      [URL_TYPES.DIRECT]: 'Direct audio file',
      [URL_TYPES.DROPBOX]: 'Dropbox shared file',
      [URL_TYPES.GOOGLE_DRIVE]: 'Google Drive file',
      [URL_TYPES.STREAMING]: 'Streaming audio source',
      [URL_TYPES.UNKNOWN]: 'Unknown audio source'
    };

    return descriptions[type] || descriptions[URL_TYPES.UNKNOWN];
  }

  /**
   * Extract filename from URL
   * 
   * @param {string} url - URL to extract filename from
   * @returns {string|null} Filename or null if not found
   */
  static extractFilename(url) {
    if (!TypeValidator.isString(url, { minLength: 1 })) {
      return null;
    }

    try {
      const urlObj = new URL(url);
      const pathname = urlObj.pathname;
      const segments = pathname.split('/');
      const lastSegment = segments[segments.length - 1];

      // Remove query parameters
      const filename = lastSegment.split('?')[0];

      // Check if it looks like a filename (has extension)
      if (filename && filename.includes('.')) {
        return decodeURIComponent(filename);
      }

      return null;
    } catch (error) {
      system('Failed to extract filename from URL', 'warn', error);
      return null;
    }
  }

  /**
   * Validate that URL is accessible (perform a HEAD request)
   * 
   * @param {string} url - URL to validate
   * @returns {Promise<{accessible: boolean, contentType: string|null, contentLength: number|null}>}
   */
  static async validateUrlAccessibility(url) {
    try {
      const sanitizedUrl = this.sanitizeUrl(url);
      
      // Perform HEAD request to check accessibility
      const response = await fetch(sanitizedUrl, {
        method: 'HEAD',
        mode: 'cors'
      });

      const contentType = response.headers.get('content-type');
      const contentLength = response.headers.get('content-length');

      return {
        accessible: response.ok,
        contentType: contentType,
        contentLength: contentLength ? parseInt(contentLength) : null,
        status: response.status,
        statusText: response.statusText
      };
    } catch (error) {
      system('URL accessibility check failed', 'warn', error);
      return {
        accessible: false,
        contentType: null,
        contentLength: null,
        status: null,
        statusText: error.message
      };
    }
  }
}

/**
 * Convenience function: Convert URL to direct download URL
 * @param {string} url - Sharing URL
 * @returns {string} Direct download URL
 */
export function toDirectUrl(url) {
  return AudioUrlUtils.convertToDirectUrl(url);
}

/**
 * Convenience function: Sanitize URL
 * @param {string} url - URL to sanitize
 * @returns {string} Sanitized URL
 */
export function sanitizeUrl(url) {
  return AudioUrlUtils.sanitizeUrl(url);
}

/**
 * Convenience function: Detect URL type
 * @param {string} url - URL to analyze
 * @returns {string} URL type
 */
export function detectUrlType(url) {
  return AudioUrlUtils.detectUrlType(url);
}
