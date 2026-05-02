import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { promisify } from 'node:util';
import { existsSync } from 'node:fs';
import type { OcrBlock, OcrBlockKind, OcrPageResult } from './tooling.js';

const execFileAsync = promisify(execFile);

let markerAvailablePromise: Promise<boolean> | undefined;

export interface MarkerPageBlock {
  block_type: string;
  text?: string;
  bbox?: [number, number, number, number];
  lines?: Array<{ text: string; bbox?: [number, number, number, number] }>;
}

export interface MarkerPage {
  page_number: number;
  blocks: MarkerPageBlock[];
  width?: number;
  height?: number;
}

export interface MarkerResult {
  pages: MarkerPage[];
  document_info?: Record<string, unknown>;
}

export async function isMarkerAvailable(): Promise<boolean> {
  if (markerAvailablePromise) {
    return markerAvailablePromise;
  }
  markerAvailablePromise = checkMarkerAvailable();
  return markerAvailablePromise;
}

async function checkMarkerAvailable(): Promise<boolean> {
  const resolved = resolveMarkerPath();
  if (!resolved) {
    return false;
  }
  try {
    await execFileAsync(resolved, ['--help'], { encoding: 'utf8', maxBuffer: 1024 * 1024 });
    return true;
  } catch {
    return false;
  }
}

function resolveMarkerPath(): string | null {
  const envValue = process.env.MARKER_BIN?.trim();
  if (envValue && existsSync(envValue)) {
    return resolve(envValue);
  }
  const venvDir = process.env.MARKER_VENV_DIR?.trim();
  if (venvDir) {
    const candidates = [
      join(venvDir, 'bin', 'marker_single'),
      join(venvDir, 'Scripts', 'marker_single.exe'),
      join(venvDir, 'bin', 'marker'),
      join(venvDir, 'Scripts', 'marker.exe'),
    ];
    for (const candidate of candidates) {
      if (existsSync(candidate)) return candidate;
    }
  }
  return process.platform === 'win32' ? 'marker_single.exe' : 'marker_single';
}

export async function runMarkerOnPdf(pdfPath: string): Promise<MarkerResult> {
  const markerPath = resolveMarkerPath();
  if (!markerPath) {
    throw new Error('Marker binary not found. Set MARKER_BIN or MARKER_VENV_DIR.');
  }

  const outputDir = await mkdtemp(join(tmpdir(), 'foundry-marker-'));
  try {
    await execFileAsync(markerPath, [pdfPath, outputDir], {
      encoding: 'utf8',
      maxBuffer: 10 * 1024 * 1024,
      timeout: 300_000,
    });

    const resultPath = join(outputDir, 'output.json');
    const raw = await readFile(resultPath, 'utf8');
    const parsed = JSON.parse(raw) as unknown;

    if (!isMarkerResultLike(parsed)) {
      throw new Error('Marker output did not match expected schema.');
    }

    return parsed;
  } finally {
    await rm(outputDir, { recursive: true, force: true });
  }
}

export function convertMarkerResultToPageMap(result: MarkerResult): Map<number, OcrPageResult> {
  const pageMap = new Map<number, OcrPageResult>();

  for (const page of result.pages) {
    const pageNumber = page.page_number;
    const pageWidth = page.width ?? 0;
    const pageHeight = page.height ?? 0;

    const blocks: OcrBlock[] = [];
    let readingOrder = 1;

    for (const markerBlock of page.blocks) {
      const kind = mapMarkerBlockType(markerBlock.block_type);
      const text = extractMarkerBlockText(markerBlock);
      const bbox = markerBlock.bbox
        ? { x: markerBlock.bbox[0], y: markerBlock.bbox[1], w: markerBlock.bbox[2], h: markerBlock.bbox[3] }
        : { x: 0, y: 0, w: 0, h: 0 };

      if (!text && kind !== 'illustration' && kind !== 'decoration') {
        continue;
      }

      blocks.push({
        kind,
        text,
        bbox,
        confidence: 0.85,
        readingOrder,
        source: 'ocr',
      });
      readingOrder += 1;
    }

    const text = blocks.map((block) => block.text).filter(Boolean).join('\n\n');

    pageMap.set(pageNumber, {
      available: true,
      engine: 'marker',
      text,
      blocks,
      pageWidth,
      pageHeight,
    });
  }

  return pageMap;
}

function mapMarkerBlockType(markerType: string): OcrBlockKind {
  switch (markerType.toLowerCase()) {
    case 'text':
    case 'paragraph':
      return 'paragraph';
    case 'heading':
    case 'title':
    case 'header':
      return 'heading';
    case 'list':
    case 'enum':
      return 'list';
    case 'table':
      return 'paragraph'; // Tables need special handling; map as paragraph for now
    case 'image':
    case 'picture':
    case 'figure':
      return 'illustration';
    case 'decoration':
    case 'footer':
    case 'page_footer':
    case 'page_header':
      return 'decoration';
    default:
      return 'unknown';
  }
}

function extractMarkerBlockText(block: MarkerPageBlock): string {
  if (typeof block.text === 'string') {
    return block.text;
  }
  if (Array.isArray(block.lines)) {
    return block.lines.map((line) => line.text).filter(Boolean).join('\n');
  }
  return '';
}

function isMarkerResultLike(value: unknown): value is MarkerResult {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const obj = value as Record<string, unknown>;
  return Array.isArray(obj.pages);
}
