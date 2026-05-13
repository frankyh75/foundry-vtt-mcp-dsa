import type {
  AdventurePdfBlockV1,
  AdventurePdfEntityCandidateV1,
  AdventurePdfEntityStubV1,
  AdventurePdfSectionV1,
} from './ir.js';
import {
  blockTypeSchema,
  entityStatusSchema,
  entityTypeSchema,
  sectionTypeSchema,
  sourceSchema,
  stubTypeSchema,
} from './ir.js';
import { createEntityCandidateId, createEntityStubId } from './ids.js';

export interface PdfHeuristicsResult {
  blocks: AdventurePdfBlockV1[];
  sections: AdventurePdfSectionV1[];
  entityCandidates: AdventurePdfEntityCandidateV1[];
  entityStubs: AdventurePdfEntityStubV1[];
}

/**
 * Merge adjacent blocks that were artificially split by the PDF text layer.
 * Two merge strategies:
 *
 * 1. Statblock merge: A short block with partial attributes (MU/KL/IN/CH) followed
 *    by a block with combat data (LeP/FF/GE/SK/ZK) belongs together.
 *
 * 2. Prose merge: Consecutive short blocks (≤120 chars) that look like hyphenation
 *    fragments or sentence continuations, NOT standalone headings or statblocks,
 *    are merged into a single narrative paragraph.
 */
