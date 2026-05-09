import streamlit as st
import json
import subprocess
import os
from pathlib import Path

st.set_page_config(page_title="Surya PDF Analyzer", layout="wide")
st.title("🔍 Surya PDF Analyzer — Bounding Boxes & OCR")
st.markdown("Lokale Surya-OCR + Layout-Analyse mit Bounding-Box-Visualisierung")

uploaded_file = st.file_uploader("PDF hochladen", type=["pdf"])

if uploaded_file:
    # Temporär speichern
    temp_path = f"/tmp/surya_app/{uploaded_file.name}"
    os.makedirs("/tmp/surya_app", exist_ok=True)
    with open(temp_path, "wb") as f:
        f.write(uploaded_file.getvalue())
    
    st.success(f"PDF gespeichert: {uploaded_file.name}")
    
    col1, col2 = st.columns(2)
    
    with col1:
        st.subheader("📐 Layout-Analyse")
        if st.button("Layout erkennen", key="layout"):
            with st.spinner("Surya Layout läuft... (~20 Sekunden)"):
                result = subprocess.run(
                    ["/Volumes/Crucial X9/venv-marker/bin/surya_layout", temp_path, 
                     "--results_dir", "/tmp/surya_app/layout/"],
                    capture_output=True, text=True, timeout=300
                )
                if result.returncode == 0:
                    st.success("Layout erkannt!")
                    # JSON laden
                    base_name = Path(uploaded_file.name).stem
                    json_path = f"/tmp/surya_app/layout/{base_name}/results.json"
                    if os.path.exists(json_path):
                        with open(json_path) as f:
                            data = json.load(f)
                        pages = data.get(uploaded_file.name, [])
                        for i, page in enumerate(pages):
                            bboxes = page.get('bboxes', [])
                            st.write(f"Seite {i+1}: {len(bboxes)} Blöcke")
                            for bbox in bboxes:
                                label = bbox.get('label', 'unknown')
                                conf = bbox.get('confidence', 0)
                                bb = bbox.get('bbox', [0,0,0,0])
                                st.write(f"  **{label}** (conf: {conf:.2f}) — bbox: {bb}")
                else:
                    st.error(f"Fehler: {result.stderr}")
    
    with col2:
        st.subheader("📝 OCR Text")
        if st.button("OCR erkennen", key="ocr"):
            with st.spinner("Surya OCR läuft... (~2 Minuten)"):
                result = subprocess.run(
                    ["/Volumes/Crucial X9/venv-marker/bin/surya_ocr", temp_path,
                     "--results_dir", "/tmp/surya_app/ocr/",
                     "--langs", "German"],
                    capture_output=True, text=True, timeout=600
                )
                if result.returncode == 0:
                    st.success("OCR erkannt!")
                    base_name = Path(uploaded_file.name).stem
                    json_path = f"/tmp/surya_app/ocr/{base_name}/results.json"
                    if os.path.exists(json_path):
                        with open(json_path) as f:
                            data = json.load(f)
                        pages = data.get(uploaded_file.name, [])
                        for i, page in enumerate(pages):
                            lines = page.get('text_lines', [])
                            st.write(f"Seite {i+1}: {len(lines)} Zeilen")
                            for line in lines[:10]:
                                text = line.get('text', '')
                                conf = line.get('confidence', 0)
                                st.write(f"  [{conf:.2f}] {text}")
                            if len(lines) > 10:
                                st.write(f"  ... und {len(lines)-10} weitere")
                else:
                    st.error(f"Fehler: {result.stderr}")

st.divider()
st.markdown("**Hinweis:** Diese App nutzt Surya (Marker's OCR-/Layout-Engine) lokal auf dem Mac mini.")
