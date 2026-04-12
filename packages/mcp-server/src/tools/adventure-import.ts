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
        name: 'import-dsa5-adventure-from-text',
        description: 'Extract a DSA5 adventure from text, validate it against the adventure schema, and optionally import journals and actors into Foundry VTT.',
        inputSchema: {
          type: 'object',
          properties: {
            title: {
              type: 'string',
              description: 'Adventure title used for extraction, validation and the journal entry title',
            },
            sourceText: {
              type: 'string',
              description: 'Converted adventure text or OCR-free text from a PDF',
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
            languageHint: {
              type: 'string',
              description: 'Optional language hint for the extractor (e.g. de, en)',
            },
          },
          required: ['title', 'sourceText'],
        },
      },
    ];
  }

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

    this.logger.info('Adventure import requested', {
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
