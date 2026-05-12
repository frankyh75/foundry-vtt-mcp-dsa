import { describe, expect, it } from 'vitest';
import { buildFoundryImportPlan } from './foundry_mapping.js';
import { buildMinimalPdfIr } from './test-helpers.js';

describe('foundry_mapping', () => {
  it('maps stubs to conservative dry-run import plans', () => {
    const ir = buildMinimalPdfIr({
      entityStubs: [
        {
          id: 'stub:npc_stub:test',
          stubType: 'npc_stub',
          label: 'Elidan',
          sourceBlockIds: ['block:1:test'],
          minimumPayload: {
            name: 'Elidan',
            summary: 'Waldbauer und Deichbauer',
          },
          createdFrom: 'heuristic',
          readyForImport: true,
          confidence: 0.72,
          source: 'text_layer',
          provenance: {
            producer: 'test',
            rule: 'fixture.v1',
          },
        },
        {
          id: 'stub:location_stub:test',
          stubType: 'location_stub',
          label: 'Deichhof',
          sourceBlockIds: ['block:2:test'],
          minimumPayload: {
            name: 'Deichhof',
            summary: 'Ein Hof am Deich',
          },
          createdFrom: 'heuristic',
          readyForImport: true,
          confidence: 0.61,
          source: 'text_layer',
          provenance: {
            producer: 'test',
            rule: 'fixture.v1',
          },
        },
        {
          id: 'stub:scene_stub:test',
          stubType: 'scene_stub',
          label: 'Ankunft am Deich',
          sourceBlockIds: ['block:3:test'],
          minimumPayload: {
            title: 'Ankunft am Deich',
            summary: 'Szene mit Ankunft und Begruessung',
          },
          createdFrom: 'heuristic',
          readyForImport: false,
          confidence: 0.44,
          source: 'text_layer',
          provenance: {
            producer: 'test',
            rule: 'fixture.v1',
          },
        },
      ],
    });

    const plans = buildFoundryImportPlan(ir);
    expect(plans).toHaveLength(3);
    expect(plans[0].targetType === 'foundry_actor' || plans[1].targetType === 'foundry_actor' || plans[2].targetType === 'foundry_actor').toBe(true);
    expect(plans.some((plan) => plan.targetType === 'foundry_journal')).toBe(true);
    expect(plans.some((plan) => plan.targetType === 'foundry_scene')).toBe(true);
    expect(plans.every((plan) => plan.operation === 'create')).toBe(true);
    expect(plans.every((plan) => plan.requiresReview)).toBe(true);
  });

  it('maps NPC stub with DSA5 statblock to valid Actor payload', () => {
    const ir = buildMinimalPdfIr({
      entityStubs: [
        {
          id: 'stub:npc_stub:deichbauern',
          stubType: 'npc_stub',
          label: 'Deichbauern',
          sourceBlockIds: ['block:1:test'],
          minimumPayload: {
            name: 'Deichbauern',
            summary: 'Bewohner des Deichhofs',
            attributes: { mu: 12, kl: 11, in: 12, ch: 11, ff: 14, ge: 13, ko: 13, kk: 13 },
            lep: 31,
            asp: null,
            kap: null,
            ini: '13+1W6',
            sk: 1,
            zk: 2,
            aw: 7,
            gs: 8,
            weapons: [
              { name: 'Deichgabel', at: 10, pa: 4, tp: '1W6+2', rw: 'mittel' },
            ],
            sonderfertigkeiten: ['Belastungsgewöhnung I', 'Wuchtschlag I'],
          },
          createdFrom: 'heuristic',
          readyForImport: true,
          confidence: 0.95,
          source: 'text_layer',
          provenance: { producer: 'test', rule: 'statblock.v1' },
        },
      ],
    });

    const plans = buildFoundryImportPlan(ir);
    expect(plans).toHaveLength(1);
    const plan = plans[0];
    expect(plan.targetType).toBe('foundry_actor');
    expect(plan.targetSubtype).toBe('npc');

    const payload = plan.payload as Record<string, unknown>;
    expect(payload.name).toBe('Deichbauern');

    const system = payload.system as Record<string, unknown>;

    // Attribute
    const characteristics = (system.characteristics ?? {}) as Record<string, unknown>;
    expect(characteristics.mu).toEqual({ value: 12 });
    expect(characteristics.kl).toEqual({ value: 11 });
    expect(characteristics.ff).toEqual({ value: 14 });
    expect(characteristics.kk).toEqual({ value: 13 });

    // Status
    const status = (system.status ?? {}) as Record<string, unknown>;
    expect(status.wounds).toEqual({ initial: 31 });
    expect(status.astralenergy).toEqual({ value: 0 });
    expect(status.karmaenergy).toEqual({ value: 0 });
    expect(status.ini).toEqual({ value: '13+1W6' });
    expect(status.sk).toEqual({ value: 1 });
    expect(status.zk).toEqual({ value: 2 });
    expect(status.aw).toEqual({ value: 7 });
    expect(status.gs).toEqual({ value: 8 });

    // Kampf
    const combat = (system.combat ?? {}) as Record<string, unknown>;
    expect(combat.weapons).toBeDefined();
    expect(Array.isArray(combat.weapons)).toBe(true);
    const weapons = combat.weapons as Array<Record<string, unknown>>;
    expect(weapons).toHaveLength(1);
    expect(weapons[0].name).toBe('Deichgabel');
    expect(weapons[0].at).toBe(10);
    expect(weapons[0].pa).toBe(4);
    expect(weapons[0].tp).toBe('1W6+2');
    expect(weapons[0].rw).toBe('mittel');

    // Details
    const details = (system.details ?? {}) as Record<string, unknown>;
    expect(details.sonderfertigkeiten).toEqual(['Belastungsgewöhnung I', 'Wuchtschlag I']);
  });
});
