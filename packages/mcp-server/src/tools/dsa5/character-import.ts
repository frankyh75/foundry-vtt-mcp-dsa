/**
 * DSA5 Character Import
 *
 * Converts Foundry DSA5 actors to system-agnostic MCP character format.
 * Handles all 8 Eigenschaften, LeP/AsP/KaP resources, and DSA5-specific data.
 */

import type {
  MCPCharacter,
  Dsa5Actor,
  CharacterImportResult,
} from './types.js';

/**
 * Convert DSA5 Foundry actor to MCP character format
 *
 * @param actor - Raw Foundry actor data for DSA5
 * @returns MCP-compatible character object
 */
export function fromDsa5Actor(actor: Dsa5Actor): CharacterImportResult {
  try {
    const system = actor.system;

    if (!system || !system.characteristics || !system.status) {
      return {
        success: false,
        errors: ['Invalid DSA5 actor: missing system data'],
      };
    }

    // Extract 8 Eigenschaften (attributes)
    const eigenschaften = {
      mu: system.characteristics.mu.value,
      kl: system.characteristics.kl.value,
      in: system.characteristics.in.value,
      ch: system.characteristics.ch.value,
      ff: system.characteristics.ff.value,
      ge: system.characteristics.ge.value,
      ko: system.characteristics.ko.value,
      kk: system.characteristics.kk.value,
    };

    // Map Eigenschaften to generic attributes (with German names)
    const attributes: Record<string, number> = {
      MU: eigenschaften.mu,
      KL: eigenschaften.kl,
      IN: eigenschaften.in,
      CH: eigenschaften.ch,
      FF: eigenschaften.ff,
      GE: eigenschaften.ge,
      KO: eigenschaften.ko,
      KK: eigenschaften.kk,
    };

    // CRITICAL: DSA5 uses WOUNDS, not HP directly!
    // Actual HP = wounds.max - wounds.value
    const wounds = system.status.wounds;
    const currentHP = wounds.max - wounds.value;
    const maxHP = wounds.max;

    // Build resources array
    const resources = [];

    // Astral Energy (AsP) - for spellcasters
    if (system.status.astralenergy && system.status.astralenergy.max > 0) {
      resources.push({
        name: 'Astralenergie',
        current: system.status.astralenergy.value,
        max: system.status.astralenergy.max,
        type: 'asp',
      });
    }

    // Karma Energy (KaP) - for blessed characters
    if (system.status.karmaenergy && system.status.karmaenergy.max > 0) {
      resources.push({
        name: 'Karmaenergie',
        current: system.status.karmaenergy.value,
        max: system.status.karmaenergy.max,
        type: 'kap',
      });
    }

    // Extract skills/talents from items
    const skills = [];
    if (actor.items && Array.isArray(actor.items)) {
      for (const item of actor.items) {
        if (item.type === 'skill' || item.type === 'talent') {
          const talentValue = item.system?.talentValue?.value ?? 0;
          const characteristic = item.system?.characteristic ?? '';

          skills.push({
            id: item._id,
            name: item.name,
            value: talentValue,
            metadata: {
              type: item.type,
              characteristic, // e.g., "MU/IN/CH" for 3-attribute check
            },
          });
        }
      }
    }

    // Build profile (only include defined properties)
    const profile: {
      species?: string;
      culture?: string;
      profession?: string;
      experience?: number;
    } = {};
    if (system.details?.species?.value) profile.species = system.details.species.value;
    if (system.details?.culture?.value) profile.culture = system.details.culture.value;
    if (system.details?.career?.value) profile.profession = system.details.career.value;
    if (system.details?.experience?.total !== undefined) profile.experience = system.details.experience.total;

    // Build systemData.dsa5 (only include defined properties)
    const dsa5Data: {
      eigenschaften?: typeof eigenschaften;
      wounds?: number;
      astralenergy?: { current: number; max: number };
      karmaenergy?: { current: number; max: number };
    } = {};

    dsa5Data.eigenschaften = eigenschaften;
    dsa5Data.wounds = wounds.value;

    if (system.status.astralenergy) {
      dsa5Data.astralenergy = {
        current: system.status.astralenergy.value,
        max: system.status.astralenergy.max,
      };
    }

    if (system.status.karmaenergy) {
      dsa5Data.karmaenergy = {
        current: system.status.karmaenergy.value,
        max: system.status.karmaenergy.max,
      };
    }

    // Build MCP character
    const character: MCPCharacter = {
      id: actor._id,
      name: actor.name,
      system: 'dsa5',
      attributes,
      health: {
        current: currentHP,
        max: maxHP,
      },
      resources,
      skills,
      profile,
      systemData: {
        dsa5: dsa5Data,
      },
    };

    // Add physical if size exists
    if (system.status.size) {
      character.physical = { size: system.status.size.value };
    }

    return {
      success: true,
      character,
    };
  } catch (error) {
    return {
      success: false,
      errors: [`Failed to convert DSA5 actor: ${error instanceof Error ? error.message : String(error)}`],
    };
  }
}

