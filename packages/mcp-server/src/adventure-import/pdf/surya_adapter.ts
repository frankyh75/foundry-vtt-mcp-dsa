import { execFile } from 'node:child_process';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { join, dirname, basename } from 'node:path';
import { tmpdir } from 'node:os';
import { promisify } from 'node:util';
import { existsSync } from 'node:fs';
import type { OcrBlock, OcrBlockKind, OcrPageResult } from './tooling.js';

const execFileAsync = promisify(execFile);

let suryaAvailablePromise: Promise<boolean> | undefined;

export interface SuryaLayoutBBox {
  polygon: number[][];
  confidence: number;
  label: string;
  position?: number;
  top_k?: Array<{ label: string; confidence: number }>;
  bbox: [number, number, number, number];
}

export interface SuryaLayoutPage {
  bboxes: SuryaLayoutBBox[];
  page?: number;
  image_bbox?: [number, number, number, number];
}

export interface SuryaOcrLine {
  polygon: number[][];
  confidence: number;
  text: string;
  bbox: [number, number, number, number];
}

export interface SuryaOcrPage {
  text_lines: SuryaOcrLine[];
  page?: number;
  image_bbox?: [number, number, number, number];
}

export interface SuryaPipelineResult {
  pages: Array<{
    pageNumber: number;
    blocks: SuryaBlock[];
    pageWidth: number;
    pageHeight: number;
  }>;
}

export interface SuryaBlock {
  suryaLabel: string;
  text: string;
  bbox: { x: number; y: number; w: number; h: number };
  confidence: number;
  ocrLines: Array<{ text: string; confidence: number; bbox: [number, number, number, number] }>;
}

export async function isSuryaAvailable(): Promise<boolean> {
  if (suryaAvailablePromise) {
    return suryaAvailablePromise;
  }
  suryaAvailablePromise = checkSuryaAvailable();
  return suryaAvailablePromise;
}

async function checkSuryaAvailable(): Promise<boolean> {
  const suryaLayout = resolveSuryaPath('surya_layout');
  const suryaOcr = resolveSuryaPath('surya_ocr');
  if (!suryaLayout || !suryaOcr) {
    return false;
  }
  try {
    await execFileAsync(suryaLayout, ['--help'], { encoding: 'utf8', maxBuffer: 1024 * 1024 });
    await execFileAsync(suryaOcr, ['--help'], { encoding: 'utf8', maxBuffer: 1024 * 1024 });
    return true;
  } catch {
    return false;
  }
}

function resolveSuryaPath(tool: 'surya_layout' | 'surya_ocr'): string | null {
  const envValue = process.env.SURYA_VENV_DIR?.trim();
  if (envValue) {
    const candidates = [
      join(envValue, 'bin', tool),
      join(envValue, 'Scripts', `${tool}.exe`),
    ];
    for (const candidate of candidates) {
      if (existsSync(candidate)) return candidate;
    }
  }
  // Try marker venv path as fallback
  const markerVenv = process.env.MARKER_VENV_DIR?.trim();
  if (markerVenv) {
    const candidates = [
      join(markerVenv, 'bin', tool),
      join(markerVenv, 'Scripts', `${tool}.exe`),
    ];
    for (const candidate of candidates) {
      if (existsSync(candidate)) return candidate;
    }
  }
  // Hardcoded fallback for Mac mini setup
  const macMiniFallback = `/Volumes/Crucial X9/venv-marker/bin/${tool}`;
  if (existsSync(macMiniFallback)) return macMiniFallback;
  return process.platform === 'win32' ? `${tool}.exe` : tool;
}

export async function runSuryaOnPdf(pdfPath: string): Promise<SuryaPipelineResult> {
  const suryaLayout = resolveSuryaPath('surya_layout');
  const suryaOcr = resolveSuryaPath('surya_ocr');
  if (!suryaLayout || !suryaOcr) {
    throw new Error('Surya binaries not found. Set SURYA_VENV_DIR or MARKER_VENV_DIR.');
  }

  const outputDir = await mkdtemp(join(tmpdir(), 'foundry-surya-'));
  const baseName = basename(pdfPath, '.pdf');

  try {
    // Step 1: Run Surya Layout
    const layoutDir = join(outputDir, 'layout');
    await execFileAsync(suryaLayout, [pdfPath, '--results_dir', layoutDir], {
      encoding: 'utf8',
      maxBuffer: 10 * 1024 * 1024,
      timeout: 300_000,
    });

    // Step 2: Run Surya OCR
    const ocrDir = join(outputDir, 'ocr');
    await execFileAsync(suryaOcr, [pdfPath, '--results_dir', ocrDir, '--langs', 'German'], {
      encoding: 'utf8',
      maxBuffer: 10 * 1024 * 1024,
      timeout: 600_000,
    });

    // Step 3: Parse both results
    const layoutPath = join(layoutDir, baseName, 'results.json');
    const ocrPath = join(ocrDir, baseName, 'results.json');

    const layoutRaw = await readFile(layoutPath, 'utf8');
    const ocrRaw = await readFile(ocrPath, 'utf8');

    const layoutData = JSON.parse(layoutRaw) as Record<string, SuryaLayoutPage[]>;
    const ocrData = JSON.parse(ocrRaw) as Record<string, SuryaOcrPage[]>;

    // Step 4: Merge layout + OCR
    const fileKey = basename(pdfPath);
    const fileKeyWithoutExt = basename(pdfPath, '.pdf');
    const layoutPages = layoutData[fileKey] || layoutData[fileKeyWithoutExt] || [];
    const ocrPages = ocrData[fileKey] || ocrData[fileKeyWithoutExt] || [];

    const result: SuryaPipelineResult = { pages: [] };

    for (let i = 0; i < Math.max(layoutPages.length, ocrPages.length); i++) {
      const layoutPage = layoutPages[i];
      const ocrPage = ocrPages[i];
      const pageNumber = i + 1;

      const imageBbox = layoutPage?.image_bbox || ocrPage?.image_bbox || [0, 0, 612, 792];
      const pageWidth = imageBbox[2] - imageBbox[0];
      const pageHeight = imageBbox[3] - imageBbox[1];

      // Match OCR lines to layout blocks
      const blocks = matchOcrToLayout(layoutPage?.bboxes || [], ocrPage?.text_lines || []);

      result.pages.push({
        pageNumber,
        blocks,
        pageWidth,
        pageHeight,
      });
    }

    return result;
  } finally {
    await rm(outputDir, { recursive: true, force: true });
  }
}

