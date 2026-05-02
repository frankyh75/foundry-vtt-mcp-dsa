#!/usr/bin/env python3
"""
Qwen Chunked Block Review — v2
Bewiesener Ansatz: 3-5 Blöcke pro Request = ~2s Antwortzeit
"""

import json, sys, urllib.request, time
from collections import Counter

OLLAMA_URL = "http://127.0.0.1:11434/v1/chat/completions"
MODEL = "qwen2.5:7b-instruct"
CHUNK_SIZE = 5
VALID_ACTIONS = {"keep", "merge_with_next", "split", "reclassify", "drop"}
VALID_ROLES = {"heading", "narrative", "location", "npc_profile", "npc_name", 
               "item", "rules", "handout", "introduction", "meta", "unknown"}


def build_prompt(blocks, page_number):
    lines = []
    for b in sorted(blocks, key=lambda x: x.get("readingOrder", 0)):
        text = b.get("textNormalized", "").replace('"', '\\"')
        lines.append(
            f"Block {b['id']}: type={b.get('blockType') or 'null'} "
            f"role={b.get('roleHint') or 'null'} "
            f"text=\"{text[:200]}{'...' if len(text) > 200 else ''}\""
        )
    blocks_text = "\n".join(lines)

    return (
        f"Seite {page_number}:\n{blocks_text}\n\n"
        "Prüfe jeden Block. Regeln:\n"
        '- "keep": korrekt\n'
        '- "reclassify": roleHint falsch (z.B. Flavour-Text als location)\n'
        '- "merge_with_next": gehört zum nächsten Block\n'
        '- "drop": Müll/Fußzeile\n'
        f"Gültige roleHints: {', '.join(sorted(VALID_ROLES))}\n\n"
        "Antworte NUR als JSON: "
        '{"reviews":[{"blockId":"...","action":"...","correctedRoleHint":"...","reasoning":"..."}],'
        '"summary":{"totalBlocks":N,"changedBlocks":N}}'
    )


def call_qwen(system, user, timeout=30):
    payload = {
        "model": MODEL,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": user}
        ],
        "temperature": 0.1,
        "max_tokens": 2048
    }
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(OLLAMA_URL, data=data, headers={"Content-Type": "application/json"}, method="POST")
    start = time.time()
    resp = urllib.request.urlopen(req, timeout=timeout)
    elapsed = time.time() - start
    body = json.loads(resp.read().decode("utf-8"))
    content = body.get("choices", [{}])[0].get("message", {}).get("content", "")
    return content, elapsed


def extract_json(raw):
    """Extract JSON from markdown code blocks or raw string"""
    raw = raw.strip()
    if raw.startswith("```"):
        lines = raw.splitlines()
        if lines[0].startswith("```"):
            lines = lines[1:]
        if lines and lines[-1].startswith("```"):
            lines = lines[:-1]
        raw = "\n".join(lines).strip()
    return raw


def validate_review(raw_json, expected_count):
    try:
        data = json.loads(raw_json)
    except json.JSONDecodeError as e:
        return False, f"Invalid JSON: {e}"

    reviews = data.get("reviews", [])
    summary = data.get("summary", {})
    errors = []

    for i, r in enumerate(reviews):
        bid = r.get("blockId", "?")
        if r.get("action") not in VALID_ACTIONS:
            errors.append(f"[{i}] {bid}: invalid action '{r.get('action')}'")
        if r.get("correctedRoleHint") and r["correctedRoleHint"] not in VALID_ROLES:
            errors.append(f"[{i}] {bid}: invalid role '{r['correctedRoleHint']}'")

    total = summary.get("totalBlocks", 0)
    if total != expected_count:
        errors.append(f"summary.totalBlocks={total}, expected {expected_count}")

    return len(errors) == 0, "; ".join(errors) if errors else None


def review_page(ir_path, page_num):
    with open(ir_path) as f:
        ir = json.load(f)

    blocks = [b for b in ir.get("blocks", []) if b.get("pageNumber") == page_num]
    if not blocks:
        print(f"No blocks on page {page_num}")
        return 1

    print(f"Page {page_num}: {len(blocks)} blocks, chunk size={CHUNK_SIZE}")

    system = "Du bist ein präziser Review-Assistent für OCR-Blöcke aus DSA-Rollenspiel-PDFs."

    all_reviews = []
    total_elapsed = 0
    chunk_count = 0

    for i in range(0, len(blocks), CHUNK_SIZE):
        chunk = blocks[i:i + CHUNK_SIZE]
        prompt = build_prompt(chunk, page_num)

        print(f"\n  Chunk {chunk_count + 1}: blocks {i+1}-{min(i+CHUNK_SIZE, len(blocks))}...", end=" ")
        try:
            raw, elapsed = call_qwen(system, prompt, timeout=30)
            total_elapsed += elapsed
            chunk_count += 1
            print(f"OK ({elapsed:.1f}s)")

            raw_json = extract_json(raw)
            ok, err = validate_review(raw_json, len(chunk))
            if not ok:
                print(f"    VALIDATION WARN: {err}")

            data = json.loads(raw_json)
            all_reviews.extend(data.get("reviews", []))

        except Exception as e:
            print(f"FAIL: {e}")
            continue

    print(f"\n=== RESULTS ===")
    print(f"Chunks: {chunk_count}")
    print(f"Total Qwen time: {total_elapsed:.1f}s")
    print(f"Reviews collected: {len(all_reviews)}")

    actions = Counter(r["action"] for r in all_reviews)
    print(f"\nActions:")
    for act, cnt in actions.most_common():
        print(f"  {act}: {cnt}")

    print(f"\n=== CHANGES ===")
    changes = [r for r in all_reviews if r["action"] != "keep"]
    print(f"Total changes: {len(changes)}")
    for r in changes[:10]:
        print(f"\n  {r['blockId']}: {r['action']}")
        if r.get("correctedRoleHint"):
            print(f"    Role: -> {r['correctedRoleHint']}")
        print(f"    {r['reasoning'][:100]}")

    return 0


if __name__ == "__main__":
    ir_path = sys.argv[1] if len(sys.argv) > 1 else "/Users/openclaw/.foundry-mcp/pdf-review/Deicherbe1/projected.ir.json"
    page_num = int(sys.argv[2]) if len(sys.argv) > 2 else 6
    sys.exit(review_page(ir_path, page_num))
