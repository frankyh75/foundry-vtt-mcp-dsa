/**
 * DSA5 Character Import/Export Types
 *
 * System-agnostic character representation for MCP communication.
 * Supports conversion between DSA5 Foundry actors and Claude-friendly format.
 */

/**
 * System-agnostic character representation
 * Used for communication between Foundry VTT and Claude Desktop
 */
export interface MCPCharacter {
  id: string;
  name: string;
  system: 'dsa5' | 'dnd5e' | 'pf2e';

  /** Character attributes (system-specific) */
  attributes: Record<string, number>;

  /** Health/Life points */
  health: {
    current: number;
    max: number;
    temp?: number;
  };

  /** Additional resources (mana, karma, etc.) */
  resources?: Array<{
    name: string;
    current: number;
    max: number;
    type: string;
  }>;

  /** Character skills/talents */
  skills: Array<{
    id: string;
    name: string;
    value: number;
    metadata?: any;
  }>;

  /** Character profile information */
  profile: {
    species?: string;
    culture?: string;
    profession?: string;
    experience?: number;
  };

  /** Physical characteristics */
  physical?: {
    size?: number;
  };

  /** System-specific data that doesn't fit elsewhere */
  systemData?: {
    dsa5?: {
      /** Eigenschaften in order: MU/KL/IN/CH/FF/GE/KO/KK */
      eigenschaften?: {
        mu: number;
        kl: number;
        in: number;
        ch: number;
        ff: number;
        ge: number;
        ko: number;
        kk: number;
      };
      /** Current wounds (not HP!) */
      wounds?: number;
      /** Astral energy */
      astralenergy?: { current: number; max: number };
      /** Karma energy */
      karmaenergy?: { current: number; max: number };
    };
  };
}

/**
 * Update object for modifying character stats
 * Only includes fields that should be changed
 */
export interface MCPCharacterUpdate {
  id: string;

  /** Attribute changes */
  attributes?: Partial<Record<string, number>>;

  /** Health changes */
  health?: {
    current?: number;
    max?: number;
    /** Delta for relative changes (e.g., +5 or -3) */
    delta?: number;
  };

  /** Resource changes */
  resources?: Array<{
    name: string;
    current?: number;
    /** Delta for relative changes */
    delta?: number;
  }>;

  /** Skill changes */
  skills?: Array<{
    id: string;
    value?: number;
    /** Delta for relative changes */
    delta?: number;
  }>;
}

/**
 * DSA5 Actor structure (Foundry VTT format)
 * Represents the raw Foundry actor data for DSA5 system
 */
export interface Dsa5Actor {
  _id: string;
  name: string;
  type: 'character' | 'npc' | 'creature';
  img?: string;

  system: {
    /** Eigenschaften (8 attributes) */
    characteristics: {
      mu: { value: number; initial?: number };
      kl: { value: number; initial?: number };
      in: { value: number; initial?: number };
      ch: { value: number; initial?: number };
      ff: { value: number; initial?: number };
      ge: { value: number; initial?: number };
      ko: { value: number; initial?: number };
      kk: { value: number; initial?: number };
    };

    /** Status/Resources */
    status: {
      /** Wounds (NOT current HP! HP = wounds.max - wounds.value) */
      wounds: {
        value: number;
        max: number;
      };
      /** Astral Energy (for spellcasters) */
      astralenergy?: {
        value: number;
        max: number;
      };
      /** Karma Energy (for blessed) */
      karmaenergy?: {
        value: number;
        max: number;
      };
      /** Size in cm */
      size?: {
        value: number;
      };
    };

    /** Character details */
    details?: {
      species?: { value: string };
      culture?: { value: string };
      career?: { value: string };
      experience?: { total: number };
    };
  };

  /** Items (skills, talents, spells, equipment) */
  items?: Array<{
    _id: string;
    name: string;
    type: string;
    system?: any;
  }>;
}

/**
 * Result of character import operation
 */
export interface CharacterImportResult {
  success: boolean;
  character?: MCPCharacter;
  errors?: string[];
}

/**
 * Result of character export/update operation
 */
export interface CharacterExportResult {
  success: boolean;
  updatedFields?: string[];
  errors?: string[];
}
