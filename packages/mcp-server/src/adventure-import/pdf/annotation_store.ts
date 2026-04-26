import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, extname, join, resolve } from 'node:path';
import type { AdventurePdfAnnotationV1, AdventurePdfIrV1 } from './ir.js';
import { annotationSchema } from './ir.js';
import { createEntityStubId } from './ids.js';

export const annotationStoreVersion = 'adventure-layout-annotations.v1' as const;

export interface PdfAnnotationStore {
  storeVersion: typeof annotationStoreVersion;
  documentId: string;
  sourcePath: string;
  sourceHash: string;
  annotations: AdventurePdfAnnotationV1[];
}

export function createEmptyAnnotationStore(document: {
  id: string;
  sourcePath: string;
  sourceHash: string;
}): PdfAnnotationStore {
  return {
    storeVersion: annotationStoreVersion,
    documentId: document.id,
    sourcePath: document.sourcePath,
    sourceHash: document.sourceHash,
    annotations: [],
  };
}

export function resolvePdfImportPaths(outPath: string, documentId: string): {
  outputPath: string;
  annotationStorePath: string;
  outputDir: string;
} {
  const resolved = resolve(outPath);
  const isFile = extname(resolved).toLowerCase() === '.json';
  const outputDir = isFile ? dirname(resolved) : resolved;
  const outputPath = isFile ? resolved : join(outputDir, `${documentId}.ir.json`);
  const annotationStorePath = join(outputDir, `${documentId}.annotations.json`);

  return {
    outputPath,
    annotationStorePath,
    outputDir,
  };
}

export async function loadAnnotationStore(storePath: string, document: {
  id: string;
  sourcePath: string;
  sourceHash: string;
}): Promise<PdfAnnotationStore> {
  try {
    const raw = await readFile(storePath, 'utf8');
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const annotations = Array.isArray(parsed.annotations)
      ? parsed.annotations.map((annotation: unknown) => annotationSchema.parse(annotation))
      : [];

    return {
      storeVersion: annotationStoreVersion,
      documentId: document.id,
      sourcePath: document.sourcePath,
      sourceHash: document.sourceHash,
      annotations,
    };
  } catch {
    return createEmptyAnnotationStore(document);
  }
}

export async function saveAnnotationStore(storePath: string, store: PdfAnnotationStore): Promise<void> {
  await mkdir(dirname(storePath), { recursive: true });
  await writeFile(storePath, `${JSON.stringify(store, null, 2)}\n`, 'utf8');
}

