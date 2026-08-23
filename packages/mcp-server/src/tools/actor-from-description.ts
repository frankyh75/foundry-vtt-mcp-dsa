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
  private readonly workerOverride: AdventureImportWorker | undefined;
  private workerInstance: AdventureImportWorker | undefined;
  private readonly importer: DSA5JsonActorImporter;

  constructor(options: ActorFromDescriptionToolsOptions) {
    this.logger = options.logger.child({ component: 'ActorFromDescriptionTools' });
    this.workerOverride = options.worker;
    this.importer =
      options.importer ??
      new DSA5JsonActorImporter({ foundryClient: options.foundryClient, logger: this.logger });
  }

  /**
   * Lazily resolve the AdventureImportWorker.  The constructor no longer
   * instantiates the worker eagerly so the backend can boot without an
   * LLM base URL configured.  The URL is only required when an actor
   * extraction is actually requested.
   */
  private getWorker(): AdventureImportWorker {
    if (this.workerOverride) {
      return this.workerOverride;
    }
    if (!this.workerInstance) {
      this.workerInstance = new AdventureImportWorker();
    }
    return this.workerInstance;
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
              description:
                'Free-text NPC description in German (e.g. "Alaric ist ein erfahrener Soeldner, MU 13, KK 15...")',
            },
            mode: {
              type: 'string',
              enum: ['dry-run', 'import'],
              default: 'dry-run',
              description:
                'dry-run returns a preview without writing to Foundry; import creates the actor',
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

    try {
      const extracted = await this.getWorker().extractActor(request.description);

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
    } catch (error) {
      this.logger.error('Actor-from-description failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error instanceof Error
        ? new Error(`create-actor-from-description: ${error.message}`)
        : new Error('create-actor-from-description: unknown error');
    }
  }
}