function mergeBlockFragments(blocks: AdventurePdfBlockV1[]): AdventurePdfBlockV1[] {
  if (blocks.length <= 1) return blocks;

  const merged: AdventurePdfBlockV1[] = [];
  let i = 0;
  while (i < blocks.length) {
    const current = blocks[i];
    const currentText = normalizeText(current.textRaw);

    // --- Strategy 1: Statblock merge ---
    const hasPartialAttrs = /\b(MU|KL|IN|CH)\s+\d{1,2}/.test(currentText);
    const isShort = currentText.length <= 120;
    const missingFullStatblock = !/\bLeP\s+\d+/.test(currentText);

    if (hasPartialAttrs && isShort && missingFullStatblock && i + 1 < blocks.length) {
      const next = blocks[i + 1];
      // Never merge blocks from different pages
      if (next.pageNumber !== current.pageNumber) {
        merged.push(current);
        i++;
        continue;
      }
      const nextText = normalizeText(next.textRaw);
      const nextHasCoreStats = /\b(LeP|FF|GE)\s+\d+/.test(nextText) || /\b(AT|SK|ZK)\s+\d+/.test(nextText);

      if (nextHasCoreStats) {
        const combinedText = `${currentText}\n${nextText}`;
        merged.push({
          ...current,
          textRaw: combinedText,
          textNormalized: normalizeBlockText(combinedText),
          confidence: Math.max(current.confidence, next.confidence),
          sourceBlockIds: [...current.sourceBlockIds, ...next.sourceBlockIds],
          provenance: { producer: 'heuristics_classification', rule: 'statblock_merge.v1' },
        });
        i += 2;
        continue;
      }
    }

    // --- Strategy 2: Prose merge (hyphenation / sentence continuation) ---
    // Collect consecutive short blocks that form a prose paragraph.
    // Stop conditions: no more blocks, block is long, block is a real heading,
    // block is a statblock, or accumulated text already looks like a complete paragraph.
    if (isShort && !hasPartialAttrs && !isRealHeading(currentText) && i + 1 < blocks.length) {
      const isAlreadyHeadingLike = isRealHeading(currentText);
      const isStatblock = /\b(MU|KL|IN|CH|LeP|FF|GE|KO|KK)\s+\d{1,2}/.test(currentText)
        && /\b(MU|KL|IN|CH|LeP|AT|SK|ZK)\s+\d{1,2}/.test(currentText);

      if (!isAlreadyHeadingLike && !isStatblock) {
        const group: AdventurePdfBlockV1[] = [current];
        const textParts: string[] = [currentText];
        let j = i + 1;

        while (j < blocks.length) {
          const candidate = blocks[j];
          const candidateText = normalizeText(candidate.textRaw);

          // Never merge blocks from different pages — they're independent
          if (candidate.pageNumber !== current.pageNumber) break;

          // Stop if candidate is clearly a standalone element
          if (isRealHeading(candidateText)) break;
          if (/\b(MU|KL|IN|CH|LeP|FF|GE|KO|KK)\s+\d{1,2}/.test(candidateText)) break; // statblock
          if (candidateText.length > 200) break; // long block = standalone paragraph
          if (textParts.join(' ').length + candidateText.length > 600) break; // accumulated too long

          group.push(candidate);
          textParts.push(candidateText);
          j++;
        }

        if (group.length >= 2) {
          const combinedText = textParts.join('\n');
          merged.push({
            ...current,
            textRaw: combinedText,
            textNormalized: normalizeBlockText(combinedText),
            confidence: Math.max(...group.map((b) => b.confidence)),
            sourceBlockIds: group.flatMap((b) => b.sourceBlockIds),
            provenance: { producer: 'heuristics_classification', rule: 'prose_merge.v1' },
          });
          i = j;
          continue;
        }
      }
    }

    merged.push(current);
    i += 1;
  }

  // --- Second pass: cross-column statblock merge (2-column layouts) ---
  // Find blocks on the same page with complementary statblock data
  // that are horizontally adjacent but were split by column layout.
  const crossColumnMerged: AdventurePdfBlockV1[] = [];
  const consumed = new Set<number>();
  for (let a = 0; a < merged.length; a++) {
    if (consumed.has(a)) continue;
    const blockA = merged[a];
    const textA = normalizeText(blockA.textRaw);
    const hasAttrsA = /\b(MU|KL|IN|CH)\s+\d{1,2}/.test(textA);
    const hasCombatA = /\b(LeP|FF|GE|AT|SK|ZK)\s+\d+/.test(textA);

    // Look for a complementary block on the same page
    let mergedIdx: number | undefined;
    let mergedBlock: AdventurePdfBlockV1 | undefined;
    for (let b = a + 1; b < merged.length; b++) {
      if (consumed.has(b)) continue;
      const blockB = merged[b];
      if (blockB.pageNumber !== blockA.pageNumber) continue;
      const textB = normalizeText(blockB.textRaw);
      const hasAttrsB = /\b(MU|KL|IN|CH)\s+\d{1,2}/.test(textB);
      const hasCombatB = /\b(LeP|FF|GE|AT|SK|ZK)\s+\d+/.test(textB);

      // Complementary: one has attributes, the other has combat/stats
      // AND they are on roughly the same vertical band (±15% page height)
      const sameVerticalBand = Math.abs(blockA.bbox.y - blockB.bbox.y) < Math.max(blockA.bbox.h, blockB.bbox.h) * 1.5;
      const horizontallyClose = Math.abs((blockA.bbox.x + blockA.bbox.w) - blockB.bbox.x) < 50 || 
                                  Math.abs((blockB.bbox.x + blockB.bbox.w) - blockA.bbox.x) < 50;
      if ((hasAttrsA && hasCombatB && !hasCombatA) || (hasCombatA && hasAttrsB && !hasAttrsB)) {
        if (sameVerticalBand || horizontallyClose) {
          mergedIdx = b;
          mergedBlock = blockB;
          break;
        }
      }
      if ((hasAttrsB && hasCombatA && !hasAttrsA) || (hasCombatB && hasAttrsA && !hasCombatB)) {
        if (sameVerticalBand || horizontallyClose) {
          mergedIdx = b;
          mergedBlock = blockB;
          break;
        }
      }
    }

    if (mergedIdx !== undefined && mergedBlock) {
      const combinedText = `${textA}\n${normalizeText(mergedBlock.textRaw)}`;
      crossColumnMerged.push({
        ...blockA,
        textRaw: combinedText,
        textNormalized: normalizeBlockText(combinedText),
        confidence: Math.max(blockA.confidence, mergedBlock.confidence),
        sourceBlockIds: [...blockA.sourceBlockIds, ...mergedBlock.sourceBlockIds],
        bbox: {
          x: Math.min(blockA.bbox.x, mergedBlock.bbox.x),
          y: Math.min(blockA.bbox.y, mergedBlock.bbox.y),
          w: Math.max(blockA.bbox.x + blockA.bbox.w, mergedBlock.bbox.x + mergedBlock.bbox.w) - Math.min(blockA.bbox.x, mergedBlock.bbox.x),
          h: Math.max(blockA.bbox.y + blockA.bbox.h, mergedBlock.bbox.y + mergedBlock.bbox.h) - Math.min(blockA.bbox.y, mergedBlock.bbox.y),
        },
        provenance: { producer: 'heuristics_classification', rule: 'cross_column_merge.v1' },
      });
      consumed.add(a);
      consumed.add(mergedIdx);
    } else {
      crossColumnMerged.push(blockA);
      consumed.add(a);
    }
  }

  return crossColumnMerged;
}

