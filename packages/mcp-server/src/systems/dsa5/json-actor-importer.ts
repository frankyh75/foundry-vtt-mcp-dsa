import { promises as fs } from 'node:fs';
import { z } from 'zod';
import { FoundryClient } from '../../foundry-client.js';
import { Logger } from '../../logger.js';
import { ErrorHandler } from '../../utils/error-handler.js';

export interface DSA5JsonActorImporterOptions {
  foundryClient: FoundryClient;
  logger: Logger;
}

type JsonRecord = Record<string, unknown>;

export type DSA5ImportFormat = 'raw_foundry' | 'optolith_like' | 'custom_dsa5' | 'unknown';

export type DSA5ImportStrategy = 'auto' | 'raw_foundry' | 'optolith_like' | 'custom_dsa5';

interface MappingResult {
  actorData: JsonRecord;
  candidateItemNames: string[];
  warnings: string[];
  unmappedFields: string[];
}

const isRecord = (value: unknown): value is JsonRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const toNumber = (value: unknown): number | undefined => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
};

const toStringValue = (value: unknown): string | undefined => {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }
  return undefined;
};

const getByKeys = (source: JsonRecord, keys: string[]): unknown => {
  for (const key of keys) {
    if (key in source) return source[key];
  }
  return undefined;
};

const getNested = (source: JsonRecord, path: string): unknown => {
  const parts = path.split('.');
  let current: unknown = source;
  for (const part of parts) {
    if (!isRecord(current) || !(part in current)) return undefined;
    current = current[part];
  }
  return current;
};

const characteristicAdvance = (value: unknown): number | undefined => {
  const numeric = toNumber(value);
  if (numeric === undefined) return undefined;
  return Math.round(numeric) - 8;
};

const normalizeName = (name: string): string =>
  name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

const uniqueNames = (names: string[]): string[] => {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const name of names) {
    const normalized = normalizeName(name);
    if (normalized.length === 0 || seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(name.trim());
  }
  return result;
};

const sanitizeEmbeddedDocuments = (docs: unknown): JsonRecord[] => {
  if (!Array.isArray(docs)) return [];
  return docs
    .filter((entry): entry is JsonRecord => isRecord(entry))
    .map((entry) => {
      const cloned = { ...entry };
      delete cloned._id;
      delete cloned.folder;
      delete cloned.sort;
      return cloned;
    });
};

export const detectDSA5ImportFormat = (payload: JsonRecord): DSA5ImportFormat => {
  if (isRecord(payload.system) && typeof payload.type === 'string') {
    return 'raw_foundry';
  }

  const attr = payload.attr;
  const optolithLike =
    isRecord(attr) &&
    Array.isArray(attr.values) &&
    (typeof payload.r === 'string' || typeof payload.c === 'string' || typeof payload.p === 'string');
  if (optolithLike) return 'optolith_like';

  const customLike =
    isRecord(payload.attribute) ||
    Array.isArray(payload.vorteile) ||
    Array.isArray(payload.talente) ||
    Array.isArray(payload.kampftechniken);
  if (customLike) return 'custom_dsa5';

  return 'unknown';
};

