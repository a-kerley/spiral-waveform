/**
 * User-Facing Error UI
 * 
 * Provides styled error overlays, loading states, and user notifications
 * to replace browser alerts with better UX.
 * 
 * @module error-ui
 */

import { COLOR_THEME } from './constants.js';
import { system } from './logger.js';

/**
 * ErrorUI class for managing user-facing notifications
 */
export class ErrorUI {
  static #overlayElement = null;
  static #loadingElement = null;
  static #currentToast = null;

  /**
   * Initialize the error UI system
   * Creates the necessary DOM elements but keeps them hidden
   */
  static initialize() {
    if (this.#overlayElement) {
      return; // Already initialized
    }

    // Create overlay container
    this.#overlayElement = document.createElement('div');
    this.#overlayElement.id = 'error-overlay';
    this.#overlayElement.className = 'error-overlay hidden';
    document.body.appendChild(this.#overlayElement);

    // Create loading overlay
    this.#loadingElement = document.createElement('div');
    this.#loadingElement.id = 'loading-overlay';
    this.#loadingElement.className = 'loading-overlay hidden';
    document.body.appendChild(this.#loadingElement);

    // Add styles
    this.#injectStyles();

    system('ErrorUI initialized', 'debug');
  }

  /**
   * Show an error message to the user
   * @param {Error|string} error - Error object or message string
   * @param {Object} options - Display options
   * @param {boolean} options.dismissible - Whether user can dismiss (default: true)
   * @param {string} options.actionText - Text for action button (optional)
   * @param {Function} options.onAction - Callback for action button (optional)
   * @param {number} options.autoDismiss - Auto-dismiss after milliseconds (optional)
   */
  static showError(error, options = {}) {
    this.initialize();

    const {
      dismissible = true,
      actionText = null,
      onAction = null,
      autoDismiss = null
    } = options;

    // Extract message from Error object or use string directly
    const message = error instanceof Error ? error.message : String(error);
    const title = 'Error';

    // Clear existing content
    this.#overlayElement.innerHTML = '';

    // Create error card
    const card = document.createElement('div');
    card.className = 'error-card error-type';

    // Title
    const titleEl = document.createElement('div');
    titleEl.className = 'error-title';
    titleEl.innerHTML = `<span class="error-icon">⚠️</span> ${title}`;
    card.appendChild(titleEl);

    // Message
    const messageEl = document.createElement('div');
    messageEl.className = 'error-message';
    messageEl.textContent = message;
    card.appendChild(messageEl);

    // Error details (if available)
    if (error instanceof Error && error.stack) {
      const detailsToggle = document.createElement('button');
      detailsToggle.className = 'error-details-toggle';
      detailsToggle.textContent = 'Show Details';
      
      const detailsEl = document.createElement('pre');
      detailsEl.className = 'error-details hidden';
      detailsEl.textContent = error.stack;

      detailsToggle.addEventListener('click', () => {
        detailsEl.classList.toggle('hidden');
        detailsToggle.textContent = detailsEl.classList.contains('hidden') 
          ? 'Show Details' 
          : 'Hide Details';
      });

      card.appendChild(detailsToggle);
      card.appendChild(detailsEl);
    }

    // Actions
    const actions = document.createElement('div');
    actions.className = 'error-actions';

    // Custom action button
    if (actionText && onAction) {
      const actionBtn = document.createElement('button');
      actionBtn.className = 'error-action-btn primary';
      actionBtn.textContent = actionText;
      actionBtn.addEventListener('click', () => {
        onAction();
        this.hide();
      });
      actions.appendChild(actionBtn);
    }

    // Dismiss button
    if (dismissible) {
      const dismissBtn = document.createElement('button');
      dismissBtn.className = 'error-action-btn';
      dismissBtn.textContent = actionText ? 'Cancel' : 'Dismiss';
      dismissBtn.addEventListener('click', () => this.hide());
      actions.appendChild(dismissBtn);
    }

    card.appendChild(actions);
    this.#overlayElement.appendChild(card);

    // Show overlay
    this.#overlayElement.classList.remove('hidden');

    // Auto-dismiss
    if (autoDismiss) {
      setTimeout(() => this.hide(), autoDismiss);
    }

    // Close on overlay click (if dismissible)
    if (dismissible) {
      this.#overlayElement.addEventListener('click', (e) => {
        if (e.target === this.#overlayElement) {
          this.hide();
        }
      });
    }

    system(`Error displayed: ${message}`, 'error');
  }

