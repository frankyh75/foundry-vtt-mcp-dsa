/**
 * DSA-spezifische Block-Typen für den PDF-Review-Editor.
 * Diese Typen ersetzen die generischen technical blockType-Werte
 * und repräsentieren die semantische Bedeutung im DSA-Kontext.
 */

export type DsaBlockType =
  | 'überschrift'
  | 'vorlesetext'
  | 'spielleiter-info'
  | 'person'
  | 'ort'
  | 'szene'
  | 'würfelprobe'
  | 'gegenstand'
  | 'regelbox'
  | 'tabelle'
  | 'stimmungstext'
  | 'dekoration'
  | 'unbekannt';

export const DSA_BLOCK_TYPES: DsaBlockType[] = [
  'überschrift',
  'vorlesetext',
  'spielleiter-info',
  'person',
  'ort',
  'szene',
  'würfelprobe',
  'gegenstand',
  'regelbox',
  'tabelle',
  'stimmungstext',
  'dekoration',
  'unbekannt',
];

export const DSA_BLOCK_LABELS: Record<DsaBlockType, string> = {
  'überschrift': 'Überschrift',
  'vorlesetext': 'Vorlesetext',
  'spielleiter-info': 'Spielleiter-Info',
  'person': 'Person / NSC',
  'ort': 'Ort',
  'szene': 'Szene',
  'würfelprobe': 'Würfelprobe',
  'gegenstand': 'Gegenstand',
  'regelbox': 'Regelbox',
  'tabelle': 'Tabelle',
  'stimmungstext': 'Stimmungstext',
  'dekoration': 'Dekoration',
  'unbekannt': 'Unbekannt',
};

export const DSA_BLOCK_COLORS: Record<DsaBlockType, string> = {
  'überschrift': '#e74c3c',
  'vorlesetext': '#27ae60',
  'spielleiter-info': '#f39c12',
  'person': '#9b59b6',
  'ort': '#3498db',
  'szene': '#e67e22',
  'würfelprobe': '#1abc9c',
  'gegenstand': '#95a5a6',
  'regelbox': '#34495e',
  'tabelle': '#16a085',
  'stimmungstext': '#d35400',
  'dekoration': '#bdc3c7',
  'unbekannt': '#7f8c8d',
};

/** Werkzeug-Modi im Editor */
export type EditorTool =
  | 'select'      // Boxen auswählen, verschieben, resize
  | 'draw'        // Neue Box zeichnen
  | 'split'       // Box teilen
  | 'merge'       // Boxen vereinen
  | 'delete'      // Box löschen
  | 'edit-text'   // Text korrigieren
  | 'ai-chat';    // KI-Assistenz

export const EDITOR_TOOLS: EditorTool[] = [
  'select',
  'draw',
  'split',
  'merge',
  'delete',
  'edit-text',
  'ai-chat',
];

export const EDITOR_TOOL_LABELS: Record<EditorTool, string> = {
  'select': 'Auswählen',
  'draw': 'Box zeichnen',
  'split': 'Teilen',
  'merge': 'Vereinigen',
  'delete': 'Löschen',
  'edit-text': 'Text korrigieren',
  'ai-chat': 'KI-Chat',
};

/** Editor-Phase */
export type EditorPhase =
  | 'config'      // Konfiguration
  | 'load'        // Datei laden
  | 'analyze'     // Analyse läuft
  | 'review'      // Überarbeitung
  | 'export';     // Export

export const EDITOR_PHASES: EditorPhase[] = [
  'config',
  'load',
  'analyze',
  'review',
  'export',
];

export const EDITOR_PHASE_LABELS: Record<EditorPhase, string> = {
  'config': 'Konfiguration',
  'load': 'Datei laden',
  'analyze': 'Analyse',
  'review': 'Überarbeitung',
  'export': 'Export',
};

/** Geometrie-Hilfsfunktionen */
export interface PdfBBox { x: number; y: number; w: number; h: number }

export function bboxContainsPoint(bbox: PdfBBox, x: number, y: number): boolean {
  return x >= bbox.x && x <= bbox.x + bbox.w && y >= bbox.y && y <= bbox.y + bbox.h;
}

export function bboxIntersection(a: PdfBBox, b: PdfBBox): PdfBBox | null {
  const x1 = Math.max(a.x, b.x);
  const y1 = Math.max(a.y, b.y);
  const x2 = Math.min(a.x + a.w, b.x + b.w);
  const y2 = Math.min(a.y + a.h, b.y + b.h);
  if (x2 <= x1 || y2 <= y1) return null;
  return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
}

export function bboxArea(bbox: PdfBBox): number {
  return bbox.w * bbox.h;
}