export const mapCustomDsa5Payload = (payload: JsonRecord): MappingResult => {
  const attribute = isRecord(payload.attribute) ? payload.attribute : {};
  const energien = isRecord(payload.energien) ? payload.energien : {};

  const species = toStringValue(payload.spezies);
  const culture = toStringValue(payload.kultur);
  const profession = toStringValue(payload.profession);
  const socialStatus = toStringValue(payload.sozialstatus);

  const actorData: JsonRecord = {
    name: toStringValue(payload.name) ?? 'Imported DSA5 Character',
    type: 'character',
    system: {
      characteristics: {
        mu: { advances: characteristicAdvance(attribute.mut) ?? 0 },
        kl: { advances: characteristicAdvance(attribute.klugheit) ?? 0 },
        in: { advances: characteristicAdvance(attribute.intuition) ?? 0 },
        ch: { advances: characteristicAdvance(attribute.charisma) ?? 0 },
        ff: { advances: characteristicAdvance(attribute.fingerfertigkeit) ?? 0 },
        ge: { advances: characteristicAdvance(attribute.gewandheit) ?? 0 },
        ko: { advances: characteristicAdvance(attribute.konstitution) ?? 0 },
        kk: {
          advances:
            characteristicAdvance(getByKeys(attribute, ['körperkraft', 'koerperkraft', 'kÃ¶rperkraft'])) ?? 0,
        },
      },
      status: {
        wounds: {
          value: toNumber(energien.lebensenergie) ?? 0,
          max: toNumber(energien.lebensenergie) ?? 0,
        },
        astralenergy: {
          value: toNumber(energien.astralenergie) ?? 0,
          max: toNumber(energien.astralenergie) ?? 0,
        },
        karmaenergy: {
          value: toNumber(energien.karmaenergie) ?? 0,
          max: toNumber(energien.karmaenergie) ?? 0,
        },
        fatePoints: {
          value: toNumber(energien.schicksalspunkte) ?? 0,
          max: toNumber(energien.schicksalspunkte) ?? 0,
        },
      },
      details: {
        species: { value: species ?? '' },
        culture: { value: culture ?? '' },
        career: { value: profession ?? '' },
        socialstate: { value: socialStatus ?? '' },
        experience: {
          total: toNumber(payload.abenteuerpunkteGesammelt) ?? 0,
          spent: toNumber(payload.abenteuerpunkteAusgegeben) ?? 0,
          available: toNumber(payload.abenteuerpunkteGesamt) ?? 0,
        },
      },
    },
  };

  const nameBuckets: string[] = [];
  const pushNames = (value: unknown) => {
    if (!Array.isArray(value)) return;
    for (const entry of value) {
      if (isRecord(entry)) {
        const entryName = toStringValue(entry.name);
        if (entryName) nameBuckets.push(entryName);
      } else if (typeof entry === 'string' && entry.trim().length > 0) {
        nameBuckets.push(entry.trim());
      }
    }
  };

  pushNames(payload.vorteile);
  pushNames(payload.nachteile);
  pushNames(payload.sonderfertigkeiten);
  pushNames(payload.talente);
  pushNames(payload.kampftechniken);
  pushNames(payload.zauberUndLiturgien);
  pushNames(payload.nahkampfwaffen);
  pushNames(payload.fernkampfwaffen);
  pushNames(payload.gegenstände);
  pushNames(payload.sprachen);
  pushNames(payload.schriften);

  const warnings: string[] = [];
  if (!species) warnings.push('No species in payload; actor will be created with empty species field.');
  if (!culture) warnings.push('No culture in payload; actor will be created with empty culture field.');
  if (!profession) warnings.push('No profession in payload; actor will be created with empty profession field.');

  const knownRoots = new Set([
    'uid',
    'grösse',
    'größe',
    'grÃ¶sse',
    'name',
    'geschlecht',
    'spezies',
    'region',
    'kultur',
    'kulturpaket',
    'profession',
    'sozialstatus',
    'abenteuerpunkteGesammelt',
    'abenteuerpunkteAusgegeben',
    'abenteuerpunkteGesamt',
    'hintergrund',
    'attribute',
    'abgeleiteteWerte',
    'energien',
    'vorteile',
    'nachteile',
    'sonderfertigkeiten',
    'berufsgeheimnisse',
    'sprachen',
    'schriften',
    'talente',
    'kampftechniken',
    'zauberUndLiturgien',
    'objektrituale',
    'rüstungen',
    'nahkampfwaffen',
    'fernkampfwaffen',
    'gegenstände',
  ]);

  const unmappedFields = Object.keys(payload).filter((key) => !knownRoots.has(key));

  return {
    actorData,
    candidateItemNames: uniqueNames(nameBuckets),
    warnings,
    unmappedFields,
  };
};

