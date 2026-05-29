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

export function classifyAdventurePdfIr(
  sourcePath: string,
  blocks: AdventurePdfBlockV1[],
  sections: AdventurePdfSectionV1[],
): PdfHeuristicsResult {
  const classifiedBlocks: AdventurePdfBlockV1[] = [];
  const entityCandidates: AdventurePdfEntityCandidateV1[] = [];
  const entityStubs: AdventurePdfEntityStubV1[] = [];
  const blockById = new Map<string, AdventurePdfBlockV1>();

  for (const block of blocks) {
    const text = normalizeText(block.textRaw);
    const headingScore = scoreHeading(text);
    const illustrationScore = scoreIllustration(text);
    const npcScore = scoreNpc(text);
    const locationScore = scoreLocation(text);
    const sceneScore = scoreScene(text);

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

    let nextBlock = {
      ...block,
      blockType,
      roleHint,
      confidence,
      provenance: {
        producer: 'heuristics_classification',
        rule: determineBlockRule(text, illustrationScore, headingScore, npcScore, locationScore, sceneScore),
      },
    } satisfies AdventurePdfBlockV1;

    const candidate = buildEntityCandidate(sourcePath, nextBlock, npcScore, locationScore, sceneScore);
    if (candidate) {
      const semanticRoleHint =
        candidate.candidate.entityType === 'npc'
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
    const firstBlock = blockById.get(section.blockIds[0] ?? '');
    if (!firstBlock) {
      return section;
    }

    const sectionType = inferSectionType(firstBlock);
    return {
      ...section,
      sectionType,
      confidence: Math.max(section.confidence, firstBlock.confidence - 0.05),
      provenance: {
        producer: 'heuristics_classification',
        rule: 'section_refine.v1',
      },
      source: sourceSchema.parse(firstBlock.source),
      sourceBlockIds: [...firstBlock.sourceBlockIds],
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
): { candidate: AdventurePdfEntityCandidateV1; stub?: AdventurePdfEntityStubV1 } | undefined {
  const best = selectBestEntity(npcScore, locationScore, sceneScore);
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

function selectBestEntity(npcScore: HeuristicScore, locationScore: HeuristicScore, sceneScore: HeuristicScore): HeuristicScore | undefined {
  const scores = [npcScore, locationScore, sceneScore];
  scores.sort((left, right) => right.score - left.score);
  return scores[0];
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
): string {
  const best = selectBestEntity(npcScore, locationScore, sceneScore);
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

  if (/^\d+(\.\d+)*\s+/.test(text)) {
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
  const hasRoleWords = /\b(wirt(in)?|händler(in)?|meister(in)?|bäuer(in)?|jäger(in)?|priester(in)?|guard|wachen?|schreiber(in)?|npc)\b/i.test(text);
  const name = extractProperName(text);
  if (hasRoleWords && name) {
    return { score: 0.72, rule: 'npc_name_role.v1', entityType: 'npc' };
  }

  if (name && /[,;:]/.test(text)) {
    return { score: 0.55, rule: 'npc_name_punctuation.v1', entityType: 'npc' };
  }

  return { score: 0.1, rule: 'npc_absent.v1', entityType: 'npc' };
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
  const match = text.match(/\b([A-ZÄÖÜ][a-zäöüß]+(?:\s+[A-ZÄÖÜ][a-zäöüß]+){0,2})\b/);
  return match?.[1]?.trim();
}

function extractLabel(text: string, entityType: 'npc' | 'location' | 'scene'): string | undefined {
  const line = normalizeText(text).split('\n')[0]?.trim() ?? '';
  if (!line) {
    return undefined;
  }

  const colonLabel = line.split(':')[0]?.trim();
  if (colonLabel && colonLabel.length <= 80) {
    return colonLabel;
  }

  const name = extractProperName(line);
  if (name) {
    return name;
  }

  if (entityType === 'scene' && line.length <= 80) {
    return line;
  }

  return line.slice(0, 80);
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
    return {
      name: label,
      summary,
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
