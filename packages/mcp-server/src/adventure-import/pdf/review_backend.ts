#!/usr/bin/env node

import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import * as os from 'node:os';

import { buildPdfImportIr } from './pipeline.js';
import { createDefaultPdfToolRunner } from './tooling.js';
import { buildFoundryImportPlan } from './foundry_mapping.js';
import { applyAnnotationsToIr, createEmptyAnnotationStore, saveAnnotationStore, loadAnnotationStore } from './annotation_store.js';
import { adventureLayoutIrV1Schema, annotationSchema, type AdventurePdfAnnotationV1, type AdventurePdfIrV1 } from './ir.js';
import { defaultReviewConfig, loadReviewConfig, normalizeReviewConfig, resolveReviewConfigPath, saveReviewConfig, type ReviewConfig } from './review_config.js';

const DEFAULT_PORT = Number.parseInt(process.env.PDF_REVIEW_BACKEND_PORT ?? '4174', 10);
const DEFAULT_HOST = process.env.PDF_REVIEW_BACKEND_HOST ?? '0.0.0.0';
const DATA_DIR = resolve(process.env.PDF_REVIEW_DATA_DIR ?? join(os.homedir(), '.foundry-mcp', 'pdf-review'));
const CONFIG_PATH = resolveReviewConfigPath();
const JSON_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, X-Filename',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,OPTIONS',
};

type SessionMeta = {
  sessionId: string;
  createdAt: string;
  updatedAt: string;
  documentId?: string;
  pdfName?: string;
  irName?: string;
  annotationCount: number;
  hasPdf: boolean;
  hasIr: boolean;
  reviewConfig?: ReviewConfig;
};

type SessionState = SessionMeta & {
  projectedIr: AdventurePdfIrV1 | null;
  annotations: AdventurePdfAnnotationV1[];
};

async function main(): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true });

  const server = createServer(async (req, res) => {
    try {
      await handleRequest(req, res);
    } catch (error) {
      sendJson(res, 500, { error: error instanceof Error ? error.message : String(error) });
    }
  });

  server.listen(DEFAULT_PORT, DEFAULT_HOST, () => {
    console.log(`pdf-review-backend listening on http://${DEFAULT_HOST}:${DEFAULT_PORT}`);
    console.log(`data dir: ${DATA_DIR}`);
  });
}

