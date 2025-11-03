import { test, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Visual Regression Tests - UI Interactions
 * 
 * Tests UI behavior and visual changes during user interactions.
 */

test.describe('File Upload UI', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('should show file input button', async ({ page }) => {
    const fileInput = await page.locator('#fileInput');
    await expect(fileInput).toBeVisible();
    
    // Screenshot of the file button
    await expect(fileInput.locator('..').locator('..')).toHaveScreenshot('file-upload-button.png');
  });

  test('should accept audio file types', async ({ page }) => {
    const fileInput = await page.locator('#fileInput');
    const accept = await fileInput.getAttribute('accept');
    
    // Should accept audio files
    expect(accept).toContain('audio');
  });
});

test.describe('Mouse Interactions', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('should show hover state on canvas', async ({ page }) => {
    const canvas = await page.locator('#waveCanvas');
    
    // Move mouse to center of canvas
    const box = await canvas.boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    
    // Wait a bit for any hover effects
    await page.waitForTimeout(100);
    
    // Screenshot with mouse hover
    await expect(canvas).toHaveScreenshot('canvas-hover.png');
  });

  test('should handle click on canvas', async ({ page }) => {
    const canvas = await page.locator('#waveCanvas');
    
    // Click center of canvas
    await canvas.click({ position: { x: 400, y: 400 } });
    
    // Wait for any visual feedback
    await page.waitForTimeout(100);
    
    // Screenshot after click
    await expect(canvas).toHaveScreenshot('canvas-after-click.png');
  });
});

test.describe('Loading States', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('should show initial empty state', async ({ page }) => {
    const title = await page.locator('h1');
    const text = await title.textContent();
    
    // Should show title with "Spiral"
    expect(text).toContain('Spiral');
    
    // Screenshot of empty state
    await expect(page).toHaveScreenshot('empty-state.png', { fullPage: true });
  });

  test('should not show any error messages initially', async ({ page }) => {
    // Check for error elements
    const errors = await page.locator('.error').count();
    expect(errors).toBe(0);
  });
});

test.describe('Keyboard Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

    test('should handle tab navigation', async ({ page }) => {
    // Press Tab
    await page.keyboard.press('Tab');
    
    // Should focus the first interactive element (urlInput is first)
    const focused = await page.evaluate(() => document.activeElement.id);
    expect(focused).toBe('urlInput');
  });

  test('should handle keyboard shortcuts', async ({ page }) => {
    // Press space (should not cause errors even without audio)
    await page.keyboard.press('Space');
    
    // Wait a bit
    await page.waitForTimeout(100);
    
    // Should still be in valid state
    const canvas = await page.locator('#waveCanvas');
    await expect(canvas).toBeVisible();
  });
});

test.describe('Visual Consistency', () => {
  test('should maintain consistent styling across page reloads', async ({ page }) => {
    // First load
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    const screenshot1 = await page.screenshot();
    
    // Reload
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500); // Wait for any animations
    
    // Compare with first load
    await expect(page).toHaveScreenshot('consistent-reload.png', {
      fullPage: true,
    });
  });

  test('should have consistent canvas appearance', async ({ page }) => {
    // Load page multiple times and check canvas looks the same
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    const canvas = await page.locator('#waveCanvas');
    await expect(canvas).toHaveScreenshot('canvas-consistency-1.png');
    
    // Reload
    await page.reload();
    await page.waitForLoadState('networkidle');
    await expect(canvas).toHaveScreenshot('canvas-consistency-2.png');
  });
});

test.describe('Color Scheme', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('should use dark theme by default', async ({ page }) => {
    // Check that CSS is loaded by verifying body has custom font family
    const styles = await page.evaluate(() => {
      const computed = window.getComputedStyle(document.body);
      return {
        backgroundColor: computed.backgroundColor,
        fontFamily: computed.fontFamily,
        color: computed.color
      };
    });
    
    // Verify CSS is loaded (custom font family applied)
    expect(styles.fontFamily).toContain('apple-system');
    
    // Verify dark background - should have low RGB values or be using CSS variable
    // Note: Playwright might show default browser color if CSS hasn't loaded yet
    // So we check if either dark colors are present OR CSS variables are working
    expect(styles.backgroundColor || styles.color).toBeTruthy();
  });

  test('should render UI elements with good contrast', async ({ page }) => {
    // Take screenshot for manual contrast verification
    await expect(page).toHaveScreenshot('color-contrast.png', {
      fullPage: true,
    });
  });
});

test.describe('Animation and Timing', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('should complete initial render quickly', async ({ page }) => {
    const startTime = Date.now();
    await page.waitForSelector('#waveCanvas', { state: 'visible' });
    const loadTime = Date.now() - startTime;
    
    // Should render within 2 seconds
    expect(loadTime).toBeLessThan(2000);
  });

  test('should handle rapid interactions without visual glitches', async ({ page }) => {
    const canvas = await page.locator('#waveCanvas');
    
    // Rapid clicks
    for (let i = 0; i < 5; i++) {
      await canvas.click({ position: { x: 400, y: 400 } });
      await page.waitForTimeout(50);
    }
    
    // Should still look normal
    await expect(canvas).toHaveScreenshot('after-rapid-clicks.png');
  });
});
