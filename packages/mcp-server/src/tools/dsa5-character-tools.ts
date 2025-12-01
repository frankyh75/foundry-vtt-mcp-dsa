/**
 * DSA5 Character Tools - MCP Tool Wrapper
 *
 * Provides MCP tools for DSA5 character manipulation using the adapter layer.
 * Follows the same pattern as other tool classes (CharacterTools, CompendiumTools, etc.)
 */

import { z } from 'zod';
import { FoundryClient } from '../foundry-client.js';
import { Logger } from '../logger.js';
import {
  fromDsa5Actor,
  getDsa5CharacterSummary,
  applyMcpUpdateToDsa5Actor,
  type Dsa5Actor,
  type MCPCharacterUpdate,
} from './dsa5/index.js';

export interface DSA5CharacterToolsOptions {
  foundryClient: FoundryClient;
  logger: Logger;
}

/**
 * DSA5 Character Tools
 *
 * Provides MCP tools for DSA5-specific character operations:
 * - get-dsa5-character-summary: Get formatted character summary
 * - update-dsa5-character: Apply stat changes to character
 */
export class DSA5CharacterTools {
  private foundryClient: FoundryClient;
  private logger: Logger;

  constructor({ foundryClient, logger }: DSA5CharacterToolsOptions) {
    this.foundryClient = foundryClient;
    this.logger = logger.child({ component: 'DSA5CharacterTools' });
  }

