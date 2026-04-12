import { describe, expect, it, vi } from 'vitest';
import { AdventureImportWorker, extractJsonCandidate } from './llm-worker.js';

describe('extractJsonCandidate', () => {
  it('extracts JSON from fenced code blocks', () => {
    const raw = 'Hier ist dein JSON:\n```json\n{"hello": "world"}\n```';
    expect(extractJsonCandidate(raw)).toBe('{"hello": "world"}');
  });
});

describe('AdventureImportWorker', () => {
  it('parses a valid JSON adventure from the model response', async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => ({
        choices: [
          {
            message: {
              content: '```json\n{' +
                '"metadata":{"title":"Deicherbe","type":"adventure","language":"de","system":"DSA5"},' +
                '"chapters":[{"title":"Kapitel 1"}],"npcs":[{"name":"Hilde"}],"warnings":[]}' +
                '\n```',
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

    const result = await worker.extractAdventure({
      title: 'Deicherbe',
      sourceText: 'Kurzer Abenteuertext',
      languageHint: 'de',
    });

    expect(result.payload.metadata.title).toBe('Deicherbe');
    expect(result.payload.chapters).toHaveLength(1);
    expect(result.payload.npcs).toHaveLength(1);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('fails when the model does not return JSON', async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => ({
        choices: [{ message: { content: 'Das ist leider kein JSON.' } }],
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

    await expect(
      worker.extractAdventure({
        title: 'Deicherbe',
        sourceText: 'Kurzer Abenteuertext',
      }),
    ).rejects.toThrow(/valid JSON/i);
  });
});
