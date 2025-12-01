/**
 * DSA5 Character Export
 *
 * Applies MCP character updates back to Foundry DSA5 actors.
 * Handles conversion from MCP format to DSA5 system data.
 */

import type {
  MCPCharacterUpdate,
  Dsa5Actor,
  CharacterExportResult,
} from './types.js';

/**
 * Apply MCP character update to DSA5 actor
 *
 * Converts MCP update format back to DSA5 Foundry system data structure.
 * Handles both absolute updates and delta changes.
 *
 * @param actor - Original DSA5 actor (will be modified)
 * @param update - MCP update object with changes
 * @returns Result with updated fields list
 */
export function applyMcpUpdateToDsa5Actor(
  actor: Dsa5Actor,
  update: MCPCharacterUpdate
): CharacterExportResult {
  const updatedFields: string[] = [];
  const errors: string[] = [];

  try {
    // Validate actor structure
    if (!actor.system || !actor.system.characteristics || !actor.system.status) {
      return {
        success: false,
        errors: ['Invalid DSA5 actor: missing system data'],
      };
    }

    // Apply attribute updates (Eigenschaften)
    if (update.attributes) {
      for (const [key, value] of Object.entries(update.attributes)) {
        if (value === undefined) continue;

        const eigenschaftKey = key.toLowerCase() as keyof typeof actor.system.characteristics;

        if (actor.system.characteristics[eigenschaftKey]) {
          actor.system.characteristics[eigenschaftKey].value = value;
          updatedFields.push(`attributes.${key}`);
        } else {
          errors.push(`Unknown attribute: ${key}`);
        }
      }
    }

    // Apply health updates
    if (update.health) {
      const wounds = actor.system.status.wounds;

      if (update.health.delta !== undefined) {
        // Delta change: adjust current HP by delta
        const currentHP = wounds.max - wounds.value;
        const newHP = Math.max(0, Math.min(wounds.max, currentHP + update.health.delta));
        wounds.value = wounds.max - newHP;
        updatedFields.push(`health (delta: ${update.health.delta > 0 ? '+' : ''}${update.health.delta})`);
      } else {
        // Absolute change
        if (update.health.current !== undefined) {
          // Convert HP to wounds: wounds = max - HP
          const newHP = Math.max(0, Math.min(wounds.max, update.health.current));
          wounds.value = wounds.max - newHP;
          updatedFields.push(`health.current`);
        }

        if (update.health.max !== undefined) {
          wounds.max = update.health.max;
          updatedFields.push(`health.max`);
        }
      }
    }

    // Apply resource updates (AsP, KaP)
    if (update.resources && Array.isArray(update.resources)) {
      for (const resourceUpdate of update.resources) {
        const resourceName = resourceUpdate.name.toLowerCase();

        // Map resource names to DSA5 system fields
        let systemResource: { value: number; max: number } | undefined;
        let fieldName = '';

        if (resourceName.includes('astral') || resourceName === 'asp') {
          systemResource = actor.system.status.astralenergy;
          fieldName = 'astralenergy';
        } else if (resourceName.includes('karma') || resourceName === 'kap') {
          systemResource = actor.system.status.karmaenergy;
          fieldName = 'karmaenergy';
        }

        if (systemResource) {
          if (resourceUpdate.delta !== undefined) {
            // Delta change
            systemResource.value = Math.max(
              0,
              Math.min(systemResource.max, systemResource.value + resourceUpdate.delta)
            );
            updatedFields.push(`${fieldName} (delta: ${resourceUpdate.delta > 0 ? '+' : ''}${resourceUpdate.delta})`);
          } else if (resourceUpdate.current !== undefined) {
            // Absolute change
            systemResource.value = Math.max(0, Math.min(systemResource.max, resourceUpdate.current));
            updatedFields.push(`${fieldName}.value`);
          }
        } else {
          errors.push(`Unknown resource: ${resourceUpdate.name}`);
        }
      }
    }

    // Apply skill updates
    if (update.skills && Array.isArray(update.skills) && actor.items) {
      for (const skillUpdate of update.skills) {
        const item = actor.items.find(i => i._id === skillUpdate.id);

        if (item && item.system?.talentValue) {
          if (skillUpdate.delta !== undefined) {
            // Delta change
            item.system.talentValue.value += skillUpdate.delta;
            updatedFields.push(`skill.${item.name} (delta: ${skillUpdate.delta > 0 ? '+' : ''}${skillUpdate.delta})`);
          } else if (skillUpdate.value !== undefined) {
            // Absolute change
            item.system.talentValue.value = skillUpdate.value;
            updatedFields.push(`skill.${item.name}`);
          }
        } else {
          errors.push(`Skill not found: ${skillUpdate.id}`);
        }
      }
    }

    const result: CharacterExportResult = {
      success: errors.length === 0 || updatedFields.length > 0,
      updatedFields,
    };

    if (errors.length > 0) {
      result.errors = errors;
    }

    return result;
  } catch (error) {
    return {
      success: false,
      errors: [`Failed to apply update: ${error instanceof Error ? error.message : String(error)}`],
    };
  }
}

