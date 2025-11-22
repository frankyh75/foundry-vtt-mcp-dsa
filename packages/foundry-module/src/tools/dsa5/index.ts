/**
 * DSA5 Adapter Layer - Public API
 *
 * This module provides the public interface for DSA5 (Das Schwarze Auge 5)
 * support in the Foundry VTT MCP Bridge.
 *
 * Philosophy: "Adapter, not Integration"
 * - All DSA5 logic is isolated in this directory
 * - Clean separation from core data-access.ts
 * - Upstream-compatible architecture
 *
 * Usage from data-access.ts:
 * ```typescript
 * import { extractDsa5CharacterData } from './tools/dsa5/index.js';
 *
 * if (game.system.id === 'dsa5') {
 *   characterData.dsa5 = extractDsa5CharacterData(actor);
 * }
 * ```
 */

// ============================================================================
// Type Definitions
// ============================================================================
export type {
  Dsa5Eigenschaft,
  Dsa5StatusValue,
  Dsa5Talent,
  Dsa5Kampftechnik,
  Dsa5CharacterData,
  Dsa5CreatureIndex,
  Dsa5TalentIndex,
  Dsa5SpellIndex,
  Dsa5WeaponIndex,
  Dsa5ArmorIndex,
  Dsa5SpecialAbilityIndex,
} from './types.js';

// ============================================================================
// Field Mappings & Constants
// ============================================================================
export {
  EIGENSCHAFT_NAMES,
  SIZE_MAP_DE_TO_EN,
  SIZE_MAP_EN_TO_DE,
  RESOURCE_TYPES,
  ITEM_TYPES,
  ACTOR_TYPES,
  WOUNDS_HELPER,
  EIGENSCHAFT_HELPER,
  SKILL_GROUPS,
  ADVANCEMENT_CATEGORIES,
  FIELD_PATHS,
} from './field-mappings.js';

// ============================================================================
// Character Import (Read Operations) - PHASE 1 ✅
// ============================================================================
export {
  extractDsa5CharacterData,
  extractDsa5Skills,
  extractDsa5CombatSkills,
  getDsa5CharacterSummary,
} from './character-import.js';

// ============================================================================
// Character Export (Write Operations) - PHASE 4 ⏳
// ============================================================================
export type { MCPCharacterUpdate } from './character-export.js';

export {
  applyMcpUpdateToDsa5Actor,
  validateDsa5Update,
  previewDsa5CharacterUpdate,
} from './character-export.js';

// ============================================================================
// Creature Index (Compendium Search) - PHASE 2 ✅
// ============================================================================
export { buildDsa5CreatureIndex } from './creature-index.js';

// ============================================================================
// Version & Metadata
// ============================================================================
export const DSA5_ADAPTER_VERSION = '0.2.0';
export const DSA5_ADAPTER_PHASE = 'Phase 2 (Character Import + Creature Index)';

/**
 * Check if current Foundry game system is DSA5
 */
export function isDsa5System(): boolean {
  return (game as any)?.system?.id === 'dsa5';
}

/**
 * Get DSA5 system version if available
 */
export function getDsa5SystemVersion(): string | null {
  if (!isDsa5System()) return null;
  return (game as any)?.system?.version || null;
}
