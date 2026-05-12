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
          ini: extractIni(mp),
          ...extractCombatStats(mp),
        },
        combat: {
          weapons: extractWeapons(mp),
        },
        details: {
          species: extractString(mp, 'species') ?? '',
          culture: extractString(mp, 'culture') ?? '',
          experience: { total: extractNumber(mp, 'experience') ?? extractNumber(mp, 'ap') ?? 0 },
          sonderfertigkeiten: extractSonderfertigkeiten(mp),
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
  // Bei Statblock-Extraktion sind Attribute in payload.attributes verschachtelt
  const nestedAttributes = payload.attributes as Record<string, unknown> | undefined;

  for (const key of charKeys) {
    let val: number | null = null;
    // 1. Versuch: flaches payload (legacy)
    val = extractNumber(payload, key);
    // 2. Versuch: verschachtelte payload.attributes (neu)
    if (val === null && nestedAttributes) {
      val = extractNumber(nestedAttributes, key);
    }
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

/** Extrahiert INI-Wert als String (z.B. "13+1W6") */
function extractIni(payload: Record<string, unknown>): { value: string } | undefined {
  if (typeof payload.ini === 'string' && payload.ini.trim().length > 0) {
    return { value: payload.ini.trim() };
  }
  return undefined;
}

/** Extrahiert Kampfwerte (SK, ZK, AW, GS) */
function extractCombatStats(payload: Record<string, unknown>): Record<string, unknown> {
  const stats: Record<string, unknown> = {};
  const sk = extractNumber(payload, 'sk');
  if (sk !== null) stats.sk = { value: sk };
  const zk = extractNumber(payload, 'zk');
  if (zk !== null) stats.zk = { value: zk };
  const aw = extractNumber(payload, 'aw');
  if (aw !== null) stats.aw = { value: aw };
  const gs = extractNumber(payload, 'gs');
  if (gs !== null) stats.gs = { value: gs };
  return stats;
}

/** Extrahiert Waffen-Array aus dem Payload */
function extractWeapons(payload: Record<string, unknown>): Array<Record<string, unknown>> {
  if (!Array.isArray(payload.weapons)) return [];
  return payload.weapons.map((w: unknown) => {
    if (typeof w !== 'object' || w === null) return null;
    const weapon = w as Record<string, unknown>;
    return {
      name: extractString(weapon, 'name') ?? 'Unbekannte Waffe',
      at: extractNumber(weapon, 'at') ?? 0,
      pa: extractNumber(weapon, 'pa') ?? null,
      tp: extractString(weapon, 'tp') ?? '',
      rw: extractString(weapon, 'rw') ?? 'mittel',
    };
  }).filter(Boolean) as Array<Record<string, unknown>>;
}

/** Extrahiert Sonderfertigkeiten-Array */
function extractSonderfertigkeiten(payload: Record<string, unknown>): string[] {
  if (!Array.isArray(payload.sonderfertigkeiten)) return [];
  return payload.sonderfertigkeiten
    .filter((sf): sf is string => typeof sf === 'string' && sf.trim().length > 0)
    .map((sf) => sf.trim());
}
