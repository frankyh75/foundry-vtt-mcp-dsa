import { test, expect } from '@playwright/test';

test.describe('Surya OCR Backend', () => {
  const sessionId = `SuryaTest-${Date.now()}`;

  test('Surya ist als Engine verfügbar', async ({ request }) => {
    const engines = await request.get('http://localhost:4174/engines');
    expect(engines.ok()).toBe(true);
    const data = await engines.json();
    expect(data.surya?.available).toBe(true);
  });

  test('Session mit Deicherbe-PDF erstellen', async ({ request }) => {
    const pdfPath = '/Users/openclaw/.foundry-mcp/pdf-review/copyright-material/fixtures/Deicherbe-p12-deichbauern.pdf';
    const upload = await request.put(`http://localhost:4174/sessions/${sessionId}/pdf`, {
      headers: { 'Content-Type': 'application/pdf' },
      multipart: {
        file: {
          name: 'Deicherbe-p12-deichbauern.pdf',
          mimeType: 'application/pdf',
          buffer: require('fs').readFileSync(pdfPath),
        },
      },
    });
    expect(upload.ok()).toBe(true);
    const data = await upload.json();
    expect(data.sessionId).toBe(sessionId);
  });

  test('Analyse mit Surya-OCR durchführen', async ({ request }) => {
    const analyze = await request.post(`http://localhost:4174/sessions/${sessionId}/analyze`, {
      headers: { 'Content-Type': 'application/json' },
      data: {
        config: {
          ocrEngine: 'surya',
          providerPreset: 'ollama',
          baseUrl: 'http://127.0.0.1:11434/v1',
          apiPath: '/chat/completions',
          model: 'qwen2.5:7b',
          apiKey: '',
          showExpertView: false,
          rememberLastSettings: false,
        },
      },
    });
    expect(analyze.ok()).toBe(true);
    const data = await analyze.json();
    expect(data.ok).toBe(true);
    expect(data.reviewConfig.ocrEngine).toBe('surya');
  });

  test('IR enthält Surya-Blöcke mit Bounding-Boxes', async ({ request }) => {
    const ir = await request.get(`http://localhost:4174/sessions/${sessionId}/ir`);
    expect(ir.ok()).toBe(true);
    const data = await ir.json();
    expect(data.blocks.length).toBeGreaterThan(0);
    expect(data.blocks.length).toBeLessThan(15); // Surya liefert weniger, bessere Blöcke

    // Prüfe Statblock-Erkennung
    const hasStatblock = data.blocks.some((b: any) =>
      b.blockType === 'paragraph' &&
      b.textRaw?.includes('MU') &&
      b.textRaw?.includes('KL') &&
      b.textRaw?.includes('CH')
    );
    expect(hasStatblock).toBe(true);

    // Prüfe Bounding-Boxes
    const block = data.blocks[0];
    expect(block.bbox).toBeDefined();
    expect(block.bbox.x).toBeGreaterThanOrEqual(0);
    expect(block.bbox.y).toBeGreaterThanOrEqual(0);
    expect(block.bbox.w).toBeGreaterThan(0);
    expect(block.bbox.h).toBeGreaterThan(0);
  });

  test('GUI zeigt PDF mit Bounding-Box-Overlays', async ({ page }) => {
    await page.goto('http://localhost:4173');
    await page.fill('[data-testid="session-input"]', sessionId);
    await page.click('[data-testid="session-load-btn"]');
    await page.waitForTimeout(2000);

    // Canvas ist sichtbar
    const canvas = page.locator('canvas.pdf-page');
    await expect(canvas).toBeVisible();

    // Bounding-Box-Overlays
    const boxes = page.locator('.pdf-block-overlay');
    const count = await boxes.count();
    expect(count).toBeGreaterThan(0);
    expect(count).toBeLessThan(15);
  });
});
