import { describe, expect, it } from 'vitest';
import { applyAnnotationsToIr } from './annotation_store.js';
import { annotationSchema } from './ir.js';
import { buildMinimalPdfIr } from './test-helpers.js';

describe('annotation_store', () => {
  it('applies relabel and stub annotations to the IR', () => {
    const ir = buildMinimalPdfIr();
    const annotations = [
      annotationSchema.parse({
        id: 'annotation:1',
        targetType: 'block',
        targetId: 'block:1:test',
        action: 'relabel',
        payload: {
          blockType: 'stat_block',
          roleHint: 'npc_profile',
          confidence: 0.42,
        },
        comment: 'This is a profile block.',
        author: 'user',
        createdAt: '2026-04-25T10:00:00.000Z',
        source: 'manual_annotation',
        sourceBlockIds: ['block:1:test'],
        confidence: 1,
        provenance: {
          producer: 'test',
          rule: 'fixture.v1',
        },
      }),
      annotationSchema.parse({
        id: 'annotation:2',
        targetType: 'block',
        targetId: 'block:1:test',
        action: 'mark_stub',
        payload: {
          stubType: 'npc_stub',
          label: 'Elidan',
        },
        author: 'user',
        createdAt: '2026-04-25T10:01:00.000Z',
        source: 'manual_annotation',
        sourceBlockIds: ['block:1:test'],
        confidence: 1,
        provenance: {
          producer: 'test',
          rule: 'fixture.v1',
        },
      }),
    ];

    const updated = applyAnnotationsToIr(ir, annotations);

    expect(updated.blocks[0].blockType).toBe('stat_block');
    expect(updated.blocks[0].roleHint).toBe('npc_profile');
    expect(updated.blocks[0].confidence).toBe(0.42);
    expect(updated.entityStubs).toHaveLength(1);
    expect(updated.entityStubs[0].label).toBe('Elidan');
    expect(updated.entityStubs[0].stubType).toBe('npc_stub');
  });

  it('splits and merges blocks in the projected IR', () => {
    const ir = buildMinimalPdfIr({
      blocks: [
        {
          id: 'block:1:test',
          pageId: 'page:1:test',
          pageNumber: 1,
          bbox: { x: 0, y: 0, w: 250, h: 200 },
          readingOrder: 1,
          blockType: 'paragraph',
          textRaw: 'Alpha',
          textNormalized: 'Alpha',
          source: 'text_layer',
          confidence: 0.9,
          provenance: {
            producer: 'test',
            rule: 'fixture.v1',
          },
          style: {},
          links: {},
        },
        {
          id: 'block:2:test',
          pageId: 'page:1:test',
          pageNumber: 1,
          bbox: { x: 260, y: 0, w: 250, h: 200 },
          readingOrder: 2,
          blockType: 'paragraph',
          textRaw: 'Beta',
          textNormalized: 'Beta',
          source: 'text_layer',
          confidence: 0.9,
          provenance: {
            producer: 'test',
            rule: 'fixture.v1',
          },
          style: {},
          links: {},
        },
      ],
    });

    const updated = applyAnnotationsToIr(ir, [
      annotationSchema.parse({
        id: 'annotation:split',
        targetType: 'block',
        targetId: 'block:1:test',
        action: 'split',
        payload: {
          bbox: { x: 10, y: 12, w: 80, h: 40 },
          text: 'Alpha split',
        },
        author: 'user',
        createdAt: '2026-04-25T10:02:00.000Z',
        source: 'manual_annotation',
        sourceBlockIds: ['block:1:test'],
        confidence: 1,
        provenance: {
          producer: 'test',
          rule: 'fixture.v1',
        },
      }),
      annotationSchema.parse({
        id: 'annotation:merge',
        targetType: 'block',
        targetId: 'block:1:test',
        action: 'merge',
        payload: {
          blockIds: ['block:1:test', 'block:2:test'],
        },
        author: 'user',
        createdAt: '2026-04-25T10:03:00.000Z',
        source: 'manual_annotation',
        sourceBlockIds: ['block:1:test', 'block:2:test'],
        confidence: 1,
        provenance: {
          producer: 'test',
          rule: 'fixture.v1',
        },
      }),
    ]);

    const merged = updated.blocks.find((block) => block.blockType === 'paragraph' && block.textRaw.includes('Alpha') && block.textRaw.includes('Beta'));
    const splitBlock = updated.blocks.find((block) => block.id.startsWith('block:split:'));

    expect(splitBlock).toBeTruthy();
    expect(splitBlock?.bbox).toEqual({ x: 10, y: 12, w: 80, h: 40 });
    expect(merged).toBeTruthy();
    expect(merged?.sourceBlockIds).toEqual(['block:1:test', 'block:2:test']);
    expect(updated.blocks).toHaveLength(2);
  });
});
