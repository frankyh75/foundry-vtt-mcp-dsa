import { existsSync } from 'node:fs';
import { execFile } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export type OcrBlockKind = 'heading' | 'paragraph' | 'list' | 'illustration' | 'decoration' | 'unknown';

export interface OcrBlock {
  kind: OcrBlockKind;
  text: string;
  bbox: {
    x: number;
    y: number;
    w: number;
    h: number;
  };
  confidence: number;
  readingOrder: number;
  source: 'ocr';
}

export interface OcrPageResult {
  available: boolean;
  engine: 'tesseract' | 'missing' | 'failed';
  reason?: string;
  text: string;
  blocks: OcrBlock[];
  pageWidth: number;
  pageHeight: number;
  tsv?: string;
}

export interface PdfToolRunner {
  pdfInfo(pdfPath: string): Promise<string>;
  pdfToText(pdfPath: string, pageNumber: number): Promise<string>;
  probeRender(pdfPath: string, pageNumber: number): Promise<boolean>;
  ocrPage(pdfPath: string, pageNumber: number, options?: { languageHint?: string }): Promise<OcrPageResult>;
}

let tesseractAvailablePromise: Promise<boolean> | undefined;

const TOOL_ENV_VARS: Record<string, string> = {
  pdfinfo: 'PDFINFO_BIN',
  pdftotext: 'PDFTOTEXT_BIN',
  pdftoppm: 'PDFTOPPM_BIN',
  tesseract: 'TESSERACT_BIN',
};

export function createDefaultPdfToolRunner(): PdfToolRunner {
  return {
    async pdfInfo(pdfPath: string): Promise<string> {
      const result = await execPdfTool('pdfinfo', [pdfPath], 'Poppler pdfinfo');
      return String(result.stdout ?? '');
    },
    async pdfToText(pdfPath: string, pageNumber: number): Promise<string> {
      const args = ['-f', String(pageNumber), '-l', String(pageNumber), '-layout', '-enc', 'UTF-8', pdfPath, '-'];
      const result = await execPdfTool('pdftotext', args, 'Poppler pdftotext');
      return String(result.stdout ?? '');
    },
    async probeRender(pdfPath: string, pageNumber: number): Promise<boolean> {
      const tempDir = await mkdtemp(join(tmpdir(), 'foundry-pdf-probe-'));
      const outputPrefix = join(tempDir, 'page');
      try {
        await execPdfTool(
          'pdftoppm',
          ['-f', String(pageNumber), '-l', String(pageNumber), '-singlefile', '-png', pdfPath, outputPrefix],
          'Poppler pdftoppm',
        );
        return true;
      } catch {
        return false;
      } finally {
        await rm(tempDir, { recursive: true, force: true });
      }
    },
    async ocrPage(pdfPath: string, pageNumber: number, options?: { languageHint?: string }): Promise<OcrPageResult> {
      const tesseractAvailable = await isCommandAvailable('tesseract');
      if (!tesseractAvailable) {
        return {
          available: false,
          engine: 'missing',
          reason: 'tesseract binary is not available on this machine',
          text: '',
          blocks: [],
          pageWidth: 0,
          pageHeight: 0,
        };
      }

      const tempDir = await mkdtemp(join(tmpdir(), 'foundry-pdf-ocr-'));
      const imagePrefix = join(tempDir, 'page');
      const imagePath = `${imagePrefix}.png`;

      try {
        await execPdfTool(
          'pdftoppm',
          ['-f', String(pageNumber), '-l', String(pageNumber), '-singlefile', '-png', '-r', '200', pdfPath, imagePrefix],
          'Poppler pdftoppm',
        );

        const languages = resolveTesseractLanguages(options?.languageHint);
        const tsvResult = await execPdfTool(
          'tesseract',
          addTesseractArgs([imagePath, 'stdout', '--psm', '3', '-l', languages, 'tsv']),
          'Tesseract OCR',
        ).catch((error: any) => {
          if (typeof error?.stdout === 'string' && error.stdout.trim().length > 0) {
            return { stdout: error.stdout };
          }
          throw error;
        });

        const tsv = String((tsvResult as { stdout?: string }).stdout ?? '');
        const parsed = parseTesseractTsv(tsv);
        return {
          available: true,
          engine: 'tesseract',
          text: parsed.text,
          blocks: parsed.blocks,
          pageWidth: parsed.pageWidth,
          pageHeight: parsed.pageHeight,
          tsv,
        };
      } catch (error) {
        return {
          available: true,
          engine: 'tesseract',
          reason: error instanceof Error ? error.message : String(error),
          text: '',
          blocks: [],
          pageWidth: 0,
          pageHeight: 0,
        };
      } finally {
        await rm(tempDir, { recursive: true, force: true });
      }
    },
  };
}

