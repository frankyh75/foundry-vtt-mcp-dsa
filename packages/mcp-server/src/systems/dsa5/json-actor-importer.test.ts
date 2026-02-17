import { describe, expect, it } from 'vitest';
import {
  detectDSA5ImportFormat,
  mapCustomDsa5Payload,
  mapOptolithLikePayload,
} from './json-actor-importer.js';

describe('DSA5 JSON actor importer mapper', () => {
  it('detects custom_dsa5 format', () => {
    const format = detectDSA5ImportFormat({
      name: 'Loreley',
      attribute: { mut: 10 },
      talente: [],
    });

    expect(format).toBe('custom_dsa5');
  });

  it('detects optolith_like format', () => {
    const format = detectDSA5ImportFormat({
      name: 'Opto',
      r: 'species_1',
      c: 'culture_1',
      p: 'profession_1',
      attr: { values: [{ id: 'ATTR_1', value: 14 }] },
    });

    expect(format).toBe('optolith_like');
  });

  it('detects raw_foundry format', () => {
    const format = detectDSA5ImportFormat({
      name: 'Raw Actor',
      type: 'character',
      system: {},
    });

    expect(format).toBe('raw_foundry');
  });

  it('maps custom DSA5 payload into actor core fields', () => {
    const result = mapCustomDsa5Payload({
      name: 'Loreley',
      spezies: 'Halbelf',
      kultur: 'Nostria',
      profession: 'Zauberin',
      sozialstatus: 'II',
      abenteuerpunkteGesammelt: 1200,
      abenteuerpunkteAusgegeben: 1190,
      abenteuerpunkteGesamt: 10,
      attribute: {
        mut: 10,
        klugheit: 15,
        intuition: 15,
        charisma: 15,
        fingerfertigkeit: 16,
        gewandheit: 12,
        konstitution: 11,
        körperkraft: 8,
      },
      energien: {
        lebensenergie: 27,
        astralenergie: 22,
        karmaenergie: 0,
        schicksalspunkte: 3,
      },
      vorteile: [{ name: 'Zauberer' }],
      talente: [{ name: 'Sinnesschärfe' }],
    });

    expect(result.actorData.name).toBe('Loreley');
    expect((result.actorData.system as any).details.species.value).toBe('Halbelf');
    expect((result.actorData.system as any).characteristics.mu.advances).toBe(2);
    expect((result.actorData.system as any).status.wounds.value).toBe(27);
    expect(result.candidateItemNames).toContain('Zauberer');
    expect(result.candidateItemNames).toContain('Sinnesschärfe');
  });

  it('maps optolith-like payload into actor core fields', () => {
    const result = mapOptolithLikePayload({
      name: 'Optolith Hero',
      sex: 'male',
      attr: {
        lp: 2,
        ae: 4,
        kp: 1,
        values: [
          { id: 'ATTR_1', value: 14 },
          { id: 'ATTR_2', value: 13 },
        ],
      },
      pers: {
        age: '25',
        family: 'Unknown',
      },
      ap: {
        total: 1500,
      },
    });

    expect(result.actorData.name).toBe('Optolith Hero');
    expect((result.actorData.system as any).characteristics.mu.advances).toBe(6);
    expect((result.actorData.system as any).status.astralenergy.advances).toBe(4);
    expect((result.actorData.system as any).details.experience.total).toBe(1500);
    expect(result.warnings.length).toBeGreaterThan(0);
  });
});
