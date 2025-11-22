/**
 * DSA5 Field Mappings
 *
 * Mapping tables for converting between DSA5 Foundry data and MCP-friendly formats.
 * This centralizes all the German-to-English conversions and system-specific mappings.
 */

/**
 * DSA5 Eigenschaften (Attributes) - German abbreviations to full names
 */
export const EIGENSCHAFT_NAMES: Record<string, { short: string; german: string; english: string }> = {
  MU: { short: 'MU', german: 'Mut', english: 'Courage' },
  KL: { short: 'KL', german: 'Klugheit', english: 'Cleverness' },
  IN: { short: 'IN', german: 'Intuition', english: 'Intuition' },
  CH: { short: 'CH', german: 'Charisma', english: 'Charisma' },
  FF: { short: 'FF', german: 'Fingerfertigkeit', english: 'Dexterity' },
  GE: { short: 'GE', german: 'Gewandtheit', english: 'Agility' },
  KO: { short: 'KO', german: 'Konstitution', english: 'Constitution' },
  KK: { short: 'KK', german: 'Körperkraft', english: 'Strength' },
};

/**
 * Size categories - German to English
 * IMPORTANT: DSA5 uses German size categories internally!
 */
export const SIZE_MAP_DE_TO_EN: Record<string, string> = {
  'winzig': 'tiny',
  'klein': 'small',
  'mittel': 'medium',
  'average': 'medium',  // Foundry sometimes uses English
  'groß': 'large',
  'riesig': 'huge',
  'gigantisch': 'gargantuan',
};

/**
 * Size categories - English to German
 */
export const SIZE_MAP_EN_TO_DE: Record<string, string> = {
  'tiny': 'Winzig',
  'small': 'Klein',
  'medium': 'Mittel',
  'average': 'Mittel',
  'large': 'Groß',
  'huge': 'Riesig',
  'gargantuan': 'Gigantisch',
};

/**
 * Resource types (for status values)
 */
export const RESOURCE_TYPES = {
  WOUNDS: 'wounds',           // LeP (Lebensenergie) - INVERTED LOGIC!
  ASTRAL_ENERGY: 'astralenergy',  // AsP
  KARMA_ENERGY: 'karmaenergy',    // KaP
  SPEED: 'speed',             // Geschwindigkeit
  INITIATIVE: 'initiative',   // Initiative
  ARMOR: 'armour',           // Rüstungsschutz
  DODGE: 'dodge',            // Ausweichen
  SOUL_POWER: 'soulpower',   // Seelenkraft
  TOUGHNESS: 'toughness',    // Zähigkeit
} as const;

/**
 * Item types in DSA5
 */
export const ITEM_TYPES = {
  SKILL: 'skill',                     // Talente
  COMBAT_SKILL: 'combatskill',        // Kampftechniken
  SPELL: 'spell',                     // Zauber
  LITURGY: 'liturgy',                 // Liturgien
  CEREMONY: 'ceremony',               // Zeremonien
  RITUAL: 'ritual',                   // Rituale
  MELEE_WEAPON: 'meleeweapon',        // Nahkampfwaffen
  RANGE_WEAPON: 'rangeweapon',        // Fernkampfwaffen
  ARMOR: 'armor',                     // Rüstungen
  ADVANTAGE: 'advantage',             // Vorteile
  DISADVANTAGE: 'disadvantage',       // Nachteile
  SPECIAL_ABILITY: 'specialability',  // Sonderfertigkeiten
} as const;

/**
 * Actor types in DSA5
 */
export const ACTOR_TYPES = {
  CHARACTER: 'character',  // Player characters
  NPC: 'npc',             // Non-player characters
  CREATURE: 'creature',   // Monsters/creatures
} as const;

/**
 * LeP (Wounds) Logic Helper
 *
 * CRITICAL: DSA5 uses INVERTED logic for hit points!
 * - system.status.wounds.value = current WOUNDS taken (0 = healthy)
 * - system.status.wounds.max = maximum Lebensenergie
 *
 * Conversion formulas:
 * - Current HP = wounds.max - wounds.value
 * - New wounds = wounds.max - new_HP
 */
export const WOUNDS_HELPER = {
  /**
   * Convert DSA5 wounds to HP
   */
  toHitPoints: (wounds: { value: number; max: number }) => {
    return {
      current: wounds.max - wounds.value,
      max: wounds.max,
    };
  },

  /**
   * Convert HP to DSA5 wounds
   */
  toWounds: (hitPoints: { current: number; max: number }) => {
    return {
      value: hitPoints.max - hitPoints.current,
      max: hitPoints.max,
    };
  },

  /**
   * Apply HP delta to wounds
   */
  applyHpDelta: (currentWounds: { value: number; max: number }, hpDelta: number) => {
    const currentHp = currentWounds.max - currentWounds.value;
    const newHp = Math.max(0, Math.min(currentWounds.max, currentHp + hpDelta));
    return {
      value: currentWounds.max - newHp,
      max: currentWounds.max,
    };
  },
};

/**
 * Characteristic calculation helper
 * Total value = initial + species + modifier + advances
 */
export const EIGENSCHAFT_HELPER = {
  /**
   * Calculate total characteristic value
   */
  calculateTotal: (eigenschaft: {
    initial?: number;
    species?: number;
    modifier?: number;
    advances?: number;
  }) => {
    const initial = eigenschaft.initial ?? 8;
    const species = eigenschaft.species ?? 0;
    const modifier = eigenschaft.modifier ?? 0;
    const advances = eigenschaft.advances ?? 0;
    return initial + species + modifier + advances;
  },
};

/**
 * Skill group translations (German to English)
 */
export const SKILL_GROUPS: Record<string, string> = {
  'körper': 'body',
  'gesellschaft': 'social',
  'natur': 'nature',
  'wissen': 'knowledge',
  'handwerk': 'trade',
};

/**
 * Steigerungsfaktor (Advancement cost categories)
 */
export const ADVANCEMENT_CATEGORIES = ['A', 'B', 'C', 'D', 'E'] as const;

/**
 * Common DSA5 field paths for system data access
 */
export const FIELD_PATHS = {
  // Characteristics
  CHARACTERISTICS: 'system.characteristics',

  // Status values
  STATUS_WOUNDS: 'system.status.wounds',
  STATUS_ASTRAL: 'system.status.astralenergy',
  STATUS_KARMA: 'system.status.karmaenergy',
  STATUS_SPEED: 'system.status.speed',
  STATUS_INITIATIVE: 'system.status.initiative',
  STATUS_DODGE: 'system.status.dodge',

  // Details
  DETAILS_SPECIES: 'system.details.species.value',
  DETAILS_CULTURE: 'system.details.culture.value',
  DETAILS_CAREER: 'system.details.career.value',
  DETAILS_EXPERIENCE: 'system.details.experience',

  // Size (in status, not details!)
  STATUS_SIZE: 'system.status.size.value',

  // Tradition
  TRADITION: 'system.tradition',
} as const;