/**
 * Build Foundry update object from MCP update
 *
 * Creates a flat update object suitable for Foundry's actor.update() method.
 * Uses dot notation for nested fields.
 *
 * @param update - MCP update object
 * @returns Foundry-compatible update object
 */
export function buildFoundryUpdateObject(update: MCPCharacterUpdate): Record<string, any> {
  const foundryUpdate: Record<string, any> = {};

  // Attribute updates
  if (update.attributes) {
    for (const [key, value] of Object.entries(update.attributes)) {
      const eigenschaftKey = key.toLowerCase();
      foundryUpdate[`system.characteristics.${eigenschaftKey}.value`] = value;
    }
  }

  // Health updates
  if (update.health) {
    if (update.health.max !== undefined) {
      foundryUpdate['system.status.wounds.max'] = update.health.max;
    }
    // Note: current HP requires calculating wounds.value from HP
    // This should be done with context of current wounds.max
  }

  return foundryUpdate;
}

/**
 * Validate MCP update object
 *
 * Checks if update contains valid fields and values.
 *
 * @param update - MCP update object to validate
 * @returns Validation result with errors if any
 */
export function validateMcpUpdate(update: MCPCharacterUpdate): { valid: boolean; errors?: string[] } {
  const errors: string[] = [];

  if (!update.id) {
    errors.push('Missing character ID');
  }

  // Validate attribute keys
  if (update.attributes) {
    const validAttributes = ['mu', 'kl', 'in', 'ch', 'ff', 'ge', 'ko', 'kk'];
    for (const key of Object.keys(update.attributes)) {
      if (!validAttributes.includes(key.toLowerCase())) {
        errors.push(`Invalid attribute: ${key}`);
      }
    }
  }

  // Validate health values
  if (update.health) {
    if (update.health.current !== undefined && update.health.current < 0) {
      errors.push('Health current cannot be negative');
    }
    if (update.health.max !== undefined && update.health.max <= 0) {
      errors.push('Health max must be positive');
    }
  }

  const result: { valid: boolean; errors?: string[] } = {
    valid: errors.length === 0,
  };

  if (errors.length > 0) {
    result.errors = errors;
  }

  return result;
}

/**
 * Calculate new wounds value from HP change
 *
 * Helper function to convert HP to DSA5 wounds system.
 * Remember: wounds = max - HP
 *
 * @param currentWounds - Current wounds value
 * @param maxLeP - Maximum life points
 * @param hpChange - Change in HP (positive = healing, negative = damage)
 * @returns New wounds value
 */
export function calculateNewWounds(currentWounds: number, maxLeP: number, hpChange: number): number {
  const currentHP = maxLeP - currentWounds;
  const newHP = Math.max(0, Math.min(maxLeP, currentHP + hpChange));
  return maxLeP - newHP;
}
