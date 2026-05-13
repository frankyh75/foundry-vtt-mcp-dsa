import type { AdventurePdfBlockV1, AdventurePdfPageV1 } from './ir.js';
import { layoutOcrStatusSchema, ocrModeSchema, sourceSchema } from './ir.js';
import { createRawBlockId } from './ids.js';
import type { PdfIngestDocument, PdfIngestPage } from './ingest.js';
import type { PdfToolRunner, OcrBlock, OcrBlockKind, OcrPageResult } from './tooling.js';
import { splitSemanticBlocks } from './semantic_block_splitter.js';

export interface PdfLayoutRawBlock {
  id: string;
  pageId: string;
  pageNumber: number;
  readingOrder: number;
  bbox: {
    x: number;
    y: number;
    w: number;
    h: number;
  };
  textRaw: string;
  textSource: 'text_layer' | 'ocr' | 'none' | 'unknown';
  layoutOcrStatus: 'text_layer' | 'needs_ocr' | 'unsupported';
  blockType: AdventurePdfBlockV1['blockType'];
  source: AdventurePdfPageV1['source'];
  sourceBlockIds: string[];
  confidence: number;
  engineBlockType?: string;
  provenance: {
    producer: string;
    rule: string;
    details?: string;
  };
}

export interface PdfLayoutOcrResult {
  document: PdfIngestDocument;
  pages: AdventurePdfPageV1[];
  rawBlocks: PdfLayoutRawBlock[];
}

export async function layoutOcrPdf(
  document: PdfIngestDocument,
  pages: PdfIngestPage[],
  runner: PdfToolRunner,
): Promise<PdfLayoutOcrResult> {
  const rawBlocks: PdfLayoutRawBlock[] = [];
  const classifiedPages: AdventurePdfPageV1[] = [];
  let textPageCount = 0;
  let imagePageCount = 0;
  let unsupportedPageCount = 0;

  for (const page of pages) {
    const extractedText = await extractTextForPage(runner, document.sourcePath, page.pageNumber);
    const normalizedText = normalizeText(extractedText);
    const hasUsableText = normalizedText.length > 0;
    const renderProbe = hasUsableText ? true : await runner.probeRender(document.sourcePath, page.pageNumber);
    const layoutOcrStatus = hasUsableText ? 'text_layer' : renderProbe ? 'needs_ocr' : 'unsupported';
    const textSource: PdfLayoutRawBlock['textSource'] = hasUsableText ? 'text_layer' : renderProbe ? 'none' : 'none';
    const ocrMode = hasUsableText ? 'none' : renderProbe ? 'required' : 'none';

    if (hasUsableText) {
      textPageCount += 1;

      const ocrResult = await runner.ocrPage(document.sourcePath, page.pageNumber, {
        languageHint: document.defaultLanguage,
      });

      if (ocrResult?.available && ocrResult.blocks.length > 0) {
        const mergedOcrBlocks = mergeOcrBlockFragments(ocrResult.blocks);
        const pageBlocks: PdfLayoutRawBlock[] = mergedOcrBlocks.map((block) =>
          buildOcrBlock(document.sourcePath, page, block, layoutOcrStatus, ocrResult.engine)
        );
        rawBlocks.push(...pageBlocks);
        const pageText = ocrResult.text.trim();
        const primaryBlock =
          pageBlocks[0] ?? buildPagePlaceholderBlock(document.sourcePath, page, 'ocr', 'ocr_empty');
        classifiedPages.push(
          buildPage(
            page,
            document.id,
            primaryBlock,
            pageBlocks.map((b) => b.id),
            pageText.length,
            'ocr',
            layoutOcrStatus,
            ocrMode,
          ),
        );
        continue;
      }

      const semanticBlocks = splitSemanticBlocks(normalizedText);
      const textBlocks = semanticBlocks.map((b) => b.text);
      const blockKinds = semanticBlocks.map((b) => b.blockKind);
      if (textBlocks.length === 0) {
        // Fallback: ein Block für die gesamte Seite
        const rawBlock = buildTextLayerBlock(document.sourcePath, page, normalizedText, 1, 1);
        rawBlocks.push(rawBlock);
        classifiedPages.push(buildPage(page, document.id, rawBlock, [rawBlock.id], normalizedText.length, textSource, layoutOcrStatus, ocrMode));
        continue;
      }
      const pageRawBlocks: PdfLayoutRawBlock[] = textBlocks.map((text, idx) =>
        buildTextLayerBlock(document.sourcePath, page, text, idx + 1, textBlocks.length, blockKinds[idx])
      );
      rawBlocks.push(...pageRawBlocks);
      const primaryBlock = pageRawBlocks[0] ?? buildTextLayerBlock(document.sourcePath, page, normalizedText, 1, 1);
      classifiedPages.push(
        buildPage(
          page,
          document.id,
          primaryBlock,
          pageRawBlocks.map((b) => b.id),
          normalizedText.length,
          textSource,
          layoutOcrStatus,
          ocrMode,
        ),
      );
      continue;
    }

    if (!renderProbe) {
      unsupportedPageCount += 1;
      const emptyBlock = buildEmptyPageBlock(document.sourcePath, page, layoutOcrStatus, 'unsupported');
      classifiedPages.push(buildPage(page, document.id, emptyBlock, [], 0, 'none', layoutOcrStatus, ocrMode));
      continue;
    }

    imagePageCount += 1;
    const ocrResult = await runner.ocrPage(document.sourcePath, page.pageNumber, {
      languageHint: document.defaultLanguage,
    });

    if (!ocrResult.available) {
      const emptyBlock = buildEmptyPageBlock(
        document.sourcePath,
        page,
        layoutOcrStatus,
        `ocr_unavailable:${ocrResult.reason ?? 'unknown'}`,
      );
      classifiedPages.push(buildPage(page, document.id, emptyBlock, [], 0, 'none', layoutOcrStatus, ocrMode));
      continue;
    }

    const ocrBlocks = ocrResult.blocks.length > 0 ? mergeOcrBlockFragments(ocrResult.blocks) : [];
    const pageBlocks: PdfLayoutRawBlock[] = ocrBlocks.map((block) => buildOcrBlock(document.sourcePath, page, block, layoutOcrStatus, ocrResult.engine));
    rawBlocks.push(...pageBlocks);

    const pageText = ocrResult.text.trim();
    const primaryBlock =
      pageBlocks[0] ??
      buildPagePlaceholderBlock(document.sourcePath, page, 'ocr', 'ocr_empty');
    classifiedPages.push(buildPage(page, document.id, primaryBlock, pageBlocks.map((item) => item.id), pageText.length, 'ocr', layoutOcrStatus, ocrMode));
  }

  const pdfType =
    textPageCount > 0 && (imagePageCount > 0 || unsupportedPageCount > 0)
      ? 'mixed'
      : textPageCount > 0
        ? 'text'
        : imagePageCount > 0
          ? 'image'
          : 'unknown';

  return {
    document: {
      ...document,
      pdfType,
    },
    pages: classifiedPages,
    rawBlocks,
  };
}

