/**
 * DSA5 Token Adapter
 *
 * Handles DSA5-specific token manipulation, condition handling, and token property access.
 * This adapter encapsulates all DSA5-specific logic for token operations, keeping core files system-agnostic.
 */

import { Logger } from '../../logger.js';

export interface TokenDetails {
  id: string;
  name: string;
  x: number | undefined;
  y: number | undefined;
  width: number | undefined;
  height: number | undefined;
  rotation: number | undefined;
  scale: number;
  alpha: number;
  hidden: boolean;
  disposition: number;
  elevation: number;
  lockRotation: boolean;
  img: string | undefined;
  actorId: string | undefined;
  actorData: any | null;
  actorLink: boolean;
}

export interface ConditionEffectData {
  name: string;
  icon?: string;
  statuses?: string[];
  flags?: any;
  changes?: any[];
  duration?: any;
  origin?: string;
  transfer?: boolean;
  disabled?: boolean;
}

/**
 * DSA5-specific token manipulation adapter
 */
export class DSA5TokenAdapter {
  private logger: Logger;

  constructor(logger?: Logger) {
    this.logger = logger || new Logger({ level: 'info' });
  }

  /**
   * Format a DSA5 condition into an ActiveEffect data structure
   *
   * DSA5 conditions have a different structure than D&D5e/PF2e:
   * - No duration.auto property (causes errors if copied directly)
   * - Uses flags, changes, transfer, and disabled properties
   * - Conditions are simpler and don't have complex duration tracking
   *
   * @param condition - DSA5 condition from CONFIG.statusEffects
   * @returns ActiveEffect data ready for createEmbeddedDocuments
   */
  formatConditionEffect(condition: any): ConditionEffectData {
    const effectData: ConditionEffectData = {
      name: condition.name || condition.label || condition.id,
      icon: condition.icon || condition.img,
    };

    // Add statuses for Foundry's status tracking
    if (condition.id) {
      effectData.statuses = [condition.id];
    }

    // DSA5-specific: Copy properties that exist
    // IMPORTANT: DO NOT copy duration for DSA5 - it causes .auto errors
    // Foundry will use its default duration handling for DSA5

    if (condition.flags) {
      effectData.flags = condition.flags;
    }

    if (condition.changes && Array.isArray(condition.changes)) {
      effectData.changes = condition.changes;
    }

    // Skip duration property entirely for DSA5
    // DSA5 uses a different system and copying duration causes ".auto" errors
    // Foundry will use default duration handling for DSA5

    if (condition.origin) {
      effectData.origin = condition.origin;
    }

    // DSA5-specific properties
    if (condition.transfer !== undefined) {
      effectData.transfer = condition.transfer;
    }

    if (condition.disabled !== undefined) {
      effectData.disabled = condition.disabled;
    }

    this.logger.debug('Formatted DSA5 condition effect', {
      conditionId: condition.id,
      hasFlags: !!effectData.flags,
      hasChanges: !!effectData.changes,
      hasDuration: false, // Always false for DSA5
    });

    return effectData;
  }

  /**
   * Extract token properties from a DSA5 token document
   *
   * DSA5/Foundry v13+ token structure can vary - properties may be on:
   * - token directly (token.x, token.y)
   * - token.document (token.document.x)
   * - nested objects (token.texture.src)
   *
   * This method handles all access patterns safely with fallbacks.
   *
   * @param token - Foundry token document
   * @returns Token details with DSA5-specific extraction logic
   */
  getTokenProperties(token: any): TokenDetails {
    // Helper to safely get token properties - try direct access first, then fallback to nested
    const getTokenProp = (prop: string, fallbackObj?: string): any => {
      if (token[prop] !== undefined) return token[prop];
      if (fallbackObj && token[fallbackObj]?.[prop] !== undefined) {
        return token[fallbackObj][prop];
      }
      return undefined;
    };

    // Get texture/appearance data
    const texture = token.texture || {};
    const img = texture.src || token.img;
    const scale = texture.scaleX !== undefined ? texture.scaleX : (token.scale !== undefined ? token.scale : 1);

    const details: TokenDetails = {
      id: token.id || token._id,
      name: token.name,
      x: getTokenProp('x'),
      y: getTokenProp('y'),
      width: getTokenProp('width'),
      height: getTokenProp('height'),
      rotation: getTokenProp('rotation'),
      scale: scale,
      alpha: getTokenProp('alpha') !== undefined ? getTokenProp('alpha') : 1,
      hidden: getTokenProp('hidden') !== undefined ? getTokenProp('hidden') : false,
      disposition: getTokenProp('disposition') !== undefined ? getTokenProp('disposition') : 0,
      elevation: getTokenProp('elevation') !== undefined ? getTokenProp('elevation') : 0,
      lockRotation: getTokenProp('lockRotation') !== undefined ? getTokenProp('lockRotation') : false,
      img: img,
      actorId: token.actor?.id || token.actorId,
      actorData: token.actor ? {
        name: token.actor.name,
        type: token.actor.type,
        img: token.actor.img,
      } : null,
      actorLink: getTokenProp('actorLink') !== undefined ? getTokenProp('actorLink') : false,
    };

    this.logger.debug('Extracted DSA5 token properties', {
      tokenId: details.id,
      hasPosition: details.x !== undefined && details.y !== undefined,
      hasSize: details.width !== undefined && details.height !== undefined,
      hasActor: !!details.actorData,
    });

    return details;
  }

  /**
   * Check if a token should be visible based on DSA5-specific rules
   * (Currently just wraps default Foundry logic, but can be extended for DSA5-specific visibility rules)
   *
   * @param token - Token document
   * @param user - User document
   * @returns Whether token should be visible to user
   */
  isTokenVisible(token: any, user: any): boolean {
    // DSA5 uses standard Foundry visibility rules
    // Could be extended with DSA5-specific rules (e.g., special vision types)
    return !token.hidden || user.isGM;
  }

  /**
   * Get DSA5-specific condition matching logic
   *
   * DSA5 conditions can be matched by:
   * - Status ID (standard)
   * - Name (case-insensitive)
   * - Label (some DSA5 conditions use label instead of name)
   *
   * @param effect - ActiveEffect on actor
   * @param conditionId - Condition ID to match
   * @returns Whether effect matches the condition
   */
  matchesCondition(effect: any, conditionId: string): boolean {
    // Check by status (standard)
    if (effect.statuses?.has(conditionId)) {
      return true;
    }

    // Check by name (case-insensitive, DSA5 fallback)
    if (effect.name?.toLowerCase() === conditionId.toLowerCase()) {
      return true;
    }

    // Check by label (some DSA5 conditions use label)
    if (effect.label?.toLowerCase() === conditionId.toLowerCase()) {
      return true;
    }

    return false;
  }
}
