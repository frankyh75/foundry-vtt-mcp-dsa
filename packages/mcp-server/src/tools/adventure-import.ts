import { readFileSync } from 'fs';
import { resolve } from 'path';
import { z } from 'zod';
import type { FoundryClient } from '../foundry-client.js';
import type { Logger } from '../logger.js';
import { adventureImportSchema } from '../adventure-import/schema.js';
import type { AdventureImportPayload } from '../adventure-import/types.js';
import { AdventureImportWorker } from '../adventure-import/llm-worker.js';
import { FoundryAdventureImporter } from '../adventure-import/foundry-importer.js';
import { chunkAdventureText, normalizeAdventureText } from '../adventure-import/text-normalizer.js';

export interface AdventureImportToolsOptions {
  foundryClient: FoundryClient;
  logger: Logger;
  worker?: AdventureImportWorker;
  importer?: FoundryAdventureImporter;
}

export class AdventureImportTools {
  private readonly foundryClient: FoundryClient;
  private readonly logger: Logger;
  private readonly worker: AdventureImportWorker;
  private readonly importer: FoundryAdventureImporter;

  constructor(options: AdventureImportToolsOptions) {
    this.foundryClient = options.foundryClient;
    this.logger = options.logger.child({ component: 'AdventureImportTools' });
    this.worker = options.worker ?? new AdventureImportWorker();
    this.importer = options.importer ?? new FoundryAdventureImporter(this.foundryClient, this.logger);
  }

  getToolDefinitions() {
    return [
      {
        name: 'import-dsa5-adventure-from-file',
        description: 'Import a DSA5 adventure from a local JSON file. The file must contain a valid adventure payload matching the adventure schema. The LLM only needs to provide the file path.',
        inputSchema: {
          type: 'object',
          properties: {
            filePath: {
              type: 'string',
              description: 'Absolute or relative path to the JSON file containing the adventure payload',
            },
            mode: {
              type: 'string',
              enum: ['dry-run', 'import'],
              description: 'Dry-run creates a preview only; import writes data into Foundry',
              default: 'dry-run',
            },
            createActors: {
              type: 'boolean',
              description: 'Create Actors for NPCs (default: true)',
              default: true,
            },
            createJournals: {
              type: 'boolean',
              description: 'Create Journal entries/pages for the adventure (default: true)',
              default: true,
            },
            linkNpcs: {
              type: 'boolean',
              description: 'Add link references between Journal content and created Actors (default: true)',
              default: true,
            },
            sections: {
              type: 'array',
              items: {
                type: 'string',
                enum: ['scenes', 'npcs', 'items', 'journal', 'all'],
              },
              description: 'Which sections to import. Default: ["all"]',
              default: ['all'],
            },
          },
          required: ['filePath'],
        },
      },
      {
        name: 'import-dsa5-adventure-chunk',
        description: 'Import a single chunk of adventure data (one scene, one NPC, one journal entry). Use for incremental imports when the full adventure JSON is too large.',
        inputSchema: {
          type: 'object',
          properties: {
            type: {
              type: 'string',
              enum: ['scene', 'npc', 'item', 'journal', 'combat'],
              description: 'Type of chunk to import',
            },
            data: {
              type: 'object',
              description: 'The chunk data object — must match the adventure schema for this type',
            },
            mode: {
              type: 'string',
              enum: ['dry-run', 'import'],
              description: 'Dry-run creates a preview only; import writes data into Foundry',
              default: 'dry-run',
            },
            createActors: {
              type: 'boolean',
              description: 'For NPC chunks: create Actor (default: true)',
              default: true,
            },
            createJournals: {
              type: 'boolean',
              description: 'For scene/journal chunks: create Journal entry (default: true)',
              default: true,
            },
            linkNpcs: {
              type: 'boolean',
              description: 'Add link references (default: true)',
              default: true,
            },
          },
          required: ['type', 'data'],
        },
      },
    ];
  }