function execPdfTool(command: 'pdfinfo' | 'pdftotext' | 'pdftoppm' | 'tesseract', args: string[], friendlyName: string): Promise<{ stdout?: string }> {
  const toolPath = resolvePdfToolPath(command);
  if (!toolPath) {
    throw new Error(buildMissingToolMessage(command, friendlyName));
  }
  return execFileAsync(toolPath, args, {
    encoding: 'utf8',
    maxBuffer: 20 * 1024 * 1024,
  });
}

function resolvePdfToolPath(command: 'pdfinfo' | 'pdftotext' | 'pdftoppm' | 'tesseract'): string | null {
  const envVar = TOOL_ENV_VARS[command];
  const envValue = process.env[envVar]?.trim();
  if (envValue && existsSync(envValue)) {
    return resolve(envValue);
  }

  const toolchainDir = process.env.PDF_TOOLCHAIN_DIR?.trim();
  if (toolchainDir) {
    const candidates = command === 'tesseract'
      ? [join(toolchainDir, command), join(toolchainDir, `${command}.exe`), join(toolchainDir, 'bin', command), join(toolchainDir, 'bin', `${command}.exe`)]
      : [join(toolchainDir, command), join(toolchainDir, `${command}.exe`), join(toolchainDir, 'bin', command), join(toolchainDir, 'bin', `${command}.exe`)];
    for (const candidate of candidates) {
      if (existsSync(candidate)) return candidate;
    }
  }

  return process.platform === 'win32' ? `${command}.exe` : command;
}

function buildMissingToolMessage(command: string, friendlyName: string): string {
  const hint = command === 'tesseract'
    ? 'Installiere Tesseract oder setze TESSERACT_BIN/PDF_TOOLCHAIN_DIR.'
    : 'Installiere Poppler oder setze PDFINFO_BIN/PDFTOTEXT_BIN/PDFTOPPM_BIN/PDF_TOOLCHAIN_DIR.';
  return `${friendlyName} nicht gefunden (${command}). ${hint}`;
}

async function isCommandAvailable(command: string): Promise<boolean> {
  const resolved = resolvePdfToolPath(command as 'pdfinfo' | 'pdftotext' | 'pdftoppm' | 'tesseract');
  if (!resolved) {
    return false;
  }
  try {
    await execFileAsync(resolved, ['--version'], { encoding: 'utf8', maxBuffer: 1024 * 1024 });
    return true;
  } catch {
    return false;
  }
}

function addTesseractArgs(args: string[]): string[] {
  const tesseractDataDir = process.env.TESSDATA_PREFIX?.trim();
  if (!tesseractDataDir) {
    return args;
  }
  return [...args, '--tessdata-dir', tesseractDataDir];
}

function resolveTesseractLanguages(languageHint?: string): string {
  const hint = languageHint?.trim().toLowerCase();
  if (!hint) {
    return 'deu+eng';
  }

  if (hint.startsWith('de')) {
    return 'deu+eng';
  }
  if (hint.startsWith('en')) {
    return 'eng+deu';
  }

  return 'deu+eng';
}

interface TesseractWordRow {
  blockNum: number;
  parNum: number;
  lineNum: number;
  wordNum: number;
  left: number;
  top: number;
  width: number;
  height: number;
  confidence: number;
  text: string;
}

interface LineGroup {
  key: string;
  blockNum: number;
  parNum: number;
  lineNum: number;
  words: TesseractWordRow[];
}

interface OcrLine {
  text: string;
  bbox: { x: number; y: number; w: number; h: number };
  confidence: number;
  blockNum: number;
  parNum: number;
  lineNum: number;
  top: number;
  bottom: number;
}

interface OcrCluster {
  lines: OcrLine[];
  bbox: { x: number; y: number; w: number; h: number };
  text: string;
  confidence: number;
  kind: OcrBlockKind;
}