/**
 * Get a human-readable summary of DSA5 character stats
 *
 * @param actor - DSA5 Foundry actor
 * @returns Formatted character summary string
 */
export function getDsa5CharacterSummary(actor: Dsa5Actor): string {
  const result = fromDsa5Actor(actor);

  if (!result.success || !result.character) {
    return `Error: ${result.errors?.join(', ') ?? 'Unknown error'}`;
  }

  const char = result.character;
  const system = char.systemData?.dsa5;

  const lines = [];

  // Header
  lines.push(`**${char.name}**`);
  lines.push(`*${char.profile.species ?? 'Unbekannt'} ${char.profile.profession ?? 'Unbekannt'} aus ${char.profile.culture ?? 'Unbekannt'}*`);
  lines.push('');

  // Eigenschaften (8 attributes)
  lines.push('**Eigenschaften:**');
  if (system?.eigenschaften) {
    const attrs = system.eigenschaften;
    lines.push(
      `MU ${attrs.mu} | KL ${attrs.kl} | IN ${attrs.in} | CH ${attrs.ch} | FF ${attrs.ff} | GE ${attrs.ge} | KO ${attrs.ko} | KK ${attrs.kk}`
    );
  }
  lines.push('');

  // Health
  lines.push('**Lebensenergie (LeP):**');
  lines.push(`${char.health.current} / ${char.health.max}`);
  if (system?.wounds !== undefined) {
    lines.push(`*(Wunden: ${system.wounds})*`);
  }
  lines.push('');

  // Resources
  if (char.resources && char.resources.length > 0) {
    lines.push('**Ressourcen:**');
    for (const resource of char.resources) {
      lines.push(`- ${resource.name}: ${resource.current} / ${resource.max}`);
    }
    lines.push('');
  }

  // Experience
  if (char.profile.experience !== undefined) {
    lines.push('**Erfahrung:**');
    lines.push(`${char.profile.experience} Abenteuerpunkte`);
    lines.push('');
  }

  // Skills summary
  if (char.skills && char.skills.length > 0) {
    lines.push('**Talente:**');
    lines.push(`${char.skills.length} Talente verfügbar`);

    // Show top 5 skills
    const topSkills = [...char.skills]
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);

    lines.push('Top 5:');
    for (const skill of topSkills) {
      lines.push(`- ${skill.name}: ${skill.value}`);
    }
  }

  return lines.join('\n');
}

/**
 * Extract all character IDs from actor list
 *
 * @param actors - Array of DSA5 actors
 * @returns Array of character IDs with names
 */
export function extractCharacterIds(actors: Dsa5Actor[]): Array<{ id: string; name: string; type: string }> {
  return actors.map(actor => ({
    id: actor._id,
    name: actor.name,
    type: actor.type,
  }));
}
