import { defineConfig } from 'vite';
import { visualizer } from 'rollup-plugin-visualizer';
import viteCompression from 'vite-plugin-compression';

export default defineConfig({
  // Root directory
  root: '.',
  
  // Public base path
  base: './',
  
  // Build configuration
  build: {
    // Output directory
    outDir: 'dist',
    
    // Generate sourcemaps for debugging
    sourcemap: true,
    
    // Target modern browsers (ES2018+)
    target: 'es2018',
    
    // Minification
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: false, // Keep console for now
        drop_debugger: true,
        pure_funcs: ['console.debug'] // Remove debug logs in production
      }
    },
    
    // Rollup options
    rollupOptions: {
      input: {
        main: './index.html'
      },
      output: {
        // Manual code splitting for better caching
        manualChunks: {
          // Core state management
          'state': [
            './js/state-manager.js',
            './js/audio-state-adapter.js',
            './js/visual-state-adapter.js',
            './js/interaction-state-adapter.js'
          ],
          
          // Audio processing
          'audio': [
            './js/audio-playback.js',
            './js/audio-loader.js',
            './js/audio-controls.js',
            './js/waveform-data.js'
          ],
          
          // Rendering engine
          'rendering': [
            './js/waveform-draw.js',
            './js/canvas-setup.js',
            './js/animation.js',
            './js/layer-manager.js'
          ],
          
          // Interaction handling
          'interaction': [
            './js/interaction.js',
            './js/file-handler.js',
            './js/ui-controls.js'
          ],
          
          // Utilities and validation
          'utils': [
            './js/utils.js',
            './js/validation.js',
            './js/validation-config.js',
            './js/canvas-math.js',
            './js/trig-cache.js',
            './js/constants.js'
          ],
          
          // Performance and monitoring
          'monitoring': [
            './js/performance-monitor.js',
            './js/performance-overlay.js',
            './js/memory-manager.js',
            './js/logger.js'
          ]
        },
        
        // Naming pattern for chunks
        chunkFileNames: 'assets/js/[name]-[hash].js',
        entryFileNames: 'assets/js/[name]-[hash].js',
        assetFileNames: 'assets/[ext]/[name]-[hash].[ext]'
      }
    },
    
    // Asset handling
    assetsInlineLimit: 4096, // 4kb - inline smaller assets as base64
    
    // Chunk size warnings
    chunkSizeWarningLimit: 500 // Warn if chunk exceeds 500kb
  },
  
  // Development server configuration
  server: {
    port: 3000,
    strictPort: false, // Try next port if 3000 is taken
    open: true, // Auto-open browser
    cors: true,
    
    // Hot Module Replacement
    hmr: {
      overlay: true // Show errors as overlay
    }
  },
  
  // Preview server (production build preview)
  preview: {
    port: 4173,
    strictPort: false,
    open: true
  },
  
  // Plugins
  plugins: [
    // Gzip compression
    viteCompression({
      verbose: true,
      disable: false,
      threshold: 10240, // Only compress files > 10kb
      algorithm: 'gzip',
      ext: '.gz'
    }),
    
    // Brotli compression (better compression ratio)
    viteCompression({
      verbose: true,
      disable: false,
      threshold: 10240,
      algorithm: 'brotliCompress',
      ext: '.br'
    }),
    
    // Bundle visualization
    visualizer({
      filename: './dist/stats.html',
      open: false, // Don't auto-open
      gzipSize: true,
      brotliSize: true,
      template: 'treemap' // 'sunburst' | 'treemap' | 'network'
    })
  ],
  
  // Optimization
  optimizeDeps: {
    include: [
      // Pre-bundle these dependencies
    ],
    exclude: [
      // Don't pre-bundle these
    ]
  },
  
  // CSS configuration
  css: {
    devSourcemap: true
  },
  
  // Define global constants
  define: {
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version || '1.0.0'),
    __BUILD_TIME__: JSON.stringify(new Date().toISOString())
  }
});
