import { describe, expect, it, vi } from 'vitest';
import { FoundryAdventureImporter } from './foundry-importer.js';

const logger = {
  child: () => logger,
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
} as any;

function createFoundryClientMock() {
  return {
    query: vi.fn(),
  } as any;
}

describe('FoundryAdventureImporter', () => {
  it('builds a useful dry-run plan', async () => {
    const foundryClient = createFoundryClientMock();
    const importer = new FoundryAdventureImporter(foundryClient, logger);

    const payload = {
      metadata: {
        title: 'Deicherbe',
        type: 'adventure',
        language: 'de',
        system: 'DSA5',
      },
      chapters: [{ title: 'Ankunft' }],
      npcs: [{ name: 'Hilde', role: 'Wirtin' }],
      items: [],
      locations: [],
      warnings: ['Quelle ist teilweise unklar'],
    } as any;

    const result = await importer.dryRun(payload, { createActors: true, createJournals: true, linkNpcs: true });
    expect(result.mode).toBe('dry-run');
    expect(result.plan.mode).toBe('dry-run');
    expect(result.plan.counts.chapters).toBe(1);
    expect(result.plan.items.some((item) => item.kind === 'journal')).toBe(true);

    expect(result.plan.items.some((item) => item.kind === 'actor')).toBe(true);
    expect(foundryClient.query).not.toHaveBeenCalled();
  });

  it('imports journals, actors and links them in Foundry', async () => {
    const foundryClient = createFoundryClientMock();
    foundryClient.query
      .mockResolvedValueOnce({ id: 'journal-1', name: 'Deicherbe', pageCount: 2 })
      .mockResolvedValueOnce({ success: true, actor: { id: 'actor-1', name: 'Hilde', type: 'character' } })
      .mockResolvedValueOnce({ success: true });

    const importer = new FoundryAdventureImporter(foundryClient, logger);

    const payload = {
      metadata: {
        title: 'Deicherbe',
        type: 'adventure',
        language: 'de',
        system: 'DSA5',
      },
      chapters: [
        { title: 'Ankunft', summary: 'Die Helden treffen ein.' },
        { title: 'Konflikt', gmNotes: 'Wichtig für den Plot.' },
      ],
      npcs: [{ name: 'Hilde', role: 'Wirtin' }],
      warnings: [],
    } as any;

    const result = await importer.importAdventure(payload, { createActors: true, createJournals: true, linkNpcs: true });

    expect(result.success).toBe(true);
    expect(result.plan.mode).toBe('import');
    expect(result.createdEntityIds.journals).toEqual(['journal-1']);
    expect(result.createdEntityIds.actors).toEqual(['actor-1']);
    expect(foundryClient.query).toHaveBeenNthCalledWith(1, 'foundry-mcp-bridge.createJournalEntry', expect.objectContaining({
      name: 'Deicherbe',
      additionalPages: expect.any(Array),
      content: expect.stringContaining('Ankunft'),
    }));
    expect(foundryClient.query).toHaveBeenNthCalledWith(2, 'foundry-mcp-bridge.createActorFromData', expect.objectContaining({
      actorData: expect.objectContaining({ name: 'Hilde', type: 'character' }),
    }));
    expect(foundryClient.query).toHaveBeenNthCalledWith(3, 'foundry-mcp-bridge.updateJournalContent', expect.objectContaining({
      journalId: 'journal-1',
      content: expect.stringContaining('Ankunft'),
    }));
  });
});
