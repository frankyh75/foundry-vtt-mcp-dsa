import { useCallback, useEffect, useRef, useState } from 'react';
import type { PdfBBox, DsaBlockType, EditorTool } from './dsaTypes';
import { DSA_BLOCK_COLORS } from './dsaTypes';

export interface EditableBox {
  id: string;
  bbox: PdfBBox;
  blockType: DsaBlockType;
  textRaw: string;
  label?: string;
  readingOrder?: number;
  selected?: boolean;
  hovered?: boolean;
}

interface Point { x: number; y: number }

interface SvgCanvasProps {
  /** Pfad zum gerenderten Seiten-Bild (PNG/JPG) */
  pageImageUrl?: string | null;
  /** Seiten-Größe in PDF-Koordinaten */
  pageWidth: number;
  pageHeight: number;
  /** Aktuelle Boxen */
  boxes: EditableBox[];
  /** Werkzeug-Modus */
  activeTool: EditorTool;
  /** Callback bei Änderungen */
  onBoxesChange: (boxes: EditableBox[]) => void;
  /** Callback bei Auswahl */
  onSelectBox: (boxId: string | null) => void;
  /** Aktuell ausgewählte Box-ID */
  selectedBoxId?: string | null;
  /** Skalierungsfaktor (1.0 = natürliche Größe) */
  scale?: number;
}

const HANDLE_SIZE = 8;
const MIN_SIZE = 4;

type DragMode =
  | { kind: 'none' }
  | { kind: 'move'; boxId: string; offset: Point }
  | { kind: 'resize'; boxId: string; handle: 'nw' | 'ne' | 'sw' | 'se'; startBox: PdfBBox; startPoint: Point }
  | { kind: 'draw'; start: Point };

