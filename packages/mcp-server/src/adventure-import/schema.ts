import { z } from 'zod';

const adventureMetadataSchema = z.object({
  title: z.string().min(1),
  type: z.string().min(1),
  language: z.string().min(1),
  subtitle: z.string().optional(),
  source: z.string().optional(),
  system: z.string().optional(),
}).passthrough();

const adventureChapterSchema = z.object({
  title: z.string().min(1),
  summary: z.string().optional(),
  readAloudText: z.string().optional(),
  gmNotes: z.string().optional(),
  linkedNpcs: z.array(z.string().min(1)).optional(),
  linkedItems: z.array(z.string().min(1)).optional(),
  linkedLocations: z.array(z.string().min(1)).optional(),
}).passthrough();

const adventureNpcSchema = z.object({
  name: z.string().min(1),
  role: z.string().optional(),
  archetypeHint: z.string().optional(),
  attributes: z.record(z.union([z.number(), z.string()])).optional(),
  skills: z.array(
    z.object({
      name: z.string().min(1),
      value: z.number().optional(),
      note: z.string().optional(),
    }).passthrough()
  ).optional(),
  equipment: z.array(z.string().min(1)).optional(),
  secrets: z.array(z.string().min(1)).optional(),
  motivation: z.string().optional(),
  warnings: z.array(z.string().min(1)).optional(),
}).passthrough();

export const adventureImportSchema = z.object({
  metadata: adventureMetadataSchema,
  chapters: z.array(adventureChapterSchema).default([]),
  npcs: z.array(adventureNpcSchema).default([]),
  items: z.array(z.record(z.any())).optional(),
  locations: z.array(z.record(z.any())).optional(),
  imports: z.record(z.any()).optional(),
  warnings: z.array(z.string()).default([]),
}).passthrough();

export type AdventureImportPayload = z.infer<typeof adventureImportSchema>;
export type AdventureImportMetadata = z.infer<typeof adventureMetadataSchema>;
export type AdventureImportChapter = z.infer<typeof adventureChapterSchema>;
export type AdventureImportNpc = z.infer<typeof adventureNpcSchema>;