export function applyAnnotationsToIr(ir: AdventurePdfIrV1, annotations: AdventurePdfAnnotationV1[]): AdventurePdfIrV1 {
  let blocks = ir.blocks.map(cloneBlock);
  const sections = ir.sections.map((section) => ({ ...section }));
  const entityCandidates = ir.entityCandidates.map((candidate) => ({ ...candidate }));
  const entityStubs = ir.entityStubs.map((stub) => ({ ...stub }));

  for (const annotation of annotations) {
    if (annotation.targetType === 'block') {
      const payload = annotation.payload as Record<string, unknown>;
      const targetIndex = blocks.findIndex((item) => item.id === annotation.targetId);
      if (targetIndex >= 0) {
        const block = blocks[targetIndex];

        if (annotation.action === 'relabel') {
          const nextBlockType = typeof payload.blockType === 'string' ? normalizeBlockType(payload.blockType) : undefined;
          if (nextBlockType) {
            block.blockType = nextBlockType;
          }
          if (typeof payload.roleHint === 'string') {
            block.roleHint = payload.roleHint;
          }
          if (typeof payload.confidence === 'number' && Number.isFinite(payload.confidence)) {
            block.confidence = clampConfidence(payload.confidence);
          }
          block.provenance = {
            producer: 'annotation_store',
            rule: 'block_relabel.v1',
          };
        }

        if (annotation.action === 'ignore') {
          block.blockType = 'unknown';
          block.confidence = 0.05;
          block.roleHint = 'ignored';
          block.provenance = {
            producer: 'annotation_store',
            rule: 'block_ignore.v1',
          };
        }

        if (annotation.action === 'fix_reading_order') {
          if (typeof payload.readingOrder === 'number' && Number.isFinite(payload.readingOrder)) {
            block.readingOrder = Math.max(1, Math.trunc(payload.readingOrder));
          }
        }

        if (annotation.action === 'mark_stub') {
          const stubType = toStubType(payload.stubType);
          if (stubType) {
            const label = typeof payload.label === 'string' && payload.label.trim().length > 0 ? payload.label.trim() : block.textNormalized || block.textRaw;
            const minimumPayload = isRecord(payload.minimumPayload) ? payload.minimumPayload : buildDefaultMinimumPayload(stubType, label, block.textRaw);
            const stub = {
              id: createEntityStubId(ir.document.sourcePath, stubType, label, [block.id]),
              stubType,
              label,
              sourceBlockIds: [block.id],
              minimumPayload,
              createdFrom: 'annotation' as const,
              readyForImport: true,
              confidence: clampConfidence(typeof payload.confidence === 'number' ? payload.confidence : 1),
              source: 'manual_annotation' as const,
              provenance: {
                producer: 'annotation_store',
                rule: 'mark_stub.v1',
              },
            };

            if (!entityStubs.some((item) => item.id === stub.id)) {
              entityStubs.push(stub);
            }
          }
        }

        if (annotation.action === 'split') {
          const splitId = createDerivedBlockId(ir.document.id, block.id, annotation.id, 'split');
          const splitBbox = isRect(payload.bbox) ? payload.bbox : block.bbox;
          const splitBlockType = typeof payload.blockType === 'string' ? normalizeBlockType(payload.blockType) ?? block.blockType : block.blockType;
          const splitText = typeof payload.text === 'string'
            ? payload.text
            : typeof payload.label === 'string'
              ? payload.label
              : block.textRaw;
          const splitBlock: AdventurePdfIrV1['blocks'][number] = {
            ...cloneBlock(block),
            id: splitId,
            bbox: { ...splitBbox },
            readingOrder: block.readingOrder + 1,
            blockType: splitBlockType,
            textRaw: splitText,
            textNormalized: normalizeText(splitText),
            source: 'manual_annotation',
            sourceBlockIds: [block.id],
            confidence: clampConfidence(typeof payload.confidence === 'number' ? payload.confidence : block.confidence),
            provenance: {
              producer: 'annotation_store',
              rule: 'block_split.v1',
            },
            links: {
              prevBlockId: block.id,
              nextBlockId: block.links?.nextBlockId,
            },
          };
          blocks.push(splitBlock);
        }

        if (annotation.action === 'merge') {
          const mergeIds = uniqueStrings([
            annotation.targetId,
            ...annotation.sourceBlockIds,
            ...(Array.isArray(payload.blockIds) ? payload.blockIds.filter((item): item is string => typeof item === 'string') : []),
          ]);
          const selected = blocks.filter((item) => mergeIds.includes(item.id));
          if (selected.length >= 2) {
            const representative = selected.slice().sort(compareBlocks)[0];
            const mergedId = createDerivedBlockId(ir.document.id, representative.id, annotation.id, 'merge');
            const mergedTexts = selected.map((item) => item.textRaw).filter(Boolean);
            const mergedBlock: AdventurePdfIrV1['blocks'][number] = {
              ...cloneBlock(representative),
              id: mergedId,
              bbox: unionBbox(selected.map((item) => item.bbox as { x: number; y: number; w: number; h: number })),
              readingOrder: Math.min(...selected.map((item) => item.readingOrder)),
              blockType: typeof payload.blockType === 'string' ? normalizeBlockType(payload.blockType) ?? representative.blockType : representative.blockType,
              textRaw: mergedTexts.join('\n\n') || representative.textRaw,
              textNormalized: normalizeText(mergedTexts.join(' ')),
              source: 'manual_annotation',
              sourceBlockIds: mergeIds,
              confidence: clampConfidence(typeof payload.confidence === 'number' ? payload.confidence : representative.confidence),
              provenance: {
                producer: 'annotation_store',
                rule: 'block_merge.v1',
              },
              links: {
                prevBlockId: selected[0]?.links?.prevBlockId,
                nextBlockId: selected[selected.length - 1]?.links?.nextBlockId,
              },
            };
            blocks = blocks.filter((item) => !mergeIds.includes(item.id));
            blocks.push(mergedBlock);
          }
        }
      }
    }

    if (annotation.targetType === 'entityCandidate') {
      const candidate = entityCandidates.find((item) => item.id === annotation.targetId);
      if (!candidate) {
        continue;
      }

      if (annotation.action === 'promote_candidate') {
        candidate.status = 'confirmed';
        candidate.provenance = {
          producer: 'annotation_store',
          rule: 'candidate_promote.v1',
        };
      }

      if (annotation.action === 'reject_candidate') {
        candidate.status = 'rejected';
        candidate.provenance = {
          producer: 'annotation_store',
          rule: 'candidate_reject.v1',
        };
      }

      if (annotation.action === 'mark_stub') {
        const stubType = toStubType(candidate.entityType);
        if (stubType) {
          const stub = {
            id: createEntityStubId(ir.document.sourcePath, stubType, candidate.label, candidate.sourceBlockIds),
            stubType,
            label: candidate.label,
            sourceBlockIds: [...candidate.sourceBlockIds],
            minimumPayload: buildDefaultMinimumPayload(stubType, candidate.label, candidate.label),
            createdFrom: 'annotation' as const,
            readyForImport: true,
            confidence: candidate.confidence,
            source: candidate.source,
            provenance: {
              producer: 'annotation_store',
              rule: 'candidate_mark_stub.v1',
            },
          };
          if (!entityStubs.some((item) => item.id === stub.id)) {
            entityStubs.push(stub);
          }
        }
      }
    }

    if (annotation.targetType === 'entityStub') {
      const stub = entityStubs.find((item) => item.id === annotation.targetId);
      if (!stub) {
        continue;
      }

      const payload = annotation.payload as Record<string, unknown>;
      if (annotation.action === 'relabel') {
        if (typeof payload.label === 'string' && payload.label.trim().length > 0) {
          stub.label = payload.label.trim();
        }
        if (isRecord(payload.minimumPayload)) {
          stub.minimumPayload = payload.minimumPayload;
        }
      }

      if (annotation.action === 'ignore') {
        stub.readyForImport = false;
      }
    }
  }

  blocks = renumberBlocksByPage(blocks);

  return {
    ...ir,
    blocks,
    sections,
    entityCandidates,
    entityStubs,
  };
}