  /**
   * Get MCP tool definitions for DSA5 character tools
   */
  getToolDefinitions() {
    return [
      {
        name: 'get-dsa5-character-summary',
        description: 'Get a detailed formatted summary of a DSA5 character including Eigenschaften, LeP, AsP, KaP, and top talents. Returns German-language summary with all 8 attributes (MU/KL/IN/CH/FF/GE/KO/KK).',
        inputSchema: {
          type: 'object',
          properties: {
            characterName: {
              type: 'string',
              description: 'Name of the DSA5 character to summarize',
            },
          },
          required: ['characterName'],
        },
      },
      {
        name: 'update-dsa5-character',
        description: 'Update DSA5 character stats including Eigenschaften, LeP (life points), AsP (astral energy), KaP (karma energy), and talents. Supports both absolute values and delta changes (e.g., +5 HP, -10 AsP).',
        inputSchema: {
          type: 'object',
          properties: {
            characterName: {
              type: 'string',
              description: 'Name of the DSA5 character to update',
            },
            attributes: {
              type: 'object',
              description: 'Eigenschaften to update (MU/KL/IN/CH/FF/GE/KO/KK)',
              additionalProperties: { type: 'number' },
            },
            health: {
              type: 'object',
              description: 'Health/LeP changes',
              properties: {
                current: { type: 'number', description: 'Absolute HP value' },
                max: { type: 'number', description: 'Maximum HP' },
                delta: { type: 'number', description: 'HP change (+5 for healing, -3 for damage)' },
              },
            },
            resources: {
              type: 'array',
              description: 'Resource changes (AsP, KaP)',
              items: {
                type: 'object',
                properties: {
                  name: { type: 'string', description: 'Resource name (Astralenergie, Karmaenergie, asp, kap)' },
                  current: { type: 'number', description: 'Absolute value' },
                  delta: { type: 'number', description: 'Delta change (+10, -5)' },
                },
                required: ['name'],
              },
            },
            skills: {
              type: 'array',
              description: 'Skill/talent changes',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string', description: 'Skill ID' },
                  value: { type: 'number', description: 'Absolute skill value' },
                  delta: { type: 'number', description: 'Delta change (+1, -2)' },
                },
                required: ['id'],
              },
            },
          },
          required: ['characterName'],
        },
      },
    ];
  }

  /**
   * Handle: get-dsa5-character-summary
   */
  async handleGetDSA5CharacterSummary(args: any): Promise<any> {
    const schema = z.object({
      characterName: z.string().min(1, 'Character name cannot be empty'),
    });

    const { characterName } = schema.parse(args);

    this.logger.info('Getting DSA5 character summary', { characterName });

    try {
      // Get actor from Foundry
      const actor = await this.foundryClient.query('foundry-mcp-bridge.getCharacterInfo', {
        characterName,
      });

      if (!actor || !actor.system) {
        throw new Error(`Character "${characterName}" not found or invalid DSA5 actor`);
      }

      // Generate summary using DSA5 adapter
      const summary = getDsa5CharacterSummary(actor as Dsa5Actor);

      this.logger.debug('Successfully generated DSA5 character summary', {
        characterName,
        summaryLength: summary.length,
      });

      return {
        content: [
          {
            type: 'text',
            text: summary,
          },
        ],
      };
    } catch (error) {
      this.logger.error('Failed to get DSA5 character summary', { error, characterName });
      return {
        content: [
          {
            type: 'text',
            text: `Error getting DSA5 character summary for "${characterName}": ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
        isError: true,
      };
    }
  }

  /**
   * Handle: update-dsa5-character
   */
  async handleUpdateDSA5Character(args: any): Promise<any> {
    const schema = z.object({
      characterName: z.string().min(1, 'Character name cannot be empty'),
      attributes: z.record(z.number()).optional(),
      health: z
        .object({
          current: z.number().optional(),
          max: z.number().optional(),
          delta: z.number().optional(),
        })
        .optional(),
      resources: z
        .array(
          z.object({
            name: z.string(),
            current: z.number().optional(),
            delta: z.number().optional(),
          })
        )
        .optional(),
      skills: z
        .array(
          z.object({
            id: z.string(),
            value: z.number().optional(),
            delta: z.number().optional(),
          })
        )
        .optional(),
    });

    const parsed = schema.parse(args);
    const { characterName, ...updateFields } = parsed;

    this.logger.info('Updating DSA5 character', { characterName, updateFields });

    try {
      // Get current actor from Foundry
      const actor = await this.foundryClient.query('foundry-mcp-bridge.getCharacterInfo', {
        characterName,
      });

      if (!actor || !actor.system) {
        throw new Error(`Character "${characterName}" not found or invalid DSA5 actor`);
      }

      // Build MCP update object (only include defined properties)
      const update: MCPCharacterUpdate = {
        id: actor.id || actor._id,
      };

      if (updateFields.attributes) update.attributes = updateFields.attributes;

      if (updateFields.health) {
        const health: { current?: number; max?: number; delta?: number } = {};
        if (updateFields.health.current !== undefined) health.current = updateFields.health.current;
        if (updateFields.health.max !== undefined) health.max = updateFields.health.max;
        if (updateFields.health.delta !== undefined) health.delta = updateFields.health.delta;
        if (Object.keys(health).length > 0) update.health = health;
      }

      if (updateFields.resources) {
        update.resources = updateFields.resources.map(r => {
          const resource: { name: string; current?: number; delta?: number } = { name: r.name };
          if (r.current !== undefined) resource.current = r.current;
          if (r.delta !== undefined) resource.delta = r.delta;
          return resource;
        });
      }

      if (updateFields.skills) {
        update.skills = updateFields.skills.map(s => {
          const skill: { id: string; value?: number; delta?: number } = { id: s.id };
          if (s.value !== undefined) skill.value = s.value;
          if (s.delta !== undefined) skill.delta = s.delta;
          return skill;
        });
      }

      // Apply update using DSA5 adapter
      const result = applyMcpUpdateToDsa5Actor(actor as Dsa5Actor, update);

      if (!result.success) {
        throw new Error(`Update failed: ${result.errors?.join(', ')}`);
      }

      // Send updated actor back to Foundry
      await this.foundryClient.query('foundry-mcp-bridge.updateActor', {
        actorId: actor.id || actor._id,
        updateData: {
          system: actor.system,
          items: actor.items,
        },
      });

      this.logger.info('Successfully updated DSA5 character', {
        characterName,
        updatedFields: result.updatedFields,
      });

      return {
        content: [
          {
            type: 'text',
            text: `✅ Successfully updated ${characterName}!\n\nUpdated fields:\n${result.updatedFields?.map((f) => `- ${f}`).join('\n') || 'None'}${result.errors ? `\n\n⚠️ Warnings:\n${result.errors.map((e) => `- ${e}`).join('\n')}` : ''}`,
          },
        ],
      };
    } catch (error) {
      this.logger.error('Failed to update DSA5 character', { error, characterName });
      return {
        content: [
          {
            type: 'text',
            text: `Error updating DSA5 character "${characterName}": ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
        isError: true,
      };
    }
  }
}