  /**
   * Show a warning message
   * @param {string} message - Warning message
   * @param {Object} options - Display options
   */
  static showWarning(message, options = {}) {
    this.initialize();

    const card = document.createElement('div');
    card.className = 'error-card warning-type';

    const titleEl = document.createElement('div');
    titleEl.className = 'error-title';
    titleEl.innerHTML = `<span class="error-icon">⚠️</span> Warning`;
    card.appendChild(titleEl);

    const messageEl = document.createElement('div');
    messageEl.className = 'error-message';
    messageEl.textContent = message;
    card.appendChild(messageEl);

    const actions = document.createElement('div');
    actions.className = 'error-actions';

    const dismissBtn = document.createElement('button');
    dismissBtn.className = 'error-action-btn';
    dismissBtn.textContent = 'OK';
    dismissBtn.addEventListener('click', () => this.hide());
    actions.appendChild(dismissBtn);

    card.appendChild(actions);

    this.#overlayElement.innerHTML = '';
    this.#overlayElement.appendChild(card);
    this.#overlayElement.classList.remove('hidden');

    if (options.autoDismiss) {
      setTimeout(() => this.hide(), options.autoDismiss);
    }
  }

  /**
   * Show a success message
   * @param {string} message - Success message
   * @param {number} duration - Duration in ms (default: 3000)
   */
  static showSuccess(message, duration = 3000) {
    this.#showToast(message, 'success', duration);
  }

  /**
   * Show an info message
   * @param {string} message - Info message
   * @param {number} duration - Duration in ms (default: 3000)
   */
  static showInfo(message, duration = 3000) {
    this.#showToast(message, 'info', duration);
  }

  /**
   * Show loading state
   * @param {string} message - Loading message (default: "Loading...")
   */
  static showLoading(message = 'Loading...') {
    this.initialize();

    this.#loadingElement.innerHTML = `
      <div class="loading-card">
        <div class="loading-spinner"></div>
        <div class="loading-message">${message}</div>
      </div>
    `;

    this.#loadingElement.classList.remove('hidden');
    system(`Loading state shown: ${message}`, 'debug');
  }

  /**
   * Hide loading state
   */
  static hideLoading() {
    if (this.#loadingElement) {
      this.#loadingElement.classList.add('hidden');
      system('Loading state hidden', 'debug');
    }
  }

  /**
   * Hide error overlay
   */
  static hide() {
    if (this.#overlayElement) {
      this.#overlayElement.classList.add('hidden');
      system('Error UI hidden', 'debug');
    }
  }

  /**
   * Show a toast notification
   * @private
   */
  static #showToast(message, type = 'info', duration = 3000) {
    this.initialize();

    // Remove existing toast
    if (this.#currentToast) {
      this.#currentToast.remove();
    }

    // Create toast
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    const icon = type === 'success' ? '✓' : type === 'error' ? '✗' : 'ℹ';
    toast.innerHTML = `<span class="toast-icon">${icon}</span><span class="toast-message">${message}</span>`;
    
    document.body.appendChild(toast);
    this.#currentToast = toast;

    // Animate in
    setTimeout(() => toast.classList.add('show'), 10);

    // Auto-dismiss
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => {
        toast.remove();
        if (this.#currentToast === toast) {
          this.#currentToast = null;
        }
      }, 300);
    }, duration);
  }

  /**
   * Inject CSS styles for error UI
   * @private
   */
  static #injectStyles() {
    if (document.getElementById('error-ui-styles')) {
      return; // Already injected
    }

    const style = document.createElement('style');
    style.id = 'error-ui-styles';
    style.textContent = `
      /* Error Overlay */
      .error-overlay {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.8);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
        padding: 20px;
        animation: fadeIn 0.2s ease-out;
      }

      .error-overlay.hidden {
        display: none;
      }

      .error-card {
        background: ${COLOR_THEME.BACKGROUND};
        border: 2px solid ${COLOR_THEME.ERROR};
        border-radius: 12px;
        padding: 24px;
        max-width: 500px;
        width: 100%;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
        animation: slideIn 0.3s ease-out;
      }

      .error-card.warning-type {
        border-color: ${COLOR_THEME.WARNING};
      }

