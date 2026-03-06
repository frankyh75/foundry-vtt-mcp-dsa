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

### Phase 1 (Weeks 1-4) - MVP Foundation

- Review-first write pipeline (preview + diff + explicit apply)
- Local ingestion flow for text/PDF/image inputs
- Baseline error model for actionable recovery

Release 1 (end of week 4):
- No direct writes without review gate
- Stable local import/review loop

### Phase 2 (Weeks 5-8) - Core Import + Rewrite MVP

- `create-journal-entry` for non-quest text import
- `create-scene-placeholder` for text-first scene setup
- Adventure rewrite workflow (variant generation + GM-selected apply)

Release 2 (end of week 8):
- Usable MVP for journal/scene import and rewrite

### Phase 3 (Weeks 9-12) - Rich Content MVP

- `create-actor-from-description` (free text to DSA5 actor)
- ComfyUI-driven battlemaps/tokens integrated in import flow
- Optional `create-custom-item` and encounter helper improvements

Release 3 (end of week 12):
- End-to-end local-first adventure import MVP with rewrite + images

## Top-5 Backlog (Prioritized)

1. Review-First Write Gate (`L`)
- Value: prevents accidental world corruption and enforces GM control.
- DoD: all write-capable tools support `preview` mode and require explicit apply/confirm step.

2. Adventure Rewrite MVP (`M`)
- Value: allows GMs to adapt imported adventures with new ideas immediately.
- DoD: workflow can generate alternatives and apply selected changes after review.

3. `create-journal-entry` (`M`)
- Value: imports most book content without forcing quest schema.
- DoD: supports `name`, `content`, optional category/tags.

4. `create-scene-placeholder` (`M`)
- Value: enables scene-first adventure setup without mandatory map generation.
- DoD: creates named scene with optional description/background metadata.

5. ComfyUI Image Generation in MVP (`M`)
- Value: battlemaps/tokens generated as part of import flow.
- DoD: generation can be requested from import/rewrite workflow and attached to scene/token pipeline.

## Optional Interface Track (Not Required)

- OpenClaw/WhatsApp integration
- Other local clients (desktop/mobile)

These are adapters around the same core pipeline and must not define core product scope.

## Message for Adam (English)

We are positioning the project around a local-first DSA5 adventure import pipeline for GMs. The core product is not OpenClaw; OpenClaw/WhatsApp is only an optional interface. MVP scope includes: (1) mandatory review-before-write, (2) adventure rewrite/adaptation workflows, and (3) local image generation for battlemaps/tokens via ComfyUI. The goal is practical import + customization of book adventures without relying on cloud LLMs, mainly due to copyright/privacy constraints.
