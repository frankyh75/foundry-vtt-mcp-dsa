/**
 * Multi-System Character Router
 *
 * Routes character operations to system-specific adapters.
 * Supports DSA5, DnD5e, PF2e, and fallback for other systems.
 *
 * This file contains MINIMAL system-specific logic.
 * All DSA5 logic lives in ./dsa5/ adapter layer.
 */

import type { MCPCharacter, MCPCharacterUpdate, Dsa5Actor } from './dsa5/index.js';
import {
  fromDsa5Actor,
  getDsa5CharacterSummary,
  applyMcpUpdateToDsa5Actor,
} from './dsa5/index.js';

/**
 * Supported game systems
 */
export type GameSystem = 'dsa5' | 'dnd5e' | 'pf2e' | 'other';

/**
 * Detect game system from actor data
 *
 * @param actor - Foundry actor object
 * @returns Detected game system ID
 */
export function detectGameSystem(actor: any): GameSystem {
  // Check if actor has system field
  if (!actor.system) {
    return 'other';
  }

  // DSA5: Has characteristics with 8 Eigenschaften
  if (
    actor.system.characteristics &&
    'mu' in actor.system.characteristics &&
    'kl' in actor.system.characteristics
  ) {
    return 'dsa5';
  }

  // DnD5e: Has abilities (str, dex, con, int, wis, cha)
  if (actor.system.abilities && 'str' in actor.system.abilities) {
    return 'dnd5e';
  }

  // PF2e: Has attributes object
  if (actor.system.attributes) {
    return 'pf2e';
  }

  return 'other';
}

/**
 * Convert actor to MCP character format (system-agnostic)
 *
 * Routes to appropriate system adapter based on detected system.
 *
 * @param actor - Foundry actor object
 * @returns MCP character object or error
 */
export function actorToMcpCharacter(actor: any): { success: boolean; character?: MCPCharacter; errors?: string[] } {
  const system = detectGameSystem(actor);

  switch (system) {
    case 'dsa5':
      return fromDsa5Actor(actor as Dsa5Actor);

    case 'dnd5e':
      // TODO: Implement DnD5e adapter
      return {
        success: false,
        errors: ['DnD5e adapter not yet implemented'],
      };

    case 'pf2e':
      // TODO: Implement PF2e adapter
      return {
        success: false,
        errors: ['PF2e adapter not yet implemented'],
      };

    default:
      return {
        success: false,
        errors: [`Unsupported game system: ${system}`],
      };
  }
}

/**
 * Get human-readable character summary
 *
 * Routes to appropriate system adapter.
 *
 * @param actor - Foundry actor object
 * @returns Formatted character summary string
 */
export function getCharacterSummary(actor: any): string {
  const system = detectGameSystem(actor);

  switch (system) {
    case 'dsa5':
      return getDsa5CharacterSummary(actor as Dsa5Actor);

    case 'dnd5e':
      return 'DnD5e character summaries not yet implemented';

    case 'pf2e':
      return 'PF2e character summaries not yet implemented';

    default:
      return `Unsupported game system: ${system}`;
  }
}

/**
 * Apply MCP update to actor
 *
 * Routes to appropriate system adapter.
 *
 * @param actor - Foundry actor object (will be modified)
 * @param update - MCP update object
 * @returns Update result with list of modified fields
 */
export function applyMcpUpdate(
  actor: any,
  update: MCPCharacterUpdate
): { success: boolean; updatedFields?: string[]; errors?: string[] } {
  const system = detectGameSystem(actor);

  switch (system) {
    case 'dsa5':
      return applyMcpUpdateToDsa5Actor(actor as Dsa5Actor, update);

    case 'dnd5e':
      return {
        success: false,
        errors: ['DnD5e update adapter not yet implemented'],
      };

    case 'pf2e':
      return {
        success: false,
        errors: ['PF2e update adapter not yet implemented'],
      };

    default:
      return {
        success: false,
        errors: [`Unsupported game system: ${system}`],
      };
  }
}

/**
 * Get all characters from actor list
 *
 * Filters actors by type and converts to MCP format.
 *
 * @param actors - Array of Foundry actors
 * @returns Array of MCP characters
 */
export function getAllCharacters(actors: any[]): MCPCharacter[] {
  const characters: MCPCharacter[] = [];

  for (const actor of actors) {
    // Filter for character and NPC types
    if (actor.type !== 'character' && actor.type !== 'npc' && actor.type !== 'creature') {
      continue;
    }

    const result = actorToMcpCharacter(actor);
    if (result.success && result.character) {
      characters.push(result.character);
    }
  }

  return characters;
}
