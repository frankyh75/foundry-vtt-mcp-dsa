import type { FoundryClient } from '../foundry-client.js';
import type { Logger } from '../logger.js';
import type { AdventureImportChapter, AdventureImportMetadata, AdventureImportNpc, AdventureImportPayload } from './types.js';

export interface AdventureImportOptions {
  createActors?: boolean;
  createJournals?: boolean;
  linkNpcs?: boolean;
  addActorsToScene?: boolean;
}

export interface AdventureImportPlanItem {
  kind: 'journal' | 'actor' | 'link';
  name: string;
  details: string;
}

export interface AdventureImportPlan {
  title: string;
  mode: 'dry-run' | 'import';
  createActors: boolean;
  createJournals: boolean;
  linkNpcs: boolean;
  counts: {
    chapters: number;
    npcs: number;
    items: number;
    locations: number;
  };
  items: AdventureImportPlanItem[];
  warnings: string[];
}

export interface ImportedJournalResult {
  id: string;
  name: string;
  pageCount: number;
}

export interface ImportedActorResult {
  id: string;
  name: string;
  type: string;
}

export interface AdventureImportResult {
  success: boolean;
  mode: 'dry-run' | 'import';
  title: string;
  summary: string;
  warnings: string[];
  unresolvedReferences: string[];
  createdEntityIds: {
    journals: string[];
    actors: string[];
  };
  journal: ImportedJournalResult | undefined;
  actors?: ImportedActorResult[];
  plan: AdventureImportPlan;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const toText = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const joinBullets = (values: string[]): string => values.map((value) => `• ${value}`).join('\n');

function chapterToHtml(chapter: AdventureImportChapter): string {
  const blocks: string[] = [];
  blocks.push(`<h2 class="spaced">${escapeHtml(chapter.title)}</h2>`);
  if (chapter.summary) {
    blocks.push(`<p><strong>Zusammenfassung:</strong> ${escapeHtml(chapter.summary)}</p>`);
  }
  if (chapter.readAloudText) {
    blocks.push(`<div class="readaloud"><p>${escapeHtml(chapter.readAloudText)}</p></div>`);
  }
  if (chapter.gmNotes) {
    blocks.push(`<div class="gmnote"><p>${escapeHtml(chapter.gmNotes)}</p></div>`);
  }
  if (chapter.linkedNpcs?.length) {
    blocks.push(`<p><strong>Verbundene NSCs:</strong> ${escapeHtml(chapter.linkedNpcs.join(', '))}</p>`);
  }
  if (chapter.linkedItems?.length) {
    blocks.push(`<p><strong>Verbundene Gegenstände:</strong> ${escapeHtml(chapter.linkedItems.join(', '))}</p>`);
  }
  if (chapter.linkedLocations?.length) {
    blocks.push(`<p><strong>Orte:</strong> ${escapeHtml(chapter.linkedLocations.join(', '))}</p>`);
  }
  return blocks.join('\n');
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildOverviewHtml(metadata: AdventureImportMetadata, payload: AdventureImportPayload): string {
  const parts = [
    `<h1 class="spaced">${escapeHtml(metadata.title)}</h1>`,
    metadata.subtitle ? `<p><em>${escapeHtml(metadata.subtitle)}</em></p>` : '',
    `<p><strong>Typ:</strong> ${escapeHtml(metadata.type)}</p>`,
    `<p><strong>Sprache:</strong> ${escapeHtml(metadata.language)}</p>`,
    metadata.source ? `<p><strong>Quelle:</strong> ${escapeHtml(metadata.source)}</p>` : '',
    metadata.system ? `<p><strong>System:</strong> ${escapeHtml(metadata.system)}</p>` : '',
    payload.warnings?.length ? `<div class="gmnote"><p>${escapeHtml(joinBullets(payload.warnings))}</p></div>` : '',
  ].filter(Boolean);

  return parts.join('\n');
}

function buildLinkedJournalHtml(actors: ImportedActorResult[]): string {
  if (actors.length === 0) return '';

  return [
    '<h2 class="spaced">NSC-Verknüpfungen</h2>',
    '<ul>',
    ...actors.map((actor) => `<li>${escapeHtml(actor.name)} — Actor-ID: ${escapeHtml(actor.id)}</li>`),
    '</ul>',
  ].join('\n');
}

function buildJournalHtml(
  metadata: AdventureImportMetadata,
  payload: AdventureImportPayload,
  actors: ImportedActorResult[] = [],
): string {
  const parts = [buildOverviewHtml(metadata, payload)];
  const [firstChapter] = payload.chapters ?? [];

  if (firstChapter) {
    parts.push(chapterToHtml(firstChapter));
  }

  const linkedHtml = buildLinkedJournalHtml(actors);
  if (linkedHtml) {
    parts.push(linkedHtml);
  }

  return parts.filter(Boolean).join('\n');
}

function buildNpcActorData(npc: AdventureImportNpc): Record<string, unknown> {
  const notes: string[] = [];
  if (npc.role) notes.push(`Rolle: ${npc.role}`);
  if (npc.archetypeHint) notes.push(`Archetyp-Hinweis: ${npc.archetypeHint}`);
  if (npc.motivation) notes.push(`Motivation: ${npc.motivation}`);
  if (npc.secrets?.length) notes.push(`Geheimnisse: ${npc.secrets.join('; ')}`);
  if (npc.warnings?.length) notes.push(`Warnungen: ${npc.warnings.join('; ')}`);

  return {
    name: npc.name,
    type: 'character',
    system: {
      notes: {
        value: notes.join('\n'),
      },
      details: {
        biography: {
          value: [
            npc.role ? `Rolle: ${npc.role}` : undefined,
            npc.motivation ? `Motivation: ${npc.motivation}` : undefined,
          ].filter(Boolean).join('\n'),
        },
      },
    },
    flags: {
      'foundry-mcp-adventure-import': {
        role: npc.role,
        archetypeHint: npc.archetypeHint,
        attributes: npc.attributes,
        skills: npc.skills,
        equipment: npc.equipment,
        secrets: npc.secrets,
        motivation: npc.motivation,
        warnings: npc.warnings,
      },
    },
  };
}

export class FoundryAdventureImporter {
  constructor(
    private readonly foundryClient: FoundryClient,
    private readonly logger: Logger,
  ) {}

  buildPlan(payload: AdventureImportPayload, options: AdventureImportOptions = {}, mode: 'dry-run' | 'import' = 'dry-run'): AdventureImportPlan {
    const title = payload.metadata.title.trim();
    const createJournals = options.createJournals !== false;
    const createActors = options.createActors !== false;
    const linkNpcs = options.linkNpcs !== false;

    const items: AdventureImportPlanItem[] = [];
    if (createJournals) {
      items.push({
        kind: 'journal',
        name: title,
        details: `${payload.chapters?.length ?? 0} Kapitel werden als Journalseiten angelegt`,
      });
    }

    if (createActors) {
      for (const npc of payload.npcs ?? []) {
        items.push({
          kind: 'actor',
          name: npc.name,
          details: npc.role ? `NSC-Rolle: ${npc.role}` : 'NSC wird als generischer Actor erstellt',
        });
      }
    }

    if (linkNpcs && (payload.npcs?.length ?? 0) > 0) {
      items.push({
        kind: 'link',
        name: 'NSC-Verknüpfungen',
        details: 'Journal wird nach Actor-Erstellung mit Referenzen ergänzt',
      });
    }

    return {
      title,
      mode,
      createActors,
      createJournals,
      linkNpcs,
      counts: {
        chapters: payload.chapters?.length ?? 0,
        npcs: payload.npcs?.length ?? 0,
        items: payload.items?.length ?? 0,
        locations: payload.locations?.length ?? 0,
      },
      items,
      warnings: [...(payload.warnings ?? [])],
    };
  }

  async dryRun(payload: AdventureImportPayload, options: AdventureImportOptions = {}): Promise<AdventureImportResult> {
    const plan = this.buildPlan(payload, options, 'dry-run');
    return {
      success: true,
      mode: 'dry-run',
      title: plan.title,
      summary: this.buildSummary(plan),
      warnings: plan.warnings,
      unresolvedReferences: [],
      createdEntityIds: { journals: [], actors: [] },
      journal: undefined,
      plan,
    };
  }

  async importAdventure(payload: AdventureImportPayload, options: AdventureImportOptions = {}): Promise<AdventureImportResult> {
    const plan = this.buildPlan(payload, options, 'import');
    const warnings = [...plan.warnings];
    const unresolvedReferences: string[] = [];
    const createdJournalIds: string[] = [];
    const createdActors: ImportedActorResult[] = [];

    let journal: ImportedJournalResult | undefined;
    const createJournals = options.createJournals !== false;
    const createActors = options.createActors !== false;
    const linkNpcs = options.linkNpcs !== false;

    if (createJournals) {
      const additionalPages = (payload.chapters ?? []).slice(1).map((chapter) => ({
        name: chapter.title,
        content: chapterToHtml(chapter),
      }));

      const result = await this.foundryClient.query('foundry-mcp-bridge.createJournalEntry', {
        name: payload.metadata.title,
        content: buildJournalHtml(payload.metadata, payload),
        additionalPages,
      });

      journal = {
        id: result.id,
        name: result.name,
        pageCount: result.pageCount ?? (1 + additionalPages.length),
      };
      createdJournalIds.push(result.id);
    }

    if (createActors) {
      for (const npc of payload.npcs ?? []) {
        const result = await this.foundryClient.query('foundry-mcp-bridge.createActorFromData', {
          actorData: buildNpcActorData(npc),
          addToScene: false,
          updateExisting: true,
          existingActorIdentifier: npc.name,
        });

        if (!result?.actor?.id) {
          warnings.push(`Actor konnte nicht angelegt werden: ${npc.name}`);
          unresolvedReferences.push(npc.name);
          continue;
        }

        createdActors.push({
          id: result.actor.id,
          name: result.actor.name,
          type: result.actor.type,
        });
      }
    }

    if (linkNpcs && journal && createdActors.length > 0) {
      await this.foundryClient.query('foundry-mcp-bridge.updateJournalContent', {
        journalId: journal.id,
        content: buildJournalHtml(payload.metadata, payload, createdActors),
      });
    }

    if (linkNpcs && payload.npcs?.length && createdActors.length !== payload.npcs.length) {
      warnings.push('Nicht alle NSCs konnten mit Actors verknüpft werden.');
    }

    return {
      success: true,
      mode: 'import',
      title: plan.title,
      summary: this.buildSummary(plan),
      warnings,
      unresolvedReferences,
      createdEntityIds: {
        journals: createdJournalIds,
        actors: createdActors.map((actor) => actor.id),
      },
      journal,
      actors: createdActors,
      plan,
    };
  }

  private buildSummary(plan: AdventureImportPlan): string {
    return [
      `Titel: ${plan.title}`,
      `Kapitel: ${plan.counts.chapters}`,
      `NSCs: ${plan.counts.npcs}`,
      `Items: ${plan.counts.items}`,
      `Orte: ${plan.counts.locations}`,
      `Modus: ${plan.createJournals ? 'Journal' : 'kein Journal'} / ${plan.createActors ? 'Actors' : 'keine Actors'}`,
      plan.warnings.length ? `Warnungen: ${plan.warnings.length}` : 'Warnungen: keine',
    ].join('\n');
  }
}
