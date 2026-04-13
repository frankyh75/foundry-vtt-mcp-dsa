import { describe, expect, it, vi } from 'vitest';
import { QuestCreationTools } from './quest-creation.js';

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

describe('QuestCreationTools', () => {
  it('creates a journal entry with name and content', async () => {
    const foundryClient = createFoundryClientMock();
    foundryClient.query.mockResolvedValue({
      id: 'journal-1',
      name: 'Kapitel 1',
      pageCount: 1,
    });

    const tools = new QuestCreationTools({ foundryClient, logger });
    const result = await tools.handleCreateJournalEntry({
      name: 'Kapitel 1',
      content: '<p>Inhalt</p>',
    });

    expect(foundryClient.query).toHaveBeenCalledWith(
      'foundry-mcp-bridge.createJournalEntry',
      {
        name: 'Kapitel 1',
        content: '<p>Inhalt</p>',
      }
    );
    expect(result).toEqual({
      success: true,
      id: 'journal-1',
      name: 'Kapitel 1',
      pageCount: 1,
    });
  });

  it('returns a validation error when content is missing', async () => {
    const foundryClient = createFoundryClientMock();
    const tools = new QuestCreationTools({ foundryClient, logger });

    await expect(
      tools.handleCreateJournalEntry({
        name: 'Kapitel 1',
      })
    ).rejects.toThrow();

    expect(foundryClient.query).not.toHaveBeenCalled();
  });
});
