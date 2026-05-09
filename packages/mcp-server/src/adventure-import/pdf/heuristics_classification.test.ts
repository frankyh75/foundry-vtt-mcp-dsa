import { describe, it, expect } from 'vitest';
import { classifyAdventurePdfIr } from './heuristics_classification.js';
import type { AdventurePdfBlockV1 } from './ir.js';

function makeBlock(text: string, overrides?: Partial<AdventurePdfBlockV1>): AdventurePdfBlockV1 {
  return {
    id: 'block:test:1',
    pageId: 'page:test:1',
    pageNumber: 1,
    bbox: { x: 0, y: 0, w: 100, h: 50 },
    readingOrder: 1,
    blockType: 'paragraph',
    roleHint: undefined,
    textRaw: text,
    textNormalized: text,
    source: 'ocr',
    sourceBlockIds: ['raw:test'],
    confidence: 0.8,
    provenance: { producer: 'test', rule: 'test.v1' },
    style: {},
    links: {},
    ...overrides,
  };
}

describe('Statblock-Erkennung', () => {
  it('erkennt vollständigen DSA5-Statblock (Deichbauern)', () => {
    const text = 'MU 12 KL 11 IN 12 CH 11\nFF 14 GE 13 KO 13 KK 13\nLeP 31 AsP - KaP - INI 13+1W6\nSK 1 ZK 2 AW 7 GS 8\nDeichgabel: AT 10 PA 4 TP 1W6+2 RW mittel';
    const block = makeBlock(text);
    const result = classifyAdventurePdfIr('/test.pdf', [block], []);
    expect(result.blocks[0].roleHint).toBe('stat_block');
    expect(result.blocks[0].confidence).toBeGreaterThanOrEqual(0.7);
  });

  it('erkennt Creature-Statblock (Krakenmolch)', () => {
    const text = 'MU 15 KL 6 IN 13 CH 8\nFF 13 GE 12 KO 35 KK 36\nLeP 350 AsP - KaP - INI 14+1W6\nVW 6 SK 1 ZK 7 GS 2/9\nFangarm: AT 13 TP 1W6+8 RW lang\nBiss: AT 10 TP 3W6+6 RW kurz';
    const block = makeBlock(text);
    const result = classifyAdventurePdfIr('/test.pdf', [block], []);
    expect(result.blocks[0].roleHint).toBe('stat_block');
  });

  it('erkennt Minimal-Kampfblock (Orknase)', () => {
    const text = 'SK 1 ZK 2 AW 6 GS 7\nOrknase: AT 13 PA 4 TP 1W6+5 RW mittel\nThorwalerschild: AT 9 PA 12 TP 1W6+1 RW kurz';
    const block = makeBlock(text);
    const result = classifyAdventurePdfIr('/test.pdf', [block], []);
    // Minimal-Kampfblock hat kein MU → combat_block (0.75)
    expect(result.blocks[0].roleHint).toBe('stat_block');
  });

  it('erkennt Thorwaler-Statblock (einzelner großer Block)', () => {
    const text = 'Hetmann Thurbold Yasmason, Anführer der Plünderer\nErscheinung: stämmig, rotes Haar\nMU 14 KL 10 IN 12 CH 11 FF 12 GE 13 KO 14 KK 14\nLeP 33 AsP - KaP - INI 14+1W6\nSK 1 ZK 2 AW 6 GS 7\nOrknase: AT 13 PA 4 TP 1W6+5\nSonderfertigkeiten: Belastungsgewöhnung I, Wuchtschlag I';
    const block = makeBlock(text, { bbox: { x: 0, y: 0, w: 100, h: 863 } });
    const result = classifyAdventurePdfIr('/test.pdf', [block], []);
    expect(result.blocks[0].roleHint).toBe('stat_block');
  });

  it('kein false positive bei normalem Text', () => {
    const text = 'Die Helden erreichen den Hof. Es ist ein schöner Tag.';
    const block = makeBlock(text);
    const result = classifyAdventurePdfIr('/test.pdf', [block], []);
    expect(result.blocks[0].roleHint).not.toBe('stat_block');
  });

  it('kein false positive bei Zahlen ohne DSA5-Kontext', () => {
    const text = 'Kapitel 12: Die Reise. 31 Tage vergingen.';
    const block = makeBlock(text);
    const result = classifyAdventurePdfIr('/test.pdf', [block], []);
    expect(result.blocks[0].roleHint).not.toBe('stat_block');
  });
});

describe('Entity Candidate mit Statblock', () => {
  it('erzeugt Entity Candidate für Statblock-NSC', () => {
    const text = 'Deichbauern MU 12 KL 11 IN 12 CH 11\nFF 14 GE 13 KO 13 KK 13\nLeP 31 AsP - KaP - INI 13+1W6\nSK 1 ZK 2 AW 7 GS 8\nDeichgabel: AT 10 PA 4 TP 1W6+2 RW mittel';
    const block = makeBlock(text);
    const result = classifyAdventurePdfIr('/test.pdf', [block], []);
    expect(result.entityCandidates.length).toBeGreaterThanOrEqual(1);
    expect(result.entityStubs.length).toBeGreaterThanOrEqual(1);
    const stub = result.entityStubs[0];
    expect(stub.stubType).toBe('npc_stub');
    expect(stub.minimumPayload).toBeDefined();
  });
});
