import { useEffect, useRef, useCallback } from 'react';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';

interface PdfCanvasRendererProps {
  pdfDoc: pdfjsLib.PDFDocumentProxy | null;
  pageNumber: number;
  onPreviewUrl?: (url: string) => void;
  onCanvasSize?: (size: { width: number; height: number }) => void;
  className?: string;
}

export default function PdfCanvasRenderer({
  pdfDoc,
  pageNumber,
  onPreviewUrl,
  onCanvasSize,
  className = 'pdf-canvas',
}: PdfCanvasRendererProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const abortRef = useRef(false);

  const handleRender = useCallback(async () => {
    if (!pdfDoc || !canvasRef.current) return;
    abortRef.current = false;
    const canvas = canvasRef.current;

    try {
      const page = await pdfDoc.getPage(pageNumber);
      const viewport = page.getViewport({ scale: 1 });
      const vw = Math.ceil(viewport.width);
      const vh = Math.ceil(viewport.height);

      canvas.width = vw;
      canvas.height = vh;
      canvas.style.width = `${vw}px`;
      canvas.style.height = `${vh}px`;

      onCanvasSize?.({ width: vw, height: vh });

      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      if (abortRef.current) return;

      await page.render({ canvasContext: ctx, viewport }).promise;

      if (!abortRef.current && pageNumber === 1) {
        onPreviewUrl?.(canvas.toDataURL('image/png'));
      }
    } catch (err) {
      // Silently ignore abort errors or missing canvas
      console.debug('PdfCanvasRenderer render aborted or failed:', err);
    }
  }, [pdfDoc, pageNumber, onPreviewUrl, onCanvasSize]);

  useEffect(() => {
    void handleRender();
    return () => {
      abortRef.current = true;
    };
  }, [handleRender]);

  return <canvas ref={canvasRef} className={className} />;
}
