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
  WOUNDS: 'wounds',           // LeP (Lebensenergie) - wounds.current has actual LeP!
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
 * IMPORTANT: DSA5 wounds structure (based on template.json reverse engineering):
 * - system.status.wounds.current = ACTUAL current LeP (e.g., 8 LeP remaining)
 * - system.status.wounds.max = maximum Lebensenergie (calculated)
 * - system.status.wounds.value = AP-based increases to max LeP (NOT current wounds!)
 * - system.status.wounds.initial = base LeP from character creation
 * - system.status.wounds.advances = LeP increases from AP spent
 * - system.status.wounds.modifier = temporary modifiers
 *
 * Max LeP formula: (KO+KO+KK)/2 + initial + value + advances + modifier
 *
 * ⚠️ NO INVERSION LOGIC NEEDED! wounds.current is the actual current LeP.
 */
export const WOUNDS_HELPER = {
  /**
   * Get current and max LeP from DSA5 wounds structure
   * @param wounds - DSA5 wounds object
   * @returns Hit points { current, max }
   */
  toHitPoints: (wounds: { current?: number; max?: number }) => {
    return {
      current: wounds.current ?? 0,
      max: wounds.max ?? 0,
    };
  },

  /**
   * Create wounds update for setting current LeP
   * @param newCurrent - New current LeP value
   * @returns Wounds update object
   */
  setCurrentLeP: (newCurrent: number) => {
    return {
      current: newCurrent,
    };
  },

  /**
   * Apply HP delta (damage/healing) to current LeP
   * @param currentWounds - Current wounds object
   * @param hpDelta - HP change (positive = healing, negative = damage)
   * @returns Updated wounds object
   */
  applyHpDelta: (
    currentWounds: { current?: number; max?: number },
    hpDelta: number
  ) => {
    const currentHp = currentWounds.current ?? 0;
    const maxHp = currentWounds.max ?? 0;
    const newHp = Math.max(0, Math.min(maxHp, currentHp + hpDelta));
    return {
      current: newHp,
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
