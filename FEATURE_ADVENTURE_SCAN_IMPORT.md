# Feature: Adventure Scan and Import Pipeline

## Vision

Allow DSA5 Game Masters to import adventure books (PDF/image/text) into Foundry as playable structured content, then adapt that content with new ideas, while keeping the full processing stack local.

## Scope Boundary

- Core product: local import + structured conversion + rewrite/adaptation + safe apply flow.
- Optional interface: OpenClaw/WhatsApp.
- OpenClaw is not mandatory for product success.

## MVP Decisions (Locked)

1. MVP includes image generation for battlemaps/tokens via ComfyUI tools.
2. Every world write requires review first (preview/diff/confirm).
3. Journal/scene import is first implementation focus.
4. Adventure rewrite/adaptation is part of MVP.
5. Target communication audience includes English-only collaborators.

## User Outcomes

1. Import adventure text from scanned pages/PDF into journals and scenes.
2. Generate/adapt adventure variants from GM ideas before applying.
3. Produce battlemaps/tokens locally and link them to created content.
4. Apply selected changes only after explicit review.

## Core Pipeline

1. Ingest input (PDF/image/text)
2. OCR if needed (local)
3. Structure extraction (NPCs, places, items, encounters, quest notes)
4. Rewrite/adaptation pass (optional)
5. Preview + diff
6. Explicit apply to Foundry

## Primary Tool Gaps

1. `create-journal-entry`
2. `create-scene-placeholder`
3. `create-actor-from-description`
4. review/apply protocol across write tools
5. integrated ComfyUI generation entrypoint in import flow

## Success Criteria

- GMs can complete an end-to-end import from source material without cloud LLM dependency.
- No write operation happens without user review.
- Rewrites are practical and selectable before apply.
- Map/token generation is available within MVP workflows.
