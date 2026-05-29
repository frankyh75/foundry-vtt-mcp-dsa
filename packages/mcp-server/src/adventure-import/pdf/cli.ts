#!/usr/bin/env node

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { parseArgs } from 'node:util';
import { buildPdfImportIr } from './pipeline.js';
import { createDefaultPdfToolRunner } from './tooling.js';

export interface PdfImportCliResult {
  outputPath: string;
  annotationStorePath: string;
}

export async function runPdfImportCli(argv = process.argv.slice(2)): Promise<PdfImportCliResult> {
  const args = parseArgs({
    args: argv,
    options: {
      pdf: { type: 'string' },
      out: { type: 'string' },
      help: { type: 'boolean', short: 'h' },
    },
    allowPositionals: true,
  });

  if (args.values.help || !args.values.pdf || !args.values.out) {
    throw new Error('Usage: pdf:import --pdf <path-to-pdf> --out <path-to-json-or-dir>');
  }

  const runner = createDefaultPdfToolRunner();
  const result = await buildPdfImportIr({
    pdfPath: args.values.pdf,
    outPath: args.values.out,
    runner,
  });

  await mkdir(dirname(result.outputPath), { recursive: true });
  await mkdir(dirname(result.annotationStorePath), { recursive: true });
  await writeFile(result.outputPath, `${JSON.stringify(result.ir, null, 2)}\n`, 'utf8');
  await writeFile(result.annotationStorePath, `${JSON.stringify(result.annotationStore, null, 2)}\n`, 'utf8');

  process.stdout.write(`${result.outputPath}\n`);
  process.stdout.write(`${result.annotationStorePath}\n`);

  return {
    outputPath: result.outputPath,
    annotationStorePath: result.annotationStorePath,
  };
}

async function main(): Promise<void> {
  try {
    await runPdfImportCli();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    process.exitCode = 1;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  void main();
}
