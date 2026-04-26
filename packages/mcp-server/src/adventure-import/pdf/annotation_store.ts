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
  const blocks = ir.blocks.map((block) => ({ ...block }));
  const sections = ir.sections.map((section) => ({ ...section }));
  const entityCandidates = ir.entityCandidates.map((candidate) => ({ ...candidate }));
  const entityStubs = ir.entityStubs.map((stub) => ({ ...stub }));

  for (const annotation of annotations) {
    if (annotation.targetType === 'block') {
      const block = blocks.find((item) => item.id === annotation.targetId);
      if (!block) {
        continue;
      }

      if (annotation.action === 'relabel') {
        const payload = annotation.payload as Record<string, unknown>;
        if (typeof payload.blockType === 'string') {
          block.blockType = normalizeBlockType(payload.blockType) ?? block.blockType;
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
        const payload = annotation.payload as Record<string, unknown>;
        if (typeof payload.readingOrder === 'number' && Number.isFinite(payload.readingOrder)) {
          block.readingOrder = Math.max(1, Math.trunc(payload.readingOrder));
        }
      }

      if (annotation.action === 'mark_stub') {
        const payload = annotation.payload as Record<string, unknown>;
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

      if (annotation.action === 'relabel') {
        const payload = annotation.payload as Record<string, unknown>;
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

  return {
    ...ir,
    blocks,
    sections,
    entityCandidates,
    entityStubs,
  };
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
  if (value === 'heading' || value === 'paragraph' || value === 'list' || value === 'stat_block' || value === 'read_aloud' || value === 'sidebar' || value === 'table_like' || value === 'illustration' || value === 'decoration' || value === 'footer' || value === 'header' || value === 'unknown') {
    return value;
  }
  return undefined;
}

function clampConfidence(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.min(1, Math.max(0, value));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function summarizeText(text: string): string {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (normalized.length <= 180) {
    return normalized;
  }
  return normalized.slice(0, 180);
}
