import { useEffect, useMemo, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
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
  source?: string;
  sourceBlockIds?: string[];
  provenance?: { producer: string; rule: string; details?: string };
  links?: { prevBlockId?: string; nextBlockId?: string };
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
  sections?: Array<Record<string, unknown>>;
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

type ViewMode = 'projected' | 'source';
type DraftMode = 'split' | 'relabel' | 'mark_stub' | 'ignore';

type BlockChange = {
  id: string;
  kind: 'added' | 'removed' | 'changed';
  before?: PdfBlock;
  after?: PdfBlock;
  summary: string;
};

type RectLike = { x: number; y: number; w: number; h: number };

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

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/legacy/build/pdf.worker.mjs', import.meta.url).toString();

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
  const pdfDocRef = useRef<pdfjsLib.PDFDocumentProxy | null>(null);
  const irRef = useRef<PdfIr>(emptyIr);

  const [ir, setIr] = useState<PdfIr>(emptyIr);
  const [pdfName, setPdfName] = useState('Kein PDF geladen');
  const [pageNumber, setPageNumber] = useState(1);
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [selectedBlockIds, setSelectedBlockIds] = useState<string[]>([]);
  const [annotations, setAnnotations] = useState<UiAnnotation[]>([]);
  const [status, setStatus] = useState('Bereit. PDF und IR laden.');
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<DraftSelection | null>(null);
  const [draftMode, setDraftMode] = useState<DraftMode>('split');
  const [viewMode, setViewMode] = useState<ViewMode>('projected');
  const [selectedBlockType, setSelectedBlockType] = useState<'unknown' | (typeof blockTypeOptions)[number]>('unknown');
  const [selectedStubType, setSelectedStubType] = useState<(typeof stubTypeOptions)[number]>('npc_stub');
  const [readingOrder, setReadingOrder] = useState('1');
  const [comment, setComment] = useState('');

  const projectedIr = useMemo(() => applyUiAnnotationsToIr(ir, annotations), [ir, annotations]);
  const displayIr = viewMode === 'projected' ? projectedIr : ir;
  const currentPage = useMemo(() => displayIr.pages.find((page) => page.pageNumber === pageNumber) ?? null, [displayIr.pages, pageNumber]);
  const visibleBlocks = useMemo(
    () => displayIr.blocks.filter((block) => block.pageNumber === pageNumber).slice().sort(compareBlocks),
    [displayIr.blocks, pageNumber]
  );
  const selectedBlock = useMemo(
    () => visibleBlocks.find((block) => block.id === selectedBlockId) ?? null,
    [visibleBlocks, selectedBlockId]
  );
  const selectedBlocks = useMemo(
    () => visibleBlocks.filter((block) => selectedBlockIds.includes(block.id)),
    [selectedBlockIds, visibleBlocks]
  );
  const selectedBlockSource = useMemo(() => ir.blocks.find((block) => block.id === selectedBlockId) ?? null, [ir.blocks, selectedBlockId]);
  const selectedBlockProjected = useMemo(
    () => projectedIr.blocks.find((block) => block.id === selectedBlockId) ?? null,
    [projectedIr.blocks, selectedBlockId]
  );
  const blockChanges = useMemo(() => computeBlockChanges(ir.blocks, projectedIr.blocks), [ir.blocks, projectedIr.blocks]);

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
  }, [pageNumber, displayIr.document.id, pdfName]);

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
    setError(null);
    setPdfName(file.name);
    setStatus(`Lade PDF ${file.name}...`);
    const arrayBuffer = await file.arrayBuffer();
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    const doc = await loadingTask.promise;
    pdfDocRef.current = doc;
    setStatus(`PDF geladen: ${file.name} (${doc.numPages} Seiten)`);
    if (pageNumber > doc.numPages) {
      setPageNumber(1);
    }
  }

  async function handleIrFile(file: File | null) {
    if (!file) return;
    setError(null);
    setStatus(`Lade IR ${file.name}...`);
    const text = await file.text();
    const parsed = JSON.parse(text) as PdfIr;
    setIr(parsed);
    setPageNumber(parsed.pages?.[0]?.pageNumber ?? 1);
    setSelectedBlockId(null);
    setSelectedBlockIds([]);
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
        : selectedBlock?.id ?? selectedBlockSource?.id ?? currentPage?.id ?? `page-${pageNumber}`;
    const sourceBlockIds =
      action === 'merge'
        ? selectedBlockIds.length > 1
          ? [...selectedBlockIds]
          : selectedBlock
            ? [selectedBlock.id]
            : []
        : selectedBlock
          ? [selectedBlock.id]
          : selectedBlockSource
            ? [selectedBlockSource.id]
            : [];

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

  function handleBlockClick(blockId: string, event?: { metaKey?: boolean; ctrlKey?: boolean; shiftKey?: boolean }) {
    const modifier = Boolean(event?.metaKey || event?.ctrlKey || event?.shiftKey);
    if (modifier) {
      setSelectedBlockIds((current) => toggleSelection(current, blockId));
    } else {
      setSelectedBlockIds([blockId]);
      setSelectedBlockId(blockId);
    }

    const block = visibleBlocks.find((item) => item.id === blockId);
    if (block) {
      setSelectedBlockId(block.id);
      setSelectedBlockType(block.blockType as typeof blockTypeOptions[number]);
      setReadingOrder(String(block.readingOrder));
    }
  }

  function handleOverlayPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.target !== event.currentTarget) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const startX = event.clientX - bounds.left;
    const startY = event.clientY - bounds.top;
    setDraft({ startX, startY, endX: startX, endY: startY });
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handleOverlayPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
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
    const bbox = selectionToBbox(draft);
    if (bbox.w > 8 && bbox.h > 8) {
      const targetType: UiAnnotation['targetType'] = selectedBlock ? 'block' : 'page';
      const payloadBase = { bbox, note: 'Manuell gezeichneter Bereich' };
      if (draftMode === 'split') {
        createAnnotation('split', payloadBase, targetType);
        setStatus('Bereich gezeichnet und als Split-Anmerkung gespeichert.');
      } else if (draftMode === 'relabel') {
        createAnnotation('relabel', { ...payloadBase, blockType: selectedBlockType }, targetType);
        setStatus('Bereich gezeichnet und als Reclassify-Anmerkung gespeichert.');
      } else if (draftMode === 'mark_stub') {
        createAnnotation('mark_stub', { ...payloadBase, stubType: selectedStubType, label: selectedBlock?.textNormalized || selectedBlock?.textRaw || 'Stub' }, targetType);
        setStatus('Bereich gezeichnet und als Stub-Anmerkung gespeichert.');
      } else {
        createAnnotation('ignore', { ...payloadBase, reason: 'decorative or irrelevant' }, targetType);
        setStatus('Bereich gezeichnet und als Ignore-Anmerkung gespeichert.');
      }
    }
    setDraft(null);
  }

  function applySelectedReclassify() {
    if (!selectedBlock) return;
    createAnnotation(
      'relabel',
      {
        blockType: selectedBlockType,
        roleHint: selectedBlockType === 'stat_block' ? 'npc_profile' : selectedBlockType,
        readingOrder: Number(readingOrder) || selectedBlock.readingOrder,
        sourceBlockId: selectedBlock.id,
      },
      'block'
    );
  }

  function applySelectedReadingOrderFix() {
    if (!selectedBlock) return;
    createAnnotation('fix_reading_order', { readingOrder: Number(readingOrder) || selectedBlock.readingOrder }, 'block');
  }

  function applySelectedStub() {
    if (!selectedBlock) return;
    createAnnotation(
      'mark_stub',
      {
        stubType: selectedStubType,
        label: selectedBlock.textNormalized || selectedBlock.textRaw,
      },
      'block'
    );
  }

  function applySelectedIgnore() {
    if (!selectedBlock) return;
    createAnnotation('ignore', { reason: 'decorative or irrelevant' }, 'block');
  }

  function applyMergeSelection() {
    if (selectedBlockIds.length < 2) {
      setStatus('Für Merge bitte mindestens zwei Blöcke auswählen.');
      return;
    }
    createAnnotation(
      'merge',
      {
        blockIds: [...selectedBlockIds],
        preserveReadingOrder: true,
      },
      'block'
    );
    setStatus(`Merge-Anmerkung für ${selectedBlockIds.length} Blöcke gespeichert.`);
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

  function exportProjectedIr() {
    const blob = new Blob([`${JSON.stringify(projectedIr, null, 2)}\n`], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${ir.document.id || 'pdf'}-projected.ir.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function clearSelection() {
    setSelectedBlockId(null);
    setSelectedBlockIds([]);
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
          <button type="button" onClick={exportAnnotations}>
            Annotationen exportieren
          </button>
          <button type="button" onClick={exportProjectedIr}>
            Projektion exportieren
          </button>
        </div>
      </header>

      <div className="statusbar">
        <span>{status}</span>
        <span>{error ?? ''}</span>
      </div>

      <main className="workspace">
        <section className="viewer-column">
          <div className="viewer-toolbar">
            <div className="viewer-toolbar-left">
              <span><strong>PDF:</strong> {pdfName}</span>
              <span className="muted">· Ansicht: {viewMode === 'projected' ? 'projiziert' : 'Quelle'}</span>
            </div>
            <div className="viewer-toolbar-right">
              <button type="button" onClick={() => setViewMode((mode) => (mode === 'projected' ? 'source' : 'projected'))}>
                {viewMode === 'projected' ? 'Quelle anzeigen' : 'Projektion anzeigen'}
              </button>
              <div className="page-controls">
                <button type="button" onClick={() => setPageNumber((p) => Math.max(1, p - 1))}>◀</button>
                <input
                  type="number"
                  min={1}
                  value={pageNumber}
                  onChange={(e) => setPageNumber(Math.max(1, Number(e.target.value) || 1))}
                />
                <span>/ {displayIr.document.pageCount || '–'}</span>
                <button type="button" onClick={() => setPageNumber((p) => Math.min(displayIr.document.pageCount || p + 1, p + 1))}>▶</button>
              </div>
            </div>
          </div>

          <div className="page-stage" style={{ width: pageWidth || undefined, minHeight: pageHeight || undefined }}>
            <canvas ref={canvasRef} className="pdf-canvas" />
            <div
              className="overlay"
              style={{ width: pageWidth || undefined, height: pageHeight || undefined }}
              onPointerDown={handleOverlayPointerDown}
              onPointerMove={handleOverlayPointerMove}
              onPointerUp={handleOverlayPointerUp}
            >
              {visibleBlocks.map((block) => {
                const isSelected = selectedBlockIds.includes(block.id);
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
                    onClick={(event) => handleBlockClick(block.id, event)}
                    onPointerDown={(event) => event.stopPropagation()}
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
            <div className="panel-header">
              <h2>Ausgewählter Block</h2>
              <button type="button" onClick={clearSelection} className="ghost-button">
                Auswahl löschen
              </button>
            </div>
            {selectedBlock ? (
              <>
                <div className="selection-hint">
                  {selectedBlockIds.length > 1 ? `${selectedBlockIds.length} Blöcke markiert` : 'Ein Block markiert'}
                </div>
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
                  <label>
                    Zeichenmodus
                    <select value={draftMode} onChange={(e) => setDraftMode(e.target.value as DraftMode)}>
                      <option value="split">split</option>
                      <option value="relabel">relabel</option>
                      <option value="mark_stub">mark_stub</option>
                      <option value="ignore">ignore</option>
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
                  <button type="button" onClick={applySelectedReclassify}>Reclassify</button>
                  <button type="button" onClick={applySelectedReadingOrderFix}>Fix order</button>
                  <button type="button" onClick={applySelectedStub}>Mark as stub</button>
                  <button type="button" onClick={applySelectedIgnore}>Ignore</button>
                  <button type="button" onClick={applyMergeSelection} disabled={selectedBlockIds.length < 2}>
                    Merge selected
                  </button>
                </div>
                <p className="muted">
                  Ziehe im PDF einen Bereich auf, um eine {draftMode}-Anmerkung für den markierten Bereich zu erzeugen.
                </p>
                <div className="panel-split">
                  <div>
                    <h3>Original</h3>
                    <pre className="json-block">{JSON.stringify(selectedBlockSource ?? selectedBlock, null, 2)}</pre>
                  </div>
                  <div>
                    <h3>Projektion</h3>
                    <pre className="json-block">{JSON.stringify(selectedBlockProjected ?? selectedBlock, null, 2)}</pre>
                  </div>
                </div>
              </>
            ) : (
              <p>Kein Block ausgewählt.</p>
            )}
          </div>

          <div className="panel">
            <div className="panel-header">
              <h2>IR / JSON</h2>
              <div className="panel-actions-inline">
                <span className="pill">{blockChanges.length} Unterschiede</span>
              </div>
            </div>
            <pre className="json-block">{JSON.stringify({ ...displayIr, annotations, currentPage: currentPage?.pageNumber ?? null }, null, 2)}</pre>
          </div>

          <div className="panel">
            <h2>Änderungen</h2>
            <ul className="change-list">
              {blockChanges.length ? (
                blockChanges.map((change) => (
                  <li key={change.id} className={`change-${change.kind}`}>
                    <strong>{change.kind}</strong> · {change.id}
                    <div>{change.summary}</div>
                  </li>
                ))
              ) : (
                <li>Keine Abweichungen zwischen Quelle und Projektion.</li>
              )}
            </ul>
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

function applyUiAnnotationsToIr(ir: PdfIr, annotations: UiAnnotation[]): PdfIr {
  let blocks = ir.blocks.map(cloneBlock);
  const entityCandidates = (ir.entityCandidates ?? []).map((candidate) => ({ ...candidate }));
  const entityStubs = (ir.entityStubs ?? []).map((stub) => ({ ...stub }));
  const sections = (ir as { sections?: Array<Record<string, unknown>> }).sections?.map((section) => ({ ...section })) ?? [];

  for (const annotation of annotations) {
    if (annotation.targetType === 'block') {
      const payload = annotation.payload as Record<string, unknown>;
      const targetIndex = blocks.findIndex((item) => item.id === annotation.targetId);
      if (targetIndex >= 0) {
        const block = blocks[targetIndex];

        if (annotation.action === 'relabel') {
          const nextBlockType = typeof payload.blockType === 'string' ? normalizeBlockType(payload.blockType) : undefined;
          if (nextBlockType) block.blockType = nextBlockType;
          if (typeof payload.roleHint === 'string') {
            block.roleHint = payload.roleHint;
          }
          if (typeof payload.confidence === 'number' && Number.isFinite(payload.confidence)) {
            block.confidence = clampConfidence(payload.confidence);
          }
          block.provenance = { producer: 'annotation_store', rule: 'block_relabel.v1' };
        }

        if (annotation.action === 'ignore') {
          block.blockType = 'unknown';
          block.confidence = 0.05;
          block.roleHint = 'ignored';
          block.provenance = { producer: 'annotation_store', rule: 'block_ignore.v1' };
        }

        if (annotation.action === 'fix_reading_order') {
          if (typeof payload.readingOrder === 'number' && Number.isFinite(payload.readingOrder)) {
            block.readingOrder = Math.max(1, Math.trunc(payload.readingOrder));
          }
        }

        if (annotation.action === 'mark_stub') {
          const stubType = toStubType(payload.stubType);
          if (stubType) {
            const label = typeof payload.label === 'string' && payload.label.trim().length > 0 ? payload.label.trim() : block.textNormalized || block.textRaw;
            const minimumPayload = isRecord(payload.minimumPayload) ? payload.minimumPayload : buildDefaultMinimumPayload(stubType, label, block.textRaw);
            const stub = {
              id: createEntityStubId(ir.document.sourcePath, stubType, label, [block.id]),
              stubType,
              label,
              sourceBlockIds: [block.id],
              minimumPayload,
              createdFrom: 'annotation' as const,
              readyForImport: true,
              confidence: clampConfidence(typeof payload.confidence === 'number' ? payload.confidence : 1),
              source: 'manual_annotation' as const,
              provenance: {
                producer: 'annotation_store',
                rule: 'mark_stub.v1',
              },
            };

            if (!entityStubs.some((item) => item.id === stub.id)) {
              entityStubs.push(stub);
            }
          }
        }

        if (annotation.action === 'split') {
          const splitId = createDerivedBlockId(ir.document.id, block.id, annotation.id, 'split');
          const splitBbox = isRect(payload.bbox) ? payload.bbox : block.bbox;
          const splitBlockType = typeof payload.blockType === 'string' ? normalizeBlockType(payload.blockType) ?? block.blockType : block.blockType;
          const splitText = typeof payload.text === 'string'
            ? payload.text
            : typeof payload.label === 'string'
              ? payload.label
              : block.textRaw;
          const splitBlock: PdfBlock = {
            ...cloneBlock(block),
            id: splitId,
            bbox: { ...splitBbox },
            readingOrder: block.readingOrder + 1,
            blockType: splitBlockType,
            textRaw: splitText,
            textNormalized: normalizeText(splitText),
            source: 'manual_annotation',
            sourceBlockIds: [block.id],
            confidence: clampConfidence(typeof payload.confidence === 'number' ? payload.confidence : block.confidence),
            provenance: {
              producer: 'annotation_store',
              rule: 'block_split.v1',
            },
            links: {
              prevBlockId: block.id,
              nextBlockId: block.links?.nextBlockId,
            },
          };
          blocks.push(splitBlock);
        }

        if (annotation.action === 'merge') {
          const mergeIds = uniqueStrings([
            annotation.targetId,
            ...annotation.sourceBlockIds,
            ...(Array.isArray(payload.blockIds) ? payload.blockIds.filter((item): item is string => typeof item === 'string') : []),
          ]);
          const selected = blocks.filter((item) => mergeIds.includes(item.id));
          if (selected.length >= 2) {
            const representative = selected.slice().sort(compareBlocks)[0];
            const mergedId = createDerivedBlockId(ir.document.id, representative.id, annotation.id, 'merge');
            const mergedTexts = selected.map((item) => item.textRaw).filter(Boolean);
            const mergedBlock: PdfBlock = {
              ...cloneBlock(representative),
              id: mergedId,
              bbox: unionBbox(selected.map((item) => item.bbox)),
              readingOrder: Math.min(...selected.map((item) => item.readingOrder)),
              blockType: typeof payload.blockType === 'string' ? normalizeBlockType(payload.blockType) ?? representative.blockType : representative.blockType,
              textRaw: mergedTexts.join('\n\n') || representative.textRaw,
              textNormalized: normalizeText(mergedTexts.join(' ')),
              source: 'manual_annotation',
              sourceBlockIds: mergeIds,
              confidence: clampConfidence(typeof payload.confidence === 'number' ? payload.confidence : representative.confidence),
              provenance: {
                producer: 'annotation_store',
                rule: 'block_merge.v1',
              },
              links: {
                prevBlockId: selected[0]?.links?.prevBlockId,
                nextBlockId: selected[selected.length - 1]?.links?.nextBlockId,
              },
            };
            blocks = blocks.filter((item) => !mergeIds.includes(item.id));
            blocks.push(mergedBlock);
          }
        }
      }
    }

    if (annotation.targetType === 'entityCandidate') {
      const candidate = entityCandidates.find((item) => item.id === annotation.targetId);
      if (!candidate) {
        continue;
      }

      if (annotation.action === 'promote_candidate') {
        candidate.status = 'confirmed';
        candidate.provenance = {
          producer: 'annotation_store',
          rule: 'candidate_promote.v1',
        };
      }

      if (annotation.action === 'reject_candidate') {
        candidate.status = 'rejected';
        candidate.provenance = {
          producer: 'annotation_store',
          rule: 'candidate_reject.v1',
        };
      }

      if (annotation.action === 'mark_stub') {
        const stubType = toStubType(candidate.entityType);
        if (stubType) {
          const candidateLabel = typeof candidate.label === 'string' ? candidate.label : 'candidate';
          const candidateSourceBlockIds = Array.isArray(candidate.sourceBlockIds)
            ? candidate.sourceBlockIds.filter((item): item is string => typeof item === 'string')
            : [];
          const stub = {
            id: createEntityStubId(ir.document.sourcePath, stubType, candidateLabel, candidateSourceBlockIds),
            stubType,
            label: candidateLabel,
            sourceBlockIds: [...candidateSourceBlockIds],
            minimumPayload: buildDefaultMinimumPayload(stubType, candidateLabel, candidateLabel),
            createdFrom: 'annotation' as const,
            readyForImport: true,
            confidence: candidate.confidence,
            source: candidate.source,
            provenance: {
              producer: 'annotation_store',
              rule: 'candidate_mark_stub.v1',
            },
          };
          if (!entityStubs.some((item) => item.id === stub.id)) {
            entityStubs.push(stub);
          }
        }
      }
    }

    if (annotation.targetType === 'entityStub') {
      const stub = entityStubs.find((item) => item.id === annotation.targetId);
      if (!stub) {
        continue;
      }

      const payload = annotation.payload as Record<string, unknown>;
      if (annotation.action === 'relabel') {
        if (typeof payload.label === 'string' && payload.label.trim().length > 0) {
          stub.label = payload.label.trim();
        }
        if (isRecord(payload.minimumPayload)) {
          stub.minimumPayload = payload.minimumPayload;
        }
      }

      if (annotation.action === 'ignore') {
        stub.readyForImport = false;
      }
    }
  }

  blocks = renumberBlocksByPage(blocks);

  return {
    ...ir,
    blocks,
    sections,
    entityCandidates,
    entityStubs,
  };
}

function computeBlockChanges(before: PdfBlock[], after: PdfBlock[]): BlockChange[] {
  const beforeMap = new Map(before.map((block) => [block.id, block]));
  const afterMap = new Map(after.map((block) => [block.id, block]));
  const changes: BlockChange[] = [];

  for (const [id, block] of beforeMap.entries()) {
    const projected = afterMap.get(id);
    if (!projected) {
      changes.push({
        id,
        kind: 'removed',
        before: block,
        summary: `${block.blockType} wurde entfernt oder umbenannt.`,
      });
      continue;
    }

    const summaryParts: string[] = [];
    if (block.blockType !== projected.blockType) summaryParts.push(`${block.blockType} → ${projected.blockType}`);
    if (block.readingOrder !== projected.readingOrder) summaryParts.push(`Order ${block.readingOrder} → ${projected.readingOrder}`);
    if (block.textNormalized !== projected.textNormalized) summaryParts.push('Text geändert');
    if (!sameBbox(block.bbox, projected.bbox)) summaryParts.push('BBox geändert');
    if (summaryParts.length) {
      changes.push({
        id,
        kind: 'changed',
        before: block,
        after: projected,
        summary: summaryParts.join(' · '),
      });
    }
  }

  for (const [id, block] of afterMap.entries()) {
    if (!beforeMap.has(id)) {
      changes.push({
        id,
        kind: 'added',
        after: block,
        summary: `${block.blockType} hinzugefügt (${block.readingOrder})`,
      });
    }
  }

  return changes.sort((a, b) => a.id.localeCompare(b.id));
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

function cloneBlock(block: PdfBlock): PdfBlock {
  return {
    ...block,
    bbox: { ...block.bbox },
    sourceBlockIds: block.sourceBlockIds ? [...block.sourceBlockIds] : undefined,
    provenance: block.provenance ? { ...block.provenance } : undefined,
    links: block.links ? { ...block.links } : undefined,
  };
}

function compareBlocks(left: PdfBlock, right: PdfBlock): number {
  if (left.pageNumber !== right.pageNumber) return left.pageNumber - right.pageNumber;
  if (left.readingOrder !== right.readingOrder) return left.readingOrder - right.readingOrder;
  if (left.bbox.y !== right.bbox.y) return left.bbox.y - right.bbox.y;
  if (left.bbox.x !== right.bbox.x) return left.bbox.x - right.bbox.x;
  return left.id.localeCompare(right.id);
}

function renumberBlocksByPage(blocks: PdfBlock[]): PdfBlock[] {
  const nextBlocks = blocks.map(cloneBlock);
  const grouped = new Map<number, PdfBlock[]>();
  for (const block of nextBlocks) {
    const pageBlocks = grouped.get(block.pageNumber) ?? [];
    pageBlocks.push(block);
    grouped.set(block.pageNumber, pageBlocks);
  }

  for (const pageBlocks of grouped.values()) {
    pageBlocks.sort(compareBlocks);
    pageBlocks.forEach((block, index) => {
      block.readingOrder = index + 1;
    });
  }

  return nextBlocks.sort(compareBlocks);
}

function selectionToBbox(selection: DraftSelection): PdfBBox {
  return {
    x: Math.min(selection.startX, selection.endX),
    y: Math.min(selection.startY, selection.endY),
    w: Math.abs(selection.endX - selection.startX),
    h: Math.abs(selection.endY - selection.startY),
  };
}

function unionBbox(boxes: PdfBBox[]): PdfBBox {
  if (!boxes.length) return { x: 0, y: 0, w: 0, h: 0 };
  const x1 = Math.min(...boxes.map((box) => box.x));
  const y1 = Math.min(...boxes.map((box) => box.y));
  const x2 = Math.max(...boxes.map((box) => box.x + box.w));
  const y2 = Math.max(...boxes.map((box) => box.y + box.h));
  return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
}

function sameBbox(left: PdfBBox, right: PdfBBox): boolean {
  return left.x === right.x && left.y === right.y && left.w === right.w && left.h === right.h;
}

function normalizeText(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values.filter((value) => value.trim().length > 0)));
}

function toggleSelection(current: string[], id: string): string[] {
  if (current.includes(id)) {
    return current.filter((item) => item !== id);
  }
  return [...current, id];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isRect(value: unknown): value is RectLike {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    typeof (value as Record<string, unknown>).x === 'number' &&
    typeof (value as Record<string, unknown>).y === 'number' &&
    typeof (value as Record<string, unknown>).w === 'number' &&
    typeof (value as Record<string, unknown>).h === 'number'
  );
}

function clampConfidence(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.min(1, Math.max(0, value));
}

function toStubType(value: unknown): 'npc_stub' | 'location_stub' | 'scene_stub' | undefined {
  if (value === 'npc_stub' || value === 'location_stub' || value === 'scene_stub') {
    return value;
  }
  if (value === 'npc') return 'npc_stub';
  if (value === 'location') return 'location_stub';
  if (value === 'scene') return 'scene_stub';
  return undefined;
}

function normalizeBlockType(value: string): PdfBlock['blockType'] | undefined {
  if (
    value === 'heading' ||
    value === 'paragraph' ||
    value === 'list' ||
    value === 'stat_block' ||
    value === 'read_aloud' ||
    value === 'sidebar' ||
    value === 'table_like' ||
    value === 'illustration' ||
    value === 'decoration' ||
    value === 'footer' ||
    value === 'header' ||
    value === 'unknown'
  ) {
    return value;
  }
  return undefined;
}

function buildDefaultMinimumPayload(stubType: 'npc_stub' | 'location_stub' | 'scene_stub', label: string, text: string): Record<string, unknown> {
  const summary = summarizeText(text);
  if (stubType === 'scene_stub') {
    return {
      title: label,
      summary,
    };
  }

  return {
    name: label,
    summary,
  };
}

function summarizeText(text: string): string {
  const normalized = normalizeText(text);
  if (normalized.length <= 180) {
    return normalized;
  }
  return normalized.slice(0, 180);
}

function createEntityStubId(sourcePath: string, stubType: 'npc_stub' | 'location_stub' | 'scene_stub', label: string, sourceBlockIds: string[]): string {
  const parts = [sourcePath, stubType, label, ...sourceBlockIds].map(slugifyIdPart).filter(Boolean);
  return `stub:${parts.join(':')}`;
}

function createDerivedBlockId(documentId: string, sourceBlockId: string, annotationId: string, kind: 'split' | 'merge'): string {
  return `block:${kind}:${slugifyIdPart(documentId)}:${slugifyIdPart(sourceBlockId)}:${slugifyIdPart(annotationId).slice(0, 12)}`;
}

function slugifyIdPart(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'x';
}