async function extractTextForPage(
  runner: PdfToolRunner,
  sourcePath: string,
  pageNumber: number,
): Promise<string> {
  try {
    const rawText = await runner.pdfToText(sourcePath, pageNumber);
    return normalizeText(rawText);
  } catch {
    return '';
  }
}

function buildPage(
  page: PdfIngestPage,
  documentId: string,
  primaryBlock: PdfLayoutRawBlock,
  sourceBlockIds: string[],
  rawTextLength: number,
  textSource: AdventurePdfPageV1['textSource'],
  layoutOcrStatus: AdventurePdfPageV1['layoutOcrStatus'],
  ocrMode: AdventurePdfPageV1['ocrMode'],
): AdventurePdfPageV1 {
  return {
    id: page.id,
    documentId,
    pageNumber: page.pageNumber,
    width: page.width,
    height: page.height,
    ocrMode: ocrModeSchema.parse(ocrMode),
    layoutOcrStatus: layoutOcrStatusSchema.parse(layoutOcrStatus),
    textSource: sourceSchema.parse(textSource),
    readingOrderVersion: 1,
    rawTextLength,
    source: sourceSchema.parse(primaryBlock.source),
    sourceBlockIds,
    confidence: primaryBlock.confidence,
    provenance: primaryBlock.provenance,
  };
}

function splitTextLayerIntoBlocks(text: string, minBlockLength: number = 20): string[] {
  return text
    .split(/\n{2,}/)
    .map((s) => s.trim())
    .filter((s) => s.length >= minBlockLength);
}

function buildTextLayerBlock(
  sourcePath: string,
  page: PdfIngestPage,
  textRaw: string,
  readingOrder: number,
  totalBlocks: number,
  semanticBlockKind?: 'heading' | 'statblock' | 'paragraph' | 'unknown',
): PdfLayoutRawBlock {
  const blockType = semanticBlockKind
    ? mapSemanticKindToBlockType(semanticBlockKind)
    : inferBlockTypeFromText(textRaw);
  const portion = totalBlocks > 1 ? 1 / totalBlocks : 1;
  return {
    id: createRawBlockId(sourcePath, page.pageNumber, readingOrder, textRaw),
    pageId: page.id,
    pageNumber: page.pageNumber,
    readingOrder,
    bbox: {
      x: 0,
      y: page.height * (readingOrder - 1) * portion,
      w: page.width,
      h: page.height * portion,
    },
    textRaw,
    textSource: 'text_layer',
    layoutOcrStatus: 'text_layer',
    blockType,
    source: 'text_layer',
    sourceBlockIds: [page.id],
    confidence: 0.9,
    provenance: {
      producer: 'layout_ocr',
      rule: `pdf_text_layer.${blockType}.v1`,
      details: `segment=${readingOrder}/${totalBlocks}`,
    },
  };
}

