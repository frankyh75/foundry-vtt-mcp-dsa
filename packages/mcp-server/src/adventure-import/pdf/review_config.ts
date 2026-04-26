import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { z } from 'zod';

export const reviewBackendPresetSchema = z.enum(['openai-compatible', 'ollama', 'lmstudio', 'lemonade']);

export type ReviewBackendPreset = z.infer<typeof reviewBackendPresetSchema>;

export const reviewConfigSchema = z.object({
  providerPreset: reviewBackendPresetSchema,
  baseUrl: z.string(),
  apiPath: z.string(),
  model: z.string(),
  apiKey: z.string(),
  showExpertView: z.boolean(),
  rememberLastSettings: z.boolean(),
});

export type ReviewConfig = z.infer<typeof reviewConfigSchema>;

export const defaultReviewConfig: ReviewConfig = {
  providerPreset: 'openai-compatible',
  baseUrl: '',
  apiPath: '/v1',
  model: '',
  apiKey: '',
  showExpertView: true,
  rememberLastSettings: true,
};

const PRESET_DEFAULTS: Record<ReviewBackendPreset, Pick<ReviewConfig, 'baseUrl' | 'apiPath'>> = {
  'openai-compatible': { baseUrl: '', apiPath: '/v1' },
  ollama: { baseUrl: 'http://127.0.0.1:11434', apiPath: '/v1' },
  lmstudio: { baseUrl: 'http://127.0.0.1:1234', apiPath: '/v1' },
  lemonade: { baseUrl: 'http://127.0.0.1:13305', apiPath: '/api/v1' },
};

export function normalizeReviewConfig(input: Partial<ReviewConfig> | unknown): ReviewConfig {
  const parsed = reviewConfigSchema.partial().safeParse(input);
  const candidate = parsed.success ? parsed.data : {};
  const providerPreset = candidate.providerPreset ?? defaultReviewConfig.providerPreset;
  const presetDefaults = PRESET_DEFAULTS[providerPreset];
  const baseUrl = typeof candidate.baseUrl === 'string' ? candidate.baseUrl : defaultReviewConfig.baseUrl;
  const apiPath = typeof candidate.apiPath === 'string' ? candidate.apiPath : defaultReviewConfig.apiPath;
  const model = typeof candidate.model === 'string' ? candidate.model : defaultReviewConfig.model;
  const apiKey = typeof candidate.apiKey === 'string' ? candidate.apiKey : defaultReviewConfig.apiKey;
  const showExpertView = typeof candidate.showExpertView === 'boolean' ? candidate.showExpertView : defaultReviewConfig.showExpertView;
  const rememberLastSettings = typeof candidate.rememberLastSettings === 'boolean' ? candidate.rememberLastSettings : defaultReviewConfig.rememberLastSettings;

  return {
    providerPreset,
    baseUrl: baseUrl.trim() || presetDefaults.baseUrl,
    apiPath: normalizeApiPath(apiPath) || presetDefaults.apiPath,
    model: model.trim(),
    apiKey: apiKey.trim(),
    showExpertView,
    rememberLastSettings,
  };
}

export function applyPresetDefaults(config: ReviewConfig, preset: ReviewBackendPreset): ReviewConfig {
  const presetDefaults = PRESET_DEFAULTS[preset];
  return normalizeReviewConfig({
    ...config,
    providerPreset: preset,
    baseUrl: config.baseUrl.trim() || presetDefaults.baseUrl,
    apiPath: config.apiPath.trim() && config.apiPath.trim() !== defaultReviewConfig.apiPath ? config.apiPath : presetDefaults.apiPath,
  });
}

export function normalizeApiPath(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return '';
  const prefixed = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  return prefixed.replace(/\/+$/, '') || '/v1';
}

export function resolveReviewConfigPath(baseDir = process.cwd()): string {
  return resolve(baseDir, 'conf.json');
}

export async function loadReviewConfig(configPath = resolveReviewConfigPath()): Promise<ReviewConfig> {
  if (!existsSync(configPath)) {
    return defaultReviewConfig;
  }

  try {
    const raw = await readFile(configPath, 'utf8');
    return normalizeReviewConfig(JSON.parse(raw) as unknown);
  } catch {
    return defaultReviewConfig;
  }
}

export async function saveReviewConfig(config: ReviewConfig, configPath = resolveReviewConfigPath()): Promise<void> {
  await writeFile(configPath, `${JSON.stringify(normalizeReviewConfig(config), null, 2)}\n`, 'utf8');
}
