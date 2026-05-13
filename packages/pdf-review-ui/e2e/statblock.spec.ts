import { test, expect } from '@playwright/test';

async function loadSession(page: any, sessionId: string) {
  await page.goto('http://localhost:4173/');
  await page.locator('input[placeholder="Session-ID"]').fill(sessionId);
  await page.getByRole('button', { name: /Session laden/i }).click();
  await expect(page.getByText(`Session ${sessionId} geladen.`)).toBeVisible({ timeout: 15000 });
}

async function selectPage(page: any, pageNumber: number) {
  // Seite auswählen — die GUI hat Buttons mit Text "Seite N"
  await page.getByRole('button', { name: new RegExp(`Seite ${pageNumber} `) }).first().click();
  await page.waitForTimeout(500);
}

test.describe('Statblock-Erkennung', () => {
  test('Deichbauern Seite 12 hat stat_block roleHint', async ({ page }) => {
    await loadSession(page, 'Deicherbe1');
    await selectPage(page, 12);

    // Prüfe: es gibt Blöcke mit data-role="stat_block"
    const statblocks = page.locator('[data-role="stat_block"]');
    const count = await statblocks.count();
    expect(count).toBeGreaterThanOrEqual(1);

    // Erster Statblock muss MU und LeP enthalten
    const firstText = await statblocks.first().textContent();
    expect(firstText).toMatch(/MU\s+\d+/);
    expect(firstText).toMatch(/LeP\s+\d+/);
  });

  test('Keine false positives auf nicht-Statblock-Seiten', async ({ page }) => {
    await loadSession(page, 'Deicherbe1');
    await selectPage(page, 1); // Cover/Titel

    const statblocks = page.locator('[data-role="stat_block"]');
    const count = await statblocks.count();
    expect(count).toBe(0);
  });
});