/**
 * Determines if a text is a genuine heading (not just a short prose fragment
 * that the heuristics might misclassify).
 */
function isRealHeading(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed.length === 0) return false;
  // Numbered headings like "1. Die Abreise", "3.2 Der Weg", or "1 der Weg"
  if (/^\d+([.\s]|\.\d+)*\s+\S/.test(trimmed)) return true;
  // ALL UPPERCASE and short (e.g. "NSC", "KAMPF")
  if (trimmed === trimmed.toUpperCase() && trimmed.length <= 40 && trimmed.length > 1) return true;
  // Known DSA section markers
  if (/^(Kapitel|Szene|Szenario|Ort|Personen|NSC|Meisterwissen|Hintergrundwissen|Ausrüstung|Kampf|Magie)\b/i.test(trimmed)) return true;
  return false;
}

function normalizeBlockText(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

export function classifyAdventurePdfIr(
  sourcePath: string,
  blocks: AdventurePdfBlockV1[],
  sections: AdventurePdfSectionV1[],
): PdfHeuristicsResult {
  // Step 0: Merge block fragments that were split across block boundaries
  const mergedBlocks = mergeBlockFragments(blocks);

  const classifiedBlocks: AdventurePdfBlockV1[] = [];
  const entityCandidates: AdventurePdfEntityCandidateV1[] = [];
  const entityStubs: AdventurePdfEntityStubV1[] = [];
  const blockById = new Map<string, AdventurePdfBlockV1>();

  for (const block of mergedBlocks) {
    const text = normalizeText(block.textRaw);
    const headingScore = scoreHeading(text);
    const illustrationScore = scoreIllustration(text);
    const npcScore = scoreNpc(text);
    const locationScore = scoreLocation(text);
    const sceneScore = scoreScene(text);
    const statblockScore = scoreStatblock(text);

    let blockType: AdventurePdfBlockV1['blockType'] = block.blockType;
    let roleHint: string | undefined = block.roleHint;
    let confidence = block.confidence;

    if (illustrationScore.score >= 0.5) {
      blockType = blockTypeSchema.parse('illustration');
      roleHint = 'illustration';
      confidence = Math.max(confidence, illustrationScore.score);
    } else if (headingScore.score >= 0.55) {
      blockType = blockTypeSchema.parse('heading');
      roleHint = 'heading';
      confidence = Math.max(confidence, headingScore.score);
    } else if (text.length > 0) {
      blockType = blockTypeSchema.parse('paragraph');
      roleHint = 'narrative';
      confidence = Math.max(confidence, 0.45);
    } else {
      blockType = blockTypeSchema.parse('unknown');
      roleHint = undefined;
      confidence = Math.min(confidence, 0.1);
    }

    // Statblock-Erkennung überschreibt roleHint wenn starkes Signal
    if (statblockScore.score >= 0.7) {
      roleHint = 'stat_block';
      confidence = Math.max(confidence, statblockScore.score);
    }

    let nextBlock = {
      ...block,
      blockType,
      roleHint,
      confidence,
      provenance: {
        producer: 'heuristics_classification',
        rule: determineBlockRule(text, illustrationScore, headingScore, npcScore, locationScore, sceneScore, statblockScore),
      },
    } satisfies AdventurePdfBlockV1;

    const candidate = buildEntityCandidate(sourcePath, nextBlock, npcScore, locationScore, sceneScore, statblockScore);
    if (candidate) {
      const semanticRoleHint =
        statblockScore.score >= 0.7
          ? 'stat_block'
          : candidate.candidate.entityType === 'npc'
            ? 'npc_profile'
            : candidate.candidate.entityType === 'location'
              ? 'location'
              : 'scene';

      nextBlock = {
        ...nextBlock,
        roleHint: semanticRoleHint,
      };

      entityCandidates.push(candidate.candidate);
      if (candidate.stub) {
        entityStubs.push(candidate.stub);
      }
    }

    classifiedBlocks.push(nextBlock);
    blockById.set(block.id, nextBlock);
  }

  const classifiedSections = sections.map((section) => {
    // M2: Accumulate section type from first 3 blocks, not just first block
    const firstThreeBlocks = section.blockIds.slice(0, 3).map(id => blockById.get(id)).filter(Boolean) as AdventurePdfBlockV1[];
    const sectionType = inferSectionTypeFromBlocks(firstThreeBlocks);
    return {
      ...section,
      sectionType,
      confidence: Math.max(section.confidence, (firstThreeBlocks[0]?.confidence ?? 0) - 0.05),
      provenance: {
        producer: 'heuristics_classification',
        rule: 'section_refine.v1',
      },
      source: sourceSchema.parse(firstThreeBlocks[0]?.source ?? 'unknown'),
      sourceBlockIds: [...(firstThreeBlocks[0]?.sourceBlockIds ?? [])],
    } satisfies AdventurePdfSectionV1;
  });

  return {
    blocks: classifiedBlocks,
    sections: classifiedSections,
    entityCandidates,
    entityStubs,
  };
}

function buildEntityCandidate(
  sourcePath: string,
  block: AdventurePdfBlockV1,
  npcScore: HeuristicScore,
  locationScore: HeuristicScore,
  sceneScore: HeuristicScore,
  statblockScore?: HeuristicScore,
): { candidate: AdventurePdfEntityCandidateV1; stub?: AdventurePdfEntityStubV1 } | undefined {
  const best = selectBestEntity(npcScore, locationScore, sceneScore, statblockScore);
  if (!best || best.score < 0.45) {
    return undefined;
  }

  const label = extractLabel(block.textRaw, best.entityType);
  if (!label) {
    return undefined;
  }

  const candidateStatus = best.score >= 0.55 ? 'converted_to_stub' : 'proposed';
  const candidate = {
    id: createEntityCandidateId(sourcePath, best.entityType, label, block.sourceBlockIds),
    entityType: entityTypeSchema.parse(best.entityType),
    label,
    sourceBlockIds: [...block.sourceBlockIds],
    attributes: buildCandidateAttributes(block.textRaw, best.entityType),
    confidence: best.score,
    status: entityStatusSchema.parse(candidateStatus),
    source: sourceSchema.parse(block.source),
    provenance: {
      producer: 'heuristics_classification',
      rule: best.rule,
    },
  } satisfies AdventurePdfEntityCandidateV1;

  if (candidateStatus !== 'converted_to_stub') {
    return { candidate };
  }

  const stubType = toStubType(best.entityType);
  if (!stubType) {
    return { candidate };
  }

  const stub = {
    id: createEntityStubId(sourcePath, stubType, label, block.sourceBlockIds),
    stubType: stubTypeSchema.parse(stubType),
    label,
    sourceBlockIds: [...block.sourceBlockIds],
    minimumPayload: buildMinimumPayload(block.textRaw, best.entityType, label),
    createdFrom: 'heuristic',
    readyForImport: true,
    confidence: best.score,
    source: sourceSchema.parse(block.source),
    provenance: {
      producer: 'heuristics_classification',
      rule: best.rule,
    },
  } satisfies AdventurePdfEntityStubV1;

  return { candidate, stub };
}

interface HeuristicScore {
  score: number;
  rule: string;
  entityType: 'npc' | 'location' | 'scene';
}

function selectBestEntity(
  npcScore: HeuristicScore,
  locationScore: HeuristicScore,
  sceneScore: HeuristicScore,
  statblockScore?: HeuristicScore,
): HeuristicScore | undefined {
  const scores = [npcScore, locationScore, sceneScore];
  if (statblockScore) {
    scores.push(statblockScore);
  }
  scores.sort((left, right) => right.score - left.score);
  return scores[0];
}

function inferSectionTypeFromBlocks(blocks: AdventurePdfBlockV1[]): AdventurePdfSectionV1['sectionType'] {
  for (const block of blocks.slice(0, 3)) {
    const type = inferSectionType(block);
    if (type !== 'unknown') return type;
  }
  return sectionTypeSchema.parse('unknown');
}

function inferSectionType(block: AdventurePdfBlockV1): AdventurePdfSectionV1['sectionType'] {
  const text = normalizeText(block.textRaw);
  const best = selectBestEntity(scoreNpc(text), scoreLocation(text), scoreScene(text));

  if (best && best.score >= 0.45) {
    if (best.entityType === 'npc') return sectionTypeSchema.parse('npc_section');
    if (best.entityType === 'location') return sectionTypeSchema.parse('location_section');
    if (best.entityType === 'scene') return sectionTypeSchema.parse('scene_section');
  }

  if (/\b(meisterwissen|gm|hintergrund|hintergrundwissen)\b/i.test(text)) {
    return sectionTypeSchema.parse('gm_background');
  }

  if (/^\d+(\.\d+)*\s+/.test(text) || /^kapitel\b/i.test(text)) {
    return sectionTypeSchema.parse('intro');
  }

  return sectionTypeSchema.parse('unknown');
}

function determineBlockRule(
  text: string,
  illustrationScore: HeuristicScore,
  headingScore: HeuristicScore,
  npcScore: HeuristicScore,
  locationScore: HeuristicScore,
  sceneScore: HeuristicScore,
  statblockScore?: HeuristicScore,
): string {
  const best = selectBestEntity(npcScore, locationScore, sceneScore, statblockScore);
  if (illustrationScore.score >= 0.5) return illustrationScore.rule;
  if (headingScore.score >= 0.55) return headingScore.rule;
  if (best && best.score >= 0.45) return best.rule;
  if (text.length > 0) return 'paragraph_body.v1';
  return 'empty_page.v1';
}

function scoreHeading(text: string): HeuristicScore {
  if (!text) {
    return { score: 0, rule: 'heading_empty.v1', entityType: 'scene' };
  }

  if (/^\d+([.\s]|\.\d+)*\s+\S/.test(text)) {
    return { score: 0.9, rule: 'heading_numbered.v1', entityType: 'scene' };
  }

  const words = text.split(/\s+/);
  const shortEnough = words.length <= 12 && text.length <= 80;
  const titleLike = /[A-ZÄÖÜ]/.test(text[0] ?? '') && text === text.trim();
  const allCaps = text === text.toUpperCase() && text.length > 2;

  if (allCaps && shortEnough) {
    return { score: 0.85, rule: 'heading_all_caps.v1', entityType: 'scene' };
  }

  if (shortEnough && titleLike) {
    return { score: 0.65, rule: 'heading_short_title.v1', entityType: 'scene' };
  }

  return { score: 0.25, rule: 'heading_weak.v1', entityType: 'scene' };
}

function scoreIllustration(text: string): HeuristicScore {
  if (/\b(abb\.?|abbildung|illustration|bild|figure)\b/i.test(text)) {
    return { score: 0.7, rule: 'illustration_marker.v1', entityType: 'scene' };
  }

  if (text.length === 0) {
    return { score: 0.15, rule: 'illustration_empty.v1', entityType: 'scene' };
  }

  return { score: 0.05, rule: 'illustration_absent.v1', entityType: 'scene' };
}

function scoreNpc(text: string): HeuristicScore {
  const DSA_NPC_ROLES = [
    'wirt(in)?', 'händler(in)?', 'meister(in)?', 'bäuer(in)?',
    'jäger(in)?', 'priester(in)?', 'geweihte[rn]?', 'geweihter',
    'wachen?', 'hauptmann', 'ratsherr', 'bürgermeister',
    'söldner(in)?', 'leibwächter(in)?', 'magier(in)?', 'hexe',
    'druide', 'druiden?', 'schreiber(in)?', 'diener(in)?',
    'zauberer', 'zauberin', 'kundschafter(in)?',
    'räuber(in)?', 'schankwirt(in)?', 'npc',
  ];
  const npcRolePattern = new RegExp(`\\b(${DSA_NPC_ROLES.join('|')})\\b`, 'i');
  const hasRoleWords = npcRolePattern.test(text);
  const name = extractProperName(text);
  if (hasRoleWords && name) {
    return { score: 0.72, rule: 'npc_name_role.v1', entityType: 'npc' };
  }

  if (name && /[,;:]/.test(text)) {
    return { score: 0.55, rule: 'npc_name_punctuation.v1', entityType: 'npc' };
  }

  return { score: 0.1, rule: 'npc_absent.v1', entityType: 'npc' };
}

function scoreStatblock(text: string): HeuristicScore {
  const hasMu = /\bMU\s+\d+\b/.test(text);
  const hasLep = /\bLeP\s+\d+\b/.test(text);
  const hasAt = /\bAT\s+\d+\b/.test(text);
  const hasTp = /\bTP\s+\d+W\d+(?:\+\d+)?\b/.test(text);
  const hasKampf = /\bSK\s+\d+.*ZK\s+\d+.*AW\s+\d+.*GS\s+\d+/.test(text);

  if (hasMu && hasLep && hasAt && hasTp) {
    return { score: 0.95, rule: 'statblock_full.v1', entityType: 'npc' };
  }
  if (hasKampf && hasAt) {
    return { score: 0.75, rule: 'statblock_combat.v1', entityType: 'npc' };
  }
  return { score: 0.05, rule: 'statblock_absent.v1', entityType: 'npc' };
}

function scoreLocation(text: string): HeuristicScore {
  if (/\b(ort|dorf|stadt|haus|hafen|burg|hof|tempel|wald|lager|gebaeude|gebäude|siedlung|gegend)\b/i.test(text)) {
    return { score: 0.68, rule: 'location_marker.v1', entityType: 'location' };
  }

  if (/^[A-ZÄÖÜ][A-Za-zÄÖÜäöüß\s-]{2,}$/.test(text) && text.length <= 80) {
    return { score: 0.45, rule: 'location_titlecase.v1', entityType: 'location' };
  }

  return { score: 0.08, rule: 'location_absent.v1', entityType: 'location' };
}

function scoreScene(text: string): HeuristicScore {
  if (/\b(szene|begegnung|trigger|auslöser|wenn|sobald|während|ereignis|ablauf)\b/i.test(text)) {
    return { score: 0.62, rule: 'scene_marker.v1', entityType: 'scene' };
  }

  if (/^\d+(\.\d+)*\b/.test(text)) {
    return { score: 0.4, rule: 'scene_numbered.v1', entityType: 'scene' };
  }

  return { score: 0.1, rule: 'scene_absent.v1', entityType: 'scene' };
}

function extractProperName(text: string): string | undefined {
  // Versuche 1-3 Titlecase-Worte (Abc, Abc Def, Abc-Def Ghi)
  const match = text.match(
    /\b([A-ZÄÖÜ][a-zäöüß-]+(?:\s+[A-ZÄÖÜ][a-zäöüß-]+){0,2})\b/,
  );
  if (match?.[1]) {
    const name = match[1].trim();
    // Namen sind typischerweise kurz (2-30 Zeichen)
    if (name.length >= 2 && name.length <= 30) {
      return name;
    }
  }
  return undefined;
}

function isOcrGarbage(text: string): boolean {
  // Nur Sonderzeichen, Zahlen, Whitespace = OCR-Müll
  return /^[\W\d\s]+$/.test(text);
}

function extractLabel(
  text: string,
  entityType: 'npc' | 'location' | 'scene',
): string | undefined {
  const normalized = normalizeText(text);
  const line = normalized.split('\n')[0]?.trim() ?? '';
  if (!line || line.length < 2) {
    return undefined;
  }

  // OCR-Müll → kein Name extrahierbar
  if (isOcrGarbage(line)) {
    return undefined;
  }

  // Versuch 1: Doppelpunkt-Label (alles vor dem ersten :)
  const colonIdx = line.indexOf(':');
  if (colonIdx > 1 && colonIdx <= 40) {
    const colonLabel = line.slice(0, colonIdx).trim();
    if (
      colonLabel.length >= 2 &&
      /^[A-Za-zÄÖÜäöüß\d\s\-]+$/.test(colonLabel)
    ) {
      return colonLabel;
    }
  }

  // Versuch 2: Proper Name (1-3 Titlecase-Worte)
  const name = extractProperName(line);
  if (name) {
    return name;
  }

  // Versuch 3: Erste sinnvolle Wortgruppe (bis 4 Worte, stoppe bei Satzzeichen)
  const words = line
    .split(/[\s,;!?().]+/)
    .filter((w) => w.length > 0 && /^[A-Za-zÄÖÜäöüß]/.test(w));
  if (words.length >= 1) {
    const labelWords = words.slice(0, Math.min(4, words.length));
    const label = labelWords.join(' ');
    if (label.length >= 2 && label.length <= 40) {
      return label;
    }
  }

  // Scene: ganze Zeile erlaubt (bis 80 Zeichen)
  if (entityType === 'scene' && line.length <= 80) {
    return line;
  }

  // Fallback: undefined → kein Candidate bei unbrauchbarem Text
  return undefined;
}

function buildCandidateAttributes(text: string, entityType: 'npc' | 'location' | 'scene'): Record<string, unknown> {
  const summary = summarizeText(text);
  const attributes: Record<string, unknown> = {
    summary,
  };

  if (entityType === 'npc') {
    const role = extractRole(text);
    if (role) {
      attributes.role = role;
    }
  }

  if (entityType === 'location') {
    const locationHint = extractLocationHint(text);
    if (locationHint) {
      attributes.locationHint = locationHint;
    }
  }

  return attributes;
}

function buildMinimumPayload(text: string, entityType: 'npc' | 'location' | 'scene', label: string): Record<string, unknown> {
  const summary = summarizeText(text);

  if (entityType === 'npc') {
    const stats = extractNpcStatblock(text);
    return {
      name: label,
      summary,
      ...stats,
    };
  }

  if (entityType === 'location') {
    return {
      name: label,
      summary,
    };
  }

  return {
    title: label,
    summary,
  };
}

/** Extrahiert DSA5-Attribute aus einem NPC-Statblock-Text */
function extractNpcStatblock(text: string): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // Attribute: MU, KL, IN, CH, FF, GE, KO, KK
  const attrMap: Record<string, number> = {};
  const attrPattern = /\b(MU|KL|IN|CH|FF|GE|KO|KK)\s+(\d+|\-|\—|\–|\−)/gi;
  let match: RegExpExecArray | null;
  while ((match = attrPattern.exec(normalized)) !== null) {
    const key = match[1].toLowerCase();
    const raw = match[2].trim();
    const value = raw === '-' || raw === '—' || raw === '–' || raw === '−' ? null : parseInt(raw, 10);
    if (!isNaN(value as number) || value === null) {
      attrMap[key] = value as number;
    }
  }
  if (Object.keys(attrMap).length > 0) {
    result.attributes = attrMap;
  }

  // LeP, AsP, KaP, INI
  const lepMatch = /\bLeP\s+(\d+|\-|\—|\–|\−)/i.exec(normalized);
  if (lepMatch) {
    const raw = lepMatch[1].trim();
    result.lep = raw === '-' || raw === '—' ? null : parseInt(raw, 10);
  }

  const aspMatch = /\bAsP\s+(\d+|\-|\—|\–|\−)/i.exec(normalized);
  if (aspMatch) {
    const raw = aspMatch[1].trim();
    result.asp = raw === '-' || raw === '—' ? null : parseInt(raw, 10);
  }

  const kapMatch = /\bKaP\s+(\d+|\-|\—|\–|\−)/i.exec(normalized);
  if (kapMatch) {
    const raw = kapMatch[1].trim();
    result.kap = raw === '-' || raw === '—' ? null : parseInt(raw, 10);
  }

  const iniMatch = /\bINI\s+(\d+(?:\+\d*W\d+)?)/i.exec(normalized);
  if (iniMatch) {
    result.ini = iniMatch[1];
  }

  // Kampfwerte: SK, ZK, AW, GS
  const skMatch = /\bSK\s+(\d+)/i.exec(normalized);
  if (skMatch) result.sk = parseInt(skMatch[1], 10);

  const zkMatch = /\bZK\s+(\d+)/i.exec(normalized);
  if (zkMatch) result.zk = parseInt(zkMatch[1], 10);

  const awMatch = /\bAW\s+(\d+)/i.exec(normalized);
  if (awMatch) result.aw = parseInt(awMatch[1], 10);

  const gsMatch = /\bGS\s+(\d+)/i.exec(normalized);
  if (gsMatch) result.gs = parseInt(gsMatch[1], 10);

  // Waffen
  const weapons: Array<Record<string, unknown>> = [];
  const weaponPattern = /([A-Za-zÄÖÜäöüß\s\-]+):\s*AT\s+(\d+)\s+(?:PA\s+(\d+)\s+)?TP\s+(\d+W\d+(?:\+\d+)?)\s+RW\s+(kurz|mittel|lang)/gi;
  while ((match = weaponPattern.exec(normalized)) !== null) {
    weapons.push({
      name: match[1].trim(),
      at: parseInt(match[2], 10),
      pa: match[3] ? parseInt(match[3], 10) : null,
      tp: match[4],
      rw: match[5].toLowerCase(),
    });
  }
  if (weapons.length > 0) {
    result.weapons = weapons;
  }

  // Sonderfertigkeiten
  const sfMatch = /Sonderfertigkeiten:\s*([^.\n]+)/i.exec(normalized);
  if (sfMatch) {
    result.sonderfertigkeiten = sfMatch[1].split(/,\s*/).map((s) => s.trim()).filter(Boolean);
  }

  return result;
}

function toStubType(entityType: 'npc' | 'location' | 'scene'): 'npc_stub' | 'location_stub' | 'scene_stub' | undefined {
  if (entityType === 'npc') return 'npc_stub';
  if (entityType === 'location') return 'location_stub';
  if (entityType === 'scene') return 'scene_stub';
  return undefined;
}

function extractRole(text: string): string | undefined {
  const match = text.match(/\b(Rolle|Wirt(in)?|Händler(in)?|Meister(in)?|Bäuer(in)?|Jäger(in)?|Priester(in)?)\b/i);
  return match?.[0];
}

function extractLocationHint(text: string): string | undefined {
  const match = text.match(/\b(Ort|Dorf|Stadt|Hof|Haus|Burg|Tempel|Wald|Lager)\b/i);
  return match?.[0];
}

function summarizeText(text: string): string {
  const normalized = normalizeText(text);
  if (normalized.length <= 180) {
    return normalized;
  }

  const firstSentence = normalized.split(/(?<=[.!?])\s+/)[0] ?? normalized;
  return firstSentence.slice(0, 180).trim();
}

function normalizeText(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}
