import { describe, expect, it } from 'vitest';
import { chunkAdventureText, normalizeAdventureText } from './text-normalizer.js';

describe('normalizeAdventureText', () => {
  it('removes repeated headers, footers and page numbers', () => {
    const raw = [
      'DSA5 Abenteuer: Deicherbe',
      'Seite 1',
      '',
      '1. Auftakt',
      'Die Helden sehen ein Kind im Watt.',
      '',
      'Seite 2',
      'DSA5 Abenteuer: Deicherbe',
    ].join('\n');

    const cleaned = normalizeAdventureText(raw);

    expect(cleaned).toContain('1. Auftakt');
    expect(cleaned).toContain('Die Helden sehen ein Kind im Watt.');
    expect(cleaned).not.toContain('DSA5 Abenteuer: Deicherbe');
    expect(cleaned).not.toContain('Seite 1');
    expect(cleaned).not.toContain('Seite 2');
  });
});

describe('chunkAdventureText', () => {
  it('splits text into chunks without breaking paragraphs', () => {
    const text = [
      '1. Auftakt',
      'Die Helden sehen ein Kind im Watt.',
      '',
      '2. Hof und Familie',
      'Elidan bittet um Hilfe.',
      '',
      '3. Nachtangriff',
      'Etwas kommt aus der Dunkelheit.',
    ].join('\n');

    const chunks = chunkAdventureText(text, 60);

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks[0]).toContain('1. Auftakt');
    expect(chunks[0]).toContain('Die Helden sehen ein Kind im Watt.');
    expect(chunks[1]).toContain('2. Hof und Familie');
  });
});
