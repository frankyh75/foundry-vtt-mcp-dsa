#!/usr/bin/env python3
"""
Evaluation-Skript: Surya vs. Tesseract auf Golden-Sample-PDFs.
Erstellt Sessions, lädt PDFs hoch, analysiert mit beiden Engines,
speichert IR-JSONs und generiert einen Vergleichsreport.
"""

import json
import os
import subprocess
import sys
import time
from pathlib import Path

API_BASE = "http://localhost:4174"
FIXTURES_DIR = Path("/Users/openclaw/.foundry-mcp/pdf-review/copyright-material/fixtures")
OUTPUT_DIR = Path("/Users/openclaw/.foundry-mcp/pdf-review/evaluation-results")

# 6 Golden-Sample-Seiten
PAGES = [
    ("p08-elidan", "Deicherbe-p08-elidan.pdf"),
    ("p09-kinder", "Deicherbe-p09-kinder.pdf"),
    ("p12-deichbauern", "Deicherbe-p12-deichbauern.pdf"),
    ("p16-krakenmolch", "Deicherbe-p16-krakenmolch.pdf"),
    ("p17-orknase", "Deicherbe-p17-orknase.pdf"),
    ("p17-thorwaler", "Deicherbe-p17-thorwaler.pdf"),
]


def curl_json(method, path, data=None, file_path=None):
    """curl-Helfer für JSON-API."""
    url = f"{API_BASE}{path}"
    if method == "POST" and file_path:
        # multipart upload
        cmd = [
            "curl", "-s", "-X", "POST",
            "-F", f"file=@{file_path}",
            url
        ]
    elif method == "POST" and data:
        cmd = [
            "curl", "-s", "-X", "POST",
            "-H", "Content-Type: application/json",
            "-d", json.dumps(data),
            url
        ]
    elif method == "GET":
        cmd = ["curl", "-s", url]
    else:
        cmd = ["curl", "-s", "-X", method, url]

    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        print(f"  ❌ curl failed: {result.stderr}")
        return None
    try:
        return json.loads(result.stdout)
    except json.JSONDecodeError:
        return {"raw": result.stdout}


def create_session(session_id):
    """Session anlegen (lazy, passiert beim Upload automatisch)."""
    print(f"📁 Session: {session_id}")
    return True


def upload_pdf(session_id, pdf_path):
    """PDF hochladen (PUT mit raw binary)."""
    print(f"  ⬆️  Upload: {pdf_path.name}")
    url = f"{API_BASE}/sessions/{session_id}/pdf"
    cmd = [
        "curl", "-s", "-X", "PUT",
        "-H", f"X-Filename: {pdf_path.name}",
        "--data-binary", f"@{pdf_path}",
        url
    ]
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        print(f"  ❌ Upload failed: {result.stderr}")
        return False
    try:
        resp = json.loads(result.stdout)
        if resp.get("ok"):
            print(f"  ✅ Upload OK")
            return True
        print(f"  ⚠️  Upload: {resp}")
        return False
    except json.JSONDecodeError:
        print(f"  ⚠️  Upload raw: {result.stdout[:200]}")
        return False


def analyze(session_id, engine, model="llava:13b"):
    """Analyse starten."""
    print(f"  🔬 Analyse: {engine} …", end="", flush=True)
    payload = {
        "model": model,
        "options": {"ocrEngine": engine} if engine == "surya" else {}
    }
    resp = curl_json("POST", f"/sessions/{session_id}/analyze", data=payload)
    if resp and "analysisId" in str(resp):
        print(f" gestartet")
        return resp.get("analysisId", "?")
    print(f" Fehler: {resp}")
    return None


