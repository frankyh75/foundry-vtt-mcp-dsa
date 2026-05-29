import { describe, expect, it } from 'vitest';
import { adventureLayoutIrV1Schema } from './ir.js';

describe('adventureLayoutIrV1Schema', () => {
  it('accepts a minimal IR payload and applies defaults', () => {
    const ir = adventureLayoutIrV1Schema.parse({
      irVersion: 'adventure-layout-ir.v1',
      document: {
        id: 'doc:test',
        sourcePath: '/tmp/test.pdf',
        sourceHash: 'sha256:test',
        pdfType: 'unknown',
        pageCount: 1,
        defaultLanguage: 'de',
        profile: 'ulisses.heldenwerk.v1',
        createdAt: '2026-04-25T00:00:00.000Z',
        source: 'pdf',
        confidence: 1,
        provenance: {
          producer: 'test',
          rule: 'fixture.v1',
        },
      },
      pages: [
        {
          id: 'page:1:test',
          documentId: 'doc:test',
          pageNumber: 1,
          width: 595,
          height: 842,
          ocrMode: 'none',
          layoutOcrStatus: 'unsupported',
          textSource: 'unknown',
          readingOrderVersion: 1,
          source: 'unknown',
          confidence: 1,
          provenance: {
            producer: 'test',
            rule: 'fixture.v1',
          },
        },
      ],
      blocks: [
        {
          id: 'block:1:test',
          pageId: 'page:1:test',
          pageNumber: 1,
          bbox: {
            x: 0,
            y: 0,
            w: 595,
            h: 842,
          },
          readingOrder: 1,
          blockType: 'paragraph',
          textRaw: 'Test block',
          textNormalized: 'Test block',
          source: 'text_layer',
          confidence: 0.8,
          provenance: {
            producer: 'test',
            rule: 'fixture.v1',
          },
        },
      ],
      sections: [],
      entityCandidates: [],
      entityStubs: [],
      annotations: [],
      importPlan: [],
    });

    expect(ir.document.id).toBe('doc:test');
    expect(ir.pages[0].sourceBlockIds).toEqual([]);
    expect(ir.blocks[0].style).toEqual({});
    expect(ir.blocks[0].links).toEqual({});
  });
});
