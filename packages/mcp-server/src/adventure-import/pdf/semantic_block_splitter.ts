/**
 * semantic_block_splitter.ts
 *
 * Replaces the naive `splitTextLayerIntoBlocks()` which only splits at `\n{2,}`
 * and discards short fragments. This module produces semantically coherent blocks
 * by recognizing statblocks, prose paragraphs, and headings.
 */

// ── DSA5 attribute patterns ─────────────────────────────────────────────────
const DSA5_ATTR_LINE_RE = /\b(MU|KL|IN|CH|FF|GE|KO|KK|LeP|AsP|KaP|INI|AW|SK|ZK|GS)\s*\d/i;
const DSA5_STATBLOCK_TERMS_RE = /\b(MU|KL|IN|CH|FF|GE|KO|KK|LeP|AsP|KaP|INI|AW|SK|ZK|GS)\b/;
const DSA5_STAT_MIN_TERMS = 3; // minimum distinct attribute terms to flag as statblock

// ── Heading patterns ────────────────────────────────────────────────────────
const NUMBERED_HEADING_RE = /^\d+([.\s]|\.\d+)*\s+\S/;
const ALL_CAPS_SHORT_RE = /^[A-ZÄÖÜß]{2,40}$/;
const DSA_SECTION_MARKER_RE = /^(Kapitel|Szene|Szenario|Ort|Personen|NSC|Meisterwissen|Hintergrundwissen|Ausrüstung|Kampf|Magie)\b/i;
const SHORT_HEADING_MAX_LEN = 60;

// ── Silbentrennung ───────────────────────────────────────────────────────────
// A line ending with a hyphen followed by continuation on the next line
const HYPHENATION_RE = /\w-$/;

// ── Exported types ───────────────────────────────────────────────────────────
export interface SemanticBlock {
  text: string;
  blockKind: 'heading' | 'statblock' | 'paragraph' | 'unknown';
  confidence: number;
}

