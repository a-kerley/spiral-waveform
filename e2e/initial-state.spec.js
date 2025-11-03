import { test, expect } from '@playwright/test';

/**
 * Visual Regression Tests - Initial State
 * 
 * Tests the initial render state of the spiral waveform player
 * before any audio is loaded.
 */

test.describe('Initial Application State', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the application
    await page.goto('/');
    
    // Wait for the page to be fully loaded
    await page.waitForLoadState('networkidle');
    
    // Wait for canvas to be rendered (ID is 'waveCanvas' not 'waveformCanvas')
    await page.waitForSelector('#waveCanvas', { state: 'visible', timeout: 10000 });
  });

  test('should display the initial UI correctly', async ({ page }) => {
    // Take a screenshot of the entire page
    await expect(page).toHaveScreenshot('initial-state.png', {
      fullPage: true,
    });
  });

  test('should display the canvas with correct dimensions', async ({ page }) => {
    const canvas = await page.locator('#waveCanvas');
    await expect(canvas).toBeVisible();
    
    // Check canvas is present and has reasonable dimensions
    const box = await canvas.boundingBox();
    expect(box.width).toBeGreaterThan(400);
    expect(box.height).toBeGreaterThan(400);
    
    // Screenshot just the canvas area
    await expect(canvas).toHaveScreenshot('initial-canvas.png');
  });

  test('should display the file input button', async ({ page }) => {
    const fileInput = await page.locator('#fileInput');
    await expect(fileInput).toBeVisible();
  });

  test('should display the title', async ({ page }) => {
    const title = await page.locator('h1');
    await expect(title).toBeVisible();
    
    // Check title text
    const text = await title.textContent();
    expect(text).toContain('Spiral');
  });

    test('should have correct initial viewport scaling', async ({ page }) => {
    const viewport = page.viewportSize();
    expect(viewport.width).toBe(1280);
    expect(viewport.height).toBe(720);
    
    const bodyStyle = await page.evaluate(() => {
      const style = window.getComputedStyle(document.body);
      return {
        margin: style.margin
      };
    });
    
    expect(bodyStyle.margin).toBe('0px');
  });
});

test.describe('UI Layout and Positioning', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('should position title near the top', async ({ page }) => {
    const title = await page.locator('h1');
    const box = await title.boundingBox();
    
    // Title should be near the top
    expect(box.y).toBeLessThan(100);
  });

  test('should position URL input near the top', async ({ page }) => {
    const urlInput = await page.locator('#urlInput');
    const box = await urlInput.boundingBox();
    
    // URL input should be near the top (after title and instructions)
    expect(box.y).toBeLessThan(250);
  });

  test('should center canvas on page', async ({ page }) => {
    const canvas = await page.locator('#waveCanvas');
    const canvasBox = await canvas.boundingBox();
    const viewportWidth = page.viewportSize().width;
    
    // Canvas should be roughly centered
    const center = canvasBox.x + canvasBox.width / 2;
    expect(Math.abs(center - viewportWidth / 2)).toBeLessThan(50);
  });
});

test.describe('Responsive Design', () => {
  const viewports = [
    { name: 'mobile', width: 375, height: 667 },
    { name: 'tablet', width: 768, height: 1024 },
    { name: 'desktop', width: 1920, height: 1080 },
  ];

  for (const viewport of viewports) {
    test(`should render correctly on ${viewport.name}`, async ({ page }) => {
      // Set viewport size
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      
      // Navigate and wait for load
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      await page.waitForSelector('#waveCanvas');
      
      // Take screenshot
      await expect(page).toHaveScreenshot(`${viewport.name}-view.png`, {
        fullPage: true,
      });
    });
  }
});

test.describe('Canvas Rendering', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('should render canvas without errors', async ({ page }) => {
    // Check for any console errors
    const errors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });
    
    // Wait a bit for any errors to appear
    await page.waitForTimeout(1000);
    
    // Should have no render errors
    expect(errors.filter(e => e.includes('canvas') || e.includes('render'))).toHaveLength(0);
  });

  test('should have canvas with 2d context', async ({ page }) => {
    const hasContext = await page.evaluate(() => {
      const canvas = document.getElementById('waveCanvas');
      const ctx = canvas?.getContext('2d');
      return ctx !== null && ctx !== undefined;
    });
    
    expect(hasContext).toBe(true);
  });

  test('should initialize with dark background', async ({ page }) => {
    // Canvas should have dark theme
    const canvas = await page.locator('#waveCanvas');
    
    // Take screenshot and verify it's not blank white
    await expect(canvas).toHaveScreenshot('canvas-dark-theme.png');
  });
});
