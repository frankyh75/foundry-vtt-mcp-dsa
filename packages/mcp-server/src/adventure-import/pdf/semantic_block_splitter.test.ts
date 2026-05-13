import { describe, it, expect } from 'vitest';
import { splitSemanticBlocks } from './semantic_block_splitter.js';

describe('splitSemanticBlocks', () => {
  // ── Fixture: Approximate Deichbauern text layer ────────────────────────────
  const DEICHBAUERN_TEXT = `Deichbauern
MU 12 KL 11 IN 12 CH 11
FF 14 GE 13 KO 13 KK 13 LeP 31 AsP - KaP - INI 13+1W6 SK 14 ZK 10 AW 9

Der Fluch der Gabel
Am nächsten Morgen dringt Elidan darauf, noch ein-
mal nach der verschwundenen Deichgabel zu su-
chen, um endlich etwas vorzuweisen

aufmerksam und in einer mondlosen Nacht zer-
schlugen sie den Kult und brachten

Hexen entzogen blieb. Über Jahre

ruhte der Zahn verborgen auf dem

Grund des Meeres, aber dann wurde er

durch eine Veränderung der Strömungen

Frengesfolds Hof ins Watt gespült, wo ihn der

alte Bauer fand, Wirkung: Wer mit dem Zahn gestochen wird

Magische Analyse: Der Zahn ist definitiv magisch.`;

  it('erkennt Statblock als einheitlichen Block', () => {
    const statblockFragment = `Deichbauern
MU 12 KL 11 IN 12 CH 11
FF 14 GE 13 KO 13 KK 13 LeP 31 AsP - KaP - INI 13+1W6 SK 14 ZK 10 AW 9`;
    const blocks = splitSemanticBlocks(statblockFragment);
    const statBlocks = blocks.filter(b => b.blockKind === 'statblock');
    expect(statBlocks.length).toBeGreaterThanOrEqual(1);
    const main = statBlocks[0];
    expect(main.text).toContain('MU 12');
    expect(main.text).toContain('LeP 31');
    expect(main.text).toContain('AW 9');
  });

  it('erkennt nummerierte Überschriften', () => {
    const text = '1. Der Fluch der Gabel\nAm nächsten Morgen dringt Elidan.';
    const blocks = splitSemanticBlocks(text);
    const heading = blocks.find(b => b.blockKind === 'heading');
    expect(heading).toBeDefined();
    expect(heading!.text).toContain('1. Der Fluch der Gabel');
  });

  it('verbindet Silbentrennung im Fließtext', () => {
    const text = `Der Held ging auf-
merksam und in einer mond-
losen Nacht zer-
schlugen sie den Kult.`;
    const blocks = splitSemanticBlocks(text);
    // Should produce 1-2 blocks (all prose), not 4 fragments
    expect(blocks.length).toBeLessThanOrEqual(2);
    if (blocks.length > 0) {
      expect(blocks[0].text).toContain('schlugen');
    }
  });

  it('verwirft keine kurzen Zeilen sondern hängt sie an', () => {
    const text = `ruhte der Zahn verborgen auf dem
Grund des Meeres, aber dann wurde er`;
    const blocks = splitSemanticBlocks(text, { minBlockLength: 10 });
    // Should be a single paragraph, not two fragments
    expect(blocks.length).toBe(1);
    expect(blocks[0].text).toContain('verborgen');
    expect(blocks[0].text).toContain('Meeres');
  });

  it('erkennt DSA-Sektionsmarken als heading', () => {
    const text = 'Kapitel 3: Der Deich\nEs war einmal ein Deich.';
    const blocks = splitSemanticBlocks(text);
    const heading = blocks.find(b => b.blockKind === 'heading');
    expect(heading).toBeDefined();
    expect(heading!.text).toContain('Kapitel');
  });

  it('gemischte Seite: Statblock + Fließtext mit Überschrift', () => {
    const blocks = splitSemanticBlocks(DEICHBAUERN_TEXT);
    // Should have: 1 statblock + 1 large prose paragraph (heading + text merged)
    const statBlocks = blocks.filter(b => b.blockKind === 'statblock');
    const paragraphs = blocks.filter(b => b.blockKind === 'paragraph');

    expect(statBlocks.length).toBeGreaterThanOrEqual(1);
    expect(blocks.length).toBeLessThanOrEqual(3); // statblock + prose (heading merged in) + maybe one more

    // Statblock should contain the NPC name
    const mainStat = statBlocks[0];
    expect(mainStat.text).toContain('MU 12');
    expect(mainStat.text).toContain('LeP 31');

    // Prose should contain the scene heading text
    const mainProse = paragraphs[0];
    expect(mainProse.text).toContain('Der Fluch der Gabel');
  });

  it('ALL-CAPS kurze Überschriften', () => {
    const text = 'KAMPF\nDer Ork greift an mit der Axt.';
    const blocks = splitSemanticBlocks(text);
    const heading = blocks.find(b => b.blockKind === 'heading');
    expect(heading).toBeDefined();
    expect(heading!.text).toContain('KAMPF');
  });

  it('langes fließendes Prosa bleibt als paragraph', () => {
    const longText = 'Dies ist ein langer Absatz mit viel Text der mehr als hundertundzwanzig Zeichen haben sollte damit er nicht fuer einen Merge-Kandidaten gehalten wird sondern als eigenstaendiger paragraph erkannt wird und nicht mit anderen Bloecken verschmolzen wird.';
    const blocks = splitSemanticBlocks(longText);
    expect(blocks.length).toBe(1);
    expect(blocks[0].blockKind).toBe('paragraph');
  });

  it('wird nicht durch einzelne Zahl im Text verwirrt', () => {
    const text = 'Kapitel 12: Die Reise. 31 Tage vergingen.';
    const blocks = splitSemanticBlocks(text);
    const statBlocks = blocks.filter(b => b.blockKind === 'statblock');
    expect(statBlocks.length).toBe(0);
  });
});