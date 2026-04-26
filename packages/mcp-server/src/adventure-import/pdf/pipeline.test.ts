import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, expect, it, vi } from 'vitest';
import { buildPdfImportIr } from './pipeline.js';

async function createTempPdfFile(): Promise<{ dir: string; pdfPath: string }> {
  const dir = await mkdtemp(join(tmpdir(), 'pdf-import-pipeline-'));
  const pdfPath = join(dir, 'sample.pdf');
  await writeFile(pdfPath, '%PDF-1.4\nfake\n', 'utf8');
  return { dir, pdfPath };
}

describe('buildPdfImportIr', () => {
  it('marks image-like PDFs as needing OCR instead of inventing text', async () => {
    const { dir, pdfPath } = await createTempPdfFile();
    const runner = {
      pdfInfo: vi.fn().mockResolvedValue('Pages: 2\nPage size: 595 x 842 pts\n'),
      pdfToText: vi.fn().mockResolvedValue(''),
      probeRender: vi.fn().mockResolvedValue(true),
      ocrPage: vi.fn().mockResolvedValue({
        available: true,
        engine: 'tesseract',
        text: 'Seite 1 OCR',
        blocks: [
          {
            kind: 'heading',
            text: 'Seite 1 OCR',
            bbox: { x: 10, y: 10, w: 200, h: 30 },
            confidence: 96,
            readingOrder: 1,
            source: 'ocr',
          },
        ],
        pageWidth: 595,
        pageHeight: 842,
      }),
    };

    try {
      const result = await buildPdfImportIr({
        pdfPath,
        outPath: join(dir, 'out'),
        runner,
      });

      expect(result.ir.document.pdfType).toBe('image');
      expect(result.ir.pages).toHaveLength(2);
      expect(result.ir.pages.every((page) => page.layoutOcrStatus === 'needs_ocr')).toBe(true);
      expect(result.ir.blocks.length).toBeGreaterThanOrEqual(2);
      expect(result.ir.blocks.every((block) => block.blockType === 'heading' || block.blockType === 'unknown')).toBe(true);
      expect(result.ir.blocks.some((block) => block.textRaw.length > 0)).toBe(true);
      expect(result.ir.importPlan).toHaveLength(0);
      expect(runner.pdfToText).toHaveBeenCalledTimes(2);
      expect(runner.probeRender).toHaveBeenCalledTimes(2);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('builds a conservative stub plan from a text-layer page', async () => {
    const { dir, pdfPath } = await createTempPdfFile();
    const runner = {
      pdfInfo: vi.fn().mockResolvedValue('Pages: 1\nPage size: 595 x 842 pts\n'),
      pdfToText: vi.fn().mockResolvedValue(
        'Elidan, ehemaliger Waldbauer und angehender Deichbauer, beschreibt die Arbeit am Deich und die Sorgen der Nachbarn.'
      ),
      probeRender: vi.fn(),
      ocrPage: vi.fn(),
    };

    try {
      const result = await buildPdfImportIr({
        pdfPath,
        outPath: join(dir, 'out'),
        runner,
      });

      expect(result.ir.document.pdfType).toBe('text');
      expect(result.ir.blocks[0].roleHint).toBe('npc_profile');
      expect(result.ir.entityCandidates.length).toBeGreaterThanOrEqual(1);
      expect(result.ir.entityStubs.length).toBeGreaterThanOrEqual(1);
      expect(result.ir.importPlan.length).toBeGreaterThanOrEqual(1);
      expect(result.ir.importPlan[0].targetType).toBe('foundry_actor');
      expect(result.ir.importPlan[0].requiresReview).toBe(true);
      expect(runner.probeRender).not.toHaveBeenCalled();
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
