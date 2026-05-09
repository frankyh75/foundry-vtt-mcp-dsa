import { useEffect, useMemo, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import { applyPresetDefaults, defaultReviewConfig, normalizeReviewConfig, reviewConfigLabel, type ReviewBackendPreset, type ReviewConfig } from './review_config';
import EditorToolbar from './EditorToolbar';
import PropertyPanel from './PropertyPanel';
import { DSA_BLOCK_LABELS, DSA_BLOCK_COLORS, type DsaBlockType, type EditorTool } from './dsaTypes';

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
type BackendHealth = 'unknown' | 'online' | 'offline';
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

type OllamaModelDiscovery = {
  providerPreset: ReviewConfig['providerPreset'];
  baseUrl: string;
  models: Array<{ name: string; remoteHost?: string; local: boolean }>;
  localModels: string[];
  localChatModels: string[];
  warning?: string;
};

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
const ollamaModelSuggestions = ['qwen2.5:7b-instruct', 'qwen2.5-coder:7b-instruct', 'llama3.1:8b-instruct', 'mistral:7b-instruct', 'gemma2:9b-instruct'] as const;

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

const API_BASE_STORAGE_KEY = 'foundry-pdf-review-ui:api-base';
const SESSION_ID_STORAGE_KEY = 'foundry-pdf-review-ui:session-id';
const DEFAULT_BACKEND_PORT = 4174;

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const pdfDocRef = useRef<pdfjsLib.PDFDocumentProxy | null>(null);
  const pdfBytesRef = useRef<ArrayBuffer | null>(null);
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
  const [apiBase, setApiBase] = useState(() => localStorage.getItem(API_BASE_STORAGE_KEY) ?? defaultBackendBase());
  const [sessionId, setSessionId] = useState(() => normalizeSessionId(localStorage.getItem(SESSION_ID_STORAGE_KEY) ?? ''));
  const [backendStatus, setBackendStatus] = useState<BackendHealth>('unknown');
  const [reviewConfig, setReviewConfig] = useState<ReviewConfig>(defaultReviewConfig);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  const [analysisRunning, setAnalysisRunning] = useState(false);
  const [configStatus, setConfigStatus] = useState('Konfiguration nicht geladen.');
  const [ollamaModelNames, setOllamaModelNames] = useState<string[]>([...ollamaModelSuggestions]);
  const [modelDiscoveryStatus, setModelDiscoveryStatus] = useState('Lokale Ollama-Modelle noch nicht abgefragt.');
  const [engineStatus, setEngineStatus] = useState<{ ocr: string; llm: string }>({ ocr: 'Unbekannt', llm: 'Unbekannt' });
  const [activeTool, setActiveTool] = useState<EditorTool>('select');
  const [editTextValue, setEditTextValue] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [canvasSize, setCanvasSize] = useState<{ width: number; height: number }>({ width: 0, height: 0 });
  const [isLoading, setIsLoading] = useState(false);

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
  const pageSummaries = useMemo(
    () =>
      displayIr.pages.map((page) => {
        const pageBlocks = displayIr.blocks.filter((block) => block.pageNumber === page.pageNumber);
        const selectedCount = selectedBlockIds.filter((blockId) => pageBlocks.some((block) => block.id === blockId)).length;
        return {
          pageNumber: page.pageNumber,
          blockCount: pageBlocks.length,
          selectedCount,
          summary: summarizePageBlocks(pageBlocks),
        };
      }),
    [displayIr.blocks, displayIr.pages, selectedBlockIds]
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
    window.localStorage.setItem(API_BASE_STORAGE_KEY, apiBase);
  }, [apiBase]);

  useEffect(() => {
    window.localStorage.setItem(SESSION_ID_STORAGE_KEY, sessionId);
  }, [sessionId]);

  useEffect(() => {
    void checkBackendHealth();
    void loadReviewConfigFromBackend();
    void loadEngineStatus();
  }, []);

  useEffect(() => {
    void loadOllamaModelSuggestions();
  }, [apiBase, reviewConfig.providerPreset]);

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
    const vw = Math.ceil(viewport.width);
    const vh = Math.ceil(viewport.height);
    canvas.width = vw;
    canvas.height = vh;
    canvas.style.width = `${vw}px`;
    canvas.style.height = `${vh}px`;
    setCanvasSize({ width: vw, height: vh });

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    await page.render({ canvasContext: ctx, viewport }).promise;
    if (pageNumber === 1 || !previewImageUrl) {
      setPreviewImageUrl(canvas.toDataURL('image/png'));
    }
  }

  async function handlePdfFile(file: File | null) {
    if (!file) return;
    setError(null);
    setPreviewImageUrl(null);
    setPdfName(file.name);
    pdfBytesRef.current = await file.arrayBuffer();
    const targetSessionId = resolveSessionId(file.name.replace(/\.[^.]+$/, ''));
    if (!sessionId) {
      setSessionId(targetSessionId);
    }
    setStatus(`Lade PDF ${file.name}...`);
    await loadPdfFromBytes(pdfBytesRef.current, file.name);
    await saveCurrentSession(targetSessionId);
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
    const targetSessionId = resolveSessionId(parsed.document?.id ?? file.name.replace(/\.[^.]+$/, ''));
    if (!sessionId) {
      setSessionId(targetSessionId);
    }
    setStatus(`IR geladen: ${parsed.document?.id ?? file.name}`);
    await saveCurrentSession(targetSessionId);
  }

  function persistAnnotations(next: UiAnnotation[]) {
    setAnnotations(next);
    window.localStorage.setItem(storageKey(irRef.current.document.id), JSON.stringify(next, null, 2));
    void saveCurrentSession(undefined, next);
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
    createAnnotation('ignore', { reason: 'manually ignored' }, 'block');
  }

  function applySelectedDelete() {
    if (!selectedBlock) return;
    createAnnotation('ignore', { reason: 'deleted' }, 'block');
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

  function defaultBackendBase(): string {
    if (typeof window === 'undefined') {
      return `http://127.0.0.1:${DEFAULT_BACKEND_PORT}`;
    }
    return `${window.location.protocol}//${window.location.hostname}:${DEFAULT_BACKEND_PORT}`;
  }

  function normalizeApiBase(value: string): string {
    const trimmed = value.trim();
    return trimmed.replace(/\/+$/, '');
  }

  function normalizeSessionId(value: string): string {
    return value.trim().replace(/[^a-zA-Z0-9._-]+/g, '_');
  }

  function resolveSessionId(preferred?: string): string {
    const fromPreferred = preferred ? normalizeSessionId(preferred) : '';
    if (fromPreferred) return fromPreferred;
    const fromState = normalizeSessionId(sessionId);
    if (fromState) return fromState;
    const fromIr = normalizeSessionId(irRef.current.document.id);
    if (fromIr && fromIr !== 'unloaded') return fromIr;
    const fromPdf = normalizeSessionId(pdfName.replace(/\.[^.]+$/, ''));
    if (fromPdf && fromPdf !== 'kein_pdf_geladen') return fromPdf;
    return 'review-session';
  }

  function backendUrl(pathname: string, base = apiBase): string {
    return `${normalizeApiBase(base)}${pathname}`;
  }

  async function requestJson<T>(pathname: string, init?: RequestInit, base = apiBase): Promise<T> {
    const response = await fetch(backendUrl(pathname, base), init);
    const contentType = response.headers.get('content-type') ?? '';
    const payload = contentType.includes('application/json') ? (await response.json()) as T : (await response.text()) as unknown as T;
    if (!response.ok) {
      const message = typeof payload === 'string' ? payload : (payload as { error?: string }).error ?? response.statusText;
      throw new Error(message || response.statusText);
    }
    return payload;
  }

  async function requestBuffer(pathname: string, base = apiBase): Promise<ArrayBuffer> {
    const response = await fetch(backendUrl(pathname, base));
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} ${response.statusText}`);
    }
    return response.arrayBuffer();
  }

  async function loadPdfFromBytes(arrayBuffer: ArrayBuffer, name: string): Promise<void> {
    pdfBytesRef.current = arrayBuffer.slice(0);
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    const doc = await loadingTask.promise;
    pdfDocRef.current = doc;
    setPdfName(name);
    setStatus(`PDF geladen: ${name} (${doc.numPages} Seiten)`);
    if (pageNumber > doc.numPages) {
      setPageNumber(1);
    }
  }

  async function checkBackendHealth(): Promise<void> {
    try {
      const payload = await requestJson<{ status: string; dataDir?: string }>('/health', undefined, apiBase);
      setBackendStatus(payload.status === 'ok' ? 'online' : 'offline');
      setStatus(`Backend online · ${payload.dataDir ?? ''}`.trim());
    } catch (error) {
      setBackendStatus('offline');
      setStatus('Backend offline · Local-only Modus aktiv.');
      setError(error instanceof Error ? error.message : String(error));
    }
  }

  async function loadReviewConfigFromBackend(): Promise<void> {
    try {
      const payload = await requestJson<ReviewConfig>('/config', undefined, apiBase);
      const normalized = normalizeReviewConfig(payload);
      setReviewConfig(normalized);
      setConfigStatus(`Konfiguration geladen: ${reviewConfigLabel(normalized.providerPreset)}.`);
    } catch (error) {
      setReviewConfig(defaultReviewConfig);
      setConfigStatus('Konfiguration lokal zurückgesetzt.');
      setError(error instanceof Error ? error.message : String(error));
    }
  }

  async function loadOllamaModelSuggestions(): Promise<void> {
    try {
      const discovery = await requestJson<OllamaModelDiscovery>('/models', undefined, apiBase);
      const nextNames = [...new Set(discovery.models.map((model) => model.name).filter(Boolean))];
      setOllamaModelNames(nextNames.length ? nextNames : [...ollamaModelSuggestions]);
      setModelDiscoveryStatus(
        discovery.warning
          ? `${discovery.warning} · ${discovery.models.length} Ollama-Modelle gefunden`
          : `${discovery.models.length} Ollama-Modelle · ${discovery.localChatModels.length} lokale Chat-Modelle`
      );
      if (!reviewConfig.model && discovery.localChatModels.length === 1) {
        setReviewConfig((current) => ({ ...current, model: discovery.localChatModels[0] }));
      }
    } catch (error) {
      setOllamaModelNames([...ollamaModelSuggestions]);
      setModelDiscoveryStatus(`Lokale Modellliste nicht geladen · ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async function loadEngineStatus(): Promise<void> {
    try {
      const status = await requestJson<{
        poppler: { available: boolean };
        tesseract: { available: boolean };
        marker: { available: boolean };
        ollama: { available: boolean };
      }>('/engines', undefined, apiBase);
      const ocrParts: string[] = [];
      if (status.poppler.available) ocrParts.push('Poppler');
      if (status.tesseract.available) ocrParts.push('Tesseract');
      if (status.marker.available) ocrParts.push('Marker');
      const llmParts: string[] = [];
      if (status.ollama.available) llmParts.push('Ollama');
      setEngineStatus({
        ocr: ocrParts.length ? ocrParts.join(' + ') : 'Keine OCR',
        llm: llmParts.length ? llmParts.join(' + ') : 'Keine LLM',
      });
    } catch (error) {
      setEngineStatus({ ocr: 'Fehler', llm: 'Fehler' });
    }
  }

  async function saveReviewConfigToBackend(nextConfig = reviewConfig): Promise<ReviewConfig> {
    const normalized = normalizeReviewConfig(nextConfig);
    setReviewConfig(normalized);
    try {
      await requestJson(
        '/config',
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json; charset=utf-8' },
          body: JSON.stringify(normalized),
        },
        apiBase
      );
      setConfigStatus(`Konfiguration gespeichert: ${reviewConfigLabel(normalized.providerPreset)}.`);
    } catch (error) {
      setConfigStatus('Konfiguration nur lokal gehalten; Backend-Sync fehlgeschlagen.');
      setError(error instanceof Error ? error.message : String(error));
    }
    return normalized;
  }

  async function handleAnalyzePdf(): Promise<void> {
    const targetSessionId = resolveSessionId();
    if (!pdfBytesRef.current) {
      setError('Zuerst ein PDF laden.');
      return;
    }

    setAnalysisRunning(true);
    setError(null);
    try {
      await saveCurrentSession(targetSessionId);
      const normalized = await saveReviewConfigToBackend(reviewConfig);
      await requestJson(
        `/sessions/${encodeURIComponent(targetSessionId)}/analyze`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json; charset=utf-8' },
          body: JSON.stringify({ config: normalized }),
        },
        apiBase
      );
      const loadedIr = await requestJson<PdfIr>(`/sessions/${encodeURIComponent(targetSessionId)}/ir`, undefined, apiBase);
      setIr(loadedIr);
      setAnnotations(loadedIr.annotations ?? []);
      setSessionId(targetSessionId);
      setPageNumber(loadedIr.pages?.[0]?.pageNumber ?? 1);
      setStatus(`Analyse fertig: ${loadedIr.document.id} (${loadedIr.document.pageCount} Seiten)`);
    } catch (error) {
      setStatus('Analyse fehlgeschlagen.');
      setError(error instanceof Error ? error.message : String(error));
    } finally {
      setAnalysisRunning(false);
    }
  }

  function handleToolbarAction(tool: EditorTool) {
    switch (tool) {
      case 'merge':
        applyMergeSelection();
        break;
      case 'delete':
        if (selectedBlock) {
          applySelectedDelete();
        } else if (selectedBlockIds.length > 0) {
          for (const id of selectedBlockIds) {
            const block = visibleBlocks.find((b) => b.id === id);
            if (block) {
              setSelectedBlockId(block.id);
              setSelectedBlockType(block.blockType as typeof selectedBlockType);
              createAnnotation('ignore', { reason: 'deleted' }, 'block');
            }
          }
          setStatus(`${selectedBlockIds.length} Blöcke als gelöscht markiert.`);
        }
        break;
      case 'split':
        setDraftMode('split');
        break;
      case 'edit-text':
        if (selectedBlock) {
          setEditTextValue(selectedBlock.textRaw || '');
        }
        break;
      case 'draw':
        setDraftMode('relabel');
        break;
      case 'select':
      case 'ai-chat':
      default:
        break;
    }
  }

  async function saveCurrentSession(sessionOverride?: string, annotationsOverride?: UiAnnotation[]): Promise<void> {
    const targetSessionId = resolveSessionId(sessionOverride);
    const base = normalizeApiBase(apiBase);
    setSessionId(targetSessionId);
    if (!targetSessionId) return;

    try {
      if (pdfBytesRef.current) {
        await requestJson(
          `/sessions/${encodeURIComponent(targetSessionId)}/pdf`,
          {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/pdf',
              'X-Filename': pdfName,
            },
            body: pdfBytesRef.current,
          },
          base
        );
      }

      if (irRef.current.document.id !== 'unloaded') {
        await requestJson(
          `/sessions/${encodeURIComponent(targetSessionId)}/ir`,
          {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json; charset=utf-8',
              'X-Filename': `${irRef.current.document.id}.ir.json`,
            },
            body: JSON.stringify(irRef.current),
          },
          base
        );

        await requestJson(
          `/sessions/${encodeURIComponent(targetSessionId)}/annotations`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json; charset=utf-8' },
            body: JSON.stringify({ annotations: annotationsOverride ?? annotations }),
          },
          base
        );
      }

      setStatus(`Session ${targetSessionId} gespeichert.`);
    } catch (error) {
      setBackendStatus('offline');
      setStatus('Session lokal gespeichert, Backend-Sync fehlgeschlagen.');
      setError(error instanceof Error ? error.message : String(error));
    }
  }

  async function loadSessionFromBackend(sessionOverride?: string): Promise<void> {
    const targetSessionId = resolveSessionId(sessionOverride);
    const base = normalizeApiBase(apiBase);
    setSessionId(targetSessionId);
    if (!targetSessionId) return;

    try {
      const state = await requestJson<{ annotations?: UiAnnotation[]; projectedIr?: PdfIr; hasPdf?: boolean; hasIr?: boolean; reviewConfig?: ReviewConfig }>(
        `/sessions/${encodeURIComponent(targetSessionId)}`,
        undefined,
        base
      );

      let loadedIr = ir;
      if (state.hasPdf) {
        const pdfBytes = await requestBuffer(`/sessions/${encodeURIComponent(targetSessionId)}/pdf`, base);
        await loadPdfFromBytes(pdfBytes, `${targetSessionId}.pdf`);
      }

      if (state.hasIr) {
        loadedIr = await requestJson<PdfIr>(`/sessions/${encodeURIComponent(targetSessionId)}/ir`, undefined, base);
        setIr(loadedIr);
      }

      const remoteAnnotations = state.annotations ?? [];
      const sourceAnnotations = loadedIr.annotations ?? [];
      setAnnotations(mergeAnnotations(sourceAnnotations, remoteAnnotations));
      if (state.reviewConfig) {
        setReviewConfig(normalizeReviewConfig(state.reviewConfig));
        setConfigStatus(`Konfiguration aus Session geladen: ${reviewConfigLabel(normalizeReviewConfig(state.reviewConfig).providerPreset)}.`);
      }
      setStatus(`Session ${targetSessionId} geladen.`);
    } catch (error) {
      setStatus('Session konnte nicht geladen werden.');
      setError(error instanceof Error ? error.message : String(error));
    }
  }

  function getBlockScaledBbox(block: PdfBlock): PdfBBox {
    if (!canvasSize.width || !canvasSize.height) return block.bbox;
    // BBox-Koordinaten sind oft im OCR-Pixel-Raum (z.B. 150 DPI), nicht im PDF-Punkt-Raum (72 DPI).
    // Skaliere dynamisch: max(BBox) -> Canvas-Größe, statt feste page.width/page.height zu nutzen.
    const pageBlocks = displayIr.blocks.filter((b) => b.pageNumber === block.pageNumber);
    const maxX = Math.max(...pageBlocks.map((b) => b.bbox.x + b.bbox.w), 1);
    const maxY = Math.max(...pageBlocks.map((b) => b.bbox.y + b.bbox.h), 1);
    const scaleX = canvasSize.width / maxX;
    const scaleY = canvasSize.height / maxY;
    return {
      x: block.bbox.x * scaleX,
      y: block.bbox.y * scaleY,
      w: block.bbox.w * scaleX,
      h: block.bbox.h * scaleY,
    };
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <h1>Foundry PDF OCR Workbench</h1>
          <p>Lokale 3-Spalten-Ansicht: Seiten, PDF-Preview und Korrektur mit sichtbarer Projektion.</p>
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
          <label className="inline-field session-field">
            <input
              type="text"
              value={sessionId}
              placeholder="Session-ID"
              onChange={(e) => setSessionId(normalizeSessionId(e.target.value))}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void loadSessionFromBackend(); } }}
            />
          </label>
          <button type="button" onClick={() => void loadSessionFromBackend()} disabled={!sessionId}>
            Session laden
          </button>
          <button
            type="button"
            className={`settings-toggle ${showSettings ? 'active' : ''}`}
            onClick={() => setShowSettings((s) => !s)}
            title="Backend-Konfiguration & Experten-Optionen"
          >
            ⚙
          </button>
        </div>
      </header>

      {showSettings ? (
        <section className="settings-dropdown">
          <div className="settings-row">
            <label className="inline-field">
              API
              <input type="text" value={apiBase} onChange={(e) => setApiBase(e.target.value)} />
            </label>
            <button type="button" onClick={() => void checkBackendHealth()}>
              Backend prüfen
            </button>
            <button type="button" onClick={() => void saveCurrentSession()} disabled={!sessionId}>
              Session speichern
            </button>
            <button type="button" onClick={() => void handleAnalyzePdf()} disabled={analysisRunning || !pdfBytesRef.current}>
              {analysisRunning ? 'Analysiere…' : 'Analysieren'}
            </button>
            <button type="button" onClick={exportAnnotations} disabled={annotations.length === 0}>
              Annotationen exportieren
            </button>
            <button type="button" onClick={exportProjectedIr} disabled={!displayIr.document.id || displayIr.document.id === 'unloaded'}>
              Projektion exportieren
            </button>
          </div>
        </section>
      ) : null}

      <div className="statusbar">
        <span>{status}</span>
        <span>{backendStatus === 'online' ? 'Backend online' : backendStatus === 'offline' ? 'Backend offline' : 'Backend unbekannt'}</span>
        <span>{error ?? ''}</span>
      </div>

      {showSettings ? (
        <section className="config-strip">
          <div className="panel config-panel">
            <div className="panel-header">
              <h2>Import-Wizard</h2>
              <span className="pill">{configStatus}</span>
              <span className={`pill ${engineStatus.ocr === 'Keine OCR' ? 'err' : engineStatus.ocr === 'Fehler' ? 'warn' : 'ok'}`} title="OCR-Engines">
                OCR: {engineStatus.ocr}
              </span>
              <span className={`pill ${engineStatus.llm === 'Keine LLM' ? 'err' : engineStatus.llm === 'Fehler' ? 'warn' : 'ok'}`} title="LLM-Engine">
                LLM: {engineStatus.llm}
              </span>
            </div>
            <div className="detail-grid config-grid">
              <label>
                Backend-Preset
                <select
                  value={reviewConfig.providerPreset}
                  onChange={(e) => setReviewConfig((current) => applyPresetDefaults(current, e.target.value as ReviewBackendPreset))}
                >
                  <option value="openai-compatible">OpenAI-compatible</option>
                  <option value="ollama">Ollama</option>
                  <option value="lmstudio">LM Studio</option>
                  <option value="lemonade">Lemonade</option>
                </select>
              </label>
              <label>
                Base URL
                <input type="text" value={reviewConfig.baseUrl} onChange={(e) => setReviewConfig((current) => ({ ...current, baseUrl: e.target.value }))} />
              </label>
              <label>
                API-Pfad
                <input type="text" value={reviewConfig.apiPath} onChange={(e) => setReviewConfig((current) => ({ ...current, apiPath: e.target.value }))} />
              </label>
              <label>
                Modell
                <input
                  type="text"
                  list="ollama-model-suggestions"
                  placeholder="z.B. qwen2.5:7b-instruct"
                  value={reviewConfig.model}
                  onChange={(e) => setReviewConfig((current) => ({ ...current, model: e.target.value }))}
                />
                <datalist id="ollama-model-suggestions">
                  {ollamaModelNames.map((model) => (
                    <option key={model} value={model} />
                  ))}
                </datalist>
                <small className="field-hint">Freitext. Bei Ollama einfach den exakten Modellnamen eintragen.</small>
                <small className="field-hint">{modelDiscoveryStatus}</small>
              </label>
              <label>
                API-Key
                <input type="password" value={reviewConfig.apiKey} onChange={(e) => setReviewConfig((current) => ({ ...current, apiKey: e.target.value }))} />
              </label>
              <label>
                OCR-Engine
                <select
                  value={reviewConfig.ocrEngine}
                  onChange={(e) => setReviewConfig((current) => ({ ...current, ocrEngine: e.target.value as ReviewConfig['ocrEngine'] }))}
                >
                  <option value="auto">Auto (Marker bevorzugt, Fallback Tesseract)</option>
                  <option value="tesseract">Tesseract (klassisch, schnell)</option>
                  <option value="marker">Marker (ML-basiert, falls installiert)</option>
                </select>
                <small className="field-hint">Auto = Marker wenn verfügbar, sonst Tesseract. Marker braucht Python + PyTorch.</small>
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={reviewConfig.showExpertView}
                  onChange={(e) => setReviewConfig((current) => ({ ...current, showExpertView: e.target.checked }))}
                />
                Expertenansicht (JSON-Panel)
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={reviewConfig.rememberLastSettings}
                  onChange={(e) => setReviewConfig((current) => ({ ...current, rememberLastSettings: e.target.checked }))}
                />
                Letzte Einstellungen merken
              </label>
            </div>
            <div className="action-row">
              <button type="button" onClick={() => void loadReviewConfigFromBackend()}>
                Konfig laden
              </button>
              <button type="button" onClick={() => void saveReviewConfigToBackend()}>
                Konfig speichern
              </button>
              <button type="button" onClick={() => void handleAnalyzePdf()} disabled={analysisRunning}>
                {analysisRunning ? 'Analysiere…' : 'PDF analysieren'}
              </button>
            </div>
            {reviewConfig.showExpertView ? (
              <details open>
                <summary>Expertenansicht: lokale review-config.json</summary>
                <pre className="json-block">{JSON.stringify(reviewConfig, null, 2)}</pre>
              </details>
            ) : null}
          </div>

          <div className="panel preview-panel">
            <div className="panel-header">
              <h2>Dokumentvorschau</h2>
              <span className="pill">{pdfDocRef.current ? `${pdfDocRef.current.numPages} Seiten` : 'kein PDF'}</span>
            </div>
            {previewImageUrl ? (
              <img className="preview-image" src={previewImageUrl} alt={`Vorschau von ${pdfName}`} />
            ) : (
              <p>Nach dem Laden wird hier eine kleine Vorschau angezeigt.</p>
            )}
            <ul className="preview-meta">
              <li><strong>Datei:</strong> {pdfName}</li>
              <li><strong>Seite:</strong> {pageNumber}</li>
              <li><strong>Session:</strong> {sessionId || '–'}</li>
            </ul>
          </div>
        </section>
      ) : null}

      <main className="workspace">
        <section className="navigator-column">
          <div className="panel">
            <div className="panel-header">
              <h2>Arbeitsfolge</h2>
              <span className="pill">{displayIr.document.pageCount || '–'} Seiten</span>
            </div>
            <ol className="workflow-list">
              <li>
                <strong>1. Laden</strong>
                <span>PDF oder IR importieren</span>
              </li>
              <li>
                <strong>2. Analysieren</strong>
                <span>Seiten, Blöcke und Projektion aufbauen</span>
              </li>
              <li>
                <strong>3. Prüfen</strong>
                <span>Seiten nacheinander korrigieren</span>
              </li>
              <li>
                <strong>4. Exportieren</strong>
                <span>Annotationen oder Projektion sichern</span>
              </li>
            </ol>
          </div>

          <div className="panel">
            <div className="panel-header">
              <h2>Seiten</h2>
              <span className="pill">{pageSummaries.length || '–'} geladen</span>
            </div>
            <div className="page-list">
              {pageSummaries.map((page) => (
                <button
                  key={page.pageNumber}
                  type="button"
                  className={`page-card ${page.pageNumber === pageNumber ? 'active' : ''}`}
                  onClick={() => setPageNumber(page.pageNumber)}
                >
                  <span className="page-card-title">Seite {page.pageNumber}</span>
                  <span className="page-card-meta">
                    {page.blockCount} Blöcke{page.selectedCount ? ` · ${page.selectedCount} markiert` : ''}
                  </span>
                  <span className="page-card-summary">{page.summary}</span>
                </button>
              ))}
              {!pageSummaries.length ? <p className="muted">Noch keine Seiten geladen.</p> : null}
            </div>
          </div>

          <div className="panel">
            <div className="panel-header">
              <h2>Dokument</h2>
            </div>
            <div className="summary-grid">
              <div>
                <span className="muted">Datei</span>
                <strong>{pdfName}</strong>
              </div>
              <div>
                <span className="muted">Session</span>
                <strong>{sessionId || '–'}</strong>
              </div>
              <div>
                <span className="muted">Ansicht</span>
                <strong>{viewMode === 'projected' ? 'Projektion' : 'Quelle'}</strong>
              </div>
              <div>
                <span className="muted">Blöcke</span>
                <strong>{displayIr.blocks.length}</strong>
              </div>
            </div>
          </div>
        </section>

        <section className="viewer-column">
          <div className="viewer-toolbar">
            <div className="viewer-toolbar-left">
              <span><strong>PDF:</strong> {pdfName}</span>
              <span className="muted">· Ansicht: {viewMode === 'projected' ? 'projiziert' : 'Quelle'}</span>
            </div>
            <EditorToolbar activeTool={activeTool} onAction={(tool) => { setActiveTool(tool); handleToolbarAction(tool); }} disabled={!sessionId} />
            <div className="viewer-toolbar-right">
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

          <div className="page-stage" style={{ width: canvasSize.width || undefined, minHeight: canvasSize.height || undefined }}>
            <canvas ref={canvasRef} className="pdf-canvas" />
            <div
              className="overlay"
              style={{ width: canvasSize.width || undefined, height: canvasSize.height || undefined }}
              onPointerDown={handleOverlayPointerDown}
              onPointerMove={handleOverlayPointerMove}
              onPointerUp={handleOverlayPointerUp}
            >
              {visibleBlocks.map((block) => {
                const isSelected = selectedBlockIds.includes(block.id);
                const scaled = getBlockScaledBbox(block);
                const label = DSA_BLOCK_LABELS[block.blockType as keyof typeof DSA_BLOCK_LABELS] ?? block.blockType;
                return (
                  <button
                    key={block.id}
                    type="button"
                    className={`block-box block-${block.blockType} ${isSelected ? 'selected' : ''}`}
                    style={{
                      left: scaled.x,
                      top: scaled.y,
                      width: scaled.w,
                      height: scaled.h,
                    }}
                    onClick={(event) => handleBlockClick(block.id, event)}
                    onPointerDown={(event) => event.stopPropagation()}
                    title={`${label} · ${block.textNormalized || block.textRaw}`}
                  >
                    <span className="block-label">{label}</span>
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
              <h2>Korrektur</h2>
              <button type="button" onClick={clearSelection} className="ghost-button">
                Auswahl löschen
              </button>
            </div>
            {selectedBlock ? (
              <>
                <div className="selection-hint">
                  {selectedBlockIds.length > 1 ? `${selectedBlockIds.length} Blöcke markiert` : 'Ein Block markiert'}
                </div>
                <PropertyPanel
                  boxId={selectedBlock.id}
                  boxType={(selectedBlock.blockType ?? 'unbekannt') as import('./dsaTypes').DsaBlockType}
                  boxBbox={selectedBlock.bbox}
                  boxText={selectedBlock.textRaw}
                  readingOrder={selectedBlock.readingOrder}
                  activeTool={activeTool}
                  onTypeChange={(type) => {
                    setSelectedBlockType(type as typeof selectedBlockType);
                    createAnnotation(
                      'relabel',
                      {
                        blockType: type,
                        roleHint: type === 'person' ? 'npc_profile' : type,
                        readingOrder: selectedBlock.readingOrder,
                        sourceBlockId: selectedBlock.id,
                      },
                      'block'
                    );
                  }}
                  onTextChange={setEditTextValue}
                  onTextSave={() => {
                    if (editTextValue) {
                      createAnnotation('relabel', { textRaw: editTextValue, sourceBlockId: selectedBlock.id }, 'block');
                      setEditTextValue('');
                    }
                  }}
                  onTextCancel={() => setEditTextValue('')}
                  onDelete={applySelectedDelete}
                />
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

function summarizePageBlocks(blocks: PdfBlock[]): string {
  if (!blocks.length) {
    return 'keine Blöcke';
  }

  const counts = new Map<string, number>();
  for (const block of blocks) {
    counts.set(block.blockType, (counts.get(block.blockType) ?? 0) + 1);
  }

  const summary = Array.from(counts.entries())
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, 2)
    .map(([blockType, count]) => `${blockType} ${count}`)
    .join(' · ');

  return summary || 'keine Blöcke';
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
