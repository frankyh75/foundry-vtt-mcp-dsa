import { z } from 'zod';

export const irVersion = 'adventure-layout-ir.v1' as const;

export const pdfTypeSchema = z.enum(['text', 'image', 'mixed', 'unknown']);
export const sourceSchema = z.enum(['pdf', 'text_layer', 'ocr', 'manual_annotation', 'derived', 'none', 'unknown']);
export const layoutOcrStatusSchema = z.enum(['text_layer', 'needs_ocr', 'unsupported']);
export const ocrModeSchema = z.enum(['none', 'assist', 'required']);
export const blockTypeSchema = z.enum([
  'heading',
  'paragraph',
  'list',
  'stat_block',
  'read_aloud',
  'sidebar',
  'table_like',
  'illustration',
  'decoration',
  'footer',
  'header',
  'unknown',
]);
export const sectionTypeSchema = z.enum([
  'intro',
  'scene_section',
  'location_section',
  'npc_section',
  'gm_background',
  'supplement',
  'travel_section',
  'unknown',
]);
export const entityTypeSchema = z.enum(['npc', 'location', 'scene', 'item', 'quest_hook', 'creature']);
export const entityStatusSchema = z.enum(['proposed', 'confirmed', 'rejected', 'converted_to_stub']);
export const stubTypeSchema = z.enum(['npc_stub', 'location_stub', 'scene_stub']);
export const annotationTargetTypeSchema = z.enum(['document', 'page', 'block', 'section', 'entityCandidate', 'entityStub']);
export const annotationActionSchema = z.enum([
  'relabel',
  'split',
  'merge',
  'mark_stub',
  'ignore',
  'fix_reading_order',
  'promote_candidate',
  'reject_candidate',
]);
export const importPlanTargetTypeSchema = z.enum(['foundry_actor', 'foundry_journal', 'foundry_scene']);
export const importPlanTargetSubtypeSchema = z.enum(['npc', 'location', 'scene']);
export const importPlanOperationSchema = z.enum(['create', 'update', 'skip']);

const confidenceSchema = z.number().min(0).max(1);

export const provenanceSchema = z
  .object({
    producer: z.string().min(1),
    rule: z.string().min(1),
    details: z.string().optional(),
  })
  .passthrough();

export const bboxSchema = z
  .object({
    x: z.number(),
    y: z.number(),
    w: z.number().nonnegative(),
    h: z.number().nonnegative(),
  })
  .passthrough();

export const blockStyleSchema = z
  .object({
    columnIndex: z.number().int().nonnegative().optional(),
    fontClass: z.string().optional(),
    isHeading: z.boolean().optional(),
    isListLike: z.boolean().optional(),
  })
  .passthrough();

export const blockLinksSchema = z
  .object({
    prevBlockId: z.string().min(1).optional(),
    nextBlockId: z.string().min(1).optional(),
  })
  .passthrough();

export const documentSchema = z
  .object({
    id: z.string().min(1),
    sourcePath: z.string().min(1),
    sourceHash: z.string().min(1),
    pdfType: pdfTypeSchema,
    pageCount: z.number().int().nonnegative(),
    defaultLanguage: z.string().min(1),
    profile: z.string().min(1),
    createdAt: z.string().min(1),
    source: sourceSchema,
    sourceBlockIds: z.array(z.string().min(1)).default([]),
    confidence: confidenceSchema,
    provenance: provenanceSchema,
  })
  .passthrough();

export const pageSchema = z
  .object({
    id: z.string().min(1),
    documentId: z.string().min(1),
    pageNumber: z.number().int().positive(),
    width: z.number().nonnegative(),
    height: z.number().nonnegative(),
    ocrMode: ocrModeSchema,
    layoutOcrStatus: layoutOcrStatusSchema,
    textSource: sourceSchema,
    readingOrderVersion: z.number().int().positive(),
    imagePath: z.string().min(1).optional(),
    rawTextLength: z.number().int().nonnegative().default(0),
    source: sourceSchema,
    sourceBlockIds: z.array(z.string().min(1)).default([]),
    confidence: confidenceSchema,
    provenance: provenanceSchema,
  })
  .passthrough();

