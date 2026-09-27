import { afterEach, describe, expect, it, vi } from 'vitest';
import { FoundryDataAccess } from './data-access.js';

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

function createActor(id: string, name: string, type: string) {
  const actor: any = {
    id,
    name,
    type,
    items: [] as any[],
    effects: [] as any[],
    update: vi.fn(async (update: Record<string, unknown>) => Object.assign(actor, update)),
    updateEmbeddedDocuments: vi.fn(async (documentType: string, updates: any[]) => {
      const collection = documentType === 'Item' ? actor.items : actor.effects;
      for (const update of updates) {
        const document = collection.find((candidate: any) => candidate.id === update._id);
        Object.assign(document, update);
      }
    }),
    createEmbeddedDocuments: vi.fn(async (documentType: string, documents: any[]) => {
      const collection = documentType === 'Item' ? actor.items : actor.effects;
      const created = documents.map((document, index) => {
        const item = {
          ...clone(document),
          id: `${documentType.toLowerCase()}-${collection.length + index + 1}`,
        };
        collection.push(item);
        return item;
      });
      return created;
    }),
  };
  return actor;
}

function setupFoundry() {
  const actors: any[] = [];
  Object.assign(actors, {
    get: (identifier: string) => actors.find(actor => actor.id === identifier),
    getName: (identifier: string) => actors.find(actor => actor.name === identifier),
  });
  const create = vi.fn(async (data: any) => {
    const actor = createActor(`actor-${actors.length + 1}`, data.name, data.type);
    Object.assign(actor, data);
    actors.push(actor);
    return actor;
  });

  vi.stubGlobal('Hooks', { on: vi.fn() });
  vi.stubGlobal('Actor', { create });
  vi.stubGlobal('foundry', { utils: { deepClone: clone } });
  vi.stubGlobal('game', {
    ready: true,
    world: { id: 'world-1' },
    user: { id: 'user-1', name: 'GM' },
    settings: { get: vi.fn(() => true) },
    actors,
    scenes: Object.assign([], { active: undefined }),
  });

  return { actors, create, dataAccess: new FoundryDataAccess() };
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('FoundryDataAccess.createActorFromData updateExisting', () => {
  it('updates an actor on a second import without duplicating it and preserves identity items', async () => {
    const { actors, create, dataAccess } = setupFoundry();
    const firstImport = {
      name: 'Nayeli',
      type: 'character',
      folder: 'imported',
      system: { value: 1 },
      items: [
        { name: 'Human', type: 'species', system: { source: 'first' } },
        { name: 'Athletics', type: 'skill', system: { value: 1 } },
      ],
    };

    const firstResult = await dataAccess.createActorFromData({
      actorData: firstImport,
      updateExisting: true,
      existingActorIdentifier: 'Nayeli',
      preserveItemTypes: ['species', 'culture', 'career'],
    });
    const secondResult = await dataAccess.createActorFromData({
      actorData: {
        ...firstImport,
        system: { value: 2 },
        items: [
          { name: 'Elf', type: 'species', system: { source: 'second' } },
          { name: 'Athletics', type: 'skill', system: { value: 5 } },
          { name: 'Stealth', type: 'skill', system: { value: 3 } },
        ],
      },
      updateExisting: true,
      existingActorIdentifier: 'Nayeli',
      preserveItemTypes: ['species', 'culture', 'career'],
    });

    expect(firstResult.updatedExisting).toBe(false);
    expect(secondResult.updatedExisting).toBe(true);
    expect(actors).toHaveLength(1);
    expect(create).toHaveBeenCalledOnce();
    expect(actors[0].system).toEqual({ value: 2 });
    expect(actors[0].items).toEqual([
      expect.objectContaining({ name: 'Human', type: 'species', system: { source: 'first' } }),
      expect.objectContaining({ name: 'Athletics', type: 'skill', system: { value: 5 } }),
      expect.objectContaining({ name: 'Stealth', type: 'skill', system: { value: 3 } }),
    ]);
  });

  it('continues to create a new actor when updateExisting is disabled', async () => {
    const { actors, dataAccess } = setupFoundry();
    const actorData = {
      name: 'Nayeli',
      type: 'character',
      folder: 'imported',
      system: {},
    };

    await dataAccess.createActorFromData({ actorData, updateExisting: false });
    const secondResult = await dataAccess.createActorFromData({ actorData, updateExisting: false });

    expect(secondResult.updatedExisting).toBe(false);
    expect(actors).toHaveLength(2);
  });

  it('updates matching effects on a second import without duplicating them', async () => {
    const { actors, dataAccess } = setupFoundry();
    const firstImport = {
      name: 'Nayeli',
      type: 'character',
      effects: [{ name: 'Blessed', type: 'bonus', changes: [{ key: 'system.value', value: '1' }] }],
    };

    await dataAccess.createActorFromData({
      actorData: firstImport,
      updateExisting: true,
      existingActorIdentifier: 'Nayeli',
    });
    const secondResult = await dataAccess.createActorFromData({
      actorData: {
        ...firstImport,
        effects: [{ name: 'Blessed', type: 'bonus', changes: [{ key: 'system.value', value: '2' }] }],
      },
      updateExisting: true,
      existingActorIdentifier: 'Nayeli',
    });

    expect(secondResult.updatedExisting).toBe(true);
    expect(actors).toHaveLength(1);
    expect(actors[0].effects).toHaveLength(1);
    expect(actors[0].effects[0]).toEqual(
      expect.objectContaining({
        name: 'Blessed',
        type: 'bonus',
        changes: [{ key: 'system.value', value: '2' }],
      })
    );
  });
});