      .error-title {
        font-size: 20px;
        font-weight: bold;
        color: ${COLOR_THEME.TEXT_PRIMARY};
        margin-bottom: 16px;
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .error-icon {
        font-size: 24px;
      }

      .error-message {
        color: ${COLOR_THEME.TEXT_PRIMARY};
        line-height: 1.5;
        margin-bottom: 20px;
        white-space: pre-wrap;
      }

      .error-details-toggle {
        background: ${COLOR_THEME.BUTTON_BG};
        color: ${COLOR_THEME.TEXT_PRIMARY};
        border: 1px solid ${COLOR_THEME.BUTTON_BORDER};
        padding: 8px 16px;
        border-radius: 6px;
        cursor: pointer;
        font-size: 14px;
        margin-bottom: 12px;
      }

      .error-details-toggle:hover {
        background: ${COLOR_THEME.BUTTON_HOVER};
      }

      .error-details {
        background: rgba(0, 0, 0, 0.3);
        padding: 12px;
        border-radius: 6px;
        font-family: monospace;
        font-size: 12px;
        color: ${COLOR_THEME.TEXT_SECONDARY};
        overflow-x: auto;
        max-height: 200px;
        overflow-y: auto;
        margin-bottom: 16px;
      }

      .error-details.hidden {
        display: none;
      }

      .error-actions {
        display: flex;
        gap: 12px;
        justify-content: flex-end;
      }

      .error-action-btn {
        padding: 10px 20px;
        border-radius: 6px;
        border: none;
        font-size: 14px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s;
        background: ${COLOR_THEME.BUTTON_BG};
        color: ${COLOR_THEME.TEXT_PRIMARY};
        border: 1px solid ${COLOR_THEME.BUTTON_BORDER};
      }

      .error-action-btn:hover {
        background: ${COLOR_THEME.BUTTON_HOVER};
      }

      .error-action-btn.primary {
        background: ${COLOR_THEME.INFO};
        color: white;
        border: none;
      }

      .error-action-btn.primary:hover {
        opacity: 0.9;
      }

      /* Loading Overlay */
      .loading-overlay {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.7);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 9999;
        animation: fadeIn 0.2s ease-out;
      }

      .loading-overlay.hidden {
        display: none;
      }

      .loading-card {
        background: ${COLOR_THEME.BACKGROUND};
        border: 2px solid ${COLOR_THEME.INFO};
        border-radius: 12px;
        padding: 32px;
        text-align: center;
      }

      .loading-spinner {
        width: 48px;
        height: 48px;
        border: 4px solid ${COLOR_THEME.BUTTON_BG};
        border-top-color: ${COLOR_THEME.INFO};
        border-radius: 50%;
        animation: spin 1s linear infinite;
        margin: 0 auto 16px;
      }

      .loading-message {
        color: ${COLOR_THEME.TEXT_PRIMARY};
        font-size: 16px;
      }

      /* Toast Notifications */
      .toast {
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${COLOR_THEME.BACKGROUND};
        border: 2px solid ${COLOR_THEME.INFO};
        border-radius: 8px;
        padding: 16px 20px;
        display: flex;
        align-items: center;
        gap: 12px;
        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
        z-index: 10001;
        opacity: 0;
        transform: translateX(400px);
        transition: all 0.3s ease-out;
      }

      .toast.show {
        opacity: 1;
        transform: translateX(0);
      }

      .toast-success {
        border-color: ${COLOR_THEME.SUCCESS};
      }

      .toast-error {
        border-color: ${COLOR_THEME.ERROR};
      }

      .toast-icon {
        font-size: 20px;
        font-weight: bold;
      }

      .toast-success .toast-icon {
        color: ${COLOR_THEME.SUCCESS};
      }

      .toast-error .toast-icon {
        color: ${COLOR_THEME.ERROR};
      }

      .toast-info .toast-icon {
        color: ${COLOR_THEME.INFO};
      }

      .toast-message {
        color: ${COLOR_THEME.TEXT_PRIMARY};
        font-size: 14px;
      }

      /* Animations */
      @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }

      @keyframes slideIn {
        from {
          transform: translateY(-20px);
          opacity: 0;
        }
        to {
          transform: translateY(0);
          opacity: 1;
        }
      }

      @keyframes spin {
        to { transform: rotate(360deg); }
      }

      /* Responsive */
      @media (max-width: 768px) {
        .error-card {
          margin: 20px;
          max-width: calc(100% - 40px);
        }

        .toast {
          right: 10px;
          left: 10px;
          max-width: calc(100% - 20px);
        }
      }
    `;
    document.head.appendChild(style);
  }
}

// Initialize on module load
ErrorUI.initialize();

// Convenience functions
export function showError(error, options) {
  return ErrorUI.showError(error, options);
}

export function showWarning(message, options) {
  return ErrorUI.showWarning(message, options);
}

export function showSuccess(message, duration) {
  return ErrorUI.showSuccess(message, duration);
}

export function showInfo(message, duration) {
  return ErrorUI.showInfo(message, duration);
}

export function showLoading(message) {
  return ErrorUI.showLoading(message);
}

export function hideLoading() {
  return ErrorUI.hideLoading();
}