export const blockSchema = z
  .object({
    id: z.string().min(1),
    pageId: z.string().min(1),
    pageNumber: z.number().int().positive(),
    bbox: bboxSchema,
    readingOrder: z.number().int().positive(),
    blockType: blockTypeSchema,
    roleHint: z.string().min(1).optional(),
    textRaw: z.string(),
    textNormalized: z.string(),
    source: sourceSchema,
    sourceBlockIds: z.array(z.string().min(1)).default([]),
    confidence: confidenceSchema,
    provenance: provenanceSchema,
    style: blockStyleSchema.default({}),
    links: blockLinksSchema.default({}),
  })
  .passthrough();

export const sectionSchema = z
  .object({
    id: z.string().min(1),
    title: z.string().min(1),
    sectionType: sectionTypeSchema,
    blockIds: z.array(z.string().min(1)),
    source: sourceSchema,
    sourceBlockIds: z.array(z.string().min(1)).default([]),
    confidence: confidenceSchema,
    provenance: provenanceSchema,
  })
  .passthrough();

export const annotationSchema = z
  .object({
    id: z.string().min(1),
    targetType: annotationTargetTypeSchema,
    targetId: z.string().min(1),
    action: annotationActionSchema,
    payload: z.record(z.any()),
    comment: z.string().optional(),
    author: z.string().min(1),
    createdAt: z.string().min(1),
    source: sourceSchema,
    sourceBlockIds: z.array(z.string().min(1)).default([]),
    confidence: confidenceSchema,
    provenance: provenanceSchema,
  })
  .passthrough();

export const entityCandidateSchema = z
  .object({
    id: z.string().min(1),
    entityType: entityTypeSchema,
    label: z.string().min(1),
    sourceBlockIds: z.array(z.string().min(1)),
    attributes: z.record(z.any()).default({}),
    confidence: confidenceSchema,
    status: entityStatusSchema,
    source: sourceSchema,
    provenance: provenanceSchema,
  })
  .passthrough();

export const entityStubSchema = z
  .object({
    id: z.string().min(1),
    stubType: stubTypeSchema,
    label: z.string().min(1),
    sourceBlockIds: z.array(z.string().min(1)),
    minimumPayload: z.record(z.any()),
    createdFrom: z.enum(['annotation', 'heuristic', 'merge', 'manual']),
    readyForImport: z.boolean(),
    confidence: confidenceSchema,
    source: sourceSchema,
    provenance: provenanceSchema,
  })
  .passthrough();

export const importPlanSchema = z
  .object({
    id: z.string().min(1),
    targetType: importPlanTargetTypeSchema,
    targetSubtype: importPlanTargetSubtypeSchema,
    sourceEntityId: z.string().min(1),
    operation: importPlanOperationSchema,
    payload: z.record(z.any()),
    missingFields: z.array(z.string().min(1)).default([]),
    confidence: confidenceSchema,
    requiresReview: z.boolean(),
    source: sourceSchema,
    sourceBlockIds: z.array(z.string().min(1)).default([]),
    provenance: provenanceSchema,
  })
  .passthrough();

export const adventureLayoutIrV1Schema = z
  .object({
    irVersion: z.literal(irVersion),
    document: documentSchema,
    pages: z.array(pageSchema),
    blocks: z.array(blockSchema),
    sections: z.array(sectionSchema),
    entityCandidates: z.array(entityCandidateSchema),
    entityStubs: z.array(entityStubSchema),
    annotations: z.array(annotationSchema),
    importPlan: z.array(importPlanSchema),
  })
  .passthrough();

export type AdventurePdfIrV1 = z.infer<typeof adventureLayoutIrV1Schema>;
export type AdventurePdfDocumentV1 = z.infer<typeof documentSchema>;
export type AdventurePdfPageV1 = z.infer<typeof pageSchema>;
export type AdventurePdfBlockV1 = z.infer<typeof blockSchema>;
export type AdventurePdfSectionV1 = z.infer<typeof sectionSchema>;
export type AdventurePdfAnnotationV1 = z.infer<typeof annotationSchema>;
export type AdventurePdfEntityCandidateV1 = z.infer<typeof entityCandidateSchema>;
export type AdventurePdfEntityStubV1 = z.infer<typeof entityStubSchema>;
export type AdventurePdfImportPlanV1 = z.infer<typeof importPlanSchema>;