function mapSemanticKindToBlockType(kind: 'heading' | 'statblock' | 'paragraph' | 'unknown'): AdventurePdfBlockV1['blockType'] {
  switch (kind) {
    case 'heading': return 'heading';
    case 'statblock': return 'paragraph';  // statblock maps to paragraph in blockType; roleHint carries the semantic
    case 'paragraph': return 'paragraph';
    case 'unknown': return 'paragraph';
  }
}

function buildPagePlaceholderBlock(
  sourcePath: string,
  page: PdfIngestPage,
  source: AdventurePdfPageV1['source'],
  ruleSuffix: string,
): PdfLayoutRawBlock {
  return {
    id: createRawBlockId(sourcePath, page.pageNumber, 1, `${ruleSuffix}:${page.pageNumber}`),
    pageId: page.id,
    pageNumber: page.pageNumber,
    readingOrder: 1,
    bbox: {
      x: 0,
      y: 0,
      w: page.width,
      h: page.height,
    },
    textRaw: '',
    textSource: source === 'ocr' ? 'ocr' : 'none',
    layoutOcrStatus: 'needs_ocr',
    blockType: 'unknown',
    source,
    sourceBlockIds: [],
    confidence: source === 'ocr' ? 0.1 : 0.05,
    provenance: {
      producer: 'layout_ocr',
      rule: ruleSuffix,
    },
  };
}

function buildEmptyPageBlock(
  sourcePath: string,
  page: PdfIngestPage,
  layoutOcrStatus: 'needs_ocr' | 'unsupported' | 'text_layer',
  ruleSuffix: string,
): PdfLayoutRawBlock {
  return {
    id: createRawBlockId(sourcePath, page.pageNumber, 1, `${ruleSuffix}:${page.pageNumber}`),
    pageId: page.id,
    pageNumber: page.pageNumber,
    readingOrder: 1,
    bbox: {
      x: 0,
      y: 0,
      w: page.width,
      h: page.height,
    },
    textRaw: '',
    textSource: 'none',
    layoutOcrStatus,
    blockType: 'unknown',
    source: 'none',
    sourceBlockIds: [],
    confidence: 0.05,
    provenance: {
      producer: 'layout_ocr',
      rule: ruleSuffix,
    },
  };
}

function buildOcrBlock(
  sourcePath: string,
  page: PdfIngestPage,
  block: OcrPageResult['blocks'][number],
  layoutOcrStatus: 'needs_ocr' | 'unsupported' | 'text_layer',
  engine: OcrPageResult['engine'],
): PdfLayoutRawBlock {
  const textRaw = block.text;
  const normalizedConfidence = Number.isFinite(block.confidence) ? clampConfidence(block.confidence / 100) : 0.5;
  const rawBlock: PdfLayoutRawBlock = {
    id: createRawBlockId(
      sourcePath,
      page.pageNumber,
      block.readingOrder,
      textRaw || `${block.kind}:${block.bbox.x}:${block.bbox.y}:${block.bbox.w}:${block.bbox.h}`,
    ),
    pageId: page.id,
    pageNumber: page.pageNumber,
    readingOrder: block.readingOrder,
    bbox: block.bbox,
    textRaw,
    textSource: 'ocr',
    layoutOcrStatus,
    blockType: mapOcrBlockKind(block.kind),
    source: 'ocr',
    sourceBlockIds: [page.id],
    confidence: normalizedConfidence,
    provenance: {
      producer: 'layout_ocr',
      rule: `${engine}_${block.kind}.v1`,
      details: `readingOrder=${block.readingOrder},engine=${engine}`,
    },
  };
  if (block.engineBlockType !== undefined) {
    rawBlock.engineBlockType = block.engineBlockType;
  }
  return rawBlock;
}

/**
 * Merge adjacent OCR block fragments that were artificially split.
 *
 * Rules (mirror mergeBlockFragments from heuristics_classification):
 * - Only merge blocks on the SAME page (all input assumed same page)
 * - Merge consecutive short fragments (≤60 chars) that look like continuations
 *   (start lowercase) or are statblock fragments.
 * - Never merge a heading into a prose block.
 * - Preserve highest readingOrder block as primary, absorb text into it.
 */
