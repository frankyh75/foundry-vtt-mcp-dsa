/**
 * DSA5 Constants
 *
 * Central definitions for DSA5 system including experience levels,
 * field paths, and type mappings.
 */

/**
 * Erfahrungsgrad-Definitionen (DSA5 "Levels")
 * Quelle: https://dsa.ulisses-regelwiki.de/Erfahrung.html
 * Quelle: https://dsaforum.de/viewtopic.php?t=55440 (offizielles Regelwerk)
 *
 * WICHTIG: Dies sind FESTE STARTWERTE, keine Bereiche!
 * - Helden starten mit einem dieser AP-Werte basierend auf Erfahrungsgrad
 * - Für Level-Erkennung: Werte dienen als Schwellenwerte
 *
 * DSA5 Level 1-7, nicht 0-6!
 */
export const EXPERIENCE_LEVELS = [
  { name: 'Unerfahren', nameEn: 'Inexperienced', startAP: 900, threshold: 900, level: 1 },
  { name: 'Durchschnittlich', nameEn: 'Average', startAP: 1000, threshold: 1000, level: 2 },
  { name: 'Erfahren', nameEn: 'Experienced', startAP: 1100, threshold: 1100, level: 3 },
  { name: 'Kompetent', nameEn: 'Competent', startAP: 1200, threshold: 1200, level: 4 },
  { name: 'Meisterlich', nameEn: 'Masterful', startAP: 1400, threshold: 1400, level: 5 },
  { name: 'Brillant', nameEn: 'Brilliant', startAP: 1700, threshold: 1700, level: 6 },
  { name: 'Legendär', nameEn: 'Legendary', startAP: 2100, threshold: 2100, level: 7 },
] as const;

/**
 * Erfahrungsgrad-Typ
 */
export type DSA5ExperienceLevel = typeof EXPERIENCE_LEVELS[number];

/**
 * Konvertiert Abenteuerpunkte zu Erfahrungsgrad
 * @param totalAP - Gesamt-Abenteuerpunkte
 * @returns Erfahrungsgrad-Info (Name, Level, Start-AP)
 *
 * Logik: Findet den höchsten Erfahrungsgrad, dessen Schwellenwert <= totalAP ist
 * Beispiele:
 * - 950 AP → Unerfahren (900)
 * - 1050 AP → Durchschnittlich (1000)
 * - 1150 AP → Erfahren (1100)
 * - 2500 AP → Legendär (2100)
 */
export function getExperienceLevel(totalAP: number): DSA5ExperienceLevel {
  // Finde höchsten Level, dessen threshold <= totalAP
  let selectedLevel = EXPERIENCE_LEVELS[0]; // Default: Unerfahren

  for (const level of EXPERIENCE_LEVELS) {
    if (totalAP >= level.threshold) {
      selectedLevel = level;
    } else {
      break; // Array ist aufsteigend sortiert
    }
  }

  return selectedLevel;
}

/**
 * Konvertiert numerischen Level zu Erfahrungsgrad
 * @param level - Level (1-7)
 * @returns Erfahrungsgrad-Info
 */
export function getExperienceLevelByNumber(level: number): DSA5ExperienceLevel {
  const clamped = Math.max(1, Math.min(7, Math.floor(level)));
  return EXPERIENCE_LEVELS[clamped - 1]; // Array ist 0-indexed, aber Level 1-7
}

/**
 * Erfahrungsgrad-Namen (Deutsch)
 */
export const EXPERIENCE_LEVEL_NAMES_DE = EXPERIENCE_LEVELS.map(l => l.name);

/**
 * Erfahrungsgrad-Namen (Englisch)
 */
export const EXPERIENCE_LEVEL_NAMES_EN = EXPERIENCE_LEVELS.map(l => l.nameEn);

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
 * Common DSA5 field paths for system data access
 * Based on template.json reverse engineering from:
 * https://github.com/Plushtoast/dsa5-foundryVTT/blob/master/template.json
 */
export const FIELD_PATHS = {
  // Characteristics (Eigenschaften)
  CHARACTERISTICS: 'system.characteristics',
  CHAR_MU: 'system.characteristics.mu.value',
  CHAR_KL: 'system.characteristics.kl.value',
  CHAR_IN: 'system.characteristics.in.value',
  CHAR_CH: 'system.characteristics.ch.value',
  CHAR_FF: 'system.characteristics.ff.value',
  CHAR_GE: 'system.characteristics.ge.value',
  CHAR_KO: 'system.characteristics.ko.value',
  CHAR_KK: 'system.characteristics.kk.value',

  // Status values
  STATUS_WOUNDS: 'system.status.wounds',
  STATUS_WOUNDS_CURRENT: 'system.status.wounds.current',  // ACTUAL current LeP
  STATUS_WOUNDS_MAX: 'system.status.wounds.max',
  STATUS_ASTRAL: 'system.status.astralenergy',
  STATUS_KARMA: 'system.status.karmaenergy',
  STATUS_SPEED: 'system.status.speed',
  STATUS_INITIATIVE: 'system.status.initiative',
  STATUS_DODGE: 'system.status.dodge',
  STATUS_ARMOR: 'system.status.armour',

  // Details
  DETAILS_SPECIES: 'system.details.species.value',
  DETAILS_CULTURE: 'system.details.culture.value',
  DETAILS_CAREER: 'system.details.career.value',  // IMPORTANT: 'career' not 'profession'
  DETAILS_EXPERIENCE: 'system.details.experience',
  DETAILS_EXPERIENCE_TOTAL: 'system.details.experience.total',
  DETAILS_EXPERIENCE_SPENT: 'system.details.experience.spent',

  // Size (in status, not details!)
  STATUS_SIZE: 'system.status.size.value',

  // Tradition (magical/clerical)
  TRADITION: 'system.tradition',
  TRADITION_MAGICAL: 'system.tradition.magical',
  TRADITION_CLERICAL: 'system.tradition.clerical',
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
 * Resource types (for status values)
 */
export const RESOURCE_TYPES = {
  WOUNDS: 'wounds',           // LeP (Lebensenergie)
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
 * Skill group translations (German to English)
 */
export const SKILL_GROUPS: Record<string, string> = {
  'körper': 'body',
  'gesellschaft': 'social',
  'natur': 'nature',
  'wissen': 'knowledge',
  'handwerk': 'trade',
};
