import { useEffect, useMemo, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';

type PdfBBox = { x: number; y: number; w: number; h: number };

type PdfBlock = {
  id: string;
  pageNumber: number;
  bbox: PdfBBox;
  readingOrder: number;
  blockType: string;
  roleHint?: string;
  textRaw: string;
  textNormalized: string;
  confidence: number;
};

type PdfPage = {
  id?: string;
  pageNumber: number;
  width: number;
  height: number;
  imagePath?: string;
};

type PdfAnnotation = {
  id: string;
  targetType: 'document' | 'page' | 'block' | 'section' | 'entityCandidate' | 'entityStub';
  targetId: string;
  action: 'relabel' | 'split' | 'merge' | 'mark_stub' | 'ignore' | 'fix_reading_order' | 'promote_candidate' | 'reject_candidate';
  payload: Record<string, unknown>;
  comment?: string;
  author: string;
  createdAt: string;
  source: string;
  sourceBlockIds: string[];
  confidence: number;
  provenance: { producer: string; rule: string; details?: string };
};

type PdfIr = {
  irVersion: string;
  document: {
    id: string;
    sourcePath: string;
    sourceHash: string;
    pageCount: number;
    defaultLanguage?: string;
    profile?: string;
    createdAt?: string;
  };
  pages: PdfPage[];
  blocks: PdfBlock[];
  annotations?: PdfAnnotation[];
  importPlan?: Array<Record<string, unknown>>;
  entityCandidates?: Array<Record<string, unknown>>;
  entityStubs?: Array<Record<string, unknown>>;
};

type DraftSelection = {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
};

type UiAnnotation = PdfAnnotation;

const blockTypeOptions = [
  'heading',
  'paragraph',
  'list',
  'stat_block',
  'read_aloud',
  'sidebar',
  'table_like',
  'illustration',
  'decoration',
  'footer',
  'header',
  'unknown',
] as const;

const stubTypeOptions = ['npc_stub', 'location_stub', 'scene_stub'] as const;

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/legacy/build/pdf.worker.mjs',
  import.meta.url
).toString();