def wait_for_analysis(session_id, timeout=300):
    """Warte bis Analyse fertig (pollen auf IR)."""
    print(f"  ⏳ Warte auf Fertigstellung …", end="", flush=True)
    for i in range(timeout // 5):
        time.sleep(5)
        ir = curl_json("GET", f"/sessions/{session_id}/ir")
        if ir and ir.get("blocks"):
            block_count = len(ir.get("blocks", []))
            print(f" fertig ({block_count} Blöcke)")
            return ir
    print(f" TIMEOUT")
    return None


def save_ir(session_id, engine, ir_data):
    """IR speichern."""
    out_file = OUTPUT_DIR / f"{session_id}-{engine}.ir.json"
    with open(out_file, "w", encoding="utf-8") as f:
        json.dump(ir_data, f, ensure_ascii=False, indent=2)
    print(f"  💾 IR → {out_file.name}")
    return out_file


def generate_report(results):
    """Markdown-Report generieren."""
    report_file = OUTPUT_DIR / "evaluation-report.md"
    lines = [
        "# OCR-Engine Evaluation: Surya vs. Tesseract",
        "",
        f"**Datum:** {time.strftime('%Y-%m-%d %H:%M')}",
        f"**Seiten:** {len(PAGES)} Golden-Sample-Seiten aus 'Deicherbe'",
        "",
        "## Zusammenfassung",
        "",
        "| Seite | Tesseract (Blöcke) | Surya (Blöcke) | Gewinner |",
        "|-------|-------------------|----------------|----------|",
    ]

    for page_id, t_ir, s_ir in results:
        t_blocks = len(t_ir.get("blocks", [])) if t_ir else 0
        s_blocks = len(s_ir.get("blocks", [])) if s_ir else 0
        winner = "Surya" if s_blocks > 0 and (s_blocks < t_blocks or t_blocks == 0) else "Tesseract" if t_blocks > 0 else "–"
        lines.append(f"| {page_id} | {t_blocks} | {s_blocks} | {winner} |")

    lines.extend([
        "",
        "## Details pro Seite",
        "",
    ])

    for page_id, t_ir, s_ir in results:
        lines.extend([
            f"### {page_id}",
            "",
            "#### Tesseract",
            "",
        ])
        if t_ir:
            for b in t_ir.get("blocks", [])[:5]:
                label = b.get("blockType", "?")
                text = (b.get("textNormalized") or b.get("textRaw", ""))[:60].replace("\n", " ")
                lines.append(f"- `{label}`: {text}")
        else:
            lines.append("- Keine Daten")

        lines.extend([
            "",
            "#### Surya",
            "",
        ])
        if s_ir:
            for b in s_ir.get("blocks", [])[:5]:
                label = b.get("blockType", "?")
                text = (b.get("textNormalized") or b.get("textRaw", ""))[:60].replace("\n", " ")
                lines.append(f"- `{label}`: {text}")
        else:
            lines.append("- Keine Daten")
        lines.append("")

    with open(report_file, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))
    print(f"\n📊 Report: {report_file}")


def main():
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    results = []

    for page_id, pdf_name in PAGES:
        pdf_path = FIXTURES_DIR / pdf_name
        if not pdf_path.exists():
            print(f"⚠️  Nicht gefunden: {pdf_path}")
            continue

        print(f"\n{'='*60}")
        print(f"📄 {page_id}: {pdf_name}")
        print(f"{'='*60}")

        # Tesseract
        t_session = f"eval-{page_id}-tesseract"
        create_session(t_session)
        if upload_pdf(t_session, pdf_path):
            t_analysis = analyze(t_session, "tesseract")
            if t_analysis:
                t_ir = wait_for_analysis(t_session)
                if t_ir:
                    save_ir(t_session, "tesseract", t_ir)
                else:
                    t_ir = None
            else:
                t_ir = None
        else:
            t_ir = None

        # Surya
        s_session = f"eval-{page_id}-surya"
        create_session(s_session)
        if upload_pdf(s_session, pdf_path):
            s_analysis = analyze(s_session, "surya")
            if s_analysis:
                s_ir = wait_for_analysis(s_session)
                if s_ir:
                    save_ir(s_session, "surya", s_ir)
                else:
                    s_ir = None
            else:
                s_ir = None
        else:
            s_ir = None

        results.append((page_id, t_ir, s_ir))

    # Report
    print(f"\n{'='*60}")
    print("📊 Generiere Report …")
    generate_report(results)
    print(f"{'='*60}")
    print("✅ Evaluation abgeschlossen!")


if __name__ == "__main__":
    main()