export const mapOptolithLikePayload = (payload: JsonRecord): MappingResult => {
  const attr = isRecord(payload.attr) ? payload.attr : {};
  const details = isRecord(payload.pers) ? payload.pers : {};

  const characteristics: Record<string, { advances: number }> = {
    mu: { advances: 0 },
    kl: { advances: 0 },
    in: { advances: 0 },
    ch: { advances: 0 },
    ff: { advances: 0 },
    ge: { advances: 0 },
    ko: { advances: 0 },
    kk: { advances: 0 },
  };

  const attrValues = Array.isArray(attr.values) ? attr.values : [];
  const mappingKeys = ['mu', 'kl', 'in', 'ch', 'ff', 'ge', 'ko', 'kk'] as const;
  for (const entry of attrValues) {
    if (!isRecord(entry)) continue;
    const idRaw = toStringValue(entry.id);
    const value = toNumber(entry.value);
    if (!idRaw || value === undefined) continue;
    const idParts = idRaw.split('_');
    const idx = Number.parseInt(idParts[idParts.length - 1] ?? '', 10) - 1;
    if (idx >= 0 && idx < mappingKeys.length) {
      characteristics[mappingKeys[idx]] = { advances: Math.round(value) - 8 };
    }
  }

  const actorData: JsonRecord = {
    name: toStringValue(payload.name) ?? 'Imported Optolith Character',
    type: 'character',
    system: {
      characteristics,
      status: {
        wounds: {
          advances: toNumber(attr.lp) ?? 0,
        },
        astralenergy: {
          advances: toNumber(attr.ae) ?? 0,
          permanentLoss: toNumber(getNested(attr, 'permanentAE.lost')) ?? 0,
          rebuy: toNumber(getNested(attr, 'permanentAE.redeemed')) ?? 0,
        },
        karmaenergy: {
          advances: toNumber(attr.kp) ?? 0,
          permanentLoss: toNumber(getNested(attr, 'permanentKP.lost')) ?? 0,
          rebuy: toNumber(getNested(attr, 'permanentKP.redeemed')) ?? 0,
        },
      },
      details: {
        age: { value: toStringValue(details.age) ?? '' },
        gender: { value: toStringValue(payload.sex) ?? '' },
        home: { value: toStringValue(details.placeofbirth) ?? '' },
        family: { value: toStringValue(details.family) ?? '' },
        experience: {
          total: toNumber((isRecord(payload.ap) ? payload.ap.total : undefined)) ?? 0,
        },
      },
    },
  };

  const warnings = [
    'Optolith-like payload detected. This importer currently maps core fields only and skips ID-based item translation.',
  ];

  return {
    actorData,
    candidateItemNames: [],
    warnings,
    unmappedFields: [],
  };
};

const sanitizeActorPayload = (payload: JsonRecord): JsonRecord => {
  const actorData: JsonRecord = { ...payload };

  delete actorData._id;
  delete actorData.folder;
  delete actorData.sort;

  actorData.items = sanitizeEmbeddedDocuments(actorData.items);
  actorData.effects = sanitizeEmbeddedDocuments(actorData.effects);

  if (!actorData.name || typeof actorData.name !== 'string') {
    actorData.name = 'Imported Actor';
  }

  if (!actorData.type || typeof actorData.type !== 'string') {
    actorData.type = 'character';
  }

  if (!isRecord(actorData.system)) {
    actorData.system = {};
  }

  const prototypeToken = isRecord(actorData.prototypeToken) ? actorData.prototypeToken : undefined;
  const texture = prototypeToken && isRecord(prototypeToken.texture) ? prototypeToken.texture : undefined;
  const src = texture && typeof texture.src === 'string' ? texture.src : undefined;
  if (src && src.startsWith('http')) {
    texture!.src = null;
  }

  return actorData;
};

