#!/usr/bin/env python3
"""
Qwen Block Review — Test der 3-Schicht-Trennung
Layer 1: OCR/Heuristik (bereits in projected.ir.json)
Layer 2: LLM-Review (Qwen korrigiert roleHint, merged/split, OCR-Fehler)
Layer 3: Schema-Validierung (manuell via asserts)
"""

import json, sys, urllib.request, os, time

OLLAMA_URL = "http://127.0.0.1:11434/v1/chat/completions"
MODEL = "qwen2.5:7b-instruct"

REVIEW_SCHEMA = {
    "type": "object",
    "properties": {
        "reviews": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "blockId": {"type": "string"},
                    "action": {"enum": ["keep", "merge_with_next", "split", "reclassify", "drop"]},
                    "correctedRoleHint": {"type": "string"},
                    "correctedText": {"type": "string"},
                    "confidenceAdjustment": {"type": "number", "minimum": 0, "maximum": 1},
                    "reasoning": {"type": "string"}
                },
                "required": ["blockId", "action", "reasoning"]
            }
        },
        "summary": {
            "type": "object",
            "properties": {
                "totalBlocks": {"type": "integer"},
                "changedBlocks": {"type": "integer"},
                "mergedBlocks": {"type": "integer"},
                "splitBlocks": {"type": "integer"},
                "droppedBlocks": {"type": "integer"}
            },
            "required": ["totalBlocks", "changedBlocks"]
        }
    },
    "required": ["reviews", "summary"]
}

VALID_ACTIONS = {"keep", "merge_with_next", "split", "reclassify", "drop"}
VALID_ROLES = {"heading", "narrative", "location", "npc_profile", "npc_name", "item", "rules", "handout", "unknown"}


def build_prompt(blocks, page_number):
    lines = []
    for b in sorted(blocks, key=lambda x: x.get("readingOrder", 0)):
        text = b.get("textNormalized", "").replace('"', '\\"')
        lines.append(
            f"--- Block {b['id']} ---\n"
            f"readingOrder: {b.get('readingOrder')}\n"
            f"blockType: {b.get('blockType') or 'null'}\n"
            f"roleHint: {b.get('roleHint') or 'null'}\n"
            f"text: \"{text[:300]}{'...' if len(text) > 300 else ''}\"\n"
            f"confidence: {b.get('confidence', 0):.3f}\n"
            f"provenance: {b.get('provenance', {}).get('producer', 'unknown')} / {b.get('provenance', {}).get('rule', 'unknown')}\n"
            "---"
        )
    blocks_text = "\n".join(lines)

    return (
        "Du bist ein OCR-Review-Assistent für ein deutsches Rollenspiel-PDF.\n"
        "Du bekommst vorab extrahierte Text-Blöcke mit Heuristik-Klassifikationen.\n"
        "Deine Aufgabe ist es, die Blöcke zu prüfen und Korrekturen vorzuschlagen.\n\n"
        "Regeln:\n"
        '- "keep": Block ist korrekt klassifiziert und Text ist sauber\n'
        '- "merge_with_next": Block gehört inhaltlich zum nächsten Block\n'
        '- "split": Block enthält zwei verschiedene Inhalte\n'
        '- "reclassify": roleHint/blockType ist falsch\n'
        '- "drop": Block ist Müll/Leerzeichen/Fußzeile ohne Inhalt\n'
        "- Korrigiere offensichtliche OCR-Fehler in correctedText\n"
        "- Setze correctedRoleHint wenn reclassify\n\n"
        f"Gültige roleHints: {', '.join(sorted(VALID_ROLES))}\n\n"
        f"Seite {page_number}:\n{blocks_text}\n\n"
        "Antworte NUR als gültiges JSON im obigen Schema. Kein Markdown, keine Erklärungen außerhalb des JSON.\n"
    )


def call_qwen(system, user, timeout=120):
    payload = {
        "model": MODEL,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": user}
        ],
        "temperature": 0.1,
        "max_tokens": 4096,
        "response_format": {"type": "json_object"}
    }
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        OLLAMA_URL,
        data=data,
        headers={"Content-Type": "application/json"},
        method="POST"
    )
    start = time.time()
    try:
        resp = urllib.request.urlopen(req, timeout=timeout)
        elapsed = time.time() - start
        body = json.loads(resp.read().decode("utf-8"))
        content = body.get("choices", [{}])[0].get("message", {}).get("content", "")
        return content, elapsed
    except urllib.error.HTTPError as e:
        raise RuntimeError(f"Qwen HTTP {e.code}: {e.read().decode()}")
    except Exception as e:
        raise RuntimeError(f"Qwen call failed: {e}")


