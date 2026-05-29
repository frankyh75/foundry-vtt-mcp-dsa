import { z } from 'zod';
import type { FoundryClient } from '../foundry-client.js';
import type { Logger } from '../logger.js';
import { AdventureImportWorker } from '../adventure-import/llm-worker.js';
import { DSA5JsonActorImporter } from '../systems/dsa5/json-actor-importer.js';

export interface ActorFromDescriptionToolsOptions {
  foundryClient: FoundryClient;
  logger: Logger;
  worker?: AdventureImportWorker;
  importer?: DSA5JsonActorImporter;
}

export class ActorFromDescriptionTools {
  private readonly logger: Logger;
  private readonly worker: AdventureImportWorker;
  private readonly importer: DSA5JsonActorImporter;

  constructor(options: ActorFromDescriptionToolsOptions) {
    this.logger = options.logger.child({ component: 'ActorFromDescriptionTools' });
    this.worker = options.worker ?? new AdventureImportWorker();
    this.importer =
      options.importer ?? new DSA5JsonActorImporter({ foundryClient: options.foundryClient, logger: options.logger });
  }

  getToolDefinitions() {
    return [
      {
        name: 'create-actor-from-description',
        description:
          'Create a DSA5 actor from a free-text German NPC description. Uses a local LLM to extract stats, then imports the actor into Foundry VTT.',
        inputSchema: {
          type: 'object',
          required: ['description'],
          properties: {
            description: {
              type: 'string',
              description: 'Free-text NPC description in German (e.g. "Alaric ist ein erfahrener Soeldner, MU 13, KK 15...")',
            },
            mode: {
              type: 'string',
              enum: ['dry-run', 'import'],
              default: 'dry-run',
              description: 'dry-run returns a preview without writing to Foundry; import creates the actor',
            },
            resolveItems: {
              type: 'boolean',
              default: true,
              description: 'Attempt to resolve equipment from DSA5 compendium',
            },
          },
        },
      },
    ];
  }

  async handleCreateActorFromDescription(args: unknown): Promise<Record<string, unknown>> {
    const request = z
      .object({
        description: z.string().min(1),
        mode: z.enum(['dry-run', 'import']).default('dry-run'),
        resolveItems: z.boolean().default(true),
      })
      .parse(args);

    this.logger.info('Actor-from-description requested', {
      mode: request.mode,
      resolveItems: request.resolveItems,
      descriptionLength: request.description.length,
    });

    const extracted = await this.worker.extractActor(request.description);

    if (request.mode === 'dry-run') {
      return {
        mode: 'dry-run',
        extractedPayload: extracted.payload,
        rawText: extracted.rawText,
        message: 'Preview only - call again with mode: "import" to create the actor in Foundry.',
      };
    }

    return this.importer.handleImportActorFromJson({
      jsonPayload: extracted.payload,
      strategy: 'custom_dsa5',
      resolveItems: request.resolveItems,
      addToScene: false,
      updateExisting: false,
      strict: false,
    });
  }
}
