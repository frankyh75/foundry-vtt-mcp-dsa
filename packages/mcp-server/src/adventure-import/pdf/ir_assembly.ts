import type { AdventurePdfBlockV1, AdventurePdfSectionV1 } from './ir.js';
import { blockSchema, sectionSchema, sectionTypeSchema, sourceSchema } from './ir.js';
import { createBlockId, createSectionId } from './ids.js';
import type { PdfLayoutRawBlock } from './layout_ocr.js';

export interface PdfIrAssemblyResult {
  blocks: AdventurePdfBlockV1[];
  sections: AdventurePdfSectionV1[];
}

export function assemblePdfIr(
  sourcePath: string,
  rawBlocks: PdfLayoutRawBlock[],
): PdfIrAssemblyResult {
  const blocks: AdventurePdfBlockV1[] = [];
  const sections: AdventurePdfSectionV1[] = [];

  for (const rawBlock of rawBlocks) {
    const block = blockSchema.parse({
      id: createBlockId(sourcePath, rawBlock.pageNumber, rawBlock.readingOrder, rawBlock.textRaw),
      pageId: rawBlock.pageId,
      pageNumber: rawBlock.pageNumber,
      bbox: rawBlock.bbox,
      readingOrder: rawBlock.readingOrder,
      blockType: rawBlock.blockType,
      textRaw: rawBlock.textRaw,
      textNormalized: normalizeBlockText(rawBlock.textRaw),
      source: rawBlock.source,
      sourceBlockIds: [rawBlock.id],
      confidence: rawBlock.confidence,
      provenance: {
        producer: 'ir_assembly',
        rule: rawBlock.blockType === 'unknown' ? 'page_block_empty.v1' : `page_block_${rawBlock.blockType}.v1`,
      },
      style: {},
      links: {},
    });

    blocks.push(block);
  }

  const headingBlocks = blocks.filter((block) => isHeadingLike(block.textRaw));
  for (const block of headingBlocks) {
    const sectionType = inferSectionType(block.textRaw);
    const section = sectionSchema.parse({
      id: createSectionId(sourcePath, block.textRaw.slice(0, 80), block.sourceBlockIds),
      title: inferSectionTitle(block.textRaw),
      sectionType,
      blockIds: [block.id],
      source: sourceSchema.parse(block.source),
      sourceBlockIds: [...block.sourceBlockIds],
      confidence: Math.max(0.2, block.confidence - 0.05),
      provenance: {
        producer: 'ir_assembly',
        rule: 'heading_section.v1',
      },
    });
    sections.push(section);
  }

  return { blocks, sections };
}

function normalizeBlockText(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function inferSectionTitle(text: string): string {
  const trimmed = text.trim();
  const firstLine = trimmed.split('\n')[0]?.trim() ?? '';
  return firstLine.length > 0 ? firstLine.slice(0, 120) : 'Unbenannte Sektion';
}

function inferSectionType(text: string): AdventurePdfSectionV1['sectionType'] {
  if (/^\d+(\.\d+)*\s+/.test(text) || /^kapitel\b/i.test(text)) {
    return 'intro';
  }

  if (/\b(ort|dorf|stadt|haus|hafen|burg|hof|tempel|wald|lager)\b/i.test(text)) {
    return 'location_section';
  }

  if (/\b(nsc|person|meister|wirt|händler|wirtin|bürgermeister)\b/i.test(text)) {
    return 'npc_section';
  }

  if (/\b(szene|begegnung|ereignis|auslöser|trigger)\b/i.test(text)) {
    return 'scene_section';
  }

  if (/\b(meisterwissen|gm|hintergrund|hintergrundwissen)\b/i.test(text)) {
    return 'gm_background';
  }

  return sectionTypeSchema.parse('unknown');
}

function isHeadingLike(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed.length === 0) return false;
  if (trimmed.length > 120) return false;
  if (/^\d+(\.\d+)*\s+/.test(trimmed)) return true;
  if (/^[A-ZÄÖÜ][^\n]{0,80}$/.test(trimmed) && trimmed === trimmed.toUpperCase()) return true;
  const wordCount = trimmed.split(/\s+/).length;
  return wordCount <= 12 && /[A-ZÄÖÜ]/.test(trimmed[0] ?? '');
}
