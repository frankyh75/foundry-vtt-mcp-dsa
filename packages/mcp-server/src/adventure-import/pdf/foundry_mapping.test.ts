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
});
