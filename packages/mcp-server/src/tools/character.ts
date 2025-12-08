import { z } from 'zod';
import { FoundryClient } from '../foundry-client.js';
import { Logger } from '../logger.js';
import { SystemRegistry } from '../systems/system-registry.js';
import { detectGameSystem, type GameSystem } from '../utils/system-detection.js';

export interface CharacterToolsOptions {
  foundryClient: FoundryClient;
  logger: Logger;
  systemRegistry?: SystemRegistry;
}

export class CharacterTools {
  private foundryClient: FoundryClient;
  private logger: Logger;
  private systemRegistry: SystemRegistry | null;
  private cachedGameSystem: GameSystem | null = null;

  constructor({ foundryClient, logger, systemRegistry }: CharacterToolsOptions) {
    this.foundryClient = foundryClient;
    this.logger = logger.child({ component: 'CharacterTools' });
    this.systemRegistry = systemRegistry || null;
  }

  /**
   * Get or detect the game system (cached)
   */
  private async getGameSystem(): Promise<GameSystem> {
    if (!this.cachedGameSystem) {
      this.cachedGameSystem = await detectGameSystem(this.foundryClient, this.logger);
    }
    return this.cachedGameSystem;
  }

  /**
   * Tool: get-character
   * Retrieve detailed information about a specific character
   */
  getToolDefinitions() {
    return [
      {
        name: 'get-character',
        description: 'Retrieve detailed information about a specific character by name or ID',
        inputSchema: {
          type: 'object',
          properties: {
            identifier: {
              type: 'string',
              description: 'Character name or ID to look up',
            },
          },
          required: ['identifier'],
        },
      },
      {
        name: 'get-character-entity',
        description: 'Retrieve full details for a specific entity from a character. Works for items (feats, equipment, spells), actions (strikes, special abilities), or effects/conditions. Returns complete description and all system data. Use this after get-character when you need detailed information about a specific entity.',
        inputSchema: {
          type: 'object',
          properties: {
            characterIdentifier: {
              type: 'string',
              description: 'Character name or ID',
            },
            entityIdentifier: {
              type: 'string',
              description: 'Entity name or ID (can be item ID, action name, spell name, or effect name)',
            },
          },
          required: ['characterIdentifier', 'entityIdentifier'],
        },
      },
      {
        name: 'list-characters',
        description: 'List all available characters with basic information',
        inputSchema: {
          type: 'object',
          properties: {
            type: {
              type: 'string',
              description: 'Optional filter by character type (e.g., "character", "npc")',
            },
          },
        },
      },
    ];
  }

