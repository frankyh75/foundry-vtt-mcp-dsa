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
    // Session-Input ist jetzt direkt in der Topbar sichtbar
    await page.locator('input[placeholder="Session-ID"]').fill('Deicherbe1');
    await page.getByRole('button', { name: /Session laden/i }).click();

    // Wait for session loaded indicator
    await expect(page.getByText('Session Deicherbe1 geladen.')).toBeVisible({ timeout: 15000 });

    // Bounding Boxes should appear
    await expect(page.locator('.block-box').first()).toBeVisible({ timeout: 15000 });

    // Screenshot for manual inspection
    await page.screenshot({ path: '/tmp/playwright-deicherbe1-loaded.png' });

    // Click first block
    const blocks = page.locator('.block-box');
    const count = await blocks.count();
    expect(count).toBeGreaterThan(0);
    await blocks.first().click();
    // PropertyPanel should become active when a block is selected
    const panel = page.locator('.property-panel');
    await expect(panel).toBeVisible();
  });

  test('Backend liefert Seitenbild als PNG', async () => {
    // Test the backend directly via fetch (not Playwright request context with frontend baseURL)
    const response = await fetch('http://192.168.178.133:4174/sessions/Deicherbe1/pages/1.png');
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('image/png');
  });
});
