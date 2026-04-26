import type { AdventurePdfEntityStubV1, AdventurePdfImportPlanV1, AdventurePdfIrV1 } from './ir.js';
import { importPlanSchema, importPlanTargetSubtypeSchema, importPlanTargetTypeSchema, sourceSchema } from './ir.js';
import { createImportPlanId } from './ids.js';

export function buildFoundryImportPlan(ir: AdventurePdfIrV1): AdventurePdfImportPlanV1[] {
  const plans = ir.entityStubs.map((stub) => mapStubToImportPlan(ir, stub));
  return plans.sort((left, right) => left.id.localeCompare(right.id));
}

function mapStubToImportPlan(ir: AdventurePdfIrV1, stub: AdventurePdfEntityStubV1): AdventurePdfImportPlanV1 {
  const mapping = mapStubType(stub.stubType);
  const missingFields = mapMissingFields(stub.stubType, stub.minimumPayload);
  const requiresReview = !stub.readyForImport || stub.confidence < 0.9 || missingFields.length > 0;
  const payload = buildPlanPayload(stub);

  return importPlanSchema.parse({
    id: createImportPlanId(ir.document.sourcePath, mapping.targetType, stub.id),
    targetType: mapping.targetType,
    targetSubtype: mapping.targetSubtype,
    sourceEntityId: stub.id,
    operation: 'create',
    payload,
    missingFields,
    confidence: stub.confidence,
    requiresReview,
    source: sourceSchema.parse('derived'),
    sourceBlockIds: [...stub.sourceBlockIds],
    provenance: {
      producer: 'foundry_mapping',
      rule: mapping.rule,
    },
  });
}

function mapStubType(stubType: AdventurePdfEntityStubV1['stubType']): {
  targetType: AdventurePdfImportPlanV1['targetType'];
  targetSubtype: AdventurePdfImportPlanV1['targetSubtype'];
  rule: string;
} {
  if (stubType === 'npc_stub') {
    return {
      targetType: importPlanTargetTypeSchema.parse('foundry_actor'),
      targetSubtype: importPlanTargetSubtypeSchema.parse('npc'),
      rule: 'npc_stub_to_actor.v1',
    };
  }

  if (stubType === 'location_stub') {
    return {
      targetType: importPlanTargetTypeSchema.parse('foundry_journal'),
      targetSubtype: importPlanTargetSubtypeSchema.parse('location'),
      rule: 'location_stub_to_journal.v1',
    };
  }

  return {
    targetType: importPlanTargetTypeSchema.parse('foundry_scene'),
    targetSubtype: importPlanTargetSubtypeSchema.parse('scene'),
    rule: 'scene_stub_to_scene.v1',
  };
}

function mapMissingFields(
  stubType: AdventurePdfEntityStubV1['stubType'],
  minimumPayload: Record<string, unknown>,
): string[] {
  const fields: string[] = [];
  if (stubType === 'npc_stub') {
    if (!isPresent(minimumPayload.name)) fields.push('name');
    fields.push('attributes', 'skills');
  }

  if (stubType === 'location_stub') {
    if (!isPresent(minimumPayload.name)) fields.push('name');
    fields.push('description', 'sceneLinks');
  }

  if (stubType === 'scene_stub') {
    if (!isPresent(minimumPayload.title)) fields.push('title');
    fields.push('trigger', 'summary');
  }

  return Array.from(new Set(fields));
}

function buildPlanPayload(stub: AdventurePdfEntityStubV1): Record<string, unknown> {
  const summary = getSummary(stub.minimumPayload);

  if (stub.stubType === 'npc_stub') {
    return {
      name: stub.label,
      notes: 'Aus PDF importiert. Bitte manuell pruefen.',
      summary,
      sourceBlockIds: [...stub.sourceBlockIds],
    };
  }

  if (stub.stubType === 'location_stub') {
    return {
      name: stub.label,
      content: summary,
      notes: 'Aus PDF importiert. Bitte manuell pruefen.',
      sourceBlockIds: [...stub.sourceBlockIds],
    };
  }

  return {
    name: stub.label,
    notes: 'Aus PDF importiert. Bitte manuell pruefen.',
    summary,
    sourceBlockIds: [...stub.sourceBlockIds],
  };
}

function getSummary(payload: Record<string, unknown>): string {
  if (typeof payload.summary === 'string' && payload.summary.trim().length > 0) {
    return payload.summary.trim();
  }
  if (typeof payload.name === 'string' && payload.name.trim().length > 0) {
    return payload.name.trim();
  }
  if (typeof payload.title === 'string' && payload.title.trim().length > 0) {
    return payload.title.trim();
  }
  return '';
}

function isPresent(value: unknown): boolean {
  return typeof value === 'string' ? value.trim().length > 0 : value !== undefined && value !== null;
}
