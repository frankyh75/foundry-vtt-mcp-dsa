/**
 * DSA5 Character Import
 *
 * Functions to extract DSA5-specific data from Foundry VTT actors
 * and convert them into the standardized DSA5 format.
 */

import type { Dsa5CharacterData, Dsa5Talent, Dsa5Kampftechnik } from './types.js';
import { SIZE_MAP_EN_TO_DE } from './field-mappings.js';

/**
 * Extract complete DSA5 character data from a Foundry actor
 *
 * @param actor - Foundry VTT actor object
 * @returns Complete DSA5 character data
 */
export function extractDsa5CharacterData(actor: Actor): Dsa5CharacterData {
  const system = (actor as any).system || {};

  const dsa5Data: Partial<Dsa5CharacterData> = {
    talente: extractDsa5Skills(actor),
    kampftechniken: extractDsa5CombatSkills(actor),
  };

  // Extract characteristics (Eigenschaften) with species normalization
  if (system.characteristics) {
    dsa5Data.eigenschaften = {
      MU: { ...system.characteristics.mu, species: 0 },
      KL: { ...system.characteristics.kl, species: 0 },
      IN: { ...system.characteristics.in, species: 0 },
      CH: { ...system.characteristics.ch, species: 0 },
      FF: { ...system.characteristics.ff, species: 0 },
      GE: { ...system.characteristics.ge, species: 0 },
      KO: { ...system.characteristics.ko, species: 0 },
      KK: { ...system.characteristics.kk, species: 0 },
    };
  }

  // Extract status values (LeP, AsP, KaP, etc.)
  if (system.status) {
    dsa5Data.status = {
      wounds: system.status.wounds,
      astralenergy: system.status.astralenergy,
      karmaenergy: system.status.karmaenergy,
      speed: system.status.speed,
      initiative: system.status.initiative,
      armour: system.status.armour,
      dodge: system.status.dodge,           // Ausweichen
      soulpower: system.status.soulpower,   // Seelenkraft
      toughness: system.status.toughness,   // Zähigkeit
    };
  }

  // Extract identity information (species, culture, profession, size)
  if (system.details) {
    dsa5Data.details = {
      species: system.details.species?.value,      // "Mensch", "Elf", etc.
      culture: system.details.culture?.value,      // "Fjarninger", etc.
      profession: system.details.career?.value,    // "Fjarningerschamane" (uses 'career' field!)
      size: system.status?.size?.value
        ? SIZE_MAP_EN_TO_DE[system.status.size.value] || system.status.size.value
        : undefined,
    };

    // Extract experience (Abenteuerpunkte)
    if (system.details.experience) {
      dsa5Data.experience = {
        total: system.details.experience.total || 0,
        spent: system.details.experience.spent || 0,
      };
    }
  }

  // Extract tradition (magical/clerical capabilities)
  if (system.tradition) {
    dsa5Data.tradition = {
      magical: system.tradition.magical || undefined,
      clerical: system.tradition.clerical || undefined,
    };
  }

  // Extract advantages, disadvantages, and special abilities from items
  const advantages: string[] = [];
  const disadvantages: string[] = [];
  const specialAbilities: string[] = [];

  if (actor.items) {
    for (const item of actor.items) {
      if (item.type === 'advantage') {
        advantages.push(item.name || '');
      } else if (item.type === 'disadvantage') {
        disadvantages.push(item.name || '');
      } else if (item.type === 'specialability') {
        specialAbilities.push(item.name || '');
      }
    }
  }

  dsa5Data.advantages = advantages;
  dsa5Data.disadvantages = disadvantages;
  dsa5Data.specialAbilities = specialAbilities;

  return dsa5Data as Dsa5CharacterData;
}

/**
 * Extract DSA5 skills (Talente) from actor items
 *
 * @param actor - Foundry VTT actor object
 * @returns Array of DSA5 talents with values and characteristic probes
 */
export function extractDsa5Skills(actor: Actor): Dsa5Talent[] {
  const talents: Dsa5Talent[] = [];

  try {
    actor.items.forEach((item) => {
      if (item.type === 'skill') {
        const system = (item as any).system || {};
        talents.push({
          name: item.name,
          value: system.talentValue?.value || system.value || 0,
          eigenschaften: system.characteristic || [],
        });
      }
    });
  } catch (error) {
    console.warn('[DSA5 Adapter] Error extracting skills:', error);
  }

  return talents;
}

