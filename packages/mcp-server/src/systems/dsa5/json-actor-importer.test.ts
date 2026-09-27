import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  applyResolvedItemOverrides,
  detectDSA5ImportFormat,
  extractPayload,
  MAX_PAYLOAD_FILE_SIZE,
  mapCustomDsa5Payload,
  mapOptolithLikePayload,
  normalizeInputKeys,
  validateImportPayload,
} from './json-actor-importer.js';

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map(directory => rm(directory, { recursive: true }))
  );
});

async function createPayloadFile(extension: string, content: string | Uint8Array): Promise<string> {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'foundry-mcp-payload-'));
  temporaryDirectories.push(directory);
  const filePath = path.join(directory, `payload${extension}`);
  await writeFile(filePath, content);
  return filePath;
}

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
        koerperkraft: 8,
      },
      energien: {
        lebensenergie: 27,
        astralenergie: 22,
        karmaenergie: 0,
        schicksalspunkte: 3,
      },
      vorteile: [{ name: 'Zauberer' }],
      talente: [{ name: 'Sinnesschaerfe' }],
      kampftechniken: [{ name: 'Dolche', talentwert: 9 }],
      zauberUndLiturgien: [{ name: 'Axxeleratus', talentwert: 7 }],
      nahkampfwaffen: [{ name: 'Dolch', anzahl: 2 }],
    });

    expect(result.actorData.name).toBe('Loreley');
    expect((result.actorData.system as any).details.species.value).toBe('Halbelf');
    expect((result.actorData.system as any).characteristics.mu.advances).toBe(2);
    expect((result.actorData.system as any).status.wounds.initial).toBe(5);
    expect((result.actorData.system as any).status.wounds.value).toBe(27);
    expect(result.candidateItemNames).toContain('Halbelf');
    expect(result.candidateItemNames).toContain('Zauberer');
    expect(result.candidateItemNames).toContain('Sinnesschaerfe');
    expect(result.itemOverrides.sinnesschaerfe?.talentValue).toBeUndefined();
    expect(result.itemOverrides.dolche?.talentValue).toBe(9);
    expect(result.itemOverrides.axxeleratus?.talentValue).toBe(7);
    expect(result.itemOverrides.dolch?.quantity).toBe(2);
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
    expect(result.warnings).toEqual([]);
  });

  it('fixes mojibake keys in attribute object', () => {
    const fixed = normalizeInputKeys({ 'kÃ¶rperkraft': 12 });
    expect(fixed['körperkraft']).toBe(12);
    expect('kÃ¶rperkraft' in fixed).toBe(false);
  });

  it('rejects unknown format with helpful message', () => {
    const result = validateImportPayload({ foo: 'bar' });
    expect(result.isValid).toBe(false);
    expect(result.detectedFormat).toBe('unknown');
    expect(result.errors[0]).toContain('Format nicht erkannt');
  });

  it('rejects optolith_like without attr.values', () => {
    const result = validateImportPayload({
      name: 'Test',
      r: 'x',
      c: 'y',
      p: 'z',
      attr: { values: [] },
    });
    expect(result.isValid).toBe(false);
  });

  it('validates correct optolith_like payload', () => {
    const result = validateImportPayload({
      name: 'Test',
      r: 'x',
      c: 'y',
      p: 'z',
      attr: { values: [{ id: 'ATTR_1', value: 12 }] },
    });
    expect(result.isValid).toBe(true);
  });

  it('maps optolith talents and items from belongings', () => {
    const result = mapOptolithLikePayload({
      name: 'Hero',
      attr: { values: [{ id: 'ATTR_1', value: 12 }], lp: 2, ae: 0, kp: 0 },
      talents: { TAL_1: 3, TAL_8: 7 },
      ct: { CT_3: 10 },
      activatable: { ADV_4: [{}] },
      belongings: { items: { item_1: { name: 'Dolch', amount: 2 } } },
      ap: { total: 1000 },
    });

    expect(result.itemOverrides['tal_1']?.talentValue).toBe(3);
    expect(result.itemOverrides['ct_3']?.talentValue).toBe(10);
    expect(result.candidateItemNames).toContain('ADV_4');
    expect(result.itemOverrides['dolch']?.quantity).toBe(2);
  });

  it('applies item overrides to resolved embedded items', () => {
    const items = [
      {
        name: 'Klettern',
        type: 'skill',
        system: {
          talentValue: { value: 0 },
        },
      },
      {
        name: 'Kurzbogen',
        type: 'rangeweapon',
        system: {
          quantity: { value: 1 },
        },
      },
    ] as any[];

    const result = applyResolvedItemOverrides(items, {
      klettern: { sourceName: 'Klettern', talentValue: 2 },
      kurzbogen: { sourceName: 'Kurzbogen', quantity: 3 },
    });

    expect((items[0].system as any).talentValue.value).toBe(2);
    expect((items[1].system as any).quantity.value).toBe(3);
    expect(result.appliedCount).toBe(2);
    expect(result.unappliedSourceNames).toEqual([]);
  });
});

describe('extractPayload file paths', () => {
  it.each(['.txt', '.sh', '.pdf'])('rejects a %s payload file', async extension => {
    const filePath = await createPayloadFile(extension, '{"name":"Ignored"}');

    await expect(extractPayload(undefined, filePath)).rejects.toThrow(
      'Payload file must use a .json or .tdc extension.'
    );
  });

  it('rejects a payload file over the size limit', async () => {
    const filePath = await createPayloadFile('.json', new Uint8Array(MAX_PAYLOAD_FILE_SIZE + 1));

    await expect(extractPayload(undefined, filePath)).rejects.toThrow(
      'Payload file exceeds the 10 MB size limit.'
    );
  });

  it.each(['.json', '.tdc'])('accepts valid %s payload files', async extension => {
    const filePath = await createPayloadFile(extension, '{"name":"Nayeli","type":"character"}');

    await expect(extractPayload(undefined, filePath)).resolves.toEqual({
      name: 'Nayeli',
      type: 'character',
    });
  });

  it('returns a plain error for malformed file and inline JSON', async () => {
    const filePath = await createPayloadFile('.json', '{not valid JSON');

    await expect(extractPayload(undefined, filePath)).rejects.toThrow('Payload is not valid JSON.');
    await expect(extractPayload('{not valid JSON', undefined)).rejects.toThrow(
      'Payload is not valid JSON.'
    );
  });
});