export default function SvgCanvas({
  pageImageUrl,
  pageWidth,
  pageHeight,
  boxes,
  activeTool,
  onBoxesChange,
  onSelectBox,
  selectedBoxId,
  scale = 1.0,
}: SvgCanvasProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [drag, setDrag] = useState<DragMode>({ kind: 'none' });
  const [hoveredBoxId, setHoveredBoxId] = useState<string | null>(null);
  const [drawPreview, setDrawPreview] = useState<{ x: number; y: number; w: number; h: number } | null>(null);

  // Koordinaten-Umwandlung: Bildschirm → SVG
  const screenToSvg = useCallback((screenX: number, screenY: number): Point => {
    if (!svgRef.current) return { x: 0, y: 0 };
    const rect = svgRef.current.getBoundingClientRect();
    const x = (screenX - rect.left) / scale;
    const y = (screenY - rect.top) / scale;
    return { x, y };
  }, [scale]);

  // Pointer-Down Handler
  const handlePointerDown = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    e.preventDefault();
    const pt = screenToSvg(e.clientX, e.clientY);
    const target = e.target as SVGElement;

    // Resize-Handle angefasst?
    const handleAttr = target.getAttribute('data-handle');
    const boxIdAttr = target.getAttribute('data-box-id');
    if (handleAttr && boxIdAttr && activeTool === 'select') {
      const box = boxes.find((b) => b.id === boxIdAttr);
      if (box) {
        setDrag({ kind: 'resize', boxId: boxIdAttr, handle: handleAttr as any, startBox: { ...box.bbox }, startPoint: pt });
        return;
      }
    }

    // Box angefasst?
    if (boxIdAttr && activeTool === 'select') {
      const box = boxes.find((b) => b.id === boxIdAttr);
      if (box) {
        onSelectBox(boxIdAttr);
        setDrag({ kind: 'move', boxId: boxIdAttr, offset: { x: pt.x - box.bbox.x, y: pt.y - box.bbox.y } });
        return;
      }
    }

    // Hintergrund geklickt
    onSelectBox(null);

    if (activeTool === 'draw') {
      setDrag({ kind: 'draw', start: pt });
      setDrawPreview({ x: pt.x, y: pt.y, w: 0, h: 0 });
      return;
    }
  }, [activeTool, boxes, onSelectBox, screenToSvg]);

  // Pointer-Move Handler
  const handlePointerMove = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    const pt = screenToSvg(e.clientX, e.clientY);

    if (drag.kind === 'move') {
      const newX = pt.x - drag.offset.x;
      const newY = pt.y - drag.offset.y;
      const clampedX = Math.max(0, Math.min(newX, pageWidth - MIN_SIZE));
      const clampedY = Math.max(0, Math.min(newY, pageHeight - MIN_SIZE));
      onBoxesChange(
        boxes.map((b) =>
          b.id === drag.boxId ? { ...b, bbox: { ...b.bbox, x: clampedX, y: clampedY } } : b
        )
      );
      return;
    }

    if (drag.kind === 'resize') {
      const { boxId, handle, startBox, startPoint } = drag;
      const dx = pt.x - startPoint.x;
      const dy = pt.y - startPoint.y;
      let newBox = { ...startBox };
      switch (handle) {
        case 'se':
          newBox = { ...newBox, w: Math.max(MIN_SIZE, startBox.w + dx), h: Math.max(MIN_SIZE, startBox.h + dy) };
          break;
        case 'sw':
          newBox = {
            ...newBox,
            x: Math.min(startBox.x + dx, startBox.x + startBox.w - MIN_SIZE),
            w: Math.max(MIN_SIZE, startBox.w - dx),
            h: Math.max(MIN_SIZE, startBox.h + dy),
          };
          break;
        case 'ne':
          newBox = {
            ...newBox,
            y: Math.min(startBox.y + dy, startBox.y + startBox.h - MIN_SIZE),
            w: Math.max(MIN_SIZE, startBox.w + dx),
            h: Math.max(MIN_SIZE, startBox.h - dy),
          };
          break;
        case 'nw':
          newBox = {
            ...newBox,
            x: Math.min(startBox.x + dx, startBox.x + startBox.w - MIN_SIZE),
            y: Math.min(startBox.y + dy, startBox.y + startBox.h - MIN_SIZE),
            w: Math.max(MIN_SIZE, startBox.w - dx),
            h: Math.max(MIN_SIZE, startBox.h - dy),
          };
          break;
      }
      // Clamp to page bounds
      newBox.x = Math.max(0, Math.min(newBox.x, pageWidth - MIN_SIZE));
      newBox.y = Math.max(0, Math.min(newBox.y, pageHeight - MIN_SIZE));
      newBox.w = Math.min(newBox.w, pageWidth - newBox.x);
      newBox.h = Math.min(newBox.h, pageHeight - newBox.y);
      onBoxesChange(boxes.map((b) => (b.id === boxId ? { ...b, bbox: newBox } : b)));
      return;
    }

    if (drag.kind === 'draw') {
      const start = drag.start;
      const x = Math.min(start.x, pt.x);
      const y = Math.min(start.y, pt.y);
      const w = Math.abs(pt.x - start.x);
      const h = Math.abs(pt.y - start.y);
      setDrawPreview({ x, y, w, h });
      return;
    }

    // Hover-Erkennung
    const hovered = boxes.find((b) => {
      const bx = b.bbox;
      return pt.x >= bx.x && pt.x <= bx.x + bx.w && pt.y >= bx.y && pt.y <= bx.y + bx.h;
    });
    setHoveredBoxId(hovered?.id ?? null);
  }, [drag, boxes, onBoxesChange, pageWidth, pageHeight, screenToSvg]);

  // Pointer-Up Handler
  const handlePointerUp = useCallback(() => {
    if (drag.kind === 'draw' && drawPreview && drawPreview.w > MIN_SIZE && drawPreview.h > MIN_SIZE) {
      const newBox: EditableBox = {
        id: `box-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        bbox: { x: drawPreview.x, y: drawPreview.y, w: drawPreview.w, h: drawPreview.h },
        blockType: 'unbekannt',
        textRaw: '',
        readingOrder: boxes.length + 1,
      };
      onBoxesChange([...boxes, newBox]);
      onSelectBox(newBox.id);
    }
    setDrag({ kind: 'none' });
    setDrawPreview(null);
  }, [drag, drawPreview, boxes, onBoxesChange, onSelectBox]);

  // Box löschen
  const deleteSelected = useCallback(() => {
    if (selectedBoxId) {
      onBoxesChange(boxes.filter((b) => b.id !== selectedBoxId));
      onSelectBox(null);
    }
  }, [selectedBoxId, boxes, onBoxesChange, onSelectBox]);

  // Tastatur-Shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedBoxId && activeTool !== 'draw') {
          deleteSelected();
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedBoxId, activeTool, deleteSelected]);

  // SVG-Elemente rendern
  const svgW = pageWidth * scale;
  const svgH = pageHeight * scale;

  return (
    <svg
      ref={svgRef}
      data-testid="page-canvas"
      className="svg-canvas"
      viewBox={`0 0 ${pageWidth} ${pageHeight}`}
      style={{ width: svgW, height: svgH, cursor: activeTool === 'draw' ? 'crosshair' : drag.kind !== 'none' ? 'grabbing' : hoveredBoxId ? 'pointer' : 'default' }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
    >
      <defs>
        <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
          <path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="0.5" />
        </pattern>
      </defs>

      {/* Hintergrund: Seiten-Bild oder Fallback */}
      {pageImageUrl ? (
        <image href={pageImageUrl} x={0} y={0} width={pageWidth} height={pageHeight} preserveAspectRatio="none" />
      ) : (
        <rect width={pageWidth} height={pageHeight} fill="#1a1a2e" />
      )}
      <rect width={pageWidth} height={pageHeight} fill="url(#grid)" />

      {/* Boxen */}
      {boxes.map((box) => {
        const isSelected = box.id === selectedBoxId;
        const isHovered = box.id === hoveredBoxId;
        const color = DSA_BLOCK_COLORS[box.blockType] || '#7f8c8d';
        const strokeWidth = isSelected ? 2.5 : isHovered ? 2 : 1;
        const opacity = isSelected ? 0.35 : isHovered ? 0.25 : 0.15;
        return (
          <g key={box.id} data-box-id={box.id}>
            {/* Box-Füllung */}
            <rect
              x={box.bbox.x}
              y={box.bbox.y}
              width={box.bbox.w}
              height={box.bbox.h}
              fill={color}
              fillOpacity={opacity}
              stroke={color}
              strokeWidth={strokeWidth}
              strokeDasharray={isSelected ? undefined : '4 2'}
              rx={2}
              data-box-id={box.id}
            />
            {/* Label */}
            <text
              x={box.bbox.x + 4}
              y={box.bbox.y + 14}
              fill={color}
              fontSize={12}
              fontWeight="bold"
              fontFamily="system-ui, sans-serif"
              pointerEvents="none"
            >
              {box.label || box.blockType}
            </text>
            {/* Reading Order */}
            {box.readingOrder !== undefined && (
              <text
                x={box.bbox.x + box.bbox.w - 4}
                y={box.bbox.y + 14}
                fill={color}
                fontSize={10}
                textAnchor="end"
                fontFamily="system-ui, sans-serif"
                pointerEvents="none"
              >
                #{box.readingOrder}
              </text>
            )}
            {/* Resize-Handles (nur wenn select und selected) */}
            {isSelected && activeTool === 'select' && (
              <>
                {(['nw', 'ne', 'sw', 'se'] as const).map((handle) => {
                  const hx = handle.includes('w') ? box.bbox.x : box.bbox.x + box.bbox.w;
                  const hy = handle.includes('n') ? box.bbox.y : box.bbox.y + box.bbox.h;
                  return (
                    <rect
                      key={handle}
                      x={hx - HANDLE_SIZE / 2}
                      y={hy - HANDLE_SIZE / 2}
                      width={HANDLE_SIZE}
                      height={HANDLE_SIZE}
                      fill="white"
                      stroke={color}
                      strokeWidth={1.5}
                      data-handle={handle}
                      data-box-id={box.id}
                      style={{ cursor: `${handle}-resize` }}
                    />
                  );
                })}
              </>
            )}
          </g>
        );
      })}

      {/* Draw-Preview */}
      {drawPreview && drawPreview.w > 0 && drawPreview.h > 0 && (
        <rect
          x={drawPreview.x}
          y={drawPreview.y}
          width={drawPreview.w}
          height={drawPreview.h}
          fill="rgba(255,255,255,0.1)"
          stroke="white"
          strokeWidth={1.5}
          strokeDasharray="4 2"
          rx={2}
        />
      )}
    </svg>
  );
}