/**
 * Extract DSA5 combat skills (Kampftechniken) from actor items
 *
 * @param actor - Foundry VTT actor object
 * @returns Array of combat skills with AT and PA values
 */
export function extractDsa5CombatSkills(actor: Actor): Dsa5Kampftechnik[] {
  const combatSkills: Dsa5Kampftechnik[] = [];

  try {
    actor.items.forEach((item) => {
      if (item.type === 'combatskill') {
        const system = (item as any).system || {};
        combatSkills.push({
          name: item.name,
          at: system.at?.value || system.attack?.value || 0,
          pa: system.pa?.value || system.parry?.value || 0,
        });
      }
    });
  } catch (error) {
    console.warn('[DSA5 Adapter] Error extracting combat skills:', error);
  }

  return combatSkills;
}

/**
 * Get a human-readable summary of a DSA5 character
 * Useful for MCP tool responses
 *
 * @param actor - Foundry VTT actor object
 * @returns Formatted character summary string
 */
export function getDsa5CharacterSummary(actor: Actor): string {
  const dsa5Data = extractDsa5CharacterData(actor);
  const lines: string[] = [];

  // Header
  lines.push(`=== ${actor.name} ===`);

  // Identity
  if (dsa5Data.details) {
    const parts: string[] = [];
    if (dsa5Data.details.species) parts.push(dsa5Data.details.species);
    if (dsa5Data.details.culture) parts.push(dsa5Data.details.culture);
    if (dsa5Data.details.profession) parts.push(dsa5Data.details.profession);
    if (parts.length > 0) {
      lines.push(parts.join(' • '));
    }
  }

  // Experience
  if (dsa5Data.experience) {
    const available = dsa5Data.experience.total - dsa5Data.experience.spent;
    lines.push(`AP: ${dsa5Data.experience.total} gesamt (${available} verfügbar)`);
  }

  // Eigenschaften (8 attributes)
  if (dsa5Data.eigenschaften) {
    const attrs = [
      `MU ${dsa5Data.eigenschaften.MU.value}`,
      `KL ${dsa5Data.eigenschaften.KL.value}`,
      `IN ${dsa5Data.eigenschaften.IN.value}`,
      `CH ${dsa5Data.eigenschaften.CH.value}`,
      `FF ${dsa5Data.eigenschaften.FF.value}`,
      `GE ${dsa5Data.eigenschaften.GE.value}`,
      `KO ${dsa5Data.eigenschaften.KO.value}`,
      `KK ${dsa5Data.eigenschaften.KK.value}`,
    ];
    lines.push('');
    lines.push('Eigenschaften: ' + attrs.join(' | '));
  }

  // Status (LeP, AsP, KaP)
  if (dsa5Data.status) {
    lines.push('');
    const currentLeP = dsa5Data.status.wounds.max - dsa5Data.status.wounds.value;
    lines.push(`LeP: ${currentLeP}/${dsa5Data.status.wounds.max}`);

    if (dsa5Data.status.astralenergy && dsa5Data.status.astralenergy.max > 0) {
      lines.push(`AsP: ${dsa5Data.status.astralenergy.value}/${dsa5Data.status.astralenergy.max}`);
    }

    if (dsa5Data.status.karmaenergy && dsa5Data.status.karmaenergy.max > 0) {
      lines.push(`KaP: ${dsa5Data.status.karmaenergy.value}/${dsa5Data.status.karmaenergy.max}`);
    }
  }

  // Top 5 skills
  if (dsa5Data.talente.length > 0) {
    lines.push('');
    const topSkills = dsa5Data.talente
      .sort((a, b) => b.value - a.value)
      .slice(0, 5)
      .map((t) => `${t.name} ${t.value}`)
      .join(', ');
    lines.push(`Top Talente: ${topSkills}`);
  }

  // Combat skills
  if (dsa5Data.kampftechniken.length > 0) {
    lines.push('');
    const combatSummary = dsa5Data.kampftechniken
      .map((k) => `${k.name} (AT ${k.at}/PA ${k.pa})`)
      .join(', ');
    lines.push(`Kampftechniken: ${combatSummary}`);
  }

  return lines.join('\n');
}
