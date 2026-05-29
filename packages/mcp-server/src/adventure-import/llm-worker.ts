import { adventureImportSchema, type AdventureImportPayload } from './schema.js';
import { buildAdventureExtractionMessages, type AdventureExtractionInput } from './prompt.js';
import { buildActorExtractionMessages } from './actor-extraction-prompt.js';

export interface AdventureImportWorkerOptions {
  baseUrl?: string;
  apiKey?: string;
  model?: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  maxRetries?: number;
}

export interface AdventureImportWorkerInput extends AdventureExtractionInput {
  languageHint?: string;
}

export interface AdventureImportResult {
  payload: AdventureImportPayload;
  rawText: string;
}

type JsonRecord = Record<string, unknown>;

const DEFAULT_BASE_URLS = [
  process.env.ADVENTURE_IMPORT_LLM_BASE_URL,
  process.env.OPENAI_BASE_URL,
  process.env.ANTHROPIC_BASE_URL,
].filter((value): value is string => Boolean(value && value.trim()));

const DEFAULT_MODEL =
  process.env.ADVENTURE_IMPORT_LLM_MODEL ||
  process.env.OPENAI_MODEL ||
  process.env.ADVENTURE_IMPORT_MODEL ||
  'gemma-4';

const DEFAULT_API_KEY =
  process.env.ADVENTURE_IMPORT_LLM_API_KEY ||
  process.env.OPENAI_API_KEY ||
  process.env.ANTHROPIC_API_KEY ||
  'local';

function resolveBaseUrl(explicit?: string): string {
  const baseUrl = explicit || DEFAULT_BASE_URLS[0];
  if (!baseUrl) {
    throw new Error('Adventure import LLM base URL is missing. Set ADVENTURE_IMPORT_LLM_BASE_URL, OPENAI_BASE_URL or ANTHROPIC_BASE_URL.');
  }
  return baseUrl.replace(/\/$/, '');
}

function resolveChatCompletionsUrl(baseUrl: string): string {
  if (baseUrl.endsWith('/v1')) return `${baseUrl}/chat/completions`;
  return `${baseUrl}/v1/chat/completions`;
}

function extractJsonCandidate(rawText: string): string {
  const trimmed = rawText.trim();
  if (!trimmed) {
    throw new Error('LLM returned an empty response');
  }

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) {
    return fenced[1].trim();
  }

  const firstBrace = trimmed.indexOf('{');
  const lastBrace = trimmed.lastIndexOf('}');
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return trimmed.slice(firstBrace, lastBrace + 1).trim();
  }

  return trimmed;
}

function readAssistantText(response: any): string {
  const direct = response?.choices?.[0]?.message?.content;
  if (typeof direct === 'string') return direct;
  if (Array.isArray(direct)) {
    return direct
      .map((part: any) => (typeof part?.text === 'string' ? part.text : ''))
      .join('');
  }

  const alt = response?.output_text;
  if (typeof alt === 'string') return alt;

  return '';
}

async function delay(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

export class AdventureImportWorker {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly model: string;
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;
  private readonly maxRetries: number;

  constructor(options: AdventureImportWorkerOptions = {}) {
    this.baseUrl = resolveBaseUrl(options.baseUrl);
    this.apiKey = options.apiKey || DEFAULT_API_KEY;
    this.model = options.model || DEFAULT_MODEL;
    this.fetchImpl = options.fetchImpl || fetch;
    this.timeoutMs = options.timeoutMs ?? 120000;
    this.maxRetries = options.maxRetries ?? 2;
  }

  async extractAdventure(input: AdventureImportWorkerInput): Promise<AdventureImportResult> {
    const messages = buildAdventureExtractionMessages(input);
    const rawText = await this.callModel(messages);
    const jsonText = extractJsonCandidate(rawText);

    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonText);
    } catch (error) {
      throw new Error(`LLM response is not valid JSON: ${error instanceof Error ? error.message : String(error)}`);
    }

    const payload = adventureImportSchema.parse(parsed);
    return { payload, rawText };
  }

  async extractActor(description: string): Promise<{ payload: JsonRecord; rawText: string }> {
    const messages = buildActorExtractionMessages(description);
    const rawText = await this.callModel(messages);
    const jsonText = extractJsonCandidate(rawText);

    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonText);
    } catch (error) {
      throw new Error(`LLM response is not valid JSON: ${error instanceof Error ? error.message : String(error)}`);
    }

    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      throw new Error('LLM response must be a JSON object');
    }

    return { payload: parsed as JsonRecord, rawText };
  }

  private async callModel(messages: { system: string; user: string }): Promise<string> {
    const url = resolveChatCompletionsUrl(this.baseUrl);
    const body = {
      model: this.model,
      messages: [
        { role: 'system', content: messages.system },
        { role: 'user', content: messages.user },
      ],
      temperature: 0.1,
      top_p: 0.9,
    };

    let lastError: unknown;
    for (let attempt = 0; attempt <= this.maxRetries; attempt += 1) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
      try {
        const response = await this.fetchImpl(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.apiKey}`,
          },
          body: JSON.stringify(body),
          signal: controller.signal,
        });

        if (!response.ok) {
          const errorText = await response.text().catch(() => '');
          throw new Error(`LLM request failed (${response.status} ${response.statusText}): ${errorText}`);
        }

        const json = await response.json();
        const rawText = readAssistantText(json);
        if (!rawText) {
          throw new Error('LLM response did not contain assistant text');
        }

        return rawText;
      } catch (error) {
        lastError = error;
        if (attempt < this.maxRetries) {
          await delay(250 * (attempt + 1));
          continue;
        }
      } finally {
        clearTimeout(timeout);
      }
    }

    throw new Error(`Adventure extraction failed after ${this.maxRetries + 1} attempts: ${lastError instanceof Error ? lastError.message : String(lastError)}`);
  }
}

export { extractJsonCandidate };