  async handleImportAdventureFromFile(args: unknown): Promise<any> {
    const requestSchema = z.object({
      filePath: z.string().min(1, 'filePath is required'),
      mode: z.enum(['dry-run', 'import']).default('dry-run'),
      createActors: z.boolean().default(true),
      createJournals: z.boolean().default(true),
      linkNpcs: z.boolean().default(true),
      sections: z.array(z.enum(['scenes', 'npcs', 'items', 'journal', 'all'])).default(['all']),
    });

    const request = requestSchema.parse(args);
    const resolvedPath = resolve(request.filePath);

    this.logger.info('Adventure import from file requested', {
      filePath: resolvedPath,
      mode: request.mode,
      sections: request.sections,
    });

    // Read and parse JSON file
    let fileContent: string;
    try {
      fileContent = readFileSync(resolvedPath, 'utf-8');
    } catch (error) {
      this.logger.error('Failed to read adventure file', { filePath: resolvedPath, error });
      throw new Error(`Cannot read file at ${resolvedPath}: ${(error as Error).message}`);
    }

    let parsedPayload: unknown;
    try {
      parsedPayload = JSON.parse(fileContent);
    } catch (error) {
      this.logger.error('Failed to parse adventure JSON', { filePath: resolvedPath, error });
      throw new Error(`Invalid JSON in file ${resolvedPath}: ${(error as Error).message}`);
    }

    // Validate against schema
    const validated = adventureImportSchema.parse(parsedPayload) as AdventureImportPayload;

    // Filter sections if requested
    if (!request.sections.includes('all')) {
      if (!request.sections.includes('scenes')) {
        validated.scenes = [];
      }
      if (!request.sections.includes('npcs')) {
        validated.npcs = [];
      }
      if (!request.sections.includes('items')) {
        validated.items = [];
      }
      if (!request.sections.includes('journal')) {
        validated.journal = [];
      }
    }

    const importerOptions = {
      createActors: request.createActors,
      createJournals: request.createJournals,
      linkNpcs: request.linkNpcs,
    };

    if (request.mode === 'dry-run') {
      const preview = await this.importer.dryRun(validated, importerOptions);
      return {
        success: true,
        mode: 'dry-run',
        title: validated.metadata.title,
        filePath: resolvedPath,
        extractedWarnings: validated.warnings ?? [],
        plan: preview.plan,
        summary: preview.summary,
        warnings: preview.warnings,
        unresolvedReferences: preview.unresolvedReferences,
        createdEntityIds: preview.createdEntityIds,
      };
    }

    const result = await this.importer.importAdventure(validated, importerOptions);
    return {
      success: result.success,
      mode: result.mode,
      title: result.title,
      filePath: resolvedPath,
      summary: result.summary,
      warnings: result.warnings,
      unresolvedReferences: result.unresolvedReferences,
      createdEntityIds: result.createdEntityIds,
      journal: result.journal,
      actors: result.actors,
      plan: result.plan,
    };
  }

  async handleImportAdventureChunk(args: unknown): Promise<any> {
    const requestSchema = z.object({
      type: z.enum(['scene', 'npc', 'item', 'journal', 'combat']),
      data: z.record(z.any()),
      mode: z.enum(['dry-run', 'import']).default('dry-run'),
      createActors: z.boolean().default(true),
      createJournals: z.boolean().default(true),
      linkNpcs: z.boolean().default(true),
    });

    const request = requestSchema.parse(args);

    this.logger.info('Adventure chunk import requested', {
      type: request.type,
      mode: request.mode,
    });

    // Build a minimal payload from the chunk
    const chunkPayload: AdventureImportPayload = {
      metadata: {
        title: `Chunk: ${request.type}`,
        type: 'chunk',
        language: 'de',
        // Additional metadata fields via passthrough
        genre: '',
        complexity: '',
        playerCount: '',
        locations: [],
        timeframe: '',
        description: '',
      } as any,
      scenes: request.type === 'scene' ? [request.data as any] : [],
      npcs: request.type === 'npc' ? [request.data as any] : [],
      items: request.type === 'item' ? [request.data as any] : [],
      locations: [],
      journal: request.type === 'journal' ? [request.data as any] : [],
      combatEncounters: request.type === 'combat' ? [request.data as any] : [],
    };

    const validated = adventureImportSchema.parse(chunkPayload) as AdventureImportPayload;

    const importerOptions = {
      createActors: request.createActors,
      createJournals: request.createJournals,
      linkNpcs: request.linkNpcs,
    };

    if (request.mode === 'dry-run') {
      const preview = await this.importer.dryRun(validated, importerOptions);
      return {
        success: true,
        mode: 'dry-run',
        chunkType: request.type,
        plan: preview.plan,
        summary: preview.summary,
        warnings: preview.warnings,
        createdEntityIds: preview.createdEntityIds,
      };
    }

    const result = await this.importer.importAdventure(validated, importerOptions);
    return {
      success: result.success,
      mode: result.mode,
      chunkType: request.type,
      summary: result.summary,
      warnings: result.warnings,
      createdEntityIds: result.createdEntityIds,
      journal: result.journal,
      actors: result.actors,
    };
  }

