import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, expect, it, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  buildPdfImportIr: vi.fn(),
  createDefaultPdfToolRunner: vi.fn(),
}));

vi.mock('./pipeline.js', () => ({
  buildPdfImportIr: mocks.buildPdfImportIr,
}));

vi.mock('./tooling.js', () => ({
  createDefaultPdfToolRunner: mocks.createDefaultPdfToolRunner,
}));

import { runPdfImportCli } from './cli.js';

describe('runPdfImportCli', () => {
  beforeEach(() => {
    mocks.createDefaultPdfToolRunner.mockReset();
    mocks.buildPdfImportIr.mockReset();
  });

  it('writes the IR and annotation store to the resolved output paths', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'pdf-cli-'));
    const pdfPath = join(dir, 'sample.pdf');
    const outDir = join(dir, 'out');
    await writeFile(pdfPath, '%PDF-1.4\nfake\n', 'utf8');

    const fakeRunner = {
      pdfInfo: vi.fn(),
      pdfToText: vi.fn(),
      probeRender: vi.fn(),
      ocrPage: vi.fn(),
    };
    mocks.createDefaultPdfToolRunner.mockReturnValue(fakeRunner as any);
    mocks.buildPdfImportIr.mockResolvedValue({
      ir: {
        hello: 'world',
      },
      outputPath: join(outDir, 'doc:test.ir.json'),
      annotationStorePath: join(outDir, 'doc:test.annotations.json'),
      annotationStore: {
        storeVersion: 'adventure-layout-annotations.v1',
        documentId: 'doc:test',
        sourcePath: pdfPath,
        sourceHash: 'sha256:test',
        annotations: [],
      },
    });

    try {
      const result = await runPdfImportCli(['--pdf', pdfPath, '--out', outDir]);

      expect(mocks.createDefaultPdfToolRunner).toHaveBeenCalledTimes(1);
      expect(mocks.buildPdfImportIr).toHaveBeenCalledWith({
        pdfPath,
        outPath: outDir,
        runner: fakeRunner,
      });
      expect(result.outputPath).toBe(join(outDir, 'doc:test.ir.json'));
      expect(result.annotationStorePath).toBe(join(outDir, 'doc:test.annotations.json'));

      const outputJson = JSON.parse(await readFile(result.outputPath, 'utf8')) as Record<string, unknown>;
      const storeJson = JSON.parse(await readFile(result.annotationStorePath, 'utf8')) as Record<string, unknown>;
      expect(outputJson.hello).toBe('world');
      expect(storeJson.documentId).toBe('doc:test');
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('rejects missing required arguments', async () => {
    await expect(runPdfImportCli(['--out', '/tmp/out'])).rejects.toThrow(/Usage: pdf:import/);
  });
});