function parseTesseractTsv(tsv: string): { text: string; blocks: OcrBlock[]; pageWidth: number; pageHeight: number } {
  const lines = tsv.split(/\r?\n/).map((line) => line.trimEnd()).filter(Boolean);
  if (lines.length <= 1) {
    return { text: '', blocks: [], pageWidth: 0, pageHeight: 0 };
  }

  const wordRows: TesseractWordRow[] = [];
  let pageWidth = 0;
  let pageHeight = 0;

  for (const row of lines.slice(1)) {
    const columns = row.split('\t');
    if (columns.length < 12) {
      continue;
    }

    const level = Number.parseInt(columns[0] ?? '0', 10);
    if (level === 1) {
      const width = Number.parseInt(columns[8] ?? '0', 10);
      const height = Number.parseInt(columns[9] ?? '0', 10);
      if (Number.isFinite(width) && width > 0) pageWidth = width;
      if (Number.isFinite(height) && height > 0) pageHeight = height;
      continue;
    }

    if (level !== 5) {
      continue;
    }

    const wordNum = Number.parseInt(columns[5] ?? '0', 10);
    const text = String(columns[11] ?? '').trim();
    if (!text) {
      continue;
    }

    wordRows.push({
      blockNum: Number.parseInt(columns[2] ?? '0', 10),
      parNum: Number.parseInt(columns[3] ?? '0', 10),
      lineNum: Number.parseInt(columns[4] ?? '0', 10),
      wordNum,
      left: Number.parseInt(columns[6] ?? '0', 10),
      top: Number.parseInt(columns[7] ?? '0', 10),
      width: Number.parseInt(columns[8] ?? '0', 10),
      height: Number.parseInt(columns[9] ?? '0', 10),
      confidence: Number.parseFloat(columns[10] ?? '0'),
      text,
    });
  }

  const lineGroups = groupWordsByLine(wordRows);
  const clusters = clusterLinesIntoBlocks(lineGroups, pageHeight, pageWidth);
  const blocks = expandClustersWithIllustrationBlocks(clusters, pageWidth, pageHeight);
  const text = blocks.map((block) => block.text).filter(Boolean).join('\n\n');
  return { text, blocks, pageWidth, pageHeight };
}

export function parseTesseractTsvForTest(tsv: string): { text: string; blocks: OcrBlock[]; pageWidth: number; pageHeight: number } {
  return parseTesseractTsv(tsv);
}

function groupWordsByLine(wordRows: TesseractWordRow[]): OcrLine[] {
  const groups = new Map<string, LineGroup>();
  for (const word of wordRows) {
    const key = `${word.blockNum}:${word.parNum}:${word.lineNum}`;
    const group = groups.get(key) ?? {
      key,
      blockNum: word.blockNum,
      parNum: word.parNum,
      lineNum: word.lineNum,
      words: [],
    };
    group.words.push(word);
    groups.set(key, group);
  }

  const lines: OcrLine[] = [];
  for (const group of Array.from(groups.values()).sort((left, right) => compareLineGroup(left, right))) {
    const words = group.words.sort((left, right) => left.wordNum - right.wordNum);
    const bbox = unionBbox(words);
    const text = words.map((word) => word.text).join(' ').replace(/\s+/g, ' ').trim();
    if (!text) {
      continue;
    }

    const confidence = average(words.map((word) => (Number.isFinite(word.confidence) ? Math.max(0, word.confidence) : 0)));
    lines.push({
      text,
      bbox,
      confidence,
      blockNum: group.blockNum,
      parNum: group.parNum,
      lineNum: group.lineNum,
      top: bbox.y,
      bottom: bbox.y + bbox.h,
    });
  }

  return lines;
}

function clusterLinesIntoBlocks(lines: OcrLine[], pageHeight: number, pageWidth: number): OcrCluster[] {
  if (lines.length === 0) {
    return [];
  }

  const grouped = new Map<string, OcrLine[]>();
  for (const line of lines) {
    const key = `${line.blockNum}:${line.parNum}`;
    const bucket = grouped.get(key) ?? [];
    bucket.push(line);
    grouped.set(key, bucket);
  }

  const result: OcrCluster[] = [];
  for (const clusterLines of Array.from(grouped.values())) {
    const splitClusters = splitHeadingFromBody(clusterLines, pageHeight);
    for (const split of splitClusters) {
      result.push(makeCluster(split));
    }
  }

  return result;
}

function expandClustersWithIllustrationBlocks(clusters: OcrCluster[], pageWidth: number, pageHeight: number): OcrBlock[] {
  const blocks: OcrBlock[] = [];
  let readingOrder = 1;

  for (let index = 0; index < clusters.length; index += 1) {
    const cluster = clusters[index];
    blocks.push({
      kind: cluster.kind,
      text: cluster.text,
      bbox: cluster.bbox,
      confidence: cluster.confidence,
      readingOrder,
      source: 'ocr',
    });
    readingOrder += 1;

    const next = clusters[index + 1];
    if (!next) {
      continue;
    }

    const gapTop = cluster.bbox.y + cluster.bbox.h;
    const gapHeight = next.bbox.y - gapTop;
    if (gapHeight >= Math.max(180, Math.round(pageHeight * 0.22))) {
      blocks.push({
        kind: 'illustration',
        text: '',
        bbox: {
          x: 0,
          y: gapTop,
          w: pageWidth,
          h: gapHeight,
        },
        confidence: 0.12,
        readingOrder,
        source: 'ocr',
      });
      readingOrder += 1;
    }
  }

  return blocks;
}