async function handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (!req.url) {
    sendText(res, 400, 'Bad Request');
    return;
  }

  if (req.method === 'OPTIONS') {
    sendCors(res);
    res.statusCode = 204;
    res.end();
    return;
  }

  const url = new URL(req.url, `http://${DEFAULT_HOST}:${DEFAULT_PORT}`);
  const segments = url.pathname.split('/').filter(Boolean);

  if (req.method === 'GET' && url.pathname === '/health') {
    sendJson(res, 200, { status: 'ok', dataDir: DATA_DIR });
    return;
  }

  if (req.method === 'GET' && url.pathname === '/api/health') {
    sendJson(res, 200, { status: 'ok', dataDir: DATA_DIR });
    return;
  }

  if (req.method === 'GET' && url.pathname === '/config') {
    const config = await loadReviewConfig(CONFIG_PATH);
    sendJson(res, 200, config);
    return;
  }

  if (req.method === 'PUT' && url.pathname === '/config') {
    const body = await readBody(req);
    const parsed = normalizeReviewConfig(JSON.parse(body.toString('utf8')) as unknown);
    await saveReviewConfig(parsed, CONFIG_PATH);
    sendJson(res, 200, { ok: true, config: parsed });
    return;
  }

  if (req.method === 'GET' && url.pathname === '/models') {
    const config = await loadReviewConfig(CONFIG_PATH);
    const discovery = await discoverOllamaModels(config);
    sendJson(res, 200, discovery);
    return;
  }

  if (req.method === 'GET' && url.pathname === '/engines') {
    const { isCommandAvailable } = await import('./tooling.js');
    const { isMarkerAvailable } = await import('./marker_adapter.js');
    const { isSuryaAvailable } = await import('./surya_adapter.js');
    const [pdfinfo, pdftotext, tesseract, marker, surya, ollama] = await Promise.allSettled([
      isCommandAvailable('pdfinfo'),
      isCommandAvailable('pdftotext'),
      isCommandAvailable('tesseract'),
      isMarkerAvailable(),
      isSuryaAvailable(),
      isOllamaReachable(),
    ]);
    sendJson(res, 200, {
      poppler: { available: pdfinfo.status === 'fulfilled' && pdfinfo.value, tools: ['pdfinfo', 'pdftotext', 'pdftoppm'] },
      tesseract: { available: tesseract.status === 'fulfilled' && tesseract.value },
      marker: { available: marker.status === 'fulfilled' && marker.value },
      surya: { available: surya.status === 'fulfilled' && surya.value },
      ollama: { available: ollama.status === 'fulfilled' && ollama.value },
    });
    return;
  }

  if (segments[0] !== 'sessions' || segments.length < 2) {
    sendText(res, 404, 'Not Found');
    return;
  }

  const sessionId = decodeURIComponent(segments[1] ?? '');
  const sessionDir = getSessionDir(sessionId);
  await mkdir(sessionDir, { recursive: true });

  if (req.method === 'GET' && segments.length === 2) {
    const state = await loadSessionState(sessionId);
    sendJson(res, 200, state);
    return;
  }

  if (req.method === 'GET' && segments[2] === 'pdf') {
    const pdfPath = join(sessionDir, 'source.pdf');
    if (!existsSync(pdfPath)) {
      sendJson(res, 404, { error: 'No PDF uploaded yet for this session.' });
      return;
    }
    sendCors(res);
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/pdf');
    res.end(await readFile(pdfPath));
    return;
  }

  if (req.method === 'GET' && segments[2] === 'pages' && segments[3]) {
    const pageNum = Number.parseInt(segments[3].split('.')[0] ?? '', 10);
    if (Number.isNaN(pageNum) || pageNum < 1) {
      sendJson(res, 400, { error: 'Invalid page number.' });
      return;
    }
    const pdfPath = join(sessionDir, 'source.pdf');
    if (!existsSync(pdfPath)) {
      sendJson(res, 404, { error: 'No PDF uploaded yet for this session.' });
      return;
    }
    const { rename } = await import('node:fs/promises');
    const { execFile } = await import('node:child_process');
    const pageImageDir = join(sessionDir, 'pages');
    const pageImagePath = join(pageImageDir, `${pageNum}.png`);
    if (!existsSync(pageImagePath)) {
      await mkdir(pageImageDir, { recursive: true });
      const tmpName = 'page-tmp';
      const tmpPrefix = join(pageImageDir, tmpName);
      await new Promise<void>((resolve, reject) => {
        execFile('pdftoppm', ['-png', '-r', '150', '-f', String(pageNum), '-l', String(pageNum), pdfPath, tmpPrefix], (error) => {
          if (error) reject(error);
          else resolve();
        });
      });
      const generated = join(pageImageDir, `${tmpName}-${pageNum}.png`);
      if (existsSync(generated)) {
        await rename(generated, pageImagePath);
      }
    }
    if (existsSync(pageImagePath)) {
      sendCors(res);
      res.setHeader('Content-Type', 'image/png');
      res.end(await readFile(pageImagePath));
      return;
    }
    sendJson(res, 500, { error: 'Failed to render page image.' });
    return;
  }

  if (req.method === 'GET' && segments[2] === 'ir') {
    const ir = await loadSourceIr(sessionDir);
    if (!ir) {
      sendJson(res, 404, { error: 'No IR uploaded yet for this session.' });
      return;
    }
    sendJson(res, 200, ir);
    return;
  }

  if (req.method === 'GET' && segments[2] === 'annotations') {
    const annotations = await loadAnnotations(sessionDir);
    sendJson(res, 200, { annotations });
    return;
  }

  if (req.method === 'PUT' && segments[2] === 'pdf') {
    const body = await readBody(req);
    const pdfPath = join(sessionDir, 'source.pdf');
    await writeFile(pdfPath, body);
    const meta = await loadMeta(sessionId);
    const filename = normalizeFilename(req.headers['x-filename']);
    if (filename) {
      meta.pdfName = filename;
    }
    meta.hasPdf = true;
    meta.updatedAt = new Date().toISOString();
    await saveMeta(sessionDir, meta);
    sendJson(res, 200, { ok: true, sessionId, pdfPath });
    return;
  }

  if (req.method === 'PUT' && segments[2] === 'ir') {
    const body = await readBody(req);
    const text = body.toString('utf8');
    const parsed = adventureLayoutIrV1Schema.parse(JSON.parse(text));
    const irPath = join(sessionDir, 'source.ir.json');
    await writeFile(irPath, `${JSON.stringify(parsed, null, 2)}\n`, 'utf8');
    const meta = await loadMeta(sessionId);
    meta.documentId = parsed.document.id;
    meta.irName = normalizeFilename(req.headers['x-filename']) ?? `${parsed.document.id}.ir.json`;
    meta.hasIr = true;
    meta.updatedAt = new Date().toISOString();
    await saveMeta(sessionDir, meta);

    const annotations = await loadAnnotations(sessionDir);
    const projectedIr = projectIr(parsed, annotations);
    await saveProjectedIr(sessionDir, projectedIr);
    sendJson(res, 200, { ok: true, sessionId, documentId: parsed.document.id, projectedIr });
    return;
  }

  if (req.method === 'POST' && segments[2] === 'annotations') {
    const body = await readBody(req);
    const payload = JSON.parse(body.toString('utf8')) as { annotations?: unknown } | unknown[];
    const rawAnnotations: unknown[] = Array.isArray(payload)
      ? payload
      : Array.isArray(payload.annotations)
        ? payload.annotations
        : [];

    const meta = await loadMeta(sessionId);
    const ir = await loadSourceIr(sessionDir);
    if (!ir) {
      sendJson(res, 400, { error: 'No IR uploaded yet for this session.' });
      return;
    }

    const annotations = rawAnnotations.map((item) => annotationSchema.parse(item));
    const annotationStore = {
      ...createEmptyAnnotationStore({
        id: ir.document.id,
        sourcePath: ir.document.sourcePath,
        sourceHash: ir.document.sourceHash,
      }),
      annotations,
    };

    const annotationPath = join(sessionDir, 'annotations.json');
    await saveAnnotationStore(annotationPath, annotationStore);
    meta.documentId = ir.document.id;
    meta.annotationCount = annotations.length;
    meta.hasIr = true;
    meta.updatedAt = new Date().toISOString();
    await saveMeta(sessionDir, meta);

    const projectedIr = projectIr(ir, annotations);
    await saveProjectedIr(sessionDir, projectedIr);
    sendJson(res, 200, { ok: true, sessionId, annotationCount: annotations.length, projectedIr });
    return;
  }

  if (req.method === 'POST' && segments[2] === 'analyze') {
    const meta = await loadMeta(sessionId);
    const pdfPath = join(sessionDir, 'source.pdf');
    if (!existsSync(pdfPath)) {
      sendJson(res, 400, { error: 'No PDF uploaded yet for this session.' });
      return;
    }

    const body = await readBody(req);
    const maybeConfig = body.length ? JSON.parse(body.toString('utf8')) as { config?: unknown } | unknown : {};
    const config = normalizeReviewConfig(
      typeof maybeConfig === 'object' && maybeConfig !== null && 'config' in maybeConfig
        ? (maybeConfig as { config?: unknown }).config
        : maybeConfig
    );
    await saveReviewConfig(config, CONFIG_PATH);

    const result = await buildPdfImportIr({
      pdfPath,
      outPath: sessionDir,
      runner: createDefaultPdfToolRunner({ preferOcrEngine: config.ocrEngine }),
      preferOcrEngine: config.ocrEngine,
    });

    const sourceIrPath = join(sessionDir, 'source.ir.json');
    await writeFile(sourceIrPath, `${JSON.stringify(result.ir, null, 2)}\n`, 'utf8');
    const annotationsPath = join(sessionDir, 'annotations.json');
    await saveAnnotationStore(annotationsPath, result.annotationStore);
    await saveProjectedIr(sessionDir, result.ir);

    meta.documentId = result.ir.document.id;
    meta.annotationCount = result.annotationStore.annotations.length;
    meta.hasPdf = true;
    meta.hasIr = true;
    meta.irName = `${result.ir.document.id}.ir.json`;
    meta.reviewConfig = config;
    meta.updatedAt = new Date().toISOString();
    await saveMeta(sessionDir, meta);

    sendJson(res, 200, {
      ok: true,
      sessionId,
      documentId: result.ir.document.id,
      pageCount: result.ir.document.pageCount,
      reviewConfig: config,
      projectedIr: result.ir,
    });
    return;
  }

  if (req.method === 'GET' && segments[2] === 'export') {
    const state = await loadSessionState(sessionId);
    if (!state.projectedIr) {
      sendJson(res, 404, { error: 'No projected IR available for this session.' });
      return;
    }
    sendJson(res, 200, { projectedIr: state.projectedIr, annotations: state.annotations });
    return;
  }

  sendText(res, 404, 'Not Found');
}

