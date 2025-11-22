/**
 * DSA5 Creature Index Builder
 *
 * Functions to build and maintain a searchable creature index for DSA5 system.
 * This module is called from PersistentCreatureIndex in data-access.ts.
 */

import type { Dsa5CreatureIndex } from './types.js';
import { SIZE_MAP_DE_TO_EN } from './field-mappings.js';

/**
 * Build DSA5 creature index from all actor packs
 *
 * @param moduleId - Module identifier for logging
 * @param actorPacks - Array of Foundry compendium packs (type: Actor)
 * @returns Array of indexed DSA5 creatures
 */
export async function buildDsa5CreatureIndex(
  moduleId: string,
  actorPacks: any[]
): Promise<Dsa5CreatureIndex[]> {
  const startTime = Date.now();
  let progressNotification: any = null;
  let totalErrors = 0;

  try {
    const enhancedCreatures: Dsa5CreatureIndex[] = [];

    ui.notifications?.info(
      `Starte DSA5 Kreaturen-Index aus ${actorPacks.length} Paketen...`
    );

    let currentPack = 0;
    for (const pack of actorPacks) {
      currentPack++;

      if (progressNotification) {
        progressNotification.remove();
      }
      progressNotification = ui.notifications?.info(
        `Erstelle DSA5 Index: Paket ${currentPack}/${actorPacks.length} (${pack.metadata.label})...`
      );

      const result = await extractDsa5DataFromPack(moduleId, pack);
      enhancedCreatures.push(...result.creatures);
      totalErrors += result.errors;
    }

    if (progressNotification) {
      progressNotification.remove();
    }
    ui.notifications?.info(
      `Speichere DSA5 Index in Weltdatenbank... (${enhancedCreatures.length} Kreaturen)`
    );

    const buildTimeSeconds = Math.round((Date.now() - startTime) / 1000);
    const errorText = totalErrors > 0 ? ` (${totalErrors} Extraktionsfehler)` : '';
    const successMessage = `DSA5 Kreaturen-Index fertig! ${enhancedCreatures.length} Kreaturen indiziert aus ${actorPacks.length} Paketen in ${buildTimeSeconds}s${errorText}`;

    ui.notifications?.info(successMessage);

    return enhancedCreatures;
  } catch (error) {
    if (progressNotification) {
      progressNotification.remove();
    }

    const errorMessage = `Fehler beim Erstellen des DSA5 Kreaturen-Index: ${error instanceof Error ? error.message : 'Unbekannter Fehler'}`;
    console.error(`[${moduleId}] ${errorMessage}`);
    ui.notifications?.error(errorMessage);

    throw error;
  } finally {
    if (progressNotification) {
      progressNotification.remove();
    }
  }
}

/**
 * Extract DSA5 creature data from all documents in a pack
 *
 * @param moduleId - Module identifier for logging
 * @param pack - Foundry compendium pack
 * @returns Extracted creatures and error count
 */
async function extractDsa5DataFromPack(
  moduleId: string,
  pack: any
): Promise<{ creatures: Dsa5CreatureIndex[]; errors: number }> {
  const creatures: Dsa5CreatureIndex[] = [];
  let errors = 0;

  try {
    const documents = await pack.getDocuments();

    for (const doc of documents) {
      try {
        // Only process NPCs, characters, and creatures
        if (doc.type !== 'npc' && doc.type !== 'character' && doc.type !== 'creature') {
          continue;
        }

        const result = extractDsa5CreatureData(moduleId, doc, pack);
        if (result) {
          creatures.push(result.creature);
          errors += result.errors;
        }
      } catch (error) {
        console.warn(
          `[${moduleId}] Failed to extract DSA5 data from ${doc.name} in ${pack.metadata.label}:`,
          error
        );
        errors++;
      }
    }
  } catch (error) {
    console.warn(`[${moduleId}] Failed to load documents from ${pack.metadata.label}:`, error);
    errors++;
  }

  return { creatures, errors };
}

/**
 * Extract DSA5 creature data from a single Foundry document
 *
 * @param moduleId - Module identifier for logging
 * @param doc - Foundry actor document
 * @param pack - Source compendium pack
 * @returns Extracted creature data or null if failed
 */
function extractDsa5CreatureData(
  moduleId: string,
  doc: any,
  pack: any
): { creature: Dsa5CreatureIndex; errors: number } | null {
  try {
    const system = doc.system || {};

    // Extract level
    let level = system.details?.level?.value ?? system.level?.value ?? system.status?.level?.value ?? 0;
    level = Number(level) || 0;

    // Extract species
    let species = system.details?.species?.value ?? system.species?.value ?? system.details?.type ?? 'Unbekannt';
    if (typeof species !== 'string') {
      species = String(species || 'Unbekannt');
    }

    // Extract culture (with default)
    let culture = system.details?.culture?.value ?? system.culture?.value ?? 'Keine';
    if (typeof culture !== 'string') {
      culture = String(culture || 'Keine');
    }

    // Extract experience
    const experience = system.details?.experience?.total ?? system.experience?.total ?? system.status?.experience ?? 0;

    // Extract and normalize size
    let size = system.status?.size?.value ?? system.size?.value ?? 'mittel';
    if (typeof size !== 'string') {
      size = String(size || 'mittel');
    }
    size = SIZE_MAP_DE_TO_EN[size.toLowerCase()] || 'medium';

    // Extract combat values
    const lifePoints = system.status?.wounds?.max ?? system.status?.wounds?.value ?? system.wounds?.max ?? 1;
    const meleeDefense = system.status?.defense?.value ?? system.defense?.value ?? system.status?.defense ?? 10;
    const rangedDefense = system.status?.rangeDefense?.value ?? system.rangeDefense?.value ?? meleeDefense;

    // Detect spellcasting capability
    const hasSpells = !!(
      system.status?.astralenergy?.max ||
      system.status?.karmaenergy?.max ||
      system.spells ||
      system.liturgies ||
      system.details?.tradition
    );

    // Extract traits
    const traitsValue = system.details?.traits?.value || system.traits?.value || [];
    const traits = Array.isArray(traitsValue) ? traitsValue : [];

    // Optional fields
    const rarity = system.details?.rarity ?? system.rarity ?? undefined;
    const description =
      system.details?.biography?.value ??
      system.details?.description?.value ??
      system.biography?.value ??
      system.description?.value ??
      '';

    return {
      creature: {
        id: doc._id,
        name: doc.name,
        type: doc.type,
        pack: pack.metadata.id,
        packLabel: pack.metadata.label,
        level,
        species,
        culture,
        experience,
        size,
        lifePoints,
        meleeDefense,
        rangedDefense,
        hasSpells,
        traits,
        ...(rarity && { rarity }),
        ...(description && { description }),
        ...(doc.img && { img: doc.img }),
      },
      errors: 0,
    };
  } catch (error) {
    console.warn(`[${moduleId}] Failed to extract DSA5 data from ${doc.name}:`, error);

    // Return fallback data with error flag
    return {
      creature: {
        id: doc._id,
        name: doc.name,
        type: doc.type,
        pack: pack.metadata.id,
        packLabel: pack.metadata.label,
        level: 0,
        species: 'Unbekannt',
        culture: 'Keine',
        experience: 0,
        size: 'medium',
        lifePoints: 1,
        meleeDefense: 10,
        rangedDefense: 10,
        hasSpells: false,
        traits: [],
        description: 'Datenextraktion fehlgeschlagen',
        ...(doc.img && { img: doc.img }),
      },
      errors: 1,
    };
  }
}
