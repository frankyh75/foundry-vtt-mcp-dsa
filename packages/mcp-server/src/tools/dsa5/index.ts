/**
 * DSA5 Character Tools - Public API
 *
 * System-agnostic character import/export for DSA5 actors.
 * Follows the Adapter Pattern to keep DSA5 logic isolated from core.
 *
 * Usage:
 * ```typescript
 * import { fromDsa5Actor, getDsa5CharacterSummary } from './tools/dsa5';
 *
 * const result = fromDsa5Actor(foundryActor);
 * if (result.success) {
 *   console.log(result.character);
 * }
 * ```
 */

// Type exports
export type {
  MCPCharacter,
  MCPCharacterUpdate,
  Dsa5Actor,
  CharacterImportResult,
  CharacterExportResult,
} from './types.js';

// Import functions
export {
  fromDsa5Actor,
  getDsa5CharacterSummary,
  extractCharacterIds,
} from './character-import.js';

// Export functions
export {
  applyMcpUpdateToDsa5Actor,
  buildFoundryUpdateObject,
  validateMcpUpdate,
  calculateNewWounds,
} from './character-export.js';
