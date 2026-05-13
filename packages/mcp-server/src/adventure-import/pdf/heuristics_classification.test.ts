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
    const text = 'Kapitel 12: Die Reise. 31 Tage vergiesen.';
    const block = makeBlock(text);
    const result = classifyAdventurePdfIr('/test.pdf', [block], []);
    expect(result.blocks[0].roleHint).not.toBe('stat_block');
  });
});

describe('Statblock-Merge bei Split-Blöcken', () => {
  it('merged NSC-Name+Attribute (Block 1) mit Kampfdaten (Block 2)', () => {
    // Simuliert den realen Deichbauern-Fall: Block 1 hat Name + MU/KL/IN/CH,
    // Block 2 hat FF/GE/KO/KK, LeP, SK/ZK etc.
    const headingBlock = makeBlock('Deichbauern\nMU 12 KL 11 IN 12 CH 11', {
      id: 'block:1:1:heading',
      readingOrder: 1,
      blockType: 'heading',
    });
    const statsBlock = makeBlock(
      'FF 14 GE 13 KO 13 KK 13\nLeP 31 AsP - KaP - INI 13+1W6\nSK 1 ZK 2 AW 7 GS 8\nDeichgabel: AT 10 PA 4 TP 1W6+2 RW mittel',
      {
        id: 'block:1:2:stats',
        readingOrder: 2,
        blockType: 'paragraph',
      },
    );
    const result = classifyAdventurePdfIr('/test.pdf', [headingBlock, statsBlock], []);

    // Die zwei Blöcke sollten zu einem gemergt werden
    expect(result.blocks.length).toBeLessThan(3);
    // Der gemergte Block sollte stat_block als roleHint haben
    const mergedBlock = result.blocks.find((b) => b.roleHint === 'stat_block');
    expect(mergedBlock).toBeDefined();
    // Der Name "Deichbauern" sollte im Text enthalten sein
    expect(mergedBlock!.textRaw).toContain('Deichbauern');
    // MU und FF sollten beide im Text sein (vorher aufgeteilt)
    expect(mergedBlock!.textRaw).toContain('MU 12');
    expect(mergedBlock!.textRaw).toContain('FF 14');
  });

  it('merged nicht, wenn zweiter Block kein Statblock-Fragment ist', () => {
    const headingBlock = makeBlock('Deichbauern\nMU 12 KL 11 IN 12 CH 11', {
      id: 'block:1:1:heading',
      readingOrder: 1,
      blockType: 'heading',
    });
    const narrativeBlock = makeBlock('Die Deichbauern reagieren sehr verstört.', {
      id: 'block:1:2:narr',
      readingOrder: 2,
      blockType: 'paragraph',
    });
    const result = classifyAdventurePdfIr('/test.pdf', [headingBlock, narrativeBlock], []);

    // Kein Merge — Blocks bleiben getrennt
    expect(result.blocks.length).toBe(2);
  });

  it('erzeugt korrekten NSC-Stub mit allen Attributen nach Merge', () => {
    const headingBlock = makeBlock('Deichbauern\nMU 12 KL 11 IN 12 CH 11', {
      id: 'block:1:1:heading',
      readingOrder: 1,
      blockType: 'heading',
    });
    const statsBlock = makeBlock(
      'FF 14 GE 13 KO 13 KK 13\nLeP 31 AsP - KaP - INI 13+1W6\nSK 1 ZK 2 AW 7 GS 8\nDeichgabel: AT 10 PA 4 TP 1W6+2 RW mittel\nSonderfertigkeiten: keine',
      {
        id: 'block:1:2:stats',
        readingOrder: 2,
        blockType: 'paragraph',
      },
    );
    const result = classifyAdventurePdfIr('/test.pdf', [headingBlock, statsBlock], []);

    // Entity Stub sollte existieren
    const stubs = result.entityStubs.filter((s) => s.stubType === 'npc_stub');
    expect(stubs.length).toBeGreaterThanOrEqual(1);

    // Der Deichbauern-Stub sollte alle 8 Attribute haben
    const deichbauern = stubs.find((s) => s.label === 'Deichbauern');
    expect(deichbauern).toBeDefined();
    const payload = deichbauern!.minimumPayload as Record<string, unknown>;
    const attrs = payload.attributes as Record<string, number>;
    expect(attrs.mu).toBe(12);
    expect(attrs.kl).toBe(11);
    expect(attrs.in).toBe(12);
    expect(attrs.ch).toBe(11);
    expect(attrs.ff).toBe(14);
    expect(attrs.ge).toBe(13);
    expect(attrs.ko).toBe(13);
    expect(attrs.kk).toBe(13);
    expect(payload.lep).toBe(31);
    expect(payload.sk).toBe(1);
    expect(payload.zk).toBe(2);
  });
});