const emptyIr: PdfIr = {
  irVersion: 'adventure-layout-ir.v1',
  document: {
    id: 'unloaded',
    sourcePath: '',
    sourceHash: '',
    pageCount: 0,
  },
  pages: [],
  blocks: [],
  annotations: [],
  importPlan: [],
  entityCandidates: [],
  entityStubs: [],
};

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const pdfDocRef = useRef<pdfjsLib.PDFDocumentProxy | null>(null);
  const irRef = useRef<PdfIr>(emptyIr);

  const [ir, setIr] = useState<PdfIr>(emptyIr);
  const [pdfName, setPdfName] = useState('Kein PDF geladen');
  const [pageNumber, setPageNumber] = useState(1);
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [annotations, setAnnotations] = useState<UiAnnotation[]>([]);
  const [status, setStatus] = useState('Bereit. PDF und IR laden.');
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<DraftSelection | null>(null);
  const [draftMode, setDraftMode] = useState<'split' | 'relabel' | 'merge' | 'mark_stub' | 'ignore'>('split');
  const [selectedBlockType, setSelectedBlockType] = useState<'unknown' | (typeof blockTypeOptions)[number]>('unknown');
  const [selectedStubType, setSelectedStubType] = useState<(typeof stubTypeOptions)[number]>('npc_stub');
  const [readingOrder, setReadingOrder] = useState('1');
  const [comment, setComment] = useState('');

  const currentPage = useMemo(
    () => ir.pages.find((page) => page.pageNumber === pageNumber) ?? null,
    [ir.pages, pageNumber]
  );

  const visibleBlocks = useMemo(
    () => ir.blocks.filter((block) => block.pageNumber === pageNumber).slice().sort((a, b) => a.readingOrder - b.readingOrder),
    [ir.blocks, pageNumber]
  );

  const selectedBlock = useMemo(
    () => visibleBlocks.find((block) => block.id === selectedBlockId) ?? null,
    [visibleBlocks, selectedBlockId]
  );

  useEffect(() => {
    irRef.current = ir;
    const stored = window.localStorage.getItem(storageKey(ir.document.id));
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as UiAnnotation[];
        setAnnotations(mergeAnnotations(ir.annotations ?? [], parsed));
      } catch {
        setAnnotations(ir.annotations ?? []);
      }
    } else {
      setAnnotations(ir.annotations ?? []);
    }
  }, [ir]);

  useEffect(() => {
    void renderCurrentPage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageNumber, ir, annotations]);

  async function renderCurrentPage() {
    const canvas = canvasRef.current;
    if (!canvas || !pdfDocRef.current || !currentPage) {
      return;
    }

    const page = await pdfDocRef.current.getPage(pageNumber);
    const viewport = page.getViewport({ scale: 1 });
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    canvas.style.width = `${Math.ceil(viewport.width)}px`;
    canvas.style.height = `${Math.ceil(viewport.height)}px`;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    await page.render({ canvasContext: ctx, viewport }).promise;
  }

  async function handlePdfFile(file: File | null) {
    if (!file) return;
    setPdfName(file.name);
    setStatus(`Lade PDF ${file.name}...`);
    const arrayBuffer = await file.arrayBuffer();
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    const doc = await loadingTask.promise;
    pdfDocRef.current = doc;
    setStatus(`PDF geladen: ${file.name} (${doc.numPages} Seiten)`);
    if (ir.document.pageCount && pageNumber > ir.document.pageCount) {
      setPageNumber(1);
    }
  }

  async function handleIrFile(file: File | null) {
    if (!file) return;
    setStatus(`Lade IR ${file.name}...`);
    const text = await file.text();
    const parsed = JSON.parse(text) as PdfIr;
    setIr(parsed);
    setPageNumber(parsed.pages?.[0]?.pageNumber ?? 1);
    setSelectedBlockId(null);
    setStatus(`IR geladen: ${parsed.document?.id ?? file.name}`);
  }

  function persistAnnotations(next: UiAnnotation[]) {
    setAnnotations(next);
    window.localStorage.setItem(storageKey(irRef.current.document.id), JSON.stringify(next, null, 2));
  }

  function appendAnnotation(annotation: UiAnnotation) {
    persistAnnotations(mergeAnnotations(annotations, [annotation]));
  }

  function createAnnotation(action: UiAnnotation['action'], payload: Record<string, unknown>, targetType: UiAnnotation['targetType']) {
    const targetId =
      targetType === 'page'
        ? (currentPage?.id ?? `page-${pageNumber}`)
        : selectedBlock?.id ?? currentPage?.id ?? `page-${pageNumber}`;
    const sourceBlockIds = selectedBlock ? [selectedBlock.id] : [];
    const next: UiAnnotation = {
      id: crypto.randomUUID(),
      targetType,
      targetId,
      action,
      payload,
      comment: comment.trim() || undefined,
      author: 'Jarvis/UI',
      createdAt: new Date().toISOString(),
      source: 'manual_annotation',
      sourceBlockIds,
      confidence: 1,
      provenance: { producer: 'pdf-review-ui', rule: `ui.${action}.v1` },
    };
    appendAnnotation(next);
    setStatus(`Annotation gespeichert: ${action}`);
  }

  function handleBlockClick(blockId: string) {
    setSelectedBlockId(blockId);
    const block = visibleBlocks.find((item) => item.id === blockId);
    if (block) {
      setSelectedBlockType(block.blockType as typeof blockTypeOptions[number]);
      setReadingOrder(String(block.readingOrder));
    }
  }

  function handleOverlayPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    const bounds = event.currentTarget.getBoundingClientRect();
    const startX = event.clientX - bounds.left;
    const startY = event.clientY - bounds.top;
    setDraft({ startX, startY, endX: startX, endY: startY });
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handleOverlayPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (!draft) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    setDraft({
      ...draft,
      endX: event.clientX - bounds.left,
      endY: event.clientY - bounds.top,
    });
  }

  function handleOverlayPointerUp() {
    if (!draft) return;
    const x = Math.min(draft.startX, draft.endX);
    const y = Math.min(draft.startY, draft.endY);
    const w = Math.abs(draft.endX - draft.startX);
    const h = Math.abs(draft.endY - draft.startY);
    if (w > 8 && h > 8) {
      const targetType: UiAnnotation['targetType'] = selectedBlock ? 'block' : 'page';
      createAnnotation('split', { bbox: { x, y, w, h }, note: 'Manuell gezeichneter Bereich' }, targetType);
      setStatus('Bereich gezeichnet und als Split-Anmerkung gespeichert.');
    }
    setDraft(null);
  }

  function exportAnnotations() {
    const blob = new Blob([`${JSON.stringify(annotations, null, 2)}\n`], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${ir.document.id || 'pdf'}-annotations.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const pageWidth = currentPage?.width ?? canvasRef.current?.width ?? 0;
  const pageHeight = currentPage?.height ?? canvasRef.current?.height ?? 0;

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <h1>Foundry PDF Review UI</h1>
          <p>Lokale 2-Spalten-Ansicht mit PDF, Overlays, JSON und Annotationen.</p>
        </div>
        <div className="topbar-actions">
          <label className="file-button">
            PDF laden
            <input type="file" accept="application/pdf" onChange={(e) => void handlePdfFile(e.target.files?.[0] ?? null)} />
          </label>
          <label className="file-button">
            IR laden
            <input type="file" accept="application/json" onChange={(e) => void handleIrFile(e.target.files?.[0] ?? null)} />
          </label>
          <button type="button" onClick={exportAnnotations}>Annotationen exportieren</button>
        </div>
      </header>

      <div className="statusbar">
        <span>{status}</span>
        <span>{error ?? ''}</span>
      </div>

      <main className="workspace">
        <section className="viewer-column">
          <div className="viewer-toolbar">
            <span><strong>PDF:</strong> {pdfName}</span>
            <div className="page-controls">
              <button type="button" onClick={() => setPageNumber((p) => Math.max(1, p - 1))}>◀</button>
              <input
                type="number"
                min={1}
                value={pageNumber}
                onChange={(e) => setPageNumber(Math.max(1, Number(e.target.value) || 1))}
              />
              <span>/ {ir.document.pageCount || '–'}</span>
              <button type="button" onClick={() => setPageNumber((p) => Math.min(ir.document.pageCount || p + 1, p + 1))}>▶</button>
            </div>
          </div>

          <div className="page-stage" style={{ width: pageWidth || undefined, minHeight: pageHeight || undefined }}>
            <canvas ref={canvasRef} className="pdf-canvas" />
            <div
              ref={overlayRef}
              className="overlay"
              style={{ width: pageWidth || undefined, height: pageHeight || undefined }}
              onPointerDown={handleOverlayPointerDown}
              onPointerMove={handleOverlayPointerMove}
              onPointerUp={handleOverlayPointerUp}
            >
              {visibleBlocks.map((block) => {
                const isSelected = block.id === selectedBlockId;
                return (
                  <button
                    key={block.id}
                    type="button"
                    className={`block-box block-${block.blockType} ${isSelected ? 'selected' : ''}`}
                    style={{
                      left: block.bbox.x,
                      top: block.bbox.y,
                      width: block.bbox.w,
                      height: block.bbox.h,
                    }}
                    onClick={() => handleBlockClick(block.id)}
                    title={`${block.blockType} · ${block.textNormalized || block.textRaw}`}
                  >
                    <span className="block-label">{block.blockType}</span>
                    <span className="block-meta">#{block.readingOrder}</span>
                  </button>
                );
              })}
              {draft ? (
                <div
                  className="draft-box"
                  style={{
                    left: Math.min(draft.startX, draft.endX),
                    top: Math.min(draft.startY, draft.endY),
                    width: Math.abs(draft.endX - draft.startX),
                    height: Math.abs(draft.endY - draft.startY),
                  }}
                />
              ) : null}
            </div>
          </div>
        </section>

        <section className="detail-column">
          <div className="panel">
            <h2>Ausgewählter Block</h2>
            {selectedBlock ? (
              <>
                <div className="detail-grid">
                  <label>
                    Kategorie
                    <select value={selectedBlockType} onChange={(e) => setSelectedBlockType(e.target.value as typeof selectedBlockType)}>
                      {blockTypeOptions.map((value) => (
                        <option key={value} value={value}>{value}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Reading Order
                    <input type="number" value={readingOrder} onChange={(e) => setReadingOrder(e.target.value)} />
                  </label>
                  <label>
                    Stub-Typ
                    <select value={selectedStubType} onChange={(e) => setSelectedStubType(e.target.value as typeof selectedStubType)}>
                      {stubTypeOptions.map((value) => (
                        <option key={value} value={value}>{value}</option>
                      ))}
                    </select>
                  </label>
                </div>
                <textarea
                  className="comment-box"
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Kommentar für spätere Regeln oder Prüfung"
                />
                <div className="action-row">
                  <button type="button" onClick={() => createAnnotation('relabel', { blockType: selectedBlockType }, 'block')}>Reclassify</button>
                  <button type="button" onClick={() => createAnnotation('ignore', { reason: 'decorative or irrelevant' }, 'block')}>Ignore</button>
                  <button type="button" onClick={() => createAnnotation('mark_stub', { stubType: selectedStubType, label: selectedBlock.textNormalized || selectedBlock.textRaw }, 'block')}>Mark as stub</button>
                  <button type="button" onClick={() => createAnnotation('fix_reading_order', { readingOrder: Number(readingOrder) || selectedBlock.readingOrder }, 'block')}>Fix order</button>
                </div>
                <pre className="json-block">{JSON.stringify(selectedBlock, null, 2)}</pre>
              </>
            ) : (
              <p>Kein Block ausgewählt.</p>
            )}
          </div>

          <div className="panel">
            <h2>IR / JSON</h2>
            <pre className="json-block">{JSON.stringify({ ...ir, annotations, currentPage: currentPage?.pageNumber ?? null }, null, 2)}</pre>
          </div>

          <div className="panel">
            <h2>Annotationen</h2>
            <ul className="annotation-list">
              {annotations.map((annotation) => (
                <li key={annotation.id}>
                  <strong>{annotation.action}</strong> · {annotation.targetType}:{annotation.targetId}
                  <div>{annotation.comment ?? annotation.provenance.rule}</div>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </main>
    </div>
  );
}

function mergeAnnotations(base: UiAnnotation[], extra: UiAnnotation[]): UiAnnotation[] {
  const map = new Map<string, UiAnnotation>();
  for (const item of base) map.set(item.id, item);
  for (const item of extra) map.set(item.id, item);
  return Array.from(map.values()).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

function storageKey(documentId: string): string {
  return `foundry-pdf-review-ui:${documentId || 'unloaded'}`;
}
