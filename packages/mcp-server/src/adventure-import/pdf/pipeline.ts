import type { AdventurePdfIrV1 } from './ir.js';
import { adventureLayoutIrV1Schema, documentSchema } from './ir.js';
import { assemblePdfIr } from './ir_assembly.js';
import type { PdfAnnotationStore } from './annotation_store.js';
import { applyAnnotationsToIr, loadAnnotationStore, resolvePdfImportPaths } from './annotation_store.js';
import { buildFoundryImportPlan } from './foundry_mapping.js';
import { classifyAdventurePdfIr } from './heuristics_classification.js';
import { ingestPdf } from './ingest.js';
import { layoutOcrPdf } from './layout_ocr.js';
import type { PdfToolRunner } from './tooling.js';

export interface PdfImportPipelineOptions {
  pdfPath: string;
  outPath: string;
  runner: PdfToolRunner;
}

export interface PdfImportPipelineResult {
  ir: AdventurePdfIrV1;
  outputPath: string;
  annotationStorePath: string;
  annotationStore: PdfAnnotationStore;
}

export async function buildPdfImportIr(options: PdfImportPipelineOptions): Promise<PdfImportPipelineResult> {
  const ingest = await ingestPdf(options.pdfPath, options.runner);
  const outputPaths = resolvePdfImportPaths(options.outPath, ingest.document.id);
  const layout = await layoutOcrPdf(ingest.document, ingest.pages, options.runner);
  const assembled = assemblePdfIr(layout.document.sourcePath, layout.rawBlocks);
  const classified = classifyAdventurePdfIr(layout.document.sourcePath, assembled.blocks, assembled.sections);

  const annotationStore = await loadAnnotationStore(outputPaths.annotationStorePath, {
    id: ingest.document.id,
    sourcePath: ingest.document.sourcePath,
    sourceHash: ingest.document.sourceHash,
  });

  const baseIr = adventureLayoutIrV1Schema.parse({
    irVersion: 'adventure-layout-ir.v1',
    document: documentSchema.parse({
      id: ingest.document.id,
      sourcePath: ingest.document.sourcePath,
      sourceHash: ingest.document.sourceHash,
      pdfType: layout.document.pdfType,
      pageCount: ingest.document.pageCount,
      defaultLanguage: ingest.document.defaultLanguage,
      profile: ingest.document.profile,
      createdAt: ingest.document.createdAt,
      source: 'pdf',
      sourceBlockIds: [],
      confidence: 1,
      provenance: {
        producer: 'ingest',
        rule: 'pdfinfo.v1',
      },
    }),
    pages: layout.pages,
    blocks: classified.blocks,
    sections: classified.sections,
    entityCandidates: classified.entityCandidates,
    entityStubs: classified.entityStubs,
    annotations: annotationStore.annotations,
    importPlan: [],
  });

  const annotated = applyAnnotationsToIr(baseIr, annotationStore.annotations);
  const importPlan = buildFoundryImportPlan(annotated);
  const ir = adventureLayoutIrV1Schema.parse({
    ...annotated,
    importPlan,
  });

  return {
    ir,
    outputPath: outputPaths.outputPath,
    annotationStorePath: outputPaths.annotationStorePath,
    annotationStore,
  };
}
