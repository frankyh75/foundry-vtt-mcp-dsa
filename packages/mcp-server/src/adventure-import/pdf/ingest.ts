import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { access } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createDocumentId, createPageId } from './ids.js';
import type { PdfToolRunner } from './tooling.js';

export interface PdfIngestPage {
  id: string;
  documentId: string;
  pageNumber: number;
  width: number;
  height: number;
}

export interface PdfIngestDocument {
  id: string;
  sourcePath: string;
  sourceHash: string;
  pageCount: number;
  defaultLanguage: string;
  profile: string;
  createdAt: string;
  pdfType: 'text' | 'image' | 'mixed' | 'unknown';
}

export interface PdfIngestResult {
  document: PdfIngestDocument;
  pages: PdfIngestPage[];
  pdfInfo: PdfInfoSummary;
}

export interface PdfInfoSummary {
  pageCount: number;
  width: number;
  height: number;
  raw: string;
}

export async function ingestPdf(
  pdfPath: string,
  runner: PdfToolRunner,
  options: {
    defaultLanguage?: string;
    profile?: string;
    createdAt?: string;
  } = {},
): Promise<PdfIngestResult> {
  const sourcePath = resolve(pdfPath);
  await access(sourcePath);
  const sourceHash = await hashFile(sourcePath);
  const pdfInfoRaw = await runner.pdfInfo(sourcePath);
  const pdfInfo = parsePdfInfo(pdfInfoRaw);
  const documentId = createDocumentId(sourcePath, sourceHash);
  const createdAt = options.createdAt ?? new Date().toISOString();
  const pages = Array.from({ length: pdfInfo.pageCount }, (_, index) => {
    const pageNumber = index + 1;
    return {
      id: createPageId(sourcePath, pageNumber),
      documentId,
      pageNumber,
      width: pdfInfo.width,
      height: pdfInfo.height,
    };
  });

  return {
    document: {
      id: documentId,
      sourcePath,
      sourceHash,
      pageCount: pdfInfo.pageCount,
      defaultLanguage: options.defaultLanguage ?? 'de',
      profile: options.profile ?? 'ulisses.heldenwerk.v1',
      createdAt,
      pdfType: 'unknown',
    },
    pages,
    pdfInfo,
  };
}

function parsePdfInfo(raw: string): PdfInfoSummary {
  const pageCountMatch = raw.match(/^Pages:\s+(\d+)/m);
  const pageSizeMatch = raw.match(/^Page size:\s+([\d.]+)\s+x\s+([\d.]+)\s+pts?/m);
  const pageCount = pageCountMatch ? Number.parseInt(pageCountMatch[1], 10) : 0;
  const width = pageSizeMatch ? Number.parseFloat(pageSizeMatch[1]) : 0;
  const height = pageSizeMatch ? Number.parseFloat(pageSizeMatch[2]) : 0;

  return {
    pageCount: Number.isFinite(pageCount) && pageCount > 0 ? pageCount : 0,
    width: Number.isFinite(width) ? width : 0,
    height: Number.isFinite(height) ? height : 0,
    raw,
  };
}

async function hashFile(filePath: string): Promise<string> {
  const hash = createHash('sha256');
  const stream = createReadStream(filePath);

  for await (const chunk of stream) {
    hash.update(chunk as Buffer);
  }

  return `sha256:${hash.digest('hex')}`;
}
