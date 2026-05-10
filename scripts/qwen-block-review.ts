import { z } from 'zod';

/**
 * Qwen Block Review — Test der 3-Schicht-Trennung
 * Layer 1: OCR/Heuristik (bereits in projected.ir.json)
 * Layer 2: LLM-Review (Qwen korrigiert roleHint, merged/split, OCR-Fehler)
 * Layer 3: Schema-Validierung (Zod)
 */

const ReviewResultSchema = z.object({
  reviews: z.array(z.object({
    blockId: z.string(),
    action: z.enum(['keep', 'merge_with_next', 'split', 'reclassify', 'drop']),
    correctedRoleHint: z.string().optional(),
    correctedText: z.string().optional(),
    confidenceAdjustment: z.number().min(0).max(1).optional(),
    reasoning: z.string(),
  })),
  summary: z.object({
    totalBlocks: z.number(),
    changedBlocks: z.number(),
    mergedBlocks: z.number().optional(),
    splitBlocks: z.number().optional(),
    droppedBlocks: z.number().optional(),
  }),
});

type ReviewResult = z.infer<typeof ReviewResultSchema>;

interface IRBlock {
  id: string;
  pageNumber: number;
  readingOrder: number;
  blockType: string | null;
  roleHint: string | null;
  textNormalized: string;
  confidence: number;
  provenance: { producer: string; rule: string };
  bbox: { x: number; y: number; w: number; h: number };
}

function buildReviewPrompt(blocks: IRBlock[], pageNumber: number): string {
  const blocksText = blocks
    .sort((a, b) => a.readingOrder - b.readingOrder)
    .map(b => `--- Block ${b.id} ---
readingOrder: ${b.readingOrder}
blockType: ${b.blockType || 'null'}
roleHint: ${b.roleHint || 'null'}
text: "${b.textNormalized.replace(/"/g, '\\"')}"
confidence: ${b.confidence.toFixed(3)}
provenance: ${b.provenance.producer} / ${b.provenance.rule}
---`)
    .join('\n');

  return `Du bist ein OCR-Review-Assistent für ein deutsches Rollenspiel-PDF.
Du bekommst vorab extrahierte Text-Blöcke mit Heuristik-Klassifikationen.
Deine Aufgabe ist es, die Blöcke zu prüfen und Korrekturen vorzuschlagen.

Regeln:
- "keep": Block ist korrekt klassifiziert und Text ist sauber
- "merge_with_next": Block gehört inhaltlich zum nächsten Block (z.B. Header + Fließtext)
- "split": Block enthält zwei verschiedene Inhalte (z.B. zwei NPCs in einem Absatz)
- "reclassify": roleHint/blockType ist falsch (z.B. "npc_profile" statt "location")
- "drop": Block ist Müll/Leerzeichen/Fußzeile ohne Inhalt
- "correctedText": Korrigiere offensichtliche OCR-Fehler (z.B. "gehört" statt "gehört")
- "correctedRoleHint": Besserer Typ wenn reclassify

Gültige roleHints: heading, narrative, location, npc_profile, npc_name, item, rules, handout, unknown

Seite ${pageNumber}:
${blocksText}

Antworte NUR als gültiges JSON im folgenden Schema. Kein Markdown, keine Erklärungen außerhalb des JSON.
`;
}

async function callQwen(systemPrompt: string, userPrompt: string, signal?: AbortSignal): Promise<string> {
  const res = await fetch('http://127.0.0.1:11434/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'qwen2.5:7b-instruct',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.1,
      max_tokens: 4096,
      response_format: { type: 'json_object' },
    }),
    signal,
  });

  if (!res.ok) {
    throw new Error(`Qwen HTTP ${res.status}: ${await res.text()}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content || '';
}

export async function reviewPageBlocks(
  blocks: IRBlock[],
  pageNumber: number,
  timeoutMs = 120_000,
): Promise<ReviewResult> {
  const prompt = buildReviewPrompt(blocks, pageNumber);
  const system = 'Du bist ein präziser Review-Assistent für OCR-Blöcke. Du antwortest ausschließlich in JSON.';

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const raw = await callQwen(system, prompt, controller.signal);
    clearTimeout(timer);

    const parsed = JSON.parse(raw);
    const validated = ReviewResultSchema.parse(parsed);
    return validated;
  } catch (err) {
    clearTimeout(timer);
    if (err instanceof z.ZodError) {
      console.error('Schema validation failed:', err.issues);
    }
    throw err;
  }
}

// CLI-Entrypoint
async function main() {
  const irPath = process.argv[2] || '/Users/openclaw/.foundry-mcp/pdf-review/Deicherbe1/projected.ir.json';
  const pageNum = parseInt(process.argv[3] || '6', 10);

  const fs = await import('fs');
  const ir = JSON.parse(fs.readFileSync(irPath, 'utf-8'));

  const pageBlocks: IRBlock[] = ir.blocks.filter((b: IRBlock) => b.pageNumber === pageNum);
  console.error(`Reviewing ${pageBlocks.length} blocks on page ${pageNum}...`);

  const start = Date.now();
  const result = await reviewPageBlocks(pageBlocks, pageNum);
  const elapsed = Date.now() - start;

  console.log(JSON.stringify({ elapsedMs: elapsed, ...result }, null, 2));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(e => { console.error(e); process.exit(1); });
}
