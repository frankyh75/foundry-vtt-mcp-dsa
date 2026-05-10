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
    if (!isPresent(minimumPayload.attributes)) fields.push('attributes');
    if (!isPresent(minimumPayload.skills)) fields.push('skills');
  }

  if (stubType === 'location_stub') {
    if (!isPresent(minimumPayload.name)) fields.push('name');
    if (!isPresent(minimumPayload.description)) fields.push('description');
    if (!isPresent(minimumPayload.sceneLinks)) fields.push('sceneLinks');
  }

  if (stubType === 'scene_stub') {
    if (!isPresent(minimumPayload.title)) fields.push('title');
    if (!isPresent(minimumPayload.trigger)) fields.push('trigger');
    if (!isPresent(minimumPayload.summary)) fields.push('summary');
  }

  return Array.from(new Set(fields));
}

function buildPlanPayload(stub: AdventurePdfEntityStubV1): Record<string, unknown> {
  const summary = getSummary(stub.minimumPayload);

  if (stub.stubType === 'npc_stub') {
    const mp = stub.minimumPayload;
    return {
      name: stub.label,
      type: 'npc',
      system: {
        ...(extractAttributes(mp)),
        status: {
          wounds: extractWounds(mp),
          astralenergy: { value: extractAsP(mp) },
          karmaenergy: { value: extractKaP(mp) },
        },
        details: {
          species: extractString(mp, 'species') ?? '',
          culture: extractString(mp, 'culture') ?? '',
          experience: { total: extractNumber(mp, 'experience') ?? extractNumber(mp, 'ap') ?? 0 },
        },
        notes: 'Aus PDF importiert. Bitte manuell pruefen.',
      },
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

function extractNumber(payload: Record<string, unknown>, key: string): number | null {
  const v = payload[key];
  if (typeof v === 'number') return v;
  if (typeof v === 'string') {
    const n = parseFloat(v.replace(/[^0-9.-]/g, ''));
    if (!isNaN(n)) return n;
  }
  return null;
}

function extractString(payload: Record<string, unknown>, key: string): string | null {
  const v = payload[key];
  if (typeof v === 'string' && v.trim().length > 0) return v.trim();
  return null;
}

function extractAttributes(payload: Record<string, unknown>): Record<string, unknown> {
  const charKeys = ['mu', 'kl', 'in', 'ch', 'ff', 'ge', 'ko', 'kk'];
  const attrs: Record<string, unknown> = {};
  for (const key of charKeys) {
    const val = extractNumber(payload, key);
    if (val !== null) {
      attrs[key] = { value: val };
    } else {
      // try German full names
      const fullNames: Record<string, string> = {
        mu: 'mut', kl: 'klugheit', in: 'intuition', ch: 'charisma',
        ff: 'fingerfertigkeit', ge: 'gewandtheit', ko: 'konstitution', kk: 'körperkraft',
      };
      const fullVal = extractNumber(payload, fullNames[key] ?? key);
      if (fullVal !== null) {
        attrs[key] = { value: fullVal };
      }
    }
  }
  return { characteristics: attrs };
}

function extractWounds(payload: Record<string, unknown>): { initial: number } {
  const lep = extractNumber(payload, 'lep') ?? extractNumber(payload, 'leps') ?? extractNumber(payload, 'LeP');
  return lep !== null ? { initial: lep } : { initial: 0 };
}

function extractAsP(payload: Record<string, unknown>): number {
  return extractNumber(payload, 'asp') ?? extractNumber(payload, 'asP') ?? extractNumber(payload, 'astralenergie') ?? 0;
}

function extractKaP(payload: Record<string, unknown>): number {
  return extractNumber(payload, 'kap') ?? extractNumber(payload, 'kaP') ?? extractNumber(payload, 'karmaenergie') ?? 0;
}