const extractPayload = async (jsonPayload: unknown, filePath: string | undefined): Promise<JsonRecord> => {
  let parsed: unknown = jsonPayload;

  if (!parsed && filePath) {
    const content = await fs.readFile(filePath, 'utf8');
    parsed = JSON.parse(content);
  }

  if (typeof parsed === 'string') {
    parsed = JSON.parse(parsed);
  }

  if (!isRecord(parsed)) {
    throw new Error('Payload must resolve to a JSON object.');
  }

  return parsed;
};

interface ResolvedItemsResult {
  items: JsonRecord[];
  unresolvedNames: string[];
  resolvedCount: number;
}

export class DSA5JsonActorImporter {
  private foundryClient: FoundryClient;
  private logger: Logger;
  private errorHandler: ErrorHandler;

  constructor({ foundryClient, logger }: DSA5JsonActorImporterOptions) {
    this.foundryClient = foundryClient;
    this.logger = logger.child({ component: 'DSA5JsonActorImporter' });
    this.errorHandler = new ErrorHandler(this.logger);
  }

  getToolDefinitions() {
    return [
      {
        name: 'import-dsa5-actor-from-json',
        description:
          'Import a custom DSA5 actor JSON using multiple strategies (auto/custom_dsa5/optolith_like/raw_foundry). Supports file path or inline JSON payload. Best-effort item resolution is performed via compendium name lookup and unresolved entries are returned as warnings.',
        inputSchema: {
          type: 'object',
          properties: {
            jsonPayload: {
              oneOf: [
                { type: 'string' },
                { type: 'object' },
              ],
              description:
                'Inline JSON content as object or string. Optional if filePath is provided.',
            },
            filePath: {
              type: 'string',
              description:
                'Local file path to a JSON file readable by the MCP server process. Optional if jsonPayload is provided.',
            },
            strategy: {
              type: 'string',
              enum: ['auto', 'custom_dsa5', 'optolith_like', 'raw_foundry'],
              default: 'auto',
              description:
                'Import strategy. auto detects format and chooses mapping path.',
            },
            resolveItems: {
              type: 'boolean',
              default: true,
              description:
                'Try resolving item-like entries by name from compendiums and embed them into the created actor.',
            },
            addToScene: {
              type: 'boolean',
              default: false,
              description: 'Add created actor to active scene as token.',
            },
            strict: {
              type: 'boolean',
              default: false,
              description:
                'If true, unresolved item names abort the import instead of returning warnings.',
            },
          },
        },
      },
    ];
  }