function mergeOcrBlockFragments(blocks: OcrBlock[]): OcrBlock[] {
  if (blocks.length <= 1) return blocks;

  const merged: OcrBlock[] = [];
  let i = 0;
  while (i < blocks.length) {
    const current = blocks[i];
    const currentText = normalizeText(current.text);
    const isShort = currentText.length <= 60;

    // --- Strategy 1: Statblock merge ---
    const hasPartialAttrs = /\b(MU|KL|IN|CH)\s+\d{1,2}/.test(currentText);
    const missingFullStatblock = !/\bLeP\s+\d+/.test(currentText);

    if (hasPartialAttrs && isShort && missingFullStatblock && i + 1 < blocks.length) {
      const next = blocks[i + 1];
      const nextText = normalizeText(next.text);
      const nextHasCoreStats = /\b(LeP|FF|GE)\s+\d+/.test(nextText) || /\b(AT|SK|ZK)\s+\d+/.test(nextText);

      if (nextHasCoreStats) {
        const combinedText = `${currentText}\n${nextText}`;
        merged.push({
          ...current,
          text: combinedText,
          confidence: Math.max(current.confidence, next.confidence),
          readingOrder: Math.max(current.readingOrder, next.readingOrder),
          bbox: unionBBox(current.bbox, next.bbox),
        });
        i += 2;
        continue;
      }
    }

    // --- Strategy 2: Prose merge ---
    // Collect consecutive short blocks that form a prose paragraph.
    if (
      isShort &&
      current.kind !== 'heading' &&
      !hasPartialAttrs &&
      !isRealHeading(currentText) &&
      i + 1 < blocks.length
    ) {
      const group: OcrBlock[] = [current];
      const textParts: string[] = [currentText];
      let j = i + 1;

      while (j < blocks.length) {
        const candidate = blocks[j];
        const candidateText = normalizeText(candidate.text);

        // Stop if candidate is clearly a standalone element
        if (candidate.kind === 'heading') break;
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
        const primary = group[group.length - 1]; // highest readingOrder wins
        merged.push({
          ...primary,
          text: combinedText,
          confidence: Math.max(...group.map((b) => b.confidence)),
          readingOrder: Math.max(...group.map((b) => b.readingOrder)),
          bbox: group.reduce((acc, b) => unionBBox(acc, b.bbox), primary.bbox),
        });
        i = j;
        continue;
      }
    }

    merged.push(current);
    i += 1;
  }

  return merged;
}

function unionBBox(
  a: { x: number; y: number; w: number; h: number },
  b: { x: number; y: number; w: number; h: number },
): { x: number; y: number; w: number; h: number } {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  const w = Math.max(a.x + a.w, b.x + b.w) - x;
  const h = Math.max(a.y + a.h, b.y + b.h) - y;
  return { x, y, w, h };
}

function isRealHeading(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed.length === 0) return false;
  if (/^\d+([.\s]|\.\d+)*\s+\S/.test(trimmed)) return true;
  if (trimmed === trimmed.toUpperCase() && trimmed.length <= 40 && trimmed.length > 1) return true;
  if (/^(Kapitel|Szene|Szenario|Ort|Personen|NSC|Meisterwissen|Hintergrundwissen|Ausrüstung|Kampf|Magie)\b/i.test(trimmed)) return true;
  return false;
}

function mapOcrBlockKind(kind: OcrBlockKind): AdventurePdfBlockV1['blockType'] {
  if (kind === 'heading') return 'heading';
  if (kind === 'paragraph') return 'paragraph';
  if (kind === 'list') return 'list';
  if (kind === 'illustration') return 'illustration';
  if (kind === 'decoration') return 'decoration';
  return 'unknown';
}

function inferBlockTypeFromText(text: string): AdventurePdfBlockV1['blockType'] {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (!normalized) {
    return 'unknown';
  }
  if (looksLikeList(normalized)) {
    return 'list';
  }
  if (isHeadingLike(normalized)) {
    return 'heading';
  }
  return 'paragraph';
}

function clampConfidence(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function normalizeText(value: string): string {
  const text = value.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = text
    .split('\n')
    .map((line) => line.trimEnd())
    .join('\n');

  return lines.replace(/\n{3,}/g, '\n\n').trim();
}

function isHeadingLike(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;
  if (trimmed.length > 120) return false;
  if (/^\d+(\.\d+)*\s+/.test(trimmed)) return true;
  if (/^(kapitel|szene|szenario|ort|personen|nsc|meisterwissen)\b/i.test(trimmed)) return true;
  const words = trimmed.split(/\s+/).filter(Boolean);
  return words.length <= 12 && /^[A-ZÄÖÜ]/.test(trimmed) && !looksLikeList(trimmed);
}

function looksLikeList(text: string): boolean {
  return /^[•\-*+]\s+/.test(text.trim()) || /^\d+[\).]\s+/.test(text.trim());
}
