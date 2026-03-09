#!/usr/bin/env python3
"""
Local PDF chunk planner for LM Studio workflows.

- No cloud calls
- Handles large PDFs by splitting into chunk text files
- Emits a manifest for deterministic downstream processing
"""

from __future__ import annotations

import argparse
import json
import sys
from dataclasses import dataclass, asdict
from pathlib import Path
from typing import List, Tuple


@dataclass
class PageText:
    page: int
    text: str


@dataclass
class ChunkMeta:
    chunk: int
    start_page: int
    end_page: int
    page_count: int
    char_count: int
    file: str


def extract_with_pymupdf(pdf_path: Path) -> Tuple[int, List[PageText]]:
    import fitz  # type: ignore

    doc = fitz.open(pdf_path)
    pages: List[PageText] = []
    for idx in range(len(doc)):
        page = doc[idx]
        pages.append(PageText(page=idx + 1, text=page.get_text("text") or ""))
    return len(doc), pages


def extract_with_pypdf(pdf_path: Path) -> Tuple[int, List[PageText]]:
    from pypdf import PdfReader  # type: ignore

    reader = PdfReader(str(pdf_path))
    pages: List[PageText] = []
    for idx, p in enumerate(reader.pages):
        pages.append(PageText(page=idx + 1, text=p.extract_text() or ""))
    return len(reader.pages), pages


def extract_pages(pdf_path: Path) -> Tuple[int, List[PageText], str]:
    try:
        total, pages = extract_with_pymupdf(pdf_path)
        return total, pages, "pymupdf"
    except Exception:
        pass

    try:
        total, pages = extract_with_pypdf(pdf_path)
        return total, pages, "pypdf"
    except Exception as exc:
        raise RuntimeError(
            "Keine PDF-Extraktion möglich. Installiere `pymupdf` oder `pypdf`."
        ) from exc


def chunk_pages(
    pages: List[PageText], max_pages_per_chunk: int, max_chars_per_chunk: int
) -> List[List[PageText]]:
    chunks: List[List[PageText]] = []
    current: List[PageText] = []
    current_chars = 0

    for page in pages:
        page_chars = len(page.text)

        would_exceed_pages = len(current) >= max_pages_per_chunk
        would_exceed_chars = current and (current_chars + page_chars > max_chars_per_chunk)

        if would_exceed_pages or would_exceed_chars:
            chunks.append(current)
            current = []
            current_chars = 0

        current.append(page)
        current_chars += page_chars

    if current:
        chunks.append(current)

    return chunks


def write_outputs(
    output_dir: Path,
    pdf_path: Path,
    extractor: str,
    total_pages: int,
    chunks: List[List[PageText]],
) -> None:
    output_dir.mkdir(parents=True, exist_ok=True)

    chunk_meta: List[ChunkMeta] = []

    for i, chunk in enumerate(chunks, start=1):
        start_page = chunk[0].page
        end_page = chunk[-1].page
        text_blob_parts = []
        for p in chunk:
            text_blob_parts.append(f"\n\n===== PAGE {p.page} =====\n")
            text_blob_parts.append(p.text.strip())

        text_blob = "".join(text_blob_parts).strip() + "\n"
        filename = f"chunk-{i:02d}.txt"
        out_file = output_dir / filename
        out_file.write_text(text_blob, encoding="utf-8")

        chunk_meta.append(
            ChunkMeta(
                chunk=i,
                start_page=start_page,
                end_page=end_page,
                page_count=len(chunk),
                char_count=len(text_blob),
                file=filename,
            )
        )

    manifest = {
        "pdf": str(pdf_path),
        "fileSizeBytes": pdf_path.stat().st_size,
        "extractor": extractor,
        "totalPages": total_pages,
        "chunkCount": len(chunk_meta),
        "chunks": [asdict(c) for c in chunk_meta],
    }

    (output_dir / "manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8"
    )


def main() -> int:
    parser = argparse.ArgumentParser(description="Local PDF chunk planner for LM Studio")
    parser.add_argument("--pdf", required=True, help="Path to PDF")
    parser.add_argument("--output-dir", required=True, help="Output directory")
    parser.add_argument("--max-pages-per-chunk", type=int, default=12)
    parser.add_argument("--max-chars-per-chunk", type=int, default=28000)
    args = parser.parse_args()

    pdf_path = Path(args.pdf)
    output_dir = Path(args.output_dir)

    if not pdf_path.exists():
        print(f"ERROR: PDF nicht gefunden: {pdf_path}", file=sys.stderr)
        return 2

    if args.max_pages_per_chunk <= 0 or args.max_chars_per_chunk <= 0:
        print("ERROR: max-pages/max-chars müssen > 0 sein", file=sys.stderr)
        return 2

    try:
        total_pages, pages, extractor = extract_pages(pdf_path)
    except Exception as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 3

    chunks = chunk_pages(
        pages,
        max_pages_per_chunk=args.max_pages_per_chunk,
        max_chars_per_chunk=args.max_chars_per_chunk,
    )

    write_outputs(output_dir, pdf_path, extractor, total_pages, chunks)

    print(
        json.dumps(
            {
                "ok": True,
                "pdf": str(pdf_path),
                "extractor": extractor,
                "totalPages": total_pages,
                "chunkCount": len(chunks),
                "outputDir": str(output_dir),
            },
            ensure_ascii=False,
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