function matchOcrToLayout(layoutBboxes: SuryaLayoutBBox[], ocrLines: SuryaOcrLine[]): SuryaBlock[] {
  // Sort layout blocks by vertical position (reading order)
  const sortedLayout = [...layoutBboxes].sort((a, b) => {
    const aY = a.bbox[1];
    const bY = b.bbox[1];
    return aY - bY;
  });

  const blocks: SuryaBlock[] = [];

  for (const layoutBlock of sortedLayout) {
    const [x1, y1, x2, y2] = layoutBlock.bbox;
    const layoutW = x2 - x1;
    const layoutH = y2 - y1;

    // Find OCR lines that overlap with this layout block
    const matchingLines: SuryaOcrLine[] = [];
    for (const line of ocrLines) {
      const [lx1, ly1, lx2, ly2] = line.bbox;
      // Check overlap (IOU > 0.3)
      const overlapX = Math.max(0, Math.min(x2, lx2) - Math.max(x1, lx1));
      const overlapY = Math.max(0, Math.min(y2, ly2) - Math.max(y1, ly1));
      const overlapArea = overlapX * overlapY;
      const layoutArea = layoutW * layoutH;
      const lineArea = (lx2 - lx1) * (ly2 - ly1);
      const iou = overlapArea / (layoutArea + lineArea - overlapArea);

      if (iou > 0.3 || (overlapArea / lineArea > 0.5)) {
        matchingLines.push(line);
      }
    }

    // Sort matching lines by vertical position
    matchingLines.sort((a, b) => a.bbox[1] - b.bbox[1]);

    const blockText = matchingLines.map((l) => l.text).join(' ');
    const avgConfidence = matchingLines.length > 0
      ? matchingLines.reduce((sum, l) => sum + l.confidence, 0) / matchingLines.length
      : layoutBlock.confidence;

    blocks.push({
      suryaLabel: layoutBlock.label,
      text: blockText,
      bbox: { x: x1, y: y1, w: layoutW, h: layoutH },
      confidence: avgConfidence,
      ocrLines: matchingLines.map((l) => ({ text: l.text, confidence: l.confidence, bbox: l.bbox })),
    });
  }

  return blocks;
}

export function convertSuryaResultToPageMap(result: SuryaPipelineResult): Map<number, OcrPageResult> {
  const pageMap = new Map<number, OcrPageResult>();

  for (const page of result.pages) {
    const pageNumber = page.pageNumber;
    const pageWidth = page.pageWidth;
    const pageHeight = page.pageHeight;

    const blocks: OcrBlock[] = [];
    let readingOrder = 1;

    for (const suryaBlock of page.blocks) {
      const kind = mapSuryaBlockType(suryaBlock.suryaLabel);
      const text = suryaBlock.text;
      const bbox = suryaBlock.bbox;

      if (!text && kind !== 'illustration' && kind !== 'decoration') {
        continue;
      }

      blocks.push({
        kind,
        text,
        bbox,
        confidence: suryaBlock.confidence,
        readingOrder,
        source: 'surya',
      });
      readingOrder += 1;
    }

    const fullText = blocks.map((block) => block.text).filter(Boolean).join('\n\n');

    pageMap.set(pageNumber, {
      available: true,
      engine: 'surya',
      text: fullText,
      blocks,
      pageWidth,
      pageHeight,
    });
  }

  return pageMap;
}

function mapSuryaBlockType(suryaLabel: string): OcrBlockKind {
  switch (suryaLabel.toLowerCase()) {
    case 'text':
    case 'paragraph':
      return 'paragraph';
    case 'section-header':
    case 'heading':
    case 'title':
    case 'header':
      return 'heading';
    case 'list-item':
    case 'list':
    case 'enum':
      return 'list';
    case 'table':
      return 'paragraph'; // Tables need special handling
    case 'figure':
    case 'picture':
    case 'image':
      return 'illustration';
    case 'page-footer':
    case 'page-header':
    case 'footer':
    case 'footnote':
      return 'decoration';
    case 'caption':
      return 'paragraph';
    case 'formula':
      return 'paragraph';
    case 'handwriting':
      return 'paragraph';
    default:
      return 'unknown';
  }
}

export function getSuryaVenvDir(): string | undefined {
  return process.env.SURYA_VENV_DIR || process.env.MARKER_VENV_DIR;
}
