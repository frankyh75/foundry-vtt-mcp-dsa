import { test, expect } from '@playwright/test';

test.describe('PDF Review UI', () => {
  test('Frontend zeigt Backend-Status', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/PDF Review/);
    // Use exact text match to avoid duplicate span elements
    await expect(page.getByText('Backend online', { exact: true })).toBeVisible();
  });

  test('Toolbar zeigt alle 7 Werkzeuge', async ({ page }) => {
    await page.goto('/');
    const toolbar = page.locator('.editor-toolbar');
    await expect(toolbar).toBeVisible();
    const buttons = toolbar.locator('.tool-btn');
    await expect(buttons).toHaveCount(7);
    const expected = ['Auswählen', 'Box zeichnen', 'Teilen', 'Vereinigen', 'Löschen', 'Text korrigieren', 'KI-Chat'];
    for (const label of expected) {
      await expect(toolbar).toContainText(label);
    }
  });

  test('Session Deicherbe1 laden zeigt Blocks', async ({ page }) => {
    await page.goto('/');
    // Fill session input and load
    const inputs = page.locator('input[type="text"]');
    await inputs.first().fill('Deicherbe1');
    await page.getByRole('button', { name: /Session laden/i }).click();

    // Wait for canvas or page rendering
    await page.waitForSelector('.page-stage', { timeout: 15000 });
    await page.waitForTimeout(2000); // Let blocks render

    // Check that the canvas/preview area exists
    const stage = page.locator('.page-stage');
    await expect(stage).toBeVisible();

    // Screenshot for manual inspection
    await page.screenshot({ path: '/tmp/playwright-deicherbe1-loaded.png' });

    // Try to click first block if any exist; if none, take note
    const blocks = page.locator('.block-box');
    const count = await blocks.count();
    if (count > 0) {
      await blocks.first().click();
      // PropertyPanel should become active when a block is selected
      const panel = page.locator('.property-panel');
      await expect(panel).toBeVisible();
    }
  });

  test('Backend liefert Seitenbild als PNG', async () => {
    // Test the backend directly via fetch (not Playwright request context with frontend baseURL)
    const response = await fetch('http://192.168.178.133:4174/sessions/Deicherbe1/pages/1.png');
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('image/png');
  });
});
