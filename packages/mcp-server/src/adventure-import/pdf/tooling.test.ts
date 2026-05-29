import { describe, expect, it } from 'vitest';
import { parseTesseractTsvForTest } from './tooling.js';

describe('parseTesseractTsvForTest', () => {
  it('keeps tesseract block order instead of interleaving by y position', () => {
    const tsv = [
      'level\tpage_num\tblock_num\tpar_num\tline_num\tword_num\tleft\ttop\twidth\theight\tconf\ttext',
      '1\t1\t0\t0\t0\t0\t0\t0\t1000\t1000\t-1\t',
      '5\t1\t1\t1\t1\t1\t100\t100\t50\t20\t95\tErster',
      '5\t1\t1\t1\t1\t2\t160\t100\t60\t20\t95\tAbsatz',
      '5\t1\t2\t1\t1\t1\t700\t50\t60\t20\t95\tZweite',
      '5\t1\t2\t1\t1\t2\t770\t50\t70\t20\t95\tSpalte',
    ].join('\n');

    const result = parseTesseractTsvForTest(tsv);

    expect(result.blocks).toHaveLength(2);
    expect(result.blocks[0]?.text).toContain('Erster Absatz');
    expect(result.blocks[1]?.text).toContain('Zweite Spalte');
  });
});
