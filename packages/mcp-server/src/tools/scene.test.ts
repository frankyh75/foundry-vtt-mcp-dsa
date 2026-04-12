import { describe, expect, it, vi } from 'vitest';
import { SceneTools } from './scene.js';

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

describe('SceneTools', () => {
  it('creates a scene placeholder with only a name', async () => {
    const foundryClient = createFoundryClientMock();
    foundryClient.query.mockResolvedValue({
      sceneId: 'scene-1',
      name: 'Hafenviertel',
      success: true,
    });

    const tools = new SceneTools({ foundryClient, logger });
    const result = await tools.handleCreateScenePlaceholder({ name: 'Hafenviertel' });

    expect(foundryClient.query).toHaveBeenCalledWith(
      'foundry-mcp-bridge.createScenePlaceholder',
      {
        name: 'Hafenviertel',
        gridSize: 100,
        width: 4000,
        height: 3000,
      }
    );
    expect(result).toEqual({
      sceneId: 'scene-1',
      name: 'Hafenviertel',
      success: true,
    });
  });

  it('returns a validation error when name is missing', async () => {
    const foundryClient = createFoundryClientMock();
    const tools = new SceneTools({ foundryClient, logger });

    await expect(tools.handleCreateScenePlaceholder({})).rejects.toThrow();
    expect(foundryClient.query).not.toHaveBeenCalled();
  });
});
