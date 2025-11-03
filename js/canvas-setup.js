import { CONFIG } from './utils.js';

// ✅ NEW: Error types for better error handling
import { CanvasValidation, ValidationError, TypeValidator, ensureType } from './validation.js';
import { canvas as canvasLog, system } from './logger.js';
import { layerManager } from './layer-manager.js';

class CanvasError extends Error {
  constructor(message, type = 'CANVAS_ERROR') {
    super(message);
    this.name = 'CanvasError';
    this.type = type;
  }
}

// ✅ IMPROVED: Enhanced validation and error handling with comprehensive type checking
export function setupResponsiveCanvas(canvas, context) {
  try {
    // ✅ NEW: Comprehensive input validation
    CanvasValidation.validateCanvas(canvas, 'setupResponsiveCanvas canvas');
    CanvasValidation.validateCanvasContext(context, 'setupResponsiveCanvas context');

    // ✅ NEW: Environment validation
    if (typeof window === 'undefined') {
      throw new CanvasError('Window object not available', 'NO_WINDOW');
    }

    const dpr = ensureType(
      window.devicePixelRatio,
      (v) => TypeValidator.isNumber(v, { min: 0.1, max: 10 }),
      1,
      'devicePixelRatio'
    );
    
    const padding = 24 * 2; // match CSS
    
    // ✅ NEW: Validate window dimensions with fallbacks
    const windowWidth = ensureType(
      window.innerWidth,
      (v) => TypeValidator.isNumber(v, { min: 100, max: 10000 }),
      800,
      'window.innerWidth'
    );
    
    const windowHeight = ensureType(
      window.innerHeight,
      (v) => TypeValidator.isNumber(v, { min: 100, max: 10000 }),
      600,
      'window.innerHeight'
    );
    
    const size = Math.min(windowWidth - padding, windowHeight - padding);
    
    // ✅ IMPROVED: Ensure minimum viable size with validation
    const minSize = 100;
    const maxSize = 4000; // Prevent excessive memory usage
    const finalSize = Math.max(minSize, Math.min(size, maxSize));
    
    if (finalSize !== size) {
      canvasLog(`Canvas size adjusted from ${size}px to ${finalSize}px (constraints: ${minSize}-${maxSize}px)`, 'warn');
    }

    // ✅ IMPROVED: Validate calculated dimensions before applying
    const canvasWidth = finalSize * dpr;
    const canvasHeight = finalSize * dpr;
    
    // ✅ NEW: Comprehensive dimension validation
    CanvasValidation.validateDimensions(canvasWidth, canvasHeight, 'calculated canvas dimensions');
    
    if (canvasWidth > 8192 || canvasHeight > 8192) {
      throw new CanvasError(`Canvas dimensions too large: ${canvasWidth}x${canvasHeight} (max: 8192x8192)`, 'DIMENSIONS_TOO_LARGE');
    }

    // ✅ NEW: Safe property assignment with validation
    try {
      canvas.width = canvasWidth;
      canvas.height = canvasHeight;
      canvas.style.width = finalSize + 'px';
      canvas.style.height = finalSize + 'px';

      // ✅ NEW: Validate the transform operation
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      
      // ✅ NEW: Verify the setup worked
      if (canvas.width !== canvasWidth || canvas.height !== canvasHeight) {
        throw new CanvasError('Canvas dimension assignment failed', 'ASSIGNMENT_FAILED');
      }
      
    } catch (transformError) {
      throw new CanvasError(`Failed to setup canvas transform: ${transformError.message}`, 'TRANSFORM_FAILED');
    }
    
    // ✅ NEW: Initialize layer manager for performance optimization
    try {
      layerManager.initialize(canvasWidth, canvasHeight, dpr);
    } catch (layerError) {
      canvasLog(`Failed to initialize layer manager: ${layerError.message}`, 'warn');
      // Non-fatal error - continue with non-layered rendering
    }
    
    canvasLog(`Canvas setup complete: ${finalSize}px display (${canvasWidth}x${canvasHeight} internal, DPR: ${dpr})`, 'info');
    
  } catch (error) {
    if (error instanceof CanvasError || error instanceof ValidationError) {
      throw error;
    }
    throw new CanvasError(`Failed to setup responsive canvas: ${error.message}`, 'SETUP_FAILED');
  }
}