  async handleImportActorFromJson(args: unknown): Promise<Record<string, unknown>> {
    const schema = z
      .object({
        jsonPayload: z.union([z.string(), z.record(z.unknown())]).optional(),
        filePath: z.string().optional(),
        strategy: z.enum(['auto', 'custom_dsa5', 'optolith_like', 'raw_foundry']).default('auto'),
        resolveItems: z.boolean().default(true),
        addToScene: z.boolean().default(false),
        strict: z.boolean().default(false),
      })
      .refine((value) => Boolean(value.jsonPayload) || Boolean(value.filePath), {
        message: 'Either jsonPayload or filePath is required.',
      });

    const { jsonPayload, filePath, strategy, resolveItems, addToScene, strict } = schema.parse(args);

    try {
      const payload = await extractPayload(jsonPayload, filePath);
      const detectedFormat = detectDSA5ImportFormat(payload);
      const selectedFormat = strategy === 'auto' ? detectedFormat : strategy;

      let mappingResult: MappingResult;
      switch (selectedFormat) {
        case 'raw_foundry':
          mappingResult = {
            actorData: sanitizeActorPayload(payload),
            candidateItemNames: [],
            warnings: [],
            unmappedFields: [],
          };
          break;
        case 'optolith_like':
          mappingResult = mapOptolithLikePayload(payload);
          break;
        case 'custom_dsa5':
          mappingResult = mapCustomDsa5Payload(payload);
          break;
        default:
          throw new Error(
            `Could not detect supported JSON format. Detected format: ${detectedFormat}. Use strategy override if needed.`
          );
      }

      const warnings = [...mappingResult.warnings];
      const unresolvedItemNames: string[] = [];

      if (resolveItems && mappingResult.candidateItemNames.length > 0) {
        const resolved = await this.resolveItemsByName(mappingResult.candidateItemNames);
        unresolvedItemNames.push(...resolved.unresolvedNames);
        if (resolved.items.length > 0) {
          const existingItems = Array.isArray(mappingResult.actorData.items)
            ? sanitizeEmbeddedDocuments(mappingResult.actorData.items)
            : [];
          mappingResult.actorData.items = [...existingItems, ...resolved.items];
        }

        if (resolved.unresolvedNames.length > 0) {
          warnings.push(
            `Unresolved item names (${resolved.unresolvedNames.length}): ${resolved.unresolvedNames.join(', ')}`
          );
        }
      }

      if (strict && unresolvedItemNames.length > 0) {
        throw new Error(
          `Strict import aborted because ${unresolvedItemNames.length} item names could not be resolved.`
        );
      }

      const creationResult = await this.foundryClient.query('foundry-mcp-bridge.createActorFromData', {
        actorData: sanitizeActorPayload(mappingResult.actorData),
        addToScene,
      });

      const actor = isRecord(creationResult) && isRecord(creationResult.actor)
        ? creationResult.actor
        : {};

      return {
        success: true,
        summary: `Imported actor "${String(actor.name ?? mappingResult.actorData.name)}" using ${selectedFormat}.`,
        import: {
          selectedFormat,
          detectedFormat,
          strategy,
          resolveItems,
          strict,
          source: filePath ? `file:${filePath}` : 'jsonPayload',
        },
        actor,
        warnings,
        unmappedFields: mappingResult.unmappedFields,
        unresolvedItemNames,
        message:
          `Import completed via ${selectedFormat}.\n` +
          `Warnings: ${warnings.length}\n` +
          `Unmapped root fields: ${mappingResult.unmappedFields.length}`,
      };
    } catch (error) {
      this.errorHandler.handleToolError(error, 'import-dsa5-actor-from-json', 'JSON import');
    }
  }

  private async resolveItemsByName(itemNames: string[]): Promise<ResolvedItemsResult> {
    const unique = uniqueNames(itemNames).slice(0, 120);
    const resolvedItems: JsonRecord[] = [];
    const unresolved: string[] = [];

    for (const candidateName of unique) {
      try {
        const searchResponse = await this.foundryClient.query('foundry-mcp-bridge.searchCompendium', {
          query: candidateName,
          packType: 'Item',
        });

        if (!Array.isArray(searchResponse) || searchResponse.length === 0) {
          unresolved.push(candidateName);
          continue;
        }

        const exact = searchResponse.find((entry: unknown) => {
          if (!isRecord(entry)) return false;
          const name = toStringValue(entry.name);
          if (!name) return false;
          return normalizeName(name) === normalizeName(candidateName);
        });

        const selected = (exact ?? searchResponse[0]) as unknown;
        if (!isRecord(selected)) {
          unresolved.push(candidateName);
          continue;
        }

        const packId = toStringValue(selected.pack);
        const itemId = toStringValue(selected.id);
        if (!packId || !itemId) {
          unresolved.push(candidateName);
          continue;
        }

        const full = await this.foundryClient.query('foundry-mcp-bridge.getCompendiumDocumentFull', {
          packId,
          documentId: itemId,
        });

        if (!isRecord(full) || !isRecord(full.fullData)) {
          unresolved.push(candidateName);
          continue;
        }

        const itemData = sanitizeEmbeddedDocuments([full.fullData])[0];
        if (!itemData) {
          unresolved.push(candidateName);
          continue;
        }

        resolvedItems.push(itemData);
      } catch (error) {
        this.logger.warn('Item resolution failed during import', {
          candidateName,
          error: error instanceof Error ? error.message : String(error),
        });
        unresolved.push(candidateName);
      }
    }

    return {
      items: resolvedItems,
      unresolvedNames: unresolved,
      resolvedCount: resolvedItems.length,
    };
  }
}
