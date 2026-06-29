#!/usr/bin/env python3
"""
PaddleOCR-Adapter für die Foundry VTT PDF-Import-Pipeline.

Aufruf:
  python3 paddle_ocr_adapter.py <pdf_path> <page_number> [--dpi 150]

Gibt JSON im OcrPageResult-Format aus:
  {
    "available": true,
    "engine": "paddleocr",
    "text": "...",
    "blocks": [
      {
        "kind": "paragraph",
        "text": "...",
        "bbox": { "x": 0, "y": 0, "w": 100, "h": 20 },
        "confidence": 0.95,
        "readingOrder": 1,
        "source": "ocr"
      }
    ],
    "pageWidth": 1236,
    "pageHeight": 1753
  }

--check: prüft ob PaddleOCR verfügbar ist (exit 0 = ja, exit 1 = nein)
"""

import sys
import os
import json
import time
import argparse

# Umgebungsvariable für PaddleX
os.environ["PADDLE_PDX_DISABLE_MODEL_SOURCE_CHECK"] = "True"


def check_available() -> bool:
    """Prüft ob PaddleOCR importierbar ist."""
    try:
        from paddleocr import PaddleOCR  # noqa: F401
        return True
    except ImportError:
        return False


def ocr_page(pdf_path: str, page_number: int, dpi: int = 150) -> dict:
    """OCR eine PDF-Seite mit PaddleOCR."""
    from paddleocr import PaddleOCR
    import pypdfium2 as pdfium

    # PDF-Seite rendern
    pdf = pdfium.PdfDocument(pdf_path)
    if page_number < 0 or page_number >= len(pdf):
        return {
            "available": False,
            "engine": "paddleocr",
            "reason": f"Seite {page_number} nicht gefunden (PDF hat {len(pdf)} Seiten)",
            "text": "",
            "blocks": [],
            "pageWidth": 0,
            "pageHeight": 0,
        }

    page = pdf[page_number]
    bitmap = page.render(scale=dpi / 72)
    pil_image = bitmap.to_pil()
    page_width, page_height = pil_image.size

    # Temp-Datei für OCR
    temp_img = f"/tmp/foundry_paddle_page_{page_number}_{os.getpid()}.png"
    pil_image.save(temp_img)

    try:
        # PaddleOCR initialisieren (einmalig, gecached)
        ocr = PaddleOCR(
            use_angle_cls=True,
            lang="german",
            show_log=False,
        )

        # OCR ausführen
        result = ocr.ocr(temp_img, cls=True)

        # Ergebnis parsen
        blocks = []
        full_text_lines = []

        if result and result[0]:
            for idx, line in enumerate(result[0]):
                bbox_points = line[0]  # [[x1,y1], [x2,y1], [x2,y2], [x1,y2]]
                text_info = line[1]
                text = text_info[0]
                confidence = text_info[1]

                # BBox aus den 4 Punkten berechnen
                x_coords = [p[0] for p in bbox_points]
                y_coords = [p[1] for p in bbox_points]
                x = min(x_coords)
                y = min(y_coords)
                w = max(x_coords) - x
                h = max(y_coords) - y

                # Confidence * 100 für Kompatibilität mit Tesseract-Format
                # (buildOcrBlock in layout_ocr.ts teilt durch 100)
                normalized_conf = round(confidence * 100, 1)

                blocks.append({
                    "kind": "paragraph",
                    "text": text,
                    "bbox": {
                        "x": round(x),
                        "y": round(y),
                        "w": round(w),
                        "h": round(h),
                    },
                    "confidence": normalized_conf,
                    "readingOrder": idx + 1,
                    "source": "ocr",
                })
                full_text_lines.append(text)

        return {
            "available": True,
            "engine": "paddleocr",
            "text": "\n".join(full_text_lines),
            "blocks": blocks,
            "pageWidth": page_width,
            "pageHeight": page_height,
        }

    except Exception as e:
        return {
            "available": False,
            "engine": "paddleocr",
            "reason": str(e),
            "text": "",
            "blocks": [],
            "pageWidth": page_width,
            "pageHeight": page_height,
        }

    finally:
        # Temp-Bild löschen
        try:
            os.remove(temp_img)
        except OSError:
            pass


def main():
    parser = argparse.ArgumentParser(description="PaddleOCR-Adapter für Foundry VTT")
    parser.add_argument("pdf_path", nargs="?", help="Pfad zur PDF-Datei")
    parser.add_argument("page_number", nargs="?", type=int, help="Seitenzahl (1-indexed)")
    parser.add_argument("--dpi", type=int, default=150, help="DPI für Rendering (default: 150)")
    parser.add_argument("--check", action="store_true", help="Nur Verfügbarkeit prüfen")
    parser.add_argument("--timeout", type=int, default=120, help="Timeout in Sekunden")

    args = parser.parse_args()

    if args.check:
        sys.exit(0 if check_available() else 1)

    if not args.pdf_path or args.page_number is None:
        parser.print_help()
        sys.exit(1)

    # page_number ist 1-indexed von der Pipeline, PaddleOCR braucht 0-indexed
    result = ocr_page(args.pdf_path, args.page_number - 1, args.dpi)

    # JSON ausgeben
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
