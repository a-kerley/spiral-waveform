# Spiral Waveform - Logging Configuration

## Overview
The application uses a comprehensive logging system that automatically adapts between development and production environments.

## Environment Detection
The logger automatically detects the environment based on:
- **Development**: localhost, 127.0.0.1, file:// protocol, non-empty port, debug URL parameter
- **Production**: All other scenarios

## Default Logging Levels

### Development Mode
- **Log Level**: `debug` (shows all logs)
- **Categories**: All enabled (`audio`, `canvas`, `interaction`, `animation`, `file`, `ui`, `system`)
- **Features**: Full logging with emojis, timestamps, performance timing

### Production Mode
- **Log Level**: `error` (only critical errors)
- **Categories**: Only `system` (critical application errors)
- **Features**: Minimal logging, no performance overhead

## URL Parameter Overrides

You can control logging behavior via URL parameters:

### Log Level Control
```
?logLevel=debug    # Show all logs (including debug)
?logLevel=info     # Show info, warn, and error logs
?logLevel=warn     # Show only warnings and errors
?logLevel=error    # Show only errors (production default)
```

### Category Control
```
?logCategories=audio,canvas    # Only show audio and canvas logs
?logCategories=system         # Only show system logs
?logCategories=all            # Show all categories
```

### Debug Mode
```
?debug=true    # Force development mode regardless of environment
```

## Examples

### Production with Debug Logging
```
https://your-domain.com/spiral-waveform?logLevel=info&logCategories=audio,system
```

### Development with Limited Logging
```
http://localhost:3000?logLevel=error
```

### Performance Testing
```
http://localhost:3000?logLevel=warn&logCategories=system
```

## Programming Interface

### Basic Logging
```javascript
import logger from './js/logger.js';

logger.debug('Debug message');
logger.info('Info message');
logger.warn('Warning message');
logger.error('Error message');
```

### Category-Specific Logging
```javascript
import { audio, canvas, interaction } from './js/logger.js';

audio('Audio loaded successfully');
canvas('Canvas resized', 'info', { width: 800, height: 600 });
interaction('User clicked play button', 'debug');
```

### Performance Timing
```javascript
logger.time('operation-name', 'performance');
// ... do work ...
logger.timeEnd('operation-name', 'performance');
```

### Runtime Configuration
```javascript
// Change log level
logger.setLogLevel('debug');

// Enable/disable categories
logger.enableCategory('audio');
logger.disableCategory('canvas');

// Get current status
console.log(logger.getStatus());
```

## Debug Utilities (Development Only)

When in development mode, these utilities are available globally:

```javascript
// Check logger status
loggerStatus();

// Export logs to file
exportLogs();

// Access full logger
logger.getLogBuffer();
logger.clearBuffer();
```

## Production Optimization

In production, the logging system:
- Automatically filters out debug/info logs
- Reduces memory usage by limiting log buffer
- Disables performance timing unless specifically enabled
- Uses minimal console output

## Log Categories

- **`audio`**: Audio playback, loading, scrubbing, context management
- **`canvas`**: Canvas rendering, resizing, initialization
- **`interaction`**: User input, mouse/touch events, drag operations  
- **`animation`**: Animation loops, transitions, timing
- **`file`**: File loading, format detection, processing
- **`ui`**: User interface creation, controls, keyboard input
- **`system`**: Application lifecycle, errors, critical events

## Best Practices

1. **Use appropriate log levels**:
   - `debug`: Detailed flow information
   - `info`: Important milestones  
   - `warn`: Recoverable issues
   - `error`: Critical failures

2. **Include relevant data**:
   ```javascript
   logger.audio('Playback started', 'info', { 
     duration: audioBuffer.duration,
     sampleRate: audioBuffer.sampleRate 
   });
   ```

3. **Use performance timing for optimization**:
   ```javascript
   logger.time('waveform-draw', 'performance');
   drawWaveform();
   logger.timeEnd('waveform-draw', 'performance');
   ```

4. **Categorize logs appropriately** for easy filtering

## File Structure

- `js/logger.js` - Main logging system
- `LOGGING.md` - This configuration guide (this file)
- All other JS files import and use the logging system

## Migration Notes

All existing `console.log`, `console.warn`, `console.error` calls have been replaced with the new logging system, providing:
- Environment-aware logging
- Category-based filtering  
- Performance tracking
- Production optimization
- Debug utilities
