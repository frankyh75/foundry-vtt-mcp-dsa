/**
 * DSA5 Type Definitions
 *
 * Type definitions for DSA5 (Das Schwarze Auge 5) game system.
 * These types represent the native Foundry VTT DSA5 data structures.
 */

/**
 * DSA5 Eigenschaft (Characteristic/Attribute)
 * Represents one of the 8 core attributes: MU, KL, IN, CH, FF, GE, KO, KK
 */
export interface Dsa5Eigenschaft {
  initial: number;       // Base value (typically 8)
  species: number;       // Species modifier
  modifier: number;      // Temporary/permanent modifiers
  advances: number;      // Experience advances
  gearmodifier: number;  // Equipment modifiers
  value: number;         // Final calculated value
}

/**
 * DSA5 Status Value (generic)
 * Used for LeP, AsP, KaP, and other resource pools
 */
export interface Dsa5StatusValue {
  initial?: number;
  value: number;
  advances?: number;
  modifier?: number;
  current?: number;
  max?: number;
  multiplier?: number;
  gearmodifier?: number;
  min?: number;
  permanentLoss?: number;
  rebuy?: number;
  permanentGear?: number;
  permanentLossSum?: number;
  air?: number;
  water?: number;
  airmultiplier?: number;
  watermultiplier?: number;
  waterMax?: number;
  airMax?: number;
  die?: string;
}

/**
 * DSA5 Talent (Skill)
 */
export interface Dsa5Talent {
  name: string;
  value: number;               // Talent value (FW - Fertigkeitswert)
  eigenschaften: string[];     // Attribute probe (e.g., ["MU", "IN", "CH"])
}

/**
 * DSA5 Kampftechnik (Combat Skill)
 */
export interface Dsa5Kampftechnik {
  name: string;
  at: number;  // Attack value (Attacke)
  pa: number;  // Parry value (Parade)
}

/**
 * Complete DSA5 Character Data
 * This is the DSA5-specific extension to CharacterInfo
 */
export interface Dsa5CharacterData {
  eigenschaften: {
    MU: Dsa5Eigenschaft;  // Mut (Courage)
    KL: Dsa5Eigenschaft;  // Klugheit (Cleverness)
    IN: Dsa5Eigenschaft;  // Intuition
    CH: Dsa5Eigenschaft;  // Charisma
    FF: Dsa5Eigenschaft;  // Fingerfertigkeit (Dexterity)
    GE: Dsa5Eigenschaft;  // Gewandtheit (Agility)
    KO: Dsa5Eigenschaft;  // Konstitution (Constitution)
    KK: Dsa5Eigenschaft;  // Körperkraft (Strength)
  };
  status: {
    wounds: Dsa5StatusValue;        // LeP (Lebensenergie) - NOTE: Inverted logic!
    astralenergy: Dsa5StatusValue;  // AsP (Astralenergie)
    karmaenergy: Dsa5StatusValue;   // KaP (Karmaenergie)
    speed: Dsa5StatusValue;         // Geschwindigkeit
    initiative: Dsa5StatusValue;    // Initiative
    armour?: Dsa5StatusValue;       // Rüstungsschutz
    dodge?: Dsa5StatusValue;        // Ausweichen
    soulpower?: Dsa5StatusValue;    // Seelenkraft
    toughness?: Dsa5StatusValue;    // Zähigkeit
  };
  talente: Dsa5Talent[];
  kampftechniken: Dsa5Kampftechnik[];
  details?: {
    species?: string;      // Spezies (e.g., "Mensch", "Elf", "Zwerg")
    culture?: string;      // Kultur (e.g., "Mittelländisch", "Thorwal")
    profession?: string;   // Profession/Career
    size?: string;         // Größenkategorie (German!)
  };
  experience?: {
    total: number;   // Total adventure points earned
    spent: number;   // Adventure points spent
  };
  tradition?: {
    magical?: string;    // Magical tradition (e.g., "Gildenmagier")
    clerical?: string;   // Clerical tradition (e.g., "Boron-Geweihter")
  };
  advantages?: string[];
  disadvantages?: string[];
  specialAbilities?: string[];
}

/**
 * DSA5 Creature Index Entry
 * Used for enhanced creature search and filtering
 */