export interface SplitOptions {
  minBlockLength?: number; // default 10 (lower than old 20 to reduce fragment loss)
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function normalizeLine(line: string): string {
  return line.replace(/\s+/g, ' ').trim();
}

function isHeading(text: string): boolean {
  const t = text.trim();
  if (t.length === 0) return false;
  if (NUMBERED_HEADING_RE.test(t)) return true;
  if (ALL_CAPS_SHORT_RE.test(t)) return true;
  if (DSA_SECTION_MARKER_RE.test(t)) return true;
  // Short title-like text: ≤60 chars, starts uppercase, doesn't start with a
  // sentence connector. BUT: only if it's a plausible heading — meaning it
  // doesn't end with a sentence-internal punctuation like comma or hyphen,
  // and it's not just a sentence fragment that happens to be short.
  // Headings end with periods, colons, or no punctuation at all.
  // Prose fragments typically end with commas, hyphens, or mid-sentence words.
  if (t.length <= SHORT_HEADING_MAX_LEN && /^[A-ZÄÖÜ]/.test(t)) {
    const connectorPattern = /^(und|oder|aber|das|der|die|den|dem|des|ein|eine|auf|aus|bei|durch|für|im|in|mit|nach|von|zu|zur|an|am|vom|vor|wie|wird|wurde|wurden|hatte|hatten|kann|konnte|sollte|würde|noch|schon|auch|nicht|kein|keine|keiner|keines|sehr|viel|wenig|mehr|weniger|darauf|darüber|davon|davor|dazwischen|hier|dort|wo|wann|warum|was|wer|welche|welcher|welches|dies|diese|dieser|dieses|er|sie|es|wir|ihr|sie\(|man|jemand|niemand|etwas|alles|jeder|keiner)\b/i;
    // Also: if the text contains a verb indicative, it's likely prose
    const verbPattern = /\b(ist|sind|war|waren|wird|werden|wurde|wurden|hat|haben|hatte|hatten|kann|können|konnte|konnten|soll|sollen|sollte|muss|müssen|musste|darf|dürfen|wird|werde|werden|wurde|wurden|tut|macht|geht|kommt|steht|liegt|beginnt|endet|heißt|bedeutet|beschreibt|erklärt)\b/i;
    if (!connectorPattern.test(t) && !/[,\-–—]\s*$/.test(t) && !verbPattern.test(t)) {
      return true;
    }
  }
  return false;
}

function countStatTerms(text: string): number {
  const matches = text.match(DSA5_STATBLOCK_TERMS_RE) ?? [];
  // Count distinct terms by iterating character-by-character would be slow,
  // so we count by finding all matches globally
  const allMatches = text.match(new RegExp(DSA5_STATBLOCK_TERMS_RE.source, 'gi')) ?? [];
  return allMatches.length;
}

function looksLikeStatblock(text: string): boolean {
  return countStatTerms(text) >= DSA5_STAT_MIN_TERMS || DSA5_ATTR_LINE_RE.test(text);
}

function isShortLine(line: string, maxLen: number = 120): boolean {
  return line.trim().length > 0 && line.trim().length <= maxLen;
}

// ── Core splitter ─────────────────────────────────────────────────────────────

export function splitSemanticBlocks(text: string, options?: SplitOptions): SemanticBlock[] {
  const minLen = options?.minBlockLength ?? 10;
  if (!text || text.trim().length === 0) return [];

  const rawLines = text.split(/\n/);
  // Group lines into segments separated by blank lines (\n{2,})
  const segments: string[][] = [];
  let current: string[] = [];

  for (const line of rawLines) {
    if (line.trim() === '') {
      if (current.length > 0) {
        segments.push(current);
        current = [];
      }
    } else {
      current.push(line);
    }
  }
  if (current.length > 0) segments.push(current);

  // Now refine each segment into semantic blocks
  const blocks: SemanticBlock[] = [];

  for (const segLines of segments) {
    // Check if the entire segment is a statblock (or name + statblock)
    const joinedText = segLines.map(normalizeLine).join(' ');
    // Also check: first line is a short name, rest is statblock
    const firstLine = normalizeLine(segLines[0] ?? '');
    const restLines = segLines.slice(1).map(normalizeLine).join(' ');
    const isNamePlusStats = firstLine.length <= 60 && !isHeading(firstLine) && looksLikeStatblock(restLines);

    if (looksLikeStatblock(joinedText) || isNamePlusStats) {
      blocks.push({
        text: joinedText,
        blockKind: 'statblock',
        confidence: 0.9,
      });
      continue;
    }

    // Within each segment, group consecutive prose lines,
    // but keep headings as separate blocks
    let i = 0;
    while (i < segLines.length) {
      const line = segLines[i];
      const normLine = normalizeLine(line);

      // Is this line a heading?
      if (isHeading(normLine)) {
        // Check if it's a heading + continuation (heading that starts a paragraph)
        // Collect following non-heading, short lines that belong to this heading's section
        let headingText = normLine;
        let j = i + 1;

        // Single-line heading: just emit it
        if (j >= segLines.length || !isShortLine(segLines[j])) {
          blocks.push({
            text: headingText,
            blockKind: 'heading',
            confidence: 0.85,
          });
          i = j;
          continue;
        }

        // Heading might be followed by prose — check next line
        // For now, emit heading as its own block
        blocks.push({
          text: headingText,
          blockKind: 'heading',
          confidence: 0.85,
        });
        i = j;
        continue;
      }

      // Is this line part of a statblock?
      if (DSA5_ATTR_LINE_RE.test(normLine) || looksLikeStatblock(normLine)) {
        // Collect all consecutive statblock-like lines
        let statText = normLine;
        let j = i + 1;
        while (j < segLines.length && (DSA5_ATTR_LINE_RE.test(normalizeLine(segLines[j])) || looksLikeStatblock(normalizeLine(segLines[j])))) {
          statText += ' ' + normalizeLine(segLines[j]);
          j++;
        }
        blocks.push({
          text: statText,
          blockKind: 'statblock',
          confidence: 0.85,
          });
        i = j;
        continue;
      }

      // Prose: collect consecutive non-heading, non-statblock lines
      let proseText = normLine;
      let j = i + 1;
      while (j < segLines.length && !isHeading(normalizeLine(segLines[j])) && !DSA5_ATTR_LINE_RE.test(normalizeLine(segLines[j]))) {
        const nextLine = normalizeLine(segLines[j]);

        // Check for hyphenation: current text ends with word + hyphen and next starts lowercase
        if (HYPHENATION_RE.test(proseText) && /^[a-zäöüß]/i.test(nextLine)) {
          // Merge hyphenation: remove trailing hyphen and join
          proseText = proseText.replace(/-\s*$/, '') + nextLine;
        } else {
          proseText += ' ' + nextLine;
        }
        j++;
      }

      if (proseText.trim().length >= minLen) {
        blocks.push({
          text: proseText.trim(),
          blockKind: 'paragraph',
          confidence: 0.7,
        });
      } else if (blocks.length > 0) {
        // Too short to be its own block — append to previous block
        const last = blocks[blocks.length - 1];
        last.text += ' ' + proseText.trim();
        // Upgrade statblock if appended text has stat terms
        if (last.blockKind !== 'statblock' && looksLikeStatblock(last.text)) {
          last.blockKind = 'statblock';
          last.confidence = 0.85;
        }
      }
      i = j;
    }
  }

  // Final pass: merge adjacent paragraph blocks into longer ones.
  // Also: downgrade short heading blocks surrounded by paragraphs — they're
  // likely prose fragments that look like headings to the segment splitter.
  const merged: SemanticBlock[] = [];
  for (const block of blocks) {
    if (merged.length === 0) {
      merged.push({ ...block });
      continue;
    }
    const prev = merged[merged.length - 1];

    // Downgrade short heading blocks surrounded by paragraphs
    if (block.blockKind === 'heading' && block.text.length <= 80) {
      // Check if previous block is a paragraph — then this "heading" is likely prose
      if (prev.blockKind === 'paragraph') {
        // Convert to paragraph and merge
        block.blockKind = 'paragraph';
        block.confidence = 0.6;
      }
    }

    // Don't merge real headings — they're structural boundaries
    if (block.blockKind === 'heading' || prev.blockKind === 'heading') {
      merged.push({ ...block });
      continue;
    }

    // Don't merge statblocks with paragraphs (statblocks are self-contained)
    const eitherIsStatblock = block.blockKind === 'statblock' || prev.blockKind === 'statblock';
    if (eitherIsStatblock) {
      merged.push({ ...block });
      continue;
    }

    // Both are paragraphs — merge them
    if (block.blockKind === 'paragraph' && prev.blockKind === 'paragraph') {
      prev.text += ' ' + block.text;
      // Reclassify if it turned into a statblock
      if (looksLikeStatblock(prev.text)) {
        prev.blockKind = 'statblock';
        prev.confidence = 0.85;
      }
      continue;
    }

    merged.push({ ...block });
  }

  return merged;
}