describe('Prose-Merge bei Silben-Split', () => {
  it('merged aufeinanderfolgende kurze Fließtext-Fragmente zu einem Absatz', () => {
    // Simuliert Blöcke 13-16 aus dem Deichbauern-PDF (Silben-Split)
    const fragments = [
      makeBlock('aufmerksam und in einer mondlosen Nacht zer-', { id: 'b12', readingOrder: 12 }),
      makeBlock('schlugen sie den Kult und brachten seinen Mit-', { id: 'b13', readingOrder: 13 }),
      makeBlock('gliedern den Tod. Dem Hohepriester gelang es', { id: 'b14', readingOrder: 14 }),
      makeBlock('jedoch noch mit letzter Kraft, den Zahn ins Meer zu schleudern.', { id: 'b15', readingOrder: 15 }),
    ];
    const result = classifyAdventurePdfIr('/test.pdf', fragments, []);

    // Alle 4 Fragmente sollten zu weniger als 4 Blöcken zusammengeführt werden
    expect(result.blocks.length).toBeLessThan(4);
    // Der gemergte Block sollte den zusammenhängenden Text enthalten
    const mergedBlock = result.blocks[0];
    expect(mergedBlock.textRaw).toContain('schlugen sie den Kult');
    expect(mergedBlock.textRaw).toContain('Zahn ins Meer');
    // Kein heading-Misclassification
    expect(mergedBlock.blockType).not.toBe('heading');
  });

  it('merged nicht bei echten Überschriften', () => {
    const heading = makeBlock('1. Der Fluch der Gabel', { id: 'b1', readingOrder: 1 });
    const narrative = makeBlock('Am nächsten Morgen dringt Elidan darauf ein, nach der verschwundenen Deichgabel zu suchen. Nach längerer Suche gelingt es bei Ebbe tatsächlich, die Deichgabel im Watt vor dem Deich zu finden.', { id: 'b2', readingOrder: 2 });
    const result = classifyAdventurePdfIr('/test.pdf', [heading, narrative], []);

    // Nummerierte Überschrift wird nicht ins Prose-Merge einbezogen
    expect(result.blocks.length).toBeGreaterThanOrEqual(1);
    const headingBlock = result.blocks.find((b) => b.blockType === 'heading');
    // Heading bleibt als eigener Block erhalten (es ist eine echte Überschrift)
    expect(headingBlock).toBeDefined();
  });

  it('merged nicht bei Statblock', () => {
    const headingBlock = makeBlock('Deichbauern\nMU 12 KL 11 IN 12 CH 11', { id: 'b1', readingOrder: 1, blockType: 'heading' });
    const statsBlock = makeBlock('FF 14 GE 13 KO 13 KK 13\nLeP 31 AsP - KaP -', { id: 'b2', readingOrder: 2 });
    const longNarrative = makeBlock('Die Deichbauern kämpfen am liebsten aus einer erhöhten, vorteilhaften Position. Sie greifen mit der Deichgabel an und weichen aus, wenn der Gegner zu nahe kommt. Ihre Taktik beruht auf Ausdauer und Ortskenntnis im Watt.', { id: 'b3', readingOrder: 3 });
    const result = classifyAdventurePdfIr('/test.pdf', [headingBlock, statsBlock, longNarrative], []);

    // Statblock-Merge kombiniert Block 1+2 zu einem Block ( MU + FF enthalten)
    // Block 3 bleibt eigenständig (zu lang für Prose-Merge)
    expect(result.blocks.length).toBe(2);
    const mergedBlock = result.blocks[0];
    // Der gemergte Block enthält MU und FF Attribute
    expect(mergedBlock.textRaw).toContain('MU 12');
    expect(mergedBlock.textRaw).toContain('FF 14');
    expect(mergedBlock.textRaw).toContain('LeP 31');
  });

  it('stoppt Prose-Merge bei langem Block', () => {
    const short = makeBlock('Hexen entzogen blieb.', { id: 'b1', readingOrder: 1 });
    const long = makeBlock('Über Jahre ruhte der Zahn verborgen auf dem Grund des Meeres, aber dann wurde er durch eine Veränderung der Strömungen und den steten Wechsel der Gezeiten wieder an die Oberfläche und schließlich nahe Frengesfolds Hof ins Watt gespült, wo ihn der alte Bauer fand.', { id: 'b2', readingOrder: 2 });
    const result = classifyAdventurePdfIr('/test.pdf', [short, long], []);

    // Langer Block (>200 Zeichen) ist eigenständig, kurzer wird nicht mit ihm gemergt
    expect(result.blocks.length).toBeGreaterThanOrEqual(1);
  });

  it('merged cross-column statblocks in 2-Spalten-Layouts', () => {
    // Simuliert: Linke Spalte hat MU/KL/IN/CH, rechte Spalte hat FF/GE/KO/KK + LeP
    const leftColumn = makeBlock('MU 12 KL 11 IN 10 CH 9', {
      id: 'block:left',
      readingOrder: 1,
      bbox: { x: 40, y: 300, w: 220, h: 80 },
      blockType: 'paragraph',
    });
    const rightColumn = makeBlock('FF 8 GE 12 KO 13 KK 11\nLeP 25 AsP 0 KaP 0', {
      id: 'block:right',
      readingOrder: 2,
      bbox: { x: 300, y: 300, w: 220, h: 120 },
      blockType: 'paragraph',
    });
    const result = classifyAdventurePdfIr('/test.pdf', [leftColumn, rightColumn], []);

    // Die zwei Spalten sollten zu einem gemergt werden
    expect(result.blocks.length).toBe(1);
    const mergedBlock = result.blocks[0];
    expect(mergedBlock.textRaw).toContain('MU 12');
    expect(mergedBlock.textRaw).toContain('FF 8');
    expect(mergedBlock.textRaw).toContain('LeP 25');
    // combined text has enough stat terms for detection
    expect(mergedBlock.textRaw).toMatch(/\b(MU|KL|IN|CH|FF|GE|KO|KK)\s+\d/);
    expect(mergedBlock.textRaw).toMatch(/\bLeP\s+\d/);
    // BBox sollte beide Spalten umfassen
    expect(mergedBlock.bbox.x).toBe(40);
    expect(mergedBlock.bbox.w).toBeGreaterThan(400);
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
    // DSA5-Statblock-Extraktion prüfen
    expect(stub.minimumPayload.attributes).toBeDefined();
    expect((stub.minimumPayload.attributes as Record<string, number>).mu).toBe(12);
    expect((stub.minimumPayload.attributes as Record<string, number>).kl).toBe(11);
    expect((stub.minimumPayload.attributes as Record<string, number>).ff).toBe(14);
    expect(stub.minimumPayload.lep).toBe(31);
    expect(stub.minimumPayload.asp).toBeNull();
    expect(stub.minimumPayload.ini).toBe('13+1W6');
    expect(stub.minimumPayload.sk).toBe(1);
    expect(stub.minimumPayload.zk).toBe(2);
    expect(stub.minimumPayload.weapons).toBeDefined();
    expect(Array.isArray(stub.minimumPayload.weapons)).toBe(true);
    expect((stub.minimumPayload.weapons as Array<Record<string, unknown>>).length).toBe(1);
    expect((stub.minimumPayload.weapons as Array<Record<string, unknown>>)[0].name).toBe('Deichgabel');
  });

  it('erzeugt Entity Candidate für minimalen NSC (nur MU + LeP, kein AT/TP)', () => {
    const text = 'Ork Krieger\nMU 12 KL 11 IN 10 CH 9\nFF 8 GE 12 KO 13 KK 11\nLeP 25 AsP 0 KaP 0\nINI 12 AW 7 SK 4 ZK 2 GS 7';
    const block = makeBlock(text);
    const result = classifyAdventurePdfIr('/test.pdf', [block], []);
    // Should still create entity candidate because MU+LeP is enough
    expect(result.entityCandidates.length).toBeGreaterThanOrEqual(1);
    expect(result.entityStubs.length).toBeGreaterThanOrEqual(1);
    const stub = result.entityStubs[0];
    expect(stub.stubType).toBe('npc_stub');
    expect(stub.label).toBe('Ork Krieger');
    expect(stub.minimumPayload).toBeDefined();
    expect(stub.minimumPayload.lep).toBe(25);
    expect((stub.minimumPayload.attributes as Record<string, number>).mu).toBe(12);
  });

  it('extrahiert Namen trotz NSC-Symbol am Anfang', () => {
    const text = 'ⓐ Elidan, ehemaliger Waldbauer\nMU 14 KL 10 IN 12 CH 11\nLeP 33 AsP - KaP -\nSK 1 ZK 2 AW 6 GS 7';
    const block = makeBlock(text);
    const result = classifyAdventurePdfIr('/test.pdf', [block], []);
    const stub = result.entityStubs.find((s) => s.stubType === 'npc_stub');
    expect(stub).toBeDefined();
    expect(stub!.label).toBe('Elidan');
  });

  it('ignoriert OCR-Garbage als Label', () => {
    const text = ', rn hl . : | IR wnt Fi SE AN ER SS Si\nMU 12 KL 11 IN 10 CH 9\nLeP 25';
    const block = makeBlock(text);
    const result = classifyAdventurePdfIr('/test.pdf', [block], []);
    // Should not create entity with garbage name
    const garbageStub = result.entityStubs.find((s) => /rn|hl|IR|wnt/.test(s.label));
    expect(garbageStub).toBeUndefined();
  });
});