  async handleGetCharacter(args: any): Promise<any> {
    const schema = z.object({
      identifier: z.string().min(1, 'Character identifier cannot be empty'),
    });

    const { identifier } = schema.parse(args);

    this.logger.info('Getting character information', { identifier });

    try {
      const characterData = await this.foundryClient.query('foundry-mcp-bridge.getCharacterInfo', {
        characterName: identifier,
      });

      this.logger.debug('Successfully retrieved character data', {
        characterId: characterData.id,
        characterName: characterData.name
      });

      // Format the response for Claude
      return await this.formatCharacterResponse(characterData);

    } catch (error) {
      this.logger.error('Failed to get character information', error);
      throw new Error(`Failed to retrieve character "${identifier}": ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async handleGetCharacterEntity(args: any): Promise<any> {
    const schema = z.object({
      characterIdentifier: z.string().min(1, 'Character identifier cannot be empty'),
      entityIdentifier: z.string().min(1, 'Entity identifier cannot be empty'),
    });

    const { characterIdentifier, entityIdentifier } = schema.parse(args);

    this.logger.info('Getting character entity', { characterIdentifier, entityIdentifier });

    try {
      // First get the character
      const characterData = await this.foundryClient.query('foundry-mcp-bridge.getCharacterInfo', {
        characterName: characterIdentifier,
      });

      // Try to find the entity in different collections
      let entity = null;
      let entityType = null;

      // 1. Try to find as an item (by ID or name)
      entity = characterData.items?.find((i: any) =>
        i.id === entityIdentifier || i.name.toLowerCase() === entityIdentifier.toLowerCase()
      );
      if (entity) {
        entityType = 'item';
      }

      // 2. Try to find as an action (by name)
      if (!entity && characterData.actions) {
        entity = characterData.actions.find((a: any) =>
          a.name.toLowerCase() === entityIdentifier.toLowerCase()
        );
        if (entity) {
          entityType = 'action';
        }
      }

      // 3. Try to find as an effect (by name)
      if (!entity && characterData.effects) {
        entity = characterData.effects.find((e: any) =>
          e.name.toLowerCase() === entityIdentifier.toLowerCase()
        );
        if (entity) {
          entityType = 'effect';
        }
      }

      if (!entity) {
        throw new Error(`Entity "${entityIdentifier}" not found on character "${characterIdentifier}". Tried items, actions, and effects.`);
      }

      this.logger.debug('Successfully retrieved entity', {
        entityType,
        entityName: entity.name
      });

      // Return full entity details based on type
      if (entityType === 'item') {
        return {
          entityType: 'item',
          id: entity.id,
          name: entity.name,
          type: entity.type,
          description: entity.system?.description?.value || entity.system?.description || '',
          traits: entity.system?.traits?.value || [],
          rarity: entity.system?.traits?.rarity || 'common',
          level: entity.system?.level?.value ?? entity.system?.level,
          actionType: entity.system?.actionType?.value,
          actions: entity.system?.actions?.value,
          quantity: entity.system?.quantity || 1,
          equipped: entity.system?.equipped,
          attunement: entity.system?.attunement,
          hasImage: !!entity.img,
          // Include full system data for advanced use cases
          system: entity.system,
        };
      } else if (entityType === 'action') {
        return {
          entityType: 'action',
          name: entity.name,
          type: entity.type,
          itemId: entity.itemId,
          traits: entity.traits || [],
          variants: entity.variants || [],
          ready: entity.ready,
          description: entity.description || 'Action from character strikes/abilities',
        };
      } else if (entityType === 'effect') {
        return {
          entityType: 'effect',
          id: entity.id,
          name: entity.name,
          description: entity.description || entity.name,
          traits: entity.traits || [],
          duration: entity.duration,
          // Include full effect data
          ...entity,
        };
      }

      return entity;

    } catch (error) {
      this.logger.error('Failed to get character entity', error);
      throw new Error(`Failed to retrieve entity "${entityIdentifier}" from character "${characterIdentifier}": ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async handleListCharacters(args: any): Promise<any> {
    const schema = z.object({
      type: z.string().optional(),
    });

    const { type } = schema.parse(args);

    this.logger.info('Listing characters', { type });

    try {
      const actors = await this.foundryClient.query('foundry-mcp-bridge.listActors', { type });

      this.logger.debug('Successfully retrieved character list', { count: actors.length });

      // Format the response for Claude
      return {
        characters: actors.map((actor: any) => ({
          id: actor.id,
          name: actor.name,
          type: actor.type,
          hasImage: !!actor.img,
        })),
        total: actors.length,
        filtered: type ? `Filtered by type: ${type}` : 'All characters',
      };

    } catch (error) {
      this.logger.error('Failed to list characters', error);
      throw new Error(`Failed to list characters: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async formatCharacterResponse(characterData: any): Promise<any> {
    const response = {
      id: characterData.id,
      name: characterData.name,
      type: characterData.type,
      basicInfo: this.extractBasicInfo(characterData),
      stats: await this.extractStats(characterData),
      items: this.formatItems(characterData.items || []),
      effects: this.formatEffects(characterData.effects || []),
      hasImage: !!characterData.img,
    };

    return response;
  }

  private extractBasicInfo(characterData: any): any {
    const system = characterData.system || {};
    
    // Extract common fields that exist across different game systems
    const basicInfo: any = {};

    // D&D 5e / PF2e common fields
    if (system.attributes) {
      if (system.attributes.hp) {
        basicInfo.hitPoints = {
          current: system.attributes.hp.value,
          max: system.attributes.hp.max,
          temp: system.attributes.hp.temp || 0,
        };
      }
      if (system.attributes.ac) {
        basicInfo.armorClass = system.attributes.ac.value;
      }
    }

    // Level information
    if (system.details?.level?.value) {
      basicInfo.level = system.details.level.value;
    } else if (system.level) {
      basicInfo.level = system.level;
    }

    // Class information
    if (system.details?.class) {
      basicInfo.class = system.details.class;
    }

    // Race/ancestry information
    if (system.details?.race) {
      basicInfo.race = system.details.race;
    } else if (system.details?.ancestry) {
      basicInfo.ancestry = system.details.ancestry;
    }

    return basicInfo;
  }

  private async extractStats(characterData: any): Promise<any> {
    // Try using system adapter if available
    if (this.systemRegistry) {
      try {
        const gameSystem = await this.getGameSystem();
        const adapter = this.systemRegistry.getAdapter(gameSystem);

        if (adapter) {
          this.logger.debug('Using system adapter for character stats extraction', { system: gameSystem });
          return adapter.extractCharacterStats(characterData);
        }
      } catch (error) {
        this.logger.warn('Failed to use system adapter, falling back to legacy extraction', { error });
      }
    }

    // Legacy extraction (backwards compatibility)
    const system = characterData.system || {};
    const stats: any = {};

    // Ability scores (D&D 5e style)
    if (system.abilities) {
      stats.abilities = {};
      for (const [key, ability] of Object.entries(system.abilities)) {
        if (typeof ability === 'object' && ability !== null) {
          stats.abilities[key] = {
            score: (ability as any).value || 10,
            modifier: (ability as any).mod || 0,
          };
        }
      }
    }

    // Skills
    if (system.skills) {
      stats.skills = {};
      for (const [key, skill] of Object.entries(system.skills)) {
        if (typeof skill === 'object' && skill !== null) {
          stats.skills[key] = {
            value: (skill as any).value || 0,
            proficient: (skill as any).proficient || false,
            ability: (skill as any).ability || '',
          };
        }
      }
    }

    // Saves
    if (system.saves) {
      stats.saves = {};
      for (const [key, save] of Object.entries(system.saves)) {
        if (typeof save === 'object' && save !== null) {
          stats.saves[key] = {
            value: (save as any).value || 0,
            proficient: (save as any).proficient || false,
          };
        }
      }
    }

    return stats;
  }

  private formatItems(items: any[]): any[] {
    return items.slice(0, 20).map(item => ({ // Limit to 20 items to avoid overwhelming responses
      id: item.id,
      name: item.name,
      type: item.type,
      quantity: item.system?.quantity || 1,
      description: this.truncateText(item.system?.description?.value || '', 200),
      hasImage: !!item.img,
    }));
  }

  private formatEffects(effects: any[]): any[] {
    return effects.map(effect => ({
      id: effect.id,
      name: effect.name,
      disabled: effect.disabled,
      duration: effect.duration ? {
        type: effect.duration.type,
        remaining: effect.duration.remaining,
      } : null,
      hasIcon: !!effect.icon,
    }));
  }

  private truncateText(text: string, maxLength: number): string {
    if (!text || text.length <= maxLength) {
      return text;
    }
    return text.substring(0, maxLength - 3) + '...';
  }
}