import { describe, expect, it, vi } from 'vitest';
import { AdventureImportTools } from './adventure-import.js';
import { AdventureImportWorker } from '../adventure-import/llm-worker.js';
import { FoundryAdventureImporter } from '../adventure-import/foundry-importer.js';

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

describe('AdventureImportTools', () => {
  it('runs a dry-run end-to-end from text to preview', async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => ({
        choices: [
          {
            message: {
              content: '{"metadata":{"title":"Deicherbe","type":"adventure","language":"de","system":"DSA5"},"chapters":[{"title":"Kapitel 1"}],"npcs":[{"name":"Hilde"}],"warnings":[]}',
            },
          },
        ],
      }),
      text: async () => '',
    })) as unknown as typeof fetch;

    const worker = new AdventureImportWorker({
      baseUrl: 'http://localhost:1234',
      apiKey: 'test',
      model: 'gemma-test',
      fetchImpl,
      maxRetries: 0,
    });
    const foundryClient = createFoundryClientMock();
    const importer = new FoundryAdventureImporter(foundryClient, logger);
    const tools = new AdventureImportTools({ foundryClient, logger, worker, importer });

    const result = await tools.handleImportAdventureFromText({
      title: 'Deicherbe',
      sourceText: 'Kurzer Abenteuertext',
      mode: 'dry-run',
      createActors: true,
      createJournals: true,
      linkNpcs: true,
    });

    expect(result.success).toBe(true);
    expect(result.mode).toBe('dry-run');
    expect(result.plan.counts.chapters).toBe(1);
    expect(result.plan.items.some((item: any) => item.kind === 'actor')).toBe(true);
    expect(foundryClient.query).not.toHaveBeenCalled();
  });

  it('runs an import end-to-end from text to Foundry writes', async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => ({
        choices: [
          {
            message: {
              content: '{"metadata":{"title":"Deicherbe","type":"adventure","language":"de","system":"DSA5"},"chapters":[{"title":"Kapitel 1"}],"npcs":[{"name":"Hilde","role":"Wirtin"}],"warnings":[]}',
            },
          },
        ],
      }),
      text: async () => '',
    })) as unknown as typeof fetch;

    const worker = new AdventureImportWorker({
      baseUrl: 'http://localhost:1234',
      apiKey: 'test',
      model: 'gemma-test',
      fetchImpl,
      maxRetries: 0,
    });
    const foundryClient = createFoundryClientMock();
    foundryClient.query
      .mockResolvedValueOnce({ id: 'journal-1', name: 'Deicherbe', pageCount: 1 })
      .mockResolvedValueOnce({ success: true, actor: { id: 'actor-1', name: 'Hilde', type: 'character' } })
      .mockResolvedValueOnce({ success: true });

    const importer = new FoundryAdventureImporter(foundryClient, logger);
    const tools = new AdventureImportTools({ foundryClient, logger, worker, importer });

    const result = await tools.handleImportAdventureFromText({
      title: 'Deicherbe',
      sourceText: 'Kurzer Abenteuertext',
      mode: 'import',
      createActors: true,
      createJournals: true,
      linkNpcs: true,
    });

    expect(result.success).toBe(true);
    expect(result.mode).toBe('import');
    expect(result.createdEntityIds.journals).toEqual(['journal-1']);
    expect(result.createdEntityIds.actors).toEqual(['actor-1']);
    expect(foundryClient.query).toHaveBeenCalledTimes(3);
  });

  it('normalizes and chunks the source text before LLM extraction', async () => {
    const worker = {
      extractAdventure: vi.fn(async ({ sourceText }: { sourceText: string }) => ({
        payload: {
          metadata: { title: 'Deicherbe', type: 'adventure', language: 'de', system: 'DSA5' },
          chapters: [{ title: sourceText.slice(0, 24) }],
          npcs: [],
          warnings: [],
        },
        rawText: sourceText,
      })),
    } as any;

    const foundryClient = createFoundryClientMock();
    const importer = new FoundryAdventureImporter(foundryClient, logger);
    const tools = new AdventureImportTools({ foundryClient, logger, worker, importer });

    const sourceText = [
      'Seite 1',
      'KAPITEL 1',
      '',
      `${'A'.repeat(4200)}`,
      '',
      'Seite 2',
      `${'B'.repeat(4200)}`,
    ].join('\r\n');

    await tools.handleImportAdventureFromText({
      title: 'Deicherbe',
      sourceText,
      mode: 'dry-run',
    });

    expect(worker.extractAdventure).toHaveBeenCalledTimes(3);
    expect(worker.extractAdventure.mock.calls[0][0].sourceText).not.toContain('\r');
    expect(worker.extractAdventure.mock.calls[0][0].sourceText).not.toMatch(/Seite 1/i);
  });
});
