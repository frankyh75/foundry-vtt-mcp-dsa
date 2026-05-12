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

  it('extracts DSA5 statblock into import plan payload', async () => {
    const { dir, pdfPath } = await createTempPdfFile();
    const runner = {
      pdfInfo: vi.fn().mockResolvedValue('Pages: 1\nPage size: 595 x 842 pts\n'),
      pdfToText: vi.fn().mockResolvedValue(
        'Deichbauern\nMU 12 KL 11 IN 12 CH 11\nFF 14 GE 13 KO 13 KK 13\nLeP 31 AsP - KaP - INI 13+1W6\nSK 1 ZK 2 AW 7 GS 8\nDeichgabel: AT 10 PA 4 TP 1W6+2 RW mittel'
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

      // Pipeline-End-to-End: Statblock -> IR -> Import-Plan
      expect(result.ir.importPlan.length).toBeGreaterThanOrEqual(1);
      const npcPlan = result.ir.importPlan.find((p) => p.targetSubtype === 'npc');
      expect(npcPlan).toBeDefined();
      expect(npcPlan?.targetType).toBe('foundry_actor');

      // Payload enthält Statblock-Daten
      const payload = npcPlan?.payload as Record<string, unknown>;
      expect(payload.name).toBe('Deichbauern');

      const system = payload.system as Record<string, unknown>;
      expect(system.characteristics).toBeDefined();
      const characteristics = system.characteristics as Record<string, unknown>;
      expect(characteristics.mu).toEqual({ value: 12 });
      expect(characteristics.ff).toEqual({ value: 14 });

      const status = system.status as Record<string, unknown>;
      expect(status.wounds).toEqual({ initial: 31 });
      expect(status.ini).toEqual({ value: '13+1W6' });
      expect(status.sk).toEqual({ value: 1 });

      const combat = system.combat as Record<string, unknown>;
      expect(combat.weapons).toBeDefined();
      const weapons = combat.weapons as Array<Record<string, unknown>>;
      expect(weapons[0].name).toBe('Deichgabel');
      expect(weapons[0].tp).toBe('1W6+2');
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
