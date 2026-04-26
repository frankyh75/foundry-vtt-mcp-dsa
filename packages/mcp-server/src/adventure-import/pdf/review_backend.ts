#!/usr/bin/env node

import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import * as os from 'node:os';

import { buildFoundryImportPlan } from './foundry_mapping.js';
import { applyAnnotationsToIr, createEmptyAnnotationStore, saveAnnotationStore, loadAnnotationStore } from './annotation_store.js';
import { adventureLayoutIrV1Schema, annotationSchema, type AdventurePdfAnnotationV1, type AdventurePdfIrV1 } from './ir.js';

const DEFAULT_PORT = Number.parseInt(process.env.PDF_REVIEW_BACKEND_PORT ?? '4174', 10);
const DEFAULT_HOST = process.env.PDF_REVIEW_BACKEND_HOST ?? '0.0.0.0';
const DATA_DIR = resolve(process.env.PDF_REVIEW_DATA_DIR ?? join(os.homedir(), '.foundry-mcp', 'pdf-review'));
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

async function loadSessionState(sessionId: string): Promise<SessionState> {
  const meta = await loadMeta(sessionId);
  const annotations = await loadAnnotations(getSessionDir(sessionId));
  const projectedPath = join(getSessionDir(sessionId), 'projected.ir.json');
  const projectedIr = existsSync(projectedPath)
    ? (JSON.parse(await readFile(projectedPath, 'utf8')) as AdventurePdfIrV1)
    : undefined;

  return {
    ...meta,
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

const isMain = Boolean(process.argv[1]?.endsWith('review_backend.js'));

if (isMain) {
  void main();
}