function cloneBlock(block: AdventurePdfIrV1['blocks'][number]): AdventurePdfIrV1['blocks'][number] {
  return {
    ...block,
    bbox: { ...block.bbox },
    sourceBlockIds: [...(block.sourceBlockIds ?? [])],
    provenance: { ...block.provenance },
    style: block.style ? { ...block.style } : {},
    links: block.links ? { ...block.links } : {},
  };
}

function compareBlocks(left: AdventurePdfIrV1['blocks'][number], right: AdventurePdfIrV1['blocks'][number]): number {
  if (left.pageNumber !== right.pageNumber) return left.pageNumber - right.pageNumber;
  if (left.readingOrder !== right.readingOrder) return left.readingOrder - right.readingOrder;
  if (left.bbox.y !== right.bbox.y) return left.bbox.y - right.bbox.y;
  if (left.bbox.x !== right.bbox.x) return left.bbox.x - right.bbox.x;
  return left.id.localeCompare(right.id);
}

function renumberBlocksByPage(blocks: AdventurePdfIrV1['blocks']): AdventurePdfIrV1['blocks'] {
  const nextBlocks = blocks.map(cloneBlock);
  const grouped = new Map<number, AdventurePdfIrV1['blocks']>();

  for (const block of nextBlocks) {
    const pageBlocks = grouped.get(block.pageNumber) ?? [];
    pageBlocks.push(block);
    grouped.set(block.pageNumber, pageBlocks);
  }

  Array.from(grouped.values()).forEach((pageBlocks) => {
    pageBlocks.sort(compareBlocks);
    pageBlocks.forEach((block, index) => {
      block.readingOrder = index + 1;
    });
  });

  return nextBlocks.sort(compareBlocks);
}

function unionBbox(boxes: Array<{ x: number; y: number; w: number; h: number }>): { x: number; y: number; w: number; h: number } {
  if (!boxes.length) return { x: 0, y: 0, w: 0, h: 0 };
  const x1 = Math.min(...boxes.map((box) => box.x));
  const y1 = Math.min(...boxes.map((box) => box.y));
  const x2 = Math.max(...boxes.map((box) => box.x + box.w));
  const y2 = Math.max(...boxes.map((box) => box.y + box.h));
  return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
}

function sameBbox(left: { x: number; y: number; w: number; h: number }, right: { x: number; y: number; w: number; h: number }): boolean {
  return left.x === right.x && left.y === right.y && left.w === right.w && left.h === right.h;
}

function normalizeText(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values.filter((value) => value.trim().length > 0)));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isRect(value: unknown): value is { x: number; y: number; w: number; h: number } {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    typeof (value as Record<string, unknown>).x === 'number' &&
    typeof (value as Record<string, unknown>).y === 'number' &&
    typeof (value as Record<string, unknown>).w === 'number' &&
    typeof (value as Record<string, unknown>).h === 'number'
  );
}

function clampConfidence(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.min(1, Math.max(0, value));
}

function toStubType(value: unknown): 'npc_stub' | 'location_stub' | 'scene_stub' | undefined {
  if (value === 'npc_stub' || value === 'location_stub' || value === 'scene_stub') {
    return value;
  }
  if (value === 'npc') return 'npc_stub';
  if (value === 'location') return 'location_stub';
  if (value === 'scene') return 'scene_stub';
  return undefined;
}

function normalizeBlockType(value: string): AdventurePdfIrV1['blocks'][number]['blockType'] | undefined {
  if (
    value === 'heading' ||
    value === 'paragraph' ||
    value === 'list' ||
    value === 'stat_block' ||
    value === 'read_aloud' ||
    value === 'sidebar' ||
    value === 'table_like' ||
    value === 'illustration' ||
    value === 'decoration' ||
    value === 'footer' ||
    value === 'header' ||
    value === 'unknown'
  ) {
    return value;
  }
  return undefined;
}

function buildDefaultMinimumPayload(stubType: 'npc_stub' | 'location_stub' | 'scene_stub', label: string, text: string): Record<string, unknown> {
  const summary = summarizeText(text);
  if (stubType === 'scene_stub') {
    return {
      title: label,
      summary,
    };
  }

  return {
    name: label,
    summary,
  };
}

function summarizeText(text: string): string {
  const normalized = normalizeText(text);
  if (normalized.length <= 180) {
    return normalized;
  }
  return normalized.slice(0, 180);
}

function createDerivedBlockId(documentId: string, sourceBlockId: string, annotationId: string, kind: 'split' | 'merge'): string {
  return `block:${kind}:${slugifyIdPart(documentId)}:${slugifyIdPart(sourceBlockId)}:${slugifyIdPart(annotationId).slice(0, 12)}`;
}

function slugifyIdPart(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'x';
}
