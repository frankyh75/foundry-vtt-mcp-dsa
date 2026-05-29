import { describe, expect, it } from 'vitest';
import { adventureImportSchema } from './schema.js';

describe('adventureImportSchema', () => {
  it('accepts a minimal valid adventure payload', () => {
    const payload = adventureImportSchema.parse({
      metadata: {
        title: 'Deicherbe',
        type: 'adventure',
        language: 'de',
      },
      chapters: [
        {
          title: 'Auftakt',
          summary: 'Die Helden treffen auf ein Kind in Not.',
        },
      ],
      npcs: [
        {
          name: 'Alsilio',
        },
      ],
    });

    expect(payload.metadata.title).toBe('Deicherbe');
    expect(payload.chapters).toHaveLength(1);
    expect(payload.npcs).toHaveLength(1);
  });

  it('rejects a chapter without a title', () => {
    expect(() =>
      adventureImportSchema.parse({
        metadata: {
          title: 'Deicherbe',
          type: 'adventure',
          language: 'de',
        },
        chapters: [
          {
            summary: 'Kapitel ohne Titel ist unvollständig.',
          },
        ],
      })
    ).toThrow();
  });

  it('rejects an npc without a name', () => {
    expect(() =>
      adventureImportSchema.parse({
        metadata: {
          title: 'Deicherbe',
          type: 'adventure',
          language: 'de',
        },
        npcs: [
          {
            role: 'protagonist',
          },
        ],
      })
    ).toThrow();
  });

  it('preserves warnings for uncertain fields', () => {
    const payload = adventureImportSchema.parse({
      metadata: {
        title: 'Deicherbe',
        type: 'adventure',
        language: 'de',
      },
      chapters: [],
      warnings: ['Ort unklar'],
    });

    expect(payload.warnings).toEqual(['Ort unklar']);
  });
});