async function discoverOllamaModels(config: ReviewConfig): Promise<{
  providerPreset: ReviewConfig['providerPreset'];
  baseUrl: string;
  models: Array<{ name: string; remoteHost?: string; local: boolean }>;
  localModels: string[];
  localChatModels: string[];
  warning?: string;
}> {
  const configuredBaseUrl = (config.baseUrl.trim() || 'http://127.0.0.1:11434').replace(/\/+$/, '');
  const localBaseUrl = 'http://127.0.0.1:11434';
  const probeUrls = config.providerPreset === 'ollama'
    ? uniqueStrings([configuredBaseUrl, localBaseUrl])
    : [localBaseUrl];

  const discoveredModels: Array<{ name: string; remoteHost?: string; local: boolean }> = [];
  const warnings: string[] = [];

  for (const probeUrl of probeUrls) {
    try {
      const response = await fetch(`${probeUrl}/api/tags`);
      if (!response.ok) {
        warnings.push(`${probeUrl}: ${response.status} ${response.statusText}`);
        continue;
      }

      const payload = (await response.json()) as { models?: Array<{ name?: string; remote_host?: string }> };
      const models = (Array.isArray(payload.models) ? payload.models : [])
        .map((model) => ({
          name: typeof model.name === 'string' ? model.name : 'unbekannt',
          local: typeof model.remote_host !== 'string',
          ...(typeof model.remote_host === 'string' ? { remoteHost: model.remote_host } : {}),
        }))
        .filter((model) => model.name !== 'unbekannt');

      if (models.length) {
        discoveredModels.push(...models);
        if (probeUrl === localBaseUrl) {
          break;
        }
      }
    } catch (error) {
      warnings.push(`${probeUrl}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  const models = uniqueModels(discoveredModels);
  const localModels = models.filter((model) => model.local).map((model) => model.name);
  const localChatModels = localModels.filter((name) => !/embed|nomic-embed-text/i.test(name));

  return {
    providerPreset: config.providerPreset,
    baseUrl: configuredBaseUrl,
    models,
    localModels,
    localChatModels,
    ...(localChatModels.length
      ? {}
      : {
          warning:
            config.providerPreset === 'ollama'
              ? 'Nur Embedding- oder Cloud-Backed-Modelle gefunden. Für die Re-Analyse fehlt ein lokales Chat-Modell.'
              : 'Lokale Ollama-Modelle wurden vom Mac-mini-Fallback geladen. Das konfigurierte Preset ist jedoch nicht Ollama.',
        }),
  };
}

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function uniqueModels(models: Array<{ name: string; remoteHost?: string; local: boolean }>): Array<{ name: string; remoteHost?: string; local: boolean }> {
  const seen = new Set<string>();
  const unique: Array<{ name: string; remoteHost?: string; local: boolean }> = [];

  for (const model of models) {
    if (seen.has(model.name)) continue;
    seen.add(model.name);
    unique.push(model);
  }

  return unique;
}

async function loadSessionState(sessionId: string): Promise<SessionState> {
  const meta = await loadMeta(sessionId);
  const annotations = await loadAnnotations(getSessionDir(sessionId));
  const projectedPath = join(getSessionDir(sessionId), 'projected.ir.json');
  const projectedIr = existsSync(projectedPath)
    ? (JSON.parse(await readFile(projectedPath, 'utf8')) as AdventurePdfIrV1)
    : undefined;

  return {
    ...meta,
    reviewConfig: meta.reviewConfig ?? defaultReviewConfig,
    annotations,
    projectedIr: projectedIr ?? null,
  };
}

async function loadSourceIr(sessionDir: string): Promise<AdventurePdfIrV1 | null> {
  const irPath = join(sessionDir, 'source.ir.json');
  if (!existsSync(irPath)) {
    return null;
  }
  const parsed = JSON.parse(await readFile(irPath, 'utf8')) as unknown;
  return adventureLayoutIrV1Schema.parse(parsed);
}

async function loadAnnotations(sessionDir: string): Promise<AdventurePdfAnnotationV1[]> {
  const annotationPath = join(sessionDir, 'annotations.json');
  if (!existsSync(annotationPath)) {
    return [];
  }

  try {
    const parsed = JSON.parse(await readFile(annotationPath, 'utf8')) as { annotations?: unknown };
    return Array.isArray(parsed.annotations) ? parsed.annotations.map((item) => annotationSchema.parse(item)) : [];
  } catch {
    return [];
  }
}

async function saveProjectedIr(sessionDir: string, projectedIr: AdventurePdfIrV1): Promise<void> {
  await writeFile(join(sessionDir, 'projected.ir.json'), `${JSON.stringify(projectedIr, null, 2)}\n`, 'utf8');
}

function projectIr(ir: AdventurePdfIrV1, annotations: AdventurePdfAnnotationV1[]): AdventurePdfIrV1 {
  const projected = applyAnnotationsToIr(ir, annotations);
  return adventureLayoutIrV1Schema.parse({
    ...projected,
    importPlan: buildFoundryImportPlan(projected),
  });
}

async function loadMeta(sessionId: string): Promise<SessionMeta> {
  const sessionDir = getSessionDir(sessionId);
  const metaPath = join(sessionDir, 'session.json');
  if (existsSync(metaPath)) {
    try {
      return JSON.parse(await readFile(metaPath, 'utf8')) as SessionMeta;
    } catch {
      // fall through
    }
  }

  const now = new Date().toISOString();
  return {
    sessionId,
    createdAt: now,
    updatedAt: now,
    annotationCount: 0,
    hasPdf: false,
    hasIr: false,
    reviewConfig: defaultReviewConfig,
  };
}

async function saveMeta(sessionDir: string, meta: SessionMeta): Promise<void> {
  await writeFile(join(sessionDir, 'session.json'), `${JSON.stringify(meta, null, 2)}\n`, 'utf8');
}

function getSessionDir(sessionId: string): string {
  return join(DATA_DIR, sanitizeSessionId(sessionId));
}

function sanitizeSessionId(sessionId: string): string {
  return sessionId.trim().replace(/[^a-zA-Z0-9._-]+/g, '_') || 'unloaded';
}

async function readBody(req: IncomingMessage): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
}

function normalizeFilename(value: unknown): string | undefined {
  if (typeof value !== 'string' || !value.trim()) {
    return undefined;
  }
  return basename(value.trim());
}

function sendCors(res: ServerResponse): void {
  Object.entries(JSON_HEADERS).forEach(([key, value]) => {
    res.setHeader(key, value);
  });
}

function sendJson(res: ServerResponse, statusCode: number, payload: unknown): void {
  sendCors(res);
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(`${JSON.stringify(payload, null, 2)}\n`);
}

function sendText(res: ServerResponse, statusCode: number, payload: string): void {
  sendCors(res);
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.end(payload);
}

async function isOllamaReachable(): Promise<boolean> {
  try {
    const response = await fetch('http://127.0.0.1:11434/api/tags', { signal: AbortSignal.timeout(2000) });
    return response.ok;
  } catch {
    return false;
  }
}

const isMain = Boolean(process.argv[1]?.endsWith('review_backend.js'));

if (isMain) {
  void main();
}