function splitHeadingFromBody(lines: OcrLine[], pageHeight: number): OcrLine[][] {
  if (lines.length < 2) {
    return [lines];
  }

  const first = lines[0];
  const rest = lines.slice(1);
  const headingCandidate = isHeadingLike(first.text) && first.bbox.y < pageHeight * 0.28;
  const second = rest[0];
  const gap = second ? second.bbox.y - (first.bbox.y + first.bbox.h) : 0;

  if (headingCandidate && rest.length > 0 && gap >= 0) {
    return [[first], rest];
  }

  return [lines];
}

function makeCluster(lines: OcrLine[]): OcrCluster {
  const bbox = unionBbox(lines.map((line) => ({
    left: line.bbox.x,
    top: line.bbox.y,
    width: line.bbox.w,
    height: line.bbox.h,
  })));
  const text = lines.map((line) => line.text).join('\n').replace(/\s+\n/g, '\n').trim();
  const confidence = average(lines.map((line) => line.confidence));
  const kind = classifyClusterKind(lines, text);
  return { lines, bbox, text, confidence, kind };
}

function classifyClusterKind(lines: OcrLine[], text: string): OcrBlockKind {
  if (!text) {
    return 'unknown';
  }

  if (looksLikeDecoration(text)) {
    return 'decoration';
  }

  if (looksLikeList(text)) {
    return 'list';
  }

  const firstLine = lines[0]?.text ?? text;
  const totalLength = text.replace(/\s+/g, ' ').trim().length;
  const short = totalLength <= 90 && lines.length <= 2;
  if (short && isHeadingLike(firstLine)) {
    return 'heading';
  }

  return 'paragraph';
}

function shouldStartNewCluster(previous: OcrLine, current: OcrLine, pageHeight: number): boolean {
  const gap = current.bbox.y - (previous.bbox.y + previous.bbox.h);
  if (gap >= Math.max(18, previous.bbox.h * 1.8, pageHeight * 0.015)) {
    return true;
  }

  const previousHeading = isHeadingLike(previous.text);
  const currentHeading = isHeadingLike(current.text);
  if (previousHeading && !currentHeading && previous.bbox.y < pageHeight * 0.22) {
    return true;
  }

  return false;
}

function compareLineGroup(left: LineGroup, right: LineGroup): number {
  if (left.blockNum !== right.blockNum) {
    return left.blockNum - right.blockNum;
  }
  if (left.parNum !== right.parNum) {
    return left.parNum - right.parNum;
  }
  return left.lineNum - right.lineNum;
}

function unionBbox(items: Array<{ left: number; top: number; width: number; height: number }>): { x: number; y: number; w: number; h: number } {
  if (items.length === 0) {
    return { x: 0, y: 0, w: 0, h: 0 };
  }

  const left = Math.min(...items.map((item) => item.left));
  const top = Math.min(...items.map((item) => item.top));
  const right = Math.max(...items.map((item) => item.left + item.width));
  const bottom = Math.max(...items.map((item) => item.top + item.height));
  return {
    x: left,
    y: top,
    w: Math.max(0, right - left),
    h: Math.max(0, bottom - top),
  };
}

function average(values: number[]): number {
  const filtered = values.filter((value) => Number.isFinite(value));
  if (filtered.length === 0) {
    return 0;
  }
  return filtered.reduce((sum, value) => sum + value, 0) / filtered.length;
}

function isHeadingLike(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) {
    return false;
  }
  if (trimmed.length > 90) {
    return false;
  }
  if (/^\d+(\.\d+)*\s+/.test(trimmed)) {
    return true;
  }
  if (/^(kapitel|szene|szenario|ort|personen|nsc|meisterwissen)\b/i.test(trimmed)) {
    return true;
  }

  const words = trimmed.split(/\s+/).filter(Boolean);
  const shortEnough = words.length <= 10;
  const titleCase = /[A-ZÄÖÜ]/.test(trimmed[0] ?? '');
  const mostlyUpper = trimmed === trimmed.toUpperCase() && trimmed.length > 2;
  return (mostlyUpper || (shortEnough && titleCase)) && !looksLikeList(trimmed);
}

function looksLikeList(text: string): boolean {
  return /^[•\-*+]\s+/.test(text.trim()) || /^\d+[\).]\s+/.test(text.trim());
}

function looksLikeDecoration(text: string): boolean {
  const trimmed = text.replace(/\s+/g, ' ').trim();
  if (!trimmed) {
    return false;
  }

  const letters = (trimmed.match(/[A-Za-zÄÖÜäöüß]/g) ?? []).length;
  const digits = (trimmed.match(/[0-9]/g) ?? []).length;
  const symbols = trimmed.length - letters - digits;
  const hasGarbageMarkers = /[©®~_—–=<>|]/.test(trimmed) || /^[\W_]+$/.test(trimmed);

  return trimmed.length <= 40 && hasGarbageMarkers && letters <= 4 && symbols >= Math.max(6, Math.floor(trimmed.length * 0.5));
}
