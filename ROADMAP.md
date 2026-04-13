# Roadmap

This document is the single source of truth for product direction and backlog priority.

## Product North Star

Build a local-first DSA5 adventure import workflow for Game Masters:
- Import adventure content from books/PDF/images
- Convert it into structured Foundry content (journals, scenes, NPCs, items, encounters)
- Support adventure rewriting/adaptation with new GM ideas
- Keep all content processing local (no cloud LLM required)

OpenClaw/WhatsApp is an optional interface, not a product requirement.

## Non-Negotiable Product Rules

1. Human review is mandatory before any world write operation.
2. MVP must include image generation support for battlemaps/tokens via ComfyUI tools.
3. Adventure rewrite/adaptation is part of MVP, not post-MVP.

## Delivery Plan (12 Weeks)

### Phase 1 (Weeks 1-4) - MVP Foundation ✅ Done

- ✅ `import-dsa5-adventure-from-text` — text/JSON to structured adventure (Jarvis, 2026-04-12)
- ✅ `create-scene-placeholder` — empty scene without ComfyUI (Codex, 2026-04-12)
- ✅ Local LLM stack validated: LM Studio + Qwen 2.5 7B + MCP bridge working end-to-end
- ⏳ Review-first write pipeline (preview/dry-run exists, explicit apply gate pending)

Release 1 (end of week 4):
- Stable local import/review loop via dry-run mode ✅

### Phase 2 (Weeks 5-8) - Core Import + Rewrite MVP

- ⏳ `create-journal-entry` — general journal for locations, lore, chapters (in progress)
- ✅ `create-actor-from-description` — free text NPC to DSA5 actor via LLM
- Adventure rewrite workflow (variant generation + GM-selected apply)

Release 2 (end of week 8):
- Usable MVP for journal/scene import and rewrite

### Phase 3 (Weeks 9-12) - Rich Content MVP

- `create-actor-from-description` (if not done in Phase 2)
- ComfyUI-driven battlemaps/tokens integrated in import flow
- Optional `create-custom-item`

Release 3 (end of week 12):
- End-to-end local-first adventure import MVP with rewrite + images

## Top-5 Backlog (Prioritized)

1. Review-First Write Gate (`L`)
- Value: prevents accidental world corruption and enforces GM control.
- DoD: all write-capable tools support `preview` mode and require explicit apply/confirm step.

2. `create-actor-from-description` (`L`)
- Value: converts free-text NPC descriptions to DSA5 actors without requiring structured JSON.
- DoD: accepts natural language, maps to DSA5 actor via LLM, falls back to compendium lookup.

3. Adventure Rewrite MVP (`M`)
- Value: allows GMs to adapt imported adventures with new ideas immediately.
- DoD: workflow can generate alternatives and apply selected changes after review.

4. ComfyUI Image Generation in MVP (`M`)
- Value: battlemaps/tokens generated as part of import flow.
- DoD: generation can be requested from import/rewrite workflow and attached to scene/token pipeline.

## Completed

- ✅ `create-actor-from-description` — `feat(dsa5): add create-actor-from-description tool` (d36b7b4)
- ✅ `create-journal-entry` — `feat(journal): add create-journal-entry tool` (67c3fd2)
- ✅ `create-scene-placeholder` — `feat(scene): add create-scene-placeholder tool` (a154698)
- ✅ `import-dsa5-adventure-from-text` — local DSA5 adventure pipeline (0166176)
- ✅ `import-dsa5-actor-from-json` — Optolith + custom DSA5 + raw Foundry formats
- ✅ Local LLM setup: LM Studio + Qwen 2.5 7B, STUN default leer, AUDIT_LOG opt-in

## Optional Interface Track (Not Required)

- OpenClaw/WhatsApp integration
- Other local clients (desktop/mobile)

These are adapters around the same core pipeline and must not define core product scope.

## Message for Adam (English)

We are positioning the project around a local-first DSA5 adventure import pipeline for GMs. The core product is not OpenClaw; OpenClaw/WhatsApp is only an optional interface. MVP scope includes: (1) mandatory review-before-write, (2) adventure rewrite/adaptation workflows, and (3) local image generation for battlemaps/tokens via ComfyUI. The goal is practical import + customization of book adventures without relying on cloud LLMs, mainly due to copyright/privacy constraints.
