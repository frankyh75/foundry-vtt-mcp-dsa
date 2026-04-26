export type ReviewBackendPreset = 'openai-compatible' | 'ollama' | 'lmstudio' | 'lemonade';

export type ReviewConfig = {
  providerPreset: ReviewBackendPreset;
  baseUrl: string;
  apiPath: string;
  model: string;
  apiKey: string;
  showExpertView: boolean;
  rememberLastSettings: boolean;
};

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

export function normalizeApiPath(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return '';
  const prefixed = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  return prefixed.replace(/\/+$/, '') || '/v1';
}

export function normalizeReviewConfig(input: Partial<ReviewConfig> | unknown): ReviewConfig {
  const candidate = isReviewConfigLike(input) ? input : {};
  const next: ReviewConfig = {
    ...defaultReviewConfig,
    providerPreset: candidate.providerPreset ?? defaultReviewConfig.providerPreset,
    baseUrl: candidate.baseUrl ?? defaultReviewConfig.baseUrl,
    apiPath: candidate.apiPath ?? defaultReviewConfig.apiPath,
    model: candidate.model ?? defaultReviewConfig.model,
    apiKey: candidate.apiKey ?? defaultReviewConfig.apiKey,
    showExpertView: candidate.showExpertView ?? defaultReviewConfig.showExpertView,
    rememberLastSettings: candidate.rememberLastSettings ?? defaultReviewConfig.rememberLastSettings,
  };
  const presetDefaults = PRESET_DEFAULTS[next.providerPreset];
  return {
    ...next,
    baseUrl: next.baseUrl.trim() || presetDefaults.baseUrl,
    apiPath: normalizeApiPath(next.apiPath) || presetDefaults.apiPath,
    model: next.model.trim(),
    apiKey: next.apiKey.trim(),
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

export function getPresetDefaults(preset: ReviewBackendPreset): Pick<ReviewConfig, 'baseUrl' | 'apiPath'> {
  return PRESET_DEFAULTS[preset];
}

export function reviewConfigLabel(preset: ReviewBackendPreset): string {
  switch (preset) {
    case 'ollama':
      return 'Ollama';
    case 'lmstudio':
      return 'LM Studio';
    case 'lemonade':
      return 'Lemonade';
    default:
      return 'OpenAI-compatible';
  }
}

function isReviewConfigLike(value: unknown): value is Partial<ReviewConfig> {
  return typeof value === 'object' && value !== null;
}