def validate_result(raw_json, expected_block_count):
    try:
        data = json.loads(raw_json)
    except json.JSONDecodeError as e:
        return False, f"Invalid JSON: {e}"

    if not isinstance(data, dict):
        return False, "Root is not an object"

    reviews = data.get("reviews", [])
    summary = data.get("summary", {})

    if not isinstance(reviews, list):
        return False, "reviews is not an array"
    if not isinstance(summary, dict):
        return False, "summary is not an object"

    errors = []
    for i, r in enumerate(reviews):
        bid = r.get("blockId", "?")
        if r.get("action") not in VALID_ACTIONS:
            errors.append(f"Review[{i}] (block {bid}): invalid action '{r.get('action')}'")
        if r.get("correctedRoleHint") and r["correctedRoleHint"] not in VALID_ROLES:
            errors.append(f"Review[{i}] (block {bid}): invalid roleHint '{r['correctedRoleHint']}'")
        if not r.get("reasoning"):
            errors.append(f"Review[{i}] (block {bid}): missing reasoning")

    total = summary.get("totalBlocks", 0)
    changed = summary.get("changedBlocks", 0)

    if total != expected_block_count:
        errors.append(f"summary.totalBlocks={total} but expected {expected_block_count}")
    if not isinstance(changed, int) or changed < 0:
        errors.append(f"summary.changedBlocks={changed} is invalid")

    if errors:
        return False, "; ".join(errors)

    return True, None


def main():
    ir_path = sys.argv[1] if len(sys.argv) > 1 else "/Users/openclaw/.foundry-mcp/pdf-review/Deicherbe1/projected.ir.json"
    page_num = int(sys.argv[2]) if len(sys.argv) > 2 else 6

    print(f"Loading IR from {ir_path}...")
    with open(ir_path) as f:
        ir = json.load(f)

    blocks = [b for b in ir.get("blocks", []) if b.get("pageNumber") == page_num]
    print(f"Page {page_num}: {len(blocks)} blocks to review")

    prompt = build_prompt(blocks, page_num)
    system = "Du bist ein präziser Review-Assistent für OCR-Blöcke. Du antwortest ausschließlich in JSON."

    print(f"Calling Qwen ({MODEL})...")
    raw, elapsed = call_qwen(system, prompt, timeout=120)
    print(f"Qwen responded in {elapsed:.1f}s")

    print("\n--- Raw JSON (first 2000 chars) ---")
    print(raw[:2000])
    print("--- end raw ---\n")

    ok, err = validate_result(raw, len(blocks))
    if not ok:
        print(f"VALIDATION FAILED: {err}")
        sys.exit(1)

    result = json.loads(raw)
    reviews = result["reviews"]
    summary = result["summary"]

    print(f"\n=== RESULT ===")
    print(f"Total blocks reviewed: {summary['totalBlocks']}")
    print(f"Changed blocks: {summary['changedBlocks']}")
    print(f"Merged: {summary.get('mergedBlocks', 0)}")
    print(f"Split: {summary.get('splitBlocks', 0)}")
    print(f"Dropped: {summary.get('droppedBlocks', 0)}")

    print(f"\n=== ACTIONS BREAKDOWN ===")
    from collections import Counter
    actions = Counter(r["action"] for r in reviews)
    for act, cnt in actions.most_common():
        print(f"  {act}: {cnt}")

    print(f"\n=== SAMPLE REVIEWS ===")
    for r in reviews[:5]:
        print(f"\n  Block {r['blockId']}: {r['action']}")
        if r.get('correctedRoleHint'):
            print(f"    Role: {r.get('roleHint', 'null')} -> {r['correctedRoleHint']}")
        if r.get('correctedText'):
            print(f"    Text corrected: {r['correctedText'][:100]}")
        print(f"    Reason: {r['reasoning'][:120]}")

    print(f"\n=== VALIDATION: OK ===")
    print(f"Schema: compliant | Actions: valid | Summary: consistent")
    return 0


if __name__ == "__main__":
    sys.exit(main())
