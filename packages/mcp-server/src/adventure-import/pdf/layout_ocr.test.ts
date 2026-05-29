import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, expect, it, vi } from 'vitest';
import { layoutOcrPdf } from './layout_ocr.js';

async function createTempPdfFile(): Promise<{ dir: string; pdfPath: string }> {
  const dir = await mkdtemp(join(tmpdir(), 'pdf-layout-ocr-'));
  const pdfPath = join(dir, 'sample.pdf');
  await writeFile(pdfPath, '%PDF-1.4\nfake\n', 'utf8');
  return { dir, pdfPath };
}

describe('layoutOcrPdf', () => {
  it('uses OCR blocks on image PDFs and keeps multiple raw blocks', async () => {
    const { dir, pdfPath } = await createTempPdfFile();
    const runner = {
      pdfInfo: vi.fn().mockResolvedValue('Pages: 1\nPage size: 595 x 842 pts\n'),
      pdfToText: vi.fn().mockResolvedValue(''),
      probeRender: vi.fn().mockResolvedValue(true),
      ocrPage: vi.fn().mockResolvedValue({
        available: true,
        engine: 'tesseract',
        text: 'Überschrift\n\nErster Absatz',
        blocks: [
          {
            kind: 'heading' as const,
            text: 'Überschrift',
            bbox: { x: 40, y: 30, w: 220, h: 36 },
            confidence: 97,
            readingOrder: 1,
            source: 'ocr' as const,
          },
          {
            kind: 'paragraph' as const,
            text: 'Erster Absatz',
            bbox: { x: 42, y: 110, w: 260, h: 58 },
            confidence: 93,
            readingOrder: 2,
            source: 'ocr' as const,
          },
        ],
        pageWidth: 595,
        pageHeight: 842,
      }),
    };

    try {
      const result = await layoutOcrPdf(
        {
          id: 'doc:test',
          sourcePath: pdfPath,
          sourceHash: 'sha256:test',
          pageCount: 1,
          pdfType: 'unknown',
          defaultLanguage: 'de',
        },
        [
          {
            id: 'page:test',
            pageNumber: 1,
            width: 595,
            height: 842,
          },
        ],
        runner,
      );

      expect(result.document.pdfType).toBe('image');
      expect(result.pages[0]?.layoutOcrStatus).toBe('needs_ocr');
      expect(result.pages[0]?.source).toBe('ocr');
      expect(result.rawBlocks).toHaveLength(2);
      expect(result.rawBlocks.map((block) => block.blockType)).toEqual(['heading', 'paragraph']);
      expect(result.rawBlocks.every((block) => block.textSource === 'ocr')).toBe(true);
      expect(result.pages[0]?.rawTextLength).toBeGreaterThan(0);
      expect(runner.ocrPage).toHaveBeenCalledTimes(1);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('makes missing OCR explicit instead of inventing page content', async () => {
    const { dir, pdfPath } = await createTempPdfFile();
    const runner = {
      pdfInfo: vi.fn().mockResolvedValue('Pages: 1\nPage size: 595 x 842 pts\n'),
      pdfToText: vi.fn().mockResolvedValue(''),
      probeRender: vi.fn().mockResolvedValue(true),
      ocrPage: vi.fn().mockResolvedValue({
        available: false,
        engine: 'missing' as const,
        reason: 'tesseract binary is not available on this machine',
        text: '',
        blocks: [],
        pageWidth: 0,
        pageHeight: 0,
      }),
    };

    try {
      const result = await layoutOcrPdf(
        {
          id: 'doc:test',
          sourcePath: pdfPath,
          sourceHash: 'sha256:test',
          pageCount: 1,
          pdfType: 'unknown',
          defaultLanguage: 'de',
        },
        [
          {
            id: 'page:test',
            pageNumber: 1,
            width: 595,
            height: 842,
          },
        ],
        runner,
      );

      expect(result.pages[0]?.layoutOcrStatus).toBe('needs_ocr');
      expect(result.pages[0]?.source).toBe('none');
      expect(result.pages[0]?.sourceBlockIds).toEqual([]);
      expect(result.rawBlocks).toHaveLength(0);
      expect(runner.ocrPage).toHaveBeenCalledTimes(1);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
