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
});
