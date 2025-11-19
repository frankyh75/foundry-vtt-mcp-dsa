import { z } from 'zod';
import { FoundryClient } from '../foundry-client.js';
import { Logger } from '../logger.js';

export interface CharacterToolsOptions {
  foundryClient: FoundryClient;
  logger: Logger;
}

export class CharacterTools {
  private foundryClient: FoundryClient;
  private logger: Logger;

  constructor({ foundryClient, logger }: CharacterToolsOptions) {
    this.foundryClient = foundryClient;
    this.logger = logger.child({ component: 'CharacterTools' });
  }

  /**
   * Tool: get-character
   * Retrieve detailed information about a specific character
   */

  
  getToolDefinitions() {
    return [
      {
        name: 'get-character',
        description: 'Retrieve detailed information about a specific character by name or ID',
        inputSchema: {
          type: 'object',
          properties: {
            identifier: {
              type: 'string',
              description: 'Character name or ID to look up',
            },
          },
          required: ['identifier'],
        },
      },
      {
        name: 'list-characters',
        description: 'List all available characters with basic information',
        inputSchema: {
          type: 'object',
          properties: {
            type: {
              type: 'string',
              description: 'Optional filter by character type (e.g., "character", "npc")',
            },
          },
        },
      },
    ];
  }

  async handleGetCharacter(args: any): Promise<any> {
    const schema = z.object({
      identifier: z.string().min(1, 'Character identifier cannot be empty'),
    });

    const { identifier } = schema.parse(args);

    this.logger.info('Getting character information', { identifier });

    try {
      const characterData = await this.foundryClient.query('foundry-mcp-bridge.getCharacterInfo', {
        characterName: identifier,
      });

      // 🟣 DSA5 DEBUG: Prüfe ob dsa5 Objekt ankommt
      console.log("[DSA DEBUG][MCP-SERVER] Received character from Foundry:", {
        id: characterData.id,
        name: characterData.name,
        hasDsa5: !!characterData.dsa5,
        dsa5Keys: characterData.dsa5 ? Object.keys(characterData.dsa5) : null,
        dsa5Data: characterData.dsa5,
      });

      this.logger.debug('Successfully retrieved character data', { 
        characterId: characterData.id,
        characterName: characterData.name 
      });

      // Format the response for Claude
      const formattedResponse = this.formatCharacterResponse(characterData);
      
      // 🟣 DSA5 DEBUG: Prüfe formatierte Response
      console.log("[DSA DEBUG][MCP-SERVER] Formatted response:", {
        hasBasicInfo: !!formattedResponse.basicInfo,
        basicInfoKeys: formattedResponse.basicInfo ? Object.keys(formattedResponse.basicInfo) : null,
        hasStats: !!formattedResponse.stats,
        statsKeys: formattedResponse.stats ? Object.keys(formattedResponse.stats) : null,
      });

      return formattedResponse;

    } catch (error) {
      this.logger.error('Failed to get character information', error);
      throw new Error(`Failed to retrieve character "${identifier}": ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async handleListCharacters(args: any): Promise<any> {
    const schema = z.object({
      type: z.string().optional(),
    });

    const { type } = schema.parse(args);

    this.logger.info('Listing characters', { type });

    try {
      const actors = await this.foundryClient.query('foundry-mcp-bridge.listActors', { type });

      this.logger.debug('Successfully retrieved character list', { count: actors.length });

      // Format the response for Claude
      return {
        characters: actors.map((actor: any) => ({
          id: actor.id,
          name: actor.name,
          type: actor.type,
          hasImage: !!actor.img,
        })),
        total: actors.length,
        filtered: type ? `Filtered by type: ${type}` : 'All characters',
      };

    } catch (error) {
      this.logger.error('Failed to list characters', error);
      throw new Error(`Failed to list characters: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private formatCharacterResponse(characterData: any): any {
    const response = {
      id: characterData.id,
      name: characterData.name,
      type: characterData.type,
      basicInfo: this.extractBasicInfo(characterData),
      stats: this.extractStats(characterData),
      items: this.formatItems(characterData.items || []),
      effects: this.formatEffects(characterData.effects || []),
      dsa5: characterData.dsa5,  // 🟣 DSA 5 specific data
      hasImage: !!characterData.img,
    };

    return response;
  }

  private extractBasicInfo(characterData: any): any {
    const system = characterData.system || {};
    const basicInfo: any = {};

    // DSA 5 Status values
    if (system.status) {
      // LeP (Lebensenergie)
      if (system.status.wounds) {
        basicInfo.lebensenergie = {
          current: system.status.wounds.value || 0,
          max: system.status.wounds.max || 0,
          label: 'LeP'
        };
      }

      // AsP (Astralenergie)
      if (system.status.astralenergy) {
        basicInfo.astralenergie = {
          current: system.status.astralenergy.value || 0,
          max: system.status.astralenergy.max || 0,
          label: 'AsP'
        };
      }

      // KaP (Karmaenergie)
      if (system.status.karmaenergy) {
        basicInfo.karmaenergie = {
          current: system.status.karmaenergy.value || 0,
          max: system.status.karmaenergy.max || 0,
          label: 'KaP'
        };
      }

      // Geschwindigkeit
      if (system.status.speed) {
        basicInfo.geschwindigkeit = system.status.speed.value || 8;
      }

      // Ausweichen
      if (system.status.dodge) {
        basicInfo.ausweichen = system.status.dodge.value || 0;
      }

      // Initiative
      if (system.status.initiative) {
        basicInfo.initiative = system.status.initiative.value || 0;
      }
    }

    // Details (Spezies, Kultur, Profession)
    if (system.details) {
      if (system.details.species) {
        basicInfo.spezies = system.details.species.value || 'Unbekannt';
      }
      if (system.details.culture) {
        basicInfo.kultur = system.details.culture.value || 'Unbekannt';
      }
      if (system.details.profession) {
        basicInfo.profession = system.details.profession.value || 'Unbekannt';
      }
      
      // Abenteuerpunkte
      if (system.details.experience) {
        basicInfo.abenteuerpunkte = {
          gesamt: system.details.experience.total || 0,
          ausgegeben: system.details.experience.spent || 0,
          verfügbar: system.details.experience.current || 0
        };
      }
    }

    // Fallback für D&D 5e / PF2e
    if (system.attributes) {
      if (system.attributes.hp) {
        basicInfo.hitPoints = {
          current: system.attributes.hp.value,
          max: system.attributes.hp.max,
          temp: system.attributes.hp.temp || 0,
        };
      }
      if (system.attributes.ac) {
        basicInfo.armorClass = system.attributes.ac.value;
      }
    }

    // Level information (D&D/PF2e)
    if (system.details?.level?.value) {
      basicInfo.level = system.details.level.value;
    } else if (system.level) {
      basicInfo.level = system.level;
    }

    // Class information (D&D)
    if (system.details?.class) {
      basicInfo.class = system.details.class;
    }

    // Race/ancestry information (D&D/PF2e)
    if (system.details?.race) {
      basicInfo.race = system.details.race;
    } else if (system.details?.ancestry) {
      basicInfo.ancestry = system.details.ancestry;
    }

    return basicInfo;
  }

/**
 * Berechnet den Gesamtwert einer DSA5-Eigenschaft
 * Gesamtwert = initial + species + modifier + advances
 */
private calculateCharacteristic(char: any): number {
  if (!char) return 8;
  const initial = char.initial || 8;
  const species = char.species || 0;
  const modifier = char.modifier || 0;
  const advances = char.advances || 0;
  return initial + species + modifier + advances;
}

  private extractStats(characterData: any): any {
  const system = characterData.system || {};
  const stats: any = {};

  // DSA 5 Eigenschaften (Characteristics)
  if (system.characteristics) {
    stats.eigenschaften = {
      MU: {
        wert: this.calculateCharacteristic(system.characteristics.mu),
        initial: system.characteristics.mu?.initial || 8,
        species: system.characteristics.mu?.species || 0,
        modifier: system.characteristics.mu?.modifier || 0,
        advances: system.characteristics.mu?.advances || 0,
        name: 'Mut'
      },
      KL: {
        wert: this.calculateCharacteristic(system.characteristics.kl),
        initial: system.characteristics.kl?.initial || 8,
        species: system.characteristics.kl?.species || 0,
        modifier: system.characteristics.kl?.modifier || 0,
        advances: system.characteristics.kl?.advances || 0,
        name: 'Klugheit'
      },
      IN: {
        wert: this.calculateCharacteristic(system.characteristics.in),
        initial: system.characteristics.in?.initial || 8,
        species: system.characteristics.in?.species || 0,
        modifier: system.characteristics.in?.modifier || 0,
        advances: system.characteristics.in?.advances || 0,
        name: 'Intuition'
      },
      CH: {
        wert: this.calculateCharacteristic(system.characteristics.ch),
        initial: system.characteristics.ch?.initial || 8,
        species: system.characteristics.ch?.species || 0,
        modifier: system.characteristics.ch?.modifier || 0,
        advances: system.characteristics.ch?.advances || 0,
        name: 'Charisma'
      },
      FF: {
        wert: this.calculateCharacteristic(system.characteristics.ff),
        initial: system.characteristics.ff?.initial || 8,
        species: system.characteristics.ff?.species || 0,
        modifier: system.characteristics.ff?.modifier || 0,
        advances: system.characteristics.ff?.advances || 0,
        name: 'Fingerfertigkeit'
      },
      GE: {
        wert: this.calculateCharacteristic(system.characteristics.ge),
        initial: system.characteristics.ge?.initial || 8,
        species: system.characteristics.ge?.species || 0,
        modifier: system.characteristics.ge?.modifier || 0,
        advances: system.characteristics.ge?.advances || 0,
        name: 'Gewandtheit'
      },
      KO: {
        wert: this.calculateCharacteristic(system.characteristics.ko),
        initial: system.characteristics.ko?.initial || 8,
        species: system.characteristics.ko?.species || 0,
        modifier: system.characteristics.ko?.modifier || 0,
        advances: system.characteristics.ko?.advances || 0,
        name: 'Konstitution'
      },
      KK: {
        wert: this.calculateCharacteristic(system.characteristics.kk),
        initial: system.characteristics.kk?.initial || 8,
        species: system.characteristics.kk?.species || 0,
        modifier: system.characteristics.kk?.modifier || 0,
        advances: system.characteristics.kk?.advances || 0,
        name: 'Körperkraft'
      }
    };
  }

  // Fallback: D&D 5e Ability scores
  if (system.abilities) {
    stats.abilities = {};
    for (const [key, ability] of Object.entries(system.abilities)) {
      if (typeof ability === 'object' && ability !== null) {
        stats.abilities[key] = {
          score: (ability as any).value || 10,
          modifier: (ability as any).mod || 0,
        };
      }
    }
  }

  // Fallback: D&D Skills
  if (system.skills) {
    stats.skills = {};
    for (const [key, skill] of Object.entries(system.skills)) {
      if (typeof skill === 'object' && skill !== null) {
        stats.skills[key] = {
          value: (skill as any).value || 0,
          proficient: (skill as any).proficient || false,
          ability: (skill as any).ability || '',
        };
      }
    }
  }

  // Fallback: D&D Saves
  if (system.saves) {
    stats.saves = {};
    for (const [key, save] of Object.entries(system.saves)) {
      if (typeof save === 'object' && save !== null) {
        stats.saves[key] = {
          value: (save as any).value || 0,
          proficient: (save as any).proficient || false,
        };
      }
    }
  }

  return stats;
}

  private formatItems(items: any[]): any[] {
    return items.slice(0, 50).map(item => { // Erhöht auf 50 für DSA 5 (viele Talente)
      const formattedItem: any = {
        id: item.id,
        name: item.name,
        type: item.type,
        hasImage: !!item.img,
      };

      // DSA 5 Talent
      if (item.type === 'skill') {
        const system = item.system || {};
        formattedItem.talentwert = system.talentValue?.value || 0;
        formattedItem.eigenschaften = [
          system.characteristic1?.value || '',
          system.characteristic2?.value || '',
          system.characteristic3?.value || ''
        ];
        formattedItem.kategorie = system.category?.value || '';
        formattedItem.steigerungsfaktor = system.StF?.value || '';
      }

      // DSA 5 Zauber
      else if (item.type === 'spell') {
        const system = item.system || {};
        formattedItem.zauberfertigkeit = system.talentValue?.value || 0;
        formattedItem.eigenschaften = [
          system.characteristic1?.value || '',
          system.characteristic2?.value || '',
          system.characteristic3?.value || ''
        ];
        formattedItem.aspKosten = system.AsPCost?.value || '0';
        formattedItem.zauberdauer = system.castingTime?.value || '';
        formattedItem.reichweite = system.range?.value || '';
      }

      // DSA 5 Liturgie
      else if (item.type === 'liturgy') {
        const system = item.system || {};
        formattedItem.liturgiewert = system.talentValue?.value || 0;
        formattedItem.eigenschaften = [
          system.characteristic1?.value || '',
          system.characteristic2?.value || '',
          system.characteristic3?.value || ''
        ];
        formattedItem.kapKosten = system.KaPCost?.value || '0';
        formattedItem.liturgiedauer = system.castingTime?.value || '';
      }

      // DSA 5 Kampftechnik
      else if (item.type === 'combatskill') {
        const system = item.system || {};
        formattedItem.at = system.at?.value || 6;
        formattedItem.pa = system.pa?.value || 6;
      }

      // DSA 5 Waffe
      else if (item.type === 'meleeweapon' || item.type === 'rangeweapon') {
        const system = item.system || {};
        formattedItem.kampftechnik = system.combatskill?.value || '';
        formattedItem.schaden = system.damage?.value || '';
        formattedItem.reichweite = system.reach?.value || '';
      }

      // DSA 5 Rüstung
      else if (item.type === 'armor') {
        const system = item.system || {};
        formattedItem.schutz = system.protection?.value || 0;
        formattedItem.behinderung = system.encumbrance?.value || 0;
      }

      // DSA 5 Vorteil/Nachteil
      else if (item.type === 'advantage' || item.type === 'disadvantage') {
        const system = item.system || {};
        formattedItem.apKosten = system.APValue?.value || '0';
        formattedItem.stufe = system.step?.value || 1;
      }

      // DSA 5 Sonderfertigkeit
      else if (item.type === 'specialability') {
        const system = item.system || {};
        formattedItem.apKosten = system.APValue?.value || '0';
        formattedItem.kategorie = system.category?.value || '';
      }

      // Allgemeine Items
      else {
        formattedItem.quantity = item.system?.quantity || 1;
        formattedItem.description = this.truncateText(item.system?.description?.value || '', 200);
      }

      return formattedItem;
    });
  }

  private formatEffects(effects: any[]): any[] {
    return effects.map(effect => ({
      id: effect.id,
      name: effect.name,
      disabled: effect.disabled,
      duration: effect.duration ? {
        type: effect.duration.type,
        remaining: effect.duration.remaining,
      } : null,
      hasIcon: !!effect.icon,
    }));
  }

  private truncateText(text: string, maxLength: number): string {
    if (!text || text.length <= maxLength) {
      return text;
    }
    return text.substring(0, maxLength - 3) + '...';
  }
}