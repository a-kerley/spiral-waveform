import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Use happy-dom for DOM testing (lighter than jsdom)
    environment: 'happy-dom',
    
    // Global test utilities
    globals: true,
    
    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      exclude: [
        'node_modules/**',
        'test/**',
        '*.config.js',
        'js/main.js', // Entry point, tested via integration
        'js/logger.js', // Logging utility
      ],
      // Coverage thresholds
      lines: 70,
      functions: 70,
      branches: 65,
      statements: 70
    },
    
    // Test file patterns
    include: ['test/**/*.test.js'],
    
    // Setup files to run before tests
    setupFiles: ['./test/setup.js'],
    
    // Test timeout (5 seconds)
    testTimeout: 5000,
    
    // Reporter configuration
    reporters: ['verbose'],
    
    // Watch options
    watch: false,
    
    // Disable threads for better debugging
    threads: false,
    
    // Mock configuration
    mockReset: true,
    restoreMocks: true,
    clearMocks: true
  },
  
  // Resolve configuration for imports
  resolve: {
    alias: {
      '@': '/js'
    }
  }
});