// ✅ IMPROVED: Robust canvas initialization with comprehensive error handling
export function initializeCanvas() {
  try {
    // ✅ NEW: Validate browser environment
    if (typeof document === 'undefined') {
      throw new CanvasError('Document not available (not in browser environment)', 'NO_DOCUMENT');
    }
    
    if (typeof window === 'undefined') {
      throw new CanvasError('Window not available (not in browser environment)', 'NO_WINDOW');
    }

    // ✅ IMPROVED: Enhanced canvas creation with validation
    const canvas = document.createElement('canvas');
    if (!canvas || !(canvas instanceof HTMLCanvasElement)) {
      throw new CanvasError('Failed to create canvas element', 'CANVAS_CREATION_FAILED');
    }
    
    canvas.id = 'waveCanvas';
    canvas.tabIndex = 0; // Make canvas focusable for accessibility/touch

    // ✅ IMPROVED: Better context acquisition with fallbacks
    let ctx = null;
    const contextOptions = { 
      alpha: true, 
      desynchronized: true, // Better performance for animations
      willReadFrequently: false // We don't read pixel data frequently
    };
    
    try {
      ctx = canvas.getContext('2d', contextOptions);
    } catch (contextError) {
      console.warn('⚠️ Failed to get 2D context with options, trying without options');
      ctx = canvas.getContext('2d');
    }
    
    // ✅ IMPROVED: Throw error instead of returning null objects
    if (!ctx) {
      throw new CanvasError(
        'Could not get 2D rendering context. This browser may not support HTML5 Canvas.',
        'CONTEXT_UNAVAILABLE'
      );
    }
    
    // ✅ NEW: Validate context capabilities
    if (typeof ctx.setTransform !== 'function') {
      throw new CanvasError('Canvas context missing required methods', 'INCOMPLETE_CONTEXT');
    }

    // ✅ IMPROVED: Setup canvas with proper error handling
    try {
      setupResponsiveCanvas(canvas, ctx);
    } catch (setupError) {
      throw new CanvasError(
        `Failed to setup responsive canvas: ${setupError.message}`,
        'SETUP_FAILED'
      );
    }
    
    // ✅ NEW: Validate final canvas state
    if (canvas.width <= 0 || canvas.height <= 0) {
      throw new CanvasError(
        `Invalid final canvas dimensions: ${canvas.width}x${canvas.height}`,
        'INVALID_FINAL_DIMENSIONS'
      );
    }

    console.log('✅ Canvas created and initialized successfully');
    
    return { canvas, ctx, error: null };
    
  } catch (error) {
    // ✅ IMPROVED: Comprehensive error logging and handling
    console.error('❌ Canvas initialization failed:', error);
    
    // ✅ NEW: Create fallback error state instead of returning null
    const errorState = {
      canvas: null,
      ctx: null,
      error: error instanceof CanvasError ? error : new CanvasError(error.message, 'UNKNOWN_ERROR'),
      isError: true
    };
    
    // ✅ NEW: Attempt to provide helpful error messages to user
    displayCanvasError(errorState.error);
    
    return errorState;
  }
}

// ✅ NEW: User-friendly error display function
function displayCanvasError(error) {
  let userMessage = 'Unable to initialize graphics. ';
  
  switch (error.type) {
    case 'CONTEXT_UNAVAILABLE':
      userMessage += 'Your browser may not support HTML5 Canvas. Please try updating your browser.';
      break;
    case 'NO_DOCUMENT':
    case 'NO_WINDOW':
      userMessage += 'This application requires a browser environment.';
      break;
    case 'INVALID_DIMENSIONS':
      userMessage += 'Please ensure your browser window is large enough.';
      break;
    default:
      userMessage += 'Please refresh the page or try a different browser.';
  }
  
  // ✅ NEW: Try to display error to user if possible
  try {
    const errorElement = document.createElement('div');
    errorElement.style.cssText = `
      position: fixed;
      top: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: #ff4444;
      color: white;
      padding: 12px 20px;
      border-radius: 4px;
      font-family: Arial, sans-serif;
      z-index: 10000;
      max-width: 90%;
      text-align: center;
    `;
    errorElement.textContent = userMessage;
    document.body.appendChild(errorElement);
    
    // ✅ NEW: Auto-remove error message after 10 seconds
    setTimeout(() => {
      if (errorElement.parentNode) {
        errorElement.parentNode.removeChild(errorElement);
      }
    }, 10000);
  } catch (displayError) {
    console.warn('Could not display error message to user:', displayError);
  }
}

// ✅ NEW: Utility function to validate canvas setup
export function validateCanvasSetup(canvasResult) {
  if (!canvasResult) {
    throw new CanvasError('No canvas result provided', 'NO_RESULT');
  }
  
  if (canvasResult.isError) {
    throw canvasResult.error;
  }
  
  if (!canvasResult.canvas || !canvasResult.ctx) {
    throw new CanvasError('Canvas or context is missing from result', 'MISSING_COMPONENTS');
  }
  
  return true;
}