import type { AdventureImportMetadata } from './types.js';

export interface AdventureExtractionInput {
  title: string;
  sourceText: string;
  sourceLabel?: string;
  chunkIndex?: number;
  chunkCount?: number;
  languageHint?: string | undefined;
  additionalContext?: string;
}

export interface AdventureExtractionMessages {
  system: string;
  user: string;
}

export const ADVENTURE_IMPORT_SCHEMA_REMINDER = [
  'Top-level keys: metadata, chapters, npcs, items, locations, imports, warnings',
  'metadata requires title, type, language; subtitle/source/system are optional',
  'chapters must each have title and may include summary, readAloudText, gmNotes, linkedNpcs, linkedItems, linkedLocations',
  'npcs must each have name and may include role, archetypeHint, attributes, skills, equipment, secrets, motivation, warnings',
  'warnings should contain ambiguities, missing stats, uncertain mappings or anything that needs human review',
].join('\n');

const normalize = (value: string | undefined, fallback: string): string => {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : fallback;
};

export function buildAdventureExtractionSystemPrompt(): string {
  return [
    'Du extrahierst DSA5-Abenteuer aus Rohtext in strikt valides JSON.',
    'Antworte ausschließlich mit einem JSON-Objekt. Kein Markdown, keine Erklärungen, keine Backticks.',
    'Erfinde keine Werte. Wenn etwas unklar ist, schreibe es in warnings statt zu halluzinieren.',
    'Halte dich an das vereinbarte Abenteuer-Schema und an deutsche Umlaute / Sonderzeichen.',
    ADVENTURE_IMPORT_SCHEMA_REMINDER,
  ].join('\n\n');
}

export function buildAdventureExtractionUserPrompt(input: AdventureExtractionInput): string {
  const title = normalize(input.title, 'Unbekanntes Abenteuer');
  const sourceLabel = normalize(input.sourceLabel, 'Rohtext');
  const chunkMeta = [
    input.chunkIndex !== undefined || input.chunkCount !== undefined
      ? `Chunk: ${input.chunkIndex ?? 1}/${input.chunkCount ?? 1}`
      : undefined,
    input.languageHint ? `Sprachhinweis: ${input.languageHint.trim()}` : undefined,
    input.additionalContext ? `Zusatzkontext: ${input.additionalContext.trim()}` : undefined,
  ].filter(Boolean);

  return [
    `Abenteuertitel: ${title}`,
    `Quelle: ${sourceLabel}`,
    ...chunkMeta,
    '',
    'Extrahiere daraus ein JSON mit dieser Zielstruktur:',
    ADVENTURE_IMPORT_SCHEMA_REMINDER,
    '',
    'Wichtige Regeln:',
    '- Gib nur JSON zurück.',
    '- Nutze warnings für Unsicherheiten statt Fantasiewerte.',
    '- Erhalte deutsche Sonderzeichen.',
    '- Falls es nur Rohtext ist, strukturiere so gut wie möglich, aber erfinde keine Stats.',
    '',
    'Rohtext:',
    input.sourceText.trim(),
  ].join('\n');
}

export function buildAdventureExtractionMessages(input: AdventureExtractionInput): AdventureExtractionMessages {
  return {
    system: buildAdventureExtractionSystemPrompt(),
    user: buildAdventureExtractionUserPrompt(input),
  };
}

export function inferAdventureMetadata(title: string, languageHint?: string): AdventureImportMetadata {
  const normalizedLanguage = languageHint?.trim().toLowerCase();
  const language = normalizedLanguage?.startsWith('en') ? 'en' : 'de';

  return {
    title: title.trim() || 'Unbekanntes Abenteuer',
    type: 'adventure',
    language,
    source: 'text-import',
    system: 'DSA5',
  };
}