export interface Dsa5CreatureIndex {
  // Basic identification
  id: string;
  name: string;
  type: string;           // "character", "npc", "creature"
  pack: string;           // Compendium pack ID
  packLabel: string;      // Human-readable pack name

  // Identity
  level: number;          // Experience level
  species: string;        // Species (e.g., "Goblin", "Mensch")
  culture: string;        // Culture
  experience: number;     // Total AP

  // Physical attributes
  size: string;           // "tiny", "small", "medium", "large", "huge"
  lifePoints: number;     // LeP

  // Combat values
  meleeDefense: number;   // Nahkampf-Verteidigung
  rangedDefense: number;  // Fernkampf-Verteidigung

  // Capabilities
  hasSpells: boolean;
  traits: string[];

  // Optional metadata
  rarity?: string;
  description?: string;
  img?: string;
}

/**
 * DSA5 Talent Index Entry
 * For compendium search of skills and combat skills
 */
export interface Dsa5TalentIndex {
  id: string;
  name: string;
  type: string;                    // "skill" or "combatskill"
  pack: string;
  packLabel: string;

  group?: string;                  // Skill group (e.g., "trade", "social", "nature")
  characteristics: string[];       // Attribute probe (e.g., ["FF", "GE", "KK"])
  steigerungsfaktor: string;       // Advancement cost category ("A", "B", "C", "D")
  burden?: boolean;                // Is affected by encumbrance

  description?: string;
  img?: string;
}

/**
 * DSA5 Spell/Liturgy Index Entry
 */
export interface Dsa5SpellIndex {
  id: string;
  name: string;
  type: string;                    // "spell", "liturgy", "ceremony", "ritual"
  pack: string;
  packLabel: string;

  // Attributes
  characteristics: string[];       // Probe attributes (e.g., ["KL", "IN", "FF"])

  // Cost and duration
  cost: number;                    // AsP or KaP cost
  costType: string;                // "AsP" or "KaP"
  costDetail: string;              // Full cost string (e.g., "8 AsP")
  castingTime: number;             // Actions required
  duration: string;                // Duration (e.g., "instant", "10 CR", "1 year")

  // Range and target
  range: string;                   // Range (e.g., "8 steps", "touch")
  targetCategory: string;          // Target category

  // Classification
  merkmal?: string;                // Spell aspect (e.g., "Antimagie")
  distribution: string;            // Tradition/deity distribution
  steigerungsfaktor: string;       // Advancement cost category

  // Modifiability flags
  canChangeCost: boolean;
  canChangeCastingTime: boolean;
  canChangeRange: boolean;

  description?: string;
  img?: string;
}

/**
 * DSA5 Weapon Index Entry
 */
export interface Dsa5WeaponIndex {
  id: string;
  name: string;
  type: string;                    // "meleeweapon", "rangeweapon"
  pack: string;
  packLabel: string;

  combatSkill: string;             // Combat technique (e.g., "Hiebwaffen", "Bögen")
  damage: string;                  // Damage formula (e.g., "1W6+4")
  reach: string;                   // Weapon reach

  atMod: number;                   // AT modifier
  paMod: number;                   // PA modifier

  damageThreshold: number;         // Primary attribute threshold
  guidevalue: string;              // Primary attribute (e.g., "kk", "ff")

  weight: number;
  price: number;

  description?: string;
  img?: string;
}

/**
 * DSA5 Armor Index Entry
 */
export interface Dsa5ArmorIndex {
  id: string;
  name: string;
  type: string;                    // "armor"
  pack: string;
  packLabel: string;

  protection: number;              // RS (Rüstungsschutz)
  encumbrance: number;             // BE (Belastung/Behinderung)
  weight: number;
  price: number;

  armorType?: string;              // Armor type (leather, chain, plate, etc.)

  description?: string;
  img?: string;
}

/**
 * DSA5 Special Ability Index Entry
 */
export interface Dsa5SpecialAbilityIndex {
  id: string;
  name: string;
  type: string;                    // "specialability"
  pack: string;
  packLabel: string;

  category: string;                // Category (e.g., "combat", "magical", "clerical")
  apCost: string;                  // AP cost (e.g., "10", "20;35" for tiered)

  requirements?: string;           // Prerequisites
  description?: string;
  img?: string;
}
