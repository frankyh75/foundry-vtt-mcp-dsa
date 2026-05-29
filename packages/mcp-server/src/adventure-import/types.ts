export type AdventureImportLanguage = 'de' | 'en' | string;
export type AdventureImportType = 'adventure' | 'one-shot' | 'campaign' | string;

export interface AdventureImportMetadata {
  title: string;
  type: AdventureImportType;
  language: AdventureImportLanguage;
  subtitle?: string;
  source?: string;
  system?: string;
}

export interface AdventureImportChapter {
  title: string;
  summary?: string;
  readAloudText?: string;
  gmNotes?: string;
  linkedNpcs?: string[];
  linkedItems?: string[];
  linkedLocations?: string[];
}

export interface AdventureImportNpc {
  name: string;
  role?: string;
  archetypeHint?: string;
  attributes?: Record<string, number | string>;
  skills?: Array<{ name: string; value?: number; note?: string }>;
  equipment?: string[];
  secrets?: string[];
  motivation?: string;
  warnings?: string[];
}

export interface AdventureImportPayload {
  metadata: AdventureImportMetadata;
  chapters?: AdventureImportChapter[];
  npcs?: AdventureImportNpc[];
  items?: Array<Record<string, unknown>>;
  locations?: Array<Record<string, unknown>>;
  imports?: Record<string, unknown>;
  warnings?: string[];
  [key: string]: unknown;
}