  // Legacy handler — keep for backward compatibility but mark as deprecated
  async handleImportAdventureFromText(args: unknown): Promise<any> {
    const requestSchema = z.object({
      title: z.string().min(1, 'title is required'),
      sourceText: z.string().min(1, 'sourceText is required'),
      mode: z.enum(['dry-run', 'import']).default('dry-run'),
      createActors: z.boolean().default(true),
      createJournals: z.boolean().default(true),
      linkNpcs: z.boolean().default(true),
      languageHint: z.string().optional(),
    });

    const request = requestSchema.parse(args);

    this.logger.warn('import-dsa5-adventure-from-text is deprecated. Use import-dsa5-adventure-from-file or import-dsa5-adventure-chunk for better performance.', {
      title: request.title,
      mode: request.mode,
      sourceLength: request.sourceText.length,
    });

    const normalizedSourceText = normalizeAdventureText(request.sourceText);
    const chunks = chunkAdventureText(normalizedSourceText);
    const sourceChunks = chunks.length > 0 ? chunks : [normalizedSourceText];
    const extractedPayloads: AdventureImportPayload[] = [];
    let rawTextLength = 0;

    for (let index = 0; index < sourceChunks.length; index += 1) {
      const chunk = sourceChunks[index];
      const extracted = await this.worker.extractAdventure({
        title: request.title,
        sourceText: chunk,
        chunkIndex: index + 1,
        chunkCount: sourceChunks.length,
        ...(request.languageHint ? { languageHint: request.languageHint } : {}),
      });

      extractedPayloads.push(extracted.payload as AdventureImportPayload);
      rawTextLength += extracted.rawText.length;
    }

    const mergedPayload = mergeAdventurePayloads(extractedPayloads);
    const validated = adventureImportSchema.parse(mergedPayload) as AdventureImportPayload;
    const importerOptions = {
      createActors: request.createActors,
      createJournals: request.createJournals,
      linkNpcs: request.linkNpcs,
    };

    if (request.mode === 'dry-run') {
      const preview = await this.importer.dryRun(validated, importerOptions);
      return {
        success: true,
        mode: 'dry-run',
        title: validated.metadata.title,
        extractedWarnings: validated.warnings ?? [],
        plan: preview.plan,
        summary: preview.summary,
        warnings: preview.warnings,
        unresolvedReferences: preview.unresolvedReferences,
        createdEntityIds: preview.createdEntityIds,
        rawTextLength,
      };
    }

    const result = await this.importer.importAdventure(validated, importerOptions);
    return {
      success: result.success,
      mode: result.mode,
      title: result.title,
      summary: result.summary,
      warnings: result.warnings,
      unresolvedReferences: result.unresolvedReferences,
      createdEntityIds: result.createdEntityIds,
      journal: result.journal,
      actors: result.actors,
      plan: result.plan,
      rawTextLength,
    };
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function dedupeStrings(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function mergeArrayByKey<T>(items: T[], keyFn: (item: T) => string): T[] {
  const seen = new Map<string, T>();
  items.forEach((item) => {
    const key = keyFn(item);
    if (!seen.has(key)) {
      seen.set(key, item);
    }
  });

  const result: T[] = [];
  seen.forEach((value) => {
    result.push(value);
  });
  return result;
}

function mergeRecordArrays(items: Array<Record<string, unknown>>[]): Array<Record<string, unknown>> {
  const flattened = items.flat();
  return mergeArrayByKey(flattened, (item) => {
    const name = typeof item.name === 'string' ? item.name.trim().toLowerCase() : '';
    const title = typeof item.title === 'string' ? item.title.trim().toLowerCase() : '';
    const id = typeof item.id === 'string' ? item.id.trim().toLowerCase() : '';
    return name || title || id || JSON.stringify(item);
  });
}

function mergeAdventurePayloads(payloads: AdventureImportPayload[]): AdventureImportPayload {
  if (payloads.length === 0) {
    throw new Error('No adventure payloads were extracted');
  }

  if (payloads.length === 1) {
    return payloads[0];
  }

  const [first, ...rest] = payloads;
  const chapters = mergeArrayByKey(
    [
      ...(first.chapters ?? []),
      ...rest.flatMap((payload) => payload.chapters ?? []),
    ],
    (chapter) => chapter.title.trim().toLowerCase() || JSON.stringify(chapter),
  );

  const npcs = mergeArrayByKey(
    [
      ...(first.npcs ?? []),
      ...rest.flatMap((payload) => payload.npcs ?? []),
    ],
    (npc) => npc.name.trim().toLowerCase(),
  );

  const items = mergeRecordArrays([
    first.items ?? [],
    ...rest.map((payload) => payload.items ?? []),
  ]);

  const locations = mergeRecordArrays([
    first.locations ?? [],
    ...rest.map((payload) => payload.locations ?? []),
  ]);

  const warnings = dedupeStrings([
    ...(first.warnings ?? []),
    ...rest.flatMap((payload) => payload.warnings ?? []),
  ]);

  const imports = rest.reduce<Record<string, unknown>>((accumulator, payload) => {
    if (isRecord(payload.imports)) {
      return { ...accumulator, ...payload.imports };
    }
    return accumulator;
  }, isRecord(first.imports) ? { ...first.imports } : {});

  return adventureImportSchema.parse({
    ...first,
    metadata: first.metadata,
    chapters,
    npcs,
    items,
    locations,
    imports,
    warnings,
  }) as unknown as AdventureImportPayload;
}
